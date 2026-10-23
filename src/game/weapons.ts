import type { WeaponType } from './attributes'
import type { ClawTier, ClawTierId } from './balance'

/**
 * The hero's weapon classes. Each one trains a mastery attribute, holds its
 * own KayKit mesh, and nudges the swing. The weapon slot's level and tier
 * (Teethling, Bloodied, Elder, Ancient) are shared by every class.
 */
export type WeaponKind = 'claws' | 'dagger' | 'sword' | 'mace'

export const WEAPON_KINDS: WeaponKind[] = ['claws', 'dagger', 'sword', 'mace']

export interface WeaponDef {
  kind: WeaponKind
  /** Name after the tier word, e.g. "Teethling Claws". */
  noun: string
  /** The attribute that scales this weapon's damage. */
  mastery: WeaponType
  /** Gear-menu class line. */
  label: string
  blurb: string
  /** Hit damage, swing time, and crit chance next to the claws. */
  dmg: number
  interval: number
  crit: number
}

export const WEAPONS: Record<WeaponKind, WeaponDef> = {
  claws: {
    kind: 'claws',
    noun: 'Claws',
    mastery: 'claws',
    label: 'Claws',
    blurb: 'Knuckle claws. The even, steady hunt.',
    dmg: 1,
    interval: 1,
    crit: 0,
  },
  dagger: {
    kind: 'dagger',
    noun: 'Dagger',
    mastery: 'blade',
    label: 'Blade · Dagger',
    blurb: 'Quick and light. Finds the vein more often.',
    dmg: 0.86,
    interval: 0.88,
    crit: 0.06,
  },
  sword: {
    kind: 'sword',
    noun: 'Sword',
    mastery: 'blade',
    label: 'Blade · Sword',
    blurb: 'Longer reach of steel. A heavier cut.',
    dmg: 1.12,
    interval: 1.08,
    crit: 0.02,
  },
  mace: {
    kind: 'mace',
    noun: 'Mace',
    mastery: 'blunt',
    label: 'Blunt · Mace',
    blurb: 'A gnawed bone club. Slow, and it lands hard.',
    dmg: 1.32,
    interval: 1.24,
    crit: 0,
  },
}

/** The item tier of the four starter weapons: Teethling, the white tier. */
export const STARTER_TIER: ClawTierId = 'teethling'

export function weaponName(kind: WeaponKind, tier: ClawTier): string {
  return `${tier.label} ${WEAPONS[kind].noun}`
}

/** Short trade-offs against the claws, e.g. "+32% hit · 24% slower". Empty for the claws. */
export function weaponTraits(kind: WeaponKind): string {
  const w = WEAPONS[kind]
  const pct = (v: number) => Math.round(Math.abs(v) * 100)
  const out: string[] = []
  if (w.dmg !== 1) out.push(`${w.dmg > 1 ? '+' : '−'}${pct(w.dmg - 1)}% hit`)
  if (w.interval !== 1) out.push(`${pct(w.interval - 1)}% ${w.interval < 1 ? 'faster' : 'slower'}`)
  if (w.crit > 0) out.push(`+${pct(w.crit)}% crit`)
  return out.join(' · ')
}

export function isWeaponKind(v: unknown): v is WeaponKind {
  return typeof v === 'string' && (WEAPON_KINDS as string[]).includes(v)
}
