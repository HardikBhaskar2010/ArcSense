import React from 'react';
import { DashboardHeader } from './DashboardHeader';
import { ConnectionMode } from '../../types/arcsense';

interface HeaderProps {
  connectionMode: ConnectionMode;
  baseUrl: string;
  deviceName?: string;
  isStale: boolean;
  lastUpdateTime: Date | null;
  latencyMs: number | null;
  isPaused: boolean;
  soundAlertsEnabled: boolean;
  onTogglePause: () => void;
  onToggleSoundAlerts: () => void;
  onOpenSettings: () => void;
  onExportCsv: () => void;
  onToggleSimulator: () => void;
  onOpenShortcuts: () => void;
  onClearSession?: () => void;
}

export const Header: React.FC<HeaderProps> = (props) => {
  return <DashboardHeader {...props} />;
};
