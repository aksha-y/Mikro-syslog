(async () => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const { parseIdentity } = require('../src/syslog/parse');

  const limit = Number(process.env.BACKFILL_LIMIT || 20000);
  const deviceIp = process.env.BACKFILL_DEVICE_IP || null;
  const where = { OR: [{ deviceIdentity: null }, { deviceIdentity: '' }] };
  if (deviceIp) where.deviceIp = deviceIp;

  try {
    const logs = await prisma.log.findMany({ where, orderBy: { timestamp: 'asc' }, take: limit, select: { id: true, message: true } });
    let updated = 0;
    for (const l of logs) {
      const ident = parseIdentity(l.message);
      if (ident) {
        await prisma.log.update({ where: { id: l.id }, data: { deviceIdentity: ident } });
        updated++;
      }
    }
    console.log(JSON.stringify({ scanned: logs.length, updated }));
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();