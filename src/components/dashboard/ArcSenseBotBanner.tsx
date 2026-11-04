import React, { useState, useEffect } from 'react';
import { Wifi, Terminal } from 'lucide-react';
import { ConnectionMode, ArcSenseState } from '../../types/arcsense';
import { cn } from '../../lib/utils';

interface ArcSenseBotBannerProps {
  connectionMode: ConnectionMode;
  baseUrl: string;
  state: ArcSenseState | null;
  latencyMs?: number | null;
  isSimulator?: boolean;
  onOpenSettings?: () => void;
  onToggleSimulator: (val: boolean) => void;
}

export const ArcSenseBotBanner: React.FC<ArcSenseBotBannerProps> = ({
  connectionMode,
  baseUrl,
  state,
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
    <div className="relative overflow-hidden rounded-xl bg-scada-card border border-scada-border shadow-lg transition-all">
      {/* Top subtle highlight line */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 h-0.5 transition-colors duration-500',
          connectionMode === 'LIVE'
            ? 'bg-emerald-500'
            : connectionMode === 'SIMULATOR'
            ? 'bg-amber-400'
            : connectionMode === 'CONNECTING'
            ? 'bg-cyan-500 animate-pulse'
            : 'bg-red-500'
        )}
      />

      <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 font-mono text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-scada-surface border border-scada-border flex items-center justify-center text-cyan-400 shrink-0">
            <Terminal className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">
                &gt; {msg.prefix}
              </span>
              <span
                className={cn(
                  'px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider border font-bold',
                  msg.badgeClass
                )}
              >
                {msg.badge}
              </span>
            </div>
            <p className={cn('text-[11px] font-sans truncate mt-0.5', msg.color)}>
              {msg.text}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {connectionMode !== 'LIVE' && (
            <button
              type="button"
              onClick={() => onToggleSimulator(false)}
              className="px-2.5 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 text-[10px] font-mono font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span>Connect Live Hardware</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
