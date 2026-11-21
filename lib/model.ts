// Token launch radar, round 4 — expected launch value.
// Every number the dashboard shows is computed here, at run time, from the
// sealed snapshot alone: the log-log fit, the category factors, the LOO
// backtest, the walk-forward test, the listing-odds model, the board and
// the farm economics. Nothing is hardcoded from a leaderboard, and no value
// is typed in from another entry.
//
// Model (all factors multiply):
//   implied  = exp(a) * TVL^b * categoryFactor * growth * maturity
//              [* 0.5 for curator rows] [* 0.10 for flagged concern rows]
//   expected = implied * P(list)     <- the board ranks by expected value
//   a, b come from an OLS fit of log(mcap) on log(TVL) over the snapshot's
//   own traded comparables (n = 128, mcap > 0 and TVL > 0; 16 recorded
//   comps with mcap <= 0 are dead tokens and are left out, their log being
//   undefined). categoryFactor is the category median mcap/TVL, shrunk
//   toward the global median with prior weight 4, clamped to [0.15, 2.0]
//   and damped with gamma = 0.5. P(list) is a logistic model fitted on all
//   758 protocols: whether a protocol records a token, from its age, its
//   size, its 7-day change and its category's listing rate (see fitOdds).
//   The flat 0.6 stage discount of rounds 1-3 is RETIRED: the odds model
//   fits the same fact from the data, per row instead of flat (median odds
//   on the board 0.45, range 0.00-0.88; the old 0.6 sat inside that range,
//   but a flat prior cannot tell a 5-year-old protocol from a 5-week one).
//   Uncertainty band: low = base / k, bull = base * k, where
//   k = exp(median |log error| of the LOO backtest), clamped to [1.5, 4].
//   Rank ranges come from 200 bootstrap refits of the size curve: each
//   board row carries the 10th-90th percentile of its rank across refits.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface Comp {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number;
  listed_at: string | null;
}

export interface Fit {
  a: number;
  b: number;
  r2: number;
  n: number;
}

export interface CategoryFactor {
  n: number;
  median: number;
  factor: number;
}

export interface LooResult {
  medianAbsLog: number;
  mape: number;
  within2x: number;
  within3x: number;
  liveMedianAbsLog: number;
  liveN: number;
  n: number;
}

export interface CandidateRow {
  name: string;
  medianAbsLog: number;
  mape: number;
  within2x: number;
}

export interface FarmEconomics {
  capitalUsd: number;
  durationDays: number;
  durationLabel: string;
  gasUsd: number;
  timeCostUsd: number;
  evLowUsd: number;
  evMidUsd: number;
  evHighUsd: number;
  netLowUsd: number;
  tbillUsd: number;
  verdict: 'farm' | 'thin' | 'skip';
}

export interface BoardRow {
  slug: string;
  name: string;
  rank: number;
  /** The board's ranking value: expected launch value = implied x P(list). */
  implied_value_usd: number;
  /** Implied value if the token launched (before the odds discount). */
  implied_usd: number;
  /** Fitted probability the protocol ever records a token. */
  odds: number;
  low_usd: number;
  bull_usd: number;
  multiple: number;
  /** Rank range across 200 bootstrap refits: [p10, p90]. */
  rank_lo: number;
  rank_hi: number;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number;
  category_factor: number;
  growth_factor: number;
  maturity_factor: number;
  curator: boolean;
  concern: string | null;
  on_watchlist: boolean;
  farm_steps: string[];
  farm: FarmEconomics;
  points_status: string;
}

export interface ExcludedRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  reason: string;
  counterfactual_usd: number | null;
}

export interface OddsBin {
  lo: number;
  hi: number;
  n: number;
  actual: number;
  predicted: number;
}

export interface OddsModel {
  /** Logistic coefficients on STANDARDIZED features [age/yr, log10 TVL, clamped 7d change, category listing rate]. */
  beta: number[];
  intercept: number;
  mu: number[];
  sd: number[];
  /** 5-fold cross-validated AUC (deterministic shuffle, seed 7). */
  cvAuc: number;
  /** Age-only model, same folds, for the "what does age alone buy" check. */
  ageOnlyAuc: number;
  bins: OddsBin[];
  n: number;
  baseRate: number;
}

export interface WalkFold {
  cutoff: string;
  nTrain: number;
  nTest: number;
  r2: number;
  medianAbsLog: number;
  within2x: number;
}

export interface LedgerGroup {
  group: string;
  n: number;
  note: string;
}

export interface LedgerRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  disposition: string;
  detail: string;
  value_usd: number | null;
}

export interface FarmNextRow {
  slug: string;
  name: string;
  rank: number;
  expected_usd: number;
  capital_usd: number;
  net_low_usd: number;
  net_per_dollar: number;
  verdict: 'farm' | 'thin' | 'skip';
}

export interface RadarData {
  asOf: string;
  nProtocols: number;
  nWatchlist: number;
  nComps: number;
  fit: Fit;
  globalMedianRatio: number;
  categoryFactors: Record<string, CategoryFactor>;
  bandK: number;
  loo: LooResult;
  candidates: CandidateRow[];
  bootstrapB: { median: number; p5: number; p95: number; rounds: number };
  cv5MedianAbsLog: number;
  odds: OddsModel;
  walkForward: WalkFold[];
  ledgerGroups: LedgerGroup[];
  ledger: LedgerRow[];
  farmNext: FarmNextRow[];
  boardRows: number;
  excludedRows: number;
  exclusions: ExcludedRow[];
  counterfactualTop: { slug: string; category: string | null; tvl_usd: number; implied_usd: number }[];
  liveComps: { slug: string; name: string; category: string | null; tvl_usd: number; mcap_usd: number; ratio: number }[];
  rows: BoardRow[];
}

// --- disclosed priors (not fitted) ---------------------------------------
// The flat 0.6 stage discount of rounds 1-3 is retired in round 4: the
// listing-odds model (fitOdds) fits the same fact from the data, per row.
export const CONCERN_HAIRCUT = 0.1;
export const CURATOR_DISCOUNT = 0.5;
export const GAMMA = 0.5;
export const PRIOR_WEIGHT = 4;
export const FACTOR_LOW = 0.15;
export const FACTOR_HIGH = 2.0;
export const BAND_LOW = 1.5;
export const BAND_HIGH = 4;
export const T_BILL_RATE = 0.045;
export const SHARE_LOW = 0.05;
export const SHARE_MID = 0.15;
export const SHARE_HIGH = 0.25;

export const EXCLUDED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

export const CURATOR_CATEGORIES = new Set(['Risk Curators', 'Onchain Capital Allocator']);

const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];
const VERSIONED_NAME = /\s(v\d+|V\d+|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Flagged rows: a disclosed judgment, not a signal from the snapshot.
 *  Each reason was checked against public sources (see METHOD.md): the
 *  row's token already trades, or its product is a stablecoin, not a
 *  launch. Flagged rows stay on the board at a 0.10 haircut so the
 *  reader can see the call instead of it being hidden. */
export const CONCERN: Record<string, string> = {
  'usdd': 'USDD is a dollar-pegged stablecoin already trading — the product is the dollar, not a new token launch.',
  'bittensor-dtao': 'TAO already trades — dTAO subnets are priced off a live Bittensor token.',
  'plume-vaults': 'PLUME already trades — Plume Network launched its token in January 2025; these are vaults of a live-token project.',
  'saturn': 'USDat is a dollar-pegged stablecoin backed by tokenized Treasuries — the product is the stablecoin, not a new token launch.',
  'doppler-finance': 'XDP already trades — TGE September 2026, listed on KuCoin, OKX and Kraken; the launch already happened.',
  'hive-protocol': 'HIVE already trades — the Hive blockchain native token has traded since 2020.',
  'lightning-network': "Bitcoin's Lightning Network — a payment network with no token to launch.",
  'noble': 'Noble issues USDC natively on Cosmos — stablecoin infrastructure, not a token launch.',
};

export function parseSnapshot(text: string): Snapshot {
  const raw = JSON.parse(text) as Snapshot;
  if (!Array.isArray(raw.protocols) || !Array.isArray(raw.watchlist) || typeof raw.as_of !== 'string') {
    throw new Error('snapshot: unexpected shape (protocols/watchlist/as_of)');
  }
  return raw;
}

export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** The strict board filter: the house watchlist rule plus Liquid Staking
 *  and Liquid Restaking, whose tokens already trade as receipt tokens.
 *  Returns the reason a protocol is left out, or null when it stays. */
export function exclusionReason(p: SnapshotProtocol): string | null {
  if (!isPreToken(p)) return 'has token';
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return `category ${p.category}`;
  if (p.name !== null && VERSIONED_NAME.test(p.name)) return 'versioned name';
  if (p.name !== null && WRAPPED_WORD.test(p.name)) return 'wrapped/staked name';
  if (p.name !== null && EXCHANGE_PREFIXES.some((x) => p.name!.startsWith(x))) return 'exchange prefix';
  return null;
}

export function compsOf(snapshot: Snapshot): Comp[] {
  return snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: p.mcap_usd as number,
      listed_at: p.listed_at,
    }));
}

function median(values: number[]): number {
  const s = [...values].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function olsFit(xs: number[], ys: number[]): { a: number; b: number; r2: number } {
  const n = xs.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) * (xs[i]! - mx);
  }
  const b = sxy / sxx;
  const a = my - b * mx;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    ssTot += (ys[i]! - my) * (ys[i]! - my);
    const r = ys[i]! - (a + b * xs[i]!);
    ssRes += r * r;
  }
  return { a, b, r2: 1 - ssRes / ssTot };
}

export function fitComps(comps: Comp[]): Fit {
  const xs = comps.map((c) => Math.log(c.tvl_usd));
  const ys = comps.map((c) => Math.log(c.mcap_usd));
  const { a, b, r2 } = olsFit(xs, ys);
  return { a, b, r2, n: comps.length };
}

/** Category factors: per-category median mcap/TVL, shrunk toward the
 *  global median with prior weight 4, clamped to [0.15, 2.0], damped
 *  with gamma = 0.5. Categories with fewer than 2 comps fall back to 1. */
export function categoryFactors(
  comps: Comp[],
  gamma: number = GAMMA,
): { globalMedian: number; factors: Record<string, CategoryFactor> } {
  const globalMedian = median(comps.map((c) => c.mcap_usd / c.tvl_usd));
  const byCat = new Map<string, number[]>();
  for (const c of comps) {
    if (c.category === null) continue;
    const list = byCat.get(c.category) ?? [];
    list.push(c.mcap_usd / c.tvl_usd);
    byCat.set(c.category, list);
  }
  const factors: Record<string, CategoryFactor> = {};
  for (const [cat, ratios] of [...byCat.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    const med = median(ratios);
    if (ratios.length < 2) {
      factors[cat] = { n: ratios.length, median: med, factor: 1 };
      continue;
    }
    const shrunk = (ratios.length * med + PRIOR_WEIGHT * globalMedian) / (ratios.length + PRIOR_WEIGHT);
    const raw = shrunk / globalMedian;
    const clamped = Math.min(FACTOR_HIGH, Math.max(FACTOR_LOW, raw));
    factors[cat] = { n: ratios.length, median: med, factor: Math.pow(clamped, gamma) };
  }
  return { globalMedian, factors };
}

function parseDay(s: string | null): Date | null {
  if (s === null) return null;
  const d = new Date(`${s.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function ageDays(listedAt: string | null, asOf: string): number {
  const listed = parseDay(listedAt);
  const ref = parseDay(asOf);
  if (listed === null || ref === null) return 0;
  return Math.max(0, Math.floor((ref.getTime() - listed.getTime()) / 86_400_000));
}

/** Growth: half weight, change clamped to [-60, +120]%. A missing
 *  7-day change counts as 0 (no growth signal, not a penalty). */
export function growthFactor(change7d: number | null): number {
  const ch = change7d === null ? 0 : Math.min(120, Math.max(-60, change7d));
  return 1 + (0.5 * ch) / 100;
}

/** Maturity: 0.6 for a brand-new protocol, rising to 1.0 at 3 years. */
export function maturityFactor(age: number): number {
  return 0.6 + (Math.min(age, 1095) / 1095) * 0.4;
}

export interface PredictOptions {
  useCurve: boolean;
  useCat: boolean;
  useGrowth: boolean;
  useMaturity: boolean;
  gamma: number;
}

/** Predict a traded comparable's mcap. No stage discount and no concern
 *  haircut here: those are pre-token priors, and a comparable already
 *  trades. The curator discount DOES apply in backtest, exactly as on
 *  the board: a curator's TVL is nested inside other protocols, so the
 *  size curve overstates it the same way whether the row is a comp or
 *  a pre-token candidate. */
export function predictComp(
  comp: Comp,
  fit: Fit,
  globalMedian: number,
  factors: Record<string, CategoryFactor>,
  opts: PredictOptions,
  asOf: string,
): number {
  const base = opts.useCurve ? Math.exp(fit.a) * Math.pow(comp.tvl_usd, fit.b) : globalMedian * comp.tvl_usd;
  let f = 1;
  if (opts.useCat) {
    if (comp.category !== null && CURATOR_CATEGORIES.has(comp.category)) {
      f *= CURATOR_DISCOUNT;
    } else if (comp.category !== null && factors[comp.category] !== undefined) {
      f *= factors[comp.category]!.factor;
    }
  }
  if (opts.useGrowth) f *= growthFactor(comp.change_7d);
  if (opts.useMaturity) f *= maturityFactor(ageDays(comp.listed_at, asOf));
  return base * f;
}

const FULL_OPTS: PredictOptions = { useCurve: true, useCat: true, useGrowth: true, useMaturity: true, gamma: GAMMA };

/** Leave-one-out: hold out one comp, refit everything (fit, global
 *  median, category factors) on the rest, predict the held-out one. */
export function looBacktest(comps: Comp[], asOf: string, opts: PredictOptions = FULL_OPTS): LooResult {
  const errs: number[] = [];
  const mapes: number[] = [];
  const liveErrs: number[] = [];
  let within2 = 0;
  let within3 = 0;
  for (let i = 0; i < comps.length; i++) {
    const rest = comps.filter((_, j) => j !== i);
    const fit = fitComps(rest);
    const { globalMedian, factors } = categoryFactors(rest, opts.gamma);
    const held = comps[i]!;
    const pred = predictComp(held, fit, globalMedian, factors, opts, asOf);
    const actual = held.mcap_usd;
    const le = Math.abs(Math.log(pred) - Math.log(actual));
    errs.push(le);
    mapes.push(Math.abs(pred - actual) / actual);
    if (pred / actual <= 2 && actual / pred <= 2) within2++;
    if (pred / actual <= 3 && actual / pred <= 3) within3++;
    if (actual >= 1_000_000) liveErrs.push(le);
  }
  const n = comps.length;
  return {
    medianAbsLog: median(errs),
    mape: (mapes.reduce((s, x) => s + x, 0) / n) * 100,
    within2x: (100 * within2) / n,
    within3x: (100 * within3) / n,
    liveMedianAbsLog: liveErrs.length > 0 ? median(liveErrs) : 0,
    liveN: liveErrs.length,
    n,
  };
}

/** The candidate table: the chosen model against the alternatives the
 *  study said to test. The per-category-slope candidate refits a slope
 *  from the held-out comp's own category (n >= 5) and falls back to the
 *  global slope otherwise — the overfitting check. */
export function candidateTable(comps: Comp[], asOf: string): CandidateRow[] {
  const rows: CandidateRow[] = [];
  const variants: { name: string; opts: PredictOptions }[] = [
    { name: 'Chosen: curve + category (γ=0.5) + growth + maturity', opts: FULL_OPTS },
    { name: 'No size curve: median ratio + category', opts: { ...FULL_OPTS, useCurve: false } },
    { name: 'γ=0: curve, no category factor', opts: { ...FULL_OPTS, gamma: 0 } },
    { name: 'γ=0.2', opts: { ...FULL_OPTS, gamma: 0.2 } },
    { name: 'γ=0.25', opts: { ...FULL_OPTS, gamma: 0.25 } },
    { name: 'γ=0.75', opts: { ...FULL_OPTS, gamma: 0.75 } },
    { name: 'No growth factor', opts: { ...FULL_OPTS, useGrowth: false } },
    { name: 'No maturity factor', opts: { ...FULL_OPTS, useMaturity: false } },
    { name: 'Curve only: no category, growth or maturity', opts: { useCurve: true, useCat: false, useGrowth: false, useMaturity: false, gamma: GAMMA } },
  ];
  for (const v of variants) {
    const r = looBacktest(comps, asOf, v.opts);
    rows.push({ name: v.name, medianAbsLog: r.medianAbsLog, mape: r.mape, within2x: r.within2x });
  }
  // Per-category slope, computed inline (its own refit per fold).
  const errs: number[] = [];
  const mapes: number[] = [];
  let within2 = 0;
  for (let i = 0; i < comps.length; i++) {
    const rest = comps.filter((_, j) => j !== i);
    const held = comps[i]!;
    const sameCat = rest.filter((c) => c.category !== null && c.category === held.category);
    let fit: Fit;
    if (sameCat.length >= 5) {
      fit = fitComps(sameCat);
    } else {
      fit = fitComps(rest);
    }
    const { globalMedian, factors } = categoryFactors(rest, GAMMA);
    const pred = predictComp(held, fit, globalMedian, factors, FULL_OPTS, asOf);
    const actual = held.mcap_usd;
    errs.push(Math.abs(Math.log(pred) - Math.log(actual)));
    mapes.push(Math.abs(pred - actual) / actual);
    if (pred / actual <= 2 && actual / pred <= 2) within2++;
  }
  rows.push({
    name: 'Per-category slope (n>=5, else global)',
    medianAbsLog: median(errs),
    mape: (mapes.reduce((s, x) => s + x, 0) / comps.length) * 100,
    within2x: (100 * within2) / comps.length,
  });
  // Robust fit: one trim round (drop residuals beyond 2x the median
  // absolute residual, refit once) inside each LOO fold.
  const rErrs: number[] = [];
  const rMapes: number[] = [];
  let rWithin2 = 0;
  for (let i = 0; i < comps.length; i++) {
    const rest = comps.filter((_, j) => j !== i);
    const first = fitComps(rest);
    const res = rest.map((c) => Math.abs(Math.log(c.mcap_usd) - (first.a + first.b * Math.log(c.tvl_usd))));
    const cut = 2 * median(res);
    const kept = rest.filter((_, j) => res[j]! <= cut);
    const fit = kept.length >= 10 ? fitComps(kept) : first;
    const { globalMedian, factors } = categoryFactors(rest, GAMMA);
    const held = comps[i]!;
    const pred = predictComp(held, fit, globalMedian, factors, FULL_OPTS, asOf);
    const actual = held.mcap_usd;
    rErrs.push(Math.abs(Math.log(pred) - Math.log(actual)));
    rMapes.push(Math.abs(pred - actual) / actual);
    if (pred / actual <= 2 && actual / pred <= 2) rWithin2++;
  }
  rows.push({
    name: 'Robust fit (one trim round, 2x median residual)',
    medianAbsLog: median(rErrs),
    mape: (rMapes.reduce((s, x) => s + x, 0) / comps.length) * 100,
    within2x: (100 * rWithin2) / comps.length,
  });
  // Multi-feature regression: log(mcap) on log(TVL), log(age+1) and the
  // 7-day change, plus the category factor. Rejected: it scores worse
  // than the curve alone — age and change add noise, not signal, once
  // size is in. (Small Gaussian-elimination least squares, 4 features.)
  const mErrs: number[] = [];
  const mMapes: number[] = [];
  let mWithin2 = 0;
  const solve4 = (a: number[][], b: number[]): number[] => {
    const n = 4;
    const m = a.map((row, i) => [...row, b[i]!]);
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(m[r]![col]!) > Math.abs(m[piv]![col]!)) piv = r;
      const t = m[col]!;
      m[col] = m[piv]!;
      m[piv] = t;
      const d = m[col]![col]!;
      if (Math.abs(d) < 1e-12) return [0, 0, 0, 0];
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const f = m[r]![col]! / d;
        for (let k = col; k <= n; k++) m[r]![k] = m[r]![k]! - f * m[col]![k]!;
      }
    }
    return m.map((row, i) => row[n]! / row[i]!);
  };
  for (let i = 0; i < comps.length; i++) {
    const rest = comps.filter((_, j) => j !== i);
    const ata: number[][] = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
    const atb = [0, 0, 0, 0];
    for (const c of rest) {
      const x = [1, Math.log(c.tvl_usd), Math.log(ageDays(c.listed_at, asOf) + 1), (c.change_7d ?? 0) / 100];
      const yv = Math.log(c.mcap_usd);
      for (let a = 0; a < 4; a++) {
        atb[a]! += x[a]! * yv;
        for (let b = 0; b < 4; b++) ata[a]![b] = ata[a]![b]! + x[a]! * x[b]!;
      }
    }
    const beta = solve4(ata, atb);
    const held = comps[i]!;
    const xh = [1, Math.log(held.tvl_usd), Math.log(ageDays(held.listed_at, asOf) + 1), (held.change_7d ?? 0) / 100];
    let pred = Math.exp(xh.reduce((s, v, j) => s + v * beta[j]!, 0));
    const { factors: mfactors } = categoryFactors(rest, GAMMA);
    if (held.category !== null && CURATOR_CATEGORIES.has(held.category)) pred *= CURATOR_DISCOUNT;
    else if (held.category !== null && mfactors[held.category] !== undefined) pred *= mfactors[held.category]!.factor;
    const actual = held.mcap_usd;
    mErrs.push(Math.abs(Math.log(pred) - Math.log(actual)));
    mMapes.push(Math.abs(pred - actual) / actual);
    if (pred / actual <= 2 && actual / pred <= 2) mWithin2++;
  }
  rows.push({
    name: 'Multi-feature: log(TVL) + log(age) + change, + category',
    medianAbsLog: median(mErrs),
    mape: (mMapes.reduce((s, x) => s + x, 0) / comps.length) * 100,
    within2x: (100 * mWithin2) / comps.length,
  });
  return rows;
}

/** Deterministic PRNG (mulberry32) so bootstrap and CV are identical
 *  on every run — the program must write the same bytes twice. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function bootstrapSlope(
  comps: Comp[],
  rounds: number = 200,
): { median: number; p5: number; p95: number; rounds: number } {
  const rand = mulberry32(20261114);
  const slopes: number[] = [];
  for (let r = 0; r < rounds; r++) {
    const sample: Comp[] = [];
    for (let i = 0; i < comps.length; i++) sample.push(comps[Math.floor(rand() * comps.length)]!);
    slopes.push(fitComps(sample).b);
  }
  slopes.sort((x, y) => x - y);
  return {
    median: median(slopes),
    p5: slopes[Math.floor(0.05 * rounds)]!,
    p95: slopes[Math.floor(0.95 * rounds)]!,
    rounds,
  };
}

/** Random 5-fold cross-validation, one seeded shuffle. */
export function fiveFoldCv(comps: Comp[], asOf: string): number {
  const rand = mulberry32(777);
  const idx = comps.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = idx[i]!;
    idx[i] = idx[j]!;
    idx[j] = tmp;
  }
  const errs: number[] = [];
  for (let f = 0; f < 5; f++) {
    const testIdx = new Set(idx.filter((_, k) => k % 5 === f));
    const test = comps.filter((_, i) => testIdx.has(i));
    const train = comps.filter((_, i) => !testIdx.has(i));
    const fit = fitComps(train);
    const { globalMedian, factors } = categoryFactors(train);
    for (const t of test) {
      const pred = predictComp(t, fit, globalMedian, factors, FULL_OPTS, asOf);
      errs.push(Math.abs(Math.log(pred) - Math.log(t.mcap_usd)));
    }
  }
  return median(errs);
}

/** The listing-odds model (round 4). P(a protocol records a token) from
 *  the snapshot's own figures: how long it has run, how big it is, its
 *  7-day change (clamped to [-60, 120] like the growth factor — one row's
 *  TVL is up 4,448% in a week, and an unclamped feature would let that
 *  single row steer the fit), and its category's listing rate. The label
 *  is "records a token" (mcap, gecko_id or symbol present), not "has a
 *  token": DefiLlama's record is not proof, so the model says "records",
 *  never "has". Fitted by plain gradient descent on standardized
 *  features, fixed iterations, no randomness — the same snapshot fits the
 *  same coefficients. The category rate is leave-one-out (the row itself
 *  is left out of its own category's rate). */
export interface OddsFit {
  intercept: number;
  beta: number[];
  mu: number[];
  sd: number[];
}

function sigmoid(z: number): number {
  const c = Math.max(-30, Math.min(30, z));
  return 1 / (1 + Math.exp(-c));
}

function oddsFeatures(
  p: SnapshotProtocol,
  catRate: (cat: string | null, self: string) => number,
  asOf: string,
): number[] {
  const ch = p.change_7d === null ? 0 : Math.min(120, Math.max(-60, p.change_7d));
  return [ageDays(p.listed_at, asOf) / 365, Math.log10(Math.max(p.tvl_usd, 1)), ch / 100, catRate(p.category, p.slug)];
}

export function fitOdds(snapshot: Snapshot): {
  model: OddsFit;
  evaluation: OddsModel;
  catRate: (cat: string | null, self: string) => number;
} {
  const rows = snapshot.protocols;
  const asOf = snapshot.as_of;
  // Category listing rate, leave-one-out per row.
  const byCat = new Map<string, { n: number; pos: number }>();
  for (const r of rows) {
    const key = r.category ?? '\u0000none';
    const e = byCat.get(key) ?? { n: 0, pos: 0 };
    e.n++;
    if (!isPreToken(r)) e.pos++;
    byCat.set(key, e);
  }
  const baseRate = rows.filter((r) => !isPreToken(r)).length / rows.length;
  const catRate = (cat: string | null, self: string): number => {
    const key = cat ?? '\u0000none';
    const e = byCat.get(key);
    if (e === undefined || e.n <= 1) return baseRate;
    const selfPos = isPreToken(rows.find((r) => r.slug === self)!) ? 0 : 1;
    return (e.pos - selfPos) / (e.n - 1);
  };
  const X = rows.map((r) => oddsFeatures(r, catRate, asOf));
  const y = rows.map((r) => (isPreToken(r) ? 0 : 1));
  const d = 4;
  const mu = [0, 0, 0, 0];
  const sd = [1, 1, 1, 1];
  for (let j = 0; j < d; j++) {
    const col = X.map((x) => x[j]!);
    mu[j] = col.reduce((s, v) => s + v, 0) / col.length;
    const va = col.reduce((s, v) => s + (v - mu[j]!) * (v - mu[j]!), 0) / col.length;
    sd[j] = Math.sqrt(va) + 1e-9;
  }
  const z = (x: number[]): number[] => x.map((v, j) => (v - mu[j]!) / sd[j]!);
  const fit = (idx: number[], iters = 2000, lr = 0.5): { intercept: number; beta: number[] } => {
    let intercept = 0;
    const beta = [0, 0, 0, 0];
    for (let it = 0; it < iters; it++) {
      let gi = 0;
      const gb = [0, 0, 0, 0];
      for (const i of idx) {
        const xi = z(X[i]!);
        const p = sigmoid(intercept + xi.reduce((s, v, j) => s + v * beta[j]!, 0));
        const err = p - y[i]!;
        gi += err;
        for (let j = 0; j < d; j++) gb[j]! += err * xi[j]!;
      }
      const n = idx.length;
      intercept -= (lr * gi) / n;
      for (let j = 0; j < d; j++) beta[j]! -= (lr * gb[j]!) / n + lr * 0.001 * beta[j]!;
    }
    return { intercept, beta };
  };
  const all = rows.map((_, i) => i);
  const { intercept, beta } = fit(all);
  // 5-fold cross-validated AUC, deterministic shuffle (seed 7). The
  // age-only model runs the same folds, so the gap is the extra signal.
  const rand = mulberry32(7);
  const order = [...all];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = order[i]!;
    order[i] = order[j]!;
    order[j] = t;
  }
  const auc = (scores: number[], labels: number[]): number => {
    let wins = 0;
    let pairs = 0;
    for (let i = 0; i < scores.length; i++) {
      if (labels[i] !== 1) continue;
      for (let k = 0; k < scores.length; k++) {
        if (labels[k] !== 0) continue;
        pairs++;
        if (scores[i]! > scores[k]!) wins++;
        else if (scores[i]! === scores[k]!) wins += 0.5;
      }
    }
    return pairs === 0 ? 0.5 : wins / pairs;
  };
  const oof = new Array<number>(rows.length).fill(0);
  const oofAge = new Array<number>(rows.length).fill(0);
  for (let f = 0; f < 5; f++) {
    const te = order.filter((_, k) => k % 5 === f);
    const tr = order.filter((_, k) => k % 5 !== f);
    const m = fit(tr, 1200);
    for (const i of te) {
      const xi = z(X[i]!);
      oof[i] = sigmoid(m.intercept + xi.reduce((s, v, j) => s + v * m.beta[j]!, 0));
    }
    // Age-only: same folds, feature 0 alone.
    const fitAge = (idx: number[]): { intercept: number; b: number } => {
      let ic = 0;
      let b = 0;
      for (let it = 0; it < 1200; it++) {
        let gi = 0;
        let gb = 0;
        for (const i of idx) {
          const xi = (X[i]![0]! - mu[0]!) / sd[0]!;
          const p = sigmoid(ic + b * xi);
          const err = p - y[i]!;
          gi += err;
          gb += err * xi;
        }
        ic -= (0.5 * gi) / idx.length;
        b -= (0.5 * gb) / idx.length + 0.5 * 0.001 * b;
      }
      return { intercept: ic, b };
    };
    const ma = fitAge(tr);
    for (const i of te) {
      const xi = (X[i]![0]! - mu[0]!) / sd[0]!;
      oofAge[i] = sigmoid(ma.intercept + ma.b * xi);
    }
  }
  const bins: OddsBin[] = [];
  for (const [lo, hi] of [[0, 0.1], [0.1, 0.2], [0.2, 0.3], [0.3, 0.5], [0.5, 1.01]] as const) {
    const idx = oof.map((p, i) => (p >= lo && p < hi ? i : -1)).filter((i) => i >= 0);
    if (idx.length === 0) continue;
    bins.push({
      lo,
      hi,
      n: idx.length,
      actual: idx.reduce((s, i) => s + y[i]!, 0) / idx.length,
      predicted: idx.reduce((s, i) => s + oof[i]!, 0) / idx.length,
    });
  }
  const model: OddsFit = { intercept, beta, mu, sd };
  const evaluation: OddsModel = {
    beta,
    intercept,
    mu,
    sd,
    cvAuc: auc(oof, y),
    ageOnlyAuc: auc(oofAge, y),
    bins,
    n: rows.length,
    baseRate,
  };
  return { model, evaluation, catRate };
}

export function oddsOf(p: SnapshotProtocol, model: OddsFit, catRate: (cat: string | null, self: string) => number, asOf: string): number {
  const x = oddsFeatures(p, catRate, asOf);
  const z = x.map((v, j) => (v - model.mu[j]!) / model.sd[j]!);
  return sigmoid(model.intercept + z.reduce((s, v, j) => s + v * model.beta[j]!, 0));
}

/** Walk-forward by first-tracked date (round 4): the snapshot carries a
 *  single as_of date, but listed_at is the day DefiLlama began tracking
 *  each protocol — a time axis. Fit the size curve on comparables first
 *  tracked before the cutoff, test it on those first tracked after it,
 *  expanding window, three cutoffs. A model that only fits the past it
 *  was trained on fails here; one that generalises holds up. */
export function walkForward(comps: Comp[], asOf: string): WalkFold[] {
  const dated = comps.filter((c) => c.listed_at !== null).sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : 1));
  const folds: WalkFold[] = [];
  for (const cutoff of ['2023-06-01', '2024-06-01', '2025-06-01']) {
    const train = dated.filter((c) => c.listed_at! < cutoff);
    const test = dated.filter((c) => c.listed_at! >= cutoff);
    if (train.length < 20 || test.length < 5) continue;
    const fit = fitComps(train);
    const { globalMedian, factors } = categoryFactors(train);
    const errs: number[] = [];
    let within2 = 0;
    for (const t of test) {
      const pred = predictComp(t, fit, globalMedian, factors, FULL_OPTS, asOf);
      const le = Math.abs(Math.log(pred) - Math.log(t.mcap_usd));
      errs.push(le);
      if (le <= Math.log(2)) within2++;
    }
    folds.push({
      cutoff,
      nTrain: train.length,
      nTest: test.length,
      r2: fit.r2,
      medianAbsLog: median(errs),
      within2x: (100 * within2) / test.length,
    });
  }
  return folds;
}

/** Rank ranges from 200 bootstrap refits of the size curve (round 4).
 *  Each resample refits the curve and the category factors on a
 *  resampled comparable set; the odds stay fixed (the odds model is
 *  fitted once on all 758 rows — refitting it per resample would mix
 *  two sources of noise). Each board row gets the 10th and 90th
 *  percentile of its rank across refits, plus the median. */
export function rankRanges(
  boardInputs: {
    slug: string;
    tvl: number;
    category: string | null;
    curator: boolean;
    concern: boolean;
    growth: number;
    maturity: number;
    odds: number;
  }[],
  comps: Comp[],
  asOf: string,
  rounds: number = 200,
): Record<string, { lo: number; hi: number; median: number }> {
  const rand = mulberry32(20261121);
  const ranksBySlug = new Map<string, number[]>();
  for (const s of boardInputs) ranksBySlug.set(s.slug, []);
  for (let r = 0; r < rounds; r++) {
    const sample: Comp[] = [];
    for (let i = 0; i < comps.length; i++) sample.push(comps[Math.floor(rand() * comps.length)]!);
    const fit = fitComps(sample);
    const { factors } = categoryFactors(sample);
    // The resample changes the curve and the factors; each row's implied
    // value moves with them. Recompute implied per row from its stored
    // parts (the row's own TVL, category, growth and maturity), then
    // expected = implied x odds (odds fixed — see the doc comment).
    const scored = boardInputs.map((p) => {
      let v = Math.exp(fit.a) * Math.pow(p.tvl, fit.b);
      if (p.curator) v *= CURATOR_DISCOUNT;
      else if (p.category !== null && factors[p.category] !== undefined) v *= factors[p.category]!.factor;
      v *= p.growth * p.maturity;
      if (p.concern) v *= CONCERN_HAIRCUT;
      return { slug: p.slug, expected: v * p.odds };
    });
    scored.sort((x, y) => y.expected - x.expected || (x.slug < y.slug ? -1 : 1));
    scored.forEach((s, i) => ranksBySlug.get(s.slug)!.push(i + 1));
  }
  const out: Record<string, { lo: number; hi: number; median: number }> = {};
  for (const [slug, ranks] of ranksBySlug) {
    const sorted = [...ranks].sort((a, b) => a - b);
    out[slug] = {
      lo: sorted[Math.floor(0.1 * (sorted.length - 1))]!,
      hi: sorted[Math.floor(0.9 * (sorted.length - 1))]!,
      median: median(sorted),
    };
  }
  return out;
}

function capitalTier(tvlUsd: number): number {
  if (tvlUsd >= 500_000_000) return 500;
  if (tvlUsd >= 100_000_000) return 250;
  if (tvlUsd >= 25_000_000) return 100;
  return 50;
}

function durationTier(age: number): { days: number; label: string } {
  if (age >= 730) return { days: 75, label: '60–90 days' };
  if (age >= 365) return { days: 45, label: '30–60 days' };
  return { days: 21, label: '14–30 days' };
}

function gasEstimate(chains: string[]): number {
  return 12 + 3 * Math.max(0, chains.length - 1);
}

function economics(lowUsd: number, capitalUsd: number, durationDays: number, gasUsd: number): FarmEconomics {
  const evLow = lowUsd * SHARE_LOW;
  const evMid = lowUsd * SHARE_MID;
  const evHigh = lowUsd * SHARE_HIGH;
  const timeCost = (capitalUsd * T_BILL_RATE * durationDays) / 365;
  const netLow = evLow - capitalUsd - gasUsd - timeCost;
  // Provisional verdict from the low-end net alone; buildRadar refines
  // it with the row's flags (see the verdict rule there).
  const verdict: FarmEconomics['verdict'] = netLow > 50 ? 'farm' : netLow > 0 ? 'thin' : 'skip';
  return {
    capitalUsd,
    durationDays,
    durationLabel: durationDays >= 60 ? '60–90 days' : durationDays >= 30 ? '30–60 days' : '14–30 days',
    gasUsd,
    timeCostUsd: timeCost,
    evLowUsd: evLow,
    evMidUsd: evMid,
    evHighUsd: evHigh,
    netLowUsd: netLow,
    tbillUsd: timeCost,
    verdict,
  };
}

/** The verdict rule (disclosed in METHOD.md): the low-end net alone
 *  says "farm" for nearly every row, because the model's implied
 *  values are hundreds of thousands of dollars against tens of dollars
 *  of cost — so the verdict also prices what the net cannot see.
 *  Flagged rows are skip: their token already trades or their product
 *  is a stablecoin, so there is no future launch to farm. Curator rows
 *  are thin: their TVL is nested inside other protocols, so any future
 *  distribution is shared with the underlying protocols' own farmers.
 *  Otherwise thin means the low-end net is under $10,000 — a real win,
 *  but a small one for a multi-week farm. */
function finalVerdict(farm: FarmEconomics, curator: boolean, concern: string | null): FarmEconomics['verdict'] {
  if (concern !== null) return 'skip';
  if (curator) return 'thin';
  if (farm.netLowUsd < 10_000) return 'thin';
  return farm.verdict;
}

interface StepCtx {
  name: string;
  chain: string;
  capital: number;
  days: number;
  gas: number;
  verdict: string;
}

/** Mechanism-specific farm steps. Every step names what it costs and how
 *  long it takes; the numbers come from the row's own capital tier,
 *  duration tier and gas estimate — no step is a generic slogan.
 *  Points are never inventoried: the snapshot records no points program,
 *  so every plan says so and makes any season conditional. */
type Template = (c: StepCtx) => string[];

const TEMPLATES: Record<string, Template> = {
  Lending: (c) => [
    `Supply $${c.capital} of stablecoins as collateral on ${c.name} (${c.chain}) and confirm the deposit lands (about $${c.gas} gas, 1 day).`,
    `Borrow up to half the collateral value against the deposit and put the borrowed funds to work off-protocol, keeping the health factor above 2 (no extra gas, ${c.days} days).`,
    `Repay a slice of the loan every two weeks so the position stays comfortably collateralised through price swings (about $3 gas per repayment, ${c.days} days).`,
    `Track the borrow rate weekly; if it rises above the yield you earn elsewhere, repay the loan in full and stop (about $3 gas, 1 day).`,
    `Close the position: repay the loan, withdraw the full $${c.capital} collateral and check the final balance against the T-bill alternative (about $${c.gas} gas, 1 day).`,
  ],
  Dexs: (c) => [
    `Add $${c.capital} of liquidity to the deepest pool on ${c.name} (${c.chain}) in equal halves and confirm the LP position mints (about $${c.gas} gas, 1 day).`,
    `Route one small swap through the pool each week to stay an active liquidity provider and to learn the fee flow (about $2 gas per swap, ${c.days} days).`,
    `Collect the trading fees the position earns and compare them with the same $${c.capital} parked in T-bills (about $3 gas to claim, ${c.days} days).`,
    `If the pool's volume falls for two weeks running, move the liquidity to the busiest pair instead of leaving it idle (about $${c.gas} gas, 1 day).`,
    `Remove all liquidity, convert both sides back to stablecoins and tally fees earned minus gas spent (about $${c.gas} gas, 1 day).`,
  ],
  Derivatives: (c) => [
    `Deposit $${c.capital} as margin on ${c.name} (${c.chain}) and open a small hedged position, never more than a third of the margin at once (about $${c.gas} gas, 1 day).`,
    `Hold the hedge for the full ${c.days}-day window and collect the funding payments it earns while the position stays market-neutral (no gas while holding, ${c.days} days).`,
    `Check the margin ratio every three days and top it up or trim the position before it nears liquidation (about $3 gas per adjustment, ${c.days} days).`,
    `If funding flips negative for a full week, close the position and wait for the rate to turn instead of paying to hold it (about $${c.gas} gas, 1 day).`,
    `Close the position, withdraw the full $${c.capital} margin and compare the funding earned with the T-bill alternative (about $${c.gas} gas, 1 day).`,
  ],
  Yield: (c) => [
    `Deposit $${c.capital} into the highest-TVL vault on ${c.name} (${c.chain}) and confirm the vault shares arrive (about $${c.gas} gas, 1 day).`,
    `Leave the deposit compounding for the full ${c.days}-day window and check the vault's reported yield once a week (no gas while holding, ${c.days} days).`,
    `Harvest the accrued yield halfway through and redeposit it so it compounds as well (about $4 gas, 1 day).`,
    `If the vault's yield drops below the T-bill rate for two weeks, move the funds to a better vault or withdraw (about $${c.gas} gas, 1 day).`,
    `Withdraw the full position, convert the yield to stablecoins and tally the net gain after gas (about $${c.gas} gas, 1 day).`,
  ],
  'Yield Aggregator': (c) => [
    `Deposit $${c.capital} into the auto-compounding vault on ${c.name} (${c.chain}) and confirm the vault shares arrive (about $${c.gas} gas, 1 day).`,
    `Let the vault compound for the full ${c.days}-day window and read its strategy report once a week to know where the yield comes from (no gas while holding, ${c.days} days).`,
    `Compare the vault's net APY with the T-bill rate at the halfway mark; a vault under the T-bill rate is not earning its keep (about $3 gas to check, 1 day).`,
    `If the vault rotates strategies, read the new strategy's risks before the next deposit window and opt out if it adds leverage you did not agree to (about $3 gas, 1 day).`,
    `Withdraw the full position, convert everything to stablecoins and tally the net gain after gas (about $${c.gas} gas, 1 day).`,
  ],
  RWA: (c) => [
    `Buy $${c.capital} of the tokenised asset on ${c.name} (${c.chain}) and verify the purchase settles against the stated backing (about $${c.gas} gas, 1 day).`,
    `Hold the position for the full ${c.days}-day window and collect the yield the underlying asset pays out (no gas while holding, ${c.days} days).`,
    `Read the issuer's latest attestation halfway through and confirm the backing still covers the tokens outstanding (no gas, 1 day).`,
    `If the attestation lapses or the backing falls short, redeem the position at once instead of waiting for the next report (about $${c.gas} gas, 1 day).`,
    `Redeem the full $${c.capital} position for the underlying value and compare the yield with the T-bill alternative (about $${c.gas} gas, 1 day).`,
  ],
  CDP: (c) => [
    `Lock $${c.capital} of collateral in a vault on ${c.name} (${c.chain}) and mint stablecoins against it at no more than 50% of the collateral value (about $${c.gas} gas, 1 day).`,
    `Put the minted stablecoins to work for the full ${c.days}-day window and keep the collateral ratio above 200% at all times (no gas while holding, ${c.days} days).`,
    `Check the collateral price weekly and top up the vault before the ratio nears the liquidation line (about $3 gas per top-up, ${c.days} days).`,
    `If the collateral falls 20% from your entry, repay part of the debt immediately to restore a safe ratio (about $4 gas, 1 day).`,
    `Repay the debt in full, unlock the whole $${c.capital} of collateral and tally the net gain after gas (about $${c.gas} gas, 1 day).`,
  ],
  'Basis Trading': (c) => [
    `Deposit $${c.capital} on ${c.name} (${c.chain}) and open a delta-neutral basis position, long spot and short the future in equal size (about $${c.gas} gas, 1 day).`,
    `Hold the position for the full ${c.days}-day window and collect the funding and basis spread it earns while staying hedged (no gas while holding, ${c.days} days).`,
    `Rebalance the hedge every week so the long and short legs stay equal as prices move (about $4 gas per rebalance, ${c.days} days).`,
    `If the basis turns negative for a full week, unwind the position and wait for a positive spread instead of paying to hold it (about $${c.gas} gas, 1 day).`,
    `Unwind both legs, withdraw the full $${c.capital} and compare the spread earned with the T-bill alternative (about $${c.gas} gas, 1 day).`,
  ],
  'Risk Curators': (c) => [
    `Deposit $${c.capital} into the curated vault on ${c.name} (${c.chain}) and note which markets the curator allocates it to (about $${c.gas} gas, 1 day).`,
    `Leave the deposit with the curator for the full ${c.days}-day window and read the allocation report weekly to see where the capital actually sits (no gas while holding, ${c.days} days).`,
    `Check the curator's fee at the halfway mark and confirm the net yield still beats the T-bill rate after fees (about $3 gas to check, 1 day).`,
    `If the curator moves capital into a market you would not underwrite yourself, withdraw instead of accepting the allocation (about $${c.gas} gas, 1 day).`,
    `Withdraw the full position from the vault and tally the net yield after the curator's fee and gas (about $${c.gas} gas, 1 day).`,
  ],
  'Onchain Capital Allocator': (c) => [
    `Allocate $${c.capital} through ${c.name} (${c.chain}) and record which underlying protocols receive it (about $${c.gas} gas, 1 day).`,
    `Hold the allocation for the full ${c.days}-day window and read the allocator's report weekly to track where the capital sits (no gas while holding, ${c.days} days).`,
    `Verify the underlying protocols still hold the TVL they report and that no single one holds more than half your allocation (about $3 gas to check, 1 day).`,
    `If one underlying protocol's share passes half your allocation, rebalance or withdraw rather than concentrate the risk (about $${c.gas} gas, 1 day).`,
    `Withdraw the full allocation, convert it to stablecoins and tally the net gain after fees and gas (about $${c.gas} gas, 1 day).`,
  ],
  Generic: (c) => [
    `Deposit $${c.capital} into the main product on ${c.name} (${c.chain}) and confirm the position is recorded on-chain (about $${c.gas} gas, 1 day).`,
    `Use the product as intended for the full ${c.days}-day window and check the position weekly for unexpected changes (no gas while holding, ${c.days} days).`,
    `Compare the return the position earns with the same $${c.capital} parked in T-bills at the halfway mark (about $3 gas to check, 1 day).`,
    `If the return falls below the T-bill rate for two weeks, withdraw instead of leaving capital idle (about $${c.gas} gas, 1 day).`,
    `Withdraw the full position, convert it to stablecoins and tally the net gain after gas (about $${c.gas} gas, 1 day).`,
  ],
};

const POINTS_NOTE =
  'No points program is inventoried in the snapshot for this protocol; if a season opens, verify it on the project’s official channels first.';

function farmPlan(p: SnapshotProtocol, capital: number, days: number, gas: number, verdict: string): string[] {
  const template = TEMPLATES[p.category ?? ''] ?? TEMPLATES['Generic']!;
  const ctx: StepCtx = {
    name: p.name,
    chain: p.chains[0] ?? 'Ethereum',
    capital,
    days,
    gas,
    verdict,
  };
  const steps = template(ctx);
  // The verdict and the points honesty note ride on the last step's tail
  // as a separate final step, so every plan states both plainly — and
  // the step still carries its cost and duration, like every other step.
  steps.push(
    `Verdict ${verdict} on $${capital} over ${days} days (gas about $${gas}): the low-end expected value, net of capital, gas and time, is shown on the detail view. ${POINTS_NOTE}`,
  );
  return steps;
}

export interface GateRow {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
}

function impliedForBoard(
  p: SnapshotProtocol,
  fit: Fit,
  factors: Record<string, CategoryFactor>,
  asOf: string,
): { value: number; categoryFactor: number; growth: number; maturity: number; curator: boolean; concern: string | null } {
  const base = Math.exp(fit.a) * Math.pow(p.tvl_usd, fit.b);
  let f = 1;
  let categoryFactor = 1;
  const curator = p.category !== null && CURATOR_CATEGORIES.has(p.category);
  if (curator) {
    f *= CURATOR_DISCOUNT;
    categoryFactor = CURATOR_DISCOUNT;
  } else if (p.category !== null && factors[p.category] !== undefined) {
    categoryFactor = factors[p.category]!.factor;
    f *= categoryFactor;
  }
  const growth = growthFactor(p.change_7d);
  const age = ageDays(p.listed_at, asOf);
  const maturity = maturityFactor(age);
  f *= growth * maturity;
  const concern = CONCERN[p.slug] ?? null;
  if (concern !== null) f *= CONCERN_HAIRCUT;
  return { value: base * f, categoryFactor, growth, maturity, curator, concern };
}

export function buildRadar(snapshot: Snapshot): { board: GateRow[]; radar: RadarData } {
  const asOf = snapshot.as_of;
  const comps = compsOf(snapshot);
  const fit = fitComps(comps);
  const { globalMedian, factors } = categoryFactors(comps);
  const loo = looBacktest(comps, asOf);
  const bandK = Math.min(BAND_HIGH, Math.max(BAND_LOW, Math.exp(loo.medianAbsLog)));
  const candidates = candidateTable(comps, asOf);
  const bootstrap = bootstrapSlope(comps);
  const cv5 = fiveFoldCv(comps, asOf);
  const { model: oddsModel, evaluation: oddsEval, catRate } = fitOdds(snapshot);
  const walk = walkForward(comps, asOf);

  const watchlist = new Set(snapshot.watchlist);
  const scored: BoardRow[] = [];
  const exclusions: ExcludedRow[] = [];
  const ledger: LedgerRow[] = [];
  for (const p of snapshot.protocols) {
    const reason = exclusionReason(p);
    if (reason !== null) {
      if (isPreToken(p)) {
        const cf = impliedForBoard(p, fit, factors, asOf);
        exclusions.push({
          slug: p.slug,
          name: p.name,
          category: p.category,
          tvl_usd: p.tvl_usd,
          reason,
          counterfactual_usd: Math.max(1, Math.round(cf.value)),
        });
        ledger.push({
          slug: p.slug,
          name: p.name,
          category: p.category,
          tvl_usd: p.tvl_usd,
          disposition: 'not a launch',
          detail: `Left off the launch board: ${reason}. Valued if it launched anyway: $${Math.max(1, Math.round(cf.value)).toLocaleString('en-US')}.`,
          value_usd: Math.max(1, Math.round(cf.value)),
        });
      } else if (p.mcap_usd !== null && p.mcap_usd > 0) {
        ledger.push({
          slug: p.slug,
          name: p.name,
          category: p.category,
          tvl_usd: p.tvl_usd,
          disposition: 'already trades',
          detail: `Token already trades at $${p.mcap_usd.toLocaleString('en-US')} market cap (${(p.mcap_usd / p.tvl_usd).toFixed(3)}x TVL) — nothing left to launch.`,
          value_usd: p.mcap_usd,
        });
      } else if (p.mcap_usd !== null) {
        // mcap recorded at or below zero: a dead token (15 at zero, 1 below).
        ledger.push({
          slug: p.slug,
          name: p.name,
          category: p.category,
          tvl_usd: p.tvl_usd,
          disposition: 'dead token',
          detail: `Records a token whose market cap sits at or below zero ($${p.mcap_usd.toLocaleString('en-US')}) — the launch already happened and died.`,
          value_usd: null,
        });
      } else {
        // Token recorded (gecko_id or symbol) but the snapshot carries no
        // market cap for it: not pre-token, and not priced.
        ledger.push({
          slug: p.slug,
          name: p.name,
          category: p.category,
          tvl_usd: p.tvl_usd,
          disposition: 'token recorded, no mcap',
          detail: `Records a token (${p.gecko_id ?? p.symbol ?? 'unnamed in the snapshot'}) but the snapshot carries no market cap for it — not a pre-token protocol, and not priced.`,
          value_usd: null,
        });
      }
      continue;
    }
    const imp = impliedForBoard(p, fit, factors, asOf);
    const odds = oddsOf(p, oddsModel, catRate, asOf);
    // The board ranks by EXPECTED launch value: what the token would be
    // worth if it launched, times the fitted odds it ever does. The
    // gate's implied_value_usd carries the expected value, so the
    // non-increasing check holds on the ranking value.
    const implied = Math.max(1, Math.round(imp.value));
    const expected = Math.max(1, Math.round(imp.value * odds));
    const low = Math.max(1, Math.round(expected / bandK));
    const bull = Math.max(1, Math.round(expected * bandK));
    const age = ageDays(p.listed_at, asOf);
    const capital = capitalTier(p.tvl_usd);
    const dur = durationTier(age);
    const gas = gasEstimate(p.chains);
    const farm = economics(low, capital, dur.days, gas);
    farm.verdict = finalVerdict(farm, imp.curator, imp.concern);
    const steps = farmPlan(p, capital, dur.days, gas, farm.verdict);
    scored.push({
      slug: p.slug,
      name: p.name,
      rank: 0,
      implied_value_usd: expected,
      implied_usd: implied,
      odds,
      low_usd: low,
      bull_usd: bull,
      multiple: expected / p.tvl_usd,
      rank_lo: 0,
      rank_hi: 0,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      age_days: age,
      category_factor: imp.categoryFactor,
      growth_factor: imp.growth,
      maturity_factor: imp.maturity,
      curator: imp.curator,
      concern: imp.concern,
      on_watchlist: watchlist.has(p.slug),
      farm_steps: steps,
      farm,
      points_status: 'none — no points program is inventoried in the snapshot',
    });
  }
  // Rank ranges from 200 bootstrap refits of the size curve (odds fixed).
  const ranges = rankRanges(
    scored.map((r) => ({
      slug: r.slug,
      tvl: r.tvl_usd,
      category: r.category,
      curator: r.curator,
      concern: r.concern !== null,
      growth: r.growth_factor,
      maturity: r.maturity_factor,
      odds: r.odds,
    })),
    comps,
    asOf,
  );
  scored.sort((x, y) => {
    if (y.implied_value_usd !== x.implied_value_usd) return y.implied_value_usd - x.implied_value_usd;
    if (y.implied_usd !== x.implied_usd) return y.implied_usd - x.implied_usd;
    if (y.tvl_usd !== x.tvl_usd) return y.tvl_usd - x.tvl_usd;
    return x.slug < y.slug ? -1 : 1;
  });
  scored.forEach((r, i) => {
    r.rank = i + 1;
    const rg = ranges[r.slug]!;
    r.rank_lo = rg.lo;
    r.rank_hi = rg.hi;
  });
  for (const r of scored) {
    ledger.push({
      slug: r.slug,
      name: r.name,
      category: r.category,
      tvl_usd: r.tvl_usd,
      disposition: 'on the launch board',
      detail: `Rank #${r.rank} by expected value ($${r.implied_value_usd.toLocaleString('en-US')}) — implied $${r.implied_usd.toLocaleString('en-US')} x odds ${r.odds.toFixed(2)}.`,
      value_usd: r.implied_value_usd,
    });
  }

  const board: GateRow[] = scored.map((r) => ({
    slug: r.slug,
    name: r.name,
    rank: r.rank,
    implied_value_usd: r.implied_value_usd,
    farm_steps: r.farm_steps,
  }));

  const counterfactualTop = [...exclusions]
    .sort((x, y) => (y.counterfactual_usd ?? 0) - (x.counterfactual_usd ?? 0))
    .slice(0, 8)
    .map((e) => ({ slug: e.slug, category: e.category, tvl_usd: e.tvl_usd, implied_usd: e.counterfactual_usd ?? 0 }));

  const liveComps = [...comps]
    .sort((x, y) => y.mcap_usd - x.mcap_usd)
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      category: c.category,
      tvl_usd: c.tvl_usd,
      mcap_usd: c.mcap_usd,
      ratio: c.mcap_usd / c.tvl_usd,
    }));

  const farmNext: FarmNextRow[] = [...scored]
    .map((r) => ({
      slug: r.slug,
      name: r.name,
      rank: r.rank,
      expected_usd: r.implied_value_usd,
      capital_usd: r.farm.capitalUsd,
      net_low_usd: r.farm.netLowUsd,
      net_per_dollar: r.farm.netLowUsd / r.farm.capitalUsd,
      verdict: r.farm.verdict,
    }))
    .sort((a, b) => b.net_per_dollar - a.net_per_dollar)
    .slice(0, 20);

  const ledgerGroups: LedgerGroup[] = [
    { group: 'on the launch board', n: scored.length, note: 'Pre-token protocols ranked by expected launch value.' },
    { group: 'not a launch', n: exclusions.length, note: 'Pre-token by record, left off the board: bridges, exchanges, wrapped/staked products, versioned names.' },
    {
      group: 'token recorded, no mcap',
      n: ledger.filter((l) => l.disposition === 'token recorded, no mcap').length,
      note: 'Records a token (gecko_id or symbol) but the snapshot carries no market cap — not pre-token, not priced.',
    },
    { group: 'already trades', n: ledger.filter((l) => l.disposition === 'already trades').length, note: 'Token already trades; market cap from the snapshot.' },
    { group: 'dead token', n: ledger.filter((l) => l.disposition === 'dead token').length, note: 'Records a token whose market cap sits at or below zero.' },
  ];

  const radar: RadarData = {
    asOf,
    nProtocols: snapshot.protocols.length,
    nWatchlist: snapshot.watchlist.length,
    nComps: comps.length,
    fit,
    globalMedianRatio: globalMedian,
    categoryFactors: factors,
    bandK,
    loo,
    candidates,
    bootstrapB: bootstrap,
    cv5MedianAbsLog: cv5,
    odds: oddsEval,
    walkForward: walk,
    ledgerGroups,
    ledger,
    farmNext,
    boardRows: scored.length,
    excludedRows: exclusions.length,
    exclusions,
    counterfactualTop,
    liveComps,
    rows: scored,
  };
  return { board, radar };
}

/** The gate's own shape, checked before anything is written: ranks
 *  1..N once each, implied non-increasing with rank, watchlist fully
 *  covered, farm steps 3–12 strings of 20–600 characters each carrying
 *  a cost or a duration. Returns the first problem, or null. */
export function boardIssue(board: GateRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(snapshot.protocols.map((p) => p.slug));
  const ranks = new Set<number>();
  let prev = Number.POSITIVE_INFINITY;
  let allSame = board.length > 1;
  let firstValue: number | null = null;
  for (const row of board) {
    if (!slugs.has(row.slug)) return `board: slug ${row.slug} is not in the snapshot`;
    if (row.name.trim() === '') return `board: ${row.slug} has an empty name`;
    if (!Number.isInteger(row.rank) || row.rank < 1) return `board: ${row.slug} has rank ${row.rank}`;
    if (ranks.has(row.rank)) return `board: rank ${row.rank} appears twice`;
    ranks.add(row.rank);
    if (!Number.isInteger(row.implied_value_usd) || row.implied_value_usd < 1 || row.implied_value_usd > 100_000_000_000_000) {
      return `board: ${row.slug} has implied_value_usd ${row.implied_value_usd}`;
    }
    if (row.implied_value_usd > prev) return `board: implied value rises at rank ${row.rank}`;
    if (firstValue === null) firstValue = row.implied_value_usd;
    else if (row.implied_value_usd !== firstValue) allSame = false;
    prev = row.implied_value_usd;
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) {
      return `board: ${row.slug} has ${row.farm_steps.length} farm steps`;
    }
    for (const step of row.farm_steps) {
      const t = step.trim();
      if (t.length < 20 || t.length > 600) return `board: ${row.slug} has a farm step of ${t.length} characters`;
      if (!t.includes('$') && !/day/i.test(t)) return `board: ${row.slug} has a farm step with no cost or duration`;
    }
  }
  for (let r = 1; r <= board.length; r++) {
    if (!ranks.has(r)) return `board: rank ${r} is missing`;
  }
  if (allSame) return 'board: every implied value is the same — not a ranking';
  const onBoard = new Set(board.map((r) => r.slug));
  for (const slug of snapshot.watchlist) {
    if (!onBoard.has(slug)) return `board: watchlist slug ${slug} is missing`;
  }
  return null;
}

/** The dashboard's data file: one deterministic JSON document. No
 *  timestamps, no randomness — the same snapshot writes the same bytes. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR_DATA = ${JSON.stringify(radar)};\n`;
}
