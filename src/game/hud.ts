import { FEED_STEP, STAT_LABEL, formatNum, type ClawTier } from './balance'
import { paintSkill, paintSlot } from './icons'
import type { OfflineReport, SkillId, Slot, Stat } from './types'
import { SKILLS, SLOTS, STATS } from './types'
import { FAMILY_LABEL, WEAPONS, WEAPON_KINDS, type WeaponKind } from './weapons'
import { CURRENCIES, type Currency, type DistrictId, type Purse, type RiteId } from './nights'
import type { LookSlot, WorkId } from './haven'

const GEAR_ICON = `<svg class="ico" viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 28.4c-5.4-1.1-9.2-4.6-10-9.2L4.6 11.2C5.2 7.2 8 5.2 11.2 4.8 12.4 7.2 14 8.6 16 8.6s3.6-1.4 4.8-3.8c3.2.4 6 2.4 6.6 6.4l-1.4 8c-.8 4.6-4.6 8.1-10 9.2z"/><path fill="none" stroke="#171b26" stroke-width="1.4" stroke-linecap="round" d="M16 11.2v11"/><path fill="none" stroke="#171b26" stroke-width="1.3" stroke-linecap="round" d="M10.2 20.6h11.6"/></svg>`
const SOUND_ON = `<svg class="ico ico-on" viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M5 12.2h5.1L16 7.4v17.2l-5.9-4.8H5z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M20.2 12.4a5.2 5.2 0 0 1 0 7.2M23.4 9.4a9.2 9.2 0 0 1 0 13.2"/></svg>`
const SOUND_OFF = `<svg class="ico ico-off" viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M5 12.2h5.1L16 7.4v17.2l-5.9-4.8H5z"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M20.2 12.4 27 19.2M27 12.4l-6.8 6.8"/></svg>`
const ZOOM_ICON = `<svg class="ico" viewBox="0 0 32 32" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M6 12V6h6M26 12V6h-6M6 20v6h6M26 20v6h-6"/><circle cx="16" cy="16" r="3" fill="currentColor"/></svg>`
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
    /** One line on what the place is, for a locked card. */
    theme: string
    /** Who is hunted there. */
    roster: string
    boss: string
    locked: boolean
    lockText: string
    /** The map's three zones. */
    dangers: {
      label: string
      name: string
      zoneBlurb: string
      /** 1-based rung on the 30-tier ladder. */
      tier: number
      reward: number
      unlocked: boolean
      /** The danger's three marks, and what clearing one pays. */
      marks: { text: string; have: number; need: number; done: boolean }[]
      reward2: Partial<Purse>
      cleared: boolean
    }[]
    best: number
    /** What a locked district still asks for. */
    gate: { text: string; done: boolean }[]
  }[]
  omen: { text: string; reward: Partial<Purse>; done: boolean; where: string }
  marksDone: number
  marksTotal: number
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
  /** Marks and the Omen this night finished. */
  marks: string[]
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

const SKILL_LABEL: Record<SkillId, string> = {
  bats: 'Swarm',
  drain: 'Drain',
  dash: 'Dash',
  nova: 'Nova',
}

/** A menu button: acts on a finished tap (click), so a drag that scrolls the panel never presses it. */
function tap(el: Element, fn: () => void): void {
  el.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if ((el as HTMLButtonElement).disabled) return
    fn()
  })
}

/** How far the knob travels from the stick's center, in pixels. */
const JOY_RADIUS = 52

/** Camera distance the player may pick, as a multiple of the screen-fit default. */
export const ZOOM_MIN = 0.75
export const ZOOM_MAX = 1.5
const ZOOM_STEPS = [0.8, 1, 1.25, 1.5]

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
  /** Erases every bit of progress. Only reached through the two-tap button in the gear menu. */
  onReset: () => void = () => {}
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
  /** Fingers down on open ground, for the two-finger pinch. */
  private touches = new Map<number, { x: number; y: number }>()
  private pinch: { d0: number; z0: number } | null = null
  /** Camera distance as a multiple of the screen-fit default. Saved with the game. */
  zoom = 1
  onZoom: (zoom: number) => void = () => {}
  private keys = new Set<string>()
  private cycleLatch = false
  private cycleWasDown = false
  private down: { x: number; y: number; t: number } | null = null
  private toastTimer = 0
  private skillSecs: Record<SkillId, HTMLElement>
  private skillSweeps: Record<SkillId, HTMLElement>
  private skillBtns: Record<SkillId, HTMLButtonElement>
  private nodeTags: Record<'crypt' | 'fountain', HTMLElement>
  private resetArmed = 0
  private havenTab: HavenTab = 'hunt'
  /** The work a station opened the board on, picked out in the list. */
  private havenFocus = ''
  /** The zone picked on each map card. */
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
              <button id="btn-zoom" type="button" aria-label="Camera distance">${ZOOM_ICON}</button>
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
            <div class="night-row"><b id="night-clock">5:00</b><span id="night-danger">Zone 1</span></div>
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
            <div id="joy-ghost" aria-hidden="true"><div class="joy-base"><div class="joy-knob"></div></div><span>Hold to move</span></div>
            <div id="joystick" hidden><div class="joy-base"><i class="joy-arrow"></i><div class="joy-knob"></div></div></div>
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
            <div class="sheet-head"><span id="feeds">Feeds 0</span><span id="trophy" hidden>Crown of the Rat King</span></div>
            <div id="stat-rows"></div>
            <p class="sheet-note">Every kill feeds its stat +0.01. Gear and hero levels add whole points.</p>
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
            <button id="btn-reset" type="button">Reset all progress (testing)</button>
            <p class="art-credits">Art: KayKit (Kay Lousberg), Kenney, Quaternius, Fertile Soil Productions, and <a href="https://atomicrealm.itch.io/" target="_blank" rel="noopener">Atomic Realm</a>. Ground maps from ambientCG and Poly Haven. Full list in CREDITS.md.</p>
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
      tap(parent.querySelector(`#slot-${slot}`)!, () => {
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
      row.innerHTML = `<span>${STAT_LABEL[stat]}</span><b>0</b><em></em>`
      rows.appendChild(row)
    }

    const armory = parent.querySelector('#armory')!
    for (const kind of WEAPON_KINDS) {
      const w = WEAPONS[kind]
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'item-card'
      card.dataset.kind = kind
      card.setAttribute('aria-label', `Equip ${w.noun}`)
      card.innerHTML = `<canvas></canvas><small></small><b>${w.noun}</b><em>${FAMILY_LABEL[w.family]}</em>`
      tap(card, () => this.onEquip(kind))
      armory.appendChild(card)
    }

    // Reset asks twice: the first tap arms it for a few seconds, the second erases everything.
    const reset = parent.querySelector('#btn-reset') as HTMLButtonElement
    tap(reset, () => {
      if (performance.now() < this.resetArmed) {
        this.resetArmed = 0
        this.onReset()
        return
      }
      this.resetArmed = performance.now() + 4000
      reset.classList.add('armed')
      reset.textContent = 'Tap again to erase everything'
      window.setTimeout(() => {
        if (performance.now() < this.resetArmed) return
        reset.classList.remove('armed')
        reset.textContent = 'Reset all progress (testing)'
      }, 4100)
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
    tap(parent.querySelector('#menu-close')!, () => this.onCloseMenu())
    tap(parent.querySelector('#btn-upgrade')!, () => this.onUpgrade())
    parent.querySelector('#btn-summon')!.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.onSummon()
    })
    tap(parent.querySelector('#offline-claim')!, () => this.onClaim())
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
    press('#btn-zoom', () => this.stepZoom())
    // Buttons inside scrolling panels act on a tap, never on the touch that starts a scroll.
    tap(parent.querySelector('#btn-ascend')!, () => this.onAscend())
    tap(parent.querySelector('#btn-abandon')!, () => this.onAbandon())
    tap(parent.querySelector('#end-leave')!, () => this.onLeaveSummary())
    parent.querySelector('#haven')!.addEventListener('click', (e) => {
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
        // A new tab starts at its top, not wherever the last one was scrolled.
        ;(parent.querySelector('#haven') as HTMLElement).scrollTop = 0
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
    // Mouse wheel or trackpad: the camera distance, outside the menus.
    window.addEventListener(
      'wheel',
      (e) => {
        if (this.menuOpen() || this.modalOpen()) return
        this.setZoom(this.zoom * (1 + Math.max(-0.3, Math.min(0.3, e.deltaY * 0.0015))))
      },
      { passive: true },
    )
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
    this.root.querySelector('#night-danger')!.textContent = view.danger
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
    const lines: string[] = [`<li class="head">${view.district} · ${view.danger} · ${view.time} · ${view.kills} kills</li>`]
    for (const k of CURRENCIES) {
      const banked = view.banked[k]
      const lost = view.lost[k]
      if (banked <= 0 && lost <= 0) continue
      const bonus = k === 'vitae' && view.bonusVitae > 0 ? ` <small>(${view.bonusVitae} for getting out)</small>` : ''
      const gone = lost > 0 ? ` <s>${formatNum(lost)} lost</s>` : ''
      lines.push(`<li class="${k}"><span>${CURRENCY_LABEL[k]}</span><b>+${formatNum(banked)}</b>${bonus}${gone}</li>`)
    }
    if (lines.length === 1) lines.push('<li>Nothing came home.</li>')
    for (const mark of view.marks) lines.push(`<li class="mark">${mark}</li>`)
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
      let shownGate = false
      body = view.districts
        .map((d) => {
          if (d.locked) {
            // The next map to open shows what it asks; the ones past it only say what they are.
            const gate = shownGate ? '' : `<ul class="marks gate">${d.gate.map((g) => `<li class="${g.done ? 'done' : ''}">${g.text}</li>`).join('')}</ul>`
            shownGate = true
            return `<div class="district locked"><h3>${d.label}</h3><p>${d.theme}</p>${gate}</div>`
          }
          const picked = Math.min(this.pick[d.id] ?? d.best, d.best)
          const pips = d.dangers
            .map(
              (x, i) =>
                `<button type="button" class="pip ${i === picked ? 'on' : ''}" data-act="danger" data-district="${d.id}" data-id="${i}" ${x.unlocked ? '' : 'disabled'}>${x.label}</button>`,
            )
            .join('')
          const at = d.dangers[picked]
          const next = d.dangers[picked + 1]
          const marks = at.marks
            .map((mk) => `<li class="${mk.done ? 'done' : ''}">${mk.text}${mk.need > 1 ? ` <small>${Math.min(mk.have, mk.need)}/${mk.need}</small>` : ''}</li>`)
            .join('')
          const goal = at.cleared
            ? 'Marks cleared.'
            : next
              ? `Clear all three to open ${next.name}. Each pays ${costText(at.reward2)}.`
              : `Clear all three, and fell ${d.boss} enough, to open the next map. Each pays ${costText(at.reward2)}.`
          return `<div class="district">
            <h3>${d.label}</h3>
            <p>${d.blurb}</p>
            <div class="pips"><span>Zone</span>${pips}</div>
            <p class="zone"><b>${at.name}</b> · tier ${at.tier} of 30 · ×${at.reward.toFixed(2)} Blood</p>
            <p class="pay">${at.zoneBlurb}</p>
            <ul class="marks">${marks}</ul>
            <p class="goal">${goal} Marks count when you get out.</p>
            <button type="button" class="begin" data-act="begin" data-id="${d.id}">Begin the night</button>
          </div>`
        })
        .join('')
      const om = view.omen
      body =
        `<div class="omen ${om.done ? 'done' : ''}"><b>Tonight's Omen</b><span>${om.done ? 'Met. A new one comes at midnight.' : `${om.text} · ${om.where}`}</span>${om.done ? '' : `<em>Pays ${costText(om.reward)}</em>`}</div>` +
        body +
        `<p class="haven-rules">${view.marksDone} of ${view.marksTotal} marks cleared.</p>`
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
    // The tabs stick just under the header, however tall it wraps on a narrow screen.
    panel.style.setProperty('--head-h', `${(panel.querySelector('.haven-head') as HTMLElement).offsetHeight}px`)
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

  /** The four stats: the value (feeding shows in the hundredths) and what it gives. */
  setStats(rows: { stat: Stat; value: number; effect: string }[]): void {
    for (const row of rows) {
      const el = this.root.querySelector(`.stat-row[data-stat="${row.stat}"]`)!
      ;(el.querySelector('b') as HTMLElement).textContent = row.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      ;(el.querySelector('em') as HTMLElement).textContent = row.effect
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
      `+${(report.strength * FEED_STEP).toFixed(2)} Strength from thralls and bones`,
      `+${(report.agility * FEED_STEP).toFixed(2)} Agility from hounds`,
      `+${(report.vitality * FEED_STEP).toFixed(2)} Vitality from walkers`,
      `+${(report.sorcery * FEED_STEP).toFixed(2)} Sorcery from the miasma`,
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
    el.innerHTML = '<i class="lag"></i><i class="fill"></i><i class="poise"></i><b class="hp"></b>'
    this.barLayer.appendChild(el)
    return el
  }

  private threats: HTMLDivElement[] = []

  /** Red marks at the screen's edge, pointing at abilities winding up out of view. `a` is the screen angle. */
  setThreats(list: { x: number; y: number; a: number }[]): void {
    while (this.threats.length < list.length) {
      const el = document.createElement('div')
      el.className = 'threat'
      this.barLayer.appendChild(el)
      this.threats.push(el)
    }
    this.threats.forEach((el, i) => {
      const t = list[i]
      el.style.display = t ? 'block' : 'none'
      if (t) el.style.transform = `translate(${t.x}px, ${t.y}px) rotate(${t.a}rad)`
    })
  }

  /** An elite's modifier names, hung over its bar. */
  makeTag(): HTMLDivElement {
    const el = document.createElement('div')
    el.className = 'etag'
    el.style.display = 'none'
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

  /** Sets the camera distance, kept within what the game allows. */
  setZoom(z: number): void {
    const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z))
    if (Math.abs(next - this.zoom) < 0.001) return
    this.zoom = next
    this.onZoom(next)
  }

  /** The zoom button: the next preset out, then back to the closest. */
  private stepZoom(): void {
    const next = ZOOM_STEPS.find((z) => z > this.zoom + 0.02) ?? ZOOM_STEPS[0]
    this.setZoom(next)
    const label = next <= 0.85 ? 'Close' : next <= 1.05 ? 'Normal' : next <= 1.3 ? 'Far' : 'Farthest'
    this.toast(`View: ${label}`)
  }

  private onDown = (e: PointerEvent): void => {
    if (this.menuOpen() || this.modalOpen()) return
    if (this.blockedTarget(e.target)) return
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (this.touches.size === 2) {
      // A second finger turns the touch into a pinch: the stick lets go, and no tap fires.
      const [a, b] = [...this.touches.values()]
      this.pinch = { d0: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), z0: this.zoom }
      this.endJoy()
      this.down = null
      return
    }
    if (this.touches.size > 2) return
    const w = window.innerWidth
    const h = window.innerHeight
    if (e.clientY > h - 150) return
    if (e.clientX > w * 0.62) {
      this.down = { x: e.clientX, y: e.clientY, t: performance.now() }
      return
    }
    // The stick appears under the thumb, kept fully on screen.
    const r = JOY_RADIUS + 18
    const ox = Math.max(r, Math.min(w - r, e.clientX))
    const oy = Math.max(r, Math.min(h - r, e.clientY))
    this.joy.active = true
    this.joy.id = e.pointerId
    this.joy.ox = ox
    this.joy.oy = oy
    this.joy.x = 0
    this.joy.y = 0
    this.down = { x: e.clientX, y: e.clientY, t: performance.now() }
    const joy = this.root.querySelector('#joystick') as HTMLElement
    joy.hidden = false
    ;(this.root.querySelector('#joy-ghost') as HTMLElement).classList.add('away')
    this.placeJoy()
    this.moveKnob(e.clientX - ox, e.clientY - oy)
  }

  private placeJoy(): void {
    const base = this.root.querySelector('#joystick .joy-base') as HTMLElement
    base.style.left = `${this.joy.ox}px`
    base.style.top = `${this.joy.oy}px`
  }

  /** Puts the knob at an offset from the stick's center and reads the direction off it. */
  private moveKnob(dx: number, dy: number): void {
    const mag = Math.hypot(dx, dy)
    const clamped = Math.min(mag, JOY_RADIUS)
    const nx = mag > 0 ? (dx / mag) * clamped : 0
    const ny = mag > 0 ? (dy / mag) * clamped : 0
    this.joy.x = nx / JOY_RADIUS
    this.joy.y = -ny / JOY_RADIUS
    const base = this.root.querySelector('#joystick .joy-base') as HTMLElement
    ;(base.querySelector('.joy-knob') as HTMLElement).style.transform = `translate(${nx}px, ${ny}px)`
    const arrow = base.querySelector('.joy-arrow') as HTMLElement
    arrow.style.opacity = clamped > 8 ? String(Math.min(1, clamped / JOY_RADIUS + 0.2)) : '0'
    arrow.style.transform = `rotate(${Math.atan2(ny, nx)}rad)`
    base.classList.toggle('pushed', clamped > JOY_RADIUS * 0.9)
  }

  private onMove = (e: PointerEvent): void => {
    const held = this.touches.get(e.pointerId)
    if (held) {
      held.x = e.clientX
      held.y = e.clientY
    }
    if (this.pinch && this.touches.size >= 2) {
      const [a, b] = [...this.touches.values()]
      const d = Math.max(20, Math.hypot(a.x - b.x, a.y - b.y))
      // Fingers apart brings the camera in; together pushes it out.
      this.setZoom(this.pinch.z0 * (this.pinch.d0 / d))
      return
    }
    if (!this.joy.active || e.pointerId !== this.joy.id) return
    let dx = e.clientX - this.joy.ox
    let dy = e.clientY - this.joy.oy
    const mag = Math.hypot(dx, dy)
    // Past the rim the stick follows the thumb, so a long drag never loses the hero.
    if (mag > JOY_RADIUS * 1.35) {
      const over = mag - JOY_RADIUS
      this.joy.ox += (dx / mag) * over
      this.joy.oy += (dy / mag) * over
      this.placeJoy()
      dx = e.clientX - this.joy.ox
      dy = e.clientY - this.joy.oy
    }
    this.moveKnob(dx, dy)
  }

  private onUp = (e: PointerEvent): void => {
    this.touches.delete(e.pointerId)
    if (this.pinch && this.touches.size < 2) {
      this.pinch = null
      this.down = null
    }
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
    ;(this.root.querySelector('#joy-ghost') as HTMLElement).classList.remove('away')
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
