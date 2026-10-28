# 05 · Presentation, Q&A, write-up and 8-day plan

## 0. What the rules say (from the DoE circular and the portal, checked 22 Oct 2026)

- School-level selection happens first: a panel of **three science teachers headed by the Principal** evaluates; the school sends **one best exhibit per category** (C1, C2, C3) to the Zonal level.
- Each exhibit: **max 2 students + 1 guide teacher**. Registration is done **only by the Principal/HoS** through the portal's Google Form.
- Portal schedule: **School level by 30.10.2026**, Zonal by 15.11.2026, Science Centre by 28.11.2026, State by 15.12.2026. *(One guideline on the same page says the registration date is "to be declared" — ask your teacher which is correct.)*
- At the exhibition you must explain: **the problem, the scientific principle, how it works, applications, significance.** A written **write-up** is submitted at State level.
- Judging weights: creativity 20 · originality 15 · scientific approach 15 · workmanship 15 · utility/scalability 15 · low cost/portability/durability 10 · presentation 10.
- Safety of students is stressed in the guidelines — your safety measures are part of the story.

**First thing tomorrow:** ask your teacher (1) the school-level exhibition date, (2) team size (you + 1?), (3) poster/table format, (4) whether a mains socket is available at the venue.

## 1. The 60-second pitch (≈ 150 words — rewrite in your own voice)

> "Many fires in homes and shops start with an electrical fault — a loose joint that slowly heats up, or a connection that sparks. Fire-service officials say short circuits and overloaded wiring drive a lot of Delhi's fire calls. A normal breaker only reacts to big currents, so it can miss these faults.
> ArcSense watches two things. First, the current waveform: a normal load repeats every 20 milliseconds; an arc doesn't, and the device measures that difference. Second, the temperature of the joint, using an infrared sensor, and it predicts how many minutes are left before it gets dangerous.
> It combines both into a fire-risk score, shows it here, and opens a fail-safe relay if the risk stays high.
> It costs a few thousand rupees for a prototype, runs from a power bank, and every circuit in a home could get one. Let me show you."

## 2. The 3-minute live demo run-sheet

| Time | You do | Judge sees | You say (key line) |
|---|---|---|---|
| 0:00 | Point to the poster block diagram | Sense → Think → Predict → Protect | "Four jobs: sense, think, predict, protect." |
| 0:15 | Bulb on, **Normal load** | Green, risk ≈ 0, clean sine on dashboard | "Healthy circuit: every cycle looks the same." |
| 0:30 | Show the **dimmer/fan regulator** (if you have one) | Still green | "Distorted, but repeatable — so not a fault. That's why we compare cycle to cycle." |
| 0:50 | Press **Loose joint (heating)** | Temperature rising, slope, *time-to-alarm countdown* | "It doesn't wait for 75 °C; it predicts when it will get there." |
| 1:30 | Level hits WARNING → DANGER → **TRIP** | Buzzer, red LED, bulb goes out | "Relay coil releases — if the device itself fails, the circuit also opens." |
| 1:50 | Wait for cool-down; press **RESET** | Back to NORMAL (or WARNING while still hot) | "Still warm, so it stays cautious." |
| 2:00 | Press **Arcing contact** | Waveform becomes ragged; arc counter jumps | "No heat yet, no overcurrent — a thermometer or a breaker would miss this." |
| 2:20 | Show **CSV download / trial table** | Table of 10-run results | "Each scenario run ten times; this is our detection rate and false alarm rate." |
| 2:40 | Point to the HOT label and the 12 V sign | Safety | "Demo is 12 V isolated. It's a prototype, not a certified product." |
| 2:50 | Offer questions | | |

**If anything fails:** say "Let me show the recorded run", play the backup video on the phone, then continue with the poster. A calm recovery scores better than a perfect demo.

## 3. Questions judges are likely to ask — with honest answers

| Question | Strong answer (put in your own words) |
|---|---|
| How is this different from an MCB or fuse? | They protect against large overcurrent. ArcSense targets faults that happen at normal current — a heating joint or an intermittent arc — and gives early warning plus prediction. It adds protection; it doesn't replace them. |
| Is this an AFCI? | It uses the same idea — arcs have a recognisable signature — but it's a low-cost prototype that isn't certified. Real AFCIs are tested to standards; ours isn't. |
| Are you creating real arcs? | No. Real mains arcs are dangerous. The chopper emulates the *signature* (random dropouts) on a 12 V isolated loop, and the heating is real. |
| How do you avoid false alarms? | We compare each cycle with the previous one: dimmers and power supplies repeat, arcs don't. We ignore load switching for 3 cycles, require > 10 arc-like cycles in a second, and use hysteresis. I tested [your numbers] hours of normal operation with [n] false alarms. |
| Why predict temperature rise rather than just set a limit? | A fixed limit warns late. The slope tells how fast the joint is heating, so we can estimate minutes remaining and act earlier. |
| What's the maths? | Joule heating P = I²R; least-squares slope over 30 s; cycle difference `Σ|c−p| / Σ|c|`; noisy-OR fusion `1 − Π(1 − w·s)`. |
| Why an ESP32? | Dual-core, ADC fast enough for 5 kHz sampling, built-in Wi-Fi for the dashboard, costs about ₹500. |
| Why 12 V? | Safety. The detection logic is the same at 230 V, but a school demo must stay in the safe extra-low-voltage range. Real deployment would need a certified, isolated mains design. |
| What are the limitations? | Prototype; synthetic-tuned thresholds re-tuned on my rig; one circuit per node; needs ≥ 0.5 A; thermal sensor needs a clear view of the joint and a matte spot. |
| How much would it cost at scale? | Prototype ₹[your BOM]; the ESP32 + current sensor + IR sensor core is the bulk, and volume and a custom PCB would reduce it. (Don't quote a number you haven't worked out.) |
| What did *you* design and what did you borrow? | Be specific: the fault simulator, the enclosure, thresholds, test plan, the poster; libraries for the sensors/OLED. Say which parts of the code you modified and why. |
| What went wrong while building it? | Have 1–2 real stories (e.g. "dimmer waveforms caused false arc flags until I changed how cycles are aligned"). This is a strong answer. |
| Where would it be used? | Home distribution boards, shops, school labs, server-room racks — wherever a joint can overheat unnoticed. |
| What would you do next? | Per-circuit nodes with a hub, learning-mode baselines, real-power measurement with a voltage sensor, field trials, certification path. |

## 4. Write-up outline (1–2 pages for the exhibition file)

1. Title, category/sub-theme, students, guide, school
2. Problem and why it matters (with 2–3 verified sources)
3. Objective
4. Scientific principles (Joule heating, arc signature, regression, fusion)
5. Design: block diagram, circuit diagram, photos
6. How it works (step-by-step, including the fault simulator)
7. Results: trial table, dashboard screenshots, what worked and what didn't
8. Safety measures and limitations
9. Applications, cost and scalability
10. Conclusion and future work
11. References and acknowledgements

## 5. What to bring

Fuses (spare), bulbs (spare), jumper wires, USB cables ×2, power strip + extension, phone with backup video, charged power bank, printed trial table + block diagram, screwdriver, zip ties, tape, a damp cloth/small extinguisher per venue rules, and a written list of the teacher's phone number.

## 6. Eight-day plan (Thu 22 Oct → Fri 30 Oct)

Build **in tiers**; each tier is a presentable project by itself, so you're never left with nothing.

| Tier | What | Done by |
|---|---|---|
| **1 — Must** | ESP32 + ACS712 + bulb + MLX + OLED/LEDs → live risk score | Sat 24 Oct |
| **2 — Should** | Trip relay + Wi-Fi dashboard | Sat 24–Sun 25 Oct |
| **3 — Should** | Fault simulator (bad joint, chopper, overload) + trial table | Tue 27 Oct |
| **4 — Polish** | Printed enclosure, poster, backup video | Wed 28 Oct |

| Day | Plan |
|---|---|
| **Thu 22** | Ask the four questions (§0). Check ATL stock vs BOM; list what to buy. Run `test_core` on your laptop. Flash ESP32 (hardware doc stages 1–2). |
| **Fri 23** | Stages 3–4: transformer + bulb (supervised), MLX90614. Fix compile issues. |
| **Sat 24** | Stages 5–7: OLED, LEDs, trip relay, Wi-Fi dashboard. **Tier 1 + 2 finished.** Start the enclosure CAD. |
| **Sun 25** | Stage 8: fault simulator. Start printing the monitor box. |
| **Mon 26** | Calibration (hardware doc §6). Print arm, guard, clips. Start trials. |
| **Tue 27** | 10-run trials per scenario; save CSVs; fill the trial table; draft poster with real graphs. |
| **Wed 28** | Assemble into the enclosure; **send the poster to print**; record the 60-s backup video; draft the write-up. |
| **Thu 29** | Full rehearsal with your teacher (pitch + Q&A). Pack the kit. |
| **Fri 30** | School-level presentation / registration deadline. |

**Cut order if time runs short:** diorama → display stand → printed bench (use a plywood board) → LOAD 2 overload relay → chopper (keep heating + arc via the dashboard's simulator labelled as such). Never cut: the 12 V isolation, the fuse, the hot-zone guard, and the honesty about what is simulated.
