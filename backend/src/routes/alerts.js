const express = require('express');
const { prisma } = require('../db/client');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth(), async (req, res) => {
  const items = await prisma.alertRule.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(items);
});

router.post('/', auth(['ADMIN']), async (req, res) => {
  const { name, deviceIp, minSeverity, keyword, emailTo, smsTo, enabled } = req.body;
  const rule = await prisma.alertRule.create({ data: { name, deviceIp, minSeverity, keyword, emailTo, smsTo, enabled: enabled ?? true } });
  res.json(rule);
});

router.put('/:id', auth(['ADMIN']), async (req, res) => {
  const { id } = req.params;
  const { name, deviceIp, minSeverity, keyword, emailTo, smsTo, enabled } = req.body;
  const rule = await prisma.alertRule.update({ where: { id }, data: { name, deviceIp, minSeverity, keyword, emailTo, smsTo, enabled } });
  res.json(rule);
});

router.delete('/:id', auth(['ADMIN']), async (req, res) => {
  const { id } = req.params;
  await prisma.alertRule.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;