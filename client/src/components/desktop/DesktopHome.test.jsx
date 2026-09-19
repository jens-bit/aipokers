// client/src/components/desktop/DesktopHome.test.jsx — ATTR-2e-4
//
// DesktopHome is the desktop shell: it owns which surface the panel is showing
// and the per-agent draft map. The behaviour worth pinning is the promise
// DSK2-2 made — a half-typed message survives switching agents, because the
// panel remounts and the map does not.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DesktopHome } from './DesktopHome.jsx';
import { agentsResponse, playingAgent, restingAgent } from '../../test/fixtures/agents.js';
import { midHandGame } from '../../test/fixtures/game.js';
import { fetchMock, telegram } from '../../test/harness.js';

function renderHome(props = {}) {
  return render(
    <DesktopHome
      onWatchAgent={() => {}}
      onDeployAgent={() => {}}
      onCreateAgent={() => {}}
      {...props}
    />,
  );
}

// Every agent appears twice on this shell: once as a ghost on the floor, once
// as a roster row in the panel. These helpers pick the roster row, the way
// CasinoFloor.test.jsx picks occupants.
// DEFLAKE-1: this used to be `getAllByRole('button', { name: new RegExp(name) })`
// scoped to the roster, and that one query cost about A FULL SECOND on this
// shell — measured at 970ms for a single call. Computing an accessible name
// means walking each row's whole subtree, and a roster row carries a MoodGhost
// (a decorative SVG face), a whereabouts line, a money figure and a BodyBars
// dot pair. `waitFor` wraps its callback in act(), so that second was spent
// inside a 1000ms default timeout: locally it landed at ~980ms and passed, and
// on a CI runner a few percent slower it did not. That is the whole flake.
//
// The row is a real <button> carrying the agent's name in a span of its own,
// so it can be found exactly and in microseconds. This is STRICTER than the
// regexp it replaces — an exact name rather than a substring — and it still
// throws when the row is absent, which is what lets waitFor below wait on the
// row appearing rather than on a clock.
function rosterRow(name) {
  const row = [...screen.getByTestId('desk-roster').querySelectorAll('button.dsk-roster-row')]
    .find((el) => el.querySelector('.dsk-roster-row__name')?.textContent === name);
  if (!row) throw new Error(`no roster row for ${name}`);
  return row;
}

// DESK-2: the desk opens on the ROOM — the flat, as the phone's HOME tab shows
// it — so the standup is one click away rather than already up. Everything
// below that used to start from the standup starts from this instead; the rules
// they pin (the roster is complete, a row opens his thread, the draft map
// survives a switch, Escape backs out) are unchanged.
async function openStandup() {
  await userEvent.click(within(document.querySelector('.dsk-top')).getByRole('button', { name: /Standup/ }));
  await waitFor(() => rosterRow(playingAgent.name));
}

async function openAgent(name) {
  // The permanent roster is available from Home; opening Standup first only
  // mounts an unrelated panel before every thread switch. Standup has its own
  // navigation assertions below.
  await waitFor(() => rosterRow(name));
  await userEvent.click(rosterRow(name));
}

// "Standup" is both the panel head and the top bar's pill label.
function panelHead(text) {
  return screen
    .getAllByText(text)
    .some((el) => el.classList.contains('dsk-panel-head__title'));
}

describe('DesktopHome roster', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
    fetchMock.route('/hands', { recentHands: [] });
  });

  it('FIRST-CHAT-1: a refused live table whisper restores its draft and shows an application alert outside the conversation', async () => {
    const liveAgent = { ...playingAgent, location: { where: 'table', tableId: playingAgent.liveGame.tableId, room: 'floor' } };
    fetchMock.route('/api/agents', { agents: [liveAgent] });
    fetchMock.route('/api/agents/chat', { status: 503, body: {} });
    const { container } = renderHome({ isWatching: true, watchingAgent: liveAgent, game: midHandGame });
    fireEvent.click(await screen.findByTestId('home-tv'));
    const input = await screen.findByPlaceholderText('Whisper to him…');
    fireEvent.change(input, { target: { value: 'Take your time.' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not send your message. Please try again.');
    expect(alert.closest('.thread-row')).toBeNull();
    expect(input).toHaveValue('Take your time.');
    expect([...container.querySelectorAll('.thread-row')].some(row => row.textContent.includes('Take your time.'))).toBe(false);

    fetchMock.route('/api/agents/chat', { chat: [{ role: 'assistant', content: 'I cannot answer that right now.' }], replyUnavailable: true });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByText('I cannot answer that right now.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(input).toHaveValue('');
    expect(fetchMock.requestsMatching('/api/agents/chat')).toHaveLength(2);
  });

  it.each(['television', 'away frame'])('BUG-172: the %s puts the selected live table on the desktop stage and Back restores the room', async (entry) => {
    const liveAgent = { ...playingAgent, location: { where: 'table', tableId: playingAgent.liveGame.tableId, room: 'floor' } };
    fetchMock.route('/api/agents', { agents: [liveAgent, restingAgent] });
    const watch = vi.fn(), leave = vi.fn();
    renderHome({ onWatchAgent: watch, onLeave: leave });
    const target = await screen.findByTestId(entry === 'television' ? 'home-tv' : `home-frame-${playingAgent.id}`);
    await userEvent.click(target);
    expect(watch).toHaveBeenCalledOnce();
    expect(watch).toHaveBeenCalledWith(expect.objectContaining({ id: playingAgent.id }));
    expect(await screen.findByTestId('desk-casino-table')).toHaveAccessibleName(`${playingAgent.name} at the table`);
    expect(screen.queryByTestId('home-tv')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'BACK TO THE FLOOR', exact: true }));
    expect(await screen.findByTestId('home-tv')).toBeInTheDocument();
    expect(leave).toHaveBeenCalledOnce();
  });

  it('BUG-172: opening the already watched agent from the TV changes the stage without subscribing twice', async () => {
    const liveAgent = { ...playingAgent, location: { where: 'table', tableId: playingAgent.liveGame.tableId, room: 'floor' } };
    fetchMock.route('/api/agents', { agents: [liveAgent, restingAgent] });
    const watch = vi.fn();
    renderHome({ onWatchAgent: watch, isWatching: true, watchingAgent: playingAgent, tableConfig: { tableId: playingAgent.liveGame.tableId } });
    await userEvent.click(await screen.findByTestId('home-tv'));
    expect(watch).not.toHaveBeenCalled();
    expect(await screen.findByTestId('desk-casino-table')).toHaveAccessibleName(`${playingAgent.name} at the table`);
  });

  it('WATCH-MULTI-1: an agent who moved tables needs a new subscription and cannot show the old pot', async () => {
    const agent = { ...playingAgent, activeTableId: 'new-table', liveGame: { ...playingAgent.liveGame, tableId: 'new-table' },
      location: { where: 'table', tableId: 'new-table', room: 'floor' } };
    fetchMock.route('/api/agents', { agents: [agent] });
    const watch = vi.fn();
    renderHome({ onWatchAgent: watch, isWatching: true, watchingAgent: agent,
      tableConfig: { tableId: 'old-table' }, game: { ...midHandGame, tableId: 'old-table', pot: 999777 } });
    fireEvent.click(await screen.findByTestId('home-tv'));
    expect(watch).toHaveBeenCalledWith(expect.objectContaining({ id: agent.id, activeTableId: 'new-table' }));
    const felt = await screen.findByTestId('desk-casino-table');
    expect(felt).not.toHaveTextContent('999,777');
  });

  it('WATCH-MULTI-1: returning home preserves the selected table result and hand log until Back', async () => {
    const agent = { ...playingAgent, location: { where: 'table', tableId: midHandGame.tableId, room: 'floor' } };
    fetchMock.route('/api/agents', { agents: [agent] });
    fetchMock.route('/thread?', { lines: [] });
    const finalGame = { ...midHandGame, street: 'complete', toAct: null, sessionId: 'ended-session',
      result: { type: 'uncontested', winners: [{ seat: 0, amount: 100 }], deltas: [40, -20, -20] } };
    const leave = vi.fn();
    renderHome({ isWatching: true, watchingAgent: agent, tableConfig: { tableId: finalGame.tableId },
      game: finalGame, mySeat: 0, connection: 'closed', sessionEnd: { reason: 'Session complete' }, onLeave: leave,
      threadLines: [{ id: 'last-result', kind: 'table', category: 'result', sessionId: 'ended-session',
        text: 'The last pot was yours.', ts: 1234 }] });
    fireEvent.click(await screen.findByTestId('home-tv'));
    expect(screen.getByTestId('desk-casino-table').querySelector('.action-narrator'))
      .toHaveTextContent('The Grinder took $100 uncontested.');
    fireEvent.click(screen.getByRole('button', { name: 'Hand log', exact: true }));
    expect(await screen.findByText('The last pot was yours.')).toBeInTheDocument();

    fetchMock.route('/api/agents', { agents: [{ ...agent, status: 'idle', presence: 'resting',
      activeTableId: null, liveGame: null, location: { where: 'home', tableId: null, room: null } }] });
    fireEvent(window, new Event('focus'));
    await waitFor(() => expect(rosterRow(agent.name).querySelector('.dsk-roster-place')).toHaveTextContent('at home'));
    expect(screen.getByTestId('desk-casino-table').querySelector('.action-narrator'))
      .toHaveTextContent('The Grinder took $100 uncontested.');
    expect(screen.getByText('The last pot was yours.')).toBeInTheDocument();
    expect(leave).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'BACK TO THE FLOOR', exact: true }));
    expect(await screen.findByTestId('home-tv')).toBeInTheDocument();
    expect(leave).toHaveBeenCalledOnce();
  });

  it('BUG-157: desktop does not offer a first agent or claim an empty flat during the initial roster read', async () => {
    const answers = [];
    fetchMock.route('/api/agents', () => new Promise(resolve => answers.push(resolve)));
    renderHome();
    const roster = await screen.findByTestId('desk-roster');
    expect(within(roster).queryByText('0 of 4')).toBeNull();
    expect(within(roster).queryByRole('button', { name: /Draft your first agent/ })).toBeNull();
    expect(screen.queryByTestId('room-thread-empty-flat')).toBeNull();
    expect(within(roster).getByText('Reading the room…')).toBeInTheDocument();
    answers.forEach(answer => answer(agentsResponse));
    await waitFor(() => expect(within(roster).getByText('2 of 4')).toBeInTheDocument());
    expect(within(roster).queryByText('Reading the room…')).toBeNull();
  });

  it('BUG-157: a failed first desktop roster read is not a confirmed empty household', async () => {
    fetchMock.route('/api/agents', { status: 503, body: {} });
    renderHome();
    await waitFor(() => expect(fetchMock.calls.some(c => c.url.includes('/api/agents'))).toBe(true));
    const roster = screen.getByTestId('desk-roster');
    expect(within(roster).queryByText('0 of 4')).toBeNull();
    expect(within(roster).queryByRole('button', { name: /Draft your first agent/ })).toBeNull();
    expect(screen.queryByTestId('room-thread-empty-flat')).toBeNull();
  });

  it('BUG-157: a later valid desktop read recovers from the failed first read without losing saved agents', async () => {
    fetchMock.route('/api/agents', { status: 503, body: {} });
    renderHome();
    await waitFor(() => expect(fetchMock.calls.some(c => c.url.includes('/api/agents'))).toBe(true));
    fetchMock.route('/api/agents', agentsResponse);
    fireEvent(window, new Event('focus'));
    await waitFor(() => expect(within(screen.getByTestId('desk-roster')).getByText('2 of 4')).toBeInTheDocument());
    expect(rosterRow(playingAgent.name)).toBeInTheDocument();
    expect(rosterRow(restingAgent.name)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Draft your first agent/ })).toBeNull();
  });

  it('BUG-88: the first draft occupies the rail beside its actual empty room', async () => {
    fetchMock.route('/api/agents', { agents: [] });
    renderHome({ draft: <div data-testid="first-recruiter">One open seat.</div> });
    await waitFor(() => expect(screen.getByTestId('home-rail')).toHaveAttribute('data-panel', 'draft'));
    expect(screen.getByTestId('home-rail')).toContainElement(screen.getByTestId('first-recruiter'));
    expect(screen.getByTestId('home-screen').querySelector('.home-flat')).toBeInTheDocument();
    expect(screen.queryByTestId('home-ftu')).toBeNull();
  });

  it('sends the Telegram initData header when reading the roster (FLOOR-3)', async () => {
    renderHome();
    // Two things read the roster on this shell now — the desk itself, and the
    // room on its stage — so the rule is asserted of EVERY read rather than of
    // whichever one happened to be first. Header names are case-insensitive on
    // the wire and the two callers spell it differently.
    await waitFor(() => {
      const reads = fetchMock.calls.filter((c) => c.url.includes('/api/agents?'));
      expect(reads.length).toBeGreaterThan(0);
      for (const call of reads) {
        const sent = Object.entries(call.headers ?? {})
          .find(([k]) => k.toLowerCase() === 'x-telegram-init-data');
        expect(sent?.[1]).toBeTruthy();
      }
    });
  });

  // SUPERSEDED RULE, deliberately: DESK-2 makes the desk open on the room, not
  // on the standup. HOME is the flat on both platforms now (board 31 P15), and
  // the standup is Command Center furniture reached from the button that has
  // always been named after it. What is still pinned is the other half of the
  // old assertion — the desk does not open on a thread.
  it('opens on the room, with the standup one click away', async () => {
    renderHome();
    await waitFor(() => expect(screen.getByTestId('home-screen')).toBeInTheDocument());
    expect(screen.getByTestId('room-thread')).toBeInTheDocument();
    expect(within(screen.getByTestId('home-rail')).queryByRole('button', { name: 'Profile', exact: true })).not.toBeInTheDocument();

    await openStandup();
    expect(panelHead('Standup')).toBe(true);
  });

  it('lists every agent in the stable', async () => {
    renderHome();
    await openStandup();
    expect(rosterRow(playingAgent.name)).toBeInTheDocument();
    expect(rosterRow(restingAgent.name)).toBeInTheDocument();
  });
});

describe('DesktopHome panel', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
    fetchMock.route('/hands', { recentHands: [] });
  });

  it('opens that agent thread when a roster row is chosen', async () => {
    renderHome();
    await openAgent(restingAgent.name);

    await waitFor(() => {
      expect(within(screen.getByTestId('home-rail')).getByRole('button', { name: 'Profile', exact: true })).toBeInTheDocument();
    });
  });

  it('keeps a half-typed draft when the open agent changes', async () => {
    // Search the real conversation rail. Walking every decorative room SVG
    // for each accessible-role query obscures this draft-preservation check.
    const rail = () => within(screen.getByTestId('home-rail'));
    renderHome();
    await openAgent(restingAgent.name);

    const composer = await rail().findByRole('textbox');
    await userEvent.type(composer, 'tighten up');
    expect(composer).toHaveValue('tighten up');

    // Away to the other agent — his composer is his own, and empty.
    await userEvent.click(rail().getByRole('button', { name: /close panel/i }));
    await openAgent(playingAgent.name);
    expect(await rail().findByRole('textbox')).toHaveValue('');

    // Back again — the draft is where it was left.
    await userEvent.click(rail().getByRole('button', { name: /close panel/i }));
    await openAgent(restingAgent.name);
    await waitFor(() => expect(rail().getByRole('textbox')).toHaveValue('tighten up'));
  });

  it('closes the panel on Escape', async () => {
    renderHome();
    await openAgent(restingAgent.name);
    await waitFor(() => expect(within(screen.getByTestId('home-rail')).getByRole('button', { name: 'Profile', exact: true })).toBeInTheDocument());

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(within(screen.getByTestId('home-rail')).queryByRole('button', { name: 'Profile', exact: true })).not.toBeInTheDocument();
    });
    // ...and back to the resting panel, which on the HOME stage is the room.
    expect(screen.getByTestId('room-thread')).toBeInTheDocument();
  });
});


it('BUG-107: a newly arrived agent opens his birth card and can be dealt in', async () => {
  telegram.signIn();
  fetchMock.route('/api/agents', agentsResponse);
  fetchMock.route('/hands', { recentHands: [] });
  const onDeployAgent = vi.fn();
  renderHome({ onDeployAgent });
  await openAgent(restingAgent.name);
  expect(screen.getByTestId('home-rail')).toHaveAttribute('data-panel', 'agent');
  const newborn = { ...restingAgent, id: 'newborn-107', name: 'New Arrival' };
  fetchMock.route('/api/agents', { agents: [...agentsResponse.agents, newborn] });
  fireEvent.focus(window);
  // The birth card lives in its own rail. Scanning every decorative room SVG
  // with findByRole can exhaust the CI test's budget (BUG-107).
  const birthTitle = await screen.findByText('The card he was born with');
  const birthPanel = within(birthTitle.closest('.dsk-panel'));
  expect(birthPanel.getByText(newborn.name.toUpperCase())).toBeInTheDocument();
  const deal = birthPanel.getByRole('button', { name: 'Deal him in' });
  await userEvent.click(deal);
  expect(onDeployAgent).toHaveBeenCalledOnce();
  expect(onDeployAgent).toHaveBeenCalledWith(expect.objectContaining({ id: newborn.id }));
  expect(within(screen.getByTestId('home-rail')).queryByRole('button', { name: 'Profile', exact: true })).not.toBeInTheDocument();
});

it.each([true, false])('a birth handled by the draft never opens a second birth card (draft still open: %s)', async (stillDrafting) => {
  telegram.signIn();
  fetchMock.route('/api/agents', { agents: [] });
  const draft = <div data-testid="first-recruiter">One open seat.</div>;
  const { rerender } = renderHome({ draft });
  await waitFor(() => expect(screen.getByTestId('home-rail')).toHaveAttribute('data-panel', 'draft'));
  const newborn = { ...restingAgent, id: 'first-newborn', name: 'New Arrival' };
  if (!stillDrafting) rerender(<DesktopHome birthHandledId={newborn.id} />);
  fetchMock.route('/api/agents', { agents: [newborn] });
  fireEvent.focus(window);
  await waitFor(() => expect(document.querySelector('.dsk-top')).toHaveTextContent('1 home'));
  expect(screen.queryByText('The card he was born with')).not.toBeInTheDocument();
  if (stillDrafting) expect(screen.getByTestId('first-recruiter')).toBeInTheDocument();
});
