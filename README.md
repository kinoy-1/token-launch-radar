# Token Radar

The best token launch radar: a web dashboard that tracks the pre-token
protocols most worth farming, ranked by the implied value of the token each
one might one day issue — with a concrete farm plan for every protocol.

## What it is

A protocol's launch is the token it may issue one day. This radar reads a
sealed snapshot of the protocol universe (758 DefiLlama protocols at or above
$5,000,000 of TVL, fetched 2026-11-14) and answers, for each one: what would
its token be worth if the protocol's record stayed as it is, and what should
a reader do to farm it before it issues one.

The board ranks **225 pre-token protocols** — the 40 on the snapshot's
watchlist and 185 more below the floor that the radar exists to find. A
separate Live view shows the protocols whose token already trades, for
comparison only; they are never ranked.

## The model (radar-2)

Every row is scored by the same function, from the snapshot's figures alone.
No protocol name is special-cased.

```
implied = TVL × 0.30 × growth × maturity × chains
  growth   = 1 + clamp(7d change, −50, +100) / 100 × 0.75
  maturity = 0.55 + 0.45 × min(age in days, 1095) / 1095
  chains   = 1 + 0.03 × min(extra chains, 5)
```

A token's fully diluted value usually tracks the value locked in its
protocol, so TVL is the anchor. A protocol whose TVL is growing is winning
users right now, so growth lifts the value — and the weight is deliberately
strong (0.75) so the board is not a plain TVL table. A protocol that has run
one to three years with no token has proved it can keep users without one, so
age lifts it toward a full multiple. A protocol on several chains has more
places to issue and more users to reach, so each extra chain adds a little.

A protocol is ranked only when it records no token **and** is not a wrapped,
staked or bridged product of a token that already trades: its category is not
Bridge, Canonical Bridge, CEX or Restaked BTC, its name carries no whole word
wrapped, staked or staking, it does not begin with an exchange's name, and it
does not end in a version marker. WBTC, Binance staked ETH and USDT0 are
never ranked — each is a product of a token that already trades, not a
protocol waiting on a launch of its own.

Implied value is this entry's own claim, never a prediction that a token
will be issued or when.

## The dashboard

`dashboard/` is a static page with no framework and no network. It renders:

- **The board** — all 225 ranked protocols, sortable by rank, TVL, 7-day
  growth, age or name; filterable by search, category, chain, and
  watchlist/early/all. Each row shows rank, protocol, category, chains, TVL,
  7-day change, age, and implied value.
- **A detail view for every protocol** — click a row (or open
  `#&lt;slug&gt;`) for its model breakdown (the exact arithmetic behind its
  implied value) and its seven-step farm plan, each step with what it costs
  and how long it takes.
- **A top-10 chart** of implied values.
- **A live-token view** — the 24 largest protocols whose token already
  trades, shown with their market caps for comparison.
- **The model** — the formula and its reasoning, stated in full on the page.

Hash routes: `#&lt;slug&gt;` opens a protocol, `#watchlist` shows the
watchlist only, `#category=&lt;name&gt;` filters to one category.

## Farm plans

Each protocol gets seven steps, derived from its own record (category,
chains, TVL, age): a fresh wallet, the category's main action with a capital
amount, a second qualifying action, a weekly action, a hold period, how to
claim only from the protocol's own page, and a farm log. Every step states
its cost and its time.

## How to run it

Node 22 or later, standard library only; nothing is installed.

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
```

It reads the snapshot, writes `board.json` (the ranked board) and `data.js`
(the dashboard's data) into the output directory, copies `dashboard/` and
`screenshots/` there, and writes `dossier.json` with the vendored make.fun
library. The program is deterministic: two runs write the same bytes.

## Files

| File | What it is |
| --- | --- |
| `main.ts` | The entrypoint: reads the snapshot, writes the board, data, dashboard, screenshots and dossier. |
| `lib/model.ts` | The value model, the farm plans, the snapshot parser and the board validator. |
| `vendor/makefun-board.ts` | The kit's dossier library, byte for byte the scorer's own copy. |
| `dashboard/` | The static page: `index.html`, `app.css`, `app.js`. No network, no framework. |
| `screenshots/` | The three screenshots: the board, a protocol's detail view, a filtered view (1440×900 each). |

## Data

The snapshot is DefiLlama's public protocol data
(`https://api.llama.fi/protocols`), fetched once by the competition house and
frozen: `as_of` 2026-11-14, floor $50,000,000, 758 protocols, 40 on the
watchlist. The entry reads it; it does not move under the entry and is not
updated. The dashboard states the data's source and date on its face.

## make.fun

An entry for the **token-radar-01** bounty on make.fun
("Build the best token launch radar"). First place $1,000; the rewards total
$1,325. The entry's program is `main.ts`; the repository is public and
carries an MIT license.
