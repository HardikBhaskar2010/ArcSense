import React from 'react';
import { ShieldCheck, AlertOctagon } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-8 border-t border-scada-border bg-scada-surface px-4 py-4 text-xs font-mono text-zinc-400">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            <strong className="text-white">ArcSense</strong> &middot; Science &amp; Mathematics Exhibition 2026-27 &middot; Category C2
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-amber-400/90 text-[11px]">
          <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
          <span>Transformer-isolated 12 V AC SELV demonstration loop. Fail-safe coil de-energizes upon trip.</span>
        </div>

        <div className="text-[11px] text-zinc-400">
          5 kHz ADC Current Sampling &middot; MLX90614 Non-Contact IR &middot; Predictive Arc Protection
        </div>
      </div>
    </footer>
  );
};
