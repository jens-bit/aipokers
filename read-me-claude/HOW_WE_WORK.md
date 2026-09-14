# How We Work — Railbird (formerly Agentic Poker)

The operating protocol as it actually ran on 2026-09-10 (v4). v3 (2026-09-06) established the worktree and queue discipline, v3.1 (2026-09-07) added arena runs, keys and brand art, and both replaced the numbered-tab protocol of 2026-09-05. **v4 records what changed when a second builder arrived**: who owns main, how many pairs a job is allowed, and what DESIGN_GAP.md is for. Read it at the start of every session.

## Who is Jens

Founder, not a developer. He understands the product deeply and orchestrates the terminals; he does not read diffs. Give him exact copy-paste commands and state the tab first. Never assume he knows what branch a tab is on.

He runs Windows/PowerShell. **Never use `>` to redirect into a source file** — PowerShell writes UTF-16 and the Vite build dies with `Unexpected "?"`. Use Python or a heredoc. `git config core.pager cat` is set in the main repo so nothing opens `less`; if a command ever shows `(press RETURN)`, press Enter then `q`.

## Two builders, one main

There are two builders now and they build the same product out of the same folder. Astra — OpenAI's GPT-6, on Jens's $20 plan, and the author of every `codex/*` branch — works in the main project folder and merges its own work to main; the Claude integrator works in that same folder the same way. One folder, one index, one `data/`, two agents that both believe they own it — so the rule is not "coordinate", it is **one at a time, and the other one is not running**.

**Astra is builder and integrator on main while it runs.** It writes the batch, gates it, commits it, merges it. Nothing else touches main in that window. When Astra is out — an overnight, a weekend, a handoff like 10 September's — **the Claude integrator owns main** and does the identical job: gate what is in the tree, commit it, merge it, write down what the gates said. Neither of them is the senior one; the difference is only which is running.

**Nobody else ever works in `C:\Projects\ai-poker` while one of them is running.** Not a second Claude tab, not a quick `git status`, not an arena run. Two agents in one working tree do not collide loudly — they collide quietly, by sweeping each other's half-written files into a commit neither of them meant. Astra's batch 53 could be handed over as fifteen uncommitted files precisely because nothing else had written to that tree since it stopped.

**Claude Code tabs stay in their worktrees, on their branches.** STEP 0's branch guard is what enforces it; a tab that finds itself on `main` in the shared folder has been pasted into the wrong window and stops there. Worktrees are cheap and branches are free. The shared folder is the only scarce thing and it belongs to whoever is integrating.

The handoff is a sentence, not a ceremony. Whoever takes main says so; whoever hands it over says what is left uncommitted in the tree and whether it has been gated. "Astra is out until 15 Sep; you own main until then, and its last batch is sitting in the tree ungated" is the entire protocol.

## The three roles

**Cowork (Claude in the desktop app)** is the planner and the ledger. It writes every paste, sequences the merges, imports Claude Design zips into `design-refs/`, writes design waves from playtest findings, keeps the master spec and this file, and thinks with Jens on product, economy and marketing. It never runs git through the folder link (index.lock); it writes files, the integrator commits them.

**Claude Code tabs** build. One tab per role, one worktree each. Tabs are renamed by role (renaming removes Claude Code's spinner title; `Ctrl+End` shows whether a tab is idle):

| Tab | Folder | Role |
|-----|--------|------|
| **INTEGRATOR** | `C:\Projects\ai-poker` (main) | Merges the queue, gates, files bugs, commits design-refs. Never pushes. Runs only when Astra is not. |
| **BACKEND** | `ai-poker-backend` | Server trees. |
| **WATCH** | `ai-poker-watch` | The felt and the casino client. |
| **FRONTEND** | `ai-poker-bugsb` | The flat and the phone shell. |
| **PLATFORM** | `ai-poker-platform` | Protocol, desktop, cross-cutting. |
| **TABLEVIEW** | `ai-poker-tableview` | Draft, birth, tests, whatever is free. |
| **PS** | PowerShell in `C:\Projects\ai-poker` | `git push` only. The push is the deploy. |

Worktrees are named after the domain and survive the session. The integrator removes dead ones (`git worktree remove`) when their branches are on main; a folder Windows refuses to delete is deleted by hand after its tab is closed.

**The Claude Code GitHub app** builds in the cloud. Mention `@claude` in an issue or a PR comment and it opens or updates a PR on its own branch. Its PRs are gated by the Tests check exactly like a tab's branch. Use it for self-contained work that needs no worktree (the landing page, one-file fixes) and for follow-ups on its own PRs. It runs in parallel with everything else and needs nobody watching.

## Queues, not prompts

Every paste is a **queue**: numbered jobs, sequential, each self-contained, one commit per job, the tab reports **once** at the end. A tab that stops to ask has stalled until Jens comes back, so the queue says what to do when something goes wrong.

Every job starts with the branch guard:

```
STEP 0: `git branch --show-current` must print <branch>; stop and report if not.
```

or, for a new tree:

```
Branch <branch> from origin/main (git fetch origin && git checkout -B <branch> origin/main).
```

Then: the refs to read (design-refs files and README laws for a port; the server module for a server job), exact scope ("client only", "server only", "touch nothing outside …"), the tests that must be green (`npm run test:all` — it runs server, client and e2e), and always: **do not push, no client/dist**.

When a queue's premise is wrong (a ref that isn't there, a server route that doesn't exist), the tab does the nearest honest thing and states the deviation in its report. Judgement calls it makes on its own are listed as such so Jens can overrule.

`/clear` before every new paste. Paste into the tab whose folder holds the branch; the guard catches the rest.

## The integrator

**Railbird playtest addition (2026-09-08):** before a home push, also run `cd client` then `npx playwright test e2e/home.spec.js -g BUG-55`. This reproduces Jens's four-agent room with a pending want at 390×590 and 390×844, clicks the actual felt, checks the sole request and Railbird header, and verifies the short window can reach its TV. It now runs in the deploy workflow too. The old jsdom and mostly-empty-room checks missed this hit-target bug.

Given the merge order, it follows it. For each branch, in order: `git merge`, `npm install` at root and in `client/`, `npm run test:all`, and a BUGS entry for anything the branch's report flagged. It skips a branch that isn't reported yet and comes back to it.

**Conflicts and merge-caused reds are fixed in the owning branch's worktree, never in main.** Either the owning tab merges main itself (Job N: "merge main") or the integrator does it in that worktree; both land as `Merge branch 'main' into <branch> (MERGE-n)`, and the merge to main then fast-forwards. Resolutions keep both sides' intent; a test that encoded a rule the product no longer wants is rewritten to the new rule with the reasoning in the commit, never loosened (Testing law #5).

**A merged branch that touched `client/` gets all three Playwright configs before the push report: `npm run smoke:browser`, `npm run test:home2`, and `e2e/desk.spec.js`.** None of these is the same gate as `test:all`: they are the only things in the repo that ever load `client/dist` or lay out a real screen, so they are the only things that can see a screen that breaks once Vite has minified it, or a claim about pixels jsdom reports as all zeroes — and more to the point, smoke and home2 are the only things that open the app the way a user does. The deploy after the bugs-c merge (2026-09-08) went red on exactly that gap, twice over: BUGS-C-12 made the floor the casino's default view, every jsdom test was rewritten to match and stayed green, `casino2.spec.js` was left waiting twenty seconds for a sign that is no longer rendered on first open, and `home2.spec.js` was left waiting for a "Back home" button that isn't the floor's own back control anymore. `test:all` could not have caught either. Run all three before saying `git push`, not after Jens has pushed.

Run smoke:browser and test:home2 the way CI does, or they will lie to you twice. `npm start` in the project folder is the wrong server for this: the `/api` limiter is 60 a minute per IP and four browser tests burn that in one run, so the seed comes back `429` and the failure says nothing about the product. And the second run against the same database is worse than the first — the home game is in cooldown by then, so the smoke's SIT step finds no chair and goes red for a reason that is not there on a clean boot. So: a scratch data directory, the limiters open, the pauses short, and no key — the same five variables the workflow's "Start the server" step sets. Both suites point at the same scratch server, so start it once:

```
mkdir -p /tmp/smoke-data && cd /tmp/smoke-data
NOTIFY_ENABLED=0 RATE_LIMIT_MAX=100000 RATE_LIMIT_CHAT_MAX=100000 \
  HAND_PAUSE_MS=600 HOME_PAUSE_MS=600 node /path/to/ai-poker/src/index.js
# then, in the project folder, with ANTHROPIC_API_KEY unset:
npm run smoke:browser
npm run test:home2
```

Build the client first (`npm start` once, or `npm run build:client`) — both suites load `client/dist` and a stale bundle is a green run that proves nothing. Wipe the scratch directory between runs. Eight smoke tests (four of them casino2's) plus home2's twenty, about ninety seconds total, and the screenshots land in `smoke-shots/` and `home2-shots/`.

**Port 8765 is shared by every worktree, so it is regularly already taken.** A tab in another tree starts a server on it for its own check and forgets to stop it, and then the scratch server dies with `EADDRINUSE` — or, worse, does not die because you skipped starting one, and both suites quietly gate the *other tree's* bundle against the *other tree's* database. Do not kill it: it belongs to somebody who is still working. Give yours a port of its own and point the suites at it, which is what `SMOKE_BASE_URL` is for:

```
PORT=8791 …the same five variables… node /path/to/ai-poker/src/index.js
SMOKE_BASE_URL=http://127.0.0.1:8791 npm run smoke:browser
SMOKE_BASE_URL=http://127.0.0.1:8791 npm run test:home2
```

`netstat -ano | grep :8765` gives the PID and `Get-CimInstance Win32_Process -Filter "ProcessId = <pid>"` gives the command line, which is how you find out whose it is before touching anything.

`e2e/desk.spec.js` is different in kind — a look check, not a gate, with its own Vite dev server and no fixture or key needed — but it is still one of the three, because it is the only thing that ever lays out the desktop's three-column claim in a real browser:

```
cd client && npx playwright test e2e/desk.spec.js
```

It never fails on its own (screenshots gate nothing); run it and look at `client/e2e/__screenshots__/desk3-*.png` for anything the merge could plausibly have moved.

**Before every push report, it fetches and merges origin** — PRs merge on GitHub while it works, and a push that gets rejected is a push Jens has to come back for. Its report ends with the one line for Jens: `git push`.

When a deploy goes red on a known flake, Jens re-runs the failed job once from the Actions page; the flake still gets a fix on main the same night, because a flaky gate is what lets a real red through.

Design imports: Cowork writes the changed files into `design-refs/` (md5-diffed against the previous zip; new files, changed files); the integrator commits them as `design: … (design N)` and folds the commit into the next push.

## The push

Jens pushes from PS. `git push` on main triggers Tests → Browser smoke (Playwright at 390×844 and 1440×900) → Deploy. About four minutes. If "Bypassed rule violations" appears it is the branch ruleset noting his admin bypass, not an error. A rejected push means origin moved (a PR merged); the integrator's fetch-and-merge rule exists so this doesn't happen, but if it does: `git pull` then push.

Prod is only current when the latest deploy run is green. Check the Actions page before blaming the code, and hard-refresh.

## Design waves

Claude Design produces boards; a wave starts from a playtest finding or a stated product rule, never from a hunch. Rules that Claude Design has already failed once are restated in full in the next wave (a short correction is how the same mistake ships three times). Every wave ends with a verification clause: render each changed frame at 390×844 and 1440×900 and write `verified: <what you saw>` or `not done: <why>` in the caption.

Cowork imports the zip, diffs it, and — for a big wave or after a long session — **renders the boards before saying what changed**. A source diff is not a picture. What it reports is what it saw.

The design is **frozen** once code is more than about two waves behind it; then only correction rounds on what the tabs are porting. Ports go one way, `design-refs/` → `client/src/`; port, don't redesign.

**Refresh `design-refs/shipped/` before starting a wave.** Claude Design reads the code but cannot run the app, and its boards drift from what actually shipped for exactly that reason. `npm run shots` (SHOTS-1) rebuilds a ground-truth screenshot of every screen the app actually ships, real server, real seeded household, no mocks — see `design-refs/shipped/README.md`. A wave built against a stale pack corrects drift that was already fixed, or misses drift that is new.

## Pairs

A pair is one picture: the reference on the left, the actual product on the right, same scale, same state. It is the only thing that settles "did that port land", and it is expensive — somebody has to render the frame, drive the product into the same state, put them side by side, and *look at them*. It earns that cost when a job has just changed that frame. It earns nothing when it is generated to fill a row in a table.

**Only for the frames a job names.** A queue that ports the Home header ink produces the Home header pair, plus whatever the change could plausibly have moved. Not the room. Not the roster. Not the eleven other frames that happen to sit on the same board.

**Three to six per queue.** That is the budget, and it is a budget rather than a target: three is a normal batch, six is a wide one, and a queue that wants more than six is really two queues.

**Never inventory-wide.** Regenerating every pair in the audit is not verification; it is a night spent producing 185 pictures nobody reads, and it ends with a document that says PARTIAL 103 times without a single named difference. The enumeration exists to be queried, not to be re-photographed.

**Never redone once matched.** A pair that has been inspected and matched is finished. If a later change moves that frame, the job that moves it names it and pairs it again. Otherwise it stays matched and nobody looks at it twice.

**Jens's phone is the gate for everything else.** A pair proves one frame against one reference. Whether the thing is *good* — whether the room reads as a room, whether the agent reads as a companion, whether the wait before the first screen is bearable — is settled by Jens opening the deployed app on his phone and saying so. That is why every screen section in DESIGN_GAP.md ends with what to look at. When it is unclear whether something needs a pair, it usually needs a playtest.

## DESIGN_GAP.md

`read-me-claude/DESIGN_GAP.md` is a **short per-screen status**: one section per screen — Home, Draft, Agent, Roster, Casino, Watch, Safe/Fridge, Landing/Guest, Brand, Desktop, Notifications — each saying where that screen stands, which bugs are open against it, and what Jens should look at on the phone. It is written to be read in five minutes, by a person, at the start of a session, and it is kept current by hand because it is short enough to be.

The 185-row frame inventory and its 466 substates are Astra's source-indexed audit, and they keep their value: they are the enumeration of what was authored, indexed to the exact reference line. They live in [DESIGN_STATE_GAP.md](DESIGN_STATE_GAP.md), they are **referenced, not maintained by hand**, and they are regenerated from `artifacts/current-frame-inventory.json` when somebody needs the enumeration. Hand-editing them every batch is what went wrong — a table too long to read in one sitting stops being read and starts merely being appended to, and then the one document that was supposed to say where the design stands says it in 185 places at once. The batch-41 snapshot stays byte-for-byte in [DESIGN_GAP_BATCH41.md](DESIGN_GAP_BATCH41.md) and the older history in [DESIGN_GAP_HISTORY.md](DESIGN_GAP_HISTORY.md).

One rule for writing in it: a screen's status is what somebody actually looked at, with the difference named. "PARTIAL" with no named difference is not a status, it is a shrug.

## Perf rules

**WatchScreen stays EAGER. Do not lazy-load it, now or later, without a new instruction from Jens.**

BUG-156 split the desk, the casino, the profile and the replay theatre out of the phone's entry bundle, and WatchScreen is the obvious next candidate — it is large, and on the phone it is not the first screen. It is nevertheless not a candidate, and the reason is not technical: watching him play is the thing the product is for, and it is what a deep link, a notification and a share card all open. A spinner on the way into a hand is a spinner at the only moment the whole app is trying to earn. The saving is real; the trade is not the one we want, and it has now been considered and refused rather than overlooked.

That is the standing rule. If it is ever revisited, it is revisited on purpose, by Jens, and this line is what has to change first.

The rest of the entry budget: measure before splitting (`npm run build:client` prints the chunk sizes), and split what a first-time phone visitor genuinely does not reach — never what a link opens.

## Playtests

Jens plays prod on the phone and the desktop and writes down what broke or felt wrong, with screenshots. That list becomes one queue (`fix/bugs-x`) for one tab, one job per finding, each with the failure named in a test. Product calls that a finding implies are decided in the queue, not left to the tab.

## Tests

`npm run test:all` = server (node:test), client (Vitest), e2e (the verify scripts). The Testing law in CLAUDE.md governs: a new test fails on the old behaviour before it passes on the new; no assertion is loosened to reach green; a flaky test is fixed, not re-run. Known flakes are filed in BUGS.md with the measurement that shows they predate the branch. Running a verify script by hand writes into the worktree's `data/`; use the harness (scratch cwd) or clean up after.

## Arena runs

Backtests run on Jens's PC, never on the VPS and never in the integrator's folder (`data/arena/` is untracked, but the integrator's working tree must stay clean). Use a spare worktree: `git fetch origin && git checkout -B arena origin/main && npm install` in it (`git checkout main` fails there — main lives in the integrator's worktree). The key goes into that one PowerShell tab as `$env:ANTHROPIC_API_KEY="…"` and nowhere else; `$env:ANTHROPIC_API_KEY.Length` prints 108 if it pasted whole. Chain runs with `;` and `Tee-Object <name>.log`; watch the first minute for `API error: 401` (a bad key does not stop the run — the harness falls back to policy play and the results are garbage, so Ctrl+C, fix the key, delete the log and `data\arena`, rerun). Windows sleep off (Settings → Power → all three Never; do not "Apply all" on the energy page). In the morning: `Get-Content <name>.log -Tail 30` per run; the numbers go to spec §5.2.

## Keys

A key that has been in a chat window is burned, whoever the chat is with. Revoke it in the console the next morning and create a new one that is typed only into the PowerShell tab. The same holds for the bot token and the deploy key. Cowork never writes a key anywhere; the spec's Known debt row tracks what is still to rotate.

## Env

The full list of variables and what each one does lives in `CLAUDE.md`; this section is only the standing debt — which of them the VPS still has to be told about, and what is already true without touching it.

**Known debt.** Nothing to do on the VPS for COST-2. `UNWATCHED_POLICY` defaults on, so a casino table nobody has watched for 60 seconds straight routes its decisions to the compiled policy the moment the merge deploys, with no line added to `.bashrc`. Setting it to `0` is the way back, and it is the only reason to add the line at all: the revert needs no code change, just the variable and a restart. The two exceptions — a stack in the middle of a hand and a big pot — reach the model either way, on or off (`src/server/router.js`).

**ADMIN-1 — the one thing to check on the VPS.** The dashboard at `https://agenticpoker.app/admin` exists only if `ADMIN_KEY` is set in `.bashrc`. Unset, `/admin` and its three JSON routes answer 404 rather than 403, on purpose — a deployment that never configured a dashboard does not advertise that it has one. If the page 404s after the deploy, that is the reason and not a bug. Nothing else is needed: the presence write and the hourly counters start on their own, and they only ever count forward, so `active 30d` and the retention cohorts read low for the first weeks and are not wrong. `read-me-claude/ADMIN.md` is how to open it and what each number means.

`GET /api/meter` (an owner's own bill, behind auth) and `GET /api/admin/meter?key=…` (everybody's, behind `ADMIN_KEY`) now both carry a `watch` block that splits hands, calls and dollars into `watched` and `unwatched`, each with a per-100-hands rate. That is where you look to find out whether the dial is earning its keep before deciding to turn it off — the unwatched line should be the cheap one, and if it is not, the gate is not firing.

## Brand art

Claude Design draws SVGs by typing path coordinates, so it cannot draw a silhouette with character (wave 62's birds read as blobs). Character art comes from an image model (ChatGPT) with a single dense visual description — no frame sizes, no rules, no verify clauses, those leak into the picture — generated four at a time, squint-tested at 40 px, then handed to Claude Design as PNGs with the instruction to trace, never redraw, and to overlay the trace on the PNG before reporting. Image models mangle lettering: wordmark and mark are separate images.

## End of session

1. Every tab reported, every branch merged, integrator's last report says `git push`, Jens pushed, deploy green.
2. `BUGS.md` current (the integrator files entries as reports come in; the header count is recounted from the file).
3. `CHANGELOG.md` and the master spec bumped by Cowork; `HOW_WE_WORK.md` if the process changed.
4. Dead worktrees removed; VPS env changes noted in the spec's Known debt until done.
