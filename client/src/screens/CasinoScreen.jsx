// client/src/screens/CasinoScreen.jsx — CASINO-1, UI-3 job A
//
// UI-3 JOB A — ONE ROOM. Board 27's building had three rooms behind three
// doorways — the floor, upstairs, the back room — and CASINO-2/BUGS-C spent
// several waves teaching the owner how to walk between them: a doorway, then
// a floor you stood inside, then a toggle back to the board, then a swipe
// between floors. Jens's decision reverses all of that at once: the casino
// is a SINGLE room. Every live table is on the one floor at once, each
// showing its own stakes (10/20 beside 50/100), because stakes were always a
// fact about a TABLE — the felt payload has carried `blinds` since CASINO-2
// job 1 — and only ever became a fact about a ROOM because the building
// organised itself by stakes tier. That organisation is what is gone.
//
// WHAT THAT DELETES: the doorway list (RoomDoors), the tall deploy doorway
// (CasinoDoor), the Floor|Board toggle and the board it toggled to
// (FloorBoard/LiveNow/Tonight), the swipe between rooms, and the session
// memory of which room was last open — there is only ever one. This also
// kills the bug where entering the casino auto-targeted an empty room and
// said nothing was running while games were live somewhere else on the
// ladder: there is no longer a specific room to mis-target, because the
// floor always shows every table there is.
//
// WHAT REPLACES IT: `CasinoTicker` (components/casino/CasinoTicker.jsx) is
// pinned to the very top of the screen, above even the header, answering the
// question the board used to answer — is anything happening right now — in
// one line instead of two panels. `StakePicker` (CasinoBuilding.jsx) is what
// is left of the doorway when an owner is placing a man: he still has to
// choose a stake, so it is a row of chips instead of a room to step into.
// The staircase INSIDE the one room (TheFloor's own furniture) takes him
// home when tapped — the fix for a building that used to have three rooms
// and a board to navigate, and now has none.
//
// `rooms` (from useCasinoRooms, `src/server/rooms.js`) is unchanged on the
// wire — it is still the stakes ladder, still named `floor`/`upstairs`/
// `backroom` there, because agents' wants and location text elsewhere in the
// app ("upstairs. send me.") still speak in those terms. This file simply
// stops using it to pick which ROOM to stand in, and uses it only for what
// each stake costs and who is at it.

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  DeployTray, StakePicker, count, M_BG,
} from '../components/casino/CasinoBuilding.jsx';
import { CasinoTicker } from '../components/casino/CasinoTicker.jsx';
import { YourTables } from '../components/casino/YourTables.jsx';
import { FloorView, tableIdOf } from '../components/casino/FloorView.jsx';
import { FundSheet } from '../components/wallet/FundSheet.jsx';
import { useCasinoRooms, roomForBlinds, agentsByRoom, totalSeated } from '../hooks/useCasinoRooms.js';
import { useCasinoEvents } from '../lib/events.js';
import { fetchWallet, fundAgent, money, pocketOf } from '../lib/wallet.js';
import { getTelegramInitData, getUserId } from '../lib/telegram.js';
import { HomeThread } from '../components/home/HomeThread.jsx';
// BUG-156: the building's own sheet, and the desk shell's, travel with the
// chunk that draws them instead of with every phone entry.
import '../styles/casino.css';
import '../styles/desktop.css';

const POLL_MS = 10_000;

// ── Pure helpers ────────────────────────────────────────────────────────────

/**
 * Is this stake hot right now?
 *
 * Both halves of the answer come from the same `hot` events. The server's
 * room.hot is time-bounded by HOT_RECENT_MS; the client's own 20s window
 * (EVENT-2's hotTables) is the one with a guaranteed clock even when the
 * socket is down. So the client window wins whenever it has anything to say,
 * and the server's list is the fallback for a ticker that has not backfilled
 * yet.
 */
export function isRoomHot(room, hotTables) {
  const hot = room?.hot ?? [];
  if (hot.length === 0) return false;
  if (!hotTables || hotTables.size === 0) return true;
  return hot.some((id) => hotTables.has(String(id)));
}

/** Can this pocket sit down at this stake? */
export function canAfford(pocket, room) {
  if (!room) return false;
  return (pocket?.balance ?? 0) >= (room.stakes?.buyIn ?? 0);
}

/**
 * Which stake the tray opens on: the highest rung his pocket covers, which is
 * the rung the server's own ladder (stakesFor in src/server/wallet.js) would
 * pick for him. Opening on a stake he cannot afford would make the tray's
 * first reading a refusal. When he can afford none, the lowest is shown shut,
 * which is what states the price.
 */
export function defaultRoom(rooms, pocket) {
  const affordable = (rooms ?? []).filter((r) => canAfford(pocket, r));
  if (affordable.length > 0) return affordable[affordable.length - 1];
  return (rooms ?? [])[0] ?? null;
}

// ── The screen ──────────────────────────────────────────────────────────────

export function CasinoScreen({
  wsUrl = null,
  deployAgent = null,
  onDeployed = null,
  onSpectate = null,
  onReplay = null,
  onPlace = null,
  onCancelDeploy = null,
  // HOME-2 job 1 · back from anywhere returns home. The phone reached the
  // casino through the door, so the way out of it is a back arrow rather
  // than a tab; the desk never passes one, because the desk did not leave
  // home. UI-3 job A: also the staircase inside the room, and the only
  // navigation this screen has left.
  onBack = null,
  onOpenRoster = null,
  onSend = null,
  desktop = false,
  headerTarget = null,
  // UI-3 job A: there is one room now, so there is nothing left for a room
  // id to select. Accepted and otherwise ignored — an old caller (or a
  // stored `agentic_casino_room` from before this change) still resolves to
  // the one floor rather than erroring or targeting a room that no longer
  // exists as a destination.
  initialRoomId = null,
  // BUG-208: the roster sheet is deliberately glass over the room, but this
  // screen's own foreground panels (the deploy card, the conversation band)
  // are dense text on an opaque surface, not the ambient art the glass
  // design assumes is behind it — left up, they show through the blur and
  // overlap the roster's own rows. True while the roster is open, so this
  // screen can stand its own foreground panels down for it.
  rosterOpen = false,
}) {
  const [agents, setAgents] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [playRoomId, setPlayRoomId] = useState(null);
  const [fundTarget, setFundTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [playAgentId, setPlayAgentId] = useState(null);
  const [playError, setPlayError] = useState('');
  const [pendingTable, setPendingTable] = useState(null);
  const [zoom, setZoom] = useState(null);
  const playInFlight = useRef(false);
  const playEntry = useRef(0);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; playEntry.current += 1; };
  }, [deployAgent?.id]);
  const abandonFloorPlay = useCallback(() => {
    playEntry.current += 1;
    setPlayError('');
    setPendingTable(null);
  }, []);
  const [conversationId, setConversationId] = useState(null);
  const [threadOpen, setThreadOpen] = useState(false);
  const [sending, setSending] = useState(false);

  // CASINO-2: `felts` is one public snapshot per live table, across every
  // stake — UI-3 job A draws them all on the one floor at once, so there is
  // no per-room filtering left to do with them.
  const { rooms, felts, roomOf } = useCasinoRooms({ wsUrl });
  const { events, hotTables } = useCasinoEvents({ wsUrl });
  useEffect(() => { if (zoom && !felts.some(f => f.tableId === zoom.tableId)) setZoom(null); }, [felts, zoom]);

  const loadAgents = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents?userId=${getUserId()}`, {
        headers: { 'x-telegram-init-data': getTelegramInitData() },
      });
      if (!res.ok) return;
      const data = await res.json();
      setAgents(Array.isArray(data?.agents) ? data.agents : []);
    } catch { /* the floor keeps whoever it had */ }
  }, []);

  useEffect(() => {
    loadAgents();
    const t = setInterval(loadAgents, POLL_MS);
    return () => clearInterval(t);
  }, [loadAgents]);

  const refreshWallet = useCallback(async () => {
    setWallet(await fetchWallet());
    await loadAgents();
  }, [loadAgents]);

  useEffect(() => { refreshWallet(); }, [refreshWallet]);

  // The agent in the tray, kept current with the roster: his pocket changes
  // when the owner funds him, and the tray is the thing that states it.
  const trayAgent = useMemo(() => {
    if (!deployAgent) return null;
    return agents.find((a) => a.id === deployAgent.id) ?? deployAgent;
  }, [deployAgent, agents]);

  const pocket = useMemo(() => (trayAgent ? pocketOf(trayAgent) : null), [trayAgent]);
  const speaker = trayAgent ?? agents.find(a => a.id === conversationId)
    ?? agents.find(a => a.liveGame?.tableId) ?? agents[0] ?? null;
  useEffect(() => { setThreadOpen(false); }, [speaker?.id]);
  const sendConversation = async (agent, text) => {
    if (!onSend || sending) return null;
    setSending(true);
    try { return await onSend(agent, text); }
    finally { setSending(false); }
  };
  const conversation = !desktop && !rosterOpen && speaker && onSend ? <HomeThread
    key={speaker.id} agent={speaker} open={threadOpen} onToggle={setThreadOpen}
    onSend={sendConversation} sending={sending} privateContext="HIS CONVERSATION"
    placeholder={`Whisper to ${speaker.nickname || speaker.name}…`}
  /> : null;

  // The tray opens on the rung his pocket buys, and re-opens there whenever the
  // agent or his money changes. An explicit tap wins until then.
  useEffect(() => {
    if (!trayAgent) { setSelectedRoomId(null); return; }
    setSelectedRoomId(defaultRoom(rooms, pocket)?.id ?? null);
  }, [trayAgent?.id, pocket?.balance, rooms.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  );

  const mineByRoom = useMemo(() => agentsByRoom(rooms, agents, roomOf), [rooms, agents, roomOf]);
  const mineIds = useMemo(() => new Set(agents.map((a) => String(a.id))), [agents]);
  // CASINO-2 job 3: which stakes the picker marks as hot. Same answer a tall
  // doorway used to get from isRoomHot, asked once for the row rather than
  // once per chip.
  const hotRoomIds = useMemo(
    () => new Set(rooms.filter((r) => isRoomHot(r, hotTables)).map((r) => r.id)),
    [rooms, hotTables],
  );

  const seated = totalSeated(rooms);
  const availableAgents = agents.filter(agent => !tableIdOf(agent) && !agent.guest && !agent.archived && !agent.retiring
    && agent.location?.where !== 'visiting');
  const playAgent = availableAgents.find(agent => agent.id === playAgentId) ?? availableAgents[0] ?? null;

  // The stake the quick-play card opens on: an explicit tap wins (playRoomId),
  // and otherwise it is the highest rung his pocket buys — computed straight
  // off this render's own data, never a follow-up effect, so the exact buy-in
  // is on screen the first time this card paints rather than one tick later.
  const playRoom = useMemo(
    () => rooms.find((r) => r.id === playRoomId) ?? (playAgent ? defaultRoom(rooms, pocketOf(playAgent)) : null),
    [rooms, playRoomId, playAgent],
  );

  // UI-3 JOB A · THE DEAL, NOT A PICK.
  //
  // The want asks "put me in?", the owner says Yes, and the casino opens with
  // him already in the tray. Tapping a stake chip deals him in directly — one
  // tap, no second confirmation — the same law FIX-6 job 2 gave the doorway
  // it replaces. A shut chip is the one exception: it opens his chips, which
  // is the only thing law 4 lets it open.
  function selectStake(room) {
    if (trayAgent && !canAfford(pocket, room)) {
      setFundTarget(trayAgent);
      return;
    }
    setSelectedRoomId(room.id);
    dealHimIn(room);
  }

  async function handleFund(decision) {
    if (!fundTarget) return;
    try {
      await fundAgent(fundTarget.id, decision);
      await refreshWallet();
      setFundTarget(null);
    } catch { /* the sheet stays open, the choice is not lost */ }
  }

  // "Deal him in" — the existing queue path, with the chosen stake attached.
  async function dealHimIn(into = null) {
    const room = into ?? selectedRoom;
    if (!trayAgent || !room || busy) return;
    if (!canAfford(pocket, room)) { setFundTarget(trayAgent); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(trayAgent.id)}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTelegramInitData() },
        body: JSON.stringify({
          userId: getUserId(),
          rung: room.rung,
          stakes: room.stakes,
        }),
      });
      if (!res.ok) return;
      const payload = await res.json();
      const smallBlind = payload.smallBlind ?? payload.stakes?.smallBlind;
      const bigBlind = payload.bigBlind ?? payload.stakes?.bigBlind;
      const queuedRoom = rooms.find(candidate => candidate.id === payload.room)
        ?? roomForBlinds(rooms, `${smallBlind}/${bigBlind}`)
        ?? room;
      onDeployed?.(payload, trayAgent, queuedRoom);
    } catch { /* he stays in the tray */ }
    finally { setBusy(false); }
  }

  // Unlike the tray's queue, deploy joins a compatible populated table or
  // starts a session. The server owns admission, money and opponent choice.
  async function playOnFloor(agent, room) {
    if (!agent || !room || playInFlight.current || pendingTable) return;
    setPlayError('');
    if (!canAfford(pocketOf(agent), room) || pocketOf(agent)?.mode === 'cut') {
      setFundTarget(agent);
      return;
    }
    playInFlight.current = true;
    const entry = playEntry.current;
    const stillHere = () => mounted.current && playEntry.current === entry;
    setBusy(true);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agent.id)}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTelegramInitData() },
        body: JSON.stringify({ userId: getUserId(), rung: room.rung, stakes: room.stakes }),
      });
      const payload = await res.json();
      // Leaving is not a cancellation of the authorized server session. It
      // only retires this entry's right to navigate or open a funding sheet.
      if (!stillHere()) return;
      if (!res.ok) {
        if (res.status === 402 || payload?.error === 'cantAfford') {
          setFundTarget(payload?.pocket ? { ...agent, pocket: payload.pocket } : agent);
        }
        const message = typeof payload?.message === 'string' ? payload.message
          : typeof payload?.error === 'string' && /\s/.test(payload.error) ? payload.error : null;
        setPlayError(message || `${agent.name} could not join. Try again.`);
        return;
      }
      if (typeof payload?.tableId !== 'string' || !payload.tableId || payload.agentId !== agent.id
        || (typeof payload.sessionStarted !== 'boolean' && payload.alreadyPlaying !== true)) {
        throw new Error('Missing deployment confirmation');
      }
      const actualRoom = rooms.find(candidate => candidate.id === payload.room)
        ?? roomForBlinds(rooms, `${payload.stakes?.smallBlind}/${payload.stakes?.bigBlind}`) ?? room;
      const confirmed = { payload, agent, room: actualRoom };
      setPendingTable(confirmed);
      if (payload.sessionStarted || payload.alreadyPlaying) onDeployed?.(payload, agent, actualRoom);
    } catch {
      if (stillHere()) setPlayError(`${agent.name}’s table could not be opened. Try again.`);
    } finally {
      playInFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  // The venue is every stake tier, folded into one: the census the floor's
  // own header states, and the honest fallback list for a client whose felts
  // have not arrived yet. Stakes themselves are never read off it — each felt
  // carries its own (TheFloor/TableFelt draw off `felt.blinds` directly).
  const venue = useMemo(() => ({
    id: 'floor',
    name: 'The casino floor',
    tables: rooms.reduce((sum, r) => sum + (r.tables ?? 0), 0),
    seated,
    hot: rooms.flatMap((r) => r.hot ?? []),
    biggestPot: rooms.reduce((best, r) => (
      r.biggestPot && (!best || r.biggestPot.pot > best.pot) ? r.biggestPot : best
    ), null),
  }), [rooms, seated]);

  const fund = fundTarget ? (
    <FundSheet
      agent={fundTarget}
      wallet={wallet}
      index={agents.findIndex((a) => a.id === fundTarget.id)}
      onCancel={() => setFundTarget(null)}
      onConfirm={handleFund}
    />
  ) : null;

  // On the phone his chips take the screen, because the phone has one screen.
  // On the desk it is a rail panel like everything else — see FloorView's
  // deployPanel, which carries `fund` there instead.
  if (fund && !desktop) {
    return (
      <div className="csn wal" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: M_BG }}>
        {fund}
      </div>
    );
  }

  function watchTable(tableId) {
    abandonFloorPlay();
    const agent = agents.find(candidate => tableIdOf(candidate) === String(tableId));
    if (agent) onSpectate?.(tableId, { agent });
    else onSpectate?.(tableId);
  }

  // UI-3 JOB A · THE DEPLOY PANEL.
  //
  // He came with you from Home or from his profile (trayAgent), or you are
  // choosing fresh from the floor itself (playAgent) — the two paths CASINO-1
  // and CASINO-2 job 5 kept apart because they used to live on different
  // screens (the lobby's tray, a room's own quick-play card). There is one
  // screen now, so both render into the same slot; they still never appear
  // together, because a man already in the tray is the decision being made.
  const deployPanel = rosterOpen ? null : trayAgent ? (
    <div className="csn-deploy" data-testid="casino-deploy">
      <div className="csn-deploy__head">
        <p className="csn-deploy__label">{`placing ${trayAgent.name}`}</p>
        {!desktop && (
          <button type="button" className="csn-deploy__cancel" aria-label="Stop placing him" onClick={onCancelDeploy}>
            Not now
          </button>
        )}
      </div>
      <StakePicker
        stakes={rooms}
        mineByStake={mineByRoom}
        hotStakes={hotRoomIds}
        pocket={pocket}
        selectedId={selectedRoomId}
        onSelect={selectStake}
      />
    </div>
  ) : (!zoom && onDeployed && (pendingTable || playAgent)) ? (
    <div className="csn-floor-play" data-testid="casino-play">
      {pendingTable ? <>
        <p role="status" data-testid="casino-play-status">{pendingTable.payload.sessionStarted || pendingTable.payload.alreadyPlaying
          ? `${pendingTable.agent.name}’s table is ready.` : `Waiting for ${pendingTable.agent.name}’s table to start.`}</p>
        <button type="button" onClick={() => onDeployed(pendingTable.payload, pendingTable.agent, pendingTable.room)}>
          Watch {pendingTable.agent.name}
        </button>
      </> : <>
        {availableAgents.length > 1 && <label>Choose your agent
          <select data-testid="casino-play-agent" value={playAgent.id} disabled={busy}
            onChange={event => { setPlayAgentId(event.target.value); setPlayRoomId(null); setPlayError(''); }}>
            {availableAgents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
          </select>
        </label>}
        <StakePicker
          stakes={rooms}
          mineByStake={mineByRoom}
          hotStakes={hotRoomIds}
          pocket={pocketOf(playAgent)}
          selectedId={playRoomId}
          onSelect={(room) => setPlayRoomId(room.id)}
        />
        {playRoom && <p className="csn-floor-play__note">
          {money(playRoom.stakes.buyIn)} play-money buy-in from {playAgent.name}’s pocket. Joins an open table, or starts one.
        </p>}
        <button type="button" disabled={busy || !playRoom} onClick={() => playOnFloor(playAgent, playRoom)}>
          {busy ? `Finding ${playAgent.name} a seat…` : playRoom && canAfford(pocketOf(playAgent), playRoom) && pocketOf(playAgent)?.mode !== 'cut'
            ? `Send ${playAgent.name} to play` : `Fund ${playAgent.name} to play`}
        </button>
      </>}
      {playError && <p role="alert">{playError}</p>}
    </div>
  ) : null;

  const ticker = <CasinoTicker
    felts={felts} events={events} mineIds={mineIds} rooms={rooms}
    onWatch={onSpectate ? watchTable : null} onReplay={onReplay ?? null}
  />;

  const headerPortal = desktop && headerTarget ? createPortal(<>
    <div className="dsk-top__room">
      <h1>{zoom ? 'Table · ' + zoom.blinds : 'The casino floor'}</h1>
      <p>{zoom ? 'pinch again to watch' : `${count(venue.seated)} in · ${count(venue.tables)} tables`}</p>
    </div>
    {zoom && <button type="button" className="dsk-btn dsk-btn--ghost" onClick={() => setZoom(null)}>Back to the floor</button>}
    {trayAgent && <button type="button" className="dsk-btn dsk-btn--ghost" aria-label="Stop placing him" onClick={onCancelDeploy}>Not now</button>}
  </>, headerTarget) : null;

  const tray = trayAgent ? (
    <DeployTray
      agent={trayAgent}
      index={Math.max(0, agents.findIndex((a) => a.id === trayAgent.id))}
      room={selectedRoom}
      affordable={canAfford(pocket, selectedRoom)}
      busy={busy}
      onDeal={() => dealHimIn(selectedRoom)}
      onFund={() => setFundTarget(trayAgent)}
    />
  ) : null;

  // CASINO-2 job 4 · YOUR TABLE, once per man. The one block on this screen
  // the owner opens it to see — unrelated to which room he is standing in,
  // so UI-3 job A's merge leaves it exactly where it was, just no longer
  // gated behind having first walked into a room.
  const yourTables = !trayAgent && rooms.length > 0 ? (
    <YourTables
      agents={agents}
      felts={felts}
      onSelectAgent={setConversationId}
      onWatch={onSpectate ? watchTable : null}
      onSend={onPlace ?? null}
    />
  ) : null;

  const floor = (
    <FloorView
      room={venue}
      felts={felts}
      agents={agents}
      events={events}
      deployPanel={fund && desktop ? fund : deployPanel}
      onWatch={onSpectate ? watchTable : null}
      onHome={onBack}
      onOpenRoster={desktop ? null : onOpenRoster}
      desktop={desktop}
      headerOwned={!!headerPortal}
      zoom={zoom} onZoom={setZoom}
    />
  );

  return (
    <div
      className={`csn${desktop ? ' csn--desk-room' : ' csn--phone'}`}
      style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: M_BG }}
    >
      {headerPortal}
      {ticker}
      {yourTables}
      {floor}
      {tray}
      {conversation}
    </div>
  );
}
