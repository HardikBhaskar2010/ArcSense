import React from 'react';
import { cn } from '../../lib/utils';

interface TelemetryCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subValue?: string;
  status?: 'normal' | 'watch' | 'warning' | 'danger' | 'neutral';
  icon?: React.ReactNode;
  tooltip?: string;
}

export const TelemetryCard: React.FC<TelemetryCardProps> = ({
  label,
  value,
  unit,
  subValue,
  status = 'neutral',
  icon,
  tooltip,
}) => {
  const getStatusBorder = () => {
    switch (status) {
      case 'danger':
        return 'border-red-500/50 hover:border-red-500/80 shadow-sm shadow-red-950';
      case 'warning':
        return 'border-orange-500/40 hover:border-orange-500/70';
      case 'watch':
        return 'border-amber-500/40 hover:border-amber-500/70';
      case 'normal':
        return 'border-emerald-500/30 hover:border-emerald-500/60';
      default:
        return 'border-zinc-800 hover:border-zinc-700';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'danger':
        return 'text-red-400';
      case 'warning':
        return 'text-orange-400';
      case 'watch':
        return 'text-amber-400';
      case 'normal':
        return 'text-emerald-400';
      default:
        return 'text-white';
    }
  };

  return (
    <div
      title={tooltip}
      className={cn(
        'group relative bg-industrial-900 border rounded-lg p-3.5 flex flex-col justify-between transition-all duration-200',
        'hover:bg-zinc-900',
        getStatusBorder()
      )}
    >
      {/* Top Header with Icon and Label */}
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="font-mono text-[10px] tracking-wider text-zinc-400 font-semibold uppercase truncate">
          {label}
        </span>
        {icon && <div className="text-zinc-500 group-hover:text-zinc-300 transition-colors shrink-0">{icon}</div>}
      </div>

      {/* Main Metric Value */}
      <div className="flex items-baseline gap-1.5 my-0.5">
        <span className={cn('font-mono text-xl sm:text-2xl font-bold tracking-tight', getStatusText())}>
          {value}
        </span>
        {unit && (
          <span className="font-mono text-xs text-zinc-400 font-medium">
            {unit}
          </span>
        )}
      </div>

      {/* Sub-label or condition descriptor */}
      {subValue && (
        <div className="font-mono text-[10px] text-zinc-500 truncate mt-0.5">
          {subValue}
        </div>
      )}
    </div>
  );
};
