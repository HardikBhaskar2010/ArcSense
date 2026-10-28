import React from 'react';
import { RiskLevel } from '../../types/arcsense';
import { getRiskLevelColor, getRiskLevelName } from '../../lib/utils';

interface RiskGaugeProps {
  risk: number;
  level: RiskLevel;
  size?: number;
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({ risk, level, size = 200 }) => {
  const clampedRisk = Math.max(0, Math.min(100, risk));
  const colors = getRiskLevelColor(level);
  const levelName = getRiskLevelName(level);

  // SVG Gauge Geometry (Semi-circle arc)
  const strokeWidth = 14;
  const radius = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const cy = size / 2 + 10;

  // Arc calculations: 180 degrees from Math.PI (left) to 2*Math.PI (right)
  const arcLength = Math.PI * radius;
  const strokeDashoffset = arcLength * (1 - clampedRisk / 100);

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      <svg
        width={size}
        height={size * 0.65}
        viewBox={`0 0 ${size} ${size * 0.65}`}
        className="overflow-visible"
        aria-label={`Fire Risk Gauge: ${Math.round(clampedRisk)} out of 100, ${levelName}`}
      >
        <defs>
          <linearGradient id="gaugeBackground" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#18181b" />
            <stop offset="100%" stopColor="#27272a" />
          </linearGradient>
          <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Background track (semi-circle) */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="url(#gaugeBackground)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Active progress arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={colors.hex}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={strokeDashoffset}
          filter="url(#gaugeGlow)"
          className="transition-all duration-500 ease-out"
        />

        {/* Tick marks at 0, 25, 50, 75, 100 */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const angle = Math.PI + (tick / 100) * Math.PI;
          const innerR = radius - strokeWidth / 2 - 4;
          const outerR = radius + strokeWidth / 2 + 4;
          const x1 = cx + innerR * Math.cos(angle);
          const y1 = cy + innerR * Math.sin(angle);
          const x2 = cx + outerR * Math.cos(angle);
          const y2 = cy + outerR * Math.sin(angle);
          return (
            <line
              key={tick}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#3f3f46"
              strokeWidth={tick === 0 || tick === 50 || tick === 100 ? 1.5 : 1}
              opacity={0.8}
            />
          );
        })}
      </svg>

      {/* Numerical display in the center */}
      <div className="flex flex-col items-center mt-[-35px]">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
            {Math.round(clampedRisk)}
          </span>
          <span className="font-mono text-xs text-zinc-400 font-semibold uppercase tracking-wider">
            /100
          </span>
        </div>
        <span className="font-mono text-[10px] tracking-widest text-zinc-400 font-bold uppercase mt-0.5">
          FIRE RISK INDEX
        </span>
      </div>
    </div>
  );
};
