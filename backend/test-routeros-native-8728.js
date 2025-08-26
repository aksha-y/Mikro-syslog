const { RouterOSAPI } = require('./src/services/routeros-api');

async function run() {
  const host = '66.57.230.234';
  const port = 8728;
  const username = 'installer';
  const password = 'July2025$$##';
  const api = new RouterOSAPI(host, port);
  try {
    console.log(`Connecting to ${host}:${port} ...`);
    await api.connect(username, password, 20000);
    console.log('Connected. Running /system/identity/print ...');
    const res = await api.sendCommand(['/system/identity/print']);
    console.log('Raw response:', res);
    if (Array.isArray(res) && res[0] && res[0]['=name']) {
      console.log(`\n✅ Identity: ${res[0]['=name']}`);
    } else {
      console.log('\n❌ Could not parse identity');
    }
  } catch (e) {
    console.error('Error:', e.message || e);
  } finally {
    try { api.disconnect(); } catch {}
  }
}

run();