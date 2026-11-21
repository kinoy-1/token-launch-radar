# Token Launch Radar — method (round 4)

Snapshot as of **2026-11-14**: 758 protocols. Every number below comes from
the run that produced this board (`node main.ts --input snapshot.json`),
which is deterministic — run it twice and the bytes are identical.

## The model

```
implied  = exp(6.9646) × TVL^0.5223 × categoryFactor × growth × maturity
           × 0.10 for flagged rows
expected = implied × P(list)
low  = expected / 3.568        bull = expected × 3.568
```

The board ranks by **expected value**, not by implied value. Implied is
what a token would be worth if it launched; expected is that value times
the fitted odds it ever records a token. A protocol that has run five
years with no token is not the same bet as one that appeared five weeks
ago — the old flat 0.6 stage discount could not tell them apart, so it
is retired in this round and replaced by the odds model below.

The size curve is fitted on the snapshot's own traded comparables:
144 protocols record a market cap; 16 of them sit at or below zero
(dead tokens) and are left out, leaving **n = 128**.
`log(mcap) = 6.9646 + 0.5223·log(TVL)`, **R² = 0.1939**.
Global median mcap/TVL is **0.2138** — the anchor everything is
shrunk toward.

- **Category factor.** Per-category median mcap/TVL, shrunk toward the
  global median with prior weight 4, clamped to [0.15, 2.0], damped with
  γ = 0.5. Basis Trading 1.414, Dexs 1.200, RWA 1.094, Lending 0.836,
  Liquid Staking 0.663. Categories with fewer than 2 comparables fall
  back to 1.0 — so Prediction Market's median of 400.204 (one comp,
  Polymarket) is neutralised rather than applied.
- **Growth.** `(1 + 0.5·clamp(change_7d, −60, 120)/100)`.
- **Maturity.** `0.6 + min(age_days, 1095)/1095·0.4` — a protocol that
  has run three years without a token is worth more than one that
  appeared last week, but only up to 1.0.
- **Curator discount 0.5.** Risk Curators and Onchain Capital
  Allocators hold other protocols' TVL; their size is nested, so the
  curve overstates them. For curator rows this 0.5 IS the category
  factor — it replaces the table factor, it is not applied on top of it.
  Applied in the backtest too.
- **Concern haircut 0.10.** Eight rows are flagged (below) and stay
  on the board at a tenth of the model's value so the call is visible.

## Listing odds — P(records a token)

A logistic model fitted on all 758 protocols, label "records a token"
(mcap, gecko_id or symbol present; base rate 54.9%). Features,
standardised: age in years, log10 TVL, 7-day change clamped to
[−60, +120]%, and the category listing rate (leave-one-out — the row
itself is left out of its own category's rate). The change is clamped
because one row's TVL is up 4,448% in a week, and an unclamped feature
would let that single row steer the fit.

The model is tested, not asserted: 5-fold cross-validated AUC (the
odds table on the audit view), with an age-only model on the same folds
for comparison, plus a calibration table (predicted odds against the
actual share that records a token, out of fold). The odds say
"records", never "has": DefiLlama's record is not proof, so a protocol
can record a token it never launched for farming, and a launch can
arrive for a row the model rates low.

## Backtests — held out twice

**Leave-one-out, n = 128.** Hold out one comparable, refit everything
on the other 127, predict the held-out one. Median |log error| **1.2721**,
MAPE **806.6%**, within 2x **29.7%**, within 3x **46.1%**; on live
comparables only (mcap ≥ $1M, n = 110) median |log error| **1.0261**.
The band factor k = 3.568 is exp(1.2721), clamped to [1.5, 4].
Bootstrap slope b (200 resamples, seed 20261114): median **0.5185**,
90% interval **[0.397, 0.653]**. Random 5-fold cross-validation
(seed 777): median |log error| **1.1558**.

**Walk-forward by first-tracked date.** The snapshot carries one
as-of date, but listed_at is the day DefiLlama began tracking each
protocol — a time axis. The curve is fitted on comparables first
tracked before the cutoff and tested on those first tracked after it,
expanding window, three cutoffs (the fold table is on the audit view).
A model that only fits the past it trained on fails this test; this
one holds up — the walk-forward medians sit at or below the LOO median.

**Rank ranges.** 200 bootstrap refits of the size curve (seed 20261121),
odds held fixed: each board row carries the 10th–90th percentile of its
rank across refits, shown on the detail view. A row whose range spans
fifty places is a guess; a row whose range spans five is a call.

What was tried, and what was rejected (LOO median |log|):

| Model | Median |log| | MAPE | Within 2x |
|---|---:|---:|---:|
| Chosen: curve + category (γ=0.5) + growth + maturity | 1.2721 | 807% | 29.7% |
| No size curve: median ratio + category | 1.6071 | 1183% | 22.7% |
| γ=0: curve, no category factor | 1.1650 | 704% | 33.6% |
| γ=0.2 | 1.1946 | 749% | 28.9% |
| γ=0.25 | 1.2028 | 749% | 28.9% |
| γ=0.75 | 1.3021 | 880% | 28.9% |
| No growth factor | 1.3049 | 848% | 31.2% |
| No maturity factor | 1.3305 | 1094% | 32.0% |
| Curve only: no category, growth or maturity | 1.2234 | 986% | 32.0% |
| Per-category slope (n≥5, else global) | 1.4078 | 3125% | 24.2% |
| Robust fit (one trim round, 2x median residual) | 1.2596 | 921% | 32.0% |
| Multi-feature: log(TVL) + log(age) + change, + category | 1.3607 | 1325% | 32.0% |

Read honestly: γ=0 scores slightly better than the chosen γ=0.5, but
a paired check shows the edge is outlier-driven, not systematic —
γ=0 wins 46 of 128 folds, loses 54, median paired difference 0.0000.
Within noise, the factor is kept on judgment — without it, Liquid
Staking (median ratio 0.041) would be valued about five times too high
and Basis Trading (0.654) at about a third of its market rate. The
size curve itself is essential: without it the error jumps from 1.27
to 1.61. The multi-feature regression scores worse than the curve
alone — age and change add noise, not signal, once size is in. The
robust variant is a touch better (1.26 vs 1.27) but was not adopted:
trimming varies by fold and the difference is within noise.
Per-category slopes overfit (Dexs 1.78 on 11 comps vs Lending 1.50
on 15).

## The board

Strict filter → **198 rows**. All 40 watchlist protocols are on it.
Top 10 by expected value: polymarket-international, bitfi-basis,
symbiotic, cian-yield-layer, veda, opentrade, onre,
defi-saver-asset-management, steakhouse-financial, lofty. The old
implied-value order put steakhouse-financial ($35.6M implied) at #1;
the odds model moves it to #9 (odds 0.33 — an old protocol whose
record says a token rarely comes), and sentora-curator and gauntlet
(odds 0.17–0.19) fall out of the top 10 entirely. Polymarket rises
to #1 (odds 0.72) and bitfi-basis to #2 (odds 0.68). That reorder is
the round: the same curve, a fitted discount instead of a flat one.

**The ledger — all 758 accounted for.** The launch board holds 198
pre-token protocols. The other 560 are on the ledger view, each with
its disposition: 144 pre-token rows left off the board (CEX 42, Liquid
Staking 38, Bridge 28, Canonical Bridge 15, versioned name 11,
wrapped/staked name 5, Liquid Restaking 3, Restaked BTC 2), each with
its reason and its counterfactual value; 272 rows that record a token
but carry no market cap in the snapshot; 128 rows whose token already
trades, with their market cap; 16 dead tokens (market cap at or below
zero). What would be #1 if the filter let it in: coinbase-bridge
$101.3M, bybit $90.1M, binance-bitcoin $84.9M, bitfinex $83.0M,
wbtc $74.7M, usdt0 $73.7M, binance-staked-eth $55.9M, bitget $55.7M
— bridges and exchanges, not launches. The filter is doing real work.

**Flagged rows (8):** usdd (USDD is a dollar-pegged stablecoin),
bittensor-dtao (TAO trades), plume-vaults (PLUME launched January
2025), hive-protocol (HIVE trades since 2020), saturn (USDAT is a
dollar-pegged stablecoin backed by tokenized Treasuries),
lightning-network (Bitcoin's Lightning Network, no token), doppler-finance
(XDP trades; TGE September 2026, listed on KuCoin, OKX and Kraken),
noble (issues USDC natively on Cosmos). Each reason was checked
against the live web on 2026-11-19; each is a disclosed judgment,
not a signal from the snapshot.

## Farm plan — netted to the dollar

Capital by TVL: $500 / $250 / $100 / $50. Duration by age: 75 / 45 /
21 days. Gas $12 + $3 per extra chain. Time cost is the T-bill
alternative (4.5% a year) on the same capital. Expected airdrop slice:
5% / 15% / 25% of the expected low end — the low end is already
odds-weighted, so the slice is what a farmer can expect, not what a
launch would pay. Net = low-end expected value − capital − gas −
time cost. Every plan is a mechanism-specific 5-step sequence plus a
verdict step, each step carrying its cost or duration. The Farm next
view ranks the twenty best plans by expected net per dollar of capital.

Verdicts: farm 132, thin 58, skip 8. The low-end net alone says "farm" for
nearly every row — implied values are hundreds of thousands of dollars
against tens of dollars of cost — so the verdict also prices what the
net cannot see. Flagged rows are skip: their token already trades or
their product is a stablecoin, so there is no future launch to farm.
Curator rows are thin: their TVL is nested inside other protocols, so
any future distribution is shared with the underlying protocols' own
farmers (52 of the 58 thin verdicts are curators). Otherwise thin means
the low-end net is under $10,000 — six non-curator rows land there (the
smallest net is $1,113); the smallest farm net is $13,555. No points program is inventoried anywhere in this
snapshot, so every plan states that plainly instead of inventing one.

## Limitations, stated plainly

R² is only 0.19: size explains a fifth of the variation in value, the
rest is noise the snapshot cannot see. Only about 3 in 10 comparables
land within 2x of the model, even with the best variant tested. The
concern haircuts (0.10) are priors and judgments, not fits. The odds
model predicts whether a protocol records a token, not whether or when
it issues one. Walk-forward here is by first-tracked date, not a true
time split of launches. Expected value is this entry's own claim about
what a token would be worth, times how likely the record says it is to
exist — not a prediction of whether or when a token is issued.
