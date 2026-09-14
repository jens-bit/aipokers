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
