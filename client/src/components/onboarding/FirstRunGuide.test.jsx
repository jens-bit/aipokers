import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FirstRunGuideProvider, useFirstRunGuide } from './FirstRunGuide.jsx';

const pebble = { id: 'agent-pebble', name: 'Pebble' };
const moss = { id: 'agent-moss', name: 'Moss' };
const key = owner => `railbird.guide.v1:${owner}`;
const legacyKey = (owner, agent = pebble.id) => `railbird.practice.v1:${JSON.stringify([owner, agent])}`;
const wrapper = ({ children }) => <FirstRunGuideProvider ownerId="owner-a">{children}</FirstRunGuideProvider>;
const setup = () => renderHook(useFirstRunGuide, { wrapper });

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('FIRST-GUIDE: one real first session per owner', () => {
  it('is inert outside the provider for isolated existing screens', () => {
    const { result } = renderHook(useFirstRunGuide);
    act(() => {
      result.current.begin(pebble);
      result.current.advance('live');
      result.current.dismiss();
    });
    expect(result.current).toMatchObject({ stage: null, agentId: null, agentName: null });
    expect(localStorage.length).toBe(0);
  });

  it('waits for Home to begin, records seen immediately, and keeps its original agent', () => {
    const { result } = setup();
    expect(result.current.stage).toBeNull();
    expect(localStorage.getItem(key('owner-a'))).toBeNull();
    act(() => { result.current.begin(pebble); result.current.begin(moss); });
    expect(result.current).toMatchObject({ stage: 'agent', agentId: pebble.id, agentName: 'Pebble' });
    expect(JSON.parse(localStorage.getItem(key('owner-a')))).toEqual({ version: 1, seen: true });
    act(() => result.current.advance('table'));
    act(() => result.current.begin(moss));
    expect(result.current).toMatchObject({ stage: 'table', agentId: pebble.id });
  });

  it('advances only during an active run and never restarts after dismissal', () => {
    const { result } = setup();
    act(() => result.current.advance('watch'));
    expect(result.current.stage).toBeNull();
    act(() => result.current.begin(pebble));
    for (const stage of ['table', 'watch', 'live']) {
      act(() => result.current.advance(stage));
      expect(result.current.stage).toBe(stage);
    }
    act(() => result.current.advance('casino'));
    expect(result.current.stage).toBe('live');
    act(() => result.current.dismiss());
    act(() => { result.current.advance('agent'); result.current.begin(moss); });
    expect(result.current).toMatchObject({ stage: null, agentId: null, agentName: null });
  });

  it('does not consume the run when dismissal happens before Home is ready', () => {
    const { result } = setup();
    act(() => result.current.dismiss());
    act(() => result.current.begin(pebble));
    expect(result.current.stage).toBe('agent');
  });

  it('takes a quiet kitchen through the casino door without rebinding the agent or restarting', () => {
    const { result } = setup();
    act(() => result.current.begin(pebble));
    act(() => result.current.advance('watch'));
    act(() => result.current.advance('door'));
    expect(result.current).toMatchObject({ stage: 'door', agentId: pebble.id, agentName: 'Pebble' });
    act(() => result.current.begin(moss));
    act(() => result.current.advance('live'));
    expect(result.current).toMatchObject({ stage: 'live', agentId: pebble.id });
    act(() => result.current.dismiss());
    act(() => result.current.advance('door'));
    act(() => result.current.begin(pebble));
    expect(result.current.stage).toBeNull();
  });

  it.each([undefined, {}, { id: '' }, { id: {} }, { ...pebble, guest: true }, { ...pebble, visiting: true }])(
    'does not consume a run for an ineligible agent %j', agent => {
      const { result } = setup();
      act(() => result.current.begin(agent));
      expect(result.current.stage).toBeNull();
      expect(localStorage.length).toBe(0);
      act(() => result.current.begin(pebble));
      expect(result.current.stage).toBe('agent');
    },
  );

  it('does not start without an owner identity', () => {
    const { result } = renderHook(useFirstRunGuide, {
      wrapper: ({ children }) => <FirstRunGuideProvider>{children}</FirstRunGuideProvider>,
    });
    act(() => result.current.begin(pebble));
    expect(result.current.stage).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('stays finished after a reload even if the previous run was abandoned before completion', () => {
    const first = setup();
    act(() => first.result.current.begin(pebble));
    first.unmount();
    const second = setup();
    act(() => second.result.current.begin(moss));
    expect(second.result.current).toMatchObject({ stage: null, agentId: null });
  });

  it('keeps runtime progress when the Home child is replaced by chat or Watch', () => {
    let guide;
    function Screen() { guide = useFirstRunGuide(); return null; }
    const view = render(<FirstRunGuideProvider ownerId="owner-a"><Screen key="home" /></FirstRunGuideProvider>);
    act(() => guide.begin(pebble));
    act(() => guide.advance('watch'));
    view.rerender(<FirstRunGuideProvider ownerId="owner-a"><Screen key="watch" /></FirstRunGuideProvider>);
    expect(guide).toMatchObject({ stage: 'watch', agentId: pebble.id });
  });

  it('hides during an overlay without consuming a pending run or advancing the hidden phase', () => {
    let guide;
    const observed = [];
    function Screen({ enabled }) {
      guide = useFirstRunGuide();
      observed.push({ enabled, stage: guide.stage });
      return null;
    }
    const tree = enabled => <FirstRunGuideProvider ownerId="owner-a" enabled={enabled}><Screen enabled={enabled} /></FirstRunGuideProvider>;
    const view = render(tree(false));
    act(() => { guide.begin(pebble); guide.advance('table'); });
    expect(localStorage.getItem(key('owner-a'))).toBeNull();
    view.rerender(tree(true));
    act(() => guide.begin(pebble));
    act(() => guide.advance('watch'));
    const activeGuide = guide;
    view.rerender(tree(false));
    expect(guide.stage).toBeNull();
    act(() => { guide.begin(moss); guide.advance('live'); activeGuide.advance('live'); });
    expect(observed.filter(row => !row.enabled).every(row => row.stage === null)).toBe(true);
    view.rerender(tree(true));
    expect(guide).toMatchObject({ stage: 'watch', agentId: pebble.id, agentName: 'Pebble' });
  });

  it('can dismiss the retained run while an overlay hides it', () => {
    let guide;
    function Screen() { guide = useFirstRunGuide(); return null; }
    const tree = enabled => <FirstRunGuideProvider ownerId="owner-a" enabled={enabled}><Screen /></FirstRunGuideProvider>;
    const view = render(tree(true));
    act(() => guide.begin(pebble));
    view.rerender(tree(false));
    act(() => guide.dismiss());
    view.rerender(tree(true));
    act(() => guide.begin(pebble));
    expect(guide).toMatchObject({ stage: null, agentId: null });
  });

  it('hides the previous owner synchronously and ignores callbacks retained from that owner', () => {
    let guide;
    const observed = [];
    function Screen({ owner }) {
      guide = useFirstRunGuide();
      observed.push({ owner, stage: guide.stage, agentId: guide.agentId });
      return null;
    }
    const tree = owner => <FirstRunGuideProvider ownerId={owner}><Screen owner={owner} /></FirstRunGuideProvider>;
    const view = render(tree('owner-a'));
    act(() => guide.begin(pebble));
    const oldGuide = guide;
    view.rerender(tree('owner-b'));
    expect(observed.filter(row => row.owner === 'owner-b').every(row => row.stage === null && row.agentId === null)).toBe(true);
    act(() => { oldGuide.begin(moss); oldGuide.advance('live'); oldGuide.dismiss(); });
    expect(guide.stage).toBeNull();
    act(() => guide.begin(moss));
    act(() => { oldGuide.advance('live'); oldGuide.dismiss(); });
    expect(guide).toMatchObject({ stage: 'agent', agentId: moss.id });
    view.rerender(tree('owner-a'));
    act(() => guide.begin(pebble));
    expect(guide).toMatchObject({ stage: null, agentId: null });
  });

  it.each([0, 4, 9])('migrates a valid legacy record at step %i without restarting guidance', step => {
    localStorage.setItem(legacyKey('owner-a'), JSON.stringify({ version: 1, step }));
    const { result } = setup();
    act(() => result.current.begin(moss));
    expect(result.current.stage).toBeNull();
    expect(JSON.parse(localStorage.getItem(key('owner-a')))).toEqual({ version: 1, seen: true });
  });

  it('ignores malformed, future-version, out-of-range and other-owner legacy records', () => {
    const values = ['invalid', { version: 2, step: 0 }, { version: 1, step: -1 }, { version: 1, step: 10 }, { version: 1, step: 0.5 }];
    values.forEach((value, index) => localStorage.setItem(legacyKey('owner-a', `bad-${index}`), typeof value === 'string' ? value : JSON.stringify(value)));
    localStorage.setItem('railbird.practice.v1:not-json', JSON.stringify({ version: 1, step: 0 }));
    localStorage.setItem('railbird.practice.v1:["owner-a"]', JSON.stringify({ version: 1, step: 0 }));
    localStorage.setItem(legacyKey('owner-b'), JSON.stringify({ version: 1, step: 0 }));
    localStorage.setItem(key('owner-a'), JSON.stringify({ version: 2, seen: true }));
    const { result } = setup();
    act(() => result.current.begin(pebble));
    expect(result.current.stage).toBe('agent');
  });

  it('finds a valid legacy record after malformed entries instead of aborting the scan', () => {
    localStorage.setItem(legacyKey('owner-a', 'invalid'), 'not-json');
    localStorage.setItem(legacyKey('owner-a', 'old-agent'), JSON.stringify({ version: 1, step: 0 }));
    const { result } = setup();
    act(() => result.current.begin(pebble));
    expect(result.current.stage).toBeNull();
  });

  it('rechecks persisted seen at begin so two mounted providers cannot both start', () => {
    const first = setup();
    const second = setup();
    act(() => first.result.current.begin(pebble));
    act(() => second.result.current.begin(moss));
    expect(second.result.current.stage).toBeNull();
  });

  it('remembers consumed owners within the provider when all storage access is blocked', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('storage blocked'); });
    let guide;
    function Screen() { guide = useFirstRunGuide(); return null; }
    const tree = owner => <FirstRunGuideProvider ownerId={owner}><Screen /></FirstRunGuideProvider>;
    const view = render(tree('owner-a'));
    act(() => guide.begin(pebble));
    act(() => guide.advance('watch'));
    expect(guide.stage).toBe('watch');
    act(() => guide.dismiss());
    act(() => guide.begin(moss));
    expect(guide.stage).toBeNull();
    view.rerender(tree('owner-b'));
    act(() => guide.begin(moss));
    expect(guide.agentId).toBe(moss.id);
    view.rerender(tree('owner-a'));
    act(() => guide.begin(pebble));
    expect(guide.stage).toBeNull();
  });
});
