# How We Work — Agentic Poker
Read this at the start of every session. It tells you who Jens is, how he likes to work, what to never do, and the exact commands to run.

---

## Who is Jens

Jens is the founder building Agentic Poker. He is NOT a developer. He understands the product deeply but needs explicit step-by-step terminal commands. Never assume he knows what directory he is in, what branch he is on, or what a git concept means. Always give him the exact command to copy-paste. If a command has a prerequisite (being in a specific directory), state that first.

He runs Windows with PowerShell. Important: PowerShell's `>` redirect creates UTF-16 files which break the build. Never tell him to use `>` to redirect git output into source files. Use Python instead (see File Operations section).

---

## The Division of Labor

**Codex (GPT) = frontend design**
Codex designs and builds all UI: HTML mockups, JSX components, CSS. All Codex output lives in `design-refs/`. This is the source of truth for how the app should look. Codex output is NEVER thrown away or redesigned by Claude. Claude's job on the frontend is to PORT Codex's work into production, not redesign it.

**Claude = backend, merging, deployment, polish**
Claude handles: Node.js server, WebSocket logic, game engine, API routes, merging feature branches, fixing bugs, deploying to VPS, and porting Codex designs into production React components.

**Rule:** Before writing any frontend code, check if design-refs/ already has a component for it. If it does, port that. Do not invent a new design.

---

## Project Structure

```
C:\Projects\ai-poker\          ← main repo, always deploy from here
C:\Projects\ai-poker-home\     ← worktree: feature/home-redesign
C:\Projects\ai-poker-agents\   ← worktree: feature/agents-tab
C:\Projects\ai-poker-creation\ ← worktree: feature/agent-creation
C:\Projects\ai-poker-watch\    ← worktree: feature/watch-play
C:\Projects\ai-poker-nav\      ← worktree: feature/nav-bar (if exists)
```

Key files:
- `src/agent/handler.js` — AI decision engine (Anthropic API calls)
- `src/server/table.js` — game table state, chat triggers
- `src/server/wsServer.js` — WebSocket message handling, seat assignment
- `client/src/App.jsx` — main React app, routing, tab state
- `client/src/styles/globals.css` — entire design system (dr-* classes)
- `design-refs/` — Codex-designed components, DO NOT modify
- `data/agents.json` — persistent agent storage
- `BUGS.md` — current known bugs
- `CHANGELOG.md` — version history
- `agentic-poker-master-spec-v8.docx` — master product spec (always use latest version number)

---

## Starting a Session

**Step 1 — Read the master spec and bugs:**
Always read `BUGS.md` and the latest `agentic-poker-master-spec-*.docx` before doing anything. This tells you where the project is and what needs fixing.

**Step 2 — Check current state:**
```powershell
cd C:\Projects\ai-poker
git log --oneline -10
git status
```

**Step 3 — Run locally to see what it looks like:**
```powershell
cd C:\Projects\ai-poker
npm start
```
Then open http://localhost:8765 in a browser. Use Chrome DevTools device toolbar set to iPhone 14 Pro Max to see the mobile view.

---

## The Parallel Worktree Workflow

This is how we build features fast. Multiple Claude Code instances each work on their own git branch simultaneously, then we merge everything into main.

**Creating a new worktree — REQUIRED PRE-FLIGHT:**

Before sending any worktree commands to the user, Cowork chat MUST run these checks first or it will silently reuse stale branches and create add/add merge conflicts later:

```powershell
cd C:\Projects\ai-poker
git worktree prune                  # removes stale "prunable" worktree records
git worktree list                   # confirm only live worktrees remain
git branch                          # confirm the branch name you plan to create does NOT already exist
```

Then create the worktree:
```powershell
git worktree add -b feature/my-feature ../ai-poker-myfeature
```

**After creating, verify the worktree is on current main, NOT a stale branch:**
```powershell
git -C ../ai-poker-myfeature log --oneline -1
git -C ../ai-poker-myfeature merge-base HEAD main
```
The first command's commit must match `git log --oneline -1` on main. If not, the worktree picked up a stale branch — destroy it (`git worktree remove ../ai-poker-myfeature && git branch -D feature/my-feature`) and start over with a different name.

Note: if you intentionally want to resume an existing branch, drop the `-b` flag:
```powershell
git worktree add ../ai-poker-myfeature feature/my-feature
```
But this is rarely the right call — fresh branches are safer.

**Running Claude Code in a worktree:**
```powershell
cd C:\Projects\ai-poker-myfeature
claude --dangerously-skip-permissions --model claude-sonnet-4-6
```

**Model selection:**
- `claude-sonnet-4-6` — standard UI work, CSS, component porting, most tasks
- `claude-opus-4-6` — complex architecture, new backend systems, anything that requires deep reasoning
- `claude-haiku-4-5` — trivial single-file fixes only

**Prompt format for Claude Code agents:**

Two valid shapes — pick based on tree size:

**Single-task prompt** (one issue, one commit):
1. What files to read first (always read before touching anything)
2. What the task is, with specific file paths
3. What NOT to touch
4. End with: `npm run build:client from repo root. Once done: git add -A && git commit -m "type: description". Do NOT push.`

**Megaprompt** (issue tree of N related sub-tasks, N commits — preferred when sub-tasks share file context):
```
TASK GROUP — [domain-level description]. N sub-tasks. Each gets its own commit.

READ FIRST, in full:
1. [list every file every sub-task needs — read once, write many times]
N. read-me-claude/HOW_WE_WORK.md

SUB-TASK 1 — [name]
[detailed instructions, exact file paths, what to change]
Commit: `[message]`

SUB-TASK 2 — [name]
[...]
Commit: `[message]`

CONSTRAINTS [global to the whole tree]:
- Do NOT touch [files reserved for other terminals]

WHEN ALL DONE:
- Final npm run build:client must pass
- Do NOT push

REPORT BACK with: one line per sub-task — what changed, commit SHA.
```

Megaprompts are preferred for trees because Claude Code reads the file context once and applies several related changes coherently. Single-task prompts are fine for one-off fixes that don't share context with anything else.

---

## Issue Tree per Terminal

Each terminal owns a worktree, a branch, and a tree of related issues. Cowork chat sends prompts to that terminal one after another — each prompt produces a commit on the same branch. Merging happens once, at the end, when the tree is exhausted.

**Why it works:**
- Claude Code already has the file layout in its context. Second and third prompts run faster than the first.
- Related fixes ship together: one branch, one merge, one rebuild on the VPS.
- Fewer worktrees to track. Fewer merges to sequence.

**Rules:**
- Every issue in a terminal's tree must touch the same scope (same files or same feature). Don't expand into another terminal's territory mid-tree — that creates merge conflicts.
- **If two issues would touch the same file, fold one into the other's tree as a follow-up prompt.** Never run them as parallel branches. The 2026-05-07 session shipped T2 and T4 as parallel branches both editing AgentsTab.jsx — produced a content conflict that took ~10 minutes to resolve manually. T4 should have been a follow-up in T2's terminal.
- Each prompt is still self-contained: read-first list, the task, what not to touch, build, commit, do not push.
- Each prompt produces its own commit. That way one bad prompt can be reverted with `git revert <sha>` without losing the others.
- Don't merge until the tree is exhausted (or until Cowork tells you the tree is being closed for batched merging).

**Per-terminal tracking format (Cowork keeps this):**
```
T3 — fix/analysis-panel — C:\Projects\ai-poker-table
  ✓ Gate AnalysisPanel on spectator mode (ec84840)
  ✓ Chat bar sticky + WatchBanner spacing (next commit)
  · open: (anything else, or close the tree)
```

**Ending the tree:**
When no more related issues exist, paste the terminal's last output to Cowork chat. Cowork sequences the merge across all terminals to minimise conflicts. Don't merge unilaterally.

---

## Session Discipline — 3-4 Long-Running Terminals

A SESSION is a working block (a few hours). One session has at most 3-4 active terminals. Each terminal is a long-running Claude Code process inside a long-lived worktree directory. The branch INSIDE each terminal cycles per tree; the directory itself does NOT get destroyed or recreated between trees. **Do NOT spin up a new worktree for every prompt or every batch.** That's how the 2026-05-07 session ended up with 15 worktrees — almost all of them already-merged dead clutter.

**Domain split — pick a fixed role per terminal:**
- **Terminal F — frontend UI.** Owns `client/src/components/*` and `client/src/styles/*`. All UI ports, polish, layout, components live here.
- **Terminal B — backend / game logic.** Owns `src/server/*`, `src/agent/*`, `scripts/*`. Engine, WebSocket protocol, agent handler, smoke tests.
- **Terminal D — design ports.** Reads from `design-refs/` (and from `codex/design-refs-build` branch when needed via `git show`). Writes new ports into `client/src/`. Useful when Codex has dropped fresh designs and we're catching up.
- **Optional Terminal Q — quick fixes.** A single-purpose terminal for one-off fixes that don't fit a domain. Use sparingly.

Each terminal sits in its own worktree, e.g. `C:\Projects\ai-poker-frontend`, `C:\Projects\ai-poker-backend`, `C:\Projects\ai-poker-design`. The Claude Code process inside that worktree stays running for the whole session. Naming the worktree after the DOMAIN (frontend / backend / design) — not after the feature — makes it obvious which terminal owns which file types.

**Branch cycling within a terminal (the part that's NEW in this rule):**

When a tree finishes and Cowork merges the branch into main, the terminal does NOT shut down. It rolls to the next tree on a fresh branch. **Use `git checkout -B` (capital B) — git only allows one worktree per branch, so `git checkout main` fails inside a non-main worktree because main is already checked out in `C:\Projects\ai-poker`.**
```powershell
# Inside the terminal's worktree, AFTER Cowork merges the branch to main:
git fetch origin
git checkout -B feature/next-tree main   # creates or resets feature/next-tree to main's commit
# Continue with the next megaprompt.
```
`-B` (capital) creates the branch if missing OR forcibly resets it to the target commit — works without checking out main first. Same Claude Code process, same files in disk context, fresh branch state. No new worktree. No add/add conflict potential because the branch is freshly cut from up-to-date main.

**If `-B` shows uncommitted changes blocking the reset**, run `git status` first and decide: stash with `git stash` if the changes matter, or `git reset --hard` if they're junk, then retry the `-B`.

**When to parallelise vs. when to serialise:**
- Each task >30 min of Claude Code work → run terminals in parallel. Wallclock savings dominate.
- Each task <15 min → serialise into ONE terminal as multiple sub-tasks in a megaprompt. Spinning up a second terminal for a 10-minute task adds more orchestration overhead than it saves.
- 15-30 min: judgment call, but lean serial unless file scope is genuinely independent.

The 2026-05-07 session shipped four parallel terminals for what should have been two. Result: file overlaps, conflicts, and wasted wallclock on merge resolution. Lesson: prefer FEWER bigger terminals over MORE smaller ones.

**Per-session ledger that Cowork keeps:**
```
SESSION 2026-05-07
T-F (frontend) — feature/cleanup → C:\Projects\ai-poker-frontend
  ✓ Remove HomeTopBar (sha)
  ✓ NOTES → CHAT tab in AnalysisPanel (sha)
  · branch ready to merge

T-B (backend) — fix/watch-opponent → C:\Projects\ai-poker-backend
  ✓ House opponent + leave-bug + double-confirm (sha, sha)
  · branch ready to merge

T-D (design) — feature/table-redesign → C:\Projects\ai-poker-design
  · running: oval-felt port

(idle: no terminal Q open)
```

**Cleanup after EACH merge — non-optional:**

After Cowork merges a branch into main, run in `C:\Projects\ai-poker`:
```powershell
git worktree prune
git branch -d feature/just-merged   # safe delete; only succeeds if fully merged
```
Then in the terminal's worktree, cycle to the next branch as shown above. Do NOT delete the directory.

**Cleanup at end of session:**
Delete every dead branch and prune git's worktree records:
```powershell
cd C:\Projects\ai-poker
git worktree prune
git branch --merged main | findstr -v "main" | xargs -L1 git branch -d  # remove merged branches
git branch -D <names of branches that were never merged but are abandoned>
```

The dead worktree DIRECTORIES on disk you can leave (harmless once `git worktree prune` has cleared their git records) or remove via File Explorer. They don't affect git.

---

## Merging Branches

Always merge in order from smallest to largest change. After each merge, fix conflicts before moving to the next.

```powershell
cd C:\Projects\ai-poker
git merge feature/branch-name --no-edit
```

**If there are conflicts:**

For an `add/add` conflict (both branches independently created the same file — usually from a stale-base merge): keep both content blocks. The safest path is for Cowork chat to use its Edit tool directly on the file rather than running a Python `re.sub` script — those scripts have repeatedly truncated rules at the conflict boundary, leaving unclosed CSS blocks that break the build.

For a `content` conflict (both branches modified the same lines of an existing file): Cowork chat reads the conflicted file via Read, identifies what each side intended, and uses Edit to replace the conflict block with the merged result. Faster and safer than scripting.

Last resort — to take the feature branch version wholesale:
```powershell
git show feature/branch-name:path/to/file | python -c "import sys; open('path/to/file','w',encoding='utf-8',newline='\n').write(sys.stdin.read())"
git add path/to/file
git commit -m "merge: resolve conflict in filename"
```

**Never use PowerShell `>` redirect** — it creates UTF-16 files that break the Vite build with `ERROR: Unexpected "?"`.

If you accidentally do it, fix with:
```powershell
python -c "
raw = open('path/to/file','rb').read()
if raw[:2] in (b'\xff\xfe', b'\xfe\xff'):
    text = raw.decode('utf-16')
    open('path/to/file','w',encoding='utf-8',newline='\n').write(text)
    print('Fixed')
"
```

---

## Building and Deploying

**Build locally:**
```powershell
cd C:\Projects\ai-poker
npm start
```
This builds the client and starts the server. Open http://localhost:8765.

**Deploy to VPS:**
```powershell
cd C:\Projects\ai-poker
git push
```
Then open a new terminal and SSH to the VPS:
```
ssh root@46.62.169.246
cd /opt/aipokers
git pull
pm2 restart all
```
Note: The VPS path is `/opt/aipokers` (with an 's'). PM2 runs `npm start` which auto-builds the client.

**Check VPS logs:**
```
pm2 logs
```
To exit pm2 logs: press `Ctrl+C`. If that does not work, close the terminal and open a new SSH session.

---

## Common Mistakes to Avoid

**1. Redesigning instead of porting**
The nav bar, home screen, table, cards — Codex already designed all of these. They are in `design-refs/`. Claude must PORT them, not redesign from scratch. Before writing any UI code, check: does design-refs/ have this? If yes, use it.

**2. Touching too many files at once**
Each Claude Code agent should touch as few files as possible. If an agent is fixing the chat input zoom, it should ONLY touch globals.css. It should not also rewrite CreateAgent.jsx "while it's in there."

**3. Running 5+ agents in parallel without tracking what each one does**
Maximum 3-4 agents at once, each in its own DOMAIN-named worktree (frontend / backend / design). Do not exceed four. Write down what each terminal is working on so you do not lose track. See "Session Discipline" above.

**4. Merging without checking what changed**
Before merging a branch, do:
```powershell
git diff main..feature/branch-name --name-only
```
This shows which files changed. If globals.css changed by 6000 lines, something went wrong (full reformat). Cherry-pick only the files that actually matter.

**5. Writing prompts that say "redesign" or "build" when the design already exists**
Always phrase it as: "Port design-refs/X.jsx into production component Y.jsx." Never say "create a new design for X."

**6. Spinning up a new worktree for every batch of work**
The 2026-05-07 session ended with 15 worktrees, almost all dead branches that had already merged. Don't do this. The right pattern: 3-4 long-running terminals per session, each in a domain-named worktree (`ai-poker-frontend`, `ai-poker-backend`, `ai-poker-design`). When a tree merges, **cycle the branch inside that same worktree** (`git checkout main && git pull && git checkout -b feature/next`) — do NOT create a new directory.

**7. Running parallel terminals on tasks <15 min each**
Wallclock savings of parallelism don't justify the orchestration overhead for small tasks. If a terminal's whole tree is under 15 minutes of Claude Code work, fold it into ONE terminal as sequential megaprompt sub-tasks. Reserve true parallel terminals for trees >30 min each.

**8. Pasting placeholder values from Cowork instructions verbatim**
When Cowork chat says `[Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "sk-ant-PUT-YOUR-KEY-HERE", "User")` — that's a TEMPLATE. Replace `sk-ant-PUT-YOUR-KEY-HERE` with the actual key before running. Pasting the template literally sets the env var to the literal string `sk-ant-...`, which Anthropic rejects with 401, which causes the agent to fold every hand. Cowork chat should call placeholders out explicitly: "REPLACE THIS BEFORE RUNNING".

---

## How Jens Likes Prompts Delivered to Him

When Claude (in Cowork/chat mode) writes a prompt for Jens to paste into a Claude Code terminal, it must include:

1. **Which directory to be in** — exact `cd` command
2. **Which command to run** — exact `claude --dangerously-skip-permissions --model X` command
3. **The prompt itself** — in a code block, ready to paste
4. **What to do once done** — exact git and deploy commands

Example format:
```
Terminal 1 — ai-poker-home (feature/home-redesign)

cd C:\Projects\ai-poker-home
claude --dangerously-skip-permissions --model claude-sonnet-4-6

[paste this prompt:]
---
Read design-refs/home.jsx in full first.
Then port the ExistingHome component into client/src/components/HomeTab.jsx...
[specific instructions]
Do not touch App.jsx, globals.css, or any backend files.
Build: npm run build:client from repo root.
Once done: git add -A && git commit -m "feat: port home screen from design-ref"
---

Once it commits, come back here and I will give you the merge + deploy commands.
```

---

## End of Session Checklist

Before ending a session, always:

1. Make sure all feature branches are committed (no uncommitted changes)
2. Merge into main: `git merge feature/X --no-edit`
3. Build passes: `npm start` runs without errors
4. Push: `git push`
5. Update `CHANGELOG.md` with what was done
6. Update `BUGS.md` with any new bugs found
7. Update the master spec docx (agentic-poker-master-spec-vX.docx) — increment version, add changelog row
8. Save memory: update any relevant memory files in the memory system

---

## VPS Info

- IP: 46.62.169.246
- Path: /opt/aipokers (note the 's')
- Process manager: PM2
- Domain: agenticpoker.app
- SSL: Let's Encrypt (auto-renew)
- ANTHROPIC_API_KEY: set in /root/.bashrc, loaded via pm2 restart --update-env

