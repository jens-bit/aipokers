# How We Work — Agentic Poker

The operating protocol as it actually ran on 2026-09-06 (v3). It replaces the numbered-tab protocol of 2026-09-05. Read it at the start of every session.

## Who is Jens

Founder, not a developer. He understands the product deeply and orchestrates the terminals; he does not read diffs. Give him exact copy-paste commands and state the tab first. Never assume he knows what branch a tab is on.

He runs Windows/PowerShell. **Never use `>` to redirect into a source file** — PowerShell writes UTF-16 and the Vite build dies with `Unexpected "?"`. Use Python or a heredoc. `git config core.pager cat` is set in the main repo so nothing opens `less`; if a command ever shows `(press RETURN)`, press Enter then `q`.

## The three roles

**Cowork (Claude in the desktop app)** is the planner and the ledger. It writes every paste, sequences the merges, imports Claude Design zips into `design-refs/`, writes design waves from playtest findings, keeps the master spec and this file, and thinks with Jens on product, economy and marketing. It never runs git through the folder link (index.lock); it writes files, the integrator commits them.

**Claude Code tabs** build. One tab per role, one worktree each. Tabs are renamed by role (renaming removes Claude Code's spinner title; `Ctrl+End` shows whether a tab is idle):

| Tab | Folder | Role |
|-----|--------|------|
| **INTEGRATOR** | `C:\Projects\ai-poker` (main) | Merges the queue, gates, files bugs, commits design-refs. Never pushes. |
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

Given the merge order, it follows it. For each branch, in order: `git merge`, `npm install` at root and in `client/`, `npm run test:all`, and a BUGS entry for anything the branch's report flagged. It skips a branch that isn't reported yet and comes back to it.

**Conflicts and merge-caused reds are fixed in the owning branch's worktree, never in main.** Either the owning tab merges main itself (Job N: "merge main") or the integrator does it in that worktree; both land as `Merge branch 'main' into <branch> (MERGE-n)`, and the merge to main then fast-forwards. Resolutions keep both sides' intent; a test that encoded a rule the product no longer wants is rewritten to the new rule with the reasoning in the commit, never loosened (Testing law #5).

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

## Playtests

Jens plays prod on the phone and the desktop and writes down what broke or felt wrong, with screenshots. That list becomes one queue (`fix/bugs-x`) for one tab, one job per finding, each with the failure named in a test. Product calls that a finding implies are decided in the queue, not left to the tab.

## Tests

`npm run test:all` = server (node:test), client (Vitest), e2e (the verify scripts). The Testing law in CLAUDE.md governs: a new test fails on the old behaviour before it passes on the new; no assertion is loosened to reach green; a flaky test is fixed, not re-run. Known flakes are filed in BUGS.md with the measurement that shows they predate the branch. Running a verify script by hand writes into the worktree's `data/`; use the harness (scratch cwd) or clean up after.

## End of session

1. Every tab reported, every branch merged, integrator's last report says `git push`, Jens pushed, deploy green.
2. `BUGS.md` current (the integrator files entries as reports come in; the header count is recounted from the file).
3. `CHANGELOG.md` and the master spec bumped by Cowork; `HOW_WE_WORK.md` if the process changed.
4. Dead worktrees removed; VPS env changes noted in the spec's Known debt until done.
