const { fetchIdentityViaSSH } = require('./src/services/ssh-identity');

async function testSSH() {
  const ip = '66.57.230.234';
  const username = 'installer';
  const password = 'July2025$$##';
  
  console.log('Testing SSH identity fetcher...');
  
  try {
    const identity = await fetchIdentityViaSSH(ip, username, password);
    
    if (identity) {
      console.log(`✅ SUCCESS: Identity found via SSH: "${identity}"`);
    } else {
      console.log('❌ FAILED: No identity found via SSH');
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
  }
  
  process.exit(0);
}

testSSH().catch(console.error);