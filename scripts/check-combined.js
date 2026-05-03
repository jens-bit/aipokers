// Quick check: open a WebSocket against the combined server (HTTP+WS on the
// same port) and verify the join handshake works.
import { WebSocket } from 'ws';

const url = process.argv[2] || 'ws://localhost:8765';
const ws = new WebSocket(url);
const events = [];

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'join',
    tableId: 'check-' + Date.now(),
    playerId: 'check-player',
    displayName: 'Check',
    buyIn: 1000,
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  events.push(msg);
  if (msg.type === 'joined') {
    console.log(`ok   ws connected to ${url}, seated at ${msg.seat}`);
    ws.close();
    process.exit(0);
  }
  if (msg.type === 'error') {
    console.error(`error from server: ${msg.message}`);
    ws.close();
    process.exit(1);
  }
});

ws.on('error', (err) => { console.error('ws error:', err.message); process.exit(1); });
setTimeout(() => { console.error('timed out'); process.exit(1); }, 3000);
