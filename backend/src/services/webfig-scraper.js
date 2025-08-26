const fetch = require('node-fetch');

async function fetchIdentityViaWebFig(ip, username, password) {
  try {
    console.log(`[WEBFIG] Attempting to fetch identity from ${ip} via WebFig...`);
    
    // Step 1: Get the login page to extract any CSRF tokens or session info
    const loginPageResponse = await fetch(`http://${ip}/webfig/`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    if (!loginPageResponse.ok) {
      throw new Error(`Login page returned ${loginPageResponse.status}`);
    }
    
    const loginPageHtml = await loginPageResponse.text();
    
    // Step 2: Try to login (WebFig usually uses basic auth or form auth)
    // First try basic auth
    const basicAuthResponse = await fetch(`http://${ip}/webfig/`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    if (basicAuthResponse.ok) {
      console.log(`[WEBFIG] Basic auth successful for ${ip}`);
      
      // Step 3: Try to access system identity page
      const identityResponse = await fetch(`http://${ip}/webfig/system`, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      if (identityResponse.ok) {
        const identityHtml = await identityResponse.text();
        
        // Look for identity in the HTML
        const identityMatch = identityHtml.match(/name="identity"[^>]*value="([^"]+)"/i) ||
                             identityHtml.match(/Identity[^<]*<[^>]*>([^<]+)</i) ||
                             identityHtml.match(/<title>([^<]+)\s*-\s*WebFig/i);
        
        if (identityMatch && identityMatch[1]) {
          const identity = identityMatch[1].trim();
          console.log(`[WEBFIG] ✅ Identity found via WebFig: "${identity}"`);
          return identity;
        }
      }
      
      // Try alternative system pages
      const altPages = ['/webfig/system/identity', '/webfig/system.html', '/webfig/status'];
      
      for (const page of altPages) {
        try {
          const response = await fetch(`http://${ip}${page}`, {
            method: 'GET',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 5000
          });
          
          if (response.ok) {
            const html = await response.text();
            const identityMatch = html.match(/identity[^>]*[>=]["']([^"'<>]+)["'<]/i) ||
                                 html.match(/name[^>]*[>=]["']([^"'<>]+)["'<]/i);
            
            if (identityMatch && identityMatch[1] && identityMatch[1].length > 2) {
              const identity = identityMatch[1].trim();
              console.log(`[WEBFIG] ✅ Identity found in ${page}: "${identity}"`);
              return identity;
            }
          }
        } catch (error) {
          // Continue to next page
        }
      }
    }
    
    console.log(`[WEBFIG] ❌ Could not extract identity from WebFig for ${ip}`);
    return null;
    
  } catch (error) {
    console.log(`[WEBFIG] ❌ WebFig scraping failed for ${ip}: ${error.message}`);
    return null;
  }
}

module.exports = { fetchIdentityViaWebFig };