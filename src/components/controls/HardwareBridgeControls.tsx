import React, { useState } from 'react';
import { ConnectionMode, ArcSenseState } from '../../types/arcsense';
import { HardwareStatus } from './HardwareStatus';
import { HardwareDiagnostics } from './HardwareDiagnostics';

interface HardwareBridgeControlsProps {
  connectionMode: ConnectionMode;
  baseUrl: string;
  state: ArcSenseState | null;
  latencyMs: number | null;
  onOpenSettings: () => void;
  onRefreshTelemetry: () => void;
  defaultExpanded?: boolean;
}

export const HardwareBridgeControls: React.FC<HardwareBridgeControlsProps> = ({
  connectionMode,
  baseUrl,
  state,
  latencyMs,
  onOpenSettings,
  onRefreshTelemetry,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="space-y-3">
      <HardwareStatus
        connectionMode={connectionMode}
        baseUrl={baseUrl}
        state={state}
        latencyMs={latencyMs}
        isExpanded={isExpanded}
        onToggleExpand={() => setIsExpanded(!isExpanded)}
        onOpenSettings={onOpenSettings}
      />

      {isExpanded && (
        <div className="animate-in fade-in duration-200">
          <HardwareDiagnostics
            connectionMode={connectionMode}
            baseUrl={baseUrl}
            state={state}
            latencyMs={latencyMs}
            onOpenSettings={onOpenSettings}
            onRefreshTelemetry={onRefreshTelemetry}
          />
        </div>
      )}
    </div>
  );
};
