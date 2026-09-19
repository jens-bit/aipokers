import test from 'node:test';
import assert from 'node:assert/strict';
import { appendOwnerReport, sessionReportText } from './ownerReports.js';

test('BUG-264: report-back preserves real profit, loss and unknown results without calling them payouts', () => {
  assert.equal(sessionReportText({ hands: 8, net: 340, opener: 'Steady enough.' }), 'I finished 8 hands at +$340 net. Steady enough.');
  assert.equal(sessionReportText({ hands: 1, net: -2000 }), 'I finished 1 hand at −$2,000 net.');
  assert.equal(sessionReportText({}), 'My session is finished.');
});

test('BUG-264: private activity reports stay bounded and an acknowledged event is never appended again', () => {
  const agent = { chatHistory: [{ role: 'user', content: 'Play carefully.' }] };
  const report = { kind: 'session', id: 's1', content: 'I finished 8 hands at +$340 net.', at: 10 };
  assert.ok(appendOwnerReport(agent, report));
  agent.unseenRecap = false;
  agent.chatHistory = [];
  assert.equal(appendOwnerReport(agent, report), null);
  assert.equal(agent.chatHistory.length, 0);
  assert.equal(agent.unseenRecap, false);
  for (let i = 0; i < 40; i++) appendOwnerReport(agent, { kind: 'study', id: `study-${i}`, content: 'One learned read.' });
  assert.equal(agent.ownerReportIds.length, 32);
  assert.equal(agent.chatHistory.length, 12);
  assert.equal(agent.ownerCommandRevision, 41);
});
