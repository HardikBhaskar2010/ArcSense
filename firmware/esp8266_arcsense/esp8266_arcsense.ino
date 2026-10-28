/*
  ArcSense - ESP8266 Bridge & Controller
  ---------------------------------------
  Hardware:
    * ESP8266 (NodeMCU / Wemos D1 Mini)
    * I2C 1602 LCD (SDA -> D2, SCL -> D1)
    * Relay Module on D5 (active LOW: LOW = Relay ON / Circuit LIVE)

  Full REST API Support for ArcSense Dashboard:
    * GET  /api/state   - Full JSON state & risk telemetry
    * GET  /api/wave    - 96-sample waveform in centi-Amps
    * GET  /api/inject  - Inject demo modes: 0=normal, 1=arc, 2=overload, 3=joint
    * GET  /api/reset   - Reset tripped latch and restore circuit
    * OPTIONS *         - CORS preflight for browser access
    * /status, /sim     - Backward-compatible endpoints
*/

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <math.h>

#define SDA_PIN D2
#define SCL_PIN D1
#define RELAY_PIN D5          // relay IN1, active LOW (LOW = load ON)

const char* AP_SSID = "ArcSense-ESP";
const char* AP_PASS = "arcsense123";   // min 8 chars

// Thresholds
const float I_WARN = 8.0f,  I_TRIP = 12.0f;  // Amps
const float T_WARN = 60.0f, T_TRIP = 75.0f;  // deg C
const unsigned long DATA_TIMEOUT = 10000;    // ms

enum State { NODATA, NORMAL, WATCH, WARNING, TRIP };
State state = NORMAL;

// Telemetry values
float curI = 1.85f;          // Current in Amperes
float curT = 32.0f;          // Joint Temperature in °C
float tAmb = 28.0f;          // Ambient Temperature in °C
float slopeVal = 0.0f;       // Heating slope in °C/min
float diffIdxVal = 0.02f;    // Waveform difference index (0..1)
float flatFracVal = 0.06f;   // Flat shoulder fraction (0..1)
int   arcCountVal = 0;       // Arc cycles per second
int   injMode = 0;           // 0=normal, 1=arc, 2=overload, 3=joint
unsigned long lastData = 0;

ESP8266WebServer server(80);
LiquidCrystal_I2C *lcd = nullptr;

const char* stateName(State s) {
  switch (s) {
    case NORMAL:  return "NORMAL";
    case WATCH:   return "WATCH";
    case WARNING: return "WARNING";
    case TRIP:    return "TRIP";
    default:      return "NO DATA";
  }
}

int stateToLevel(State s) {
  switch (s) {
    case NORMAL:  return 0; // RiskLevel.NORMAL
    case WATCH:   return 1; // RiskLevel.WATCH
    case WARNING: return 2; // RiskLevel.WARNING
    case TRIP:    return 3; // RiskLevel.DANGER
    default:      return 0;
  }
}

void setRelay(bool loadOn) {
  digitalWrite(RELAY_PIN, loadOn ? LOW : HIGH);
}

bool isRelayOn() {
  return digitalRead(RELAY_PIN) == LOW;
}

// Evaluate state machine and trip protection
void evaluate() {
  if (state == TRIP) return; // Latched until reset

  if (curI >= I_TRIP || curT >= T_TRIP || arcCountVal >= 10) {
    state = TRIP;
    setRelay(false); // Cut power immediately
  } else if (curI >= I_WARN || curT >= T_WARN || arcCountVal >= 4) {
    state = WARNING;
  } else if (curI >= (I_WARN * 0.7f) || curT >= (T_WARN * 0.8f) || arcCountVal >= 1) {
    state = WATCH;
  } else {
    state = NORMAL;
  }
}

// CORS Headers for modern browser fetch requests
void cors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Origin, Accept");
  server.sendHeader("Cache-Control", "no-store, no-cache, must-revalidate");
}

void handleOptions() {
  cors();
  server.send(204);
}

// Compute fused risk score (0..100) and evidence scores
float calcRisk(float &sT, float &sS, float &sA, float &sL, float &ttlMin) {
  float dT = curT - tAmb;
  if (dT < 0.0f) dT = 0.0f;

  // Thermal score
  sT = (curT >= T_TRIP) ? 1.0f : ((curT > T_WARN) ? (curT - T_WARN) / (T_TRIP - T_WARN) : 0.0f);
  if (sT > 1.0f) sT = 1.0f;
  if (sT < 0.0f) sT = 0.0f;

  // Current load score
  sL = (curI >= I_TRIP) ? 1.0f : ((curI > I_WARN) ? (curI - I_WARN) / (I_TRIP - I_WARN) : (curI / (I_WARN * 2.0f)));
  if (sL > 1.0f) sL = 1.0f;
  if (sL < 0.0f) sL = 0.0f;

  // Arc evidence score
  sA = (arcCountVal > 0) ? ((float)arcCountVal / 10.0f) : 0.0f;
  if (sA > 1.0f) sA = 1.0f;

  // Slope score
  sS = (slopeVal > 0.0f) ? (slopeVal / 6.0f) : 0.0f;
  if (sS > 1.0f) sS = 1.0f;

  // Minutes to alarm (TTL)
  if (curT >= T_TRIP) {
    ttlMin = 0.0f;
  } else if (slopeVal > 0.3f) {
    ttlMin = (T_TRIP - curT) / slopeVal;
  } else {
    ttlMin = -1.0f;
  }

  if (state == TRIP) return 100.0f;

  // Noisy-OR evidence fusion
  float risk = 100.0f * (1.0f - (1.0f - 0.9f * sT) * (1.0f - 0.6f * sS) * (1.0f - 0.9f * sA) * (1.0f - 0.5f * sL));
  if (state == WARNING && risk < 55.0f) risk = 55.0f;
  if (state == WATCH && risk < 25.0f) risk = 25.0f;
  if (risk > 100.0f) risk = 100.0f;
  if (risk < 0.0f) risk = 0.0f;
  return risk;
}

// GET /api/state - Full telemetry payload for ArcSense React Dashboard
void handleApiState() {
  float sT = 0, sS = 0, sA = 0, sL = 0, ttlMin = -1;
  float risk = calcRisk(sT, sS, sA, sL, ttlMin);
  bool tripped = (state == TRIP) || (!isRelayOn());
  int level = stateToLevel(state);
  float dT = curT - tAmb;
  if (dT < 0) dT = 0;

  char b[512];
  snprintf(b, sizeof(b),
    "{\"t\":%lu,\"irms\":%.2f,\"crest\":%.2f,\"diffIdx\":%.3f,\"flatFrac\":%.3f,\"arcCount\":%d,"
    "\"tObj\":%.1f,\"tAmb\":%.1f,\"dT\":%.1f,\"slope\":%.2f,\"ttlMin\":%.1f,"
    "\"sT\":%.2f,\"sS\":%.2f,\"sA\":%.2f,\"sL\":%.2f,\"risk\":%.1f,\"level\":%d,"
    "\"tripped\":%s,\"sensorFault\":false,\"inj\":%d,"
    "\"state\":\"%s\",\"i\":%.2f,\"t\":%.1f,\"relay\":%s}",
    millis(), (tripped ? 0.0f : curI), (tripped ? 0.0f : 1.41f), diffIdxVal, flatFracVal, arcCountVal,
    curT, tAmb, dT, slopeVal, ttlMin,
    sT, sS, sA, sL, risk, level,
    tripped ? "true" : "false", injMode,
    stateName(state), curI, curT, isRelayOn() ? "true" : "false"
  );

  cors();
  server.send(200, "application/json", b);
}

// GET /api/wave - 96-point waveform array in centi-Amps (0.01 A)
void handleApiWave() {
  String out;
  out.reserve(96 * 6 + 16);
  out += "{\"a\":[";

  bool tripped = (state == TRIP) || (!isRelayOn());
  float peakA = tripped ? 0.0f : (curI * 1.4142f);

  for (int j = 0; j < 96; j++) {
    if (j > 0) out += ',';
    if (tripped) {
      out += '0';
    } else {
      float theta = (2.0f * 3.14159265f * (float)j) / 96.0f;
      float sample = peakA * sinf(theta);

      // Add characteristic arc shoulder flat & dropouts when arcing mode is active
      if (injMode == 1) {
        if (fabsf(sample) < (peakA * 0.22f)) {
          sample = 0.0f; // flat zero-crossing shoulder
        } else if ((j % 12) == 0) {
          sample *= 0.45f; // erratic arc micro-dropout
        }
      }

      int centi = (int)lroundf(sample * 100.0f);
      out += centi;
    }
  }
  out += "]}";

  cors();
  server.send(200, "application/json", out);
}

// GET or POST /api/inject?mode=0..3 - Simulated fault modes from app UI
void handleApiInject() {
  if (server.hasArg("mode")) {
    injMode = server.arg("mode").toInt();
    if (injMode < 0 || injMode > 3) injMode = 0;

    switch (injMode) {
      case 0: // Normal
        curI = 1.85f;
        curT = 32.0f;
        slopeVal = 0.0f;
        arcCountVal = 0;
        diffIdxVal = 0.02f;
        flatFracVal = 0.06f;
        if (state == TRIP) state = NORMAL;
        setRelay(true);
        break;
      case 1: // Series Arc Fault
        curI = 2.10f;
        curT = 38.0f;
        slopeVal = 0.5f;
        arcCountVal = 12;
        diffIdxVal = 0.42f;
        flatFracVal = 0.28f;
        break;
      case 2: // Overload Current
        curI = 13.5f; // Exceeds I_TRIP
        curT = 48.0f;
        slopeVal = 2.0f;
        arcCountVal = 0;
        diffIdxVal = 0.03f;
        flatFracVal = 0.06f;
        break;
      case 3: // Bad Joint Overheating
        curI = 2.40f;
        curT = 78.5f; // Exceeds T_TRIP
        slopeVal = 8.5f;
        arcCountVal = 0;
        diffIdxVal = 0.02f;
        flatFracVal = 0.06f;
        break;
    }
    lastData = millis();
    evaluate();
  }
  cors();
  server.send(200, "text/plain", "ok");
}

// GET or POST /api/reset & /reset
void handleReset() {
  state = NORMAL;
  injMode = 0;
  curI = 1.85f;
  curT = 32.0f;
  slopeVal = 0.0f;
  arcCountVal = 0;
  diffIdxVal = 0.02f;
  flatFracVal = 0.06f;
  setRelay(true);
  lastData = millis();
  cors();
  server.send(200, "text/plain", "ok");
}

// Legacy /status endpoint
void handleStatus() {
  handleApiState();
}

// Legacy /sim?i=4.2&t=41.5
void handleSim() {
  if (server.hasArg("i")) curI = server.arg("i").toFloat();
  if (server.hasArg("t")) curT = server.arg("t").toFloat();
  if (server.hasArg("arc")) arcCountVal = server.arg("arc").toInt();
  if (server.hasArg("slope")) slopeVal = server.arg("slope").toFloat();
  lastData = millis();
  if (state == NODATA) state = NORMAL;
  evaluate();
  handleApiState();
}

// I2C Scanner to find LCD address automatically
uint8_t scanI2C() {
  for (uint8_t a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) return a;
  }
  return 0;
}

void showLcd() {
  if (!lcd) return;
  float sT, sS, sA, sL, ttl;
  float risk = calcRisk(sT, sS, sA, sL, ttl);
  char l0[17], l1[17];
  snprintf(l0, sizeof(l0), "I:%-4.1fA T:%-3.0fC", (state == TRIP ? 0.0f : curI), curT);
  snprintf(l1, sizeof(l1), "%-7s Rk:%2.0f%%", stateName(state), risk);
  lcd->setCursor(0, 0); lcd->print(l0);
  lcd->setCursor(0, 1); lcd->print(l1);
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  setRelay(true);

  Wire.begin(SDA_PIN, SCL_PIN);
  uint8_t addr = scanI2C();
  if (!addr) addr = 0x27;
  lcd = new LiquidCrystal_I2C(addr, 16, 2);
  lcd->init();
  lcd->backlight();
  lcd->setCursor(0, 0); lcd->print("ArcSense ESP8266");
  lcd->setCursor(0, 1); lcd->print("Starting WiFi...");

  // Start Access Point
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);
  Serial.println();
  Serial.print("ArcSense AP Ready! IP: ");
  Serial.println(WiFi.softAPIP());

  // Modern ArcSense App Endpoints
  server.on("/api/state", HTTP_GET, handleApiState);
  server.on("/api/state", HTTP_OPTIONS, handleOptions);
  server.on("/api/wave", HTTP_GET, handleApiWave);
  server.on("/api/wave", HTTP_OPTIONS, handleOptions);
  server.on("/api/inject", HTTP_ANY, handleApiInject);
  server.on("/api/inject", HTTP_OPTIONS, handleOptions);
  server.on("/api/reset", HTTP_ANY, handleReset);
  server.on("/api/reset", HTTP_OPTIONS, handleOptions);

  // Legacy Endpoints
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/status", HTTP_OPTIONS, handleOptions);
  server.on("/sim", HTTP_ANY, handleSim);
  server.on("/sim", HTTP_OPTIONS, handleOptions);
  server.on("/reset", HTTP_ANY, handleReset);
  server.on("/reset", HTTP_OPTIONS, handleOptions);

  // Catch-all with CORS options handling
  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) {
      handleOptions();
    } else {
      cors();
      server.send(404, "text/plain", "Not Found");
    }
  });

  server.begin();

  lcd->clear();
  lcd->setCursor(0, 0); lcd->print(WiFi.softAPIP());
  lcd->setCursor(0, 1); lcd->print("App Ready");
  delay(1500);
}

void loop() {
  server.handleClient();

  // Update LCD display every 250ms
  static unsigned long lastLcd = 0;
  if (millis() - lastLcd > 250) {
    lastLcd = millis();
    showLcd();
  }
}
