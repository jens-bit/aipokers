// src/server/place.js — SERVER-5 job 3
//
// Picking him up and putting him somewhere.
//
// HOME-STATE-1 gave the flat five things in it and no way to use any of them.
// The couch, the kitchen table, the fridge, the TV and the front door were
// drawn, and every one of them was reached through a different route with a
// different shape — or, in the couch's case, only ever as an answer to a want
// he had to raise first. That is a house you can look at.
//
// This is the one door: POST /api/agents/:id/place { fixture }, five fixtures,
// one refusal vocabulary, and the resulting HOME_STATE in the reply.
//
// FOUR RULES.
//
//   1. THE FIXTURE IS THE ONLY ARGUMENT. Where you put him says everything —
//      there is no "how long", no "which tape", no options object. The TV puts
//      on the newest thing he flagged; the fridge hands him what is in it. A
//      placement with parameters is a form, and nobody carries a man to the
//      couch by filling in a form.
//   2. IT NEVER TAKES HIM OUT OF A HAND. Mid-hand at a table is 409 `inHand`
//      with his own line, for every fixture including the door. He has money
//      in the middle; the fixture can wait forty seconds.
//   3. IT GOES THROUGH THE EXISTING DOOR, NEVER AROUND IT. couch is the same
//      bench POST /want's yes runs, fridge is giveItemTo with every fridge
//      rule intact, tv is the tape room's own beginStudy, door is deployAgent
//      — the pocket gate, the matchmaker and the buy-in, unchanged. Nothing
//      here re-implements a rule, which is why nothing here can disagree with
//      the screen that already had a button for it.
//   4. A REFUSAL IS A SENTENCE, NOT A CODE. Every 409 carries `error` in his
//      voice and a machine-readable `reason` beside it. "He is at a table" is
//      something you can act on; `E_LOCATION` is not.
//
// The flat's four inside fixtures require him to be HOME, which is the same
// gate the tape room has always had and for the same reason: you cannot put a
// man on a sofa in a building he is not in. The door is the one that changes
// where he is, and it is deploy.

import { telegramAuthMiddleware, isOwner } from './auth.js';
import {
  agentsOf,
  deployAgent,
  giveItemFrom,
  restAgent,
  seatStatusOf,
  fatigueNow,
  homeSnapshot,
  getAgentHome,
} from './agentProfiles.js';
import { beginStudy } from './tapeRoom.js';
import * as homeGame from './homeGame.js';
import { notifyHomeChanged } from './floorChannel.js';
import { Where } from './home.js';

// The five things in the flat. The vocabulary is CLOSED — a client switches on
// it and a sixth fixture is a sixth thing drawn on the wall, so the list is
// short on purpose, exactly like home.js's routine vocabulary.
export const FIXTURES = Object.freeze(['couch', 'table', 'fridge', 'tv', 'door']);

export function isFixture(id) {
  return FIXTURES.includes(id);
}

// What he says as you put him down. Templates, deterministic, no model call —
// the same law the wants' lines and the openers are written under.
export const PLACE_LINES = Object.freeze({
  couch:  'Right. I am at the bar.',
  table:  'Deal me in.',
  fridge: 'Cheers.',
  tv:     'Let me see it again.',
  door:   'On my way.',
});

// And what he says when he cannot be moved.
export const REFUSAL_LINES = Object.freeze({
  inHand:   'I am in a hand. Give me a minute.',
  notHome:  'I am at a table. Bring me home first.',
  studying: 'I am watching one. Let me finish it.',
  worn:     'I am cooked. Not tonight.',
});

const refuse = (reason, extra = {}) => ({
  status: 409,
  body: { error: REFUSAL_LINES[reason] ?? 'Not now.', reason, ...extra },
});

/**
 * Put him at a fixture. Returns { status, body } — the route turns it into a
 * reply and the HOME_STATE is attached on the way out, so no branch below has
 * to remember to include it.
 */
export function placeAgent(agentId, userId, fixture) {
  if (!isFixture(fixture)) {
    return { status: 400, body: { error: `fixture must be one of ${FIXTURES.join(', ')}` } };
  }
  const agent = agentsOf(userId).find((a) => a.id === agentId);
  if (!agent) return { status: 404, body: { error: 'Agent not found' } };

  // Rule 2, before anything else and for every fixture.
  const seat = seatStatusOf(agent);
  if (seat.inHand) return refuse('inHand', { tableId: seat.tableId });

  // The door is the fixture that changes where he is; the other four are in
  // the flat, and he has to be in it.
  if (fixture !== 'door' && seat.atTable) return refuse('notHome', { tableId: seat.tableId });

  switch (fixture) {
    case 'couch':  return atCouch(agent, userId);
    case 'table':  return atTable(agent, userId);
    case 'fridge': return atFridge(agent, userId);
    case 'tv':     return atTv(agent, userId);
    case 'door':   return atDoor(agent, userId);
    default:       return { status: 400, body: { error: 'unknown fixture' } };
  }
}

// ── The five ────────────────────────────────────────────────────────────────

// Rest. The bench clears itself the moment STAMINA has him back at 'fresh' —
// nothing for the owner to remember to undo, which is why the couch has no
// opposite fixture.
function atCouch(agent, userId) {
  const out = restAgent(agent, userId);
  return { status: 200, body: { ...out, moment: agent.lastMoment ?? null } };
}

// The kitchen table. There is nothing to "join": homeGame derives who is
// sitting there from who is home and idle (its rule 1), so putting him at it
// means clearing what was occupying him and reconciling. The two things that
// occupy him are the two the derivation itself excludes, and both are refusals
// rather than something to override — cutting a study short to seat him would
// hand him the read for free, and dealing a worn man in is the opposite of
// what the bar is for.
function atTable(agent, userId) {
  if (agent.study) return refuse('studying', { study: agent.study });
  // `fatigueNow`, not the stored stage: an hour at the bar has him a stage
  // back, and refusing him a friendly game on last night's reading would be
  // the same lie RIDERS-1 fixed on the floor.
  const fatigue = fatigueNow(agent);
  if (fatigue === 'worn') return refuse('worn', { fatigue });
  const game = homeGame.sync(userId);
  const seated = (game?.seats ?? []).some((s) => s.agentId === agent.id);
  return { status: 200, body: { seated, game: game ?? null } };
}

// A snack out of the fridge, under every rule FRIDGE-1 wrote: an empty shelf
// is a 409 with the door to open, and a man who is level is "He's fine. Save
// it." Both are passed through exactly as giveItemTo returns them — a fixture
// that softened one of them would be a second fridge.
function atFridge(agent, userId) {
  return giveItemFrom(agent, userId, 'snack');
}

// The TV. The tape room owns the ninety seconds and every refusal in it.
function atTv(agent, userId) {
  return beginStudy(agent.id, userId, { handId: null });
}

// The front door. Deploy, whole: the pocket gate, the cut-off, the broke
// moment, the matchmaker and the buy-in, none of which is re-stated here.
//
// MERGE: this is BUGS-B/1's deployAgent — the same function the owner's own
// POST /deploy and the table's re-queue go through, taking (userId, agentId).
// SERVER-5 had extracted a second one before that landed; there is one now,
// which is the whole point of rule 3. No `rung` is passed: a fixture takes no
// parameters (rule 1), so the door buys into whatever his pocket reaches, and
// an owner who wants to pick the room has the deploy route for it.
function atDoor(agent, userId) {
  return deployAgent(userId, agent.id);
}

// ── The route ───────────────────────────────────────────────────────────────

/**
 * POST /api/agents/:agentId/place  { userId, fixture }
 *
 * Owner-gated, like every route that changes an agent. It can reach a model
 * call (the door starts a session; the kitchen table deals hands), so it sits
 * behind the app-wide /api limiter the same way POST /deploy and POST /study
 * do — it is a button, not a chat turn.
 */
export function installPlaceRoutes(app) {
  app.post('/api/agents/:agentId/place', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.body?.userId || req.query.userId || 'anon');
    const { agentId } = req.params;
    if (!isOwner(req, userId)) return res.status(403).json({ error: 'not your agent' });

    const fixture = String(req.body?.fixture ?? '');
    const out = placeAgent(agentId, userId, fixture);

    // Rule: the reply IS the resulting HOME_STATE, whichever way it went. A
    // client that placed him gets the room back and never has to ask a second
    // question to find out what happened to it.
    const body = {
      ...out.body,
      fixture: isFixture(fixture) ? fixture : null,
      placed: out.status === 200,
      line: out.status === 200 ? (PLACE_LINES[fixture] ?? null) : (out.body?.error ?? null),
      home: homeStateFor(userId),
    };

    // And the room is pushed to him as well, because he may have it open on
    // another device — the same reason every other mutation announces.
    if (out.status === 200) {
      try { notifyHomeChanged(userId); } catch (err) { console.error('[place] push failed:', err.message); }
    }
    res.status(out.status).json(body);
  });
}

function homeStateFor(userId) {
  try {
    return homeSnapshot(userId, { owner: true, game: homeGame.state(userId) });
  } catch (err) {
    console.error('[place] home snapshot failed:', err.message);
    return null;
  }
}

// Kept for the tests and for any caller that wants the one fact the fixtures
// gate on without assembling a whole snapshot.
export function isHome(agentId, userId) {
  return getAgentHome(agentId, userId)?.location?.where === Where.HOME;
}
