let me = null, cfg = { genres: [] }, cache = {};
const root = $('#root');
const NAV = [['', 'Dashboard'], ['concerts', 'Concerts'], ['bookings', 'Bookings'], ['users', 'Users']];
const page = () => location.hash.split('/')[1] || '';

function shell(title, sub, body, actions = '') {
  root.innerHTML = `<div class="ad"><aside class="side"><a class="logo" href="#/"><i>♪</i>ConcertHub</a>
  ${NAV.map(([p, l]) => `<a href="#/${p}" class="${page() === p ? 'on' : ''}">${l}</a>`).join('')}
  <span class="sp"></span><a href="/" target="_blank" rel="noopener">View website</a><a data-a="logout">Log out (${esc(me.name.split(' ')[0])})</a></aside>
  <main class="main"><div class="hd"><div><h1>${title}</h1><p class="sub">${sub}</p></div><div class="row">${actions}</div></div>${body}</main></div>`;
}
const st = s => `<span class="st ${s}">${s === 'confirmed' ? 'Confirmed' : s === 'active' ? 'Active' : s === 'cancelled' ? 'Cancelled' : esc(s)}</span>`;
const table = (head, rows, emptyMsg) => `<div class="tw"><table class="tbl"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${
  rows.length ? rows.join('') : `<tr><td colspan="${head.length}" class="meta" style="text-align:center;padding:34px">${emptyMsg}</td></tr>`}</tbody></table></div>`;

function loginView(msg = '') {
  root.innerHTML = `<div class="login"><form class="box md" data-f="login"><a class="logo" style="margin-bottom:14px"><i>♪</i>ConcertHub Admin</a>
  <h2>Admin log in</h2><p class="meta">Only administrator accounts can open this portal.</p>
  <label>Email</label><input type="email" name="email" required autocomplete="email"><label>Password</label><input type="password" name="password" required autocomplete="current-password">
  <p class="sold" id="ferr">${esc(msg)}</p><br><button class="btn p" style="width:100%">Log in</button><p class="meta" style="text-align:center;margin-top:14px"><a href="/" style="color:var(--ac)">Back to website</a></p></form></div>`;
}

async function pgDash() {
  const d = await api('/admin/stats'), k = d.kpis, max = Math.max(1, ...d.series.map(s => s.revenue));
  const bw = 560 / d.series.length;
  const chart = `<svg class="chart" viewBox="0 0 560 200" preserveAspectRatio="none" role="img" aria-label="Revenue for the last 14 days"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff3d81"/><stop offset="1" stop-color="#ffb547"/></linearGradient></defs>
  ${d.series.map((s, i) => { const h = Math.max(s.revenue ? 4 : 1, s.revenue / max * 150); return `<g><title>${s.date}: ${inr(s.revenue)} · ${s.bookings} bookings</title><rect x="${i * bw + 5}" y="${170 - h}" width="${bw - 10}" height="${h}" rx="4"/><text x="${i * bw + bw / 2}" y="190" text-anchor="middle">${s.date.slice(8)}</text></g>`; }).join('')}</svg>`;
  const cards = [['Revenue', inr(k.revenue)], ['Tickets sold', k.tickets.toLocaleString('en-IN')], ['Bookings', k.bookings], ['Cancelled', k.cancelled], ['Users', k.users], ['Upcoming shows', k.upcoming_concerts]];
  shell('Dashboard', 'How ConcertHub is doing right now.', `<div class="kpis">${cards.map(c => `<div class="kpi"><small>${c[0]}</small><b>${c[1]}</b></div>`).join('')}</div>
  <div class="two"><div class="box"><h3>Revenue, last 14 days</h3>${chart}</div>
  <div class="box"><h3>Best sellers</h3>${d.top.length ? d.top.map(t => `<div class="row" style="justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--line)"><span>${esc(t.title)}<br><small class="meta">${esc(t.artist)} · ${t.tickets} tickets</small></span><b>${inr(t.revenue)}</b></div>`).join('') : '<p class="meta">Sales will show up here.</p>'}</div></div><br>
  <div class="two"><div><h3 style="margin-bottom:10px">Recent bookings</h3>${table(['Reference', 'Customer', 'Concert', 'Total', 'Status'], d.recent.map(b => `<tr><td><b>${esc(b.reference)}</b></td><td>${esc(b.customer?.name || '—')}</td><td>${esc(b.concert?.title || 'Removed')}</td><td>${inr(b.total)}</td><td>${st(b.status)}</td></tr>`), 'No bookings yet.')}</div>
  <div><h3 style="margin-bottom:10px">Selling out soon</h3>${table(['Concert', 'Left'], d.low_stock.map(c => `<tr><td>${esc(c.title)}<br><small class="meta">${dFmt(c.event_date)}</small></td><td><span class="low">${c.available_tickets} / ${c.capacity}</span></td></tr>`), 'Nothing is close to selling out.')}</div></div>`);
}

async function pgConcerts() {
  cache.concerts = await api('/admin/concerts');
  shell('Concerts', 'Create, edit and cancel shows.', `<div class="filters"><input id="cq" placeholder="Filter by title, artist or city"></div><div id="ctable"></div>`, '<button class="btn p" data-a="new-concert">Add concert</button>');
  drawConcerts();
}
function drawConcerts() {
  const q = ($('#cq')?.value || '').toLowerCase(), list = cache.concerts.filter(c => `${c.title} ${c.artist} ${c.city}`.toLowerCase().includes(q));
  $('#ctable').innerHTML = table(['Concert', 'Date', 'City', 'Price', 'Sold', 'Status', ''], list.map(c => `<tr><td><b>${esc(c.title)}</b>${c.featured ? ' <span class="st admin">Featured</span>' : ''}<br><small class="meta">${esc(c.artist)}</small></td>
  <td>${dFmt(c.event_date)}<br><small class="meta">${tFmt(c.event_time)}</small></td><td>${esc(c.city)}</td><td>${inr(c.price)}</td><td>${c.sold} / ${c.capacity}</td><td>${st(c.status)}</td>
  <td class="row" style="flex-wrap:nowrap"><button class="btn sm" data-a="edit-concert" data-id="${c.id}">Edit</button><button class="btn sm d" data-a="del-concert" data-id="${c.id}">Delete</button></td></tr>`), 'No concerts found.');
}
function concertForm(c) {
  const v = k => esc(c?.[k] ?? '');
  const sec = code => c?.seat_sections?.find(x => x.code === ({ VIP: 'VIP', Gold: 'GOLD', Silver: 'SILVER' }[code])) || {};
  const count = code => sec(code).seat_count ?? (code === 'VIP' ? Math.floor((c?.capacity || 150) * .2) : code === 'Gold' ? Math.floor((c?.capacity || 150) * .3) : (c?.capacity || 150) - Math.floor((c?.capacity || 150) * .5));
  const price = code => sec(code).price ?? (c?.price ? Math.round(c.price * (code === 'VIP' ? 2 : code === 'Gold' ? 1.5 : 1)) : (code === 'VIP' ? 2000 : code === 'Gold' ? 1500 : 1000));
  openModal(`<h2>${c ? 'Edit concert' : 'Add concert'}</h2><form data-f="concert" data-id="${c?.id || ''}">
  <div class="f2"><div><label>Title</label><input name="title" required maxlength="180" value="${v('title')}"></div><div><label>Artist</label><input name="artist" required maxlength="180" value="${v('artist')}"></div>
  <div><label>Venue</label><input name="venue" required maxlength="180" value="${v('venue')}"></div><div><label>City</label><input name="city" required maxlength="100" value="${v('city')}"></div>
  <div><label>Genre</label><select name="genre">${cfg.genres.map(g => `<option ${g === c?.genre ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></div>
  <div><label>Total capacity (auto-calculated)</label><input id="seat-total" value="${c?.capacity || 150}" readonly></div>
  <div><label>Date</label><input type="date" name="event_date" required value="${c ? c.event_date.slice(0, 10) : ''}"></div><div><label>Start time (IST)</label><input type="time" name="event_time" required value="${v('event_time')}"></div>
  <div><label>Base ticket price (₹)</label><input type="number" name="price" required min="1" step="any" value="${v('price') || '1000'}"></div>
  <div><label>Image URL (optional)</label><input type="url" name="image_url" placeholder="https://" value="${v('image_url')}"></div></div>
  <h3 style="margin-top:16px">Seat sections</h3><p class="meta">Set the seat count and ticket price for each section. Seats are numbered automatically (A1, A2...).</p><div class="f2">${['VIP','Gold','Silver'].map(code => `<div class="box" style="padding:12px;margin:6px 0"><b>${code}</b><label>Seats</label><input type="number" name="${code.toLowerCase()}_seats" class="seat-count" min="1" max="5000" required value="${count(code)}"><label>Price (₹)</label><input type="number" name="${code.toLowerCase()}_price" min="1" required value="${price(code)}"></div>`).join('')}</div>
  <label>Description</label><textarea name="description" rows="3" maxlength="2000">${v('description')}</textarea>
  <div class="row" style="margin-top:12px;gap:22px"><label class="row" style="margin:0;color:var(--tx)"><input type="checkbox" name="featured" style="width:auto" ${c?.featured ? 'checked' : ''}> Show on home page as featured</label>
  ${c ? `<label class="row" style="margin:0;color:var(--tx)"><input type="checkbox" name="cancelled" style="width:auto" ${c.status === 'cancelled' ? 'checked' : ''}> Event cancelled (refunds all bookings)</label>` : ''}</div>
  <p class="sold" id="ferr"></p><br><div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-a="close">Close</button><button class="btn p">${c ? 'Save changes' : 'Add concert'}</button></div></form>`, true);
}

async function pgBookings() {
  cache.bookings = await api('/admin/bookings');
  shell('Bookings', 'Every ticket order, newest first.', `<div class="filters"><input id="bq" placeholder="Search reference, customer or concert"><select id="bs" style="max-width:180px"><option value="">All statuses</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option></select></div><div id="btable"></div>`,
    '<a class="btn" href="/api/admin/bookings/export.csv">Download CSV</a>');
  drawBookings();
}
function drawBookings() {
  const q = ($('#bq')?.value || '').toLowerCase(), s = $('#bs')?.value || '';
  const list = cache.bookings.filter(b => (!s || b.status === s) && `${b.reference} ${b.customer?.name} ${b.customer?.email} ${b.concert?.title}`.toLowerCase().includes(q));
  $('#btable').innerHTML = table(['Reference', 'Customer', 'Concert', 'Tickets', 'Total', 'Booked', 'Status', ''], list.map(b => `<tr><td><b>${esc(b.reference)}</b></td><td>${esc(b.customer?.name || '—')}<br><small class="meta">${esc(b.customer?.email || '')}</small></td>
  <td>${esc(b.concert?.title || 'Removed')}</td><td>${b.quantity}<br><small class="meta">${esc((b.seats || []).join(', '))}</small></td><td>${inr(b.total)}</td><td>${dFmt(b.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</td><td>${st(b.status)}</td>
  <td>${b.status === 'confirmed' ? `<button class="btn sm d" data-a="cancel-booking" data-id="${b.id}">Cancel</button>` : ''}</td></tr>`), 'No bookings match.');
}

async function pgUsers() {
  cache.users = await api('/admin/users');
  shell('Users', 'Manage customer and admin accounts.', `<div id="utable"></div>`);
  $('#utable').innerHTML = table(['Name', 'Role', 'Bookings', 'Spent', 'Joined', 'Status', ''], cache.users.map(u => `<tr><td><b>${esc(u.name)}</b><br><small class="meta">${esc(u.email)}</small></td>
  <td>${u.role === 'admin' ? '<span class="st admin">Admin</span>' : 'Customer'}</td><td>${u.bookings}</td><td>${inr(u.spent)}</td><td>${dFmt(u.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
  <td>${u.active ? st('active') : st('cancelled').replace('Cancelled', 'Disabled')}</td>
  <td class="row" style="flex-wrap:nowrap">${u.id === me.id ? '<span class="meta">You</span>' : `<button class="btn sm" data-a="role" data-id="${u.id}" data-r="${u.role === 'admin' ? 'user' : 'admin'}">${u.role === 'admin' ? 'Remove admin' : 'Make admin'}</button><button class="btn sm ${u.active ? 'd' : ''}" data-a="active" data-id="${u.id}" data-v="${!u.active}">${u.active ? 'Disable' : 'Enable'}</button>`}</td></tr>`), 'No users yet.');
}

async function route() {
  if (!me || me.role !== 'admin') return loginView();
  try { await ({ '': pgDash, concerts: pgConcerts, bookings: pgBookings, users: pgUsers }[page()] || pgDash)(); }
  catch (e) { shell('Something went wrong', esc(e.message), '<button class="btn" onclick="location.reload()">Reload</button>'); }
}
const reload = () => route();

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-a]'); if (!t) return;
  const a = t.dataset.a, id = t.dataset.id;
  try {
    if (a === 'logout') { await api('/auth/logout', { method: 'POST' }); me = null; route(); }
    else if (a === 'close') closeModal();
    else if (a === 'new-concert') concertForm();
    else if (a === 'edit-concert') concertForm(cache.concerts.find(c => c.id === id));
    else if (a === 'del-concert') { if (confirm('Delete this concert? This cannot be undone.')) { await api('/admin/concerts/' + id, { method: 'DELETE' }); toast('Concert deleted.'); reload(); } }
    else if (a === 'cancel-booking') { if (confirm('Cancel this booking and release its tickets?')) { await api(`/admin/bookings/${id}/cancel`, { method: 'POST' }); toast('Booking cancelled.'); reload(); } }
    else if (a === 'role') { await api('/admin/users/' + id, { method: 'PATCH', body: { role: t.dataset.r } }); toast('Role updated.'); reload(); }
    else if (a === 'active') { await api('/admin/users/' + id, { method: 'PATCH', body: { active: t.dataset.v === 'true' } }); toast('Account updated.'); reload(); }
  } catch (err) { toast(err.message, true); }
});
document.addEventListener('input', e => { if (e.target.id === 'cq') drawConcerts(); if (e.target.id === 'bq') drawBookings(); if (e.target.classList.contains('seat-count')) { const total = [...document.querySelectorAll('.seat-count')].reduce((n, x) => n + (Number(x.value) || 0), 0); const out = $('#seat-total'); if (out) out.value = total; } });
document.addEventListener('change', e => { if (e.target.id === 'bs') drawBookings(); });
document.addEventListener('submit', async e => {
  const f = e.target.dataset.f; if (!f) return; e.preventDefault();
  const fd = new FormData(e.target), d = Object.fromEntries(fd), err = $('#ferr');
  try {
    if (f === 'login') {
      const u = (await api('/auth/login', { method: 'POST', body: d })).user;
      if (u.role !== 'admin') { await api('/auth/logout', { method: 'POST' }); return loginView('This account does not have admin access.'); }
      me = u; route();
    } else if (f === 'concert') {
      d.featured = fd.has('featured'); d.status = fd.has('cancelled') ? 'cancelled' : 'active';
      d.capacity = ['vip','gold','silver'].reduce((n, key) => n + Number(d[key + '_seats']), 0);
      const id = e.target.dataset.id;
      await api(id ? '/admin/concerts/' + id : '/admin/concerts', { method: id ? 'PUT' : 'POST', body: d });
      closeModal(); toast(id ? 'Concert updated.' : 'Concert added.'); reload();
    }
  } catch (x) { err ? err.textContent = x.message : toast(x.message, true); }
});
window.addEventListener('hashchange', route);
(async () => {
  try { [cfg, me] = await Promise.all([api('/config'), api('/me').then(r => r.user)]); } catch (e) { toast(e.message, true); }
  route();
})();
