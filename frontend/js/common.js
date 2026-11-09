const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const dFmt = (iso, o) => new Date(iso).toLocaleDateString('en-IN', o || { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const tFmt = t => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
async function api(path, o = {}) {
  const r = await fetch('/api' + path, { method: o.method || 'GET', credentials: 'same-origin',
    headers: o.body ? { 'Content-Type': 'application/json' } : {}, body: o.body ? JSON.stringify(o.body) : undefined });
  let d = {}; try { d = await r.json(); } catch {}
  if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.');
  return d;
}
function toast(msg, err) {
  let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.append(box); }
  const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; box.append(t);
  setTimeout(() => t.remove(), 3800);
}
function openModal(html, wide) {
  closeModal();
  const o = document.createElement('div'); o.className = 'ov'; o.id = 'modal';
  o.innerHTML = `<div class="md${wide ? ' w' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  o.addEventListener('mousedown', e => { if (e.target === o) closeModal(); });
  document.body.append(o); const f = $('input,select', o); if (f) f.focus();
}
const closeModal = () => $('#modal')?.remove();
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
const GH = { Pop: 330, Rock: 5, Electronic: 265, 'Hip-Hop': 30, Classical: 48, Jazz: 205, Indie: 160, Folk: 110 };
const artStyle = c => `--h:${GH[c.genre] ?? 290}${c.image_url ? `;background-image:url('${esc(c.image_url)}')` : ''}`;
