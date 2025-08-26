const fetch = require('node-fetch');

async function fetchIdentityViaWebFigAdvanced(ip, username, password) {
  try {
    console.log(`[WEBFIG-ADV] Attempting to fetch identity from ${ip} via WebFig...`);
    
    // Step 1: Get the main WebFig page
    const mainResponse = await fetch(`http://${ip}/webfig/`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    if (!mainResponse.ok) {
      throw new Error(`WebFig main page returned ${mainResponse.status}`);
    }
    
    // Step 2: Try to access the WebFig API endpoints directly
    // WebFig usually has internal API endpoints for data
    const apiEndpoints = [
      '/webfig/api/system/identity',
      '/webfig/api/system',
      '/webfig/api/status',
      '/webfig/system/identity',
      '/webfig/data/system/identity',
      '/webfig/json/system/identity'
    ];
    
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
    
    for (const endpoint of apiEndpoints) {
      try {
        console.log(`[WEBFIG-ADV] Trying endpoint: ${endpoint}`);
        
        const response = await fetch(`http://${ip}${endpoint}`, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*',
            'X-Requested-With': 'XMLHttpRequest'
          },
          timeout: 5000
        });
        
        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          
          if (contentType.includes('application/json')) {
            const data = await response.json();
            console.log(`[WEBFIG-ADV] JSON response from ${endpoint}:`, data);
            
            // Look for identity in various possible fields
            const identity = data.identity || data.name || data['system-identity'] || 
                           (data.data && data.data.identity) || 
                           (Array.isArray(data) && data[0] && data[0].identity);
            
            if (identity) {
              console.log(`[WEBFIG-ADV] ✅ Identity found via ${endpoint}: "${identity}"`);
              return identity;
            }
          } else {
            const text = await response.text();
            console.log(`[WEBFIG-ADV] Text response from ${endpoint} (first 200 chars):`, text.substring(0, 200));
            
            // Look for identity in text response
            const identityMatch = text.match(/identity[^>]*[>=]["']([^"'<>]+)["'<]/i) ||
                                 text.match(/name[^>]*[>=]["']([^"'<>]+)["'<]/i) ||
                                 text.match(/"identity"\s*:\s*"([^"]+)"/i);
            
            if (identityMatch && identityMatch[1] && identityMatch[1].length > 2) {
              const identity = identityMatch[1].trim();
              console.log(`[WEBFIG-ADV] ✅ Identity found via ${endpoint}: "${identity}"`);
              return identity;
            }
          }
        }
      } catch (error) {
        console.log(`[WEBFIG-ADV] Endpoint ${endpoint} failed: ${error.message}`);
      }
    }
    
    // Step 3: Try to simulate the WebFig login process
    try {
      console.log(`[WEBFIG-ADV] Attempting WebFig login simulation...`);
      
      // WebFig often uses a login endpoint
      const loginResponse = await fetch(`http://${ip}/webfig/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: `name=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
        timeout: 10000
      });
      
      if (loginResponse.ok) {
        const loginResult = await loginResponse.text();
        console.log(`[WEBFIG-ADV] Login response:`, loginResult.substring(0, 200));
        
        // Look for identity in login response
        const identityMatch = loginResult.match(/"identity"\s*:\s*"([^"]+)"/i) ||
                             loginResult.match(/identity[^>]*[>=]["']([^"'<>]+)["'<]/i);
        
        if (identityMatch && identityMatch[1]) {
          const identity = identityMatch[1].trim();
          console.log(`[WEBFIG-ADV] ✅ Identity found in login response: "${identity}"`);
          return identity;
        }
      }
    } catch (loginError) {
      console.log(`[WEBFIG-ADV] Login simulation failed: ${loginError.message}`);
    }
    
    console.log(`[WEBFIG-ADV] ❌ Could not extract identity from WebFig for ${ip}`);
    return null;
    
  } catch (error) {
    console.log(`[WEBFIG-ADV] ❌ Advanced WebFig scraping failed for ${ip}: ${error.message}`);
    return null;
  }
}

module.exports = { fetchIdentityViaWebFigAdvanced };