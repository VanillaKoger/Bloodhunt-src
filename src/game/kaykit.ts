import * as THREE from 'three'
import { addRim } from './polish'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { KenneyAnimState, KenneyDriver, Rig } from './models'

/**
 * Free-tier KayKit characters on the shared Rig_Medium skeleton.
 * The vampire is the Adventurers mage: pale head, solid red cape, a right-hand dagger.
 * Ghouls are the skeleton minion on the same clips.
 */

export interface KaykitCast {
  hero(): Rig
  ghoul(): Rig
}

const UP = new THREE.Vector3(0, 1, 0)
/** About 12% under the previous mage scale, so the hero reads a little smaller. */
const HERO_SCALE = 0.88
/** Head bone only. Body scale stays at HERO_SCALE. */
const HEAD_SCALE = 0.93

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

/**
 * Melee_1H_Attack_Stab draws back through the first 38%, then the arm
 * drives through around 52–62%. The hit is registered at attack u=0.48, so
 * the thrust is pulled onto that instant and the rest stays draw / recovery.
 */
function stabTime(u: number, duration: number): number {
  let k: number
  if (u < 0.36) k = (u / 0.36) * 0.38
  else if (u < 0.56) k = 0.38 + ((u - 0.36) / 0.2) * 0.24
  else k = 0.62 + ((u - 0.56) / 0.44) * 0.38
  return clamp(k, 0, 1) * duration
}

class KayDriver implements KenneyDriver {
  private readonly yawQ = new THREE.Quaternion()
  private readonly melee: THREE.AnimationAction | null

  constructor(
    private readonly mixer: THREE.AnimationMixer,
    idle: THREE.AnimationAction,
    walk: THREE.AnimationAction,
    sprint: THREE.AnimationAction,
    private readonly bob: THREE.Group,
    private readonly hips: THREE.Object3D | null,
    private readonly chest: THREE.Object3D | null,
    private readonly head: THREE.Object3D | null,
    meleeClip: THREE.AnimationClip | null,
    private readonly lunge: boolean,
  ) {
    for (const action of [idle, walk, sprint]) {
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.play()
    }
    this.idle = idle
    this.walk = walk
    this.sprint = sprint
    this.melee = meleeClip ? mixer.clipAction(meleeClip) : null
    if (this.melee) {
      this.melee.setLoop(THREE.LoopOnce, 1)
      this.melee.clampWhenFinished = true
      this.melee.play()
      this.melee.setEffectiveWeight(0)
      this.melee.paused = true
    }
  }

  private readonly idle: THREE.AnimationAction
  private readonly walk: THREE.AnimationAction
  private readonly sprint: THREE.AnimationAction

  update(state: KenneyAnimState): void {
    const gait = clamp(state.gait, 0, 1)
    const swing = state.attack > 0 ? state.attack : clamp(state.swing, 0, 1)
    const attacking = swing > 0 && this.melee != null
    if (attacking && this.melee) {
      this.idle.setEffectiveWeight(0)
      this.walk.setEffectiveWeight(0)
      this.sprint.setEffectiveWeight(0)
      this.melee.setEffectiveWeight(1)
      this.melee.paused = true
      const duration = this.melee.getClip().duration || 1
      this.melee.time = stabTime(swing, duration)
      this.mixer.update(0)
    } else {
      if (this.melee) this.melee.setEffectiveWeight(0)
      if (state.footSync) this.blendHero(state)
      else {
        this.idle.setEffectiveWeight(1 - gait)
        this.walk.setEffectiveWeight(gait)
        this.sprint.setEffectiveWeight(0)
        this.walk.timeScale = 0.45 + gait * 1.25
        this.sprint.timeScale = 0.7 + gait * 0.4
      }
      this.mixer.update(state.dt)
    }
    this.applyAim(state, gait, attacking)
    this.applyStrike(state, attacking && this.lunge)
    // Absolute, every frame: the mixer can write the bind scale back.
    if (this.lunge && this.head) this.head.scale.setScalar(HEAD_SCALE)
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

  /** Coil back, then a short lunge, on top of the stab clip. */
  private applyStrike(state: KenneyAnimState, attacking: boolean): void {
    if (!attacking) {
      this.bob.position.set(0, 0, 0)
      return
    }
    const u = state.attack > 0 ? state.attack : state.swing
    const wind = u < 0.36 ? u / 0.36 : Math.max(0, 1 - (u - 0.36) / 0.18)
    const strike = u < 0.34 ? 0 : u < 0.58 ? (u - 0.34) / 0.24 : Math.max(0, 1 - (u - 0.58) / 0.42)
    const sign = state.lungeSign ?? 1
    this.bob.position.set(0, -0.05 * wind, sign * (-0.2 * wind + 0.42 * strike))
    this.bob.rotation.set(sign * (0.32 * wind - 0.4 * strike), 0, 0)
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

function faceDetails(model: THREE.Object3D, head: THREE.Object3D, headMesh: THREE.Object3D): void {
  model.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(headMesh)
  const size = box.getSize(new THREE.Vector3())
  if (size.y < 0.05) return
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
}

function fistMaterial(template: THREE.Object3D): THREE.MeshLambertMaterial {
  const map = findMap(template)
  const mat = new THREE.MeshLambertMaterial({
    map: map ?? undefined,
    color: 0xa8acb4,
    emissive: 0xd5dce8,
    emissiveMap: map ?? undefined,
    emissiveIntensity: 0.95,
  })
  mat.userData.flashable = true
  addRim(mat)
  return mat
}

function attachDagger(slot: THREE.Object3D, template: THREE.Object3D, mat: THREE.MeshLambertMaterial): THREE.Group {
  const group = new THREE.Group()
  group.name = 'dagger-r'
  const model = template.clone(true)
  model.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.material = mat
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.frustumCulled = false
  })
  // dagger_A is authored with the grip at the origin and the blade along +Y.
  // The hand slot's +Y is the character's forward, so the mesh sits as-is.
  model.rotation.set(0, 0, 0)
  model.scale.setScalar(1)
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
    clip(clips, 'Melee_1H_Attack_Stab'),
    lunge,
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
  dagger: THREE.Object3D,
  pale: THREE.Texture,
  blade: THREE.MeshLambertMaterial,
): Rig {
  const model = cloneSkinned(template) as THREE.Group
  const { cape } = paintVampire(model, pale)
  const height = ground(model, 1.16 * HERO_SCALE, 0.98 * HERO_SCALE, null)
  const head = bone(model, 'head')
  const headMesh = model.getObjectByName('Mage_Head')
  if (head && headMesh) faceDetails(model, head, headMesh)
  const claws: THREE.Object3D[] = []
  const right = bone(model, 'handslot.r')
  if (right) claws.push(attachDagger(right, dagger, blade))
  const rig = wrap(model, height, clips, true, claws, { claw: blade, cape })
  rig.root.userData.kayFist = true
  rig.root.userData.visual = HERO_SCALE
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
  const [mage, skel, combat, general, move, dagger] = await Promise.all([
    loader.loadAsync(asset('cc0/kaykit/mage.glb')),
    loader.loadAsync(asset('cc0/kaykit/skeleton-minion.glb')),
    loader.loadAsync(asset('cc0/kaykit/anim-combat.glb')),
    loader.loadAsync(asset('cc0/kaykit/anim-general.glb')),
    loader.loadAsync(asset('cc0/kaykit/anim-move.glb')),
    loader.loadAsync(asset('cc0/kaykit/dagger_A.gltf')),
  ])
  const clips = new Map<string, THREE.AnimationClip>()
  for (const gltf of [combat, general, move]) {
    for (const anim of gltf.animations) clips.set(anim.name, anim)
  }
  const map = findMap(mage.scene)
  if (!map) throw new Error('KayKit mage is missing its texture')
  const pale = paleSkin(map)
  const blade = fistMaterial(dagger.scene)
  return {
    hero: () => buildVampire(mage.scene, clips, dagger.scene, pale, blade),
    ghoul: () => buildGhoul(skel.scene, clips),
  }
}
