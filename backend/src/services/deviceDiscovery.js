const { prisma } = require('../db/client');
const { fetchRouterIdentity } = require('./mikrotik');

// Cache to track recently processed IPs to avoid duplicate API calls
const recentlyProcessed = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Discovers and fetches identity for new devices
 * @param {string} deviceIp - The IP address of the device
 * @returns {Promise<string|null>} - The device identity or null
 */
async function discoverDeviceIdentity(deviceIp) {
  // Check if we've recently processed this IP
  const cacheKey = deviceIp;
  const cached = recentlyProcessed.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return cached.identity;
  }

  try {
    // Check if device already exists with identity
    const existingDevice = await prisma.device.findUnique({
      where: { ip: deviceIp },
      select: { name: true }
    });

    // If device exists and has a name (identity), return it
    if (existingDevice && existingDevice.name) {
      recentlyProcessed.set(cacheKey, { 
        identity: existingDevice.name, 
        timestamp: Date.now() 
      });
      return existingDevice.name;
    }

    // Try to fetch identity from MikroTik API
    console.log(`Discovering identity for new device: ${deviceIp}`);
    const identity = await Promise.race([
      fetchRouterIdentity(deviceIp),
      new Promise((resolve) => setTimeout(() => resolve(null), 3000)) // 3s timeout
    ]);

    if (identity) {
      // Update or create device with the fetched identity
      await prisma.device.upsert({
        where: { ip: deviceIp },
        update: { name: identity, source: 'mikrotik' },
        create: { ip: deviceIp, name: identity, source: 'mikrotik' }
      });

      console.log(`Identity discovered for ${deviceIp}: ${identity}`);
      
      // Cache the result
      recentlyProcessed.set(cacheKey, { 
        identity: identity, 
        timestamp: Date.now() 
      });

      return identity;
    } else {
      // Cache null result to avoid repeated failed attempts
      recentlyProcessed.set(cacheKey, { 
        identity: null, 
        timestamp: Date.now() 
      });
      
      // Ensure device exists even without identity
      await prisma.device.upsert({
        where: { ip: deviceIp },
        update: {},
        create: { ip: deviceIp, source: 'unknown' }
      });
    }

  } catch (error) {
    console.error(`Error discovering identity for ${deviceIp}:`, error.message);
    
    // Cache failed result
    recentlyProcessed.set(cacheKey, { 
      identity: null, 
      timestamp: Date.now() 
    });
  }

  return null;
}

/**
 * Background task to discover identities for devices without names
 */
async function backgroundIdentityDiscovery() {
  try {
    // Find devices without identity (name is null or empty)
    const devicesWithoutIdentity = await prisma.device.findMany({
      where: {
        OR: [
          { name: null },
          { name: '' }
        ]
      },
      select: { ip: true },
      take: 10 // Process 10 at a time to avoid overwhelming the system
    });

    for (const device of devicesWithoutIdentity) {
      await discoverDeviceIdentity(device.ip);
      // Small delay between requests to be nice to the network
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

  } catch (error) {
    console.error('Background identity discovery error:', error.message);
  }
}

/**
 * Start the background identity discovery service
 */
function startIdentityDiscoveryService() {
  // Run immediately
  backgroundIdentityDiscovery();
  
  // Then run every 10 minutes
  setInterval(backgroundIdentityDiscovery, 10 * 60 * 1000);
  
  console.log('Device identity discovery service started');
}

/**
 * Clear old cache entries
 */
function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of recentlyProcessed.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      recentlyProcessed.delete(key);
    }
  }
}

// Cleanup cache every 5 minutes
setInterval(cleanupCache, 5 * 60 * 1000);

module.exports = {
  discoverDeviceIdentity,
  startIdentityDiscoveryService,
  backgroundIdentityDiscovery
};