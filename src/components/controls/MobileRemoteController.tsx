import React, { useState } from 'react';
import { FaultMode, ConnectionMode, ArcSenseState, DashboardLogEntry, RiskLevel } from '../../types/arcsense';
import { FaultSimulatorPanel } from './FaultSimulatorPanel';
import { apiClient } from '../../lib/arcsense-api';
import {
  Radio,
  RotateCcw,
  Power,
  Activity,
  Sliders,
  Cpu,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface MobileRemoteControllerProps {
  activeMode: FaultMode;
  isSimulator: boolean;
  isInjecting: boolean;
  isResetting: boolean;
  tripped: boolean;
  state: ArcSenseState | null;
  connectionMode: ConnectionMode;
  baseUrl: string;
  latencyMs: number | null;
  eventLogs: DashboardLogEntry[];
  onInject: (mode: FaultMode) => void;
  onReset: () => void;
  onOpenSettings: () => void;
  onToggleSimulator: (val: boolean) => void;
}

export const MobileRemoteController: React.FC<MobileRemoteControllerProps> = ({
  activeMode,
  isSimulator,
  isInjecting,
  isResetting,
  tripped,
  state,
  connectionMode,
  baseUrl,
  latencyMs,
  eventLogs,
  onInject,
  onReset,
  onOpenSettings,
  onToggleSimulator,
}) => {
  const [isPinging, setIsPinging] = useState(false);
  const [pingMessage, setPingMessage] = useState<string | null>(null);
  const [isRebooting, setIsRebooting] = useState(false);
  const [isRelayActionPending, setIsRelayActionPending] = useState(false);

  const isLive = connectionMode === 'LIVE';

  const handlePing = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      const res = await apiClient.ping();
      const ms = Math.round(performance.now() - start);
      setPingMessage(`Ping OK: ${ms}ms (Heap: ${res.freeHeap ?? 'OK'} B)`);
    } catch (err: any) {
      setPingMessage(`Ping Failed: ${err.message || 'Timeout'}`);
    } finally {
      setIsPinging(false);
    }
  };

  const handleReboot = async () => {
    if (!window.confirm('Trigger remote software reboot on the ESP8266?')) return;
    setIsRebooting(true);
    try {
      await apiClient.restart();
      setPingMessage('ESP8266 reboot initiated...');
    } catch (err: any) {
      setPingMessage(`Reboot failed: ${err.message}`);
    } finally {
      setIsRebooting(false);
    }
  };

  const handleRelayRestore = async () => {
    setIsRelayActionPending(true);
    try {
      await apiClient.setRelay('restore');
      setPingMessage('Relay RESTORE signal sent to ESP (D5)');
      onReset();
    } catch (err: any) {
      setPingMessage(`Relay command failed: ${err.message}`);
    } finally {
      setIsRelayActionPending(false);
    }
  };

  const getRiskColor = (level?: RiskLevel) => {
    switch (level) {
      case RiskLevel.DANGER:
        return 'text-red-400 border-red-500/50 bg-red-950/40';
      case RiskLevel.WARNING:
        return 'text-amber-400 border-amber-500/50 bg-amber-950/40';
      case RiskLevel.WATCH:
        return 'text-blue-400 border-blue-500/50 bg-blue-950/40';
      case RiskLevel.NORMAL:
      default:
        return 'text-emerald-400 border-emerald-500/50 bg-emerald-950/40';
    }
  };

  const riskLevelName = ['NORMAL', 'WATCH', 'WARNING', 'DANGER'][state?.level ?? 0] || 'NORMAL';

  return (
    <div className="space-y-3 font-mono text-xs">
      {/* 1. Quick Telemetry Glance Bar */}
      <div className="bg-industrial-900 border border-zinc-800 rounded-xl p-3 shadow-lg">
        <div className="grid grid-cols-4 gap-1.5 text-center divide-x divide-zinc-800">
          {/* Risk */}
          <div className="px-1">
            <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Fire Risk</div>
            <div className={cn('text-sm font-extrabold truncate', getRiskColor(state?.level))}>
              {state ? `${state.risk.toFixed(0)}` : '0'}
              <span className="text-[10px] font-normal text-zinc-400">/100</span>
            </div>
            <div className="text-[9px] text-zinc-400 font-semibold">{riskLevelName}</div>
          </div>

          {/* Circuit State */}
          <div className="px-1">
            <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Relay</div>
            <div
              className={cn(
                'text-xs font-extrabold truncate mt-0.5',
                tripped ? 'text-red-400 animate-pulse' : 'text-emerald-400'
              )}
            >
              {tripped ? 'TRIPPED' : 'LIVE (ON)'}
            </div>
            <div className="text-[9px] text-zinc-400">
              {state?.tripped ? 'OPEN' : 'CLOSED'}
            </div>
          </div>

          {/* AC Current */}
          <div className="px-1">
            <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Load Irms</div>
            <div className="text-xs font-bold text-white mt-0.5">
              {state ? `${state.irms.toFixed(2)} A` : '0.00 A'}
            </div>
            <div className="text-[9px] text-zinc-400">
              {state?.crest ? `Crest: ${state.crest.toFixed(1)}` : '50 Hz'}
            </div>
          </div>

          {/* Link Status */}
          <div className="px-1">
            <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Node IP</div>
            <div
              className={cn(
                'text-xs font-bold truncate mt-0.5',
                isLive ? 'text-emerald-400' : 'text-amber-400'
              )}
            >
              {isLive ? `${latencyMs ?? 0}ms` : 'STANDBY'}
            </div>
            <div className="text-[9px] text-zinc-400 truncate max-w-[65px] mx-auto">
              {baseUrl.replace('http://', '')}
            </div>
          </div>
        </div>
      </div>

      {/* 2. PRIMARY: Load Changing & Fault Injection (FIRST) */}
      <FaultSimulatorPanel
        activeMode={activeMode}
        isSimulator={isSimulator}
        isInjecting={isInjecting}
        isResetting={isResetting}
        tripped={tripped}
        onInject={onInject}
        onReset={onReset}
        isCompact={true}
      />

      {/* 3. Quick Handheld Hardware Actions */}
      <div className="bg-industrial-900 border border-zinc-800 rounded-xl p-3 shadow-md space-y-2.5">
        <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
          <div className="flex items-center gap-1.5 text-zinc-300 font-bold text-[11px] uppercase tracking-wider">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>Handheld Hardware Actions</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-medium">ESP8266 Wi-Fi Bridge</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Restore Relay Action */}
          <button
            type="button"
            disabled={isRelayActionPending || !isLive}
            onClick={handleRelayRestore}
            className={cn(
              'flex items-center justify-center gap-1.5 p-2 rounded-lg border font-mono text-[11px] font-bold tracking-wide transition-all min-h-[40px]',
              isLive
                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50 active:scale-95'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed'
            )}
          >
            <Power className={cn('w-3.5 h-3.5', isRelayActionPending && 'animate-spin')} />
            <span>Restore Relay</span>
          </button>

          {/* Ping Healthcheck */}
          <button
            type="button"
            disabled={isPinging || !isLive}
            onClick={handlePing}
            className={cn(
              'flex items-center justify-center gap-1.5 p-2 rounded-lg border font-mono text-[11px] font-bold tracking-wide transition-all min-h-[40px]',
              isLive
                ? 'bg-zinc-800/80 border-zinc-700 text-zinc-200 hover:bg-zinc-700 active:scale-95'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed'
            )}
          >
            <Activity className={cn('w-3.5 h-3.5 text-sky-400', isPinging && 'animate-spin')} />
            <span>{isPinging ? 'Pinging...' : 'Ping Node'}</span>
          </button>

          {/* Remote Reboot */}
          <button
            type="button"
            disabled={isRebooting || !isLive}
            onClick={handleReboot}
            className={cn(
              'flex items-center justify-center gap-1.5 p-2 rounded-lg border font-mono text-[11px] font-bold tracking-wide transition-all min-h-[40px]',
              isLive
                ? 'bg-zinc-800/80 border-zinc-700 text-amber-300 hover:bg-zinc-700 active:scale-95'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed'
            )}
          >
            <RotateCcw className={cn('w-3.5 h-3.5', isRebooting && 'animate-spin')} />
            <span>Reboot ESP</span>
          </button>

          {/* Toggle Simulator / Live Hardware */}
          <button
            type="button"
            onClick={() => onToggleSimulator(!isSimulator)}
            className={cn(
              'flex items-center justify-center gap-1.5 p-2 rounded-lg border font-mono text-[11px] font-bold tracking-wide transition-all active:scale-95 min-h-[40px]',
              isSimulator
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                : 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
            )}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>{isSimulator ? 'Sim Mode' : 'Live Mode'}</span>
          </button>

          {/* Configure IP Settings */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center justify-center gap-1.5 p-2 rounded-lg border border-zinc-700 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700 font-mono text-[11px] font-bold tracking-wide transition-all active:scale-95 min-h-[40px]"
          >
            <Sliders className="w-3.5 h-3.5 text-zinc-400" />
            <span>Change IP</span>
          </button>
        </div>

        {pingMessage && (
          <div className="p-1.5 bg-zinc-950 border border-zinc-800 rounded text-[10px] text-zinc-300 truncate">
            {pingMessage}
          </div>
        )}
      </div>

      {/* 4. Recent Command & Event Feed */}
      {eventLogs.length > 0 && (
        <div className="bg-industrial-900 border border-zinc-800 rounded-xl p-3 shadow-md space-y-1.5">
          <div className="flex items-center justify-between pb-1 border-b border-zinc-800 text-[10px] text-zinc-400 uppercase font-bold">
            <span>Recent Action Log</span>
            <span>Live Ticker</span>
          </div>
          <div className="space-y-1">
            {eventLogs.slice(0, 3).map((log) => (
              <div key={log.id} className="flex items-start gap-1.5 text-[10px] truncate">
                <span className="text-zinc-500 shrink-0 font-mono">
                  {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span
                  className={cn(
                    'truncate font-medium',
                    log.type === 'danger'
                      ? 'text-red-400'
                      : log.type === 'warning'
                        ? 'text-amber-400'
                        : 'text-zinc-300'
                  )}
                >
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
