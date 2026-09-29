# Singularity Forecaster

Probabilistic forecasting of four stages of technological institutional transition (T1–T4), built as a Bayesian particle filter over a single shared physics kernel. Runs entirely client-side; deployed on Cloudflare Pages.

**Live:** https://singularity-forecaster.pages.dev

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

T4 is gated on embodiment because civilisation cannot become fully dependent on a system that does not control matter. T3 (institutional) therefore fires well before T4 (institutional **and** physical) — a ~10 year lead in the default posterior.

### Current forecast status

With the bundled benchmark history, **T1 and T2 are already in the past** (medians −0.7y and −0.2y). The UI reports these as `уже достигнуто` / `already achieved` rather than as negative-year forecasts. T3 and T4 remain genuine forward-looking horizons.

## Architecture

```
index.html            SPA shell, Expert Sandbox UI
singularity-core.js   model: kernel, particle filter, Monte Carlo, charts
test/verify.js        headless verification suite (22 checks, no browser)
```

### Single physics kernel

The model previously carried **three independent ~200-line implementations** of the same dynamics: one for the particle-filter likelihood, one for the Monte-Carlo forecast, and one for the decomposition chart. They had drifted apart, so the Bayesian update calibrated parameters against a different physical model than the one that produced the answer.

There is now exactly one `stepDynamics()` function. `simulateToYear()` (likelihood), `runMonteCarloForecast()` (forecast), `runScenarioOverlay()` and `runDecomposition()` are thin wrappers that sample particles and collect statistics. This removed ~680 lines of duplicated physics.

### Reproducibility

All randomness flows through a seeded mulberry32 PRNG (`setSeed()` / `rnd()`); there is no `Math.random()` anywhere in the model. The likelihood path re-seeds per observation year so a particle's predicted capabilities are stable across repeated evaluations, while the forecast path explores the full shock distribution.

```js
setSeed(42);          // deterministic from here on
const t = new BayesianTracker(1000);
for (const obs of benchmarkHistory) t.observeRealData(obs.year, obs);
const mc = t.runMonteCarloForecast(3000);
```

### Likelihood

`observeRealData()` applies a proper product of Gaussian likelihoods with log-sum-exp normalisation. The product form matters: averaging the log-likelihood (rather than summing it) silently down-weights observation years that carry more benchmarks, which weakens the posterior update.

## Caveats

- Absolute probabilities are **not calibrated** in the frequentist sense. They are conditional on the prior, the noise model (`σ`), and the 15-point fallback dataset. Only relative comparisons across parameter settings are meaningful.
- The benchmark data is a **hardcoded fallback**. The configured remote JSON endpoint currently returns 404, so the app always runs on the embedded dataset (last point: 2026.44). The endpoint constant is at the top of `singularity-core.js`.
- The FLOPs observation channel is a deterministic function of Reasoning, so it cannot independently identify the hardware trajectory. It is retained for continuity but is largely redundant.
- Results are sensitive to `observationNoiseSigma`; conclusions about T3/T4 move as it changes.

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

Runs the model headless in a `vm` sandbox with DOM stubs and asserts 22 properties: PRNG determinism, likelihood stability, seed sensitivity, T4 gate reachability, T3/T4 separability, past-milestone handling, per-dimension ceilings, product-likelihood behaviour, hypothesis discrimination, and that all public methods return finite data.

## Data sources

LMSYS Chatbot Arena, SWE-bench Verified, ARC Prize reports, Epoch AI (training compute), plus robotics capability anchors for the embodiment axis.

## License

MIT
