import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTable } from './hooks/useTable.js';
import { usePacedTable } from './hooks/usePacedTable.js';
import { useDeepLink } from './hooks/useDeepLink.js';
import { resolveDeepLink } from './lib/deeplink.js';
import { Header } from './components/Header.jsx';
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
import { ChatsScreen } from './screens/ChatsScreen.jsx';
import { YouScreen } from './screens/YouScreen.jsx';
import { BirthScreen } from './screens/BirthScreen.jsx';
import { AgentProfileScreen } from './screens/AgentProfileScreen.jsx';
import { CasinoScreen } from './screens/CasinoScreen.jsx';
import { ReplayTheatre } from './components/replay/ReplayTheatre.jsx';

function resolveWsUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (import.meta.env.DEV) return `${proto}//${window.location.hostname}:8765`;
  return `${proto}//${window.location.host}`;
}
const WS_URL = resolveWsUrl();

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
  // CASINO-1: the nav is HOME · CASINO · YOU. 'home' is today's floor (the
  // room your agents live in — HOME-1 replaces what it renders later) and
  // 'casino' is the building, board 27. 'chats' is still a tab VALUE and still
  // renders its screen; it is just no longer a button in the bar, because the
  // thread is reached from Home and from a profile.
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

  function navigateTo(tab) {
    setActiveTab(tab);
    setAgentChatTarget(null);
    setYouMoneyOpen(false);
  }

  function navigateToMoney() {
    setActiveTab('you');
    setAgentChatTarget(null);
    setYouMoneyOpen(true);
  }

  function openAgentChat(agent) {
    setAgentChatTarget(agent);
    setActiveTab('chats');
  }

  function openAgentProfile(agent) {
    setAgentProfileTarget(agent);
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

  // Auto-fold when timer hits 0 on the human player's turn
  useEffect(() => {
    if (isMyTurn && timerLeft === 0 && !timerFiredRef.current) {
      timerFiredRef.current = true;
      actRef.current?.({ type: 'fold' });
    }
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
          />
        ) : null}
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
            onOpenChat={(ag) => { setAgentProfileTarget(null); openAgentChat(ag); }}
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
            onRetired={() => setAgentProfileTarget(null)}
          />
        </div>
      );
    }

    return (
      <div className="app">
        <Header status={status} hasConfig={false} />
        <div className="pre-game" style={{ position: 'relative' }}>
          {activeTab === 'home' && (
            <CasinoFloor
              onCreateAgent={() => setIsCreating(true)}
              onChat={openAgentChat}
              onProfile={openAgentProfile}
              // WIRE-1 (FLOW-1 F-4): the floor offers "watch him" the moment
              // this one sits down for the first time. It is the link between
              // building an agent and seeing him play, and it is only ever on
              // offer for the hand right after a birth.
              newbornId={newlyBornAgent?.id ?? null}
              onWatch={async (agent) => {
                if (!agent?.activeTableId) return;
                // Taking the offer spends it — a second hand is just poker.
                setNewlyBornAgent(null);
                watchOriginRef.current = hereOrigin();
                let memoryContext = '';
                try {
                  const res = await fetch(`/api/agents/${agent.id}/memory?userId=${getUserId()}`);
                  if (res.ok) memoryContext = (await res.json()).memoryContext || '';
                } catch { /* watch with empty context */ }
                setActiveAgent(agent.id, agent);
                watch({
                  tableId: agent.activeTableId,
                  agentId: agent.id,
                  userId: getUserId(),
                  agentStrategy: agent.strategy,
                  displayName: agent.name || getTelegramDisplayName() || 'Agent',
                  wantOpponentAI: false,
                  memoryContext,
                });
              }}
              // CASINO-1: "Deal him in" on the floor no longer opens a
              // socket. The casino is the only place a deploy happens,
              // because the room and the buy-in are decided there, so this
              // walks him over with the agent already chosen.
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
              acts on him. hereOrigin() is what gets him back here after. */}
          {activeTab === 'chats' && (
            <ChatsScreen
              selectedAgent={agentChatTarget}
              onSelectAgent={openAgentChat}
              onBack={() => setAgentChatTarget(null)}
              onCreateAgent={() => setIsCreating(true)}
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
