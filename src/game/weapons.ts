import type { WeaponType } from './attributes'
import type { ClawTier, ClawTierId } from './balance'

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
 * plays at one even rate, `ready / interval`, so it finishes its strike
 * and is back on guard as the next swing is due.
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
  /** Hit damage, swing time, and crit chance next to the claws. */
  dmg: number
  interval: number
  crit: number
  /** Played in turn, one per attack. */
  swings: SwingDef[]
  /** Extra hit reach in meters. */
  reach: number
  /** Smallest facing dot a target can sit at and still be hit. Lower is a wider arc. */
  arc: number
  /** Knockback next to the claws. */
  knock: number
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
    interval: 1,
    crit: 0,
    swings: [{ clip: 'Melee_Unarmed_Attack_Punch_A', contact: 0.46, ready: 0.88 }],
    reach: 0,
    arc: 0.15,
    knock: 1,
    lunge: 0.7,
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
    swings: [{ clip: 'Melee_1H_Attack_Stab', contact: 0.42, ready: 0.78 }],
    reach: 0.1,
    arc: 0.45,
    knock: 0.7,
    lunge: 1,
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
    swings: [
      { clip: 'Melee_1H_Attack_Slice_Diagonal', contact: 0.45, ready: 0.8 },
      { clip: 'Melee_1H_Attack_Slice_Horizontal', contact: 0.28, ready: 0.7 },
    ],
    reach: 0.3,
    arc: -0.1,
    knock: 1,
    lunge: 0.55,
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
    swings: [{ clip: 'Melee_1H_Attack_Chop', contact: 0.6, ready: 0.95 }],
    reach: 0.15,
    arc: 0.2,
    knock: 1.6,
    lunge: 0.45,
  },
}

/** The item tier of the four starter weapons: Teethling, the grey tier. */
export const STARTER_TIER: ClawTierId = 'teethling'

/** Clip playback rate for one swing: back on guard exactly as the next one is due. */
export function swingRate(swing: SwingDef, interval: number): number {
  return Math.max(0.8, Math.min(2.4, swing.ready / Math.max(0.05, interval)))
}

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
  if (w.arc < 0) out.push('wide arc')
  if (w.knock > 1) out.push('heavy knockback')
  return out.join(' · ')
}

export function isWeaponKind(v: unknown): v is WeaponKind {
  return typeof v === 'string' && (WEAPON_KINDS as string[]).includes(v)
}
