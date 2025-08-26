const { RouterOSAPI } = require('./src/services/routeros-api');

async function testMikroTik() {
  const ip = '66.57.230.234';
  const username = 'installer';
  const password = 'July2025$$##';
  
  console.log(`Testing connection to ${ip}...`);
  console.log(`Username: ${username}`);
  console.log(`Password: ${password.substring(0,3)}...`);
  
  // Test RouterOS API (port 20786)
  try {
    console.log('\n=== Testing RouterOS API (port 20786) ===');
    const api = new RouterOSAPI(ip, 20786);
    
    console.log('Connecting...');
    await api.connect(username, password, 15000); // 15 second timeout
    console.log('✅ Connected successfully!');
    
    console.log('Running /system/identity/print...');
    const response = await api.sendCommand(['/system/identity/print']);
    console.log('Raw response:', JSON.stringify(response, null, 2));
    
    if (response.length > 0 && response[0]['=name']) {
      const identity = response[0]['=name'];
      console.log(`✅ Identity found: "${identity}"`);
    } else {
      console.log('❌ No identity found in response');
    }
    
    api.disconnect();
    console.log('Disconnected');
    
  } catch (error) {
    console.log('❌ RouterOS API failed:', error.message);
  }
  
  // Test REST API (port 80/443)
  try {
    console.log('\n=== Testing REST API (port 80) ===');
    const { fetchRouterIdentity } = require('./src/services/mikrotik');
    const identity = await fetchRouterIdentity(ip, username, password);
    
    if (identity) {
      console.log(`✅ REST API success: "${identity}"`);
    } else {
      console.log('❌ REST API returned no identity');
    }
    
  } catch (error) {
    console.log('❌ REST API failed:', error.message);
  }
  
  console.log('\nTest completed!');
  process.exit(0);
}

testMikroTik().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});