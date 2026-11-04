import React, { useState, useMemo } from 'react';
import { DashboardLogEntry } from '../../types/arcsense';
import {
  Terminal,
  Trash2,
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle,
  Search,
  Filter,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface EventLogProps {
  logs: DashboardLogEntry[];
  onClear: () => void;
  heightClass?: string;
}

export const EventLog: React.FC<EventLogProps> = ({
  logs,
  onClear,
  heightClass = 'h-[360px] sm:h-[480px]',
}) => {
  const [filter, setFilter] = useState<'all' | 'trip' | 'warning' | 'info'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Type filter
      if (filter === 'trip' && !(log.type === 'trip' || log.type === 'danger')) return false;
      if (filter === 'warning' && !(log.type === 'warning' || log.type === 'danger' || log.type === 'trip')) return false;
      if (filter === 'info' && !(log.type === 'info' || log.type === 'system')) return false;

      // Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          log.message.toLowerCase().includes(query) ||
          log.type.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [logs, filter, searchQuery]);

  const getLogIcon = (type: DashboardLogEntry['type']) => {
    switch (type) {
      case 'trip':
      case 'danger':
        return <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />;
      case 'system':
        return <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />;
      default:
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />;
    }
  };

  const getLogBadge = (type: DashboardLogEntry['type']) => {
    switch (type) {
      case 'trip':
        return 'bg-red-950/80 text-red-300 border-red-500/60 font-bold';
      case 'danger':
        return 'bg-red-950/70 text-red-400 border-red-600/50';
      case 'warning':
        return 'bg-orange-950/70 text-orange-300 border-orange-500/40';
      case 'system':
        return 'bg-cyan-950/60 text-cyan-300 border-cyan-800/40';
      default:
        return 'bg-zinc-900 text-zinc-400 border-zinc-800';
    }
  };

  return (
    <div className="bg-scada-card border border-scada-border rounded-xl p-3 sm:p-5 flex flex-col justify-between shadow-lg font-mono text-xs">
      {/* Header with Title and Global Counts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-scada-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-scada-surface border border-scada-border flex items-center justify-center text-cyan-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-white text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
              System Event & Audit Logs
            </h3>
            <p className="text-[10px] sm:text-[11px] text-zinc-400 font-sans">
              Recorded sequence of risk transitions, relay trips, and hardware operations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-400">
            Total: <strong className="text-white">{logs.length}</strong> events
          </span>
          <button
            type="button"
            title="Clear all event logs"
            onClick={() => {
              if (window.confirm('Clear all logged event history?')) {
                onClear();
              }
            }}
            className="p-1.5 rounded-lg bg-scada-surface hover:bg-scada-card border border-scada-border text-zinc-400 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 py-2.5">
        {/* Search input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search log messages..."
            className="w-full bg-scada-surface border border-scada-border rounded-lg pl-8 pr-3 py-1.5 text-white placeholder-zinc-500 text-xs font-mono focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Severity Filter Pills */}
        <div className="flex items-center gap-1 bg-scada-surface p-1 rounded-lg border border-scada-border self-start sm:self-auto overflow-x-auto">
          <Filter className="w-3 h-3 text-zinc-500 ml-1 mr-0.5 shrink-0" />
          {(['all', 'trip', 'warning', 'info'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilter(mode)}
              className={cn(
                'px-2.5 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition-colors whitespace-nowrap',
                filter === mode
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Log Feed List */}
      <div className={cn('overflow-y-auto space-y-1.5 pr-1 scrollbar-thin', heightClass)}>
        {filteredLogs.length === 0 ? (
          <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-zinc-500 text-xs">
            <Terminal className="w-6 h-6 mb-2 opacity-40" />
            <span>No events found matching current filter or search criteria.</span>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const timeStr = log.timestamp.toLocaleTimeString();
            return (
              <div
                key={log.id}
                className="p-2 sm:p-2.5 rounded-lg bg-scada-surface border border-scada-border/80 hover:border-scada-borderLight transition-colors flex items-start gap-2.5"
              >
                {getLogIcon(log.type)}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-0.5">
                    <span
                      className={cn(
                        'px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider border font-bold',
                        getLogBadge(log.type)
                      )}
                    >
                      {log.type}
                    </span>
                    <span className="text-[10px] text-zinc-500 tabular-nums">{timeStr}</span>
                  </div>

                  <p className="text-[11px] text-zinc-200 font-sans leading-relaxed break-words">
                    {log.message}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Audit Stats */}
      <div className="pt-2.5 mt-2 border-t border-scada-border flex items-center justify-between text-[10px] text-zinc-500">
        <span>Continuous rolling buffer · Auto-synced with browser session</span>
        <span className="hidden sm:inline">Exportable via CSV header menu</span>
      </div>
    </div>
  );
};

