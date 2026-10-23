import type { Attr } from './attributes'
import type { ClawTierId } from './balance'
import type { DistrictId, Purse, RiteId } from './nights'
import type { LookSlot, WorkId } from './haven'
import type { WeaponKind } from './weapons'

export type Stat =
  | 'strength'
  | 'fortitude'
  | 'agility'
  | 'sorcery'
  | 'resistance'
  | 'vitality'

export type Slot = 'weapon' | 'cape' | 'coat' | 'boots'

export type SkillId = 'bats' | 'drain' | 'dash' | 'nova'

export type EnemyKind = 'hound' | 'walker' | 'thrall' | 'spitter' | 'skeleton' | 'boss' | 'thug' | 'enforcer' | 'don'

export const STATS: Stat[] = [
  'strength',
  'fortitude',
  'agility',
  'sorcery',
  'resistance',
  'vitality',
]

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
  /** 0-based index into DANGERS. */
  danger: number
  elapsed: number
  carried: Purse
  kills: number
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
  /** Highest danger unlocked in each district, 0-based. */
  danger: Record<DistrictId, number>
  extracts: number
  night: NightSave | null
  stacks: Record<Stat, number>
  /** Attribute points the player has spent. Base values live in attributes.ts. */
  attrs: Record<Attr, number>
  gear: Record<Slot, number>
  /** The equipped weapon class. Its level is `gear.weapon`. */
  weapon: WeaponKind
  /** Per weapon class. A tier change starts every class over at rank 0. */
  weaponRanks: Record<WeaponKind, WeaponRank>
  evolved: Record<Slot, boolean>
  level: number
  xp: number
  kills: number
  bossKills: number
  /** Kills in the mob district. The Slums boss still keys off `kills`. */
  mobKills: number
  donKills: number
  killRate: number
  lastActiveAt: number
  muted: boolean
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
