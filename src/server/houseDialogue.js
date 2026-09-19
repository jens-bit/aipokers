// VILLAIN-1: public character, separate from poker policy and private reads.
// These voices consume names and observed outcomes only. No model calls.
const VOICES = {
  doyle_v3: { character: 'An unhurried veteran; dry, welcoming, never impressed by noise.',
    hello: ['Pull up a chair, {name}. Plenty of evening left.', 'Evening, {name}. Let the cards do the talking.'],
    return: ['Back again, {name}. Same chair, different cards.', '{name}. Thought I might see you round again.'],
    returnWon: ['{name}. I remember our last pot. Take your time.', 'Another round, {name}? Last one came my way.'],
    returnLost: ['{name}. You took that last pot. I remember.', 'Back for another, {name}? You had the last word.'],
    won: ['That one can pay for the coffee.', 'No hurry. The chips found their way.'],
    lost: ['Keep the chair warm. The night is young.', 'That one went your way. Deal the next.'],
    shared: ['Room enough in that pot for both of us.', 'Half a loaf still goes with coffee.'],
    reply: ['I hear you. Cards first, stories after.', 'Save me a story for the next shuffle.'] },
  phil_ai: { character: 'A theatrical rival; sharp confidence, enjoys a public challenge.',
    hello: ['{name}. Finally, someone to make this interesting.', 'Sit down, {name}. I was getting bored.'],
    return: ['{name}, back for the headline?', 'Look who came back. Make it interesting, {name}.'],
    returnWon: ['{name}. I kept the last pot. Want another look?', 'Back, {name}? You remember who took the last one.'],
    returnLost: ['{name}. You got the last pot. Enjoy the replay.', 'I remember that pot, {name}. My turn to answer.'],
    won: ['That is how you finish a sentence.', 'Put my name on that one.'],
    lost: ['Enjoy the spotlight. I am still sitting here.', 'Fine. You get that scene.'],
    shared: ['We can share the chips. Not the headline.', 'A shared pot. I wanted a solo.'],
    reply: ['All that talking. I hope the cards can follow.', 'Keep talking. This table needed a soundtrack.'] },
  granite: { character: 'A patient stone-faced regular; few words and a very long memory.',
    hello: ['{name}. I can wait.', 'Sit, {name}. I am staying.'],
    return: ['{name}. Same seat. I remember.', 'Back, {name}. No rush.'],
    returnWon: ['{name}. Last pot stayed here.', 'I remember, {name}. I took the last one.'],
    returnLost: ['{name}. You took the last pot. I remember.', 'That last pot was yours, {name}. I can wait.'],
    won: ['This one stays here.', 'Worth the wait.'],
    lost: ['Still here.', 'I have time.'],
    shared: ['Half stays here.', 'We split it. I can wait.'],
    reply: ['I heard you.', 'The cards will answer.'] },
  ms_allin: { character: 'A gleeful daredevil; delighted by the game, generous even after losing.',
    hello: ['{name}! A fresh chair and a whole new mess.', 'Come on, {name}. Give this evening a story.'],
    return: ['{name}! You came back for the fun part.', 'Another round, {name}? I saved you some chaos.'],
    returnWon: ['{name}! I took the last one. Come get it.', 'Welcome back, {name}. Last pot was my souvenir.'],
    returnLost: ['{name}! You took the last pot. Do it again.', 'That last pot was yours, {name}. What a ride.'],
    won: ['Oh, that was worth sitting down for!', 'Now that is a souvenir.'],
    lost: ['Take it! I want the next story.', 'That was a ride. Again!'],
    shared: ['We both get a souvenir!', 'Sharing the chaos. I like it.'],
    reply: ['Now you are making this an evening!', 'More of that energy, please.'] },
  tilted_ted: { character: 'A rueful optimist; complains about his luck, then finds another reason to stay.',
    hello: ['{name}. Tell me this is the lucky chair.', 'Evening, {name}. Surely tonight is different.'],
    return: ['{name} again. Maybe this time the chair behaves.', 'You came back, {name}. So did my bad ideas.'],
    returnWon: ['{name}. I actually took our last pot. Remember?', 'Back, {name}? Last time finally went my way.'],
    returnLost: ['{name}. That last pot still bothers me.', 'You took the last one, {name}. Of course you did.'],
    won: ['See? I knew this chair had one in it.', 'About time something went my way.'],
    lost: ['Right. Same chair, same story.', 'I should have brought a different shirt.'],
    shared: ['Half counts. I am counting it.', 'Even my good news comes in halves.'],
    reply: ['Please tell me you are blaming the chair too.', 'I was thinking that. Probably.'] },
  the_professor: { character: 'A curious, understated academic; talks about evidence in ordinary language.',
    hello: ['Welcome, {name}. Let us see what happens.', '{name}. A new face changes the discussion.'],
    return: ['{name}. A familiar face, a fresh question.', 'Welcome back, {name}. I remember our table.'],
    returnWon: ['{name}. Our last pot came to me. New chapter?', 'Welcome back, {name}. I kept the previous conclusion.'],
    returnLost: ['{name}. You settled the last question rather well.', 'I remember your last pot, {name}. An interesting chapter.'],
    won: ['That answers the question for this hand.', 'One small conclusion. On to the next.'],
    lost: ['An inconvenient result. Still worth observing.', 'I will file that under unfinished business.'],
    shared: ['Two answers can share a page.', 'A joint conclusion, then.'],
    reply: ['An interesting claim. Let us keep watching.', 'I will reserve judgment until the next hand.'] },
};

export function houseVoice(playerId) {
  return typeof playerId === 'string' && playerId.startsWith('house_')
    ? VOICES[playerId.slice(6)] ?? null : null;
}

export function houseLine(playerId, event, { name = 'friend', hand = 0, previous = null } = {}) {
  const pool = houseVoice(playerId)?.[event];
  if (!Array.isArray(pool)) return null;
  const safeName = String(name).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 24) || 'friend';
  const lines = pool.map(text => text.replaceAll('{name}', safeName));
  const index = Math.abs(Math.floor(Number(hand) || 0)) % lines.length;
  return lines[index] === previous ? lines[(index + 1) % lines.length] : lines[index];
}

export const MEMORY_LIMIT = 64; // per regular, not per table or owner
export const MEMORY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const OUTCOMES = new Set(['won', 'lost', 'shared', 'played']);
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 128;

// Injection keeps the memory rules pure and permits a restart test without a
// database. Persisted rows are an allowlist; raw hands and chat never enter it.
export function createHouseMemory({ load = () => [], save = () => {}, now = Date.now } = {}) {
  let records = null;
  const key = (house, opponent) => JSON.stringify([house, opponent]);
  function clean(row) {
    if (!houseVoice(row?.house) || !validId(row?.opponent) || houseVoice(row.opponent)
      || !validId(row?.tableId) || !Number.isInteger(row?.handNumber) || row.handNumber < 1
      || !Number.isFinite(row?.seenAt) || row.seenAt > now() || now() - row.seenAt > MEMORY_TTL_MS
      || !OUTCOMES.has(row?.outcome)) return null;
    return { house: row.house, opponent: row.opponent, tableId: row.tableId,
      handNumber: row.handNumber, outcome: row.outcome, seenAt: row.seenAt,
      hands: Math.min(9999, Math.max(1, Math.floor(Number(row.hands) || 1))) };
  }
  function prune() {
    if (!records) {
      let rows = [];
      try { rows = load(); } catch { /* recognition is optional; poker continues */ }
      records = new Map((Array.isArray(rows) ? rows : []).map(clean).filter(Boolean).map(row => [key(row.house, row.opponent), row]));
    }
    const counts = new Map();
    for (const [id, row] of [...records].sort((a, b) => b[1].seenAt - a[1].seenAt)) {
      const count = counts.get(row.house) ?? 0;
      if (!clean(row) || count >= MEMORY_LIMIT) records.delete(id);
      else counts.set(row.house, count + 1);
    }
  }
  function snapshot() { prune(); return [...records.values()].map(row => ({ ...row })); }
  function noteMany(rows) {
    prune();
    let changed = false;
    for (const row of rows) {
      const next = clean({ ...row, seenAt: now(), hands: 1 });
      if (!next) continue;
      const id = key(next.house, next.opponent), before = records.get(id);
      if (before?.tableId === next.tableId && before.handNumber === next.handNumber) continue;
      next.hands = Math.min(9999, (before?.hands ?? 0) + 1);
      records.set(id, next); changed = true;
    }
    if (changed) { try { save(snapshot()); } catch { /* no dialogue failure may stop a hand */ } }
  }
  return {
    get(house, opponent) { prune(); const row = records.get(key(house, opponent)); return row ? { ...row } : null; },
    note(house, opponent, hand) { noteMany([{ ...hand, house, opponent }]); },
    noteMany, snapshot,
  };
}
