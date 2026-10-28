import React, { useState } from 'react';
import {
  Wifi,
  WifiOff,
  Radio,
  Power,
  RotateCcw,
  Signal,
  CheckCircle2,
  ShieldAlert,
  Send,
} from 'lucide-react';
import { ConnectionMode, ArcSenseState } from '../../types/arcsense';
import { apiClient } from '../../lib/arcsense-api';
import { cn } from '../../lib/utils';

interface HardwareBridgeControlsProps {
  connectionMode: ConnectionMode;
  baseUrl: string;
  state: ArcSenseState | null;
  latencyMs: number | null;
  onOpenSettings: () => void;
  onRefreshTelemetry: () => void;
}

export const HardwareBridgeControls: React.FC<HardwareBridgeControlsProps> = ({
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

  // New Wi-Fi form state
  const [showWifiForm, setShowWifiForm] = useState(false);
  const [targetSsid, setTargetSsid] = useState('');
  const [targetPass, setTargetPass] = useState('');

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

  // 4. Physical Relay toggle
  const handleRelayToggle = async (action: 'trip' | 'restore') => {
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

  // 5. Remote Reboot
  const handleRestart = async () => {
    if (!window.confirm('Are you sure you want to trigger a remote software reboot on the ESP8266?')) return;
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
  };

  // Helper for RSSI quality
  const getSignalQuality = (rssi?: number) => {
    if (rssi === undefined || rssi === 0) return { label: 'Direct AP / Unknown', color: 'text-zinc-400' };
    if (rssi >= -60) return { label: `${rssi} dBm (Excellent)`, color: 'text-emerald-400' };
    if (rssi >= -75) return { label: `${rssi} dBm (Good)`, color: 'text-teal-400' };
    if (rssi >= -85) return { label: `${rssi} dBm (Fair)`, color: 'text-amber-400' };
    return { label: `${rssi} dBm (Weak)`, color: 'text-red-400' };
  };

  const sig = getSignalQuality(state?.wifiRssi);

  return (
    <div className="bg-industrial-900 border border-zinc-800 rounded-xl p-4 sm:p-5 shadow-xl font-mono text-xs space-y-4">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800 gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sky-400">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
              Hardware Bridge & Remote Comm Control
            </h3>
            <p className="text-[11px] text-zinc-400 font-sans">
              Direct telemetry interrogation, Wi-Fi link status, and hardware relay override
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span
            className={cn(
              'px-2.5 py-1 rounded-md text-[11px] font-bold border flex items-center gap-1.5',
              isLive
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50 shadow-glow-normal'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            )}
          >
            {isLive ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isLive ? 'BRIDGE ACTIVE' : 'NO LIVE HARDWARE'}
          </span>
          <button
            type="button"
            onClick={onOpenSettings}
            className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-[11px] transition-colors"
          >
            Change IP
          </button>
        </div>
      </div>

      {/* Hardware Telemetry Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-industrial-950 border border-zinc-800/80 rounded-lg p-2.5">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Target Endpoint</span>
          <span className="font-bold text-slate-100 truncate block text-[11px] mt-0.5" title={baseUrl}>
            {baseUrl.replace(/^https?:\/\//, '')}
          </span>
        </div>

        <div className="bg-industrial-950 border border-zinc-800/80 rounded-lg p-2.5">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Node Wi-Fi (SSID)</span>
          <span className="font-bold text-sky-400 truncate block text-[11px] mt-0.5">
            {state?.wifiSsid || (isLive ? 'ArcSense-ESP' : '—')}
          </span>
        </div>

        <div className="bg-industrial-950 border border-zinc-800/80 rounded-lg p-2.5">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Signal (RSSI)</span>
          <span className={cn('font-bold truncate block text-[11px] mt-0.5', sig.color)}>
            {isLive ? sig.label : '—'}
          </span>
        </div>

        <div className="bg-industrial-950 border border-zinc-800/80 rounded-lg p-2.5">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Ping Round-Trip</span>
          <span className="font-bold text-emerald-400 truncate block text-[11px] mt-0.5">
            {latencyMs !== null ? `${latencyMs} ms` : isLive ? '< 20 ms' : '—'}
          </span>
        </div>

        <div className="bg-industrial-950 border border-zinc-800/80 rounded-lg p-2.5">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">ESP System Uptime</span>
          <span className="font-bold text-slate-200 truncate block text-[11px] mt-0.5">
            {state?.uptimeSec ? `${Math.floor(state.uptimeSec / 60)}m ${state.uptimeSec % 60}s` : '—'}
          </span>
        </div>

        <div className="bg-industrial-950 border border-zinc-800/80 rounded-lg p-2.5">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Fail-Safe Relay</span>
          <span
            className={cn(
              'font-bold truncate block text-[11px] mt-0.5',
              state?.tripped ? 'text-red-400' : 'text-emerald-400'
            )}
          >
            {state?.tripped ? 'TRIPPED (CUT)' : 'LIVE (ON)'}
          </span>
        </div>
      </div>

      {/* Action Controls Toolbar */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handlePing}
          disabled={isPinging || isActionPending}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <Signal className={cn('w-3.5 h-3.5 text-sky-400', isPinging && 'animate-spin')} />
          <span>{isPinging ? 'Pinging...' : 'Ping Device'}</span>
        </button>

        <button
          type="button"
          onClick={handleScanWifi}
          disabled={isScanningWifi || isActionPending}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <Wifi className={cn('w-3.5 h-3.5 text-emerald-400', isScanningWifi && 'animate-pulse')} />
          <span>{isScanningWifi ? 'Scanning Airwaves...' : 'Scan Local Wi-Fi'}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowWifiForm(!showWifiForm)}
          className="px-3 py-1.5 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-600/50 text-sky-300 flex items-center gap-1.5 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{showWifiForm ? 'Close Wi-Fi Form' : 'Provision Hardware Wi-Fi'}</span>
        </button>

        {/* Physical relay manual override */}
        {state?.tripped ? (
          <button
            type="button"
            onClick={() => handleRelayToggle('restore')}
            disabled={isActionPending}
            className="px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Power className="w-3.5 h-3.5 text-emerald-400" />
            <span>Restore Relay (D5)</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleRelayToggle('trip')}
            disabled={isActionPending}
            className="px-3 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <span>Trip Relay Test (D5)</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleRestart}
          disabled={isActionPending}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700 flex items-center gap-1.5 transition-colors ml-auto disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reboot ESP</span>
        </button>
      </div>

      {/* Wi-Fi Provisioning Drawer Form */}
      {showWifiForm && (
        <form
          onSubmit={handleSaveWifi}
          className="p-3.5 rounded-lg bg-industrial-950 border border-sky-700/40 space-y-3 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-sky-300 text-xs flex items-center gap-1.5">
              <Wifi className="w-4 h-4" />
              Configure Hardware Wi-Fi (Saved to Flash Memory)
            </span>
            <span className="text-[10px] text-zinc-400">Zero reflashing required</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-zinc-400 mb-1">Wi-Fi Name (SSID):</label>
              {scannedNetworks && scannedNetworks.length > 0 ? (
                <div className="space-y-1.5">
                  <select
                    value={targetSsid}
                    onChange={(e) => setTargetSsid(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-white text-xs font-mono"
                  >
                    <option value="">-- Choose Scanned Network --</option>
                    {scannedNetworks.map((net, i) => (
                      <option key={i} value={net.ssid}>
                        {net.ssid} ({net.rssi} dBm)
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={targetSsid}
                    onChange={(e) => setTargetSsid(e.target.value)}
                    placeholder="Or type Wi-Fi SSID manually"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-white text-xs font-mono"
                  />
                </div>
              ) : (
                <input
                  type="text"
                  value={targetSsid}
                  onChange={(e) => setTargetSsid(e.target.value)}
                  placeholder="e.g. MyPhoneHotspot or RouterSSID"
                  required
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-white text-xs font-mono"
                />
              )}
            </div>

            <div>
              <label className="block text-[10px] text-zinc-400 mb-1">Wi-Fi Password:</label>
              <input
                type="password"
                value={targetPass}
                onChange={(e) => setTargetPass(e.target.value)}
                placeholder="Enter network password"
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-white text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-zinc-400">
              The NodeMCU will save this to internal EEPROM flash and automatically reconnect.
            </span>
            <button
              type="submit"
              disabled={isActionPending || !targetSsid.trim()}
              className="px-4 py-1.5 bg-sky-500 hover:bg-sky-400 text-black font-bold rounded flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {isActionPending ? 'Writing to Flash...' : 'Save & Reconnect Hardware'}
            </button>
          </div>
        </form>
      )}

      {/* Scanned Networks Quick List */}
      {scannedNetworks && scannedNetworks.length > 0 && (
        <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800">
          <span className="text-[10px] text-zinc-400 block mb-1.5">
            Nearby 2.4 GHz Networks Discovered by ESP:
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
                className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-[10px] flex items-center gap-1"
              >
                <Wifi className="w-2.5 h-2.5 text-sky-400" />
                <span>{net.ssid}</span>
                <span className="text-zinc-500">({net.rssi} dBm)</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Status Output Console Line */}
      {(statusMessage || lastPingResult) && (
        <div className="p-2 rounded bg-zinc-950 border border-zinc-800/80 text-[11px] text-zinc-300 flex items-center gap-2">
          <span className="text-zinc-500">Console:</span>
          <span className="font-bold text-sky-300">{statusMessage || lastPingResult}</span>
        </div>
      )}
    </div>
  );
};
