import React from 'react';
import { ArcSenseState } from '../../types/arcsense';
import { RiskAssessment } from './RiskAssessment';

interface RiskPanelProps {
  state: ArcSenseState | null;
  isSimulator: boolean;
  isStale: boolean;
  onReset?: () => void;
  isResetting?: boolean;
}

export const RiskPanel: React.FC<RiskPanelProps> = (props) => {
  return <RiskAssessment {...props} />;
};
