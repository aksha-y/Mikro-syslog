const express = require('express');
const { prisma } = require('../db/client');
const { auth } = require('../middleware/auth');

const router = express.Router();

async function getSetting(key, fallback) {
  const s = await prisma.setting.findUnique({ where: { key } });
  let val = s ? s.value : undefined;
  // Auto-decrypt sensitive MikroTik credentials when accessed by server code
  if ((key === 'MT_USER' || key === 'MT_PASS') && val) {
    const looksEncrypted = (typeof val === 'string') && val.includes('.') && val.split('.').length === 3;
    if (looksEncrypted) {
      try { val = decrypt(val); } catch { val = ''; }
    }
  }
  // If setting is missing or blank, use provided fallback
  if (val === undefined || val === null || String(val).trim() === '') return fallback;
  return val;
}

const { encrypt, decrypt } = require('../utils/crypto');

router.get('/', auth(['ADMIN']), async (req, res) => {
  const keys = ['WAN_IP','SYSLOG_PORT','SYSLOG_HOST','MT_USER','MT_PASS','MT_API_PORT','MT_HTTP_PORT','MT_HTTPS_PORT'];
  const entries = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const map = Object.fromEntries(entries.map(e => [e.key, e.value]));
  res.json({
    WAN_IP: map.WAN_IP || '',
    SYSLOG_PORT: map.SYSLOG_PORT || String(process.env.SYSLOG_PORT || 514),
    SYSLOG_HOST: map.SYSLOG_HOST || String(process.env.SYSLOG_HOST || '0.0.0.0'),
    MT_USER: map.MT_USER || '',
    MT_PASS: map.MT_PASS || '',
    MT_API_PORT: map.MT_API_PORT || '8728',
    MT_HTTP_PORT: map.MT_HTTP_PORT || '80',
    MT_HTTPS_PORT: map.MT_HTTPS_PORT || '' // empty means disabled/optional
  });
});

router.post('/', auth(['ADMIN']), async (req, res) => {
  const { WAN_IP, SYSLOG_PORT, SYSLOG_HOST, MT_USER, MT_PASS, MT_API_PORT, MT_HTTP_PORT, MT_HTTPS_PORT } = req.body;
  const data = [];
  if (WAN_IP !== undefined) data.push({ key: 'WAN_IP', value: String(WAN_IP) });
  if (SYSLOG_PORT !== undefined) data.push({ key: 'SYSLOG_PORT', value: String(SYSLOG_PORT) });
  if (SYSLOG_HOST !== undefined) data.push({ key: 'SYSLOG_HOST', value: String(SYSLOG_HOST) });
  // Store as plain text (no encryption) per request
  if (MT_USER !== undefined) data.push({ key: 'MT_USER', value: MT_USER ? String(MT_USER) : '' });
  if (MT_PASS !== undefined) data.push({ key: 'MT_PASS', value: MT_PASS ? String(MT_PASS) : '' });
  if (MT_API_PORT !== undefined) data.push({ key: 'MT_API_PORT', value: String(MT_API_PORT) });
  if (MT_HTTP_PORT !== undefined) data.push({ key: 'MT_HTTP_PORT', value: String(MT_HTTP_PORT) });
  if (MT_HTTPS_PORT !== undefined) data.push({ key: 'MT_HTTPS_PORT', value: String(MT_HTTPS_PORT) });

  for (const d of data) {
    await prisma.setting.upsert({ where: { key: d.key }, update: { value: d.value }, create: d });
  }
  res.json({ ok: true, note: 'Settings saved. Syslog UDP host/port needs backend restart to take effect. MikroTik credentials and ports apply immediately.' });
});

module.exports = { router, getSetting };