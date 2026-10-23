import { ATTRS, ATTR_LABEL, attrEffect, type Attr, type AttrStats, type WeaponType } from './attributes'
import { formatNum, type ClawTier } from './balance'
import { paintSkill, paintSlot } from './icons'
import type { OfflineReport, SkillId, Slot, Stat } from './types'
import { SKILLS, SLOTS, STATS } from './types'

const GEAR_ICON = `<svg class="ico" viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 28.4c-5.4-1.1-9.2-4.6-10-9.2L4.6 11.2C5.2 7.2 8 5.2 11.2 4.8 12.4 7.2 14 8.6 16 8.6s3.6-1.4 4.8-3.8c3.2.4 6 2.4 6.6 6.4l-1.4 8c-.8 4.6-4.6 8.1-10 9.2z"/><path fill="none" stroke="#171b26" stroke-width="1.4" stroke-linecap="round" d="M16 11.2v11"/><path fill="none" stroke="#171b26" stroke-width="1.3" stroke-linecap="round" d="M10.2 20.6h11.6"/></svg>`
const SOUND_ON = `<svg class="ico ico-on" viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M5 12.2h5.1L16 7.4v17.2l-5.9-4.8H5z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M20.2 12.4a5.2 5.2 0 0 1 0 7.2M23.4 9.4a9.2 9.2 0 0 1 0 13.2"/></svg>`
const SOUND_OFF = `<svg class="ico ico-off" viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M5 12.2h5.1L16 7.4v17.2l-5.9-4.8H5z"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M20.2 12.4 27 19.2M27 12.4l-6.8 6.8"/></svg>`
const LOCK_ICON = `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="16" r="2.2" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16 3.5v4.2M16 24.3v4.2M3.5 16h4.2M24.3 16h4.2"/></svg>`

const STAT_LABEL: Record<Stat, string> = {
  strength: 'Strength',
  fortitude: 'Fortitude',
  agility: 'Agility',
  sorcery: 'Sorcery',
  resistance: 'Resistance',
  vitality: 'Vitality',
}

const SKILL_LABEL: Record<SkillId, string> = {
  bats: 'Swarm',
  drain: 'Drain',
  dash: 'Dash',
  nova: 'Nova',
}

export class Hud {
  readonly root: HTMLElement
  readonly floatLayer: HTMLElement
  readonly barLayer: HTMLElement
  selected: Slot = 'weapon'
  onSkill: (id: SkillId) => void = () => {}
  onOpenMenu = (): void => {}
  onCloseMenu = (): void => {}
  onSelectSlot: (slot: Slot) => void = () => {}
  onUpgrade = (): void => {}
  onRaise: (attr: Attr) => void = () => {}
  onSummon = (): void => {}
  onClaim = (): void => {}
  onMute = (): void => {}
  onTap: (x: number, y: number) => void = () => {}

  private joy = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 }
  private keys = new Set<string>()
  private cycleLatch = false
  private cycleWasDown = false
  private down: { x: number; y: number; t: number } | null = null
  private toastTimer = 0
  private skillSecs: Record<SkillId, HTMLElement>
  private skillSweeps: Record<SkillId, HTMLElement>
  private skillBtns: Record<SkillId, HTMLButtonElement>
  private nodeTags: Record<'crypt' | 'fountain', HTMLElement>
  private attrsOpen = false

  constructor(parent: HTMLElement) {
    parent.innerHTML = `
      <div id="game-root">
        <canvas id="c"></canvas>
        <div id="vignette"></div>
        <div id="boot-error"></div>
        <div id="hurt"></div>
        <div id="hud">
          <header>
            <div class="portrait-wrap">
              <button class="portrait-frame" id="btn-portrait" aria-label="Open gear and stats"><canvas id="portrait"></canvas></button>
              <div class="vitals">
                <div class="hp-track"><div id="hp-fill"></div></div>
                <div id="level-label">Lv. 1</div>
                <div id="district-chip">THE SLUMS</div>
              </div>
            </div>
            <div class="top-actions">
              <div class="blood-pill"><span class="drop"></span><span id="blood">0</span></div>
              <button id="btn-gear" type="button" aria-label="Open gear">${GEAR_ICON}</button>
              <button id="btn-mute" type="button" aria-label="Mute sound" aria-pressed="false">${SOUND_ON}${SOUND_OFF}</button>
            </div>
          </header>
          <div id="boss-plate" hidden>
            <div class="boss-name" id="boss-name">RAT KING</div>
            <div class="boss-track"><div id="boss-fill"></div></div>
          </div>
          <div id="summon-wrap" hidden>
            <p id="summon-text">The Rat King is awake under the crypt.</p>
            <button id="btn-summon" type="button">Call him out</button>
          </div>
          <div id="banner" hidden></div>
          <div id="hint">Drag the left side to move. Your claws hunt on their own.</div>
          <div id="toast"></div>
          <div id="floats"></div>
          <div id="bars"></div>
          <div id="node-tags"></div>
          <button id="btn-lock" type="button" aria-label="Next target">${LOCK_ICON}<span>NEXT</span></button>
          <footer>
            <div id="joystick" hidden><div class="joy-base"><div class="joy-knob"></div></div></div>
            <div id="skills"></div>
            <div class="xp-track"><div id="xp-fill"></div></div>
          </footer>
        </div>
        <div id="menu" hidden>
          <div class="district-label">THE SLUMS</div>
          <button id="menu-close" type="button" aria-label="Close">✕</button>
          <button class="slot selected" id="slot-weapon" type="button"><canvas></canvas><span>WEAPON</span></button>
          <button class="slot" id="slot-cape" type="button"><canvas></canvas><span>CAPE</span></button>
          <button class="slot" id="slot-coat" type="button"><canvas></canvas><span>COAT</span></button>
          <button class="slot" id="slot-boots" type="button"><canvas></canvas><span>BOOTS</span></button>
          <div class="sheet">
            <div class="sheet-head"><span id="feeds">Feeds 0</span><span id="trophy" hidden>Crown of the Rat King</span><button id="attr-tab" type="button">Attributes · 0</button></div>
            <div id="stat-rows"></div>
            <div id="attr-rows" hidden></div>
          </div>
          <div class="upgrade-card">
            <div class="upgrade-title">GEAR UPGRADE</div>
            <div id="gear-name">Teethling Claws · Lv. 1</div>
            <div id="gear-tier" hidden><span class="tier-pip"></span><b></b><span class="tier-next"></span></div>
            <div id="gear-bonus">+4 Strength</div>
            <div class="cost-line" id="cost-line"><span class="drop"></span><span>Blood Cost: <b id="gear-cost">12</b></span></div>
            <button id="btn-upgrade" type="button">UPGRADE</button>
            <p class="install-tip">iPhone: Share, then Add to Home Screen. The hunt stays on this device.</p>
          </div>
        </div>
        <div id="offline" hidden>
          <div class="modal">
            <h2>While you slept</h2>
            <p class="flavor" id="offline-flavor">Your thralls kept hunting the Slums.</p>
            <ul id="offline-lines"></ul>
            <button id="offline-claim" type="button">Take it</button>
          </div>
        </div>
        <div id="rotate-lock">Turn your phone upright. The Slums are taller than they are wide.</div>
      </div>`

    this.root = parent.querySelector('#game-root')!
    this.floatLayer = parent.querySelector('#floats')!
    this.barLayer = parent.querySelector('#bars')!
    const tags = parent.querySelector('#node-tags')!
    this.nodeTags = { crypt: document.createElement('div'), fountain: document.createElement('div') }
    for (const id of ['crypt', 'fountain'] as const) {
      const el = this.nodeTags[id]
      el.className = 'node-tag'
      el.innerHTML = `<span class="ring"></span><em></em>`
      tags.appendChild(el)
    }

    const skills = parent.querySelector('#skills')!
    this.skillSecs = {} as Record<SkillId, HTMLElement>
    this.skillSweeps = {} as Record<SkillId, HTMLElement>
    this.skillBtns = {} as Record<SkillId, HTMLButtonElement>
    for (const id of SKILLS) {
      const btn = document.createElement('button')
      btn.className = 'skill ready'
      btn.id = `skill-${id}`
      btn.type = 'button'
      btn.setAttribute('aria-label', SKILL_LABEL[id])
      btn.innerHTML = `<canvas></canvas><span class="sweep"></span><span class="secs"></span><span class="slabel">${SKILL_LABEL[id]}</span>`
      const canvas = btn.querySelector('canvas')!
      paintSkill(canvas, id)
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.onSkill(id)
      })
      skills.appendChild(btn)
      this.skillBtns[id] = btn
      this.skillSecs[id] = btn.querySelector('.secs')!
      this.skillSweeps[id] = btn.querySelector('.sweep')!
    }

    for (const slot of SLOTS) {
      const canvas = parent.querySelector(`#slot-${slot} canvas`) as HTMLCanvasElement
      paintSlot(canvas, slot)
      parent.querySelector(`#slot-${slot}`)!.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.selected = slot
        this.markSlot()
        this.onSelectSlot(slot)
      })
    }

    const rows = parent.querySelector('#stat-rows')!
    for (const stat of STATS) {
      const row = document.createElement('div')
      row.className = 'stat-row'
      row.dataset.stat = stat
      row.innerHTML = `<span>${STAT_LABEL[stat]}</span><div class="bar"><div></div></div><b>0</b>`
      rows.appendChild(row)
    }

    const attrRows = parent.querySelector('#attr-rows')!
    for (const attr of ATTRS) {
      const row = document.createElement('div')
      row.className = 'attr-row'
      row.dataset.attr = attr
      row.innerHTML = `<span>${ATTR_LABEL[attr]} <b>0</b></span><em></em><button type="button" aria-label="Raise ${ATTR_LABEL[attr]}">+</button>`
      row.querySelector('button')!.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.onRaise(attr)
      })
      attrRows.appendChild(row)
    }

    parent.querySelector('#attr-tab')!.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.attrsOpen = !this.attrsOpen
      ;(parent.querySelector('#stat-rows') as HTMLElement).hidden = this.attrsOpen
      ;(parent.querySelector('#attr-rows') as HTMLElement).hidden = !this.attrsOpen
    })

    parent.querySelector('#btn-gear')!.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.onOpenMenu()
    })
    parent.querySelector('#btn-portrait')!.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.onOpenMenu()
    })
    parent.querySelector('#menu-close')!.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.onCloseMenu()
    })
    parent.querySelector('#btn-upgrade')!.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.onUpgrade()
    })
    parent.querySelector('#btn-summon')!.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.onSummon()
    })
    parent.querySelector('#offline-claim')!.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.onClaim()
    })
    parent.querySelector('#btn-mute')!.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.onMute()
    })
    parent.querySelector('#btn-lock')!.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.queueCycle()
    })

    window.addEventListener('pointerdown', this.onDown)
    window.addEventListener('pointermove', this.onMove)
    window.addEventListener('pointerup', this.onUp)
    window.addEventListener('pointercancel', this.onUp)
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code)
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault()
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('blur', () => {
      this.keys.clear()
      this.endJoy()
    })
  }

  get canvas(): HTMLCanvasElement {
    return this.root.querySelector('#c')!
  }

  debugKeys(): string[] {
    return [...this.keys]
  }

  getMove(): { x: number; y: number; active: boolean } {
    let x = this.joy.active ? this.joy.x : 0
    let y = this.joy.active ? this.joy.y : 0
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1
    const m = Math.hypot(x, y)
    if (m > 1) {
      x /= m
      y /= m
    }
    return { x, y, active: m > 0.12 }
  }

  /** One shot from the on-screen target button. */
  queueCycle(): void {
    this.cycleLatch = true
  }

  /** True once per press of the target button, Q, or Tab. */
  takeCycle(): boolean {
    const down = this.keys.has('KeyQ') || this.keys.has('Tab')
    const edge = down && !this.cycleWasDown
    this.cycleWasDown = down
    const tap = this.cycleLatch
    this.cycleLatch = false
    return edge || tap
  }

  setBlood(n: number): void {
    const el = this.root.querySelector('#blood')!
    el.textContent = formatNum(n)
  }

  setHp(ratio: number): void {
    const fill = this.root.querySelector('#hp-fill') as HTMLElement
    fill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`
    const hurt = this.root.querySelector('#hurt') as HTMLElement
    hurt.classList.toggle('on', ratio < 0.32 && ratio > 0)
  }

  setLevel(level: number, xpRatio: number): void {
    this.root.querySelector('#level-label')!.textContent = `Lv. ${level}`
    ;(this.root.querySelector('#xp-fill') as HTMLElement).style.width = `${Math.max(0, Math.min(1, xpRatio)) * 100}%`
  }

  setSkill(id: SkillId, remaining: number, max: number): void {
    const p = max <= 0 ? 0 : Math.max(0, Math.min(1, remaining / max))
    this.skillSweeps[id].style.setProperty('--p', p.toFixed(3))
    this.skillSecs[id].textContent = remaining > 0.15 ? String(Math.ceil(remaining)) : ''
    this.skillBtns[id].classList.toggle('ready', remaining <= 0)
  }

  setBoss(show: boolean, ratio: number, name = 'RAT KING'): void {
    const plate = this.root.querySelector('#boss-plate') as HTMLElement
    plate.hidden = !show
    ;(this.root.querySelector('#boss-name') as HTMLElement).textContent = name
    ;(this.root.querySelector('#boss-fill') as HTMLElement).style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`
  }

  setDistrict(label: string): void {
    const chip = this.root.querySelector('#district-chip') as HTMLElement
    chip.textContent = label
    const menu = this.root.querySelector('.district-label') as HTMLElement
    if (menu) menu.textContent = label
  }

  setSummon(show: boolean, text: string, label: string): void {
    const wrap = this.root.querySelector('#summon-wrap') as HTMLElement
    wrap.hidden = !show
    wrap.querySelector('#summon-text')!.textContent = text
    wrap.querySelector('#btn-summon')!.textContent = label
  }

  showHint(show: boolean): void {
    ;(this.root.querySelector('#hint') as HTMLElement).hidden = !show
  }

  showMenu(open: boolean): void {
    ;(this.root.querySelector('#menu') as HTMLElement).hidden = !open
    ;(this.root.querySelector('#hud') as HTMLElement).style.visibility = open ? 'hidden' : 'visible'
    if (open) this.markSlot()
  }

  setStats(rows: { stat: Stat; value: number; fill: number }[]): void {
    for (const row of rows) {
      const el = this.root.querySelector(`.stat-row[data-stat="${row.stat}"]`)!
      ;(el.querySelector('b') as HTMLElement).textContent = formatNum(row.value)
      ;(el.querySelector('.bar > div') as HTMLElement).style.width = `${Math.max(0, Math.min(1, row.fill)) * 100}%`
    }
  }

  /** Only the mastery for the equipped weapon type is shown; the others do nothing until that gear exists. */
  setAttrs(fx: AttrStats, weapon: WeaponType, points: number): void {
    this.root.querySelector('#attr-tab')!.textContent = this.attrsOpen ? 'Stats' : `Attributes · ${points}`
    for (const attr of ATTRS) {
      const el = this.root.querySelector(`.attr-row[data-attr="${attr}"]`) as HTMLElement
      const mastery = attr === 'blade' || attr === 'blunt' || attr === 'claws'
      el.hidden = mastery && attr !== weapon
      el.querySelector('b')!.textContent = String(fx.level[attr])
      el.querySelector('em')!.textContent = attrEffect(attr, fx)
      ;(el.querySelector('button') as HTMLButtonElement).disabled = points <= 0
    }
  }

  setFeeds(n: number, trophy: boolean): void {
    this.root.querySelector('#feeds')!.textContent = `Feeds ${formatNum(n)}`
    ;(this.root.querySelector('#trophy') as HTMLElement).hidden = !trophy
  }

  setGearCard(name: string, level: number, bonus: string, cost: number, canBuy: boolean, maxed: boolean): void {
    this.root.querySelector('#gear-name')!.textContent = maxed ? `${name} · Lv. ${level} · MAX` : `${name} · Lv. ${level}`
    this.root.querySelector('#gear-bonus')!.textContent = bonus
    this.root.querySelector('#gear-cost')!.textContent = maxed ? '—' : formatNum(cost)
    const line = this.root.querySelector('#cost-line') as HTMLElement
    line.classList.toggle('poor', !canBuy && !maxed)
    const btn = this.root.querySelector('#btn-upgrade') as HTMLButtonElement
    btn.disabled = !canBuy
    btn.textContent = maxed ? 'MAXED' : 'UPGRADE'
  }

  /** Rarity line under the weapon name. `weaponCss` also tints the weapon slot border. */
  setClawTier(tier: ClawTier | null, next: string, weaponCss: string): void {
    const el = this.root.querySelector('#gear-tier') as HTMLElement
    const name = this.root.querySelector('#gear-name') as HTMLElement
    ;(this.root.querySelector('#slot-weapon') as HTMLElement).style.setProperty('--tier', weaponCss)
    el.hidden = !tier
    name.style.color = tier ? tier.css : ''
    if (!tier) return
    el.style.setProperty('--tier', tier.css)
    el.querySelector('b')!.textContent = tier.label
    el.querySelector('.tier-next')!.textContent = ` · ${next}`
  }

  showOffline(report: OfflineReport | null): void {
    const el = this.root.querySelector('#offline') as HTMLElement
    const hud = this.root.querySelector('#hud') as HTMLElement
    if (!report) {
      el.hidden = true
      if (this.menuOpen()) hud.style.visibility = 'hidden'
      else hud.style.visibility = 'visible'
      return
    }
    el.hidden = false
    hud.style.visibility = 'hidden'
    const flavor = this.root.querySelector('#offline-flavor')!
    flavor.textContent = report.capped
      ? `Your thralls hunted for ${report.seconds >= 3600 ? '8 hours' : 'a long stretch'}, then rested. They never wait on an ad.`
      : 'Your thralls kept hunting the Slums.'
    const lines = this.root.querySelector('#offline-lines')!
    const items = [
      `${formatNum(report.feeds)} creatures fed on`,
      `+${formatNum(report.blood)} Blood`,
      `+${formatNum(report.strength)} Strength from ghouls`,
      `+${formatNum(report.agility)} Agility from rats`,
      `+${formatNum(report.vitality)} Vitality from wolves`,
      `+${formatNum(report.sorcery)} Sorcery from witches`,
    ]
    if (report.levels > 0) items.push(`You rose ${report.levels} level${report.levels === 1 ? '' : 's'}`)
    lines.innerHTML = items.map((t) => `<li>${t}</li>`).join('')
  }

  toast(text: string): void {
    const el = this.root.querySelector('#toast') as HTMLElement
    el.textContent = text
    el.classList.add('show')
    window.clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => el.classList.remove('show'), 1600)
  }

  banner(text: string): void {
    const el = this.root.querySelector('#banner') as HTMLElement
    el.hidden = false
    el.textContent = text
    el.style.animation = 'none'
    void el.offsetWidth
    el.style.animation = ''
    window.setTimeout(() => {
      el.hidden = true
    }, 1500)
  }

  setMuted(muted: boolean): void {
    const btn = this.root.querySelector('#btn-mute') as HTMLButtonElement
    btn.classList.toggle('is-muted', muted)
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false')
    btn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound')
  }

  /** One still of the hero, copied into the round portrait. It is not redrawn. */
  showPortrait(pixels: Uint8Array, size: number): void {
    const canvas = this.root.querySelector('#portrait') as HTMLCanvasElement
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const image = ctx.createImageData(size, size)
    const row = size * 4
    for (let y = 0; y < size; y++) {
      image.data.set(pixels.subarray((size - 1 - y) * row, (size - y) * row), y * row)
    }
    ctx.putImageData(image, 0, 0)
  }

  bootError(text: string): void {
    this.root.querySelector('#boot-error')!.textContent = text
  }

  makeFloat(): HTMLDivElement {
    const el = document.createElement('div')
    el.className = 'float'
    return el
  }

  makeBar(kind = 'ghoul'): HTMLDivElement {
    const el = document.createElement('div')
    const boss = kind === 'boss' || kind === 'don'
    el.className = boss ? 'ebar boss' : `ebar ${kind}`
    el.innerHTML = '<i class="lag"></i><i class="fill"></i><b class="hp"></b>'
    this.barLayer.appendChild(el)
    return el
  }

  place(el: HTMLElement, x: number, y: number, visible: boolean): void {
    el.style.display = visible ? 'block' : 'none'
    if (!visible) return
    el.style.transform = `translate(${x}px, ${y}px)`
  }

  setNodeTag(id: 'crypt' | 'fountain', x: number, y: number, text: string, show: boolean, progress: number): void {
    const el = this.nodeTags[id]
    el.style.display = show ? 'block' : 'none'
    if (!show) return
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    el.querySelector('em')!.textContent = text
    ;(el.querySelector('.ring') as HTMLElement).style.setProperty('--p', progress.toFixed(3))
  }

  menuOpen(): boolean {
    return !(this.root.querySelector('#menu') as HTMLElement).hidden
  }

  modalOpen(): boolean {
    return !(this.root.querySelector('#offline') as HTMLElement).hidden
  }

  private markSlot(): void {
    for (const slot of SLOTS) {
      this.root.querySelector(`#slot-${slot}`)!.classList.toggle('selected', slot === this.selected)
    }
  }

  private blockedTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false
    return !!target.closest('button, a, input, #menu, #offline, #summon-wrap')
  }

  private onDown = (e: PointerEvent): void => {
    if (this.menuOpen() || this.modalOpen()) return
    if (this.blockedTarget(e.target)) return
    const w = window.innerWidth
    const h = window.innerHeight
    if (e.clientY > h - 150) return
    if (e.clientX > w * 0.62) {
      this.down = { x: e.clientX, y: e.clientY, t: performance.now() }
      return
    }
    this.joy.active = true
    this.joy.id = e.pointerId
    this.joy.ox = e.clientX
    this.joy.oy = e.clientY
    this.joy.x = 0
    this.joy.y = 0
    this.down = { x: e.clientX, y: e.clientY, t: performance.now() }
    const joy = this.root.querySelector('#joystick') as HTMLElement
    joy.hidden = false
    const base = joy.querySelector('.joy-base') as HTMLElement
    base.style.left = `${e.clientX}px`
    base.style.top = `${e.clientY}px`
    ;(joy.querySelector('.joy-knob') as HTMLElement).style.transform = 'translate(0px, 0px)'
  }

  private onMove = (e: PointerEvent): void => {
    if (!this.joy.active || e.pointerId !== this.joy.id) return
    const dx = e.clientX - this.joy.ox
    const dy = e.clientY - this.joy.oy
    const max = 48
    const mag = Math.hypot(dx, dy) || 1
    const clamped = Math.min(mag, max)
    const nx = (dx / mag) * clamped
    const ny = (dy / mag) * clamped
    this.joy.x = nx / max
    this.joy.y = -ny / max
    const knob = this.root.querySelector('.joy-knob') as HTMLElement
    knob.style.transform = `translate(${nx}px, ${ny}px)`
  }

  private onUp = (e: PointerEvent): void => {
    if (this.down && performance.now() - this.down.t < 280) {
      const dist = Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y)
      if (dist < 14 && !this.blockedTarget(e.target)) this.onTap(e.clientX, e.clientY)
    }
    if (this.joy.active && e.pointerId === this.joy.id) this.endJoy()
    this.down = null
  }

  private endJoy(): void {
    this.joy.active = false
    this.joy.x = 0
    this.joy.y = 0
    ;(this.root.querySelector('#joystick') as HTMLElement).hidden = true
  }
}
