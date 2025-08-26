const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../../logs');

function ensureLogsDir() {
  try { if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true }); } catch {}
}

function writeLog(fileName, payload) {
  try {
    ensureLogsDir();
    const line = JSON.stringify({ ts: new Date().toISOString(), ...payload }) + '\n';
    fs.appendFile(path.join(logsDir, fileName), line, () => {});
  } catch {}
}

function fetchIdentityLog(payload) {
  writeLog('fetch-identity.log', payload);
}

function errorLog(payload) {
  writeLog('server-errors.log', payload);
}

module.exports = { fetchIdentityLog, errorLog };