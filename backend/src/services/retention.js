const cron = require('node-cron');
const { prisma } = require('../db/client');

function startRetentionJob() {
  const days = Number(process.env.LOG_RETENTION_DAYS || 30);
  if (days <= 0) return;
  // Run daily at 02:10
  cron.schedule('10 2 * * *', async () => {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    try {
      const del = await prisma.log.deleteMany({ where: { timestamp: { lt: cutoff } } });
      console.log(`[Retention] Deleted ${del.count} logs older than ${days} days`);
    } catch (e) {
      console.error('[Retention] Failed:', e);
    }
  });

  console.log(`[Retention] Enabled: ${days} days`);
}

module.exports = { startRetentionJob };