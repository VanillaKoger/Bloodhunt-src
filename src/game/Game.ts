import * as THREE from 'three'
import {
  ARENA_R,
  ENEMIES,
  FEED_COLOR,
  MAX_GEAR,
  NODE,
  SKILL_META,
  GROWTH,
  KING_ARENA,
  LITTER,
  NESTS,
  bossBlueprint,
  donBlueprint,
  combatStat,
  enemyMitigate,
  enemyStats,
  formatNum,
  gearFlat,
  clawTier,
  gearName,
  kingArmor,
  nextClawTier,
  grantXp,
  mitigate,
  profile,
  sheetStat,
  skillDamage,
  upgradeCost,
  xpNeed,
  type CombatProfile,
} from './balance'
import { Hud } from './hud'
import {
  animateHero,
  animateRig,
  applyGearVisual,
  createBoss,
  createDon,
  createEnforcer,
  createGhoul,
  createHero,
  createRat,
  createThug,
  createWitch,
  createWolf,
  type Rig,
} from './models'
import { loadSave, takeOfflineGains, writeSave } from './save'
import { Sfx } from './sfx'
import type { EnemyKind, SaveData, SkillId, Slot } from './types'
import { SKILLS, STATS } from './types'
import type { KenneyLib } from './kenney'
import { createStage, makeDrift, qualityLow, type Stage } from './polish'
import { DISTRICT_OPEN, FOG_COLOR, HERO_START, MOB_ARRIVE, MOB_GATE, MOB_Z, NORTH_ALLEY_SHIFT, SLUM_GATE, SLUM_RETURN, buildWorld, inSlums, nearestSlum, setNodeVisual, type WorldHandle } from './world'

interface Actor {
  id: number
  kind: 'hero' | EnemyKind
  rig: Rig
  x: number
  z: number
  facing: number
  hp: number
  maxHp: number
  atkCd: number
  swingT: number
  swingDur: number
  /** Elapsed time of the current hero swing. 0 means idle. */
  atkT: number
  struck: boolean
  hitFlash: number
  flinch: number
  knockT: number
  kx: number
  kz: number
  dead: boolean
  deathT: number
  respawn: number
  radius: number
  barY: number
  moving: number
  dmg: number
  speed: number
  armor: number
  rewardXp: number
  rewardBlood: number
  /** Index into the Slums nest list. -1 for litter, bosses, and the held district. */
  nest: number
  returns: boolean
  barLag: number
  barT: number
  barFlash: number
  bar: HTMLDivElement
  pending: { t: number; dmg: number; boss: boolean } | null
  poundT: number
  poundCd: number
  poundX: number
  poundZ: number
  added: boolean
  intro: number
  wanderT: number
  wanderA: number
  contact: THREE.Mesh
  /** Practice target. Stays put, never attacks, and stands back up 2s after it falls. */
  dummy: boolean
}

interface Spark {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  max: number
  r: number
  g: number
  b: number
}

interface Drop {
  mesh: THREE.Mesh
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  value: number
}

interface Bolt {
  mesh: THREE.Mesh
  x: number
  y: number
  z: number
  vx: number
  vz: number
  life: number
  dmg: number
}

interface Floater {
  el: HTMLDivElement
  x: number
  y: number
  z: number
  vy: number
  life: number
  max: number
}

const PAD_LAYOUT: [number, number][] = [
  [2.4, 2.6],
  [-4.8, 2.8],
  [1.4, -3.2],
  [-5.2, -6.2],
  [0.2, 6.8],
  [-2.4, -6.6],
  [-40.4, 22.4],
  [-36.2, 26.2],
  [-25.2, -47.6],
  [-20.4, -44.2],
  [-20.9, -34.0],
  [-8.0, -24.15],
  [0.8, 13.6],
]
const MOB_PADS: [number, number][] = PAD_LAYOUT.map(([x, z]) => [x * 0.85, z * 0.85 + MOB_Z])
const PADS: [number, number][] = PAD_LAYOUT.map(([x, z]) => (x === 0.8 && z === 13.6 ? [x, z + NORTH_ALLEY_SHIFT] : [x, z]))

interface NestRuntime {
  kind: Exclude<EnemyKind, 'boss' | 'don'>
  x: number
  z: number
  role: 'opening' | 'later' | 'alt'
  actor: Actor | null
  timer: number
}

const HERO_CLEAR = 2.15

const GEAR_BLURB: Record<Slot, (lv: number, evolved: boolean) => string> = {
  weapon: (lv, ev) => `+${4 * lv + (ev ? 8 : 0)} Strength · +${lv} Vitality`,
  cape: (lv, ev) => `+${3 * lv + (ev ? 8 : 0)} Sorcery · +${2 * lv} Resistance`,
  coat: (lv, ev) => `+${4 * lv + (ev ? 8 : 0)} Fortitude · +${3 * lv} Vitality`,
  boots: (lv, ev) => `+${4 * lv + (ev ? 8 : 0)} Agility · +${lv} Fortitude`,
}

export class Game {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private hud: Hud
  private sfx = new Sfx()
  private save: SaveData
  private world: WorldHandle
  private hero: Actor
  private enemies: Actor[] = []
  private nextId = 1
  private mode: 'play' | 'menu' = 'play'
  private loopOn = false
  private scheduled = false
  private last = 0
  private viewW = 1
  private viewH = 1
  private sessionT = 0
  private recentKills: number[] = []
  private saveAcc = 0
  private activeAcc = 0
  private freezeClock = false
  private hintT = 0
  private skillsFired = 0
  private hits = 0
  private nodeBlood = 0
  private summonCd = 0
  private iframe = 0
  private dashT = 0
  private dashVx = 0
  private dashVz = 0
  private dashHit = new Set<number>()
  private cooldowns: Record<SkillId, number> = { bats: 0, drain: 0, dash: 0, nova: 0 }
  private cdMax: Record<SkillId, number> = { bats: 0.001, drain: 0.001, dash: 0.001, nova: 0.001 }
  private batT = 0
  private batTick = 0
  private batR = 0.4
  private bats: THREE.Group[] = []
  private novaT = 0
  private novaHit = false
  private beamT = 0
  private beamTarget: Actor | null = null
  private slashT = 0
  private shake = 0
  private hitStop = 0
  private readonly tip = new THREE.Vector3()
  private trailPts: THREE.Vector3[] = []
  private trailPos = new Float32Array(10 * 2 * 3)
  private trail: THREE.Mesh
  private impacts: { mesh: THREE.Sprite; life: number }[] = []
  private moteAcc = 0
  private fps = 60
  private sparks: Spark[] = []
  private sparkPos = new Float32Array(220 * 3)
  private sparkCol = new Float32Array(220 * 3)
  private sparkGeom = new THREE.BufferGeometry()
  private drops: Drop[] = []
  private dropPool: THREE.Mesh[] = []
  private bolts: Bolt[] = []
  private floaters: Floater[] = []
  private floatPool: HTMLDivElement[] = []
  private camPos = new THREE.Vector3(6, 11, 8)
  private look = new THREE.Vector3()
  private camFwd = new THREE.Vector3(0, 0, -1)
  private camRight = new THREE.Vector3(1, 0, 0)
  private readonly up = new THREE.Vector3(0, 1, 0)
  private readonly tmp = new THREE.Vector3()
  private readonly tmp2 = new THREE.Vector3()
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private slash: THREE.Sprite
  private beam: THREE.Mesh
  private novaRing: THREE.Mesh
  private poundRing: THREE.Mesh
  private bloodMat: THREE.MeshLambertMaterial
  private frames = 0
  private paintedDraws = 0
  private paintedTris = 0
  private startPaused = new URLSearchParams(location.search).has('paused')
  /** Tries spent on the one-shot HUD portrait. Stays high once the still is stored. */
  private portraitTries = 0
  /** Nests, packs, and the Rat King stay in the data. They only spawn with ?enemies=1. */
  private foes = new URLSearchParams(location.search).has('enemies')
  /** Scripted walk for the environment tour. Normal play leaves this null. */
  private guide: { x: number; z: number } | null = null
  private guideSpeed = 1.85
  private boss: Actor | null = null
  private don: Actor | null = null
  private donCd = 0
  private district: 'slums' | 'mob' = 'slums'
  private travelCd = 0
  private gateNag = 0
  private moveTries = 0
  private moveOk = 0
  private gait = 0
  private gaitTarget = 0
  /** Eased ground speed (m/s) the hero clips follow. */
  private loco = 0
  private locoTarget = 0
  private phase = 0
  private hipYaw = 0
  private lockId: number | null = null
  private lockCandidate: number | null = null
  private lockCandT = 0
  private lockBlend = 0
  /** Body lock. Separate from the dash lock above. */
  private aimId: number | null = null
  private moveYaw: number | null = null
  private lockRing: THREE.Mesh
  private aimRing: THREE.Mesh
  private debugCam: 'play' | 'close' | 'claws' | 'enemy' | 'duel' | 'portrait' | 'facade' | 'map' | 'king' = 'play'
  private nests: NestRuntime[] = []
  private readonly kenney: KenneyLib | null
  private stage!: Stage
  private drift!: ReturnType<typeof makeDrift>
  private contactGeo!: THREE.CircleGeometry
  private contactMat!: THREE.MeshBasicMaterial

  constructor(parent: HTMLElement, kenney: KenneyLib | null = null) {
    this.kenney = kenney
    this.hud = new Hud(parent)
    this.save = loadSave()
    this.sfx.setMuted(this.save.muted)
    this.hud.setMuted(this.save.muted)
    const canvas = this.hud.canvas
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: new URLSearchParams(location.search).has('tour'),
      })
    } catch (err) {
      this.hud.bootError('This device could not start the hunt. WebGL is unavailable.')
      throw err
    }
    if (!renderer.getContext()) {
      this.hud.bootError('This device could not start the hunt. WebGL is unavailable.')
      throw new Error('No WebGL context')
    }
    this.renderer = renderer
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.setClearColor(FOG_COLOR)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    if (!qualityLow()) {
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
    }
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 480)
    this.scene.add(this.camera)

    this.world = buildWorld(this.scene, kenney ? (scene, blocks) => kenney.dress(scene, blocks) : undefined)
    for (const id of ['crypt', 'fountain'] as const) {
      const node = this.world.nodes[id]
      node.group.userData.readyAt = 0
      node.group.userData.ready = true
      node.group.userData.channel = 0
      setNodeVisual(node, true)
    }
    this.resize()
    this.stage = createStage(this.renderer, this.scene, this.camera)
    this.stage.resize(this.viewW, this.viewH)
    window.addEventListener('resize', this.resize)
    this.drift = makeDrift(this.stage.low)
    this.scene.add(this.drift.points)
    this.contactGeo = new THREE.CircleGeometry(1, 16)
    this.contactMat = new THREE.MeshBasicMaterial({
      color: 0x07040c,
      map: circleTexture(),
      transparent: true,
      opacity: this.stage.low ? 0.55 : 0.4,
      depthWrite: false,
    })

    this.sparkGeom.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3))
    this.sparkGeom.setAttribute('color', new THREE.BufferAttribute(this.sparkCol, 3))
    this.sparkGeom.setDrawRange(0, 0)
    const points = new THREE.Points(
      this.sparkGeom,
      new THREE.PointsMaterial({
        size: 0.2,
        map: circleTexture(),
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    )
    this.scene.add(points)

    this.slash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: slashTexture(),
        color: 0xff3348,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    this.slash.scale.set(1.7, 1.2, 1)
    this.slash.visible = false
    this.scene.add(this.slash)
    this.trail = makeTrail(this.trailPos)
    this.scene.add(this.trail)
    const impactMap = impactTexture()
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: impactMap,
          color: 0xfff2f4,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      mesh.visible = false
      mesh.scale.setScalar(0.2)
      this.scene.add(mesh)
      this.impacts.push({ mesh, life: 0 })
    }

    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.09, 1, 7),
      new THREE.MeshBasicMaterial({
        color: 0xff2244,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    this.beam.visible = false
    this.scene.add(this.beam)

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff3358,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.novaRing = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.98, 48), ringMat)
    this.novaRing.rotation.x = -Math.PI / 2
    this.novaRing.visible = false
    this.scene.add(this.novaRing)

    this.poundRing = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.92, 40),
      new THREE.MeshBasicMaterial({
        color: 0xff5530,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    this.poundRing.rotation.x = -Math.PI / 2
    this.poundRing.visible = false
    this.scene.add(this.poundRing)

    this.lockRing = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.55, 28),
      new THREE.MeshBasicMaterial({
        color: 0xff4466,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    this.lockRing.rotation.x = -Math.PI / 2
    this.lockRing.visible = false
    this.scene.add(this.lockRing)

    this.aimRing = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.74, 32),
      new THREE.MeshBasicMaterial({
        color: 0xf0d38a,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    this.aimRing.rotation.x = -Math.PI / 2
    this.aimRing.visible = false
    this.scene.add(this.aimRing)

    this.bloodMat = new THREE.MeshLambertMaterial({
      color: 0xc81030,
      emissive: 0xff2244,
      emissiveIntensity: 1.7,
    })

    for (let i = 0; i < 8; i++) this.bats.push(makeBat())
    for (const b of this.bats) {
      b.visible = false
      this.scene.add(b)
    }

    for (const id of ['crypt', 'fountain'] as const) {
      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 0.9, 1.7, 10),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      )
      hit.position.y = 0.85
      hit.userData.nodeId = id
      this.world.nodes[id].group.add(hit)
    }

    const params = new URLSearchParams(location.search)
    this.district = DISTRICT_OPEN && params.get('district') === 'mob' ? 'mob' : 'slums'
    if (this.save.bossKills > 0) {
      this.world.gateGlow.emissiveIntensity = 1.7
      this.world.gateGlow.color.setHex(0xff4ad8)
    }
    this.hud.setDistrict(this.district === 'mob' ? 'THE DISTRICT' : 'THE SLUMS')
    const prof = profile(this.save)
    const heroRig = kenney ? kenney.hero() : createHero()
    const start = this.district === 'mob' ? MOB_ARRIVE : HERO_START
    this.hero = this.makeActor('hero', heroRig, start.x, start.z, prof.hp, 0.4, 1.95)
    this.applyWeaponLook()

    this.nests = NESTS.map((nest) => ({
      kind: nest.kind,
      x: nest.x,
      z: nest.z,
      role: nest.role,
      actor: null,
      timer: nest.role === 'later' ? GROWTH[nest.kind].return : 0,
    }))
    if (this.foes) {
      this.nests.forEach((nest, index) => {
        if (nest.role !== 'opening') return
        nest.actor = this.spawnEnemy(nest.kind, nest.x, nest.z, { nest: index, returns: true })
      })
    }
    this.layDummies()
    this.paintSpawns()
    if (this.foes && DISTRICT_OPEN) {
      const district: [Exclude<EnemyKind, 'boss' | 'don'>, number, number][] = [
        ['thug', 1.15, MOB_Z + 0.35],
        ['thug', -1.45, MOB_Z - 0.7],
        ['enforcer', 2.35, MOB_Z + 1.45],
        ['thug', -2.55, MOB_Z + 1.15],
        ['enforcer', 0.35, MOB_Z - 2.05],
      ]
      for (const [kind, x, z] of district) this.spawnEnemy(kind, x, z)
      if (params.has('don')) this.summonDon(true)
    }

    this.hud.onSkill = (id) => this.cast(id)
    this.hud.onOpenMenu = () => this.openMenu()
    this.hud.onCloseMenu = () => this.closeMenu()
    this.hud.onSelectSlot = () => this.refreshMenu()
    this.hud.onUpgrade = () => this.upgrade()
    this.hud.onSummon = () => this.trySummon()
    this.hud.onClaim = () => this.claimOffline()
    this.hud.onMute = () => this.toggleMute()
    this.hud.onTap = (x, y) => this.onTap(x, y)
    this.hud.showHint(!this.save.seenHint)

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return
      const map: Partial<Record<string, SkillId>> = {
        Digit1: 'bats',
        Digit2: 'drain',
        Digit3: 'dash',
        Digit4: 'nova',
      }
      const skill = map[e.code]
      if (skill) this.cast(skill)
      if (e.code === 'KeyG') this.openMenu()
      if (e.code === 'Escape') this.closeMenu()
      if (e.code === 'KeyM') this.toggleMute()
      if (e.code === 'KeyB') this.trySummon()
    })

    const unlock = () => this.sfx.unlock()
    window.addEventListener('pointerdown', unlock)
    document.addEventListener('visibilitychange', this.onVisibility)
    window.addEventListener('pagehide', () => this.persist())

    const report = takeOfflineGains(this.save, Date.now())
    if (report) {
      this.persist()
      this.hud.showOffline(report)
    }

    this.publish(false)
  }

  start(): void {
    this.last = performance.now()
    this.loopOn = true
    if (!this.scheduled) {
      this.scheduled = true
      requestAnimationFrame(this.frame)
    }
  }

  private frame = (now: number): void => {
    this.scheduled = false
    if (!this.loopOn) return
    const dt = Math.min(0.08, Math.max(0, (now - this.last) / 1000))
    this.last = now
    if (dt > 0) {
      if (!this.paused() && this.hitStop > 0) {
        this.hitStop = Math.max(0, this.hitStop - dt)
        this.updateImpacts(dt)
        this.updateBars(dt)
        this.updateCamera(dt, false)
        this.kenney?.fadeBlockers(this.camera, this.hero.x, this.hero.z, dt, this.debugCam === 'play' && this.mode !== 'menu')
        this.kenney?.drift(dt)
      } else this.update(dt)
    }
    this.paint()
    this.frames++
    if (this.frames === 2) this.publish(true)
    else if (this.frames % 10 === 0) this.publish(true)
    this.scheduled = true
    requestAnimationFrame(this.frame)
  }

  /** Counts every pass in this frame. The composer’s last pass would otherwise wipe the scene totals. */
  private paint(): void {
    this.renderer.info.autoReset = false
    this.renderer.info.reset()
    this.stage.present()
    this.renderer.info.autoReset = true
    this.paintedDraws = this.renderer.info.render.calls
    this.paintedTris = this.renderer.info.render.triangles
  }

  private resize = (): void => {
    const w = this.hud.root.clientWidth || window.innerWidth
    const h = this.hud.root.clientHeight || window.innerHeight
    this.viewW = w
    this.viewH = h
    this.camera.aspect = w / Math.max(1, h)
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
    this.stage?.resize(w, h)
  }

  private onVisibility = (): void => {
    if (document.hidden) {
      this.persist()
      this.loopOn = false
      return
    }
    const report = takeOfflineGains(this.save, Date.now())
    this.last = performance.now()
    if (report) {
      this.persist()
      this.hud.showOffline(report)
    }
    this.start()
  }

  private paused(): boolean {
    return this.startPaused || this.mode !== 'play' || this.hud.modalOpen()
  }

  private update(dt: number): void {
    const paused = this.paused()
    const prof = profile(this.save)
    this.syncVitals(prof)
    if (!paused) {
      this.sessionT += dt
      this.hintT += dt
      this.iframe = Math.max(0, this.iframe - dt)
      this.summonCd = Math.max(0, this.summonCd - dt)
      this.donCd = Math.max(0, this.donCd - dt)
      this.travelCd = Math.max(0, this.travelCd - dt)
      this.gateNag = Math.max(0, this.gateNag - dt)
      for (const id of SKILLS) this.cooldowns[id] = Math.max(0, this.cooldowns[id] - dt)
      if (!this.save.seenHint && (this.hintT > 9 || this.hud.getMove().active)) {
        this.save.seenHint = true
        this.hud.showHint(false)
      }
      this.updateHero(dt, prof)
      this.updateEnemies(dt)
      this.updateBats(dt, prof)
      this.updateNova(dt, prof)
      this.updateBeam(dt)
      this.updateDrops(dt)
      this.updateBolts(dt, prof)
      this.updateNodes(dt)
      this.motes(dt)
      this.activeAcc += dt
      if (this.activeAcc >= 1 && !this.freezeClock) {
        this.activeAcc = 0
        this.save.lastActiveAt = Date.now()
      }
      this.saveAcc += dt
      if (this.saveAcc >= 30) {
        this.saveAcc = 0
        this.recomputeRate()
        this.persist()
      }
    } else {
      this.hero.moving = 0
      this.hero.swingT = 0
      this.gaitTarget = 0
      this.locoTarget = 0
      this.hipYaw = this.dampAngle(this.hipYaw, 0, dt, 8)
      this.lockBlend = this.damp(this.lockBlend, 0, dt, 8)
      this.lockRing.visible = false
      this.aimRing.visible = false
      this.placeActor(this.hero)
      this.animateActor(this.hero, dt)
      for (const e of this.enemies) {
        e.moving = 0
        this.placeActor(e)
        this.animateActor(e, dt)
      }
      if (this.mode === 'menu') this.faceHeroToCamera(dt)
    }
    this.updateSlash(dt)
    this.updateTrail(dt)
    this.updateImpacts(dt)
    this.updateCamera(dt, paused)
    const iso = this.debugCam === 'play' && this.mode !== 'menu'
    this.kenney?.fadeBlockers(this.camera, this.hero.x, this.hero.z, dt, iso)
    this.kenney?.drift(dt)
    this.drift.tick(dt, this.hero.x, this.hero.z)
    this.syncContacts()
    this.updateSparks(dt)
    this.updateFloats(dt)
    this.updateBars(dt)
    this.updateHud()
    if (this.portraitTries < 8 && this.frames >= 1) this.snapPortrait()
    if (dt > 0) this.fps = this.fps * 0.9 + (1 / dt) * 0.1
  }

  private updateHero(dt: number, prof: CombatProfile): void {
    const hero = this.hero
    if (hero.dead) {
      hero.atkT = 0
      hero.deathT -= dt
      hero.rig.bob.position.y = -0.3
      hero.rig.bob.scale.setScalar(0.9)
      if (hero.deathT <= 0) {
        hero.dead = false
        hero.hp = hero.maxHp * 0.65
        this.iframe = 1.3
        hero.rig.bob.scale.setScalar(1)
        this.hud.toast('Mist gathers. You stand again.')
      }
      this.animateActor(hero, dt)
      return
    }
    if (hero.hp < hero.maxHp) hero.hp = Math.min(hero.maxHp, hero.hp + prof.regen * dt)

    const move = this.hud.getMove()
    const x0 = hero.x
    const z0 = hero.z
    let moveYaw: number | null = null
    const dashing = this.dashT > 0
    if (dashing) {
      this.dashT -= dt
      this.moveActor(hero, this.dashVx * dt, this.dashVz * dt)
      hero.moving = 1
      moveYaw = Math.atan2(this.dashVx, this.dashVz)
      for (const e of this.enemies) {
        if (e.dead || this.dashHit.has(e.id)) continue
        if (Math.hypot(e.x - hero.x, e.z - hero.z) < 1.05 + e.radius) {
          this.dashHit.add(e.id)
          this.damageEnemy(e, skillDamage('dash', prof), false)
        }
      }
    } else if (move.active) {
      const dx = (this.camFwd.x * move.y + this.camRight.x * move.x) * prof.speed * dt
      const dz = (this.camFwd.z * move.y + this.camRight.z * move.x) * prof.speed * dt
      this.moveActor(hero, dx, dz)
      hero.moving = 1
      moveYaw = Math.atan2(dx, dz)
    } else if (this.guide) {
      const gx = this.guide.x - hero.x
      const gz = this.guide.z - hero.z
      const dist = Math.hypot(gx, gz) || 1
      const step = Math.min(dist, this.guideSpeed * dt)
      if (step < 0.012) {
        hero.moving = 0
      } else {
        this.moveActor(hero, (gx / dist) * step, (gz / dist) * step)
        hero.moving = 1
        moveYaw = Math.atan2(gx, gz)
      }
    } else {
      hero.moving = 0
    }
    const moved = Math.hypot(hero.x - x0, hero.z - z0)
    const travel = moved > 0.012 ? Math.atan2(hero.x - x0, hero.z - z0) : null
    const lock = this.updateLock(dt)
    const attackTarget =
      !dashing && hero.atkCd <= 0 && hero.atkT <= 0 ? this.nearest(2.15, false, true) : null
    const aim = this.updateAimLock(attackTarget)
    if (dashing) {
      const desiredFace = lock
        ? Math.atan2(lock.x - hero.x, lock.z - hero.z)
        : (moveYaw ?? hero.facing)
      hero.facing = this.dampAngle(hero.facing, desiredFace, dt, lock ? 8 : 4.6)
      const desiredHip = moveYaw === null ? 0 : this.wrapAngle(moveYaw - hero.facing)
      this.hipYaw = this.dampAngle(this.hipYaw, desiredHip, dt, 6.5)
    } else {
      this.faceCombat(hero, travel, dt, aim)
    }
    const speed = moved / Math.max(dt, 0.001)
    this.locoTarget = hero.moving > 0 ? speed : 0
    this.gaitTarget = hero.moving > 0 ? Math.min(1, speed / Math.max(0.8, prof.speed)) : 0
    const stepLen = 0.52 * Math.max(0.4, this.gait)
    this.phase += (moved / stepLen) * Math.PI
    this.moveYaw = dashing ? moveYaw : travel
    this.lockBlend = this.damp(this.lockBlend, lock ? 1 : 0, dt, 8)
    this.placeAimRing(aim)
    if (dashing) this.placeLockRing(lock)
    else this.lockRing.visible = false

    hero.atkCd -= dt
    hero.swingT = Math.max(0, hero.swingT - dt)
    if (hero.atkT > 0) {
      hero.atkT += dt
      const len = hero.swingDur
      if (hero.atkT >= len * 0.4) this.slashT = Math.max(this.slashT, 0.18)
      if (!hero.struck && hero.atkT >= len * 0.48) {
        hero.struck = true
        this.resolveStrike(prof)
      }
      if (hero.atkT >= len) hero.atkT = 0
    }
    if (this.dashT <= 0 && hero.atkCd <= 0 && hero.atkT <= 0) {
      const target = this.nearest(2.15, false, true)
      if (target) {
        const len = Math.min(0.4, Math.max(0.22, prof.interval * 0.86))
        hero.atkCd = prof.interval
        hero.atkT = 0.0001
        hero.struck = false
        hero.swingDur = len
        hero.swingT = len
      }
    }
    this.animateActor(hero, dt)
    hero.rig.root.position.set(hero.x, 0, hero.z)
    hero.rig.root.rotation.y = hero.facing
    this.sampleTrail()
    this.touchGate()
  }

  /**
   * This rig's world forward is (sin θ, −cos θ). The yaw below is the
   * one that puts the eyes and the hips along a world direction.
   */
  private yawAlong(dx: number, dz: number): number {
    return Math.atan2(dx, -dz)
  }

  /**
   * Face the way the body is moving. Travel is atan2(dx, dz); the rig
   * yaw that looks along that vector is atan2(dx, −dz). A stop leaves
   * the last facing. The turn is a shortest-angle lerp.
   * Dash does not call this.
   */
  private faceTravel(hero: Actor, travel: number | null, dt: number): void {
    if (travel !== null) {
      const yaw = this.yawAlong(Math.sin(travel), Math.cos(travel))
      hero.facing = this.dampAngle(hero.facing, yaw, dt, 12)
    }
    this.hipYaw = this.dampAngle(this.hipYaw, 0, dt, 10)
  }

  /**
   * A held target owns the root yaw. It is written every frame, not
   * eased, so a strafe cannot tug the torso toward the move. With no
   * lock, the body faces travel again. Dash does not call this. The
   * KayKit set has walk and run only, so the feet stay on that walk.
   */
  private faceCombat(hero: Actor, travel: number | null, dt: number, aim: Actor | null): void {
    if (!aim) {
      this.faceTravel(hero, travel, dt)
      return
    }
    hero.facing = this.yawAlong(aim.x - hero.x, aim.z - hero.z)
    this.hipYaw = 0
  }

  /**
   * Body lock. Grabs the nearest target on an attack or inside 2.5 m,
   * holds them out to 5 m, and lets a tap move to the next nearest.
   * Death and the 5 m edge both let go. Dash keeps its own lock.
   */
  private updateAimLock(attackTarget: Actor | null): Actor | null {
    const acquire = 2.5
    const release = 5
    const alive = this.enemies.filter((e) => !e.dead && e.kind !== 'hero')
    const distOf = (e: Actor) => Math.hypot(e.x - this.hero.x, e.z - this.hero.z)
    let current = this.aimId == null ? null : (alive.find((e) => e.id === this.aimId) ?? null)
    if (current && distOf(current) > release) current = null
    if (this.hud.takeCycle()) {
      const pool = alive.filter((e) => distOf(e) <= release)
      pool.sort((a, b) => distOf(a) - distOf(b))
      if (pool.length) {
        const idx = current ? pool.findIndex((e) => e.id === current!.id) : -1
        current = pool[(idx + 1) % pool.length] ?? null
      }
    }
    if (!current) current = attackTarget ?? this.nearest(acquire, false, true)
    this.aimId = current?.id ?? null
    return current
  }

  private resolveStrike(prof: CombatProfile): void {
    const hero = this.hero
    const fx = Math.sin(hero.facing)
    const fz = -Math.cos(hero.facing)
    let any = false
    let fought = false
    for (const e of this.enemies) {
      if (e.dead || e.kind === 'hero') continue
      const dx = e.x - hero.x
      const dz = e.z - hero.z
      const dist = Math.hypot(dx, dz) || 0.0001
      const reach = 1.95 + e.radius * 0.35
      if (dist > reach) continue
      const dot = (dx / dist) * fx + (dz / dist) * fz
      if (dot < 0.15) continue
      const crit = Math.random() < prof.crit
      const dmg = prof.dmg * (crit ? 1.7 : 1)
      this.damageEnemy(e, dmg, crit)
      const nx = dx / dist
      const nz = dz / dist
      if (!e.dummy) {
        e.kx = nx * 14
        e.kz = nz * 14
        e.knockT = 0.22
        fought = true
      }
      e.flinch = 0.2
      e.hitFlash = 0.18
      this.spawnImpact(hero.x + nx * Math.min(dist, 1.15), 1.05, hero.z + nz * Math.min(dist, 1.15))
      any = true
    }
    if (any) {
      this.sfx.play('hit')
      if (fought) this.hitStop = 0.08
      this.shake = Math.max(this.shake, 0.26)
    }
  }

  private sampleTrail(): void {
    const hero = this.hero
    if (hero.atkT <= 0 || hero.swingDur <= 0) return
    const u = hero.atkT / hero.swingDur
    if (u < 0.3 || u > 0.78) return
    const hand = hero.rig.claws[0]?.getObjectByName('claw-tip') ?? hero.rig.claws[0] ?? hero.rig.armR
    hand.updateWorldMatrix(true, true)
    this.tip.setFromMatrixPosition(hand.matrixWorld)
    this.trailPts.push(this.tip.clone())
    if (this.trailPts.length > 10) this.trailPts.shift()
  }

  private updateTrail(dt: number): void {
    const u = this.hero.atkT > 0 && this.hero.swingDur > 0 ? this.hero.atkT / this.hero.swingDur : 0
    const live = u >= 0.3 && u <= 0.8
    if (!live && this.trailPts.length > 0 && dt > 0) {
      const drop = Math.max(1, Math.round(dt * 36))
      this.trailPts.splice(0, drop)
    }
    const n = this.trailPts.length
    const geo = this.trail.geometry as THREE.BufferGeometry
    if (n < 2) {
      this.trail.visible = false
      geo.setDrawRange(0, 0)
      return
    }
    this.trail.visible = true
    const arr = this.trailPos
    arr.fill(0)
    for (let i = 0; i < n; i++) {
      const p = this.trailPts[i]
      const prev = this.trailPts[Math.max(0, i - 1)]
      const next = this.trailPts[Math.min(n - 1, i + 1)]
      let rx = next.z - prev.z
      let rz = -(next.x - prev.x)
      const rl = Math.hypot(rx, rz) || 1
      rx /= rl
      rz /= rl
      const w = (0.1 + (i / (n - 1)) * 0.28) * this.heroVisual()
      const o = i * 6
      arr[o] = p.x + rx * w
      arr[o + 1] = p.y + 0.05
      arr[o + 2] = p.z + rz * w
      arr[o + 3] = p.x - rx * w
      arr[o + 4] = p.y - 0.04
      arr[o + 5] = p.z - rz * w
    }
    geo.setDrawRange(0, (n - 1) * 6)
    geo.attributes.position.needsUpdate = true
    geo.computeBoundingSphere()
  }

  private spawnImpact(x: number, y: number, z: number): void {
    const slot = this.impacts.find((item) => item.life <= 0) ?? this.impacts[0]
    slot.life = 0.2
    slot.mesh.visible = true
    slot.mesh.position.set(x, y, z)
    slot.mesh.scale.setScalar(0.55)
    ;(slot.mesh.material as THREE.SpriteMaterial).opacity = 1
  }

  private updateImpacts(dt: number): void {
    for (const slot of this.impacts) {
      if (slot.life <= 0) continue
      slot.life -= dt
      const k = 1 - Math.max(0, slot.life) / 0.2
      slot.mesh.visible = slot.life > 0
      slot.mesh.scale.setScalar(0.55 + k * 2.1)
      ;(slot.mesh.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - k)
    }
  }

  private updateEnemies(dt: number): void {
    const hero = this.hero
    this.tickNests(dt)
    for (const e of this.enemies) {
      if (e.dummy) {
        e.moving = 0
        e.pending = null
        e.knockT = 0
        e.kx = 0
        e.kz = 0
        e.speed = 0
        e.dmg = 0
        e.hitFlash = Math.max(0, e.hitFlash - dt)
        e.flinch = Math.max(0, e.flinch - dt)
        if (e.dead) {
          const first = e.deathT === 0
          e.deathT += dt
          const p = Math.min(1, e.deathT / 0.65)
          e.rig.bob.scale.set(1 + p * 0.08, Math.max(0.05, 1 - p), 1)
          e.rig.bob.position.y = -p * 0.42
          if (e.deathT > 0.65) {
            e.rig.root.visible = false
            e.bar.style.display = 'none'
          }
          if (!first) e.respawn -= dt
          if (e.respawn <= 0.001) this.reviveDummy(e)
        }
        this.placeActor(e)
        this.animateActor(e, dt)
        continue
      }
      if (e.dead) {
        e.deathT += dt
        const p = Math.min(1, e.deathT / 0.4)
        e.rig.bob.scale.set(1 + p * 0.1, Math.max(0.05, 1 - p), 1)
        e.rig.bob.position.y = -p * 0.45
        if (e.deathT > 0.4) {
          e.rig.root.visible = false
          if (e.bar) e.bar.style.display = 'none'
          if (e.returns && e.nest < 0 && e.kind !== 'boss' && e.kind !== 'don' && e.kind !== 'hero') {
            const kind = e.kind
            e.respawn -= dt
            if (e.respawn <= 0 && this.livingKind(kind) < this.kindCap(kind)) {
              const pad = this.pickPad('mob')
              if (this.clearSpawn(pad.x, pad.z, e.radius)) this.revive(e, pad.x, pad.z)
              else e.respawn = 1.2
            }
          }
        }
        continue
      }
      if (e.intro > 0) {
        e.intro -= dt
        e.moving = 0
        this.turnTowardPoint(e, hero.x, hero.z, dt, 6)
        this.placeActor(e)
        this.animateActor(e, dt)
        continue
      }
      e.swingT = Math.max(0, e.swingT - dt)
      e.hitFlash = Math.max(0, e.hitFlash - dt)
      e.flinch = Math.max(0, e.flinch - dt)
      if (e.knockT > 0) {
        e.knockT -= dt
        this.moveActor(e, e.kx * dt, e.kz * dt)
        const decay = Math.exp(-6 * dt)
        e.kx *= decay
        e.kz *= decay
        e.moving = 0
        this.turnTowardPoint(e, hero.x, hero.z, dt, 4)
        this.placeActor(e)
        this.animateActor(e, dt)
        continue
      }
      if (e.pending) {
        e.pending.t -= dt
        if (e.pending.t <= 0) {
          const pending = e.pending
          e.pending = null
          if (!hero.dead && this.iframe <= 0 && Math.hypot(hero.x - e.x, hero.z - e.z) < e.radius + 1.35) {
            this.damageHero(pending.dmg, pending.boss)
          }
        }
      }
      const dist = Math.hypot(hero.x - e.x, hero.z - e.z)
      if (e.kind === 'hero') continue
      const bossing = e.kind === 'boss' || e.kind === 'don'
      const sheet = e.kind === 'boss' || e.kind === 'don' ? this.rivalBlueprint(e.kind) : null
      const def = e.kind === 'boss' || e.kind === 'don' ? null : ENEMIES[e.kind]
      const speed = sheet ? sheet.speed : e.speed
      const range = bossing ? 1.45 : def!.range
      const aggro = bossing ? 12 : def!.aggro
      if (bossing && e.poundT > 0) {
        e.poundT -= dt
        e.moving = 0
        this.poundRing.visible = true
        const k = 1 - e.poundT / 0.72
        this.poundRing.position.set(e.poundX, 0.06, e.poundZ)
        this.poundRing.scale.setScalar(0.6 + k * 2.4)
        ;(this.poundRing.material as THREE.MeshBasicMaterial).opacity = 0.25 + k * 0.55
        if (e.poundT <= 0) {
          this.poundRing.visible = false
          this.shake = Math.max(this.shake, 0.45)
          if (!hero.dead && this.iframe <= 0 && Math.hypot(hero.x - e.poundX, hero.z - e.poundZ) < 2.25) {
            this.damageHero(this.rivalBlueprint(e.kind === 'don' ? 'don' : 'boss').pound, true)
          }
          this.burst(e.poundX, 0.3, e.poundZ, 0xff4428, 16, 3.4, 0.45)
        }
      } else if (dist < aggro && !hero.dead) {
        this.turnTowardPoint(e, hero.x, hero.z, dt, 8)
        if (e.kind === 'witch' && dist < range && dist > 2.3) {
          e.moving = 0.2
          e.atkCd -= dt
          if (e.atkCd <= 0) {
            e.atkCd = ENEMIES.witch.cd
            this.shootBolt(e, e.dmg)
          }
        } else if (e.kind === 'witch' && dist <= 2.3) {
          const dx = e.x - hero.x
          const dz = e.z - hero.z
          const len = Math.hypot(dx, dz) || 1
          this.moveActor(e, (dx / len) * speed * dt, (dz / len) * speed * dt)
          e.moving = 1
        } else if (dist > range) {
          const dx = hero.x - e.x
          const dz = hero.z - e.z
          const len = Math.hypot(dx, dz) || 1
          this.moveActor(e, (dx / len) * speed * dt, (dz / len) * speed * dt)
          e.moving = 1
        } else {
          e.moving = 0.15
          e.atkCd -= dt
          if (e.atkCd <= 0) {
            e.atkCd = bossing ? 1.35 : def!.cd
            e.swingT = 0.28
            e.swingDur = 0.28
            const dmg = sheet ? sheet.dmg : e.dmg
            e.pending = { t: 0.16, dmg, boss: bossing }
          }
        }
        if (bossing) {
          e.poundCd -= dt
          if (e.poundCd <= 0 && e.poundT <= 0) {
            e.poundCd = 4.6
            e.poundT = 0.72
            e.poundX = e.x
            e.poundZ = e.z
          }
          if (!e.added && e.hp < e.maxHp * 0.6) {
            e.added = true
            if (e.kind === 'don') {
              this.spawnEnemy('thug', e.x + 0.9, e.z + 0.35)
              this.spawnEnemy('enforcer', e.x - 0.85, e.z + 0.4)
              this.hud.toast('The Don calls his crew')
            } else {
              for (const mark of LITTER) {
                const spot = this.litterSpot(mark.x, mark.z)
                if (spot) this.spawnEnemy('rat', spot.x, spot.z, { returns: false })
              }
              this.hud.toast('The king calls his litter')
            }
          }
        }
      } else {
        e.wanderT -= dt
        if (e.wanderT <= 0) {
          e.wanderT = 1.2 + Math.random() * 1.8
          e.wanderA = Math.random() * Math.PI * 2
        }
        this.moveActor(e, Math.sin(e.wanderA) * speed * 0.35 * dt, Math.cos(e.wanderA) * speed * 0.35 * dt)
        e.moving = 0.4
        this.turnTowardAngle(e, e.wanderA, dt, 4)
      }
      this.separate(e)
      this.placeActor(e)
      this.animateActor(e, dt)
    }
  }

  private updateBats(dt: number, prof: CombatProfile): void {
    if (this.batT <= 0) {
      for (const b of this.bats) b.visible = false
      return
    }
    this.batT -= dt
    this.batTick -= dt
    const dur = 1.15
    const k = 1 - this.batT / dur
    this.batR = 0.35 + k * 3.3
    this.bats.forEach((b, i) => {
      const a = k * 7 + (i / this.bats.length) * Math.PI * 2
      b.visible = true
      b.position.set(this.hero.x + Math.sin(a) * this.batR, 0.85 + Math.sin(k * 12 + i) * 0.25, this.hero.z + Math.cos(a) * this.batR)
      b.rotation.y = -a
      const wing = b.children[1]
      const wing2 = b.children[2]
      if (wing && wing2) {
        wing.rotation.z = Math.sin(k * 30) * 0.6
        wing2.rotation.z = -Math.sin(k * 30) * 0.6
      }
    })
    if (this.batTick <= 0) {
      this.batTick = 0.18
      const dmg = skillDamage('bats', prof)
      for (const e of this.enemies) {
        if (e.dead) continue
        if (Math.hypot(e.x - this.hero.x, e.z - this.hero.z) < this.batR + e.radius) this.damageEnemy(e, dmg, false)
      }
    }
  }

  private updateNova(dt: number, prof: CombatProfile): void {
    if (this.novaT <= 0) {
      this.novaRing.visible = false
      return
    }
    this.novaT -= dt
    const k = 1 - this.novaT / 0.48
    this.novaRing.visible = true
    this.novaRing.position.set(this.hero.x, 0.08, this.hero.z)
    this.novaRing.scale.setScalar(0.4 + k * 4.4)
    ;(this.novaRing.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k)
    if (!this.novaHit && k > 0.18) {
      this.novaHit = true
      const dmg = skillDamage('nova', prof)
      for (const e of this.enemies) {
        if (e.dead) continue
        if (Math.hypot(e.x - this.hero.x, e.z - this.hero.z) < 4.3 + e.radius) this.damageEnemy(e, dmg, false)
      }
      this.burst(this.hero.x, 0.6, this.hero.z, 0xff3355, 22, 4, 0.5)
    }
  }

  private updateBeam(dt: number): void {
    if (this.beamT <= 0 || !this.beamTarget || this.beamTarget.dead) {
      this.beam.visible = false
      this.beamT = 0
      return
    }
    this.beamT -= dt
    const from = this.tmp.set(this.hero.x, 1.05, this.hero.z)
    const to = this.tmp2.set(this.beamTarget.x, this.beamTarget.barY * 0.6, this.beamTarget.z)
    const dir = to.clone().sub(from)
    const len = dir.length() || 0.001
    this.beam.visible = true
    this.beam.position.copy(from).addScaledVector(dir, 0.5)
    this.beam.scale.set(1, len, 1)
    this.beam.quaternion.setFromUnitVectors(this.up, dir.multiplyScalar(1 / len))
  }

  private updateSlash(dt: number): void {
    if (this.slashT <= 0) {
      this.slash.visible = false
      return
    }
    this.slashT -= dt
    const f = this.hero.facing
    const visual = this.heroVisual()
    this.slash.visible = true
    this.slash.scale.set(1.7 * visual, 1.2 * visual, 1)
    this.slash.position.set(this.hero.x + Math.sin(f) * 0.85 * visual, 1.0 * visual, this.hero.z + Math.cos(f) * 0.85 * visual)
    const mat = this.slash.material as THREE.SpriteMaterial
    mat.opacity = Math.max(0, this.slashT / 0.16)
  }

  private updateDrops(dt: number): void {
    const magnet = 4.2 + combatStat(this.save, 'agility') * 0.012
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]
      d.life += dt
      const dx = this.hero.x - d.x
      const dz = this.hero.z - d.z
      const dist = Math.hypot(dx, dz)
      if (dist < magnet || d.life > 3.2) {
        const pull = dist < 1.2 ? 18 : 9
        d.vx += (dx / (dist || 1)) * pull * dt
        d.vz += (dz / (dist || 1)) * pull * dt
        d.vy += 3 * dt
      }
      d.vy -= 9 * dt
      d.x += d.vx * dt
      d.y += d.vy * dt
      d.z += d.vz * dt
      if (d.y < 0.08) {
        d.y = 0.08
        d.vy *= -0.28
        d.vx *= 0.7
        d.vz *= 0.7
      }
      d.mesh.position.set(d.x, d.y, d.z)
      if (dist < 0.55 || d.life > 4.8) {
        this.save.blood += d.value
        this.sfx.play('pickup')
        d.mesh.visible = false
        this.dropPool.push(d.mesh)
        this.drops.splice(i, 1)
      }
    }
  }

  private updateBolts(dt: number, prof: CombatProfile): void {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]
      b.life -= dt
      b.x += b.vx * dt
      b.z += b.vz * dt
      b.mesh.position.set(b.x, b.y, b.z)
      const dist = Math.hypot(this.hero.x - b.x, this.hero.z - b.z)
      if (dist < 0.5 && !this.hero.dead && this.iframe <= 0) {
        this.damageHero(mitigate(b.dmg, prof.armor, prof.resist, false), false)
        b.life = 0
      }
      if (b.life <= 0) {
        b.mesh.visible = false
        this.scene.remove(b.mesh)
        this.bolts.splice(i, 1)
      }
    }
  }

  private updateNodes(dt: number): void {
    const now = performance.now()
    for (const id of ['crypt', 'fountain'] as const) {
      const node = this.world.nodes[id]
      if (!node.group.parent) continue
      const ready = now >= (node.group.userData.readyAt as number)
      if (node.group.userData.ready !== ready) {
        node.group.userData.ready = ready
        setNodeVisual(node, ready)
      }
      if (!ready || this.paused() || this.hero.dead) {
        node.group.userData.channel = 0
        continue
      }
      const dist = Math.hypot(this.hero.x - node.x, this.hero.z - node.z)
      let channel = (node.group.userData.channel as number) || 0
      if (dist < 1.62) channel += dt
      else channel = 0
      if (channel >= 0.55) {
        this.harvest(id)
        channel = 0
      }
      node.group.userData.channel = channel
    }
  }

  private motes(dt: number): void {
    this.moteAcc += dt
    if (this.moteAcc < 0.28) return
    this.moteAcc = 0
    if (this.world.nodes.crypt.group.parent && this.world.nodes.crypt.group.userData.ready) {
      this.burst(this.world.nodes.crypt.x, 0.4, this.world.nodes.crypt.z, 0xc46bff, 1, 0.6, 0.8)
    }
    if (this.world.nodes.fountain.group.parent && this.world.nodes.fountain.group.userData.ready) {
      this.burst(this.world.nodes.fountain.x, 0.9, this.world.nodes.fountain.z, 0xff3355, 1, 0.4, 0.7)
    }
  }

  private updateCamera(dt: number, paused: boolean): void {
    const hero = this.hero
    const desired = this.tmp
    const lookTarget = this.tmp2
    if (this.debugCam === 'close') {
      desired.set(hero.x + 0.28, 1.18, hero.z + 3.9)
      lookTarget.set(hero.x, 1.5, hero.z)
    } else if (this.debugCam === 'duel') {
      desired.set(hero.x - 2.5, 1.65, hero.z + 4.4)
      lookTarget.set(hero.x + 0.15, 1.2, hero.z)
    } else if (this.debugCam === 'claws') {
      const hand = hero.rig.claws[0]?.getObjectByName('claw-tip') ?? hero.rig.claws[0] ?? hero.rig.armR
      hand.updateWorldMatrix(true, false)
      const p = new THREE.Vector3().setFromMatrixPosition(hand.matrixWorld)
      desired.set(p.x - 0.55, p.y + 0.35, p.z + 1.25)
      lookTarget.set(p.x - 0.1, p.y - 0.02, p.z)
    } else if (this.debugCam === 'portrait') {
      desired.set(hero.x + 0.08, 1.2, hero.z + 1.68)
      lookTarget.set(hero.x, 1.16, hero.z)
      this.world.fog.near = 1.1
      this.world.fog.far = 16
    } else if (this.debugCam === 'facade') {
      const f = hero.facing
      desired.set(hero.x - Math.sin(f) * 0.55, 2.55, hero.z - Math.cos(f) * 0.55)
      lookTarget.set(hero.x + Math.sin(f) * 7, 2.35, hero.z + Math.cos(f) * 7)
      this.world.fog.near = 3
      this.world.fog.far = 22
    } else if (this.debugCam === 'map') {
      desired.set(-22, 158, -4)
      lookTarget.set(-22, 0, -16)
      this.world.fog.near = 176
      this.world.fog.far = 220
    } else if (this.debugCam === 'king') {
      const boss = this.boss && !this.boss.dead ? this.boss : null
      const x = boss ? boss.x : KING_ARENA.x
      const z = boss ? boss.z : KING_ARENA.z
      desired.set(x + 3.2, 7.6, z + 6.4)
      lookTarget.set(x, 1.05, z)
      this.world.fog.near = 12
      this.world.fog.far = 42
    } else if (this.debugCam === 'enemy') {
      const rat =
        this.enemies.find((e) => !e.dead && e.kind === 'boss') ??
        this.enemies.find((e) => !e.dead && e.kind === 'rat') ??
        this.enemies.find((e) => !e.dead)
      const ex = rat ? rat.x : hero.x
      const ez = rat ? rat.z : hero.z
      desired.set(ex + 0.15, 1.05, ez + 2.05)
      lookTarget.set(ex, 0.42, ez)
    } else if (this.mode === 'menu') {
      // Pulled back from the old chest close-up so the whole body, feet included,
      // sits in the clear band above the gear sheet with a little air around it.
      desired.set(hero.x + 0.45, 3.6, hero.z + 12.4)
      lookTarget.set(hero.x, -1.85, hero.z)
      this.world.fog.near = 22
      this.world.fog.far = 52
    } else {
      // Overhead isometric. The offset never changes with facing, speed, or walls,
      // and the hero is the look point, so they stay in the center of the frame.
      desired.set(hero.x + 6.6, 10.8, hero.z + 6.6)
      lookTarget.set(hero.x, 0.52, hero.z)
      this.world.fog.near = 40
      this.world.fog.far = 52
    }
    const mapShot = this.debugCam === 'map'
    if (mapShot) {
      if (this.camera.far !== 680) {
        this.camera.far = 680
        this.camera.updateProjectionMatrix()
      }
    } else if (this.camera.far !== 480) {
      this.camera.far = 480
      this.camera.updateProjectionMatrix()
    }
    this.world.moon.visible = !mapShot
    const halo = this.world.moon.userData.halo as THREE.Object3D | undefined
    if (halo) halo.visible = !mapShot
    for (const cloud of this.world.clouds) cloud.visible = !mapShot
    const rigid = this.debugCam === 'play' && this.mode !== 'menu'
    if (rigid) {
      this.camPos.copy(desired)
      this.look.copy(lookTarget)
      this.shake = 0
    } else {
      const snap =
        mapShot ||
        this.debugCam === 'king' ||
        this.debugCam === 'facade' ||
        this.debugCam === 'close' ||
        this.debugCam === 'duel' ||
        this.debugCam === 'portrait' ||
        this.frames < 2
      const menuK = 1 - Math.pow(0.0015, Math.max(0.001, dt))
      const follow = snap ? 1 : 1 - Math.exp(-3.4 * Math.max(0.001, dt))
      const lookK = snap ? 1 : 1 - Math.exp(-5.2 * Math.max(0.001, dt))
      const blend = paused && this.mode === 'menu' ? menuK : follow
      this.camPos.lerp(desired, blend)
      this.look.lerp(lookTarget, paused && this.mode === 'menu' ? menuK : lookK)
    }
    const key = this.world.keyLight
    key.position.set(hero.x + 4.2, 9.2, hero.z + 5.4)
    key.target.position.set(hero.x, 0.4, hero.z)
    this.camera.position.copy(this.camPos)
    if (!rigid && this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.6
      this.shake = Math.max(0, this.shake - dt * 1.4)
    }
    this.camera.lookAt(this.look)
    this.camera.getWorldDirection(this.camFwd)
    this.camFwd.y = 0
    if (this.camFwd.lengthSq() < 1e-5) this.camFwd.set(0, 0, -1)
    else this.camFwd.normalize()
    this.camRight.crossVectors(this.camFwd, this.up).normalize()

    const t = performance.now() * 0.00003
    const moonBase = (this.world.moon.userData.baseX as number) ?? -16
    this.world.moon.position.x = moonBase + Math.sin(t) * 0.35
    for (const c of this.world.clouds) c.position.x += Math.sin(t + c.position.z) * 0.002
  }

  private updateSparks(dt: number): void {
    const pos = this.sparkPos
    const col = this.sparkCol
    let n = 0
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]
      s.life -= dt
      if (s.life <= 0) {
        this.sparks.splice(i, 1)
        continue
      }
      s.vy -= 2.2 * dt
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.z += s.vz * dt
      if (n < 220) {
        const fade = s.life / s.max
        pos[n * 3] = s.x
        pos[n * 3 + 1] = s.y
        pos[n * 3 + 2] = s.z
        col[n * 3] = s.r * fade
        col[n * 3 + 1] = s.g * fade
        col[n * 3 + 2] = s.b * fade
        n++
      }
    }
    this.sparkGeom.setDrawRange(0, n)
    ;(this.sparkGeom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    ;(this.sparkGeom.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
  }

  private updateFloats(dt: number): void {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]
      f.life -= dt
      f.y += f.vy * dt
      if (f.life <= 0) {
        f.el.remove()
        this.floatPool.push(f.el)
        this.floaters.splice(i, 1)
        continue
      }
      const p = this.project(f.x, f.y, f.z)
      f.el.style.opacity = String(Math.max(0, f.life / f.max))
      this.hud.place(f.el, p.x, p.y, p.vis)
    }
  }

  private updateBars(dt: number): void {
    for (const e of this.enemies) {
      const flop = e.dead && e.rig.root.visible && e.deathT <= 0.7
      if ((e.dead || !e.rig.root.visible) && !flop) {
        e.bar.style.display = 'none'
        continue
      }
      const ratio = e.maxHp > 0 ? Math.max(0, e.hp / e.maxHp) : 0
      const gap = e.barLag - ratio
      if (gap > 0.001) e.barLag = Math.max(ratio, e.barLag - dt * (0.28 + gap * 0.9))
      else e.barLag = ratio
      e.barT = Math.max(0, e.barT - dt)
      e.barFlash = Math.max(0, e.barFlash - dt)
      const show = flop || (ratio < 0.995 && e.barT > 0)
      const fade = !flop && e.barT < 0.45 ? Math.max(0, e.barT / 0.45) : 1
      const lag = e.bar.querySelector('.lag') as HTMLElement | null
      const fill = e.bar.querySelector('.fill') as HTMLElement | null
      const hp = e.bar.querySelector('.hp') as HTMLElement | null
      if (lag) lag.style.width = `${Math.max(0, Math.min(1, e.barLag)) * 100}%`
      if (fill) fill.style.width = `${ratio * 100}%`
      if (hp) hp.textContent = String(Math.max(0, Math.round(e.hp)))
      e.bar.classList.toggle('flash', e.barFlash > 0)
      e.bar.style.opacity = show ? fade.toFixed(3) : '0'
      const p = this.project(e.x, e.barY, e.z)
      this.hud.place(e.bar, p.x, p.y, p.vis && show && fade > 0.02)
    }
    const now = performance.now()
    for (const id of ['crypt', 'fountain'] as const) {
      const node = this.world.nodes[id]
      const p = this.project(node.x, 1.55, node.z)
      const ready = !!node.group.userData.ready
      const channel = (node.group.userData.channel as number) || 0
      let text: string = NODE[id].label
      let prog = 0
      if (!ready) {
        const left = Math.max(0, ((node.group.userData.readyAt as number) - now) / 1000)
        text = `${Math.ceil(left)}s`
      } else if (channel > 0) {
        prog = channel / 0.55
        text = 'Feeding'
      }
      this.hud.setNodeTag(id, p.x, p.y, text, p.vis && !!node.group.parent, prog)
    }
  }

  private updateHud(): void {
    this.hud.setHp(this.hero.maxHp > 0 ? this.hero.hp / this.hero.maxHp : 0)
    this.hud.setBlood(this.save.blood)
    this.hud.setLevel(this.save.level, this.save.xp / xpNeed(this.save.level))
    for (const id of SKILLS) this.hud.setSkill(id, this.cooldowns[id], this.cdMax[id])
    const boss = this.localBoss()
    this.hud.setBoss(!!boss, boss ? boss.hp / boss.maxHp : 0, boss?.kind === 'don' ? 'THE DON' : 'RAT KING')
    const playing = this.mode === 'play' && !this.hud.modalOpen()
    if (this.district === 'mob') {
      const canSummon = this.foes && !boss && this.donCd <= 0 && this.save.mobKills >= 10 && playing
      this.hud.setSummon(
        canSummon,
        this.save.donKills > 0 ? 'The Don wants a rematch.' : 'The Don is waiting in the club.',
        this.save.donKills > 0 ? 'Face him again' : 'Knock on the club',
      )
    } else {
      const canSummon = this.foes && !boss && this.summonCd <= 0 && this.save.kills >= 10 && playing
      this.hud.setSummon(
        canSummon,
        this.save.bossKills > 0 ? 'Something fat stirs under the crypt again.' : 'The Rat King is awake under the crypt.',
        this.save.bossKills > 0 ? 'Face him again' : 'Call him out',
      )
    }
    if (this.mode === 'menu') this.refreshMenu()
  }

  private cast(id: SkillId): void {
    if (this.paused() || this.hero.dead) return
    if (this.cooldowns[id] > 0) return
    this.sfx.unlock()
    const prof = profile(this.save)
    const max = SKILL_META[id].cd * prof.cdScale
    this.sfx.play('skill')
    this.skillsFired++
    if (id === 'bats') {
      this.cooldowns.bats = max
      this.cdMax.bats = max
      this.batT = 1.15
      this.batTick = 0
      this.batR = 0.4
      return
    }
    if (id === 'dash') {
      this.cooldowns.dash = max
      this.cdMax.dash = max
      const move = this.hud.getMove()
      let dx = 0
      let dz = 0
      if (move.active) {
        dx = this.camFwd.x * move.y + this.camRight.x * move.x
        dz = this.camFwd.z * move.y + this.camRight.z * move.x
      } else {
        const t = this.nearest(8, false)
        if (t) {
          dx = t.x - this.hero.x
          dz = t.z - this.hero.z
        } else {
          dx = Math.sin(this.hero.facing)
          dz = Math.cos(this.hero.facing)
        }
      }
      const len = Math.hypot(dx, dz) || 1
      const dist = 3.5
      this.dashVx = (dx / len) * (dist / 0.16)
      this.dashVz = (dz / len) * (dist / 0.16)
      this.dashT = 0.16
      this.dashHit.clear()
      this.iframe = Math.max(this.iframe, 0.34)
      this.burst(this.hero.x, 0.8, this.hero.z, 0x3ad0d8, 10, 2.2, 0.35)
      return
    }
    if (id === 'nova') {
      this.cooldowns.nova = max
      this.cdMax.nova = max
      this.novaT = 0.48
      this.novaHit = false
      this.shake = Math.max(this.shake, 0.4)
      return
    }
    const target = this.nearest(6.4, false)
    if (!target) {
      this.cooldowns.drain = 1.15
      this.cdMax.drain = 1.15
      this.hud.toast('No prey in reach')
      return
    }
    this.cooldowns.drain = max
    this.cdMax.drain = max
    this.beamT = 0.34
    this.beamTarget = target
    const dealt = this.damageEnemy(target, skillDamage('drain', prof), false)
    const heal = dealt * 0.55
    this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + heal)
    this.floatAt(this.hero.x, this.hero.barY * 0.74, this.hero.z, `+${Math.round(heal)}`, 'heal')
  }

  private damageEnemy(e: Actor, raw: number, crit: boolean): number {
    if (e.dead) return 0
    const prev = e.maxHp > 0 ? e.hp / e.maxHp : 1
    e.barLag = Math.max(e.barLag, prev)
    const amount = enemyMitigate(raw, e.armor)
    e.hp -= amount
    e.barT = e.kind === 'boss' || e.kind === 'don' ? 4.5 : 3.2
    e.barFlash = 0.14
    e.hitFlash = 0.12
    this.hits++
    const txt = `-${Math.round(amount)}`
    this.floatAt(e.x, e.barY + 0.48, e.z, txt, crit ? 'crit' : '')
    this.burst(e.x, e.barY * 0.55, e.z, 0xff2438, crit ? 8 : 4, 2.4, 0.35)
    if (e.dummy) {
      if (e.hp <= 0) this.killDummy(e)
      return amount
    }
    const ls = amount * profile(this.save).lifesteal
    if (!this.hero.dead) this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + ls)
    if (e.hp <= 0) this.killEnemy(e)
    return amount
  }

  /** Practice kill. No blood, xp, or kill credit. Back on the same spot at full HP after 2.0s. */
  private killDummy(e: Actor): void {
    e.dead = true
    e.deathT = 0
    e.hp = 0
    e.respawn = 2
    e.pending = null
    e.knockT = 0
    e.kx = 0
    e.kz = 0
    this.burst(e.x, 0.7, e.z, 0x6a3048, 12, 2.4, 0.45)
  }

  private reviveDummy(e: Actor): void {
    e.x = e.poundX
    e.z = e.poundZ
    e.dead = false
    e.deathT = 0
    e.respawn = 0
    e.hp = e.maxHp
    e.dmg = 0
    e.speed = 0
    e.barLag = 1
    e.barT = 0
    e.barFlash = 0
    e.hitFlash = 0
    e.flinch = 0
    e.pending = null
    e.knockT = 0
    e.kx = 0
    e.kz = 0
    e.moving = 0
    e.rig.root.visible = true
    e.rig.bob.scale.set(1, 1, 1)
    e.rig.bob.position.set(0, 0, 0)
    e.rig.bob.rotation.set(0, 0, 0)
    this.placeActor(e)
  }

  private damageHero(raw: number, fromBoss: boolean): void {
    if (this.hero.dead || this.iframe > 0) return
    const prof = profile(this.save)
    const amount = mitigate(raw, prof.armor, prof.resist, fromBoss)
    this.hero.hp -= amount
    this.iframe = 0.42
    this.shake = Math.max(this.shake, fromBoss ? 0.28 : 0.12)
    this.sfx.play('hurt')
    this.floatAt(this.hero.x, this.hero.barY * 0.8, this.hero.z, `-${Math.round(amount)}`, 'hurt')
    if (this.hero.hp <= 0) {
      this.hero.hp = 0
      this.hero.dead = true
      this.hero.deathT = 1.5
      this.hud.toast('You dissolve into mist')
    }
  }

  private killEnemy(e: Actor): void {
    e.dead = true
    e.deathT = 0
    e.hp = 0
    const kind = e.kind
    e.respawn = e.returns && e.nest < 0 && kind !== 'boss' && kind !== 'don' && kind !== 'hero' ? GROWTH[kind].return : 0
    if (e.nest >= 0) {
      const nest = this.nests[e.nest]
      if (nest) nest.timer = GROWTH[nest.kind].return
    }
    this.sfx.play('kill')
    if (e.kind === 'boss' || e.kind === 'don') {
      const don = e.kind === 'don'
      const bp = don ? donBlueprint(this.save) : bossBlueprint(this.save)
      if (don) {
        this.save.donKills += 1
        this.don = null
        this.donCd = 75
      } else {
        this.save.bossKills += 1
        this.boss = null
        this.summonCd = 75
        this.world.gateGlow.emissiveIntensity = 1.7
        this.world.gateGlow.color.setHex(0xff4ad8)
      }
      this.save.kills += 1
      this.save.blood += bp.blood
      for (const s of STATS) this.save.stacks[s] += 2
      const levels = grantXp(this.save, bp.xp)
      this.poundRing.visible = false
      this.hud.banner(don ? 'THE DON FALLS' : 'RAT KING FALLS')
      this.hud.toast(
        don
          ? this.save.donKills === 1
            ? 'The district goes quiet'
            : 'The Don falls again'
          : this.save.bossKills === 1
            ? 'The Slums remember your name'
            : 'The king falls again',
      )
      this.floatAt(e.x, 2.2, e.z, `+${bp.blood} Blood`, 'blood')
      this.floatAt(e.x, 1.7, e.z, '+2 all', 'all')
      this.spawnDrops(e.x, e.z, bp.blood)
      if (levels) this.onLevel(levels)
      this.noteKill()
      this.persist()
      return
    }
    if (e.kind === 'hero') return
    const def = ENEMIES[e.kind]
    const xp = e.rewardXp || def.xp
    const blood = e.rewardBlood || def.blood
    this.save.kills += 1
    if (e.kind === 'thug' || e.kind === 'enforcer') this.save.mobKills += 1
    this.save.stacks[def.stat] += 1
    const levels = grantXp(this.save, xp)
    this.floatAt(e.x, e.barY, e.z, `+1 ${def.statLabel}`, def.stat === 'strength' ? 'str' : def.stat === 'agility' ? 'agi' : def.stat === 'vitality' ? 'vit' : 'sor')
    this.floatAt(e.x, 0.4, e.z, `+${blood}`, 'blood')
    this.spawnDrops(e.x, e.z, blood)
    this.burst(e.x, 0.8, e.z, new THREE.Color(FEED_COLOR[def.stat]).getHex(), 6, 1.8, 0.4)
    if (levels) this.onLevel(levels)
    this.noteKill()
  }

  private onLevel(gained: number): void {
    this.sfx.play('level')
    const prof = profile(this.save)
    this.hero.maxHp = prof.hp
    this.hero.hp = this.hero.maxHp
    this.floatAt(this.hero.x, this.hero.barY + 0.06, this.hero.z, `Level ${this.save.level}`, 'level')
    if (gained > 0) this.hud.toast(`Level ${this.save.level}. The night leans in.`)
  }

  private noteKill(): void {
    this.recentKills.push(this.sessionT)
    this.recomputeRate()
  }

  private recomputeRate(): void {
    this.recentKills = this.recentKills.filter((t) => this.sessionT - t <= 30)
    if (this.sessionT > 6 && this.recentKills.length) {
      const span = Math.min(30, Math.max(6, this.sessionT))
      const rate = this.recentKills.length / span
      this.save.killRate = this.save.killRate > 0 ? this.save.killRate * 0.75 + rate * 0.25 : rate
    }
  }

  private spawnDrops(x: number, z: number, blood: number): void {
    const n = Math.max(1, Math.min(8, blood))
    const each = blood / n
    for (let i = 0; i < n; i++) this.drops.push(this.makeDrop(x, z, each))
  }

  private makeDrop(x: number, z: number, value: number): Drop {
    let mesh = this.dropPool.pop()
    if (!mesh) {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), this.bloodMat)
      this.scene.add(mesh)
    }
    mesh.visible = true
    const a = Math.random() * Math.PI * 2
    return {
      mesh,
      x: x + Math.cos(a) * 0.15,
      y: 0.6,
      z: z + Math.sin(a) * 0.15,
      vx: Math.cos(a) * (0.6 + Math.random() * 0.5),
      vy: 2.2 + Math.random(),
      vz: Math.sin(a) * (0.6 + Math.random() * 0.5),
      life: 0,
      value,
    }
  }

  private harvest(id: 'crypt' | 'fountain'): void {
    const node = this.world.nodes[id]
    const spec = NODE[id]
    this.save.blood += spec.blood
    this.nodeBlood += spec.blood
    node.group.userData.readyAt = performance.now() + spec.respawn * 1000
    node.group.userData.ready = false
    node.group.userData.channel = 0
    setNodeVisual(node, false)
    this.sfx.play('pickup')
    this.floatAt(node.x, 1.4, node.z, `+${spec.blood}`, 'blood')
    this.burst(node.x, 0.8, node.z, id === 'crypt' ? 0xc46bff : 0xff2244, 12, 2.5, 0.45)
    this.hud.toast(`${spec.label} yields ${spec.blood} Blood`)
  }

  private onTap(cx: number, cy: number): void {
    if (this.paused()) return
    const rect = this.hud.canvas.getBoundingClientRect()
    this.pointer.x = ((cx - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((cy - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects([this.world.nodes.crypt.group, this.world.nodes.fountain.group], true)
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object
      while (obj) {
        const id = obj.userData.nodeId as 'crypt' | 'fountain' | undefined
        if (id) {
          const node = this.world.nodes[id]
          if (!node.group.userData.ready) return
          if (Math.hypot(this.hero.x - node.x, this.hero.z - node.z) > 1.75) {
            this.hud.toast('Step closer')
            return
          }
          this.harvest(id)
          return
        }
        obj = obj.parent
      }
    }
  }

  private trySummon(): void {
    if (!this.foes) return
    if (this.district === 'mob') this.summonDon()
    else this.summonKing()
  }

  private summonKing(force = false): void {
    if (!this.foes) return
    if (this.boss && !this.boss.dead) return
    if (!force && (this.paused() || this.summonCd > 0 || this.save.kills < 10)) return
    const bp = bossBlueprint(this.save)
    const spot = this.kingSpot()
    const boss = this.makeActor('boss', this.kenney ? this.kenney.boss() : createBoss(), spot.x, spot.z, bp.hp, 0.78, 2.45)
    boss.armor = kingArmor(this.save.bossKills)
    boss.dmg = bp.dmg
    boss.speed = bp.speed
    boss.rewardXp = bp.xp
    boss.rewardBlood = bp.blood
    boss.intro = 0.85
    boss.poundCd = 2.2
    this.enemies.push(boss)
    this.boss = boss
    this.sfx.play('boss')
    this.shake = 0.5
    this.hud.banner('RAT KING')
    this.hud.setSummon(false, '', '')
  }

  private summonDon(force = false): void {
    if (!this.foes) return
    if (!force && (this.paused() || this.don || this.donCd > 0 || this.save.mobKills < 10)) return
    if (this.don && !this.don.dead) return
    const bp = donBlueprint(this.save)
    const spot = this.ahead()
    const don = this.makeActor('don', this.kenney ? this.kenney.don() : createDon(), spot.x, spot.z, bp.hp, 0.82, 2.55)
    don.armor = kingArmor(this.save.donKills)
    don.dmg = bp.dmg
    don.speed = bp.speed
    don.rewardXp = bp.xp
    don.rewardBlood = bp.blood
    don.intro = 0.85
    don.poundCd = 2.2
    this.enemies.push(don)
    this.don = don
    this.sfx.play('boss')
    this.shake = 0.5
    this.hud.banner('THE DON')
    this.hud.setSummon(false, '', '')
  }

  private ahead(): { x: number; z: number } {
    let x = this.hero.x + this.camFwd.x * 3.3
    let z = this.hero.z + this.camFwd.z * 3.3
    return this.clampArena(x, z)
  }

  private openMenu(): void {
    if (this.hud.modalOpen()) return
    if (this.mode === 'menu') return
    this.mode = 'menu'
    this.hud.showMenu(true)
    for (const e of this.enemies) e.rig.root.visible = e.rig.root.visible && !e.dead ? false : e.rig.root.visible
    for (const e of this.enemies) {
      e.rig.root.visible = false
      e.bar.style.display = 'none'
    }
    for (const d of this.drops) d.mesh.visible = false
    this.refreshMenu()
  }

  private closeMenu(): void {
    if (this.mode !== 'menu') return
    this.mode = 'play'
    this.hud.showMenu(false)
    for (const e of this.enemies) {
      if (!e.dead) e.rig.root.visible = true
    }
    for (const d of this.drops) d.mesh.visible = true
  }

  private refreshMenu(): void {
    const rows = STATS.map((stat) => ({ stat, value: sheetStat(this.save, stat), fill: 0 }))
    const scale = Math.max(40, ...rows.map((r) => r.value))
    for (const row of rows) row.fill = row.value / scale
    this.hud.setStats(rows)
    this.hud.setFeeds(this.save.kills, this.save.bossKills > 0)
    const slot = this.hud.selected
    const lv = this.save.gear[slot]
    const maxed = lv >= MAX_GEAR
    const cost = upgradeCost(lv)
    this.hud.setGearCard(gearName(slot, lv), lv, GEAR_BLURB[slot](lv, this.save.evolved[slot]), cost, !maxed && this.save.blood >= cost, maxed)
    const tier = clawTier(this.save.gear.weapon)
    const next = nextClawTier(this.save.gear.weapon)
    this.hud.setClawTier(
      slot === 'weapon' ? tier : null,
      next ? `${next.label} at Lv. ${next.from}` : 'Highest tier',
      clawTier(this.save.gear.weapon).css,
    )
  }

  private applyWeaponLook(): void {
    applyGearVisual(this.hero.rig, this.save.gear.weapon, this.save.gear.cape, this.save.evolved.weapon, this.save.evolved.cape)
    const tier = clawTier(this.save.gear.weapon)
    const hue = new THREE.Color(tier.color)
    ;(this.trail.material as THREE.MeshBasicMaterial).color.copy(hue).lerp(new THREE.Color(0xffffff), 0.35)
    ;(this.slash.material as THREE.SpriteMaterial).color.copy(hue)
    const flash = hue.clone().lerp(new THREE.Color(0xffffff), 0.55)
    for (const slot of this.impacts) (slot.mesh.material as THREE.SpriteMaterial).color.copy(flash)
  }

  private upgrade(): void {
    const slot = this.hud.selected
    const lv = this.save.gear[slot]
    if (lv >= MAX_GEAR) return
    const cost = upgradeCost(lv)
    if (this.save.blood < cost) {
      this.hud.toast('Not enough Blood')
      this.sfx.play('click')
      return
    }
    this.save.blood -= cost
    this.save.gear[slot] = lv + 1
    const evolvedNow = lv + 1 >= 10 && !this.save.evolved[slot]
    if (evolvedNow) this.save.evolved[slot] = true
    const tierUp = slot === 'weapon' && clawTier(lv + 1).id !== clawTier(lv).id
    this.applyWeaponLook()
    this.sfx.play('upgrade')
    const name = gearName(slot, lv + 1)
    if (tierUp) {
      const tier = clawTier(lv + 1)
      this.hud.toast(`${tier.label} Claws awakened`)
      this.burst(this.hero.x, 1.0, this.hero.z, tier.color, 18, 2.6, 0.6)
      this.shake = Math.max(this.shake, 0.22)
    } else this.hud.toast(evolvedNow ? `${name} awakened` : `${name} sharpened`)
    this.syncVitals(profile(this.save))
    this.persist()
    this.refreshMenu()
  }

  private claimOffline(): void {
    this.hud.showOffline(null)
    const prof = profile(this.save)
    this.hero.maxHp = prof.hp
    this.hero.hp = prof.hp
    this.sfx.play('level')
  }

  private toggleMute(): void {
    this.save.muted = !this.save.muted
    this.sfx.setMuted(this.save.muted)
    this.hud.setMuted(this.save.muted)
    if (!this.save.muted) this.sfx.play('click')
    this.persist()
  }

  private syncVitals(prof: CombatProfile): void {
    const prev = this.hero.maxHp
    this.hero.maxHp = prof.hp
    if (this.hero.maxHp > prev) this.hero.hp += this.hero.maxHp - prev
    if (this.hero.hp > this.hero.maxHp) this.hero.hp = this.hero.maxHp
  }

  private makeActor(kind: Actor['kind'], rig: Rig, x: number, z: number, hp: number, radius: number, barY: number): Actor {
    this.scene.add(rig.root)
    if (!this.stage.low) {
      rig.root.traverse((child) => {
        const mesh = child as THREE.Mesh
        if (!mesh.isMesh) return
        mesh.castShadow = true
        mesh.receiveShadow = true
      })
    }
    this.stage.outline.push(rig.root)
    const contact = new THREE.Mesh(this.contactGeo, this.contactMat)
    contact.rotation.x = -Math.PI / 2
    const visual = typeof rig.root.userData.visual === 'number' ? (rig.root.userData.visual as number) : 1
    contact.scale.setScalar(Math.max(0.55, radius * 2.35) * visual)
    contact.position.set(x, 0.03, z)
    this.scene.add(contact)
    const actor: Actor = {
      id: this.nextId++,
      kind,
      rig,
      x,
      z,
      facing: kind === 'hero' ? Math.PI : 0,
      hp,
      maxHp: hp,
      atkCd: 0.4,
      swingT: 0,
      swingDur: 0.26,
      atkT: 0,
      struck: false,
      hitFlash: 0,
      flinch: 0,
      knockT: 0,
      kx: 0,
      kz: 0,
      dead: false,
      deathT: 0,
      respawn: 0,
      radius,
      barY,
      moving: 0,
      dmg: 0,
      speed: 0,
      armor: 0,
      rewardXp: 0,
      rewardBlood: 0,
      nest: -1,
      returns: false,
      barLag: 1,
      barT: 0,
      barFlash: 0,
      bar: this.hud.makeBar(kind),
      pending: null,
      poundT: 0,
      poundCd: 3,
      poundX: x,
      poundZ: z,
      added: false,
      intro: 0,
      wanderT: 1,
      wanderA: Math.random() * Math.PI * 2,
      contact,
      dummy: false,
    }
    if (kind === 'hero') actor.bar.style.display = 'none'
    const customBar = rig.root.userData.barY
    if (typeof customBar === 'number') actor.barY = customBar
    this.placeActor(actor)
    return actor
  }

  /**
   * Three different practice targets in the open middle of Zone 1.
   * They stand off the walks that lead to the north and south alleys.
   */
  private layDummies(): void {
    const spots: [Exclude<EnemyKind, 'boss' | 'don'>, number, number][] = [
      ['ghoul', -6.4, 5.8],
      ['witch', 4.6, 3.2],
      ['wolf', -6.0, -6.8],
    ]
    for (const [kind, x, z] of spots) {
      const actor = this.spawnEnemy(kind, x, z)
      actor.dummy = true
      actor.speed = 0
      actor.dmg = 0
      actor.intro = 0
      actor.facing = Math.atan2(-x, -z)
      actor.moving = 0
      this.placeActor(actor)
    }
  }

  private spawnEnemy(
    kind: Exclude<EnemyKind, 'boss' | 'don'>,
    x: number,
    z: number,
    opts?: { nest?: number; returns?: boolean },
  ): Actor {
    const rig = this.kenney
      ? this.kenney[kind]()
      : kind === 'ghoul'
        ? createGhoul()
        : kind === 'rat'
          ? createRat()
          : kind === 'wolf'
            ? createWolf()
            : kind === 'thug'
              ? createThug()
              : kind === 'enforcer'
                ? createEnforcer()
                : createWitch()
    const def = ENEMIES[kind]
    const stats = enemyStats(kind, this.save)
    const actor = this.makeActor(kind, rig, x, z, stats.hp, def.radius, def.barY)
    actor.dmg = stats.dmg
    actor.speed = stats.speed
    actor.armor = stats.armor
    actor.rewardXp = stats.xp
    actor.rewardBlood = stats.blood
    actor.nest = opts?.nest ?? -1
    actor.returns = opts?.returns ?? (kind === 'thug' || kind === 'enforcer')
    this.enemies.push(actor)
    return actor
  }

  private revive(e: Actor, x: number, z: number): void {
    if (e.kind === 'hero' || e.kind === 'boss' || e.kind === 'don') return
    const stats = enemyStats(e.kind, this.save)
    e.x = x
    e.z = z
    e.dead = false
    e.deathT = 0
    e.maxHp = stats.hp
    e.hp = stats.hp
    e.dmg = stats.dmg
    e.speed = stats.speed
    e.armor = stats.armor
    e.rewardXp = stats.xp
    e.rewardBlood = stats.blood
    e.barLag = 1
    e.barT = 0
    e.barFlash = 0
    e.pending = null
    e.knockT = 0
    e.rig.root.visible = true
    e.rig.bob.scale.set(1, 1, 1)
    e.rig.bob.position.y = 0
    this.placeActor(e)
  }

  private tickNests(dt: number): void {
    if (!this.foes) return
    for (const nest of this.nests) {
      if (nest.role === 'alt') continue
      const actor = nest.actor
      if (actor && !actor.dead) continue
      if (nest.timer > 0) nest.timer -= dt
      if (nest.timer > 0) continue
      if (actor && actor.deathT <= 0.4) continue
      if (this.livingKind(nest.kind) >= this.kindCap(nest.kind)) {
        nest.timer = 0.9
        continue
      }
      const spot = this.nestPoint(nest)
      if (!spot) {
        nest.timer = 1.15
        continue
      }
      if (actor) this.revive(actor, spot.x, spot.z)
      else {
        const index = this.nests.indexOf(nest)
        nest.actor = this.spawnEnemy(nest.kind, spot.x, spot.z, { nest: index, returns: true })
      }
    }
  }

  private nestPoint(home: NestRuntime): { x: number; z: number } | null {
    const radius = ENEMIES[home.kind].radius
    const order = [home, ...this.nests.filter((nest) => nest.kind === home.kind && nest !== home)]
    for (const nest of order) {
      if (nest !== home && nest.actor && !nest.actor.dead && nest.role !== 'alt') continue
      if (!this.clearSpawn(nest.x, nest.z, radius)) continue
      let blocked = false
      for (const other of this.enemies) {
        if (other.dead) continue
        if (Math.hypot(other.x - nest.x, other.z - nest.z) < 0.6) blocked = true
      }
      if (blocked) continue
      return { x: nest.x, z: nest.z }
    }
    return null
  }

  private clearSpawn(x: number, z: number, radius: number): boolean {
    if (!this.canOccupy(x, z, radius)) return false
    return Math.hypot(x - this.hero.x, z - this.hero.z) >= HERO_CLEAR
  }

  private kingSpot(): { x: number; z: number } {
    const radius = 0.78
    const dx = this.hero.x - KING_ARENA.x
    const dz = this.hero.z - KING_ARENA.z
    const dist = Math.hypot(dx, dz)
    let x = KING_ARENA.x
    let z = KING_ARENA.z
    if (dist < KING_ARENA.radius + 0.4) {
      const len = dist || 1
      x = KING_ARENA.x - (dx / len) * KING_ARENA.radius * 0.72
      z = KING_ARENA.z - (dz / len) * KING_ARENA.radius * 0.72
    }
    if (this.clearSpawn(x, z, radius)) return { x, z }
    let best = { x, z }
    let bestD = -1
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const px = KING_ARENA.x + Math.cos(a) * KING_ARENA.radius * 0.65
      const pz = KING_ARENA.z + Math.sin(a) * KING_ARENA.radius * 0.65
      if (!this.clearSpawn(px, pz, radius)) continue
      const dd = Math.hypot(px - this.hero.x, pz - this.hero.z)
      if (dd > bestD) {
        bestD = dd
        best = { x: px, z: pz }
      }
    }
    if (bestD >= 0) return best
    return this.clampArena(x, z)
  }

  private litterSpot(x: number, z: number): { x: number; z: number } | null {
    if (this.clearSpawn(x, z, ENEMIES.rat.radius)) return { x, z }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const px = KING_ARENA.x + Math.cos(a) * 1.35
      const pz = KING_ARENA.z + Math.sin(a) * 1.35
      if (this.clearSpawn(px, pz, ENEMIES.rat.radius)) return { x: px, z: pz }
    }
    return null
  }

  private kindCap(kind: Exclude<EnemyKind, 'boss' | 'don'>): number {
    const bossUp =
      kind === 'thug' || kind === 'enforcer' ? !!(this.don && !this.don.dead) : !!(this.boss && !this.boss.dead)
    const growth = GROWTH[kind]
    return bossUp ? growth.capBoss : growth.cap
  }

  private livingKind(kind: Actor['kind']): number {
    let n = 0
    for (const e of this.enemies) {
      if (!e.dead && !e.dummy && e.kind === kind) n++
    }
    return n
  }

  private pickPad(home: 'slums' | 'mob'): { x: number; z: number } {
    const pads = home === 'mob' ? MOB_PADS : PADS
    let best = pads[0]
    let bestD = -1
    for (const [x, z] of pads) {
      const d = Math.hypot(x - this.hero.x, z - this.hero.z)
      if (d > bestD && this.canOccupy(x, z, 0.4)) {
        bestD = d
        best = [x, z]
      }
    }
    return { x: best[0] + (Math.random() - 0.5) * 0.4, z: best[1] + (Math.random() - 0.5) * 0.4 }
  }

  private localBoss(): Actor | null {
    if (this.district === 'mob') return this.don && !this.don.dead ? this.don : null
    return this.boss && !this.boss.dead ? this.boss : null
  }

  private rivalBlueprint(kind: 'boss' | 'don') {
    return kind === 'don' ? donBlueprint(this.save) : bossBlueprint(this.save)
  }

  private clampArena(x: number, z: number): { x: number; z: number } {
    if (z > MOB_Z * 0.5) {
      const dx = x
      const dz = z - MOB_Z
      const d = Math.hypot(dx, dz)
      const max = ARENA_R - 1.2
      if (d > max && d > 0) return { x: (dx / d) * max, z: MOB_Z + (dz / d) * max }
      return { x, z }
    }
    return nearestSlum(x, z, 0.45)
  }

  private touchGate(): void {
    if (this.travelCd > 0 || this.hero.dead) return
    if (!DISTRICT_OPEN) {
      if (this.district !== 'slums') return
      if (Math.hypot(this.hero.x - SLUM_GATE.x, this.hero.z - SLUM_GATE.z) > 1.45) return
      if (this.gateNag <= 0) {
        this.gateNag = 3.4
        this.hud.toast('The district gate is barred')
      }
      return
    }
    const here = this.district === 'slums' ? SLUM_GATE : MOB_GATE
    if (Math.hypot(this.hero.x - here.x, this.hero.z - here.z) > 1.15) return
    if (this.district === 'slums' && this.save.bossKills < 1) {
      if (this.gateNag <= 0) {
        this.gateNag = 2.4
        this.hud.toast('The Rat King still bars the district')
      }
      const dx = this.hero.x - here.x
      const dz = this.hero.z - here.z
      const len = Math.hypot(dx, dz) || 1
      this.hero.x = here.x + (dx / len) * 1.4
      this.hero.z = here.z + (dz / len) * 1.4
      return
    }
    this.travel(this.district === 'slums' ? 'mob' : 'slums')
  }

  private travel(to: 'slums' | 'mob'): void {
    this.travelCd = 1
    this.district = to
    const spot = to === 'mob' ? MOB_ARRIVE : SLUM_RETURN
    this.hero.x = spot.x
    this.hero.z = spot.z
    this.placeActor(this.hero)
    const label = to === 'mob' ? 'THE DISTRICT' : 'THE SLUMS'
    this.hud.setDistrict(label)
    this.hud.banner(label)
    this.hud.toast(to === 'mob' ? 'Neon on wet asphalt' : 'Back in the alley')
    this.lockId = null
    this.aimId = null
  }

  private nearest(maxDist: number, includeDead: boolean, includeDummy = false): Actor | null {
    let best: Actor | null = null
    let bestD = maxDist
    for (const e of this.enemies) {
      if (e.dummy && !includeDummy) continue
      if (!includeDead && e.dead) continue
      const d = Math.hypot(e.x - this.hero.x, e.z - this.hero.z)
      if (d < bestD) {
        bestD = d
        best = e
      }
    }
    return best
  }

  private shootBolt(e: Actor, dmg: number): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xd56bff }),
    )
    const dx = this.hero.x - e.x
    const dz = this.hero.z - e.z
    const len = Math.hypot(dx, dz) || 1
    const speed = 6.5
    const bolt: Bolt = { mesh, x: e.x, y: 1.15, z: e.z, vx: (dx / len) * speed, vz: (dz / len) * speed, life: 1.8, dmg }
    mesh.position.set(bolt.x, bolt.y, bolt.z)
    this.scene.add(mesh)
    this.bolts.push(bolt)
  }

  private moveActor(actor: Actor, dx: number, dz: number): void {
    if (actor.kind === 'hero') this.moveTries++
    if (this.canOccupy(actor.x + dx, actor.z + dz, actor.radius)) {
      actor.x += dx
      actor.z += dz
      if (actor.kind === 'hero') this.moveOk++
      return
    }
    if (this.canOccupy(actor.x + dx, actor.z, actor.radius)) {
      actor.x += dx
      if (actor.kind === 'hero') this.moveOk++
      return
    }
    if (this.canOccupy(actor.x, actor.z + dz, actor.radius)) {
      actor.z += dz
      if (actor.kind === 'hero') this.moveOk++
    }
  }

  private canOccupy(x: number, z: number, radius: number): boolean {
    if (z > MOB_Z * 0.5) {
      const dx = x
      const dz = z - MOB_Z
      if (dx * dx + dz * dz > (ARENA_R - radius) * (ARENA_R - radius)) return false
    } else if (!inSlums(x, z, radius)) return false
    for (const o of this.world.obstacles) {
      if (Math.hypot(x - o.x, z - o.z) < o.r + radius * 0.72) return false
    }
    return true
  }

  private separate(e: Actor): void {
    for (const o of this.enemies) {
      if (o === e || o.dead) continue
      const dx = e.x - o.x
      const dz = e.z - o.z
      const dist = Math.hypot(dx, dz)
      const min = (e.radius + o.radius) * 0.85
      if (dist > 0.001 && dist < min) {
        const push = (min - dist) * 0.5
        const nx = e.x + (dx / dist) * push
        const nz = e.z + (dz / dist) * push
        if (this.canOccupy(nx, nz, e.radius * 0.5)) {
          e.x = nx
          e.z = nz
        }
      }
    }
  }

  private placeActor(actor: Actor): void {
    actor.rig.root.position.set(actor.x, 0, actor.z)
    actor.rig.root.rotation.y = actor.facing
    this.parkContact(actor)
  }

  private parkContact(actor: Actor): void {
    actor.contact.position.set(actor.x, 0.03, actor.z)
    actor.contact.visible = actor.rig.root.visible
  }

  private syncContacts(): void {
    this.parkContact(this.hero)
    for (const e of this.enemies) this.parkContact(e)
  }

  private animateActor(actor: Actor, dt: number): void {
    const swing = actor.kind === 'hero' ? 0 : actor.swingT > 0 ? 1 - actor.swingT / actor.swingDur : 0
    const attack = actor.kind === 'hero' && actor.atkT > 0 ? Math.min(1, actor.atkT / actor.swingDur) : 0
    if (actor.kind === 'hero' && !actor.dead) {
      this.gait = this.damp(this.gait, this.gaitTarget, dt, 3.4)
      this.loco = this.damp(this.loco, this.locoTarget, dt, 3.4)
      animateHero(
        actor.rig,
        dt,
        this.gait,
        this.phase,
        this.hipYaw,
        swing,
        this.sessionT,
        attack,
        this.loco,
        1,
      )
    } else if (!actor.dead) {
      animateRig(actor.rig, performance.now() * 0.001 + actor.id, actor.moving, swing, dt)
    }
    if (!actor.dead && actor.flinch > 0) {
      const k = actor.flinch / 0.2
      actor.rig.bob.rotation.x -= 0.9 * k
      actor.rig.bob.rotation.z += (actor.id % 2 === 0 ? 0.34 : -0.34) * k
    }
    this.flashActor(actor)
    const punch = 1 + actor.hitFlash * 0.7
    if (!actor.dead) actor.rig.bob.scale.setScalar(punch)
  }

  private flashActor(actor: Actor): void {
    const hot = actor.hitFlash > 0
    if (!hot && !actor.rig.root.userData.hot) return
    actor.rig.root.userData.hot = hot
    const k = hot ? actor.hitFlash / 0.18 : 0
    actor.rig.root.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of mats) {
        const m = mat as THREE.MeshLambertMaterial
        if (!m.userData.flashable) continue
        if (m.userData.baseE == null) m.userData.baseE = m.emissiveIntensity
        m.emissiveIntensity = (m.userData.baseE as number) + k * 1.8
      }
    })
  }

  private nearestEnemy(): { x: number; z: number; d: number } | null {
    let best: { x: number; z: number; d: number } | null = null
    for (const e of this.enemies) {
      if (e.dead || e.kind === 'hero') continue
      const d = Math.hypot(e.x - this.hero.x, e.z - this.hero.z)
      if (!best || d < best.d) best = { x: e.x, z: e.z, d }
    }
    return best
  }

  private updateLock(dt: number): Actor | null {
    const acquire = 3.2
    const release = 3.85
    const stick = 1.15
    const behindStick = 1.6
    const behind = 2.2
    const alive = this.enemies.filter((e) => !e.dead && !e.dummy && e.kind !== 'hero')
    const distOf = (e: Actor) => Math.hypot(e.x - this.hero.x, e.z - this.hero.z)
    const current = this.lockId == null ? null : (alive.find((e) => e.id === this.lockId) ?? null)
    const curDist = current ? distOf(current) : Infinity
    const held = current && curDist <= release ? current : null
    let nearest: Actor | null = null
    let nearestD = Infinity
    for (const e of alive) {
      const d = distOf(e)
      if (d <= acquire && d < nearestD) {
        nearest = e
        nearestD = d
      }
    }
    let desired: Actor | null = held
    if (!held) {
      desired = nearest
      this.lockCandidate = null
      this.lockCandT = 0
    } else if (nearest && nearest.id !== held.id) {
      const heldBear = Math.atan2(held.x - this.hero.x, held.z - this.hero.z)
      const nextBear = Math.atan2(nearest.x - this.hero.x, nearest.z - this.hero.z)
      const swap = Math.abs(this.wrapAngle(nextBear - heldBear))
      const need = swap > behind ? behindStick : stick
      if (nearestD < curDist - need) {
        if (this.lockCandidate !== nearest.id) {
          this.lockCandidate = nearest.id
          this.lockCandT = 0
        } else this.lockCandT += dt
        if (this.lockCandT > 0.38) desired = nearest
      } else {
        this.lockCandidate = null
        this.lockCandT = 0
      }
    } else {
      this.lockCandidate = null
      this.lockCandT = 0
    }
    this.lockId = desired?.id ?? null
    return desired
  }

  private placeLockRing(lock: Actor | null): void {
    const mat = this.lockRing.material as THREE.MeshBasicMaterial
    if (lock && this.lockBlend > 0.04) {
      this.lockRing.visible = true
      this.lockRing.position.set(lock.x, 0.04, lock.z)
      const pulse = 0.94 + Math.sin(this.sessionT * 5) * 0.05
      this.lockRing.scale.setScalar(pulse)
      mat.opacity = 0.35 + this.lockBlend * 0.4
    } else {
      this.lockRing.visible = false
    }
  }

  private placeAimRing(aim: Actor | null): void {
    const mat = this.aimRing.material as THREE.MeshBasicMaterial
    if (!aim) {
      this.aimRing.visible = false
      return
    }
    this.aimRing.visible = true
    this.aimRing.position.set(aim.x, 0.05, aim.z)
    const pulse = 1 + Math.sin(this.sessionT * 3.2) * 0.035
    this.aimRing.scale.setScalar(pulse)
    mat.opacity = 0.3 + Math.sin(this.sessionT * 3.2) * 0.05
  }

  private heroVisual(): number {
    const visual = this.hero.rig.root.userData.visual
    return typeof visual === 'number' ? visual : 1
  }

  private damp(current: number, target: number, dt: number, lambda: number): number {
    return current + (target - current) * (1 - Math.exp(-lambda * dt))
  }

  private wrapAngle(a: number): number {
    while (a > Math.PI) a -= Math.PI * 2
    while (a < -Math.PI) a += Math.PI * 2
    return a
  }

  private dampAngle(current: number, target: number, dt: number, lambda: number): number {
    const diff = this.wrapAngle(target - current)
    return this.wrapAngle(current + diff * (1 - Math.exp(-lambda * dt)))
  }

  private turnTowardPoint(actor: Actor, x: number, z: number, dt: number, rate: number): void {
    this.turnTowardAngle(actor, Math.atan2(x - actor.x, z - actor.z), dt, rate)
  }

  private turnTowardAngle(actor: Actor, desired: number, dt: number, rate: number): void {
    let diff = desired - actor.facing
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    const step = rate * dt
    actor.facing += Math.abs(diff) < step ? diff : Math.sign(diff) * step
  }

  /**
   * Renders the hero once from the play isometric angle into the round HUD.
   * The canvas is a still: later frames do not touch it.
   */
  private snapPortrait(): void {
    this.portraitTries++
    const size = 256
    const target = new THREE.WebGLRenderTarget(size, size)
    target.texture.colorSpace = THREE.SRGBColorSpace
    target.texture.minFilter = THREE.LinearFilter
    target.texture.magFilter = THREE.LinearFilter
    const shot = new THREE.Scene()
    shot.background = new THREE.Color(0x1a0c16)
    const hemi = new THREE.HemisphereLight(0x6e58a4, 0x3a2218, 0.85)
    const key = new THREE.DirectionalLight(0xffc48a, 1.35)
    key.position.set(4.2, 9.2, 5.4)
    const fill = new THREE.DirectionalLight(0x8898d8, 0.45)
    fill.position.set(-3.2, 3.4, -2.2)
    shot.add(hemi, key, fill)

    const root = this.hero.rig.root
    const parent = root.parent
    const pos = root.position.clone()
    const quat = root.quaternion.clone()
    const shown = root.visible
    const hidden: THREE.Object3D[] = []
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const mat = mesh.material as THREE.Material | undefined
      if (mat?.transparent && mat.opacity < 0.6 && mesh.position.y < 0.08) {
        mesh.visible = false
        hidden.push(mesh)
      }
    })
    root.position.set(0, 0, 0)
    root.rotation.set(0, Math.PI / 4, 0)
    root.visible = true
    shot.add(root)
    root.updateWorldMatrix(true, true)

    // Skinned bind bounds include the T-pose arms and dwarf the idle figure.
    // Fit the portrait to the posed bones, with room for hair, ears, and boots.
    const box = new THREE.Box3()
    const joint = new THREE.Vector3()
    let bones = 0
    root.traverse((obj) => {
      const skinned = obj as THREE.SkinnedMesh
      if (!skinned.isSkinnedMesh || !skinned.skeleton) return
      for (const bone of skinned.skeleton.bones) {
        bone.getWorldPosition(joint)
        box.expandByPoint(joint)
        bones++
      }
    })
    if (bones === 0) box.setFromObject(root)
    else {
      const pad = box.getSize(new THREE.Vector3())
      box.expandByVector(new THREE.Vector3(Math.max(0.12, pad.x * 0.16), pad.y * 0.04, Math.max(0.12, pad.z * 0.16)))
      box.max.y += pad.y * 0.36
      box.min.y -= pad.y * 0.1
    }
    const center = box.getCenter(new THREE.Vector3())
    const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 80)
    const dir = new THREE.Vector3(6.6, 10.8, 6.6).normalize()
    const corner = new THREE.Vector3()
    const ndc = new THREE.Vector3()
    const extent = (dist: number): number => {
      cam.position.copy(center).addScaledVector(dir, dist)
      cam.lookAt(center)
      cam.updateMatrixWorld()
      let maxAbs = 0
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z)
        ndc.copy(corner).project(cam)
        maxAbs = Math.max(maxAbs, Math.abs(ndc.x), Math.abs(ndc.y))
      }
      return maxAbs
    }
    let lo = 0.4
    let hi = Math.max(4, box.getSize(new THREE.Vector3()).length() * 4)
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2
      if (extent(mid) > 0.7) lo = mid
      else hi = mid
    }
    extent(hi)

    const prevTarget = this.renderer.getRenderTarget()
    const clear = this.renderer.getClearColor(new THREE.Color())
    const clearAlpha = this.renderer.getClearAlpha()
    this.renderer.setRenderTarget(target)
    this.renderer.setClearColor(0x1a0c16, 1)
    this.renderer.clear()
    this.renderer.render(shot, cam)
    const pixels = new Uint8Array(size * size * 4)
    this.renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels)
    this.renderer.setRenderTarget(prevTarget)
    this.renderer.setClearColor(clear, clearAlpha)

    if (parent) parent.add(root)
    root.position.copy(pos)
    root.quaternion.copy(quat)
    root.visible = shown
    for (const mesh of hidden) mesh.visible = true
    root.updateWorldMatrix(true, true)
    target.dispose()

    let lit = 0
    for (let i = 0; i < pixels.length; i += 16) lit += pixels[i]! + pixels[i + 1]! + pixels[i + 2]!
    if (lit < 4000 && this.portraitTries < 8) return
    this.portraitTries = 8
    this.hud.showPortrait(pixels, size)
  }

  private faceHeroToCamera(dt: number): void {
    // The rig's face points opposite the movement yaw, so that yaw aims
    // away from the lens and the gear screen shows a front profile.
    const yaw = Math.atan2(this.hero.x - this.camera.position.x, this.hero.z - this.camera.position.z)
    this.turnTowardAngle(this.hero, yaw, dt, 6)
    this.placeActor(this.hero)
  }

  private burst(x: number, y: number, z: number, color: number, n: number, speed: number, life: number): void {
    const c = new THREE.Color(color)
    for (let i = 0; i < n && this.sparks.length < 220; i++) {
      this.sparks.push({
        x,
        y,
        z,
        vx: (Math.random() - 0.5) * speed,
        vy: Math.random() * speed * 0.8,
        vz: (Math.random() - 0.5) * speed,
        life: life * (0.6 + Math.random() * 0.5),
        max: life,
        r: c.r,
        g: c.g,
        b: c.b,
      })
    }
  }

  private floatAt(x: number, y: number, z: number, text: string, cls: string): void {
    if (this.floaters.length > 22) {
      const old = this.floaters.shift()
      if (old) {
        old.el.remove()
        this.floatPool.push(old.el)
      }
    }
    const el = this.floatPool.pop() ?? this.hud.makeFloat()
    el.className = `float ${cls}`.trim()
    el.textContent = text
    this.hud.floatLayer.appendChild(el)
    this.floaters.push({ el, x, y, z, vy: 0.7, life: 0.85, max: 0.85 })
  }

  private project(x: number, y: number, z: number): { x: number; y: number; vis: boolean } {
    this.tmp.set(x, y, z).project(this.camera)
    return {
      x: (this.tmp.x * 0.5 + 0.5) * this.viewW,
      y: (-this.tmp.y * 0.5 + 0.5) * this.viewH,
      vis: this.tmp.z < 1,
    }
  }

  private advance(n: number, dt: number, present: boolean): {
    x: number
    z: number
    moving: number
    facing: number
    dist: number
    foes: number
    gait: number
  } {
    this.loopOn = false
    this.last = performance.now()
    const h = Math.min(0.1, Math.max(0.008, dt))
    const steps = Math.max(1, Math.min(40, Math.floor(n)))
    for (let i = 0; i < steps; i++) {
      this.update(h)
      this.frames++
    }
    if (present) this.paint()
    if (!this.save.seenHint) {
      this.save.seenHint = true
      this.hud.showHint(false)
    }
    const dx = this.guide ? this.guide.x - this.hero.x : 0
    const dz = this.guide ? this.guide.z - this.hero.z : 0
    return {
      x: this.hero.x,
      z: this.hero.z,
      moving: this.hero.moving,
      facing: this.hero.facing,
      dist: Math.hypot(dx, dz),
      foes: this.enemies.filter((e) => !e.dead).length,
      gait: this.gait,
    }
  }

  private persist(): void {
    writeSave(this.save)
  }

  private paintSpawns(): void {
    if (!new URLSearchParams(location.search).has('spawns')) return
    this.debugCam = 'map'
    const colors: Record<string, number> = {
      rat: 0xe6c36a,
      ghoul: 0xff7a32,
      wolf: 0xff4458,
      witch: 0xd58bff,
    }
    const names: Record<string, string> = {
      rat: 'RATS',
      ghoul: 'GHOUL',
      wolf: 'WOLF',
      witch: 'WITCH',
    }
    for (const nest of this.nests) {
      const color = colors[nest.kind] ?? 0xffffff
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(nest.role === 'alt' ? 0.32 : 0.46, 18),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: nest.role === 'alt' ? 0.45 : 0.88, depthWrite: false, fog: false }),
      )
      disc.rotation.x = -Math.PI / 2
      disc.position.set(nest.x, 0.08, nest.z)
      this.scene.add(disc)
      const label = this.spawnLabel(names[nest.kind] ?? nest.kind, color)
      label.position.set(nest.x, 1.05, nest.z)
      this.scene.add(label)
    }
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(KING_ARENA.radius - 0.28, KING_ARENA.radius, 40),
      new THREE.MeshBasicMaterial({ color: 0xffd15a, side: THREE.DoubleSide, transparent: true, opacity: 0.92, depthWrite: false, fog: false }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.set(KING_ARENA.x, 0.07, KING_ARENA.z)
    this.scene.add(ring)
    const king = this.spawnLabel('RAT KING', 0xffd15a)
    king.position.set(KING_ARENA.x, 1.45, KING_ARENA.z)
    king.scale.set(2.15, 0.54, 1)
    this.scene.add(king)
  }

  private spawnLabel(text: string, color: number): THREE.Sprite {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const g = canvas.getContext('2d')!
    g.fillStyle = 'rgba(12, 8, 14, 0.86)'
    g.fillRect(0, 0, 256, 64)
    g.strokeStyle = `#${color.toString(16).padStart(6, '0')}`
    g.lineWidth = 8
    g.strokeRect(6, 6, 244, 52)
    g.fillStyle = '#fff6d8'
    g.font = '700 32px Palatino, serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, 128, 34)
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, fog: false }),
    )
    sprite.scale.set(1.7, 0.42, 1)
    return sprite
  }

  private publish(ready: boolean): void {
    const crypt = this.world.nodes.crypt
    const fountain = this.world.nodes.fountain
    const api = {
      ready,
      getState: () => ({
        blood: this.save.blood,
        kills: this.save.kills,
        stacks: { ...this.save.stacks },
        gear: { ...this.save.gear },
        evolved: { ...this.save.evolved },
        level: this.save.level,
        xp: this.save.xp,
        bossKills: this.save.bossKills,
        mobKills: this.save.mobKills,
        donKills: this.save.donKills,
        district: this.district,
        bossAlive: !!(this.boss && !this.boss.dead),
        bossHp: this.boss && !this.boss.dead ? this.boss.hp : 0,
        donAlive: !!(this.don && !this.don.dead),
        donHp: this.don && !this.don.dead ? this.don.hp : 0,
        heroHp: this.hero.hp,
        heroMax: this.hero.maxHp,
        hero: { x: this.hero.x, z: this.hero.z, moving: this.hero.moving, dead: this.hero.dead, facing: this.hero.facing },
        attack: this.hero.atkT > 0 && this.hero.swingDur > 0 ? this.hero.atkT / this.hero.swingDur : 0,
        hitStop: this.hitStop,
        kenney: this.kenney != null,
        low: this.stage.low,
        gait: this.gait,
        loco: +this.loco.toFixed(2),
        hipYaw: this.hipYaw,
        moveYaw: this.moveYaw,
        locked: this.lockId != null,
        lockId: this.lockId,
        aim: (() => {
          const e = this.aimId == null ? null : (this.enemies.find((item) => item.id === this.aimId && !item.dead) ?? null)
          if (!e) return null
          return {
            id: e.id,
            kind: e.kind,
            d: +Math.hypot(e.x - this.hero.x, e.z - this.hero.z).toFixed(2),
          }
        })(),
        dashT: this.dashT,
        lockBlend: this.lockBlend,
        nearest: this.nearestEnemy(),
        speed: profile(this.save).speed,
        moveTries: this.moveTries,
        moveOk: this.moveOk,
        frames: this.frames,
        keys: this.hud.debugKeys(),
        obstacles: this.world.obstacles.map((o) => ({ x: +o.x.toFixed(2), z: +o.z.toFixed(2), r: +o.r.toFixed(2) })),
        crypt: { x: crypt.x, z: crypt.z, ready: !!crypt.group.userData.ready },
        fountain: { x: fountain.x, z: fountain.z, ready: !!fountain.group.userData.ready },
        skillsFired: this.skillsFired,
        hits: this.hits,
        nodeBlood: this.nodeBlood,
        killRate: this.save.killRate,
        sheet: {
          strength: sheetStat(this.save, 'strength'),
          agility: sheetStat(this.save, 'agility'),
          vitality: sheetStat(this.save, 'vitality'),
          sorcery: sheetStat(this.save, 'sorcery'),
          fortitude: sheetStat(this.save, 'fortitude'),
          resistance: sheetStat(this.save, 'resistance'),
        },
        gearFlat: gearFlat(this.save),
        camForward: { x: this.camFwd.x, z: this.camFwd.z },
        camRight: { x: this.camRight.x, z: this.camRight.z },
        fps: Math.round(this.fps),
        draws: this.paintedDraws,
        tris: this.paintedTris,
        muted: this.save.muted,
        bloodText: formatNum(this.save.blood),
        nests: this.nests.map((nest) => ({
          kind: nest.kind,
          role: nest.role,
          x: nest.x,
          z: nest.z,
          live: !!(nest.actor && !nest.actor.dead),
          timer: +nest.timer.toFixed(2),
        })),
        king: { x: KING_ARENA.x, z: KING_ARENA.z, r: KING_ARENA.radius },
        roster: this.enemies
          .filter((e) => !e.dead)
          .map((e) => ({
            kind: e.kind,
            x: +e.x.toFixed(2),
            z: +e.z.toFixed(2),
            hp: Math.round(e.hp),
            max: Math.round(e.maxHp),
            dmg: +e.dmg.toFixed(2),
            speed: +e.speed.toFixed(2),
            armor: +e.armor.toFixed(2),
            xp: e.rewardXp,
            blood: e.rewardBlood,
            bar: e.barT > 0 && e.hp < e.maxHp - 0.01,
          })),
      }),
      summon: () => {
        this.summonKing(true)
      },
      guide: (x: number, z: number, speed = 1.85) => {
        this.guide = { x, z }
        this.guideSpeed = speed
      },
      step: (dt = 1 / 20) => this.advance(1, dt, true),
      burst: (n: number, dt = 1 / 16) => this.advance(n, dt, false),
      wound: (fraction = 0.42) => {
        for (const e of this.enemies) {
          if (e.dead || e.kind === 'hero') continue
          const bite = e.kind === 'boss' || e.kind === 'don' ? Math.min(0.28, fraction) : fraction
          this.damageEnemy(e, e.maxHp * bite, false)
        }
      },
      pause: () => {
        this.startPaused = true
        this.persist()
      },
      resume: () => {
        this.startPaused = false
      },
      focus: (kind: 'play' | 'close' | 'claws' | 'enemy' | 'duel' | 'portrait' | 'facade' | 'king' | 'map') => {
        this.debugCam = kind
        if (kind === 'close' || kind === 'claws' || kind === 'duel') this.hero.facing = 0
      },
      goto: (x: number, z: number, facing?: number) => {
        this.hero.x = x
        this.hero.z = z
        this.hero.dead = false
        if (typeof facing === 'number') this.hero.facing = facing
        this.placeActor(this.hero)
        this.camPos.set(this.hero.x, 6, this.hero.z + 4)
        this.look.set(this.hero.x, 1, this.hero.z)
      },
      pose: (u: number) => {
        this.startPaused = true
        this.hero.dead = false
        this.hero.atkT = Math.max(0.001, Math.min(0.999, u))
        this.hero.swingDur = 1
        this.hero.facing = 0
        this.debugCam = 'duel'
      },
      rig: () => {
        const hand = this.hero.rig.claws[0]?.getObjectByName('claw-tip') ?? this.hero.rig.claws[0] ?? this.hero.rig.armR
        this.hero.rig.root.updateWorldMatrix(true, true)
        const p = new THREE.Vector3().setFromMatrixPosition(hand.matrixWorld)
        const q = this.hero.rig.armR.quaternion
        return {
          attack: this.hero.atkT > 0 && this.hero.swingDur > 0 ? this.hero.atkT / this.hero.swingDur : 0,
          hand: [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)],
          arm: [+q.x.toFixed(3), +q.y.toFixed(3), +q.z.toFixed(3), +q.w.toFixed(3)],
          actors: this.enemies
            .filter((e) => !e.dead)
            .map((e) => {
              e.rig.root.updateWorldMatrix(true, true)
              const size = new THREE.Box3().setFromObject(e.rig.root).getSize(new THREE.Vector3())
              const scr = this.project(e.x, size.y * 0.45, e.z)
              return {
                kind: e.kind,
                x: +e.x.toFixed(2),
                z: +e.z.toFixed(2),
                h: +size.y.toFixed(2),
                w: +Math.max(size.x, size.z).toFixed(2),
                sx: Math.round(scr.x),
                sy: Math.round(scr.y),
                face: +e.facing.toFixed(2),
              }
            }),
        }
      },
      ring: () => {
        const hero = this.hero
        const living = this.enemies.filter((e) => !e.dead && e.kind !== 'hero' && e.kind !== 'boss' && e.kind !== 'don')
        const ring = living.filter((e) => e.kind !== 'witch').slice(0, 4)
        const parked = living.filter((e) => !ring.includes(e))
        const spots: [number, number][] = [
          [2.15, 0.35],
          [-0.55, 2.2],
          [-2.15, -0.45],
          [0.7, -2.15],
        ]
        ring.forEach((e, i) => {
          const [ox, oz] = spots[i]
          e.x = hero.x + ox
          e.z = hero.z + oz
          e.speed = 0
          e.knockT = 0
          e.pending = null
          this.placeActor(e)
        })
        parked.forEach((e, i) => {
          e.x = -70 - i * 3
          e.z = -70
          e.speed = 0
          e.knockT = 0
          e.pending = null
          this.placeActor(e)
        })
      },
      rewind: (seconds: number) => {
        this.save.lastActiveAt = Date.now() - seconds * 1000
        this.freezeClock = true
        if (this.save.killRate < 0.05) this.save.killRate = 0.25
        this.persist()
      },
    }
    window.__BLOODHUNT__ = api
  }
}

function circleTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(16, 16, 1, 16, 16, 16)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.45, 'rgba(255,255,255,0.7)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 32, 32)
  const tex = new THREE.CanvasTexture(c)
  return tex
}

function makeTrail(positions: Float32Array): THREE.Mesh {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const index: number[] = []
  for (let i = 0; i < 9; i++) {
    const a = i * 2
    const b = a + 1
    const c = a + 2
    const d = a + 3
    index.push(a, b, c, b, d, c)
  }
  geo.setIndex(index)
  geo.setDrawRange(0, 0)
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color: 0xffe4ee,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  mesh.frustumCulled = false
  mesh.visible = false
  return mesh
}

function impactTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const glow = g.createRadialGradient(64, 64, 4, 64, 64, 60)
  glow.addColorStop(0, 'rgba(255,255,255,1)')
  glow.addColorStop(0.25, 'rgba(255,210,220,0.9)')
  glow.addColorStop(0.55, 'rgba(255,40,70,0.35)')
  glow.addColorStop(1, 'rgba(255,20,40,0)')
  g.fillStyle = glow
  g.fillRect(0, 0, 128, 128)
  g.strokeStyle = 'rgba(255,255,255,0.95)'
  g.lineWidth = 6
  g.lineCap = 'round'
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    g.beginPath()
    g.moveTo(64 + Math.cos(a) * 16, 64 + Math.sin(a) * 16)
    g.lineTo(64 + Math.cos(a) * 54, 64 + Math.sin(a) * 54)
    g.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function slashTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  g.strokeStyle = 'white'
  g.lineCap = 'round'
  g.lineWidth = 18
  g.beginPath()
  g.arc(40, 200, 150, Math.PI * 1.15, Math.PI * 1.72)
  g.stroke()
  g.globalAlpha = 0.65
  g.lineWidth = 8
  g.beginPath()
  g.arc(50, 210, 120, Math.PI * 1.2, Math.PI * 1.68)
  g.stroke()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeBat(): THREE.Group {
  const g = new THREE.Group()
  const bodyMat = new THREE.MeshBasicMaterial({ color: 0x1a0a12 })
  const wingMat = new THREE.MeshBasicMaterial({ color: 0x2a1020, side: THREE.DoubleSide })
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), bodyMat)
  body.scale.set(0.8, 0.6, 1.3)
  const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.1), wingMat)
  wingL.position.set(-0.14, 0, 0)
  const wingR = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.1), wingMat)
  wingR.position.set(0.14, 0, 0)
  g.add(body, wingL, wingR)
  return g
}

declare global {
  interface Window {
    __BLOODHUNT__?: {
      ready: boolean
      getState: () => Record<string, unknown>
      pause: () => void
      rewind: (seconds: number) => void
    }
  }
}
