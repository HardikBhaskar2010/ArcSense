import React from 'react';
import { ConnectionMode, ArcSenseState } from '../../types/arcsense';
import { Radio, WifiOff, CheckCircle2, ChevronDown, ChevronUp, Cpu, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';

interface HardwareStatusProps {
  connectionMode: ConnectionMode;
  baseUrl: string;
  state: ArcSenseState | null;
  latencyMs: number | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenSettings: () => void;
}

export const HardwareStatus: React.FC<HardwareStatusProps> = ({
  connectionMode,
  baseUrl,
  state,
  latencyMs,
  isExpanded,
  onToggleExpand,
  onOpenSettings,
}) => {
  const isLive = connectionMode === 'LIVE';

  const getSignalQuality = (rssi?: number) => {
    if (rssi === undefined || rssi === 0) return { label: 'Direct AP / Unknown', color: 'text-zinc-400' };
    if (rssi >= -60) return { label: `${rssi} dBm (Excellent)`, color: 'text-emerald-400' };
    if (rssi >= -75) return { label: `${rssi} dBm (Good)`, color: 'text-cyan-400' };
    if (rssi >= -85) return { label: `${rssi} dBm (Fair)`, color: 'text-amber-400' };
    return { label: `${rssi} dBm (Weak)`, color: 'text-red-400' };
  };

  const sig = getSignalQuality(state?.wifiRssi);
  const deviceName = state?.deviceName || (isLive ? 'ArcSense-ESP8266' : 'ArcSense-Node');

  return (
    <div className="bg-scada-card border border-scada-border rounded-xl p-3 sm:p-4 shadow-lg transition-all font-mono text-xs">
      {/* Compact Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-scada-surface border border-scada-border flex items-center justify-center text-cyan-400 shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white uppercase tracking-wider text-xs sm:text-sm">
                Hardware Node:
              </span>
              <span className="text-cyan-300 font-bold truncate">{deviceName}</span>
              <span
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1',
                  isLive
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50'
                    : connectionMode === 'SIMULATOR'
                    ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                )}
              >
                {isLive ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : connectionMode === 'SIMULATOR' ? (
                  <Cpu className="w-3 h-3 text-amber-400" />
                ) : (
                  <WifiOff className="w-3 h-3" />
                )}
                <span>{isLive ? 'LINKED' : connectionMode}</span>
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-sans truncate mt-0.5">
              Wi-Fi: {state?.wifiSsid || (isLive ? 'ArcSense-ESP' : 'Simulated')} &middot; Signal:{' '}
              <span className={sig.color}>{sig.label}</span> &middot; Latency:{' '}
              {latencyMs !== null ? `${latencyMs}ms` : '< 20ms'} &middot; Relay:{' '}
              <strong className={state?.tripped ? 'text-red-400' : 'text-emerald-400'}>
                {state?.tripped ? 'TRIPPED (OPEN)' : 'ENERGIZED (CLOSED)'}
              </strong>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={onOpenSettings}
            className="px-2.5 py-1.5 rounded-lg bg-scada-surface hover:bg-scada-card border border-scada-border text-zinc-300 hover:text-white text-[11px] transition-colors flex items-center gap-1"
          >
            <Settings className="w-3 h-3" />
            <span className="hidden xs:inline">IP:</span>
            <span className="font-mono text-zinc-400 truncate max-w-[100px]">
              {baseUrl.replace(/^https?:\/\//, '')}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleExpand}
            className={cn(
              'px-3 py-1.5 rounded-lg border font-mono text-[11px] font-semibold flex items-center gap-1.5 transition-all',
              isExpanded
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/60'
                : 'bg-scada-surface hover:bg-scada-card border-scada-border text-zinc-300 hover:text-white'
            )}
          >
            <span>{isExpanded ? 'Hide Controls' : 'Diagnostics & Remote Controls'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
