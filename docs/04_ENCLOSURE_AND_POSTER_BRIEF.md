# 04 · Brief for YOUR 3D-printed parts and poster

You are designing these yourself, so this is a *what must be in it* checklist, not a design. Tick everything off before you print / send to the press.

---

# Part A — 3D-printed parts

## A1. Parts to design (priority order)

| # | Part | Must do | Priority |
|---|---|---|---|
| 1 | **Monitor box** (base + lid) | Holds ESP32, relay module, divider board; shows OLED and LEDs; keeps 12 V wiring away from the logic board | Must |
| 2 | **IR sensor arm** | Holds the MLX90614 at a fixed, adjustable distance and aims it at the "bad joint" | Must |
| 3 | **Fault-simulator bench** | Labeled layout for transformer, ACS712, bad joint, chopper, bulbs; hot parts guarded | Must |
| 4 | **Hot-zone guard** | Grille/cage around the 10 W resistor; judges' fingers can't reach it | Must (safety) |
| 5 | **Cable clips, strain reliefs, labels** | Tidy wiring = workmanship marks | Should |
| 6 | **Display stand** for phone/tablet showing the dashboard | Angled, stable, cable slot | Should |
| 7 | **"Home wall + socket" cutaway diorama** with an LED that goes green→amber→red | Storytelling piece | Nice-to-have |

## A2. Monitor box checklist

**Front face**
- [ ] OLED window — module PCB ≈ 27 × 27 mm, visible area ≈ 22 × 11 mm; add a 1 mm bezel recess so the glass sits flush
- [ ] Three LED holes (Ø5 mm) in the order **green · yellow · red**, each labelled; a light-pipe or translucent insert diffuses them
- [ ] Reset button hole sized to your actual button (measure it) with a printed cap or label "RESET"
- [ ] Buzzer grille — a ring of Ø1.5 mm holes, sound path not blocked by the lid
- [ ] Name plate recess or embossed text: **ArcSense** (text ≥ 0.6 mm raised or 0.4 mm engraved)

**Sides / rear**
- [ ] USB cut-out lined up with the ESP32 USB connector (check the *board*, not the datasheet)
- [ ] Two cable entries for the 12 V loop (in/out), with strain relief or a zip-tie anchor
- [ ] One entry for the IR sensor cable
- [ ] Ventilation slots near the relay module (top and bottom)

**Inside**
- [ ] Mounting posts at your board's *measured* hole spacing; M2.5/M3 screws or heat-set inserts
- [ ] **A divider wall** between the "12 V loop wiring" side and the "ESP32/logic" side
- [ ] The ESP32 antenna end stays clear of metal and thick walls
- [ ] Space for fingers/screwdriver to reach terminals with the lid off
- [ ] Wire channels so nothing is pinched when the lid closes

**Lid**
- [ ] Locating lip so the lid can't slide; 4 screw bosses
- [ ] Printed label: "Demo circuit ≤ 12 V AC only"

## A3. IR sensor arm checklist
- [ ] Sensor held 2–3 cm from the target; slotted mount so you can adjust the distance
- [ ] Clear field of view (BCC = 35° cone; BAA = 90°): nothing else warm inside the cone
- [ ] Min. 3 cm of air gap from the hot resistor to any printed surface; use PETG, never PLA
- [ ] Optional: a transparent printed "view cone" mock-up so judges can *see* the sensing area

## A4. Fault-simulator bench checklist
- [ ] Flat base from plywood/acrylic/MDF (large flat 3D prints warp); printed brackets on top
- [ ] Zones in flow order, left to right: **SOURCE → TRIP → SENSE → BAD JOINT → CHOPPER → LOADS** with arrows and labels
- [ ] Resistor on ceramic/metal standoffs, "HOT" label, guard (A1 #4)
- [ ] Bulb holders with room for the second bulb
- [ ] Transformer enclosure fixed to the base, cables strain-relieved
- [ ] Everything reachable for a fuse change

## A5. Print settings and rules of thumb (verify with a test coupon)

| Item | Suggestion |
|---|---|
| Material | **PETG** for anything within 10 cm of the resistor or relays; PLA only for labels/stands far from heat |
| Layer / walls | 0.2 mm layers, ≥ 3 perimeters (≈ 1.2 mm walls) → box walls 2–2.4 mm |
| Infill | 20–25 % |
| Clearance | +0.3 mm on every fit (lid lip, button holes, USB cut-out) |
| Screw holes | Pilot for M3 self-tapping ≈ 2.8 mm, M2.5 ≈ 2.2 mm, heat-set insert ≈ 4.0–4.2 mm — **print a 10-minute test coupon first** |
| Orientation | Box opening up, lid flat on bed; avoid supports on visible faces |
| Fit test | Print a 3-layer footprint of each PCB first (saves hours of filament) |
| Colours | Dark body (black/grey) + one accent matching your poster palette |
| Time plan | Print the monitor box by **Mon 26 Oct**; arm, guard, clips by Tue 27 Oct |

## A6. Component sizes — approximate, **measure your own with calipers**

| Component | Approx. size (mm) |
|---|---|
| ESP32 DevKit V1, 30-pin | 51 × 26 (38-pin ≈ 55 × 28) |
| 4-ch relay module | ≈ 73 × 50 × 18 |
| ACS712-5A module | ≈ 31 × 13 |
| MLX90614 GY-906 module | ≈ 17 × 11 (the can is ≈ Ø9) |
| SSD1306 0.96″ OLED module | ≈ 27 × 27 |
| MR16 bulb | Ø50 |
| 10 W ceramic resistor | ≈ 22 × 10 × 9 |
| 12 V transformer (60 VA) | depends on the unit you buy |

---

# Part B — Poster

## B1. Decide first
- [ ] **Ask your guide teacher the required size/format** (A1 / A2 / tri-fold / chart paper) and whether a table is provided. Design at A1 portrait (594 × 841 mm); it scales down cleanly.
- [ ] Print on matte paper if you can; gloss reflects hall lights.
- [ ] **Light background, dark text** — exhibition halls are bright, and dark posters fade and eat ink. Use the dashboard's four level colours (green/yellow/orange/red) as accents so the poster and demo look like one system.

## B2. Required content, in reading order

| # | Section | Must include | Words |
|---|---|---|---|
| 1 | **Header** | ArcSense · tagline (≤ 8 words, e.g. "Catching electrical fires before they start") · chip "C2 · Disaster Management" · your names, class, school, guide teacher | ≤ 25 |
| 2 | **The problem** | One big number with its source + one line on why breakers miss it. Use only statistics you've verified (doc 01 §1) | ≤ 40 |
| 3 | **How it works** | Large block diagram: **SENSE → THINK → PREDICT → PROTECT**, with photos of *your* hardware | diagram |
| 4 | **The science** | (a) Joule heating, P = I²R + *your* heating curve with the predicted line · (b) clean vs arcing waveform screenshots from *your* dashboard + the `diffIdx` formula · (c) the risk formula and 4 levels | ≤ 60 |
| 5 | **Results** | Your trial table (10 runs per scenario) · 3 headline numbers: detection rate, false alarms, time-to-trip · photo of the live dashboard · "measured in school ATL" | table |
| 6 | **Safe by design** | Fail-safe relay · 12 V isolated demo · what it is *not* (prototype, not a certified AFCI/MCB replacement) | ≤ 35 |
| 7 | **Impact & scale** | Who benefits (homes, shops, schools, server rooms) · cost per circuit · link to SDG target 11.5 (reduce disaster deaths and losses) and the Viksit Bharat theme | ≤ 35 |
| 8 | **Footer** | 3–4 short references · **QR code** to your 60-s demo video · thanks to teacher/ATL in-charge | ≤ 30 |

Total body text target: **≈ 250 words**. A judge should get the story in 60 seconds from 1.5 m away.

## B3. Visual checklist
- [ ] Title ≥ 120 pt, section headings 48–60 pt, body ≥ 28 pt, captions ≥ 20 pt (A1)
- [ ] Max 2 typefaces; max 5 colours; plenty of white space
- [ ] Every number carries a tiny source tag
- [ ] Photos are of *your real build*; no stock fire images presented as your results, no AI-generated "hardware"
- [ ] Don't rely on colour alone (add icons/words for G/Y/O/R)
- [ ] Graphs: labelled axes, units, legend, readable from 1 m
- [ ] QR code ≥ 3 cm square; scan it from 1.5 m on two different phones
- [ ] Images ≥ 150 dpi at final print size; export PDF with fonts embedded
- [ ] Print an A4 draft, tape it on a wall, step back 2 m, and read it

## B4. Never put on the poster
- Unverified statistics ("80% of Delhi fires…", "4 in 5 electrical fires…") unless you've confirmed the primary source
- "100% safe", "prevents all fires", "replaces MCB/ELCB/AFCI"
- Simulated results presented as measured ones — the dashboard's yellow SIMULATED badge exists for a reason
- Claims about certification or testing you haven't done

## B5. Table-top layout (for the exhibition table)

```
 [ POSTER, left or behind ]  [ MONITOR BOX centre, OLED facing judges ]  [ PHONE/LAPTOP stand: dashboard ]
                              [ FAULT BENCH on the right, HOT zone at the far side, guard + label ]
 In front: tent card "What am I looking at?" + QR code + printed trial table
```

Extras worth bringing: an A4 handout with the block diagram and trial table; a one-page "How to read the dashboard" card; a power strip and a long cable.
