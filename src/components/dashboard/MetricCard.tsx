import React from 'react';
import { cn } from '../../lib/utils';

export interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subValue?: string;
  status?: 'normal' | 'watch' | 'warning' | 'danger' | 'neutral';
  icon?: React.ReactNode;
  tooltip?: string;
  className?: string;
  trend?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  subValue,
  status = 'neutral',
  icon,
  tooltip,
  className,
  trend,
}) => {
  const getStatusBorder = () => {
    switch (status) {
      case 'danger':
        return 'border-red-500/50 hover:border-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.15)] bg-red-950/10';
      case 'warning':
        return 'border-orange-500/40 hover:border-orange-500/70 shadow-[0_0_12px_rgba(249,115,22,0.12)] bg-orange-950/10';
      case 'watch':
        return 'border-amber-500/40 hover:border-amber-500/70 bg-amber-950/10';
      case 'normal':
        return 'border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-950/10';
      default:
        return 'border-scada-border hover:border-scada-borderLight bg-scada-card';
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
        'group relative border rounded-xl p-3 sm:p-3.5 flex flex-col justify-between transition-all duration-200 select-none shadow-md',
        getStatusBorder(),
        className
      )}
    >
      {/* Top Header with Icon and Label */}
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="font-mono text-[10px] sm:text-[11px] tracking-wider text-zinc-400 font-semibold uppercase truncate">
          {label}
        </span>
        {icon && (
          <div className="text-zinc-500 group-hover:text-cyan-400 transition-colors shrink-0">
            {icon}
          </div>
        )}
      </div>

      {/* Main Metric Value */}
      <div className="flex items-baseline gap-1.5 my-0.5">
        <span className={cn('font-mono text-xl sm:text-2xl font-bold tracking-tight tabular-nums', getStatusText())}>
          {value}
        </span>
        {unit && (
          <span className="font-mono text-xs text-zinc-400 font-medium">
            {unit}
          </span>
        )}
      </div>

      {/* Sub-label or condition descriptor */}
      <div className="flex items-center justify-between gap-1 mt-0.5">
        {subValue && (
          <div className="font-mono text-[10px] text-zinc-400 truncate">
            {subValue}
          </div>
        )}
        {trend && (
          <span className="font-mono text-[10px] text-zinc-500 shrink-0 tabular-nums">
            {trend}
          </span>
        )}
      </div>
    </div>
  );
};

