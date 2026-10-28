import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { RiskLevel } from '../types/arcsense';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrent(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '—';
  return `${val.toFixed(2)} A`;
}

export function formatTemp(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '—';
  return `${val.toFixed(1)} °C`;
}

export function formatSlope(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '—';
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(1)} °C/min`;
}

export function formatTimeToAlarm(ttlMin: number | undefined | null): string {
  if (ttlMin === undefined || ttlMin === null || isNaN(ttlMin) || ttlMin < 0) {
    return 'None (Steady)';
  }
  if (ttlMin === 0) {
    return 'ALARM TEMP REACHED';
  }
  if (ttlMin < 1) {
    const sec = Math.round(ttlMin * 60);
    return `${sec}s remaining`;
  }
  return `${ttlMin.toFixed(1)} min remaining`;
}

export function formatPercent(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '—';
  return `${(val * 100).toFixed(1)}%`;
}

export function getRiskLevelName(level: RiskLevel): string {
  switch (level) {
    case RiskLevel.NORMAL:
      return 'NORMAL';
    case RiskLevel.WATCH:
      return 'WATCH';
    case RiskLevel.WARNING:
      return 'WARNING';
    case RiskLevel.DANGER:
      return 'DANGER';
    default:
      return 'UNKNOWN';
  }
}

export function getRiskLevelColor(level: RiskLevel): {
  text: string;
  bg: string;
  border: string;
  glow: string;
  hex: string;
} {
  switch (level) {
    case RiskLevel.NORMAL:
      return {
        text: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        glow: 'shadow-glow-normal',
        hex: '#10b981',
      };
    case RiskLevel.WATCH:
      return {
        text: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        glow: 'shadow-glow-watch',
        hex: '#f59e0b',
      };
    case RiskLevel.WARNING:
      return {
        text: 'text-orange-400',
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30',
        glow: 'shadow-glow-warning',
        hex: '#f97316',
      };
    case RiskLevel.DANGER:
      return {
        text: 'text-red-400',
        bg: 'bg-red-500/15',
        border: 'border-red-500/40',
        glow: 'shadow-glow-danger',
        hex: '#ef4444',
      };
    default:
      return {
        text: 'text-slate-400',
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/20',
        glow: '',
        hex: '#94a3b8',
      };
  }
}

export function getFaultModeName(mode: number): string {
  switch (mode) {
    case 0:
      return 'Normal Load';
    case 1:
      return 'Arcing Contact (Chopper)';
    case 2:
      return 'Overload Current';
    case 3:
      return 'Loose Joint (Heating)';
    default:
      return 'Unknown Mode';
  }
}

export function getFaultModeDescription(mode: number): string {
  switch (mode) {
    case 0:
      return 'Healthy circuit: load current repeats cyclically every 20ms and joint remains at ambient equilibrium.';
    case 1:
      return 'Simulates random micro-arcing dropouts across cycles. Triggers high diffIdx and arc cycle counts without immediate heating.';
    case 2:
      return 'Engages second load bulb, pushing RMS current above rated capacity (approx 3.9A vs 3.0A rating).';
    case 3:
      return 'Inserts 2.2Ω ceramic joint resistor in series, simulating high contact resistance and accelerating thermal rate-of-rise.';
    default:
      return '';
  }
}
