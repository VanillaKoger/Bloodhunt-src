/**
 * Pacing simulator: plays one hunter's climb a night at a time on the real
 * balance, night, mark, and Haven rules, and prints the day each milestone
 * lands. It is a design tool, not a test: the fight itself is a model (time
 * to kill, damage taken per pod, odds of falling), tuned so a fresh hero at
 * Slums Danger I makes about the kills a real night makes.
 *
 *   npm run pacing            (default: 4 nights a day)
 *   npm run pacing -- 3       (3 nights a day)
 *
 * The target is peak (every level, rank, work, and mark) at 6 to 8 months
 * of one sitting a day.
 */
import {
  ENEMIES,
  LEVEL_CAP,
  MAX_GEAR,
  CLAW_TIERS,
  OFFLINE_CAP_SEC,
  OFFLINE_FEEDS_PER_HOUR,
  BOSS_MATERIALS,
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
  DANGERS,
  DISTRICTS,
  ELITE,
  FRENZY_STEP,
  POWER_MAX,
  RITES,
  RITE_IDS,
  RITE_STEP,
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
  type DistrictId,
  type Purse,
} from '../src/game/nights'
import { MARKS, districtOpen, markDone, marksCleared, marksTotal, omenFor, scoreMarks, type NightTally } from '../src/game/marks'
import { WORKS, WORK_IDS, canAfford, workCost } from '../src/game/haven'
import { freshSave } from '../src/game/save'
import { attrPointsLeft } from '../src/game/attributes'
import { SKILLS, type SaveData, type Stat } from '../src/game/types'

const NIGHTS_PER_DAY = Number(process.argv[2] ?? 4)
const SEEDS = 5

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

/** Who a night is spent killing, by share of kills. */
const MIX: Record<DistrictId, [Foe, number][]> = {
  slums: [
    ['hound', 0.32],
    ['walker', 0.22],
    ['thrall', 0.14],
    ['spitter', 0.1],
    ['skeleton', 0.06],
    ['thug', 0.16],
  ],
  mob: [
    ['thug', 0.7],
    ['enforcer', 0.3],
  ],
}

const POD_SIZE = 2.7
/** Seconds of walking and setup each kill costs on top of the fight. */
const WALK = 2.6
/** The most kills a night can make: pods only come back so fast. */
const KILL_CAP = 85
/** Share of the night spent hunting rather than walking out. */
const HUNT_SHARE = 0.82

interface Fight {
  kills: number
  ttk: number
  /** HP share lost clearing a pod. */
  podLoss: number
  pFall: number
  dps: number
  steps: number
}

function avgFoe(district: DistrictId, steps: number, bite: number, tough: number) {
  let hp = 0
  let dmg = 0
  let cd = 0
  let armor = 0
  let xp = 0
  let blood = 0
  for (const [k, w] of MIX[district]) {
    const s = enemyStats(k, steps, bite, tough)
    hp += s.hp * w
    dmg += s.dmg * w
    cd += ENEMIES[k].cd * w
    armor += s.armor * w
    xp += s.xp * w
    blood += s.blood * w
  }
  return { hp, dmg, cd, armor, xp, blood }
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

function fight(save: SaveData, district: DistrictId, danger: number): Fight {
  const length = nightLength(save.rites.night)
  const steps = nightSteps(district, danger, length * 0.45)
  const foe = avgFoe(district, steps, nightBite(district, danger), nightTough(district, danger))
  const { prof, melee, total } = heroDps(save, foe.armor)
  const ttk = (foe.hp * (1 + eliteChance(danger, save.rites.scent) * (ELITE.hp - 1))) / total
  const kills = Math.min(KILL_CAP, (length * HUNT_SHARE) / (ttk + WALK))
  const clear = POD_SIZE * ttk
  const incoming = (mitigate(foe.dmg, prof.armor, prof.resist, false) * prof.guard) / foe.cd
  const engaged = 1.7
  const taken = incoming * engaged * clear * 0.75
  const healed = prof.lifesteal * melee * clear + prof.regen * clear
  const podLoss = Math.max(0, taken - healed) / prof.hp
  const pFall = Math.max(0.02, Math.min(0.97, (podLoss - 0.3) * 1.1))
  return { kills, ttk, podLoss, pFall, dps: total, steps }
}

/** Odds the hero puts the district's boss down this night, given the fight model. */
function bossOdds(save: SaveData, district: DistrictId, danger: number, f: Fight): number {
  const bite = nightBite(district, danger)
  const bp = district === 'mob' ? donBlueprint(save, f.steps, bite, nightTough(district, danger)) : bossBlueprint(save, f.steps, bite, nightTough(district, danger))
  const kills = district === 'mob' ? save.donKills : save.bossKills
  const { prof, total } = heroDps(save, bossArmor(kills, f.steps))
  const time = bp.hp / total
  const incoming = (mitigate(bp.dmg, prof.armor, prof.resist, true) * prof.guard) / 1.35 + mitigate(bp.pound, prof.armor, prof.resist, true) / 4.6 * 0.5
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
  bossKilled: boolean
}

function playNight(save: SaveData, district: DistrictId, danger: number): NightOut {
  const f = fight(save, district, danger)
  const length = nightLength(save.rites.night)
  const steps = f.steps
  const bite = nightBite(district, danger)
  const foe = avgFoe(district, steps, bite, nightTough(district, danger))
  const kills = Math.max(0, Math.round(f.kills * (0.85 + rand() * 0.3)))
  const elites = poisson(kills * eliteChance(danger, save.rites.scent))
  const prof = profile(save)
  // Frenzy: a strong hunter keeps it fed most of the night.
  const pace = f.ttk + WALK
  const frenzyAvg = pace < 4 ? Math.min(frenzyCap(save.rites.frenzy), 8) * Math.min(1, (4 - pace) / 2 + 0.3) : 1
  const pay = nightReward(district, danger) * prof.bloodMult * (1 + frenzyAvg * FRENZY_STEP)
  const purse: Purse = { blood: 0, ichor: 0, vitae: 0, bone: 0, bile: 0, brass: 0 }
  purse.blood = (kills * foe.blood + elites * foe.blood * (ELITE.blood - 1)) * pay
  let xp = kills * foe.xp + elites * foe.xp * (ELITE.xp - 1)
  purse.ichor = elites * eliteIchor(danger)
  for (const [k, w] of MIX[district]) {
    const d = ENEMIES[k].drop
    const n = kills * w * d.chance * d.amount * DANGERS[danger].mats + elites * w * d.amount * 2 * DANGERS[danger].mats
    purse[d.mat] += n
  }
  // Feeding stacks and weapon ranks come from every kill, banked or not.
  for (const [k, w] of MIX[district]) save.stacks[ENEMIES[k].stat as Stat] += Math.round(kills * w)
  feedWeapon(save, kills)
  save.kills += kills
  let bossKilled = false
  const bossTried = kills >= 10
  if (bossTried && rand() < bossOdds(save, district, danger, f)) {
    bossKilled = true
    const boss = district === 'mob' ? 'don' : 'boss'
    const bp = district === 'mob' ? donBlueprint(save, steps, bite, nightTough(district, danger)) : bossBlueprint(save, steps, bite, nightTough(district, danger))
    purse.blood += bp.blood * pay
    xp += bp.xp
    const loot = bossLoot(boss, danger)
    purse.ichor += loot.ichor
    purse.vitae += loot.vitae
    for (const [mat, n] of Object.entries(BOSS_MATERIALS[boss])) purse[mat as 'bone'] += n
    if (district === 'mob') save.donKills += 1
    else save.bossKills += 1
  }
  const fell = rand() < f.pFall
  const tally: NightTally = {
    kills,
    elites,
    pods: Math.floor(kills / POD_SIZE),
    king: bossKilled,
    minHp: fell ? 0 : Math.max(0, 1 - f.podLoss * (0.9 + rand() * 0.6)),
    frenzied: pace < 4.6 && rand() < 0.45,
    early: Math.round(Math.min(kills, (kills * 180) / (length * HUNT_SHARE))),
    blood: purse.blood,
  }
  return { purse, xp, kills, tally, fell, bossKilled }
}

function bank(save: SaveData, out: NightOut, district: DistrictId, danger: number): void {
  const keep = out.fell ? keepShare(save.rites.pact) * 0.6 : 1
  for (const c of CURRENCIES) save[c] += Math.round(out.purse[c] * keep)
  grantXp(save, out.xp)
  if (out.fell) return
  save.vitae += DANGERS[danger].vitae
  save.extracts += 1
  const { done } = scoreMarks(save, district, danger, out.tally)
  for (const mark of done) addPurse(save, mark.reward)
}

/**
 * Picks the night's district and danger. On a pushing night, the hardest
 * danger that still has marks open and that the hero can live through; on a
 * farming night, the best expected haul.
 */
function choose(save: SaveData, push = false): { district: DistrictId; danger: number } {
  if (push) {
    let frontier: { district: DistrictId; danger: number; rank: number } | null = null
    for (const district of ['slums', 'mob'] as DistrictId[]) {
      if (!districtOpen(save, district)) continue
      for (let d = 0; d <= save.danger[district]; d++) {
        const open = MARKS[district][d].some((_, i) => !markDone(save, district, d, i))
        if (!open || fight(save, district, d).pFall > 0.25) continue
        const rank = (district === 'mob' ? 10 : 0) + d
        if (!frontier || rank > frontier.rank) frontier = { district, danger: d, rank }
      }
    }
    if (frontier) return frontier
  }
  let best = { district: 'slums' as DistrictId, danger: 0, score: -1 }
  for (const district of ['slums', 'mob'] as DistrictId[]) {
    if (!districtOpen(save, district)) continue
    for (let d = 0; d <= save.danger[district]; d++) {
      const f = fight(save, district, d)
      const foe = avgFoe(district, f.steps, nightBite(district, d), nightTough(district, d))
      // Materials count too while the works still want them: Bone and Bile only come from the Slums.
      const worksLeft = WORK_IDS.some((id) => save.works[id] < WORKS[id].max)
      let mats = 0
      for (const [k, w] of MIX[district]) mats += f.kills * w * ENEMIES[k].drop.chance * ENEMIES[k].drop.amount * DANGERS[d].mats * (ENEMIES[k].drop.mat === 'brass' ? 0.5 : 1)
      const value = (f.kills * foe.blood * nightReward(district, d) + (worksLeft ? mats * 60 : 0)) * (1 - f.pFall * (1 - keepShare(save.rites.pact) * 0.6))
      const score = value
      if (score > best.score) best = { district, danger: d, score }
    }
  }
  return best
}

function spend(save: SaveData): void {
  // Attribute points: mastery first, then might and vitality.
  const order = ['claws', 'might', 'vitality', 'claws', 'shade', 'hunger'] as const
  let i = 0
  while (attrPointsLeft(save) > 0) save.attrs[order[i++ % order.length]] += 1
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
  const pay = DANGERS[save.danger.slums].reward
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

const SNAP_DAYS = [3, 15, 45, 90, 135, 180, 220]

function fightTable(save: SaveData): string[] {
  const rows: string[] = []
  for (const d of ['slums', 'mob'] as DistrictId[]) {
    const row = DANGERS.map((_, i) => {
      const f = fight(save, d, i)
      const open = (districtOpen(save, d) && save.danger[d] >= i) ? '' : '*'
      return `${DANGERS[i].label}${open} k${f.kills.toFixed(0)} f${(f.pFall * 100).toFixed(0)}%`
    })
    rows.push(`      ${d.padEnd(5)} ${row.join(' | ')}`)
  }
  return rows
}

function run(s: number): { ms: Milestones; trace: string[] } {
  seed = s
  const save = freshSave(0)
  const ms: Milestones = {}
  const note = (key: string, day: number) => {
    if (ms[key] == null) ms[key] = day
  }
  const trace: string[] = []
  for (let day = 1; day <= 420; day++) {
    offline(save, 20)
    // The Omen: one bonus objective a day.
    const omen = omenFor(save, `d${day}`)
    for (let n = 0; n < NIGHTS_PER_DAY; n++) {
      const { district, danger } = choose(save, n % 2 === 0)
      const out = playNight(save, district, danger)
      bank(save, out, district, danger)
      if (!out.fell && n === 0 && rand() < 0.6) addPurse(save, omen.reward)
      spend(save)
    }
    for (const d of ['slums', 'mob'] as DistrictId[]) {
      for (let k = 1; k < DANGERS.length; k++) if (save.danger[d] >= k) note(`${DISTRICTS[d].label} ${DANGERS[k].label}`, day)
    }
    if (districtOpen(save, 'mob')) note('Mob District opens', day)
    for (const lv of [10, 20, 30, 40, 50, 60]) if (save.level >= lv) note(`Level ${lv}`, day)
    const gearMin = Math.min(...Object.values(save.gear))
    for (const g of [10, 20, 30, 40, 50]) if (gearMin >= g) note(`All gear ${g}`, day)
    for (const t of CLAW_TIERS.slice(1)) if (CLAW_TIERS.indexOf(heldTier(save)) >= CLAW_TIERS.indexOf(t)) note(`${t.label} tier`, day)
    const m = maxed(save)
    for (const [k, v] of Object.entries(m)) if (v) note(`max ${k}`, day)
    if (day === 300 && !m.marks) {
      for (const d of ['slums', 'mob'] as DistrictId[]) MARKS[d].forEach((list, i) => list.forEach((def, j) => { if (!markDone(save, d, i, j)) trace.push(`  open mark ${d} ${DANGERS[i].label}: ${def.kind} ${def.n} (have ${save.marks[`${d}.${i}.${j}`] ?? 0})`) }))
    }
    if (Object.values(m).every(Boolean)) {
      note('PEAK', day)
      break
    }
    if (SNAP_DAYS.includes(day)) {
      const pick = choose(save)
      const f = fight(save, pick.district, pick.danger)
      const probe = playNight(structuredClone(save), pick.district, pick.danger).purse
      trace.push(
        `day ${String(day).padStart(3)}  lv ${String(save.level).padStart(2)}  gear ${Object.values(save.gear).join('/')}  ${heldTier(save).label.padEnd(9)} r${weaponRank(save, save.weapon).rank}` +
          `  pow ${SKILLS.map((id) => save.powers[id]).join('')}  works ${WORK_IDS.map((id) => save.works[id]).join('/')}` +
          `  marks ${marksCleared(save)}/${marksTotal()}  hunts ${DISTRICTS[pick.district].label.replace('The ', '')} ${DANGERS[pick.danger].label}` +
          `  kills ${f.kills.toFixed(0)}  fall ${(f.pFall * 100).toFixed(0)}%  dmg ${profile(save).dmg.toFixed(0)} hp ${profile(save).hp.toFixed(0)}` +
          `  night: ${Math.round(probe.blood)}b ${probe.ichor.toFixed(1)}i ${Math.round(probe.bone + probe.bile + probe.brass)}m`,
      )
      trace.push(...fightTable(save))
    }
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
  console.log(`${k.padEnd(24)} day ${String(med ?? '-').padStart(4)}  (${days[0]}-${days[days.length - 1]})${tag}`)
}
console.log('\nOne run, every fifteen days:\n')
for (const line of runs[0].trace) console.log(line)

