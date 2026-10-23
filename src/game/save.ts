import { ATTRS, zeroAttrs } from './attributes'
import { CLAW_TIERS, OFFLINE_CAP_SEC, OFFLINE_MIN_SEC, clawTier, grantXp } from './balance'
import { DANGERS, DISTRICT_IDS, RITES, RITE_IDS, POWER_MAX, emptyPurse, type Purse } from './nights'
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
    weaponTier: 'teethling',
    powers: { bats: 0, drain: 0, dash: 0, nova: 0 },
    rites: { night: 0, pact: 0, frenzy: 0, scent: 0, thrall: 0 },
    danger: { slums: 0, mob: 0 },
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
    bossKills: 0,
    mobKills: 0,
    donKills: 0,
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
  base.level = Math.max(1, Math.floor(num('level', 1)))
  base.xp = Math.max(0, num('xp', 0))
  base.kills = Math.max(0, Math.floor(num('kills', 0)))
  base.bossKills = Math.max(0, Math.floor(num('bossKills', 0)))
  base.mobKills = Math.max(0, Math.floor(num('mobKills', 0)))
  base.donKills = Math.max(0, Math.floor(num('donKills', 0)))
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
  const int = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0)
  if (isRecord(raw.powers)) for (const id of SKILLS) base.powers[id] = int(raw.powers[id], POWER_MAX)
  if (isRecord(raw.rites)) for (const id of RITE_IDS) base.rites[id] = int(raw.rites[id], RITES[id].costs.length)
  if (isRecord(raw.danger)) for (const id of DISTRICT_IDS) base.danger[id] = int(raw.danger[id], DANGERS.length - 1)
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
  if (isRecord(raw.carried)) for (const k of ['blood', 'ichor', 'vitae'] as const) carried[k] = n(raw.carried[k])
  return {
    district,
    danger: Math.min(DANGERS.length - 1, Math.floor(n(raw.danger))),
    elapsed: n(raw.elapsed),
    carried,
    kills: Math.floor(n(raw.kills)),
  }
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
  const feeds = Math.floor(save.killRate * 0.5 * dt * (1 + save.rites.thrall * 0.25))
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
  const blood = feeds * 5
  const xp = feeds * 3
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
