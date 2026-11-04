import React from 'react';
import { MetricCard } from './MetricCard';

interface TelemetryCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subValue?: string;
  status?: 'normal' | 'watch' | 'warning' | 'danger' | 'neutral';
  icon?: React.ReactNode;
  tooltip?: string;
}

export const TelemetryCard: React.FC<TelemetryCardProps> = (props) => {
  return <MetricCard {...props} />;
};
