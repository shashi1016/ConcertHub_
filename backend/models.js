const mongoose = require('mongoose');
const { Schema } = mongoose;

const GENRES = ['Pop', 'Rock', 'Electronic', 'Hip-Hop', 'Classical', 'Jazz', 'Indie', 'Folk'];

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  active: { type: Boolean, default: true },
  favorites: [{ type: Schema.Types.ObjectId, ref: 'Concert' }]
}, { timestamps: true });

const concertSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  artist: { type: String, required: true, trim: true, maxlength: 180 },
  venue: { type: String, required: true, trim: true, maxlength: 180 },
  city: { type: String, required: true, trim: true, maxlength: 100, index: true },
  genre: { type: String, enum: GENRES, default: 'Pop' },
  eventDate: { type: Date, required: true, index: true },
  eventTime: { type: String, required: true },
  price: { type: Number, required: true, min: 1 },
  capacity: { type: Number, required: true, min: 1 },
  availableTickets: { type: Number, required: true, min: 0, default: 0 },
  seatSections: [{ code: { type: String, required: true }, name: { type: String, required: true }, price: { type: Number, required: true, min: 1 }, seatCount: { type: Number, required: true, min: 1 } }],
  bookedSeats: { type: [String], default: [] },
  description: { type: String, default: '', maxlength: 2000 },
  imageUrl: { type: String, default: '' },
  featured: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'cancelled'], default: 'active' }
}, { timestamps: true });

const bookingSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  concertId: { type: Schema.Types.ObjectId, ref: 'Concert', required: true, index: true },
  quantity: { type: Number, required: true, min: 1, max: 10 },
  sectionCode: { type: String, default: '' },
  seats: { type: [String], default: [] },
  subtotal: { type: Number, required: true, min: 0 },
  fee: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, default: 'upi' },
  reference: { type: String, required: true, unique: true },
  status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
  cancelledAt: Date,
  cancelledBy: String
}, { timestamps: true });

module.exports = {
  GENRES,
  User: mongoose.model('User', userSchema),
  Concert: mongoose.model('Concert', concertSchema),
  Booking: mongoose.model('Booking', bookingSchema)
};
