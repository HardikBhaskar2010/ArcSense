import { describe, it, expect, beforeEach } from 'vitest';
import { ArcSenseSimulator } from '../lib/simulator';
import { RiskLevel } from '../types/arcsense';

describe('ArcSense Simulator Physics & State Machine', () => {
  let sim: ArcSenseSimulator;

  beforeEach(() => {
    sim = new ArcSenseSimulator();
  });

  it('runs nominal simulation in mode 0 with repeatable waveform and low risk', () => {
    sim.setMode(0);
    const state = sim.tick(0.5);

    expect(state.inj).toBe(0);
    expect(state.irms).toBeGreaterThan(1.5);
    expect(state.irms).toBeLessThan(2.2);
    expect(state.diffIdx).toBeLessThan(0.08);
    expect(state.arcCount).toBe(0);
    expect(state.tripped).toBe(false);

    const wave = sim.generateWaveform();
    expect(wave.length).toBe(96);
  });

  it('detects arcing contact in mode 1: jumps in diffIdx and arc cycle count', () => {
    sim.setMode(1);

    // First and second ticks should show elevated diffIdx and rising arc counts before trip
    const state1 = sim.tick(0.5);
    expect(state1.diffIdx).toBeGreaterThan(0.12);
    expect(state1.arcCount).toBeGreaterThan(0);
    expect(state1.risk).toBeGreaterThan(15);

    const state2 = sim.tick(0.5);
    expect(state2.diffIdx).toBeGreaterThan(0.12);
    expect(state2.arcCount).toBeGreaterThanOrEqual(state1.arcCount);
  });

  it('detects loose joint heating in mode 3: accelerates temperature rise and slope', () => {
    sim.setMode(3);

    const initialTemp = sim.tick(0.5).tObj;
    let finalState = sim.tick(0.5);

    // Simulate heating over 20 ticks (10 seconds)
    for (let i = 0; i < 20; i++) {
      finalState = sim.tick(0.5);
    }

    expect(finalState.tObj).toBeGreaterThan(initialTemp);
    expect(finalState.slope).toBeGreaterThan(0);
  });

  it('detects overload in mode 2: elevates RMS current above circuit rating', () => {
    sim.setMode(2);
    const state = sim.tick(0.5);

    expect(state.irms).toBeGreaterThan(3.2); // Rated is 3.0A
    expect(state.sL).toBeGreaterThan(0.5); // Load evidence score
  });

  it('latches circuit trip when risk stays in DANGER and opens circuit (0 current)', () => {
    sim.setMode(1); // Rapid arcing mode

    let trippedState = sim.tick(0.5);
    for (let i = 0; i < 15; i++) {
      trippedState = sim.tick(0.5);
      if (trippedState.tripped) break;
    }

    expect(trippedState.tripped).toBe(true);
    expect(trippedState.level).toBe(RiskLevel.DANGER);

    // In tripped state, current must drop to 0 (open fail-safe relay)
    const afterTrip = sim.tick(0.5);
    expect(afterTrip.irms).toBe(0);
    expect(afterTrip.arcCount).toBe(0);
    expect(afterTrip.diffIdx).toBe(0);
  });

  it('resets simulator state back to normal upon reset() call', () => {
    sim.setMode(3);
    for (let i = 0; i < 10; i++) sim.tick(0.5);

    sim.reset();
    expect(sim.getMode()).toBe(0);

    const resetState = sim.tick(0.5);
    expect(resetState.tripped).toBe(false);
    expect(resetState.inj).toBe(0);
  });
});
