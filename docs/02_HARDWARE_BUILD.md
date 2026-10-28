# 02 · Hardware Build Guide

## 0. Safety rules (read first, non-negotiable)

1. **Demo circuit is 12 V AC only**, taken from an isolating transformer. Never connect this prototype, the MOSFETs, the relay modules or the ACS712 to 230 V mains. Relay-module PCBs are not built for safe mains use at school-project quality.
2. The transformer's 230 V side must be **inside a closed, insulated enclosure with a fuse (1–2 A on the primary, 5 A on the secondary)**, wired by or checked by your teacher / ATL in-charge **before first power-up**. Never touch the 230 V side while powered.
3. The "bad joint" resistor reaches **80–150 °C**. Mount it on ceramic/metal standoffs with air around it, behind a guard, **never touching a 3D-printed part** (PLA softens near 60 °C; even PETG deforms around 75–80 °C). Put a "HOT" label next to it.
4. Do not create real sparks/arcs on mains to "prove" the sensor. The chopper emulates the signature safely.
5. Keep a small ABC/CO₂ extinguisher or damp cloth nearby during demos; tell the guide teacher what you are about to run.
6. USB power for the ESP32 should come from a **separate** 5 V adapter/power bank. The 12 V AC loop is isolated by the transformer; the only electrical tie between them is the MOSFET common-source node to ESP32 GND (intended).

## 1. Block diagram

```
                  ┌────────────────────── 5 V USB supply ──────────────────────┐
                  │                                                            │
 ┌──────────┐   ┌─▼──────┐ I2C ┌──────────┐   ┌────────┐   GPIO34 ◄─ divider ◄─ ACS712 OUT
 │ MLX90614 ├───┤        ├─────┤ OLED     │   │ LEDs   │◄──GPIO25/33/32
 │ (IR)     │   │ ESP32  │     └──────────┘   │ buzzer │◄──GPIO27
 └──────────┘   │        ├──GPIO26──► relay IN1 (TRIP)       ┐
  aims at the   │        ├──GPIO16──► relay IN2 (BAD JOINT)  ├ 4-ch relay module (5 V)
  "bad joint"   │        ├──GPIO17──► relay IN3 (LOAD 2)     ┘
                │        ├──GPIO13──► MOSFET gates (chopper)
                │        ├──GPIO14◄── RESET button
                └─Wi-Fi AP "ArcSense-Demo" ──► phone / laptop dashboard
```

**Power loop (12 V AC, floating) — follow the nodes in order:**

| Step | From → To | Notes |
|---|---|---|
| 1 | 12 V AC (A) → **5 A fuse** → **TRIP relay COM**; TRIP relay **NO** → node N1 | coil energised = closed = live (fail-safe) |
| 2 | N1 → **ACS712 IP+**; **IP−** → node N2 | the sensor sits in series with the load |
| 3 | N2 → **JOINT relay COM**. **NC** → node N3 *(direct wire = healthy)*. **NO** → **R_joint (2.2 Ω 10 W)** → N3 | relay energised = current is forced through the resistor |
| 4 | N3 → **Q1 drain**; Q1 source ═ Q2 source; **Q2 drain** → node N4 | MOSFET AC switch (the "chopper") |
| 5 | N4 → **bulb 1** → 12 V AC (B) | main load, ≈ 1.7 A |
| 6 | N4 → **LOAD 2 relay COM**; **NO** → **bulb 2** → 12 V AC (B) | relay energised = second bulb in parallel (overload, ≈ 3.3 A) |

MOSFET gates are joined, go through 100 Ω to GPIO13, with 100 kΩ gate→source; the common source goes to ESP32 GND.

> Build it on the bench in this order and test after each stage (§5). Keep the relay and MOSFET stages **removable by jumper** at first.

## 2. Bill of materials (prices are rough ballparks — verify before buying)

Check **ATL stock first** — most modules below are standard ATL kit items except the IR sensor and transformer.

| # | Part | Qty | Role | Ballpark ₹ |
|---|---|---|---|---|
| 1 | ESP8266 NodeMCU v2/v3 (or ESP32 DevKit V1) | 1 | MCU + Wi-Fi hotspot (Hardware-in-the-Loop simulator or ADC/I2C bridge) | 250–500 |
| 2 | ACS712-**5 A** module | 1 | in-line current sensing (185 mV/A) | 100–200 |
| 3 | MLX90614 module (GY-906) *(optional in software sim mode)* | 1 | non-contact joint temperature | 1,000–1,800 |
| 4 | LiquidCrystal_I2C 1602 LCD (or SSD1306 0.96″ I2C OLED) | 1 | on-device status display | 120–250 |
| 5 | 1-channel or 4-channel 5 V relay module (active-LOW) | 1 | trip + fault-sim relays (D5 on NodeMCU) | 100–350 |
| 6 | IRLZ44N logic-level MOSFET | 2 | back-to-back AC switch (chopper) | 40–100 |
| 7 | Isolating transformer 230 V → 12 V AC, ≥ 5 A (60 VA), fused & enclosed | 1 | safe 12 V AC source | 500–900 |
| 8 | 12 V 20 W bulbs (MR16 halogen) + holders | 2 | main load + overload load | 100–300 |
| 9 | 2.2 Ω 10 W wirewound ceramic resistor | 1 (+1 spare) | the "bad joint" | 20–60 |
| 10 | Fuse holders + 5 A fuse, 2 A fuse | 1 each | protection | 50–100 |
| 11 | Screw-terminal blocks (spring/screw), 14–16 AWG flexible wire | — | joint demo + wiring | 100–200 |
| 12 | 5 mm LEDs R/Y/G, 330 Ω ×3, active buzzer 5 V, push-button | 1 set | indicators | 40–80 |
| 13 | Resistors: 10 kΩ ×1, 20 kΩ ×1 (ADC divider, 1 %), 100 Ω ×1, 100 kΩ ×1 | — | ADC scaling, gate drive | 10 |
| 14 | Perfboard or small PCB, header pins, jumper wires, standoffs, M2.5/M3 screws | — | assembly | 150–300 |
| 15 | 5 V 2 A USB adapter or power bank | 1 | NodeMCU + relays | 200–400 |
| 16 | PETG filament (≈ 150 g) | — | enclosure / probe holder | ATL stock |
| 17 | Matte-black electrical tape or paint | — | raises IR emissivity of the target | 20 |

**Total ≈ ₹1,500–5,000** depending on modules used. 
> **Simulation Mode**: If external sensors (MLX90614, ACS712) are not yet wired, the NodeMCU firmware runs the complete dynamic physics engine onboard, responding to app fault injections, rendering dynamic waveforms, and actuating the physical trip relay on D5.

## 3. Wiring tables

### 3.0 ESP8266 NodeMCU Pinout

| NodeMCU Pin | GPIO | Connects to | Function & Notes |
|---|---|---|---|
| **D1** | GPIO5 | I2C SCL | SCL of LiquidCrystal_I2C 1602 LCD (and optional MLX90614) |
| **D2** | GPIO4 | I2C SDA | SDA of LiquidCrystal_I2C 1602 LCD (and optional MLX90614) |
| **D5** | GPIO14 | Relay IN1 (**TRIP**) | Active-LOW: LOW = Relay ON (Live), HIGH = Tripped (Open circuit) |
| **A0** | ADC0 | ACS712 OUT (via divider) | Analog current input (0–1.0 V range) |
| **VIN / 5V** | — | 5V Relay VCC, 1602 LCD VCC | USB 5V power supply |
| **3V3** | — | 3.3 V Logic / Sensors | (If using 3.3V sensors like MLX90614) |
| **GND** | — | All GNDs | Common Ground |

### 3.1 ESP32 pins (Alternative)

| ESP32 pin | Connects to | Note |
|---|---|---|
| GPIO34 | ACS712 OUT **through divider** (see 3.2) | ADC1 only — ADC2 stops working with Wi-Fi |
| GPIO21 / GPIO22 | SDA / SCL of MLX90614 **and** OLED (same bus) | I2C addresses 0x5A / 0x3C |
| GPIO26 | Relay IN1 = **TRIP** | coil ON = circuit live |
| GPIO16 | Relay IN2 = **BAD JOINT** | ON puts R_joint in series |
| GPIO17 | Relay IN3 = **LOAD 2** | ON adds 2nd bulb |
| GPIO13 | MOSFET gates via 100 Ω | HIGH = load conducting |
| GPIO25 / 33 / 32 | LED green / yellow / red (330 Ω to GND) | |
| GPIO27 | Buzzer + (active buzzer, − to GND) | |
| GPIO14 | Push-button to GND | internal pull-up |
| 3V3 | MLX90614 VIN, OLED VCC | |
| 5V (VIN) | ACS712 VCC, relay module VCC | |
| GND | all grounds **and** MOSFET common-source | |

If your relay module is *active-HIGH*, swap `RELAY_ON/RELAY_OFF` at the top of the sketch.

### 3.2 ACS712 → ESP32 ADC (must be divided)

The ACS712 runs at 5 V and idles at 2.5 V, so its output (up to ~4.5 V) would damage the ESP32 ADC.

```
 ACS712 OUT ──[10 kΩ]──┬── GPIO34
                       │
                     [20 kΩ]
                       │
                      GND
```

Divider ratio = 20/(10+20) = 2/3 → idle ≈ 1.67 V, sensitivity ≈ 123 mV/A at the pin. Use 1 % resistors. Add a 100 nF capacitor from GPIO34 to GND if readings are noisy.

### 3.3 Chopper (fault-simulator AC switch)

Two IRLZ44N with **sources tied together**, drains outward, gates tied together:

```
 12 V path in ──► Q1 drain ... Q1 source ═ Q2 source ... Q2 drain ──► bulb 1
                              gates ──[100 Ω]── GPIO13        100 kΩ gate→source
                              common source ── ESP32 GND
```

With the gate HIGH both MOSFETs conduct in both directions; with it LOW their body diodes block both polarities. A small heatsink helps above ~2 A.

## 4. Mounting the sensors

- **IR sensor:** point it at the *bad-joint* spot (resistor body or the terminal screw head), 2–3 cm away (BCC) or 1–2 cm (BAA). **Shiny metal reads far too cold** (low emissivity) — put a patch of matte-black tape on the target spot.
- **ACS712:** inline with the loop; keep its leads short, away from the relay coils.
- **Airflow:** keep fans away from the joint; they change the heating rate and fool trend-based prediction.

## 5. Build in stages (test each one before moving on)

| Stage | Build | Pass test | Time |
|---|---|---|---|
| 1 | ESP32 alone: upload sketch with `USE_MLX 0`, `USE_OLED 0` | Serial prints "offset … mV" and CSV header | 30 min |
| 2 | ACS712 + divider, **no load** | offset ≈ 1,667 mV; "signal spread" < 0.10 A | 45 min |
| 3 | Add transformer + 1 bulb (supervised) | `irms` ≈ 1.6–1.7 A, `diffIdx` < 0.05, `arcCount` 0 | 1 h |
| 4 | MLX90614 (`USE_MLX 1`) | object temp ≈ room temp; warm hand → rises | 45 min |
| 5 | OLED + LEDs + buzzer + button | levels change when you cover/warm the sensor | 1 h |
| 6 | Trip relay in the loop | simulated DANGER opens the circuit; button re-closes | 1 h |
| 7 | Wi-Fi + dashboard | phone joins `ArcSense-Demo`, opens `http://192.168.4.1/`, shows **LIVE DEVICE** | 30 min |
| 8 | Fault simulator (bad joint, load 2, chopper) | each dashboard button triggers its fault | 2 h |
| 9 | Calibration + trials (below) | table in doc 01 §10 filled | 3 h |

## 6. Calibration

1. **Offset:** boot with the load OFF → serial prints `offset … mV`. Expected ≈ 1,667 mV. If far off (±100 mV), check divider and 5 V supply.
2. **Current scale:** with the bulb on, compare `irms` in the CSV with a multimeter/clamp meter reading. Error should be < 5 %. If not, adjust `MV_PER_A` slightly in the sketch (ACS712 modules vary).
3. **Noise floor:** with the load OFF, "signal spread" should be < 0.10 A. If higher, add the 100 nF capacitor, shorten wires, and raise `diffThresh` from 0.15 toward 0.20 (doc 03 §6).
4. **Thermal:** compare MLX readings with a kitchen/IR thermometer on the same spot with matte tape. Note any offset and mention it in your write-up.
5. **Time constants:** run the bad-joint scenario and look at the slope. Aim for roughly **2–8 °C/min** at the sensor; if it heats much faster or slower, change resistor value (2.2 Ω ↔ 1 Ω ↔ 3.3 Ω) or sensor distance.

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `irms` always 0 | Cycle never detected: load off, amplitude too low, wrong offset | Check load ≥ 0.5 A; check offset print; verify divider |
| `diffIdx` high on a plain bulb | Noisy ADC or loose wire at the ACS712 | Shorter leads, 100 nF cap, check terminals |
| Dashboard says LINK LOST | Phone left the hotspot, or phone switched to mobile data | Re-join `ArcSense-Demo`, disable mobile data |
| MLX90614 not found | Wrong I2C pins / 5 V on the 3.3 V pin | Check wiring; `Wire.begin()` pins 21/22 |
| Relay clicks but circuit doesn't open | Module is active-HIGH / wired to NC | Swap `RELAY_ON`, check NO/NC |
| Trip appears at boot | Sensor fault fail-safe | Check MLX connection; with `USE_MLX 0` this cannot happen |
| Temperature reads too low | Shiny target | Matte-black tape on the spot |
| ESP32 resets when relays click | 5 V supply too weak | Use ≥ 2 A supply, add 470 µF across 5 V |

## 8. Pre-demo checklist

- [ ] Fuses installed and transformer enclosure closed
- [ ] Hot resistor on standoffs, guarded, labelled
- [ ] Offset print looks right; dashboard shows LIVE DEVICE
- [ ] Phone fully charged, hotspot password known, **backup video** on phone
- [ ] Spare fuse, spare bulb, spare jumper wires, spare USB cable
- [ ] Printed copy of the trial table and the circuit diagram
