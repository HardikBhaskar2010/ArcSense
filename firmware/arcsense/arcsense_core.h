// arcsense_core.h
// ArcSense - hardware-independent detection and risk logic.
// No Arduino/ESP32 calls in here, so the same file runs on the ESP32 and is
// unit-tested on a PC (see firmware/test/test_core.cpp).
//
// Pipeline:  samples (A) -> CycleAnalyzer -> per-cycle features
//            per-cycle features + temperature -> RiskEngine -> risk 0..100, level, trip
#pragma once
#include <stdint.h>
#include <math.h>
#include <string.h>

namespace arcsense {

constexpr int SAMPLE_RATE_HZ = 5000;                 // current sampling rate
constexpr int MAINS_HZ       = 50;                   // India
constexpr int NOMINAL_PERIOD = SAMPLE_RATE_HZ / MAINS_HZ;  // 100 samples per cycle
constexpr int SPC            = 96;                   // samples analysed per cycle
constexpr int RAW_LEN        = 110;                  // raw capture buffer
constexpr int ARC_WINDOW     = 50;                   // cycles in the arc counter (~1 s)

inline float clamp01(float x) { return x < 0.f ? 0.f : (x > 1.f ? 1.f : x); }

// ---------------------------------------------------------------------------
// 1. Per-cycle features
// ---------------------------------------------------------------------------
struct CycleFeatures {
  float irms     = 0;   // A, RMS over one full mains period
  float peak     = 0;   // A
  float crest    = 0;   // peak / rms  (sine = 1.414)
  float diffIdx  = 0;   // cycle-to-cycle waveform difference: 0 = identical cycles
  float flatFrac = 0;   // share of samples close to zero (dead-band / shoulders)
  bool  valid    = false;  // diffIdx is meaningful (a previous cycle existed)
};

// Finds rising zero-crossings, resamples each cycle onto a fixed 96-point grid
// (linear interpolation, so timing jitter does not look like distortion) and
// compares it with the previous cycle.
//
//   diffIdx = sum |c[j] - p[j]|  /  sum |c[j]|
//
// Healthy loads (incl. dimmers, SMPS, motors) repeat almost exactly every
// cycle -> diffIdx ~ 0.  An arcing connection starts/stops at random points,
// so consecutive cycles differ -> diffIdx jumps.
class CycleAnalyzer {
 public:
  explicit CycleAnalyzer(float minHystA = 0.05f) : minHyst_(minHystA) { reset(); }

  void reset() {
    havePrev_ = capturing_ = armed_ = false;
    n_ = 0; last_ = 0; tc_ = 0; perN_ = 0; perSum2_ = 0; peakEst_ = 0;
    memset(cur_, 0, sizeof cur_);
    memset(prev_, 0, sizeof prev_);
  }

  // Feed one sample in amps (DC offset already removed).
  // Returns true when a cycle finished; `out` then holds its features.
  bool push(float x, CycleFeatures& out) {
    bool done = false;
    // Cycle start = rising crossing of a +level, but only after the signal was
    // below -level (armed). A level (not zero) is used so idle-zero noise from
    // dimmers/dead-bands can never move the alignment point.
    float lvl = fmaxf(minHyst_, 0.2f * peakEst_);
    if (x < -lvl) armed_ = true;
    bool cross = armed_ && last_ < lvl && x >= lvl;
    if (cross) {
      if (capturing_ && n_ >= SPC + 3) done = finish(out);
      armed_ = false;
      capturing_ = true;
      raw_[0] = last_; raw_[1] = x; n_ = 2;
      tc_ = (lvl - last_) / (x - last_);       // crossing position inside (0,1]
      perN_ = 1; perSum2_ = (double)x * x;
    } else {
      if (capturing_ && n_ < RAW_LEN) raw_[n_++] = x;
      if (perN_ < 1000000) { perN_++; perSum2_ += (double)x * x; }
    }
    if (perN_ > SAMPLE_RATE_HZ) havePrev_ = false;   // >1 s without a cycle: stale
    last_ = x;
    return done;
  }

  const float* lastCycle() const { return cur_; }   // SPC samples, amps

 private:
  bool finish(CycleFeatures& f) {
    float sumAbs = 0, pk = 0;
    for (int j = 0; j < SPC; j++) {
      float t = tc_ + (float)j;
      int   i = (int)t;
      float r = t - (float)i;
      float v = raw_[i] * (1.0f - r) + raw_[i + 1] * r;
      cur_[j] = v;
      sumAbs += fabsf(v);
      if (fabsf(v) > pk) pk = fabsf(v);
    }
    f.irms  = (float)sqrt(perSum2_ / (double)perN_);
    f.peak  = pk;
    f.crest = f.irms > 1e-4f ? pk / f.irms : 0.f;
    int flat = 0;
    float thr = 0.1f * pk;
    for (int j = 0; j < SPC; j++) if (fabsf(cur_[j]) < thr) flat++;
    f.flatFrac = (float)flat / SPC;

    bool restart = perN_ > NOMINAL_PERIOD * 5 / 2;   // long gap: load was off
    f.valid   = havePrev_ && !restart;
    f.diffIdx = 0;
    if (f.valid && sumAbs > 1e-4f) {
      float d = 0;
      for (int j = 0; j < SPC; j++) d += fabsf(cur_[j] - prev_[j]);
      f.diffIdx = d / sumAbs;
      if (perN_ > NOMINAL_PERIOD * 3 / 2)            // a whole half-cycle vanished
        f.diffIdx = fmaxf(f.diffIdx, 0.5f);
    }
    memcpy(prev_, cur_, sizeof cur_);
    havePrev_ = true;
    peakEst_ = 0.7f * peakEst_ + 0.3f * pk;
    return true;
  }

  float  minHyst_;
  float  raw_[RAW_LEN];
  float  cur_[SPC], prev_[SPC];
  bool   havePrev_, capturing_, armed_;
  int    n_, perN_;
  float  last_, tc_, peakEst_;
  double perSum2_;
};

// ---------------------------------------------------------------------------
// 2. Thermal trend: least-squares slope of the last 30 one-second readings
// ---------------------------------------------------------------------------
class ThermalTrend {
 public:
  static constexpr int N = 30;
  ThermalTrend() { reset(); }
  void reset() { n_ = 0; head_ = 0; }
  void add(float tObj) { buf_[head_] = tObj; head_ = (head_ + 1) % N; if (n_ < N) n_++; }
  int  count() const { return n_; }
  // degC per minute
  float slopePerMin() const {
    if (n_ < 10) return 0.f;
    double sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (int k = 0; k < n_; k++) {
      int idx = (head_ - n_ + k + N) % N;
      double x = k, y = buf_[idx];
      sx += x; sy += y; sxx += x * x; sxy += x * y;
    }
    double den = n_ * sxx - sx * sx;
    if (fabs(den) < 1e-9) return 0.f;
    return (float)((n_ * sxy - sx * sy) / den * 60.0);
  }
 private:
  float buf_[N];
  int   n_, head_;
};

// ---------------------------------------------------------------------------
// 3. Risk engine: evidence fusion, level state machine, fail-safe trip
// ---------------------------------------------------------------------------
enum Level { NORMAL = 0, WATCH = 1, WARNING = 2, DANGER = 3 };

struct Config {
  float iRated      = 3.0f;    // A  rating of the monitored circuit (demo loop)
  float iMinArc     = 0.5f;    // A  below this, arc evidence is ignored (noise)
  float diffThresh  = 0.15f;   // diffIdx above this flags a cycle as "arc-like"
  float stepThresh  = 0.25f;   // relative rms jump = load switching, not arcing
  int   arcFull     = 10;      // flagged cycles per second = full arc score + hard DANGER
  float dTWarn      = 15.f;    // degC above ambient where thermal score starts
  float dTAlarm     = 35.f;    // degC above ambient = full thermal score
  float tAbsAlarm   = 75.f;    // absolute surface limit (PVC insulation is rated 70 C)
  float slopeFull   = 6.0f;    // degC/min giving full slope score
  float ttlHorizon  = 10.0f;   // min; below this the time-to-alarm score rises
  float wThermal = 0.9f, wSlope = 0.6f, wArc = 0.9f, wLoad = 0.5f;
  float lvl1 = 25, lvl2 = 50, lvl3 = 75, hyst = 5;
  uint32_t downHoldMs = 5000;  // must stay lower this long before stepping down
  uint32_t tripHoldMs = 1000;  // DANGER must persist this long to latch a trip
};

struct State {
  float irms = 0, crest = 0, diffIdx = 0, flatFrac = 0;
  int   arcCount = 0;                 // flagged cycles in the last ~1 s
  float tObj = 0, tAmb = 0, dT = 0, slope = 0;
  float ttlMin = -1;                  // minutes to alarm temperature, -1 = not heating
  float sThermal = 0, sSlope = 0, sArc = 0, sLoad = 0;
  float risk = 0;                     // 0..100
  Level level = NORMAL;
  bool  tripped = false;
  bool  sensorFault = false;
};

class RiskEngine {
 public:
  explicit RiskEngine(const Config& c = Config()) : cfg_(c) { reset(); }
  const Config& config() const { return cfg_; }
  void setConfig(const Config& c) { cfg_ = c; }

  void reset() {
    st_ = State();
    memset(win_, 0, sizeof win_);
    winPos_ = 0; winSum_ = 0; holdoff_ = 0; prevIrms_ = 0;
    haveCycle_ = haveThermal_ = false; lastCycleMs_ = 0;
    lowing_ = dangering_ = false; lowSince_ = dangerSince_ = 0;
    trend_.reset();
  }

  // A tripped circuit stays open until a person resets it.
  void clearTrip() {
    st_.tripped = false; st_.level = NORMAL;
    lowing_ = dangering_ = false;
    memset(win_, 0, sizeof win_); winSum_ = 0;
  }

  void setSensorFault(bool f) { st_.sensorFault = f; }

  // call for every finished mains cycle
  void onCycle(const CycleFeatures& f, uint32_t nowMs) {
    haveCycle_ = true; lastCycleMs_ = nowMs;
    bool flag = false;
    if (f.valid) {
      float rel = prevIrms_ > 0.05f ? fabsf(f.irms - prevIrms_) / prevIrms_ : 1.f;
      if (rel > cfg_.stepThresh) holdoff_ = 3;      // load switched on/off: ignore 3 cycles
      flag = (f.diffIdx > cfg_.diffThresh) && (f.irms >= cfg_.iMinArc) && holdoff_ == 0;
      if (holdoff_ > 0) holdoff_--;
    }
    winSum_ -= win_[winPos_];
    win_[winPos_] = flag ? 1 : 0;
    winSum_ += win_[winPos_];
    winPos_ = (winPos_ + 1) % ARC_WINDOW;
    prevIrms_ = f.irms;
    st_.irms = f.irms; st_.crest = f.crest; st_.diffIdx = f.diffIdx; st_.flatFrac = f.flatFrac;
  }

  // call once per second with the temperatures
  void onThermal(float tObj, float tAmb) {
    haveThermal_ = true;
    st_.tObj = tObj; st_.tAmb = tAmb; st_.dT = tObj - tAmb;
    trend_.add(tObj);
    st_.slope = trend_.slopePerMin();
  }

  // call at ~10 Hz
  void step(uint32_t nowMs) {
    if (haveCycle_ && nowMs - lastCycleMs_ > 500) {       // current went away
      haveCycle_ = false; memset(win_, 0, sizeof win_); winSum_ = 0;
      st_.irms = st_.crest = st_.diffIdx = st_.flatFrac = 0; prevIrms_ = 0;
    }
    st_.arcCount = winSum_;

    // time to alarm temperature
    float alarmT = haveThermal_ ? fminf(cfg_.tAbsAlarm, st_.tAmb + cfg_.dTAlarm) : 0;
    st_.ttlMin = -1;
    if (haveThermal_) {
      if (st_.tObj >= alarmT) st_.ttlMin = 0;
      else if (st_.slope > 0.3f) st_.ttlMin = (alarmT - st_.tObj) / st_.slope;
    }

    // evidence scores 0..1
    st_.sThermal = haveThermal_ ? clamp01((st_.dT - cfg_.dTWarn) / (cfg_.dTAlarm - cfg_.dTWarn)) : 0;
    float sl = clamp01(st_.slope / cfg_.slopeFull);
    float tt = st_.ttlMin >= 0 ? clamp01(1.f - st_.ttlMin / cfg_.ttlHorizon) : 0;
    st_.sSlope = (haveThermal_ && st_.dT > 5.f) ? fmaxf(sl, tt) : 0;
    st_.sArc   = clamp01((float)(st_.arcCount - 1) / (float)(cfg_.arcFull - 1));
    st_.sLoad  = clamp01((st_.irms / cfg_.iRated - 0.9f) / 0.3f);   // 90% of rating = 0, 120% = 1

    // noisy-OR: independent evidence combines, any strong one can dominate
    float ok = (1.f - cfg_.wThermal * st_.sThermal) * (1.f - cfg_.wSlope * st_.sSlope) *
               (1.f - cfg_.wArc * st_.sArc)         * (1.f - cfg_.wLoad * st_.sLoad);
    float R = 100.f * (1.f - ok);
    bool hard = (st_.arcCount >= cfg_.arcFull) || (haveThermal_ && st_.tObj >= cfg_.tAbsAlarm);
    if (hard) R = fmaxf(R, 90.f);
    st_.risk = R;

    if (st_.tripped) { st_.level = DANGER; return; }       // latched until reset

    Level target = R >= cfg_.lvl3 ? DANGER : R >= cfg_.lvl2 ? WARNING : R >= cfg_.lvl1 ? WATCH : NORMAL;
    if (target >= st_.level) { st_.level = target; lowing_ = false; }
    else {                                                  // step down slowly (hysteresis)
      float thr = (st_.level == DANGER ? cfg_.lvl3 : st_.level == WARNING ? cfg_.lvl2 : cfg_.lvl1) - cfg_.hyst;
      if (R < thr) {
        if (!lowing_) { lowing_ = true; lowSince_ = nowMs; }
        if (nowMs - lowSince_ >= cfg_.downHoldMs) { st_.level = (Level)(st_.level - 1); lowing_ = false; }
      } else lowing_ = false;
    }

    if (st_.level == DANGER) {
      if (!dangering_) { dangering_ = true; dangerSince_ = nowMs; }
      if (nowMs - dangerSince_ >= cfg_.tripHoldMs) st_.tripped = true;
    } else dangering_ = false;

    if (st_.sensorFault) { st_.tripped = true; st_.level = DANGER; }   // fail-safe
  }

  const State& state() const { return st_; }

 private:
  Config  cfg_;
  State   st_;
  ThermalTrend trend_;
  uint8_t win_[ARC_WINDOW];
  int     winPos_, winSum_, holdoff_;
  float   prevIrms_;
  bool    haveCycle_, haveThermal_, lowing_, dangering_;
  uint32_t lastCycleMs_, lowSince_, dangerSince_;
};

}  // namespace arcsense
