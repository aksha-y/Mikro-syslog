(async () => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    // For each device, find the most recent log with a parsed deviceIdentity and store it into Device.name
    const devices = await prisma.device.findMany({ select: { ip: true } });
    let updated = 0;
    for (const d of devices) {
      const log = await prisma.log.findFirst({
        where: { deviceIp: d.ip, deviceIdentity: { not: null } },
        orderBy: { timestamp: 'desc' },
        select: { deviceIdentity: true }
      });
      if (log && log.deviceIdentity) {
        await prisma.device.update({ where: { ip: d.ip }, data: { name: log.deviceIdentity } });
        updated++;
      }
    }
    console.log(JSON.stringify({ devices: devices.length, updated }));
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();