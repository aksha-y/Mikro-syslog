const { fetchIdentityViaWebFig } = require('./src/services/webfig-scraper');

async function testWebFig() {
  const ip = '66.57.230.234';
  const username = 'installer';
  const password = 'July2025$$##';
  
  console.log('Testing WebFig scraper...');
  
  try {
    const identity = await fetchIdentityViaWebFig(ip, username, password);
    
    if (identity) {
      console.log(`✅ SUCCESS: Identity found: "${identity}"`);
    } else {
      console.log('❌ FAILED: No identity found');
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
  }
  
  process.exit(0);
}

testWebFig().catch(console.error);