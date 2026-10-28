import { ArcSenseState, FaultMode, RiskLevel } from '../types/arcsense';

export class ArcSenseSimulator {
  private tObj = 31.0;
  private tAmb = 28.5;
  private irms = 1.85;
  private arcCount = 0;
  private diffIdx = 0.02;
  private crest = 1.414;
  private flatFrac = 0.06;
  private slope = 0.0;
  private level: RiskLevel = RiskLevel.NORMAL;
  private tripped = false;
  private dangerTicks = 0;
  private lowTicks = 0;
  private tHist: number[] = [];
  private mode: FaultMode = 0;
  private arcTicks = 0;
  private t0 = Date.now();

  private readonly CFG = {
    iRated: 3.0,
    dTWarn: 15.0,
    dTAlarm: 35.0,
    tAbs: 75.0,
    slopeFull: 6.0,
    ttlH: 10.0,
    arcFull: 10,
    wT: 0.9,
    wS: 0.6,
    wA: 0.9,
    wL: 0.5,
    l1: 25,
    l2: 50,
    l3: 75,
  };

  public setMode(m: FaultMode) {
    this.mode = m;
    if (m !== 1) {
      this.arcTicks = 0;
    }
  }

  public getMode(): FaultMode {
    return this.mode;
  }

  public reset() {
    this.mode = 0;
    this.tripped = false;
    this.level = RiskLevel.NORMAL;
    this.arcTicks = 0;
    this.dangerTicks = 0;
    this.lowTicks = 0;
  }

  /**
   * Advance simulation by dt seconds (default 0.5s)
   */
  public tick(dt = 0.5): ArcSenseState {
    const m = this.mode;
    const tr = this.tripped;

    let targetTemp = this.tAmb + 5.5;
    let tau = 25.0;
    let baseIrms = 1.85;
    let diff = 0.018 + Math.random() * 0.012;
    let arc = 0;

    if (m === 3) {
      // Bad joint heating
      targetTemp = this.tAmb + 68.0;
      tau = 28.0;
      baseIrms = 2.1;
    } else if (m === 1) {
      // Arcing contact (random dropouts)
      targetTemp = this.tAmb + 9.0;
      diff = 0.19 + Math.random() * 0.22;
      this.arcTicks++;
      arc = Math.min(13, 1 + this.arcTicks * 2 + Math.floor(Math.random() * 2));
      baseIrms = 1.85 + (Math.random() - 0.5) * 0.4;
    } else if (m === 2) {
      // Overload (second bulb engaged)
      targetTemp = this.tAmb + 36.0;
      tau = 38.0;
      baseIrms = 3.85;
    }

    if (tr) {
      // Tripped state: circuit open, no current, cooling down
      targetTemp = this.tAmb + 1.5;
      tau = 40.0;
      baseIrms = 0.0;
      diff = 0.0;
      arc = 0;
    }

    // Thermal simulation
    this.tObj += (targetTemp - this.tObj) * (1 - Math.exp(-dt / tau)) + (Math.random() - 0.5) * 0.08;
    this.irms = baseIrms ? baseIrms + (Math.random() - 0.5) * 0.03 : 0;
    this.diffIdx = diff;
    this.arcCount = arc;
    this.crest = baseIrms ? (m === 1 ? 1.85 + Math.random() * 0.45 : 1.414 + (Math.random() - 0.5) * 0.04) : 0;
    this.flatFrac = baseIrms ? (m === 1 ? 0.18 + Math.random() * 0.15 : 0.062) : 0;

    // Rolling temperature history for slope estimation (30 points)
    this.tHist.push(this.tObj);
    if (this.tHist.length > 30) {
      this.tHist.shift();
    }
    this.slope = this.calculateSlope(this.tHist, dt);

    // Compute evidence and risk using identical math to arcsense_core.h
    const dT = this.tObj - this.tAmb;
    const alarmT = Math.min(this.CFG.tAbs, this.tAmb + this.CFG.dTAlarm);
    const ttlMin = this.tObj >= alarmT ? 0 : this.slope > 0.3 ? (alarmT - this.tObj) / this.slope : -1;

    const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

    const sT = clamp01((dT - this.CFG.dTWarn) / (this.CFG.dTAlarm - this.CFG.dTWarn));
    const sl = clamp01(this.slope / this.CFG.slopeFull);
    const tt = ttlMin >= 0 ? clamp01(1 - ttlMin / this.CFG.ttlH) : 0;
    const sS = dT > 5.0 ? Math.max(sl, tt) : 0;
    const sA = clamp01((this.arcCount - 1) / (this.CFG.arcFull - 1));
    const sL = clamp01((this.irms / this.CFG.iRated - 0.9) / 0.3);

    // Noisy-OR fusion
    let risk =
      100 *
      (1 -
        (1 - this.CFG.wT * sT) *
          (1 - this.CFG.wS * sS) *
          (1 - this.CFG.wA * sA) *
          (1 - this.CFG.wL * sL));

    if (this.arcCount >= this.CFG.arcFull || this.tObj >= this.CFG.tAbs) {
      risk = Math.max(risk, 90.0);
    }

    // State machine for Level & Trip
    if (!this.tripped) {
      const targetLevel: RiskLevel =
        risk >= this.CFG.l3
          ? RiskLevel.DANGER
          : risk >= this.CFG.l2
            ? RiskLevel.WARNING
            : risk >= this.CFG.l1
              ? RiskLevel.WATCH
              : RiskLevel.NORMAL;

      if (targetLevel >= this.level) {
        this.level = targetLevel;
        this.lowTicks = 0;
      } else {
        const threshold = [0, this.CFG.l1, this.CFG.l2, this.CFG.l3][this.level] - 5;
        if (risk < threshold) {
          if (++this.lowTicks >= 10) {
            this.level = (this.level - 1) as RiskLevel;
            this.lowTicks = 0;
          }
        } else {
          this.lowTicks = 0;
        }
      }

      // 1-second DANGER hold triggers trip (2 ticks at 0.5s = 1s)
      if (this.level === RiskLevel.DANGER) {
        if (++this.dangerTicks >= 2) {
          this.tripped = true;
        }
      } else {
        this.dangerTicks = 0;
      }
    } else {
      this.level = RiskLevel.DANGER;
    }

    return {
      t: Date.now() - this.t0,
      irms: this.irms,
      crest: this.crest,
      diffIdx: this.diffIdx,
      flatFrac: this.flatFrac,
      arcCount: this.arcCount,
      tObj: this.tObj,
      tAmb: this.tAmb,
      dT,
      slope: this.slope,
      ttlMin,
      sT,
      sS,
      sA,
      sL,
      risk,
      level: this.level,
      tripped: this.tripped,
      sensorFault: false,
      inj: this.mode,
    };
  }

  /**
   * Generate 96-sample waveform for one 50Hz mains cycle
   */
  public generateWaveform(): number[] {
    const SPC = 96;
    const peakAmps = this.irms * Math.SQRT2;
    const wave = new Array<number>(SPC).fill(0);

    if (peakAmps < 0.05) {
      return wave;
    }

    const isArc = this.mode === 1;
    let shoulderCut = [0, 0];
    if (isArc) {
      shoulderCut = [
        Math.random() < 0.7 ? 0.08 + Math.random() * 0.35 : 0,
        Math.random() < 0.7 ? 0.08 + Math.random() * 0.35 : 0,
      ];
    }

    for (let j = 0; j < SPC; j++) {
      // 50Hz mains at 5kHz = 100 samples nominal, resampled to 96 points
      const sine = Math.sin((2 * Math.PI * j) / 100.0);
      const half = sine < 0 ? 1 : 0;
      const absSine = Math.abs(sine);

      let val = absSine;
      if (isArc && shoulderCut[half] > 0) {
        val = Math.max(0, (absSine - shoulderCut[half]) / (1 - shoulderCut[half]));
      }

      const noise = (Math.random() - 0.5) * (isArc ? 0.45 : 0.04);
      wave[j] = peakAmps * (sine < 0 ? -val : val) + noise;
    }

    return wave;
  }

  private calculateSlope(hist: number[], dt: number): number {
    const n = hist.length;
    if (n < 10) return 0.0;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let k = 0; k < n; k++) {
      sx += k;
      sy += hist[k];
      sxx += k * k;
      sxy += k * hist[k];
    }
    const denom = n * sxx - sx * sx;
    if (Math.abs(denom) < 1e-9) return 0.0;
    // Slope in °C/min: slope_per_sample / dt * 60
    return ((n * sxy - sx * sy) / denom / dt) * 60.0;
  }
}
