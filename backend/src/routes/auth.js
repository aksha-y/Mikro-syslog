const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../db/client');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', auth(['ADMIN']), async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const hashed = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({ data: { email, password: hashed, role: role || 'VIEWER' } });
    res.json({ id: user.id, email: user.email, role: user.role });
  } catch (err) {
    res.status(400).json({ error: 'User create failed', detail: String(err) });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'change_me', { expiresIn: '12h' });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

// Current user
router.get('/me', auth(), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { id: true, email: true, role: true } });
  res.json(user);
});

module.exports = router;