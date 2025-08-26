const { RouterOSAPI } = require('./src/services/routeros-api');

async function testNewCredentials() {
  // Your test credentials
  const ip = '111.93.215.5';
  const username = 'Akshay';
  const password = 'Insta@123#';
  const port = 20786;
  
  console.log(`Testing connection to ${ip}:${port}...`);
  console.log(`Username: ${username}`);
  console.log(`Password: ${password.substring(0,3)}...`);
  
  // Test RouterOS API
  try {
    console.log('\n=== Testing RouterOS API ===');
    const api = new RouterOSAPI(ip, port);
    
    console.log('Connecting...');
    await api.connect(username, password, 15000); // 15 second timeout
    console.log('✅ Connected successfully!');
    
    console.log('Fetching system identity...');
    const identity = await api.getSystemIdentity();
    
    if (identity) {
      console.log(`✅ SUCCESS: Identity found: "${identity}"`);
    } else {
      console.log('❌ No identity returned');
    }
    
    api.disconnect();
    console.log('Disconnected.');
    
  } catch (error) {
    console.log(`❌ RouterOS API failed: ${error.message}`);
  }
  
  console.log('\nTest completed!');
  process.exit(0);
}

testNewCredentials().catch(console.error);