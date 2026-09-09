// client/src/components/RosterSheet.test.jsx — BUGS-A job 9
//
// The roster behind the avatar. It answers one question — who have I got and
// where are they — and every row is a door into his thread.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RosterRow, RosterSheet, whereLine, hasUnread, canSendVisiting } from './RosterSheet.jsx';
import { AgentProfileScreen } from '../screens/AgentProfileScreen.jsx';
import { fetchMock, telegram } from '../test/harness.js';

const agent = (id, name, over = {}) => ({
  id,
  name,
  mood: { state: 'neutral', heat: 40 },
  location: { where: 'home', room: null, tableId: null },
  pocket: { balance: 2400 },
  unseenRecap: false,
  want: null,
  ...over,
});

const AT_TABLE = agent('a3', 'Big Slick', {
  status: 'playing',
  location: { where: 'table', room: 'upstairs', tableId: 't1' },
  activeTableId: 't1',
  liveGame: { tableId: 't1', heroStack: 1800, pot: 480 },
});

beforeEach(() => {
  telegram.install();
  telegram.signIn();
});

describe('BUGS-A job 9 · where he is, in the room own words', () => {
  it('BUG-69: a visit and the kitchen table are not labelled as the casino', () => {
    expect(whereLine(agent('v', 'Visitor', { location: { where: 'casino' }, visiting: { hostName: 'Fidde' } }))).toBe("visiting Fidde's");
    expect(whereLine(agent('v', 'Visitor', { visiting: {} }))).toBe('visiting a friend');
    expect(whereLine(agent('h', 'Home', { homeTableId: 'home-4242' }))).toBe('at your table');
  });
  it('at a table names the room he is in', () => {
    expect(whereLine(AT_TABLE)).toBe('at a table · 25/50');
  });

  it('at the casino without a hand yet is still not "at home"', () => {
    expect(whereLine(agent('a1', 'x', { location: { where: 'casino', room: 'floor' } })))
      .toBe('at the casino · 10/20');
  });

  it('home is home', () => {
    expect(whereLine(agent('a1', 'x'))).toBe('at home');
    expect(whereLine({})).toBe('at home');
  });

  it('the dot is about YOU: something said that you have not read', () => {
    expect(hasUnread(agent('a1', 'x'))).toBe(false);
    expect(hasUnread(agent('a1', 'x', { unseenRecap: true }))).toBe(true);
    expect(hasUnread(agent('a1', 'x', { want: { text: 'can I have a beer' } }))).toBe(true);
  });
});

describe('BUGS-A job 9 · the sheet', () => {
  it('BUG-162: roster preserves pocket and casino results during no-stakes Home play', () => {
    render(<RosterRow agent={agent('h','Home player',{homeTableId:'kitchen',liveGame:{tableId:'kitchen',net:75,heroStack:200},pocket:{balance:3000},sessionLog:[{net:-120}]})} index={0} onOpen={()=>{}}/>);
    expect(screen.getByText('$3,000')).toBeInTheDocument();
    expect(screen.getByText('−$120')).toBeInTheDocument();
    expect(screen.queryByText('+$75')).toBeNull();
  });
  it('BUG-69: the C5 row carries a full name, result and actual pocket separately', async () => {
    fetchMock.route('/api/agents', { agents: [{ ...AT_TABLE, name: 'The Very Patient Grinder', liveGame: { tableId: 't1', heroStack: 1800, net: -120 }, pocket: { balance: 410 } }] });
    render(<RosterSheet onOpenThread={() => {}} onClose={() => {}} />);
    const row = await screen.findByRole('button', { name: /^The Very Patient Grinder —/ });
    expect(within(row).getByText('The Very Patient Grinder')).toBeInTheDocument();
    expect(within(row).getByText('−$120')).toBeInTheDocument();
    expect(within(row).getByText('POCKET')).toBeInTheDocument();
    expect(within(row).getByText('$410')).toBeInTheDocument();
  });

  it('BUG-69: a refused roster read is retryable and never claims nobody exists', async () => {
    fetchMock.route('/api/agents', { error: 'Unavailable' }, { status: 503 });
    render(<RosterSheet onOpenThread={() => {}} onClose={() => {}} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not read your agents');
    expect(screen.queryByText('Nobody works for you yet.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });
  it('lists everybody with his whole name, where he is and his pocket', async () => {
    fetchMock.route('/api/agents', { agents: [agent('a1', 'The Clock'), AT_TABLE] });
    render(<RosterSheet onOpenThread={() => {}} onClose={() => {}} />);

    const clock = await screen.findByRole('button', { name: /^The Clock — at home/ });
    expect(within(clock).getByText('The Clock')).toBeInTheDocument();
    expect(within(clock).getByText('at home')).toBeInTheDocument();
    expect(within(clock).getByText('$2,400')).toBeInTheDocument();

    const slick = screen.getByRole('button', { name: /^Big Slick — at a table/ });
    // Board42 C5 explicitly labels this POCKET; Watch carries the live stack.
    expect(within(slick).getByText('$2,400')).toBeInTheDocument();
    expect(within(slick).getByText('at a table · 25/50')).toBeInTheDocument();
  });

  it('the row is the way into his thread', async () => {
    const user = userEvent.setup();
    const onOpenThread = vi.fn();
    fetchMock.route('/api/agents', { agents: [agent('a1', 'The Clock')] });
    render(<RosterSheet onOpenThread={onOpenThread} onClose={() => {}} />);

    await user.click(await screen.findByRole('button', { name: /^The Clock — / }));
    expect(onOpenThread).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));
  });

  it('marks the ones who have said something unread, and only those', async () => {
    fetchMock.route('/api/agents', {
      agents: [agent('a1', 'The Clock'), agent('a2', 'River Rat', { unseenRecap: true })],
    });
    render(<RosterSheet onOpenThread={() => {}} onClose={() => {}} />);

    await screen.findByRole('button', { name: /^The Clock — / });
    expect(screen.queryByTestId('roster-unread-a1')).toBeNull();
    expect(screen.getByTestId('roster-unread-a2')).toBeInTheDocument();
  });

  it('claims no count until the roster has answered', async () => {
    let answer;
    fetchMock.route('/api/agents', () => new Promise((resolve) => { answer = resolve; }));
    render(<RosterSheet onOpenThread={() => {}} onClose={() => {}} />);

    expect(screen.getByText('Reading the room…')).toBeInTheDocument();
    expect(screen.queryByText('Nobody works for you yet.')).toBeNull();

    answer({ agents: [agent('a1', 'The Clock')] });
    await screen.findByRole('button', { name: /^The Clock — / });
    expect(screen.getByText('1 agent · 0 live')).toBeInTheDocument();
  });

  it('an owner with nobody is offered the one thing that fills it', async () => {
    const user = userEvent.setup();
    const onCreateAgent = vi.fn();
    fetchMock.route('/api/agents', { agents: [] });
    render(<RosterSheet onOpenThread={() => {}} onClose={() => {}} onCreateAgent={onCreateAgent} />);

    expect(await screen.findByText('Nobody works for you yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Make an agent' }));
    expect(onCreateAgent).toHaveBeenCalled();
  });

  it('closes on the scrim and on the ✕', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    fetchMock.route('/api/agents', { agents: [] });
    const { container } = render(<RosterSheet onOpenThread={() => {}} onClose={onClose} />);
    await waitFor(() => expect(container.querySelector('.roster__scrim')).not.toBeNull());

    await user.click(container.querySelector('.roster__scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(container.querySelector('.roster__close'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

// ── HOME-2 job 1 ────────────────────────────────────────────────────────────
//
// YOU is this sheet, and the money is behind it — as ONE LINE, which is the
// ref's own shape (mood-nav.jsx: "the money is a line, not a section: the
// wallet screen lives behind it"). Neither tap draws money here; both are doors
// onto YOU-2's single money surface.

describe('HOME-2 job 1 · the money is a line at the foot of the roster', () => {
  it('states the balance and offers the two doors behind it', async () => {
    fetchMock.route('/api/agents', { agents: [agent('a1', 'The Clock')] });
    fetchMock.route('/api/wallet', { balance: 4280, staked: 0, entries: [] });
    render(
      <RosterSheet
        onOpenThread={() => {}}
        onClose={() => {}}
        onOpenMoney={() => {}}
        onOpenLedger={() => {}}
      />,
    );

    expect(await screen.findByText('YOUR WALLET')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('roster-wallet')).toHaveTextContent('4,280'));
    expect(screen.getByTestId('roster-ledger')).toBeInTheDocument();
  });

  it('the two doors are the caller’s, and the sheet only opens them', async () => {
    const user = userEvent.setup();
    const onOpenMoney = vi.fn();
    const onOpenLedger = vi.fn();
    fetchMock.route('/api/agents', { agents: [] });
    fetchMock.route('/api/wallet', { balance: 4280, staked: 0, entries: [] });
    render(
      <RosterSheet
        onOpenThread={() => {}}
        onClose={() => {}}
        onOpenMoney={onOpenMoney}
        onOpenLedger={onOpenLedger}
      />,
    );

    await user.click(await screen.findByTestId('roster-wallet'));
    expect(onOpenMoney).toHaveBeenCalled();
    await user.click(screen.getByTestId('roster-ledger'));
    expect(onOpenLedger).toHaveBeenCalled();
  });

  // A deployment with no wallet answers nothing, and the line says so rather
  // than inventing a balance — WUI-1's law, unchanged.
  it('a deployment with no wallet shows a dash, not a zero', async () => {
    fetchMock.route('/api/agents', { agents: [] });
    render(<RosterSheet onOpenThread={() => {}} onClose={() => {}} onOpenMoney={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('roster-wallet')).toHaveTextContent('—'));
  });

  // BUGS-A job 9's sheet is still reachable from callers that know nothing
  // about money: no handlers, no line.
  it('draws no money line for a caller that offers no door', async () => {
    fetchMock.route('/api/agents', { agents: [] });
    render(<RosterSheet onOpenThread={() => {}} onClose={() => {}} />);

    await screen.findByText('Nobody works for you yet.');
    expect(screen.queryByTestId('roster-wallet')).toBeNull();
  });
});

// ── VISIT-1 · "Send to a friend" ─────────────────────────────────────────────

describe('VISIT-1 · send him to a friend', () => {
  it('is offered only for a body that is home, and not already out visiting', () => {
    expect(canSendVisiting(agent('a1', 'x'))).toBe(true);
    expect(canSendVisiting(AT_TABLE)).toBe(false);
    expect(canSendVisiting(agent('a1', 'x', { visiting: { hostName: null } }))).toBe(false);
  });

  it('a home body gets the button; one already out visiting does not', async () => {
    // C5 is one compact navigation row. The preserved visit action now lives
    // beside the other agent actions in the profile's existing More menu.
    const user = userEvent.setup();
    const view = render(<AgentProfileScreen agent={agent('a1', 'The Clock')} />);
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('button', { name: 'Send to a friend' })).toBeInTheDocument();
    view.rerender(<AgentProfileScreen agent={agent('a2', 'River Rat', { visiting: { hostName: null } })} />);
    expect(screen.queryByRole('button', { name: 'Send to a friend' })).toBeNull();
  });

  it('the visit action copies the same link without opening his thread', async () => {
    const user = userEvent.setup();
    const onOpenThread = vi.fn();
    fetchMock.route('/api/auth/config', { botUsername: 'AigenicPokerBot' });
    fetchMock.route('/api/agents', { agents: [agent('a1', 'The Clock')] });
    // BUG-150: preserve navigation assertions, replacing the unsafe public-id link.
    fetchMock.route('/api/agents/a1/visit-invite', { agentId:'a1', agentName:'The Clock', invitationToken:'invitation1', expiresAt:Date.now()+3600000, maxStake:0, startParam:'visit_invitation1' }, { method:'POST' });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue() }, configurable: true,
    });
    render(<AgentProfileScreen agent={agent('a1', 'The Clock')} onOpenChat={onOpenThread} />);

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Send to a friend' }));
    expect(onOpenThread).not.toHaveBeenCalled();
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'The Clock wants a game at your place in Railbird. Open this invitation to let him in. Free home game · no chips staked.\n\nhttps://t.me/AigenicPokerBot?start=visit_invitation1',
    ));
    expect(await screen.findByText('Invitation copied. Paste it to your friend.')).toBeInTheDocument();
  });
});

 // BUG-162 supersedes BUG-131's money assertion: the 1/2 kitchen pot is
 // practice play, so its +95 is not a dollar result. Live/stakes remain real.
 it('BUG-131 / BUG-162: a visiting table keeps live/stakes but not practice winnings as money',()=>{
 const traveler={id:'v1',name:'Traveler',visiting:{hostName:'Fidde'},homeTableId:'home-friend',location:{where:'casino'},liveGame:{tableId:'home-friend',blinds:'1/2',net:95},pocket:{balance:410}};
 render(<ul><RosterRow agent={traveler} index={0} onOpen={()=>{}}/></ul>);
 expect(screen.getByRole('img',{name:'Live at a table'})).toBeInTheDocument();expect(screen.getByText('1/2',{exact:true})).toBeInTheDocument();expect(screen.queryByText('+$95',{exact:true})).toBeNull();
 expect(screen.getByTitle('Last session result')).toHaveTextContent('—');
 expect(screen.getByText('$410',{exact:true})).toBeInTheDocument();
 });
