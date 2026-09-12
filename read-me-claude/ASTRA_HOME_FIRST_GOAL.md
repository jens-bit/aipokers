You are Astra, the builder on Railbird. Read
read-me-claude/HOW\_WE\_WORK.md and read-me-claude/ASTRA\_NIGHT.md first.

Jens pushes. Never push, touch the VPS, edit env files, revoke keys
or print keys.

THE PRODUCT DIRECTION: HOME FIRST.

Home is the main experience and the default destination after the
existing entry/onboarding flow. It is the room where your agents live,
interact and play home games. The casino is a destination reached from
Home. “Floor first” may describe the first view INSIDE the casino;
it must never mean replacing Home as the app’s starting screen.

The priority is making Home match our existing design references and
feel coherent, alive and ready to show friends. Preserve the Watch
experience that already works well.

START AND EXISTING WORK

Inspect the current branches, worktrees and pending changes first.
Resume your existing isolated worktree where appropriate. Do not
discard unfinished work or switch another builder’s dirty checkout.

Leave other builders’ fix/\* and feat/\* branches alone.
Pull --ff-only when the relevant main checkout is clean.

SHOW-1 landing, SHOW-2 casino motion and SHOW-3 narration already have
local work. Read their recorded gates and commits; do not rebuild them.
Preserve unfinished SHOW-4 changes and finish them under job 4 below.

FOUR JOBS, IN THIS ORDER

1. HOME-1 — match the room to the design.

Inspect the actual Home screen alongside the relevant current design
frames before editing. Identify the concrete differences and repair
the existing screen: room composition, usable screen space, header,
roster control, agent labels, speech bubbles, furniture and casino door.

The home poker table must remain present and usable. Do not remove it
because a reference depicts a quiet or one-agent state. Support the
different room states using the existing design and product rules.

Avoid duplicate navigation and oversized controls. Use the existing
artwork, components and design language.

2. HOME-2 — make the room feel alive and believable.

Repair existing room behaviour where needed: agents should not remain
stacked in the same position, speech should not repeatedly spam the
same event, and every agent should not perform the same activity in
lockstep.

Use actual agent and room state. Preserve quiet moments. Do not invent
players, games, activity counts or chat to make the room look busy.
Improve existing deterministic fallback dialogue where necessary;
add no model calls.

Keep bubbles readable without covering important controls or the table.

3. HOME-3 — make the existing journeys work.

Verify and repair the main paths:

- Open Home and find your agents and roster.
- Tap the home table to watch or join.
- Open an agent’s Chat and Profile, see their stats, and return easily.
- Enter the casino deliberately and return Home.
- Return from watching or playing without losing your place.

Check phone layout first. Keep navigation consistent and preserve
existing guest, Telegram and deep-link behaviour.

Fix failures in existing flows. If a required screen or interaction
has no design, record the exact gap rather than inventing a new design.

4. SHOW-4 — finish the moment.

Finish the preserved celebration work against design-refs board 26,
frames 52p/q/r: authored result styling, pot number punch, chips moving
to the actual winner, winner reaction and sound when sound is enabled.

Handle opponent wins and split pots truthfully. Wait for the visible
all-in reveal before announcing or sounding the result. Keep owner-only
card information private.

Retain the completed narrator and landing/floor improvements. Change
them only if a concrete regression is found.

WORKING RULES

- Each job gets its own branch and merges --no-ff into local main only
  after its gates pass. Never merge unfinished work.
- Make a checkpoint commit at least every 60 minutes. Label unfinished
  checkpoints clearly; checkpointing does not mean the job is verified.
- Run npm run test:all once at the end of each job. Use focused checks
  during development. Investigate failures honestly.
- Browser-check only affected screens. Phone first; desktop when the
  change affects desktop layout or behaviour.
- At most three design comparison pairs across this revised run:
  prioritise Home, then the celebration. No inventory-wide rendering.
- For known Node crash 3221226505, retry once; if it repeats, record the
  blocked gate and continue unaffected work. Do not chase the harness.
- No new screens, dependencies or model calls. WatchScreen stays eager.
- Use the existing design refs. Record unresolved design gaps rather
  than claiming a complete match.
- After each job update ASTRA\_NIGHT.md, CHANGELOG.md and BUGS.md with
  changes, commit hashes, actual gate results and “resume from”.
- Record the run’s start and six-hour deadline. Do not reset that clock
  on a resume. Stop after these four jobs or the deadline, whichever
  comes first. Do not start a fifth job.

FINAL HANDOFF

Explain what changed, what remains unfinished, what was actually tested,
and what is local versus deployed. Give Jens exact PowerShell commands
from the correct checkout when the verified changes are ready to push.

Success means Home feels like the designed home of these characters,
and its existing journeys work clearly. Casino spectacle supports that
experience; it does not take priority over it.



Do not run the full browser suite or test:all more than once per job. If you

find yourself running gates back to back, stop and commit instead.