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
import { HomeThread } from '../components/home/HomeThread.jsx';
import { WantToast } from '../components/home/WantToast.jsx';
import { FridgeSheet } from '../components/home/FridgeSheet.jsx';
import { homePositions, F_W, F_H } from '../components/home/flat.js';
import { routineKeyOf } from '../components/home/routines.js';
import { accentFor } from '../components/floor/atoms.jsx';
import { NotYet } from '../components/ftu/NotYet.jsx';
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
  onProfile,
  onDeploy,
  onCreateAgent,
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
}) {
  const { agents, home, away, game, arrival, clearArrival, refresh, clearWant } =
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
  const rail = panel ?? railLocal;
  const setRail = onPanel ?? setRailLocal;

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

  const positions = useMemo(
    () => homePositions(agents, { gameAgentIds }),
    [agents, gameAgentIds],
  );
  const walking = useWalks(positions);

  const studying = home.find((a) => routineKeyOf(a) === 'tape') ?? null;
  const studyBook = useStudyBook(studying?.id ?? null);
  const tag = studyTag(studyBook);

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

  if (agents.length === 0) {
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
      // The chairs are priced in one place only and the phone has nowhere to
      // put that sheet yet, so the table is furniture there — see HomeFlat.
      onTable={desktop ? () => setRail('table') : undefined}
      onTv={studying ? (
        // The tape room is a man doing something, so on the desk it opens HIM
        // in the rail — the same place tapping his body puts him.
        desktop
          ? () => { setFocusId(studying.id); setRail('agent'); }
          : () => onProfile?.(studying)
      ) : undefined}
      tvLabel={studying ? `${studying.name} is watching a hand back` : null}
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

      {/* the tape room: what he is watching is on the television */}
      {studying ? (
        <span className="home1__tape" data-testid="home-tape">
          {[0, 1, 2].map((i) => <i key={i} style={{ animationDelay: `${i * 0.45}s` }} />)}
        </span>
      ) : null}

      {home.map((agent) => {
        const at = positions.get(String(agent.id));
        if (!at) return null;
        const seated = at.seat !== null && at.seat !== undefined;
        const isStudying = studying && studying.id === agent.id;
        const landed = arrival && arrival.agentId === String(agent.id);
        return (
          <HomeOne
            key={agent.id}
            agent={agent}
            at={at}
            accent={accentFor(agent, agents.indexOf(agent))}
            size={seated ? 50 : 46}
            dealt={seated}
            walking={walking.has(String(agent.id))}
            news={agent.want ? agent.want.text : (agent.unseenRecap ? agent.sessionRecap?.text : null)}
            says={landed ? moneyLine(arrival) : (isStudying && tag ? tag : null)}
            onClick={() => tapAgent(agent)}
          />
        );
      })}
    </HomeFlat>
  );

  const roomBox = (
    <div
      className="home1__room"
      style={desktop ? undefined : { aspectRatio: `${F_W} / ${F_H}` }}
      data-dim={dimmed ? 'true' : 'false'}
    >
      <div className="home1__scale" style={{ width: F_W, height: F_H }}>
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
