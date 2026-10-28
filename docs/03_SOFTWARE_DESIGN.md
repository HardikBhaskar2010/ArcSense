# 03 · Software Design

## 1. Files

| File | Purpose |
|---|---|
| `firmware/arcsense/arcsense_core.h` | All detection and risk logic. No hardware calls — runs on ESP32 *and* on a PC. |
| `firmware/arcsense/arcsense.ino` | Hardware glue: ADC sampler, sensors, relays, OLED, Wi-Fi web server. |
| `firmware/arcsense/dashboard_html.h` | **Generated** copy of the dashboard so the ESP32 can serve it. |
| `dashboard/index.html` | Single-file dashboard (no internet needed). Built-in simulator + live mode. |
| `firmware/test/test_core.cpp` | 12 synthetic test scenarios for the core logic. |
| `tools/embed_dashboard.py` | Regenerates `dashboard_html.h` after you edit the dashboard. |

## 2. Data flow

```
 esp_timer, every 200 µs (5 kHz)
   analogReadMilliVolts(GPIO34) → remove slowly-tracked DC offset → amps
   (fault simulator: optionally chop the load via MOSFET)
   CycleAnalyzer.push(amps) ──cycle done──► features ──► lock-free queue
                                                              │
 loop()                                                       ▼
   drain queue → RiskEngine.onCycle()         every 1 s: MLX90614 → RiskEngine.onThermal()
   every 100 ms: RiskEngine.step() → level/trip → relay, LEDs, buzzer, OLED
   Web server: /  /api/state  /api/wave  /api/inject  /api/reset
```

## 3. Algorithms

### 3.1 Cycle analyser
1. **Cycle start** = rising crossing of a level (+0.2 × recent peak) *after* the signal was below −level. Using a level instead of zero stops idle-zero noise from moving the alignment point (this bug showed up in my first test with dimmer waveforms).
2. The fractional crossing position is found by linear interpolation; the cycle is **resampled onto 96 points**, so timing jitter doesn't look like distortion.
3. Features per cycle: `irms` (over the full period), `peak`, `crest = peak/irms`, `flatFrac` (share of samples within 10 % of peak of zero), and
   `diffIdx = Σ|cur − prev| / Σ|cur|`.
4. If a whole half-cycle vanishes (period > 1.5 × nominal) `diffIdx` is forced ≥ 0.5; if the gap is > 2.5 periods the load was simply off, so there is no comparison.

### 3.2 Arc counter
A cycle is **arc-like** if `diffIdx > 0.15`, `irms ≥ 0.5 A`, and no load-step hold-off. A 50-cycle (≈1 s) sliding window counts arc-like cycles → `arcCount`.
**Load-step hold-off:** if `irms` jumps > 25 % from the previous cycle (a load switching on/off), the next 3 cycles are not flagged.

### 3.3 Thermal trend
Last 30 one-second readings → least-squares slope (°C/min).
`alarmT = min(75 °C, T_ambient + 35)`; `ttl = (alarmT − T)/slope` when slope > 0.3 °C/min, 0 if already past alarm.
(75 °C is just above the 70 °C rating of common PVC insulation. Thresholds are in `Config` — change them and defend your choice.)

### 3.4 Evidence scores (each 0–1)

| Score | Formula | Weight |
|---|---|---|
| thermal | `(ΔT − 15) / (35 − 15)`, ΔT = T_obj − T_ambient | 0.9 |
| slope | `max(slope/6, 1 − ttl/10 min)` (only if ΔT > 5 °C) | 0.6 |
| arc | `(arcCount − 1)/(10 − 1)` | 0.9 |
| load | `(I/I_rated − 0.9)/0.3` | 0.5 |

`Risk = 100 · (1 − Π(1 − w·s))`. Hard rules: arcCount ≥ 10 or T_obj ≥ 75 °C forces Risk ≥ 90.

### 3.5 Levels, hysteresis, trip

| Risk | Level | Output |
|---|---|---|
| < 25 | NORMAL | green LED |
| 25–50 | WATCH | yellow LED |
| 50–75 | WARNING | yellow LED + chirp every 2 s |
| ≥ 75 | DANGER | red LED blinking + buzzer; if it lasts 1 s → **TRIP** (latched) |

Levels rise immediately, but fall one level at a time only after the risk has stayed 5 points below the boundary for 5 s (stops flicker). A trip stays latched until the reset button/API. A sensor fault (thermal sensor unreadable for 5 s) also trips — **fail-safe**.

## 4. Web API (served by the ESP32 at `http://192.168.4.1`)

| Endpoint | Returns / does |
|---|---|
| `GET /` | the dashboard page |
| `GET /api/state` | JSON: irms, crest, diffIdx, flatFrac, arcCount, tObj, tAmb, dT, slope, ttlMin, sT/sS/sA/sL scores, risk, level, tripped, sensorFault, inj |
| `GET /api/wave` | JSON `{"a":[96 ints]}` — last cycle in 0.01 A units |
| `GET /api/inject?mode=N` | fault simulator: 0 normal, 1 arcing (chopper), 2 overload, 3 bad joint |
| `GET /api/reset` | clears trip, resets simulator, re-closes the circuit |

Wi-Fi: access point **ArcSense-Demo**, password in the sketch (change it). No school Wi-Fi needed, which is what you want at an exhibition.

## 5. Dashboard

Opens with a yellow **SIMULATED DATA** badge when no device is connected, so nobody can mistake it for live data; it turns green **LIVE DEVICE** when it can reach the ESP32, and red **LINK LOST** if the link drops (it never silently falls back to fake data). Shows: risk gauge, level, joint °C, slope, time-to-alarm, waveform vs ideal sine, evidence scores, fault-simulator buttons, event log, and **CSV download** of the session for your trial table.

You can also open `dashboard/index.html` from your laptop and use `?ip=192.168.4.1` to point it at the device.

## 6. Tuning guide (do this with real data)

| Symptom | Parameter (in `Config`) | Direction |
|---|---|---|
| False arc flags on a clean load | `diffThresh` 0.15 | raise to 0.18–0.25 |
| Arc misses | `diffThresh`, `arcFull` | lower `diffThresh` to ~0.12; lower `arcFull` to 8 |
| Slope reacts to room-temperature drift | `dTWarn`, the `ΔT > 5` gate | raise gate to 8–10 °C |
| Warns too late on heating | `slopeFull`, `ttlHorizon` | lower slopeFull (e.g. 4), raise horizon (15 min) |
| Overload warning too eager | `iRated`, load score formula | set `RATED_A` to your loop's true rating |

Change one value at a time and re-run the 10-trial table.

## 7. Test results so far (synthetic waveforms, PC)

Run: `g++ -std=c++17 -O2 -o test_core firmware/test/test_core.cpp && ./test_core`

| Scenario | Expected | Result |
|---|---|---|
| Clean 2 A + 0.03 A noise (60 s) | no trip | max arc count 0, risk 0 |
| Noisy sensor 0.08 A | no trip | 0 arcs |
| Dimmer cut at 90° / 120° | no trip | max 2 arcs/s, risk 10 |
| Mains 49.6→50.4 Hz drift | no trip | 0 arcs |
| Load switch-on, then 2→3 A step | no trip | 0 arcs, risk 18 |
| 8 A inrush decaying to 2 A | no trip | 0 arcs; risk reaches 50 (WARNING) briefly from the load score, no trip |
| Normal warm-up 30→48 °C (tau 200 s) | no trip | max WATCH |
| Random dropouts (fault injector) | trip | **trip 1.5 s after fault start** |
| Series-arc model | trip | **trip 1.4 s after fault start** |
| Hot joint, 30→90 °C, tau 60 s | trip | trip ~23 s after heating starts, at **54 °C** — well before the 75 °C limit |
| Overload 3→4.2 A with heating | trip | trip ~7 s after start, at 36 °C (the demo ramp heats quickly) |

**What this proves:** the *logic* separates repeatable distortion (dimmers, drift, switching) from random distortion, and predicts heating early. **What it does not prove:** that thresholds fit real ACS712/MLX noise. Only your bench trials do that.

Also verified: the dashboard runs in a headless browser in simulator mode and against a mock `/api/state` server (live mode, LINK LOST on disconnect). The `.ino` was **syntax-checked against stub headers but not compiled for a real ESP32 or run on hardware** — expect to fix small compile/pin issues on first build (Arduino-ESP32 core 2.0.x or 3.x, with the three libraries named at the top of the sketch).

## 8. Ideas to make it yours (and earn the "own creativity" marks)

- Add a **learning mode**: record 60 s of the circuit's normal `diffIdx`/temperature and set thresholds from the circuit's own baseline.
- Log to the ESP32's flash or an SD card and plot a heating curve on the poster.
- Add a Telegram/WhatsApp alert through a phone hotspot.
- Replace the linear slope with an exponential fit (Newton's law of heating) and compare time-to-alarm predictions.
- Add a second node and show two circuits on one dashboard.
