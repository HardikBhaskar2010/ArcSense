import React from 'react';
import { ArcSenseState } from '../../types/arcsense';
import { RiskGauge } from './RiskGauge';
import { CircuitStateBadge } from './CircuitStateBadge';
import { PredictiveAlerts } from './PredictiveAlerts';
import { getRiskLevelColor, getRiskLevelName } from '../../lib/utils';
import { ShieldCheck, AlertCircle, AlertTriangle, Flame, ShieldAlert, Cpu, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface RiskAssessmentProps {
  state: ArcSenseState | null;
  isSimulator: boolean;
  isStale: boolean;
  onReset?: () => void;
  isResetting?: boolean;
}

export const RiskAssessment: React.FC<RiskAssessmentProps> = ({
  state,
  isSimulator,
  isStale,
  onReset,
  isResetting = false,
}) => {
  if (!state) {
    return (
      <div className="bg-scada-card border border-scada-border rounded-xl p-5 flex flex-col items-center justify-center min-h-[280px]">
        <Cpu className="w-8 h-8 text-zinc-600 animate-pulse mb-3" />
        <span className="text-zinc-400 font-mono text-xs">Waiting for telemetry stream...</span>
      </div>
    );
  }

  const { risk, level, tripped, sensorFault, sT, sS, sA, sL, tObj, irms, arcCount, slope } = state;
  const levelColor = getRiskLevelColor(level);
  const levelName = getRiskLevelName(level);

  // Determine primary contributing factor for physical explanation
  const getPrimaryReason = (): { title: string; detail: string; icon: React.ReactNode } => {
    if (sensorFault) {
      return {
        title: 'Sensor Fail-Safe Triggered',
        detail: 'MLX90614 infrared temperature sensor communication timed out. Failsafe circuit opened.',
        icon: <ShieldAlert className="w-4 h-4 text-red-400" />,
      };
    }
    if (sA >= 0.7 || arcCount >= 8) {
      return {
        title: 'Arcing Waveform Signature',
        detail: `Cycle differencing detected ${arcCount} arc-like current dropouts/sec. High probability of sparking contacts.`,
        icon: <Flame className="w-4 h-4 text-red-400" />,
      };
    }
    if (sT >= 0.7 || tObj >= 60) {
      return {
        title: 'Excessive Joint Surface Temperature',
        detail: `Joint reached ${tObj.toFixed(1)}°C (approaching 75°C PVC limit). Resistive heating detected at terminals.`,
        icon: <AlertTriangle className="w-4 h-4 text-orange-400" />,
      };
    }
    if (sS >= 0.6 || slope >= 4.0) {
      return {
        title: 'Rapid Temperature Rate-of-Rise',
        detail: `Rate-of-rise is +${slope.toFixed(1)}°C/min. Predictive heating model anticipates insulation compromise.`,
        icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
      };
    }
    if (sL >= 0.6 || irms > 3.0) {
      return {
        title: 'Overload Load Current',
        detail: `Current ${irms.toFixed(2)}A exceeds 3.0A circuit rating. Continuous overload risks thermal degradation.`,
        icon: <AlertCircle className="w-4 h-4 text-amber-400" />,
      };
    }
    return {
      title: 'Nominal Operating Parameters',
      detail: 'Mains waveform repeats synchronously every 20ms. Surface temperature and load within safe design limits.',
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
    };
  };

  const reason = getPrimaryReason();

  return (
    <div
      className={cn(
        'bg-industrial-900 border rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 shadow-xl',
        tripped
          ? 'border-red-500/70 shadow-glow-danger bg-red-950/20'
          : 'border-zinc-800 hover:border-zinc-700'
      )}
    >
      {/* Top Header: Title & Circuit State Badge */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800 gap-2">
        <div className="flex items-center gap-2">
          <div
            className={cn('w-2.5 h-2.5 rounded-full shrink-0', tripped ? 'bg-red-500 animate-ping' : '')}
            style={{ backgroundColor: tripped ? '#ef4444' : levelColor.hex }}
          />
          <h2 className="font-mono text-xs font-bold text-white tracking-wider uppercase">
            Fire Risk Assessment
          </h2>
        </div>
        <CircuitStateBadge state={tripped ? 'TRIPPED' : 'LIVE'} isSimulator={isSimulator} />
      </div>

      {/* Central Risk Gauge & Status Pill */}
      <div className="flex flex-col items-center py-3 sm:py-4">
        <RiskGauge risk={risk} level={level} size={210} />

        {/* Level Pill */}
        <div className="mt-2.5 flex items-center gap-2">
          <span
            className={cn(
              'px-3.5 py-1 rounded-full font-mono text-xs font-extrabold tracking-widest uppercase border',
              levelColor.text,
              levelColor.bg,
              levelColor.border,
              levelColor.glow
            )}
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

      {/* Tripped Alarm Banner with Immediate Reset Action */}
      {tripped && (
        <div className="mb-3 p-3 rounded-lg bg-red-950/90 border border-red-500/80 text-red-200 text-center shadow-glow-danger animate-trip-flash space-y-2">
          <div className="flex items-center justify-center gap-2 font-mono font-bold text-xs uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span>CIRCUIT TRIPPED — POWER ISOLATED</span>
          </div>
          <p className="text-[11px] text-red-300/90 font-sans">
            {isSimulator
              ? 'Virtual relay coil released. Circuit is de-energized.'
              : 'Physical relay coil de-energized (D5). Check physical joint before clearing.'}
          </p>
          {onReset && (
            <button
              type="button"
              disabled={isResetting}
              onClick={onReset}
              className="mt-1 px-4 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <RotateCcw className={cn('w-3.5 h-3.5', isResetting && 'animate-spin')} />
              <span>{isResetting ? 'Resetting...' : 'Reset Relay & Clear Trip'}</span>
            </button>
          )}
        </div>
      )}

      {/* Primary Contributor Box */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 my-2">
        <div className="flex items-center gap-2 mb-1">
          {reason.icon}
          <span className="font-mono text-xs font-semibold text-zinc-200 truncate">
            {reason.title}
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed font-sans pl-6">
          {reason.detail}
        </p>
      </div>

      {/* Predictive Alerts Summary */}
      <div className="mt-2 pt-2 border-t border-zinc-800">
        <PredictiveAlerts state={state} isStale={isStale} />
      </div>
    </div>
  );
};
