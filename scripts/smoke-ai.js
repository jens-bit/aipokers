// scripts/smoke-ai.js
// Quick smoke test: one human player connects, AI auto-joins, play 3 hands.
// Run with: node scripts/smoke-ai.js
// Requires: AI_ENABLED=true server running on :8765

import WebSocket from 'ws';

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const PLAYER_ID = 'smoke_human_' + Date.now();

let handCount = 0;
const MAX_HANDS = 3;

function connect() {
  const ws = new WebSocket(WS_URL);
  let seat = null;

  ws.on('open', () => {
    console.log('[smoke] Connected, joining table...');
    ws.send(JSON.stringify({
      type: 'join',
      tableId: 'ai-test-' + Date.now(),
      playerId: PLAYER_ID,
      displayName: 'Human Tester',
      buyIn: 1000,
      smallBlind: 10,
      bigBlind: 20,
    }));
  });

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());

    switch (msg.type) {
      case 'joined':
        seat = msg.seat;
        console.log(`[smoke] Seated at slot ${seat}. Waiting for AI opponent...`);
        break;

      case 'hand_start':
        handCount++;
        console.log(`\n[smoke] ── Hand #${msg.handNumber} ──`);
        break;

      case 'state': {
        const s = msg.state;
        const me = s.seats[seat];
        const opp = s.seats[1 - seat];
        if (s.toAct === seat && s.street !== 'complete' && s.street !== 'waiting') {
          const legal = msg.legalActions;
          console.log(`[smoke] My turn (${s.street}) — hand ${[...me.holeCards].join(' ')} board [${s.community.join(' ') || 'none'}] pot ${s.pot}`);
          console.log(`[smoke] Legal: ${legal.map(a => a.type + (a.amount ? ' ' + a.amount : '')).join(', ')}`);
          // Always call/check for simplicity.
          const call = legal.find(a => a.type === 'call');
          const check = legal.find(a => a.type === 'check');
          const action = call ? { type: 'call' } : check ? { type: 'check' } : { type: 'fold' };
          console.log(`[smoke] Acting: ${action.type}`);
          ws.send(JSON.stringify({ type: 'action', action }));
        } else if (s.toAct === 1 - seat) {
          const oppName = opp.displayName || 'AI';
          console.log(`[smoke] Waiting for ${oppName} (${s.street}) pot=${s.pot}...`);
        }
        break;
      }

      case 'hand_result':
        console.log(`[smoke] Hand result:`, JSON.stringify(msg.result));
        if (handCount < MAX_HANDS) {
          setTimeout(() => {
            console.log('[smoke] Dealing next hand...');
            ws.send(JSON.stringify({ type: 'deal' }));
          }, 500);
        } else {
          console.log(`\n[smoke] ✓ Completed ${MAX_HANDS} hands. AI agent is working!\n`);
          ws.close();
          process.exit(0);
        }
        break;

      case 'table_closed':
        console.log('[smoke] Table closed:', msg.reason);
        ws.close();
        process.exit(0);
        break;

      case 'error':
        console.error('[smoke] Server error:', msg.message);
        break;
    }
  });

  ws.on('error', (err) => {
    console.error('[smoke] WS error:', err.message);
    process.exit(1);
  });

  ws.on('close', () => console.log('[smoke] Disconnected.'));
}

connect();
