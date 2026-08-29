import { useCallback, useEffect, useState } from 'react';
import { getUserId } from '../../lib/telegram.js';
import { AgentChat } from '../AgentChat.jsx';
import { CreateAgent } from '../CreateAgent.jsx';
import { HistoryTab } from '../HistoryTab.jsx';
import { DesktopTopBar } from './DesktopTopBar.jsx';
import { DesktopRail } from './DesktopRail.jsx';
import { GameTile } from './GameTile.jsx';
import { LogoMark, NavIcon } from './primitives.jsx';

const DAY_FMT = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };

export function DesktopShell({
  game, lastDecision, watchingAgent, isWatching,
  onWatchAgent, onDeployAgent, onFocusTable,
}) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [platformAgents, setPlatformAgents] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [chatTarget, setChatTarget] = useState(null);
  const [creating, setCreating] = useState(false);

  const loadAgents = useCallback(() => {
    fetch(`/api/agents?userId=${getUserId()}`)
      .then((r) => r.json())
      .then((data) => setAgents(data.agents || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAgents();
    const id = setInterval(loadAgents, 15_000);
    return () => clearInterval(id);
  }, [loadAgents]);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setPlatformAgents(data.totalAgents ?? null))
      .catch(() => {});
  }, []);

  const livePlaying = agents.filter((a) => a.activeTableId);

  function startCreate() {
    setChatTarget(null);
    setActiveTab('home');
    setCreating(true);
  }

  function selectAgent(agent) {
    setCreating(false);
    setActiveTab('home');
    if (agent.activeTableId) {
      setChatTarget(null);
      onWatchAgent(agent);
    } else {
      setChatTarget(agent);
    }
  }

  const today = new Date().toLocaleDateString('en-US', DAY_FMT).toUpperCase();

  return (
    <div className="dsk-root">
      <DesktopTopBar liveCount={livePlaying.length} />

      <div className="dsk-body">
        <DesktopRail
          agents={agents}
          loading={loading}
          activeTab={activeTab}
          activeAgentId={chatTarget?.id || watchingAgent?.id || null}
          onNavigate={(tab) => { setActiveTab(tab); setChatTarget(null); setCreating(false); }}
          onSelectAgent={selectAgent}
          onDraftAgent={startCreate}
        />

        <div className="dsk-content">
          <div className="dsk-conv-header">
            <div className="dsk-conv-header__mark">
              <LogoMark width={18} height={22} />
            </div>
            <div className="dsk-conv-header__text">
              <div className="dsk-conv-header__title-row">
                <span className="dsk-conv-header__title">
                  {creating ? 'Draft agent' : chatTarget ? chatTarget.name : 'Command Center'}
                </span>
                <span className="dsk-chip">{chatTarget || creating ? 'AGENT' : 'SYSTEM'}</span>
              </div>
              <div className="dsk-conv-header__sub">
                {livePlaying.length > 0 && <span className="dsk-dot" aria-hidden />}
                <span>
                  {livePlaying.length > 0
                    ? `${livePlaying.length} agent${livePlaying.length === 1 ? '' : 's'} reporting live`
                    : 'No agents deployed'}
                  {platformAgents != null && ` · ${platformAgents} agents on the platform`}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="dsk-conv-header__btn dsk-conv-header__btn--accent"
              onClick={startCreate}
            >
              <NavIcon name="plus" size={12} />
              BUILD AGENT
            </button>
          </div>

          <div className="dsk-conv">
            <div className="dsk-conv__inner">
              <div className="dsk-conv__daymark">
                <i /><span>{today}</span><i />
              </div>

              {creating ? (
                <div className="dsk-embed">
                  <CreateAgent
                    onBack={() => setCreating(false)}
                    onDone={() => { setCreating(false); loadAgents(); }}
                    onDeploy={(agent) => { setCreating(false); onDeployAgent(agent); }}
                  />
                </div>
              ) : chatTarget ? (
                <div className="dsk-embed">
                  <AgentChat
                    key={chatTarget.id}
                    agent={chatTarget}
                    onBack={() => setChatTarget(null)}
                    onDeploy={(agent) => { setChatTarget(null); onDeployAgent(agent); }}
                  />
                </div>
              ) : activeTab === 'history' ? (
                <div className="dsk-embed"><HistoryTab /></div>
              ) : (
                <>
                {isWatching && (
                  <ConvMessage source="LIVE">
                    <div className="dsk-block dsk-block--teal">
                      <div className="dsk-block__head">
                        <div className="dsk-block__head-left">
                          <span className="dsk-dot" aria-hidden />
                          <span className="dsk-label dsk-label--teal">
                            {watchingAgent?.name || 'Agent'} · LIVE
                          </span>
                        </div>
                      </div>
                      <div className="dsk-block__body">
                        <GameTile
                          game={game}
                          agentName={watchingAgent?.name}
                          lastDecision={lastDecision}
                          onWatch={onFocusTable}
                        />
                      </div>
                    </div>
                  </ConvMessage>
                )}
                <ConvMessage source="ROSTER">
                  <div className="dsk-block">
                    <div className="dsk-block__text">
                      {agents.length === 0
                        ? 'No agents yet. Use DRAFT AGENT in the rail to create your first one.'
                        : (
                          <>
                            You have <b>{agents.length}</b> agent{agents.length === 1 ? '' : 's'}.{' '}
                            {livePlaying.length > 0
                              ? <>Pick a live one in the rail to watch it play.</>
                              : 'None are deployed. Pick one in the rail to talk to it.'}
                          </>
                        )}
                    </div>
                  </div>
                </ConvMessage>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConvMessage({ source, children }) {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  return (
    <div className="dsk-msg">
      <div className="dsk-msg__avatar">
        <LogoMark width={13} height={15} />
      </div>
      <div className="dsk-msg__body">
        <div className="dsk-msg__meta">
          <span className="dsk-msg__time">{time}</span>
          <span className="dsk-msg__sep">·</span>
          <span className="dsk-msg__source">{source}</span>
        </div>
        {children}
      </div>
    </div>
  );
}
