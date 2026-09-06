// client/src/screens/HomeScreen.jsx — HOME-1
//
// BOARD 29 — the flat, seen from above. Ported from design-refs/mood-home.jsx.
//
// This is the tab the app opens on. The floor screen answered "who is playing";
// this answers "where is everybody and what are they doing", which is the only
// question a Tamagotchi screen has ever had to answer.
//
// The ref's three mechanics, and all three are motion rather than layout:
//
//   1 THE HOME GAME  two or more at home play each other for nothing at the
//     kitchen table — real hands off the real socket, no money line anywhere.
//     One alone plays the house on the TV.
//   2 AWAY IS SHOWN  an agent at the casino is a framed live window on the
//     wall, his table in miniature, moving.
//   3 ROUTINES       idle behaviour by nature and state, so the room has a
//     texture when nothing at all is happening.
//
// And the fourth thing, which is this port's own: EVERY POSITION CHANGE IS A
// WALK. He is not teleported out when you send him and not teleported home when
// he is done — he crosses the room, and the room notices. See useWalks.
//
// WHAT THIS SCREEN NEVER DOES: insert a row. Not the composer, not an answer to
// a want, not a study finishing. Every line it shows is one the server wrote.
//
// ── DESK-2 · the same screen at 1440 ────────────────────────────────────────
//
// `desktop` does not fork the room. It is THE SAME ROOM — the same 390x470
// coordinate space, the same fixtures, the same bodies, the same walks — shown
// bigger, with the one thing 1440 actually buys: a permanent rail where the
// phone has a collapsing sheet. Board 31 P15-P18, ported from
// design-refs/mood-home-desk.jsx.
//
// Two consequences, and both are why there is a `renderRail` prop rather than a
// second screen:
//
//   * THE STATE STAYS HERE. useHomeState opens ONE owner subscription. A desk
//     component that fetched the roster for its rail would be a second reader
//     of the same push, free to disagree with the room beside it about who is
//     home. So the rail is rendered BY the caller and fed BY this screen.
//   * THE FIXTURES RAISE. On the phone the safe navigates and the fridge opens
//     glass over the room. On the desk a fixture opens a panel in the rail and
//     the room dims instead of being covered (P16) — so `desktop` reports which
//     fixture was touched and renders neither sheet itself.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHomeState } from '../hooks/useHomeState.js';
import { useTable } from '../hooks/useTable.js';
import { HomeFlat } from '../components/home/HomeFlat.jsx';
import { AwayWall } from '../components/home/AwayWall.jsx';
import { HomeGameTable, useHomeTable } from '../components/home/HomeGame.jsx';
import { HomeOne, HomeBubble } from '../components/home/atoms.jsx';
import { useRoomBubbles } from '../components/home/roomBubbles.js';
import { HomeThread } from '../components/home/HomeThread.jsx';
import { WantToast } from '../components/home/WantToast.jsx';
import { FridgeSheet } from '../components/home/FridgeSheet.jsx';
import { CasinoOnTv, TapeOnTv } from '../components/home/CasinoOnTv.jsx';
import { TableSheet, useSlots } from '../components/home/TableSheet.jsx';
import { homePositions, bubbleSide, DOOR_SPOT, F_W, F_H } from '../components/home/flat.js';
import { routineKeyOf } from '../components/home/routines.js';
import { accentFor } from '../components/floor/atoms.jsx';
import { NotYet } from '../components/ftu/NotYet.jsx';
import { identitiesFor } from '../lib/identity.js';
import { placeAgent } from '../lib/place.js';
import { useCarry } from '../hooks/useCarry.js';
import { midHand, verbFor } from '../components/home/carry.js';
import { getUserId, getTelegramInitData } from '../lib/telegram.js';
import { signedMoney } from '../lib/wallet.js';
import '../styles/home1.css';

// A crossing, not a cut. The ref times the walk out at 1.8s and the walk home at
// 1.6s; one duration serves both, because what the class is for is the transit
// and the room does not care which door he used.
export const WALK_MS = 1600;

// How long the money line rides above a returning agent. The ref: "the session
// result rides above him and lands with him, once."
export const ARRIVAL_MS = 6000;

const AGENT_CAP = 4;

// BUG-32: how long a newborn stands in the doorway before he crosses the room.
// One frame would do the job mechanically — the walk is what the class does,
// not what this timer does — but a beat at the door is the ref's first panel
// ("Born. He comes in through the door, like anyone arriving.") and without it
// the arrival is over before the eye has found him.
export const DOOR_BEAT_MS = 260;

/**
 * Was he born a moment ago?
 *
 * The server says so on HOME_STATE (src/server/home.js, `newborn`). The
 * fallback is the birth time it sends alongside, for a client talking to a
 * server from before BIRTH-5 — and no fallback beyond that, because an agent
 * with no birth time on the record is an agent from before any of this, and
 * walking him in would replay a birth from March.
 */
export function isNewborn(agent, { now = Date.now(), windowMs = 60_000 } = {}) {
  if (typeof agent?.newborn === 'boolean') return agent.newborn;
  const born = Number(agent?.bornAt);
  if (!Number.isFinite(born)) return false;
  return now - born >= 0 && now - born < windowMs;
}

/**
 * BUG-32 — the newborn comes in through the door.
 *
 * He used to materialise in his chair: the roster arrived with one more man in
 * it than it had a second ago, and he was simply THERE, seated, dealt in. Every
 * other position change in this room is a walk (see useWalks) and the one
 * arrival that is actually an arrival was the exception.
 *
 * The fix is to give him a previous position. He is pinned to the doorway for
 * one beat, which is a real position with a real name, and then released — so
 * the ordinary walk machinery sees `door:born → table:2` and crosses him over,
 * with no second animation and no special case inside useWalks.
 *
 * Returns the positions map to render, doors and all.
 */
export function useBirthWalk(agents, positions) {
  const [atDoor, setAtDoor] = useState(() => new Set());
  const seenRef = useRef(new Set());
  const timersRef = useRef(new Map());

  useEffect(() => {
    const arriving = [];
    for (const agent of agents) {
      const id = String(agent?.id ?? '');
      if (!id || seenRef.current.has(id)) continue;
      seenRef.current.add(id);
      if (isNewborn(agent)) arriving.push(id);
    }
    if (arriving.length === 0) return;

    setAtDoor((s) => {
      const next = new Set(s);
      arriving.forEach((id) => next.add(id));
      return next;
    });
    arriving.forEach((id) => {
      const timers = timersRef.current;
      if (timers.has(id)) clearTimeout(timers.get(id));
      timers.set(id, setTimeout(() => {
        timers.delete(id);
        setAtDoor((s) => {
          if (!s.has(id)) return s;
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }, DOOR_BEAT_MS));
    });
  }, [agents]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => { timers.forEach((t) => clearTimeout(t)); timers.clear(); };
  }, []);

  return useMemo(() => {
    if (atDoor.size === 0) return positions;
    const out = new Map(positions);
    for (const id of atDoor) {
      if (!out.has(id)) continue;
      // `spot` is what a walk is measured in, so it has to be a name of its own
      // — reusing 'door:away' would make a newborn indistinguishable from an
      // agent who is out at the casino.
      out.set(id, { x: DOOR_SPOT.x, y: DOOR_SPOT.y, spot: 'door:born', seat: null });
    }
    return out;
  }, [positions, atDoor]);
}

// DESK-2 — how much bigger the room gets on the desk.
//
// The ref hard-codes 1.34 (HD_SCALE in mood-home-desk.jsx) because that is what
// fits ITS stage. What it is CLAIMING is "the same room, bigger", so the number
// is derived from the stage this room is actually given: the largest scale at
// which the 390x470 space still fits, whichever axis runs out first. At
// 1440x900 with the rail beside it that lands around 1.7.
//
// Capped at 1.9, because past about twice size the room stops reading as a room
// seen from above and starts reading as a diagram of one. Floored at 1, because
// the desk is the wide platform and a room smaller than the phone's is not a
// thing this function should ever be able to produce.
export const HOME_DESK_MAX = 1.9;

export function fitScale(width, height) {
  if (!(width > 0) || !(height > 0)) return 1;
  return Math.max(1, Math.min(HOME_DESK_MAX, width / F_W, height / F_H));
}

/**
 * Which agents are walking right now.
 *
 * A walk is a POSITION CHANGE, and position is a named spot rather than a pair
 * of numbers — "couch → table" is the statement, and two coordinates that happen
 * to differ by a pixel are not. The class is what the tests assert on, because
 * an animation is not observable and a class transition is.
 */
export function useWalks(positions) {
  const [walking, setWalking] = useState(() => new Set());
  const prevRef = useRef(new Map());
  const timersRef = useRef(new Map());

  useEffect(() => {
    const prev = prevRef.current;
    const moved = [];
    for (const [id, at] of positions) {
      const was = prev.get(id);
      // First sight is not a walk: an agent who was already on the couch when
      // the screen mounted did not just cross the room to get there.
      if (was && was !== at.spot) moved.push(id);
      prev.set(id, at.spot);
    }
    for (const id of [...prev.keys()]) if (!positions.has(id)) prev.delete(id);
    if (moved.length === 0) return;

    setWalking((s) => {
      const next = new Set(s);
      moved.forEach((id) => next.add(id));
      return next;
    });
    moved.forEach((id) => {
      const timers = timersRef.current;
      if (timers.has(id)) clearTimeout(timers.get(id));
      timers.set(id, setTimeout(() => {
        timers.delete(id);
        setWalking((s) => {
          if (!s.has(id)) return s;
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }, WALK_MS));
    });
  }, [positions]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => { timers.forEach((t) => clearTimeout(t)); timers.clear(); };
  }, []);

  return walking;
}

/** His read book, for the "+3 GRANITE" line under a studying agent's bubble. */
export function useStudyBook(agentId) {
  const [book, setBook] = useState(null);
  useEffect(() => {
    if (!agentId) { setBook(null); return undefined; }
    let alive = true;
    const userId = getUserId();
    const initData = getTelegramInitData();
    fetch(`/api/agents/${encodeURIComponent(agentId)}/study?userId=${encodeURIComponent(userId)}`, {
      headers: initData ? { 'X-Telegram-Init-Data': initData } : undefined,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => { if (alive) setBook(b?.book ?? null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [agentId]);
  return book;
}

/** "+3 GRANITE" — the subject he has most on, and how much of it. */
export function studyTag(book) {
  const top = (book ?? [])[0];
  if (!top?.lines?.length) return null;
  return `+${top.lines.length} ${String(top.displayName || '').toUpperCase()}`;
}

export function HomeScreen({
  wsUrl = null,
  onWatch,
  // BUGS-A job 7: watch a table by id, with no agent behind it. The kitchen
  // table is a real table (HOME-STATE-1) and it is nobody's deployment, so
  // "watch him" is the wrong shape for it.
  onWatchTable,
  // SIT-1: take a chair at it yourself. A different verb from onWatchTable and
  // a different socket — that one WATCHes, this one JOINs — so it is a second
  // prop rather than a flag on the first.
  onSitTable,
  onProfile,
  onDeploy,
  onCreateAgent,
  // HOME-2 job 1 · the casino is the door. There is no bottom bar to reach it
  // by any more, so the room carries the only way in — and the phone is the
  // only shell that needs it: the desk has the building beside it in a rail.
  onCasino,
  onOpenWallet,
  onOpenThread,
  onSend,
  sending = false,
  // DESK-2 — see the header. `desktop` shows the room at HD_SCALE with the rail
  // beside it; `renderRail` is given everything the rail needs so this screen
  // stays the only reader of the household.
  desktop = false,
  renderRail = null,
  // The rail's panel is CONTROLLED when the caller offers a setter: the desktop
  // shell's top bar can put the standup in it, and Escape can take it out, and
  // neither of those is a thing that happens inside this room. Uncontrolled
  // otherwise, so the screen still works on its own.
  panel = null,
  onPanel = null,
  // Which man the rail is pointed at. Controlled for the same reason `panel`
  // is: the shell's collapsed roster strip is one of the ways it changes, and
  // that strip lives outside this room.
  focusId: focusIdProp = null,
  onFocusId = null,
  // BIRTH-5: the birth screen's refusal ("2nd seat costs 10,000 won · you have
  // 4,200") sends the owner here to look at the table. Same seam YouScreen's
  // `openMoney` uses — the shell says open it, the screen owns it from there —
  // except that App raises it as a COUNTER, because the refusal repeats and a
  // flag that is already true is not a second ask. Anything truthy opens it;
  // `true` still works for a caller that has only one ask to make.
  openTable = false,
}) {
  const { agents, home, away, game, arrival, clearArrival, refresh, clearWant, loaded } =
    useHomeState({ wsUrl });

  // The home game runs on its own spectator socket. The app's table socket
  // belongs to whatever the owner chose to watch, and the kitchen table must
  // never be able to take it from him.
  const homeTable = useTable({ wsUrl });
  useHomeTable(homeTable, game?.state === 'running' ? game.tableId : null);

  const [threadOpen, setThreadOpen] = useState(false);
  const [focusIdLocal, setFocusIdLocal] = useState(null);
  const focusId = focusIdProp ?? focusIdLocal;
  const setFocusId = onFocusId ?? setFocusIdLocal;
  const [fridgeOpen, setFridgeOpen] = useState(false);
  // DESK-2 — which panel the rail is showing: the room's own thread, one of the
  // three fixtures, one man's thread, or nothing at all when the shell has put
  // something else beside the room. Only ever read on the desk.
  const [railLocal, setRailLocal] = useState('thread');
  // The stage's content box, watched so the room re-fits when the rail changes
  // width or the window does. Absent ResizeObserver (jsdom) the room simply
  // stays at 1, which is the phone's own scale and not a broken screen.
  //
  // A callback ref rather than useRef: the empty room returns before the stage
  // exists, so a mount-time effect would look at nothing and never look again
  // once the first agent moved in.
  const [roomEl, setRoomEl] = useState(null);
  const [deskScale, setDeskScale] = useState(1);
  // HOME-2 job 5 · the flat itself, for the scale a carried body is measured
  // by. Not `roomEl`: that is the CONTAINER, which is taller than the room and
  // carries the floor below it, so a point measured against it is off by
  // however much slack the phone had.
  const [flatEl, setFlatEl] = useState(null);
  // What he said when he was put down: { id, text }. One at a time, and it
  // clears itself — a refusal is a moment, not a state.
  const [saidOnDrop, setSaidOnDrop] = useState(null);
  const rail = panel ?? railLocal;
  const setRail = onPanel ?? setRailLocal;
  // BIRTH-5 — the phone's own answer to the same fixture: a sheet over the room
  // where the desk raises a rail panel.
  const [tableOpen, setTableOpen] = useState(openTable && !desktop);

  // A second request to open it re-opens it, which is what makes the birth
  // screen's link work twice. Closing is the owner's own business and is never
  // undone from out here.
  useEffect(() => {
    if (!openTable) return;
    if (desktop) setRail('table');
    else setTableOpen(true);
  // setRail is either the caller's setter or a useState setter; neither changes
  // identity in a way this effect should re-run on.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTable, desktop]);

  // The money line clears itself; it lands once.
  useEffect(() => {
    if (!arrival) return undefined;
    const t = setTimeout(() => clearArrival(), ARRIVAL_MS);
    return () => clearTimeout(t);
  }, [arrival, clearArrival]);

  const gameAgentIds = useMemo(
    () => (game?.state === 'running' ? (game.seats ?? []).map((s) => s.agentId).filter(Boolean) : []),
    [game],
  );

  // HOME-2 job 3 · WHO EVERYBODY IS, rolled once for the whole household.
  //
  // Rolled here rather than inside each body because the ROSTER is the
  // authority and a body cannot see the roster: four agents drawn from six
  // hoods collide about half the time however good the hash is, so a hood
  // already worn in this room is taken and the next free one along is worn
  // instead. `agents` is the roster in birth order, which is what makes the
  // claim mean "claimed at birth".
  const identities = useMemo(() => identitiesFor(agents), [agents]);

  const settled = useMemo(
    () => homePositions(agents, { gameAgentIds }),
    [agents, gameAgentIds],
  );
  // BUG-32: a newborn stands in the doorway for one beat first, so the walk
  // machinery below has a previous position to cross him from.
  const positions = useBirthWalk(agents, settled);
  const walking = useWalks(positions);

  useEffect(() => {
    if (!desktop || !roomEl || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setDeskScale(fitScale(box.width, box.height));
    });
    ro.observe(roomEl);
    return () => ro.disconnect();
  }, [desktop, roomEl]);

  const studying = home.find((a) => routineKeyOf(a) === 'tape') ?? null;
  const studyBook = useStudyBook(studying?.id ?? null);
  const tag = studyTag(studyBook);

  // ── FIX-6 job 3 · what the room is allowed to say ─────────────────────────
  //
  // Everybody standing in the flat, with the box their name pill occupies —
  // handed to the queue whether or not they have anything to say, because a
  // pill is something a bubble has to keep out of the way of.
  const bodies = useMemo(() => home.map((agent) => {
    const at = positions.get(String(agent.id));
    if (!at) return null;
    const seated = at.seat !== null && at.seat !== undefined;
    // `nickname` is what the pill writes when the name is too long for it
    // (HOME-2 job 2), so the queue has to measure the same box the room draws.
    return {
      id: String(agent.id), x: at.x, y: at.y, size: seated ? 50 : 46,
      name: agent.name, nickname: agent.nickname ?? null,
    };
  }).filter(Boolean), [home, positions]);

  // ONE line per man, ranked. He can easily have three at once — an unanswered
  // want, a session he has not been told about, and a subject he is studying —
  // and the room used to draw two of them at the same time, over the same head.
  //
  //   0  a want          he is asking, and it is waiting on an answer
  //   1  the money line  he has just this second walked back in with it
  //   2  the recap       the session you have not seen yet
  //   3  the study tag   what he is watching a hand back for
  //
  // The order is by how soon it stops being true. A want waits for you; a study
  // tag will still be there in a minute.
  const speakers = useMemo(() => {
    const out = [];
    for (const body of bodies) {
      const agent = home.find((a) => String(a.id) === body.id);
      if (!agent) continue;
      const landed = arrival && arrival.agentId === body.id;
      const isStudying = studying && studying.id === agent.id;
      const line = agent.want ? { text: agent.want.text, gold: true }
        : landed ? { text: moneyLine(arrival), gold: false }
        : agent.unseenRecap ? { text: agent.sessionRecap?.text, gold: true }
        : (isStudying && tag) ? { text: tag, gold: false }
        : null;
      if (!line?.text) continue;
      out.push({ ...body, ...line });
    }
    return out;
  }, [bodies, home, arrival, studying, tag]);

  // At most two on screen, one per man, nothing drawn over anything. The rest
  // wait their turn — see roomBubbles.js.
  const bubbles = useRoomBubbles(speakers, bodies);

  // ── HOME-2 job 5 · carrying him ───────────────────────────────────────────
  //
  // Long-press lifts him, the finger carries him, and the fixture under the
  // finger when it lets go is what happens next. Off on the desk: DESK-2's room
  // is a picture beside a rail rather than a thing you put your hand into, and
  // a drag there is a mouse selecting text.
  const onDrop = useCallback(async (agentId, fixture) => {
    // Nowhere is a real answer. He goes back where he was, and the room says
    // nothing — a drop on the floor is not a mistake to be reported.
    if (!fixture) return;
    const agent = home.find((a) => String(a.id) === String(agentId));
    if (!agent) return;

    // THE REFUSAL COMES FIRST, because the room can see it without asking. He
    // is in a hand; whatever the server would eventually say, the answer is no
    // and he walks back. What is shown is the fact rather than a sentence — the
    // room has never put words in his mouth, and until the server sends a line
    // there is no line of his to show.
    const seated = positions.get(String(agentId))?.seat != null;
    if (midHand(agent, { seated, gameRunning: game?.state === 'running' })) {
      setSaidOnDrop({ id: String(agentId), text: 'In a hand', gold: false });
      return;
    }

    // The door is where the OWNER is going, with the man in his hand. CASINO-1:
    // a deploy is decided in the building, so this hands him over rather than
    // opening a socket from the living room — the same thing a want's yes does.
    if (fixture === 'door') { onDeploy?.(agent, { room: null }); return; }

    const res = await placeAgent(agentId, fixture);
    // His line, when the server sends one — a refusal has one, and so does a
    // snack. `unsupported` is the pre-SERVER-5 answer for a fixture with no
    // route of its own: nothing happened, so nothing is claimed.
    if (res.line) setSaidOnDrop({ id: String(agentId), text: res.line, gold: !res.ok });
    if (res.ok) refresh();
  }, [home, positions, game, onDeploy, refresh]);

  const { carry, bind: bindCarry } = useCarry({
    roomEl: flatEl,
    onDrop,
    enabled: !desktop,
  });

  // The line clears itself; it lands once, the way the money line does.
  useEffect(() => {
    if (!saidOnDrop) return undefined;
    const t = setTimeout(() => setSaidOnDrop(null), ARRIVAL_MS);
    return () => clearTimeout(t);
  }, [saidOnDrop]);

  // Who the thread band is pointed at. An agent with something to say outranks
  // whoever happens to be first: an unread recap is the reason he is standing by
  // the door, and a want is a question waiting on an answer.
  const focus = useMemo(() => {
    if (focusId) {
      const picked = agents.find((a) => String(a.id) === String(focusId));
      if (picked) return picked;
    }
    return home.find((a) => a.want) ?? home.find((a) => a.unseenRecap) ?? home[0] ?? agents[0] ?? null;
  }, [focusId, agents, home]);

  const wanting = home.find((a) => a.want) ?? null;

  const onAnswered = useCallback((agentId, answer, body) => {
    clearWant(agentId);
    if (body) refresh();
  }, [clearWant, refresh]);

  const onNeeds = useCallback((needs, { agent, room }) => {
    if (needs === 'deploy') onDeploy?.(agent, { room });
    else if (needs === 'fund') onOpenWallet?.(agent);
    else if (needs === 'thread') { setFocusId(agent.id); setThreadOpen(true); }
  }, [onDeploy, onOpenWallet]);

  // Tapping a body opens HIS THREAD — the screen, not the band. CASINO-1 took
  // CHATS off the tab bar on the promise that the thread is reached from Home
  // and from a profile, and the man himself is the obvious way to reach it.
  //
  // The band below is the other thing, and it is not the same thing: one line
  // and a composer for whoever the room is pointed at, expanding to a sheet
  // over the room. Quick word here, whole conversation there.
  const tapAgent = useCallback((agent) => {
    setFocusId(agent.id);
    // DESK-2: on the desk the rail IS the thread, so the man swaps what is in
    // it rather than opening a screen on top of the room he is standing in.
    if (desktop) { setRail('agent'); return; }
    if (onOpenThread) onOpenThread(agent);
    else setThreadOpen(true);
  }, [onOpenThread, desktop]);

  // BUGS-A job 2 · THE ROOM IS THE DEFAULT, NOT THE EMPTY STATE.
  //
  // "Nobody lives here yet" is a claim about the owner, and the screen used to
  // make it out of an empty array it had not yet been given a reason to
  // believe. Every trip back to HOME — from the casino, from a profile, from a
  // retire with three agents left — remounts this screen with agents=[] for as
  // long as the round trip takes, and for that beat the app told a man with a
  // household that he had nobody.
  //
  // The room renders while the roster is in flight. It is the honest picture:
  // the flat is there whether or not anybody is standing in it, and bodies
  // walking in a moment later is exactly what this screen already does. The
  // empty state waits for the roster to ANSWER, and to answer with zero.
  if (loaded && agents.length === 0) {
    return (
      <div className={`home1${desktop ? ' home1--desk home1--empty' : ''}`} data-testid="home-screen">
        <NotYet
          fact="Nobody lives here yet."
          voice="Make one and he moves in."
          fills={
            <button type="button" className="home1__ftu-action" onClick={onCreateAgent}>
              Make an agent
            </button>
          }
        />
      </div>
    );
  }

  const lit = home.length > 0;
  const board = homeTable?.game?.community ?? [];
  // P16: a fixture panel dims the room instead of covering it — on the desk you
  // never lose sight of where the money is.
  const dimmed = desktop && rail !== 'thread' && rail !== 'agent';

  const flat = (
    <HomeFlat
      lit={lit}
      onSafe={desktop ? () => setRail('safe') : () => onOpenWallet?.(null)}
      onFridge={desktop ? () => setRail('fridge') : () => setFridgeOpen(true)}
      // Never on the desk: DeskHome keeps the casino a rail away and a door
      // that navigated out of the room would take the rail with it.
      onDoor={!desktop && onCasino ? () => onCasino() : undefined}
      // THE TABLE HAS ONE DESTINATION, and it is the sheet.
      //
      // Three trees wanted this tap and all three are now sections of the sheet
      // board 31 P17 draws — "three labelled sections with a button each, no
      // hidden taps anywhere":
      //
      //   BUGS-A job 7  a kitchen table with a game ON it is a table you can go
      //                 and watch. Still true; it is the WATCH section.
      //   BIRTH-5       the chairs are priced in one place only, the TableSheet.
      //   SIT-1         you can take a chair at it yourself.
      //
      // It used to fork here: a running game watched, an empty table opened the
      // sheet. That made the sheet unreachable for exactly as long as a game was
      // running — which is exactly when SIT-1's free chair is worth having, and
      // is why the fork had to go rather than grow a third branch. The desk has
      // always opened the rail panel from this tap; the phone now agrees with it.
      onTable={desktop ? () => setRail('table') : () => setTableOpen(true)}
      tableLabel={game?.state === 'running' ? 'The table' : 'The chairs'}
      // The tape room is a man doing something, so on the desk it opens HIM in
      // the rail — the same place tapping his body puts him. With nobody
      // studying the set is showing the casino, so it is a second door into it.
      onTv={studying ? (
        desktop
          ? () => { setFocusId(studying.id); setRail('agent'); }
          : () => onProfile?.(studying)
      ) : (!desktop && onCasino ? () => onCasino() : undefined)}
      tvLabel={studying ? `${studying.name} is watching a hand back` : null}
      // HOME-2 job 4 · WHAT IS ON THE SET. A hand being reviewed if somebody is
      // reviewing one — the ref's own `tape` state — and otherwise the casino:
      // his table in miniature when one of yours is in a hand, the board when
      // none is. Drawing a felt nobody is sitting at would be the one outright
      // lie on the screen.
      tvScreen={studying ? <TapeOnTv /> : <CasinoOnTv away={away} />}
    >
      <AwayWall
        away={away}
        accentFor={(a) => accentFor(a, agents.indexOf(a))}
        hooks={Math.max(0, AGENT_CAP - agents.length)}
        onWatch={onWatch}
      />

      {gameAgentIds.length > 0 ? (
        <HomeGameTable board={board} seatCount={gameAgentIds.length} running />
      ) : (
        <HomeGameTable board={[]} seatCount={0} running={false} />
      )}

      {home.map((agent) => {
        const at = positions.get(String(agent.id));
        if (!at) return null;
        const id = String(agent.id);
        const seated = at.seat !== null && at.seat !== undefined;
        const size = seated ? 50 : 46;
        const held = carry?.id === id ? carry : null;
        // HOME-2 job 5 · HIS LINE, WHEN HE IS IN YOUR HAND.
        //
        // Three sources, in the order they stop being true. What he SAID when
        // you put him down is the newest thing in the room and outranks
        // everything. Then, while he is held, the line he already has —
        // FIX-6's queue lets at most two men speak at once, and the man in
        // your hand is not waiting his turn behind anybody. That is what "his
        // line if worn or hot" is: a worn man's want IS "I am done for
        // tonight" and a hot one's IS "let me back in there" (the ref phrases
        // every want from state), so holding him shows the line he already
        // had rather than a sentence this screen made up for him.
        const dropped = saidOnDrop?.id === id ? saidOnDrop : null;
        const own = speakers.find((sp) => sp.id === id);
        const bubble = dropped
          ? { text: dropped.text, gold: dropped.gold, side: bubbleSide(held?.x ?? at.x) }
          : (held && own)
            ? { text: own.text, gold: own.gold, side: bubbleSide(held.x) }
            : (bubbles.get(id) ?? null);
        return (
          <HomeOne
            key={agent.id}
            agent={agent}
            at={at}
            identity={identities.get(id) ?? null}
            accent={accentFor(agent, agents.indexOf(agent))}
            size={size}
            dealt={seated && !held}
            walking={walking.has(id)}
            carried={held}
            carryHandlers={bindCarry(id, { size })}
            // The queue's answer, or nothing — and the pill still says he has
            // news while his turn is coming.
            bubble={bubble}
            news={!!(agent.want || agent.unseenRecap)}
            onClick={() => tapAgent(agent)}
          />
        );
      })}
    </HomeFlat>
  );

  const roomBox = (
    <div
      className="home1__room"
      ref={setRoomEl}
      style={desktop
        ? { '--home-desk-scale': deskScale }
        : { aspectRatio: `${F_W} / ${F_H}` }}
      data-dim={dimmed ? 'true' : 'false'}
    >
      <div className="home1__scale" style={{ width: F_W, height: F_H }} ref={setFlatEl}>
        {flat}
      </div>
    </div>
  );

  // DESK-2 — the room, and the rail. The rail's CONTENT is the caller's (see the
  // header: one reader of the household), and everything it could need is handed
  // to it here rather than fetched again beside it.
  if (desktop) {
    return (
      <div className="home1 home1--desk" data-testid="home-screen">
        {roomBox}
        {rail === 'none' ? null : (
        <div className="home1__rail" data-testid="home-rail" data-panel={rail}>
          {renderRail?.({
            panel: rail,
            openPanel: setRail,
            // Point the rail at a man. The rail's own panels need this — the
            // standup's roster rows are the other way into a thread, and
            // `focus` below is derived from it.
            setFocus: (agent) => { setFocusId(agent?.id ?? null); setRail('agent'); },
            agents,
            home,
            away,
            game,
            focus,
            wanting,
            refresh,
            toast: wanting ? (
              <WantToast agent={wanting} onAnswered={onAnswered} onNeeds={onNeeds} />
            ) : null,
          })}
        </div>
        )}
      </div>
    );
  }

  return (
    <div className="home1" data-testid="home-screen">
      {roomBox}

      <HomeThread
        agent={focus}
        open={threadOpen}
        onToggle={setThreadOpen}
        onSend={onSend}
        sending={sending}
        toast={wanting ? (
          <WantToast agent={wanting} onAnswered={onAnswered} onNeeds={onNeeds} />
        ) : null}
      />

      {fridgeOpen ? (
        <FridgeSheet
          agents={home}
          onClose={() => setFridgeOpen(false)}
          onGiven={() => refresh()}
        />
      ) : null}

      {/* BIRTH-5 · the table, and the price of the next chair at it. The SAME
          TableSheet the desk raises in its rail (DESK-2) — one surface prices a
          chair, and the phone puts it in the chrome the fridge already uses
          rather than growing a second copy of it. */}
      {tableOpen ? (
        <MobileTableSheet
          seated={gameAgentIds.length}
          onClose={() => setTableOpen(false)}
          onDraft={onCreateAgent ? () => { setTableOpen(false); onCreateAgent(); } : undefined}
          // SIT-1 · only when there is a game to sit down at. A kitchen table
          // that is not standing (nobody home, or the household cooling down
          // after the hand cap) has no chair to pull up, and a SIT DOWN that
          // stood one up would be a second way to start a home game — see
          // homeGame.js, where sync() is the only one.
          onSit={onSitTable && game?.state === 'running' && game?.tableId
            ? () => { setTableOpen(false); onSitTable(game.tableId); }
            : undefined}
          // BUGS-A job 7's promise, one tap deeper: the game that is on is
          // still a game you can go and watch.
          onWatch={onWatchTable && game?.state === 'running' && game?.tableId
            ? () => { setTableOpen(false); onWatchTable(game.tableId); }
            : undefined}
        />
      ) : null}
    </div>
  );
}

/**
 * BIRTH-5 — the table sheet, in the phone's chrome.
 *
 * The sheet itself is DESK-2's, unchanged: one surface prices a chair and there
 * is no second copy of it. What differs is the frame around it — a scrim and a
 * panel over the room here, a rail panel there — and where the read happens.
 * useSlots lives inside this component rather than in HomeScreen so the GET is
 * paid when the sheet is opened, not on every mount of a screen most owners
 * never open it from.
 */
function MobileTableSheet({ seated = 0, onClose, onDraft, onSit, onWatch }) {
  const { slots } = useSlots();
  return (
    <div className="home-sheet" role="dialog" aria-label="The table" data-testid="home-table-sheet-mobile">
      <button type="button" className="home-sheet__scrim" onClick={onClose} aria-label="Close" />
      <div className="home-sheet__panel">
        <div className="home-sheet__head">
          <span className="home-sheet__title">The table</span>
          <button type="button" className="home-sheet__close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <TableSheet slots={slots} seated={seated} onDraft={onDraft} onSit={onSit} onWatch={onWatch} />
      </div>
    </div>
  );
}

/**
 * "+$2,740" — the one number that rides home with him.
 *
 * lib/wallet.js's own formatter, not a second one: it already groups by hand
 * (toLocaleString returns a NARROW NO-BREAK SPACE instead of a comma under
 * several ordinary locales, so the same session read "+$2 740" for some owners)
 * and it already uses U+2212 for the minus, which aligns with the digits. One
 * money format in the product.
 */
export function moneyLine(arrival) {
  if (!arrival) return null;
  return signedMoney(Number(arrival.net) || 0);
}

export { HomeBubble };
