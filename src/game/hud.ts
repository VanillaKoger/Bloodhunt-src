import { ATTRS, ATTR_LABEL, attrEffect, type Attr, type AttrStats, type WeaponType } from './attributes'
import { formatNum, type ClawTier } from './balance'
import { paintSkill, paintSlot } from './icons'
import type { OfflineReport, SkillId, Slot, Stat } from './types'
import { SKILLS, SLOTS, STATS } from './types'
import { WEAPONS, WEAPON_KINDS, type WeaponKind } from './weapons'
import { CURRENCIES, type Currency, type DistrictId, type Purse, type RiteId } from './nights'
import type { LookSlot, WorkId } from './haven'

const GEAR_ICON = `<svg class="ico" viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 28.4c-5.4-1.1-9.2-4.6-10-9.2L4.6 11.2C5.2 7.2 8 5.2 11.2 4.8 12.4 7.2 14 8.6 16 8.6s3.6-1.4 4.8-3.8c3.2.4 6 2.4 6.6 6.4l-1.4 8c-.8 4.6-4.6 8.1-10 9.2z"/><path fill="none" stroke="#171b26" stroke-width="1.4" stroke-linecap="round" d="M16 11.2v11"/><path fill="none" stroke="#171b26" stroke-width="1.3" stroke-linecap="round" d="M10.2 20.6h11.6"/></svg>`
const SOUND_ON = `<svg class="ico ico-on" viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M5 12.2h5.1L16 7.4v17.2l-5.9-4.8H5z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M20.2 12.4a5.2 5.2 0 0 1 0 7.2M23.4 9.4a9.2 9.2 0 0 1 0 13.2"/></svg>`
const SOUND_OFF = `<svg class="ico ico-off" viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M5 12.2h5.1L16 7.4v17.2l-5.9-4.8H5z"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M20.2 12.4 27 19.2M27 12.4l-6.8 6.8"/></svg>`
const LOCK_ICON = `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="16" r="2.2" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16 3.5v4.2M16 24.3v4.2M3.5 16h4.2M24.3 16h4.2"/></svg>`

const INSTALL_TIP = 'iPhone: Share, then Add to Home Screen. The hunt stays on this device.'

export interface NightHudView {
  clock: string
  /** The last minute, and the dawn itself. */
  warn: boolean
  frenzy: number
  frenzyFill: number
  danger: string
}

export interface HavenView {
  purse: Purse
  night: string
  keep: number
  extracts: number
  districts: {
    id: DistrictId
    label: string
    blurb: string
    locked: boolean
    lockText: string
    dangers: { label: string; reward: number; unlocked: boolean }[]
    best: number
  }[]
  powers: { id: SkillId; label: string; rank: number; max: number; effect: string; cost: number; canBuy: boolean }[]
  rites: { id: RiteId; label: string; rank: number; max: number; effect: string; next: string; cost: number; canBuy: boolean }[]
  works: { id: WorkId; label: string; blurb: string; level: number; max: number; effect: string; next: string; cost: Partial<Purse>; canBuy: boolean }[]
  wardrobe: {
    slot: LookSlot
    label: string
    items: { id: string; label: string; color: number; owned: boolean; worn: boolean; cost: Partial<Purse>; canBuy: boolean }[]
  }[]
}

type HavenTab = 'hunt' | 'powers' | 'rites' | 'works' | 'wardrobe'

export interface SummaryView {
  outcome: 'extracted' | 'fell' | 'dawn' | 'fled'
  district: string
  danger: string
  banked: Purse
  lost: Purse
  bonusVitae: number
  keep: number
  kills: number
  time: string
  unlock: string | null
}

export interface AscendView {
  label: string
  css: string
  cost: number
  /** Why it cannot be bought yet, or empty. */
  need: string
  canBuy: boolean
}

const OUTCOME: Record<SummaryView['outcome'], { title: string; flavor: string }> = {
  extracted: { title: 'Extracted', flavor: 'You slipped out with the haul before the sky turned.' },
  fell: { title: 'You fell', flavor: 'The hunt took you. The Blood Pact held a little back.' },
  dawn: { title: 'Taken by the dawn', flavor: 'The sun found you in the open. The Blood Pact held a little back.' },
  fled: { title: 'You fled', flavor: 'You left the night early. The Blood Pact held a little back.' },
}

const CURRENCY_LABEL: Record<keyof Purse, string> = { blood: 'Blood', ichor: 'Ichor', vitae: 'Vitae', bone: 'Bone', bile: 'Bile', brass: 'Brass' }

/** A cost as short coin tags: "12 Bone · 4 Brass". */
function costText(cost: Partial<Purse>): string {
  return (Object.entries(cost) as [Currency, number][])
    .map(([k, v]) => `<span class="cost ${k}">${formatNum(v)} ${CURRENCY_LABEL[k]}</span>`)
    .join(' ')
}

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
  onEquip: (kind: WeaponKind) => void = () => {}
  onSummon = (): void => {}
  onClaim = (): void => {}
  onMute = (): void => {}
  onTap: (x: number, y: number) => void = () => {}
  onOpenHaven = (): void => {}
  onCloseHaven = (): void => {}
  onBeginNight: (district: DistrictId, danger: number) => void = () => {}
  onBuyPower: (id: SkillId) => void = () => {}
  onBuyRite: (id: RiteId) => void = () => {}
  onBuyWork: (id: WorkId) => void = () => {}
  /** Buy a look, or wear one already owned. */
  onLook: (id: string) => void = () => {}
  onAscend = (): void => {}
  onAbandon = (): void => {}
  onLeaveSummary = (): void => {}

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
  private havenTab: HavenTab = 'hunt'
  /** The work a station opened the board on, picked out in the list. */
  private havenFocus = ''
  /** The danger picked on each district card. */
  private pick: Partial<Record<DistrictId, number>> = {}
  private havenView: HavenView | null = null

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
              <div class="purse" id="purse">
                <small id="purse-tag">BANKED</small>
                <div class="blood-pill"><span class="drop"></span><span id="blood">0</span></div>
                <div class="coin-pill ichor"><span class="gem"></span><span id="ichor">0</span></div>
                <div class="coin-pill vitae"><span class="gem"></span><span id="vitae">0</span></div>
                <div class="mat-row">
                  <div class="coin-pill mat bone" title="Bone"><span class="gem"></span><span id="bone">0</span></div>
                  <div class="coin-pill mat bile" title="Bile"><span class="gem"></span><span id="bile">0</span></div>
                  <div class="coin-pill mat brass" title="Brass"><span class="gem"></span><span id="brass">0</span></div>
                </div>
              </div>
              <button id="btn-gear" type="button" aria-label="Open gear">${GEAR_ICON}</button>
              <button id="btn-mute" type="button" aria-label="Mute sound" aria-pressed="false">${SOUND_ON}${SOUND_OFF}</button>
            </div>
          </header>
          <div id="boss-plate" hidden>
            <div class="boss-name" id="boss-name">RAT KING</div>
            <div class="boss-track"><div id="boss-fill"></div></div>
          </div>
          <div id="summon-wrap" hidden>
            <p id="summon-text">The Rat King holds court in the chapel yard.</p>
            <button id="btn-summon" type="button">Call him out</button>
          </div>
          <div id="night-chip" hidden>
            <div class="night-row"><b id="night-clock">5:00</b><span id="night-danger">Danger I</span></div>
            <div class="frenzy"><i id="frenzy-fill"></i><span id="frenzy-text">Frenzy ×1.0</span></div>
          </div>
          <div id="extract-mark" hidden><span class="arrow"></span><span class="ring"></span><em></em></div>
          <button id="btn-haven" type="button" hidden>THE HAVEN</button>
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
          <div id="armory" hidden></div>
          <div class="upgrade-card">
            <div class="upgrade-title">GEAR UPGRADE</div>
            <div id="gear-name">Teethling Claws · Lv. 1</div>
            <div id="gear-tier" hidden><span class="tier-pip"></span><b></b><span class="tier-next"></span></div>
            <div id="gear-bonus">+4 Strength</div>
            <div class="cost-line" id="cost-line"><span class="drop"></span><span>Blood Cost: <b id="gear-cost">12</b></span></div>
            <button id="btn-upgrade" type="button">UPGRADE</button>
            <button id="btn-ascend" type="button" hidden>ASCEND</button>
            <p class="ascend-need" id="ascend-need" hidden></p>
            <p class="spend-note" id="spend-note" hidden>Blood and Ichor are spent at the Haven, after you extract.</p>
            <button id="btn-abandon" type="button" hidden>Abandon the night</button>
            <p class="install-tip" id="gear-note">${INSTALL_TIP}</p>
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
        <div id="haven" hidden><div class="haven-panel"></div></div>
        <div id="night-end" hidden>
          <div class="modal">
            <h2 id="end-title">Extracted</h2>
            <p class="flavor" id="end-flavor"></p>
            <ul id="end-lines"></ul>
            <button id="end-leave" type="button">Return to the Haven</button>
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

    const armory = parent.querySelector('#armory')!
    for (const kind of WEAPON_KINDS) {
      const w = WEAPONS[kind]
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'item-card'
      card.dataset.kind = kind
      card.setAttribute('aria-label', `Equip ${w.noun}`)
      card.innerHTML = `<canvas></canvas><small></small><b>${w.noun}</b><em>${ATTR_LABEL[w.mastery]}</em>`
      card.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.onEquip(kind)
      })
      armory.appendChild(card)
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
    const press = (sel: string, fn: () => void) =>
      parent.querySelector(sel)!.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        fn()
      })
    press('#btn-haven', () => this.onOpenHaven())
    press('#btn-ascend', () => this.onAscend())
    press('#btn-abandon', () => this.onAbandon())
    press('#end-leave', () => this.onLeaveSummary())
    parent.querySelector('#haven')!.addEventListener('pointerdown', (e) => {
      const el = (e.target as Element).closest('[data-act]') as HTMLElement | null
      if (!el) return
      e.preventDefault()
      e.stopPropagation()
      if ((el as HTMLButtonElement).disabled) return
      const act = el.dataset.act
      const id = el.dataset.id ?? ''
      if (act === 'tab') {
        this.havenTab = id as typeof this.havenTab
        this.renderHaven()
      } else if (act === 'danger') {
        this.pick[el.dataset.district as DistrictId] = Number(id)
        this.renderHaven()
      } else if (act === 'begin') {
        const district = id as DistrictId
        const card = this.havenView?.districts.find((d) => d.id === district)
        this.onBeginNight(district, this.pick[district] ?? card?.best ?? 0)
      } else if (act === 'work') this.onBuyWork(id as WorkId)
      else if (act === 'look') this.onLook(id)
      else if (act === 'power') this.onBuyPower(id as SkillId)
      else if (act === 'rite') this.onBuyRite(id as RiteId)
      else if (act === 'close') this.onCloseHaven()
      else if (act === 'gear') this.onOpenMenu()
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

  /** The currencies and materials in the top bar: banked at the Haven, carried on a night. */
  setPurse(purse: Purse, carried: boolean): void {
    this.setBlood(purse.blood)
    for (const k of ['ichor', 'vitae', 'bone', 'bile', 'brass'] as const) {
      this.root.querySelector(`#${k}`)!.textContent = formatNum(Math.floor(purse[k]))
    }
    const tag = this.root.querySelector('#purse-tag') as HTMLElement
    tag.textContent = carried ? 'CARRIED' : 'BANKED'
    this.root.querySelector('#purse')!.classList.toggle('carried', carried)
  }

  /** The Haven's use prompt, shown at a station. */
  setInteract(text: string | null): void {
    const btn = this.root.querySelector('#btn-haven') as HTMLElement
    btn.hidden = !text
    if (text && btn.textContent !== text) btn.textContent = text
  }

  /** A range dummy's damage readout, hung over its head. */
  makeReadout(title: string): HTMLDivElement {
    const el = document.createElement('div')
    el.className = 'range-tag'
    el.innerHTML = `<small>${title}</small><div><b>—</b><span>DPS</span></div><em></em>`
    el.style.display = 'none'
    this.barLayer.appendChild(el)
    return el
  }

  setReadout(el: HTMLDivElement, dps: string, total: string, top: string, live: boolean): void {
    el.classList.toggle('live', live)
    const b = el.querySelector('b')!
    if (b.textContent !== dps) b.textContent = dps
    const em = el.querySelector('em')!
    const line = live ? `${total} total · ${top} top hit` : 'Hit me'
    if (em.textContent !== line) em.textContent = line
  }

  setNightHud(view: NightHudView | null): void {
    const chip = this.root.querySelector('#night-chip') as HTMLElement
    chip.hidden = !view
    if (!view) return
    chip.classList.toggle('warn', view.warn)
    this.root.querySelector('#night-clock')!.textContent = view.clock
    this.root.querySelector('#night-danger')!.textContent = `Danger ${view.danger}`
    ;(this.root.querySelector('#frenzy-fill') as HTMLElement).style.width = `${Math.max(0, Math.min(1, view.frenzyFill)) * 100}%`
    this.root.querySelector('#frenzy-text')!.textContent = `Frenzy ×${view.frenzy.toFixed(1)}`
    chip.classList.toggle('frenzied', view.frenzy > 1.05)
  }

  /** The way-out marker. `edge` pins it to the screen border, pointing along `angle`. */
  setExtract(x: number, y: number, show: boolean, edge: boolean, angle: number, label: string, dist: number, progress: number): void {
    const el = this.root.querySelector('#extract-mark') as HTMLElement
    el.hidden = !show
    if (!show) return
    el.style.transform = `translate(${x}px, ${y}px)`
    el.classList.toggle('edge', edge)
    // Near a side, the label hangs inward so it is not cut off.
    el.classList.toggle('left', x < 90)
    el.classList.toggle('right', x > window.innerWidth - 90)
    ;(el.querySelector('.arrow') as HTMLElement).style.transform = `rotate(${angle}rad)`
    ;(el.querySelector('.ring') as HTMLElement).style.setProperty('--p', Math.max(0, Math.min(1, progress)).toFixed(3))
    el.querySelector('em')!.textContent = progress > 0 ? 'Leaving…' : `${label} · ${Math.round(dist)}m`
  }

  showHaven(open: boolean, tab?: HavenTab, focus = ''): void {
    ;(this.root.querySelector('#haven') as HTMLElement).hidden = !open
    if (open && tab) this.havenTab = tab
    if (open) this.havenFocus = focus
    if (open) this.renderHaven()
    this.syncHudVisibility()
  }

  havenOpen(): boolean {
    return !(this.root.querySelector('#haven') as HTMLElement).hidden
  }

  setHaven(view: HavenView): void {
    this.havenView = view
    if (this.havenOpen()) this.renderHaven()
  }

  showSummary(view: SummaryView | null): void {
    const el = this.root.querySelector('#night-end') as HTMLElement
    el.hidden = !view
    this.syncHudVisibility()
    if (!view) return
    const text = OUTCOME[view.outcome]
    el.querySelector('#end-title')!.textContent = text.title
    el.querySelector('#end-flavor')!.textContent =
      view.outcome === 'extracted' ? text.flavor : `${text.flavor} You kept ${view.keep}% of the haul.`
    el.classList.toggle('lost', view.outcome !== 'extracted')
    const lines: string[] = [`<li class="head">${view.district} · Danger ${view.danger} · ${view.time} · ${view.kills} kills</li>`]
    for (const k of CURRENCIES) {
      const banked = view.banked[k]
      const lost = view.lost[k]
      if (banked <= 0 && lost <= 0) continue
      const bonus = k === 'vitae' && view.bonusVitae > 0 ? ` <small>(${view.bonusVitae} for getting out)</small>` : ''
      const gone = lost > 0 ? ` <s>${formatNum(lost)} lost</s>` : ''
      lines.push(`<li class="${k}"><span>${CURRENCY_LABEL[k]}</span><b>+${formatNum(banked)}</b>${bonus}${gone}</li>`)
    }
    if (lines.length === 1) lines.push('<li>Nothing came home.</li>')
    if (view.unlock) lines.push(`<li class="unlock">${view.unlock}</li>`)
    el.querySelector('#end-lines')!.innerHTML = lines.join('')
  }

  summaryOpen(): boolean {
    return !(this.root.querySelector('#night-end') as HTMLElement).hidden
  }

  /** The weapon slot's tier-up, paid in Ichor. Null hides it (another slot, or Immortal). */
  setAscend(view: AscendView | null): void {
    const btn = this.root.querySelector('#btn-ascend') as HTMLButtonElement
    const need = this.root.querySelector('#ascend-need') as HTMLElement
    btn.hidden = !view
    need.hidden = !view || !view.need
    if (!view) return
    btn.innerHTML = `ASCEND · <span style="color:${view.css}">${view.label.toUpperCase()}</span> · ${formatNum(view.cost)} Ichor`
    btn.disabled = !view.canBuy
    need.textContent = view.need
  }

  /** On a night the menu shows gear but cannot spend, and offers to give the night up. */
  setSpendLock(locked: boolean, keep = 25): void {
    ;(this.root.querySelector('#spend-note') as HTMLElement).hidden = !locked
    const abandon = this.root.querySelector('#btn-abandon') as HTMLElement
    abandon.hidden = !locked
    abandon.textContent = `Abandon the night · keep ${keep}%`
  }

  private renderHaven(): void {
    const view = this.havenView
    const panel = this.root.querySelector('.haven-panel') as HTMLElement
    if (!view) return
    const tab = (id: string, label: string) =>
      `<button type="button" data-act="tab" data-id="${id}" class="${this.havenTab === id ? 'on' : ''}">${label}</button>`
    let body = ''
    if (this.havenTab === 'hunt') {
      body = view.districts
        .map((d) => {
          if (d.locked) {
            return `<div class="district locked"><h3>${d.label}</h3><p>${d.blurb}</p><p class="lock">${d.lockText}</p></div>`
          }
          const picked = Math.min(this.pick[d.id] ?? d.best, d.best)
          const pips = d.dangers
            .map(
              (x, i) =>
                `<button type="button" class="pip ${i === picked ? 'on' : ''}" data-act="danger" data-district="${d.id}" data-id="${i}" ${x.unlocked ? '' : 'disabled'}>${x.label}</button>`,
            )
            .join('')
          const reward = d.dangers[picked].reward
          return `<div class="district">
            <h3>${d.label}</h3>
            <p>${d.blurb}</p>
            <div class="pips"><span>Danger</span>${pips}</div>
            <p class="pay">×${reward.toFixed(2)} Blood · extract to open the next danger</p>
            <button type="button" class="begin" data-act="begin" data-id="${d.id}">Begin the night</button>
          </div>`
        })
        .join('')
      body += `<p class="haven-rules">Dusk lasts ${view.night}. Everything you pick up is carried. Reach a way out to bank it. Fall, or meet the dawn, and you keep ${view.keep}%.</p>`
    } else if (this.havenTab === 'powers') {
      body = view.powers
        .map(
          (p) => `<div class="shop-row">
            <div><b>${p.label}</b> <small>${p.rank}/${p.max}</small><em>${p.effect}</em></div>
            <button type="button" data-act="power" data-id="${p.id}" ${p.canBuy ? '' : 'disabled'}>${p.rank >= p.max ? 'MAX' : `${p.cost} Vitae`}</button>
          </div>`,
        )
        .join('')
    } else if (this.havenTab === 'works') {
      body = view.works
        .map(
          (w) => `<div class="shop-row work ${w.id === this.havenFocus ? 'focus' : ''}" data-work="${w.id}">
            <div><b>${w.label}</b> <small>${w.level}/${w.max}</small><em>${w.level > 0 ? w.effect : w.blurb}${w.level < w.max ? ` → ${w.next}` : ''}</em></div>
            <button type="button" data-act="work" data-id="${w.id}" ${w.canBuy ? '' : 'disabled'}>${w.level >= w.max ? 'MAX' : costText(w.cost)}</button>
          </div>`,
        )
        .join('')
      body += '<p class="haven-rules">Each level is small. They add up. Bone, Bile, and Brass come home from the hunt.</p>'
    } else if (this.havenTab === 'wardrobe') {
      body = view.wardrobe
        .map(
          (slot) => `<h4 class="look-head">${slot.label}</h4><div class="looks">${slot.items
            .map((it) => {
              const hex = `#${it.color.toString(16).padStart(6, '0')}`
              const tag = it.worn ? 'Worn' : it.owned ? 'Wear' : costText(it.cost)
              return `<button type="button" class="look ${it.worn ? 'worn' : ''} ${it.owned ? 'owned' : ''}" data-act="look" data-id="${it.id}" ${it.worn || (!it.owned && !it.canBuy) ? 'disabled' : ''}>
                <i style="background:${hex};box-shadow:0 0 10px ${hex}"></i><b>${it.label}</b><small>${tag}</small></button>`
            })
            .join('')}</div>`,
        )
        .join('')
    } else {
      body = view.rites
        .map(
          (r) => `<div class="shop-row">
            <div><b>${r.label}</b> <small>${r.rank}/${r.max}</small><em>${r.rank > 0 ? r.effect : 'Not yet'}${r.next ? ` → ${r.next}` : ''}</em></div>
            <button type="button" data-act="rite" data-id="${r.id}" ${r.canBuy ? '' : 'disabled'}>${r.rank >= r.max ? 'MAX' : `${r.cost} Vitae`}</button>
          </div>`,
        )
        .join('')
    }
    const coin = (k: keyof Purse) => `<span class="coin ${k}"><i></i>${formatNum(view.purse[k])} <small>${CURRENCY_LABEL[k]}</small></span>`
    panel.innerHTML = `
      <div class="haven-head"><h2>The Haven</h2><button type="button" class="ghost" data-act="close">Back to the yard</button></div>
      <div class="haven-purse">${CURRENCIES.map(coin).join('')}</div>
      <p class="haven-key">Blood levels gear. Ichor ascends your weapon. Vitae buys powers and rites. Bone, Bile, and Brass build the works and the wardrobe.</p>
      <nav class="haven-tabs">${tab('hunt', 'Hunt')}${tab('powers', 'Powers')}${tab('rites', 'Rites')}${tab('works', 'Works')}${tab('wardrobe', 'Wardrobe')}</nav>
      <div class="haven-body">${body}</div>
      <button type="button" class="haven-gear" data-act="gear">Gear &amp; Weapons</button>
      <p class="haven-foot">${view.extracts} night${view.extracts === 1 ? '' : 's'} survived</p>`
    panel.querySelector('.focus')?.scrollIntoView({ block: 'nearest' })
  }

  /** The play HUD hides under any full-screen panel. */
  private syncHudVisibility(): void {
    const hud = this.root.querySelector('#hud') as HTMLElement
    hud.style.visibility = this.menuOpen() || this.modalOpen() ? 'hidden' : 'visible'
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
    this.syncHudVisibility()
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

  /**
   * Weapon item cards, shown while the weapon slot is selected. Each card
   * carries its tier and rank (`labels`) in the tier color; `equipped` is lit.
   */
  setArmory(show: boolean, equipped: WeaponKind, labels: Record<WeaponKind, string>, tierCss: string): void {
    const el = this.root.querySelector('#armory') as HTMLElement
    el.hidden = !show
    el.style.setProperty('--tier', tierCss)
    for (const card of el.querySelectorAll<HTMLElement>('.item-card')) {
      const on = card.dataset.kind === equipped
      card.classList.toggle('on', on)
      card.setAttribute('aria-pressed', on ? 'true' : 'false')
      card.querySelector('small')!.textContent = labels[card.dataset.kind as WeaponKind]
    }
  }

  /** One still of a weapon mesh for its item card. */
  setWeaponIcon(kind: WeaponKind, pixels: Uint8Array, size: number): void {
    const canvas = this.root.querySelector(`.item-card[data-kind="${kind}"] canvas`) as HTMLCanvasElement | null
    if (canvas) blit(canvas, pixels, size)
  }

  /** Line under the upgrade button: the weapon's trade-offs, or the install tip for other gear. */
  setGearNote(text: string | null): void {
    this.root.querySelector('#gear-note')!.textContent = text ?? INSTALL_TIP
  }

  /** Rarity line under the weapon name, with the rank line under it. `weaponCss` also tints the weapon slot border. */
  setClawTier(tier: ClawTier | null, next: string, weaponCss: string): void {
    const el = this.root.querySelector('#gear-tier') as HTMLElement
    const name = this.root.querySelector('#gear-name') as HTMLElement
    ;(this.root.querySelector('#slot-weapon') as HTMLElement).style.setProperty('--tier', weaponCss)
    el.hidden = !tier
    name.style.color = tier ? tier.css : ''
    if (!tier) return
    el.style.setProperty('--tier', tier.css)
    el.querySelector('b')!.textContent = tier.label
    el.querySelector('.tier-next')!.textContent = next
  }

  showOffline(report: OfflineReport | null): void {
    const el = this.root.querySelector('#offline') as HTMLElement
    const hud = this.root.querySelector('#hud') as HTMLElement
    if (!report) {
      el.hidden = true
      this.syncHudVisibility()
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
      `+${formatNum(report.strength)} Strength from thralls and bones`,
      `+${formatNum(report.agility)} Agility from hounds`,
      `+${formatNum(report.vitality)} Vitality from walkers`,
      `+${formatNum(report.sorcery)} Sorcery from the miasma`,
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
    blit(this.root.querySelector('#portrait') as HTMLCanvasElement, pixels, size)
  }

  bootError(text: string): void {
    this.root.querySelector('#boot-error')!.textContent = text
  }

  makeFloat(): HTMLDivElement {
    const el = document.createElement('div')
    el.className = 'float'
    return el
  }

  makeBar(kind = 'walker'): HTMLDivElement {
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

  /** Any full-screen panel that pauses the hunt: the offline report, the Haven board, or a night's summary. */
  modalOpen(): boolean {
    return !(this.root.querySelector('#offline') as HTMLElement).hidden || this.havenOpen() || this.summaryOpen()
  }

  private markSlot(): void {
    for (const slot of SLOTS) {
      this.root.querySelector(`#slot-${slot}`)!.classList.toggle('selected', slot === this.selected)
    }
  }

  private blockedTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false
    return !!target.closest('button, a, input, #menu, #offline, #summon-wrap, #haven, #night-end')
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

/** Copy WebGL render-target pixels (bottom row first) into a 2D canvas. */
function blit(canvas: HTMLCanvasElement, pixels: Uint8Array, size: number): void {
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
