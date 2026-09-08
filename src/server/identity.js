// Store the reference's household roll once, so a solo view cannot recolor him.
import { identitiesFor } from '../shared/identity.js';

export function ensureRosterIdentities(agents = []) {
  // Active agents first preserves the room the owner currently recognises.
  // Once written, even retirement or a guest claim keeps that identity intact.
  const ordered = [...agents.filter(a => !a.archived), ...agents.filter(a => a.archived)];
  const rolled = identitiesFor(ordered);
  let changed = false;
  for (const agent of ordered) {
    const identity = rolled.get(String(agent.id));
    if (!identity || (agent.identity?.hood === identity.hood.id && agent.identity?.glow === identity.glow.id)) continue;
    agent.identity = { hood: identity.hood.id, glow: identity.glow.id };
    changed = true;
  }
  return changed;
}
