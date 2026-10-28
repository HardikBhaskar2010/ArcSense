import React from 'react';
import { FaultMode } from '../../types/arcsense';
import { ShieldCheck, Flame, Zap, Thermometer, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';
import { cn, getFaultModeDescription } from '../../lib/utils';

interface FaultSimulatorPanelProps {
  activeMode: FaultMode;
  isSimulator: boolean;
  isInjecting: boolean;
  isResetting: boolean;
  tripped: boolean;
  onInject: (mode: FaultMode) => void;
  onReset: () => void;
}

export const FaultSimulatorPanel: React.FC<FaultSimulatorPanelProps> = ({
  activeMode,
  isSimulator,
  isInjecting,
  isResetting,
  tripped,
  onInject,
  onReset,
}) => {
  const modes: {
    id: FaultMode;
    title: string;
    label: string;
    desc: string;
    icon: React.ReactNode;
    colorClass: string;
    activeBorder: string;
  }[] = [
    {
      id: 0,
      title: 'Normal Load',
      label: 'Nominal 1.7A (1x Bulb)',
      desc: 'Synchronous 50Hz cycle repeats; joint stays near ambient.',
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
      colorClass: 'hover:border-emerald-500/50 hover:bg-emerald-950/20',
      activeBorder: 'border-emerald-500 bg-emerald-950/40 shadow-glow-normal text-emerald-200',
    },
    {
      id: 3,
      title: 'Loose Joint (Heating)',
      label: '2.2Ω Series Resistor',
      desc: 'Forces current through contact resistance; tests dT/dt and time-to-alarm.',
      icon: <Thermometer className="w-4 h-4 text-orange-400" />,
      colorClass: 'hover:border-orange-500/50 hover:bg-orange-950/20',
      activeBorder: 'border-orange-500 bg-orange-950/40 shadow-glow-warning text-orange-200',
    },
    {
      id: 1,
      title: 'Arcing Contact (Chopper)',
      label: 'MOSFET Random Dropouts',
      desc: 'Random micro-chopping mimics series arc; triggers cycle diff without heat.',
      icon: <Flame className="w-4 h-4 text-purple-400" />,
      colorClass: 'hover:border-purple-500/50 hover:bg-purple-950/20',
      activeBorder: 'border-purple-500 bg-purple-950/40 shadow-glow-danger text-purple-200',
    },
    {
      id: 2,
      title: 'Overload Load',
      label: '3.9A Dual Bulbs',
      desc: 'Engages second load bulb, pushing loop above the 3.0A circuit rating.',
      icon: <Zap className="w-4 h-4 text-white" />,
      colorClass: 'hover:border-zinc-500 hover:bg-zinc-800/40',
      activeBorder: 'border-white bg-zinc-800 shadow-glow-white text-white',
    },
  ];

  return (
    <div className="bg-industrial-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-xs font-bold text-white tracking-wider uppercase">
              Fault Injection & Simulator Panel
            </h3>
            <span
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide uppercase border',
                isSimulator
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              )}
            >
              {isSimulator ? 'Virtual Simulation Mode' : 'Live ESP32 Relay / Chopper Control'}
            </span>
          </div>

          {(isInjecting || isResetting) && (
            <div className="flex items-center gap-1.5 text-xs font-mono text-white animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Transmitting command to device...</span>
            </div>
          )}
        </div>

        {/* Buttons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {modes.map((m) => {
            const isActive = activeMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={isActive}
                aria-label={`Inject fault mode ${m.id}: ${m.title}`}
                disabled={isInjecting || isResetting}
                onClick={() => onInject(m.id)}
                className={cn(
                  'group relative text-left p-3 rounded-lg border transition-all duration-200 flex flex-col justify-between min-h-[96px]',
                  'bg-zinc-950',
                  isActive ? m.activeBorder : cn('border-zinc-800 text-zinc-300', m.colorClass),
                  isInjecting || isResetting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs font-bold">{m.title}</span>
                    {m.icon}
                  </div>
                  <div className="font-mono text-[11px] text-zinc-300 font-medium mb-1">
                    {m.label}
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-normal font-sans">
                    {m.desc}
                  </p>
                </div>

                <div className="mt-2.5 pt-1.5 border-t border-zinc-900 flex items-center justify-between text-[10px] font-mono">
                  <span className={isActive ? 'font-bold text-white' : 'text-zinc-400'}>
                    Mode {m.id}
                  </span>
                  {isActive && (
                    <span className="flex items-center gap-1 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      ACTIVE
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Action Controls: Reset */}
        <div className="mt-4 pt-3 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={tripped ? 'Reset tripped circuit' : 'Reset device and relays'}
              disabled={isInjecting || isResetting}
              onClick={onReset}
              className={cn(
                'flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg font-mono text-xs font-bold tracking-wider uppercase transition-all duration-200',
                tripped
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-glow-danger animate-pulse'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600',
                isResetting && 'opacity-60 cursor-not-allowed'
              )}
            >
              <RotateCcw className={cn('w-4 h-4', isResetting && 'animate-spin')} />
              <span>{tripped ? 'RESET TRIPPED CIRCUIT (/api/reset)' : 'Reset Device / Relays'}</span>
            </button>

            {tripped && (
              <span className="text-xs font-mono text-red-400 animate-pulse">
                Safety trip latched until explicitly reset
              </span>
            )}
          </div>

          <div className="font-mono text-[10px] text-zinc-400">
            Current mode: {getFaultModeDescription(activeMode)}
          </div>
        </div>
      </div>

      {/* Hardware Safety Warning */}
      <div className="mt-3 bg-amber-950/20 border border-amber-500/30 rounded p-2 flex items-start gap-2 text-[10px] text-amber-200/90 font-mono">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <p className="leading-tight">
          <strong>SAFETY NOTICE:</strong> Fault simulator controls operate on the project's transformer-isolated, fused 12 V AC SELV demonstration circuit. Never create real mains arcs or bypass hardware circuit fuses.
        </p>
      </div>
    </div>
  );
};
