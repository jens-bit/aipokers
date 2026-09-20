// Removable clothes are separate from the permanent birth identity. The
// starter rack is free for every existing and new companion; no stat effects.
export const WARDROBE_SLOTS = Object.freeze(['head', 'face', 'neck']);
export const STARTER_ITEMS = Object.freeze([
  Object.freeze({ id: 'rail-cap', slot: 'head', name: 'Rail cap' }),
  Object.freeze({ id: 'round-glasses', slot: 'face', name: 'Round glasses' }),
  Object.freeze({ id: 'knit-scarf', slot: 'neck', name: 'Knit scarf' }),
]);
export function equipmentOf(agent) {
  const source = agent?.equipment ?? agent?.wardrobe?.equipped;
  return Object.fromEntries(WARDROBE_SLOTS.map(slot => [slot,
    STARTER_ITEMS.some(item => item.slot === slot && item.id === source?.[slot]) ? source[slot] : null]));
}
export function wardrobeOf(agent) {
  return { owned: STARTER_ITEMS.map(item => item.id), equipped: equipmentOf(agent) };
}
export function validEquipment(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === WARDROBE_SLOTS.length
    && WARDROBE_SLOTS.every(slot => Object.hasOwn(value, slot) && (value[slot] === null
      || STARTER_ITEMS.some(item => item.slot === slot && item.id === value[slot])));
}
export const sameEquipment = (a, b) => WARDROBE_SLOTS.every(slot => a?.[slot] === b?.[slot]);
