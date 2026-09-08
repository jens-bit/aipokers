// client/src/components/home/HomeFlat.jsx — HOME-1
//
// The room. Ported from design-refs/mood-home.jsx (`HomeFlat`): floorboards
// running away from the viewer, the wall the frames hang on, the television and
// the couch in the left corner, the kitchen table in the middle, the door on the
// right wall line, and a warm pool of light over the table when anyone is in.
//
// HOME-2 job 4 — the fixtures are all the ref's now, on the ref's own
// coordinates (flat.js): the SAFE against the left wall under the frames, the
// FRIDGE on the kitchen wall, the DOOR cut into the right wall with a lit
// marquee above it, and the TELEVISION at the bottom of the room. There is no
// second set in the left corner any more — one television, and it shows the
// casino.
//
// The room is a fixed 390×470 coordinate space scaled to fit whatever box it is
// given, so the arithmetic in flat.js is the same on every device. Everything is
// a div: no image, no sprite sheet, nothing to load.

import { FLAT, TV_SCREEN, TV_CHAIR, F_W, F_H } from './flat.js';
import { money } from '../../lib/wallet.js';

// `onTable` is optional and the table is furniture without it. Both branches
// that gave it a tap did so for a different destination — BUGS-A job 7 watches
// the game that is on it, BIRTH-5 opens the chairs when it is empty — so the
// caller says where it leads and `tableLabel` says so out loud.
// DRAFT-2: `doorTag` hangs the ref's `DoorTap` label over the door — the wave-53
// nav's "no bottom bar" law made the door the way to the casino, and a door that
// leads somewhere says so. It is OPT-IN rather than always drawn: HOME has not
// been given the tag yet (that is the nav tree's to land, on its own frames), and
// a label appearing on the room's most-looked-at screen is not something the
// draft screen should decide on its way past. The draft asks for it because the
// draft is where the sheet could cover it, and a thing that can be covered has to
// be a thing a test can find.
export function HomeFlat({
  lit = true, children, onSafe, onFridge, onTv, onTable, onDoor,
  tvLabel = null, tableLabel = null, doorTag = null,
  // HOME-2 job 4 · what is on the television. A component rather than markup,
  // because what is on it is data (CasinoOnTv) and this file draws furniture.
  tvScreen = null,
  // BUGS-C job 4 · is there a show on, right now, worth lighting the sign for?
  signLive = false,
  balance = null,
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
        {Array.from({ length: Math.ceil((F_H - 96) / 42) }).map((_, i) => <span key={i} style={{ top: 96 + i * 42 }} />)}
      </div>
      <div className="home-flat__right-wall" aria-hidden />

      {/* the wall the frames hang on */}
      <div className="home-flat__wall" style={{ height: FLAT.wall.y + FLAT.wall.h + 8 }} aria-hidden />

      {/* the couch */}
      <div className="home-flat__couch" style={{ left: FLAT.couch.x, top: FLAT.couch.y, width: FLAT.couch.w, height: FLAT.couch.h }} aria-hidden>
        <i className="home-flat__couch-back" />
        <i className="home-flat__couch-arm home-flat__couch-arm--top" />
        <i className="home-flat__couch-arm home-flat__couch-arm--bottom" />
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

      {/* Current board 29/42 DoorTap: one word down the jamb, bulbs on both sides and light spilling into the room. SIGN uses this footprint for bubble/placement clearance. Pointer events pass to the door. */}
      <div
        className={`home-flat__sign${signLive ? ' home-flat__sign--live' : ''}`}
        style={{ left: FLAT.door.x, top: FLAT.door.y, width: FLAT.door.w, height: FLAT.door.h }}
        data-testid="home-door-sign"
        data-live={signLive ? 'true' : 'false'}
      >
        <span className="home-flat__sign-glow" aria-hidden />
        {[0,1].map(side=><span key={side} className={`home-flat__sign-bulbs home-flat__sign-bulbs--${side}`} aria-hidden>{[0,1,2,3].map(i=><i key={i}/>)}</span>)}
        <span className="home-flat__sign-word">CASINO</span>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden><path d="M12 5v13m-6-5 6 6 6-6"/></svg>
      </div>

      {/* HOME-2 job 4 · THE TAPE ROOM, at the bottom of the room: one screen
          and one chair. What is ON the screen is handed in — the casino in
          miniature, which is what lets you see it from the sofa without
          leaving (CasinoOnTv). */}
      <button
        type="button"
        className="home-flat__tv"
        style={{ left: TV_SCREEN.x, top: TV_SCREEN.y, width: TV_SCREEN.w, height: TV_SCREEN.h }}
        onClick={onTv}
        aria-label={tvLabel ? `Television — ${tvLabel}` : 'Television — the casino'}
        data-testid="home-tv"
      >
        <span className="home-flat__tv-screen" aria-hidden>{tvScreen}</span>
      </button>
      <div
        className="home-flat__tv-chair"
        style={{ left: TV_CHAIR.x, top: TV_CHAIR.y, width: TV_CHAIR.w, height: TV_CHAIR.h }}
        aria-hidden
      />
      {/* the tag over it — design-refs/mood-nav.jsx `DoorTap` */}
      {doorTag ? (
        <span
          className="home-flat__door-tag"
          /* Anchored by its RIGHT edge to the door's, not by its left to the
             ref's `door.x - 4`. The room clips at 390 and the tag is ~86px of
             nowrap text starting at 326, so a left anchor puts "→" outside the
             room and the label reads "THE CASINO" with the arrow sliced off.
             Right-anchoring keeps it on the door and whole at every width. */
          style={{ right: F_W - (FLAT.door.x + FLAT.door.w), top: FLAT.door.y - 26 }}
          data-testid="home-door-tag"
        >
          {doorTag}
        </span>
      ) : null}

      {/* the safe, under the frames */}
      <button
        type="button"
        className="home-flat__safe"
        style={{ left: FLAT.safe.x, top: FLAT.safe.y, width: FLAT.safe.w, height: FLAT.safe.h }}
        onClick={onSafe}
        aria-label="The safe — your wallet"
        data-testid="home-safe"
      >
        <span className="home-flat__safe-inset" aria-hidden />
        <span className="home-flat__safe-dial" aria-hidden><i /></span>
        <span className="home-flat__safe-hinge" aria-hidden />
        <span className="home-flat__safe-lever" aria-hidden />
        {Number.isFinite(balance) && <span className="home-flat__safe-balance">{money(balance)}</span>}
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
        <span className="home-flat__fridge-handle home-flat__fridge-handle--freezer" aria-hidden />
        <span className="home-flat__fridge-stock" aria-hidden><i /><i /><i /><b /></span>
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
