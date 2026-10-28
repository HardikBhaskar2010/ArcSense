import { describe, it, expect } from 'vitest';
import { sanitizeStateResponse, sanitizeWaveformResponse } from '../lib/arcsense-api';
import { RiskLevel } from '../types/arcsense';

describe('API Parsing and Validation', () => {
  it('correctly parses a standard valid ESP32 state payload', () => {
    const raw = {
      t: 123456,
      irms: 1.742,
      crest: 1.42,
      diffIdx: 0.032,
      flatFrac: 0.061,
      arcCount: 0,
      tObj: 34.5,
      tAmb: 29.1,
      dT: 5.4,
      slope: 1.2,
      ttlMin: 15.3,
      sT: 0.1,
      sS: 0.2,
      sA: 0.0,
      sL: 0.0,
      risk: 12.5,
      level: 0,
      tripped: false,
      sensorFault: false,
      inj: 0,
    };

    const parsed = sanitizeStateResponse(raw);
    expect(parsed.t).toBe(123456);
    expect(parsed.irms).toBeCloseTo(1.742);
    expect(parsed.crest).toBeCloseTo(1.42);
    expect(parsed.diffIdx).toBeCloseTo(0.032);
    expect(parsed.tObj).toBeCloseTo(34.5);
    expect(parsed.level).toBe(RiskLevel.NORMAL);
    expect(parsed.tripped).toBe(false);
    expect(parsed.sensorFault).toBe(false);
    expect(parsed.inj).toBe(0);
  });

  it('safely handles missing, null, or malformed fields without crashing', () => {
    const malformed = {
      t: 'invalid_num',
      irms: undefined,
      crest: null,
      diffIdx: NaN,
      level: 99, // Out of bounds level
      risk: 150, // Out of bounds risk
      tripped: 'true',
      sThermal: 0.85, // legacy field naming fallback
    };

    const parsed = sanitizeStateResponse(malformed);
    expect(typeof parsed.t).toBe('number');
    expect(parsed.irms).toBe(0);
    expect(parsed.crest).toBe(1.414);
    expect(parsed.diffIdx).toBe(0);
    expect(parsed.level).toBe(RiskLevel.NORMAL); // clamped/fallback
    expect(parsed.risk).toBe(100); // clamped to 100
    expect(parsed.tripped).toBe(true);
    expect(parsed.sT).toBe(0.85); // fallback succeeded
  });

  it('throws a descriptive error when non-object is provided to sanitizeStateResponse', () => {
    expect(() => sanitizeStateResponse(null)).toThrow('Invalid telemetry payload: not an object');
    expect(() => sanitizeStateResponse('string_error')).toThrow('Invalid telemetry payload: not an object');
  });

  it('correctly parses 96-sample waveform from centi-Amps to Amperes', () => {
    // 96 integers representing 0.01A units (e.g. 175 = 1.75A)
    const rawWave = {
      a: new Array(96).fill(0).map((_, i) => i * 10),
    };

    const parsedWave = sanitizeWaveformResponse(rawWave);
    expect(parsedWave.length).toBe(96);
    expect(parsedWave[0]).toBe(0);
    expect(parsedWave[10]).toBe(1.0); // 100 centi-Amps = 1.0A
    expect(parsedWave[20]).toBe(2.0); // 200 centi-Amps = 2.0A
  });

  it('handles invalid or empty waveform arrays safely', () => {
    const emptyWave = sanitizeWaveformResponse({});
    expect(emptyWave.length).toBe(96);
    expect(emptyWave.every((v) => v === 0)).toBe(true);

    const corruptWave = sanitizeWaveformResponse({ a: ['bad', null, undefined] });
    expect(corruptWave.length).toBe(96);
    expect(corruptWave[0]).toBe(0);
  });
});
