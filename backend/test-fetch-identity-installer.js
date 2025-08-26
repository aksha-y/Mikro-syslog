const { RouterOSAPI } = require('./src/services/routeros-api');
const { fetchRouterIdentity } = require('./src/services/mikrotik');

async function tryNative(host, ports, user, pass) {
  for (const port of ports) {
    const api = new RouterOSAPI(host, port);
    try {
      console.log(`\n== Trying RouterOS API ${host}:${port} with ${user} ==`);
      await api.connect(user, pass, 12000);
      console.log('Connected. Running /system/identity/print ...');
      const res = await api.sendCommand(['/system/identity/print']);
      console.log('Raw response:', res);
      const identity = (res && res[0] && (res[0]['=name'] || res[0].name)) || null;
      api.disconnect();
      if (identity) {
        console.log(`✅ Identity from port ${port}: ${identity}`);
        return identity;
      } else {
        console.log('❌ Could not parse identity from response');
      }
    } catch (e) {
      try { api.disconnect(); } catch {}
      console.log(`Failed on port ${port}: ${e.message}`);
    }
  }
  return null;
}

async function run() {
  const host = '66.57.230.234';
  const ports = [20786, 8728, 8729];
  const user = 'installer';
  const pass = 'July2025$$##';

  let identity = await tryNative(host, ports, user, pass);
  if (!identity) {
    console.log('\n== Trying REST/combined helper ==');
    for (const p of ports) {
      try {
        const id = await fetchRouterIdentity(host, user, pass, p);
        if (id) { console.log(`✅ Identity via helper (port ${p}): ${id}`); identity = id; break; }
      } catch (e) { console.log(`Helper failed (port ${p}): ${e.message}`); }
    }
  }

  if (identity) {
    console.log(`\nFINAL IDENTITY: ${identity}`);
  } else {
    console.log('\nFINAL: No identity obtained');
  }
}

run();