const fetch = require('node-fetch');
const { prisma } = require('../db/client');

// Always read from Settings helper (auto-decrypts when needed)
async function getCreds() {
  const { getSetting } = require('../routes/settings');
  const user = await getSetting('MT_USER', '');
  const pass = await getSetting('MT_PASS', '');
  return { user, pass };
}

async function fetchIdentityREST(ip, { user, pass }) {
  // RouterOS REST API typically at http(s)://<ip>:<port>/rest/system/identity (v7)
  const entries = await prisma.setting.findMany({ where: { key: { in: ['MT_HTTP_PORT','MT_HTTPS_PORT'] } } });
  const m = Object.fromEntries(entries.map(e=>[e.key,e.value]));
  const httpPort = m.MT_HTTP_PORT || '80';
  const httpsPort = (m.MT_HTTPS_PORT || '').trim(); // empty => disabled

  const restPaths = [
    '/rest/system/identity',
    '/rest/system/identity/print',
    '/rest/system/identity/',
  ];
  const endpoints = [];
  for (const p of restPaths) {
    endpoints.push(`http://${ip}:${httpPort}${p}`);
    if (httpsPort) endpoints.push(`https://${ip}:${httpsPort}${p}`);
  }
  
  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64'),
          'User-Agent': 'Syslog-Portal/1.0',
          'Accept': 'application/json'
        },
        signal: controller.signal,
        ...(url.startsWith('https') && { agent: new (require('https').Agent)({ rejectUnauthorized: false }) })
      });
      clearTimeout(timeoutId);
      if (!res.ok) { console.log(`MikroTik API ${url} returned HTTP ${res.status}`); continue; }
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json().catch(() => ({}));
        const identity = data.name || data.identity || (data.data && data.data.identity) || null;
        if (identity) { console.log(`Successfully fetched identity from ${url}: ${identity}`); return identity; }
      } else {
        const text = await res.text();
        const m = text.match(/"identity"\s*:\s*"([^"]+)"/i) ||
                  text.match(/identity[^>]*[>=]["']([^"'<>]+)["'<]/i) ||
                  text.match(/name[^>]*[>=]["']([^"'<>]+)["'<]/i);
        if (m && m[1]) { const identity = m[1].trim(); console.log(`Successfully parsed identity from ${url}: ${identity}`); return identity; }
      }
    } catch (error) {
      console.log(`Failed to fetch from ${url}: ${error.message}`);
      continue;
    }
  }
  return null;
}

async function fetchIdentityROS(ip, { user, pass }, port) {
  const { RouterOSAPI } = require('./routeros-api');
  const api = new RouterOSAPI(ip, port || 8728);
  
  try {
    await api.connect(user, pass, 6000); // tighter timeout to align with route budget
    const identity = await api.getSystemIdentity();
    api.disconnect();
    
    if (identity) {
      console.log(`Successfully fetched identity via RouterOS API from ${ip}:${port || 8728}: ${identity}`);
      return identity;
    }
    
    return null;
  } catch (error) {
    try { api.disconnect(); } catch {}
    console.log(`RouterOS API failed for ${ip}:${port || 8728}: ${error.message}`);
    return null;
  }
}

async function fetchRouterIdentity(ip, customUser = null, customPass = null, port = undefined) {
  let creds;
  if (customUser && customPass) {
    creds = { user: customUser, pass: customPass };
  } else {
    creds = await getCreds();
    if (!creds.user || !creds.pass) return null;
  }
  
  // Try REST first, then fallback to ROS API (using provided port if any)
  try { return await fetchIdentityREST(ip, creds); } catch (e) { /* continue */ }
  try { return await fetchIdentityROS(ip, creds, port); } catch (e) { /* continue */ }
  return null;
}

module.exports = { fetchRouterIdentity, getCreds };