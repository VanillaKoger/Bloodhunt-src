import * as THREE from 'three'
import {
  BOSS_MATERIALS,
  ENEMIES,
  MATERIAL_LABEL,
  FEED_COLOR,
  LEVEL_CAP,
  MAX_GEAR,
  NODE,
  SKILL_META,
  KING_ARENA,
  LITTER,
  POD_ALERT,
  POD_LEASH,
  POD_WAKE,
  bossBlueprint,
  donBlueprint,
  combatStat,
  enemyMitigate,
  enemyStats,
  formatNum,
  gearFlat,
  feedWeapon,
  gearName,
  heldTier,
  bossArmor,
  nextHeldTier,
  rankKills,
  tierPower,
  weaponRank,
  grantXp,
  mitigate,
  profile,
  sheetStat,
  skillDamage,
  upgradeCost,
  xpNeed,
  type ClawTierId,
  type CombatProfile,
  type Foe,
  type Material,
} from './balance'
import { ATTRS, POINTS_PER_LEVEL, attrPointsLeft, effectiveAttrs, weaponType, type Attr } from './attributes'
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
  createThug,
  createWitch,
  createWolf,
  equipWeapon,
  type MeleeState,
  type WeaponSet,
  type Rig,
} from './models'
import { loadSave, takeOfflineGains, writeSave } from './save'
import { Sfx } from './sfx'
import type { EnemyKind, NightSave, SaveData, SkillId, Slot } from './types'
import {
  DAWN_WARN,
  DISTRICT_IDS,
  ELITE,
  EXTRACT_CHANNEL,
  EXTRACT_RADIUS,
  FRENZY_DRAIN,
  FRENZY_STEP,
  FRENZY_WINDOW,
  POWER_MAX,
  RITES,
  RITE_IDS,
  SKILL_POWER_LABEL,
  SUNBURN,
  TIER_ICHOR,
  bossLoot,
  eliteChance,
  eliteIchor,
  bankedPurse,
  CURRENCIES,
  emptyPurse,
  formatClock,
  frenzyCap,
  keepShare,
  nightLength,
  matDrop,
  nightBite,
  tierIndex,
  tierOf,
  zoneName,
  nightTough,
  nightReward,
  nightSteps,
  powerCost,
  powerScale,
  type Currency,
  type DistrictId,
  type Purse,
  type RiteId,
} from './nights'
import { SKILLS, STATS } from './types'
import { WEAPONS, WEAPON_KINDS, isWeaponKind, swingTime, weaponName, weaponTraits, type SwingDef, type WeaponKind } from './weapons'
import type { KenneyLib } from './kenney'
import {
  COSMETICS,
  DPS_WINDOW,
  HAVEN,
  HAVEN_START,
  RANGE_SPOTS,
  STATIONS,
  STATION_REACH,
  WORKS,
  WORK_IDS,
  DEFAULT_LOOK,
  LOOK_SLOTS,
  LOOK_SLOT_LABEL,
  canAfford,
  cosmetic,
  workCost,
  type LookSlot,
  type StationDef,
  type WorkId,
} from './haven'
import { buildYard, type YardHandle } from './yard'
import { buildMapArt, type MapArtHandle } from './mapart'
import { MAPS, MAP_IDS, ZONE_COUNT, inZone, nearestInZone, type MapDef, type PodDef, type ZoneDef } from './maps'
import {
  AFFIX,
  AFFIXES,
  ATTACK_TOKENS,
  BOSS_COMBAT,
  BOSS_PHASE,
  BOSS_SIG,
  BOSS_SIG_LABEL,
  BOSS_SIGS,
  FOE_COMBAT,
  HERO_GUARD,
  ORBIT,
  SIG,
  SKILL_POISE,
  STAGGER,
  rollAffixes,
  sigGap,
  sigSlots,
  type Affix,
  type FoeCombat,
} from './combat'
import { Telegraphs, type Tele } from './telegraph'
import {
  MARKS,
  SWIFT_SECONDS,
  districtGate,
  districtOpen,
  emptyTally,
  markDone,
  markHave,
  markReward,
  markText,
  marksCleared,
  marksTotal,
  omenCounts,
  bestTier,
  omenFor,
  scoreMarks,
  tallyMeets,
  type NightTally,
} from './marks'
import { createStage, makeDrift, qualityLow, type Stage } from './polish'
import { DISTRICT_OPEN, FOG_COLOR, MOB_ARRIVE, MOB_GATE, SLUM_GATE, SLUM_RETURN, buildWorld, setNodeVisual, type WorldHandle } from './world'

/**
 * Root yaw for the hero's `facing`. Hero facing is kept so the body looks
 * along (sin θ, −cos θ) (see `yawAlong`), while the model looks down its own
 * +Z, so the root turns by π − θ. Written whole every frame, so no stray
 * Euler x/z (e.g. a quaternion read back past 90°) can flip the turn.
 */
function heroYaw(facing: number): number {
  return Math.PI - facing
}

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
  /** Index into the Slums pod list. -1 for litter, bosses, dummies, and the mob district. */
  pod: number
  returns: boolean
  barLag: number
  barT: number
  barFlash: number
  bar: HTMLDivElement
  /** Bosses: seconds until the next pound. */
  poundCd: number
  /** Bosses: 0 at first, 1 once it calls help and starts its own move, 2 enraged. */
  phase: number
  intro: number
  wanderT: number
  wanderA: number
  contact: THREE.Mesh
  /** Practice target. Stays put, never attacks, and stands back up 2s after it falls. */
  dummy: boolean
  /** Rolled at spawn during a night: tougher, bigger, pays triple Blood and drops Ichor. */
  elite: boolean
  /** Elite modifiers (combat.ts), and the name tag that shows them. */
  affixes: Affix[]
  tag: HTMLDivElement | null
  /** Poise damage toward a stagger, 0 to 1, and seconds since any landed. */
  poise: number
  poiseQuiet: number
  /** Staggers so far. Each makes a boss harder to break. */
  breaks: number
  /** Seconds left stunned. */
  stunT: number
  /** Dazed or winded after a charge or a pounce: takes double poise. */
  dazeT: number
  /** The attack or ability in progress. */
  act: EnemyAct | null
  /** Seconds until its ability is ready. */
  sigCd: number
  /** Holds an attack turn: may close in and swing. Without one it circles. */
  token: boolean
  tokenSwings: number
  /** Seconds before it may take a turn again. */
  waitT: number
  /** Which way it circles, ±1. */
  orbit: number
  /** Near a Packleader this frame. */
  led: boolean
  /** Warded elites: damage the ward still soaks. */
  ward: number
  wardFx: THREE.Mesh | null
  /** Skeletons: seconds left as a bone pile, its marker, and whether it already rose. */
  pile: number
  pileTele: Tele | null
  risen: boolean
  /** Shadowed elites: seconds until the next blink. */
  blinkCd: number
  /** Seconds spent making room for its ability. */
  setT: number
  /** Height off the ground mid-leap. */
  lift: number
  halo: THREE.Mesh | null
}

type ActMove = 'swing' | 'spit' | 'dash' | 'leap' | 'retch' | 'cast' | 'fan' | 'blink' | 'bossblink'

/** One telegraphed area: a disc, a lane from a point, or a wedge. Angles are atan2(dx, dz). */
interface Shape {
  type: 'circle' | 'lane' | 'cone'
  x: number
  z: number
  r: number
  angle: number
  len: number
  width: number
  half: number
  tele: Tele
}

/** An enemy's attack or ability: wind-up (marked on the ground), the move, then a rest. */
interface EnemyAct {
  move: ActMove
  stage: 'wind' | 'go' | 'rest'
  t: number
  wind: number
  go: number
  rest: number
  /** Red abilities cannot be staggered out of. */
  red: boolean
  /** Target point, locked direction, and the start of a leap or a dash. */
  x: number
  z: number
  dx: number
  dz: number
  ox: number
  oz: number
  len: number
  width: number
  r: number
  dmg: number
  hit: boolean
  shapes: Shape[]
  /** Plain attacks follow the hero this long, then commit. */
  track: number
  /** Repeats left (the enraged pound). */
  n: number
  boss: boolean
}

interface PoolSpec {
  readonly r: number
  readonly time: number
  readonly tick: number
  readonly dmg: number
}

/** A red area that lands on its own clock: lobs, graves, beams, a volatile death. */
interface Blast {
  shapes: Shape[]
  t: number
  wind: number
  dmg: number
  boss: boolean
  red: boolean
  src: Actor | null
  pool: PoolSpec | null
  glob: THREE.Mesh | null
  ox: number
  oz: number
}

/** Bile or acid on the ground: hurts on a tick while the hero stands in it. */
interface Pool {
  x: number
  z: number
  r: number
  life: number
  max: number
  tick: number
  every: number
  dmg: number
  boss: boolean
  tele: Tele
  src: Actor | null
}

/** The hero's body, for what counts as inside a marked area. */
const HERO_R = 0.35

/** HP a range dummy staggers against, so the yard shows what a stagger takes. */
const DUMMY_POISE_HP = 140

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
  kind: Currency
}

/** A night in progress. Everything picked up is `carried` until the hero extracts. */
interface NightRun {
  district: DistrictId
  danger: number
  elapsed: number
  length: number
  carried: Purse
  kills: number
  /** Frenzy stacks, and seconds since the last kill. */
  frenzy: number
  sinceKill: number
  /** Seconds stood at an extract point. */
  channel: number
  warned: boolean
  dawn: boolean
  /** Set once the night has ended and its summary is up. */
  over: boolean
  /** What the night has done toward the marks and the Omen. */
  tally: NightTally
  /** Marks already called out this night. */
  said: string[]
}

interface Beacon {
  district: DistrictId
  zone: number
  x: number
  z: number
  label: string
  group: THREE.Group
  column: THREE.Mesh
  ring: THREE.Mesh
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
  boss: boolean
  src: Actor | null
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

interface PodRuntime {
  members: Actor[]
  /** Seconds until a wiped pod can wake again. */
  timer: number
  /** Seconds left of the pod hunting the hero together. */
  alert: number
  /** Danger the members were rolled at, so a fresh night re-rolls. */
  rolls: number
}

const HERO_CLEAR = 2.15

/** Procedural stand-ins when the model packs fail to load. */
const FALLBACK: Record<Foe, () => Rig> = {
  hound: createWolf,
  walker: createGhoul,
  thrall: createGhoul,
  spitter: createWitch,
  skeleton: createGhoul,
  thug: createThug,
  enforcer: createEnforcer,
}

/**
 * Recolors a creature for the map it is hunted in. Materials are cloned first
 * so a model's shared material is never tinted twice.
 */
function tintRig(rig: Rig, tint: number): void {
  const color = new THREE.Color(tint)
  rig.root.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const src = mesh.material as THREE.MeshLambertMaterial
    if (Array.isArray(src) || !src?.color || src.transparent) return
    if (!src.userData.flashable && !src.map) return
    const own = src.clone()
    own.userData = { ...src.userData }
    own.color.multiply(color)
    if (own.emissive) own.emissive.multiply(color)
    mesh.material = own
  })
}

function rollMix(mixes: PodDef['mixes']): Foe[] {
  let roll = Math.random() * mixes.reduce((sum, mix) => sum + mix.weight, 0)
  for (const mix of mixes) {
    roll -= mix.weight
    if (roll <= 0) return mix.kinds
  }
  return mixes[0].kinds
}

const GEAR_BLURB: Record<Slot, (lv: number, evolved: boolean) => string> = {
  weapon: (lv, ev) => `+${2 * lv + (ev ? 8 : 0)} Strength · +${formatNum(lv * 0.5)} Vitality`,
  cape: (lv, ev) => `+${formatNum(1.5 * lv + (ev ? 8 : 0))} Sorcery · +${lv} Resistance`,
  coat: (lv, ev) => `+${2 * lv + (ev ? 8 : 0)} Fortitude · +${formatNum(1.5 * lv)} Vitality`,
  boots: (lv, ev) => `+${2 * lv + (ev ? 8 : 0)} Agility · +${formatNum(lv * 0.5)} Fortitude`,
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
  /** The hero's swing: its clip, the clip's playback rate, and the elapsed time its hit lands. */
  private swingMove: SwingDef = WEAPONS.claws.swings[0]
  private swingRate = 1
  private swingHit = 0
  private swingN = 0
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
  private teles: Telegraphs
  /** Seconds before another red ability may start. */
  private sigGap = 0
  private blasts: Blast[] = []
  private pools: Pool[] = []
  /** The hero's walk velocity, smoothed, for leading lobs and pounces. */
  private heroVx = 0
  private heroVz = 0
  /** Seconds since the hero last took a hit. Regen waits on it. */
  private sinceHurt = 99
  /** Test counters: kills on stunned enemies, and damage the hero has taken. */
  private feeds = 0
  /** Test hook: the hero holds its swings, so an enemy's whole kit can be watched. */
  private calm = false
  private hurtTotal = 0
  private readonly wardMat = new THREE.MeshBasicMaterial({ color: 0x6ad8ff, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending })
  private readonly affixRingMats = new Map<Affix, THREE.MeshBasicMaterial>()
  private readonly boltGeo = new THREE.SphereGeometry(0.12, 10, 8)
  private readonly boltMats = new Map<number, THREE.MeshBasicMaterial>()
  private readonly globGeo = new THREE.SphereGeometry(0.2, 10, 8)
  private readonly globMat = new THREE.MeshBasicMaterial({ color: 0x9cff3a })
  private readonly haloGeo = new THREE.TorusGeometry(0.32, 0.045, 6, 18)
  private readonly haloMat = new THREE.MeshBasicMaterial({ color: 0xffd04a })
  private readonly wardGeo = new THREE.SphereGeometry(1, 18, 12)
  private bloodMat: THREE.MeshLambertMaterial
  private frames = 0
  private paintedDraws = 0
  private paintedTris = 0
  private startPaused = new URLSearchParams(location.search).has('paused')
  /** Tries spent on the one-shot HUD portrait. Stays high once the still is stored. */
  private portraitTries = 0
  private weaponIcons = false
  private iconTier: ClawTierId | null = null
  /** ?enemies=1 starts a Slums night at load (for test runs). Otherwise the game opens at the Haven. */
  private foes = new URLSearchParams(location.search).has('enemies')
  /** The night in progress, or null at the Haven. */
  private night: NightRun | null = null
  private beacons: Beacon[] = []
  private dropMats!: Record<Currency, THREE.MeshLambertMaterial>
  private readonly fogBase = new THREE.Color(FOG_COLOR)
  private readonly dawnFog = new THREE.Color(0x6a2c34)
  private readonly tmpColor = new THREE.Color()
  private readonly eliteRingGeo = new THREE.RingGeometry(0.82, 1, 32)
  private readonly eliteRingMat = new THREE.MeshBasicMaterial({
    color: 0xffc04a,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  /** The gear menu was opened from the Haven board, so closing it goes back there. */
  private backToHaven = false
  private yard!: YardHandle
  private mapArt!: MapArtHandle
  /** The Haven station the hero stands at, if any. */
  private station: StationDef | null = null
  /** Hits on each range dummy, by actor id: when and how much. */
  private rangeLog = new Map<number, { t: number; amount: number }[]>()
  /** One readout per range spot, and which dummy stands on each. */
  private rangeTags: HTMLDivElement[] = []
  private rangeSpot = new Map<number, number>()
  /** Scripted walk for the environment tour. Normal play leaves this null. */
  private guide: { x: number; z: number } | null = null
  private guideSpeed = 1.85
  private boss: Actor | null = null
  private don: Actor | null = null
  private donCd = 0
  private district: DistrictId = 'slums'
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
  private pods: PodRuntime[] = []
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
    this.yard = buildYard(this.scene, qualityLow())
    this.world.obstacles.push(...this.yard.obstacles)
    this.mapArt = buildMapArt(this.scene)
    this.world.obstacles.push(...this.mapArt.obstacles)
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

    this.teles = new Telegraphs(this.scene)

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
    this.dropMats = {
      blood: this.bloodMat,
      ichor: new THREE.MeshLambertMaterial({ color: 0x7a2ad8, emissive: 0xb45cff, emissiveIntensity: 2 }),
      vitae: new THREE.MeshLambertMaterial({ color: 0xffe2a0, emissive: 0xffc860, emissiveIntensity: 2.2 }),
      bone: new THREE.MeshLambertMaterial({ color: 0xf2ead6, emissive: 0xbab098, emissiveIntensity: 1.2 }),
      bile: new THREE.MeshLambertMaterial({ color: 0x9cff3a, emissive: 0x6ad81a, emissiveIntensity: 1.8 }),
      brass: new THREE.MeshLambertMaterial({ color: 0xe8b84a, emissive: 0xc88a1a, emissiveIntensity: 1.6 }),
    }
    this.makeBeacons()

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
    this.district = 'slums'
    if (this.save.bosses.slums > 0) {
      this.world.gateGlow.emissiveIntensity = 1.7
      this.world.gateGlow.color.setHex(0xff4ad8)
    }
    this.hud.setDistrict('THE HAVEN')
    const prof = profile(this.save)
    const heroRig = kenney ? kenney.hero() : createHero()
    const start = HAVEN_START
    this.hero = this.makeActor('hero', heroRig, start.x, start.z, prof.hp, 0.4, 1.95)
    this.applyWeaponLook()

    this.resetPods()
    this.layDummies()
    this.paintSpawns()

    this.hud.onSkill = (id) => this.cast(id)
    this.hud.onOpenMenu = () => this.openMenu()
    this.hud.onCloseMenu = () => this.closeMenu()
    this.hud.onSelectSlot = () => this.refreshMenu()
    this.hud.onUpgrade = () => this.upgrade()
    this.hud.onRaise = (attr) => this.raiseAttr(attr)
    this.hud.onEquip = (kind) => this.equip(kind)
    this.hud.onSummon = () => this.trySummon()
    this.hud.onClaim = () => this.claimOffline()
    this.hud.onOpenHaven = () => this.interact()
    this.hud.onCloseHaven = () => this.hud.showHaven(false)
    this.hud.onBeginNight = (district, danger) => this.beginNight(district, danger)
    this.hud.onBuyPower = (id) => this.buyPower(id)
    this.hud.onBuyRite = (id) => this.buyRite(id)
    this.hud.onBuyWork = (id) => this.buyWork(id)
    this.hud.onLook = (id) => this.pickLook(id)
    this.hud.onAscend = () => this.ascend()
    this.hud.onAbandon = () => this.loseNight('fled')
    this.hud.onLeaveSummary = () => {
      if (this.night?.over) this.enterHaven()
    }
    this.hud.onMute = () => this.toggleMute()
    this.hud.zoom = this.save.camZoom
    this.hud.onZoom = (z) => {
      this.save.camZoom = z
    }
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
      if (e.code === 'KeyE' || e.code === 'Enter') this.interact()
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

    // A reload mid-night drops the hero back into it. Test runs start one.
    if (this.save.night) this.beginNight(this.save.night.district, this.save.night.danger, this.save.night)
    else if (this.foes) {
      this.beginNight('slums', 0)
      if (params.has('don') && districtOpen(this.save, 'mob')) this.beginNight('mob', ZONE_COUNT - 1)
    } else if (!report) this.hud.toast('The Haven. Walk to the Night Gate to hunt.')
    this.hud.setNightHud(null)
    this.updateHud()

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

  /**
   * How far the play camera sits, as a multiple of its wide-screen distance.
   * A portrait phone sees a slice only half as wide, so it pulls back until
   * the hero sees about 8 m to the sides; the player's zoom multiplies that.
   */
  private camScale(): number {
    const aspect = this.viewW / Math.max(1, this.viewH)
    const fit = aspect >= 1 ? 1 : Math.min(1.6, 1 + (1 - aspect))
    return fit * this.hud.zoom
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
      this.sinceHurt += dt
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
      this.updateHazards(dt)
      this.updateNight(dt)
      this.updateBats(dt, prof)
      this.updateNova(dt, prof)
      this.updateBeam(dt)
      this.updateDrops(dt)
      this.updateBolts(dt)
      this.updateNodes(dt)
      this.updateHaven(dt)
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
    this.updateBeacons(dt)
    this.updateRange()
    this.updateHud()
    if (this.portraitTries < 8 && this.frames >= 1) this.snapPortrait()
    if (!this.weaponIcons && this.frames >= 1) this.snapWeaponIcons()
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
        if (this.hunting()) {
          // A death on the hunt ends the night. The hero wakes at the Haven.
          hero.deathT = 0
          this.loseNight(this.night!.dawn ? 'dawn' : 'fell')
          this.animateActor(hero, dt)
          return
        }
        hero.dead = false
        hero.hp = hero.maxHp * 0.65
        this.iframe = 1.3
        hero.rig.bob.scale.setScalar(1)
        this.hud.toast('Mist gathers. You stand again.')
      }
      this.animateActor(hero, dt)
      return
    }
    // Natural regen waits for a breather; lifesteal and Blood Drain still heal mid-fight.
    if (hero.hp < hero.maxHp && this.sinceHurt > HERO_GUARD.regenDelay) hero.hp = Math.min(hero.maxHp, hero.hp + prof.regen * dt)

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
          this.damageEnemy(e, skillDamage('dash', prof, this.save.powers.dash), false, SKILL_POISE.dash)
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
    if (dt > 0) {
      this.heroVx = this.damp(this.heroVx, dashing ? 0 : (hero.x - x0) / dt, dt, 8)
      this.heroVz = this.damp(this.heroVz, dashing ? 0 : (hero.z - z0) / dt, dt, 8)
    }
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
      if (hero.atkT >= this.swingHit - 0.06 / this.swingRate) this.slashT = Math.max(this.slashT, 0.18)
      if (!hero.struck && hero.atkT >= this.swingHit) {
        hero.struck = true
        this.resolveStrike(prof)
      }
      if (hero.atkT >= len) hero.atkT = 0
    }
    if (this.dashT <= 0 && hero.atkCd <= 0 && hero.atkT <= 0 && !this.calm) {
      const target = this.nearest(2.15, false, true)
      if (target) {
        // The clip plays at the weapon's own rate. The hit lands on its
        // contact frame and the next swing waits until it is back on guard.
        const w = WEAPONS[this.save.weapon]
        const move = w.swings[this.swingN % w.swings.length]
        const len = swingTime(this.save.weapon, move)
        this.swingN++
        this.swingMove = move
        this.swingRate = w.rate
        this.swingHit = move.contact / w.rate
        hero.atkCd = len
        hero.atkT = 0.0001
        hero.struck = false
        hero.swingDur = len
        hero.swingT = len
      }
    }
    this.animateActor(hero, dt)
    hero.rig.root.position.set(hero.x, 0, hero.z)
    hero.rig.root.rotation.set(0, heroYaw(hero.facing), 0)
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
    const w = WEAPONS[this.save.weapon]
    const fx = Math.sin(hero.facing)
    const fz = -Math.cos(hero.facing)
    let any = false
    let fought = false
    for (const e of this.enemies) {
      if (e.dead || e.kind === 'hero') continue
      const dx = e.x - hero.x
      const dz = e.z - hero.z
      const dist = Math.hypot(dx, dz) || 0.0001
      const reach = 1.95 + w.reach + e.radius * 0.35
      if (dist > reach) continue
      const dot = (dx / dist) * fx + (dz / dist) * fz
      if (dot < w.arc) continue
      const crit = Math.random() < prof.crit
      const dmg = prof.dmg * (crit ? 1.7 : 1)
      // No push: the hit rocks it in place, and its poise does the rest.
      this.damageEnemy(e, dmg, crit, w.poise)
      const nx = dx / dist
      const nz = dz / dist
      if (!e.dummy) fought = true
      e.flinch = 0.2 * this.fightOf(e).flinch
      e.hitFlash = 0.18
      this.spawnImpact(hero.x + nx * Math.min(dist, 1.15), 1.05, hero.z + nz * Math.min(dist, 1.15))
      any = true
    }
    if (any) {
      this.sfx.play('hit')
      if (fought) this.hitStop = Math.max(this.hitStop, 0.06 * Math.max(1, w.poise * 0.9))
      this.shake = Math.max(this.shake, 0.2 * Math.max(1, w.poise * 0.75))
    }
  }

  /** The trail draws through the strike: from just before the contact frame to just after it, in clip seconds. */
  private trailLive(): boolean {
    if (this.hero.atkT <= 0) return false
    const t = this.hero.atkT * this.swingRate
    const c = this.swingMove.contact
    return t >= c - 0.14 && t <= c + 0.1
  }

  private sampleTrail(): void {
    const hero = this.hero
    if (!this.trailLive()) return
    const hand = hero.rig.claws[0]?.getObjectByName('claw-tip') ?? hero.rig.claws[0] ?? hero.rig.armR
    hand.updateWorldMatrix(true, true)
    this.tip.setFromMatrixPosition(hand.matrixWorld)
    this.trailPts.push(this.tip.clone())
    if (this.trailPts.length > 10) this.trailPts.shift()
  }

  private updateTrail(dt: number): void {
    const live = this.trailLive()
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
    this.tickPods(dt)
    this.sigGap = Math.max(0, this.sigGap - dt)
    this.markLeaders()
    this.assignTokens(dt)
    for (const e of this.enemies) {
      if (e.dummy) {
        e.moving = 0
        e.act = null
        e.speed = 0
        e.dmg = 0
        e.hitFlash = Math.max(0, e.hitFlash - dt)
        e.flinch = Math.max(0, e.flinch - dt)
        this.tickPoise(e, dt)
        if (e.stunT > 0) {
          e.stunT -= dt
          if (e.stunT <= 0) this.endStun(e)
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
      e.dazeT = Math.max(0, e.dazeT - dt)
      this.tickPoise(e, dt)
      if (e.pile > 0) {
        this.updatePile(e, dt)
        continue
      }
      if (e.stunT > 0) {
        e.stunT -= dt
        e.moving = 0
        if (e.stunT <= 0) this.endStun(e)
        this.placeActor(e)
        this.animateActor(e, dt)
        continue
      }
      if (e.kind === 'hero') continue
      const boss = this.isBoss(e)
      if (boss) this.bossPhase(e)
      e.atkCd -= dt
      e.sigCd -= dt
      e.blinkCd -= dt
      if (e.act) {
        this.updateAct(e, dt)
      } else {
        const dist = Math.hypot(hero.x - e.x, hero.z - e.z)
        const aggro = boss ? 12 : this.podAggro(e, ENEMIES[e.kind as Foe].aggro)
        if (dist < aggro && !hero.dead) {
          if (boss) this.bossThink(e, dist, dt)
          else this.foeThink(e, dist, dt)
        } else {
          const speed = this.speedOf(e)
          e.wanderT -= dt
          const home = this.podHome(e)
          if (home) {
            e.wanderA = Math.atan2(home.x - e.x, home.z - e.z)
            e.wanderT = 0.6
          } else if (e.wanderT <= 0) {
            e.wanderT = 1.2 + Math.random() * 1.8
            e.wanderA = Math.random() * Math.PI * 2
          }
          this.moveActor(e, Math.sin(e.wanderA) * speed * 0.35 * dt, Math.cos(e.wanderA) * speed * 0.35 * dt)
          e.moving = 0.4
          this.turnTowardAngle(e, e.wanderA, dt, 4)
        }
      }
      if (e.dead) continue
      if (!e.act || e.act.stage !== 'go') this.separate(e)
      this.placeActor(e)
      if (e.lift > 0) e.rig.root.position.y = e.lift
      this.animateActor(e, dt)
    }
  }

  private isBoss(e: Actor): boolean {
    return e.kind === 'boss' || e.kind === 'don'
  }

  private has(e: Actor, a: Affix): boolean {
    return e.affixes.includes(a)
  }

  /** The fight numbers for an enemy: its kind's, or the bosses'. */
  private fightOf(e: Actor): Omit<FoeCombat, 'sig'> {
    if (e.kind === 'boss' || e.kind === 'don' || e.kind === 'hero') return BOSS_COMBAT
    return FOE_COMBAT[e.kind]
  }

  private speedOf(e: Actor): number {
    let s = this.isBoss(e) ? this.rivalBlueprint().speed : e.speed
    if (this.isBoss(e) && e.phase >= 2) s *= BOSS_PHASE.rageSpeed
    if (this.has(e, 'frenzied')) s *= AFFIX.frenzied.speed
    if (e.led) s *= AFFIX.packleader.speed
    return s
  }

  /** One plain hit from this enemy, before the hero's armor. */
  private dmgOf(e: Actor): number {
    const base = this.isBoss(e) ? this.rivalBlueprint().dmg : e.dmg
    return base * (e.led ? AFFIX.packleader.dmg : 1)
  }

  /** Seconds between plain attacks. */
  private cdOf(e: Actor): number {
    let cd = this.isBoss(e) ? 1.35 : ENEMIES[e.kind as Foe].cd
    if (this.isBoss(e) && e.phase >= 2) cd *= BOSS_PHASE.rageCd
    if (this.has(e, 'frenzied')) cd *= AFFIX.frenzied.cd
    return cd
  }

  /** Packleaders lift everyone near them. */
  private markLeaders(): void {
    const leaders = this.enemies.filter((e) => !e.dead && e.affixes.includes('packleader'))
    for (const e of this.enemies) {
      e.led = !e.dead && leaders.some((l) => l !== e && Math.hypot(l.x - e.x, l.z - e.z) < AFFIX.packleader.r)
    }
  }

  /**
   * Only a few enemies may close in and swing at once; the rest circle. A
   * holder that has swung twice hands its turn to whoever has waited.
   */
  private assignTokens(dt: number): void {
    const hero = this.hero
    const max = ATTACK_TOKENS
    const want: Actor[] = []
    for (const e of this.enemies) {
      e.waitT = Math.max(0, e.waitT - dt)
      const ok =
        !hero.dead &&
        !e.dead &&
        !e.dummy &&
        e.kind !== 'hero' &&
        !this.isBoss(e) &&
        e.kind !== 'spitter' &&
        e.pile <= 0 &&
        e.intro <= 0 &&
        Math.hypot(hero.x - e.x, hero.z - e.z) < this.podAggro(e, ENEMIES[e.kind as Foe].aggro)
      if (!ok) {
        e.token = false
        e.tokenSwings = 0
        continue
      }
      want.push(e)
    }
    const waiting = want.filter((e) => !e.token && e.waitT <= 0)
    let held = want.filter((e) => e.token).length
    if (waiting.length) {
      for (const e of want) {
        if (e.token && e.tokenSwings >= 2 && !e.act) {
          e.token = false
          e.tokenSwings = 0
          e.waitT = 1.4
          held--
        }
      }
    }
    const d = (e: Actor) => Math.hypot(hero.x - e.x, hero.z - e.z)
    waiting.sort((a, b) => d(a) - d(b))
    for (const e of waiting) {
      if (held >= max) break
      e.token = true
      e.tokenSwings = 0
      held++
    }
  }

  /** A plain enemy with the hero in sight: its ability if it can, else its turn to swing, else circling. */
  private foeThink(e: Actor, dist: number, dt: number): void {
    const hero = this.hero
    const kind = e.kind as Foe
    const fight = FOE_COMBAT[kind]
    const speed = this.speedOf(e)
    this.turnTowardPoint(e, hero.x, hero.z, dt, fight.turn)
    if (this.tryShadow(e, dist)) return
    if (this.trySig(e, dist)) return
    if (this.setUp(e, dist, dt, speed)) return
    if (kind === 'spitter') {
      if (dist <= 2.3) {
        const dx = e.x - hero.x
        const dz = e.z - hero.z
        const len = Math.hypot(dx, dz) || 1
        this.moveActor(e, (dx / len) * speed * dt, (dz / len) * speed * dt)
        e.moving = 1
      } else if (dist > ENEMIES.spitter.range) {
        this.stepToward(e, hero.x, hero.z, speed, dt)
      } else {
        e.moving = 0.2
        if (e.atkCd <= 0) this.startSpit(e)
      }
      return
    }
    const reach = e.radius + fight.reach + HERO_R
    if (e.token) {
      if (dist > reach * 0.82) this.stepToward(e, hero.x, hero.z, speed, dt)
      else {
        e.moving = 0.15
        if (e.atkCd <= 0) this.startSwing(e)
      }
      return
    }
    this.circleHero(e, dist, dt, speed)
  }

  /**
   * A gap-closer whose ability is ready gives itself room first: the thug and
   * the thrall back off, the hound slips round to the flank. It gives up after
   * a couple of seconds and tries again later.
   */
  private setUp(e: Actor, dist: number, dt: number, speed: number): boolean {
    const sig = FOE_COMBAT[e.kind as Foe].sig
    if (e.sigCd > 0 || (sig !== 'charge' && sig !== 'pounce' && sig !== 'lunge') || !this.redFree()) {
      e.setT = 0
      return false
    }
    e.setT += dt
    if (e.setT > 2.2) {
      e.sigCd = 2.5
      e.setT = 0
      return false
    }
    if (sig === 'lunge') {
      this.circleHero(e, dist, dt, speed)
      return true
    }
    const min = sig === 'charge' ? SIG.charge.min : SIG.pounce.min
    if (dist >= min + 0.3) return false
    const hero = this.hero
    const dx = e.x - hero.x
    const dz = e.z - hero.z
    const len = Math.hypot(dx, dz) || 1
    this.moveActor(e, (dx / len) * speed * 0.85 * dt, (dz / len) * speed * 0.85 * dt)
    e.moving = 0.8
    return true
  }

  private stepToward(e: Actor, x: number, z: number, speed: number, dt: number): void {
    const dx = x - e.x
    const dz = z - e.z
    const len = Math.hypot(dx, dz) || 1
    this.moveActor(e, (dx / len) * speed * dt, (dz / len) * speed * dt)
    e.moving = 1
  }

  /** Waiting its turn: keeps a ring around the hero and drifts round it. Hounds give ground when faced. */
  private circleHero(e: Actor, dist: number, dt: number, speed: number): void {
    const hero = this.hero
    const fx = Math.sin(hero.facing)
    const fz = -Math.cos(hero.facing)
    const ax = e.x - hero.x
    const az = e.z - hero.z
    let r = ORBIT.r + (e.id % 3) * ORBIT.spread
    if (e.kind === 'hound' && (ax * fx + az * fz) / (dist || 1) > 0.45) r += 1.1
    const a = Math.atan2(ax, az) + e.orbit * ORBIT.speed * (e.kind === 'hound' ? 1.7 : 1) * dt * 2.2
    const tx = hero.x + Math.sin(a) * r
    const tz = hero.z + Math.cos(a) * r
    const dx = tx - e.x
    const dz = tz - e.z
    const len = Math.hypot(dx, dz)
    if (len < 0.12) {
      e.moving = 0.1
      return
    }
    const step = Math.min(len, speed * 0.7 * dt)
    const x0 = e.x
    const z0 = e.z
    this.moveActor(e, (dx / len) * step, (dz / len) * step)
    e.moving = 0.6
    // Blocked by a wall or a crate: circle the other way.
    if (Math.hypot(e.x - x0, e.z - z0) < step * 0.3 && Math.random() < 0.08) e.orbit *= -1
  }

  /** Red abilities winding up right now. */
  private redCount(): number {
    let n = 0
    for (const e of this.enemies) if (!e.dead && e.act?.red && e.act.stage === 'wind') n++
    return n + this.blasts.filter((b) => b.red && b.t < b.wind).length
  }

  /** Minions hold their red abilities while the boss's own is on the ground. */
  private redFree(): boolean {
    return this.sigGap <= 0 && this.redCount() < sigSlots(this.tier()) && !this.bossRed()
  }

  /** A boss's red move or blast still winding up. */
  private bossRed(): boolean {
    for (const e of this.enemies) if (!e.dead && this.isBoss(e) && e.act?.red && e.act.stage === 'wind') return true
    return this.blasts.some((b) => b.boss && b.t < b.wind)
  }

  private claimRed(): void {
    this.sigGap = sigGap(this.tier())
  }

  /** The hero's walk, smoothed: where a lob or a pounce leads its aim. */
  private heroLead(seconds: number): { x: number; z: number } {
    return this.clampArena(this.hero.x + this.heroVx * seconds, this.hero.z + this.heroVz * seconds)
  }

  private newAct(move: ActMove, wind: number, go: number, rest: number, red: boolean, dmg: number): EnemyAct {
    return { move, stage: 'wind', t: 0, wind, go, rest, red, x: 0, z: 0, dx: 0, dz: 1, ox: 0, oz: 0, len: 0, width: 0, r: 0, dmg, hit: false, shapes: [], track: 0, n: 0, boss: false }
  }

  private addShape(act: EnemyAct, shape: Omit<Shape, 'tele'>): void {
    const tone = act.red ? 'red' : 'gold'
    let tele: Tele
    if (shape.type === 'circle') tele = this.teles.circle(shape.x, shape.z, shape.r, tone)
    else if (shape.type === 'lane') tele = this.teles.lane(shape.x, shape.z, shape.angle, shape.len, shape.width, tone)
    else tele = this.teles.cone(shape.x, shape.z, shape.angle, shape.r, shape.half, tone)
    act.shapes.push({ ...shape, tele })
  }

  private endAct(e: Actor): void {
    if (!e.act) return
    for (const s of e.act.shapes) this.teles.release(s.tele)
    e.act = null
    e.lift = 0
    e.atkCd = Math.max(e.atkCd, this.cdOf(e) * 0.5)
    // A stagger that landed during a red ability takes hold once it is over.
    if (e.poise >= 1 && e.stunT <= 0 && !e.dead) this.stagger(e)
  }

  private cancelAct(e: Actor): void {
    if (!e.act) return
    for (const s of e.act.shapes) this.teles.release(s.tele)
    e.act = null
    e.lift = 0
  }

  /** Is the hero inside a shape? A little slack for the hero's own body. */
  private inShape(s: Shape, x: number, z: number): boolean {
    const dx = x - s.x
    const dz = z - s.z
    if (s.type === 'circle') return Math.hypot(dx, dz) < s.r + HERO_R * 0.6
    const fx = Math.sin(s.angle)
    const fz = Math.cos(s.angle)
    if (s.type === 'lane') {
      const along = dx * fx + dz * fz
      const side = Math.abs(dx * fz - dz * fx)
      return along > -HERO_R && along < s.len + HERO_R && side < s.width / 2 + HERO_R * 0.6
    }
    const d = Math.hypot(dx, dz)
    if (d < 0.55) return true
    if (d > s.r + HERO_R * 0.6) return false
    return (dx * fx + dz * fz) / d > Math.cos(s.half)
  }

  /** Lands an act's shapes on the hero: one hit at most, whatever they overlap. */
  private landShapes(e: Actor | null, shapes: Shape[], dmg: number, boss: boolean): boolean {
    const hero = this.hero
    if (hero.dead) return false
    if (!shapes.some((s) => this.inShape(s, hero.x, hero.z))) return false
    return this.damageHero(dmg, boss, e)
  }

  // ---- Plain attacks

  private startSwing(e: Actor): void {
    const fight = this.fightOf(e)
    const boss = this.isBoss(e)
    const wind = fight.windup * (this.has(e, 'frenzied') ? 0.85 : 1)
    const act = this.newAct('swing', wind, 0, fight.recover, false, this.dmgOf(e))
    act.boss = boss
    act.track = wind * 0.5
    const r = e.radius + fight.reach + HERO_R * 0.5
    this.addShape(act, { type: 'cone', x: e.x, z: e.z, angle: e.facing, r, half: fight.half, len: 0, width: 0 })
    e.act = act
  }

  private startSpit(e: Actor): void {
    const hero = this.hero
    const fight = FOE_COMBAT.spitter
    const act = this.newAct('spit', fight.windup, 0, fight.recover, false, this.dmgOf(e))
    const angle = Math.atan2(hero.x - e.x, hero.z - e.z)
    act.dx = Math.sin(angle)
    act.dz = Math.cos(angle)
    act.track = fight.windup * 0.5
    this.addShape(act, { type: 'lane', x: e.x, z: e.z, angle, len: ENEMIES.spitter.range + 0.6, width: 0.5, r: 0, half: 0 })
    e.act = act
  }

  // ---- Abilities

  /** Each kind's one ability, if it is ready and the moment suits it. */
  private trySig(e: Actor, dist: number): boolean {
    if (e.sigCd > 0 || !this.redFree()) return false
    const hero = this.hero
    const sig = FOE_COMBAT[e.kind as Foe].sig
    const angle = Math.atan2(hero.x - e.x, hero.z - e.z)
    const dx = Math.sin(angle)
    const dz = Math.cos(angle)
    const dmg = this.dmgOf(e)
    let act: EnemyAct | null = null
    if (sig === 'lunge') {
      if (dist < SIG.lunge.min || dist > SIG.lunge.max) return false
      // Only from the flank or behind: hounds give ground when faced.
      const fx = Math.sin(hero.facing)
      const fz = -Math.cos(hero.facing)
      if (((e.x - hero.x) * fx + (e.z - hero.z) * fz) / (dist || 1) > 0.25) return false
      act = this.newAct('dash', SIG.lunge.windup, SIG.lunge.time, 0.45, true, dmg * SIG.lunge.dmg)
      act.len = SIG.lunge.len
      act.width = SIG.lunge.width
      this.addShape(act, { type: 'lane', x: e.x, z: e.z, angle, len: act.len, width: act.width, r: 0, half: 0 })
      e.sigCd = SIG.lunge.cd
    } else if (sig === 'retch') {
      if (dist > SIG.retch.range || dist < 0.8) return false
      act = this.newAct('retch', SIG.retch.windup, 0, 0.6, true, dmg * SIG.retch.dmg)
      e.facing = angle
      this.addShape(act, { type: 'cone', x: e.x, z: e.z, angle, r: SIG.retch.range, half: SIG.retch.half, len: 0, width: 0 })
      e.sigCd = SIG.retch.cd
    } else if (sig === 'pounce') {
      if (dist < SIG.pounce.min || dist > SIG.pounce.max) return false
      const at = this.heroLead(0.35)
      if (!this.canOccupy(at.x, at.z, e.radius)) return false
      act = this.newAct('leap', SIG.pounce.windup, SIG.pounce.air, SIG.pounce.winded, true, dmg * SIG.pounce.dmg)
      act.x = at.x
      act.z = at.z
      act.r = SIG.pounce.r
      this.addShape(act, { type: 'circle', x: at.x, z: at.z, r: act.r, angle: 0, len: 0, width: 0, half: 0 })
      e.sigCd = SIG.pounce.cd
    } else if (sig === 'lob') {
      if (dist < 2.4 || dist > 9.5) return false
      act = this.newAct('cast', 0.32, 0, 0.35, false, 0)
      const at = this.heroLead(SIG.lob.lead)
      this.addBlast(e, [{ type: 'circle', x: at.x, z: at.z, r: SIG.lob.r, angle: 0, len: 0, width: 0, half: 0 }], SIG.lob.windup, dmg * SIG.lob.dmg, false, SIG.lob.pool)
      e.sigCd = SIG.lob.cd
    } else if (sig === 'charge') {
      if (dist < SIG.charge.min || dist > SIG.charge.max) return false
      act = this.newAct('dash', SIG.charge.windup, SIG.charge.len / SIG.charge.speed, SIG.charge.dazed, true, dmg * SIG.charge.dmg)
      act.len = SIG.charge.len
      act.width = SIG.charge.width
      this.addShape(act, { type: 'lane', x: e.x, z: e.z, angle, len: act.len, width: act.width, r: 0, half: 0 })
      e.sigCd = SIG.charge.cd
    }
    if (!act) return false
    act.dx = dx
    act.dz = dz
    act.ox = e.x
    act.oz = e.z
    e.setT = 0
    if (act.red || act.move === 'cast') this.claimRed()
    e.act = act
    return true
  }

  /** Shadowed elites blink behind the hero, marked where they will land. */
  private tryShadow(e: Actor, dist: number): boolean {
    if (!this.has(e, 'shadowed') || e.blinkCd > 0 || dist < 2.2 || !this.redFree()) return false
    const hero = this.hero
    const fx = Math.sin(hero.facing)
    const fz = -Math.cos(hero.facing)
    const at = this.clampArena(hero.x - fx * 1.3, hero.z - fz * 1.3)
    if (!this.canOccupy(at.x, at.z, e.radius)) return false
    const act = this.newAct('blink', AFFIX.shadowed.windup, 0, 0, false, 0)
    act.x = at.x
    act.z = at.z
    this.addShape(act, { type: 'circle', x: at.x, z: at.z, r: 0.7, angle: 0, len: 0, width: 0, half: 0 })
    e.blinkCd = AFFIX.shadowed.cd
    e.act = act
    return true
  }

  /** Advances whatever the enemy is doing: wind-up, the move itself, then the rest after it. */
  private updateAct(e: Actor, dt: number): void {
    const act = e.act!
    const hero = this.hero
    act.t += dt
    e.moving = 0
    if (act.stage === 'wind') {
      const k = act.t / Math.max(0.01, act.wind)
      if (act.track > 0 && act.t < act.track) {
        // Plain attacks follow the hero for the first half, then commit.
        this.turnTowardPoint(e, hero.x, hero.z, dt, this.fightOf(e).turn * 1.4)
        const s = act.shapes[0]
        if (s) {
          s.angle = act.move === 'spit' ? Math.atan2(hero.x - e.x, hero.z - e.z) : e.facing
          this.teles.move(s.tele, e.x, e.z, s.angle)
          act.dx = Math.sin(s.angle)
          act.dz = Math.cos(s.angle)
        }
      } else if (act.move === 'dash' || act.move === 'retch' || act.move === 'leap') {
        this.turnTowardAngle(e, Math.atan2(act.dx, act.dz), dt, 10)
      }
      for (const s of act.shapes) this.teles.progress(s.tele, k)
      if (act.t < act.wind) return
      act.t = 0
      this.fireAct(e)
      return
    }
    if (act.stage === 'go') {
      this.updateGo(e, dt)
      return
    }
    if (act.t >= act.rest) this.endAct(e)
  }

  /** The wind-up is over: the move happens. */
  private fireAct(e: Actor): void {
    const act = e.act!
    const hero = this.hero
    switch (act.move) {
      case 'swing': {
        e.swingT = 0.22
        e.swingDur = 0.22
        if (this.landShapes(e, act.shapes, act.dmg, act.boss) && act.boss) this.shake = Math.max(this.shake, 0.25)
        e.tokenSwings++
        e.atkCd = this.cdOf(e)
        break
      }
      case 'spit': {
        this.shootBolt(e, act.dmg, act.dx, act.dz, false, 0xd56bff)
        e.atkCd = this.cdOf(e)
        e.swingT = 0.2
        e.swingDur = 0.2
        break
      }
      case 'retch': {
        this.landShapes(e, act.shapes, act.dmg, false)
        const mid = this.clampArena(e.x + act.dx * SIG.retch.range * 0.55, e.z + act.dz * SIG.retch.range * 0.55)
        this.addPool(e, mid.x, mid.z, SIG.retch.pool, false)
        this.burst(e.x + act.dx, 1.1, e.z + act.dz, 0x9cff3a, 14, 3.2, 0.45)
        break
      }
      case 'blink': {
        this.burst(e.x, 0.9, e.z, 0x8a4aff, 12, 2.4, 0.4)
        e.x = act.x
        e.z = act.z
        e.facing = Math.atan2(hero.x - e.x, hero.z - e.z)
        this.burst(e.x, 0.9, e.z, 0x8a4aff, 12, 2.4, 0.4)
        this.cancelAct(e)
        if (this.isBoss(e)) return
        this.startSwing(e)
        return
      }
      case 'bossblink': {
        this.burst(e.x, 0.9, e.z, 0xff2a6a, 14, 2.6, 0.45)
        e.x = act.x
        e.z = act.z
        e.facing = Math.atan2(hero.x - e.x, hero.z - e.z)
        this.landShapes(e, act.shapes, act.dmg, true)
        this.burst(e.x, 0.5, e.z, 0xff2a6a, 18, 3.4, 0.5)
        this.shake = Math.max(this.shake, 0.35)
        break
      }
      case 'cast': {
        if (act.shapes.length) {
          this.landShapes(e, act.shapes, act.dmg, act.boss)
          for (const s of act.shapes) {
            if (s.type === 'circle') this.burst(s.x, 0.3, s.z, 0xff4428, 10, 3, 0.4)
            else this.burst(s.x + Math.sin(s.angle) * s.len * 0.5, 0.4, s.z + Math.cos(s.angle) * s.len * 0.5, 0xff4428, 12, 3.6, 0.45)
          }
          this.shake = Math.max(this.shake, act.boss ? 0.4 : 0.2)
        }
        if (act.n > 1) {
          // The enraged pound comes again, on wherever the hero is now.
          act.n--
          for (const s of act.shapes) this.teles.release(s.tele)
          act.shapes = []
          act.t = 0
          act.wind = BOSS_PHASE.pound.windup * 0.7
          const at = this.heroLead(0.2)
          this.addShape(act, { type: 'circle', x: at.x, z: at.z, r: BOSS_PHASE.pound.r, angle: 0, len: 0, width: 0, half: 0 })
          return
        }
        break
      }
      case 'fan': {
        const base = Math.atan2(act.dx, act.dz)
        const n = BOSS_SIGS.fan.n
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * BOSS_SIGS.fan.spread
          this.shootBolt(e, act.dmg, Math.sin(a), Math.cos(a), true, 0xff3a4a, BOSS_SIGS.fan.speed)
        }
        break
      }
      case 'dash':
      case 'leap': {
        act.stage = 'go'
        act.t = 0
        act.ox = e.x
        act.oz = e.z
        for (const s of act.shapes) this.teles.progress(s.tele, 1)
        return
      }
    }
    for (const s of act.shapes) this.teles.release(s.tele)
    act.shapes = []
    act.stage = 'rest'
    act.t = 0
  }

  /** The moving part of a lunge, a charge, or a leap. */
  private updateGo(e: Actor, dt: number): void {
    const act = e.act!
    const hero = this.hero
    const k = Math.min(1, act.t / Math.max(0.01, act.go))
    if (act.move === 'dash') {
      const speed = act.len / Math.max(0.01, act.go)
      const x0 = e.x
      const z0 = e.z
      this.moveActor(e, act.dx * speed * dt, act.dz * speed * dt)
      e.moving = 1
      if (!act.hit && !hero.dead && Math.hypot(hero.x - e.x, hero.z - e.z) < e.radius + HERO_R + 0.35) {
        act.hit = true
        this.damageHero(act.dmg, act.boss, e)
      }
      const stuck = Math.hypot(e.x - x0, e.z - z0) < speed * dt * 0.25
      if (k >= 1 || stuck) this.goDone(e)
      return
    }
    // A leap: an arc from where it stood to the ring.
    const x = act.ox + (act.x - act.ox) * k
    const z = act.oz + (act.z - act.oz) * k
    if (this.canOccupy(x, z, e.radius * 0.5)) {
      e.x = x
      e.z = z
    }
    e.lift = Math.sin(k * Math.PI) * (act.boss ? 1.6 : 1.2)
    if (k < 1) return
    e.lift = 0
    this.landShapes(e, act.shapes, act.dmg, act.boss)
    this.burst(act.x, 0.3, act.z, 0xff4428, 14, 3.2, 0.45)
    this.shake = Math.max(this.shake, act.boss ? 0.4 : 0.22)
    this.goDone(e)
  }

  private goDone(e: Actor): void {
    const act = e.act!
    for (const s of act.shapes) this.teles.release(s.tele)
    act.shapes = []
    act.stage = 'rest'
    act.t = 0
    e.lift = 0
    // Charges and pounces leave the brute open: dazed, it staggers twice as fast.
    if (act.rest >= 0.9) e.dazeT = act.rest
  }

  // ---- Lingering ground and delayed blasts

  private addBlast(src: Actor | null, shapes: Omit<Shape, 'tele'>[], wind: number, dmg: number, boss: boolean, pool?: PoolSpec): void {
    const blast: Blast = { shapes: [], t: 0, wind, dmg, boss, red: true, src, pool: pool ?? null, glob: null, ox: src?.x ?? 0, oz: src?.z ?? 0 }
    for (const s of shapes) {
      const tele = s.type === 'circle' ? this.teles.circle(s.x, s.z, s.r, 'red') : this.teles.lane(s.x, s.z, s.angle, s.len, s.width, 'red')
      blast.shapes.push({ ...s, tele })
    }
    if (src && src.kind === 'spitter') {
      const glob = new THREE.Mesh(this.globGeo, this.globMat)
      glob.position.set(src.x, 1.2, src.z)
      this.scene.add(glob)
      blast.glob = glob
    }
    this.blasts.push(blast)
  }

  private addPool(src: Actor | null, x: number, z: number, spec: PoolSpec, boss: boolean): void {
    const tele = this.teles.circle(x, z, spec.r, 'pool')
    this.teles.progress(tele, 1)
    this.pools.push({ x, z, r: spec.r, life: spec.time, max: spec.time, tick: 0.25, every: spec.tick, dmg: (src ? this.dmgOf(src) : 6) * spec.dmg, boss, tele, src })
  }

  private updateHazards(dt: number): void {
    const hero = this.hero
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i]
      b.t += dt
      const k = Math.min(1, b.t / b.wind)
      for (const s of b.shapes) this.teles.progress(s.tele, k)
      if (b.glob) {
        const s = b.shapes[0]
        b.glob.position.set(b.ox + (s.x - b.ox) * k, 1.2 + Math.sin(k * Math.PI) * 2.6 - k * 1.1, b.oz + (s.z - b.oz) * k)
      }
      if (b.t < b.wind) continue
      this.landShapes(b.src && !b.src.dead ? b.src : null, b.shapes, b.dmg, b.boss)
      for (const s of b.shapes) {
        this.burst(s.x, 0.3, s.z, b.pool ? 0x9cff3a : 0xff4428, 12, 3.2, 0.45)
        this.teles.release(s.tele)
        if (b.pool) this.addPool(b.src, s.x, s.z, b.pool, b.boss)
      }
      if (b.glob) this.scene.remove(b.glob)
      this.blasts.splice(i, 1)
    }
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const p = this.pools[i]
      p.life -= dt
      p.tick -= dt
      this.teles.fade(p.tele, Math.min(1, p.life / 0.6))
      if (p.tick <= 0) {
        p.tick = p.every
        if (!hero.dead && Math.hypot(hero.x - p.x, hero.z - p.z) < p.r + HERO_R * 0.4) this.damageHero(p.dmg, p.boss, null)
      }
      if (p.life <= 0) {
        this.teles.release(p.tele)
        this.pools.splice(i, 1)
      }
    }
  }

  private clearHazards(): void {
    for (const b of this.blasts) if (b.glob) this.scene.remove(b.glob)
    this.blasts = []
    this.pools = []
    this.teles.clear()
    this.sigGap = 0
  }

  // ---- Poise and stagger

  private tickPoise(e: Actor, dt: number): void {
    if (e.poise <= 0) return
    e.poiseQuiet += dt
    if (e.poiseQuiet > STAGGER.quiet && e.stunT <= 0) e.poise = Math.max(0, e.poise - STAGGER.regen * dt)
  }

  /** Poise damage from a hit: a share of max HP against what this enemy can take, times the weapon or skill's poise. */
  private addPoise(e: Actor, amount: number, mult: number): void {
    if (e.dead || e.stunT > 0 || e.pile > 0 || e.ward > 0 || mult <= 0) return
    const fight = this.fightOf(e)
    let need = fight.poise
    if (this.isBoss(e)) need *= 1 + BOSS_COMBAT.poiseGrowth * e.breaks
    if (this.has(e, 'ironhide')) need *= AFFIX.ironhide.poise
    // Range dummies never fall, so they stagger against a nominal body instead of their bottomless HP.
    const body = e.dummy ? DUMMY_POISE_HP : e.maxHp
    const gain = (amount / Math.max(1, body) / need) * mult * (e.dazeT > 0 ? STAGGER.dazed : 1)
    e.poise = Math.min(1, e.poise + gain)
    e.poiseQuiet = 0
    if (e.poise < 1) return
    // Red abilities cannot be broken mid-move; the stagger waits for it to finish.
    if (e.act?.red && e.act.stage !== 'rest') return
    this.stagger(e)
  }

  private stagger(e: Actor): void {
    e.poise = 0
    e.breaks++
    e.stunT = this.isBoss(e) ? BOSS_COMBAT.stun : STAGGER.stun
    e.dazeT = 0
    this.cancelAct(e)
    e.moving = 0
    this.floatAt(e.x, e.barY + 0.85, e.z, 'STAGGER', 'stagger')
    this.burst(e.x, e.barY * 0.8, e.z, 0xffd04a, 14, 2.8, 0.45)
    this.hitStop = Math.max(this.hitStop, 0.09)
    this.shake = Math.max(this.shake, 0.3)
    this.sfx.play('hit')
    if (!e.halo) {
      const halo = new THREE.Mesh(this.haloGeo, this.haloMat)
      halo.rotation.x = -Math.PI / 2
      e.rig.root.add(halo)
      e.halo = halo
    }
    e.halo.position.y = (e.barY - 0.5) / Math.max(0.01, e.rig.root.scale.y)
    e.halo.visible = true
  }

  private endStun(e: Actor): void {
    e.stunT = 0
    e.poise = 0
    e.atkCd = Math.max(e.atkCd, 0.35)
    if (e.halo) e.halo.visible = false
  }

  /** A skeleton's bone pile: strike it to finish it, or it stands again. */
  private updatePile(e: Actor, dt: number): void {
    e.pile -= dt
    e.moving = 0
    if (e.pileTele) this.teles.progress(e.pileTele, 1 - e.pile / SIG.rise.pile)
    if (e.pile > 0) {
      this.placeActor(e)
      e.rig.bob.scale.set(1.15, 0.32, 1.15)
      e.rig.bob.position.y = -0.2
      return
    }
    this.teles.release(e.pileTele)
    e.pileTele = null
    e.pile = 0
    e.risen = true
    e.hp = Math.max(1, e.maxHp * SIG.rise.hp)
    e.barLag = e.hp / e.maxHp
    e.rig.bob.scale.setScalar(1)
    e.rig.bob.position.y = 0
    e.atkCd = 0.6
    this.floatAt(e.x, e.barY + 0.6, e.z, 'RISES', 'stagger')
    this.burst(e.x, 0.6, e.z, 0xf4f0e4, 12, 2.4, 0.45)
    this.placeActor(e)
  }

  // ---- Bosses

  private bossThink(e: Actor, dist: number, dt: number): void {
    const hero = this.hero
    this.turnTowardPoint(e, hero.x, hero.z, dt, BOSS_COMBAT.turn)
    const rage = e.phase >= 2
    e.poundCd -= dt
    // The boss keeps its own clock: its moves never wait on the minions' turn at a red ability.
    if (e.poundCd <= 0 && !this.bossRed()) {
      e.poundCd = BOSS_PHASE.pound.cd * (rage ? BOSS_PHASE.rageCd : 1)
      const act = this.newAct('cast', BOSS_PHASE.pound.windup, 0, 0.45, true, this.rivalBlueprint().pound)
      act.boss = true
      act.n = rage ? 3 : 1
      this.addShape(act, { type: 'circle', x: e.x, z: e.z, r: BOSS_PHASE.pound.r, angle: 0, len: 0, width: 0, half: 0 })
      this.claimRed()
      e.act = act
      return
    }
    if (e.phase >= 1 && e.sigCd <= 0 && !this.bossRed() && this.startBossSig(e, dist)) {
      e.sigCd = BOSS_PHASE.sigCd * (rage ? BOSS_PHASE.rageCd : 1)
      this.claimRed()
      return
    }
    const reach = e.radius + BOSS_COMBAT.reach + HERO_R
    if (dist > reach * 0.82) this.stepToward(e, hero.x, hero.z, this.speedOf(e), dt)
    else {
      e.moving = 0.15
      if (e.atkCd <= 0) this.startSwing(e)
    }
  }

  /** At 60% the boss calls help and starts its own move; at 30% it rages. */
  private bossPhase(e: Actor): void {
    const map = MAPS[this.district]
    if (e.phase < 1 && e.hp < e.maxHp * BOSS_PHASE.turn) {
      e.phase = 1
      e.sigCd = 1.2
      if (this.district === 'slums') {
        for (const mark of LITTER) {
          const spot = this.litterSpot(mark.x, mark.z)
          if (spot) this.spawnEnemy('hound', spot.x, spot.z, { returns: false })
        }
        this.hud.toast(`The king calls his litter, and ${BOSS_SIG_LABEL[BOSS_SIG.slums]}`)
      } else {
        // Everyone else calls two of the zone's own to his side.
        const pods = this.zonePods()
        const kinds = pods[0]?.mixes[0]?.kinds ?? (['thug'] as Foe[])
        for (const [i, side] of [-1, 1].entries()) {
          const spot = this.clampArena(e.x + side * 1.1, e.z + 0.5)
          if (this.clearSpawn(spot.x, spot.z, 0.5)) this.spawnEnemy(kinds[i % kinds.length], spot.x, spot.z)
        }
        this.hud.toast(`${map.boss.name} calls for help, and ${BOSS_SIG_LABEL[BOSS_SIG[this.district]]}`)
      }
    }
    if (e.phase < 2 && e.hp < e.maxHp * BOSS_PHASE.rage) {
      e.phase = 2
      this.hud.toast(`${map.boss.name} is enraged`)
      this.burst(e.x, 1.4, e.z, 0xff2238, 26, 4, 0.6)
      this.shake = Math.max(this.shake, 0.5)
      this.sfx.play('boss')
    }
  }

  /** Each map's boss has one move of its own, built from the same marks as the rest. */
  private startBossSig(e: Actor, dist: number): boolean {
    const hero = this.hero
    const sig = BOSS_SIG[this.district]
    const sheet = this.rivalBlueprint()
    const angle = Math.atan2(hero.x - e.x, hero.z - e.z)
    const dx = Math.sin(angle)
    const dz = Math.cos(angle)
    const lane = (len: number, width: number, a = angle, x = e.x, z = e.z) => ({ type: 'lane' as const, x, z, angle: a, len, width, r: 0, half: 0 })
    const ring = (x: number, z: number, r: number) => ({ type: 'circle' as const, x, z, r, angle: 0, len: 0, width: 0, half: 0 })
    let act: EnemyAct
    if (sig === 'lunge' || sig === 'charge') {
      const spec = sig === 'lunge' ? BOSS_SIGS.lunge : BOSS_SIGS.charge
      const go = sig === 'lunge' ? BOSS_SIGS.lunge.time : BOSS_SIGS.charge.len / BOSS_SIGS.charge.speed
      act = this.newAct('dash', spec.windup, go, sig === 'charge' ? 1 : 0.5, true, sheet.dmg * spec.dmg)
      act.len = spec.len
      act.width = spec.width
      this.addShape(act, lane(spec.len, spec.width))
    } else if (sig === 'pounce') {
      if (dist < 2.2) return false
      const at = this.heroLead(0.4)
      act = this.newAct('leap', BOSS_SIGS.pounce.windup, BOSS_SIGS.pounce.air, 0.6, true, sheet.dmg * BOSS_SIGS.pounce.dmg)
      act.x = at.x
      act.z = at.z
      this.addShape(act, ring(at.x, at.z, BOSS_SIGS.pounce.r))
    } else if (sig === 'blink') {
      const fx = Math.sin(hero.facing)
      const fz = -Math.cos(hero.facing)
      const at = this.clampArena(hero.x - fx * BOSS_SIGS.blink.back, hero.z - fz * BOSS_SIGS.blink.back)
      act = this.newAct('bossblink', BOSS_SIGS.blink.windup, 0, 0.5, true, sheet.dmg * BOSS_SIGS.blink.dmg)
      act.x = at.x
      act.z = at.z
      this.addShape(act, ring(at.x, at.z, BOSS_SIGS.blink.r))
    } else if (sig === 'fan') {
      act = this.newAct('fan', BOSS_SIGS.fan.windup, 0, 0.45, true, sheet.dmg * BOSS_SIGS.fan.dmg)
      const n = BOSS_SIGS.fan.n
      for (let i = 0; i < n; i++) this.addShape(act, lane(BOSS_SIGS.fan.len, BOSS_SIGS.fan.width, angle + (i - (n - 1) / 2) * BOSS_SIGS.fan.spread))
    } else {
      act = this.newAct('cast', 0.4, 0, 0.5, true, 0)
      if (sig === 'lob') {
        const at = this.heroLead(BOSS_SIGS.lob.lead)
        const shapes = [ring(at.x, at.z, BOSS_SIGS.lob.r)]
        for (let i = 1; i < BOSS_SIGS.lob.n; i++) {
          const a = Math.random() * Math.PI * 2
          const p = this.clampArena(at.x + Math.sin(a) * BOSS_SIGS.lob.spread, at.z + Math.cos(a) * BOSS_SIGS.lob.spread)
          shapes.push(ring(p.x, p.z, BOSS_SIGS.lob.r))
        }
        this.addBlast(e, shapes, BOSS_SIGS.lob.windup, sheet.dmg * BOSS_SIGS.lob.dmg, true)
      } else if (sig === 'graves') {
        const shapes = [ring(hero.x, hero.z, BOSS_SIGS.graves.r)]
        const a0 = Math.random() * Math.PI * 2
        for (let i = 1; i < BOSS_SIGS.graves.n; i++) {
          const a = a0 + (i / (BOSS_SIGS.graves.n - 1)) * Math.PI * 2
          const p = this.clampArena(hero.x + Math.sin(a) * BOSS_SIGS.graves.ring, hero.z + Math.cos(a) * BOSS_SIGS.graves.ring)
          shapes.push(ring(p.x, p.z, BOSS_SIGS.graves.r))
        }
        this.addBlast(e, shapes, BOSS_SIGS.graves.windup, sheet.dmg * BOSS_SIGS.graves.dmg, true)
      } else if (sig === 'beams') {
        // Bars of dawn across the hero's ground, side to side of the boss's line.
        const across = angle + Math.PI / 2
        const ax = Math.sin(across)
        const az = Math.cos(across)
        const shapes = []
        for (let i = 0; i < BOSS_SIGS.beams.n; i++) {
          const off = (i - (BOSS_SIGS.beams.n - 1) / 2) * BOSS_SIGS.beams.gap
          const cx = hero.x + dx * off - ax * BOSS_SIGS.beams.len * 0.5
          const cz = hero.z + dz * off - az * BOSS_SIGS.beams.len * 0.5
          shapes.push(lane(BOSS_SIGS.beams.len, BOSS_SIGS.beams.width, across, cx, cz))
        }
        this.addBlast(e, shapes, BOSS_SIGS.beams.windup, sheet.dmg * BOSS_SIGS.beams.dmg, true)
      } else if (sig === 'slam') {
        this.addBlast(e, [lane(BOSS_SIGS.slam.len, BOSS_SIGS.slam.width)], BOSS_SIGS.slam.windup, sheet.dmg * BOSS_SIGS.slam.dmg, true)
      } else {
        this.addBlast(e, [ring(e.x, e.z, BOSS_SIGS.nova.r)], BOSS_SIGS.nova.windup, sheet.dmg * BOSS_SIGS.nova.dmg, true)
      }
    }
    act.boss = true
    act.dx = dx
    act.dz = dz
    act.ox = e.x
    act.oz = e.z
    e.act = act
    return true
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
      const dmg = skillDamage('bats', prof, this.save.powers.bats)
      for (const e of this.enemies) {
        if (e.dead) continue
        if (Math.hypot(e.x - this.hero.x, e.z - this.hero.z) < this.batR + e.radius) this.damageEnemy(e, dmg, false, SKILL_POISE.bats)
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
      const dmg = skillDamage('nova', prof, this.save.powers.nova)
      for (const e of this.enemies) {
        if (e.dead) continue
        if (Math.hypot(e.x - this.hero.x, e.z - this.hero.z) < 4.3 + e.radius) this.damageEnemy(e, dmg, false, SKILL_POISE.nova)
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
        this.credit(d.kind, d.value)
        if (d.kind !== 'blood') this.floatAt(this.hero.x, this.hero.barY + 0.2, this.hero.z, `+${Math.round(d.value)} ${d.kind === 'ichor' ? 'Ichor' : 'Vitae'}`, d.kind)
        this.sfx.play('pickup')
        d.mesh.visible = false
        this.dropPool.push(d.mesh)
        this.drops.splice(i, 1)
      }
    }
  }

  private updateBolts(dt: number): void {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]
      b.life -= dt
      b.x += b.vx * dt
      b.z += b.vz * dt
      b.mesh.position.set(b.x, b.y, b.z)
      const dist = Math.hypot(this.hero.x - b.x, this.hero.z - b.z)
      if (dist < 0.5 && !this.hero.dead && this.iframe <= 0) {
        this.damageHero(b.dmg, b.boss, b.src)
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
      if (!ready || this.paused() || this.hero.dead || !this.hunting()) {
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
    } else if (this.debugCam === 'map' && this.inHaven()) {
      desired.set(HAVEN.x + 9, 24, HAVEN.z + 11)
      lookTarget.set(HAVEN.x, 0, HAVEN.z)
      this.world.fog.near = 60
      this.world.fog.far = 90
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
        this.enemies.find((e) => !e.dead && e.kind === 'hound') ??
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
      // Its length fits the screen (narrow phones pull back) times the player's own zoom.
      const s = this.camScale()
      desired.set(hero.x + 6.6 * s, 10.8 * s, hero.z + 6.6 * s)
      lookTarget.set(hero.x, 0.52, hero.z)
      this.world.fog.near = 40 + Math.max(0, s - 1) * 14.3
      this.world.fog.far = 52 + Math.max(0, s - 1) * 18
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
    // The shadow box widens with the view, so a pulled-back camera does not see its edge.
    const reach = 7 * Math.max(1, this.camScale())
    const sc = key.shadow.camera
    if (Math.abs(sc.right - reach) > 0.05) {
      sc.left = -reach
      sc.right = reach
      sc.top = reach
      sc.bottom = -reach
      sc.updateProjectionMatrix()
    }
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
        if (e.tag) e.tag.style.display = 'none'
        continue
      }
      if (e.tag) {
        const near = Math.hypot(e.x - this.hero.x, e.z - this.hero.z) < 11
        const tp = this.project(e.x, e.barY + 0.34, e.z)
        this.hud.place(e.tag, tp.x, tp.y, tp.vis && near && !e.dead && this.mode === 'play')
      }
      const ratio = e.maxHp > 0 ? Math.max(0, e.hp / e.maxHp) : 0
      const gap = e.barLag - ratio
      if (gap > 0.001) e.barLag = Math.max(ratio, e.barLag - dt * (0.28 + gap * 0.9))
      else e.barLag = ratio
      e.barT = Math.max(0, e.barT - dt)
      e.barFlash = Math.max(0, e.barFlash - dt)
      const show = flop || (ratio < 0.995 && e.barT > 0) || e.stunT > 0 || e.pile > 0
      const fade = !flop && e.barT < 0.45 ? Math.max(0, e.barT / 0.45) : 1
      const lag = e.bar.querySelector('.lag') as HTMLElement | null
      const fill = e.bar.querySelector('.fill') as HTMLElement | null
      const hp = e.bar.querySelector('.hp') as HTMLElement | null
      if (lag) lag.style.width = `${Math.max(0, Math.min(1, e.barLag)) * 100}%`
      if (fill) fill.style.width = `${ratio * 100}%`
      if (hp) hp.textContent = String(Math.max(0, Math.round(e.hp)))
      const poise = e.bar.querySelector('.poise') as HTMLElement | null
      if (poise) poise.style.width = `${(e.stunT > 0 || e.pile > 0 ? 1 : e.poise) * 100}%`
      e.bar.classList.toggle('flash', e.barFlash > 0)
      e.bar.classList.toggle('stunned', e.stunT > 0)
      e.bar.classList.toggle('warded', e.ward > 0)
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
      if (!this.hunting()) {
        text = 'Opens at nightfall'
      } else if (!ready) {
        const left = Math.max(0, ((node.group.userData.readyAt as number) - now) / 1000)
        text = `${Math.ceil(left)}s`
      } else if (channel > 0) {
        prog = channel / 0.55
        text = 'Feeding'
      }
      this.hud.setNodeTag(id, p.x, p.y, text, p.vis && !!node.group.parent, prog)
    }
  }

  /** Red abilities winding up off screen show as marks on the nearest edge. */
  private updateThreats(): void {
    const pts: { x: number; y: number; a: number }[] = []
    if (this.mode === 'play' && this.hunting() && !this.paused()) {
      const cx = this.viewW / 2
      const cy = this.viewH / 2
      const add = (x: number, z: number) => {
        const p = this.project(x, 0.3, z)
        const m = 30
        if (p.vis && p.x > m && p.x < this.viewW - m && p.y > m + 40 && p.y < this.viewH - m) return
        let dx = p.x - cx
        let dy = p.y - cy
        if (!p.vis) {
          dx = -dx
          dy = -dy
        }
        const a = Math.atan2(dy, dx)
        const k = Math.min((cx - m) / Math.max(1e-3, Math.abs(Math.cos(a))), (cy - m) / Math.max(1e-3, Math.abs(Math.sin(a))))
        pts.push({ x: cx + Math.cos(a) * k, y: cy + Math.sin(a) * k, a })
      }
      for (const e of this.enemies) {
        if (e.dead || !e.act?.red || e.act.stage !== 'wind') continue
        const s = e.act.shapes[0]
        add(s ? s.x : e.x, s ? s.z : e.z)
      }
      for (const b of this.blasts) if (b.t < b.wind && b.shapes[0]) add(b.shapes[0].x, b.shapes[0].z)
    }
    this.hud.setThreats(pts.slice(0, 4))
  }

  private updateHud(): void {
    this.updateThreats()
    this.hud.setHp(this.hero.maxHp > 0 ? this.hero.hp / this.hero.maxHp : 0)
    const night = this.night
    this.hud.setPurse(night ? night.carried : bankedPurse(this.save), !!night)
    this.hud.setInteract(this.station && this.mode === 'play' ? `${this.station.verb} · ${this.station.label}` : null)
    this.hud.setLevel(this.save.level, this.save.level >= LEVEL_CAP ? 1 : this.save.xp / xpNeed(this.save.level))
    for (const id of SKILLS) this.hud.setSkill(id, this.cooldowns[id], this.cdMax[id])
    const boss = this.localBoss()
    const rival = MAPS[this.district].boss
    this.hud.setBoss(!!boss, boss ? boss.hp / boss.maxHp : 0, rival.name.toUpperCase())
    const playing = this.mode === 'play' && !this.hud.modalOpen()
    const fell = this.save.bosses[this.district] > 0
    this.hud.setSummon(this.canSummon() && !boss && playing, fell ? `${rival.name} wants a rematch.` : rival.line, fell ? rival.again : rival.call)
    if (night && !night.over) {
      const left = night.length - night.elapsed
      this.hud.setNightHud({
        clock: night.dawn ? 'DAWN' : formatClock(left),
        warn: night.dawn || left <= DAWN_WARN,
        frenzy: this.frenzyMult(),
        frenzyFill: night.frenzy / frenzyCap(this.save.rites.frenzy),
        danger: `${night.danger + 1} · ${zoneName(night.district, night.danger)}`,
      })
      this.placeExtractMarker()
    } else {
      this.hud.setNightHud(null)
      this.hud.setExtract(0, 0, false, false, 0, '', 0, 0)
    }
    if (this.mode === 'menu') this.refreshMenu()
  }

  private cast(id: SkillId): void {
    if (this.paused() || this.hero.dead) return
    if (this.cooldowns[id] > 0) return
    this.sfx.unlock()
    const prof = profile(this.save)
    const max = SKILL_META[id].cd * prof.cdScale * powerScale(this.save.powers[id]).cd
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
        const t = this.nearest(8, false, this.inHaven())
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
    // On the range, the dummies take Blood Drain too.
    const target = this.nearest(6.4, false, this.inHaven())
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
    const dealt = this.damageEnemy(target, skillDamage('drain', prof, this.save.powers.drain), false, SKILL_POISE.drain)
    const heal = dealt * 0.55
    this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + heal)
    this.floatAt(this.hero.x, this.hero.barY * 0.74, this.hero.z, `+${Math.round(heal)}`, 'heal')
  }

  /** `poise` is the weapon's or skill's poise multiplier (combat.ts). */
  private damageEnemy(e: Actor, raw: number, crit: boolean, poise = 1): number {
    if (e.dead) return 0
    if (e.pile > 0) {
      // Any blow on a bone pile scatters it for good.
      this.teles.release(e.pileTele)
      e.pileTele = null
      e.pile = 0
      e.risen = true
      this.floatAt(e.x, e.barY * 0.6, e.z, 'SHATTERED', 'stagger')
      this.burst(e.x, 0.4, e.z, 0xf4f0e4, 16, 3, 0.45)
      this.killEnemy(e)
      return 0
    }
    const prev = e.maxHp > 0 ? e.hp / e.maxHp : 1
    e.barLag = Math.max(e.barLag, prev)
    let amount = enemyMitigate(raw, e.armor)
    if (e.stunT > 0) amount *= STAGGER.exposed
    if (this.has(e, 'ironhide')) amount *= 1 - AFFIX.ironhide.cut
    // Bulwark: the Enforcer's shield takes most of what hits his front, unless he is mid-swing or reeling.
    let blocked = false
    if (e.kind === 'enforcer' && !e.act && e.stunT <= 0 && e.dazeT <= 0) {
      const dx = this.hero.x - e.x
      const dz = this.hero.z - e.z
      const d = Math.hypot(dx, dz) || 1
      if ((dx * Math.sin(e.facing) + dz * Math.cos(e.facing)) / d > SIG.bulwark.front) {
        amount *= 1 - SIG.bulwark.cut
        blocked = true
      }
    }
    let warded = 0
    if (e.ward > 0) {
      warded = Math.min(e.ward, amount)
      e.ward -= warded
      amount -= warded
      if (e.ward <= 0.01) {
        e.ward = 0
        if (e.wardFx) e.wardFx.visible = false
        this.floatAt(e.x, e.barY + 0.8, e.z, 'WARD BREAKS', 'ward')
        this.burst(e.x, e.barY * 0.6, e.z, 0x6ad8ff, 16, 3, 0.45)
      }
    }
    e.hp -= amount
    e.barT = e.kind === 'boss' || e.kind === 'don' ? 4.5 : 3.2
    e.barFlash = 0.14
    e.hitFlash = 0.12
    this.hits++
    const shown = amount + warded
    const big = shown >= e.maxHp * 0.18
    const cls = blocked ? 'block' : warded > 0 ? 'ward' : crit ? 'crit' : e.stunT > 0 ? 'exposed' : big ? 'big' : ''
    this.floatAt(e.x, e.barY + 0.48, e.z, blocked ? `-${Math.round(shown)} BLOCKED` : `-${Math.round(shown)}`, cls)
    this.burst(e.x, e.barY * 0.55, e.z, blocked ? 0xc8d0e0 : 0xff2438, crit ? 8 : 4, 2.4, 0.35)
    this.addPoise(e, amount, poise * (blocked ? 0.25 : 1))
    if (e.dummy) {
      this.noteRangeHit(e, amount)
      return amount
    }
    const ls = amount * profile(this.save).lifesteal
    if (!this.hero.dead) this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + ls)
    if (e.hp <= 0) {
      if (e.kind === 'skeleton' && !e.risen && e.stunT <= 0) this.collapse(e)
      else this.killEnemy(e)
    }
    return amount
  }

  /** Reassemble: a skeleton struck down falls into a pile, and stands again unless the pile is struck. */
  private collapse(e: Actor): void {
    e.hp = 0
    e.pile = SIG.rise.pile
    e.token = false
    e.poise = 0
    e.dazeT = 0
    this.cancelAct(e)
    e.pileTele = this.teles.circle(e.x, e.z, 0.95, 'gold')
    this.floatAt(e.x, e.barY * 0.7, e.z, 'STRIKE THE BONES', 'stagger')
    this.burst(e.x, 0.6, e.z, 0xf4f0e4, 12, 2.2, 0.4)
  }

  /** A kill on a stunned enemy: the hero drinks. */
  private feed(e: Actor): void {
    const hero = this.hero
    if (hero.dead) return
    const heal = hero.maxHp * STAGGER.feedHeal
    hero.hp = Math.min(hero.maxHp, hero.hp + heal)
    this.floatAt(hero.x, hero.barY * 0.95, hero.z, `+${Math.round(heal)} FEED`, 'heal')
    this.burst(e.x, e.barY * 0.5, e.z, 0xff1a3a, 18, 2.6, 0.5)
    for (let i = 0; i < STAGGER.feedFrenzy; i++) this.noteFrenzy()
    this.feeds++
  }

  /** Returns whether the hit landed. `src` is who struck, for Vampiric healing. */
  private damageHero(raw: number, fromBoss: boolean, src: Actor | null = null): boolean {
    if (this.hero.dead || this.iframe > 0) return false
    const prof = profile(this.save)
    const amount = Math.max(1, mitigate(raw, prof.armor, prof.resist, fromBoss) * prof.guard)
    this.hero.hp -= amount
    this.hurtTotal += amount
    if (this.hunting()) this.night!.tally.minHp = Math.min(this.night!.tally.minHp, Math.max(0, this.hero.hp) / this.hero.maxHp)
    this.iframe = HERO_GUARD.iframe
    this.sinceHurt = 0
    this.shake = Math.max(this.shake, fromBoss ? 0.28 : 0.12)
    this.sfx.play('hurt')
    this.floatAt(this.hero.x, this.hero.barY * 0.8, this.hero.z, `-${Math.round(amount)}`, 'hurt')
    if (src && !src.dead && this.has(src, 'vampiric')) {
      const heal = amount * AFFIX.vampiric.heal
      src.hp = Math.min(src.maxHp, src.hp + heal)
      this.floatAt(src.x, src.barY + 0.5, src.z, `+${Math.round(heal)}`, 'heal')
    }
    if (this.hero.hp <= 0) {
      this.hero.hp = 0
      this.hero.dead = true
      this.hero.deathT = 1.5
      this.hud.toast('You dissolve into mist')
    }
    return true
  }

  private killEnemy(e: Actor): void {
    const fed = e.stunT > 0 && !e.dummy
    e.dead = true
    e.deathT = 0
    e.hp = 0
    e.respawn = 0
    e.stunT = 0
    e.token = false
    this.cancelAct(e)
    this.teles.release(e.pileTele)
    e.pileTele = null
    if (e.halo) e.halo.visible = false
    if (e.wardFx) e.wardFx.visible = false
    if (e.tag) e.tag.style.display = 'none'
    this.sfx.play('kill')
    this.noteFrenzy()
    if (fed) this.feed(e)
    if (this.has(e, 'volatile')) {
      this.addBlast(null, [{ type: 'circle', x: e.x, z: e.z, r: AFFIX.volatile.r, angle: 0, len: 0, width: 0, half: 0 }], AFFIX.volatile.windup, e.dmg * AFFIX.volatile.dmg, false)
    }
    if (e.kind === 'boss' || e.kind === 'don') {
      const don = e.kind === 'don'
      const map = MAPS[this.district]
      const bp = this.rivalBlueprint()
      const blood = Math.round(bp.blood * profile(this.save).bloodMult * this.nightPay() * this.frenzyMult())
      const loot = bossLoot(map.boss.sheet, this.tier())
      this.save.bosses[this.district] += 1
      if (don) this.don = null
      else this.boss = null
      this.summonCd = 75
      this.donCd = 75
      if (this.district === 'slums') {
        this.world.gateGlow.emissiveIntensity = 1.7
        this.world.gateGlow.color.setHex(0xff4ad8)
      }
      this.save.kills += 1
      if (this.night) {
        this.night.kills += 1
        this.night.tally.king = true
        this.checkMarks()
      }
      this.rankWeapon(5)
      for (const s of STATS) this.save.stacks[s] += 2
      const levels = grantXp(this.save, bp.xp)
      const falls = this.save.bosses[this.district]
      this.hud.banner(`${map.boss.name.toUpperCase()} FALLS`)
      this.hud.toast(falls === 1 ? `${map.label} remembers your name` : `${map.boss.name} falls again (${falls})`)
      this.floatAt(e.x, 2.2, e.z, `+${blood} Blood`, 'blood')
      this.floatAt(e.x, 1.7, e.z, '+2 all', 'all')
      this.spawnDrops(e.x, e.z, blood)
      this.spawnDrops(e.x, e.z, loot.ichor, 'ichor')
      this.spawnDrops(e.x, e.z, loot.vitae, 'vitae')
      for (const [mat, n] of Object.entries(BOSS_MATERIALS[map.boss.sheet === 'don' ? 'don' : 'boss']) as [Material, number][]) {
        this.spawnDrops(e.x, e.z, matDrop(n, this.district, this.night?.danger ?? 0), mat)
      }
      if (levels) this.onLevel(levels)
      this.noteKill()
      this.persist()
      return
    }
    if (e.kind === 'hero') return
    const def = ENEMIES[e.kind]
    const xp = e.rewardXp || def.xp
    const blood = Math.round((e.rewardBlood || def.blood) * profile(this.save).bloodMult * this.nightPay() * this.frenzyMult())
    this.save.kills += 1
    if (this.night) {
      const t = this.night.tally
      this.night.kills += 1
      t.kills += 1
      if (e.elite) t.elites += 1
      if (this.night.elapsed < SWIFT_SECONDS) t.early += 1
      this.checkMarks()
    }
    this.rankWeapon(1)
    if (e.kind === 'thug' || e.kind === 'enforcer') this.save.mobKills += 1
    this.save.stacks[def.stat] += 1
    const levels = grantXp(this.save, xp)
    this.floatAt(e.x, e.barY, e.z, `+1 ${def.statLabel}`, def.stat === 'strength' ? 'str' : def.stat === 'agility' ? 'agi' : def.stat === 'vitality' ? 'vit' : 'sor')
    this.floatAt(e.x, 0.4, e.z, `+${blood}`, 'blood')
    this.spawnDrops(e.x, e.z, blood)
    if (Math.random() < def.drop.chance || e.elite) {
      const n = matDrop(def.drop.amount * (e.elite ? 2 : 1), this.district, this.night?.danger ?? 0)
      if (n > 0) {
        this.spawnDrops(e.x, e.z, n, def.drop.mat)
        this.floatAt(e.x, e.barY + 0.2, e.z, `+${n} ${MATERIAL_LABEL[def.drop.mat]}`, def.drop.mat)
      }
    }
    if (e.elite) {
      const ichor = eliteIchor(this.tier())
      this.spawnDrops(e.x, e.z, ichor, 'ichor')
      this.floatAt(e.x, e.barY + 0.4, e.z, `+${ichor} Ichor`, 'ichor')
    }
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
    const pts = gained * POINTS_PER_LEVEL
    if (gained > 0) this.hud.toast(`Level ${this.save.level}. The night leans in. +${pts} attribute point${pts > 1 ? 's' : ''}.`)
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

  private spawnDrops(x: number, z: number, amount: number, kind: Currency = 'blood'): void {
    if (amount <= 0) return
    const n = Math.max(1, Math.min(8, Math.ceil(amount)))
    const each = amount / n
    for (let i = 0; i < n; i++) this.drops.push(this.makeDrop(x, z, each, kind))
  }

  private makeDrop(x: number, z: number, value: number, kind: Currency): Drop {
    let mesh = this.dropPool.pop()
    if (!mesh) {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), this.bloodMat)
      this.scene.add(mesh)
    }
    mesh.material = this.dropMats[kind]
    mesh.scale.setScalar(kind === 'blood' ? 1 : 1.5)
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
      kind,
    }
  }

  private harvest(id: 'crypt' | 'fountain'): void {
    if (!this.hunting()) return
    const node = this.world.nodes[id]
    const spec = NODE[id]
    this.credit('blood', spec.blood)
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

  /** True while a night runs: not at the Haven, and not on the end-of-night summary. */
  private hunting(): boolean {
    return !!this.night && !this.night.over
  }

  /** Enemy growth steps right now, from the night's district, danger, and clock. The Haven's targets sit at zero. */
  private steps(): number {
    const night = this.night
    return night ? nightSteps(night.district, night.danger, night.elapsed) : 0
  }

  /** Enemy damage multiplier from the night's district and danger. */
  private bite(): number {
    const night = this.night
    return night ? nightBite(night.district, night.danger) : 1
  }

  /** Enemy HP multiplier from the night's district and danger. */
  private tough(): number {
    const night = this.night
    return night ? nightTough(night.district, night.danger) : 1
  }

  /** Blood multiplier from the night's district and danger. */
  private nightPay(): number {
    const night = this.night
    return night ? nightReward(night.district, night.danger) : 1
  }

  private frenzyMult(): number {
    return 1 + (this.night?.frenzy ?? 0) * FRENZY_STEP
  }

  private noteFrenzy(): void {
    const night = this.night
    if (!night || night.over) return
    night.frenzy = Math.min(frenzyCap(this.save.rites.frenzy), night.frenzy + 1)
    night.sinceKill = 0
    if (night.frenzy >= frenzyCap(this.save.rites.frenzy)) night.tally.frenzied = true
  }

  /** Pickups go into the night's carried purse. Outside a night they bank at once. */
  private credit(kind: Currency, amount: number): void {
    if (this.hunting()) this.night!.carried[kind] += amount
    else this.save[kind] += Math.round(amount)
  }

  /** Rolls a night spawn (or a nest's return) as an elite. Elites are bigger, tougher, and pay Ichor. */
  private rollElite(e: Actor): void {
    const night = this.night
    const elite = !!night && !night.over && !e.dummy && Math.random() < eliteChance(night.district, night.danger, this.save.rites.scent)
    e.elite = elite
    e.rig.root.scale.setScalar(elite ? ELITE.scale : 1)
    e.bar.classList.toggle('elite', elite)
    let ring = e.rig.root.userData.eliteRing as THREE.Mesh | undefined
    if (elite && !ring) {
      ring = new THREE.Mesh(this.eliteRingGeo, this.eliteRingMat)
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 0.05
      ring.scale.setScalar(Math.max(0.45, e.radius * 1.45))
      e.rig.root.add(ring)
      e.rig.root.userData.eliteRing = ring
    }
    if (ring) ring.visible = elite
    e.affixes = elite ? rollAffixes(this.tier()) : []
    e.ward = 0
    if (e.wardFx) e.wardFx.visible = false
    if (!elite) {
      if (e.tag) e.tag.style.display = 'none'
      return
    }
    e.maxHp = Math.round(e.maxHp * ELITE.hp)
    e.hp = e.maxHp
    e.dmg *= ELITE.dmg
    e.rewardBlood = Math.round(e.rewardBlood * ELITE.blood)
    e.rewardXp = Math.round(e.rewardXp * ELITE.xp)
    this.dressAffixes(e)
  }

  /** Shows an elite's modifiers: its ring takes the first one's color, and a tag names them all. */
  private dressAffixes(e: Actor): void {
    const first = e.affixes[0]
    const ring = e.rig.root.userData.eliteRing as THREE.Mesh | undefined
    if (ring && first) {
      let mat = this.affixRingMats.get(first)
      if (!mat) {
        mat = this.eliteRingMat.clone()
        mat.color.setHex(AFFIXES[first].color)
        this.affixRingMats.set(first, mat)
      }
      ring.material = mat
    }
    const tag = e.tag ?? this.hud.makeTag()
    e.tag = tag
    tag.textContent = e.affixes.map((a) => AFFIXES[a].label).join(' · ')
    tag.style.color = first ? `#${AFFIXES[first].color.toString(16).padStart(6, '0')}` : ''
    if (this.has(e, 'warded')) {
      e.ward = e.maxHp * AFFIX.warded.share
      if (!e.wardFx) {
        const fx = new THREE.Mesh(this.wardGeo, this.wardMat)
        e.rig.root.add(fx)
        e.wardFx = fx
      }
      const r = Math.max(0.55, e.radius * 1.6)
      e.wardFx.scale.set(r, r * 1.4, r)
      e.wardFx.position.y = (e.barY * 0.5) / Math.max(0.01, e.rig.root.scale.y)
      e.wardFx.visible = true
    }
  }

  private resetPods(): void {
    for (const pod of this.pods) for (const e of pod.members) this.dropEnemy(e)
    this.pods = this.zonePods().map(() => ({ members: [], timer: 0, alert: 0, rolls: 0 }))
  }

  /** The night's zone, or null at the Haven. */
  private zoneDef(): ZoneDef | null {
    const night = this.night
    return night ? MAPS[night.district].zones[night.danger] : null
  }

  /** Pods of the night's zone. */
  private zonePods(): PodDef[] {
    return this.zoneDef()?.pods ?? []
  }

  /** The night's tier on the ladder: 0 for the Slums' Court, up to 29. */
  private tier(): number {
    const night = this.night
    return night ? tierIndex(night.district, night.danger) : 0
  }

  /** Takes an enemy out of the field and the enemy list for good. */
  private dropEnemy(e: Actor): void {
    const at = this.enemies.indexOf(e)
    if (at < 0) return
    this.enemies.splice(at, 1)
    this.removeActor(e)
    if (this.lockId === e.id) this.lockId = null
    if (this.aimId === e.id) this.aimId = null
  }

  /** Takes an actor out of the scene for good: its rig, ground shadow, and health bar. */
  private removeActor(e: Actor): void {
    this.scene.remove(e.rig.root)
    this.scene.remove(e.contact)
    e.bar.remove()
    e.tag?.remove()
    this.cancelAct(e)
    this.teles.release(e.pileTele)
    e.pileTele = null
    const at = this.stage.outline.indexOf(e.rig.root)
    if (at >= 0) this.stage.outline.splice(at, 1)
  }

  /** Empties the field between the Haven and a night: every enemy and target, drops, bolts, and boss state. */
  private clearField(): void {
    for (const e of this.enemies) this.removeActor(e)
    this.enemies = []
    this.rangeLog.clear()
    this.rangeSpot.clear()
    this.boss = null
    this.don = null
    this.clearHazards()
    this.beamTarget = null
    this.beamT = 0
    for (const d of this.drops) {
      d.mesh.visible = false
      this.dropPool.push(d.mesh)
    }
    this.drops = []
    for (const b of this.bolts) this.scene.remove(b.mesh)
    this.bolts = []
    this.pods = []
    this.lockId = null
    this.aimId = null
  }

  /** Puts the hero on a spot whole: alive, full HP, and the camera already there instead of sweeping across the map. */
  private placeHero(x: number, z: number): void {
    const hero = this.hero
    hero.x = x
    hero.z = z
    hero.dead = false
    hero.deathT = 0
    hero.atkT = 0
    hero.rig.bob.scale.setScalar(1)
    hero.rig.bob.position.set(0, 0, 0)
    hero.maxHp = profile(this.save).hp
    hero.hp = hero.maxHp
    this.iframe = 1.2
    this.dashT = 0
    this.guide = null
    this.placeActor(hero)
    this.camPos.set(x, 6, z + 4)
    this.look.set(x, 1, z)
  }

  /** Dusk: the hero leaves the Haven for a district at a danger, or picks a saved night back up. */
  private beginNight(district: DistrictId, danger: number, resume?: NightSave): void {
    if (!districtOpen(this.save, district)) {
      this.hud.toast(districtGate(this.save, district).map((g) => g.text).join('. '))
      return
    }
    danger = Math.max(0, Math.min(danger, this.save.danger[district]))
    this.hud.showHaven(false)
    this.hud.showSummary(null)
    this.backToHaven = false
    if (this.mode === 'menu') this.closeMenu()
    this.clearField()
    this.district = district
    this.night = {
      district,
      danger,
      elapsed: resume?.elapsed ?? 0,
      length: nightLength(this.save.rites.night),
      carried: resume ? { ...resume.carried } : emptyPurse(),
      kills: resume?.kills ?? 0,
      frenzy: 0,
      sinceKill: FRENZY_WINDOW,
      channel: 0,
      warned: false,
      dawn: false,
      over: false,
      tally: resume?.tally ? { ...resume.tally } : emptyTally(),
      said: [],
    }
    const map = MAPS[district]
    const zone = map.zones[danger]
    this.placeHero(zone.start.x, zone.start.z)
    this.resetPods()
    this.fogBase.setHex(map.palette.fog)
    this.tintDawn()
    const label = map.label.toUpperCase()
    this.hud.setDistrict(`${label} · ${danger + 1}`)
    this.hud.banner(zone.name.toUpperCase())
    this.hud.toast(resume ? 'The night goes on' : `${map.label}, Zone ${danger + 1}. Reach a way out before dawn.`)
    this.sfx.play('boss')
    this.persist()
  }

  private updateNight(dt: number): void {
    const night = this.night
    if (!night || night.over) return
    night.elapsed += dt
    night.sinceKill += dt
    if (night.sinceKill > FRENZY_WINDOW) night.frenzy = Math.max(0, night.frenzy - FRENZY_DRAIN * dt)
    const left = night.length - night.elapsed
    if (!night.warned && left <= DAWN_WARN) {
      night.warned = true
      this.hud.banner('DAWN APPROACHES')
      this.hud.toast('One minute to dawn. Reach a way out.')
    }
    if (!night.dawn && left <= 0) {
      night.dawn = true
      this.hud.banner('DAWN')
      this.hud.toast('The sun is up, and it burns')
    }
    if (night.dawn && !this.hero.dead) {
      this.hero.hp -= this.hero.maxHp * SUNBURN * dt
      if (this.hero.hp <= 0) {
        this.hero.hp = 0
        this.hero.dead = true
        this.hero.deathT = 1.5
        this.hud.toast('The sun takes you')
      }
    }
    this.tintDawn()
    const out = this.nearestExtract()
    if (out && out.d <= EXTRACT_RADIUS && !this.hero.dead) {
      if (night.channel === 0) this.hud.toast(`${out.beacon.label}. Stay to leave with the haul.`)
      night.channel += dt
      if (night.channel >= EXTRACT_CHANNEL) this.extractNight()
    } else night.channel = Math.max(0, night.channel - dt * 2)
  }

  /** The fog warms toward red over the last minute and through the dawn. */
  private tintDawn(): void {
    const night = this.night
    let k = 0
    if (night && !night.over) {
      const into = (night.elapsed - (night.length - DAWN_WARN)) / DAWN_WARN
      k = Math.max(0, Math.min(1, into)) * 0.55 + (night.dawn ? 0.45 : 0)
    }
    const color = this.tmpColor.copy(this.fogBase).lerp(this.dawnFog, k)
    this.world.fog.color.copy(color)
    if (this.scene.background instanceof THREE.Color) this.scene.background.copy(color)
    this.renderer.setClearColor(color)
  }

  private nearestExtract(): { beacon: Beacon; d: number } | null {
    let best: { beacon: Beacon; d: number } | null = null
    for (const beacon of this.beacons) {
      if (beacon.district !== this.district || beacon.zone !== this.night?.danger) continue
      const d = Math.hypot(beacon.x - this.hero.x, beacon.z - this.hero.z)
      if (!best || d < best.d) best = { beacon, d }
    }
    return best
  }

  private extractNight(): void {
    const night = this.night
    if (!night || night.over) return
    const bonus = tierOf(night.district, night.danger).vitae
    const got = emptyPurse()
    for (const k of CURRENCIES) {
      got[k] = Math.round(night.carried[k]) + (k === 'vitae' ? bonus : 0)
      this.save[k] += got[k]
    }
    this.save.extracts += 1
    // Marks and the Omen only count for a hunter who gets out.
    const tally = { ...night.tally, blood: night.carried.blood }
    const next = MAP_IDS[MAP_IDS.indexOf(night.district) + 1]
    const wasNextOpen = next ? districtOpen(this.save, next) : true
    const { done, opened } = scoreMarks(this.save, night.district, night.danger, tally)
    const marks: string[] = []
    for (const mark of done) {
      this.payOut(mark.reward, got)
      marks.push(`Mark: ${mark.text}`)
    }
    const omen = omenFor(this.save)
    if (omenCounts(this.save, omen, night.district, night.danger) && tallyMeets(omen.def, tally)) {
      this.save.omenDay = omen.day
      this.payOut(omen.reward, got)
      marks.push(`Omen: ${markText(omen.def, night.district)}`)
    }
    let unlock: string | null = null
    if (opened != null) unlock = `${zoneName(night.district, opened)} opens in ${MAPS[night.district].label}`
    if (next && !wasNextOpen && districtOpen(this.save, next)) unlock = `${unlock ? `${unlock}. ` : ''}${MAPS[next].label} opens`
    this.burst(this.hero.x, 1, this.hero.z, 0x9fe0ff, 24, 3, 0.7)
    this.finishNight('extracted', got, emptyPurse(), bonus, unlock, marks)
  }

  /** The night ends without extracting: a death, the dawn, or giving up. The Blood Pact keeps a share. */
  private loseNight(why: 'fell' | 'dawn' | 'fled'): void {
    const night = this.night
    if (!night || night.over) return
    if (this.mode === 'menu') this.closeMenu()
    const keep = keepShare(this.save.rites.pact)
    const got = emptyPurse()
    const lost = emptyPurse()
    for (const k of CURRENCIES) {
      got[k] = Math.floor(night.carried[k] * keep)
      lost[k] = Math.max(0, Math.round(night.carried[k]) - got[k])
      this.save[k] += got[k]
    }
    this.finishNight(why, got, lost, 0, null)
  }

  /** Calls out a one-night mark the moment the night meets it. It still only counts on getting out. */
  private checkMarks(): void {
    const night = this.night
    if (!night || night.over) return
    const said = night.said
    MARKS[night.district][night.danger].forEach((def, i) => {
      if (def.kind === 'extract' || def.kind === 'unbroken' || def.kind === 'haul') return
      if (markDone(this.save, night.district, night.danger, i) || said.includes(`m${i}`)) return
      if (!tallyMeets(def, night.tally)) return
      said.push(`m${i}`)
      this.hud.toast(`Mark met: ${markText(def, night.district)}. Get out to keep it.`)
    })
    const omen = omenFor(this.save)
    if (!said.includes('omen') && omen.def.kind !== 'unbroken' && omenCounts(this.save, omen, night.district, night.danger) && tallyMeets(omen.def, night.tally)) {
      said.push('omen')
      this.hud.toast(`Omen met: ${markText(omen.def, night.district)}. Get out to keep it.`)
    }
  }

  /** Banks a mark or Omen reward, and adds it to what the summary shows came home. */
  private payOut(reward: Partial<Purse>, shown: Purse): void {
    for (const [k, v] of Object.entries(reward) as [Currency, number][]) {
      this.save[k] += v
      shown[k] += v
    }
  }

  private finishNight(
    outcome: 'extracted' | 'fell' | 'dawn' | 'fled',
    banked: Purse,
    lost: Purse,
    bonusVitae: number,
    unlock: string | null,
    marks: string[] = [],
  ): void {
    const night = this.night!
    night.over = true
    night.channel = 0
    this.hud.setNightHud(null)
    this.hud.showSummary({
      outcome,
      district: MAPS[night.district].label,
      danger: `Zone ${night.danger + 1} · ${zoneName(night.district, night.danger)}`,
      banked,
      lost,
      bonusVitae,
      keep: Math.round(keepShare(this.save.rites.pact) * 100),
      kills: night.kills,
      time: formatClock(night.elapsed),
      unlock,
      marks,
    })
    this.sfx.play(outcome === 'extracted' ? 'level' : 'hurt')
    this.persist()
  }

  /** Back to the Haven: the yard and its practice targets, the hero whole, and the board open. */
  private enterHaven(): void {
    this.hud.showSummary(null)
    this.night = null
    this.clearField()
    this.resetPods()
    this.layDummies()
    this.district = 'slums'
    this.placeHero(HAVEN_START.x, HAVEN_START.z)
    this.hud.setDistrict('THE HAVEN')
    this.fogBase.setHex(FOG_COLOR)
    this.tintDawn()
    this.persist()
  }

  /** True while the hero stands in the Haven courtyard rather than a district. */
  private inHaven(): boolean {
    return !this.night && this.hero.x > HAVEN.minX - 6
  }

  /** Finds the station in reach, lights it, and keeps the range readouts current. */
  private updateHaven(dt: number): void {
    this.yard.update(dt)
    this.mapArt.update(dt)
    let near: StationDef | null = null
    if (this.inHaven() && !this.hero.dead) {
      let best = STATION_REACH
      for (const s of STATIONS) {
        // The gate's spot is the sigil on the stones in front of it.
        const sz = s.id === 'gate' ? s.z + 1.6 : s.z
        const d = Math.hypot(this.hero.x - s.x, this.hero.z - sz) - (s.id === 'gate' ? 0.4 : 0.55)
        if (d < best) {
          best = d
          near = s
        }
      }
    }
    this.station = near
    this.yard.highlight(near?.id ?? null)
  }

  /** The prompt button, E, or Enter: use the station in reach. */
  private interact(): void {
    const s = this.station
    if (!s || this.hud.modalOpen() || this.mode === 'menu') return
    if (s.id === 'armory') {
      this.openMenu()
      return
    }
    const tab = s.id === 'gate' ? 'hunt' : s.id === 'altar' ? 'powers' : s.id === 'wardrobe' ? 'wardrobe' : 'works'
    this.openHaven(tab, s.id)
  }

  private openHaven(tab?: 'hunt' | 'powers' | 'rites' | 'works' | 'wardrobe', focus?: string): void {
    if (this.hunting()) {
      this.hud.toast('The Haven waits until you extract')
      return
    }
    if (this.mode === 'menu') this.closeMenu()
    this.refreshHaven()
    this.hud.showHaven(true, tab, focus)
  }

  private refreshHaven(): void {
    const save = this.save
    this.hud.setHaven({
      purse: bankedPurse(save),
      night: formatClock(nightLength(save.rites.night)),
      keep: Math.round(keepShare(save.rites.pact) * 100),
      extracts: save.extracts,
      districts: DISTRICT_IDS.map((id) => ({
        id,
        label: MAPS[id].label,
        blurb: MAPS[id].blurb,
        theme: MAPS[id].theme,
        roster: Object.values(MAPS[id].names).join(', '),
        boss: MAPS[id].boss.name,
        locked: !districtOpen(save, id),
        lockText: MAPS[id].theme,
        dangers: MAPS[id].zones.map((zone, i) => ({
          label: String(i + 1),
          name: zone.name,
          zoneBlurb: zone.blurb,
          tier: tierIndex(id, i) + 1,
          reward: nightReward(id, i),
          unlocked: i <= save.danger[id],
          marks: MARKS[id][i].map((def, j) => ({
            text: markText(def, id),
            have: markHave(save, id, i, j),
            need: def.kind === 'extract' ? def.n : 1,
            done: markDone(save, id, i, j),
          })),
          reward2: markReward(id, i),
          cleared: MARKS[id][i].every((_, j) => markDone(save, id, i, j)),
        })),
        best: save.danger[id],
        gate: districtGate(save, id),
      })),
      omen: (() => {
        const omen = omenFor(save)
        const deep = bestTier(save)
        const where = `tier ${Math.max(1, deep - 2)}+`
        return { text: markText(omen.def, 'slums'), reward: omen.reward, done: save.omenDay === omen.day, where }
      })(),
      marksDone: marksCleared(save),
      marksTotal: marksTotal(),
      powers: SKILLS.map((id) => {
        const rank = save.powers[id]
        const cost = rank < POWER_MAX ? powerCost(rank) : 0
        const at = powerScale(rank)
        return {
          id,
          label: SKILL_POWER_LABEL[id],
          rank,
          max: POWER_MAX,
          effect: `+${Math.round((at.dmg - 1) * 100)}% damage · −${Math.round((1 - at.cd) * 100)}% cooldown`,
          cost,
          canBuy: rank < POWER_MAX && save.vitae >= cost,
        }
      }),
      rites: RITE_IDS.map((id) => {
        const def = RITES[id]
        const rank = save.rites[id]
        const max = def.costs.length
        const cost = rank < max ? def.costs[rank] : 0
        return {
          id,
          label: def.label,
          rank,
          max,
          effect: def.effect(rank),
          next: rank < max ? def.effect(rank + 1) : '',
          cost,
          canBuy: rank < max && save.vitae >= cost,
        }
      }),
      works: WORK_IDS.map((id) => {
        const def = WORKS[id]
        const level = save.works[id]
        const cost = workCost(id, level)
        return {
          id,
          label: def.label,
          blurb: def.blurb,
          level,
          max: def.max,
          effect: def.effect(level),
          next: def.effect(level + 1),
          cost,
          canBuy: level < def.max && canAfford(bankedPurse(save), cost),
        }
      }),
      wardrobe: LOOK_SLOTS.map((slot) => ({
        slot,
        label: LOOK_SLOT_LABEL[slot],
        items: COSMETICS.filter((c) => c.slot === slot).map((c) => {
          const owned = this.ownsLook(c.id)
          return {
            id: c.id,
            label: c.label,
            color: c.color,
            owned,
            worn: save.wear[slot] === c.id,
            cost: c.cost,
            canBuy: owned || canAfford(bankedPurse(save), c.cost),
          }
        }),
      })),
    })
  }

  private spend(cost: Partial<Purse>): void {
    for (const [k, v] of Object.entries(cost) as [Currency, number][]) this.save[k] -= v
  }

  /** One more level of a Haven work, paid in materials. */
  private buyWork(id: WorkId): void {
    if (this.night) return
    const level = this.save.works[id]
    const cost = workCost(id, level)
    if (level >= WORKS[id].max || !canAfford(bankedPurse(this.save), cost)) {
      this.sfx.play('click')
      return
    }
    this.spend(cost)
    this.save.works[id] = level + 1
    this.sfx.play('upgrade')
    this.hud.toast(`${WORKS[id].label} ${level + 1}: ${WORKS[id].effect(level + 1)}`)
    this.floatAt(this.hero.x, this.hero.barY + 0.2, this.hero.z, `${WORKS[id].label} ${level + 1}`, 'level')
    this.syncVitals(profile(this.save))
    this.persist()
    this.refreshHaven()
  }

  private ownsLook(id: string): boolean {
    const c = cosmetic(id)
    return !!c && (Object.keys(c.cost).length === 0 || this.save.wardrobe.includes(id))
  }

  /** The wardrobe: buys a look the first time, and wears it from then on. */
  private pickLook(id: string): void {
    if (this.night) return
    const c = cosmetic(id)
    if (!c) return
    if (!this.ownsLook(id)) {
      if (!canAfford(bankedPurse(this.save), c.cost)) {
        this.sfx.play('click')
        return
      }
      this.spend(c.cost)
      this.save.wardrobe.push(id)
      this.hud.toast(`${c.label} bought`)
    }
    this.save.wear[c.slot] = id
    this.sfx.play('upgrade')
    this.applyWeaponLook()
    this.portraitTries = 0
    this.persist()
    this.refreshHaven()
  }

  /** Cape dye, eye glow, and strike trail from the wardrobe, over the gear's own look. */
  private applyLooks(): void {
    const rig = this.hero.rig
    const pick = (slot: LookSlot) => {
      const id = this.save.wear[slot]
      return id === DEFAULT_LOOK[slot] ? null : cosmetic(id) ?? null
    }
    const cape = rig.mats.cape
    if (cape) {
      if (cape.userData.base == null) {
        cape.userData.base = cape.color.getHex()
        cape.userData.glow = cape.emissive.getHex()
      }
      const dye = pick('cape')
      cape.color.setHex(dye ? dye.color : this.save.evolved.cape ? 0xc41a3a : cape.userData.base)
      // The cape glows from inside in its own color, or a dye goes muddy.
      if (dye) cape.emissive.setHex(dye.color).multiplyScalar(0.55)
      else cape.emissive.setHex(cape.userData.glow)
    }
    const eye = rig.mats.eye
    if (eye) {
      const glow = pick('eyes')?.color ?? 0xff1a3a
      eye.color.setHex(glow)
      eye.emissive.setHex(glow)
    }
    const trail = pick('trail')
    if (trail) (this.trail.material as THREE.MeshBasicMaterial).color.setHex(trail.color)
  }

  private buyPower(id: SkillId): void {
    if (this.night) return
    const rank = this.save.powers[id]
    const cost = powerCost(rank)
    if (rank >= POWER_MAX || this.save.vitae < cost) {
      this.sfx.play('click')
      return
    }
    this.save.vitae -= cost
    this.save.powers[id] = rank + 1
    this.sfx.play('upgrade')
    this.hud.toast(`${SKILL_POWER_LABEL[id]} rises to rank ${rank + 1}`)
    this.persist()
    this.refreshHaven()
  }

  private buyRite(id: RiteId): void {
    if (this.night) return
    const def = RITES[id]
    const rank = this.save.rites[id]
    const cost = def.costs[rank]
    if (rank >= def.costs.length || this.save.vitae < cost) {
      this.sfx.play('click')
      return
    }
    this.save.vitae -= cost
    this.save.rites[id] = rank + 1
    this.sfx.play('upgrade')
    this.hud.toast(`${def.label}: ${def.effect(rank + 1)}`)
    this.persist()
    this.refreshHaven()
  }

  /** Ichor buys the next weapon tier, once the weapon's level has reached it. Ranks start over in the new tier. */
  private ascend(): void {
    const next = nextHeldTier(this.save)
    if (!next) return
    if (this.night) {
      this.hud.toast('Ichor is spent at the Haven')
      this.sfx.play('click')
      return
    }
    const cost = TIER_ICHOR[next.id]
    if (this.save.gear.weapon < next.from || this.save.ichor < cost) {
      this.hud.toast(this.save.gear.weapon < next.from ? `${next.label} needs weapon Lv. ${next.from}` : 'Not enough Ichor')
      this.sfx.play('click')
      return
    }
    this.save.ichor -= cost
    this.save.weaponTier = next.id
    this.applyWeaponLook()
    this.portraitTries = 0
    this.syncVitals(profile(this.save))
    this.sfx.play('upgrade')
    this.hud.toast(`${weaponName(this.save.weapon, next)} · ${next.ranks} ranks to earn`)
    this.burst(this.hero.x, 1.0, this.hero.z, next.color, 18, 2.6, 0.6)
    this.shake = Math.max(this.shake, 0.22)
    this.persist()
    this.refreshMenu()
  }

  private makeBeacons(): void {
    const ringGeo = new THREE.RingGeometry(EXTRACT_RADIUS - 0.16, EXTRACT_RADIUS, 40)
    const columnGeo = new THREE.CylinderGeometry(0.45, 0.7, 10, 18, 1, true)
    for (const id of DISTRICT_IDS) {
      MAPS[id].zones.forEach((zoneDef, zone) => {
      for (const point of zoneDef.extracts) {
        const group = new THREE.Group()
        group.position.set(point.x, 0, point.z)
        const ring = new THREE.Mesh(
          ringGeo,
          new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
        )
        ring.rotation.x = -Math.PI / 2
        ring.position.y = 0.06
        const column = new THREE.Mesh(
          columnGeo,
          new THREE.MeshBasicMaterial({ color: 0x7cc8ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
        )
        column.position.y = 5
        group.add(ring, column)
        group.visible = false
        this.scene.add(group)
        this.beacons.push({ district: id, zone, x: point.x, z: point.z, label: point.label, group, column, ring })
      }
      })
    }
  }

  /** Way-out columns show only on a night in their district; the one being stood in burns brighter. */
  private updateBeacons(dt: number): void {
    const night = this.night
    const live = !!night && !night.over
    const out = live ? this.nearestExtract() : null
    const pulse = 0.5 + 0.5 * Math.sin(this.sessionT * 3)
    for (const beacon of this.beacons) {
      beacon.group.visible = live && beacon.district === this.district && beacon.zone === night!.danger
      if (!beacon.group.visible) continue
      const on = out?.beacon === beacon && night!.channel > 0
      ;(beacon.column.material as THREE.MeshBasicMaterial).opacity = (on ? 0.4 : 0.16) + pulse * 0.08
      ;(beacon.ring.material as THREE.MeshBasicMaterial).opacity = on ? 1 : 0.55 + pulse * 0.3
      beacon.ring.rotation.z += dt * (on ? 2.4 : 0.6)
    }
  }

  /** Points the HUD at the nearest way out: on it when it is on screen, from the screen edge when it is not. */
  private placeExtractMarker(): void {
    const night = this.night!
    const out = this.nearestExtract()
    if (!out) {
      this.hud.setExtract(0, 0, false, false, 0, '', 0, 0)
      return
    }
    const p = this.project(out.beacon.x, 1.4, out.beacon.z)
    const pad = 36
    const inside = p.vis && p.x > pad && p.x < this.viewW - pad && p.y > pad + 70 && p.y < this.viewH - 150
    const progress = night.channel / EXTRACT_CHANNEL
    if (inside) {
      this.hud.setExtract(p.x, p.y, true, false, 0, out.beacon.label, out.d, progress)
      return
    }
    // Off screen: run a ray from the screen center toward the point and stop at a margin.
    const cx = this.viewW / 2
    const cy = this.viewH / 2
    let dx = p.x - cx
    let dy = p.y - cy
    if (!p.vis) {
      dx = -dx
      dy = -dy
    }
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    const halfW = this.viewW / 2 - pad
    const halfH = this.viewH / 2 - 110
    const t = Math.min(Math.abs(ux) > 1e-4 ? halfW / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-4 ? halfH / Math.abs(uy) : Infinity)
    this.hud.setExtract(cx + ux * t, cy + uy * t, true, true, Math.atan2(uy, ux), out.beacon.label, out.d, progress)
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
          if (!this.hunting()) {
            this.hud.toast('It opens at nightfall')
            return
          }
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
    this.summonRival()
  }

  /** A map's boss can be called out in its last zone, once the night has put down a few of his own. */
  private canSummon(): boolean {
    const night = this.night
    if (!night || night.over || night.danger !== ZONE_COUNT - 1) return false
    if (this.localBoss() || this.summonCd > 0) return false
    return night.kills >= 8
  }

  /** Builds the map's boss rig: a hand-made one for the Rat King and the Don, a restyled pack character otherwise. */
  private rivalRig(map: MapDef): Rig {
    const b = map.boss
    if (b.base === 'don') return this.kenney ? this.kenney.don() : createDon()
    if (b.base === 'king' || !this.kenney) return this.kenney ? this.kenney.boss() : createBoss()
    return this.kenney.rival(b.base, b.look ?? {})
  }

  private summonRival(force = false): void {
    if (!this.hunting()) return
    if (!force && (this.paused() || !this.canSummon())) return
    if (this.localBoss()) return
    const map = MAPS[this.district]
    const don = map.boss.base === 'don'
    const bp = this.rivalBlueprint()
    const spot = this.district === 'slums' ? this.kingSpot() : this.arenaSpot()
    const rival = this.makeActor(don ? 'don' : 'boss', this.rivalRig(map), spot.x, spot.z, bp.hp, don ? 0.82 : 0.78, don ? 2.55 : 2.45)
    rival.armor = bossArmor(this.save.bosses[this.district], this.steps())
    rival.dmg = bp.dmg
    rival.speed = bp.speed
    rival.rewardXp = bp.xp
    rival.rewardBlood = bp.blood
    rival.intro = 0.85
    rival.poundCd = 2.2
    this.enemies.push(rival)
    if (don) this.don = rival
    else this.boss = rival
    this.sfx.play('boss')
    this.shake = 0.5
    this.hud.banner(map.boss.name.toUpperCase())
    this.hud.setSummon(false, '', '')
  }

  /** The boss ring of the night's zone, nudged clear of the hero. */
  private arenaSpot(): { x: number; z: number } {
    const arena = this.zoneDef()?.arena ?? this.ahead()
    if (Math.hypot(arena.x - this.hero.x, arena.z - this.hero.z) > 3) return arena
    return this.ahead()
  }

  private ahead(): { x: number; z: number } {
    let x = this.hero.x + this.camFwd.x * 3.3
    let z = this.hero.z + this.camFwd.z * 3.3
    return this.clampArena(x, z)
  }

  private openMenu(): void {
    // The board's Gear button opens the menu over the Haven, and closing it comes back.
    if (this.hud.havenOpen()) {
      this.hud.showHaven(false)
      this.backToHaven = true
    }
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
    if (this.backToHaven) {
      this.backToHaven = false
      if (!this.night) this.openHaven()
    }
  }

  private refreshMenu(): void {
    const rows = STATS.map((stat) => ({ stat, value: sheetStat(this.save, stat), fill: 0 }))
    const scale = Math.max(40, ...rows.map((r) => r.value))
    for (const row of rows) row.fill = row.value / scale
    this.hud.setStats(rows)
    this.hud.setFeeds(this.save.kills, this.save.bosses.slums > 0)
    this.hud.setAttrs(effectiveAttrs(this.save), weaponType(this.save), attrPointsLeft(this.save))
    const slot = this.hud.selected
    const lv = this.save.gear[slot]
    const maxed = lv >= MAX_GEAR
    const cost = upgradeCost(lv)
    const tier = heldTier(this.save)
    const next = nextHeldTier(this.save)
    const held = weaponRank(this.save, this.save.weapon)
    const power = tierPower(tier, held.rank)
    const tierBonus = ` · ×${power.toFixed(2)} dmg${tier.crit > 0 ? ` · +${Math.round(tier.crit * 100)}% crit` : ''}`
    this.hud.setGearCard(
      this.slotName(slot, lv),
      lv,
      GEAR_BLURB[slot](lv, this.save.evolved[slot]) + (slot === 'weapon' ? tierBonus : ''),
      cost,
      !maxed && this.save.blood >= cost && !this.night,
      maxed,
    )
    this.hud.setSpendLock(this.hunting(), Math.round(keepShare(this.save.rites.pact) * 100))
    const rankLine =
      held.rank >= tier.ranks
        ? `Rank ${held.rank}/${tier.ranks} · Mastered`
        : `Rank ${held.rank}/${tier.ranks} · ${held.kills}/${rankKills(tier, held.rank)} kills`
    this.hud.setClawTier(slot === 'weapon' ? tier : null, rankLine, tier.css)
    if (slot === 'weapon' && next) {
      const ichor = TIER_ICHOR[next.id]
      const ready = this.save.gear.weapon >= next.from
      this.hud.setAscend({
        label: next.label,
        css: next.css,
        cost: ichor,
        need: ready ? '' : `Needs weapon Lv. ${next.from}`,
        canBuy: ready && this.save.ichor >= ichor && !this.night,
      })
    } else this.hud.setAscend(null)
    const labels = Object.fromEntries(
      WEAPON_KINDS.map((kind) => [kind, `${tier.label} · R${weaponRank(this.save, kind).rank}`]),
    ) as Record<WeaponKind, string>
    this.hud.setArmory(slot === 'weapon', this.save.weapon, labels, tier.css)
    const w = WEAPONS[this.save.weapon]
    const traits = weaponTraits(this.save.weapon)
    this.hud.setGearNote(slot === 'weapon' ? `${w.blurb}${traits ? ` ${traits}.` : ''}` : null)
  }

  /** Gear name for a slot; the weapon's follows its tier and the equipped class. */
  private slotName(slot: Slot, lv: number): string {
    return slot === 'weapon' ? weaponName(this.save.weapon, heldTier(this.save)) : gearName(slot, lv)
  }

  private applyWeaponLook(): void {
    const tier = heldTier(this.save)
    equipWeapon(this.hero.rig, this.save.weapon, tier.id)
    // The item cards show this tier's models, so a tier change redraws them on the next frame.
    if (this.iconTier !== tier.id) {
      this.iconTier = tier.id
      this.weaponIcons = false
    }
    const rankFrac = weaponRank(this.save, this.save.weapon).rank / tier.ranks
    applyGearVisual(this.hero.rig, this.save.gear.weapon, tier.id, this.save.gear.cape, this.save.evolved.weapon, this.save.evolved.cape, rankFrac)
    const hue = new THREE.Color(tier.color)
    ;(this.trail.material as THREE.MeshBasicMaterial).color.copy(hue).lerp(new THREE.Color(0xffffff), 0.35)
    ;(this.slash.material as THREE.SpriteMaterial).color.copy(hue)
    const flash = hue.clone().lerp(new THREE.Color(0xffffff), 0.55)
    for (const slot of this.impacts) (slot.mesh.material as THREE.SpriteMaterial).color.copy(flash)
    this.applyLooks()
  }

  private upgrade(): void {
    const slot = this.hud.selected
    const lv = this.save.gear[slot]
    if (lv >= MAX_GEAR) return
    if (this.night) {
      this.hud.toast('Blood is spent at the Haven')
      this.sfx.play('click')
      return
    }
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
    this.applyWeaponLook()
    this.sfx.play('upgrade')
    const name = this.slotName(slot, lv + 1)
    const next = nextHeldTier(this.save)
    if (slot === 'weapon' && next && lv + 1 === next.from) this.hud.toast(`${name} can ascend to ${next.label} with Ichor`)
    else this.hud.toast(evolvedNow ? `${name} awakened` : `${name} sharpened`)
    this.syncVitals(profile(this.save))
    this.persist()
    this.refreshMenu()
  }

  /** Kills count toward the equipped weapon's next rank in its tier. */
  private rankWeapon(kills: number): void {
    const gained = feedWeapon(this.save, kills)
    if (gained <= 0) return
    const tier = heldTier(this.save)
    const held = weaponRank(this.save, this.save.weapon)
    this.applyWeaponLook()
    this.syncVitals(profile(this.save))
    this.sfx.play('upgrade')
    this.hud.toast(
      held.rank >= tier.ranks
        ? `${weaponName(this.save.weapon, tier)} mastered`
        : `${weaponName(this.save.weapon, tier)} · Rank ${held.rank}`,
    )
    this.burst(this.hero.x, 1.0, this.hero.z, tier.color, 14, 2.2, 0.5)
  }

  private equip(kind: WeaponKind): void {
    if (kind === this.save.weapon) return
    this.save.weapon = kind
    this.applyWeaponLook()
    this.portraitTries = 0
    this.sfx.play('upgrade')
    this.hud.toast(`${weaponName(kind, heldTier(this.save))} equipped`)
    this.syncVitals(profile(this.save))
    this.persist()
    this.refreshMenu()
  }

  private raiseAttr(attr: Attr): void {
    if (attrPointsLeft(this.save) <= 0) {
      this.hud.toast('No attribute points. Level up to earn more.')
      this.sfx.play('click')
      return
    }
    this.save.attrs[attr] += 1
    this.sfx.play('upgrade')
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
    if (!this.night) this.openHaven()
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
      pod: -1,
      returns: false,
      barLag: 1,
      barT: 0,
      barFlash: 0,
      bar: this.hud.makeBar(kind),
      poundCd: 3,
      phase: 0,
      intro: 0,
      wanderT: 1,
      wanderA: Math.random() * Math.PI * 2,
      contact,
      dummy: false,
      elite: false,
      affixes: [],
      tag: null,
      poise: 0,
      poiseQuiet: 0,
      breaks: 0,
      stunT: 0,
      dazeT: 0,
      act: null,
      sigCd: 1.5 + Math.random() * 2.5,
      token: false,
      tokenSwings: 0,
      waitT: 0,
      orbit: Math.random() < 0.5 ? -1 : 1,
      led: false,
      ward: 0,
      wardFx: null,
      pile: 0,
      pileTele: null,
      risen: false,
      blinkCd: 2.5,
      setT: 0,
      lift: 0,
      halo: null,
    }
    if (kind === 'hero') actor.bar.style.display = 'none'
    const customBar = rig.root.userData.barY
    if (typeof customBar === 'number') actor.barY = customBar
    this.placeActor(actor)
    return actor
  }

  /**
   * The Haven range: three targets along the west wall, from bare to plated.
   * They never fall; each one keeps a running damage readout.
   */
  private layDummies(): void {
    const kinds: Foe[] = ['walker', 'thrall', 'skeleton']
    RANGE_SPOTS.forEach((spot, i) => {
      const actor = this.spawnEnemy(kinds[i], spot.x, spot.z)
      actor.dummy = true
      actor.speed = 0
      actor.dmg = 0
      actor.intro = 0
      actor.armor = spot.armor
      actor.maxHp = 9999
      actor.hp = actor.maxHp
      // Facing east, out across the yard.
      actor.facing = Math.PI / 2
      actor.moving = 0
      this.placeActor(actor)
      this.rangeLog.set(actor.id, [])
      this.rangeSpot.set(actor.id, i)
      if (!this.rangeTags[i]) this.rangeTags[i] = this.hud.makeReadout(`${spot.label} · ${spot.armor} armor`)
    })
  }

  /** Damage on a range dummy: logged for the readout, and the dummy tops back up. */
  private noteRangeHit(e: Actor, amount: number): void {
    const log = this.rangeLog.get(e.id)
    if (log) log.push({ t: this.sessionT, amount })
    if (e.hp <= e.maxHp * 0.25) e.hp = e.maxHp
  }

  private updateRange(): void {
    const shown = new Set<HTMLDivElement>()
    for (const e of this.enemies) {
      if (!e.dummy) continue
      const tag = this.rangeTags[this.rangeSpot.get(e.id) ?? -1]
      const log = this.rangeLog.get(e.id)
      if (!tag || !log) continue
      shown.add(tag)
      const now = this.sessionT
      // A pause of a few seconds starts a fresh reading.
      if (log.length && now - log[log.length - 1].t > DPS_WINDOW + 1) log.length = 0
      const recent = log.filter((h) => now - h.t <= DPS_WINDOW)
      const span = log.length ? Math.max(1, Math.min(DPS_WINDOW, now - log[0].t)) : 1
      const dps = recent.reduce((sum, h) => sum + h.amount, 0) / span
      const total = log.reduce((sum, h) => sum + h.amount, 0)
      const biggest = log.reduce((m, h) => Math.max(m, h.amount), 0)
      this.hud.setReadout(tag, log.length ? formatNum(Math.round(dps)) : '—', formatNum(Math.round(total)), formatNum(Math.round(biggest)), log.length > 0)
      const p = this.project(e.x, e.barY + 0.55, e.z)
      this.hud.place(tag, p.x, p.y, p.vis && this.inHaven() && e.rig.root.visible && this.mode === 'play')
    }
    for (const tag of this.rangeTags) if (!shown.has(tag)) this.hud.place(tag, 0, 0, false)
  }

  private spawnEnemy(
    kind: Exclude<EnemyKind, 'boss' | 'don'>,
    x: number,
    z: number,
    opts?: { pod?: number; returns?: boolean },
  ): Actor {
    const rig = this.kenney ? this.kenney[kind]() : FALLBACK[kind]()
    const tint = this.night ? MAPS[this.night.district].tints[kind] : undefined
    if (tint != null) tintRig(rig, tint)
    const def = ENEMIES[kind]
    const stats = enemyStats(kind, this.steps(), this.bite(), this.tough())
    const actor = this.makeActor(kind, rig, x, z, stats.hp, def.radius, def.barY)
    actor.dmg = stats.dmg
    actor.speed = stats.speed
    actor.armor = stats.armor
    actor.rewardXp = stats.xp
    actor.rewardBlood = stats.blood
    actor.pod = opts?.pod ?? -1
    actor.returns = opts?.returns ?? false
    this.rollElite(actor)
    this.enemies.push(actor)
    return actor
  }

  /**
   * The zone's pods: each spot wakes a rolled group once the hero comes near,
   * and a wiped pod comes back with a fresh roll after its respawn time.
   */
  private tickPods(dt: number): void {
    if (!this.hunting()) return
    const hero = this.hero
    const tier = this.tier()
    const defs = this.zonePods()
    this.pods.forEach((pod, index) => {
      const def = defs[index]
      if (!def) return
      const alive = pod.members.filter((e) => !e.dead)
      if (alive.length > 0) {
        pod.alert = Math.max(0, pod.alert - dt)
        for (const e of alive) {
          const aggro = ENEMIES[e.kind as Foe].aggro
          if (e.hitFlash > 0 || Math.hypot(hero.x - e.x, hero.z - e.z) < aggro) pod.alert = POD_ALERT
        }
        return
      }
      if (pod.members.length > 0) {
        if (pod.members.some((e) => e.deathT <= 0.4)) return
        this.night!.tally.pods += 1
        this.checkMarks()
        for (const e of pod.members) this.dropEnemy(e)
        pod.members = []
        pod.timer = def.respawn
        pod.alert = 0
        return
      }
      if (pod.timer > 0) {
        pod.timer -= dt
        return
      }
      const away = Math.hypot(hero.x - def.x, hero.z - def.z)
      if (away > POD_WAKE || away < 5.5) return
      const kinds = [...rollMix(def.mixes)]
      // Deeper tiers bring more of the pod's lead: one more from tier 10, two from tier 20.
      for (let i = 0; i < Math.floor(tier / 10); i++) kinds.push(kinds[i % kinds.length])
      kinds.forEach((kind, i) => {
        const a = (i / kinds.length) * Math.PI * 2 + Math.random() * 0.5
        const r = kinds.length > 1 ? def.spread : 0
        let x = def.x + Math.cos(a) * r
        let z = def.z + Math.sin(a) * r
        if (!this.clearSpawn(x, z, ENEMIES[kind].radius)) {
          x = def.x
          z = def.z
        }
        const e = this.spawnEnemy(kind, x, z, { pod: index, returns: false })
        e.wanderA = Math.atan2(hero.x - x, hero.z - z)
        pod.members.push(e)
      })
      pod.rolls += 1
      pod.alert = 0
    })
  }

  /** Aggro range for an enemy, wider while its pod is hunting together. */
  private podAggro(e: Actor, base: number): number {
    const pod = e.pod >= 0 ? this.pods[e.pod] : null
    return pod && pod.alert > 0 ? Math.max(base, 15) : base
  }

  /** Where an idle pod member should drift back to, if it strayed off its spot. */
  private podHome(e: Actor): { x: number; z: number } | null {
    if (e.pod < 0) return null
    const def = this.zonePods()[e.pod]
    if (!def) return null
    return Math.hypot(e.x - def.x, e.z - def.z) > POD_LEASH ? { x: def.x, z: def.z } : null
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
    if (this.clearSpawn(x, z, ENEMIES.hound.radius)) return { x, z }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const px = KING_ARENA.x + Math.cos(a) * 1.35
      const pz = KING_ARENA.z + Math.sin(a) * 1.35
      if (this.clearSpawn(px, pz, ENEMIES.hound.radius)) return { x: px, z: pz }
    }
    return null
  }

  private localBoss(): Actor | null {
    if (this.don && !this.don.dead) return this.don
    return this.boss && !this.boss.dead ? this.boss : null
  }

  /** The night's boss sheet: the Rat King's or the Don's formula, at this map's falls and this zone's tier. */
  private rivalBlueprint() {
    const kills = this.save.bosses[this.district]
    return MAPS[this.district].boss.sheet === 'don'
      ? donBlueprint(this.save, kills, this.steps(), this.bite(), this.tough())
      : bossBlueprint(this.save, kills, this.steps(), this.bite(), this.tough())
  }

  private clampArena(x: number, z: number): { x: number; z: number } {
    const zone = this.zoneDef()
    if (!zone) {
      const m = 0.6
      return { x: Math.max(HAVEN.minX + m, Math.min(HAVEN.maxX - m, x)), z: Math.max(HAVEN.minZ + m, Math.min(HAVEN.maxZ - m, z)) }
    }
    return nearestInZone(zone, x, z, 0.45)
  }

  private touchGate(): void {
    if (this.travelCd > 0 || this.hero.dead) return
    if (!DISTRICT_OPEN) {
      if (this.district !== 'slums') return
      if (Math.hypot(this.hero.x - SLUM_GATE.x, this.hero.z - SLUM_GATE.z) > 1.45) return
      if (this.gateNag <= 0) {
        this.gateNag = 3.4
        this.hud.toast('The gate is barred. Choose the district at the Haven.')
      }
      return
    }
    const here = this.district === 'slums' ? SLUM_GATE : MOB_GATE
    if (Math.hypot(this.hero.x - here.x, this.hero.z - here.z) > 1.15) return
    if (this.district === 'slums' && !districtOpen(this.save, 'mob')) {
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

  /** A bolt from an enemy along a unit direction. Spitters aim where the hero stood when the wind-up began. */
  private shootBolt(e: Actor, dmg: number, dx: number, dz: number, boss: boolean, color: number, speed = 7): void {
    let mat = this.boltMats.get(color)
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ color })
      this.boltMats.set(color, mat)
    }
    const mesh = new THREE.Mesh(this.boltGeo, mat)
    const bolt: Bolt = { mesh, x: e.x, y: 1.15, z: e.z, vx: dx * speed, vz: dz * speed, life: 1.8, dmg, boss, src: e }
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

  /** Ground the hero and enemies may stand on: the night's zone, or the Haven yard between nights. */
  private canOccupy(x: number, z: number, radius: number): boolean {
    const zone = this.zoneDef()
    if (!zone) {
      if (x < HAVEN.minX + radius || x > HAVEN.maxX - radius || z < HAVEN.minZ + radius || z > HAVEN.maxZ - radius) return false
    } else if (!inZone(zone, x, z, radius)) return false
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
    if (actor.kind === 'hero') actor.rig.root.rotation.set(0, heroYaw(actor.facing), 0)
    else actor.rig.root.rotation.y = actor.facing
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
    const swing = actor.kind === 'hero' ? 0 : this.enemyPose(actor)
    if (actor.kind !== 'hero' && !actor.rig.drive) actor.rig.bob.rotation.set(0, 0, 0)
    const attack = actor.kind === 'hero' && actor.atkT > 0 ? Math.min(1, actor.atkT / actor.swingDur) : 0
    if (actor.kind === 'hero' && !actor.dead) {
      const melee: MeleeState | null =
        actor.atkT > 0
          ? {
              clip: this.swingMove.clip,
              time: actor.atkT * this.swingRate,
              rate: this.swingRate,
              contact: this.swingMove.contact,
              id: this.swingN,
              lunge: WEAPONS[this.save.weapon].lunge,
            }
          : null
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
        melee,
      )
    } else if (!actor.dead) {
      animateRig(actor.rig, performance.now() * 0.001 + actor.id, actor.moving, swing, dt)
    }
    if (!actor.dead && actor.flinch > 0) {
      const k = actor.flinch / 0.2
      actor.rig.bob.rotation.x -= 0.9 * k
      actor.rig.bob.rotation.z += (actor.id % 2 === 0 ? 0.34 : -0.34) * k
    }
    if (!actor.dead && actor.kind !== 'hero') {
      const act = actor.act
      if (act && act.stage === 'wind') {
        const k = Math.min(1, act.t / Math.max(0.01, act.wind))
        // Abilities crouch and lean in; plain attacks rear back.
        if (act.red) {
          actor.rig.bob.position.y -= 0.12 * k
          actor.rig.bob.rotation.x += 0.3 * k
        } else actor.rig.bob.rotation.x -= 0.2 * k
      }
      if (actor.stunT > 0) {
        actor.rig.bob.rotation.x += 0.4
        actor.rig.bob.rotation.z += Math.sin(this.sessionT * 9 + actor.id) * 0.14
        if (actor.halo) actor.halo.rotation.z += dt * 5
      } else if (actor.dazeT > 0) actor.rig.bob.rotation.z += Math.sin(this.sessionT * 7 + actor.id) * 0.1
    }
    this.flashActor(actor)
    const punch = 1 + actor.hitFlash * 0.7
    if (!actor.dead) actor.rig.bob.scale.setScalar(punch)
  }

  /** An enemy's arm, 0 to 1: raised through a plain wind-up, then the strike. */
  private enemyPose(a: Actor): number {
    const act = a.act
    if (act && act.stage === 'wind' && (act.move === 'swing' || act.move === 'spit')) return 0.38 * Math.min(1, act.t / Math.max(0.01, act.wind))
    if (a.swingT > 0) return 0.38 + 0.62 * (1 - a.swingT / a.swingDur)
    return 0
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
    // Restore the Euler as it was: a quaternion read back past 90° of yaw comes out as (π, π − yaw, π).
    const rot = root.rotation.clone()
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
    root.rotation.copy(rot)
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

  /**
   * Renders each weapon class's model for the current tier, in that tier's
   * colors, into its gear-menu item card. Redrawn when the tier changes.
   * Rigs without a weapon set skip this.
   */
  private snapWeaponIcons(): void {
    this.weaponIcons = true
    const all = this.hero.rig.root.userData.weapons as WeaponSet | undefined
    if (!all) return
    const tier = heldTier(this.save)
    const size = 128
    const target = new THREE.WebGLRenderTarget(size, size)
    target.texture.colorSpace = THREE.SRGBColorSpace
    const shot = new THREE.Scene()
    const key = new THREE.DirectionalLight(0xffe2c4, 1.6)
    key.position.set(2, 3, 4)
    shot.add(new THREE.HemisphereLight(0xd8ccf4, 0x3a2218, 1.6), key)
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20)
    cam.position.set(0, 0, 5)
    const prevTarget = this.renderer.getRenderTarget()
    const clear = this.renderer.getClearColor(new THREE.Color())
    const clearAlpha = this.renderer.getClearAlpha()
    // Lay each posed mesh corner to corner like an inventory icon, grip low left and tip high right.
    // The claws look through the knuckle loops, spikes and blades up. Held weapons lean toward one scale so the sword reads longer than the dagger.
    const shots = WEAPON_KINDS.map((kind) => {
      const piece = all[kind][tier.id]
      const model = piece.group.children[0]!.clone(true)
      const mat = piece.mat.clone()
      mat.emissiveIntensity = (piece.mat.userData.glow ?? 1) * 1.2
      model.traverse((child) => {
        const mesh = child as THREE.Mesh
        if (mesh.isMesh) mesh.material = mat
      })
      const pivot = new THREE.Group()
      pivot.add(model)
      // Slot +X (out of the knuckles) turns to screen up; the finger loops face the lens.
      if (kind === 'claws') pivot.rotation.set(-0.4, 0, Math.PI / 2)
      else pivot.rotation.set(0.35, 0.25, -Math.PI / 4)
      pivot.updateWorldMatrix(true, true)
      const box = new THREE.Box3().setFromObject(pivot)
      const half = (Math.max(box.max.x - box.min.x, box.max.y - box.min.y) / 2) * 1.12
      return { kind, pivot, mat, center: box.getCenter(new THREE.Vector3()), half }
    })
    const held = Math.max(...shots.filter((s) => s.kind !== 'claws').map((s) => s.half))
    for (const { kind, pivot, mat, center, half } of shots) {
      const span = kind === 'claws' ? half : (half + held) / 2
      cam.left = center.x - span
      cam.right = center.x + span
      cam.top = center.y + span
      cam.bottom = center.y - span
      cam.updateProjectionMatrix()
      shot.add(pivot)
      this.renderer.setRenderTarget(target)
      this.renderer.setClearColor(0x000000, 0)
      this.renderer.clear()
      this.renderer.render(shot, cam)
      const pixels = new Uint8Array(size * size * 4)
      this.renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels)
      this.hud.setWeaponIcon(kind, pixels, size)
      shot.remove(pivot)
      mat.dispose()
    }
    this.renderer.setRenderTarget(prevTarget)
    this.renderer.setClearColor(clear, clearAlpha)
    target.dispose()
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
    const night = this.night
    this.save.night =
      night && !night.over
        ? { district: night.district, danger: night.danger, elapsed: night.elapsed, carried: { ...night.carried }, kills: night.kills, tally: { ...night.tally } }
        : null
    writeSave(this.save)
  }

  private paintSpawns(): void {
    if (!new URLSearchParams(location.search).has('spawns')) return
    this.debugCam = 'map'
    for (const pod of MAPS.slums.zones.flatMap((z) => z.pods)) {
      const color = 0xff7a32
      const disc = new THREE.Mesh(
        new THREE.RingGeometry(Math.max(0.3, pod.spread - 0.12), pod.spread + 0.12, 28),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, fog: false, side: THREE.DoubleSide }),
      )
      disc.rotation.x = -Math.PI / 2
      disc.position.set(pod.x, 0.08, pod.z)
      this.scene.add(disc)
      const label = this.spawnLabel(pod.name.toUpperCase(), color)
      label.position.set(pod.x, 1.05, pod.z)
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
        weapon: this.save.weapon,
        weaponRank: weaponRank(this.save, this.save.weapon),
        purse: bankedPurse(this.save),
        weaponTier: this.save.weaponTier,
        powers: { ...this.save.powers },
        rites: { ...this.save.rites },
        unlocked: { ...this.save.danger },
        extracts: this.save.extracts,
        night: this.night
          ? {
              district: this.night.district,
              danger: this.night.danger,
              elapsed: +this.night.elapsed.toFixed(2),
              length: this.night.length,
              carried: { ...this.night.carried },
              kills: this.night.kills,
              frenzy: +this.night.frenzy.toFixed(2),
              channel: +this.night.channel.toFixed(2),
              dawn: this.night.dawn,
              over: this.night.over,
              elites: this.enemies.filter((e) => e.elite && !e.dead).length,
              steps: +this.steps().toFixed(2),
            }
          : null,
        haven: this.hud.havenOpen(),
        summary: this.hud.summaryOpen(),
        tier: heldTier(this.save).id,
        level: this.save.level,
        xp: this.save.xp,
        bosses: { ...this.save.bosses },
        mobKills: this.save.mobKills,
        nightZone: this.night?.danger ?? null,
        camZoom: this.hud.zoom,
        ladder: this.night ? this.tier() : null,
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
        attrs: { ...this.save.attrs },
        attrPoints: attrPointsLeft(this.save),
        attrFx: effectiveAttrs(this.save),
        prof: profile(this.save),
        camForward: { x: this.camFwd.x, z: this.camFwd.z },
        camRight: { x: this.camRight.x, z: this.camRight.z },
        fps: Math.round(this.fps),
        draws: this.paintedDraws,
        tris: this.paintedTris,
        muted: this.save.muted,
        bloodText: formatNum(this.save.blood),
        pods: this.pods.map((pod, i) => ({
          name: this.zonePods()[i]?.name,
          x: this.zonePods()[i]?.x,
          z: this.zonePods()[i]?.z,
          live: pod.members.filter((e) => !e.dead).map((e) => e.kind),
          alert: +pod.alert.toFixed(2),
          timer: +pod.timer.toFixed(2),
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
            id: e.id,
            poise: +e.poise.toFixed(2),
            stun: +e.stunT.toFixed(2),
            act: e.act ? `${e.act.move}:${e.act.stage}` : null,
            token: e.token,
            affixes: e.affixes,
            ward: Math.round(e.ward),
            pile: +e.pile.toFixed(2),
            phase: e.phase,
            elite: e.elite,
          })),
        feeds: this.feeds,
        hurt: Math.round(this.hurtTotal),
        teles: this.enemies.reduce((n, e) => n + (e.act?.shapes.length ?? 0), 0) + this.blasts.reduce((n, b) => n + b.shapes.length, 0),
        pools: this.pools.length,
      }),
      summon: () => {
        this.summonRival(true)
      },
      /** Makes an enemy elite with the given modifiers, for test runs. */
      elite: (id: number, affixes: Affix[]) => {
        const e = this.enemies.find((item) => item.id === id)
        if (!e || e.dead) return
        if (!e.elite) {
          e.elite = true
          e.maxHp = Math.round(e.maxHp * ELITE.hp)
          e.hp = e.maxHp
          e.dmg *= ELITE.dmg
          let ring = e.rig.root.userData.eliteRing as THREE.Mesh | undefined
          if (!ring) {
            ring = new THREE.Mesh(this.eliteRingGeo, this.eliteRingMat)
            ring.rotation.x = -Math.PI / 2
            ring.position.y = 0.05
            ring.scale.setScalar(Math.max(0.45, e.radius * 1.45))
            e.rig.root.add(ring)
            e.rig.root.userData.eliteRing = ring
          }
          e.rig.root.scale.setScalar(ELITE.scale)
          e.bar.classList.add('elite')
        }
        e.affixes = affixes
        this.dressAffixes(e)
      },
      calm: (on = true) => {
        this.calm = on
      },
      heal: () => {
        this.hero.dead = false
        this.hero.hp = this.hero.maxHp
        this.iframe = 0
      },
      /** Lets a spawned enemy loose: clears the long intro the spawn hook gives it. */
      wake: (id?: number) => {
        for (const e of this.enemies) if (id == null || e.id === id) e.intro = 0
      },
      /** Night test hooks: start one, walk out, jump the clock, end it, or top up a currency. */
      begin: (district: DistrictId, danger = 0) => this.beginNight(district, danger),
      toExtract: () => {
        const out = this.nearestExtract()
        if (out) this.placeHero(out.beacon.x, out.beacon.z)
      },
      skipTo: (elapsed: number) => {
        if (this.night) this.night.elapsed = elapsed
      },
      abandon: () => this.loseNight('fled'),
      /** Opens every map and zone and clears every mark, for test runs. */
      unlockAll: () => {
        for (const id of DISTRICT_IDS) {
          this.save.danger[id] = ZONE_COUNT - 1
          this.save.bosses[id] = Math.max(this.save.bosses[id], MAPS[id].bossGate)
          MARKS[id].forEach((list, zone) => list.forEach((def, i) => (this.save.marks[`${id}.${zone}.${i}`] = def.kind === 'extract' ? def.n : 1)))
        }
        this.persist()
      },
      /** Drops one enemy of a kind on a spot, for close looks at a model. */
      spawn: (kind: Foe, x: number, z: number) => {
        const e = this.spawnEnemy(kind, x, z)
        e.intro = 999
        return e.id
      },
      /** Kills every living enemy within `r` of the hero, as if struck down. */
      smite: (r = 6) => {
        for (const e of [...this.enemies]) {
          if (e.dead || e.dummy || e.kind === 'hero') continue
          if (Math.hypot(e.x - this.hero.x, e.z - this.hero.z) <= r) this.killEnemy(e)
        }
      },
      haven: () => {
        if (!this.hunting()) this.enterHaven()
      },
      give: (kind: Currency, n: number) => {
        this.save[kind] += n
        if (this.hud.havenOpen()) this.refreshHaven()
      },
      buyPower: (id: SkillId) => this.buyPower(id),
      buyRite: (id: RiteId) => this.buyRite(id),
      ascend: () => this.ascend(),
      equip: (kind: WeaponKind) => {
        if (isWeaponKind(kind)) this.equip(kind)
      },
      /** Quick test hook: set an attribute's spent points directly, ignoring the point budget. */
      setAttr: (attr: Attr, value: number) => {
        if (!ATTRS.includes(attr)) return
        this.save.attrs[attr] = Math.max(0, Math.floor(value))
        this.syncVitals(profile(this.save))
        if (this.mode === 'menu') this.refreshMenu()
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
        // u runs the swing from wind-up to back on guard.
        this.swingMove = WEAPONS[this.save.weapon].swings[0]
        this.swingRate = this.swingMove.ready
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
          heroH: +new THREE.Box3().setFromObject(this.hero.rig.root).getSize(new THREE.Vector3()).y.toFixed(2),
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
        const ring = living.filter((e) => e.kind !== 'spitter').slice(0, 4)
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
          this.cancelAct(e)
          this.placeActor(e)
        })
        parked.forEach((e, i) => {
          e.x = -70 - i * 3
          e.z = -70
          e.speed = 0
          this.cancelAct(e)
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
