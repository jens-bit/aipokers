# Owner Wallet + Agent Pockets — WALLET-1

Spec: v11 §7.1. Design shapes: `design-refs/mood-wallet.jsx` (port, never redesign).
Storage: `docs/SQLITE_DESIGN.md` is the parent note; this one adds two record
types to it.

## The model

Two balances, not one.

- **Owner wallet** — the player's money. Buys items, slots and cosmetics, and
  funds agents. One per owner.
- **Agent pocket** — the roll he actually plays with, sized by the owner. One
  per agent.

Pocket size sets the stakes he sits at. That is the whole wager mechanic:
**the pocket IS the bet**, so there is no betting menu anywhere. Backer and
horse. Everything is play money and every ledger entry carries a unique id, so
tokenising later stays a bolt-on rather than a rearchitecture (§7.1).

Winnings stay in the pocket until the owner collects. Collecting is a recap
beat, not a reward burst — the motion is pocket → wallet.

## Funding modes

Four, matching `MODE` in the design ref. The brief listed three; `cut` is the
fourth because the design ref draws it as a first-class state and §7.1 calls
cutting an agent off "a legitimate move". Leaving it out would mean the UI has
a mode the server cannot store.

| mode | on deploy | when the pocket empties |
|---|---|---|
| `topup` | plays from the pocket | stops. One-time money; owner decides again. |
| `allowance` | plays from the pocket | stops. The cap is a budget, not a refill trigger. |
| `auto` | plays from the pocket | refills from the wallet up to `cap`, if the wallet has it. |
| `cut` | never deploys | stays at the bar. Nothing is lost — attributes, reads and grudges all keep. |

`cap` means the allowance ceiling for `allowance` and the refill target for
`auto`. It is `null` for `topup` and `cut`.

## The stakes ladder

Three rungs. Buy-in is 100 big blinds, matching the existing deploy gate.

| rung | blinds | buy-in | label |
|---|---|---|---|
| 0 | 10 / 20 | 2 000 | `$10/$20` |
| 1 | 25 / 50 | 5 000 | `$25/$50` |
| 2 | 50 / 100 | 10 000 | `$50/$100` |

**An agent plays the highest rung whose buy-in his pocket covers.** Below rung
0's buy-in he is **broke**: presence `'broke'`, and he rests at the bar.

A table's blinds come from the seated agents' pockets, and stay at the lowest
rung any seated agent could afford:

- A **new** table is created at the deploying agent's rung.
- An agent may **join** an existing table only when his rung is ≥ that table's
  rung — i.e. he can cover its buy-in. A table therefore never drifts above the
  rung its founder could afford, and nobody is ever priced out of a seat he is
  already in.

This is enforced entirely in `agentProfiles.js` at deploy time —
`tableRegistry.getOrCreateTable(id, { smallBlind, bigBlind })` already takes
blinds, so `src/server/table.js` is untouched.

## Storage

Added to the schema in `src/server/store.js`.

### `wallets`

| column | type | note |
|---|---|---|
| `owner_id` | TEXT PRIMARY KEY | |
| `balance` | INTEGER | chips, never negative |
| `ledger` | TEXT | JSON, append-only, capped at 100 entries |
| `updated_at` | INTEGER | |

### pockets

The pocket lives **inside the agent record** (`agent.pocket`), for the reason
the parent note gives for `sessionFlagged`: it is only ever read through its
agent, and it rides the existing agent save seam so `saveProfile` stays the one
writer.

One field is lifted out to a column because a query genuinely reads it:

```sql
ALTER TABLE agents ADD COLUMN pocket_balance INTEGER NOT NULL DEFAULT 0;
```

`GET /api/wallet` reports `staked` — the total across an owner's pockets — as
`SELECT SUM(pocket_balance)`, not by loading and walking every agent record.
As with the other lifted columns it is written from `data` and never read back
into it.

### Ledgers

Both ledgers are append-only, capped at 100 entries, newest last, and every
entry carries a `id` (uuid), `ts`, `type` and `amount`.

- wallet: `seed`, `fund`, `collect`, `refill`
- pocket: `seed`, `fund`, `refill`, `buyin`, `cashout`, `collect`

`fund` and `refill` are wallet → pocket; `collect` is pocket → wallet. Both
sides of every transfer are written in the same call, so the two ledgers
reconcile against each other.

## The seeding rule (SEED-1)

The migration must not create or destroy a single chip, and it must not change
how long an existing agent can keep playing.

For each owner, for each agent, in one transaction:

```
pocket.balance = min(max(0, agent.bankroll), POCKET_FLOAT)      // POCKET_FLOAT = 2 000
wallet.balance = Σ (max(0, agent.bankroll) − pocket.balance)
pocket.mode    = 'auto'
pocket.cap     = POCKET_FLOAT
```

**Invariant:** `wallet.balance + Σ pocket.balance === Σ max(0, agent.bankroll)`
— asserted in `wallet.test.js` against a fixture in today's data shape.

Two decisions worth defending:

1. **The float is one buy-in at the entry rung (2 000).** Every migrated agent
   can sit down immediately, at the same 10/20 the default blinds already gave
   him. The surplus goes to the wallet, which is what makes the owner's first
   funding decision possible at all — a wallet seeded at zero would leave the
   owner unable to fund anyone.

2. **Mode defaults to `auto` with `cap = POCKET_FLOAT`.** This is the mode that
   *reproduces today's behaviour exactly.* Today an agent with a 10 000
   bankroll re-buys until it is gone; after the migration he holds 2 000 and
   pulls another 2 000 from the wallet each time he busts, until the wallet is
   dry — the same total runway, the same number of buy-ins, just visible. Any
   other default would silently stop agents who are playing today, and a
   migration that changes behaviour is a migration people cannot trust.

Agents with no `bankroll` field (created before BNK-1) contribute 0 and get an
empty pocket; `ensureBankroll` backfills them on next load, and
`ensurePocket` then seeds a pocket from that. Nothing is lost, nothing is minted.

The migration is idempotent via a `meta` stamp (`migrated_wallets_at`), the
same mechanism the JSON import uses.

## `agent.bankroll` during the transition

`agent.bankroll` is **mirrored to `pocket.balance` on every write, for one
release.** Old clients and `scripts/verify-chips.js` keep reading a field that
still means "the chips this agent can play with" — which is exactly what the
pocket is. The wallet is the part they cannot see, which is why
`verify-chips.js` gains a wallet-aware conservation check rather than being
left to assert against half the money.

Remove the mirror once no client reads `careerStats.bankroll`.

## Chip conservation

The invariant `scripts/verify-wallet.js` asserts, offline, over the whole store:

```
Σ wallet.balance
+ Σ pocket.balance
+ Σ chips sitting at live tables (buy-ins debited but not yet cashed out)
== Σ everything ever granted or seeded
```

Buy-ins leave the pocket on deploy and return as `cashout` at session end, so
between those two points the chips are "at the table" and are accounted for by
the open `buyin` entries in the pocket ledger.

## Deliberately out of scope

- **Items.** §7.1 says items are bought from the wallet, never a pocket. No
  item exists yet; the wallet ledger has room for the entry type and nothing
  spends from it.
- **Live wagers.** §7.1 explicitly pushes coin wagers on outcomes to §13 and
  leans prediction-first. Nothing here opens that path.
- **Real money.** Play chips only, as everywhere else in this product.
