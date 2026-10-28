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
  #include <DNSServer.h>
  #include <EEPROM.h>
  #include <Wire.h>
  #include <LiquidCrystal_I2C.h>
  #include <math.h>

  #define SDA_PIN D2            // GPIO4
  #define SCL_PIN D1            // GPIO5
  #define RELAY_PIN D5          // GPIO14 - relay IN1, active LOW (LOW = load ON)
  #define EEPROM_MAGIC 0xA7

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
  const char* DEVICE_NAME = "ArcSense-ESP8266";
  char connectedClient[17] = "";
  unsigned long lastClientConnectMs = 0;

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

    char b[720];
    String curSsid = (WiFi.status() == WL_CONNECTED ? WiFi.SSID() : (strlen(staSSID) > 0 ? String(staSSID) : "ArcSense-ESP"));
    int rssiVal = (WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0);
    bool wifiConn = (WiFi.status() == WL_CONNECTED);

    if (server.hasArg("client")) {
      String cl = server.arg("client");
      if (cl.length() > 0 && strcmp(connectedClient, cl.c_str()) != 0) {
        strncpy(connectedClient, cl.c_str(), sizeof(connectedClient) - 1);
        connectedClient[sizeof(connectedClient) - 1] = '\0';
        lastClientConnectMs = millis();
        Serial.printf("Client Connected: '%s'\n", connectedClient);
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

  // ANY /api/relay?action=trip|restore - Direct physical relay override
  void handleApiRelay() {
    cors();
    String action = server.arg("action");
    if (action == "trip") {
      tripped = true;
      state = TRIP;
      setRelay(false);
    } else if (action == "restore") {
      tripped = false;
      state = NORMAL;
      setRelay(true);
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
      "<h2>⚡ ArcSense Wi-Fi Setup</h2>"
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
      "<h3>✅ Wi-Fi Saved to Flash!</h3>"
      "<p>Connecting to <b>");
    resp += ssid;
    resp += F("</b>...</p>"
      "<p>Look at the <b>1602 LCD display</b> on the hardware for your new IP address.</p>"
      "<p style='font-size:12px;color:#64748b;'>You can now reconnect your phone/laptop to that same Wi-Fi!</p>"
      "</div></body></html>");

    server.send(200, "text/html", resp);

    if (lcd) {
      lcd->clear();
      lcd->setCursor(0, 0); lcd->print("Connecting WiFi:");
      lcd->setCursor(0, 1); lcd->print(staSSID);
    }

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
        lcd->clear();
        lcd->setCursor(0, 0); lcd->print("WiFi Connected!");
        lcd->setCursor(0, 1); lcd->print(deviceIP);
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

    if (lcd) {
      lcd->clear();
      lcd->setCursor(0, 0); lcd->print("Connecting WiFi:");
      lcd->setCursor(0, 1); lcd->print(staSSID);
    }

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

  void showLcd() {
    if (!lcd) return;

    // Toast: When laptop or client connects, show toast on LCD for 3.5 seconds!
    if (lastClientConnectMs > 0 && millis() - lastClientConnectMs < 3500) {
      char c0[17], c1[17];
      snprintf(c0, sizeof(c0), "Connected: %-7s", connectedClient);
      snprintf(c1, sizeof(c1), "Dashboard LIVE! ");
      lcd->setCursor(0, 0); lcd->print(c0);
      lcd->setCursor(0, 1); lcd->print(c1);
      return;
    }

    float sT, sS, sA, sL, ttl;
    float risk = calcRisk(sT, sS, sA, sL, ttl);
    char l0[17], l1[17];
    snprintf(l0, sizeof(l0), "I:%-4.1fA T:%-3.0fC", (tripped ? 0.0f : irms), tObj);

    // 3-way rotation for line 2 (every 10s):
    // 0..4s: Status & Risk (NORMAL Rk: 0%)
    // 4..7s: IP Address (IP: 192.168.x.x)
    // 7..10s: Client or Network Name (Connected: Laptop or Net: Airtel_Airfiber)
    unsigned long sec = (millis() / 1000) % 10;
    if (sec >= 7) {
      if (strlen(connectedClient) > 0) {
        snprintf(l1, sizeof(l1), "Client:%-9s", connectedClient);
      } else {
        String s = (WiFi.status() == WL_CONNECTED ? WiFi.SSID() : "AP:ArcSense");
        snprintf(l1, sizeof(l1), "Net:%-12s", s.substring(0, 12).c_str());
      }
    } else if (sec >= 4) {
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
    // 1. Booting Screen
    lcd->clear();
    lcd->setCursor(0, 0); lcd->print("ArcSense NodeMCU");
    lcd->setCursor(0, 1); lcd->print("Booting....     ");
    delay(1200);

    // 2. Hardware Diagnostics
    lcd->clear();
    lcd->setCursor(0, 0); lcd->print("Relay D5: LIVE  ");
    lcd->setCursor(0, 1); lcd->print("Init Hardware...");
    delay(800);

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
    WiFi.softAP(AP_SSID, AP_PASS);

    // Start Captive Portal DNS server (intercepts all DNS requests in AP mode)
    dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
    dnsServer.start(53, "*", WiFi.softAPIP());

    bool staConnected = false;
    if (strlen(staSSID) > 0) {
      lcd->clear();
      lcd->setCursor(0, 0); lcd->print("Connecting WiFi:");
      lcd->setCursor(0, 1); lcd->print(staSSID);
      Serial.printf("Connecting to Wi-Fi '%s'...\n", staSSID);
      WiFi.begin(staSSID, staPASS);
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

        lcd->clear();
        lcd->setCursor(0, 0); lcd->print("Connected: WiFi ");
        lcd->setCursor(0, 1); lcd->print(staSSID);
        delay(1500);
      } else {
        Serial.println("\nWi-Fi connection timed out. SoftAP Portal ready at 192.168.4.1/wifi");
        lcd->clear();
        lcd->setCursor(0, 0); lcd->print("No WiFi -> AP   ");
        lcd->setCursor(0, 1); lcd->print("192.168.4.1/wifi");
        delay(2000);
      }
    } else {
      lcd->clear();
      lcd->setCursor(0, 0); lcd->print("Connected: AP   ");
      lcd->setCursor(0, 1); lcd->print("ArcSense-ESP    ");
      delay(1500);
    }

    IPAddress activeIP = staConnected ? WiFi.localIP() : WiFi.softAPIP();
    deviceIP = activeIP;

    lcd->clear();
    lcd->setCursor(0, 0); lcd->print("Node IP Address:");
    lcd->setCursor(0, 1); lcd->print(deviceIP);
    delay(2500);

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

    // Wi-Fi Setup & Captive Portal Endpoints
    server.on("/wifi", HTTP_GET, handleWifiPage);
    server.on("/wifi", HTTP_POST, handleWifiSubmit);
    server.on("/generate_204", HTTP_GET, handleWifiPage);
    server.on("/hotspot-detect.html", HTTP_GET, handleWifiPage);
    server.on("/canonical.html", HTTP_GET, handleWifiPage);
    server.on("/ncsi.txt", HTTP_GET, handleWifiPage);

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
      } else {
        String host = server.hostHeader();
        if (host.length() > 0 && !host.startsWith("192.168.") && host.indexOf("arcsense") == -1) {
          server.sendHeader("Location", "http://192.168.4.1/wifi", true);
          server.send(302, "text/plain", "");
          return;
        }
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
    dnsServer.processNextRequest();
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
