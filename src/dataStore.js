/**
 * In-memory data store for device tracking data
 * Includes webhook to PHP API for OneTrack integration
 */

class DataStore {
  constructor() {
    this.devices = new Map();      // IMEI -> device info
    this.records = new Map();      // IMEI -> array of GPS records
    this.lastGoodPosition = new Map(); // IMEI -> last valid GPS position
    this.maxRecordsPerDevice = 1000; // Keep last N records per device
    this.listeners = [];           // WebSocket broadcast listeners

    // Webhook configuration for OneTrack PHP API
    this.webhookUrl = process.env.WEBHOOK_URL || null;
    this.webhookSecret = process.env.WEBHOOK_SECRET || '';
  }

  // Send GPS data to PHP API
  async sendWebhook(imei, record) {
    if (!this.webhookUrl) return;

    try {
      const payload = {
        imei,
        latitude: record.gps?.latitude,
        longitude: record.gps?.longitude,
        speed: record.gps?.speed,
        altitude: record.gps?.altitude,
        angle: record.gps?.angle,
        satellites: record.gps?.satellites,
        timestamp: record.datetime,
        io: record.io || {},
        secret: this.webhookSecret
      };

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error(`Webhook failed: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      console.error('Webhook error:', err.message);
    }
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
      // Check if this record has valid GPS (not 0,0)
      const hasValidGps = record.gps &&
        (record.gps.latitude !== 0 || record.gps.longitude !== 0);

      // If valid GPS, save it as last known good position and send webhook
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

        // Send to PHP API (async, don't await)
        this.sendWebhook(imei, record);
      }

      // Add last known position to record if current GPS is invalid
      const enrichedRecord = {
        ...record,
        imei,
        receivedAt: new Date().toISOString()
      };

      // If GPS is 0,0 but we have a last known position, include it
      if (!hasValidGps && this.lastGoodPosition.has(imei)) {
        enrichedRecord.lastKnownPosition = this.lastGoodPosition.get(imei);
      }

      deviceRecords.push(enrichedRecord);
    }

    // Trim old records
    if (deviceRecords.length > this.maxRecordsPerDevice) {
      deviceRecords.splice(0, deviceRecords.length - this.maxRecordsPerDevice);
    }

    // Update device last seen
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

// Singleton instance
const store = new DataStore();
module.exports = store;
