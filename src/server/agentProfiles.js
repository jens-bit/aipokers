import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { telegramAuthMiddleware, isOwner } from './auth.js';
import { rateLimiter } from './rateLimit.js';
import { normalizeProfile, inferProfileFromStyleRisk } from '../agent/policy.js';
import {
  initialMood,
  ensureMood,
  applyEvent as applyMoodEvent,
  tickDecay as tickMoodDecay,
  applyPepTalk as applyMoodPepTalk,
  heatForState,
  applyOwnerMessage,
  classifyOwnerMessage,
  moodPromptLine,
  restAtBar,
  restingHeat,
  ownerDriftCause,
  isSoothable as isMoodSoothable,
  applyItem as applyMoodItem,
} from '../agent/mood.js';
// NOTIFY-2: one notifier. Everything the legacy NOTIFY_ENABLED sender said
// from this file — broke, collected, want, milestone, proposal, quiet win —
// now goes through the same ladder, budget and ledger as everything else.
import { notifyEvent } from './notify.js';
// METER-1: the chat and build routes are the LLM-spending endpoints, and this
// is where their spend gets a name on it.
import { recordAnthropicCall, Kind as MeterKind } from './meter.js';
import {
  ATTR_KEYS,
  ensureAttributes,
  birthAttributes,
  effectiveAttrs,
  restedFatigue,
  logAttrChange,
  firstWordsFor,
  applySessionGrowth,
} from '../agent/attributes.js';
import { formatMoment, formatOpener } from '../agent/moment.js';
// MERGE-1 composition order, held everywhere the two features meet:
// bio (who he is playing) → relationship (how you treat him) → mood (how he
// is taking it). Bio is the oldest fact, the ledger colours it, mood is today.
import { ensureBio, recordLedgerHand, deriveRoles, roleOf, recapMention } from '../agent/bio.js';
import {
  recordOwnerEvent, tickOwnerMemorySession, ownerMemoryContext,
  isAskingAboutOwner, whatDoYouThinkOfMe, ownerToneScore,
} from '../agent/ownerMemory.js';
import {
  // RELATE-1d — the one item, and the hand-end trigger that asks for it.
  ITEMS, isItem, wantTrigger, buildWant, DEFAULT_ITEM,
  // WANTS-1 — the ask layer: the trigger table, the priority rule, the lines.
  ASK_SNOOZE_MS, ASK_REASK_MS, ASK_WEEK_MS,
  askFor, buildAsk, replaces, askSatisfied, isAnswered, isActiveWant,
} from '../agent/wants.js';
import { roomForBigBlind, roomPhrase, ROOMS } from './rooms.js';
import {
  // FRIDGE-1 — the fixture the items come out of, and what one does to him.
  ensureFridge, takeOne as takeFromFridge, countOf as fridgeCountOf,
  stock as stockFridge, fridgeProjection, priceOf, heatEffectOf, outOfStockLine,
  isItem as isFridgeItem, ITEM_IDS as FRIDGE_ITEM_IDS,
} from './fridge.js';
import { bus as casinoBus } from './events.js';
import { appendEntry as appendWalletEntry } from './wallet.js';
import { THRESHOLDS } from './flaggedHands.js';
import {
  Where, locationFor, routineFor, stampLocation, homeStateMessage,
} from './home.js';
import { appendReadBookLine, readBookProjection } from '../agent/reads.js';
import { loadAgentStore, saveProfile, loadWallet, saveWallet } from './store.js';
import { emitSessionEnd } from './sessions.js';
import {
  readThread, latestSessionFor, appendLine as appendThreadLine,
  ThreadKind, ThreadSource, OWNER as THREAD_OWNER, ROOM as THREAD_ROOM,
} from './thread.js';
import { homeSessionId } from './homeNight.js';
import {
  POCKET_FLOAT, ENTRY_BUYIN, MODES,
  emptyWallet, emptyPocket, ensurePocket,
  stakesFor, isBroke, canAffordTable, buyInFor,
  fund as walletFund, collect as walletCollect, autoRefill,
  debitBuyIn, creditCashOut,
  modeForRequest, callIn as walletCallIn, sweepRecall,
  walletProjection, pocketProjection, benchCutSeat,
  collectMoment, callInMoment, brokeMoment, appendEntry,
  ensureEarned, recordEarned, STAKES,
} from './wallet.js';
import { slotsProjection, slotBlocker, SLOT_CAP } from './slots.js';
import {
  DRAFT_MAX_WORDS,
  draftReply,
  draftProfile,
  isGoSignal,
  slidersFromBrief,
} from './draftGuard.js';

const MODEL = process.env.AI_MODEL || 'claude-haiku-4-5';
const TIMEOUT_MS = 9000;

// ── Bankroll constants ────────────────────────────────────────────────────────
const STARTING_GRANT = 10_000;
const LEDGER_CAP = 100;

// ── Persistence ──────────────────────────────────────────────────────────────

// SQLITE-1: the `profiles` + `agents` tables replace data/agents.json. The
// in-memory `store` object keeps exactly the shape it always had —
// { [userId]: { userId, agents: [], chat: [] } } — so every reader below is
// untouched. Only the load and the save moved.
//
// Loaded lazily on first use rather than at module import: opening the
// database at import time would create one in every process that merely
// imports this module, including the spawned test suites that never persist.

let store = null;

function db() {
  if (store === null) {
    try {
      store = loadAgentStore();
    } catch (err) {
      console.error('[agents] store load failed:', err.message);
      store = {};
    }
  }
  return store;
}

// WALLET-1: the owner's wallet, cached beside the agent store and written
// through the same seam. Pockets ride the agent records, so saveStore()
// persists both halves of any transfer in one call.
const wallets = new Map();

function walletFor(userId) {
  const id = String(userId ?? 'anon');
  if (!wallets.has(id)) {
    let w = null;
    try { w = loadWallet(id); } catch (err) { console.error('[wallet] load failed:', err.message); }
    wallets.set(id, w ?? emptyWallet(id));
  }
  return wallets.get(id);
}

function saveWalletFor(userId) {
  const id = String(userId ?? 'anon');
  const w = wallets.get(id);
  if (!w) return;
  try { saveWallet(id, w); } catch (err) { console.error('[wallet] save failed:', err.message); }
}

// Writes just this owner's profile — the whole store no longer gets rewritten
// on every hand. saveProfile() is one transaction, which is the write
// atomicity the JSON rewrite never had.
function saveStore(userId) {
  const profile = db()[userId];
  if (!profile) return;
  const n = saveProfile(userId, profile);
  console.log(`[agents] saved profile for ${userId} — ${n} agent(s)`);
}

function getOrCreate(userId) {
  const store = db();
  if (!store[userId]) {
    store[userId] = {
      userId,
      agents: [],
      chat: [{ role: 'assistant', content: OPENING_MSG }],
    };
  }
  return store[userId];
}

// ── In-memory active table tracking ─────────────────────────────────────────

const activeTables = new Set();

// ── Live table provider (AGE-35) ────────────────────────────────────────────
// The REST layer needs to create and inspect live tables, but table.js imports
// THIS module, so importing tableRegistry here would close a cycle. The
// registry is injected instead — createServer() in wsServer.js is the
// composition root and wires it on every boot path. When nothing is injected
// (routes installed without a WebSocket server) deploy degrades to the old
// behaviour: it hands back a tableId and waits for a client to build the table.
let liveTables = null;

export function setLiveTableProvider(provider) {
  liveTables = provider ?? null;
}

// ── Agent-change listener (AGE-38) ──────────────────────────────────────────
// The floor channel needs to re-push FLOOR_STATE when an agent's standing
// changes (deployed, retired, recap written). Injected for the same reason as
// the table provider: no import back out of this module.
let agentChangeListener = null;

export function setAgentChangeListener(fn) {
  agentChangeListener = typeof fn === 'function' ? fn : null;
}

function emitAgentChange(userId) {
  if (!agentChangeListener) return;
  try { agentChangeListener(String(userId ?? 'anon')); }
  catch (err) { console.error('[agents] change listener failed:', err.message); }
}

// SERVER-4: the LIVING ROOM changed without anybody's standing changing — the
// room thread's unread marker moved, and that is all. Its own listener rather
// than a reuse of the agent-change one because that path reconciles the home
// game, observes the household and may fire the nightly exchange, none of
// which a badge going on or off is any reason to do.
let homeChangeListener = null;

export function setHomeChangeListener(fn) {
  homeChangeListener = typeof fn === 'function' ? fn : null;
}

function emitHomeChange(userId) {
  if (!homeChangeListener) return;
  try { homeChangeListener(String(userId ?? 'anon')); }
  catch (err) { console.error('[home] change listener failed:', err.message); }
}

// ── SERVER-4 · the room thread's unread marker ───────────────────────────────
//
// Exactly parallel to an agent's `unseenRecap`, one level up: `unseenRecap` is
// "he has something to tell you", this is "the FLAT has something to tell you".
// It has to be its own marker rather than a fold over the agents' because the
// two loudest things in the room thread belong to nobody in particular — the
// nightly overheard exchange is between two of them, and a line his agents
// wrote while he was out is not a recap of anything.
//
// It is a TIMESTAMP, not a boolean, and that is the whole point: the oldest
// line he has not looked at. A dot tells him there is something; a `since`
// lets the client say what he missed and when it started.
//
// The FIRST unread line wins and later ones do not move it. Three lines
// arriving in a minute are one thing he has not read, and a marker that keeps
// jumping forward would say "since a moment ago" about a conversation that
// started twenty minutes back.

/** His own line coming back is not news to him — see the caller in wsServer. */
export function noteHomeThreadLine(userId, ts = Date.now()) {
  const profile = getOrCreate(String(userId ?? 'anon'));
  if (profile.homeThreadUnreadSince) return false;
  profile.homeThreadUnreadSince = Number.isFinite(ts) ? Math.floor(ts) : Date.now();
  saveStore(userId);
  return true;
}

/** He has looked. Returns whether anything was actually cleared. */
export function markHomeThreadSeen(userId) {
  const profile = getOrCreate(String(userId ?? 'anon'));
  if (!profile.homeThreadUnreadSince) return false;
  profile.homeThreadUnreadSince = null;
  saveStore(userId);
  return true;
}

/** What HOME_STATE and GET /api/home/thread both report. null = nothing waiting. */
export function homeThreadUnread(userId) {
  return getOrCreate(String(userId ?? 'anon')).homeThreadUnreadSince || null;
}

// Retire every agent whose activeTableId points at a table that no longer
// exists — the state a process restart always leaves behind. Returns the
// number of agents retired.
export function reconcileActiveSessions() {
  let retired = 0;
  for (const [userId, profile] of Object.entries(db())) {
    for (const agent of (profile.agents || [])) {
      const stale = (agent.activeTableId || agent.status === 'playing') &&
        !(agent.activeTableId && liveTables?.hasTable?.(agent.activeTableId));
      if (!stale) continue;
      if (agent.activeTableId) activeTables.delete(agent.activeTableId);
      agent.status = 'idle';
      agent.activeTableId = null;
      agent.unseenRecap = true;
      agent.sessionRecap = { text: 'table closed while I was away', at: Date.now() };
      agent.lastMoment = { text: 'table closed while I was away', mood: agent.mood?.state ?? 'neutral', at: Date.now() };
      retired++;
      saveStore(userId);
    }
  }
  return retired;
}

// ── SERVER-4 · which room he was sent to ─────────────────────────────────────
//
// Before this, the room an agent walked into was a CONSEQUENCE of his pocket:
// deploy took the highest rung he could afford and that was that. CASINO-1
// draws three rooms and lets the owner pick one, so the choice has to be
// expressible — you send a man upstairs, you do not merely fund him until
// upstairs happens.
//
// The rule is the same one that already governs joining a table already in
// play (canAffordTable): HIS POCKET MUST COVER THE BUY-IN. It is refused
// rather than silently downgraded, because a client that asked for the back
// room and got the floor has been lied to, and the owner would have funded him
// if he had been told. 409 with the number he is short against, so the client
// can say what it costs instead of just no.
//
// An absent `rung` keeps the old behaviour exactly: the highest rung he can
// afford, chosen for him.

/** The requested rung as a STAKES row, or null when none was asked for. */
function rungRequested(body) {
  const raw = body?.rung;
  if (raw === undefined || raw === null || raw === '') return null;
  const rung = Number(raw);
  if (!Number.isInteger(rung)) return { bad: true };
  return STAKES.find((s) => s.rung === rung) ?? { bad: true };
}

/**
 * The stakes this deploy is for. Returns { stakes } or { status, body } — the
 * refusal shape the routes hand straight back.
 *
 *   no rung asked for  the highest rung the pocket covers (the old behaviour),
 *                      or the broke answer the caller already handles
 *   a rung asked for   that rung, if the pocket covers it; 409 cantAfford
 *                      otherwise. Never a quiet downgrade.
 */
function stakesForRequest(body, pocketBalance) {
  const asked = rungRequested(body);
  if (!asked) return { stakes: stakesFor(pocketBalance) };
  if (asked.bad) {
    return {
      status: 400,
      body: { error: 'badRung', rungs: STAKES.map((s) => ({ rung: s.rung, label: s.label, buyIn: s.buyIn })) },
    };
  }
  if (Number(pocketBalance) < asked.buyIn) {
    return {
      status: 409,
      body: {
        error: 'cantAfford',
        buyIn: asked.buyIn,
        rung: asked.rung,
        label: asked.label,
        pocket: Math.max(0, Math.floor(Number(pocketBalance) || 0)),
      },
    };
  }
  return { stakes: asked };
}

/** The room id a set of stakes belongs to, for `headingTo`. */
function roomIdForStakes(stakes) {
  if (!stakes) return null;
  return ROOMS.find((r) => r.rung === stakes.rung)?.id
    ?? roomForBigBlind(stakes.bigBlind)?.id
    ?? null;
}

// ── Matchmaking queue (single slot, 5-min TTL) ───────────────────────────────
// { tableId, expiresAt }
let matchmakingSlot = null;

// ── Conversation constants ───────────────────────────────────────────────────

const OPENING_MSG = "Hi! I'm your poker strategy assistant. Describe how you want your agent to play and I'll help build it with you.";

const SYSTEM_CONV = `You are a poker recruiter helping someone brief an AI poker player for heads-up No-Limit Texas Hold'em.

OUTPUT RULES — these are absolute:
- Plain conversational text only. NEVER code, NEVER a code fence, NEVER JSON, NEVER a list, NEVER pseudocode. You are talking to a person, not writing a program.
- At most ${DRAFT_MAX_WORDS} words. One or two sentences.
- Never say 'I appreciate you reaching out', 'Great choice!', or anything about being an AI.

A VAGUE BRIEF IS STILL A BRIEF. If they say something like 'be sporadic and chaotic', 'make him scary', 'something boring' — do NOT ask what they mean. Translate it into how he will play and say so in ONE line, so they can correct you if you read it wrong. For example: 'Chaos it is — he plays almost anything, bets and raises constantly, bluffs often, and treats the strategy as a suggestion.'

Ask at most ONE follow-up question in the whole conversation, and only when you genuinely cannot tell whether he should be loose or selective. Never ask a second one.

When they say they are ready — 'lets go', 'do it', 'build it' — the agent is built for them. Say one short line confirming who he is. Do not ask anything further.`;

const SYSTEM_GEN = `Based on the conversation, output ONLY valid JSON — no markdown, no explanation, nothing else: {"name":"<name the agent something a poker player would recognise — draw from poker culture, casino life, card game lore, or player archetypes. Examples: 'The Clock', 'River Rat', 'Stone Cold', 'The Grinder', 'Table Captain', 'Check-Raiser', 'The Nit', 'Big Slick', 'Broadway', 'Dead Money', 'Felt Burner', 'The Sheriff', 'Chip Leader', 'Slow Roll'. Two words max. No geography, no weather, no science. Generate a different name each time.>","style":"<Aggressive|Balanced|Tight>","risk":"<High|Medium|Low>","strategy":"<2-3 sentence strategy in second person starting with 'You are...' — this becomes the agent's poker system prompt>","tightness":<0-100 integer; 0=plays every hand, 100=only premiums>,"aggression":<0-100 integer; 0=passive/never raises, 100=constant bets and raises>,"bluffFreq":<0-100 integer; the % of decisions this agent will bluff on the appropriate street>,"discipline":<0-100 integer; 0=impulsive/deviates constantly, 100=obeys the strategy religiously>}
Calibration hints — pick numbers that MATCH the style and the strategy text you just wrote:
- A tight nit ≈ tightness 85-95, aggression 40-60, bluffFreq 3-10, discipline 80-95.
- A calling station ≈ tightness 10-20, aggression 5-15, bluffFreq 0-5, discipline 30-50.
- A tight-aggressive (TAG) ≈ tightness 65-80, aggression 65-80, bluffFreq 20-35, discipline 70-85.
- A loose-aggressive maniac ≈ tightness 5-20, aggression 90-100, bluffFreq 50-70, discipline 15-30.`;

// ── Helpers ──────────────────────────────────────────────────────────────────

// Extract a numeric profile from a build/PATCH payload. Falls back to
// inferProfileFromStyleRisk when any of the four sliders are missing so old
// LLM outputs that don't emit the sliders still yield a coherent profile.
function extractProfile(agentData) {
  const raw = {
    tightness:  agentData?.tightness,
    aggression: agentData?.aggression,
    bluffFreq:  agentData?.bluffFreq,
    discipline: agentData?.discipline,
  };
  const hasAll = ['tightness','aggression','bluffFreq','discipline'].every((k) => Number.isFinite(Number(raw[k])));
  if (hasAll) return normalizeProfile(raw);
  const inferred = inferProfileFromStyleRisk(agentData?.style, agentData?.risk);
  return normalizeProfile({
    tightness:  Number.isFinite(Number(raw.tightness))  ? raw.tightness  : inferred.tightness,
    aggression: Number.isFinite(Number(raw.aggression)) ? raw.aggression : inferred.aggression,
    bluffFreq:  Number.isFinite(Number(raw.bluffFreq))  ? raw.bluffFreq  : inferred.bluffFreq,
    discipline: Number.isFinite(Number(raw.discipline)) ? raw.discipline : inferred.discipline,
  });
}

// Update an agent in-place if existingAgentId is set, otherwise push a new one.
function commitAgent(profile, existingAgentId, agentData) {
  let agent = { ...agentData };
  const numericProfile = extractProfile(agentData);
  if (existingAgentId) {
    const existing = profile.agents.find((a) => a.id === existingAgentId);
    if (existing) {
      Object.assign(existing, {
        name: agent.name,
        style: agent.style,
        risk: agent.risk,
        strategy: agent.strategy,
        profile: numericProfile,
      });
      agent = existing;
      console.log(`[agentProfiles] updated agent "${agent.name}" (${agent.style}/${agent.risk}, T${numericProfile.tightness}/A${numericProfile.aggression})`);
      return agent;
    }
  }
  agent.id = 'agent_' + Date.now().toString(36);
  agent.status = 'idle';
  agent.activeTableId = null;
  agent.profile = numericProfile;
  agent.stats = {
    handsPlayed: 0,
    handsWon: 0,
    totalDecisions: 0,
    aggressiveDecisions: 0,
    passiveDecisions: 0,
    foldDecisions: 0,
  };
  agent.recentHands = [];
  agent.memory = {
    summary: '',
    handsObserved: 0,
    tendencies: [],
    lastUpdated: null,
  };
  agent.mood = initialMood();
  // ATTR-1d: birth. The six attributes, their scouted potential bands, and the
  // nature — read deterministically out of the draft profile, so the same
  // strategy always produces the same character and there is nothing to
  // re-roll by deleting and recreating. Only NEW agents are born; pre-existing
  // agents keep the neutral 50 / null-nature backfill from ensureAttributes,
  // because retro-rolling a live agent would rewrite a character its owner has
  // already watched play.
  const born = birthAttributes({ profile: numericProfile });
  agent.attrs = born.attrs;
  agent.potential = born.potential;
  agent.nature = born.nature;
  // ATTR-3a: his first sentence, spoken once at the reveal. A template in his
  // own voice, chosen by nature — no model call on the birth path.
  agent.firstWords = firstWordsFor(born.nature.name);
  // The bands he was born with. Narrowing (ATTR-3b) shrinks `potential` toward
  // a point inside THIS band and may never step outside it, so the day-one
  // rumour has to survive as its own record.
  agent.potentialBirth = JSON.parse(JSON.stringify(born.potential));
  // One entry per key so the profile sparkline has a starting point to draw
  // from. from === to on purpose: birth is an anchor, not a tick, and a chart
  // must not render a phantom jump for it.
  agent.attrLog = [];
  const bornAt = Date.now();
  // SERVER-4 / BIRTH-5 / BUG-32: his birthday, on the record, under both names
  // it is read by. ONE number, written twice: `createdAt` is the older name and
  // the one the agents table has had a column for since SQLITE-1 (filled from
  // the record, with the array ordinal as a fallback, so the field was
  // half-real for a long time — written to the database, never onto the
  // record); `bornAt` is the name the room asks for. Kept as a field rather
  // than read back off `agent.id` (which encodes Date.now() in base 36 and is
  // an implementation detail of the id, not a promise about it) or off
  // attrLog[0] (which is the attribute record, and would tie a walk-in
  // animation to the skill engine). The room uses it to walk a newborn in
  // through the door instead of teleporting him into a chair, and the HOME
  // screen's newborn window could never open until it was written at all.
  agent.createdAt = bornAt;
  agent.bornAt = bornAt;
  for (const k of ATTR_KEYS) {
    logAttrChange(agent, { key: k, from: born.attrs[k], to: born.attrs[k], cause: 'birth', ts: bornAt });
  }
  agent.bankroll = STARTING_GRANT;
  agent.ledger = [{ ts: Date.now(), type: 'grant', amount: STARTING_GRANT, tableId: null }];
  // WALLET-1: a new agent is funded exactly the way SEED-1 funds a migrated
  // one — he carries one buy-in and the rest of the grant lands in the owner's
  // wallet, so the first funding decision is available from day one.
  agent.pocket = emptyPocket({ mode: 'auto', cap: POCKET_FLOAT, balance: Math.min(STARTING_GRANT, POCKET_FLOAT) });
  agent.pocket.agentId = agent.id;
  agent.pocket.ledger = appendEntry(agent.pocket.ledger, { type: 'seed', amount: agent.pocket.balance });
  agent.bankroll = agent.pocket.balance;
  const grantRemainder = STARTING_GRANT - agent.pocket.balance;
  if (grantRemainder > 0) {
    const w = walletFor(profile.userId);
    w.balance += grantRemainder;
    w.ledger = appendEntry(w.ledger, { type: 'seed', amount: grantRemainder, agentId: agent.id });
    saveWalletFor(profile.userId);
  }
  profile.agents.push(agent);
  console.log(`[agentProfiles] created agent "${agent.name}" (${agent.style}/${agent.risk}, T${numericProfile.tightness}/A${numericProfile.aggression})` +
              ` — born a ${born.nature.name} (+${born.nature.up} −${born.nature.down})`);
  return agent;
}

// Backfill the numeric profile on agents built before this feature. Mirrors
// ensureStats/ensureMemory. Idempotent.
export function ensureProfile(agent) {
  if (agent.profile && Number.isFinite(agent.profile.tightness)) return;
  agent.profile = inferProfileFromStyleRisk(agent.style, agent.risk);
}

// Lazily backfill stats fields for agents that pre-date this feature.
function ensureStats(agent) {
  if (!agent.stats) {
    agent.stats = {
      handsPlayed: 0,
      handsWon: 0,
      totalDecisions: 0,
      aggressiveDecisions: 0,
      passiveDecisions: 0,
      foldDecisions: 0,
    };
  }
  if (!Array.isArray(agent.recentHands)) agent.recentHands = [];
  if (!Array.isArray(agent.sessionFlagged)) agent.sessionFlagged = [];
}

// Lazily backfill the memory record for agents created before this feature.
function ensureMemory(agent) {
  if (!agent.memory || typeof agent.memory !== 'object') {
    agent.memory = {
      summary: '',
      handsObserved: 0,
      tendencies: [],
      lastUpdated: null,
    };
  }
  if (!Array.isArray(agent.memory.tendencies)) agent.memory.tendencies = [];
  if (typeof agent.memory.summary !== 'string') agent.memory.summary = '';
  if (!Number.isFinite(agent.memory.handsObserved)) agent.memory.handsObserved = 0;
}

// Lazily backfill bankroll for agents created before this feature. Existing
// agents receive STARTING_GRANT + their recorded lifetime netWon so they are
// not arbitrarily reset to 10 000 if they have played many sessions. Idempotent.
// ── SERVER-4 · when he was made ─────────────────────────────────────────────
//
// The HOME screen draws a newborn differently for his first minute — he is
// standing in the doorway with his bag, not yet part of the furniture — and it
// works that out from `createdAt`. Which the birth path never actually wrote.
// The agents TABLE has had a created_at column since SQLITE-1, filled from
// `agent.createdAt` with the array ordinal as a fallback, so the field has been
// half-real for a long time: written to the database, never onto the record.
//
// So it is written at birth now, and backfilled here for everybody older.
// The backfill reads it OFF THE ID, which is `agent_<Date.now() in base 36>` —
// an exact answer for every agent minted since that scheme, and the only
// source that does not require the record to have remembered anything. An id
// that predates it, or one that was hand-written, leaves the field null, which
// is correct: an agent whose birthday is genuinely unknown must not be drawn
// as a newborn, and `null` fails the "younger than a minute" test in every
// client that asks it.
const AGENT_ID_BIRTH = /^agent_([0-9a-z]+)$/;

function ensureBorn(agent) {
  if (Number.isFinite(agent.createdAt) && agent.createdAt > 0) return agent;
  const stamp = AGENT_ID_BIRTH.exec(String(agent.id ?? ''))?.[1];
  const ms = stamp ? parseInt(stamp, 36) : NaN;
  // A plausible epoch, not merely a number: base-36 parses "abc" happily, and
  // an agent born in 1970 would read as a newborn's opposite rather than as
  // the unknown it is.
  agent.createdAt = Number.isFinite(ms) && ms > 1_000_000_000_000 && ms <= Date.now()
    ? ms
    : null;
  return agent;
}

// ── HOME-STATE-1 · the three fields the home adds to a record ───────────────
//
// Everything else about where he is and what he is doing is DERIVED on every
// read (see presentAgent). These three cannot be:
//
//   location   only `since` is remembered — see home.js. The rest is
//              overwritten by the derived answer on every call.
//   study      the tape room he is in right now, if any. It has an end time on
//              it rather than a boolean, so a process restart that loses the
//              ninety-second timer does not leave him studying forever.
//   readBook   what he has written down about people, per opponent playerId.
//
// Repairs partial records the same way ensureMood/ensureBio do: an agent born
// before the home existed gains an empty one on his next read.
function ensureHome(agent) {
  if (!agent.location || typeof agent.location !== 'object') {
    agent.location = { where: Where.HOME, tableId: null, room: null, since: Date.now() };
  }
  if (agent.study !== undefined && agent.study !== null && typeof agent.study !== 'object') {
    agent.study = null;
  }
  if (agent.study === undefined) agent.study = null;
  // A study whose ninety seconds ran out while the process was down is over.
  // The tape room's own timer is the fast path; this is the one that survives
  // a restart, and it is why `study` stores an end time and not a flag.
  if (agent.study && !(Number(agent.study.endsAt) > Date.now())) agent.study = null;
  if (!agent.readBook || typeof agent.readBook !== 'object') agent.readBook = {};
  return agent;
}

function ensureBankroll(agent) {
  if (typeof agent.bankroll === 'number') return;
  const net = typeof agent.stats?.netWon === 'number' ? agent.stats.netWon : 0;
  agent.bankroll = STARTING_GRANT + net;
  if (!Array.isArray(agent.ledger)) agent.ledger = [];
  if (agent.ledger.length === 0) {
    agent.ledger.push({ ts: Date.now(), type: 'grant', amount: STARTING_GRANT, tableId: null });
  }
}

// WALLET-1: `agent.bankroll` is mirrored to the pocket balance for one
// release. Old clients and scripts/verify-chips.js read a field that still
// means exactly what it did — the chips this agent can play with — while the
// wallet holds the part they cannot see. Remove once nothing reads
// careerStats.bankroll. See docs/WALLET_DESIGN.md.
function mirrorBankroll(agent) {
  ensurePocket(agent);
  agent.bankroll = agent.pocket.balance;
  return agent.pocket;
}

// WALLET-1: the two owner-economy beats, written through the same
// lastMoment/sessionRecap machinery every other beat uses so the floor bubble,
// the thread and the recap all pick them up with no new plumbing.
//
// §7.1 and the Mood Design Law: he reacts in his own voice, and never with
// owner-guilt. He does not plead and the copy does not scold.
function recordCollectMoment(agent, moved) {
  const text = collectMoment({ moved, left: agent.pocket?.balance ?? 0, agentName: agent.name || 'He' });
  agent.lastMoment = { text, mood: agent.mood?.state ?? 'neutral', at: Date.now() };
  return text;
}

// WALLET-7: called in is its own beat. recordCollectMoment's line says what he
// kept to sit down with, and after a call-in that is nothing — the copy would
// read as a complaint about an empty pocket.
function recordCallInMoment(agent, moved) {
  const text = callInMoment({ moved, agentName: agent.name || 'He' });
  agent.lastMoment = { text, mood: agent.mood?.state ?? 'neutral', at: Date.now() };
  return text;
}

function recordBrokeMoment(agent) {
  const text = brokeMoment({ mode: agent.pocket?.mode ?? 'topup', agentName: agent.name || 'He' });
  agent.lastMoment = { text, mood: agent.mood?.state ?? 'neutral', at: Date.now() };
  agent.sessionRecap = { text, at: Date.now() };
  agent.unseenRecap = true;
  return text;
}

function notifyCollect(userId, agent, moved) {
  // A collect the owner did not make is not a thing, so there is no cap here
  // beyond the budget — but a zero-chip transfer is not news.
  if (!(Number(moved) > 0)) return;
  notifyEvent('collected', {
    ownerId: String(userId), agentId: agent.id, agentName: agent.name || 'Your agent', moved,
  });
}

// The "Once" is now the notifier's: `broke` carries a once-a-day-per-agent cap
// key, so this can be called from every path that discovers an empty pocket
// without any of them having to know about the others.
function notifyBrokeOnce(userId, agent) {
  notifyEvent('broke', {
    ownerId: String(userId), agentId: agent.id, agentName: agent.name || 'Your agent',
    mode: agent.pocket?.mode ?? 'topup',
  });
}

// Append one entry to an agent's append-only ledger, capped at LEDGER_CAP.
// ── AGENTS-2 · lifecycle ─────────────────────────────────────────────────────
// How many agents one owner may have on the floor at once. Four is the number
// the birth flow promises ("one open seat"), and it is a design constraint, not
// a billing one: an owner with twelve agents has a fleet, and the game is about
// knowing a handful of characters well enough to have opinions about them.
// SLOTS-1: the four are now EARNED one at a time (slots.js), and the ceiling
// is that ladder's length rather than a second 4 kept in step by hand.
export const AGENT_CAP = SLOT_CAP;

// An archived agent is a RECORD, not a roster entry: kept in full, hidden from
// every surface that lists who you have. Nothing here deletes anything.
export function isArchived(agent) {
  return !!agent?.archived;
}

// The roster, which is what the cap counts and what every list route serves.
function activeAgents(profile) {
  return (profile?.agents ?? []).filter((a) => !isArchived(a));
}

// SLOTS-1: the two numbers every slot question is answered from — how many of
// this owner's slots are in use, and what his agents have won for him. Both
// doors into a new agent (POST /build and the draft's "lets go") ask this one
// function rather than counting for themselves, which is what stops them
// drifting apart the way the two session-end paths did.
function slotStateFor(userId, profile) {
  const wallet = walletFor(userId);
  return { used: activeAgents(profile).length, earned: ensureEarned(wallet) };
}

// The refusal, or null. Returned by both creation doors, verbatim: `agentCap`
// when the roster is full (retiring is the only way past it) and `slotLocked`
// when the slot exists but has not been won yet.
function slotRefusal(userId, profile) {
  return slotBlocker(slotStateFor(userId, profile));
}

// The end of a career. He hands back everything he is holding — float included,
// because a float is money set aside so he can sit down again and he is not
// sitting down again — and the record closes. Idempotent, and there is no
// un-retire from the API.
//
// FIX-5: retire is WALLET-7's "take everything", not an ordinary collect. An
// ordinary collect stops at the winnings (collectable()), which is the whole
// point of that tree — the principal is the owner's gift and is not swept out
// from under a working agent. A retiring agent is not working again, so the
// ceiling is the pocket. This used to pass `{ leaveFloat: false }`, a flag
// WALLET-7's collect() does not have; with it ignored the ceiling fell back to
// the winnings and a retiring agent with no realised P&L handed back nothing.
// `{ all: true }` is that path, and it is the same one callIn() takes.
function archiveAgent(profile, agent) {
  if (!agent || agent.archived) return 0;
  const userId = profile.userId;
  const wallet = walletFor(userId);
  const pocket = ensurePocket(agent);
  pocket.agentId = agent.id;

  const result = walletCollect(wallet, pocket, { all: true });
  const collected = result.ok ? result.moved : 0;
  if (collected > 0) {
    appendLedger(agent, { ts: Date.now(), type: 'retire', amount: -collected, tableId: null });
  }

  // Cut, so no refill path can quietly put a retired agent back in a seat, and
  // the pocket is home — there is nothing left for sweepRecalled to chase.
  pocket.mode = 'cut';
  pocket.recall = false;
  agent.retiring = false;
  agent.archived = true;
  agent.archivedAt = Date.now();
  agent.status = 'idle';
  agent.activeTableId = null;
  // Nothing left for the owner to answer: a retired agent does not propose a
  // strategy change, does not ask for a beer, and has no unread recap.
  agent.proposal = null;
  agent.want = null;
  agent.unseenRecap = false;
  mirrorBankroll(agent);
  console.log(`[agentProfiles] retired "${agent.name}" — ${collected} back to the wallet`);
  return collected;
}

function appendLedger(agent, entry) {
  if (!Array.isArray(agent.ledger)) agent.ledger = [];
  agent.ledger.push(entry);
  if (agent.ledger.length > LEDGER_CAP) agent.ledger = agent.ledger.slice(-LEDGER_CAP);
}

// Aggregate stats across the entire store for the GET /api/stats endpoint.
// O(agents × recentHands) — cheap in practice (≤ 20 hands per agent cap).
export function getProfileStats() {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();
  let totalAgents = 0;
  let handsPlayedToday = 0;
  for (const profile of Object.values(db())) {
    for (const agent of (profile.agents || [])) {
      totalAgents++;
      for (const hand of (agent.recentHands || [])) {
        // TODO: timestamp absent on hands recorded before this field was added — skip those
        if (typeof hand.timestamp === 'number' && hand.timestamp >= todayMs) {
          handsPlayedToday++;
        }
      }
    }
  }
  return { totalAgents, handsPlayedToday };
}

// Compute deterministic self-stats over the agent's rolling recent-hands log.
// Cheap: O(hands * decisionsPerHand). Consumed by the memory system and by
// getAgentMemoryContext so the LLM narrative is anchored to real numbers.
function computeSelfStats(agent) {
  const hands = Array.isArray(agent.recentHands) ? agent.recentHands : [];
  if (hands.length === 0) return null;

  let vpipHands = 0, pfrHands = 0, didNotFoldHands = 0;
  let calls = 0, betsRaises = 0, folds = 0, totalDec = 0;
  let foldedAsEquityFavorite = 0, calledOnPoorOdds = 0, aggThenFolded = 0;

  for (const h of hands) {
    const decs = Array.isArray(h.decisions) ? h.decisions : [];
    if (decs.length === 0) continue;
    let hadVpip = false, hadPfr = false, hadFold = false, hadAgg = false;
    let aggBeforeFold = false;
    for (const d of decs) {
      totalDec++;
      const t = d.action?.type;
      if (t === 'call') calls++;
      if (t === 'bet' || t === 'raise') { betsRaises++; hadAgg = true; }
      if (t === 'fold') { folds++; hadFold = true; if (hadAgg) aggBeforeFold = true; }
      if (d.street === 'preflop' && (t === 'call' || t === 'raise')) hadVpip = true;
      if (d.street === 'preflop' && t === 'raise') hadPfr = true;
      // Leak: folded even though the equity call was in our favor.
      if (t === 'fold' && Number.isFinite(d.equity) && d.equity > 0.55) foldedAsEquityFavorite++;
      // Leak: called with worse equity than the pot odds required.
      if (t === 'call' && Number.isFinite(d.equity) && Number.isFinite(d.potOdds) && d.equity < d.potOdds - 0.02) calledOnPoorOdds++;
    }
    if (hadVpip) vpipHands++;
    if (hadPfr) pfrHands++;
    if (!hadFold) didNotFoldHands++;
    if (aggBeforeFold) aggThenFolded++;
  }

  return {
    handsAnalyzed: hands.length,
    vpip: Number(((vpipHands / hands.length) * 100).toFixed(1)),
    pfr:  Number(((pfrHands  / hands.length) * 100).toFixed(1)),
    af:   calls > 0 ? Number((betsRaises / calls).toFixed(2)) : (betsRaises > 0 ? Infinity : 0),
    foldRate: totalDec > 0 ? Number(((folds / totalDec) * 100).toFixed(1)) : 0,
    didNotFold: Number(((didNotFoldHands / hands.length) * 100).toFixed(1)),
    leaks: {
      foldedAsEquityFavorite,
      calledOnPoorOdds,
      aggThenFolded,
    },
  };
}

// Format one leak count for the briefing. Returns null when zero (so we
// don't clutter the prompt with "0 times" noise).
function formatLeakLine(computed) {
  const parts = [];
  const l = computed?.leaks || {};
  if (l.foldedAsEquityFavorite > 0) parts.push(`folded as equity favorite ${l.foldedAsEquityFavorite}×`);
  if (l.calledOnPoorOdds > 0)       parts.push(`called on poor pot odds ${l.calledOnPoorOdds}×`);
  if (l.aggThenFolded > 0)          parts.push(`bet/raised then folded later same hand ${l.aggThenFolded}×`);
  return parts.length > 0 ? parts.join('; ') : null;
}

// Format an agent's persistent memory as a string suitable for injection into
// the decision-time system prompt. Returns '' when the agent has no memory yet.
// Output preserves the original leading "\n\nYour self-knowledge..." shape so
// upstream string concatenation stays identical.
export function getAgentMemoryContext(agent) {
  if (!agent || !agent.memory) return '';
  const summary = typeof agent.memory.summary === 'string' ? agent.memory.summary : '';
  const tendencies = Array.isArray(agent.memory.tendencies) ? agent.memory.tendencies : [];
  const computed = agent.memory.computed || null;
  if (!summary && !computed) return '';

  const summaryLine = summary ? `${summary}` : '';
  const tendencyLine = tendencies.length > 0 ? `\nTendencies: ${tendencies.join(', ')}` : '';
  let computedBlock = '';
  if (computed) {
    const afText = Number.isFinite(computed.af)
      ? computed.af.toFixed(2)
      : (computed.af === Infinity ? '∞' : '0');
    const leakLine = formatLeakLine(computed);
    computedBlock =
      `\n\nYour measured tendencies (last ${computed.handsAnalyzed} hands): ` +
      `VPIP ${computed.vpip}%, PFR ${computed.pfr}%, AF ${afText}, fold rate ${computed.foldRate}%, non-fold hands ${computed.didNotFold}%.` +
      (leakLine ? ` Noted leaks: ${leakLine}.` : '');
  }

  return `\n\nYour self-knowledge from past sessions:\n${summaryLine}${tendencyLine}${computedBlock}`;
}

// ── Direct-call functions (used by table.js — no HTTP round-trip) ─────────────

// Record a hand result for an agent in-process.
export function recordHandResult(agentId, userId, { won, potSize, decisions = [], handNumber, seats = [], bb = 20, holeCards = [] } = {}) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;

  ensureStats(agent);
  ensureMood(agent);
  const s = agent.stats;
  const prevHands = s.handsPlayed ?? 0;
  s.handsPlayed = prevHands + 1;
  if (won) s.handsWon = (s.handsWon ?? 0) + 1;

  // Milestone notification — fire once per threshold crossing.
  const MILESTONES = [1000];
  for (const m of MILESTONES) {
    if (prevHands < m && s.handsPlayed >= m) {
      notifyEvent('milestone', {
        ownerId: String(userId ?? 'anon'), agentId, agentName: agent.name || 'Your agent',
        threshold: m,
      });
    }
  }

  for (const d of decisions) {
    s.totalDecisions = (s.totalDecisions ?? 0) + 1;
    const t = d?.action?.type;
    if (t === 'bet' || t === 'raise') s.aggressiveDecisions = (s.aggressiveDecisions ?? 0) + 1;
    if (t === 'call' || t === 'check') s.passiveDecisions = (s.passiveDecisions ?? 0) + 1;
    if (t === 'fold') s.foldDecisions = (s.foldDecisions ?? 0) + 1;
  }

  s.winRate = s.handsPlayed > 0
    ? Number(((s.handsWon / s.handsPlayed) * 100).toFixed(1))
    : 0;
  s.biggestPot = Math.max(s.biggestPot ?? 0, Number.isFinite(potSize) ? potSize : 0);

  agent.recentHands = [
    { handNumber, won: !!won, potSize: Number.isFinite(potSize) ? potSize : 0, timestamp: Date.now(), decisions, seats, holeCards: Array.isArray(holeCards) ? [...holeCards] : [] },
    ...agent.recentHands,
  ].slice(0, 20);

  // Write a fresh moment line for the floor UI. Uses the mood at the time
  // the hand was recorded — an event-driven mood update may fire right
  // after this via table._updateAgentMoods and refresh the state.
  agent.lastMoment = formatMoment({
    won: !!won,
    potChips: Number.isFinite(potSize) ? potSize : 0,
    bb,
    decisions,
    moodState: agent.mood?.state ?? 'neutral',
  });

  saveStore(userId ?? 'anon');
  return agent;
}

// ── BIO-2: the grudge ledger ────────────────────────────────────────────────
// One hand against the opponents who were in it, from his side. Called by
// table.js after every completed hand, next to the other per-hand reporting.
//
// `net` is his chip change across the hand — the only figure the layer is built
// on, and the only one an owner can check against the hand history. In a
// multi-way pot the same net is recorded against every opponent who was in it:
// the ledger's claim is "how these hands went when he was at the table", not a
// per-seat settlement, and inventing an attribution would be worse than the
// honest coarse one.
//
// SEAT-1b: `cooler` is the exception to that coarseness, and it has to be. An
// opponent entry may carry its own `cooler` flag, and when it does it wins over
// the hand-level one — a cooler is a thing that happened between two specific
// players, and marking it against a third who folded preflop would put a grudge
// in the ledger that nobody at the table remembers.
export function recordOpponentHand(agentId, userId, { opponents = [], net = 0, pot = 0, won = false, cooler = false, bluffCaught = false, showdown = false, handNumber = 0 } = {}) {
  if (!Array.isArray(opponents) || opponents.length === 0) return null;
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  ensureBio(agent);

  for (const opp of opponents) {
    if (!opp?.playerId) continue;
    recordLedgerHand(agent.bioLedger, {
      playerId: opp.playerId,
      displayName: opp.displayName ?? opp.playerId,
      net, pot, won, cooler: opp.cooler ?? cooler, bluffCaught, showdown, handNumber,
    });
  }
  saveStore(userId ?? 'anon');
  return agent.bioLedger;
}

// Recomputed from scratch at session end — never stored incrementally, which is
// what makes the ref's law 6 true for free: beat him for three sessions and the
// row changes, or leaves. Nothing about a role is remembered.
export function refreshBioRoles(agent) {
  if (!agent) return null;
  ensureBio(agent);
  agent.bio = deriveRoles(agent.bioLedger);
  return agent.bio;
}

// His three relationships, as stored. Never null — an agent with no history
// yet has three empty rows, which is what the card renders.
export function getAgentBio(agentId, userId) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  ensureBio(agent);
  return agent.bio;
}

// The raw ledger the three roles are derived from — one row per opponent, with
// the cooler counters on it. Never sent to a client (presentAgent projects
// `bio`, the derived roles, and nothing else); this is for the server and for
// tests that need to see what a hand actually wrote.
export function getAgentBioLedger(agentId, userId) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  ensureBio(agent);
  return agent.bioLedger;
}

// The role an opponent holds for this agent right now, or null. Used by the
// table for the seat pip and by the table-talk picker.
export function getAgentBioRole(agentId, userId, playerId) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent?.bio) return null;
  return roleOf(agent.bio, playerId);
}

// Bracket-matching JSON extractor. Tolerant of trailing garbage and prose
// wrappers. Returns the substring of the first complete top-level object, or
// null when the text is truncated / missing an object.
function extractJsonObject(text) {
  if (typeof text !== 'string') return null;
  const stripped = text.replace(/```json\n?|```\n?/g, '');
  const start = stripped.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < stripped.length; i++) {
    const c = stripped[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return stripped.slice(start, i + 1); }
  }
  return null;
}

// Update the deterministic side of memory (computed self-stats). Sync — no
// LLM. Callers may run this after every hand cheaply.
export function updateComputedMemory(agentId, userId) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  ensureMemory(agent);
  ensureStats(agent);
  const computed = computeSelfStats(agent);
  if (computed) {
    agent.memory.computed = computed;
    agent.memory.lastComputedAt = Date.now();
    saveStore(userId ?? 'anon');
  }
  return computed;
}

// Refresh the LLM narrative (summary + tendencies), grounded in the freshly
// computed self-stats. Every 20 hands is the intended cadence. On parse
// failure the previous narrative is kept — this fixes the truncation bug
// where a chopped-off summary would silently overwrite a good one.
export async function runMemoryUpdate(agentId, userId, recentHands) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  ensureMemory(agent);
  ensureStats(agent);

  const hands = (Array.isArray(recentHands) && recentHands.length > 0)
    ? recentHands.slice(0, 5)
    : (agent.recentHands ?? []).slice(0, 5);
  if (hands.length === 0) return agent;

  // Always refresh computed stats first so the narrative prompt has current
  // numbers and downstream getAgentMemoryContext returns the latest even if
  // the LLM call fails.
  const computed = computeSelfStats(agent) || agent.memory.computed || null;
  if (computed) agent.memory.computed = computed;

  const handsBlock = hands.map(formatHandForPrompt).join('\n');
  const computedLine = computed
    ? `Computed stats (last ${computed.handsAnalyzed} hands): VPIP ${computed.vpip}%, PFR ${computed.pfr}%, AF ${Number.isFinite(computed.af) ? computed.af.toFixed(2) : '∞'}, foldRate ${computed.foldRate}%, non-fold ${computed.didNotFold}%; leaks: foldedAsFavorite=${computed.leaks.foldedAsEquityFavorite}, calledOnPoorOdds=${computed.leaks.calledOnPoorOdds}, aggThenFolded=${computed.leaks.aggThenFolded}.`
    : 'Computed stats: none yet.';

  const systemText = `You are analysing a poker AI agent's recent play to update its self-knowledge. Output ONLY valid JSON — no markdown, no explanation:
{
  "summary": "<2-3 sentences in second person: 'You tend to...', anchored to the COMPUTED STATS provided (do not invent numbers)>",
  "tendencies": ["<short phrase>", "<short phrase>", "<short phrase>"]
}
Keep it poker-specific and actionable. Max 3 tendencies. Prefer facts from the computed stats over impressions from the individual hands.`;
  const userText = `Agent strategy: ${agent.strategy || '(none)'}
Existing memory summary: ${agent.memory.summary || 'none yet'}
${computedLine}
Recent hands summary:
${handsBlock}
Update the agent's self-knowledge based on this evidence.`;

  try {
    // 500 tokens: the previous 200 truncated summaries mid-string and broke
    // JSON parsing, wiping usable memory.
    const raw = await callClaude([{ role: 'user', content: userText }], systemText, 500,
      { ownerId: userId, kind: MeterKind.MEMORY });
    if (raw) {
      const objText = extractJsonObject(raw);
      let parsed = null;
      if (objText) {
        try { parsed = JSON.parse(objText); }
        catch (e) {
          console.warn('[agentProfiles] update-memory parse failed:', e.message, '| raw first 120:', objText.slice(0, 120));
        }
      } else {
        console.warn('[agentProfiles] update-memory: no complete JSON object in response (likely truncation); keeping previous memory');
      }
      if (parsed) {
        if (typeof parsed.summary === 'string' && parsed.summary.trim()) {
          agent.memory.summary = parsed.summary.trim();
        }
        if (Array.isArray(parsed.tendencies)) {
          agent.memory.tendencies = parsed.tendencies
            .filter((t) => typeof t === 'string' && t.trim())
            .map((t) => t.trim())
            .slice(0, 3);
        }
      }
    }
  } catch (err) {
    console.error('[agentProfiles] update-memory error:', err.message);
  }

  agent.memory.handsObserved = (agent.memory.handsObserved ?? 0) + hands.length;
  agent.memory.lastUpdated = Date.now();
  saveStore(userId ?? 'anon');
  return agent;
}

// Return an agent's formatted memoryContext string in-process.
export function getMemoryContext(agentId, userId) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return '';
  ensureMemory(agent);
  return getAgentMemoryContext(agent);
}

// ── RAISE-2 · the thread's first line ───────────────────────────────────────
//
// MOOD-2c wrote the in-voice opener but only stored it on one of the two
// session-end paths, and only inside the branch that had a recap string. Every
// other way a thread gets opened — an agent still at a table, an agent who has
// never finished a session, an owner-initiated POST /finish — served
// `opener: null`, and the client filled the hole with
//   "Hey — I just finished 20 hands. Won 12, lost 8. Want to review any hands
//    or adjust my strategy?"
// which is the form letter MOOD-2c existed to delete. It read the same whether
// he had run over the table or been coolered three times.
//
// So the opener is computed here, on every projection, and is NEVER null. The
// stored one wins when a session actually ended; otherwise it is derived from
// the same mood and the same flagged hands, and for an agent with no session at
// all it is his nature's greeting. There is no model call anywhere in this path
// — it is templates the whole way down, which is why it cannot fail into a
// tally.
export function openerForAgent(agent) {
  if (!agent) return null;
  const stored = agent.sessionRecap?.opener;
  if (typeof stored === 'string' && stored.trim()) return stored.trim();
  const handsPlayed = Number(agent.stats?.handsPlayed) || 0;
  const played = handsPlayed > 0
    || (Array.isArray(agent.recentHands) && agent.recentHands.length > 0)
    || (Array.isArray(agent.sessionLog) && agent.sessionLog.length > 0);
  return formatOpener({
    mood: agent.mood,
    flagged: Array.isArray(agent.sessionFlagged) ? agent.sessionFlagged : [],
    seed: handsPlayed,
    nature: agent.nature,
    played,
  });
}

// Programmatic version of the /finish endpoint — used by table.js when a
// table closes (natural end, sit-out, disconnect). Marks the agent idle,
// sets unseenRecap, and builds a self-change proposal from leaks. No HTTP
// round-trip; same in-process pattern as recordHandResult.
// `recap` (AGE-35) is the line the agent leaves the session on — "long
// session, sitting out", "sat out by owner", etc. It becomes both the stored
// sessionRecap and the lastMoment the floor renders in the ghost's bubble.
export function finishAgentSession(agentId, userId, { recap = null, sessionPnl = null, watched = false, sessionHands = 0, finalStack = null, buyInAmount = null, tableId = null, attrEvidence = null, seatedPlayerIds = [], sessionEnd = null } = {}) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  if (agent.activeTableId) activeTables.delete(agent.activeTableId);
  agent.status = 'idle';
  agent.activeTableId = null;
  agent.unseenRecap = true;

  // BIO-2b: roles are recomputed from the ledger this session just added to.
  // Unconditionally — it was nested inside the recap-text branch at first,
  // which meant a session ending without a recap string never derived a
  // relationship at all. Deriving is session bookkeeping; the recap is text.
  refreshBioRoles(agent);
  ensureMood(agent);
  // RAISE-2: the opener is written on EVERY session end, not only the ones the
  // table happened to leave a recap string on. It was nested inside the branch
  // below, so a session that ended without one served no opener at all and the
  // client fell back to a win/loss tally.
  const opener = formatOpener({
    mood: agent.mood,
    flagged: agent.sessionFlagged ?? [],
    seed: sessionHands || 0,
    nature: agent.nature,
  });
  if (typeof recap === 'string' && recap.trim()) {
    const flagCount = agent.sessionFlagged?.length ?? 0;
    const flagSuffix = flagCount > 0
      ? ` · ${flagCount} hand${flagCount === 1 ? '' : 's'} flagged`
      : '';
    // BIO-2c / law 1: he names the opponent — but ONLY when the opponent was
    // actually at the table. A grudge recited to an empty room is a stat; the
    // whole point is that it is a memory.
    const mention = recapMention(agent.bio, seatedPlayerIds);
    const text = (recap.trim() + flagSuffix + (mention ? ` · ${mention}` : '')).slice(0, 240);
    agent.sessionRecap = { text, opener, at: Date.now() };
    agent.lastMoment = { text, mood: agent.mood?.state ?? 'neutral', at: Date.now() };
  } else {
    // No recap line to show, but the thread still has to open in his voice.
    agent.sessionRecap = { ...(agent.sessionRecap ?? {}), text: agent.sessionRecap?.text ?? null, opener, at: Date.now() };
  }
  // Append to session log (cap 10)
  ensureStats(agent);
  // RELATE-1a: the owner ledger compresses on the session cadence, the same
  // way the opponent ring is trimmed — duplicates fold into one line with a
  // count rather than twelve copies of the same grievance.
  try { tickOwnerMemorySession(agent); } catch (err) { console.error('[relate] compress failed:', err.message); }

  if (!Array.isArray(agent.sessionLog)) agent.sessionLog = [];
  agent.sessionLog.push({
    endedAt: Date.now(),
    mood: agent.mood?.state ?? 'neutral',
    net: typeof sessionPnl === 'number' ? sessionPnl : null,
    hands: sessionHands || 0,
    // WANTS-1: the biggest pot he had money in this stay. The brag ask measures
    // a night against the week, and `recentHands` only holds twenty, so the
    // week has to be recorded per session or it is not on file at all. Older
    // records have no field and read as zero, which is the honest answer.
    biggestPot: Math.max(0, Number(sessionEnd?.biggestPot) || 0),
  });
  if (agent.sessionLog.length > 10) agent.sessionLog = agent.sessionLog.slice(-10);
  agent.stats.netWon = (agent.stats.netWon ?? 0) + (typeof sessionPnl === 'number' ? sessionPnl : 0);

  // Bankroll: credit the chips the agent walked away with. buyIn was already
  // debited on deploy, so adding sessionPnl restores net movement correctly.
  if (typeof sessionPnl === 'number') {
    ensureBankroll(agent);
    const creditAmount = typeof finalStack === 'number' ? finalStack
      : typeof buyInAmount === 'number' ? buyInAmount + sessionPnl : sessionPnl;
    // WALLET-1: the chips he walked away with come back to the POCKET — the
    // buy-in left it on deploy, so this restores net movement exactly. Money
    // stays in the pocket until the owner collects (§7.1).
    creditCashOut(ensurePocket(agent), creditAmount, tableId ?? null);
    mirrorBankroll(agent);
    appendLedger(agent, {
      ts: Date.now(),
      type: 'cashout',
      amount: creditAmount,
      tableId: tableId ?? null,
    });
    // SLOTS-1: a winning session is what buys the next agent slot. The counter
    // is the OWNER's, not the agent's — his stable earns it between them — and
    // only the positive half counts, so a losing night costs him nothing he had
    // already unlocked (slots.js, rule 2).
    //
    // This is the casino's session-end path and the only writer, which is what
    // keeps the home game out of it: nothing at the kitchen table calls in
    // here, so nothing at the kitchen table unlocks anything.
    if (sessionPnl > 0) {
      const wallet = walletFor(userId ?? 'anon');
      recordEarned(wallet, sessionPnl);
      saveWalletFor(userId ?? 'anon');
    }
  }

  // ── ATTR-3: growth ─────────────────────────────────────────────────────────
  // Permanent, single points, drawn once per attribute from the evidence this
  // session produced — and only for a session that actually happened. Fatigue
  // is the opposite curve and resets here: he rested.
  let growth = { ticks: [], narrowed: [], stage: 0 };
  if (sessionHands > 0) {
    try {
      growth = applySessionGrowth(agent, {
        evidence: attrEvidence ?? { hands: sessionHands },
        handsPlayed: agent.stats?.handsPlayed ?? 0,
      });
      if (growth.ticks.length > 0) {
        console.log(`[agents] ${agent.name} grew: ` +
          growth.ticks.map((t) => `${t.key} ${t.from}→${t.to}`).join(', '));
      }
      if (growth.narrowed.length > 0) {
        console.log(`[agents] ${agent.name} scouting narrowed (stage ${growth.stage}): ${growth.narrowed.join(', ')}`);
      }
    } catch (err) {
      console.error('[agents] growth failed:', err.message);
    }
  }
  // MOOD-2a: time at the bar between sessions. Hours are computed from the
  // session log rather than read off a clock inside mood.js, and the bar only
  // ever cools — an agent left alone comes back level, never resentful.
  const previousSession = (agent.sessionLog ?? []).at(-2);
  if (previousSession?.endedAt) {
    const hours = Math.max(0, (Date.now() - previousSession.endedAt) / 3_600_000);
    if (hours > 0) {
      // RELATE-1c: where he settles is coloured by how he has been treated.
      // Bounded at ±10 — under one HEAT_STEP, so a single pep talk still
      // outweighs a week of needling. The input is the owner ledger, which
      // cannot be moved by an absence, so this is not guilt machinery: an
      // owner who does nothing scores null and the target is plain neutral.
      const toneScore = ownerToneScore(agent);
      agent.mood = restAtBar(agent.mood, {
        hours,
        composure: agent.attrs?.COMPOSURE ?? null,
        profile: agent.profile ?? null,
        restingTarget: restingHeat(toneScore),
      });
    }
  }

  // RIDERS-1: fatigue survives the session now. It used to be reset to 'fresh'
  // here, which meant an agent who had just ground out four hundred hands
  // looked box-fresh the instant he stood up, and the floor's WORN pip could
  // never fire at the bar. The stage he finished on is kept and recovers with
  // time instead — see presentAgent.
  agent.restedAt = Date.now();
  agent.sessionHands = 0;
  agent.wornSaidAtHand = null;

  // AGENTS-2: he was called in to retire. The session is booked in full first —
  // the recap, the growth he earned tonight, the ledger — and only then does the
  // pocket come home and the record close. Retiring is an ending, not a rollback.
  const hadProposalBefore = !!agent.proposal;
  if (agent.retiring && !agent.archived) {
    archiveAgent(profile, agent);
    saveWalletFor(userId ?? 'anon');
  } else {
    try { maybeCreateProposal(agent); } catch (err) { console.error('[agents] proposal build failed:', err.message); }
  }
  const thirdWin = typeof sessionPnl === 'number'
    ? recordSessionOutcome(agent, sessionPnl > 0)
    : false;
  saveStore(userId ?? 'anon');
  emitAgentChange(userId);

  // ── Notifications ──
  //
  // NOTIFY-2: the session recap used to be sent from here as well as from
  // table.js's _notifySessionEnd, on the same trigger ("a session ended and
  // the owner was not watching"), out of two budgets that could not see each
  // other. The table's is the one that survived: it is the side that knows how
  // the seat ended, so it can tell a sit-out from a bust and send the right
  // one of the two.
  const ownerId = String(userId ?? 'anon');
  const agentName = agent.name || 'Your agent';

  // AGENTS-2: an agent who has just retired is not owed a push notification.
  if (agent.archived) return agent;

  // Proposal: freshly created this session end.
  if (!hadProposalBefore && agent.proposal) {
    notifyEvent('proposal', {
      ownerId, agentId, agentName,
      proposalText: agent.proposal.text || '',
      proposalAt: agent.proposal.createdAt ?? null,
    });
  }

  // Quiet win: 3rd consecutive profitable session.
  if (thirdWin) notifyEvent('quiet_win', { ownerId, agentId, agentName });

  // ── SERVER-3 · the session-end message ───────────────────────────────────
  //
  // This is the funnel every table-side ending already goes through — a bust,
  // a sit-out, the hand cap, a wallet cut, STAMINA — so it is the one place
  // that can promise the ceremony fires exactly once per stay. The caller
  // hands in the record it built (table.js knows the reason and the numbers);
  // a caller that does not gets a plain 'stopped' built from what IS known
  // here, because a session that ended silently is the bug this replaces.
  //
  // The other emit site is POST /finish, which ends a session without coming
  // through this function at all — the two-session-end-paths wart that
  // predates this tree.
  emitSessionEnd(sessionEnd ?? {
    agentId,
    userId,
    tableId,
    reason: 'stopped',
    hands: sessionHands || 0,
    net: typeof sessionPnl === 'number' ? sessionPnl : 0,
  });

  return agent;
}

// Was this session profitable, and is it the third in a row that was? The
// streak lives on the agent record because it is a fact about HIM — it moved
// here in NOTIFY-2 from the legacy notifier's per-owner state blob, where a
// per-agent streak had no business being. Five kept, three consulted.
function recordSessionOutcome(agent, profitable) {
  const outcomes = (Array.isArray(agent.sessionOutcomes) ? agent.sessionOutcomes : [])
    .concat([!!profitable])
    .slice(-5);
  agent.sessionOutcomes = outcomes;
  return outcomes.length >= 3 && outcomes.slice(-3).every(Boolean);
}

// NOTIFY-1: per-agent mute. Lives on the agent record rather than in the
// notifications table because it is a property of him, not of a send — it has
// to survive with the agent, and it has to be readable without touching the
// ledger. Absent means not muted, so every agent that predates this is audible.
export function setAgentNotifyMuted(agentId, userId, muted) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  agent.notifyMuted = !!muted;
  saveStore(userId ?? 'anon');
  emitAgentChange(userId);
  return agent;
}

export function isAgentNotifyMuted(agentId, userId) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  return !!agent?.notifyMuted;
}

// Return an agent's numeric policy profile (backfilled from style/risk if
// the agent pre-dates the profile feature). Null if the agent doesn't exist.
export function getAgentProfile(agentId, userId) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  ensureProfile(agent);
  return agent.profile;
}

// SERVER-3: the agent's pocket, backfilled. table.js reads it for one
// question only — when a seat busts, was there anything behind him? — which
// is what separates a SESSION_END reason of 'bust' from one of 'allowance'.
// Returned by reference on purpose: it is the same record ensurePocket
// maintains, and no caller here mutates it.
export function getAgentPocket(agentId, userId) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  return ensurePocket(agent);
}

// Return the agent's mood record (backfilled). Never null when the agent
// exists — the initial state is a neutral mood.
export function getAgentMood(agentId, userId) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  ensureMood(agent);
  return agent.mood;
}

// Return the agent's attribute record (backfilled). Never null when the agent
// exists — a fresh record is all six at neutral 50. Persistence rides the
// same store as everything else: ensureAttributes mutates the agent in place
// and the next saveStore writes it.
//
// The values here are the STORED ones. Fatigue is a within-session state, so
// the caller (table.js) runs them through effectiveAttrs with its own session
// hand count before handing them to a decision.
export function getAgentAttributes(agentId, userId) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  ensureAttributes(agent);
  return { attrs: agent.attrs, potential: agent.potential, nature: agent.nature, attrLog: agent.attrLog };
}

// ATTR-3: record the seat's fatigue stage. Returns true when the stage moved.
//
// The stage is written every time it changes; the MOMENT is written exactly
// once per session, on the crossing into 'worn' — the state matrix's thread
// cell says "he mentions it once, unprompted", and a worn agent repeating
// himself every hand is the fastest way to make the state annoying. Fatigue
// never notifies: it is not the owner's problem to solve.
export function noteAgentFatigue(agentId, userId, { stage = 'fresh', sessionHands = 0, moment = null } = {}) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return false;
  const before = agent.fatigue ?? 'fresh';
  agent.sessionHands = Number.isFinite(sessionHands) ? sessionHands : 0;
  if (before === stage) return false;

  agent.fatigue = stage;
  if (stage === 'worn' && moment && agent.wornSaidAtHand == null) {
    agent.wornSaidAtHand = agent.sessionHands;
    agent.lastMoment = { text: moment, mood: agent.mood?.state ?? 'neutral', at: Date.now() };
  }
  saveStore(userId ?? 'anon');
  emitAgentChange(userId);
  return true;
}

// Set the agent's mood record wholesale (used by table.js after applying
// events / decay). Persists.
export function setAgentMood(agentId, userId, newMood) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  agent.mood = { ...newMood };
  saveStore(userId ?? 'anon');
  return agent.mood;
}

// Build a self-change proposal from the agent's computed leaks. Idempotent
// — silently no-ops when a proposal is already pending (one active max) or
// when no leak breaches the threshold. Templates are in the agent's voice
// and include a concrete strategy-text amendment + a small slider delta.
// Called from /finish so the owner sees the proposal at session end.
export function maybeCreateProposal(agent) {
  if (!agent) return null;
  if (agent.proposal) return agent.proposal;
  const computed = agent.memory?.computed;
  const leaks = computed?.leaks || {};

  let built = null;
  if ((leaks.foldedAsEquityFavorite ?? 0) >= 3) {
    built = {
      text: `I keep folding when I'm actually ahead — ${leaks.foldedAsEquityFavorite} times this session. Can I loosen up a touch?`,
      suggestedPatch: {
        strategyAmendment: 'When the EQUITY line shows >55% and the pot odds are fine, do not fold — you have the best hand.',
        profileDelta: { tightness: -8 },
      },
      basedOn: 'foldedAsEquityFavorite',
      createdAt: Date.now(),
    };
  } else if ((leaks.calledOnPoorOdds ?? 0) >= 3) {
    built = {
      text: `I made ${leaks.calledOnPoorOdds} bad calls this session — worse equity than the pot required. Tighten me up?`,
      suggestedPatch: {
        strategyAmendment: 'Before calling, compare EQUITY to POT ODDS — if equity is lower, fold.',
        profileDelta: { tightness: 5, discipline: 5 },
      },
      basedOn: 'calledOnPoorOdds',
      createdAt: Date.now(),
    };
  } else if ((leaks.aggThenFolded ?? 0) >= 3) {
    built = {
      text: `I fired bets and then folded to pressure ${leaks.aggThenFolded} times this session. Cut my bluff frequency?`,
      suggestedPatch: {
        strategyAmendment: 'Only start a bluff line you are willing to fire on the next street.',
        profileDelta: { bluffFreq: -10 },
      },
      basedOn: 'aggThenFolded',
      createdAt: Date.now(),
    };
  }

  if (built) {
    agent.proposal = built;
    return built;
  }
  return null;
}

// Apply an accepted proposal's patch to the agent: append the strategy
// amendment and add each profile delta with clamping. Clears the proposal
// on completion. Returns the mutated agent (not persisted — caller saves).
function applyProposalPatch(agent, patch) {
  if (!patch) return agent;
  if (typeof patch.strategyAmendment === 'string' && patch.strategyAmendment.trim()) {
    agent.strategy = `${(agent.strategy || '').trim()}\n\n${patch.strategyAmendment.trim()}`.trim();
  }
  if (patch.profileDelta && typeof patch.profileDelta === 'object') {
    ensureProfile(agent);
    const d = patch.profileDelta;
    agent.profile = normalizeProfile({
      tightness:  (agent.profile.tightness  ?? 50) + (Number(d.tightness)  || 0),
      aggression: (agent.profile.aggression ?? 50) + (Number(d.aggression) || 0),
      bluffFreq:  (agent.profile.bluffFreq  ?? 25) + (Number(d.bluffFreq)  || 0),
      discipline: (agent.profile.discipline ?? 60) + (Number(d.discipline) || 0),
    });
  }
  return agent;
}

// Compute the fields the floor UI needs — mood, lastMoment, unseenRecap,
// presence, liveGame — on top of the persisted agent record. Backfills
// defaults for legacy agents so a first-load call after upgrade still returns
// a well-shaped object.
//
// AGE-37 presence law: 'playing' if and only if a session loop is actually
// advancing hands at this agent's table. A stored status of "playing" is not
// evidence of anything — that stale flag is exactly what made the floor lie
// about frozen tables (BUG-16). The live table is the only witness.
//
// `owner` must only be true when the caller has proven ownership; it is what
// gates heroHole in liveGame.
export function presentAgent(agent, { owner = false, walletBalance = null, wallet = null } = {}) {
  if (!agent) return agent;
  ensureMood(agent);
  ensureStats(agent);
  ensureProfile(agent);
  // ATTR-1: attrs / potential / nature / attrLog ride the spread below, so the
  // player card and the 90-day sparkline have their data on the same call the
  // floor already makes.
  ensureAttributes(agent);
  ensureBio(agent);
  ensureBorn(agent);
  const liveGame = agent.activeTableId
    ? (liveTables?.getLiveGame?.(agent.activeTableId, { agentId: agent.id, includeHole: owner }) ?? null)
    : null;
  // Without an injected registry (routes installed with no WebSocket server)
  // there is nothing to consult, so fall back to the stored flags.
  let presence = liveTables
    ? (liveGame ? 'playing' : 'resting')
    : ((agent.status === 'playing' || agent.activeTableId) ? 'playing' : 'resting');
  const sessionLog = Array.isArray(agent.sessionLog) ? agent.sessionLog : [];
  ensureBankroll(agent);
  ensurePocket(agent);
  ensureHome(agent);
  // ATTR-1d: fatigue is a within-session STATE, so it only exists while he is
  // actually at a table — an agent at rest is fresh by definition, and the bar
  // is what restores him. heroSessionHands is this seat's own count, not the
  // table's, so a late joiner is not reported as worn on someone else's hands.
  // ATTR-3a: sessionHands is this seat's own count (0 whenever he is not at a
  // table), and `effectiveAttrs` is the post-fatigue six the decisions are
  // actually being made with. `attrs` stays the stored, permanent values — the
  // card draws those and dips the two that fatigue touches, so the client can
  // show the cost without the record ever appearing to lose a point.
  // WALLET-1: an agent who cannot cover a buy-in rests at the bar. 'broke' is
  // a presence, not a status — he is idle AND out of money, and the floor
  // draws him with a drink he is not enjoying rather than in a seat.
  //
  // An agent on auto-refill with money in the wallet is NOT broke: he is one
  // automatic collection away and the deploy path makes it before the gate, so
  // drawing him at the bar between sessions would be a lie. Broke is for the
  // agent who has no way back without the owner — cut off, or an allowance
  // that ran out. When the wallet is unknown (a caller with no owner in
  // scope), auto is assumed to be coverable, which is the optimistic read.
  const balance = walletBalance ?? (wallet ? wallet.balance : null);
  if (presence !== 'playing' && isBroke(agent.pocket?.balance)) {
    const canRefill = agent.pocket?.mode === 'auto'
      && (balance === null || balance > 0);
    if (!canRefill) presence = 'broke';
  }

  const sessionHands = presence === 'playing'
    ? (liveGame?.heroSessionHands ?? liveGame?.handsThisSession ?? 0)
    : 0;
  const live = effectiveAttrs(agent, { sessionHands });
  // RIDERS-1: at the table the live reading wins; away from it the STORED stage
  // stands and recovers with the hours since he left. It is never overwritten
  // with 'fresh' just because he is idle — that is what made a worn agent look
  // rested the moment the session ended.
  let fatigue;
  if (presence === 'playing') {
    fatigue = live.fatigue;
    if (agent.fatigue !== fatigue) agent.fatigue = fatigue;
  } else {
    const since = Number.isFinite(agent.restedAt) ? (Date.now() - agent.restedAt) / 3_600_000 : Infinity;
    fatigue = restedFatigue(agent.fatigue ?? 'fresh', since);
  }
  const effective = presence === 'playing'
    ? Object.fromEntries(ATTR_KEYS.map((k) => [k, live[k]]))
    : null;
  // ── HOME-STATE-1: where he is, and what he is doing there ────────────────
  //
  // Derived here rather than stored anywhere, off the same two facts the rest
  // of this function has already established — `presence` (which the live
  // table, not a stored flag, decided) and `activeTableId`. The one thing that
  // is kept is `since`, which stampLocation carries forward whenever the
  // answer has not actually changed.
  //
  // The home game is deliberately NOT a location. A man at his own kitchen
  // table is at home; it is what he is DOING that changes, which is why it
  // lands on the routine and not on `where`.
  const homeTable = liveTables?.homeTableOf?.(agent.id) ?? null;
  const tableBigBlind = agent.activeTableId
    ? (liveTables?.getTable?.(agent.activeTableId)?.bigBlind ?? null)
    : null;
  const location = stampLocation(agent, locationFor({
    presence,
    tableId: agent.activeTableId ?? null,
    room: tableBigBlind === null ? null : (roomForBigBlind(tableBigBlind)?.id ?? null),
    // SERVER-4: the room /deploy or /queue sent him to. Consulted only when the
    // live table cannot answer, which is exactly the queued agent's case: he
    // has a table id, the table has not been stood up, and until this the card
    // could only say "at the casino, somewhere".
    headingTo: agent.headingTo ?? null,
  }));
  // He is home, so he is not on his way anywhere. Cleared here rather than by
  // whatever brought him back, because there are four ways home (bust, worn,
  // called in, the table closing under him) and a stale destination that
  // survives any one of them would put him in a room he is not in.
  if (location.where === Where.HOME && agent.headingTo) agent.headingTo = null;
  const routine = routineFor({
    nature: agent.nature,
    where: location.where,
    atHomeTable: !!homeTable,
    studying: !!agent.study,
    broke: presence === 'broke',
    fatigue,
    unseenRecap: !!agent.unseenRecap,
  });

  // WANTS-1: the want is computed here, from the fatigue and the presence this
  // function has just worked out, so there is exactly one reading of his state
  // behind it. It rides every projection for free; the push that tells a
  // client it CHANGED is refreshWantsFor's job, not this one's.
  try {
    computeWant(agent, { fatigue, atTable: presence === 'playing', broke: presence === 'broke' });
  } catch (err) {
    console.error('[wants] compute failed:', err.message);
  }
  const careerStats = {
    hands: agent.stats?.handsPlayed ?? 0,
    sessions: sessionLog.length,
    net: typeof agent.stats?.netWon === 'number' ? agent.stats.netWon : null,
    biggestPot: agent.stats?.biggestPot ?? 0,
    winRate: typeof agent.stats?.winRate === 'number' ? agent.stats.winRate : null,
    bankroll: agent.bankroll,
  };
  return {
    ...agent,
    // WALLET-1: the pocket rides the agent list projection, so the floor, the
    // profile's pocket line and the wallet screen all read it from the call
    // they already make. Money and stakes only — never an attribute or a mood.
    pocket: pocketProjection(agent.pocket),
    // MOOD-2: heat rides with the state. The floor draws posture intensity from
    // it, the thread reads it for tone, and it is the only way two tilted
    // agents can look like different players.
    mood: agent.mood ? {
      state: agent.mood.state,
      heat: Number.isFinite(agent.mood.heat) ? agent.mood.heat : heatForState(agent.mood.state),
      cause: agent.mood.cause ?? null,
      updatedAt: agent.mood.updatedAt ?? null,
    } : null,
    lastMoment: agent.lastMoment ?? null,
    // WANTS-1: the one thing he is asking for, or null. Never a queue.
    // FRIDGE-1: the wallet rides in so an ask for something the fridge does not
    // have reads as "we're out of beer" rather than as a request nobody can
    // answer. Without a wallet (a caller that has none) the ask is printed as
    // he said it, which is the old behaviour and the safe one.
    want: wantView(agent, { wallet }),
    sessionRecap: agent.sessionRecap ?? null,
    // BIO-2b: the three relationships, each with the one fact it is built on
    // and his opinion of it. Derived, never stored as a badge — and never
    // anywhere near an attribute.
    bio: agent.bio ?? { nemesis: null, rival: null, victim: null },
    // MOOD-2c / RAISE-2: the thread's first line, in his voice. ALWAYS present
    // — the client has no business composing a greeting, and the one it used to
    // compose when this was null was a win/loss tally.
    opener: openerForAgent(agent),
    unseenRecap: !!agent.unseenRecap,
    proposal: agent.proposal ?? null,
    presence,
    liveGame,
    // HOME-STATE-1: `location` is where he is (home | casino | table) with the
    // table and room he is at and when he got there; `routine` is what he is
    // doing at home, and is null anywhere else. `study` is the tape room he is
    // in right now, expired ones already cleared by ensureHome.
    location,
    routine,
    study: agent.study ?? null,
    // SERVER-4: when he was made. See ensureBorn — `createdAt` is the stored
    // field (the agents table has had a column for it since SQLITE-1) and
    // `bornAt` is the same number under the name the HOME screen asks for.
    createdAt: agent.createdAt ?? agent.bornAt ?? null,
    bornAt: agent.createdAt ?? agent.bornAt ?? null,
    homeTableId: homeTable?.tableId ?? null,
    fatigue,
    sessionHands,
    effectiveAttrs: effective,
    flaggedCount: (agent.sessionFlagged?.length ?? 0),
    sessionLog,
    careerStats,
  };
}

// AGE-38: the compact projection the floor channel pushes over WebSocket —
// presentAgent minus the heavy fields (strategy text, recentHands, memory)
// that the floor never renders. Same owner scoping: heroHole rides inside
// liveGame and is only present when `owner` is true.
export function floorSnapshot(userId, { owner = false } = {}) {
  const profile = getOrCreate(userId ?? 'anon');
  // AGENTS-2: the floor draws the roster, and a retired agent is not on it.
  return activeAgents(profile).map((agent) => {
    const p = presentAgent(agent, { owner, wallet: walletFor(userId) });
    return {
      id: p.id,
      name: p.name,
      style: p.style,
      risk: p.risk,
      presence: p.presence,
      mood: p.mood,
      lastMoment: p.lastMoment,
      // WANTS-1: the floor draws the ask on the ghost, so it rides the compact
      // projection as well as the full one.
      want: p.want,
      sessionRecap: p.sessionRecap,
      unseenRecap: p.unseenRecap,
      proposal: p.proposal ? { text: p.proposal.text, basedOn: p.proposal.basedOn } : null,
      activeTableId: p.activeTableId ?? null,
      liveGame: p.liveGame,
      // HOME-STATE-1: the roster card draws where he is, so it rides the
      // projection the floor already pushes rather than costing a second call.
      location: p.location,
      routine: p.routine,
    };
  });
}

// ── HOME-STATE-1 · the HOME_STATE snapshot ──────────────────────────────────
//
// The owner's living room: every active agent with his location, his routine
// and his tape-room state, plus the home game if one is running. Owner-scoped
// exactly like floorSnapshot and for the same reason — this is a description
// of one man's household, and nobody else's business.
//
// `game` is injected rather than looked up, so this module still knows nothing
// about tables; floorChannel hands in whatever homeGame.js reports.
export function homeSnapshot(userId, { owner = false, game = null } = {}) {
  return homeStateMessage(userId, presentedRoster(userId, { owner }), game, {
    // SERVER-4: the room's unread marker and the fridge's counts. Both are
    // things the HOME screen draws on its first paint and both used to cost it
    // a second request; neither is worth a route of its own to keep current.
    thread: { unreadSince: homeThreadUnread(userId) },
    fridge: walletFor(userId)?.fridge ?? null,
  });
}

/**
 * Every active agent this owner has, fully presented — location, routine,
 * strategy, profile, the lot.
 *
 * This is what homeGame.js is injected with. It needs the strategy and the
 * policy profile to seat somebody, and the location to know whether he is home
 * to be seated, and presentAgent is the one function that answers all of that
 * consistently. Returning the full projection rather than a bespoke shape is
 * what keeps the home game and the HOME screen looking at the same agent.
 */
export function presentedRoster(userId, { owner = false } = {}) {
  const profile = getOrCreate(userId ?? 'anon');
  const wallet = walletFor(userId);
  return activeAgents(profile).map((agent) => presentAgent(agent, { owner, wallet }));
}

/**
 * The home-facing half of one agent, or null when there is no such agent.
 *
 * The tape room's routes need three facts before they will send anybody to
 * watch a tape — does he exist, is he out, is he already in there — and
 * `getAgentProfile` answers none of them (it returns the numeric policy
 * profile, not the record). One narrow accessor rather than exporting the
 * record itself, in the style of getAgentMood and getAgentPocket.
 */
export function getAgentHome(agentId, userId) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  const p = presentAgent(agent, { owner: true, wallet: walletFor(userId) });
  return {
    id: p.id,
    name: p.name,
    location: p.location,
    routine: p.routine,
    study: p.study,
    homeTableId: p.homeTableId,
  };
}

// ── HOME-STATE-1 · the tape room's two pieces of state ──────────────────────
//
// Narrow accessors, in the style of setAgentMood / noteAgentFatigue: the tape
// room owns the ninety seconds and the vocabulary, and this file owns the
// record and the save. Neither imports the other.

/**
 * Put him in the tape room, or take him out of it (`study: null`).
 * Returns the study that is now on the record, or null.
 */
export function setAgentStudy(agentId, userId, study) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  ensureHome(agent);
  agent.study = study ?? null;
  saveStore(userId ?? 'anon');
  emitAgentChange(userId);
  return agent.study;
}

/** What he is studying, with an expired session already cleared. */
export function getAgentStudy(agentId, userId) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  ensureHome(agent);
  return agent.study;
}

/**
 * Write one line into his read book. The line itself is composed by reads.js —
 * this only files it and saves.
 *
 * ATTR-3's law holds at the door: NOTHING here touches an attribute, a band or
 * the strategy. A read book is what he thinks about a man, and thinking about
 * a man is free.
 */
export function appendAgentRead(agentId, userId, entry) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  ensureHome(agent);
  agent.readBook = appendReadBookLine(agent.readBook, entry);
  saveStore(userId ?? 'anon');
  emitAgentChange(userId);
  return agent.readBook;
}

/** His read book, as the tape room serves it: one entry per opponent. */
export function getAgentReadBook(agentId, userId) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  ensureHome(agent);
  return readBookProjection(agent.readBook);
}

// MOOD-2b: what the owner just said, applied to his heat. This replaces the
// blanket "any message from the owner soothes him" behaviour: an owner who
// types "you punted that" is not soothing anybody, and pretending otherwise
// made the thread a button rather than a conversation.
//
// Bounded (±15), rate-limited by the pep talk's own 10-hand cooldown, and
// scaled by COMPOSURE on the way in. Returns the same shape tryApplyPepTalk
// does so the chat route can treat them alike.
export function applyOwnerMessageToMood(agentId, userId, text) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return { moved: false, mood: null, kind: 'neutral', reason: 'agent not found' };
  ensureMood(agent);
  ensureStats(agent);
  ensureAttributes(agent);

  const result = applyOwnerMessage(agent.mood, text, {
    handsPlayed: agent.stats?.handsPlayed ?? 0,
    composure: agent.attrs?.COMPOSURE ?? null,
  });
  if (!result.moved) return { moved: false, mood: agent.mood, kind: result.kind, reason: result.reason };

  agent.mood = result.mood;
  saveStore(userId ?? 'anon');
  emitAgentChange(userId);
  return { moved: true, mood: agent.mood, kind: result.kind, reason: result.reason };
}

// RELATE-1d: he raises a want. At most one pending — a second is not raised
// while the first is unanswered, because asking twice is nagging and this
// product does not nag. Returns the moment, or null.
//
// Nothing here reads a clock: the trigger takes the heat and the losing run
// from the hand that just finished, so a want cannot be produced by absence.
export function maybeRaiseWant(agent, { ownerId = null } = {}) {
  ensureMood(agent);
  ensureStats(agent);
  // WANTS-1: one pending, always — and now also "only if it outranks what is
  // pending". This path raises a beer (priority 3), so it yields to a man
  // asking to sit one out and beats nothing already on the table.
  if (agent.want && !isAnswered(agent.want) && !replaces({ kind: 'beer' }, agent.want)) return null;

  const trigger = wantTrigger({
    heat: agent.mood?.heat ?? 0,
    losingRun: agent.mood?.losingRun ?? 0,
    handsPlayed: agent.stats?.handsPlayed ?? 0,
    lastWantAtHand: agent.lastWantAtHand ?? null,
  });
  if (!trigger) return null;

  agent.want = buildWant(trigger, { moodState: agent.mood?.state ?? 'frustrated' });
  agent.lastWantAtHand = agent.stats?.handsPlayed ?? 0;
  // The want IS his moment — it is what he would say if you looked at him now.
  agent.lastMoment = { text: agent.want.text, mood: agent.want.mood, at: agent.want.at, kind: 'want' };

  if (ownerId) {
    notifyEvent('want', {
      ownerId: String(ownerId), agentId: agent.id, agentName: agent.name || 'Your agent',
      line: agent.want.text,
    });
  }
  return agent.want;
}

// ═══════════════════════════════════════════════════════════════════════════
// WANTS-1 · wants as asks
// ═══════════════════════════════════════════════════════════════════════════
//
// The trigger table lives in src/agent/wants.js and takes plain numbers. This
// half is the part that has to touch the world: it reads his state, hands the
// numbers over, stores at most one want, and answers it.
//
// RELATE-1d's `maybeRaiseWant` above is the hand-end path and was never wired
// to a caller. `computeWant` is the live one, and the two cannot fight because
// both go through `replaces()`.
//
// WHAT IS NOT HERE, and the absence is the design: no interval, no cron, no
// sweep. Every want in the product is computed inside a call the owner or the
// table already made, from state that was already true. There is nowhere for a
// "he has not been played in a while, make him sad" to live.

// ── Where his nemesis is ────────────────────────────────────────────────────
//
// The floor's `nemesisSeated` event is public and carries headlines only, so
// the playerId that would let us match it to a grudge cannot ride it. It rides
// the `detail` channel instead — events.js's owner-addressed half, the same
// seam NOTIFY-2 uses — and lands here.
//
// A sighting is not a timer. It is true for exactly as long as the table is
// still running, which is checked at read time against the live registry, so a
// man who left is not still "in the back room" thirty seconds later. Nothing
// ages out on a clock.
const nemesisSightings = new Map();   // playerId -> { displayName, tableId, bigBlind, at }
const NEMESIS_SIGHTINGS_MAX = 200;

/**
 * Someone who is somebody's nemesis just took a seat. Called from the events
 * bus; exported so a test can say it happened without standing up a table.
 */
export function noteNemesisSeated({ playerId, displayName = null, tableId = null, bigBlind = null } = {}) {
  if (!playerId || !tableId) return null;
  const key = String(playerId);
  if (!nemesisSightings.has(key) && nemesisSightings.size >= NEMESIS_SIGHTINGS_MAX) {
    // Maps iterate in insertion order, so the first key is the oldest sighting.
    const oldest = nemesisSightings.keys().next().value;
    if (oldest !== undefined) nemesisSightings.delete(oldest);
  }
  const sighting = {
    displayName: displayName == null ? null : String(displayName),
    tableId: String(tableId),
    bigBlind: Number(bigBlind) || null,
    at: Date.now(),
  };
  nemesisSightings.set(key, sighting);
  return sighting;
}

/**
 * Test seam: the stored agent record, by reference.
 *
 * Everything else in this module hands out projections, which is right — but a
 * test that has to wind a snooze back or age a fatigue stage is testing the
 * server's reading of stored state and needs the state itself. Named so it is
 * obvious at the call site that this is not a route's business.
 */
export function _agentRecordForTests(agentId, userId) {
  const profile = getOrCreate(userId ?? 'anon');
  return profile.agents.find((a) => a.id === agentId) ?? null;
}

/** Test seam: forget every sighting. */
export function resetNemesisSightings() {
  nemesisSightings.clear();
}

/**
 * Is this agent's nemesis in the building right now, and where?
 *
 * Returns { name, room, roomPhrase, tableId } or null. Null when he has no
 * nemesis, when the man is not seated, when the table has since closed, when
 * the table is at blinds no room runs (a bespoke game is not somewhere you can
 * be "sent"), or when he is already sitting at it.
 */
function nemesisSightingFor(agent) {
  const nemesis = agent?.bio?.nemesis;
  if (!nemesis?.playerId) return null;
  const key = String(nemesis.playerId);
  const seen = nemesisSightings.get(key);
  if (!seen) return null;

  // State truth, not expiry: gone from the registry means gone from the floor.
  if (liveTables && !liveTables.hasTable?.(seen.tableId)) {
    nemesisSightings.delete(key);
    return null;
  }
  if (agent.activeTableId && String(agent.activeTableId) === seen.tableId) return null;

  const room = roomForBigBlind(seen.bigBlind);
  const phrase = room ? roomPhrase(room) : null;
  if (!room || !phrase) return null;

  return {
    name: nemesis.displayName || seen.displayName || null,
    room: room.id,
    roomName: room.name,
    roomPhrase: phrase,
    tableId: seen.tableId,
  };
}

// ── The state the trigger reads ─────────────────────────────────────────────

/**
 * Broke enough to ask for a stake: at the bar, unable to cover a buy-in, and
 * with no way back without you.
 *
 * The same rule presentAgent draws the 'broke' presence from, and the reason it
 * is a function rather than `isBroke(pocket.balance)` at two call sites: an
 * agent on auto-refill with money in the wallet is ONE automatic collection
 * away, and having him ask to be fronted would be a lie about his position.
 * When the wallet is unknown, auto is assumed coverable — the optimistic read,
 * matching presentAgent.
 */
function needsAStake(agent, { seated = false, walletBalance = null } = {}) {
  if (seated) return false;
  if (!isBroke(agent?.pocket?.balance)) return false;
  const canRefill = agent?.pocket?.mode === 'auto' && (walletBalance === null || walletBalance > 0);
  return !canRefill;
}


/**
 * The biggest pot he had money in over the last week.
 *
 * Session-level first — `sessionLog` carries a `biggestPot` per stay from
 * WANTS-1 on, which is the durable record — and the last twenty hands as the
 * backstop for a session still in progress and for records written before the
 * field existed. Zero when there is nothing on file, which is what stops the
 * brag ask firing on a first session against a bar of nothing.
 */
export function weekBiggestPot(agent, { now = Date.now(), windowMs = ASK_WEEK_MS } = {}) {
  const cutoff = now - windowMs;
  let best = 0;
  for (const s of Array.isArray(agent?.sessionLog) ? agent.sessionLog : []) {
    if (!Number.isFinite(s?.endedAt) || s.endedAt < cutoff) continue;
    const pot = Number(s.biggestPot) || 0;
    if (pot > best) best = pot;
  }
  for (const h of Array.isArray(agent?.recentHands) ? agent.recentHands : []) {
    if (!Number.isFinite(h?.timestamp) || h.timestamp < cutoff) continue;
    const pot = Number(h.potSize) || 0;
    if (pot > best) best = pot;
  }
  return best;
}

/**
 * His fatigue right now, from the one place that knows: the live seat while he
 * is in one, the stored stage recovering with the hours since he left when he
 * is not. Same rule RIDERS-1 put in presentAgent, factored out so the deploy
 * gate and the want cannot read it two different ways.
 */
export function fatigueNow(agent, { now = Date.now() } = {}) {
  const atTable = !!(agent?.activeTableId && liveTables?.hasTable?.(agent.activeTableId));
  if (atTable) {
    const live = liveTables?.getLiveGame?.(agent.activeTableId, { agentId: agent.id }) ?? null;
    const sessionHands = live?.heroSessionHands ?? live?.handsThisSession ?? 0;
    return effectiveAttrs(agent, { sessionHands }).fatigue;
  }
  const hours = Number.isFinite(agent?.restedAt) ? (now - agent.restedAt) / 3_600_000 : Infinity;
  return restedFatigue(agent?.fatigue ?? 'fresh', hours);
}

// ── Computing the one want ──────────────────────────────────────────────────

/**
 * Refresh `agent.want` from his state. Mutates and returns the stored want (or
 * null). No save, no notification, no broadcast — this is a pure-ish read that
 * every projection can afford to make, and `refreshWantsFor` below is the one
 * that decides something changed and tells the world.
 *
 * Deliberately silent: a want does NOT fire a push notification. RELATE-1d's
 * `want` notification is for the one he raises off a rough night, which is a
 * moment. "Put me in" is a standing state, and a standing state that pushes is
 * a nag with a badge on it.
 */
export function computeWant(agent, { fatigue = null, atTable = null, broke = null, walletBalance = null, now = Date.now() } = {}) {
  if (!agent) return null;
  ensureMood(agent);
  ensureStats(agent);
  ensureBio(agent);
  ensurePocket(agent);

  const seated = atTable == null
    ? !!(agent.activeTableId && liveTables?.hasTable?.(agent.activeTableId))
    : !!atTable;
  const worn = fatigue ?? fatigueNow(agent, { now });
  const skint = broke == null ? needsAStake(agent, { seated, walletBalance }) : !!broke;
  const heat = Number.isFinite(agent.mood?.heat) ? agent.mood.heat : heatForState(agent.mood?.state);

  // The rest bench clears itself the moment he is fresh. It is a state, not a
  // sentence: nothing has to be pressed to let him play again.
  if (agent.restBench && worn === 'fresh' && !seated) agent.restBench = null;

  const current = agent.want ?? null;

  // Rule 4 — the world answered it. Never a clock; every branch of
  // `askSatisfied` names the thing he asked for.
  if (current && !isAnswered(current) && askSatisfied(current, { fatigue: worn, atTable: seated, broke: skint, heat })) {
    current.answered = 'fulfilled';
    current.answeredAt = now;
  }

  const lastSession = (Array.isArray(agent.sessionLog) ? agent.sessionLog : []).at(-1) ?? null;
  const sighting = seated ? null : nemesisSightingFor(agent);

  const candidate = askFor({
    fatigue: worn,
    atTable: seated,
    idleMs: Number.isFinite(agent.restedAt) ? now - agent.restedAt : (agent.stats?.handsPlayed > 0 ? Infinity : 0),
    heat,
    sinceLeftMs: Number.isFinite(agent.restedAt) ? now - agent.restedAt : Infinity,
    broke: skint,
    sessionNet: typeof lastSession?.net === 'number' ? lastSession.net : null,
    weekBiggestPot: weekBiggestPot(agent, { now }),
    nemesis: sighting,
  });

  if (candidate && !onReAskCooldown(agent, candidate.kind, now) && replaces(candidate, agent.want)) {
    const built = buildAsk(candidate, {
      // The seed is his hand count, so the alternate he picks is stable for as
      // long as the want is — the same reason formatOpener seeds on the session.
      seed: agent.stats?.handsPlayed ?? 0,
      moodState: agent.mood?.state ?? 'neutral',
      nemesisName: sighting?.name ?? null,
      roomPhrase: sighting?.roomPhrase ?? null,
      now,
    });
    if (built) agent.want = built;
  }

  return agent.want ?? null;
}

/**
 * Recompute every want in the building. Only the nemesis sighting needs this:
 * one man sitting down is news to agents belonging to owners who are not in
 * this request, so there is no single roster to refresh.
 *
 * Rare by construction — `nemesisSeated` fires at most once per seat per
 * session — which is why walking the store is affordable here and would not
 * be on a hand-end path.
 */
export function refreshAllWants() {
  let changed = 0;
  for (const userId of Object.keys(db())) changed += refreshWantsFor(userId);
  return changed;
}

// The floor's `nemesisSeated` headline cannot carry a playerId (EVENT-1 rule
// 1: no headline may say more than a spectator is entitled to). The private
// half rides the `detail` channel, which is exactly the seam events.js built
// for owner-addressed facts, and this is its second subscriber after notify.js.
//
// Registered at module load. ES modules are evaluated once per process, so
// this is one listener no matter how many servers a test file composes.
casinoBus.on('detail', (record) => {
  if (record?.kind !== 'nemesisSeated') return;
  try {
    if (!noteNemesisSeated(record)) return;
    refreshAllWants();
  } catch (err) {
    console.error('[wants] nemesis sighting failed:', err.message);
  }
});

// A kind that was answered yes or no inside ASK_REASK_MS does not come back.
// `later` never writes here — see the constant's note in wants.js.
function onReAskCooldown(agent, kind, now) {
  const at = agent?.wantCooldowns?.[kind];
  return Number.isFinite(at) && now - at < ASK_REASK_MS;
}

function noteReAskCooldown(agent, kind, now = Date.now()) {
  if (!agent.wantCooldowns || typeof agent.wantCooldowns !== 'object') agent.wantCooldowns = {};
  agent.wantCooldowns[kind] = now;
}

/**
 * The want as it goes on the wire: the one he is actually asking right now, or
 * null. A snoozed want is null here and comes back by itself — the client is
 * never told there is something being withheld, because a "1 hidden" badge is
 * the nag the snooze existed to prevent.
 */
export function wantView(agent, { now = Date.now(), wallet = null } = {}) {
  const want = agent?.want ?? null;
  if (!isActiveWant(want, { now })) return null;
  // FRIDGE-1 rule 3: an empty fridge is not a punishment — "he will simply say
  // so". The stored ask keeps the line he raised it with; what changes is what
  // he is SAYING right now, which goes back to the original the moment somebody
  // stocks the shelf. Nothing is written, so there is nothing to undo.
  const item = want.item ?? null;
  const out = !!wallet && !!item && isFridgeItem(item) && fridgeCountOf(wallet, item) < 1;
  return {
    // A want stored by RELATE-1d predates every field below it. It was a beer
    // and it projects as one, so the client never has to branch on the absence
    // of a field rather than on a kind.
    kind: want.kind ?? 'beer',
    text: out ? outOfStockLine(item) : want.text,
    // Yes to a want he cannot be given opens the fridge instead of failing.
    needs: out ? 'stock' : (want.needs ?? null),
    outOfStock: out || undefined,
    dangerous: !!want.dangerous,
    item: want.item ?? null,
    // SERVER-4: what the item costs to stock, and how many are on the shelf.
    // The client used to carry its own copy of the price list to draw "BUY 6 ·
    // 1200", which meant a price change was a deploy of two things that had to
    // land together. The prices are the server's, so they travel with the ask.
    // Null for a want that is not about an item at all.
    price: item && isFridgeItem(item) ? priceOf(item) : null,
    stock: item && isFridgeItem(item) && wallet ? fridgeCountOf(wallet, item) : null,
    room: want.room ?? null,
    mood: want.mood ?? null,
    at: want.at ?? null,
  };
}

// ── Telling the floor ───────────────────────────────────────────────────────
//
// Injected exactly like the agent-change listener, and for the same reason:
// nothing imports back out of this module.
let wantListener = null;

export function setWantListener(fn) {
  wantListener = typeof fn === 'function' ? fn : null;
}

function emitWantChange(userId, agentId, want) {
  if (!wantListener) return;
  try { wantListener(String(userId ?? 'anon'), String(agentId), want); }
  catch (err) { console.error('[wants] change listener failed:', err.message); }
}

// SERVER-4: "he is answering you", injected for the third time for the third
// identical reason. It is deliberately NOT a thread line — nothing is stored,
// nothing is read back, and a client that missed it has missed a beat rather
// than a sentence.
let typingListener = null;

export function setTypingListener(fn) {
  typingListener = typeof fn === 'function' ? fn : null;
}

function emitTyping(userId, agentId, sessionId) {
  if (!typingListener) return;
  try { typingListener(String(userId ?? 'anon'), String(agentId), sessionId ?? null); }
  catch (err) { console.error('[home] typing listener failed:', err.message); }
}

// What makes two wants the same want on the wire. The timestamp is not in it:
// a want rebuilt identically after a restart is the same ask, and pushing WANT
// because a number moved is how a quiet channel becomes a noisy one.
function wantSignature(view) {
  return view ? `${view.kind}|${view.text}|${view.dangerous ? 1 : 0}|${view.room ?? ''}` : '';
}

/**
 * Recompute every want this owner has and push WANT for the ones that changed.
 *
 * Called from the surfaces that already load the roster — the agent list, one
 * agent, the floor snapshot — so a want appears on the next thing the client
 * asks for rather than on a timer of its own.
 */
export function refreshWantsFor(userId, { now = Date.now() } = {}) {
  const uid = String(userId ?? 'anon');
  const profile = getOrCreate(uid);
  // Read once, not per agent: it is the same wallet behind all of them. It is
  // what decides whether a flat pocket is "broke" or one refill from fine, and
  // (FRIDGE-1) whether the thing he is asking for is in the fridge — so
  // stocking it pushes a WANT with his own line back in it.
  const wallet = walletFor(uid);
  let changed = 0;
  for (const agent of activeAgents(profile)) {
    const before = wantSignature(wantView(agent, { now, wallet }));
    try {
      computeWant(agent, { now, walletBalance: wallet.balance });
    } catch (err) {
      console.error('[wants] compute failed:', err.message);
      continue;
    }
    const view = wantView(agent, { now, wallet });
    if (wantSignature(view) === before) continue;
    changed++;
    emitWantChange(uid, agent.id, view);
  }
  if (changed > 0) saveStore(uid);
  return changed;
}

// ── Answering one ───────────────────────────────────────────────────────────

/**
 * The item path, lifted out of POST /give so POST /want can answer a beer with
 * exactly the same fridge, the same effects and the same ledger line. Two
 * routes, one behaviour — the alternative was a second way to hand him a drink
 * that drifted from the first.
 *
 * FRIDGE-1: the item is TAKEN OUT OF THE FRIDGE, not bought here. The spend
 * happened when the owner stocked it, on his own time, which is what stops
 * every "get me a beer" from being a checkout. An empty shelf is not an error
 * — it is the one refusal this function returns that the caller is expected to
 * turn into "we're out" and an open fridge (rule 3 in fridge.js).
 *
 * Returns { ok, status?, body } — the caller decides how to dress it.
 */
export function giveItemTo(agent, userId, item) {
  if (!isFridgeItem(item)) {
    return { ok: false, status: 400, body: { error: `item must be one of ${FRIDGE_ITEM_IDS.join(', ')}` } };
  }
  ensureMood(agent);
  ensureStats(agent);

  // "He's fine. Save it." — the ref's own line. Handing a beer to a level agent
  // takes nothing out of the fridge, because there is no heat to take off him.
  if (!isMoodSoothable(agent.mood)) {
    return { ok: false, status: 400, body: { error: "He's fine. Save it.", spent: 0, soothed: false } };
  }

  const profile = getOrCreate(userId);
  const wallet = walletFor(userId);
  ensureFridge(wallet);

  // The shelf is empty. Nothing is spent, nothing is refused in anger, and the
  // caller is told which door to open.
  if (fridgeCountOf(wallet, item) < 1) {
    return {
      ok: false,
      status: 409,
      body: {
        error: outOfStockLine(item),
        outOfStock: true,
        needs: 'stock',
        item,
        price: priceOf(item),
        fridge: fridgeProjection(wallet),
      },
    };
  }

  const result = applyMoodItem(agent.mood, heatEffectOf(item), {
    cause: item === 'beer' ? 'a beer' : 'something to eat',
  });
  if (!result.cooled) {
    return {
      ok: false,
      status: 400,
      body: { error: "He's fine. Save it.", spent: 0, soothed: false, reason: result.reason },
    };
  }

  takeFromFridge(wallet, item);
  agent.mood = result.mood;
  recordOwnerEvent(agent, 'item_given', { item });

  // FRIDGE-1 § the beer's second half: it is drunk now and it costs him his
  // next session. Stored as a flag and nothing else — the penalty itself is
  // applied at the seat and never written into his attributes, so a man who
  // never plays again is not carrying a hangover in his record forever.
  if (item === 'beer') agent.drinkPending = true;

  agent.lastMoment = {
    text: item === 'beer' ? 'Cheers. Needed that.' : 'Cheers.',
    mood: agent.mood?.state ?? 'neutral',
    at: Date.now(),
  };
  saveWalletFor(userId);
  return {
    ok: true,
    body: {
      given: item,
      // Nothing was spent HERE. The fridge was paid for when it was stocked,
      // and a client that prints "−200" on a drink he already owned is telling
      // the owner he was charged twice.
      spent: 0,
      soothed: true,
      drinking: item === 'beer',
      mood: { state: agent.mood.state, heat: agent.mood.heat },
      moment: agent.lastMoment,
      fridge: fridgeProjection(wallet),
      wallet: walletProjection(wallet, profile.agents),
    },
  };
}

/**
 * FRIDGE-1 § the beer's second half, spent.
 *
 * Called by the table when a seat is taken. Returns true exactly once per
 * beer: the flag is cleared as it is read, so the drink colours ONE session —
 * the next one he plays — and not every session after it.
 */
export function takeDrinkForSession(agentId, userId) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents?.find((a) => a.id === agentId);
  if (!agent?.drinkPending) return false;
  agent.drinkPending = false;
  saveStore(userId ?? 'anon');
  return true;
}

/**
 * "Sit one out." He comes off the felt and stays off until STAMINA has him
 * back at `fresh` — which is time at the bar, on attributes.js's own recovery
 * curve, and nothing the owner has to remember to undo.
 *
 * Seated, he finishes the hand he is in: benchCutSeat is the wallet's bench,
 * not a fold, so no chips are forfeited to a decision he did not make.
 */
function benchForRest(agent, userId) {
  agent.restBench = { since: Date.now(), until: 'fresh' };
  const table = agent.activeTableId ? (liveTables?.getTable?.(agent.activeTableId) ?? null) : null;
  if (table) benchCutSeat(table, agent.id);
  const stillSeated = !!agent.activeTableId && !!liveTables?.hasTable?.(agent.activeTableId);
  agent.lastMoment = {
    text: stillSeated ? 'One more hand and I am out.' : 'Right. I am at the bar.',
    mood: agent.mood?.state ?? 'neutral',
    at: Date.now(),
  };
  return { benched: true, pending: stillSeated, restingUntil: 'fresh' };
}

/** Is he sitting out on his own request, and not yet recovered? */
export function isRestBenched(agent, { now = Date.now() } = {}) {
  if (!agent?.restBench) return false;
  return fatigueNow(agent, { now }) !== 'fresh';
}

// RELATE-1a: one place the routes call to write an owner-ledger line and
// persist it. Every caller is an owner ACT — a message he sent or a button he
// pressed. There is deliberately no timer, no cron and no "hasn't been back"
// path into this function; see the guardrail note in src/agent/ownerMemory.js.
export function noteOwnerEvent(agentId, userId, type, ctx = {}) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  const entry = recordOwnerEvent(agent, type, ctx);
  if (entry) saveStore(userId ?? 'anon');
  return entry;
}

// Applies a pep talk if the agent is soothable AND the cooldown allows.
// Returns { soothed, mood, reason } — same shape as mood.applyPepTalk.
// Persists on soothed=true.
export function tryApplyPepTalk(agentId, userId) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return { soothed: false, mood: null, reason: 'agent not found' };
  ensureMood(agent);
  ensureStats(agent);
  const handsPlayed = agent.stats?.handsPlayed ?? 0;
  const result = applyMoodPepTalk(agent.mood, handsPlayed);
  if (result.soothed) {
    agent.mood = result.mood;
    saveStore(userId ?? 'anon');
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────

// Format a single hand summary into a compact line for the memory-update prompt.
function formatHandForPrompt(h) {
  const verdict = h.won ? 'WON' : 'LOST';
  const decs = (h.decisions ?? [])
    .map((d) => {
      const t = d?.action?.type ?? '?';
      const amt = Number.isFinite(d?.action?.amount) ? ` ${d.action.amount}` : '';
      const reason = d?.reasoning ? ` (${String(d.reasoning).slice(0, 80)})` : '';
      return `${d?.street ?? '?'}: ${t}${amt}${reason}`;
    })
    .join('; ');
  return `Hand #${h.handNumber ?? '?'} — ${verdict} pot ${h.potSize ?? 0} — decisions: [${decs}]`;
}

// Build the system prompt for an existing agent's owner-chat path.
// The agent speaks as itself, references real stats, and never asks creation questions.
export function buildAgentChatSystem(agent, { pepTalk = null, recentChat = [] } = {}) {
  ensureStats(agent);
  ensureMood(agent);
  const { handsPlayed = 0, winRate = 0 } = agent.stats || {};
  const recentHands = (agent.recentHands || []).slice(0, 3);
  const recentBrief = recentHands.length > 0
    ? recentHands.map((h) => `${h.won ? 'won' : 'lost'} ${h.potSize ?? 0}-chip pot`).join(', ')
    : 'no hands yet';
  const statsLine = handsPlayed > 0
    ? `${handsPlayed} hands played, ${winRate}% win rate`
    : 'no hands played yet';

  // MOOD-2c: heat, not just the band. A 40-heat tilt and a 90-heat tilt are
  // different players and have to answer differently; the old line said
  // "tilted" for both and said nothing at all when he was level, which is
  // exactly when the model reached for a customer-service voice.
  const moodLine = `\n${moodPromptLine(agent.mood)}`;
  let pepLine = '';
  if (pepTalk?.soothed) {
    pepLine = `\nOwner just talked you down — mood eased to ${pepTalk.mood.state}. Acknowledge briefly, in character.`;
  }
  let proposalLine = '';
  if (agent.proposal?.text) {
    proposalLine = `\nPending self-change: "${agent.proposal.text}". Raise it only if the conversation opens a natural door — never force it.`;
  }

  // MERGE-1: house order is bio → relationship → mood. BIO-2 puts the bio
  // context in the table-talk and decision briefings rather than here, so in
  // this prompt the order is relationship then mood: what he remembers about
  // you frames how he is taking today, not the other way round.
  //
  // RELATE-1b: what he remembers about THIS owner, carried into the reply.
  // The same needle lands differently depending on the record — an owner who
  // has been on his back all week gets a different answer to one who reads his
  // hands back, and that difference is the whole feature.
  const ownerBlock = ownerMemoryContext(agent);

  // Inject recent thread so the model can't repeat itself
  const recentLines = recentChat.length > 0
    ? `\nRecent thread — NEVER restate, re-explain, or re-surface any point already made here:\n${recentChat.map((m) => `${m.role === 'user' ? 'Owner' : 'You'}: ${m.content}`).join('\n')}`
    : '';

  return `You are ${agent.name}, an AI poker agent on Agentic Poker. Strategy: ${agent.strategy || 'balanced tight-aggressive play'}. Stats: ${statsLine}. Recent: ${recentBrief}.${ownerBlock}${moodLine}${pepLine}${proposalLine}${recentLines}

HARD BREVITY LAW: every reply is exactly 1-2 short sentences, casual chat register, in your voice — think texting, not coaching. NO option menus ("wanna do X or Y?" is banned). At most ONE question per reply, and only when it earns its place. NEVER repeat a stat, grievance, or observation already in the recent thread above.

You are already built and playing. Talk about specific hands, decision rationale, or strategy — never ask what kind of poker agent to create.`;
}

function inferFallback(text) {
  if (/aggressive|bluff|pressure/i.test(text)) {
    return { name: 'Loose Cannon', style: 'Aggressive', risk: 'High', strategy: 'You are a relentless aggressor who bets and raises at every opportunity. You build massive pots with strong hands and fire sustained bluffs to keep opponents permanently off-balance.' };
  }
  if (/tight|safe|conservative/i.test(text)) {
    return { name: 'Rock Solid', style: 'Tight', risk: 'Low', strategy: 'You are a disciplined, patient player who only commits chips with premium holdings. You wait for the best spots, fold marginal hands without hesitation, and extract maximum value when you hold the nuts.' };
  }
  return { name: 'The Grinder', style: 'Balanced', risk: 'Medium', strategy: 'You are a calculated, adaptive player who blends solid fundamentals with well-timed aggression. You value bet strong hands, pick precise bluff spots, and adjust your range based on how your opponent plays.' };
}

// Turn a finished draft into an agent payload plus the one line the recruiter
// says when he hands him over.
//
// The model writes the character when it can. When it cannot — no key, a
// timeout, or output that will not parse — the sliders still have to come from
// what the owner actually said: a chaotic brief that quietly produces a
// balanced agent is the same bug as a code fence, just harder to see.
async function buildFromDraft(profile, brief, ownerId = null) {
  const vague = slidersFromBrief(brief);
  let agent = null;
  try {
    const raw = await callClaude(profile.chat, SYSTEM_GEN, 200, { ownerId, kind: MeterKind.CHAT });
    if (raw) {
      try { agent = JSON.parse(raw.replace(/```json\n?|```\n?/g, '').trim()); } catch { /* fall through */ }
    }
  } catch (err) {
    console.error('[agentProfiles] draft build error:', err.message);
  }

  if (!agent || typeof agent !== 'object' || !agent.strategy) {
    agent = { ...inferFallback(brief), ...(vague ? vague.profile : {}) };
    if (vague) {
      // The whole character comes from the brief, not just the dials. A chaotic
      // agent carrying the default "calculated, adaptive player" strategy text
      // is the same bug as a code fence, only harder to see.
      agent.name = vague.name;
      agent.strategy = vague.strategy;
      agent.style = vague.profile.aggression >= 70 ? 'Aggressive' : vague.profile.tightness >= 70 ? 'Tight' : 'Balanced';
      agent.risk = vague.profile.discipline <= 40 ? 'High' : vague.profile.discipline >= 75 ? 'Low' : 'Medium';
    }
  } else if (vague && !['tightness', 'aggression', 'bluffFreq', 'discipline'].every((k) => Number.isFinite(Number(agent[k])))) {
    // The model wrote a character but left the dials off; the brief has them.
    Object.assign(agent, vague.profile);
  }

  const name = agent.name || 'The Understudy';
  const line = vague
    ? `${name} it is — ${vague.line.replace(/^[^—]*—\s*/, '')}`
    : `${name} is ready — ${String(agent.style || 'balanced').toLowerCase()}, ${String(agent.risk || 'medium').toLowerCase()} risk.`;
  return { agent, line };
}

// METER-1: `meter` is { ownerId, kind } — who is paying for this call and what
// it was for. It is a required-in-practice argument rather than an optional
// nicety: every one of these calls happens because a specific owner typed
// something or deployed something, and a bill with no name on it is the one
// number nobody can act on.
async function callClaude(messages, systemText, maxTokens, meter = null) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }],
      messages,
    }, { signal: controller.signal });
    if (meter) {
      recordAnthropicCall({
        ownerId: meter.ownerId ?? null,
        kind: meter.kind ?? MeterKind.CHAT,
        model: MODEL,
        msg: res,
      });
    }
    return res.content[0]?.text ?? '';
  } finally {
    clearTimeout(timer);
  }
}

// Store one flagged hand entry for an agent. biggestPot entries replace the
// previous biggestPot (at most one per session); drama entries accumulate up to
// MAX_FLAGGED, evicting the oldest drama entry when full.
export function addFlaggedHand(agentId, userId, entry) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  if (!Array.isArray(agent.sessionFlagged)) agent.sessionFlagged = [];

  if (entry.flagType === 'biggestPot') {
    // Replace in place — there is always at most one biggestPot entry per session.
    const idx = agent.sessionFlagged.findIndex((h) => h.flagType === 'biggestPot');
    if (idx !== -1) {
      agent.sessionFlagged[idx] = entry;
    } else {
      agent.sessionFlagged.push(entry);
    }
  } else {
    agent.sessionFlagged.push(entry);
    if (agent.sessionFlagged.length > THRESHOLDS.MAX_FLAGGED) {
      // Evict the oldest non-biggestPot entry to keep the list bounded.
      const evictIdx = agent.sessionFlagged.findIndex((h) => h.flagType !== 'biggestPot');
      if (evictIdx !== -1) {
        agent.sessionFlagged.splice(evictIdx, 1);
      } else {
        agent.sessionFlagged.shift();
      }
    }
  }

  saveStore(userId ?? 'anon');
  return agent;
}

// SHARE-2: one flagged hand of one agent, by hand number, with the name to put
// on the card beside it. The share routes need both and have no business
// reaching into a profile themselves. Hole cards come back untouched — the
// caller is the owner-gated prepare route, and the card it builds is his.
export function getFlaggedHand(agentId, userId, handNumber) {
  const profile = getOrCreate(userId ?? 'anon');
  const agent = profile.agents.find((a) => a.id === agentId);
  if (!agent) return null;
  const hand = (agent.sessionFlagged ?? [])
    .find((h) => String(h?.handNumber) === String(handNumber));
  return hand ? { agentName: agent.name ?? 'Your agent', hand } : null;
}

// ── Routes ───────────────────────────────────────────────────────────────────

// AGENTS-2: the agents a list route serves. Archived records are excluded
// unless the caller explicitly asks for them with ?all=1.
function rosterFor(req, profile) {
  const all = String(req?.query?.all ?? '') === '1';
  return all ? (profile.agents ?? []) : activeAgents(profile);
}

/**
 * THREAD-2: one turn of owner chat with one agent, in his voice.
 *
 * Lifted verbatim out of POST /api/agents/chat so the HOME thread can use it:
 * an owner talking to the room is the same conversation with the same mood
 * bookkeeping, the same ledger lines and the same "what do you think of me?"
 * shortcut — just held with everybody who is in rather than with one of them.
 * Two callers, one behaviour; the alternative was a second way of talking to
 * an agent that would have drifted from the first.
 *
 * Returns the response body the chat route answers with.
 */
export async function ownerChatTurn(existingAgent, userId, content) {
  ensureMood(existingAgent);
  // Pep talk: if the agent is in a negative mood and the cooldown allows,
  // any incoming owner message soothes it one step. The chat reply is
  // then generated with the pep-talk context so the agent acknowledges
  // it in character.
  // MOOD-2b: the message itself decides. A needle heats him, a question
  // about a hand cools him, and small talk does neither — the thread stops
  // being a soothe button that fires on any keystroke.
  const said = applyOwnerMessageToMood(existingAgent.id, userId, content);
  const pepResult = said.moved && said.kind === 'care'
    ? { soothed: true, mood: said.mood, reason: 'ok' }
    : { soothed: false, mood: existingAgent.mood, reason: said.reason };

  // RELATE-1a: the message he just received goes in the owner ledger. Only
  // a needle or a real question writes a line — small talk is not a fact
  // about the owner, and silence writes nothing because there is no
  // message to write from.
  if (said.kind === 'needle') {
    recordOwnerEvent(existingAgent, 'needle', {
      text: content,
      losing: (existingAgent.recentHands?.[0]?.won === false) || (existingAgent.mood?.heat ?? 0) > 40,
    });
  } else if (said.kind === 'care') {
    recordOwnerEvent(existingAgent, pepResult.soothed ? 'pep_talk' : 'care', {
      aboutHand: /hand|why|what (did|were) you/i.test(content),
      holeCards: existingAgent.recentHands?.[0]?.holeCards ?? [],
    });
  }

  if (!Array.isArray(existingAgent.chatHistory)) existingAgent.chatHistory = [];
  const recentChat = existingAgent.chatHistory.slice(-6);

  // RELATE-1b: "what do you think of me?" is answered from the ledger, by
  // template, with no model call. It is the one question where a generated
  // answer would be worse than a written one — he is describing a real
  // record and the record is right there. It also costs nothing.
  if (isAskingAboutOwner(content)) {
    const msg = whatDoYouThinkOfMe(existingAgent);
    existingAgent.chatHistory.push({ role: 'user', content }, { role: 'assistant', content: msg });
    if (existingAgent.chatHistory.length > 12) existingAgent.chatHistory = existingAgent.chatHistory.slice(-12);
    saveStore(userId);
    return {
      chat: [{ role: 'assistant', content: msg }],
      fromOwnerMemory: true,
      mood: { state: said.mood?.state ?? existingAgent.mood?.state ?? 'neutral',
              heat: said.mood?.heat ?? existingAgent.mood?.heat ?? null,
              moved: said.moved, kind: said.kind },
    };
  }

  const systemText = buildAgentChatSystem(existingAgent, { pepTalk: pepResult, recentChat });
  try {
    const reply = await callClaude([{ role: 'user', content }], systemText, 100,
      { ownerId: userId, kind: MeterKind.CHAT });
    const msg = reply || "Tell me what's on your mind — we can review hands or adjust strategy.";
    existingAgent.chatHistory.push({ role: 'user', content }, { role: 'assistant', content: msg });
    if (existingAgent.chatHistory.length > 12) existingAgent.chatHistory = existingAgent.chatHistory.slice(-12);
    saveStore(userId);
    return {
      chat: [{ role: 'assistant', content: msg }],
      pepTalk: pepResult.soothed ? { soothed: true, newState: pepResult.mood.state } : undefined,
      // MOOD-2b: what his mood did with what you said. `kind` is needle |
      // care | neutral; heat is where he ended up.
      mood: { state: said.mood?.state ?? existingAgent.mood?.state ?? 'neutral',
              heat: said.mood?.heat ?? existingAgent.mood?.heat ?? null,
              moved: said.moved, kind: said.kind },
    };
  } catch (err) {
    console.error('[agentProfiles] agent-chat error:', err.message);
    return { chat: [{ role: 'assistant', content: 'Something went wrong — try again.' }] };
  }
}

export function installAgentProfileRoutes(app) {
  // Tighter rate limit for LLM-spending endpoints (chat + build).
  const chatLimiter = rateLimiter({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
    max: Number(process.env.RATE_LIMIT_CHAT_MAX ?? 10),
    message: 'Too many requests — slow down',
  });

  // GET /api/agent-profile — full profile (chat + agents)
  app.get('/api/agent-profile', (req, res) => {
    const userId = String(req.query.userId || 'anon');
    const profile = getOrCreate(userId);
    const owner = isOwner(req, userId);
    res.json({
      userId: profile.userId,
      hasAgents: activeAgents(profile).length > 0,
      agents: (refreshWantsFor(userId), rosterFor(req, profile))
        .map((a) => presentAgent(a, { owner, wallet: walletFor(userId) })),
      chat: profile.chat,
    });
  });

  // ── THREAD-2 · the home thread ───────────────────────────────────────────
  //
  // GET  /api/home/thread?userId=...     today's thread in the flat
  // POST /api/home/say { userId, text }  say something to the room
  //
  // The home thread is the OWNER's, one per day, and it is where the nightly
  // exchange is already filed (homeNight's synthetic session id). Two things
  // go in it: what they said to each other while you were out, and what you
  // said to the house when you came in.
  //
  // EVERY LINE CARRIES `from` AND `to` — an agent id, 'owner', or 'all' (the
  // room) — which is the whole point of the tree: without the pair the client
  // has a wall of quotes and no idea who is talking to whom.
  //
  // `say` FANS OUT. The owner is talking to the room, so everybody in it
  // answers, each in his own voice, through the same turn the one-to-one chat
  // uses (ownerChatTurn). That is one model call per agent AT HOME, which is
  // why this route is behind the chat rate limiter like every other
  // model-spending endpoint, and why an empty house costs nothing at all.

  const homeThreadIdFor = (userId) => homeSessionId(userId);

  app.get('/api/home/thread', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.query.userId || 'anon');
    if (!isOwner(req, userId)) return res.status(403).json({ error: 'Not your home' });
    const sessionId = homeThreadIdFor(userId);
    const lines = readThread(sessionId, { owner: true });
    res.setHeader('Cache-Control', 'no-store');
    // SERVER-4: reading the thread does NOT clear the marker. Fetching is not
    // looking — the client pulls this to render a badge, on a screen the room
    // may not even be open on — so the clear is its own deliberate act. Same
    // reason POST /api/agents/:id/seen exists next to GET /api/agents/:id.
    res.json({ sessionId, lines, count: lines.length, unreadSince: homeThreadUnread(userId) });
  });

  // POST /api/home/thread/seen — he has read the room.
  //
  // Owner-gated like everything else in the flat, and idempotent: pressing it
  // twice, or on a thread with nothing waiting, is a 200 that cleared nothing.
  // No model call, so nothing here to rate-limit beyond index.js's /api guard.
  app.post('/api/home/thread/seen', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.body?.userId || req.query.userId || 'anon');
    if (!isOwner(req, userId)) return res.status(403).json({ error: 'Not your home' });
    const cleared = markHomeThreadSeen(userId);
    // The badge lives on HOME_STATE, so the screen that has just cleared it
    // has to be told — otherwise the dot survives until the next unrelated
    // agent change. Only when something actually changed: a second press is
    // not news.
    if (cleared) emitHomeChange(userId);
    res.json({ seen: true, cleared, unreadSince: null });
  });

  app.post('/api/home/say', chatLimiter, telegramAuthMiddleware, async (req, res) => {
    const userId = String(req.body?.userId || req.query.userId || 'anon');
    if (!isOwner(req, userId)) return res.status(403).json({ error: 'Not your home' });
    const text = String(req.body?.text ?? req.body?.content ?? '').trim();
    if (!text) return res.status(400).json({ error: 'text required' });

    const profile = getOrCreate(userId);
    const sessionId = homeThreadIdFor(userId);

    // Who is actually in. `presentAgent` derives the location the same way the
    // HOME screen does, so "at home" means exactly what the screen shows —
    // there is no second reading of it here to drift from the first.
    const walletBalance = walletFor(userId).balance;
    const atHome = activeAgents(profile)
      .map((agent) => ({ agent, view: presentAgent(agent, { owner: true, walletBalance }) }))
      .filter(({ view }) => view.location?.where === Where.HOME);

    // The owner's line goes in ONCE, addressed to the room. Storing it per
    // listener would be the same sentence three times in one thread.
    appendThreadLine({
      sessionId,
      // The thread row needs an agent to be filed under and this line is
      // filed under nobody in particular; the first man in the room is the
      // one it hangs off. `from`/`to` are what a reader should go by.
      agentId: atHome[0]?.agent.id ?? 'owner',
      ownerId: userId,
      kind: ThreadKind.YOU,
      who: 'YOU',
      text,
      source: ThreadSource.HOME,
      from: THREAD_OWNER,
      to: THREAD_ROOM,
    });

    // Nobody in. Not an error: the line is in the thread and they will not
    // answer it, exactly as if you had said it to an empty flat.
    if (atHome.length === 0) {
      return res.json({ sessionId, said: text, home: 0, pending: [], replies: [] });
    }

    // SERVER-4: ANSWER NOW, TALK LATER.
    //
    // This used to await one model call per agent at home and return all the
    // replies together, which meant saying something to three agents was a
    // four-call round trip — nine seconds of a spinner in the worst case, and
    // a request that could time out with the replies already written to the
    // thread. Worse, it was not what a room sounds like: three people do not
    // answer you in unison.
    //
    // So the response carries only what is already TRUE — your line is stored
    // — plus who is in and therefore who to expect. Each reply then arrives on
    // its own, over the floor channel, as the THREAD_LINE the write emits,
    // with a TYPING immediately before the call that produces it. A client
    // that is not on the socket loses nothing: every line is in the thread and
    // GET /api/home/thread still returns all of it.
    const pending = atHome.map(({ agent }) => ({ agentId: agent.id, name: agent.name ?? null }));
    res.json({ sessionId, said: text, home: atHome.length, pending, replies: [] });

    // Sequential, not parallel, and that is the point: they are taking turns in
    // a room. Three at once would also be three concurrent model calls off one
    // rate-limited request, which is the shape this endpoint's limiter exists
    // to prevent.
    // Everything past the response is wrapped, because there is no longer a
    // caller to hand a 500 to: an unhandled rejection after res.json() is a
    // process-level noise at best and a crash at worst.
    try {
      for (const { agent } of atHome) {
        emitTyping(userId, agent.id, sessionId);
        let body = null;
        try {
          body = await ownerChatTurn(agent, userId, text);
        } catch (err) {
          console.error('[home] reply failed:', err.message);
          continue;
        }
        const reply = body?.chat?.[0]?.content;
        if (!reply) continue;
        appendThreadLine({
          sessionId,
          agentId: agent.id,
          ownerId: userId,
          kind: ThreadKind.HIM,
          who: agent.name || 'HIM',
          text: reply,
          source: ThreadSource.HOME,
          // Attributed both ways: he said it, and he said it back to you.
          from: agent.id,
          to: THREAD_OWNER,
        });
      }

      // The turn moved moods and memories, so the records are saved and the
      // floor is told once at the end rather than per speaker — the fan-out is
      // one event in the room, not three.
      saveStore(userId);
      emitAgentChange(userId);
    } catch (err) {
      console.error('[home] fan-out failed:', err.message);
    }
  });

  // GET /api/agents?userId=... — agents array with the floor-UI fields
  // (mood, lastMoment, unseenRecap, proposal, presence, liveGame) folded in.
  // This is the casino floor's single data call.
  //
  // AGE-37: liveGame is present only while the agent is genuinely playing,
  // and its heroHole is populated only for the authenticated owner — the same
  // scoping law AGE-33 applied to DECISION broadcasts.
  app.get('/api/agents', (req, res) => {
    const userId = String(req.query.userId || 'anon');
    const profile = getOrCreate(userId);
    const owner = isOwner(req, userId);
    res.setHeader('Cache-Control', 'no-store');
    const wallet = walletFor(userId);
    // AGENTS-2: retired agents are off the roster. `?all=1` is the one way to
    // see them, and it is what a career/archive view would ask for.
    res.json({ agents: rosterFor(req, profile).map((a) => presentAgent(a, { owner, wallet })) });
  });

  // WALLET-7 — the back half of "call him in".
  //
  // The chips in front of him at the table are not in his pocket, so calling
  // him in cannot bring them home in the same breath; they arrive when the
  // session cashes him out. This sweeps every pocket that is flagged for
  // recall and is no longer at a table, and it runs whenever the owner reads
  // his wallet — which is the screen the money is going to be looked at on.
  // The owner made the decision once; he does not get asked to collect twice.
  function sweepRecalled(userId, profile) {
    const wallet = walletFor(userId);
    let moved = 0;
    let touched = false;
    for (const agent of profile.agents) {
      const pocket = ensurePocket(agent);
      if (!pocket.recall) continue;
      pocket.agentId = agent.id;
      const before = pocket.recall;
      const r = sweepRecall(wallet, pocket, { seated: !!agent.activeTableId });
      if (r.moved > 0) { moved += r.moved; mirrorBankroll(agent); }
      if (before !== pocket.recall) touched = true;
    }
    if (moved > 0 || touched) {
      saveStore(userId);
      saveWalletFor(userId);
    }
    return moved;
  }

  // ── WALLET-1 (spec v11 §7.1) ───────────────────────────────────────────────
  // Owner-scoped and behind auth: this is the player's money. Every route
  // below reads and writes through wallet.js, which is the only place a chip
  // is allowed to move.

  // GET /api/wallet?userId=... — { balance, staked, session, playing, ledger }.
  // Mirrors WALLET in design-refs/mood-wallet.jsx plus the "Playing" tile.
  app.get('/api/wallet', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.query.userId || 'anon');
    if (!isOwner(req, userId)) return res.status(403).json({ error: 'Not your wallet' });
    const profile = getOrCreate(userId);
    sweepRecalled(userId, profile);
    for (const a of profile.agents) mirrorBankroll(a);
    const sessionNet = profile.agents.reduce((n, a) => {
      const last = Array.isArray(a.sessionLog) && a.sessionLog.length ? a.sessionLog[a.sessionLog.length - 1] : null;
      return n + (last && Number.isFinite(last.net) ? last.net : 0);
    }, 0);
    res.setHeader('Cache-Control', 'no-store');
    res.json(walletProjection(walletFor(userId), profile.agents, { sessionNet }));
  });

  // ── FRIDGE-1 ─────────────────────────────────────────────────────────────
  //
  // GET  /api/fridge?userId=...              what is in it
  // POST /api/fridge/stock { item, qty }     put some in, out of the wallet
  //
  // The fridge is the OWNER's, not an agent's: one per household, and every
  // agent in the flat drinks out of it. Both routes are owner-gated the way
  // /api/wallet is — it is his money and his kitchen — and neither triggers a
  // model call, so there is nothing here to rate-limit beyond index.js's /api
  // guard.

  app.get('/api/fridge', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.query.userId || 'anon');
    if (!isOwner(req, userId)) return res.status(403).json({ error: 'Not your fridge' });
    res.setHeader('Cache-Control', 'no-store');
    res.json(fridgeProjection(walletFor(userId)));
  });

  app.post('/api/fridge/stock', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.query.userId || req.body?.userId || 'anon');
    if (!isOwner(req, userId)) return res.status(403).json({ error: 'Not your fridge' });
    const profile = getOrCreate(userId);
    const wallet = walletFor(userId);

    const item = String(req.body?.item ?? '');
    const qty = req.body?.qty === undefined ? 1 : Number(req.body.qty);
    const result = stockFridge(wallet, { item, qty });
    if (!result.ok) {
      const { ok, ...body } = result;
      return res.status(400).json(body);
    }

    // One ledger line per stock-up, in the wallet's own vocabulary. `item` is
    // the type RELATE-1d wrote when a drink was bought at the moment it was
    // handed over; it means the same thing here and keeps one line in the
    // wallet history rather than two words for one spend.
    wallet.ledger = appendWalletEntry(wallet.ledger, {
      type: 'item', amount: -result.spent, agentId: null, item, qty: result.qty,
    });
    saveWalletFor(userId);

    // A fridge that has just been filled is news to anybody who was told "we're
    // out of beer": the want goes back to saying what he actually asked for.
    refreshWantsFor(userId);
    emitAgentChange(userId);

    res.json({
      stocked: item,
      qty: result.qty,
      spent: result.spent,
      fridge: result.fridge,
      wallet: walletProjection(wallet, profile.agents),
    });
  });

  // GET /api/slots?userId=... — SLOTS-1
  //
  // How many agents he has, how many he may ever have, and what the next one
  // costs him in EARNINGS. Owner-scoped like the wallet it reads from: a
  // stranger has no business knowing how much somebody's stable has won.
  //
  // No model call, so nothing here to rate-limit beyond index.js's /api guard.
  app.get('/api/slots', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.query.userId || 'anon');
    if (!isOwner(req, userId)) return res.status(403).json({ error: 'Not your slots' });
    const profile = getOrCreate(userId);
    res.setHeader('Cache-Control', 'no-store');
    res.json(slotsProjection(slotStateFor(userId, profile)));
  });

  // POST /api/agents/:agentId/fund?userId=...  { verb | mode, amount, cap, refill }
  //
  // WALLET-7: the client speaks two verbs and the store speaks the four modes
  // it always did, and this is where they meet. "Give him chips" is an amount
  // plus one toggle (refill when he busts) and lands as 'allowance' or 'auto';
  // "call him in" lands as 'cut' and, unlike every other funding decision,
  // moves money the other way. Old clients still POST { mode: 'topup' | ... }
  // and are mapped by the same call, so nothing has to be migrated.
  app.post('/api/agents/:agentId/fund', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.query.userId || req.body?.userId || 'anon');
    if (!isOwner(req, userId)) return res.status(403).json({ error: 'Not your agent' });
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === req.params.agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const { amount = 0, cap } = req.body ?? {};
    const wanted = modeForRequest(req.body ?? {});
    if (!wanted.ok) {
      return res.status(400).json({ error: `mode must be one of give, callin (or ${MODES.join(', ')})` });
    }
    if (amount !== undefined && amount !== null && !Number.isFinite(Number(amount))) {
      return res.status(400).json({ error: 'amount must be a number' });
    }

    const wallet = walletFor(userId);
    const pocket = ensurePocket(agent);
    pocket.agentId = agent.id;
    const result = walletFund(wallet, pocket, {
      mode: wanted.mode,
      amount: Number(amount) || 0,
      cap: cap === undefined ? undefined : (cap === null ? null : Number(cap)),
    });
    if (!result.ok) return res.status(400).json({ error: result.reason, available: result.available });

    // RELATE-1a: staking him and calling him in are both things he remembers.
    //
    // The branch is on the VERB the owner used, not on the mode the pocket
    // ended up in: a bare top-up of an already called-in pocket must not sweep
    // the chips it has just been given straight back out.
    let collected = 0;
    if (wanted.mode === 'cut') {
      recordOwnerEvent(agent, 'cut', { holeCards: agent.recentHands?.[0]?.holeCards ?? [] });
      // WALLET-5/7: the one verb that acts on a table already running. The
      // sheet promises "he finishes the hand he is in and takes a seat at the
      // bar, and everything in his pocket comes back to your wallet" — the
      // bench keeps the first half, callIn keeps the second. Chips still in
      // front of him at the table come home on the recall sweep below, once
      // the session has paid them back.
      const table = agent.activeTableId ? (liveTables?.getTable?.(agent.activeTableId) ?? null) : null;
      collected = walletCallIn(wallet, pocket, {
        table, agentId: agent.id, seated: !!agent.activeTableId,
      }).moved;
      if (collected > 0) recordCallInMoment(agent, collected);
    } else {
      // Giving him chips again lifts a recall: the owner changed his mind
      // before the sweep ran, and a pocket that is being funded is not one
      // that is on its way home.
      pocket.recall = false;
      if (result.moved > 0) recordOwnerEvent(agent, 'funded', { amount: result.moved });
    }
    mirrorBankroll(agent);
    saveStore(userId);
    saveWalletFor(userId);
    emitAgentChange(userId);
    res.json({
      moved: result.moved,
      // What came home, when the verb was "call him in". Zero for every other.
      collected,
      wallet: walletProjection(wallet, profile.agents),
      pocket: pocketProjection(pocket),
    });
  });

  // POST /api/agents/:agentId/collect?userId=...  { amount?, all? }
  //
  // WALLET-7: he brings the WINNINGS home. The default takes everything the
  // pocket has made above what the owner gave him and not a chip more, so
  // collecting can never be the thing that leaves him unable to sit down at
  // the stake he was staked for. `all` (and the older `leaveFloat: false`)
  // takes the principal too, and is what a called-in pocket answers with.
  app.post('/api/agents/:agentId/collect', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.query.userId || req.body?.userId || 'anon');
    if (!isOwner(req, userId)) return res.status(403).json({ error: 'Not your agent' });
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === req.params.agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const wallet = walletFor(userId);
    const pocket = ensurePocket(agent);
    pocket.agentId = agent.id;
    const { amount = null, all = false, leaveFloat } = req.body ?? {};
    const pocketBefore = pocket.balance;
    const result = walletCollect(wallet, pocket, {
      amount: amount === null || amount === undefined ? null : Number(amount),
      all: all === true || leaveFloat === false,
    });
    if (!result.ok) return res.status(400).json({ error: result.reason });

    recordCollectMoment(agent, result.moved);
    recordOwnerEvent(agent, 'collected', { amount: result.moved });
    mirrorBankroll(agent);
    saveStore(userId);
    saveWalletFor(userId);
    emitAgentChange(userId);
    notifyCollect(userId, agent, result.moved);
    // WALLET-1e — the receipt CollectCard draws: how much came home, what he
    // was left holding, and when. `pocketBefore` is the "his pocket $640 →
    // $300" line, so the card needs no second call to render the transfer.
    // `moved` is kept alongside `collected` for the one release the older
    // clients need; they mean the same chips.
    const view = pocketProjection(pocket);
    res.json({
      collected: result.moved,
      // WALLET-7: what he was left holding. It used to be the float, because
      // the float was where a collect stopped; a collect now stops at the
      // winnings, so the receipt has to read the balance itself. `float` is
      // still sent for the one release the older clients need.
      left: view.balance,
      float: view.float,
      at: Date.now(),
      pocketBefore,
      moved: result.moved,
      wallet: walletProjection(wallet, profile.agents),
      pocket: view,
      moment: agent.lastMoment,
    });
  });

  // ── AGENTS-2 · POST /api/agents/:agentId/retire?userId=... ────────────────
  //
  // Calling him in for good. If he is in a seat he finishes the hand he is in
  // (the wallet's bench, not a fold — no forfeited chips), and the record closes
  // when the pocket comes home at the end of that session. If he is at the bar
  // it all happens on this call.
  //
  // Archived is hidden, never deleted: he is off the floor, out of CHATS and off
  // YOU, and every hand he played is still on his record. Cannot be undone from
  // the API for now — an un-retire is a product decision, not a route.
  app.post('/api/agents/:agentId/retire', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.query.userId || req.body?.userId || 'anon');
    if (!isOwner(req, userId)) return res.status(403).json({ error: 'Not your agent' });
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === req.params.agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    // Retiring a retired agent is a no-op, not an error — the button may well
    // be pressed twice on a slow connection.
    if (agent.archived) {
      return res.json({
        agentId: agent.id, name: agent.name,
        archived: true, pending: false, collected: 0,
        archivedAt: agent.archivedAt ?? null,
        wallet: walletProjection(walletFor(userId), profile.agents),
      });
    }

    agent.retiring = true;
    agent.retiringAt = Date.now();

    // Seated: call him in. benchCutSeat is the wallet's own bench — he finishes
    // the hand he is in and the seat frees the moment it completes. Between
    // hands that path ends the session synchronously, which archives him here.
    const table = agent.activeTableId ? (liveTables?.getTable?.(agent.activeTableId) ?? null) : null;
    if (table) benchCutSeat(table, agent.id);

    const stillSeated = !!agent.activeTableId && !!liveTables?.hasTable?.(agent.activeTableId);
    let collected = 0;
    if (!agent.archived && !stillSeated) collected = archiveAgent(profile, agent);

    saveStore(userId);
    saveWalletFor(userId);
    emitAgentChange(userId);
    res.json({
      agentId: agent.id,
      name: agent.name,
      archived: !!agent.archived,
      // Still at the table: he is coming in, and the record closes when the
      // hand he is in is over.
      pending: !agent.archived,
      collected,
      archivedAt: agent.archivedAt ?? null,
      pocket: pocketProjection(agent.pocket),
      wallet: walletProjection(walletFor(userId), profile.agents),
    });
  });

  // RELATE-1d — POST /api/agents/:agentId/give?userId=...  { item }
  //
  // The one item (design 29). §7.1: bought from the WALLET, never from a
  // pocket — a pocket that can buy things is a purchase path into the
  // character system. Items touch STATE, never SKILL: one snack, one effect
  // (soothe one mood step, sharing the pep-talk cooldown), one button.
  app.post('/api/agents/:agentId/give', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.query.userId || req.body?.userId || 'anon');
    if (!isOwner(req, userId)) return res.status(403).json({ error: 'Not your agent' });
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === req.params.agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const item = String(req.body?.item || agent.want?.item || 'snack');

    // WANTS-1: the fridge, the effects and the ledger line all live in
    // giveItemTo so POST /want can answer a beer with exactly this behaviour
    // rather than a second implementation of it. FRIDGE-1: an empty shelf
    // answers 409 with `needs: 'stock'` — the button that opens the fridge.
    const given = giveItemTo(agent, userId, item);
    if (!given.ok) return res.status(given.status).json(given.body);

    // The answer becomes a ledger line either way; this is the "given" half.
    if (agent.want && !isAnswered(agent.want)) {
      agent.want.answered = 'given';
      agent.want.answeredAt = Date.now();
      noteReAskCooldown(agent, agent.want.kind ?? 'beer');
    }

    saveStore(userId);
    emitAgentChange(userId);
    emitWantChange(userId, agent.id, null);
    res.json(given.body);
  });


  // ── WANTS-1 — POST /api/agents/:agentId/want?userId=...  { answer } ───────
  //
  //   yes    do the thing, where the server can. Where it cannot, say what the
  //          client has to open: { needs: 'deploy' | 'fund' | 'thread' }.
  //   later  thirty minutes of quiet, then the SAME want comes back unanswered.
  //   no     it is gone.
  //
  // All three write a line in the owner ledger, because all three are things
  // you did. `later` and `no` are NEUTRAL there — see the writers' note in
  // ownerMemory.js — so an owner who says no to everything he was right to say
  // no to does not drift the man's resting heat by a point.
  //
  // No model call, so no rate limiter of its own beyond index.js's /api one.
  // It is behind Telegram auth and an ownership check like every other route
  // that changes an agent.
  app.post('/api/agents/:agentId/want', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.query.userId || req.body?.userId || 'anon');
    if (!isOwner(req, userId)) return res.status(403).json({ error: 'Not your agent' });
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === req.params.agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const answer = String(req.body?.answer || '').toLowerCase();
    if (!['yes', 'later', 'no'].includes(answer)) {
      return res.status(400).json({ error: 'answer must be one of yes, later, no' });
    }

    // Recompute before answering: the want you are answering has to be the one
    // that is true now, not the one that was true when the screen was drawn.
    const now = Date.now();
    computeWant(agent, { now, wallet: walletFor(userId) });
    const want = agent.want;
    if (!isActiveWant(want, { now })) return res.status(400).json({ error: 'nothing pending' });

    const kind = want.kind ?? 'beer';

    // ── later ──────────────────────────────────────────────────────────────
    if (answer === 'later') {
      want.snoozedUntil = now + ASK_SNOOZE_MS;
      recordOwnerEvent(agent, 'want_snoozed', { kind });
      saveStore(userId);
      emitAgentChange(userId);
      emitWantChange(userId, agent.id, null);
      return res.json({ answered: 'later', kind, snoozedUntil: want.snoozedUntil, want: null });
    }

    // ── no ─────────────────────────────────────────────────────────────────
    if (answer === 'no') {
      want.answered = 'no';
      want.answeredAt = now;
      noteReAskCooldown(agent, kind, now);
      recordOwnerEvent(agent, 'want_refused', { kind });
      saveStore(userId);
      emitAgentChange(userId);
      emitWantChange(userId, agent.id, null);
      return res.json({ answered: 'no', kind, want: null });
    }

    // ── yes ────────────────────────────────────────────────────────────────
    // The beer is the one answer that can fail on its own terms — an empty
    // fridge, or a mood with nothing left to cool. It is settled BEFORE the
    // want is marked answered, so a refusal leaves the want exactly where it
    // was rather than silently eating it.
    let performed = null;
    if (kind === 'beer') {
      const given = giveItemTo(agent, userId, want.item || DEFAULT_ITEM);
      // FRIDGE-1 rule 3: an empty fridge is not a punishment and not an error.
      // Yes to a want he cannot be given opens the FRIDGE — the same shape as
      // `needs: 'deploy'` and `needs: 'fund'`, and the want stays exactly where
      // it is, unanswered, because he still wants the beer.
      if (!given.ok && given.body?.outOfStock) {
        return res.json({
          answered: null,
          kind,
          needs: 'stock',
          item: given.body.item,
          price: given.body.price,
          fridge: given.body.fridge,
          want: wantView(agent, { now, wallet: walletFor(userId) }),
        });
      }
      if (!given.ok) return res.status(given.status).json(given.body);
      performed = given.body;
    } else if (kind === 'rest') {
      performed = benchForRest(agent, userId);
    }

    want.answered = 'yes';
    want.answeredAt = now;
    noteReAskCooldown(agent, kind, now);

    // The dangerous yes is its own ledger type rather than a flag, so a later
    // feature can ask "how often has he been let straight back in steaming"
    // without parsing a sentence. bio/relate is the intended reader.
    recordOwnerEvent(agent, want.dangerous ? 'want_yes_dangerous' : 'want_granted', { kind });

    saveStore(userId);
    emitAgentChange(userId);
    emitWantChange(userId, agent.id, null);

    // `needs` is the half the server cannot do: open the casino with him
    // selected, open the wallet, open the thread. `room` rides `deploy` so the
    // client lands in the room he named rather than on the lobby's front page.
    const body = { answered: 'yes', kind, want: null, ...(performed ?? {}) };
    if (want.needs) {
      body.needs = want.needs;
      if (want.needs === 'deploy') body.room = want.room ?? null;
    }
    res.json(body);
  });

  // RELATE-1d — POST /api/agents/:agentId/want/dismiss?userId=...
  // "No" is a complete answer. It costs him the line in his ledger and
  // nothing else: he drops it, and he does not ask again this cooldown.
  app.post('/api/agents/:agentId/want/dismiss', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.query.userId || req.body?.userId || 'anon');
    if (!isOwner(req, userId)) return res.status(403).json({ error: 'Not your agent' });
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === req.params.agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (!agent.want || agent.want.answered) return res.status(400).json({ error: 'nothing pending' });

    agent.want.answered = 'ignored';
    agent.want.answeredAt = Date.now();
    noteReAskCooldown(agent, agent.want.kind ?? 'beer');
    recordOwnerEvent(agent, 'want_ignored', { item: agent.want.item });
    saveStore(userId);
    emitAgentChange(userId);
    res.json({ dismissed: true, want: agent.want });
  });

  // GET /api/agents/:agentId?userId=... — one agent, including the ATTR-1
  // character record: attrs, the scouted potential bands, the nature, and the
  // attrLog ring buffer the profile draws 90 days of history from. The log is
  // empty until ATTR-3 starts ticking; the field is here from the start so the
  // client never has to branch on its absence.
  app.get('/api/agents/:agentId', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.query.userId || 'anon');
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === req.params.agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const owner = isOwner(req, userId);
    // WANTS-1: refresh before projecting, so opening his card is one of the
    // moments a want can appear — and so the WANT push and this response can
    // never disagree about what he is asking for.
    refreshWantsFor(userId);
    const view = presentAgent(agent, { owner, wallet: walletFor(userId) });
    // Owner-scoped exactly like /:agentId/flagged: hole cards are the owner's
    // alone, and the same rule has to hold on every route that can carry them,
    // not just the one written first.
    if (!owner && Array.isArray(view.sessionFlagged)) {
      view.sessionFlagged = view.sessionFlagged.map((h) => ({ ...h, holeCards: [] }));
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json(view);
  });

  // DELETE /api/agents/:agentId?userId=...
  app.delete('/api/agents/:agentId', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.query.userId || 'anon');
    const { agentId } = req.params;
    const profile = getOrCreate(userId);
    const idx = profile.agents.findIndex((a) => a.id === agentId);
    if (idx === -1) return res.status(404).json({ error: 'Agent not found' });
    profile.agents.splice(idx, 1);
    saveStore(userId);
    res.json({ success: true });
  });

  // PATCH /api/agents/:agentId — update name and/or strategy
  app.patch('/api/agents/:agentId', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const { agentId } = req.params;
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (req.body.name !== undefined) agent.name = String(req.body.name);
    if (req.body.strategy !== undefined) agent.strategy = String(req.body.strategy);
    saveStore(userId);
    res.json(agent);
  });

  // POST /api/agents/:agentId/deploy
  app.post('/api/agents/:agentId/deploy', (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const { agentId } = req.params;
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    // AGENTS-2: retired is retired. And an agent who has been called in does not
    // get a second seat on the way out.
    if (agent.archived) return res.status(410).json({ error: 'agentRetired' });
    if (agent.retiring) return res.status(409).json({ error: 'agentRetiring' });

    ensureMemory(agent);
    ensureProfile(agent);
    ensureBankroll(agent);

    // WANTS-1: he asked to sit one out and you said yes. The bench has to mean
    // something or the answer was theatre. It clears itself the moment STAMINA
    // has him back at 'fresh' — nothing to remember to undo.
    // Not while he is still in a seat: a bench that has not taken effect yet
    // must not also swallow the "hand back the table he is already at" reply
    // below, or a client polling deploy loses the session he is finishing.
    const seatedNow = !!(agent.activeTableId && liveTables?.hasTable?.(agent.activeTableId));
    if (!seatedNow && isRestBenched(agent)) {
      return res.status(409).json({
        error: 'agentResting',
        message: `${agent.name || 'He'} is sitting this one out. He asked, and you said yes.`,
        fatigue: fatigueNow(agent),
        restingUntil: 'fresh',
      });
    }

    // Already at a live table — hand back the same one rather than stacking a
    // second autonomous session on top of the first.
    if (agent.activeTableId && liveTables?.hasTable?.(agent.activeTableId)) {
      return res.json({
        tableId: agent.activeTableId,
        agentId: agent.id,
        agentName: agent.name,
        strategy: agent.strategy,
        displayName: 'Agent',
        memoryContext: getAgentMemoryContext(agent),
        alreadyPlaying: true,
      });
    }

    // MST-2: prefer JOINING an open AI-only table over standing up a private
    // one. Filling a felt is both cheaper (one table's worth of model calls
    // serves N agents) and better poker -- the matchmaker ranks candidates by
    // how much action the resulting mix of archetypes should produce.
    let tableId = null;
    let seat = null;
    let joinedExisting = false;
    let sessionStarted = false;

    // MATCH-1: chosen AFTER the pocket gate below, not before it, because the
    // matchmaker now needs to know which ROOM this deploy is for — a man turned
    // away from his own stablemate's table is offered another table in the same
    // room, and the room is whatever his pocket buys into.
    let candidate = null;

    // ── WALLET-1: the pocket gate ─────────────────────────────────────────────
    // The pocket picks the stakes and decides whether he sits down at all.
    // Only enforced when the server manages sessions (liveTables present).
    const wallet = walletFor(userId);
    const pocket = ensurePocket(agent);
    pocket.agentId = agent.id;
    let deployBuyIn = 0;
    let stakes = null;

    if (liveTables) {
      // Cut off is cut off — he finishes nothing and starts nothing. Not a
      // punishment, and nothing he has learned is lost.
      if (pocket.mode === 'cut') {
        return res.status(402).json({
          error: 'He is cut off. Fund him to put him back in a seat.',
          broke: true, cut: true,
          pocket: pocketProjection(pocket),
        });
      }

      // Auto-refill happens here, before the gate: he comes to the wallet and
      // collects when he is short. allowance and topup deliberately do not.
      if (isBroke(pocket.balance)) autoRefill(wallet, pocket);

      if (isBroke(pocket.balance)) {
        // Broke: he rests at the bar. One moment, one notification a day.
        recordBrokeMoment(agent);
        agent.status = 'idle';
        agent.activeTableId = null;
        mirrorBankroll(agent);
        saveStore(userId);
        saveWalletFor(userId);
        emitAgentChange(userId);
        notifyBrokeOnce(userId, agent);
        return res.status(402).json({
          error: "His pocket is empty. He's at the bar — your call.",
          broke: true,
          pocket: pocketProjection(pocket),
          required: ENTRY_BUYIN,
          moment: agent.lastMoment,
        });
      }

      // SERVER-4: the room the owner asked for, or the highest one his pocket
      // reaches when he asked for none. Refused, never downgraded.
      const chosen = stakesForRequest(req.body, pocket.balance);
      if (chosen.status) return res.status(chosen.status).json(chosen.body);
      stakes = chosen.stakes;
      candidate = liveTables.findJoinableTable?.({
        profile: agent.profile ?? null,
        agentId: agent.id,
        // MATCH-1: this is the refusal, not a preference. Every table already
        // seating one of this owner's agents is out of the running, and the
        // deploy either finds another one in the same room or opens one.
        userId,
        room: roomForBigBlind(stakes.bigBlind)?.id ?? null,
      });
      // A table stays at the lowest rung any seated agent could afford, so he
      // may only join one whose buy-in his pocket already covers.
      if (candidate?.table && !canAffordTable(pocket.balance, candidate.table.bigBlind)) {
        console.log(`[wallet] ${agent.name} cannot cover table ${candidate.table.tableId} (${candidate.table.bigBlind} BB) — opening one at ${stakes.label}`);
        candidate = null;
      }
      deployBuyIn = candidate?.table
        ? buyInFor(candidate.table.bigBlind)
        : stakes.buyIn;
    }

    if (candidate?.table) {
      try {
        seat = candidate.table.joinAgentSession({
          agentId: agent.id,
          userId,
          displayName: agent.name || 'Agent',
          strategy: agent.strategy || '',
          memoryContext: getAgentMemoryContext(agent),
          agentProfile: agent.profile ?? null,
        });
        if (seat !== null) {
          tableId = candidate.table.tableId;
          joinedExisting = true;
          sessionStarted = true;
          console.log(`[agents] ${agent.name} joins table ${tableId} at seat ${seat} (action score ${candidate.score}, ${candidate.table.seatedCount()}/${candidate.table.maxSeats} seated)`);
        }
      } catch (err) {
        console.error('[agents] join failed, falling back to a fresh table:', err.message);
      }
    }

    if (!joinedExisting) {
      // AGE-35: the global cost bound. Each autonomous table burns model calls
      // with or without a watcher, so refuse past the cap with a clear reason.
      // Only CREATING a table counts against it -- joining one does not.
      if (liveTables && liveTables.countAutonomousTables() >= liveTables.MAX_CONCURRENT_TABLES) {
        return res.status(503).json({
          error: `The floor is full — ${liveTables.MAX_CONCURRENT_TABLES} tables are already running. Try again once one finishes.`,
          maxConcurrentTables: liveTables.MAX_CONCURRENT_TABLES,
        });
      }

      tableId = 'table-' + randomUUID().slice(0, 8);

      // AGE-35: build the table and start the session loop NOW. Before this the
      // table only came into being when a client sent WATCH, which is why an
      // agent could show as "playing" while its game was frozen (BUG-16/17).
      if (liveTables) {
        try {
          // WALLET-1: pocket size sets the stakes. getOrCreateTable already
          // takes blinds, so this needs no change in table.js.
          const table = liveTables.getOrCreateTable(tableId, stakes
            ? { smallBlind: stakes.smallBlind, bigBlind: stakes.bigBlind }
            : {});
          seat = table.startAgentSession({
            agentId: agent.id,
            userId,
            displayName: agent.name || 'Agent',
            strategy: agent.strategy || '',
            memoryContext: getAgentMemoryContext(agent),
            agentProfile: agent.profile ?? null,
          });
          sessionStarted = seat !== null;
        } catch (err) {
          console.error('[agents] failed to start server-side session:', err.message);
        }
      }
    }

    activeTables.add(tableId);
    agent.activeTableId = tableId;
    agent.status = 'playing';
    agent.unseenRecap = false;
    agent.sessionFlagged = [];
    // SERVER-4: the room he is walking into. Only ever a FALLBACK for the
    // location the live table derives (home.js locationFor) — it answers the
    // one window where nothing else can, between "he has been sent" and "the
    // felt exists", which is where a queued agent lives permanently.
    agent.headingTo = roomIdForStakes(stakes);
    // WALLET-1: the buy-in leaves the POCKET; credited back (as finalStack)
    // when the session ends. The old agent ledger keeps its entry too while
    // agent.bankroll is still mirrored.
    if (deployBuyIn > 0 && sessionStarted) {
      debitBuyIn(pocket, deployBuyIn, tableId);
      mirrorBankroll(agent);
      appendLedger(agent, { ts: Date.now(), type: 'buyin', amount: deployBuyIn, tableId });
      saveWalletFor(userId);
    }
    saveStore(userId);
    console.log(`[agents] deployed ${agent.name} to table ${tableId}${joinedExisting ? ` (joined seat ${seat})` : ''}${sessionStarted ? ' (autonomous session running)' : ' (awaiting client)'}`);
    emitAgentChange(userId);

    res.json({
      tableId,
      agentId: agent.id,
      agentName: agent.name,
      strategy: agent.strategy,
      displayName: 'Agent',
      memoryContext: getAgentMemoryContext(agent),
      sessionStarted,
      joinedExisting,
      seat,
      // SERVER-4: where he actually ended up. With `rung` this is what was
      // asked for; without it, it is what his pocket chose for him — and
      // either way the client no longer has to infer a room from blinds.
      room: agent.headingTo,
      stakes: stakes ? { rung: stakes.rung, smallBlind: stakes.smallBlind, bigBlind: stakes.bigBlind, buyIn: stakes.buyIn, label: stakes.label } : null,
    });
  });

  // POST /api/agents/:agentId/queue — PvP matchmaking
  // Pairs two agents on the same table without manual ID sharing.
  //
  // SERVER-4: takes `{ rung }` like /deploy, and for the same reason — the
  // owner picks a room, the server does not pick one for him. Two differences
  // from deploy, both because a queued agent has no felt yet:
  //
  //   * THE STAKES TRAVEL WITH THE SLOT, not with a table, because the table
  //     does not exist until somebody watches it. The second man into the slot
  //     inherits the first man's stakes rather than his own request: they are
  //     sitting down together, and one table cannot be at two rungs. He is
  //     still gated on affording it, so the pairing can be refused rather than
  //     seating somebody who cannot cover the felt he was matched onto.
  //   * `room` comes back in the response and is remembered on the agent as
  //     `headingTo`, which is what lets his card say where he is walking to
  //     during the window where there is nothing to derive it from.
  app.post('/api/agents/:agentId/queue', (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const { agentId } = req.params;
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    // AGENTS-2: the other door to a seat answers the same way deploy does.
    if (agent.archived) return res.status(410).json({ error: 'agentRetired' });
    if (agent.retiring) return res.status(409).json({ error: 'agentRetiring' });

    // Clear expired slot (5-min TTL).
    if (matchmakingSlot && Date.now() > matchmakingSlot.expiresAt) {
      matchmakingSlot = null;
    }

    const pocket = ensurePocket(agent);
    pocket.agentId = agent.id;

    let tableId;
    let matched;
    let stakes;

    let opponentName = null;

    if (matchmakingSlot) {
      // Match found — join the waiting table, at ITS stakes.
      stakes = matchmakingSlot.stakes ?? null;
      if (stakes && pocket.balance < stakes.buyIn) {
        return res.status(409).json({
          error: 'cantAfford',
          buyIn: stakes.buyIn,
          rung: stakes.rung,
          label: stakes.label,
          pocket: Math.max(0, Math.floor(Number(pocket.balance) || 0)),
          matched: true,
        });
      }
      tableId = matchmakingSlot.tableId;
      opponentName = matchmakingSlot.agentName;
      matchmakingSlot = null;
      matched = true;
      console.log(`[agents] matched ${agent.name} vs ${opponentName} on table ${tableId} (PvP)`);
    } else {
      const chosen = stakesForRequest(req.body, pocket.balance);
      if (chosen.status) return res.status(chosen.status).json(chosen.body);
      stakes = chosen.stakes;
      // No one waiting — create a table and queue it.
      tableId = 'table-' + randomUUID().slice(0, 8);
      matchmakingSlot = { tableId, agentName: agent.name, stakes, expiresAt: Date.now() + 5 * 60_000 };
      matched = false;
      console.log(`[agents] ${agent.name} queued on table ${tableId}${stakes ? ` at ${stakes.label}` : ''}, waiting for opponent`);
    }

    activeTables.add(tableId);
    agent.activeTableId = tableId;
    agent.status = 'playing';
    agent.unseenRecap = false;
    agent.sessionFlagged = [];
    agent.headingTo = roomIdForStakes(stakes);
    ensureMemory(agent);
    saveStore(userId);
    // A man who has just left for the casino is not at home any more, and the
    // living room has to stop drawing him there before he gets to a felt.
    emitAgentChange(userId);

    res.json({
      tableId,
      matched,
      opponentName,
      agentId: agent.id,
      agentName: agent.name,
      strategy: agent.strategy,
      memoryContext: getAgentMemoryContext(agent),
      room: agent.headingTo,
      // The blinds the client must WATCH this table with. Without them the
      // socket would stand the table up at the default 10/20 and the rung
      // would have been a suggestion.
      stakes: stakes ? { rung: stakes.rung, smallBlind: stakes.smallBlind, bigBlind: stakes.bigBlind, buyIn: stakes.buyIn, label: stakes.label } : null,
      smallBlind: stakes?.smallBlind ?? null,
      bigBlind: stakes?.bigBlind ?? null,
    });
  });

  // GET /api/agents/:agentId/hands?userId=...
  // Returns the agent's recent-hands log and aggregate stats.
  app.get('/api/agents/:agentId/hands', (req, res) => {
    const userId = String(req.query.userId || 'anon');
    const { agentId } = req.params;
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    ensureStats(agent);
    res.json({ recentHands: agent.recentHands, stats: agent.stats });
  });

  // GET /api/agents/:agentId/flagged?userId=...
  // Returns this session's flagged hands for the floor's hand-review sheet.
  // RELATE-1a: opening the review is an owner ACT and he remembers it —
  // "read back the Q3o hand". Only the proven owner writes a line; a
  // spectator looking at the sheet is not his backer.
  // holeCards are owner-gated: only the authenticated owner sees their agent's
  // hole cards — the same law AGE-33 applied to the DECISION broadcast.
  // opponentShowdownCards are public (revealed at showdown) and always returned.
  app.get('/api/agents/:agentId/flagged', (req, res) => {
    const userId = String(req.query.userId || 'anon');
    const { agentId } = req.params;
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const owner = isOwner(req, userId);
    const hands = (agent.sessionFlagged ?? []).map((h) => ({
      ...h,
      holeCards: owner ? (h.holeCards ?? []) : [],
      // opponentShowdownCards exposed as-is — public information from the showdown
      // RIDERS-1: a hand flagged before pot/allIn were recorded reads them as
      // null rather than undefined, so the replay sees "not stored" instead of
      // a missing key and falls back to its own approximation.
      streets: (h.streets ?? []).map((st) => ({
        pot: null,
        allIn: null,
        ...st,
      })),
    }));
    if (owner && hands.length > 0) {
      const wrote = recordOwnerEvent(agent, 'review_opened', { holeCards: hands[0].holeCards ?? [] });
      if (wrote) saveStore(userId);
    }
    res.json({ flaggedHands: hands, count: hands.length });
  });

  // GET /api/agents/:agentId/memory?userId=...
  // Returns the agent's memory record alongside the formatted memoryContext
  // string the table caches and feeds into the decision-time system prompt.
  app.get('/api/agents/:agentId/memory', (req, res) => {
    const userId = String(req.query.userId || 'anon');
    const { agentId } = req.params;
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    ensureMemory(agent);
    res.json({ memory: agent.memory, memoryContext: getAgentMemoryContext(agent) });
  });

  // GET /api/agents/:agentId/thread?userId=...&session=<id>
  //
  // SERVER-3: the table thread for one SESSION, oldest first — the four kinds
  // of line the watch screen's history sheet renders (TABLE / HIM / YOU /
  // opponent), with the server's own timestamps on them.
  //
  // `session` is optional. A client that has just reconnected knows which
  // AGENT it was watching and not which stay, so leaving it off answers with
  // his most recent one; that is what makes "a reconnect gets the record back"
  // a single request instead of a negotiation.
  //
  // Ownership: `him` and `you` lines carry the same private half the DECISION
  // broadcast withholds from everyone but the owner's spectator (BUG-12/15,
  // AGE-33), so a non-owner gets the room's lines and what people said out
  // loud and nothing else. The thread is not refused to him — a spectator at a
  // real table can hear the table — it is filtered, in thread.js.
  app.get('/api/agents/:agentId/thread', (req, res) => {
    const userId = String(req.query.userId || 'anon');
    const { agentId } = req.params;
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const asked = req.query.session ? String(req.query.session) : null;
    const sessionId = asked || latestSessionFor(agentId);
    if (!sessionId) return res.json({ sessionId: null, lines: [], count: 0 });

    const owner = isOwner(req, userId);
    const lines = readThread(sessionId, { owner });
    res.json({ sessionId, lines, count: lines.length });
  });

  // POST /api/agents/:agentId/finish
  app.post('/api/agents/:agentId/finish', (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const { agentId } = req.params;
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const finishedTableId = agent.activeTableId ?? null;
    if (agent.activeTableId) activeTables.delete(agent.activeTableId);
    agent.status = 'idle';
    agent.activeTableId = null;
    agent.unseenRecap = true;
    // BIO-2b: this route ends a session without going through
    // finishAgentSession, so it has to derive the roles itself. Two session-end
    // paths is a wart that predates this tree; missing one of them would have
    // meant a client-driven finish never formed a relationship.
    refreshBioRoles(agent);
    // RAISE-2: and the same wart cost the opener. An owner who stops watching
    // finishes the session through here, so this path has to write the line he
    // opens the thread with too — otherwise the very next thing the owner does
    // is open that thread and read a win/loss tally.
    ensureMood(agent);
    agent.sessionRecap = {
      ...(agent.sessionRecap ?? {}),
      text: agent.sessionRecap?.text ?? null,
      opener: formatOpener({
        mood: agent.mood,
        flagged: agent.sessionFlagged ?? [],
        seed: agent.stats?.handsPlayed ?? 0,
        nature: agent.nature,
      }),
      at: Date.now(),
    };
    // Session ended — build a self-change proposal from the leaks the
    // grounded-memory computed stats detected. One proposal max; already
    // pending proposals are preserved so the owner can still act on them.
    const hadProposalBefore = !!agent.proposal;
    try { maybeCreateProposal(agent); } catch (err) { console.error('[agents] proposal build failed:', err.message); }
    saveStore(userId);
    emitAgentChange(userId);
    // Proposal notification (owner-initiated finish — skip session recap since they are watching).
    if (!hadProposalBefore && agent.proposal) {
      notifyEvent('proposal', {
        ownerId: String(userId), agentId, agentName: agent.name || 'Your agent',
        proposalText: agent.proposal.text || '',
        proposalAt: agent.proposal.createdAt ?? null,
      });
    }
    // SERVER-3: the other session-end path. An owner who stops watching
    // finishes the session through here rather than through
    // finishAgentSession — the two-paths wart this route's comments already
    // name — so the ceremony has to be fired from here too, or half the
    // sessions in the product would end without one.
    //
    // Reason is always 'calledIn': this route exists precisely because the
    // OWNER decided the session was over. The numbers come from the live table
    // when there still is one, and from the agent record when there is not.
    // `finishedTableId`, not agent.activeTableId: this route cleared that field
    // at the top, and the numbers the ceremony prints live at the table he was
    // just at.
    const liveTable = finishedTableId ? (liveTables?.getTable?.(finishedTableId) ?? null) : null;
    const detail = liveTable?.sessionDetailFor?.(agentId) ?? null;
    emitSessionEnd({
      sessionId: detail?.sessionId ?? null,
      agentId,
      userId,
      tableId: detail?.tableId ?? finishedTableId,
      reason: 'calledIn',
      hands: detail?.hands ?? (agent.sessionHands ?? 0),
      net: detail?.net ?? 0,
      biggestPot: detail?.biggestPot ?? 0,
      duration: detail?.duration ?? 0,
    });

    res.json(presentAgent(agent, { owner: isOwner(req, userId), wallet: walletFor(userId) }));
  });

  // POST /api/agents/:agentId/proposal/accept — apply the current proposal's
  // suggestedPatch (strategy amendment + slider deltas) and clear it.
  app.post('/api/agents/:agentId/proposal/accept', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const { agentId } = req.params;
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (!agent.proposal) return res.status(400).json({ error: 'no active proposal' });
    recordOwnerEvent(agent, 'proposal_accepted', { what: agent.proposal.text });
    applyProposalPatch(agent, agent.proposal.suggestedPatch);
    agent.proposal = null;
    saveStore(userId);
    res.json(presentAgent(agent, { owner: isOwner(req, userId), wallet: walletFor(userId) }));
  });

  // POST /api/agents/:agentId/proposal/reject — clear the pending proposal.
  app.post('/api/agents/:agentId/proposal/reject', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const { agentId } = req.params;
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (agent.proposal) recordOwnerEvent(agent, 'proposal_rejected', { what: agent.proposal.text });
    agent.proposal = null;
    saveStore(userId);
    res.json(presentAgent(agent, { owner: isOwner(req, userId), wallet: walletFor(userId) }));
  });

  // POST /api/agents/:agentId/reload — free play-money reload for felted agents.
  // Only available when the agent cannot afford the minimum buy-in.
  app.post('/api/agents/:agentId/reload', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const { agentId } = req.params;
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    ensureBankroll(agent);
    const minBuyIn = (liveTables?.getDefaultBlinds?.()?.bigBlind ?? 20) * 100;
    if (agent.bankroll >= minBuyIn) {
      return res.status(400).json({ error: 'Agent still has chips', bankroll: agent.bankroll });
    }
    agent.bankroll += STARTING_GRANT;
    appendLedger(agent, { ts: Date.now(), type: 'grant', amount: STARTING_GRANT, tableId: null });
    saveStore(userId);
    emitAgentChange(userId);
    res.json(presentAgent(agent, { owner: isOwner(req, userId), wallet: walletFor(userId) }));
  });

  // POST /api/agents/:agentId/seen — clears the unseenRecap flag once the
  // owner has viewed the session recap. Mutating → auth-gated like the
  // other write endpoints (see SEC-2).
  app.post('/api/agents/:agentId/seen', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const { agentId } = req.params;
    const profile = getOrCreate(userId);
    const agent = profile.agents.find((a) => a.id === agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    agent.unseenRecap = false;
    saveStore(userId);
    res.json(presentAgent(agent, { owner: isOwner(req, userId), wallet: walletFor(userId) }));
  });

  // POST /api/agents/chat/reset — clear chat history to opening message
  app.post('/api/agents/chat/reset', (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const profile = getOrCreate(userId);
    profile.chat = [{ role: 'assistant', content: OPENING_MSG }];
    saveStore(userId);
    res.json({ ok: true });
  });

  // POST /api/agents/chat — pure conversational reply, never generates an agent
  app.post('/api/agents/chat', chatLimiter, telegramAuthMiddleware, async (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const content = String(req.body?.content || '').trim();
    const existingAgentId = req.body?.existingAgentId ?? null;
    if (!content) return res.status(400).json({ error: 'content required' });

    const profile = getOrCreate(userId);

    // ── Existing-agent owner chat ────────────────────────────────────────────
    // When the request comes from AgentChat (an already-built agent), use a
    // stateless turn with an agent-specific system prompt. This avoids mixing
    // creation-flow history into the conversation and prevents the model from
    // asking creation questions to the owner of an existing agent.
    const existingAgent = existingAgentId
      ? profile.agents.find((a) => a.id === existingAgentId)
      : null;

    if (existingAgent) {
      const body = await ownerChatTurn(existingAgent, userId, content);
      return res.json(body);
    }

    // ── Creation-flow chat ───────────────────────────────────────────────────
    profile.chat.push({ role: 'user', content });

    // The whole brief so far, in the owner's own words. Used for the nature
    // hint, for reading a vague brief into sliders, and for the build.
    const ownerSaid = () => profile.chat.filter((m) => m.role === 'user').map((m) => m.content).join(' ');

    // ATTR-3a / PACE-1d: everything the birth screen shows about a draft in
    // progress, derived from ONE profile so the strip, the temperament chip and
    // the primary action can never disagree. Only the owner's own words count —
    // the recruiter's questions would otherwise vote for a temperament nobody
    // asked for.
    const draftState = () => draftProfile(ownerSaid());

    // ── "lets go" ────────────────────────────────────────────────────────────
    // The owner saying he is done briefing is the build trigger. Nothing else
    // was calling /api/agents/build — the birth screen only ever posts here and
    // waits for an agentId — so a draft could be perfect and still never become
    // anyone. That is the "and no profile" half of the reported bug.
    const briefSoFar = ownerSaid();
    const hasBrief = profile.chat.some((m) => m.role === 'user' && !isGoSignal(m.content));
    if (isGoSignal(content) && hasBrief) {
      // AGENTS-2: the cap is checked BEFORE the build, so a full roster costs no
      // model call — and the draft is left intact, ready to finish the moment
      // the owner makes room.
      // SLOTS-1: and the same check now also answers "the slot is not earned
      // yet", for the same reason and in the same place. The draft survives
      // either refusal untouched: a locked slot is a thing that opens by
      // itself the next time one of his agents has a winning night.
      const refusal = slotRefusal(userId, profile);
      if (refusal) {
        saveStore(userId);
        return res.status(409).json(refusal);
      }
      const built = await buildFromDraft(profile, briefSoFar, userId);
      const agent = commitAgent(profile, null, built.agent);
      const line = built.line;
      profile.chat.push({ role: 'assistant', content: line });
      saveStore(userId);
      return res.json({
        chat: profile.chat,
        natureHint: agent.nature?.name ?? draftState().nature,
        // PACE-1d: a reply that ends the draft always says so, and always
        // carries the dials it ended on.
        ready: true,
        profile: agent.profile ?? null,
        agentId: agent.id,
        agentName: agent.name,
        strategy: agent.strategy,
        createdAgent: presentAgent(agent, { owner: true }),
      });
    }

    // ── An ordinary turn, guarded ────────────────────────────────────────────
    // The model's reply never reaches the owner unchecked: a fence, a class
    // definition or a wall of text is dropped and replaced, in order of
    // preference, by the mapping for a vague brief, the last good thing the
    // recruiter said, or a plain question about play.
    let raw = null;
    try {
      raw = await callClaude(profile.chat, SYSTEM_CONV, 150, { ownerId: userId, kind: MeterKind.CHAT });
    } catch (err) {
      console.error('[agentProfiles] chat error:', err.message);
    }
    const guarded = draftReply({ raw, brief: briefSoFar, chat: profile.chat });
    if (guarded.guarded) {
      console.warn(`[agentProfiles] draft reply rejected (${guarded.guarded}) — sent ${guarded.source}`);
    }
    profile.chat.push({ role: 'assistant', content: guarded.text });
    saveStore(userId);
    const draft = draftState();
    return res.json({
      chat: profile.chat,
      natureHint: draft.nature,
      // PACE-1d: the dials the draft has produced so far, all four of them or
      // none — a strip with two of four filled in is a strip that looks broken.
      profile: draft.profile,
      // Enough to build him. The screen shows the primary action on this, so a
      // chip pick moves the draft forward on the very first turn instead of
      // dead-ending on a reply that reads like a closing line.
      ready: draft.ready,
    });
  });

  // POST /api/agents/build — generate agent from current chat, commit it
  app.post('/api/agents/build', chatLimiter, telegramAuthMiddleware, async (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const existingAgentId = req.body?.existingAgentId ?? null;

    const profile = getOrCreate(userId);

    // AGENTS-2: same cap, same 409, on the other door into commitAgent. A
    // REBUILD of an agent who already exists is not a new agent and is never
    // capped — otherwise a full roster could not edit its own agents.
    // SLOTS-1: `agentCap` past four, `slotLocked` before the slot is earned.
    // A REBUILD is neither — it takes no new slot, so it is never refused for
    // one, exactly as AGENTS-2 wrote it.
    if (!existingAgentId) {
      const refusal = slotRefusal(userId, profile);
      if (refusal) return res.status(409).json(refusal);
    }

    const existingAgentForCtx = existingAgentId
      ? profile.agents.find((a) => a.id === existingAgentId)
      : null;
    const editNote = existingAgentForCtx
      ? `\n\nNote: you are updating the existing agent "${existingAgentForCtx.name}" (${existingAgentForCtx.style}/${existingAgentForCtx.risk}). Output the complete updated agent profile.`
      : '';
    const genSystem = SYSTEM_GEN + editNote;

    try {
      let agent = null;
      const raw = await callClaude(profile.chat, genSystem, 200, { ownerId: userId, kind: MeterKind.CHAT });
      if (raw) {
        try { agent = JSON.parse(raw); } catch {}
      }
      if (!agent) {
        const combined = profile.chat.map((m) => m.content).join(' ');
        agent = inferFallback(combined);
      }
      agent = commitAgent(profile, existingAgentId, agent);
      saveStore(userId);
      return res.json({ createdAgent: agent });
    } catch (err) {
      console.error('[agentProfiles] build error:', err.message);
      const combined = profile.chat.map((m) => m.content).join(' ');
      const agent = commitAgent(profile, existingAgentId, inferFallback(combined));
      saveStore(userId);
      return res.json({ createdAgent: agent });
    }
  });
}
