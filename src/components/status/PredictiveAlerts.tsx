import React, { useState } from 'react';
import { ArcSenseState } from '../../types/arcsense';
import {
  ShieldAlert,
  AlertTriangle,
  Flame,
  Thermometer,
  Zap,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  WifiOff,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface PredictiveAlertsProps {
  state: ArcSenseState | null;
  isStale?: boolean;
}

export interface AlertItem {
  id: string;
  severity: 'critical' | 'warning' | 'watch' | 'info';
  title: string;
  summary: string;
  detail: string;
  icon: React.ReactNode;
}

export const PredictiveAlerts: React.FC<PredictiveAlertsProps> = ({ state, isStale = false }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!state) return null;

  const { sensorFault, arcCount, tObj, slope, irms, ttlMin, tripped } = state;

  const alerts: AlertItem[] = [];

  // 1. Hardware Trip Event
  if (tripped) {
    alerts.push({
      id: 'tripped',
      severity: 'critical',
      title: 'Circuit Tripped (Power Isolated)',
      summary: 'Fail-safe relay coil de-energized to prevent electrical ignition.',
      detail:
        'The protective trip was engaged either by predictive multi-sensor fusion or hardware safety limit. Reset requires manual user clearance.',
      icon: <ShieldAlert className="w-4 h-4 text-red-400" />,
    });
  }

  // 2. Sensor Fail-Safe Alert
  if (sensorFault) {
    alerts.push({
      id: 'sensor-fault',
      severity: 'critical',
      title: 'IR Sensor Communication Failure',
      summary: 'MLX90614 I2C bus unreadable for >5 consecutive seconds.',
      detail:
        'Fail-safe architectural protocol: If the thermal sensor cannot confirm safety, the circuit is treated as hazardous and isolated.',
      icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
    });
  }

  // 3. Arcing Contact Signature
  if (arcCount >= 8) {
    alerts.push({
      id: 'arc-critical',
      severity: 'critical',
      title: `Critical Arcing Signature (${arcCount} cycles/s)`,
      summary: 'Significant cycle-to-cycle current distortion detected.',
      detail:
        'Cycle differencing algorithm flagged consecutive current shoulder dropouts indicative of loose mechanical sparking terminals.',
      icon: <Flame className="w-4 h-4 text-red-400" />,
    });
  } else if (arcCount > 0) {
    alerts.push({
      id: 'arc-watch',
      severity: 'watch',
      title: `Micro-Arc Activity (${arcCount} cycle/s)`,
      summary: 'Sporadic waveform jitter detected on A0 current line.',
      detail:
        'Transient distortion observed. The system is monitoring for sustained recurrence before escalation.',
      icon: <Flame className="w-4 h-4 text-amber-400" />,
    });
  }

  // 4. Overheating Alert
  if (tObj >= 75) {
    alerts.push({
      id: 'temp-critical',
      severity: 'critical',
      title: `PVC Thermal Limit Exceeded (${tObj.toFixed(1)}°C)`,
      summary: 'Terminal surface temperature exceeds maximum safe rating (75°C).',
      detail:
        'Continuous operation above 75°C causes progressive PVC insulation breakdown, pyrolytic carbonization, and flashover fire.',
      icon: <Thermometer className="w-4 h-4 text-red-400" />,
    });
  } else if (tObj >= 50) {
    alerts.push({
      id: 'temp-warning',
      severity: 'warning',
      title: `Elevated Joint Temperature (${tObj.toFixed(1)}°C)`,
      summary: 'Terminal heating is significantly above expected thermal equilibrium.',
      detail:
        'Joule heating (I²R) at contact point indicates high contact resistance from loose screw lugs or oxidation.',
      icon: <Thermometer className="w-4 h-4 text-orange-400" />,
    });
  }

  // 5. Rate-of-Rise (dT/dt)
  if (slope >= 4.0) {
    alerts.push({
      id: 'slope-warning',
      severity: 'warning',
      title: `Rapid Thermal Rate-of-Rise (+${slope.toFixed(1)}°C/min)`,
      summary: 'Heating trajectory triggers predictive threshold before limit reached.',
      detail:
        'The early-warning algorithm tracks temperature velocity. A steep heating slope indicates runaway resistive heating.',
      icon: <AlertTriangle className="w-4 h-4 text-orange-400" />,
    });
  }

  // 6. Overload Current
  if (irms > 3.0) {
    alerts.push({
      id: 'overload',
      severity: 'warning',
      title: `Circuit Overload Current (${irms.toFixed(2)} A)`,
      summary: 'Continuous RMS current exceeds rated circuit rating (3.0 A).',
      detail:
        'Sustained overcurrent accelerates thermal degradation and cable aging. Secondary load should be de-energized.',
      icon: <Zap className="w-4 h-4 text-amber-400" />,
    });
  }

  // 7. Time to Alarm Countdown
  if (ttlMin > 0 && ttlMin <= 5 && !tripped) {
    alerts.push({
      id: 'ttl-countdown',
      severity: 'warning',
      title: `Estimated Alarm in ${Math.round(ttlMin * 60)}s`,
      summary: `At current +${slope.toFixed(1)}°C/min slope, 75°C limit will be reached shortly.`,
      detail:
        'Predictive projection based on least-squares linear extrapolation of the last 30 temperature samples.',
      icon: <Clock className="w-4 h-4 text-amber-400" />,
    });
  }

  // 8. Communication Stale
  if (isStale) {
    alerts.push({
      id: 'stale-warning',
      severity: 'watch',
      title: 'Stale Telemetry Feed',
      summary: 'Data packet refresh delayed; holding last recorded values.',
      detail: 'Network latency or packet loss detected between browser and ESP8266 node.',
      icon: <WifiOff className="w-4 h-4 text-amber-400" />,
    });
  }

  // If no active warnings: Nominal message
  if (alerts.length === 0) {
    return (
      <div className="bg-scada-surface border border-scada-border rounded-lg p-3 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2 text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-semibold">All Parameters Nominal — No Active Hazards</span>
        </div>
        <span className="text-[10px] text-zinc-500 font-sans hidden sm:inline">
          Continuous 5 kHz cycle monitoring
        </span>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-mono text-zinc-400 px-0.5">
        <span className="font-bold text-zinc-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
          Active Predictive Alerts ({alerts.length})
        </span>
        <span className="text-[10px] text-zinc-500">Auto-prioritized by risk severity</span>
      </div>

      <div className="space-y-1.5">
        {alerts.map((alert) => {
          const isExpanded = expandedId === alert.id;
          const severityColors = {
            critical: 'bg-red-950/40 border-red-500/50 text-red-300',
            warning: 'bg-orange-950/30 border-orange-500/40 text-orange-300',
            watch: 'bg-amber-950/30 border-amber-500/40 text-amber-300',
            info: 'bg-scada-surface border-scada-border text-zinc-300',
          }[alert.severity];

          return (
            <div
              key={alert.id}
              className={cn(
                'rounded-lg border transition-all duration-200 overflow-hidden text-xs',
                severityColors
              )}
            >
              <button
                type="button"
                onClick={() => toggleExpand(alert.id)}
                className="w-full p-2.5 flex items-start justify-between gap-2 text-left"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <span className="shrink-0 mt-0.5">{alert.icon}</span>
                  <div className="min-w-0">
                    <span className="font-mono font-bold tracking-tight block truncate">
                      {alert.title}
                    </span>
                    <span className="text-[11px] text-zinc-300/90 font-sans block truncate mt-0.5">
                      {alert.summary}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400 shrink-0 mt-0.5">
                  <span className="hidden sm:inline">{isExpanded ? 'Hide' : 'Details'}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-3 pb-2.5 pt-1 border-t border-white/5 font-sans text-[11px] text-zinc-300 leading-relaxed bg-black/30">
                  <p>{alert.detail}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

