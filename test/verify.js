// Final verification suite — asserts the properties that actually matter,
// not incidental ones. All engine functions live in the vm sandbox, so they
// must be called via G.*
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('D:/prod/singularity-forecaster/singularity-core.js', 'utf8');
function stubEl() {
  const e = { style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
    children: [], innerHTML: '', textContent: '', value: '1', checked: false,
    appendChild() {}, removeChild() {}, setAttribute() {}, getAttribute() { return null; },
    addEventListener() {}, removeEventListener() {}, querySelector() { return null; },
    querySelectorAll() { return []; }, getBoundingClientRect() { return { width: 800, height: 600, left: 0, top: 0 }; },
    getContext() { return ctx2d; }, closest() { return null; }, focus() {}, click() {} };
  return e;
}
const ctx2d = new Proxy({}, { get: (t, k) => k === 'canvas' ? { width: 800, height: 600 }
  : k === 'measureText' ? () => ({ width: 50 }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) })
  : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop() {} })
  : typeof k === 'string' ? () => {} : undefined });
const doc = { documentElement: { style: {} }, body: stubEl(), getElementById: () => stubEl(),
  querySelector: () => stubEl(), querySelectorAll: () => [], createElement: () => stubEl(),
  createElementNS: () => stubEl(), addEventListener() {} };
const sb = { console, Math, Date, JSON, Object, Array, Number, String, Boolean, Error,
  isFinite, isNaN, parseFloat, parseInt, setTimeout: (f, t) => setTimeout(f, Math.min(t || 0, 0)),
  clearTimeout, Promise, Float64Array, Map, Set, Proxy, Symbol, TypeError, RangeError,
  window: { _lang: 'ru', devicePixelRatio: 1, addEventListener() {} }, document: doc,
  navigator: { userAgent: 'node', language: 'ru-RU' }, location: { href: 'https://x/', protocol: 'https:' },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  requestAnimationFrame: f => setTimeout(f, 0),
  Plotly: { newPlot() {}, react() {}, purge() {}, resize() {} },
  getComputedStyle: () => ({ getPropertyValue: () => '' }) };
sb.window.document = doc; sb.globalThis = sb; sb.self = sb;
let loadErr = null;
try { vm.runInContext(src, vm.createContext(sb), { filename: 'core.js' }); } catch (e) { loadErr = e; }
if (loadErr) { console.log('LOAD FAILED:', loadErr.message); process.exit(1); }
const G = sb.__SINGULARITY_CORE__;
const P = (a, p) => { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(p / 100 * (a.length - 1))] : NaN; };
const fin = a => (a || []).filter(isFinite);
const pct = (n, d) => (100 * n / d).toFixed(1) + '%';
let fails = 0;
const check = (name, ok, detail) => { console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? '  ' + detail : ''}`); if (!ok) fails++; };
const hist = G.FALLBACK_BENCHMARK_HISTORY, cfg = G.createConfig();

console.log('=== 0. BENCHMARK HISTORY INTEGRITY ===');
// Guards for hand-edited observation data. A typo here silently changes every
// forecast on the page, and the engine does not complain: a missing field
// becomes undefined (propagated through the likelihood), a backwards year makes
// resampling non-causal, and a duplicated event is indistinguishable from a
// genuine re-release at the filter level.
const ROW_FIELDS = ['year', 'arenaElo', 'arcAgi', 'sweBench', 'trainingFlopsLog',
                    'horizon', 'simToReal', 'moravec', 'autoAssembly'];
const badFields = [];
for (const row of hist) {
  for (const f of ROW_FIELDS) {
    if (typeof row[f] !== 'number' || !isFinite(row[f])) badFields.push(`${row.event}.${f}=${row[f]}`);
  }
  for (const f of ROW_FIELDS.map(x => x + '_sigma')) {
    if (f in row && (typeof row[f] !== 'number' || !isFinite(row[f]) || row[f] <= 0)) {
      badFields.push(`${row.event}.${f}=${row[f]}`);
    }
  }
}
check('every row has finite numeric fields', badFields.length === 0, badFields.slice(0, 5).join(', '));

let orderOk = true;
for (let i = 1; i < hist.length; i++) {
  if (hist[i].year <= hist[i - 1].year) { orderOk = false; break; }
}
check('years strictly increasing', orderOk);

const events = new Set(hist.map(r => r.event));
check('no duplicate events', events.size === hist.length,
  `${hist.length} rows, ${events.size} unique`);

const dupYears = hist.map(r => r.year).filter((y, i, a) => a.indexOf(y) !== i);
check('no duplicate years', dupYears.length === 0, dupYears.join(', '));

check('arcAgi within 0..100', hist.every(r => r.arcAgi >= 0 && r.arcAgi <= 100));
check('sweBench within 0..100', hist.every(r => r.sweBench >= 0 && r.sweBench <= 100));
// Autonomy horizon is NOT required to be monotonic: GPT-4.5 Preview (4h) sits
// below o3-preview (8h) because it was a non-agentic model, and that is a real
// feature of the series, not a data error. Only flag a total collapse.
check('horizon positive and non-explosive',
  hist.every(r => r.horizon > 0 && r.horizon <= 100000),
  `min=${Math.min(...hist.map(r => r.horizon))} max=${Math.max(...hist.map(r => r.horizon))}`);
check('horizon rises overall (last >= 10x first)',
  hist[hist.length - 1].horizon >= 10 * hist[0].horizon,
  `${hist[0].horizon} -> ${hist[hist.length - 1].horizon}`);
check('latest observation is before the pinned present',
  hist[hist.length - 1].year < 2026.75,
  `last=${hist[hist.length - 1].event} @ ${hist[hist.length - 1].year}`);

console.log('=== 1. SEEDED PRNG ===');
G.setSeed(12345); const a1 = [G.rnd(), G.rnd(), G.rnd(), G.rnd()];
G.setSeed(12345); const a2 = [G.rnd(), G.rnd(), G.rnd(), G.rnd()];
check('same seed reproduces stream', JSON.stringify(a1) === JSON.stringify(a2));
G.setSeed(999); const b1 = [G.rnd(), G.rnd(), G.rnd(), G.rnd()];
check('different seed diverges', JSON.stringify(a1) !== JSON.stringify(b1));
check('outputs in [0,1)', a1.every(v => v >= 0 && v < 1));

console.log('\n=== 2. LIKELIHOOD PATH DETERMINISTIC ===');
G.setSeed(42);
const part = { hw_months: 7.5, algo_months: 6, agency_ceiling: 8, embodiment_ceiling: 4, world_model: 'cascade', rsi_efficiency: 1 };
for (const yr of [2025, 2026, 2026.74, 2030, 2040]) {
  const p1 = G.simulateToYear(part, yr, cfg);
  const p2 = G.simulateToYear(part, yr, cfg);
  check(`simulateToYear(${yr}) stable across repeats`, p1.reasoning === p2.reasoning && p1.worldModeling === p2.worldModeling,
    `R=${p1.reasoning.toFixed(3)} W=${p1.worldModeling.toFixed(3)}`);
}

console.log('\n=== 3. FORECAST PATH SEED-SENSITIVE & REPRODUCIBLE ===');
G.setSeed(7); const tA = new G.ParticleFilterTracker(300); for (const o of hist) tA.observeRealData(o.year, o); const mA = tA.runMonteCarloForecast(200);
G.setSeed(7); const tB = new G.ParticleFilterTracker(300); for (const o of hist) tB.observeRealData(o.year, o); const mB = tB.runMonteCarloForecast(200);
check('same seed -> identical forecast', JSON.stringify(mA.t3Years) === JSON.stringify(mB.t3Years));
G.setSeed(8); const tC = new G.ParticleFilterTracker(300); for (const o of hist) tC.observeRealData(o.year, o); const mC = tC.runMonteCarloForecast(200);
check('different seed -> different forecast', JSON.stringify(mA.t3Years) !== JSON.stringify(mC.t3Years));

console.log('\n=== 4. T4 PHYSICAL GATE IS REACHABLE (the real bug fixed) ===');
const dr6 = G.computeDependency(1.0, 6.0, cfg.EXPERT);
check('DR > 0.9 at the T4 embodiment gate E=6', dr6 > 0.9, `DR=${dr6.toFixed(3)} (was 0.880, unreachable)`);
check('DR < 0.9 below the gate E=4', G.computeDependency(1.0, 4.0, cfg.EXPERT) < 0.9, `DR=${G.computeDependency(1.0, 4.0, cfg.EXPERT).toFixed(3)}`);

console.log('\n=== 5. T3 IS AN INFORMATIVE LEADING INDICATOR OF T4 ===');
G.setSeed(2024);
const T = new G.ParticleFilterTracker(1000); for (const o of hist) T.observeRealData(o.year, o);
const mc = T.runMonteCarloForecast(1000);
const f1 = fin(mc.t1Years), f2 = fin(mc.t2Years), f3 = fin(mc.t3Years), f4 = fin(mc.t4Years);
console.log(`  t1 median ${P(f1, 50).toFixed(2)}y   t2 median ${P(f2, 50).toFixed(2)}y   t3 median ${P(f3, 50).toFixed(2)}y   t4 median ${P(f4, 50).toFixed(2)}y`);
const lead = P(f4, 50) - P(f3, 50);
check('T3 leads T4 by a material margin', lead > 2, `lead time = ${lead.toFixed(1)}y (T3 is not redundant with T4)`);
// T4 implies T3 is the correct causal ordering; T3-only must exist for at least one hypothesis.
let t3onlyFound = false;
let leadFound = false;
// All four hypotheses are checked, not just the two where the window was found
// before. The T3-only window is IC in (0.6, 0.818) -- T3 fires at IC > 0.6 while
// T4 needs DR > 0.9, and at full embodiment that requires IC >= 0.818 -- so it
// is 0.218 wide in IC, roughly 3-4 months of growth at A = 40 and 24 months in
// slower worlds. Restricting the check to two hypotheses asserted a structural
// property that only held for those two.
for (const wm of ['hard_wall', 'resilient_civ', 'cascade', 'slow_takeoff']) {
  G.setSeed(11); const t = new G.ParticleFilterTracker(400);
  t.particles.forEach(p => { p.world_model = wm; }); t.weights.fill(1 / 400);
  for (const o of hist) t.observeRealData(o.year, o);
  const m = t.runMonteCarloForecast(400);
  const b = m.t3Years.filter((v, i) => isFinite(v) && isFinite(m.t4Years[i])).length;
  const t3o = fin(m.t3Years).length - b;
  // Also measure the lead time, which is the substantive claim: T3 must be
  // reachable while T4 is not. A run that never reaches T4 proves T3 is not a
  // proxy for it; a run that reaches T3 months before T4 proves T3 leads.
  let maxLead = 0;
  for (let i = 0; i < m.t3Years.length; i++) {
    if (isFinite(m.t3Years[i]) && isFinite(m.t4Years[i])) {
      maxLead = Math.max(maxLead, m.t4Years[i] - m.t3Years[i]);
    }
  }
  console.log(`  ${wm}: T3=${fin(m.t3Years).length} T4=${fin(m.t4Years).length} T3-only=${t3o}` +
              ` maxLead=${maxLead.toFixed(2)}y`);
  if (t3o > 0) t3onlyFound = true;
  if (maxLead > 0.5) leadFound = true;
}
check('T3 and T4 diverge for at least one hypothesis', t3onlyFound, 'T3 is not a perfect proxy of T4');
check('T3 leads T4 by a real margin in at least one hypothesis', leadFound,
  'capture precedes dependency rather than coinciding with it');

console.log('\n=== 6. T1/T2 ARE PAST (read as "already achieved") ===');
const past1 = f1.filter(x => x <= 0).length, past2 = f2.filter(x => x <= 0).length;
check('T1 median <= 0 (past)', P(f1, 50) <= 0, `${pct(past1, f1.length)} of hits are past`);
check('T2 median <= 0 (past)', P(f2, 50) <= 0, `${pct(past2, f2.length)} of hits are past`);

console.log('\n=== 7. WM CEILING BUG FIXED ===');
const cR = cfg.DIMENSIONS.reasoning.ceiling, cW = cfg.DIMENSIONS.worldModeling.ceiling, big = 1e6;
check('WM asymptotes to its own ceiling (not Reasoning\'s)', Math.abs(G.computeDim(big, cfg.DIMENSIONS.worldModeling.slope, cW) - cW) < 1e-6,
  `R->${G.computeDim(big, cfg.DIMENSIONS.reasoning.slope, cR).toFixed(1)} W->${G.computeDim(big, cfg.DIMENSIONS.worldModeling.slope, cW).toFixed(1)}`);

console.log('\n=== 8. LIKELIHOOD IS A PRODUCT (ESS falls monotonically with #benchmarks) ===');
const med = T.particles[0];
const mp = G.simulateToYear(med, 2025.0, cfg);
const mo = G.getNumericObservables(mp.reasoning, mp.agency, mp.embodiment, cfg.EXPERT);
const cases = [
  ['1', { arcAgi: mo.arcAgi * 1.10 }],
  ['3', { arcAgi: mo.arcAgi * 1.10, sweBench: mo.sweBench * 1.10, arenaElo: mo.arenaElo + 30 }],
  ['5', { arcAgi: mo.arcAgi * 1.10, sweBench: mo.sweBench * 1.10, arenaElo: mo.arenaElo + 30, trainingFlopsLog: mo.flopsLog + 0.3, horizon: 4 }],
];
const essList = [];
for (const [n, obs] of cases) {
  G.setSeed(1); const t = new G.ParticleFilterTracker(400);
  t.observeRealData(2025.0, obs);
  const ess = 1 / t.weights.reduce((a, b) => a + b * b, 0);
  essList.push(ess);
  console.log(`  ${n} benchmark(s) -> ESS ${ess.toFixed(1)}/400`);
}
check('more benchmarks => more concentrated posterior (ESS falls)', essList[2] < essList[0] && essList[2] < essList[1],
  `product likelihood, not exp(mean)`);

console.log('\n=== 9. DISCRIMINATION BETWEEN WORLD MODELS ===');
const rows = [];
for (const wm of ['cascade', 'hard_wall', 'slow_takeoff', 'resilient_civ']) {
  G.setSeed(5); const t = new G.ParticleFilterTracker(400);
  t.particles.forEach(p => { p.world_model = wm; }); t.weights.fill(1 / 400);
  for (const o of hist) t.observeRealData(o.year, o);
  const m = t.runMonteCarloForecast(300);
  const e = 1 / t.weights.reduce((a, b) => a + b * b, 0);
  rows.push([wm, e, pct(fin(m.t3Years).length, 300), pct(fin(m.t4Years).length, 300)]);
  console.log(`  ${wm.padEnd(14)} ESS=${e.toFixed(0).padStart(3)}  P(T3)=${rows.at(-1)[2].padStart(6)}  P(T4)=${rows.at(-1)[3].padStart(6)}`);
}
const t4rates = rows.map(r => parseFloat(r[3]));
check('P(T4) differs across hypotheses', Math.max(...t4rates) - Math.min(...t4rates) > 20, 'filter discriminates');

console.log('\n=== 10. ALL PUBLIC METHODS WORK ===');
G.setSeed(3); const T2 = new G.ParticleFilterTracker(600); for (const o of hist) T2.observeRealData(o.year, o);
try { const s = T2.runScenarioOverlay(15); check('runScenarioOverlay', s.length === 15 && s[0].years.length > 0, `${s.length} scenarios`); } catch (e) { check('runScenarioOverlay', false, e.message); }
try { const d = T2.runDecomposition(); const fin2 = d.hwComp.every(isFinite) && d.algoComp.every(isFinite) && d.rsiComp.every(isFinite) && d.paradigmComp.every(isFinite); check('runDecomposition', fin2 && d.years.length > 0, `${d.years.length} steps, all finite`); } catch (e) { check('runDecomposition', false, e.message); }
try { const s = T2.getSummary(); check('getSummary', isFinite(s.agencyCeiling), `agencyCeiling=${s.agencyCeiling.toFixed(2)}`); } catch (e) { check('getSummary', false, e.message); }


// ---- R >> W gap: grounding must close it, not just assert it -------------
// Before groundingRate, stateE advanced only from compute, so R and W were
// independent random walks and their ratio settled at 1.85-3.12 across the four
// hypotheses and never closed -- the gap the model asserted and then required a
// W-derived quantity to cross. groundingRate anchors part of new reasoning into
// a world model, so the ratio must now be materially lower.
{
  const cfgG = G.createConfig();
  const ratios = {};
  for (const wm of ['cascade', 'slow_takeoff', 'resilient_civ', 'hard_wall']) {
    const partG = { hw_months: 6.0, algo_months: 4.5, agency_ceiling: 12.0,
                    embodiment_ceiling: 6.0, world_model: wm,
                    rsi_efficiency: 1.2, veto_strength: 0.5 };
    const stG = G.createSimState(partG, cfgG);
    let lastR = 0, lastW = 1;
    for (let step = 0; step < 12 * 30; step++) {
      const v = G.stepDynamics(stG, cfgG, 1 / 12, false, partG);
      if (step > 0) { lastR = v.R; lastW = Math.max(1e-9, v.W); }
      if (stG.yT4 !== null) break;
    }
    ratios[wm] = lastR / lastW;
    console.log(`  ${wm}: R/W = ${ratios[wm].toFixed(2)}`);
  }
  const worst = Math.max(...Object.values(ratios));
  check('R/W gap narrows below 2.5 in every hypothesis', worst < 2.5,
    `worst R/W = ${worst.toFixed(2)} (was 3.12 with no grounding mechanism)`);
  // And grounding must not make embodiment trivially easy: T4 still needs
  // embodimentT4Requirement, and a pure subsidy would have blown past it.
  check('T4 still requires embodiment to be built', cfgG.EXPERT.embodimentT4Requirement > 0,
    'embodiment threshold is a real requirement, not zero');
}

// The grounding cap: groundingRateMax enters as
//   min(groundingRateMax, groundingRate * (R / ceilingR))
// and R/ceilingR <= 1, so the inner expression can never exceed groundingRate.
// At the shipped values (0.22 and 0.9) the cap therefore never engages --
// measured 0 of 480 monthly steps. The page text used to claim "absorption is
// bounded (groundingRateMax), so reasoning can still outrun grounding", which
// was FALSE: the gap is held open by a low groundingRate growing with
// R/ceilingR, not by the cap. Both RU and EN now say that instead.
//
// This test pins the condition under which that wording is accurate. If the cap
// ever starts binding, it fails on purpose -- because then the wording is stale
// and the sentence has to be rewritten rather than left to drift.
{
  const cfgC = G.createConfig();
  const E = cfgC.EXPERT;
  const partC = { hw_months: 6.0, algo_months: 4.5, agency_ceiling: 12.0,
                  embodiment_ceiling: 6.0, world_model: 'slow_takeoff',
                  rsi_efficiency: 1.0, veto_strength: 0.5 };
  const stC = G.createSimState(partC, cfgC);
  let binds = 0, steps = 0, worstInner = 0;
  for (let step = 0; step < 12 * 40; step++) {
    G.stepDynamics(stC, cfgC, 1 / 12, false, partC);
    const r = G.computeDim(stC.stateR, cfgC.DIMENSIONS.reasoning.slope, stC.ceilingR);
    const ratio = Math.min(1, r / Math.max(1e-9, stC.ceilingR));
    const inner = E.groundingRate * ratio;
    if (inner > worstInner) worstInner = inner;
    if (inner > E.groundingRateMax) binds++;
    steps++;
    if (stC.yT4 !== null) break;
  }
  check('groundingRateMax cap never binds at shipped defaults',
    binds === 0,
    `cap engaged in ${binds}/${steps} steps; max inner = ${worstInner.toFixed(4)} ` +
    `vs cap ${E.groundingRateMax} (groundingRate = ${E.groundingRate}). ` +
    `If this now binds, the gapg_p2 wording is stale.`);

  // DP saturates: a veto onset anywhere above ~0.6 fires in the same month, so
  // institutionalVetoOnset cannot discriminate within that band. Recorded so a
  // later reader does not read its flat sweep as "the veto does nothing".
  const partD = Object.assign({}, partC);
  const stD = G.createSimState(partD, cfgC);
  let firstOver75 = -1, firstOver60 = -1, stepsInBand = 0;
  for (let step = 0; step < 12 * 40; step++) {
    G.stepDynamics(stD, cfgC, 1 / 12, false, partD);
    const r = G.computeDim(stD.stateR, cfgC.DIMENSIONS.reasoning.slope, stD.ceilingR);
    const a = G.computeDim(stD.stateA, cfgC.DIMENSIONS.agency.slope, stD.ceilingA);
    const w = G.computeDim(stD.stateW, cfgC.DIMENSIONS.worldModeling.slope, stD.ceilingWM);
    const dp = 1 / (1 + Math.exp(-(0.5 * Math.cbrt(r * w * a) + 0.3 * a - 5.0)));
    if (dp > 0.75 && firstOver75 < 0) firstOver75 = step;
    if (dp > 0.60 && firstOver60 < 0) firstOver60 = step;
    if (dp > 0.60 && dp < 0.99) stepsInBand++;
  }
  check('DP occupies no time in the 0.6-0.99 band (veto onset is flat there)',
    stepsInBand === 0,
    `DP crosses 0.60 at step ${firstOver60} and 0.75 at step ${firstOver75}, ` +
    `spending ${stepsInBand} steps in between`);
}

// ---- The decomposition must be an exact partition of the total ------------
//
// The assertion the old chart could never have passed. The four bands are
// accumulated from the split stepDynamics itself forms for dCompute, so
// hw + algo + paradigm + rsi is the total identically. The previous version
// credited the paradigm band a flat 2.0 per generation and defined hardware as
// the remainder, which is why the stack read 2.4x its own total: three shifts
// put that band at 6.0 against a total log-FLOPs growth of 2.64, and the
// remainder clamped at zero.
(function(){
  let d = null;
  try {
    // Same construction the page and the rest of this suite use. A fresh,
    // unconditioned tracker produces NaN in three of the four channels from
    // step 0 -- pre-existing -- and a test that only compares the channels to
    // each other passes on that NaN without noticing.
    G.setSeed(3);
    const t = new G.ParticleFilterTracker(600);
    for (const o of G.FALLBACK_BENCHMARK_HISTORY) t.observeRealData(o.year, o);
    d = t.runDecomposition();
  } catch (e) {
    check('Decomposition channels are finite on a conditioned tracker', false, 'threw: ' + e.message);
    return;
  }
  const series = ['hwComp', 'algoComp', 'paradigmComp', 'rsiComp', 'totalSeries'];
  const missing = series.filter((k) => !d || !d[k]);
  if (missing.length) {
    check('Decomposition channels are finite on a conditioned tracker', false,
          'missing series: ' + missing.join(', '));
    return;
  }
  const nonFinite = {};
  let n = 0;
  for (const k of series) {
    const bad = d[k].filter((v) => !isFinite(v)).length;
    if (bad) { nonFinite[k] = bad; n += bad; }
  }
  check('Decomposition channels are finite on a conditioned tracker', n === 0,
        n === 0
          ? d.years.length + ' steps across ' + series.length + ' series, all finite'
          : JSON.stringify(nonFinite));

  // The partition itself. NaN fails every comparison silently, so the finiteness
  // check above must gate this one rather than this one standing alone.
  let worst = 0, worstAt = -1;
  for (let i = 0; i < d.years.length; i++) {
    const sum = d.hwComp[i] + d.algoComp[i] + d.paradigmComp[i] + d.rsiComp[i];
    const err = Math.abs(sum - d.totalSeries[i]);
    if (err > worst) { worst = err; worstAt = i; }
  }
  check('The four decomposition bands sum to the total at every step',
        worst === 0,
        worst === 0
          ? d.years.length + ' steps, residual exactly 0 at all of them'
          : 'worst residual ' + worst.toExponential(3) + ' at step ' + worstAt +
            ' (year ' + d.years[worstAt] + ')');

  // Identity alone is not enough: a stack where one band is 100% satisfies it
  // just as well, and that is close to what the old chart showed.
  const last = d.years.length - 1;
  const share = (k) => (d.totalSeries[last] > 0 ? d[k][last] / d.totalSeries[last] : 0);
  const parts = ['hwComp', 'algoComp', 'paradigmComp', 'rsiComp'];
  const meaningful = parts.filter((k) => share(k) > 0.01).length;
  check('More than one channel actually contributes', meaningful >= 2,
        parts.map((k) => k.replace('Comp', '') + ' ' + (100 * share(k)).toFixed(1) + '%').join(', '));

  // The old bug in one assertion: the paradigm band was a counter times a
  // constant, so it grew in flat 2.0 steps regardless of what the shift did.
  // Any single step must stay small relative to the total the band ends on.
  let maxJump = 0;
  for (let i = 1; i <= last; i++) {
    const j = d.paradigmComp[i] - d.paradigmComp[i - 1];
    if (j > maxJump) maxJump = j;
  }
  const total = d.totalSeries[last];
  check('The paradigm band is not a counter times a constant', maxJump < total,
        'largest single-step jump ' + maxJump.toExponential(3) + ' against a total of ' +
        total.toFixed(3) + ' (the old build stepped by exactly 2.0 and overshot 2.4x)');
})();

// ---- An unidentified posterior must be labelled as one ---------------------
//
// Measured defect, 2026-10-02. Eight independent particle clouds at N=1000, no
// reseeding, produced cascade shares of 1-97%, slow-takeoff 0-97% and resilient
// 0-65%: the world-model posterior spans essentially the whole simplex, and
// P(T3) tracks it directly (96.7% / 20.8% / 92.5% at N=1000 / 2000 / 4000 on one
// fixed seed). So the four percentages are a single random draw.
//
// This test guards the *presentation*: the diagnostic block must not render bare
// percentages without saying so. It deliberately does not assert a spread value,
// because the right behaviour when the model is fixed is for this to keep passing
// unchanged -- it tests the labelling, not the magnitude.
(function(){
  const L = G.LANG;
  let ok = true;
  const detail = [];
  for (const lang of Object.keys(L)) {
    const k = 'postUnidentified';
    if (typeof L[lang][k] !== 'string' || L[lang][k].length < 40) {
      ok = false; detail.push(lang + ': missing or too short');
    }
  }
  check('The unidentified-posterior warning exists in every language pack', ok,
        ok ? Object.keys(L).map((l) => l + ' ' + L[l].postUnidentified.length + ' chars').join(', ')
           : detail.join('; '));

  // The warning must actually reach the rendered report, not just sit in the pack.
  const src = require('fs').readFileSync('D:/prod/singularity-forecaster/singularity-core.js', 'utf8');
  const rendered = /postUnidentified/.test(src.slice(src.indexOf('postCascade \* 100') - 400, src.indexOf('postCascade \* 100') + 1600));
  check('The diagnostic block renders the warning next to the four percentages', rendered,
        rendered ? 'found in the report template' : 'the pack key exists but is not rendered');
})();

console.log('\n' + '='.repeat(60));
console.log('\n' + '='.repeat(60));
console.log(fails === 0 ? 'ALL CHECKS PASSED' : `${fails} CHECK(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
