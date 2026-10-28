// Host-side tests for arcsense_core.h using SYNTHETIC waveforms.
// Build:  g++ -std=c++17 -O2 -Wall -o test_core test_core.cpp && ./test_core
// These are simulations, not measurements. Real thresholds must be tuned on the rig.
#include "../arcsense/arcsense_core.h"
#include <cstdio>
#include <cstdlib>
#include <functional>
#include <random>
#include <string>
#include <vector>

using namespace arcsense;

static const double PI2 = 6.283185307179586;

struct Scenario {
  std::string name;
  bool        mustTrip;               // expected outcome
  double      seconds;
  std::function<float(double t, int k, std::mt19937& g)> current;   // amps
  std::function<float(double t)> tObj;                               // degC
};

struct Result { int maxArc = 0; float maxRisk = 0; Level maxLevel = NORMAL; bool tripped = false; double tripT = -1; double firstT[4] = {0, -1, -1, -1}; float tAtTrip = 0; float ttlAtWarn = -1; };

static Result run(const Scenario& sc) {
  std::mt19937 g(12345);
  CycleAnalyzer an;
  RiskEngine eng;
  Result r;
  int total = (int)(sc.seconds * SAMPLE_RATE_HZ);
  for (int k = 0; k < total; k++) {
    double t = (double)k / SAMPLE_RATE_HZ;
    uint32_t ms = (uint32_t)(t * 1000.0);
    float x = eng.state().tripped ? 0.f : sc.current(t, k, g);   // trip opens the circuit
    CycleFeatures f;
    if (an.push(x, f)) eng.onCycle(f, ms);
    if (k % SAMPLE_RATE_HZ == 0) eng.onThermal(sc.tObj(t), 30.f);   // 1 Hz
    if (k % (SAMPLE_RATE_HZ / 10) == 0) {
      eng.step(ms);
      const State& s = eng.state();
      if (s.arcCount > r.maxArc) r.maxArc = s.arcCount;
      if (s.risk > r.maxRisk) r.maxRisk = s.risk;
      if (s.level > r.maxLevel) r.maxLevel = s.level;
      if (r.firstT[s.level] < 0) { r.firstT[s.level] = t; if (s.level == WARNING) r.ttlAtWarn = s.ttlMin; }
      if (s.tripped && !r.tripped) { r.tripped = true; r.tripT = t; r.tAtTrip = s.tObj; }
    }
  }
  return r;
}

// ---- waveform helpers -----------------------------------------------------
static float gauss(std::mt19937& g, float s) { return std::normal_distribution<float>(0.f, s)(g); }
static float sine(double t, double f, double amp) { return (float)(amp * sin(PI2 * f * t)); }
static float noThermal(double) { return 32.f; }

// phase-cut dimmer: conducts only after `cutDeg` in each half cycle
static float dimmer(double t, double cutDeg, double amp) {
  double ph = fmod(t * 50.0, 1.0) * 360.0;
  double h  = fmod(ph, 180.0);
  return h < cutDeg ? 0.f : (float)(amp * sin(PI2 * 50.0 * t));
}

// fault injector: random dropouts (MOSFET AC switch chopping the load current)
struct Chopper { int left = 0; };
static float chopped(Chopper& c, std::mt19937& g, float x) {
  if (c.left > 0) { c.left--; return 0.f; }
  if (std::uniform_real_distribution<float>(0, 1)(g) < 0.01f) {
    c.left = 3 + (int)(std::uniform_real_distribution<float>(0, 1)(g) * 17);
    return 0.f;
  }
  return x;
}

// physical-style series arc: random arc-voltage dead-band per half-cycle plus HF noise bursts
struct ArcModel { int lastHalf = -1; float va = 0; };
static float arcWave(ArcModel& m, std::mt19937& g, double t, double amp) {
  double s = sin(PI2 * 50.0 * t);
  int half = (int)floor(t * 100.0);
  if (half != m.lastHalf) {
    m.lastHalf = half;
    m.va = std::uniform_real_distribution<float>(0, 1)(g) < 0.7f ? std::uniform_real_distribution<float>(0.05f, 0.4f)(g) : 0.f;
  }
  double a = fabs(s), v = a > m.va ? (a - m.va) / (1.0 - m.va) : 0.0;
  float x = (float)(amp * (s < 0 ? -v : v));
  if (std::uniform_real_distribution<float>(0, 1)(g) < 0.3f) x += gauss(g, 0.3f);
  return x;
}

int main() {
  std::vector<Scenario> sc;
  const double A2 = 2.0 * 1.41421356;   // 2 A rms

  // ---- must NOT trip (false-alarm tests) ---------------------------------
  sc.push_back({"clean 2A + sensor noise 0.03A", false, 60, [=](double t, int, std::mt19937& g) { return sine(t, 50, A2) + gauss(g, 0.03f); }, noThermal});
  sc.push_back({"cheap noisy sensor 0.08A",       false, 60, [=](double t, int, std::mt19937& g) { return sine(t, 50, A2) + gauss(g, 0.08f); }, noThermal});
  sc.push_back({"dimmer cut at 90 deg",           false, 60, [=](double t, int, std::mt19937& g) { return dimmer(t, 90, A2) + gauss(g, 0.03f); }, noThermal});
  sc.push_back({"dimmer cut at 120 deg",          false, 60, [=](double t, int, std::mt19937& g) { return dimmer(t, 120, A2) + gauss(g, 0.03f); }, noThermal});
  sc.push_back({"mains drifts 49.6 -> 50.4 Hz",   false, 60, [=](double t, int, std::mt19937& g) {
      static double ph = 0, last = 0; double f = 49.6 + 0.8 * t / 60.0;
      ph += PI2 * f * (t - last); last = t; if (t < 1e-9) { ph = 0; last = 0; }
      return (float)(A2 * sin(ph)) + gauss(g, 0.03f); }, noThermal});
  sc.push_back({"load switch-on 0->2A, then 2->3A", false, 40, [=](double t, int, std::mt19937& g) {
      double a = t < 5 ? 0.0 : (t < 20 ? A2 : 3.0 * 1.41421356);
      return sine(t, 50, a) + gauss(g, 0.03f); }, noThermal});
  sc.push_back({"inrush 8A decaying to 2A (0.2 s)",  false, 30, [=](double t, int, std::mt19937& g) {
      double a = t < 5 ? 0.0 : 2.0 + 6.0 * exp(-(t - 5) / 0.2);
      return sine(t, 50, a * 1.41421356) + gauss(g, 0.03f); }, noThermal});
  sc.push_back({"normal warm-up 30 -> 48 C (tau 200 s)", false, 600, [=](double t, int, std::mt19937& g) { return sine(t, 50, A2) + gauss(g, 0.03f); },
      [](double t) { return (float)(30 + 18 * (1 - exp(-t / 200.0))); }});

  // ---- must trip (detection tests) ---------------------------------------
  Chopper ch;
  sc.push_back({"FAULT injector: random dropouts from t=5s", true, 30, [&ch, A2](double t, int, std::mt19937& g) {
      float x = sine(t, 50, A2) + gauss(g, 0.03f); return t < 5 ? x : chopped(ch, g, x); }, noThermal});
  ArcModel am;
  sc.push_back({"FAULT series-arc model from t=5s", true, 30, [&am, A2](double t, int, std::mt19937& g) {
      return t < 5 ? sine(t, 50, A2) + gauss(g, 0.03f) : arcWave(am, g, t, A2) + gauss(g, 0.03f); }, noThermal});
  sc.push_back({"FAULT hot joint: 30 -> 90 C, tau 60 s", true, 300, [=](double t, int, std::mt19937& g) { return sine(t, 50, A2) + gauss(g, 0.03f); },
      [](double t) { return t < 5 ? 32.f : (float)(32 + 70 * (1 - exp(-(t - 5) / 60.0))); }});
  sc.push_back({"FAULT overload 3.0A -> 4.2A + heat", true, 300, [=](double t, int, std::mt19937& g) {
      return sine(t, 50, (t < 5 ? 3.0 : 4.2) * 1.41421356) + gauss(g, 0.03f); },
      [](double t) { return t < 5 ? 32.f : (float)(32 + 55 * (1 - exp(-(t - 5) / 90.0))); }});

  printf("%-46s %-9s %7s %8s %-8s %-8s %s\n", "scenario", "expect", "maxArc", "maxRisk", "maxLevel", "tripped", "t_trip");
  const char* LV[] = {"NORMAL", "WATCH", "WARNING", "DANGER"};
  int fails = 0;
  for (auto& s : sc) {
    Result r = run(s);
    bool ok = (r.tripped == s.mustTrip);
    if (!ok) fails++;
    char tt[32] = "-";
    if (r.tripped) snprintf(tt, sizeof tt, "%.1fs", r.tripT);
    printf("%-46s %-9s %7d %8.0f %-8s %-8s %-7s %s\n", s.name.c_str(), s.mustTrip ? "TRIP" : "no trip",
           r.maxArc, r.maxRisk, LV[r.maxLevel], r.tripped ? "YES" : "no", tt, ok ? "PASS" : "FAIL");
    if (s.mustTrip) printf("    first WATCH %.1fs | WARNING %.1fs (ttl %.1f min) | DANGER %.1fs | object temp at trip %.0f C\n",
           r.firstT[1], r.firstT[2], r.ttlAtWarn, r.firstT[3], r.tAtTrip);
  }
  printf("\n%d scenario(s) failed\n", fails);
  return fails ? 1 : 0;
}
