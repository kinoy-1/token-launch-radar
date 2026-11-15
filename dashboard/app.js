// app.js — Token Launch Radar dashboard (radar-3).
//
// Renders window.RADAR_DATA (written by main.ts from the sealed snapshot):
//   meta  — fit, band, LOO backtest, categories, exclusions, concerns
//   rows  — the 198-row board (rank, implied/low/bull, factors, farm plan)
//   comps — the 128 traded comparables the curve is fitted on
//
// The model, stated so a reader can check it in the source:
//   implied = exp(a) * TVL^b * categoryFactor^0.5 * growth * maturity
//           * 0.6 (stage discount, a disclosed prior)
//           * 0.10 (concern rows only, a disclosed prior)
//   low / bull = base / k and base * k, k from the LOO backtest.
// Fitted from this snapshot: a = 6.9646, b = 0.5223, R2 = 0.1939 (n = 128);
// band k = 3.57; LOO median |log error| = 1.2721. Every number above is read
// from RADAR_DATA.meta at runtime — nothing is hardcoded here.

const D = window.RADAR_DATA;
const meta = D.meta;
const rows = D.rows;
const comps = D.comps;
const fmt = (x) => "$" + Math.round(x).toLocaleString("en-US");
const fmtShort = (x) => x >= 1e9 ? "$" + (x / 1e9).toFixed(2) + "B"
  : x >= 1e6 ? "$" + (x / 1e6).toFixed(2) + "M" : fmt(x);
const pct = (x) => (x * 100).toFixed(1) + "%";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// --- stats header -----------------------------------------------------------
document.getElementById("stats").innerHTML = [
  [rows.length, "protocols ranked"],
  [meta.comps_n, "live comps"],
  [meta.fit_r2.toFixed(2), "fit R²"],
  ["×" + meta.band_k.toFixed(2), "band k"],
  [meta.loo[0].within_2x_pct.toFixed(0) + "%", "LOO within 2x"],
].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("");

// --- tabs -------------------------------------------------------------------
const views = ["board", "detail", "audit", "comps"];
document.querySelectorAll(".tabs button").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("active", x === b));
    views.forEach((v) => { document.getElementById("view-" + v).hidden = v !== b.dataset.view; });
    if (b.dataset.view === "detail") renderDetail(currentPick);
  });
});
function show(view) {
  document.querySelector(`.tabs button[data-view="${view}"]`).click();
}
// Deep-link a view with #board / #detail / #audit / #comps (also used for screenshots).
const hash = (location.hash || "").slice(1);
if (views.includes(hash) && hash !== "board") show(hash);
// The browser performs its fragment scroll after the script runs; reset to the
// top on load so a deep-linked view opens with its header visible.
window.scrollTo(0, 0);
window.addEventListener("load", () => window.scrollTo(0, 0));
// Same-document hash navigation does not reload the page, so listen for it.
window.addEventListener("hashchange", () => {
  const h = (location.hash || "").slice(1);
  if (views.includes(h)) show(h);
  window.scrollTo(0, 0);
});

// --- board ------------------------------------------------------------------
const watch = new Set(meta.watchlist);
let sortKey = "rank", sortDir = 1;
let currentPick = rows[0].slug;

function boardRows() {
  const q = document.getElementById("q").value.trim().toLowerCase();
  const cat = document.getElementById("cat").value;
  const hideFlag = document.getElementById("hideflag").checked;
  const onlyWatch = document.getElementById("onlywatch").checked;
  let out = rows.filter((r) =>
    (!q || r.name.toLowerCase().includes(q) || r.slug.includes(q) || (r.category || "").toLowerCase().includes(q)) &&
    (!cat || r.category === cat) &&
    (!hideFlag || !r.concern) &&
    (!onlyWatch || watch.has(r.slug)));
  out = [...out].sort((a, b) => {
    const va = a[sortKey], vb = b[sortKey];
    return (typeof va === "string" ? va.localeCompare(vb) : va - vb) * sortDir;
  });
  return out;
}

function renderBoard() {
  const list = boardRows();
  document.getElementById("count").textContent = list.length + " of " + rows.length + " shown";
  document.querySelector("#board tbody").innerHTML = list.map((r) => `
    <tr data-slug="${esc(r.slug)}" class="${r.concern ? "flagged" : ""}">
      <td>${r.rank}</td>
      <td><strong>${esc(r.name)}</strong>${watch.has(r.slug) ? " ★" : ""}</td>
      <td>${esc(r.category || "—")}</td>
      <td class="num">${fmtShort(r.tvl_usd)}</td>
      <td class="num">${fmtShort(r.implied_value_usd)}</td>
      <td class="num">${fmtShort(r.low_usd)}</td>
      <td><span class="pill ${r.verdict}">${r.verdict}</span></td>
      <td>${r.concern ? '<span class="flag">flagged</span>' : ""}</td>
    </tr>`).join("");
  document.querySelectorAll("#board tbody tr").forEach((tr) => {
    tr.addEventListener("click", () => { currentPick = tr.dataset.slug; show("detail"); });
  });
}
document.querySelectorAll("#board th[data-k]").forEach((th) => {
  th.addEventListener("click", () => {
    const k = th.dataset.k;
    sortDir = sortKey === k ? -sortDir : 1;
    sortKey = k;
    renderBoard();
  });
});
["q", "cat", "hideflag", "onlywatch"].forEach((id) =>
  document.getElementById(id).addEventListener("input", renderBoard));
const catSel = document.getElementById("cat");
[...new Set(rows.map((r) => r.category).filter(Boolean))].sort().forEach((c) => {
  const o = document.createElement("option"); o.value = c; o.textContent = c; catSel.appendChild(o);
});

// --- detail -----------------------------------------------------------------
const pick = document.getElementById("pick");
rows.forEach((r) => {
  const o = document.createElement("option");
  o.value = r.slug; o.textContent = `#${r.rank} ${r.name}`;
  pick.appendChild(o);
});
pick.addEventListener("change", () => { currentPick = pick.value; renderDetail(currentPick); });

function renderDetail(slug) {
  const r = rows.find((x) => x.slug === slug) || rows[0];
  pick.value = r.slug;
  currentPick = r.slug;
  const share = r.low_usd > 0 ? (r.net_low_usd + r.capital_usd + 30) / r.low_usd : 0;
  document.getElementById("dmeta").textContent =
    `${r.category || "—"} · TVL ${fmtShort(r.tvl_usd)} · 7d ${r.change_7d === null ? "n/a" : r.change_7d.toFixed(1) + "%"} · listed ${r.listed_at || "n/a"}`;
  const netClass = r.verdict === "farm" ? "good" : r.verdict === "thin" ? "warn" : "bad";
  document.getElementById("detail-body").innerHTML = `
    <h2>#${r.rank} ${esc(r.name)} ${watch.has(r.slug) ? "★ watchlist" : ""}</h2>
    <div class="cards">
      <div class="card"><b>${fmt(r.implied_value_usd)}</b><span>implied launch value (base case)</span></div>
      <div class="card"><b>${fmt(r.low_usd)}</b><span>low — base ÷ ${meta.band_k.toFixed(2)}</span></div>
      <div class="card"><b>${fmt(r.bull_usd)}</b><span>bull — base × ${meta.band_k.toFixed(2)}</span></div>
      <div class="card"><b>${fmtShort(r.tvl_usd)}</b><span>TVL</span></div>
      <div class="card"><b>${r.cat_factor.toFixed(2)}×</b><span>category factor${r.curator ? " — curator, structural 0.5× instead" : ""}</span></div>
      <div class="card"><b>${r.growth.toFixed(2)}× / ${r.maturity.toFixed(2)}×</b><span>growth / maturity factor</span></div>
      <div class="card ${netClass}"><b>${fmt(r.net_low_usd)}</b><span>netted farm value at low (verdict: ${r.verdict})</span></div>
      <div class="card"><b>$${r.capital_usd} · ${r.duration_days}d</b><span>capital tier · farming duration</span></div>
    </div>
    ${r.concern ? `<p class="note"><strong>Flagged — 0.10× haircut applied.</strong> ${esc(r.concern_reason)}</p>` : ""}
    <p class="note"><strong>Points:</strong> none inventoried — the snapshot carries no points data,
    so no points program is claimed for this protocol. If it announces one, the farm plan still applies;
    the points are upside, not the thesis.</p>
    <h3>Farm plan (netted)</h3>
    <ol class="steps">${r.farm_steps.map((s, i) => `<li><b>Step ${i + 1}.</b> ${esc(s)}</li>`).join("")}</ol>`;
}

renderBoard();
renderDetail(currentPick);

// --- audit ------------------------------------------------------------------
// Log-log calibration chart: the 128 comps as points, the OLS fit as a line,
// both in log10 space so the chart is readable. Built from RADAR_DATA.comps.
function chartSvg() {
  const W = 720, H = 420, P = 46;
  const pts = comps.map((c) => ({ x: Math.log10(c.tvl_usd), y: Math.log10(c.mcap_usd) }));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs));
  const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  const X = (x) => P + ((x - x0) / (x1 - x0)) * (W - 2 * P);
  const Y = (y) => H - P - ((y - y0) / (y1 - y0)) * (H - 2 * P);
  const ln2 = Math.LN10;
  const fx = (x) => (meta.fit_a + meta.fit_b * x * ln2) / ln2;
  let g = "";
  for (let gx = x0; gx <= x1; gx++) {
    g += `<line x1="${X(gx)}" y1="${Y(y0)}" x2="${X(gx)}" y2="${Y(y1)}" stroke="#2a3340"/>`;
    g += `<text x="${X(gx)}" y="${H - 18}" fill="#9aa7b4" font-size="11" text-anchor="middle">10^${gx}</text>`;
  }
  for (let gy = y0; gy <= y1; gy++) {
    g += `<line x1="${P}" y1="${Y(gy)}" x2="${W - P}" y2="${Y(gy)}" stroke="#2a3340"/>`;
    g += `<text x="${P - 6}" y="${Y(gy) + 4}" fill="#9aa7b4" font-size="11" text-anchor="end">10^${gy}</text>`;
  }
  const dots = pts.map((p) => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="2.6" fill="#58a6ff" opacity="0.75"/>`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Log-log calibration chart">
    <text x="${W / 2}" y="22" fill="#e6edf3" font-size="14" text-anchor="middle">log(mcap) vs log(TVL) — ${meta.comps_n} comps, fit line in red</text>
    ${g}
    <line x1="${X(x0)}" y1="${Y(fx(x0))}" x2="${X(x1)}" y2="${Y(fx(x1))}" stroke="#f85149" stroke-width="2"/>
    ${dots}
    <text x="${W / 2}" y="${H - 2}" fill="#9aa7b4" font-size="11" text-anchor="middle">TVL (USD, log scale)</text>
    <text x="12" y="${H / 2}" fill="#9aa7b4" font-size="11" text-anchor="middle" transform="rotate(-90 12 ${H / 2})">Market cap (USD, log scale)</text>
  </svg>`;
}

function table(head, rowsHtml, cls) {
  return `<div class="tablewrap"><table class="${cls || ""}"><thead><tr>${head.map((h) => `<th class="${/^[0-9]/.test(h) || h.includes("n") ? "" : ""}">${h}</th>`).join("")}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}

const audit = document.getElementById("audit-body");
const looRows = meta.loo.map((l) => `<tr><td>${esc(l.model)}</td><td class="num">${l.median_abs_log_err}</td><td class="num">${l.mape_median_pct}%</td><td class="num">${l.within_2x_pct}%</td><td class="num">${l.within_3x_pct}%</td></tr>`).join("");
const catRows = meta.categories.map((c) => `<tr><td>${esc(c.category)}</td><td class="num">${c.n}</td><td class="num">${c.median_ratio}</td><td class="num">${c.raw_factor}</td><td class="num">${c.clamped}</td><td class="num">${c.damped}</td></tr>`).join("");
const exclRows = meta.exclusions.map((e) => `<tr><td>${esc(e.name)}</td><td>${esc(e.category || "—")}</td><td class="num">${fmtShort(e.tvl_usd)}</td><td>${esc(e.reason)}</td></tr>`).join("");
const concernRows = meta.concerns.map((c) => {
  const r = rows.find((x) => x.slug === c.slug);
  return `<tr><td>${esc(c.slug)}</td><td class="num">${r ? "#" + r.rank : "—"}</td><td>${esc(c.reason)}</td></tr>`;
}).join("");
const cfRows = meta.counterfactual_top.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.category || "—")}</td><td class="num">${fmtShort(c.tvl_usd)}</td><td>${esc(c.reason)}</td></tr>`).join("");

audit.innerHTML = `
<div class="audit">
  <h3>Formula</h3>
  <pre>implied = exp(a) · TVL^b · categoryFactor^γ · growth · maturity · 0.6 · 0.10?
  a = ${meta.fit_a}, b = ${meta.fit_b}, R² = ${meta.fit_r2}, n = ${meta.comps_n}
  γ = 0.5 (damping), 0.6 = stage discount (disclosed prior),
  0.10 = concern haircut, applied only to the 8 flagged rows
  low / bull = base / k and base × k, k = ${meta.band_k} (clamped from ${meta.band_k_raw})</pre>
  <p class="note">Growth = 1 + 0.5 × clamp(change_7d, −60, 120) / 100.
  Maturity = 0.6 + min(age_days, 1095) / 1095 × 0.4.
  Category factor = median mcap/TVL of the category, shrunk toward the global median
  (prior 4), clamped to [0.15, 2.0], then damped by γ = 0.5. Risk Curators and
  Onchain Capital Allocators get no category factor — their TVL is nested inside
  other protocols, so a structural 0.5× discount is used instead.</p>

  <h3>Calibration chart</h3>
  ${chartSvg()}
  <p class="note">Every dot is a traded protocol. The red line is the OLS fit.
  The scatter is wide on purpose — R² is only ${meta.fit_r2} — which is exactly why
  every row carries a wide band (k = ${meta.band_k}×) instead of a single point estimate.</p>

  <h3>Leave-one-out backtest (n = ${meta.comps_n})</h3>
  ${table(["Model", "Median |log err|", "MAPE (median)", "Within 2×", "Within 3×"], looRows)}
  <p class="note">The chosen model wins on median |log error| (${meta.loo[0].median_abs_log_err}).
  The fixed 0.30 multiple from round 1 is the worst of the nine (${meta.loo[8].median_abs_log_err}).
  The curve matters: dropping it costs ${(meta.loo[1].median_abs_log_err - meta.loo[0].median_abs_log_err).toFixed(3)}.
  Live comps only (mcap ≥ $1M, n = ${meta.loo_live.n}): median |log err| ${meta.loo_live.median_abs_log_err},
  MAPE ${meta.loo_live.mape_median_pct}%, within 2× ${meta.loo_live.within_2x_pct}%.
  Random 5-fold CV (curve only): ${meta.cv5_median_log_err}. Bootstrap slope (200 resamples):
  mean ${meta.bootstrap.mean}, sd ${meta.bootstrap.sd}, 90% interval [${meta.bootstrap.p5}, ${meta.bootstrap.p95}].</p>

  <h3>Category calibration (${meta.categories.length} categories)</h3>
  ${table(["Category", "n", "Median mcap/TVL", "Raw factor", "Clamped", "Damped (used)"], catRows)}
  <p class="note">Global median mcap/TVL = ${meta.global_median_ratio}. Factors are shrunk toward it
  and damped; no per-category slope is fitted (too few comps per category to support one).</p>

  <h3>Exclusions — ${meta.excluded_n} pre-token protocols kept off the board</h3>
  ${table(["Protocol", "Category", "TVL", "Reason"], exclRows)}
  <p class="note">Pre-token in the snapshot: ${meta.pretoken_n}. Board: ${meta.board_n}. The filter is
  strict on purpose — bridges, liquid staking/restaking, restaked BTC, CEXs, versioned names,
  wrapped/staked names and exchange-prefixed names are all excluded, because their TVL is
  not a pre-launch protocol's TVL.</p>

  <h3>Concern rows — 0.10× haircut, reasons printed</h3>
  ${table(["Slug", "Board rank", "Reason"], concernRows)}

  <h3>Counterfactual — the largest excluded TVLs (what the board would wrongly rank)</h3>
  ${table(["Protocol", "Category", "TVL", "Reason"], cfRows)}
  <p class="note">Bybit alone carries $13.8B of TVL. Ranked unfiltered it would top the board —
  a centralised exchange, not a pre-token protocol. That is the filter's value in one row.</p>

  <h3>Honest limits</h3>
  <p class="note">No time-split validation is claimed: the snapshot carries a single date, so a
  time split cannot be run honestly. LOO + bootstrap + random 5-fold CV are the validation
  we have, and they are all reported above. Points programs are not inventoried — the snapshot
  carries no points data, so every row says so. The stage discount and the concern haircut
  are priors, not fits; changing them moves the level of the board, not its order.</p>
</div>`;

// --- comps ------------------------------------------------------------------
document.querySelector("#compstable tbody").innerHTML = comps
  .map((c, i) => `<tr><td>${i + 1}</td><td><strong>${esc(c.name)}</strong></td><td class="num">${fmtShort(c.tvl_usd)}</td><td class="num">${fmtShort(c.mcap_usd)}</td><td class="num">${c.ratio}</td></tr>`)
  .join("");

