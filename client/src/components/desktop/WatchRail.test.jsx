// client/src/components/desktop/WatchRail.test.jsx — ATTR-2e-4
//
// The analysis rail has one job that is easy to get wrong: it must go quiet
// with the stage between hands. A live equity readout left standing over a
// cleared table is a lie about a hand nobody is playing.
//
// It also holds rows open for reads the engine does not produce yet, rather
// than swapping in different content — the DSK2-3 placeholder pattern.

import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WatchRail } from './WatchRail.jsx';
import { playingAgent } from '../../test/fixtures/agents.js';
import { midHandGame, betweenHandsGame } from '../../test/fixtures/game.js';

const decision = { seat: 0, equity: 0.874, action: { type: 'bet', amount: 240 }, reasoning: 'He is capped.' };

function renderRail(props = {}) {
  return render(
    <WatchRail
      agent={playingAgent}
      game={midHandGame}
      lastDecision={decision}
      heroSeat={0}
      hands={[]}
      draft=""
      onDraftChange={() => {}}
      onSend={() => {}}
      {...props}
    />,
  );
}

describe('WatchRail mid-hand', () => {
  it('names the agent and says he is at the table', () => {
    renderRail();
    expect(screen.getByText(playingAgent.name)).toBeInTheDocument();
    expect(screen.getByText('AT THE TABLE')).toBeInTheDocument();
  });

  it('reports equity as a percentage, not the raw 0..1 fraction', () => {
    renderRail();
    expect(screen.getByText('87.4%')).toBeInTheDocument();
    expect(screen.queryByText(/0\.874/)).not.toBeInTheDocument();
  });

  // WATCH-6 re-expressed: board 31 puts THE TABLE at the top of the rail, so
  // his line is now in two places on purpose — the record keeps it, and the
  // analysis panel still leads with it. Both are his voice; neither is a
  // paraphrase.
  it('carries his reasoning in his own voice', () => {
    const { container } = renderRail();
    expect(container.querySelector('.dsk-apanel__voice').textContent)
      .toContain('He is capped');
    const row = [...container.querySelectorAll('.thread-row')]
      .find((el) => el.textContent.includes('He is capped'));
    expect(row.querySelector('.thread-row__who').textContent).toBe('HIM');
  });

  it('leads with the record, per board 31', () => {
    const { container } = renderRail();
    const titles = [...container.querySelectorAll('.dsk-apanel .dsk-label')]
      .map((el) => el.textContent);
    expect(titles[0]).toBe('The table');
  });

  it('holds the unmodelled reads open with an em dash rather than hiding them', () => {
    renderRail();
    expect(screen.getByText('Fold equity')).toBeInTheDocument();
    expect(screen.getByText('Solver line')).toBeInTheDocument();
    expect(screen.getByText(/not modelled yet/i)).toBeInTheDocument();
  });
});

describe('WatchRail between hands', () => {
  it('switches the head to BETWEEN HANDS', () => {
    renderRail({ game: betweenHandsGame });
    expect(screen.getByText('BETWEEN HANDS')).toBeInTheDocument();
  });

  it('drops the live reads — there is no hand to have a read on', () => {
    renderRail({ game: betweenHandsGame });
    expect(screen.queryByText('Equity')).not.toBeInTheDocument();
    expect(screen.queryByText('Fold equity')).not.toBeInTheDocument();
  });

  it('shows the session numbers instead', () => {
    renderRail({ game: betweenHandsGame });
    expect(screen.getByText('This session')).toBeInTheDocument();
    expect(screen.getByText('Biggest pot')).toBeInTheDocument();
  });

  it('says so plainly when no hand has finished yet', () => {
    renderRail({ game: betweenHandsGame, hands: [] });
    expect(screen.getByText(/no finished hands this session yet/i)).toBeInTheDocument();
  });
});


it('BUG-105: public viewing shows only supplied table speech, without private actions',()=>{
  renderRail({readOnly:true,agent:null,lastDecision:null,stored:[{id:'public-line',kind:'table',who:'Granite',text:'Good hand.',t:1}]});
  expect(screen.getByText('Good hand.')).toBeVisible();
  expect(screen.queryByPlaceholderText('Whisper to him…')).toBeNull();
  expect(screen.queryByText('Live analysis')).toBeNull();
  expect(screen.queryByText('History')).toBeNull();
});


it('DkWatch: the current conversation rail retains speech and whisper without the old analysis panels',()=>{
  renderRail({conversationOnly:true,stored:[{id:'table-line',kind:'table',who:'Granite',text:'Good hand.',t:1}]});
  expect(screen.getByText('Good hand.')).toBeVisible();
  expect(screen.getByPlaceholderText('Whisper to him…')).toBeVisible();
  expect(screen.queryByText('Live analysis')).toBeNull();
  expect(screen.queryByText('History')).toBeNull();
  expect(screen.queryByText('He is capped.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Hand log' }));
  expect(screen.getByText('He is capped.')).toBeVisible();
});

const categorized = [
  { id: 'action', kind: 'table', who: 'TABLE', text: 'Granite bet 10.', category: 'action', t: 1 },
  { id: 'decision', kind: 'him', who: 'HIM', text: 'Stored routine reasoning.', category: 'decision', t: 2 },
  { id: 'reply', kind: 'him', who: 'HIM', text: 'Yes, I heard you.', category: 'chat', t: 3 },
  { id: 'result', kind: 'table', who: 'TABLE', text: 'Your agent won 40.', category: 'result', t: 4 },
  { id: 'session', kind: 'table', who: 'TABLE', text: 'This session ended.', category: 'session', t: 5 },
  { id: 'cost', kind: 'table', who: 'TABLE', text: 'A costly mistake.', category: 'action', cost: true, t: 6 },
  { id: 'legacy', kind: 'him', who: 'HIM', text: 'Older speech without metadata.', t: 7 },
  { id: 'future', kind: 'table', who: 'TABLE', text: 'An event this client cannot classify.', category: 'future-kind', t: 8 },
];

it('FIRST-WATCH-1: Chat defaults to speech, results and important events while retaining unknown history', () => {
  renderRail({ conversationOnly: true, stored: categorized });
  expect(screen.getByText('Watching your agent')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Hand log' })).toHaveAttribute('aria-pressed', 'false');
  for (const row of categorized.slice(2)) expect(screen.getByText(row.text)).toBeVisible();
  expect(screen.queryByText('Granite bet 10.')).toBeNull();
  expect(screen.queryByText('Stored routine reasoning.')).toBeNull();
  expect(screen.queryByText('He is capped.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Hand log' }));
  for (const row of categorized) expect(screen.getByText(row.text)).toBeVisible();
  expect(screen.getByText('He is capped.')).toBeVisible();
});

it('FIRST-WATCH-1: switching views preserves the draft, submit action and incoming speech', () => {
  const send = vi.fn();
  function ControlledRail() {
    const [draft, setDraft] = useState('A message in progress');
    return <WatchRail conversationOnly agent={playingAgent} game={midHandGame} heroSeat={0}
      stored={categorized} thread={[{ _id: 'new-reply', role: 'assistant', content: 'I am listening.' }]}
      draft={draft} onDraftChange={setDraft} onSend={send} />;
  }
  render(<ControlledRail />);
  const composer = screen.getByPlaceholderText('Whisper to him…');
  fireEvent.change(composer, { target: { value: 'Take your time.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Hand log' }));
  expect(screen.getByPlaceholderText('Whisper to him…')).toBe(composer);
  expect(composer).toHaveValue('Take your time.');
  fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
  expect(screen.getByText('I am listening.')).toBeVisible();
  fireEvent.keyDown(composer, { key: 'Enter' });
  expect(send).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledWith('Take your time.');
});

it('FIRST-WATCH-1: a public observer keeps unknown table speech and gets no private composer', () => {
  renderRail({ conversationOnly: true, readOnly: true, agent: null, lastDecision: null,
    stored: [{ id: 'untyped', kind: 'opponent', who: 'Granite', text: 'A real public remark.', t: 1 }] });
  expect(screen.getByText('Watching this table')).toBeVisible();
  expect(screen.getByText('“A real public remark.”')).toBeVisible();
  expect(screen.queryByPlaceholderText('Whisper to him…')).toBeNull();
});
