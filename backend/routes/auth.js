const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const U = require('../utils');
const { wrap, str } = U;

const startSession = (req, user) => new Promise((resolve, reject) =>
  req.session.regenerate(err => { if (err) return reject(err); req.session.uid = String(user._id); req.session.save(e => e ? reject(e) : resolve()); }));
const EMAIL = /^\S+@\S+\.\S+$/;

router.get('/me', (req, res) => res.json({ user: req.user ? U.userOut(req.user) : null }));

router.post('/auth/register', wrap(async (req, res) => {
  const name = str(req.body?.name, 100), email = str(req.body?.email, 200).toLowerCase(), password = req.body?.password;
  if (name.length < 2 || !EMAIL.test(email) || typeof password !== 'string' || password.length < 8 || password.length > 200)
    return res.status(400).json({ error: 'Enter your name, a valid email and a password of 8 or more characters.' });
  let user;
  try { user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) }); }
  catch (e) { if (e.code === 11000) return res.status(409).json({ error: 'An account with this email already exists. Try logging in.' }); throw e; }
  await startSession(req, user);
  res.status(201).json({ user: U.userOut(user) });
}));

router.post('/auth/login', wrap(async (req, res) => {
  const email = str(req.body?.email, 200).toLowerCase(), password = req.body?.password;
  if (!email || typeof password !== 'string') return res.status(400).json({ error: 'Enter your email and password.' });
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Incorrect email or password.' });
  if (user.active === false) return res.status(403).json({ error: 'This account has been disabled. Contact support.' });
  await startSession(req, user);
  res.json({ user: U.userOut(user) });
}));

router.post('/auth/logout', (req, res) => req.session.destroy(() => { res.clearCookie('ch.sid'); res.json({ ok: true }); }));

router.put('/me', U.requireUser, wrap(async (req, res) => {
  const name = str(req.body?.name, 100);
  if (name.length < 2) return res.status(400).json({ error: 'Enter your full name.' });
  const user = await User.findByIdAndUpdate(req.user._id, { name }, { new: true });
  res.json({ user: U.userOut(user) });
}));

router.put('/me/password', U.requireUser, wrap(async (req, res) => {
  const { current, next } = req.body || {};
  if (typeof current !== 'string' || typeof next !== 'string' || next.length < 8 || next.length > 200)
    return res.status(400).json({ error: 'New password must be 8 or more characters.' });
  const user = await User.findById(req.user._id);
  if (!(await bcrypt.compare(current, user.passwordHash))) return res.status(400).json({ error: 'Current password is incorrect.' });
  user.passwordHash = await bcrypt.hash(next, 12); await user.save();
  res.json({ ok: true });
}));
module.exports = router;
