import { useEffect } from 'react';
import { HandHistory } from './HandHistory.jsx';

export function HistoryDrawer({ open, onClose, history, displayNames }) {
  // Close on Escape — convenient when testing in a desktop browser.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll while the drawer is open so swipes scroll the drawer's
  // own list and not the page behind it.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <>
      {open && <div className="drawer-backdrop" onClick={onClose} />}
      <aside
        className={`drawer ${open ? 'drawer--open' : ''}`}
        aria-hidden={!open}
        role="dialog"
        aria-label="Hand history"
      >
        <div className="drawer__header">
          <h3 className="drawer__title">Hand History</h3>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close history">
            ×
          </button>
        </div>
        <div className="drawer__body">
          <HandHistory history={history} displayNames={displayNames} />
        </div>
      </aside>
    </>
  );
}
