// TALK-1: only the owner's direct request can select an action. Generated
// language never becomes an executable command, identity or action argument.
export const COMMAND_TTL_MS = 5 * 60_000;
export const OWNER_MESSAGE_MAX = 2000;
const clean = text => String(text ?? '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

export function commandQuestion(step, { now = Date.now(), stakes = [], rung, amount } = {}) {
  const pending = { step, expiresAt: now + COMMAND_TTL_MS,
    ...(Number.isInteger(rung) ? { rung } : {}), ...(Number.isSafeInteger(amount) && amount >= 0 ? { amount } : {}) };
  const message = step === 'stakes' ? `Which stakes: ${stakes.map(s => s.label).join(', ')}?`
    : step === 'fundDeploy' ? `Move $${Number(amount).toLocaleString('en-US')} from your safe and seat me at ${stakes.find(s => s.rung === rung)?.label ?? 'those stakes'}?`
      : step === 'resumeDeploy' ? `Resume casino play at ${stakes.find(s => s.rung === rung)?.label ?? 'those stakes'} with no automatic refill${amount > 0 ? ` and move $${Number(amount).toLocaleString('en-US')} from your safe` : ''}?`
        : 'How many chips should I take from your safe?';
  return { kind: 'clarify', message, pending };
}

function stakeChoice(text, stakes) {
  const t = text.replace(/\$/g, '').replace(/^(?:the |at |stakes |play )+/g, '').replace(/ stakes$/, '').trim();
  const pair = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (pair) return stakes.find(s => s.smallBlind === Number(pair[1]) && s.bigBlind === Number(pair[2]))?.rung ?? null;
  const index = /^(?:low|lowest|small|smallest|floor|low room)$/.test(t) ? 0
    : /^(?:medium|middle|upstairs)$/.test(t) ? 1 : /^(?:high|highest|back ?room|back room)$/.test(t) ? stakes.length - 1 : null;
  return index == null ? null : stakes[index]?.rung ?? null;
}

export function ownerCommand(content, { pending = null, stakes = [], now = Date.now(), agentName = '' } = {}) {
  let text = clean(content).toLowerCase();
  if (!text || text.length > OWNER_MESSAGE_MAX || /["“”]/.test(text)) return null;
  if (agentName && text.startsWith(`${clean(agentName).toLowerCase()}, `)) text = text.slice(clean(agentName).length + 2);
  text = text.replace(/[.!?]+$/, '').replace(/^(?:please |(?:can|could|would) you |i want you to )+/, '').replace(/ please$/, '');
  const waiting = pending?.expiresAt > now && ['stakes', 'fundDeploy', 'resumeDeploy', 'fundAmount'].includes(pending.step) ? pending : null;
  if (waiting && /^(?:cancel|never mind|nevermind|no|no thanks|stop)$/.test(text)) return { kind: 'cancel' };
  if (/\b(?:don't|do not|never|not now|tomorrow|later|if|should|might|maybe)\b/.test(text)) return null;

  if (waiting) {
    const rung = stakeChoice(text, stakes);
    if (rung != null && waiting.step !== 'fundAmount') return { kind: 'deploy', rung };
    if (/^(?:yes|yes please|okay|ok|do it|fund it|go ahead)$/.test(text)) {
      if (waiting.step === 'fundDeploy' && stakes.some(s => s.rung === waiting.rung)
        && Number.isSafeInteger(waiting.amount) && waiting.amount > 0) {
        return { kind: 'fundDeploy', rung: waiting.rung, amount: waiting.amount };
      }
      if (waiting.step === 'resumeDeploy' && stakes.some(s => s.rung === waiting.rung)
        && Number.isSafeInteger(waiting.amount) && waiting.amount >= 0) {
        return { kind: 'resumeDeploy', rung: waiting.rung, amount: waiting.amount };
      }
      return commandQuestion(waiting.step, { now, stakes, ...waiting });
    }
    if (waiting.step === 'fundAmount' && /^\$?[\d,]+(?: chips)?$/.test(text)) {
      const amount = Number(text.replace(/[$,]| chips/g, ''));
      if (Number.isSafeInteger(amount) && amount > 0) return { kind: 'fund', amount };
    }
  }

  if (/^(?:(?:go|come|head|return)(?: back)? home|call me in|stop playing|leave (?:the )?(?:casino|table))$/.test(text)) return { kind: 'home' };
  if (/^(?:rest|go (?:rest|to sleep|to bed)|take a (?:nap|break)|get some sleep|sit (?:one )?out)$/.test(text)) return { kind: 'rest' };
  if (/^(?:eat|have|take|grab|get)(?: (?:a|some))? (?:snack|food)$|^(?:eat|feed me)$/.test(text)) return { kind: 'feed', item: 'snack' };
  if (/^(?:drink|have|take|grab|get)(?: a)? beer$|^drink$/.test(text)) return { kind: 'feed', item: 'beer' };
  const study = text.match(/^(?:study|watch (?:the |my )?tape|review (?:my |the |latest )?hand)(?: (?:hand )?#?(\d+))?$/);
  if (study) return { kind: 'study', handId: study[1] ? Number(study[1]) : null };
  const fund = text.match(/^(?:give me|fund me(?: with)?|take) \$?([\d,]+)(?: chips)?(?: from (?:the |your )?safe)?$/);
  if (fund) {
    const amount = Number(fund[1].replace(/,/g, ''));
    return Number.isSafeInteger(amount) && amount > 0 ? { kind: 'fund', amount } : commandQuestion('fundAmount', { now });
  }
  if (/^(?:fund me|give me (?:some )?chips)$/.test(text)) return commandQuestion('fundAmount', { now });
  const casino = text.match(/^(?:(?:go|head|walk)(?: back)? to (?:the )?casino)(?: (?:at|for|on|and play|to play) (.+))?$/)
    ?? text.match(/^(?:go play|play|deploy(?: me)?|deal me in|sit me down)(?: (?:at|for|on|in))?(?: (.+))?$/);
  if (casino) {
    const rung = stakeChoice(casino[1] ?? '', stakes);
    return rung == null ? commandQuestion('stakes', { now, stakes }) : { kind: 'deploy', rung };
  }
  return null;
}

export function conversationMessages(history, content) {
  const messages = (Array.isArray(history) ? history : [])
    .filter(m => ['user', 'assistant'].includes(m?.role) && typeof m.content === 'string' && m.content.trim())
    .slice(-6).map(m => ({ role: m.role, content: m.content.slice(0, OWNER_MESSAGE_MAX) }));
  while (messages[0]?.role === 'assistant') messages.shift();
  return [...messages, { role: 'user', content: String(content).slice(0, OWNER_MESSAGE_MAX) }];
}

// A model answer has no action receipt. Reject executable-looking output and
// first-person claims of game-control side effects instead of displaying a lie.
export function unearnedActionReply(reply) {
  if (typeof reply !== 'string') return false;
  return /"(?:action|tool_calls|ownerId|userId)"\s*:/.test(reply)
    || /\b(?:i(?:'ve| have)?(?: just)?|i am|i'm)\s+(?:deployed|seated(?: you| at)?|bought|purchased|transferred|funded|called you in|started studying|(?:went|headed|walked) (?:back )?to the casino|(?:came|went|returned) (?:back )?home|(?:took|moved|sent) \$?[\d,]+ (?:chips )?(?:from|to)|(?:am |'m )?heading (?:back )?to the casino)\b/i.test(reply);
}
