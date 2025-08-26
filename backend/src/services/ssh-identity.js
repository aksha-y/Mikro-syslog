const { Client } = require('ssh2');

async function fetchIdentityViaSSH(ip, username, password) {
  return new Promise((resolve, reject) => {
    console.log(`[SSH] Attempting to fetch identity from ${ip} via SSH...`);
    
    const conn = new Client();
    let identity = null;
    
    conn.on('ready', () => {
      console.log(`[SSH] Connected to ${ip}`);
      
      // Execute the system identity print command
      conn.exec('/system identity print', (err, stream) => {
        if (err) {
          console.log(`[SSH] Command execution failed: ${err.message}`);
          conn.end();
          return resolve(null);
        }
        
        let output = '';
        
        stream.on('close', (code, signal) => {
          console.log(`[SSH] Command finished with code: ${code}`);
          conn.end();
          
          if (output) {
            // Parse the output to extract identity
            const identityMatch = output.match(/name:\s*(.+)/i) ||
                                 output.match(/identity:\s*(.+)/i) ||
                                 output.match(/^\s*(.+)\s*$/m);
            
            if (identityMatch && identityMatch[1]) {
              identity = identityMatch[1].trim();
              console.log(`[SSH] ✅ Identity found: "${identity}"`);
              resolve(identity);
            } else {
              console.log(`[SSH] ❌ Could not parse identity from output: ${output}`);
              resolve(null);
            }
          } else {
            console.log(`[SSH] ❌ No output received`);
            resolve(null);
          }
        });
        
        stream.on('data', (data) => {
          output += data.toString();
        });
        
        stream.stderr.on('data', (data) => {
          console.log(`[SSH] STDERR: ${data}`);
        });
      });
    });
    
    conn.on('error', (err) => {
      console.log(`[SSH] Connection failed: ${err.message}`);
      resolve(null);
    });
    
    // Connect with timeout
    conn.connect({
      host: ip,
      port: 22,
      username: username,
      password: password,
      readyTimeout: 10000,
      timeout: 10000
    });
  });
}

module.exports = { fetchIdentityViaSSH };