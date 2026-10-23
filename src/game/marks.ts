import { DANGERS, type DistrictId, type Purse } from './nights'
import type { SaveData } from './types'

/**
 * Marks: the bonus objectives that open the way forward. Every danger of
 * every district has three. One is always "get out N times at this danger";
 * the other two ask for something harder in a single night. A mark only
 * counts when the hero extracts with it: falling or meeting the dawn keeps
 * nothing. Clearing all three opens the next danger, and paying them off
 * pays out once (Vitae, Ichor, and materials).
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

export function emptyTally(): NightTally {
  return { kills: 0, elites: 0, pods: 0, king: false, minHp: 1, frenzied: false, early: 0, blood: 0 }
}

/** Above this HP share the whole night counts as unbroken. */
export const UNBROKEN = 0.5
/** The "swift" mark counts kills made before this many seconds. */
export const SWIFT_SECONDS = 180

const m = (kind: MarkKind, n = 1): MarkDef => ({ kind, n })

/** [district][danger] → three marks. The first is always the extraction count. */
export const MARKS: Record<DistrictId, MarkDef[][]> = {
  slums: [
    [m('extract', 3), m('kills', 30), m('haul', 300)],
    [m('extract', 8), m('king'), m('elites', 3)],
    [m('extract', 8), m('pods', 10), m('unbroken')],
    [m('extract', 12), m('king'), m('frenzy')],
    [m('extract', 16), m('elites', 6), m('swift', 36)],
  ],
  mob: [
    [m('extract', 4), m('king'), m('kills', 40)],
    [m('extract', 6), m('elites', 4), m('kills', 55)],
    [m('extract', 9), m('king'), m('unbroken')],
    [m('extract', 13), m('frenzy'), m('elites', 6)],
    [m('extract', 18), m('king'), m('swift', 38)],
  ],
}

const BOSS: Record<DistrictId, string> = { slums: 'the Rat King', mob: 'the Don' }

export function markText(def: MarkDef, district: DistrictId): string {
  switch (def.kind) {
    case 'extract':
      return `Get out ${def.n} times`
    case 'kills':
      return `Slay ${def.n} in one night`
    case 'elites':
      return `Slay ${def.n} elites in one night`
    case 'king':
      return `Slay ${BOSS[district]}`
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

/** One-time payout for clearing a mark. Deeper marks pay more; the Mob District a little more again. */
export function markReward(district: DistrictId, danger: number): Partial<Purse> {
  const k = district === 'mob' ? 1.4 : 1
  return {
    vitae: Math.round((3 + danger * 3) * k),
    ichor: Math.round((2 + danger * 3) * k),
    bone: Math.round((10 + danger * 12) * k),
    bile: Math.round((10 + danger * 12) * k),
    brass: Math.round((10 + danger * 12) * k),
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
  if (dangerCleared(save, district, danger) && danger < DANGERS.length - 1 && save.danger[district] <= danger) {
    save.danger[district] = danger + 1
    opened = danger + 1
  }
  return { done, opened }
}

/** Kills of the Rat King it takes, with the Slums cleared through Danger III, before the Mob District lets the hero in. */
export const MOB_KING_KILLS = 5

export interface GateLine {
  text: string
  done: boolean
}

/** What a district still asks before it opens. Empty when it is open. */
export function districtGate(save: SaveData, district: DistrictId): GateLine[] {
  if (district === 'slums') return []
  const lines = [
    { text: 'Clear the marks of Slums Danger III', done: save.danger.slums >= 3 },
    { text: `Slay the Rat King ${MOB_KING_KILLS} times (${Math.min(save.bossKills, MOB_KING_KILLS)}/${MOB_KING_KILLS})`, done: save.bossKills >= MOB_KING_KILLS },
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

/** Today's Omen. It reads the same all day, and is scaled to the best danger open anywhere. */
export function omenFor(save: SaveData, day = dayKey()): Omen {
  const best = Math.max(save.danger.slums, save.danger.mob)
  let hash = 0
  for (const ch of day) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const kind = OMEN_KINDS[hash % OMEN_KINDS.length]
  const n = kind === 'kills' ? 35 + best * 5 : kind === 'elites' ? 2 + Math.floor(best / 2) : kind === 'swift' ? 30 + best * 4 : 1
  return {
    day,
    def: { kind, n },
    reward: {
      vitae: 3 + best * 2,
      ichor: 2 + best * 2,
      bone: 8 + best * 6,
      bile: 8 + best * 6,
      brass: 8 + best * 6,
    },
  }
}

/** The Omen counts once a day, in any district, at that district's highest open danger or the one below it. */
export function omenCounts(save: SaveData, omen: Omen, district: DistrictId, danger: number): boolean {
  return save.omenDay !== omen.day && danger >= Math.max(0, save.danger[district] - 1)
}
