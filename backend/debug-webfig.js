const fetch = require('node-fetch');
const fs = require('fs');

async function debugWebFig() {
  const ip = '66.57.230.234';
  const username = 'installer';
  const password = 'July2025$$##';
  
  console.log('Debugging WebFig pages...');
  
  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  
  const pages = [
    '/webfig/',
    '/webfig/system',
    '/webfig/system/',
    '/webfig/system/identity',
    '/webfig/system.html',
    '/webfig/status',
    '/webfig/main'
  ];
  
  for (const page of pages) {
    const url = `http://${ip}${page}`;
    console.log(`\n=== Fetching: ${url} ===`);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      console.log(`Status: ${response.status}`);
      
      if (response.ok) {
        const html = await response.text();
        const filename = `webfig-${page.replace(/[\/\\]/g, '_')}.html`;
        fs.writeFileSync(filename, html);
        console.log(`✅ Saved to ${filename} (${html.length} bytes)`);
        
        // Look for identity patterns
        const patterns = [
          /identity[^>]*[>=]["']([^"'<>]+)["'<]/gi,
          /name[^>]*[>=]["']([^"'<>]+)["'<]/gi,
          /<title>([^<]+)/gi,
          /value="([^"]+)"[^>]*name="identity"/gi,
          /name="identity"[^>]*value="([^"]+)"/gi
        ];
        
        for (const pattern of patterns) {
          const matches = [...html.matchAll(pattern)];
          if (matches.length > 0) {
            console.log(`Pattern matches:`, matches.map(m => m[1]));
          }
        }
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  console.log('\nDebug completed! Check the saved HTML files for identity information.');
  process.exit(0);
}

debugWebFig().catch(console.error);