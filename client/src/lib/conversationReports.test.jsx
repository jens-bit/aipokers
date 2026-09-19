import { expect, it } from 'vitest';
import { appendSavedReports, savedChatMessage } from './conversationReports.js';

it('BUG-264: report refresh only appends unseen activity IDs and leaves ordinary pending chat untouched', () => {
  let id = 0;
  const mkMsg = (role, content) => ({ role, content, _id: ++id });
  const report = { role: 'assistant', reportKind: 'study', reportId: 's1', content: 'A read from the tape.' };
  const pending = mkMsg('user', 'What happened?');
  const first = [pending, savedChatMessage(report, mkMsg)];
  expect(appendSavedReports(first, [report, { role: 'assistant', content: 'An old answer.' }], mkMsg)).toBe(first);
  const second = appendSavedReports(first, [{ ...report, reportId: 's2' }, { ...report, reportId: 's2' }], mkMsg);
  expect(second[0]).toBe(pending);
  expect(second).toHaveLength(3);
  expect(second[2].reportId).toBe('s2');
});
