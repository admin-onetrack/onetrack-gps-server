# Teltonika GPS Tracker - Session Notes

## Laitteet

| Laite | IMEI | Tyyppi | Käyttö |
|-------|------|--------|--------|
| **TAT240** | 864454072389962 | Asset tracker | Tamper detection, akkukäyttöinen |
| **FMC800** | 864454074065750 | Vehicle OBD tracker | Kaivoskäyttö, OBD-data |

---

## Railway Deployment

| Asia | Arvo |
|------|------|
| Projekti | incredible-youthfulness |
| Palvelu | onetrack-gps-server |
| URL | `onetrack-gps-server-production.up.railway.app` |
| GitHub repo | `admin-onetrack/onetrack-gps-server` |
| Branch | `main` |
| TCP Port | 5027 (Teltonika-laitteet) |
| HTTP Port | 3000 (Dashboard & API) |

---

## Muutosten Workflow

```bash
cd /Users/simopahkamaa/Downloads/pythonkoulutus/teltonika

# 1. Muokkaa tiedostoja

# 2. Commit
git add .
git commit -m "Kuvaus muutoksesta"

# 3. Push - Railway deployaa automaattisesti
git push origin main
```

---

## Tärkeät AVL ID:t

### TAT240 (Tamper Detection)
| AVL ID | Nimi | Arvot |
|--------|------|-------|
| 20019 | Tamper | 0,3=HÄLYTYS / 1,2=OK |
| 520 | Tamper Alarm | 0=OK, 1=HÄLYTYS |
| 67 | Battery Voltage | mV (÷1000 = V) |
| 240 | Movement | 0=Still, 1=Moving |

### FMC800 (OBD Vehicle Tracker)
| AVL ID | Nimi | Arvot |
|--------|------|-------|
| 239 | Ignition | 0=OFF, 1=ON |
| 16 | Total Odometer | m (÷1000 = km) |
| 199 | Trip Odometer | m |
| 37 | OBD Speed | km/h |
| 36 | Engine RPM | rpm |
| 32 | Coolant Temp | °C |
| 48 | Fuel Level | % |
| 66 | External Voltage | mV (auton akku) |

---

## Kaivoskäyttö (FMC800)

### Haasteet:
- Ei GPS-signaalia maan alla
- Ei GPRS-signaalia maan alla

### Ratkaisu:
1. **OBD-pohjainen odometer** - Laskee matkan OBD-nopeudesta
2. **Offline-tallennus** - Laite tallentaa dataa muistiin (128k recordia)
3. **Synkronointi** - Kun GPRS saatavilla (pinnalla), lähettää kaiken datan

### Konfigurointi OBD-odometerille:
```
SMS: login password setparam 134:1    # Odometer source = OBD
SMS: login password setparam 810:1000 # OBD read every 1 sec
SMS: login password setparam 1003:1   # Store offline data
```

---

## Teltonika Konfigurointi

### Palvelinasetukset:
```
Server: onetrack-gps-server-production.up.railway.app
Port: 5027 (Railway TCP port)
Protocol: TCP
```

### TAT240 Tamper SMS-komennot:
```
login password setparam 290:1    # Enable tamper
login password setparam 291:15   # All tamper events
login password setparam 292:1    # Event mode
login password setparam 293:2    # Recovery = On metal
login password cpureset
```

### FMC800 OBD SMS-komennot:
```
login password setparam 133:1    # Enable trip odometer
login password setparam 134:1    # Odometer source = OBD
login password setparam 810:1000 # OBD read every 1 sec
login password cpureset
```

---

## API Endpoints

| Endpoint | Kuvaus |
|----------|--------|
| `GET /api/devices` | Kaikki laitteet |
| `GET /api/devices/:imei` | Yksittäinen laite |
| `GET /api/devices/:imei/records?limit=100` | Laitehistoria |
| `GET /api/devices/:imei/latest` | Uusin record |
| `GET /api/positions` | Kaikki uusimmat sijainnit |
| `GET /health` | Health check |

---

## WebSocket

```javascript
const ws = new WebSocket('wss://onetrack-gps-server-production.up.railway.app/ws');

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  // msg.type: 'init', 'device_connected', 'new_records'
};
```

---

## Tiedostorakenne

```
teltonika/
├── src/
│   ├── server.js        # Express + WebSocket + TCP
│   ├── tcpServer.js     # Teltonika TCP-protokolla
│   ├── codec8Parser.js  # Codec 8/8E parser + AVL IDs
│   └── dataStore.js     # In-memory data store
├── public/
│   └── index.html       # Dashboard (Leaflet map)
├── package.json
├── railway.json
└── .env.example
```

---

## Tiedossa olevat ongelmat

| Ongelma | Tila | Ratkaisu |
|---------|------|----------|
| TAT240 tamper ei tule | ⚠️ | SMS: setparam 290-293 |
| FMC800 trip odometer puuttuu | ⚠️ | SMS: setparam 133:1 |
| FMC800 OBD speed puuttuu | ⚠️ | SMS: setparam 134:1 |

---

## Seuraavat askeleet

1. [ ] Lähetä SMS-komennot TAT240:lle (tamper)
2. [ ] Lähetä SMS-komennot FMC800:lle (OBD odometer)
3. [ ] Testaa tamper poistamalla keskuskappale
4. [ ] Testaa OBD käynnistämällä auto
5. [ ] Integroi OneTrack PHP-järjestelmään (webhook)

---

## Hyödyllisiä komentoja

```bash
# Tarkista Railway-lokit
# → Railway Dashboard → Deploy Logs

# Lokaali kehitys
cd /Users/simopahkamaa/Downloads/pythonkoulutus/teltonika
npm install
npm start

# Dashboard: http://localhost:3000
# TCP: port 5027

# Git status
git status
git log --oneline -5
```

---

## Yhteystiedot / Linkit

- Railway: https://railway.app
- GitHub: https://github.com/admin-onetrack/onetrack-gps-server
- Teltonika Wiki: https://wiki.teltonika-gps.com
- TAT240 Params: https://wiki.teltonika-gps.com/view/TAT240_Parameter_list
- FMC800 Params: https://wiki.teltonika-gps.com/view/FMC800_Teltonika_Data_Sending_Parameters_ID
