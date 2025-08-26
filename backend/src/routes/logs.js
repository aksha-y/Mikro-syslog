const express = require('express');
const { prisma } = require('../db/client');
const { auth } = require('../middleware/auth');
const { stringify } = require('csv-stringify');

const router = express.Router();

// Cleanup logs older than N days (ADMIN)
router.post('/cleanup', auth(['ADMIN']), async (req, res) => {
  const { days, deviceIp, deviceIdentity, severity } = req.body;
  const d = Number(days);
  if (!d || d < 1) return res.status(400).json({ error: 'days must be positive integer' });
  const cutoff = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
  const where = { timestamp: { lt: cutoff } };
  if (deviceIp) where.deviceIp = deviceIp;
  if (deviceIdentity) where.deviceIdentity = deviceIdentity;
  if (severity) where.severity = severity;
  const del = await prisma.log.deleteMany({ where });
  res.json({ deleted: del.count, olderThanDays: d });
});

// Clear all logs (ADMIN)
router.post('/cleanup-all', auth(['ADMIN']), async (req, res) => {
  const del = await prisma.log.deleteMany({});
  res.json({ deleted: del.count, all: true });
});

function buildLogWhere({ deviceIp, deviceIdentity, severity, q, start, end }) {
  const where = {};
  // Use contains for partial matching - Prisma handles case sensitivity based on database
  if (deviceIp) {
    where.deviceIp = { contains: String(deviceIp) };
  }
  if (deviceIdentity) {
    where.deviceIdentity = { contains: String(deviceIdentity) };
  }
  if (severity) where.severity = severity;
  if (q) {
    where.message = { contains: String(q) };
  }
  if (start || end) where.timestamp = {};
  if (start) where.timestamp.gte = new Date(start);
  if (end) where.timestamp.lte = new Date(end);
  return where;
}

router.get('/', auth(), async (req, res) => {
  const { deviceIp, deviceIdentity, severity, q, start, end, page = 1, pageSize = 100 } = req.query;
  const where = buildLogWhere({ deviceIp, deviceIdentity, severity, q, start, end });
  const skip = (Number(page) - 1) * Number(pageSize);
  const take = Math.min(Number(pageSize), 1000);

  const [items, total] = await Promise.all([
    prisma.log.findMany({ where, orderBy: { timestamp: 'desc' }, skip, take }),
    prisma.log.count({ where })
  ]);

  // Attach device.name as authoritative identity fallback (from /system identity)
  const ips = Array.from(new Set(items.map(i=>i.deviceIp)));
  const devices = await prisma.device.findMany({ where: { ip: { in: ips } }, select: { ip:true, name:true } });
  const nameByIp = Object.fromEntries(devices.map(d=>[d.ip, d.name]));
  const enriched = items.map(i=> ({ ...i, deviceIdentity: i.deviceIdentity || nameByIp[i.deviceIp] || i.deviceIdentity }));

  res.json({ items: enriched, total, page: Number(page), pageSize: take });
});

router.get('/export', auth(), async (req, res) => {
  const { deviceIp, deviceIdentity, severity, q, start, end, format = 'csv', limit = 10000 } = req.query;
  const where = buildLogWhere({ deviceIp, deviceIdentity, severity, q, start, end });
  const take = Math.min(Number(limit), 50000);
  const logs = await prisma.log.findMany({ where, orderBy: { timestamp: 'desc' }, take });

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify(logs));
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="logs.csv"');
  const stringifier = stringify({ header: true, columns: ['id','timestamp','deviceIp','deviceIdentity','severity','message','source'] });
  logs.forEach(l => stringifier.write([l.id, l.timestamp.toISOString(), l.deviceIp, l.deviceIdentity || '', l.severity, l.message, l.source || '']));
  stringifier.end();
  stringifier.pipe(res);
});

router.get('/stats', auth(), async (req, res) => {
  const { start, end } = req.query;
  const where = {};
  if (start || end) where.timestamp = {};
  if (start) where.timestamp.gte = new Date(start);
  if (end) where.timestamp.lte = new Date(end);

  // SQLite-compatible aggregation using Prisma
  const since = end ? new Date(end) : new Date();
  const hours = 168;
  const from = start ? new Date(start) : new Date(since.getTime() - hours * 3600 * 1000);

  const logs = await prisma.log.findMany({
    where: { ...(where.timestamp ? { timestamp: where.timestamp } : {}) },
    select: { timestamp: true, deviceIp: true, severity: true },
    orderBy: { timestamp: 'desc' },
  });

  // Bucket per hour in JS for portability
  const volumeMap = new Map();
  for (const l of logs) {
    const t = new Date(l.timestamp);
    if (t < from || t > since) continue;
    const bucket = new Date(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours());
    const key = bucket.toISOString();
    volumeMap.set(key, (volumeMap.get(key) || 0) + 1);
  }
  const volume = Array.from(volumeMap.entries()).map(([bucket, c]) => ({ bucket, c }));
  volume.sort((a,b)=> new Date(b.bucket) - new Date(a.bucket));

  const deviceAgg = new Map();
  for (const l of logs) {
    if (start && l.timestamp < new Date(start)) continue;
    if (end && l.timestamp > new Date(end)) continue;
    const rec = deviceAgg.get(l.deviceIp) || { deviceIp: l.deviceIp, errors: 0, total: 0 };
    rec.total += 1;
    if (['ERROR','CRITICAL','ALERT','EMERGENCY'].includes(l.severity)) rec.errors += 1;
    deviceAgg.set(l.deviceIp, rec);
  }
  const errorsByDevice = Array.from(deviceAgg.values()).sort((a,b)=> b.errors - a.errors).slice(0,50);

  res.json({ volume, errorsByDevice });
});

// Backfill deviceIdentity for existing logs using the shared parser (ADMIN)
router.post('/backfill-identity', auth(['ADMIN']), async (req, res) => {
  const { limit = 5000, deviceIp } = req.body || {};
  const where = { OR: [{ deviceIdentity: null }, { deviceIdentity: '' }] };
  if (deviceIp) where.deviceIp = deviceIp;
  const take = Math.min(Number(limit) || 5000, 20000);

  // Lazy import to avoid circular deps
  const { parseIdentity } = require('../syslog/parse');

  const logs = await prisma.log.findMany({ where, orderBy: { timestamp: 'asc' }, take, select: { id: true, message: true } });
  let updated = 0;
  for (const l of logs) {
    const ident = parseIdentity(l.message);
    if (ident) {
      await prisma.log.update({ where: { id: l.id }, data: { deviceIdentity: ident } });
      updated++;
    }
  }
  res.json({ scanned: logs.length, updated });
});

// Rewrite identities that look like topics (e.g., contain '/') or are blank; use parser then fallback to device.name (ADMIN)
router.post('/rewrite-identity', auth(['ADMIN']), async (req, res) => {
  const { limit = 10000, deviceIp } = req.body || {};
  const { parseIdentity } = require('../syslog/parse');

  const where = { OR: [
    { deviceIdentity: null },
    { deviceIdentity: '' },
    { deviceIdentity: { contains: '/' } }
  ] };
  if (deviceIp) where.deviceIp = deviceIp;

  const logs = await prisma.log.findMany({ where, orderBy: { timestamp: 'desc' }, take: Math.min(Number(limit)||10000, 50000), select: { id:true, message:true, deviceIp:true } });

  const ips = Array.from(new Set(logs.map(l=>l.deviceIp)));
  const devices = await prisma.device.findMany({ where: { ip: { in: ips } }, select: { ip:true, name:true } });
  const nameByIp = Object.fromEntries(devices.map(d=>[d.ip, d.name]));

  let updated = 0;
  for (const l of logs) {
    const parsed = parseIdentity(l.message);
    const next = parsed || nameByIp[l.deviceIp] || null;
    if (next) {
      await prisma.log.update({ where: { id: l.id }, data: { deviceIdentity: next } });
      updated++;
    }
  }
  res.json({ scanned: logs.length, updated });
});

// Normalize identities via MikroTik API for logs with missing/invalid identity (ADMIN)
router.post('/normalize-identity-api', auth(['ADMIN']), async (req, res) => {
  const { deviceIp } = req.body || {};
  const { fetchRouterIdentity } = require('../services/mikrotik');

  const where = { OR: [
    { deviceIdentity: null },
    { deviceIdentity: '' },
    { deviceIdentity: { contains: '/' } }
  ] };
  if (deviceIp) where.deviceIp = deviceIp;

  // Get unique IPs to query
  const ipsRows = await prisma.log.findMany({ where, select: { deviceIp: true }, distinct: ['deviceIp'] });
  const ips = ipsRows.map(r => r.deviceIp);

  let resolved = 0, updated = 0;
  const results = [];
  for (const ip of ips) {
    try {
      const ident = await fetchRouterIdentity(ip);
      if (ident) {
        const upd = await prisma.log.updateMany({
          where: {
            deviceIp: ip,
            OR: [
              { deviceIdentity: null },
              { deviceIdentity: '' },
              { deviceIdentity: { contains: '/' } }
            ]
          },
          data: { deviceIdentity: ident }
        });
        resolved += 1;
        updated += upd.count;
        results.push({ ip, identity: ident, updated: upd.count });
        // Also persist on device table for future fallback
        await prisma.device.update({ where: { ip }, data: { name: ident } }).catch(async () => {
          try { await prisma.device.create({ data: { ip, name: ident } }); } catch {}
        });
      } else {
        results.push({ ip, identity: null, updated: 0 });
      }
    } catch (e) {
      results.push({ ip, error: String(e) });
    }
  }
  res.json({ ips: ips.length, resolved, updated, results });
});

module.exports = router;