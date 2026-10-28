  /*
    ArcSense - ESP8266 NodeMCU Bridge & Hardware-in-the-Loop Simulator
    -------------------------------------------------------------------
    Hardware:
      * ESP8266 (NodeMCU v2/v3 / Wemos D1 Mini)
      * I2C 1602 LCD (SDA -> D2 / GPIO4, SCL -> D1 / GPIO5)
      * Relay Module on D5 / GPIO14 (active LOW: LOW = Relay ON / Circuit LIVE)

    Features:
      * Dynamic physics & telemetry simulation engine running in firmware
      * Live waveform synthesis that mutates with fault injection (Arc, Overload, Bad Joint)
      * Real physical relay trip & restore via D5
      * 1602 LCD live telemetry & risk display
      * Full ArcSense REST API (/api/state, /api/wave, /api/inject, /api/reset)
  */

  #include <ESP8266WiFi.h>
  #include <ESP8266WebServer.h>
  #include <Wire.h>
  #include <LiquidCrystal_I2C.h>
  #include <math.h>

  #define SDA_PIN D2            // GPIO4
  #define SCL_PIN D1            // GPIO5
  #define RELAY_PIN D5          // GPIO14 - relay IN1, active LOW (LOW = load ON)

  // Standalone Access Point (broadcasted by ESP - no router needed)
  const char* AP_SSID = "ArcSense-ESP";
  const char* AP_PASS = "arcsense123";   // min 8 chars

  // OPTIONAL: Your home Wi-Fi or mobile phone hotspot credentials
  // If filled, the ESP connects to your Wi-Fi so your PC has INTERNET and ESP access at the same time!
  const char* STA_SSID = "Airtel_Airfiber";
  const char* STA_PASS = "Air@2006";

  // Thresholds
  const float I_WARN = 8.0f,  I_TRIP = 12.0f;  // Amps
  const float T_WARN = 60.0f, T_TRIP = 75.0f;  // deg C

  enum State { NORMAL, WATCH, WARNING, TRIP };
  State state = NORMAL;

  // Physics & telemetry simulation state
  float tObj = 32.0f;          // Joint Temperature in °C
  float tAmb = 28.0f;          // Ambient Temperature in °C
  float irms = 1.85f;          // Current in Amperes
  float slopeVal = 0.0f;       // Heating slope in °C/min
  float diffIdxVal = 0.02f;    // Waveform difference index (0..1)
  float flatFracVal = 0.06f;   // Flat shoulder fraction (0..1)
  float crestVal = 1.414f;     // Crest factor
  int   arcCountVal = 0;       // Arc cycles per second
  int   injMode = 0;           // 0=normal, 1=arc, 2=overload, 3=joint
  bool  tripped = false;       // Relay tripped latch
  int   dangerHoldTicks = 0;   // Ticks in danger before trip latch

  // Rolling temperature history for slope estimation (30 points, 1 Hz)
  float tHist[30];
  int   tHistLen = 0;

  ESP8266WebServer server(80);
  LiquidCrystal_I2C *lcd = nullptr;
  IPAddress deviceIP;

  const char* stateName(State s) {
    switch (s) {
      case NORMAL:  return "NORMAL";
      case WATCH:   return "WATCH";
      case WARNING: return "WARNING";
      case TRIP:    return "TRIP";
      default:      return "NORMAL";
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

  // Continuous physics & dynamic fault simulation step (runs every dt seconds)
  void simTick(float dt) {
    if (tripped) {
      // Tripped state: circuit disconnected, zero current, gradual cooling
      irms = 0.0f;
      diffIdxVal = 0.0f;
      arcCountVal = 0;
      flatFracVal = 0.0f;
      crestVal = 0.0f;
      state = TRIP;
      setRelay(false);

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
      // Mode 3: Bad joint - High thermal rise towards 85°C
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
      if (++dangerHoldTicks >= 3) { // 1.5 seconds sustained danger triggers physical trip
        tripped = true;
        state = TRIP;
        setRelay(false); // cuts relay
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

    char b[512];
    snprintf(b, sizeof(b),
      "{\"t\":%lu,\"irms\":%.2f,\"crest\":%.2f,\"diffIdx\":%.3f,\"flatFrac\":%.3f,\"arcCount\":%d,"
      "\"tObj\":%.1f,\"tAmb\":%.1f,\"dT\":%.1f,\"slope\":%.2f,\"ttlMin\":%.1f,"
      "\"sT\":%.2f,\"sS\":%.2f,\"sA\":%.2f,\"sL\":%.2f,\"risk\":%.1f,\"level\":%d,"
      "\"tripped\":%s,\"sensorFault\":false,\"inj\":%d,"
      "\"state\":\"%s\",\"i\":%.2f,\"t\":%.1f,\"relay\":%s}",
      millis(), (tripped ? 0.0f : irms), (tripped ? 0.0f : crestVal), diffIdxVal, flatFracVal, arcCountVal,
      tObj, tAmb, dT, slopeVal, ttlMin,
      sT, sS, sA, sL, risk, level,
      tripped ? "true" : "false", injMode,
      stateName(state), (tripped ? 0.0f : irms), tObj, isRelayOn() ? "true" : "false"
    );

    cors();
    server.send(200, "application/json", b);
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
        setRelay(true);
      }
    }
    cors();
    server.send(200, "text/plain", "ok");
  }

  // GET or POST /api/reset & /reset - Reset tripped relay and restore normal
  void handleReset() {
    tripped = false;
    state = NORMAL;
    injMode = 0;
    dangerHoldTicks = 0;
    tObj = 32.0f;
    slopeVal = 0.0f;
    tHistLen = 0;
    setRelay(true);
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
    snprintf(l0, sizeof(l0), "I:%-4.1fA T:%-3.0fC", (tripped ? 0.0f : irms), tObj);

    // Alternate line 2: 6 seconds showing status & risk, 3 seconds showing device IP
    if ((millis() / 1000) % 9 >= 6) {
      char ipBuf[16];
      snprintf(ipBuf, sizeof(ipBuf), "%s", deviceIP.toString().c_str());
      snprintf(l1, sizeof(l1), "IP:%-13s", ipBuf);
    } else {
      snprintf(l1, sizeof(l1), "%-7s Rk:%2.0f%%", stateName(state), risk);
    }

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

    // Dual Wi-Fi mode: SoftAP (ArcSense-ESP) + Optional Station (Home/Hotspot Wi-Fi)
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP(AP_SSID, AP_PASS);

    bool staConnected = false;
    if (STA_SSID != nullptr && strlen(STA_SSID) > 0) {
      lcd->setCursor(0, 1); lcd->print("Connecting WiFi.");
      Serial.printf("Connecting to Wi-Fi '%s'...\n", STA_SSID);
      WiFi.begin(STA_SSID, STA_PASS);
      unsigned long startTry = millis();
      while (WiFi.status() != WL_CONNECTED && millis() - startTry < 8000) {
        delay(250);
        Serial.print(".");
      }
      if (WiFi.status() == WL_CONNECTED) {
        staConnected = true;
        Serial.println();
        Serial.print("Connected to Wi-Fi! Local IP: ");
        Serial.println(WiFi.localIP());
      } else {
        Serial.println("\nWi-Fi connection timed out. Continuing with SoftAP only.");
      }
    }

    Serial.println();
    Serial.print("ArcSense AP Ready! IP: ");
    Serial.println(WiFi.softAPIP());

    IPAddress activeIP = staConnected ? WiFi.localIP() : WiFi.softAPIP();

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

    deviceIP = activeIP;

    lcd->clear();
    lcd->setCursor(0, 0); lcd->print("IP Address:");
    lcd->setCursor(0, 1); lcd->print(deviceIP);
    delay(4000);
  }

  void loop() {
    server.handleClient();

    // Run dynamic simulation tick every 200ms
    static unsigned long lastTick = 0;
    if (millis() - lastTick >= 200) {
      float dt = (millis() - lastTick) / 1000.0f;
      lastTick = millis();
      simTick(dt);
    }

    // Update LCD display every 250ms
    static unsigned long lastLcd = 0;
    if (millis() - lastLcd > 250) {
      lastLcd = millis();
      showLcd();
    }
  }
