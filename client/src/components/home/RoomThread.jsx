// client/src/components/home/RoomThread.jsx — DESK-2
//
// THE ROOM. Ported from `HdThread` in design-refs/mood-home-desk.jsx (board 31,
// P15/P18).
//
// The phone's thread is ONE AGENT's, opened by tapping the man — HomeThread,
// collapsed to a line over the room. This is the other thing the flat has and
// the phone has nowhere to put: the day's conversation in the household, which
// belongs to nobody in it. Desktop has 360px of permanent rail, so it is here,
// always open, which is the ref's whole claim about what 1440 buys.
//
// WHY IT IS ATTRIBUTED. THREAD-2's point: a home line carries `from` and `to`
// (an agent id, 'owner', or 'all'), so a reader can see BALANCE → GRANITE
// instead of a wall of anonymous quotes. Every line that has the pair prints it.
// A line written before those columns existed has neither and prints nothing —
// null rather than a guess, which is THREAD-2's rule and not this file's choice.
//
// THE NIGHTLY EXCHANGE IS ONE ENTRY, not a run of lines: kind 'overheard' with
// the conversation inside it. It is drawn as one block with its own rule above
// it, because two agents talking while you were out is one thing that happened.
//
// NOTHING HERE INSERTS A ROW. The composer POSTs to /api/home/say and reloads.

import { useState } from 'react';

const OWNER = 'owner';
const ROOM = 'all';

/** An id → the name the room calls him by. 'owner' is you; 'all' is the room. */
export function nameFor(id, agents = []) {
  if (!id) return null;
  if (id === OWNER) return 'YOU';
  if (id === ROOM) return 'THE ROOM';
  const found = agents.find((a) => String(a.id) === String(id));
  if (!found) return null;
  return String(found.name || '').split(' ')[0].toUpperCase();
}

/**
 * "BALANCE → GRANITE", or null.
 *
 * Null whenever either half is missing — a table line carries neither, because
 * the room announces to nobody in particular, and a line older than THREAD-2
 * carries neither either. Half an attribution is worse than none: it reads as
 * a claim about who was silent.
 */
export function attribution(line, agents = []) {
  const from = nameFor(line?.from, agents);
  const to = nameFor(line?.to, agents);
  if (!from || !to) return null;
  return `${from} → ${to}`;
}

function Line({ line, agents }) {
  const you = line.kind === 'you';
  const tag = attribution(line, agents);
  return (
    <div className={`room-thread__line${you ? ' is-you' : ''}`} data-testid="room-thread-line">
      {tag ? <span className="room-thread__who">{tag}</span> : null}
      <span className="room-thread__text">{line.text}</span>
    </div>
  );
}

/**
 * The nightly exchange, collapsed. One block, one rule, every speaker named —
 * the entry already carries `who` per line, so nothing here has to guess which
 * of them said what.
 */
function Overheard({ entry, agents, open, onToggle }) {
  const inner = Array.isArray(entry.lines) ? entry.lines : [];
  return (
    <div className="room-thread__night" data-testid="room-thread-overheard">
      <button
        type="button"
        className="room-thread__night-head"
        onClick={() => onToggle(!open)}
        aria-expanded={open}
      >
        <span className="room-thread__night-label">OVERHEARD</span>
        <span className="room-thread__night-count">
          {inner.length === 1 ? '1 line' : `${inner.length} lines`}
        </span>
      </button>
      {open ? (
        <div className="room-thread__night-body">
          {inner.map((l, i) => {
            const tag = attribution(l, agents);
            return (
              <div key={i} className="room-thread__line">
                {tag ? <span className="room-thread__who">{tag}</span> : null}
                <span className="room-thread__text">{l.text}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="room-thread__night-peek">{inner[0]?.text ?? ''}</p>
      )}
    </div>
  );
}

export function RoomThread({
  lines = [],
  agents = [],
  loading = false,
  sending = false,
  onSay,
  toast = null,
  atHome = 0,
}) {
  const [draft, setDraft] = useState('');
  const [nightOpen, setNightOpen] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    onSay?.(text);
  };

  return (
    <section className="room-thread" data-testid="room-thread" aria-label="The room">
      <header className="room-thread__head">
        <span className="room-thread__title">THE ROOM</span>
        <span className="room-thread__sub">everyone at home hears this</span>
      </header>

      {toast ? <div className="room-thread__toast">{toast}</div> : null}

      <div className="room-thread__body no-scrollbar" data-testid="room-thread-rows">
        {lines.length === 0 ? (
          <p className="room-thread__empty">
            {loading ? 'Listening…' : 'Nothing said in here today.'}
          </p>
        ) : null}
        {lines.map((line, i) => (
          line.kind === 'overheard'
            ? (
              <Overheard
                key={line.id ?? `o${i}`}
                entry={line}
                agents={agents}
                open={nightOpen}
                onToggle={setNightOpen}
              />
            )
            : <Line key={line.id ?? i} line={line} agents={agents} />
        ))}
      </div>

      <form className="room-thread__composer" onSubmit={submit}>
        <input
          className="room-thread__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Say something to the room…"
          aria-label="Say something to the room"
          data-testid="room-thread-input"
        />
        <button
          type="submit"
          className="room-thread__send"
          disabled={!draft.trim() || sending}
          aria-label="Say it"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>

      {/* An empty flat is not an error: the line is filed and nobody answers it,
          exactly as the route behaves. Saying so beforehand is kinder than a
          composer that swallows the sentence. */}
      {atHome === 0 ? (
        <p className="room-thread__foot" data-testid="room-thread-empty-flat">
          Nobody is home. They will not answer.
        </p>
      ) : null}
    </section>
  );
}
