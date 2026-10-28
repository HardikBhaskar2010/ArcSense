import React, { useState, useEffect } from 'react';
import { Bot, Wifi, Zap, Settings, Terminal, Radio } from 'lucide-react';
import { ConnectionMode, ArcSenseState } from '../../types/arcsense';
import { cn } from '../../lib/utils';

interface ArcSenseBotBannerProps {
  connectionMode: ConnectionMode;
  baseUrl: string;
  state: ArcSenseState | null;
  latencyMs: number | null;
  isSimulator?: boolean;
  onOpenSettings: () => void;
  onToggleSimulator: (val: boolean) => void;
}

export const ArcSenseBotBanner: React.FC<ArcSenseBotBannerProps> = ({
  connectionMode,
  baseUrl,
  state,
  latencyMs,
  onOpenSettings,
  onToggleSimulator,
}) => {
  const [bootStep, setBootStep] = useState<number>(0);

  // Progressive bot boot sequence
  useEffect(() => {
    const t1 = setTimeout(() => setBootStep(1), 800);
    const t2 = setTimeout(() => setBootStep(2), 2000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const getBotMessage = () => {
    if (bootStep === 0) {
      return {
        prefix: 'ArcSense System Boot',
        text: 'Hi, ArcSense Here. Booting....',
        color: 'text-sky-400',
        badge: 'BOOTING',
        badgeClass: 'bg-sky-950 text-sky-400 border-sky-600/50',
      };
    }

    const deviceName = state?.deviceName || 'ArcSense-ESP8266';

    if (connectionMode === 'LIVE') {
      const ssid = state?.wifiSsid || 'Network';
      const rssi = state?.wifiRssi !== undefined && state.wifiRssi !== 0 ? ` (${state.wifiRssi} dBm)` : '';
      const ip = state?.wifiIp || baseUrl.replace(/^https?:\/\//, '');
      return {
        prefix: 'ArcSense Agent',
        text: `Connected ${deviceName} • Wi-Fi: ${ssid}${rssi} • Laptop Handshake Confirmed • Live Telemetry Active at ${ip}`,
        color: 'text-emerald-400',
        badge: `CONNECTED ${deviceName}`,
        badgeClass: 'bg-emerald-950/80 text-emerald-400 border-emerald-500/60 shadow-glow-normal',
      };
    }

    if (connectionMode === 'CONNECTING') {
      return {
        prefix: 'ArcSense Agent',
        text: `Connecting to ${deviceName} at ${baseUrl}... Synchronizing real-time telemetry stream.`,
        color: 'text-amber-300',
        badge: 'CONNECTING...',
        badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-500/50 animate-pulse',
      };
    }

    if (connectionMode === 'SIMULATOR') {
      return {
        prefix: 'ArcSense Agent',
        text: 'Standalone Physics Simulator Active (Offline Mode). Synthesizing virtual arc faults, heating, and relay tripping.',
        color: 'text-amber-400',
        badge: 'SIMULATOR',
        badgeClass: 'bg-amber-950 text-amber-400 border-amber-600/60',
      };
    }

    // LINK_LOST / OFFLINE
    return {
      prefix: 'ArcSense Agent',
      text: `Hardware not detected at ${baseUrl}. Waiting for ESP8266 node to power on or connect to Wi-Fi.`,
      color: 'text-red-400',
      badge: 'STANDBY / OFFLINE',
      badgeClass: 'bg-red-950/80 text-red-400 border-red-600/60',
    };
  };

  const msg = getBotMessage();

  return (
    <div className="relative overflow-hidden rounded-xl bg-industrial-900/90 border border-zinc-800 shadow-xl backdrop-blur-md transition-all">
      {/* Top subtle highlight line */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 h-0.5 transition-colors duration-500',
          connectionMode === 'LIVE'
            ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600'
            : connectionMode === 'SIMULATOR'
              ? 'bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600'
              : connectionMode === 'CONNECTING'
                ? 'bg-gradient-to-r from-sky-500 via-blue-400 to-sky-600'
                : 'bg-gradient-to-r from-red-500 via-rose-400 to-red-600'
        )}
      />

      <div className="p-3 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 font-mono">
        {/* Left: Bot Identity & Live Text */}
        <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
          <div
            className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border transition-transform duration-300',
              connectionMode === 'LIVE'
                ? 'bg-emerald-950 border-emerald-500/50 text-emerald-400 shadow-glow-normal scale-105'
                : connectionMode === 'SIMULATOR'
                  ? 'bg-amber-950 border-amber-500/50 text-amber-400'
                  : connectionMode === 'CONNECTING'
                    ? 'bg-sky-950 border-sky-500/50 text-sky-400 animate-spin-slow'
                    : 'bg-red-950 border-red-500/50 text-red-400'
            )}
          >
            <Bot className="w-5 h-5" />
          </div>

          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-200 tracking-wider flex items-center gap-1.5">
                <Terminal className="w-3 h-3 text-zinc-400" />
                {msg.prefix}
              </span>
              <span
                className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider',
                  msg.badgeClass
                )}
              >
                {msg.badge}
              </span>
              {latencyMs !== null && connectionMode === 'LIVE' && (
                <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                  <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                  {latencyMs}ms ping
                </span>
              )}
            </div>

            <p className={cn('text-xs sm:text-[13px] font-medium leading-relaxed truncate-2-lines', msg.color)}>
              {msg.text}
              <span className="inline-block w-1.5 h-3.5 bg-current ml-1 animate-pulse align-middle" />
            </p>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-800">
          {connectionMode === 'LIVE' ? (
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex-1 md:flex-initial px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>Hardware Link Settings</span>
            </button>
          ) : connectionMode === 'SIMULATOR' ? (
            <button
              type="button"
              onClick={() => onToggleSimulator(false)}
              className="flex-1 md:flex-initial px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Reconnect to Hardware Node</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onOpenSettings}
                className="flex-1 md:flex-initial px-3 py-1.5 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-600/50 text-sky-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Configure Node IP</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleSimulator(true)}
                className="flex-1 md:flex-initial px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Launch Simulator</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
