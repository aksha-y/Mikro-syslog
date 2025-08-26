require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initSocketServer } = require('./sockets/io');
const { createSyslogServer } = require('./syslog/udpReceiver');
const { startRetentionJob } = require('./services/retention');
const { ensureAdminUser } = require('./services/bootstrap');
const { startIdentityDiscoveryService } = require('./services/deviceDiscovery');
const { router: settingsRouter, getSetting } = require('./routes/settings');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const logRoutes = require('./routes/logs');
const deviceRoutes = require('./routes/devices');
const alertRoutes = require('./routes/alerts');
const debugRoutes = require('./routes/debug');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/devices', deviceRoutes);
console.log('Device routes registered at /api/devices');
app.use('/api/alerts', alertRoutes);
app.use('/api/settings', settingsRouter);
app.use('/api/debug', debugRoutes);

// Debug middleware to log all API requests
app.use('/api/*', (req, res, next) => {
  console.log(`[API-DEBUG] ${req.method} ${req.originalUrl} - Route not found`);
  res.status(404).json({ error: 'API route not found', path: req.originalUrl, method: req.method });
});

// Serve built frontend from backend/public if available (single-port deploy)
const frontendBuild = path.join(__dirname, '../public');
app.use(express.static(frontendBuild));
app.get('*', (req, res) => {
  try { res.sendFile(path.join(frontendBuild, 'index.html')); } catch { res.status(404).end(); }
});

const server = http.createServer(app);
const io = initSocketServer(server, process.env.CORS_ORIGIN);

const PORT = Number(process.env.PORT || 4000);
server.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});

// Retention, bootstrap admin, and device discovery
startRetentionJob();
ensureAdminUser().catch(() => {});
startIdentityDiscoveryService();

// Start automatic identity fetcher (runs every 1 minute)
const { autoIdentityFetcher } = require('./services/autoIdentityFetcher');
autoIdentityFetcher.start();

// Syslog UDP receiver (port from settings if set)
(async () => {
  const portStr = await getSetting('SYSLOG_PORT', String(process.env.SYSLOG_PORT || 514));
  const host = await getSetting('SYSLOG_HOST', String(process.env.SYSLOG_HOST || '0.0.0.0'));
  const port = Number(portStr);
  createSyslogServer({ host, port, io });
})();