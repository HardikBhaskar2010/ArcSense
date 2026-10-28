import React, { useState, useEffect } from 'react';
import { ConnectionMode } from '../../types/arcsense';
import {
  Shield,
  Wifi,
  WifiOff,
  Settings,
  Download,
  RefreshCw,
  Cpu,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Keyboard,
  Activity,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface HeaderProps {
  connectionMode: ConnectionMode;
  baseUrl: string;
  isStale: boolean;
  lastUpdateTime: Date | null;
  latencyMs: number | null;
  isPaused: boolean;
  soundAlertsEnabled: boolean;
  onTogglePause: () => void;
  onToggleSoundAlerts: () => void;
  onOpenSettings: () => void;
  onExportCsv: () => void;
  onToggleSimulator: () => void;
  onOpenShortcuts: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  connectionMode,
  baseUrl,
  isStale,
  lastUpdateTime,
  latencyMs,
  isPaused,
  soundAlertsEnabled,
  onTogglePause,
  onToggleSoundAlerts,
  onOpenSettings,
  onExportCsv,
  onToggleSimulator,
  onOpenShortcuts,
}) => {
  const [secondsAgo, setSecondsAgo] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      if (lastUpdateTime) {
        const diff = Math.round((Date.now() - lastUpdateTime.getTime()) / 1000);
        setSecondsAgo(Math.max(0, diff));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lastUpdateTime]);

  const getConnectionBadge = () => {
    switch (connectionMode) {
      case 'LIVE':
        return {
          label: 'LIVE DEVICE',
          classes: 'bg-emerald-500 text-black font-bold border-emerald-400 shadow-glow-normal',
          icon: <Wifi className="w-3.5 h-3.5" />,
        };
      case 'SIMULATOR':
        return {
          label: 'SIMULATOR',
          classes: 'bg-amber-400 text-black font-bold border-amber-300 shadow-glow-watch',
          icon: <Cpu className="w-3.5 h-3.5" />,
        };
      case 'LINK_LOST':
        return {
          label: 'LINK LOST',
          classes: 'bg-red-600 text-white font-bold border-red-500 shadow-glow-danger animate-pulse',
          icon: <WifiOff className="w-3.5 h-3.5" />,
        };
      case 'CONNECTING':
      default:
        return {
          label: 'CONNECTING...',
          classes: 'bg-zinc-800 text-zinc-100 font-semibold border-zinc-700',
          icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
        };
    }
  };

  const badge = getConnectionBadge();

  return (
    <header className="relative z-10 bg-industrial-900 border-b border-zinc-800 px-4 py-2.5 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-glow-white shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="font-mono text-base sm:text-lg font-extrabold tracking-wider text-white uppercase">
                ArcSense
              </h1>
              <span className="font-mono text-[10px] text-zinc-300 border border-zinc-700 bg-zinc-900 px-1.5 py-0.2 rounded font-semibold">
                CAT C2 · DISASTER MGT
              </span>
            </div>
            <p className="font-mono text-[11px] text-zinc-400 font-medium">
              Pre-Fire Electrical Fault Predictor & Predictive Arc Protection
            </p>
          </div>
        </div>

        {/* Status Indicators & Action Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Main Connection Status Badge */}
          <div
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border tracking-wider transition-all duration-300',
              badge.classes
            )}
          >
            {badge.icon}
            <span>{badge.label}</span>
          </div>

          {/* Device IP / Source Address */}
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300">
            <span className="text-zinc-500">IP:</span>
            <span className="text-zinc-200 font-medium truncate max-w-[140px]">
              {connectionMode === 'SIMULATOR' ? 'demo scenarios' : baseUrl.replace('http://', '')}
            </span>
          </div>

          {/* Real-time Ping Latency */}
          {latencyMs !== null && (
            <div
              title="Round-trip request latency"
              className="hidden lg:flex items-center gap-1 px-2 py-1 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300"
            >
              <Activity className="w-3 h-3 text-zinc-400" />
              <span className="text-zinc-500">Ping:</span>
              <span className={cn('font-bold', latencyMs < 80 ? 'text-emerald-400' : 'text-amber-400')}>
                {latencyMs}ms
              </span>
            </div>
          )}

          {/* Last Update Counter */}
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300">
            <span className="text-zinc-500">Updated:</span>
            <span className={cn('font-semibold', isStale ? 'text-amber-400' : 'text-zinc-200')}>
              {secondsAgo < 2 ? 'live' : `${secondsAgo}s ago`}
            </span>
          </div>

          {/* Action: Pause / Resume Feed */}
          <button
            type="button"
            aria-label={isPaused ? 'Resume live telemetry stream' : 'Pause live telemetry stream'}
            onClick={onTogglePause}
            title={isPaused ? 'Resume Feed (Space)' : 'Pause Feed (Space)'}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 min-h-[38px] rounded border text-xs font-mono font-semibold transition-colors',
              isPaused
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-200'
            )}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> : <Pause className="w-3.5 h-3.5 text-zinc-300" />}
            <span className="hidden sm:inline">{isPaused ? 'RESUME' : 'PAUSE'}</span>
          </button>

          {/* Action: Toggle Sound Alerts */}
          <button
            type="button"
            aria-label={soundAlertsEnabled ? 'Mute audio alerts' : 'Enable audio alerts'}
            onClick={onToggleSoundAlerts}
            title={soundAlertsEnabled ? 'Audio Alerts Enabled (Click to Mute)' : 'Audio Alerts Muted (Click to Enable)'}
            className={cn(
              'p-2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded border transition-colors',
              soundAlertsEnabled
                ? 'bg-white text-black border-white'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
            )}
          >
            {soundAlertsEnabled ? <Volume2 className="w-4 h-4 text-black" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Action: Toggle Simulator/Live */}
          <button
            type="button"
            aria-label={connectionMode === 'SIMULATOR' ? 'Switch to live ESP32 device' : 'Switch to built-in simulator'}
            onClick={onToggleSimulator}
            className="px-2.5 py-1.5 min-h-[38px] rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono font-semibold text-white transition-colors"
          >
            {connectionMode === 'SIMULATOR' ? 'Connect Live' : 'Use Sim'}
          </button>

          {/* Action: Export CSV */}
          <button
            type="button"
            aria-label="Download CSV session telemetry data"
            onClick={onExportCsv}
            title="Download CSV session telemetry (C)"
            className="flex items-center gap-1 px-2.5 py-1.5 min-h-[38px] rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono font-semibold text-white transition-colors"
          >
            <Download className="w-4 h-4 text-zinc-300" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          {/* Action: Keyboard Shortcuts Guide */}
          <button
            type="button"
            aria-label="Open keyboard shortcuts cheat sheet"
            onClick={onOpenShortcuts}
            title="Keyboard Shortcuts (?)"
            className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-colors"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          {/* Action: Settings Modal */}
          <button
            type="button"
            aria-label="Configure connection settings"
            onClick={onOpenSettings}
            title="Configure connection settings (S)"
            className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
