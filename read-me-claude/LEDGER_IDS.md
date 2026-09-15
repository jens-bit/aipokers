# The ledger id mismatch — measured, and the decision

LIFE-2 job 3. Written 2026-09-15 on `feat/agent-life-2`. Nothing in this file
was migrated, and nothing was run against the VPS.

**The decision, first: do not migrate.** There is nothing to migrate. The
mismatch is real in the TEST SUITE and has never been possible in the product,
and the two paragraphs below are the evidence rather than the assertion.

---

## What was reported

> An earlier fix corrected new writes, but existing ledger rows carry bare ids
> where the seat writes `agent_<id>`, so historical reads stay invisible.

The "earlier fix" is LIFE-1 follow-up 1 (`5dc21e3`, *DECEPTION belongs to the
subject, not to his seat*). Its own commit message says what it found:

> Writing the test found a real fixture bug in the existing suite: it used bare
> ids like `'villain'` as ledger playerIds, where seatAI actually writes
> `agent_<id>`.

That is a bug in a FIXTURE, not a correction to a write path. No production
write was changed by that commit, because none needed changing.

## Why a production row cannot carry a bare agent id

**One writer.** Every agent seat in the product is minted in exactly one place,
`Table.seatAI` (`src/server/table.js`). Grep confirms it: the seven callers of
`seatAI` are all inside `table.js`, and nothing else anywhere assigns a
`playerId` to an agent. It has read

```js
playerId: agentId ? `agent_${agentId}`
        : stableId ? `house_${stableId}`
        : `ai_${this.tableId}_${this._seatSeq++}`,
```

since **MST-1, `c7f6d90`, 2026-08-30**.

**And the ledger is younger than the prefix.** `bioLedger` was created by
**BIO-2b, `e1c7ea4`, 2026-09-05** — six days later. `git show
e1c7ea4:src/server/table.js` has the prefixed form already in it. So there has
never been a build in which a completed hand wrote a bare agent id into a
ledger. The window in which the reported corruption could have been produced
does not exist.

**The whole key space, for the record.** A `bioLedger` key is whatever
`this.pending[i].playerId` was for that seat, which is one of four shapes:

| shape | who | minted in |
|---|---|---|
| `agent_<uuid>` | somebody's agent | `Table.seatAI` |
| `house_<stableId>` | a House regular | `Table.seatAI` |
| `ai_<tableId>_<n>` | an anonymous filler | `Table.seatAI` |
| `<ownerId>:<clientId>` | a human seat | `wsServer.js` JOIN (BUG-50) |

None of them is bare. The fourth is what a kitchen-table hand against the owner
himself writes, and it is deliberately not an agent id.

## How many rows a realistic database has affected

Measured read-only against the fullest local database, `data/app.db` (37 agent
records, last written 2026-09-14), and against the pre-SQLite snapshot
`data/agents.json.migrated` (8 owners / 3 agents, 2026-08-29):

```
data/app.db               37 agents, 1 with a ledger, 1 ledger row total
  key shapes              { BARE: 1 }
  the one bare row        owner 'events-e2e-user', agent 'agent_mtpywraz',
                          key 'p1', name 'Taker', 41 hands, net -8010
  derived-role playerIds  { BARE: 1 }   (the same row, promoted to nemesis)
  opponent_stats          7 rows — 6 × ai_<table>_<n>, 1 bare

data/agents.json.migrated 0 ledger rows  (it predates BIO-2b by a week)
```

**Rows belonging to a real owner: zero.** The single bare row belongs to
`events-e2e-user`, which is `src/server/table.events.test.js`'s own owner id —
it is a test that ran with the project root as its cwd before the harness
started giving every spawned suite a scratch directory. It is residue in a
developer's `data/`, not user data.

That fixture is also internally consistent and not wrong: `seatTable` there
seats PLAIN connections (`seatPlayer` with `p0`/`p1`) and patches agent ids on
afterwards, so the ledger key and the seat's `playerId` agree, and
`_maybeNemesisSeated` — which compares the two strings directly and knows
nothing about prefixes — matches exactly as it would in production. What it
models is a table shape the casino never builds. Worth knowing; not worth
changing in a job that was asked for a decision.

**The one thing this report cannot do from here** is count rows on the VPS, and
it should not: the job says do not touch production data. If Jens wants the
count confirmed rather than derived, this is read-only and safe to paste on the
box:

```bash
sqlite3 -readonly /opt/aipokers/data/app.db \
  "SELECT json_each.key FROM agents, json_each(json_extract(agents.data,'\$.bioLedger'));" \
  | grep -cv '^\(agent_\|house_\|ai_\)' 
```

It prints the number of ledger keys that are neither an agent, a House regular
nor a filler. Human seats (`<ownerId>:<clientId>`) are counted by it and are
correct, so a small non-zero answer is expected and is not the bug.

## What a bare row actually costs, if one existed

Worth writing down, because "historical reads stay invisible" is two different
failures and only one of them is true.

1. **The read goes quiet — TRUE, and it is the visible symptom.**
   `opponentRecall.describe` calls `getRead(entry.playerId)` against
   `opponent_stats`, which is keyed on the same `playerIdsBySeat` the ledger
   is. If a ledger row's key does not match the stats key for the same man,
   `getRead` returns null and he says *"YOU DO NOT HAVE A READ ON HIM YET — 0
   observed hands against the N you need."* That is honest rather than wrong,
   and it is exactly the sentence LIFE-1 job 4 wrote for the case.
2. **The gate is mis-set — TRUE, and bounded.** `subjectDeception` resolves
   `agent_<id>` and returns null for anything else, and `readMinHands` treats a
   null DECEPTION as the neutral 1.0× multiplier. So a bare key costs the
   0.6×–2.4× band around the bar — a Grinder is read a little too slowly, a
   Showman a little too fast. Nothing is hidden by it.
3. **The relationship is invisible — FALSE.** `deriveRoles` works entirely off
   `hands`, `net` and `displayName`. A bare row can and does become a nemesis;
   the dev db's one bare row is one. `_maybeNemesisSeated` compares raw strings
   and matches whatever shape both sides carry.

## Would a migration be safe and idempotent?

It could be written safely. It cannot be written *correctly*, and that is the
reason to refuse it rather than the row count.

- **Idempotent: yes, trivially.** Skip any key already matching
  `^(agent_|house_|ai_)`; that makes a second run a no-op.
- **Safe: only with a lookup.** `p1` is not an agent id. The only way to know
  whether a bare key `X` should become `agent_X` is to look `X` up in the
  `agents` table (`store.loadAgentById`, added by LIFE-1 follow-up 1). Keys
  that do not resolve must be left exactly as they are — a human seat, an old
  filler, a hand-written test id.
- **And it needs a MERGE, which is where it stops being obviously right.** If
  both `X` and `agent_X` exist on one agent they must be combined: sum `hands`,
  `net`, `coolersDealt`, `coolersTaken`, `bluffsCaught`, `showdowns`; max
  `biggestPotWon`, `biggestPotLost`, `lastSeenHand`. That is only correct if
  the two rows describe disjoint sets of hands — which they would, since no
  single build can produce both shapes for the same man. Definable, then. But
  it is a merge rule, a resolver and a rollback plan written against a set that
  is provably empty, run over live user data, to fix a symptom no owner has
  reported.

## Do reads rebuild themselves?

**Partly, and the difference is worth stating precisely.**

- **The correct row heals.** `recordLedgerHand` creates an entry on first sight
  and accumulates after that, so the next hand he plays against that man writes
  under the right key and starts a true row from zero. `opponent_stats` does the
  same from the same id. After that, the read and the ledger agree and the
  prompt is correct — it is just short of history, and it says so in the
  sentence quoted above rather than guessing.
- **The stale row does not heal; it decays.** Nothing deletes it. It keeps its
  counts, keeps feeding `deriveRoles`, and can go on holding nemesis or victim
  on frozen numbers until `compressLedger` evicts it — which only happens once
  that agent's ledger passes `LEDGER_CAP` (20) opponents and the stale row falls
  out of the top twenty by hands played. For a heavy player that is weeks; for a
  light one it is never.

So "reads rebuild themselves anyway" is true of the read and false of the row.
If there were real rows, the honest fix would be a deletion of unresolvable
stale rows rather than a rewrite of them — and there are none.

## Recommendation

1. **No migration.** No production rows are affected, and the machinery a
   correct one needs is disproportionate to a null set.
2. **Leave the VPS alone.** If the count above comes back larger than the human
   seats can explain, this file is wrong and the decision should be re-taken
   with that number in hand.
3. **The residual risk is a fixture, not a database.** The rule worth keeping
   is that any test asserting on the READ path (`subjectDeception`,
   `opponentKnowledge`, `opponentRecallContext`) must key its ledger on
   `agent_<id>`, or it grades a shape the product cannot produce and goes green
   on a broken build — which is precisely what LIFE-1 follow-up 1 walked into.
   `src/server/opponentRecall.test.js` was fixed there and is correct now. Tests
   that only exercise ARITHMETIC (`src/agent/bio.test.js`) may keep opaque keys;
   the key is not part of what they claim.
