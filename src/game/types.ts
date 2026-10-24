import type { ClawTierId } from './balance'
import type { DistrictId, Purse, RiteId } from './nights'
import type { LookSlot, WorkId } from './haven'
import type { NightTally } from './marks'
import type { WeaponKind } from './weapons'

/** The hero's four stats. What each point is worth is in balance.ts (PER_STAT). */
export type Stat = 'strength' | 'vitality' | 'agility' | 'sorcery'

export type Slot = 'weapon' | 'cape' | 'coat' | 'boots'

export type SkillId = 'bats' | 'drain' | 'dash' | 'nova'

export type EnemyKind = 'hound' | 'walker' | 'thrall' | 'spitter' | 'skeleton' | 'boss' | 'thug' | 'enforcer' | 'don'

/** A model a map swaps in for one of its foes. The foe keeps its kind's stats and fight. */
export type FoeLook = 'hunter' | 'zealot'

export const STATS: Stat[] = ['strength', 'vitality', 'agility', 'sorcery']

export const SLOTS: Slot[] = ['weapon', 'cape', 'coat', 'boots']

export const SKILLS: SkillId[] = ['bats', 'drain', 'dash', 'nova']

/** Kill ranks one weapon class holds in the tier it earned them in. */
export interface WeaponRank {
  tier: ClawTierId
  rank: number
  /** Kills toward the next rank. */
  kills: number
}

/** A night in progress, so a reload drops the hero back into it. */
export interface NightSave {
  district: DistrictId
  /** Zone of the map, 0-based. */
  danger: number
  elapsed: number
  carried: Purse
  kills: number
  tally?: NightTally
}

export interface SaveData {
  v: 1
  /** Banked Blood. A night's Blood is carried until extraction. */
  blood: number
  ichor: number
  vitae: number
  /** Materials from the hunt, spent on the Haven's works and wardrobe. */
  bone: number
  bile: number
  brass: number
  /** Level of each Haven work. */
  works: Record<WorkId, number>
  /** Cosmetic ids bought at the wardrobe. The starting looks are always owned. */
  wardrobe: string[]
  /** What the hero wears in each look slot. */
  wear: Record<LookSlot, string>
  /** The weapon tier bought with Ichor. Shared by every weapon class. */
  weaponTier: ClawTierId
  /** Vitae ranks on each blood power. */
  powers: Record<SkillId, number>
  rites: Record<RiteId, number>
  /** Highest zone open in each map, 0-based (0 to 2). A map itself opens by its gate (see marks.ts). */
  danger: Record<DistrictId, number>
  extracts: number
  /** Progress on each mark, keyed district.danger.index: extraction counts, or 1 once done. */
  marks: Record<string, number>
  /** Layout of the marks the save was written with. */
  marksV: number
  /** The local day whose Omen has been met. */
  omenDay: string
  night: NightSave | null
  /** Feeds per stat: every kill adds one to the stat its creature feeds, worth FEED_STEP of a point each. */
  stacks: Record<Stat, number>
  gear: Record<Slot, number>
  /** The equipped weapon class. Its level is `gear.weapon`. */
  weapon: WeaponKind
  /** Per weapon class. A tier change starts every class over at rank 0. */
  weaponRanks: Record<WeaponKind, WeaponRank>
  evolved: Record<Slot, boolean>
  level: number
  xp: number
  kills: number
  /** Falls of each map's boss. */
  bosses: Record<DistrictId, number>
  /** Kills in the mob district. */
  mobKills: number
  killRate: number
  lastActiveAt: number
  muted: boolean
  /** Camera distance the player picked, as a multiple of the screen-fit default. */
  camZoom: number
  seenHint: boolean
}

export interface OfflineReport {
  seconds: number
  capped: boolean
  feeds: number
  blood: number
  xp: number
  levels: number
  strength: number
  agility: number
  vitality: number
  sorcery: number
}
