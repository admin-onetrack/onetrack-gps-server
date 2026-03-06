# Teltonika GPS Tracker - Complete Handoff for Railway Deployment

## Overview
This is a Teltonika GPS tracking server that supports TAT240 (asset tracker) and FMC800 (vehicle OBD tracker) devices. It includes:
- **TCP Server** (port 5027) - Receives data from Teltonika devices using Codec 8/8E protocol
- **HTTP API** (port 3000) - REST API for accessing device data
- **WebSocket** (port 3000/ws) - Real-time updates to dashboard
- **Dashboard** - Single-page web interface with map, route tracking, alerts

## Project Structure
```
teltonika/
├── package.json
├── src/
│   ├── server.js          # Main server (Express + WebSocket)
│   ├── tcpServer.js       # TCP server for device connections
│   ├── codec8Parser.js    # Teltonika Codec 8/8E protocol parser
│   └── dataStore.js       # In-memory data storage
└── public/
    └── index.html         # Dashboard (Leaflet map, real-time updates)
```

## Railway Configuration

### railway.json
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node src/server.js",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### Environment Variables (Railway)
```
HTTP_PORT=3000
TCP_PORT=5027
```

### Important: TCP Port on Railway
Railway supports TCP ports. You need to:
1. Go to your service settings
2. Add a TCP port (5027)
3. Use the Railway-provided TCP URL for device configuration

---

## Package.json
```json
{
  "name": "teltonika-server",
  "version": "1.0.0",
  "description": "Teltonika GPS Tracking Server for TAT240 and FMC800",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.14.2"
  }
}
```

---

## Source Files

### src/server.js
```javascript
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
  tcpPort: process.env.TCP_PORT || 5027,
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
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  tcpServer.stop();
  httpServer.close();
  process.exit(0);
});

module.exports = { app, httpServer, tcpServer };
```

### src/tcpServer.js
```javascript
/**
 * TCP Server for Teltonika GPS devices
 * Handles IMEI authentication and AVL data reception
 */

const net = require('net');
const { parseImei, parseAvlPacket } = require('./codec8Parser');
const dataStore = require('./dataStore');

class TeltonikaTcpServer {
  constructor(port = 5000) {
    this.port = port;
    this.server = null;
    this.connections = new Map();
  }

  start() {
    this.server = net.createServer((socket) => {
      this.handleConnection(socket);
    });

    this.server.on('error', (err) => {
      console.error('TCP Server error:', err);
    });

    this.server.listen(this.port, () => {
      console.log(`Teltonika TCP Server listening on port ${this.port}`);
    });

    return this;
  }

  handleConnection(socket) {
    const clientInfo = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`New connection from ${clientInfo}`);

    const state = {
      imei: null,
      authenticated: false,
      buffer: Buffer.alloc(0)
    };

    this.connections.set(socket, state);

    socket.on('data', (data) => {
      this.handleData(socket, state, data);
    });

    socket.on('close', () => {
      console.log(`Connection closed: ${clientInfo}${state.imei ? ` (IMEI: ${state.imei})` : ''}`);
      this.connections.delete(socket);
    });

    socket.on('error', (err) => {
      console.error(`Socket error from ${clientInfo}:`, err.message);
      this.connections.delete(socket);
    });

    socket.setTimeout(300000);
    socket.on('timeout', () => {
      console.log(`Connection timeout: ${clientInfo}`);
      socket.end();
    });
  }

  handleData(socket, state, data) {
    state.buffer = Buffer.concat([state.buffer, data]);

    if (!state.authenticated) {
      this.handleImei(socket, state);
    } else {
      this.handleAvlData(socket, state);
    }
  }

  handleImei(socket, state) {
    if (state.buffer.length < 17) {
      return;
    }

    try {
      const imei = parseImei(state.buffer);

      if (!/^\d{15}$/.test(imei)) {
        console.log(`Invalid IMEI: ${imei}`);
        socket.write(Buffer.from([0x00]));
        socket.end();
        return;
      }

      console.log(`Device authenticated: IMEI ${imei}`);

      state.imei = imei;
      state.authenticated = true;
      state.buffer = Buffer.alloc(0);

      dataStore.registerDevice(imei, {
        remoteAddress: socket.remoteAddress,
        remotePort: socket.remotePort
      });

      socket.write(Buffer.from([0x01]));
    } catch (err) {
      console.error('IMEI parse error:', err);
      socket.write(Buffer.from([0x00]));
      socket.end();
    }
  }

  handleAvlData(socket, state) {
    if (state.buffer.length < 15) {
      return;
    }

    if (state.buffer.readUInt32BE(0) !== 0) {
      console.log('Invalid preamble, clearing buffer');
      state.buffer = Buffer.alloc(0);
      return;
    }

    const dataLength = state.buffer.readUInt32BE(4);
    const totalPacketLength = 8 + dataLength + 4;

    if (state.buffer.length < totalPacketLength) {
      return;
    }

    const packet = state.buffer.slice(0, totalPacketLength);
    state.buffer = state.buffer.slice(totalPacketLength);

    try {
      const parsed = parseAvlPacket(packet);

      console.log(`Received ${parsed.recordCount} records from IMEI ${state.imei} (${parsed.codecId})`);

      dataStore.addRecords(state.imei, parsed.records);

      for (const record of parsed.records) {
        if (record.gps.valid) {
          console.log(`  GPS: ${record.gps.latitude.toFixed(6)}, ${record.gps.longitude.toFixed(6)} | Speed: ${record.gps.speed} km/h | Time: ${record.datetime}`);
        }
      }

      const ack = Buffer.alloc(4);
      ack.writeUInt32BE(parsed.recordCount, 0);
      socket.write(ack);
    } catch (err) {
      console.error(`AVL parse error from IMEI ${state.imei}:`, err);
      socket.write(Buffer.alloc(4, 0));
    }

    if (state.buffer.length >= 15) {
      this.handleAvlData(socket, state);
    }
  }

  stop() {
    if (this.server) {
      this.server.close();
      for (const socket of this.connections.keys()) {
        socket.end();
      }
      this.connections.clear();
    }
  }

  getConnectedDevices() {
    const devices = [];
    for (const [socket, state] of this.connections) {
      if (state.authenticated) {
        devices.push({
          imei: state.imei,
          remoteAddress: socket.remoteAddress,
          remotePort: socket.remotePort
        });
      }
    }
    return devices;
  }
}

module.exports = TeltonikaTcpServer;
```

### src/dataStore.js
```javascript
/**
 * In-memory data store for device tracking data
 * Can be replaced with a database (MongoDB, PostgreSQL, etc.) later
 */

class DataStore {
  constructor() {
    this.devices = new Map();
    this.records = new Map();
    this.lastGoodPosition = new Map();
    this.maxRecordsPerDevice = 1000;
    this.listeners = [];
  }

  registerDevice(imei, socketInfo = {}) {
    const now = new Date().toISOString();

    if (!this.devices.has(imei)) {
      this.devices.set(imei, {
        imei,
        firstSeen: now,
        lastSeen: now,
        connectionCount: 1,
        ...socketInfo
      });
      this.records.set(imei, []);
    } else {
      const device = this.devices.get(imei);
      device.lastSeen = now;
      device.connectionCount += 1;
      Object.assign(device, socketInfo);
    }

    this.notifyListeners('device_connected', { imei });
    return this.devices.get(imei);
  }

  addRecords(imei, records) {
    if (!this.records.has(imei)) {
      this.records.set(imei, []);
    }

    const deviceRecords = this.records.get(imei);

    for (const record of records) {
      const hasValidGps = record.gps &&
        (record.gps.latitude !== 0 || record.gps.longitude !== 0);

      if (hasValidGps) {
        this.lastGoodPosition.set(imei, {
          latitude: record.gps.latitude,
          longitude: record.gps.longitude,
          altitude: record.gps.altitude,
          angle: record.gps.angle,
          speed: record.gps.speed,
          satellites: record.gps.satellites,
          timestamp: record.datetime
        });
      }

      const enrichedRecord = {
        ...record,
        imei,
        receivedAt: new Date().toISOString()
      };

      if (!hasValidGps && this.lastGoodPosition.has(imei)) {
        enrichedRecord.lastKnownPosition = this.lastGoodPosition.get(imei);
      }

      deviceRecords.push(enrichedRecord);
    }

    if (deviceRecords.length > this.maxRecordsPerDevice) {
      deviceRecords.splice(0, deviceRecords.length - this.maxRecordsPerDevice);
    }

    if (this.devices.has(imei)) {
      this.devices.get(imei).lastSeen = new Date().toISOString();
    }

    this.notifyListeners('new_records', { imei, records });
    return records.length;
  }

  getDevice(imei) {
    return this.devices.get(imei) || null;
  }

  getAllDevices() {
    return Array.from(this.devices.values());
  }

  getRecords(imei, limit = 100) {
    const records = this.records.get(imei) || [];
    return records.slice(-limit);
  }

  getLatestRecord(imei) {
    const records = this.records.get(imei) || [];
    return records[records.length - 1] || null;
  }

  getAllLatestRecords() {
    const latest = [];
    for (const [imei, records] of this.records) {
      if (records.length > 0) {
        latest.push(records[records.length - 1]);
      }
    }
    return latest;
  }

  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  notifyListeners(event, data) {
    for (const listener of this.listeners) {
      try {
        listener(event, data);
      } catch (e) {
        console.error('Listener error:', e);
      }
    }
  }

  getStats() {
    let totalRecords = 0;
    for (const records of this.records.values()) {
      totalRecords += records.length;
    }

    return {
      deviceCount: this.devices.size,
      totalRecords,
      devices: this.getAllDevices()
    };
  }
}

const store = new DataStore();
module.exports = store;
```

### src/codec8Parser.js
See the full file in the codebase - it contains 200+ AVL parameter definitions for TAT240 and FMC800 devices including:
- OBD II parameters (engine RPM, fuel level, coolant temp, etc.)
- GPS quality (PDOP, HDOP)
- Power (external voltage, battery)
- Network (GSM signal, operator)
- Sensors (temperature, humidity, accelerometer)
- Tamper detection (TAT240 specific)

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/stats` | Server statistics |
| GET | `/api/devices` | List all devices |
| GET | `/api/devices/:imei` | Get single device |
| GET | `/api/devices/:imei/records?limit=100` | Get device records |
| GET | `/api/devices/:imei/latest` | Get latest record |
| GET | `/api/positions` | Get all latest positions |

## WebSocket Events

Connect to `ws://host:3000/ws`

**Received events:**
- `init` - Initial state with devices and positions
- `device_connected` - New device connected
- `new_records` - New GPS/sensor records received

---

## OneTrack PHP Integration

This server includes webhook functionality to send GPS data to the OneTrack PHP API.

### Environment Variables for Railway

```
HTTP_PORT=3000
TCP_PORT=5027
WEBHOOK_URL=https://www.onetrack.fi/api/devices/gps-webhook.php
WEBHOOK_SECRET=your-secret-key-here
```

### Setup Steps

1. **Deploy to Railway**
   - Create new project from this directory
   - Add TCP port 5027 in service settings
   - Set environment variables above

2. **Run MySQL Migration**
   ```sql
   -- Run: api/migrations/add_gps_tracking.sql
   ALTER TABLE devices ADD COLUMN imei VARCHAR(15) DEFAULT NULL;
   ALTER TABLE devices ADD UNIQUE INDEX idx_devices_imei (imei);
   ```

3. **Add IMEI to Devices**
   - In OneTrack admin, add the IMEI number to each device that has GPS tracker
   - IMEI is 15 digits, found on device or in Teltonika Configurator

4. **Configure Teltonika Devices**
   - Server: `your-app.up.railway.app` (Railway TCP URL)
   - Port: External TCP port from Railway
   - Protocol: TCP

5. **Set PHP Environment Variable**
   - Add `GPS_WEBHOOK_SECRET=your-secret-key-here` to server environment

### Data Flow

```
Teltonika Device → TCP:5027 → Node.js (Railway) → HTTP POST → PHP API → MySQL
```

---

## Alternative Integration Options

### Option 1: Mount as sub-app
```javascript
const teltonikaApp = require('./teltonika/src/server').app;
mainApp.use('/teltonika', teltonikaApp);
```

### Option 2: API proxy
Just proxy requests to `/api/*` to the Teltonika service.

### Option 3: Shared data store
Replace the in-memory dataStore with a database (MongoDB, PostgreSQL) for shared access.

---

## Device Configuration

Configure Teltonika devices with:
- **Server**: Your Railway TCP URL or server IP
- **Port**: 5027 (or Railway-assigned external TCP port)
- **Protocol**: TCP

---

## Features
- Real-time GPS tracking on Leaflet map
- Route visualization with polylines
- Speed tracking and history chart
- Geofencing with alerts
- Tamper detection alerts (TAT240)
- OBD data display (FMC800)
- Trip playback
- Debug panel for raw JSON data
