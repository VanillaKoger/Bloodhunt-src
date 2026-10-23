import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { CLAW_TIERS, type ClawTierId } from './balance'
import type { WeaponKind } from './weapons'

export interface KenneyAnimState {
  dt: number
  gait: number
  phase: number
  hipYaw: number
  swing: number
  /** 0 idle, otherwise 0–1 through windup, strike, and recover. */
  attack: number
  time: number
  /** When true, the hero's walk and run follow ground speed instead of a fixed sprint. */
  footSync: boolean
  /** Meters per second the actor actually moved. */
  speed?: number
  /**
   * 1 lunges along root +Z. A lock turns the root around so the face
   * meets the target, and the lunge has to follow that face.
   */
  lungeSign?: number
  /** The hero's current weapon swing. Null between swings. */
  melee?: MeleeState | null
}

/** A hero swing on its KayKit clip. Times are clip seconds. */
export interface MeleeState {
  clip: string
  time: number
  /** Clip seconds per second. The fade-out keeps this rate. */
  rate: number
  contact: number
  /** Bumps once per swing, so back-to-back swings of one clip still blend. */
  id: number
  lunge: number
}

export interface KenneyDriver {
  update(state: KenneyAnimState): void
}

export interface Rig {
  root: THREE.Group
  bob: THREE.Group
  head: THREE.Group
  armL: THREE.Group
  armR: THREE.Group
  legL: THREE.Group
  legR: THREE.Group
  hip?: THREE.Group
  torso?: THREE.Group
  cape?: THREE.Group
  tail?: THREE.Object3D
  orb?: THREE.Object3D
  claws: THREE.Object3D[]
  /** Set when a Kenney clip rig is driving this actor. */
  drive?: KenneyDriver
  mats: {
    claw?: THREE.MeshLambertMaterial
    cape?: THREE.MeshLambertMaterial
    trim?: THREE.MeshLambertMaterial
    coat?: THREE.MeshLambertMaterial
    eye?: THREE.MeshLambertMaterial
    gem?: THREE.MeshLambertMaterial
  }
}

const matCache = new Map<string, THREE.MeshLambertMaterial>()

export function setEnvIntensity(_v: number): void {
  /* Lambert materials do not use an environment map. */
}

function std(
  color: number,
  opts: {
    roughness?: number
    metalness?: number
    emissive?: number
    emissiveIntensity?: number
    unique?: boolean
  } = {},
): THREE.MeshLambertMaterial {
  const metal = opts.metalness ?? 0
  const emissive = opts.emissive ?? (metal > 0.45 ? color : 0x000000)
  const emissiveIntensity = opts.emissiveIntensity ?? (opts.emissive ? 1 : metal > 0.45 ? 0.28 : 0)
  const key = `${color}|${emissive}|${emissiveIntensity}`
  if (!opts.unique && matCache.has(key)) return matCache.get(key)!
  const m = new THREE.MeshLambertMaterial({
    color,
    emissive,
    emissiveIntensity,
  })
  if (!opts.unique) matCache.set(key, m)
  return m
}

function rbox(w: number, h: number, d: number, r = 0.08): RoundedBoxGeometry {
  const radius = Math.max(0.02, Math.min(r, w * 0.45, h * 0.45, d * 0.45))
  return new RoundedBoxGeometry(w, h, d, 2, radius)
}

function put(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
  rz = 0,
  sx = 1,
  sy = 1,
  sz = 1,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, material)
  mesh.position.set(x, y, z)
  mesh.rotation.set(rx, ry, rz)
  mesh.scale.set(sx, sy, sz)
  mesh.castShadow = false
  mesh.receiveShadow = false
  parent.add(mesh)
  return mesh
}

function pivot(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, y, z)
  parent.add(g)
  return g
}

function capeGeometry(topW: number, botW: number, height: number): THREE.BufferGeometry {
  const sx = 7
  const sy = 8
  const pos: number[] = []
  const idx: number[] = []
  for (let y = 0; y <= sy; y++) {
    const t = y / sy
    const w = topW + (botW - topW) * Math.pow(t, 0.85)
    const py = -height * t
    const z = -0.05 - Math.sin(t * Math.PI) * 0.16
    for (let x = 0; x <= sx; x++) {
      const u = x / sx
      let px = (u * 2 - 1) * w
      let yy = py
      if (y === sy) yy += Math.sin(u * Math.PI * 3) * 0.045
      const edge = Math.abs(u * 2 - 1)
      px *= 1
      pos.push(px * (1 - edge * 0.02), yy, z - edge * 0.02)
    }
  }
  for (let y = 0; y < sy; y++) {
    for (let x = 0; x < sx; x++) {
      const a = y * (sx + 1) + x
      const b = a + 1
      const c = a + (sx + 1)
      const d = c + 1
      idx.push(a, c, b, b, c, d)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

function batGeometry(): THREE.ShapeGeometry {
  const s = new THREE.Shape()
  s.moveTo(0, 0.02)
  s.bezierCurveTo(0.06, 0.14, 0.2, 0.18, 0.32, 0.05)
  s.bezierCurveTo(0.24, 0.0, 0.16, -0.02, 0.09, -0.1)
  s.lineTo(0.02, -0.16)
  s.lineTo(0, -0.1)
  s.lineTo(-0.02, -0.16)
  s.lineTo(-0.09, -0.1)
  s.bezierCurveTo(-0.16, -0.02, -0.24, 0.0, -0.32, 0.05)
  s.bezierCurveTo(-0.2, 0.18, -0.06, 0.14, 0, 0.02)
  return new THREE.ShapeGeometry(s, 8)
}

const GEO = {
  shadow: new THREE.CircleGeometry(0.46, 20),
  sphere: new THREE.SphereGeometry(1, 16, 12),
  eye: new THREE.SphereGeometry(1, 12, 10),
  cone: new THREE.ConeGeometry(1, 1, 10),
  gem: new THREE.OctahedronGeometry(1, 0),
  bat: batGeometry(),
  cape: capeGeometry(0.28, 0.62, 1.15),
  capeGold: capeGeometry(0.31, 0.67, 1.2),
}

function addShadow(root: THREE.Group, scale = 1): void {
  const s = put(root, GEO.shadow, std(0x05030a, { roughness: 1 }), 0, 0.025, 0, -Math.PI / 2, 0, 0, scale, scale, scale)
  const mat = s.material as THREE.MeshLambertMaterial
  mat.transparent = true
  mat.opacity = 0.38
  mat.depthWrite = false
}

function addEyes(head: THREE.Group, y: number, z: number, sep: number, size: number, color: number, unique = false): THREE.MeshLambertMaterial {
  const mat = std(color, { emissive: color, emissiveIntensity: 1.6, roughness: 0.25, unique })
  const socket = std(0x140810, { roughness: 0.8 })
  for (const side of [-1, 1]) {
    put(head, GEO.eye, socket, side * sep, y, z - 0.02, 0, 0, 0, size * 1.35, size * 1.35, size * 0.8)
    put(head, GEO.eye, mat, side * sep, y, z, 0, 0, 0, size, size, size)
    put(head, GEO.eye, std(0xfff6ee, { roughness: 0.2 }), side * sep + size * 0.28, y + size * 0.25, z + size * 0.7, 0, 0, 0, size * 0.28, size * 0.28, size * 0.2)
  }
  return mat
}

export function createHero(): Rig {
  const root = new THREE.Group()
  const bob = pivot(root, 0, 0, 0)
  addShadow(root, 1.05)

  const skin = std(0xd9c6d4, { roughness: 0.48, unique: true })
  const coat = std(0x1b1630, { roughness: 0.62, unique: true })
  const pants = std(0x241833, { roughness: 0.7 })
  const gold = std(0xe2b44a, { roughness: 0.28, metalness: 0.82, unique: true })
  const capeMat = std(0x9c1630, { roughness: 0.55, unique: true })
  const clawMat = std(0xd5dce8, { roughness: 0.22, metalness: 0.72, emissive: 0x2a0a14, emissiveIntensity: 0.25, unique: true })
  const gemMat = std(0xff2244, { emissive: 0xff2244, emissiveIntensity: 1.4, roughness: 0.25, unique: true })
  const hair = std(0x2a1248, { roughness: 0.55 })
  const bootMat = std(0x2a2140, { roughness: 0.5, unique: true })

  const hip = pivot(bob, 0, 0.62, 0)
  const legL = pivot(hip, -0.14, 0, 0)
  const legR = pivot(hip, 0.14, 0, 0)
  for (const leg of [legL, legR]) {
    put(leg, new THREE.CapsuleGeometry(0.09, 0.28, 4, 8), pants, 0, -0.22, 0)
    put(leg, rbox(0.18, 0.16, 0.28, 0.05), bootMat, 0, -0.42, 0.03)
    put(leg, rbox(0.16, 0.045, 0.22, 0.02), gold, 0, -0.36, 0.06)
  }

  const torso = pivot(bob, 0, 0.78, 0)
  put(torso, rbox(0.5, 0.58, 0.32, 0.1), coat, 0, 0.16, 0)
  put(torso, rbox(0.42, 0.08, 0.3, 0.03), std(0x4a3420, { roughness: 0.55 }), 0, -0.08, 0.02)
  put(torso, rbox(0.1, 0.08, 0.06, 0.02), gold, 0, -0.08, 0.16)
  for (let i = 0; i < 3; i++) put(torso, GEO.sphere, gold, 0, 0.28 - i * 0.12, 0.16, 0, 0, 0, 0.035, 0.035, 0.03)
  put(torso, GEO.gem, gemMat, 0, 0.4, 0.16, 0, 0, Math.PI / 4, 0.07, 0.09, 0.05)
  put(torso, rbox(0.16, 0.12, 0.08, 0.03), std(0xf4efe6, { roughness: 0.45 }), 0, 0.42, 0.12)

  const collar = pivot(torso, 0, 0.42, 0)
  put(collar, rbox(0.22, 0.36, 0.08, 0.04), capeMat, -0.18, 0.12, -0.02, -0.15, 0, 0.55)
  put(collar, rbox(0.22, 0.36, 0.08, 0.04), capeMat, 0.18, 0.12, -0.02, -0.15, 0, -0.55)
  put(collar, rbox(0.24, 0.38, 0.07, 0.03), gold, -0.2, 0.12, -0.04, -0.15, 0, 0.55)
  put(collar, rbox(0.24, 0.38, 0.07, 0.03), gold, 0.2, 0.12, -0.04, -0.15, 0, -0.55)
  put(collar, rbox(0.46, 0.28, 0.08, 0.04), capeMat, 0, 0.08, -0.12)

  const cape = pivot(torso, 0, 0.38, -0.12)
  const goldCape = put(cape, GEO.capeGold, gold)
  goldCape.position.z = -0.03
  put(cape, GEO.cape, capeMat)
  const emblem = put(cape, GEO.bat, gold, 0, -0.42, -0.08, 0, Math.PI, 0, 0.85, 0.85, 0.85)
  emblem.position.z = -0.1

  const armL = pivot(torso, -0.32, 0.28, 0)
  const armR = pivot(torso, 0.32, 0.28, 0)
  const claws: THREE.Object3D[] = []
  for (const [arm, side] of [[armL, -1], [armR, 1]] as const) {
    put(arm, new THREE.CapsuleGeometry(0.075, 0.22, 4, 8), coat, 0, -0.18, 0)
    put(arm, rbox(0.16, 0.16, 0.18, 0.05), clawMat, side * 0.02, -0.36, 0.04)
    const hand = pivot(arm, side * 0.02, -0.4, 0.08)
    const spec: ClawSpec = { len: 0.26, rad: 0.045, gap: 0.07, axis: 'x', pos: [0, -0.02, 0.02], rot: [Math.PI / 2.15, 0, 0] }
    hand.userData.clawSpec = spec
    claws.push(hand)
    const dirs = [-0.35, 0, 0.35]
    dirs.forEach((rz, i) => {
      put(hand, GEO.cone, clawMat, (i - 1) * 0.07, -0.02, 0.1, Math.PI / 2.15, 0, rz, 0.045, 0.26, 0.045)
    })
  }

  const head = pivot(torso, 0, 0.52, 0.02)
  put(head, GEO.sphere, skin, 0, 0.16, 0, 0, 0, 0, 0.34, 0.36, 0.32)
  put(head, GEO.sphere, hair, 0, 0.28, -0.04, 0, 0, 0, 0.36, 0.24, 0.34)
  const spikes: [number, number, number, number][] = [
    [0, 0.46, -0.02, 0],
    [-0.16, 0.4, -0.02, -0.35],
    [0.16, 0.4, -0.02, 0.35],
    [-0.26, 0.28, -0.04, -0.7],
    [0.26, 0.28, -0.04, 0.7],
  ]
  for (const [x, y, z, rz] of spikes) {
    put(head, GEO.cone, hair, x, y, z, 0.15, 0, rz, 0.09, 0.28, 0.09)
  }
  put(head, GEO.cone, hair, 0, 0.18, 0.28, 1.1, 0, 0, 0.07, 0.16, 0.07)
  put(head, GEO.cone, skin, -0.34, 0.16, 0.02, 0, 0, Math.PI / 2.4, 0.08, 0.22, 0.08)
  put(head, GEO.cone, skin, 0.34, 0.16, 0.02, 0, 0, -Math.PI / 2.4, 0.08, 0.22, 0.08)
  const eye = addEyes(head, 0.18, 0.26, 0.1, 0.055, 0xff1e3c, true)
  put(head, rbox(0.1, 0.028, 0.03, 0.01), hair, -0.1, 0.28, 0.27, 0, 0, 0.45)
  put(head, rbox(0.1, 0.028, 0.03, 0.01), hair, 0.1, 0.28, 0.27, 0, 0, -0.45)
  put(head, rbox(0.09, 0.02, 0.02, 0.008), std(0x3a2030, { roughness: 0.6 }), 0, 0.02, 0.3)
  put(head, GEO.sphere, skin, 0, 0.08, 0.3, 0, 0, 0, 0.035, 0.045, 0.04)
  put(head, GEO.cone, std(0xf4f0ea, { roughness: 0.35 }), -0.025, -0.01, 0.3, Math.PI, 0, 0.2, 0.018, 0.05, 0.018)
  put(head, GEO.cone, std(0xf4f0ea, { roughness: 0.35 }), 0.025, -0.01, 0.3, Math.PI, 0, -0.2, 0.018, 0.05, 0.018)

  return {
    root,
    bob,
    hip,
    torso,
    head,
    armL,
    armR,
    legL,
    legR,
    cape,
    claws,
    mats: { claw: clawMat, cape: capeMat, trim: gold, coat, eye, gem: gemMat },
  }
}

function creatureBase(scaleShadow = 1): { root: THREE.Group; bob: THREE.Group } {
  const root = new THREE.Group()
  const bob = pivot(root, 0, 0, 0)
  addShadow(root, scaleShadow)
  return { root, bob }
}

export function createGhoul(): Rig {
  const { root, bob } = creatureBase(1.15)
  const skin = std(0x8e8994, { roughness: 0.62 })
  const cloth = std(0x3a3548, { roughness: 0.75 })
  const club = std(0x6a5644, { roughness: 0.8 })
  const legL = pivot(bob, -0.16, 0.55, 0)
  const legR = pivot(bob, 0.16, 0.55, 0)
  for (const leg of [legL, legR]) put(leg, new THREE.CapsuleGeometry(0.11, 0.22, 4, 8), cloth, 0, -0.2, 0)
  const torso = pivot(bob, 0, 0.62, 0)
  torso.rotation.x = 0.28
  put(torso, rbox(0.72, 0.62, 0.46, 0.12), skin, 0, 0.2, 0)
  put(torso, rbox(0.4, 0.28, 0.2, 0.06), std(0xb0a8b4, { roughness: 0.6 }), 0, 0.05, 0.2)
  const armL = pivot(torso, -0.42, 0.28, 0)
  const armR = pivot(torso, 0.42, 0.28, 0)
  for (const arm of [armL, armR]) {
    put(arm, new THREE.CapsuleGeometry(0.1, 0.28, 4, 8), skin, 0, -0.24, 0)
    put(arm, GEO.sphere, skin, 0, -0.46, 0.04, 0, 0, 0, 0.12, 0.1, 0.12)
  }
  put(armR, new THREE.CapsuleGeometry(0.08, 0.34, 3, 6), club, 0.05, -0.62, 0.16, 0.4, 0, 0.2)
  put(armR, GEO.sphere, std(0x5a534c, { roughness: 0.7 }), 0.12, -0.84, 0.28, 0, 0, 0, 0.16, 0.16, 0.16)
  const head = pivot(torso, 0, 0.52, 0.12)
  put(head, GEO.sphere, skin, 0, 0.16, 0, 0, 0, 0, 0.3, 0.28, 0.28)
  put(head, GEO.cone, skin, -0.22, 0.34, 0, 0, 0, 0.4, 0.08, 0.16, 0.08)
  put(head, GEO.cone, skin, 0.22, 0.34, 0, 0, 0, -0.4, 0.08, 0.16, 0.08)
  const eye = addEyes(head, 0.16, 0.22, 0.1, 0.05, 0xff3030)
  put(head, rbox(0.16, 0.04, 0.04, 0.01), std(0x2a2030), 0, 0.02, 0.24)
  return { root, bob, head, armL, armR, legL, legR, claws: [], mats: { eye } }
}

export function createWolf(): Rig {
  const { root, bob } = creatureBase(1.05)
  const fur = std(0x6c7384, { roughness: 0.68 })
  const belly = std(0xa4a8b4, { roughness: 0.6 })
  const dark = std(0x3e4454, { roughness: 0.7 })
  const legL = pivot(bob, -0.14, 0.58, 0)
  const legR = pivot(bob, 0.14, 0.58, 0)
  for (const leg of [legL, legR]) {
    put(leg, new THREE.CapsuleGeometry(0.08, 0.16, 3, 6), fur, 0, -0.12, 0)
    put(leg, new THREE.CapsuleGeometry(0.06, 0.14, 3, 6), dark, 0, -0.32, 0.04)
  }
  const torso = pivot(bob, 0, 0.66, 0)
  torso.rotation.x = 0.4
  put(torso, rbox(0.52, 0.58, 0.34, 0.12), fur, 0, 0.16, 0)
  put(torso, rbox(0.32, 0.32, 0.12, 0.06), belly, 0, 0.08, 0.16)
  const armL = pivot(torso, -0.32, 0.24, 0.06)
  const armR = pivot(torso, 0.32, 0.24, 0.06)
  const claws: THREE.Object3D[] = []
  for (const arm of [armL, armR]) {
    put(arm, new THREE.CapsuleGeometry(0.07, 0.2, 3, 6), fur, 0, -0.18, 0.02)
    const hand = pivot(arm, 0, -0.36, 0.08)
    claws.push(hand)
    put(hand, GEO.cone, std(0xe8e6ea, { roughness: 0.3, metalness: 0.2 }), -0.05, 0, 0.08, Math.PI / 2, 0, 0, 0.03, 0.16, 0.03)
    put(hand, GEO.cone, std(0xe8e6ea, { roughness: 0.3, metalness: 0.2 }), 0.05, 0, 0.08, Math.PI / 2, 0, 0, 0.03, 0.16, 0.03)
  }
  const head = pivot(torso, 0, 0.46, 0.16)
  put(head, GEO.sphere, fur, 0, 0.1, 0, 0, 0, 0, 0.2, 0.18, 0.2)
  put(head, rbox(0.16, 0.12, 0.28, 0.05), fur, 0, 0.04, 0.18)
  put(head, GEO.sphere, std(0x2a2830), 0, 0.02, 0.32, 0, 0, 0, 0.04, 0.03, 0.04)
  put(head, GEO.cone, fur, -0.12, 0.26, -0.02, 0, 0, 0.25, 0.07, 0.2, 0.05)
  put(head, GEO.cone, fur, 0.12, 0.26, -0.02, 0, 0, -0.25, 0.07, 0.2, 0.05)
  const eye = addEyes(head, 0.12, 0.14, 0.08, 0.04, 0x3dffe8)
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.2, -0.16),
    new THREE.Vector3(0, 0.32, -0.36),
    new THREE.Vector3(0.04, 0.22, -0.52),
  ])
  const tail = put(bob, new THREE.TubeGeometry(curve, 12, 0.045, 6, false), fur)
  return { root, bob, head, armL, armR, legL, legR, tail, claws, mats: { eye } }
}

export function createWitch(): Rig {
  const { root, bob } = creatureBase(0.9)
  const robe = std(0x3a2468, { roughness: 0.55 })
  const gold = std(0xe2b44a, { metalness: 0.75, roughness: 0.32 })
  const skin = std(0xcbb8c8, { roughness: 0.5 })
  const legL = pivot(bob, -0.1, 0.3, 0)
  const legR = pivot(bob, 0.1, 0.3, 0)
  const torso = pivot(bob, 0, 0.15, 0)
  put(torso, GEO.cone, robe, 0, 0.55, 0, 0, 0, 0, 0.55, 1.15, 0.5)
  put(torso, new THREE.TorusGeometry(0.48, 0.035, 6, 20), gold, 0, 0.08, 0, Math.PI / 2, 0, 0)
  const armL = pivot(torso, -0.28, 0.78, 0.06)
  const armR = pivot(torso, 0.28, 0.78, 0.06)
  for (const arm of [armL, armR]) put(arm, new THREE.CapsuleGeometry(0.05, 0.22, 3, 6), robe, 0, -0.16, 0.04)
  const orbMat = std(0xc45bff, { emissive: 0xc45bff, emissiveIntensity: 2.1, roughness: 0.2 })
  const orb = pivot(armL, 0, -0.32, 0.12)
  put(orb, GEO.sphere, orbMat, 0, 0, 0, 0, 0, 0, 0.11, 0.11, 0.11)
  const head = pivot(torso, 0, 1.12, 0.02)
  put(head, GEO.sphere, skin, 0, 0.02, 0.04, 0, 0, 0, 0.16, 0.17, 0.15)
  put(head, GEO.sphere, robe, 0, 0.1, -0.02, 0, 0, 0, 0.24, 0.22, 0.22)
  put(head, GEO.cone, robe, 0, 0.18, 0.16, 0.9, 0, 0, 0.16, 0.28, 0.16)
  put(head, new THREE.TorusGeometry(0.16, 0.02, 6, 16), gold, 0, 0.02, 0.08, Math.PI / 2.2, 0, 0)
  const eye = addEyes(head, 0.02, 0.16, 0.06, 0.03, 0xff3355)
  return { root, bob, head, armL, armR, legL, legR, orb, claws: [], mats: { eye, gem: orbMat } }
}

function createMobster(scale: number, suit: number, shirt: number, tie: number, heavy: boolean): Rig {
  const { root, bob } = creatureBase(scale)
  const cloth = std(suit, { roughness: 0.55 })
  const skin = std(0xe0b090, { roughness: 0.6 })
  const felt = std(0x14161c, { roughness: 0.7 })
  const glass = std(0x0c0e12, { roughness: 0.25, metalness: 0.35 })
  const legL = pivot(bob, -0.14, 0.58, 0)
  const legR = pivot(bob, 0.14, 0.58, 0)
  for (const leg of [legL, legR]) put(leg, new THREE.CapsuleGeometry(0.1, 0.28, 4, 8), cloth, 0, -0.22, 0)
  const torso = pivot(bob, 0, 0.66, 0)
  put(torso, rbox(heavy ? 0.78 : 0.62, 0.7, 0.4, 0.1), cloth, 0, 0.28, 0)
  put(torso, rbox(0.22, 0.3, 0.06, 0.02), std(shirt), 0, 0.32, 0.18)
  put(torso, rbox(0.06, 0.24, 0.04, 0.01), std(tie, { emissive: tie, emissiveIntensity: 0.25 }), 0, 0.26, 0.2)
  const armL = pivot(torso, heavy ? -0.46 : -0.38, 0.42, 0)
  const armR = pivot(torso, heavy ? 0.46 : 0.38, 0.42, 0)
  for (const arm of [armL, armR]) {
    put(arm, new THREE.CapsuleGeometry(heavy ? 0.1 : 0.08, 0.26, 3, 6), cloth, 0, -0.22, 0)
    put(arm, GEO.sphere, skin, 0, -0.42, 0.02, 0, 0, 0, 0.08, 0.08, 0.08)
  }
  const head = pivot(torso, 0, 0.66, 0.02)
  put(head, GEO.sphere, skin, 0, 0.16, 0, 0, 0, 0, 0.18, 0.2, 0.18)
  put(head, new THREE.CylinderGeometry(0.16, 0.18, 0.16, 8), felt, 0, 0.36, 0)
  put(head, new THREE.CylinderGeometry(0.28, 0.28, 0.04, 10), felt, 0, 0.27, 0.02)
  put(head, rbox(0.26, 0.04, 0.08, 0.01), glass, 0, 0.16, 0.12)
  const eye = addEyes(head, 0.16, 0.08, 0.09, 0.028, 0x111111)
  return { root, bob, head, armL, armR, legL, legR, claws: [], mats: { eye } }
}

export function createThug(): Rig {
  return createMobster(1.05, 0x1c2433, 0xe7e0d4, 0xc4364a, false)
}

export function createEnforcer(): Rig {
  return createMobster(1.22, 0x3a1218, 0xf3ecdf, 0xe8c25a, true)
}

export function createDon(): Rig {
  return createMobster(1.42, 0x12141a, 0xf7f3ea, 0xff3355, true)
}

export function createBoss(): Rig {
  const { root, bob } = creatureBase(1.45)
  const fur = std(0x5c463e, { roughness: 0.62, unique: true })
  const belly = std(0x8d6a5c, { roughness: 0.55, unique: true })
  const gold = std(0xe8c25a, { metalness: 0.8, roughness: 0.28, emissive: 0x4a3208, emissiveIntensity: 0.35, unique: true })
  const capeMat = std(0x8e1428, { roughness: 0.5, unique: true })
  const legL = pivot(bob, -0.22, 0.7, 0)
  const legR = pivot(bob, 0.22, 0.7, 0)
  for (const leg of [legL, legR]) {
    put(leg, new THREE.CapsuleGeometry(0.12, 0.28, 4, 8), fur, 0, -0.22, 0)
    put(leg, rbox(0.2, 0.1, 0.28, 0.04), std(0x3a2a28, { roughness: 0.6 }), 0, -0.42, 0.06)
  }
  const torso = pivot(bob, 0, 0.78, 0)
  put(torso, rbox(0.9, 0.78, 0.62, 0.16), fur, 0, 0.28, 0)
  put(torso, GEO.sphere, belly, 0, 0.16, 0.22, 0, 0, 0, 0.38, 0.32, 0.22)
  const cape = pivot(torso, 0, 0.55, -0.22)
  put(cape, GEO.capeGold, gold, 0, 0, -0.03, 0, 0, 0, 1.15, 1.05, 1)
  put(cape, GEO.cape, capeMat, 0, 0, 0, 0, 0, 0, 1.1, 1, 1)
  const armL = pivot(torso, -0.52, 0.4, 0)
  const armR = pivot(torso, 0.52, 0.4, 0)
  const claws: THREE.Object3D[] = []
  const clawMat = std(0xeeeae4, { roughness: 0.3, metalness: 0.25, unique: true })
  for (const arm of [armL, armR]) {
    put(arm, new THREE.CapsuleGeometry(0.12, 0.26, 4, 8), fur, 0, -0.24, 0)
    const hand = pivot(arm, 0, -0.46, 0.08)
    claws.push(hand)
    put(hand, GEO.cone, clawMat, -0.08, 0, 0.12, Math.PI / 2, 0, 0.2, 0.045, 0.28, 0.045)
    put(hand, GEO.cone, clawMat, 0, 0, 0.14, Math.PI / 2, 0, 0, 0.05, 0.32, 0.05)
    put(hand, GEO.cone, clawMat, 0.08, 0, 0.12, Math.PI / 2, 0, -0.2, 0.045, 0.28, 0.045)
  }
  const head = pivot(torso, 0, 0.72, 0.08)
  put(head, GEO.sphere, fur, 0, 0.16, 0, 0, 0, 0, 0.32, 0.28, 0.3)
  put(head, rbox(0.22, 0.16, 0.36, 0.06), fur, 0, 0.06, 0.24)
  put(head, GEO.sphere, pinkish(), 0, 0.04, 0.42, 0, 0, 0, 0.05, 0.04, 0.04)
  put(head, GEO.sphere, std(0xd9a0a8, { roughness: 0.45 }), -0.22, 0.28, 0, 0, 0, 0.5, 0.12, 0.12, 0.06)
  put(head, GEO.sphere, std(0xd9a0a8, { roughness: 0.45 }), 0.22, 0.28, 0, 0, 0, -0.5, 0.12, 0.12, 0.06)
  const eye = addEyes(head, 0.16, 0.22, 0.11, 0.055, 0xff2020, true)
  put(head, GEO.cone, std(0xf6f1c8, { roughness: 0.35, metalness: 0.2 }), -0.04, 0.0, 0.38, Math.PI / 2, 0, 0.3, 0.02, 0.08, 0.02)
  put(head, GEO.cone, std(0xf6f1c8, { roughness: 0.35, metalness: 0.2 }), 0.04, 0.0, 0.38, Math.PI / 2, 0, -0.3, 0.02, 0.08, 0.02)
  const crown = pivot(head, 0, 0.4, 0)
  put(crown, new THREE.TorusGeometry(0.2, 0.045, 8, 18), gold, 0, 0, 0, Math.PI / 2, 0, 0)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    put(crown, GEO.cone, gold, Math.sin(a) * 0.18, 0.1, Math.cos(a) * 0.18, 0, 0, 0, 0.05, 0.16, 0.05)
  }
  put(crown, GEO.gem, std(0xff2244, { emissive: 0xff2244, emissiveIntensity: 1.8, unique: true }), 0, 0.16, 0.16, 0, 0, 0, 0.06, 0.08, 0.04)
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.35, -0.3),
    new THREE.Vector3(0.2, 0.45, -0.7),
    new THREE.Vector3(-0.1, 0.25, -1.05),
    new THREE.Vector3(0.25, 0.4, -1.35),
  ])
  const tail = put(bob, new THREE.TubeGeometry(curve, 18, 0.05, 6, false), pinkish())
  return { root, bob, head, armL, armR, legL, legR, cape, tail, claws, mats: { claw: clawMat, cape: capeMat, trim: gold, eye } }
}

function pinkish(): THREE.MeshLambertMaterial {
  return std(0xc48490, { roughness: 0.5 })
}

function damp(current: number, target: number, dt: number, lambda: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt))
}

/** One leg over a two-step cycle. 0–1 swings back to front; 1–2 plants front to back. */
function stepPose(phase: number, offset: number): { x: number; lift: number } {
  const amp = 0.58
  let p = (phase / Math.PI + offset) % 2
  if (p < 0) p += 2
  const u = p < 1 ? p : p - 1
  const s = u * u * (3 - 2 * u)
  if (p < 1) return { x: amp * (1 - 2 * s), lift: Math.sin(u * Math.PI) }
  return { x: amp * (-1 + 2 * s), lift: 0 }
}

/** Hero walk, idle, and upper-body attacks. Enemies stay on animateRig. */
export function animateHero(
  rig: Rig,
  dt: number,
  gait: number,
  phase: number,
  hipYaw: number,
  swing: number,
  time: number,
  attack = 0,
  speed = 0,
  lungeSign = 1,
  melee: MeleeState | null = null,
): void {
  if (rig.drive) {
    rig.drive.update({ dt, gait, phase, hipYaw, swing, attack, time, footSync: true, speed, lungeSign, melee })
    return
  }
  const hip = rig.hip
  const forward = Math.cos(hipYaw)
  const side = Math.sin(hipYaw)
  if (hip) hip.rotation.set(forward * 0.05 * gait, hipYaw, Math.sin(phase) * 0.07 * gait)
  const left = stepPose(phase, 0)
  const right = stepPose(phase, 1)
  rig.legL.rotation.set(left.x * gait, 0, 0.05)
  rig.legR.rotation.set(right.x * gait, 0, -0.05)
  rig.legL.position.y = left.lift * 0.05 * gait
  rig.legR.position.y = right.lift * 0.05 * gait
  let k = swing > 0 ? Math.sin(Math.min(1, swing) * Math.PI) : 0
  let wind = 0
  if (attack > 0) {
    if (attack < 0.38) wind = attack / 0.38
    else if (attack < 0.68) {
      k = (attack - 0.38) / 0.3
      wind = 1 - k
    } else k = 1 - (attack - 0.68) / 0.32
  }
  const arm = 0.78 * gait * (1 - Math.max(k, wind) * 0.85)
  rig.armL.rotation.set(-left.x * arm - 0.08, 0, -0.16 - side * 0.08 * gait)
  rig.armR.rotation.set(-right.x * arm - 0.18 - k * 1.35 + wind * 0.85, k * 0.25 - wind * 0.45, 0.14 + k * 0.35 - wind * 0.4)
  const counter = Math.max(-0.42, Math.min(0.42, -hipYaw * 0.34))
  if (rig.torso) {
    const lag = damp(rig.torso.userData.lagYaw ?? 0, counter, dt, 5)
    rig.torso.userData.lagYaw = lag
    rig.torso.rotation.set(-0.07 * gait * forward + k * 0.12 - wind * 0.16, lag + k * 0.35 - wind * 0.4, -side * 0.05 * gait)
  }
  const breath = Math.sin(time * 2.15)
  rig.head.rotation.set(
    -0.05 * gait * Math.max(forward, 0) + breath * 0.03 * (1 - gait),
    Math.max(-0.3, Math.min(0.3, -counter * 0.7)) + Math.sin(time * 1.2) * 0.05 * (1 - gait),
    0,
  )
  const passing = Math.sin(phase)
  const bob = (0.5 - 0.5 * Math.cos(phase * 2)) * 0.055 * gait
  rig.bob.position.set(passing * 0.02 * gait, bob + breath * (0.015 * (1 - gait) + 0.003) - wind * 0.06, wind * 0.04 - k * 0.08)
  rig.bob.rotation.set(-forward * 0.14 * gait, 0, -side * 0.12 * gait)
  if (rig.cape) {
    const stepKick = Math.abs(Math.sin(phase)) * 0.07 * gait
    const wantX = 0.16 + gait * 0.48 * forward + stepKick + k * 0.12 + breath * 0.03 * (1 - gait)
    const wantZ = side * 0.3 * gait + Math.sin(time * 1.7 + phase * 0.5) * (0.04 + gait * 0.03)
    rig.cape.rotation.x = damp(rig.cape.rotation.x, wantX, dt, 2.6)
    rig.cape.rotation.z = damp(rig.cape.rotation.z, wantZ, dt, 2.6)
    rig.cape.rotation.y = damp(rig.cape.rotation.y, -side * 0.12 * gait, dt, 2.6)
  }
}

export function animateRig(rig: Rig, t: number, moving: number, swing: number, dt = 1 / 60): void {
  if (rig.drive) {
    rig.drive.update({ dt, gait: moving, phase: t, hipYaw: 0, swing, attack: 0, time: t, footSync: false })
    return
  }
  const freq = 6.5 + moving * 4.5
  const amp = 0.22 + moving * 0.62
  const s = Math.sin(t * freq)
  const idle = Math.sin(t * 2.1)
  rig.legL.rotation.x = s * amp
  rig.legR.rotation.x = -s * amp
  if (swing > 0 && swing < 1) {
    const k = Math.sin(swing * Math.PI)
    rig.armR.rotation.x = -0.45 - k * 1.55
    rig.armR.rotation.z = -0.1 - k * 0.25
    rig.armL.rotation.x = -0.15 - k * 0.2
  } else {
    rig.armR.rotation.x = -s * amp * 0.75
    rig.armR.rotation.z = 0.12
    rig.armL.rotation.x = s * amp * 0.75
    rig.armL.rotation.z = -0.12
  }
  if (rig.cape) {
    rig.cape.rotation.x = 0.18 + moving * 0.28 + Math.sin(t * 2.6 + 0.4) * 0.05
    rig.cape.rotation.z = Math.sin(t * 1.8) * 0.06
  }
  rig.head.rotation.y = Math.sin(t * 1.15) * 0.1
  rig.head.rotation.x = moving * 0.06
  rig.bob.position.y = Math.abs(s) * 0.045 * (0.25 + moving) + idle * 0.012
  if (rig.tail) rig.tail.rotation.y = Math.sin(t * 3) * (0.15 + moving * 0.35)
  if (rig.orb) {
    rig.orb.position.y = Math.sin(t * 3) * 0.04
    rig.orb.rotation.y = t * 2
  }
}

/** Where a hero hand's claws sit. Claws are built along +Y, then this transform aims them. */
export interface ClawSpec {
  len: number
  rad: number
  gap: number
  axis: 'x' | 'z'
  pos: [number, number, number]
  rot: [number, number, number]
}

interface TierShape {
  count: number
  len: number
  rad: number
  fan: number
  base: number
  glow: number
  tip: number | null
  guard: number | null
  ember: number | null
}

const TIER_SHAPE: Record<ClawTierId, TierShape> = {
  teethling: { count: 3, len: 0.72, rad: 1.2, fan: 0.22, base: 0x5c6068, glow: 0.12, tip: null, guard: null, ember: null },
  kindred: { count: 3, len: 1.0, rad: 1.05, fan: 0.28, base: 0x1f7a34, glow: 0.45, tip: 0xd0102a, guard: null, ember: null },
  awakened: { count: 4, len: 1.2, rad: 1.0, fan: 0.26, base: 0x1a4aa8, glow: 0.75, tip: 0xd8ecff, guard: null, ember: null },
  ascendent: { count: 4, len: 1.4, rad: 1.0, fan: 0.24, base: 0x5a1ea8, glow: 1.0, tip: 0xf2dcff, guard: 0x6a2ac0, ember: null },
  immortal: { count: 5, len: 1.62, rad: 1.08, fan: 0.2, base: 0x8a0814, glow: 1.4, tip: 0xffe0e4, guard: 0x2a0408, ember: 0xff1a30 },
}

const tierGeo = {
  cone: new THREE.ConeGeometry(1, 1, 5),
  ring: new THREE.TorusGeometry(1, 0.28, 5, 10),
  bead: new THREE.SphereGeometry(1, 8, 6),
}

function buildClawSet(id: ClawTierId, spec: ClawSpec, main: THREE.MeshLambertMaterial): THREE.Group {
  const shape = TIER_SHAPE[id]
  const set = new THREE.Group()
  set.name = `claws-${id}`
  set.position.set(...spec.pos)
  set.rotation.set(...spec.rot)
  const len = spec.len * shape.len
  const rad = spec.rad * shape.rad
  const tipMat =
    shape.tip == null ? null : new THREE.MeshLambertMaterial({ color: shape.tip, emissive: shape.tip, emissiveIntensity: id === 'kindred' ? 0.55 : 1.1 })
  for (let i = 0; i < shape.count; i++) {
    const k = shape.count === 1 ? 0 : i / (shape.count - 1) - 0.5
    const off = k * spec.gap * (shape.count - 1) * 0.75
    const claw = new THREE.Group()
    if (spec.axis === 'z') {
      claw.position.z = off
      claw.rotation.x = k * shape.fan * 2
    } else {
      claw.position.x = off
      claw.rotation.z = -k * shape.fan * 2
    }
    // Teethling claws are chipped, uneven teeth.
    const ragged = id === 'teethling' ? 0.78 + ((i * 37) % 5) * 0.08 : 1
    const middle = 1 + (0.5 - Math.abs(k)) * 0.22
    const l = len * ragged * middle
    const blade = new THREE.Mesh(tierGeo.cone, main)
    blade.scale.set(rad, l, rad * 0.7)
    blade.position.y = l / 2
    claw.add(blade)
    if (tipMat) {
      const tip = new THREE.Mesh(tierGeo.cone, tipMat)
      tip.scale.set(rad * 0.5, l * 0.32, rad * 0.36)
      tip.position.y = l * 0.86
      claw.add(tip)
    }
    if (id === 'kindred' && i !== 1) {
      const drop = new THREE.Mesh(tierGeo.bead, tipMat!)
      drop.scale.setScalar(rad * 0.42)
      drop.position.set(spec.axis === 'z' ? rad * 0.4 : 0, l * 0.62, spec.axis === 'x' ? rad * 0.4 : 0)
      claw.add(drop)
    }
    set.add(claw)
  }
  if (shape.guard != null) {
    const guardMat = new THREE.MeshLambertMaterial({ color: shape.guard, emissive: shape.guard, emissiveIntensity: id === 'immortal' ? 0.5 : 0.7 })
    const ring = new THREE.Mesh(tierGeo.ring, guardMat)
    const span = spec.gap * (shape.count - 1) * 0.4 + rad * 1.4
    const narrow = rad * 1.6
    // Torus lies in XY; turned flat, local Y runs along world Z and local Z along the claws.
    ring.rotation.x = Math.PI / 2
    if (spec.axis === 'z') ring.scale.set(narrow, span, rad * 1.6)
    else ring.scale.set(span, narrow, rad * 1.6)
    ring.position.y = rad * 0.6
    set.add(ring)
  }
  if (shape.ember != null) {
    const emberMat = new THREE.MeshLambertMaterial({ color: shape.ember, emissive: shape.ember, emissiveIntensity: 1.8 })
    const ember = new THREE.Mesh(tierGeo.bead, emberMat)
    ember.scale.setScalar(rad * 1.25)
    ember.position.y = rad * 0.9
    ember.name = 'ember'
    set.add(ember)
  }
  return set
}

function tierMaterial(id: ClawTierId): THREE.MeshLambertMaterial {
  const shape = TIER_SHAPE[id]
  const color = CLAW_TIERS.find((t) => t.id === id)!.color
  return new THREE.MeshLambertMaterial({ color, emissive: shape.base, emissiveIntensity: shape.glow })
}

/** Swap the hero's claw mesh to the owned tier. Other rigs keep their base claws. */
function applyClawTier(rig: Rig, tierId: ClawTierId): void {
  const tier = CLAW_TIERS.find((t) => t.id === tierId) ?? CLAW_TIERS[0]
  for (const hand of rig.claws) {
    const spec = hand.userData.clawSpec as ClawSpec | undefined
    if (!spec) continue
    let sets = hand.userData.clawSets as Record<ClawTierId, THREE.Group> | undefined
    if (!sets) {
      for (const child of hand.children) child.visible = false
      sets = {} as Record<ClawTierId, THREE.Group>
      hand.userData.clawSets = sets
    }
    if (!sets[tier.id]) {
      const mat = (rig.root.userData.clawMats ??= {}) as Partial<Record<ClawTierId, THREE.MeshLambertMaterial>>
      mat[tier.id] ??= tierMaterial(tier.id)
      sets[tier.id] = buildClawSet(tier.id, spec, mat[tier.id]!)
      hand.add(sets[tier.id])
    }
    for (const [id, set] of Object.entries(sets)) set.visible = id === tier.id
  }
  const mats = rig.root.userData.clawMats as Partial<Record<ClawTierId, THREE.MeshLambertMaterial>> | undefined
  if (mats?.[tier.id]) rig.mats.claw = mats[tier.id]
  rig.root.userData.clawTier = tier.id
}

/** The KayKit hero's weapon models: one per class and tier, all on the right hand. */
export type WeaponSet = Record<WeaponKind, Record<ClawTierId, { group: THREE.Group; mat: THREE.MeshLambertMaterial }>>

/**
 * Show the equipped weapon's model for its tier on a KayKit hero and point
 * `claws` and `mats.claw` at it, so the rank glow, trail tip, and hit flash follow.
 * Rigs without a weapon set (enemies, the procedural fallback hero) are left alone.
 */
export function equipWeapon(rig: Rig, kind: WeaponKind, tier: ClawTierId): void {
  const weapons = rig.root.userData.weapons as WeaponSet | undefined
  if (!weapons) return
  for (const [k, tiers] of Object.entries(weapons)) {
    for (const [t, w] of Object.entries(tiers)) w.group.visible = k === kind && t === tier
  }
  rig.claws.length = 0
  rig.claws.push(weapons[kind][tier].group)
  rig.mats.claw = weapons[kind][tier].mat
}

/** `tierId` is the owned weapon tier; the weapon level grows the mesh within it. */
export function applyGearVisual(
  rig: Rig,
  weaponLv: number,
  tierId: ClawTierId,
  capeLv: number,
  evolvedWeapon: boolean,
  evolvedCape: boolean,
  rankFrac = 0,
): void {
  applyClawTier(rig, tierId)
  const tiered = rig.root.userData.clawTier != null && rig.claws.some((hand) => hand.userData.clawSpec)
  const kay = Boolean(rig.root.userData.kayFist)
  const at = Math.max(0, CLAW_TIERS.findIndex((t) => t.id === tierId))
  const tier = CLAW_TIERS[at]
  const next = CLAW_TIERS[at + 1] ?? null
  if (rig.mats.claw) {
    if (tiered || kay) {
      const span = next ? Math.max(1, next.from - tier.from) : 10
      const into = Math.max(rankFrac, Math.min(1, Math.max(0, weaponLv - tier.from) / span))
      if (kay && !tiered) {
        // The tier color is baked into the model's material; the rank only brightens it.
        rig.mats.claw.emissiveIntensity = (rig.mats.claw.userData.glow ?? 1) * (1 + into * 0.6)
      } else {
        rig.mats.claw.emissiveIntensity = TIER_SHAPE[tier.id].glow * (1 + into * 0.45)
      }
    } else {
      const glow = Math.min(1.6, weaponLv * 0.05 + (evolvedWeapon ? 0.7 : 0))
      rig.mats.claw.emissive.set(evolvedWeapon ? 0xff2244 : 0x331018)
      rig.mats.claw.emissiveIntensity = glow
      if (evolvedWeapon) rig.mats.claw.color.set(0xf0d0d4)
    }
  }
  const grow = tiered || kay
    ? 1 + Math.min(0.14, (Math.max(0, weaponLv - tier.from) / Math.max(1, (next?.from ?? tier.from + 10) - tier.from)) * 0.14)
    : 1 + Math.min(0.45, (weaponLv - 1) * 0.012) + (evolvedWeapon ? 0.18 : 0)
  for (const c of rig.claws) c.scale.setScalar(grow)
  if (rig.mats.cape && evolvedCape) rig.mats.cape.color.set(0xc41a3a)
  if (rig.mats.trim) rig.mats.trim.emissiveIntensity = 0.2 + capeLv * 0.03 + (evolvedCape ? 0.45 : 0)
  if (rig.mats.gem) rig.mats.gem.emissiveIntensity = 1.2 + capeLv * 0.04
}
