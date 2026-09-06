// client/src/screens/CasinoScreen.jsx — CASINO-1
//
// Board 27, direction B: "a place you walk into."
//
// The casino is THE BUILDING — rooms by stakes, seen through their doorways —
// and it is the only place you deploy. You arrive with an agent already chosen
// (from Home, or from his profile), you pick a room, his pocket has to cover
// the buy-in, and you deal him in. There is no stake slider anywhere on this
// screen, because the pocket already is the wager.
//
// The three ref artboards are one screen here, composed rather than redrawn:
//
//   K1 · arriving with an agent   → the doorways, and the tray at the foot.
//   K2 · the board by the stairs  → the five lines, the stairs, the doorways.
//   K3 · a felt goes hot          → the hot doorway grows and the row above the
//                                   rest offers the one action it asks for.
//
// ON THE DESK (DESK-2, board 31's frame). The building is the stage and the
// TICKER MOVES TO THE RAIL. It is the same three artboards, split down the seam
// they already have: the doorways are what you look at and the board by the
// stairs is what you keep half an eye on, and on the phone those have to be
// stacked because there is one column. Given two, the board takes the second
// one and stops competing with the rooms for the top of the screen — which also
// lets it hold the run of the evening rather than the top five of it.
//
// THE TRAY IS UNCHANGED. It is the decision, it belongs under the thing being
// decided, and it stays at the foot of the stage on both platforms.
//
// The parts are in components/casino/CasinoBuilding.jsx; this file is the wiring
// — three live sources joined into one room list, and the two things an owner
// can do here.

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  CasinoBoard, CasinoDoor, CasinoHead, DeployTray, Stairs, Btn, count, M_BG,
} from '../components/casino/CasinoBuilding.jsx';
import { RoomTablesSheet } from '../components/casino/RoomTablesSheet.jsx';
import { FundSheet } from '../components/wallet/FundSheet.jsx';
import { useCasinoRooms, roomForTable, agentsByRoom, totalSeated } from '../hooks/useCasinoRooms.js';
import { useCasinoEvents } from '../lib/events.js';
import { fetchWallet, fundAgent, money, pocketOf } from '../lib/wallet.js';
import { getTelegramInitData, getUserId } from '../lib/telegram.js';
import { M_TEAL, M_GOLD, M_RED } from '../components/floor/atoms.jsx';
import { Num } from '../components/wallet/atoms.jsx';

const POLL_MS = 10_000;
const MONO = '"JetBrains Mono",ui-monospace,monospace';

// ── Pure helpers ────────────────────────────────────────────────────────────

/**
 * Is this room hot right now?
 *
 * Both halves of the answer come from the same `hot` events. The server's
 * room.hot is time-bounded by HOT_RECENT_MS and floorChannel schedules a push
 * for the moment it expires; the client's own 20s window (EVENT-2's hotTables)
 * is the one with a guaranteed clock even when the socket is down. So the
 * client window wins whenever it has anything to say, and the server's list is
 * the fallback for a ticker that has not backfilled yet.
 */
export function isRoomHot(room, hotTables) {
  const hot = room?.hot ?? [];
  if (hot.length === 0) return false;
  if (!hotTables || hotTables.size === 0) return true;
  return hot.some((id) => hotTables.has(String(id)));
}

/**
 * The one felt that is asking for you now, or null. K3: the doorway grows, the
 * centre felt shimmers, and one row states the pot.
 */
export function hotFocus(rooms, hotTables, agents = []) {
  for (const room of rooms ?? []) {
    if (!isRoomHot(room, hotTables)) continue;
    const tableId = room.biggestPot && room.hot.includes(room.biggestPot.tableId)
      ? room.biggestPot.tableId
      : room.hot[0];
    const mine = agents.find((a) => a.activeTableId && String(a.activeTableId) === String(tableId)) ?? null;
    const pot = room.biggestPot?.tableId === tableId ? room.biggestPot.pot : null;
    return { room, tableId, pot, agent: mine };
  }
  return null;
}

/** Can this pocket sit down in this room? */
export function canAfford(pocket, room) {
  if (!room) return false;
  return (pocket?.balance ?? 0) >= (room.stakes?.buyIn ?? 0);
}

/**
 * Which room the tray opens on: the highest rung his pocket covers, which is
 * the rung the server's own ladder (stakesFor in src/server/wallet.js) would
 * pick for him. Opening on a room he cannot afford would make the tray's first
 * reading a refusal. When he can afford none, the lowest is shown shut, which
 * is what states the price.
 */
export function defaultRoom(rooms, pocket) {
  const affordable = (rooms ?? []).filter((r) => canAfford(pocket, r));
  if (affordable.length > 0) return affordable[affordable.length - 1];
  return (rooms ?? [])[0] ?? null;
}

// The doorway heights, from the ref. The hot room grows to 176; a shut room
// shrinks, because there is nothing to look at in a room he cannot enter.
function doorHeight({ hot, shut, index }) {
  if (hot) return 176;
  if (shut) return 104;
  return [152, 134, 120][index] ?? 120;
}

// ── The screen ──────────────────────────────────────────────────────────────

export function CasinoScreen({
  wsUrl = null,
  deployAgent = null,
  onDeployed = null,
  onSpectate = null,
  onCancelDeploy = null,
  desktop = false,
}) {
  const [agents, setAgents] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [fundTarget, setFundTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  // BUGS-A job 7: which doorway the owner has walked up to and looked into.
  // Only ever set when he is NOT placing an agent — with somebody in the tray
  // a doorway is the choice of where to seat him, and that is the older and
  // more important meaning of the tap.
  const [openRoomId, setOpenRoomId] = useState(null);

  const { rooms } = useCasinoRooms({ wsUrl });
  const { events, hotTables } = useCasinoEvents({ wsUrl });

  // The roster, on the same 10s beat the floor uses. It is what puts your own
  // agents in the doorway of the room they are sitting in.
  const loadAgents = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents?userId=${getUserId()}`, {
        headers: { 'x-telegram-init-data': getTelegramInitData() },
      });
      if (!res.ok) return;
      const data = await res.json();
      setAgents(Array.isArray(data?.agents) ? data.agents : []);
    } catch { /* the doorways keep whoever they had */ }
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

  const mineByRoom = useMemo(() => agentsByRoom(rooms, agents), [rooms, agents]);
  const mineIds = useMemo(() => new Set(agents.map((a) => String(a.id))), [agents]);
  const focus = useMemo(() => hotFocus(rooms, hotTables, agents), [rooms, hotTables, agents]);

  const seated = totalSeated(rooms);
  const minePlaying = agents.filter((a) => a.liveGame).length;
  const net = agents.reduce((sum, a) => {
    const p = pocketOf(a);
    return sum + (Number.isFinite(p?.pnl) ? p.pnl : 0);
  }, 0);

  // The stake chip beside a ticker line. Only hot tables and each room's
  // biggest pot are named on the wire, so most lines have no room to name and
  // simply carry no chip — see the note in useCasinoRooms.js.
  const stakesForTable = useCallback(
    (tableId) => roomForTable(rooms, tableId)?.stakes.label ?? null,
    [rooms],
  );

  function selectRoom(room) {
    // A shut door is how the owner gets to his chips — that is the only thing
    // that opens it. Law 4: a fact about his pocket, never a paywall.
    if (trayAgent && !canAfford(pocket, room)) {
      setFundTarget(trayAgent);
      return;
    }
    setSelectedRoomId(room.id);
  }

  // BUGS-A job 7: with nobody in the tray, a doorway is a place you look INTO.
  // It was scenery — the one tap on this screen that did nothing.
  function lookIntoRoom(room) {
    setOpenRoomId(room.id);
  }

  async function handleFund(decision) {
    if (!fundTarget) return;
    try {
      await fundAgent(fundTarget.id, decision);
      await refreshWallet();
      setFundTarget(null);
    } catch { /* the sheet stays open, the choice is not lost */ }
  }

  // "Deal him in" — the existing deploy path, with the room's stakes attached.
  //
  // `rung` and `stakes` ride the body because the room is the owner's actual
  // choice and this is where it belongs on the wire. The route ignores both
  // today: /queue takes only a userId, and /deploy (which does have the pocket
  // gate) derives the rung from the pocket rather than from a request. Until
  // one of them reads these fields, the room picked here is where he is SHOWN
  // to sit down, not necessarily the blinds he lands on — see the CASINO-1
  // report.
  async function dealHimIn() {
    if (!trayAgent || !selectedRoom || busy) return;
    if (!canAfford(pocket, selectedRoom)) { setFundTarget(trayAgent); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(trayAgent.id)}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTelegramInitData() },
        body: JSON.stringify({
          userId: getUserId(),
          rung: selectedRoom.rung,
          stakes: selectedRoom.stakes,
        }),
      });
      if (!res.ok) return;
      const payload = await res.json();
      onDeployed?.(payload, trayAgent, selectedRoom);
    } catch { /* he stays in the tray */ }
    finally { setBusy(false); }
  }

  if (fundTarget) {
    return (
      <div className="csn wal" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: M_BG }}>
        <FundSheet
          agent={fundTarget}
          wallet={wallet}
          index={agents.findIndex((a) => a.id === fundTarget.id)}
          onCancel={() => setFundTarget(null)}
          onConfirm={handleFund}
        />
      </div>
    );
  }

  const sub = trayAgent
    ? `placing ${trayAgent.name}`
    : `${count(seated)} playing · ${minePlaying} of yours in`;

  const doors = rooms.map((room, index) => {
    const hot = isRoomHot(room, hotTables);
    const shut = !!trayAgent && !canAfford(pocket, room);
    return (
      <CasinoDoor
        key={room.id}
        room={room}
        mine={mineByRoom[room.id] ?? []}
        hot={hot}
        shut={shut}
        shutFor={trayAgent?.name ?? null}
        selected={!!trayAgent && room.id === selectedRoomId}
        h={doorHeight({ hot, shut, index })}
        onSelect={trayAgent ? selectRoom : lookIntoRoom}
      />
    );
  });

  const openRoom = rooms.find((r) => r.id === openRoomId) ?? null;

  const board = (
    <CasinoBoard
      events={events}
      mineIds={mineIds}
      playing={seated}
      full={!trayAgent}
      stakesFor={stakesForTable}
      onSpectate={onSpectate ? (tableId) => onSpectate(tableId) : null}
    />
  );

  const head = (
    <CasinoHead
        sub={sub}
        right={trayAgent ? (
          <button
            type="button"
            onClick={() => onCancelDeploy?.()}
            aria-label="Stop placing him"
            style={{
              height: 17, padding: '0 7px', borderRadius: 9, background: 'rgba(14,17,18,0.86)',
              border: '1px solid rgba(255,255,255,0.12)', color: '#A1A1A1', fontSize: 9, cursor: 'pointer',
            }}
          >Not now</button>
        ) : (
          <span style={{
            display: 'inline-flex', alignItems: 'center', height: 17, padding: '0 7px',
            borderRadius: 9, background: 'rgba(14,17,18,0.86)',
            border: `1px solid ${net >= 0 ? `${M_TEAL}55` : `${M_RED}55`}`,
          }}>
            <Num size={10} weight={700} color={net >= 0 ? M_TEAL : M_RED}>
              {money(net, { sign: true })}
            </Num>
          </span>
        )}
    />
  );

  const roomsColumn = (
      <div className="csn-rooms" style={{
        flex: 1, minHeight: 0, overflow: 'hidden auto', display: 'flex', flexDirection: 'column',
        gap: 10, padding: '11px 14px',
      }}>
        {/* K3 · the one thing that asks for you now */}
        {!trayAgent && focus && (
          <div
            className="csn-hot"
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 12, background: `${M_GOLD}12`, border: `1px solid ${M_GOLD}55`,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: M_GOLD }}>
                {focus.pot ? `${money(focus.pot)} in the middle, ` : 'A big pot is live in '}
                {focus.room.name}
              </div>
              {focus.agent && (
                <div style={{ fontSize: 10, color: '#6B6B6B', marginTop: 2 }}>
                  {focus.agent.name} is in the hand
                </div>
              )}
            </div>
            <Btn h={30} onClick={() => onSpectate?.(focus.tableId)}>
              {focus.agent ? 'Watch him' : 'Watch'}
            </Btn>
          </div>
        )}

        {/* K2 · the board, then the stairs that say the building has floors. On
            the desk the board is in the rail and the stairs stay here, because
            what they say is about the building and not about the evening. */}
        {!trayAgent && !desktop && board}
        {!trayAgent && <Stairs />}

        {rooms.length === 0 ? (
          <div style={{ fontFamily: MONO, fontSize: 11, color: '#6B6B6B', padding: '18px 2px' }}>
            The floor has not opened yet.
          </div>
        ) : doors}

        {/* K1 · the board stays reachable while you are placing him, but the
            decision is the tray, so it reads as two lines and not as five. On
            the desk it never left: the rail is not the stage, so it does not
            have to stand down for the tray. */}
        {trayAgent && !desktop && board}
      </div>
  );

  // BUGS-A: tapping a room opens its tables. Extracted the way DESK-2
  // extracted the tray just below, so both shells render it and neither has to
  // repeat it — it was written when this screen still had one return.
  const roomSheet = openRoom && !trayAgent ? (
    <RoomTablesSheet
      room={openRoom}
      agents={mineByRoom[openRoom.id] ?? []}
      events={events}
      onClose={() => setOpenRoomId(null)}
      onWatch={(tableId) => { setOpenRoomId(null); onSpectate?.(tableId); }}
    />
  ) : null;

  const tray = trayAgent ? (
    <DeployTray
      agent={trayAgent}
      index={Math.max(0, agents.findIndex((a) => a.id === trayAgent.id))}
      room={selectedRoom}
      affordable={canAfford(pocket, selectedRoom)}
      busy={busy}
      onDeal={dealHimIn}
      onFund={() => setFundTarget(trayAgent)}
    />
  ) : null;

  // DESK-2 — the building on the stage, the ticker in the rail. Board 31's
  // frame: the shell's top bar is already across the top, so this is the body.
  if (desktop) {
    return (
      <div className="csn csn--desk" style={{ background: M_BG }}>
        <div className="csn-desk__stage">
          {head}
          {roomsColumn}
          {tray}
          {roomSheet}
        </div>
        <aside className="csn-desk__rail dsk-panel" aria-label="By the stairs">
          <CasinoBoard
            events={events}
            mineIds={mineIds}
            playing={seated}
            full
            max={30}
            stakesFor={stakesForTable}
            onSpectate={onSpectate ? (tableId) => onSpectate(tableId) : null}
          />
        </aside>
      </div>
    );
  }

  return (
    <div
      className="csn"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: M_BG }}
    >
      {head}
      {roomsColumn}
      {tray}
      {roomSheet}
    </div>
  );
}
