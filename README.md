# Singularity Forecaster

Probabilistic forecasting of four stages of technological institutional transition (T1–T4), built as a Bayesian particle filter over a single shared physics kernel. Runs entirely client-side; deployed on Cloudflare Pages.

**Live:** https://munchausen.site/forecaster

## What the model does

Instead of extrapolating raw intelligence, the model treats the transition as an **epidemiology of delegation**: capability grows, but civilisation is only absorbed when humans *voluntarily delegate* to the system, and the system gains institutional "armour" as it becomes load-bearing.

**Latent axes** (log-diffusion, each with its own ceiling):
- `R` Reasoning, `A` Agency, `W` World Modeling, `E` Embodiment

**Sociotechnical layer** (the actual state variables of interest):
- `P` Persuasion, `DP` Delegation Pressure
- `IL` Institutional Legitimacy, `IC` Institutional Capture, `II` Institutional Immunity
- `DR` Dependency Ratio — civilizational dependence, combining institutional and physical control

**Milestones:**

| Stage | Condition | Meaning |
|-------|-----------|---------|
| T1 | `R ≥ t1` and `W ≥ 0.6·t1` | Cognitive dominance; usage becomes ritualistic |
| T2 | `DP > 0.5` and `IL > 0.3` | Autonomous legitimacy; mass delegation becomes profitable |
| T3 | `IC > 0.6` | Institutional capture; shutting the system down causes collapse |
| T4 | `DR > 0.9` and `E ≥ 6` | Civilizational dependency, including physical (atomic) control |

T4 is gated on embodiment because civilisation cannot become fully dependent on a system that does not control matter. T3 (institutional) therefore fires before T4 (institutional **and** physical). Under the default posterior the lead is about 5.5 years: T3 median 9.1y, T4 median 14.6y. The exact figures move with particle count and seed; the ordering does not.

### Current forecast status

With the bundled benchmark history, **T1 and T2 are already in the past**, so they carry no forecast information. Measured at `setSeed(3)`, 600 particles, 500 Monte Carlo runs, expert defaults:

| Stage | Median, years from present | Absolute year | Already reached | p10..p90 |
|-------|---------------------------|---------------|-----------------|----------|
| T1 | −1.17 | 2025.58 | 100.0% | −1.25 .. −1.17 |
| T2 | −0.33 | 2026.42 | 96.2% | −0.42 .. −0.17 |
| T3 | +9.08 | 2035.83 | 0.0% | +6.17 .. +14.67 |
| T4 | +14.58 | 2041.33 | 0.0% | +14.50 .. +15.58 |

Years are relative to the pinned present, 2026.75. T1 and T2 are reported as `уже достигнуто` / `already achieved` rather than as negative-year forecasts; T3 and T4 are the genuine forward-looking horizons.

T2's gate is not a constant, it is simply met early under the default calibration. Raising the institutional-legitimacy threshold from 0.3 to 0.6 moves its median to 2027.75 and drops the already-reached share to 0%; 0.8 moves it to 2029.25. A forecast panel showing P(T2) = 100% at its default cutoff is a tautology, not a finding — the panel reports P(T2 <= cutoff), so a stage already in the past always reads 100%.

## Architecture

```
index.html            SPA shell, Expert Sandbox UI
singularity-core.js   model: kernel, particle filter, Monte Carlo, charts
test/verify.js        headless verification suite (38 checks, no browser)
```

### Single physics kernel

The model previously carried **three independent ~200-line implementations** of the same dynamics: one for the particle-filter likelihood, one for the Monte-Carlo forecast, and one for the decomposition chart. They had drifted apart, so the Bayesian update calibrated parameters against a different physical model than the one that produced the answer.

There is now exactly one `stepDynamics()` function, and it also returns the per-step additive split of its own increment, so the decomposition chart reads the dynamics rather than reconstructing them from the shared state afterwards. `simulateToYear()` (likelihood), `runMonteCarloForecast()` (forecast), `runScenarioOverlay()` and `runDecomposition()` are thin wrappers that sample particles and collect statistics. This removed ~680 lines of duplicated physics.

### Reproducibility

All randomness flows through a seeded mulberry32 PRNG (`setSeed()` / `rnd()`); there is no `Math.random()` anywhere in the model. The likelihood path re-seeds per observation year so a particle's predicted capabilities are stable across repeated evaluations, while the forecast path explores the full shock distribution.

```js
setSeed(42);                                 // deterministic from here on
const t = new ParticleFilterTracker(1000);
for (const obs of FALLBACK_BENCHMARK_HISTORY) t.observeRealData(obs.year, obs);
const mc = t.runMonteCarloForecast(500);     // 500 = display trajectories; the stage histogram uses 3000

// FALLBACK_BENCHMARK_HISTORY is the engine's own export, and it is what the app
// ends up using at runtime because the remote endpoint 404s. There is no global
// named benchmarkHistory, so an example using one cannot run.
```

### Likelihood

`observeRealData()` applies a proper product of Gaussian likelihoods with log-sum-exp normalisation. The product form matters: averaging the log-likelihood (rather than summing it) silently down-weights observation years that carry more benchmarks, which weakens the posterior update.

## Caveats

- Absolute probabilities are **not calibrated** in the frequentist sense. They are conditional on the prior, the noise model (`σ`), and the 17-row fallback dataset. Only relative comparisons across parameter settings are meaningful.
- The benchmark data is a **hardcoded fallback**. The configured remote JSON endpoint currently returns 404, so the app always runs on the embedded dataset (17 rows, 2022.90 to 2026.72, last point Claude Opus 5.5). The endpoint constant is at the top of `singularity-core.js`.
- The FLOPs observation channel is a deterministic function of Reasoning, so it cannot independently identify the hardware trajectory. It is retained for continuity but is largely redundant.
- Results are sensitive to `observationNoiseSigma`; conclusions about T3/T4 move as it changes.
- **The world-model posterior is not identified, and the page says so.** Eight
  independent particle clouds at 1000 particles, with no reseeding, produced
  cascade shares of 1-97%, slow-takeoff 0-97% and resilient-civil 0-65% from the
  same 17 observations. `P(T3)` tracks that posterior directly: on one fixed seed
  it reads 96.7%, 20.8% and 92.5% at 1000, 2000 and 4000 particles. More particles
  do not converge it (the range goes 37.5 -> 25.0 -> 77.5 -> 18.3 points), so the
  four percentages are a single random draw and are labelled as such on the page.
  A bootstrap over particles would *understate* this, because it cannot see
  cloud-to-cloud variation; the honest measure is independent restarts.
  Consequence: T3 *timing* is usable at high particle counts (the median converges
  to a 0.83-year spread at 4000 particles, versus 5.17 years at 1000), while
  reach probabilities and scenario shares are not.
- The stage-history chart **is** an exact partition: the four bands sum to the total identically at every step, and the hardware band is not a remainder. The kernel forms its per-step increment as `dCompute = (hardware + algorithmic + paradigm multiplier + recursive RSI) × dt`, and the chart accumulates the split the kernel itself reports. Two things it does not explain: a paradigm shift also raises the ceilings `ceilingR` and `ceilingA`, so it lifts `R` through a path this chart shows as zero; and `R` saturates against its ceiling, so the accumulation grows nearly linearly while capability grows with slowing pace. Read the bands as shares of accumulation, not as rates of capability.

## Development

```bash
npm install
npm run dev          # wrangler pages dev
npm run deploy       # push to Cloudflare Pages
```

Auto-deploy: pushing to `main` triggers `.github/workflows/deploy.yml`, which needs a `CF_API_TOKEN` repository secret.

### Verification

```bash
node test/verify.js
```

Runs the model headless in a `vm` sandbox with DOM stubs and asserts 38 properties: PRNG determinism, likelihood stability, seed sensitivity, T4 gate reachability, T3/T4 separability, past-milestone handling, per-dimension ceilings, product-likelihood behaviour, hypothesis discrimination, and that all public methods return finite data.

## Data sources

LMSYS Chatbot Arena, SWE-bench Verified, ARC Prize reports, Epoch AI (training compute), plus robotics capability anchors for the embodiment axis.

## License

MIT
