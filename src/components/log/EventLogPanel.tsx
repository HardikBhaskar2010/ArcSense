import React, { useState } from 'react';
import { DashboardLogEntry } from '../../types/arcsense';
import { Terminal, Trash2, ShieldAlert, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface EventLogPanelProps {
  logs: DashboardLogEntry[];
  onClear: () => void;
}

export const EventLogPanel: React.FC<EventLogPanelProps> = ({ logs, onClear }) => {
  const [filter, setFilter] = useState<'all' | 'trip' | 'warning' | 'info'>('all');

  const filteredLogs = logs.filter((log) => {
    if (filter === 'trip') return log.type === 'trip' || log.type === 'danger';
    if (filter === 'warning') return log.type === 'warning' || log.type === 'danger' || log.type === 'trip';
    if (filter === 'info') return log.type === 'info' || log.type === 'system';
    return true;
  });

  const getLogIcon = (type: DashboardLogEntry['type']) => {
    switch (type) {
      case 'trip':
      case 'danger':
        return <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />;
      case 'system':
        return <Info className="w-3.5 h-3.5 text-zinc-300 shrink-0 mt-0.5" />;
      default:
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />;
    }
  };

  const getLogColor = (type: DashboardLogEntry['type']) => {
    switch (type) {
      case 'trip':
      case 'danger':
        return 'text-red-300 bg-red-950/30 border-red-500/40';
      case 'warning':
        return 'text-orange-300 bg-orange-950/30 border-orange-500/30';
      case 'system':
        return 'text-zinc-200 bg-zinc-900 border-zinc-700';
      default:
        return 'text-zinc-300 bg-zinc-950 border-zinc-800';
    }
  };

  return (
    <div className="bg-industrial-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
      {/* Header with Title and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-white" />
          <h3 className="font-mono text-xs font-bold text-white tracking-wider uppercase">
            Real-Time Event & Safety Log
          </h3>
          <span className="text-[10px] font-mono text-zinc-400">
            ({logs.length} events)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Filter Pills */}
          <div className="flex items-center bg-zinc-950 p-0.5 rounded border border-zinc-800 text-[10px] font-mono">
            {(['all', 'trip', 'warning', 'info'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilter(mode)}
                className={cn(
                  'px-2 py-0.5 rounded uppercase font-semibold transition-colors',
                  filter === mode ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          <button
            type="button"
            title="Clear Event Log"
            onClick={onClear}
            className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Log Feed */}
      <div className="h-[180px] sm:h-[200px] overflow-y-auto space-y-1.5 pr-1 font-mono text-xs scrollbar-thin">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
            No events recorded for current filter.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const timeStr = log.timestamp.toLocaleTimeString();
            return (
              <div
                key={log.id}
                className={cn(
                  'p-2 rounded border flex items-start gap-2 leading-relaxed transition-colors',
                  getLogColor(log.type)
                )}
              >
                {getLogIcon(log.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-white truncate">
                      {log.message}
                    </span>
                    <span className="text-[10px] text-zinc-400 shrink-0">
                      +{log.elapsedSec}s · {timeStr}
                    </span>
                  </div>
                  {log.details && (
                    <div className="text-[11px] text-zinc-400 mt-0.5 font-sans leading-normal">
                      {log.details}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Disclaimer */}
      <div className="mt-2 pt-2 border-t border-zinc-800 text-[10px] font-mono text-zinc-400 flex items-center justify-between">
        <span>Session event log (volatile browser memory)</span>
        <span>Local timestamps</span>
      </div>
    </div>
  );
};
