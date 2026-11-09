const router = require('express').Router();
const { User, Concert, Booking, GENRES } = require('../models');
const U = require('../utils');
const { wrap, validId, str, todayUtc, concertOut, bookingOut } = U;
router.use(U.requireUser, U.requireAdmin);

router.get('/stats', wrap(async (req, res) => {
  const today = todayUtc(), since = new Date(Date.now() - 14 * 864e5);
  const [users, activeConcerts, upcoming, totals, cancelled, daily, top, recent, low] = await Promise.all([
    User.countDocuments(),
    Concert.countDocuments({ status: 'active' }),
    Concert.countDocuments({ status: 'active', eventDate: { $gte: today } }),
    Booking.aggregate([{ $match: { status: 'confirmed' } }, { $group: { _id: null, revenue: { $sum: '$total' }, tickets: { $sum: '$quantity' }, bookings: { $sum: 1 } } }]),
    Booking.countDocuments({ status: 'cancelled' }),
    Booking.aggregate([
      { $match: { status: 'confirmed', createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, revenue: { $sum: '$total' }, bookings: { $sum: 1 } } }
    ]),
    Booking.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: '$concertId', revenue: { $sum: '$total' }, tickets: { $sum: '$quantity' } } },
      { $sort: { revenue: -1 } }, { $limit: 5 },
      { $lookup: { from: 'concerts', localField: '_id', foreignField: '_id', as: 'c' } }, { $unwind: '$c' },
      { $project: { title: '$c.title', artist: '$c.artist', revenue: 1, tickets: 1 } }
    ]),
    Booking.find().sort({ createdAt: -1 }).limit(6).populate('userId', 'name email').populate('concertId'),
    Concert.find({ status: 'active', eventDate: { $gte: today }, $expr: { $lte: [{ $divide: ['$availableTickets', { $max: ['$capacity', 1] }] }, 0.15] } }).sort({ availableTickets: 1 }).limit(5)
  ]);
  const byDay = new Map(daily.map(d => [d._id, d])), series = [];
  for (let i = 13; i >= 0; i--) {
    const key = new Date(Date.now() - i * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    series.push({ date: key, revenue: byDay.get(key)?.revenue || 0, bookings: byDay.get(key)?.bookings || 0 });
  }
  const t = totals[0] || { revenue: 0, tickets: 0, bookings: 0 };
  res.json({
    kpis: { revenue: t.revenue, tickets: t.tickets, bookings: t.bookings, cancelled, users, active_concerts: activeConcerts, upcoming_concerts: upcoming },
    series, top: top.map(x => ({ id: String(x._id), title: x.title, artist: x.artist, revenue: x.revenue, tickets: x.tickets })),
    recent: recent.map(bookingOut), low_stock: low.map(concertOut)
  });
}));

function parseConcert(b = {}) {
  const d = { title: str(b.title, 180), artist: str(b.artist, 180), venue: str(b.venue, 180), city: str(b.city, 100), genre: str(b.genre, 40),
    date: str(b.event_date, 10), time: str(b.event_time, 5), price: Number(b.price), capacity: Number(b.capacity),
    description: str(b.description, 2000), image: str(b.image_url, 500), featured: b.featured === true || b.featured === 'true',
    sections: [{ code: 'VIP', name: 'VIP', key: 'vip' }, { code: 'GOLD', name: 'Gold', key: 'gold' }, { code: 'SILVER', name: 'Silver', key: 'silver' }].map(x => ({ code: x.code, name: x.name, seatCount: Number(b[x.key + '_seats']), price: Number(b[x.key + '_price']) })) };
  if (!d.title || !d.artist || !d.venue || !d.city) return { error: 'Title, artist, venue and city are required.' };
  if (!GENRES.includes(d.genre)) return { error: 'Choose a valid genre.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || Number.isNaN(new Date(`${d.date}T00:00:00Z`).getTime())) return { error: 'Enter a valid date.' };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.time)) return { error: 'Enter a valid time.' };
  if (!Number.isFinite(d.price) || d.price <= 0 || d.price > 1e6) return { error: 'Enter a valid ticket price.' };
  if (!Number.isSafeInteger(d.capacity) || d.capacity < 1 || d.capacity > 1e6) return { error: 'Capacity must be a whole number of 1 or more.' };
  if (d.sections.some(x => !Number.isSafeInteger(x.seatCount) || x.seatCount < 1 || !Number.isFinite(x.price) || x.price < 1)) return { error: 'Enter valid seat counts and prices for VIP, Gold and Silver.' };
  if (d.sections.reduce((n, x) => n + x.seatCount, 0) !== d.capacity) return { error: 'Total capacity must equal VIP + Gold + Silver seats.' };
  if (d.image && !/^https?:\/\/[^\s"'()<>\\]+$/i.test(d.image)) return { error: 'Image URL must be a plain http(s) link.' };
  return { d };
}
router.get('/concerts', wrap(async (req, res) => res.json((await Concert.find().sort({ eventDate: -1 }).limit(500)).map(concertOut))));
router.post('/concerts', wrap(async (req, res) => {
  const { d, error } = parseConcert(req.body);
  if (error) return res.status(400).json({ error });
  const c = await Concert.create({ title: d.title, artist: d.artist, venue: d.venue, city: d.city, genre: d.genre,
    eventDate: new Date(`${d.date}T00:00:00Z`), eventTime: d.time, price: d.price, capacity: d.capacity, availableTickets: d.capacity, seatSections: d.sections, bookedSeats: [],
    description: d.description, imageUrl: d.image, featured: d.featured });
  res.status(201).json(concertOut(c));
}));
router.put('/concerts/:id', wrap(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid concert ID.' });
  const { d, error } = parseConcert(req.body);
  if (error) return res.status(400).json({ error });
  const c = await Concert.findById(req.params.id);
  if (!c) return res.status(404).json({ error: 'Concert not found.' });
  const sold = Math.max(0, (c.capacity ?? c.availableTickets) - c.availableTickets);
  if (d.capacity < sold) return res.status(400).json({ error: `${sold} tickets are already sold – capacity cannot be lower.` });
  if ((c.bookedSeats || []).some(id => { const sec = d.sections.find(x => id.startsWith(x.code + '-')); if (!sec) return true; const m = id.slice(sec.code.length + 1).match(/^(.*?)(\d+)$/); if (!m) return true; const row = m[1], col = Number(m[2]); const rowNo = [...row].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1; return rowNo * 8 + col > sec.seatCount; })) return res.status(400).json({ error: 'Do not reduce or rename a section that contains already-booked seats.' });
  const wasCancelled = c.status === 'cancelled', status = req.body?.status === 'cancelled' ? 'cancelled' : 'active';
  Object.assign(c, { title: d.title, artist: d.artist, venue: d.venue, city: d.city, genre: d.genre,
    eventDate: new Date(`${d.date}T00:00:00Z`), eventTime: d.time, price: d.price, capacity: d.capacity,
    availableTickets: d.capacity - sold, seatSections: d.sections, description: d.description, imageUrl: d.image, featured: d.featured, status });
  await c.save();
  if (status === 'cancelled' && !wasCancelled)
    await Booking.updateMany({ concertId: c._id, status: 'confirmed' }, { $set: { status: 'cancelled', cancelledAt: new Date(), cancelledBy: 'event cancelled' } });
  res.json(concertOut(c));
}));
router.delete('/concerts/:id', wrap(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid concert ID.' });
  if (await Booking.exists({ concertId: req.params.id })) return res.status(409).json({ error: 'This concert has bookings. Cancel the event instead of deleting it.' });
  await Concert.deleteOne({ _id: req.params.id });
  await User.updateMany({}, { $pull: { favorites: req.params.id } });
  res.json({ ok: true });
}));

router.get('/bookings', wrap(async (req, res) =>
  res.json((await Booking.find().sort({ createdAt: -1 }).limit(1000).populate('userId', 'name email').populate('concertId')).map(bookingOut))));
const csvCell = v => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
router.get('/bookings/export.csv', wrap(async (req, res) => {
  const list = (await Booking.find().sort({ createdAt: -1 }).populate('userId', 'name email').populate('concertId')).map(bookingOut);
  const head = ['Reference', 'Customer', 'Email', 'Concert', 'Event date', 'Tickets', 'Subtotal', 'Fee', 'Total', 'Payment', 'Status', 'Booked at'];
  const rows = list.map(b => [b.reference, b.customer?.name, b.customer?.email, b.concert?.title, b.concert?.event_date?.slice(0, 10), b.quantity, b.subtotal, b.fee, b.total, b.payment_method, b.status, new Date(b.created_at).toISOString()]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="concerthub-bookings.csv"');
  res.send('\ufeff' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n'));
}));
router.post('/bookings/:id/cancel', wrap(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid booking ID.' });
  await U.cancelBooking(req.params.id, { by: 'admin', enforceWindow: false });
  res.json({ ok: true });
}));

router.get('/users', wrap(async (req, res) => {
  const [users, stats] = await Promise.all([User.find().sort({ createdAt: -1 }).limit(1000),
    Booking.aggregate([{ $match: { status: 'confirmed' } }, { $group: { _id: '$userId', bookings: { $sum: 1 }, spent: { $sum: '$total' } } }])]);
  const m = new Map(stats.map(s => [String(s._id), s]));
  res.json(users.map(u => ({ ...U.userOut(u), bookings: m.get(String(u._id))?.bookings || 0, spent: m.get(String(u._id))?.spent || 0 })));
}));
router.patch('/users/:id', wrap(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid user ID.' });
  if (req.params.id === String(req.user._id)) return res.status(400).json({ error: 'You cannot change your own role or status.' });
  const update = {};
  if (['user', 'admin'].includes(req.body?.role)) update.role = req.body.role;
  if (typeof req.body?.active === 'boolean') update.active = req.body.active;
  if (!Object.keys(update).length) return res.status(400).json({ error: 'Nothing to update.' });
  const user = await User.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json(U.userOut(user));
}));
module.exports = router;
