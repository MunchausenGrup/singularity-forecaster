# Forecaster: research findings and work plan

Status as of 2026-10-02. Written by the scientist profile before context
compression so nothing below is lost. **Do not start work from the prose in
this file's first section — start from the Work Plan, and re-measure anything
quoted here before trusting it.**

---

## 1. What is committed and live

### singularity-forecaster (branch `main`, NOT pushed)

| commit | content |
|--------|---------|
| `708d2ce` | T2 panel: stop reporting a tautology as a probability |
| `6bc1eea` | Label the world-model posterior as unidentified |
| `2d471a0` | Expose `worldModelRejuvenation` as a measurable knob (default 0.03) |

Later commits (2026-10-03): `d07701e` extract the per-particle log-likelihood
into `particleLogLik` (behaviour-preserving, verified against HEAD),
`6c9c11f` marginalise world_model, `80ac443` wire the panel to the
marginalised shares, `3344253` make marginalisation button-triggered.

Earlier session commits: `b4206d0 d9f03f3 317790e a9df5eb fbd8618 39cea2a
025a60a 69672ed bbca93f 9e10536 e4810a9 753144c f29409b`.

43/43 checks in `test/verify.js` pass.

**Deployed 2026-10-03.** All forecaster work from this session is live.

```
DEPLOY_OK etag=ce9cce604233349dc6963fe676f6cb929b9bae1dd7261b4be26a6c4829f4aa0e
gate CLEAN on 59 files, before and after build
live engine sha256 9711111cd5c5b6962dbecca54b3514dc == local (CRLF-normalised)
```

Verified present in the live engine: `marginalScenarioShares`, `effSupport`,
`btnScenarioCompute`, `postMarginalised`, `postProvisional`,
`MARGINAL_MAX_PARTICLES`, `particleLogLik`.

The Article 9.1 block was cleared by `moonsenchau` on task `t_bb73de2b` — five
codenames removed from `site/drafts_page.js` in three places. Verified
independently: gate CLEAN, and no persona codenames remain in the source.

---

## 2. Measured defects (re-verify before acting)

### 2.1 World-model shares are a random draw, not a measurement — ROOT CAUSE FOUND

`PATCH 7` at `singularity-core.js:1409-1423` re-draws 3% of particles'
`world_model` from the prior on every resampling step, **ignoring the
likelihood entirely**.

Eight independent particle clouds, 1000 particles, no reseeding, same 17
observations:

```
rejuvenation 3%   cascade   4   5   1  30  96  24  92  97 %   spread 95.8 pts
rejuvenation 0%   cascade   0   0   0   0   0   0   0   0 %   spread  0.0 pts
                    slow    100 100 100 100 100 100 100 100 %
```

So the likelihood *can* identify the scenario; the rejuvenation noise was
hiding it. Exposed as `EXPERT.worldModelRejuvenation`, **default deliberately
left at 0.03** — no model behaviour change without the user's decision.

### 2.2 Growth rates are still unidentified — separate, unfixed

Same measurement run:

```
algoMonths  5.38 9.04 8.88 2.90 6.22 4.17 7.60 6.66   spread 6.15  sd 2.03
hwMonths   11.27 7.57 8.40 6.38 6.13 6.80 4.93 10.05  spread 6.34  sd 1.98
```

At rejuvenation 0 it is *worse*: algoMonths spread 7.59, sd 2.47.
`algo_months` is a doubling time in months (`singularity-core.js:654`:
`algoK = ln(2) / max(1, algo_months/12)`) and has a hard floor
`Math.max(2.0, algoDraw)` at line 1238 — at seed 3, **25.3% of particles sit
on that floor**, so the displayed 2.67 months is partly a clamp artefact, not
an estimate. Seed spread 2.67 → 5.91 months means algorithmic efficiency
compounds anywhere from 4.1x/year to 22.6x/year.

### 2.3 Reaches are unreliable at any particle count

`P(T3)` on one fixed seed: 96.7% / 20.8% / 92.5% at 1000 / 2000 / 4000
particles. Seed range across 8 seeds at 1000 particles: 68.3–99.0%
(30.7 points). Not monotonic in N, so not Monte Carlo noise.
`runMonteCarloForecast` does **not** mutate the tracker (no `getSummary` field
moves) and non-reaching runs are honestly censored as `Infinity`.

By contrast **timing does converge**: T3 median spread 0.83 y at 4000
particles vs 5.17 y at 1000. The distribution is usable where the probability
is not.

### 2.4 T2 panel measured the slider

`pct = visW/totalW`, cutoff defaults to 2068 while the T2 median is 2026.4, so
every particle passes. Old figure was 99.4–100.0% at every cutoff, degenerate in
all 12 seed x cutoff combinations. Now also computes `pastW` (reached at or
before `PINNED_CURRENT_YEAR`, 97.0–98.6%, stable) and `reachW` (reached at
all), and dims the headline when degenerate. Threshold sliders do have teeth;
only the cutoff cannot discriminate.

### 2.5 Soft spot to check later

`slow_takeoff` wins unanimously once rejuvenation is off, and it has the
**lowest** ESS (367.7 vs cascade 781.7, resilient_civ 807.9) — i.e. the data
does discriminate hard inside it, so the unanimity is not vacuous. But ESS
measures concentration, not direction, so this is **not** a flexibility test.
Two attempts at an out-of-sample comparison failed: a hand-rolled scoring loop
diverged for all four scenarios (my field-name mapping was wrong), and the
replacement ESS-based check could not separate "found the right particles" from
"everything but the least-bad died". Void output from both — do not reuse.

---

## 3. Retractions — do not cite these

Measured before the seed-noise problem was understood; all are the same order
as the noise and none is established:

- "institutional veto lowers T3 reach from 98.7% to 83.0%"
- "GPT-6 Astra and Opus 5.5 shift T3 from 6.08 to 5.58 y"
- "prior sensitivity: T3 range 4.1–6.3 y (40%)"
- the whole one-at-a-time sensitivity sweep (non-monotonic in the parameter,
  e.g. `groundingRate` 0.35 → P(T3) 63.8% but 0.15 → 85.2%)

Also proposed and **measured false**, both in `2d471a0`'s message:

- `observationSigmaMode='perPoint'` is not a fix. Makes algoMonths worse
  (spread 9.07 vs 6.15, sd 2.83 vs 2.03); posterior spread stays ~97 points.
  It varies sigma by measurement noise per datum, not by how informative a
  datum is about the scenario.
- `BENCHMARK_SIGMAS` is correctly dimensioned per observable (arenaElo 40,
  arcAgi 8, flopsLog 0.5). The global mode does not mix incompatible units.

---

## 4. Evidence from the literature

Search tooling: `web_search`/`web_extract` gateway unreachable, Firecrawl 403,
DuckDuckGo and Mojeek captcha, Brave and searx need a browser, Bing returns
noise. **The arXiv API works** (`scripts` in the profile scratch dir:
`websearch.py`, `sweep_6mo.py`, `triage.py`). 355 unique papers in
2026-04-01..2026-10-02. Seven read in full; the load-bearing ones:

| paper | measurement | bearing |
|-------|-------------|---------|
| AutoDataBench 2609.35025 | no agent above **20/100** writing training tasks a pipeline accepts; author notes the data side still rests on human labour | grounds the `grounding*` channel; argues for keeping it low |
| KNOWS 2609.30604 | best frontier agent fully solves **<3%** of long-horizon tasks; visual-step failures make artefacts unusable | W axis is the binding constraint |
| VALVE 2609.32990 | +14.9–16.5 pts over 1000+ SWE tasks; validation gate cuts drawdown 75% | RSI works at harness/skill level |
| Sol-H3 2609.35110 | up to **30x** end-to-end speedup from a kernel-fusion search loop | concrete but scoped to inference |
| Video-RSI 2609.37950 | agent revises its own harness | again harness-level |
| Missing Boundary 2609.11024 | control loss **55–62%** only when degradation + opportunity co-occur; restoring the boundary gives **0%** | supports the institutional veto being threshold-shaped |
| Rethinking Circuit Eval 2609.35686 | circuits reproduce 97.3–99.5% of correct answers but only **11.4–41.7%** of errors | argues against our own confidence |

Common thread: RSI automates everything except **data and weights**; long
horizons fail on **vision**.

---

## 5. AI 2040 (Kokotajlo et al.) — source material

Landing page <https://ai-2040.com/>; supplement pages under
`/supplements/`. Cached text and HTML are in the profile scratch dir
(`ai2040.txt`, `takeoff.txt`, `cmp.txt`, `sheet_1821022003.csv`).

**Plan A is a recommendation, not a forecast** — the user has said explicitly
that our model must estimate the *most likely* path, so **Plan D is our
reference scenario, not Plan A.**

### 5.1 Timeline and key claims

- 2029 US/China deal; 2030 counterfactual without a deal (full AI R&D
  automation, superintelligence within the year); 2040 Plan A unpause.
- AC (Automated Coder) at **Jan 2030** on the default trajectory.
- "AI companies will probably succeed at building smarter-than-human AI
  systems within the next 1 to 10 years."
- Their earlier AI 2027 report had full AI R&D automation in **2027** — a
  **3-year slip**. 2027 scenario text: "They haven't succeeded yet; no
  recursive self-improvement so far"; "the strongest coding AIs refuse to help
  competitors with AI R&D"; Congress concludes "Probably not us" about
  retaining control.
- Their own caveat: parameters "sometimes adjusted ad-hoc as the scenario
  narrative and modeling were being written concurrently", and "we are very
  much not confident in our precise estimates." Treat as a rough anchor, not
  ground truth.

### 5.2 Plan D is the reference

Plan D = race at near-max speed, ≥1% of resources to safety.

```
plan            A      B      C+     C      D
AC->TED-AI    6 yrs  3 yrs  2 yrs  1.5y  1.02y
safety tax   2.8     1      0.75   0.46   0.02   OOMs
p(alignment) 72%    50%    45%    40%    25%
```

Minimum-length takeoff AC → TED-AI is "slightly less than a year".

**Bearing on us:** their AC is ~3.25 y away; our T3 median is 6.0 y. Their
AC→TED-AI is <1 y; our T3→T4 is ~9 y (partly definitional — their TED-AI is
cognitive expert-domination, our T4 requires embodiment). Neither metric is
identical to ours, so use as a scale check, not a target value.

### 5.3 Plan likelihood, five authors (from their Google Sheet)

```
author      A     B     C+    C     D    other
Eli         5%   15%   10%   20%   25%    25%
Daniel     15%   10%   20%   10%   30%    15%
Thomas      3%    8%    8%   12%   50%    19%
Romeo       8%   12%   18%   12%   30%    20%
Ryan        4%   12%   25%   14%   28%    18%
mean       7.0%  11.4%  16.2% 13.6% 32.6%  19.4%
```

Deliberate slowdown (A+B+C+C+) **48%**; no deliberate action (D+other) **52%**.
Overall `p(alignment)`: Eli 48, Daniel 32, Thomas 30, Romeo 38, Ryan 56 —
**mean 40.8%, range 30–56%**. We have no equivalent metric at all.

### 5.4 Their model construction, two items that are ours to fix

1. **Retroactive software efficiency.** They replaced `E(t) = C(t)·S(t)` with
   `E'(t) = T(t)·S(t)` because the old form "assumes today's software
   efficiency applies retroactively to the training run for the model already
   in use" and therefore "slightly overestimating how fast takeoff can
   proceed." **Our model does exactly this** — `algoK` enters the accumulated
   capability sum, so it is applied to the past. **Agreed with the user to fix
   this; it is Work Plan item 2.**
2. **Units.** They work in "2025-effective-flop-growth", a dimensionless
   normalised unit that makes growth rates comparable. We mix months-of-doubling
   against percentages against Elo against log-FLOP, which is part of why
   `algo_months` and `hw_months` cannot be reconciled.

### 5.5 What they have that we lack (candidates, NOT a copy list)

- **Safety tax** — the consortium deliberately *not* using the best algorithms
  to make control easier. In our model a paradigm discovery is unconditionally
  a booster (`baseShiftMultiplier 3`, `paradigmDecayRate 0.5`); a governed
  slowdown has no path that *raises* the algorithm multiplier. Sign asymmetry.
- **Taste** as a channel separate from capability ("3.5 SDs per 2025-effective-
  flop-growth"). We cannot slow progress without slowing improvement itself.
- **Median-to-top gap** (5.28x taste multiplier, 1.5 human jumps above SAR).
- **Internal vs external deployment.** Their claim: takeover risk concentrates
  internally because those are the RSI systems. We have no such axis.
- **`p(alignment)` as a metric.** Ours is a threshold, not a probability.

What we already have that they lack and that should raise our precision:

- `observationNoiseSigma = 1.5` is a hand-set blunt multiplier on all eight
  dimensions. **Fit it from residuals** instead and it stops being a silent
  knob that moves the forecast.
- The wide `algo_months` / `hw_months` priors mean the output is prior-dominated.
- `algoK`'s retroactive application (5.4.1).

---

## 5A. 2026-10-03 session: what was measured, what was retracted

### Fixed and measured

**`d07701e` — likelihood extraction.** `observeRealData`'s Gaussian body moved to
a module-level `particleLogLik(p, year, obs, cfg, sigmas)`. Pure move, verified
against HEAD across 3 conditioned clouds, 7 numeric summary fields each, zero
drift. Required before marginalisation, otherwise the two copies would diverge.

**`6c9c11f` — world_model marginalised.** `getSummary` had been reporting the
scenario split by summing weights over each particle's hard `world_model` label,
drawn once at construction and barely moved by the likelihood. Measured on four
400-particle clouds, same 17 observations:

```
cascade share, by hard label     98.3  99.5   2.0  98.0    spread 97.5 pts
cascade share, marginalised       0.4   0.4   0.0   0.5    spread 47.0 pts
```

The spread does not vanish; the data genuinely does not decide the scenario.
New `effSupport` diagnostic says so numerically: mean number of scenarios the
data leaves open per particle = **1.68 of 4** (1.0 = data pins it, 4.0 =
cannot tell them apart). This finally answers the open question from §2.5: the
unanimity on `slow_takeoff` is neither vacuous nor complete.

**Cost.** Four full trajectory re-simulations per particle, each to all 17
observation years. Measured **~20 s for 400 particles** — I first estimated
"4x the filtering", which was wrong by an order of magnitude because the filter
already integrates to all 17 years.

**`80ac443` — capped and cached.** `updateTrackerUI` fires on every slider move
and each move changes the weights, invalidating the cache. Capped at 150
particles on a fixed stride (`MARGINAL_MAX_PARTICLES`). Subsampled vs full on
the same data: cascade 38.1 vs 38.6, slow_takeoff 23.7 vs 22.7, effSupport 1.87
vs 1.88. Also fixed a real defect the probe caught and the tests did not: the
cache key ignored `maxParticles`, so asking for more particles silently returned
the smaller cached pass.

**`3344253` — button-triggered.** The panel shows the cheap hard-label split,
explicitly labelled provisional, and computes the fit-weighted split only on
press. This is the user's chosen option.

### Decided NOT to do, with reason

**E' = T·S — the defect it targets is absent here.** Kokotajlo's stated reason
for replacing `E = C·S`: the old form "applies today's software efficiency
retroactively to the training run for the model already in use", i.e. a
*multiplicative* re-application to already-accumulated compute. Checked in this
code: `stateR` is initialised to 0 (line 654) and only ever incremented
(`st.stateR += dCompute`, line 1057); `algoK` is used only as a *rate*
(lines 1034, 1049) and is never multiplied into `stateR`. So
`R(t) = ∫(hwK + algoK(s))ds` — a forward integral, already closer to the E'
spirit than to the form they abandoned. Changing it would introduce a bug to
treat a defect we do not have. Confirmed with the user.

What genuinely differs: their `S(t)` is a function of calendar time; our `algoK`
is a constant per particle that never changes over the 40-year horizon.

### Retracted today

- **"The demandDamping latch causes the backwards algo_months effect."** Wrong.
  With one base particle held fixed and only `algo_months` varied, across 5 base
  particles: spread 1.10x–2.10x with the latch, 1.15x–1.40x without, and
  monotonicity (fast >= mid >= slow) **0/5 in both cases**. The latch explains
  part of the spread but not the inversion.
- **"algo_months swings R by 4.31x."** That figure came from a confounded probe
  that built a fresh tracker per spec and took `particles[0]`, so the three
  cells differed in every drawn parameter. Real range is 1.10x–2.10x. The
  consequence: `algo_months` non-identifiability is a *smaller* problem than §2.2
  implies, not a larger one.
- Two general lessons from today: hold every parameter fixed except the one under
  test, and never report n=1 per cell as a result.

### Open: the data wall is a coin flip

`singularity-core.js:937`:

```js
if (!st.dataExhaustionHit && year > 2026.5 && rnd() < 0.15 * dt) st.dataExhaustionHit = true;
```

The trigger is a random draw, not a quantity of data consumed. Latched on
forever. Firing sets `talentBottleneck` from 1.5 to 0.4 (line 1023) and halves
`algoK` via `dataWallPenalty` 0.5 (line 1035). Measured on 400 particles sharing
one base:

```
never fired         1 / 400
p05 4.08   p25 5.58   median 8.33   p75 13.17   p95 23.58
earliest 3.67   latest 37.58
```

So it fires almost always, and the firing year spans **34 years** while the term
it controls changes by 3.75x. A random component of that size, entering at an
arbitrary point in the horizon, is noise rather than modelling — and is a
plausible contributor to the seed-to-seed spread from the very first session.

**Direction RESOLVED 2026-10-03 — the wall always hurts.** Measured with the
random trigger disabled in an in-memory copy so the arms are actually
controlled; the earlier "unresolved" note was measurement error (different base
particles per arm, and the built-in trigger firing regardless of the arm set).

Mechanism: `talentBottleneck` enters `Math.min` as a **cap on hardware growth**
(line 1025-1027), not on algorithmic growth. Firing drops that cap 1.5 -> 0.4.
Coherent in substance — with data exhausted, buying more GPUs is pointless.

```
ratio (wall from the start) / (no wall at all), per base particle:
0.80x   0.23x   0.38x   0.30x        mean R 9.52 -> 4.04, i.e. -58%
```

Timing is NOT resolvable: the year sweep is non-monotonic and wildly noisy
within each row, because the other Bernoulli shocks are still live.

### The real structural finding

`stepDynamics` contains **seven independent stochastic triggers** (line 1430 is
the rejuvenation):

```
894  social tension shock          941  alignment incident
919  paradigm shift                957  GPU bubble burst
937  data wall                     968  state intervention
                                    987  winter (hype gap)
```

Several latch permanently and several carry large multiplicative effects (the
data wall alone is worth -58% of accumulated R). So the cloud-to-cloud spread
that has driven every unstable number in this document is the **sum of seven
Bernoulli draws per particle**, not a property of the data. This reframes Item 0:
the problem is not one coin flip, it is that the model's variance is dominated
by uncontrolled draws rather than by the likelihood.

Before touching any of them, decide which are meant to be stochastic at all.
A shock that represents a real-world contingent event (a bubble bursting, an
alignment incident) arguably should be. A paradigm shift and a data wall are
trend statements, not coin flips.
line 1026; where it lands and whether it acts as a multiplier or a denominator
was not traced. Do not assume the sign.

**Attempted and reverted 2026-10-03.** Replaced the per-step coin flip with a
single per-particle `dataWallYear` drawn at construction (config knob
`EXPERT.dataWallYearRange`, default [2027, 2063] chosen to match the old measured
median and spread), carried into the sim state and compared against `year`. The
mechanism is the intended one, but it broke a real test — "T3 and T4 diverge for
at least one hypothesis — T3 is not a perfect proxy of T4" went red. The change
alters shock timing enough to collapse the T3/T4 distinction in at least one
hypothesis. Not the same as the per-step draw being harmless; it means the coin
flip was entangled with something else in the shock chain. **Reverted rather than
papered over — do not retry without first understanding why T3 and T4 were
distinct.** Note the intermediate also revealed the sign of the data wall is still
unresolved (§ below).

**There is no data-volume series in the model** — checked: the only cumulative
quantity in `FALLBACK_BENCHMARK_HISTORY` is `trainingFlopsLog`, which is compute,
not training tokens. The i18n text calls this scenario "depletion of high-quality
tokens (Data Wall)" but nothing behind it is measured. So option 1 (drive it from
data) would require inventing an input series, which is worse than the coin flip.
Option 2 is the realistic path.

**Next action:** Either removes
randomness from the forecast. Check first whether the data series exists.

### Also measured: the horizon is mostly dead

Same base particle, `algo_months` varied, R after 40 simulated years:

```
spec                 y@99% ceiling   R@10   R@20   R@30   R@40   last-decade gain
fast  2.67 mo        never            4.79   6.29   6.95   7.01   0.060
mid   4.70 mo        never            3.42   3.45   3.46   3.48   0.014
slow  5.91 mo        28.3 yr          4.56  14.33  14.87  14.99   0.114
```

Gain over the final decade is under 1% of a ceiling of 15. Two of three never
approach the ceiling at all — the damping chain (`damping * nashDamping *
demandDamping`) cuts the exponential far more than a naive integral suggests, so
an earlier prediction of a 5-11 year ceiling hit was simply wrong.

Consequence: roughly 30 of the 40 horizon years produce almost nothing, and the
forecast there is set by the ceiling and the social variables. Either the horizon
is too long (truncating to ~25 years would triple compute speed and should not
change any number inside the 15 years we care about — measure, do not assume),
or the growth rates are too weak and the ceiling is doing the work that rates
should. **Calibrating timing while 30 years are flat means calibrating a
constant.**

---

## 5B. 2026-10-03, second pass: observationNoiseSigma is the binding constraint

A Metropolis move on `world_model` was implemented to replace the prior redraw
(it is the right mechanism and all the pieces exist -- `particleLogLik` at
:1211, and `marginalScenarioShares` already does exactly the
`Object.assign({}, p, {world_model})` + rescore call). **It accepts nothing.**
The result is identical to rejuvenation off: 100% slow_takeoff. Reverted, since
inert code that breaks a test is worse than no code. Tests back to 43/43.

That inertness is the finding. It means the likelihood is decisive, so the real
question is how decisive, and the answer is: entirely governed by
`observationNoiseSigma`, which is a hand-set 1.5.

Real path, Metropolis in place, only sigma varying (400 particles, seed 11):

```
sigma        hard_wall   cascade  slow_takeoff  resilient    P(T3)     P(T4)
  1.5            0.0%      0.0%      100.0%       0.0%     100.0%    100.0%
  3.0            0.0%     69.5%       19.0%      11.5%      79.0%     79.0%
  5.0            0.3%     75.8%       11.3%      12.8%      87.5%     87.5%
  8.0            5.0%     67.5%       12.8%      14.8%      73.8%     73.8%
 12.0            4.5%     69.3%       12.3%      14.0%      65.3%     65.0%
 20.0           18.8%     52.5%       12.8%      16.0%      50.8%     50.3%
```

At sigma=20 the composition is 52.5/18.8/12.8/16.0 -- essentially the prior, so
the likelihood has stopped informing. At sigma=1.5 it is so confident the
population collapses to a single scenario. The whole scenario posterior, and
P(T3) itself (100% -> 50.8%), live on this one knob.

**This corrects the previous section.** The claim "the 3% prior injection decides
the posterior" was too strong. The prior redraw was *masking* a collapse, and
the cascade-dominant posterior it produced is also what moderate sigma produces
with no injection at all (~70% cascade). The controllable variable is sigma;
rejuvenation only concealed that the data were being read as far more decisive
about the future than 2019-2026 benchmarks can justify.

**So Item 3 (fit `observationNoiseSigma` from residuals) is not a refinement --
it is the top priority, and it outranks the rejuvenation rewrite.** The
Metropolis move becomes live once sigma is fitted; until then it can only reject.
Task `t_e2c86063` carries the rejuvenation work, blocked on this.

## 6. Work plan, in order

### Item 0 — Tame the stochastic triggers — DECIDED, not started

**Criterion: is it a contingent event, or a trend statement?**

An event happens or not at the whim of circumstance, so randomness is legitimate
content. A trend happens *because* something grew, so its timing is determined
by model state and a coin flip is the wrong mechanism — it reports a draw where
the model can produce a date derived from its own state.

### The real defect: per-scenario forecasts do not exist in this model

Found 2026-10-03 while investigating the rejuvenation gate. Composition of the
population AFTER forecasting, when every particle was forced to the scenario
named on the left (400 particles, seed 11):

```
                       baseline                              gated
  forced as         hw     casc   slow   resil           hw     casc   slow   resil
  hard_wall       100.0%    0.0%   0.0%   0.0%       100.0%    0.0%   0.0%   0.0%
  cascade           1.0%   90.5%   0.5%   8.0%         0.0%   77.0%   0.0%  23.0%
  slow_takeoff      0.3%   75.3%   8.3%  16.3%         0.0%   32.8%   4.5%  62.8%
  resilient_civ     1.0%    3.5%   0.5%  95.0%         0.0%    0.5%   0.0%  99.5%
```

A run forced to `slow_takeoff` ends with **4-8% of its particles still in
`slow_takeoff`**; the rest have migrated, mostly to `cascade`. The gate made this
*worse*, not better, so the gate is not the fix and was reverted (43/43 restored).

### Mechanism resolved: rejuvenation is load-bearing, and it decides the posterior

Isolated with a 2x2 -- forced scenario, rejuvenation on and off:

```
forced slow_takeoff, rejuvenation ON   -> 0.3% hw, 75.3% cascade,  8.3% slow, 16.3% res
forced slow_takeoff, rejuvenation OFF  -> 100.0% slow_takeoff preserved exactly
forced cascade,     rejuvenation OFF  -> 100.0% cascade preserved exactly
```

So **rejuvenation alone causes the loss of a forced scenario.** Selection is
innocent: systematic resampling preserves composition at uniform weights, and
with the redraw off nothing drifts. My earlier attribution to selection was wrong.

Real path, no forced scenario, prior start:

```
                          hard_wall  cascade  slow_takeoff  resilient   P(T3)
before observations          18.8%     52.5%      12.8%       16.0%
rejuvenation OFF              0.0%      0.0%     100.0%        0.0%    100.0%
rejuvenation 3%              0.3%     76.3%      19.3%        4.3%     96.8%
```

Two consequences, and they pull in opposite directions:

1. **PATCH 7 is solving a real problem.** With the redraw off the filter collapses
   completely -- 100% of particles in one scenario. Without rejuvenation the
   model has no scenario diversity at all. So "just turn it off" is not a fix.

2. **The reported posterior over scenarios is largely an artifact of that 3%.**
   The likelihood alone drives everything to slow_takeoff. The 3% prior injection
   moves the answer to cascade-dominant, 76.3% vs 19.3%. Flipping a knob nobody
   thinks of as a modelling choice flips which scenario the model concludes.

**Therefore the correct fix is neither "off" nor the diversity gate** (the gate
cannot tell degeneracy from a deliberately homogeneous population -- both present
exactly one scenario, so it stays open in both, which is why it changed nothing
in the forced runs). The correct fix is to stop redrawing from the prior: move
degenerate particles with a weight-respecting jitter or MCMC perturbation, so
diversity is restored without importing prior mass.

**This bounds the deployed marginalised panel.** It was shipped today and is the
right *shape*, but its shares are computed under a filter whose scenario
composition is set by a 3% prior injection. The cascade share it reports is not a
posterior over scenarios read off the data; it is a mixture of the likelihood
answer and the injection. Treat those shares as provisional until the injection
is removed.

**Consequence: the per-scenario rows in `test/verify.js` are not
scenario-conditional numbers.** "slow_takeoff P(T3) = 87.8%" is the probability
for a population that was mostly cascade by the end. Every conditional-on-scenario
figure quoted anywhere -- including the T3/T4 test rows and the per-scenario ESS
numbers -- inherits this.

Only one code path reassigns `world_model`: the rejuvenation block (checked --
`grep world_model =` finds no other assignment). Yet gating it did not preserve
the scenario, so the dominant mechanism is **weighted selection during
resampling**: the likelihood prefers cascade, so selection walks the population
toward cascade regardless of what was forced. This is legitimate particle-filter
behaviour and is exactly why it must not be mistaken for a scenario-conditional
forecast. It needs one more measurement to confirm -- track ESS and the cascade
fraction across a single forced run.

**What this validates.** The marginalised scenario panel shipped 2026-10-03 is
the right response: it reports the posterior over scenarios instead of
pretending a conditional forecast exists. It is computed under a filter that
still injects prior mass at 3% per resampling step, so the gate remains worth
doing -- but as a correction to the marginal numbers, not as the main fix.

**Rejuvenation gate: ATTEMPTED AND REVERTED 2026-10-03 — but it revealed
something that matters more than the fix.** Gating rejuvenation on "fewer than 3
distinct scenarios survive" is the principled version and it is a two-line change.
A/B against HEAD, same seed, 400 particles per hypothesis, all particles forced
to one scenario:

```
                    baseline (3% every step)     gated on diversity
hard_wall           T3=0    T4=0    T3-only=0     T3=0    T4=0    T3-only=0
resilient_civ       T3=22   T4=22   T3-only=0     T3=0    T4=0    T3-only=0
cascade             T3=376  T4=375  T3-only=1     T3=208  T4=208  T3-only=0
slow_takeoff        T3=351  T4=351  T3-only=0     T3=91   T4=91   T3-only=0
```

Two things fall out, and the second is the important one.

1. The T3/T4 test passes on a **razor-thin margin** — baseline satisfies
   `T3-only > 0` through a *single* particle out of 400 in cascade. Gating
   removes it, so the test goes red. The test is not fragile by accident; it was
   sitting on 0.25%.

2. **P(T3) is partly an artifact of rejuvenation.** Gating it cuts cascade from
   376/400 (94%) to 208/400 (52%) and slow_takeoff from 351/400 (88%) to 91/400
   (23%), while every particle in those runs was forced to that scenario. The
   only path from "rejuvenation" to "reaches T3" is the prior redraw switching
   `world_model` to cascade — i.e. the headline T3 probability in a
   scenario-conditional run is inflated by prior mass leaking in from
   rejuvenation, which is exactly the harm identified in the §5A measurements.

Reverted rather than shipping, because this changes headline numbers (P(T3)
94% -> 52%) and re-validating a headline number is not work to attempt at the end
of a context window. 43/43 restored after revert.

**What this means for the deployed marginalisation.** The marginalised scenario
panel shipped today is the right direction and is unaffected in kind, but its
numbers are computed under a filter that is still injecting prior mass at 3% per
resampling step. The gate is the correct fix; it needs a proper re-run of the
whole forecast, not a spot patch.

**Stay stochastic — 5.** Each has a condition in model state; the moment is
circumstantial.

```
894  social tension shock      957  GPU bubble burst
941  alignment incident        968  state intervention
                                987  winter (hype gap)
```

**Become deterministic thresholds — 2.** A paradigm shift happens because
capability crossed a level; the data wall arrives because data was consumed.
Trigger on reaching a threshold in accumulated state, not on a draw. The
randomness of *when* disappears but the uncertainty of *where the threshold
sits* survives as between-particle spread, which is the honest form: the user
gets a date, not a random variate.

```
919  paradigm shift            937  data wall
```

**Rejuvenation (1430) is a separate defect, and the worst of the eight.** It is
not a modelling assumption but a numerical device against filter degeneracy,
and it mixes in prior mass while ignoring the likelihood. Already measured: at
3% clouds spread 95.8pp, at 0% they agreed to 0pp. It does not add uncertainty
about the world, it adds prior noise to the filter. Correct behaviour is to
resample degenerate particles **by weight**, not from the prior. This one is
worth doing first: the harm is already measured and the fix is understood.

### Item 1 — Marginalise `world_model` — DONE

Shipped in `d07701e`, `6c9c11f`, `80ac443`, `3344253`. Lazy, cached, capped at
150 particles, button-triggered. Measured and retracted claims are in §5A.
Remaining: none, except that the panel is not deployed (blocked by §1).

### Item 2 — E' = T·S — DECIDED NOT TO DO

Agreed with the user, then verified absent: `stateR` is only ever incremented
and `algoK` is only ever used as a rate, so there is no retroactive
re-application to fix. See §5A. If a temporal-dynamics change is wanted later,
the real difference from their model is that their `S(t)` depends on calendar
time and ours is a per-particle constant — that is a different change and needs
its own discussion.

### Item 3 — Fit `observationNoiseSigma` from residuals

Turn the hand-set 1.5 multiplier into an estimate from fit residuals, so sigma
stops being another silent knob. Requires care: it feeds the likelihood, so
fitting it on the same residuals used to fit the particles is circular unless
done out-of-sample (e.g. fit on the first 12 observations, score on the last 5
— note the manual scoring loop already failed once, §2.5).

### Item 4 — Add `p(alignment)` with an honest range

We have no counterpart to their 40.8% (range 30–56). Needed as the primary
metric for "most likely future". Must ship with its range, per `6bc1eea`'s
precedent of labelling unidentified quantities instead of printing bare numbers.

### Item 5 — Calibration to Plan D

Blocked behind item 0 and the dead-horizon question in §5A. Calibrating while
30 of 40 horizon years are flat means calibrating a constant. Targets: T3 median toward ~3.25 y (their AC), a parameter
for the share of resources on safety (their ≥1% threshold), and the scenario
reference set to Plan D.

---

## 7. Working notes and traps

- File is **CRLF**. Patch line-by-line preserving `\r`; `read_file`/`patch`
  worked, but naive `str.replace` on multi-line blocks silently fails on the
  line endings. One earlier edit deleted `years.push(y)` and a test then passed
  vacuously — always run a rollback comparison against HEAD when editing the
  loop bodies.
- Engine loads only inside a vm context with `document`/`Plotly` stubs; use
  `test/verify.js`'s pattern. `globalThis.__SINGULARITY_CORE__` exports the API,
  including `swarmComputeAGIYears` (added by `708d2ce`).
- Terminal is bash/MSYS on Windows. **Path arguments to native programs are not
  translated** — pass `C:/Users/...` style. `$TMPDIR` as a bare `/tmp` breaks
  Python scripts ("\tmp\..." not found); write probes to the profile scratch
  dir. `node --check f.js` needs `< /dev/null` or it dies with "stdin is not a
  tty"; `require('./worker.js)` fails on `addEventListener`, which is expected
  for a Cloudflare Worker, not a defect.
- Headless `--window-size` is ignored below ~500 px; use CDP emulation for
  mobile measurements. `file://` will not execute the engine (CORS).
- `verify.js` language-pack parity: 381/381 keys in both `ru` and `en` as of
  `6bc1eea`.
- Do not edit other workers' published copy silently. When Article 9.1 blocked
  the deploy twice, the author fixed it; the gate was right both times.