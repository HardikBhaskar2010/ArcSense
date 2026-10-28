import { ArcSenseState, ConnectionMode } from '../types/arcsense';
import { getRiskLevelName } from './utils';

export function exportTelemetryToCsv(
  samples: ArcSenseState[],
  connectionMode: ConnectionMode,
  customFilename?: string
): void {
  if (samples.length === 0) {
    alert('No telemetry samples recorded in this session yet.');
    return;
  }

  const isSimulated = connectionMode === 'SIMULATOR';

  // Stable, structured column headers
  const headers = [
    'session_ms',
    'timestamp_iso',
    'data_source',
    'risk_score',
    'risk_level',
    'tripped_flag',
    'sensor_fault_flag',
    'irms_amperes',
    'crest_factor',
    'diff_index',
    'flat_zero_fraction',
    'arc_count_per_sec',
    'temp_object_celsius',
    'temp_ambient_celsius',
    'delta_temp_celsius',
    'heating_slope_c_per_min',
    'ttl_minutes_to_alarm',
    'evidence_thermal_sT',
    'evidence_slope_sS',
    'evidence_arc_sA',
    'evidence_load_sL',
    'injection_mode',
  ];

  const escapeCsv = (str: string | number | boolean): string => {
    const val = String(str);
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const rows = samples.map((s) => {
    const isoDate = new Date(Date.now() - (samples[samples.length - 1].t - s.t)).toISOString();
    return [
      s.t,
      isoDate,
      isSimulated ? 'SIMULATED_DEMO_DATA' : 'LIVE_HARDWARE_ESP32',
      s.risk.toFixed(1),
      getRiskLevelName(s.level),
      s.tripped ? 1 : 0,
      s.sensorFault ? 1 : 0,
      s.irms.toFixed(3),
      s.crest.toFixed(2),
      s.diffIdx.toFixed(3),
      s.flatFrac.toFixed(3),
      s.arcCount,
      s.tObj.toFixed(2),
      s.tAmb.toFixed(2),
      s.dT.toFixed(2),
      s.slope.toFixed(2),
      s.ttlMin.toFixed(2),
      s.sT.toFixed(2),
      s.sS.toFixed(2),
      s.sA.toFixed(2),
      s.sL.toFixed(2),
      s.inj,
    ]
      .map(escapeCsv)
      .join(',');
  });

  const metadataComment = [
    `# ArcSense Telemetry Session Log`,
    `# Export Date: ${new Date().toISOString()}`,
    `# Total Samples: ${samples.length}`,
    `# Connection Mode: ${connectionMode} (${isSimulated ? 'SIMULATOR - NOT PHYSICAL HARDWARE' : 'PHYSICAL HARDWARE'})`,
    `# Project: ArcSense (Category C2: Disaster Management)`,
  ].join('\n');

  const csvContent = `${metadataComment}\n${headers.join(',')}\n${rows.join('\n')}\n`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.download = customFilename || `arcsense_${isSimulated ? 'simulated' : 'live'}_log_${timestampStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
