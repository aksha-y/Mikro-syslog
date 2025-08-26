const { RouterOSClient } = require('routeros-client');

async function getIdentityViaRouterOSClient(host, port, user, password) {
  const client = new RouterOSClient({ host, port, user, password, timeout: 15000 });
  try {
    await client.connect();

    // Try menu-based API first
    if (typeof client.menu === 'function') {
      const menu = client.menu('/system/identity');
      if (menu && typeof menu.get === 'function') {
        const res = await menu.get();
        if (Array.isArray(res) && res.length) {
          const identity = res[0].name || res[0].identity || res[0]['=name'];
          if (identity) return identity;
        }
      }
      if (menu && typeof menu.print === 'function') {
        const res = await menu.print();
        if (Array.isArray(res) && res.length) {
          const identity = res[0].name || res[0].identity || res[0]['=name'];
          if (identity) return identity;
        }
      }
    }

    // Fallback: raw command methods if exposed
    if (typeof client.write === 'function') {
      const res = await client.write('/system/identity/print');
      if (Array.isArray(res) && res.length) {
        const identity = res[0].name || res[0]['=name'] || res[0].identity;
        if (identity) return identity;
      }
    }

    if (typeof client.api === 'function') {
      const menu = client.api('/system/identity');
      if (menu && typeof menu.get === 'function') {
        const res = await menu.get();
        if (Array.isArray(res) && res.length) {
          const identity = res[0].name || res[0].identity || res[0]['=name'];
          if (identity) return identity;
        }
      }
    }

    return null;
  } finally {
    try { await client.close(); } catch {}
  }
}

module.exports = { getIdentityViaRouterOSClient };