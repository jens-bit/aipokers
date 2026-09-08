# Astra repair and integration — 2026-09-08

Jens asked for repairs after the initial audit, explicitly cancelled the collar stage, and asked Astra to perform the usual integrator checks while Claude was unavailable. This batch addresses the confirmed security failures and a first set of home problems. It does not certify the whole product as ready to share.

## What changed

- **Identity and ownership (BUG-47/48):** malformed Telegram hashes no longer authenticate. Every agent mutation checks the authenticated owner against one normalized request identity. Conflicting query/body identities fail before mutation. Old queue/finish clients now send the credential they already possess.
- **Private records (BUG-49):** public agent projections no longer spread persisted storage. Draft chat, strategy, memory, flagged cards and reasoning remain private; private session reads are scoped to the requested owner and agent. Hand history requires ownership and removes opponents' unrevealed cards and private decisions from legacy records at read time.
- **WebSockets (BUG-50):** public observers receive viewpoint -1, with no private cards, equity, reads or seat controls. Telegram owners authenticate and can watch their own seated/deployed agent. Guest cookies are read from the upgrade request. JOIN player ids are namespaced by authenticated owner. The existing development-secret workflow is preserved, with test sockets now transmitting that secret. Message names are unchanged.
- **Failed drafts (BUG-46):** both finish paths return a retryable 503 and preserve the conversation on model errors or malformed output. Keyless deterministic fixtures still work. This prevents a failed paid build silently becoming an unwanted fallback agent. No production agent was removed.
- **Home layout (BUG-51):** the room now uses the design's 390 × 612 coordinate system. The first-agent action clears the TV; the browser regression measures the gap and clicks through to the recruiter. Desktop uses the same coordinates.
- **Guest entry (BUG-52):** the real recruiter mounts directly. The former lazy import introduced a blank Suspense state despite App already being imported by the entry point. Build output confirms the entry remains about 490 KB; this is a mount correction, not a claimed bundle-size optimization.
- **Agent taps (BUG-54):** selecting a body selects that agent whether standing or seated. The felt itself opens the table. This intentionally supersedes the older BUGS-C-3 test rule and is a partial step toward board 42, not the finished large agent view.
- **Tests (BUG-53 / BUG-34):** desktop tests now navigate through Floor → Board before asserting the building layout. Referral verification closes its HTTP, WebSocket and SQLite handles and allows natural process exit, addressing the native Windows abort observed after that script printed PASS. The broader BUG-34 investigation stays open.
- **Founder override:** removed the collar stage and geometry from the reference. The four-stage draft is intentional. DESIGN_GAP.md records the override so it cannot become a missing-feature request again.

## Evidence and checks

Regression tests were run against the failing behavior before repairs: malformed signature acceptance; cross-owner writes; private profile/flagged/session/history reads; unauthenticated WATCH/JOIN; malformed model output; the room-height collision; and the inconsistent seated-agent tap. The pre-existing recruiter mounting failure was reproduced without changing its assertion.

The new HTTP/WebSocket security suite uses synthetic owners, locally signed fake credentials and an isolated SQLite database. The model-output tests intercept the provider request; no real model call is made. Browser smoke uses a fresh scratch directory, disabled notifications, no credentials/model key, raised test rate limits and short hand pauses, as required by HOW_WE_WORK.md.

Completed checks for this repair batch:

- Server: `npm test` — 103 passed, 2 skipped (105 outer harness checks).
- Client: `npm run test:client` — 145 files passed; 2103 passed, 2 todo, including the private-memory credential regression.
- Gameplay: `npm run test:e2e` — all 7 outer checks passed, including all 6 full-stack scripts (~93 seconds).
- Build: `npm run build` in client — passed, 191 modules. Existing ReplayTheatre static/dynamic import warning remains.
- Built browser smoke: 4 passed (phone and desktop).
- Phone layout/touch suite: 19 passed, 1 existing skipped gesture test (BUG-43).
- Desktop browser suite: 15 passed at 1440/1920 widths. The fixture does not mock every background API and logs harmless dev-proxy connection errors; the built-client smoke is the console-error gate.
- Empty-room browser regression: passed; draft action is visible, separate from the TV, and opens the recruiter.

Visual review: `client/e2e/shots/astra-home-empty-pair.png` renders board 29 F01 on the left and the actual repaired phone on the right. Astra inspected both this pair and the desktop/home screenshots. **Partial match:** TV/action separation is fixed. The reference includes simulated iOS chrome; the product capture does not. Header/branding, furniture detail, safe contents, empty-room table composition and bottom-thread treatment still differ. These are real gaps, not passed pixel-parity claims.

Claude/Opus has not reviewed this batch. Astra performed the requested integrator/code/pair review. Jens still needs to playtest the deployed product. No production database, paid model run, notification setting or deployment was changed by the repair checks.

## What still prevents “ready to share”

1. Port the remaining home frames using small reference/product pairs, starting with the empty-room composition, furniture treatment and room bubbles/wants. Keep one authoritative geometry model.
2. Complete board 42 C1–C4 (the large agent view and actions), then the roster and TV states. Existing owner projections already include sessionDips; the presentation is missing.
3. Finish the Railbird brand import in the actual client, landing and app assets. Reference files alone do not change the shipped app.
4. Implement the designed celebrations and finish the planned guest/notification rollout with a real phone playtest.
5. Continue BUG-34's broader Windows investigation and the existing skipped gesture regression. This batch repairs the observed referral shutdown path, not every possible native-runtime flake.
6. Remaining audit hardening: Mini App credential age limits, proxy-aware rate-limit identity and WebSocket payload/message-rate bounds. These have not been silently marked fixed. Broader authorization/privacy review remains prudent as other routes evolve.

The recommended next investment remains home/design parity. Adding 3D animation now would add another implementation to reconcile before the first visit is clear.

## Integration and pushing

Repair branch: `codex/security-home-repair`, based on main `de08fbf`. The initial working tree contained Claude's pending design-58 import; it was preserved. The final integration includes that reference import, Jens's collar override and the repairs as a single reviewed batch. No client/dist or scratch data is committed.

The final user-facing report will state the actual commit/branch status. Only after that report says main is ready, Jens can run in PowerShell:

```powershell
Set-Location C:\Projects\ai-poker
git push origin main
```

This uploads the prepared commit and triggers the existing CI/deploy workflow. A successful upload is not proof of a successful deployment; the latest Actions run must finish green.
