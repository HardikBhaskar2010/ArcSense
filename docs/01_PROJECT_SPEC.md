# 01 · Project Specification — ArcSense

**Pre-fire electrical fault predictor** · Science & Mathematics Exhibition 2026-27 · Category **C2** · Sub-theme **Disaster Management** (also supports *Green Energy & Environmental Conservation* through energy-loss prevention)

Theme link: *"Science, Technology, and Innovation for Sustainable and Viksit Bharat"* → fire prevention in homes and small shops is cheap, local, and scalable.

---

## 1. The problem (with sources)

Electrical faults are one of the most-cited causes of fires in India, and the data is probably *understating* them.

| Fact | Source |
|---|---|
| 2024: **5,971** fire accidents in India; **1,042** attributed to *electrical short circuit*; **3,464 (58%)** filed under "other causes" | NCRB data compiled by Dataful (dataful.in/datasets/19990). The 58% is my arithmetic from the dataset rows. |
| 2023: **1,780** electrical short-circuit cases (dataset rows sum to 7,054 fires ≈ 25%) | Same dataset; percentage is my arithmetic |
| Electrical short circuit share of fire accidents rose from **3% (1996) to 21% (2022)** | Factly analysis of NCRB ADSI reports |
| Delhi fire deaths: **77** (2023-24), **90** (2024-25), **84** (2025-26); **543** between 2019 and March 2026 | Business Standard, citing Delhi Fire Service data |
| Summer 2026: Delhi Fire Services handled **7,800+** calls; officials blame short circuits, overheated appliances and overloaded wiring | The Sunday Guardian, 28 Jun 2026 |
| Fires due to short circuits are commonly traced to loose wiring, poor-quality fittings, and poor maintenance | IndiaSpend / Times of India (2015) |

**Do not put these on your poster until you open each source yourself.** Two more claims are widely repeated on exam-prep sites ("80% of Delhi fires are electrical", "micro-arcing causes 4 of 5 electrical fires") but I could not trace them to a primary source. Leave them out unless you verify them.

**Why normal protection misses it.** An MCB/fuse reacts to *large* current. A loose or corroded joint can overheat, or arc, at a perfectly normal current. US patent literature on arc-fault detection states that arcing-fault current can be *"reduced by branch or load impedance to a level below the trip curve settings of the circuit breaker"* (US 7,253,637). Dedicated arc-fault breakers (AFCI) exist, but a policy analysis summarised by IAS Gyan says Indian residential codes do not prescriptively mandate them (secondary source — verify).

## 2. The idea in one sentence

ArcSense watches **how a circuit's current waveform behaves** and **how fast a joint is heating up**, combines both into a single fire-risk score, **predicts minutes-to-danger**, and opens a fail-safe relay *before* ignition.

## 3. What is original here (say this to the judges)

1. **Predicts instead of just measuring** — a rate-of-rise model gives *minutes to alarm*, not just "temperature is high".
2. **Two independent physical signatures fused** — heat (resistive joint) and waveform distortion (arc). Either alone misses cases.
3. **Cycle-to-cycle differencing** — an arc is *random*, a dimmer or switch-mode supply is *repeatable*. Comparing each mains cycle with the previous one separates them without heavy DSP, so it runs on a ₹500 microcontroller.
4. **Fail-safe by design** — relay coil is energised only while healthy; a dead sensor, crashed MCU or lost power all open the circuit.
5. **Honest demo** — a built-in fault simulator on a 12 V isolated loop lets you reproduce each fault safely, repeatedly, and log the results.

## 4. Scientific principle

**Heat (Joule heating).** A poor joint adds contact resistance R_c. Power dissipated there is P = I²R_c. As the joint oxidises R_c rises, so P and temperature rise together (positive feedback). The IR sensor reads the joint's surface temperature without touching it; a least-squares line over the last 30 s gives slope (°C/min), and

`time_to_alarm = (T_alarm − T_now) / slope`

**Arc signature.** An electric arc strikes and extinguishes at random points in the AC cycle, creating random flat "shoulders" and sudden current steps (described in US 6,839,208: an arc *"randomly starts, generates a di/dt step in current … and then extinguishes at the approach of the next current zero cross"*). Normal loads repeat almost identically each cycle. We measure

`diffIdx = Σ |cycle_n[j] − cycle_(n−1)[j]| / Σ |cycle_n[j]|`

(~0.02 for a healthy load, 0.2+ for arcing). More than 10 arc-like cycles in one second raises the alarm.

**Evidence fusion (noisy-OR).** Each evidence score s_i∈[0,1] has a weight w_i. `Risk = 100 × (1 − Π(1 − w_i·s_i))`. Independent clues add up; one very strong clue is enough on its own.

## 5. System overview

```
 12 V AC ─► fuse ─► [TRIP relay] ─► [ACS712 current] ─► [bad-joint R] ─► [MOSFET chopper] ─► LOAD
  (isolated        fail-safe          sensor              fault sim          fault sim         bulbs
   transformer)    coil ON=live                          (relay+resistor)   (random dropouts)

 MLX90614 IR ──► joint temperature ┐
 ACS712 ──► 5 kHz ADC ─► per-cycle features ┴─► ESP32: risk engine ─► LEDs, buzzer, OLED
                                                              └─► Wi-Fi hotspot ─► live dashboard (phone/laptop)
```

## 6. Target specifications (design targets, **not yet measured**)

| Item | Target |
|---|---|
| Demo circuit | ≤ 12 V AC (SELV), ≤ 4 A, isolated from mains |
| Current sampling | 5 kHz, 96-point cycle analysis, ~50 cycles/s |
| Arc detection time | < 2 s (synthetic test: 1.4 s) |
| Thermal prediction | updates every 1 s from a 30 s window |
| Trip action | relay opens after DANGER persists 1 s |
| False alarms | 0 in 30 min of normal / dimmer / switching loads (**to be measured by you**) |
| Cost (prototype) | ≈ ₹3,500–6,000 (see hardware doc; check prices) |

## 7. Honest limitations (put these in your write-up — judges respect them)

- It is a **prototype early-warning layer**, not a certified AFCI/MCB replacement. Real products are tested to safety standards (e.g. UL 1699 for AFCI); this is not.
- The demo **emulates** arc signatures (random current dropouts, a bad-joint resistor). Reproducing real mains arcs in a school is unsafe and not done.
- Thresholds were tuned on **synthetic waveforms**; they must be re-tuned on your hardware (doc 03, §6).
- One sensor, one circuit. A real deployment would use one node per sub-circuit.
- Works for 50 Hz AC loops with current above ~0.5 A.

## 8. Mapping to the judging criteria

| Criterion (weight) | How ArcSense answers it | What to show |
|---|---|---|
| Child's own creativity & imagination (20%) | Your choice of the problem, your fault-simulator design, your enclosure and poster, your test data | Notebook with sketches, failed attempts, your own measurements |
| Originality / innovation (15%) | Predictive time-to-alarm, fusion, cycle differencing, fail-safe | The "what is original" list (§3) |
| Scientific approach (15%) | Joule heating, arc physics, regression, evidence fusion, control experiments | Equations on poster; trial table |
| Technical skill / workmanship (15%) | Clean wiring, working fault simulator, printed enclosure, live dashboard | Tidy build, labelled wires, strain relief |
| Utility / scalability (15%) | Homes, shops, schools, server rooms; ESP32 node per circuit | Cost-per-circuit estimate, deployment sketch |
| Low cost / portability / durability (10%) | ~₹ cost, runs from a power bank, printed PETG case | BOM on poster, carry-case |
| Presentation (10%) | 60-second pitch, 3-minute live demo, backup video | Doc 05 |

> **Important:** the "own creativity" criterion is the heaviest. Judges will ask *why* you did things. Use the code and specs as scaffolding, but build it with your own hands, change something (a threshold, a feature, a layout), and be able to explain every line you present.

## 9. Ready-to-edit abstract (≈150 words)

> Electrical faults are among the most frequently cited causes of fires in Indian homes and shops, yet ordinary breakers react only to large currents and cannot see a loose joint that quietly overheats or arcs at normal current. ArcSense is a low-cost early-warning device built around an ESP32. A current sensor samples the AC waveform at 5 kHz and compares each mains cycle with the previous one; random arcing makes consecutive cycles differ, whereas normal loads repeat. An infrared sensor tracks joint temperature and fits a line to estimate minutes remaining before a dangerous temperature. The two clues are fused into a 0–100 fire-risk score shown on an OLED, LEDs and a live web dashboard, and a fail-safe relay opens the circuit when risk stays high. A 12 V isolated fault simulator reproduces loose-joint heating, arcing and overload safely for demonstration and testing.

## 10. Validation plan — fill this in with your own measurements

Run each scenario **10 times** and record. This table is what turns a "model" into "science".

| Scenario | Runs | Detected (WARNING+) | Tripped | Mean time to WARNING (s) | Mean time to trip (s) | Notes |
|---|---|---|---|---|---|---|
| Normal load, 10 min | | | | | | false-alarm check |
| Dimmer / fan regulator on loop | | | | | | false-alarm check |
| Load switch-on / off | | | | | | false-alarm check |
| Loose joint (heating) | | | | | | |
| Arcing contact (chopper) | | | | | | |
| Overload | | | | | | |

Also report: **detection rate**, **false-alarm rate per hour**, and **object temperature at trip** for the heating runs.

## 11. References to cite on the write-up

1. NCRB, *Accidental Deaths & Suicides in India* (ADSI) — fire accident tables; dataset via Dataful.
2. Factly, "Fire accidents in India" analyses of NCRB data.
3. US Patent 6,839,208 and US 7,253,637 — arc-fault interrupter background (arc signatures; limits of breaker trip curves).
4. Delhi Fire Service figures as reported by Business Standard / The Sunday Guardian (2026).
5. Your own CSV logs from the dashboard.
