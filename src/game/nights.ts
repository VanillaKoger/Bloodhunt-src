import type { ClawTierId } from './balance'
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
 */

export type DistrictId = 'slums' | 'mob'

export const DISTRICT_IDS: DistrictId[] = ['slums', 'mob']

export type Currency = 'blood' | 'ichor' | 'vitae'

export type Purse = Record<Currency, number>

export function emptyPurse(): Purse {
  return { blood: 0, ichor: 0, vitae: 0 }
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
  /** Shown on a locked card. */
  lockText: string
}

export const DISTRICTS: Record<DistrictId, DistrictDef> = {
  slums: {
    id: 'slums',
    label: 'The Slums',
    blurb: 'Three courts and the alleys between. Rats, ghouls, wolves, witches, and the Rat King under the crypt.',
    start: HERO_START,
    extracts: [
      { x: -28.5, z: -51.4, label: 'Sewer grate' },
      { x: -44.6, z: 17.8, label: 'Chapel door' },
    ],
    steps: 0,
    reward: 1,
    lockText: '',
  },
  mob: {
    id: 'mob',
    label: 'The Mob District',
    blurb: 'One lit square, no alleys to hide in. Thugs, enforcers, and the Don. Pays more.',
    // The night starts inside the club gate, with the square ahead, and leaves by the far curb.
    start: MOB_ARRIVE,
    extracts: [{ x: -0.3, z: MOB_Z - 5.9, label: 'Back alley' }],
    steps: 3,
    reward: 1.25,
    lockText: 'Slay the Rat King to learn the way.',
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
}

export const DANGERS: DangerDef[] = [
  { label: 'I', steps: 0, reward: 1, elite: 0.06, vitae: 1 },
  { label: 'II', steps: 4, reward: 1.35, elite: 0.09, vitae: 2 },
  { label: 'III', steps: 9, reward: 1.8, elite: 0.12, vitae: 3 },
  { label: 'IV', steps: 15, reward: 2.4, elite: 0.15, vitae: 5 },
  { label: 'V', steps: 22, reward: 3.2, elite: 0.18, vitae: 8 },
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
export const FRENZY_STEP = 0.1

export const ELITE = { hp: 2.4, dmg: 1.3, scale: 1.22, blood: 3, xp: 2.5 }

/** Ichor an elite drops at a danger index (0-based). */
export function eliteIchor(danger: number): number {
  return 1 + Math.floor(danger / 2)
}

export function bossLoot(kind: 'boss' | 'don', danger: number): { ichor: number; vitae: number } {
  return kind === 'don' ? { ichor: 6 + danger * 3, vitae: 3 + danger } : { ichor: 4 + danger * 2, vitae: 2 + danger }
}

/** Ichor to ascend the weapon into a tier. Each tier also needs the weapon level it starts at. */
export const TIER_ICHOR: Record<ClawTierId, number> = {
  teethling: 0,
  kindred: 6,
  awakened: 18,
  ascendent: 45,
  immortal: 110,
}

/** Blood powers: Vitae ranks on each skill. */
export const POWER_MAX = 6
export const POWER_DMG = 0.15
export const POWER_CD = 0.05

export function powerCost(rank: number): number {
  return 2 + rank * 2
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

/** Haven rites: permanent Vitae upgrades to the hunt itself. */
export const RITES: Record<RiteId, RiteDef> = {
  night: { id: 'night', label: 'Long Night', effect: (r) => `+${r * 30}s before dawn`, costs: [3, 6, 10, 15] },
  pact: { id: 'pact', label: 'Blood Pact', effect: (r) => `Keep ${Math.round(keepShare(r) * 100)}% of the haul if the night is lost`, costs: [3, 6, 10, 15] },
  frenzy: { id: 'frenzy', label: 'Frenzy', effect: (r) => `Frenzy up to ×${(1 + (FRENZY_STACKS + r * 5) * FRENZY_STEP).toFixed(1)} Blood`, costs: [4, 9, 16] },
  scent: { id: 'scent', label: 'Ichor Scent', effect: (r) => `+${r * 3}% elite chance`, costs: [3, 6, 10, 15] },
  thrall: { id: 'thrall', label: 'Thrall Master', effect: (r) => `Thralls hunt ${100 + r * 25}% while you are away`, costs: [2, 5, 9, 14] },
}

export function keepShare(pactRank: number): number {
  return KEEP_ON_LOSS + pactRank * 0.1
}

export function nightLength(nightRank: number): number {
  return NIGHT_SECONDS + nightRank * 30
}

export function frenzyCap(frenzyRank: number): number {
  return FRENZY_STACKS + frenzyRank * 5
}

export function eliteChance(danger: number, scentRank: number): number {
  return DANGERS[danger].elite + scentRank * 0.03
}

export function nightSteps(district: DistrictId, danger: number, elapsed: number): number {
  return DISTRICTS[district].steps + DANGERS[danger].steps + (elapsed / 60) * STEPS_PER_MINUTE
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
