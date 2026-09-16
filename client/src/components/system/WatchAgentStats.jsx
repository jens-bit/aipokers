import { useState } from 'react';
import { normalizeAttrs, seriesFor } from '../../lib/attributes.js';
import { AttrCluster } from './AttrCluster.jsx';
import { money } from '../../lib/wallet.js';
import '../../styles/watch-agent.css';
// The Skills section's own classes (profile-overview__skills etc.) — reused
// rather than duplicated, per "do not redesign, the profile is the reference".
import '../../styles/agent-profile.css';

// TABLE-2 job B: this used to print the same four skills the profile shows
// as sliders ("Reads 41/100") as bare figures, plus STAMINA and COMPOSURE —
// two attributes the profile's own Skills section deliberately leaves out
// (AgentProfileOverview.jsx keeps those as the separate STAMINA/HEAT/composure
// line, not in the cluster). "Same component, same range band, same four
// skills" — this is AgentProfileOverview.jsx's own Skills section, ported
// rather than redrawn: normalizeAttrs() for the row shape, the same
// READS/FOCUS/DISCIPLINE/DECEPTION filter, and AttrCluster to draw them.
// agent.attrLog rides the same /api/agents projection the profile reads it
// from (ChatsScreen.jsx's own note), so the tap-to-expand history works here
// too, with no new data plumbing.
export function WatchAgentStats({ agent, seat }) {
  const [expandedSkill, setExpandedSkill] = useState(null);
  const character = normalizeAttrs(agent);
  const attrLog = Array.isArray(agent?.attrLog) ? agent.attrLog : [];
  const skillRows = character.rows.filter(row => ['READS', 'FOCUS', 'DISCIPLINE', 'DECEPTION'].includes(row.key));
  const knownSkills = skillRows.filter(row => Number.isFinite(agent?.attrs?.[row.key]));
  const missingSkills = skillRows.filter(row => !Number.isFinite(agent?.attrs?.[row.key])).map(row => row.key);

  return <div className="watch-agent-stats">
    <div className="watch-agent-stats__stack"><span>Stack at this table</span>
      {/* BUG-200: toLocaleString grouped this by the device's locale ("$1 234"
          on this environment's ICU data instead of "$1,234"), the exact drift
          money()'s own doc comment in lib/wallet.js warns about. Every other
          amount in the app already goes through money(); this one should too. */}
      <strong>{Number.isFinite(seat?.stack) ? money(seat.stack) : 'Not available yet'}</strong></div>
    <section className="profile-overview__skills" aria-label="Skills">
      <div className="profile-overview__recent-heading"><b>Skills</b><span>tap a skill to see its history</span></div>
      <AttrCluster rows={knownSkills} expand={expandedSkill} onExpand={setExpandedSkill} seriesFor={key => seriesFor(attrLog, key)}/>
      {missingSkills.length > 0 && <p className="profile-overview__empty">{missingSkills.join(' · ')} not recorded yet.</p>}
    </section>
  </div>;
}
