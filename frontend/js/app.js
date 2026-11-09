let cfg = { fee_rate: .05, max_tickets: 10, genres: [], payment_methods: [] }, me = null, bk = null;
const app = $('#app');
const F = { q: '', city: '', genre: '', sort: 'date', page: 1 };
const isFav = id => me?.favorites.includes(id);

function renderNav() {
  $('#auth').innerHTML = me
    ? `${me.role === 'admin' ? '<a class="btn sm" href="/admin/">Admin portal</a>' : ''}<a class="btn sm" href="#/profile">${esc(me.name.split(' ')[0])}</a><button class="btn sm" data-a="logout">Log out</button>`
    : `<button class="btn sm" data-a="auth" data-m="login">Log in</button><button class="btn sm p" data-a="auth" data-m="register">Sign up</button>`;
  const p = location.hash.split('/')[1] || '';
  document.querySelectorAll('#links a').forEach(a => a.classList.toggle('on', a.dataset.p === p));
}
const card = c => {
  const left = c.available_tickets, pct = c.capacity ? c.sold / c.capacity : 0;
  return `<article class="card" style="--h:${GH[c.genre] ?? 290}"><div class="art" style="${artStyle(c)}"><span class="tag">${esc(c.genre)}</span><b>${new Date(c.event_date).getUTCDate()}</b>
  <button class="fav ${isFav(c.id) ? 'on' : ''}" data-a="fav" data-id="${c.id}" aria-label="Save to favourites">${isFav(c.id) ? '♥' : '♡'}</button></div>
  <div class="cb"><h3><a href="#/concert/${c.id}">${esc(c.title)}</a></h3><div class="meta">${esc(c.artist)}</div>
  <div class="meta">${dFmt(c.event_date)} · ${tFmt(c.event_time)}</div><div class="meta">${esc(c.venue)}, ${esc(c.city)}</div>
  <div class="foot"><div class="price">${inr(c.price)} <small>onwards</small></div>${left === 0 ? '<span class="sold">Sold out</span>' : pct > .8 ? `<span class="low">Only ${left} left</span>` : `<a class="btn sm p" href="#/concert/${c.id}">Book</a>`}</div></div></article>`;
};
const empty = (h, p, a = '') => `<div class="empty"><h2>${h}</h2><p>${p}</p><br>${a}</div>`;

async function pgHome() {
  const [f, u] = await Promise.all([api('/concerts?featured=1&limit=3'), api('/concerts?limit=6')]);
  app.innerHTML = `<section class="hero"><div class="wrap"><h1>Feel the music live. Book your next night out.</h1>
  <p>Browse upcoming concerts in Hyderabad, Chennai, Mumbai, Bengaluru and more. Secure seats in under a minute.</p>
  <form class="search" data-f="hsearch"><input name="q" placeholder="Search artist, concert or city" aria-label="Search"><button class="btn p">Search</button></form>
  <div class="chips">${u.genres.map(g => `<a class="chip" href="#/concerts" data-a="genre" data-g="${esc(g)}">${esc(g)}</a>`).join('')}</div></div></section>
  <section class="sec"><div class="wrap"><h2>Featured shows</h2><p class="sub">Hand-picked nights you shouldn't miss.</p><div class="grid">${f.items.map(card).join('') || empty('No featured shows yet', 'Check back soon.')}</div></div></section>
  <section class="sec"><div class="wrap"><div class="hd"><div><h2>Coming up</h2><p class="sub">The next concerts on sale.</p></div><a class="btn" href="#/concerts">View all concerts</a></div><div class="grid">${u.items.map(card).join('')}</div></div></section>
  <section class="sec"><div class="wrap grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
  ${[['Instant tickets', 'Get a booking reference the moment you pay.'], ['Easy cancellation', 'Cancel free up to 48 hours before the show.'], ['Safe payments', 'UPI, cards, net banking and wallets.']].map(x => `<div class="box"><h3>${x[0]}</h3><p class="meta">${x[1]}</p></div>`).join('')}</div></section>`;
}
async function pgBrowse() {
  app.innerHTML = `<div class="wrap sec"><h2>All concerts</h2><p class="sub">Filter by city, genre or search by name.</p><div class="filters">
  <input id="fq" placeholder="Search artist, venue or city" value="${esc(F.q)}"><select id="fc"><option value="">All cities</option></select><select id="fg"><option value="">All genres</option></select>
  <select id="fs"><option value="date">Soonest first</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select></div><div id="res"></div></div>`;
  $('#fs').value = F.sort; await loadList(true);
}
async function loadList(first) {
  const p = new URLSearchParams({ q: F.q, city: F.city, genre: F.genre, sort: F.sort, page: F.page });
  const d = await api('/concerts?' + p);
  if (first) { $('#fc').innerHTML += d.cities.map(c => `<option ${c === F.city ? 'selected' : ''}>${esc(c)}</option>`).join(''); $('#fg').innerHTML += d.genres.map(c => `<option ${c === F.genre ? 'selected' : ''}>${esc(c)}</option>`).join(''); }
  $('#res').innerHTML = d.items.length ? `<div class="grid">${d.items.map(card).join('')}</div>${d.pages > 1 ? `<div class="pager"><button class="btn sm" data-a="page" data-n="${d.page - 1}" ${d.page < 2 ? 'disabled' : ''}>Previous</button><span class="meta">Page ${d.page} of ${d.pages}</span><button class="btn sm" data-a="page" data-n="${d.page + 1}" ${d.page >= d.pages ? 'disabled' : ''}>Next</button></div>` : ''}`
    : empty('No concerts match', 'Try a different city, genre or search term.', '<button class="btn" data-a="reset">Clear filters</button>');
}
async function pgConcert(id) {
  const c = await api('/concerts/' + id), pct = c.capacity ? Math.round(c.sold / c.capacity * 100) : 0;
  app.innerHTML = `<div class="wrap det" style="--h:${GH[c.genre] ?? 290}"><div><div class="art" style="${artStyle(c)}"><span class="tag">${esc(c.genre)}</span></div>
  <h1>${esc(c.title)}</h1><p class="meta" style="font-size:18px">${esc(c.artist)}</p><div class="facts"><div><small>Date</small>${dFmt(c.event_date)}</div><div><small>Doors open</small>${tFmt(c.event_time)} IST</div><div><small>Venue</small>${esc(c.venue)}</div><div><small>City</small>${esc(c.city)}</div></div>
  <h3>About this show</h3><p class="meta" style="margin-top:8px;font-size:16px">${esc(c.description) || 'More details coming soon.'}</p></div>
  <aside><div class="box" style="position:sticky;top:90px"><div class="price" style="font-size:30px">${inr(c.price)} <small>per ticket</small></div>
  <div class="bar"><i style="width:${pct}%"></i></div><p class="meta">${c.available_tickets ? `${c.available_tickets} of ${c.capacity} tickets left` : 'This show is sold out'}</p><br>
  <button class="btn p lg" style="width:100%" data-a="book" data-id="${c.id}" ${c.available_tickets && !c.is_past && c.status === 'active' ? '' : 'disabled'}>${c.status !== 'active' ? 'Event cancelled' : c.is_past ? 'Show has ended' : c.available_tickets ? 'Book tickets' : 'Sold out'}</button>
  <button class="btn" style="width:100%;margin-top:10px" data-a="fav" data-id="${c.id}">${isFav(c.id) ? '♥ Saved' : '♡ Save for later'}</button>
  <p class="meta" style="margin-top:14px;font-size:13px">Free cancellation until ${cfg.cancel_window_hours} hours before the show. A ${Math.round(cfg.fee_rate * 100)}% convenience fee applies.</p></div></aside></div>`;
  bk = { c };
}
async function pgBookings() {
  if (!me) return needLogin('See your tickets');
  const list = await api('/bookings');
  app.innerHTML = `<div class="wrap sec"><h2>My tickets</h2><p class="sub">Show your booking reference at the venue.</p>${list.length ? list.map(b => `<div class="bk"><div><h3>${esc(b.concert?.title || 'Concert removed')}</h3>
  <div class="meta">${b.concert ? `${dFmt(b.concert.event_date)} · ${tFmt(b.concert.event_time)} · ${esc(b.concert.venue)}, ${esc(b.concert.city)}` : ''}</div>
  <div class="meta">${b.quantity} ticket${b.quantity > 1 ? 's' : ''} · ${esc(b.section_code || 'General')} · Seats: ${esc((b.seats || []).join(', ') || 'Assigned at venue')} · ${inr(b.total)} · Ref <b>${esc(b.reference)}</b></div></div>
  <div class="row"><span class="st ${b.status}">${b.status === 'confirmed' ? 'Confirmed' : 'Cancelled'}</span>${b.status === 'confirmed' && b.concert && !b.concert.is_past ? `<button class="btn sm d" data-a="cancel" data-id="${b.id}">Cancel</button>` : ''}</div></div>`).join('')
    : empty('No tickets yet', 'Your bookings will appear here.', '<a class="btn p" href="#/concerts">Find a concert</a>')}</div>`;
}
async function pgFav() {
  if (!me) return needLogin('See your favourites');
  const list = await api('/favorites');
  app.innerHTML = `<div class="wrap sec"><h2>Favourites</h2><p class="sub">Shows you saved for later.</p>${list.length ? `<div class="grid">${list.map(card).join('')}</div>` : empty('Nothing saved yet', 'Tap the heart on any concert to save it.', '<a class="btn p" href="#/concerts">Browse concerts</a>')}</div>`;
}
function pgProfile() {
  if (!me) return needLogin('Manage your profile');
  app.innerHTML = `<div class="wrap sec" style="max-width:560px"><h2>Profile</h2><p class="sub">${esc(me.email)}</p>
  <form class="box" data-f="profile"><label>Full name</label><input name="name" value="${esc(me.name)}" required minlength="2"><br><br><button class="btn p">Save changes</button></form><br>
  <form class="box" data-f="password"><h3>Change password</h3><label>Current password</label><input type="password" name="current" required autocomplete="current-password"><label>New password (8+ characters)</label><input type="password" name="next" required minlength="8" autocomplete="new-password"><br><br><button class="btn">Update password</button></form></div>`;
}
const needLogin = t => { app.innerHTML = `<div class="wrap">${empty(t, 'Log in or create a free account to continue.', '<button class="btn p" data-a="auth" data-m="login">Log in</button>')}</div>`; };

function authModal(mode) {
  const reg = mode === 'register';
  openModal(`<h2>${reg ? 'Create your account' : 'Welcome back'}</h2><p class="meta">${reg ? 'Book tickets and manage them in one place.' : 'Log in to book tickets.'}</p>
  <form data-f="${mode}">${reg ? '<label>Full name</label><input name="name" required minlength="2" autocomplete="name">' : ''}<label>Email</label><input type="email" name="email" required autocomplete="email">
  <label>Password</label><input type="password" name="password" required minlength="${reg ? 8 : 1}" autocomplete="${reg ? 'new-password' : 'current-password'}"><p class="sold" id="ferr"></p><br>
  <button class="btn p" style="width:100%">${reg ? 'Create account' : 'Log in'}</button></form>
  <p class="meta" style="margin-top:14px;text-align:center">${reg ? 'Already have an account?' : 'New here?'} <a href="#" data-a="auth" data-m="${reg ? 'login' : 'register'}" style="color:var(--ac)">${reg ? 'Log in' : 'Sign up'}</a></p>`);
}
function seatRowLabel(n) { let out = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) out = String.fromCharCode(65 + (n - 1) % 26) + out; return out; }
function sectionSeats(section) {
  const seats = []; for (let i = 0; i < section.seat_count; i++) seats.push(`${section.code}-${seatRowLabel(Math.floor(i / 8))}${(i % 8) + 1}`); return seats;
}
function bookModal() {
  const { c, sectionCode, seats, pay } = bk;
  const section = c.seat_sections.find(x => x.code === sectionCode) || c.seat_sections[0];
  if (!section) return toast('Seat sections are not configured for this concert.', true);
  bk.sectionCode = section.code;
  const selected = new Set(seats), booked = new Set(c.booked_seats || []), all = sectionSeats(section);
  const sub = section.price * seats.length, fee = Math.round(sub * cfg.fee_rate * 100) / 100;
  openModal(`<h2>${esc(c.title)}</h2><p class="meta">Choose a section and select your exact seats.</p>
  <div class="seat-sections">${c.seat_sections.map(x => `<button type="button" class="seat-section ${x.code === section.code ? 'on' : ''}" data-a="section" data-code="${x.code}"><b>${esc(x.name)}</b><span>${inr(x.price)}</span><small>${x.seat_count} seats</small></button>`).join('')}</div>
  <div class="stage">STAGE</div><div class="seat-legend"><span><i class="available"></i> Available</span><span><i class="chosen"></i> Selected</span><span><i class="reserved"></i> Booked</span></div>
  <div class="seat-map">${all.map(id => `<button type="button" class="seat ${booked.has(id) ? 'reserved' : selected.has(id) ? 'chosen' : 'available'}" data-a="seat" data-seat="${id}" ${booked.has(id) ? 'disabled' : ''} aria-label="${id}">${id.split('-')[1]}</button>`).join('')}</div>
  <p class="meta">Selected: <b>${seats.length ? esc(seats.join(', ')) : 'None'}</b> · Maximum ${cfg.max_tickets} seats per booking</p>
  <label>Payment method</label><div class="pay">${cfg.payment_methods.map(p => `<label><input type="radio" name="pay" value="${p.id}" data-a="pay" ${p.id === pay ? 'checked' : ''}>${esc(p.label)}</label>`).join('')}</div>
  <div class="sum"><div><span>${seats.length} × ${inr(section.price)}</span><span>${inr(sub)}</span></div><div><span>Convenience fee</span><span>${inr(fee)}</span></div><div class="t"><span>Total</span><span>${inr(sub + fee)}</span></div></div><p class="sold" id="ferr"></p>
  <br><button class="btn p lg" style="width:100%" data-a="pay-now" ${seats.length ? '' : 'disabled'}>Confirm ${seats.length} seat${seats.length === 1 ? '' : 's'} · ${inr(sub + fee)}</button><p class="meta" style="font-size:12px;margin-top:10px;text-align:center">Demo checkout – no real payment is taken.</p>`, true);
}

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-a]'); if (!t) return;
  const a = t.dataset.a;
  if (['auth', 'genre'].includes(a) && t.tagName === 'A' && a === 'auth') e.preventDefault();
  try {
    if (a === 'auth') authModal(t.dataset.m);
    else if (a === 'logout') { await api('/auth/logout', { method: 'POST' }); me = null; renderNav(); location.hash = '#/'; route(); toast('You have been logged out.'); }
    else if (a === 'genre') { F.genre = t.dataset.g; F.page = 1; }
    else if (a === 'fav') {
      e.preventDefault(); if (!me) return authModal('login');
      const r = await api('/favorites/' + t.dataset.id, { method: 'POST' });
      me.favorites = r.favorited ? [...me.favorites, t.dataset.id] : me.favorites.filter(x => x !== t.dataset.id);
      toast(r.favorited ? 'Saved to favourites.' : 'Removed from favourites.'); route(true);
    }
    else if (a === 'page') { F.page = +t.dataset.n; await loadList(); scrollTo(0, 0); }
    else if (a === 'reset') { Object.assign(F, { q: '', city: '', genre: '', page: 1 }); route(); }
    else if (a === 'book') { if (!me) return authModal('login'); bk = { c: bk.c, sectionCode: bk.c.seat_sections?.[0]?.code, seats: [], pay: 'upi' }; bookModal(); }
    else if (a === 'section') { bk.sectionCode = t.dataset.code; bk.seats = []; bookModal(); }
    else if (a === 'seat') { const id = t.dataset.seat, at = bk.seats.indexOf(id); if (at >= 0) bk.seats.splice(at, 1); else if (bk.seats.length < cfg.max_tickets) bk.seats.push(id); else return toast(`You can select up to ${cfg.max_tickets} seats.`, true); bookModal(); }
    else if (a === 'pay') bk.pay = t.value;
    else if (a === 'pay-now') {
      t.disabled = true;
      try {
        const r = await api('/bookings', { method: 'POST', body: { concertId: bk.c.id, sectionCode: bk.sectionCode, seats: bk.seats, paymentMethod: bk.pay } });
        openModal(`<div class="ok"><div class="tick">✓</div><h2>Booking confirmed</h2><p class="meta">${bk.seats.length} seat${bk.seats.length > 1 ? 's' : ''} for ${esc(bk.c.title)}</p><div class="ref">${esc(r.reference)}</div><p class="meta">${esc((r.seats || []).join(', '))}</p><p class="meta">Total ${inr(r.total)}</p><br>
        <a class="btn p" href="#/bookings" data-a="close">View my tickets</a></div>`);
      } catch (err) { t.disabled = false; $('#ferr').textContent = err.message; }
    }
    else if (a === 'close') closeModal();
    else if (a === 'cancel') {
      if (!confirm('Cancel this booking? Your tickets will be released.')) return;
      await api(`/bookings/${t.dataset.id}/cancel`, { method: 'POST' }); toast('Booking cancelled.'); route(true);
    }
  } catch (err) { toast(err.message, true); }
});
document.addEventListener('change', e => {
  const m = { fc: 'city', fg: 'genre', fs: 'sort' }[e.target.id]; if (m) { F[m] = e.target.value; F.page = 1; loadList(); }
});
let tm; document.addEventListener('input', e => { if (e.target.id === 'fq') { clearTimeout(tm); tm = setTimeout(() => { F.q = e.target.value; F.page = 1; loadList(); }, 300); } });
document.addEventListener('submit', async e => {
  const f = e.target.dataset.f; if (!f) return; e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target)), err = $('#ferr');
  try {
    if (f === 'hsearch') { F.q = d.q; F.page = 1; location.hash = '#/concerts'; }
    else if (f === 'login' || f === 'register') {
      me = (await api('/auth/' + f, { method: 'POST', body: d })).user; closeModal(); renderNav(); toast(`Welcome, ${me.name.split(' ')[0]}!`); route(true);
    }
    else if (f === 'profile') { me = (await api('/me', { method: 'PUT', body: d })).user; renderNav(); toast('Profile updated.'); }
    else if (f === 'password') { await api('/me/password', { method: 'PUT', body: d }); e.target.reset(); toast('Password changed.'); }
  } catch (x) { err ? err.textContent = x.message : toast(x.message, true); }
});
async function route() {
  const [, p, id] = (location.hash.slice(1) || '/').split('/');
  try {
    if (p === 'concerts') await pgBrowse(); else if (p === 'concert') await pgConcert(id); else if (p === 'bookings') await pgBookings();
    else if (p === 'favorites') await pgFav(); else if (p === 'profile') pgProfile(); else await pgHome();
  } catch (e) { app.innerHTML = `<div class="wrap">${empty('Something went wrong', esc(e.message), '<a class="btn" href="#/">Back to home</a>')}</div>`; }
  renderNav();
}
window.addEventListener('hashchange', () => { route(); scrollTo(0, 0); });
(async () => {
  try { [cfg, me] = await Promise.all([api('/config'), api('/me').then(r => r.user)]); } catch (e) { toast(e.message, true); }
  route();
})();
