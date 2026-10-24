import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { KenneyAnimState, KenneyDriver, Rig } from './models'
import { addRim } from './polish'

/**
 * Quaternius pack-native creatures (pipeline N in CREDITS.md): each model
 * ships with its own skeleton and clips, and plays only those. Converted
 * from the packs' FBX to GLB (see CREDITS.md):
 *
 *   cc0/quaternius-easy-enemies/rat.glb        Easy Enemy Pack: the Rat King's litter
 *   cc0/quaternius-animated-monsters/bat.glb   Animated Monster Pack: the Bat Swarm
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

/** The packs' flat PBR colors, as the self-lit Lambert every actor uses, so they read at night and flash on a hit. */
function paint(model: THREE.Object3D, glow: number, tint: number | null): void {
  const cache = new Map<string, THREE.MeshLambertMaterial>()
  model.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const swap = (src: THREE.Material) => {
      const std = src as THREE.MeshStandardMaterial
      const key = `${std.name}|${std.color?.getHexString()}`
      let m = cache.get(key)
      if (!m) {
        const color = std.color ? std.color.clone() : new THREE.Color(0xffffff)
        if (tint != null) color.lerp(new THREE.Color(tint), 0.35)
        m = new THREE.MeshLambertMaterial({ color, emissive: color.clone(), emissiveIntensity: glow })
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
function sized(template: CritterTemplate, height: number, glow: number, tint: number | null): THREE.Group {
  const model = cloneSkinned(template.scene) as THREE.Group
  paint(model, glow, tint)
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
export function buildCritterRig(template: CritterTemplate, height: number, opts: { glow?: number; tint?: number } = {}): Rig {
  const root = new THREE.Group()
  const bob = new THREE.Group()
  root.add(bob)
  const model = sized(template, height, opts.glow ?? 0.35, opts.tint ?? null)
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
  const model = sized(template, height, 0.5, null)
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
