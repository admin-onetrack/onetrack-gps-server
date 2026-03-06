/**
 * Teltonika GPS Tracking Server
 * - TCP server for device connections (Codec 8/8E)
 * - REST API for data access
 * - WebSocket for real-time updates
 */

const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const TeltonikaTcpServer = require('./tcpServer');
const dataStore = require('./dataStore');

// Configuration
const config = {
  httpPort: process.env.HTTP_PORT || 3000,
  tcpPort: process.env.TCP_PORT || 5027,  // Default Teltonika port
  corsOrigin: process.env.CORS_ORIGIN || '*'
};

// Express app
const app = express();
app.use(express.json());

// Serve static files (dashboard)
app.use(express.static(path.join(__dirname, '../public')));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', config.corsOrigin);
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// REST API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get server stats
app.get('/api/stats', (req, res) => {
  const stats = dataStore.getStats();
  stats.tcpConnections = tcpServer.getConnectedDevices().length;
  res.json(stats);
});

// Get all devices
app.get('/api/devices', (req, res) => {
  const devices = dataStore.getAllDevices();
  res.json(devices);
});

// Get single device
app.get('/api/devices/:imei', (req, res) => {
  const device = dataStore.getDevice(req.params.imei);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  res.json(device);
});

// Get device records
app.get('/api/devices/:imei/records', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const records = dataStore.getRecords(req.params.imei, limit);
  res.json(records);
});

// Get latest record for device
app.get('/api/devices/:imei/latest', (req, res) => {
  const record = dataStore.getLatestRecord(req.params.imei);
  if (!record) {
    return res.status(404).json({ error: 'No records found' });
  }
  res.json(record);
});

// Get all latest positions
app.get('/api/positions', (req, res) => {
  const positions = dataStore.getAllLatestRecords();
  res.json(positions);
});

// Create HTTP server
const httpServer = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ server: httpServer, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  // Send current state
  ws.send(JSON.stringify({
    type: 'init',
    data: {
      devices: dataStore.getAllDevices(),
      positions: dataStore.getAllLatestRecords()
    }
  }));

  // Subscribe to updates
  const unsubscribe = dataStore.addListener((event, data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: event, data }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    unsubscribe();
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    unsubscribe();
  });
});

// Broadcast to all WebSocket clients
function broadcast(message) {
  const data = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// Create TCP server for Teltonika devices
const tcpServer = new TeltonikaTcpServer(config.tcpPort);
tcpServer.start();

// Start HTTP server
httpServer.listen(config.httpPort, () => {
  console.log('\n--- Teltonika GPS Tracking Server ---\n');
  console.log(`Dashboard:  http://localhost:${config.httpPort}`);
  console.log(`REST API:   http://localhost:${config.httpPort}/api`);
  console.log(`WebSocket:  ws://localhost:${config.httpPort}/ws`);
  console.log(`TCP Port:   ${config.tcpPort} (for device connections)`);
  console.log('\nConfigure your TAT240:');
  console.log(`  Server: <YOUR_SERVER_IP>`);
  console.log(`  Port: ${config.tcpPort}`);
  console.log(`  Protocol: TCP\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  tcpServer.stop();
  httpServer.close();
  process.exit(0);
});

module.exports = { app, httpServer, tcpServer };
