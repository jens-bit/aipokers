# Prompt caching on the decision call (CACHE-1)

**Conclusion up front: prompt caching cannot reduce cost on Claude Haiku 4.5 at
our prompt size. Turning it on measured +34.9% per decision. It ships OFF.**

This document exists so nobody re-opens the question without the numbers.

## What we thought

The Tree 4 report noticed `cached:0` on every decision call and concluded the
autonomous tables were re-paying the full prompt every turn. That observation
was correct. The inference — that switching caching on would cut the bill — was
not.

`cache_control` was already present on every call. Nothing was misconfigured.

## The binding constraint

Prompt caching only creates an entry once the cached prefix exceeds a
model-dependent minimum. Below it the request succeeds, no error is raised, and
`cache_creation_input_tokens` comes back `0`. The minimum is **not** monotonic
across model generations:

| Model | Minimum cacheable prefix |
|---|---:|
| Claude Opus 5 | 512 tokens |
| Claude Sonnet 5, Opus 4.8 | 1024 tokens |
| **Claude Haiku 4.5 (what we run)** | **4096 tokens** |

Haiku 4.5 has the highest minimum of any current model. Measured against it
with `messages.count_tokens`:

```
TOTAL request                                  896 tokens
  system block (strategy + memory + format)    315
    static part (strategy + format contract)   235   <- the cacheable candidate
    memoryContext                               88
  user prompt (board, briefing, reads)         583
```

The cacheable prefix is **235 tokens — 17× below the floor.** That is why
`cached` was zero, and no amount of `cache_control` placement changes it.

## Why padding to the floor makes it worse

Cache reads cost 0.1× base input; cache writes cost 1.25×. So caching a prefix
of size `S` is only cheaper than sending the genuine static content `S_real`
uncached when:

```
0.1 × S  <  S_real
```

On Haiku 4.5, `S` cannot be below 4096, so caching wins only if we already had
**more than ~410 tokens** of genuinely static content. We have 235. The
inequality cannot be satisfied — padding to reach the floor costs more than it
saves, by construction.

Measured, not modelled — two real 10-hand autonomous sessions, live Haiku:

| | decisions | cache hits | cost / decision |
|---|---:|---:|---:|
| Cache prefix OFF (ships) | 19 | 0 | **$0.0008077** |
| Cache prefix ON | 51 | 50 (98%) | **$0.0010893** |

**+34.9% per decision.** The caching itself works perfectly — hit from call 2,
~4,600 tokens read per call, the invariant block shared across the hero and the
House. It is simply the wrong tool at this prompt size.

A second finding from the same run: the ON session played **51 decisions across
10 hands against the OFF session's 19**. The reference block does not merely
pad — it materially changes how the agent plays. That alone disqualifies it as a
semantics-neutral change.

## The default prompt did not change, and that took a correction

The first cut of this work reordered the system prompt by volatility on every
request — invariant block, then strategy, then memory — on the theory that the
ordering is right in the abstract and costs nothing.

It costs something. A 150-pair arena run against the AGE-40 baseline:

| | bb/100 | VPIP | AF | fold% | decisions | Station VPIP |
|---|---:|---:|---:|---:|---:|---:|
| AGE-40 baseline | +126.1 | 32.2 | 6.81 | 19.4 | 742 | 94.6 |
| reordered | +84.9 | 40.3 | 5.67 | 16.2 | 730 | **76.7** |

Depth of play held (730 decisions against 742) and the bb/100 gap sits inside
overlapping CIs, but the **Calling Station's VPIP fell 94.6 → 76.7**. That is an
archetype whose entire definition is "call almost everything preflop", and the
only change was that its persona now sat behind the format contract instead of
first. Persona-first is load-bearing for archetype adherence.

Since caching cannot pay off on Haiku 4.5 anyway, reordering by default would
have spent real behaviour to buy nothing. The default path is therefore
**byte-identical to the pre-CACHE-1 prompt**, pinned by `reference.test.js`
against a literal copy of the old string rather than against the code that
builds it. Every restructuring is scoped to the `PROMPT_CACHE_PREFIX=1` path.

## What did ship

**1. The volatility ordering, on the cache-prefix path.** It fixes a real bug
that would bite the moment caching ever worked. `memoryContext` sat *inside* the
`cache_control` block, between the strategy and the format contract. It is
rebuilt after every hand (`updateComputedMemory` → `_refreshAgentMemory`) and
restates the agent's hand count and rolling stats, so its bytes change at every
hand boundary — even on a model whose minimum we cleared, the entry would have
been invalidated once per hand and could never have amortised. On that path the
blocks are ordered by how often they change:

```
[0] invariant  — identical for every agent at every table   (cache_control)
[1] strategy   — identical for the life of one agent        (cache_control)
[2] memory     — changes every hand, so it sits behind both
```

Invariant ahead of strategy also means breakpoint [0] is the same bytes for
every agent on the floor — one entry serves all of them. Confirmed in the ON
run: hero and House read the same prefix.

**2. `written` is now logged** alongside `cached`, so
`cache_creation_input_tokens` is visible and a silent below-minimum failure
cannot hide again.

**3. A size guard.** The invariant block measured 4157 tokens against the 4096
floor on the first cut — 1.5% headroom, close enough that a wording edit could
silently drop it under and stop caching with no error. It now measures 4576
tokens (480 headroom) and `reference.test.js` guards the length so the margin
cannot be edited away unnoticed.

## The other call sites

`generateAiChatLine` (trash talk) and `callClaude` (memory narrative, owner
chat) have system prompts of a few hundred tokens — the same 17×-under-floor
problem at a fraction of the volume. Nothing to do there either.

## When to revisit

Any one of these flips the arithmetic:

- **The decision model changes.** On Claude Opus 5 the floor is 512 tokens, and
  the 235-token static prefix would need only a modest, genuinely useful
  addition to clear it — at which point caching is a straightforward win.
- **The static prefix grows past ~410 tokens for its own reasons.** If the
  strategy text or a permanent briefing section grows, re-measure: past that
  point the cached read is cheaper than sending it.
- **We decide the richer reference genuinely improves play.** Then the trade is
  no longer "same output, more cost" but "different output, +35% cost" — a
  question for the arena, not for this document. Note that it would also need
  the persona-ordering problem above solved, not just enabled.

Re-measure with `messages.count_tokens` before acting on any of them. Do not
re-derive the floor from memory; it has changed between model generations and
is not monotonic.
