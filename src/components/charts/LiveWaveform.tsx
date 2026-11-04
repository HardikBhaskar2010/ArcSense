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
import { Activity, Eye, EyeOff, Pause, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LiveWaveformProps {
  waveform: number[]; // 96 samples in Amperes
  irms: number;
  isPaused?: boolean;
  showReferenceSine?: boolean;
  onToggleReferenceSine?: () => void;
  heightClass?: string;
  isCompact?: boolean;
}

export const LiveWaveform: React.FC<LiveWaveformProps> = ({
  waveform,
  irms,
  isPaused = false,
  showReferenceSine = true,
  onToggleReferenceSine,
  heightClass = 'h-[220px] sm:h-[260px] lg:h-[290px]',
  isCompact = false,
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

  const peakCurrent = useMemo(() => {
    if (!waveform || waveform.length === 0) return 0;
    return Math.max(...waveform.map(Math.abs));
  }, [waveform]);

  const isLowCurrent = irms < 0.08;

  return (
    <div className="bg-industrial-900 border border-zinc-800 rounded-xl p-3 sm:p-4 flex flex-col justify-between shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-mono text-xs font-bold text-white tracking-wider uppercase flex items-center gap-2">
              <span>Live Current Oscilloscope</span>
              <span className="text-[10px] text-zinc-400 font-normal hidden sm:inline">(20ms mains cycle)</span>
            </h3>
          </div>
          {isPaused && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[10px] font-mono font-bold text-amber-300">
              <Pause className="w-2.5 h-2.5" /> FREEZE
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono text-zinc-300">
          {onToggleReferenceSine && (
            <button
              type="button"
              aria-label={showReferenceSine ? 'Hide reference sine' : 'Show reference sine'}
              onClick={onToggleReferenceSine}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border transition-colors',
                showReferenceSine
                  ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-white'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-500'
              )}
            >
              {showReferenceSine ? <Eye className="w-3 h-3 text-white" /> : <EyeOff className="w-3 h-3 text-zinc-500" />}
              <span>Ref Sine</span>
            </button>
          )}

          <div className="hidden xs:flex items-center gap-1 text-[11px] text-zinc-400">
            <span>Peak:</span>
            <strong className="text-white font-mono">±{peakCurrent.toFixed(2)} A</strong>
          </div>
        </div>
      </div>

      {/* Oscilloscope Canvas */}
      <div className={cn('relative w-full transition-all', heightClass)}>
        {isLowCurrent && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 backdrop-blur-[2px] rounded">
            <div className="px-3 py-1.5 bg-amber-950/70 border border-amber-500/50 rounded-lg flex items-center gap-2 text-amber-300 font-mono text-xs font-bold tracking-wider uppercase">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>CIRCUIT DE-ENERGIZED / ZERO CURRENT</span>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono mt-1">
              Waiting for current flow across CT sensor (A0)
            </span>
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.7} />
            <XAxis
              dataKey="timeMs"
              stroke="#71717a"
              fontSize={10}
              tickFormatter={(v) => `${v}ms`}
              tickCount={6}
              fontFamily="JetBrains Mono, monospace"
            />
            <YAxis
              domain={[-maxAbs, maxAbs]}
              stroke="#71717a"
              fontSize={10}
              tickFormatter={(v) => `${v}A`}
              width={42}
              fontFamily="JetBrains Mono, monospace"
            />
            <ReferenceLine y={0} stroke="#3f3f46" strokeWidth={1.5} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#121214',
                borderColor: '#27272a',
                borderRadius: '8px',
                fontSize: '11px',
                fontFamily: 'JetBrains Mono, monospace',
                color: '#ffffff',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}
              formatter={(val: any, name: any) => [
                `${Number(val).toFixed(3)} A`,
                name === 'currentA' ? 'Measured Current' : 'Theoretical Sine',
              ]}
              labelFormatter={(label) => {
                const phaseDeg = Math.round((Number(label) / 20.0) * 360);
                return `${label} ms (Phase: ${phaseDeg}°)`;
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: '4px', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }}
              formatter={(value) => (
                <span className="text-zinc-300 text-[10px]">
                  {value === 'currentA' ? (
                    <span className="text-white font-bold">● Measured Current (Solid White)</span>
                  ) : (
                    <span className="text-zinc-400">┄ Ideal Sine Reference (Dashed)</span>
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

      {/* Chart Technical Footer */}
      {!isCompact && (
        <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center justify-between text-[10px] font-mono text-zinc-400">
          <span>50 Hz Period: 20.0 ms · 96 Samples @ 5 kHz ADC</span>
          <span className="hidden sm:inline">CT ACS712-05B Analog Output</span>
        </div>
      )}
    </div>
  );
};
