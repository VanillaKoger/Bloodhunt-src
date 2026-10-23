import puppeteer from 'puppeteer-core'

const OUT = '/opt/cursor/artifacts'
const URL = 'http://127.0.0.1:8734/?enemies=1'

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--hide-scrollbars',
  ],
})
const page = await browser.newPage()
const errors = []
page.on('pageerror', (err) => errors.push('PAGE ' + err.message))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push('CON ' + msg.text())
})
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle0' })
await page.waitForFunction(() => window.__BLOODHUNT__?.ready, { timeout: 15000 })
await sleep(400)
await page.screenshot({ path: `${OUT}/01-scene.png` })

const state = () => page.evaluate(() => window.__BLOODHUNT__.getState())

await page.waitForFunction(() => window.__BLOODHUNT__.getState().kills >= 1 && window.__BLOODHUNT__.getState().hits > 2, { timeout: 25000 })
await sleep(350)
await page.screenshot({ path: `${OUT}/02-combat.png` })
const afterCombat = await state()
if (afterCombat.stacks.strength + afterCombat.stacks.agility + afterCombat.stacks.vitality + afterCombat.stacks.sorcery < 1) {
  throw new Error('kills did not raise stats: ' + JSON.stringify(afterCombat.stacks))
}

await page.click('#skill-bats')
await sleep(220)
await page.screenshot({ path: `${OUT}/03-skills.png` })
await page.click('#skill-dash')
await sleep(200)
await page.click('#skill-nova')
await sleep(180)
await page.click('#skill-drain')
const skilled = await state()
if (skilled.skillsFired < 1) throw new Error('skills did not fire')

async function release() {
  for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) await page.keyboard.up(k)
}

async function moveToward(key, stopDist = 1.45, maxMs = 20000) {
  const start = Date.now()
  let last = null
  while (Date.now() - start < maxMs) {
    last = await state()
    const hero = last.hero
    const target = last[key]
    const dx = target.x - hero.x
    const dz = target.z - hero.z
    const dist = Math.hypot(dx, dz)
    if (dist <= stopDist) {
      await release()
      return last
    }
    const { x: fx, z: fz } = last.camForward
    const { x: rx, z: rz } = last.camRight
    const det = fx * rz - fz * rx || 1
    const jy = (dx * rz - dz * rx) / det
    const jx = (fx * dz - fz * dx) / det
    await release()
    if (jy > 0.2) await page.keyboard.down('KeyW')
    if (jy < -0.2) await page.keyboard.down('KeyS')
    if (jx > 0.2) await page.keyboard.down('KeyD')
    if (jx < -0.2) await page.keyboard.down('KeyA')
    await sleep(100)
  }
  await release()
  throw new Error(`could not reach ${key} last=${JSON.stringify(last && { hero: last.hero, node: last[key] })}`)
}

await moveToward('crypt', 1.35)
await sleep(900)
await moveToward('fountain', 1.35)
await sleep(900)
await release()
const harvested = await state()
if (harvested.nodeBlood < 36) throw new Error('nodes did not give blood: ' + harvested.nodeBlood)

await page.click('#btn-gear')
await sleep(700)
const menuText = await page.evaluate(() => ({
  name: document.querySelector('#gear-name')?.textContent,
  cost: document.querySelector('#gear-cost')?.textContent,
  bonus: document.querySelector('#gear-bonus')?.textContent,
  stats: [...document.querySelectorAll('.stat-row')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()),
}))
console.log('MENU', JSON.stringify(menuText))
await page.screenshot({ path: `${OUT}/04-menu.png` })
const beforeUpgrade = await state()
await page.click('#slot-weapon')
await page.click('#btn-upgrade')
await sleep(200)
const upgraded = await state()
if (upgraded.gear.weapon < beforeUpgrade.gear.weapon + 1) {
  throw new Error('upgrade failed ' + JSON.stringify({ before: beforeUpgrade.gear, blood: beforeUpgrade.blood, after: upgraded.gear, blood2: upgraded.blood }))
}
if (upgraded.blood >= beforeUpgrade.blood) throw new Error('upgrade did not spend blood')
if (upgraded.sheet.strength <= beforeUpgrade.sheet.strength) throw new Error('upgrade did not raise strength')
await page.click('#menu-close')
await sleep(300)

await page.waitForFunction(() => {
  const btn = document.querySelector('#btn-summon')
  const wrap = document.querySelector('#summon-wrap')
  return wrap && !wrap.hidden && btn
}, { timeout: 30000 })
await page.click('#btn-summon')
await sleep(500)
await page.screenshot({ path: `${OUT}/05-boss.png` })
const bossSeen = await state()
if (!bossSeen.bossAlive && bossSeen.bossKills < 1) throw new Error('boss did not spawn')

const fightStart = Date.now()
while (Date.now() - fightStart < 90000) {
  const s = await state()
  if (s.bossKills > 0) break
  for (const id of ['bats', 'nova', 'drain', 'dash']) {
    const btn = await page.$(`#skill-${id}`)
    if (btn) await btn.click({ delay: 10 }).catch(() => {})
  }
  await sleep(400)
}
const beaten = await state()
if (beaten.bossKills < 1) throw new Error('boss was not beaten. hp ' + beaten.bossHp + ' hero ' + beaten.heroHp)
await sleep(400)
await page.screenshot({ path: `${OUT}/06-final.png` })

await page.evaluate(() => window.__BLOODHUNT__.pause())
const checkpoint = await state()
await page.goto(URL + '?paused=1', { waitUntil: 'networkidle0' })
await page.waitForFunction(() => window.__BLOODHUNT__?.ready, { timeout: 15000 })
const restored = await state()
const persistProblems = []
if (restored.blood !== checkpoint.blood) persistProblems.push(`blood ${checkpoint.blood} -> ${restored.blood}`)
if (restored.gear.weapon !== checkpoint.gear.weapon) persistProblems.push('weapon level')
if (restored.stacks.strength !== checkpoint.stacks.strength) persistProblems.push('strength stacks')
if (restored.bossKills !== checkpoint.bossKills) persistProblems.push('bossKills')
if (restored.kills !== checkpoint.kills) persistProblems.push(`kills ${checkpoint.kills} -> ${restored.kills}`)
if (persistProblems.length) throw new Error('persist failed: ' + persistProblems.join(', '))

const bloodBeforeOffline = restored.blood
await page.evaluate(() => window.__BLOODHUNT__.rewind(30 * 60))
await page.reload({ waitUntil: 'networkidle0' })
await page.waitForFunction(() => window.__BLOODHUNT__?.ready, { timeout: 15000 })
await page.waitForFunction(() => {
  const el = document.querySelector('#offline')
  return el && !el.hidden
}, { timeout: 8000 })
await sleep(200)
await page.screenshot({ path: `${OUT}/07-offline.png` })
const offline = await state()
if (offline.blood <= bloodBeforeOffline) throw new Error(`offline gains missing ${bloodBeforeOffline} -> ${offline.blood}`)

console.log(JSON.stringify({
  ok: true,
  errors,
  checkpoint: {
    blood: checkpoint.blood,
    kills: checkpoint.kills,
    bossKills: checkpoint.bossKills,
    gear: checkpoint.gear,
    stacks: checkpoint.stacks,
    level: checkpoint.level,
    sheet: checkpoint.sheet,
    nodeBlood: checkpoint.nodeBlood,
    skillsFired: checkpoint.skillsFired,
    fps: checkpoint.fps,
    draws: checkpoint.draws,
  },
  offlineBlood: offline.blood,
}, null, 2))
await browser.close()

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
