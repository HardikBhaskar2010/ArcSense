import React, { useState } from 'react';
import {
  Wifi,
  Radio,
  Power,
  RotateCcw,
  Signal,
  ShieldAlert,
  Send,
  AlertTriangle,
} from 'lucide-react';
import { ConnectionMode, ArcSenseState } from '../../types/arcsense';
import { apiClient } from '../../lib/arcsense-api';
import { cn } from '../../lib/utils';

interface HardwareDiagnosticsProps {
  connectionMode: ConnectionMode;
  baseUrl: string;
  state: ArcSenseState | null;
  latencyMs: number | null;
  onOpenSettings: () => void;
  onRefreshTelemetry: () => void;
}

export const HardwareDiagnostics: React.FC<HardwareDiagnosticsProps> = ({
  connectionMode,
  baseUrl,
  state,
  latencyMs,
  onOpenSettings,
  onRefreshTelemetry,
}) => {
  const [isPinging, setIsPinging] = useState(false);
  const [lastPingResult, setLastPingResult] = useState<string | null>(null);
  const [isScanningWifi, setIsScanningWifi] = useState(false);
  const [scannedNetworks, setScannedNetworks] = useState<Array<{ ssid: string; rssi: number }> | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Wi-Fi form state
  const [showWifiForm, setShowWifiForm] = useState(false);
  const [targetSsid, setTargetSsid] = useState('');
  const [targetPass, setTargetPass] = useState('');

  // Safety Confirmation Modal state for manual operations
  const [safetyDialog, setSafetyDialog] = useState<{
    isOpen: boolean;
    type: 'trip' | 'reboot' | null;
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: null,
    title: '',
    message: '',
  });

  const isLive = connectionMode === 'LIVE';

  // 1. Direct Ping test
  const handlePing = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      const res = await apiClient.ping();
      const roundTrip = Math.round(performance.now() - start);
      setLastPingResult(`Ping OK (${roundTrip} ms) • ESP Free Heap: ${res.freeHeap ?? 'OK'} B`);
      setStatusMessage('Hardware responded to ping healthcheck.');
    } catch (err: any) {
      setLastPingResult(`Ping Failed: ${err.message || 'Timeout'}`);
      setStatusMessage('Device did not respond to ping.');
    } finally {
      setIsPinging(false);
    }
  };

  // 2. Scan local airwaves
  const handleScanWifi = async () => {
    setIsScanningWifi(true);
    setStatusMessage('Scanning 2.4 GHz airwaves via ESP8266 radio...');
    try {
      const list = await apiClient.scanWifi();
      setScannedNetworks(list);
      setStatusMessage(`Found ${list.length} Wi-Fi networks in range.`);
    } catch (err: any) {
      setStatusMessage(`Scan failed: ${err.message || 'Make sure device is reachable'}`);
    } finally {
      setIsScanningWifi(false);
    }
  };

  // 3. Save new Wi-Fi credentials to ESP flash
  const handleSaveWifi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSsid.trim()) return;
    setIsActionPending(true);
    setStatusMessage(`Saving "${targetSsid}" to ESP flash & reconnecting...`);
    try {
      await apiClient.saveWifi(targetSsid.trim(), targetPass.trim());
      setStatusMessage(`Credentials saved to ESP flash! Check 1602 LCD for new IP.`);
      setShowWifiForm(false);
      setTargetPass('');
    } catch (err: any) {
      setStatusMessage(`Failed to save Wi-Fi: ${err.message}`);
    } finally {
      setIsActionPending(false);
    }
  };

  // 4. Physical Relay toggle execution
  const executeRelayAction = async (action: 'trip' | 'restore') => {
    setIsActionPending(true);
    setStatusMessage(`Sending relay ${action.toUpperCase()} command...`);
    try {
      await apiClient.setRelay(action);
      setStatusMessage(`Relay ${action === 'trip' ? 'OPENED (Circuit Tripped)' : 'CLOSED (Circuit Live)'}!`);
      onRefreshTelemetry();
    } catch (err: any) {
      setStatusMessage(`Relay control failed: ${err.message}`);
    } finally {
      setIsActionPending(false);
    }
  };

  // Prompt confirmation for dangerous manual operations
  const confirmRelayTrip = () => {
    setSafetyDialog({
      isOpen: true,
      type: 'trip',
      title: 'CONFIRM MANUAL RELAY TRIP TEST',
      message:
        'SAFETY CONFIRMATION: You are requesting a manual trip test on the D5 fail-safe relay. This will immediately cut power to the demonstration circuit. Proceed?',
    });
  };

  const confirmReboot = () => {
    setSafetyDialog({
      isOpen: true,
      type: 'reboot',
      title: 'CONFIRM REMOTE HARDWARE REBOOT',
      message:
        'Are you sure you want to trigger a remote software restart on the ESP8266 microcontroller? The telemetry stream will briefly disconnect during restart.',
    });
  };

  const handleConfirmSafetyAction = async () => {
    const { type } = safetyDialog;
    setSafetyDialog({ isOpen: false, type: null, title: '', message: '' });

    if (type === 'trip') {
      await executeRelayAction('trip');
    } else if (type === 'reboot') {
      setIsActionPending(true);
      setStatusMessage('Sending reboot command to ESP8266...');
      try {
        await apiClient.restart();
        setStatusMessage('ESP8266 reboot initiated. Watch 1602 LCD as it restarts.');
      } catch (err: any) {
        setStatusMessage(`Reboot failed: ${err.message}`);
      } finally {
        setIsActionPending(false);
      }
    }
  };

  // Helper for RSSI quality
  const getSignalQuality = (rssi?: number) => {
    if (rssi === undefined || rssi === 0) return { label: 'Direct AP / Unknown', color: 'text-zinc-400' };
    if (rssi >= -60) return { label: `${rssi} dBm (Excellent)`, color: 'text-emerald-400' };
    if (rssi >= -75) return { label: `${rssi} dBm (Good)`, color: 'text-cyan-400' };
    if (rssi >= -85) return { label: `${rssi} dBm (Fair)`, color: 'text-amber-400' };
    return { label: `${rssi} dBm (Weak)`, color: 'text-red-400' };
  };

  const sig = getSignalQuality(state?.wifiRssi);

  return (
    <div className="bg-scada-card border border-scada-border rounded-xl p-4 sm:p-5 shadow-xl font-mono text-xs space-y-4">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-scada-border gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-scada-surface border border-scada-border flex items-center justify-center text-cyan-400">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
              Hardware Bridge & Remote Diagnostics
            </h3>
            <p className="text-[11px] text-zinc-400 font-sans">
              Direct telemetry interrogation, Wi-Fi link status, and hardware relay override
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={onOpenSettings}
            className="px-2.5 py-1 rounded bg-scada-surface hover:bg-scada-card border border-scada-border text-zinc-300 hover:text-white text-[11px] transition-colors"
          >
            Change Target IP
          </button>
        </div>
      </div>

      {/* Hardware Telemetry Strip (6 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
        <div className="bg-scada-surface border border-scada-border rounded-lg p-2.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Device Name</span>
          <span className="font-bold text-cyan-300 truncate block text-[11px] mt-0.5" title={`Target: ${baseUrl}`}>
            {state?.deviceName || (isLive ? 'ArcSense-ESP8266' : 'ArcSense-Node')}
          </span>
        </div>

        <div className="bg-scada-surface border border-scada-border rounded-lg p-2.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Connected Client</span>
          <span className="font-bold text-emerald-400 truncate block text-[11px] mt-0.5">
            {isLive ? 'Laptop (This Browser)' : 'Virtual Bus'}
          </span>
        </div>

        <div className="bg-scada-surface border border-scada-border rounded-lg p-2.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Node Wi-Fi (SSID)</span>
          <span className="font-bold text-slate-100 truncate block text-[11px] mt-0.5">
            {state?.wifiSsid || (isLive ? 'ArcSense-ESP' : 'Simulated')}
          </span>
        </div>

        <div className="bg-scada-surface border border-scada-border rounded-lg p-2.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Signal (RSSI)</span>
          <span className={cn('font-bold truncate block text-[11px] mt-0.5', sig.color)}>
            {isLive ? sig.label : '—'}
          </span>
        </div>

        <div className="bg-scada-surface border border-scada-border rounded-lg p-2.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Ping Round-Trip</span>
          <span className="font-bold text-emerald-400 truncate block text-[11px] mt-0.5">
            {latencyMs !== null ? `${latencyMs} ms` : isLive ? '< 20 ms' : '—'}
          </span>
        </div>

        <div className="bg-scada-surface border border-scada-border rounded-lg p-2.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Fail-Safe Relay</span>
          <span
            className={cn(
              'font-bold truncate block text-[11px] mt-0.5',
              state?.tripped ? 'text-red-400' : 'text-emerald-400'
            )}
          >
            {state?.tripped ? 'TRIPPED (OPEN)' : 'ENERGIZED (ON)'}
          </span>
        </div>
      </div>

      {/* Action Controls Toolbar */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handlePing}
          disabled={isPinging || isActionPending}
          className="px-3 py-1.5 rounded-lg bg-scada-surface hover:bg-scada-card border border-scada-border text-zinc-200 flex items-center gap-1.5 transition-colors disabled:opacity-50 min-h-[38px]"
        >
          <Signal className={cn('w-3.5 h-3.5 text-cyan-400', isPinging && 'animate-spin')} />
          <span>{isPinging ? 'Pinging...' : 'Ping Device'}</span>
        </button>

        <button
          type="button"
          onClick={handleScanWifi}
          disabled={isScanningWifi || isActionPending}
          className="px-3 py-1.5 rounded-lg bg-scada-surface hover:bg-scada-card border border-scada-border text-zinc-200 flex items-center gap-1.5 transition-colors disabled:opacity-50 min-h-[38px]"
        >
          <Wifi className={cn('w-3.5 h-3.5 text-emerald-400', isScanningWifi && 'animate-pulse')} />
          <span>{isScanningWifi ? 'Scanning Airwaves...' : 'Scan Local Wi-Fi'}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowWifiForm(!showWifiForm)}
          className={cn(
            'px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors min-h-[38px]',
            showWifiForm
              ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/60'
              : 'bg-scada-surface hover:bg-scada-card border-scada-border text-cyan-400'
          )}
        >
          <Send className="w-3.5 h-3.5" />
          <span>{showWifiForm ? 'Close Wi-Fi Form' : 'Provision Hardware Wi-Fi'}</span>
        </button>

        {/* Physical relay manual override with safety confirmation */}
        {state?.tripped ? (
          <button
            type="button"
            onClick={() => executeRelayAction('restore')}
            disabled={isActionPending}
            className="px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 flex items-center gap-1.5 transition-colors disabled:opacity-50 min-h-[38px]"
          >
            <Power className="w-3.5 h-3.5 text-emerald-400" />
            <span>Restore Relay (D5)</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={confirmRelayTrip}
            disabled={isActionPending}
            className="px-3 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-900 border border-red-500/50 text-red-300 flex items-center gap-1.5 transition-colors disabled:opacity-50 min-h-[38px]"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <span>Trip Relay Test (D5)</span>
          </button>
        )}

        <button
          type="button"
          onClick={confirmReboot}
          disabled={isActionPending}
          className="px-3 py-1.5 rounded-lg bg-scada-surface hover:bg-scada-card border border-scada-border text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 transition-colors ml-auto disabled:opacity-50 min-h-[38px]"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reboot ESP</span>
        </button>
      </div>

      {/* Wi-Fi Provisioning Drawer Form */}
      {showWifiForm && (
        <form
          onSubmit={handleSaveWifi}
          className="p-3.5 rounded-lg bg-scada-surface border border-cyan-700/40 space-y-3 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-cyan-300 text-xs flex items-center gap-1.5">
              <Wifi className="w-4 h-4" />
              Configure Hardware Wi-Fi (Saved to Flash Memory)
            </span>
            <span className="text-[10px] text-zinc-400">Zero firmware reflashing required</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="wifi-ssid-input" className="block text-[10px] text-zinc-400 mb-1">
                Wi-Fi Name (SSID):
              </label>
              {scannedNetworks && scannedNetworks.length > 0 ? (
                <div className="space-y-1.5">
                  <select
                    id="wifi-ssid-select"
                    aria-label="Choose scanned network"
                    value={targetSsid}
                    onChange={(e) => setTargetSsid(e.target.value)}
                    className="w-full bg-scada-card border border-scada-border rounded px-2.5 py-1.5 text-white text-xs font-mono"
                  >
                    <option value="">-- Choose Scanned Network --</option>
                    {scannedNetworks.map((net, i) => (
                      <option key={i} value={net.ssid}>
                        {net.ssid} ({net.rssi} dBm)
                      </option>
                    ))}
                  </select>
                  <input
                    id="wifi-ssid-input"
                    type="text"
                    value={targetSsid}
                    onChange={(e) => setTargetSsid(e.target.value)}
                    placeholder="Or type Wi-Fi SSID manually"
                    className="w-full bg-scada-card border border-scada-border rounded px-2.5 py-1.5 text-white text-xs font-mono"
                  />
                </div>
              ) : (
                <input
                  id="wifi-ssid-input"
                  type="text"
                  value={targetSsid}
                  onChange={(e) => setTargetSsid(e.target.value)}
                  placeholder="e.g. Hotspot or RouterSSID"
                  required
                  className="w-full bg-scada-card border border-scada-border rounded px-2.5 py-1.5 text-white text-xs font-mono"
                />
              )}
            </div>

            <div>
              <label htmlFor="wifi-pass-input" className="block text-[10px] text-zinc-400 mb-1">
                Wi-Fi Password:
              </label>
              <input
                id="wifi-pass-input"
                type="password"
                value={targetPass}
                onChange={(e) => setTargetPass(e.target.value)}
                placeholder="Enter network password"
                className="w-full bg-scada-card border border-scada-border rounded px-2.5 py-1.5 text-white text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-zinc-400">
              The NodeMCU will write this to internal EEPROM flash and automatically reconnect.
            </span>
            <button
              type="submit"
              disabled={isActionPending || !targetSsid.trim()}
              className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {isActionPending ? 'Writing to Flash...' : 'Save & Reconnect Hardware'}
            </button>
          </div>
        </form>
      )}

      {/* Scanned Networks Quick List */}
      {scannedNetworks && scannedNetworks.length > 0 && (
        <div className="p-2.5 rounded bg-scada-surface border border-scada-border">
          <span className="text-[10px] text-zinc-400 block mb-1.5">
            Nearby 2.4 GHz Networks Discovered by ESP Radio:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {scannedNetworks.map((net, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setTargetSsid(net.ssid);
                  setShowWifiForm(true);
                }}
                className="px-2 py-0.5 rounded bg-scada-card hover:bg-scada-border text-zinc-300 border border-scada-border text-[10px] flex items-center gap-1"
              >
                <Wifi className="w-2.5 h-2.5 text-cyan-400" />
                <span>{net.ssid}</span>
                <span className="text-zinc-500">({net.rssi} dBm)</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Status Output Console Line */}
      {(statusMessage || lastPingResult) && (
        <div className="p-2 rounded bg-scada-surface border border-scada-border text-[11px] text-zinc-300 flex items-center gap-2">
          <span className="text-zinc-500 font-bold">Console:</span>
          <span className="font-mono text-cyan-300">{statusMessage || lastPingResult}</span>
        </div>
      )}

      {/* Safety Confirmation Dialog Modal */}
      {safetyDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-scada-card border border-red-500/60 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="font-mono font-bold text-sm tracking-wider uppercase text-white">
                {safetyDialog.title}
              </h4>
            </div>

            <p className="text-xs text-zinc-300 font-sans leading-relaxed">
              {safetyDialog.message}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-scada-border">
              <button
                type="button"
                onClick={() => setSafetyDialog({ isOpen: false, type: null, title: '', message: '' })}
                className="px-3.5 py-1.5 rounded-lg bg-scada-surface hover:bg-scada-card border border-scada-border text-zinc-300 text-xs font-mono"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSafetyAction}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
