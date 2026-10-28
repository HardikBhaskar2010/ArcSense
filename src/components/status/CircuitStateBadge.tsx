import React from 'react';
import { CircuitState } from '../../types/arcsense';
import { Power, ShieldAlert, HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CircuitStateBadgeProps {
  state: CircuitState;
  isSimulator?: boolean;
}

export const CircuitStateBadge: React.FC<CircuitStateBadgeProps> = ({ state, isSimulator }) => {
  if (state === 'TRIPPED') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-md font-mono text-xs font-bold uppercase tracking-wider',
          'bg-red-950/80 border border-red-500/80 text-red-200 shadow-glow-danger animate-pulse'
        )}
      >
        <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
        <span>
          {isSimulator ? 'VIRTUAL RELAY TRIPPED' : 'RELAY TRIPPED (CIRCUIT OPEN)'}
        </span>
      </div>
    );
  }

  if (state === 'LIVE') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-md font-mono text-xs font-semibold uppercase tracking-wider',
          'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300'
        )}
      >
        <Power className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>{isSimulator ? 'VIRTUAL CIRCUIT LIVE' : 'CIRCUIT LIVE (ENERGIZED)'}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-md font-mono text-xs font-medium uppercase tracking-wider',
        'bg-slate-900 border border-slate-700 text-slate-400'
      )}
    >
      <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span>CIRCUIT UNKNOWN</span>
    </div>
  );
};
