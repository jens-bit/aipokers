// Board29's20px Home avatar, shared by the collapsed room line and want.
// Identity is supplied by the caller's existing roster map; never rolled here.
import { MoodGhost } from '../system/MoodGhost.jsx';
import '../../styles/homeMoodAvatar.css';

const MOODS = {
  confident: { color: '#00D4AA', pip: '▲' },
  neutral: { color: '#BDBDC1', pip: '–' },
  frustrated: { color: '#CDB380', pip: '!' },
  tilted: { color: '#FF4D4F', pip: '⚡' },
  sulking: { color: '#9E9EA2', pip: '▾' },
};

export function HomeMoodAvatar({ agent, identity, className = '' }) {
  if (!agent || !identity?.hood || !identity?.glow?.c) return null;
  const mood = Object.hasOwn(MOODS, agent.mood?.state) ? agent.mood.state : 'neutral';
  const pip = MOODS[mood];
  return <span className={`home-mood-avatar ${className}`.trim()} data-agent-id={agent.id} aria-hidden="true">
    <span className="home-mood-avatar__tile home-thread__avatar-tile" style={{ borderColor: `${identity.glow.c}44` }}>
      <MoodGhost size={18.8} ring={false} mood={mood} heat={agent.mood?.heat}
        hood={identity.hood} glow={identity.glow.c} accent={identity.glow.c} />
    </span>
    {/* Keep the footer measurement alias while the shared class owns styling. */}
    <span className="home-mood-avatar__pip home-thread__mood" style={{ color: pip.color, borderColor: pip.color,
      boxShadow: `0 0 6px ${pip.color}66` }}>{pip.pip}</span>
  </span>;
}
