import React from 'react';
import { DashboardLogEntry } from '../../types/arcsense';
import { EventLog } from './EventLog';

interface EventLogPanelProps {
  logs: DashboardLogEntry[];
  onClear: () => void;
  heightClass?: string;
}

export const EventLogPanel: React.FC<EventLogPanelProps> = ({ logs, onClear, heightClass = 'h-[200px] sm:h-[220px]' }) => {
  return <EventLog logs={logs} onClear={onClear} heightClass={heightClass} />;
};
