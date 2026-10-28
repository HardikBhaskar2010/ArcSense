import React from 'react';
import { ArcSenseState } from '../../types/arcsense';
import { Scale, HelpCircle } from 'lucide-react';

interface EvidencePanelProps {
  state: ArcSenseState | null;
}

interface EvidenceItem {
  id: string;
  name: string;
  score: number;
  weight: number;
  colorHex: string;
  formula: string;
  detail: string;
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({ state }) => {
  if (!state) return null;

  const { sT, sS, sA, sL } = state;

  const items: EvidenceItem[] = [
    {
      id: 'thermal',
      name: 'Thermal Rise (sT)',
      score: sT,
      weight: 0.9,
      colorHex: '#ef4444', // red
      formula: '(ΔT - 15) / (35 - 15)',
      detail: 'Joint overheating above ambient. Triggered when ΔT > 15°C.',
    },
    {
      id: 'slope',
      name: 'Heating Rate (sS)',
      score: sS,
      weight: 0.6,
      colorHex: '#f97316', // orange
      formula: 'max(slope/6, 1 - ttl/10)',
      detail: 'Predictive rate-of-rise and time-to-alarm countdown.',
    },
    {
      id: 'arc',
      name: 'Waveform Arc (sA)',
      score: sA,
      weight: 0.9,
      colorHex: '#a855f7', // purple
      formula: '(arcCount - 1) / (10 - 1)',
      detail: 'Random cycle-to-cycle distortion. ≥10/s forces hard Danger.',
    },
    {
      id: 'load',
      name: 'Overload Load (sL)',
      score: sL,
      weight: 0.5,
      colorHex: '#f59e0b', // amber
      formula: '(I / I_rated - 0.9) / 0.3',
      detail: 'Sustained current exceeding 90% of circuit rating.',
    },
  ];

  return (
    <div className="bg-industrial-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-white" />
            <h3 className="font-mono text-xs font-bold text-zinc-200 tracking-wider uppercase">
              Noisy-OR Evidence Fusion Scores
            </h3>
          </div>
          <span className="font-mono text-[10px] text-zinc-400">
            Formula: Risk = 100 × (1 − Π(1 − wᵢ·sᵢ))
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {items.map((item) => {
            const pct = Math.round(item.score * 100);
            return (
              <div
                key={item.id}
                className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-mono font-semibold text-zinc-200 mb-1">
                    <span>{item.name}</span>
                    <span className="text-white font-bold">{item.score.toFixed(2)}</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden my-1.5 border border-zinc-800">
                    <div
                      className="h-full rounded-full transition-all duration-300 ease-out"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: item.colorHex,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mt-1">
                    <span>Weight: w = {item.weight}</span>
                    <span>{pct}% contribution</span>
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-zinc-900 text-[10px] text-zinc-400 leading-tight">
                  {item.detail}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex items-start gap-1.5 text-[10px] text-zinc-400 bg-zinc-950 p-2 rounded border border-zinc-800">
        <HelpCircle className="w-3 h-3 text-zinc-400 shrink-0 mt-0.5" />
        <p className="leading-normal">
          <strong>Physical significance:</strong> Evidence scores are normalized (0.0 to 1.0) and fused through probabilistic noisy-OR logic. Independent physical clues add up; a single overwhelming clue (such as continuous arcing or thermal runaway) is sufficient on its own to drive the risk to critical DANGER and trigger protective tripping.
        </p>
      </div>
    </div>
  );
};
