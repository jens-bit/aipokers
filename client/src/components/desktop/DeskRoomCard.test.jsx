// client/src/components/desktop/DeskRoomCard.test.jsx — DP-5
//
// Wave 34's fourth rule at the desk. The readings are the floor's own, so what
// is worth pinning is that the rail agrees with the room rather than keeping
// its own opinion of it.

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '../../styles/desktop.css';

import { DeskRoomCard } from './DeskRoomCard.jsx';
import { newsPipFor } from '../floor/agentView.js';
import {
  brokeAgent, grewAgent, playingAgent, quietAgent, wornAgent,
} from '../../test/fixtures/floor2.js';
import { telegram } from '../../test/harness.js';

const ROOM = [playingAgent, grewAgent, wornAgent, brokeAgent, quietAgent];

const rows = (c) => [...c.querySelectorAll('.dsk-room__row')];

describe('DP-5 — the census', () => {
  beforeEach(() => { telegram.signIn(); });

  it('counts the room the way the floor splits it', () => {
    render(<DeskRoomCard agents={ROOM} />);
    expect(screen.getByText('1 LIVE · 4 RESTING')).toBeInTheDocument();
  });

  it('counts an arriving body once, where he is going', () => {
    render(<DeskRoomCard agents={ROOM} arrivingId="a_quiet" />);
    expect(screen.getByText('1 LIVE · 3 RESTING · 1 ARRIVING')).toBeInTheDocument();
  });

  it('says the room is open rather than counting nobody', () => {
    render(<DeskRoomCard agents={[]} />);
    expect(screen.getByText('THE ROOM IS OPEN')).toBeInTheDocument();
  });

  it('drops a count that is zero instead of printing it', () => {
    render(<DeskRoomCard agents={[playingAgent]} />);
    expect(screen.getByText('1 LIVE')).toBeInTheDocument();
  });
});

describe('DP-5 — who has news', () => {
  beforeEach(() => { telegram.signIn(); });

  it('lists only the agents something happened to', () => {
    const { container } = render(<DeskRoomCard agents={ROOM} />);
    const names = rows(container).map((r) => r.querySelector('.dsk-room__name').textContent);
    expect(names).toEqual(['Bluff Master', 'Aggressive v1.3', 'Value Bot']);
    expect(names).not.toContain('Steady Eddie');
  });

  it('shows the same pip the floor puts at his feet', () => {
    const { container } = render(<DeskRoomCard agents={ROOM} />);
    const [grew, worn, broke] = rows(container);

    expect(within(grew).getByText('+2 GREW')).toBeInTheDocument();
    expect(within(worn).getByText('WORN')).toBeInTheDocument();
    expect(within(broke).getByText('POCKET $0')).toBeInTheDocument();

    // Not a second opinion: the rail asks agentView the same question.
    expect(newsPipFor(grewAgent)).toBe('grew');
    expect(newsPipFor(wornAgent)).toBe('worn');
    expect(newsPipFor(brokeAgent)).toBe('broke');
  });

  it('gives one body one pip, never two', () => {
    const { container } = render(<DeskRoomCard agents={ROOM} />);
    for (const row of rows(container)) {
      expect(row.querySelectorAll('.floor-pip')).toHaveLength(1);
    }
  });

  it('says nothing happened rather than drawing an empty list', () => {
    const { container } = render(<DeskRoomCard agents={[quietAgent]} />);
    expect(screen.getByText(/Nothing happened while you were away/)).toBeInTheDocument();
    expect(rows(container)).toHaveLength(0);
  });

  it('opens the agent a row names', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { container } = render(<DeskRoomCard agents={ROOM} onSelect={onSelect} />);

    await user.click(rows(container)[0]);
    expect(onSelect).toHaveBeenCalledWith(grewAgent);
  });

  it('is inert rather than dead when there is nowhere to go', () => {
    const { container } = render(<DeskRoomCard agents={ROOM} />);
    expect(rows(container)[0]).toBeDisabled();
  });
});
