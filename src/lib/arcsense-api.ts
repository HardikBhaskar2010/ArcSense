import { ArcSenseState, FaultMode, RiskLevel } from '../types/arcsense';

export interface ApiClientConfig {
  baseUrl: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 2000;

/**
 * Safely parse and sanitize incoming state JSON from the ESP32
 */
export function sanitizeStateResponse(raw: any): ArcSenseState {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid telemetry payload: not an object');
  }

  const num = (v: any, fallback = 0): number => {
    if (v === null || v === undefined || v === '') return fallback;
    const n = Number(v);
    return isNaN(n) ? fallback : n;
  };

  const bool = (v: any, fallback = false): boolean => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return v.toLowerCase() === 'true';
    if (typeof v === 'number') return v !== 0;
    return fallback;
  };

  // Level validation (0..3)
  let rawLevel = num(raw.level, 0);
  if (rawLevel < 0 || rawLevel > 3) rawLevel = 0;
  const level: RiskLevel = rawLevel as RiskLevel;

  // Injection mode validation (0..3)
  let rawInj = num(raw.inj, 0);
  if (rawInj < 0 || rawInj > 3) rawInj = 0;
  const inj: FaultMode = rawInj as FaultMode;

  // Thermal and evidence scores fallbacks (handles sT or sThermal, etc.)
  const sT = num(raw.sT ?? raw.sThermal, 0);
  const sS = num(raw.sS ?? raw.sSlope, 0);
  const sA = num(raw.sA ?? raw.sArc, 0);
  const sL = num(raw.sL ?? raw.sLoad, 0);

  return {
    t: num(raw.t, Date.now()),
    irms: Math.max(0, num(raw.irms, 0)),
    crest: Math.max(0, num(raw.crest, 1.414)),
    diffIdx: Math.max(0, Math.min(1, num(raw.diffIdx, 0))),
    flatFrac: Math.max(0, Math.min(1, num(raw.flatFrac, 0))),
    arcCount: Math.max(0, Math.round(num(raw.arcCount, 0))),
    tObj: num(raw.tObj, 25.0),
    tAmb: num(raw.tAmb, 25.0),
    dT: num(raw.dT, num(raw.tObj, 25.0) - num(raw.tAmb, 25.0)),
    slope: num(raw.slope, 0.0),
    ttlMin: num(raw.ttlMin, -1.0),
    sT: Math.max(0, Math.min(1, sT)),
    sS: Math.max(0, Math.min(1, sS)),
    sA: Math.max(0, Math.min(1, sA)),
    sL: Math.max(0, Math.min(1, sL)),
    risk: Math.max(0, Math.min(100, num(raw.risk, 0))),
    level,
    tripped: bool(raw.tripped, false),
    sensorFault: bool(raw.sensorFault, false),
    inj,
  };
}

/**
 * Safely parse incoming waveform JSON from `/api/wave`
 * Output is 96 samples scaled in Amperes (ESP32 sends in 0.01A centi-Amps)
 */
export function sanitizeWaveformResponse(raw: any): number[] {
  const SPC = 96;
  if (!raw || typeof raw !== 'object') {
    return new Array(SPC).fill(0);
  }

  const arr = Array.isArray(raw.a) ? raw.a : [];
  if (arr.length === 0) {
    return new Array(SPC).fill(0);
  }

  const result: number[] = new Array(SPC);
  for (let i = 0; i < SPC; i++) {
    const val = Number(arr[i]);
    // The ESP32 firmware scales wave as waveCenti[j] = (int16_t)lroundf(c[j] * 100.0f)
    result[i] = isNaN(val) ? 0 : val / 100.0;
  }
  return result;
}

/**
 * ArcSense REST API Client
 */
export class ArcSenseApiClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config?: Partial<ApiClientConfig>) {
    this.baseUrl = (config?.baseUrl || 'http://192.168.4.1').replace(/\/+$/, '');
    this.timeoutMs = config?.timeoutMs || DEFAULT_TIMEOUT_MS;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  private async fetchWithTimeout(url: string, signal?: AbortSignal): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const onCallerAbort = () => controller.abort();
    if (signal) {
      signal.addEventListener('abort', onCallerAbort);
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Accept': 'application/json, text/plain, */*',
        },
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', onCallerAbort);
      }
    }
  }

  /**
   * Fetch live engine state from ESP32
   */
  public async getState(signal?: AbortSignal): Promise<ArcSenseState> {
    const endpoint = `${this.baseUrl}/api/state`;
    const response = await this.fetchWithTimeout(endpoint, signal);
    if (!response.ok) {
      throw new Error(`Failed to fetch state: HTTP ${response.status} ${response.statusText}`);
    }
    const json = await response.json();
    return sanitizeStateResponse(json);
  }

  /**
   * Fetch 96-sample waveform from ESP32
   */
  public async getWaveform(signal?: AbortSignal): Promise<number[]> {
    const endpoint = `${this.baseUrl}/api/wave`;
    const response = await this.fetchWithTimeout(endpoint, signal);
    if (!response.ok) {
      throw new Error(`Failed to fetch waveform: HTTP ${response.status} ${response.statusText}`);
    }
    const json = await response.json();
    return sanitizeWaveformResponse(json);
  }

  /**
   * Inject fault mode (0=normal, 1=arcing chopper, 2=overload, 3=bad joint)
   */
  public async injectFault(mode: FaultMode, signal?: AbortSignal): Promise<boolean> {
    const endpoint = `${this.baseUrl}/api/inject?mode=${mode}`;
    const response = await this.fetchWithTimeout(endpoint, signal);
    if (!response.ok) {
      throw new Error(`Fault injection failed: HTTP ${response.status}`);
    }
    return true;
  }

  /**
   * Send reset command to ESP32
   */
  public async reset(signal?: AbortSignal): Promise<boolean> {
    const endpoint = `${this.baseUrl}/api/reset`;
    const response = await this.fetchWithTimeout(endpoint, signal);
    if (!response.ok) {
      throw new Error(`Reset command failed: HTTP ${response.status}`);
    }
    return true;
  }
}
