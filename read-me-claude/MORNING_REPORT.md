# Railbird — morning handoff, 9 September 2026

The overnight revision is substantially closer to the design, but the full specification is **not complete**. The remaining items below are real gaps, not a claim that passing tests makes every frame finished. No production deployment or Claude/Opus sign-off is claimed.

## What changed

- Home and casino use one contextual navigation band and the available phone width. The kitchen table remains functional; wants have one answer surface rather than duplicate speech over the felt.
- Board 42 companion, conversation, compact mobile profile, roster, absence and TV states are connected to actual stored data and authenticated actions. Failed messages remain recoverable. The casino gains its bottom conversation band.
- Birth identity persists, the draft stays at four stages without a collar, long conversations scroll correctly, and the actual guest first-agent room follows the reference. Desktop's forming preview now sits over its real table beside the recruiter.
- Home games follow the five-minute play / ten-minute break cadence, with explicit placement still supported. Agent routines remain visible during breaks.
- Large-win/bust visual effects were added while preserving the Watch presentation Jens likes. Desktop casino recordings now open, preserve recorded end state and return correctly; unknown recorded stacks stay unknown.
- Desktop uses the wider 560×700 reference room with shared furniture, routine, seat, carry and speech-clearance coordinates.

Seventeen reviewable batches contain the work. Details and per-batch evidence are in OVERNIGHT_DESIGN_WORK.md, DESIGN_GAP.md, BUGS.md and CHANGELOG.md. Reference/actual pairs are committed under client/e2e/shots/overnight-batch*.png.

## Final verification

- Full repository gate: 105 server tests passed (two intentional live skips), 2,181 client tests passed (two pre-existing todos), all seven end-to-end verifiers passed.
- 36 recovered browser checks passed: desktop, draft, guest entry and Jens's four-agent/pending-want table-click regression at both short and tall phone heights.
- Current production build passed. Fresh scratch-server smoke: all four passed. Home interaction suite: all 20 passed, with the old BUG-43 skip repaired.
- Final wider desktop and guest pairs were inspected. The additional crop audit independently reconfirmed C1; the broader optional recrop stopped at C7b and is not represented as complete.
- One Windows share-test child crashed without a JavaScript assertion. It passed in isolation and the complete rerun passed. BUG-94 retains the unexplained failure; no assertion was weakened or skipped for it.

The verification processes stopped around 04:56 and were no longer running when inspected at 08:53. Work was recovered and the final gates rerun. The intervening hours must not be counted as productive execution. The overnight heartbeat was paused at the planned 09:00 cutoff.

## Still required before full design/spec sign-off

1. Port the long /welcome page from the approved design using actual product components/screens, rather than shipping the archive's React/Babel design canvas.
2. Finish C9's compact CONDITION/RECENT desktop profile and latest header; refine guest empty-roster presentation and remaining fixture details.
3. Audit the remaining generated-possession/rare-hood states and remaining board-41 brand deliverables against the archive. Persisted hood/glow and no-collar birth are implemented; this is not a claim that every proposed item is drawn.
4. Complete the broader reference-state inventory and visual acceptance pass. Undesigned visit/referral/share/fast-forward states and the future coordinated room-routine wave must stay explicitly identified rather than invented.
5. Resolve replay metadata debt: desktop decision/snapshot equity consistency and unavailable historical condition/identity data require an honest presentation.
6. Select the reference's still-unspecified celebration audio files. Existing Watch cards/strip remain by Jens's explicit preference.
7. Verify real deployment settings and a production playtest: guest rollout flag, actual Telegram bot username, public URL/share configuration and deployed commit. These were not changed or assumed from sample branding in the archive.

## Deploying this reviewed revision

Main is to be prepared only after the final gates. The final chat message confirms that state. In PowerShell, the existing workflow is:

```powershell
Set-Location C:\Projects\ai-poker
git push origin main
```

A push starts deployment; it does not itself prove the new build is live. Check the successful deployment's commit, reopen the Mini App, then exercise Home table, casino, companion and first draft. This revision is available for Jens's playtest; full friends-shareable/spec completion is still an open goal.

The project has a working gameplay foundation. The main process gap was treating code and test completion as proof of visual completion. The paired renders now make that difference visible and reviewable.