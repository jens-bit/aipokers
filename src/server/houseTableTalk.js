import { houseVoice, houseLine, createHouseMemory } from './houseDialogue.js';
import { loadHouseDialogueMemory, saveHouseDialogueMemory, _dbPath } from './store.js';

export const HOUSE_LINE_GAP_HANDS = 4;
const tableState = new WeakMap();
let memory, memoryScope;
function book() {
  const scope = _dbPath();
  if (!memory || scope !== memoryScope) {
    memoryScope = scope;
    memory = createHouseMemory({ load: loadHouseDialogueMemory, save: saveHouseDialogueMemory });
  }
  return memory;
}
function state(table) {
  if (!tableState.has(table)) tableState.set(table, { greeted: new Set(), lastByHouse: new Map(), hand: -1 });
  return tableState.get(table);
}
function occupants(table) {
  if (table.home || table.closed || !table.game) return [];
  return table.pending.flatMap((person, seat) => person && table.game.seats[seat]?.playerId === person.playerId
    ? [{ seat, playerId: person.playerId, name: person.displayName, house: !!table.aiSeats[seat] && !!houseVoice(person.playerId) }] : []);
}
export function isHouseSpeaker(table, seat) {
  return !table.home && !!table.aiSeats[seat] && !!houseVoice(table.pending[seat]?.playerId);
}
function say(table, person, event, name) {
  const current = state(table), hand = table.game?.handNumber;
  if (!Number.isInteger(hand) || current.hand === hand
    || hand - (current.lastByHouse.get(person.playerId) ?? -Infinity) < HOUSE_LINE_GAP_HANDS) return false;
  const text = houseLine(person.playerId, event, { name, hand, previous: table._lastPublicAiLine[person.seat] });
  if (!text || !table._speakOnce(person.seat, text)) return false;
  current.hand = hand;
  current.lastByHouse.set(person.playerId, hand);
  return true;
}

// One greeting at most per hand. A current pair is greeted once at this table;
// seeing a different regular never borrows another character's recognition.
export function greetHouseTable(table) {
  const seats = occupants(table), current = state(table);
  for (const person of seats.filter(s => s.house)) {
    for (const opponent of seats.filter(s => !s.house)) {
      const pair = JSON.stringify([person.playerId, opponent.playerId]);
      if (current.greeted.has(pair)) continue;
      const prior = book().get(person.playerId, opponent.playerId);
      const event = !prior ? 'hello' : prior.outcome === 'won' ? 'returnWon' : prior.outcome === 'lost' ? 'returnLost' : 'return';
      if (!say(table, person, event, opponent.name)) continue;
      current.greeted.add(pair);
      if (current.greeted.size > 64) current.greeted.delete(current.greeted.values().next().value);
      return;
    }
  }
}

// Called only AFTER the paced public award, before the roster can change.
// No cards, equity, strategy, biography or private chat enter this projection.
export function finishHouseHand(table, result) {
  const seats = occupants(table);
  if (!result || table.game?.street !== 'complete' || !seats.some(s => s.house)) return;
  const winners = new Set((Array.isArray(result.winners) ? result.winners : []).map(w => w?.seat));
  const rows = [];
  for (const person of seats.filter(s => s.house)) {
    const others = seats.filter(s => !s.house);
    for (const opponent of others) rows.push({ house: person.playerId, opponent: opponent.playerId,
      tableId: table.tableId, handNumber: table.game.handNumber,
      outcome: winners.has(person.seat) ? (winners.has(opponent.seat) ? 'shared' : 'won') : winners.has(opponent.seat) ? 'lost' : 'played' });
    if (others.length) {
      const event = winners.has(person.seat) ? (winners.size > 1 ? 'shared' : 'won') : 'lost';
      say(table, person, event);
    }
  }
  if (rows.length) book().noteMany(rows);
}

// House replies are bounded public banter. They neither store the message nor
// copy it into an LLM prompt, and never create pendingNeedle/poker adjustments.
export function replyFromHouse(table, seat) {
  if (!isHouseSpeaker(table, seat)) return false;
  const person = occupants(table).find(s => s.seat === seat);
  if (person) say(table, person, 'reply');
  return true;
}
