require('dotenv').config();
const { prisma } = require('../src/db/client');
const { encrypt } = require('../src/utils/crypto');

async function main() {
  const settings = [
    { key: 'MT_USER', value: encrypt('Akshay') },
    { key: 'MT_PASS', value: encrypt('Insta@123#') },
    { key: 'MT_API_PORT', value: String(20786) },
    { key: 'SYSLOG_PORT', value: String(5114) },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({ where: { key: s.key }, update: { value: s.value }, create: s });
    console.log(`Set ${s.key}=${s.key.includes('PASS') ? '***' : s.value}`);
  }

  console.log('Done. Note: Changing SYSLOG_PORT requires backend restart.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });