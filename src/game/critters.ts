import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { KenneyAnimState, KenneyDriver, Rig } from './models'
import { addRim } from './polish'

/**
 * Quaternius creatures and people, each on clips made for its own skeleton
 * (CREDITS.md has the pipelines).
 *
 * Pipeline N, pack-native clips, converted from the packs' FBX to GLB:
 *
 *   cc0/quaternius-easy-enemies/rat.glb        Easy Enemy Pack: the Rat King's litter
 *   cc0/quaternius-animated-monsters/bat.glb   Animated Monster Pack: the Bat Swarm
 *
 * Pipeline U, the Universal humanoid: Universal Base Characters bodies and
 * Modular Outfits, all on one skeleton, played by Universal Animation
 * Library 1 and 2 clips (cc0/quaternius-ual*, clips only, no mesh).
 */
export interface CritterTemplate {
  scene: THREE.Group
  /** Clips by short name: "RatArmature|Rat_Walk" is "walk". */
  clips: Map<string, THREE.AnimationClip>
}

function asset(path: string): string {
  return new URL(path, new URL(import.meta.env.BASE_URL, window.location.href)).href
}

export async function loadCritter(path: string): Promise<CritterTemplate> {
  const gltf = await new GLTFLoader().loadAsync(asset(path))
  // The FBX conversion writes inverse bind matrices in the FBX's own units, which shrinks the
  // skinned mesh to a point. Rebinding to the rest pose the nodes already hold puts it back.
  gltf.scene.updateMatrixWorld(true)
  gltf.scene.traverse((child) => {
    const mesh = child as THREE.SkinnedMesh
    if (mesh.isSkinnedMesh) mesh.bind(mesh.skeleton)
  })
  const clips = new Map<string, THREE.AnimationClip>()
  for (const clip of gltf.animations) clips.set(clip.name.split('|').pop()!.replace(/^[A-Za-z]+_/, '').toLowerCase(), clip)
  return { scene: gltf.scene, clips }
}

export interface PaintOpts {
  glow?: number
  tint?: number
  /** How far the colors lean to `tint`, 0–1. */
  tintK?: number
  /** Washes the color maps out toward white first, so a tint can turn green cloth white. */
  bleach?: number
  /** Eye glow, on the Universal bodies' eye material. */
  eyes?: number
}

const bleached = new Map<string, THREE.Texture>()

/** A copy of a color map, pulled toward its own gray and then toward white. */
function bleach(tex: THREE.Texture, k: number): THREE.Texture {
  const key = `${tex.uuid}|${k}`
  const hit = bleached.get(key)
  if (hit) return hit
  const image = tex.image as CanvasImageSource & { width: number; height: number }
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0)
  const px = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = px.data
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]
    const v = y + (255 - y) * k
    d[i] = d[i + 1] = d[i + 2] = v
  }
  ctx.putImageData(px, 0, 0)
  const out = new THREE.CanvasTexture(canvas)
  out.colorSpace = tex.colorSpace
  out.flipY = tex.flipY
  out.wrapS = tex.wrapS
  out.wrapT = tex.wrapT
  bleached.set(key, out)
  return out
}

/** The packs' PBR colors, as the self-lit Lambert every actor uses, so they read at night and flash on a hit. */
function paint(model: THREE.Object3D, opts: PaintOpts): void {
  const glow = opts.glow ?? 0.35
  const tint = opts.tint ?? null
  const cache = new Map<string, THREE.MeshLambertMaterial>()
  model.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const swap = (src: THREE.Material) => {
      const std = src as THREE.MeshStandardMaterial
      const key = `${std.name}|${std.color?.getHexString()}|${std.map?.uuid ?? ''}`
      let m = cache.get(key)
      if (!m) {
        const color = std.color ? std.color.clone() : new THREE.Color(0xffffff)
        const eyes = opts.eyes != null && /eye/i.test(std.name)
        if (tint != null && !eyes) color.lerp(new THREE.Color(tint), opts.tintK ?? 0.35)
        const map = std.map && opts.bleach && !eyes && !std.transparent ? bleach(std.map, opts.bleach) : std.map
        m = new THREE.MeshLambertMaterial({
          color,
          map,
          emissive: eyes ? new THREE.Color(opts.eyes) : color.clone(),
          emissiveMap: eyes ? null : map,
          emissiveIntensity: eyes ? 1.6 : glow,
          transparent: std.transparent,
          alphaTest: std.alphaTest,
          side: std.side,
        })
        m.userData.flashable = true
        addRim(m)
        cache.set(key, m)
      }
      return m
    }
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material)
    mesh.frustumCulled = false
  })
}

/** A copy of the creature, `height` tall, standing on y = 0 at its footprint's center. */
function sized(template: CritterTemplate, height: number, opts: PaintOpts): THREE.Group {
  const model = cloneSkinned(template.scene) as THREE.Group
  paint(model, opts)
  model.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(model)
  const k = height / Math.max(0.001, box.max.y - box.min.y)
  model.scale.multiplyScalar(k)
  model.updateWorldMatrix(true, true)
  box.setFromObject(model)
  const mid = box.getCenter(new THREE.Vector3())
  model.position.set(model.position.x - mid.x, model.position.y - box.min.y, model.position.z - mid.z)
  return model
}

/** Idle, walk, and run by how fast the actor moves; the attack clip scrubs with its swing. */
class CritterDriver implements KenneyDriver {
  private readonly idle: THREE.AnimationAction | null
  private readonly walk: THREE.AnimationAction | null
  private readonly run: THREE.AnimationAction | null
  private readonly attack: THREE.AnimationAction | null

  constructor(
    private readonly mixer: THREE.AnimationMixer,
    clips: Map<string, THREE.AnimationClip>,
  ) {
    const loop = (name: string) => {
      const clip = clips.get(name)
      if (!clip) return null
      const a = mixer.clipAction(clip)
      a.setLoop(THREE.LoopRepeat, Infinity)
      a.play()
      a.time = Math.random() * clip.duration
      return a
    }
    this.idle = loop('idle')
    this.walk = loop('walk')
    this.run = loop('run') ?? this.walk
    const atk = clips.get('attack')
    this.attack = atk ? mixer.clipAction(atk) : null
    if (this.attack) {
      this.attack.setLoop(THREE.LoopOnce, 1)
      this.attack.clampWhenFinished = true
      this.attack.play()
      this.attack.paused = true
      this.attack.setEffectiveWeight(0)
    }
  }

  update(state: KenneyAnimState): void {
    const gait = Math.max(0, Math.min(1, state.gait))
    const swinging = state.swing > 0 && state.swing < 1 && this.attack != null
    const w = swinging ? 0 : 1
    // Below a stroll it idles; a full chase is the run.
    const runK = Math.max(0, (gait - 0.55) / 0.45)
    this.idle?.setEffectiveWeight(w * (1 - Math.min(1, gait * 2)))
    this.walk?.setEffectiveWeight(w * Math.min(1, gait * 2) * (1 - runK))
    if (this.run !== this.walk) this.run?.setEffectiveWeight(w * Math.min(1, gait * 2) * runK)
    if (this.attack) {
      this.attack.setEffectiveWeight(swinging ? 1 : 0)
      if (swinging) this.attack.time = state.swing * this.attack.getClip().duration
    }
    this.mixer.update(state.dt)
  }
}

/** An enemy rig for a pack-native creature. Its limbs are its own bones; the Rig's limb groups stay empty. */
export function buildCritterRig(template: CritterTemplate, height: number, opts: PaintOpts = {}): Rig {
  const root = new THREE.Group()
  const bob = new THREE.Group()
  root.add(bob)
  const model = sized(template, height, opts)
  bob.add(model)
  const spare = () => {
    const g = new THREE.Group()
    bob.add(g)
    return g
  }
  root.userData.barY = height + 0.35
  return {
    root,
    bob,
    head: spare(),
    armL: spare(),
    armR: spare(),
    legL: spare(),
    legR: spare(),
    claws: [],
    drive: new CritterDriver(new THREE.AnimationMixer(model), template.clips),
    mats: {},
  }
}

/** A flyer that loops one clip, for effects like the Bat Swarm. */
export interface Flyer {
  object: THREE.Group
  mixer: THREE.AnimationMixer
}

export function buildFlyer(template: CritterTemplate, height: number, clip = 'flying'): Flyer {
  const object = new THREE.Group()
  const model = sized(template, height, { glow: 0.5 })
  object.add(model)
  const mixer = new THREE.AnimationMixer(model)
  const c = template.clips.get(clip)
  if (c) {
    const a = mixer.clipAction(c)
    a.play()
    a.time = Math.random() * c.duration
    a.timeScale = 1.2 + Math.random() * 0.3
  }
  return { object, mixer }
}

// ---------------------------------------------------------------- Pipeline U

/** A Universal humanoid model, as exported: no rebind needed. */
export async function loadHumanoid(path: string): Promise<THREE.Group> {
  return (await new GLTFLoader().loadAsync(asset(path))).scene
}

/** Every clip in the clip-only libraries, by its own name ("Zombie_Walk_Fwd_Loop"). */
export async function loadClips(...paths: string[]): Promise<Map<string, THREE.AnimationClip>> {
  const out = new Map<string, THREE.AnimationClip>()
  for (const gltf of await Promise.all(paths.map((p) => new GLTFLoader().loadAsync(asset(p))))) {
    for (const clip of gltf.animations) out.set(clip.name, clip)
  }
  return out
}

/** Which library clip plays each part of the driver. */
export interface ClipRoles {
  idle: string
  walk: string
  run: string
  attack: string
}

export function humanoid(scene: THREE.Group, library: Map<string, THREE.AnimationClip>, roles: ClipRoles): CritterTemplate {
  const clips = new Map<string, THREE.AnimationClip>()
  for (const [role, name] of Object.entries(roles)) {
    const clip = library.get(name)
    if (clip) clips.set(role, clip)
  }
  return { scene, clips }
}

const HEAD_BONES = new Set(['Head', 'neck_01'])

/**
 * The outfits come without heads, so this takes the base body's head (the
 * triangles skinned to the head and neck), its eyes, and its brows, and
 * binds them to the outfit's own skeleton: both are the same Universal rig.
 */
export function withHead(outfit: THREE.Group, body: THREE.Group): THREE.Group {
  const scene = cloneSkinned(outfit) as THREE.Group
  let host: THREE.SkinnedMesh | null = null
  scene.traverse((c) => {
    if (!host && (c as THREE.SkinnedMesh).isSkinnedMesh) host = c as THREE.SkinnedMesh
  })
  if (!host) return scene
  const into = host as THREE.SkinnedMesh
  const bones = new Map(into.skeleton.bones.map((b) => [b.name, b]))
  body.traverse((c) => {
    const src = c as THREE.SkinnedMesh
    if (!src.isSkinnedMesh) return
    const geo = /eye|brow/i.test(src.name) ? src.geometry : headOnly(src)
    if (!geo) return
    const mesh = new THREE.SkinnedMesh(geo, src.material)
    mesh.name = `${src.name}-head`
    const skeleton = new THREE.Skeleton(
      src.skeleton.bones.map((b) => bones.get(b.name) ?? into.skeleton.bones[0]),
      src.skeleton.boneInverses,
    )
    into.parent!.add(mesh)
    mesh.position.copy(src.position)
    mesh.quaternion.copy(src.quaternion)
    mesh.scale.copy(src.scale)
    mesh.bind(skeleton, src.bindMatrix)
  })
  return scene
}

/** The body's triangles whose corners all hang mostly from the head or neck. */
function headOnly(mesh: THREE.SkinnedMesh): THREE.BufferGeometry | null {
  const geo = mesh.geometry
  const index = geo.index
  const skinIndex = geo.getAttribute('skinIndex')
  const skinWeight = geo.getAttribute('skinWeight')
  if (!index || !skinIndex || !skinWeight) return null
  const head = new Set(mesh.skeleton.bones.flatMap((b, i) => (HEAD_BONES.has(b.name) ? [i] : [])))
  const onHead = (v: number) => {
    let best = 0
    let bone = -1
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(v, k)
      if (w > best) {
        best = w
        bone = skinIndex.getComponent(v, k)
      }
    }
    return head.has(bone)
  }
  const keep: number[] = []
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i)
    const b = index.getX(i + 1)
    const c = index.getX(i + 2)
    if (onHead(a) && onHead(b) && onHead(c)) keep.push(a, b, c)
  }
  if (!keep.length) return null
  const out = geo.clone()
  out.setIndex(keep)
  out.clearGroups()
  return out
}

/** One of a few templates, at random, so a pod is not all one person. */
function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

/**
 * The Universal cast. Walkers and feral thralls are bare base bodies;
 * the Cathedral's hunters and zealots wear the Ranger and Peasant outfits.
 */
export async function loadUniversal(): Promise<Record<'walker' | 'thrall' | 'hunter' | 'zealot', () => Rig>> {
  const [male, female, rangerM, rangerF, peasantM, peasantF, library] = await Promise.all([
    loadHumanoid('cc0/quaternius-base-characters/body-male.glb'),
    loadHumanoid('cc0/quaternius-base-characters/body-female.glb'),
    loadHumanoid('cc0/quaternius-outfits-fantasy/ranger-male.glb'),
    loadHumanoid('cc0/quaternius-outfits-fantasy/ranger-female.glb'),
    loadHumanoid('cc0/quaternius-outfits-fantasy/peasant-male.glb'),
    loadHumanoid('cc0/quaternius-outfits-fantasy/peasant-female.glb'),
    loadClips('cc0/quaternius-ual/ual-clips.glb', 'cc0/quaternius-ual2/ual2-clips.glb'),
  ])
  const shamble: ClipRoles = { idle: 'Zombie_Idle_Loop', walk: 'Zombie_Walk_Fwd_Loop', run: 'Zombie_Walk_Fwd_Loop', attack: 'Zombie_Scratch' }
  const prowl: ClipRoles = { idle: 'Crouch_Idle_Loop', walk: 'Crouch_Fwd_Loop', run: 'Sprint_Loop', attack: 'Zombie_Scratch' }
  const brawl: ClipRoles = { idle: 'Idle_Loop', walk: 'Walk_Loop', run: 'Jog_Fwd_Loop', attack: 'Melee_Hook' }
  const march: ClipRoles = { idle: 'Idle_Loop', walk: 'Walk_Formal_Loop', run: 'Sprint_Loop', attack: 'Punch_Jab' }
  const cast = (models: THREE.Group[], roles: ClipRoles) => models.map((m) => humanoid(m, library, roles))
  const walkers = cast([male, female], shamble)
  const thralls = cast([male, female], prowl)
  const hunters = cast([withHead(rangerM, male), withHead(rangerF, female)], brawl)
  const zealots = cast([withHead(peasantM, male), withHead(peasantF, female)], march)
  const rig = (from: CritterTemplate[], height: number, opts: PaintOpts) => () => buildCritterRig(pick(from), height, opts)
  return {
    walker: rig(walkers, 2.05, { glow: 0.5, tint: 0x6f9a48, tintK: 0.7, bleach: 0.1, eyes: 0xc8ff5a }),
    thrall: rig(thralls, 2.1, { glow: 0.5, tint: 0xc8bcd8, tintK: 0.5, bleach: 0.35, eyes: 0xff2420 }),
    hunter: rig(hunters, 2.25, { glow: 0.45, tint: 0xf4eee0, tintK: 0.3, bleach: 0.45 }),
    zealot: rig(zealots, 2.15, { glow: 0.45, tint: 0x8a2a2a, tintK: 0.3 }),
  }
}
