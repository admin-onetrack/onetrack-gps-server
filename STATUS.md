# Teltonika TAT240 Project Status

## What's Built

A complete Node.js backend server for receiving data from Teltonika TAT240 GPS tracker:

```
teltonika/
├── package.json
├── public/
│   └── index.html        # Real-time dashboard with map
└── src/
    ├── server.js         # Main entry (Express + WebSocket)
    ├── tcpServer.js      # TCP server for device connections
    ├── codec8Parser.js   # Teltonika Codec 8/8E protocol parser
    └── dataStore.js      # In-memory data storage
```

## Features Complete

- [x] TCP server for Teltonika device connections (Codec 8/8E)
- [x] IMEI authentication handshake
- [x] GPS data parsing (lat, lon, speed, altitude, satellites)
- [x] IO parameter parsing with human-readable names:
  - Battery voltage, GSM signal, Tamper detection
  - Movement, Accelerometer (X/Y/Z), GNSS status
  - Bluetooth sensors, Jamming detection, etc.
- [x] REST API endpoints
- [x] WebSocket for real-time updates
- [x] Live dashboard with OpenStreetMap

## How to Run

```bash
cd /Users/simopahkamaa/Downloads/pythonkoulutus/teltonika
HTTP_PORT=3001 npm start
```

Then open: http://localhost:3001

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| GET /api/devices | List all devices |
| GET /api/devices/:imei | Get device info |
| GET /api/devices/:imei/records | Get GPS history |
| GET /api/devices/:imei/latest | Get latest position |
| GET /api/positions | All latest positions |
| GET /api/stats | Server statistics |

## TAT240 Configuration

In Teltonika Configurator, set:
- **Server**: Your server's public IP
- **Port**: 5027
- **Protocol**: TCP

## Next Steps (TODO)

- [ ] Connect to your React application
- [ ] Add persistent storage (database)
- [ ] Deploy to a server with public IP
- [ ] Configure TAT240 device with server details
- [ ] Test with real device data

## React Integration

Your React app can consume data via:

```javascript
// REST API (polling)
fetch('http://localhost:3001/api/positions')
  .then(r => r.json())
  .then(data => console.log(data));

// WebSocket (real-time)
const ws = new WebSocket('ws://localhost:3001/ws');
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  console.log(msg.type, msg.data);
};
```
