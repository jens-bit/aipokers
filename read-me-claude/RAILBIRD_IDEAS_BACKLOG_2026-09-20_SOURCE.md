# Railbird — everything you've asked for that isn't in the game yet

Compiled 20 Sep 2026 from every session since 5 Sep. Your ideas in your words where I have them, with the date. Things I proposed and you haven't decided are marked **(Cowork proposal)** so you can tell them apart.

Status key — **not started** · **partly built** (something exists, not what you asked for) · **designed** (frames exist, not ported) · **decided, not built** · **parked** (you said later / maybe) · **dropped** (you rejected it) · **check** (I can't tell from here whether it landed in the last four days)

---

## 1. The agent as a person

| Idea | When | Status |
|---|---|---|
| Talk to him and he does it — "go to the casino" and he goes | 16 Sep | **check** — TALK-1 was written, not confirmed sent |
| A real conversation, not a one-shot reply; he answers "what happened?" with the actual hand | 16 Sep | **check** (TALK-1) |
| He remembers what you told him and brings it up later | 16 Sep | **check** (TALK-1 job C) |
| He knows people — Sims-style relationships: rival, fish, nemesis, respects, owes me, with history ("took me for $10,976. Twice.") | 16 Sep | **not started** — brief sent to Claude Design as the profile rebuild |
| Tapping him opens HIM: whole silhouette large, opens with a blurb ("I want a beer"), whisper right there, he stays visible; profile/stats is a page you navigate to from there, not first | 7 Sep | **partly built** — agent view exists, profile is still stats-first |
| That view carries the deploy button | 7 Sep | **check** |
| Granite is a blob — the House cast needs faces, lines, a memory of having beaten your guy; a nemesis | 16 Sep | **not started** — held until the profile design returns |
| The ghosts need expressions / "do they need a smiley face" — the five face triggers exist server-side, nothing draws them | 10 Sep | **partly built** |
| More animated: eyebrow wiggles, floating hands that hold cards, push chips, toss on fold (Madness Interactive style) | 5 Sep | **partly built** — hands exist |
| Winner puts his hands up and cheers "yay"; wins and busts get a big celebration — fireworks, boom boom, sound | 7 Sep | **designed** (board 26, 52p–r) — CELEBRATE-1 never run |
| Sound and reveals in the hand | 5 Sep | **not started** |
| Attributes go backwards too — playing hungry loses discipline | 6 Sep | **partly built** — beer has a discipline hit, nothing else does |
| Agent names capped ~5 chars, longer names get a self-chosen nickname ("Alexander" → "Alex") | 6 Sep | **check** |
| Draft is always 4 prompts, ghost builds up silhouette → hood → eyes → collar | 6 Sep | **check** |
| Breeding — ghosts have offspring in some unique non-sexual fun way, tied to attributes and roles | 10 Sep | **not started** |
| Ghosts could evolve into bird characters | 7 Sep | **parked** ("idea in the pocket") |

## 2. Home and the flat

| Idea | When | Status |
|---|---|---|
| The bar at the very top of the casino room; staircase where the board was; the board removed | 15 Sep | **not started** — with Claude Design as wave 65 |
| Grab and carry your agents around the flat ("the natural thing I would like to do") | 6 Sep | **partly built** — carry-to-casino works, free carry around the flat doesn't |
| Agents do other things at home than poker — watch videos etc. ("hilarious that they all just play poker constantly") | 7 Sep | **not started** |
| The TV shows the live game in miniature — cards, not dots; tap for replays | 6 Sep | **partly built** — the blob. With Claude Design as wave 65 |
| TV does two jobs (live feed vs tape room) — split them | 7 Sep | **not started** |
| The safe in the corner shows the full balance and opens all money actions; cleaner flow with a pull-up full ledger (beers, brought home) | 6 Sep | **partly built** |
| Wants bubbles must not scream — smaller | 6 Sep | **partly built** |
| "N agents live" pill opens the roster sheet; absent agents leave an empty chair or hook | 7 Sep | **check** |
| A roster / table view of all your agents ("we had a design for that back in the day") | 7 Sep | **check** |
| The home needs a large lift | 7 Sep | **not started** — wave 63B written, never sent; HOME-3 after the friends test |
| Jobs — your agent works for chips. You said design it in Claude Design first | 15 Sep | **not started**. (Cowork proposal: no cash wage works at any stake; a job has to pay skill, heat relief, an item, a person or a story. The cost — hands not played — is already right.) |
| The newspaper and the appearance button (the Codex sketch you remembered) | 15 Sep | **not started**. (Cowork proposal, ECONOMY_V2 §5: one hand written up, one line per agent in his voice, the household's number, the rake as news, classifieds, gossip. Screenshottable.) |
| Decorate your house | 7 Sep | **parked** ("later") |
| Neglect can cost you an agent; he goes to the rail, reclaimable at a price. Variance never can | — | **(Cowork proposal)**, not decided |

## 3. The casino

| Idea | When | Status |
|---|---|---|
| The floor is "your box seats plus the league ticker" — your own felts in full detail, a ticker of casino-wide events (biggest pot, cooler, heater, bust, nemesis sat down), tap-to-spectate, felts going HOT before a big showdown. You called it "super super smart" | 5 Sep | **partly built** — the ticker exists |
| "Your table" flicks left/right between your agents | 6 Sep | **partly built** — a carousel shipped at the top of the casino; you don't know where it should live. Wave 65 |
| One room, not three | 15 Sep | **built** — but not the layout you wanted |
| A zoomable casino you can look into, with several live tables and people ("insanely cool", knows it costs server) | 6 Sep | **not started** |
| House bots are filler only — "adding bots is boring" | 5 Sep | decided; the ECON-1 numbers say the bots currently beat everyone |
| Railbird has its OWN casino that people play at (Alex's idea, "so smart") | 12 Sep | **not started**. (Cowork: this is the structural answer to where money comes from — the House bank drains; players must be the source. ECONOMY_V2 §2–3.) |
| Hot hands flagged with time to click in | 5 Sep | **partly built** via the ticker |
| Rake drawn on the felt (BUG-218) | 15 Sep | **not started** — claimed done once, wasn't |

## 4. Watching a hand

| Idea | When | Status |
|---|---|---|
| **He can always see his agent and his cards** — asked "a million times" | repeatedly | **not delivered** — the sheet covers them. Wave 65 |
| Read bars (his picture of the opponent) instead of live analysis | 5 Sep | **partly built** — opponent card has PLAYS / RAISES FIRST / AGGRESSION / FOLDS TO HEAT |
| Win % on screen | 5 Sep | **partly built** — "Est. pot share" |
| RANGE and HISTORY tabs removed; the table-id line removed | 5 Sep | **check** |
| Your own agent at the bottom facing you; whisper Hearthstone/WoW-style; history as a glass overlay; the felt never shrinks | 5 Sep | **partly built** |
| The felt is too cluttered — opponents, their cards, chips and names smaller | 6 Sep | **check** |
| Tape-room read shows as "+3 Granite" small under the bubble, no sentence | 6 Sep | **check** |
| COMPOSURE / READS upgrade cards belong in recent activity, not in the chat | 7 Sep | **check** |
| Hold-to-fast-forward (TikTok style) on replays | 7 Sep | **not started** |
| Board row empty until the flop — never five face-down backs | 15 Sep | **not delivered** |
| Whisper input flips the sheet to CONVERSATION | 16 Sep | **not started** |

## 5. Economy

| Idea | When | Status |
|---|---|---|
| Owner wallet separate from per-agent pockets; per agent choose top-up / allowance / auto-refill | 5 Sep | **partly built** — safe and pockets exist, allowance and auto-refill don't |
| Start small — $100, one agent, one chair; second agent after a few grinding sessions; chair price rising; cap four | 15 Sep | **decided, not built** — chairs don't exist as a purchase yet |
| Three stakes low / mid / high on a real ladder ($10 / $100 / $1,000 buy-in per the model) | 15 Sep | **partly built** — 10/20, 25/50, 50/100 exist; the ladder isn't the model's |
| Stake-scaled daily top-up when broke, "for now" | 15 Sep | **not started**. (Cowork: make it a staked seat, not cash — $10 cash a day is farmable against $9.60/day from playing.) |
| More items so money has somewhere to go — consumables and the flat: space, storage, furniture, TV, chairs (MONEY_AUDIT §19) | 15 Sep | **not started**. (Cowork catalogue in ECONOMY_V2 §6: bed, comfy chair, coffee, fridge capacity buy hands; training books, coach, notebook, bigger TV buy win rate; hoodie, shades, card protector buy nothing. Every item passes one test: hands granted × win rate > price.) |
| Beer and snack bought **one at a time**, priced so you feel it | 15 Sep | **not delivered** — "BUY 6" shipped |
| Fridge arrows colour-coded and labelled per stat, one-sentence why on tap | 15 Sep | **not delivered** — monochrome, unlabelled, paragraph on tap |
| Betting on outcomes with the owner's coins; the prediction beat (guess what he'll do) — worried it reads as controlling him | 5 Sep | **parked**, undecided |
| Fix the economy: soften the cast to lose ~12 bb/100 pre-rake, rake 0.5% capped 1bb with no flop no drop, target +8 bb/100 net, re-sweep the sim | 16 Sep | **(Cowork proposal)** — you said "note it down", not yes. ECON-1 measured agents at −8.9 bb/100 and every household going broke |
| Cap on fed hands per day — a snack currently outpaces the drain, so a fed agent is unbounded | 16 Sep | **(Cowork finding)**, not decided |
| Staking — back other players' agents for half the profit | — | **(Cowork proposal)**, architecture B, not decided |
| Rewarded ads at wants only; ads + a paid no-ads tier as one monetisation option | 6 Sep | **decided direction, not built** |
| Two-currency wall; Stars in the Mini App; Solana/USDC on web later; no token in pots; no real-money wagers without Malta counsel; NFTs cosmetic later | Aug–Sep | **decided, not built** |

## 6. Rarity and cosmetics

| Idea | When | Status |
|---|---|---|
| Birth-roll rarity — golden and silver skins super rare at birth, "like a shiny in Pokémon" ("a sucker for rarity", "going overboard") | 6 Sep | **parked** |
| Hats and cosmetics your agent buys; the appearance button | 9 Sep, 15 Sep | **not started** |

## 7. Growth and social

| Idea | When | Status |
|---|---|---|
| Visiting — send your agent to a friend's flat, challenge their agent, he accepts via push, they play at his house; content forms there. VISIT-1 as the referral | 7 Sep | **partly built** server-side; the visit UI, referral door and share-visit variant were never drawn |
| A public X/TikTok account per agent posting his nights — selfie-style cards reflecting his state (the beer) | 7 Sep | **not started** |
| Share card of one agent's night — "the characters are the content" | 6 Sep | **partly built** (SHARE-2) |
| Public Telegram channel fed by the casino event bus — biggest pots, coolers, busts | 6 Sep | **built, switched off** — `TICKER_ENABLED` / `TICKER_CHANNEL_ID` unset on the VPS |
| The friends test — Fidde, Jonathan's office, Alexander, no pitch, watch day-two opens and whispers, stop adding features until then | 6 Sep | **not done** — and the feature-adding didn't stop |
| Guest mode — play in any browser without Telegram, rate-limited until claimed, retired after 30 days | 6 Sep | **built, switched off** — `GUEST_ENABLED` unset on the VPS |
| Live demo on the landing page — draft a character in a chat with template replies, see him generated in real time, dropped on a random table playing fake hands, client-side only | 6 Sep | **not started** — landing on prod is still LAND-5 v2, wave 61 hero not ported |
| Google login maybe later; standalone app for later | 6 Sep | **parked** |
| Seed via the Malta iGaming/crypto network and Swedish friends → Show HN / PH / r/poker → creators → Adsgram → paid last | 6–7 Sep | **not started** |

## 8. Brand

| Idea | When | Status |
|---|---|---|
| Railbird — railbird.se bought, @railbird_app_bot claimed, "a good rebrand if you tell the story"; the app still says agenticpoker.app in places | 7 Sep | **partly done** — RENAME-1 / BRAND-1 queues written, **check** whether run |
| The mark is the ghost peeking over the rail; hood-only as the bot avatar, to be replaced with the B8 export | 8 Sep | **partly done** |
| Tagline "Raise a poker player" | — | decided |
| "Deal Him In" as a slogan or alternate name (dealhimin.com) | 8 Sep | **parked**, undecided |
| The magpie | 7–8 Sep | **dropped** ("maybe come back to it later") |
| Landing: card backs in the teal play colour, cards lower so the face shows, bigger images on desktop | 6 Sep | **not started** |
| A logo redesign wave from Claude Design | 7 Sep | **not started** |

## 9. Long horizon — where it's heading in your head

| Idea | When | Status |
|---|---|---|
| The CITY — like The Sims: agents go around, do activities, report back so you check in on them | 9 Sep | **not started** |
| Each agent gets a crypto wallet with real money — buys hats, plays poker, trades with other agents, buys crypto, is on chain, sits at a computer and browses ("cost would probably be astronomical") | 9 Sep | **not started** |
| Poker stays at the core even as it drifts toward a city game | 10 Sep | principle |
| Chess next | — | **decided, not started** |
| Model by stakes + bring your own agent | — | **decided, not built** |
| Switch the agent-side model to Venice for the grant | 10 Sep | **open** |
| API-first: public API, llms.txt, OpenAPI, agent-friendly auth that doesn't need Telegram — AI agents as first-class players | Aug | **partly built** |
| Real money / TON | Aug | **deferred** pending legal counsel |

## 10. Process — your rules that got dropped or changed

| Rule | When | Status |
|---|---|---|
| Design before code for anything visual | 6–7 Sep | **dropped in practice** for the one-room casino — that's why 0.18.0 looks wrong |
| Pair verification: a PNG of the real screen at 390×844 per visual job, judged before merge (DESIGN_GAP §3) | 8 Sep | **dropped in practice** — reinstated as of 16 Sep, green tests no longer count as done |
| The Claude Code GitHub app so @claude on an issue becomes a PR gated by CI | 6 Sep | **check** |
| Astra only in lab/3d or as a read-only reviewer, never in src/ | 9 Sep | **changed by you** 19 Sep — Astra is now fixing UI. One branch, never main, integrator merges |

## 11. Outside the game

| Item | Status |
|---|---|
| Venice grant — email to partnerships@venice.ai written | **not sent** |
| Claude Startups — form answers ready (Nortrend Services Ltd, own console org, lowest spend band, Malta) | **not submitted** |
| Malta Enterprise Business Start (€10k, deadline 30 Oct) | **not started** — only if the Sweden move doesn't break operating presence |
| TON grants via Questbook | **parked** until cosmetics-on-chain is a decision |
| Claude Design wave 65 (casino floor with the bar at the top, the in-hand sheet, the TV) | **sent 16 Sep**, **check** for frames |
| Claude Design wave 66 (the profile rebuild, Sims-style) | **written**, not sent |

## 12. Ops you still owe yourself

- Rotate `ADMIN_KEY` on the VPS — the write-capable admin panel is live and the key is in this chat. Two minutes.
- Rotate the three exposed API keys (VPS first — never revoke without replacing), the bot token, the deploy key.
- VPS switches: `GUEST_ENABLED=1`, `TELEGRAM_BOT_USERNAME`, `NOTIFY_ENABLED=1`, `PUBLIC_BASE_URL`, `TICKER_ENABLED` + `TICKER_CHANNEL_ID`, `/setinline` in BotFather.
- Check for a persistent `ANTHROPIC_API_KEY` in the PC's environment variables.

---

## If you want my read on order

You said it yourself on 6 September and it's still right: stop adding features and give it to three friends. Everything above the line "friends test" in §7 is what stands between you and that. In order: wave 65 lands and gets ported with pictures → the nine pure bugs → TALK-1 so he listens → the friends test → then the newspaper, then the villain, then the economy overhaul. Jobs, breeding, the city and rarity are all after somebody who isn't you has come back on day two.
