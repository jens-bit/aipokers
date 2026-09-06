import { getTelegramDisplayName } from '../../lib/telegram.js';
import { pillName } from '../../lib/names.js';

function standupGreeting(agents) {
  const live = agents.filter((a) => a.activeTableId || a.liveGame?.tableId).length;
  const total = agents.length;
  if (total === 0) return 'No agents yet — draft your first one.';
  if (live === 0) return `${total} agent${total !== 1 ? 's' : ''} resting. Quiet night.`;
  return `${live} at the felt${total - live > 0 ? `, ${total - live} resting` : ''}.`;
}

export function PStandupCard({ agents = [], loading = false }) {
  const name = getTelegramDisplayName() || 'player';
  const first = pillName(name);
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
  const live = agents.filter((a) => a.activeTableId || a.liveGame?.tableId).length;
  const totalHands = agents.reduce((s, a) => s + (a.stats?.handsPlayed ?? 0), 0);
  const rates = agents.filter((a) => (a.stats?.handsPlayed ?? 0) > 0).map((a) => a.stats?.winRate ?? 0);
  const avgWin = rates.length ? rates.reduce((s, r) => s + r, 0) / rates.length : null;
  const greeting = loading ? 'Reading the room…' : standupGreeting(agents);

  return (
    <div className="dsk-standup">
      <div className="dsk-standup__head">
        <span className="dsk-standup__date">Daily standup · {today}</span>
      </div>
      <div className="dsk-standup__body">
        <span className="dsk-standup__hi">Good evening, {first}.</span>{' '}
        <span className="dsk-standup__prose">{greeting}</span>
      </div>
      <div className="dsk-standup__kpi">
        {[
          { label: 'LIVE', val: loading ? '—' : live, sub: `of ${loading ? '—' : agents.length}`, accent: live > 0 },
          { label: 'HANDS', val: loading ? '—' : totalHands.toLocaleString(), sub: 'total' },
          { label: 'WIN RATE', val: loading || avgWin === null ? '—' : `${avgWin.toFixed(0)}%`, sub: 'avg', accent: avgWin !== null && avgWin > 50 },
          { label: 'ROSTER', val: loading ? '—' : agents.length, sub: 'agents' },
        ].map((c, i) => (
          <div key={i} className="dsk-standup__kpi-cell">
            <div className="dsk-standup__kpi-label">{c.label}</div>
            <div className="dsk-standup__kpi-val" style={c.accent ? { color: '#00D4AA' } : undefined}>{c.val}</div>
            <div className="dsk-standup__kpi-sub">{c.sub}</div>
          </div>
        ))}
      </div>
      <div className="dsk-standup__chips">
        <span className="dsk-standup__suggest">Suggested →</span>
        {['Deploy an agent', 'Build new agent', 'Review history'].map((a, i) => (
          <button key={i} type="button" className={`dsk-standup__chip${i === 0 ? ' dsk-standup__chip--on' : ''}`}>{a}</button>
        ))}
      </div>
    </div>
  );
}
