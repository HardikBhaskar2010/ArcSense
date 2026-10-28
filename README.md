# ArcSense — Pre-Fire Electrical Fault Predictor

Delhi DoE Science & Mathematics Exhibition 2026-27 · **Category C2 · Disaster Management**  
Theme: *"Science, Technology, and Innovation for Sustainable and Viksit Bharat"*  
Built in the school Atal Tinkering Lab (ATL).

ArcSense monitors low-voltage AC circuits by fusing two independent physical signatures:
1. **Cycle-to-cycle current waveform differencing (5 kHz sampling via ACS712)** to catch random series micro-arcing before thermal ignition.
2. **Infrared non-contact joint thermometry (MLX90614)** with a 30-second least-squares rate-of-rise model that predicts **minutes remaining to alarm** rather than waiting for critical heat.

---

## 1. Documentation Index

Before modifying hardware or firmware, consult the detailed specifications:

| File | Description |
|---|---|
| [`docs/01_PROJECT_SPEC.md`](file:///docs/01_PROJECT_SPEC.md) | Problem statement, NCRB fire statistics, scientific principles, evidence fusion, judging criteria map, validation table. |
| [`docs/02_HARDWARE_BUILD.md`](file:///docs/02_HARDWARE_BUILD.md) | Safety rules, BOM, 12V SELV loop wiring, ADC voltage divider, sensor mounting, 9-stage build plan, calibration. |
| [`docs/03_SOFTWARE_DESIGN.md`](file:///docs/03_SOFTWARE_DESIGN.md) | Cycle analyzer algorithms, least-squares slope, noisy-OR evidence fusion, ESP32 REST API, threshold tuning guide. |
| [`docs/04_ENCLOSURE_AND_POSTER_BRIEF.md`](file:///docs/04_ENCLOSURE_AND_POSTER_BRIEF.md) | CAD specifications for 3D-printed monitor box, IR arm, hot-zone guard, and poster content checklist. |
| [`docs/05_PRESENTATION_AND_PLAN.md`](file:///docs/05_PRESENTATION_AND_PLAN.md) | 60-second pitch, 3-minute live demo run-sheet, judge Q&A defense, 8-day exhibition timeline. |

---

## 2. Project Architecture

```
                          ┌───────────────────────── 5 V USB Power ─────────────────────────┐
                          │                                                                 │
  ┌──────────────┐      ┌─▼─────────┐    I2C     ┌──────────────┐     ┌───────────┐    GPIO34 ◄─ 10k/20k divider ◄─ ACS712 OUT
  │   MLX90614   ├──────┤           ├────────────┤  SSD1306     │     │ LEDs      │◄───GPIO25 (G) / 33 (Y) / 32 (R)
  │ (Joint Temp) │      │  ESP32    │            │  0.96" OLED  │     │ Buzzer    │◄───GPIO27
  └──────────────┘      │ DevKit V1 ├──GPIO26───►│ Relay 1 TRIP ├─────┤ Button    │◄───GPIO14 (Reset)
   Aims at 2.2Ω         │           ├──GPIO16───►│ Relay 2 JOINT│
   bad joint spot       │           ├──GPIO17───►│ Relay 3 LOAD2│
                        │           ├──GPIO13───►│ MOSFET Gate  │
                        └─────┬─────┘            └──────────────┘
                              │
                      Wi-Fi SoftAP "ArcSense-Demo"
                      Default Gateway: http://192.168.4.1
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
       Embedded Mode                  Development Mode
   (ESP32 Serves Bundle)         (Laptop / Tablet Browser)
   http://192.168.4.1/           http://localhost:5173/?ip=192.168.4.1
```

---

## 3. Technology Stack

### Frontend Monitoring Dashboard
- **React 19 & TypeScript 7**: Strictly typed, component-driven UI architecture.
- **Vite 8 & `vite-plugin-singlefile`**: Zero-dependency single-file HTML compilation for offline exhibition deployment.
- **Tailwind CSS 3**: Industrial control room theme with deep slate charcoal surfaces, high-contrast indicators, and accessible status colors.
- **Bklit UI**: Composable telemetry metric cards, engineering gauges, and noisy-OR evidence indicators.
- **Recharts**: High-frequency live 96-sample waveform chart with theoretical reference overlay, dual-axis thermal history trends, and predictive rate-of-rise forecast.
- **Lucide React**: Clean technical iconography.
- **TanStack Query & Zustand**: Resilient polling with automatic backoff, connection state machine (CONNECTING, LIVE, LINK_LOST, SIMULATOR), and session event logs.

### Embedded Backend
- **ESP32 Arduino Core** (`firmware/arcsense/arcsense.ino`)
- **`arcsense_core.h`**: Hardware-agnostic C++ detection, cycle differencing, and noisy-OR fusion engine.
- **HTTP Server**: Endpoints for `/api/state`, `/api/wave`, `/api/inject`, and `/api/reset` with complete CORS preflight (`OPTIONS`) support.
- **Zero Cloud / Zero Database**: Operates 100% locally on self-hosted Wi-Fi without internet access.

---

## 4. Getting Started

### Prerequisites
- Node.js ≥ 20.x (`node -v`)
- Python ≥ 3.9 (`python --version`)
- Modern C++ compiler (`g++` or `clang`) for firmware core unit tests

### Installation
```bash
# Clone and enter directory
cd arcsense

# Install frontend dependencies
npm install
```

### Running the Dashboard Locally

```bash
# Run in development mode (starts Vite on http://localhost:5173)
npm run dev

# Open in browser:
# - Default (starts in simulator mode): http://localhost:5173/
# - Connect to live ESP32:             http://localhost:5173/?ip=192.168.4.1
```

### Building for Production & Exhibition Deployment

```bash
# Builds single-file bundle into dist/index.html, copies to dashboard/index.html,
# and automatically embeds it into firmware/arcsense/dashboard_html.h
npm run build
```

---

## 5. Firmware & Hardware Deployment

### Flashing the ESP32
1. Open [`firmware/arcsense/arcsense.ino`](file:///firmware/arcsense/arcsense.ino) in the Arduino IDE.
2. Select Board: **ESP32 Dev Module**.
3. Install required libraries via Library Manager:
   - `Adafruit MLX90614`
   - `Adafruit SSD1306`
   - `Adafruit GFX Library`
4. Upload to the ESP32.
5. Open Serial Monitor at **115200 baud** to verify initial sensor offset and noise calibration.

### Connecting to the Device at an Exhibition
1. On your phone or laptop, join Wi-Fi: **`ArcSense-Demo`** (password: `arcsense123`).
2. **On phones: disable mobile data** so local Wi-Fi traffic routes to the ESP32.
3. Open a browser and navigate to:
   - **`http://192.168.4.1/`** (directly served by ESP32 flash)
   - Or run the laptop Vite dashboard pointing to the device: **`http://localhost:5173/?ip=192.168.4.1`**.

---

## 6. Testing & Verification

### Running Automated Test Suites

```bash
# 1. Run TypeScript check
npm run typecheck

# 2. Run Vitest frontend suite (API parsing, simulator, CSV export, connection states)
npm run test

# 3. Run 12 C++ firmware synthetic scenario tests
npm run test:core
```

### Automated Scenario Test Matrix (`firmware/test/test_core.cpp`)

| Scenario | Expected Output | Status |
|---|---|---|
| Clean 2 A + 0.03 A sensor noise (60 s) | No trip (Normal) | ✅ PASS |
| Cheap noisy sensor (0.08 A spread) | No trip (Normal) | ✅ PASS |
| Phase-cut dimmer (90° / 120°) | No trip (Repeatable distortion ignored) | ✅ PASS |
| Mains frequency drift (49.6 → 50.4 Hz) | No trip | ✅ PASS |
| Load switch-on step (2 A → 3 A) | No trip (Hold-off active) | ✅ PASS |
| Inrush 8 A decaying to 2 A | No trip (Transient warning only) | ✅ PASS |
| Normal warm-up (30 → 48 °C, tau=200s) | No trip (Slope below threshold) | ✅ PASS |
| **FAULT: Random dropouts (chopper)** | **Trip within 1.5 s** | ✅ PASS |
| **FAULT: Series-arc physics model** | **Trip within 1.4 s** | ✅ PASS |
| **FAULT: High-resistance bad joint** | **Trip at 54 °C (well before 75 °C limit)** | ✅ PASS |
| **FAULT: Overload (3.0 A → 4.2 A + heat)**| **Trip within 12 s** | ✅ PASS |

---

## 7. ESP32 REST API Contract

All endpoints return permissive CORS headers (`Access-Control-Allow-Origin: *`) and handle HTTP `OPTIONS` preflight.

### `GET /api/state`
Returns engine telemetry JSON:
```json
{
  "t": 184520,
  "irms": 1.742,
  "crest": 1.42,
  "diffIdx": 0.031,
  "flatFrac": 0.061,
  "arcCount": 0,
  "tObj": 33.50,
  "tAmb": 28.20,
  "dT": 5.30,
  "slope": 0.85,
  "ttlMin": 14.50,
  "sT": 0.12,
  "sS": 0.18,
  "sA": 0.00,
  "sL": 0.00,
  "risk": 8.4,
  "level": 0,
  "tripped": false,
  "sensorFault": false,
  "inj": 0
}
```

### `GET /api/wave`
Returns 96 resampled cycle points in centi-Amperes (0.01 A units):
```json
{
  "a": [0, 24, 75, 120, 160, 185, 202, ... 96 samples]
}
```
*Note: The frontend divides each value by 100.0 to display instantaneous Amperes.*

### `GET /api/inject?mode=N`
Fault simulator controls:
- `0`: Normal load (1.7 A bulb, chopper ON, normal joint)
- `1`: Arcing contact (MOSFET chopper introduces random 3–20 sample cycle dropouts)
- `2`: Overload (engages 2nd MR16 bulb via Relay 3, pushing current to ~3.9 A)
- `3`: Bad joint (energizes Relay 2, placing 2.2 Ω 10 W ceramic resistor in series)

### `GET /api/reset`
Clears latched trip state, disables fault injection, and re-closes the circuit (if sensor is healthy).

---

## 8. Safety & Exhibition Notice

> [!CAUTION]
> **ELECTRICAL SAFETY NON-NEGOTIABLE:**
> - The demonstration circuit is powered **strictly from an isolated 12 V AC transformer** with a 5 A secondary fuse and 1–2 A primary fuse.
> - **NEVER** connect this prototype or relay modules directly to 230 V mains power.
> - The 2.2 Ω "bad joint" resistor reaches **80–140 °C** during prolonged heating demonstrations. Always mount on ceramic/metal standoffs behind the 3D-printed guard.
> - The trip relay operates in **fail-safe mode** (coil energized = live; coil de-energized or power loss = open circuit).
