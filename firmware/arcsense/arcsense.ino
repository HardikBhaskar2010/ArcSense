/*
  ArcSense - pre-fire electrical fault predictor (ESP32)
  -----------------------------------------------------
  Senses ONE low-voltage AC circuit (demo: 12 V AC / <= 5 A, isolated from mains by a transformer):
    * current waveform  (ACS712-5A)       -> arc-like cycle-to-cycle distortion, overload
    * joint temperature (MLX90614 IR)     -> heating and rate-of-rise -> minutes to alarm
  Fuses the evidence into a 0-100 risk, shows it (OLED, LEDs, buzzer, web dashboard)
  and opens a fail-safe relay when risk stays in DANGER.

  Logic lives in arcsense_core.h (tested on a PC). This file is only hardware glue.
  Libraries (Arduino Library Manager): Adafruit MLX90614, Adafruit SSD1306, Adafruit GFX.
  Board: "ESP32 Dev Module". Open Serial Monitor at 115200 for a CSV log.

  SAFETY: demo circuit must stay <= 12 V AC (SELV). Never connect mains to this prototype.
*/
#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include "esp_timer.h"
#include "arcsense_core.h"
#include "dashboard_html.h"

// ---------------- build options ----------------
#define USE_MLX   1      // 1 = MLX90614 IR sensor.  0 = no temperature (arc/overload only)
#define USE_OLED  1      // 1 = SSD1306 128x64 I2C display

// ---------------- pins (ESP32 DevKit V1, 30/38 pin) ----------------
const int PIN_ADC_I      = 34;   // ACS712 OUT via 10k/20k divider (ADC1 only: ADC2 clashes with WiFi)
const int PIN_RELAY_TRIP = 26;   // trip relay: coil ON = circuit live, coil OFF = tripped (fail-safe)
const int PIN_RELAY_JOINT= 16;   // fault simulator: puts the "bad joint" resistor in series
const int PIN_RELAY_LOAD2= 17;   // fault simulator: adds a second load (overload)
const int PIN_CHOP_GATE  = 13;   // fault simulator: MOSFET AC switch gate (HIGH = conducting)
const int PIN_LED_G = 25, PIN_LED_Y = 33, PIN_LED_R = 32;
const int PIN_BUZZER     = 27;   // active buzzer
const int PIN_BUTTON     = 14;   // reset button to GND (internal pull-up)
// I2C: SDA = 21, SCL = 22 (default)

const int RELAY_ON  = LOW;       // most relay modules are active-LOW. Flip if yours is not.
const int RELAY_OFF = HIGH;

// ---------------- sensor scaling ----------------
// ACS712-5A: 185 mV/A at its pin; our 10k/20k divider scales by 2/3  ->  123.3 mV/A at the ADC pin.
const float MV_PER_A = 185.0f * (20.0f / 30.0f);
// Circuit being protected: set to the rated current of YOUR demo loop.
const float RATED_A  = 2.5f;     // demo loop: 1x 20 W bulb = 1.7 A normal, 2 bulbs = 3.3 A (overload)

const char* AP_SSID = "ArcSense-Demo";
const char* AP_PASS = "arcsense123";     // change it; min 8 chars

// ---------------- globals ----------------
using namespace arcsense;
RiskEngine   engine;
CycleAnalyzer analyzer;
WebServer    server(80);

#if USE_MLX
#include <Adafruit_MLX90614.h>
Adafruit_MLX90614 mlx;
#endif
#if USE_OLED
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
Adafruit_SSD1306 oled(128, 64, &Wire, -1);
bool oledOk = false;
#endif

// cycle queue: timer callback (producer) -> loop() (consumer)
CycleFeatures qBuf[64];
volatile uint8_t qHead = 0, qTail = 0;
volatile int16_t waveCenti[SPC];          // last cycle, 0.01 A units, for the dashboard scope
volatile uint32_t waveSeq = 0;

double offsetMv = 1667.0;                  // DC bias of the sensor output, tracked slowly
volatile int  injMode = 0;                 // 0 none, 1 arc-chop, 2 overload, 3 hot joint
volatile bool chopOn = false;
int chopLeft = 0;
bool sensorOk = true;
uint32_t lastThermalMs = 0, lastStepMs = 0, lastLogMs = 0, lastOledMs = 0;
bool lastTripped = false;

// ---------------- helpers ----------------
inline void relay(int pin, bool on) { digitalWrite(pin, on ? RELAY_ON : RELAY_OFF); }

void applyInject(int m) {
  injMode = m;
  chopOn = (m == 1);
  relay(PIN_RELAY_LOAD2, m == 2);
  relay(PIN_RELAY_JOINT, m == 3);
  if (!chopOn) digitalWrite(PIN_CHOP_GATE, HIGH);
}

// ---------------- 5 kHz sampler (esp_timer task, not a hard ISR) ----------------

void samplerCb(void*) {
  double mv = (double)analogReadMilliVolts(PIN_ADC_I);
  offsetMv += (mv - offsetMv) * (1.0 / (SAMPLE_RATE_HZ * 20.0));   // ~20 s time constant
  float amps = (float)((mv - offsetMv) / MV_PER_A);

  // fault simulator: random dropouts of the load current (emulates an arcing contact)
  if (chopOn) {
    if (chopLeft > 0) { chopLeft--; if (chopLeft == 0) digitalWrite(PIN_CHOP_GATE, HIGH); }
    else if ((esp_random() % 100) == 0) { chopLeft = 3 + (esp_random() % 18); digitalWrite(PIN_CHOP_GATE, LOW); }
  }

  CycleFeatures f;
  if (analyzer.push(amps, f)) {
    uint8_t nh = (qHead + 1) & 63;
    if (nh != qTail) { qBuf[qHead] = f; __sync_synchronize(); qHead = nh; }
    const float* c = analyzer.lastCycle();
    for (int j = 0; j < SPC; j++) waveCenti[j] = (int16_t)lroundf(c[j] * 100.0f);
    waveSeq++;
  }
}

void startSampler() {
  esp_timer_create_args_t a = {};
  a.callback = samplerCb;
  a.name = "arcsense_adc";
  esp_timer_handle_t h;
  esp_timer_create(&a, &h);
  esp_timer_start_periodic(h, 1000000 / SAMPLE_RATE_HZ);
}

// ---------------- web API ----------------
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

void handleState() {
  const State& s = engine.state();
  char b[512];
  snprintf(b, sizeof b,
    "{\"t\":%lu,\"irms\":%.3f,\"crest\":%.2f,\"diffIdx\":%.3f,\"flatFrac\":%.3f,\"arcCount\":%d,"
    "\"tObj\":%.2f,\"tAmb\":%.2f,\"dT\":%.2f,\"slope\":%.2f,\"ttlMin\":%.2f,"
    "\"sT\":%.2f,\"sS\":%.2f,\"sA\":%.2f,\"sL\":%.2f,\"risk\":%.1f,\"level\":%d,"
    "\"tripped\":%s,\"sensorFault\":%s,\"inj\":%d}",
    (unsigned long)millis(), s.irms, s.crest, s.diffIdx, s.flatFrac, s.arcCount,
    s.tObj, s.tAmb, s.dT, s.slope, s.ttlMin,
    s.sThermal, s.sSlope, s.sArc, s.sLoad, s.risk, (int)s.level,
    s.tripped ? "true" : "false", s.sensorFault ? "true" : "false", (int)injMode);
  cors(); server.send(200, "application/json", b);
}

void handleWave() {
  String o; o.reserve(SPC * 6 + 16);
  o += "{\"a\":[";
  for (int j = 0; j < SPC; j++) { if (j) o += ','; o += (int)waveCenti[j]; }
  o += "]}";
  cors(); server.send(200, "application/json", o);
}

void handleInject() {
  int m = server.hasArg("mode") ? server.arg("mode").toInt() : 0;
  if (m < 0 || m > 3) m = 0;
  applyInject(m);
  cors(); server.send(200, "text/plain", "ok");
}

void doReset() {
  applyInject(0);
  engine.clearTrip();
  if (sensorOk) {
    relay(PIN_RELAY_TRIP, true);
  }
}
void handleReset() { doReset(); cors(); server.send(200, "text/plain", "ok"); }

// ---------------- outputs ----------------
void updateOutputs(const State& s) {
  // trip relay: coil energised while healthy; released (de-energised) = open circuit
  if (s.tripped && !lastTripped) relay(PIN_RELAY_TRIP, false);
  lastTripped = s.tripped;

  digitalWrite(PIN_LED_G, s.level == NORMAL);
  digitalWrite(PIN_LED_Y, s.level == WATCH || s.level == WARNING);
  bool blink = (millis() / 250) & 1;
  digitalWrite(PIN_LED_R, s.level == DANGER ? (s.tripped ? HIGH : blink) : LOW);

  bool buz = false;
  if (s.level == WARNING) buz = ((millis() % 2000) < 100);           // short chirp every 2 s
  if (s.level == DANGER)  buz = s.tripped ? ((millis() % 400) < 200) : blink;
  digitalWrite(PIN_BUZZER, buz);
}

#if USE_OLED
void drawOled(const State& s) {
  if (!oledOk) return;
  static const char* LV[] = {"NORMAL", "WATCH", "WARNING", "DANGER"};
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(2); oled.setCursor(0, 0);
  oled.print(s.sensorFault ? "SENSOR!" : (s.tripped ? "TRIPPED" : LV[s.level]));
  oled.setTextSize(1);
  oled.setCursor(0, 20); oled.printf("Risk %3.0f/100", s.risk);
  oled.setCursor(0, 31); oled.printf("I %.2fA  arc %d/s", s.irms, s.arcCount);
  oled.setCursor(0, 42); oled.printf("T %.1fC  %+.1fC/min", s.tObj, s.slope);
  oled.setCursor(0, 53);
  if (s.ttlMin < 0) oled.print("heating: none"); else if (s.ttlMin == 0) oled.print("ALARM TEMP"); else oled.printf("alarm in %.1f min", s.ttlMin);
  oled.drawRect(104, 0, 24, 14, SSD1306_WHITE);
  oled.fillRect(104, 0, (int)(24.0f * s.risk / 100.0f), 14, SSD1306_WHITE);
  oled.display();
}
#endif

// ---------------- thermal read (1 Hz) ----------------
void readThermal() {
#if USE_MLX
  float to = mlx.readObjectTempC();
  float ta = mlx.readAmbientTempC();
  static int bad = 0;
  if (isnan(to) || isnan(ta) || to < -20 || to > 300) {
    if (++bad >= 5) { sensorOk = false; engine.setSensorFault(true); }   // fail-safe
    return;
  }
  bad = 0;
  engine.onThermal(to, ta);
#endif
}

// ---------------- setup / loop ----------------
void setup() {
  Serial.begin(115200);
  pinMode(PIN_RELAY_TRIP, OUTPUT);  digitalWrite(PIN_RELAY_TRIP, RELAY_OFF);   // start OPEN
  pinMode(PIN_RELAY_JOINT, OUTPUT); digitalWrite(PIN_RELAY_JOINT, RELAY_OFF);
  pinMode(PIN_RELAY_LOAD2, OUTPUT); digitalWrite(PIN_RELAY_LOAD2, RELAY_OFF);
  pinMode(PIN_CHOP_GATE, OUTPUT);   digitalWrite(PIN_CHOP_GATE, HIGH);
  pinMode(PIN_LED_G, OUTPUT); pinMode(PIN_LED_Y, OUTPUT); pinMode(PIN_LED_R, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  analogSetPinAttenuation(PIN_ADC_I, ADC_11db);

  Wire.begin();
#if USE_OLED
  oledOk = oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  if (oledOk) { oled.clearDisplay(); oled.setTextColor(SSD1306_WHITE); oled.setTextSize(2); oled.setCursor(0, 8); oled.print("ArcSense"); oled.setTextSize(1); oled.setCursor(0, 34); oled.print("self-test..."); oled.display(); }
#endif
#if USE_MLX
  if (!mlx.begin()) { sensorOk = false; Serial.println("MLX90614 not found -> fail-safe"); }
#endif

  // offset calibration: average 1 s (= 50 whole mains cycles) of the signal
  double acc = 0, acc2 = 0; int n = 0; uint32_t t0 = millis();
  while (millis() - t0 < 1000) { double v = analogReadMilliVolts(PIN_ADC_I); acc += v; acc2 += v * v; n++; delay(1); }
  offsetMv = acc / n;
  double sigmaMv = sqrt(fmax(0.0, acc2 / n - offsetMv * offsetMv));   // includes the load's AC if it is on
  Serial.printf("offset %.1f mV (expect ~1667 for 5 V ACS712 + 10k/20k divider)\n", offsetMv);
  Serial.printf("signal spread %.1f mV = %.2f A rms (with the load OFF this is your noise floor; want < 0.10 A)\n", sigmaMv, sigmaMv / MV_PER_A);

  Config c = engine.config();
  c.iRated = RATED_A;
  engine.setConfig(c);

  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);
  server.on("/", []() { server.send_P(200, "text/html", DASH_HTML); });
  server.on("/api/state", HTTP_GET, handleState);
  server.on("/api/state", HTTP_OPTIONS, handleOptions);
  server.on("/api/wave", HTTP_GET, handleWave);
  server.on("/api/wave", HTTP_OPTIONS, handleOptions);
  server.on("/api/inject", HTTP_GET, handleInject);
  server.on("/api/inject", HTTP_OPTIONS, handleOptions);
  server.on("/api/reset", HTTP_GET, handleReset);
  server.on("/api/reset", HTTP_OPTIONS, handleOptions);
  server.begin();
  Serial.printf("Dashboard: connect to WiFi '%s', open http://%s/\n", AP_SSID, WiFi.softAPIP().toString().c_str());
  Serial.println("ms,irms,crest,diffIdx,flat,arcCount,tObj,tAmb,slope,ttlMin,risk,level,tripped,inj");

  startSampler();
  engine.setSensorFault(!sensorOk);
  if (sensorOk) relay(PIN_RELAY_TRIP, true);    // close the circuit only after the self-test passed
}

void loop() {
  server.handleClient();
  uint32_t now = millis();

  while (qTail != qHead) {                       // drain finished mains cycles
    engine.onCycle(qBuf[qTail], now);
    qTail = (qTail + 1) & 63;
  }
  if (now - lastThermalMs >= 1000) { lastThermalMs = now; readThermal(); }
  if (now - lastStepMs >= 100) { lastStepMs = now; engine.step(now); updateOutputs(engine.state()); }
  if (digitalRead(PIN_BUTTON) == LOW) { delay(30); if (digitalRead(PIN_BUTTON) == LOW) { doReset(); while (digitalRead(PIN_BUTTON) == LOW) delay(10); } }
#if USE_OLED
  if (now - lastOledMs >= 250) { lastOledMs = now; drawOled(engine.state()); }
#endif
  if (now - lastLogMs >= 1000) {
    lastLogMs = now;
    const State& s = engine.state();
    Serial.printf("%lu,%.3f,%.2f,%.3f,%.3f,%d,%.2f,%.2f,%.2f,%.2f,%.1f,%d,%d,%d\n", (unsigned long)now,
      s.irms, s.crest, s.diffIdx, s.flatFrac, s.arcCount, s.tObj, s.tAmb, s.slope, s.ttlMin, s.risk,
      (int)s.level, s.tripped ? 1 : 0, (int)injMode);
  }
}
