import type { WeaponType } from './attributes'
import type { ClawTier } from './balance'

/**
 * The hero's weapon classes. Each one trains a mastery attribute, holds its
 * own KayKit mesh and attack clips, and nudges the swing. The weapon slot's
 * level and tier (Teethling, Kindred, Awakened, Ascendent, Immortal) are
 * shared by every class; kill ranks inside a tier are kept per class.
 */
export type WeaponKind = 'claws' | 'dagger' | 'sword' | 'mace'

export const WEAPON_KINDS: WeaponKind[] = ['claws', 'dagger', 'sword', 'mace']

/**
 * One KayKit attack clip and where it lands, in clip seconds. The clip
 * plays at its weapon's `rate`, and the next swing starts the moment this
 * one is back on guard, so the attack speed is the animation's own.
 */
export interface SwingDef {
  clip: string
  /** The frame the weapon meets the target. The hit resolves here. */
  contact: number
  /** Back on guard. The rest of the clip only plays while it fades out. */
  ready: number
}

export interface WeaponDef {
  kind: WeaponKind
  /** Name after the tier word, e.g. "Teethling Claws". */
  noun: string
  /** The attribute that scales this weapon's damage. */
  mastery: WeaponType
  /** Gear-menu class line. */
  label: string
  blurb: string
  /** Hit damage and crit chance next to the claws. */
  dmg: number
  crit: number
  /**
   * Clip seconds per second for this weapon's swings. The only source of
   * attack speed: a swing lasts `ready / rate`, whatever the hero's stats.
   */
  rate: number
  /** Played in turn, one per attack. */
  swings: SwingDef[]
  /** Extra hit reach in meters. */
  reach: number
  /** Smallest facing dot a target can sit at and still be hit. Lower is a wider arc. */
  arc: number
  /** Poise damage next to the claws: how fast it staggers. Hits never push. */
  poise: number
  /** How far the body leans into the strike, next to the dagger's stab. */
  lunge: number
}

export const WEAPONS: Record<WeaponKind, WeaponDef> = {
  claws: {
    kind: 'claws',
    noun: 'Claws',
    mastery: 'claws',
    label: 'Claws',
    blurb: 'Knuckle claws. The even, steady hunt.',
    dmg: 1,
    crit: 0,
    rate: 1.7,
    swings: [{ clip: 'Melee_Unarmed_Attack_Punch_A', contact: 0.46, ready: 0.88 }],
    reach: 0,
    arc: 0.15,
    poise: 1,
    lunge: 0.7,
  },
  dagger: {
    kind: 'dagger',
    noun: 'Dagger',
    mastery: 'blade',
    label: 'Blade · Dagger',
    blurb: 'Quick and light. Finds the vein more often.',
    dmg: 0.86,
    crit: 0.06,
    rate: 1.7,
    swings: [{ clip: 'Melee_1H_Attack_Stab', contact: 0.42, ready: 0.78 }],
    reach: 0.1,
    arc: 0.45,
    poise: 0.8,
    lunge: 1,
  },
  sword: {
    kind: 'sword',
    noun: 'Sword',
    mastery: 'blade',
    label: 'Blade · Sword',
    blurb: 'Longer reach of steel. A heavier cut.',
    dmg: 1.12,
    crit: 0.02,
    rate: 1.35,
    swings: [
      { clip: 'Melee_1H_Attack_Slice_Diagonal', contact: 0.45, ready: 0.8 },
      { clip: 'Melee_1H_Attack_Slice_Horizontal', contact: 0.28, ready: 0.7 },
    ],
    reach: 0.3,
    arc: -0.1,
    poise: 1.1,
    lunge: 0.55,
  },
  mace: {
    kind: 'mace',
    noun: 'Mace',
    mastery: 'blunt',
    label: 'Blunt · Mace',
    blurb: 'A gnawed bone club. Slow, and it lands hard.',
    dmg: 1.32,
    crit: 0,
    rate: 1.45,
    swings: [{ clip: 'Melee_1H_Attack_Chop', contact: 0.6, ready: 0.95 }],
    reach: 0.15,
    arc: 0.2,
    poise: 1.7,
    lunge: 0.45,
  },
}

/** Seconds one swing takes: wind-up, strike, and back on guard. */
export function swingTime(kind: WeaponKind, swing: SwingDef): number {
  return swing.ready / WEAPONS[kind].rate
}

/** Mean seconds between hits over the weapon's swing set. */
export function weaponInterval(kind: WeaponKind): number {
  const swings = WEAPONS[kind].swings
  return swings.reduce((sum, sw) => sum + swingTime(kind, sw), 0) / swings.length
}

export function weaponName(kind: WeaponKind, tier: ClawTier): string {
  return `${tier.label} ${WEAPONS[kind].noun}`
}

/** Short trade-offs against the claws, e.g. "+32% hit · 24% slower". Empty for the claws. */
export function weaponTraits(kind: WeaponKind): string {
  const w = WEAPONS[kind]
  const pct = (v: number) => Math.round(Math.abs(v) * 100)
  const out: string[] = []
  const pace = weaponInterval(kind) / weaponInterval('claws')
  if (w.dmg !== 1) out.push(`${w.dmg > 1 ? '+' : '−'}${pct(w.dmg - 1)}% hit`)
  if (Math.abs(pace - 1) >= 0.01) out.push(`${pct(pace - 1)}% ${pace < 1 ? 'faster' : 'slower'}`)
  if (w.crit > 0) out.push(`+${pct(w.crit)}% crit`)
  if (w.arc < 0) out.push('wide arc')
  if (w.poise > 1.3) out.push('staggers fast')
  return out.join(' · ')
}

export function isWeaponKind(v: unknown): v is WeaponKind {
  return typeof v === 'string' && (WEAPON_KINDS as string[]).includes(v)
}
