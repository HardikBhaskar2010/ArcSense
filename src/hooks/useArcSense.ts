import { useEffect, useRef, useCallback } from 'react';
import { useArcSenseStore } from '../lib/store';
import { ArcSenseApiClient } from '../lib/arcsense-api';
import { ArcSenseSimulator } from '../lib/simulator';
import { FaultMode } from '../types/arcsense';

const apiClient = new ArcSenseApiClient();
const simulator = new ArcSenseSimulator();

export function useArcSense() {
  const {
    baseUrl,
    connectionMode,
    isSimulator,
    isStale,
    lastState,
    lastWaveform,
    lastUpdateTime,
    activeFaultMode,
    isInjecting,
    isResetting,
    eventLogs,
    sessionSamples,
    isPaused,
    latencyMs,
    pollRateMs,
    packetsReceived,
    packetsFailed,
    soundAlertsEnabled,
    showReferenceSine,
    historyWindowSec,
    setBaseUrl,
    setIsSimulator,
    setActiveFaultMode,
    setInjecting,
    setResetting,
    setIsPaused,
    togglePause,
    setPollRateMs,
    toggleSoundAlerts,
    toggleReferenceSine,
    setHistoryWindowSec,
    recordTelemetry,
    handlePollFailure,
    handlePollSuccess,
    addLog,
    clearLogs,
    clearSessionSamples,
  } = useArcSenseStore();

  const isPollingRef = useRef(false);
  const abortCtrlRef = useRef<AbortController | null>(null);

  // Update client URL whenever baseUrl changes
  useEffect(() => {
    apiClient.setBaseUrl(baseUrl);
  }, [baseUrl]);

  // Main polling loop with latency measurement
  const poll = useCallback(async () => {
    if (isPollingRef.current) return;
    if (isPaused) return; // If paused, skip tick & fetch to freeze view
    isPollingRef.current = true;

    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
    }
    abortCtrlRef.current = new AbortController();
    const signal = abortCtrlRef.current.signal;

    const startTime = performance.now();

    try {
      if (isSimulator) {
        // Run internal simulation tick based on actual poll rate in seconds
        const dt = pollRateMs / 1000;
        const simState = simulator.tick(dt);
        const simWave = simulator.generateWaveform();
        const latency = Math.round(performance.now() - startTime);
        handlePollSuccess(latency);
        recordTelemetry(simState, simWave);
      } else {
        // Live polling from ESP32 with round-trip latency measurement
        const [stateRes, waveRes] = await Promise.all([
          apiClient.getState(signal),
          apiClient.getWaveform(signal),
        ]);

        const latency = Math.round(performance.now() - startTime);
        handlePollSuccess(latency);
        recordTelemetry(stateRes, waveRes);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        handlePollFailure();
      }
    } finally {
      isPollingRef.current = false;
    }
  }, [isSimulator, isPaused, pollRateMs, recordTelemetry, handlePollSuccess, handlePollFailure]);

  // Dynamic Polling interval timer
  useEffect(() => {
    // Initial poll immediately
    poll();

    const timer = setInterval(() => {
      poll();
    }, pollRateMs);

    return () => {
      clearInterval(timer);
      if (abortCtrlRef.current) {
        abortCtrlRef.current.abort();
      }
    };
  }, [poll, pollRateMs]);

  // Inject fault action
  const injectFault = useCallback(
    async (mode: FaultMode) => {
      if (isInjecting || isResetting) return;
      setInjecting(true);

      const modeNames = ['Normal Load', 'Arcing Contact', 'Overload Current', 'Loose Joint Heating'];
      addLog('system', `Requesting Fault Mode: ${modeNames[mode] || mode}`);

      try {
        if (isSimulator) {
          simulator.setMode(mode);
          setActiveFaultMode(mode);
          addLog('info', `[SIMULATOR] Active fault set to: ${modeNames[mode]}`);
        } else {
          await apiClient.injectFault(mode);
          setActiveFaultMode(mode);
          addLog('info', `[LIVE ESP32] Hardware fault injection applied: ${modeNames[mode]}`);
        }
      } catch (err: any) {
        addLog('danger', `Fault injection failed: ${err.message || 'Network error'}`);
      } finally {
        setInjecting(false);
      }
    },
    [isInjecting, isResetting, isSimulator, setInjecting, setActiveFaultMode, addLog]
  );

  // Reset trip and clear faults
  const resetDevice = useCallback(async () => {
    if (isResetting) return;
    setResetting(true);
    addLog('system', 'Issuing RESET command to clear trip and faults...');

    try {
      if (isSimulator) {
        simulator.reset();
        setActiveFaultMode(0);
        addLog('info', '[SIMULATOR] Reset complete: circuit re-closed, normal mode restored.');
      } else {
        await apiClient.reset();
        setActiveFaultMode(0);
        addLog('info', '[LIVE ESP32] Hardware reset confirmed: trip cleared, relays normalized.');
      }
    } catch (err: any) {
      addLog('danger', `Reset request failed: ${err.message || 'Network error'}`);
    } finally {
      setResetting(false);
    }
  }, [isResetting, isSimulator, setResetting, setActiveFaultMode, addLog]);

  return {
    baseUrl,
    connectionMode,
    isSimulator,
    isStale,
    state: lastState,
    waveform: lastWaveform,
    lastUpdateTime,
    activeFaultMode,
    isInjecting,
    isResetting,
    eventLogs,
    sessionSamples,
    isPaused,
    latencyMs,
    pollRateMs,
    packetsReceived,
    packetsFailed,
    soundAlertsEnabled,
    showReferenceSine,
    historyWindowSec,
    setBaseUrl,
    setIsSimulator,
    injectFault,
    resetDevice,
    clearLogs,
    clearSessionSamples,
    setIsPaused,
    togglePause,
    setPollRateMs,
    toggleSoundAlerts,
    toggleReferenceSine,
    setHistoryWindowSec,
  };
}
