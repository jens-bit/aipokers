import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTable } from './hooks/useTable.js';
import { usePacedTable } from './hooks/usePacedTable.js';
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
  const [activeTab, setActiveTab] = useState('casino');
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

  function setActiveAgent(id, agent = null) {
    activeAgentIdRef.current = id;
    setActiveAgentId(id);
    setWatchedAgent(agent);
  }

  function navigateTo(tab) {
    setActiveTab(tab);
    setAgentChatTarget(null);
  }

  function openAgentChat(agent) {
    setAgentChatTarget(agent);
    setActiveTab('chats');
  }

  function openAgentProfile(agent) {
    setAgentProfileTarget(agent);
  }

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
        onDeployAgent={async (agent) => {
          const res = await fetch(`/api/agents/${agent.id}/queue`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-telegram-init-data': getTelegramInitData(),
            },
            body: JSON.stringify({ userId: getUserId() }),
          });
          if (!res.ok) return;
          watchPayload(await res.json(), agent);
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
              navigateTo('casino');
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
            onFund={() => { setAgentProfileTarget(null); navigateTo('you'); }}
            onOpenChat={(ag) => { setAgentProfileTarget(null); openAgentChat(ag); }}
            onWatch={async (ag) => {
              if (!ag?.activeTableId) return;
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
          />
        </div>
      );
    }

    return (
      <div className="app">
        <Header status={status} hasConfig={false} />
        <div className="pre-game" style={{ position: 'relative' }}>
          {activeTab === 'casino' && (
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
              onDeploy={async (agent) => {
                const res = await fetch(`/api/agents/${agent.id}/queue`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: getUserId() }),
                });
                if (!res.ok) return;
                const payload = await res.json();
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
          {activeTab === 'chats' && (
            <ChatsScreen
              selectedAgent={agentChatTarget}
              onSelectAgent={openAgentChat}
              onBack={() => setAgentChatTarget(null)}
              onCreateAgent={() => setIsCreating(true)}
              onOpenProfile={openAgentProfile}
              onDeploy={async (agent) => {
                setAgentChatTarget(null);
                const res = await fetch(`/api/agents/${agent.id}/queue`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: getUserId() }),
                });
                if (!res.ok) return;
                const payload = await res.json();
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
              onWatch={async (agent) => {
                if (!agent?.activeTableId) return;
                let memoryContext = '';
                try {
                  const res = await fetch(`/api/agents/${agent.id}/memory?userId=${getUserId()}`);
                  if (res.ok) memoryContext = (await res.json()).memoryContext || '';
                } catch { /* watch with empty context */ }
                setAgentChatTarget(null);
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
            />
          )}
          {activeTab === 'you' && <YouScreen onOpenProfile={openAgentProfile} />}

          {/* WIRE-1: the newborn's arrival is CasinoFloor's own (FLOOR-2 FL-3) —
              it notices an id that was not in the roster it first saw and walks
              him in. This overlay drew a second body for the same agent on top
              of that one. One body per agent; the floor keeps his. */}
        </div>
        <nav className="tab-bar">
          <button
            className={`tab-bar__tab${activeTab === 'casino' ? ' tab-bar__tab--active' : ''}`}
            onClick={() => navigateTo('casino')}
          >
            <CasinoIcon />
            <span>CASINO</span>
          </button>
          <button
            className={`tab-bar__tab${activeTab === 'chats' ? ' tab-bar__tab--active' : ''}`}
            onClick={() => navigateTo('chats')}
          >
            <ChatsIcon />
            <span>CHATS</span>
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
          className={`tab-bar__tab${activeTab === 'casino' ? ' tab-bar__tab--active' : ''}`}
          onClick={() => { handleLeave(); navigateTo('casino'); }}
        >
          <CasinoIcon /><span>CASINO</span>
        </button>
        <button
          className={`tab-bar__tab${activeTab === 'chats' ? ' tab-bar__tab--active' : ''}`}
          onClick={() => { handleLeave(); navigateTo('chats'); }}
        >
          <ChatsIcon /><span>CHATS</span>
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

function CasinoIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M10 2C8 6.5 4 7.5 4 11a3 3 0 006 0 3 3 0 006 0C16 7.5 12 6.5 10 2z" />
      <rect x="8.5" y="14" width="3" height="4" rx="1" />
    </svg>
  );
}

function ChatsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 12a2 2 0 01-2 2H7l-3 3V6a2 2 0 012-2h8a2 2 0 012 2z" />
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
