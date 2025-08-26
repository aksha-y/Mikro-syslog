const dgram = require('dgram');
const { prisma } = require('../db/client');
const { evaluateAndNotify } = require('../services/alerts');
const { parseSeverity, parseIdentity } = require('./parse');
const { discoverDeviceIdentity } = require('../services/deviceDiscovery');

// Using shared parseSeverity from ./parse

function createSyslogServer({ host, port, io }) {
  const server = dgram.createSocket('udp4');

  server.on('message', async (msg, rinfo) => {
    const raw = msg.toString('utf8');
    const deviceIp = rinfo.address; // transport-level IP
    const severity = parseSeverity(raw);

    // Try to parse device-provided identity (hostname/app) from RFC3164/5424
    // RFC3164: "<PRI>MMM dd hh:mm:ss HOSTNAME TAG[PID]: message"
    // RFC5424: "<PRI>VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID - MSG"
    function parseIdentity(s) {
      // Strip leading <PRI>
      const s2 = s.replace(/^<\d+>\d?\s*/, '');

      // 1) MikroTik pattern: "system,info <identity>: <message>" or "<facility>,<severity> <identity>: ..."
      // Example in your screenshot: "system,info bluegrey: user ..."
      const mk = s2.match(/^[^\s]+\s+([^:]+):/); // grab token before first colon after facility/severity
      if (mk) {
        const token = mk[1].trim();
        // token may contain identity or additional tags; pick last space-separated part if contains comma(s)
        // e.g., "system,info bluegrey" -> take last word "bluegrey"
        const parts = token.split(/\s+/);
        const last = parts[parts.length - 1];
        if (last && last.length <= 128) return last;
      }

      // 2) RFC5424 pattern
      const rfc5424 = s2.match(/^[^\s]+\s+[^\s]+\s+([^\s]+)\s+([^\s]+)\s+/);
      if (rfc5424) {
        const hostname = rfc5424[1];
        const appname = rfc5424[2];
        if (hostname && hostname !== '-') return `${hostname}${appname && appname !== '-' ? `/${appname}` : ''}`;
      }
      // 3) RFC3164 pattern: after timestamp comes hostname
      const rfc3164 = s.match(/^<\d+>?\s*[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+([^\s:]+)\s+/);
      if (rfc3164) return rfc3164[1];
      // 4) Fallback: look for hostname before colon
      const colon = s.split(':')[0];
      if (colon && colon.length < 128 && /[A-Za-z0-9_.-]/.test(colon)) return colon.trim();
      return null;
    }

    const deviceIdentity = parseIdentity(raw);

    try {
      // Check if device exists and get its identity
      let existingDevice = await prisma.device.findUnique({
        where: { ip: deviceIp },
        select: { name: true }
      });

      let finalIdentity = deviceIdentity; // Start with parsed identity from message

      // If device doesn't exist, create it with blank identity
      if (!existingDevice) {
        console.log(`New device detected: ${deviceIp} - creating device entry`);
        await prisma.device.create({
          data: {
            ip: deviceIp,
            name: null, // Will be blank until manually fetched
            source: 'syslog_auto'
          }
        });
        existingDevice = { name: null };
      }

      // Use stored device identity if available, otherwise use parsed identity
      if (existingDevice.name) {
        finalIdentity = existingDevice.name;
      } else {
        finalIdentity = deviceIdentity; // Use parsed identity from syslog message
      }

      const log = await prisma.log.create({
        data: {
          deviceIp,
          deviceIdentity: finalIdentity,
          severity,
          message: raw,
          source: `udp:${port}`
        }
      });

      io.emit('log:new', {
        id: log.id,
        timestamp: log.timestamp,
        deviceIp: log.deviceIp,
        deviceIdentity: log.deviceIdentity,
        severity: log.severity,
        message: log.message,
        source: log.source,
      });

      // Alerts
      evaluateAndNotify(log).catch(() => {});
    } catch (err) {
      console.error('Error processing syslog message:', err);
    }
  });

  server.on('error', (err) => {
    console.error('Syslog server error:', err);
    server.close();
  });

  server.bind(port, host, () => {
    console.log(`Syslog UDP server listening on ${host}:${port}`);
  });

  return server;
}

module.exports = { createSyslogServer };