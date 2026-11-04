import React from 'react';
import { LayoutDashboard, Zap, Thermometer, Radio, Terminal } from 'lucide-react';
import { cn } from '../../lib/utils';

export type DashboardTab = 'overview' | 'electrical' | 'thermal' | 'hardware' | 'logs';

interface DashboardNavigationProps {
  activeTab: DashboardTab;
  onChangeTab: (tab: DashboardTab) => void;
  eventCount?: number;
  alertCount?: number;
  isTripped?: boolean;
}

export const DashboardNavigation: React.FC<DashboardNavigationProps> = ({
  activeTab,
  onChangeTab,
  eventCount = 0,
  alertCount = 0,
  isTripped = false,
}) => {
  const tabs: {
    id: DashboardTab;
    label: string;
    icon: React.ReactNode;
    badge?: React.ReactNode;
  }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard className="w-4 h-4" />,
      badge: isTripped ? (
        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
      ) : alertCount > 0 ? (
        <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-mono">
          {alertCount}
        </span>
      ) : null,
    },
    {
      id: 'electrical',
      label: 'Electrical',
      icon: <Zap className="w-4 h-4" />,
    },
    {
      id: 'thermal',
      label: 'Thermal',
      icon: <Thermometer className="w-4 h-4" />,
    },
    {
      id: 'hardware',
      label: 'Hardware',
      icon: <Radio className="w-4 h-4" />,
    },
    {
      id: 'logs',
      label: 'Event Logs',
      icon: <Terminal className="w-4 h-4" />,
      badge: eventCount > 0 ? (
        <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-mono">
          {eventCount}
        </span>
      ) : null,
    },
  ];

  return (
    <nav
      role="tablist"
      aria-label="Dashboard views"
      className="bg-black/90 backdrop-blur border-b border-zinc-800 sticky top-0 z-20 px-2 sm:px-6"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-start overflow-x-auto scrollbar-none py-1 gap-1 sm:gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={cn(
                'group flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg font-mono text-xs font-semibold whitespace-nowrap transition-all duration-200 select-none min-h-[40px] sm:min-h-[44px]',
                isActive
                  ? 'bg-zinc-900 text-white border border-zinc-700 shadow-sm relative after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40 border border-transparent'
              )}
            >
              <span
                className={cn(
                  'transition-colors',
                  isActive ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'
                )}
              >
                {tab.icon}
              </span>
              <span>{tab.label}</span>
              {tab.badge}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
