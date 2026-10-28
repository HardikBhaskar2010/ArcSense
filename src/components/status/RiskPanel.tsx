import React from 'react';
import { ArcSenseState } from '../../types/arcsense';
import { RiskGauge } from './RiskGauge';
import { CircuitStateBadge } from './CircuitStateBadge';
import { getRiskLevelColor, getRiskLevelName } from '../../lib/utils';
import { ShieldCheck, AlertCircle, AlertTriangle, Flame, ShieldAlert, Cpu } from 'lucide-react';

interface RiskPanelProps {
  state: ArcSenseState | null;
  isSimulator: boolean;
  isStale: boolean;
}

export const RiskPanel: React.FC<RiskPanelProps> = ({ state, isSimulator, isStale }) => {
  if (!state) {
    return (
      <div className="bg-industrial-900 border border-zinc-800 rounded-xl p-5 flex flex-col items-center justify-center min-h-[300px]">
        <Cpu className="w-8 h-8 text-zinc-600 animate-pulse mb-3" />
        <span className="text-zinc-400 font-mono text-xs">Waiting for telemetry...</span>
      </div>
    );
  }

  const { risk, level, tripped, sensorFault, sT, sS, sA, sL, tObj, irms, arcCount, slope } = state;
  const levelColor = getRiskLevelColor(level);
  const levelName = getRiskLevelName(level);

  // Determine primary contributor
  const getPrimaryReason = (): { title: string; detail: string; icon: React.ReactNode } => {
    if (sensorFault) {
      return {
        title: 'Sensor Fail-Safe Trip',
        detail: 'MLX90614 infrared temperature sensor unreadable for >5s. Circuit opened automatically as fail-safe.',
        icon: <ShieldAlert className="w-4 h-4 text-red-400" />,
      };
    }
    if (sA >= 0.7 || arcCount >= 8) {
      return {
        title: 'Waveform Distortion (Arcing Signature)',
        detail: `Cycle-to-cycle differencing detected ${arcCount} arc-like current drops/sec. Indicates loose sparking contacts.`,
        icon: <Flame className="w-4 h-4 text-red-400" />,
      };
    }
    if (sT >= 0.7 || tObj >= 60) {
      return {
        title: 'Excessive Joint Surface Heating',
        detail: `Object temperature at ${tObj.toFixed(1)}°C (approaching 75°C PVC insulation limit). High contact resistance.`,
        icon: <AlertTriangle className="w-4 h-4 text-orange-400" />,
      };
    }
    if (sS >= 0.6 || slope >= 4.0) {
      return {
        title: 'Rapid Temperature Rate-of-Rise',
        detail: `Heating rate is +${slope.toFixed(1)}°C/min. Early predictive algorithm triggers before absolute limits are crossed.`,
        icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
      };
    }
    if (sL >= 0.6 || irms > 3.0) {
      return {
        title: 'Overload Load Current',
        detail: `RMS current ${irms.toFixed(2)}A exceeds circuit rating (3.0A). Continuous overload risks cable degradation.`,
        icon: <AlertCircle className="w-4 h-4 text-amber-400" />,
      };
    }
    return {
      title: 'Nominal Operating Conditions',
      detail: 'Waveform repeats synchronously every 20ms. Surface temperature and current within design limits.',
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
    };
  };

  const reason = getPrimaryReason();

  return (
    <div
      className={`relative bg-industrial-900 border rounded-xl p-5 flex flex-col justify-between transition-all duration-300 ${
        tripped
          ? 'border-red-500/70 shadow-glow-danger bg-red-950/20'
          : levelColor.border
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${tripped ? 'bg-red-500 animate-ping' : levelColor.bg.replace('/10', '')}`} style={{ backgroundColor: levelColor.hex }} />
          <h2 className="font-mono text-xs font-bold text-zinc-300 tracking-wider uppercase">
            Overall Risk Assessment
          </h2>
        </div>
        <CircuitStateBadge state={tripped ? 'TRIPPED' : 'LIVE'} isSimulator={isSimulator} />
      </div>

      {/* Central Gauge & Level Pill */}
      <div className="flex flex-col items-center py-4">
        <RiskGauge risk={risk} level={level} size={220} />

        {/* Level Pill */}
        <div className="mt-3 flex items-center gap-2">
          <span
            className={`px-4 py-1 rounded-full font-mono text-sm font-bold tracking-widest uppercase border ${levelColor.text} ${levelColor.bg} ${levelColor.border} ${levelColor.glow}`}
          >
            {levelName}
          </span>
          {isStale && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40">
              STALE DATA
            </span>
          )}
        </div>
      </div>

      {/* Tripped Alarm Banner */}
      {tripped && (
        <div className="mb-3 p-3 rounded-lg bg-red-950/90 border border-red-500 text-red-200 text-center animate-trip-flash shadow-glow-danger">
          <div className="flex items-center justify-center gap-2 font-mono font-bold text-xs uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span>CIRCUIT TRIPPED &mdash; POWER ISOLATED</span>
          </div>
          <p className="text-[11px] text-red-300/90 mt-1">
            {isSimulator
              ? 'Virtual relay released. In live hardware, de-energized coil opens 12V loop to prevent fire.'
              : 'Fail-safe relay coil released. Check hardware fault before pressing RESET.'}
          </p>
        </div>
      )}

      {/* Primary Contributor Box */}
      <div className="mt-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-1">
          {reason.icon}
          <span className="font-mono text-xs font-semibold text-zinc-200">
            {reason.title}
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed font-sans pl-6">
          {reason.detail}
        </p>
      </div>
    </div>
  );
};
