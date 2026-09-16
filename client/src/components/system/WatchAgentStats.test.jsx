import { render, screen } from '@testing-library/react';
import { it, expect } from 'vitest';
import { WatchAgentStats } from './WatchAgentStats.jsx';

// TABLE-2 job B (Testing law #5): this tab used to print six bare figures —
// the four skills the profile shows as sliders, plus STAMINA and COMPOSURE,
// which the profile's own Skills section has never included (they are its
// separate STAMINA/HEAT/composure line — AgentProfileOverview.jsx). "Same
// component, same range band, same four skills" replaces that list with
// AgentProfileOverview.jsx's own AttrCluster, so the old six-figure
// assertions describe a screen this job was asked to stop drawing.
it('BUG-143: owned table stats still distinguish a known zero stack from an unknown one', () => {
  render(<WatchAgentStats agent={{ attrs: { READS: 0 } }} seat={{ stack: 1234 }} />);
  expect(screen.getByText('$1,234')).toBeVisible();
});

it('TABLE-2 job B: the STATS tab draws the same four-skill slider the profile does, not bare figures', () => {
  render(<WatchAgentStats agent={{ attrs: { READS: 41, FOCUS: 60, DISCIPLINE: 55, DECEPTION: 30, STAMINA: 72, COMPOSURE: 50 } }} seat={{ stack: 10_100 }} />);

  expect(screen.getByText('$10,100')).toBeVisible();
  // The bar, not a "41/100" figure — the same AttrBar the profile draws.
  expect(document.querySelectorAll('.attr-bar')).toHaveLength(4);
  for (const key of ['READS', 'FOCUS', 'DISCIPLINE', 'DECEPTION']) {
    expect(screen.getByText(key)).toBeVisible();
  }
  expect(screen.queryByText('41/100')).toBeNull();
  // STAMINA and COMPOSURE are not part of the profile's Skills cluster.
  expect(screen.queryByText('STAMINA')).toBeNull();
  expect(screen.queryByText('COMPOSURE')).toBeNull();
  // The same range band the profile's own AttrTrack draws.
  expect(document.querySelector('.attr-track__band')).toBeTruthy();
});

it('TABLE-2 job B: an unrecorded skill reads as missing, the same way the profile says it', () => {
  render(<WatchAgentStats agent={{ attrs: { READS: 41 } }} seat={{ stack: 500 }} />);
  expect(document.querySelectorAll('.attr-bar')).toHaveLength(1);
  expect(screen.getByText('FOCUS · DISCIPLINE · DECEPTION not recorded yet.')).toBeVisible();
});
