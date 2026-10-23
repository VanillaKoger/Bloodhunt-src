/**
 * One knob for the length of the climb. Every cost that paces progression
 * (XP, gear Blood, tier Ichor, weapon-rank kills, power and rite Vitae, work
 * materials, feeding) is multiplied by it, so the whole climb stretches or
 * shrinks together. Tune it with `npm run pacing`: the target is peak at
 * eight to ten months of one 30-minute sitting a day.
 */
export const PACE = 1.45
