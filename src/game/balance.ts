import { applyAttributes } from './attributes'
import type { EnemyKind, SaveData, SkillId, Slot, Stat, WeaponRank } from './types'
import { NORTH_ALLEY_SHIFT } from './world'
import { SLOTS } from './types'
import { WEAPONS, type WeaponKind } from './weapons'

export const BASE_STAT: Record<Stat, number> = {
  strength: 8,
  fortitude: 8,
  agility: 8,
  sorcery: 8,
  resistance: 6,
  vitality: 22,
}

const GEAR: Record<Slot, { stat: Stat; per: number; also: { stat: Stat; per: number } }> = {
  weapon: { stat: 'strength', per: 4, also: { stat: 'vitality', per: 1 } },
  cape: { stat: 'sorcery', per: 3, also: { stat: 'resistance', per: 2 } },
  coat: { stat: 'fortitude', per: 4, also: { stat: 'vitality', per: 3 } },
  boots: { stat: 'agility', per: 4, also: { stat: 'fortitude', per: 1 } },
}

export const GEAR_NAMES: Record<Slot, [number, string][]> = {
  weapon: [
    [1, 'Teethling Claws'],
    [10, 'Kindred Claws'],
    [20, 'Awakened Claws'],
    [32, 'Ascendent Claws'],
    [44, 'Immortal Claws'],
  ],
  cape: [
    [1, 'Tattered Cape'],
    [10, 'Nightwing Mantle'],
    [25, 'Elder Mantle'],
  ],
  coat: [
    [1, 'Ragged Coat'],
    [10, "Butcher's Coat"],
    [25, 'Elder Coat'],
  ],
  boots: [
    [1, 'Soft Boots'],
    [10, 'Grave Boots'],
    [25, 'Elder Treads'],
  ],
}

export const SKILL_META: Record<
  SkillId,
  { name: string; cd: number; blurb: string }
> = {
  bats: { name: 'Bat Swarm', cd: 6, blurb: 'A spiral of bats chews everything nearby.' },
  drain: { name: 'Blood Drain', cd: 7.5, blurb: 'Rip blood from the nearest prey and heal.' },
  dash: { name: 'Shadow Dash', cd: 4.5, blurb: 'Blink through the dark and cut what you pass.' },
  nova: { name: 'Crimson Nova', cd: 12, blurb: 'A ring of blood-light detonates around you.' },
}

export interface EnemyDef {
  label: string
  stat: Stat
  statLabel: string
  hp: number
  dmg: number
  speed: number
  range: number
  cd: number
  aggro: number
  xp: number
  blood: number
  radius: number
  barY: number
  ranged?: boolean
}

export const ENEMIES: Record<Exclude<EnemyKind, 'boss' | 'don'>, EnemyDef> = {
  ghoul: {
    label: 'Ghoul',
    stat: 'strength',
    statLabel: 'Strength',
    hp: 48,
    dmg: 9,
    speed: 1.35,
    range: 1.28,
    cd: 1.6,
    aggro: 7.6,
    xp: 6,
    blood: 6,
    radius: 0.48,
    barY: 1.72,
  },
  rat: {
    label: 'Gutter Rat',
    stat: 'agility',
    statLabel: 'Agility',
    hp: 22,
    dmg: 5,
    speed: 2.45,
    range: 1.05,
    cd: 1.15,
    aggro: 8.2,
    xp: 4,
    blood: 4,
    radius: 0.32,
    barY: 1.18,
  },
  wolf: {
    label: 'Slum Wolf',
    stat: 'vitality',
    statLabel: 'Vitality',
    hp: 62,
    dmg: 12,
    speed: 2.05,
    range: 1.32,
    cd: 1.45,
    aggro: 8.4,
    xp: 8,
    blood: 7,
    radius: 0.5,
    barY: 1.62,
  },
  witch: {
    label: 'Hedge Witch',
    stat: 'sorcery',
    statLabel: 'Sorcery',
    hp: 34,
    dmg: 8,
    speed: 1.45,
    range: 4.6,
    cd: 1.75,
    aggro: 9,
    xp: 7,
    blood: 6,
    radius: 0.4,
    barY: 1.9,
    ranged: true,
  },
  thug: {
    label: 'Mob Thug',
    stat: 'strength',
    statLabel: 'Strength',
    hp: 76,
    dmg: 14,
    speed: 1.58,
    range: 1.32,
    cd: 1.5,
    aggro: 8.2,
    xp: 9,
    blood: 8,
    radius: 0.48,
    barY: 1.85,
  },
  enforcer: {
    label: 'Enforcer',
    stat: 'vitality',
    statLabel: 'Vitality',
    hp: 112,
    dmg: 18,
    speed: 1.28,
    range: 1.38,
    cd: 1.55,
    aggro: 8.4,
    xp: 12,
    blood: 11,
    radius: 0.56,
    barY: 2.05,
  },
}

/** Per-level growth. Level 1 with zero clears leaves the base row untouched. */
export interface Growth {
  role: string
  armor: number
  hp: number
  dmg: number
  speed: number
  speedCap: number
  armorStep: number
  reward: number
  /** Seconds before this kind steps back onto its nest. */
  return: number
  cap: number
  /** Living cap while that district's boss is on the field. */
  capBoss: number
}

export const GROWTH: Record<Exclude<EnemyKind, 'boss' | 'don'>, Growth> = {
  rat: {
    role: 'skirmisher',
    armor: 0,
    hp: 0.07,
    dmg: 0.04,
    speed: 0.012,
    speedCap: 3.1,
    armorStep: 0.4,
    reward: 0.06,
    return: 4.5,
    cap: 3,
    capBoss: 4,
  },
  ghoul: {
    role: 'bruiser',
    armor: 4,
    hp: 0.09,
    dmg: 0.055,
    speed: 0.008,
    speedCap: 1.9,
    armorStep: 0.8,
    reward: 0.05,
    return: 7,
    cap: 2,
    capBoss: 1,
  },
  wolf: {
    role: 'hunter',
    armor: 6,
    hp: 0.08,
    dmg: 0.06,
    speed: 0.01,
    speedCap: 2.7,
    armorStep: 0.7,
    reward: 0.055,
    return: 9,
    cap: 2,
    capBoss: 1,
  },
  witch: {
    role: 'artillery',
    armor: 2,
    hp: 0.06,
    dmg: 0.07,
    speed: 0.006,
    speedCap: 1.8,
    armorStep: 0.35,
    reward: 0.07,
    return: 11,
    cap: 1,
    capBoss: 0,
  },
  thug: {
    role: 'muscle',
    armor: 5,
    hp: 0.07,
    dmg: 0.05,
    speed: 0.008,
    speedCap: 2.1,
    armorStep: 0.6,
    reward: 0.05,
    return: 8,
    cap: 3,
    capBoss: 3,
  },
  enforcer: {
    role: 'wall',
    armor: 8,
    hp: 0.08,
    dmg: 0.05,
    speed: 0.006,
    speedCap: 1.7,
    armorStep: 0.9,
    reward: 0.05,
    return: 10,
    cap: 2,
    capBoss: 2,
  },
}

export type NestRole = 'opening' | 'later' | 'alt'

export interface NestDef {
  kind: Exclude<EnemyKind, 'boss' | 'don'>
  x: number
  z: number
  role: NestRole
}

/** Hand-placed Slums nests. `later` fills up to the cap. `alt` is a fallback point. */
export const NESTS: NestDef[] = [
  { kind: 'rat', x: 2.2, z: -2.2, role: 'opening' },
  { kind: 'rat', x: -4.6, z: -1.8, role: 'opening' },
  { kind: 'rat', x: -20.9, z: -34.0, role: 'later' },
  { kind: 'ghoul', x: -2.8, z: 6.4, role: 'opening' },
  { kind: 'ghoul', x: -24.6, z: -48.4, role: 'later' },
  { kind: 'ghoul', x: -8.0, z: -24.15, role: 'alt' },
  { kind: 'wolf', x: 0.8, z: 13.6 + NORTH_ALLEY_SHIFT, role: 'opening' },
  { kind: 'wolf', x: -42.6, z: 25.2, role: 'later' },
  { kind: 'witch', x: 4.8, z: -4.4, role: 'opening' },
  { kind: 'witch', x: -26.4, z: -45.2, role: 'alt' },
]

/** Rat King ring in Zone 2, the court south-west of the center. */
export const KING_ARENA = { x: -40.2, z: 24.2, radius: 1.95 }

export const LITTER: { x: number; z: number }[] = [
  { x: -39.1, z: 23.25 },
  { x: -41.35, z: 25.05 },
]

export const NODE = {
  crypt: { blood: 36, respawn: 16, label: 'Crypt' },
  fountain: { blood: 52, respawn: 22, label: 'Blood Fountain' },
} as const

export const OFFLINE_CAP_SEC = 8 * 3600
export const OFFLINE_MIN_SEC = 90
export const MAX_GEAR = 50
export const ARENA_R = 7.45

export function zeroStats(): Record<Stat, number> {
  return { strength: 0, fortitude: 0, agility: 0, sorcery: 0, resistance: 0, vitality: 0 }
}

export type ClawTierId = 'teethling' | 'kindred' | 'awakened' | 'ascendent' | 'immortal'

export interface ClawTier {
  id: ClawTierId
  label: string
  /** Weapon level where this tier starts. */
  from: number
  /** Rarity color used for the mesh, trail, and menu text. */
  color: number
  css: string
  /** Weapon damage multiplier at rank 0. Never below the last tier's full rank. */
  power: number
  /** Crit chance added on top of the weapon's own. */
  crit: number
  /** Kill ranks the tier holds. Higher tiers hold more. */
  ranks: number
  /** Damage multiplier added per rank. */
  perRank: number
  /** Kills for the first rank. Each rank after asks for half that again. */
  kills: number
}

export const CLAW_TIERS: ClawTier[] = [
  { id: 'teethling', label: 'Teethling', from: 1, color: 0x9a9ea6, css: '#b6bac2', power: 1, crit: 0, ranks: 3, perRank: 0.04, kills: 10 },
  { id: 'kindred', label: 'Kindred', from: 10, color: 0x3fcf5e, css: '#5fe07c', power: 1.15, crit: 0.02, ranks: 5, perRank: 0.05, kills: 18 },
  { id: 'awakened', label: 'Awakened', from: 20, color: 0x3a8cff, css: '#62a8ff', power: 1.42, crit: 0.04, ranks: 7, perRank: 0.06, kills: 28 },
  { id: 'ascendent', label: 'Ascendent', from: 32, color: 0xa65cff, css: '#c08bff', power: 1.86, crit: 0.06, ranks: 9, perRank: 0.07, kills: 40 },
  { id: 'immortal', label: 'Immortal', from: 44, color: 0xff2238, css: '#ff4d5e', power: 2.5, crit: 0.09, ranks: 12, perRank: 0.08, kills: 55 },
]

export function clawTier(level: number): ClawTier {
  let tier = CLAW_TIERS[0]
  for (const t of CLAW_TIERS) if (level >= t.from) tier = t
  return tier
}

export function nextClawTier(level: number): ClawTier | null {
  return CLAW_TIERS.find((t) => t.from > level) ?? null
}

/** Kills to go from `rank` to `rank + 1` inside a tier. */
export function rankKills(tier: ClawTier, rank: number): number {
  return Math.round(tier.kills * (1 + rank * 0.5))
}

/** A weapon's rank in the current tier. A rank earned in an older tier reads as a fresh start. */
export function weaponRank(save: SaveData, kind: WeaponKind): WeaponRank {
  const tier = clawTier(save.gear.weapon)
  const held = save.weaponRanks[kind]
  if (held.tier !== tier.id) return { tier: tier.id, rank: 0, kills: 0 }
  return { tier: tier.id, rank: Math.min(tier.ranks, held.rank), kills: held.kills }
}

/** Damage multiplier from the equipped weapon's tier and rank. */
export function tierPower(tier: ClawTier, rank: number): number {
  return tier.power + Math.min(tier.ranks, rank) * tier.perRank
}

/**
 * Counts kills toward the equipped weapon's next rank. Kills past the
 * tier's last rank are dropped: the room to grow comes from the next tier.
 * Returns the ranks gained.
 */
export function feedWeapon(save: SaveData, kills: number): number {
  const tier = clawTier(save.gear.weapon)
  const held = weaponRank(save, save.weapon)
  let gained = 0
  held.kills += kills
  while (held.rank < tier.ranks && held.kills >= rankKills(tier, held.rank)) {
    held.kills -= rankKills(tier, held.rank)
    held.rank += 1
    gained++
  }
  if (held.rank >= tier.ranks) held.kills = 0
  save.weaponRanks[save.weapon] = held
  return gained
}

export function gearName(slot: Slot, level: number): string {
  let name = GEAR_NAMES[slot][0][1]
  for (const [lv, n] of GEAR_NAMES[slot]) if (level >= lv) name = n
  return name
}

export function upgradeCost(level: number): number {
  return Math.max(1, Math.round(10 * Math.pow(1.15, level)))
}

export function xpNeed(level: number): number {
  return 12 + level * 10
}

export function gearFlat(save: SaveData): Record<Stat, number> {
  const out = zeroStats()
  for (const slot of SLOTS) {
    const spec = GEAR[slot]
    const lv = save.gear[slot]
    out[spec.stat] += spec.per * lv
    out[spec.also.stat] += spec.also.per * lv
    if (save.evolved[slot]) out[spec.stat] += 8
  }
  return out
}

function levelBonus(save: SaveData, stat: Stat): number {
  if (stat === 'fortitude' || stat === 'resistance') return Math.max(0, save.level - 1)
  return 0
}

export function sheetStat(save: SaveData, stat: Stat): number {
  return BASE_STAT[stat] + save.stacks[stat] + gearFlat(save)[stat] + levelBonus(save, stat)
}

/** Combat contribution of feed stacks. Fast at first, then flattens so a night of thralls cannot erase the district. */
export function stackPower(stacks: number): number {
  return (90 * stacks) / (stacks + 70)
}

export function combatStat(save: SaveData, stat: Stat): number {
  return BASE_STAT[stat] + gearFlat(save)[stat] + levelBonus(save, stat) + stackPower(save.stacks[stat])
}

export interface CombatProfile {
  dmg: number
  crit: number
  interval: number
  speed: number
  hp: number
  armor: number
  resist: number
  skill: number
  lifesteal: number
  regen: number
  cdScale: number
  /** Blood multiplier on kills (Hunger). */
  bloodMult: number
  /** Damage-taken multiplier after armor (Shade). */
  guard: number
}

export function profile(save: SaveData): CombatProfile {
  const str = combatStat(save, 'strength')
  const agi = combatStat(save, 'agility')
  const sor = combatStat(save, 'sorcery')
  const vit = combatStat(save, 'vitality')
  const fort = combatStat(save, 'fortitude')
  const res = combatStat(save, 'resistance')
  const w = WEAPONS[save.weapon]
  const tier = clawTier(save.gear.weapon)
  const power = tierPower(tier, weaponRank(save, save.weapon).rank)
  return applyAttributes({
    dmg: (10 + str * 0.55 + save.gear.weapon * 1.35) * w.dmg * power,
    crit: Math.min(0.45, 0.05 + agi * 0.0035 + w.crit + tier.crit),
    interval: Math.max(0.28, 0.52 - agi * 0.003 - save.gear.boots * 0.012) * w.interval,
    speed: 3.2 + agi * 0.018 + save.gear.boots * 0.055,
    hp: 96 + vit * 2.3 + save.gear.coat * 5,
    armor: fort * 0.45 + save.gear.coat * 1.15,
    resist: res,
    skill: 1 + sor * 0.018 + save.gear.cape * 0.055,
    lifesteal: Math.min(0.2, 0.03 + vit * 0.0011),
    regen: 1.1 + vit * 0.035,
    cdScale: 1 - Math.min(0.28, sor * 0.0014),
    bloodMult: 1,
    guard: 1,
  }, save)
}

export function mitigate(raw: number, armor: number, resist: number, fromBoss: boolean): number {
  const red = armor / (armor + 48)
  const bossCut = fromBoss ? Math.min(0.4, resist * 0.004) : 0
  return Math.max(1, raw * (1 - red) * (1 - bossCut))
}

export function scaledHp(base: number, level: number): number {
  return Math.round(base * (1 + Math.max(0, level - 1) * 0.055))
}

/** One clear counts as half a level of trash growth. The king's own formula is separate. */
export function enemySteps(save: SaveData): number {
  return Math.max(0, save.level - 1) + save.bossKills * 0.5
}

export interface FightStats {
  hp: number
  dmg: number
  speed: number
  armor: number
  xp: number
  blood: number
}

export function enemyStats(kind: Exclude<EnemyKind, 'boss' | 'don'>, save: SaveData): FightStats {
  const def = ENEMIES[kind]
  const g = GROWTH[kind]
  const steps = enemySteps(save)
  return {
    hp: Math.round(def.hp * (1 + steps * g.hp)),
    dmg: def.dmg * (1 + steps * g.dmg),
    speed: Math.min(g.speedCap, def.speed * (1 + steps * g.speed)),
    armor: g.armor + steps * g.armorStep,
    xp: Math.round(def.xp * (1 + steps * g.reward)),
    blood: Math.round(def.blood * (1 + steps * g.reward)),
  }
}

/** Trash and the king. Armor 0 leaves the hit unchanged aside from the minimum of 1. */
export function enemyMitigate(raw: number, armor: number): number {
  if (armor <= 0) return Math.max(1, raw)
  return Math.max(1, raw * (1 - armor / (armor + 40)))
}

/** Rat King armor. Zero on the first summon, then +3 for each clear already banked. */
export function kingArmor(kills: number): number {
  return Math.max(0, kills) * 3
}

export function grantXp(save: SaveData, amount: number): number {
  save.xp += amount
  let gained = 0
  let guard = 0
  while (save.xp >= xpNeed(save.level) && guard++ < 60) {
    save.xp -= xpNeed(save.level)
    save.level += 1
    gained++
  }
  return gained
}

export function bossBlueprint(save: SaveData): {
  hp: number
  dmg: number
  pound: number
  speed: number
  xp: number
  blood: number
} {
  const str = combatStat(save, 'strength')
  const n = save.bossKills
  return {
    hp: Math.round((460 + str * 5.5) * Math.pow(1.18, n)),
    dmg: 11 + n * 2,
    pound: 16 + n * 3,
    speed: 1.5,
    xp: 48,
    blood: 200,
  }
}

/** Next district boss. Separate from the Rat King so Slums scaling stays put. */
export function donBlueprint(save: SaveData): {
  hp: number
  dmg: number
  pound: number
  speed: number
  xp: number
  blood: number
} {
  const str = combatStat(save, 'strength')
  const n = save.donKills
  return {
    hp: Math.round((680 + str * 6.2) * Math.pow(1.18, n)),
    dmg: 14 + n * 2,
    pound: 20 + n * 3,
    speed: 1.42,
    xp: 62,
    blood: 260,
  }
}

export function skillDamage(id: SkillId, prof: CombatProfile): number {
  const base = prof.dmg * prof.skill
  if (id === 'bats') return base * 0.42
  if (id === 'drain') return base * 1.7
  if (id === 'dash') return base * 1.15
  return base * 2.55
}

export const FEED_COLOR: Record<Stat, string> = {
  strength: '#ffb020',
  fortitude: '#e6c36a',
  agility: '#3ee0c8',
  sorcery: '#d58bff',
  resistance: '#8fd0ff',
  vitality: '#ff5a78',
}

export function formatNum(n: number): string {
  return Math.floor(n).toLocaleString('en-US')
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h <= 0) return `${Math.max(1, m)} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}
