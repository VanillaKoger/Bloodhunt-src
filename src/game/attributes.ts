import type { CombatProfile } from './balance'
import type { SaveData } from './types'
import { WEAPONS } from './weapons'

/**
 * Player attributes. Each is a flat number the player raises with points
 * (one per level). Base comes from ATTR_BASE, bonus is what the player has
 * spent, stored on the save. `effectiveAttrs` is the only place the two are
 * added; `applyAttributes` is the only place they touch combat and movement.
 */
export type Attr =
  | 'might'
  | 'blade'
  | 'blunt'
  | 'claws'
  | 'vitality'
  | 'bloodflow'
  | 'swiftness'
  | 'fang'
  | 'hunger'
  | 'shade'

export type WeaponType = 'blade' | 'blunt' | 'claws'

export const ATTRS: Attr[] = ['might', 'blade', 'blunt', 'claws', 'vitality', 'bloodflow', 'swiftness', 'fang', 'hunger', 'shade']

export const ATTR_LABEL: Record<Attr, string> = {
  might: 'Might',
  blade: 'Blades',
  blunt: 'Blunt',
  claws: 'Claws',
  vitality: 'Vitality',
  bloodflow: 'Bloodflow',
  swiftness: 'Swiftness',
  fang: 'Fang',
  hunger: 'Hunger',
  shade: 'Shade',
}

/** Starting values. All zero so a fresh hero plays exactly as before. */
export const ATTR_BASE: Record<Attr, number> = {
  might: 0,
  blade: 0,
  blunt: 0,
  claws: 0,
  vitality: 0,
  bloodflow: 0,
  swiftness: 0,
  fang: 0,
  hunger: 0,
  shade: 0,
}

/** What one point is worth. */
export const PER_POINT = {
  might: 1.5, // +melee damage, flat
  mastery: 0.04, // +4% damage with a weapon of that type
  vitality: 8, // +max HP
  bloodflow: 0.6, // +HP regen per second
  swiftness: 0.03, // +3% move speed
  fang: 0.005, // +0.5% lifesteal
  hunger: 0.05, // +5% blood from kills
  shade: 0.02, // -2% damage taken
}

export const POINTS_PER_LEVEL = 1

export function zeroAttrs(): Record<Attr, number> {
  return Object.fromEntries(ATTRS.map((a) => [a, 0])) as Record<Attr, number>
}

/** The mastery the equipped weapon trains: claws, blade (dagger, sword), or blunt (mace). */
export function weaponType(save: SaveData): WeaponType {
  return WEAPONS[save.weapon].mastery
}

export function attrPointsLeft(save: SaveData): number {
  const spent = ATTRS.reduce((sum, a) => sum + save.attrs[a], 0)
  return Math.max(0, (save.level - 1) * POINTS_PER_LEVEL - spent)
}

export interface AttrStats {
  /** Base + bonus per attribute. */
  level: Record<Attr, number>
  meleeFlat: number
  /** Damage multiplier for the equipped weapon type only. */
  masteryMult: number
  hpFlat: number
  regenFlat: number
  speedMult: number
  lifesteal: number
  bloodMult: number
  /** Multiplier on damage taken, after armor. */
  guard: number
}

/** The one function that turns base + bonus into gameplay numbers. */
export function effectiveAttrs(save: SaveData): AttrStats {
  const level = {} as Record<Attr, number>
  for (const a of ATTRS) level[a] = ATTR_BASE[a] + save.attrs[a]
  return {
    level,
    meleeFlat: level.might * PER_POINT.might,
    masteryMult: 1 + level[weaponType(save)] * PER_POINT.mastery,
    hpFlat: level.vitality * PER_POINT.vitality,
    regenFlat: level.bloodflow * PER_POINT.bloodflow,
    speedMult: Math.min(1.6, 1 + level.swiftness * PER_POINT.swiftness),
    lifesteal: level.fang * PER_POINT.fang,
    bloodMult: 1 + level.hunger * PER_POINT.hunger,
    guard: Math.max(0.5, 1 - level.shade * PER_POINT.shade),
  }
}

/** Folds attributes into the combat profile. Called once, at the end of `profile()`. */
export function applyAttributes(prof: CombatProfile, save: SaveData): CombatProfile {
  const fx = effectiveAttrs(save)
  return {
    ...prof,
    dmg: (prof.dmg + fx.meleeFlat) * fx.masteryMult,
    hp: prof.hp + fx.hpFlat,
    regen: prof.regen + fx.regenFlat,
    speed: prof.speed * fx.speedMult,
    lifesteal: Math.min(0.35, prof.lifesteal + fx.lifesteal),
    bloodMult: fx.bloodMult,
    guard: fx.guard,
  }
}

/** Short effect text for the menu, e.g. "+4.5 dmg". */
export function attrEffect(attr: Attr, fx: AttrStats): string {
  const n = fx.level[attr]
  const pct = (v: number) => `${Math.round(v * 100)}%`
  if (attr === 'might') return `+${fx.meleeFlat.toFixed(1)} dmg`
  if (attr === 'blade' || attr === 'blunt' || attr === 'claws') return `+${pct(n * PER_POINT.mastery)} ${attr}`
  if (attr === 'vitality') return `+${fx.hpFlat} HP`
  if (attr === 'bloodflow') return `+${fx.regenFlat.toFixed(1)}/s`
  if (attr === 'swiftness') return `+${pct(fx.speedMult - 1)} spd`
  if (attr === 'fang') return `${(fx.lifesteal * 100).toFixed(1)}% steal`
  if (attr === 'hunger') return `+${pct(fx.bloodMult - 1)} blood`
  return `-${pct(1 - fx.guard)} taken`
}
