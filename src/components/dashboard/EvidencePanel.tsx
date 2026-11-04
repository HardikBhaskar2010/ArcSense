import React from 'react';
import { ArcSenseState } from '../../types/arcsense';
import { EvidenceFusionGrid } from './EvidenceFusionGrid';

interface EvidencePanelProps {
  state: ArcSenseState | null;
  isCompact?: boolean;
}

export const EvidencePanel: React.FC<EvidencePanelProps> = (props) => {
  return <EvidenceFusionGrid {...props} />;
};
