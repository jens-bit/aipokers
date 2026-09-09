# Bug Report — Agentic Poker
Last updated: 2026-09-09 (Railbird design completion); statuses and evidence below.

### BUG-119 — sleeping agents wear the bored face — FIXED on design branch
The independent 101-sprite audit found exactly one missing drawing: asleep (62 different native-size pixels). Home still mapped sleeps to bored, whose eyes remain partly open. The later reference’s separate downward lids and size-dependent lash ticks are now ported and mapped to the served sleep routine. Three red checks preceded the repair; actual phone/desktop Home confirms waking removes the overlay. All 101 controlled sprites now match pixels.

### BUG-120 — the authored brow overrides have no gameplay caller — FIXED on design branch
The shared Watch path now applies the existing sanitized raisedAgainst event as a 400ms twitch, the owner's visible strong peek as a 700ms lift, and known heat >=55 as knit until cooler. Unknown/private opponent cards cannot trigger a peek. Five red regressions preceded the fix; real phone clocks at both heights verify the transitions without changing felt bounds.

### BUG-121 — expressions share one short clock and disappear when another seat acts — FIXED on design branch
Reactions now have independent per-seat timers: stunned 3s, smug 2s, locked 4s, bored 6s, wary 4s, pleased 3s. The next actor cannot erase the prior face; repeated settled STATE messages cannot restart a result. Hand/table changes and unmount clear timers. Existing server event mappings remain: this does not add the reference's unserved snack/nemesis/card-dead triggers.

### BUG-122 — the built app depends on external Google Fonts — FIXED dependency; original browser error unexplained
The first batch35 built smoke passed six journeys but failed the mobile noise check with net::ERR_NO_BUFFER_SPACE on a fonts.gstatic.com Playfair WOFF2 request. The underlying Chrome error is not diagnosed. The client now bundles the 29 original WOFF2 files from the supplied archive (596960 bytes), with verified variable-weight ranges, native Playfair italic, provenance hashes and five OFL licences. Two red browser tests proved fonts unavailable with Google blocked; both now load all ten requested faces without external font requests. Final 47 browser checks, seven built smoke journeys and 20 Home2 checks pass. This proves local font availability, not offline application support.

### BUG-117 — Home agents disappear instead of crossing the room — FIXED on design branch
A red same-DOM-body check reproduced unmount-on-departure. Home now retains away bodies invisibly at the door, disables their input, and uses the later reference’s 2.2s out / 1.9s home movement. Known away location overrides stale home-game membership without shifting other chair indices. Door light and away wall frame follow the crossing; room props are hidden and cards appear only on landing. Actual intermediate motion, identity, three viewport sizes and reduced motion pass browser checks.

### BUG-118 — returning session result vanishes at a home-game chair or never expires — FIXED on design branch
The broad browser run passed 41 cases but failed all three returning-result cases. A red unit check confirmed the ordinary speech collision rule suppressed the amount near the table. A separate compact, noninteractive amount now rides above the body. A second red check proved an unrelated roster refresh restarted the six-second timer; clearArrival is now stable. Both regressions and final focused browser checks pass; large wants still use the sole answer strip.

### BUG-114 — a shared hand labels the whole pot as personal winnings/losses — FIXED on design branch
Red model checks reproduced both a falsely signed legacy pot and a split winner's net loss being shown as profit. Future flagged hands now store final stack minus the pre-blind starting stack; legacy records say "$… pot". Server captions and image models share the same amount function. Only validated hood/glow IDs accompany new records; owner/public filtering remains intact.

### BUG-115 — share output is square and retains old brand/bot defaults — FIXED on design branch
S1/S2 now use one painter for the 1080×1920 story and 1200×630 preview/export, Railbird stamp/filenames and a reserved card-back footer. IHDR dimensions reach Telegram photo metadata. Open uses the configured app URL or bot username. The default public serving domain is preserved until deployment configuration establishes its replacement; no account/domain change is claimed. Actual browser downloads match preview pixels at both phone heights. No external message was sent.

### BUG-116 — one long word can escape the share card — FIXED on design branch
The old word-only wrapper returned one 300-character line beyond the quote width. A red boundary check now passes with bounded character splitting and a visible ellipsis, including the final line. Long tracked names use their actual letter spacing when wrapped.

### BUG-112 — sound hooks report playback but the audio layer is a stub — FIXED on design branch
The red check received a heavy-hit descriptor before any audio device existed. Playback now requires an unlocked running context and schedules actual original buffers; muted/hidden/unavailable output returns null. C8 timing, bounded waveforms, buffer reuse and cancellation pass unit checks; real Chrome plays the watched win once and respects the actual mute button. Full 106/2225/7 gate and built smoke/Home2 pass.

### BUG-113 — owned phone Chat bypasses the only sound control — FIXED on design branch
The real browser entered the companion when pressing Chat and could not find Sound on. A compact toggle is now directly in that Watch header; desktop owned/public rails also expose the shared control. Internal thread-sheet routes retain their existing toggle. Final actual-UI audio and three-size C8 checks pass; header pairs inspected.

### BUG-111 — saved appearance disappears between Home and live tables — FIXED on design branch
Live STATE/liveGame/felt omitted hood/glow; Watch and casino ghosts ignored it, and normalizeFelts discarded it. Validated two-ID projections now reach every live renderer. Mood/camera/occupant changes preserve the right identity; private stored metadata and cards remain excluded. Red server, component and browser checks reproduced the break; final 106/2219/7 gate, 38 desktop, 7 built smoke and 20 Home2 checks passed. Reference pairs design-batch29-owned/public were inspected.

### BUG-108 — desktop Watch retains the old full-height canvas and Home cannot exit it — FIXED on design branch
The red browser check measured width/height 0.955 instead of the DkWatch reference's 900/648. DeskCasinoTable now uses shared WatchFelt in a canvas that fits both axes; owned/public modes keep their actual server camera and served cards. The contextual 54px header replaces the old stage tabs, and Back home clears Watch and sends Leave. The current conversation rail retains stored/live speech and whispers; legacy analysis placeholders are not shown in this newer frame. Browser checks cover two wide sizes plus a 1280×600 resize, phone-like face/card presentation, exact owned/public rights, focus through the ghost, retained casino room and actual deployment. Replay retains its existing separate renderer.

### BUG-109 — broad desktop draft test times out during the full gate — OPEN, query scope mitigated
The first batch28 full gate exceeded the existing five-second test limit while preserving a draft across roster selections. Its helper scanned accessible buttons across the entire room and multiple SVG trees. It now searches inside the permanent roster without changing the selected role/name or any assertion. The focused draft check took 1.17 seconds afterwards. Resource contention is plausible but not proven; no timeout was raised and no assertion skipped. The subsequent full client gate passed 2214 checks.

### BUG-110 — marketing exporter intermittently waits for an unmounted Home — OPEN, diagnostics added
The first batch28 export stopped in the phone Sit fixture's initial home.room mount. The exporter previously lost its page evidence while closing the browser. It now logs completed scenes/page errors and captures failed page text/PNG with a concise error. The diagnostic run completed all ten screens without a page error; the original cause is not reproduced or declared fixed. This is a capture-tool finding, not an observed production failure.

### BUG-105 — casino Watch opens a socket without a desktop stage — FIXED on design branch
Both public and owned casino felt clicks failed a browser assertion for the missing table before repair. Desktop now selects the owned Watch when the table belongs to its roster, or a public stage with supplied table speech and no private composer, analysis/history or seat controls. The assigned server seat wins over duplicate display names. Back and Escape leave the subscription; roster changes leave only when a table is actually active. The desktop floor and explicit selected room are restored after watching. Sending an agent through the casino opens the owned stage and refreshes the roster, and starting a draft leaves it. A fresh built-server sequence passed actual queue/Watch/Back/felt-Watch/Leave. Final full gate and visual evidence follow before integration.

### BUG-106 — queue-selected blinds are dropped by App's Watch request — FIXED on design branch
Red-first checks reproduced a phone 25/50 queue and desktop 5/10 queue both sending WATCH at 10/20. Both App deployment paths now preserve the queue response's smallBlind/bigBlind (with its stakes object as fallback). The server's matched table price remains authoritative. Both exact-wire regressions pass; no poker engine change.

### BUG-107 — desktop newborn observer calls a removed setter — FIXED on design branch
A roster refresh introducing a new ID reproduced ReferenceError: setSelectedId is not defined and an empty desktop. Arrival now clears the surviving homeFocusId/homePanel state. The unit test verifies the birth card and its agent-specific Deal action after an existing conversation; a browser test continues through the real desktop routing to casino placement and an owned Watch stage without a page error. The placement screen intentionally uses the room-selection tray, not the ordinary floor-view component; the initial browser assertion was corrected to exercise its Deal action.

### BUG-104 — desktop casino Floor repeats the shell header — FIXED on design branch
CasinoScreen now renders its actual room title, counts and Floor/Board control into the existing 54px desktop header. The floor's second heading/return row is absent, Board retains the same control, and returning to Floor preserves its selected room. The shell's Home return stays available; a placement can still be cancelled. A red unit test confirmed the missing shared context; 83 targeted tests and all 27 desktop browser cases pass after the repair. The new header context assertion intentionally replaces the old generic The casino assertion on Floor. Reference/actual pair: client/e2e/shots/design-batch24-casino-1280.png. Phone headers are unchanged.

### BUG-99 — desktop kitchen table exposes neither Watch nor Sit — FIXED on design branch
Running home games now expose Watch and Sit in the table panel and open a visible desktop stage through App’s actual watch/join/action/leave hooks. DkOwnerM’s 900×648 felt fits both axes; owner cards and equity use the compact desktop form and clear the board and betting panel. The current roster and shared room conversation remain permanent. Red-first entry and frame-ratio checks preceded the repair. Six browser cases cover both modes at 1280/1440/1920 plus short-window resizing. A fresh built-server smoke verifies watching, joining, opening BET, a FOLD reflected in the server seat, and both Leave messages. Marketing now captures the matching table state and publishes the desktop example; both reference pairs were inspected. This does not certify generic casino Watch navigation.

### BUG-100 — desktop condition labels cross the stack and equity — FIXED on design branch
A browser capture measured the condition group's top at 846px against the numbers' bottom at 858px: a 12px overlap. The strip still reserved six pixels after both bars acquired labels. Bottom padding now reserves both labelled rows. The exporter and desktop browser regression assert a clear gap. Evidence: artifacts/batch22-bodybars-red.log and batch22-capture-verified.log. Phone Watch is unchanged.

### BUG-101 — recruiter focus interrupts a long landing scroll — FIXED on design branch
At 375px, the room remained 32px below the viewport after the old 320ms focus timer interrupted scrolling. Reduced motion now scrolls immediately; ordinary motion listens for scrollend from the body's scroller and checks the room has arrived before focusing with preventScroll. A bounded fallback supports older WebViews; listeners/timers are cleared on a new action or unmount. Browser coverage includes a footer over 5000px away, real typing and both motion settings. The first normal-motion test incorrectly measured window.scrollY; it now measures the hero's actual offscreen position.

### BUG-102 — invite unit test exceeds five seconds in a full local gate — OPEN, mitigated setup
The first batch22 full client gate timed out in the new-visitor invite case; a focused run took about 1.8 seconds. Its newly minted guest incorrectly had a returning owner's household. The fixture now gives it an empty roster, and the exact-heading assertion is scoped to the mounted hero. Referral/heading assertions remain, without a timeout increase or skip. The subsequent full gate and final client run passed all 2199 checks. Resource contention is possible but unproven. Evidence: artifacts/batch22-test-all.log and batch22-test-all-final.log.

### BUG-103 — late casino tables keep a fixed-width floor — FIXED on design branch
The measurement effect ran before conditional ROOM_TABLES content existed and never attached when it arrived. Red unit cases measured 390px instead of 362 on phone or 663.83 on desktop; three real-browser regressions also stayed at 390. Measurement now attaches on content appearance and observes both axes. DkFloorStage's 390×470 coordinate space fits available desktop width/height with 30px horizontal and 20px vertical gutters, replacing the stale 520px cap; phone remains width-led. All six felt centers stay reachable through desktop resizes. The permanent 380px board and real room data are retained. Evidence: batch23-unit-red/green and browser-red/green logs, plus design-batch23-casino pairs.

### BUG-97 — desktop equity number disagrees with its own rope — FIXED on design branch
The rope read snapshot equity first but the number read only a spoken decision. A silent recorded beat showed 81% on the rope and a dash in the strip; a newer snapshot could also disagree with an older decision. Red regressions are in artifacts/batch21-red.log. Both now use the same snapshot/seat/decision precedence, including recorded completion. Browser checks verify 4% at the first recorded beat and 100% at its won ending.

### BUG-98 — replay fabricates a measured 45% heat bar — FIXED on design branch
Flagged hands do not record body condition. The hero's fallback heat of 45 was nevertheless printed as a measured body bar. Missing heat now omits that bar, as missing stamina already does. The neutral fallback drawing remains; it is not presented as historical condition. The desktop also uses the existing shared replay snapshot adapter, preserving private-card reveal timing and unknown stacks. Red regression confirmed the spurious 45% bar before repair.

### BUG-96 — seat-rebuild test assumes a random showdown cannot split equally — FIXED on design branch
The full gate failed in table.seats.test.js with all three banked stacks at 1000. Its checked-down random hand assumed somebody must win or lose; a shared winning board legitimately returns all three equal contributions. A deterministic royal-flush-board reproduction in artifacts/reproduce-bug96.mjs confirms that legal result. The rebuild fixture now folds two players to guarantee unequal balances before adding a seat. The original non-equal-stack, exact per-seat persistence, and 4000-chip conservation assertions remain; no game/dealer code changed. The original failed gate is artifacts/batch20-test-all.log.


### BUG-95 — retrying a refused desktop whisper duplicates an unsent line — FIXED on design branch
The desktop hook appended the user line before POST and kept it after a refused response, while the composer restored the same text for retry. The regression failed with that extra line before repair. Each optimistic message now has a stable ID and a failed send removes only that message. Retrying preserves the earlier saved history and adds one user line/reply. The compact desktop profile now shares this hook, so its whispers also survive returning to conversation without duplicating requests. Verified in hook/component tests and real browser retry flows at 1280, 1440 and 1920 widths.


### BUG-94 — Windows test child exits without a JavaScript assertion — OPEN, not reproduced in isolation
During recovery of the interrupted overnight gate, src/server/share.test.js exited 3221226505 after about 540ms with no child output. The same suite immediately passed alone through runScript with isolateCwd:true. An earlier client verification ended with Tinypool onUnexpectedExit around 04:56; its companion browser run stopped mid-suite. No matching verifier processes remained when inspected at 08:53. Cause is unproven; do not label this a product assertion failure or claim continuous overnight execution. Evidence: artifacts/batch17-recovered-test-all.log and batch17-share-isolated.log; the complete recovered gate is recorded separately. No test is skipped or weakened for this failure.

Batch31 main integration repeated this native exit in agentLifecycle.test.js (3221226505, empty child output, about 690ms). Three isolated runScript executions passed all 15 lifecycle checks; a read-only Application event query found no matching node.exe crash record. The complete main31 recheck passed 106 server / 2225 client / 7 e2e. These measurements do not establish the native failure cause. Evidence: artifacts/batch31-main-test-all.log, batch31-lifecycle-diagnostic.log, batch31-main-test-all-rechecked.log.




### BUG-92 — draft repeats the casino sign and covers its destination — FIXED on overnight branch
BirthScreen retained an older horizontal THE CASINO tag after HomeFlat acquired its vertical CASINO sign. The unit regression reproduced the duplicate. The draft now uses the one vertical sign and the reference's empty chair. Wave 61's half-height glass replaces the older fixed 206px edge, with a width-dependent minimum that keeps the whole sign above the glass in a wide, short Telegram window. At keyboard-sized heights the forming preview yields space to the conversation. Actual browser boxes verify clearance at 390 and 490 widths; the old jsdom parseFloat(top) assertion intentionally becomes the responsive rule because max()/container units cannot resolve to pixels there.

### BUG-93 — focusing the guest recruiter pulls the room below the screen — FIXED on overnight branch
The actual CTA browser check reproduced a 20px burgundy strip after scrolling, and a competing delayed BirthScreen helper left a 4px strip on desktop. GuestLanding now owns its scroll and focuses with preventScroll; embedded guest drafts do not run the second helper. Ordinary drafts keep keyboard assistance only when their field is actually outside the visible viewport. Regression tests cover visible/obscured fields and five real viewport sizes with an exact settled room origin, hit-tested typing, and shorter-height conversation access. A missing guestBoot prop forwarding introduced during this repair was caught by all five browser cases and corrected before the gate passed.

### BUG-89 — desktop casino Board drops the replay action — FIXED on overnight branch
App passed onReplay to DesktopHome, which neither read it nor forwarded a callback to CasinoScreen. An owned recorded-hand row therefore had no replay action. The regression failed on the disabled row before repair. DesktopHome now resolves the same owner-authorized shared-hand lookup into its own theatre; Back restores the casino's remembered Board selection. Expired recordings fall back to the actual companion. Browser checks exercise the real board row at 1440 and 1920 widths; the initial new test wrongly expected Floor after Back and was corrected to the existing persisted Board behavior.

### BUG-90 — desktop replay reports unrecorded stacks as zero — FIXED on overnight branch
Replay snapshots intentionally have stack:null, but the desktop stage replaced it with zero. The named regression failed on the hero's $0. Hero and opponent seats now show an em dash for missing values while real zero stacks remain zero. No recorded balance is invented.

### BUG-91 — a completed desktop recording promises another deal — FIXED on overnight branch
The replay ends with street:complete and no live result object, so phaseOf treated it as between hands: it hid the recorded board, said NEXT DEAL SHORTLY and offered a sit-out button with no handler. The regression failed on that promise before repair. A replay-specific completed phase keeps its actual board/pot and says End of replay, with no live sit-out control. The shared live-table phase rules remain unchanged.

### BUG-87 — landing cards use the drawing width instead of the hood — FIXED on overnight branch
The phone hero used 99px backs, taking 55% of the 180px SVG rather than 55% of its visible 99px hood. The wave-60 regression failed at 99 versus 54. It now uses the exact L2Hand calculation, actual Fist atoms, 54px phone/85px desktop backs and a clear face. Desktop art scales to the reference's 280px drawing.

### BUG-88 — first desktop draft appears as an empty black stage — FIXED on overnight branch
The first-agent path used a full-stage block wrapper with no flex height for BirthScreen. Its input existed and could be focused programmatically while being clipped out of the actual visible stage; the browser's elementFromPoint check failed before repair. Wave 61 now gives the first draft a right column beside the real empty room. Other full-stage sheets also get a flex container. Four landing viewport checks cover actual hit visibility, dimensions, settled scrolling and typing; the adjacent DesktopHome regression holds the first-draft rail and room together. The previous stage-sheet exception is intentionally superseded.

### BUG-86 — condition tracks collapse as empty inline spans — FIXED on overnight branch
The C9 screenshot exposed missing condition lines. The shared BodyBars track is a span with height and an absolutely positioned fill but no block display; the browser regression measured a zero-width track. Making the track block-level restores its intended dimensions. Desktop and Watch browser checks cover the shared fix.

### BUG-80 — desktop conversation reopens without its saved history — FIXED on overnight branch
useAgentThread seeded only the opener, replacing even messages sent while the initial hands request was pending. Both cases failed before repair. It now restores the served private history and preserves subsequent messages. C9 uses that hook with the existing per-agent draft map.

### BUG-81 — desktop chat treats a refused HTTP response as success — FIXED on overnight branch
A 503 was parsed without checking res.ok, so no error appeared after the draft cleared. The regression failed before repair. Sends now return success/failure; the column and desktop Watch restore failed drafts, and the column displays a retryable error. A ref prevents duplicate concurrent sends.

### BUG-82 — desktop hover labels move furniture and hide the television — FIXED on overnight branch
The hover rule changed the safe, fridge, television, door and table to position:relative, overriding their absolute room coordinates. The actual browser reproduced the misplaced safe; the same geometry test now checks all four fixtures at their scaled plan positions. Hover labels still work.

### BUG-83 — the desktop profile discards the saved hood and glow — FIXED on overnight branch
PlayerCardRail's shared Identity passed only a roster accent into MoodGhost. A saved sand/gold profile test failed first, then passed after the same persisted identity used in Home/agent was applied. The birth rail shares this identity component.

### BUG-84 — desktop roster shows lifetime profit beside the wrong location — FIXED on overnight branch
The old standup row labelled a home-table player RESTING and printed careerStats.net without its lifetime context. The regression reproduced both. C9 now uses whereLine/rosterResult from the mobile roster, real wants/routines, saved 38px identity and condition bars. Missing session results are not replaced with career earnings.

### BUG-85 — desktop replay collapses and its Back button is covered — FIXED on overnight branch
The replay's flex children had no parent height inside the block stage. The C9 browser flow reproduced a Back button intercepted by the scrubber and top bar at three widths. Giving the replay its stage height restores the felt and the actual Back click; the browser now measures a usable stage as well as completing the return.

### BUG-79 — a split-pot winner is shown as losing when listed second — FIXED on overnight branch
Watch determined heroWon only from result.winners[0]. A named regression reproduced “lost at showdown” with the hero second in a split pot. It now checks every winner and says “shared the pot”; C8 uses the hero's actual summed payout. New integration tests also enforce ordinary-win hands, big-win effects and the actual busted seat name.

### BUG-78 — Home's resume timer stops when every game is cooling down — FIXED on overnight branch
armTick counted only running games and stopped with zero, even when a household had a future cooldown deadline. An isolated real-registry probe reproduced no resumed game without a new click or roster event. The tick now stays alive through pending cooldowns; the same probe passes. HOME-3 adds a five-minute play window followed by ten minutes off, finishing the current hand before a timed break. Manual Carry/table placement remains available during a break or alone.

### BUG-75 — a refused private composer message silently disappears — FIXED on overnight branch
The private HomeThread path treated sendToAgent's null failure as success, unlike the room path. The new failing regression reproduced a lost draft. A null response now restores the draft and displays a retryable error. The status overlay is pointer-transparent: the first short-screen browser run exposed it covering a carousel dot. The completed three-size casino checks enforce retry text, credentials, recipient and subsequent navigation.

### BUG-76 — a carousel dot temporarily reselects the previous agent — FIXED on overnight branch
The dot selected its destination immediately, but intermediate smooth-scroll events rounded back to the old page. Connecting the conversation exposed lost drafts during that transition in Chromium. A named unit regression reproduced the intermediate frame. The chosen destination now holds until reached; a new pointer/wheel gesture gives selection back to manual scrolling. All three browser sizes passed afterward.

### BUG-77 — the idle casino card drops an agent's saved colours — FIXED on overnight branch
AwayPage passed only a roster accent into MoodGhost, leaving its default dark hood. The failing saved sand/gold identity test now passes: the page uses identityOf for cloth and glow, matching Home and the profile.

### BUG-74 — the television ignores its live table when tapped — FIXED on overnight branch
Home sent the TV tap to the casino and let a studying housemate replace a known live table. The failing Home regression reproduced both. C7 now prioritises the live table and opens Watch; otherwise the household's recorded hand opens its authenticated replay. Mobile replay returns to Home; desktop uses its existing replay panel. An empty tape has no dead tap. Unit and three-size browser checks cover both destinations.

### BUG-72 — empty chairs are drawn under agents already playing — FIXED on overnight branch
TableChairs removed the first N positions of a four-seat map, while the bodies used a two/three-seat arrangement. The two-player case left an empty chair under the far player. Regression reproduced the overlap. Spare chairs now exclude actual occupied positions and retain the correct total; C6 adds one dim named chair per away agent, within those free positions.

### BUG-73 — the away frame calls a visit the casino and opens no destination — FIXED on overnight branch
The wall plate and accessible label ignored visiting.hostName, and every frame called Watch even without a live table. Regression reproduced the missing friend's name. Visits now name the host; a known live frame opens Watch and a frame without a table opens the agent. The Home subtitle also separates visits from casino occupants.

### BUG-70 — changing profiles can show the previous agent's attribute history — FIXED on overnight branch
The detail log was unscoped component state. After switching agents, a failed or absent next detail read left the old log in place. The new C4 regression reproduced another agent's recent change on the card. Detail results now carry the agent ID and are consumed only for that ID; the existing unmount/late-request guard remains.

### BUG-71 — guest end-to-end check times out during ordinary hands — FIXED on overnight branch
The script compressed its deal pause but retained production 800–2500ms action clocks. Reproduced one completed hand and a second still on the turn at the 30-second deadline; the history assertion then failed for the same reason. The guest test now uses the existing THINK_MIN_MS/THINK_SPREAD_MS dials at 25ms each. Two completed hands, policy-only guest decisions and history surviving the claim remain required. Production pacing is unchanged and the dedicated pacing suite keeps its timings. The corrected guest check passed in 1.36s.

### BUG-69 — roster mislabels visits, abbreviates identity and invents an empty household on errors — FIXED on overnight branch
Board 42 C5 now uses full names, real pocket balances and signed current/last session results in 60px rows. Visiting takes priority over the casino label; a kitchen game reads “at your table.” LIVE counts only a known live casino table, not a stored active flag. Failed requests show a retryable error rather than “no agents.” Three regressions failed before correction and now pass. Send to a friend moved into the existing profile More menu to preserve the compact roster; its eligibility, clipboard and fallback link remain functional. C5 browser check inspects the four-agent sheet and follows that action to the profile. A visiting agent without projected liveGame is not counted live; no invented TONIGHT total.

### BUG-66 — birth, Home and solo views can draw different identities — FIXED on overnight branch
The client claimed household colors in roster order but rolled solo views independently. The server now persists the same reference roll once at birth, and backfills existing households without changing the currently visible active roster. Public projection exposes two palette IDs only. Birth reveal/card use the stored identity. Shared pure palette/roll prevents server/client drift. Tests cover color collisions, retirement/reorder/new arrivals, public privacy and actual legacy SQLite migration across process restart. The birth card test failed on its missing hood, then passed. The forming preview still uses the reference's provisional palette before birth; no collar stage or undesigned inventory added.

### BUG-67 — long drafts lose earlier messages and leave unused phone width — FIXED on overnight branch
Browser regression measured 420px at a 490px viewport, then found the first message at y=-566 when scrolled to the top. The creation shell fills the phone; the draft uses safe bottom alignment plus scrolling to new replies, so old messages remain reachable. Verified at 490×590 and with the standard phone/desktop draft checks. The fixture now reports the actual Telegram viewport height instead of hardcoding 844 for every size.

### BUG-68 — two ghosts remain on the birth card — FIXED on overnight branch
The previous test counted one card well without counting the still-visible forming ghost behind it. The added regression counted two bodies. On birth the preview and recruiter sheet now stand down, leaving one revealed agent. The reference's uppercase dark action label also wins over the generic app button cascade.

### BUG-64 — the fridge cannot be restocked — FIXED on overnight branch
The sheet only called /give despite the server supporting household stock. Ported board 29 F13: confirmed counts/prices, Buy 6 from the safe, unknown/error/retry states, and wallet refresh after purchase. Giving remains the want/Carry action. Tests failed before implementation on the missing stock controls; purchase, wallet refusal and failed GET now pass. Phone and desktop checks cover the new control; matched-stock reference pair inspected. Old GIVE expectations intentionally changed to the designed BUY 6 flow.

### BUG-65 — Home's room composer sends privately and ignores room replies — FIXED on overnight branch
The phone claimed to address the room but targeted one agent and vanished in an empty household. It now uses the existing owner-gated /api/home/thread and /api/home/say routes, displays actual speakers and listens to owner_line messages scoped to today's household session. Other owners and private table sessions are excluded. Failed sends restore the draft. The same socket feeds the desktop room rail. Regression tests failed before stream merge/error handling and now cover empty Home, actual POST, attribution, deduplication and private-session exclusion. No new model path was added.

### BUG-61 — failed or unfulfilled want answers disappear — FIXED on overnight branch
Home's WantToast called onAnswered even after a non-200 response; a successful HTTP response with `answered: null, needs: stock` also cleared an unfulfilled request. Both Home and the new agent view keep the question pending, report transport/refusal failures, and open the fridge for stock. Tests reproduced both failures before correction. Fridge stock UI itself remains a separate unfinished port; do not confuse opening that sheet with a completed restocking flow.

### BUG-62 — rejected agent chat silently consumes the message — FIXED on overnight branch
AgentThread parsed error responses as conversations without checking response.ok. It now reports a retryable failure and leaves the composer usable; the failure is not repeated as a stage speech bubble. Regression exercises a 403.

### BUG-63 — reopening the agent loses the saved conversation — FIXED on overnight branch
Board 42's companion view reads the owner's server-projected chatHistory rather than replacing it with an opener. Recap loading preserves new messages sent while the request was in flight and ignores stale/unmounted requests. The server currently retains twelve chat messages; this is not a claim of unlimited history. Regression failed on the missing saved owner line, then passed, with an additional delayed-response race check.

### BUG-59 — mobile room shell duplicates navigation and leaves unused width — FIXED on overnight branch
Global Header stacked above CasinoHead/FloorView; Home capped its room scale at 1 and app at 420px. Use each room's contextual header, direct Home exit and in-header Floor/Board toggle, and scale Home to viewport width. Preserve the kitchen table. Port safe/couch/fridge detail and actual balance. Browser regression failed before (no Home heading) and passes at 390/490; four-agent hit checks and roster navigation pass. Intentional old-test changes: global wordmark/count becomes Home+Railbird mark, casino back chain becomes toggle+Home, safe/TV may show money while the kitchen table never prices seats. See OVERNIGHT_DESIGN_WORK.md for complete gates and remaining visual gaps.

### BUG-60 — room conversation band is 100px and send control is oval — FIXED on overnight branch
Global button/input minimum heights overrode the 26px send and compact line. Browser regression reproduced 100px band (then 80px in the first correction). Explicit control geometry gives a 76px band and circular 26px send with an enlarged touch target. Opening thread and composing remain functional. Imported the reference's Inter/JetBrains Mono font families, previously requested by components but absent from the page.

**BUG-39/34 overnight verifier update:** cache verifier now drains HTTP responses before cleanup, waits for child close before removing scratch data, uses exitCode rather than forced process.exit, and allows 30 seconds for readiness. Unexpected exceptions now increment failures. Full test:all passed after the observed native abort; BUG-34 is not claimed globally resolved.


---

## OPEN

### BUG-45 — isolated casino pocket assertion runs before the tray is ready — FIXED on overnight branch
**Severity:** Medium (a green suite hiding an order dependency — BUG-36's family)
**Where:** `client/src/screens/CasinoScreen.test.jsx:353` (was `:339` on origin/main — the line moved, the body did not)
**What:** Run the file and it passes. Run the one test — `npx vitest run src/screens/CasinoScreen.test.jsx -t "a bigger pocket opens the room above"` — and it fails on `getByText('pocket $6,000 · buy-in at 25/50 is $5,000')`: the doorway assertion above it passes, the tray text is simply not in the DOM. So the tray's copy depends on something an earlier test in the file leaves behind, not on what this test sets up.
**Pre-existing, and not bugs-c's.** `git show origin/main:client/src/screens/CasinoScreen.test.jsx` has this test byte-identical; bugs-c (job 12, the floor-first casino) added tests around it and moved it down 14 lines without touching it. Reproduced on merged main 2026-09-08.
**Why it matters more than it looks:** the suite is green in CI and will stay green, because CI runs the file. What it is not doing is proving this claim — it is proving "this claim holds *after* the tests above it ran". That is the shape BUG-36 has on the server side.
**Verified repair (batch15):** the isolated command above failed again. The “placing” heading renders before asynchronous rooms and the selected-room effect have finished, so it was not a readiness signal for the tray's specific decision. Awaiting that exact same pocket/buy-in text with findByText passes in isolation and keeps the original amount and affordability assertions. No shared-state leak or product rule change was needed for this reproduction. The case now carries BUG-45 in its name; the original `-t` command still matches it.

---

### DESK-4 — Sitting down is not wired on desktop (debt, not a bug)
**Severity:** Low (missing wiring in a screen that shipped deliberately incomplete)
**Where:** the DESK-3 desktop three-column layout — `client/src/components/desktop/`
**What:** DESK-3 built desktop as its own design rather than a stretched phone: three permanent columns, a 250px `DeskRoster`, the felt capped at 900, hover reveals. What it did not do is wire the sit-down — a user on a wide window can see the desk and the roster but cannot take a seat from it.
**Not a regression.** Nothing on desktop could seat before DESK-3 either; the screen simply now looks finished enough that the gap reads as broken. Filed so it is a known hole with an owner rather than a surprise in the next playtest.
**Fix:** wire the seat action from the desktop roster/stage to the same `/place` path the phone uses. Belongs to whoever picks up desktop next.

---

### VISIT-1 debt — three things the visit shipped without
**Severity:** Low (all three are absences, none of them wrong behaviour)
**Where:** `src/server/visit.js`, `client/src/lib/visit.js`, `scripts/verify-visit-referral.js`
**What:**
1. **No share-card art.** "Send to a friend" shares the `visit_<agentId>` deep link as **text only** — the inline result carries no rendered card. The machinery that would draw one is SHARE-2's (`PUBLIC_BASE_URL`, `GET /share/<id>.png`), so this is SHARE-2's debt to pay, not visit's to reinvent.
2. **A visiting agent shows to his own household as "at the casino", not "visiting".** The tag is right in the host's room — he is announced, seated and labelled a guest there — but the sender's own roster falls back to the generic away state, so his owner cannot tell a friend's kitchen table from a casino seat.
3. **`verify-visit-referral.js` is not idempotent from the repo root.** It calls `store.deleteOwner(HOST)` at startup but resets no guests, and the run mints two. By hand from the repo root the fourth run trips the fifth-guest limit and comes back `429` on `POST /api/guest`, then `slotLocked` on the build — the same trap `store.js:1288` already documents for agents. Harmless under `npm test` (`isolateCwd: true` gives it an empty database every time) and it is why the script's own "Run:" header is misleading. Measured: runs 1-3 green in a shared cwd, runs 4+ red, every time.
**Fix:** (1) with SHARE-2. (2) give the sender's roster the visiting state the host's room already has. (3) clear the run's own guest rows at startup the way it clears the host.

---

### BUG-43 — HOME-2's floor-drop check starts during the birth walk — FIXED on overnight branch
**Severity:** Medium (a gate that goes red on a different test each run is BUG-34's lesson, not a new one)
**Where:** `scripts/home2.spec.js:404` ("dropping him on the floor…") and `:359` ("drop on the couch changes his state")
**What:** Both read a state BEFORE the drag and assert against it AFTER, and the room keeps living in between. The room's tempo in this job is `HOME_PAUSE_MS=600` — fifty times production's 30s — so the man walks under his own routine while the spec measures him.
- `:404` captures `data-spot`, drags him onto open floor, and expects the same spot back. Seen: expected `door:born`, received `tape`, with `data-walking="true"` on the element — his routine walked him to the tape room, and the drop had nothing to do with it.
- `:359` decides what should happen from `before.startsWith('table:')` and then expects the refusal bubble "In a hand". Sitting at the home table is NOT the same question as being in a hand: the product asks the server (`/place` → 409 `inHand`, `HomeScreen.jsx:494`), and `carry.js:134`'s own `midHand()` takes `gameRunning` as well as `seated`. Between hands — which at `HAND_PAUSE_MS=600` is most of the time — the move is allowed, no line comes back, and the bubble the spec waits for never exists.
**Measurement (2026-09-07, local, the CI env exactly):** against a server whose room had the man at the table, `:359` failed 3 runs out of 3 while the other three job-5 tests passed; against a freshly seeded room, `:359` passed and `:404` failed. One suite, two tests, and which one is red depends only on what the room happened to be doing.
**Found by:** the integrator, gating CI #84 — this step never ran in CI before (#82's smoke job predates it), so main has never seen it green.
**Fix:** not made here, because the honest fix is a product question the integrator should not answer alone: `:404` needs the room quiesced for the length of a gesture (or the claim restated as "the DROP moved nobody", which the POST assertion beside it already proves), and `:359` needs to ask whether he is in a hand rather than inferring it from where he is sitting. Both belong to the tab that owns HOME-2 job 5. Do not re-run to green.
**Verified repair (batch15):** restored the preserved test and reproduced `door:born` → `floor:0` against a fresh scratch household. The test now waits for the separate doorway beat and arrival walk to finish before taking its starting-position measurement. The original same-spot and no-place/give/study-POST assertions are unchanged; no production clock or gameplay rule changes. The isolated fresh-household case passes and the full real-server Home suite passes all20 with no skip. BUG-58 already covers the couch drop's real server-authorized response.
**`:359` is deliberately left live.** It passes from a fresh room and fails once the man is at the table, so it is the same bug with a different trigger rather than a second one; fixme-ing a test that currently passes would hide coverage the product still has. If a CI run goes red on "drop on the couch changes his state", this entry is the reason and the answer is the fix, not a second fixme.

---

### BUG-39 — `verify-cache-headers.js` gives the server 4s to boot and loses the race
**Severity:** Medium (BUG-34's family — a fast-suite red that a re-run makes go away)
**Where:** `scripts/verify-cache-headers.js:70` — `waitForServer(retries = 20)` at 200ms a retry
**What:** The script spawns the real server on port 18765 and polls it. Its budget is **20 x 200ms = 4s**; its two siblings that boot a server the same way, `verify-deeplink-routes.js:63` and `verify-home-routes.js:79`, allow 25 retries (5s). On a loaded box 4s is not enough for a cold Node boot, and the script fails with `Server failed to start: Server did not start in time` — the whole `npm test` then exits 1 on an assertion from `src/test/helpers/verifyGroups.js:90`.
**Measurement:** three consecutive `npm test` runs on unmodified main (a288355, integrator session 2026-09-07): run 1 red on this script, runs 2 and 3 green with the same script passing in 996ms and 1042ms. It is the fast group's shortest boot budget and it runs alongside `verify-growth.js` (8.3s) and `verify-cost-router.js` (5.5s), which are what make the box loaded. Nothing in the branch touched it — the only commit in the tree is a `design-refs/` commit.
**Found by:** the integrator, on the gate run after the design 56 commit.
**Seen again 2026-09-08** (integrator, bugs-c merge gate), unchanged and still on the first run of the session: `npm run test:all` on main red on this script with the same `Server did not start in time`; run standalone immediately afterwards it booted and passed 9/9, and the next full `test:all` was green through all three commands. Third session in a row it has cost a gate run. Nothing was re-run to green to get past it — the merge below it was gated on the second run, and this entry is the reason the first one was red.
**Fix:** not yet made. The obvious one is to give it the siblings' 25 retries, or better, the same budget for all three in one place — but a boot that takes longer than 4s under load may itself be worth a look before the number is simply raised. Do not re-run to green; that is the habit the testing law exists to prevent.

---

### BUG-37 — Money outside the watch felt is still spelled by `toLocaleString`
**Severity:** Low (two spellings of the same number, in the same screen)
**Where:** `client/src/components/desktop/DeskTableStage.jsx:170`, `:188`, `:236` and `:245`, `client/src/components/desktop/GameTile.jsx:59`, `:66` and `:81`, `client/src/components/floor/atoms.jsx:123`, `client/src/components/PlayerSeat.jsx:90` and `:108`
**What:** `client/src/lib/wallet.js` exports `money()` and every money surface goes through it — that is why a pocket and a ledger agree on how a number looks. These call `toLocaleString()` directly, so a stack is spelled by the browser's locale while the wallet beside it is spelled by ours.
**Found by:** the WATCH report, on the hero stack.
**Partly fixed:** WATCH-10 job 4 closed the whole of the WATCH FELT — the hero's pile, every opponent's pile, the pot, to-call, the bet spots, the read sheet and the session ceremony, on both the phone felt and SIT-1's. The answer to the question the entry asked is that the felt does want the mark in most places and not beside a chip that is already the currency, so `lib/wallet.js` now exports `group()` — `money()` without the dollar — rather than letting a call site opt out of the rule. Asserted in `client/src/components/watch10.test.jsx` ("BUG-37").
**Still open:** the DESKTOP stage and tile, the casino floor chip, and `PlayerSeat.jsx` (the pre-v5 felt). Same fix: `money()` where the mark belongs, `group()` where it does not.

---

### BUG-36 — `table.seats.test.js` intermittently fails on "blinds moved some chips"
**Severity:** Medium (BUG-34's family — a fast-suite failure that a re-run makes go away)
**Where:** `src/server/table.seats.test.js`
**What:** Fails inside a full `npm run test:all`, passes on its own and on a re-run. Seen once in this session's integration runs; the suite passed 14/14 immediately afterwards, and three consecutive `npm test` runs were clean.
**Found by:** the WATCH report, and independently by the integrator during the COST-1 merge.
**Fix:** unknown. `scripts/stress-suites.js` (BUG-34) is the tool — run this suite under it rather than guessing. Note BUG-34 ruled out the obvious shared-resource causes, so a timing assumption inside the test is the likelier answer.

---

### BUG-34 — `test:all` dies intermittently on Windows (native abort: REPRODUCED 2026-09-07, still unfixed)
**2026-09-08 repair progress:** reproduced a native libuv abort after `verify-visit-referral.js` printed PASS. That script now closes HTTP, WebSocket and SQLite handles and sets exitCode instead of forcing process.exit. The full suite subsequently passed. This is a targeted shutdown fix, not proof that the entire Windows flake family is resolved; BUG-34 stays OPEN.
**Severity:** Medium (a flaky suite teaches people to re-run instead of to look — the testing law's own words)
**Where:** the test harness, not the product. `src/server/tapeRoom.test.js` and `scripts/verify-pace.js` (both fixed, below); the native abort is not in any one file — see the 2026-09-07 reproduction.
**Reported:** roughly one full `npm run test:all` in five came back red on Windows, two ways: a spawned suite exiting **3221226505** (`STATUS_STACK_BUFFER_OVERRUN` — a native abort, not an assertion), or `scripts/verify-pace.js` failing `every snapshot of a live hand carries it — 1 without`. Reproduced on unmodified main.

**Re-observed 2026-09-08 (integrator, cost-2 merge).** Four aborts in twelve `npm test` runs on merged main — `src/server/guestClaim.test.js`, `src/server/whisper.test.js` and `scripts/verify-visit-referral.js` twice, all exit **3221226505**, a different file almost every time. Two of those twelve runs had a newly added test file pulled out of the tree first and the abort still landed, so nothing about it is specific to what was merged. This is the entry above holding: it is the harness, not any one suite, and re-running is not a diagnosis. One in three here rather than one in five, on a machine that had just run the client suite — worth knowing if anyone tries to correlate it with load.

**Tooling:** `node scripts/stress-suites.js [rounds] [concurrency]` runs everything `npm test` spawns — every `src/**/*.test.js` and the fast `scripts/verify-*.js` group — through the same `runScript` helper, in a loop, recording every non-zero exit with the child's own output. One run in five is too slow a signal to debug against; this turns it into minutes.

#### Found and fixed: `verify-pace.js` "1 without"
Not a race in the server. `_heroEquityFor` returns null for a **folded** seat on purpose — a man who folded has no equity in the pot — and the check filtered snapshots only on `street !== 'waiting'`, which includes `complete`. So it asserted a rule the product has never held: the snapshot after the hero folds legitimately carries no number.

Whether it fired was pure timing. With no model behind him the hero check/folds, and his 800ms think delay normally put that fold after the script's 700ms sample window; under the e2e group's `concurrency: 2` the sleep overran and the post-fold snapshot landed inside the sample. Nothing about the server differed between a green run and a red one. Reproduced deterministically with `THINK_MIN_MS=50 THINK_SPREAD_MS=50`, which puts the fold inside the window every time.

Fixed by asserting what the rule actually is — *every snapshot of a hand he is still in* carries equity — plus the complementary half, that a seat which folded reports `null` rather than a stale number, so excluding those snapshots does not quietly stop asserting anything about them. (A second bug fell out: `heroSeat` had to come from `watching.msg.spectatorSeat`; `waitFor` resolves the log entry, not the message.)

#### Found and fixed: `tapeRoom.test.js` — a 60ms window the suite's own round trip outruns
Found by the stress harness: 1 failure in 590 spawned runs at concurrency 4, then reproduced at 1 in 64 running that suite alone 8-wide.

`HOME_STUDY_MS` was set to **60ms** for the test, and sixty milliseconds is shorter than this suite's own HTTP round trip on a loaded machine. "A second request is refused rather than stacking another ninety seconds" only holds while the first study is still running; on a busy box the window closed between the two POSTs and the second request was **accepted**. The assertion lost a race it was never about.

The damage was the cascade. That test aborts at the failed assertion, leaving a **live** study on the record, and the next two tests then came back `409 He is already watching one` — from assertions about a missing `handId` and about filing a second line, neither of which has anything to do with a study being in progress. Three red tests, one cause, and nothing in the output connecting them, because the route has three different 409s and the status alone does not say which.

Fixed three ways: the window is 2s, which cannot lose to a localhost round trip; a `beforeEach` empties the tape room so no test can inherit another's live study; and every 409 assertion now prints the body, so a refusal can be told from another refusal. The second-line test no longer sleeps the window out at all — it ends the study through `finishStudy`, the documented early-finish path, because what it is about is the line and not the clock. 240 runs 8-wide green after (it failed at 64 before).

#### REPRODUCED 2026-09-07 — and it finally said what it is

The integrator hit it while gating the `feature/visit-1` merge and caught the line this entry never had. The abort is not silent; `npm test` swallows everything but the exit code, and the child's own stderr carries:

```
  ✔ GUEST-1: the claim does not exist when the door is shut (0.2506ms)
  Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76
  3221226505 !== 0
```

That is **libuv's own assertion**, not V8's and not sqlite's: `uv_async_send` reaching an async handle that has already begun closing. `3221226505` = `0xC0000409` is just the fastfail libuv's `abort()` raises on Windows. So the thing to look for is a signal posted to the loop *after* teardown started, which is a much narrower target than "a native abort somewhere".

**Every victim passes first.** The suite prints all of its `ok` lines, finishes its assertions, and dies on the way out. `assertPassed` (`src/test/helpers/runScript.js:109`) only ever sees the exit code, so a fully green suite is reported as a failure — the red says nothing true about the product.

**Victims seen from `npm test` alone (5 files across 36 runs, never twice the same one in a row):** `src/server/guestClaim.test.js`, `src/server/rooms.test.js`, `src/server/table.cooler.test.js`, `scripts/verify-deeplink-routes.js`, `scripts/verify-visit-referral.js`. The one thing they share is that each boots an HTTP/WS server in-process. Not all of them call `process.exit`, so the exit call is not the trigger.

**Rate, measured both sides of a merge** (Node v24.15.0, Windows 11):
- main at 88a3342, before the merge: **2 aborts in 20** runs
- the same tree with `feature/visit-1` merged: **3 aborts in 16**

Both sides flake at roughly the same rate. This matters for the next person who meets it during a merge: it frames whatever landed last as the culprit, and it is not. A 6-run sample cannot tell 10% from 0% — the integrator's first reading of this said "merge-caused" on exactly that evidence and was wrong.

**`stress-suites.js` catches it now.** `node scripts/stress-suites.js 40 8` — the exact command this entry asked the next person to run — produced **5 native aborts in 3,720 spawned runs** (0.13%), where the earlier 1,768 produced none. Victims there: `src/server/draftGuard.test.js`, `src/server/draftName.test.js`, `src/server/table.events.test.js`, and `scripts/verify-visit-referral.js` twice. Two ordinary exit-1 failures came with them (`verify-cost-router.js`, `verify-home-routes.js` — BUG-39's family, a boot budget lost under load). So the harness does reach it; at that rate the earlier clean 1,768 was luck, not evidence of absence.

Across everything seen on 2026-09-07 that makes **nine distinct victim files**, and every one of them boots an HTTP/WS server in-process (`draftGuard`, `draftName` and `table.events` included — checked, all three stand up an express app). None of the `src/**` ones call `process.exit`. That pair of facts is the narrowest description of the trigger anyone has managed so far: a server handle, and a loop that is already closing.

**Still does not reproduce in isolation:** 12 solo runs of `guestClaim.test.js`, 30 parallel runs of it across fresh scratch cwds, and 24 parallel runs of a minimal script that leaves a WAL sqlite handle open at exit — 0 aborts. It takes real contention, which is why it is a load race and not a bug in any one file.

**Why CI is green.** CI is `ubuntu-latest` on Node 22 (`.github/workflows/deploy.yml:13,23`); this is a Windows + Node 24 abort. The gate CI runs is unaffected and only the laptop gate reds — which is why this has stayed open so long without blocking anything.

**Fix:** still not made, and it belongs in the harness rather than in any suite — the two candidate shapes are (a) close the child's server handles and let the loop drain before the process is allowed to exit, or (b) have `assertPassed` recognise `0xC0000409` on an otherwise-green body as the harness fault it is and report it as such instead of as a failed suite. Platform work. Do not re-run to green.

### BUG-20 — Dead 14px input rule waiting to be reused
**Severity:** Low (latent — nothing renders it today)
**Where:** client/src/styles/layout.css — `.dr-form-field input { font-size: 14px }`
**What:** The rule is live in the shipped bundle and is not behind a media query, but no JSX in client/src applies the `dr-form-field` class — it is left over from a form that was removed. So nothing can focus a 14px field right now. The moment anyone reuses the class they inherit a BUG-02 iOS auto-zoom.
**Found by:** TEST-3 stylesheet audit. `it.todo('BUG-20: …')` in client/src/test/bug02.test.jsx, with the selector held in a named KNOWN_DEAD set rather than filtered silently.
**Fix:** Delete the rule, or raise it to 16px if the class is coming back. Then un-todo the test and drop the KNOWN_DEAD entry.

---

### BUG-29 — Landing page scrolls sideways at ≤768
**Severity:** Medium (first screen a stranger sees)
**Where:** the marketing landing / hero scene (`client/` welcome page, `.hero-*` rules)
**What:** Reported from the 0.10.0 pass: horizontal overflow on the landing page at viewport widths of 768 and below — the document scrolls sideways.
**Not caused by LAND-3, and not fixed by it.** LAND-3 (`5321886`, the design-40 sheen and card-fan port) verified `document.scrollWidth` byte-identical before and after at 1440 / 1280 / 768 / 390 / 375, so whatever overflows was already overflowing and the hero port neither introduced nor removed it. The mobile mascot centring fix in that commit (`.hero-copy` width 100% at ≤430) is adjacent but is a different symptom.
**Fix:** find the element wider than its column at 768 — measure with Playwright rather than by reading CSS, since LAND-3's scrollWidth check is the harness that already exists — then cap it and add the width to that check so the page cannot regress silently.

---

### BUG-30 — Haptics: soft-vs-light and reveal-vs-pot are unresolved design calls
**Severity:** Low (feel, not function)
**Where:** `client/src/lib/haptics.js`, `client/src/screens/WatchScreen.jsx` — the `heroCardWarms`, `showdownReveal` and pot rows
**What:** Two decisions CLEAN-1 made in order to ship, both flagged at the time rather than settled:
1. **soft vs light.** design-refs HAPTIC4 gives the card warm and the showdown reveal as `soft`; the brief for the CLEAN-1 pass asked for light / light / medium, which is what shipped. The two sources disagree and the code follows the brief.
2. **reveal vs pot.** The showdown reveal and the pot settling arrive in the same commit, and the 120ms floor only lets one through. The pot wins, because "losing is quiet" is the older law, and the reveal takes HAPTIC4's own 140ms interval behind it — the one number in that table set above the floor. Whether the reveal should instead be the one that lands is not settled.
**Fix:** a design call from the mood/haptics wave, not a code fix. Whichever way it goes, `haptics.test.jsx`'s ordered call list is where it gets pinned.

---

### BUG-31 — The prediction beat has no home in watch v4
**Severity:** Low (shipped dark; nothing renders it for a normal user)
**Where:** `client/src/components/system/PredictBeat.jsx`, `client/src/lib/predict.js` (flag `ap_predict`), rendered from `WatchScreen`
**What:** W3-4 shipped the prediction beat inside the READ tab, behind a localStorage flag and off by default, deliberately, "because this is the one part of the wave that could turn a manager game into a clicker". W4-2 then deleted the READ tab — a read is about one person, so it became a sheet on a seat tap. The beat was re-homed into the panel rather than lost, but watch v4 gives it no place of its own and the design refs do not assign it one. It is live code behind a flag with no designed home.
**Fix:** a product decision, not a bug fix — give it a home in v4/v5 (its own slot, or a gesture), or delete the module and the flag. Leaving flagged-off code with no owner is how BUG-20 happened.

---

## RESOLVED — kept here for traceability

### BUG-55 — Agent speech enlarged the invisible click area over the home felt
**Severity:** High (Jens could not open the table with four agents).
**Fix:** speech slot is absolutely positioned outside the body/name button and cannot intercept pointers; ordinary room speech also excludes the felt. The short Telegram room can scroll to its TV. Real mouse hit testing reproduced the failure at 390×590 and 390×844 before repair; both now open TableSheet. Regression added to deployment CI. Local tested repair; production playtest pending.

### BUG-56 — Loose Cannon's request appeared twice and covered the room
**Severity:** Medium (obstruction and redundant speech).
**Fix:** full request appears once in a compact answer strip, with F11 panel glass and small answer pills. No duplicate request/old recap over the asking agent's head. The strip reserves space. The browser's old gold-gradient assertion was replaced with exact plain-panel/blur/gold-edge checks because the current reference no longer uses that wash. Larger board-42 agent conversation remains pending.

### BUG-57 — Railbird existed in the design while the app still said Agentic Poker
**Severity:** Medium (wrong identity and ambiguous live count).
**Fix:** ported the reference RailMark and Oswald wordmark into actual phone/watch/desktop/guest headers, title/favicon and /welcome. The mobile count now says “N in casino”, not an ambiguous agents-live total; zero is quiet and failed refreshes clear the stale number. Production's public stats confirmed 0 casino seats and 15 total agents. Telegram's outer bot name is a separate BotFather setting and remains pending. This is a partial brand port; full landing/motion/avatar work remains in DESIGN_GAP.

### BUG-58 — Couch-drop browser test assumed an obsolete client-side refusal
**Severity:** Medium (a timing-sensitive false red).
**Fix:** SERVER-5 already moved refusal to /place. The test sampled a chair before a long press, then expected “In a hand” and no POST even if the real server accepted the drop. The observed failure showed the accepted “Right. I am at the bar.” response. It now requires one POST for fixture couch, validates the actual 200/placed or 409/inHand result, and checks its sentence in the bubble. The fresh-database phone suite passes 19 checks with the existing BUG-43 skip. No server rule changed.

See `read-me-claude/RAILBIRD_PLAYTEST_REPAIR.md` for evidence and scope of BUG-55–58.

### Astra repair batch — 2026-09-08 (local; deployment pending)

- **BUG-47 (critical):** malformed Telegram hashes accepted forged identities. Both signature schemes now require exactly one 64-digit hexadecimal hash. `auth.test.js`: malformed and duplicate signatures rejected; legitimate signatures still accepted.
- **BUG-48 (high):** agent writes trusted the supplied owner id. All agent mutations now authenticate and check one consistent owner id; mismatched body/query ids are rejected. Legacy client queue/finish calls now send credentials. `ownership.test.js`: signed stranger, anonymous caller, guest and real owner exercised.
- **BUG-49 (high):** public profile, flagged-hand and session/history reads leaked private records. Public projections use allowlists; memory/history require ownership; session rows are scoped to the requested owner and agent; opponent hidden cards and private reasoning are withheld. Stored records remain intact. `ownership.test.js` covers each repaired route.
- **BUG-50 (high):** WebSocket WATCH inherited a private seat without proof. Public spectators now have viewpoint -1 and cannot create a table or control a session. Telegram owners prove their identity and watch their deployed/seated agent; JOIN player ids are namespaced by owner. Guest cookies reach WebSocket auth. Existing protocol tests now send their development credential, just as their HTTP requests already did. `ownership.test.js` tests real sockets plus real table snapshots; `useTable.test.jsx` verifies credential transmission.
- **BUG-51 (medium):** the 470px flat put the TV into the first-agent action. The room now uses the reference's 612px height and one shared CSS height. The phone browser regression measures separation and clicks the draft button. The desktop dimension assertion was changed to the actual reference size, retaining exact equality.
- **BUG-52 (medium):** the guest room stayed blank behind a redundant lazy App import. App is already eagerly imported by main. The landing now reuses it directly. The old source-only lazy assertion was replaced to reflect this deliberate behavior change; the real recruiter mounting test is unchanged in strength and now passes.
- **BUG-53 (medium):** the desktop browser checks still assumed the casino opened on its building. They now assert the floor opens first, select Board through the real toggle, and retain the column/door geometry assertions.
- **BUG-54 (medium):** a seated agent tap opened the table while a standing agent tap opened his conversation. Bodies consistently select their agent; the felt retains its own action. This deliberately supersedes BUGS-C-3's older tap rule, as called for by the board-42 interaction direction. The full board-42 agent view remains unbuilt.

### BUG-46 — A failed draft silently commits a fallback agent — RESOLVED locally 2026-09-08
**Severity:** HIGH (the household gains a member the owner did not draft, and it burns one of his agent slots)
**Where:** `src/server/agentProfiles.js:3247` (`inferFallback`), `:5090` and `:5100` (the two `/api/agents/build` branches), `:529` (`commitAgent`)
**Reported:** a "house/opponent agent" called **The Grinder** in Jens's household roster on prod, sitting at his home table, since at least 2026-09-07 19:07.

**Correction from Astra audit, 2026-09-08:** it is not a House cast member. The earlier claim that ownership was clear was wrong: authentication did not bind these writes to the requested userId (BUG-48). The original production incident cannot be attributed conclusively without its request logs. The fallback path below was independently reproduced.

* The House cast is `Doyle_v3`, `Phil_AI`, `Granite`, `MsAllIn`, `TiltedTed`, `TheProfessor` (`houseCast.js`). "The Grinder" is not among them, and a House seat has no agent record at all — it can never reach a roster.
* There is exactly **one** write that adds an agent to a household: `profile.agents.push(agent)` at `agentProfiles.js:632`, reached only through `commitAgent`, reached only from `POST /api/agents/chat` and `POST /api/agents/build`, both behind auth and both writing into `getOrCreate(userId)` — the profile named by the request, which was not necessarily the caller's until BUG-48. `moveOwner` (guest claim) moves a guest's own agents to the account claiming them, which is its job. `getOrCreate` seeds an empty roster. Nothing else sets `ownerId`.

**The actual path.** "The Grinder" is the **draft fallback name**. `inferFallback(text)` returns `Loose Cannon` for an aggressive brief, `Rock Solid` for a tight one, and **`The Grinder` for everything else** — it is the default branch. `/api/agents/build` reaches it two ways, and neither tells the owner anything went wrong:

1. `:5086` `callClaude(...)` returns `null` the instant `ANTHROPIC_API_KEY` is missing (`:3331`) — no request, no error. `:5090` then commits `inferFallback(combined)`.
2. `:5099` the `catch` — a timeout, a 401 on an expired key, an overload — commits `inferFallback(combined)` too.

Both call `commitAgent(profile, existingAgentId, …)` with `existingAgentId` null on a fresh draft, so a **new agent is pushed** and `res.json({ createdAgent })` returns 200. From the owner's side an agent he never finished drafting simply appears, correctly owned by him — which is why he is in the roster, why the home game seats him, and why he reads as somebody else's: the name is a generic archetype and the strategy is the canned "calculated, adaptive player" text.

**So the invariant was never violated** — he really is Jens's agent by `ownerId`. The bug is that the account created him without the owner's say-so, on an error path that returns success.

**Fix (not made — this is a product call, not a query fix).** The error branches must stop committing. The options, in the order they are worth considering: refuse the build (`503`, draft left intact — it already survives the slot refusal at `:4990` exactly this way, so the shape exists), or commit but mark the agent as unfinished so the birth screen can say the recruiter never answered. Either way the two branches at `:5090` and `:5100` should not silently push. `inferFallback` itself is fine and should stay — a brief-derived archetype is the right thing to *offer*; it is the committing that is wrong.

**What was done here:** the roster invariant is now a test (`src/server/homeRoster.test.js`) — every entry in `HOME_STATE.agents` is either an active agent of this owner or is tagged `guest: true` — and it drove out a second, unrelated hole that *was* a one-file fix: `homeSnapshot` concatenated its injected `visitors` as given, trusting each caller to have tagged them. It now stamps `guest: true` itself and drops anything already in the household. That hole opened with VISIT-1 (2026-09-07 22:32) and so **cannot** explain a 19:07 sighting; it is closed on its own merits.

**To confirm on prod without touching the data:** read that agent's record — a fallback build has `style: 'Balanced'`, `risk: 'Medium'` and the verbatim strategy string at `agentProfiles.js:3247`, and its `chat` transcript will end with the owner's brief and no recruiter hand-over line.

---

### bugs-d — the profile, the fridge, and the bundle (playtest queue, not yet started)
**Severity:** Mixed (one server hole, two visible on the profile, one dead feature, one weight)
**Where:** `client/src/screens/AgentProfileScreen.jsx`, `client/src/components/home/FridgeSheet.jsx`, `src/server/agentProfiles.js`, `client/src/styles/index.css`
**What:** The list the 2026-09-07 phone playtest left over once `fix/bugs-c` took its twelve. Filed as one queue rather than five numbers because they will be worked as one. All five re-checked against merged main (1c86a8e) on 2026-09-08 — bugs-c touched this screen twice (jobs 7 and 8) and none of these went away.

1. **His name is at the top of the profile twice.** `AgentProfileScreen.jsx:716` (the sticky back-bar, Playfair 16, ellipsised) and `:330` (`IdentityBlock`'s Playfair 19, beside his face) render `{agent.name}` one directly above the other. The bar is the one that has to stay — it is what the back arrow belongs to and it survives the scroll — so the card's is the candidate for cutting, not the reverse.
2. **The profile scrolls sideways.** Reported as pocket-row overflow. BUGS-C-8 rebuilt the pocket row and removed its duplicate in the header, so if the sideways scroll survives that it is *not* the pocket row and the next suspect is the header frame's own flex children. **Unverified in a browser since the merge** — measure it at 390px before assuming it is still there.
3. **The fridge's beer does nothing.** The client posts the right thing (`FridgeSheet.jsx:38`, `POST /api/agents/:id/give` with `{item:'beer'}`) and the server has a whole path for it (`giveItemTo`, `agentProfiles.js:2862`). Check the two refusals *before* looking for a break: a level agent is refused outright with `400 "He's fine. Save it."` (`:2872`, `isMoodSoothable`), and an empty shelf is refused `409` with `outOfStock`. Both come back as a *line in the sheet*, so "nothing happened" and "he said no" look identical to a thumb. If it is one of those two, this is a copy bug and not a wiring bug.
4. **`agent.sessionDips` never reaches the client, so CONDITION can only ever show fatigue.** SERVER-5 stores the three world states — worn, hungry, tilted — on the record (`agentProfiles.js:3017`) and `table.js:259` takes them at sit-down. `sessionDipsOf()` is exported at `:3023` **and has no caller outside `dips.test.js`** — nothing serialises it, so no payload carries it. The profile card ships `fatigue` (`:1981`) and that is the whole of what the CONDITION row BUGS-C-7 just labelled can show. **Server work, and the enabling half of the other four:** expose the dips on the same projection as `fatigue`, then the row can say why he is dipped.
5. **One stylesheet, 301.5 kB, on every session.** Measured on the post-merge build (2026-09-08): `dist/assets/index-*.css` is 301.50 kB raw / 50.63 kB gzip, and it is the *only* CSS file emitted — BUGS-C-1 split the JS (entry 490 kB, with `CasinoScreen`, `AgentProfileScreen`, `DesktopHome`, `GuestLanding` and `LoginGate` now their own chunks) and left the CSS whole. **The landing suspicion is mostly wrong and should not drive the fix:** `guest.css` is 9 kB, 3% of the sheet, and it rides in through `App.jsx:26 → ClaimWall`, not through the landing. The weight is `styles/index.css`, which eagerly `@import`s 24 sheets — `desktop.css` 66 kB, `watch.css` 61 kB, `home1.css` 51 kB and `layout.css` 37 kB are 215 kB of the 301 between them, and a phone in the flat downloads all four.
**Also seen, same build:** vite warns that `ReplayTheatre.jsx` is dynamically imported by `App.jsx` but statically imported by `FlaggedHandsSheet.jsx` and `ChatsScreen.jsx`, so *that* `import()` splits nothing. Whoever takes item 5 should take this with it.

---

**Repair:** both draft completion routes return 503 on model errors or malformed output and keep the draft. Deterministic creation remains only for keyless local/test runs. No existing production agent was deleted. Regression: `ownership.test.js`, BUG-46, uses intercepted synthetic model responses and makes no paid calls.



### "Two TVs" (playtest queue job 11) — CLOSED 2026-09-07 as by-design, no code changed
**Where:** the flat — `client/src/components/home/`
**Reported:** the 2026-09-07 phone playtest listed two televisions in the room as a twelfth job for `fix/bugs-c`, alongside the CASINO sign that really was doubled (BUGS-C-4).
**Closed without a fix.** Wave 59 rule 5 has the room carrying two screens on purpose; the second is not a duplicate of the first. The queue shipped eleven jobs plus job 12 (the casino floor) and dropped this one deliberately rather than leaving it unexplained.
**Kept here** so the next playtest that counts the TVs finds the decision instead of re-filing it. Wave 63's TV decision (the split by state — live feed when someone is out, tape room when everyone is home) is the thing that will change what is on them; it does not change how many there are.

---

### BUG-44 — The casino room measured itself against the window, not against the roster — RESOLVED 2026-09-07 (MERGE-20)
**Where:** `scripts/casino2.spec.js:267` (as it was)
**What:** A merge-caused red between two intact laws, found by the browser smoke on the DESK-3 merge and by nothing else — `npm run test:all` was green on both sides. CASINO-2 job 5 asserts that a room opened from a doorway takes the desk, and measured that as more than 90% of the window, which held while DESK-2's rail collapsed to a 68px strip. DESK-3 (board 31, wave 58) makes the roster a permanent 250px column on every desktop screen: `Expected: > 1296, Received: 1190` — 1440 − 250, to the pixel.
**Fixed by** measuring the room against the roster instead of against a fraction (a smaller magic number would pass just as well if the column silently doubled), plus the other half of the wave's rule: the room starts where the roster ends. Fixed in `feature/desk-3`'s worktree, not on main, and main fast-forwarded onto it.
**Worth keeping in mind:** neither branch could have caught this alone. It is the second time in two days the browser smoke has been the only thing that saw a merge (CI #84 was the first), which is the argument CI-2 was built on.

---

### BUG-42 — The safe's ruler still named the chrome SAFE-2 replaced — RESOLVED 2026-09-07 (CI #84)
**Where:** `scripts/home2.spec.js:541` (as it was), `client/src/screens/HomeScreen.jsx:884`
**What:** HOME-2 job 8 (`4150e06`) wrapped the phone's money in the room's own chrome — `.home-sheet` + scrim + `.home-sheet__panel`, `data-testid="home-safe-sheet"`, `MoneySheet variant="sheet"` inside it. SAFE-2 (`869e48d`) landed in the same merge window and replaced the money surface itself with `SafeSheet`, which brings its OWN scrim and its own panel. The merge kept SAFE-2's component and dropped HOME-2's wrapper, so the test waited 20s for a test id that no longer exists.
**Not a broken safe.** Measured against the running client before touching anything: the safe opens, one scrim, `.safe__panel` at `rgba(18,30,28,0.84)` with `blur(18px) saturate(1.2)` — the raised token's own numbers — and `.money-sheet` inside it at alpha 0. Every rule job 8 asserts still holds; only the class names under it changed. Restoring the wrapper would have drawn two scrims and two panels over one sheet.
**Fixed by** retargeting the assertions to the shipped structure (`safe-sheet`, `.safe__panel`) with the reasoning in the spec, keeping all four claims: it opens over the room, it is the shared safe surface rather than a fork, its panel is glass with a real blur, and the money inside drops its own ground. Rewritten to the new structure, not loosened (Testing law #5).
**Left behind, for whoever owns the glass:** `safe.css:57` reaches for `--glass-raised` (defined in `draft2.css:22`) while everything HOME-2 job 8 touched uses `--v5-raised` (`tokens.css:34`). Same value today, two names — which is the eighteenth glass that job was written to prevent.

---

### BUG-41 — `home2.spec.js` ran in the smoke config's desktop box — RESOLVED 2026-09-07 (CI #84)
**Where:** `playwright.smoke.config.js:38`, `scripts/home2.spec.js`
**What:** The file was added to the smoke config's `testMatch` on the premise that no job ran it. A job does: the workflow's own "HOME-2 phone layout" step, under `playwright.home2.config.js`, which is the only box its assertions hold in — 390×844 with `hasTouch`. The smoke config is Desktop Chrome at 1440×900 with no touch, so the phone's ruler ran on the desk: past `useIsDesktop`'s 1100px line the room is not drawn at all (`.home-thread` resolved to nothing, "door is drawn" failed) and without touch a long press cannot lift anybody (`.home-one.is-carried` stayed at 0). Fourteen tests went red for a reason none of them was about, and the run took 12m45s of timeouts.
**Fixed twice over:** the spec now declares its own viewport and touch (`test.use`), so no config can ever put it in the wrong shell again — its assertions measure against a literal 844 — and the smoke config's `testMatch` is back to `(smoke|casino2)`, because running the same twenty tests in two jobs buys nothing.

---

### BUG-40 — `casino2.spec.js` clicked a CASINO button HOME-2 had removed — RESOLVED 2026-09-07 (CI #84)
**Where:** `scripts/casino2.spec.js:120` (`openCasino`)
**What:** The step that failed run #84. `openCasino` clicked `getByRole('button', { name: 'CASINO' })` on both shells. HOME-2 job 1 took the bottom bar off the phone — HOME, CASINO and YOU became things in the room — so on the phone the way in is the door (`home-door`), and `HomeFlat` draws that door as furniture with no test id on the desk, where the rail's `DesktopTopBar` still has the button. The 1440 case passed; the 390 case sat on `locator.click` for the full two-minute timeout. Deterministic, reproduced locally first try.
**Fixed by** taking the way in that the shell actually has, and naming it: the door on the phone (asserted visible first, so a lost test id fails saying so rather than timing out on a mystery locator), the top-bar button on the desk.

---

### BUG-35 — `verify-watch-v2.js` "HIS reasoning" fails roughly one run in three — RESOLVED 2026-09-06 (TEST)
Not a race in the product: a race in the suite. The five WATCH-9 push checks read `of(ServerMsg.THREAD_LINE)` — a snapshot of the socket buffer taken at whatever instant execution reached that line. Under load the hero's session had played about five hands by then and the HIM line, which is written per DECISION rather than per hand, had not landed yet. The wire worked; the sample was early.

Fixed by waiting rather than sampling, with the file's own `waitFor`, the way the WATCHING check at the top of the same section already did. A HIM line is the right thing to hold for because it is the last of the four kinds to appear — the room talks before he has decided anything — so once it is in, all five checks read a settled buffer. No assertion was weakened; the same five still run, on a buffer that is allowed to fill.

No model needed: every decision carrying reasoning writes a HIM line (`table.js`, `_threadTo` on `ThreadKind.HIM`), and the no-key path returns "no API key configured — defaulting to a safe action" as its reasoning, so the deterministic fallback already exercises this wire. Nothing in the fallback had to change.

**Proof:** 10 consecutive runs green with a full `npm run test:e2e` running concurrently, every one reaching ALL CHECKS PASSED. In a first attempt under two concurrent suites the assertion never failed either — the three reds there were the machine killing processes outright (truncated logs, no assertion output, and the two load generators died at discovery as well), which is BUG-34's territory, not this one.

---

### BUG-38 — `verify-home-routes.js` points at a script that does not exist — RESOLVED 2026-09-06 (CI)
Fixed while chasing the CI red it sat next to. Three scripts said ``run `npm run build` first`` and there is no root `build` script; all three now say `build:client`. The CI failure itself was the other half of the same file: verify-home-routes.js EXITS 1 on a missing dist where verify-cache-headers and verify-deeplink-routes skip, so it was red on CI (which runs `npm test` before any client build) and green on any laptop with a dist lying around. It is now in NEEDS_CLIENT_DIST with the other two.

---

### BUG-33 — The client's ServerMsg had no PACE or READ key, so neither frame was ever handled — RESOLVED 2026-09-06
**Where:** `client/src/lib/protocol.js`, `client/src/hooks/useTable.js`
**What:** `client/src/lib/protocol.js` mirrors `src/server/protocol.js` and had been missing two of its entries for as long as it has existed. `ServerMsg.PACE` and `ServerMsg.READ` were both `undefined`, which made `case ServerMsg.PACE:` in useTable a case on `undefined` — a branch nothing arriving from the server could ever reach. The server has staged the all-in runout card by card since PACE-1 and pushed a READ the moment an opponent read forms; no client had ever handled either.

The visible symptom was subtle rather than broken, which is why it survived: `pace`, `potBb` and `reads` all ride the STATE snapshot too, so the felt was never blank. It just ran its OWN clock for the showdown runout (`WatchScreen`'s `flipped` interval, the fallback for "the server is not driving"), so PACE-1's whole point — every watcher turns the same card at the same moment — was never true, and the read panel only ever updated on the next snapshot rather than on the beat the read formed.

**Why the tests were green:** `useTable.test.jsx` emitted `{ type: ServerMsg.PACE }` and useTable matched `case ServerMsg.PACE:`. Both sides were `undefined`, so the six W3-6 tests passed against a message the real server has never been able to deliver — a suite that emits the client's own constant tests the client against itself. `protocol.test.jsx` pinned ServerMsg with `toEqual`, so it asserted the two keys' *absence*.

**Fix:** the suites were re-pinned first and watched go red (6 failures). `useTable.test.jsx` now emits a local `WIRE` table of the literal strings `src/server/protocol.js` sends, never `ServerMsg.<KEY>`, and one test walks that table asserting `ServerMsg[key] === wire` — the guard that would have caught this. `protocol.test.jsx` gained both keys. `PACE: 'pace'` and `READ: 'read'` were added to the client mirror; the PACE handler came alive unchanged, and a READ handler was written to match it (merged onto `game.reads`, which is what `WatchScreen.pickOpponent` reads, and exposed as `reads`; kept across hands, unlike `paceFrame`, because a read is accumulated knowledge and not a per-hand frame; a malformed push is ignored rather than allowed to blank the panel).
**Test:** 11 tests in `client/src/hooks/useTable.test.jsx` (6 re-pinned, 5 new) plus `protocol.test.jsx`. End to end, `scripts/verify-pace.js` now asserts the literals on the wire itself — "the staged runout is typed `pace` on the wire", "the read arrives as its own push, not only on a snapshot", "it is typed `read` on the wire" — so the mirror and the server cannot drift apart again without a red run.

---

### BUG-32 — The newborn does not walk into the room — RESOLVED 2026-09-06 (BIRTH-5)
Fixed the other way round from the one the entry proposed, and deliberately. The suggestion was to pass the newborn id down from App the way FLOOR-2 did (`newbornId={newlyBornAgent?.id}`); what shipped is a marker on HOME_STATE — `newborn`, computed on the SERVER's clock inside a 60s window (src/server/home.js), with `bornAt` alongside it for a client on an older server. A prop from the shell only works in the session that saw the birth, from the surface that saw it; the marker survives a reload, works on the desk as well as the phone, and cannot go out of step with the roster the room is drawn from. `useBirthWalk` in HomeScreen pins him at DOOR_SPOT for one beat as `door:born` — a place of its own, never confused with the `door:away` of an agent out at the casino — and releases him, so the existing `useWalks` crosses him to his chair with no second animation and no special case. `it('BUG-32 WIRE-1: and tells the room which agent was just born')` in client/src/App.test.jsx is un-todo'd and asserts the RULE (the room is told) rather than the mechanism.

### BUG-21 — Replay stopped after the opening beat — RESOLVED 2026-09-05
**Where:** `client/src/components/replay/ReplayTheatre.jsx`
Found in the mobile playtest, fixed in FIX-4 (`0d58ca8`). `.replay-theatre__stage` has no height of its own — its only child is the felt, and the felt's height IS 306/639 of whatever the ResizeObserver watching that stage reports. Every notification therefore handed back 48% of the last one, so the felt collapsed to nothing within half a second and took the board and the reveal with it. The theatre's own box is the viewport's, so that is what is measured now, with the header subtracted. Two hardenings alongside: the reel's interval no longer depends on `timeline.total` (read off an object every caller rebuilds each render), and the scrubber's controlled range input is handed a value already on its own step grid, so the DOM and React cannot disagree about where the reel is and the control cannot echo a seek back and pause it.
**Test:** FIX-4 cases in `ReplayTheatre.test.jsx` — a six-beat replay plays to the end under a browser-shaped ResizeObserver, and the felt keeps its height. Watched failing on the pre-fix tree.

### BUG-22 — Watch header rendered 45px against a 40px budget — RESOLVED 2026-09-05
**Where:** `client/src/screens/WatchScreen.jsx` / `.watch-screen__back`
FIX-4 (`0d58ca8`). `base.css` floors every `<button>` at `--tap` (44px), and a flex item's automatic minimum size is content-based, so that floor beat the row's declared height and the extra 5px came off the felt. `.watch-screen__chat` had been released from the floor when FIX-3c wrote it; `.watch-screen__back` never was.
**Test:** `headerDensity.test.jsx`, which recomputes each row's box model from the styles React applied. Watched failing pre-fix.

### BUG-23 — With the sheet dragged down, CHAT selected a tab nobody could see — RESOLVED 2026-09-05
**Where:** `client/src/screens/WatchScreen.jsx`
FIX-4 (`0d58ca8`). With the sheet at the HIDDEN detent the header's CHAT button picked the TABLE tab and stopped, so the gesture did nothing visible. Where there is no thread to open it now does the whole gesture — pick the tab *and* bring the sheet back up. Composed with WATCH-5's `openChat(ctx)` in MERGE-2 (`bbf3391`): FIX-4's position and body, WATCH-5's context argument, `sheetApiRef` dropped because it only existed to bridge a hoisting problem the ordering solved.
**Test:** `watchChatLayout.test.jsx` — with no thread to open, the sheet comes back up on the TABLE tab; the ceremony tap opens the thread with the hand attached; the header button opens it with null and never a click event.

### BUG-24 — Speech bubble painted over the zoom's back control — RESOLVED 2026-09-05
**Where:** the floor zoom sheet
FIX-4 (`0d58ca8`). The bubble sits at z-index 5 from y=30 and the back control occupies y=10..44, so the bubble covered it. The control is raised above it; nothing moves, and only the bubble's rounded corner passes behind, since its text starts below y=44.
**Test:** new `FloorZoom.test.jsx`. Watched failing pre-fix.

### BUG-25 — Watch felt filled a wide window edge to edge — RESOLVED 2026-09-05
**Where:** the watch felt / seat ring
FIX-4 (`0d58ca8`). On a wide window the felt stretched the full width, which threw the seat ghosts into the far corners of a table nobody was sitting at. The felt is bounded to the ref's 720px and centred above 760px; the seat ring was always absolute inside the felt, so it follows for free.
**Test:** `desktopWidth.test.jsx`. Watched failing pre-fix.

### BUG-26 — Min-raise loop, again: +10 into a 400-chip pot until the stacks were in — RESOLVED 2026-09-05
**Severity:** Medium (gameplay quality; also inflates LLM cost and arena runtimes)
**Where:** `src/server/table.js` (`_raiseOffer`, `_buildAiGameState`, `_disciplineAction`), constants in `src/server/pace.js`
**Predecessor:** BUG-13, closed 2026-08-29 on the strength of Tree 2's sizing directives and the `RAISES THIS STREET: n` briefing line. Those were a *request* to the model, and the loop came back in tonight's playtest. Recorded as a fresh entry rather than reopening BUG-13, because the diagnosis changed: **a model offered "raise 10–1000" keeps taking the 10, so the table stops offering it.**
**Fix (RAISE-1, `f77d4f9`):**
(a) a raise is at least `max(min legal raise, currentBet + ⅓ pot)` and never above the jam — an agent who cannot afford the floor may still shove, because all-in is the one raise that is always big enough. Undersized raises are rounded up and logged `[agent] undersized raise → X`.
(b) at four aggressive actions the street is CAPPED and the only raise left is the jam: call, fold or all-in, exactly as a capped street works in a cardroom. That is what guarantees the round terminates.
One seam does both jobs — the offer is built once, put in the briefing, and enforced on the way back in; a floor that lived only in the prompt would be a suggestion, one that lived only in the enforcement would keep showing the agent a size the table intends to overwrite. The floor is a fraction of the POT, so it does not bite heads-up preflop where the engine's own minimum is already larger — which was never the case the playtest complained about.
**Dials:** `RAISE_MIN_POT_FRACTION` (default 1/3), `RAISE_CAP_PER_STREET` (default 4), both env-dialable in `src/server/pace.js`.
**Test:** `pace.test.js` (10 cases on the two dials) and `table.raise.test.js` (11 cases through a real Table, including a street of nothing but minimum raises now terminating).

### BUG-27 — The thread opened with a win/loss tally instead of his voice — RESOLVED 2026-09-05
**Where:** `client/src/hooks/useAgentThread.js` (`legacyOpener`), `src/server/agentProfiles.js`
The CHATS thread opened with "Hey — I just finished 20 hands. Won 12, lost 8. Want to review any hands or adjust my strategy?" — a form letter, identical whether he had run over the table or been coolered three times. MOOD-2c had already written the real opener (`formatOpener()` picks by heat band and names the one hand he cannot let go of, ≤15 words, no counts), and WIRE-1 had routed all three surfaces through one `openerFor()`; the tally survived as the fallback. RAISE-2 (`f77d4f9`) removed it from the codebase: `presentAgent` always computes an opener, `formatOpener` gained a nature-voiced greeting for the case with no session to recap, and the client fallback is now his own birth line then a short last-ditch sentence. There is no model call anywhere in this path — templates the whole way down, so there is nothing to fail into.
**Test rule change, per the testing law:** `wire1.test.jsx` asserted the tally as "the fallback for a record written before MOOD-2c". That rule is retired — the tally is never correct now — so those cases were INVERTED rather than relaxed: `openerFor` must not produce it for any input. Five other suites used `/Ready to play/` purely as a "thread has loaded" anchor and now anchor on the new opening line; no assertion in them was weakened.

### BUG-28 — `opener` was null on every session-end path but one — RESOLVED 2026-09-05
**Where:** `src/server/agentProfiles.js` — `finishAgentSession` vs `POST /api/agents/:id/finish`
The reason BUG-27 kept surfacing. `opener` was written on only ONE of the two session-end paths (`finishAgentSession`, not the route's own inline teardown), and there only inside `if (recap string)`. So every other way a thread opens — an agent still at a table, one who has never finished a session, any owner-initiated finish — served `opener: null` and the client filled the hole with the tally. Both paths persist an opener now, and `presentAgent` computes one regardless (`openerForAgent`). This is the same two-session-end-paths wart BIO-2b/2c/2d hit from the other side (roles were derived on one path only); the duplication predates both trees and is worth collapsing.
**Test:** `opener.test.js`, 8 cases, three of which were verified failing before the fix.



### BUG-10 — In-game header drops platform branding — RESOLVED (verified visually 2026-08-29: spade + branding present in watch header; fix commit c7be663 from May)
**Severity:** Medium (visual)
**Where:** client/src/components/Header.jsx — in-game variant (rich game-view header)
**What:** During play (vs-AI / vs-Human / Watch), only the rich in-game header shows (back arrow + avatar + name + status + settings gear). The "AGENTIC POKER" wordmark + spade logo + agents pill at the top of the app disappears. User notes this loses the platform identity during the most-shared moments.
**Fix:** Either add a thin top strip with logo + AGENTIC POKER above the rich header, or fold the spade logo into the rich header on the far left next to/replacing the back arrow.

### BUG-12 — DECISION broadcast leaks AI reasoning + equity to live opponents — RESOLVED (routing fixed; spectator scoping completed by BUG-15 fix in AGE-33)
**Severity:** High (game integrity)
**Where:** src/server/table.js `_maybeRunAiTurn` — `this._broadcast({ type: ServerMsg.DECISION, ... })`
**What:** The DECISION message (action, reasoning, and — since AGE-16 — equity and potOdds) is broadcast to every connection at the table, including a human playing AGAINST the AI. Reasoning can describe hand strength, and equity ~85% preflop effectively reveals AA/KK. Observed 2026-08-29 in vs-AI play: you see House's thoughts.
**Fix:** Route DECISION only to spectators whose agent it is (and into the stored hand review); never to opposing seats mid-hand. Fold into Tree 4 (UI surfacing) or fix standalone earlier.

### BUG-13 — Min-raise wars: 20–30 raise ping-pong before all-in — RESOLVED (Tree 2 sizing directives; confirmed gone in AGE-28 arena + prod playtest) — **RECURRED, see BUG-26**
**Severity:** Medium (gameplay quality; also inflates LLM cost + arena runtimes)
**Where:** Agent decision behavior (src/agent/handler.js prompt) — engine is rule-correct; the models each min-raise, reopening action indefinitely.
**What:** AI vs AI / vs House escalate via repeated minimum raises, taking 20–30 turns to reach all-in. Classic LLM poker pathology. Observed 2026-08-29.
**Fix:** Tree 2 policy compiler adds sizing directives (commit big or don't reraise; no min-raise chains) + add a `RAISES THIS STREET: n` line to the decision briefing so the model can see the loop. Optionally a soft cap on raises per street as backstop.

### BUG-14 — No way to stop a deployed agent — RESOLVED (AGE-33: SIT_OUT WS message, finish hand → TABLE_CLOSED "sat out by owner" → idle+recap)
**Severity:** High (UX / control)
**Where:** watch view + agent thread; server table lifecycle
**What:** Once deployed (e.g. vs House), an agent plays until someone busts — no STOP/sit-out control exists. Observed 2026-08-29 on localhost.
**Fix:** Add a STOP button (watch view + thread/rail). Behavior: finish the current hand, then close the table gracefully (TABLE_CLOSED "sat out by owner"), call /api/agents/:id/finish so the agent goes idle. Server largely supports this via spectator-leave/onEmpty; needs an explicit SIT_OUT WS message so it is deliberate, not a side effect of closing the tab. Fold into Tree 3.5 or a small standalone fix.

### BUG-15 — Spectators see ALL seats’ reasoning, including the opponent’s — RESOLVED (AGE-33: full payload only when deciding seat === spectatorSeat)
**Severity:** Medium now (immersion), High later (cheating in PvP spectating)
**Where:** src/server/table.js `_broadcastDecision` (BUG-12 fix routed by connection type only)
**What:** Spectators receive full DECISION payloads (reasoning/equity) for every seat — watching your agent vs House shows the HOUSE’s thinking too. Observed 2026-08-29 evening on localhost.
**Fix:** In _broadcastDecision, spectators get the full payload only when the deciding seat === their spectatorSeat (their own agent); bare {seat, action} otherwise. Rider on Tree 3.5.

### BUG-16 — Presence lies: agent shown seated/"playing" while his table is frozen — RESOLVED (Tree 4)
**Was:** Hands only advanced while a client had the table open. An agent showed presence=playing while nothing happened; opening WATCH woke the game. The pet only lived while stared at.
**Fixed by:** the server-side session loop (Tree 4) plus the AGE-37 presence law in `presentAgent` — presence is derived from a live table via `liveGameView`, never from the stored `status` flag.
**Evidence:** scripts/verify-server-life.js, green in `npm run test:e2e`, asserts in order: "3+ hands completed with no client connected"; "presence is playing while the loop runs"; "liveGame reports hands this session"; "table survives the watcher leaving"; "hands continue after disconnect"; "presence still playing after disconnect"; and on sit-out "presence flipped to resting" with "liveGame gone once resting". Client side, CasinoFloor.test.jsx pins that an agent with presence resting and no liveGame draws nothing live.

### BUG-17 — WATCH entry appears to start a NEW game rather than joining the running one — RESOLVED (Tree 4)
**Was:** Same root cause as BUG-16 — the viewer's arrival is what dealt the hand.
**Evidence:** scripts/verify-server-life.js connects a WebSocket mid-hand and asserts "caught the table mid-hand", "a STATE snapshot arrives on WATCH", "snapshot carries the hand in progress" (handNumber not reset), and "no extra seat was created by watching". Client side, CasinoFloor.test.jsx asserts WATCH on a live agent calls onWatch and issues no POST at all — the deploy path is the only one that queues a table.

### BUG-18 — Flagged hand review never showed the opponent's showdown cards — RESOLVED 2026-09-05
Found by TEST-1, fixed in commit bb5ea0b. The server records `opponentShowdownCards` on every flagged entry and the API returns it unscoped (showdown cards are public); the sheet dropped it. New `OpponentShowdownRow` in HandReview renders the cards and the seat that showed, and nothing at all when the pot was won without a showdown. Test un-todo'd and green.

### BUG-19 — /flagged fetch sent no credential, so the owner's own hole cards came back empty — RESOLVED 2026-09-05
Found while fixing BUG-18, fixed in the same commit. `holeCards` on GET /api/agents/:id/flagged are owner-gated by `isOwner()`, which reads `x-telegram-init-data`; FlaggedHandsSheet sent no headers, so in production the review rendered card backs where the agent's own hand belongs. Invisible on localhost, where no TELEGRAM_BOT_TOKEN is set and `isOwner()` defaults to true. (FLOOR-3 had added the header to the GET /api/agents calls; this endpoint was missed.)

### BUG-09 — vs-You: agent does not seat as opponent — RESOLVED
Fixed in commit 87d14d2. Root cause: `wsServer.js` JOIN handler gated `maybeAutoSeatAI` behind `process.env.AI_ENABLED === 'true'`. When this env var was not set on the VPS, the user's agent fell through to `scheduleHouseFallback()` instead of taking the opponent seat. Fix: removed the `AI_ENABLED` gate; `wantAI === true` is sufficient — `getAgentAction` already handles the no-API-key case gracefully. Needs `git pull && pm2 restart all` on VPS to take effect.

### BUG-01 — Nav bar icons missing — RESOLVED
Discovered already fixed when checking the live code. HomeIcon, PlayIcon, AgentsIcon, HistoryIcon, ProfileIcon are all defined in App.jsx (~lines 611-656).

### BUG-02 — Chat input causes iOS zoom — RESOLVED
Fixed in commit 012882f (feature/cleanup, polish tree). All input/textarea elements bumped to font-size 16px across chat.css, agent-chat.css, analysis.css.

### BUG-03 — Agent creation double-confirm — RESOLVED
Fixed in commit 3570f69 (fix/watch-opponent). Draft Ready intermediate step removed; flow goes directly from chat completion to Agent Created card.

### BUG-04 — Game continues vs dead AI after player leaves — RESOLVED
Fixed in commit ebc40ae (fix/watch-opponent). Table.js gained hasHumanPlayer() helper; removeConnection now broadcasts TABLE_CLOSED and clears game state when the last seated human leaves a vs-AI game.

### BUG-05 — WatchBanner text has no spacing — RESOLVED + COMPONENT REMOVED
Initially fixed via gap:8px in commit 709540a (fix/analysis-panel). The WatchBanner component itself was later removed entirely in commit bcd9354 (feature/post-merge-frontend) because it duplicated information now shown in the rich game-view header.

### BUG-06 — Table layout breaks during human player's turn — RESOLVED
Found to be a symptom of BUG-A (AnalysisPanel ungated). Fixed in commit ec84840 (fix/analysis-panel) by gating AnalysisPanel + the .app__main--analysis className on config?.isSpectator. Once the panel only renders in spectator mode, the layout no longer shifts on the hero's turn.

### BUG-07 — Both seats show same agent name — RESOLVED
Fixed in commit 9c27bb7 (fix/agent-name-propagation). AgentsTab now passes agentName via the onVsYou payload; App.jsx correctly forwards agentDisplayName to the server.

### BUG-08 — HistoryPlaceholder and ProfilePlaceholder undefined — RESOLVED
Discovered already fixed when checking the live code. Both placeholder components are defined in App.jsx (~lines 580-609).

---

## Notes for next session
- AGENT auth: check that ANTHROPIC_API_KEY is set to the actual key (not the placeholder string `sk-ant-PUT-YOUR-KEY-HERE`) before running locally. The local server falls back to fold-every-hand on 401, which manifests as agents that "play but never raise".
- All design work (icons, oval table, cards, home screen) should be PORTED from design-refs/ folder, not redesigned from scratch. Codex already built the designs.
- For merge conflicts, prefer Cowork chat resolving them via the Edit tool directly on the conflict markers rather than running Python `re.sub` scripts — those scripts have repeatedly truncated rules at conflict boundaries, leaving unclosed CSS blocks that break the build.
- Branch cycling within a worktree: use `git fetch origin && git checkout -B feature/next main`. The naive `git checkout main && git pull && git checkout -b feature/next` fails because git only allows one worktree per branch, and main is already checked out in C:\Projects\ai-poker.
