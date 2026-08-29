import { useEffect, useState } from 'react';
import { CreateAgent } from '../CreateAgent.jsx';
import { HistoryTab } from '../HistoryTab.jsx';
import { DesktopTopBar } from './DesktopTopBar.jsx';
import { DesktopRail } from './DesktopRail.jsx';
import { LogoMark, NavIcon } from './primitives.jsx';

const DAY_FMT = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };

export function DesktopShell() {
  const [platformAgents, setPlatformAgents] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setPlatformAgents(data.totalAgents ?? null))
      .catch(() => {});
  }, []);

  function startCreate() {
    setActiveTab('home');
    setCreating(true);
  }

  const today = new Date().toLocaleDateString('en-US', DAY_FMT).toUpperCase();

  return (
    <div className="dsk-root">
      <DesktopTopBar liveCount={platformAgents} />

      <div className="dsk-body">
        <DesktopRail
          activeTab={activeTab}
          onNavigate={(tab) => { setActiveTab(tab); setCreating(false); }}
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
                  {creating ? 'Draft agent' : 'Command Center'}
                </span>
                <span className="dsk-chip">{creating ? 'AGENT' : 'SYSTEM'}</span>
              </div>
              <div className="dsk-conv-header__sub">
                <span>
                  {platformAgents == null ? '—' : `${platformAgents} agents on the platform`}
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
                  <CreateAgent onBack={() => setCreating(false)} onDone={() => setCreating(false)} />
                </div>
              ) : activeTab === 'history' ? (
                <div className="dsk-embed"><HistoryTab /></div>
              ) : (
                <ConvMessage source="SYSTEM">
                  <div className="dsk-block">
                    <div className="dsk-block__text">
                      Command Center ready. Use <b>DRAFT AGENT</b> in the rail to create an agent.
                    </div>
                  </div>
                </ConvMessage>
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
