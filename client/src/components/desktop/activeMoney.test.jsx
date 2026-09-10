import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { DesktopHome } from './DesktopHome.jsx';
import { WatchScreen } from '../WatchScreen.jsx';
import { playingAgent } from '../../test/fixtures/agents.js';
import { midHandGame, spectatorConfig } from '../../test/fixtures/game.js';
import { fetchMock, telegram } from '../../test/harness.js';

const nativeLocale = Number.prototype.toLocaleString;
beforeEach(() => {
  telegram.signIn();
  vi.spyOn(Number.prototype, 'toLocaleString').mockImplementation(function (locale, options) {
    return nativeLocale.call(this, locale ?? 'sv-SE', options);
  });
  fetchMock.route('/hands', { recentHands: [] });
});

it.each([[12500.5, '+$12,500.50'], [-12500.5, '−$12,500.50']])(
  'BUG-37: active desktop header and tapped Standup roster agree for net %s on a Swedish device', async (net, expected) => {
    expect((12500.5).toLocaleString()).toBe('12\u00a0500,5');
    const agent = { ...playingAgent, careerStats: { ...playingAgent.careerStats, net } };
    fetchMock.route('/api/agents', { agents: [agent] });
    const { container } = render(<DesktopHome onWatchAgent={() => {}} onCreateAgent={() => {}} />);
    await waitFor(() => expect(container.querySelector('.dsk-top__result strong')?.textContent).toContain('$'));
    expect.soft(container.querySelector('.dsk-top__result strong').textContent).toBe(expected);
    await userEvent.click(screen.getByRole('button', { name: 'Standup — all-time result' }));
    await waitFor(() => expect(container.querySelector('.dsk-panel .dsk-roster-row__pnl')).toBeTruthy());
    expect(container.querySelector('.dsk-panel .dsk-roster-row__pnl').textContent).toBe(expected);
  },
);

it.each([0, undefined])('BUG-37: Standup retains its existing no-result dash for net %s', async net => {
  const agent = { ...playingAgent, careerStats: { ...playingAgent.careerStats, net } };
  fetchMock.route('/api/agents', { agents: [agent] });
  const { container } = render(<DesktopHome onWatchAgent={() => {}} onCreateAgent={() => {}} />);
  await waitFor(() => expect(container.querySelector('.dsk-top__result strong')?.textContent).toBe('+$0'));
  await userEvent.click(screen.getByRole('button', { name: 'Standup — all-time result' }));
  await waitFor(() => expect(container.querySelector('.dsk-panel .dsk-roster-row__pnl')?.textContent).toBe('—'));
});

it.each(['bet', 'raise'])('BUG-37: the active Watch %s label groups its actual amount with the existing currency mark', type => {
  fetchMock.route('/api/agents', { agents: [playingAgent] });
  const { container } = render(<WatchScreen game={midHandGame} mySeat={0} config={spectatorConfig}
    lastDecision={{ seat: 0, action: { type, amount: 12500.5 }, reasoning: 'Public fixture decision.' }}
    chatMessages={[]} sendChat={() => {}} onLeave={() => {}} onSitOut={() => {}} />);
  expect(container.querySelector('.watch-felt__action-chip').textContent).toBe(`${type.toUpperCase()} $12,500.50`);
});

it.each(['fold', 'check', 'call'])('BUG-37: Watch keeps the existing amount-free %s action copy', type => {
  const { container } = render(<WatchScreen game={midHandGame} mySeat={0} config={spectatorConfig}
    lastDecision={{ seat: 0, action: { type, amount: 12500 } }}
    chatMessages={[]} sendChat={() => {}} onLeave={() => {}} onSitOut={() => {}} />);
  expect(container.querySelector('.watch-felt__action-chip').textContent).toBe(type.toUpperCase());
});
