import { DISTRICT_IDS, TIER_COUNT, tierIndex, zoneName, type DistrictId, type Purse } from './nights'
import { MAPS, MAP_IDS, ZONE_COUNT, mapIndex, type MapId } from './maps'
import type { SaveData } from './types'

/**
 * Marks: the bonus objectives that open the way forward. Every zone of
 * every map has three. One is always "get out N times in this zone"; the
 * other two ask for something harder in a single night, and the last zone's
 * always asks for the map's boss. A mark only counts when the hero extracts
 * with it: falling or meeting the dawn keeps nothing. Clearing all three
 * opens the next zone (or, from the last zone, puts the next map in reach),
 * and each mark pays out once (Vitae, Ichor, and materials).
 *
 * The Omen is one more mark that changes every day, for the hunter who comes
 * back each night.
 */

export type MarkKind = 'extract' | 'kills' | 'elites' | 'king' | 'haul' | 'unbroken' | 'pods' | 'frenzy' | 'swift'

export interface MarkDef {
  kind: MarkKind
  /** Count the kind asks for: extractions, kills, elites, Blood carried, pods, or kills before 3:00. */
  n: number
}

/** What a night did, read when the hero gets out. */
export interface NightTally {
  kills: number
  elites: number
  /** Slums pods wiped out. */
  pods: number
  /** The district's boss fell this night. */
  king: boolean
  /** Lowest HP share the hero dropped to. */
  minHp: number
  /** Frenzy reached its cap at some point. */
  frenzied: boolean
  /** Kills made in the first three minutes. */
  early: number
  blood: number
}

/** Bumped when the marks change shape, so a save from before starts its marks over. */
export const MARKS_VERSION = 2

export function emptyTally(): NightTally {
  return { kills: 0, elites: 0, pods: 0, king: false, minHp: 1, frenzied: false, early: 0, blood: 0 }
}

/** Above this HP share the whole night counts as unbroken. */
export const UNBROKEN = 0.5
/** The "swift" mark counts kills made before this many seconds. */
export const SWIFT_SECONDS = 180

/**
 * Each map's own bonus objectives, so no two maps ask the same things in the
 * same order: [Zone 1's second mark, Zone 2's two, Zone 3's second]. Zone 1
 * always asks for a kill count too, and Zone 3 always for the boss.
 */
const MARK_PLAN: Record<MapId, [MarkKind, MarkKind, MarkKind, MarkKind]> = {
  slums: ['haul', 'elites', 'pods', 'unbroken'],
  mob: ['elites', 'kills', 'unbroken', 'pods'],
  docks: ['pods', 'elites', 'swift', 'unbroken'],
  market: ['swift', 'kills', 'pods', 'elites'],
  wilds: ['swift', 'pods', 'unbroken', 'frenzy'],
  graves: ['elites', 'unbroken', 'frenzy', 'swift'],
  manor: ['unbroken', 'frenzy', 'elites', 'pods'],
  cathedral: ['pods', 'swift', 'unbroken', 'elites'],
  catacombs: ['frenzy', 'elites', 'swift', 'unbroken'],
  spire: ['unbroken', 'frenzy', 'elites', 'swift'],
}

/** A mark's count at a tier: deeper zones ask for more. */
function sized(kind: MarkKind, tier: number): MarkDef {
  switch (kind) {
    case 'extract':
      return { kind, n: 4 + Math.floor(tier * 0.45) }
    case 'kills':
      return { kind, n: 28 + tier }
    case 'elites':
      return { kind, n: 2 + Math.floor(tier / 7) }
    case 'pods':
      return { kind, n: 6 + Math.floor(tier / 6) }
    case 'swift':
      return { kind, n: 22 + Math.floor(tier / 2) }
    case 'haul':
      return { kind, n: 300 + tier * 150 }
    default:
      return { kind, n: 1 }
  }
}

function marksFor(id: MapId): MarkDef[][] {
  const plan = MARK_PLAN[id]
  const t = (zone: number) => tierIndex(id, zone)
  return [
    [sized('extract', t(0)), sized('kills', t(0)), sized(plan[0], t(0))],
    [sized('extract', t(1)), sized(plan[1], t(1)), sized(plan[2], t(1))],
    [sized('extract', t(2)), sized('king', t(2)), sized(plan[3], t(2))],
  ]
}

/** [map][zone] → three marks. The first is always the extraction count. */
export const MARKS: Record<DistrictId, MarkDef[][]> = Object.fromEntries(MAP_IDS.map((id) => [id, marksFor(id)])) as Record<DistrictId, MarkDef[][]>

export function markText(def: MarkDef, district: DistrictId): string {
  switch (def.kind) {
    case 'extract':
      return `Get out ${def.n} times`
    case 'kills':
      return `Slay ${def.n} in one night`
    case 'elites':
      return `Slay ${def.n} elites in one night`
    case 'king':
      return `Slay ${MAPS[district].boss.name.replace(/^The /, 'the ')}`
    case 'haul':
      return `Get out carrying ${def.n.toLocaleString('en-US')} Blood`
    case 'unbroken':
      return `Get out never below ${Math.round(UNBROKEN * 100)}% HP`
    case 'pods':
      return `Wipe out ${def.n} pods in one night`
    case 'frenzy':
      return 'Reach full Frenzy'
    case 'swift':
      return `Slay ${def.n} before 3:00`
  }
}

/** True when a night's tally meets a one-night mark. Extraction counts are kept apart. */
export function tallyMeets(def: MarkDef, t: NightTally): boolean {
  switch (def.kind) {
    case 'extract':
      return true
    case 'kills':
      return t.kills >= def.n
    case 'elites':
      return t.elites >= def.n
    case 'king':
      return t.king
    case 'haul':
      return t.blood >= def.n
    case 'unbroken':
      return t.minHp >= UNBROKEN
    case 'pods':
      return t.pods >= def.n
    case 'frenzy':
      return t.frenzied
    case 'swift':
      return t.early >= def.n
  }
}

export function markKey(district: DistrictId, danger: number, index: number): string {
  return `${district}.${danger}.${index}`
}

/** Progress on one mark: extraction marks count up, the rest are 0 or 1. */
export function markHave(save: SaveData, district: DistrictId, danger: number, index: number): number {
  return save.marks[markKey(district, danger, index)] ?? 0
}

export function markDone(save: SaveData, district: DistrictId, danger: number, index: number): boolean {
  const def = MARKS[district][danger][index]
  return markHave(save, district, danger, index) >= (def.kind === 'extract' ? def.n : 1)
}

export function dangerCleared(save: SaveData, district: DistrictId, danger: number): boolean {
  return MARKS[district][danger].every((_, i) => markDone(save, district, danger, i))
}

/** One-time payout for clearing a mark. Deeper zones pay more. */
export function markReward(district: DistrictId, zone: number): Partial<Purse> {
  const t = tierIndex(district, zone)
  return {
    vitae: 3 + t,
    ichor: 2 + Math.round(t * 1.2),
    bone: 10 + t * 5,
    bile: 10 + t * 5,
    brass: 10 + t * 5,
  }
}

export interface MarkResult {
  district: DistrictId
  danger: number
  index: number
  text: string
  reward: Partial<Purse>
}

/**
 * Scores an extraction against the marks of the night's district and danger.
 * Writes progress to the save and returns the marks it finished (rewards not
 * yet paid). Opens the next danger when all three are done.
 */
export function scoreMarks(save: SaveData, district: DistrictId, danger: number, t: NightTally): { done: MarkResult[]; opened: number | null } {
  const done: MarkResult[] = []
  MARKS[district][danger].forEach((def, index) => {
    if (markDone(save, district, danger, index)) return
    const key = markKey(district, danger, index)
    if (def.kind === 'extract') save.marks[key] = (save.marks[key] ?? 0) + 1
    else if (tallyMeets(def, t)) save.marks[key] = 1
    if (markDone(save, district, danger, index)) {
      done.push({ district, danger, index, text: markText(def, district), reward: markReward(district, danger) })
    }
  })
  let opened: number | null = null
  if (dangerCleared(save, district, danger) && danger < ZONE_COUNT - 1 && save.danger[district] <= danger) {
    save.danger[district] = danger + 1
    opened = danger + 1
  }
  return { done, opened }
}

export interface GateLine {
  text: string
  done: boolean
}

/**
 * What a map still asks before it opens: the last zone of the map before it
 * cleared, and that map's boss put down a few times. Empty when it is open.
 */
export function districtGate(save: SaveData, district: DistrictId): GateLine[] {
  const i = mapIndex(district)
  if (i <= 0) return []
  const prev = MAP_IDS[i - 1]
  const def = MAPS[prev]
  const kills = save.bosses[prev] ?? 0
  const lines = [
    { text: `Clear the marks of ${def.label}: ${zoneName(prev, ZONE_COUNT - 1)}`, done: dangerCleared(save, prev, ZONE_COUNT - 1) },
    { text: `Slay ${def.boss.name.replace(/^The /, 'the ')} ${def.bossGate} times (${Math.min(kills, def.bossGate)}/${def.bossGate})`, done: kills >= def.bossGate },
  ]
  return lines.every((l) => l.done) ? [] : lines
}

export function districtOpen(save: SaveData, district: DistrictId): boolean {
  return districtGate(save, district).length === 0
}

/** Every mark of every danger in every district: the peak of the climb. */
export function marksTotal(): number {
  return Object.values(MARKS).reduce((sum, list) => sum + list.length * 3, 0)
}

export function marksCleared(save: SaveData): number {
  let n = 0
  for (const district of Object.keys(MARKS) as DistrictId[]) {
    MARKS[district].forEach((list, danger) => list.forEach((_, i) => (n += markDone(save, district, danger, i) ? 1 : 0)))
  }
  return n
}

export interface Omen {
  day: string
  def: MarkDef
  reward: Partial<Purse>
}

/** Local calendar day, so the Omen turns over at the hunter's own midnight. */
export function dayKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const OMEN_KINDS: MarkKind[] = ['kills', 'elites', 'unbroken', 'frenzy', 'swift', 'kills', 'elites']

/** The deepest tier open anywhere. */
export function bestTier(save: SaveData): number {
  let best = 0
  for (const id of DISTRICT_IDS) if (districtOpen(save, id)) best = Math.max(best, tierIndex(id, save.danger[id]))
  return Math.min(TIER_COUNT - 1, best)
}

/** Today's Omen. It reads the same all day, and is scaled to the deepest tier open anywhere. */
export function omenFor(save: SaveData, day = dayKey()): Omen {
  const tier = bestTier(save)
  const best = tier / 6
  let hash = 0
  for (const ch of day) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const kind = OMEN_KINDS[hash % OMEN_KINDS.length]
  const def = kind === 'kills' || kind === 'elites' || kind === 'swift' ? sized(kind, tier) : { kind, n: 1 }
  return {
    day,
    def,
    reward: {
      vitae: Math.round(3 + best * 2),
      ichor: Math.round(2 + best * 2.5),
      bone: Math.round(8 + best * 6),
      bile: Math.round(8 + best * 6),
      brass: Math.round(8 + best * 6),
    },
  }
}

/** The Omen counts once a day, in any zone within three tiers of the deepest one open. */
export function omenCounts(save: SaveData, omen: Omen, district: DistrictId, danger: number): boolean {
  return save.omenDay !== omen.day && tierIndex(district, danger) >= bestTier(save) - 3
}
