const net = require('net');
const { exec } = require('child_process');

async function testNewConnectivity() {
  const ip = '111.93.215.5';
  const ports = [20786, 8728, 80, 443, 22, 23, 5114];
  
  console.log(`Testing connectivity to ${ip}...`);
  
  // Test ping first
  console.log('\n=== Testing Ping ===');
  try {
    await new Promise((resolve, reject) => {
      exec(`ping -n 4 ${ip}`, (error, stdout, stderr) => {
        if (error) {
          console.log('❌ Ping failed:', error.message);
          reject(error);
        } else {
          console.log('✅ Ping successful');
          console.log(stdout);
          resolve();
        }
      });
    });
  } catch (error) {
    console.log('❌ Ping test failed');
  }
  
  // Test port connectivity
  console.log('\n=== Testing Port Connectivity ===');
  for (const port of ports) {
    try {
      const isOpen = await testPort(ip, port, 5000);
      console.log(`Port ${port}: ${isOpen ? '✅ OPEN' : '❌ CLOSED/FILTERED'}`);
    } catch (error) {
      console.log(`Port ${port}: ❌ ERROR - ${error.message}`);
    }
  }
  
  console.log('\nConnectivity test completed!');
  process.exit(0);
}

function testPort(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    const onError = () => {
      socket.destroy();
      resolve(false);
    };
    
    socket.setTimeout(timeout);
    socket.once('error', onError);
    socket.once('timeout', onError);
    
    socket.connect(port, host, () => {
      socket.destroy();
      resolve(true);
    });
  });
}

testNewConnectivity().catch(console.error);