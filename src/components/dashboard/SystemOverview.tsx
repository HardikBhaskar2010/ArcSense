import React from 'react';
import { ArcSenseState, ConnectionMode, RiskLevel } from '../../types/arcsense';
import { Flame, Zap, TrendingUp, Radio, ShieldAlert, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SystemOverviewProps {
  state: ArcSenseState | null;
  connectionMode: ConnectionMode;
  latencyMs: number | null;
  isSimulator: boolean;
  isStale: boolean;
}

export const SystemOverview: React.FC<SystemOverviewProps> = ({
  state,
  connectionMode,
  latencyMs,
  isSimulator,
  isStale,
}) => {
  if (!state) {
    return (
      <div className="bg-scada-card border border-scada-border rounded-xl p-4 animate-pulse text-zinc-500 font-mono text-xs flex items-center justify-center">
        Gathering initial system telemetry...
      </div>
    );
  }

  const { risk, level, tripped, sensorFault, irms, slope, dT, arcCount, tObj } = state;

  // Consistency rule: if sensorFault or high slope or high arcs, don't show purely benign "NORMAL"
  const getDerivedStatus = (): {
    label: 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL' | 'TRIPPED';
    color: string;
    bgColor: string;
    borderColor: string;
    icon: React.ReactNode;
    subtitle: string;
  } => {
    if (tripped) {
      return {
        label: 'TRIPPED',
        color: 'text-red-400',
        bgColor: 'bg-red-950/40',
        borderColor: 'border-red-500/60',
        icon: <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />,
        subtitle: 'Fail-safe relay coil open',
      };
    }
    if (sensorFault) {
      return {
        label: 'CRITICAL',
        color: 'text-red-400',
        bgColor: 'bg-red-950/30',
        borderColor: 'border-red-500/50',
        icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
        subtitle: 'MLX90614 sensor unreachable',
      };
    }
    if (level === RiskLevel.DANGER || arcCount >= 10 || tObj >= 75) {
      return {
        label: 'CRITICAL',
        color: 'text-red-400',
        bgColor: 'bg-red-950/30',
        borderColor: 'border-red-500/50',
        icon: <ShieldAlert className="w-4 h-4 text-red-400" />,
        subtitle: 'Arc or thermal trip threshold',
      };
    }
    if (level === RiskLevel.WARNING || slope >= 4.0 || irms > 3.0 || dT >= 25) {
      return {
        label: 'WARNING',
        color: 'text-orange-400',
        bgColor: 'bg-orange-950/30',
        borderColor: 'border-orange-500/50',
        icon: <AlertTriangle className="w-4 h-4 text-orange-400" />,
        subtitle: 'Elevated stress on joint',
      };
    }
    if (level === RiskLevel.WATCH || slope >= 2.0 || arcCount > 0 || dT >= 15) {
      return {
        label: 'WATCH',
        color: 'text-amber-400',
        bgColor: 'bg-amber-950/30',
        borderColor: 'border-amber-500/40',
        icon: <AlertCircle className="w-4 h-4 text-amber-400" />,
        subtitle: 'Early predictive indicators',
      };
    }
    return {
      label: 'NORMAL',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-950/30',
      borderColor: 'border-emerald-500/40',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
      subtitle: 'Nominal operating conditions',
    };
  };

  const status = getDerivedStatus();
  const peakCurrentA = irms * Math.SQRT2;
  const clampedRisk = Math.round(Math.max(0, Math.min(100, risk)));

  return (
    <div className="bg-industrial-900 border border-zinc-800 rounded-xl p-3 sm:p-4 shadow-xl transition-all">
      {/* 5-Metric Structured Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 sm:gap-3.5">
        {/* 1. Fire Risk Index (Most Visually Prominent) */}
        <div className="col-span-2 sm:col-span-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 sm:p-3 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 font-mono text-[10px] sm:text-[11px] uppercase tracking-wider mb-1">
            <span className="flex items-center gap-1.5 font-bold text-zinc-300">
              <Flame className="w-3.5 h-3.5 text-white" />
              Fire Risk Index
            </span>
            <span className="text-[10px] text-zinc-500">0–100</span>
          </div>

          <div className="flex items-baseline gap-1.5 my-0.5">
            <span
              className={cn(
                'font-mono text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums',
                status.color
              )}
            >
              {clampedRisk}
            </span>
            <span className="font-mono text-xs text-zinc-500 font-bold uppercase">/ 100</span>
          </div>

          {/* Mini progress bar */}
          <div className="w-full bg-zinc-900 rounded-full h-1.5 mt-1 overflow-hidden border border-zinc-800">
            <div
              className={cn('h-full transition-all duration-300', {
                'bg-emerald-500': clampedRisk < 25,
                'bg-amber-400': clampedRisk >= 25 && clampedRisk < 50,
                'bg-orange-500': clampedRisk >= 50 && clampedRisk < 75,
                'bg-red-500': clampedRisk >= 75,
              })}
              style={{ width: `${Math.max(4, clampedRisk)}%` }}
            />
          </div>
        </div>

        {/* 2. Current System Status */}
        <div
          className={cn(
            'bg-zinc-950 border rounded-lg p-2.5 sm:p-3 flex flex-col justify-between transition-colors',
            status.borderColor
          )}
        >
          <div className="flex items-center justify-between text-zinc-400 font-mono text-[10px] sm:text-[11px] uppercase tracking-wider mb-1">
            <span className="font-bold text-zinc-300">System Status</span>
            {status.icon}
          </div>

          <div className="my-0.5">
            <span
              className={cn(
                'font-mono text-base sm:text-lg font-extrabold tracking-wider uppercase block',
                status.color
              )}
            >
              {status.label}
            </span>
            <span className="text-[10px] text-zinc-400 font-sans truncate block mt-0.5">
              {status.subtitle}
            </span>
          </div>
        </div>

        {/* 3. Peak Electrical Current */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 sm:p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 font-mono text-[10px] sm:text-[11px] uppercase tracking-wider mb-1">
            <span className="flex items-center gap-1.5 font-bold text-zinc-300">
              <Zap className="w-3.5 h-3.5 text-white" />
              Peak Current
            </span>
            <span
              className={cn(
                'text-[9px] font-mono px-1 py-0.2 rounded font-bold uppercase',
                irms > 3.0 ? 'bg-red-950 text-red-400 border border-red-800' : 'text-zinc-500'
              )}
            >
              {irms > 3.0 ? 'Overload' : 'Nominal'}
            </span>
          </div>

          <div className="my-0.5">
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-lg sm:text-xl font-extrabold text-white tabular-nums">
                ±{peakCurrentA.toFixed(2)}
              </span>
              <span className="font-mono text-xs text-zinc-400">A</span>
            </div>
            <span className="text-[10px] font-mono text-zinc-400 block mt-0.5">
              RMS: <strong className="text-zinc-200">{irms.toFixed(2)} A</strong> (50 Hz)
            </span>
          </div>
        </div>

        {/* 4. Temperature Rate-of-Rise */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 sm:p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 font-mono text-[10px] sm:text-[11px] uppercase tracking-wider mb-1">
            <span className="flex items-center gap-1.5 font-bold text-zinc-300">
              <TrendingUp className="w-3.5 h-3.5 text-orange-400" />
              Temp Rate (Slope)
            </span>
            <span
              className={cn(
                'text-[9px] font-mono px-1 py-0.2 rounded font-bold uppercase',
                slope >= 4.0
                  ? 'bg-red-950 text-red-400 border border-red-800'
                  : slope >= 2.0
                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                  : 'text-zinc-500'
              )}
            >
              {slope >= 4.0 ? 'Rapid' : slope >= 2.0 ? 'Warm' : 'Stable'}
            </span>
          </div>

          <div className="my-0.5">
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-lg sm:text-xl font-extrabold text-white tabular-nums">
                {slope >= 0 ? '+' : ''}{slope.toFixed(1)}
              </span>
              <span className="font-mono text-xs text-zinc-400">°C/min</span>
            </div>
            <span className="text-[10px] font-mono text-zinc-400 block mt-0.5">
              ΔT: <strong className="text-zinc-200">{dT >= 0 ? '+' : ''}{dT.toFixed(1)} °C</strong> ({tObj.toFixed(1)}°C)
            </span>
          </div>
        </div>

        {/* 5. Hardware Connection Status */}
        <div className="col-span-2 sm:col-span-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 sm:p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 font-mono text-[10px] sm:text-[11px] uppercase tracking-wider mb-1">
            <span className="flex items-center gap-1.5 font-bold text-zinc-300">
              <Radio className="w-3.5 h-3.5 text-white" />
              Hardware Link
            </span>
            {isStale && (
              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                STALE
              </span>
            )}
          </div>

          <div className="my-0.5">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'w-2 h-2 rounded-full shrink-0',
                  tripped ? 'bg-red-500 animate-ping' : connectionMode === 'LIVE' ? 'bg-emerald-400' : 'bg-amber-400'
                )}
              />
              <span className="font-mono text-xs sm:text-sm font-bold text-white uppercase truncate">
                {tripped
                  ? 'Relay Open (Tripped)'
                  : connectionMode === 'LIVE'
                  ? 'Node Online'
                  : isSimulator
                  ? 'Simulator'
                  : 'Connecting'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-zinc-400 block mt-1 truncate">
              {latencyMs !== null ? `Ping: ${latencyMs}ms` : '< 20ms'} · Coil: {tripped ? 'De-energized' : 'Held Live'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
