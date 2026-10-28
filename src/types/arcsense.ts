/**
 * ArcSense Type Definitions
 * Electrical Fault Early-Warning & Predictive Arc Monitoring
 */

export enum RiskLevel {
  NORMAL = 0,
  WATCH = 1,
  WARNING = 2,
  DANGER = 3,
}

export type CircuitState = 'LIVE' | 'TRIPPED' | 'UNKNOWN';

export type ConnectionMode = 'SIMULATOR' | 'LIVE' | 'LINK_LOST' | 'CONNECTING';

export type FaultMode = 0 | 1 | 2 | 3;

export interface ArcSenseState {
  /** Timestamp in milliseconds from boot or epoch */
  t: number;
  /** RMS Current in Amperes */
  irms: number;
  /** Crest Factor (peak / rms) */
  crest: number;
  /** Waveform Difference Index (0.0 to 1.0) */
  diffIdx: number;
  /** Fraction of samples in flat-zero shoulder (0.0 to 1.0) */
  flatFrac: number;
  /** Number of arc-like cycles detected in the last ~1 s window */
  arcCount: number;
  /** Joint Object Temperature in °C */
  tObj: number;
  /** Ambient Temperature in °C */
  tAmb: number;
  /** Temperature difference (tObj - tAmb) in °C */
  dT: number;
  /** Heating rate-of-rise in °C/min */
  slope: number;
  /** Predicted minutes to reach alarm temperature (-1 = not heating, 0 = at alarm, >0 = minutes) */
  ttlMin: number;
  /** Thermal evidence score (0.0 to 1.0) */
  sT: number;
  /** Slope / rate-of-rise evidence score (0.0 to 1.0) */
  sS: number;
  /** Arcing evidence score (0.0 to 1.0) */
  sA: number;
  /** Overload current evidence score (0.0 to 1.0) */
  sL: number;
  /** Fused Fire Risk Score (0 to 100) */
  risk: number;
  /** Current Risk Level enum */
  level: RiskLevel;
  /** Relay tripped state: true = coil de-energized / circuit open */
  tripped: boolean;
  /** Sensor failure flag: true = MLX90614 or ADC fault */
  sensorFault: boolean;
  /** Active fault injection mode (0=none, 1=arc, 2=overload, 3=joint) */
  inj: FaultMode;
  /** Hardware Wi-Fi SSID connected to */
  wifiSsid?: string;
  /** Hardware Wi-Fi Signal Strength in dBm */
  wifiRssi?: number;
  /** Active IP assigned to ESP8266 */
  wifiIp?: string;
  /** Whether the ESP8266 is connected to a local Wi-Fi station */
  wifiConnected?: boolean;
  /** ESP8266 system uptime in seconds */
  uptimeSec?: number;
  /** ESP8266 free RAM / heap in bytes */
  freeHeap?: number;
  /** Hardware Node identity name */
  deviceName?: string;
  /** Name of the active client connected */
  connectedClient?: string;
}

export interface WaveformData {
  /** 96 samples in 0.01 A units */
  a: number[];
}

export interface WaveformPoint {
  index: number;
  timeMs: number;
  currentA: number;
  referenceA: number;
}

export interface TelemetryPoint {
  timestamp: number;
  timeLabel: string;
  tObj: number;
  tAmb: number;
  dT: number;
  slope: number;
  irms: number;
  risk: number;
  level: RiskLevel;
  arcCount: number;
  diffIdx: number;
  tripped: boolean;
  predictedTemp?: number;
}

export interface DashboardLogEntry {
  id: string;
  timestamp: Date;
  elapsedSec: number;
  type: 'info' | 'warning' | 'danger' | 'trip' | 'system';
  message: string;
  details?: string;
}

export interface PrimaryContributor {
  category: 'thermal' | 'slope' | 'arc' | 'load' | 'sensor' | 'normal';
  title: string;
  description: string;
  score: number;
  weight: number;
}

export interface ConnectionStats {
  latencyMs: number | null;
  pollRateMs: number;
  packetsReceived: number;
  packetsFailed: number;
  uptimeSec: number;
  isPaused: boolean;
  soundAlertsEnabled: boolean;
}

