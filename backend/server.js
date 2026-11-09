require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { User } = require('./models');
const { wrap } = require('./utils');
const isProd = process.env.NODE_ENV === 'production';
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/concerthub';

function buildApp() {
  const app = express();
  app.disable('x-powered-by');
  if (isProd) app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'self'"], upgradeInsecureRequests: null } } }));
  app.use(express.json({ limit: '32kb' }));
  app.use(session({
    name: 'ch.sid', secret: process.env.SESSION_SECRET || 'development-only-change-this-secret',
    resave: false, saveUninitialized: false,
    store: MongoStore.create({ client: mongoose.connection.getClient(), dbName: mongoose.connection.name, collectionName: 'sessions' }),
    cookie: { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: 24 * 60 * 60 * 1000 }
  }));
  // Load the current user on every API call so role changes / disabled accounts apply immediately.
  app.use('/api', wrap(async (req, res, next) => {
    if (req.session.uid) {
      const user = await User.findById(req.session.uid).select('-passwordHash').lean();
      if (user && user.active !== false) req.user = user; else req.session.destroy(() => {});
    }
    next();
  }));
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many attempts. Please try again in a few minutes.' } }));
  app.get('/api/health', (req, res) => res.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
  app.use('/api', require('./routes/auth'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api', require('./routes/public'));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use(express.static(path.join(__dirname, '../frontend')));
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request body.' });
    if (err.name === 'ValidationError') return res.status(400).json({ error: 'Please check the submitted information.' });
    if (!err.status || err.status >= 500) console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
    res.status(err.status || 500).json({ error: err.status && err.status < 500 ? err.message : (isProd ? 'Server error. Please try again.' : `Server error: ${err.message}`) });
  });
  return app;
}
async function start() {
  if (isProd && !process.env.SESSION_SECRET) { console.error('SESSION_SECRET is required in production.'); process.exit(1); }
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');
    await require('./seed')();
    const port = Number(process.env.PORT) || 8080;
    buildApp().listen(port, () => {
      console.log(`\n  ConcertHub     → http://localhost:${port}`);
      console.log(`  Admin portal   → http://localhost:${port}/admin/\n`);
    });
  } catch (err) { console.error('Could not start ConcertHub:', err.message); process.exit(1); }
}
start();
