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

**Creating a new worktree:**
```powershell
cd C:\Projects\ai-poker
git worktree add -b feature/my-feature ../ai-poker-myfeature
```
Note: if the branch already exists, drop the `-b` flag:
```powershell
git worktree add ../ai-poker-myfeature feature/my-feature
```

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
Every prompt sent to a Claude Code terminal must follow this structure:
1. What files to read first (always read before touching anything)
2. What the task is, with specific file paths
3. What NOT to touch
4. End with: `npm run build:client from repo root. Once done: git add -A && git commit -m "type: description"`

---

## Merging Branches

Always merge in order from smallest to largest change. After each merge, fix conflicts before moving to the next.

```powershell
cd C:\Projects\ai-poker
git merge feature/branch-name --no-edit
```

**If there are conflicts:**
The safe resolution for source files is always to take the feature branch version:
```powershell
# DO NOT use > redirect. Use Python instead:
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
Maximum 2-3 agents at once. Each one gets a clearly scoped task. Write down what each terminal is working on so you do not lose track.

**4. Merging without checking what changed**
Before merging a branch, do:
```powershell
git diff main..feature/branch-name --name-only
```
This shows which files changed. If globals.css changed by 6000 lines, something went wrong (full reformat). Cherry-pick only the files that actually matter.

**5. Writing prompts that say "redesign" or "build" when the design already exists**
Always phrase it as: "Port design-refs/X.jsx into production component Y.jsx." Never say "create a new design for X."

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

