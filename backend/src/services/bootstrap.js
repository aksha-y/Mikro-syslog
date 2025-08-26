const bcrypt = require('bcryptjs');
const { prisma } = require('../db/client');

async function ensureAdminUser() {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'admin';
  const forceReset = String(process.env.ADMIN_FORCE_RESET || '').toLowerCase() === 'true';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (forceReset) {
      const hashed = await bcrypt.hash(password, 10);
      await prisma.user.update({ where: { email }, data: { password: hashed, role: 'ADMIN' } });
      console.log(`[Bootstrap] Admin password reset for ${email}`);
    }
    return existing;
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, password: hashed, role: 'ADMIN' } });
  console.log(`[Bootstrap] Admin ensured: ${email}`);
  return user;
}

module.exports = { ensureAdminUser };