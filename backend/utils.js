const crypto = require('crypto');
const mongoose = require('mongoose');
const { Booking, Concert } = require('./models');

const FEE_RATE = 0.05, MAX_TICKETS = 10, CANCEL_WINDOW_HOURS = 48, IST_MS = 5.5 * 3600e3;
const PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI' }, { id: 'card', label: 'Credit / debit card' },
  { id: 'netbanking', label: 'Net banking' }, { id: 'wallet', label: 'Wallet' }
];

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const httpError = (status, message) => Object.assign(new Error(message), { status });
const validId = id => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id) && mongoose.isValidObjectId(id);
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const round2 = n => Math.round(n * 100) / 100;

// "Today" in India (concert dates are stored as UTC midnight of the calendar date).
const todayUtc = () => { const d = new Date(Date.now() + IST_MS); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };
// Show start as a real instant; event times are entered in IST.
const eventStart = c => { const [h, m] = String(c.eventTime || '00:00').split(':').map(Number); return new Date(c.eventDate.getTime() + (h * 60 + m) * 60e3 - IST_MS); };

const requireUser = (req, res, next) => req.user ? next() : res.status(401).json({ error: 'Please log in first.' });
const requireAdmin = (req, res, next) => req.user?.role === 'admin' ? next() : res.status(403).json({ error: 'Admin access only.' });

const userOut = u => ({ id: String(u._id), name: u.name, email: u.email, role: u.role, active: u.active !== false,
  favorites: (u.favorites || []).map(String), created_at: u.createdAt });

const concertOut = c => {
  const capacity = c.capacity ?? c.availableTickets, left = c.availableTickets;
  return { id: String(c._id), title: c.title, artist: c.artist, venue: c.venue, city: c.city, genre: c.genre || 'Pop',
    event_date: c.eventDate.toISOString(), event_time: c.eventTime, price: c.price, capacity, available_tickets: left,
    sold: Math.max(0, capacity - left), description: c.description || '', image_url: c.imageUrl || '', featured: !!c.featured,
    seat_sections: (c.seatSections || []).map(x => ({ code: x.code, name: x.name, price: x.price, seat_count: x.seatCount })),
    booked_seats: c.bookedSeats || [],
    status: c.status, is_past: eventStart(c) < new Date() };
};

const bookingOut = b => {
  const u = b.userId && b.userId.email ? b.userId : null, c = b.concertId && b.concertId.title ? b.concertId : null;
  return { id: String(b._id), reference: b.reference, quantity: b.quantity, section_code: b.sectionCode || '', seats: b.seats || [], subtotal: b.subtotal, fee: b.fee, total: b.total,
    payment_method: b.paymentMethod, status: b.status, created_at: b.createdAt, cancelled_by: b.cancelledBy || null,
    customer: u ? { id: String(u._id), name: u.name, email: u.email } : null, concert: c ? concertOut(c) : null };
};

const newReference = () => 'CH-' + crypto.randomBytes(5).toString('hex').toUpperCase();

// Cancels a booking and returns its tickets to stock. Customers are limited to the cancellation window; admins are not.
async function cancelBooking(id, { by, enforceWindow, userId } = {}) {
  const b = await Booking.findById(id).populate('concertId');
  if (!b || (userId && String(b.userId) !== String(userId))) throw httpError(404, 'Booking not found.');
  if (b.status !== 'confirmed') throw httpError(409, 'This booking is already cancelled.');
  if (enforceWindow && b.concertId && (eventStart(b.concertId) - Date.now()) / 36e5 < CANCEL_WINDOW_HOURS)
    throw httpError(400, `Bookings can only be cancelled up to ${CANCEL_WINDOW_HOURS} hours before the show.`);
  const done = await Booking.findOneAndUpdate({ _id: b._id, status: 'confirmed' }, { $set: { status: 'cancelled', cancelledAt: new Date(), cancelledBy: by || 'customer' } });
  if (!done) throw httpError(409, 'This booking is already cancelled.');
  if (b.concertId && b.concertId.status === 'active') await Concert.updateOne({ _id: b.concertId._id }, { $inc: { availableTickets: b.quantity }, ...(b.seats?.length ? { $pullAll: { bookedSeats: b.seats } } : {}) });
}

module.exports = { FEE_RATE, MAX_TICKETS, CANCEL_WINDOW_HOURS, PAYMENT_METHODS, wrap, httpError, validId, str, round2, todayUtc, eventStart,
  requireUser, requireAdmin, userOut, concertOut, bookingOut, newReference, cancelBooking };
