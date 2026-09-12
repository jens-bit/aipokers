import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ContextHint } from './ContextHint.jsx';

const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });
let rootRef, boxes, observers, tipHeight;

beforeEach(() => {
  boxes = new Map(); observers = []; tipHeight = 112;
  vi.stubGlobal('innerWidth', 320);
  vi.stubGlobal('innerHeight', 590);
  vi.stubGlobal('ResizeObserver', class {
    targets = new Set();
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); this.disconnected = true; }
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    if (this.dataset.testid === 'context-hint') return rect(0, 0, Number.parseFloat(this.style.width) || 240, tipHeight);
    return boxes.get(this) ?? rect(0, 0, 320, 590);
  });
  const root = document.createElement('main');
  document.body.append(root);
  rootRef = { current: root };
});
afterEach(() => { cleanup(); rootRef.current?.remove(); vi.restoreAllMocks(); });

function target(box = rect(120, 220, 60, 80), name = 'cards') {
  const node = document.createElement('button');
  node.className = name; node.textContent = 'Actual game control';
  boxes.set(node, box); rootRef.current.append(node);
  return node;
}
function show(props = {}) {
  return render(<ContextHint rootRef={rootRef} selector=".cards" text="These are your agent’s two cards." onNext={() => {}} onDismiss={() => {}} {...props}/>);
}
const bounds = node => ({ left: Number.parseFloat(node.style.left), top: Number.parseFloat(node.style.top), width: Number.parseFloat(node.style.width), height: 112 });
const withinHint = () => within(screen.getByTestId('context-hint'));

it('CONTEXT-HINT-1: waits for the actual target and removes its portal when that target leaves', async () => {
  show();
  expect(screen.queryByTestId('context-hint')).toBeNull();
  const node = target();
  const hint = await screen.findByTestId('context-hint');
  expect(hint).toHaveAccessibleName('Getting started');
  expect(rootRef.current.contains(hint)).toBe(false);
  expect(screen.getByTestId('context-hint-target')).toHaveStyle({ left: '120px', top: '220px', width: '60px', height: '80px' });
  node.remove();
  await waitFor(() => expect(screen.queryByTestId('context-hint')).toBeNull());
});

it.each([
  ['below', rect(270, 20, 40, 40)],
  ['above', rect(4, 520, 48, 48)],
])('CONTEXT-HINT-1: fits a 320px viewport %s the target without covering it', (side, box) => {
  target(box); show();
  const hint = screen.getByTestId('context-hint');
  const tip = bounds(hint);
  expect(hint).toHaveAttribute('data-side', side);
  expect(tip.left).toBeGreaterThanOrEqual(12);
  expect(tip.left + tip.width).toBeLessThanOrEqual(308);
  expect(tip.top).toBeGreaterThanOrEqual(12);
  expect(tip.top + tip.height).toBeLessThanOrEqual(578);
  if (side === 'below') expect(tip.top).toBeGreaterThan(box.bottom);
  else expect(tip.top + tip.height).toBeLessThan(box.top);
});

it('CONTEXT-HINT-1: follows scroll and resize, hiding offscreen or hidden targets', async () => {
  const node = target(); show();
  boxes.set(node, rect(120, 650, 60, 80));
  fireEvent.scroll(rootRef.current);
  await waitFor(() => expect(screen.queryByTestId('context-hint')).toBeNull());
  boxes.set(node, rect(100, 180, 60, 80));
  fireEvent(window, new Event('resize'));
  await screen.findByTestId('context-hint');
  node.hidden = true;
  await waitFor(() => expect(screen.queryByTestId('context-hint')).toBeNull());
  node.hidden = false;
  await screen.findByTestId('context-hint');
  boxes.set(node, rect(100, 200, 60, 80));
  act(() => observers[0].callback([]));
  await waitFor(() => expect(screen.getByTestId('context-hint-target')).toHaveStyle({ top: '200px' }));
});

it('CONTEXT-HINT-1: hides a target clipped out of a scrolling screen without scrolling for the player', async () => {
  rootRef.current.style.overflow = 'hidden';
  boxes.set(rootRef.current, rect(0, 0, 320, 160));
  const node = target(rect(100, 220, 60, 80));
  const scroll = vi.spyOn(node, 'scrollIntoView');
  show();
  expect(screen.queryByTestId('context-hint')).toBeNull();
  boxes.set(node, rect(100, 40, 60, 60));
  fireEvent.scroll(rootRef.current);
  await screen.findByTestId('context-hint');
  expect(scroll).not.toHaveBeenCalled();
});

it('CONTEXT-HINT-1: a taller measured sentence stays hidden when neither side has room', async () => {
  tipHeight = 150;
  target(rect(100, 130, 60, 320));
  show();
  expect(screen.queryByTestId('context-hint')).toBeNull();
  vi.stubGlobal('innerHeight', 700);
  fireEvent(window, new Event('resize'));
  expect(await screen.findByTestId('context-hint')).toHaveAttribute('data-side', 'below');
});

it('CONTEXT-HINT-1: can prefer above and falls below when only that side fits', async () => {
  const node = target(); show({ preferredSide: 'above' });
  expect(screen.getByTestId('context-hint')).toHaveAttribute('data-side', 'above');
  boxes.set(node, rect(120, 20, 60, 60));
  fireEvent(window, new Event('resize'));
  await waitFor(() => expect(screen.getByTestId('context-hint')).toHaveAttribute('data-side', 'below'));
});

it('CONTEXT-HINT-1: outlines visible card children rather than their full-width board container', async () => {
  const node = target(rect(0, 200, 320, 64));
  const first = document.createElement('span'), second = document.createElement('span');
  first.className = second.className = 'card';
  boxes.set(first, rect(110, 202, 40, 60)); boxes.set(second, rect(158, 200, 40, 64));
  node.append(first, second);
  show({ targetChildren: '.card' });
  expect(screen.getByTestId('context-hint-target')).toHaveStyle({ left: '110px', top: '200px', width: '88px', height: '64px' });
  expect(observers[0].targets.has(first)).toBe(true);
  second.hidden = true;
  await waitFor(() => expect(screen.getByTestId('context-hint-target')).toHaveStyle({ width: '40px', left: '110px' }));
  first.remove();
  await waitFor(() => expect(screen.queryByTestId('context-hint')).toBeNull());
});

it('CONTEXT-HINT-1: Skip-only guidance leaves the real target as the action', () => {
  const node = target(), action = vi.fn(), next = vi.fn(), dismiss = vi.fn();
  node.addEventListener('click', action);
  show({ nextLabel: null, onNext: next, onDismiss: dismiss });
  expect(withinHint().getAllByRole('button')).toHaveLength(1);
  fireEvent.click(node);
  expect(action).toHaveBeenCalledOnce(); expect(next).not.toHaveBeenCalled();
  fireEvent.click(withinHint().getByRole('button', { name: 'Skip' }));
  expect(dismiss).toHaveBeenCalledOnce();
});

it('CONTEXT-HINT-1: follows CSS motion without a DOM mutation and stops measuring when it finishes', () => {
  const node = target();
  let moving = true;
  node.getAnimations = () => moving ? [{ playState: 'running' }] : [];
  const frames = new Map(); let id = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++id, callback); return id; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(key => frames.delete(key));
  const tick = () => { const [key, callback] = frames.entries().next().value; frames.delete(key); callback(); };
  show();
  expect(frames.size).toBe(1);
  boxes.set(node, rect(170, 220, 60, 80));
  act(tick);
  expect(screen.getByTestId('context-hint-target')).toHaveStyle({ left: '170px' });
  moving = false;
  act(tick);
  expect(frames.size).toBe(0);
});

it('CONTEXT-HINT-1: keeps focus and game actions intact while Next and Skip call only their own callbacks', async () => {
  const node = target();
  const action = vi.fn(), next = vi.fn(), dismiss = vi.fn();
  node.addEventListener('click', action); node.focus();
  const view = show({ onNext: next, onDismiss: dismiss });
  expect(node).toHaveFocus();
  fireEvent.click(node);
  expect(action).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(next).toHaveBeenCalledOnce();
  expect(dismiss).not.toHaveBeenCalled();
  view.rerender(<ContextHint rootRef={rootRef} selector=".cards" text="Your agent makes the poker decisions." nextLabel="Done" onNext={next} onDismiss={dismiss}/>);
  expect(node).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
  expect(dismiss).toHaveBeenCalledOnce();
  expect(next).toHaveBeenCalledOnce();
  expect(action).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
});

it('CONTEXT-HINT-1: cleans observers, listeners and a pending animation frame on unmount', () => {
  target();
  const frames = new Map(); let id = 0;
  const request = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++id, callback); return id; });
  const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(key => frames.delete(key));
  const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
  const view = show();
  fireEvent(window, new Event('resize'));
  expect(frames.size).toBe(1);
  view.unmount();
  expect(frames.size).toBe(0);
  expect(cancel).toHaveBeenCalled();
  expect(observers.every(observer => observer.disconnected)).toBe(true);
  expect(disconnect).toHaveBeenCalled();
  request.mockClear();
  fireEvent(window, new Event('resize')); fireEvent.scroll(rootRef.current);
  expect(request).not.toHaveBeenCalled();
  expect(screen.queryByTestId('context-hint')).toBeNull();
});
