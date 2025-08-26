const fetch = require('node-fetch');
const https = require('https');

async function testRestAPI() {
  const ip = '66.57.230.234';
  const username = 'installer';
  const password = 'July2025$$##';
  
  console.log(`Testing REST API on ${ip}...`);
  console.log(`Username: ${username}`);
  console.log(`Password: ${password.substring(0,3)}...`);
  
  // Test different REST API endpoints
  const endpoints = [
    `http://${ip}/rest/system/identity`,
    `https://${ip}/rest/system/identity`,
    `http://${ip}/rest/system/identity/print`,
    `https://${ip}/rest/system/identity/print`,
    `http://${ip}/rest/system/identity/`,
    `https://${ip}/rest/system/identity/`
  ];
  
  for (const url of endpoints) {
    console.log(`\n=== Testing: ${url} ===`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
      console.log(`Authorization: Basic ${Buffer.from(`${username}:${password}`).toString('base64').substring(0,10)}...`);
      
      const options = {
        method: 'GET',
        headers: { 
          'Authorization': authHeader,
          'User-Agent': 'Syslog-Portal/1.0',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }, 
        signal: controller.signal
      };
      
      // For HTTPS, ignore self-signed certificates
      if (url.startsWith('https')) {
        options.agent = new https.Agent({ rejectUnauthorized: false });
      }
      
      console.log('Making request...');
      const res = await fetch(url, options);
      
      clearTimeout(timeoutId);
      
      console.log(`Status: ${res.status} ${res.statusText}`);
      console.log('Headers:', Object.fromEntries(res.headers.entries()));
      
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        console.log(`Content-Type: ${contentType}`);
        
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          console.log('JSON Response:', JSON.stringify(data, null, 2));
          
          const identity = data.name || data.identity || data['.id'] || data['=name'];
          if (identity) {
            console.log(`✅ Identity found: "${identity}"`);
          } else {
            console.log('❌ No identity field found in response');
          }
        } else {
          const text = await res.text();
          console.log('Text Response:', text.substring(0, 500));
        }
      } else {
        const text = await res.text().catch(() => 'Could not read response body');
        console.log('Error Response:', text.substring(0, 500));
      }
      
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`);
    }
  }
  
  console.log('\nREST API test completed!');
  process.exit(0);
}

testRestAPI().catch(console.error);