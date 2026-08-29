import { NavIcon } from './primitives.jsx';

const NAV_ITEMS = [
  { key: 'home', icon: 'home', label: 'Command Center' },
  { key: 'agents', icon: 'agent', label: 'Agents' },
  { key: 'play', icon: 'spade', label: 'Tables' },
  { key: 'history', icon: 'history', label: 'Replays' },
  { key: 'profile', icon: 'profile', label: 'Account' },
];

export function DesktopRail({ activeTab, onNavigate, onDraftAgent }) {
  return (
    <div className="dsk-rail">
      <div className="dsk-rail__nav-block">
        <span className="dsk-label dsk-label--sm">NAVIGATE</span>
        <div className="dsk-rail__nav-list">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`dsk-nav${activeTab === item.key ? ' is-active' : ''}`}
              onClick={() => onNavigate(item.key)}
            >
              <NavIcon name={item.icon} />
              <span className="dsk-nav__label">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="dsk-rail__section">
        <span className="dsk-label dsk-label--sm">CONVERSATIONS</span>
      </div>

      <div className="dsk-rail__list">
        <div className="dsk-rail__divider">
          <span>YOUR AGENTS</span>
          <i />
        </div>
      </div>

      <div className="dsk-rail__footer">
        <button type="button" className="dsk-rail__draft" onClick={onDraftAgent}>
          <NavIcon name="plus" size={12} />
          DRAFT AGENT
        </button>
      </div>
    </div>
  );
}
