import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../../styles/contextHint.css';

const MARGIN = 12;
const GAP = 12;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const clippedOverflow = value => /^(hidden|clip|auto|scroll)$/.test(value);

// Work in viewport coordinates so scaled felts and scrolling rooms share the
// same arrow. Clip the outline to what the player can actually see.
function visibleTarget(node, viewport) {
  if (!node?.isConnected) return null;
  const rect = node.getBoundingClientRect();
  if (!(rect.width > 0 && rect.height > 0)) return null;
  let left = Math.max(rect.left, viewport.left), top = Math.max(rect.top, viewport.top);
  let right = Math.min(rect.right, viewport.right), bottom = Math.min(rect.bottom, viewport.bottom);
  for (let current = node; current; current = current.parentElement) {
    const style = getComputedStyle(current);
    if (current.hidden || style.display === 'none' || style.visibility === 'hidden'
      || style.visibility === 'collapse' || style.opacity === '0' || style.contentVisibility === 'hidden') return null;
    if (current === node) continue;
    const clipX = clippedOverflow(style.overflowX || style.overflow);
    const clipY = clippedOverflow(style.overflowY || style.overflow);
    if (clipX || clipY) {
      const parent = current.getBoundingClientRect();
      if (clipX) { left = Math.max(left, parent.left); right = Math.min(right, parent.right); }
      if (clipY) { top = Math.max(top, parent.top); bottom = Math.min(bottom, parent.bottom); }
    }
  }
  return right > left && bottom > top ? { left, top, right, bottom, width: right - left, height: bottom - top } : null;
}

function union(rects) {
  if (!rects.length) return null;
  const left = Math.min(...rects.map(rect => rect.left)), top = Math.min(...rects.map(rect => rect.top));
  const right = Math.max(...rects.map(rect => rect.right)), bottom = Math.max(...rects.map(rect => rect.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function inMotion(nodes) {
  const checked = new Set();
  for (const node of nodes) for (let current = node; current && !checked.has(current); current = current.parentElement) {
    checked.add(current);
    if ((current.getAnimations?.() ?? []).some(animation => animation.playState === 'running' || animation.pending)) return true;
  }
  return false;
}

export function ContextHint({ rootRef, selector, targetChildren = null, text, onNext, onDismiss, nextLabel = 'Next', preferredSide = 'below' }) {
  const [layout, setLayout] = useState(null);
  const layerRef = useRef(null);
  const tipRef = useRef(null);
  const tipHeightRef = useRef(112);
  const refreshRef = useRef(null);

  useLayoutEffect(() => {
    tipHeightRef.current = tipRef.current?.getBoundingClientRect().height || 112;
    refreshRef.current?.();
  }, [text, nextLabel]);

  useLayoutEffect(() => {
    let active = true, frame = null;
    const observed = new Set();
    const save = next => setLayout(previous => {
      if (!previous || !next) return previous === next ? previous : next;
      return Object.keys(next).every(key => previous[key] === next[key]) ? previous : next;
    });
    const schedule = () => {
      if (!active || frame != null) return;
      frame = window.requestAnimationFrame(() => { frame = null; refresh(); });
    };
    const resize = new ResizeObserver(schedule);
    function refresh() {
      if (!active) return;
      const root = rootRef?.current;
      let target = null, subjects = [];
      try {
        target = root?.isConnected && selector ? root.querySelector(selector) : null;
        subjects = targetChildren ? [...(target?.querySelectorAll(targetChildren) ?? [])] : [target].filter(Boolean);
      } catch { /* A missing/invalid target has no hint. */ }
      const nextObserved = new Set([root, target, ...subjects, tipRef.current].filter(Boolean));
      for (const node of observed) if (!nextObserved.has(node)) { resize.unobserve?.(node); observed.delete(node); }
      for (const node of nextObserved) if (!observed.has(node)) { resize.observe(node); observed.add(node); }

      const visual = window.visualViewport;
      const left = visual?.offsetLeft ?? 0, top = visual?.offsetTop ?? 0;
      const width = visual?.width ?? window.innerWidth, height = visual?.height ?? window.innerHeight;
      const viewport = { left, top, right: left + width, bottom: top + height };
      const subject = union(subjects.map(node => visibleTarget(node, viewport)).filter(Boolean));
      // CSS transforms and positional transitions don't resize a box or mutate
      // the DOM between frames. Track only their active lifetime; quiet hints
      // continue to rely on observers and viewport events.
      if (inMotion([target, ...subjects].filter(Boolean))) schedule();
      if (!subject || width <= MARGIN * 2) { save(null); return; }
      const tipWidth = Math.min(240, width - MARGIN * 2);
      // Keep the measured height when a cramped viewport hides the portal;
      // falling back again would repeatedly show and hide a taller sentence.
      const measuredHeight = tipRef.current?.getBoundingClientRect().height;
      if (measuredHeight > 0) tipHeightRef.current = measuredHeight;
      const tipHeight = tipHeightRef.current;
      const below = viewport.bottom - MARGIN - subject.bottom - GAP;
      const above = subject.top - GAP - viewport.top - MARGIN;
      // Never cover the subject to make a hint fit. Its controls keep priority
      // when a keyboard or a very short viewport leaves no safe space.
      if (Math.max(above, below) < tipHeight) { save(null); return; }
      const side = preferredSide === 'above'
        ? (above >= tipHeight ? 'above' : 'below')
        : (below >= tipHeight ? 'below' : 'above');
      const tipLeft = clamp(subject.left + subject.width / 2 - tipWidth / 2, left + MARGIN, viewport.right - MARGIN - tipWidth);
      save({
        left: tipLeft, top: side === 'below' ? subject.bottom + GAP : subject.top - GAP - tipHeight,
        width: tipWidth, side,
        arrowLeft: clamp(subject.left + subject.width / 2 - tipLeft, 16, tipWidth - 16),
        targetLeft: subject.left, targetTop: subject.top, targetWidth: subject.width, targetHeight: subject.height,
      });
    }
    refreshRef.current = refresh;
    // The root itself may arrive or be replaced after the hint mounts. Body
    // observation catches that without polling; ignore our own portal updates.
    const mutations = new MutationObserver(records => {
      if (records.some(record => !layerRef.current?.contains(record.target))) schedule();
    });
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'open'] });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('animationstart', schedule, true);
    window.addEventListener('transitionrun', schedule, true);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    refresh();
    return () => {
      active = false;
      refreshRef.current = null;
      if (frame != null) window.cancelAnimationFrame(frame);
      resize.disconnect(); mutations.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('animationstart', schedule, true);
      window.removeEventListener('transitionrun', schedule, true);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
    };
  }, [rootRef, selector, targetChildren, preferredSide]);

  // Measure the real sentence after the portal lands, including a changed
  // step or font size. No focus, scroll, game state or timer is changed here.
  useLayoutEffect(() => { refreshRef.current?.(); }, [layout]);

  if (!layout) return null;
  return createPortal(
    <div className="context-hint-layer" ref={layerRef}>
      <div className="context-hint-target" data-testid="context-hint-target" aria-hidden="true"
        style={{ left: layout.targetLeft, top: layout.targetTop, width: layout.targetWidth, height: layout.targetHeight }}/>
      <aside className="context-hint" data-testid="context-hint" data-side={layout.side} role="note" aria-label="Getting started"
        ref={tipRef} style={{ left: layout.left, top: layout.top, width: layout.width }}>
        <span className="context-hint__arrow" aria-hidden="true" style={{ left: layout.arrowLeft }}/>
        <p>{text}</p>
        <div className="context-hint__actions">
          <button type="button" className="context-hint__skip" onClick={onDismiss}>Skip</button>
          {nextLabel !== null && <button type="button" className="context-hint__next" onClick={onNext}>{nextLabel}</button>}
        </div>
      </aside>
    </div>, document.body,
  );
}
