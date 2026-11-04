import React from 'react';
import { ArcSenseState } from '../../types/arcsense';
import { Scale, HelpCircle } from 'lucide-react';

interface EvidenceFusionGridProps {
  state: ArcSenseState | null;
  isCompact?: boolean;
}

interface EvidenceFactor {
  id: string;
  name: string;
  shortName: string;
  score: number;
  weight: number;
  colorHex: string;
  formula: string;
  detail: string;
}

export const EvidenceFusionGrid: React.FC<EvidenceFusionGridProps> = ({ state, isCompact = false }) => {
  if (!state) return null;

  const { sT, sS, sA, sL } = state;

  const factors: EvidenceFactor[] = [
    {
      id: 'thermal',
      name: 'Thermal Rise (sT)',
      shortName: 'Thermal (sT)',
      score: sT,
      weight: 0.9,
      colorHex: '#ef4444', // Red
      formula: '(ΔT - 15) / (35 - 15)',
      detail: 'Joint overheating above ambient. Triggered when ΔT > 15°C.',
    },
    {
      id: 'slope',
      name: 'Heating Rate (sS)',
      shortName: 'Rate (sS)',
      score: sS,
      weight: 0.6,
      colorHex: '#f97316', // Orange
      formula: 'max(slope/6, 1 - ttl/10)',
      detail: 'Predictive rate-of-rise and time-to-alarm countdown.',
    },
    {
      id: 'arc',
      name: 'Waveform Arc (sA)',
      shortName: 'Arcing (sA)',
      score: sA,
      weight: 0.9,
      colorHex: '#a855f7', // Purple (original evidence color)
      formula: '(arcCount - 1) / (10 - 1)',
      detail: 'Cycle-to-cycle current distortion. ≥10/s forces hard critical trip.',
    },
    {
      id: 'load',
      name: 'Overload Load (sL)',
      shortName: 'Load (sL)',
      score: sL,
      weight: 0.5,
      colorHex: '#f59e0b', // Amber
      formula: '(I / I_rated - 0.9) / 0.3',
      detail: 'Sustained current exceeding 90% of circuit rating.',
    },
  ];

  return (
    <div className="bg-industrial-900 border border-zinc-800 rounded-xl p-3 sm:p-4 shadow-xl flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white">
              <Scale className="w-3 h-3" />
            </div>
            <h3 className="font-mono text-xs font-bold text-white tracking-wider uppercase">
              Noisy-OR Evidence Fusion Decomposition
            </h3>
          </div>
          <span className="hidden sm:inline font-mono text-[10px] text-zinc-400">
            Risk = 100 × (1 − Π(1 − wᵢ·sᵢ))
          </span>
        </div>

        {/* 2x2 on mobile (>=360px), 1 col on <360px, 4 col on desktop */}
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
          {factors.map((factor) => {
            const pct = Math.round(factor.score * 100);
            return (
              <div
                key={factor.id}
                className="bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 sm:p-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-mono font-semibold text-zinc-200 mb-1">
                    <span className="truncate pr-1">
                      <span className="xs:hidden">{factor.name}</span>
                      <span className="hidden xs:inline">{factor.shortName}</span>
                    </span>
                    <span className="font-mono text-white font-bold tabular-nums">
                      {factor.score.toFixed(2)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden my-1.5 border border-zinc-800">
                    <div
                      className="h-full rounded-full transition-all duration-300 ease-out"
                      style={{
                        width: `${Math.max(pct, factor.score > 0 ? 4 : 0)}%`,
                        backgroundColor: factor.colorHex,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span>Weight: w = {factor.weight}</span>
                    <span className="tabular-nums">{pct}%</span>
                  </div>
                </div>

                {!isCompact && (
                  <p className="mt-2 pt-1.5 border-t border-zinc-850 text-[10px] text-zinc-400 font-sans leading-tight line-clamp-2">
                    {factor.detail}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!isCompact && (
        <div className="mt-2.5 pt-2 border-t border-zinc-800 flex items-start gap-1.5 text-[10px] text-zinc-400 font-sans">
          <HelpCircle className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
          <p className="leading-tight">
            <strong>Physical Multi-Sensor Fusion:</strong> Normalized sensor probabilities (0.0 to 1.0) combine mathematically. A single severe anomaly (such as persistent arcing or thermal runaway) is sufficient on its own to drive overall risk to critical DANGER and trigger tripping.
          </p>
        </div>
      )}
    </div>
  );
};
