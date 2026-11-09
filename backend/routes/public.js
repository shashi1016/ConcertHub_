const router = require('express').Router();
const { User, Concert, Booking, GENRES } = require('../models');
const U = require('../utils');
const { wrap, validId, str, todayUtc, concertOut, bookingOut, httpError } = U;
const PAGE = 9;
const upcoming = () => ({ status: 'active', eventDate: { $gte: todayUtc() } });

router.get('/config', (req, res) => res.json({ fee_rate: U.FEE_RATE, max_tickets: U.MAX_TICKETS, cancel_window_hours: U.CANCEL_WINDOW_HOURS,
  genres: GENRES, payment_methods: U.PAYMENT_METHODS }));

router.get('/concerts', wrap(async (req, res) => {
  const q = str(req.query.q, 80), city = str(req.query.city, 100), genre = str(req.query.genre, 40);
  const filter = upcoming();
  if (city) filter.city = city;
  if (GENRES.includes(genre)) filter.genre = genre;
  if (req.query.featured === '1') filter.featured = true;
  if (q) { const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); filter.$or = [{ title: rx }, { artist: rx }, { venue: rx }, { city: rx }]; }
  const sort = { price_asc: { price: 1 }, price_desc: { price: -1 } }[req.query.sort] || { eventDate: 1, eventTime: 1 };
  const size = Math.min(24, Math.max(1, parseInt(req.query.limit) || PAGE));
  const total = await Concert.countDocuments(filter), pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(pages, Math.max(1, parseInt(req.query.page) || 1));
  const [items, cities, genres] = await Promise.all([
    Concert.find(filter).sort(sort).skip((page - 1) * size).limit(size),
    Concert.distinct('city', upcoming()), Concert.distinct('genre', upcoming())]);
  res.json({ items: items.map(concertOut), total, page, pages, cities: cities.sort(), genres: GENRES.filter(g => genres.includes(g)) });
}));

router.get('/concerts/:id', wrap(async (req, res) => {
  const c = validId(req.params.id) && await Concert.findById(req.params.id);
  if (!c) return res.status(404).json({ error: 'Concert not found.' });
  res.json(concertOut(c));
}));

router.get('/favorites', U.requireUser, wrap(async (req, res) => {
  const list = await Concert.find({ _id: { $in: req.user.favorites || [] }, status: 'active' }).sort({ eventDate: 1 });
  res.json(list.map(concertOut));
}));
router.post('/favorites/:id', U.requireUser, wrap(async (req, res) => {
  if (!validId(req.params.id) || !(await Concert.exists({ _id: req.params.id }))) return res.status(404).json({ error: 'Concert not found.' });
  const has = (req.user.favorites || []).some(f => String(f) === req.params.id);
  await User.updateOne({ _id: req.user._id }, has ? { $pull: { favorites: req.params.id } } : { $addToSet: { favorites: req.params.id } });
  res.json({ favorited: !has });
}));

router.get('/bookings', U.requireUser, wrap(async (req, res) =>
  res.json((await Booking.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(200).populate('concertId')).map(bookingOut))));

router.post('/bookings', U.requireUser, wrap(async (req, res) => {
  const { concertId, paymentMethod, sectionCode } = req.body || {};
  const seats = Array.isArray(req.body?.seats) ? [...new Set(req.body.seats.map(x => str(x, 20)))] : [];
  const qty = seats.length;
  if (!validId(concertId)) return res.status(400).json({ error: 'Invalid concert.' });
  if (!Number.isInteger(qty) || qty < 1 || qty > U.MAX_TICKETS) return res.status(400).json({ error: `Select 1 to ${U.MAX_TICKETS} seats.` });
  if (!U.PAYMENT_METHODS.some(p => p.id === paymentMethod)) return res.status(400).json({ error: 'Choose a payment method.' });
  const current = await Concert.findById(concertId);
  if (!current) throw httpError(404, 'Concert not found.');
  const section = (current.seatSections || []).find(x => x.code === sectionCode);
  if (!section) throw httpError(400, 'Choose a valid seating section.');
  const rowLabel = n => { let out = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) out = String.fromCharCode(65 + (n - 1) % 26) + out; return out; };
  const validSeats = new Set();
  for (let i = 0; i < section.seatCount; i++) validSeats.add(`${section.code}-${rowLabel(Math.floor(i / 8))}${(i % 8) + 1}`);
  if (seats.some(id => !validSeats.has(id))) throw httpError(400, 'One or more selected seats are invalid.');
  const c = await Concert.findOneAndUpdate({ _id: concertId, status: 'active', eventDate: { $gte: todayUtc() }, availableTickets: { $gte: qty }, bookedSeats: { $nin: seats } },
    { $inc: { availableTickets: -qty }, $addToSet: { bookedSeats: { $each: seats } } }, { new: true });
  if (!c) {
    const ex = await Concert.findById(concertId);
    if (!ex) throw httpError(404, 'Concert not found.');
    if (ex.status !== 'active') throw httpError(409, 'This event has been cancelled.');
    if (seats.some(id => (ex.bookedSeats || []).includes(id))) throw httpError(409, 'One of your selected seats was just booked. Please choose different seats.');
    throw httpError(409, 'These seats are no longer available. Please refresh and try again.');
  }
  const restore = () => Concert.updateOne({ _id: c._id }, { $inc: { availableTickets: qty }, $pullAll: { bookedSeats: seats } });
  if (U.eventStart(c) < new Date()) { await restore(); throw httpError(409, 'This show has already started.'); }
  const subtotal = U.round2(section.price * qty), fee = U.round2(subtotal * U.FEE_RATE);
  try {
    const b = await Booking.create({ userId: req.user._id, concertId: c._id, quantity: qty, sectionCode, seats, subtotal, fee, total: U.round2(subtotal + fee),
      paymentMethod, reference: U.newReference() });
    res.status(201).json(bookingOut(await b.populate('concertId')));
  } catch (e) { await restore(); throw e; }
}));

router.post('/bookings/:id/cancel', U.requireUser, wrap(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid booking ID.' });
  await U.cancelBooking(req.params.id, { by: 'customer', enforceWindow: true, userId: req.user._id });
  res.json({ ok: true });
}));
module.exports = router;
