const express = require('express');
const bcrypt = require('bcryptjs');
const { prisma } = require('../db/client');
const { auth } = require('../middleware/auth');

const router = express.Router();

// List users (ADMIN)
router.get('/', auth(['ADMIN']), async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, email: true, role: true, createdAt: true } });
  res.json(users);
});

// Create user (ADMIN)
router.post('/', auth(['ADMIN']), async (req, res) => {
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

// Update user (ADMIN) - can update email, role, password
router.put('/:id', auth(['ADMIN']), async (req, res) => {
  const { id } = req.params;
  const { email, role, password } = req.body;
  const data = {};
  if (email) data.email = email;
  if (role) data.role = role;
  if (password) data.password = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.update({ where: { id }, data, select: { id: true, email: true, role: true } });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: 'User update failed', detail: String(err) });
  }
});

// Delete user (ADMIN)
router.delete('/:id', auth(['ADMIN']), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.user.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: 'User delete failed', detail: String(err) });
  }
});

module.exports = router;