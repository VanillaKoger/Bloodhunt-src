import type { Foe } from './balance'
import type { MapId } from './maps'
import type { SkillId } from './types'

/**
 * How a fight plays, apart from the numbers in balance.ts.
 *
 * Hits never push. Each hit adds poise damage, and a full meter staggers the
 * enemy: it is stunned where it stands, takes extra damage, and a kill while
 * stunned is a Feed that heals the hero. Every enemy attack is telegraphed on
 * the ground: gold for a plain attack (a stagger cancels it), red for an
 * ability (nothing cancels it; step out). Only a few enemies swing at once;
 * the rest circle and wait their turn.
 */

/** Each enemy kind's one ability. */
export type Sig = 'lunge' | 'retch' | 'pounce' | 'lob' | 'rise' | 'charge' | 'bulwark'

export interface FoeCombat {
  /**
   * Share of max HP that must land without a breather to break poise,
   * before the weapon's poise. Lower staggers sooner.
   */
  poise: number
  /** Seconds the plain attack winds up; the gold marker fills over it. */
  windup: number
  /** Seconds after a strike before it moves again. */
  recover: number
  /** Reach of the plain attack past the enemy's own radius. */
  reach: number
  /** Half-width of the plain attack's wedge, radians. */
  half: number
  sig: Sig
  /** How hard a hit rocks it, 0–1. Heavy enemies barely flinch. */
  flinch: number
  /** Turn rate while it fights, radians a second. */
  turn: number
}

export const FOE_COMBAT: Record<Foe, FoeCombat> = {
  hound: { poise: 0.6, windup: 0.36, recover: 0.3, reach: 1.15, half: 0.7, sig: 'lunge', flinch: 1, turn: 9 },
  walker: { poise: 0.5, windup: 0.62, recover: 0.45, reach: 1.3, half: 0.75, sig: 'retch', flinch: 0.45, turn: 4.6 },
  thrall: { poise: 0.45, windup: 0.46, recover: 0.4, reach: 1.3, half: 0.7, sig: 'pounce', flinch: 0.7, turn: 8 },
  spitter: { poise: 0.5, windup: 0.42, recover: 0.3, reach: 0, half: 0, sig: 'lob', flinch: 0.8, turn: 7 },
  skeleton: { poise: 0.5, windup: 0.52, recover: 0.42, reach: 1.3, half: 0.7, sig: 'rise', flinch: 0.6, turn: 6 },
  thug: { poise: 0.45, windup: 0.56, recover: 0.42, reach: 1.35, half: 0.75, sig: 'charge', flinch: 0.45, turn: 6.5 },
  enforcer: { poise: 0.55, windup: 0.7, recover: 0.6, reach: 1.45, half: 0.85, sig: 'bulwark', flinch: 0.2, turn: 2.4 },
}

/** The bosses' plain attack and stagger. Each break makes the next one harder. */
export const BOSS_COMBAT = {
  poise: 0.13,
  /** The next break needs this much more. */
  poiseGrowth: 0.6,
  windup: 0.55,
  recover: 0.5,
  reach: 1.55,
  half: 0.9,
  flinch: 0.15,
  turn: 4,
  stun: 2.2,
}

export const SIG_LABEL: Record<Sig, string> = {
  lunge: 'Flank Lunge',
  retch: 'Bile Retch',
  pounce: 'Pounce',
  lob: 'Acid Lob',
  rise: 'Reassemble',
  charge: 'Haymaker Charge',
  bulwark: 'Bulwark',
}

export const SIG_BLURB: Record<Sig, string> = {
  lunge: 'Circles to your flank, then leaps along a red lane.',
  retch: 'Spews a red cone of bile that leaves a burning pool.',
  pounce: 'Leaps onto a red ring from range, then stands winded.',
  lob: 'Arcs a glob of acid at where you are heading.',
  rise: 'Falls into a bone pile and stands again unless you strike the pile.',
  charge: 'Lowers his head and charges down a red lane, then stands dazed.',
  bulwark: 'Blocks most of what hits his front. Strike his sides, or after he swings.',
}

/** Ability tuning. Damage is a multiple of the enemy's own hit. */
export const SIG = {
  lunge: { cd: 5.5, windup: 0.62, min: 1.8, max: 5.2, len: 4.4, width: 1.1, time: 0.26, dmg: 1.4 },
  retch: { cd: 7, windup: 0.85, range: 3.1, half: 0.62, dmg: 1.2, pool: { r: 1.05, time: 2.6, tick: 0.5, dmg: 0.32 } },
  pounce: { cd: 6.5, windup: 0.66, min: 2.8, max: 6.6, r: 1.35, air: 0.42, dmg: 1.45, winded: 1.1 },
  lob: { cd: 6.5, windup: 0.95, r: 1.35, lead: 0.85, dmg: 1.5, pool: { r: 1.15, time: 3, tick: 0.5, dmg: 0.28 } },
  rise: { pile: 3.2, hp: 0.5 },
  charge: { cd: 7.5, windup: 0.78, min: 2.8, max: 7.5, len: 7.2, width: 1.3, speed: 10.5, dmg: 1.6, dazed: 1.2 },
  bulwark: { front: 0.45, cut: 0.75 },
} as const

/** Seconds between any two red abilities starting, so the screen stays readable. Deeper tiers crowd them closer. */
export function sigGap(tier: number): number {
  return 1.8 - Math.min(1, tier / 29) * 0.9
}

/** Red abilities winding up at once. */
export function sigSlots(tier: number): number {
  return tier >= 15 ? 2 : 1
}

/**
 * Enemies allowed to close in and swing at once; the rest circle. Two on
 * every tier: deeper zones press harder through more and faster abilities
 * (sigSlots, sigGap), which a hunter can step out of, not more swingers.
 */
export const ATTACK_TOKENS = 2

/** Waiting enemies circle at this distance from the hero. */
export const ORBIT = { r: 2.9, spread: 0.55, speed: 0.55 }

export const STAGGER = {
  /** Seconds a broken enemy is stunned. */
  stun: 1.35,
  /** Damage taken while stunned. */
  exposed: 1.35,
  /** A kill while stunned heals this share of max HP. */
  feedHeal: 0.06,
  /** And adds this many extra Frenzy stacks. */
  feedFrenzy: 1,
  /** Poise starts coming back after this many quiet seconds, at `regen` of the meter a second. */
  quiet: 1.6,
  regen: 0.35,
  /** Dazed or winded enemies take this much more poise damage. */
  dazed: 2,
}

/** Weapon poise sits on the weapon (weapons.ts); skills carry their own. */
export const SKILL_POISE: Record<SkillId, number> = { bats: 0.35, drain: 1, dash: 1.2, nova: 1.6 }

/** The hero's side of the clock. */
export const HERO_GUARD = {
  /** Untouchable this long after a hit lands. */
  iframe: 0.3,
  /** Natural regen waits this long after the last hit taken. */
  regenDelay: 3.5,
}

// ------------------------------------------------------------------ Elites

export type Affix = 'frenzied' | 'ironhide' | 'volatile' | 'vampiric' | 'warded' | 'shadowed' | 'packleader'

export interface AffixDef {
  label: string
  blurb: string
  color: number
  /** First tier it can roll on. */
  from: number
}

export const AFFIXES: Record<Affix, AffixDef> = {
  frenzied: { label: 'Frenzied', blurb: 'Moves and swings faster.', color: 0xff7a2a, from: 0 },
  ironhide: { label: 'Ironhide', blurb: 'Hard to stagger, and shrugs off some damage.', color: 0x9aa8b8, from: 0 },
  volatile: { label: 'Volatile', blurb: 'Bursts in a red ring when it dies.', color: 0xff3a1a, from: 2 },
  vampiric: { label: 'Vampiric', blurb: 'Heals from every hit it lands.', color: 0xc0103a, from: 4 },
  warded: { label: 'Warded', blurb: 'A ward soaks damage and keeps it from staggering until it breaks.', color: 0x6ad8ff, from: 7 },
  shadowed: { label: 'Shadowed', blurb: 'Blinks behind you.', color: 0x8a4aff, from: 10 },
  packleader: { label: 'Packleader', blurb: 'Allies nearby hit harder and move faster.', color: 0xffd04a, from: 13 },
}

export const AFFIX_IDS = Object.keys(AFFIXES) as Affix[]

export const AFFIX = {
  frenzied: { speed: 1.35, cd: 0.7 },
  ironhide: { poise: 2.2, cut: 0.15 },
  volatile: { windup: 1, r: 2.1, dmg: 2 },
  vampiric: { heal: 1.5 },
  warded: { share: 0.35 },
  shadowed: { cd: 6.5, windup: 0.45 },
  packleader: { r: 6, dmg: 1.25, speed: 1.15 },
}

/** Modifiers an elite carries: one early, two from tier 10. */
export function affixCount(tier: number): number {
  return tier >= 10 ? 2 : 1
}

export function rollAffixes(tier: number, rand: () => number = Math.random): Affix[] {
  const pool = AFFIX_IDS.filter((a) => AFFIXES[a].from <= tier)
  const out: Affix[] = []
  const n = Math.min(pool.length, affixCount(tier))
  while (out.length < n) {
    const pick = pool[Math.floor(rand() * pool.length)]
    if (!out.includes(pick)) out.push(pick)
  }
  return out
}

// ------------------------------------------------------------------ Bosses

/** Each map's boss adds one move of its own once the fight turns. */
export type BossSig = 'lunge' | 'charge' | 'lob' | 'fan' | 'pounce' | 'graves' | 'blink' | 'beams' | 'slam' | 'nova'

export const BOSS_SIG: Record<MapId, BossSig> = {
  slums: 'lunge',
  mob: 'charge',
  docks: 'lob',
  market: 'fan',
  wilds: 'pounce',
  graves: 'graves',
  manor: 'blink',
  cathedral: 'beams',
  catacombs: 'slam',
  spire: 'nova',
}

export const BOSS_SIG_LABEL: Record<BossSig, string> = {
  lunge: 'leaps for your flank',
  charge: 'charges down a lane',
  lob: 'hurls anchors where you are heading',
  fan: 'throws a fan of knives',
  pounce: 'pounces from range',
  graves: 'opens the graves around you',
  blink: 'steps out of the shadow behind you',
  beams: 'calls the dawn down in bars of light',
  slam: 'slams a long lane of bone',
  nova: 'bursts with blood all around',
}

export const BOSS_PHASE = {
  /** The boss calls help and gains its own move here. */
  turn: 0.6,
  /** Enraged here: faster, and the pound comes three times. */
  rage: 0.3,
  rageSpeed: 1.2,
  rageCd: 0.72,
  /** Seconds between the boss's own move. */
  sigCd: 6.5,
  pound: { cd: 4.6, windup: 0.75, r: 2.25 },
}

export const BOSS_SIGS = {
  lunge: { windup: 0.7, len: 6, width: 1.4, time: 0.3, dmg: 1.5 },
  charge: { windup: 0.85, len: 9, width: 1.6, speed: 11, dmg: 1.7 },
  lob: { windup: 1, n: 3, r: 1.4, lead: 0.9, spread: 2.2, dmg: 1.4 },
  fan: { windup: 0.8, n: 5, spread: 0.32, len: 9, width: 0.7, speed: 9, dmg: 0.9 },
  pounce: { windup: 0.8, r: 1.8, air: 0.5, dmg: 1.8 },
  graves: { windup: 1.05, n: 5, r: 1.2, ring: 2.4, dmg: 1.4 },
  blink: { windup: 0.6, back: 1.6, r: 1.6, dmg: 1.6 },
  beams: { windup: 1.15, n: 3, len: 16, width: 1.5, gap: 3.2, dmg: 1.5 },
  slam: { windup: 0.95, len: 10, width: 2, dmg: 1.9 },
  nova: { windup: 1.2, r: 4.6, dmg: 1.6 },
} as const
