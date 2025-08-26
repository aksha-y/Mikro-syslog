const { fetchIdentityLog, errorLog } = require('../utils/logger');
const { RouterOSAPI } = require('./routeros-api');
const { prisma } = require('../db/client');
const { getSetting } = require('../routes/settings');

// Simple auto-fix runner: if repeated failures occur for the same IP, try alternative strategies
async function runAutoFix(ip) {
  try {
    const username = await getSetting('MT_USER', 'Akshay');
    const password = await getSetting('MT_PASS', 'Insta@123#');
    const apiPort = parseInt(await getSetting('MT_API_PORT', '20786'));
    const ports = [20786, apiPort, 8728, 8729].filter(p => Number.isFinite(p));

    // If device has no record yet, skip DB write errors
    let identity = null;
    for (const port of ports) {
      try {
        const api = new RouterOSAPI(ip, port);
        await api.connect(username, password, 12000);
        const resp = await api.sendCommand(['/system/identity/print']);
        api.disconnect();
        if (Array.isArray(resp) && resp[0] && (resp[0]['=name'] || resp[0].name)) {
          identity = resp[0]['=name'] || resp[0].name;
          fetchIdentityLog({ stage: 'autofix-success', ip, port, identity });
          break;
        }
      } catch (e) {
        fetchIdentityLog({ stage: 'autofix-attempt-failed', ip, port, error: e.message });
      }
    }

    if (identity) {
      await prisma.device.upsert({
        where: { ip },
        update: { name: identity, source: 'auto_fixer', updatedAt: new Date() },
        create: { ip, name: identity, source: 'auto_fixer' }
      });
      return { ok: true, identity };
    }
    return { ok: false };
  } catch (err) {
    errorLog({ scope: 'autoFix', ip, error: err.message });
    return { ok: false };
  }
}

module.exports = { runAutoFix };