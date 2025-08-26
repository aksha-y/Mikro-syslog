const { prisma } = require('../db/client');
const { RouterOSAPI } = require('./routeros-api');
const { fetchRouterIdentity } = require('./mikrotik');

class AutoIdentityFetcher {
  constructor() {
    this.isRunning = false;
    this.interval = null;
  }

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[AUTO-IDENTITY] Auto identity fetcher started - runs every 1 minute');
    
    // Run immediately on start
    this.fetchIdentities();
    
    // Then run every 1 minute (60000ms)
    this.interval = setInterval(() => {
      this.fetchIdentities();
    }, 60000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('[AUTO-IDENTITY] Auto identity fetcher stopped');
  }

  async fetchIdentities() {
    try {
      console.log('[AUTO-IDENTITY] Starting automatic identity fetch cycle...');
      
      // Get MikroTik credentials from settings
      const { getSetting } = require('../routes/settings');
      const username = await getSetting('MT_USER', '');
      const password = await getSetting('MT_PASS', '');
      const apiPort = parseInt(await getSetting('MT_API_PORT', '8728'));
      
      if (!username || !password) {
        console.log('[AUTO-IDENTITY] No MikroTik credentials configured, skipping...');
        return;
      }

      // Get all unique IPs from recent logs that don't have device entries or have null names
      const recentIps = await prisma.log.findMany({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        select: {
          deviceIp: true
        },
        distinct: ['deviceIp']
      });

      console.log(`[AUTO-IDENTITY] Found ${recentIps.length} unique IPs in recent logs`);

      // Check which IPs need identity fetching
      const ipsNeedingIdentity = [];
      
      for (const logEntry of recentIps) {
        const ip = logEntry.deviceIp;
        if (!ip) continue;

        const device = await prisma.device.findUnique({
          where: { ip },
          select: { name: true }
        });

        // If device doesn't exist or has no name, add to fetch list
        if (!device || !device.name) {
          ipsNeedingIdentity.push(ip);
        }
      }

      console.log(`[AUTO-IDENTITY] ${ipsNeedingIdentity.length} IPs need identity fetching`);

      // Fetch identities for IPs that need them (limit to 5 per cycle to avoid overload)
      const ipsToProcess = ipsNeedingIdentity.slice(0, 5);
      
      for (const ip of ipsToProcess) {
        try {
          console.log(`[AUTO-IDENTITY] Fetching identity for ${ip}...`);
          const identity = await this.fetchSingleIdentity(ip, username, password, apiPort);
          
          if (identity) {
            // Create or update device with fetched identity
            await prisma.device.upsert({
              where: { ip },
              update: { 
                name: identity, 
                source: 'auto_fetch',
                updatedAt: new Date()
              },
              create: { 
                ip, 
                name: identity, 
                source: 'auto_fetch' 
              }
            });
            
            console.log(`[AUTO-IDENTITY] ✅ Successfully fetched and stored identity for ${ip}: ${identity}`);
          } else {
            // Create device entry with null name so we know we tried
            await prisma.device.upsert({
              where: { ip },
              update: { 
                source: 'auto_fetch_failed',
                updatedAt: new Date()
              },
              create: { 
                ip, 
                name: null, 
                source: 'auto_fetch_failed' 
              }
            });
            
            console.log(`[AUTO-IDENTITY] ❌ Could not fetch identity for ${ip}`);
          }
          
          // Small delay between requests to avoid overwhelming devices
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`[AUTO-IDENTITY] Error processing ${ip}:`, error.message);
        }
      }
      
      console.log('[AUTO-IDENTITY] Identity fetch cycle completed');
      
    } catch (error) {
      console.error('[AUTO-IDENTITY] Error in fetchIdentities:', error);
    }
  }

  async fetchSingleIdentity(ip, username, password, apiPort = 8728) {
    let identity = null;

    // Try RouterOS API first
    try {
      const api = new RouterOSAPI(ip, apiPort);
      await api.connect(username, password, 10000); // 10 second timeout
      
      // Run /system identity print command
      const response = await api.sendCommand(['/system/identity/print']);
      api.disconnect();
      
      if (response.length > 0 && response[0]['=name']) {
        identity = response[0]['=name'];
        console.log(`[AUTO-IDENTITY] RouterOS API success for ${ip}: ${identity}`);
        return identity;
      }
    } catch (apiError) {
      console.log(`[AUTO-IDENTITY] RouterOS API failed for ${ip}: ${apiError.message}`);
    }

    // Fallback to REST API
    try {
      identity = await fetchRouterIdentity(ip, username, password, apiPort);
      if (identity) {
        console.log(`[AUTO-IDENTITY] REST API success for ${ip}: ${identity}`);
        return identity;
      }
    } catch (restError) {
      console.log(`[AUTO-IDENTITY] REST API failed for ${ip}: ${restError.message}`);
    }

    return null;
  }
}

// Export singleton instance
const autoIdentityFetcher = new AutoIdentityFetcher();
module.exports = { autoIdentityFetcher };