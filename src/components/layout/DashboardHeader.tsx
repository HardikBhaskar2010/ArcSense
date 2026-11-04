import React, { useState, useEffect, useRef } from 'react';
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
  MoreVertical,
  Trash2,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface DashboardHeaderProps {
  connectionMode: ConnectionMode;
  baseUrl: string;
  deviceName?: string;
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
  onClearSession?: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  connectionMode,
  baseUrl,
  deviceName,
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
  onClearSession,
}) => {
  const [secondsAgo, setSecondsAgo] = useState<number>(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close overflow menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

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
          label: deviceName ? `${deviceName}` : 'LIVE NODE',
          sub: latencyMs !== null ? `${latencyMs}ms` : 'online',
          classes: 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50 shadow-glow-normal',
          icon: <Wifi className="w-3.5 h-3.5 text-emerald-400" />,
        };
      case 'SIMULATOR':
        return {
          label: 'SIMULATOR',
          sub: 'Virtual Arc Loop',
          classes: 'bg-amber-950/80 text-amber-300 border-amber-500/50 shadow-glow-watch',
          icon: <Cpu className="w-3.5 h-3.5 text-amber-400" />,
        };
      case 'LINK_LOST':
        return {
          label: 'LINK LOST',
          sub: 'Offline',
          classes: 'bg-red-950/90 text-red-300 border-red-500/60 shadow-glow-danger animate-pulse',
          icon: <WifiOff className="w-3.5 h-3.5 text-red-400" />,
        };
      case 'CONNECTING':
      default:
        return {
          label: 'CONNECTING...',
          sub: 'Handshake',
          classes: 'bg-zinc-900 text-zinc-300 border-zinc-700',
          icon: <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />,
        };
    }
  };

  const badge = getConnectionBadge();

  return (
    <header className="relative z-30 bg-industrial-900 border-b border-zinc-800 px-3 py-2 sm:px-5 sm:py-2.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Left Section: Logo, Application Name, Small Subtitle */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white shadow-glow-white shrink-0">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="font-mono text-sm sm:text-base font-extrabold tracking-wider text-white uppercase truncate">
                ArcSense
              </h1>
              <span className="font-mono text-[9px] sm:text-[10px] text-zinc-300 border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 rounded font-semibold tracking-wider shrink-0 hidden xs:inline-block">
                CAT C2
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-zinc-400 font-sans truncate hidden sm:block">
              Pre-Fire Electrical Fault Predictor & Predictive Arc Protection
            </p>
          </div>
        </div>

        {/* Right Section: Core Controls & Indicators */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Connection Status Badge */}
          <div
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1 rounded-md text-[11px] sm:text-xs font-mono border transition-all duration-300',
              badge.classes
            )}
            title={`Mode: ${connectionMode} · Base: ${baseUrl}`}
          >
            {badge.icon}
            <span className="font-bold truncate max-w-[85px] sm:max-w-[130px]">{badge.label}</span>
          </div>

          {/* Mode Switch: Live vs Sim */}
          <button
            type="button"
            aria-label={connectionMode === 'SIMULATOR' ? 'Switch to live ESP8266 node' : 'Switch to built-in simulator'}
            onClick={onToggleSimulator}
            title={connectionMode === 'SIMULATOR' ? 'Switch to Live Hardware' : 'Switch to Virtual Simulator'}
            className={cn(
              'px-2 sm:px-2.5 py-1 sm:py-1.5 min-h-[34px] sm:min-h-[36px] rounded-md font-mono text-xs font-semibold border transition-all duration-200 flex items-center gap-1',
              connectionMode === 'SIMULATOR'
                ? 'bg-amber-400 text-black border-amber-300 font-bold shadow-glow-watch'
                : 'bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700'
            )}
          >
            <span className="text-[10px] uppercase hidden xs:inline">{connectionMode === 'SIMULATOR' ? '' : 'Mode:'}</span>
            <span>{connectionMode === 'SIMULATOR' ? 'SIM' : 'LIVE'}</span>
          </button>

          {/* Pause / Resume Button */}
          <button
            type="button"
            aria-label={isPaused ? 'Resume live telemetry stream (Space)' : 'Pause live telemetry stream (Space)'}
            onClick={onTogglePause}
            title={isPaused ? 'Resume Stream (Space)' : 'Pause Stream (Space)'}
            className={cn(
              'flex items-center justify-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 min-h-[34px] sm:min-h-[36px] rounded-md border text-xs font-mono font-semibold transition-colors',
              isPaused
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 hover:bg-amber-500/30'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-200'
            )}
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span className="hidden md:inline">RESUME</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 text-zinc-300" />
                <span className="hidden md:inline">PAUSE</span>
              </>
            )}
          </button>

          {/* Settings Button */}
          <button
            type="button"
            aria-label="Configure connection settings"
            onClick={onOpenSettings}
            title="Configure connection settings (S)"
            className="p-1.5 sm:p-2 min-h-[34px] min-w-[34px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-colors"
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Secondary Actions Overflow Menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="More dashboard options"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title="More Actions"
              className={cn(
                'p-1.5 sm:p-2 min-h-[34px] min-w-[34px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center rounded-md border transition-colors',
                isMenuOpen
                  ? 'bg-zinc-800 border-white text-white'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
              )}
            >
              <MoreVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-1.5 w-56 rounded-lg bg-zinc-900 border border-zinc-700 shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-150 font-mono text-xs"
              >
                {/* Audio Alerts Toggle */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onToggleSoundAlerts();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    {soundAlertsEnabled ? (
                      <Volume2 className="w-4 h-4 text-white" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-zinc-500" />
                    )}
                    <span>Sound Alerts</span>
                  </div>
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded border',
                      soundAlertsEnabled
                        ? 'bg-white text-black font-bold border-white'
                        : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                    )}
                  >
                    {soundAlertsEnabled ? 'ON' : 'MUTED'}
                  </span>
                </button>

                {/* CSV Export */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onExportCsv();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-zinc-300" />
                    <span>Export CSV</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">Press C</span>
                </button>

                {/* Keyboard Shortcuts (Hidden on touch-only devices) */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onOpenShortcuts();
                    setIsMenuOpen(false);
                  }}
                  className="hidden md:flex w-full items-center justify-between px-3 py-2 text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors text-left border-t border-zinc-800"
                >
                  <div className="flex items-center gap-2">
                    <Keyboard className="w-4 h-4 text-zinc-400" />
                    <span>Keyboard Shortcuts</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">?</span>
                </button>

                {/* Clear Session Data (if provided) */}
                {onClearSession && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      if (window.confirm('Clear all session telemetry history and event logs?')) {
                        onClearSession();
                      }
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-zinc-400 hover:text-red-300 hover:bg-red-950/20 transition-colors text-left border-t border-zinc-800"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                    <span>Clear Session Buffer</span>
                  </button>
                )}

                {/* Telemetry info footer */}
                <div className="px-3 py-1.5 border-t border-zinc-800 text-[10px] text-zinc-500 flex items-center justify-between">
                  <span>Stream sync:</span>
                  <span className={cn(isStale ? 'text-amber-400' : 'text-zinc-300')}>
                    {secondsAgo < 2 ? 'live' : `${secondsAgo}s ago`}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
