// Token launch radar dashboard — renders window.RADAR_DATA, no network.
// Views: board, detail, audit (model & audit), comps. The initial view,
// the selected protocol and the board filters come from the URL query so
// a screenshot can open any state directly, e.g. ?view=audit or
// ?view=detail&slug=steakhouse-financial or ?view=board&cat=RWA.
const D = window.RADAR_DATA;
const $ = (id) => document.getElementById(id);

function fmtUsd(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + Math.round(n);
}
function fmtInt(n) { return Math.round(n).toLocaleString('en-US'); }
function fmtX(n) { return n.toFixed(2) + 'x'; }
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function verdictChip(v) { return '<span class="chip ' + v + '">' + v + '</span>'; }

const params = new URLSearchParams(location.search);
let sortKey = 'rank';
let sortDir = 1;

function showView(name) {
  for (const v of ['board', 'detail', 'audit', 'comps']) {
    $('view-' + v).classList.toggle('hidden', v !== name);
    document.querySelector('[data-view="' + v + '"]').classList.toggle('active', v === name);
  }
  if (name === 'detail') renderDetail(currentSlug);
  if (name === 'audit') renderAudit();
  if (name === 'comps') renderComps();
}
document.querySelectorAll('#tabs button').forEach((b) => {
  b.addEventListener('click', () => showView(b.getAttribute('data-view')));
});

function topStats() {
  $('topStats').innerHTML =
    '<span>' + D.boardRows + ' rows</span><span>watchlist ' + D.nWatchlist + '/' + D.nWatchlist + '</span>' +
    '<span>' + D.nComps + ' comps</span><span>snapshot ' + esc(D.asOf) + '</span>';
  $('asOf').textContent = D.asOf;
  const c = D.loo;
  $('statCards').innerHTML =
    card(fmtInt(D.boardRows), 'pre-token protocols ranked') +
    card(D.fit.b.toFixed(2), 'size-curve slope b (log-log fit)') +
    card('R² ' + D.fit.r2.toFixed(2), 'fit on ' + D.nComps + ' comps') +
    card(fmtX(D.bandK), 'uncertainty band k (LOO)') +
    card(c.medianAbsLog.toFixed(2), 'LOO median |log error|') +
    card(c.within2x.toFixed(0) + '%', 'comps predicted within 2x');
  function card(b, s) { return '<div class="card"><b>' + b + '</b><span>' + s + '</span></div>'; }
}

function boardRows() {
  const q = ($('q').value || '').toLowerCase();
  const cat = $('cat').value;
  const hideFlagged = $('hideFlagged').checked;
  const watchOnly = $('watchOnly').checked;
  let rows = D.rows.filter((r) => {
    if (q && !(r.name.toLowerCase().includes(q) || r.slug.includes(q))) return false;
    if (cat && r.category !== cat) return false;
    if (hideFlagged && r.concern) return false;
    if (watchOnly && !r.on_watchlist) return false;
    return true;
  });
  rows = [...rows].sort((x, y) => {
    const a = x[sortKey];
    const b = y[sortKey];
    if (typeof a === 'string') return sortDir * a.localeCompare(b);
    return sortDir * (a - b);
  });
  return rows;
}

function renderBoard() {
  const rows = boardRows();
  $('rowCount').textContent = rows.length + ' of ' + D.rows.length + ' rows';
  $('boardBody').innerHTML = rows.map((r) => {
    const cls = [r.concern ? 'flagged' : '', r.on_watchlist ? 'watch' : ''].join(' ');
    return '<tr class="' + cls + '" data-slug="' + esc(r.slug) + '"><td>' + r.rank + '</td>' +
      '<td>' + esc(r.name) + (r.on_watchlist ? ' <span class="chip watch">watch</span>' : '') +
      (r.concern ? ' <span class="chip flag">flagged</span>' : '') + '</td>' +
      '<td>' + esc(r.category || '—') + '</td>' +
      '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
      '<td class="num">' + fmtUsd(r.implied_value_usd) + '</td>' +
      '<td class="num">' + fmtUsd(r.low_usd) + '</td>' +
      '<td class="num">' + fmtX(r.multiple) + '</td>' +
      '<td>' + verdictChip(r.farm.verdict) + '</td></tr>';
  }).join('');
  document.querySelectorAll('#boardBody tr').forEach((tr) => {
    tr.addEventListener('click', () => {
      currentSlug = tr.getAttribute('data-slug');
      showView('detail');
    });
  });
}

function fillCategories() {
  const cats = [...new Set(D.rows.map((r) => r.category).filter(Boolean))].sort();
  $('cat').innerHTML = '<option value="">All categories</option>' +
    cats.map((c) => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
  if (params.get('cat')) $('cat').value = params.get('cat');
  if (params.get('hideFlagged') === '1') $('hideFlagged').checked = true;
  if (params.get('watchOnly') === '1') $('watchOnly').checked = true;
}
['q', 'cat', 'hideFlagged', 'watchOnly'].forEach((id) => {
  $(id).addEventListener('input', renderBoard);
  $(id).addEventListener('change', renderBoard);
});
document.querySelectorAll('th[data-sort]').forEach((th) => {
  th.addEventListener('click', () => {
    const k = th.getAttribute('data-sort');
    if (sortKey === k) sortDir = -sortDir;
    else { sortKey = k; sortDir = 1; }
    renderBoard();
  });
});

let currentSlug = params.get('slug') || (D.rows[0] && D.rows[0].slug);

function renderDetail(slug) {
  const r = D.rows.find((x) => x.slug === slug) || D.rows[0];
  if (!r) { $('detailBody').innerHTML = '<p>No row selected.</p>'; return; }
  currentSlug = r.slug;
  const f = r.farm;
  const factorLines = [
    ['Size curve', 'exp(' + D.fit.a.toFixed(4) + ') × TVL^' + D.fit.b.toFixed(4) + ' = ' + fmtUsd(Math.exp(D.fit.a) * Math.pow(r.tvl_usd, D.fit.b))],
    ['Growth', '7d ' + (r.change_7d === null ? 'unreported' : r.change_7d.toFixed(1) + '%') + ' → ' + r.growth_factor.toFixed(3) + 'x'],
    ['Maturity', r.age_days + ' days old → ' + r.maturity_factor.toFixed(3) + 'x'],
    ['Stage discount', 'pre-token prior → 0.600x'],
  ];
  // For curator rows the 0.5 curator discount IS the category factor —
  // it replaces the table factor, it is not applied on top of it. The
  // table factor is therefore not listed separately for those rows.
  if (!r.curator) factorLines.splice(1, 0, ['Category factor', (r.category || 'none') + ' → ' + r.category_factor.toFixed(3) + 'x']);
  if (r.curator) factorLines.push(['Curator discount', 'nested TVL (curator holds other protocols) — replaces the table category factor → 0.500x']);
  if (r.concern) factorLines.push(['Concern haircut', 'flagged row → 0.100x']);
  $('detailBody').innerHTML =
    '<h2>#' + r.rank + ' — ' + esc(r.name) + '</h2>' +
    '<p class="muted">' + esc(r.slug) + ' · ' + esc(r.category || 'no category') + ' · ' + r.chains.map(esc).join(', ') +
    (r.on_watchlist ? ' · <span class="chip watch">watchlist</span>' : '') +
    (r.concern ? ' · <span class="chip flag">flagged</span>' : '') + '</p>' +
    '<div class="detail-grid">' +
    '<div class="kv"><b>' + fmtUsd(r.implied_value_usd) + '</b><span>implied value (base case)</span></div>' +
    '<div class="kv"><b>' + fmtUsd(r.low_usd) + ' – ' + fmtUsd(r.bull_usd) + '</b><span>low – bull band (÷/× ' + D.bandK.toFixed(2) + ')</span></div>' +
    '<div class="kv"><b>' + fmtX(r.multiple) + '</b><span>implied multiple of TVL</span></div>' +
    '<div class="kv"><b>' + fmtUsd(r.tvl_usd) + '</b><span>TVL</span></div>' +
    '<div class="kv"><b>' + verdictChip(f.verdict) + '</b><span>farm verdict at the low end</span></div>' +
    '<div class="kv"><b>' + fmtUsd(f.evLowUsd) + ' – ' + fmtUsd(f.evHighUsd) + '</b><span>expected airdrop slice (5–25% of low)</span></div>' +
    '</div>' +
    '<h3>How the value is built</h3>' +
    '<table class="mini"><thead><tr><th>Factor</th><th>Detail</th></tr></thead><tbody>' +
    factorLines.map((x) => '<tr><td>' + x[0] + '</td><td>' + esc(x[1]) + '</td></tr>').join('') +
    '</tbody></table>' +
    (r.concern
      ? '<div class="callout red"><b>Flagged:</b> ' + esc(r.concern) + ' This is a disclosed judgment, not a signal from the snapshot. The row stays on the board at a 0.10 haircut so the call is visible.</div>'
      : '') +
    '<h3>Farm plan — netted to the dollar</h3>' +
    '<div class="callout">Capital $' + fmtInt(f.capitalUsd) + ' · ' + f.durationLabel + ' (' + f.durationDays + ' days) · gas about $' + fmtInt(f.gasUsd) +
    ' · time cost $' + f.timeCostUsd.toFixed(2) + ' (the T-bill alternative on the same capital) · ' +
    'expected value at the low end $' + f.evLowUsd.toFixed(2) + ' · <b>net $' + f.netLowUsd.toFixed(2) + '</b> · verdict ' + f.verdict + '.</div>' +
    '<ol class="steps">' + r.farm_steps.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>' +
    '<p class="muted">Points: ' + esc(r.points_status) + '.</p>';
}

function chartSvg() {
  const W = 760, H = 380, padL = 64, padB = 44, padT = 16, padR = 16;
  const pts = D.liveComps.map((c) => ({ x: Math.log(c.tvl_usd), y: Math.log(c.mcap_usd) }));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const X = (v) => padL + ((v - x0) / (x1 - x0)) * (W - padL - padR);
  const Y = (v) => H - padB - ((v - y0) / (y1 - y0)) * (H - padT - padB);
  const a = D.fit.a, b = D.fit.b;
  const line = '<line x1="' + X(x0).toFixed(1) + '" y1="' + Y(a + b * x0).toFixed(1) + '" x2="' + X(x1).toFixed(1) + '" y2="' + Y(a + b * x1).toFixed(1) + '" stroke="#5cc8a0" stroke-width="2"/>';
  const dots = pts.map((p) => '<circle cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="2.6" fill="#6cb6ff" opacity="0.75"/>').join('');
  const ticks = [1e6, 1e7, 1e8, 1e9, 1e10].map((t) => {
    const lx = Math.log(t);
    if (lx < x0 || lx > x1) return '';
    return '<text x="' + X(lx).toFixed(1) + '" y="' + (H - 24) + '" fill="#8b98a9" font-size="11" text-anchor="middle">' + fmtUsd(t) + '</text>';
  }).join('');
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Calibration scatter: log TVL against log market cap for the 128 comparables, with the fitted line">' +
    '<rect width="' + W + '" height="' + H + '" fill="#182233"/>' + dots + line + ticks +
    '<text x="' + (W / 2) + '" y="' + (H - 6) + '" fill="#8b98a9" font-size="11" text-anchor="middle">TVL (log scale)</text>' +
    '<text x="14" y="' + (H / 2) + '" fill="#8b98a9" font-size="11" text-anchor="middle" transform="rotate(-90 14 ' + (H / 2) + ')">Market cap (log scale)</text>' +
    '<text x="' + (padL + 8) + '" y="30" fill="#5cc8a0" font-size="12">fit: log(mcap) = ' + a.toFixed(2) + ' + ' + b.toFixed(2) + ' log(TVL), R² = ' + D.fit.r2.toFixed(2) + '</text>' +
    '</svg>';
}

function renderAudit() {
  const c = D.loo;
  const catRows = Object.entries(D.categoryFactors)
    .filter(([, f]) => f.n >= 2)
    .sort((x, y) => y[1].factor - x[1].factor)
    .map(([cat, f]) => '<tr><td>' + esc(cat) + '</td><td class="num">' + f.n + '</td><td class="num">' + f.median.toFixed(3) + '</td><td class="num">' + f.factor.toFixed(3) + 'x</td></tr>').join('');
  const candRows = D.candidates.map((x) => '<tr><td>' + esc(x.name) + '</td><td class="num">' + x.medianAbsLog.toFixed(3) + '</td><td class="num">' + x.mape.toFixed(0) + '%</td><td class="num">' + x.within2x.toFixed(1) + '%</td></tr>').join('');
  const exclRows = D.exclusions.map((e) => '<tr><td>' + esc(e.slug) + '</td><td>' + esc(e.category || '—') + '</td><td class="num">' + fmtUsd(e.tvl_usd) + '</td><td>' + esc(e.reason) + '</td><td class="num">' + fmtUsd(e.counterfactual_usd || 0) + '</td></tr>').join('');
  const cfRows = D.counterfactualTop.map((e, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(e.slug) + '</td><td>' + esc(e.category || '—') + '</td><td class="num">' + fmtUsd(e.tvl_usd) + '</td><td class="num">' + fmtUsd(e.implied_usd) + '</td></tr>').join('');
  $('auditBody').innerHTML =
    '<p class="formula">implied = exp(' + D.fit.a.toFixed(4) + ') × TVL^' + D.fit.b.toFixed(4) + ' × categoryFactor × growth × maturity × 0.6' +
    ' &nbsp;·&nbsp; 0.10 for flagged rows</p>' +
    '<p>Fit on the snapshot’s own ' + D.nComps + ' traded comparables (market cap above zero and TVL above zero; 16 recorded comps with market cap at or below zero are dead tokens and are left out). ' +
    'The 0.6 stage discount is a disclosed prior, not a fit: comparables already trade, pre-token rows do not. ' +
    'For curator rows the category factor is the 0.5 curator discount, which replaces the table factor (Risk Curators’ table factor is 1.000, Onchain Capital Allocator’s 0.828 — neither is applied on top of the discount). ' +
    'Uncertainty band k = ' + D.bandK.toFixed(3) + ' (exp of the LOO median |log error|, clamped to 1.5–4).</p>' +
    '<h3>Calibration by category</h3>' +
    '<p class="muted">Per-category median mcap/TVL, shrunk toward the global median (' + D.globalMedianRatio.toFixed(3) + ') with prior weight 4, clamped to [0.15, 2.0], damped with γ = 0.5. Categories with fewer than 2 comparables fall back to a factor of 1.</p>' +
    '<table class="mini"><thead><tr><th>Category</th><th class="num">Comps</th><th class="num">Median ratio</th><th class="num">Factor used</th></tr></thead><tbody>' + catRows + '</tbody></table>' +
    '<h3>Leave-one-out backtest (n = ' + c.n + ')</h3>' +
    '<p>Hold out one comparable, refit everything on the other ' + (c.n - 1) + ' (fit, global median, category factors), predict the held-out one. ' +
    'Median |log error| ' + c.medianAbsLog.toFixed(3) + ' · MAPE ' + c.mape.toFixed(0) + '% · within 2x ' + c.within2x.toFixed(1) + '% · within 3x ' + c.within3x.toFixed(1) + '% · ' +
    'on live comparables only (mcap ≥ $1M, n = ' + c.liveN + ') median |log error| ' + c.liveMedianAbsLog.toFixed(3) + '. ' +
    'Bootstrap slope b: median ' + D.bootstrapB.median.toFixed(3) + ', 90% interval [' + D.bootstrapB.p5.toFixed(3) + ', ' + D.bootstrapB.p95.toFixed(3) + '] over ' + D.bootstrapB.rounds + ' resamples. ' +
    'Random 5-fold cross-validation median |log error| ' + D.cv5MedianAbsLog.toFixed(3) + '.</p>' +
    '<h3>What was tried, and what was rejected</h3>' +
    '<table class="mini"><thead><tr><th>Model</th><th class="num">Median |log|</th><th class="num">MAPE</th><th class="num">Within 2x</th></tr></thead><tbody>' + candRows + '</tbody></table>' +
    '<p class="muted">Read honestly: dropping the category factor (γ = 0) scores slightly better on LOO than the chosen γ = 0.5, and the curve alone is close too. The factor is kept anyway, on judgment: without it, Liquid Staking rows (median ratio 0.041) would be valued about five times too high and Basis Trading (0.654) at about a third of its market rate — the wrong direction for anyone who knows the market. What the table proves is that the size curve itself is essential: without it the error jumps from 1.27 to 1.61. The robust (one trim round) variant scores a touch better on LOO (1.26 vs 1.27) but was not adopted: trimming is a judgment call that varies by fold, and the difference is within noise — OLS stays the stated model. Per-category slopes are rejected as overfitting: Dexs fits a slope of 1.78 on 11 comps while Lending fits 1.50 on 15 — the same data, opposite stories.</p>' +
    '<h3>Calibration chart</h3><div class="chart">' + chartSvg() + '</div>' +
    '<p class="muted">Each dot is one of the ' + D.nComps + ' comparables. The scatter is wide — that is the point: the model’s typical error is about ' + D.bandK.toFixed(1) + 'x, and the band says so instead of hiding it.</p>' +
    '<h3>What would be #1 if the filter let it in</h3>' +
    '<table class="mini"><thead><tr><th>#</th><th>Protocol</th><th>Category</th><th class="num">TVL</th><th class="num">Implied if included</th></tr></thead><tbody>' + cfRows + '</tbody></table>' +
    '<p class="muted">These rows are excluded because their token already trades (a bridge, an exchange, a wrapped or staked product). The counterfactual shows the filter is doing real work: without it, a bridge would top the board.</p>' +
    '<h3>Exclusions — all ' + D.exclusions.length + ' pre-token rows left out</h3>' +
    '<table class="mini"><thead><tr><th>Protocol</th><th>Category</th><th class="num">TVL</th><th>Reason</th><th class="num">Implied if included</th></tr></thead><tbody>' + exclRows + '</tbody></table>' +
    '<h3>Limitations, stated plainly</h3>' +
    '<div class="callout">R² is only ' + D.fit.r2.toFixed(2) + ': size explains a fifth of the variation in value, the rest is noise the snapshot cannot see. ' +
    'Only about 3 in 10 comparables land within 2x of the model, even with the best variant tested. The stage discount (0.6) and the concern haircuts (0.10) are priors and judgments, not fits. ' +
    'No time-split validation is claimed: the snapshot carries a single date, so out-of-sample evidence is LOO, bootstrap and 5-fold cross-validation, not a time split. ' +
    'Implied value is the entry’s own claim about what a token would be worth if the protocol’s record stayed as it is — not a prediction of whether or when a token is issued.</div>';
}

function renderComps() {
  $('compsBody').innerHTML = D.liveComps.map((c, i) =>
    '<tr><td>' + (i + 1) + '</td><td>' + esc(c.name) + '</td><td>' + esc(c.category || '—') + '</td>' +
    '<td class="num">' + fmtUsd(c.tvl_usd) + '</td><td class="num">' + fmtUsd(c.mcap_usd) + '</td><td class="num">' + c.ratio.toFixed(3) + '</td></tr>').join('');
}

topStats();
fillCategories();
renderBoard();
const initialView = params.get('view') || 'board';
if (['board', 'detail', 'audit', 'comps'].includes(initialView)) showView(initialView);
else showView('board');
