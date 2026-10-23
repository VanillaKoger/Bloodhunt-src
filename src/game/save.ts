import { ATTRS, zeroAttrs } from './attributes'
import { CLAW_TIERS, LEVEL_CAP, OFFLINE_CAP_SEC, OFFLINE_FEEDS_PER_HOUR, OFFLINE_MIN_SEC, clawTier, grantXp } from './balance'
import { CURRENCIES, DISTRICT_IDS, RITES, RITE_IDS, RITE_STEP, POWER_MAX, TIERS, emptyPurse, type DistrictId, type Purse } from './nights'
import { ZONE_COUNT } from './maps'
import { COSMETICS, DEFAULT_LOOK, LOOK_SLOTS, WORK_IDS, WORK_MAX, type WorkId } from './haven'
import { MARKS_VERSION, bestTier, emptyTally, type NightTally } from './marks'
import type { NightSave, OfflineReport, SaveData, Stat, WeaponRank } from './types'
import { SKILLS, SLOTS, STATS } from './types'
import { WEAPON_KINDS, isWeaponKind, type WeaponKind } from './weapons'

const KEY = 'bloodhunt-save-v1'
const BAK = 'bloodhunt-save-v1-bak'

function freshRanks(): Record<WeaponKind, WeaponRank> {
  return Object.fromEntries(WEAPON_KINDS.map((k) => [k, { tier: 'teethling', rank: 0, kills: 0 }])) as Record<WeaponKind, WeaponRank>
}

export function freshSave(now = Date.now()): SaveData {
  const stacks = {} as Record<Stat, number>
  for (const s of STATS) stacks[s] = 0
  return {
    v: 1,
    blood: 0,
    ichor: 0,
    vitae: 0,
    bone: 0,
    bile: 0,
    brass: 0,
    works: Object.fromEntries(WORK_IDS.map((id) => [id, 0])) as Record<WorkId, number>,
    wardrobe: [],
    wear: { ...DEFAULT_LOOK },
    marks: {},
    marksV: MARKS_VERSION,
    omenDay: '',
    weaponTier: 'teethling',
    powers: { bats: 0, drain: 0, dash: 0, nova: 0 },
    rites: { night: 0, pact: 0, frenzy: 0, scent: 0, thrall: 0 },
    danger: Object.fromEntries(DISTRICT_IDS.map((id) => [id, 0])) as Record<DistrictId, number>,
    extracts: 0,
    night: null,
    stacks,
    attrs: zeroAttrs(),
    gear: { weapon: 1, cape: 1, coat: 1, boots: 1 },
    weapon: 'claws',
    weaponRanks: freshRanks(),
    evolved: { weapon: false, cape: false, coat: false, boots: false },
    level: 1,
    xp: 0,
    kills: 0,
    bosses: Object.fromEntries(DISTRICT_IDS.map((id) => [id, 0])) as Record<DistrictId, number>,
    mobKills: 0,
    killRate: 0,
    lastActiveAt: now,
    muted: false,
    seenHint: false,
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object'
}

function sanitize(raw: unknown): SaveData | null {
  if (!isRecord(raw) || raw.v !== 1) return null
  const base = freshSave()
  const num = (k: string, fallback: number) =>
    typeof raw[k] === 'number' && Number.isFinite(raw[k] as number) ? (raw[k] as number) : fallback
  base.blood = Math.max(0, num('blood', 0))
  base.level = Math.max(1, Math.min(LEVEL_CAP, Math.floor(num('level', 1))))
  base.xp = Math.max(0, num('xp', 0))
  base.kills = Math.max(0, Math.floor(num('kills', 0)))
  // Saves from before the ten maps kept the two bosses' falls on their own fields.
  base.bosses.slums = Math.max(0, Math.floor(num('bossKills', 0)))
  base.bosses.mob = Math.max(0, Math.floor(num('donKills', 0)))
  if (isRecord(raw.bosses)) for (const id of DISTRICT_IDS) base.bosses[id] = Math.max(0, Math.floor(Number(raw.bosses[id]) || 0))
  base.mobKills = Math.max(0, Math.floor(num('mobKills', 0)))
  base.killRate = Math.max(0, num('killRate', 0))
  base.lastActiveAt = num('lastActiveAt', Date.now())
  base.muted = raw.muted === true
  base.seenHint = raw.seenHint === true
  if (isRecord(raw.stacks)) {
    for (const s of STATS) {
      const v = raw.stacks[s]
      base.stacks[s] = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0
    }
  }
  if (isRecord(raw.attrs)) {
    for (const a of ATTRS) {
      const v = raw.attrs[a]
      base.attrs[a] = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0
    }
  }
  if (isRecord(raw.gear)) {
    for (const s of SLOTS) {
      const v = raw.gear[s]
      base.gear[s] = typeof v === 'number' && Number.isFinite(v) ? Math.max(1, Math.min(50, Math.floor(v))) : 1
    }
  }
  base.ichor = Math.max(0, Math.floor(num('ichor', 0)))
  base.vitae = Math.max(0, Math.floor(num('vitae', 0)))
  base.extracts = Math.max(0, Math.floor(num('extracts', 0)))
  base.bone = Math.max(0, Math.floor(num('bone', 0)))
  base.bile = Math.max(0, Math.floor(num('bile', 0)))
  base.brass = Math.max(0, Math.floor(num('brass', 0)))
  const int = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0)
  if (isRecord(raw.powers)) for (const id of SKILLS) base.powers[id] = int(raw.powers[id], POWER_MAX)
  if (isRecord(raw.rites)) for (const id of RITE_IDS) base.rites[id] = int(raw.rites[id], RITES[id].costs.length)
  // Marks moved from five dangers to three zones a map. Older saves start the marks over,
  // keeping the Slums open as deep as they had it.
  const zonesSave = raw.marksV === MARKS_VERSION
  if (isRecord(raw.danger)) for (const id of DISTRICT_IDS) base.danger[id] = int(raw.danger[id], ZONE_COUNT - 1)
  if (!zonesSave) for (const id of DISTRICT_IDS) if (id !== 'slums') base.danger[id] = 0
  if (isRecord(raw.works)) for (const id of WORK_IDS) base.works[id] = int(raw.works[id], WORK_MAX)
  if (isRecord(raw.marks) && zonesSave) {
    for (const [key, v] of Object.entries(raw.marks)) {
      const [id, zone, index] = key.split('.')
      if ((DISTRICT_IDS as string[]).includes(id) && /^[0-2]$/.test(zone) && /^[0-2]$/.test(index)) base.marks[key] = int(v, 99)
    }
  }
  base.marksV = MARKS_VERSION
  if (typeof raw.omenDay === 'string') base.omenDay = raw.omenDay.slice(0, 10)
  if (Array.isArray(raw.wardrobe)) {
    base.wardrobe = COSMETICS.filter((c) => (raw.wardrobe as unknown[]).includes(c.id)).map((c) => c.id)
  }
  if (isRecord(raw.wear)) {
    for (const slot of LOOK_SLOTS) {
      const id = raw.wear[slot]
      const look = COSMETICS.find((c) => c.id === id && c.slot === slot)
      if (look && (Object.keys(look.cost).length === 0 || base.wardrobe.includes(look.id))) base.wear[slot] = look.id
    }
  }
  // Saves from before Ichor earned their tier from the weapon's level; they keep it.
  const tier = CLAW_TIERS.find((t) => t.id === raw.weaponTier)
  base.weaponTier = tier ? tier.id : clawTier(base.gear.weapon).id
  base.night = readNight(raw.night)
  if (isWeaponKind(raw.weapon)) base.weapon = raw.weapon
  if (isRecord(raw.weaponRanks)) {
    for (const k of WEAPON_KINDS) {
      const r = raw.weaponRanks[k]
      if (!isRecord(r)) continue
      const tier = CLAW_TIERS.find((t) => t.id === r.tier)
      if (!tier) continue
      const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0)
      base.weaponRanks[k] = { tier: tier.id, rank: Math.min(tier.ranks, int(r.rank)), kills: int(r.kills) }
    }
  }
  if (isRecord(raw.evolved)) {
    for (const s of SLOTS) base.evolved[s] = raw.evolved[s] === true
  }
  return base
}

function readNight(raw: unknown): NightSave | null {
  if (!isRecord(raw)) return null
  const district = DISTRICT_IDS.find((id) => id === raw.district)
  if (!district) return null
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0)
  const carried: Purse = emptyPurse()
  if (isRecord(raw.carried)) for (const k of CURRENCIES) carried[k] = n(raw.carried[k])
  return {
    district,
    danger: Math.min(ZONE_COUNT - 1, Math.floor(n(raw.danger))),
    elapsed: n(raw.elapsed),
    carried,
    kills: Math.floor(n(raw.kills)),
    tally: readTally(raw.tally),
  }
}

function readTally(raw: unknown): NightTally {
  const t = emptyTally()
  if (!isRecord(raw)) return t
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0)
  t.kills = Math.floor(n(raw.kills))
  t.elites = Math.floor(n(raw.elites))
  t.pods = Math.floor(n(raw.pods))
  t.early = Math.floor(n(raw.early))
  t.king = raw.king === true
  t.frenzied = raw.frenzied === true
  t.minHp = typeof raw.minHp === 'number' && Number.isFinite(raw.minHp) ? Math.max(0, Math.min(1, raw.minHp)) : 1
  return t
}

export function loadSave(): SaveData {
  try {
    const primary = sanitize(JSON.parse(localStorage.getItem(KEY) || 'null'))
    if (primary) return primary
  } catch {
    /* try backup */
  }
  try {
    const bak = sanitize(JSON.parse(localStorage.getItem(BAK) || 'null'))
    if (bak) return bak
  } catch {
    /* fresh */
  }
  return freshSave()
}

export function writeSave(save: SaveData): void {
  try {
    const prev = localStorage.getItem(KEY)
    if (prev) localStorage.setItem(BAK, prev)
    localStorage.setItem(KEY, JSON.stringify(save))
  } catch {
    /* private mode / full storage: the hunt continues unsaved */
  }
}

/**
 * Thralls hunt the Slums at half the player's recent kill rate.
 * Called when the game opens or returns from a long sleep.
 */
export function takeOfflineGains(save: SaveData, now: number): OfflineReport | null {
  const elapsed = (now - save.lastActiveAt) / 1000
  if (elapsed < OFFLINE_MIN_SEC || save.killRate < 0.02 || save.kills < 1) {
    save.lastActiveAt = now
    return null
  }
  const capped = elapsed > OFFLINE_CAP_SEC
  const dt = Math.min(OFFLINE_CAP_SEC, elapsed)
  // A steady trickle, not a second hunt: a few feeds an hour, more with the Thrall Master rite.
  const feeds = Math.floor((dt / 3600) * OFFLINE_FEEDS_PER_HOUR * (1 + save.rites.thrall * RITE_STEP.thrall))
  if (feeds < 1) {
    save.lastActiveAt = now
    return null
  }
  const split: [Stat, number][] = [
    ['strength', 0.32],
    ['agility', 0.28],
    ['vitality', 0.22],
    ['sorcery', 0.18],
  ]
  const gained: Record<string, number> = { strength: 0, agility: 0, vitality: 0, sorcery: 0 }
  let assigned = 0
  split.forEach(([stat, weight], i) => {
    const n = i === split.length - 1 ? feeds - assigned : Math.round(feeds * weight)
    assigned += n
    save.stacks[stat] += n
    gained[stat] = n
  })
  // Thralls hunt at the deepest tier the hero has opened.
  const pay = TIERS[bestTier(save)].reward
  const blood = Math.round(feeds * 5 * pay)
  const xp = Math.round(feeds * 3 * pay)
  save.blood += blood
  save.kills += feeds
  const levels = grantXp(save, xp)
  save.lastActiveAt = now
  return {
    seconds: dt,
    capped,
    feeds,
    blood,
    xp,
    levels,
    strength: gained.strength,
    agility: gained.agility,
    vitality: gained.vitality,
    sorcery: gained.sorcery,
  }
}
