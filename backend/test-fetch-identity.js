const { RouterOSAPI } = require('./src/services/routeros-api');

async function run() {
  const host = '111.93.215.5';
  const port = 20786; // API port
  const username = 'Akshay';
  const password = 'Insta@123#';

  const api = new RouterOSAPI(host, port);
  try {
    console.log(`Connecting to ${host}:${port} ...`);
    await api.connect(username, password, 15000);
    console.log('Connected. Running /system/identity/print ...');

    const res = await api.sendCommand(['/system/identity/print']);
    console.log('Raw response:', res);

    let identity = null;
    if (Array.isArray(res) && res.length) {
      identity = res[0]['=name'] || res[0].name || res[0].identity || null;
    }

    if (identity) {
      console.log(`\n✅ Identity: ${identity}`);
    } else {
      console.log('\n❌ Could not extract identity from response.');
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    try { api.disconnect(); } catch {}
  }
}

run();