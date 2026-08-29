import { useState } from 'react';
import { NavIcon } from './primitives.jsx';

// Only commands backed by a real endpoint are enabled. The rest render as
// disabled chips so the surface reads complete without faking behavior.
const COMMANDS = [
  { cmd: '/deploy', desc: 'send agent to a table', enabled: true },
  { cmd: '/build', desc: 'create new agent', enabled: true },
  { cmd: '/replay', desc: 'pull a hand', enabled: false },
  { cmd: '/analyze', desc: 'review last session', enabled: false },
  { cmd: '/sit-out', desc: 'pause an agent', enabled: false },
];

export function DesktopComposer({ onDeploy, onBuild, onFreeText, chatTargetName }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);

  function submit() {
    const text = draft.trim();
    if (!text) return;
    setError(null);

    if (text.startsWith('/build')) {
      setDraft('');
      onBuild();
      return;
    }

    if (text.startsWith('/deploy')) {
      const name = text.slice('/deploy'.length).trim();
      if (!name) { setError('Usage: /deploy <agent name>'); return; }
      const result = onDeploy(name);
      if (result === false) { setError(`No idle agent named "${name}".`); return; }
      setDraft('');
      return;
    }

    if (text.startsWith('/')) {
      setError('That command is not available yet.');
      return;
    }

    if (!onFreeText) {
      setError('Open an agent conversation to send a message.');
      return;
    }
    setDraft('');
    onFreeText(text);
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  const placeholder = chatTargetName
    ? `Message ${chatTargetName}, or type /deploy or /build…`
    : 'Type /deploy <agent name> or /build…';

  return (
    <div className="dsk-composer">
      <div className="dsk-composer__inner">
        <div className="dsk-composer__chips">
          {COMMANDS.map((c) => (
            <button
              key={c.cmd}
              type="button"
              className="dsk-chip-cmd"
              disabled={!c.enabled}
              onClick={() => setDraft(`${c.cmd} `)}
            >
              <b>{c.cmd}</b>
              <span>{c.desc}</span>
            </button>
          ))}
        </div>

        <div className="dsk-composer__box">
          <NavIcon name="sparkle" size={16} />
          <textarea
            rows={2}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => { setDraft(e.target.value); setError(null); }}
            onKeyDown={onKeyDown}
          />
          <span className="dsk-composer__kbd">⌘↵</span>
          <button
            type="button"
            className="dsk-composer__send"
            disabled={!draft.trim()}
            onClick={submit}
            aria-label="Send"
          >
            <NavIcon name="send" size={14} />
          </button>
        </div>

        <div className="dsk-composer__foot">
          {error ? <span className="dsk-composer__error">{error}</span> : <span>⌘↵ send</span>}
          <i />
        </div>
      </div>
    </div>
  );
}
