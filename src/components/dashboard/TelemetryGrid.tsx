import React from 'react';
import { ArcSenseState } from '../../types/arcsense';
import { TelemetryCard } from './TelemetryCard';
import {
  Zap,
  Flame,
  Activity,
  AudioWaveform,
  Maximize2,
  Thermometer,
  CloudSun,
  TrendingUp,
  Clock,
  Gauge,
} from 'lucide-react';
import { formatTimeToAlarm } from '../../lib/utils';

interface TelemetryGridProps {
  state: ArcSenseState | null;
}

export const TelemetryGrid: React.FC<TelemetryGridProps> = ({ state }) => {
  if (!state) {
    return null;
  }

  const {
    irms,
    arcCount,
    diffIdx,
    crest,
    flatFrac,
    tObj,
    tAmb,
    dT,
    slope,
    ttlMin,
    sensorFault,
  } = state;

  // Status mapping logic
  const currentStatus = irms > 3.0 ? 'warning' : 'normal';
  const arcStatus = arcCount >= 10 ? 'danger' : arcCount >= 4 ? 'warning' : arcCount > 0 ? 'watch' : 'normal';
  const diffStatus = diffIdx >= 0.15 ? 'warning' : 'normal';
  const tempStatus = sensorFault ? 'danger' : tObj >= 75 ? 'danger' : tObj >= 50 ? 'warning' : tObj >= 38 ? 'watch' : 'normal';
  const slopeStatus = slope >= 6.0 ? 'danger' : slope >= 2.0 ? 'warning' : slope > 0.5 ? 'watch' : 'normal';
  const ttlStatus = ttlMin === 0 ? 'danger' : ttlMin > 0 && ttlMin <= 3 ? 'danger' : ttlMin > 0 && ttlMin <= 10 ? 'warning' : 'normal';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-xs font-bold text-zinc-200 tracking-wider uppercase flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-white" />
          <span>Real-Time Sensor Telemetry</span>
        </h3>
        <span className="font-mono text-[10px] text-zinc-400">
          5 kHz ADC · MLX90614 IR · ACS712
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
        {/* 1. RMS Current */}
        <TelemetryCard
          label="RMS Current"
          value={irms.toFixed(2)}
          unit="A"
          subValue={irms < 0.2 ? 'Circuit idle' : irms > 3.0 ? 'Overload' : 'Nominal load'}
          status={currentStatus}
          icon={<Zap className="w-4 h-4" />}
          tooltip="RMS current sampled across one full 50Hz mains cycle"
        />

        {/* 2. Arc Cycles */}
        <TelemetryCard
          label="Arc-Like Cycles"
          value={arcCount}
          unit="/s"
          subValue={arcCount >= 10 ? 'CRITICAL (Trip condition)' : arcCount > 0 ? 'Cycle jitter detected' : 'Synchronous'}
          status={arcStatus}
          icon={<Flame className="w-4 h-4" />}
          tooltip="Flagged arc-like cycles within the sliding 1-second (50-cycle) window"
        />

        {/* 3. Waveform Diff */}
        <TelemetryCard
          label="Waveform Diff Index"
          value={(diffIdx * 100).toFixed(1)}
          unit="%"
          subValue={diffIdx > 0.15 ? 'Above 15% threshold' : 'Clean repeatable cycles'}
          status={diffStatus}
          icon={<Activity className="w-4 h-4" />}
          tooltip="Normalized cycle-to-cycle difference: Σ|c[j] - p[j]| / Σ|c[j]|"
        />

        {/* 4. Crest Factor */}
        <TelemetryCard
          label="Crest Factor"
          value={crest.toFixed(2)}
          unit=""
          subValue={crest > 1.8 ? 'Peak spikes' : 'Sine ≈ 1.41'}
          status={crest > 1.8 ? 'watch' : 'neutral'}
          icon={<AudioWaveform className="w-4 h-4" />}
          tooltip="Peak current divided by RMS current (pure sine wave = 1.414)"
        />

        {/* 5. Flat-Zero Share */}
        <TelemetryCard
          label="Flat-Zero Share"
          value={(flatFrac * 100).toFixed(1)}
          unit="%"
          subValue={flatFrac > 0.15 ? 'Arc shoulders / deadband' : 'Standard conduction'}
          status={flatFrac > 0.15 ? 'watch' : 'neutral'}
          icon={<Maximize2 className="w-4 h-4" />}
          tooltip="Proportion of cycle samples falling within 10% of zero"
        />

        {/* 6. Object Temperature */}
        <TelemetryCard
          label="Joint Temp"
          value={sensorFault ? 'FAULT' : tObj.toFixed(1)}
          unit={sensorFault ? '' : '°C'}
          subValue={sensorFault ? 'Sensor unreachable' : tObj >= 75 ? 'PVC Limit (75°C)' : 'IR non-contact'}
          status={tempStatus}
          icon={<Thermometer className="w-4 h-4" />}
          tooltip="Non-contact surface temperature of the electrical joint (MLX90614)"
        />

        {/* 7. Ambient Temperature */}
        <TelemetryCard
          label="Ambient Temp"
          value={sensorFault ? '—' : tAmb.toFixed(1)}
          unit={sensorFault ? '' : '°C'}
          subValue="Enclosure air temp"
          status="neutral"
          icon={<CloudSun className="w-4 h-4" />}
          tooltip="Internal reference ambient temperature of the sensor package"
        />

        {/* 8. Differential Temp */}
        <TelemetryCard
          label="Delta Temp (ΔT)"
          value={sensorFault ? '—' : `${dT >= 0 ? '+' : ''}${dT.toFixed(1)}`}
          unit={sensorFault ? '' : '°C'}
          subValue={dT > 15 ? 'Joule heating active' : 'Near equilibrium'}
          status={dT >= 35 ? 'danger' : dT >= 15 ? 'warning' : 'normal'}
          icon={<Thermometer className="w-4 h-4" />}
          tooltip="Temperature rise above ambient: ΔT = T_obj - T_ambient"
        />

        {/* 9. Heating Slope */}
        <TelemetryCard
          label="Heating Slope"
          value={sensorFault ? '—' : `${slope >= 0 ? '+' : ''}${slope.toFixed(1)}`}
          unit={sensorFault ? '' : '°C/min'}
          subValue={slope > 2.0 ? 'Rapid temperature rise' : 'Stable thermal state'}
          status={slopeStatus}
          icon={<TrendingUp className="w-4 h-4" />}
          tooltip="Least-squares rate-of-rise computed over the last 30 one-second readings"
        />

        {/* 10. Time to Alarm */}
        <TelemetryCard
          label="Time to Alarm"
          value={sensorFault ? '—' : ttlMin < 0 ? 'Steady' : ttlMin === 0 ? 'ALARM' : ttlMin < 1 ? `${Math.round(ttlMin * 60)}s` : `${ttlMin.toFixed(1)}m`}
          unit=""
          subValue={formatTimeToAlarm(ttlMin)}
          status={ttlStatus}
          icon={<Clock className="w-4 h-4" />}
          tooltip="Estimated minutes remaining until joint reaches 75°C alarm threshold based on current slope"
        />
      </div>
    </div>
  );
};
