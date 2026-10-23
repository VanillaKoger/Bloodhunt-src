import { WORK_STEP } from './haven'
import { PACE } from './pace'
import type { EnemyKind, SaveData, SkillId, Slot, Stat, WeaponRank } from './types'
import { SLOTS } from './types'
import { WEAPONS, weaponInterval, type WeaponKind } from './weapons'
import { powerScale } from './nights'

/**
 * Four stats, one per gear slot, and every point is worth the same wherever
 * it came from: the hero's start, a gear level, a hero level, or feeding.
 *
 *   Strength  hit damage                     (weapon)
 *   Vitality  health and armor               (coat)
 *   Agility   crit chance and move speed     (boots)
 *   Sorcery   blood power damage and cooldown (cape)
 */
export const BASE_STAT: Record<Stat, number> = {
  strength: 30,
  vitality: 50,
  agility: 15,
  sorcery: 15,
}

/** The stat each gear slot raises, and by how much a level. Awakening (level 10) adds GEAR_AWAKEN on top. */
export const GEAR_STAT: Record<Slot, { stat: Stat; per: number }> = {
  weapon: { stat: 'strength', per: 8 },
  cape: { stat: 'sorcery', per: 8 },
  coat: { stat: 'vitality', per: 8 },
  boots: { stat: 'agility', per: 8 },
}

export const GEAR_AWAKEN = 10

/** Each hero level past the first adds this to every stat. */
export const LEVEL_STAT = 3

/** Every kill adds this to the stat its creature feeds; elites feed ELITE_FEEDS times over. */
export const FEED_STEP = 0.01
export const ELITE_FEEDS = 3
/** A boss feeds every stat this many times. */
export const BOSS_FEEDS = 20

/** What one point of each stat is worth. */
export const PER_STAT = {
  /** Hit damage, on top of BASE_HIT, before the weapon's own multiplier and tier. */
  strength: 0.2,
  vitality: { hp: 0.6, armor: 0.13 },
  agility: { crit: 0.0004, speed: 0.006, magnet: 0.003 },
  sorcery: { skill: 0.0028, cd: 0.00032 },
}

export const BASE_HIT = 10
export const BASE_HP = 130
export const BASE_CRIT = 0.05
export const CRIT_CAP = 0.45
export const BASE_SPEED = 3.2
/** Blood power cooldowns shorten by at most this much. */
export const CD_CAP = 0.28

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

/** Run materials. Each enemy family drops its own; the Haven's works and wardrobe spend them. */
export type Material = 'bone' | 'bile' | 'brass'

export const MATERIALS: Material[] = ['bone', 'bile', 'brass']

export const MATERIAL_LABEL: Record<Material, string> = { bone: 'Bone', bile: 'Bile', brass: 'Brass' }

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
  /** The material this family drops: `chance` of `amount` per kill. Elites always drop three times as much. */
  drop: { mat: Material; chance: number; amount: number }
}

export type Foe = Exclude<EnemyKind, 'boss' | 'don'>

export const ENEMIES: Record<Foe, EnemyDef> = {
  hound: {
    label: 'Plague Hound',
    stat: 'agility',
    statLabel: 'Agility',
    hp: 26,
    dmg: 6,
    speed: 2.6,
    range: 1.05,
    cd: 1.1,
    aggro: 8.4,
    xp: 4,
    blood: 4,
    radius: 0.34,
    barY: 1.05,
    drop: { mat: 'bone', chance: 0.4, amount: 1 },
  },
  walker: {
    label: 'Plague Walker',
    stat: 'vitality',
    statLabel: 'Vitality',
    hp: 70,
    dmg: 11,
    speed: 1.2,
    range: 1.3,
    cd: 1.7,
    aggro: 7.2,
    xp: 7,
    blood: 7,
    radius: 0.48,
    barY: 1.75,
    drop: { mat: 'bile', chance: 0.7, amount: 1 },
  },
  thrall: {
    label: 'Feral Thrall',
    stat: 'strength',
    statLabel: 'Strength',
    hp: 58,
    dmg: 13,
    speed: 2.1,
    range: 1.3,
    cd: 1.35,
    aggro: 8.6,
    xp: 8,
    blood: 8,
    radius: 0.44,
    barY: 1.8,
    drop: { mat: 'bile', chance: 0.5, amount: 2 },
  },
  spitter: {
    label: 'Miasma',
    stat: 'sorcery',
    statLabel: 'Sorcery',
    hp: 34,
    dmg: 8,
    speed: 1.4,
    range: 4.6,
    cd: 1.8,
    aggro: 9,
    xp: 7,
    blood: 6,
    radius: 0.4,
    barY: 1.9,
    ranged: true,
    drop: { mat: 'bile', chance: 0.8, amount: 1 },
  },
  skeleton: {
    label: 'Skeleton',
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
    drop: { mat: 'bone', chance: 1, amount: 2 },
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
    drop: { mat: 'brass', chance: 0.65, amount: 1 },
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
    drop: { mat: 'brass', chance: 1, amount: 2 },
  },
}

/** What the bosses leave behind, on top of their Blood, Ichor, and Vitae. */
export const BOSS_MATERIALS: Record<'boss' | 'don', Partial<Record<Material, number>>> = {
  boss: { bile: 10, bone: 6, brass: 4 },
  don: { brass: 14, bone: 4 },
}

/** XP and Blood every enemy and boss gains per growth step. Small, so most of the pay comes from the danger itself. */
export const REWARD_STEP = 0.02

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
  /** Seconds before a mob district enemy steps back onto the square. */
  return: number
  cap: number
  /** Living cap while that district's boss is on the field. */
  capBoss: number
}

export const GROWTH: Record<Foe, Growth> = {
  hound: { role: 'skirmisher', armor: 0, hp: 0.07, dmg: 0.04, speed: 0.012, speedCap: 3.2, armorStep: 0.4, reward: REWARD_STEP, return: 6, cap: 6, capBoss: 6 },
  walker: { role: 'bruiser', armor: 5, hp: 0.09, dmg: 0.055, speed: 0.008, speedCap: 1.7, armorStep: 0.8, reward: REWARD_STEP, return: 8, cap: 5, capBoss: 3 },
  thrall: { role: 'hunter', armor: 5, hp: 0.08, dmg: 0.06, speed: 0.01, speedCap: 2.8, armorStep: 0.7, reward: REWARD_STEP, return: 9, cap: 4, capBoss: 2 },
  spitter: { role: 'artillery', armor: 2, hp: 0.06, dmg: 0.07, speed: 0.006, speedCap: 1.8, armorStep: 0.35, reward: REWARD_STEP, return: 11, cap: 3, capBoss: 1 },
  skeleton: { role: 'bruiser', armor: 4, hp: 0.09, dmg: 0.055, speed: 0.008, speedCap: 1.9, armorStep: 0.8, reward: REWARD_STEP, return: 7, cap: 4, capBoss: 2 },
  thug: { role: 'muscle', armor: 5, hp: 0.07, dmg: 0.05, speed: 0.008, speedCap: 2.1, armorStep: 0.6, reward: REWARD_STEP, return: 8, cap: 4, capBoss: 3 },
  enforcer: { role: 'wall', armor: 8, hp: 0.08, dmg: 0.05, speed: 0.006, speedCap: 1.7, armorStep: 0.9, reward: REWARD_STEP, return: 10, cap: 2, capBoss: 2 },
}

/** A pod wakes once the hero is this close to its spot. */
export const POD_WAKE = 24
/** A pod that saw or felt the hero hunts together for this long. */
export const POD_ALERT = 6
/** Members drift no further than this from their spot while idle. */
export const POD_LEASH = 2.2

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
/** Feeds an hour the hero's thralls make while away, before the Thrall Master rite. */
export const OFFLINE_FEEDS_PER_HOUR = 6
export const MAX_GEAR = 50
/** The hero stops gaining levels here. */
export const LEVEL_CAP = 60
export const ARENA_R = 7.45

export function zeroStats(): Record<Stat, number> {
  return { strength: 0, vitality: 0, agility: 0, sorcery: 0 }
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
  { id: 'teethling', label: 'Teethling', from: 1, color: 0x9a9ea6, css: '#b6bac2', power: 1, crit: 0, ranks: 3, perRank: 0.015, kills: 40 },
  { id: 'kindred', label: 'Kindred', from: 10, color: 0x3fcf5e, css: '#5fe07c', power: 1.08, crit: 0.01, ranks: 5, perRank: 0.015, kills: 120 },
  { id: 'awakened', label: 'Awakened', from: 20, color: 0x3a8cff, css: '#62a8ff', power: 1.2, crit: 0.02, ranks: 7, perRank: 0.016, kills: 220 },
  { id: 'ascendent', label: 'Ascendent', from: 32, color: 0xa65cff, css: '#c08bff', power: 1.35, crit: 0.03, ranks: 9, perRank: 0.017, kills: 320 },
  { id: 'immortal', label: 'Immortal', from: 44, color: 0xff2238, css: '#ff4d5e', power: 1.52, crit: 0.04, ranks: 12, perRank: 0.018, kills: 340 },
]

export function clawTier(level: number): ClawTier {
  let tier = CLAW_TIERS[0]
  for (const t of CLAW_TIERS) if (level >= t.from) tier = t
  return tier
}

export function nextClawTier(level: number): ClawTier | null {
  return CLAW_TIERS.find((t) => t.from > level) ?? null
}

/** The weapon tier the hero owns. Tiers are bought with Ichor at the Haven. */
export function heldTier(save: SaveData): ClawTier {
  return CLAW_TIERS.find((t) => t.id === save.weaponTier) ?? CLAW_TIERS[0]
}

/** The tier after the one owned, or null at Immortal. */
export function nextHeldTier(save: SaveData): ClawTier | null {
  const at = CLAW_TIERS.indexOf(heldTier(save))
  return CLAW_TIERS[at + 1] ?? null
}

/** Kills to go from `rank` to `rank + 1` inside a tier. */
export function rankKills(tier: ClawTier, rank: number): number {
  return Math.round(tier.kills * PACE * (1 + rank * 0.5))
}

/** A weapon's rank in the current tier. A rank earned in an older tier reads as a fresh start. */
export function weaponRank(save: SaveData, kind: WeaponKind): WeaponRank {
  const tier = heldTier(save)
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
  const tier = heldTier(save)
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

/** Blood for the next gear level from `level`. Early levels come quickly; the last ten take nights each. */
export function upgradeCost(level: number): number {
  return Math.max(1, Math.round(GEAR_COST * PACE * Math.pow(level, GEAR_COST_POW)))
}

export const GEAR_COST = 11.5
export const GEAR_COST_POW = 2.35

/** XP for the next hero level from `level`. Grows a little faster than linear, so late levels take days. */
export function xpNeed(level: number): number {
  return Math.round(XP_BASE + XP_SCALE * PACE * Math.pow(level, XP_POW))
}

export const XP_BASE = 30
export const XP_SCALE = 18
export const XP_POW = 1.95

export function gearFlat(save: SaveData): Record<Stat, number> {
  const out = zeroStats()
  for (const slot of SLOTS) {
    const spec = GEAR_STAT[slot]
    out[spec.stat] += spec.per * save.gear[slot] + (save.evolved[slot] ? GEAR_AWAKEN : 0)
  }
  return out
}

/** A stat's value: start, gear, hero levels, and feeding, all at the same worth per point. */
export function statValue(save: SaveData, stat: Stat): number {
  return BASE_STAT[stat] + gearFlat(save)[stat] + Math.max(0, save.level - 1) * LEVEL_STAT + save.stacks[stat] * FEED_STEP
}

/** Where a stat's points come from, for the menu. */
export function statParts(save: SaveData, stat: Stat): { base: number; gear: number; levels: number; feeds: number } {
  return {
    base: BASE_STAT[stat],
    gear: gearFlat(save)[stat],
    levels: Math.max(0, save.level - 1) * LEVEL_STAT,
    feeds: save.stacks[stat] * FEED_STEP,
  }
}

export interface CombatProfile {
  dmg: number
  crit: number
  interval: number
  speed: number
  hp: number
  armor: number
  skill: number
  lifesteal: number
  regen: number
  cdScale: number
  /** Blood multiplier on kills (the Brass Coffer). */
  bloodMult: number
  /** Damage-taken multiplier after armor. */
  guard: number
}

export function profile(save: SaveData): CombatProfile {
  const str = statValue(save, 'strength')
  const vit = statValue(save, 'vitality')
  const agi = statValue(save, 'agility')
  const sor = statValue(save, 'sorcery')
  const w = WEAPONS[save.weapon]
  const tier = heldTier(save)
  const power = tierPower(tier, weaponRank(save, save.weapon).rank)
  const prof: CombatProfile = {
    dmg: (BASE_HIT + str * PER_STAT.strength) * w.dmg * power,
    crit: Math.min(CRIT_CAP, BASE_CRIT + agi * PER_STAT.agility.crit + w.crit + tier.crit),
    // Attack speed is the weapon's alone. Stats, gear, and ranks never touch it.
    interval: weaponInterval(save.weapon),
    speed: BASE_SPEED + agi * PER_STAT.agility.speed,
    hp: BASE_HP + vit * PER_STAT.vitality.hp,
    armor: vit * PER_STAT.vitality.armor,
    skill: 1 + sor * PER_STAT.sorcery.skill,
    lifesteal: LIFESTEAL,
    regen: 0,
    cdScale: 1 - Math.min(CD_CAP, sor * PER_STAT.sorcery.cd),
    bloodMult: 1,
    guard: 1,
  }
  const out = applyWorks(prof, save)
  out.regen = out.hp * REGEN_SHARE
  return out
}

/** Share of melee damage the hero drinks back. Flat: no stat changes it. */
export const LIFESTEAL = 0.06
/** Out of a fight, the hero mends this share of max HP a second. */
export const REGEN_SHARE = 0.01

/** The Haven works: small, flat percent gains on top of everything else. */
function applyWorks(prof: CombatProfile, save: SaveData): CombatProfile {
  const w = save.works
  return {
    ...prof,
    dmg: prof.dmg * (1 + w.forge * WORK_STEP.forge),
    hp: prof.hp * (1 + w.font * WORK_STEP.font),
    skill: prof.skill * (1 + w.still * WORK_STEP.still),
    bloodMult: prof.bloodMult * (1 + w.locker * WORK_STEP.locker),
    crit: Math.min(0.5, prof.crit + w.ossuary * WORK_STEP.ossuary),
  }
}

/** Damage the hero takes from a hit, after armor. */
export function mitigate(raw: number, armor: number): number {
  return Math.max(1, raw * (1 - armor / (armor + 48)))
}

export function scaledHp(base: number, level: number): number {
  return Math.round(base * (1 + Math.max(0, level - 1) * 0.055))
}

export interface FightStats {
  hp: number
  dmg: number
  speed: number
  armor: number
  xp: number
  blood: number
}

/**
 * Stats at `steps` of growth. A night's steps come from its district, danger, and clock (see nights.ts).
 * `bite` and `tough` are the night's own damage and HP multipliers on top of the steps (nightBite and nightTough in nights.ts).
 */
export function enemyStats(kind: Exclude<EnemyKind, 'boss' | 'don'>, steps: number, bite = 1, tough = 1): FightStats {
  const def = ENEMIES[kind]
  const g = GROWTH[kind]
  return {
    hp: Math.round(def.hp * (1 + steps * g.hp) * tough),
    dmg: def.dmg * (1 + steps * g.dmg) * bite,
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

/** Rat King armor. Zero on the first summon, then +2 for each of his first ten falls. */
export function kingArmor(kills: number): number {
  return Math.min(10, Math.max(0, kills)) * 2
}

/** A boss's armor on a night: his falls, plus the night's danger steps like the trash. */
export function bossArmor(kills: number, steps: number): number {
  return kingArmor(kills) + steps * 0.6
}

/** A boss grows a little each time he falls, for his first twenty falls. The danger does the rest. */
const BOSS_GROWTH_KILLS = 20

export function grantXp(save: SaveData, amount: number): number {
  if (save.level >= LEVEL_CAP) {
    save.xp = 0
    return 0
  }
  save.xp += amount
  let gained = 0
  let guard = 0
  while (save.level < LEVEL_CAP && save.xp >= xpNeed(save.level) && guard++ < 60) {
    save.xp -= xpNeed(save.level)
    save.level += 1
    gained++
  }
  return gained
}

export interface BossSheet {
  hp: number
  dmg: number
  pound: number
  speed: number
  xp: number
  blood: number
}

/** Share of the night's bite a boss takes, as a power. */
const BOSS_BITE = 0.75

/** A night's danger steps (and bite) on top of a boss's own formula. */
function atSteps(bp: BossSheet, steps: number, bite: number, tough: number): BossSheet {
  return {
    ...bp,
    hp: Math.round(bp.hp * (1 + steps * 0.06) * tough),
    // Bosses already grow per step; they take a softer share of the night's bite than the trash.
    dmg: bp.dmg * (1 + steps * 0.04) * Math.pow(bite, BOSS_BITE),
    pound: bp.pound * (1 + steps * 0.04) * Math.pow(bite, BOSS_BITE),
    xp: Math.round(bp.xp * (1 + steps * REWARD_STEP)),
    blood: Math.round(bp.blood * (1 + steps * REWARD_STEP)),
  }
}


/** Boss HP keeps up with the hero's Strength. */
const BOSS_STR_HP = 0.75
const DON_STR_HP = 0.85

/** `kills` is how often this boss has already fallen. */
export function bossBlueprint(save: SaveData, kills: number, steps = 0, bite = 1, tough = 1): BossSheet {
  const str = statValue(save, 'strength')
  const n = Math.min(BOSS_GROWTH_KILLS, kills)
  return atSteps(
    {
      hp: Math.round((460 + str * BOSS_STR_HP) * (1 + n * 0.03)),
      dmg: 11 + n * 0.5,
      pound: 16 + n * 0.8,
      speed: 1.5,
      xp: 48,
      blood: 200,
    },
    steps,
    bite,
    tough,
  )
}

/** Next district boss. Separate from the Rat King so Slums scaling stays put. */
export function donBlueprint(save: SaveData, kills: number, steps = 0, bite = 1, tough = 1): BossSheet {
  const str = statValue(save, 'strength')
  const n = Math.min(BOSS_GROWTH_KILLS, kills)
  return atSteps(
    {
      hp: Math.round((680 + str * DON_STR_HP) * (1 + n * 0.03)),
      dmg: 14 + n * 0.5,
      pound: 20 + n * 0.8,
      speed: 1.42,
      xp: 62,
      blood: 260,
    },
    steps,
    bite,
    tough,
  )
}

/** Skill hit before mitigation. Vitae ranks on the power scale it (see nights.ts). */
export function skillDamage(id: SkillId, prof: CombatProfile, rank = 0): number {
  const base = prof.dmg * prof.skill * powerScale(rank).dmg
  if (id === 'bats') return base * 0.42
  if (id === 'drain') return base * 1.7
  if (id === 'dash') return base * 1.15
  return base * 2.55
}

export const FEED_COLOR: Record<Stat, string> = {
  strength: '#ffb020',
  agility: '#3ee0c8',
  sorcery: '#d58bff',
  vitality: '#ff5a78',
}

export const STAT_LABEL: Record<Stat, string> = {
  strength: 'Strength',
  vitality: 'Vitality',
  agility: 'Agility',
  sorcery: 'Sorcery',
}

export const STAT_SHORT: Record<Stat, string> = { strength: 'STR', vitality: 'VIT', agility: 'AGI', sorcery: 'SOR' }

/** What a stat gives at its current value, e.g. "+43 dmg". */
export function statEffect(save: SaveData, stat: Stat): string {
  const v = statValue(save, stat)
  const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`
  if (stat === 'strength') return `+${(v * PER_STAT.strength).toFixed(1)} hit`
  if (stat === 'vitality') return `+${Math.round(v * PER_STAT.vitality.hp)} HP · ${Math.round(v * PER_STAT.vitality.armor)} armor`
  if (stat === 'agility') return `+${pct(v * PER_STAT.agility.crit, 1)} crit · +${pct((v * PER_STAT.agility.speed) / BASE_SPEED)} speed`
  return `+${pct(v * PER_STAT.sorcery.skill)} power · −${pct(Math.min(CD_CAP, v * PER_STAT.sorcery.cd))} cooldown`
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
