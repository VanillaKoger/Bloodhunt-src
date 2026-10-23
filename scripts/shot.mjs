import puppeteer from 'puppeteer-core'

const url = process.argv[2] || 'http://127.0.0.1:8734/'
const out = process.argv[3] || '/tmp/shot.png'
const waitMs = Number(process.argv[4] || 800)

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
page.on('pageerror', (err) => errors.push(String(err)))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
await page.waitForFunction(() => window.__BLOODHUNT__ && window.__BLOODHUNT__.ready, { timeout: 15000 }).catch((e) => errors.push(String(e)))
await new Promise((r) => setTimeout(r, waitMs))
const state = await page.evaluate(() => ({
  boot: document.querySelector('#boot-error')?.textContent || '',
  ready: !!window.__BLOODHUNT__?.ready,
  state: window.__BLOODHUNT__?.getState?.() || null,
}))
await page.screenshot({ path: out, type: 'png' })
console.log(JSON.stringify({ out, errors, boot: state.boot, ready: state.ready, fps: state.state?.fps, draws: state.state?.draws, tris: state.state?.tris, kills: state.state?.kills, hits: state.state?.hits }, null, 2))
await browser.close()
