// client/src/components/desktop/DeskHome.jsx — DESK-2
//
// HOME at 1440. Board 31 P15–P18, ported from design-refs/mood-home-desk.jsx.
//
// THE REF'S OWN CLAIM, and the whole brief for this file: "Desktop does not
// redraw it — it shows it BIGGER and puts the thread in a permanent rail
// instead of a collapsing sheet, which is the only real difference a 1440
// screen buys. Sheets that arrive from a fixture arrive in the rail."
//
// So there is NO SECOND ROOM here. The room is HomeScreen's, in HomeScreen's
// coordinate space, drawing HomeScreen's bodies from HomeScreen's one socket
// subscription; this file is only the rail beside it, and every panel in that
// rail is a component that already shipped:
//
//   THE ROOM   RoomThread          THREAD-2's /api/home/thread, attributed
//   HIS THREAD ThreadPanel         the desk's own agent thread, unchanged
//   THE SAFE   MoneySheet          YOU-2's one money surface, second door
//   THE FRIDGE FridgeSheet         HOME-1's, mounted inline instead of as glass
//   THE TABLE  TableSheet          the chairs, priced from GET /api/slots
//
// TWO DELIBERATE DEPARTURES FROM THE REF, both stated rather than silent:
//
//   1. THE RAIL IS 520, not the ref's 360. Every other rail in this shell is
//      520 (D_PANEL in mood-desktop.jsx, .dsk-panel in desktop.css) and the
//      agent thread that opens in this rail IS that panel. A rail that changed
//      width depending on which panel was in it would move the room sideways
//      every time you touched a fixture.
//   2. THE WANT TOAST rides the head of the room's thread, which is where the
//      ref puts it (P18) — but it is not drawn when a fixture panel is open,
//      because a fixture panel is a decision and an unanswered ask on top of
//      one is two questions at once.

import { MoneySheet } from '../wallet/MoneySheet.jsx';
import { FridgeSheet } from '../home/FridgeSheet.jsx';
import { RoomThread } from '../home/RoomThread.jsx';
import { TableSheet, useSlots } from '../home/TableSheet.jsx';
import { HomeScreen } from '../../screens/HomeScreen.jsx';
import { StandupPanel } from './StandupPanel.jsx';
import { ThreadPanel } from './ThreadPanel.jsx';
import { PanelHead } from './panelParts.jsx';
import { useHomeThread } from '../../hooks/useHomeThread.js';

/** A fixture panel: the ref's HdPanel, in this shell's own furniture. */
function RailPanel({ title, sub, onClose, children }) {
  return (
    <div className="dsk-panel dsk-panel--home">
      <PanelHead title={title} sub={sub} onClose={onClose} />
      <div className="dsk-rail-body">{children}</div>
    </div>
  );
}

export function DeskHome({
  wsUrl = null,
  wallet = null,
  game = null,
  lastDecision = null,
  watchedId = null,
  onRefreshWallet,
  onWatch,
  onProfile,
  onDeploy,
  onCreateAgent,
  onFocusTable,
  onOpenFlagged,
  drafts = {},
  onDraftChange,
  // DRAFT-2: the draft, when one is under way. It is the SAME BirthScreen the
  // phone renders — the sheet becomes the rail's whole body rather than glass
  // over the room, which is board 31's rule for every panel and the one real
  // difference 1440 buys. The room stays beside it, lit and undimmed, because
  // on the desk you never lose sight of the place he is about to walk into.
  draft = null,
  // The shell owns which panel is up, because two of the things that change it
  // are the shell's: the top bar's Standup, and Escape. 'none' hides the rail
  // entirely, which is what happens when the shell puts its OWN panel (the
  // wallet, a birth card) beside the room — one rail at a time, or the room
  // does not fit at 1440.
  // Null means uncontrolled: the room keeps its own rail state, which is what
  // it does when nothing outside it needs a say.
  panel = null,
  onPanel,
  focusId = null,
  onFocusId,
}) {
  // THREAD-2's room thread. It is read here rather than inside RoomThread so a
  // `say` and the reload it triggers stay owned by the thing that also owns the
  // panel — the same rule DeskWalletPanel follows about the wallet.
  const room = useHomeThread();
  const { slots } = useSlots();

  return (
    <HomeScreen
      desktop
      wsUrl={wsUrl}
      onWatch={onWatch}
      onProfile={onProfile}
      onDeploy={onDeploy}
      onCreateAgent={onCreateAgent}
      panel={panel}
      onPanel={onPanel}
      focusId={focusId}
      onFocusId={onFocusId}
      renderRail={({ panel: open, openPanel, setFocus, agents, home, game: homeGame, focus, toast, refresh }) => {
        const backToRoom = () => openPanel('thread');

        if (open === 'draft' && draft) {
          return <div className="dsk-panel dsk-panel--home draft2--desk">{draft}</div>;
        }

        if (open === 'safe') {
          return (
            // MoneySheet brings its own head, so it is the panel head — one
            // money surface, and the room's name for the door it came through.
            <div className="dsk-panel dsk-panel--home dsk-panel--safe">
              <MoneySheet
                title="The safe"
                wallet={wallet}
                agents={agents}
                onRefresh={async () => { await onRefreshWallet?.(); refresh(); }}
                onClose={backToRoom}
                onOpenProfile={onProfile}
              />
            </div>
          );
        }

        if (open === 'fridge') {
          return (
            <RailPanel title="The fridge" onClose={backToRoom}>
              <FridgeSheet
                variant="rail"
                agents={home}
                onClose={backToRoom}
                onGiven={() => refresh()}
              />
            </RailPanel>
          );
        }

        if (open === 'table') {
          const seated = homeGame?.state === 'running'
            ? (homeGame.seats ?? []).filter((s) => s?.agentId).length
            : 0;
          return (
            <RailPanel
              title="The table"
              sub={`${slots?.used ?? agents.length} / ${slots?.cap ?? 4}`}
              onClose={backToRoom}
            >
              <TableSheet slots={slots} seated={seated} onDraft={onCreateAgent} />
            </RailPanel>
          );
        }

        if (open === 'standup') {
          // Command-Center furniture, in the room's rail. It is not the desk's
          // resting panel any more — the room is — but the standup, the tiles
          // and the flagged rows are all still one click from the top bar
          // button that has always been called Standup.
          return (
            <StandupPanel
              agents={agents}
              loading={false}
              game={game}
              lastDecision={lastDecision}
              selectedId={focus?.id ?? null}
              watchedId={watchedId}
              draft={drafts.__standup__ ?? ''}
              onDraftChange={onDraftChange}
              onSelect={(agent) => setFocus(agent)}
              onOpenTable={(agent) => onFocusTable?.(agent)}
              onDraftAgent={onCreateAgent}
              onOpenFlagged={onOpenFlagged}
            />
          );
        }

        if (open === 'agent' && focus) {
          const index = agents.findIndex((a) => a.id === focus.id);
          return (
            <ThreadPanel
              key={focus.id}
              agent={focus}
              accentIndex={index}
              game={game}
              lastDecision={lastDecision}
              isWatched={watchedId === focus.id}
              draft={drafts[focus.id] ?? ''}
              onDraftChange={onDraftChange}
              onClose={backToRoom}
              onWatch={onWatch}
              onDeploy={onDeploy}
              onFocusTable={onFocusTable ? () => onFocusTable(focus) : undefined}
            />
          );
        }

        return (
          <div className="dsk-panel dsk-panel--home">
            <RoomThread
              lines={room.lines}
              agents={agents}
              loading={room.loading}
              sending={room.sending}
              atHome={home.length}
              onSay={(text) => room.say(text)}
              toast={toast}
            />
          </div>
        );
      }}
    />
  );
}
