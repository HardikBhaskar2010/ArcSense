import React, { useState } from 'react';
import { useArcSense } from '../hooks/useArcSense';
import { useTelemetryHistory } from '../hooks/useTelemetryHistory';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { exportTelemetryToCsv } from '../lib/csv-export';

import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { TechnicalGrid } from '../components/effects/TechnicalGrid';
import { RiskPanel } from '../components/status/RiskPanel';
import { TelemetryGrid } from '../components/dashboard/TelemetryGrid';
import { EvidencePanel } from '../components/dashboard/EvidencePanel';
import { WaveformChart } from '../components/charts/WaveformChart';
import { TelemetryHistoryChart } from '../components/charts/TelemetryHistoryChart';
import { FaultSimulatorPanel } from '../components/controls/FaultSimulatorPanel';
import { EventLogPanel } from '../components/log/EventLogPanel';
import { DeviceSettingsModal } from '../components/controls/DeviceSettingsModal';
import { KeyboardShortcutsModal } from '../components/controls/KeyboardShortcutsModal';
import { ArcSenseBotBanner } from '../components/dashboard/ArcSenseBotBanner';
import { HardwareBridgeControls } from '../components/controls/HardwareBridgeControls';
import { MobileRemoteController } from '../components/controls/MobileRemoteController';
import { Play, Zap, Activity } from 'lucide-react';
import { cn } from '../lib/utils';

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'remote' | 'showcase'>('remote');

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

  return (
    <div className="relative min-h-screen bg-industrial-950 text-slate-100 flex flex-col font-sans selection:bg-white selection:text-black">
      {/* Background Engineering Grid */}
      <TechnicalGrid />

      {/* Top Header */}
      <Header
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
      />

      {/* Floating Paused Notification Banner */}
      {isPaused && (
        <div className="sticky top-0 z-20 bg-amber-500/90 text-slate-950 px-4 py-1.5 font-mono text-xs font-bold text-center flex items-center justify-center gap-2 shadow-lg backdrop-blur">
          <span>TELEMETRY STREAM PAUSED — Screen is holding current telemetry state.</span>
          <button
            type="button"
            onClick={togglePause}
            className="px-2 py-0.5 rounded bg-slate-950 text-amber-300 hover:bg-slate-900 border border-amber-400 text-[11px] flex items-center gap-1 transition-colors"
          >
            <Play className="w-3 h-3 fill-amber-300" />
            Resume (Space)
          </button>
        </div>
      )}

      {/* Main Control Room Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2 sm:p-4 lg:p-6 space-y-3 sm:space-y-4 lg:space-y-5 relative z-10">
        {/* Mobile View Toggle Switcher (Visible on Mobile / Tablet < 1024px) */}
        <div className="flex lg:hidden items-center p-1 bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-xl shadow-md">
          <button
            type="button"
            onClick={() => setMobileView('remote')}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5',
              mobileView === 'remote'
                ? 'bg-cyan-500 text-black shadow-glow-normal'
                : 'text-zinc-400 hover:text-white'
            )}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Command Remote (Loads)</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileView('showcase')}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5',
              mobileView === 'showcase'
                ? 'bg-zinc-700 text-white shadow'
                : 'text-zinc-400 hover:text-white'
            )}
          >
            <Activity className="w-3.5 h-3.5 text-zinc-300" />
            <span>Showcase Graphs</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* MOBILE VIEW (< lg): Remote Controller or Showcase */}
        {/* ============================================================ */}
        <div className="block lg:hidden space-y-3">
          {mobileView === 'remote' ? (
            /* Dedicated Compact Remote Controller (Loads & Commands FIRST) */
            <MobileRemoteController
              activeMode={activeFaultMode}
              isSimulator={isSimulator}
              isInjecting={isInjecting}
              isResetting={isResetting}
              tripped={state?.tripped ?? false}
              state={state}
              connectionMode={connectionMode}
              baseUrl={baseUrl}
              latencyMs={latencyMs}
              eventLogs={eventLogs}
              onInject={injectFault}
              onReset={resetDevice}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onToggleSimulator={setIsSimulator}
            />
          ) : (
            /* Mobile Showcase Mode: Load Changing stays #1, followed by charts */
            <div className="space-y-3">
              {/* Load Changing ALWAYS first on mobile */}
              <FaultSimulatorPanel
                activeMode={activeFaultMode}
                isSimulator={isSimulator}
                isInjecting={isInjecting}
                isResetting={isResetting}
                tripped={state?.tripped ?? false}
                onInject={injectFault}
                onReset={resetDevice}
                isCompact={true}
              />

              {/* Primary Risk & Live Scope */}
              <div className="space-y-3">
                <RiskPanel state={state} isSimulator={isSimulator} isStale={isStale} />
                <WaveformChart
                  waveform={waveform}
                  irms={state?.irms ?? 0}
                  isPaused={isPaused}
                  showReferenceSine={showReferenceSine}
                  onToggleReferenceSine={toggleReferenceSine}
                />
              </div>

              {/* 10 Sensor Telemetry Grid */}
              <TelemetryGrid state={state} />

              {/* History & Evidence */}
              <TelemetryHistoryChart
                data={history}
                tAmb={state?.tAmb ?? 28}
                isPaused={isPaused}
                historyWindowSec={historyWindowSec}
                onSelectWindow={setHistoryWindowSec}
              />
              <EvidencePanel state={state} />

              {/* Hardware Bridge & Assistant */}
              <HardwareBridgeControls
                connectionMode={connectionMode}
                baseUrl={baseUrl}
                state={state}
                latencyMs={latencyMs}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onRefreshTelemetry={() => injectFault(activeFaultMode)}
              />

              <EventLogPanel logs={eventLogs} onClear={clearLogs} />
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* DESKTOP VIEW (lg:): Full Multi-Column Control Room */}
        {/* ============================================================ */}
        <div className="hidden lg:block space-y-5">
          {/* ArcSense AI Bot Assistant & Boot Status */}
          <ArcSenseBotBanner
            connectionMode={connectionMode}
            baseUrl={baseUrl}
            state={state}
            latencyMs={latencyMs}
            isSimulator={isSimulator}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onToggleSimulator={setIsSimulator}
          />

          {/* Hardware Bridge & Remote Communication Controls */}
          <HardwareBridgeControls
            connectionMode={connectionMode}
            baseUrl={baseUrl}
            state={state}
            latencyMs={latencyMs}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onRefreshTelemetry={() => injectFault(activeFaultMode)}
          />

          {/* Row 1: Primary Risk & Live Scope */}
          <section className="grid grid-cols-12 gap-4">
            <div className="col-span-4 flex flex-col">
              <RiskPanel state={state} isSimulator={isSimulator} isStale={isStale} />
            </div>
            <div className="col-span-8 flex flex-col">
              <WaveformChart
                waveform={waveform}
                irms={state?.irms ?? 0}
                isPaused={isPaused}
                showReferenceSine={showReferenceSine}
                onToggleReferenceSine={toggleReferenceSine}
              />
            </div>
          </section>

          {/* Row 2: 10 Core Sensor Telemetry Cards */}
          <section>
            <TelemetryGrid state={state} />
          </section>

          {/* Row 3: History Trends & Evidence Decomposition */}
          <section className="grid grid-cols-12 gap-4">
            <div className="col-span-6 flex flex-col">
              <TelemetryHistoryChart
                data={history}
                tAmb={state?.tAmb ?? 28}
                isPaused={isPaused}
                historyWindowSec={historyWindowSec}
                onSelectWindow={setHistoryWindowSec}
              />
            </div>
            <div className="col-span-6 flex flex-col">
              <EvidencePanel state={state} />
            </div>
          </section>

          {/* Row 4: Fault Simulator & Real-Time Event Log */}
          <section className="grid grid-cols-12 gap-4">
            <div className="col-span-6 flex flex-col">
              <FaultSimulatorPanel
                activeMode={activeFaultMode}
                isSimulator={isSimulator}
                isInjecting={isInjecting}
                isResetting={isResetting}
                tripped={state?.tripped ?? false}
                onInject={injectFault}
                onReset={resetDevice}
              />
            </div>
            <div className="col-span-6 flex flex-col">
              <EventLogPanel logs={eventLogs} onClear={clearLogs} />
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <Footer />

      {/* Settings Dialog */}
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

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
};
