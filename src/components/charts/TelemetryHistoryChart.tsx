import React from 'react';
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
import { TelemetryPoint } from '../../types/arcsense';
import { TrendingUp, Info, Pause } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TelemetryHistoryChartProps {
  data: TelemetryPoint[];
  tAmb: number;
  isPaused?: boolean;
  historyWindowSec?: number;
  onSelectWindow?: (sec: number) => void;
}

export const TelemetryHistoryChart: React.FC<TelemetryHistoryChartProps> = ({
  data,
  tAmb,
  isPaused = false,
  historyWindowSec = 90,
  onSelectWindow,
}) => {
  const warnThreshold = tAmb + 15;
  const alarmThreshold = Math.min(75, tAmb + 35);

  const windows = [30, 60, 90, 180];

  return (
    <div className="bg-industrial-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-orange-400" />
          <h3 className="font-mono text-xs font-bold text-white tracking-wider uppercase">
            Rolling Thermal & Risk History
          </h3>
          {isPaused && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[10px] font-mono font-bold text-amber-300">
              <Pause className="w-2.5 h-2.5" /> PAUSED
            </span>
          )}
        </div>

        {/* Window Selector */}
        <div className="flex items-center gap-2">
          {onSelectWindow && (
            <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded p-0.5 text-[10px] font-mono">
              {windows.map((w) => (
                <button
                  key={w}
                  type="button"
                  aria-label={`Show ${w} seconds history`}
                  onClick={() => onSelectWindow(w)}
                  className={cn(
                    'px-2 py-0.5 rounded transition-colors',
                    historyWindowSec === w
                      ? 'bg-white text-black font-bold'
                      : 'text-zinc-400 hover:text-white'
                  )}
                >
                  {w}s
                </button>
              ))}
            </div>
          )}

          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-zinc-300">
            <span>Alarm: <strong className="text-red-400">{alarmThreshold.toFixed(0)}°C</strong></span>
            <span>·</span>
            <span>Warn: <strong className="text-amber-400">{warnThreshold.toFixed(0)}°C</strong></span>
          </div>
        </div>
      </div>

      {/* Recharts Canvas */}
      <div className="w-full h-[220px] sm:h-[240px]">
        {data.length < 2 ? (
          <div className="w-full h-full flex flex-col items-center justify-center font-mono text-xs text-zinc-500">
            <span>Gathering rolling telemetry points...</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.7} />
              <XAxis dataKey="timeLabel" stroke="#71717a" fontSize={10} minTickGap={20} />
              
              {/* Left Y-Axis: Temperature (°C) */}
              <YAxis
                yAxisId="temp"
                domain={[20, Math.max(85, Math.ceil(Math.max(...data.map((d) => d.tObj)) + 5))]}
                stroke="#f97316"
                fontSize={10}
                tickFormatter={(v) => `${v}°C`}
                width={45}
              />

              {/* Right Y-Axis: Risk Score (0-100) */}
              <YAxis
                yAxisId="risk"
                orientation="right"
                domain={[0, 100]}
                stroke="#ef4444"
                fontSize={10}
                tickFormatter={(v) => `${v}%`}
                width={38}
              />

              {/* Safety Threshold Lines */}
              <ReferenceLine
                yAxisId="temp"
                y={alarmThreshold}
                stroke="#ef4444"
                strokeDasharray="3 3"
                label={{ value: 'Alarm (75°C)', fill: '#ef4444', fontSize: 10, position: 'insideTopLeft' }}
              />
              <ReferenceLine
                yAxisId="temp"
                y={warnThreshold}
                stroke="#f59e0b"
                strokeDasharray="3 3"
                label={{ value: 'Warn', fill: '#f59e0b', fontSize: 10, position: 'insideBottomLeft' }}
              />

              <Tooltip
                contentStyle={{
                  backgroundColor: '#121214',
                  borderColor: '#27272a',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: '#ffffff',
                }}
                formatter={(val: any, name: any) => {
                  if (name === 'tObj') return [`${Number(val).toFixed(1)} °C`, 'Joint Temp'];
                  if (name === 'tAmb') return [`${Number(val).toFixed(1)} °C`, 'Ambient Temp'];
                  if (name === 'risk') return [`${Number(val).toFixed(1)} / 100`, 'Fire Risk'];
                  if (name === 'predictedTemp') return [`${Number(val).toFixed(1)} °C`, 'Projected Trend'];
                  return [val, name];
                }}
                labelFormatter={(label) => `Time: ${label}`}
              />

              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '6px', fontSize: '10px', fontFamily: 'monospace' }}
                formatter={(value) => {
                  if (value === 'tObj') return <span className="text-orange-400">Joint Temp (°C)</span>;
                  if (value === 'tAmb') return <span className="text-zinc-400">Ambient (°C)</span>;
                  if (value === 'risk') return <span className="text-red-400">Risk Score (%)</span>;
                  if (value === 'predictedTemp') return <span className="text-amber-300 italic">Trend Forecast</span>;
                  return value;
                }}
              />

              {/* Joint Object Temperature */}
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="tObj"
                name="tObj"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />

              {/* Ambient Reference Temperature */}
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="tAmb"
                name="tAmb"
                stroke="#71717a"
                strokeWidth={1}
                dot={false}
                isAnimationActive={false}
              />

              {/* Risk Score */}
              <Line
                yAxisId="risk"
                type="monotone"
                dataKey="risk"
                name="risk"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />

              {/* Trend Prediction (if available) */}
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="predictedTemp"
                name="predictedTemp"
                stroke="#fcd34d"
                strokeDasharray="2 2"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center justify-between text-[10px] font-mono text-zinc-400">
        <span className="flex items-center gap-1">
          <Info className="w-3 h-3 text-zinc-500" />
          Rolling browser session buffer (retains up to {historyWindowSec}s)
        </span>
        <span>Dual axes: °C (left) / Risk % (right)</span>
      </div>
    </div>
  );
};
