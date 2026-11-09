const bcrypt = require('bcryptjs');
const { User, Concert } = require('./models');
const { todayUtc } = require('./utils');
async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase(), password = process.env.ADMIN_PASSWORD || '';
  if (!email || password.length < 8) return;
  const existing = await User.findOne({ email });
  if (!existing) {
    await User.create({ name: process.env.ADMIN_NAME || 'ConcertHub Admin', email, passwordHash: await bcrypt.hash(password, 12), role: 'admin' });
    console.log(`Admin account created: ${email}`);
  } else if (existing.role !== 'admin') { existing.role = 'admin'; await existing.save(); console.log(`Existing account promoted to admin: ${email}`); }
}
async function migrateOldData() {
  await Concert.updateMany({ capacity: { $exists: false } }, [{ $set: { capacity: '$availableTickets' } }]);
  await Concert.updateMany({ genre: { $exists: false } }, { $set: { genre: 'Pop' } });
  const legacy = await Concert.find({ $or: [{ seatSections: { $exists: false } }, { seatSections: { $size: 0 } }] });
  for (const c of legacy) {
    const total = Math.max(3, c.capacity || c.availableTickets || 3);
    const vip = Math.max(1, Math.floor(total * .2)), gold = Math.max(1, Math.floor(total * .3)), silver = Math.max(1, total - vip - gold);
    c.seatSections = [
      { code: 'VIP', name: 'VIP', price: Math.round(c.price * 2), seatCount: vip },
      { code: 'GOLD', name: 'Gold', price: Math.round(c.price * 1.5), seatCount: gold },
      { code: 'SILVER', name: 'Silver', price: c.price, seatCount: total - vip - gold + (total - vip - gold < 1 ? 1 : 0) }
    ];
    // Preserve the existing ticket inventory and align capacity with the migrated seating plan.
    c.capacity = c.seatSections.reduce((n, x) => n + x.seatCount, 0);
    c.availableTickets = Math.min(c.availableTickets, c.capacity);
    await c.save();
  }
}
async function seedConcerts() {
  if (await Concert.countDocuments() > 0) return;
  const day = n => { const d = todayUtc(); d.setUTCDate(d.getUTCDate() + n); return d; };
  const c = (title, artist, venue, city, genre, n, eventTime, price, capacity, left, description, featured = false) =>
    ({ title, artist, venue, city, genre, eventDate: day(n), eventTime, price, capacity, availableTickets: left, description, featured, seatSections: [{ code: 'VIP', name: 'VIP', price: price * 2, seatCount: Math.floor(capacity * .2) }, { code: 'GOLD', name: 'Gold', price: Math.round(price * 1.5), seatCount: Math.floor(capacity * .3) }, { code: 'SILVER', name: 'Silver', price, seatCount: capacity - Math.floor(capacity * .2) - Math.floor(capacity * .3) }], bookedSeats: [] });
  await Concert.insertMany([
    c('Neon Nights Live', 'The Midnight Echoes', 'Gachibowli Stadium', 'Hyderabad', 'Pop', 20, '19:00', 1499, 250, 212, 'An electric night of synth-pop, live visuals and unforgettable music under the lights.', true),
    c('Purple Sound Festival', 'DJ Nova & Friends', 'HITEX Exhibition Centre', 'Hyderabad', 'Electronic', 35, '18:30', 999, 500, 431, 'A high-energy festival with electronic music, immersive lights and multiple live sets.', true),
    c('Acoustic Under The Stars', 'Mira & The Waves', 'Shilpakala Vedika', 'Hyderabad', 'Folk', 48, '19:30', 799, 180, 96, 'An intimate evening of acoustic favourites and original songs in an open-air setting.', true),
    c('Marina Beats', 'Coastal Static', 'YMCA Nandanam Grounds', 'Chennai', 'Indie', 27, '18:00', 1299, 300, 41, 'Sun-down indie sets by the sea breeze with food stalls, art and a late-night finale.'),
    c('Carnatic Fusion Evenings', 'Raagam Collective', 'Music Academy', 'Chennai', 'Classical', 14, '19:00', 899, 220, 164, 'Classical ragas reimagined with jazz, strings and percussion in a beautiful hall.'),
    c('Thunder Road Tour', 'Iron Monsoon', 'NSCI Dome', 'Mumbai', 'Rock', 62, '20:00', 1799, 400, 388, 'Stadium-sized riffs, pyro and the loudest sing-along of the season.'),
    c('Late Night Jazz Social', 'The Blue Hour Quartet', 'Lawn Stage, The Park', 'Bengaluru', 'Jazz', 11, '21:00', 1099, 120, 17, 'Smooth, smoky and improvised – a small-room jazz night with a cocktail bar.'),
    c('Bass & Bars', 'Kaizen Kings', 'Palace Grounds', 'Bengaluru', 'Hip-Hop', 41, '19:30', 1599, 350, 297, 'The best of the underground hip-hop scene on one stage, with live DJs and cyphers.')
  ]);
  console.log('Added sample concerts.');
}
module.exports = async () => { await migrateOldData(); await seedAdmin(); await seedConcerts(); };
