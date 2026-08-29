import { useState } from 'react';
import { Hood, NavIcon } from './primitives.jsx';

// Only commands backed by a real endpoint are enabled. The rest render as
// disabled chips so the surface reads complete without faking behavior.
const COMMANDS = [
  { cmd: '/deploy', desc: 'send agent to a table', enabled: true },
  { cmd: '/build', desc: 'create new agent', enabled: true },
  { cmd: '/replay', desc: 'pull a hand', enabled: false },
  { cmd: '/analyze', desc: 'review last session', enabled: false },
  { cmd: '/sit-out', desc: 'pause an agent', enabled: false },
];

const DEPLOY = '/deploy';

export function DesktopComposer({
  idleAgents = [], onDeployAgent, onBuild, onFreeText, chatTargetName,
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);

  const trimmed = draft.trimStart();
  const isDeploying = trimmed.toLowerCase().startsWith(DEPLOY);
  const query = isDeploying ? trimmed.slice(DEPLOY.length).trim().toLowerCase() : '';
  const matches = isDeploying
    ? idleAgents.filter((a) => !query || a.name?.toLowerCase().includes(query))
    : [];

  function deploy(agent) {
    setDraft('');
    setError(null);
    onDeployAgent(agent);
  }

  function submit() {
    const text = draft.trim();
    if (!text) return;
    setError(null);

    if (text.toLowerCase().startsWith('/build')) {
      setDraft('');
      onBuild();
      return;
    }

    // Enter deploys only when the picker has narrowed to a single agent;
    // otherwise the picker stays open and the user clicks.
    if (isDeploying) {
      if (matches.length === 1) { deploy(matches[0]); return; }
      if (matches.length === 0) {
        setError(idleAgents.length === 0 ? 'No idle agents to deploy.' : 'No idle agent matches that name.');
      }
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
    : 'Type / for commands, or /build to draft an agent…';

  return (
    <div className="dsk-composer">
      <div className="dsk-composer__inner">
        {isDeploying && (
          <div className="dsk-picker">
            <div className="dsk-picker__head">
              <span className="dsk-label dsk-label--sm">
                {matches.length > 0 ? 'PICK AN AGENT TO DEPLOY' : 'NO IDLE AGENTS'}
              </span>
            </div>
            {matches.map((agent) => (
              <button
                key={agent.id}
                type="button"
                className="dsk-picker__row"
                onClick={() => deploy(agent)}
              >
                <Hood size={22} dim />
                <span className="dsk-picker__name">{agent.name}</span>
                <span className="dsk-picker__go">DEPLOY</span>
              </button>
            ))}
          </div>
        )}

        <div className="dsk-composer__chips">
          {COMMANDS.map((c) => (
            <button
              key={c.cmd}
              type="button"
              className="dsk-chip-cmd"
              disabled={!c.enabled}
              onClick={() => { setDraft(`${c.cmd} `); setError(null); }}
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
