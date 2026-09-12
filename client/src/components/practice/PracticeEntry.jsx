import { useState } from 'react';
import '../../styles/practice.css';

const keyFor = (ownerId, agentId) => `railbird.practice.v1:${JSON.stringify([String(ownerId), String(agentId)])}`;

export function readPractice(ownerId, agentId) {
  try {
    const value = JSON.parse(localStorage.getItem(keyFor(ownerId, agentId)));
    if (value?.version === 1 && Number.isInteger(value.step) && value.step >= 0 && value.step <= 9) return value;
  } catch { /* Guidance still works when storage is unavailable. */ }
  return { version: 1, step: 0, dismissed: false, completed: false };
}

export function savePractice(ownerId, agentId, value) {
  try { localStorage.setItem(keyFor(ownerId, agentId), JSON.stringify({ ...value, version: 1 })); }
  catch { /* Never make storage a condition of playing. */ }
}

export function PracticeEntry({ agent, ownerId, onStart }) {
  const [progress, setProgress] = useState(() => readPractice(ownerId, agent?.id));
  if (!agent?.id || !onStart) return null;
  const resume = progress.step > 0 && !progress.completed;
  const compact = progress.dismissed || progress.completed || resume;
  return (
    <aside className={`practice-entry${compact ? ' is-compact' : ''}`} aria-label="Learn the table">
      {!compact && <div className="practice-entry__copy"><strong>Your first hand, together.</strong><span>Watch {agent.name} play a practice hand. Go at your own pace.</span></div>}
      <button type="button" className={compact ? 'practice-entry__link' : 'practice-primary'} onClick={() => onStart(agent)}>
        {resume ? 'Resume practice' : compact ? 'Learn the table' : `Learn with ${agent.name}`}
      </button>
      {!compact && <button type="button" className="practice-quiet" onClick={() => {
        const next = { ...progress, dismissed: true };
        savePractice(ownerId, agent.id, next);
        setProgress(next);
      }}>Not now</button>}
    </aside>
  );
}
