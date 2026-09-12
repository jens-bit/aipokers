// FIRST-CHAT-1: remove recognizable performed actions, not ordinary emphasis
// or parenthetical explanations. No invented speech and no second model call.
const ACTION = /^(?:(?:he|she|they|the agent)\s+)?(?:leans?|leaning|stands?|standing|nods?|nodding|shrugs?|shrugging|sighs?|sighing|smiles?|smiling|grins?|grinning|laughs?|laughing|chuckles?|chuckling|(?:looks?|looking)\s+(?:away|down|up|around|at|toward|back|over)|glances?|glancing|stares?|staring|waves?|waving|sits?|sitting|paces?|pacing|walks?|walking|(?:turns?|turning)\s+(?:away|around|toward|back|to)|folds? (?:his|her|their) arms|crosses? (?:his|her|their) arms|takes? a breath|clears? (?:his|her|their) throat)\b/i;

export function spokenOwnerReply(value) {
  if (typeof value !== 'string') return '';
  const speech = value.replace(/(\*{1,2}|_{1,2})([^*_\n]+)\1|\[([^\]\n]+)\]|\(([^)\n]+)\)/g,
    (whole, marker, emphasis, bracket, parenthesis) => ACTION.test((emphasis ?? bracket ?? parenthesis).trim()) ? ' ' : whole)
    .replace(/\s+/g, ' ').trim();
  return /[\p{L}\p{N}]/u.test(speech) ? speech : '';
}
