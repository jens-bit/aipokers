// Only a server-confirmed needs refusal can offer this recovery path.
export function recoveryHint(refusal) {
  if (refusal?.error !== 'agentSpent') return null;
  if (refusal.kind === 'food') return refusal.needs === 'stock'
    ? 'Buy snacks from the fridge at Home. He will eat while you watch the room.'
    : 'Return Home and watch the room. He will fetch the stocked snacks he needs.';
  return 'Return Home to let him rest. You can deploy again when he has recovered.';
}
