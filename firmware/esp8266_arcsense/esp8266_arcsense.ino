/*
  ArcSense - ESP8266 NodeMCU Bridge & Hardware-in-the-Loop Simulator (LED edition)
  -------------------------------------------------------------------------------
  Hardware:
    * ESP8266 (NodeMCU v2/v3 / Wemos D1 Mini)
    * I2C 1602 LCD   : SDA -> D2 (GPIO4), SCL -> D1 (GPIO5), VCC -> 3V3 (or VIN), GND -> G
    * Relay IN1      : D5 (GPIO14) -> Relay IN1 (active-LOW: coil ON = live, OFF = tripped)
    * Green LED      : D7 (GPIO13) -> 220R -> LED -> G
    * Yellow LED     : D6 (GPIO12) -> 220R -> LED -> G
    * Red LED        : D0 (GPIO16) -> 220R -> LED -> G

  No relay and no buzzer in this version. The "relay" / "tripped" state is still
  tracked in software and reported over the API, so the dashboard keeps working.

  LED behavior:
    NORMAL  : green solid
    WATCH   : yellow solid
    WARNING : yellow blinking
    TRIP    : red solid

  Features:
    * Dynamic physics & telemetry simulation engine running in firmware
    * Live waveform synthesis that mutates with fault injection (Arc, Overload, Bad Joint)
    * Virtual trip latch (reported as relay open when tripped)
    * 1602 LCD dashboard: live telemetry, graphical risk bar, heating forecast,
      network + link pages, and a blinking TRIP screen that names the cause.
      Frame-buffered, so only changed lines are redrawn (no flicker).
    * Serial console: boot banner, state-change event log, 5 s telemetry heartbeat
    * Status LEDs that follow the firmware risk state
    * Full ArcSense REST API (/api/state, /api/wave, /api/inject, /api/reset)
*/

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <DNSServer.h>
#include <EEPROM.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <math.h>
#include <stdarg.h>
#include <string.h>

#define SDA_PIN        D2     // GPIO4
#define SCL_PIN        D1     // GPIO5

#define RELAY_PIN      D5     // GPIO14 (Trip Relay IN1, active-LOW)
#define LED_GREEN_PIN  D7     // GPIO13
#define LED_YELLOW_PIN D6     // GPIO12
#define LED_RED_PIN    D0     // GPIO16

#define EEPROM_MAGIC 0xA7

// ArcSense Risk State Enumeration (Declared at top before function prototypes)
enum ArcRiskState {
  STATE_NORMAL = 0,
  STATE_WATCH = 1,
  STATE_WARNING = 2,
  STATE_TRIP = 3
};

#define NORMAL  STATE_NORMAL
#define WATCH   STATE_WATCH
#define WARNING STATE_WARNING
#define TRIP    STATE_TRIP

typedef enum ArcRiskState ArcRiskState;
ArcRiskState state = STATE_NORMAL;

// Standalone Access Point (broadcasted by ESP - no router needed)
const char* AP_SSID = "ArcSense-ESP";
const char* AP_PASS = "arcsense123";   // min 8 chars

// Persistent Wi-Fi credentials in Flash Memory (EEPROM)
struct StoredWiFi {
  uint8_t magic;
  char ssid[33];
  char pass[65];
};

char staSSID[33] = "";
char staPASS[65] = "";

DNSServer dnsServer;

void saveCredentials(const char* s, const char* p) {
  EEPROM.begin(256);
  StoredWiFi w;
  w.magic = EEPROM_MAGIC;
  memset(w.ssid, 0, sizeof(w.ssid));
  memset(w.pass, 0, sizeof(w.pass));
  strncpy(w.ssid, s, sizeof(w.ssid) - 1);
  strncpy(w.pass, p, sizeof(w.pass) - 1);
  EEPROM.put(0, w);
  EEPROM.commit();
  EEPROM.end();
}

bool loadCredentials(char* s, char* p) {
  EEPROM.begin(256);
  StoredWiFi w;
  EEPROM.get(0, w);
  EEPROM.end();
  if (w.magic == EEPROM_MAGIC && strlen(w.ssid) > 0) {
    strncpy(s, w.ssid, 32);
    s[32] = '\0';
    strncpy(p, w.pass, 64);
    p[64] = '\0';
    return true;
  }
  return false;
}

// Thresholds
const float I_WARN = 8.0f,  I_TRIP = 12.0f;  // Amps
const float T_WARN = 60.0f, T_TRIP = 75.0f;  // deg C

// Physics & telemetry simulation state
float tObj = 32.0f;          // Joint Temperature in C
float tAmb = 28.0f;          // Ambient Temperature in C
float irms = 1.85f;          // Current in Amperes
float slopeVal = 0.0f;       // Heating slope in C/min
float diffIdxVal = 0.02f;    // Waveform difference index (0..1)
float flatFracVal = 0.06f;   // Flat shoulder fraction (0..1)
float crestVal = 1.414f;     // Crest factor
int   arcCountVal = 0;       // Arc cycles per second
int   injMode = 0;           // 0=normal, 1=arc, 2=overload, 3=joint
bool  tripped = false;       // Virtual trip latch
int   dangerHoldTicks = 0;   // Ticks in danger before trip latch

// Rolling temperature history for slope estimation (30 points, 1 Hz)
float tHist[30];
int   tHistLen = 0;

ESP8266WebServer server(80);
LiquidCrystal_I2C *lcd = nullptr;
IPAddress deviceIP;
const char* DEVICE_NAME = "ArcSense-ESP8266";
char connectedClient[17] = "";
unsigned long lastClientConnectMs = 0;
unsigned long lastClientActivityMs = 0;
const char* tripCause = "";   // Why the breaker tripped (shown on LCD + serial)

// ---------------------------------------------------------------------------
// LCD presentation layer (16x2)
//
// Screens are composed in a RAM frame buffer and flushed with line-level
// diffing, so the panel only redraws what actually changed (no flicker, far
// less I2C traffic). Custom glyphs: 0..5 = risk-bar cell filled 0..5 columns,
// 6 = Wi-Fi icon, 7 = alert bell. NOTE: glyph 0 is byte 0x00, so it must never
// travel through a C string; the frame buffer is raw bytes, which is why the
// bar is written into it directly.
// ---------------------------------------------------------------------------
#define GLYPH_BAR0   0
#define GLYPH_WIFI   6
#define GLYPH_ALERT  7
#define CH_DEG       ((char)0xDF)   // degree symbol in the HD44780 character ROM

char lcdFrame[2][16];               // what we want on the display
char lcdShadow[2][16];              // what is physically on the display
bool lcdShadowValid = false;

void lcdInvalidate() { lcdShadowValid = false; }
void lcdClearFrame() { memset(lcdFrame, ' ', sizeof(lcdFrame)); }

void lcdPut(uint8_t row, uint8_t col, const char* s) {
  while (*s && col < 16) lcdFrame[row][col++] = *s++;
}

void lcdPutCentered(uint8_t row, const char* s) {
  int len = (int)strlen(s);
  if (len > 16) len = 16;
  lcdPut(row, (uint8_t)((16 - len) / 2), s);
}

void lcdPutf(uint8_t row, uint8_t col, const char* fmt, ...) {
  char tmp[32];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(tmp, sizeof(tmp), fmt, ap);
  va_end(ap);
  lcdPut(row, col, tmp);
}

// Horizontal progress bar, `cells` characters wide, 5 steps per cell.
void lcdBar(uint8_t row, uint8_t col, uint8_t cells, float pct) {
  if (pct < 0.0f) pct = 0.0f;
  if (pct > 100.0f) pct = 100.0f;
  int filled = (int)(pct * cells * 5.0f / 100.0f + 0.5f);
  for (uint8_t i = 0; i < cells && (col + i) < 16; i++) {
    int n = filled - (int)i * 5;
    if (n < 0) n = 0;
    if (n > 5) n = 5;
    lcdFrame[row][col + i] = (char)(GLYPH_BAR0 + n);
  }
}

void lcdFlush() {
  if (!lcd) return;
  for (uint8_t r = 0; r < 2; r++) {
    if (lcdShadowValid && memcmp(lcdShadow[r], lcdFrame[r], 16) == 0) continue;
    lcd->setCursor(0, r);
    for (uint8_t c = 0; c < 16; c++) lcd->write((uint8_t)lcdFrame[r][c]);
    memcpy(lcdShadow[r], lcdFrame[r], 16);
  }
  lcdShadowValid = true;
}

// Convenience: show two plain strings (cropped / padded to 16 chars).
void lcdScreen(const char* l0, const char* l1) {
  lcdClearFrame();
  lcdPut(0, 0, l0);
  lcdPut(1, 0, l1);
  lcdFlush();
}

// Upload the custom glyphs (call once, right after lcd->init()).
void lcdLoadGlyphs() {
  if (!lcd) return;
  for (int n = 0; n <= 5; n++) {
    uint8_t mask = (n == 0) ? 0 : (uint8_t)((0x1F << (5 - n)) & 0x1F);
    uint8_t cell[8] = { 0x00, 0x1F, mask, mask, mask, mask, 0x1F, 0x00 };
    lcd->createChar(GLYPH_BAR0 + n, cell);
  }
  uint8_t wifi[8]  = { 0x00, 0x0E, 0x11, 0x04, 0x0A, 0x00, 0x04, 0x00 };
  uint8_t alert[8] = { 0x04, 0x0E, 0x0E, 0x0E, 0x1F, 0x00, 0x04, 0x00 };
  lcd->createChar(GLYPH_WIFI, wifi);
  lcd->createChar(GLYPH_ALERT, alert);
  lcd->home();
  lcdInvalidate();
}

const char* stateName(int s) {
  switch (s) {
    case STATE_NORMAL:  return "NORMAL";
    case STATE_WATCH:   return "WATCH";
    case STATE_WARNING: return "WARNING";
    case STATE_TRIP:    return "TRIP";
    default:            return "NORMAL";
  }
}

int stateToLevel(int s) {
  switch (s) {
    case STATE_NORMAL:  return 0; // RiskLevel.NORMAL
    case STATE_WATCH:   return 1; // RiskLevel.WATCH
    case STATE_WARNING: return 2; // RiskLevel.WARNING
    case STATE_TRIP:    return 3; // RiskLevel.DANGER
    default:            return 0;
  }
}

// Virtual relay: "on" (load live) whenever the trip latch is not set
bool isRelayOn() {
  return !tripped;
}

// CORS Headers for modern browser fetch requests (includes Chrome Private Network Access)
void cors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Origin, Accept, Access-Control-Request-Private-Network");
  server.sendHeader("Access-Control-Allow-Private-Network", "true");
  server.sendHeader("Cache-Control", "no-store, no-cache, must-revalidate");
}

void handleOptions() {
  cors();
  server.send(204);
}

// Compute fused risk score (0..100) and evidence scores
float calcRisk(float &sT, float &sS, float &sA, float &sL, float &ttlMin) {
  float dT = tObj - tAmb;
  if (dT < 0.0f) dT = 0.0f;

  // Thermal score
  sT = (tObj >= T_TRIP) ? 1.0f : ((tObj > T_WARN) ? (tObj - T_WARN) / (T_TRIP - T_WARN) : 0.0f);
  if (sT > 1.0f) sT = 1.0f;
  if (sT < 0.0f) sT = 0.0f;

  // Current load score
  sL = (irms >= I_TRIP) ? 1.0f : ((irms > I_WARN) ? (irms - I_WARN) / (I_TRIP - I_WARN) : (irms / (I_WARN * 2.0f)));
  if (sL > 1.0f) sL = 1.0f;
  if (sL < 0.0f) sL = 0.0f;

  // Arc evidence score
  sA = (arcCountVal > 0) ? ((float)arcCountVal / 10.0f) : 0.0f;
  if (sA > 1.0f) sA = 1.0f;

  // Slope score
  sS = (slopeVal > 0.0f) ? (slopeVal / 6.0f) : 0.0f;
  if (sS > 1.0f) sS = 1.0f;

  // Minutes to alarm (TTL)
  if (tObj >= T_TRIP) {
    ttlMin = 0.0f;
  } else if (slopeVal > 0.3f) {
    ttlMin = (T_TRIP - tObj) / slopeVal;
  } else {
    ttlMin = -1.0f;
  }

  if (state == TRIP || tripped) return 100.0f;

  // Noisy-OR evidence fusion
  float risk = 100.0f * (1.0f - (1.0f - 0.9f * sT) * (1.0f - 0.6f * sS) * (1.0f - 0.9f * sA) * (1.0f - 0.5f * sL));
  if (state == WARNING && risk < 55.0f) risk = 55.0f;
  if (state == WATCH && risk < 25.0f) risk = 25.0f;
  if (risk > 100.0f) risk = 100.0f;
  if (risk < 0.0f) risk = 0.0f;
  return risk;
}

// Status LEDs, follow the firmware risk state
void updateIndicators() {
  unsigned long now = millis();

  bool green = false, yellow = false, red = false;

  if (tripped || state == STATE_TRIP) {
    red = true;
  } else if (state == STATE_WARNING) {
    yellow = ((now / 250) % 2) == 0;          // blinking yellow
  } else if (state == STATE_WATCH) {
    yellow = true;
  } else {
    green = true;
  }

  digitalWrite(LED_GREEN_PIN,  green  ? HIGH : LOW);
  digitalWrite(LED_YELLOW_PIN, yellow ? HIGH : LOW);
  digitalWrite(LED_RED_PIN,    red    ? HIGH : LOW);
  digitalWrite(RELAY_PIN,      isRelayOn() ? LOW : HIGH); // active-LOW: coil ON when not tripped
}

// Continuous physics & dynamic fault simulation step (runs every dt seconds)
void simTick(float dt) {
  if (tripped) {
    // Tripped state: circuit considered open, zero current, gradual cooling
    irms = 0.0f;
    diffIdxVal = 0.0f;
    arcCountVal = 0;
    flatFracVal = 0.0f;
    crestVal = 0.0f;
    state = TRIP;

    // Exponential cooling towards ambient
    tObj += (tAmb + 1.5f - tObj) * (1.0f - expf(-dt / 35.0f));
    return;
  }

  float targetTemp = tAmb + 5.0f;
  float tau = 25.0f;
  float baseIrms = 1.85f;

  if (injMode == 0) {
    // Mode 0: Normal healthy operation
    targetTemp = tAmb + 5.0f;
    tau = 25.0f;
    baseIrms = 1.85f + ((float)(random(-25, 26)) / 1000.0f);
    diffIdxVal = 0.018f + ((float)(random(0, 15)) / 1000.0f);
    flatFracVal = 0.062f;
    crestVal = 1.414f + ((float)(random(-15, 16)) / 1000.0f);
    arcCountVal = 0;
  } else if (injMode == 1) {
    // Mode 1: Arc Fault - erratic random dropouts & chaotic current
    targetTemp = tAmb + 9.5f;
    tau = 18.0f;
    baseIrms = 1.95f + ((float)(random(-35, 36)) / 100.0f);
    diffIdxVal = 0.25f + ((float)(random(5, 25)) / 100.0f);
    flatFracVal = 0.18f + ((float)(random(0, 16)) / 100.0f);
    crestVal = 1.85f + ((float)(random(0, 45)) / 100.0f);
    arcCountVal = random(10, 15); // >10 triggers DANGER
  } else if (injMode == 2) {
    // Mode 2: Overload - High load current exceeding I_TRIP
    targetTemp = tAmb + 38.0f;
    tau = 30.0f;
    baseIrms = 13.5f + ((float)(random(-15, 16)) / 100.0f);
    diffIdxVal = 0.024f + ((float)(random(0, 12)) / 1000.0f);
    flatFracVal = 0.06f;
    crestVal = 1.414f;
    arcCountVal = 0;
  } else if (injMode == 3) {
    // Mode 3: Bad joint - High thermal rise towards 85C
    targetTemp = tAmb + 70.0f;
    tau = 20.0f;
    baseIrms = 2.25f + ((float)(random(-15, 16)) / 100.0f);
    diffIdxVal = 0.02f;
    flatFracVal = 0.06f;
    crestVal = 1.414f;
    arcCountVal = 0;
  }

  // Thermal Newton cooling / heating step
  tObj += (targetTemp - tObj) * (1.0f - expf(-dt / tau)) + ((float)(random(-40, 41)) / 1000.0f);
  irms = baseIrms;

  // Temperature slope estimation (1 Hz window)
  static unsigned long lastSlopeMs = 0;
  if (millis() - lastSlopeMs >= 1000) {
    lastSlopeMs = millis();
    if (tHistLen < 30) {
      tHist[tHistLen++] = tObj;
    } else {
      for (int i = 0; i < 29; i++) tHist[i] = tHist[i + 1];
      tHist[29] = tObj;
    }

    if (tHistLen >= 5) {
      float sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (int i = 0; i < tHistLen; i++) {
        sx += i; sy += tHist[i]; sxx += i * i; sxy += i * tHist[i];
      }
      float denom = (tHistLen * sxx - sx * sx);
      if (fabsf(denom) > 1e-4f) {
        slopeVal = ((tHistLen * sxy - sx * sy) / denom) * 60.0f;
      }
    }
  }

  // State machine & automatic trip latch
  if (arcCountVal >= 10 || tObj >= T_TRIP || irms >= I_TRIP) {
    state = WARNING;
    if (++dangerHoldTicks >= 3) { // sustained danger triggers the trip latch
      tripCause = (arcCountVal >= 10) ? "ARC FAULT" : (irms >= I_TRIP) ? "OVERCURRENT" : "OVERHEAT";
      tripped = true;
      state = TRIP;
    }
  } else if (arcCountVal >= 4 || tObj >= T_WARN || irms >= I_WARN) {
    dangerHoldTicks = 0;
    state = WARNING;
  } else if (arcCountVal >= 1 || tObj >= (T_WARN * 0.8f) || irms >= (I_WARN * 0.7f)) {
    dangerHoldTicks = 0;
    state = WATCH;
  } else {
    dangerHoldTicks = 0;
    state = NORMAL;
  }
}

// GET /api/state - Full telemetry payload for ArcSense React Dashboard
void handleApiState() {
  float sT = 0, sS = 0, sA = 0, sL = 0, ttlMin = -1;
  float risk = calcRisk(sT, sS, sA, sL, ttlMin);
  int level = stateToLevel(state);
  float dT = tObj - tAmb;
  if (dT < 0) dT = 0;

  char b[900];
  String curSsid = (WiFi.status() == WL_CONNECTED ? WiFi.SSID() : (strlen(staSSID) > 0 ? String(staSSID) : "ArcSense-ESP"));
  int rssiVal = (WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0);
  bool wifiConn = (WiFi.status() == WL_CONNECTED);

  if (server.hasArg("client")) {
    String cl = server.arg("client");
    if (cl.length() > 0) {
      lastClientActivityMs = millis();
      if (strcmp(connectedClient, cl.c_str()) != 0) {
        strncpy(connectedClient, cl.c_str(), sizeof(connectedClient) - 1);
        connectedClient[sizeof(connectedClient) - 1] = '\0';
        lastClientConnectMs = millis();
        Serial.printf("Client Connected: '%s'\n", connectedClient);
      }
    }
  }

  snprintf(b, sizeof(b),
    "{\"t\":%lu,\"irms\":%.2f,\"crest\":%.2f,\"diffIdx\":%.3f,\"flatFrac\":%.3f,\"arcCount\":%d,"
    "\"tObj\":%.1f,\"tAmb\":%.1f,\"dT\":%.1f,\"slope\":%.2f,\"ttlMin\":%.1f,"
    "\"sT\":%.2f,\"sS\":%.2f,\"sA\":%.2f,\"sL\":%.2f,\"risk\":%.1f,\"level\":%d,"
    "\"tripped\":%s,\"sensorFault\":false,\"inj\":%d,"
    "\"state\":\"%s\",\"i\":%.2f,\"t\":%.1f,\"relay\":%s,"
    "\"wifiSsid\":\"%s\",\"wifiRssi\":%d,\"wifiIp\":\"%s\",\"wifiConnected\":%s,\"uptimeSec\":%lu,\"freeHeap\":%u,"
    "\"deviceName\":\"%s\",\"connectedClient\":\"%s\"}",
    millis(), (tripped ? 0.0f : irms), (tripped ? 0.0f : crestVal), diffIdxVal, flatFracVal, arcCountVal,
    tObj, tAmb, dT, slopeVal, ttlMin,
    sT, sS, sA, sL, risk, level,
    tripped ? "true" : "false", injMode,
    stateName(state), (tripped ? 0.0f : irms), tObj, isRelayOn() ? "true" : "false",
    curSsid.c_str(), rssiVal, deviceIP.toString().c_str(), wifiConn ? "true" : "false", (millis() / 1000), ESP.getFreeHeap(),
    DEVICE_NAME, connectedClient
  );

  cors();
  server.send(200, "application/json", b);
}

// GET /api/ping - Ultra-fast latency healthcheck
void handleApiPing() {
  cors();
  char p[128];
  snprintf(p, sizeof(p), "{\"pong\":true,\"uptimeSec\":%lu,\"freeHeap\":%u}", (millis() / 1000), ESP.getFreeHeap());
  server.send(200, "application/json", p);
}

// ANY /api/relay?action=trip|restore - Virtual trip override (no physical relay)
void handleApiRelay() {
  cors();
  String action = server.arg("action");
  if (action == "trip") {
    tripCause = "MANUAL TRIP";
    tripped = true;
    state = TRIP;
  } else if (action == "restore") {
    tripped = false;
    state = NORMAL;
  }
  char r[128];
  snprintf(r, sizeof(r), "{\"relay\":%s,\"tripped\":%s}", isRelayOn() ? "true" : "false", tripped ? "true" : "false");
  server.send(200, "application/json", r);
}

// ANY /api/restart - Safe remote reboot
void handleApiRestart() {
  cors();
  server.send(200, "application/json", "{\"rebooting\":true}");
  delay(500);
  ESP.restart();
}

// GET /api/wave - Dynamic 96-point waveform that visibly distorts during faults
void handleApiWave() {
  String out;
  out.reserve(96 * 6 + 16);
  out += "{\"a\":[";

  if (tripped) {
    // Flat line when circuit is tripped
    for (int j = 0; j < 96; j++) {
      if (j > 0) out += ',';
      out += '0';
    }
  } else {
    float peakA = irms * 1.4142f;

    // Arc fault parameters for this mains cycle
    bool isArc = (injMode == 1);
    float shoulderCutPos = isArc ? (0.12f + (float)random(0, 30) / 100.0f) : 0.0f;
    float shoulderCutNeg = isArc ? (0.12f + (float)random(0, 30) / 100.0f) : 0.0f;
    int dropoutSample = isArc ? random(15, 80) : -1;

    for (int j = 0; j < 96; j++) {
      if (j > 0) out += ',';

      // 50Hz mains = 100 samples nominal, resampled to 96
      float theta = (2.0f * 3.14159265f * (float)j) / 96.0f;
      float sineVal = sinf(theta);
      float absSine = fabsf(sineVal);
      float sample = sineVal;

      if (isArc) {
        float cut = (sineVal >= 0) ? shoulderCutPos : shoulderCutNeg;
        if (absSine < cut) {
          sample = 0.0f; // flat shoulder deadband near zero crossing
        } else {
          float scaled = (absSine - cut) / (1.0f - cut);
          sample = (sineVal >= 0) ? scaled : -scaled;
        }

        // Random micro-dropout spark simulation
        if (j >= dropoutSample && j <= (dropoutSample + 3)) {
          sample *= 0.35f;
        }
      }

      // Add high frequency jitter (much noisier during arc fault)
      float noise = ((float)(random(-50, 51)) / 100.0f) * (isArc ? 0.35f : 0.03f);
      float finalAmps = (peakA * sample) + noise;

      int centi = (int)lroundf(finalAmps * 100.0f);
      out += centi;
    }
  }
  out += "]}";

  cors();
  server.send(200, "application/json", out);
}

// GET or POST /api/inject?mode=0..3 - Fault mode triggered from app UI
void handleApiInject() {
  if (server.hasArg("mode")) {
    int requestedMode = server.arg("mode").toInt();
    if (requestedMode < 0 || requestedMode > 3) requestedMode = 0;
    injMode = requestedMode;
    dangerHoldTicks = 0;

    if (injMode == 0) {
      tripped = false;
      state = NORMAL;
    }
  }
  cors();
  server.send(200, "text/plain", "ok");
}

// GET or POST /api/reset & /reset - Reset trip latch and restore normal
void handleReset() {
  tripped = false;
  state = NORMAL;
  injMode = 0;
  dangerHoldTicks = 0;
  tObj = 32.0f;
  slopeVal = 0.0f;
  tHistLen = 0;
  cors();
  server.send(200, "text/plain", "ok");
}

// Legacy /status endpoint
void handleStatus() {
  handleApiState();
}

// Legacy /sim?i=4.2&t=41.5
void handleSim() {
  if (server.hasArg("i")) irms = server.arg("i").toFloat();
  if (server.hasArg("t")) tObj = server.arg("t").toFloat();
  if (server.hasArg("arc")) arcCountVal = server.arg("arc").toInt();
  if (server.hasArg("slope")) slopeVal = server.arg("slope").toFloat();
  handleApiState();
}

// Captive Portal 302 Redirection (for Windows, Android, Apple devices)
void handleCaptivePortal() {
  server.sendHeader("Location", "http://192.168.4.1/wifi", true);
  server.send(302, "text/html",
    F("<!DOCTYPE html><html><head>"
      "<meta http-equiv='refresh' content='0;url=http://192.168.4.1/wifi'>"
      "<script>window.location.href='http://192.168.4.1/wifi';</script>"
      "</head><body><p>Redirecting to <a href='http://192.168.4.1/wifi'>ArcSense Wi-Fi Setup</a>...</p></body></html>"));
}

// --- Wi-Fi Setup & Captive Portal Handlers ---
void handleWifiPage() {
  int n = WiFi.scanNetworks();
  String html = F("<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>ArcSense Wi-Fi Setup</title><style>"
    "body{background:#090d16;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;margin:0;padding:20px;display:flex;justify-content:center;box-sizing:border-box;}"
    ".card{background:#131c2e;border:1px solid #1e293b;border-radius:12px;padding:24px;width:100%;max-width:400px;box-shadow:0 10px 25px rgba(0,0,0,0.6);box-sizing:border-box;}"
    "h2{color:#38bdf8;margin:0 0 8px 0;font-size:20px;display:flex;align-items:center;gap:8px;font-family:monospace;}"
    "p{font-size:13px;color:#94a3b8;margin:0 0 16px 0;line-height:1.4;}"
    ".cur{background:#090d16;border:1px solid #334155;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;font-family:monospace;}"
    "label{display:block;font-size:11px;font-weight:700;color:#94a3b8;margin:12px 0 6px 0;text-transform:uppercase;letter-spacing:0.5px;}"
    "select,input{width:100%;box-sizing:border-box;background:#090d16;border:1px solid #334155;color:#fff;padding:12px;border-radius:8px;font-size:14px;outline:none;font-family:inherit;}"
    "select:focus,input:focus{border-color:#38bdf8;}"
    "button{width:100%;background:#38bdf8;color:#090d16;font-weight:bold;border:none;padding:14px;border-radius:8px;font-size:14px;margin-top:20px;cursor:pointer;text-transform:uppercase;letter-spacing:0.5px;}"
    "button:hover{background:#7dd3fc;}"
    "</style></head><body><div class='card'>"
    "<h2>&#9889; ArcSense Wi-Fi Setup</h2>"
    "<p>Select a nearby Wi-Fi network or mobile hotspot to connect this ArcSense NodeMCU.</p>"
    "<div class='cur'>Saved SSID: <b>");
  html += staSSID;
  html += F("</b><br>Device IP: <b>");
  html += (WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : WiFi.softAPIP().toString());
  html += F("</b></div>"
    "<form action='/wifi' method='POST'>"
    "<label>Available Wi-Fi Networks:</label>"
    "<select name='ssid' id='netSelect' onchange=\"document.getElementById('cBox').style.display=(this.value=='__custom__')?'block':'none';\">");

  if (n <= 0) {
    html += F("<option value='__custom__'>No networks found (Type manually)</option>");
  } else {
    for (int i = 0; i < n; ++i) {
      String s = WiFi.SSID(i);
      if (s.length() > 0) {
        html += "<option value='" + s + "'>" + s + " (" + String(WiFi.RSSI(i)) + " dBm)</option>";
      }
    }
    html += F("<option value='__custom__'>-- Enter Other Wi-Fi Name --</option>");
  }

  html += F("</select>"
    "<div id='cBox' style='display:none;margin-top:8px;'><input type='text' name='custom_ssid' placeholder='Type Network Name'></div>"
    "<label>Wi-Fi Password:</label>"
    "<input type='password' name='pass' placeholder='Enter Wi-Fi Password' autocomplete='current-password'>"
    "<button type='submit'>Save & Connect</button>"
    "</form></div></body></html>");

  server.send(200, "text/html", html);
}

void handleWifiSubmit() {
  String ssid = server.arg("ssid");
  if (ssid == "__custom__" || ssid.length() == 0) {
    ssid = server.arg("custom_ssid");
  }
  String pass = server.arg("pass");
  ssid.trim();
  pass.trim();

  if (ssid.length() == 0) {
    server.send(400, "text/html", "<h3>Error: Wi-Fi Name cannot be empty! <a href='/wifi'>Go Back</a></h3>");
    return;
  }

  saveCredentials(ssid.c_str(), pass.c_str());
  strncpy(staSSID, ssid.c_str(), sizeof(staSSID) - 1);
  strncpy(staPASS, pass.c_str(), sizeof(staPASS) - 1);

  String resp = F("<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><style>"
    "body{background:#090d16;color:#e2e8f0;font-family:sans-serif;padding:30px;text-align:center;}"
    ".card{background:#131c2e;border:1px solid #1e293b;border-radius:12px;padding:24px;max-width:380px;margin:auto;}"
    "h3{color:#34d399;font-size:20px;margin-top:0;}"
    "p{font-size:14px;color:#94a3b8;line-height:1.5;}"
    "b{color:#fff;}"
    "</style></head><body><div class='card'>"
    "<h3>&#9989; Wi-Fi Saved to Flash!</h3>"
    "<p>Connecting to <b>");
  resp += ssid;
  resp += F("</b>...</p>"
    "<p>Look at the <b>1602 LCD display</b> on the hardware for your new IP address.</p>"
    "<p style='font-size:12px;color:#64748b;'>You can now reconnect your phone/laptop to that same Wi-Fi!</p>"
    "</div></body></html>");

  server.send(200, "text/html", resp);

  lcdScreen("Connecting WiFi", staSSID);

  WiFi.disconnect();
  delay(200);
  WiFi.begin(staSSID, staPASS);
  unsigned long startTry = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startTry < 8000) {
    delay(250);
  }
  if (WiFi.status() == WL_CONNECTED) {
    deviceIP = WiFi.localIP();
    if (lcd) {
      lcdScreen("WiFi Connected!", deviceIP.toString().c_str());
      delay(2500);
    }
  }
}

void handleApiWifiScan() {
  cors();
  int n = WiFi.scanNetworks();
  String json = "[";
  for (int i = 0; i < n; ++i) {
    if (i > 0) json += ",";
    json += "{\"ssid\":\"" + WiFi.SSID(i) + "\",\"rssi\":" + String(WiFi.RSSI(i)) + "}";
  }
  json += "]";
  server.send(200, "application/json", json);
}

void handleApiWifiSave() {
  cors();
  String ssid = server.arg("ssid");
  String pass = server.arg("pass");
  ssid.trim();
  pass.trim();
  if (ssid.length() == 0) {
    server.send(400, "application/json", "{\"error\":\"Missing ssid\"}");
    return;
  }
  saveCredentials(ssid.c_str(), pass.c_str());
  strncpy(staSSID, ssid.c_str(), sizeof(staSSID) - 1);
  strncpy(staPASS, pass.c_str(), sizeof(staPASS) - 1);
  server.send(200, "application/json", "{\"success\":true,\"message\":\"Credentials saved to flash\"}");

  lcdScreen("Connecting WiFi", staSSID);

  WiFi.disconnect();
  delay(200);
  WiFi.begin(staSSID, staPASS);
}

// I2C Scanner to find LCD address automatically
uint8_t scanI2C() {
  for (uint8_t a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) return a;
  }
  return 0;
}

// Rotating LCD dashboard. Every screen is composed in the frame buffer and
// flushed with diffing, so only lines that changed are rewritten.
//
//   TRIP  -> dedicated blinking screen with the latched cause (always on top)
//   Toast -> "App Connected" for 4 s after a client first connects
//   Else  -> 12 s cycle:  Status (5 s) | Forecast (2 s, only while heating) |
//                         Network (2.5 s) | Link (2.5 s)
void showLcd() {
  if (!lcd) return;
  unsigned long now = millis();

  static unsigned long lastBacklightMs = 0;
  if (now - lastBacklightMs > 2000) {
    lastBacklightMs = now;
    lcd->backlight();   // cheap insurance against I2C glitches / brown-outs
  }

  bool isClientActive = (lastClientActivityMs > 0 && (now - lastClientActivityMs < 6000));
  if (!isClientActive && connectedClient[0] != '\0') {
    connectedClient[0] = '\0';
  }
  bool wifiUp = (WiFi.status() == WL_CONNECTED);

  float sT, sS, sA, sL, ttl;
  float risk = calcRisk(sT, sS, sA, sL, ttl);

  lcdClearFrame();

  // ---- TRIP screen --------------------------------------------------------
  if (tripped || state == STATE_TRIP) {
    char mark = (((now / 500) % 2) == 0) ? (char)GLYPH_ALERT : ' ';
    lcdFrame[0][0]  = mark;
    lcdFrame[0][15] = mark;
    lcdPut(0, 2, "CIRCUIT TRIP");
    if (((now / 3000) % 2) == 0) lcdPutCentered(1, tripCause[0] ? tripCause : "PROTECTION");
    else                         lcdPutCentered(1, "Reset from app");
    lcdFlush();
    return;
  }

  // ---- Client-connected toast --------------------------------------------
  if (lastClientConnectMs > 0 && (now - lastClientConnectMs < 4000)) {
    lcdFrame[0][0] = (char)GLYPH_WIFI;
    lcdPut(0, 2, "App Connected");
    lcdPut(1, 0, connectedClient[0] ? connectedClient : DEVICE_NAME);
    lcdFlush();
    return;
  }

  // ---- Rotating pages -----------------------------------------------------
  unsigned long t = now % 12000;
  bool haveForecast = (state != STATE_NORMAL && ttl > 0.0f);

  if (t < 5000 || (t < 7000 && !haveForecast)) {
    // Page 1 - live status:  "I: 1.9A T: 32°C "  /  "NORMAL  ██░░░ 12%"
    lcdPutf(0, 0, "I:%4.1fA T:%3.0f%cC", irms, tObj, CH_DEG);
    if (state == STATE_WARNING && ((now / 500) % 2) == 0) lcdFrame[0][15] = (char)GLYPH_ALERT;
    else if (isClientActive)                              lcdFrame[0][15] = (char)GLYPH_WIFI;

    lcdPutf(1, 0, "%-7s", stateName(state));
    lcdBar(1, 8, 5, risk);
    int pct = (int)(risk + 0.5f);
    if (pct > 99) pct = 99;
    lcdPutf(1, 13, "%2d%%", pct);

  } else if (t < 7000) {
    // Page 2 - heating forecast (only while something is heating up)
    lcdPutf(0, 0, "Rise %+.1f%cC/min", slopeVal, CH_DEG);
    if (ttl < 10.0f) lcdPutf(1, 0, "Trip in ~%.1f min", ttl);
    else             lcdPutf(1, 0, "Trip in ~%.0f min", ttl);

  } else if (t < 9500) {
    // Page 3 - network
    IPAddress ip = wifiUp ? WiFi.localIP() : WiFi.softAPIP();
    String ipStr = ip.toString();
    if (wifiUp) {
      lcdFrame[0][0] = (char)GLYPH_WIFI;
      lcdPutf(0, 2, "%.14s", WiFi.SSID().c_str());
    } else {
      lcdPutf(0, 0, "AP:%s", AP_SSID);
    }
    lcdPut(1, 0, ipStr.c_str());

  } else {
    // Page 4 - link to the dashboard app
    if (isClientActive) {
      lcdFrame[0][0] = (char)GLYPH_WIFI;
      lcdPut(0, 2, "App Linked");
      lcdPut(1, 0, DEVICE_NAME);
    } else {
      lcdPut(0, 0, "Waiting for app");
      unsigned long s = now / 1000;
      lcdPutf(1, 0, "Up %02lu:%02lu:%02lu", s / 3600, (s / 60) % 60, s % 60);
    }
  }

  lcdFlush();
}

// ---------------------------------------------------------------------------
// Serial console: event log on every state change + a heartbeat every 5 s
// ---------------------------------------------------------------------------
void logStateChange() {
  static ArcRiskState lastLogged = STATE_NORMAL;
  if (state == lastLogged) return;

  float sT, sS, sA, sL, ttl;
  float risk = calcRisk(sT, sS, sA, sL, ttl);
  Serial.printf("[%8.1fs] STATE %-7s -> %-7s | I=%5.2fA  T=%5.1fC  arcs=%2d  risk=%3.0f%%\n",
                millis() / 1000.0f, stateName(lastLogged), stateName(state),
                irms, tObj, arcCountVal, risk);
  if (state == STATE_TRIP) {
    Serial.printf("             !! TRIPPED - cause: %s\n", tripCause[0] ? tripCause : "unknown");
  }
  lastLogged = state;
}

void logHeartbeat() {
  static unsigned long lastBeat = 0;
  if (millis() - lastBeat < 5000) return;
  lastBeat = millis();

  float sT, sS, sA, sL, ttl;
  float risk = calcRisk(sT, sS, sA, sL, ttl);
  Serial.printf("[%8.1fs] %-7s | I=%5.2fA  T=%5.1fC  slope=%+5.2fC/min  risk=%3.0f%%  %s  heap=%u\n",
                millis() / 1000.0f, stateName(state), irms, tObj, slopeVal, risk,
                (WiFi.status() == WL_CONNECTED ? "STA" : "AP "), ESP.getFreeHeap());
}

void setup() {
  Serial.begin(115200);
  Serial.println();
  Serial.println(F("=============================================="));
  Serial.println(F("  ArcSense ESP8266  |  Arc-Fault Guard"));
  Serial.println(F("  3-LED edition (green / yellow / red)"));
  Serial.printf("  Build: %s %s\n", __DATE__, __TIME__);
  Serial.println(F("=============================================="));

  // Status LEDs and Trip Relay
  pinMode(LED_GREEN_PIN, OUTPUT);
  pinMode(LED_YELLOW_PIN, OUTPUT);
  pinMode(LED_RED_PIN, OUTPUT);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(LED_GREEN_PIN, LOW);
  digitalWrite(LED_YELLOW_PIN, LOW);
  digitalWrite(LED_RED_PIN, LOW);
  digitalWrite(RELAY_PIN, LOW); // Coil energized (normal, not tripped)

  // Boot self-test: chase green -> yellow -> red, then all three together
  {
    const uint8_t chase[3] = { LED_GREEN_PIN, LED_YELLOW_PIN, LED_RED_PIN };
    for (uint8_t i = 0; i < 3; i++) {
      digitalWrite(chase[i], HIGH);
      delay(200);
      digitalWrite(chase[i], LOW);
    }
    digitalWrite(LED_GREEN_PIN, HIGH);
    digitalWrite(LED_YELLOW_PIN, HIGH);
    digitalWrite(LED_RED_PIN, HIGH);
    delay(300);
    digitalWrite(LED_GREEN_PIN, LOW);
    digitalWrite(LED_YELLOW_PIN, LOW);
    digitalWrite(LED_RED_PIN, LOW);
  }
  Serial.println(F("[boot] LED self-test done"));

  Wire.begin(SDA_PIN, SCL_PIN);
  uint8_t addr = scanI2C();
  if (addr) {
    lcd = new LiquidCrystal_I2C(addr, 16, 2);
    lcd->init();
    lcd->backlight();
    lcdLoadGlyphs();
    Serial.printf("[boot] I2C LCD found at 0x%02X\n", addr);
  } else {
    lcd = nullptr;
    Serial.println("No I2C LCD detected. Running without LCD.");
  }

  // 1. Splash screen with progress bar
  if (lcd) {
    lcdScreen("    ArcSense", "Arc-Fault Guard");
    delay(1000);
    lcdClearFrame();
    lcdPutCentered(0, "Starting up...");
    for (uint8_t i = 0; i < 16; i++) {
      lcdFrame[1][i] = (char)(GLYPH_BAR0 + 5);
      lcdFlush();
      delay(50);
    }
    delay(200);
  }

  // 2. Hardware diagnostics
  if (lcd) {
    lcdScreen("LEDs : OK", "Init hardware...");
    delay(800);
  }

  // Load saved Wi-Fi from Flash (EEPROM)
  char loadedSsid[33];
  char loadedPass[65];
  if (loadCredentials(loadedSsid, loadedPass)) {
    strncpy(staSSID, loadedSsid, sizeof(staSSID));
    strncpy(staPASS, loadedPass, sizeof(staPASS));
    Serial.printf("Loaded Wi-Fi from Flash: '%s'\n", staSSID);
  } else {
    Serial.println("No saved Wi-Fi in Flash. Provision via SoftAP at 192.168.4.1/wifi");
  }

  // Dual Wi-Fi mode: SoftAP (ArcSense-ESP) + Station (Home/Hotspot Wi-Fi)
  WiFi.mode(WIFI_AP_STA);
  WiFi.setSleepMode(WIFI_NONE_SLEEP); // Disable 802.11 DTIM modem sleep (drops ping from 1400ms to <15ms)
  WiFi.setOutputPower(20.5);          // Max RF output power for strong link
  WiFi.softAP(AP_SSID, AP_PASS);

  // Start Captive Portal DNS server (intercepts all DNS requests in AP mode)
  dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
  dnsServer.start(53, "*", WiFi.softAPIP());

  bool staConnected = false;
  if (strlen(staSSID) > 0) {
    lcdScreen("Connecting", staSSID);
    Serial.printf("Connecting to Wi-Fi '%s'...\n", staSSID);
    WiFi.begin(staSSID, staPASS);
    unsigned long startTry = millis();
    int d = 0;
    while (WiFi.status() != WL_CONNECTED && millis() - startTry < 8000) {
      delay(250);
      d++;
      if (lcd) {
        lcdClearFrame();
        lcdPut(0, 0, "Connecting");
        for (int k = 0; k < (d % 4); k++) lcdFrame[0][10 + k] = '.';   // animated dots
        lcdPut(1, 0, staSSID);
        lcdFlush();
      }
      Serial.print(".");
    }
    if (WiFi.status() == WL_CONNECTED) {
      staConnected = true;
      Serial.println();
      Serial.print("Connected to Wi-Fi! Local IP: ");
      Serial.println(WiFi.localIP());

      if (lcd) {
        lcdScreen("WiFi Connected!", staSSID);
        delay(1500);
      }
    } else {
      Serial.println("\nWi-Fi connection timed out. SoftAP Portal ready at 192.168.4.1/wifi");
      if (lcd) {
        lcdScreen("WiFi AP Mode ON", AP_SSID);
        delay(1500);
      }
    }
  } else {
    Serial.println("No saved Wi-Fi in Flash. SoftAP Portal active at 192.168.4.1/wifi");
    if (lcd) {
      lcdScreen("WiFi AP Mode ON", AP_SSID);
      delay(1500);
    }
  }

  IPAddress activeIP = staConnected ? WiFi.localIP() : WiFi.softAPIP();
  deviceIP = activeIP;

  if (lcd) {
    lcdScreen("Node IP Address:", deviceIP.toString().c_str());
    delay(2500);

    // Initial standby screen before the app connects
    lcdScreen("Ready", "Waiting for app");
    delay(1000);
  }

  Serial.println();
  Serial.print("ArcSense AP Ready! IP: ");
  Serial.println(WiFi.softAPIP());

  // Modern ArcSense App Endpoints (OPTIONS registered first for clean CORS preflight)
  server.on("/api/state", HTTP_OPTIONS, handleOptions);
  server.on("/api/state", HTTP_GET, handleApiState);
  server.on("/api/wave", HTTP_OPTIONS, handleOptions);
  server.on("/api/wave", HTTP_GET, handleApiWave);
  server.on("/api/inject", HTTP_OPTIONS, handleOptions);
  server.on("/api/inject", HTTP_ANY, handleApiInject);
  server.on("/api/reset", HTTP_OPTIONS, handleOptions);
  server.on("/api/reset", HTTP_ANY, handleReset);

  // Legacy Endpoints
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/status", HTTP_OPTIONS, handleOptions);
  server.on("/sim", HTTP_ANY, handleSim);
  server.on("/sim", HTTP_OPTIONS, handleOptions);
  server.on("/reset", HTTP_ANY, handleReset);
  server.on("/reset", HTTP_OPTIONS, handleOptions);

  // Wi-Fi Setup & Captive Portal Endpoints (Windows 10/11, Android, iOS, macOS)
  server.on("/wifi", HTTP_GET, handleWifiPage);
  server.on("/wifi", HTTP_POST, handleWifiSubmit);
  server.on("/connecttest.txt", HTTP_ANY, handleCaptivePortal);
  server.on("/redirect", HTTP_ANY, handleCaptivePortal);
  server.on("/msftconnecttest", HTTP_ANY, handleCaptivePortal);
  server.on("/ncsi.txt", HTTP_ANY, handleCaptivePortal);
  server.on("/generate_204", HTTP_ANY, handleCaptivePortal);
  server.on("/hotspot-detect.html", HTTP_ANY, handleCaptivePortal);
  server.on("/canonical.html", HTTP_ANY, handleCaptivePortal);
  server.on("/success.txt", HTTP_ANY, handleCaptivePortal);

  server.on("/api/wifi/scan", HTTP_GET, handleApiWifiScan);
  server.on("/api/wifi/scan", HTTP_OPTIONS, handleOptions);
  server.on("/api/wifi/save", HTTP_ANY, handleApiWifiSave);
  server.on("/api/wifi/save", HTTP_OPTIONS, handleOptions);

  server.on("/api/ping", HTTP_GET, handleApiPing);
  server.on("/api/ping", HTTP_OPTIONS, handleOptions);
  server.on("/api/relay", HTTP_ANY, handleApiRelay);
  server.on("/api/relay", HTTP_OPTIONS, handleOptions);
  server.on("/api/restart", HTTP_ANY, handleApiRestart);
  server.on("/api/restart", HTTP_OPTIONS, handleOptions);

  // Catch-all with CORS & captive portal redirect
  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) {
      handleOptions();
      return;
    }
    String uri = server.uri();
    if (uri.startsWith("/api/")) {
      cors();
      server.send(404, "application/json", "{\"error\":\"Not Found\"}");
      return;
    }
    handleCaptivePortal();
  });

  server.begin();
}

void loop() {
  dnsServer.processNextRequest();
  server.handleClient();

  // Run dynamic simulation tick every 200ms
  static unsigned long lastTick = 0;
  if (millis() - lastTick >= 200) {
    float dt = (millis() - lastTick) / 1000.0f;
    lastTick = millis();
    simTick(dt);
  }

  // Serial event log + heartbeat
  logStateChange();
  logHeartbeat();

  // Update LCD display every 250ms
  static unsigned long lastLcd = 0;
  if (millis() - lastLcd > 250) {
    lastLcd = millis();
    showLcd();
  }

  // Update LEDs every 20ms
  static unsigned long lastInd = 0;
  if (millis() - lastInd >= 20) {
    lastInd = millis();
    updateIndicators();
  }
}
