import { useState } from 'react';

const DEFAULTS = {
  tableId: 'lounge',
  smallBlind: 10,
  bigBlind: 20,
  buyIn: 1000,
};

export function Setup({ onConnect }) {
  const [tableId, setTableId] = useState(DEFAULTS.tableId);
  const [nameA, setNameA] = useState('Alice');
  const [nameB, setNameB] = useState('Bob');
  const [stackA, setStackA] = useState(DEFAULTS.buyIn);
  const [stackB, setStackB] = useState(DEFAULTS.buyIn);
  const [sb, setSb] = useState(DEFAULTS.smallBlind);
  const [bb, setBb] = useState(DEFAULTS.bigBlind);

  const submit = (e) => {
    e.preventDefault();
    onConnect({
      tableId: tableId.trim() || DEFAULTS.tableId,
      smallBlind: Number(sb),
      bigBlind: Number(bb),
      players: [
        { playerId: nameA.trim() || 'A', displayName: nameA.trim() || 'Alice', buyIn: Number(stackA) },
        { playerId: nameB.trim() || 'B', displayName: nameB.trim() || 'Bob', buyIn: Number(stackB) },
      ],
    });
  };

  return (
    <div className="setup">
      <form className="setup__card" onSubmit={submit}>
        <h1 className="setup__title">SIT DOWN</h1>
        <div className="setup__sub">PRIVATE TABLE — HEADS-UP</div>

        <div className="setup__row">
          <div className="setup__field">
            <span className="label">Table ID</span>
            <input value={tableId} onChange={(e) => setTableId(e.target.value)} />
          </div>
          <div />
        </div>

        <div className="setup__row">
          <div className="setup__field">
            <span className="label">Player A</span>
            <input value={nameA} onChange={(e) => setNameA(e.target.value)} />
          </div>
          <div className="setup__field">
            <span className="label">Player B</span>
            <input value={nameB} onChange={(e) => setNameB(e.target.value)} />
          </div>
        </div>

        <div className="setup__row">
          <div className="setup__field">
            <span className="label">A buy-in</span>
            <input type="number" value={stackA} onChange={(e) => setStackA(e.target.value)} />
          </div>
          <div className="setup__field">
            <span className="label">B buy-in</span>
            <input type="number" value={stackB} onChange={(e) => setStackB(e.target.value)} />
          </div>
        </div>

        <div className="setup__row">
          <div className="setup__field">
            <span className="label">Small blind</span>
            <input type="number" value={sb} onChange={(e) => setSb(e.target.value)} />
          </div>
          <div className="setup__field">
            <span className="label">Big blind</span>
            <input type="number" value={bb} onChange={(e) => setBb(e.target.value)} />
          </div>
        </div>

        <button className="setup__btn" type="submit">Take Seats</button>
      </form>
    </div>
  );
}
