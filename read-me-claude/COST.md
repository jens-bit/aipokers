# COST.md

What a decision costs, and the arithmetic behind the dials that change it.
Read this after CORE_GAME_PLAN.md's COST-1/COST-2 trees; this file is the
place the caching arithmetic lives so it does not have to be re-derived every
time somebody asks "why don't we just cache the prompt".

## Prompt caching: still not viable on the shipped model — COST-2 job 4

CACHE-1 (2026-08-30, see CORE_GAME_PLAN.md) closed this once already. COST-2
job 4 re-ran the arithmetic on the trimmed prompt (COST-2-2) to check whether
shrinking the dynamic side changed the answer for the static side. It didn't.

**The floor.** Anthropic's prompt caching requires a minimum cacheable prefix
per model. This number lives in Anthropic's prompt-caching documentation, not
in `@anthropic-ai/sdk`'s types — `node_modules/@anthropic-ai/sdk` defines the
`cache_control` field on a content block (`resources/messages/messages.d.ts`)
but does not enumerate per-model minimums anywhere in the package. The
figures below are the ones CACHE-1 recorded and this job did not find reason
to revise:

| model            | minimum cacheable prefix |
|------------------|---------------------------|
| claude-haiku-4-5 | 4096 tokens (highest of any current model) |
| claude-sonnet-5  | 1024 tokens |
| claude-opus-5    | 512 tokens |

`AI_MODEL` defaults to `claude-haiku-4-5` — the model with the highest floor,
which is exactly the one everything above assumed nothing would ever cross.

**Our static block.** `buildSystem()` — strategy + memory + the output
contract — is the only candidate for `cache_control`, because it is the only
part of the call that repeats across hands (`buildUserPrompt()` is different
every decision by construction). Measured by `scripts/measure-tokens.js`
(chars/4 estimate — see `src/agent/tokenEstimate.js`), with the default
strategy and no memory context:

| when                          | static tokens |
|-------------------------------|---------------|
| CACHE-1 (2026-08-30)           | 235 |
| COST-2 job 1, before trimming  | 435 |
| COST-2 job 2, after trimming   | 291 |

435 tokens after several trees (RAISE-1, mood, TLK-1) had each added their own
paragraph; 291 after COST-2-2 cut the prose those trees didn't need duplicated
elsewhere. Either way: **291 is 7% of 4096.** The trim moved the number, not
the verdict.

**The arithmetic, if we padded to the floor anyway.** The only way to make
this block cacheable at all is to inflate it past 4096 tokens with content
that does nothing — there is no legitimate 3,805-token addition to "you are
playing No-Limit Hold'em, respond with this JSON shape." Padding it anyway,
priced on Haiku 4.5 ($1.00 / $5.00 per million tokens, in/out):

- A cache **write** is billed at a premium over the base input rate — 1.25x
  for the default 5-minute TTL (Anthropic's published multiplier; not
  encoded in this repo since a write has never happened on this path). Padding
  291 → 4096 tokens means writing ~3,805 tokens nobody asked for, at
  1.25 × $1.00/M ≈ **$0.0000048 per write** for the padding alone — trivial in
  isolation, but it is pure loss with nothing behind it.
- A cache **read** is billed at `CACHED_INPUT_MULTIPLIER = 0.1` (already in
  `pricing.js` — the one number here this repo actually encodes, because it
  is the number that would matter if a cache ever existed). Reading the
  padded 4096-token block instead of paying full price saves
  ~4096 × 0.9 × $1.00/M ≈ **$0.0000037 per read** relative to sending it
  uncached.
- Break-even is roughly 1.3 reads to recoup the write premium on the padding
  alone — cheap in call count, because every number in this paragraph is
  cheap. Haiku is $1/M tokens; nothing about this prompt was ever going to
  cost real money.

**Calls per five minutes per agent** (the other half of "can a cache even
stay warm"): a watched table deals on `HAND_PAUSE_MS` (default 8000ms)
between hands; a heads-up hand runs ~2.9 decisions on average (`decisionsPer100`
≈ 288 in the ACCEPT-1/arena reference run, CORE_GAME_PLAN.md). That is on the
order of 15–20 hands and 45–58 decisions per five minutes at a table watched
continuously, roughly half of which reach a model at all post-COST-1/COST-2
(policy share ran 40–56% in the same reference data) — call it **10–15 model
calls per agent per five minutes** when watched, far fewer once COST-2-3's
unwatched dial engages. That is comfortably inside a 5-minute cache TTL were
one to exist. It does not change the verdict: the floor was never a frequency
problem, it is a size problem, and frequency does not fix size.

**Verdict: still closed.** The trim in COST-2-2 made the static prompt
smaller, which moved it further from paying for a cache, not closer — there
is less prefix to amortize a write against, not more. Per CACHE-1's original
condition, this is revisited only if (a) the static prefix organically grows
past ~4k tokens from real content (not padding), or (b) the shipped default
model changes to one with a lower floor (Sonnet 5 at 1024, Opus 5 at 512 —
either is within reach of a genuinely richer strategy/memory block; Haiku
4.5's 4096 is not, and manufacturing 3,805 tokens of filler to get there is a
worse decision than paying for the tokens uncached every time).

**Not implemented, on purpose.** `cache_control: { type: 'ephemeral' }` stays
on the static block in `providers/anthropic.js` exactly as CACHE-1 left it —
inert below the floor, costs nothing to leave in place, and removing it would
just mean re-deriving this file's conclusion again later. No `PROMPT_CACHE`
flag was added; there is nothing behind it to flag.
