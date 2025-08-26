const fetch = require('node-fetch');

async function testWebInterface() {
  const ip = '66.57.230.234';
  const username = 'installer';
  const password = 'July2025$$##';
  
  console.log(`Testing web interface on ${ip}...`);
  
  // Test different web paths
  const paths = [
    '/',
    '/webfig',
    '/winbox',
    '/api',
    '/rest',
    '/cgi-bin',
    '/status',
    '/system'
  ];
  
  for (const path of paths) {
    const url = `http://${ip}${path}`;
    console.log(`\n=== Testing: ${url} ===`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const res = await fetch(url, {
        method: 'GET',
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }, 
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log(`Status: ${res.status} ${res.statusText}`);
      
      if (res.ok) {
        const text = await res.text();
        console.log(`Content preview: ${text.substring(0, 200)}...`);
        
        // Look for MikroTik indicators
        if (text.toLowerCase().includes('mikrotik') || 
            text.toLowerCase().includes('routeros') ||
            text.toLowerCase().includes('winbox')) {
          console.log('✅ MikroTik interface detected!');
        }
      }
      
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`);
    }
  }
  
  console.log('\nWeb interface test completed!');
  process.exit(0);
}

testWebInterface().catch(console.error);