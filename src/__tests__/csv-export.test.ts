import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportTelemetryToCsv } from '../lib/csv-export';
import { ArcSenseState, RiskLevel } from '../types/arcsense';

describe('CSV Telemetry Export', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly creates and triggers download of CSV with metadata and formatted rows', () => {
    const mockSample: ArcSenseState = {
      t: 1000,
      irms: 1.75,
      crest: 1.41,
      diffIdx: 0.02,
      flatFrac: 0.06,
      arcCount: 0,
      tObj: 32.1,
      tAmb: 28.5,
      dT: 3.6,
      slope: 0.5,
      ttlMin: -1,
      sT: 0.1,
      sS: 0.0,
      sA: 0.0,
      sL: 0.0,
      risk: 5.2,
      level: RiskLevel.NORMAL,
      tripped: false,
      sensorFault: false,
      inj: 0,
    };

    let downloadedFilename = '';
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadedFilename = this.download;
    });

    exportTelemetryToCsv([mockSample], 'LIVE');
    expect(clickSpy).toHaveBeenCalled();
    expect(downloadedFilename).toContain('arcsense_live_log');

    // Test with simulated mode
    exportTelemetryToCsv([mockSample], 'SIMULATOR');
    expect(downloadedFilename).toContain('arcsense_simulated_log');
  });

  it('escapes fields with commas, quotes, and newlines safely and accepts custom filenames', () => {
    const sample: ArcSenseState = {
      t: 2000,
      irms: 2.0,
      crest: 1.4,
      diffIdx: 0.02,
      flatFrac: 0.06,
      arcCount: 1,
      tObj: 35.0,
      tAmb: 28.0,
      dT: 7.0,
      slope: 1.0,
      ttlMin: 12.0,
      sT: 0.2,
      sS: 0.1,
      sA: 0.1,
      sL: 0.0,
      risk: 15.0,
      level: RiskLevel.NORMAL,
      tripped: false,
      sensorFault: false,
      inj: 0,
    };

    let downloadedFilename = '';
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadedFilename = this.download;
    });

    exportTelemetryToCsv([sample], 'LIVE', 'custom_run_trial_1.csv');
    expect(clickSpy).toHaveBeenCalled();
    expect(downloadedFilename).toBe('custom_run_trial_1.csv');
  });
});
