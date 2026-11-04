import React, { useEffect } from 'react';
import { X, Keyboard, Command } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Space', desc: 'Pause / Resume live telemetry feed' },
    { key: 'R', desc: 'Reset tripped circuit & clear hardware relays' },
    { key: '0', desc: 'Inject Mode 0 (Nominal 1.7A bulb load)' },
    { key: '1', desc: 'Inject Mode 1 (Chopper series arcing contact)' },
    { key: '2', desc: 'Inject Mode 2 (Overload 3.9A dual bulb load)' },
    { key: '3', desc: 'Inject Mode 3 (Loose Joint 2.2Ω thermal heating)' },
    { key: 'M', desc: 'Toggle Live ESP32 Wi-Fi vs Internal Simulator' },
    { key: 'A', desc: 'Toggle audible control-room alert synthesizer' },
    { key: 'C', desc: 'Export session telemetry as timestamped CSV' },
    { key: 'S', desc: 'Open device IP configuration settings' },
    { key: '?', desc: 'Toggle this keyboard shortcut guide' },
    { key: 'Esc', desc: 'Close dialog' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-scada-card border border-scada-border w-full max-w-md rounded-xl p-4 sm:p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-scada-border">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-scada-surface border border-scada-border text-cyan-400">
              <Keyboard className="w-4 h-4" />
            </div>
            <h3 id="shortcuts-modal-title" className="font-mono text-sm font-bold text-white uppercase tracking-wider">
              Operator Keyboard Shortcuts
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close shortcuts dialog"
            onClick={onClose}
            className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-scada-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="grid grid-cols-1 gap-1.5 max-h-[60vh] overflow-y-auto pr-1">
          {shortcuts.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between p-2 rounded-lg bg-scada-surface border border-scada-border text-xs font-mono"
            >
              <span className="text-zinc-300 font-sans">{s.desc}</span>
              <kbd className="px-2 py-0.5 rounded bg-scada-card border border-scada-border text-cyan-300 font-mono font-bold text-[11px] shrink-0 ml-3 shadow-inner">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-scada-border flex items-center justify-between text-[11px] font-mono text-zinc-400">
          <div className="flex items-center gap-1">
            <Command className="w-3.5 h-3.5 text-zinc-500" />
            <span>Control Room Fast Navigation</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1 bg-scada-surface hover:bg-scada-border border border-scada-border rounded-lg text-zinc-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
