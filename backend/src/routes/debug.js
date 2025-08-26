const express = require('express');
const fs = require('fs');
const path = require('path');
const { auth } = require('../middleware/auth');

const router = express.Router();

const logsDir = path.join(__dirname, '../../logs');
const ALLOWED_LOGS = new Set(['fetch-identity.log', 'server-errors.log']);

router.get('/logs', auth(['ADMIN']), async (req, res) => {
  try {
    // List only allowed logs and their sizes
    const files = Array.from(ALLOWED_LOGS).map((name) => {
      const full = path.join(logsDir, name);
      try {
        const st = fs.statSync(full);
        return { name, size: st.size };
      } catch {
        return { name, size: 0 };
      }
    });
    res.json({ logs: files });
  } catch (e) {
    res.status(500).json({ error: 'Failed to list logs', detail: String(e) });
  }
});

router.get('/logs/:name', auth(['ADMIN']), async (req, res) => {
  const { name } = req.params;
  const lines = Math.min(Number(req.query.lines) || 500, 5000);
  if (!ALLOWED_LOGS.has(name)) return res.status(400).json({ error: 'Invalid log name' });
  try {
    const full = path.join(logsDir, name);
    if (!fs.existsSync(full)) return res.json({ name, lines: [] });
    const content = fs.readFileSync(full, 'utf8');
    const all = content.split(/\r?\n/);
    const tail = all.slice(Math.max(0, all.length - lines)).filter(Boolean);
    res.json({ name, lines: tail });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read log', detail: String(e) });
  }
});

router.delete('/logs/:name', auth(['ADMIN']), async (req, res) => {
  const { name } = req.params;
  if (!ALLOWED_LOGS.has(name)) return res.status(400).json({ error: 'Invalid log name' });
  try {
    const full = path.join(logsDir, name);
    if (fs.existsSync(full)) fs.unlinkSync(full);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to clear log', detail: String(e) });
  }
});

module.exports = router;