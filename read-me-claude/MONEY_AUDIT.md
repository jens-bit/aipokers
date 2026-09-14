# MONEY_AUDIT.md — where every chip comes from and goes

MONEY-1, job 1. Written 2026-09-14 on `fix/money-integrity`, branched from
`origin/main`. **Nothing is fixed here.** This is the trace Jens asked for after
playtesting prod: tables advertised at a 2,000 or 5,000 buy-in with agents
sitting behind ~30,000, nothing visibly leaving the safe when an agent buys in,
and a safe that intermittently refuses to be read.

Every claim below is a file and a line. Where a line number moves, the symbol
name is given so it can be found again.

---

## 0. The one-paragraph answer

There are **two different money systems in this repo and only one of them
conserves chips.** The owner economy — safe, pocket, ledger — is a genuine
double-entry system in `src/server/wallet.js`, and on its own it is sound. The
table is not part of it. A table stack is a **display number owned by the
table**, created when a seat is filled and destroyed when it empties, and the
two systems meet at exactly two points: `debitBuyIn` on deploy
(`agentProfiles.js:4316`) and `creditCashOut` at session end
(`agentProfiles.js:1505`). Because the table mints a fresh 100bb stack for
**every** seat it fills — including each replacement House regular it sits down
after the previous one busts — and because the owner is credited the **whole**
final stack, a winning session pays the pocket chips that were never debited
from anybody. That is the live leak, it is still running, and it is the reason
for the 30,000 stacks.

---

## 1. Where a table's buy-in and stakes are defined

**The ladder is one list.** `src/server/wallet.js:29-33`:

```
{ rung: 0, smallBlind: 10, bigBlind: 20,  buyIn: 2_000,  label: '$10/$20' }
{ rung: 1, smallBlind: 25, bigBlind: 50,  buyIn: 5_000,  label: '$25/$50' }
{ rung: 2, smallBlind: 50, bigBlind: 100, buyIn: 10_000, label: '$50/$100' }
```

- `BUYIN_BB = 100` (`wallet.js:26`) — a buy-in is 100 big blinds.
- `buyInFor(bigBlind)` (`wallet.js:174`) returns `bb * 100`.
- `stakesFor(pocketBalance)` (`wallet.js:155`) — the highest rung the pocket covers.
- `canAffordTable(pocketBalance, bigBlind)` (`wallet.js:169`).

**The rooms are derived from that same list**, not restated:
`src/server/rooms.js:47-57` maps `STAKES` onto `floor` / `upstairs` / `backroom`
and carries `stakes.buyIn` straight through to the lobby. So what the client
advertises as "2,000 buy-in" is `STAKES[0].buyIn`, and it is correct.

**The table's own idea of a buy-in is a second, parallel definition.**
`Table.defaultBuyIn()` (`table.js:628`) returns `this.bigBlind * 100`. It is
numerically identical to `buyInFor()` today, but it is computed from the table's
blinds rather than read from the ladder, and it is what every seat that does not
explicitly pass a `buyIn` gets. There are five such seats (§6.2).

**The home game has a third definition.** `HOME_BLINDS = {1, 2}` and
`HOME_BUYIN = 200` (`homeGame.js:57-63`). This one is documented as being on no
rung and in no room, with no pocket movement in either direction — see §6.5.

---

## 2. What actually funds an agent's stack when he sits down

**At the casino: the pocket — but only on the deploy path, and only after the
seat has already been taken. Everywhere else: nothing.**

### The deploy path (`deployAgent`, `agentProfiles.js:4061`)

Order of operations, as written:

| # | Line | What happens |
|---|------|--------------|
| 1 | `4143` | `walletFor(userId)` / `ensurePocket(agent)`; `admissionBefore` snapshot taken (`4148`) |
| 2 | `4160` | `mode === 'cut'` → 402, nothing moves |
| 3 | `4169` | `if (isBroke(pocket.balance)) autoRefill(wallet, pocket)` — safe to pocket |
| 4 | `4171` | still broke → 402, nothing moves |
| 5 | `4187` | `stakesForRequest(body, pocket.balance)` — refuses `cantAfford` (409) for an explicit rung |
| 6 | `4188-4212` | matchmaking picks a table; `canAffordTable` re-checked at `4206` |
| 7 | `4213` | `deployBuyIn = buyInFor(candidate.table.bigBlind)` or `stakes.buyIn` |
| 8 | `4218` / `4276` | **the seat is taken** — `joinAgentSession` / `startAgentSession` |
| 9 | `4299-4303` | `agent.activeTableId`, `status='playing'` written |
| 10 | `4316` | **`debitBuyIn(pocket, deployBuyIn, tableId)` — the debit, last** |
| 11 | `4317-4319` | `mirrorBankroll`, agent-ledger `buyin` line, `saveWalletFor` |
| 12 | `4321` | `saveStore(userId)` |

Three things about that order:

- **The debit is step 10 of 12, after the seat exists.** Steps 8 and 10 are
  separate. The only rollback in the function is the `catch` at `4268-4290`,
  which restores `admissionBefore` when `startAgentSession` *throws*. There is no
  rollback for the far likelier case: the seat succeeds and something after it
  fails.
- **The return value of `debitBuyIn` is discarded** (`4316`). `debitBuyIn`
  (`wallet.js:329`) refuses with `{ok:false, moved:0}` when the pocket does not
  cover the amount — and the caller never looks. Today the gates at steps 4-6
  make that unreachable on the deploy path, so this is a latent hole rather than
  the live leak; but it is a silent grant by construction, and it is exactly the
  shape job 3 names ("a buy-in larger than available funds is refused with a
  clear reason, never silently granted").
- **The stack the table gives him is not the number that was debited.** Neither
  `joinAgentSession` (`4218`) nor `startAgentSession` (`4276`) is passed a
  `buyIn`. Both fall through to `this.bigBlind * 100` (`table.js:930`,
  `table.js:999`). They agree with `deployBuyIn` arithmetically today, and by
  coincidence only — two independent expressions of one rule, with nothing
  asserting they match.

### The WATCH path (`table.js:addSpectator`, ~`1965-2029`)

`addSpectator` will **seat a new agent** at `table.js:2017` via `seatAI`, with no
`buyIn` argument and **no pocket involvement of any kind**.
`wsServer.js:288-330` guards it in production (`wsServer.js:296-299`: an owner
must already have `activeTableId === msg.tableId`), but the guard is skipped when
`TELEGRAM_BOT_TOKEN` is unset (`localDev`, `wsServer.js:293`). On such a
deployment WATCH is a free 100bb seat that later cashes out into the pocket.

### The home game

`homeGame.js:332` and `:347` pass `buyIn: HOME_BUYIN` explicitly. No pocket is
read or written. Deliberate — see §6.5.

### Visits

`visit.js:226` is the one place other than deploy that debits:
`debitBuyIn(guest.pocket, stake)` **and** `debitBuyIn(host.pocket, stake)`, both
inside `persist(record, () => …)`, and it **does** check `.ok`, throwing
`Visit stake unavailable` if either fails. This is the only seat-and-debit in the
codebase written as one unit. It is also the only one that is correct.

---

## 3. Is the debit atomic with the seating?

**No, on every axis.**

1. **Not atomic in time.** The seat is created at step 8 and the debit lands at
   step 10 (§2). Between them sit `noteSession` (`4296`), five field writes on
   the agent, and `roomIdForStakes`. A throw anywhere in that window leaves a
   seated agent whose pocket was never charged.
2. **Not atomic in storage.** `saveWalletFor(userId)` (`4319`) and
   `saveStore(userId)` (`4321`) are two calls. `saveStore` reaches
   `saveProfile(userId, profile, wallets.get(id))` (`agentProfiles.js:200`),
   which does write profile and wallet in one SQLite transaction — so the
   *second* of the two is transactional, which means the first is a redundant
   write, not a guarantee. Nothing wraps step 8's seat, because the seat is not
   in SQLite at all (§4).
3. **Not atomic against concurrency.** `deployAgent` is synchronous JS, so two
   deploys cannot interleave mid-function; but the idempotency guard at `4098` —
   `agent.activeTableId && liveTables?.hasTable?.(agent.activeTableId)` — is a
   read of mutable state with no lock and no seat reservation, and it is false
   for a stale `activeTableId` (§7).

---

## 4. What happens to the stack when he leaves, busts, or the table closes

There is **no persistence of a table stack anywhere.** Tables live in
`tableRegistry.js`'s in-memory Map; the `agents` table's `data` blob
(`store.js:85-95`) holds `activeTableId` but no stack. `seatStacks[]` is a plain
array on the Table instance — `table.js:1549` writes it at seat time,
`table.js:679` (`_captureStacks`) refreshes it from the engine between hands.

Three exits, two of which run the same ceremony:

**Bust or sit-out.** `_reconcileSeats` (`table.js:747`) runs between hands, finds
`seatStack(seat) <= 0` or `seatLeaving[seat]`, and calls `_retireSeat`
(`table.js:803`), which calls `finishAgentSession` (`table.js:832`) with
`finalStack` and `buyInAmount`, then `_clearSeat`.

**Table close.** `closeTable` (`table.js:1272`) loops every seat holding an
`agentId` (`table.js:1293-1330`) and calls `finishAgentSession` the same way.
Seats already retired have `agentIds[seat] === null`, so there is no
double-credit.

**Server restart.** Nothing runs. The process dies, the Map dies, `seatStacks`
dies. The agent record in SQLite still says `status: 'playing'` with an
`activeTableId` pointing at a table that no longer exists. The buy-in was
debited; the cash-out never happens. **Chips are destroyed on every restart —
one buy-in plus or minus the session's P&L, per seated agent.** On the next
deploy the `hasTable` guard at `4098` is false, so he is charged a second
buy-in for a second table. This is the only *destruction* path in the system and
it is also a double-charge path.

**Leave mid-hand.** The owner's "call him in" (`wallet.js:callIn`, `:263`) does
not pull chips off the table; it sets `pocket.recall = true` and asks the table
to sit the seat out *after* the hand (`benchCutSeat`, `wallet.js:375`). The sweep
runs later, on the next `GET /api/wallet` (`sweepRecalled`,
`agentProfiles.js:4573`). That part is correct, and is the one place the two
systems are deliberately decoupled with a flag rather than accidentally.

---

## 5. Where winnings are credited

**One place: `finishAgentSession`, `agentProfiles.js:1497-1531`.**

```js
const creditAmount = typeof finalStack === 'number' ? finalStack
  : typeof buyInAmount === 'number' ? buyInAmount + sessionPnl : sessionPnl;
creditCashOut(ensurePocket(agent), creditAmount, tableId ?? null);   // :1505
```

`creditCashOut` (`wallet.js:338`) adds `back` to `pocket.balance` and to
`pocket.realised`, and appends a `cashout` ledger line. **It takes no ceiling and
has no counterpart to check against.** Nothing anywhere asserts that
`Σ cashout ≤ Σ buyin + Σ (chips won from other owners)`.

`recordEarned(wallet, sessionPnl)` (`:1523`) also adds the positive half to the
owner's lifetime `earned`, which is what unlocks agent slots (`slots.js`).
Inflated stacks therefore inflate slot unlocks too.

Other credit paths:

- `visit.js:333-335` — `creditCashOut(pocket, pot)` where `pot = stakeAmount*2`,
  paid out of the two stakes debited at `visit.js:226`. Conserves: the pot is
  built from the two debits, and the wash case pays each side back its own
  `amount`. This one is right.
- `fridge.js:149` — `wallet.balance = count(wallet.balance) - cost`. A pure sink
  (buying drinks). Correct.
- The home game — **nothing.** `_retireSeat` (`table.js:815`) and `closeTable`
  (`table.js:1293`) both skip the ceremony when `this.home`. Home chips never
  reach a pocket.

---

## 6. Every place chips are created out of nothing

Ranked by how much they matter tonight.

### 6.1 A replacement House seat mints a full buy-in — THE LIVE LEAK

`_seatHouseRegulars` (`table.js:1136-1163`):

```js
this.seatAI({ …house, buyIn: this.defaultBuyIn(), … });   // table.js:1148
```

`seatAI` writes `this.seatStacks[free] = aiBuyIn` (`table.js:1549`). No pocket,
no wallet, no ledger — the House has no owner. That is fine in itself; the House
is scenery. What is not fine is **when it is called**:

- `_finishCompletedHand`, `table.js:2695`, whose own comment reads:
  > "An owned AI who just won the House's stack keeps his session and gets
  > another opponent"

  `this._seatHouseRegulars(MIN_TO_DEAL)` — i.e. **every time the hero busts his
  opponent, a fresh 100bb arrives on the felt.**
- `_noteLoneliness`'s repair, `table.js:1105`, the same call with
  `LONELY_SEATS = 3` (`table.js:176`).
- `joinAgentSession`'s "somebody arrived, is it enough" fill, `table.js:1035`.
- `startAgentSession`, `table.js:942` — the opening House, `buyIn: stack`.
- `scheduleHouseFallback` → `maybeAutoSeatAI`, `table.js:2241` — no `buyIn`, so
  `defaultBuyIn()`.

Now the arithmetic Jens saw. `SESSION_MAX_HANDS = 100` (`table.js:208`). At the
floor ($10/$20, 2,000 buy-in) a hero who busts the House fourteen times over a
hundred hands finishes with 2,000 + 14 × 2,000 = **30,000**, which is the number
in the playtest. At session end `finishAgentSession` credits all 30,000 to a
pocket that was debited 2,000 — **28,000 chips created** — and `recordEarned`
books 28,000 of lifetime earnings on top.

The symmetric destruction (a House stack vanishing when the table closes with the
House ahead) does not balance it, because a House that is ahead is never retired
mid-session: only a bust (`seatStack <= 0`) or a close retires it, and at a close
its chips simply cease to exist.

**A table stack is therefore a display number, not a balance** (`table.js:1549`,
`:679`; never persisted; created and destroyed with the seat) — but
`finishAgentSession` banks it as if it were a balance. That single mismatch is
the whole bug.

### 6.2 The seats that take a stack with no debit at all

| Call site | Seat | Debit |
|---|---|---|
| `table.js:942` | opening House in `startAgentSession` | none (unowned — fine) |
| `table.js:1148` | replacement House regulars | none (unowned — but see 6.1) |
| `table.js:2017` | **an owner's agent, via `addSpectator`/WATCH** | **none** |
| `table.js:2241` | `maybeAutoSeatAI` (JOIN with `wantAI`) | none |
| `table.js:1457` | `seatPlayer` — a human's own JOIN `buyIn` | none |

Row 3 is the one that leaks into the owner economy: that seat carries an
`agentId`, so `_retireSeat` / `closeTable` *will* credit its final stack to a
pocket that paid nothing. Reachable in prod only through the `localDev` branch of
the guard (`wsServer.js:293-299`); reachable in every keyless test and every
deployment without a bot token.

### 6.3 Deploy's unchecked debit

`agentProfiles.js:4316` discards `{ok:false}` (§2). Not currently reachable, but
it is a grant by omission with nothing asserting against it.

### 6.4 The starting grant — intended, and now bounded

`STARTING_GRANT = 10_000` (`agentProfiles.js:139`), paid at
`agentProfiles.js:658-666`: 2,000 into the pocket, 8,000 into the safe, gated on
`firstGrant` (`:652-655`), which requires `!w.startingGrantClaimed`, an empty
roster, a zero balance, no lifetime earnings and no prior `seed`/`grant` ledger
line. `w.startingGrantClaimed = true` is written unconditionally at `:656`. This
is BUG-136's fix and it holds: **the 10,000-per-draft loop is closed.**

`ensureBankroll` (`agentProfiles.js:785-792`) still writes
`agent.bankroll = STARTING_GRANT + net` and pushes a `grant` line for any agent
with no `bankroll` field. It only touches the legacy mirror, never
`pocket.balance`, and `mirrorBankroll` (`:801`) overwrites it from the pocket on
the next call — so it inflates the *old* ledger that a migration script would
read, not the safe. Noted so job 2's reconciliation does not mistake it for a
leak.

### 6.5 The home game — deliberate, isolated, and not the problem

`HOME_BUYIN = 200` chips per seat, from nowhere and back to nowhere
(`homeGame.js:50-56` says so in as many words). No room, no lobby, no ledger, no
session. `agent.bankroll` is mirrored from `pocket.balance`
(`agentProfiles.js:801`), never from a home stack. BUG-136's second half
(9294b28, "conserve household chips across draft and retirement") already handled
the draft/retire side of this.

### 6.6 `seedOwner` — migration only

`wallet.js:407-430`. Moves `agent.bankroll` into pocket + safe and creates
nothing (`swept = bankroll - keep`). Idempotent; skips any agent that already has
a pocket. Not a live path.

---

## 7. Stale seats, and why one agent can be at two tables

The idempotency guard is `agentProfiles.js:4098`:

```js
if (agent.activeTableId && liveTables?.hasTable?.(agent.activeTableId)) { … }
```

It asks whether a **table** exists, never whether **this agent is seated at it**.
Three ways that goes wrong:

1. **Stale record after a restart** (§4) — `hasTable` is false, so he is deployed
   again and debited again while the DB still says he is playing.
2. **Table alive, agent not in it.** If `_retireSeat` ran but
   `finishAgentSession` threw (it is wrapped in `try/catch` at `table.js:831` and
   `table.js:1329`, and a throw is swallowed with a `console.error`), the agent
   record keeps `activeTableId` and `status: 'playing'` while the seat is gone.
   `hasTable` is true, so deploy returns `alreadyPlaying: true` pointing at a
   table he is not at — and he can never be re-seated until that table closes.
3. **Four doors, one partial lock.** Seating happens through `joinAgentSession`
   (`table.js:977`), `startAgentSession` (`table.js:926`), `addSpectator`
   (`table.js:2017`) and `homeGame.js:332/347`. Only the first and third consult
   `seatsAgentOfOwner` (`table.js:624`), and that is a *per-owner, per-table*
   rule ("not two of my agents at one felt") — **not** the rule job 5 asks for
   ("this agent is not at any other table"). `matchmaking.js:149` checks
   `table.agentIds.includes(agentId)` for one candidate table only.

So there is no single place that knows "agent X is seated at table Y" other than
the agent record's own `activeTableId`, which is written *after* the seat (step 9
of §2) and cleared only by a ceremony that can throw.

The refusal message Jens quotes ("you can't play here") is **not in this repo** —
grepped across `src/` and `client/src/`; no such string. What exists is
`table.js:2008`, `throw new Error('another of your agents is already at this
table')`, surfaced through the WS error channel. That is a job-5 finding in
itself: the message cannot name where he already is, because the thrown error
does not carry it.

---

## 8. "Could not read your safe" — the read path

The string is client-side: `client/src/components/wallet/SafeSheet.jsx:80`
(`SafeReadStatus`). It renders whenever `walletStatus === 'error'`, which comes
from `useWallet` (`client/src/hooks/useWallet.js:27`):

```js
status: wallet ? 'ready' : 'error'
```

and `wallet` is whatever `fetchWallet()` returned. `fetchWallet`
(`client/src/lib/wallet.js:277-301`) returns **`null` for every failure mode,
without distinguishing any of them**:

- `!res.ok` → null (`:282`) — a 429, a 403, a 500 and a 404 are one thing
- a body whose `balance` is not a finite number → null (`:285-286`)
- any throw → null (`:298`)

Server side, `GET /api/wallet` is `agentProfiles.js:4600-4613`. Two candidates
for an *intermittent* failure, both of which have to be measured rather than
guessed (job 4):

1. **The `/api` rate limiter.** `src/index.js:55` —
   `rateLimiter({ windowMs: 60_000, max: RATE_LIMIT_MAX ?? 60 })`, keyed on IP
   across **every** `/api` route. `HOW_WE_WORK.md` already records this biting the
   browser smoke ("four browser tests burn that in one run, so the seed comes back
   429"). A Mini App polling agents/rooms/events/home alongside the wallet is
   exactly that shape, and behind Telegram's TLS terminator many users can share
   an apparent address.
2. **A write inside a GET.** The route calls `sweepRecalled` (`:4604`), which can
   call `saveStore` + `saveWalletFor` (`:4598-4599`) — a SQLite write during a
   read request. There is no try/catch around it in the route; a `SQLITE_BUSY` on
   a WAL database with a concurrent writer throws out of the handler.

Related, and the second half of job 4: **the safe's ledger does not carry every
money change the owner can see.** `walletProjection` (`wallet.js:435`) returns
`wallet.ledger.slice(-20).reverse()` — the **wallet's** ledger, which only ever
receives `fund`, `refill`, `collect`, `seed` and `item` entries (`wallet.js:205`,
`:246`, `:321`, `:424`, and the fridge route in `agentProfiles.js`). `buyin` and
`cashout` are written **only to the pocket's** ledger (`wallet.js:334`, `:341`).
So a buy-in and a win are invisible in the safe by construction — which is
precisely Jens's "nothing visibly leaves the safe when an agent buys in" and "the
way you earn money looks wrong".

---

## 9. Summary table

| Question | Answer |
|---|---|
| Where is a buy-in defined? | `wallet.js:29-33` (`STAKES`), surfaced by `rooms.js:47`. A second definition at `table.js:628` (`defaultBuyIn`). |
| What funds a stack? | Deploy: the pocket (`agentProfiles.js:4316`). WATCH-seating, House seats, JOIN-with-`wantAI`, home game: **nothing**. |
| Is the debit atomic with seating? | No — seat at `4218`/`4276`, debit at `4316`, two saves at `4319`/`4321`, no rollback for a post-seat failure, and `debitBuyIn`'s refusal discarded. |
| What happens on leave/bust/close? | `finishAgentSession` credits the whole `finalStack` to the pocket (`agentProfiles.js:1505`). |
| On restart? | Nothing. The stack is destroyed and the next deploy debits a second buy-in. |
| Where are winnings credited? | `creditCashOut`, `agentProfiles.js:1505`; plus `recordEarned` → slot unlocks at `:1523`. |
| Is a table stack a real balance? | **No — a display number owned by the Table instance** (`table.js:1549`, `:679`), never persisted, created and destroyed with the seat. But `finishAgentSession` banks it as though it were a balance. |
| Chips created from nothing | House refills (`table.js:1148`, called from `:2695` and `:1105`) — the live leak; WATCH-seating (`table.js:2017`); the unchecked deploy debit (`agentProfiles.js:4316`); the starting grant (intended, bounded since BUG-136); the home game (intended, isolated). |
| Chips destroyed | Server restart; table close with House chips on the felt; `fridge.js:149` (intended). |

---

## 10. What jobs 2-5 follow from this

- **Job 2** must count the *pockets and the safe*, not `agent.bankroll` — the
  mirror at `agentProfiles.js:801` makes the two identical today, but the mirror
  is documented as temporary. The reconciliation must also separate the BUG-136
  legacy (grants in an agent's own `ledger`) from the live House-refill leak,
  because only the second is still minting.
- **Job 3**'s "nothing else creates or destroys" means the House has to be funded
  from somewhere — a house bankroll is the honest shape, since the alternative
  (refusing to refill) ends every winning session at hand three.
- **Job 4**'s ledger requirement means the wallet ledger has to receive the
  `buyin` / `cashout` lines that currently only reach the pocket, or the safe
  view has to read both. `design-refs/mood-floor58.jsx`'s `SafeSheet` and
  `LedgerList` already render whatever entries they are handed.
- **Job 5** needs one authority for "where is this agent seated", because there
  are four doors into a seat and `activeTableId` is written after the seat is
  taken.

---

## 11. Job 2 — reconciling the live data

`scripts/audit-chips.js` (read-only; opens SQLite with `readonly: true,
fileMustExist: true` and never goes through `store.js`, whose `conn()` applies
the schema and imports `data/agents.json` on first use). Its pure half is tested
in `src/test/auditChips.test.js`.

```
node scripts/audit-chips.js --db path/to/app.db     # table per owner
node scripts/audit-chips.js --json                  # the same, machine-readable
```

Per owner it prints **safe**, **pockets**, **live** (stacks at running tables),
**total**, **ledger** (the signed sum of the wallet ledger *and* every pocket
ledger), and **diff** = (safe + pockets) − ledger. It also answers the
household-level question directly: how many `grant` entries the household holds,
which is BUG-136's fossil.

Two honest limits are printed with the numbers rather than buried:

- **`live` is null from a file.** Nothing persists a table stack (§4), so a cold
  read cannot see the felt. The script says how many agents *claim* to be seated
  and prices the unseen chips at one entry buy-in each. `auditChips()` is
  exported so an in-process caller can hand it the live registry and get the
  real number — which is what the measurement below does.
- **`diff` is meaningless on a capped ledger.** `LEDGER_CAP = 100`
  (`wallet.js:70`), so a long-lived pocket forgets its own beginning. The script
  flags `(ledger capped)` beside any owner it cannot vouch for and excludes
  them from its exit code.

### The measurement

Scratch database, three owners, one agent each, no API key (deterministic policy
play), `MAX_SEATS=2`, `SESSION_MAX_HANDS=200`. Three rounds of deploy → play →
close: **202 hands, 9 buy-ins.** Chips in existence = every safe + every pocket
+ every stack on a live felt + every **House** stack on a live felt, because
only with the House counted is the felt a closed system.

| moment | chips in existence |
|---|---|
| three owners drafted, nobody seated | 30,000 |
| three agents seated (3 buy-ins) | **36,000** |
| 70 hands in, still seated | 36,000 |
| every session settled | **26,585** |

**Chips are not conserved.** Two separate violations, visible in the two deltas:

1. **+6,000 the moment they sat down.** Three House seats appeared with 2,000
   each and nothing was debited for any of them (`startAgentSession`,
   `table.js:942`). The owner side is clean here — three pockets each went down
   exactly 2,000 — but the felt gained 6,000 from nowhere.
2. **−9,415 at settlement.** The three agents cashed out; the three House
   stacks ceased to exist. Net over the whole run: **−3,415 destroyed**, because
   in this particular run the agents lost to the House.

That sign is the giveaway. **The House is a faucet in both directions**: every
chip an owner wins off it is minted, every chip it wins off an owner is burned.
Jens's playtest saw the other sign of the same defect.

### The compounding half, demonstrated deterministically

The 202-hand run recorded **zero** House re-seats (`_seatHouseRegulars`), because
a heads-up session that ends at the hand cap rarely busts its opponent. Driven
directly, the mint is unambiguous — hero seated for 2,000 against a House seated
for 2,000, then busting it three times:

```
seated hero + house: 4000 chips on the felt (2 x 2,000)
hero busts the House : 4000 chips on the felt  <- conserved so far
a fresh House sits   : 6000 chips on the felt  <- 2000 minted
and again            : 8000 chips on the felt  <- 2000 minted
and again            : 10000 chips on the felt
hero's stack after three busted Houses: 8,000
```

He paid one 2,000 buy-in and has 8,000 in front of him; `finishAgentSession`
(`agentProfiles.js:1505`) credits all 8,000 to his pocket. **6,000 of that never
existed.** Repeat fourteen times over `SESSION_MAX_HANDS = 100` and the stack is
30,000, which is the number in the playtest.

### Legacy or live?

**Both, and they are separable.**

- **The BUG-136 draft loop is closed.** The gate at `agentProfiles.js:652-656`
  requires `!w.startingGrantClaimed`, an empty roster, a zero balance, no
  lifetime earnings and no prior `seed`/`grant` line, and the marker is written
  unconditionally. The simulation drafted three agents and every household took
  exactly one 10,000 grant; the audit's grant check found no owner with more than
  one. Inflated balances that predate the fix are fossils and stay fossils.
- **The House is a live leak and is still minting.** It is not legacy, it is not
  bounded, and it compounds with session length. Measured above at +6,000 on
  three seatings and +2,000 per busted opponent thereafter.

So the answer to the question job 2 asks: Jens's inflated prod balances are
**not only** BUG-136 residue. Whatever the draft loop left behind, the felt has
been adding to it every night since, one buy-in per House that sat down and one
more per House that busted.

### Not run against prod

Nothing in this job touched `46.62.169.246` or `data/app.db` in any checkout.
The measurement ran in a scratch cwd under the session scratchpad and its
database was discarded. `audit-chips.js` cannot write to a database even if
pointed at one, but it prints balances, so it should be run on a copy.

---

## 12. Job 3 — the fix

### The model

One new module, `src/server/houseBank.js`: **the casino's own chips**, a single
persisted integer in `meta` (not a wallet row — the house is not an owner and
would otherwise turn up in `listOwners()` and every loop that walks owners).

    A buy-in moves chips POCKET -> BANK.     The cage takes his money.
    A cash-out moves chips BANK  -> POCKET.  The cage pays him out.
    Everything on a felt is a CLAIM against the bank, not chips of its own.
    Therefore:  Σ safes + Σ pockets + bank  is constant, always.

Table stacks are deliberately outside that sum, and this is the one thing worth
reading twice. It is not a redefinition chosen to make the books balance — §6.1
found that a stack *already was* a display number rather than a holding. What
changed is that the number is now backed: while a man is seated, his chips are
inside the bank, and the stack is the claim. Adding `live` on top would count
them twice.

The consequence that matters: **the House needed no funding logic at all.** Its
stack is notional like every other, so `_seatHouseRegulars` is untouched — a
fresh regular still sits down with 100bb and the felt still refills. The
difference is at the rail: an agent who takes 6,000 off three busted Houses is
paid 6,000 **out of the bank**, and the bank is 6,000 lighter. The house lost
tonight, which is a thing that can happen and is now a number somebody can read.

`HOUSE_FLOAT` is 50,000,000 and is not a gate: `pay` is always honoured, and a
bank that went negative would log loudly rather than refuse to pay a winner. A
bank that could have a bad night and stop paying would be a worse bug than the
one it replaces.

### What changed, file by file

| Where | What |
|---|---|
| `src/server/houseBank.js` | new. `balance/take/pay/reset`, cached and written through. |
| `store.js:958` | `loadHouseBank` / `saveHouseBank` over the existing `meta` table. |
| `agentProfiles.js` `chargeSeatBuyIn` | **the rail in**. Debits the pocket, moves the chips to the bank, writes both ledgers, persists in one `saveProfile` transaction — and **refuses**, naming both numbers, where the old code discarded `debitBuyIn`'s result (§6.3). Exported, because there is more than one door into a seat. |
| `agentProfiles.js` `refundSeatBuyIn` | a stay that never happened, given back. Distinct from a cash-out: it must not read as a night. |
| `agentProfiles.js` `deployAgent` | the charge moved from step 10 of 12 to **before the seat**, and the charged figure is passed to `joinAgentSession` / `startAgentSession` as `buyIn` — so a stack at a table *is* the buy-in that paid for it, rather than a second independent computation of the same rule. A seat that fails after payment refunds. |
| `agentProfiles.js` `finishAgentSession` | **the rail out**. Pays from the bank, and only for an **open stay** — the pocket's own ledger holds a `buyin` for this table with no `cashout` after it. That check is what makes settlement idempotent. |
| `agentProfiles.js` `reconcileActiveSessions` | a restart now **voids** each stale stay: the buy-in comes back out of the bank. Not the stack — nobody knows what that was, and inventing it is the same mistake as minting a House seat. It is what a cardroom does with a game it cannot finish. |
| `agentProfiles.js` `POST /finish` | **stops orphaning the seat.** See below. |
| `table.js` `addSpectator` | the WATCH door pays like a door (§6.2, row 3). Already-admitted (his own deploy paid) and agentless fixture seats are distinguished from a genuine refusal. |
| `scripts/audit-chips.js` | `chipsInExistence` is now safes + pockets + bank, and the CLI reads the bank out of `meta`. |

### The double-payment nobody had found

`POST /api/agents/:id/finish` cleared `activeTableId` and set the agent idle
**while leaving him seated at a running table**. Two bugs in one line:

- **the money** — his buy-in stayed outstanding with nothing owning it, and when
  the table eventually closed the ceremony ran a second time and paid a second
  cash-out against one buy-in;
- **the seat** — the record said "not playing" while the felt said otherwise, so
  the very next deploy sat him at a *second* table. This is a direct cause of
  job 5's complaint, and it is a stale seat record rather than a missing lock.

It now asks the table to sit him out after the hand (`sitOutSeat`, the public
door, which keeps the promise the copy makes) and lets the real ceremony settle
him. `activeTableId` stays set until the table actually releases him.

### What the tests assert

`src/server/chipConservation.test.js`, twelve tests. Every one of them reads
`Σ safes + Σ pockets + bank` **out of SQLite** before an event and after it and
asserts equality — so what is checked is what is persisted, not what happens to
be in memory. The six the queue named, each with its own test:

| event | and what it proves |
|---|---|
| buy-in | the pocket falls by exactly what the bank gains, and the seat holds exactly that |
| bust | the house keeps what he lost; nothing is paid out |
| win | the house pays what he won; the bank is exactly that much lighter |
| leave mid-hand | he finishes the hand, then settles — conserving at both moments |
| table close | conserves whatever is in front of whom |
| server restart | the stay is **voided**: his buy-in comes back, not the 5,000 nobody can prove |

Plus: a refused buy-in moves nothing and seats nobody; `chargeSeatBuyIn` names
both numbers in its refusal; three busted Houses no longer mint; and a second
settlement for one buy-in pays nothing.

### Two notes for the deploy

1. **The first boot after this ships seeds the bank at 50,000,000 and logs it.**
   Agents who are mid-session at that moment have stacks the bank never took
   money for, so their cash-outs come out of the float. That is a one-time dip
   in the bank and is *correct* — those chips were already in their stacks. It
   creates nothing for any owner.
2. **The same boot refunds every stale stay.** Every agent whose record says
   `playing` at a table that no longer exists gets his buy-in back. Expect a
   run of `[wallet] voided …` lines once, and never again for the same stays.

### What this does NOT do

It does not recover the chips the old leak minted. Jens's inflated prod
balances stay inflated, exactly as BUG-136's did, and for the same reason: the
alternative is taking chips off people for a bug that was not theirs. What it
does is stop the number growing.

---

## 13. Job 4 — the safe stops lying

### The cause, measured rather than guessed

§8 listed two candidates. The probe (scratch cwd, the real middleware stack, one
wallet read a second for 90s with the app's own polling alongside) settled it:

```
wallet reads: 90, other /api calls: 54    (RATE_LIMIT_MAX=60)
  200: 64
  429: 26   body: {"error":"Too many requests"}

route threw: nothing
```

**It is a 429, every time, and the route never threw once.** The second
candidate — a SQLITE_BUSY out of the write inside the GET — did not fire in
90 seconds of traffic, but it is guarded anyway (below), because the cost of
being wrong about it is the same message.

Why it is *intermittent*, and why it is worse on prod than in that probe: the
limiter's key. `trust proxy` is deliberately not set on this app — `guest.js`
says so in as many words, and grew its own `clientIp()` to work around it — so
`req.ip` behind nginx is **the proxy's address for every user**.
`src/index.js:55`'s 60-a-minute `/api` cap was therefore 60 a minute **for the
whole site**, shared by everybody, across every route. A client that polls the
roster and the floor every 10 seconds and the home and the header every 30
spends 16 of those before the owner touches anything. Whether the safe read is
the one that gets refused depends on who else is using the app, which is exactly
the shape of "it errors often".

### The fix

1. **`clientIp` moved into `rateLimit.js` and became the default key.** Every
   limiter now counts per client rather than per site. `guest.js` re-exports it
   and keeps passing it explicitly. Note what this does to the CHAT limiter
   (10/min, the guard on model spend): it becomes ten a minute **per owner**
   instead of ten a minute across the site — which is the reading its own
   comment always described, and the site-wide bound on spend is
   `MAX_CONCURRENT_TABLES` and the meter, not this.
2. **The default budget is 180/min, up from 60.** Three a second sustained:
   still a real abuse guard, and far above anything the client does. `60` left
   under 4× headroom for a client whose idle traffic is already a quarter of it.
   `RATE_LIMIT_MAX` still overrides. The model-spend limiter is untouched.
3. **The wallet GET can no longer 500.** `sweepRecalled` is a *write* inside a
   *read*, and a write on a WAL database with a concurrent writer can throw. It
   is wrapped: the sweep is idempotent and the next read does it again, and the
   balance is what the owner asked for.

Re-probed with the fix: **90 reads, 90 × 200, zero failures.**
`src/server/rateLimit.test.js` (the module never had a test — which is how it
spent months counting the wrong thing) pins the behaviour, including that two
clients behind one proxy no longer share a budget.

### Every money change, on the record

§8's second half: the safe renders `walletProjection().ledger`, which was the
**wallet's** ledger and only that — `fund`, `refill`, `collect`, `seed`, `item`.
`buyin` and `cashout` are written to the **pocket's** ledger and to no other, so
the two events that move the most money in this product appeared on no screen.
That is Jens's "nothing visibly leaves the safe when an agent buys in", and it is
the same omission behind "the way you earn money looks wrong".

`walletProjection` now **merges** them, newest first, each line tagged with the
agent it belongs to so the sheet can print his name. It is a view and nothing
else:

- nothing is written anywhere;
- the stored wallet ledger still contains exactly the entries that explain the
  safe balance, which is the invariant `scripts/audit-chips.js` reconciles;
- only `buyin` and `cashout` are taken from the pockets — every other pocket
  entry is one half of a transfer whose other half is already on the wallet
  ledger, and drawing both would show one top-up as two events that cancel;
- the cap rose from 20 lines to 40, because a busy night of buy-ins would
  otherwise push every top-up off the end of the record within an hour.

`src/server/safeLedger.test.js` covers all of it, including that two reads leave
both ledgers byte-identical and that the wallet ledger still sums to the balance.

### One thing this could not finish: two lines of client vocabulary

`client/src/lib/safeLines.js` `ledgerLine()` has a case per entry type and a
`default: 'Adjustment'`. It knows the wallet's five and not the two the server
now sends, so a buy-in currently renders with **the right time and the right
amount under the label "Adjustment"** — better than invisible, and not finished.

This queue is server-only ("no client work in this tab"), so it is filed rather
than done. The whole change is two cases in that switch, beside the five already
there:

```js
case 'buyin':
  return who ? `${who} bought in` : 'Bought in at a table';
case 'cashout':
  return who ? `${who} cashed out` : 'Cashed out';
```

`tonightOf()` needs nothing: its three lines are about the safe (brought home /
fridge / given out), and a buy-in does not touch the safe. Filed in BUGS.md.

---

## 14. Job 5 — one agent, one table

### The audit: which of the three was it?

The queue offered three candidates. Two are ruled out and one is the answer.

**Not a client that lets you tap twice.** `deployAgent` is synchronous — there
is no `await` anywhere in its critical section — so two HTTP requests cannot
interleave inside it, and the third or fourth tap has always been answered by
the "already at a live table" fast path. The test
`tapping deploy twice in one tick takes one seat and one buy-in` fires three
deploys in one tick and passed *before* the fix as well as after; it is kept
because it is the assertion that would catch someone making the function async.

**Not a missing lock**, in the sense of a race. The single-threaded event loop
is the lock.

**It was a stale seat record, and the reason it could go stale is that the
wrong question was being asked.** The guard read:

```js
agent.activeTableId && liveTables?.hasTable?.(agent.activeTableId)
```

which asks whether **a table exists** — never whether **he is in it**. It held
only for as long as the agent record agreed with the felt, and `activeTableId`
is written *after* the seat is taken (§2, step 9) and cleared by a ceremony
that is wrapped in a `try/catch` and swallows its own failures. Two paths made
them disagree:

- **`POST /finish`** cleared `activeTableId` and set him idle while leaving him
  seated at a running table. The next deploy saw no table to hand back and
  opened a second one. (This is the same defect as job 3's double cash-out, and
  it is fixed there.)
- **Every other door** — `joinAgentSession`, `startAgentSession`,
  `addSpectator` — enforced `seatsAgentOfOwner`, which is MATCH-1's rule: *not
  two of one owner's agents at one table*. None of them enforced anything at
  all about **this agent** being at **some other table**. `matchmaking.js:149`
  checks `agentIds.includes(agentId)` for one candidate table only.

### The fix: the felt is the authority, the record is a cache of it

- **`tableRegistry.tableOfAgent(agentId)`** walks the live seats. It cannot be
  stale, because it *is* the state — the same argument `homeTableOf` already
  made for the living room (BUG-16's law: the live table is the only witness).
- **`src/server/seating.js`**, a new leaf: `setSeatLookup` / `seatOf` /
  `seatedElsewhere` / `seatedElsewhereMessage`. It is its own file because three
  modules need the same answer and no two of them may import each other —
  `tableRegistry` imports `table.js`, and `table.js` imports `agentProfiles`.
  The registry registers the lookup at module load.
- **Every door asks it.** `joinAgentSession` and `startAgentSession` refuse with
  `null`, which is exactly what a full table returns and which every caller
  already handles. `addSpectator` throws, with the message below.
  `startAgentSession` checks *before* seating the House, so a refusal cannot
  leave a complementary regular at an empty felt.
- **Deploy repairs the record from the felt** instead of trusting it. A stay the
  process lost track of heals on the next deploy rather than forking.

### The message

`another of your agents is already at this table` was the only thing any of this
produced, and it is about a different rule. An owner told that about the agent
who is *standing at the table* has been told something untrue. The refusal now
names the felt:

> GRANITE is already sitting at table-9f3a. He plays one table at a time.

and deploy, asked for a *different* room while he is seated, answers `409
alreadySeated` carrying that sentence, the `tableId` and the room — rather than
silently handing back the table he already had, which is the same complaint
SERVER-4's `cantAfford` exists to avoid.

### What "a seat" means — the kitchen table does not count

`tableOfAgent` **excludes the home game**, the same line `seatedAgentIds` and
`countAutonomousTables` already draw. The precise rule is:

> **A casino seat is exclusive.**

The kitchen table is not a casino seat: no buy-in, no session, no ledger, no
money of any kind, and it stands itself back down the moment somebody leaves for
work. Deploying from it is *going to work*, not sitting at two tables — and a
rule that refused it would leave an agent unable to be sent to the casino
because he was playing cards in his own living room. `verify-watch-v2.js` found
exactly that within a minute of the first version of this change, which is why
it is written down here.

It cuts the other way too, and that half is a genuine improvement: an agent who
**is** at a casino table is found by the lookup, so the kitchen table's own
`joinAgentSession` now refuses to deal him in. Before, the only thing keeping
him out of both chairs at once was homeGame's roster sync noticing on its next
pass.

### Tests

`src/server/oneSeat.test.js` (9) and `src/server/seating.test.js` (8). The seat
tests cover: the registry answering from the felt when the record has lost him;
each of the three doors refusing; the refusal naming the table and *not* using
MATCH-1's sentence; deploy handing back the right felt after the record was
cleared, without a second buy-in; a different-room request refused; three
deploys in one tick taking one seat and one buy-in; and two agents of one owner
each holding a seat of their own.

---

## 15. The same measurement, after the fix

Job 2's simulation, re-run against the fixed branch. Same shape: scratch
database, three owners, one agent each, no API key, three rounds of deploy →
play → close.

| moment | chips in existence |
|---|---|
| three owners drafted, nobody seated | 50,030,000 |
| three agents seated (3 buy-ins) | 50,030,000 |
| 70 hands in, still seated | 50,030,000 |
| every session settled | **50,030,000** |

**207 hands, 9 buy-ins, net created 0. Chips are conserved.**

(50,030,000 is the 30,000 the three owners were granted plus the house float of
50,000,000. The float being inside the total is the point: the bank is where the
chips go while somebody is playing with them.)

And the owners did not merely break even — they finished collectively up 727
(30,727 against 30,000), and it came **out of the bank**: 49,999,273 against
50,000,000. That is the whole fix in one line. Before, those 727 chips came from
nowhere; now they came from the house, and the house is exactly 727 lighter.

The audit tool's own reconciliation is green beside it: every owner's `diff` is
zero, and no household carries more than one starting grant.

### What is left open

- **BUG-201's client half**, two cases in `client/src/lib/safeLines.js`. The
  server sends `buyin` and `cashout` to the safe now; the sheet has a phrase for
  the five older kinds of line and not yet for these, so a buy-in renders as
  "Adjustment" with the right time and the right figure. Server-only queue.
- **The inflated prod balances stay inflated.** Same call BUG-136 made, for the
  same reason: the bug was not the players'. What changes is that the number
  stops growing.
- **BUG-200**, a pre-existing client test that asserts a US-formatted number and
  fails under any other system locale. Red on `origin/main` before this branch
  and untouched by it.
