# How We Work — Agentic Poker

The operating protocol as it actually ran on 2026-09-05/06, with the queue/integrator rules added 2026-09-06. Read it at the start of every session.

## Who is Jens

Founder, not a developer. He understands the product deeply and orchestrates the terminals; he does not read diffs. Give him exact copy-paste commands and state the prerequisite directory first. Never assume he knows what branch a tab is on.

He runs Windows/PowerShell. **Never use `>` to redirect into a source file** — PowerShell writes UTF-16 and the Vite build dies with `Unexpected "?"`. Use Python or a heredoc.

## The tab layout

One numbered terminal tab per role. The numbers are stable across a session; the branch inside a tab cycles.

| Tab | What it is |
|-----|-----------|
| **1** | **Integrator.** Main repo, `C:\Projects\ai-poker`. Merges the queue, runs the installs and the tests, fixes what is red, cleans up branches, `git worktree add`. A Claude tab since 2026-09-06 — see *The integrator tab* below. **It never pushes**: Jens pushes, because the push is the deploy. |
| **2–6, 9–11** | Claude Code worktrees, one per tree. Current roster: `ai-poker-backend`, `-frontend`, `-platform`, `-watch`, `-events`, `-share`, `-notify`, `-tableview`, `-redesign`. |
| **7** | Arena. `node scripts/arena.js` runs, results land in `data/arena/`. Nothing else. |
| **8** | SSH to the VPS. Deploy and `pm2 logs`. Nothing else. |

Start a Claude tab with:

```powershell
cd C:\Projects\ai-poker-<domain>
claude --dangerously-skip-permissions --model opus
```

`--model opus` (the alias, never a dated id) for everything. Reach for sonnet/haiku only for a batch of trivial single-file edits.

New worktree — from tab 1, never from inside another worktree:

```powershell
git worktree prune
git worktree add -b feature/my-tree ../ai-poker-<domain>
git -C ../ai-poker-<domain> log --oneline -1   # must match main's HEAD
```

Worktree directories are named after the DOMAIN, not the feature, and they survive the whole session. Don't create one per prompt — that is how a session ends with fifteen dead worktrees.

## One queue per tab

Jens pastes prompts. He does not type instructions of his own and he does not answer questions mid-run — a tab that stops to ask has stalled until he comes back to it. So each prompt is self-contained and ends with everything the tab needs.

**Since 2026-09-06, a tab gets a QUEUE, not a prompt.** One paste carries every job that tab will do, numbered and in order, and the tab works them start to finish and **reports once, at the end**. It does not stop between jobs to ask what comes next, and it does not report after each one — a tab that reports three times is a tab Jens has to come back to three times, and coming back mid-run is the thing he cannot do.

```
Job 1 — <TREE-ID>: <task, exact file paths>. Commit.
Job 2 — <TREE-ID>: <task>. Commit.
Job 3 — when 1 and 2 are green, <finishing step>, then stop and report.
```

Jobs in a queue run **sequentially** and each ends in its own commit, so a bad job can be reverted alone. If one job is blocked, the tab skips it, finishes the rest, and says so in the single report — it does not stall the whole queue on one blocked item. The queue is also where a tab is told what to do when something goes wrong (which branch to fix on, whether to retry), because there is nobody to ask.

Each job inside the queue is shaped:

```
STEP 0: run `git checkout -B <branch> main` in this worktree before anything else.

<TREE-ID> — the task, with exact file paths.
READ FIRST: <every file the tree touches>
Do NOT touch: <files owned by other tabs>
Tests: npm test && npm run test:client must pass.
Commit, do NOT push, report.
```

**STEP 0 is always the branch line.** A worktree is reused across trees, so whichever branch it happens to be on is never an assumption worth making. `-B` (capital) creates or resets — plain `checkout main` fails inside a worktree because main is checked out in tab 1.

**`/clear` before every new prompt.** A tab that carries the previous tree's context into the next one starts editing files it no longer owns.

Bigger trees get a megaprompt: one READ FIRST list, N sub-tasks, one commit each, so a bad sub-task can be reverted alone. Keep every sub-task inside the same file scope. If two trees would touch the same file, they are one tree in one tab — not two branches.

## What tabs never do

- **Never push.** Nobody in a tab pushes — not even the integrator. Jens pushes, after the merges are in and green.
- **Never commit `client/dist`.** It is gitignored; a tab that force-adds it poisons every later merge.
- **Never modify `design-refs/`.** It is read-only. Ports go one way: `design-refs/` → `client/src/`. Port, don't redesign, don't "improve while I'm in there."
- **Never merge.** Tabs commit and report; tab 1 sequences.

## The integrator tab

Tab 1 is the integrator. It is given the merge order in its queue and follows it — it does not invent one. When a branch in the queue is not ready yet (`git log --oneline main..feature/x` is empty), it **skips it and comes back to it** rather than waiting on it.

After every merge, in this order:

```powershell
git merge feature/x --no-edit
npm install
cd client; npm install; cd ..
npm run test:all
```

Both `npm install`s, every time: a merged branch may have brought a new dependency into either `package.json`, and a stale `node_modules` becomes a test failure that has nothing to do with the code.

**On a conflict, or on a red test caused by the merge, the fix happens in the offending branch's own worktree — never in main.** The integrator aborts, goes to `C:\Projects\ai-poker-<name>`, merges main into that branch there, resolves keeping both sides whole, gets `npm run test:all` green, commits, comes back and merges again — which now fast-forwards. Resolving in main instead buries the resolution in a merge commit nobody reviews and leaves the branch itself still broken.

```powershell
git merge --abort
cd C:\Projects\ai-poker-<name>
git merge main            # resolve here, keep BOTH sides whole
npm run test:all
git commit
cd C:\Projects\ai-poker
git merge feature/x --no-edit
```

A red test that is *not* a conflict gets its own `fix/` branch off main, with a test that fails before the fix and passes after (Testing law #3), merged like any other branch.

**The integrator never pushes.** It merges, tests, fixes, and stops with the final line for Jens: `git push`. On this project the push is the deploy, so it is Jens's call, not a step in a queue.

Merge order is **server before client, smallest diff first.** Server branches change the shape of the data the client renders; taking them first means the client branches merge against the truth instead of against a guess. Within each group, smallest first — small merges that land clean shrink the conflict surface for the big one.

```powershell
cd C:\Projects\ai-poker
git diff main..feature/x --name-only    # look before you merge
git merge feature/x --no-edit
npm test && npm run test:client
```

Before any merge to main: `npm run test:e2e` (~40s). See the Testing law in CLAUDE.md — it is not negotiable, and loosening an assertion to reach green is the one thing never allowed.

When a conflicting branch's owning tab is still live, that tab can do the resolution itself instead — same pattern, same worktree, with its file context still loaded:

```
git fetch && git merge main
# resolve, tests green
git commit -m "Merge branch 'main' into feature/x (MERGE-n)"
```

Then the integrator retries the merge and it fast-forwards. That is the MERGE-n pattern — MERGE-2 and MERGE-3 on 2026-09-05 both went this way. Either way the resolution lands on the feature branch, not in main.

After each merge: `git branch -d feature/x` (safe delete) and `git worktree prune`. Fredrik's platform work lands as GitHub PRs instead; nobody force-pushes main.

## Issues to PRs: the Claude Code GitHub app

The Claude Code GitHub app is installed on the repo. **Mention `@claude` in a GitHub issue, or in a comment on one, and it opens a PR for it** — the work happens in the cloud, on its own branch, and arrives as an ordinary pull request.

Those PRs are **gated by the Tests job** in `.github/workflows/deploy.yml`: `npm test`, `npm run test:client` and `npm run test:e2e` run on every PR, and a PR whose Tests job is red does not merge — whoever, or whatever, wrote it. The bot clears exactly the same bar a tab does, which is the point. It is a way to get small, well-specified work started without occupying a terminal, not a way around the Testing law.

A good `@claude` issue reads like a tab prompt: one tree, exact file paths, the test that must pass. Vague issues come back as vague PRs.

## Design waves

A design wave starts from a playtest finding, never from a hunch and never from "the table looks a bit flat." Jens plays, writes down what actually broke or felt wrong, and that list is the brief. Claude Design produces the wave into `design-refs/`; a Claude tab ports it. One design source per wave.

## Deploy

Tab 1 pushes; tab 8 deploys.

```
ssh root@46.62.169.246
cd /opt/aipokers
cp data/agents.json ~/agents.backup.json   # LIVE USER DATA — back it up first
git checkout data/agents.json && git pull
cp ~/agents.backup.json data/agents.json
pm2 restart all --update-env
pm2 logs        # Ctrl+C to exit
```

`data/agents.json` on the VPS is real users' agents and it is still in git, so a pull will happily overwrite it. Back up, checkout, pull, restore — every time, until the SQLite migration lands.

## Env on the VPS

Every variable lives in `.bashrc` on the VPS; `pm2 restart all --update-env` is what picks a change up. The canonical list with what each one does is in CLAUDE.md's hard rules — this section is only for the switches that are DELIBERATELY OFF and the order to turn them on in.

### GUEST_ENABLED — play without an account (GUEST-1)

**Default off. Jens flips it, not a tab.**

```
GUEST_ENABLED=1
```

Unset, the three guest routes 404, no cookie is read, `isGuestOwner` is false for everybody, and the whole app behaves exactly as it did before the tree landed — including the `/welcome` redirect for a visitor with no session on agenticpoker.app. That is the way back, and it needs no deploy: unset it and restart.

Set, a stranger who opens the app is given an owner and a thirty-day httpOnly cookie, lands on the hero with the room under it, and drafts somebody. He gets one agent, one casino session a day, no talking, and every decision on the compiled policy — so a guest costs nothing but his draft.

Two things to check before flipping it:

1. **`TELEGRAM_BOT_USERNAME` must be set**, or the claim wall's CONTINUE IN TELEGRAM button has no link to offer and draws itself disabled. It is already needed for the web login widget, so on a working deployment it is there.
2. **The bot must be able to receive `/start`.** Nothing to configure — `/start guest_<token>` rides the same `getUpdates` loop the share cards already use — but it is the same loop, so `SHARE_INLINE=0` turns the claim link off with it. Only one process may poll per bot token: if a second one is ever started, both break.

Worth watching for a day after it goes on: `GET /api/admin/meter?key=$ADMIN_KEY`. A guest owner should appear in the decision routes as `policy/guest` and never in the model spend at all.

## End of session

1. Every tab committed, nothing uncommitted anywhere.
2. All trees merged in tab 1, tests green, pushed.
3. `CHANGELOG.md` and `BUGS.md` updated.
4. Tab 1: `git worktree prune`, delete merged branches.
