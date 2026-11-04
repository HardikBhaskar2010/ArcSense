import React from 'react';
import { LiveWaveform } from './LiveWaveform';

interface WaveformChartProps {
  waveform: number[]; // 96 samples in Amperes
  irms: number;
  isPaused?: boolean;
  showReferenceSine?: boolean;
  onToggleReferenceSine?: () => void;
  heightClass?: string;
}

export const WaveformChart: React.FC<WaveformChartProps> = (props) => {
  return <LiveWaveform {...props} />;
};
