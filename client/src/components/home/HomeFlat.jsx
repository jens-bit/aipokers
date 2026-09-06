// client/src/components/home/HomeFlat.jsx — HOME-1
//
// The room. Ported from design-refs/mood-home.jsx (`HomeFlat`): floorboards
// running away from the viewer, the wall the frames hang on, the television and
// the couch in the left corner, the kitchen table in the middle, the door on the
// right wall line, and a warm pool of light over the table when anyone is in.
//
// Two fixtures are additions rather than ports — the safe under the frames and
// the fridge beside the table. See the note in flat.js: the refs that would
// carry them (mood-home2.jsx, designs 47–49) are not in design-refs/. They are
// drawn in the ref's own material language (the same flat panel, the same
// hairline highlight, the same 1px rgba border) and placed on its grid, but they
// are the one part of this screen that should be re-checked against the ref when
// it arrives.
//
// The room is a fixed 390×470 coordinate space scaled to fit whatever box it is
// given, so the arithmetic in flat.js is the same on every device. Everything is
// a div: no image, no sprite sheet, nothing to load.

import { FLAT, F_W, F_H } from './flat.js';

// `onTable` is optional and the table is furniture without it. Both branches
// that gave it a tap did so for a different destination — BUGS-A job 7 watches
// the game that is on it, BIRTH-5 opens the chairs when it is empty — so the
// caller says where it leads and `tableLabel` says so out loud.
export function HomeFlat({
  lit = true, children, onSafe, onFridge, onTv, onTable, onDoor,
  tvLabel = null, tableLabel = null,
}) {
  const tableBox = {
    left: FLAT.table.cx - FLAT.table.rx,
    top: FLAT.table.cy - FLAT.table.ry,
    width: FLAT.table.rx * 2,
    height: FLAT.table.ry * 2,
  };
  return (
    <div className="home-flat" style={{ width: F_W, height: F_H }} data-lit={lit ? 'true' : 'false'}>
      {/* floorboards, running away from the viewer */}
      <div className="home-flat__boards" aria-hidden>
        {Array.from({ length: 9 }).map((_, i) => <span key={i} style={{ top: 96 + i * 42 }} />)}
      </div>

      {/* the wall the frames hang on */}
      <div className="home-flat__wall" style={{ height: FLAT.wall.y + FLAT.wall.h + 8 }} aria-hidden />

      {/* the television, and the couch below it */}
      <button
        type="button"
        className="home-flat__tv"
        style={{ left: FLAT.tv.x, top: FLAT.tv.y, width: FLAT.tv.w, height: FLAT.tv.h }}
        onClick={onTv}
        aria-label={tvLabel ? `Television — ${tvLabel}` : 'Television'}
        data-testid="home-tv"
      >
        <span className="home-flat__tv-screen" aria-hidden />
        <span className="home-flat__tv-felt" aria-hidden />
        <span className="home-flat__tv-shimmer" aria-hidden />
      </button>
      <div className="home-flat__couch" style={{ left: FLAT.couch.x, top: FLAT.couch.y, width: FLAT.couch.w, height: FLAT.couch.h }} aria-hidden>
        <span /><span />
      </div>

      {/* the kitchen table, from above. It leads somewhere on both shells now:
          to the game when one is running on it, to the chairs when it is
          empty. With no destination at all it is furniture again — aria-hidden,
          exactly as before. */}
      {onTable ? (
        <button
          type="button"
          className="home-flat__table"
          style={tableBox}
          onClick={onTable}
          aria-label={tableLabel || 'The kitchen table — four chairs'}
          data-testid="home-table"
        />
      ) : (
        <div className="home-flat__table" style={tableBox} aria-hidden />
      )}

      {/* HOME-2 job 1 · THE DOOR IS THE CASINO.
          Wave 53 took HOME · CASINO · YOU off the bottom of the screen and made
          the three of them things in the world. The casino is the door: you tap
          it and he walks there. Without a destination it is furniture again —
          which is what the desk still hands it, because the desk has a rail. */}
      {onDoor ? (
        <button
          type="button"
          className="home-flat__door"
          style={{ left: FLAT.door.x, top: FLAT.door.y, width: FLAT.door.w, height: FLAT.door.h }}
          onClick={onDoor}
          aria-label="The door — the casino"
          data-testid="home-door"
        >
          <span className="home-flat__door-light" aria-hidden />
          <span className="home-flat__door-knob" aria-hidden />
        </button>
      ) : (
        <div className="home-flat__door" style={{ left: FLAT.door.x, top: FLAT.door.y, width: FLAT.door.w, height: FLAT.door.h }} aria-hidden>
          <span className="home-flat__door-light" />
          <span className="home-flat__door-knob" />
        </div>
      )}

      {/* the safe, under the frames */}
      <button
        type="button"
        className="home-flat__safe"
        style={{ left: FLAT.safe.x, top: FLAT.safe.y, width: FLAT.safe.w, height: FLAT.safe.h }}
        onClick={onSafe}
        aria-label="The safe — your wallet"
        data-testid="home-safe"
      >
        <span className="home-flat__safe-dial" aria-hidden />
        <span className="home-flat__safe-hinge" aria-hidden />
      </button>

      {/* the fridge, beside the table */}
      <button
        type="button"
        className="home-flat__fridge"
        style={{ left: FLAT.fridge.x, top: FLAT.fridge.y, width: FLAT.fridge.w, height: FLAT.fridge.h }}
        onClick={onFridge}
        aria-label="The fridge — what is in stock"
        data-testid="home-fridge"
      >
        <span className="home-flat__fridge-split" aria-hidden />
        <span className="home-flat__fridge-handle" aria-hidden />
      </button>

      {lit ? (
        <div
          className="home-flat__lamp"
          style={{ left: FLAT.table.cx - 130, top: FLAT.table.cy - 120 }}
          aria-hidden
        />
      ) : null}

      {children}
    </div>
  );
}

export { F_W, F_H };
