// src/agent/promptFields.js — COST-2 job 2
//
// The substance of buildUserPrompt, pulled back out of it.
//
// Trimming the prompt is supposed to remove PROSE, never a FACT the model
// conditions on. The only way to prove that without a model in the loop is to
// parse the rendered text back into the same fields buildUserPrompt wrote from
// and diff those — not the string, which is expected to shrink, but the
// values, which are not allowed to.
//
// One rule keeps this honest: every regex here matches a LABEL, never a whole
// sentence, so a trim that shortens the prose around a label still parses
// identically and a trim that touches the label itself (or drops it) shows up
// as a real, visible diff rather than being silently tolerated.

const LINE_PATTERNS = [
  ['street', /^STREET: (.+)$/],
  ['holeCards', /^HOLE CARDS: (.+)$/],
  ['board', /^BOARD: (.+)$/],
  ['myContrib', /^MY CONTRIB THIS STREET: (.+)$/],
  ['equity', /^EQUITY: (.+)$/],
  ['potOdds', /^POT ODDS: (.+)$/],
  ['spr', /^SPR: (.+)$/],
  ['range', /^RANGE: (.+)$/],
  ['bluffDie', /^BLUFF DIE: (.+)$/],
  ['sizing', /^SIZING: (.+)$/],
  ['raisesThisStreet', /^RAISES THIS STREET: (.+)$/],
  ['minRaise', /^MIN RAISE: (.+)$/],
  ['state', /^STATE: (.+)$/],
  ['tableTalk', /^TABLE TALK: (.+)$/],
  ['legalActions', /^LEGAL ACTIONS: (.+)$/],
];

const POT_LINE = /^POT: (\S+)\s+MY STACK: (\S+)\s+OPP STACK: (\S+)$/;
const POSITION_LINE = /^POSITION: (\S+)\s+BLINDS: (\S+)$/;
const READ_LINE = /^(OPPONENT READ \(|EXPLOIT: )/;

/**
 * Every substantive field buildUserPrompt wrote into the briefing, keyed by
 * name. Two prompts that render this to the same object agree on every fact
 * the model was given, whatever the prose between the lines looks like.
 */
export function extractPromptFields(prompt) {
  const fields = {};
  const exploitLines = [];
  for (const rawLine of String(prompt ?? '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const pot = POT_LINE.exec(line);
    if (pot) { fields.pot = pot[1]; fields.myStack = pot[2]; fields.oppStack = pot[3]; continue; }

    const pos = POSITION_LINE.exec(line);
    if (pos) { fields.position = pos[1]; fields.blinds = pos[2]; continue; }

    if (READ_LINE.test(line)) { exploitLines.push(line); continue; }

    let matched = false;
    for (const [key, re] of LINE_PATTERNS) {
      const m = re.exec(line);
      if (m) { fields[key] = m[1]; matched = true; break; }
    }
    void matched;
  }
  if (exploitLines.length > 0) fields.reads = exploitLines;
  return fields;
}
