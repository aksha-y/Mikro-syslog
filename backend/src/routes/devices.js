const express = require('express');
const { prisma } = require('../db/client');
const { auth } = require('../middleware/auth');
const { discoverDeviceIdentity } = require('../services/deviceDiscovery');

const router = express.Router();

router.get('/', auth(), async (req, res) => {
  const items = await prisma.device.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(items);
});

// Fetch identity for a specific device by connecting to MikroTik and running /system identity print
// This route must come BEFORE the generic POST / route to avoid conflicts
router.post('/fetch-identity/:ip', auth(['ADMIN']), async (req, res) => {
  const { ip } = req.params;
  const { fetchIdentityLog, errorLog } = require('../utils/logger');

  // Hard cap the operation to 45 seconds total to avoid frontend hanging
  const overallBudgetMs = 45000;
  const startedAt = Date.now();
  const remaining = () => Math.max(0, overallBudgetMs - (Date.now() - startedAt));
  const withBudget = async (fn, label) => {
    const ms = Math.max(3000, Math.min(10000, remaining()));
    return await Promise.race([
      fn(),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`${label || 'Operation'} timeout (${ms}ms)`)), ms))
    ]);
  };

  try {
    console.log(`[FETCH-IDENTITY] Manual identity fetch requested for IP: ${ip}`);

    // Gather credential candidates: settings first, then known fallbacks provided by user
    const { getSetting } = require('../routes/settings');
    const settingUser = await getSetting('MT_USER', '');
    const settingPass = await getSetting('MT_PASS', '');
    const apiPortSetting = parseInt(await getSetting('MT_API_PORT', '8728'));

    // Build credentials strictly from Settings (no hardcoded fallbacks)
    const credCandidates = [];
    if (String(settingUser || '').trim() && String(settingPass || '').trim()) {
      credCandidates.push({ user: settingUser, pass: settingPass, source: 'settings' });
    }
    // If nothing configured, stop early with guidance
    if (credCandidates.length === 0) {
      fetchIdentityLog({ stage: 'no-creds', ip });
      return res.status(400).json({ success: false, message: 'MikroTik credentials are not configured in Settings', error: 'Missing MT_USER/MT_PASS' });
    }

    // Build candidate API ports strictly from settings (no hardcoded fallbacks)
    const candidateApiPorts = Array.from(new Set([
      Number.isFinite(apiPortSetting) ? apiPortSetting : 8728
    ]));

    fetchIdentityLog({ stage: 'start', ip, credCandidates: credCandidates.map(c=>({ user_preview: c.user.slice(0,2)+'***', source: c.source })), candidateApiPorts });

    let identity = null;
    let method = '';
    let usedCred = null;

    // Try each credential candidate across methods/ports while budget remains
    outer: for (const cred of credCandidates) {
      if (identity || remaining() <= 0) break;

      // 1) Native RouterOS API across candidate ports
      for (const port of candidateApiPorts) {
        if (identity || remaining() <= 0) break;
        try {
          const { RouterOSAPI } = require('../services/routeros-api');
          const api = new RouterOSAPI(ip, port);
          console.log(`Connecting to ${ip} via RouterOS API (native) on port ${port} as ${cred.user}...`);
          await withBudget(() => api.connect(cred.user, cred.pass, Math.min(6000, remaining())), 'Connect');
          const response = await withBudget(() => api.sendCommand(['/system/identity/print']), 'Command');
          api.disconnect();
          fetchIdentityLog({ stage: 'routeros-native-response', ip, port, ok: true, cred_user_preview: cred.user.slice(0,2)+'***', response_preview: Array.isArray(response) ? response.slice(0,1) : null });
          if (response.length > 0 && response[0]['=name']) {
            identity = response[0]['=name'];
            method = `RouterOS API (port ${port})`;
            usedCred = cred;
            break;
          }
        } catch (apiError) {
          try { const { RouterOSAPI } = require('../services/routeros-api'); new RouterOSAPI(ip, port).disconnect(); } catch {}
          fetchIdentityLog({ stage: 'routeros-native-error', ip, port, cred_user_preview: cred.user.slice(0,2)+'***', error: apiError.message });
        }
      }

      if (identity || remaining() <= 0) break;

      // 2) routeros-client wrapper across ports
      try {
        const { getIdentityViaRouterOSClient } = require('../services/routeros-client-wrapper');
        for (const port of candidateApiPorts) {
          if (identity || remaining() <= 0) break;
          try {
            const id2 = await withBudget(() => getIdentityViaRouterOSClient(ip, port, cred.user, cred.pass), 'routeros-client');
            fetchIdentityLog({ stage: 'routeros-client-try', ip, port, cred_user_preview: cred.user.slice(0,2)+'***', ok: !!id2 });
            if (id2) { identity = id2; method = `routeros-client (port ${port})`; usedCred = cred; break; }
          } catch (libErrInner) {
            fetchIdentityLog({ stage: 'routeros-client-error', ip, port, cred_user_preview: cred.user.slice(0,2)+'***', error: libErrInner.message });
          }
        }
      } catch (libErr) {
        fetchIdentityLog({ stage: 'routeros-client-overall-error', ip, error: libErr.message });
      }

      if (identity || remaining() <= 0) break;

      // 3) REST API attempts across ports
      try {
        const { fetchRouterIdentity } = require('../services/mikrotik');
        // Try first port, then others
        let idRest = await withBudget(() => fetchRouterIdentity(ip, cred.user, cred.pass, candidateApiPorts[0]), 'REST');
        fetchIdentityLog({ stage: 'rest-try-1', ip, port: candidateApiPorts[0], cred_user_preview: cred.user.slice(0,2)+'***', ok: !!idRest });
        if (!idRest) {
          for (const port of candidateApiPorts.slice(1)) {
            if (identity || remaining() <= 0) break;
            idRest = await withBudget(() => fetchRouterIdentity(ip, cred.user, cred.pass, port), 'REST');
            fetchIdentityLog({ stage: 'rest-try-next', ip, port, cred_user_preview: cred.user.slice(0,2)+'***', ok: !!idRest });
            if (idRest) break;
          }
        }
        if (idRest) { identity = idRest; method = 'REST API'; usedCred = cred; break; }
      } catch (restError) {
        fetchIdentityLog({ stage: 'rest-error', ip, cred_user_preview: cred.user.slice(0,2)+'***', error: restError.message });
      }

      if (identity || remaining() <= 0) break;

      // 4) WebFig
      try {
        const { fetchIdentityViaWebFigAdvanced } = require('../services/webfig-advanced');
        const idWf = await withBudget(() => fetchIdentityViaWebFigAdvanced(ip, cred.user, cred.pass), 'WebFig');
        fetchIdentityLog({ stage: 'webfig', ip, cred_user_preview: cred.user.slice(0,2)+'***', ok: !!idWf });
        if (idWf) { identity = idWf; method = 'WebFig'; usedCred = cred; break; }
      } catch (webfigError) {
        fetchIdentityLog({ stage: 'webfig-error', ip, cred_user_preview: cred.user.slice(0,2)+'***', error: webfigError.message });
      }

      if (identity || remaining() <= 0) break;

      // 5) SSH
      try {
        const { fetchIdentityViaSSH } = require('../services/ssh-identity');
        const idSsh = await withBudget(() => fetchIdentityViaSSH(ip, cred.user, cred.pass), 'SSH');
        fetchIdentityLog({ stage: 'ssh', ip, cred_user_preview: cred.user.slice(0,2)+'***', ok: !!idSsh });
        if (idSsh) { identity = idSsh; method = 'SSH'; usedCred = cred; break; }
      } catch (sshError) {
        fetchIdentityLog({ stage: 'ssh-error', ip, cred_user_preview: cred.user.slice(0,2)+'***', error: sshError.message });
      }
    }

    // Respond
    if (identity) {
      const device = await prisma.device.upsert({
        where: { ip },
        update: { name: identity, source: 'manual_fetch', updatedAt: new Date() },
        create: { ip, name: identity, source: 'manual_fetch' }
      });
      fetchIdentityLog({ stage: 'done', ip, success: true, identity, method, cred_user_preview: usedCred ? usedCred.user.slice(0,2)+'***' : undefined });
      res.json({ success: true, ip, identity, method, device, message: `Successfully fetched identity "${identity}" from ${ip} using ${method}` });
    } else {
      const timedOut = remaining() <= 0;
      fetchIdentityLog({ stage: 'done', ip, success: false, timedOut });
      try { require('../services/autoFixer').runAutoFix(ip).then(()=>{}).catch(()=>{}); } catch {}
      res.status(timedOut ? 504 : 200).json({ success: false, ip, identity: null, error: timedOut ? 'Timed out while fetching identity' : 'Could not fetch identity from MikroTik', message: timedOut ? `Timed out connecting to ${ip}. Network or firewall may be blocking API ports.` : `Failed to connect to ${ip} or fetch identity. Check if the device is reachable and credentials are correct.` });
    }

  } catch (err) {
    errorLog({ scope: 'fetch-identity', ip, error: err.message, stack: (err && err.stack) ? String(err.stack).split('\n').slice(0,3).join(' | ') : '' });
    res.status(500).json({ success: false, error: 'Identity fetch failed', detail: err.message, message: `Error occurred while fetching identity from ${ip}: ${err.message}` });
  }
});

// Test route to verify routing is working (no auth required for testing)
router.get('/test/:ip', (req, res) => {
  const { ip } = req.params;
  console.log(`[TEST] Test route called for IP: ${ip}`);
  res.json({ message: `Test successful for IP: ${ip}`, ip, timestamp: new Date().toISOString() });
});

// Create new device
router.post('/', auth(['ADMIN']), async (req, res) => {
  const { ip, name, source } = req.body;
  try {
    const device = await prisma.device.create({ data: { ip, name, source } });
    res.json(device);
  } catch (err) {
    res.status(400).json({ error: 'Device create failed', detail: String(err) });
  }
});

// Discover identities for all devices without names
router.post('/discover-all', auth(['ADMIN']), async (req, res) => {
  try {
    const devicesWithoutIdentity = await prisma.device.findMany({
      where: {
        OR: [
          { name: null },
          { name: '' }
        ]
      },
      select: { ip: true }
    });

    const results = [];
    for (const device of devicesWithoutIdentity) {
      try {
        const identity = await discoverDeviceIdentity(device.ip);
        results.push({ ip: device.ip, identity, success: !!identity });
        // Small delay to avoid overwhelming the network
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        results.push({ ip: device.ip, identity: null, success: false, error: error.message });
      }
    }

    res.json({ 
      total: devicesWithoutIdentity.length, 
      discovered: results.filter(r => r.success).length,
      results 
    });
  } catch (err) {
    res.status(500).json({ error: 'Bulk discovery failed', detail: String(err) });
  }
});

module.exports = router;