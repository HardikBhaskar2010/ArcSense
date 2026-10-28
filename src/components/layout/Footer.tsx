import React from 'react';
import { ShieldCheck, AlertOctagon } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-8 border-t border-zinc-800 bg-black px-4 py-4 text-xs font-mono text-zinc-400">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-white shrink-0" />
          <span>
            <strong className="text-white">ArcSense</strong> &middot; Science & Mathematics Exhibition 2026-27 &middot; Category C2
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-amber-400/90 text-[11px]">
          <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
          <span>Demo loop: 12 V AC isolated SELV only. Fail-safe coil de-energizes upon trip.</span>
        </div>

        <div className="text-[11px] text-zinc-400">
          5 kHz Current Sampling &middot; IR Thermometry &middot; Predictive Early Warning
        </div>
      </div>
    </footer>
  );
};
