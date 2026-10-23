import type { ClawTierId, Material } from './balance'
import type { SkillId } from './types'
import { HERO_START, MOB_ARRIVE, MOB_Z } from './world'

/**
 * The hunt loop. The hero waits at the Haven, picks a district and a
 * danger, and hunts until extracting or until dawn. Everything picked up
 * is carried, and only reaches the Haven by extracting. Three currencies,
 * each upgrading one side of the hero:
 *
 * - Blood, from every kill: gear levels (weapon, cape, coat, boots).
 * - Ichor, from elites and bosses: weapon tiers.
 * - Vitae, from extracting and from bosses: blood powers and Haven rites.
 *
 * And three materials, dropped by enemy families and carried the same way,
 * for the Haven's works and wardrobe: Bone, Bile, and Brass.
 */

export type DistrictId = 'slums' | 'mob'

export const DISTRICT_IDS: DistrictId[] = ['slums', 'mob']

export type Currency = 'blood' | 'ichor' | 'vitae' | Material

export const CURRENCIES: Currency[] = ['blood', 'ichor', 'vitae', 'bone', 'bile', 'brass']

export type Purse = Record<Currency, number>

export function emptyPurse(): Purse {
  return { blood: 0, ichor: 0, vitae: 0, bone: 0, bile: 0, brass: 0 }
}

/** The banked side of every currency, read off the save. */
export function bankedPurse(save: Purse): Purse {
  const out = emptyPurse()
  for (const k of CURRENCIES) out[k] = save[k]
  return out
}

export interface ExtractPoint {
  x: number
  z: number
  label: string
}

export interface DistrictDef {
  id: DistrictId
  label: string
  blurb: string
  /** Where the night starts. */
  start: { x: number; z: number }
  /** Stand in one of these until the channel fills to leave with the haul. */
  extracts: ExtractPoint[]
  /** Danger steps added on top of the chosen danger. */
  steps: number
  /** Blood multiplier on top of the chosen danger. */
  reward: number
  /** Enemy damage and HP multipliers on top of the chosen danger. */
  bite: number
  tough: number
  /** Shown on a locked card. */
  lockText: string
}

export const DISTRICTS: Record<DistrictId, DistrictDef> = {
  slums: {
    id: 'slums',
    label: 'The Slums',
    blurb: 'Three courts and the alleys between. Plague hounds, walkers, thralls, thugs, the odd skeleton, and the Rat King in the chapel yard.',
    start: HERO_START,
    extracts: [
      { x: -28.5, z: -51.4, label: 'Sewer grate' },
      { x: -44.6, z: 17.8, label: 'Chapel door' },
    ],
    steps: 0,
    reward: 1,
    bite: 1,
    tough: 1,
    lockText: '',
  },
  mob: {
    id: 'mob',
    label: 'The Mob District',
    blurb: 'One lit square, no alleys to hide in. Thugs, enforcers, and the Don. Its first danger is as hard as the Slums at III, and it pays more.',
    // The night starts inside the club gate, with the square ahead, and leaves by the far curb.
    start: MOB_ARRIVE,
    extracts: [{ x: -0.3, z: MOB_Z - 5.9, label: 'Back alley' }],
    steps: 22,
    reward: 1.35,
    bite: 1.4,
    tough: 1.25,
    lockText: 'Clear the marks of Slums Danger III and slay the Rat King five times.',
  },
}

export interface DangerDef {
  label: string
  /** Enemy growth steps at the first second of the night. */
  steps: number
  /** Blood multiplier on every kill. */
  reward: number
  /** Chance an enemy spawns as an elite. */
  elite: number
  /** Vitae for a clean extraction. */
  vitae: number
  /** Multiplier on the materials enemies drop. */
  mats: number
  /** Enemy damage multiplier on top of the steps: the deeper the danger, the harder each hit. */
  bite: number
  /** Enemy HP multiplier on top of the steps. */
  tough: number
}

export const DANGERS: DangerDef[] = [
  { label: 'I', steps: 0, reward: 1, elite: 0.05, vitae: 1, mats: 1, bite: 1, tough: 1 },
  { label: 'II', steps: 10, reward: 1.3, elite: 0.06, vitae: 2, mats: 1.3, bite: 1.35, tough: 1.2 },
  { label: 'III', steps: 24, reward: 1.7, elite: 0.07, vitae: 3, mats: 1.6, bite: 1.9, tough: 1.5 },
  { label: 'IV', steps: 42, reward: 2.2, elite: 0.08, vitae: 4, mats: 2, bite: 2.7, tough: 1.9 },
  { label: 'V', steps: 64, reward: 2.8, elite: 0.09, vitae: 6, mats: 2.5, bite: 3.8, tough: 2.4 },
]

/** Seconds from dusk to dawn before rites. */
export const NIGHT_SECONDS = 300
/** The timer turns and the dawn warning sounds this long before dawn. */
export const DAWN_WARN = 60
/** Enemy growth steps added per minute the night runs. */
export const STEPS_PER_MINUTE = 0.9
/** Share of max HP the sun burns per second once dawn breaks. */
export const SUNBURN = 0.07
/** Seconds standing at an extract point to leave. */
export const EXTRACT_CHANNEL = 2.5
export const EXTRACT_RADIUS = 1.5
/** Share of the carried haul kept when the night is lost, before rites. */
export const KEEP_ON_LOSS = 0.25

/** Kills inside this window build Frenzy; outside it, stacks drain. */
export const FRENZY_WINDOW = 4
export const FRENZY_DRAIN = 2
export const FRENZY_STACKS = 10
/** Blood multiplier per Frenzy stack. */
export const FRENZY_STEP = 0.05

export const ELITE = { hp: 2.4, dmg: 1.3, scale: 1.22, blood: 3, xp: 2.5 }

/** Ichor an elite drops at a danger index (0-based). */
export function eliteIchor(danger: number): number {
  return 1 + Math.floor(danger / 2)
}

export function bossLoot(kind: 'boss' | 'don', danger: number): { ichor: number; vitae: number } {
  return kind === 'don' ? { ichor: 5 + danger * 3, vitae: 2 + danger } : { ichor: 3 + danger * 2, vitae: 1 + danger }
}

/** Ichor to ascend the weapon into a tier. Each tier also needs the weapon level it starts at. */
export const TIER_ICHOR: Record<ClawTierId, number> = {
  teethling: 0,
  kindred: 60,
  awakened: 240,
  ascendent: 640,
  immortal: 1500,
}

/** Blood powers: Vitae ranks on each skill. Each rank is a small step; the last ones cost the most. */
export const POWER_MAX = 10
export const POWER_DMG = 0.05
export const POWER_CD = 0.02

export function powerCost(rank: number): number {
  return Math.round(6 + rank * 6 + rank * rank * 1.8)
}

export type RiteId = 'night' | 'pact' | 'frenzy' | 'scent' | 'thrall'

export const RITE_IDS: RiteId[] = ['night', 'pact', 'frenzy', 'scent', 'thrall']

export interface RiteDef {
  id: RiteId
  label: string
  /** Effect text for a rank. */
  effect: (rank: number) => string
  costs: number[]
}

/** A rite's cost ladder: `ranks` steps from `base`, each a good deal dearer than the last. */
function ladder(base: number, ranks: number): number[] {
  return Array.from({ length: ranks }, (_, r) => Math.round(base * Math.pow(1 + r, 1.55)))
}

/** Haven rites: permanent Vitae upgrades to the hunt itself. */
export const RITES: Record<RiteId, RiteDef> = {
  night: { id: 'night', label: 'Long Night', effect: (r) => `+${r * RITE_STEP.night}s before dawn`, costs: ladder(11, 6) },
  pact: { id: 'pact', label: 'Blood Pact', effect: (r) => `Keep ${Math.round(keepShare(r) * 100)}% of the haul if the night is lost`, costs: ladder(11, 6) },
  frenzy: { id: 'frenzy', label: 'Frenzy', effect: (r) => `Frenzy up to ×${(1 + frenzyCap(r) * FRENZY_STEP).toFixed(2)} Blood`, costs: ladder(14, 5) },
  scent: { id: 'scent', label: 'Ichor Scent', effect: (r) => `+${(r * RITE_STEP.scent * 100).toFixed(1)}% elite chance`, costs: ladder(11, 6) },
  thrall: { id: 'thrall', label: 'Thrall Master', effect: (r) => `Thralls hunt ${100 + r * RITE_STEP.thrall * 100}% while you are away`, costs: ladder(9, 5) },
}

/** What one rank of each rite is worth. */
export const RITE_STEP = { night: 15, pact: 0.05, frenzy: 2, scent: 0.005, thrall: 0.2 }

export function keepShare(pactRank: number): number {
  return KEEP_ON_LOSS + pactRank * RITE_STEP.pact
}

export function nightLength(nightRank: number): number {
  return NIGHT_SECONDS + nightRank * RITE_STEP.night
}

export function frenzyCap(frenzyRank: number): number {
  return FRENZY_STACKS + frenzyRank * RITE_STEP.frenzy
}

export function eliteChance(danger: number, scentRank: number): number {
  return DANGERS[danger].elite + scentRank * RITE_STEP.scent
}

/** Materials an enemy drops at a danger, rounded by chance so small amounts still grow. */
export function matDrop(amount: number, danger: number, roll = Math.random()): number {
  const v = amount * DANGERS[danger].mats
  return Math.floor(v) + (roll < v - Math.floor(v) ? 1 : 0)
}

export function nightSteps(district: DistrictId, danger: number, elapsed: number): number {
  return DISTRICTS[district].steps + DANGERS[danger].steps + (elapsed / 60) * STEPS_PER_MINUTE
}

/** Enemy damage multiplier for a night, from its district and danger. */
export function nightBite(district: DistrictId, danger: number): number {
  return DISTRICTS[district].bite * DANGERS[danger].bite
}

/** Enemy HP multiplier for a night, from its district and danger. */
export function nightTough(district: DistrictId, danger: number): number {
  return DISTRICTS[district].tough * DANGERS[danger].tough
}

export function nightReward(district: DistrictId, danger: number): number {
  return DISTRICTS[district].reward * DANGERS[danger].reward
}

/** Skill damage and cooldown scales from a power rank. */
export function powerScale(rank: number): { dmg: number; cd: number } {
  return { dmg: 1 + rank * POWER_DMG, cd: 1 - rank * POWER_CD }
}

export const SKILL_POWER_LABEL: Record<SkillId, string> = {
  bats: 'Bat Swarm',
  drain: 'Blood Drain',
  dash: 'Shadow Dash',
  nova: 'Crimson Nova',
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
