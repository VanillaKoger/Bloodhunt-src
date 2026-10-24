import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { bakeDecor, type DecorLib } from './decor'
import { buildCritterRig, buildFlyer, loadCast, loadCritter, type Flyer } from './critters'
import type { FoeLook } from './types'
import { DECOR_NAMES } from './mapart'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ClawSpec, KenneyAnimState, KenneyDriver, Rig } from './models'
import { loadKaykit } from './kaykit'
import { dressCity } from './city'
import { addRim } from './polish'
import {
  BARRIER_D,
  BARRIER_FACE,
  BARRIER_H,
  BARRIER_RECESS,
  BARRIER_TUCK,
  barrierFit,
  cornerPier,
  COMMON_WALL_H,
  MOB_ARENA,
  PERIMETER_SCALE,
  MOB_BLOCKS,
  MOB_CARS,
  MOB_Z,
  SLUM_BLOCKS,
  SLUM_GAPS,
  SLUM_GATE,
  faceToward,
  type AlleyBlock,
} from './world'

/**
 * CC0 city. This is the default look. `?classic=1` skips this module.
 * The hero is the KayKit Adventurers mage, recoloured as a chunky vampire,
 * with the shared Rig_Medium chop. Skeletons are the KayKit skeleton minion.
 * Slum walls are the eight KayKit City Builder Bits shells, one mesh each.
 * The mob district dress follows MOB_ARENA.
 */

export interface KenneyLib {
  /** The props the map decorations use, baked to flat colors (decor.ts). */
  decor: DecorLib
  /** The Rat King's litter: the Quaternius Easy Enemy rat, on its own clips. */
  rat(): Rig
  /** One bat of the Bat Swarm: the Quaternius Animated Monster bat, flapping on its own clip. */
  bat(): Flyer
  /** A map's own look for a foe (maps.ts `looks`), from the cast in critters.ts. */
  look(name: FoeLook): Rig
  /** A grazing animal for the map art (Ultimate Animated Animals). */
  fauna(name: string): Flyer | null
  dress(scene: THREE.Scene, blocks: AlleyBlock[]): void
  /** Fade buildings and barriers that sit between the camera and the hero. */
  fadeBlockers(camera: THREE.Camera, x: number, z: number, dt: number, active: boolean): void
  /** Drift the outer city's fog and the few flickering lamps. */
  drift(dt: number): void
  hero(): Rig
  hound(): Rig
  walker(): Rig
  thrall(): Rig
  spitter(): Rig
  skeleton(): Rig
  boss(): Rig
  thug(): Rig
  enforcer(): Rig
  don(): Rig
  /** A map's boss: a pack character restyled by the map's boss look (see maps.ts). */
  rival(base: RivalBase, look: RivalLook): Rig
}

export type RivalBase = 'zombie' | 'ghost' | 'vampire' | 'fox' | 'suitB' | 'suitE' | 'suitH'

export interface RivalLook {
  scale?: number
  tint?: number
  crown?: boolean
  cape?: boolean
  claws?: boolean
  hat?: boolean
  orb?: boolean
  orbColor?: number
  eyes?: number
  chunky?: boolean
  grey?: boolean
}

interface Prep {
  object: THREE.Group
  size: THREE.Vector3
}

interface ActorTemplate {
  scene: THREE.Group
  clips: Map<string, THREE.AnimationClip>
}

const UP = new THREE.Vector3(0, 1, 0)

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

function damp(current: number, target: number, dt: number, lambda: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt))
}

class Baker {
  private lists = new Map<THREE.Material, THREE.BufferGeometry[]>()

  add(mesh: THREE.Mesh, material: THREE.Material): void {
    const source = mesh.geometry
    const geo = source.index ? source.toNonIndexed() : source.clone()
    geo.applyMatrix4(mesh.matrixWorld)
    const list = this.lists.get(material)
    if (list) list.push(geo)
    else this.lists.set(material, [geo])
  }

  flush(scene: THREE.Scene): void {
    for (const [material, list] of this.lists) {
      const merged = mergeGeometries(list, false)
      for (const geo of list) geo.dispose()
      if (!merged) continue
      const mesh = new THREE.Mesh(merged, material)
      mesh.matrixAutoUpdate = false
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.updateMatrix()
      scene.add(mesh)
    }
  }
}

function asLambert(src: THREE.Material, glow: number, cache: Map<string, THREE.MeshLambertMaterial>): THREE.MeshLambertMaterial {
  const std = src as THREE.MeshStandardMaterial
  const map = std?.map ?? null
  const color = std?.color ? std.color.getHexString() : 'ffffff'
  const key = `${map ? map.uuid : 'flat'}|${color}|${std?.transparent ? 't' : 'o'}|${glow}`
  let material = cache.get(key)
  if (!material) {
    material = new THREE.MeshLambertMaterial({
      map: map ?? undefined,
      color: std?.color ? std.color.clone() : new THREE.Color(0xffffff),
      emissive: map ? new THREE.Color(0xffffff) : std?.color ? std.color.clone() : new THREE.Color(0x222222),
      emissiveMap: map ?? undefined,
      emissiveIntensity: map ? glow : 0.28,
      side: THREE.DoubleSide,
      transparent: Boolean(std?.transparent),
      opacity: std?.opacity ?? 1,
      depthWrite: !(std?.transparent && (std.opacity ?? 1) < 0.95),
    })
    addRim(material)
    cache.set(key, material)
  }
  return material
}

function lambertize(root: THREE.Object3D, glow: number): void {
  const cache = new Map<string, THREE.MeshLambertMaterial>()
  root.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const srcs = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const next = srcs.map((src) => asLambert(src, glow, cache))
    mesh.material = next.length === 1 ? next[0] : next
    mesh.castShadow = false
    mesh.receiveShadow = false
  })
}

function prepare(scene: THREE.Group): Prep {
  const wrap = new THREE.Group()
  wrap.add(scene)
  wrap.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(wrap)
  const center = box.getCenter(new THREE.Vector3())
  scene.position.x -= center.x
  scene.position.y -= box.min.y
  scene.position.z -= center.z
  return { object: wrap, size: box.getSize(new THREE.Vector3()) }
}

function hold(parent: THREE.Matrix4, child: THREE.Object3D): void {
  const holder = new THREE.Object3D()
  holder.matrix.copy(parent)
  holder.matrixAutoUpdate = false
  holder.add(child)
  holder.updateMatrixWorld(true)
}

function stamp(prep: Prep, parent: THREE.Matrix4, x: number, y: number, z: number, rotY: number, dimX: number, dimY: number, dimZ: number, baker: Baker): void {
  const obj = prep.object.clone(true)
  obj.position.set(x, y, z)
  obj.rotation.y = rotY
  obj.scale.set(dimX / Math.max(0.001, prep.size.x), dimY / Math.max(0.001, prep.size.y), dimZ / Math.max(0.001, prep.size.z))
  hold(parent, obj)
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.isMesh) baker.add(mesh, mesh.material as THREE.Material)
  })
}

function localAabb(obj: THREE.Object3D): THREE.Box3 {
  obj.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(obj)
  return box.applyMatrix4(obj.matrixWorld.clone().invert())
}

interface Look {
  scale: number
  tint: number
  pitch: number
  ears: boolean
  snout: number
  tail: number
  crown: boolean
  hat: boolean
  cape: boolean
  claws: boolean
  eyes: number | null
  orb: boolean
  /** Wash the pack colors to grey before the tint, for sick or rotten looks. */
  grey?: boolean
  /** The orb's glow color, when it has one. */
  orbColor?: number
  emissive: number
  emissiveIntensity: number
  glow: number
  fedora: boolean
  shades: boolean
  fangs: boolean
  chunky: boolean
  tierClaws: boolean
}

class ActorDriver implements KenneyDriver {
  private readonly yawQ = new THREE.Quaternion()
  private readonly attackQ = new THREE.Quaternion()
  private readonly attackE = new THREE.Euler()

  constructor(
    private readonly mixer: THREE.AnimationMixer,
    private readonly idle: THREE.AnimationAction,
    private readonly walk: THREE.AnimationAction,
    private readonly sprint: THREE.AnimationAction,
    private readonly bob: THREE.Group,
    private readonly pelvis: THREE.Object3D | null,
    private readonly torso: THREE.Object3D | null,
    private readonly head: THREE.Object3D | null,
    private readonly arm: THREE.Object3D | null,
    private readonly cape: THREE.Object3D | null,
    private readonly tail: THREE.Object3D | null,
    private readonly orb: THREE.Object3D | null,
    private readonly pitch: number,
    meleeClip: THREE.AnimationClip | null,
  ) {
    for (const action of [idle, walk, sprint]) {
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.play()
    }
    idle.timeScale = 1
    this.melee = meleeClip ? mixer.clipAction(meleeClip) : null
    if (this.melee) {
      this.melee.setLoop(THREE.LoopOnce, 1)
      this.melee.clampWhenFinished = true
      this.melee.play()
      this.melee.setEffectiveWeight(0)
      this.melee.paused = true
    }
  }

  private readonly melee: THREE.AnimationAction | null

  update(state: KenneyAnimState): void {
    const gait = clamp(state.gait, 0, 1)
    const attacking = state.attack > 0 && this.melee != null
    if (attacking && this.melee) {
      this.idle.setEffectiveWeight(0)
      this.walk.setEffectiveWeight(0)
      this.sprint.setEffectiveWeight(0)
      this.melee.setEffectiveWeight(1)
      this.melee.paused = true
      this.melee.time = state.attack * (this.melee.getClip().duration || 0.42)
      this.mixer.update(0)
    } else {
      if (this.melee) this.melee.setEffectiveWeight(0)
      const sprintK = state.footSync ? smoother(0.58, 0.92, gait) : 0
      this.idle.setEffectiveWeight(1 - gait)
      this.walk.setEffectiveWeight(gait * (1 - sprintK))
      this.sprint.setEffectiveWeight(gait * sprintK)
      if (state.footSync) {
        this.walk.timeScale = 0
        this.sprint.timeScale = 0
        this.walk.time = this.cycleTime(this.walk, state.phase)
        this.sprint.time = this.cycleTime(this.sprint, state.phase)
      } else {
        this.walk.timeScale = 0.45 + gait * 1.25
        this.sprint.timeScale = 0
      }
      this.mixer.update(state.dt)
    }
    this.applyAim(state, gait, attacking)
    this.applyStrike(state, attacking)
  }

  private cycleTime(action: THREE.AnimationAction, phase: number): number {
    const duration = action.getClip().duration || 1
    const wrapped = ((phase / (Math.PI * 2)) % 1 + 1) % 1
    return wrapped * duration
  }

  /** Body sell for the melee clip: coil back, then lunge through the strike. */
  private applyStrike(state: KenneyAnimState, attacking: boolean): void {
    if (!attacking) {
      this.bob.position.set(0, 0, 0)
      return
    }
    const u = state.attack
    const wind = u < 0.36 ? u / 0.36 : Math.max(0, 1 - (u - 0.36) / 0.16)
    const strike = u < 0.34 ? 0 : u < 0.58 ? (u - 0.34) / 0.24 : Math.max(0, 1 - (u - 0.58) / 0.42)
    this.bob.position.set(0, -0.05 * wind, -0.28 * wind + 0.46 * strike)
    this.bob.rotation.set(0.42 * wind - 0.48 * strike, 0, 0)
    if (this.torso && strike > 0) {
      this.attackE.set(0.22 * strike, 0.55 * strike, 0)
      this.attackQ.setFromEuler(this.attackE)
      this.torso.quaternion.multiply(this.attackQ)
    }
    if (this.cape) {
      this.cape.rotation.x = damp(this.cape.rotation.x, 0.28 + strike * 0.7 + wind * 0.15, state.dt || 0.016, 8)
    }
  }

  private applyAim(state: KenneyAnimState, gait: number, attacking = false): void {
    if (attacking) return
    const hip = state.hipYaw
    const counter = clamp(-hip * 0.34, -0.42, 0.42)
    const forward = Math.cos(hip)
    const side = Math.sin(hip)
    if (this.pelvis) {
      this.pelvis.rotation.set(forward * 0.05 * gait, hip, side * 0.04 * gait)
    }
    if (this.torso) {
      this.yawQ.setFromAxisAngle(UP, -hip + counter)
      this.torso.quaternion.premultiply(this.yawQ)
    }
    if (this.head) {
      this.yawQ.setFromAxisAngle(UP, clamp(-counter * 0.7, -0.3, 0.3))
      this.head.quaternion.premultiply(this.yawQ)
    }
    const swing = state.swing > 0 ? Math.sin(Math.min(1, state.swing) * Math.PI) : 0
    if (this.arm && swing > 0) {
      this.attackE.set(0.15 * swing, -0.75 * swing, -1.05 * swing)
      this.attackQ.setFromEuler(this.attackE)
      this.arm.quaternion.multiply(this.attackQ)
    }
    this.bob.rotation.set(this.pitch - forward * 0.12 * gait, 0, -side * 0.1 * gait)
    if (this.cape) {
      const kick = Math.abs(Math.sin(state.phase)) * 0.08 * gait
      this.cape.rotation.x = damp(this.cape.rotation.x, 0.22 + gait * 0.4 * forward + kick, state.dt, 2.6)
      this.cape.rotation.z = damp(this.cape.rotation.z, side * 0.28 * gait, state.dt, 2.6)
    }
    if (this.tail) {
      this.tail.rotation.y = Math.sin(state.time * 3.2) * (0.18 + gait * 0.4)
      this.tail.rotation.z = Math.sin(state.time * 2.1) * 0.12
    }
    if (this.orb) {
      this.orb.position.y = 0.05 + Math.sin(state.time * 3) * 0.06
      this.orb.rotation.y = state.time * 2
    }
  }
}

function paintActor(model: THREE.Object3D, material: THREE.Material): void {
  model.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.material = material
    mesh.castShadow = false
    mesh.receiveShadow = false
  })
}

function bone(model: THREE.Object3D, name: string): THREE.Object3D | null {
  return model.getObjectByName(name) ?? null
}

function asGroup(obj: THREE.Object3D | null): THREE.Group {
  return (obj as THREE.Group | null) ?? new THREE.Group()
}

function textureOf(model: THREE.Object3D, fallback: THREE.Texture): THREE.Texture {
  let found = fallback
  model.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const src = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial
    if (src?.map) found = src.map
  })
  return found
}

const greyCache = new Map<THREE.Texture, THREE.Texture>()

/** A grey copy of a pack texture, so a tint reads as the creature's own color. */
function greyed(tex: THREE.Texture): THREE.Texture {
  const hit = greyCache.get(tex)
  if (hit) return hit
  const img = tex.image as CanvasImageSource & { width: number; height: number }
  if (!img || !img.width) return tex
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const g = canvas.getContext('2d')!
  g.drawImage(img, 0, 0)
  const data = g.getImageData(0, 0, canvas.width, canvas.height)
  const px = data.data
  for (let i = 0; i < px.length; i += 4) {
    const l = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11
    // Keep a little of the old hue so the markings still read.
    px[i] = l * 0.85 + px[i] * 0.15
    px[i + 1] = l * 0.85 + px[i + 1] * 0.15
    px[i + 2] = l * 0.85 + px[i + 2] * 0.15
  }
  g.putImageData(data, 0, 0)
  const out = new THREE.CanvasTexture(canvas)
  out.colorSpace = tex.colorSpace
  out.flipY = tex.flipY
  out.magFilter = tex.magFilter
  out.minFilter = tex.minFilter
  greyCache.set(tex, out)
  return out
}

function buildActor(template: ActorTemplate, map: THREE.Texture, look: Look): Rig {
  const model = template.scene.clone(true)
  const worn = look.grey ? greyed(textureOf(model, map)) : textureOf(model, map)
  const wide = look.chunky ? 1.12 : 1
  const tall = look.chunky ? 0.92 : 1
  model.scale.set(look.scale * wide, look.scale * tall, look.scale * wide)
  model.updateWorldMatrix(true, true)
  const bounds = new THREE.Box3().setFromObject(model)
  const mid = bounds.getCenter(new THREE.Vector3())
  model.position.set(-mid.x, -bounds.min.y, -mid.z)

  const body = new THREE.MeshLambertMaterial({
    map: worn,
    color: look.tint,
    emissive: look.tint,
    emissiveMap: worn,
    emissiveIntensity: look.glow,
    side: THREE.DoubleSide,
  })
  body.userData.flashable = true
  paintActor(model, body)

  const pelvis = bone(model, 'root')
  const torso = bone(model, 'torso')
  const head = bone(model, 'head') ?? torso
  const armR = bone(model, 'arm-right')
  const armL = bone(model, 'arm-left')
  const legR = bone(model, 'leg-right')
  const legL = bone(model, 'leg-left')

  const clawMat = new THREE.MeshLambertMaterial({
    color: 0xe7eef6,
    emissive: 0x3a1020,
    emissiveIntensity: 0.35,
  })
  const capeMat = new THREE.MeshLambertMaterial({
    color: 0x9c1630,
    emissive: 0x4a0818,
    emissiveIntensity: 0.28,
    side: THREE.DoubleSide,
  })
  const gold = new THREE.MeshLambertMaterial({
    color: 0xe8c25a,
    emissive: 0x6a4010,
    emissiveIntensity: 0.45,
  })
  const fur = new THREE.MeshLambertMaterial({ color: look.tint, emissive: look.emissive, emissiveIntensity: 0.2 })
  const pink = new THREE.MeshLambertMaterial({ color: 0xd9a0a8, emissive: 0x5a3038, emissiveIntensity: 0.25 })

  const anchor = head ?? torso
  let cape: THREE.Object3D | null = null
  let tail: THREE.Object3D | null = null
  let orb: THREE.Object3D | null = null
  const claws: THREE.Object3D[] = []

  if (anchor) {
    const box = localAabb(anchor)
    const size = box.getSize(new THREE.Vector3())
    const cx = (box.min.x + box.max.x) / 2
    const cy = (box.min.y + box.max.y) / 2
    const cz = (box.min.z + box.max.z) / 2
    if (look.ears) {
      const geo = new THREE.ConeGeometry(Math.max(0.03, size.x * 0.16), Math.max(0.08, size.y * 0.42), 5)
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(geo, pink)
        ear.position.set(cx + side * size.x * 0.42, box.max.y - size.y * 0.05, cz)
        ear.rotation.z = side * -0.45
        anchor.add(ear)
      }
    }
    if (look.snout > 0) {
      const snout = new THREE.Mesh(new THREE.BoxGeometry(size.x * 0.42, size.y * 0.22, look.snout), fur)
      snout.position.set(cx, cy - size.y * 0.05, box.max.z + look.snout * 0.35)
      anchor.add(snout)
      const nose = new THREE.Mesh(new THREE.SphereGeometry(size.x * 0.08, 6, 5), pink)
      nose.position.set(cx, cy - size.y * 0.02, box.max.z + look.snout * 0.72)
      anchor.add(nose)
    }
    if (look.eyes != null) {
      const eyeMat = new THREE.MeshLambertMaterial({ color: look.eyes, emissive: look.eyes, emissiveIntensity: 1.5 })
      const r = Math.max(0.02, size.x * 0.08)
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), eyeMat)
        eye.position.set(cx + side * size.x * 0.2, cy + size.y * 0.08, box.max.z + r * 0.2)
        anchor.add(eye)
      }
    }
    if (look.fangs) {
      const fangMat = new THREE.MeshLambertMaterial({ color: 0xfff8f4, emissive: 0x6a4048, emissiveIntensity: 0.35 })
      const fangGeo = new THREE.ConeGeometry(Math.max(0.012, size.x * 0.045), Math.max(0.05, size.y * 0.2), 4)
      for (const side of [-1, 1]) {
        const fang = new THREE.Mesh(fangGeo, fangMat)
        fang.position.set(cx + side * size.x * 0.1, cy - size.y * 0.28, box.max.z + size.z * 0.02)
        fang.rotation.x = Math.PI
        anchor.add(fang)
      }
      const blushMat = new THREE.MeshLambertMaterial({
        color: 0xff8aa0,
        emissive: 0xff5a78,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.72,
      })
      for (const side of [-1, 1]) {
        const blush = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.02, size.x * 0.1), 8, 6), blushMat)
        blush.scale.set(1.3, 0.7, 0.35)
        blush.position.set(cx + side * size.x * 0.32, cy - size.y * 0.08, box.max.z * 0.72)
        anchor.add(blush)
      }
    }
    if (look.hat) {
      const hat = new THREE.Mesh(new THREE.ConeGeometry(size.x * 0.62, size.y * 0.85, 7), capeMat)
      hat.position.set(cx, box.max.y + size.y * 0.28, cz)
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(size.x * 0.78, size.x * 0.78, size.y * 0.06, 8), capeMat)
      brim.position.set(cx, box.max.y + size.y * 0.02, cz)
      anchor.add(hat, brim)
    }
    if (look.fedora) {
      const felt = new THREE.MeshLambertMaterial({ color: 0x16181e, emissive: 0x101218, emissiveIntensity: 0.35 })
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(size.x * 0.32, size.x * 0.36, size.y * 0.38, 8), felt)
      crown.position.set(cx, box.max.y + size.y * 0.2, cz)
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(size.x * 0.7, size.x * 0.7, size.y * 0.055, 10), felt)
      brim.position.set(cx, box.max.y + size.y * 0.02, cz + size.z * 0.04)
      anchor.add(crown, brim)
    }
    if (look.shades) {
      const glass = new THREE.MeshLambertMaterial({ color: 0x07080c, emissive: 0x14202c, emissiveIntensity: 0.45 })
      const bar = new THREE.Mesh(new THREE.BoxGeometry(size.x * 0.78, size.y * 0.1, size.z * 0.16), glass)
      bar.position.set(cx, cy + size.y * 0.06, box.max.z + 0.02)
      anchor.add(bar)
    }
    if (look.crown) {
      const crown = new THREE.Group()
      crown.position.set(cx, box.max.y + size.y * 0.02, cz)
      const band = new THREE.Mesh(new THREE.TorusGeometry(size.x * 0.34, size.x * 0.06, 6, 12), gold)
      band.rotation.x = Math.PI / 2
      crown.add(band)
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2
        const spike = new THREE.Mesh(new THREE.ConeGeometry(size.x * 0.07, size.y * 0.28, 4), gold)
        spike.position.set(Math.sin(a) * size.x * 0.28, size.y * 0.16, Math.cos(a) * size.x * 0.28)
        crown.add(spike)
      }
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(size.x * 0.08, 0),
        new THREE.MeshLambertMaterial({ color: 0xff2244, emissive: 0xff2244, emissiveIntensity: 1.5 }),
      )
      gem.position.set(0, size.y * 0.12, size.x * 0.3)
      crown.add(gem)
      anchor.add(crown)
    }
  }

  if (look.cape && torso) {
    const box = localAabb(torso)
    const size = box.getSize(new THREE.Vector3())
    cape = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 0.72, size.y * 0.62), capeMat)
    cape.position.set(0, size.y * 0.05, box.min.z - 0.02)
    cape.rotation.x = 0.2
    torso.add(cape)
  }

  if (look.tail > 0 && pelvis) {
    const box = localAabb(pelvis)
    tail = new THREE.Mesh(new THREE.CapsuleGeometry(look.tail, Math.max(0.28, look.tail * 8), 3, 6), pink)
    tail.rotation.x = -Math.PI / 2
    tail.position.set(0, 0.12, box.min.z - 0.16)
    pelvis.add(tail)
  }

  if (look.claws && armR) {
    const box = localAabb(armR)
    const size = box.getSize(new THREE.Vector3())
    const hand = new THREE.Group()
    hand.position.set(box.min.x, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2)
    const geo = new THREE.ConeGeometry(Math.max(0.012, size.y * 0.16), Math.max(0.06, size.x * 0.45), 4)
    for (const offset of [-0.35, 0, 0.35]) {
      const claw = new THREE.Mesh(geo, clawMat)
      claw.rotation.z = Math.PI / 2
      claw.position.set(-size.x * 0.2, 0, offset * size.z)
      hand.add(claw)
    }
    if (look.tierClaws) {
      const spec: ClawSpec = {
        len: Math.max(0.06, size.x * 0.5),
        rad: Math.max(0.012, size.y * 0.15),
        gap: size.z * 0.3,
        axis: 'z',
        pos: [size.x * 0.04, 0, 0],
        rot: [0, 0, Math.PI / 2],
      }
      hand.userData.clawSpec = spec
    }
    armR.add(hand)
    claws.push(hand)
  }

  if (look.orb && torso) {
    const box = localAabb(torso)
    const glow = look.orbColor ?? 0xc45bff
    const gem = new THREE.MeshLambertMaterial({ color: glow, emissive: glow, emissiveIntensity: 1.6 })
    orb = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.06, box.getSize(new THREE.Vector3()).x * 0.12), 8, 6), gem)
    orb.position.set(box.max.x + 0.08, box.max.y * 0.45, box.max.z)
    torso.add(orb)
  }

  const idle = template.clips.get('idle')
  const walk = template.clips.get('walk')
  const sprint = template.clips.get('sprint') ?? template.clips.get('run') ?? walk
  if (!idle || !walk || !sprint) throw new Error('Kenney character is missing idle/walk clips')

  const mixer = new THREE.AnimationMixer(model)
  const bob = new THREE.Group()
  bob.add(model)
  const root = new THREE.Group()
  root.name = 'actor'
  root.add(bob)
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.34 * look.scale, 16),
    new THREE.MeshLambertMaterial({ color: 0x140810, transparent: true, opacity: 0.38, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.02
  root.add(shadow)
  root.updateWorldMatrix(true, true)
  root.userData.barY = new THREE.Box3().setFromObject(root).max.y + 0.12

  const drive = new ActorDriver(
    mixer,
    mixer.clipAction(idle),
    mixer.clipAction(walk),
    mixer.clipAction(sprint),
    bob,
    pelvis,
    torso,
    head,
    armR,
    cape,
    tail,
    orb,
    look.pitch,
    template.clips.get('attack-melee-right') ?? null,
  )

  return {
    root,
    bob,
    head: asGroup(head),
    armL: asGroup(armL),
    armR: asGroup(armR),
    legL: asGroup(legL),
    legR: asGroup(legR),
    torso: asGroup(torso),
    hip: asGroup(pelvis),
    cape: cape instanceof THREE.Group ? cape : undefined,
    tail: tail ?? undefined,
    orb: orb ?? undefined,
    claws,
    drive,
    mats: { claw: clawMat, cape: capeMat, trim: gold },
  }
}

const BASE = {
  ears: false,
  snout: 0,
  tail: 0,
  crown: false,
  hat: false,
  cape: false,
  claws: false,
  eyes: null as number | null,
  orb: false,
  fedora: false,
  shades: false,
  fangs: false,
  chunky: false,
  tierClaws: false,
}

const LOOK: Record<'hero' | 'hound' | 'walker' | 'thrall' | 'spitter' | 'boss' | 'thug' | 'enforcer' | 'don', Look> = {
  hero: {
    ...BASE,
    scale: 2.36,
    tint: 0xfff4f6,
    pitch: 0,
    ears: true,
    claws: true,
    eyes: 0xff1a3a,
    fangs: true,
    chunky: true,
    tierClaws: true,
    emissive: 0x5a2030,
    emissiveIntensity: 0.3,
    glow: 0.8,
  },
  // A mangy fox gone to rot: the fast one that comes in packs.
  hound: { ...BASE, scale: 0.66, tint: 0xa8c08a, grey: true, pitch: 0, emissive: 0x1e2c14, emissiveIntensity: 0.2, glow: 0.46 },
  // Green-grey and hunched, with bile-yellow eyes.
  walker: { ...BASE, scale: 1.5, tint: 0xa6c48c, pitch: -0.16, claws: true, eyes: 0xc8ff5a, emissive: 0x1e2c16, emissiveIntensity: 0.2, glow: 0.64 },
  // A turned one that went wrong: ashen skin, red eyes, claws.
  thrall: { ...BASE, scale: 1.52, tint: 0xc4b6c4, pitch: -0.1, claws: true, eyes: 0xff2420, emissive: 0x2c1020, emissiveIntensity: 0.22, glow: 0.66 },
  // A drifting cloud of plague with a bile orb it throws from.
  spitter: { ...BASE, scale: 1.7, tint: 0xb4f0a8, pitch: 0, orb: true, orbColor: 0x9cff3a, eyes: 0xe0ff40, emissive: 0x1a3a10, emissiveIntensity: 0.26, glow: 0.74 },
  // The Rat King: a bloated plague-lord with a crown and a cape of rags.
  boss: { ...BASE, scale: 2.5, tint: 0xc8a4b4, pitch: -0.18, crown: true, cape: true, claws: true, chunky: true, eyes: 0xff2028, emissive: 0x3a1828, emissiveIntensity: 0.24, glow: 0.68 },
  thug: { ...BASE, scale: 0.78, tint: 0xffffff, pitch: 0, fedora: true, shades: true, emissive: 0x12141c, emissiveIntensity: 0.15, glow: 0.48 },
  enforcer: { ...BASE, scale: 0.9, tint: 0xfff4f2, pitch: 0, fedora: true, shades: true, emissive: 0x1a1014, emissiveIntensity: 0.15, glow: 0.46 },
  don: { ...BASE, scale: 1.14, tint: 0xfff8f2, pitch: 0, fedora: true, shades: true, cape: true, emissive: 0x140e12, emissiveIntensity: 0.18, glow: 0.5 },
}

async function loadTexture(path: string): Promise<THREE.Texture> {
  const map = await new THREE.TextureLoader().loadAsync(asset(path))
  map.colorSpace = THREE.SRGBColorSpace
  map.magFilter = THREE.LinearFilter
  map.minFilter = THREE.LinearMipmapLinearFilter
  return map
}

async function loadProps(paths: string[], glow: number): Promise<Record<string, Prep>> {
  const loader = new GLTFLoader()
  const entries = await Promise.all(
    paths.map(async (path) => {
      const gltf = await loader.loadAsync(asset(path))
      const key = path.split('/').pop()!.replace(/\.gltf$|\.glb$/, '')
      if (key.startsWith('sign')) {
        gltf.scene.rotation.x = -Math.PI / 2
        const tint = key.endsWith('1') ? 0xff4d8a : key.endsWith('2') ? 0x49e7ff : 0xffc56a
        gltf.scene.traverse((child) => {
          const mesh = child as THREE.Mesh
          if (!mesh.isMesh) return
          const srcs = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          for (const src of srcs) {
            const mat = src as THREE.MeshStandardMaterial
            if ((mat.name || '').includes('Sign')) mat.color.setHex(tint)
            else mat.color.setHex(0x8a9098)
          }
        })
      }
      lambertize(gltf.scene, glow)
      return [key, prepare(gltf.scene)] as const
    }),
  )
  return Object.fromEntries(entries)
}

async function loadActor(path: string): Promise<ActorTemplate> {
  const gltf = await new GLTFLoader().loadAsync(asset(path))
  const clips = new Map<string, THREE.AnimationClip>()
  for (const clip of gltf.animations) clips.set(clip.name, clip)
  return { scene: gltf.scene, clips }
}


interface Occluder {
  meshes: THREE.Mesh[]
  mats: THREE.MeshLambertMaterial[]
  box: THREE.Box3
  opacity: number
  /** Seconds the ray may miss before the fade starts back. */
  hold: number
}

const occluders: Occluder[] = []
const FADE_OPACITY = 0.3
const FADE_SECONDS = 0.2
const rayOrigin = new THREE.Vector3()
const rayRight = new THREE.Vector3()
const rayForward = new THREE.Vector3()

/** Segment from the camera to a point on the hero, against a padded world box. */
function segmentHits(ox: number, oy: number, oz: number, tx: number, ty: number, tz: number, box: THREE.Box3, pad: number): boolean {
  const dx = tx - ox
  const dy = ty - oy
  const dz = tz - oz
  const min = [box.min.x - pad, box.min.y - pad, box.min.z - pad]
  const max = [box.max.x + pad, box.max.y + pad, box.max.z + pad]
  const origin = [ox, oy, oz]
  const delta = [dx, dy, dz]
  let tmin = 0
  let tmax = 1
  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(delta[axis]) < 1e-8) {
      if (origin[axis] < min[axis] || origin[axis] > max[axis]) return false
      continue
    }
    let t1 = (min[axis] - origin[axis]) / delta[axis]
    let t2 = (max[axis] - origin[axis]) / delta[axis]
    if (t1 > t2) {
      const swap = t1
      t1 = t2
      t2 = swap
    }
    if (t1 > tmin) tmin = t1
    if (t2 < tmax) tmax = t2
    if (tmin > tmax) return false
  }
  return tmax >= 0 && tmin < 0.98
}

/**
 * Buildings and barrier panels stay as their own meshes so only the one
 * on the camera-to-hero ray fades. Fully solid objects stay in the opaque
 * pass; a fading one tests depth and does not write it, so the hero behind
 * it stays visible and the sort stays stable.
 */
function placeOccluder(
  scene: THREE.Scene,
  props: Record<string, Prep>,
  parent: THREE.Matrix4,
  key: string,
  x: number,
  y: number,
  z: number,
  rotY: number,
  dimX: number,
  dimY: number,
  dimZ: number,
  cast = true,
  groupName = '',
): void {
  const prep = props[key]
  if (!prep) return
  const obj = prep.object.clone(true)
  obj.position.set(x, y, z)
  obj.rotation.y = rotY
  obj.scale.set(dimX / Math.max(0.001, prep.size.x), dimY / Math.max(0.001, prep.size.y), dimZ / Math.max(0.001, prep.size.z))
  const localMats = new Map<THREE.Material, THREE.MeshLambertMaterial>()
  const mats: THREE.MeshLambertMaterial[] = []
  const meshes: THREE.Mesh[] = []
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const srcs = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const next = srcs.map((src) => {
      let copy = localMats.get(src)
      if (!copy) {
        const lambert = src as THREE.MeshLambertMaterial
        copy = lambert.clone()
        copy.onBeforeCompile = lambert.onBeforeCompile
        copy.customProgramCacheKey = lambert.customProgramCacheKey
        copy.transparent = false
        copy.opacity = 1
        copy.depthWrite = true
        copy.depthTest = true
        localMats.set(src, copy)
        mats.push(copy)
      }
      return copy
    })
    mesh.material = next.length === 1 ? next[0] : next
    mesh.castShadow = cast
    mesh.receiveShadow = cast
    mesh.renderOrder = 0
    if (groupName) mesh.name = groupName
    meshes.push(mesh)
  })
  const holder = new THREE.Object3D()
  holder.matrix.copy(parent)
  holder.matrixAutoUpdate = false
  holder.add(obj)
  scene.add(holder)
  holder.updateMatrixWorld(true)
  occluders.push({ meshes, mats, box: new THREE.Box3().setFromObject(holder), opacity: 1, hold: 0 })
}

function fadeBlockers(camera: THREE.Camera, x: number, z: number, dt: number, active: boolean): void {
  camera.updateMatrixWorld()
  rayOrigin.copy(camera.position)
  camera.getWorldDirection(rayForward)
  rayRight.crossVectors(rayForward, UP)
  if (rayRight.lengthSq() < 1e-6) rayRight.set(1, 0, 0)
  else rayRight.normalize()
  const samples: [number, number, number][] = [
    [x, 0.25, z],
    [x, 0.95, z],
    [x, 1.6, z],
    [x + rayRight.x * 0.38, 0.95, z + rayRight.z * 0.38],
    [x - rayRight.x * 0.38, 0.95, z - rayRight.z * 0.38],
  ]
  const step = (Math.max(0, dt) / FADE_SECONDS) * (1 - FADE_OPACITY)
  for (const item of occluders) {
    let hit = false
    if (active) {
      const pad = item.hold > 0 || item.opacity < 0.98 ? 0.32 : 0.08
      for (const [sx, sy, sz] of samples) {
        if (segmentHits(rayOrigin.x, rayOrigin.y, rayOrigin.z, sx, sy, sz, item.box, pad)) {
          hit = true
          break
        }
      }
    }
    if (hit) item.hold = 0.12
    else item.hold = Math.max(0, item.hold - dt)
    const blocked = hit || item.hold > 0
    if (blocked) item.opacity = Math.max(FADE_OPACITY, item.opacity - step)
    else item.opacity = Math.min(1, item.opacity + step)
    const solid = item.opacity > 0.999 && !blocked
    const see = !solid
    for (const mat of item.mats) {
      mat.opacity = solid ? 1 : item.opacity
      if (mat.transparent !== see) {
        mat.transparent = see
        mat.depthWrite = !see
      }
    }
    const order = see ? 1 : 0
    for (const mesh of item.meshes) {
      if (mesh.renderOrder !== order) mesh.renderOrder = order
    }
  }
}

function place(
  props: Record<string, Prep>,
  baker: Baker,
  parent: THREE.Matrix4,
  key: string,
  x: number,
  y: number,
  z: number,
  rot: number,
  dx: number,
  dy: number,
  dz: number,
): void {
  const prep = props[key]
  if (prep) stamp(prep, parent, x, y, z, rot, dx, dy, dz, baker)
}

function placeLive(
  scene: THREE.Scene,
  props: Record<string, Prep>,
  parent: THREE.Matrix4,
  key: string,
  x: number,
  y: number,
  z: number,
  rot: number,
  dx: number,
  dy: number,
  dz: number,
): void {
  const prep = props[key]
  if (!prep) return
  const obj = prep.object.clone(true)
  obj.position.set(x, y, z)
  obj.rotation.y = rot
  obj.scale.set(dx / Math.max(0.001, prep.size.x), dy / Math.max(0.001, prep.size.y), dz / Math.max(0.001, prep.size.z))
  const holder = new THREE.Group()
  holder.add(obj)
  holder.applyMatrix4(parent)
  holder.updateMatrixWorld(true)
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const baked = mesh.clone()
    baked.matrix.copy(mesh.matrixWorld)
    baked.matrix.decompose(baked.position, baked.quaternion, baked.scale)
    baked.matrixAutoUpdate = true
    baked.castShadow = false
    baked.receiveShadow = false
    scene.add(baked)
  })
}

/** KayKit City Builder Bits shells, one complete mesh each. A–H. */
const STREET_BUILDINGS = [
  'building_A_withoutBase',
  'building_B_withoutBase',
  'building_C_withoutBase',
  'building_D_withoutBase',
  'building_E_withoutBase',
  'building_F_withoutBase',
  'building_G_withoutBase',
  'building_H_withoutBase',
] as const

/** Native height. A and B are the short pair, H is the tall house. */
const STREET_NATIVE_H = [1.55, 1.55, 2.25, 2.25, 2.25, 2.25, 2.25, 2.95]

/** Native Z bounds. Every shell's street wall sits at z = 0.6, ahead of some awnings. */
const STREET_Z: [number, number][] = [
  [-0.65, 0.8],
  [-0.65, 0.65],
  [-0.65, 0.65],
  [-0.65, 0.65],
  [-0.65, 0.8],
  [-0.65, 0.65],
  [-0.65, 0.8],
  [-0.65, 0.65],
]

const STREET_WALL_Z = 0.6
const STREET_REF_H = 2.25
/** World height of the common 2.25 shells. Short and tall shells keep the native ratio. */
const STREET_WALL_H = COMMON_WALL_H
/** Shared footprint depth. Grows outward from the street wall, which stays put. */
const STREET_DEPTH = 2.35 * PERIMETER_SCALE

/** Stable pick in 0..7. Neighbors may match; the mix is the same on every load. */
function streetBuilding(index: number): number {
  let h = Math.imul(index + 1, 0x9e3779b1) ^ 0xc17b41d5
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) % STREET_BUILDINGS.length
}

/** Distance from the mesh center to the street wall, after scaling to `depth`. */
function wallShift(kind: number, depth: number): number {
  const [z0, z1] = STREET_Z[kind]
  const center = (z0 + z1) / 2
  return ((STREET_WALL_Z - center) / (z1 - z0)) * depth
}

/**
 * G is two townhouses with a vertical step on the street face. A pier in that
 * joint uses the pack atlas so the row stays a solid wall.
 * Coordinates are prepared space: y up from the base, xz centered on the mesh.
 */
/** The shared city-bits atlas. A little anisotropy keeps the larger facades sharp at a slant. */
function sharpenBuildingMaps(props: Record<string, Prep>): void {
  const seen = new Set<THREE.Texture>()
  for (const name of STREET_BUILDINGS) {
    const prep = props[name]
    if (!prep) continue
    prep.object.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of mats) {
        const lambert = mat as THREE.MeshLambertMaterial
        for (const map of [lambert.map, lambert.emissiveMap]) {
          if (!map || seen.has(map)) continue
          seen.add(map)
          map.anisotropy = 8
          map.magFilter = THREE.LinearFilter
          map.minFilter = THREE.LinearMipmapLinearFilter
          map.generateMipmaps = true
          map.needsUpdate = true
        }
      }
    })
  }
}

function sealTownhouseSlot(prep: Prep): void {
  let material: THREE.Material | null = null
  prep.object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.isMesh && material == null) material = mesh.material as THREE.Material
  })
  if (!material) return
  const geo = new THREE.BoxGeometry(0.22, 2.25, 0.32)
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute
  // Green cell on citybits_texture.png, matching the recessed half. glTF v = 0 is the top.
  const u = 320 / 1024
  const v = 560 / 1024
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u, v)
  const panel = new THREE.Mesh(geo, material)
  // Prepared space. The open joint sits just past x = 0.2, between the forward wall (z 0.525) and the set-back half.
  panel.position.set(0.3, 1.125, 0.34)
  prep.object.add(panel)
}

function dressBlock(
  block: AlleyBlock,
  index: number,
  props: Record<string, Prep>,
  scene: THREE.Scene,
  towardX: number,
  towardZ: number,
): void {
  const kind = streetBuilding(index)
  const matrix = faceToward(block.x, block.z, towardX, towardZ, block.lean)
  const height = (STREET_NATIVE_H[kind] / STREET_REF_H) * STREET_WALL_H
  const depth = STREET_DEPTH
  const faceZ = block.d / 2 + 0.02
  placeOccluder(scene, props, matrix, STREET_BUILDINGS[kind], 0, 0, faceZ - wallShift(kind, depth), 0, block.w, height, depth)
}

/** Eight shells at the wall's scale, facing the isometric camera. `?lineup=1` only. */
function layModelRow(props: Record<string, Prep>, baker: Baker): void {
  const width = 2.6 * PERIMETER_SCALE
  const step = 2.72
  // Screen-right for the play camera, which sits on the +X/+Z diagonal.
  const rx = 0.7071
  const rz = -0.7071
  for (let kind = 0; kind < STREET_BUILDINGS.length; kind++) {
    const height = (STREET_NATIVE_H[kind] / STREET_REF_H) * STREET_WALL_H
    const along = (kind - 3.5) * step
    const x = along * rx
    const z = -1.6 + along * rz
    const matrix = faceToward(x, z, x + 1, z + 1)
    place(props, baker, matrix, STREET_BUILDINGS[kind], 0, 0, -wallShift(kind, STREET_DEPTH), 0, width, height, STREET_DEPTH)
  }
}

/**
 * Dark brick column on citybits_texture.png. GLTFLoader leaves flipY false,
 * so WebGL v is image y over the atlas height (v = 0 is the top of the png).
 */
function atlasV(imageY: number): number {
  return imageY / 1024
}

function brickGeometry(w: number, h: number, d: number, imageY0: number, imageY1: number): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(w, h, d)
  const u0 = 780 / 1024
  const u1 = 880 / 1024
  const vTop = atlasV(imageY0)
  const vBottom = atlasV(imageY1)
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute
  for (let face = 0; face < 6; face++) {
    const i = face * 4
    uv.setXY(i, u0, vTop)
    uv.setXY(i + 1, u1, vTop)
    uv.setXY(i + 2, u0, vBottom)
    uv.setXY(i + 3, u1, vBottom)
  }
  return geo
}

/** One low wall. The plain one is a single course; the other wears a lighter cap. Both fill the whole footprint. */
function makeBrickPrep(capped: boolean, material: THREE.Material): Prep {
  const wrap = new THREE.Group()
  if (!capped) {
    // Dark column, lighter at the top so the course reads as weathered.
    const mesh = new THREE.Mesh(brickGeometry(1, 1, 1, 72, 248), material)
    mesh.position.y = 0.5
    wrap.add(mesh)
    return { object: wrap, size: new THREE.Vector3(1, 1, 1) }
  }
  const bodyH = 0.78
  const capH = 0.22
  // Same width and depth as the plain wall. A shorter body used to leave a slot at each end.
  const body = new THREE.Mesh(brickGeometry(1, bodyH, 1, 184, 248), material)
  body.position.y = bodyH / 2
  const capMat = (material as THREE.MeshLambertMaterial).clone()
  capMat.polygonOffset = true
  capMat.polygonOffsetFactor = -1.5
  capMat.polygonOffsetUnits = -1.5
  // Coping from the lighter end of the same brick column. It shares the body's footprint and overlaps it by a centimeter so the seam does not flicker.
  const cap = new THREE.Mesh(brickGeometry(1, capH + 0.02, 1, 8, 56), material)
  cap.material = capMat
  cap.position.y = bodyH + (capH + 0.02) / 2 - 0.01
  wrap.add(body, cap)
  return { object: wrap, size: new THREE.Vector3(1, 1, 1) }
}

function cityBitsMap(props: Record<string, Prep>): THREE.Texture | null {
  const prep = props.building_C_withoutBase
  if (!prep) return null
  let found: THREE.Texture | null = null
  prep.object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh || found) return
    const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshLambertMaterial
    if (mat.map) found = mat.map
  })
  return found
}

function installBrickWalls(props: Record<string, Prep>): void {
  const map = cityBitsMap(props)
  if (!map) return
  const material = new THREE.MeshLambertMaterial({
    map,
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveMap: map,
    emissiveIntensity: 0.42,
    side: THREE.DoubleSide,
  })
  addRim(material)
  props['brick-plain'] = makeBrickPrep(false, material)
  props['brick-cap'] = makeBrickPrep(true, material)
}

/** Round cap at a building joint. Slim enough to leave the facade, thick enough to close the corner. */
const PILLAR_R = 0.18
const PILLAR_SEG = 12
/**
 * Native X of the side the alley meets, and the centered bbox half it sits inside.
 * The side is 3.4mm inside the box on every shell, including G's outer corners.
 */
const STREET_BOX_HALF = [0.60336983, 0.80336983, 0.60336983, 0.80336983, 1.00336983, 1.00336983, 1.00336983, 1.00336983]
const STREET_SIDE = [0.6, 0.8, 0.6, 0.8, 1, 1, 1, 1]

function brickRibbon(pts: { x: number; z: number }[], y0: number, y1: number, imageY0: number, imageY1: number): THREE.BufferGeometry {
  const u0 = 780 / 1024
  const u1 = 880 / 1024
  const vTop = atlasV(imageY0)
  const vBottom = atlasV(imageY1)
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const sAt: number[] = [0]
  for (let i = 1; i < pts.length; i++) {
    sAt.push(sAt[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z))
  }
  const total = Math.max(0.001, sAt[sAt.length - 1])
  const uAt = (s: number) => u0 + (u1 - u0) * (s / total)
  const add = (x: number, y: number, z: number, s: number, v: number) => {
    pos.push(x, y, z)
    uv.push(uAt(s), v)
    return pos.length / 3 - 1
  }
  const quad = (a: number, b: number, c: number, d: number) => {
    idx.push(a, b, c, a, c, d)
  }
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    add(p.x, y0, p.z, sAt[i], vBottom)
    add(p.x, y1, p.z, sAt[i], vTop)
    add(p.x, y0, p.z + BARRIER_D, sAt[i], vBottom)
    add(p.x, y1, p.z + BARRIER_D, sAt[i], vTop)
    if (i === 0) continue
    const a = (i - 1) * 4
    const b = i * 4
    // Street toward the court, back into the alley, top upward.
    quad(a, b, b + 1, a + 1)
    quad(a + 2, b + 2, b + 3, a + 3)
    quad(a + 1, a + 3, b + 3, b + 1)
  }
  const last = (pts.length - 1) * 4
  quad(0, 2, 3, 1)
  quad(last, last + 1, last + 3, last + 2)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

/** Round pier. Side uses the same brick column; the top is a flat cap of that column. */
function brickPillar(radius: number, y0: number, y1: number, imageY0: number, imageY1: number): THREE.BufferGeometry {
  const u0 = 780 / 1024
  const u1 = 880 / 1024
  const vTop = atlasV(imageY0)
  const vBottom = atlasV(imageY1)
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const add = (x: number, y: number, z: number, u: number, v: number) => {
    pos.push(x, y, z)
    uv.push(u, v)
    return pos.length / 3 - 1
  }
  const bot: number[] = []
  const top: number[] = []
  for (let i = 0; i <= PILLAR_SEG; i++) {
    const a = (i / PILLAR_SEG) * Math.PI * 2
    const x = Math.cos(a) * radius
    const z = Math.sin(a) * radius
    const u = u0 + (u1 - u0) * (i / PILLAR_SEG)
    bot.push(add(x, y0, z, u, vBottom))
    top.push(add(x, y1, z, u, vTop))
  }
  for (let i = 0; i < PILLAR_SEG; i++) {
    idx.push(bot[i], top[i], top[i + 1], bot[i], top[i + 1], bot[i + 1])
  }
  const cap = add(0, y1, 0, (u0 + u1) / 2, (vTop + vBottom) / 2)
  for (let i = 0; i < PILLAR_SEG; i++) idx.push(cap, top[i], top[i + 1])
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

type Gap = (typeof SLUM_GAPS)[number]

/** Visual footprint of one shell in gap-local along / outward. */
function meshFootprint(gap: Gap, block: AlleyBlock, index: number): { a0: number; a1: number; o0: number; o1: number } {
  const kind = streetBuilding(index)
  const [z0, z1] = STREET_Z[kind]
  const scaleZ = STREET_DEPTH / (z1 - z0)
  const half = STREET_SIDE[kind] * (block.w / (2 * STREET_BOX_HALF[kind]))
  const faceZ = block.d / 2 + 0.02
  const front = faceZ + (z1 - STREET_WALL_Z) * scaleZ
  const back = faceZ + (z0 - STREET_WALL_Z) * scaleZ
  const byaw = Math.atan2((block.faceX ?? block.x) - block.x, (block.faceZ ?? block.z) - block.z)
  const c = Math.cos(byaw)
  const s = Math.sin(byaw)
  const gyaw = Math.atan2(gap.ox, gap.oz)
  const xx = Math.cos(gyaw)
  const xz = -Math.sin(gyaw)
  const origin = gap.x * xx + gap.z * xz
  let a0 = Infinity
  let a1 = -Infinity
  let o0 = Infinity
  let o1 = -Infinity
  for (const lx of [-half, half]) {
    for (const lz of [back, front]) {
      const wx = block.x + lx * c + lz * s
      const wz = block.z - lx * s + lz * c
      const a = wx * xx + wz * xz - origin
      const o = (wx - gap.x) * gap.ox + (wz - gap.z) * gap.oz
      if (a < a0) a0 = a
      if (a > a1) a1 = a
      if (o < o0) o0 = o
      if (o > o1) o1 = o
    }
  }
  return { a0, a1, o0, o1 }
}

/** Along of the visual side a hooked end meets. Falls back a few millimetres inside the box. */
function hookEdge(gap: Gap, dir: -1 | 1, aabbEdge: number): number {
  let edge = aabbEdge + dir * 0.007
  let best = 0.05
  for (let i = 0; i < SLUM_BLOCKS.length; i++) {
    const block = SLUM_BLOCKS[i]
    const fp = meshFootprint(gap, block, i)
    if (fp.o0 > 0.8 || fp.o1 < 0) continue
    const face = dir < 0 ? fp.a1 : fp.a0
    const dist = Math.abs(face - aabbEdge)
    if (dist < best) {
      best = dist
      edge = face
    }
  }
  return edge
}

/**
 * Along of a corner shell's outer face, when that face actually meets this
 * end. Openings, the gate, and buildings further down the alley return null.
 */
function cornerFace(gap: Gap, at: number, dir: -1 | 1): number | null {
  if (!cornerPier(gap, at, dir)) return null
  const spanEnd = dir < 0 ? -gap.span / 2 : gap.span / 2
  const clamped = Math.abs(at - spanEnd) > 0.05
  let edge: number | null = null
  let best = 1.7
  for (let i = 0; i < SLUM_BLOCKS.length; i++) {
    const block = SLUM_BLOCKS[i]
    const fp = meshFootprint(gap, block, i)
    if (fp.o0 > 0.55 || fp.o1 < 0.05) continue
    if (fp.a1 - fp.a0 < 0.4) continue
    const face = dir < 0 ? fp.a1 : fp.a0
    const dist = (face - at) * dir
    if (dist < -1.65 || dist > 0.7) continue
    if (clamped && dist > 0.02) continue
    const score = Math.abs(dist)
    if (score < best) {
      best = score
      edge = face
    }
  }
  return edge
}

/** Mild depth bias so the cap wins the wall overlap and still loses to the facade. */
function pierMat(src: THREE.MeshLambertMaterial): THREE.MeshLambertMaterial {
  const copy = cloneBrick(src, true)
  copy.polygonOffsetFactor = -0.5
  copy.polygonOffsetUnits = -0.5
  return copy
}

function cloneBrick(src: THREE.MeshLambertMaterial, offset: boolean): THREE.MeshLambertMaterial {
  const copy = src.clone()
  copy.onBeforeCompile = src.onBeforeCompile
  copy.customProgramCacheKey = src.customProgramCacheKey
  copy.transparent = false
  copy.opacity = 1
  copy.depthWrite = true
  copy.depthTest = true
  if (offset) {
    copy.polygonOffset = true
    copy.polygonOffsetFactor = -1.5
    copy.polygonOffsetUnits = -1.5
  }
  return copy
}

/** Where the wall and its half-piers sit for one gap. The flat of each pier is just off the shell. */
function barrierSeal(gap: Gap, fit: ReturnType<typeof barrierFit>): {
  left: number
  right: number
  piers: { x: number; bulge: 1 | -1; face: number }[]
} {
  let left = fit.left
  let right = fit.right
  const piers: { x: number; bulge: 1 | -1; face: number }[] = []
  const seat = (dir: -1 | 1, at: number, hooked: boolean) => {
    const face = hooked ? hookEdge(gap, dir, at - dir * BARRIER_TUCK) : cornerFace(gap, at, dir)
    if (face == null) return
    // Center sits one radius off the shell, so the round touches the face and stays outside it.
    const x = face - dir * PILLAR_R
    piers.push({ x, bulge: dir === -1 ? 1 : -1, face })
    if (dir < 0) left = face + 0.012
    else right = face - 0.012
  }
  seat(-1, fit.left, fit.leftHook)
  seat(1, fit.right, fit.rightHook)
  // An end with no pier can still run the wall through a shell. Stop on that face.
  const trim = (dir: -1 | 1) => {
    if (piers.some((p) => (dir < 0 ? p.bulge > 0 : p.bulge < 0))) return
    const endX = dir < 0 ? left : right
    let face: number | null = null
    let best = 2.2
    for (let i = 0; i < SLUM_BLOCKS.length; i++) {
      const fp = meshFootprint(gap, SLUM_BLOCKS[i], i)
      if (fp.o0 > 0.45 || fp.o1 < 0.1) continue
      const near = dir < 0 ? fp.a1 : fp.a0
      const inside = dir < 0 ? endX < near - 0.02 && endX > fp.a0 + 0.02 : endX > near + 0.02 && endX < fp.a1 - 0.02
      if (!inside) continue
      const score = Math.abs(endX - near)
      if (score < best) {
        best = score
        face = near
      }
    }
    if (face == null) return
    const x = face - dir * PILLAR_R
    piers.push({ x, bulge: dir === -1 ? 1 : -1, face })
    if (dir < 0) left = face + 0.012
    else right = face - 0.012
  }
  trim(-1)
  trim(1)
  if (right - left < 0.08) {
    const mid = (fit.left + fit.right) / 2
    left = mid - 0.04
    right = mid + 0.04
  }
  return { left, right, piers }
}

/** Straight course, plus a round pier wherever an end meets a building. */
function placeSealedBarrier(
  scene: THREE.Scene,
  props: Record<string, Prep>,
  parent: THREE.Matrix4,
  gap: (typeof SLUM_GAPS)[number],
  capped: boolean,
  fit: ReturnType<typeof barrierFit>,
): void {
  const prep = props[capped ? 'brick-cap' : 'brick-plain']
  if (!prep) return
  let source: THREE.MeshLambertMaterial | null = null
  prep.object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.isMesh && source == null) source = mesh.material as THREE.MeshLambertMaterial
  })
  if (!source) return
  const zWall = BARRIER_FACE + BARRIER_RECESS
  // Court face sits a few millimetres behind the facade and in front of the
  // wall, so the round meets the corner without crossing the shell.
  // Contact line sits just behind the facade, so the round meets the corner
  // and its court face stays in the gap rather than inside the shell.
  const pierZ = BARRIER_FACE + 0.02
  const { left, right, piers } = barrierSeal(gap, fit)
  const pts = [
    { x: left, z: zWall },
    { x: right, z: zWall },
  ]
  const holder = new THREE.Object3D()
  holder.matrix.copy(parent)
  holder.matrixAutoUpdate = false
  const meshes: THREE.Mesh[] = []
  const mats: THREE.MeshLambertMaterial[] = []
  const addMesh = (geo: THREE.BufferGeometry, mat: THREE.MeshLambertMaterial, x = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, 0, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.name = 'brick-barrier'
    holder.add(mesh)
    meshes.push(mesh)
    mats.push(mat)
  }
  if (!capped) {
    addMesh(brickRibbon(pts, 0, BARRIER_H, 72, 248), cloneBrick(source, false))
    for (const pier of piers) addMesh(brickPillar(PILLAR_R, 0, BARRIER_H, 72, 248), pierMat(source), pier.x, pierZ)
  } else {
    const bodyH = BARRIER_H * 0.78
    const capH = BARRIER_H * 0.22
    addMesh(brickRibbon(pts, 0, bodyH, 184, 248), cloneBrick(source, false))
    addMesh(brickRibbon(pts, bodyH - 0.01, bodyH + capH + 0.01, 8, 56), cloneBrick(source, true))
    for (const pier of piers) {
      addMesh(brickPillar(PILLAR_R, 0, bodyH, 184, 248), pierMat(source), pier.x, pierZ)
      addMesh(brickPillar(PILLAR_R, bodyH - 0.01, bodyH + capH + 0.01, 8, 56), cloneBrick(source, true), pier.x, pierZ)
    }
  }
  scene.add(holder)
  holder.updateMatrixWorld(true)
  occluders.push({ meshes, mats, box: new THREE.Box3().setFromObject(holder), opacity: 1, hold: 0 })
}

/** Local +Z points out of the court, onto the facade line. */
function dressGaps(scene: THREE.Scene, props: Record<string, Prep>, baker: Baker, sprites: [number, number, number][]): void {
  const propsByKind: [string, number, number, number][] = [
    ['crate', 0.48, 0.4, 0.44],
    ['barrel', 0.4, 0.52, 0.4],
  ]
  for (const gap of SLUM_GAPS) {
    const matrix = faceToward(gap.x, gap.z, gap.x + gap.ox, gap.z + gap.oz)
    const fit = barrierFit(gap)
    placeSealedBarrier(scene, props, matrix, gap, gap.kind === 1, fit)
    const [clutter, dx, dy, dz] = propsByKind[gap.kind]
    place(props, baker, matrix, clutter, gap.span * 0.2, 0, 1.6, 0, dx, dy, dz)
    const lampKey = gap.kind === 0 ? 'lantern' : 'lantern_standing'
    place(props, baker, matrix, lampKey, -gap.span * 0.18, 0, 2.4, 0, 0.26, 1.15, 0.26)
    const yaw = Math.atan2(gap.ox, gap.oz)
    const lx = -gap.span * 0.18
    const lz = 2.4
    sprites.push([
      gap.x + Math.sin(yaw) * lz + Math.cos(yaw) * lx,
      1.25,
      gap.z + Math.cos(yaw) * lz - Math.sin(yaw) * lx,
    ])
  }
}

function dressAlley(scene: THREE.Scene, blocks: AlleyBlock[], props: Record<string, Prep>): void {
  const baker = new Baker()
  const gapLights: [number, number, number][] = []
  occluders.length = 0
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    dressBlock(block, i, props, scene, block.faceX ?? 0, block.faceZ ?? 0)
  }
  if (new URLSearchParams(location.search).has('lineup')) layModelRow(props, baker)
  dressGaps(scene, props, baker, gapLights)

  const world = new THREE.Matrix4()
  // Walkable streets, alleys, and pockets stay empty. Crates and lamps behind
  // the brick gaps are placed in dressGaps, outside the court.
  placeLive(scene, props, world, 'Door_1', SLUM_GATE.x, 0, SLUM_GATE.z, -Math.PI / 2, 0.78, 1.45, 0.16)
  placeLive(scene, props, world, 'DoorFrame_Wooden', SLUM_GATE.x - 0.04, 0, SLUM_GATE.z, -Math.PI / 2, 1.05, 1.7, 0.22)
  const signHosts = blocks.filter((block) => Math.hypot(block.x, block.z) < 12 && block.d < 2.25).slice(0, 3)
  const signKeys = ['sign-1', 'sign-2', 'sign-3']
  signHosts.forEach((block, index) => {
    placeLive(
      scene,
      props,
      faceToward(block.x, block.z, block.faceX ?? 0, block.faceZ ?? 0, block.lean),
      signKeys[index],
      index === 1 ? 0.2 : -0.12,
      1.7 + index * 0.15,
      block.d / 2 + 0.18,
      0,
      0.9,
      0.42,
      0.06,
    )
  })

  baker.flush(scene)
  lampSprites(scene, gapLights, 'rgba(255,186,90,0.75)', 0.62)
}

function dressMob(scene: THREE.Scene, props: Record<string, Prep>): void {
  const baker = new Baker()
  MOB_BLOCKS.forEach((block, index) => dressBlock(block, index + 3, props, scene, 0, MOB_Z))
  const world = new THREE.Matrix4()
  for (const car of MOB_CARS) {
    place(props, baker, world, car.key, car.x, 0, car.z, car.rot, 2.2, 1.12, 1.08)
  }
  place(props, baker, world, 'detail-dumpster-closed', 4.2, 0, MOB_Z + 1.15, 0.8, 1.2, 1.0, 0.8)
  place(props, baker, world, 'crate', -3.4, 0, MOB_Z + 1.4, 0.4, 0.6, 0.5, 0.6)
  place(props, baker, world, 'barrel', 3.5, 0, MOB_Z - 0.4, 0.2, 0.5, 0.7, 0.5)
  place(props, baker, world, 'burger', -4.15, 0, MOB_Z - 2.15, 0.4, 0.28, 0.16, 0.28)
  place(props, baker, world, 'road-asphalt-straight', 0.15, 0, MOB_Z - 1.2, 0, 3.2, 0.08, 5.5)
  place(props, baker, world, 'road-asphalt-damaged', -0.2, 0, MOB_Z + 2.4, 0.1, 2.8, 0.08, 3.4)
  for (const [x, z] of [
    [-3.15, MOB_Z - 0.35],
    [3.35, MOB_Z + 0.15],
    [0.15, MOB_Z - 4.7],
  ] as const) {
    place(props, baker, world, 'detail-light-double', x, 0, z, 0.2, 0.55, 3.05, 0.55)
    place(props, baker, world, 'light-curved', x + 1.15, 0, z + 0.4, 0.6, 0.45, 3.2, 0.45)
  }
  const diner = MOB_BLOCKS[0]
  place(props, baker, faceToward(diner.x, diner.z, 0, MOB_Z, diner.lean), 'lights-colored', 0, 1.85, diner.d / 2 + 0.15, 0, 2.2, 0.28, 0.2)
  baker.flush(scene)
  lampSprites(scene, [
    [-3.15, 2.7, MOB_Z - 0.35],
    [3.35, 2.7, MOB_Z + 0.15],
    [0.15, 2.65, MOB_Z - 4.7],
  ], 'rgba(120,210,255,0.85)')
}

function lampSprites(scene: THREE.Scene, spots: [number, number, number][], inner: string, scale = 1.2): void {
  const spriteMat = new THREE.SpriteMaterial({
    map: glowDisc(inner),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  for (const [x, y, z] of spots) {
    const sprite = new THREE.Sprite(spriteMat)
    sprite.position.set(x, y, z)
    sprite.scale.set(scale, scale, 1)
    scene.add(sprite)
  }
}

function glowDisc(inner = 'rgba(255,186,90,0.9)'): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32)
  grd.addColorStop(0, inner)
  grd.addColorStop(1, 'rgba(255,120,40,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export async function loadKenney(): Promise<KenneyLib> {
  const grave = 'kenney/graveyard-kit'
  const town = 'kenney/fantasy-town-kit'
  const retro = 'kenney/retro-urban-kit'
  const roads = 'kenney/city-kit-roads'
  const plat = 'kenney/platformer-kit'
  const cars = 'kenney/car-kit'
  const food = 'kenney/food-kit'
  const pets = 'kenney/cube-pets'
  const holiday = 'kenney/holiday-kit'
  const blocky = 'kenney/blocky-characters'
  const [graveMap, zombie, ghost, vampire, suitB, suitE, suitH, kay, ratT, batT, uni] = await Promise.all([
    loadTexture(`${grave}/Textures/colormap.png`),
    loadActor(`${grave}/character-zombie.glb`),
    loadActor(`${grave}/character-ghost.glb`),
    loadActor(`${grave}/character-vampire.glb`),
    loadActor(`${blocky}/character-b.glb`),
    loadActor(`${blocky}/character-e.glb`),
    loadActor(`${blocky}/character-h.glb`),
    loadKaykit(),
    loadCritter('cc0/quaternius-easy-enemies/rat.glb'),
    loadCritter('cc0/quaternius-animated-monsters/bat.glb'),
    loadCast(),
  ])
  const packs = await Promise.all([
    loadProps(
      ['fence', 'fence-damaged', 'iron-fence', 'lantern-candle', 'debris', 'debris-wood', 'rocks'].map((name) => `${grave}/${name}.glb`),
      0.42,
    ),
    loadProps(['lantern', 'cart'].map((name) => `${town}/${name}.glb`), 0.48),
    loadProps(
      [
        'wall-a',
        'wall-a-window',
        'wall-a-door',
        'wall-a-flat-window',
        'wall-a-painted',
        'wall-broken-type-a',
        'balcony-ladder-bottom',
        'balcony-ladder-top',
        'balcony-type-a',
        'detail-dumpster-open',
        'detail-dumpster-closed',
        'detail-light-single',
        'detail-light-double',
        'detail-awning-wide',
        'detail-bricks-type-a',
        'pallet',
        'wall-fence',
        'scaffolding-structure',
        'road-asphalt-straight',
        'road-asphalt-damaged',
      ].map((name) => `${retro}/${name}.glb`),
      0.5,
    ),
    loadProps(['light-curved', 'construction-fence'].map((name) => `${roads}/${name}.glb`), 0.5),
    loadProps(['crate', 'barrel', 'ladder'].map((name) => `${plat}/${name}.glb`), 0.55),
    loadProps(['sedan', 'taxi'].map((name) => `${cars}/${name}.glb`), 0.5),
    loadProps(['bag', 'soda-can', 'soda-can-crushed', 'burger'].map((name) => `${food}/${name}.glb`), 0.55),
    loadProps([`${pets}/animal-fox.glb`], 0.55),
    loadProps([`${holiday}/lights-colored.glb`], 0.7),
    loadProps(
      ['low-detail-building-a', 'low-detail-building-b', 'low-detail-building-c', 'low-detail-building-wide-a', 'detail-awning', 'detail-overhang'].map(
        (name) => `kenney/city-kit-commercial/${name}.glb`,
      ),
      0.48,
    ),
    loadProps(
      ['Brick_Inset_Window', 'Door_1', 'DoorFrame_Wooden', 'Prop_ACUnit', 'Prop_Bollard', 'Prop_Planter_Single', 'Prop_Drain'].map(
        (name) => `cc0/downtown/${name}.gltf`,
      ),
      0.46,
    ),
    loadProps(['sign-1', 'sign-2', 'sign-3'].map((name) => `cc0/${name}.glb`), 1.65),
    loadProps(
      ['candle', 'bone_A', 'gravestone', 'lantern_standing', 'skull_candle', 'tools-lantern'].map((name) => `cc0/kaykit/${name}.gltf`),
      0.55,
    ),
    loadProps(['Candle_1', 'Torch_Metal'].map((name) => `cc0/kaykit/props/${name}.gltf`), 0.5),
    loadProps(
      [
        'building_A_withoutBase',
        'building_B_withoutBase',
        'building_C_withoutBase',
        'building_D_withoutBase',
        'building_E_withoutBase',
        'building_F_withoutBase',
        'building_G_withoutBase',
        'building_H_withoutBase',
        'dumpster',
        'trash_A',
        'box_A',
        'bench',
        'firehydrant',
      ].map((name) => `cc0/city-bits/${name}.gltf`),
      0.42,
    ),
    loadProps(
      [
        'Wall_UnevenBrick_Straight',
        'Wall_UnevenBrick_Window_Wide_Flat',
        'Wall_Plaster_Straight',
        'Wall_Plaster_Window_Wide_Round',
        'Wall_Plaster_Door_Flat',
        'Roof_RoundTiles_4x4',
        'Stairs_Exterior_Straight',
        'Prop_Chimney',
        'Overhang_Plaster_Short',
      ].map((name) => `cc0/medieval/${name}.gltf`),
      0.4,
    ),
    loadProps(
      ['apo-wall-boarded', 'apo-wall-hole', 'apo-wall-window', 'apo-barrel', 'apo-planks', 'apo-tire', 'apo-box'].map(
        (name) => `cc0/apocalypse/${name}.glb`,
      ),
      0.38,
    ),
    // Quaternius Zombie Apocalypse Kit: only the props that fit a 1920s night (decor only).
    loadProps(
      ['Barrel', 'CinderBlock', 'Couch', 'Pallet', 'Pallet_Broken', 'Pipes', 'TrashBag_1', 'TrashBag_2', 'Wheels_Stack', 'WaterTower', 'Chest', 'Blood_1', 'Blood_2', 'Blood_3'].map(
        (name) => `cc0/quaternius-zombie-apocalypse/props/${name}.glb`,
      ),
      0.4,
    ),
  ])
  const props = Object.assign({}, ...packs) as Record<string, Prep>
  const townhouse = props.building_G_withoutBase
  if (townhouse) sealTownhouseSlot(townhouse)
  sharpenBuildingMaps(props)
  installBrickWalls(props)
  let driftCity: (dt: number) => void = () => {}
  return {
    decor: bakeDecor(props, DECOR_NAMES),
    rat: () => buildCritterRig(ratT, 0.42, { glow: 0.42, tint: 0x8a9a6a }),
    bat: () => buildFlyer(batT, 0.32),
    look: (name) => uni.look(name),
    fauna: (name) => uni.fauna(name),
    dress: (scene, blocks) => {
      dressAlley(scene, blocks, props)
      if (MOB_ARENA) dressMob(scene, props)
      driftCity = dressCity(scene, props, (key, x, z, yaw, w, h, d) => {
        const parent = new THREE.Matrix4().makeRotationY(yaw)
        parent.setPosition(x, 0, z)
        placeOccluder(scene, props, parent, key, 0, 0, 0, 0, w, h, d, false, 'city-block')
      })
    },
    fadeBlockers,
    drift: (dt) => driftCity(dt),
    hero: () => kay.hero(),
    hound: () => uni.hound(),
    walker: () => uni.walker(),
    thrall: () => uni.thrall(),
    spitter: () => buildActor(ghost, graveMap, LOOK.spitter),
    skeleton: () => kay.skeleton(),
    boss: () => buildActor(zombie, graveMap, LOOK.boss),
    thug: () => buildActor(suitH, graveMap, LOOK.thug),
    enforcer: () => buildActor(suitB, graveMap, LOOK.enforcer),
    don: () => buildActor(suitE, graveMap, LOOK.don),
    rival: (base, look) => {
      // The Alpha is a great wolf from Ultimate Animated Animals, on its own clips.
      if (base === 'fox') return uni.alpha()
      const template = { zombie, ghost, vampire, suitB, suitE, suitH }[base]
      const from = base.startsWith('suit') ? LOOK.don : base === 'ghost' ? LOOK.spitter : LOOK.boss
      return buildActor(template, graveMap, {
        ...from,
        fedora: false,
        shades: false,
        crown: false,
        cape: false,
        ...look,
        eyes: look.eyes ?? from.eyes,
        emissive: look.tint ?? from.emissive,
        emissiveIntensity: 0.18,
      })
    },
  }
}
