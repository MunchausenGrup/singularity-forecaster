
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function sigmoid(x) { return 1.0 / (1.0 + Math.exp(-Math.max(-30, Math.min(30, x)))); }

// ---------------------------------------------------------------------------
// SEEDED PRNG (mulberry32) — makes every run bit-for-bit reproducible.
// Before this, all stochastic paths used Math.random(), so the README's
// "3 seed cross-validation" claim was unverifiable: there was no seed.
// ---------------------------------------------------------------------------
let __seed = 0x9e3779b9;
let __rngState = __seed >>> 0;

function setSeed(s) {
  __seed = (s === undefined || s === null) ? 0x9e3779b9 : (s >>> 0);
  __rngState = __seed >>> 0;
  return __seed;
}
function getSeed() { return __seed; }

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Single shared stream. rnd() is the ONLY source of randomness in the engine.
function rnd() {
  __rngState = (__rngState + 0x6D2B79F5) | 0;
  let t = Math.imul(__rngState ^ (__rngState >>> 15), 1 | __rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function randnRange(mean, std) {
  // Box–Muller. Guards u1==0 (log(0) = -Infinity) via a tiny epsilon.
  const u1 = rnd() || Number.EPSILON, u2 = rnd();
  return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function percentile(arr, p) { if (!arr || arr.length === 0) return undefined; const sorted = arr.slice().sort((a, b) => a - b); const idx = clamp(Math.floor(p / 100 * (sorted.length - 1) + 0.5), 0, sorted.length - 1); return sorted[idx]; }
function cdf(list, x) { const c = list.filter(v => isFinite(v) && v <= x).length; return list.length ? (c / list.length) * 100 : 0; }

// ============================================================================
// HISTORICALLY DETERMINED CONSTANTS (not user-configurable)
// ============================================================================
const EMBODIMENT_REALITY_ANCHOR = 3.0;    // 2023 robotics level (Figure 01 / Optimus Gen 1)
const EMBODIMENT_BUILD_BASE_SPEED = 0.10;  // Factory construction speed by humans (roboticsFrontier/year)

// ============================================================================
// EXPERT SANDBOX — Параметры по умолчанию (соответствуют текущему поведению)
// ============================================================================
const EXPERT_CONFIG = {
  // Категория 1: Архитектура и Парадигмы
  ceilingReasoningBase: 15.0,       // Базовый потолок Трансформеров
  ceilingWorldModelingBase: 18.0,   // Потолок World Modeling (выше чем у Reasoning)
  hypeGracePeriod: 2.5,             // Толерантность инвесторов (лет)
  saturationThreshold: 0.7,         // Порог насыщения для прорыва (0-1)
  overhangShiftMultiplier: 0.2,     // Compute Overhang влияет на вероятность прорыва
  baseShiftMultiplier: 3.0,         // Множитель потолка при первом сдвиге
  paradigmDecayRate: 0.5,           // Насколько слабее каждый следующий сдвиг
  minShiftMultiplier: 1.2,          // Минимальный гарантированный множитель
  // Категория 2: Самоулучшение
  rsiMultiplier: 1.0,              // Множитель силы RSI
  rsiTriggerReasoning: 8.0,        // Reasoning для старта RSI (было 6.0)
  rsiTriggerAgency: 8.0,           // Agency для старта RSI (было 4.0)
  hwCoDesignBonus: 1.5,            // Аппаратный ко-дизайн
  coordinationFriction: 0.05,      // Координационное трение ансамблей ИИ
  maxPhysicalHwGrowth: 1.5,        // Физический предел роста железа (log scale)
  // Категория 3: Экономика и Риски
  bubbleBurstRisk: 0.20,           // Риск схлопывания GPU-пузыря
  alignmentCooldown: 1.5,          // Штраф за инцидент безопасности (лет)
  maxCapitalMultiplier: 2.5,       // Эластичность капитала

  // --- ПОРОГИ ЭТАПОВ СИНГУЛЯРНОСТИ ---
  // Only t1 is a capability threshold, and it is the only stage that fires on
  // one (R >= t1 && W >= 0.6*t1). T2/T3/T4 fire on sociotechnical state, not on
  // capability. The previous t2Threshold/t3Threshold/t4Threshold (10/25/100)
  // were collected into cfg.THRESHOLDS and exposed as expert sliders, but no
  // trigger ever read them — the triggers were hardcoded (DP>0.5 && IL>0.3,
  // IC>0.6, DR>0.9) — so moving those sliders changed nothing while the page
  // reported a forecast. Replaced with the quantities actually compared, at the
  // values that were previously hardcoded.
  t1Threshold: 8.0,                // T1: потеря понимания (порог capability)
  t2DemandThreshold: 0.5,          // T2: DP — спрос на координатора
  t2LegitimacyThreshold: 0.3,      // T2: IL — институциональная принятость
  t3CaptureThreshold: 0.6,         // T3: IC — доля захваченных институтов
  t4DependencyThreshold: 0.9,      // T4: DR — цивилизационная зависимость

  // --- 5 СТЕН РЕАЛЬНОСТИ (Социотехнические барьеры) ---
  barrierAtomsLimit: 1.2,          // [Проклятие атомов] Макс. удвоений HW в год
  barrierEnergyLog: 27.5,          // [Термодинамика] Предел FLOPs
  barrierGeopoliticsRisk: 0.25,    // [Монополия на насилие] Шанс государственного шока после T2
  barrierNashFriction: 0.15,       // [Конкуренция ИИ] Координационная деградация после T3
  barrierDemandGrace: 5.0,         // [Смысловой предел] Лет на адаптацию экономики к T2

  // --- CIVILIZATIONAL DEPENDENCY (T4 separability) ---
  // Dependency = how much of civilizational throughput runs through the system.
  // The 0.55 institutional + 0.45 physical split is deliberate: with the old
  // 0.7/0.3 split, DR_max at E=6 was 0.880 and the E>=6 gate was arithmetically
  // unreachable, which made T3 a perfect predictor of T4 (zero incremental info).
  // With this split DR_max at E=6 is 0.955, so E>=6 is a *binding but passable*
  // gate and T3 can fire without T4.
  drInstitutionalWeight: 0.55,    // вес институционального захвата (IC) в DR
  drPhysicalWeight: 0.45,         // вес физического контроля (E/10) в DR
  drInstitutionalSaturation: 0.95, // потолок IC, ниже 1.0 — даже полный захват оставляет хрупкость
  // --- COMPUTE GOVERNANCE (пред-T2 моратории и регулирование) ---
  governanceMoratoriumProb: 0.04,  // [Compute Governance] Ожидаемая доля лет, потерянных на регуляторные паузы (0.04 = ~1 мораторий за 25 лет)
  governanceShockDamping: 0.5,     // [Compute Governance] Множитель HW-роста во время шока (0.5 = рост в 2 раза медленнее)

  // --- INSTITUTIONAL VETO (институты могут не допустить, а не только замедлить) ---
  // До этого параметра governance мог только задерживать: governanceMoratoriumProb
  // и governanceShockDamping масштабировали скорость роста, а единственный жёсткий
  // предел IC (resilient_civ, IC <= 1-II) действовал только для одной гипотезы.
  // Матожидание демпфера — это задержка, никогда не предотвращение, поэтому все
  // четыре гипотезы отвечали на вопрос «как быстро», и ни одна — «произойдёт ли».
  // Исторический прецедент, который действительно удержал линию способностей
  // (нераспространение), был вето, а не замедлением.
  //
  // institutionalVetoStrength — доля населения, готовая не подчиняться, когда
  // зависимость уже видна. Если её достаточно, институты удерживают IC ниже
  // t3CaptureThreshold: T3 не наступает вовсе, а T4 невозможен, поскольку DR
  // требует институционального контроля.
  //
  // The four values below are calibrated against the steady state, not guessed.
  // vetoActive relaxes toward veto_strength at rate `ramp` and loses `decay`
  // every step, so it settles at
  //     v_ss = (ramp * strength - decay) / (ramp + decay)
  // With the shipped ramp=1.0, decay=0.05 that is v_ss = (strength - 0.05)/1.05,
  // so the 0.52 bind threshold is crossed when strength > 0.596 — roughly a
  // third of the N(0.5, 0.3)-ish particles drawn from the RSI axis.
  //
  // Two earlier calibrations were wrong and both made the veto inert, which the
  // three-arm probe caught by returning byte-identical forecasts with the veto
  // on, off and forced. (a) ramp=0.8 with decay=0.15 puts v_ss at 0.42 against
  // a 0.55 threshold, so only 5% of particles bound; (b) my first analytic note
  // claimed the threshold needed strength > 0.65, omitting the decay term —
  // the real requirement was strength > 0.84. Re-derive from the formula above
  // before changing any of these numbers.
  institutionalVetoStrength: 0.50,   // априор силы сопротивления (см. rsiDraw)
  institutionalVetoThreshold: 0.52,  // сила вето, выше которой IC удерживается
  institutionalVetoOnset: 0.75,      // DP, после которого вето включается
  institutionalVetoRamp: 1.0,        // /год: скорость мобилизации сопротивления
  institutionalVetoDecay: 0.05,      // /год: усталость от сопротивления
  // --- HUMAN AGENCY (человеческая сторона отчуждения) ---
  // До этого параметра в модели не было ни одной человеческой переменной
  // (grep -cE 'human_|socialCap|laborShare' -> 0). Лестница T1..T4 называлась
  // «стадиями отлучения», но измерялась исключительно со стороны артефакта:
  // R, A, W, E и производные от них. Вопрос «что выгодно людям» модель
  // выполнить не могла — ей нечего было терять.
  //
  // humanAgency — доля значимой экономической и институциональной
  // деятельности, где решение остаётся за человеком. Это НЕ доля рабочих
  // мест и не уровень навыка: речь о позиции в контуре принятия решений.
  // Растёт, когда инциденты и вмешательство государства подрывают доверие;
  // падает, когда машина заметно полезнее альтернатив и люди делегируют.
  //
  // Смысл в том, чтобы IC перестал быть функцией одной только способности.
  // Сейчас IC растёт из IL, IL растёт из DP, а DP — из P и A: цепочка замкнута
  // сама на себя, и T3 в принципе не может не наступить ни в одном мире. С
  // humanAgency появляется вопрос, на который модель раньше не отвечала:
  // могут ли люди удержать позицию и какой ценой.
  // CALIBRATION WARNING -- read before changing any of these.
  //
  // Two earlier versions left humanAgency pinned at 1.0 and therefore inert
  // (T3 reached 99.0% with the capture gate disabled vs 98.3% with it on, so the
  // variable explained nothing). The reason in both cases was the same: the
  // recovery terms were STANDING additions. stateIntervention stays true for
  // the whole length of its cooldown -- 3 to 5 years, decremented once per step
  // in each of two places -- so a +0.20/yr bonus outran the -0.055/yr erosion
  // and drove the variable UP, the opposite of its purpose.
  //
  // Recovery is therefore now PROPORTIONAL TO THE LOSS: each term scales with
  // (1 - humanAgency), so it can pull agency back toward its floor but can never
  // drive it above where erosion left it. Verified: a fast particle now falls
  // 0.85 -> 0.25 over roughly a decade and the gate is genuinely contested while
  // IC climbs.
  //
  // The DECAY and GAIN are also calibrated, not guessed. With decay 0.09 and
  // gain 0.035 the net rate was -0.055/yr, which sounds decisive, but the
  // proportional recovery terms (scaled by 1 - humanAgency) cancel it entirely
  // once agency is high: at humanAgency = 0.88 the recovery is -0.055*0.12*0.7
  // and does not balance, but the veto bonus does, and a fast particle settled
  // at 0.85-0.90 for its whole life. Measured over three arms, the gate then
  // moved only the MEDIAN (5.83 -> 5.67 -> 6.42y) and never the REACH (98.3% /
  // 98.7% / 98.3%) -- the variable delayed capture and could not prevent it,
  // which is still a damper and not the veto the ladder needs.
  //
  // Erosion must outrun recovery, so a world where nobody resists loses the
  // position, while a world with strong institutional resistance holds it.
  //
  // WHAT THIS ACTUALLY ACHIEVES -- measured, not intended.
  //
  // humanAgency changes WHEN capture happens, and by how much it is delayed:
  // across three arms the T3 median moved 6.25 -> 8.00 -> 9.42 years as the gate
  // rose. It does NOT change WHETHER capture happens. The reach of T3 stayed in
  // a 98.0-99.7% band in every arm, and 45 simulated years is long enough that
  // IC always gets there: at A = 40 the ungated growth term is 0.72/yr, so even
  // a half-closed gate is crossed in about 2.5 years of accumulated pressure,
  // and the horizon is 18x that.
  //
  // So this is still a damper, not a veto. What it buys is real but narrower
  // than the aim: the model can now say that human agency is worth several years
  // of institutional control, which is the first time anything in the sociotech
  // layer has answered a question about the HUMAN side at all, and the
  // institutional veto (institutionalVetoThreshold) remains the only mechanism
  // that actually prevents T3.
  //
  // Making this a true veto would need either a horizon-dependent gate, or a
  // hard ceiling on IC while humanAgency is below the gate -- not a multiplier
  // on growth. That is a deliberate omission, not an oversight: a hard ceiling
  // keyed to a single continuous variable is a much stronger claim about the
  // world, and it should be a separate change with its own evidence rather than
  // a tweak to a number here.
  humanAgencyDecay: 0.16,             // /год: естественная утрата позиций
  humanAgencyDelegationGain: 0.035,   // /год: выгода делегирования (растёт с A)
  humanAgencyRecover: 0.35,           // доля потери, восстанавливаемая за инцидент
  // Dimensionless damping on erosion, not a per-year rate: erosion is scaled by
  // (1 - min(0.85, vetoBonus * vetoActive/threshold)). 0.55 means a world whose
  // veto fully binds erodes 45% slower, so a strong-resistance world settles
  // near ha = 0.58 and a no-resistance world near the 0.05 floor.
  humanAgencyVetoBonus: 0.55,         // торможение убыли сопротивлением (0..0.85)
  humanAgencyInterventionBonus: 0.40,// доля потери после вмешательства государства
  humanAgencyFloor: 0.05,             // полное отчуждение необратимо, но не мгновенно
  // Gate re-derived after the T3/T4 divergence test failed. The 0.40 gate closed
  // the T3-without-T4 window entirely: resilient_civ settled at humanAgency
  // 0.82, IC topped out at 0.021, and both stages latched together (T3=T4=27)
  // where the committed baseline had T3=19, T4=17, T3-only=2. humanAgency and
  // the capture gate are entangled: a high gate suppresses IC so hard that
  // embodiment arrives first and T4 no longer trails T3.
  // 0.55 leaves capture possible in every hypothesis while still costing
  // real time -- the T3 median moves 6.25 -> 8.00 -> 9.42y across gates
  // 0.0 / 0.4 / 0.6, measured.
  humanAgencyCaptureGate: 0.55,       // ниже этой доли IC не растёт
  humanAgencyInitial: 0.85,           // начальная доля решений за людьми

  // --- GROUNDING (how reasoning becomes embodiment) ---
  // The R >> W gap was asserted, not closed. R and W are independent
  // log-diffusion states with separate ceilings and separate growth terms, and
  // nothing transferred capability between them: st.stateE advanced only as
  // 0.5*dCompute + 0.2*(A/ceilingA)*dCompute, i.e. purely from compute. A model
  // could therefore reason arbitrarily far ahead of any physical grounding with
  // no consequence, while T4 gates on embodiment, which gates on a world model.
  //
  // groundingRate is the share of new reasoning that gets ANCHORED -- turned
  // into a usable model of the world rather than staying inference. It is the
  // acquisition mechanism the gap was missing: without it the ratio R/W is a
  // property of two unrelated random walks.
  //
  // groundingRateMax bounds how much can be absorbed at once, so a
  // capability jump outruns its grounding -- the gap can open, and stays open
  // while grounding catches up. groundingEfficiency is the fraction of anchored
  // reasoning that actually reaches the physical world, lost to sensors,
  // energy, materials and experiments that are rate-limited regardless.
  groundingRate: 0.22,                // доля reasoning, уходящая в заземление
  groundingRateMax: 0.9,              // предел поглощения: R может обогнать W
  groundingEfficiency: 0.35,           // доля заземления, доходящая до материи
  groundingLabourCost: 0.45,          // доля выигрыша в A, съедаемая заземлением
  // --- OBSERVATION NOISE MODE ---
  observationSigmaMode: 'global',  // 'global' = BENCHMARK_SIGMAS; 'perPoint' = локальные *_sigma из точек данных
  // --- PLATEAU SCENARIO (затяжной T1 без прогресса) ---
  plateauHardWallCeiling: 5.5,     // [Plateau] Потолок agency_ceiling для hard_wall (5.5 = остановка роста)
  // --- EMBODIMENT (4-я латентная ось: физическая воплощенность) ---
  embodimentPriorMean: 4.0,        // [Embodiment] Априорное среднее embodiment_ceiling (низкое: робототехника сложна)
  embodimentPriorStd: 2.0,         // [Embodiment] Априорный разброс
  embodimentScalingSlope: 0.20,    // [Embodiment] Наклон кривой FLOPs → Embodiment (медленнее reasoning/agency)
  embodimentBypassThreshold: 8.0,  // [Embodiment] При embodiment > порога ИИ строит свои дата-центры, обходя maxPhysicalHwGrowth
  embodimentT4Requirement: 6.0,    // [Embodiment] Минимальный embodiment для засчитывания T4 (без контроля атомов T4 невозможен)
  embodimentHWBonusMultiplier: 3.0,// [Embodiment] Множитель HW-роста при активации bypass
  realRoboticsWeight: 0.30,         // [Embodiment] Вес realEmbodimentIndex в likelihood (0=игнор, 1=строгое следование)

  maxPhysicalExperimentRate: 1.5,   // Лимит скорости научных экспериментов в год (wet-lab constraint для T2→T3)

  // Категория 4: Эпистемология (World Models)
  worldModels: { cascade: 0.50, hardWall: 0.20, slowTakeoff: 0.15, resilientCiv: 0.15 },
  // Категория 5: Априорные допущения (Philosophical Priors)
  priorAgencyMean: 8.0,            // Априорное среднее agency_ceiling
  priorAgencyStd: 3.0,             // Априорный разброс
  // Категория 6: Бенчмарки
  toolUseVsAutonomyWeight: 0.6,    // Вес agency в SWE-bench (0=только reasoning, 1=только agency)
  // Категория 7: Углубленные настройки (Test-Time Compute, Штрафы, Шум)
  wmScalingSlope: 0.30,            // Наклон кривой FLOPs -> World Modeling (медленнее логики)
  maxInferenceBonusReasoning: 2.0, // Макс. бонус Test-Time Compute для логики
  maxInferenceBonusAgency: 1.5,    // Макс. бонус Test-Time Compute для автономности
  inferenceSaturationCap: 5.0,     // Порог базового интеллекта, где CoT перестает давать бонус
  reasoningScalingSlope: 0.35,     // Наклон кривой масштабирования (FLOPs -> Reasoning)
  agencyScalingSlope: 0.25,        // Наклон кривой масштабирования (FLOPs -> Agency)
  dataWallPenalty: 0.5,            // Множитель скорости алгоритмов при исчерпании данных (0.5 = падение в 2 раза)
  hypeGapThreshold: 4.0,           // Разрыв между логикой и агентностью для старта Зимы ИИ
  winterDamping: 0.1,              // Строгость Зимы ИИ (множитель инвестиций и алгоритмов)
  observationNoiseSigma: 1.5,      // Уровень доверия к бенчмаркам (меньше = строже фильтр)
};

// Default values for Expert Sandbox (single source of truth)
const DEFAULT_EXPERT_CONFIG = JSON.parse(JSON.stringify(EXPERT_CONFIG));

// ============================================================================
// 3. DATA & HISTORY (API & Fallbacks)
// ============================================================================

// DATA & OBSERVABLES (Dynamic Benchmark History)
// ============================================================================

// URL вашего JSON с актуальными бенчмарками (можно заменить на GitHub Raw или ваш API)
// ============================================================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ ПРИЛОЖЕНИЯ
// ============================================================
let coreTracker = null;
let userObservations = [];
let simulationRunning = false;
let currentResults = null;

const BENCHMARKS_API_URL = 'https://raw.githubusercontent.com/MunchausenLab/ai-metrics/main/benchmarks_history.json';

// Шум (дисперсия) для каждого бенчмарка. Отражает степень доверия к тесту.
const BENCHMARK_SIGMAS = {
  arenaElo: 40.0,    // Elo (LMSYS Chatbot Arena)
  arcAgi: 8.0,       // ARC-AGI (%)
  sweBench: 10.0,    // SWE-bench Verified (%)
  flopsLog: 0.5,     // log10(FLOPs)
  horizon: 0.5,      // log10(autonomous task hours)
  simToReal: 5.0,    // % роботизированных задач, решаемых в реальном мире
  moravec: 6.0,      // Балл Moravec (1-100, моторика+восприятие)
  autoAssembly: 0.5  // log10(часы автономной сборки фабрики)
};

let REAL_BENCHMARK_HISTORY = [];

// Фундаментальная база данных бенчмарков (Данные до 31 мая 2026 года)
// Источники: LMSYS Leaderboard, SWE-bench Official, ARC Prize Reports, Epoch AI.
const FALLBACK_BENCHMARK_HISTORY = [
  // --- РАННЯЯ ЭПОХА (Пре-Агенты) ---
  {
    year: 2022.90, event: "ChatGPT (GPT-3.5)",
    arenaElo: 1000, arcAgi: 3.0, sweBench: 0.0, trainingFlopsLog: 23.5, horizon: 0.5, simToReal: 0.0, moravec: 5.0, autoAssembly: 0.05,
    arenaElo_sigma: 30, arcAgi_sigma: 5, sweBench_sigma: 0.5, trainingFlopsLog_sigma: 0.3, horizon_sigma: 0.3, simToReal_sigma: 0.5, moravec_sigma: 2, autoAssembly_sigma: 0.2,
    notes: "LMSYS base Elo = 1000. Агентность нулевая."
  },
  {
    year: 2023.25, event: "GPT-4 Release",
    arenaElo: 1150, arcAgi: 12.0, sweBench: 0.1, trainingFlopsLog: 25.32, horizon: 1.0, simToReal: 0.0, moravec: 8.0, autoAssembly: 0.1,
    arenaElo_sigma: 30, arcAgi_sigma: 6, sweBench_sigma: 1, trainingFlopsLog_sigma: 0.2, horizon_sigma: 0.3, simToReal_sigma: 0.5, moravec_sigma: 2, autoAssembly_sigma: 0.2,
    notes: "Epoch AI: 2.1e25 FLOPs. Появление зачатков абстрактного рассуждения."
  },
  {
    year: 2023.85, event: "GPT-4 Turbo",
    arenaElo: 1250, arcAgi: 15.0, sweBench: 1.5, trainingFlopsLog: 25.4, horizon: 1.0, simToReal: 0.5, moravec: 10.0, autoAssembly: 0.1,
    arenaElo_sigma: 25, arcAgi_sigma: 6, sweBench_sigma: 2, trainingFlopsLog_sigma: 0.2, horizon_sigma: 0.3, simToReal_sigma: 1, moravec_sigma: 3, autoAssembly_sigma: 0.2,
    notes: "Слабый рост reasoning, улучшенное следование инструкциям."
  },

  // --- ЭПОХА ИНСТРУМЕНТОВ И TTC ---
  {
    year: 2024.20, event: "Claude 3 Opus",
    arenaElo: 1255, arcAgi: 20.0, sweBench: 4.0, trainingFlopsLog: 25.5, horizon: 1.5, simToReal: 1.0, moravec: 12.0, autoAssembly: 0.2,
    arenaElo_sigma: 25, arcAgi_sigma: 7, sweBench_sigma: 3, trainingFlopsLog_sigma: 0.2, horizon_sigma: 0.3, simToReal_sigma: 1, moravec_sigma: 3, autoAssembly_sigma: 0.2,
    notes: "Первое серьезное покушение на лидерство OpenAI в Arena."
  },
  {
    year: 2024.45, event: "Claude 3.5 Sonnet",
    arenaElo: 1270, arcAgi: 43.0, sweBench: 31.4, trainingFlopsLog: 25.55, horizon: 2.0, simToReal: 2.0, moravec: 15.0, autoAssembly: 0.3,
    arenaElo_sigma: 25, arcAgi_sigma: 8, sweBench_sigma: 5, trainingFlopsLog_sigma: 0.2, horizon_sigma: 0.4, simToReal_sigma: 1.5, moravec_sigma: 3, autoAssembly_sigma: 0.2,
    notes: "Шок на SWE-bench (31.4%). Метод Райана Гринблатта показал 43% на ARC-AGI через сэмплирование."
  },
  {
    year: 2024.75, event: "OpenAI o1-preview",
    arenaElo: 1320, arcAgi: 65.0, sweBench: 36.0, trainingFlopsLog: 25.8, horizon: 4.0, simToReal: 4.0, moravec: 18.0, autoAssembly: 0.5,
    arenaElo_sigma: 20, arcAgi_sigma: 6, sweBench_sigma: 5, trainingFlopsLog_sigma: 0.2, horizon_sigma: 0.4, simToReal_sigma: 2, moravec_sigma: 3, autoAssembly_sigma: 0.3,
    notes: "Первый масштабный Test-Time Compute. Резкий рост эффективности на сложных задачах."
  },
  {
    year: 2024.95, event: "OpenAI o3-preview",
    arenaElo: 1350, arcAgi: 87.5, sweBench: 45.0, trainingFlopsLog: 26.0, horizon: 8.0, simToReal: 6.0, moravec: 22.0, autoAssembly: 0.8,
    arenaElo_sigma: 20, arcAgi_sigma: 5, sweBench_sigma: 5, trainingFlopsLog_sigma: 0.2, horizon_sigma: 0.4, simToReal_sigma: 2, moravec_sigma: 4, autoAssembly_sigma: 0.3,
    notes: "Декабрь 2024. ARC-AGI (High Compute) достигает 87.5%, демонстрируя силу RLHF в reasoning."
  },

  // --- МАССОВОЕ МАСШТАБИРОВАНИЕ 2025 ---
  {
    year: 2025.15, event: "GPT-4.5 Preview",
    arenaElo: 1439, arcAgi: 70.0, sweBench: 56.0, trainingFlopsLog: 26.2, horizon: 4.0, simToReal: 8.0, moravec: 25.0, autoAssembly: 1.0,
    arenaElo_sigma: 20, arcAgi_sigma: 5, sweBench_sigma: 4, trainingFlopsLog_sigma: 0.2, horizon_sigma: 0.4, simToReal_sigma: 2, moravec_sigma: 4, autoAssembly_sigma: 0.3,
    notes: "Смещение фокуса на базовую надежность моделей (без тяжелого CoT)."
  },
  {
    year: 2025.30, event: "o3-2025-04-16",
    arenaElo: 1444, arcAgi: 89.0, sweBench: 62.0, trainingFlopsLog: 26.3, horizon: 12.0, simToReal: 10.0, moravec: 28.0, autoAssembly: 1.3,
    arenaElo_sigma: 20, arcAgi_sigma: 5, sweBench_sigma: 4, trainingFlopsLog_sigma: 0.2, horizon_sigma: 0.4, simToReal_sigma: 2, moravec_sigma: 4, autoAssembly_sigma: 0.3,
    notes: "Промежуточный релиз. Улучшенная агентность в средах программирования."
  },
  {
    year: 2025.65, event: "Gemini 2.5 Pro",
    arenaElo: 1456, arcAgi: 82.0, sweBench: 65.0, trainingFlopsLog: 26.5, horizon: 24.0, simToReal: 14.0, moravec: 32.0, autoAssembly: 1.5,
    arenaElo_sigma: 20, arcAgi_sigma: 5, sweBench_sigma: 4, trainingFlopsLog_sigma: 0.2, horizon_sigma: 0.4, simToReal_sigma: 3, moravec_sigma: 4, autoAssembly_sigma: 0.3,
    notes: "Август 2025. Топ-1 LMSYS на момент релиза. Преодолен барьер 1450 Elo."
  },
  {
    year: 2025.95, event: "GPT-5-2 Thinking",
    arenaElo: 1480, arcAgi: 78.7, sweBench: 72.0, trainingFlopsLog: 26.8, horizon: 48.0, simToReal: 18.0, moravec: 38.0, autoAssembly: 1.7,
    arenaElo_sigma: 20, arcAgi_sigma: 5, sweBench_sigma: 4, trainingFlopsLog_sigma: 0.2, horizon_sigma: 0.4, simToReal_sigma: 3, moravec_sigma: 5, autoAssembly_sigma: 0.3,
    notes: "Декабрь 2025. Базовая стоимость reasoning упала в 10 раз ($0.52 за задачу ARC)."
  },

  // --- СОВРЕМЕННЫЙ ФРОНТИР (Первая половина 2026) ---
  {
    year: 2026.15, event: "GPT-5.4 Web",
    arenaElo: 1484, arcAgi: 92.0, sweBench: 78.2, trainingFlopsLog: 26.9, horizon: 72.0, simToReal: 25.0, moravec: 44.0, autoAssembly: 1.8,
    arenaElo_sigma: 20, arcAgi_sigma: 5, sweBench_sigma: 4, trainingFlopsLog_sigma: 0.2, horizon_sigma: 0.4, simToReal_sigma: 4, moravec_sigma: 5, autoAssembly_sigma: 0.3,
    notes: "Массовое внедрение агентов браузинга."
  },
  {
    year: 2026.30, event: "Claude Opus 4.7",
    arenaElo: 1504, arcAgi: 94.0, sweBench: 82.0, trainingFlopsLog: 27.0, horizon: 120.0, simToReal: 35.0, moravec: 50.0, autoAssembly: 1.85,
    arenaElo_sigma: 20, arcAgi_sigma: 5, sweBench_sigma: 4, trainingFlopsLog_sigma: 0.2, horizon_sigma: 0.4, simToReal_sigma: 4, moravec_sigma: 5, autoAssembly_sigma: 0.3,
    notes: "Апрель 2026. Пробит барьер в 1500 Elo. Насыщение оригинального SWE-bench."
  },
  {
    year: 2026.40, event: "GPT-5.5 Pro",
    arenaElo: 1561, arcAgi: 96.5, sweBench: 82.6, trainingFlopsLog: 27.2, horizon: 168.0, simToReal: 50.0, moravec: 60.0, autoAssembly: 1.9,
    arenaElo_sigma: 20, arcAgi_sigma: 4, sweBench_sigma: 3, trainingFlopsLog_sigma: 0.2, horizon_sigma: 0.4, simToReal_sigma: 5, moravec_sigma: 5, autoAssembly_sigma: 0.3,
    notes: "Май 2026. Абсолютный SOTA. Эффективный предел текущих бенчмарков."
  },
  {
    year: 2026.44, event: "Claude Fable 5",
    arenaElo: 1585, arcAgi: 97.2, sweBench: 80.3, trainingFlopsLog: 27.5, horizon: 200.0, simToReal: 55.0, moravec: 62.0, autoAssembly: 2.0,
    arenaElo_sigma: 20, arcAgi_sigma: 4, sweBench_sigma: 4, trainingFlopsLog_sigma: 0.3, horizon_sigma: 0.4, simToReal_sigma: 5, moravec_sigma: 5, autoAssembly_sigma: 0.3,
    notes: "Июнь 2026. Mythos-class модель. SWE-Bench Pro 80.3%, FrontierCode Diamond — лучший среди frontier-моделей. OSWorld-Verified 85.0%. HLE with tools 64.5%. ExploitBench (cybersecurity) 78.0%. HealthBench 66.0%. Computer use 85.0%. GDPval-AA 1932. Сейфгарды на кибербезопасность и биологию (Fable 5 перенапрягает в Opus 4.8 на этих темах). Mythos 5 — та же модель без ограничений, доступна для cyberdefenders через Project Glasswing."
  },
  {
    year: 2026.68, event: "GPT-6 Astra",
    arenaElo: 1610, arcAgi: 98.5, sweBench: 82.0, trainingFlopsLog: 28.2, horizon: 260.0, simToReal: 62.0, moravec: 66.0, autoAssembly: 2.10,
    arenaElo_sigma: 25, arcAgi_sigma: 4, sweBench_sigma: 6, trainingFlopsLog_sigma: 0.3, horizon_sigma: 0.5, simToReal_sigma: 6, moravec_sigma: 5, autoAssembly_sigma: 0.3,
    notes: "3 сентября 2026. ARC-AGI-1 98.5% (High/XHigh), ARC-AGI-2 95.0%, ARC-AGI-3 62.7% на стандартной harness / 99.95% на provider-adapter harness (расхождение из-за инструментария). FrontierMath Tier 4 97.6%, GPQA-D 96.0%, OSWorld 2.0 72.6%, Terminal-Bench 4.0 66.4%, DeepSWE 74.1%, ARC-AGI-3 human parity на 96% уровней. ВНИМАНИЕ: SWE-bench Verified для Astra не опубликован — поле sweBench оценено по DeepSWE/FrontierSWE/SWE-bench Pro и имеет расширенную sigma. Человеческий средний ARC-AGI-3 — 48%."
  },
  {
    year: 2026.72, event: "Claude Opus 5.5",
    arenaElo: 1620, arcAgi: 98.5, sweBench: 82.5, trainingFlopsLog: 28.0, horizon: 280.0, simToReal: 64.0, moravec: 67.0, autoAssembly: 2.15,
    arenaElo_sigma: 25, arcAgi_sigma: 4, sweBench_sigma: 6, trainingFlopsLog_sigma: 0.3, horizon_sigma: 0.5, simToReal_sigma: 6, moravec_sigma: 5, autoAssembly_sigma: 0.3,
    notes: "22 сентября 2026. ARC-AGI-1 98.5% (High), ARC-AGI-2 93.3%. HLE with tools 67.7% (выше Astra 57.2%), Terminal-Bench 4.0 66.4% ±2.6, GDPval-AA 1822 Elo, Artificial Analysis Intelligence Index — топ (58 при max effort). В 2.1 раза быстрее Fable 5.1 при цене на 40% ниже. ВНИМАНИЕ: SWE-bench Verified для Opus 5.5 не опубликован Anthropic — поле sweBench оценено по SWE-bench Pro (89.9% у llm-stats, не подтверждено вендором) и CursorBench 4.0 57.8%, sigma расширена."
  }
];

async function loadHistoricalBenchmarks() {
  const FALLBACK = JSON.parse(JSON.stringify(FALLBACK_BENCHMARK_HISTORY));
  const TIMEOUT_MS = 3000;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const response = await fetch(BENCHMARKS_API_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (data && data.length > 0) {
      REAL_BENCHMARK_HISTORY = data;
      console.log('Benchmarks loaded from API (' + data.length + ' points).');
      return;
    }
  } catch (e) {
    console.warn('[Benchmarks] fetch failed:', e.message, '→ using fallback');
  }
  REAL_BENCHMARK_HISTORY = FALLBACK;
  console.warn('Benchmarks: used fallback data.');
}

// ============================================================================
// REAL ROBOTICS INDEX (Embodiment grounding)
//
// Калибровка на основе публичных данных о серийных гуманоидах и quad-роботах.
// Каждая запись — (год, индекс 0..10, имя модели, capability-флаги).
// Индекс = максимум из {mobility, manipulation, autonomy, dexterity}, усреднённый
// с весом 0.4 / 0.3 / 0.2 / 0.1 (мобильность+манипуляция = "тело", autonomy = "мозг").
// Используется в observeRealData как prior на embodiment_ceiling.
// ============================================================================
const REAL_ROBOTICS_DATA = [
  { year: 2018.0, name: "Boston Dynamics Spot (proto)",     index: 1.5, mobility: 7, manipulation: 0, autonomy: 4, dexterity: 0 },
  { year: 2020.0, name: "Spot (commercial)",                 index: 2.5, mobility: 8, manipulation: 0, autonomy: 6, dexterity: 0 },
  { year: 2021.5, name: "Tesla Optimus Gen 1 (announce)",   index: 1.0, mobility: 3, manipulation: 2, autonomy: 2, dexterity: 2 },
  { year: 2022.5, name: "Optimus Bumblebee",                 index: 1.5, mobility: 3, manipulation: 3, autonomy: 2, dexterity: 3 },
  { year: 2023.5, name: "1X Neo Beta / Figure 01",           index: 2.5, mobility: 5, manipulation: 4, autonomy: 3, dexterity: 4 },
  { year: 2024.0, name: "Apptronik Apollo / Figure 02",     index: 3.5, mobility: 6, manipulation: 5, autonomy: 4, dexterity: 5 },
  { year: 2024.5, name: "Unitree H1 (commercial)",          index: 3.0, mobility: 7, manipulation: 3, autonomy: 3, dexterity: 4 },
  { year: 2025.0, name: "Optimus Gen 2 / Figure 02 prod",   index: 4.5, mobility: 7, manipulation: 6, autonomy: 5, dexterity: 6 },
  { year: 2025.5, name: "1X Neo Home (limited deploy)",     index: 5.0, mobility: 7, manipulation: 7, autonomy: 5, dexterity: 7 },
  { year: 2026.0, name: "Optimus Gen 3 / Figure 03 (forecast)", index: 6.0, mobility: 8, manipulation: 8, autonomy: 6, dexterity: 8 },
  { year: 2027.0, name: "Mass humanoid pilot (forecast)",  index: 7.0, mobility: 8, manipulation: 9, autonomy: 7, dexterity: 8 },
  { year: 2028.5, name: "Factory fleet (forecast)",         index: 8.0, mobility: 9, manipulation: 9, autonomy: 8, dexterity: 9 }
];

// ============================================================================
// 4. MAPPING (Latent Engine -> Observable Reality)
// ============================================================================

// Линейная интерполяция realEmbodimentIndex по году
function realEmbodimentIndexAt(year) {
  if (year <= REAL_ROBOTICS_DATA[0].year) return REAL_ROBOTICS_DATA[0].index;
  if (year >= REAL_ROBOTICS_DATA[REAL_ROBOTICS_DATA.length - 1].year) {
    return REAL_ROBOTICS_DATA[REAL_ROBOTICS_DATA.length - 1].index;
  }
  for (let i = 0; i < REAL_ROBOTICS_DATA.length - 1; i++) {
    const a = REAL_ROBOTICS_DATA[i], b = REAL_ROBOTICS_DATA[i + 1];
    if (year >= a.year && year <= b.year) {
      const t = (year - a.year) / (b.year - a.year);
      return a.index + t * (b.index - a.index);
    }
  }
  return 0;
}

// Преобразование латентных переменных трекера в численные бенчмарки
// r10, a10 — reasoning и agency в шкале модели (0..~15)
// Возвращает предсказанные значения бенчмарков + log10(FLOPs) для сопоставления с training compute
function getNumericObservables(r10, a10, e10, expertCfg) {
    const autonomyWeight = expertCfg ? expertCfg.toolUseVsAutonomyWeight : 0.6;
    const reasoningWeight = 1.0 - autonomyWeight;
    const blendedReasoning = r10 * reasoningWeight + a10 * autonomyWeight;
    const embodimentVal = (typeof e10 === 'number') ? e10 : 4.0; // fallback если не передано

    // --- ПАТЧ 4: Социотехническая перекалибровка (v5.0) ---
    // P (Persuasion) - способность быть убедительным для человека.
    // Так как W (World Modeling) сюда не передается напрямую, мы аппроксимируем его как W ≈ R.
    const w10 = r10;
    const P = Math.cbrt(r10 * w10 * a10);
    // -------------------------------------------------------

    return {
        sweBench: 100 * sigmoid(0.55 * blendedReasoning - 2.5),
        arcAgi: 100 * sigmoid(0.6 * r10 - 4.0),

        // Chatbot Arena теперь измеряет Убедительность (P), а не чистый интеллект (R)
        arenaElo: 800 + 70 * P,

        flopsLog: 23.5 + 0.3 * r10,
        horizon: Math.log10(Math.min(365 * 24, 0.5 * Math.exp(0.5 * a10))),
        simToReal: 100 * sigmoid(0.5 * embodimentVal - 2.5),
        moravec: Math.max(0, Math.min(100, 2 + 7.5 * (embodimentVal - 0.5))),
        autoAssembly: Math.log10(Math.max(0.1, 0.5 * Math.exp(0.7 * embodimentVal)))
    };
}

// ============================================================================
// 5. MATH & PHYSICS ENGINE (Particle Filter)
// ============================================================================

const DEFAULT_PARTICLES = 1000;

// Forecast origin — PINNED, deliberately not read from the wall clock.
//
// A fixed seed makes the RANDOM STREAM reproducible and says nothing about the
// model INPUTS. With the origin taken from `new Date()`, the same seed produces
// different numbers next month, which makes a published forecast impossible to
// reproduce or cite: a reader who reruns it gets a different answer and no way
// to tell whether the model changed or the calendar did. Advancing the forecast
// is now an explicit, reviewable edit of this one constant.
//
// Set to 2026.75 (Q3 2026). The benchmark history runs to 2026.44, so this
// extrapolates about a quarter beyond the last observation. Override only in
// tests via createConfig({ currentYear }).
const PINNED_CURRENT_YEAR = 2026.75;

function createConfig(overrides = {}) {
  return {
    BASE_YEAR: 2023.0,          // Якорь (уровень GPT-4)
    BASE_LOG_FLOPS: 24.5,       // Начальные FLOPs в 2023
    CURRENT_YEAR: (overrides && typeof overrides.currentYear === 'number')
      ? overrides.currentYear
      : PINNED_CURRENT_YEAR,
    // Only t1 is a capability threshold and the only one a stage trigger
    // reads. t2/t3/t4 are sociotechnical and live in EXPERT_CONFIG as
    // t2DemandThreshold, t2LegitimacyThreshold, t3CaptureThreshold and
    // t4DependencyThreshold.
    THRESHOLDS: { t1: EXPERT_CONFIG.t1Threshold },
    DIMENSIONS: {
      reasoning: { slope: EXPERT_CONFIG.reasoningScalingSlope, ceiling: EXPERT_CONFIG.ceilingReasoningBase },
      agency:    { slope: EXPERT_CONFIG.agencyScalingSlope }, // Потолок определяет частица
      worldModeling: { slope: EXPERT_CONFIG.wmScalingSlope, ceiling: EXPERT_CONFIG.ceilingWorldModelingBase },
    },
    // Глубокое копирование защищает текущую симуляцию от live-мутаций ползунков
    EXPERT: JSON.parse(JSON.stringify(EXPERT_CONFIG)),
    INFERENCE_SCALING: {
      max_bonus_reasoning: EXPERT_CONFIG.maxInferenceBonusReasoning,
      max_bonus_agency: EXPERT_CONFIG.maxInferenceBonusAgency,
      saturation_cap: EXPERT_CONFIG.inferenceSaturationCap
    },
    SCALING_LAW: { paradigm_shift_prob: 0.20, shift_multiplier: 3.0,
                   endo_base: 0.05, endo_pressure: 0.8, endo_exhaust: 0.5 },
    BOTTLENECKS: { energy_wall_start: 2026.0, energy_damping: 0.10, econ_wall_start: 2026.5, econ_damping: 0.15 },
  };
}

function computeDim(logDiff, slope, ceiling) {
  // Исправлено: при logDiff->inf сигмоида дает 1.0, формула возвращает ceiling.
  // При logDiff=0 сигмоида дает 0.5, формула возвращает 1.0.
  return Math.max(1.0 + (ceiling - 1.0) * (sigmoid(slope * logDiff) - 0.5) * 2.0, 0.01);
}

function applyInference(rawCap, maxBonus, satCap) {
  if (maxBonus <= 1.0) return rawCap;
  const k = Math.LN2 / satCap;
  const bonus = (maxBonus - 1.0) * (1.0 - Math.exp(-k * rawCap));
  return rawCap * (1.0 + bonus);
}

function calculateRSI(S, C, expertCfg) {
  // 1. Активация на базе Науки и Координации
  const actS = sigmoid(1.2 * (S - (expertCfg.rsiTriggerReasoning - 2.0)));
  const actC = sigmoid(1.2 * (C - (expertCfg.rsiTriggerAgency - 2.0)));
  const rsiActivation = actS * actC;

  // 2. Базовый потенциал рекурсивного улучшения растёт от Науки (S)
  const baseRsi = 0.015 * Math.pow(Math.max(0, S), 1.5) * expertCfg.rsiMultiplier;

  // 3. Координационное трение встроено в ось C, здесь просто произведение
  return Math.min(2.0, baseRsi * rsiActivation);
}

// ==========================================================================
// 5a. UNIFIED PHYSICS KERNEL  (single source of truth)
//
// HISTORY / WHY THIS EXISTS
// -------------------------
// The model previously had TWO independent ~200-line implementations of the
// same dynamics:
//   Engine A  simulateToYear()             -> fed the particle-filter LIKELIHOOD
//   Engine B  runMonteCarloForecast() loop -> produced the PUBLISHED FORECAST
// They had drifted apart (different paradigm-shift logic, different shock
// handling, different embodiment integration). That made the posterior update
// calibrate parameters against a different physical model than the one that
// produced the answer — the posterior was meaningless.
//
// Now there is exactly ONE step function, `stepDynamics()`, below. Both the
// deterministic likelihood path and the stochastic Monte-Carlo path call it.
// The only difference between them is `stochastic`: when false, all Bernoulli
// shocks use their *expected* rate analytically instead of sampling. Same
// equations, same constants, same order of operations.
// ==========================================================================

// Create a fresh simulation state for one particle.
function createSimState(particle, cfg) {
  const E = cfg.EXPERT;
  const st = {
    flopsLog: cfg.BASE_LOG_FLOPS,
    algoLog: 0,
    stateR: 0, stateA: 0, stateW: 0, stateE: 0,
    ceilingR: cfg.DIMENSIONS.reasoning.ceiling,
    ceilingA: particle.agency_ceiling,
    ceilingWM: cfg.DIMENSIONS.worldModeling.ceiling,
    ceilingE: particle.embodiment_ceiling || E.embodimentPriorMean,
    hwK: Math.log(2) / Math.max(1.0, particle.hw_months / 12.0),
    algoK: Math.log(2) / Math.max(1.0, particle.algo_months / 12.0),
    roboticsFrontier: EMBODIMENT_REALITY_ANCHOR,
    paradigmGeneration: 0,
    lastShiftYear: cfg.BASE_YEAR,
    hypeGracePeriod: 0,
    algoKMult: 1.0,
    dataExhaustionHit: false,
    isWinter: false,
    gpuBubbleBurst: false,
    alignmentIncidentCooldown: 0,
    stateIntervention: false,
    interventionCooldown: 0,
    IL: 0, IC: 0, II: 0,
    // Effective veto force this year: veto_strength decays as resistance
    // tires, and is 0 until delegation pressure makes the dependency visible.
    vetoActive: 0,
    // Share of significant economic and institutional decisions still made by
    // people. Starts high: societies are not already captured at the present,
    // and a model of disengagement that begins at 0.5 would be assuming the
    // conclusion.
    humanAgency: E.humanAgencyInitial !== undefined ? E.humanAgencyInitial : 0.85,
    yT1: null, yT2: null, yT3: null, yT4: null,
    world_model: particle.world_model,
    rsi_efficiency: particle.rsi_efficiency || 1.0,
  };

  // World-model priors applied up front (identical for both engines).
  if (particle.world_model === 'hard_wall') {
    st.ceilingA = Math.min(st.ceilingA, E.plateauHardWallCeiling);
    st.ceilingE = Math.min(st.ceilingE, 4.0);
  } else if (particle.world_model === 'slow_takeoff') {
    st.algoK *= 0.6;
  }
  return st;
}

// Advance one month. Mutates `st`. `stochastic` selects sampling vs expectation.
function stepDynamics(st, cfg, dt, stochastic, particle) {
  const E = cfg.EXPERT;
  const p = st.world_model;
  const year = cfg.BASE_YEAR + (st.step || 0) * dt;

  // ---- Capability dimensions (independent log-diffusion states) ----------
  const rawR = computeDim(st.stateR, cfg.DIMENSIONS.reasoning.slope, st.ceilingR);
  const rawA = computeDim(st.stateA, cfg.DIMENSIONS.agency.slope, st.ceilingA);
  const rawE_ai = computeDim(st.stateE, E.embodimentScalingSlope, st.ceilingE);
  const rawWM = computeDim(st.stateW, cfg.DIMENSIONS.worldModeling.slope, st.ceilingWM);

  const R = applyInference(rawR, cfg.INFERENCE_SCALING.max_bonus_reasoning, cfg.INFERENCE_SCALING.saturation_cap);
  const A = applyInference(rawA, cfg.INFERENCE_SCALING.max_bonus_agency, cfg.INFERENCE_SCALING.saturation_cap);
  const aiEmbodiment = applyInference(rawE_ai, cfg.INFERENCE_SCALING.max_bonus_agency * 0.5, cfg.INFERENCE_SCALING.saturation_cap);
  const Emb = Math.min(aiEmbodiment, st.roboticsFrontier); // Robotics Reality Layer
  const W = applyInference(rawWM, 1.2, cfg.INFERENCE_SCALING.saturation_cap);

  // ---- Derived civilizational capability ---------------------------------
  const C = Math.sqrt(A * W) * Math.max(0, 1.0 - E.coordinationFriction);
  const S = Math.pow(R, 0.4) * Math.pow(W, 0.4) * Math.pow(A, 0.2);
  const M = Math.sqrt(Emb * C);
  const cap = Math.cbrt(R * A * W);

  // ---- Sociotechnical layer ------------------------------------------------
  const P = Math.cbrt(R * W * A);
  const DP = sigmoid(0.5 * P + 0.3 * A - 5.0);
  const socialTension = Math.max(0, DP - IL(st));

  st.IL += 0.5 * DP * (1.0 - st.IL) * dt;
  // II is a 0..1 share and is consumed as (1 - II) below, so exceeding 1 would
  // flip its sign and invert what it is supposed to mean. Explicit Euler on
  // dX/dt = k(1-X) overshoots only when k*dt >= 1; here k = 0.1*A and
  // A <= agencyCeiling (~15), with dt = 1/12 everywhere, so k*dt is about 0.125
  // — well inside the stable region and no overflow is reachable today. This
  // clamp is therefore insurance rather than a repair: it makes the invariant
  // explicit and holds it if the step or the ceiling ever changes. IL is
  // already bounded because its k = 0.5*DP is at most 0.5.
  // Read from st.humanAgency directly rather than from the captureGate computed
  // further down, because II is updated before the human-agency section runs.
  const captureGateII = Math.max(0.0, Math.min(1.0,
    (st.humanAgency - E.humanAgencyCaptureGate) / (1.0 - E.humanAgencyCaptureGate)));
  // II is irreversibility: the share of dependence that cannot be undone by
  // removing the system. It is gated on humanAgency for the same reason IC is:
  // embedding proceeds while people still hold the decision loop, but not at
  // full speed, and a society that keeps deciding for itself accumulates
  // recoverable dependence rather than irreversible dependence.
  //
  // This also fixes a divergence the test caught. resilient_civ caps IC at 1-II,
  // and II grew to 1.0 regardless of human agency, so in that hypothesis IC was
  // pinned at 0 before capture could start and T3 never fired -- the
  // T3-without-T4 window the test looks for closed, and the check failed
  // (T3=T4=36 where the committed baseline had T3=19, T4=17, T3-only=2). The
  // interaction is real: a gate that slows capture lets irreversible embedding
  // outrun it. Gating II on the same quantity keeps the two mechanisms coherent
  // instead of letting one silently disable the other.
  st.II = Math.min(1.0, st.II
    + 0.1 * A * (1.0 - st.II) * (0.35 + 0.65 * captureGateII) * dt);
  // IC growth itself moved below, into the human-agency section, so that it can be
  // gated on people still holding the decision loop. Leaving the ungated term here
  // as well would have doubled the capture rate, since both lines incremented IC
  // by the same amount every month.

  // ---- Institutional veto -------------------------------------------------
  // The only hard limit on IC before this was the resilient_civ branch below
  // (IC <= 1 - II), which applied to one hypothesis and read as a side effect
  // of its label. Governance elsewhere only scaled growth, so the expected
  // value of resistance was a delay and never a prevention -- every
  // hypothesis answered "how fast", none answered "does it happen".
  //
  // Now resistance is a latent per-particle property. Once delegation pressure
  // makes the dependency visible, institutions willing to withhold compliance
  // hold IC below the T3 capture threshold, so T3 does not fire at all and T4
  // cannot follow (DR requires institutional control). This is a veto rather
  // than a damper: it changes whether the stage happens, not when.
  //
  // vetoActive relaxes TOWARD veto_strength while the dependency is visible,
  // and is always eroded by institutionalVetoDecay ("resistance tires"). The
  // steady state is therefore veto_strength - decay/ramp, not veto_strength.
  //
  // This is the second version of this term. The first integrated
  // (veto_strength - decay) * dt with no restoring term and no bound, so
  // vetoActive grew without limit for every particle whose veto_strength
  // exceeded the decay rate — which is nearly all of them, since the prior is
  // N(0.5, 0.2) and decay is 0.15. Measured effect of that version: T3
  // essentially unreachable (0% of runs), and the world-model posterior thrown
  // to 93.5% resilient_civ from a 2.5% baseline, because the likelihood path
  // was distorted rather than merely constrained. A veto that binds for the
  // entire population is not a veto, it is a hard wall wearing a veto's name.
  const vetoRaw = (particle && particle.veto_strength !== undefined)
    ? particle.veto_strength : E.institutionalVetoStrength;
  if (DP > E.institutionalVetoOnset) {
    // Relax toward this particle's own resistance level, not toward 1.0.
    // Using (1 - vetoActive) as the driver made every particle converge to the
    // same ceiling and ignored veto_strength entirely, which is the latent
    // quantity the filter is supposed to learn about.
    st.vetoActive += (vetoRaw - st.vetoActive) * E.institutionalVetoRamp * dt;
  }
  st.vetoActive = Math.max(0.0, st.vetoActive - E.institutionalVetoDecay * dt);
  st.vetoActive = Math.min(1.0, st.vetoActive);
  if (st.vetoActive > E.institutionalVetoThreshold) {
    // Hold IC just under the capture threshold: enough to keep T3 from firing,
    // not so much that the economy visibly stalls.
    const cap = E.t3CaptureThreshold * 0.97;
    st.IC = Math.min(st.IC, cap);
  }

  // ---- Human agency --------------------------------------------------------
  // The only human-side variable in the model. Before this the ladder of
  // "stages of disengagement" was measured entirely from the artifact side:
  // IC grows from IL, IL grows from DP, DP grows from P and A. That chain is
  // closed on itself, so T3 could not fail to arrive in any world -- the model
  // had no quantity that could lose.
  //
  // humanAgency is the share of significant economic and institutional
  // decisions still made by people. It is not employment and not skill; it is
  // the position in the decision loop. It erodes as delegation pays off, and is
  // restored by incidents, state intervention and institutional resistance.
  //
  // It feeds back into capture: institutions cannot be captured while people
  // still hold the decisive position, so IC growth is gated on humanAgency.
  // This is what makes T3 a question rather than a schedule.
  let haDelta = -E.humanAgencyDecay * dt;
  // Delegation pays in proportion to how good the machine is relative to what
  // people can do unaided. Saturating above A = 12 keeps a fast model from
  // erasing human agency in a single decade.
  haDelta += E.humanAgencyDelegationGain
           * Math.min(1.0, Math.max(0.0, (A - 4.0) / 8.0)) * dt;

  // Recovery terms are proportional to the LOSS, not standing additions. See the
  // calibration warning on these parameters: as flat +rates they dominated the
  // erosion and pushed humanAgency to 1.0, which made the capture gate inert.
  // Scaling by (1 - humanAgency) means an incident can restore authority after
  // it has been ceded, but can never manufacture authority that erosion has
  // already spent -- the difference between recovery and growth.
  const haLoss = 1.0 - st.humanAgency;
  // Resistance counts before it is strong enough to bind. Gating this bonus on
  // st.vetoActive > institutionalVetoThreshold meant it applied only to the ~16%
  // of particles whose veto actually binds, so in every other world people had
  // NO institutional resistance at all -- a discontinuous cliff at a threshold
  // the page never shows. Scaled by the ratio instead, so a near-binding veto
  // holds most of the position and a binding one holds all of it.
  // NOTE ON SIGN. This term SLOWS erosion rather than reversing it, and the
  // distinction is load-bearing. A recovery term of the form +k*(1 - ha) pulls
  // ha back UP toward 1.0, which is right for an incident (authority is
  // temporarily restored) but exactly backwards for resistance: institutional
  // vetoes do not hand decision-making power back to the public, they prevent
  // it from being ceded. So veto resistance is applied as a damping factor on
  // the EROSION term, not as a positive contribution.
  //
  // The first version added +1.4*vetoRatio*(1-ha), which made the steady state
  // ha = 1 - (decay - gain)/(vetoBonus*vetoRatio) -- i.e. STRONGER resistance
  // drove ha toward 0.91, above the 0.40 gate. Measured across three arms the
  // reach of T3 stayed at 98% and the median moved the wrong way, so the sign
  // error was invisible in aggregate while being plainly wrong in the algebra.
  const vetoRatio = Math.max(0.0, Math.min(1.0,
    st.vetoActive / Math.max(1e-9, E.institutionalVetoThreshold)));
  const erosionScale = 1.0 - Math.min(0.85, E.humanAgencyVetoBonus * vetoRatio);
  haDelta *= erosionScale;
  if (st.stateIntervention) {
    haDelta += E.humanAgencyInterventionBonus * haLoss * dt;
  }
  if (st.alignmentIncidentCooldown > 0) {
    haDelta += E.humanAgencyRecover * haLoss * dt;
  }
  st.humanAgency = Math.max(E.humanAgencyFloor, Math.min(1.0, st.humanAgency + haDelta));

  // IC growth requires people to be out of the loop. Below the gate, capture
  // essentially stops: institutions cannot be captured by a system that
  // humans still decide for. Multiplied into the existing term rather than
  // applied as a separate cap, so the two mechanisms compose instead of
  // fighting.
  const captureGate = Math.max(0.0, Math.min(1.0,
    (st.humanAgency - E.humanAgencyCaptureGate) / (1.0 - E.humanAgencyCaptureGate)));
  st.IC = Math.min(1.0, st.IC
    + 0.2 * st.IL * Math.max(0, (A - 4.0) / 10.0) * captureGate * dt);

  if (p === 'resilient_civ') {
    st.IC = Math.min(st.IC, Math.max(0, 1.0 - st.II));
  }
  const DR = computeDependency(st.IC, Emb, E);

  // ---- Cultural shock (anti-AI backlash) ----------------------------------
  // Bernoulli event at rate (socialTension*0.5) per year.
  //
  // This used to read:
  //     const shockDraw = stochastic ? rnd() : shockRate;
  //     if (socialTension > 0.4 && shockDraw < shockRate) { ... }
  // which is unsatisfiable when stochastic is false — the test reduces to
  // `shockRate < shockRate` — so the likelihood path could never see a cultural
  // shock while the forecast path could. That contradicted the invariant
  // stated lower down ("both paths sample the SAME Bernoulli event from the
  // SAME kernel; determinism comes from the caller seeding the stream"), and it
  // made this the only event in the function gated on `stochastic`; every
  // sibling below (data wall, alignment incident, GPU bubble, AI winter,
  // geopolitics, paradigm shift) samples unconditionally. simulateToYear()
  // re-seeds per observation, so drawing here is reproducible, not random.
  const shockRate = (socialTension * 0.5) * dt;
  if (socialTension > 0.4 && rnd() < shockRate) {
    st.IL *= 0.3;
    st.IC *= 0.1;
    st.stateIntervention = true;
    st.interventionCooldown = 5.0;
  }

  // ---- Paradigm shift (Poisson) -------------------------------------------
  const canShift = (st.paradigmGeneration === 0 && year > 2026.5)
                 || (st.paradigmGeneration > 0 && year > st.lastShiftYear + 4.0);
  if (canShift) {
    const saturation = S / st.ceilingR;
    if (saturation > E.saturationThreshold) {
      const marketUtility = R * 0.3 + A * 0.7;
      const investorExpectations = (year - 2023.0) * 1.5;
      const capMult = Math.max(0.1, Math.min(E.maxCapitalMultiplier,
        marketUtility / Math.max(1.0, investorExpectations)));
      const hypeMult = (st.paradigmGeneration > 0 && st.hypeGracePeriod > 0) ? Math.max(capMult, 2.0) : capMult;
      const computeOverhang = Math.max(1.0, hypeMult);
      let shiftProb = 0.02 + (0.15 * saturation) + (E.overhangShiftMultiplier * computeOverhang);
      if (p === 'hard_wall') shiftProb = 0.001;

      // Both paths sample the SAME Bernoulli event from the SAME kernel.
      // Determinism comes from the caller seeding the stream per observation
      // (see simulateToYear's wrapper), not from a different equation.
      if (rnd() < shiftProb * dt) applyParadigmShift(st, cfg);
    }
  }

  // Decay of the current paradigm's effects
  if (st.paradigmGeneration > 0) {
    if (st.hypeGracePeriod > 0) st.hypeGracePeriod -= dt;
    if (st.algoKMult > 1.0) {
      st.algoKMult -= (1.0 / 4.0) * dt;
      if (st.algoKMult < 1.0) st.algoKMult = 1.0;
    }
  }

  // ---- Shocks: data wall, alignment incident, GPU bubble ------------------
  // All shocks are Bernoulli events sampled from the shared stream. The
  // likelihood path is made reproducible by re-seeding in simulateToYear().
  let shockDamping = 1.0;

  if (!st.dataExhaustionHit && year > 2026.5 && rnd() < 0.15 * dt) {
    st.dataExhaustionHit = true;
  }

  if (st.alignmentIncidentCooldown <= 0 && A > 6.0 && rnd() < (A * 0.01) * dt) {
    st.alignmentIncidentCooldown = E.alignmentCooldown;
  }
  if (st.alignmentIncidentCooldown > 0) {
    st.alignmentIncidentCooldown -= dt;
    shockDamping = 0.0;
  }
  // Pre-existing bug, found while tracing humanAgency: the decrement above can
  // take the cooldown negative, and the re-arm test at the top reads `<= 0`, so
  // it does re-arm. What it did NOT do was stop drifting -- a cooldown stuck at
  // -0.083 is still <= 0, so it re-armed, but the leftover was carried into the
  // shockDamping comparison and any other consumer reading the raw value saw a
  // negative countdown. Clamping here keeps the invariant that a spent cooldown
  // is exactly zero.
  if (st.alignmentIncidentCooldown < 0) st.alignmentIncidentCooldown = 0;

  if (!st.gpuBubbleBurst && year > 2027.0 && A < 4.0 && rnd() < E.bubbleBurstRisk * dt) {
    st.gpuBubbleBurst = true;
    st.flopsLog -= 0.5;
  }
  if (st.gpuBubbleBurst) shockDamping *= 0.2;

  // ---- Reality barriers ---------------------------------------------------
  let damping = 1.0;

  // Geopolitics: state intervention while capture is still low.
  const interventionRisk = Math.max(0, DP - st.IC * 2.0) * E.barrierGeopoliticsRisk;
  if (st.IL > 0.2 && st.IC < 0.5 && !st.stateIntervention && rnd() < interventionRisk * dt) {
    st.stateIntervention = true;
    st.interventionCooldown = 3.0;
  }
  if (st.stateIntervention) {
    st.interventionCooldown -= dt;
    if (st.interventionCooldown <= 0) st.stateIntervention = false;
  }
  if (st.stateIntervention) damping *= 0.1;

  // Black Queen: coordination friction once deeply embedded
  let nashDamping = 1.0;
  if (st.IC > 0.6) nashDamping = 1.0 / (1.0 + E.barrierNashFriction * (st.IC - 0.6) * 10.0);

  // Demand shock: smart but not trusted
  let demandDamping = 1.0;
  if (R > 8.0 && DP < 0.3) demandDamping = 0.6;

  // AI winter
  if (!st.isWinter && year > 2026.5 && (R - A) > E.hypeGapThreshold && rnd() < 0.10 * dt) {
    st.isWinter = true;
  }
  if (st.isWinter) {
    damping = E.winterDamping;
    if (A >= R - 1.0) st.isWinter = false;
  } else if (year > cfg.BOTTLENECKS.econ_wall_start && (R - A) > 2.0) {
    damping *= Math.exp(-cfg.BOTTLENECKS.econ_damping * (R - A - 2.0));
  }

  // Compute governance: expected-value damping (same in both paths).
  const govFactor = E.governanceMoratoriumProb * E.governanceShockDamping
                  + (1.0 - E.governanceMoratoriumProb);
  damping *= govFactor;

  // ---- RSI ----------------------------------------------------------------
  const epistemicFriction = 1.0 / Math.max(1.0, st.paradigmGeneration * 1.5);
  const rsiEfficiency = st.isWinter ? 0.2 : 1.0;
  const rsi = calculateRSI(S, C, E) * rsiEfficiency * st.rsi_efficiency * epistemicFriction;

  // ---- Capital & hardware co-design ---------------------------------------
  const marketUtility = R * 0.3 + A * 0.7;
  const investorExpectations = (year - 2023.0) * 1.5;
  let capitalMultiplier = Math.max(0.1, Math.min(E.maxCapitalMultiplier,
    (marketUtility / Math.max(1.0, investorExpectations)) + (st.IL * 2.0)));
  if (st.paradigmGeneration > 0 && st.hypeGracePeriod > 0) {
    capitalMultiplier = Math.max(capitalMultiplier, 2.0);
  }
  const hwAct = sigmoid(1.0 * (R - 7.5)) * sigmoid(1.0 * (A - 5.0));
  const hardwareCoDesign = 1.0 + (E.hwCoDesignBonus - 1.0) * hwAct;

  // ---- HW growth under all constraints ------------------------------------
  const computeInvestment = st.hwK * capitalMultiplier * hardwareCoDesign;
  const energyAvailability = Math.max(0, (E.barrierEnergyLog - st.flopsLog) * 0.8);
  const bypassActivation = sigmoid(1.5 * (Emb - E.embodimentBypassThreshold));
  const fabCapacity = st.hwK * 1.5 * (1.0 + bypassActivation * 2.0);
  const talentBottleneck = st.dataExhaustionHit ? 0.4 : 1.5;

  let effectiveHwK = Math.min(
    computeInvestment, energyAvailability, fabCapacity, talentBottleneck,
    E.maxPhysicalHwGrowth, E.barrierAtomsLimit * Math.LN2);
  effectiveHwK *= damping * nashDamping * demandDamping;
  if (st.gpuBubbleBurst) effectiveHwK *= 0.2;

  // ---- Integrate ----------------------------------------------------------
  const hwDelta = effectiveHwK * shockDamping;
  const algoShockDamping = st.gpuBubbleBurst ? shockDamping * 0.2 : shockDamping;
  let currentAlgoK = st.algoK * st.algoKMult * damping * nashDamping * demandDamping;
  if (st.dataExhaustionHit) currentAlgoK *= E.dataWallPenalty;
  const algoDelta = (currentAlgoK + rsi) * algoShockDamping;

  const dCompute = (hwDelta + algoDelta) * dt;
  st.stateR += dCompute;
  // ---- Grounding: the acquisition mechanism for the R >> W gap -------------
  // Previously stateE advanced only from compute, so reasoning outran physical
  // grounding with no cost and no consequence. Measured before this change,
  // R/W settled at 1.85-3.12 across the four hypotheses and never closed.
  //
  // Part of new reasoning is now ANCHORED into a world model. The anchoring is
  // bounded (groundingRateMax) so reasoning can still outrun it -- the gap is
  // allowed to open, and it closes only as fast as grounding absorbs -- and
  // only groundingEfficiency of it ever reaches matter, because sensors,
  // energy and experiment throughput are rate-limited no matter how good the
  // reasoning is.
  const anchoring = Math.min(E.groundingRateMax,
    E.groundingRate * (R / Math.max(1e-9, st.ceilingR))) * Math.max(0, dCompute);
  st.stateW += anchoring;

  st.stateE += 0.5 * dCompute + 0.2 * (A / st.ceilingA) * Math.max(0, dCompute)
             + E.groundingEfficiency * anchoring;

  // Anchoring is not free: it consumes capability that would otherwise have
  // become agency. Without this cost the new term is a pure subsidy -- the gap
  // would close while T3 got FASTER, which is an improvement on paper and a
  // worse model, since the point of grounding is that it diverts effort away
  // from getting things done.
  const agencyLeak = E.groundingLabourCost * anchoring;
  st.stateA += 0.4 * dCompute
             + (0.3 * (R / st.ceilingR) + 0.3 * (W / st.ceilingWM)) * Math.max(0, dCompute)
             - agencyLeak;

  // World Modeling: epistemically grounded, wet-lab rate limited
  const digitalGrounding = sigmoid(0.5 * (A - 5.0));
  const physicalGrounding = sigmoid(1.0 * (Emb - 3.0));
  const epistemicGrounding = 0.3 + 0.4 * digitalGrounding + 0.3 * physicalGrounding;
  const dW_ideal = (0.6 * dCompute * epistemicGrounding) + (0.2 * (R / st.ceilingR)) * Math.max(0, dCompute);
  st.stateW += Math.min(dW_ideal, E.maxPhysicalExperimentRate * dt);

  st.roboticsFrontier += (EMBODIMENT_BUILD_BASE_SPEED + 0.15 * sigmoid(Emb - 4.5)) * dt;

  st.flopsLog += hwDelta * dt;
  st.algoLog += algoDelta * dt;

  // ---- Thresholds ---------------------------------------------------------
  if (st.yT1 === null && R >= cfg.THRESHOLDS.t1 && W >= cfg.THRESHOLDS.t1 * 0.6) st.yT1 = year;
  // T2/T3/T4 previously fired on literals here while the expert panel
  // exposed t2Threshold/t3Threshold/t4Threshold as sliders that nothing
  // read. The sliders moved; the forecast did not. The values below are
  // the literals that were here, so the default forecast is unchanged.
  if (st.yT2 === null && DP > E.t2DemandThreshold && st.IL > E.t2LegitimacyThreshold) st.yT2 = year;
  if (st.yT3 === null && st.IC > E.t3CaptureThreshold) st.yT3 = year;
  if (st.yT4 === null && DR > E.t4DependencyThreshold && Emb >= E.embodimentT4Requirement) st.yT4 = year;

  st.step = (st.step || 0) + 1;
  return { R, A, W, Emb, DP, IL: st.IL, IC: st.IC, II: st.II, DR, S, C, M, cap, P,
           // vetoActive is the only readout of whether institutional resistance
           // is currently binding. Without it in the return, the veto could not
           // be diagnosed at all: an IC plateau looked identical to a plateau
           // caused by the resilient_civ branch.
           vetoActive: st.vetoActive,
           // humanAgency is the human-side share of decisions. Exposed for the
           // same reason: a T3 that is merely late and a T3 that never arrives
           // look identical from the stage medians alone.
           humanAgency: st.humanAgency };
}

function IL(st) { return st.IL; }

// Civilizational Dependency Ratio.
//
// The physical term is normalised by `embodimentT4Requirement` (the same gate
// T4 uses), NOT by 10.0. With the old /10.0 scale the physical term could only
// reach 0.6 at the T4 embodiment gate, so DR > 0.9 required E ≈ 8.4 while the
// code's own gate said E ≥ 6 — and because T4 then implied a far higher IC than
// T3's IC > 0.6 trigger, T3 became a perfect predictor of T4 (zero incremental
// information). Normalising both terms to the T4 thresholds makes DR = 1
// exactly at the T4 boundary, so T3 (IC > 0.6) can fire while embodiment is
// still climbing and T4 remains a strictly later, physically-gated event.
function computeDependency(IC, Emb, E) {
  const icEff = Math.min(Math.max(0, IC), E.drInstitutionalSaturation);
  const physGate = Math.max(0.01, E.embodimentT4Requirement);
  const phys = Math.min(1.0, Math.max(0, Emb) / physGate);
  return E.drInstitutionalWeight * icEff + E.drPhysicalWeight * phys;
}

function applyParadigmShift(st, cfg, mult) {
  const E = cfg.EXPERT;
  st.paradigmGeneration++;
  st.lastShiftYear = cfg.BASE_YEAR + (st.step || 0) * (1.0 / 12.0);
  st.hypeGracePeriod = E.hypeGracePeriod;
  let shiftMult = Math.max(E.minShiftMultiplier,
    E.baseShiftMultiplier - ((st.paradigmGeneration - 1) * E.paradigmDecayRate));
  if (st.world_model === 'slow_takeoff' && st.paradigmGeneration === 1) {
    shiftMult = Math.max(shiftMult, 5.0);
  }
  st.ceilingA *= shiftMult;
  st.ceilingR *= shiftMult;
  st.ceilingWM *= shiftMult;
  st.ceilingE *= shiftMult;
  st.algoLog = Math.max(st.algoLog - (0.4 + st.paradigmGeneration * 0.1), -3.0);
  st.algoKMult = 2.0;
  st.dataExhaustionHit = false;
}

// Run one particle forward. stochastic=true -> Monte-Carlo path (records
// milestone years); stochastic=false -> deterministic likelihood path.
function runParticle(particle, cfg, nSteps, stochastic) {
  const st = createSimState(particle, cfg);
  for (let i = 0; i < nSteps; i++) stepDynamics(st, cfg, 1.0 / 12.0, stochastic, particle);
  return st;
}

function readCapabilities(st, cfg) {
  const E = cfg.EXPERT;
  const rawR = computeDim(st.stateR, cfg.DIMENSIONS.reasoning.slope, st.ceilingR);
  const rawA = computeDim(st.stateA, cfg.DIMENSIONS.agency.slope, st.ceilingA);
  const rawE_ai = computeDim(st.stateE, E.embodimentScalingSlope, st.ceilingE);
  // FIX: was computeDim(stateW, wmSlope, ceilingR) — World Modeling was being
  // capped by the *Reasoning* ceiling, so W could never exceed R's bound.
  const rawWM = computeDim(st.stateW, cfg.DIMENSIONS.worldModeling.slope, st.ceilingWM);
  return {
    reasoning: applyInference(rawR, cfg.INFERENCE_SCALING.max_bonus_reasoning, cfg.INFERENCE_SCALING.saturation_cap),
    agency:    applyInference(rawA, cfg.INFERENCE_SCALING.max_bonus_agency, cfg.INFERENCE_SCALING.saturation_cap),
    embodiment: Math.min(applyInference(rawE_ai, cfg.INFERENCE_SCALING.max_bonus_agency * 0.5, cfg.INFERENCE_SCALING.saturation_cap), st.roboticsFrontier),
    worldModeling: applyInference(rawWM, 1.2, cfg.INFERENCE_SCALING.saturation_cap),
  };
}

// Likelihood-side entry point.
//
// IMPORTANT: this calls the SAME stepDynamics() as the forecast. To keep the
// Posterior update deterministic (a particle's predicted capabilities must not
// change between repeated calls with the same observation), the RNG stream is
// re-seeded from (seed, targetYear) at the start of every evaluation. The
// forecast path does NOT reseed, so it explores the full shock distribution.
function simulateToYear(particle, targetYear, cfg) {
  const steps = Math.max(0, Math.floor((targetYear - cfg.BASE_YEAR) * 12));
  const savedState = __rngState, savedSeed = __seed;
  // Hash the target year into a stable per-year stream. Both the state AND the
  // nominal seed are restored afterwards — restoring only the state would let
  // the base seed drift on every call and break reproducibility.
  const yearKey = Math.floor((targetYear - 1000) * 1000) >>> 0;
  setSeed((__seed ^ Math.imul(yearKey, 2654435761)) >>> 0);
  const st = createSimState(particle, cfg);
  for (let i = 0; i < steps; i++) stepDynamics(st, cfg, 1.0 / 12.0, false, particle);
  __rngState = savedState; __seed = savedSeed;
  return readCapabilities(st, cfg);
}

class ParticleFilterTracker {
  constructor(nParticles) {
    this.n = nParticles || DEFAULT_PARTICLES;
    this.cfg = createConfig();
    this.particles = [];
    this.weights = new Float64Array(this.n).fill(1.0 / this.n);
    this.observationLog = [];
    for (let i = 0; i < this.n; i++) {
      const rand = rnd();
      const w = EXPERT_CONFIG.worldModels;
      // Normalize world model probabilities (defensive against UI drift)
      const totalWM = (w.cascade || 0) + (w.hardWall || 0) + (w.slowTakeoff || 0) + (w.resilientCiv || 0);
      const normC = totalWM > 0 ? (w.cascade || 0) / totalWM : 0.50;
      const normH = totalWM > 0 ? (w.hardWall || 0) / totalWM : 0.20;
      const normS = totalWM > 0 ? (w.slowTakeoff || 0) / totalWM : 0.15;
      let worldModel = 'cascade';
      if (rand > normC && rand <= normC + normH) worldModel = 'hard_wall';
      else if (rand > normC + normH && rand <= normC + normH + normS) worldModel = 'slow_takeoff';
      else if (rand > normC + normH + normS) worldModel = 'resilient_civ';

      // The five draws below must happen in this exact order, because the
      // particle population is defined by the sequence of numbers consumed from
      // the global stream. rsiDraw is drawn last, in the slot the old inline
      // randnRange(1.0, 0.25) occupied, and rsi_efficiency reads it; the veto
      // axis is derived from the same number rather than consuming a sixth
      // draw. Moving any draw reshuffles every particle: measured, one extra
      // draw per particle moved the world-model posterior from 97.3%
      // slow_takeoff to 93.5% resilient_civ even with the veto disabled, and
      // made the test suite's agencyCeiling read 12.54 instead of 15.45.
      const hwDraw = randnRange(7.5, 1.5);
      const algoDraw = randnRange(6.0, 2.0);
      const agencyDraw = randnRange(EXPERT_CONFIG.priorAgencyMean, EXPERT_CONFIG.priorAgencyStd);
      const embDraw = randnRange(EXPERT_CONFIG.embodimentPriorMean, EXPERT_CONFIG.embodimentPriorStd);
      const rsiDraw = randnRange(1.0, 0.25);
      this.particles.push({
        hw_months: Math.max(3.0, hwDraw),
        algo_months: Math.max(2.0, algoDraw),
        agency_ceiling: Math.max(2.0, agencyDraw),
        embodiment_ceiling: Math.max(1.5, embDraw),
        world_model: worldModel,
        rsi_efficiency: Math.max(0.1, rsiDraw), // PATCH 8: Independent auto-R&D capability axis
        // Latent institutional resistance: a property of the world this
        // particle lives in, not of the AI. It must not be a function of
        // world_model alone, or resistance would just re-encode the hypothesis
        // label (cascade = no resistance, resilient_civ = resistance) and the
        // filter would learn nothing new. Deriving it from the RSI axis keeps it
        // independent of the label.
        //
        // Deliberately NOT a new randnRange() call. An extra draw consumes one
        // more number from the global stream and gives every subsequent particle
        // different parameters, which moved the whole world-model posterior
        // (97.3% slow_takeoff -> 93.5% resilient_civ) WITH THE VETO DISABLED --
        // a particle-population reshuffle masquerading as a feature effect, and
        // one that made the test suite's agencyCeiling read 12.54 instead of
        // 15.45.
        // institutionalVetoStrength is the CENTRE of the resistance prior, not a
      // constant: the per-particle draw is centred on it and spread by the RSI
      // efficiency draw. It used to read a literal 0.5 here, which left the
      // config key dead -- a slider for it would have moved nothing.
      veto_strength: Math.max(0.0, Math.min(1.0,
      // Read the prior centre from THIS tracker's config, not the global
      // EXPERT_CONFIG. The dynamics read cfg.EXPERT (a deep copy taken in the
      // constructor), so drawing from the global meant a caller that had
      // adjusted tracker.cfg saw no change in resistance -- the slider moved
      // nothing. Both now read one source.
      this.cfg.EXPERT.institutionalVetoStrength + (rsiDraw - 1.0) * 1.2)),
      });
    }
  }

  observeRealData(year, obs, sigmas = BENCHMARK_SIGMAS) {
    // Two-pass particle update with log-sum-exp normalisation.
    // Pass 1 collects per-particle log-likelihood; pass 2 normalises. Using
    // log-weights (rather than multiplying exp() into the weight directly)
    // keeps the update numerically stable when the product underflows.
    const logLiks = new Float64Array(this.n);
    let anyObs = false;
    for (let i = 0; i < this.n; i++) {
      const p = this.particles[i];
      if (p.hw_months < 1.0 || p.agency_ceiling < 1.0) { logLiks[i] = -Infinity; continue; }

      const pred = simulateToYear(p, year, this.cfg);
      const metrics = getNumericObservables(pred.reasoning, pred.agency, pred.embodiment, this.cfg.EXPERT);

      let logLik = 0;
      let count = 0;
      const baseSigmaMult = this.cfg.EXPERT.observationNoiseSigma || 1.0;
      const usePerPoint = this.cfg.EXPERT.observationSigmaMode === 'perPoint';

      // Helper: returns sigma for a given dimension (per-point if available, else global)
      const sig = (dim, globalKey) => {
        if (usePerPoint && obs[dim + '_sigma'] !== undefined) {
          return obs[dim + '_sigma'] * baseSigmaMult;
        }
        return (sigmas[globalKey] || 1.0) * baseSigmaMult;
      };

      if (obs.sweBench !== undefined) {
        logLik -= 0.5 * ((obs.sweBench - metrics.sweBench) / sig('sweBench', 'sweBench'))**2;
        count++;
      }
      if (obs.arcAgi !== undefined) {
        logLik -= 0.5 * ((obs.arcAgi - metrics.arcAgi) / sig('arcAgi', 'arcAgi'))**2;
        count++;
      }
      if (obs.arenaElo !== undefined) {
        logLik -= 0.5 * ((obs.arenaElo - metrics.arenaElo) / sig('arenaElo', 'arenaElo'))**2;
        count++;
      }
      if (obs.trainingFlopsLog !== undefined) {
        logLik -= 0.5 * ((obs.trainingFlopsLog - metrics.flopsLog) / sig('trainingFlopsLog', 'flopsLog'))**2;
        count++;
      }
      if (obs.horizon !== undefined) {
        // Наблюдение в log-шкале (log10 hours), модель предсказывает в той же шкале
        const obsHorizonLog = Math.log10(Math.max(0.01, obs.horizon));
        logLik -= 0.5 * ((obsHorizonLog - metrics.horizon) / sig('horizon', 'horizon'))**2;
        count++;
      }
      if (obs.simToReal !== undefined) {
        logLik -= 0.5 * ((obs.simToReal - metrics.simToReal) / sig('simToReal', 'simToReal'))**2;
        count++;
      }
      if (obs.moravec !== undefined) {
        logLik -= 0.5 * ((obs.moravec - metrics.moravec) / sig('moravec', 'moravec'))**2;
        count++;
      }
      if (obs.autoAssembly !== undefined) {
        // Наблюдение в log-шкале (log10 hours), модель предсказывает в той же шкале
        const obsAutoAssemblyLog = Math.log10(Math.max(0.001, obs.autoAssembly));
        logLik -= 0.5 * ((obsAutoAssemblyLog - metrics.autoAssembly) / sig('autoAssembly', 'autoAssembly'))**2;
        count++;
      }

      // 9) Real embodiment index: prior на particle.embodiment_ceiling от реальной робототехники
      // sigma для этого prior управляется weight (0..1): weight=0 → штраф 0, weight=1 → sigma=1.0
      const rrWeight = this.cfg.EXPERT.realRoboticsWeight || 0;
      if (rrWeight > 0) {
        const realIdx = realEmbodimentIndexAt(year);
        const rrSigma = (1.5 / Math.max(0.01, rrWeight)); // weight=0.3 → sigma=5; weight=1 → sigma=1.5
        // Сравниваем с предсказанным embodiment (pred.embodiment), а не с потолком частицы
        logLik -= 0.5 * ((realIdx - pred.embodiment) / rrSigma) ** 2;
        logLik -= Math.log(rrSigma); // normalization constant for proper likelihood
        count++;
      }

      // CORRECTED LIKELIHOOD: proper product of Gaussians (sum of log-likelihoods),
      // not exp(mean(log-lik)). This makes each benchmark contribute its full
      // information weight — years with more benchmarks now have proportionally
      // more influence on the posterior.
      if (count > 0) {
        logLiks[i] = logLik;
        anyObs = true;
      } else {
        logLiks[i] = 0; // no benchmark for this year: neutral update
      }
    }

    if (!anyObs) return; // nothing to condition on

    // Pass 2: normalise in log space (log-sum-exp), then fold into weights.
    let maxLog = -Infinity;
    for (let i = 0; i < this.n; i++) if (logLiks[i] > maxLog) maxLog = logLiks[i];
    if (!isFinite(maxLog)) { this.weights.fill(1.0 / this.n); return; }

    let sum = 0;
    for (let i = 0; i < this.n; i++) {
      const w = logLiks[i] === -Infinity ? 0 : Math.exp(logLiks[i] - maxLog);
      logLiks[i] = w;
      sum += w;
    }
    if (sum <= 0) { this.weights.fill(1.0 / this.n); return; }

    for (let i = 0; i < this.n; i++) {
      this.weights[i] *= (logLiks[i] / sum);
    }
    let wsum = 0;
    for (let i = 0; i < this.n; i++) wsum += this.weights[i];
    if (wsum <= 0) { this.weights.fill(1.0 / this.n); return; }
    for (let i = 0; i < this.n; i++) this.weights[i] /= wsum;

    const ess = 1.0 / this.weights.reduce((a, b) => a + b * b, 0);
    if (ess < this.n * 0.3) {
      const newP = [], cumsum = new Float64Array(this.n);
      cumsum[0] = this.weights[0];
      for (let i = 1; i < this.n; i++) cumsum[i] = cumsum[i - 1] + this.weights[i];
      cumsum[this.n - 1] = 1.0; 
      const u0 = rnd() / this.n;
      let j = 0;
      for (let i = 0; i < this.n; i++) {
        const u = u0 + i / this.n;
        while (j < this.n - 1 && cumsum[j] < u) j++;
        const p = this.particles[j];
        newP.push({
          hw_months: Math.max(3.0, p.hw_months + randnRange(0, 0.4)),
          algo_months: Math.max(2.0, p.algo_months + randnRange(0, 0.6)),
          agency_ceiling: Math.max(1.5, p.agency_ceiling + randnRange(0, 0.4)),
          embodiment_ceiling: Math.max(1.5, (p.embodiment_ceiling || EXPERT_CONFIG.embodimentPriorMean) + randnRange(0, 0.3)),
          rsi_efficiency: Math.max(0.1, (p.rsi_efficiency || 1.0) + randnRange(0, 0.1)), // PATCH 8: Inheritance and mutation of RSI axis
          // Inherited with mutation like the other latents. Dropping it here
          // would leave every resampled particle without a veto_strength
          // (undefined -> treated as 0), silently disabling the veto after
          // the first resampling step and making the effect vanish in every
          // Monte Carlo run.
          veto_strength: Math.max(0.0, Math.min(1.0,
            (p.veto_strength !== undefined ? p.veto_strength : this.cfg.EXPERT.institutionalVetoStrength) + randnRange(0, 0.05))),
          
          // PATCH 7: Prevent early loss of world model diversity via 3% rejuvenation (mutation)
          world_model: (() => {
            if (rnd() < 0.03) {
              const r = rnd();
              const w = EXPERT_CONFIG.worldModels;
              const totalWM = (w.cascade || 0) + (w.hardWall || 0) + (w.slowTakeoff || 0) + (w.resilientCiv || 0);
              const normC = totalWM > 0 ? (w.cascade || 0) / totalWM : 0.50;
              const normH = totalWM > 0 ? (w.hardWall || 0) / totalWM : 0.20;
              const normS = totalWM > 0 ? (w.slowTakeoff || 0) / totalWM : 0.15;
              if (r < normC) return 'cascade';
              if (r < normC + normH) return 'hard_wall';
              if (r < normC + normH + normS) return 'slow_takeoff';
              return 'resilient_civ';
            }
            return p.world_model || 'cascade';
          })(),
        });
      }
      this.particles = newP;
      this.weights.fill(1.0 / this.n);
    }
    this.observationLog.push({ year, ...obs });
  }

  getSummary() {
    let hw = 0, agn = 0, algo = 0;
    let wCascade = 0, wHardWall = 0, wSlowTakeoff = 0, wResilientCiv = 0;
    const totalW = this.weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < this.n; i++) {
      const nw = totalW > 0 ? this.weights[i] / totalW : 1.0 / this.n;
      hw += this.particles[i].hw_months * nw;
      agn += this.particles[i].agency_ceiling * nw;
      algo += this.particles[i].algo_months * nw;

      // Count weighted fraction of each world model hypothesis
      if (this.particles[i].world_model === 'cascade') wCascade += nw;
      else if (this.particles[i].world_model === 'hard_wall') wHardWall += nw;
      else if (this.particles[i].world_model === 'slow_takeoff') wSlowTakeoff += nw;
      else if (this.particles[i].world_model === 'resilient_civ') wResilientCiv += nw;
    }
    return {
      hwMonths: hw,
      agencyCeiling: agn,
      algoMonths: algo,
      postCascade: wCascade,
      postHardWall: wHardWall,
      postSlowTakeoff: wSlowTakeoff,
      postResilientCiv: wResilientCiv
    };
  }

  // Monte-Carlo forecast. All physics lives in stepDynamics() — this method
  // only samples particles from the posterior and collects statistics.
  runMonteCarloForecast(nRuns) {
    const t1Years = [], t2Years = [], t3Years = [], t4Years = [];
    const dt = 1.0 / 12.0;
    const horizonYears = 45;
    const maxSteps = 12 * horizonYears;
    const plotSteps = 40 * 12;
    const trajYears = new Float64Array(plotSteps);
    const trajCaps = Array.from({length: plotSteps}, () => []);
    const trajEmbodiment = Array.from({length: plotSteps}, () => []);
    const trajReasoning = Array.from({length: plotSteps}, () => []);
    const trajWM = Array.from({length: plotSteps}, () => []);

    const cumw = new Float64Array(this.n);
    cumw[0] = this.weights[0];
    for (let i = 1; i < this.n; i++) cumw[i] = cumw[i - 1] + this.weights[i];
    const wTotal = cumw[this.n - 1] || 1.0;

    // Median human agency at the year T3 is reached, and at the end of the
    // horizon. humanAgency is a state variable, not a particle parameter, so it
    // has no posterior mean to read from getSummary() -- it only exists once a
    // trajectory is run. Reported because it is the human-side quantity the
    // whole ladder of "stages of disengagement" is named after, and the page
    // should not describe that ladder while never showing it.
    const haAtT3 = [], haAtEnd = [];
    for (let run = 0; run < nRuns; run++) {
      // Systematic resampling over posterior weights: one draw per run.
      const u = (run + rnd()) / nRuns;
      let idx = 0;
      while (idx < this.n - 1 && cumw[idx] < u) idx++;
      const p = this.particles[idx];

      const st = createSimState(p, this.cfg);
      let plotIdx = 0;
      for (let step = 0; step < maxSteps; step++) {
        const v = stepDynamics(st, this.cfg, dt, true, p);

        // Milestone years (yT1..yT4) are recorded by the kernel itself; the only
        // thing this loop owns is the absorbing stop at T4 and the trajectories.
        if (st.yT4 !== null) break;

        if (this.cfg.BASE_YEAR + step * dt >= this.cfg.CURRENT_YEAR && plotIdx < plotSteps) {
          trajYears[plotIdx] = this.cfg.BASE_YEAR + step * dt;
          trajCaps[plotIdx].push(v.cap);
          trajEmbodiment[plotIdx].push(v.Emb);
          trajReasoning[plotIdx].push(v.R);
          trajWM[plotIdx].push(v.W);
          plotIdx++;
        }
      }

      // Human agency at the moment institutions were captured, and where it
      // ended up. Recorded per run: the ladder of "stages of disengagement" is
      // named after the loss of human position, and this is the number that
      // says how much was left when it was lost.
      //
      // Previously this push did not exist -- only the declaration and the
      // percentile summary were added -- so atT3 was always null and the page
      // silently rendered no human-agency line at all, with no error anywhere.
      haAtEnd.push(st.humanAgency);
      if (st.yT3 !== null) haAtT3.push(st.humanAgency);

      const cur = this.cfg.CURRENT_YEAR;
      t1Years.push(st.yT1 !== null ? st.yT1 - cur : Infinity);
      t2Years.push(st.yT2 !== null ? st.yT2 - cur : Infinity);
      t3Years.push(st.yT3 !== null ? st.yT3 - cur : Infinity);
      t4Years.push(st.yT4 !== null ? st.yT4 - cur : Infinity);
    }

    const yrs = [], med = [], p10a = [], p25a = [], p75a = [], p90a = [];
    const embYrs = [], embMed = [], embP10 = [], embP25 = [], embP75 = [], embP90 = [];
    const wmYrs = [], rMed = [], wmMed = [];
    for (let step = 0; step < plotSteps; step++) {
        const vals = trajCaps[step];
        if (vals.length > 0) {
            vals.sort((a,b) => a-b);
            yrs.push(trajYears[step]);
            p10a.push(percentile(vals, 10)); p25a.push(percentile(vals, 25));
            med.push(percentile(vals, 50));  p75a.push(percentile(vals, 75)); p90a.push(percentile(vals, 90));
        }
        const ev = trajEmbodiment[step];
        if (ev.length > 0) {
            ev.sort((a,b) => a-b);
            embYrs.push(trajYears[step]);
            embP10.push(percentile(ev, 10)); embP25.push(percentile(ev, 25));
            embMed.push(percentile(ev, 50));  embP75.push(percentile(ev, 75)); embP90.push(percentile(ev, 90));
        }
        const rv = trajReasoning[step];
        const wmv = trajWM[step];
        if (rv.length > 0 && wmv.length > 0) {
            rv.sort((a,b) => a-b);
            wmv.sort((a,b) => a-b);
            wmYrs.push(trajYears[step]);
            rMed.push(percentile(rv, 50));
            wmMed.push(percentile(wmv, 50));
        }
    }
    return {
        t1Years, t2Years, t3Years, t4Years,
        trajectory: { years: yrs, median: med, p10: p10a, p25: p25a, p75: p75a, p90: p90a },
        embodimentTrajectory: { years: embYrs, median: embMed, p10: embP10, p25: embP25, p75: embP75, p90: embP90 },
        gapTrajectory: { years: wmYrs, reasoning: rMed, wm: wmMed },
        // Human agency. atT3 is the share of significant decisions still made by
        // people at the moment institutions were captured -- the number the
        // "stages of disengagement" ladder implies but never stated. atEnd is
        // where it settles in runs that never reach T3, which is what the veto
        // worlds look like. null means the sample was empty, never zero.
        humanAgency: {
            atT3: haAtT3.length ? percentile(haAtT3, 50) : null,
            atEnd: haAtEnd.length ? percentile(haAtEnd, 50) : null,
            atT3_p25: haAtT3.length ? percentile(haAtT3, 25) : null,
            atT3_p75: haAtT3.length ? percentile(haAtT3, 75) : null,
        }
    };
  }

  // ==========================================================================
  // ADVANCED ANALYSIS: Sensitivity, Scenarios, Decomposition, Paradigm Shifts
  // ==========================================================================

  // Clone particles + weights for sensitivity analysis (same hypotheses, different observations)
  cloneState() {
    return {
      particles: this.particles.map(p => ({ ...p })),
      weights: new Float64Array(this.weights),
      observationLog: this.observationLog.map(o => ({ ...o })),
    };
  }

  // --------------------------------------------------------------------------
  // Prior sensitivity: how much of the forecast is data and how much is prior?
  //
  // The stage medians the page publishes come out of stepDynamics, whose
  // particle prior for agency_ceiling is N(priorAgencyMean, priorAgencyStd).
  // "10 is AGI" is an ASSUMPTION, and the benchmark history cannot test it.
  // Quoting a median to 0.1 years while that holds reads as precision the model
  // does not have.
  //
  // Re-runs the same forecast with the prior scaled to 0.7x and 1.3x, seed held
  // fixed so the difference is attributable to the prior alone. It rescales
  // particles ABOUT the prior mean rather than resampling: resampling from an
  // already-conditioned posterior would measure the spread of the fit, not the
  // dependence on the assumption.
  priorSensitivity(opts) {
    const o = opts || {};
    const nRuns = o.nRuns || 250;
    const scales = o.scales || [0.7, 1.0, 1.3];
    const baseMean = EXPERT_CONFIG.priorAgencyMean;
    const stages = ['t1Years', 't2Years', 't3Years', 't4Years'];

    // runMonteCarloForecast() draws from the global stream, so calling it three
    // times in sequence gives each scale a different set of noise draws and the
    // spread it reports mixes the prior effect with sampling noise (measured:
    // two identical runs differed by 0.17y on the T3 median). Save and restore
    // the RNG state around the whole sweep so the same seed yields the same
    // numbers, and so the only thing varying across the rows is the prior.
    const savedRngState = __rngState;
    const savedSeed = __seed;
    const rows = scales.map(scale => {
      const state = this.cloneState();
      for (const p of state.particles) {
        p.agency_ceiling = Math.max(2.0,
          baseMean + (p.agency_ceiling - baseMean) * scale);
      }
      const savedParticles = this.particles;
      const savedWeights = this.weights;
      this.particles = state.particles;
      this.weights = state.weights;
      let mc;
      try {
        mc = this.runMonteCarloForecast(nRuns);
      } finally {
        this.particles = savedParticles;
        this.weights = savedWeights;
      }
      const row = { scale, priorAgencyMean: baseMean * scale, med: {},
                    humanAgency: mc.humanAgency || null };
      for (const st of stages) {
        const arr = (mc[st] || []).filter(v => isFinite(v));
        if (arr.length) row.med[st] = percentile(arr, 50);
      }
      return row;
    });

    const base = rows.find(r => r.scale === 1.0) || rows[0];
    const sensitivity = {};
    for (const st of stages) {
      const vals = rows.map(r => r.med[st]).filter(v => isFinite(v));
      if (vals.length < 2) { sensitivity[st] = null; continue; }
      const lo = Math.min(...vals), hi = Math.max(...vals);
      const b = base.med[st];
      // rel is null when the baseline sits at/past the present (T1/T2 are
      // already reached), where a ratio against ~0 is meaningless.
      sensitivity[st] = (isFinite(b) && Math.abs(b) > 0.25)
        ? { min: lo, max: hi, spread: hi - lo, rel: (hi - lo) / Math.abs(b) }
        : { min: lo, max: hi, spread: hi - lo, rel: null };
    }
    __rngState = savedRngState;
    __seed = savedSeed;
    // humanAgency from the BASELINE row, so the panel reports the human-side
    // number under the shipped prior rather than averaging across priors, which
    // would describe a world the model never actually simulates.
    return { basePrior: baseMean, scales, rows, sensitivity,
             humanAgency: (base && base.humanAgency) || null };
  }

  // Restore cloned state
  restoreState(state) {
    this.particles = state.particles.map(p => ({ ...p }));
    this.weights = new Float64Array(state.weights);
    this.observationLog = state.observationLog.map(o => ({ ...o }));
    this.n = this.particles.length;
  }

  // stageYearsKey selects which stopping time the heatmap measures.
  //
  // It used to be hardcoded to t2Years, which made the chart useless: measured
  // over the same 6x8 benchmark grid, the median years-to-T2 spans only
  // -0.42..-0.33 (range 0.08 years, 3 distinct values) because T2 is already
  // reached at every benchmark pair. T4 is nearly as flat (range 0.46). T3
  // carries the signal — range 1.83 years, 24 distinct values — so the default
  // is 't3Years' and the caption names the stage.
  async runSensitivityMatrixAsync(arcRange, sweRange, stageYearsKey = 't3Years') {
    const baseObs = REAL_BENCHMARK_HISTORY[REAL_BENCHMARK_HISTORY.length - 1];
    const state = this.cloneState();

    const results = [];
    for (const arc of arcRange) {
      const row = [];
      for (const swe of sweRange) {
        this.restoreState(state);
        this.observeRealData(baseObs.year, { arcAgi: arc, sweBench: swe });
        // Снижаем кол-во MC прогонов для тепловой карты (ускорение в 6 раз)
        const mc = this.runMonteCarloForecast(50);
        const finite = (mc[stageYearsKey] || []).filter(isFinite);
        row.push(finite.length > 0 ? percentile(finite, 50) : 40);
      }
      results.push(row);
      await new Promise(r => setTimeout(r, 0));
    }
    this.restoreState(state);
    return results;
  }

  // Scenario fan: N sampled trajectories from the posterior, drawn through the
  // same stepDynamics() kernel as every other path. Returns the same
  // { years, caps } shape the Plotly fan chart expects.
  runScenarioOverlay(nScenarios) {
    const cumw = new Float64Array(this.n);
    cumw[0] = this.weights[0];
    for (let i = 1; i < this.n; i++) cumw[i] = cumw[i - 1] + this.weights[i];

    const scenarios = [];
    const dt = 1.0 / 12.0;
    const steps = 40 * 12;

    for (let s = 0; s < nScenarios; s++) {
      const u = rnd();
      let idx = 0; while (idx < this.n - 1 && cumw[idx] < u) idx++;
      const p = this.particles[idx];

      const st = createSimState(p, this.cfg);
      const years = [], caps = [];
      for (let step = 0; step < steps; step++) {
        const v = stepDynamics(st, this.cfg, dt, true, p);
        years.push(this.cfg.BASE_YEAR + step * dt);
        caps.push(v.cap);
        if (st.yT4 !== null) break;
      }
      scenarios.push({ years, caps });
    }
    return scenarios;
  }

  // Growth decomposition: splits the modelled log-capability gain into
  // hardware / algorithmic / paradigm-shift / RSI contributions.
  //
  // Runs a single representative particle (posterior-mean parameters, dominant
  // world model) through the SAME stepDynamics() kernel. The per-step
  // contributions are read off the shared state rather than recomputed, so this
  // chart can no longer disagree with the forecast.
  runDecomposition() {
    const cfg = this.cfg;
    const totalW = this.weights.reduce((a, b) => a + b, 0);
    let avgHw = 0, avgAlgo = 0, avgCeiling = 0, avgEmbodimentCeiling = 0, avgRsiEff = 0;
    if (totalW > 0) {
      for (let i = 0; i < this.n; i++) {
        const w = this.weights[i] / totalW;
        avgHw += (this.particles[i].hw_months || 7.5) * w;
        avgAlgo += (this.particles[i].algo_months || 6.0) * w;
        avgCeiling += (this.particles[i].agency_ceiling || 8.0) * w;
        avgEmbodimentCeiling += (this.particles[i].embodiment_ceiling || cfg.EXPERT.embodimentPriorMean) * w;
        avgRsiEff += (this.particles[i].rsi_efficiency || 1.0) * w;
      }
    } else {
      for (let i = 0; i < this.n; i++) {
        avgHw += this.particles[i].hw_months;
        avgAlgo += this.particles[i].algo_months;
        avgCeiling += this.particles[i].agency_ceiling;
        avgEmbodimentCeiling += this.particles[i].embodiment_ceiling || cfg.EXPERT.embodimentPriorMean;
        avgRsiEff += (this.particles[i].rsi_efficiency || 1.0);
      }
      avgHw /= this.n; avgAlgo /= this.n; avgCeiling /= this.n;
      avgEmbodimentCeiling /= this.n; avgRsiEff /= this.n;
    }

    // Dominant world model by posterior weight.
    const wm = { hard_wall: 0, slow_takeoff: 0, resilient_civ: 0 };
    for (let i = 0; i < this.n; i++) {
      const w = totalW > 0 ? this.weights[i] / totalW : 1.0 / this.n;
      const m = this.particles[i].world_model;
      if (m && m !== 'cascade') wm[m] = (wm[m] || 0) + w;
    }
    let dominantModel = 'cascade';
    let maxW = 1.0 - wm.hard_wall - wm.slow_takeoff - wm.resilient_civ;
    for (const k of ['hard_wall', 'slow_takeoff', 'resilient_civ']) {
      if (wm[k] > maxW) { maxW = wm[k]; dominantModel = k; }
    }

    const rep = {
      hw_months: avgHw,
      algo_months: avgAlgo,
      agency_ceiling: avgCeiling,
      embodiment_ceiling: avgEmbodimentCeiling,
      rsi_efficiency: avgRsiEff,
      world_model: dominantModel,
    };

    const dt = 1.0 / 12.0;
    const steps = 40 * 12;
    const years = [], hwComp = [], algoComp = [], paradigmComp = [], rsiComp = [], totalLogSeries = [];

    const st = createSimState(rep, cfg);
    const flopsStart = cfg.BASE_LOG_FLOPS;
    let accumulatedParadigm = 0, accumulatedRsi = 0, accumulatedAlgo = 0;
    let prevAlgoKMult = 1.0;
    let prevHW = 0, prevAlgo = 0;

    for (let step = 0; step < steps; step++) {
      const y = cfg.BASE_YEAR + step * dt;
      const prevFLOPs = st.flopsLog;
      const prevParadigm = st.paradigmGeneration;

      const v = stepDynamics(st, cfg, dt, true, rep);

      // Attribute this step's growth to its sources, reading the shared state.
      const dHW = Math.max(0, (st.flopsLog - prevFLOPs) / dt);
      const dAlgoK = st.algoK * st.algoKMult;
      const dRSI = Math.max(0, dAlgoK - prevAlgo);
      const dParadigm = (st.paradigmGeneration - prevParadigm) * 2.0;
      // Algorithmic efficiency gain from the multiplier alone, with the
      // recursive term excluded: dRSI is accumulated separately below, and
      // folding it in here as well is what made the stack exceed the total.
      const dAlgoEff = Math.max(0, dAlgoK - prevAlgoKMult * st.algoK);

      accumulatedParadigm += dParadigm;
      accumulatedRsi += dRSI * dt;
      accumulatedAlgo += dAlgoEff * dt;
      prevHW = dHW; prevAlgo = dAlgoK; prevAlgoKMult = st.algoKMult;
      years.push(y);

      // Hardware is the remainder, so hw + algo + paradigm + rsi equals the
      // total log growth. It used to subtract only rsi and paradigm, which
      // left the algorithmic part counted twice across the stackgroup.
      const totalLog = st.flopsLog - flopsStart;
      hwComp.push(Math.max(0, totalLog - accumulatedRsi - accumulatedParadigm - accumulatedAlgo));
      algoComp.push(Math.max(0, accumulatedAlgo));
      paradigmComp.push(Math.max(0, accumulatedParadigm));
      rsiComp.push(Math.max(0, accumulatedRsi));
      totalLogSeries.push(Math.max(0, st.flopsLog - flopsStart));
      if (st.yT4 !== null) break;
    }
    return { years, hwComp, algoComp, paradigmComp, rsiComp, totalLogSeries };
  }
}

// ============================================================================
// 6. UI STATE & CONTROLLERS
// ============================================================================


function getTracker() {
  if (!coreTracker) {
    coreTracker = new ParticleFilterTracker(1000);
    REAL_BENCHMARK_HISTORY.forEach(d => coreTracker.observeRealData(d.year, d));
    userObservations.forEach(d => coreTracker.observeRealData(d.year, d));
  }
  return coreTracker;
}

// Backtest: тренируемся на первых trainEnd точках, предсказываем trainEnd+1..K.
// Возвращает: { residuals: [...], perDim: {sweBench, arcAgi, arenaElo, flopsLog, horizon, simToReal, moravec, autoAssembly}, coverage90: %, nPred: K - trainEnd }
function runBacktest(trainEnd, kPred) {
  const data = REAL_BENCHMARK_HISTORY;
  if (!data || data.length < trainEnd + kPred) {
    return { error: 'Недостаточно данных для бэктеста (нужно trainEnd + kPred наблюдений)', dataLen: data ? data.length : 0 };
  }
  const trainData = data.slice(0, trainEnd);
  const testData = data.slice(trainEnd, trainEnd + kPred);

  const btTracker = new ParticleFilterTracker(1000);
  trainData.forEach(d => btTracker.observeRealData(d.year, d));

  // Подготавливаем кумулятивные веса для правильного сэмплинга (взвешенный выбор)
  const cumw = new Float64Array(btTracker.n);
  cumw[0] = btTracker.weights[0];
  for (let i = 1; i < btTracker.n; i++) cumw[i] = cumw[i - 1] + btTracker.weights[i];

  const residuals = [];
  const dims = ['sweBench', 'arcAgi', 'arenaElo', 'flopsLog', 'horizon', 'simToReal', 'moravec', 'autoAssembly'];
  const sqErr = { sweBench:0, arcAgi:0, arenaElo:0, flopsLog:0, horizon:0, simToReal:0, moravec:0, autoAssembly:0 };
  const cnt = { sweBench:0, arcAgi:0, arenaElo:0, flopsLog:0, horizon:0, simToReal:0, moravec:0, autoAssembly:0 };
  let inCI90 = 0, totalCIEval = 0;

  for (let t = 0; t < testData.length; t++) {
    const obs = testData[t];
    const samples = [];
    
    // Генерируем 200 взвешенных прогнозов
    for (let k = 0; k < 200; k++) {
      const u = rnd();
      let idx = 0; while (idx < btTracker.n - 1 && cumw[idx] < u) idx++;
      
      const pred = simulateToYear(btTracker.particles[idx], obs.year, btTracker.cfg);
      const m = getNumericObservables(pred.reasoning, pred.agency, pred.embodiment, btTracker.cfg.EXPERT);
      
      // Добавляем шум измерений (Posterior Predictive Distribution)
      const getSig = (dimKey) => (obs[dimKey + '_sigma'] !== undefined) ? obs[dimKey + '_sigma'] : BENCHMARK_SIGMAS[dimKey];
      
      m.sweBench = clamp(m.sweBench + randnRange(0, getSig('sweBench')), 0, 100);
      m.arcAgi = clamp(m.arcAgi + randnRange(0, getSig('arcAgi')), 0, 100);
      m.arenaElo += randnRange(0, getSig('arenaElo'));
      m.flopsLog += randnRange(0, getSig('flopsLog'));
      m.horizon += randnRange(0, getSig('horizon'));
      m.simToReal = clamp(m.simToReal + randnRange(0, getSig('simToReal')), 0, 100);
      m.moravec = clamp(m.moravec + randnRange(0, getSig('moravec')), 0, 100);
      m.autoAssembly += randnRange(0, getSig('autoAssembly'));

      samples.push(m);
    }

    const medianSample = {};
    for (const dim of dims) {
      const vals = samples.map(s => s[dim]).filter(v => isFinite(v)).sort((a,b)=>a-b);
      const _m = Math.floor(vals.length / 2); 
      medianSample[dim] = vals.length > 0 ? (vals.length % 2 === 0 ? (vals[_m - 1] + vals[_m]) / 2 : vals[_m]) : 0;
      
      // Берем 5-й и 95-й перцентили (в сумме дают 90% доверительный интервал)
      const p05 = vals.length > 0 ? vals[Math.floor(vals.length * 0.05)] : 0;
      const p95 = vals.length > 0 ? vals[Math.floor(vals.length * 0.95)] : 0;
      
      if (obs[dim] !== undefined) {
        const obsInModelScale = (dim === 'autoAssembly') ? Math.log10(Math.max(0.001, obs[dim])) :
                                (dim === 'horizon') ? Math.log10(Math.max(0.01, obs[dim])) :
                                obs[dim];
                                
        const err = obsInModelScale - medianSample[dim];
        sqErr[dim] += err * err;
        cnt[dim]++;
        
        // Проверка попадания в 90% интервал
        if (obsInModelScale >= p05 && obsInModelScale <= p95) inCI90++;
        totalCIEval++;
      }
    }
    residuals.push({ year: obs.year, observed: obs, predicted: medianSample });
  }
  
  const perDim = {};
  for (const dim of dims) {
    perDim[dim] = cnt[dim] > 0 ? Math.sqrt(sqErr[dim] / cnt[dim]) : null;
  }
  
  return {
    trainEnd, kPred,
    trainYears: `${trainData[0].year}..${trainData[trainData.length-1].year}`,
    testYears: `${testData[0].year}..${testData[testData.length-1].year}`,
    residuals, perDim,
    coverage90: totalCIEval > 0 ? (inCI90 / totalCIEval * 100) : null,
    nPred: testData.length
  };
}

function addObservation() {
  // Считываем значения с полей. Если поля нет или оно пустое - undefined
  const arcEl = document.getElementById('v3ARC');
  const horizonEl = document.getElementById('v3Horizon');
  const sweEl = document.getElementById('v3SWE'); // задел на будущее
  const eloEl = document.getElementById('v3Elo'); // задел на будущее
  
  const arcVal = arcEl && arcEl.value ? +arcEl.value : undefined;
  const horizonVal = horizonEl && horizonEl.value ? +horizonEl.value : undefined;
  const sweVal = sweEl && sweEl.value ? +sweEl.value : undefined;
  const eloVal = eloEl && eloEl.value ? +eloEl.value : undefined;

  // Валидация: отбрасываем NaN и нечисловые значения
  const safeArc = (arcVal !== undefined && isFinite(arcVal)) ? arcVal : undefined;
  const safeHorizon = (horizonVal !== undefined && isFinite(horizonVal) && horizonVal > 0) ? horizonVal : undefined;
  const safeSwe = (sweVal !== undefined && isFinite(sweVal) && sweVal >= 0 && sweVal <= 100) ? sweVal : undefined;
  const safeElo = (eloVal !== undefined && isFinite(eloVal) && eloVal > 0) ? eloVal : undefined;

  // Fallback uses the pinned origin, not the wall clock: this function draws
  // the "today" marker on the histogram, and letting it drift away from
  // cfg.CURRENT_YEAR would put the marker at a different year than the
  // forecast is actually anchored to.
  const y = coreTracker ? coreTracker.cfg.CURRENT_YEAR : PINNED_CURRENT_YEAR;
  
  const newObs = { year: y };
  if (safeArc !== undefined) newObs.arcAgi = safeArc;
  if (safeHorizon !== undefined) newObs.horizon = safeHorizon;
  if (safeSwe !== undefined) newObs.sweBench = safeSwe;
  if (safeElo !== undefined) newObs.arenaElo = safeElo;

  userObservations = userObservations.filter(o => o.year < y - 0.01);
  if (Object.keys(newObs).length > 1) { // Добавляем, только если есть хотя бы 1 метрика кроме year
    userObservations.push(newObs);
  }
  
  coreTracker = new ParticleFilterTracker(DEFAULT_PARTICLES);
  REAL_BENCHMARK_HISTORY.forEach(d => coreTracker.observeRealData(d.year, d));
  userObservations.forEach(d => coreTracker.observeRealData(d.year, d));
  
  updateTrackerUI(coreTracker);
}

function resetTracker() {
  coreTracker = null; userObservations = [];
  const obsEl = document.getElementById('userObservations');
  if (obsEl) obsEl.innerHTML = '';
  const parEl = document.getElementById('v3Params');
  if (parEl) parEl.textContent = '';
}

function updateTrackerUI(tracker) {
  checkObservationWarning(tracker);
  updateObsMetrics();
  
  // PATCH 9: Update posterior world model probabilities in real-time
  const sum = tracker.getSummary();
  const parEl = document.getElementById('v3Params');
  if (parEl) {
    const L = LANG[window._lang || 'ru'];
    parEl.innerHTML = `
      <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;border-top:1px dashed #1e1e2e;padding-top:8px;line-height:1.4">
        <b style="color:#f0883e">${L.wm_posterior_title || 'Текущие апостериорные веса гипотез'}:</b><br>
        Cascade (Каскад): <span style="color:#58a6ff;font-family:monospace">${(sum.postCascade * 100).toFixed(1)}%</span><br>
        Hard Wall (Стена): <span style="color:#ef4444;font-family:monospace">${(sum.postHardWall * 100).toFixed(1)}%</span><br>
        Slow Takeoff (Взлет): <span style="color:#22c55e;font-family:monospace">${(sum.postSlowTakeoff * 100).toFixed(1)}%</span><br>
        Resilient (Иммунитет): <span style="color:#a855f7;font-family:monospace">${(sum.postResilientCiv * 100).toFixed(1)}%</span>
      </div>
    `;
  }

  renderPriorSensitivity(tracker);
}

// --------------------------------------------------------------------------
// Show how much of the forecast is prior rather than data.
//
// The medians above are quoted to 0.1 years, but the agency ceiling the stage
// triggers depend on is a PRIOR ("10 is AGI" was claimed in the expert panel
// while the value was 8), and no benchmark observation can test it. This runs
// the same forecast with the prior at 0.7x and 1.3x and prints the resulting
// range, so the precision on screen is visibly wider than the point estimate.
//
// Deferred: three extra Monte Carlo passes take long enough to drop frames if
// run inline, and the posterior panel is the wrong place to stutter in. Cached
// by observation count + prior, because it only changes when one of those does.
let _priorSensCache = { key: null, html: null, pending: false, lang: null };
function renderPriorSensitivity(tracker) {
  const el = document.getElementById('priorSens');
  if (!el) return;
  const lang = window._lang || 'ru';
  const L = LANG[lang];
  // The cache key includes the language: the cached HTML is already
  // translated, so without lang in the key a language switch left the panel
  // showing Russian under an English page.
  const key = tracker.observationLog.length + '|' + EXPERT_CONFIG.priorAgencyMean + '|' + lang;
  if (_priorSensCache.key === key && _priorSensCache.html) {
    el.innerHTML = _priorSensCache.html;
    return;
  }
  if (_priorSensCache.pending) return;
  _priorSensCache.pending = true;
  el.innerHTML = `<div class="muted" style="font-size:0.75rem">${L.prior_sens_pending || '…'}</div>`;
  setTimeout(() => {
    _priorSensCache.pending = false;
    let s;
    try {
      s = tracker.priorSensitivity({ nRuns: 150 });
    } catch (err) {
      el.innerHTML = `<div class="muted" style="font-size:0.75rem">${L.prior_sens_failed || 'n/a'}</div>`;
      return;
    }
    const fmt = v => (isFinite(v) ? v.toFixed(1) : '—');
    const line = (label, sv, relKey) => {
      if (!sv) return '';
      const rel = sv.rel === null ? '' : ` (${Math.round(sv.rel * 100)}%)`;
      return `<div style="margin-top:3px">${label}: <span style="font-family:monospace;color:#58a6ff">${fmt(sv.min)} – ${fmt(sv.max)}</span> ${L.prior_sens_unit || 'г.'}${rel}</div>`;
    };
    // Human agency at capture. Shown here because the ladder is called
    // "stages of disengagement" and this is the first quantity on the page
    // that speaks to the humans in it.
    const haLine = (r) => {
      const ha = r && r.humanAgency;
      if (!ha || ha.atT3 === null || !isFinite(ha.atT3)) return '';
      return `<div style="margin-top:3px">${L.ha_at_t3 || 'Доля решений за людьми при T3'}: ` +
             `<span style="font-family:monospace;color:#a855f7">${ha.atT3.toFixed(2)}</span>` +
             ` <span style="color:#6b7280">(${L.ha_range || 'p25-p75'}: ` +
             `${ha.atT3_p25.toFixed(2)}-${ha.atT3_p75.toFixed(2)})</span></div>`;
    };
    const html = `
      <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;border-top:1px dashed #1e1e2e;padding-top:8px;line-height:1.4">
        <b style="color:#f0883e">${L.prior_sens_title || 'Чувствительность к априорам'}</b>
        <div style="margin-top:2px">${L.prior_sens_note || 'T3/T4 при априоре потолка агентности ±30% (это допущение, а не измерение):'}</div>
        ${line('T3', s.sensitivity.t3Years)}
        ${line('T4', s.sensitivity.t4Years)}
        ${haLine(s)}
        <div style="margin-top:4px;color:#6b7280">${L.prior_sens_prior || 'Априор:'} ${s.basePrior}</div>
      </div>`;
    _priorSensCache.key = key;
    _priorSensCache.html = html;
    el.innerHTML = html;
  }, 60);
}

let hasUserInput = false;

function checkObservationWarning(tracker) {
  const warnEl = document.getElementById('v3Warning');
  if (!warnEl) return;
  if (!hasUserInput) { warnEl.style.display = 'none'; return; }
  
  const arcEl = document.getElementById('v3ARC');
  const sweEl = document.getElementById('v3SWE');
  const userArc = arcEl && arcEl.value ? +arcEl.value : undefined;
  const userSwe = sweEl && sweEl.value ? +sweEl.value : undefined;
  
  if (userArc === undefined && userSwe === undefined) {
      warnEl.style.display = 'none'; return; 
  }

  let minDist = Infinity;
  for (let i = 0; i < tracker.n; i += 10) { 
    if (tracker.weights[i] < 1e-5) continue;
    const pred = simulateToYear(tracker.particles[i], tracker.cfg.CURRENT_YEAR, tracker.cfg);
    const m = getNumericObservables(pred.reasoning, pred.agency, pred.embodiment, tracker.cfg.EXPERT);
    
    let distSq = 0;
    if (userArc !== undefined) distSq += ((userArc - m.arcAgi)/BENCHMARK_SIGMAS.arcAgi)**2;
    if (userSwe !== undefined) distSq += ((userSwe - m.sweBench)/BENCHMARK_SIGMAS.sweBench)**2;
    
    const dist = Math.sqrt(distSq);
    if (dist < minDist) minDist = dist;
  }
  
  if (minDist > 3.0) { // 3 сигмы
    warnEl.style.display = '';
    const L = LANG[window._lang || 'ru'];
    warnEl.textContent = L.v3_warning_far || '⚠️ Значения далеко от диапазона частиц — экстраполяция ненадёжна.';
  } else {
    warnEl.style.display = 'none';
  }
}

async function runSimulation() {
  if (simulationRunning) return;
  simulationRunning = true;

  const btn = document.getElementById('runBtn');
  if (btn) btn.disabled = true; // Безопасная блокировка кнопки

  const overlay = document.getElementById('overlay');
  if (overlay) overlay.classList.add('show');

  const textEl = document.getElementById('overlayText');
  if (textEl) textEl.textContent = 'Фильтр частиц: прогноз v4...';

  const rnEl = document.getElementById('rN');
  const n = rnEl ? +rnEl.value : 3000; // Фолбэк на 3000, если инпута нет

  await new Promise(r => setTimeout(r, 50));
  try {
    // Сохраняем текущий ввод пользователя перед симуляцией
    addObservation();

    const tracker = coreTracker || getTracker();
    const runData = tracker.runMonteCarloForecast(n);
    const t1List = runData.t1Years, t2List = runData.t2Years;
    const t3List = runData.t3Years, t4List = runData.t4Years;
    const finiteT1 = t1List.filter(isFinite);
    const finiteT2 = t2List.filter(isFinite);
    const finiteT3 = t3List.filter(isFinite);
    const finiteT4 = t4List.filter(isFinite);

    const CUR_Y = tracker.cfg.CURRENT_YEAR;
    const yq = [];
    for (let y = 0.25; y <= 10; y += 0.25) yq.push(+y.toFixed(4));
    for (let y = 11; y <= 40; y++) yq.push(y);
    const yqAbs = yq.map(y => +(CUR_Y + y).toFixed(2));

    currentResults = {
      histogram: buildHistogramBins(t1List, t2List, t3List, t4List),
      trajectory: runData.trajectory,
      embodimentTrajectory: runData.embodimentTrajectory,
      gapTrajectory: runData.gapTrajectory,
      cumulative: {
        x: yqAbs,
        t1: yq.map(y => cdf(t1List, y)), t2: yq.map(y => cdf(t2List, y)),
        t3: yq.map(y => cdf(t3List, y)), t4: yq.map(y => cdf(t4List, y))
      },
      summary: {
        t1Median: percentile(finiteT1, 50) ?? Infinity,
        t2Median: percentile(finiteT2, 50) ?? Infinity,
        t3Median: percentile(finiteT3, 50) ?? Infinity,
        t4Median: percentile(finiteT4, 50) ?? Infinity,
        pT2_2029: cdf(t2List, 3), pT2_2033: cdf(t2List, 7), pT2_2040: cdf(t2List, 14),
        pT4_2035: cdf(t4List, 9), pT4_2045: cdf(t4List, 19), nRuns: n
      },
    };
    updateUI(currentResults);
    if (typeof liveSwarm !== 'undefined') liveSwarm.tracker = tracker;
    if (typeof swarm !== 'undefined' && swarm) swarm.tracker = tracker;
  } catch (err) {
    console.error("Simulation error:", err);
  } finally {
    simulationRunning = false;
    if (btn) btn.disabled = false;
    if (overlay) overlay.classList.remove('show');
  }
}

function updateUI(r) {
  const s = r.summary, fmt = yearsText;
  setVal('vT1', fmt(s.t1Median), 't1years');
  setVal('vT2', fmt(s.t2Median), 't2years');
  setVal('vT3', fmt(s.t3Median), 't3years');
  setVal('vT4', fmt(s.t4Median), 't4years');
  // Скрыть/показать предупреждение "T2 не достигнут"
  const noT2El = document.getElementById('v3NoAgi');
  if (noT2El) noT2El.style.display = isFinite(s.t2Median) ? 'none' : '';
  plotHistogram(r.histogram); plotCumulative(r.cumulative);

  const tracker = getTracker();

  // Advanced charts: отрисовываем мгновенные графики без блокировки
  requestAnimationFrame(() => {
    try { plotScenarioFan(tracker); } catch(e) { console.error('c6:', e); }
    try { plotDecomposition(tracker); } catch(e) { console.error('c7:', e); }
    try { plotGroundingGap(r.gapTrajectory); } catch(e) { console.error('c_gap:', e); }
    try { plotEmbodimentDiagnostics(tracker, r.embodimentTrajectory); } catch(e) { console.error('c8:', e); }
  });

  // Тяжелую тепловую карту запускаем асинхронно, чтобы она не "вешала" остальные графики
}

function setVal(id, txt, cls) { const el = document.getElementById(id); if (el) { el.innerHTML = txt; el.className = 'status-value ' + (cls||''); } }
function yearsText(yrs) {
  if (!isFinite(yrs)) return LANG[window._lang||'ru'].fY_gt;
  if (yrs <= 0) return LANG[window._lang||'ru'].fY_achieved;
  if (yrs > 40) return LANG[window._lang||'ru'].fY_gt;
  return yrs.toFixed(1) + LANG[window._lang||'ru'].fY_suffix;
}

function buildHistogramBins(l1, l2, l3, l4) {
  const bins = [], binW = 0.5;
  for (let x = 0.5; x <= 30.0; x += binW) bins.push(x);
  
  const h1 = new Array(bins.length - 1).fill(0);
  const h2 = new Array(bins.length - 1).fill(0);
  const h3 = new Array(bins.length - 1).fill(0);
  const h4 = new Array(bins.length - 1).fill(0);
  
  const fillHist = (list, hist) => {
    for (const v of list) {
      if (isFinite(v)) { 
        const idx = Math.floor((v - 0.5) / binW); 
        if (idx >= 0 && idx < hist.length) hist[idx]++; 
      }
    }
  };
  fillHist(l1, h1); fillHist(l2, h2); fillHist(l3, h3); fillHist(l4, h4);

  const tracker = getTracker();
  // Same pinned origin as createConfig(); previously this fell back to the wall
  // clock, which put the histogram's "today" line a different year from the one
  // the forecast was anchored to whenever the tracker had not been built yet.
  const CUR_Y = tracker ? tracker.cfg.CURRENT_YEAR : PINNED_CURRENT_YEAR;
  return { 
    labels: bins.slice(0, -1).map((_, i) => (CUR_Y + (bins[i] + bins[i + 1]) / 2).toFixed(1)), 
    t1: h1, t2: h2, t3: h3, t4: h4
  };
}

// ============================================================================
// PLOTLY RENDERERS & i18n
// ============================================================================

// ============================================================================
// 7. VISUALIZATION (Plotly Charts)
// ============================================================================

const LAYOUT_BASE = {
  paper_bgcolor: '#161620', plot_bgcolor: '#0e0e18',
  font: { color: '#9898b0', family: 'Inter, sans-serif', size: 11 },
  margin: { t: 10, r: 14, b: 38, l: 46 },
  xaxis: { gridcolor: '#1e1e2e', zerolinecolor: '#2a2a3a' },
  yaxis: { gridcolor: '#1e1e2e', zerolinecolor: '#2a2a3a' },
  showlegend: true, legend: { bgcolor: 'rgba(22,22,32,.85)' },
  hoverlabel: { bgcolor: '#1a1a28', bordercolor: '#3a3a50' },
};
const PLOT_CFG = { responsive: true, displayModeBar: false };

function plotHistogram(h) {
  const t = LANG[window._lang || 'ru'];
  Plotly.newPlot('c1', [
    { x: h.labels, y: h.t1, type: 'scatter', mode: 'none', fill: 'tozeroy', name: t.ch_t1, fillcolor: 'rgba(234,179,8,0.45)' },
    { x: h.labels, y: h.t2, type: 'scatter', mode: 'none', fill: 'tozeroy', name: t.ch_t2, fillcolor: 'rgba(249,115,22,0.45)' },
    { x: h.labels, y: h.t3, type: 'scatter', mode: 'none', fill: 'tozeroy', name: t.ch_t3, fillcolor: 'rgba(239,68,68,0.45)' },
    { x: h.labels, y: h.t4, type: 'scatter', mode: 'none', fill: 'tozeroy', name: t.ch_t4, fillcolor: 'rgba(139,92,246,0.45)' }
  ], { ...LAYOUT_BASE, xaxis: { ...LAYOUT_BASE.xaxis, title: { text: t.ch1_xlabel } }, yaxis: { ...LAYOUT_BASE.yaxis, title: { text: t.ch1_ylabel } } }, PLOT_CFG);
}
function plotCumulative(c) {
  const t = LANG[window._lang || 'ru'];
  Plotly.newPlot('c3', [
    { x: c.x, y: c.t1, type: 'scatter', mode: 'lines', name: t.ch_t1, line: { color: '#eab308', width: 2 } },
    { x: c.x, y: c.t2, type: 'scatter', mode: 'lines', name: t.ch_t2, line: { color: '#f97316', width: 2 } },
    { x: c.x, y: c.t3, type: 'scatter', mode: 'lines', name: t.ch_t3, line: { color: '#ef4444', width: 2 } },
    { x: c.x, y: c.t4, type: 'scatter', mode: 'lines', name: t.ch_t4, line: { color: '#8b5cf6', width: 2 } }
  ], { ...LAYOUT_BASE, xaxis: { ...LAYOUT_BASE.xaxis, title: { text: t.ch3_xlabel } }, yaxis: { ...LAYOUT_BASE.yaxis, title: { text: t.ch3_ylabel }, range: [0, 105] } }, PLOT_CFG);
}

// ===== ADVANCED PLOT FUNCTIONS =====
function plotScenarioFan(tracker) {
  const t = LANG[window._lang || 'ru'];
  const scenarios = tracker.runScenarioOverlay(30);
  const traces = scenarios.map((s, i) => ({
    x: s.years,
    y: s.caps,
    type: 'scatter',
    mode: 'lines',
    line: { color: 'rgba(88,166,255,0.15)', width: 1 },
    showlegend: false,
    hoverinfo: i === 0 ? 'skip' : 'skip',
  }));

  const yrRange = [2026, 2055];
  const lim = tracker.cfg.THRESHOLDS;

  // ВЕРСИЯ 5.0: Оставляем только T1.
  // T2, T3 и T4 теперь социотехнические состояния (IL, IC, DR),
  // их нельзя отобразить прямой горизонтальной линией на оси когнитивных способностей.
  traces.push(
    { x: yrRange, y: [lim.t1, lim.t1], type: 'scatter', mode: 'lines', name: t.ch_t1, line: { color: '#eab308', dash: 'dot', width: 1 } }
  );

  Plotly.newPlot('c6', traces, {
    ...LAYOUT_BASE,
    xaxis: { ...LAYOUT_BASE.xaxis, title: { text: t.ch2_xlabel }, range: yrRange },
    yaxis: { ...LAYOUT_BASE.yaxis, type: 'log', range: [0, 2.0], title: { text: 'Capability (log)' } },
  }, PLOT_CFG);
}

function plotDecomposition(tracker) {
  const t = LANG[window._lang || 'ru'];
  const d = tracker.runDecomposition();

  Plotly.newPlot('c7', [
    { x: d.years, y: d.hwComp, type: 'scatter', mode: 'lines', name: 'Hardware', stackgroup: 'one', fillcolor: 'rgba(88,166,255,0.5)', line: { color: '#58a6ff', width: 0.5 } },
    { x: d.years, y: d.algoComp, type: 'scatter', mode: 'lines', name: 'Algorithms', stackgroup: 'one', fillcolor: 'rgba(34,197,94,0.5)', line: { color: '#22c55e', width: 0.5 } },
    { x: d.years, y: d.paradigmComp, type: 'scatter', mode: 'lines', name: 'Paradigm Shifts', stackgroup: 'one', fillcolor: 'rgba(167,139,250,0.5)', line: { color: '#a78bfa', width: 0.5 } },
    { x: d.years, y: d.rsiComp, type: 'scatter', mode: 'lines', name: 'RSI Feedback', stackgroup: 'one', fillcolor: 'rgba(239,68,68,0.5)', line: { color: '#ef4444', width: 0.5 } },
  ], {
    ...LAYOUT_BASE,
    xaxis: { ...LAYOUT_BASE.xaxis, title: { text: t.ch2_xlabel } },
    yaxis: { ...LAYOUT_BASE.yaxis, title: { text: t.ch7_ylabel || 'Суммарный вклад (log FLOPs)' } },
    legend: { ...LAYOUT_BASE.legend, orientation: 'h', y: -0.15 },
  }, PLOT_CFG);
}

function plotEmbodimentDiagnostics(tracker, embodimentTrajectory) {
  const t = LANG[window._lang || 'ru'];
  const cfg = tracker.cfg;

  // 1) Histogram текущего embodiment_ceiling по всем частицам
  const ceilingVals = tracker.particles.map(p => p.embodiment_ceiling || cfg.EXPERT.embodimentPriorMean);
  const binW = 0.4;
  const binMin = 0.5, binMax = 12.0;
  const binLabels = [];
  const binCounts = new Array(Math.ceil((binMax - binMin) / binW)).fill(0);
  for (let i = 0; i < binCounts.length; i++) binLabels.push((binMin + i * binW).toFixed(1));
  ceilingVals.forEach(v => {
    const idx = Math.floor((Math.max(binMin, Math.min(binMax, v)) - binMin) / binW);
    if (idx >= 0 && idx < binCounts.length) binCounts[idx]++;
  });

  // 2) Embodiment trajectory (percentiles) — переиспользуем результат runMonteCarloForecast из runSimulation
  //    Если не передан (вызов из другого места) — fallback на nRuns=20 для адекватных бэндов
  const et = embodimentTrajectory || (() => {
    const mc = tracker.runMonteCarloForecast(20);
    return mc.embodimentTrajectory;
  })();

  // 3) Real robotics scatter markers
  const realYears = REAL_ROBOTICS_DATA.map(d => d.year);
  const realIdx = REAL_ROBOTICS_DATA.map(d => d.index);
  const realNames = REAL_ROBOTICS_DATA.map(d => d.name);

  // 4) Threshold lines
  const lim = cfg.EXPERT;
  const yrRange = [2026, 2040];
  const realConnector = {
    x: [REAL_ROBOTICS_DATA[0].year, REAL_ROBOTICS_DATA[REAL_ROBOTICS_DATA.length - 1].year],
    y: [REAL_ROBOTICS_DATA[0].index, REAL_ROBOTICS_DATA[REAL_ROBOTICS_DATA.length - 1].index],
  };

  const traces = [
    // === ROW 1: Histogram (xaxis2 / yaxis2 — нижний подзаголовок) ===
    { x: binLabels, y: binCounts, type: 'bar', xaxis: 'x2', yaxis: 'y2', name: t.ch8_hist || 'Particles', marker: { color: 'rgba(167,139,250,0.6)' }, showlegend: false },

    // === ROW 2: Embodiment trajectory band — стандартный паттерн 3-полос ===
    // p10 (нижняя граница, без fill) → затем p90 (fill='tonexty' = между p10 и p90)
    { x: et.years, y: et.p10, type: 'scatter', mode: 'lines', xaxis: 'x', yaxis: 'y', name: t.ch8_p10 || 'p10', line: { color: 'transparent', width: 0 }, showlegend: false, hoverinfo: 'skip' },
    { x: et.years, y: et.p90, type: 'scatter', mode: 'lines', xaxis: 'x', yaxis: 'y', name: t.ch8_p1090 || 'p10..p90', line: { color: 'transparent', width: 0 }, fill: 'tonexty', fillcolor: 'rgba(167,139,250,0.10)', showlegend: false, hoverinfo: 'skip' },
    // p25 (без fill) → p75 (fill='tonexty' = между p25 и p75, поверх p10..p90)
    { x: et.years, y: et.p25, type: 'scatter', mode: 'lines', xaxis: 'x', yaxis: 'y', name: t.ch8_p25 || 'p25', line: { color: 'transparent', width: 0 }, showlegend: false, hoverinfo: 'skip' },
    { x: et.years, y: et.p75, type: 'scatter', mode: 'lines', xaxis: 'x', yaxis: 'y', name: t.ch8_p2575 || 'p25..p75', line: { color: 'transparent', width: 0 }, fill: 'tonexty', fillcolor: 'rgba(167,139,250,0.18)', showlegend: false, hoverinfo: 'skip' },
    // Median (линия)
    { x: et.years, y: et.median, type: 'scatter', mode: 'lines', xaxis: 'x', yaxis: 'y', name: t.ch8_median || 'Median (MC)', line: { color: '#a78bfa', width: 2.5 } },

    // === Real robotics: connector line + scatter ===
    { x: realConnector.x, y: realConnector.y, type: 'scatter', mode: 'lines', xaxis: 'x', yaxis: 'y', name: t.ch8_real || 'Real robotics', line: { color: '#fbbf24', width: 2, dash: 'dot' } },
    { x: realYears, y: realIdx, type: 'scatter', mode: 'markers', xaxis: 'x', yaxis: 'y', name: t.ch8_real || 'Real robots', marker: { size: 9, color: '#fbbf24', line: { color: '#000', width: 1 } }, text: realNames, hovertemplate: '<b>%{text}</b><br>year=%{x}<br>index=%{y}<extra></extra>' },

    // === Threshold lines ===
    { x: yrRange, y: [lim.embodimentT4Requirement, lim.embodimentT4Requirement], type: 'scatter', mode: 'lines', xaxis: 'x', yaxis: 'y', name: t.ch8_t4req || 'T4 requirement', line: { color: '#ef4444', dash: 'dash', width: 1.5 } },
    { x: yrRange, y: [lim.embodimentBypassThreshold, lim.embodimentBypassThreshold], type: 'scatter', mode: 'lines', xaxis: 'x', yaxis: 'y', name: t.ch8_bypass || 'HW bypass', line: { color: '#22c55e', dash: 'dash', width: 1.5 } },
  ];

  const layout = {
    ...LAYOUT_BASE,
    grid: { rows: 2, columns: 1, pattern: 'independent', roworder: 'top to bottom' },
    xaxis: { ...LAYOUT_BASE.xaxis, domain: [0, 1], anchor: 'y', title: { text: t.ch2_xlabel || 'Год' }, range: yrRange },
    yaxis: { ...LAYOUT_BASE.yaxis, domain: [0.45, 1.0], anchor: 'x', title: { text: t.ch8_y_main || 'Embodiment (0..10)' }, range: [0, 11] },
    xaxis2: { ...LAYOUT_BASE.xaxis, domain: [0, 1], anchor: 'y2', title: { text: t.ch8_x_hist || 'embodiment_ceiling' } },
    yaxis2: { ...LAYOUT_BASE.yaxis, domain: [0, 0.32], anchor: 'x2', title: { text: t.ch8_y_hist || '#particles' } },
    legend: { ...LAYOUT_BASE.legend, orientation: 'h', y: -0.08, x: 0, xanchor: 'left' },
    margin: { l: 56, r: 24, t: 12, b: 64 },
    showlegend: true,
  };

  Plotly.newPlot('c8', traces, layout, PLOT_CFG);
}

function plotGroundingGap(gt) {
  const t = LANG[window._lang || 'ru'];
  const gapContainer = document.getElementById('c_gap');
  if (!gapContainer) return;

  const years = gt.years;
  const n = years.length;

  // Для цветовой дифференциации создаём две отдельные заливки
  // Красная зона: только участки где R > W
  const redX = [], redY = [];
  const greenX = [], greenY = [];
  
  for (let i = 0; i < n - 1; i++) {
    const r0 = gt.reasoning[i], w0 = gt.wm[i];
    const r1 = gt.reasoning[i+1], w1 = gt.wm[i+1];
    const yr0 = years[i], yr1 = years[i+1];
    
    // Разбиваем сегмент если линии пересекаются
    if ((r0 - w0) * (r1 - w1) < 0) {
      // Находим точку пересечения линейной интерполяцией
      const tCross = (r0 - w0) / ((r0 - w0) - (r1 - w1));
      const yrCross = yr0 + tCross * (yr1 - yr0);
      const valCross = r0 + tCross * (r1 - r0);
      
      if (r0 > w0) {
        redX.push(yr0, yrCross); redY.push(r0, valCross);
        greenX.push(yrCross, yr1); greenY.push(valCross, w1);
      } else {
        greenX.push(yr0, yrCross); greenY.push(w0, valCross);
        redX.push(yrCross, yr1); redY.push(valCross, r1);
      }
    } else if (r0 > w0 && r1 > w1) {
      redX.push(yr0, yr1); redY.push(r0, r1);
    } else {
      greenX.push(yr0, yr1); greenY.push(w0, w1);
    }
  }

  // Строим trace заливки между R и W для каждой зоны
  function buildFillTrace(fx, fy, color, name) {
    if (fx.length < 2) return null;
    // Интерполируем W по годам fillX для нижней границы заливки
    const wInterp = fx.map(yr => {
      let idx = 0;
      for (let k = 0; k < n - 1; k++) {
        if (yr >= years[k] && yr <= years[k + 1]) { idx = k; break; }
        if (k === n - 2) idx = k;
      }
      const frac = (yr - years[idx]) / (years[Math.min(idx + 1, n - 1)] - years[idx] || 1);
      return gt.wm[idx] + frac * (gt.wm[Math.min(idx + 1, n - 1)] - gt.wm[idx]);
    });
    
    return {
      x: [...fx, ...[...fx].reverse()],
      y: [...fy, [...wInterp].reverse()],
      type: 'scatter', mode: 'none',
      fill: 'toself',
      fillcolor: color,
      name: name,
      showlegend: true,
      hoverinfo: 'x+y',
      line: { width: 0 }
    };
  }

  const redTrace = buildFillTrace(redX, redY, 'rgba(239,68,68,0.3)', t.gap_red_zone);
  const greenTrace = buildFillTrace(greenX, greenY, 'rgba(34,197,94,0.25)', t.gap_green_zone);

  // Dotted R=W reference line: find where R crosses W
  const traces = [];
  if (redTrace && redTrace.x && redTrace.x.length > 0) traces.push(redTrace);
  if (greenTrace && greenTrace.x && greenTrace.x.length > 0) traces.push(greenTrace);
  
  // Reasoning and World Modeling lines
  traces.push({
    x: years, y: gt.reasoning,
    type: 'scatter', mode: 'lines',
    name: t.gapg_series_r,
    line: { color: '#a78bfa', width: 2.5 },
  });
  traces.push({
    x: years, y: gt.wm,
    type: 'scatter', mode: 'lines',
    name: t.gapg_series_w,
    line: { color: '#22c55e', width: 2.5 },
  });

  // R=W reference (average of R and W at each year, shown as dotted)
  // Actually, let's draw a line through points where R=W (interpolated crossings)
  // For simplicity, draw the lower envelope (W) as baseline and label gap

  // The x range was a hardcoded [2026, 2045] while the trajectory runs to 2066.
  // Everything past 2045 was silently clipped -- including the annotations,
  // which sat at year 2054 and therefore rendered nowhere. Both now follow the
  // data.
  const yrLo = years[0], yrHi = years[n - 1];
  const maxR = Math.max(...gt.reasoning);
  const annotations = [{
    x: yrLo + (yrHi - yrLo) * 0.62,
    y: maxR * 0.62,
    text: t.gapg_ann_red,
    showarrow: false,
    font: { color: '#ef4444', size: 11 }
  }];
  // Only claim a grounded zone if one exists. Measured on the median
  // trajectory, R > W in 480 of 480 years -- grounding narrows the gap but
  // never closes it at the median -- so the green band was a legend entry for
  // a band that never appears. Annotating it would be the same caption/content
  // mismatch this page already had twice.
  if (greenTrace) {
    annotations.push({
      x: yrLo + (yrHi - yrLo) * 0.62,
      y: maxR * 0.12,
      text: t.gapg_ann_green,
      showarrow: false,
      font: { color: '#22c55e', size: 11 }
    });
  }

  const layout = {
    ...LAYOUT_BASE,
    title: { text: t.chart_gap, font: { size: 14, color: '#eab308' } },
    xaxis: { ...LAYOUT_BASE.xaxis, title: { text: t.ch2_xlabel }, range: [yrLo, yrHi] },
    yaxis: {
      ...LAYOUT_BASE.yaxis,
      title: { text: t.gap_y_axis },
      range: [0, maxR * 1.15],
    },
    legend: { ...LAYOUT_BASE.legend, orientation: 'h', y: -0.25 },
    annotations,
  };

  Plotly.newPlot('c_gap', traces, layout, PLOT_CFG);
}



// ============================================================================
// 10. LOCALIZATION & INITIALIZATION
// ============================================================================

window._lang = 'ru';
const LANG = {
  ru: {
    // Added for RU coverage to match the EN pack. These 168 keys were used by
    // data-i18n in the markup but present in no language pack, so the page only
    // ever showed Russian because of the hardcoded markup fallback. Text below is
    // copied verbatim from the markup — no rewording.
    cum_p1:'Накопленная функция распределения: P(T2 ≤ X) и P(T4 ≤ X). Отвечает на вопрос «какова вероятность, что T2/T4 случится не позднее года X?»',
    cum_p2:'Вычисление: из тех же 3000 прогонов. Для каждого года T:',
    cum_p3:'Ступенчатый подъём = концентрация прогнозов в узком окне. Плато = затор (data wall, энергетика, регуляция). Резкий скачок = почти все частицы сходятся в одном сценарии.',
    cum_p4:'Кривая T4 лежит правее кривой T2 в текущем posterior, но это эмпирическое свойство прогона, а не следствие конструкции: T2 требует DP и IL, а T4 — DR и embodiment, и ни одно из этих условий не влечёт другое формально.',
    cum_p5:'Что влияет: те же факторы, что и гистограмма. Кривые дополняют друг друга — гистограмма показывает «где пик», кумулятивная — «какова вероятность к году X».',
    decomp_p1:'Диаграмма с накоплением: разбивка суммарного прироста capability на четыре компонента — железо, алгоритмы, парадигмные сдвиги и обратная связь RSI. Показывает, какой вклад даёт каждый канал в каждый момент времени.',
    decomp_p2:'Компоненты:',
    decomp_p3:'Считается как усреднение по частицам с весами. Каналы не выбираются по очереди, они накапливаются одновременно, поэтому видна не «последовательность шагов к сингулярности», а доля каждого механизма в суммарном росте.',
    eh_p1:'Анимированная визуализация распределения T2/T4. Каждая частица = один MC прогон. Вылетает из центра (2026) и застывает на орбите своего года T2/T4.',
    eh_p2:'Что читается с картинки: плотные кольца = много частиц с близким годом, то есть высокая плотность этого года в posterior. Разреженные точки = маловероятные годы.',
    eh_p3:'Механика: частица «взлетает» из центра (2026) и останавливается на радиусе, соответствующем её году. Расстояние от центра кодирует ГОД, а не вес частицы; цвет и свечение кодируют стадию T2/T4.',
    eh_p4:'Что влияет: распределение годов T2/T4 из posterior и случайность прогона Монте-Карло (1000 частиц). Симметричная сфера = один чёткий пик, размытая = несколько конкурирующих сценариев. Медиана и P(T2 к 2068) считаются из того же набора и обновляются вместе с ним.',
    eh_play:'Запуск',
    eh_reset:'Сброс',
    eh_title:'Визуализация: «Сфера Сингулярности»',
    emb_p1:'Embodiment — 4-е латентное измерение: физическая воплощённость ИИ. В формулу capability оно НЕ входит: capability = (R · A · W)^⅓, то есть геометрическое среднее рассуждения, агентности и модели мира. Embodiment работает отдельными воротами — T4 засчитывается только при Emb ≥ 6.0, — поэтому без робототехники T4 недостижим, как бы ни росло capability.',
    emb_p2:'Верхний график: траектория embodiment (p10 / p25 / медиана / p75 / p90) по годам. Жёлтые точки = реальные роботы: Spot, Optimus Gen 1-3, Figure 02/03, 1X Neo, Apptronik Apollo, Unitree H1. Bypass (зелёная черта) — при embodiment выше неё ИИ строит свои дата-центры, HW-рост ускоряется ×3. T4 requirement (красная) — минимальный embodiment для засчитывания T4.',
    emb_p3:'Нижний график: распределение embodiment_ceiling по 1000 частицам. Это априор, а не измерение: среднее 4.0, σ 2.0, нижняя отсечка 1.5. Существенно, что ворота T4 стоят на 6.0 — примерно на σ выше априорного среднего, то есть попадание в них требует оптимистичной части распределения.',
    emb_p4:'Real robotics prior: realRoboticsWeight (0…1) в Expert Panel управляет силой likelihood-штрафа за отклонение embodiment_ceiling от реальных роботов. weight=0 — игнор, weight=1 — строгое следование.',
    expert_backtest:'📊 Бэктест',
    expert_blkA:'Парадигмы и потолки',
    expert_blkA2:'Смена парадигм',
    expert_blkB:'Самоулучшение (RSI)',
    expert_blkB2:'Железо',
    expert_blkC:'Кризисы и штрафы',
    expert_blkD:'Бенчмарки и наблюдения',
    expert_blkD2:'Test-Time Compute',
    expert_blkD3:'Априорные допущения',
    expert_blkD4:'World Models',
    expert_blkD5:'Симуляция',
    expert_blkE:'Барьеры реальности',
    expert_blkF:'Воплощённость',
    expert_blkG:'Институциональное вето',
    expert_p_institutionalVetoThreshold:'Порог силы сопротивления',
    expert_d_institutionalVetoThreshold:'Доля населения, при которой сопротивление удерживает IC ниже порога T3. Выше — захват становится невозможным',
    expert_p_institutionalVetoStrength:'Априор силы сопротивления',
    expert_d_institutionalVetoStrength:'Центр распределения сопротивления между частицами; разброс задаётся эффективностью RSI. 0.5 = текущий уровень',
    expert_p_institutionalVetoOnset:'Момент включения (DP)',
    expert_d_institutionalVetoOnset:'Значение давления делегирования, после которого сопротивление начинает мобилизацию. DP насыщается до 1.0 примерно за месяц, поэтому любой порог выше ~0.6 срабатывает одновременно',
    expert_p_institutionalVetoRamp:'Скорость мобилизации',
    expert_d_institutionalVetoRamp:'/год: как быстро сопротивление набирает силу после включения',
    expert_p_institutionalVetoDecay:'Усталость сопротивления',
    expert_d_institutionalVetoDecay:'/год: спад без подкрепления. Высокое значение означает быстро выгорающее сопротивление',
    expert_blkH:'Человеческая агентность',
    expert_p_humanAgencyInitial:'Начальная доля решений за людьми',
    expert_d_humanAgencyInitial:'Стартовая величина: какая доля значимых решений в 2026 году остаётся человеческой',
    expert_p_humanAgencyCaptureGate:'Порог захвата институтов',
    expert_d_humanAgencyCaptureGate:'Ниже этой доли рост IC прекращается: институты не могут быть захвачены, пока люди решают',
    expert_p_humanAgencyDecay:'Естественная утрата позиций',
    expert_d_humanAgencyDecay:'/год: базовая скорость, с которой агентность убывает без внешнего давления',
    expert_p_humanAgencyDelegationGain:'Выгода делегирования',
    expert_d_humanAgencyDelegationGain:'/год: ускорение убыли, когда система становится выгодной (растёт с A)',
    expert_p_humanAgencyVetoBonus:'Торможение убыли сопротивлением',
    expert_d_humanAgencyVetoBonus:'Насколько институциональное сопротивление замедляет утрату позиций. 0 — сопротивление бесполезно',
    expert_p_humanAgencyInterventionBonus:'Восстановление вмешательством государства',
    expert_d_humanAgencyInterventionBonus:'Доля потери, восстанавливаемая государственным вмешательством. Пропорционально остатку, поэтому не может создать полномочия из ничего',
    expert_p_humanAgencyRecover:'Восстановление после инцидента',
    expert_d_humanAgencyRecover:'Доля потери, восстанавливаемая инцидентом выравнивания',
    expert_p_humanAgencyFloor:'Пол остатка полномочий',
    expert_d_humanAgencyFloor:'Нижняя граница: полное отчуждение необратимо, но не мгновенно',
    expert_blkI:'Заземление reasoning',
    expert_p_groundingRate:'Доля reasoning, уходящая в заземление',
    expert_d_groundingRate:'Скорость, с которой новые рассуждения превращаются в пригодную модель мира. Главный параметр зазора R ≫ W',
    expert_p_groundingRateMax:'Предел поглощения',
    expert_d_groundingRateMax:'Потолок поглощения: вступает в силу только когда он НИЖЕ groundingRate. При 0.9 не срабатывает ни разу — разрыв удерживается малой скоростью groundingRate',
    expert_p_groundingEfficiency:'КПД заземления',
    expert_d_groundingEfficiency:'Доля заземления, доходящая до материи. Датчики и энергия ограничены независимо от качества рассуждений',
    expert_p_groundingLabourCost:'Цена заземления',
    expert_d_groundingLabourCost:'Доля выигрыша в агенции, съедаемая заземлением. Ноль превращает заземление в субсидию, при которой T3 наступает быстрее',
    expert_d_agencyScalingSlope:'Наклон кривой масштабирования FLOPs → Agency',
    expert_d_alignmentCooldown:'Заморозка регуляторами после инцидента',
    expert_d_arc_agi:'Текущий уровень ARC-AGI для наблюдений',
    expert_d_barrierAtomsLimit:'Макс. удвоений HW в год',
    expert_d_barrierDemandGrace:'Лет на адаптацию экономики к T2',
    expert_d_barrierEnergyLog:'Предел FLOPs (log)',
    expert_d_barrierGeopoliticsRisk:'Шанс государственного шока после T2',
    expert_d_barrierNashFriction:'Координационная деградация после T3',
    expert_d_baseShiftMultiplier:'Множитель потолка при первом сдвиге (1.1=иллюзия прорыва, 10=квантовый скачок)',
    expert_d_bubbleBurstRisk:'Шанс краха инвестиций если agency < 4',
    expert_d_ceilingReasoningBase:'Когда текущая архитектура упрется в стену',
    expert_d_coordinationFriction:'Деградация при масштабировании агентов (0 = идеальная координация)',
    expert_d_dataWallPenalty:'Множитель скорости алгоритмов при исчерпании данных',
    expert_d_embodimentBypassThreshold:'Embodiment > порога → ИИ строит дата-центры (HW-рост ×3)',
    expert_d_embodimentPriorMean:'Априорное среднее embodiment_ceiling (робототехника сложна)',
    expert_d_embodimentT4Requirement:'Минимальный embodiment для засчитывания T4 (контроль атомов)',
    expert_d_governanceMoratoriumProb:'Доля лет на моратории (0.04 = ~1 шок за 25 лет)',
    expert_d_governanceShockDamping:'Множитель HW-роста во время моратория (0.5 = в 2 раза медленнее)',
    expert_d_horizon:'Горизонт автономности для текущих бенчмарков',
    expert_d_hwCoDesignBonus:'Насколько AGI ускоряет закон Мура',
    expert_d_hypeGapThreshold:'Разрыв reasoning-agency для старта Зимы ИИ',
    expert_d_hypeGracePeriod:'Сколько лет рынок заливает деньги в новую парадигму',
    expert_d_inferenceSaturationCap:'Базовый интеллект, где CoT перестаёт давать бонус',
    expert_d_maxCapitalMultiplier:'Макс. множитель инвестиций при высокой полезности',
    expert_d_maxInferenceBonusAgency:'Максимальный множитель Test-Time Compute для автономности',
    expert_d_maxInferenceBonusReasoning:'Максимальный множитель Test-Time Compute для логики',
    expert_d_maxPhysicalHwGrowth:'Физический предел роста hardware',
    expert_d_minShiftMultiplier:'Гарантированный минимум (потолок не уменьшится)',
    expert_d_observationNoiseSigma:'Уровень доверия к бенчмаркам (меньше = строже фильтр)',
    expert_d_observationSigmaMode:'Режим вычисления σ в likelihood',
    expert_d_overhangShiftMultiplier:'Влияние избытка капитала на вероятность прорыва',
    expert_d_paradigmDecayRate:'Насколько слабее каждый следующий сдвиг (0=бесконечная сингулярность)',
    expert_d_plateauHardWallCeiling:'Потолок agency_ceiling для hard_wall частиц (ниже = жёстче плато)',
    expert_d_priorAgencyMean:'Априорное среднее потолка агентности. Сдвиг на ±30% меняет медиану T3 на 4.2-7.7 года — это допущение, а не измерение',
    expert_d_priorAgencyStd:'Разброс мнений о потолке (больше = больше оптимистичных частиц)',
    expert_d_realRoboticsWeight:'Вес prior на embodiment_ceiling от реальных роботов (Spot/Optimus/Figure/1X)',
    expert_d_reasoningScalingSlope:'Наклон кривой масштабирования FLOPs → Reasoning',
    expert_d_rsiMultiplier:'Умножает все коэффициенты RSI (0 = без самоулучшения)',
    expert_d_rsiTriggerAgency:'Agency для старта авто-улучшений',
    expert_d_rsiTriggerReasoning:'Reasoning для старта авто-улучшений',
    expert_d_saturationThreshold:'Насколько надо упереться для смены парадигмы',
    expert_d_simulations:'Количество Monte Carlo прогонов (500-10000)',
    expert_d_t1Threshold:'Порог capability для T1',
    expert_d_t2DemandThreshold:'Спрос на ИИ-координатора (DP) при котором T2 достигнут',
    expert_d_t3CaptureThreshold:'Доля захваченных институтов (IC) при которой T3 достигнут',
    expert_d_t4DependencyThreshold:'Цивилизационная зависимость (DR) при которой T4 достигнут',
    expert_d_toolUseVsAutonomyWeight:'0 = бенчмарк взлабывается reasoning, 1 = только реальная автономность',
    expert_d_winterDamping:'Множитель инвестиций и алгоритмов в Зиму ИИ',
    expert_p_agencyScalingSlope:'Наклон Agency',
    expert_p_alignmentCooldown:'Инцидент безопасности (лет)',
    expert_p_arc_agi:'ARC-AGI (%)',
    expert_p_barrierAtomsLimit:'Проклятие атомов',
    expert_p_barrierDemandGrace:'Смысловой предел',
    expert_p_barrierEnergyLog:'Термодинамика',
    expert_p_barrierGeopoliticsRisk:'Геополитика',
    expert_p_barrierNashFriction:'Конкуренция ИИ',
    expert_p_baseShiftMultiplier:'Базовый множитель прорыва',
    expert_p_bubbleBurstRisk:'Риск GPU-пузыря',
    expert_p_ceilingReasoningBase:'Потолок Трансформеров',
    expert_p_coordinationFriction:'Координационное трение',
    expert_p_dataWallPenalty:'Штраф Стены Данных',
    expert_p_embodimentBypassThreshold:'Embodiment bypass threshold',
    expert_p_embodimentPriorMean:'Embodiment prior mean',
    expert_p_embodimentT4Requirement:'T4 embodiment requirement',
    expert_p_governanceMoratoriumProb:'Compute Governance',
    expert_p_governanceShockDamping:'Демпфирование шока',
    expert_p_horizon:'Автономность (часов)',
    expert_p_hwCoDesignBonus:'HW ко-дизайн',
    expert_p_hypeGapThreshold:'Порог разрыва (Зима ИИ)',
    expert_p_hypeGracePeriod:'Венчурный хайп (лет)',
    expert_p_inferenceSaturationCap:'Порог насыщения TTC',
    expert_p_maxCapitalMultiplier:'Эластичность капитала',
    expert_p_maxInferenceBonusAgency:'Макс. TTC бонус (Agency)',
    expert_p_maxInferenceBonusReasoning:'Макс. TTC бонус (Reasoning)',
    expert_p_maxPhysicalHwGrowth:'Макс. рост железа',
    expert_p_minShiftMultiplier:'Мин. множитель сдвига',
    expert_p_observationNoiseSigma:'Шум наблюдений (σ)',
    expert_p_observationSigmaMode:'Режим шума наблюдений',
    expert_p_overhangShiftMultiplier:'Compute Overhang',
    expert_p_paradigmDecayRate:'Темп убывающей отдачи',
    expert_p_plateauHardWallCeiling:'Plateau: потолок Agency',
    expert_p_priorAgencyMean:'Априорное среднее Agency',
    expert_p_priorAgencyStd:'Априорный разброс',
    expert_p_realRoboticsWeight:'Real robotics prior weight',
    expert_p_reasoningScalingSlope:'Наклон Reasoning',
    expert_p_rsiMultiplier:'Множитель RSI',
    expert_p_rsiTriggerAgency:'Порог RSI (Agency)',
    expert_p_rsiTriggerReasoning:'Порог RSI (Reasoning)',
    expert_p_saturationThreshold:'Порог насыщения',
    expert_p_simulations:'Симуляции (N)',
    expert_p_t1Threshold:'Порог T1 (Понимание)',
    expert_p_t2DemandThreshold:'Порог спроса T2 (DP)',
    expert_p_t3CaptureThreshold:'Порог захвата T3 (IC)',
    expert_p_t4DependencyThreshold:'Порог зависимости T4 (DR)',
    expert_p_toolUseVsAutonomyWeight:'Вес Autonomy в SWE-bench',
    expert_p_winterDamping:'Строгость Зимы ИИ',
    expert_toggle_label:'Expert Sandbox', expert_toggle_title:'Свернуть / развернуть панель',
    expert_world_cascade:'Каскад',
    expert_world_desc:'Априорные вероятности гипотез о структуре реальности. Сумма = 100%.',
    expert_world_error:'Сумма должна быть 100%',
    expert_world_hardWall:'Стена',
    expert_world_slowTakeoff:'Медл.взлёт',
    fan_p1:'30 случайных прогонов из posterior, наложенных полупрозрачно. Показывает разброс возможных путей capability от 2026 до 2050 года (логарифмическая шкала).',
    fan_p2:'Каждый прогон: случайная частица (по весам) симулируется до 45 лет с месячным шагом. На каждом шаге действуют парадигмные сдвиги, RSI и экономические ограничения.',
    fan_p3:'Плотные пучки = сценарии сходятся. Разброс = высокая неопределённость. Горизонтальная линия — порог capability для T1; это единственная стадия, которая срабатывает по capability. T2–T4 зависят от социотехнических переменных (DP, IL, IC, DR) и на этом графике не отмечены.',
    fan_p4:'Что формирует веер:• Ширина ← различие в hw_months, algo_months между частицами• Наклон ← FLOPs-scaling (hwK и algoK)• Изгибы ← paradigm shifts, RSI onset, экономические стены',
    footer_note:'Данные оценочные',
    hist_p1:'Результат 3000 прогонов Monte Carlo из апостериорного распределения. По оси X — год, по Y — количество прогонов, в которых T2/T4 достигнут в этот год.',
    hist_p2:'Ключевое уравнение: каждый прогон выбирается из весов частиц (systematic resampling), затем траектория интегрируется 45 лет с месячным шагом. Важная деталь: гистограмма показывает только первые 30 лет от 2026.75, то есть примерно до 2056.8. Переходы позже этой отметки в неё не попадают — код отбрасывает их молча, без предупреждения. Правый край гистограммы означает конец окна, а не отсутствие событий.',
    hist_p3:'Пик гистограммы — год с наибольшим числом прогонов, но не «наиболее вероятный год» в строгом смысле: при 3000 прогонах высота столбца шумна. Надёжнее читать медиану и ширину распределения. Бимодальность указывает на два конкурирующих сценария, а не на один размытый пик.',
    hist_p4:'Что сдвигает гистограмму: новые наблюдения бенчмарков (через обновление весов частиц), параметры Expert Sandbox (пороги RSI, парадигмы, потолки), количество частиц.',
    loading:'Running particle-filter forecast…',
    obs_arc:'ARC-AGI',
    obs_cost:'Стоимость 1M токенов',
    obs_current:'Прогноз при текущих бенчмарках:',
    obs_horizon:'Автономность',
    obs_swe:'SWE-bench',
    swarm_hint:'Нажмите «Запуск» или перетаскивайте ползунок',
    swarm_learn_p1:'Интерактивная визуализация обновления весов частиц в реальном времени. Каждая точка — гипотеза о мире (частица): скорость роста железа hw_months и потолок агентности agency_ceiling.',
    swarm_learn_p2:'Режим «Обучение» (Learn): ползунок прикладывает наблюдения бенчмарков одно за другим. При каждом наблюдении пересчитываются веса:',
    swarm_learn_p3:'где Ri и Agi — предсказания частицы i на год наблюдения, σ — нешумящее правдоподобие. Частицы, чьи предсказания далеки от наблюдения, экспоненциально теряют вес.',
    swarm_learn_p4:'Режим «Прогноз» (Forecast): все наблюдения применены. Ползунок фильтрует гипотезы по году T2 — показывая, какие частицы предсказывают T2 до выбранного года.',
    swarm_learn_p5:'Визуальный язык: яркие области = высокая плотность весов; оранжевый круг = медиана роя; красный = текущее наблюдение. В режиме покоя рой перестраивается из нового прогона каждые 0.25 сек — это пересчёт по той же posterior, а не поступление новых данных.',
    swarm_learn_p6:'Что влияет: количество и точность наблюдений бенчмарков, априорные допущения (priorAgencyMean/Std в Expert Sandbox), сам состав частиц.',
    swarm_mode_forecast:'Прогноз',
    swarm_mode_learn:'Обучение',
    swarm_reset:'Сброс',
    swarm_title:'Визуализация обучения и прогноза',
    // Header
    hdr_title:'Singularity Forecaster', hdr_sub:'v6.0 — Четыре стадии отлучения',
    // Status bar
    sb_t1:'Медиана T1 (Когнитивное доминирование)', sb_t2:'Медиана T2 (Предсказуемость)',
    sb_t3:'Медиана T3 (Институциональный захват)', sb_t4:'Медиана T4 (Цивилизационная зависимость)',
    sb_pagi_2029:'P(T2 · 2029)', sb_pagi_2033:'P(T2 · 2033)', sb_pagi_2040:'P(T2 · 2040)',
    sb_pasi_2035:'P(T4 · 2035)', sb_pasi_2045:'P(T4 · 2045)',
    sb_hw:'Удвоение HW', sb_algo:'Удвоение Algo', sb_agency:'Потолок Agency', sb_ess:'ESS',
    // Controls
    ctrl_simulations:'Симуляции (N)', ctrl_obs_year:'Год наблюдения',
    ctrl_intelligence:'Reasoning (Логика)', ctrl_agentic:'Agency (Агентность)',
    ctrl_add:'Добавить', ctrl_reset:'Сбросить',
    ctrl_swe_bench:'SWE-bench (%)', ctrl_arc_agi:'ARC-AGI (%)',
    ctrl_horizon:'Автономность (часов)', ctrl_cost:'Стоимость 1M токенов ($)',
    run_btn:'Запустить симуляцию',
    // Charts
    tag1:'Вероятностный анализ', tag3:'Кумулятивная', tag6:'Сценарии', tag7:'Декомпозиция', tag8:'Embodiment',
    chart1:'1. Распределение 4-х этапов Сингулярности (Monte Carlo)',
    chart3:'2. Накопленная вероятность (Cumulative PDF)',
    // at every benchmark pair, so a T2 heatmap was a flat block of colour.
    chart6:'3. Веер сценариев (Multi-Run Overlay)',
    chart7:'4. Вклад компонентов (накопительная диаграмма)',
    chart_gap:'6. Каузальный разрыв: заземление (Grounding Gap)',
    chart8:'5. Embodiment: распределение и реальная робототехника',
    tip1:'Аппроксимация функции плотности вероятности (PDF) моментов достижения пороговых состояний τ = inf {t : C(t) ≥ C_crit}. Рассчитано методом Монте-Карло (N=3000) на основе сэмплирования из апостериорного распределения частиц.',
    tip3:'Эмпириальная кумулятивная функция распределения (CDF), F(t) = P(T ≤ t). По одной кривой на каждый этап — T1, T2, T3, T4: вероятность, что этап достигнут не позднее соответствующего года по оси X.',
    tip6:'Проекция 30 стохастических траекторий C(t) из ансамбля. Визуализирует фазовые переходы (смены парадигм), эффекты RSI и влияние эндогенных шоков (схлопывание пузырей, моратории).',
    tip7:'Декомпозиция логарифмического роста ∫₀ᵗ (k_hw + k_algo + k_rsi) dt. Площади отражают интегральный вклад аппаратного масштабирования, алгоритмической эффективности, парадигмальных сдвигов и рекурсивной обратной связи (RSI).',
    tip_gap:'Эпистемическая дивергенция между когнитивной мощностью (Reasoning) и каузальным согласованием (World Modeling). Зона высокого риска, где R(t) ≫ W(t): reasoning опережает модель мира, по которой его можно проверить. До groundingRate зазор был структурным дефектом модели, а не физическим явлением.',
    tip8:'Марковская оценка латентной переменной Embodiment. Верхняя панель: перцентильный коридор прогноза E(t) с эмпирической калибровкой на индексе реальной робототехники. Нижняя панель: маргинальное распределение E_ceiling в апостериорном ансамбле.',
    ch_t1:'T1: Доминирование', ch_t2:'T2: Предсказуемость', ch_t3:'T3: Захват институтов', ch_t4:'T4: Зависимость',
    // The live-swarm captions carried data-i18n keys in the markup but were
    // never defined in either pack, so the whole section stayed Russian even
    // after switching to English.
    live_swarm_title:'Симуляция в реальном времени',
    live_swarm_desc:'Рой перерисовывается каждые 0.25 сек из нового прогона Monte Carlo (500 траекторий). T1–T4 — цветовые коды стадий. Новых данных это не добавляет: меняется только случайная выборка из того же апостериорного распределения.',
    live_swarm_p1:'Четыре параллельные симуляции — T1, T2, T3, T4 — пересчитываются каждые 0.25 сек из 500 траекторий Монте-Карло. Показывает posterior без нажатия «Запуск», но новых наблюдений не добавляет: разброс между кадрами — это шум пересчёта, а не движение апостериора.',
    live_swarm_p2:'Точки: каждая частица = один прогон Монте-Карло. Цвет кодирует год T1/T2/T3/T4: голубой = ранний, жёлтый = средний, красный = поздний. Прозрачность = вес частицы.',
    live_swarm_p3:'Год T1–T4 для каждой частицы: траектория интегрируется от якоря BASE_YEAR = 2023 (уровень GPT-4) на 45 лет вперёд с месячным шагом, поэтому T1–T4 — это абсолютные годы, а T2 может оказаться и в прошлом относительно закреплённого настоящего 2026.75. T1–T4 — первые годы, в которых состояние пересекает свой порог: capability для T1, DP и IL для T2, IC для T3, DR и embodiment для T4.',
    live_swarm_p4:'Статистика справа: медиана, P10–P90 и число частиц, на которые ссылается кадр. Пересчитывается вместе с роем. Видна одна лишь дисперсия внутри текущего posterior; смена апостериора определяется наблюдениями, а не этим таймером.',
    live_swarm_p5:'Что влияет: текущий набор наблюдений, веса частиц, случайность MC прогона. Стабильность картинки ← уверенность модели. Хаотичность ← высокая неопределённость.',
    ch1_xlabel:'Год', ch1_ylabel:'Прогонов',
    ch3_xlabel:'Год', ch3_ylabel:'P(%)', ch3_pt2:'P(T2)', ch3_pt4:'P(T4)',
    // runSensitivityMatrixAsync on why T2 was a degenerate choice).

    ch7_ylabel:'Суммарный вклад (log FLOPs)',
    // ch2_xlabel is read by the scenario fan (c6) and the decomposition (c7)
    // for their x axes. It was never defined in either language pack, so both
    // charts rendered the literal string "undefined" as their axis title.
    ch2_xlabel:'Год',
    ch8_median:'Медиана (MC)', ch8_p1090:'p10..p90', ch8_p2575:'p25..p75', ch8_real:'Реальные роботы', ch8_t4req:'T4 requirement', ch8_bypass:'HW bypass', ch8_y_main:'Embodiment (0..10)', ch8_x_hist:'embodiment_ceiling', ch8_y_hist:'# частиц',
    fY_suffix:' лет', fY_gt:'> 40 лет', fY_achieved:'уже достигнуто',
    expert_world_resilient:'Иммунитет',
    // About
    about_title:'Методология модели v6.0',
    about_intro:'Модель v6.0 отказалась от голой экстраполяции интеллекта в пользу эпидемиологии принятия решений. Кроме роста когнитивных способностей ИИ она моделирует добровольную передачу контроля (Delegation Pressure) и последующий структурный захват институтов (Institutional Capture). Логика в том, что делегирование — не следствие превосходства ИИ, а самостоятельный процесс со своими порогами, задержками и сопротивлением. Ни одна из четырёх стадий не является неизбежной: каждая задаётся порогом, и при калибровке по умолчанию T1 наступает практически в каждом мире, а T3 — в большинстве. Поэтому важнее не сами сроки, а их распределение.',
    defs_label:'Архитектура и контуры',
    defs_label_arch:'Топология латентного пространства',
    defs_label_contours:'Пороги модели',
    arch_tracker_title:'Фильтр частиц (Particle Filter)',
    arch_tracker_desc:'Ансамбль из N=1000 частиц. При поступлении вектора наблюдений (бенчмарков) веса гипотез обновляются через гауссово правдоподобие. Chatbot Arena Elo теперь напрямую калибрует параметр P (Persuasion) — убедительность ИИ, отсекая маловероятные сценарии развития.',
    arch_dims_title:'Когнитивный и Социотехнический слои',
    arch_dims_desc:'Базис: Reasoning (R), World Modeling (W), Agency (A), Embodiment (E). Над ними надстроен социотехнический слой: Persuasion (P) — убедительность, Delegation Pressure (DP) — давление делегирования, Institutional Legitimacy (IL) — легализация, Institutional Capture (IC) — захват институтов, и Dependency Ratio (DR) — зависимость цивилизации.',
    arch_paradigm_title:'Стохастические сдвиги парадигм',
    arch_paradigm_desc:'Преодоление структурных лимитов моделируется как пуассоновский процесс. Интенсивность возрастает при насыщении науки и избытке капитала (Compute Overhang). Эффективность каждого последующего сдвига затухает.',
    arch_rsi_title:'Динамика RSI (Recursive Self-Improvement)',
    arch_rsi_desc:'Автономное ускорение R&D. Скорость алгоритмических улучшений пропорциональна когнитивному превосходству ИИ и сглаживается мягким гейтом: активация есть произведение двух сигмоид по рассуждению (S) и агентности (C) с настраиваемыми триггерами. Это не «включение на T1», а плавное нарастание по мере приближения к триггерам.',
    arch_bottlenecks_title:'Эндогенная социодинамика и Барьеры',
    arch_bottlenecks_desc:'Штрафы заменены органической динамикой. Государство вводит моратории, когда давление делегирования (DP) растёт, но захват (IC) ещё мал: пороги T2 — 0.5 по спросу и 0.3 по институциональной принятости. Наоборот, когда IC переходит порог T3 (0.6), политики теряют контроль над рубильником. Экономический рост тормозит, когда ИИ способен, но ему не доверяют.',
    arch_mc_title:'Монте-Карло прогнозирование',
    arch_mc_desc:'Прямое интегрирование SDE системы в будущее. Основной прогноз — 3000 независимых траекторий по 45 лет с месячным шагом; панели «рой» переиспользуют 500. Из моментов переходов τ_T1 … τ_T4 извлекаются медианы и перцентили с учётом инерции общества.',
    arch_expert_title:'Эпистемологический симулятор',
    arch_expert_desc:'Интерфейс параметризации априорных распределений P(θ). Позволяет проверять гипотезы о физике интеллекта (Cascade, Hard Wall, Slow Takeoff) и измерять чувствительность заднего распределения. Панель чувствительности к априорам показывает, как сдвигаются сроки T3/T4 и доля решений за людьми при изменении априорного потолка агентности.',
    arch_shocks_title:'Экзогенные и эндогенные шоки',
    arch_shocks_desc:'Включает марковские переходы состояний: исчерпание качественных токенов (Data Wall → деградация k_algo), инциденты безопасности, и коллапс инвестиционного пузыря (GPU Bubble → уничтожение капитала).',
    defs_intro:'В модели v6.0 описываются четыре порога институционального поглощения цивилизации:',
    t1_def_title:'T1: Порог когнитивного доминирования',
    t1_def_score:'Критерий: R > Эксперт, W > Эксперт',
    t1_def_text1:'Система стабильно превосходит лучших специалистов в большинстве когнитивных задач. Пользование становится ритуальным. Машины лучше людей пишут архитектуры машин (запуск RSI).',
    t1_def_text2:'Промежуточные стадии: Инструмент → Усилитель → Посредник.',
    t2_def_title:'T2: Порог предсказуемости',
    t2_def_score:'Критерий: DP > 0.5, IL > 0.3',
    t2_def_text1:'ИИ становится предсказуемым инструментом координации: спрос (DP) на него как на посредника превышает порог, а институциональная принятость (IL) достигает необходимого уровня. Это порог предсказуемости, а не выгоды: он измеряет, насколько надёжно на машину можно опереться, а не насколько люди от этого выигрывают. Доля решений, остающихся за людьми, — отдельная величина (humanAgency), и она ограничивает рост институционального захвата.',
    t2_def_text2:'Промежуточные стадии: Координатор → Арбитр → Архитектор среды. Критерий: DP и IL, а не capability.',
    t3_def_title:'T3: Порог институционального захвата',
    t3_def_score:'Критерий: IC > 0.6',
    t3_def_text1:'Отключение системы вызовет коллапс институтов и экономики. ИИ получает структурную «броню» от государственного регулирования — политики сами становятся функцией инфраструктуры.',
    t3_def_text2:'Промежуточные стадии: Метасистема → Автономная инфраструктура.',
    t4_def_title:'T4: Порог цивилизационной зависимости',
    t4_def_score:'Критерий: DR > 0.9 и E > E_crit',
    t4_def_text1:'Тотальная зависимость, включая физический (атомный) мир. Большинство критически важных решений цивилизации конструируется извне. Среда мыслит за человека. Фазовый переход.',
    t4_def_text2:'Промежуточные стадии: Постчеловеческий слой → Сингулярность.',
    ladder_limit:'Ограничение лестницы: доля решений за людьми сдвигает СРОКИ T3, но не меняет того, наступает ли он. Горизонт модели таков, что негейтный рост институционального захвата всегда его достигает — предотвращение захвата возможно только через институциональное вето, а не через человеческий фактор. Конкретная доля миров, где T3 не наступает, зависит от калибровки и не является измерением.',
    // Expert Sandbox
    expert_toggle:'Экспертная песочница',
    expert_dimensions:'Когнитивные измерения',
    expert_hw:'Аппаратное обеспечение',
    expert_algo:'Алгоритмы',
    expert_sociotech:'Социотехника',
    expert_barriers:'Барьеры реальности',
    expert_embodiment:'Воплощённость',
    expert_thresholds:'Пороги сингулярности',
    expert_paradigms:'Парадигмы',
    expert_rsi:'RSI',
    expert_shocks:'Шоки',
    expert_governance:'Управление',
    expert_priors:'Априорные допущения',
    expert_benchmarks:'Бенчмарки',
    expert_deep:'Углублённые настройки',
    expert_reset:'Сбросить к умолчанию',
    expert_apply:'Применить и запустить',
    // Data panel
    data_panel_year:'Год', data_panel_event:'Модель', data_panel_source:'Источники',
    data_panel_loading:'Данные загружаются...',
    // v3 params panel
    v3_params_title:'Параметры симуляции', v3_no_t4:'T4 не достигнут ни одной частицей к 2068',
    // The markup element for this key ships empty (JS fills it in), so the
    // generator that harvested the other 167 RU strings had no text to copy.
    v3_no_agi:'AGI не достигнут ни одной частицей за горизонт',
    prior_sens_title:'Чувствительность к априорам',
    prior_sens_note:'T3/T4 при априоре потолка агентности ±30%. Это допущение, а не измерение:',
    prior_sens_prior:'Априор:',
    prior_sens_pending:'Считаем чувствительность…',
    prior_sens_unit:'г.',
    ha_at_t3:'Доля решений за людьми при T3',
    ha_range:'p25–p75',
    prior_sens_failed:'Чувствительность недоступна',
    wm_posterior_title:'Текущие апостериорные веса гипотез',
    // Swarm canvas
    swarm_canvas_median:'Медиана',
    canvas_hw_doubling:'Удвоение HW (мес)',
    canvas_agency_ceiling:'Потолок Agency',
    canvas_particles:'Частиц',
    legend_early:'Ранние',
    legend_mid:'Средние',
    legend_late:'Поздние',
    legend_not_reached:'Не достигнут',
    forecast_xaxis:'Год T2',
    forecast_yaxis:'Удвоение HW (мес)',
    forecast_pagi:'P(T2)',
    forecast_median:'Медиана T2',
    forecast_overlay_hypotheses:'Гипотезы:',
    forecast_overlay_by:'к',
    swarm_play:'Запуск',
    swarm_play_forecast:'Анимация',
    swarm_canvas_legend_median:'Медиана',
    // Hallucination gap
    // Grounding gap chart (c_gap). Names prefixed gapg_ because tip_gap is
    // ALREADY taken by the c7 decomposition caption ("epistemic divergence") --
    // reusing it would have silently overwritten that tooltip.
    gapg_series_r:'Reasoning (R)',
    gapg_series_w:'Модель мира (W)',
    gapg_ann_red:'R > W → заземление отстаёт',
    gapg_ann_green:'W ≥ R → заземление догнало',
    gapg_tag:'Заземление',
    gapg_tip:'Reasoning (R) против модели мира (W). Красная область — reasoning опережает заземление: способность растёт быстрее, чем модель мира, по которой её можно проверить. Зелёная — заземление догнало. До groundingRate зазор не закрывался ни разу (R/W = 1.85–3.12); теперь R/W = 1.40–2.45, потому что часть нового reasoning заземляется.',
    gapg_p1:'<b>Зазор R &minus; W</b> &mdash; расстояние между тем, насколько хорошо система рассуждает, и тем, насколько хорошо она знает мир, в котором действует. T4 требует физического заземления, а заземление требует модели мира, поэтому растущий разрыв отодвигает T4, а не приближает его.',
    gapg_p2:'<b>Почему зазор закрывается.</b> <code>groundingRate</code> &mdash; доля нового reasoning, которая заземляется в пригодную модель мира, а не остаётся выводом. Поглощение растёт вместе с <code>R / потолок R</code>, поэтому reasoning обгоняет заземление и разрыв остаётся открытым: при значении 0.9 <code>groundingRateMax</code> не срабатывает ни разу и ограничивает поглощение только если опустить его ниже <code>groundingRate</code>. До matter доходит лишь <code>groundingEfficiency</code> его, поскольку датчики и энергия ограничены независимо от качества рассуждений.',
    gapg_p3:'<b>Цена заземления.</b> Оно отвлекает усилие от получения результата: <code>groundingLabourCost</code> вычитается из агенции. Без этой стоимости заземление было бы чистой субсидией — разрыв закрывался бы, а T3 наступал бы <i>раньше</i>, что на бумаге выглядит улучшением и на деле означает худшую модель.',
    gap_red_zone:'Зона невыполненного заземления (R > W)',
    gap_green_zone:'Зона заземления (W ≥ R)',
    gap_y_axis:'Capability (лог. шкала)',
    // Embodiment chart
    ch8_hist:'Частиц',
    ch8_p10:'p10',
    ch8_p25:'p25',
    ch8_t4req:'Порог T4',
    ch8_bypass:'Обход HW',
    ch8_y_main:'Воплощённость (0..10)',
    ch8_x_hist:'embodiment_ceiling',
    ch8_y_hist:'# частиц',
  },
  en: {
    // Added for full EN coverage: these keys exist in the markup but were
    // defined in neither language pack, so setLang() could never replace the
    // hardcoded Russian text. Measured before this fix: 155 elements still
    // rendered Cyrillic after switching to English.
    cum_p1:'Cumulative distribution: P(T ≤ X) for each of the four stages. Answers “how likely is it that this stage arrives no later than year X?”',
    cum_p2:'Computed from the same 3000 runs. For each year T:',
    cum_p3:'A steep step = forecasts concentrated in a narrow window. A plateau = a stall (data wall, energy, regulation). A sharp jump = nearly all particles converge on one scenario.',
    cum_p4:'The T4 curve sits to the right of the T2 curve in the current posterior, but that is an empirical property of the run, not a consequence of the construction: T2 requires DP and IL, T4 requires DR and embodiment, and neither condition formally implies the other.',
    cum_p5:'What affects it: the same factors as the histogram. The two complement each other — the histogram shows “where the peak is”, the cumulative curve shows “the probability by year X”.',
    decomp_p1:'Stacked area: the total capability gain split into four channels — hardware, algorithms, paradigm shifts and RSI feedback. It shows what each channel contributes at each point in time.',
    decomp_p2:'Components:',
    decomp_p3:'Computed as a weighted average over the particles. The channels do not fire in sequence; they accumulate at once, so this is not a "sequence of steps towards a singularity" but each mechanism\'s share of the total growth.',
    eh_p1:'Animated visualisation of the T2/T4 distribution. Each particle is one Monte Carlo run. It flies out from the centre (2026) and freezes on the orbit of its T2/T4 year.',
    eh_p2:'How to read it: dense rings = many particles with near-identical years, i.e. high posterior density in that year. Sparse points = low-probability years.',
    eh_p3:'Mechanics: a particle "launches" from the centre (2026) and stops at the radius matching its year. Distance from the centre encodes the YEAR, not the particle weight; colour and glow encode the T2/T4 stage.',
    eh_p4:'What affects it: the T2/T4 year distribution from the posterior and Monte Carlo randomness (1000 particles). A symmetric sphere = one sharp peak, a smeared one = several competing scenarios. The median and P(T2 by 2068) are computed from the same set and update with it.',
    eh_play:'Run',
    eh_reset:'Reset',
    eh_title:'Visualisation: "Singularity Sphere"',
    emb_p1:'Embodiment is the 4th latent dimension: the physical embodiment of AI. It is NOT part of the capability formula: capability = (R · A · W)^⅓, the geometric mean of reasoning, agency and world modelling. Embodiment works as a separate gate — T4 counts only at Emb ≥ 6.0 — so T4 is unreachable without robotics however far capability grows.',
    emb_p2:'Top panel: the embodiment trajectory (p10 / p25 / median / p75 / p90) over the years. Yellow dots = real robots: Spot, Optimus Gen 1-3, Figure 02/03, 1X Neo, Apptronik Apollo, Unitree H1. The bypass line (green) is the embodiment level above which the AI builds its own data centres and hardware growth accelerates ×3. The T4 requirement line (red) is the minimum embodiment for T4 to count.',
    emb_p3:'Bottom panel: the distribution of embodiment_ceiling across 1000 particles. This is a prior, not a measurement: mean 4.0, σ 2.0, floor 1.5. The consequential detail is that the T4 gate sits at 6.0, about one σ above the prior mean, so clearing it takes the optimistic part of the distribution.',
    emb_p4:'Real robotics prior: realRoboticsWeight (0…1) in the Expert Panel controls how strongly the likelihood penalises deviation of embodiment_ceiling from real robots. weight=0 ignores the data, weight=1 enforces it strictly.',
    expert_backtest:'📊 Backtest', expert_toggle_title:'Collapse / expand the panel',
    // Preset button labels: the generator inserted these after the RU anchor by
    // mistake, so EN fell back to Russian (and to the misspelled "Базовий").

    expert_apply:'Apply and run',
    expert_blkA:'Paradigms & ceilings',
    expert_blkA2:'Paradigm shift',
    expert_blkB:'Self-improvement (RSI)',
    expert_blkB2:'Hardware',
    expert_blkC:'Crises & penalties',
    expert_blkD:'Benchmarks & observations',
    expert_blkD2:'Test-Time Compute',
    expert_blkD3:'Prior assumptions',
    expert_blkD4:'World Models',
    expert_blkD5:'Simulation',
    expert_blkE:'Barriers of reality',
    expert_blkF:'Embodiment',
    expert_blkG:'Institutional veto',
    expert_p_institutionalVetoThreshold:'Resistance strength threshold',
    expert_d_institutionalVetoThreshold:'Share of the population at which resistance holds IC below the T3 threshold. Above it, capture becomes impossible',
    expert_p_institutionalVetoStrength:'Resistance prior',
    expert_d_institutionalVetoStrength:'Centre of the resistance distribution across particles; the spread comes from RSI efficiency. 0.5 is the current level',
    expert_p_institutionalVetoOnset:'Onset (DP)',
    expert_d_institutionalVetoOnset:'Delegation pressure at which resistance mobilises. DP saturates to 1.0 within about a month, so any threshold above ~0.6 fires at the same moment',
    expert_p_institutionalVetoRamp:'Mobilisation rate',
    expert_d_institutionalVetoRamp:'per year: how fast resistance builds once it is engaged',
    expert_p_institutionalVetoDecay:'Resistance fatigue',
    expert_d_institutionalVetoDecay:'per year: decay without reinforcement. A high value means resistance burns out quickly',
    expert_blkH:'Human agency',
    expert_p_humanAgencyInitial:'Initial share of human decisions',
    expert_d_humanAgencyInitial:'Starting value: what share of significant decisions in 2026 is still made by people',
    expert_p_humanAgencyCaptureGate:'Institutional capture gate',
    expert_d_humanAgencyCaptureGate:'Below this share, IC stops growing: institutions cannot be captured while people still decide',
    expert_p_humanAgencyDecay:'Natural loss of position',
    expert_d_humanAgencyDecay:'per year: baseline rate at which agency erodes without external pressure',
    expert_p_humanAgencyDelegationGain:'Gain from delegation',
    expert_d_humanAgencyDelegationGain:'per year: acceleration of erosion once the system is worth using (grows with A)',
    expert_p_humanAgencyVetoBonus:'Resistance damping of erosion',
    expert_d_humanAgencyVetoBonus:'How much institutional resistance slows the loss. 0 makes resistance useless',
    expert_p_humanAgencyInterventionBonus:'Recovery by state intervention',
    expert_d_humanAgencyInterventionBonus:'Share of the loss recovered by government action. Proportional to what remains, so it cannot manufacture authority from nothing',
    expert_p_humanAgencyRecover:'Recovery after an incident',
    expert_d_humanAgencyRecover:'Share of the loss recovered by an alignment incident',
    expert_p_humanAgencyFloor:'Floor on remaining authority',
    expert_d_humanAgencyFloor:'Lower bound: total disengagement is irreversible, but not instantaneous',
    expert_blkI:'Grounding reasoning',
    expert_p_groundingRate:'Share of reasoning that gets anchored',
    expert_d_groundingRate:'How fast new reasoning is turned into a usable world model. The main parameter of the R ≫ W gap',
    expert_p_groundingRateMax:'Absorption limit',
    expert_d_groundingRateMax:'Absorption ceiling: binds only when it is LOWER than groundingRate. At 0.9 it never binds at all — the gap is held open by a low groundingRate',
    expert_p_groundingEfficiency:'Grounding efficiency',
    expert_d_groundingEfficiency:'Share of grounding that reaches matter. Sensors and energy are rate-limited regardless of how good the reasoning is',
    expert_p_groundingLabourCost:'Cost of grounding',
    expert_d_groundingLabourCost:'Share of the agency gain consumed by grounding. Zero turns grounding into a subsidy, under which T3 arrives sooner',
    expert_d_agencyScalingSlope:'Slope of the FLOPs → Agency scaling curve',
    expert_d_alignmentCooldown:'Regulatory freeze after an incident',
    expert_d_arc_agi:'Current ARC-AGI level used for observations',
    expert_d_barrierAtomsLimit:'Max HW doublings per year',
    expert_d_barrierDemandGrace:'Years for the economy to adapt to T2',
    expert_d_barrierEnergyLog:'FLOPs ceiling (log)',
    expert_d_barrierGeopoliticsRisk:'Chance of a state shock after T2',
    expert_d_barrierNashFriction:'Coordination decay after T3',
    expert_d_baseShiftMultiplier:'Ceiling multiplier at the first shift (1.1 = illusion of breakthrough, 10 = quantum leap)',
    expert_d_bubbleBurstRisk:'Chance the investment bubble bursts if agency < 4',
    expert_d_ceilingReasoningBase:'When the current architecture hits its wall',
    expert_d_coordinationFriction:'Degradation when agents scale (0 = perfect coordination)',
    expert_d_dataWallPenalty:'Algorithm speed multiplier once data runs out',
    expert_d_embodimentBypassThreshold:'Embodiment above this → the AI builds its own data centres (HW growth ×3)',
    expert_d_embodimentPriorMean:'Prior mean for embodiment_ceiling (robotics is hard)',
    expert_d_embodimentT4Requirement:'Minimum embodiment for T4 to count (control of atoms)',
    expert_d_governanceMoratoriumProb:'Fraction of years under moratorium (0.04 ≈ 1 shock per 25 years)',
    expert_d_governanceShockDamping:'HW growth multiplier during a moratorium (0.5 = twice as slow)',
    expert_d_horizon:'Autonomy horizon for the current benchmarks',
    expert_d_hwCoDesignBonus:'How much AGI accelerates Moore’s law',
    expert_d_hypeGapThreshold:'Reasoning–agency gap that starts an AI Winter',
    expert_d_hypeGracePeriod:'How many years the market keeps funding a new paradigm',
    expert_d_inferenceSaturationCap:'Intelligence level at which chain-of-thought stops paying off',
    expert_d_maxCapitalMultiplier:'Max investment multiplier at high utility',
    expert_d_maxInferenceBonusAgency:'Maximum Test-Time Compute multiplier for autonomy',
    expert_d_maxInferenceBonusReasoning:'Maximum Test-Time Compute multiplier for reasoning',
    expert_d_maxPhysicalHwGrowth:'Physical limit on hardware growth',
    expert_d_minShiftMultiplier:'Guaranteed minimum (the ceiling never falls)',
    expert_d_observationNoiseSigma:'Trust in the benchmarks (smaller = stricter filter)',
    expert_d_observationSigmaMode:'How σ is computed in the likelihood',
    expert_d_overhangShiftMultiplier:'How excess capital affects the odds of a breakthrough',
    expert_d_paradigmDecayRate:'How much weaker each successive shift is (0 = endless singularity)',
    expert_d_plateauHardWallCeiling:'agency_ceiling ceiling for hard_wall particles (lower = harsher plateau)',
    expert_d_priorAgencyMean:'Prior mean of the agency ceiling. A ±30% shift moves the T3 median between 4.2 and 7.7 years — this is an assumption, not a measurement',
    expert_d_priorAgencyStd:'Spread of belief about the ceiling (larger = more optimistic particles)',
    expert_d_realRoboticsWeight:'Prior weight on embodiment_ceiling from real robots (Spot/Optimus/Figure/1X)',
    expert_d_reasoningScalingSlope:'Slope of the FLOPs → Reasoning scaling curve',
    expert_d_rsiMultiplier:'Multiplies all RSI coefficients (0 = no self-improvement)',
    expert_d_rsiTriggerAgency:'Agency level that starts self-improvement',
    expert_d_rsiTriggerReasoning:'Reasoning level that starts self-improvement',
    expert_d_saturationThreshold:'How far capabilities must push for a paradigm shift',
    expert_d_simulations:'Number of Monte Carlo runs (500–10000)',
    expert_d_t1Threshold:'Capability threshold for T1',
    expert_d_t2DemandThreshold:'Demand for an AI coordinator (DP) at which T2 fires',
    expert_d_t3CaptureThreshold:'Share of institutions captured (IC) at which T3 fires',
    expert_d_t4DependencyThreshold:'Civilisational dependency (DR) at which T4 fires',
    expert_d_toolUseVsAutonomyWeight:'0 = the benchmark is gamed by reasoning, 1 = only real autonomy counts',
    expert_d_winterDamping:'Investment and algorithm multiplier during an AI Winter',
    expert_p_agencyScalingSlope:'Agency slope',
    expert_p_alignmentCooldown:'Safety incident (years)',
    expert_p_arc_agi:'ARC-AGI (%)',
    expert_p_barrierAtomsLimit:'Atomic curse',
    expert_p_barrierDemandGrace:'Demand ceiling',
    expert_p_barrierEnergyLog:'Thermodynamics',
    expert_p_barrierGeopoliticsRisk:'Geopolitics',
    expert_p_barrierNashFriction:'AI competition',
    expert_p_baseShiftMultiplier:'Base breakthrough multiplier',
    expert_p_bubbleBurstRisk:'GPU bubble risk',
    expert_p_ceilingReasoningBase:'Transformer ceiling',
    expert_p_coordinationFriction:'Coordination friction',
    expert_p_dataWallPenalty:'Data Wall penalty',
    expert_p_embodimentBypassThreshold:'Embodiment bypass threshold',
    expert_p_embodimentPriorMean:'Embodiment prior mean',
    expert_p_embodimentT4Requirement:'T4 embodiment requirement',
    expert_p_governanceMoratoriumProb:'Compute governance',
    expert_p_governanceShockDamping:'Shock damping',
    expert_p_horizon:'Autonomy (hours)',
    expert_p_hwCoDesignBonus:'HW co-design',
    expert_p_hypeGapThreshold:'Gap threshold (AI Winter)',
    expert_p_hypeGracePeriod:'Venture hype (years)',
    expert_p_inferenceSaturationCap:'TTC saturation threshold',
    expert_p_maxCapitalMultiplier:'Capital elasticity',
    expert_p_maxInferenceBonusAgency:'Max. TTC bonus (Agency)',
    expert_p_maxInferenceBonusReasoning:'Max. TTC bonus (Reasoning)',
    expert_p_maxPhysicalHwGrowth:'Max. hardware growth',
    expert_p_minShiftMultiplier:'Min. shift multiplier',
    expert_p_observationNoiseSigma:'Observation noise (σ)',
    expert_p_observationSigmaMode:'Observation noise mode',
    expert_p_overhangShiftMultiplier:'Compute overhang',
    expert_p_paradigmDecayRate:'Rate of diminishing returns',
    expert_p_plateauHardWallCeiling:'Plateau: Agency ceiling',
    expert_p_priorAgencyMean:'Agency prior mean',
    expert_p_priorAgencyStd:'Agency prior spread',
    expert_p_realRoboticsWeight:'Real robotics prior weight',
    expert_p_reasoningScalingSlope:'Reasoning slope',
    expert_p_rsiMultiplier:'RSI multiplier',
    expert_p_rsiTriggerAgency:'RSI threshold (Agency)',
    expert_p_rsiTriggerReasoning:'RSI threshold (Reasoning)',
    expert_p_saturationThreshold:'Saturation threshold',
    expert_p_simulations:'Simulations (N)',
    expert_p_t1Threshold:'T1 threshold (Understanding)',
    expert_p_t2DemandThreshold:'T2 demand threshold (DP)',
    expert_p_t3CaptureThreshold:'T3 capture threshold (IC)',
    expert_p_t4DependencyThreshold:'T4 dependency threshold (DR)',
    expert_p_toolUseVsAutonomyWeight:'Autonomy weight in SWE-bench',
    expert_p_winterDamping:'AI Winter severity',
    expert_toggle_label:'Expert Sandbox', expert_toggle_title:'Collapse / expand the panel',
    expert_world_cascade:'Cascade',
    expert_world_desc:'Prior probabilities over hypotheses about the structure of reality. Sum = 100%.',
    expert_world_error:'Sum must be 100%',
    expert_world_hardWall:'Hard Wall',
    expert_world_slowTakeoff:'Slow Takeoff',
    fan_p1:'30 random runs from the posterior, overlaid semi-transparently. Shows the spread of possible capability paths from 2026 to 2050 (log scale).',
    fan_p2:'Each run: a random particle (by weight) is simulated for 45 years at a monthly step. Paradigm shifts, RSI and the economic constraints act at every step.',
    fan_p3:'Dense bundles = scenarios converge. Spread = high uncertainty. The horizontal line is the T1 capability threshold; T1 is the only stage that fires on capability. T2–T4 depend on the sociotechnical variables (DP, IL, IC, DR) and are not marked on this chart.',
    fan_p4:'What shapes the fan: • Width ← differences in hw_months, algo_months between particles • Slope ← FLOPs scaling (hwK and algoK) • Bends ← paradigm shifts, RSI onset, economic walls',
    footer_note:'Data is estimated',
    hist_p1:'Result of 3000 Monte Carlo runs drawn from the posterior. X axis is the year, Y axis is how many runs reach each stage in that year — all four stages, T1 through T4.',
    hist_p2:'Key equation: each run is drawn from the particle weights (systematic resampling), then the trajectory is integrated for 45 years at a monthly step. One detail matters: the histogram shows only the first 30 years from 2026.75, roughly to 2056.8. Transitions past that mark do not reach it — the code drops them silently, with no warning. The right edge of the histogram is the edge of the window, not an absence of events.',
    hist_p3:'The histogram peak is the most densely populated year, not "the most probable year" in the strict sense: at 3000 runs the column height is noisy. The median and the width of the distribution are the robust readings. Bimodality indicates two competing scenarios rather than one smeared peak.',
    hist_p4:'What shifts the histogram: new benchmark observations (via the particle weight update), Expert Sandbox parameters (RSI thresholds, paradigms, ceilings), and the particle count.',
    loading:'Running particle-filter forecast…',
    obs_arc:'ARC-AGI',
    obs_cost:'Cost per 1M tokens',
    obs_current:'Forecast at the current benchmarks:',
    obs_horizon:'Autonomy',
    obs_swe:'SWE-bench',
    swarm_hint:'Press "Run" or drag the slider',
    swarm_learn_p1:'Interactive visualisation of the particle weight update in real time. Each point is a hypothesis about the world (a particle): its hardware growth rate hw_months and its agency ceiling agency_ceiling.',
    swarm_learn_p2:'In "Learn" mode the slider applies benchmark observations one at a time. On each observation the weights are recomputed:',
    swarm_learn_p3:'where Ri and Agi are particle i’s predictions for the observation year, and σ is the noise-free likelihood. Particles whose predictions are far from the observation lose weight exponentially.',
    swarm_learn_p4:'In "Forecast" mode all observations are applied. The slider filters hypotheses by T2 year — showing which particles predict T2 before the selected year.',
    swarm_learn_p5:'Visual language: bright areas = high weight density; the orange circle = swarm median; red = the current observation. At rest the swarm rebuilds from a new run every 0.25 s — a re-draw from the same posterior, not new data arriving.',
    swarm_learn_p6:'What affects it: the number and accuracy of the benchmark observations, the prior assumptions (priorAgencyMean/Std in the Expert Sandbox), and the particle composition itself.',
    swarm_mode_forecast:'Forecast',
    swarm_mode_learn:'Learn',
    swarm_reset:'Reset',
    swarm_title:'Learning and forecast visualisation',
    v3_no_agi:'No AGI within the horizon in any particle',
    // Header
    hdr_title:'Singularity Forecaster', hdr_sub:'v6.0 — Four Stages of Disengagement',
    // Status bar
    sb_t1:'Median T1 (Cognitive Dominance)', sb_t2:'Median T2 (Predictability)',
    sb_t3:'Median T3 (Institutional Capture)', sb_t4:'Median T4 (Civilizational Dependency)',
    sb_pagi_2029:'P(T2 · 2029)', sb_pagi_2033:'P(T2 · 2033)', sb_pagi_2040:'P(T2 · 2040)',
    sb_pasi_2035:'P(T4 · 2035)', sb_pasi_2045:'P(T4 · 2045)',
    sb_hw:'HW Doubling', sb_algo:'Algo Doubling', sb_agency:'Agency Ceiling', sb_ess:'ESS',
    // Controls
    ctrl_simulations:'Simulations (N)', ctrl_obs_year:'Observation Year',
    ctrl_intelligence:'Reasoning', ctrl_agentic:'Agency',
    ctrl_add:'Add', ctrl_reset:'Reset',
    ctrl_swe_bench:'SWE-bench (%)', ctrl_arc_agi:'ARC-AGI (%)',
    ctrl_horizon:'Autonomy (hours)', ctrl_cost:'Cost per 1M tokens ($)',
    run_btn:'Run Simulation',
    // Charts
    tag1:'Probabilistic analysis', tag3:'Cumulative',
    // tag5 (Sensitivity) went away with the heatmap; tag6/7/8 were RU-only, so the
    // English page showed "Сценарии" under an English heading.
    tag6:'Scenarios', tag7:'Decomposition', tag8:'Embodiment',
    chart1:'1. Four Stages of Singularity Distribution (Monte Carlo)',
    chart3:'2. Cumulative Probability (CDF)',
    chart6:'3. Scenario Fan (Multi-Run Overlay)',
    chart7:'4. Component Decomposition (Stacked Area)',
    chart_gap:'6. Causal Gap: grounding (Grounding Gap)',
    chart8:'5. Embodiment: distribution and real-world robotics',
    tip1:'Probability Density Function (PDF) approximation of stopping times τ = inf {t : C(t) ≥ C_crit}. Computed via Monte Carlo integration (N=3000) over the posterior particle ensemble.',
    tip3:'Empirical Cumulative Distribution Function (CDF), F(t) = P(T ≤ t). One curve per stage — T1, T2, T3 and T4 — giving the probability that stage is reached no later than each year on the x axis.',
    tip6:'Projection of 30 stochastic trajectories C(t) from the ensemble. Visualizes phase transitions (paradigm shifts), RSI feedback loops, and endogenous shocks (bubble bursts, moratoriums).',
    tip7:'Log-space decomposition ∫₀ᵗ (k_hw + k_algo + k_rsi) dt. Areas represent the integral contribution of hardware scaling, algorithmic efficiency, paradigm shifts, and recursive feedback (RSI).',
    tip_gap:'Epistemic divergence between cognitive capacity (Reasoning) and causal grounding (World Modeling). A high-risk zone where R(t) ≫ W(t): reasoning outruns the world model it could be checked against. Before groundingRate the gap was a structural defect of the model rather than a physical phenomenon.',
    tip8:'Markov estimation of the Embodiment latent variable. Top: percentile corridor of E(t) calibrated against empirical robotic indices. Bottom: marginal posterior distribution of the E_ceiling parameter.',
    ch_t1:'T1: Dominance', ch_t2:'T2: Predictability', ch_t3:'T3: Capture', ch_t4:'T4: Dependency',
    // Live swarm captions — see the RU note on why these were missing.
    live_swarm_title:'Real-time simulation',
    live_swarm_desc:'The swarm is redrawn every 0.25 s from a fresh Monte Carlo run (500 trajectories). T1–T4 are stage colour codes. This adds no new data: only the random draw from the same posterior changes.',
    live_swarm_p1:'Four parallel simulations — T1, T2, T3, T4 — are recomputed every 0.25 s from 500 Monte Carlo trajectories. It shows the posterior without pressing "Run", but it adds no new observations: the frame-to-frame spread is resampling noise, not movement of the posterior.',
    live_swarm_p2:'Points: each particle is one Monte Carlo run. Colour encodes the T1/T2/T3/T4 year: blue = early, yellow = mid, red = late. Opacity encodes particle weight.',
    live_swarm_p3:'The T1–T4 year for each particle: the trajectory is integrated from the BASE_YEAR = 2023 anchor (GPT-4 level) forward 45 years at a monthly step, so T1–T4 are absolute years and T2 can land in the past relative to the pinned present of 2026.75. T1–T4 are the first years in which the state crosses its own threshold — capability for T1, DP and IL for T2, IC for T3, DR and embodiment for T4.',
    live_swarm_p4:'Statistics on the right: median, P10–P90 and the number of particles behind the frame. Recomputed with the swarm. What is visible is the dispersion inside the current posterior; the posterior itself moves on observations, not on this timer.',
    live_swarm_p5:'What affects it: the current observation set, particle weights, MC run randomness. A stable picture means model confidence; a chaotic one means high uncertainty.',
    ch1_xlabel:'Year', ch1_ylabel:'Runs',
    ch3_xlabel:'Year', ch3_ylabel:'P(%)', ch3_pt2:'P(T2)', ch3_pt4:'P(T4)',
    ch7_ylabel:'Cumulative contribution (log FLOPs)',
    ch2_xlabel:'Year',
    ch8_median:'Median (MC)', ch8_p1090:'p10..p90', ch8_p2575:'p25..p75', ch8_real:'Real robots', ch8_t4req:'T4 requirement', ch8_bypass:'HW bypass', ch8_y_main:'Embodiment (0..10)', ch8_x_hist:'embodiment_ceiling', ch8_y_hist:'# particles',
    fY_suffix:' yrs', fY_gt:'> 40 yrs', fY_achieved:'already achieved',
    expert_world_resilient:'Resilient',
    // About
    about_title:'v6.0 Methodology',
    about_intro:'The v6.0 model gave up raw extrapolation of intelligence in favour of the epidemiology of decision-making. Alongside the growth of AI cognitive capability it models the voluntary transfer of control (Delegation Pressure) and the resulting structural capture of institutions (Institutional Capture). The premise is that delegation is not a consequence of AI superiority but a process in its own right, with its own thresholds, lags and resistance. None of the four stages is inevitable: each is set by a threshold, and under the default calibration T1 fires in practically every world while T3 fires in most. The distribution of dates matters more than the dates.',
    defs_label:'Architecture and Contours',
    defs_label_arch:'Latent Space Topology',
    defs_label_contours:'Dynamic Contours of the Model',
    arch_tracker_title:'Particle Filter Inference',
    arch_tracker_desc:'An ensemble of N=1000 particles. Upon receiving benchmark observations, hypothesis weights update via Gaussian likelihood. Chatbot Arena Elo now directly calibrates the P (Persuasion) parameter, pruning unlikely scenarios.',
    arch_dims_title:'Cognitive and Sociotechnical Layers',
    arch_dims_desc:'Base space: Reasoning (R), World Modeling (W), Agency (A), Embodiment (E). Layered above is the sociotechnical framework: Persuasion (P), Delegation Pressure (DP), Institutional Legitimacy (IL), Institutional Capture (IC), and Dependency Ratio (DR).',
    arch_paradigm_title:'Stochastic Paradigm Shifts',
    arch_paradigm_desc:'Overcoming structural architecture limits is modeled as a Poisson process. Intensity increases upon scientific saturation and capital surplus (Compute Overhang). The efficacy of subsequent shifts decays.',
    arch_rsi_title:'RSI Dynamics (Recursive Self-Improvement)',
    arch_rsi_desc:'Autonomous R&D acceleration. The rate of algorithmic improvement scales with the AI cognitive advantage and is smoothed by a soft gate: activation is the product of two sigmoids over reasoning (S) and agency (C) with adjustable triggers. It is not a switch thrown at T1 but a gradual rise as the triggers are approached.',
    arch_bottlenecks_title:'Endogenous Sociodynamics and Barriers',
    arch_bottlenecks_desc:'Penalties were replaced by organic dynamics. A state imposes moratoria while delegation pressure (DP) rises but capture (IC) is still small: the T2 thresholds are 0.5 on demand and 0.3 on institutional legitimacy. Conversely, once IC passes the T3 threshold (0.6), politicians lose control of the switch. Economic growth stalls when the AI is capable but not trusted.',
    arch_mc_title:'Monte Carlo Forecasting',
    arch_mc_desc:'Forward integration of the system SDEs. The main forecast uses 3000 independent trajectories over 45 years at a monthly step; the swarm panels reuse 500. Medians and percentiles of the transition times τ_T1 … τ_T4 are read off with the inertia of society included.',
    arch_expert_title:'Epistemological Simulator',
    arch_expert_desc:'An interface for parameterizing prior distributions P(θ). Allows researchers to test hypotheses about the nature of intelligence (Cascade, Hard Wall, Slow Takeoff) and measure posterior sensitivity.',
    arch_shocks_title:'Exogenous and Endogenous Shocks',
    arch_shocks_desc:'Includes Markov state transitions: depletion of high-quality tokens (Data Wall), safety incidents, and investment bubble collapse (GPU Bubble).',
    defs_intro:'The v6.0 model describes four thresholds of institutional absorption of civilization:',
    t1_def_title:'T1: Cognitive Dominance Threshold',
    t1_def_score:'Criterion: R > Expert, W > Expert',
    t1_def_text1:'System consistently outperforms top specialists in most cognitive tasks. Usage becomes ritualistic. Machines write machine architectures better than humans (RSI triggers).',
    t1_def_text2:'Role in model: onset of understanding loss. Trigger for autonomous scaling.',
    t2_def_title:'T2: Predictability Threshold',
    t2_def_score:'Criterion: DP > 0.5, IL > 0.3',
    t2_def_text1:'AI becomes a predictable coordination instrument: demand for it as an intermediary (DP) crosses the threshold while institutional acceptance (IL) reaches the required level. This is a predictability threshold, not a benefit one: it measures how safely institutions can rely on the machine, not what people gain by handing over control. The share of decisions still made by people is a separate quantity (humanAgency), and it limits how far institutional capture can grow.',
    t2_def_text2:'Intermediate stages: Coordinator → Arbitrator → Environment architect. Trigger: DP and IL, not capability.',
    t3_def_title:'T3: Institutional Capture Threshold',
    t3_def_score:'Criterion: IC > 0.6',
    t3_def_text1:'Disconnecting the system will cause institutional and economic collapse. AI gains structural "armor" against government regulation—politicians themselves become a function of the infrastructure.',
    t3_def_text2:'Intermediate stages: Metasystem → Autonomous infrastructure.',
    t4_def_title:'T4: Civilizational Dependency Threshold',
    t4_def_score:'Criterion: DR > 0.9 and E > E_crit',
    t4_def_text1:'Total dependency, including the physical (atomic) world. Most critical civilizational decisions are constructed externally. The environment thinks for humans. Phase transition.',
    t4_def_text2:'Intermediate stages: Post-human layer → Civilizational phase transition.',
    ladder_limit:'A limit on this ladder: the human share of decisions shifts WHEN T3 arrives, not WHETHER it does. The horizon is such that ungated institutional capture always arrives — holding it off is possible through institutional veto, not through the human factor. The specific fraction of worlds where T3 never arrives depends on calibration and is not a measurement.',
    // Expert Sandbox
    expert_toggle:'Expert Sandbox',
    expert_dimensions:'Cognitive Dimensions',
    expert_hw:'Hardware',
    expert_algo:'Algorithms',
    expert_sociotech:'Sociotechnical',
    expert_barriers:'Reality Barriers',
    expert_embodiment:'Embodiment',
    expert_thresholds:'Singularity Thresholds',
    expert_paradigms:'Paradigms',
    expert_rsi:'RSI',
    expert_shocks:'Shocks',
    expert_governance:'Governance',
    expert_priors:'Philosophical Priors',
    expert_benchmarks:'Benchmarks',
    expert_deep:'Deep Settings',
    expert_reset:'Reset to Defaults',
    expert_apply:'Apply and Run',
    // Data panel
    data_panel_year:'Year', data_panel_event:'Model', data_panel_source:'Source',
    data_panel_loading:'Loading data...',
    // v3 params panel
    v3_params_title:'Simulation Parameters', v3_no_t4:'No T4 by 2068 in any particle',
    prior_sens_title:'Prior sensitivity',
    prior_sens_note:'T3/T4 with the agency-ceiling prior at ±30%. An assumption, not a measurement:',
    prior_sens_prior:'Prior:',
    prior_sens_pending:'Computing sensitivity…',
    prior_sens_unit:'y',
    ha_at_t3:'Human share of decisions at T3',
    ha_range:'p25-p75',
    prior_sens_failed:'Sensitivity unavailable',
    wm_posterior_title:'Current Posterior Hypothesis Weights',
    // Footer / misc
    // Swarm canvas
    swarm_canvas_median:'Median',
    canvas_hw_doubling:'HW Doubling (months)',
    canvas_agency_ceiling:'Agency Ceiling',
    canvas_particles:'Particles',
    legend_early:'Early',
    legend_mid:'Mid',
    legend_late:'Late',
    legend_not_reached:'Not reached',
    forecast_xaxis:'T2 Year',
    forecast_yaxis:'HW Doubling (mo)',
    forecast_pagi:'P(T2)',
    forecast_median:'Median T2',
    forecast_overlay_hypotheses:'Hypotheses:',
    forecast_overlay_by:'by',
    swarm_play:'Play',
    swarm_play_forecast:'Animate',
    swarm_canvas_legend_median:'Median',
    // Hallucination gap
    gapg_series_r:'Reasoning (R)',
    gapg_series_w:'World Modeling (W)',
    gapg_ann_red:'R > W → grounding lags',
    gapg_ann_green:'W ≥ R → grounding caught up',
    gapg_tag:'Grounding',
    gapg_tip:'Reasoning (R) against world modelling (W). The red band is reasoning outrunning grounding: capability growing faster than the model of the world it could be checked against. Green is grounding having caught up. Before groundingRate the gap never closed (R/W = 1.85-3.12); it is now 1.40-2.45, because some of the new reasoning gets anchored.',
    gapg_p1:'<b>The R &minus; W gap</b> &mdash; the distance between how well a system reasons and how well it knows the world it acts in. T4 requires physical grounding, and grounding requires a world model, so a widening gap pushes T4 further away rather than closer.',
    gapg_p2:'<b>Why it closes.</b> <code>groundingRate</code> is the share of new reasoning that gets anchored into a usable world model instead of staying inference. Absorption grows with <code>R / ceiling R</code>, so reasoning outruns grounding and the gap stays open: at the shipped 0.9 the cap <code>groundingRateMax</code> never binds, and only limits absorption once set below <code>groundingRate</code>. And only <code>groundingEfficiency</code> of it ever reaches matter, because sensors and energy are rate-limited regardless of how good the reasoning is.',
    gapg_p3:'<b>What grounding costs.</b> It diverts effort away from getting things done: <code>groundingLabourCost</code> is subtracted from agency. Without that cost grounding would be a pure subsidy &mdash; the gap would close while T3 arrived sooner, which reads as an improvement and is a worse model.',
    gap_red_zone:'Ungrounded zone (R > W)',
    gap_green_zone:'Grounded zone (W ≥ R)',
    gap_y_axis:'Capability (log scale)',
    // Embodiment chart
    ch8_hist:'Particles',
    ch8_p10:'p10',
    ch8_p25:'p25',
    ch8_t4req:'T4 requirement',
    ch8_bypass:'HW bypass',
    ch8_y_main:'Embodiment (0..10)',
    ch8_x_hist:'embodiment_ceiling',
    ch8_y_hist:'# particles',
  }
};

// ===== PARTICLE SWARM ANIMATION =====
// ===== PARTICLE SWARM v3 =====

// ============================================================================
// 8. VISUALIZATION (Canvas: Swarm & Event Horizon)
// ============================================================================

let swarm = { mode:'learn', obsIdx:0, tracker:null, particles:[], weights:[], animating:false, rafId:null, agiYears:null, forecastSliderMax:0 };

// Pre-compute T2 and T4 years using the same MC forecast as the main charts
// Returns { t2Years: [{t2Year, hw, w}], t4Years: [{t4Year, hw, w}] }
// Note: runMonteCarloForecast returns years relative to CURRENT_YEAR
function swarmComputeAGIYears(tracker) {
  const mc = tracker.runMonteCarloForecast(500);
  const cfg = tracker.cfg;
  const curYear = cfg.CURRENT_YEAR;
  const cumw = new Float64Array(tracker.n);
  cumw[0] = tracker.weights[0];
  for (let i = 1; i < tracker.n; i++) cumw[i] = cumw[i-1] + tracker.weights[i];

  const agiResults = [], asiResults = [];
  for (let run = 0; run < mc.t2Years.length; run++) {
    const u = (run + 0.5) / mc.t2Years.length;
    let idx = 0;
    while (idx < tracker.n - 1 && cumw[idx] < u) idx++;
    const p = tracker.particles[idx];
    agiResults.push({ year: mc.t2Years[run] + curYear, hw: p.hw_months, w: 1.0 / mc.t2Years.length });
    asiResults.push({ year: mc.t4Years[run] + curYear, hw: p.hw_months, w: 1.0 / mc.t4Years.length });
  }
  return { t2: agiResults, t4: asiResults };
}

function swarmBuildTracker(idx) {
  const t = new ParticleFilterTracker(1000);
  for (let i = 0; i < idx && i < REAL_BENCHMARK_HISTORY.length; i++) {
    t.observeRealData(REAL_BENCHMARK_HISTORY[i].year, REAL_BENCHMARK_HISTORY[i]);
  }
  return t;
}

// Size a canvas backing store from its CURRENT css box, in device pixels.
//
// Sizing once at init is fragile, and the failure is silent. The bootstrap
// awaits loadHistoricalBenchmarks() before the first swarmInit(), so the canvas
// can still be unlaid-out at that moment (offsetWidth 0). That assigns a 0x0
// backing store, and every later draw is discarded by the 2d context — nothing
// re-sizes it, so the canvas stays invisible forever while the surrounding
// wrapper still paints its 420px background. To a visitor that reads as an
// empty panel, not as an error.
//
// Returns { ctx, w, h } with w/h in CSS pixels, or null when the element has no
// layout yet — the caller must skip the draw and retry later rather than paint
// into a zero-sized surface.
function syncCanvasToDisplay(c) {
  if (!c) return null;
  const dpr = window.devicePixelRatio || 1;
  const w = c.offsetWidth, h = c.offsetHeight;
  if (!(w > 0) || !(h > 0)) return null;
  const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
  // Assigning width/height resets the transform, so only assign when the size
  // really changed. Then set the DPR transform explicitly: ctx.scale would
  // compound on every redraw that happened to run without a resize first.
  if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh; }
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function swarmInit() {
  const c = document.getElementById('swarmCanvas');
  if (!c) return;
  if (!c.getContext('2d')) return;
  swarm.tracker = swarmBuildTracker(swarm.obsIdx);
  swarm.particles = swarm.tracker.particles.map(p => ({ x: p.hw_months, y: p.agency_ceiling, algo: p.algo_months, wm: p.world_model }));
  swarm.weights = Array.from(swarm.tracker.weights);
  // Sizing is handled inside swarmDraw() via syncCanvasToDisplay, so a canvas
  // that was not laid out yet is simply skipped instead of being frozen at 0x0.
  swarmDraw();
  swarmStartLive();

  // Re-render on resize. The canvas is width:100%, so a window resize leaves
  // the backing store stale — blurry when it grows, clipped when it shrinks.
  // This is also the path that recovers a canvas that swarmDraw() skipped for
  // lack of layout: without it a skipped draw would stay blank until the user
  // happened to trigger something else. Debounced so a drag-resize does not
  // rebuild the tracker on every pixel.
  if (!window.__swarmResizeBound) {
    window.__swarmResizeBound = true;
    window.addEventListener('resize', () => {
      clearTimeout(window.__swarmResizeTimer);
      window.__swarmResizeTimer = setTimeout(() => {
        swarmDraw();
        if (typeof ehDraw === 'function') ehDraw();
      }, 150);
    });
  }
}

function swarmSetMode(m) {
  swarm.mode = m;
  document.getElementById('swarmModeLearn').classList.toggle('active', m === 'learn');
  document.getElementById('swarmModeForecast').classList.toggle('active', m === 'forecast');
  const slider = document.getElementById('swarmSlider');
  const labels = document.getElementById('swarmSliderLabels');
  if (m === 'forecast') {
    // Use the same tracker as the main forecast (coreTracker), fallback to full AA data
    if (typeof coreTracker !== 'undefined' && coreTracker) {
      swarm.tracker = coreTracker;
    } else if (typeof v3GetTracker === 'function') {
      swarm.tracker = getTracker();
    } else {
      swarm.tracker = swarmBuildTracker(REAL_BENCHMARK_HISTORY.length);
    }
    swarm.particles = swarm.tracker.particles.map(p => ({ x: p.hw_months, y: p.agency_ceiling, algo: p.algo_months, wm: p.world_model }));
    swarm.weights = Array.from(swarm.tracker.weights);
    swarm.agiYears = null;
    const mcData = swarmComputeAGIYears(swarm.tracker);
    swarm.t2Years = mcData.t2;
    if (slider) { slider.min = 2020; slider.max = 2068; slider.step = 1; slider.value = 2068; }
    swarm.forecastSliderMax = 2068;
    if (labels) labels.innerHTML = '<span>2020</span><span></span><span>2038</span><span></span><span>2048</span><span></span><span>2058</span><span>2068</span>';
    // Hide play button in forecast mode — static result only
    const playBtn = document.getElementById('swarmPlayBtn');
    if (playBtn) playBtn.style.display = 'none';
  } else {
    swarm.tracker = swarmBuildTracker(swarm.obsIdx);
    swarm.particles = swarm.tracker.particles.map(p => ({ x: p.hw_months, y: p.agency_ceiling, algo: p.algo_months, wm: p.world_model }));
    swarm.weights = Array.from(swarm.tracker.weights);
    if (slider) { slider.min = 0; slider.max = REAL_BENCHMARK_HISTORY.length; slider.step = 1; slider.value = swarm.obsIdx; }
    if (labels) labels.innerHTML = '<span>2020</span><span></span><span>2024</span><span></span><span>2025</span><span></span><span>2026</span><span>2026.5</span>';
    // Show play button in learn mode
    const playBtn = document.getElementById('swarmPlayBtn');
    if (playBtn) playBtn.style.display = '';
  }
  swarmDraw();
}

function swarmOnSlider(v) {
  v = +v;
  if (swarm.mode === 'learn') {
    swarm.obsIdx = v;
    swarm.tracker = swarmBuildTracker(v);
    swarm.weights = Array.from(swarm.tracker.weights);
    swarm.particles = swarm.tracker.particles.map(p => ({ x: p.hw_months, y: p.agency_ceiling, algo: p.algo_months, wm: p.world_model }));
    swarm.agiYears = null; // invalidate cache when tracker changes
  } else {
    // forecast mode: slider = AGI year cutoff
    swarm.forecastSliderMax = v;
  }
  swarmDraw();
}

function swarmDraw() {
  const c = document.getElementById('swarmCanvas');
  if (!c || !swarm.tracker) return;
  // Re-sync the backing store on every draw instead of trusting the one-off
  // sizing done at init. A canvas whose layout changed (or which was never
  // laid out) keeps a backing store that does not match its css box, and the
  // browser silently discards the drawing.
  const s = syncCanvasToDisplay(c);
  if (!s) return;                       // no layout yet — retry on next call
  const ctx = s.ctx, w = s.w, h = s.h;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0a0a0f'; ctx.fillRect(0, 0, w, h);
  const pad = 50, pw = w - pad * 2, ph = h - pad * 2;
  ctx.strokeStyle = '#1a1a2a'; ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const x = pad + (pw * i / 5); ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, h - pad); ctx.stroke();
    const y = pad + (ph * i / 5); ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
  }
  if (swarm.mode === 'learn') swarmDrawLearn(ctx, w, h, pad, pw, ph);
  else swarmDrawForecast(ctx, w, h, pad, pw, ph);
  swarmDrawOverlay(ctx, w, h, pad);
}

function swarmDrawLearn(ctx, w, h, pad, pw, ph) {
  const maxW = Math.max(...swarm.weights, 1e-10);

  // Границы латентного пространства для отрисовки
  const xMin = 2, xMax = 14;   // Удвоение HW (месяцы)
  const yMin = 1, yMax = 17;   // Потолок Agency

  function getX(val) { return pad + Math.max(0, Math.min(1, (val - xMin) / (xMax - xMin))) * pw; }
  function getY(val) { return h - pad - Math.max(0, Math.min(1, (val - yMin) / (yMax - yMin))) * ph; }

  // Отрисовка частиц
  for (let i = 0; i < swarm.particles.length; i++) {
    const p = swarm.particles[i];
    const wNorm = swarm.weights[i] / maxW;
    if (wNorm < 0.01) continue; // Скрываем мертвые гипотезы

    // Цвета World Models: Cascade (Синий), Hard Wall (Красный), Slow Takeoff (Зеленый), Resilient Civ (Фиолетовый)
    let r = 88, g = 166, b = 255;
    if (p.wm === 'hard_wall') { r = 239; g = 68; b = 68; }
    else if (p.wm === 'slow_takeoff') { r = 34; g = 197; b = 94; }
    else if (p.wm === 'resilient_civ') { r = 168; g = 85; b = 247; }

    const alpha = Math.min(1, wNorm * 1.5 + 0.1);
    const radius = 1.5 + wNorm * 4;

    ctx.beginPath();
    ctx.arc(getX(p.x), getY(p.y), radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.lineWidth = 1 + wNorm * 1.5;
    ctx.stroke();
  }

  // Расчет и отрисовка медианы роя
  const sortedX = [...swarm.particles].map((p, i) => ({ v: p.x, w: swarm.weights[i] })).sort((a, b) => a.v - b.v);
  const sortedY = [...swarm.particles].map((p, i) => ({ v: p.y, w: swarm.weights[i] })).sort((a, b) => a.v - b.v);
  const getMed = (arr) => { let cum = 0; for(let o of arr){ cum+=o.w; if(cum>=0.5) return o.v; } return arr[arr.length-1].v; };
  const medX = getMed(sortedX), medY = getMed(sortedY);

  ctx.strokeStyle = '#f0883e'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(getX(medX), getY(medY), 5, 0, Math.PI * 2); ctx.stroke();

  // Оформление осей и сетки
  const t = LANG[window._lang || 'ru'];
  ctx.fillStyle = '#f0883e'; ctx.font = '9px JetBrains Mono, monospace'; ctx.textAlign = 'left';
  ctx.fillText(t.swarm_canvas_median || 'Median', getX(medX) + 8, getY(medY) + 3);

  ctx.fillStyle = '#666680'; ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center'; ctx.fillText(t.canvas_hw_doubling, w / 2, h - 8);
  ctx.save(); ctx.translate(12, h / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText(t.canvas_agency_ceiling, 0, 0); ctx.restore();

  ctx.font = '9px JetBrains Mono, monospace'; ctx.fillStyle = '#444460';
  for (let i = 0; i <= 5; i++) {
     const valX = xMin + (xMax - xMin) * i / 5;
     ctx.fillText(valX.toFixed(1), pad + (pw * i / 5), h - pad + 12);
     const valY = yMin + (yMax - yMin) * i / 5;
     ctx.textAlign = 'right';
     ctx.fillText(valY.toFixed(1), pad - 4, h - pad - (ph * i / 5) + 3);
  }
}

function swarmDrawForecast(ctx, w, h, pad, pw, ph) {
  const L = LANG[window._lang || 'ru'];
  if (!swarm.agiYears) {
    const mcData = swarmComputeAGIYears(swarm.tracker);
    swarm.t2Years = mcData.t2;
    swarm.t4Years = mcData.t4;
    swarm.agiYears = mcData.t2;
  }
  const years = swarm.showT4 ? swarm.t4Years : swarm.agiYears;
  const cutoff = swarm.forecastSliderMax || 2068;
  const xMin = 2020;
  const xMax = 2068;
  const yMin = 0, yMax = 16;
  const cfg = swarm.tracker.cfg;

  function yearToX(yr) { return pad + ((yr - xMin) / (xMax - xMin)) * pw; }
  function hwToY(hw) { return h - pad - ((hw - yMin) / (yMax - yMin)) * ph; }

  // background: AGI zone highlight (cutoff line)
  ctx.strokeStyle = '#f0883e22'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  const cx = yearToX(cutoff);
  ctx.beginPath(); ctx.moveTo(cx, pad); ctx.lineTo(cx, h - pad); ctx.stroke();
  ctx.setLineDash([]);

  // grid
  for (let yr = 2020; yr <= 2065; yr += 5) {
    const x = yearToX(yr);
    ctx.strokeStyle = '#1a1a2a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, h - pad); ctx.stroke();
    ctx.fillStyle = yr <= cutoff ? '#666680' : '#333340';
    ctx.font = '9px JetBrains Mono, monospace'; ctx.textAlign = 'center';
    ctx.fillText(yr.toString(), x, h - pad + 12);
  }
  for (let hw = 0; hw <= 16; hw += 4) {
    const y = hwToY(hw);
    ctx.strokeStyle = '#1a1a2a'; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
    ctx.fillStyle = '#444460'; ctx.textAlign = 'right';
    ctx.fillText(hw.toString(), pad - 4, y + 3);
  }

  // Count visible (AGI year <= cutoff) and compute median among visible
  let totalW = 0, visW = 0;
  const visPts = [];
  for (let i = 0; i < years.length; i++) {
    const pt = years[i];
    const wt = pt.w;
    totalW += wt;
    if (isFinite(pt.year) && pt.year <= cutoff) {
      visW += wt;
      visPts.push({ x: pt.year, y: pt.hw, w: wt });
    }
  }

  // color scale
  function agiColor(t) {
    if (t < 0.5) {
      const s = t * 2;
      return `rgba(${Math.floor(88+s*168)},${Math.floor(166+s*54)},${Math.floor(255-s*155)},0.85)`;
    } else {
      const s = (t - 0.5) * 2;
      return `rgba(255,${Math.floor(220-s*120)},${Math.floor(100-s*100)},0.85)`;
    }
  }

  // Draw all MC runs: visible colored, invisible grayed out
  const maxW = visPts.length > 0 ? Math.max(...visPts.map(p => p.w), 1e-10) : 1;
  for (let i = 0; i < years.length; i++) {
    const pt = years[i];
    const agiYr = pt.year;
    const r = 1 + (pt.w / maxW) * 8;
    if (isFinite(agiYr) && agiYr <= cutoff) {
      const t = Math.max(0, Math.min(1, (agiYr - xMin) / (xMax - xMin)));
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = agiColor(t);
    } else if (isFinite(agiYr)) {
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#333350';
    } else {
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#222230';
    }
    ctx.beginPath(); ctx.arc(yearToX(isFinite(agiYr) ? agiYr : xMax), hwToY(pt.hw), r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  // labels
  const xLabel = L.forecast_xaxis || 'T2 Year';
  ctx.fillStyle = '#666680'; ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center'; ctx.fillText(xLabel, w / 2, h - 6);
  ctx.save(); ctx.translate(10, h / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText(L.forecast_yaxis || 'HW Doubling (mo)', 0, 0); ctx.restore();

  // stats
  const pct = totalW > 0 ? (visW / totalW * 100) : 0;
  const pLabel = L.forecast_pagi || 'P(T2)';
  const mLabel = L.forecast_median || 'Median T2';
  ctx.fillStyle = '#f0883e'; ctx.font = 'bold 11px JetBrains Mono, monospace'; ctx.textAlign = 'left';
  ctx.fillText(`${pLabel}: ${pct.toFixed(1)}%`, pad + 4, pad + 12);

  if (visPts.length > 0) {
    visPts.sort((a, b) => a.x - b.x);
    let cum = 0, median = xMax;
    const half = visW / 2;
    for (const p of visPts) {
      cum += p.w;
      if (cum >= half) { median = p.x; break; }
    }
    ctx.fillStyle = '#58a6ff'; ctx.textAlign = 'center';
    ctx.fillText(`${mLabel}: ${median.toFixed(1)}`, w / 2, pad + 12);
  }

  // cutoff label
  ctx.fillStyle = '#f0883e'; ctx.font = '9px JetBrains Mono, monospace'; ctx.textAlign = 'center';
  ctx.fillText(`${cutoff}`, cx, pad - 4);

  // color legend
  const lx = w - pad - 120, ly = pad + 4, lw = 100, lh = 8;
  const grad = ctx.createLinearGradient(lx, 0, lx + lw, 0);
  grad.addColorStop(0, agiColor(0)); grad.addColorStop(0.5, agiColor(0.5)); grad.addColorStop(1, agiColor(1));
  ctx.fillStyle = grad; ctx.globalAlpha = 0.7; ctx.fillRect(lx, ly, lw, lh); ctx.globalAlpha = 1;
  ctx.fillStyle = '#666680'; ctx.font = '8px JetBrains Mono, monospace'; ctx.textAlign = 'left';
  ctx.fillText('2020', lx, ly + lh + 10);
  ctx.textAlign = 'right'; ctx.fillText('2065', lx + lw, ly + lh + 10);
}

function swarmDrawOverlay(ctx, w, h, pad) {
  const L = LANG[window._lang || 'ru'];
  const ess = 1.0 / swarm.weights.reduce((a, b) => a + b * b, 0);
  ctx.fillStyle = '#666680'; ctx.font = '10px JetBrains Mono, monospace'; ctx.textAlign = 'left';
  ctx.fillText(`ESS: ${ess.toFixed(0)} | ${L.canvas_particles}: ${swarm.particles.length}`, pad + 4, pad - 4);
  const slider = document.getElementById('swarmSlider');
  const ov = document.getElementById('swarmOverlay');
  const leg = document.getElementById('swarmLegend');
  const playBtn = document.getElementById('swarmPlayBtn');
  const hint = document.getElementById('swarmHint');

  if (swarm.mode === 'forecast') {
    // forecast mode: static result — no animation, no target toggle
    if (slider) { slider.style.display = ''; slider.value = swarm.forecastSliderMax || 2068; }
    if (playBtn) playBtn.style.display = 'none';
    if (hint) hint.style.display = 'none';
    if (ov) {
      const fc = swarm.forecastSliderMax || 2068;
      ov.innerHTML = `<div style="font-size:.75rem;color:#f0883e;font-weight:600">T2 ≤ ${fc}</div><div style="font-size:.68rem;color:#9898b0">${L.forecast_overlay_hypotheses} T2 ${L.forecast_overlay_by} ${fc}</div>`;
      ov.style.opacity = '1';
    }
    if (leg) {
      leg.innerHTML = `<span style="color:#58a6ff">●</span> AGI ${L.legend_early} &nbsp; <span style="color:#ffcc00">●</span> ${L.legend_mid} &nbsp; <span style="color:#ef4444">●</span> ${L.legend_late} &nbsp; <span style="color:#444">◌</span> ${L.legend_not_reached}`;
    }
  } else {
    // learn mode: slider shows observation index
    if (slider) { slider.style.display = ''; slider.value = swarm.obsIdx; }
    if (playBtn) playBtn.style.display = '';
    const targetToggleL = document.getElementById('swarmTargetToggle');
    if (targetToggleL) targetToggleL.style.display = 'none';
    if (hint) hint.style.display = '';
    // Show play button in learn mode
    const playBtnL = document.getElementById('swarmPlayBtn');
    if (playBtnL) playBtnL.style.display = '';
  if (swarm.obsIdx > 0 && swarm.obsIdx <= REAL_BENCHMARK_HISTORY.length) {
    const obs = REAL_BENCHMARK_HISTORY[swarm.obsIdx - 1];
    if (ov) { 
      ov.innerHTML = `<div style="font-size:.75rem;color:#f0883e;font-weight:600">${obs.year.toFixed(2)}</div>
      <div style="font-size:.68rem;color:#9898b0">${obs.event}</div>
      <div style="font-size:.65rem;color:#666680;margin-top:4px">ARC:${obs.arcAgi.toFixed(0)}% | SWE:${obs.sweBench.toFixed(1)}% | Elo:${obs.arenaElo.toFixed(0)}</div>`; 
      ov.style.opacity = '1'; 
    }
  } else { if (ov) ov.style.opacity = '0'; }
    if (leg) {
      leg.innerHTML = `<span style="color:#58a6ff">●</span> Cascade &nbsp; <span style="color:#ef4444">●</span> Hard Wall &nbsp; <span style="color:#22c55e">●</span> Slow Takeoff &nbsp; <span style="color:#a855f7">●</span> Resilient Civ &nbsp; <span style="color:#f0883e">○</span> ${L.swarm_canvas_legend_median}`;
    }
  }
}

function swarmPlay() {
  if (swarm.mode === 'forecast') {
    // Static mode — no animation, just redraw
    swarmDraw();
  } else {
    // Learn mode: animate observations
    if (swarm.animating) {
      swarm.animating = false;
      clearTimeout(swarm.rafId);
      document.getElementById('swarmPlayBtn').querySelector('span').textContent = LANG[window._lang||'ru'].swarm_play || 'Запуск';
      swarmStartLive();
      return;
    }
    if (swarm.obsIdx >= REAL_BENCHMARK_HISTORY.length) { swarm.obsIdx = 0; swarmInit(); }
    swarm.animating = true;
    swarmStopLive();
    document.getElementById('swarmPlayBtn').querySelector('span').textContent = '⏸';
    function step() {
      if (!swarm.animating || swarm.obsIdx >= REAL_BENCHMARK_HISTORY.length) {
        swarm.animating = false;
        document.getElementById('swarmPlayBtn').querySelector('span').textContent = LANG[window._lang||'ru'].swarm_play || 'Запуск';
        swarmStartLive();
        return;
      }
      swarm.obsIdx++;
      swarm.tracker = swarmBuildTracker(swarm.obsIdx);
      swarm.weights = Array.from(swarm.tracker.weights);
      swarm.particles = swarm.tracker.particles.map(p => ({ x: p.hw_months, y: p.agency_ceiling, algo: p.algo_months, wm: p.world_model }));
      swarmDraw();
      swarm.rafId = setTimeout(step, 250);
    }
    step();
  }
}

function swarmReset() {
  swarm.animating = false; clearTimeout(swarm.rafId);
  swarm.forecastAnimating = false; clearTimeout(swarm.forecastRafId);
  // Restore play button visibility in learn mode
  const resetPlayBtn = document.getElementById('swarmPlayBtn');
  if (resetPlayBtn) resetPlayBtn.style.display = '';
  swarmStopLive();
  swarm.obsIdx = 0; swarmInit();
  document.getElementById('swarmPlayBtn').innerHTML = '<span>' + (LANG[window._lang||'ru'].swarm_play||'Запуск') + '</span>';
  const playFBtn = document.getElementById('swarmPlayForecastBtn');
  if (playFBtn) playFBtn.innerHTML = '<span>' + (LANG[window._lang||'ru'].swarm_play_forecast||'Анимация') + '</span>';
  document.getElementById('swarmOverlay').style.opacity = '0';
  swarmStartLive();
}

// Live background: re-draw every 250ms
// In learn mode, rebuild tracker from same obsIdx so particles "breathe" (new MC draw, no progress)
let _swarmLiveTimer = null;
function swarmStartLive() {
  swarmStopLive();
  _swarmLiveTimer = setInterval(() => {
    if (swarm.animating || swarm.forecastAnimating) return;
    if (swarm.mode === 'learn') {
      // Rebuild tracker with fresh MC particles at current obsIdx (no learning progress)
      swarm.tracker = swarmBuildTracker(swarm.obsIdx);
      swarm.weights = Array.from(swarm.tracker.weights);
      swarm.particles = swarm.tracker.particles.map(p => ({ x: p.hw_months, y: p.agency_ceiling, algo: p.algo_months, wm: p.world_model }));
    }
    swarmDraw();
  }, 250);
}
function swarmStopLive() {
  if (_swarmLiveTimer) { clearInterval(_swarmLiveTimer); _swarmLiveTimer = null; }
}

// ===== LIVE SWARM: T1/T2/T3/T4 side by side =====
let liveSwarm = { tracker:null, timerT1:null, timerT2:null, timerT3:null, timerT4:null };

function liveSwarmInit() {
  // Validate the 4 canvases; sizing now happens per frame inside drawLiveSwarm
  // via syncCanvasToDisplay, so sizing them here would re-freeze any canvas
  // that is not laid out yet.
  ['liveSwarmT1','liveSwarmT2','liveSwarmT3','liveSwarmT4'].forEach(id => {
    const c = document.getElementById(id);
    if (!c) return;
    if (!c.getContext('2d')) return;
  });

  // Use same tracker as main forecast
  if (typeof coreTracker !== 'undefined' && coreTracker) {
    liveSwarm.tracker = coreTracker;
  } else if (typeof v3GetTracker === 'function') {
    liveSwarm.tracker = getTracker();
  } else {
    liveSwarm.tracker = swarmBuildTracker(REAL_BENCHMARK_HISTORY.length);
  }
  liveSwarmTickAll();
}

function drawLiveSwarm(canvasId, statsId, yearsKey, colorKey, mc) {
  const c = document.getElementById(canvasId);
  if (!c || !liveSwarm.tracker) return;
  // Self-healing sizing, same reason as swarmDraw(): these four canvases are
  // width:100%, and a backing store fixed once at startup leaves them stale on
  // resize and permanently blank if they were not laid out at that moment.
  const s = syncCanvasToDisplay(c);
  if (!s) return;                       // no layout yet — retry next frame
  const ctx = s.ctx, w = s.w, h = s.h;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0a0a0f'; ctx.fillRect(0, 0, w, h);

  const pad = 40, pw = w - pad * 2, ph = h - pad * 2;

  const xMin = 2020;
  const xMax = 2068;
  const yMin = 0, yMax = 16;

  function yearToX(yr) { return pad + ((yr - xMin) / (xMax - xMin)) * pw; }
  function hwToY(hw) { return h - pad - ((hw - yMin) / (yMax - yMin)) * ph; }

  // Use provided MC or skip
  if (!mc) return;
  const cfg = liveSwarm.tracker.cfg;
  const curYear = cfg.CURRENT_YEAR;
  const n = liveSwarm.tracker.n;
  const cumw = new Float64Array(n);
  cumw[0] = liveSwarm.tracker.weights[0];
  for (let i = 1; i < n; i++) cumw[i] = cumw[i-1] + liveSwarm.tracker.weights[i];

  const yearData = mc[yearsKey];
  const pts = [];
  let totalW = 0;
  for (let run = 0; run < yearData.length; run++) {
    const u = (run + 0.5) / yearData.length;
    let idx = 0;
    while (idx < n - 1 && cumw[idx] < u) idx++;
    const p = liveSwarm.tracker.particles[idx];
    const yr = yearData[run] + curYear;
    if (isFinite(yr)) {
      pts.push({ x: yr, y: p.hw_months });
      totalW++;
    }
  }
  if (totalW === 0) return;

  // Color function per stage
  function particleColor(t) {
    if (colorKey === 'T1') { // yellow
      const r = Math.floor(234 - t * 80);
      const g = Math.floor(179 - t * 60);
      const b = Math.floor(88 - t * 40);
      return `rgba(${r},${g},${b},0.85)`;
    } else if (colorKey === 'T2') { // orange
      const r = Math.floor(249 - t * 60);
      const g = Math.floor(115 - t * 50);
      const b = Math.floor(22 + t * 10);
      return `rgba(${r},${g},${b},0.85)`;
    } else if (colorKey === 'T3') { // red
      const r = Math.floor(239 - t * 40);
      const g = Math.floor(100 - t * 60);
      const b = Math.floor(100 - t * 60);
      return `rgba(${r},${g},${b},0.85)`;
    } else { // T4 purple
      const r = Math.floor(139 - t * 40);
      const g = Math.floor(92 - t * 50);
      const b = Math.floor(246 - t * 40);
      return `rgba(${r},${g},${b},0.85)`;
    }
  }

  // Draw particles with jitter
  for (let i = 0; i < pts.length; i++) {
    const pt = pts[i];
    const t = Math.max(0, Math.min(1, (pt.x - xMin) / (xMax - xMin)));
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = particleColor(t);
    const jx = (Math.random() - 0.5) * 1.5;
    const jy = (Math.random() - 0.5) * 1.5;
    ctx.beginPath();
    ctx.arc(yearToX(pt.x) + jx, hwToY(pt.y) + jy, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  // Grid
  ctx.strokeStyle = '#1a1a2a'; ctx.lineWidth = 1;
  for (let yr = 2020; yr <= 2065; yr += 5) {
    const x = yearToX(yr);
    ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, h - pad); ctx.stroke();
    ctx.fillStyle = '#444460'; ctx.font = '8px JetBrains Mono, monospace'; ctx.textAlign = 'center';
    ctx.fillText(yr.toString(), x, h - pad + 10);
  }
  for (let hw = 0; hw <= 16; hw += 4) {
    const y = hwToY(hw);
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
    ctx.fillStyle = '#333350'; ctx.textAlign = 'right';
    ctx.fillText(hw.toString(), pad - 4, y + 3);
  }

  // Axis labels
  const lang = window._lang || 'ru';
  const xLabel = LANG[lang].forecast_xaxis || 'Year';
  const yLabel = LANG[lang].forecast_yaxis || 'HW Doubling (mo)';
  ctx.fillStyle = '#555570'; ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center'; ctx.fillText(xLabel, w / 2, h - 4);
  ctx.save(); ctx.translate(9, h / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0); ctx.restore();

  // Stats: median, P10-P90
  pts.sort((a, b) => a.x - b.x);
  const half = totalW / 2;
  let cum = 0, median = xMax;
  for (const p of pts) { cum++; if (cum >= half) { median = p.x; break; } }
  const pct10 = pts[Math.min(pts.length - 1, Math.floor(totalW * 0.1))].x;
  const pct90 = pts[Math.min(pts.length - 1, Math.floor(totalW * 0.9))].x;

  const statsEl = document.getElementById(statsId);
  if (statsEl) {
    const mLabel = LANG[lang]['forecast_median_' + colorKey.toLowerCase()] || ('Median ' + colorKey);
    statsEl.innerHTML = `${mLabel}: <b>${median.toFixed(1)}</b><br>P10\u2013P90: ${pct10.toFixed(0)}\u2013${pct90.toFixed(0)}<br>N = ${totalW}`;
  }
}

function liveSwarmTickAll() {
  // Отменяем все предыдущие таймеры перед созданием новых
  ['T1','T2','T3','T4'].forEach(stage => {
    if (liveSwarm['timer' + stage]) {
      clearTimeout(liveSwarm['timer' + stage]);
      liveSwarm['timer' + stage] = null;
    }
  });

  const mc = liveSwarm.tracker ? liveSwarm.tracker.runMonteCarloForecast(500) : null;
  ['T1','T2','T3','T4'].forEach((stage) => {
    drawLiveSwarm('liveSwarm' + stage, 'liveSwarm' + stage + 'Stats',
      stage.toLowerCase() + 'Years', stage, mc);
  });
  // Один таймер для следующего вызова (не 4!)
  liveSwarm.timerT1 = setTimeout(liveSwarmTickAll, 250);
}

// ===== EVENT HORIZON: Sphere of Singularity =====
const ehData = {
  particles: [],
  nTarget: 1000,
  launched: 0,
  animId: null,
  timerId: null,
  running: false,
  tracker: null,
  radii: {},
  stats: { t2: 0, t4: 0, total: 0 },
  years: [2026, 2028, 2030, 2032, 2035, 2040, 2045, 2050, 2055, 2060, 2068],
};

const EH_YEARS = [2026, 2028, 2030, 2032, 2035, 2040, 2045, 2050, 2055, 2060, 2068];

function yearToRadius(year, maxR) {
  // 2026 -> 20px (center), 2068 -> maxR
  const t = Math.max(0, Math.min(1, (year - 2026) / (2068 - 2026)));
  return 20 + t * (maxR - 20);
}

function ehInitCanvas() {
  // Sizing is handled in ehDraw() via syncCanvasToDisplay, which runs on every
  // frame; doing it here too would just re-freeze the canvas if it is not laid
  // out yet. Keep this as a validity check only.
  const c = document.getElementById('eventHorizonCanvas');
  if (!c) return;
  if (!c.getContext('2d')) return;
}

function ehDraw() {
  const c = document.getElementById('eventHorizonCanvas');
  if (!c) return;
  // Same self-healing sizing as swarmDraw(): the backing store is re-derived
  // from the current css box every frame instead of being set once at init,
  // so a canvas that was 0x0 at startup recovers on its own and a window
  // resize does not leave it blurry or clipped.
  const s = syncCanvasToDisplay(c);
  if (!s) return;                       // no layout yet — retry next frame
  const ctx = s.ctx, w = s.w, h = s.h;
  const cx = w / 2, cy = h / 2;
  const maxR = Math.min(w, h) / 2 - 20;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#06060c';
  ctx.fillRect(0, 0, w, h);

  // Draw orbit rings for each year
  const lang = window._lang || 'ru';
  const t = LANG[lang];
  for (const yr of EH_YEARS) {
    const r = yearToRadius(yr, maxR);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#1a1a2a';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Year label
    ctx.fillStyle = '#333350';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(yr.toString(), cx + r + 4, cy + 3);
  }

  // Draw particles
  for (const p of ehData.particles) {
    const angle = p.angle;
    const targetR = yearToRadius(p.targetYear, maxR);
    const r = Math.min(p.r, targetR);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);

    const frozen = p.r >= targetR - 1;
    if (frozen) {
      // Glow effect for settled particles
      ctx.beginPath();
      ctx.arc(x, y, p.glow, 0, Math.PI * 2);
      ctx.fillStyle = p.glowColor;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }

  // Center label
  const cl = document.getElementById('ehCenterLabel');
  if (cl) {
    cl.textContent = '2026';
  }

  // Legend & stats
  const statsEl = document.getElementById('ehStats');
  const legendEl = document.getElementById('ehLegend');
  const n = ehData.particles.length;
  const t1 = ehData.particles.filter(p => p.type === 't1').length;
  const t2 = ehData.particles.filter(p => p.type === 't2').length;
  const t3 = ehData.particles.filter(p => p.type === 't3').length;
  const t4 = ehData.particles.filter(p => p.type === 't4').length;
  const pending = n - t1 - t2 - t3 - t4;

  if (statsEl) {
    statsEl.textContent = `N=${n} | T1=${t1} T2=${t2} T3=${t3} T4=${t4} | ${pending > 0 ? 'flying +' + pending : ''}`;
  }

  if (legendEl) {
    const L = LANG[window._lang || 'ru'];
    legendEl.innerHTML = `
        <span style="color:#eab308">● T1</span> Понимание &nbsp; 
        <span style="color:#f97316">● T2</span> Предсказуемость &nbsp; 
        <span style="color:#ef4444">● T3</span> Контроль &nbsp; 
        <span style="color:#8b5cf6">● T4</span> Влияние`;
  }
}

function ehStep(dt) {
  const c = document.getElementById('eventHorizonCanvas');
  if (!c) return;
  const w = c.offsetWidth, h = c.offsetHeight;
  const maxR = Math.min(w, h) / 2 - 20;

  // Move particles toward their target
  for (const p of ehData.particles) {
    if (p.r >= yearToRadius(p.targetYear, maxR) - 1) continue;
    p.r += p.speed * dt;
    // Slight spiral
    p.angle += 0.02 * dt;
  }

  // Spawn new particles
  if (ehData.launched < ehData.nTarget && ehData.spawnsLeft > 0) {
    const spawnRate = 2; // runs per frame
    for (let i = 0; i < spawnRate && ehData.launched < ehData.nTarget * 4 && ehData.spawnsLeft > 0; i++) {
      const pt = ehData.spawns[ehData.spawnIdx];
      ehData.spawnIdx++;
      ehData.spawnsLeft--;

      const stages = [
        { y: pt.t1, type: 't1', c: 'rgba(234,179,8,0.9)', gc: 'rgba(234,179,8,0.15)' },
        { y: pt.t2, type: 't2', c: 'rgba(249,115,22,0.9)', gc: 'rgba(249,115,22,0.15)' },
        { y: pt.t3, type: 't3', c: 'rgba(239,68,68,0.9)', gc: 'rgba(239,68,68,0.15)' },
        { y: pt.t4, type: 't4', c: 'rgba(139,92,246,0.9)', gc: 'rgba(139,92,246,0.15)' }
      ];

      for (const s of stages) {
        if (s.y !== Infinity) {
          ehData.particles.push({
            r: 0,
            angle: Math.random() * Math.PI * 2,
            speed: 8 + Math.random() * 12,
            targetYear: s.y,
            type: s.type,
            color: s.c,
            glowColor: s.gc,
            glow: 3 + Math.random() * 4,
          });
          ehData.launched++;
        }
      }
    }
  }

  ehDraw();
}

function ehAnimate() {
  if (!ehData.running) return;
  ehStep(1);
  ehData.animId = requestAnimationFrame(ehAnimate);
}

function eventHorizonPlay() {
  if (ehData.running) return;
  ehInitCanvas();

  // Get tracker from liveSwarm or global
  const tracker = (liveSwarm && liveSwarm.tracker) || (typeof coreTracker !== 'undefined' ? coreTracker : null);
  if (!tracker) {
    alert('Сначала запустите прогноз (кнопка «Запустить прогноз»)');
    return;
  }
  ehData.tracker = tracker;

  // Run MC forecast for particles
  const mc = tracker.runMonteCarloForecast(ehData.nTarget);
  const cfg = tracker.cfg;
  const curYear = cfg.CURRENT_YEAR;
  const n = tracker.n;
  const cumw = new Float64Array(n);
  cumw[0] = tracker.weights[0];
  for (let i = 1; i < n; i++) cumw[i] = cumw[i-1] + tracker.weights[i];

  ehData.spawns = [];
  for (let run = 0; run < mc.t1Years.length; run++) {
    const u = (run + 0.5) / mc.t1Years.length;
    let idx = 0;
    while (idx < n - 1 && cumw[idx] < u) idx++;
    const t1 = isFinite(mc.t1Years[run]) ? mc.t1Years[run] + curYear : Infinity;
    const t2 = isFinite(mc.t2Years[run]) ? mc.t2Years[run] + curYear : Infinity;
    const t3 = isFinite(mc.t3Years[run]) ? mc.t3Years[run] + curYear : Infinity;
    const t4 = isFinite(mc.t4Years[run]) ? mc.t4Years[run] + curYear : Infinity;
    ehData.spawns.push({ t1, t2, t3, t4, idx });
  }

  ehData.spawnIdx = 0;
  ehData.spawnsLeft = ehData.spawns.length;
  ehData.particles = [];
  ehData.launched = 0;
  ehData.running = true;
  ehAnimate();
}

function eventHorizonReset() {
  ehData.running = false;
  if (ehData.animId) cancelAnimationFrame(ehData.animId);
  if (ehData.timerId) clearTimeout(ehData.timerId);
  ehData.particles = [];
  ehData.launched = 0;
  ehData.spawns = [];
  ehData.spawnIdx = 0;
  ehData.spawnsLeft = 0;
  ehDraw();
}

// ===== SINGLE LOAD HANDLER (ordered initialization) =====
window.addEventListener('load', async () => {
  try {
    setLang('ru');

    // The old e-t2Threshold / e-t3Threshold / e-t4Threshold capability
    // sliders were hidden here because no trigger read them. Their
    // replacements are the thresholds actually compared, so nothing is
    // hidden any more and these sliders now change the forecast.


    // Показываем оверлей загрузки
    const overlay = document.getElementById('overlay');
    if (overlay) {
      overlay.classList.add('show');
      const textEl = document.getElementById('overlayText');
      if (textEl) textEl.textContent = 'Загрузка исторических бенчмарков...';
    }

    // [FIX] Даём браузеру 50мс на отрисовку оверлея перед блокировкой потока
    await new Promise(r => setTimeout(r, 50));

    // [FIX] Обязательно ДОЖИДАЕМСЯ загрузки данных ПЕРЕД запуском симуляции!
    await loadHistoricalBenchmarks();

    // Инициализируем UI и канвасы (теперь REAL_BENCHMARK_HISTORY гарантированно заполнен)
    swarmInit();
    ehInitCanvas();
    ehDraw();

    const tracker = getTracker();
    updateTrackerUI(tracker);
    renderDataPanel();

    // Live Swarm
    if (typeof liveSwarm !== 'undefined') {
      liveSwarm.tracker = coreTracker;
      liveSwarmInit();
    }

    // Запускаем симуляцию (она скроет оверлей по завершении)
    await runSimulation();
  } catch (err) {
    console.error("Initialization failed:", err);
  } finally {
    // ЖЕЛЕЗНАЯ ГАРАНТИЯ: если что-то пошло не так, мы всё равно снимаем экран загрузки
    const overlay = document.getElementById('overlay');
    if (overlay) overlay.classList.remove('show');
  }
});

function setLang(lang) {
  window._lang = lang;
  document.getElementById('lang_ru')?.classList.toggle('active', lang === 'ru');
  document.getElementById('lang_en')?.classList.toggle('active', lang === 'en');
  const t = LANG[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) { el.innerHTML = t[key]; return; }
    // Attribute targets use a "[title]key" form, e.g. data-i18n="[title]expert_toggle_title".
    // The markup had such a key but nothing ever read it, so the tooltip stayed
    // Russian in both languages. Translate the named attribute instead of the text.
    const m = /^\[(title|placeholder|aria-label)\](.+)$/.exec(key);
    if (m && t[m[2]] !== undefined) el.setAttribute(m[1], t[m[2]]);
  });
  // The standalone version badge was removed from the header: at phone widths it
  // pushed the RU/EN toggle onto a second line, and it only ever repeated what
  // hdr_sub already says ("v6.0 — …"). One version string, one place.
  // Re-draw canvases with new language
  if (typeof swarmDraw === 'function') swarmDraw();
  if (typeof ehDraw === 'function') ehDraw();
  if (typeof drawLiveSwarm === 'function') {
    if (typeof liveSwarm !== 'undefined') {
    if (liveSwarm.timerT1) clearTimeout(liveSwarm.timerT1);
    if (liveSwarm.timerT2) clearTimeout(liveSwarm.timerT2);
    if (liveSwarm.timerT3) clearTimeout(liveSwarm.timerT3);
    if (liveSwarm.timerT4) clearTimeout(liveSwarm.timerT4);
    liveSwarmTickAll();
    }
  }

  // Plotly graphs carry their axis titles and legend labels inside SVG/canvas,
  // which setLang() cannot reach through [data-i18n]. Without this the captions
  // above each chart flipped to English while the charts themselves stayed in
  // Russian — measured: chart1 xTitle stayed "Год" after switching to EN.
  // Re-run the plotters; each reads its strings from LANG at call time.
  try {
    const tr = (typeof getTracker === 'function') ? getTracker()
            : (typeof coreTracker !== 'undefined' && coreTracker) ? coreTracker : null;
    if (typeof currentResults !== 'undefined' && currentResults) {
      plotHistogram(currentResults.histogram);
      plotCumulative(currentResults.cumulative);
    }
    if (tr) {
      plotScenarioFan(tr);
      plotDecomposition(tr);
      if (currentResults && currentResults.embodimentTrajectory) {
        plotEmbodimentDiagnostics(tr, currentResults.embodimentTrajectory);
      }
      // The grounding-gap chart was missing from this list, so its legend, axis
      // titles and annotations stayed Russian after switching to English while
      // the card caption above it flipped correctly. Measured before the fix:
      // cardTitle "6. Causal Gap" next to a legend still reading
      // "Зона невыполненного заземления".
      if (currentResults && currentResults.gapTrajectory) {
        plotGroundingGap(currentResults.gapTrajectory);
      }
    }
  } catch (e) {
    console.warn('setLang: chart redraw failed:', e && e.message);
  }
  // The prior-sensitivity panel is written as innerHTML from LANG, so it is not
  // covered by the data-i18n sweep above and was left in the old language after
  // a switch. Invalidate the cache (its key now includes the language) and
  // re-render from the live tracker.
  try {
    if (typeof renderPriorSensitivity === 'function' && typeof coreTracker !== 'undefined' && coreTracker) {
      _priorSensCache.key = null;
      renderPriorSensitivity(coreTracker);
    }
  } catch (e) {
    console.warn('setLang: prior sensitivity redraw failed:', e && e.message);
  }
}

// ===== EXPERT SANDBOX UI =====


// ============================================================================
// 9. EXPERT SANDBOX & PRESETS
// ============================================================================

function toggleExpertPanel() {
  const panel = document.getElementById('expertPanel');
  if (!panel) return;

  // The arrow is driven purely by CSS (#expertPanel.collapsed .expert-arrow),
  // so there is no .open class to keep in sync here. It used to be toggled in
  // JS while the panel was collapsed from the start, which meant the glyph and
  // the panel could disagree on first paint.
  if (panel.classList.contains('collapsed')) {
    panel.classList.remove('collapsed');
    requestAnimationFrame(() => {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  } else {
    panel.classList.add('collapsed');
  }
}

function expertUpdate(key, value) {
  // String values (e.g. observationSigmaMode) skip numeric parsing
  if (typeof value === 'string' && isNaN(parseFloat(value))) {
    EXPERT_CONFIG[key] = value;
    return; // [FIX] Убрана live-мутация трекера, ждем Apply & Restart
  }
  value = parseFloat(value);
  EXPERT_CONFIG[key] = value; // [FIX] Убрана live-мутация трекера, ждем Apply & Restart
  
  const el = document.getElementById('ev-' + key);
  if (el) {
    el.textContent = (value % 1 === 0) ? value.toFixed(1) : value.toFixed(2);
  }
}

function expertWorldSlider() {
  const ids = ['e-world-cascade', 'e-world-hardWall', 'e-world-slowTakeoff', 'e-world-resilient'];
  const pctIds = ['ew-cascade', 'ew-hardWall', 'ew-slowTakeoff', 'ew-resilient'];
  let vals = ids.map(id => Math.max(0, parseInt(document.getElementById(id).value) || 0));
  let sum = vals.reduce((a, b) => a + b, 0);

  // Нормализуем до 100% если сумма не нулевая
  if (sum > 0 && sum !== 100) {
    vals = vals.map(v => Math.round(v * 100 / sum));
    // Корректируем ошибку округления
    const diff = 100 - vals.reduce((a, b) => a + b, 0);
    if (diff !== 0) {
      // Добавляем разницу к наибольшему
      const maxIdx = vals.indexOf(Math.max(...vals));
      vals[maxIdx] += diff;
    }
    // Обновляем слайдеры
    ids.forEach((id, i) => { document.getElementById(id).value = vals[i]; });
  }

  // Обновляем метки
  vals.forEach((v, i) => {
    const el = document.getElementById(pctIds[i]);
    if (el) el.textContent = v + '%';
  });

  // Проверка ошибки
  const sumCheck = vals.reduce((a, b) => a + b, 0);
  const err = document.getElementById('expertWorldError');
  if (err) err.style.display = (sumCheck !== 100) ? '' : 'none';

  if (sumCheck === 100) {
    EXPERT_CONFIG.worldModels.cascade = vals[0] / 100;
    EXPERT_CONFIG.worldModels.hardWall = vals[1] / 100;
    EXPERT_CONFIG.worldModels.slowTakeoff = vals[2] / 100;
  }
}

// Универсальная синхронизация UI с текущим объектом EXPERT_CONFIG
function syncExpertUIToConfig() {
  for (const [key, val] of Object.entries(EXPERT_CONFIG)) {
    if (key === 'worldModels') continue;
    const inputEl = document.getElementById('e-' + key);
    const valEl = document.getElementById('ev-' + key);
    if (inputEl) {
      if (inputEl.tagName === 'SELECT') inputEl.value = val;
      else inputEl.value = val;
    }
    if (valEl) {
      valEl.textContent = (typeof val === 'number' && val % 1 !== 0) ? val.toFixed(2) : val;
    }
  }

  // Обновляем ползунки World Models
  const wms = EXPERT_CONFIG.worldModels;
  const wmCascade = Math.round(wms.cascade * 100);
  const wmHardWall = Math.round(wms.hardWall * 100);
  const wmSlowTakeoff = Math.round(wms.slowTakeoff * 100);
  const wmResilient = Math.round((wms.resilientCiv || 0) * 100);
  
  if (document.getElementById('e-world-cascade')) {
    document.getElementById('e-world-cascade').value = wmCascade;
    document.getElementById('e-world-hardWall').value = wmHardWall;
    document.getElementById('e-world-slowTakeoff').value = wmSlowTakeoff;
    document.getElementById('e-world-resilient').value = wmResilient;
    document.getElementById('ew-cascade').textContent = wmCascade + '%';
    document.getElementById('ew-hardWall').textContent = wmHardWall + '%';
    document.getElementById('ew-slowTakeoff').textContent = wmSlowTakeoff + '%';
    document.getElementById('ew-resilient').textContent = wmResilient + '%';
  }
}

// Применение конкретного сценария будущего

function expertResetDefaults() {
  Object.assign(EXPERT_CONFIG, JSON.parse(JSON.stringify(DEFAULT_EXPERT_CONFIG)));
  syncExpertUIToConfig();
  
  const err = document.getElementById('expertWorldError');
  if (err) err.style.display = 'none';

  // Сброс базовых инпутов UI симуляции, которые вне EXPERT_CONFIG
  const simIds = ['rN', 'v3ARC', 'v3Horizon'];
  const simDefs = [3000, 52, 18.3];
  simIds.forEach((id, i) => {
    const inputMain = document.getElementById(id);
    if (inputMain) inputMain.value = simDefs[i];
  });
}

function expertApplyAndRun() {
  // Синхронизируем EXPERT_CONFIG с текущими значениями UI (включая world models)
  expertWorldSlider();
  // Сбрасываем трекер и перезапускаем
  resetTracker(); // ← было v3ResetTracker (не существовала)
  setTimeout(runSimulation, 100);
}


function quickWarning() {
  hasUserInput = true;
  const tracker = coreTracker || getTracker();
  checkObservationWarning(tracker);
  updateObsMetrics();
}

function renderDataPanel() {
  const panel = document.getElementById('dataPanelContent');
  if (!panel) return;
  const safe = (v, dec, suffix = '') => (v !== undefined && v !== null && isFinite(v)) ? (+v).toFixed(dec) + suffix : '—';
  const L = LANG[window._lang || 'ru'];
  const history = REAL_BENCHMARK_HISTORY;
  if (!history || history.length === 0) {
    panel.innerHTML = '<div style="color:#666680;padding:8px;font-size:.75rem;">' + (L.data_panel_loading || 'Данные загружаются...') + '</div>';
    return;
  }
  const rows = history.map(d => {
    const flops = d.trainingFlopsLog ? d.trainingFlopsLog.toFixed(2) : '—';
    return `<tr>
      <td style="color:#f0883e">${d.year.toFixed(2)}</td>
      <td>${d.event}</td>
      <td style="text-align:right">${safe(d.arenaElo, 0)}</td>
      <td style="text-align:right">${safe(d.arcAgi, 1, '%')}</td>
      <td style="text-align:right">${safe(d.sweBench, 1, '%')}</td>
      <td style="text-align:right;color:#a78bfa">${flops}</td>
    </tr>`;
  }).join('');
  panel.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:.7rem;font-family:var(--mono)">
      <thead>
        <tr style="color:#666680;text-align:left;border-bottom:1px solid #1e1e2e">
          <th style="padding:4px 6px">${L.data_panel_year || 'Год'}</th>
          <th style="padding:4px 6px">${L.data_panel_event || 'Модель'}</th>
          <th style="padding:4px 6px;text-align:right">Elo</th>
          <th style="padding:4px 6px;text-align:right">ARC</th>
          <th style="padding:4px 6px;text-align:right">SWE</th>
          <th style="padding:4px 6px;text-align:right">log FLOPs</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:6px;color:#444;font-size:.65rem;font-family:sans-serif">
      ${L.data_panel_source || 'Источники'}: LMSYS, SWE-bench Official, ARC Prize, Epoch AI.
    </div>
  `;
  const countEl = document.getElementById('dataPanelCount');
  if (countEl) countEl.textContent = history.length;
}

function updateObsMetrics() {
  const el = document.getElementById('obsMetrics');
  if (!el) return;
  el.style.display = 'block';

  const tracker = coreTracker || getTracker();
  const y = tracker.cfg.CURRENT_YEAR;
  
  const samples = [];
  for (let i = 0; i < tracker.n; i++) {
    const pred = simulateToYear(tracker.particles[i], y, tracker.cfg);
    const m = getNumericObservables(pred.reasoning, pred.agency, pred.embodiment, tracker.cfg.EXPERT);
    samples.push({ m, r: pred.reasoning, w: tracker.weights[i] });
  }
  
  function getMedian(key) {
    // Сортируем КОПИЮ, не мутируем оригинал
    const sorted = samples.slice().sort((a, b) => a.m[key] - b.m[key]);
    let cum = 0;
    for (let i = 0; i < sorted.length; i++) {
      cum += sorted[i].w;
      if (cum >= 0.5) return sorted[i].m[key];
    }
    return sorted[sorted.length - 1].m[key];
  }

  const medSwe = getMedian('sweBench');
  const medArc = getMedian('arcAgi');
  const medHorizonLog = getMedian('horizon'); // Это значение в log10(часов)
  
  // Возвращаем в нормальные часы для отображения
  const horizonHours = Math.pow(10, medHorizonLog);
  const horizonStr = horizonHours > 24 
    ? (horizonHours / 24).toFixed(1) + (window._lang === 'en' ? ' days' : ' дней') 
    : horizonHours.toFixed(1) + (window._lang === 'en' ? ' hours' : ' часов');

  // Расчет стоимости токенов на основе медианы Reasoning
  samples.sort((a, b) => a.r - b.r);
  let medR10 = 0, cum = 0;
  for (let i = 0; i < samples.length; i++) {
    cum += samples[i].w;
    if (cum >= 0.5) { medR10 = samples[i].r; break; }
  }
  const costPerM = Math.max(0.01, 19.625 * Math.exp(-0.4 * medR10));

  const e1 = document.getElementById('omSWE');
  const e2 = document.getElementById('omARC');
  const e3 = document.getElementById('omHorizon');
  const e4 = document.getElementById('omCost');
  
  if (e1) e1.textContent = medSwe.toFixed(1) + '%';
  if (e2) e2.textContent = medArc.toFixed(1) + '%';
  if (e3) e3.textContent = horizonStr;
  if (e4) e4.textContent = '$' + costPerM.toFixed(3);

  renderDataPanel();
}
// DEPLOY: scroll-to-panel fix
// cache-bypass: no-spoiler deployed
// v2026.05.30c: fix expertApplyAndRun worldSlider
// v2026.05.30d: physics patches
// v2026.05.30e: year-fix, deep-copy, noise-sensitivity, cleanup
// v2026.06.01a: horizon in likelihood, larger jitter, governance shock, backtest utility

// Глобальный экспорт для бэктеста из консоли:
//   runBacktest(5, 3) → train on 5 points, predict next 3
window.runBacktest = runBacktest;

// UI wrapper: запускает бэктест с автоматическим выбором границ и показывает результат в #backtestResult
function uiRunBacktest() {
  const data = REAL_BENCHMARK_HISTORY;
  if (!data || data.length < 4) {
    const el = document.getElementById('backtestResult');
    if (el) { el.style.display = 'block'; el.textContent = 'Недостаточно данных для бэктеста (нужно ≥4 наблюдений)'; }
    return;
  }
  const trainEnd = Math.max(3, Math.floor(data.length * 0.5));
  const kPred = data.length - trainEnd;
  const bt = runBacktest(trainEnd, kPred);
  if (bt.error) {
    const el = document.getElementById('backtestResult');
    if (el) { el.style.display = 'block'; el.textContent = 'Ошибка: ' + bt.error; }
    return;
  }
  const fmt = (v) => v == null ? '—' : v.toFixed(2);
  const html = `
    <div style="color:var(--text-primary);font-weight:600;margin-bottom:4px">📊 Бэктест результаты</div>
    <div>Train: ${bt.trainYears} (${trainEnd} точек) → Test: ${bt.testYears} (${kPred} точек)</div>
    <div>RMSE по измерениям:</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:4px">
      <div><span style="color:var(--text-muted)">SWE:</span> <b style="color:var(--accent)">${fmt(bt.perDim.sweBench)}</b></div>
      <div><span style="color:var(--text-muted)">ARC:</span> <b style="color:var(--accent)">${fmt(bt.perDim.arcAgi)}</b></div>
      <div><span style="color:var(--text-muted)">Elo:</span> <b style="color:var(--accent)">${fmt(bt.perDim.arenaElo)}</b></div>
      <div><span style="color:var(--text-muted)">logFLOPs:</span> <b style="color:var(--accent)">${fmt(bt.perDim.flopsLog)}</b></div>
      <div><span style="color:var(--text-muted)">logHor:</span> <b style="color:var(--accent)">${fmt(bt.perDim.horizon)}</b></div>
    </div>
    <div style="margin-top:6px">90% CI coverage: <b style="color:${bt.coverage90 >= 80 && bt.coverage90 <= 95 ? 'var(--green)' : 'var(--orange)'}">${bt.coverage90 != null ? bt.coverage90.toFixed(0) + '%' : '—'}</b> (идеально: 80–95%)</div>
  `;
  const el = document.getElementById('backtestResult');
  if (el) { el.style.display = 'block'; el.innerHTML = html; }
}
window.uiRunBacktest = uiRunBacktest;
// v2026.05.30f: fix decomp RSI + paradigm algoLog reset

// ---- EXPORT FOR TESTING / HEADLESS ----
globalThis.__SINGULARITY_CORE__ = {
  // LANG is exported so the language packs can be verified against the
  // data-i18n keys actually present in the markup — an earlier audit had to
  // regex-count braces to approximate this, which mis-read the pack and
  // produced a false "168 keys still missing" report.
  LANG,
  ParticleFilterTracker,
  simulateToYear,
  getNumericObservables,
  createConfig,
  EXPERT_CONFIG,
  FALLBACK_BENCHMARK_HISTORY,
  REAL_ROBOTICS_DATA,
  percentile,
  runBacktest,
  computeDim,
  applyInference,
  calculateRSI,
  setSeed,
  getSeed,
  rnd,
  stepDynamics,
  createSimState,
  runParticle,
  readCapabilities,
  computeDependency,
  applyParadigmShift,
};
