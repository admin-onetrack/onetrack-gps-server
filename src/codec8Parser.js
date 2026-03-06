/**
 * Teltonika Codec 8 / Codec 8 Extended Parser
 * Parses binary AVL data from Teltonika GPS devices
 */

// Known AVL IO Parameter IDs for Teltonika devices (TAT240, FMC800, FMB series)
const IO_PARAMETERS = {
  // ===== DIGITAL INPUTS =====
  1: { name: 'digitalInput1', description: 'Digital Input 1' },
  2: { name: 'digitalInput2', description: 'Digital Input 2' },
  3: { name: 'digitalInput3', description: 'Digital Input 3' },
  4: { name: 'digitalInput4', description: 'Digital Input 4' },

  // ===== ANALOG INPUTS =====
  6: { name: 'analogInput2', description: 'Analog Input 2', unit: 'V' },
  9: { name: 'analogInput1', description: 'Analog Input 1', unit: 'V' },
  10: { name: 'sdStatus', description: 'SD Card Status (0=Not present, 1=Present)' },

  // ===== SIM/ICCID =====
  11: { name: 'iccid1', description: 'ICCID Part 1' },
  14: { name: 'iccid2', description: 'ICCID Part 2' },

  // ===== FUEL (GPS-based) =====
  12: { name: 'fuelUsedGps', description: 'Fuel Used (GPS calculated)', unit: 'L' },
  13: { name: 'fuelRateGps', description: 'Fuel Rate (GPS calculated)', unit: 'L/100km' },
  15: { name: 'ecoScore', description: 'Eco Driving Score' },

  // ===== ODOMETER =====
  16: { name: 'totalOdometer', description: 'Total Odometer', unit: 'm' },

  // ===== ACCELEROMETER =====
  17: { name: 'axisX', description: 'Accelerometer X-axis', unit: 'mG' },
  18: { name: 'axisY', description: 'Accelerometer Y-axis', unit: 'mG' },
  19: { name: 'axisZ', description: 'Accelerometer Z-axis', unit: 'mG' },

  // ===== GSM/NETWORK =====
  21: { name: 'gsmSignal', description: 'GSM Signal Strength (0-5)' },
  80: { name: 'dataMode', description: 'Data Mode (0=Home, 1=Roaming, 2=Unknown)' },
  205: { name: 'gsmCellId', description: 'GSM Cell ID' },
  206: { name: 'gsmAreaCode', description: 'GSM Location Area Code' },
  237: { name: 'networkType', description: 'Network Type (0=3G, 1=GSM, 2=4G/LTE)' },
  241: { name: 'activeGsmOperator', description: 'Active GSM Operator Code' },
  636: { name: 'umtsLteCellId', description: 'UMTS/LTE Cell ID' },

  // ===== SPEED =====
  24: { name: 'speed', description: 'Speed', unit: 'km/h' },
  329: { name: 'ainSpeed', description: 'Analog Input Speed', unit: 'km/h' },

  // ===== POWER =====
  66: { name: 'externalVoltage', description: 'External Voltage', unit: 'mV' },
  67: { name: 'batteryVoltage', description: 'Battery Voltage', unit: 'mV' },
  68: { name: 'batteryCurrent', description: 'Battery Current', unit: 'mA' },
  113: { name: 'batteryLevel', description: 'Battery Level', unit: '%' },

  // ===== GNSS/GPS =====
  69: { name: 'gnssStatus', description: 'GNSS Status (0=Off, 1=On no fix, 2=On with fix, 3=Sleep, 4=Deep sleep)' },
  181: { name: 'gnssPdop', description: 'GNSS PDOP (Position Dilution)', unit: '*0.1' },
  182: { name: 'gnssHdop', description: 'GNSS HDOP (Horizontal Dilution)', unit: '*0.1' },
  387: { name: 'iso6709Coords', description: 'ISO6709 Coordinates' },

  // ===== DALLAS TEMPERATURE SENSORS =====
  72: { name: 'dallasTemp1', description: 'Dallas Temperature Sensor 1', unit: '°C' },
  73: { name: 'dallasTemp2', description: 'Dallas Temperature Sensor 2', unit: '°C' },
  74: { name: 'dallasTemp3', description: 'Dallas Temperature Sensor 3', unit: '°C' },
  75: { name: 'dallasTemp4', description: 'Dallas Temperature Sensor 4', unit: '°C' },
  76: { name: 'dallasTempId1', description: 'Dallas Sensor 1 ID' },
  77: { name: 'dallasTempId2', description: 'Dallas Sensor 2 ID' },
  78: { name: 'iButtonId', description: 'iButton ID' },
  79: { name: 'dallasTempId3', description: 'Dallas Sensor 3 ID' },
  71: { name: 'dallasTempId4', description: 'Dallas Sensor 4 ID' },

  // ===== DIGITAL OUTPUTS =====
  179: { name: 'digitalOutput1', description: 'Digital Output 1 (0=Off, 1=On)' },
  180: { name: 'digitalOutput2', description: 'Digital Output 2 (0=Off, 1=On)' },
  380: { name: 'digitalOutput3', description: 'Digital Output 3 (0=Off, 1=On)' },
  381: { name: 'groundSense', description: 'Ground Sense (0=Off, 1=On)' },

  // ===== TRIP/ODOMETER =====
  199: { name: 'tripOdometer', description: 'Trip Odometer', unit: 'm' },

  // ===== SLEEP/POWER MODE =====
  200: { name: 'sleepMode', description: 'Sleep Mode (0=No, 1=GPS sleep, 2=Deep, 3=Online deep, 4=Ultra deep)' },

  // ===== RFID/IDENTIFICATION =====
  207: { name: 'rfid', description: 'RFID Transponder ID' },

  // ===== IGNITION/MOVEMENT =====
  239: { name: 'ignition', description: 'Ignition (0=Off, 1=On)' },
  240: { name: 'movement', description: 'Movement (0=No, 1=Yes)' },
  303: { name: 'instantMovement', description: 'Instant Movement' },

  // ===== EVENTS/ALARMS =====
  246: { name: 'towingDetection', description: 'Towing Detected' },
  247: { name: 'crashDetection', description: 'Crash Detected' },
  249: { name: 'jammingDetection', description: 'GSM Jamming Detected' },
  252: { name: 'unplugDetection', description: 'Device Unplugged/Tamper' },
  520: { name: 'tamperAlarm', description: 'Tamper Alarm (0=OK, 1=Tamper!)' },

  // ===== BLUETOOTH =====
  263: { name: 'btStatus', description: 'Bluetooth Status (0=Disabled, 1-4=Various states)' },
  264: { name: 'barcodeId', description: 'Barcode ID' },
  385: { name: 'bleTemp1', description: 'BLE Temperature 1', unit: '°C*0.01' },
  386: { name: 'bleTemp2', description: 'BLE Temperature 2', unit: '°C*0.01' },
  388: { name: 'bleTemp4', description: 'BLE Temperature 4', unit: '°C*0.01' },
  389: { name: 'bleBattery1', description: 'BLE Battery 1', unit: '%' },
  390: { name: 'bleBattery2', description: 'BLE Battery 2', unit: '%' },
  391: { name: 'bleBattery3', description: 'BLE Battery 3', unit: '%' },
  392: { name: 'bleBattery4', description: 'BLE Battery 4', unit: '%' },
  393: { name: 'bleHumidity1', description: 'BLE Humidity 1', unit: '%' },
  394: { name: 'bleHumidity2', description: 'BLE Humidity 2', unit: '%' },
  395: { name: 'bleHumidity3', description: 'BLE Humidity 3', unit: '%' },
  396: { name: 'bleHumidity4', description: 'BLE Humidity 4', unit: '%' },

  // ===== LLS FUEL SENSORS =====
  201: { name: 'llsFuel1', description: 'LLS Fuel Level 1', unit: 'L' },
  202: { name: 'llsFuel2', description: 'LLS Fuel Level 2', unit: 'L' },
  203: { name: 'llsFuel3', description: 'LLS Fuel Level 3', unit: 'L' },
  204: { name: 'llsFuel4', description: 'LLS Fuel Level 4', unit: 'L' },
  210: { name: 'llsTemp1', description: 'LLS Temperature 1', unit: '°C' },
  211: { name: 'llsTemp2', description: 'LLS Temperature 2', unit: '°C' },
  212: { name: 'llsTemp3', description: 'LLS Temperature 3', unit: '°C' },
  213: { name: 'llsTemp4', description: 'LLS Temperature 4', unit: '°C' },

  // ===== UL202-02 ULTRASONIC FUEL SENSOR =====
  327: { name: 'ul202FuelLevel', description: 'UL202-02 Fuel Level', unit: 'mm' },
  483: { name: 'ul202SensorStatus', description: 'UL202-02 Sensor Status' },

  // ===== OBD II PARAMETERS (FMC800 specific) =====
  30: { name: 'obdNumberDtcs', description: 'OBD Number of DTCs' },
  31: { name: 'obdEngineLoad', description: 'OBD Engine Load', unit: '%' },
  32: { name: 'obdCoolantTemp', description: 'OBD Coolant Temperature', unit: '°C' },
  33: { name: 'obdShortFuelTrim', description: 'OBD Short Term Fuel Trim', unit: '%' },
  34: { name: 'obdFuelPressure', description: 'OBD Fuel Pressure', unit: 'kPa' },
  35: { name: 'obdIntakeMap', description: 'OBD Intake MAP', unit: 'kPa' },
  36: { name: 'obdEngineRpm', description: 'OBD Engine RPM', unit: 'rpm' },
  37: { name: 'obdVehicleSpeed', description: 'OBD Vehicle Speed', unit: 'km/h' },
  38: { name: 'obdTimingAdvance', description: 'OBD Timing Advance', unit: '°' },
  39: { name: 'obdIntakeAirTemp', description: 'OBD Intake Air Temperature', unit: '°C' },
  40: { name: 'obdMafRate', description: 'OBD MAF Air Flow Rate', unit: 'g/s' },
  41: { name: 'obdThrottlePosition', description: 'OBD Throttle Position', unit: '%' },
  42: { name: 'obdRuntime', description: 'OBD Runtime Since Engine Start', unit: 's' },
  43: { name: 'obdDistanceWithMil', description: 'OBD Distance with MIL On', unit: 'km' },
  44: { name: 'obdRelFuelRailPressure', description: 'OBD Relative Fuel Rail Pressure', unit: 'kPa' },
  45: { name: 'obdDirectFuelRailPressure', description: 'OBD Direct Fuel Rail Pressure', unit: 'kPa' },
  46: { name: 'obdCommandedEgr', description: 'OBD Commanded EGR', unit: '%' },
  47: { name: 'obdEgrError', description: 'OBD EGR Error', unit: '%' },
  48: { name: 'obdFuelLevel', description: 'OBD Fuel Level', unit: '%' },
  49: { name: 'obdDistanceSinceDtcClear', description: 'OBD Distance Since DTC Cleared', unit: 'km' },
  50: { name: 'obdBarometricPressure', description: 'OBD Barometric Pressure', unit: 'kPa' },
  51: { name: 'obdControlModuleVoltage', description: 'OBD Control Module Voltage', unit: 'V' },
  52: { name: 'obdAbsoluteLoadValue', description: 'OBD Absolute Load Value', unit: '%' },
  53: { name: 'obdAmbientAirTemp', description: 'OBD Ambient Air Temperature', unit: '°C' },
  54: { name: 'obdTimeWithMil', description: 'OBD Time Run with MIL On', unit: 'min' },
  55: { name: 'obdTimeSinceDtcClear', description: 'OBD Time Since DTC Cleared', unit: 'min' },
  56: { name: 'obdAbsFuelRailPressure', description: 'OBD Absolute Fuel Rail Pressure', unit: 'kPa' },
  57: { name: 'obdHybridBatteryLife', description: 'OBD Hybrid Battery Pack Life', unit: '%' },
  58: { name: 'obdEngineOilTemp', description: 'OBD Engine Oil Temperature', unit: '°C' },
  59: { name: 'obdFuelInjectionTiming', description: 'OBD Fuel Injection Timing', unit: '°' },
  60: { name: 'obdFuelRate', description: 'OBD Fuel Rate', unit: 'L/h' },

  // ===== OBD FAULT CODES =====
  281: { name: 'obdDtcFaults', description: 'OBD Fault Codes (DTC)' },
  282: { name: 'obdOemDtc', description: 'OBD OEM Fault Codes' },

  // ===== VIN =====
  256: { name: 'vin', description: 'Vehicle VIN Number' },

  // ===== DRIVER BEHAVIOR =====
  253: { name: 'greenDrivingType', description: 'Green Driving Event Type' },
  254: { name: 'greenDrivingValue', description: 'Green Driving Event Value' },
  255: { name: 'overspeeding', description: 'Overspeeding Event' },

  // ===== EYE SENSORS (Teltonika EYE Beacon) =====
  10800: { name: 'eyeTemp1', description: 'EYE Sensor Temperature 1', unit: '°C' },
  10801: { name: 'eyeTemp2', description: 'EYE Sensor Temperature 2', unit: '°C' },
  10802: { name: 'eyeTemp3', description: 'EYE Sensor Temperature 3', unit: '°C' },
  10803: { name: 'eyeTemp4', description: 'EYE Sensor Temperature 4', unit: '°C' },
  10804: { name: 'eyeHumidity1', description: 'EYE Sensor Humidity 1', unit: '%' },
  10805: { name: 'eyeHumidity2', description: 'EYE Sensor Humidity 2', unit: '%' },
  10806: { name: 'eyeHumidity3', description: 'EYE Sensor Humidity 3', unit: '%' },
  10807: { name: 'eyeHumidity4', description: 'EYE Sensor Humidity 4', unit: '%' },
  10808: { name: 'eyeMagnet1', description: 'EYE Sensor Magnet 1' },
  10809: { name: 'eyeMagnet2', description: 'EYE Sensor Magnet 2' },
  10810: { name: 'eyeMagnet3', description: 'EYE Sensor Magnet 3' },
  10811: { name: 'eyeMagnet4', description: 'EYE Sensor Magnet 4' },
  10812: { name: 'eyeMovement1', description: 'EYE Sensor Movement 1' },
  10813: { name: 'eyeMovement2', description: 'EYE Sensor Movement 2' },
  10814: { name: 'eyeMovement3', description: 'EYE Sensor Movement 3' },
  10815: { name: 'eyeMovement4', description: 'EYE Sensor Movement 4' },
  10816: { name: 'eyePitch1', description: 'EYE Sensor Pitch 1', unit: '°' },
  10817: { name: 'eyePitch2', description: 'EYE Sensor Pitch 2', unit: '°' },
  10818: { name: 'eyePitch3', description: 'EYE Sensor Pitch 3', unit: '°' },
  10819: { name: 'eyePitch4', description: 'EYE Sensor Pitch 4', unit: '°' },

  // ===== MSP500 INTEGRATION =====
  500: { name: 'msp500CabinTemp', description: 'MSP500 Cabin Temperature', unit: '°C' },
  501: { name: 'msp500EngineTemp', description: 'MSP500 Engine Temperature', unit: '°C' },
  502: { name: 'msp500FuelLevel', description: 'MSP500 Fuel Level', unit: '%' },

  // ===== WAKE REASON =====
  637: { name: 'wakeReason', description: 'Device Wake Reason (RTC alarm, etc.)' },

  // ===== TAT240 SPECIFIC (20000+ range) =====
  20019: { name: 'tamperDetection', description: 'Tamper (0=removed, 1=central, 2=attached, 3=detached)' },
  20020: { name: 'magnetPresence', description: 'Magnet Presence' },
  20021: { name: 'bleConnectionStatus', description: 'BLE Connection Status' },
  20022: { name: 'btBeaconRssi', description: 'Bluetooth Beacon RSSI' },

  // ===== TAT240 LTE/MODEM (25000+ range) =====
  25015: { name: 'modemUptime', description: 'Modem Uptime', unit: 's' },
  25016: { name: 'lteRsrp', description: 'LTE RSRP Signal', unit: 'dBm' },
  25017: { name: 'lteRsrq', description: 'LTE RSRQ Quality', unit: 'dB' },
};

// Get human-readable IO name
function getIoName(id) {
  const param = IO_PARAMETERS[id];
  return param ? param.name : `unknown_${id}`;
}

// Get IO parameter info
function getIoInfo(id) {
  return IO_PARAMETERS[id] || { name: `unknown_${id}`, description: `Unknown parameter ${id}` };
}

class Codec8Parser {
  constructor(buffer) {
    this.buffer = buffer;
    this.offset = 0;
  }

  readUInt8() {
    const value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readUInt16() {
    const value = this.buffer.readUInt16BE(this.offset);
    this.offset += 2;
    return value;
  }

  readUInt32() {
    const value = this.buffer.readUInt32BE(this.offset);
    this.offset += 4;
    return value;
  }

  readInt32() {
    const value = this.buffer.readInt32BE(this.offset);
    this.offset += 4;
    return value;
  }

  readUInt64() {
    const high = this.buffer.readUInt32BE(this.offset);
    const low = this.buffer.readUInt32BE(this.offset + 4);
    this.offset += 8;
    return BigInt(high) * BigInt(0x100000000) + BigInt(low);
  }

  readBytes(length) {
    const bytes = this.buffer.slice(this.offset, this.offset + length);
    this.offset += length;
    return bytes;
  }

  parseIMEI(data) {
    // First 2 bytes are length, rest is IMEI as ASCII
    const length = data.readUInt16BE(0);
    const imei = data.slice(2, 2 + length).toString('ascii');
    return imei;
  }

  parseGpsElement() {
    const longitude = this.readInt32() / 10000000; // degrees
    const latitude = this.readInt32() / 10000000;  // degrees
    const altitude = this.readUInt16();            // meters
    const angle = this.readUInt16();               // degrees
    const satellites = this.readUInt8();
    const speed = this.readUInt16();               // km/h

    // GPS is valid if we have satellites AND coordinates are not 0,0
    const hasValidCoords = (latitude !== 0 || longitude !== 0);

    return {
      longitude,
      latitude,
      altitude,
      angle,
      satellites,
      speed,
      valid: satellites > 0 && hasValidCoords
    };
  }

  parseIoElement(isExtended = false) {
    const ioElements = {
      raw: {},      // Raw io_ID -> value mapping
      parsed: {}    // Human-readable name -> { value, description, unit }
    };

    // Event IO ID (which IO triggered this record)
    const eventIoId = isExtended ? this.readUInt16() : this.readUInt8();
    ioElements.eventIoId = eventIoId;
    ioElements.eventTrigger = getIoInfo(eventIoId);

    // Total IO count
    const totalCount = isExtended ? this.readUInt16() : this.readUInt8();

    // Helper to store IO element
    const storeIo = (id, value) => {
      ioElements.raw[`io_${id}`] = value;
      const info = getIoInfo(id);
      ioElements.parsed[info.name] = {
        id,
        value,
        description: info.description,
        unit: info.unit || null
      };
    };

    // 1-byte IO elements
    const count1 = isExtended ? this.readUInt16() : this.readUInt8();
    for (let i = 0; i < count1; i++) {
      const id = isExtended ? this.readUInt16() : this.readUInt8();
      const value = this.readUInt8();
      storeIo(id, value);
    }

    // 2-byte IO elements
    const count2 = isExtended ? this.readUInt16() : this.readUInt8();
    for (let i = 0; i < count2; i++) {
      const id = isExtended ? this.readUInt16() : this.readUInt8();
      const value = this.readUInt16();
      storeIo(id, value);
    }

    // 4-byte IO elements
    const count4 = isExtended ? this.readUInt16() : this.readUInt8();
    for (let i = 0; i < count4; i++) {
      const id = isExtended ? this.readUInt16() : this.readUInt8();
      const value = this.readUInt32();
      storeIo(id, value);
    }

    // 8-byte IO elements
    const count8 = isExtended ? this.readUInt16() : this.readUInt8();
    for (let i = 0; i < count8; i++) {
      const id = isExtended ? this.readUInt16() : this.readUInt8();
      const value = this.readUInt64();
      storeIo(id, Number(value));
    }

    // Variable length IO elements (Codec 8 Extended only)
    if (isExtended && this.offset < this.buffer.length - 4) {
      try {
        const countX = this.readUInt16();
        for (let i = 0; i < countX; i++) {
          const id = this.readUInt16();
          const length = this.readUInt16();
          const value = this.readBytes(length);
          storeIo(id, value.toString('hex'));
        }
      } catch (e) {
        // Variable length section might not exist
      }
    }

    return ioElements;
  }

  parseAvlRecord(isExtended = false) {
    const timestamp = Number(this.readUInt64());
    const priority = this.readUInt8();
    const gps = this.parseGpsElement();
    const io = this.parseIoElement(isExtended);

    return {
      timestamp,
      datetime: new Date(timestamp).toISOString(),
      priority,
      gps,
      io
    };
  }

  parse() {
    try {
      // Preamble (4 bytes of zeros)
      const preamble = this.readUInt32();
      if (preamble !== 0) {
        throw new Error('Invalid preamble');
      }

      // Data field length
      const dataLength = this.readUInt32();

      // Codec ID
      const codecId = this.readUInt8();
      const isExtended = codecId === 0x8E;

      if (codecId !== 0x08 && codecId !== 0x8E) {
        throw new Error(`Unsupported codec: 0x${codecId.toString(16)}`);
      }

      // Number of records
      const recordCount1 = this.readUInt8();

      // Parse AVL records
      const records = [];
      for (let i = 0; i < recordCount1; i++) {
        records.push(this.parseAvlRecord(isExtended));
      }

      // Record count at end (for validation)
      const recordCount2 = this.readUInt8();

      if (recordCount1 !== recordCount2) {
        console.warn('Record count mismatch');
      }

      // CRC-16 (last 4 bytes)
      const crc = this.readUInt32();

      return {
        codecId: codecId === 0x8E ? 'Codec8Extended' : 'Codec8',
        recordCount: recordCount1,
        records,
        crc
      };
    } catch (error) {
      throw new Error(`Parse error: ${error.message}`);
    }
  }
}

function parseImei(buffer) {
  const length = buffer.readUInt16BE(0);
  return buffer.slice(2, 2 + length).toString('ascii');
}

function parseAvlPacket(buffer) {
  const parser = new Codec8Parser(buffer);
  return parser.parse();
}

module.exports = {
  Codec8Parser,
  parseImei,
  parseAvlPacket,
  IO_PARAMETERS,
  getIoName,
  getIoInfo
};
