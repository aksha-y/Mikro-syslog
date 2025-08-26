// Shared parsing utilities for syslog messages

// Parse RFC3164/5424-ish severity if present; fallback to UNKNOWN
function parseSeverity(message) {
  const sevMap = {
    0: 'EMERGENCY', 1: 'ALERT', 2: 'CRITICAL', 3: 'ERROR', 4: 'WARNING', 5: 'NOTICE', 6: 'INFO', 7: 'DEBUG'
  };
  // Try <PRI> header
  const m = String(message || '').match(/^<(\d+)>/);
  if (m) {
    const pri = Number(m[1]);
    const sev = pri % 8;
    return sevMap[sev] || 'UNKNOWN';
  }
  // Try textual tags
  const tags = ['EMERGENCY','ALERT','CRITICAL','ERROR','WARNING','NOTICE','INFO','DEBUG'];
  const upper = String(message || '').toUpperCase();
  for (const tag of tags) {
    if (upper.includes(tag)) return tag;
  }
  return 'UNKNOWN';
}

// Parse device-provided identity (hostname/app or MikroTik identity)
function parseIdentity(s) {
  const str = String(s || '');
  // Strip leading <PRI>
  const s2 = str.replace(/^<\d+>\d?\s*/, '');

  // MikroTik pattern: "system,info <identity>: <message>" or "<facility>,<severity> <identity>: ..."
  // Example: "system,info bluegrey: user ..."
  const mk = s2.match(/^[^\s]+\s+([^:]+):/);
  if (mk) {
    const token = mk[1].trim();
    if (token && token.length <= 128) return token; // keep full identity, spaces allowed
  }

  // RFC5424: "<PRI>VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID - MSG"
  const rfc5424 = s2.match(/^[^\s]+\s+[^\s]+\s+([^\s]+)\s+([^\s]+)\s+/);
  if (rfc5424) {
    const hostname = rfc5424[1];
    const appname = rfc5424[2];
    if (hostname && hostname !== '-') return `${hostname}${appname && appname !== '-' ? `/${appname}` : ''}`;
  }

  // RFC3164: after timestamp comes hostname
  const rfc3164 = str.match(/^<\d+>?\s*[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+([^\s:]+)\s+/);
  if (rfc3164) return rfc3164[1];

  // Fallback: look for hostname before colon
  const colon = str.split(':')[0];
  if (colon && colon.length < 128 && /[A-Za-z0-9_.-]/.test(colon)) return colon.trim();
  return null;
}

module.exports = { parseSeverity, parseIdentity };