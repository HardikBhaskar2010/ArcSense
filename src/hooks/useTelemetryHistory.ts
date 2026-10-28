import { useState, useEffect, useRef } from 'react';
import { ArcSenseState, TelemetryPoint } from '../types/arcsense';

export function useTelemetryHistory(currentState: ArcSenseState | null, windowSec: number = 90) {
  const [history, setHistory] = useState<TelemetryPoint[]>([]);
  const lastTimestampRef = useRef<number>(0);

  // Compute maximum points to retain based on selected window in seconds
  // Assuming 2 samples per second at 500ms
  const maxPoints = Math.max(30, windowSec * 2);

  useEffect(() => {
    if (!currentState) return;

    // Deduplicate rapid identical-timestamp ticks
    const currentT = currentState.t || Date.now();
    if (currentT === lastTimestampRef.current) return;
    lastTimestampRef.current = currentT;

    const date = new Date();
    const timeLabel = `${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;

    // Predicted heating point if slope is positive
    let predictedTemp: number | undefined = undefined;
    if (currentState.slope > 0.3 && currentState.ttlMin > 0) {
      // Estimated temperature 15 seconds ahead: T + slope * (15/60)
      predictedTemp = currentState.tObj + currentState.slope * 0.25;
    }

    const newPoint: TelemetryPoint = {
      timestamp: currentT,
      timeLabel,
      tObj: currentState.tObj,
      tAmb: currentState.tAmb,
      dT: currentState.dT,
      slope: currentState.slope,
      irms: currentState.irms,
      risk: currentState.risk,
      level: currentState.level,
      arcCount: currentState.arcCount,
      diffIdx: currentState.diffIdx,
      tripped: currentState.tripped,
      predictedTemp,
    };

    setHistory((prev) => {
      const updated = [...prev, newPoint];
      if (updated.length > maxPoints) {
        return updated.slice(updated.length - maxPoints);
      }
      return updated;
    });
  }, [currentState, maxPoints]);

  return {
    history,
    clearHistory: () => setHistory([]),
  };
}
