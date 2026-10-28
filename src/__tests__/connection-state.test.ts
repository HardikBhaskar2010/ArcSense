import { describe, it, expect, beforeEach } from 'vitest';
import { useArcSenseStore } from '../lib/store';
import { RiskLevel } from '../types/arcsense';

describe('Connection State and Event Logging', () => {
  beforeEach(() => {
    useArcSenseStore.setState({
      baseUrl: 'http://192.168.4.1',
      connectionMode: 'CONNECTING',
      isSimulator: false,
      isStale: false,
      consecutiveFails: 0,
      eventLogs: [],
      sessionSamples: [],
      lastState: null,
    });
  });

  it('transitions to LINK_LOST and sets isStale to true after consecutive failures', () => {
    const store = useArcSenseStore.getState();

    // 1st failure
    store.handlePollFailure();
    expect(useArcSenseStore.getState().isStale).toBe(true);
    expect(useArcSenseStore.getState().consecutiveFails).toBe(1);

    // 2nd failure
    store.handlePollFailure();
    expect(useArcSenseStore.getState().consecutiveFails).toBe(2);

    // 3rd failure triggers LINK_LOST
    store.handlePollFailure();
    expect(useArcSenseStore.getState().connectionMode).toBe('LINK_LOST');
    expect(useArcSenseStore.getState().isStale).toBe(true);
  });

  it('transitions to LIVE on poll success and clears stale flag', () => {
    const store = useArcSenseStore.getState();
    store.handlePollFailure();
    expect(useArcSenseStore.getState().isStale).toBe(true);

    store.handlePollSuccess();
    expect(useArcSenseStore.getState().connectionMode).toBe('LIVE');
    expect(useArcSenseStore.getState().isStale).toBe(false);
    expect(useArcSenseStore.getState().consecutiveFails).toBe(0);
  });

  it('records meaningful events on risk level transition and relay trip without duplicating every cycle', () => {
    const store = useArcSenseStore.getState();

    const normalSample = {
      t: 1000,
      irms: 1.7,
      crest: 1.4,
      diffIdx: 0.02,
      flatFrac: 0.06,
      arcCount: 0,
      tObj: 30.0,
      tAmb: 28.0,
      dT: 2.0,
      slope: 0.0,
      ttlMin: -1,
      sT: 0,
      sS: 0,
      sA: 0,
      sL: 0,
      risk: 10,
      level: RiskLevel.NORMAL,
      tripped: false,
      sensorFault: false,
      inj: 0 as const,
    };

    store.recordTelemetry(normalSample);
    const initialLogCount = useArcSenseStore.getState().eventLogs.length;

    // Send identical sample (no transition): should not produce duplicate transition logs
    store.recordTelemetry(normalSample);
    expect(useArcSenseStore.getState().eventLogs.length).toBe(initialLogCount);

    // Transition to DANGER with relay trip
    const dangerTripSample = {
      ...normalSample,
      t: 2000,
      risk: 85,
      level: RiskLevel.DANGER,
      tripped: true,
    };

    store.recordTelemetry(dangerTripSample);
    const updatedLogs = useArcSenseStore.getState().eventLogs;
    expect(updatedLogs.length).toBeGreaterThan(initialLogCount);

    const tripLog = updatedLogs.find((l) => l.type === 'trip');
    expect(tripLog).toBeDefined();
    expect(tripLog?.message).toContain('TRIPPED');
  });
});
