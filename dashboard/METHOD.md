# Token Launch Radar — method

Snapshot as of **2026-11-14**: 758 protocols. Every number below comes from
the run that produced this board (`node main.ts --input snapshot.json`),
which is deterministic — run it twice and the bytes are identical.

## The model

```
implied = exp(6.9646) × TVL^0.5223 × categoryFactor × growth × maturity × 0.6
          × 0.10 for flagged rows
low  = implied / 3.568        bull = implied × 3.568
```

The size curve is fitted on the snapshot's own traded comparables:
144 protocols have a market cap recorded; 16 of them sit at or below
zero (dead tokens) and are left out, leaving **n = 128**.
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
- **Stage discount 0.6.** A disclosed prior, not a fit: comparables
  already trade, pre-token rows do not.
- **Curator discount 0.5.** Risk Curators and Onchain Capital
  Allocators hold other protocols' TVL; their size is nested, so the
  curve overstates them. For curator rows this 0.5 IS the category
  factor — it replaces the table factor (Risk Curators' table factor
  is 1.000, Onchain Capital Allocator's 0.828), it is not applied on
  top of it. Applied in the backtest too.
- **Concern haircut 0.10.** Eight rows are flagged (below) and stay
  on the board at a tenth of the model's value so the call is visible.

## Backtest — leave-one-out, n = 128

Hold out one comparable, refit everything on the other 127, predict
the held-out one. Median |log error| **1.2721**, MAPE **806.6%**,
within 2x **29.7%**, within 3x **46.1%**; on live comparables only
(mcap ≥ $1M, n = 110) median |log error| **1.0261**. The band factor
k = 3.568 is exp(1.2721), clamped to [1.5, 4].

Bootstrap slope b (200 resamples, seed 20261114): median **0.5185**,
90% interval **[0.397, 0.653]**. Random 5-fold cross-validation
(seed 777): median |log error| **1.1558**.

What was tried, and what was rejected (LOO median |log|):

| Model | Median |log| | MAPE | Within 2x |
|---|---:|---:|---:|
| Chosen: curve + category (γ=0.5) + growth + maturity | 1.2721 | 807% | 29.7% |
| No size curve: median ratio + category | 1.6071 | 1183% | 22.7% |
| γ=0: curve, no category factor | 1.1650 | 704% | 33.6% |
| γ=0.25 | 1.2028 | 749% | 28.9% |
| γ=0.75 | 1.3021 | 880% | 28.9% |
| No growth factor | 1.3049 | 848% | 31.2% |
| No maturity factor | 1.3305 | 1094% | 32.0% |
| Curve only: no category, growth or maturity | 1.2234 | 986% | 32.0% |
| Per-category slope (n≥5, else global) | 1.4078 | 3125% | 24.2% |
| Robust fit (one trim round, 2x median residual) | 1.2596 | 921% | 32.0% |

Read honestly: γ=0 scores slightly better than the chosen γ=0.5, and
the curve alone is close too. The factor is kept on judgment — without
it, Liquid Staking (median ratio 0.041) would be valued about five
times too high and Basis Trading (0.654) at about a third of its
market rate. The size curve itself is essential: without it the error
jumps from 1.27 to 1.61. The robust variant is a touch better (1.26
vs 1.27) but was not adopted: trimming varies by fold and the
difference is within noise. Per-category slopes overfit (Dexs 1.78 on
11 comps vs Lending 1.50 on 15).

## The board

Strict filter → **198 rows**. All 40 watchlist protocols are on it.
Top 10: steakhouse-financial $21.3M, sentora-curator $20.5M,
polymarket-international $17.5M, gauntlet $16.6M, veda $16.0M,
bitfi-basis $16.0M, onre $14.7M, opentrade $14.1M, symbiotic $13.5M,
cian-yield-layer $13.4M. Bottom row is noble at $0.5M.

**Exclusions — 144 pre-token rows left out:** CEX 42, Liquid Staking
38, Bridge 28, Canonical Bridge 15, versioned name 11, wrapped/staked
name 5, Liquid Restaking 3, Restaked BTC 2. What would be #1 if the
filter let it in: coinbase-bridge $101.3M, bybit $90.1M,
binance-bitcoin $84.9M, bitfinex $83.0M, wbtc $74.7M, usdt0 $73.7M,
binance-staked-eth $55.9M, bitget $55.7M — bridges and exchanges, not
launches. The filter is doing real work.

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
5% / 15% / 25% of the low end. Net = low-end expected value − capital
− gas − time cost. Every plan is a mechanism-specific 5-step sequence
plus a verdict step, each step carrying its cost or duration.

Verdicts: **farm 138, thin 52, skip 8**. The low-end net alone says
"farm" for nearly every row — implied values are hundreds of thousands
of dollars against tens of dollars of cost — so the verdict also
prices what the net cannot see. Flagged rows are skip: their token
already trades or their product is a stablecoin, so there is no future
launch to farm. Curator rows are thin: their TVL is nested inside
other protocols, so any future distribution is shared with the
underlying protocols' own farmers. Otherwise thin means the low-end
net is under $10,000 — on this snapshot that bar fires for no
non-curator row (the smallest farm net is $17,834). No points program
is inventoried anywhere in this snapshot, so every plan states that
plainly instead of inventing one.

## Limitations, stated plainly

R² is only 0.19: size explains a fifth of the variation in value, the
rest is noise the snapshot cannot see. Only about 3 in 10 comparables
land within 2x of the model, even with the best variant tested. The
stage discount (0.6) and the concern haircuts (0.10) are priors and
judgments, not fits. No time-split validation is claimed: the snapshot
carries a single date, so out-of-sample evidence is LOO, bootstrap and
5-fold cross-validation, not a time split. Implied value is this
entry's own claim about what a token would be worth if the protocol's
record stayed as it is — not a prediction of whether or when a token
is issued.
