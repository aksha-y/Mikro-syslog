const { fetchIdentityViaWebFigAdvanced } = require('./src/services/webfig-advanced');

async function testAdvancedWebFig() {
  const ip = '66.57.230.234';
  const username = 'installer';
  const password = 'July2025$$##';
  
  console.log('Testing Advanced WebFig scraper...');
  
  try {
    const identity = await fetchIdentityViaWebFigAdvanced(ip, username, password);
    
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

testAdvancedWebFig().catch(console.error);