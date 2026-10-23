import * as THREE from 'three'
import { addRim } from './polish'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { CLAW_TIERS, type ClawTier, type ClawTierId } from './balance'
import type { KenneyAnimState, KenneyDriver, MeleeState, Rig, WeaponSet } from './models'
import { WEAPON_KINDS, type WeaponKind } from './weapons'

/**
 * Free-tier KayKit characters on the shared Rig_Medium skeleton.
 * The vampire is the Adventurers mage: pale head, solid red cape, a right-hand weapon
 * (claws, dagger, sword, or mace, one pack model per tier; see `equipWeapon` in models.ts).
 * Skeletons are the minion on the same clips.
 */

export interface KaykitCast {
  hero(): Rig
  skeleton(): Rig
}

const UP = new THREE.Vector3(0, 1, 0)
/** About 12% under the previous mage scale, so the hero reads a little smaller. */
const HERO_SCALE = 0.88
/** Head bone only. Body scale stays at HERO_SCALE. */
const HEAD_SCALE = 0.93
/** Clip seconds a weapon swing takes to blend in over the pose under it. */
const SWING_IN = 0.12
/** Seconds a finished swing takes to hand the body back to idle / walk. */
const SWING_OUT = 0.16

function asset(path: string): string {
  return new URL(path, new URL(import.meta.env.BASE_URL, window.location.href)).href
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function smoother(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** One swing action and its own clock while it fades out. */
interface SwingSlot {
  action: THREE.AnimationAction
  time: number
  rate: number
  weight: number
  contact: number
  lunge: number
}

/** Skeletons stab. Melee_1H_Attack_Stab's thrust meets the target 0.42 s into the clip. */
const STAB = 'Melee_1H_Attack_Stab'
const STAB_CONTACT = 0.42
/** An enemy swing runs 0.28 s and its hit lands 0.16 s in (see the enemy loop in Game.ts). */
const ENEMY_SWING = 0.28
const ENEMY_HIT = 0.16
/** Clip seconds one enemy swing covers, at one even rate, so the thrust lands on the hit. */
const STAB_SPAN = (STAB_CONTACT * ENEMY_SWING) / ENEMY_HIT

class KayDriver implements KenneyDriver {
  private readonly yawQ = new THREE.Quaternion()

  constructor(
    private readonly mixer: THREE.AnimationMixer,
    idle: THREE.AnimationAction,
    walk: THREE.AnimationAction,
    sprint: THREE.AnimationAction,
    private readonly bob: THREE.Group,
    private readonly hips: THREE.Object3D | null,
    private readonly chest: THREE.Object3D | null,
    private readonly head: THREE.Object3D | null,
    private readonly lunge: boolean,
    private readonly clips: Map<string, THREE.AnimationClip>,
  ) {
    for (const action of [idle, walk, sprint]) {
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.play()
    }
    this.idle = idle
    this.walk = walk
    this.sprint = sprint
  }

  private readonly idle: THREE.AnimationAction
  private readonly walk: THREE.AnimationAction
  private readonly sprint: THREE.AnimationAction
  /** Two actions per weapon clip, so a swing can blend into another swing of the same clip. */
  private readonly swingActions = new Map<string, [THREE.AnimationAction, THREE.AnimationAction]>()
  private swing: SwingSlot | null = null
  private tail: SwingSlot | null = null
  private swingId = -1
  /** Enemy swings arrive as a bare 0–1 `swing`; these turn it into stab swings. */
  private lastU = 0
  private stabs = 0

  update(state: KenneyAnimState): void {
    if (state.melee !== undefined) {
      this.updateHero(state)
      return
    }
    const gait = clamp(state.gait, 0, 1)
    const u = clamp(state.swing, 0, 1)
    if (u > 0 && (this.lastU <= 0 || u < this.lastU)) this.stabs++
    this.lastU = u
    const stab: MeleeState | null =
      u > 0 ? { clip: STAB, time: u * STAB_SPAN, rate: STAB_SPAN / ENEMY_SWING, contact: STAB_CONTACT, id: this.stabs, lunge: 0 } : null
    const over = this.layerSwing(stab, state.dt)
    this.idle.setEffectiveWeight((1 - gait) * (1 - over))
    this.walk.setEffectiveWeight(gait * (1 - over))
    this.sprint.setEffectiveWeight(0)
    this.walk.timeScale = 0.45 + gait * 1.25
    this.sprint.timeScale = 0.7 + gait * 0.4
    this.mixer.update(state.dt)
    this.applyAim(state, gait, this.swing != null)
    this.bob.position.set(0, 0, 0)
  }

  /** The hero: locomotion from ground speed, with the weapon swing laid over it. */
  private updateHero(state: KenneyAnimState): void {
    const gait = clamp(state.gait, 0, 1)
    const over = this.layerSwing(state.melee ?? null, state.dt)
    this.blendHero(state)
    for (const action of [this.idle, this.walk, this.sprint]) action.setEffectiveWeight(action.getEffectiveWeight() * (1 - over))
    this.mixer.update(state.dt)
    const attacking = this.swing != null
    this.applyAim(state, gait, attacking)
    this.applySwingLean(state, attacking)
    // Absolute, every frame: the mixer can write the bind scale back.
    if (this.lunge && this.head) this.head.scale.setScalar(HEAD_SCALE)
  }

  /**
   * Lays an attack clip over locomotion at one even rate (no time warp).
   * It blends in over its first frames, and when the swing is done keeps
   * playing on its own clock while it fades back to the feet. A new swing
   * takes over from a fading one the same way. Returns the weight the
   * swings hold, which locomotion gives up.
   */
  private layerSwing(m: MeleeState | null, dt: number): number {
    if (m && m.id !== this.swingId) this.startSwing(m)
    else if (!m && this.swing) {
      this.tail = this.swing
      this.swing = null
    }
    if (m && this.swing) {
      this.swing.time = m.time
      this.swing.rate = m.rate
      this.swing.weight = smoother(0, SWING_IN, m.time)
    }
    if (this.tail) {
      const t = this.tail
      t.time = Math.min(t.action.getClip().duration, t.time + dt * t.rate)
      t.weight = this.swing ? Math.min(t.weight, 1 - this.swing.weight) : t.weight - dt / SWING_OUT
      if (t.weight <= 0) {
        t.action.setEffectiveWeight(0)
        this.tail = null
      }
    }
    const over = Math.min(1, (this.swing?.weight ?? 0) + (this.tail?.weight ?? 0))
    for (const slot of [this.swing, this.tail]) {
      if (!slot) continue
      slot.action.time = Math.min(slot.time, slot.action.getClip().duration - 1e-4)
      slot.action.setEffectiveWeight(slot.weight)
    }
    return over
  }

  private startSwing(m: MeleeState): void {
    this.swingId = m.id
    if (this.swing) this.tail = this.swing
    let pair = this.swingActions.get(m.clip)
    if (!pair) {
      const src = this.clips.get(m.clip)
      if (!src) {
        this.swing = null
        return
      }
      pair = [this.mixer.clipAction(src), this.mixer.clipAction(src.clone())]
      for (const action of pair) {
        action.setLoop(THREE.LoopOnce, 1)
        action.clampWhenFinished = true
        action.play()
        action.paused = true
        action.setEffectiveWeight(0)
      }
      this.swingActions.set(m.clip, pair)
    }
    const action = this.tail?.action === pair[0] ? pair[1] : pair[0]
    this.swing = { action, time: m.time, rate: m.rate, weight: 0, contact: m.contact, lunge: m.lunge }
  }

  /**
   * Coil back into the wind-up and lean through the contact frame, on top
   * of the clip. Timed in clip seconds off the weapon's contact, scaled by
   * how far that weapon leans and by the swing's blend weight.
   */
  private applySwingLean(state: KenneyAnimState, attacking: boolean): void {
    let z = 0
    let y = 0
    let rx = 0
    const sign = state.lungeSign ?? 1
    for (const slot of [this.swing, this.tail]) {
      if (!slot || slot.weight <= 0) continue
      const c = slot.contact
      const t = slot.time
      const coil = c * 0.8
      const wind = t < coil ? smoother(0, coil, t) : Math.max(0, 1 - (t - coil) / (c - coil + 0.05))
      const strike = t < c - 0.08 ? 0 : t < c + 0.04 ? (t - (c - 0.08)) / 0.12 : Math.max(0, 1 - (t - c - 0.04) / 0.36)
      const k = slot.lunge * slot.weight
      z += sign * k * (-0.2 * wind + 0.42 * strike)
      y += -0.05 * wind * slot.weight
      rx += sign * k * (0.32 * wind - 0.4 * strike)
    }
    this.bob.position.set(0, y, z)
    // A live swing skips the walk lean, so the swing owns the tilt; a fading one adds to it.
    if (attacking) this.bob.rotation.set(rx, 0, 0)
    else this.bob.rotation.x += rx
  }

  /**
   * Idle, walk, and run crossfade from ground speed.
   * timeScale is (speed / stride) * clip length, so one cycle covers `stride`
   * meters and the feet keep up with the body. Walk is the ordinary pace.
   * Run only starts once the hero is moving fast (a dash, or later gear).
   * The bone swing itself is short, so the stride is a little longer than
   * that raw travel: short enough that the steps read, long enough that a
   * normal walk is not a skitter.
   */
  private blendHero(state: KenneyAnimState): void {
    const speed = Math.max(0, state.speed ?? 0)
    const idleW = 1 - smoother(0.18, 1.15, speed)
    const runW = smoother(4.15, 6.6, speed)
    const moveW = 1 - idleW
    this.idle.setEffectiveWeight(idleW)
    this.walk.setEffectiveWeight(moveW * (1 - runW))
    this.sprint.setEffectiveWeight(moveW * runW)
    this.idle.timeScale = 1
    this.walk.timeScale = this.pace(speed, 1.65, this.walk.getClip().duration || 1.067, 2.3)
    this.sprint.timeScale = this.pace(speed, 2.15, this.sprint.getClip().duration || 0.8, 2.4)
  }

  /** Clip playback rate: (speed / stride) * duration, held to a natural range. */
  private pace(speed: number, stride: number, duration: number, cap: number): number {
    if (speed < 0.08) return 0.35
    return clamp((speed / stride) * duration, 0.42, cap)
  }

  private applyAim(state: KenneyAnimState, gait: number, attacking: boolean): void {
    if (attacking) return
    const hip = state.hipYaw
    const counter = clamp(-hip * 0.34, -0.42, 0.42)
    const forward = Math.cos(hip)
    const side = Math.sin(hip)
    if (this.hips && Math.abs(hip) > 0.02) {
      this.yawQ.setFromAxisAngle(UP, hip)
      this.hips.quaternion.multiply(this.yawQ)
    }
    if (this.chest && Math.abs(hip) > 0.02) {
      this.yawQ.setFromAxisAngle(UP, -hip + counter)
      this.chest.quaternion.premultiply(this.yawQ)
    }
    if (this.head && Math.abs(counter) > 0.02) {
      this.yawQ.setFromAxisAngle(UP, clamp(-counter * 0.7, -0.3, 0.3))
      this.head.quaternion.premultiply(this.yawQ)
    }
    this.bob.rotation.set(-forward * 0.1 * gait, 0, -side * 0.08 * gait)
  }
}

function clip(clips: Map<string, THREE.AnimationClip>, name: string): THREE.AnimationClip {
  const found = clips.get(name)
  if (!found) throw new Error(`KayKit clip ${name} is missing`)
  return found
}

/** GLTFLoader strips dots, so `hand.r` is named `handr` on the loaded rig. */
function bone(model: THREE.Object3D, name: string): THREE.Object3D | null {
  return model.getObjectByName(name) ?? model.getObjectByName(name.replace(/[^\w-]/g, '')) ?? null
}

function asGroup(obj: THREE.Object3D | null): THREE.Group {
  return (obj as THREE.Group | null) ?? new THREE.Group()
}

function findMap(model: THREE.Object3D): THREE.Texture | null {
  let map: THREE.Texture | null = null
  model.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh || map) return
    const src = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial
    if (src?.map) map = src.map
  })
  return map
}

/** Shift warm atlas squares toward a pale face. Dark features stay. */
function paleSkin(src: THREE.Texture): THREE.Texture {
  const image = src.image as CanvasImageSource & { width: number; height: number }
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return src
  ctx.drawImage(image, 0, 0)
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = frame.data
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i]
    const g = px[i + 1]
    const b = px[i + 2]
    const warm = r > 145 && r > g + 6 && r - b > 32 && b < 200
    if (!warm) continue
    px[i] = Math.round(r * 0.25 + 255 * 0.75)
    px[i + 1] = Math.round(g * 0.2 + 236 * 0.8)
    px[i + 2] = Math.round(b * 0.16 + 228 * 0.84)
  }
  ctx.putImageData(frame, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.flipY = false
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.needsUpdate = true
  return tex
}

function lambert(opts: THREE.MeshLambertMaterialParameters): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial(opts)
  mat.userData.flashable = true
  addRim(mat)
  return mat
}

function paintVampire(model: THREE.Object3D, pale: THREE.Texture): { cape: THREE.MeshLambertMaterial } {
  const robeMap = findMap(model)
  const robe = lambert({
    map: robeMap ?? undefined,
    color: 0xff4a5c,
    emissive: 0x6a1424,
    emissiveIntensity: 0.5,
    side: THREE.DoubleSide,
  })
  const skin = lambert({
    map: pale,
    color: 0xfff4f0,
    emissive: 0xffc8c0,
    emissiveMap: pale,
    emissiveIntensity: 0.42,
    side: THREE.FrontSide,
  })
  const cape = lambert({
    color: 0xd01228,
    emissive: 0x8a1020,
    emissiveIntensity: 0.62,
    side: THREE.DoubleSide,
  })
  model.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.frustumCulled = false
    if (mesh.name.includes('Hat')) {
      mesh.visible = false
      return
    }
    if (mesh.name.includes('Cape')) mesh.material = cape
    else if (mesh.name.includes('Head')) mesh.material = skin
    else mesh.material = robe
  })
  return { cape }
}

function paintGhoul(model: THREE.Object3D): void {
  const map = findMap(model)
  const boneMat = lambert({
    map: map ?? undefined,
    color: 0xe7f2dc,
    emissive: 0x243028,
    emissiveMap: map ?? undefined,
    emissiveIntensity: 0.58,
    side: THREE.DoubleSide,
  })
  const cloak = lambert({
    map: map ?? undefined,
    color: 0x7a1830,
    emissive: 0x3a0814,
    emissiveMap: map ?? undefined,
    emissiveIntensity: 0.4,
    side: THREE.DoubleSide,
  })
  const eyes = lambert({ color: 0xff2038, emissive: 0xff2038, emissiveIntensity: 1.8 })
  model.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.frustumCulled = false
    if (mesh.name.includes('Eyes')) mesh.material = eyes
    else if (mesh.name.includes('Cloak')) mesh.material = cloak
    else mesh.material = boneMat
  })
}

function ground(model: THREE.Object3D, wide: number, tall: number, fitHeight: number | null): number {
  model.scale.set(1, 1, 1)
  model.updateWorldMatrix(true, true)
  const raw = new THREE.Box3().setFromObject(model)
  const rawH = Math.max(0.001, raw.getSize(new THREE.Vector3()).y)
  const fit = fitHeight == null ? 1 : fitHeight / rawH
  model.scale.set(fit * wide, fit * tall, fit * wide)
  model.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(model)
  const mid = box.getCenter(new THREE.Vector3())
  model.position.set(-mid.x, -box.min.y, -mid.z)
  return box.max.y - box.min.y
}

function faceDetails(model: THREE.Object3D, head: THREE.Object3D, headMesh: THREE.Object3D): THREE.MeshLambertMaterial | undefined {
  model.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(headMesh)
  const size = box.getSize(new THREE.Vector3())
  if (size.y < 0.05) return undefined
  const scale = new THREE.Vector3()
  head.getWorldScale(scale)
  const inv = 1 / Math.max(0.001, scale.x)
  const cx = (box.min.x + box.max.x) / 2
  const cy = (box.min.y + box.max.y) / 2
  const front = box.max.z
  const place = (x: number, y: number, z: number): THREE.Vector3 => head.worldToLocal(new THREE.Vector3(x, y, z))
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0xff1a3a, emissive: 0xff1a3a, emissiveIntensity: 2.6 })
  const eyeGeo = new THREE.SphereGeometry(Math.max(0.015, size.x * 0.055 * inv), 8, 6)
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat)
    eye.position.copy(place(cx + side * size.x * 0.18, cy + size.y * 0.08, front + size.z * 0.02))
    head.add(eye)
  }
  const fangMat = new THREE.MeshLambertMaterial({ color: 0xfff8f4, emissive: 0x6a4048, emissiveIntensity: 0.35 })
  const fangGeo = new THREE.ConeGeometry(Math.max(0.01, size.x * 0.035 * inv), Math.max(0.04, size.y * 0.14 * inv), 4)
  for (const side of [-1, 1]) {
    const fang = new THREE.Mesh(fangGeo, fangMat)
    fang.position.copy(place(cx + side * size.x * 0.09, cy - size.y * 0.22, front + size.z * 0.01))
    fang.rotation.x = Math.PI
    head.add(fang)
  }
  const blushMat = new THREE.MeshLambertMaterial({
    color: 0xff8aa0,
    emissive: 0xff5a78,
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.7,
  })
  const blushGeo = new THREE.SphereGeometry(Math.max(0.02, size.x * 0.09 * inv), 8, 6)
  for (const side of [-1, 1]) {
    const blush = new THREE.Mesh(blushGeo, blushMat)
    blush.scale.set(1.25, 0.7, 0.35)
    blush.position.copy(place(cx + side * size.x * 0.3, cy - size.y * 0.04, front - size.z * 0.02))
    head.add(blush)
  }
  return eyeMat
}

/**
 * A tier's weapon material: the pack texture tinted toward the tier color,
 * lit from inside in that color. `userData.glow` is the resting glow; the
 * rank brightens it from there (see `applyGearVisual`).
 */
function tierMaterial(template: THREE.Object3D, tier: ClawTier): THREE.MeshLambertMaterial {
  const map = findMap(template)
  const hue = new THREE.Color(tier.color)
  const mat = new THREE.MeshLambertMaterial({
    map: map ?? undefined,
    color: new THREE.Color(0xffffff).lerp(hue, 0.6),
    emissive: hue,
    emissiveMap: map ?? undefined,
    emissiveIntensity: TIER_GLOW[tier.id],
  })
  mat.userData.flashable = true
  mat.userData.glow = TIER_GLOW[tier.id]
  addRim(mat)
  return mat
}

const TIER_GLOW: Record<ClawTierId, number> = {
  teethling: 0.55,
  kindred: 0.7,
  awakened: 0.85,
  ascendent: 1,
  immortal: 1.2,
}

type V3 = [number, number, number]

/**
 * One mesh of a tier's weapon, posed in the right-hand slot. In slot space
 * +X points out of the knuckles (the punch), Y runs across the fingers (the
 * way a hilt passes through the fist, so a held blade points along +Y), and
 * the origin sits inside the curled fingers.
 */
interface WeaponPart {
  /** A glTF stem in the Fantasy Weapons Bits pack, or `bone_A` from Halloween Bits. */
  file: string
  pos?: V3
  rot?: V3
  scale: number | V3
}

/**
 * The pack's fist weapons are authored striking face along −X, grip along Z,
 * finger holes along Y. This turn puts the striking face out of the knuckles,
 * the grip across the fingers, and the finger holes along the fingers. (The
 * `_stacked` fist models are display piles of two, not something to wear.)
 */
const FIST_TURN: V3 = [-Math.PI / 2, 0, Math.PI]

/**
 * fistweapon_A worn as brass knuckles: the back bar sunk in the palm where a
 * hilt would sit, the band around the fingers, and the spiked bar flush on
 * the knuckle face. Slightly deepened so it covers the knuckle row.
 */
const KNUCKLES: WeaponPart = { file: 'fistweapon_A', pos: [-0.05, 0, 0.05], rot: FIST_TURN, scale: [1, 1.3, 1] }

/**
 * fistweapon_B's three blades, its grip hidden in the palm so they come out
 * between the knuckles. `tilt` splays the set about the punch axis; `scale`
 * is the pack mesh's (length, curve, spread).
 */
function clawBlades(tilt: number, z: number, scale: V3): WeaponPart {
  return { file: 'fistweapon_B', pos: [0, 0, z], rot: [FIST_TURN[0] + tilt, 0, Math.PI], scale }
}

/**
 * Every weapon class holds a different pack model at each tier, and each
 * one is a step up from the last. Pack weapons are authored grip at the
 * origin, blade or head along +Y. The pack has two daggers; the tiers past
 * the sai are its sword blades cut short and broad into knives (a tanto,
 * a basket-hilt main-gauche, a dirk), so they never read as small swords.
 */
const TIER_MODELS: Record<WeaponKind, Record<ClawTierId, WeaponPart[]>> = {
  // Every tier wears the same knuckle duster around the fist; the tiers above
  // add claw blades growing out between the knuckles.
  claws: {
    teethling: [KNUCKLES],
    kindred: [KNUCKLES, clawBlades(0, 0.05, [0.42, 0.8, 0.7])],
    awakened: [KNUCKLES, clawBlades(0, 0.05, [1, 1.1, 0.7])],
    // Long claws, with a row of short fangs splayed under them.
    ascendent: [KNUCKLES, clawBlades(0, 0.05, [1.3, 1.15, 0.75]), clawBlades(-0.45, 0.03, [0.5, 0.85, 0.66])],
    // Two long sets splayed above and below the knuckles: six blades.
    immortal: [KNUCKLES, clawBlades(0.35, 0.07, [1.4, 1.15, 0.75]), clawBlades(-0.35, 0.03, [1.25, 1.1, 0.72])],
  },
  dagger: {
    teethling: [{ file: 'dagger_A', scale: 1 }],
    kindred: [{ file: 'dagger_B', scale: 1 }],
    awakened: [{ file: 'sword_C', scale: [1.15, 0.64, 1.15] }],
    ascendent: [{ file: 'sword_D', scale: [1.05, 0.62, 1.05] }],
    immortal: [{ file: 'sword_E', scale: [0.9, 0.44, 0.9] }],
  },
  sword: {
    teethling: [{ file: 'sword_A', scale: 1.2 }],
    kindred: [{ file: 'sword_B', scale: 1.22 }],
    awakened: [{ file: 'sword_C', scale: 1.1 }],
    ascendent: [{ file: 'sword_D', scale: 1.16 }],
    immortal: [{ file: 'sword_E', scale: 0.8 }],
  },
  mace: {
    // bone_A lies along X, centered. Stood up on Y with one knuckle in the fist, it is a bone club.
    teethling: [{ file: 'bone_A', pos: [0, 0.39, 0], rot: [0, 0, Math.PI / 2], scale: [1.45, 1.35, 1.35] }],
    kindred: [{ file: 'hammer_C', scale: 0.95 }],
    awakened: [{ file: 'hammer_B', scale: 0.95 }],
    ascendent: [{ file: 'hammer_A', scale: 1.05 }],
    // The crystal staff cut down to a scepter, held near the butt so the crystal is the head.
    immortal: [{ file: 'staff_B', pos: [0, 0.36, 0], scale: [1.3, 0.66, 1.3] }],
  },
}

function weaponFile(file: string): string {
  return file === 'bone_A' ? 'cc0/kaykit/bone_A.gltf' : `cc0/kaykit/weapons/Assets/gltf/${file}.gltf`
}

function attachWeapon(
  slot: THREE.Object3D,
  name: string,
  parts: WeaponPart[],
  files: Map<string, THREE.Object3D>,
  mat: THREE.MeshLambertMaterial,
): THREE.Group {
  const group = new THREE.Group()
  group.name = `weapon-${name}`
  const model = new THREE.Group()
  for (const part of parts) {
    const mesh = files.get(part.file)!.clone(true)
    mesh.traverse((child) => {
      const m = child as THREE.Mesh
      if (!m.isMesh) return
      m.material = mat
      m.castShadow = false
      m.receiveShadow = false
      m.frustumCulled = false
    })
    mesh.position.set(...(part.pos ?? [0, 0, 0]))
    mesh.rotation.set(...(part.rot ?? [0, 0, 0]))
    if (typeof part.scale === 'number') mesh.scale.setScalar(part.scale)
    else mesh.scale.set(...part.scale)
    model.add(mesh)
  }
  group.add(model)
  group.updateWorldMatrix(true, true)
  const best = new THREE.Vector3()
  const v = new THREE.Vector3()
  let bestLen = 0
  model.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const pos = mesh.geometry.getAttribute('position')
    if (!pos) return
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      v.applyMatrix4(mesh.matrixWorld)
      const len = v.length()
      if (len > bestLen) {
        bestLen = len
        best.copy(v)
      }
    }
  })
  const tip = new THREE.Object3D()
  tip.name = 'claw-tip'
  tip.position.copy(best)
  group.add(tip)
  slot.add(group)
  return group
}

function wrap(model: THREE.Object3D, height: number, clips: Map<string, THREE.AnimationClip>, lunge: boolean, claws: THREE.Object3D[], mats: Rig['mats']): Rig {
  const mixer = new THREE.AnimationMixer(model)
  const bob = new THREE.Group()
  bob.add(model)
  const root = new THREE.Group()
  root.name = 'actor'
  root.add(bob)
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(0.28, height * 0.22), 16),
    new THREE.MeshLambertMaterial({ color: 0x140810, transparent: true, opacity: 0.38, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.02
  root.add(shadow)
  root.userData.barY = height + 0.16
  const hips = bone(model, 'hips')
  const chest = bone(model, 'chest')
  const head = bone(model, 'head')
  const drive = new KayDriver(
    mixer,
    mixer.clipAction(clip(clips, 'Idle_A')),
    mixer.clipAction(clip(clips, 'Walking_A')),
    mixer.clipAction(clip(clips, 'Running_A')),
    bob,
    hips,
    chest,
    head,
    lunge,
    clips,
  )
  return {
    root,
    bob,
    head: asGroup(head),
    armL: asGroup(bone(model, 'upperarm.l')),
    armR: asGroup(bone(model, 'upperarm.r')),
    legL: asGroup(bone(model, 'upperleg.l')),
    legR: asGroup(bone(model, 'upperleg.r')),
    torso: asGroup(chest),
    hip: asGroup(hips),
    claws,
    drive,
    mats,
  }
}

function buildVampire(
  template: THREE.Object3D,
  clips: Map<string, THREE.AnimationClip>,
  files: Map<string, THREE.Object3D>,
  pale: THREE.Texture,
): Rig {
  const model = cloneSkinned(template) as THREE.Group
  const { cape } = paintVampire(model, pale)
  const height = ground(model, 1.16 * HERO_SCALE, 0.98 * HERO_SCALE, null)
  const head = bone(model, 'head')
  const headMesh = model.getObjectByName('Mage_Head')
  const eye = head && headMesh ? faceDetails(model, head, headMesh) : undefined
  const claws: THREE.Object3D[] = []
  const right = bone(model, 'handslot.r')
  const weapons = {} as WeaponSet
  if (right) {
    for (const kind of WEAPON_KINDS) {
      weapons[kind] = {} as WeaponSet[WeaponKind]
      for (const tier of CLAW_TIERS) {
        // Each model gets its own material, so a rank's glow only lights the one in hand.
        const parts = TIER_MODELS[kind][tier.id]
        const mat = tierMaterial(files.get(parts[0].file)!, tier)
        const group = attachWeapon(right, `${kind}-${tier.id}`, parts, files, mat)
        group.visible = kind === 'claws' && tier.id === 'teethling'
        weapons[kind][tier.id] = { group, mat }
      }
    }
    claws.push(weapons.claws.teethling.group)
  }
  const rig = wrap(model, height, clips, true, claws, { claw: weapons.claws?.teethling.mat, cape, eye })
  rig.root.userData.kayFist = true
  rig.root.userData.visual = HERO_SCALE
  if (right) rig.root.userData.weapons = weapons
  return rig
}

function buildGhoul(template: THREE.Object3D, clips: Map<string, THREE.AnimationClip>): Rig {
  const model = cloneSkinned(template) as THREE.Group
  paintGhoul(model)
  const height = ground(model, 1.08, 1, 1.72)
  return wrap(model, height, clips, false, [], {})
}

export async function loadKaykit(): Promise<KaykitCast> {
  const loader = new GLTFLoader()
  const stems = [...new Set(WEAPON_KINDS.flatMap((kind) => CLAW_TIERS.flatMap((t) => TIER_MODELS[kind][t.id].map((p) => p.file))))]
  const [mage, skel, combat, general, move, ...arms] = await Promise.all([
    loader.loadAsync(asset('cc0/kaykit/mage.glb')),
    loader.loadAsync(asset('cc0/kaykit/skeleton-minion.glb')),
    loader.loadAsync(asset('cc0/kaykit/anim-combat.glb')),
    loader.loadAsync(asset('cc0/kaykit/anim-general.glb')),
    loader.loadAsync(asset('cc0/kaykit/anim-move.glb')),
    ...stems.map((stem) => loader.loadAsync(asset(weaponFile(stem)))),
  ])
  const clips = new Map<string, THREE.AnimationClip>()
  for (const gltf of [combat, general, move]) {
    for (const anim of gltf.animations) clips.set(anim.name, anim)
  }
  const map = findMap(mage.scene)
  if (!map) throw new Error('KayKit mage is missing its texture')
  const pale = paleSkin(map)
  const files = new Map(stems.map((stem, i) => [stem, arms[i].scene]))
  return {
    hero: () => buildVampire(mage.scene, clips, files, pale),
    skeleton: () => buildGhoul(skel.scene, clips),
  }
}
