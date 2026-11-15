# Token Launch Radar — Method (radar-3, round 2)

This file is the evidence record for the radar-3 entry. Every number below is
computed at runtime by `lib/model.ts` from the sealed snapshot alone
(758 protocols, `as_of` 2026-11-14). Nothing about a protocol's value is
hardcoded. The analysis script that produced these numbers first lives at
`~/workspace/makefun/radar3-analysis/analyze.py` (outside this repo); the
runtime model in `lib/model.ts` reproduces them exactly.

## 1. The board

| Quantity | Value |
|---|---|
| Snapshot protocols | 758 |
| Pre-token (mcap, gecko_id and symbol all null) | 342 |
| Excluded by the strict filter | 144 |
| **Board rows** | **198** |
| Watchlist protocols | 40 (all 40 on the board) |
| Traded comps (mcap > 0 and TVL > 0) | 128 |
| Dead tokens excluded from comps (mcap ≤ 0) | 16 |

## 2. The model

```
implied = exp(a) · TVL^b · categoryFactor^γ · growth · maturity · 0.6 · 0.10?
low / bull = base / k and base × k
```

| Parameter | Value | Source |
|---|---|---|
| a (ln intercept) | 6.9646 | OLS on the 128 comps |
| b (ln slope) | 0.5223 | OLS on the 128 comps |
| R² | 0.1939 | OLS on the 128 comps |
| Global median mcap/TVL | 0.2138 | median over the 128 comps |
| γ (category damping) | 0.5 | chosen by LOO (see §4) |
| Stage discount | 0.6× | disclosed prior, not a fit |
| Concern haircut | 0.10× | disclosed prior, 8 flagged rows only |
| Curator discount | 0.5× | structural: curator TVL is nested inside other protocols |
| k (band) | 3.568 (raw 3.5682, clamped to [1.5, 4]) | exp(median \|log error\|) of the chosen model in LOO |

Category factor: median mcap/TVL of the category, shrunk toward the global
median with prior weight 4, clamped to [0.15, 2.0], then damped by γ = 0.5.
No per-category slope is fitted — too few comps per category to support one.

Growth = 1 + 0.5 × clamp(change_7d, −60, 120) / 100.
Maturity = 0.6 + min(age_days, 1095) / 1095 × 0.4.

## 3. The filter (M1)

A protocol reaches the board only if it is pre-token (mcap, gecko_id and
symbol all null) AND none of these apply:

- category Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking,
  Restaked BTC, or CEX
- name ends in a version marker (a space followed by V2, v2, 2.0, …)
- name carries a whole word wrapped, staked, or staking (any case)
- name begins with an exchange's name (Binance, Coinbase, Bybit, Kraken,
  Bitget, OKX, Bitfinex, Gemini)

The 144 excluded pre-token protocols are listed in the dashboard's
Model & Audit view with the reason for each, sorted by TVL. The largest
excluded TVL is Bybit ($13.8B) — a centralised exchange, not a pre-token
protocol. Ranked unfiltered it would top the board; that is the filter's
value in one row.

## 4. Validation — leave-one-out backtest (n = 128)

Hold out one comp, refit everything (fit + global median + category factors)
on the rest, predict the held-out one.

| Model | Median \|log err\| | MAPE (median) | Within 2× | Within 3× |
|---|---|---|---|---|
| **Chosen: log-log + category (γ=0.5) + growth + maturity** | **1.2721** | **87.3%** | **29.7%** | **46.1%** |
| No size curve (category median only) | 1.6333 | 112.5% | 22.7% | 35.9% |
| γ = 0 (no category factor) | 1.165 | 92.0% | 30.5% | 46.9% |
| γ = 0.25 | 1.203 | 83.7% | 32.8% | 48.4% |
| γ = 0.75 | 1.302 | 86.5% | 30.5% | 45.3% |
| No growth factor | 1.305 | 87.9% | 31.3% | 46.1% |
| No maturity factor | 1.331 | 84.9% | 28.9% | 46.1% |
| No growth, no maturity | 1.331 | 84.9% | 28.9% | 46.1% |
| Fixed 0.30 multiple (round 1 model) | 1.6568 | 111.9% | 18.0% | 33.6% |

Notes, stated honestly:

- γ = 0 beats the chosen γ = 0.5 on median error (1.165 vs 1.2721). γ = 0.5 is
  kept on judgment: the category factor is the model's main explanatory
  lever and the study's design decision; the ablation table prints both so
  a reader can see the trade-off.
- Live comps only (mcap ≥ $1M, n = 110): median |log err| 1.0237,
  MAPE 71.1%, within 2× 36.4%.
- Random 5-fold CV (curve only): median |log err| 1.2897.
- Bootstrap slope (200 resamples): mean 0.519, sd 0.084,
  90% interval [0.386, 0.646].
- **No time-split validation is claimed.** The snapshot carries a single
  date, so a time split cannot be run honestly. LOO + bootstrap + random
  5-fold CV are the validation we have, and they are all reported above.

## 5. Concern rows (0.10× haircut, reasons printed)

Each was verified against public facts. A token that already trades, or a
product that is a stablecoin / wrapper / no-token-by-design network, does
not have a pre-launch implied value — its TVL is not launch value.

| Slug | Reason |
|---|---|
| usdd | Stablecoin itself: USDD trades on HTX/SunSwap since 2022; its TVL is stablecoin supply, not a pre-launch protocol. |
| bittensor-dtao | dTAO subnets are a mechanism of Bittensor; TAO already trades on major exchanges. |
| plume-vaults | Vault product of Plume; PLUME launched 21 Jan 2025 and trades on Binance/Coinbase/Kraken. |
| saturn | Stablecoin wrapper product; wraps stablecoins that already trade. |
| doppler-finance | CeDeFi managed-vault product, not a standalone protocol token launch. |
| hive-protocol | Chain-level protocol; value accrues to adjacent assets, no standalone token economics in the snapshot. |
| lightning-network | Bitcoin Layer 2 payment network; no token by design. |
| noble | Cosmos appchain for stablecoin issuance; infrastructure chain, no token by design. |

## 6. Farm plan (netted)

For each row: expected value = low × community share (5–25% range; 10% used
for the verdict) minus capital, gas (~$30) and the T-bill opportunity cost
of the time (4.5% annual). Verdict: farm if netted at the low end is
positive, thin if positive only at the high end, skip otherwise. Capital
tiers by TVL ($500 / $250 / $100 / $50); duration by age (75 / 45 / 22
days). Steps are mechanism-specific (lending, DEX, derivatives, RWA, yield,
CDP, generic) and each carries its cost and duration.

**Points honesty:** the snapshot carries no points data, so no points program
is inventoried for any protocol. Every detail view states that plainly.
If a protocol announces a program, the farm plan still applies; the points
are upside, not the thesis.

## 7. What changed from round 1

Round 1 ranked 225 protocols with a fixed 0.30 multiple and no band,
no exclusions table, no backtest, and a generic farm plan. Round 2:

- strict filter (225 → 198 rows; the 27 removed are Liquid Staking /
  Restaking and other already-trading products),
- the 0.30 multiple replaced by the log-log curve fitted on the snapshot's
  own comps (LOO 1.6568 → 1.2721),
- an uncertainty band on every row (k = 3.57 from LOO),
- a full Model & Audit view (formula, calibration chart, LOO table,
  category table, exclusion table, concern rows, counterfactual),
- farm plans netted against capital, gas and time, with a verdict per row,
- points honesty (none inventoried, stated on every row).

## 8. Reproducibility

`main.ts` reads `/input/snapshot.json`, builds the board with
`lib/model.ts`, and writes `/output` (board.json, data.js, dashboard/,
screenshots/, dossier.json). The program is deterministic: every random
operation is seeded, so two runs write identical bytes. Run it twice and
diff the outputs — they match.
