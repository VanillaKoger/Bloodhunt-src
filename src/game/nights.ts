import type { ClawTierId, Material } from './balance'
import { PACE } from './pace'
import type { SkillId } from './types'
import { MAPS, MAP_IDS, ZONE_COUNT, mapIndex, type ExtractPoint, type MapId } from './maps'

/**
 * The hunt loop. The hero waits at the Haven, picks a map and one of its
 * zones, and hunts until extracting or until dawn. Everything picked up
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

export type DistrictId = MapId

export const DISTRICT_IDS: DistrictId[] = MAP_IDS

export type { ExtractPoint }

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

/**
 * One rung of the ladder: a zone of a map. Ten maps of three zones make 30
 * tiers, from the Slums' Court (tier 0) to the Elder's Throne (tier 29).
 */
export interface TierDef {
  index: number
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
  /** Enemy damage multiplier on top of the steps: the deeper the tier, the harder each hit. */
  bite: number
  /** Enemy HP multiplier on top of the steps. */
  tough: number
}

export const TIER_COUNT = MAP_IDS.length * ZONE_COUNT

/** The last tier's numbers. Each curve climbs to these from 1. */
export const TIER_TOP = { steps: 92, bite: 6, tough: 3.3, reward: 3.8, elite: 0.09, mats: 2.8 }

function makeTier(index: number): TierDef {
  const u = index / (TIER_COUNT - 1)
  return {
    index,
    steps: Math.round(TIER_TOP.steps * Math.pow(u, 0.95)),
    reward: +(1 + (TIER_TOP.reward - 1) * u).toFixed(2),
    elite: +(0.05 + (TIER_TOP.elite - 0.05) * u).toFixed(3),
    vitae: 1 + Math.floor(index / 5),
    mats: +(1 + (TIER_TOP.mats - 1) * u).toFixed(2),
    bite: +(1 + (TIER_TOP.bite - 1) * Math.pow(u, 1.1)).toFixed(2),
    tough: +(1 + (TIER_TOP.tough - 1) * u).toFixed(2),
  }
}

export const TIERS: TierDef[] = Array.from({ length: TIER_COUNT }, (_, i) => makeTier(i))

export function tierIndex(district: DistrictId, zone: number): number {
  return mapIndex(district) * ZONE_COUNT + Math.max(0, Math.min(ZONE_COUNT - 1, zone))
}

export function tierOf(district: DistrictId, zone: number): TierDef {
  return TIERS[tierIndex(district, zone)]
}

export function zoneName(district: DistrictId, zone: number): string {
  return MAPS[district].zones[zone]?.name ?? `Zone ${zone + 1}`
}

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

/** Ichor an elite drops at a tier. */
export function eliteIchor(tier: number): number {
  return 1 + Math.floor(tier / 8)
}

/** Ichor and Vitae a boss drops at a tier. The Don-sheet bosses carry a little more. */
export function bossLoot(sheet: 'king' | 'don', tier: number): { ichor: number; vitae: number } {
  const extra = sheet === 'don' ? 2 : 0
  return { ichor: 3 + extra + Math.round(tier * 0.8), vitae: 1 + Math.floor(extra / 2) + Math.floor(tier / 4) }
}

/** Ichor to ascend the weapon into a tier. Each tier also needs the weapon level it starts at. */
export const TIER_ICHOR: Record<ClawTierId, number> = {
  teethling: 0,
  kindred: Math.round(60 * PACE),
  awakened: Math.round(240 * PACE),
  ascendent: Math.round(640 * PACE),
  immortal: Math.round(1500 * PACE),
}

/** Blood powers: Vitae ranks on each skill. Each rank is a small step; the last ones cost the most. */
export const POWER_MAX = 10
export const POWER_DMG = 0.05
export const POWER_CD = 0.02

export function powerCost(rank: number): number {
  return Math.round((6 + rank * 6 + rank * rank * 1.8) * PACE)
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
  return Array.from({ length: ranks }, (_, r) => Math.round(base * PACE * Math.pow(1 + r, 1.55)))
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

export function eliteChance(district: DistrictId, zone: number, scentRank: number): number {
  return tierOf(district, zone).elite + scentRank * RITE_STEP.scent
}

/** Materials an enemy drops in a zone, rounded by chance so small amounts still grow. */
export function matDrop(amount: number, district: DistrictId, zone: number, roll = Math.random()): number {
  const v = amount * tierOf(district, zone).mats
  return Math.floor(v) + (roll < v - Math.floor(v) ? 1 : 0)
}

export function nightSteps(district: DistrictId, zone: number, elapsed: number): number {
  return tierOf(district, zone).steps + (elapsed / 60) * STEPS_PER_MINUTE
}

/** Enemy damage multiplier for a night, from its map and zone. */
export function nightBite(district: DistrictId, zone: number): number {
  return tierOf(district, zone).bite
}

/** Enemy HP multiplier for a night, from its map and zone. */
export function nightTough(district: DistrictId, zone: number): number {
  return tierOf(district, zone).tough
}

export function nightReward(district: DistrictId, zone: number): number {
  return tierOf(district, zone).reward
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
