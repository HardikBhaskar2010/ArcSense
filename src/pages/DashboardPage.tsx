import React, { useState } from 'react';
import { useArcSense } from '../hooks/useArcSense';
import { useTelemetryHistory } from '../hooks/useTelemetryHistory';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { exportTelemetryToCsv } from '../lib/csv-export';

import { DashboardHeader } from '../components/layout/DashboardHeader';
import { DashboardNavigation, DashboardTab } from '../components/layout/DashboardNavigation';
import { Footer } from '../components/layout/Footer';
import { TechnicalGrid } from '../components/effects/TechnicalGrid';
import { SystemOverview } from '../components/dashboard/SystemOverview';
import { RiskAssessment } from '../components/status/RiskAssessment';
import { LiveWaveform } from '../components/charts/LiveWaveform';
import { EvidenceFusionGrid } from '../components/dashboard/EvidenceFusionGrid';
import { MetricCard } from '../components/dashboard/MetricCard';
import { TelemetryHistoryChart } from '../components/charts/TelemetryHistoryChart';
import { FaultSimulatorPanel } from '../components/controls/FaultSimulatorPanel';
import { HardwareStatus } from '../components/controls/HardwareStatus';
import { HardwareDiagnostics } from '../components/controls/HardwareDiagnostics';
import { EventLog } from '../components/log/EventLog';
import { ArcSenseBotBanner } from '../components/dashboard/ArcSenseBotBanner';
import { DeviceSettingsModal } from '../components/controls/DeviceSettingsModal';
import { KeyboardShortcutsModal } from '../components/controls/KeyboardShortcutsModal';

import {
  Play,
  Zap,
  Flame,
  Activity,
  AudioWaveform,
  Maximize2,
  Thermometer,
  CloudSun,
  TrendingUp,
  Clock,
  Layers,
  Info,
} from 'lucide-react';
import { cn, formatTimeToAlarm } from '../lib/utils';

export const DashboardPage: React.FC = () => {
  const {
    baseUrl,
    connectionMode,
    isSimulator,
    isStale,
    state,
    waveform,
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
    togglePause,
    setPollRateMs,
    toggleSoundAlerts,
    toggleReferenceSine,
    setHistoryWindowSec,
  } = useArcSense();

  const { history, clearHistory } = useTelemetryHistory(state, historyWindowSec);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isHardwareExpanded, setIsHardwareExpanded] = useState(false);

  const handleExportCsv = () => {
    exportTelemetryToCsv(sessionSamples, connectionMode);
  };

  const handleClearSession = () => {
    clearHistory();
    clearLogs();
    clearSessionSamples();
  };

  // Keyboard navigation shortcuts
  useKeyboardShortcuts({
    onTogglePause: togglePause,
    onReset: resetDevice,
    onInjectMode: injectFault,
    onOpenSettings: () => setIsSettingsOpen(true),
    onExportCsv: handleExportCsv,
    onToggleSimulator: () => setIsSimulator(!isSimulator),
    onToggleAudio: toggleSoundAlerts,
    onToggleShortcutsModal: () => setIsShortcutsOpen((prev) => !prev),
  });

  // Calculate active alerts count for badge indicator
  const alertCount = React.useMemo(() => {
    if (!state) return 0;
    let count = 0;
    if (state.sensorFault) count++;
    if (state.arcCount >= 8) count++;
    if (state.tObj >= 75) count++;
    if (state.slope >= 4.0) count++;
    if (state.irms > 3.0) count++;
    if (isStale) count++;
    return count;
  }, [state, isStale]);

  return (
    <div className="relative min-h-screen bg-scada-bg text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Background Engineering Dot Matrix Pattern */}
      <TechnicalGrid />

      {/* Top Application Header */}
      <DashboardHeader
        connectionMode={connectionMode}
        baseUrl={baseUrl}
        deviceName={state?.deviceName}
        isStale={isStale}
        lastUpdateTime={lastUpdateTime}
        latencyMs={latencyMs}
        isPaused={isPaused}
        soundAlertsEnabled={soundAlertsEnabled}
        onTogglePause={togglePause}
        onToggleSoundAlerts={toggleSoundAlerts}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onExportCsv={handleExportCsv}
        onToggleSimulator={() => setIsSimulator(!isSimulator)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onClearSession={handleClearSession}
      />

      {/* Sticky Top Tabbed Navigation */}
      <DashboardNavigation
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        eventCount={eventLogs.length}
        alertCount={alertCount}
        isTripped={state?.tripped ?? false}
      />

      {/* Floating Paused Notification Banner */}
      {isPaused && (
        <div className="sticky top-[49px] sm:top-[53px] z-20 bg-amber-500/90 text-slate-950 px-4 py-1.5 font-mono text-xs font-bold text-center flex items-center justify-center gap-2 shadow-lg backdrop-blur">
          <span>TELEMETRY STREAM PAUSED — Holding current cycle state.</span>
          <button
            type="button"
            onClick={togglePause}
            className="px-2.5 py-0.5 rounded bg-slate-950 text-amber-300 hover:bg-slate-900 border border-amber-400 text-[11px] flex items-center gap-1 transition-colors"
          >
            <Play className="w-3 h-3 fill-amber-300" />
            Resume (Space)
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-4 relative z-10">
        {/* ============================================================ */}
        {/* TAB 1: OVERVIEW */}
        {/* ============================================================ */}
        {activeTab === 'overview' && (
          <div className="space-y-4 animate-in fade-in duration-200" role="tabpanel" id="tabpanel-overview" aria-labelledby="tab-overview">
            {/* System Overview 5-Metric Strip */}
            <SystemOverview
              state={state}
              connectionMode={connectionMode}
              latencyMs={latencyMs}
              isSimulator={isSimulator}
              isStale={isStale}
            />

            {/* Primary Grid: Risk Assessment on Left, Live Waveform + Evidence on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column (5 cols on Desktop): Fire Risk Assessment */}
              <div className="lg:col-span-5 flex flex-col">
                <RiskAssessment
                  state={state}
                  isSimulator={isSimulator}
                  isStale={isStale}
                  onReset={resetDevice}
                  isResetting={isResetting}
                />
              </div>

              {/* Right Column (7 cols on Desktop): Live Waveform & Evidence Fusion */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <LiveWaveform
                  waveform={waveform}
                  irms={state?.irms ?? 0}
                  isPaused={isPaused}
                  showReferenceSine={showReferenceSine}
                  onToggleReferenceSine={toggleReferenceSine}
                  heightClass="h-[220px] sm:h-[260px] lg:h-[280px]"
                />

                <EvidenceFusionGrid state={state} isCompact={false} />
              </div>
            </div>

            {/* Compact Hardware Status Strip */}
            <HardwareStatus
              connectionMode={connectionMode}
              baseUrl={baseUrl}
              state={state}
              latencyMs={latencyMs}
              isExpanded={isHardwareExpanded}
              onToggleExpand={() => setIsHardwareExpanded(!isHardwareExpanded)}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />

            {/* Expandable Hardware Diagnostics Drawer */}
            {isHardwareExpanded && (
              <div className="animate-in fade-in duration-200">
                <HardwareDiagnostics
                  connectionMode={connectionMode}
                  baseUrl={baseUrl}
                  state={state}
                  latencyMs={latencyMs}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  onRefreshTelemetry={() => injectFault(activeFaultMode)}
                />
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: ELECTRICAL */}
        {/* ============================================================ */}
        {activeTab === 'electrical' && (
          <div className="space-y-4 animate-in fade-in duration-200" role="tabpanel" id="tabpanel-electrical" aria-labelledby="tab-electrical">
            {/* Electrical Telemetry Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <MetricCard
                label="RMS Current"
                value={state ? state.irms.toFixed(2) : '—'}
                unit="A"
                subValue={state && state.irms > 3.0 ? 'Overload loop' : 'Nominal load'}
                status={state && state.irms > 3.0 ? 'danger' : 'normal'}
                icon={<Zap className="w-4 h-4" />}
                tooltip="Root-Mean-Square current across one full 50Hz cycle"
              />

              <MetricCard
                label="Peak Current"
                value={state ? (state.irms * Math.SQRT2).toFixed(2) : '—'}
                unit="A"
                subValue="Ideal sine peak"
                status="neutral"
                icon={<Activity className="w-4 h-4" />}
                tooltip="Theoretical peak amplitude: Irms × √2"
              />

              <MetricCard
                label="Arcing Cycles"
                value={state ? state.arcCount : '—'}
                unit="/s"
                subValue={state && state.arcCount >= 8 ? 'CRITICAL (Trips circuit)' : state && state.arcCount > 0 ? 'Jitter detected' : 'Synchronous'}
                status={state && state.arcCount >= 8 ? 'danger' : state && state.arcCount > 0 ? 'warning' : 'normal'}
                icon={<Flame className="w-4 h-4" />}
                tooltip="Flagged arc-like cycles within sliding 1-second (50-cycle) window"
              />

              <MetricCard
                label="Waveform Diff"
                value={state ? (state.diffIdx * 100).toFixed(1) : '—'}
                unit="%"
                subValue={state && state.diffIdx > 0.15 ? 'Above 15% threshold' : 'Clean repeat'}
                status={state && state.diffIdx > 0.15 ? 'warning' : 'normal'}
                icon={<Activity className="w-4 h-4" />}
                tooltip="Cycle-to-cycle normalized difference: Σ|c[j] - p[j]| / Σ|c[j]|"
              />

              <MetricCard
                label="Crest Factor"
                value={state ? state.crest.toFixed(2) : '—'}
                unit=""
                subValue={state && state.crest > 1.8 ? 'Peak spikes' : 'Sine ≈ 1.41'}
                status={state && state.crest > 1.8 ? 'watch' : 'neutral'}
                icon={<AudioWaveform className="w-4 h-4" />}
                tooltip="Peak current divided by RMS current (pure sine wave = 1.414)"
              />

              <MetricCard
                label="Flat-Zero Share"
                value={state ? (state.flatFrac * 100).toFixed(1) : '—'}
                unit="%"
                subValue={state && state.flatFrac > 0.15 ? 'Arc shoulders detected' : 'Full conduction'}
                status={state && state.flatFrac > 0.15 ? 'watch' : 'neutral'}
                icon={<Maximize2 className="w-4 h-4" />}
                tooltip="Proportion of cycle samples falling within 10% of zero current"
              />
            </div>

            {/* Live Waveform Oscilloscope */}
            <LiveWaveform
              waveform={waveform}
              irms={state?.irms ?? 0}
              isPaused={isPaused}
              showReferenceSine={showReferenceSine}
              onToggleReferenceSine={toggleReferenceSine}
              heightClass="h-[240px] sm:h-[300px]"
            />

            {/* Fault Simulator & Load Control Panel */}
            <FaultSimulatorPanel
              activeMode={activeFaultMode}
              isSimulator={isSimulator}
              isInjecting={isInjecting}
              isResetting={isResetting}
              tripped={state?.tripped ?? false}
              onInject={injectFault}
              onReset={resetDevice}
            />

            {/* Electrical Engineering Technical Callout */}
            <div className="bg-scada-card border border-scada-border rounded-xl p-3.5 sm:p-4 text-xs font-mono text-zinc-300 space-y-1.5 shadow-md">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
                <Info className="w-4 h-4" />
                <span>Cycle Differencing & Electrical Arc Detection Principle</span>
              </div>
              <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                Normal linear and non-linear electrical loads repeat periodically every 20 ms with a nearly identical current profile. Series electrical arcing breaks this periodicity through erratic plasma re-ignition and micro-gap extinguishings. ArcSense samples 96 points per mains cycle at 5 kHz and computes the normalized absolute difference between consecutive cycles. When differential distortion exceeds 15% across &gt;8 cycles in a second, predictive arc protection triggers instantly.
              </p>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: THERMAL */}
        {/* ============================================================ */}
        {activeTab === 'thermal' && (
          <div className="space-y-4 animate-in fade-in duration-200" role="tabpanel" id="tabpanel-thermal" aria-labelledby="tab-thermal">
            {/* Thermal Telemetry Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              <MetricCard
                label="Joint Surface Temp"
                value={state ? (state.sensorFault ? 'FAULT' : state.tObj.toFixed(1)) : '—'}
                unit={state?.sensorFault ? '' : '°C'}
                subValue={state?.sensorFault ? 'Sensor unreachable' : state && state.tObj >= 75 ? 'PVC Limit Exceeded (75°C)' : 'MLX90614 Non-contact IR'}
                status={state?.sensorFault || (state && state.tObj >= 75) ? 'danger' : state && state.tObj >= 50 ? 'warning' : 'normal'}
                icon={<Thermometer className="w-4 h-4" />}
                tooltip="Direct optical infrared surface temperature of electrical joint"
              />

              <MetricCard
                label="Ambient Air Temp"
                value={state ? (state.sensorFault ? '—' : state.tAmb.toFixed(1)) : '—'}
                unit={state?.sensorFault ? '' : '°C'}
                subValue="Enclosure baseline air"
                status="neutral"
                icon={<CloudSun className="w-4 h-4" />}
                tooltip="Internal ambient temperature reference from MLX90614 sensor die"
              />

              <MetricCard
                label="Temperature Rise (ΔT)"
                value={state ? (state.sensorFault ? '—' : `${state.dT >= 0 ? '+' : ''}${state.dT.toFixed(1)}`) : '—'}
                unit={state?.sensorFault ? '' : '°C'}
                subValue={state && state.dT > 15 ? 'Joule heating active' : 'Near equilibrium'}
                status={state && state.dT >= 35 ? 'danger' : state && state.dT >= 15 ? 'warning' : 'normal'}
                icon={<Thermometer className="w-4 h-4" />}
                tooltip="Differential temperature above ambient: ΔT = T_joint - T_ambient"
              />

              <MetricCard
                label="Heating Rate (Slope)"
                value={state ? (state.sensorFault ? '—' : `${state.slope >= 0 ? '+' : ''}${state.slope.toFixed(1)}`) : '—'}
                unit={state?.sensorFault ? '' : '°C/min'}
                subValue={state && state.slope >= 4.0 ? 'Rapid temperature runaway' : state && state.slope >= 2.0 ? 'Elevated rise' : 'Thermally stable'}
                status={state && state.slope >= 4.0 ? 'danger' : state && state.slope >= 2.0 ? 'warning' : 'normal'}
                icon={<TrendingUp className="w-4 h-4" />}
                tooltip="Least-squares rate-of-rise computed over a sliding 30-sample window"
              />

              <MetricCard
                label="Time to Alarm (75°C)"
                value={state ? (state.sensorFault ? '—' : state.ttlMin < 0 ? 'Steady' : state.ttlMin === 0 ? 'ALARM' : state.ttlMin < 1 ? `${Math.round(state.ttlMin * 60)}s` : `${state.ttlMin.toFixed(1)}m`) : '—'}
                unit=""
                subValue={state ? formatTimeToAlarm(state.ttlMin) : 'Calculating...'}
                status={state && state.ttlMin === 0 ? 'danger' : state && state.ttlMin > 0 && state.ttlMin <= 3 ? 'danger' : state && state.ttlMin > 0 && state.ttlMin <= 10 ? 'warning' : 'normal'}
                icon={<Clock className="w-4 h-4" />}
                tooltip="Estimated minutes remaining until joint reaches the 75°C PVC insulation alarm limit"
              />
            </div>

            {/* Rolling Thermal & Risk History Chart */}
            <TelemetryHistoryChart
              data={history}
              tAmb={state?.tAmb ?? 28}
              isPaused={isPaused}
              historyWindowSec={historyWindowSec}
              onSelectWindow={setHistoryWindowSec}
            />

            {/* Thermal Early-Warning Physics Callout */}
            <div className="bg-scada-card border border-scada-border rounded-xl p-3.5 sm:p-4 text-xs font-mono text-zinc-300 space-y-1.5 shadow-md">
              <div className="flex items-center gap-2 text-orange-400 font-bold text-xs uppercase tracking-wider">
                <Info className="w-4 h-4" />
                <span>Rate-of-Rise (dT/dt) Predictive Protection Concept</span>
              </div>
              <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                Conventional circuit breakers and thermal fuses only react after a terminal has already reached dangerous temperatures (typically &gt;75–100°C), by which time wire insulation has already pyrolyzed and produced toxic combustible gases. ArcSense uses a non-contact MLX90614 infrared sensor to calculate temperature velocity (dT/dt). If a terminal is heating at &gt;4.0°C/min, the system projects the time to alarm and preemptively trips the circuit minutes before insulation ignites.
              </p>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: HARDWARE */}
        {/* ============================================================ */}
        {activeTab === 'hardware' && (
          <div className="space-y-4 animate-in fade-in duration-200" role="tabpanel" id="tabpanel-hardware" aria-labelledby="tab-hardware">
            {/* ArcSense Bot Assistant Banner */}
            <ArcSenseBotBanner
              connectionMode={connectionMode}
              baseUrl={baseUrl}
              state={state}
              latencyMs={latencyMs}
              isSimulator={isSimulator}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onToggleSimulator={setIsSimulator}
            />

            {/* Hardware Diagnostics & Remote Controls Panel */}
            <HardwareDiagnostics
              connectionMode={connectionMode}
              baseUrl={baseUrl}
              state={state}
              latencyMs={latencyMs}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onRefreshTelemetry={() => injectFault(activeFaultMode)}
            />

            {/* Hardware Architecture & Pinout Reference */}
            <div className="bg-scada-card border border-scada-border rounded-xl p-4 sm:p-5 shadow-lg font-mono text-xs space-y-3">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm uppercase tracking-wider pb-2 border-b border-scada-border">
                <Layers className="w-4 h-4" />
                <span>ArcSense NodeMCU Hardware Specifications &amp; Pinout</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                <div className="bg-scada-surface border border-scada-border rounded-lg p-3">
                  <span className="text-[10px] text-zinc-500 uppercase block font-bold">Microcontroller</span>
                  <span className="font-bold text-white text-xs block mt-0.5">ESP8266 (NodeMCU v2/v3)</span>
                  <span className="text-[10px] text-zinc-400 block mt-1">
                    80 MHz Xtensa LX106 &middot; 4 MB Flash &middot; 802.11 b/g/n 2.4 GHz
                  </span>
                </div>

                <div className="bg-scada-surface border border-scada-border rounded-lg p-3">
                  <span className="text-[10px] text-zinc-500 uppercase block font-bold">Current Sensor (A0)</span>
                  <span className="font-bold text-white text-xs block mt-0.5">ACS712-05B Hall Sensor</span>
                  <span className="text-[10px] text-zinc-400 block mt-1">
                    5 kHz sampling &middot; 96 samples/cycle &middot; 185 mV/A sensitivity
                  </span>
                </div>

                <div className="bg-scada-surface border border-scada-border rounded-lg p-3">
                  <span className="text-[10px] text-zinc-500 uppercase block font-bold">Thermal Sensor (D1/D2)</span>
                  <span className="font-bold text-white text-xs block mt-0.5">MLX90614 Non-Contact IR</span>
                  <span className="text-[10px] text-zinc-400 block mt-1">
                    I2C Bus (D1 SCL, D2 SDA) &middot; ±0.5°C accuracy &middot; 90° FOV
                  </span>
                </div>

                <div className="bg-scada-surface border border-scada-border rounded-lg p-3">
                  <span className="text-[10px] text-zinc-500 uppercase block font-bold">Relay Failsafe (D5)</span>
                  <span className="font-bold text-white text-xs block mt-0.5">Active-HIGH Energized Relay</span>
                  <span className="text-[10px] text-zinc-400 block mt-1">
                    GPIO14 &middot; Fail-safe release cuts circuit power when tripped
                  </span>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-zinc-400 font-sans leading-relaxed">
                <strong>Fail-Safe Electrical Design:</strong> The isolation relay coil is held energized during nominal operation. If power to the ESP8266 is severed, the firmware crashes, or an unrecoverable sensor fault occurs, the coil automatically de-energizes and mechanically pulls open the contact points to isolate the monitored circuit loop.
              </div>
            </div>

            {/* Network Statistics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-scada-card border border-scada-border rounded-lg p-3 font-mono text-xs">
                <span className="text-[10px] text-zinc-500 uppercase block">Poll Rate</span>
                <span className="text-white font-bold block mt-0.5">{pollRateMs} ms</span>
              </div>
              <div className="bg-scada-card border border-scada-border rounded-lg p-3 font-mono text-xs">
                <span className="text-[10px] text-zinc-500 uppercase block">Packets Received</span>
                <span className="text-emerald-400 font-bold block mt-0.5">{packetsReceived}</span>
              </div>
              <div className="bg-scada-card border border-scada-border rounded-lg p-3 font-mono text-xs">
                <span className="text-[10px] text-zinc-500 uppercase block">Packets Failed</span>
                <span className={cn('font-bold block mt-0.5', packetsFailed > 0 ? 'text-red-400' : 'text-zinc-400')}>
                  {packetsFailed}
                </span>
              </div>
              <div className="bg-scada-card border border-scada-border rounded-lg p-3 font-mono text-xs">
                <span className="text-[10px] text-zinc-500 uppercase block">Round-Trip Latency</span>
                <span className="text-cyan-300 font-bold block mt-0.5">
                  {latencyMs !== null ? `${latencyMs} ms` : '—'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 5: EVENT LOGS */}
        {/* ============================================================ */}
        {activeTab === 'logs' && (
          <div className="space-y-4 animate-in fade-in duration-200" role="tabpanel" id="tabpanel-logs" aria-labelledby="tab-logs">
            <EventLog logs={eventLogs} onClear={clearLogs} heightClass="h-[420px] sm:h-[540px]" />
          </div>
        )}
      </main>

      {/* Global Footer */}
      <Footer />

      {/* Connection & Network Settings Dialog */}
      <DeviceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentBaseUrl={baseUrl}
        connectionMode={connectionMode}
        pollRateMs={pollRateMs}
        latencyMs={latencyMs}
        packetsReceived={packetsReceived}
        packetsFailed={packetsFailed}
        onSaveBaseUrl={setBaseUrl}
        onToggleSimulator={setIsSimulator}
        onSelectPollRate={setPollRateMs}
        onClearSession={handleClearSession}
      />

      {/* Keyboard Shortcuts Cheat Sheet Dialog */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
};

export default DashboardPage;
