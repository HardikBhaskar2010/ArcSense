import React, { useState, useEffect } from 'react';
import { X, Wifi, Check, AlertCircle, Gauge } from 'lucide-react';
import { ConnectionMode } from '../../types/arcsense';
import { cn } from '../../lib/utils';

interface DeviceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBaseUrl: string;
  connectionMode: ConnectionMode;
  pollRateMs?: number;
  latencyMs?: number | null;
  packetsReceived?: number;
  packetsFailed?: number;
  onSaveBaseUrl: (url: string) => void;
  onToggleSimulator: (isSim: boolean) => void;
  onSelectPollRate?: (rate: number) => void;
  onClearSession: () => void;
}

export const DeviceSettingsModal: React.FC<DeviceSettingsModalProps> = ({
  isOpen,
  onClose,
  currentBaseUrl,
  connectionMode,
  pollRateMs = 500,
  latencyMs = null,
  packetsReceived = 0,
  packetsFailed = 0,
  onSaveBaseUrl,
  onToggleSimulator,
  onSelectPollRate,
  onClearSession,
}) => {
  const [ipInput, setIpInput] = useState(currentBaseUrl);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setIpInput(currentBaseUrl);
  }, [currentBaseUrl]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    let formatted = ipInput.trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = `http://${formatted}`;
    }
    onSaveBaseUrl(formatted);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const setPreset = (preset: string) => {
    setIpInput(preset);
  };

  const pollOptions = [
    { rate: 250, label: '250 ms (Fast / Oscilloscope)' },
    { rate: 500, label: '500 ms (Standard / Optimal)' },
    { rate: 1000, label: '1000 ms (Eco / Low Bandwidth)' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-industrial-900 border border-zinc-700 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-white" />
            <h3 id="settings-dialog-title" className="font-mono text-sm font-bold text-white uppercase tracking-wider">
              Device Connection & Polling Settings
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close settings dialog"
            onClick={onClose}
            className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Network Diagnostics Bar */}
        <div className="grid grid-cols-3 gap-2 p-2.5 rounded bg-zinc-950 border border-zinc-800 font-mono text-xs">
          <div>
            <span className="text-[10px] text-zinc-400 block">Ping Latency</span>
            <span className="font-bold text-white">
              {latencyMs !== null ? `${latencyMs} ms` : '—'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 block">Packets In</span>
            <span className="font-bold text-emerald-400">{packetsReceived}</span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 block">Dropped / Loss</span>
            <span className={cn('font-bold', packetsFailed > 0 ? 'text-red-400' : 'text-zinc-500')}>
              {packetsFailed}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4 font-mono text-xs">
          <div>
            <label className="block text-zinc-200 font-semibold mb-1">
              ESP32 Device Base Address / IP:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
                placeholder="http://192.168.4.1"
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-white focus:outline-none focus:border-white font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-white hover:bg-zinc-200 text-black font-bold rounded flex items-center gap-1 transition-colors"
              >
                {savedSuccess ? <Check className="w-4 h-4" /> : 'Save'}
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <span className="text-[11px] text-zinc-300 block mb-1.5 font-medium">Common IP Presets:</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPreset('http://192.168.4.1')}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
              >
                192.168.4.1 (ESP32 AP)
              </button>
              <button
                type="button"
                onClick={() => setPreset('http://localhost:5173')}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
              >
                localhost:5173 (Dev)
              </button>
            </div>
          </div>

          {/* Hardware Wi-Fi Manager Portal link */}
          <div className="pt-2 border-t border-zinc-800">
            <span className="text-[11px] text-zinc-300 block mb-1 font-medium">On-The-Go Wi-Fi Setup:</span>
            <p className="text-[10px] text-zinc-400 mb-2 leading-relaxed">
              Moving to a new Wi-Fi or mobile phone hotspot? Connect to <code className="text-sky-300 font-bold">ArcSense-ESP</code> and open the setup portal to scan & save credentials to flash without reflashing code:
            </p>
            <a
              href={`${currentBaseUrl.startsWith('http://192.168.') ? currentBaseUrl : 'http://192.168.4.1'}/wifi`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-sky-950/80 hover:bg-sky-900 border border-sky-600/40 text-sky-300 text-xs font-mono transition-colors"
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Open Hardware Wi-Fi Portal (/wifi) ↗</span>
            </a>
          </div>

          {/* Polling Frequency Selector */}
          {onSelectPollRate && (
            <div className="pt-2 border-t border-zinc-800">
              <div className="flex items-center gap-1 text-zinc-200 font-semibold mb-1.5">
                <Gauge className="w-3.5 h-3.5 text-white" />
                <span>Polling Interval:</span>
              </div>
              <div className="space-y-1.5">
                {pollOptions.map((opt) => (
                  <label
                    key={opt.rate}
                    className={cn(
                      'flex items-center justify-between p-2 rounded border cursor-pointer transition-colors',
                      pollRateMs === opt.rate
                        ? 'bg-zinc-800 border-white text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="pollRate"
                        value={opt.rate}
                        checked={pollRateMs === opt.rate}
                        onChange={() => onSelectPollRate(opt.rate)}
                        className="accent-white"
                      />
                      <span className="font-sans text-xs">{opt.label}</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400">{opt.rate}ms</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Connection Mode Toggle */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
            <div>
              <span className="block font-semibold text-zinc-200">Operational Mode:</span>
              <span className="text-[11px] text-zinc-400">
                {connectionMode === 'SIMULATOR' ? 'Currently in Simulator Mode' : 'Currently in Live Hardware Mode'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                onToggleSimulator(connectionMode !== 'SIMULATOR');
                onClose();
              }}
              className="px-3 py-1.5 rounded font-bold uppercase text-[11px] bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white transition-colors"
            >
              {connectionMode === 'SIMULATOR' ? 'Switch to Live ESP32' : 'Switch to Simulator'}
            </button>
          </div>

          {/* Network instructions */}
          <div className="bg-zinc-950 p-3 rounded border border-zinc-800 text-[11px] text-zinc-300 space-y-1 font-sans">
            <div className="font-mono font-bold text-zinc-200 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-white" />
              <span>Exhibition Wi-Fi Instructions:</span>
            </div>
            <p>1. Connect your laptop or phone to the ESP32 Wi-Fi: <strong>ArcSense-Demo</strong> (pass: <code>arcsense123</code>).</p>
            <p>2. Disable cellular/mobile data on phones so local IP traffic routes to the ESP32.</p>
            <p>3. Access the dashboard at <code>http://192.168.4.1/</code> or run React locally via <code>http://localhost:5173/?ip=192.168.4.1</code>.</p>
          </div>

          {/* Clear Session Data */}
          <div className="pt-2 flex justify-between items-center text-[11px]">
            <span className="text-zinc-400">Reset browser telemetry samples:</span>
            <button
              type="button"
              onClick={() => {
                if (confirm('Clear recorded session samples from memory?')) {
                  onClearSession();
                  onClose();
                }
              }}
              className="text-red-400 hover:text-red-300 font-semibold"
            >
              Clear Session Samples
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
