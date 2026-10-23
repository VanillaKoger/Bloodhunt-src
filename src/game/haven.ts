import type { Currency, Purse } from './nights'

/**
 * The Haven: a walled courtyard east of the Slums where every night starts
 * and ends. It holds the practice range, the Night Gate, the Blood Altar,
 * and the works: small upgrades bought level by level with the materials
 * brought home from the hunt. The wardrobe sells looks for the same coin.
 */

/** Courtyard bounds. The hero can walk anywhere inside and nowhere out. */
export const HAVEN = { x: 80, z: -20, minX: 71.2, maxX: 88.8, minZ: -28.8, maxZ: -11.2 }

/** Where the hero stands on arriving, facing the gate. */
export const HAVEN_START = { x: 80, z: -18.2 }

export type StationId = 'gate' | 'altar' | 'armory' | 'wardrobe' | WorkId

/** Interact spots in the courtyard. Walk up to one and press the prompt. */
export interface StationDef {
  id: StationId
  label: string
  x: number
  z: number
  /** What the prompt says. */
  verb: string
}

export type WorkId = 'forge' | 'font' | 'still' | 'locker' | 'ossuary'

export const WORK_IDS: WorkId[] = ['forge', 'font', 'still', 'locker', 'ossuary']

// The far walls (west and north, away from the camera) carry the tall pieces;
// the low works stand along the near fences, where they never hide the hero.
export const STATIONS: StationDef[] = [
  { id: 'gate', label: 'Night Gate', x: 80, z: -29.1, verb: 'Hunt' },
  { id: 'wardrobe', label: 'Wardrobe', x: 75.2, z: -27.4, verb: 'Dress' },
  { id: 'altar', label: 'Blood Altar', x: 84.6, z: -27.2, verb: 'Pray' },
  { id: 'armory', label: 'Armory', x: 87.7, z: -27.0, verb: 'Gear' },
  { id: 'forge', label: 'Bone Forge', x: 87.6, z: -22.4, verb: 'Work' },
  { id: 'font', label: 'Blood Font', x: 87.6, z: -18.4, verb: 'Work' },
  { id: 'still', label: 'Bile Still', x: 87.6, z: -14.4, verb: 'Work' },
  { id: 'locker', label: 'Brass Coffer', x: 84.0, z: -12.4, verb: 'Work' },
  { id: 'ossuary', label: 'Ossuary', x: 79.4, z: -12.4, verb: 'Work' },
]

/** Practice dummies on the range along the west wall. They never fall for good. */
export const RANGE_SPOTS: { x: number; z: number; armor: number; label: string }[] = [
  { x: 73.4, z: -23.6, armor: 0, label: 'Bare' },
  { x: 73.4, z: -19.6, armor: 12, label: 'Mailed' },
  { x: 73.4, z: -15.6, armor: 30, label: 'Plated' },
]

/** Seconds of hits the range readout averages over. */
export const DPS_WINDOW = 5

/** Stand this close to a station for the prompt. */
export const STATION_REACH = 1.6

export interface WorkDef {
  id: WorkId
  label: string
  /** One line about what a level does. */
  blurb: string
  /** Effect text at a level. */
  effect: (level: number) => string
  /** Cost of level 1. Later levels grow as (level + 1) ^ WORK_POW. */
  base: Partial<Purse>
  max: number
}

export const WORK_MAX = 30
export const WORK_POW = 1.6

/** Bonus per level of each work. */
export const WORK_STEP: Record<WorkId, number> = {
  forge: 0.01,
  font: 0.015,
  still: 0.015,
  locker: 0.015,
  ossuary: 0.002,
}

const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`

export const WORKS: Record<WorkId, WorkDef> = {
  forge: {
    id: 'forge',
    label: 'Bone Forge',
    blurb: 'Hones every weapon on bone and brass.',
    effect: (l) => `+${pct(l * WORK_STEP.forge, 1)} weapon damage`,
    base: { bone: 4, brass: 3 },
    max: WORK_MAX,
  },
  font: {
    id: 'font',
    label: 'Blood Font',
    blurb: 'Bile cut with blood, drunk before the gate.',
    effect: (l) => `+${pct(l * WORK_STEP.font, 1)} max HP`,
    base: { bile: 4, blood: 60 },
    max: WORK_MAX,
  },
  still: {
    id: 'still',
    label: 'Bile Still',
    blurb: 'Distils the plague into the blood powers.',
    effect: (l) => `+${pct(l * WORK_STEP.still, 1)} skill damage`,
    base: { bile: 3, bone: 3 },
    max: WORK_MAX,
  },
  locker: {
    id: 'locker',
    label: 'Brass Coffer',
    blurb: 'Deeper pockets for the night\'s Blood.',
    effect: (l) => `+${pct(l * WORK_STEP.locker, 1)} Blood from kills`,
    base: { brass: 3, bile: 2 },
    max: WORK_MAX,
  },
  ossuary: {
    id: 'ossuary',
    label: 'Ossuary',
    blurb: 'Studies where the bones of the living give.',
    effect: (l) => `+${pct(l * WORK_STEP.ossuary, 1)} crit chance`,
    base: { bone: 5, brass: 2 },
    max: WORK_MAX,
  },
}

/** What the next level of a work costs from `level`. */
export function workCost(id: WorkId, level: number): Partial<Purse> {
  const out: Partial<Purse> = {}
  for (const [k, v] of Object.entries(WORKS[id].base) as [Currency, number][]) {
    out[k] = Math.round(v * Math.pow(level + 1, WORK_POW))
  }
  return out
}

export function canAfford(purse: Purse, cost: Partial<Purse>): boolean {
  return (Object.entries(cost) as [Currency, number][]).every(([k, v]) => purse[k] >= v)
}

export type LookSlot = 'cape' | 'eyes' | 'trail'

export const LOOK_SLOTS: LookSlot[] = ['cape', 'eyes', 'trail']

export const LOOK_SLOT_LABEL: Record<LookSlot, string> = { cape: 'Cape dye', eyes: 'Eye glow', trail: 'Strike trail' }

export interface CosmeticDef {
  id: string
  slot: LookSlot
  label: string
  color: number
  /** Empty for the look the hero starts in. */
  cost: Partial<Purse>
}

export const COSMETICS: CosmeticDef[] = [
  { id: 'cape-crimson', slot: 'cape', label: 'Crimson', color: 0x9c1630, cost: {} },
  { id: 'cape-midnight', slot: 'cape', label: 'Midnight', color: 0x1e2c6e, cost: { bile: 8, brass: 6 } },
  { id: 'cape-bone', slot: 'cape', label: 'Bone White', color: 0xe6dcc4, cost: { bone: 16 } },
  { id: 'cape-plague', slot: 'cape', label: 'Plague Green', color: 0x3e6a1c, cost: { bile: 18 } },
  { id: 'cape-royal', slot: 'cape', label: 'Royal Violet', color: 0x5a1a8a, cost: { brass: 14, vitae: 4 } },
  { id: 'cape-gilded', slot: 'cape', label: 'Gilded', color: 0xc8922a, cost: { brass: 30, ichor: 6 } },
  { id: 'eyes-blood', slot: 'eyes', label: 'Blood Red', color: 0xff1a3a, cost: {} },
  { id: 'eyes-gold', slot: 'eyes', label: 'Gold', color: 0xffc23a, cost: { brass: 10 } },
  { id: 'eyes-frost', slot: 'eyes', label: 'Frost', color: 0x6ad8ff, cost: { bone: 10, bile: 4 } },
  { id: 'eyes-venom', slot: 'eyes', label: 'Venom', color: 0x9cff3a, cost: { bile: 12 } },
  { id: 'eyes-void', slot: 'eyes', label: 'Void', color: 0xb45cff, cost: { ichor: 4, vitae: 4 } },
  { id: 'trail-pale', slot: 'trail', label: 'Tier Glow', color: 0xffe4ee, cost: {} },
  { id: 'trail-crimson', slot: 'trail', label: 'Crimson', color: 0xff2a4a, cost: { bile: 6, bone: 6 } },
  { id: 'trail-gold', slot: 'trail', label: 'Gold', color: 0xffc860, cost: { brass: 16 } },
  { id: 'trail-frost', slot: 'trail', label: 'Frost', color: 0x7ae0ff, cost: { bone: 14 } },
  { id: 'trail-shadow', slot: 'trail', label: 'Shadow', color: 0x7a3aff, cost: { ichor: 5, vitae: 3 } },
]

export const DEFAULT_LOOK: Record<LookSlot, string> = { cape: 'cape-crimson', eyes: 'eyes-blood', trail: 'trail-pale' }

export function cosmetic(id: string): CosmeticDef | undefined {
  return COSMETICS.find((c) => c.id === id)
}
