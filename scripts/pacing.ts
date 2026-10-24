/**
 * Pacing simulator: plays one hunter's climb a night at a time on the real
 * balance, night, map, mark, and Haven rules, and prints the day each
 * milestone lands. It is a design tool, not a test: the fight itself is a
 * model (time to kill, damage taken per pod, odds of falling), tuned so a
 * fresh hero in the Slums' Court makes about the kills a real night makes.
 * Who is fought in each zone comes straight from that zone's pods.
 *
 *   npm run pacing            (default: 4.5 nights a day, one 30-minute sitting)
 *   npm run pacing -- 4       (4 nights a day)
 *
 * The target is peak (every level, rank, work, and mark of all ten maps) at
 * eight to ten months of one 30-minute sitting a day.
 */
import {
  ENEMIES,
  LEVEL_CAP,
  MAX_GEAR,
  CLAW_TIERS,
  OFFLINE_CAP_SEC,
  OFFLINE_FEEDS_PER_HOUR,
  BOSS_MATERIALS,
  BOSS_FEEDS,
  ELITE_FEEDS,
  SKILL_META,
  bossArmor,
  bossBlueprint,
  donBlueprint,
  enemyMitigate,
  enemyStats,
  feedWeapon,
  grantXp,
  heldTier,
  mitigate,
  profile,
  skillDamage,
  upgradeCost,
  weaponRank,
  type Foe,
} from '../src/game/balance'
import {
  CURRENCIES,
  DISTRICT_IDS,
  ELITE,
  FRENZY_STEP,
  POWER_MAX,
  RITES,
  RITE_IDS,
  RITE_STEP,
  TIERS,
  TIER_ICHOR,
  bossLoot,
  eliteChance,
  eliteIchor,
  frenzyCap,
  keepShare,
  nightLength,
  nightBite,
  nightTough,
  nightReward,
  nightSteps,
  powerCost,
  powerScale,
  tierIndex,
  tierOf,
  type DistrictId,
  type Purse,
} from '../src/game/nights'
import { MAPS, ZONE_COUNT } from '../src/game/maps'
import { MARKS, bestTier, districtOpen, markDone, marksCleared, marksTotal, omenFor, scoreMarks, type NightTally } from '../src/game/marks'
import { WORKS, WORK_IDS, canAfford, workCost } from '../src/game/haven'
import { freshSave } from '../src/game/save'
import { SKILLS, STATS, type SaveData, type Stat } from '../src/game/types'
import { ATTACK_TOKENS, FOE_COMBAT, SIG, STAGGER } from '../src/game/combat'

const NIGHTS_PER_DAY = Number(process.argv[2] ?? 4.5)
const SEEDS = 5
const MAX_DAYS = 480

let seed = 1
function rand(): number {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
}
function poisson(mean: number): number {
  let n = 0
  let p = Math.exp(-mean)
  let s = p
  const u = rand()
  while (u > s && n < 200) {
    n++
    p *= mean / n
    s += p
  }
  return n
}

/** Who a zone's nights are spent killing, by share of kills, read from its pods. */
function zoneMix(district: DistrictId, zone: number): [Foe, number][] {
  const share = new Map<Foe, number>()
  const pods = MAPS[district].zones[zone].pods
  for (const pod of pods) {
    const total = pod.mixes.reduce((s, m) => s + m.weight, 0)
    for (const mix of pod.mixes) {
      for (const k of mix.kinds) share.set(k, (share.get(k) ?? 0) + mix.weight / total / mix.kinds.length / pods.length)
    }
  }
  return [...share.entries()]
}

const MIX: Record<string, [Foe, number][]> = {}
for (const id of DISTRICT_IDS) for (let z = 0; z < ZONE_COUNT; z++) MIX[`${id}.${z}`] = zoneMix(id, z)
const mixOf = (d: DistrictId, z: number) => MIX[`${d}.${z}`]

const POD_SIZE = 2.7
/** Seconds of walking and setup each kill costs on top of the fight. */
const WALK = 2.6
/** The most kills a night can make: pods only come back so fast. */
const KILL_CAP = 85
/** Share of the night spent hunting rather than walking out. */
const HUNT_SHARE = 0.82
/** Share of the hero's damage that lands on stunned (exposed) enemies. */
const STUN_SHARE = 0.25
/** Plain attacks a hunter eats rather than steps out of, and red abilities the same. */
const SWING_HIT = 0.8
const ABILITY_HIT = 0.35
/** Share of kills made on a stunned enemy: each one feeds. */
const FEED_SHARE = 0.37

interface Fight {
  kills: number
  ttk: number
  /** HP share lost clearing a pod. */
  podLoss: number
  pFall: number
  dps: number
  steps: number
}

function avgFoe(district: DistrictId, zone: number, steps: number) {
  let hp = 0
  let dmg = 0
  let cd = 0
  let sig = 0
  let armor = 0
  let xp = 0
  let blood = 0
  for (const [k, w] of mixOf(district, zone)) {
    const s = enemyStats(k, steps, nightBite(district, zone), nightTough(district, zone))
    hp += s.hp * w
    dmg += s.dmg * w
    // A plain attack cycle is its wind-up and its cooldown.
    cd += (ENEMIES[k].cd + FOE_COMBAT[k].windup) * w
    sig += sigRate(k) * s.dmg * w
    armor += s.armor * w
    xp += s.xp * w
    blood += s.blood * w
  }
  return { hp, dmg, cd, armor, xp, blood, sig }
}

/** Ability damage a second, as a multiple of the enemy's plain hit, if every one landed. */
function sigRate(k: Foe): number {
  const sig = FOE_COMBAT[k].sig
  if (sig === 'lunge') return SIG.lunge.dmg / SIG.lunge.cd
  if (sig === 'retch') return (SIG.retch.dmg + SIG.retch.pool.dmg * 2) / SIG.retch.cd
  if (sig === 'pounce') return SIG.pounce.dmg / SIG.pounce.cd
  if (sig === 'lob') return (SIG.lob.dmg + SIG.lob.pool.dmg * 2) / SIG.lob.cd
  if (sig === 'charge') return SIG.charge.dmg / SIG.charge.cd
  return 0
}

function heroDps(save: SaveData, armor: number) {
  const prof = profile(save)
  const hit = prof.dmg * (1 + prof.crit * 0.7)
  const melee = enemyMitigate(hit, armor) / prof.interval
  let skills = 0
  for (const id of SKILLS) {
    const rank = save.powers[id]
    const cd = SKILL_META[id].cd * prof.cdScale * powerScale(rank).cd
    skills += enemyMitigate(skillDamage(id, prof, rank), armor) / cd
  }
  // Skills miss some of their reach and wait on cooldowns between pods.
  return { prof, melee, total: melee + skills * 0.55 }
}

function fight(save: SaveData, district: DistrictId, zone: number): Fight {
  const length = nightLength(save.rites.night)
  const steps = nightSteps(district, zone, length * 0.45)
  const foe = avgFoe(district, zone, steps)
  const { prof, melee, total: raw } = heroDps(save, foe.armor)
  // Some of the damage lands on staggered enemies, which take more.
  const total = raw * (1 + (STAGGER.exposed - 1) * STUN_SHARE)
  const ttk = (foe.hp * (1 + eliteChance(district, zone, save.rites.scent) * (ELITE.hp - 1))) / total
  const kills = Math.min(KILL_CAP, (length * HUNT_SHARE) / (ttk + WALK))
  const tier = tierIndex(district, zone)
  const pod = POD_SIZE + Math.floor(tier / 10)
  const clear = pod * ttk
  // Armor's share, read off the zone's average hit (mitigate floors a hit at 1).
  const hit = (mitigate(foe.dmg, prof.armor) * prof.guard) / Math.max(1e-6, foe.dmg)
  // Only a few swing at once; the rest circle and still throw their abilities.
  const engaged = Math.min(ATTACK_TOKENS, pod) * 0.8
  const swings = (foe.dmg * hit * SWING_HIT) / foe.cd
  const abilities = foe.sig * hit * ABILITY_HIT
  const taken = (swings * engaged + abilities * pod * 0.6) * clear
  // Regen waits for a breather, so inside a pod only lifesteal and feeding heal.
  const healed = prof.lifesteal * melee * clear + pod * FEED_SHARE * STAGGER.feedHeal * prof.hp
  const podLoss = Math.max(0, taken - healed) / prof.hp
  const pFall = Math.max(0.02, Math.min(0.97, (podLoss - 0.3) * 1.1))
  return { kills, ttk, podLoss, pFall, dps: total, steps }
}

function bossSheet(save: SaveData, district: DistrictId, zone: number, steps: number) {
  const kills = save.bosses[district]
  const args = [save, kills, steps, nightBite(district, zone), nightTough(district, zone)] as const
  return MAPS[district].boss.sheet === 'don' ? donBlueprint(...args) : bossBlueprint(...args)
}

/** Odds the hero puts the map's boss down this night, given the fight model. */
function bossOdds(save: SaveData, district: DistrictId, zone: number, f: Fight): number {
  const bp = bossSheet(save, district, zone, f.steps)
  const { prof, total } = heroDps(save, bossArmor(save.bosses[district], f.steps))
  const time = bp.hp / total
  const incoming = (mitigate(bp.dmg, prof.armor) * prof.guard) / 1.35 + (mitigate(bp.pound, prof.armor) / 4.6) * 0.5
  const loss = Math.max(0, incoming * time * 0.7 - prof.lifesteal * total * time * 0.5 - prof.regen * time) / prof.hp
  return Math.max(0, Math.min(0.95, 1.25 - loss))
}

function addPurse(save: SaveData, p: Partial<Purse>, k = 1): void {
  for (const c of CURRENCIES) save[c] += Math.round((p[c] ?? 0) * k)
}

interface NightOut {
  purse: Purse
  xp: number
  kills: number
  tally: NightTally
  fell: boolean
}

function playNight(save: SaveData, district: DistrictId, zone: number): NightOut {
  const f = fight(save, district, zone)
  const length = nightLength(save.rites.night)
  const foe = avgFoe(district, zone, f.steps)
  const tier = tierIndex(district, zone)
  const kills = Math.max(0, Math.round(f.kills * (0.85 + rand() * 0.3)))
  const elites = poisson(kills * eliteChance(district, zone, save.rites.scent))
  const prof = profile(save)
  // Frenzy: a strong hunter keeps it fed most of the night.
  const pace = f.ttk + WALK
  const frenzyAvg = pace < 4 ? Math.min(frenzyCap(save.rites.frenzy), 8) * Math.min(1, (4 - pace) / 2 + 0.3) : 1
  const pay = nightReward(district, zone) * prof.bloodMult * (1 + frenzyAvg * FRENZY_STEP)
  const purse: Purse = { blood: 0, ichor: 0, vitae: 0, bone: 0, bile: 0, brass: 0 }
  purse.blood = (kills * foe.blood + elites * foe.blood * (ELITE.blood - 1)) * pay
  let xp = kills * foe.xp + elites * foe.xp * (ELITE.xp - 1)
  purse.ichor = elites * eliteIchor(tier)
  const mats = tierOf(district, zone).mats
  for (const [k, w] of mixOf(district, zone)) {
    const d = ENEMIES[k].drop
    purse[d.mat] += (kills * w * d.chance * d.amount + elites * w * d.amount * 2) * mats
  }
  // Feeding stacks and weapon ranks come from every kill, banked or not.
  // Elites feed ELITE_FEEDS times over.
  for (const [k, w] of mixOf(district, zone)) save.stacks[ENEMIES[k].stat as Stat] += Math.round((kills + elites * (ELITE_FEEDS - 1)) * w)
  feedWeapon(save, kills)
  save.kills += kills
  let king = false
  if (zone === ZONE_COUNT - 1 && kills >= 8 && rand() < bossOdds(save, district, zone, f)) {
    king = true
    const sheet = MAPS[district].boss.sheet
    const bp = bossSheet(save, district, zone, f.steps)
    purse.blood += bp.blood * pay
    xp += bp.xp
    const loot = bossLoot(sheet, tier)
    for (const s of STATS) save.stacks[s] += BOSS_FEEDS
    purse.ichor += loot.ichor
    purse.vitae += loot.vitae
    for (const [mat, n] of Object.entries(BOSS_MATERIALS[sheet === 'don' ? 'don' : 'boss'])) purse[mat as 'bone'] += n * mats
    save.bosses[district] += 1
  }
  const fell = rand() < f.pFall
  const tally: NightTally = {
    kills,
    elites,
    pods: Math.floor(kills / POD_SIZE),
    king,
    minHp: fell ? 0 : Math.max(0, 1 - f.podLoss * (0.9 + rand() * 0.6)),
    frenzied: pace < 4.6 && rand() < 0.45,
    early: Math.round(Math.min(kills, (kills * 180) / (length * HUNT_SHARE))),
    blood: purse.blood,
  }
  return { purse, xp, kills, tally, fell }
}

function bank(save: SaveData, out: NightOut, district: DistrictId, zone: number): void {
  const keep = out.fell ? keepShare(save.rites.pact) * 0.6 : 1
  for (const c of CURRENCIES) save[c] += Math.round(out.purse[c] * keep)
  grantXp(save, out.xp)
  if (out.fell) return
  save.vitae += tierOf(district, zone).vitae
  save.extracts += 1
  const { done } = scoreMarks(save, district, zone, out.tally)
  for (const mark of done) addPurse(save, mark.reward)
}

/** Every open (map, zone), in ladder order. */
function openZones(save: SaveData): { district: DistrictId; zone: number }[] {
  const out: { district: DistrictId; zone: number }[] = []
  for (const district of DISTRICT_IDS) {
    if (!districtOpen(save, district)) continue
    for (let zone = 0; zone <= save.danger[district]; zone++) out.push({ district, zone })
  }
  return out
}

/**
 * Picks the night's map and zone. On a pushing night, the deepest zone that
 * still has marks open and that the hero can live through; on a farming
 * night, the best expected haul.
 */
function choose(save: SaveData, push = false): { district: DistrictId; zone: number } {
  const open = openZones(save)
  if (push) {
    let frontier: { district: DistrictId; zone: number } | null = null
    for (const o of open) {
      const marksLeft = MARKS[o.district][o.zone].some((_, i) => !markDone(save, o.district, o.zone, i))
      // The last zone is also worth a night while the next map still wants this boss put down.
      const bossOwed = o.zone === ZONE_COUNT - 1 && save.bosses[o.district] < MAPS[o.district].bossGate
      if ((!marksLeft && !bossOwed) || fight(save, o.district, o.zone).pFall > 0.25) continue
      frontier = o
    }
    if (frontier) return frontier
  }
  let best = { district: 'slums' as DistrictId, zone: 0, score: -1 }
  const worksLeft = WORK_IDS.some((id) => save.works[id] < WORKS[id].max)
  for (const o of open) {
    const f = fight(save, o.district, o.zone)
    const foe = avgFoe(o.district, o.zone, f.steps)
    // Materials count too while the works still want them.
    let mats = 0
    for (const [k, w] of mixOf(o.district, o.zone)) mats += f.kills * w * ENEMIES[k].drop.chance * ENEMIES[k].drop.amount * tierOf(o.district, o.zone).mats
    const value = (f.kills * foe.blood * nightReward(o.district, o.zone) + (worksLeft ? mats * 60 : 0)) * (1 - f.pFall * (1 - keepShare(save.rites.pact) * 0.6))
    if (value > best.score) best = { ...o, score: value }
  }
  return best
}

function spend(save: SaveData): void {
  // Ichor: the next tier, once the weapon level allows.
  const at = CLAW_TIERS.indexOf(heldTier(save))
  const next = CLAW_TIERS[at + 1]
  if (next && save.gear.weapon >= next.from && save.ichor >= TIER_ICHOR[next.id]) {
    save.ichor -= TIER_ICHOR[next.id]
    save.weaponTier = next.id
  }
  // Vitae: the cheapest power or rite rank.
  for (let guard = 0; guard < 50; guard++) {
    const offers: { cost: number; buy: () => void }[] = []
    for (const id of SKILLS) {
      const r = save.powers[id]
      if (r < POWER_MAX) offers.push({ cost: powerCost(r), buy: () => (save.powers[id] += 1) })
    }
    for (const id of RITE_IDS) {
      const r = save.rites[id]
      if (r < RITES[id].costs.length) offers.push({ cost: RITES[id].costs[r], buy: () => (save.rites[id] += 1) })
    }
    offers.sort((a, b) => a.cost - b.cost)
    const pick = offers[0]
    if (!pick || save.vitae < pick.cost) break
    save.vitae -= pick.cost
    pick.buy()
  }
  // Materials: the cheapest work level that can be paid.
  for (let guard = 0; guard < 50; guard++) {
    const offers = WORK_IDS.filter((id) => save.works[id] < WORKS[id].max)
      .map((id) => ({ id, cost: workCost(id, save.works[id]) }))
      .filter((o) => canAfford(save, o.cost))
      .sort((a, b) => Object.values(a.cost).reduce((s, v) => s + v, 0) - Object.values(b.cost).reduce((s, v) => s + v, 0))
    const pick = offers[0]
    if (!pick) break
    for (const [k, v] of Object.entries(pick.cost)) save[k as 'bone'] -= v as number
    save.works[pick.id] += 1
  }
  // Blood: the lowest gear slot, again and again.
  for (let guard = 0; guard < 200; guard++) {
    const slot = (['weapon', 'coat', 'cape', 'boots'] as const).reduce((a, b) => (save.gear[b] < save.gear[a] ? b : a))
    if (save.gear[slot] >= MAX_GEAR) break
    const cost = upgradeCost(save.gear[slot])
    if (save.blood < cost) break
    save.blood -= cost
    save.gear[slot] += 1
  }
}

function offline(save: SaveData, hours: number): void {
  const dt = Math.min(OFFLINE_CAP_SEC, hours * 3600)
  const feeds = Math.floor((dt / 3600) * OFFLINE_FEEDS_PER_HOUR * (1 + save.rites.thrall * RITE_STEP.thrall))
  const pay = TIERS[bestTier(save)].reward
  save.blood += Math.round(feeds * 5 * pay)
  grantXp(save, Math.round(feeds * 3 * pay))
  save.stacks.strength += Math.round(feeds * 0.32)
  save.stacks.agility += Math.round(feeds * 0.28)
  save.stacks.vitality += Math.round(feeds * 0.22)
  save.stacks.sorcery += Math.round(feeds * 0.18)
}

function maxed(save: SaveData) {
  const tierTop = save.weaponTier === 'immortal' && weaponRank(save, save.weapon).rank >= CLAW_TIERS[4].ranks
  return {
    level: save.level >= LEVEL_CAP,
    gear: Object.values(save.gear).every((l) => l >= MAX_GEAR),
    weapon: tierTop,
    powers: SKILLS.every((id) => save.powers[id] >= POWER_MAX),
    rites: RITE_IDS.every((id) => save.rites[id] >= RITES[id].costs.length),
    works: WORK_IDS.every((id) => save.works[id] >= WORKS[id].max),
    marks: marksCleared(save) >= marksTotal(),
  }
}

type Milestones = Record<string, number>

const SNAP_DAYS = [3, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300]

function run(s: number): { ms: Milestones; trace: string[] } {
  seed = s
  const save = freshSave(0)
  const ms: Milestones = {}
  const note = (key: string, day: number) => {
    if (ms[key] == null) ms[key] = day
  }
  const trace: string[] = []
  let carry = 0
  for (let day = 1; day <= MAX_DAYS; day++) {
    offline(save, 20)
    // The Omen: one bonus objective a day.
    const omen = omenFor(save, `d${day}`)
    carry += NIGHTS_PER_DAY
    const tonight = Math.floor(carry)
    carry -= tonight
    for (let n = 0; n < tonight; n++) {
      const { district, zone } = choose(save, n % 2 === 0)
      const out = playNight(save, district, zone)
      bank(save, out, district, zone)
      if (!out.fell && n === 0 && rand() < 0.6) addPurse(save, omen.reward)
      spend(save)
    }
    for (const d of DISTRICT_IDS) {
      if (districtOpen(save, d)) note(`${MAPS[d].label} opens`, day)
    }
    for (const lv of [10, 20, 30, 40, 50, 60]) if (save.level >= lv) note(`Level ${lv}`, day)
    const gearMin = Math.min(...Object.values(save.gear))
    for (const g of [10, 20, 30, 40, 50]) if (gearMin >= g) note(`All gear ${g}`, day)
    for (const t of CLAW_TIERS.slice(1)) if (CLAW_TIERS.indexOf(heldTier(save)) >= CLAW_TIERS.indexOf(t)) note(`${t.label} tier`, day)
    const m = maxed(save)
    for (const [k, v] of Object.entries(m)) if (v) note(`max ${k}`, day)
    if (Object.values(m).every(Boolean)) {
      note('PEAK', day)
      break
    }
    if (SNAP_DAYS.includes(day)) {
      const pick = choose(save)
      const f = fight(save, pick.district, pick.zone)
      const probe = playNight(structuredClone(save), pick.district, pick.zone).purse
      const deep = openZones(save).at(-1)!
      const df = fight(save, deep.district, deep.zone)
      trace.push(
        `day ${String(day).padStart(3)}  lv ${String(save.level).padStart(2)}  gear ${Object.values(save.gear).join('/')}  ${heldTier(save).label.padEnd(9)} r${weaponRank(save, save.weapon).rank}` +
          `  pow ${SKILLS.map((id) => save.powers[id]).join('')}  works ${WORK_IDS.map((id) => save.works[id]).join('/')}` +
          `  marks ${marksCleared(save)}/${marksTotal()}` +
          `  deepest ${MAPS[deep.district].label.replace('The ', '')} ${deep.zone + 1} (k${df.kills.toFixed(0)} f${(df.pFall * 100).toFixed(0)}%)` +
          `  farms ${MAPS[pick.district].label.replace('The ', '')} ${pick.zone + 1} (k${f.kills.toFixed(0)} f${(f.pFall * 100).toFixed(0)}%: ${Math.round(probe.blood)}b ${probe.ichor.toFixed(0)}i)` +
          `  dmg ${profile(save).dmg.toFixed(0)} hp ${profile(save).hp.toFixed(0)}` + (process.env.DBG ? ` st ${JSON.stringify(save.stacks)} k${save.kills}` : ""),
      )
    }
  }
  if (ms.PEAK == null) {
    // Name what held the climb up: the open marks of the deepest open zone.
    const deep = openZones(save).at(-1)!
    MARKS[deep.district][deep.zone].forEach((def, i) => {
      if (!markDone(save, deep.district, deep.zone, i)) {
        trace.push(`  stuck: ${MAPS[deep.district].label} ${deep.zone + 1} mark ${def.kind} ${def.n} (have ${save.marks[`${deep.district}.${deep.zone}.${i}`] ?? 0}), boss falls ${save.bosses[deep.district]}`)
      }
    })
  }
  return { ms, trace }
}

const runs = Array.from({ length: SEEDS }, (_, i) => run(7 + i * 101))
const keys = Array.from(new Set(runs.flatMap((r) => Object.keys(r.ms)))).sort((a, b) => (runs[0].ms[a] ?? 999) - (runs[0].ms[b] ?? 999))
console.log(`Pacing at ${NIGHTS_PER_DAY} nights a day, ${SEEDS} runs (day reached: median, min-max)\n`)
for (const k of keys) {
  const days = runs.map((r) => r.ms[k]).filter((d) => d != null).sort((a, b) => a - b)
  const med = days[Math.floor(days.length / 2)]
  const tag = days.length < SEEDS ? `  (${days.length}/${SEEDS} runs)` : ''
  console.log(`${k.padEnd(26)} day ${String(med ?? '-').padStart(4)}  (${days[0]}-${days[days.length - 1]})${tag}`)
}
console.log('\nOne run, sampled:\n')
for (const line of runs[0].trace) console.log(line)
for (const r of runs) for (const line of r.trace) if (line.includes('stuck')) console.log(line)
