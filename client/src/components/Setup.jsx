import { useState } from 'react';
import { getTelegramUser, isInTelegram } from '../lib/telegram.js';

const DEFAULTS = {
  tableId: 'lounge',
  smallBlind: 10,
  bigBlind: 20,
  buyIn: 1000,
  displayName: '',
};

const tgUser = getTelegramUser();
const inTelegram = isInTelegram();

export function Setup({ onConnect }) {
  const [tableId, setTableId] = useState(DEFAULTS.tableId);
  const [displayName, setDisplayName] = useState(tgUser?.first_name || DEFAULTS.displayName);
  const [buyIn, setBuyIn] = useState(DEFAULTS.buyIn);
  const [sb, setSb] = useState(DEFAULTS.smallBlind);
  const [bb, setBb] = useState(DEFAULTS.bigBlind);

  const submit = (e) => {
    e.preventDefault();
    const name = (displayName || '').trim() || 'Anon';
    onConnect({
      tableId: (tableId || '').trim() || DEFAULTS.tableId,
      displayName: name,
      buyIn: Number(buyIn),
      smallBlind: Number(sb),
      bigBlind: Number(bb),
    });
  };

  return (
    <div className="setup">
      <form className="setup__card" onSubmit={submit}>
        <h1 className="setup__title">SIT DOWN</h1>
        <div className="setup__sub">PRIVATE TABLE — HEADS-UP</div>

        <div className="setup__row setup__row--full">
          <div className="setup__field">
            <span className="label">Your name</span>
            <input
              autoFocus={!inTelegram}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Name"
            />
          </div>
        </div>

        <div className="setup__row">
          <div className="setup__field">
            <span className="label">Table</span>
            <input value={tableId} onChange={(e) => setTableId(e.target.value)} />
          </div>
          <div className="setup__field">
            <span className="label">Buy-in</span>
            <input type="number" inputMode="numeric" value={buyIn} onChange={(e) => setBuyIn(e.target.value)} />
          </div>
        </div>

        <div className="setup__row">
          <div className="setup__field">
            <span className="label">Small blind</span>
            <input type="number" inputMode="numeric" value={sb} onChange={(e) => setSb(e.target.value)} />
          </div>
          <div className="setup__field">
            <span className="label">Big blind</span>
            <input type="number" inputMode="numeric" value={bb} onChange={(e) => setBb(e.target.value)} />
          </div>
        </div>

        <div className="setup__hint">
          {inTelegram
            ? 'Share the bot link with a friend to fill the second seat.'
            : 'Open this page in two browser tabs to play heads-up.'}
        </div>

        <button className="setup__btn" type="submit">Take Seat</button>
      </form>
    </div>
  );
}
