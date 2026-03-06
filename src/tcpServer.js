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
    this.connections = new Map(); // socket -> { imei, buffer }
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

    // Connection state
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

    // Timeout for inactive connections (5 minutes)
    socket.setTimeout(300000);
    socket.on('timeout', () => {
      console.log(`Connection timeout: ${clientInfo}`);
      socket.end();
    });
  }

  handleData(socket, state, data) {
    // Append to buffer
    state.buffer = Buffer.concat([state.buffer, data]);

    if (!state.authenticated) {
      // Waiting for IMEI
      this.handleImei(socket, state);
    } else {
      // Waiting for AVL data
      this.handleAvlData(socket, state);
    }
  }

  handleImei(socket, state) {
    // IMEI packet: 2 bytes length + IMEI (15 bytes)
    if (state.buffer.length < 17) {
      return; // Wait for more data
    }

    try {
      const imei = parseImei(state.buffer);

      // Validate IMEI (should be 15 digits)
      if (!/^\d{15}$/.test(imei)) {
        console.log(`Invalid IMEI: ${imei}`);
        socket.write(Buffer.from([0x00])); // Reject
        socket.end();
        return;
      }

      console.log(`Device authenticated: IMEI ${imei}`);

      state.imei = imei;
      state.authenticated = true;
      state.buffer = Buffer.alloc(0);

      // Register device
      dataStore.registerDevice(imei, {
        remoteAddress: socket.remoteAddress,
        remotePort: socket.remotePort
      });

      // Accept connection
      socket.write(Buffer.from([0x01]));
    } catch (err) {
      console.error('IMEI parse error:', err);
      socket.write(Buffer.from([0x00]));
      socket.end();
    }
  }

  handleAvlData(socket, state) {
    // Minimum AVL packet size: preamble(4) + length(4) + codec(1) + count(1) + count(1) + crc(4) = 15
    if (state.buffer.length < 15) {
      return; // Wait for more data
    }

    // Check preamble (4 zero bytes)
    if (state.buffer.readUInt32BE(0) !== 0) {
      console.log('Invalid preamble, clearing buffer');
      state.buffer = Buffer.alloc(0);
      return;
    }

    // Get data length
    const dataLength = state.buffer.readUInt32BE(4);
    const totalPacketLength = 8 + dataLength + 4; // preamble + length + data + crc

    if (state.buffer.length < totalPacketLength) {
      return; // Wait for more data
    }

    // Extract complete packet
    const packet = state.buffer.slice(0, totalPacketLength);
    state.buffer = state.buffer.slice(totalPacketLength);

    try {
      const parsed = parseAvlPacket(packet);

      console.log(`Received ${parsed.recordCount} records from IMEI ${state.imei} (${parsed.codecId})`);

      // Store records
      dataStore.addRecords(state.imei, parsed.records);

      // Log GPS data
      for (const record of parsed.records) {
        if (record.gps.valid) {
          console.log(`  GPS: ${record.gps.latitude.toFixed(6)}, ${record.gps.longitude.toFixed(6)} | Speed: ${record.gps.speed} km/h | Time: ${record.datetime}`);
        }
      }

      // Acknowledge received records
      const ack = Buffer.alloc(4);
      ack.writeUInt32BE(parsed.recordCount, 0);
      socket.write(ack);
    } catch (err) {
      console.error(`AVL parse error from IMEI ${state.imei}:`, err);
      // Send 0 to indicate failure
      socket.write(Buffer.alloc(4, 0));
    }

    // Check if more data in buffer
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
