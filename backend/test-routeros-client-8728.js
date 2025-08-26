const { RouterOSClient } = require('routeros-client');

async function run() {
  const ip = '66.57.230.234';
  const user = 'installer';
  const pass = 'July2025$$##';
  const port = 8728;

  console.log(`Testing RouterOS Client with ${ip}:${port} ...`);
  try {
    const client = new RouterOSClient({ host: ip, port, user, password: pass, timeout: 20000 });
    console.log('Connecting ...');
    await client.connect();
    console.log('Connected. Fetching identity ...');
    const resp = await client.api('/system/identity').print();
    console.log('Raw:', resp);
    const identity = Array.isArray(resp) && resp[0] && (resp[0].name || resp[0]['=name']);
    console.log(identity ? `\n✅ Identity: ${identity}` : '\n❌ No identity field found');
    await client.close();
  } catch (e) {
    console.error('Error:', e.message);
  }
  console.log('\nDone.');
}

run();