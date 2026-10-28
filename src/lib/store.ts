import { create } from 'zustand';
import { ArcSenseState, ConnectionMode, DashboardLogEntry, FaultMode, RiskLevel } from '../types/arcsense';
import { audioAlerts } from './audio-alerts';

interface ArcSenseStore {
  baseUrl: string;
  connectionMode: ConnectionMode;
  isSimulator: boolean;
  isStale: boolean;
  consecutiveFails: number;
  lastUpdateTime: Date | null;
  activeFaultMode: FaultMode;
  isInjecting: boolean;
  isResetting: boolean;
  lastState: ArcSenseState | null;
  lastWaveform: number[];
  eventLogs: DashboardLogEntry[];
  sessionSamples: ArcSenseState[];
  startTime: number;

  // Stream & Connection Controls
  isPaused: boolean;
  latencyMs: number | null;
  pollRateMs: number;
  packetsReceived: number;
  packetsFailed: number;
  soundAlertsEnabled: boolean;
  showReferenceSine: boolean;
  historyWindowSec: number;

  setBaseUrl: (url: string) => void;
  setConnectionMode: (mode: ConnectionMode) => void;
  setIsSimulator: (val: boolean) => void;
  setActiveFaultMode: (mode: FaultMode) => void;
  setInjecting: (val: boolean) => void;
  setResetting: (val: boolean) => void;
  setIsPaused: (val: boolean) => void;
  togglePause: () => void;
  setLatencyMs: (ms: number | null) => void;
  setPollRateMs: (rate: number) => void;
  toggleSoundAlerts: () => void;
  toggleReferenceSine: () => void;
  setHistoryWindowSec: (sec: number) => void;
  recordTelemetry: (state: ArcSenseState, waveform?: number[]) => void;
  handlePollFailure: () => void;
  handlePollSuccess: (latencyMs?: number) => void;
  addLog: (type: DashboardLogEntry['type'], message: string, details?: string) => void;
  clearLogs: () => void;
  clearSessionSamples: () => void;
}

// Initial base URL resolution:
// 1. Check ?ip= query parameter
// 2. If served from http/https, use location.origin or port 80 if on ESP32
// 3. Fallback to http://192.168.4.1
function getInitialBaseUrl(): { url: string; autoLive: boolean } {
  if (typeof window === 'undefined') {
    return { url: 'http://192.168.4.1', autoLive: false };
  }
  const params = new URLSearchParams(window.location.search);
  const ipParam = params.get('ip');
  if (ipParam) {
    const formatted = ipParam.startsWith('http') ? ipParam : `http://${ipParam}`;
    return { url: formatted, autoLive: true };
  }
  // Check if saved in localStorage
  try {
    const saved = localStorage.getItem('arcsense_device_ip');
    if (saved) {
      return { url: saved, autoLive: true };
    }
  } catch (e) {
    // Ignore localStorage errors
  }

  // If directly served from the ESP's own IP address
  if (window.location.protocol.startsWith('http') && /^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname)) {
    return { url: window.location.origin, autoLive: true };
  }

  return { url: 'http://192.168.4.1', autoLive: false };
}

const { url: initialUrl, autoLive } = getInitialBaseUrl();

export const useArcSenseStore = create<ArcSenseStore>((set, get) => ({
  baseUrl: initialUrl,
  connectionMode: autoLive ? 'CONNECTING' : 'SIMULATOR',
  isSimulator: !autoLive,
  isStale: false,
  consecutiveFails: 0,
  lastUpdateTime: null,
  activeFaultMode: 0,
  isInjecting: false,
  isResetting: false,
  lastState: null,
  lastWaveform: new Array(96).fill(0),
  eventLogs: [],
  sessionSamples: [],
  startTime: Date.now(),

  // Enhanced stream & UI state
  isPaused: false,
  latencyMs: null,
  pollRateMs: 500,
  packetsReceived: 0,
  packetsFailed: 0,
  soundAlertsEnabled: false,
  showReferenceSine: true,
  historyWindowSec: 90,

  setBaseUrl: (url: string) => {
    const cleanUrl = url.replace(/\/+$/, '');
    try {
      localStorage.setItem('arcsense_device_ip', cleanUrl);
    } catch (e) {
      // Ignore localStorage errors
    }
    set({
      baseUrl: cleanUrl,
      isSimulator: false,
      connectionMode: 'CONNECTING',
      consecutiveFails: 0,
    });
    get().addLog('system', `Device IP set to: ${cleanUrl}. Connecting...`);
  },

  setConnectionMode: (mode: ConnectionMode) => {
    const prev = get().connectionMode;
    if (prev !== mode) {
      set({ connectionMode: mode, isSimulator: mode === 'SIMULATOR' });
      const label =
        mode === 'LIVE'
          ? 'Connected to LIVE ESP32 device'
          : mode === 'SIMULATOR'
            ? 'Switched to SIMULATOR mode'
            : mode === 'LINK_LOST'
              ? 'LINK LOST: ESP32 connection timed out'
              : 'CONNECTING to device...';
      get().addLog(mode === 'LINK_LOST' ? 'danger' : 'info', label);
    }
  },

  setIsSimulator: (val: boolean) => {
    set({ isSimulator: val, connectionMode: val ? 'SIMULATOR' : 'CONNECTING', consecutiveFails: 0 });
    get().addLog(
      'info',
      val ? 'Switched to internal physics simulator' : `Connecting to live ESP32 at ${get().baseUrl}...`
    );
  },

  setActiveFaultMode: (mode: FaultMode) => set({ activeFaultMode: mode }),
  setInjecting: (val: boolean) => set({ isInjecting: val }),
  setResetting: (val: boolean) => set({ isResetting: val }),
  setIsPaused: (val: boolean) => set({ isPaused: val }),
  togglePause: () => {
    const next = !get().isPaused;
    set({ isPaused: next });
    get().addLog('info', next ? 'Live telemetry stream PAUSED by operator' : 'Live telemetry stream RESUMED');
  },
  setLatencyMs: (ms: number | null) => set({ latencyMs: ms }),
  setPollRateMs: (rate: number) => {
    set({ pollRateMs: rate });
    get().addLog('system', `Polling frequency set to: ${rate} ms`);
  },
  toggleSoundAlerts: () => {
    const next = !get().soundAlertsEnabled;
    if (next) {
      audioAlerts.unlock();
      audioAlerts.playResetChime();
    }
    set({ soundAlertsEnabled: next });
    get().addLog('info', next ? 'Audible control-room alerts ENABLED' : 'Audible alerts MUTED');
  },
  toggleReferenceSine: () => set((s) => ({ showReferenceSine: !s.showReferenceSine })),
  setHistoryWindowSec: (sec: number) => set({ historyWindowSec: sec }),

  recordTelemetry: (state: ArcSenseState, waveform?: number[]) => {
    const { lastState, sessionSamples, isSimulator, packetsReceived, soundAlertsEnabled, isPaused } = get();
    if (isPaused) return; // Freeze view updates when paused

    const now = new Date();

    // Check for meaningful status transitions to log & play audio alerts
    if (lastState) {
      if (state.level !== lastState.level) {
        const levelNames = ['NORMAL', 'WATCH', 'WARNING', 'DANGER'];
        const fromName = levelNames[lastState.level] || 'UNKNOWN';
        const toName = levelNames[state.level] || 'UNKNOWN';
        const logType = state.level >= RiskLevel.WARNING ? 'warning' : state.level === RiskLevel.DANGER ? 'danger' : 'info';
        
        get().addLog(
          logType,
          `Risk level transition: ${fromName} → ${toName}`,
          `Risk: ${state.risk.toFixed(1)}/100 | Temp: ${state.tObj.toFixed(1)}°C | Arc: ${state.arcCount}/s`
        );

        if (soundAlertsEnabled && state.level > lastState.level) {
          if (state.level >= RiskLevel.DANGER) {
            audioAlerts.playTripAlarm();
          } else if (state.level >= RiskLevel.WARNING) {
            audioAlerts.playWarningBeep();
          }
        }
      }

      if (state.tripped && !lastState.tripped) {
        get().addLog(
          'trip',
          isSimulator ? '[SIMULATOR] Trip condition met (virtual relay opened)' : 'CIRCUIT TRIPPED — Fail-safe relay coil de-energized!',
          `Object Temp: ${state.tObj.toFixed(1)}°C | Current: ${state.irms.toFixed(2)}A | Arcs: ${state.arcCount}/s`
        );
        if (soundAlertsEnabled) {
          audioAlerts.playTripAlarm();
        }
      } else if (!state.tripped && lastState.tripped) {
        get().addLog('info', 'Circuit trip cleared — relay re-closed');
        if (soundAlertsEnabled) {
          audioAlerts.playResetChime();
        }
      }

      if (state.sensorFault && !lastState.sensorFault) {
        get().addLog(
          'danger',
          'SENSOR FAULT DETECTED — Fail-safe activated!',
          'MLX90614 IR sensor or ADC unreadable. Circuit forced into trip protection.'
        );
        if (soundAlertsEnabled) {
          audioAlerts.playTripAlarm();
        }
      }
    }

    // Keep session samples (limit to 5000 to prevent unbounded memory usage)
    const newSamples = [...sessionSamples, state];
    if (newSamples.length > 5000) {
      newSamples.shift();
    }

    set({
      lastState: state,
      lastWaveform: waveform || get().lastWaveform,
      lastUpdateTime: now,
      isStale: false,
      consecutiveFails: 0,
      packetsReceived: packetsReceived + 1,
      sessionSamples: newSamples,
    });
  },

  handlePollFailure: () => {
    const fails = get().consecutiveFails + 1;
    const failedTotal = get().packetsFailed + 1;
    const currentMode = get().connectionMode;
    const isSim = get().isSimulator;

    if (!isSim) {
      if (fails >= 3 && currentMode !== 'LINK_LOST') {
        set({ connectionMode: 'LINK_LOST', isStale: true, consecutiveFails: fails, packetsFailed: failedTotal });
        get().addLog(
          'danger',
          `Connection Lost: failed to reach ESP32 at ${get().baseUrl} after ${fails} attempts. Showing stale telemetry.`
        );
      } else {
        set({ consecutiveFails: fails, isStale: true, packetsFailed: failedTotal });
      }
    }
  },

  handlePollSuccess: (latencyMs?: number) => {
    const isSim = get().isSimulator;
    if (!isSim && get().connectionMode !== 'LIVE') {
      set({ connectionMode: 'LIVE', consecutiveFails: 0, isStale: false, latencyMs: latencyMs ?? null });
      get().addLog('info', `LIVE device connected at ${get().baseUrl}`);
    } else if (latencyMs !== undefined) {
      set({ latencyMs });
    }
  },

  addLog: (type: DashboardLogEntry['type'], message: string, details?: string) => {
    const { eventLogs, startTime } = get();
    const entry: DashboardLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date(),
      elapsedSec: Math.max(0, Math.round((Date.now() - startTime) / 1000)),
      type,
      message,
      details,
    };
    // Limit logs to last 200 items
    const updated = [entry, ...eventLogs.slice(0, 199)];
    set({ eventLogs: updated });
  },

  clearLogs: () => set({ eventLogs: [] }),
  clearSessionSamples: () => set({ sessionSamples: [] }),
}));
