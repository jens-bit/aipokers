import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTable } from './hooks/useTable.js';
import { usePacedTable } from './hooks/usePacedTable.js';
import { useDeepLink } from './hooks/useDeepLink.js';
import { useHomeThread } from './hooks/useHomeThread.js';
import { resolveDeepLink } from './lib/deeplink.js';
import { Header } from './components/Header.jsx';
import { RosterSheet } from './components/RosterSheet.jsx';
import { WatchScreen } from './components/WatchScreen.jsx';
import { CasinoFloor } from './components/floor/CasinoFloor.jsx';
import { AgentsTab } from './components/AgentsTab.jsx';
import { AgentChat } from './components/AgentChat.jsx';
import { getTelegramDisplayName, getTelegramInitData, getUserId, initViewportTracking } from './lib/telegram.js';
import { PlayerSeat } from './components/PlayerSeat.jsx';
import { TableSeat } from './components/TableSeat.jsx';
import { Card } from './components/Card.jsx';
import { ActionBar } from './components/ActionBar.jsx';
import { ChatBar } from './components/ChatBar.jsx';
import { HistoryDrawer } from './components/HistoryDrawer.jsx';
import { HistoryTab } from './components/HistoryTab.jsx';
import { HandHistory } from './components/HandHistory.jsx';
import { AnalysisPanel } from './components/AnalysisPanel.jsx';
import { DesktopHome } from './components/desktop/DesktopHome.jsx';
import { useIsDesktop } from './hooks/useIsDesktop.js';
import { Streets } from './lib/protocol.js';
import { AgentThread } from './screens/ChatsScreen.jsx';
import { HomeScreen } from './screens/HomeScreen.jsx';
import { YouScreen } from './screens/YouScreen.jsx';
import { BirthScreen } from './screens/BirthScreen.jsx';
import { AgentProfileScreen } from './screens/AgentProfileScreen.jsx';
import { CasinoScreen } from './screens/CasinoScreen.jsx';
import { ReplayTheatre } from './components/replay/ReplayTheatre.jsx';
import { rowsFromThread } from './lib/thread.js';

function resolveWsUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (import.meta.env.DEV) return `${proto}//${window.location.hostname}:8765`;
  return `${proto}//${window.location.host}`;
}
const WS_URL = resolveWsUrl();

// SIT-1 — what the owner sits down with at his own kitchen table.
//
// The server's own numbers (HOME_BLINDS and HOME_BUYIN in src/server/homeGame.js),
// restated here because the client must not import server code and the home
// game's shape does not ride on the wire. They matter for exactly one thing:
// the JOIN. `seatPlayer` refuses a buy-in under ten big blinds, and a table
// where the owner sits down with a different stack from the agents already at
// it is not the same game they are playing.
//
// It is still no money. The home game credits nobody and debits nobody — these
// are nominal chips on a table that is in no room and on no rung of the wallet
// ladder — which is why nothing here touches the pocket.
const HOME_SIT = Object.freeze({ smallBlind: 1, bigBlind: 2, buyIn: 200 });

function agentHandsApiUrl(agentId) {
  return `/api/agents/${encodeURIComponent(agentId)}/hands?userId=${encodeURIComponent(getUserId())}`;
}

export default function App() {
  const table = useTable({ wsUrl: WS_URL });
  const {
    game, mySeat, legalActions, history,
    error, dismissError, status,
    reconnectAttempt, maxReconnectAttempts,
    config, connect, watch, disconnect, act, deal, rename,
    chatMessages, sendChat,
    sitOut,
    lastDecision,
    paceFrame,
    // WATCH-9: the thread lines the server has pushed on this socket, handed to
    // whichever surface is showing the thread.
    threadLines,
  } = table;
  // WATCH-5 (W5-1): the felt is played back, not mirrored. Every snapshot the
  // socket delivers goes through the pacing queue, which lets no two actions
  // land closer together than the beat in lib/pace.js. The four fields travel
  // as one bundle so a line of table talk can never appear before the action it
  // was said about. The live stream is still what the ActionBar and the legacy
  // table read — pacing is for watching, and a player must never wait to see
  // his own seat.
  const paced = usePacedTable({ game, lastDecision, paceFrame, chatMessages });

  const displayNames = useMemo(() => {
    const names = {};
    (game?.seats || []).forEach((seat, index) => {
      names[index] = seat?.displayName ?? `Seat ${index + 1}`;
    });
    return names;
  }, [game?.seats]);

  useEffect(() => initViewportTracking(), []);

  const [historyOpen, setHistoryOpen] = useState(false);
  // CASINO-1: the nav is HOME · CASINO · YOU. 'casino' is the building, board
  // 27. 'chats' is still a tab VALUE and still renders its screen; it is just
  // no longer a button in the bar, because the thread is reached from Home and
  // from a profile.
  //
  // HOME-1: and 'home' is now the flat, board 29 — the room your agents live
  // in, which is what CASINO-1 left the floor standing in for. The floor
  // answered "who is playing"; the room answers "where is everybody", which is
  // the screen this product is.
  const [activeTab, setActiveTab] = useState('home');
  const [playInitialStep, setPlayInitialStep] = useState('pick');
  const [playKey, setPlayKey] = useState(0);
  const [activeAgentId, setActiveAgentId] = useState(null);
  const activeAgentIdRef = useRef(null); // stable ref avoids stale-closure in handleLeave
  const [editingAgent, setEditingAgent] = useState(null); // full agent object for CHAT editing
  const [agentChatTarget, setAgentChatTarget] = useState(null);
  const [agentProfileTarget, setAgentProfileTarget] = useState(null);
  const [isCreating, setIsCreating]       = useState(false);
  const [newlyBornAgent, setNewlyBornAgent] = useState(null);
  const [lastAgentHand, setLastAgentHand] = useState(null);
  const [lastAgentHandOpen, setLastAgentHandOpen] = useState(false);
  const lastResultKeyRef = useRef(null);
  const isDesktop = useIsDesktop();
  const [desktopWatchAgent, setDesktopWatchAgent] = useState(null);
  // CLEAN-1: who is being watched, as the roster knows him. The socket config
  // carries only an id and a display name, and a thread is a person — so the
  // agent that started the watch is kept for as long as the watch lasts.
  const [watchedAgent, setWatchedAgent] = useState(null);

  // CHAT-2 item 4: where the owner was standing when the watch started, so
  // leaving the table puts him back there. Deploying from a thread used to
  // clear that thread on the way to the socket, so watching one hand cost you
  // the conversation you were having — you came back to the roster, or to the
  // floor. A ref, not state: nothing renders from it, and handleLeave is a
  // useCallback that must never read a stale copy.
  //
  // No deploy path clears the nav state today, so on paper the restore below
  // is a no-op. It is here anyway because that is an accident of five call
  // sites rather than a rule, and this makes it one: App.test.jsx proves the
  // return still holds when a deploy path does drop the open thread.
  const watchOriginRef = useRef(null);

  // CASINO-1: who you walked into the casino to place, and where you were
  // standing when you decided to. Home and the profile no longer POST a deploy
  // themselves — they hand the agent to the building, which is where the room
  // and the buy-in are chosen. The origin travels with him so CHAT-2 still
  // holds: leaving the felt afterwards returns you to the thread you were in,
  // not to the casino you passed through.
  const [deployTarget, setDeployTarget] = useState(null);
  // Where "here" is at the instant a watch begins. The profile is an overlay
  // over whichever tab opened it, so this answers the floor for a profile
  // opened from the floor and the thread for one opened from a thread —
  // without either call site having to know which.
  const hereOrigin = () => ({ tab: activeTab, chatAgent: agentChatTarget });

  function placeInCasino(agent) {
    if (!agent) return;
    setDeployTarget({ agent, origin: hereOrigin() });
    setAgentProfileTarget(null);
    setAgentChatTarget(null);
    setActiveTab('casino');
  }

  function setActiveAgent(id, agent = null) {
    activeAgentIdRef.current = id;
    setActiveAgentId(id);
    setWatchedAgent(agent);
  }

  // YOU-2 — YOU is a summary now and the money is a sheet behind it. An owner
  // who was sent to YOU *to deal with money* must not land one tap short of it,
  // so the intent travels with the navigation. Ordinary tab navigation clears
  // it, which is what keeps the sheet from reopening every time he comes back.
  const [youMoneyOpen, setYouMoneyOpen] = useState(false);

  // BUGS-A job 9: the roster, behind the top-right avatar. A sheet over
  // whatever tab is showing rather than a tab of its own — CASINO-1's nav is
  // HOME · CASINO · YOU and this is not a fourth place, it is a list you pull
  // down to find somebody.
  const [rosterOpen, setRosterOpen] = useState(false);

  // BIRTH-5 — the same trick for the table. An owner turned away from a locked
  // seat is sent to HOME *to look at the table*, and the table sheet is where
  // the ladder is written. Ordinary navigation clears it for the same reason.
  //
  // A COUNTER rather than a flag, which `youMoneyOpen` above can afford to be:
  // the refusal that raises this is repeatable — say "lets go" again and you are
  // turned away again — and a boolean that is already true is not a new intent,
  // so the second ask would open nothing. Zero is "no intent"; every ask is a
  // value the screens below have not seen before.
  const [homeTableOpen, setHomeTableOpen] = useState(0);

  function navigateTo(tab) {
    setActiveTab(tab);
    setAgentChatTarget(null);
    setYouMoneyOpen(false);
    setHomeTableOpen(0);
  }

  function navigateToMoney() {
    setActiveTab('you');
    setAgentChatTarget(null);
    setYouMoneyOpen(true);
  }

  // BIRTH-5: out of the birth flow and into the room, with the table sheet
  // already up. The draft on the server is untouched by the refusal, so this is
  // a look at the price rather than an exit from the conversation.
  function navigateToTable() {
    setIsCreating(false);
    setActiveTab('home');
    setAgentChatTarget(null);
    setYouMoneyOpen(false);
    setHomeTableOpen((n) => n + 1);
  }

  // BUGS-A job 4 · WHERE BACK GOES.
  //
  // Back out of a thread used to land on the CHATS list, which by CASINO-1 is
  // not a place anybody navigated FROM — the thread is reached from the room,
  // from a profile, from a notification, from the watch screen. Backing out of
  // it put the owner somewhere he had never been, and the way out of THAT was
  // the tab bar. So the thread remembers the door it came in by.
  //
  // A ref, not state: nothing renders from it, and it is read inside handlers
  // that must never see a stale copy.
  const chatOriginRef = useRef(null);

  function openAgentChat(agent, origin = null) {
    chatOriginRef.current = origin ?? { tab: activeTab, profileAgent: null };
    setAgentChatTarget(agent);
    setActiveTab('chats');
  }

  /** Back out of a thread, to the door it was opened by. */
  function closeAgentChat() {
    const origin = chatOriginRef.current;
    chatOriginRef.current = null;
    setAgentChatTarget(null);
    setActiveTab(origin?.tab && origin.tab !== 'chats' ? origin.tab : 'home');
    // A thread opened FROM a profile goes back to that profile, which is the
    // overlay the owner was reading when he tapped Chat.
    if (origin?.profileAgent) setAgentProfileTarget(origin.profileAgent);
  }

  function openAgentProfile(agent) {
    setAgentProfileTarget(agent);
  }

  // HOME-1: the room's composer. Same endpoint the CHATS thread uses — one way
  // to say something to an agent, and the SERVER writes the row. Nothing here
  // inserts a line into the thread; HomeThread reloads it and reads what was
  // actually stored.
  async function sendToAgent(agent, text) {
    if (!agent?.id || !text) return null;
    try {
      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTelegramInitData() },
        body: JSON.stringify({ userId: getUserId(), content: text, existingAgentId: agent.id }),
      });
      return res.ok ? res.json() : null;
    } catch {
      return null;
    }
  }

  // ── DEEPLINK-1 · the other end of every link the bot sends ─────────────────
  //
  // NOTIFY puts `?startapp=agent_<id>` under every inline button and SHARE puts
  // `?startapp=hand_<agentId>_<handId>` under every card. Those links have been
  // going out since NOTIFY-1; until now they all landed on the home screen,
  // which makes a message about one hand indistinguishable from a message about
  // nothing. Three params, three destinations: his thread, that hand in the
  // theatre, that table being watched.
  //
  // Resolution is the lib's (client/src/lib/deeplink.js) — it is what fetches
  // the agent and the hand. This only decides where the app stands afterwards.
  const [deepLinkHand, setDeepLinkHand] = useState(null);

  const watchTable = useCallback((tableId, agent) => {
    if (!tableId) return;
    setActiveAgent(agent?.id ?? null, agent ?? null);
    watch({
      tableId,
      agentId: agent?.id ?? null,
      userId: getUserId(),
      agentStrategy: agent?.strategy ?? null,
      displayName: agent?.name || getTelegramDisplayName() || 'Agent',
      wantOpponentAI: false,
      // A watcher who arrived by link is not deploying him, so there is no
      // memory to carry in — the table already has his.
      memoryContext: '',
    });
  // setActiveAgent is a plain function over a ref and two setStates; `watch`
  // is the only value under here that can change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch]);

  // ── SIT-1 · you take a chair at your own kitchen table ────────────────────
  //
  // The one place in the product where the owner JOINS rather than WATCHes.
  // Everything else he opens a socket for, he opens as a spectator; here he is
  // a player, which is what makes the four verbs real and what makes the felt
  // hand him his own two cards face up.
  //
  // `sitting` is the marker the render reads. `isSpectator` would have been the
  // lazy way to reuse the mobile WatchScreen branch and it would have been a
  // lie — a spectator cannot act, and handleLeave treats the two differently
  // (it calls /finish for a player's agent, which is exactly what must NOT
  // happen here: nobody's session ends because you stood up from your own
  // kitchen table).
  const sitTable = useCallback((tableId) => {
    if (!tableId) return;
    watchOriginRef.current = hereOrigin();
    setActiveAgent(null, null);
    connect({
      tableId,
      userId: getUserId(),
      displayName: getTelegramDisplayName() || 'You',
      buyIn: HOME_SIT.buyIn,
      smallBlind: HOME_SIT.smallBlind,
      bigBlind: HOME_SIT.bigBlind,
      // No opponent is wanted: the household is already at the table. wantAI
      // would seat a fifth body at a four-seat table.
      wantAI: false,
      sitting: true,
    });
  // setActiveAgent is a plain function over a ref and two setStates, and
  // hereOrigin reads state at call time; `connect` is the only value under here
  // that can change identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect]);

  // THREAD-2's room thread, read only while he is sitting at it. The kitchen
  // table has no single agent whose stay the felt's own thread could be, so the
  // sheet behind the Chat button is the ROOM's day — the same one the desk rail
  // shows. `enabled` keeps the GET off every other screen in the app.
  const sitting = !!config?.sitting;
  const homeRoom = useHomeThread({ enabled: sitting });
  const homeThreadRows = useMemo(
    () => (sitting ? rowsFromThread({ lines: homeRoom.lines }) : null),
    [sitting, homeRoom.lines],
  );

  useDeepLink((route) => {
    resolveDeepLink(route)
      .then((opened) => {
        if (!opened) return;
        if (opened.kind === 'hand') {
          setDeepLinkHand(opened);
          return;
        }
        setDeepLinkHand(null);
        if (opened.kind === 'table') {
          watchTable(opened.tableId, opened.agent);
        } else {
          // `agent` also covers the hand that can no longer be replayed: the
          // link still lands on the agent it was about.
          //
          // Nothing here disconnects. A link that arrives while the owner is
          // at a table sets where he stands and is seen when he leaves it —
          // pulling a player out of a hand he is in the middle of is a worse
          // answer than a thread that is already open when he gets back.
          setAgentProfileTarget(null);
          openAgentChat(opened.agent);
        }
      })
      .catch(() => { /* a link that resolves to nothing leaves the app where it was */ });
  });

  const callAgentFinish = useCallback((agentId) => {
    if (!agentId) return;
    fetch(`/api/agents/${agentId}/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getUserId() }),
    }).catch(() => {});
    activeAgentIdRef.current = null;
    setActiveAgentId(null);
  }, []);

  const loadLatestAgentHand = useCallback(async (agentId) => {
    if (!agentId) return;
    try {
      const res = await fetch(agentHandsApiUrl(agentId));
      if (!res.ok) throw new Error('hands request failed');
      const data = await res.json();
      const hand = data.recentHands?.[0] || null;
      if (hand?.decisions?.length) {
        setLastAgentHand(hand);
        setLastAgentHandOpen(true);
      } else {
        setLastAgentHand(null);
      }
    } catch {
      setLastAgentHand(null);
    }
  }, []);

  useEffect(() => {
    if (activeAgentId && status === 'closed' && !isSpectatorRef.current) callAgentFinish(activeAgentId);
  }, [status, activeAgentId, callAgentFinish]);

  useEffect(() => {
    setLastAgentHand(null);
    setLastAgentHandOpen(false);
    lastResultKeyRef.current = null;
  }, [activeAgentId]);

  // ── Seat-level countdown timer (replaces ActionBar's horizontal bar) ────────
  const TIMER_TOTAL = 15;
  const [timerLeft, setTimerLeft] = useState(TIMER_TOTAL);
  const timerFiredRef = useRef(false);
  const actRef = useRef(act);
  useEffect(() => { actRef.current = act; });

  const handIsActive = !!game && game.toAct !== null &&
    game.street !== Streets.COMPLETE && game.street !== Streets.WAITING;
  const isMyTurn = handIsActive && game.toAct === mySeat;
  const timerKey = `${game?.handNumber ?? 0}-${game?.toAct ?? -1}`;

  // Reset to full duration whenever the acting seat changes
  useEffect(() => {
    setTimerLeft(TIMER_TOTAL);
    timerFiredRef.current = false;
  }, [timerKey]);

  // Tick down while a hand is active (shows countdown for whichever seat is acting)
  useEffect(() => {
    if (!handIsActive) return;
    const id = setInterval(() => setTimerLeft((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(id);
  }, [handIsActive, timerKey]);

  // Auto-act when the timer hits 0 on the human player's turn.
  //
  // SIT-1 · AT THE KITCHEN TABLE IT CHECKS IF IT CAN. Board 29, 52·Y2, states
  // the rule in as many words — "timeout checks if it can and folds if it
  // cannot; either way you are dealt in next hand" — and SitStrip prints it on
  // the strip, so a timeout that always folded made the screen's own sentence
  // untrue. Throwing away a free look at the turn is also not what a man who
  // put his phone down meant to do.
  //
  // Only at home. In the casino a timeout is a fold and stays one: that table
  // is somebody else's money and its own tree; changing what a lapsed clock
  // does there is not this tree's to decide.
  useEffect(() => {
    if (!isMyTurn || timerLeft !== 0 || timerFiredRef.current) return;
    timerFiredRef.current = true;
    const canCheck = config?.sitting
      && (legalActions ?? []).some((a) => a && a.type === 'check');
    actRef.current?.({ type: canCheck ? 'check' : 'fold' });
  }, [timerLeft, isMyTurn]);

  // Closing the spectator view means "stop watching", not "recall the agent".
  // POSTing /finish here reset status to idle and cleared activeTableId while
  // the table was still running, so the casino floor showed a deployed agent
  // resting at the bar. The agent is retired by the table-closed effect above
  // instead, which is the genuine end of its session.
  const isSpectatorRef = useRef(false);
  useEffect(() => { isSpectatorRef.current = !!config?.isSpectator; }, [config]);

  const handleLeave = useCallback(() => {
    if (!isSpectatorRef.current) {
      callAgentFinish(activeAgentIdRef.current); // use ref — never stale
    }
    setDesktopWatchAgent(null);
    disconnect();
    // CHAT-2 item 4. Spent on use: a second leave with no watch behind it must
    // not teleport anyone. The tab bar and "Chat" both run this and then
    // navigate themselves, so an explicit destination still wins.
    const origin = watchOriginRef.current;
    watchOriginRef.current = null;
    if (origin) {
      setActiveTab(origin.tab);
      setAgentChatTarget(origin.chatAgent ?? null);
    }
  }, [disconnect, callAgentFinish]);

  const buyInRef = useRef(null);
  useEffect(() => {
    if (config && buyInRef.current == null) buyInRef.current = config.buyIn;
    if (!config) buyInRef.current = null;
  }, [config]);

  useEffect(() => { if (!config) setHistoryOpen(false); }, [config]);

  useEffect(() => {
    if (!config?.isSpectator || !activeAgentId) return;
    const latestResult = findLatestResult(history);
    if (!latestResult) return;

    const key = `${latestResult.handNumber}:${JSON.stringify(latestResult.result)}`;
    if (lastResultKeyRef.current === key) return;
    lastResultKeyRef.current = key;
    loadLatestAgentHand(activeAgentId);
  }, [history, config?.isSpectator, activeAgentId, loadLatestAgentHand]);

  // DEEPLINK-1: a shared hand opens as the theatre and nothing else, on the
  // desk as on a phone. The link is about one hand; Back from it lands on the
  // thread of the agent who played it, which is where the message came from.
  if (deepLinkHand) {
    return (
      <div className="app">
        <ReplayTheatre
          hand={deepLinkHand.hand}
          agentId={deepLinkHand.agent?.id ?? null}
          onBack={() => {
            const agent = deepLinkHand.agent;
            setDeepLinkHand(null);
            if (agent) openAgentChat(agent);
          }}
        />
      </div>
    );
  }

  if (isDesktop) {
    const watchPayload = (payload, agent) => {
      setDesktopWatchAgent(agent || null);
      setActiveAgent(payload.agentId, agent || null);
      watch({
        tableId: payload.tableId,
        agentId: payload.agentId,
        userId: getUserId(),
        agentStrategy: payload.strategy,
        displayName: payload.agentName || getTelegramDisplayName() || 'Agent',
        wantOpponentAI: false,
        memoryContext: payload.memoryContext ?? '',
      });
    };

    return (
      <DesktopHome
        game={game}
        lastDecision={lastDecision}
        // WATCH-8: the socket's own status, so the desk's rail refetches the
        // stored thread when the connection comes back.
        connection={status}
        threadLines={threadLines}
        onSitOut={sitOut}
        watchingAgent={desktopWatchAgent}
        isWatching={!!config?.isSpectator}
        onWatchAgent={async (agent) => {
          if (!agent?.activeTableId) return;
          let memoryContext = '';
          try {
            const res = await fetch(
              `/api/agents/${agent.id}/memory?userId=${getUserId()}`,
              { headers: { 'x-telegram-init-data': getTelegramInitData() } },
            );
            if (res.ok) memoryContext = (await res.json()).memoryContext || '';
          } catch { /* watch with empty context */ }
          watchPayload({
            tableId: agent.activeTableId,
            agentId: agent.id,
            agentName: agent.name,
            strategy: agent.strategy,
            memoryContext,
          }, agent);
        }}
        // CASINO-1: the desk deploys from the building too — the stage
        // swaps to the casino with him in the tray.
        onDeployAgent={placeInCasino}
        wsUrl={WS_URL}
        deployAgent={deployTarget?.agent ?? null}
        onCancelDeploy={() => setDeployTarget(null)}
        onSpectate={(tableId) => {
          if (!tableId) return;
          setDesktopWatchAgent(null);
          setActiveAgent(null, null);
          watch({
            tableId,
            userId: getUserId(),
            displayName: getTelegramDisplayName() || 'Watcher',
            wantOpponentAI: false,
          });
        }}
        onDeployed={(payload, agent) => {
          setDeployTarget(null);
          watchPayload(payload, agent);
        }}
        onCreateAgent={() => setIsCreating(true)}
        // CLEAN-1 (DP-4): a draft is a thing that happens on the desk, not a
        // trip out of it. BIR-2 still holds — this is the same BirthScreen the
        // rail's DraftPanel opens — but it now runs on the stage, so the top
        // bar, the roster and every panel's state are still there when he is
        // born. Returning it from here instead would unmount the whole shell.
        draft={isCreating ? (
          <BirthScreen
            onBack={() => setIsCreating(false)}
            onBirth={() => setIsCreating(false)}
            onSeeTable={navigateToTable}
          />
        ) : null}
        // BIRTH-5: the same intent the phone's HomeScreen takes as `openTable`.
        // The desk's table is a rail panel rather than a sheet, so the shell
        // that owns the rail is the one that has to be told.
        openHomeTable={homeTableOpen}
      />
    );
  }

  if (!config) {
    // Birth flow overlays all tabs — shown full-screen while creating a new agent.
    if (isCreating) {
      return (
        <div className="app">
          <BirthScreen
            onBack={() => setIsCreating(false)}
            onBirth={(agent) => {
              setIsCreating(false);
              setNewlyBornAgent(agent);
              navigateTo('home');
            }}
            onSeeTable={navigateToTable}
          />
        </div>
      );
    }

    if (agentProfileTarget) {
      return (
        <div className="app">
          {/* WUI-4: onFund is what makes the pocket line's action render. The
              funding sheet lives on the YOU screen with the rest of the money,
              so Fund goes there rather than opening a second copy of it here. */}
          <AgentProfileScreen
            agent={agentProfileTarget}
            onBack={() => setAgentProfileTarget(null)}
            onFund={() => { setAgentProfileTarget(null); navigateToMoney(); }}
            onOpenChat={(ag) => {
              // BUGS-A job 4: the door he came in by is this profile.
              setAgentProfileTarget(null);
              openAgentChat(ag, { tab: activeTab, profileAgent: ag });
            }}
            onWatch={async (ag) => {
              if (!ag?.activeTableId) return;
              // CHAT-2: captured before the overlay closes, so it still knows
              // whether a thread or the floor is underneath it.
              watchOriginRef.current = hereOrigin();
              let memoryContext = '';
              try {
                const res = await fetch(`/api/agents/${ag.id}/memory?userId=${getUserId()}`);
                if (res.ok) memoryContext = (await res.json()).memoryContext || '';
              } catch { /* watch with empty context */ }
              setAgentProfileTarget(null);
              setActiveAgent(ag.id, ag);
              watch({
                tableId: ag.activeTableId,
                agentId: ag.id,
                userId: getUserId(),
                agentStrategy: ag.strategy,
                displayName: ag.name || getTelegramDisplayName() || 'Agent',
                wantOpponentAI: false,
                memoryContext,
              });
            }}
            // CHAT-2 item 3 — the control centre's own actions.
            // CASINO-1: Deploy is a walk to the casino, not a socket. The
            // profile knows WHO; only the building knows where and for how
            // much.
            onDeploy={placeInCasino}
            // Deploy's opposite. /finish is the route that ends a session, and
            // it is the same one the watch screen's exit already calls.
            onCallIn={(ag) => {
              callAgentFinish(ag.id);
              setAgentProfileTarget(null);
            }}
            // BUGS-A job 3: retiring him ENDS somewhere, and the somewhere is
            // the room he lived in. Closing the overlay alone put the owner
            // back on whatever tab was underneath — most often the thread of
            // the man he had just retired, which is a conversation with
            // nobody, and on an empty roster that read as being dropped into
            // the draft flow. HOME is where the household is; go and look at
            // the one he still has.
            onRetired={() => { setAgentProfileTarget(null); navigateTo('home'); }}
          />
        </div>
      );
    }

    return (
      <div className="app">
        <Header status={status} hasConfig={false} onOpenRoster={() => setRosterOpen(true)} />
        {rosterOpen && (
          <RosterSheet
            onClose={() => setRosterOpen(false)}
            onCreateAgent={() => { setRosterOpen(false); setIsCreating(true); }}
            onOpenThread={(agent) => {
              // The row IS the way into his thread, and Back out of it goes to
              // the tab the sheet came down over (job 4).
              setRosterOpen(false);
              openAgentChat(agent);
            }}
          />
        )}
        <div className="pre-game" style={{ position: 'relative' }}>
          {/* HOME-1 · board 29 — the flat, seen from above. It takes the place
              CASINO-1 left the floor standing in: HOME is the household, CASINO
              is the building. The floor itself is not deleted — DesktopHome
              still draws it — it just is not a mobile tab any more. */}
          {activeTab === 'home' && (
            <HomeScreen
              wsUrl={WS_URL}
              openTable={homeTableOpen}
              onCreateAgent={() => setIsCreating(true)}
              onProfile={openAgentProfile}
              // CASINO-1's promise: the thread is reached from Home and from a
              // profile. In the room, from the man.
              onOpenThread={openAgentChat}
              onOpenWallet={(agent) => (agent ? openAgentProfile(agent) : navigateTo('you'))}
              onSend={sendToAgent}
              // BUGS-A job 7: an away frame is a picture of the table he is at,
              // and tapping it goes there. HOME_STATE's compact projection does
              // not always carry `activeTableId` — the frame itself is drawn
              // from `liveGame`, and `location.tableId` is what says where he is
              // standing — so the tap reads all three rather than one. A frame
              // that could name a table and still did nothing is exactly the
              // dead tap this job is about.
              // SIT-1 · the other verb for the same table. onWatchTable opens a
              // spectator socket; this one takes a seat.
              onSitTable={sitTable}
              onWatchTable={(tableId) => {
                if (!tableId) return;
                watchOriginRef.current = hereOrigin();
                setActiveAgent(null, null);
                watch({
                  tableId,
                  userId: getUserId(),
                  displayName: getTelegramDisplayName() || 'Watcher',
                  wantOpponentAI: false,
                });
              }}
              onWatch={async (agent) => {
                const tableId = agent?.activeTableId
                  || agent?.liveGame?.tableId
                  || agent?.location?.tableId
                  || null;
                if (!tableId) return;
                watchOriginRef.current = hereOrigin();
                let memoryContext = '';
                try {
                  const res = await fetch(`/api/agents/${agent.id}/memory?userId=${getUserId()}`);
                  if (res.ok) memoryContext = (await res.json()).memoryContext || '';
                } catch { /* watch with empty context */ }
                setActiveAgent(agent.id, agent);
                watch({
                  tableId,
                  agentId: agent.id,
                  userId: getUserId(),
                  agentStrategy: agent.strategy,
                  displayName: agent.name || getTelegramDisplayName() || 'Agent',
                  wantOpponentAI: false,
                  memoryContext,
                });
              }}
              // CASINO-1: the casino is the only place a deploy happens, because
              // the room and the buy-in are decided there. A `needs: 'deploy'`
              // yes from a want walks him over with the agent already chosen
              // rather than opening a socket from the living room.
              onDeploy={placeInCasino}
            />
          )}

          {/* CASINO-1 · board 27. The building: rooms by stakes, the board by
              the stairs, and the one tray you deploy from. */}
          {activeTab === 'casino' && (
            <CasinoScreen
              wsUrl={WS_URL}
              deployAgent={deployTarget?.agent ?? null}
              onCancelDeploy={() => setDeployTarget(null)}
              onSpectate={(tableId) => {
                if (!tableId) return;
                watchOriginRef.current = hereOrigin();
                setActiveAgent(null, null);
                watch({
                  tableId,
                  userId: getUserId(),
                  displayName: getTelegramDisplayName() || 'Watcher',
                  wantOpponentAI: false,
                });
              }}
              onDeployed={(payload, agent) => {
                // The origin was captured where the decision was made, not
                // here — CHAT-2 item 4 across the casino trip.
                watchOriginRef.current = deployTarget?.origin ?? hereOrigin();
                setDeployTarget(null);
                setActiveAgent(payload.agentId, agent);
                watch({
                  tableId: payload.tableId,
                  agentId: payload.agentId,
                  userId: getUserId(),
                  agentStrategy: payload.strategy,
                  displayName: payload.agentName || getTelegramDisplayName() || 'Agent',
                  wantOpponentAI: false,
                  memoryContext: payload.memoryContext ?? '',
                });
              }}
            />
          )}
          {/* CHAT-2: the thread has no Deploy and no Watch any more — the face
              and the name open the profile, and the profile is where an owner
              acts on him.
              BUGS-A job 4: and it is THE THREAD that renders here, not the
              CHATS screen. The list half of that screen is off the tab flow
              entirely; the roster it used to be is the glass sheet under the
              top-right avatar. Back goes to the door this thread was opened
              by — the room, or the profile — never to a list. */}
          {activeTab === 'chats' && agentChatTarget && (
            <AgentThread
              agent={agentChatTarget}
              onBack={closeAgentChat}
              onOpenProfile={openAgentProfile}
            />
          )}
          {activeTab === 'you' && <YouScreen onOpenProfile={openAgentProfile} openMoney={youMoneyOpen} />}

          {/* WIRE-1: the newborn's arrival is CasinoFloor's own (FLOOR-2 FL-3) —
              it notices an id that was not in the roster it first saw and walks
              him in. This overlay drew a second body for the same agent on top
              of that one. One body per agent; the floor keeps his. */}
        </div>
        <nav className="tab-bar">
          <button
            className={`tab-bar__tab${activeTab === 'home' ? ' tab-bar__tab--active' : ''}`}
            onClick={() => navigateTo('home')}
          >
            <HomeIcon />
            <span>HOME</span>
          </button>
          <button
            className={`tab-bar__tab${activeTab === 'casino' ? ' tab-bar__tab--active' : ''}`}
            onClick={() => navigateTo('casino')}
          >
            <CasinoIcon />
            <span>CASINO</span>
          </button>
          <button
            className={`tab-bar__tab${activeTab === 'you' ? ' tab-bar__tab--active' : ''}`}
            onClick={() => navigateTo('you')}
          >
            <YouIcon />
            <span>YOU</span>
          </button>
        </nav>
      </div>
    );
  }

  // ── SIT-1 · the owner, at his own kitchen table ────────────────────────────
  //
  // The SAME felt the spectator branch below renders, and deliberately so: the
  // board that says "sitting down is the camera, not a screen" is about there
  // being one table, and this is the client's version of that claim — the room
  // is where you tap the chair, and everything after it is the felt you already
  // know, with you at the bottom of it.
  //
  // Three differences, all of them props: he is `seated` (his cards, his pill,
  // no ghost), the composer's slot carries the verbs, and the Chat button opens
  // the ROOM's thread in the same glass rather than leaving for an agent's.
  // Live `game` and live `legalActions`, never the paced ones — a player must
  // not wait to see his own seat.
  if (config?.sitting && !isDesktop) {
    return (
      <WatchScreen
        seated
        game={game}
        mySeat={mySeat}
        legalActions={legalActions}
        onAct={act}
        lastDecision={lastDecision}
        chatMessages={chatMessages}
        sendChat={sendChat}
        displayNames={displayNames}
        connection={status}
        threadRows={homeThreadRows}
        // No onOpenThread: the Chat button opens the glass sheet in place. The
        // owner is in a hand — sending him to another screen to read the room
        // would take him out of it.
        onLeave={handleLeave}
        onSitOut={sitOut}
        sessionEnd={findSessionEnd(history)}
        onBackToFloor={() => { handleLeave(); navigateTo('home'); }}
        config={config}
      />
    );
  }

  // Mobile spectator: full-screen WatchScreen replaces the legacy layout
  if (config?.isSpectator && !isDesktop) {
    const sessionEnd = findSessionEnd(history);
    return (
      <WatchScreen
        // W5-1: the paced bundle, not the live one. `paced.game` is null only
        // before the first snapshot, which is the same moment `game` is.
        game={paced.game}
        mySeat={mySeat}
        lastDecision={paced.lastDecision}
        // WIRE-1 (W3-6): the staged runout, forwarded rather than picked up off
        // the view model. useTable merges it onto `game` too, and WatchScreen
        // prefers this prop — the merge stays as the fallback for any container
        // that has not been given the frame.
        paceFrame={paced.paceFrame}
        paceLag={paced.behindMs}
        chatMessages={paced.chatMessages}
        sendChat={sendChat}
        displayNames={displayNames}
        // WATCH-8: the socket's own status. The thread refetches when the
        // connection comes back, because the record the table wrote while the
        // owner was disconnected is exactly the part he cannot have heard.
        connection={status}
        threadLines={threadLines}
        onLeave={handleLeave}
        onSitOut={sitOut}
        // CLEAN-1 (W4-5): Chat leaves the watch screen and lands in his thread,
        // the same one the floor and the roster open. Only offered when there
        // is a person to open — without it WatchScreen keeps talking in its own
        // TABLE tab, which is the behaviour that existed before.
        onOpenThread={watchedAgent ? () => {
          handleLeave();
          openAgentChat(watchedAgent);
        } : undefined}
        // WATCH-7: the ceremony, once, when the session is over — and the two
        // ways out of the evening it offers. Funding him is the wallet, which
        // is where YOU already keeps the buy-in.
        sessionEnd={sessionEnd}
        // YOU-2 owns the money: the sheet is where the buy-in lives now, not
        // the YOU tab it used to sit behind. CASINO-1 owns the nav: 'home' is
        // today's floor, so that is where "back to the floor" goes.
        onFund={() => { handleLeave(); navigateToMoney(); }}
        onBackToFloor={() => { handleLeave(); navigateTo('home'); }}
        config={config}
      />
    );
  }

  return (
    <div className={`app${config?.isSpectator ? ' app--spectator' : ''}`}>
      <Header
        status={status}
        game={game}
        mySeat={mySeat}
        hasConfig
        agentName={config?.displayName}
        isSpectator={!!config?.isSpectator}
        mode={config?.isSpectator ? 'spectator' : config?.wantAI ? 'vs-ai' : 'vs-human'}
        historyCount={history.length}
        reconnectAttempt={reconnectAttempt}
        maxReconnectAttempts={maxReconnectAttempts}
        onToggleHistory={() => setHistoryOpen((v) => !v)}
        onLeave={handleLeave}
      />
      <main className={`app__main${config?.isSpectator ? ' app__main--analysis' : ''}`}>
        {error && (
          <div className="error-banner" onClick={dismissError}>
            {error} · tap to dismiss
          </div>
        )}
        <TableView game={game} mySeat={mySeat} buyIn={buyInRef.current} onRename={rename} timerLeft={timerLeft} timerTotal={TIMER_TOTAL} isSpectator={!!config?.isSpectator} mode={config?.isSpectator ? 'spectator' : config?.wantAI ? 'vs-ai' : 'vs-human'} lastDecision={lastDecision} />
        {config?.isSpectator && (
          <AnalysisPanel
            chatMessages={chatMessages}
            onSendChat={sendChat}
            mySeat={mySeat}
            displayNames={displayNames}
            lastDecision={lastDecision}
          />
        )}
      </main>
      {!config?.isSpectator && <ChatBar messages={chatMessages} onSend={sendChat} />}
      {config?.isSpectator ? (
        <>
          <LastAgentHandPanel
            hand={lastAgentHand}
            open={lastAgentHandOpen}
            onToggle={() => setLastAgentHandOpen((value) => !value)}
          />
        </>
      ) : (
        <ActionBar
          game={game}
          mySeat={mySeat}
          legalActions={legalActions}
          status={status}
          reconnectAttempt={reconnectAttempt}
          maxReconnectAttempts={maxReconnectAttempts}
          onAct={act}
          onDeal={deal}
        />
      )}
      {/* Desktop: sticky history panel. Mobile: hidden by CSS. */}
      <aside className="app__sidebar">
        <div className="panel-header">
          <span className="panel-title">Hand History</span>
          <span className="panel-meta">#{history.length}</span>
        </div>
        <div className="history-content">
          <HandHistory history={history} displayNames={displayNames} variant="panel" />
        </div>
        <div className="panel-footer">
          <span>Session</span>
          <span>{history.length} hand{history.length !== 1 ? 's' : ''}</span>
        </div>
      </aside>
      {/* Mobile: slide-in drawer on demand. Hidden at ≥600px. */}
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={history}
        displayNames={displayNames}
      />
      <nav className="tab-bar">
        <button
          className={`tab-bar__tab${activeTab === 'home' ? ' tab-bar__tab--active' : ''}`}
          onClick={() => { handleLeave(); navigateTo('home'); }}
        >
          <HomeIcon /><span>HOME</span>
        </button>
        <button
          className={`tab-bar__tab${activeTab === 'casino' ? ' tab-bar__tab--active' : ''}`}
          onClick={() => { handleLeave(); navigateTo('casino'); }}
        >
          <CasinoIcon /><span>CASINO</span>
        </button>
        <button
          className={`tab-bar__tab${activeTab === 'you' ? ' tab-bar__tab--active' : ''}`}
          onClick={() => { handleLeave(); navigateTo('you'); }}
        >
          <YouIcon /><span>YOU</span>
        </button>
      </nav>
    </div>
  );
}


function LastAgentHandPanel({ hand, open, onToggle }) {
  const decisions = hand?.decisions || [];
  if (!decisions.length) return null;

  return (
    <section className="last-hand-panel">
      <button className="last-hand-panel__toggle" type="button" onClick={onToggle}>
        <span>Last hand</span>
        <span>
          Hand #{hand.handNumber ?? '--'} -{' '}
          <b className={hand.won ? 'last-hand-panel__won' : 'last-hand-panel__lost'}>
            {hand.won ? 'WON' : 'LOST'}
          </b>
          {' '} - Pot: {formatAgentAmount(hand.potSize)}
        </span>
      </button>
      {open && (
        <div className="last-hand-panel__body">
          {decisions.map((decision, index) => (
            <div className="history__entry last-hand-panel__decision" key={`${decision.street || 'street'}-${index}`}>
              <span>[{String(decision.street || 'street').toUpperCase()}]</span>
              <span>{formatAgentDecisionAction(decision.action)}</span>
              {decision.reasoning && <span>- "{decision.reasoning}"</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// WATCH-7 · the session-finished signal.
//
// SERVER-3 is adding a SESSION_END message. Until it lands, the signal the
// client already has is TABLE_CLOSED — appended to the history as a `closed`
// entry with the server's own recap as its reason. It is read off the history
// rather than off `status` on purpose: the socket closes right behind the
// message and useTable moves status to 'reconnecting', so a session end read
// from status would flicker away a second after it appeared. The history entry
// is durable.
function findSessionEnd(history) {
  for (const hand of history) {
    const entries = hand.entries || [];
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (entries[index].kind === 'closed') {
        return { reason: entries[index].reason ?? null, hands: hand.handNumber ?? null };
      }
    }
  }
  return null;
}

function findLatestResult(history) {
  for (const hand of history) {
    const entries = hand.entries || [];
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (entry.kind === 'result') {
        return { handNumber: hand.handNumber, result: entry.result };
      }
    }
  }
  return null;
}

function formatAgentDecisionAction(action = {}) {
  if (!action?.type) return 'unknown';
  if (action.amount == null) return action.type;
  return `${action.type} ${action.amount}`;
}

function formatAgentAmount(amount) {
  return amount == null ? '--' : amount;
}

function TableView({ game, mySeat, buyIn, onRename, timerLeft, timerTotal, isSpectator, mode, lastDecision }) {
  const viewSeat = Number.isInteger(mySeat) ? mySeat : 0;
  const seatCount = Math.max(game?.seats?.length || 2, 2);
  const opponentSeatIndex = (viewSeat + 1) % seatCount;

  const coachTextRef = useRef(null);
  const [coachVisible, setCoachVisible] = useState(false);
  const coachTimerRef = useRef(null);

  const showCoach = mode === 'vs-ai' || mode === 'spectator';

  useEffect(() => {
    if (!showCoach) return;
    if (!lastDecision?.reasoning || lastDecision.seat !== opponentSeatIndex) return;
    coachTextRef.current = lastDecision.reasoning;
    setCoachVisible(true);
    clearTimeout(coachTimerRef.current);
    coachTimerRef.current = setTimeout(() => setCoachVisible(false), 4000);
    return () => clearTimeout(coachTimerRef.current);
  }, [lastDecision, showCoach, opponentSeatIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const inHand = !!game && [Streets.PREFLOP, Streets.FLOP, Streets.TURN, Streets.RIVER, Streets.SHOWDOWN].includes(game.street);
  const blindSeats = game ? resolveBlindSeats(game) : { smallBlindSeat: -1, bigBlindSeat: -1 };
  const dealerSeat = game?.dealerSeat ?? -1;
  const handNum = game?.handNumber;
  const pot = game?.pot ?? 0;
  const community = game?.community ?? [];

  const emptyData = (label) => ({
    displayName: label, stack: 0, holeCards: [], folded: false,
    allIn: false, contribThisStreet: 0, contribTotal: 0,
  });

  const heroData = game?.seats?.[viewSeat] ?? emptyData('You');
  const oppData = game?.seats?.[opponentSeatIndex] ?? emptyData('Waiting...');

  function posLabel(seat) {
    if (blindSeats.bigBlindSeat === seat) return 'BB';
    if (blindSeats.smallBlindSeat === seat) return 'SB';
    if (dealerSeat === seat) return 'BTN';
    return '';
  }

  const commSlots = [...community];
  while (commSlots.length < 5) commSlots.push('placeholder');

  return (
    <div className="dr-table-card dr-app">
      <div className="dr-table-card__head">
        <b>HEADS-UP NLH</b>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <small style={{ fontVariantNumeric: 'tabular-nums' }}>
            {handNum ? `Hand #${handNum}` : 'Waiting'}
          </small>
          <span className="dr-live-dot" aria-hidden />
        </span>
      </div>

      <div className="dr-felt">
        <TableSeat
          name={oppData.displayName}
          stack={oppData.stack}
          position={posLabel(opponentSeatIndex)}
          holeCards={oppData.holeCards}
          isToAct={game?.toAct === opponentSeatIndex}
          isSelf={false}
          isCompact={false}
          inHand={inHand}
          folded={oppData.folded}
        />

        {coachVisible && coachTextRef.current && (
          <div className="dr-coach-bubble" role="status" aria-live="polite">
            <span className="dr-coach-bubble__tag">REASONING</span>
            <span className="dr-coach-bubble__text">{coachTextRef.current}</span>
          </div>
        )}

        <div className="dr-pot" style={{ marginTop: 14 }}>
          <small>POT</small>
          <b>{pot.toLocaleString()}</b>
        </div>

        <div className="dr-board-cards">
          {commSlots.map((c, i) => <Card key={i} card={c} size="felt" />)}
        </div>

        {pot > 0 && (
          <div className="dr-pot-chip">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="10" stroke="#00D4AA" strokeWidth="2.5" />
              <circle cx="12" cy="12" r="5" fill="#00D4AA" opacity="0.4" />
            </svg>
            <span>{pot.toLocaleString()}</span>
          </div>
        )}

        <TableSeat
          name={heroData.displayName}
          stack={heroData.stack}
          position={posLabel(viewSeat)}
          holeCards={heroData.holeCards}
          isToAct={game?.toAct === viewSeat}
          isSelf={true}
          isCompact={true}
          inHand={inHand}
          folded={heroData.folded}
          isSpectator={isSpectator}
        />
      </div>
    </div>
  );
}

function HistoryPlaceholder() {
  return (
    <div className="placeholder-screen dr-app">
      <div className="placeholder-screen__inner">
        <svg viewBox="0 0 40 40" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="20" cy="20" r="15" />
          <path d="M20 10v10l6 6" />
        </svg>
        <p className="placeholder-screen__title">Hand History</p>
        <p className="placeholder-screen__sub">Coming soon</p>
      </div>
    </div>
  );
}

function ProfilePlaceholder() {
  const name = getTelegramDisplayName() || 'Player';
  return (
    <div className="placeholder-screen dr-app">
      <div className="placeholder-screen__inner">
        <svg viewBox="0 0 40 40" width="48" height="48" fill="currentColor">
          <circle cx="20" cy="13" r="7" />
          <path d="M4 36c0-8.8 7.2-16 16-16s16 7.2 16 16H4z" />
        </svg>
        <p className="placeholder-screen__title">{name}</p>
        <p className="placeholder-screen__sub">Profile · Coming soon</p>
      </div>
    </div>
  );
}

// CASINO-1: the three tabs are HOME · CASINO · YOU. The icons are NAV3's,
// from design-refs/mood-home.jsx.
function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </svg>
  );
}

function CasinoIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M10 2C8 6.5 4 7.5 4 11a3 3 0 006 0 3 3 0 006 0C16 7.5 12 6.5 10 2z" />
      <rect x="8.5" y="14" width="3" height="4" rx="1" />
    </svg>
  );
}

function YouIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <circle cx="10" cy="6" r="3.5" />
      <path d="M3 17.5c0-3.9 3.1-7 7-7s7 3.1 7 7H3z" />
    </svg>
  );
}

function resolveBlindSeats(game) {
  const count = game?.seats?.length || 0;
  const dealer = Number.isInteger(game?.dealerSeat) ? game.dealerSeat : 0;
  const modulo = Math.max(count, 1);
  return {
    smallBlindSeat: Number.isInteger(game?.smallBlindSeat)
      ? game.smallBlindSeat
      : count === 2 ? dealer : (dealer + 1) % modulo,
    bigBlindSeat: Number.isInteger(game?.bigBlindSeat)
      ? game.bigBlindSeat
      : count === 2 ? (dealer + 1) % 2 : (dealer + 2) % modulo,
  };
}

function seatPosition(seat, mySeat, count) {
  const relative = (seat - mySeat + count) % count;
  if (relative === 0) return 'bottom';
  if (count <= 2) return 'top';
  if (count === 3) return relative === 1 ? 'right' : 'left';
  if (relative === 1) return 'right';
  if (relative === 2) return 'top';
  return 'left';
}

function seatRenderOrder(position) {
  return { top: 0, left: 1, right: 2, bottom: 3 }[position] ?? 4;
}
