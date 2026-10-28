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
      <div className="bg-industrial-900 border border-zinc-700 w-full max-w-md rounded-xl p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-white/10 border border-white/20 text-white">
              <Keyboard className="w-4 h-4" />
            </div>
            <h3 id="shortcuts-modal-title" className="font-mono text-sm font-bold text-white uppercase">
              Operator Keyboard Shortcuts
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close shortcuts dialog"
            onClick={onClose}
            className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto pr-1">
          {shortcuts.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-800/80 text-xs font-mono"
            >
              <span className="text-zinc-300 font-sans">{s.desc}</span>
              <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-white font-mono font-bold text-[11px] shrink-0 ml-3 shadow-inner">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px] font-mono text-zinc-400">
          <div className="flex items-center gap-1">
            <Command className="w-3.5 h-3.5 text-zinc-500" />
            <span>Exhibition Control Room Quick Action</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
