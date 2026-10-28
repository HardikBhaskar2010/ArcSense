/**
 * ArcSense Control Room Audio Synthesizer
 * Uses Web Audio API oscillator synthesis.
 * 100% offline, zero external sound files required.
 */

class AudioAlertService {
  private ctx: AudioContext | null = null;
  private isUnlocked = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended' && this.isUnlocked) {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.isUnlocked = true;
    const ctx = this.getContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  /**
   * Play alert for WARNING risk transition
   */
  public playWarningBeep(): void {
    try {
      const ctx = this.getContext();
      if (!ctx || ctx.state === 'suspended') return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(554.37, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio autoplay policy or hardware muted
    }
  }

  /**
   * Play urgent alert when relay trips / DANGER occurs
   */
  public playTripAlarm(): void {
    try {
      const ctx = this.getContext();
      if (!ctx || ctx.state === 'suspended') return;

      // Two pulse chirps
      for (let i = 0; i < 2; i++) {
        const startTime = ctx.currentTime + i * 0.16;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, startTime);
        osc.frequency.setValueAtTime(659.25, startTime + 0.08);

        gain.gain.setValueAtTime(0.12, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.14);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.15);
      }
    } catch {
      // Audio policy
    }
  }

  /**
   * Play pleasant resolution chime on circuit reset
   */
  public playResetChime(): void {
    try {
      const ctx = this.getContext();
      if (!ctx || ctx.state === 'suspended') return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.23);
    } catch {
      // Audio policy
    }
  }
}

export const audioAlerts = new AudioAlertService();
