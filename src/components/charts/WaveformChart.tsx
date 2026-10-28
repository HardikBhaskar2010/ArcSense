import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { WaveformPoint } from '../../types/arcsense';
import { Activity, Eye, EyeOff, Pause } from 'lucide-react';

interface WaveformChartProps {
  waveform: number[]; // 96 samples in Amperes
  irms: number;
  isPaused?: boolean;
  showReferenceSine?: boolean;
  onToggleReferenceSine?: () => void;
}

export const WaveformChart: React.FC<WaveformChartProps> = ({
  waveform,
  irms,
  isPaused = false,
  showReferenceSine = true,
  onToggleReferenceSine,
}) => {
  const SPC = 96;

  // Process data points and ideal reference sine
  const chartData = useMemo<WaveformPoint[]>(() => {
    if (!waveform || waveform.length === 0) {
      return [];
    }

    // Theoretical RMS peak: Irms * sqrt(2)
    const idealPeak = irms * Math.SQRT2;

    const data: WaveformPoint[] = new Array(SPC);
    for (let j = 0; j < SPC; j++) {
      const timeMs = (j / (SPC - 1)) * 20.0; // 50Hz mains = 20ms full period
      // 50Hz sine wave reference matching the period
      const refSine = Math.sin((2 * Math.PI * j) / 100.0) * idealPeak;

      data[j] = {
        index: j,
        timeMs: Number(timeMs.toFixed(2)),
        currentA: Number((waveform[j] ?? 0).toFixed(3)),
        referenceA: Number(refSine.toFixed(3)),
      };
    }
    return data;
  }, [waveform, irms]);

  // Compute amplitude bounds
  const maxAbs = useMemo(() => {
    if (!waveform || waveform.length === 0) return 2.0;
    const peak = Math.max(...waveform.map(Math.abs));
    return Math.max(1.5, Math.ceil(peak * 1.25 * 10) / 10);
  }, [waveform]);

  const isLowCurrent = irms < 0.08;

  return (
    <div className="bg-industrial-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-white" />
          <h3 className="font-mono text-xs font-bold text-white tracking-wider uppercase">
            Live Current Waveform (One 20ms Mains Cycle)
          </h3>
          {isPaused && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[10px] font-mono font-bold text-amber-300">
              <Pause className="w-2.5 h-2.5" /> FREEZE FRAME
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3 text-xs font-mono text-zinc-300">
          {onToggleReferenceSine && (
            <button
              type="button"
              aria-label={showReferenceSine ? 'Hide theoretical reference sine' : 'Show theoretical reference sine'}
              onClick={onToggleReferenceSine}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] text-zinc-200 transition-colors"
            >
              {showReferenceSine ? <Eye className="w-3 h-3 text-white" /> : <EyeOff className="w-3 h-3 text-zinc-500" />}
              <span>Ref Sine</span>
            </button>
          )}
          <span>96 Samples</span>
          <span className="text-white font-bold">Peak: ±{maxAbs.toFixed(1)} A</span>
        </div>
      </div>

      {/* Scope Chart Canvas */}
      <div className="relative w-full h-[220px] sm:h-[240px]">
        {isLowCurrent && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 backdrop-blur-[1px] rounded">
            <span className="font-mono text-xs font-bold text-amber-400 tracking-wider uppercase px-3 py-1 bg-amber-950/70 border border-amber-500/50 rounded">
              NO CURRENT — Circuit open or load de-energized
            </span>
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.7} />
            <XAxis
              dataKey="timeMs"
              stroke="#71717a"
              fontSize={10}
              tickFormatter={(v) => `${v}ms`}
              tickCount={6}
            />
            <YAxis
              domain={[-maxAbs, maxAbs]}
              stroke="#71717a"
              fontSize={10}
              tickFormatter={(v) => `${v}A`}
              width={45}
            />
            <ReferenceLine y={0} stroke="#3f3f46" strokeWidth={1.5} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#121214',
                borderColor: '#27272a',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#ffffff',
              }}
              formatter={(val: any, name: any) => [
                `${Number(val).toFixed(3)} A`,
                name === 'currentA' ? 'Measured Current' : 'Theoretical Reference Sine',
              ]}
              labelFormatter={(label) => {
                const phaseDeg = Math.round((Number(label) / 20.0) * 360);
                return `Time: ${label} ms (Phase: ${phaseDeg}°)`;
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: '6px', fontSize: '11px', fontFamily: 'monospace' }}
              formatter={(value) => (
                <span className="text-zinc-200">
                  {value === 'currentA' ? (
                    <span className="text-white font-bold">Measured Current (Solid White)</span>
                  ) : (
                    <span className="text-zinc-400 italic">Theoretical Reference (Dashed)</span>
                  )}
                </span>
              )}
            />
            {/* Reference Sine Wave (Theoretical) */}
            {showReferenceSine && (
              <Line
                type="monotone"
                dataKey="referenceA"
                name="referenceA"
                stroke="#52525b"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            )}
            {/* Measured Current Waveform (Crisp Solid White) */}
            <Line
              type="monotone"
              dataKey="currentA"
              name="currentA"
              stroke="#ffffff"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Footer Technical Note */}
      <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center justify-between text-[10px] font-mono text-zinc-400">
        <span>Cycle Period: 20.0 ms @ 50 Hz</span>
        <span>Solid White: live sampled current | Dashed: theoretical reference</span>
      </div>
    </div>
  );
};
