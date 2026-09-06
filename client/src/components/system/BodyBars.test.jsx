// client/src/components/system/BodyBars.test.jsx — PROFILE-2
//
// The body half of the split. What is under test is the one thing that makes
// these two bars different from the four below them: HEAT runs the other way.
// A skill bar filling up is good news; a heat bar filling up is not, and the
// colour has to say so without the owner reading a number.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BodyBars, HeatBar, heatBand } from './BodyBars.jsx';
import { AttrCluster } from './AttrCluster.jsx';
import { HEAT_EMBER, HEAT_FIRE, STAMINA_FULL, STAMINA_SPENT } from './FeltBodyBars.jsx';

const staminaRow = { key: 'STAMINA', cur: 63, lo: 64, hi: 70, fatigued: false, narrowed: false };

const track = (container) => container.querySelector('.attr-track--heat');

describe('heatBand', () => {
  it('names the four rooms off mood-heat.jsx thresholds', () => {
    expect(heatBand(0).word).toBe('cold');
    expect(heatBand(24).word).toBe('cold');
    expect(heatBand(25).word).toBe('warm');
    expect(heatBand(49).word).toBe('warm');
    expect(heatBand(50).word).toBe('hot');
    expect(heatBand(74).word).toBe('hot');
    expect(heatBand(75).word).toBe('boiling');
    expect(heatBand(100).word).toBe('boiling');
  });

  it('clamps rather than falling off either end', () => {
    expect(heatBand(-40).word).toBe('cold');
    expect(heatBand(400).word).toBe('boiling');
    expect(heatBand(undefined).word).toBe('cold');
  });
});

describe('HeatBar', () => {
  it('shows the reading, the room it puts him in, and the stat underneath', () => {
    render(<HeatBar heat={82} composure={44} />);
    expect(screen.getByText('HEAT')).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('boiling')).toBeInTheDocument();
    expect(screen.getByText('composure 44')).toBeInTheDocument();
  });

  // The polarity is the whole reason heat cannot be a seventh row in the
  // cluster: at 82 it is red, and skill teal at 82 would read as an
  // achievement.
  it('is coloured by what it reads, not in skill teal', () => {
    const { container } = render(<HeatBar heat={82} composure={44} />);
    expect(track(container).style.getPropertyValue('--heat-color')).toBe(HEAT_FIRE);
  });

  // HOME-2 job 2 · heat's empty end is NOTHING, not a good reading. It was
  // teal here, which said "he is fine" — an accumulation at zero has nothing to
  // say, and an ember is what that looks like. Same ramp as the felt and the
  // pill, so the card cannot disagree with the room about a man.
  it('is an ember when he is cold, and never a teal', () => {
    const { container } = render(<HeatBar heat={8} />);
    expect(track(container).style.getPropertyValue('--heat-color')).toBe(HEAT_EMBER);
    expect(screen.getByText('cold')).toBeInTheDocument();
  });

  it('fills to the reading', () => {
    const { container } = render(<HeatBar heat={38} />);
    expect(track(container).style.getPropertyValue('--cur')).toBe('38%');
  });

  it('says nothing about composure when the engine has not sent one', () => {
    render(<HeatBar heat={38} composure={null} />);
    expect(screen.queryByText(/composure/)).toBeNull();
  });
});

describe('BodyBars', () => {
  it('draws the two, and only the two', () => {
    render(<BodyBars staminaRow={staminaRow} heat={38} composure={44} />);
    expect(screen.getByText('STAMINA')).toBeInTheDocument();
    expect(screen.getByText('HEAT')).toBeInTheDocument();
    for (const skill of ['READS', 'FOCUS', 'DISCIPLINE', 'DECEPTION']) {
      expect(screen.queryByText(skill)).toBeNull();
    }
  });

  // STAMINA is a trained attribute with a band and a 90-day series; heat has
  // nothing behind it, because heat is now.
  it('opens STAMINA like a skill, and offers no such thing on HEAT', async () => {
    const user = userEvent.setup();
    const onExpand = vi.fn();
    render(<BodyBars staminaRow={staminaRow} heat={38} composure={44} onExpand={onExpand} />);

    await user.click(screen.getByRole('button', { name: 'STAMINA 63' }));
    expect(onExpand).toHaveBeenCalledWith('STAMINA');

    expect(screen.queryByRole('button', { name: /HEAT/ })).toBeNull();
  });

  it('still draws heat for an agent with no attributes scouted yet', () => {
    render(<BodyBars staminaRow={null} heat={12} />);
    expect(screen.getByText('HEAT')).toBeInTheDocument();
    expect(screen.queryByText('STAMINA')).toBeNull();
  });

  // BUGS-A job 10 · SAME TWO RULES EVERYWHERE. On the felt a spent stamina
  // line is red and a full one is green; on this card it was skill teal at
  // every value, so the same man read as fine here and as running on empty
  // there.
  it('colours STAMINA by what it says, off the felt own function', () => {
    const { container } = render(<BodyBars staminaRow={{ ...staminaRow, cur: 100 }} heat={38} />);
    const track = container.querySelector('.attr-cluster .attr-track');
    expect(track.className).toContain('attr-track--tinted');
    expect(track.style.getPropertyValue('--tint').toUpperCase()).toBe(STAMINA_FULL);
  });

  it('a man running on empty is red on this card too', () => {
    const { container } = render(<BodyBars staminaRow={{ ...staminaRow, cur: 0 }} heat={38} />);
    expect(container.querySelector('.attr-cluster .attr-track')
      .style.getPropertyValue('--tint').toUpperCase()).toBe(STAMINA_SPENT);
  });

  // A skill's colour is not a verdict on its value: teal at 30 and teal at 90
  // is the point of the cluster.
  it('tints nothing else — every skill keeps the system teal', () => {
    const { container } = render(
      <AttrCluster rows={[{ key: 'READS', cur: 20, lo: 30, hi: 60 }]} />,
    );
    const track = container.querySelector('.attr-track');
    expect(track.className).not.toContain('attr-track--tinted');
    expect(track.style.getPropertyValue('--tint')).toBe('');
  });
});
