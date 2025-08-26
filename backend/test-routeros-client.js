const { RouterOSClient } = require('routeros-client');

async function testRouterOSClient() {
  const ip = '111.93.215.5';
  const username = 'Akshay';
  const password = 'Insta@123#';
  const port = 20786;
  
  console.log(`Testing RouterOS Client with ${ip}:${port}...`);
  console.log(`Username: ${username}`);
  console.log(`Password: ${password.substring(0,3)}...`);
  
  try {
    console.log('\n=== Creating RouterOS Client ===');
    const client = new RouterOSClient({
      host: ip,
      port: port,
      user: username,
      password: password,
      timeout: 15000
    });
    
    console.log('Connecting...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    console.log('Fetching system identity...');
    
    // Use the api method to get the menu, then call print
    const systemIdentityMenu = client.api('/system/identity');
    console.log('Menu methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(systemIdentityMenu)));
    
    let response;
    if (typeof systemIdentityMenu.print === 'function') {
      response = await systemIdentityMenu.print();
    } else if (typeof systemIdentityMenu.get === 'function') {
      response = await systemIdentityMenu.get();
    } else if (typeof systemIdentityMenu.getAll === 'function') {
      response = await systemIdentityMenu.getAll();
    } else if (typeof systemIdentityMenu.where === 'function') {
      response = await systemIdentityMenu.where({});
    } else {
      // Try direct execution
      response = await systemIdentityMenu;
    }
    
    console.log('Raw response:', response);
    
    if (response && response.length > 0) {
      const identity = response[0].name || response[0]['=name'] || response[0].identity;
      if (identity) {
        console.log(`✅ SUCCESS: Identity found: "${identity}"`);
      } else {
        console.log('❌ No identity field found in response');
        console.log('Available fields:', Object.keys(response[0]));
      }
    } else {
      console.log('❌ No response received');
    }
    
    await client.close();
    console.log('Disconnected.');
    
  } catch (error) {
    console.log(`❌ RouterOS Client failed: ${error.message}`);
    console.log('Error details:', error);
  }
  
  console.log('\nTest completed!');
  process.exit(0);
}

testRouterOSClient().catch(console.error);