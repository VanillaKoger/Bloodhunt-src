import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { HAVEN, RANGE_SPOTS, STATIONS, type StationId } from './haven'
import { addRim } from './polish'

/**
 * The Haven courtyard. A walled yard of old flagstones: tall walls to the
 * west and north (the far side from the camera), a low wall and iron fence
 * to the east and south so nothing hides the hero, the Night Gate in the
 * north wall, the range by the west wall, and the stations around the rest.
 */

export interface YardHandle {
  /** Round blockers the hero and dummies cannot walk through. */
  obstacles: { x: number; z: number; r: number }[]
  /** Lights up the station the hero stands at, or none. */
  highlight(id: StationId | null): void
  update(dt: number): void
}

const FAR_WALL_H = 3.4
const FAR_WALL_T = 0.6
const LOW_WALL_H = 0.55
const FENCE_H = 1.25

function mat(color: number, emissive = 0x000000, intensity = 0): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: intensity })
  addRim(m)
  return m
}

const STONE = mat(0x6a5870)
const STONE_DARK = mat(0x443850)
const CAP = mat(0x847090)
const IRON = mat(0x1a1620, 0x2a2232, 0.3)
const WOOD = mat(0x4a3020)
const WOOD_DARK = mat(0x2e1c14)
const BRASS = mat(0xb08428, 0x5a3a0c, 0.25)
const BONE = mat(0xe8dcc4, 0x5a5040, 0.3)
const CLOTH = mat(0x7a1428, 0x3a0812, 0.3)
const FLAME = mat(0xffb04a, 0xff8a2a, 2.4)
const BLOOD = mat(0x8a0a20, 0xc8102e, 0.7)
const BILE = mat(0x7ad82a, 0x6ad81a, 1.6)
const COAL = mat(0xff5a1a, 0xff4a10, 2)
const SAND = mat(0x5a4a3a)

class Bucket {
  private lists = new Map<THREE.Material, THREE.BufferGeometry[]>()

  add(material: THREE.Material, geometry: THREE.BufferGeometry): void {
    const geo = geometry.index ? geometry.toNonIndexed() : geometry
    if (geo !== geometry) geometry.dispose()
    geo.deleteAttribute('uv')
    const list = this.lists.get(material)
    if (list) list.push(geo)
    else this.lists.set(material, [geo])
  }

  flush(parent: THREE.Object3D): void {
    for (const [material, list] of this.lists) {
      const merged = mergeGeometries(list, false)
      for (const g of list) g.dispose()
      if (!merged) continue
      const mesh = new THREE.Mesh(merged, material)
      mesh.matrixAutoUpdate = false
      mesh.updateMatrix()
      mesh.receiveShadow = true
      parent.add(mesh)
    }
    this.lists.clear()
  }
}

function box(w: number, h: number, d: number): THREE.BufferGeometry {
  const m = Math.min(w, h, d)
  if (m < 0.1) return new THREE.BoxGeometry(w, h, d)
  return new RoundedBoxGeometry(w, h, d, 1, Math.min(0.06, m * 0.18))
}

/** A box centered at x, z with its base on y. */
function block(bucket: Bucket, material: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0): void {
  const geo = box(w, h, d)
  geo.applyMatrix4(new THREE.Matrix4().makeRotationY(ry).setPosition(x, y + h / 2, z))
  bucket.add(material, geo)
}

function cylinder(bucket: Bucket, material: THREE.Material, r0: number, r1: number, h: number, x: number, y: number, z: number, seg = 12): void {
  const geo = new THREE.CylinderGeometry(r0, r1, h, seg)
  geo.translate(x, y + h / 2, z)
  bucket.add(material, geo)
}

function sphere(bucket: Bucket, material: THREE.Material, r: number, x: number, y: number, z: number): void {
  const geo = new THREE.SphereGeometry(r, 10, 8)
  geo.translate(x, y, z)
  bucket.add(material, geo)
}

/** Dark flagstones with pale mortar, drawn once on a canvas and tiled. */
function flagstones(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')!
  g.fillStyle = '#2a2232'
  g.fillRect(0, 0, size, size)
  let seed = 7
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const rows = 4
  const h = size / rows
  for (let r = 0; r < rows; r++) {
    let x = r % 2 ? -h * 0.5 : 0
    while (x < size) {
      const w = h * (0.8 + rand() * 0.7)
      const shade = 84 + Math.floor(rand() * 26)
      g.fillStyle = `rgb(${shade}, ${shade - 10}, ${shade + 6})`
      g.fillRect(x + 3, r * h + 3, w - 6, h - 6)
      // A worn sheen near the top of each stone.
      g.fillStyle = 'rgba(255, 240, 255, 0.05)'
      g.fillRect(x + 6, r * h + 6, w - 12, h * 0.25)
      if (x + w > size) {
        g.fillStyle = `rgb(${shade}, ${shade - 10}, ${shade + 6})`
        g.fillRect(x + 3 - size, r * h + 3, w - 6, h - 6)
      }
      x += w
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** The gateway: near black in the middle, bleeding to crimson at the edges. */
function voidTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 192
  const g = canvas.getContext('2d')!
  const grad = g.createRadialGradient(64, 110, 8, 64, 110, 120)
  grad.addColorStop(0, '#050208')
  grad.addColorStop(0.45, '#1a0614')
  grad.addColorStop(0.8, '#6a0a24')
  grad.addColorStop(1, '#b0183a')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 192)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function label(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 56
  const g = canvas.getContext('2d')!
  g.fillStyle = 'rgba(14, 8, 16, 0.72)'
  g.beginPath()
  g.roundRect(4, 6, 248, 44, 14)
  g.fill()
  g.strokeStyle = 'rgba(232, 184, 74, 0.8)'
  g.lineWidth = 3
  g.stroke()
  g.fillStyle = '#f6e6c8'
  g.font = '700 26px Cinzel, Palatino, serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 128, 29)
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, opacity: 0.82 }),
  )
  sprite.scale.set(1.3, 0.285, 1)
  return sprite
}

/** A stone wall run from (x0, z0) to (x1, z1), with buttresses and a cap. */
function farWall(bucket: Bucket, x0: number, z0: number, x1: number, z1: number, skip?: { at: number; half: number }): void {
  const along = x0 === x1 ? 'z' : 'x'
  const len = along === 'x' ? x1 - x0 : z1 - z0
  const segs: [number, number][] = skip ? [[0, skip.at - skip.half], [skip.at + skip.half, len]] : [[0, len]]
  for (const [a, b] of segs) {
    const mid = (a + b) / 2
    const span = b - a
    if (span <= 0.01) continue
    const cx = along === 'x' ? x0 + mid : x0
    const cz = along === 'x' ? z0 : z0 + mid
    const w = along === 'x' ? span : FAR_WALL_T
    const d = along === 'x' ? FAR_WALL_T : span
    block(bucket, STONE, w, FAR_WALL_H, d, cx, 0, cz)
    block(bucket, CAP, w + 0.12, 0.16, d + 0.12, cx, FAR_WALL_H, cz)
    // A dark plinth course along the foot.
    block(bucket, STONE_DARK, w + 0.08, 0.36, d + 0.08, cx, 0, cz)
  }
  for (let t = 0; t <= len + 0.01; t += len / 5) {
    if (skip && Math.abs(t - skip.at) < skip.half + 0.6) continue
    const x = along === 'x' ? x0 + t : x0
    const z = along === 'x' ? z0 : z0 + t
    block(bucket, STONE_DARK, 0.7, FAR_WALL_H + 0.3, 0.7, x, 0, z)
    block(bucket, CAP, 0.84, 0.14, 0.84, x, FAR_WALL_H + 0.3, z)
  }
}

/** A knee wall topped with iron spikes, low enough for the camera to look over. */
function lowFence(bucket: Bucket, x0: number, z0: number, x1: number, z1: number): void {
  const along = x0 === x1 ? 'z' : 'x'
  const len = along === 'x' ? x1 - x0 : z1 - z0
  const cx = along === 'x' ? x0 + len / 2 : x0
  const cz = along === 'x' ? z0 : z0 + len / 2
  const w = along === 'x' ? len : 0.42
  const d = along === 'x' ? 0.42 : len
  block(bucket, STONE, w, LOW_WALL_H, d, cx, 0, cz)
  block(bucket, CAP, w + 0.08, 0.08, d + 0.08, cx, LOW_WALL_H, cz)
  const rail = (y: number) => block(bucket, IRON, along === 'x' ? len : 0.05, 0.05, along === 'x' ? 0.05 : len, cx, y, cz)
  rail(LOW_WALL_H + 0.18)
  rail(FENCE_H - 0.12)
  for (let t = 0.2; t < len; t += 0.32) {
    const x = along === 'x' ? x0 + t : x0
    const z = along === 'x' ? z0 : z0 + t
    cylinder(bucket, IRON, 0.022, 0.022, FENCE_H - LOW_WALL_H, x, LOW_WALL_H, z, 5)
    const tip = new THREE.ConeGeometry(0.045, 0.14, 4)
    tip.translate(x, FENCE_H + 0.07, z)
    bucket.add(IRON, tip)
  }
  for (let t = 0; t <= len + 0.01; t += len / 4) {
    const x = along === 'x' ? x0 + t : x0
    const z = along === 'x' ? z0 : z0 + t
    block(bucket, STONE_DARK, 0.5, 1.5, 0.5, x, 0, z)
    sphere(bucket, CAP, 0.17, x, 1.62, z)
  }
}

function torch(bucket: Bucket, flames: THREE.Vector3[], x: number, z: number, nx: number, nz: number): void {
  block(bucket, IRON, 0.08, 0.08, 0.36, x + nx * 0.18, 2.1, z + nz * 0.18, Math.atan2(nx, nz))
  cylinder(bucket, IRON, 0.09, 0.05, 0.16, x + nx * 0.36, 2.12, z + nz * 0.36, 6)
  flames.push(new THREE.Vector3(x + nx * 0.36, 2.4, z + nz * 0.36))
}

function station(bucket: Bucket, id: StationId, x: number, z: number): number {
  switch (id) {
    case 'gate':
      return 0
    case 'altar': {
      block(bucket, STONE_DARK, 1.5, 0.22, 1.0, x, 0, z)
      block(bucket, STONE, 1.2, 0.72, 0.72, x, 0.22, z)
      block(bucket, CAP, 1.3, 0.08, 0.82, x, 0.94, z)
      cylinder(bucket, IRON, 0.3, 0.22, 0.16, x, 1.02, z, 12)
      cylinder(bucket, BLOOD, 0.26, 0.26, 0.03, x, 1.15, z, 12)
      for (const side of [-1, 1]) {
        cylinder(bucket, BONE, 0.045, 0.05, 0.28, x + side * 0.5, 1.02, z, 6)
        sphere(bucket, FLAME, 0.035, x + side * 0.5, 1.34, z)
      }
      return 0.72
    }
    case 'armory': {
      block(bucket, WOOD_DARK, 1.3, 0.12, 0.4, x, 0, z)
      for (const side of [-1, 1]) block(bucket, WOOD, 0.1, 1.7, 0.1, x + side * 0.6, 0, z)
      block(bucket, WOOD, 1.3, 0.1, 0.12, x, 1.6, z)
      block(bucket, WOOD, 1.3, 0.08, 0.1, x, 0.5, z)
      for (const [dx, h] of [[-0.36, 1.3], [-0.12, 1.45], [0.12, 1.2], [0.36, 1.38]] as const) {
        block(bucket, IRON, 0.06, h, 0.02, x + dx, 0.16, z + 0.08)
        block(bucket, BRASS, 0.2, 0.04, 0.05, x + dx, 0.16 + h * 0.22, z + 0.08)
      }
      return 0.55
    }
    case 'wardrobe': {
      block(bucket, WOOD_DARK, 1.3, 2.1, 0.62, x, 0, z)
      block(bucket, WOOD, 1.38, 0.1, 0.7, x, 2.1, z)
      for (const side of [-1, 1]) block(bucket, WOOD, 0.58, 1.8, 0.04, x + side * 0.31, 0.14, z + 0.32)
      sphere(bucket, BRASS, 0.035, x - 0.05, 1.05, z + 0.36)
      sphere(bucket, BRASS, 0.035, x + 0.05, 1.05, z + 0.36)
      // A dressed stand beside it with a cape.
      cylinder(bucket, WOOD, 0.22, 0.26, 0.06, x + 1.05, 0, z + 0.1, 10)
      cylinder(bucket, WOOD, 0.03, 0.03, 1.4, x + 1.05, 0.06, z + 0.1, 6)
      block(bucket, CLOTH, 0.44, 0.9, 0.08, x + 1.05, 0.55, z + 0.02)
      sphere(bucket, BONE, 0.11, x + 1.05, 1.58, z + 0.1)
      return 0.7
    }
    case 'forge': {
      block(bucket, STONE_DARK, 0.9, 0.62, 0.7, x + 0.2, 0, z - 0.45)
      block(bucket, COAL, 0.66, 0.06, 0.46, x + 0.2, 0.62, z - 0.45)
      block(bucket, IRON, 0.28, 0.4, 0.22, x - 0.2, 0, z + 0.35)
      block(bucket, IRON, 0.62, 0.16, 0.26, x - 0.2, 0.4, z + 0.35)
      sphere(bucket, BONE, 0.1, x + 0.45, 0.72, z - 0.3)
      return 0.68
    }
    case 'font': {
      cylinder(bucket, STONE_DARK, 0.28, 0.36, 0.62, x, 0, z, 10)
      cylinder(bucket, STONE, 0.56, 0.4, 0.22, x, 0.62, z, 14)
      cylinder(bucket, BLOOD, 0.5, 0.5, 0.03, x, 0.83, z, 14)
      return 0.6
    }
    case 'still': {
      cylinder(bucket, BRASS, 0.42, 0.46, 0.8, x, 0, z, 12)
      cylinder(bucket, BILE, 0.36, 0.36, 0.04, x, 0.8, z, 12)
      cylinder(bucket, BRASS, 0.08, 0.08, 0.5, x, 0.84, z, 8)
      const pipe = new THREE.TorusGeometry(0.28, 0.035, 6, 12, Math.PI)
      pipe.rotateY(Math.PI / 2)
      pipe.translate(x, 1.34, z - 0.28)
      bucket.add(BRASS, pipe)
      cylinder(bucket, BRASS, 0.035, 0.035, 1.34, x, 0, z - 0.56, 6)
      block(bucket, WOOD_DARK, 0.4, 0.3, 0.4, x - 0.2, 0, z + 0.62)
      return 0.62
    }
    case 'locker': {
      block(bucket, WOOD_DARK, 1.0, 0.5, 0.6, x, 0, z)
      block(bucket, WOOD, 1.04, 0.16, 0.64, x, 0.5, z)
      for (const dx of [-0.42, 0, 0.42]) block(bucket, BRASS, 0.06, 0.68, 0.66, x + dx, 0, z)
      block(bucket, BRASS, 0.16, 0.16, 0.04, x, 0.36, z - 0.32)
      return 0.62
    }
    case 'ossuary': {
      block(bucket, STONE_DARK, 1.2, 0.36, 0.7, x, 0, z)
      for (let i = 0; i < 7; i++) {
        const a = i * 1.7
        sphere(bucket, BONE, 0.11, x - 0.42 + (i % 4) * 0.28, 0.46 + Math.floor(i / 4) * 0.17, z + Math.sin(a) * 0.12)
      }
      for (const [dx, ry] of [[-0.3, 0.4], [0.2, -0.6], [0.4, 1.2]] as const) {
        const bone = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 5)
        bone.rotateZ(Math.PI / 2)
        bone.rotateY(ry)
        bone.translate(x + dx, 0.4, z - 0.2)
        bucket.add(BONE, bone)
      }
      return 0.65
    }
  }
}

export function buildYard(scene: THREE.Scene, low: boolean): YardHandle {
  const group = new THREE.Group()
  group.name = 'haven-yard'
  const bucket = new Bucket()
  const { minX, maxX, minZ, maxZ } = HAVEN
  const w = maxX - minX
  const d = maxZ - minZ

  const tex = flagstones()
  tex.repeat.set(w / 2.2, d / 2.2)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w + 1.6, d + 1.6), new THREE.MeshLambertMaterial({ map: tex, color: 0xc8b8d0 }))
  floor.rotation.x = -Math.PI / 2
  floor.position.set(HAVEN.x, 0.012, HAVEN.z)
  floor.receiveShadow = true
  group.add(floor)

  // A crimson runner from the arrival spot to the gate.
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 9.6), mat(0x5a0c1c, 0x2a0410, 0.4))
  runner.rotation.x = -Math.PI / 2
  runner.position.set(HAVEN.x, 0.02, -22.4)
  group.add(runner)
  for (const side of [-1, 1]) {
    const trim = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 9.6), BRASS)
    trim.rotation.x = -Math.PI / 2
    trim.position.set(HAVEN.x + side * 0.78, 0.022, -22.4)
    group.add(trim)
  }

  // The range: a sand strip along the west wall with a red line to stand behind.
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 11.6), SAND)
  sand.rotation.x = -Math.PI / 2
  sand.position.set(minX + 2.0, 0.018, -19.6)
  group.add(sand)
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 11.6), mat(0xc41a3a, 0xff2244, 0.8))
  line.rotation.x = -Math.PI / 2
  line.position.set(minX + 3.8, 0.024, -19.6)
  group.add(line)
  for (const spot of RANGE_SPOTS) {
    cylinder(bucket, WOOD_DARK, 0.62, 0.66, 0.06, spot.x, 0, spot.z, 14)
    // A post and crossbar behind each target, hung with a scrap of cloth.
    block(bucket, WOOD, 0.12, 2.3, 0.12, spot.x - 0.8, 0, spot.z)
    block(bucket, WOOD, 0.1, 0.1, 1.1, spot.x - 0.8, 2.1, spot.z)
    block(bucket, CLOTH, 0.04, 0.5, 0.36, spot.x - 0.74, 1.5, spot.z + 0.3)
  }

  // Far walls, west and north; the gate opens in the middle of the north wall.
  farWall(bucket, minX - 0.3, minZ - 0.3, minX - 0.3, maxZ + 0.3)
  farWall(bucket, minX - 0.3, minZ - 0.3, maxX + 0.3, minZ - 0.3, { at: HAVEN.x - (minX - 0.3), half: 1.5 })
  // Near sides: a knee wall and fence the camera sees over.
  lowFence(bucket, maxX + 0.2, minZ - 0.3, maxX + 0.2, maxZ + 0.2)
  lowFence(bucket, minX - 0.3, maxZ + 0.2, maxX + 0.2, maxZ + 0.2)

  // The Night Gate: two tall piers, a lintel, and a dark doorway that glows.
  const gx = HAVEN.x
  const gz = minZ - 0.3
  for (const side of [-1, 1]) {
    block(bucket, STONE_DARK, 0.9, 4.3, 0.95, gx + side * 1.75, 0, gz)
    block(bucket, CAP, 1.04, 0.2, 1.08, gx + side * 1.75, 4.3, gz)
    sphere(bucket, BONE, 0.2, gx + side * 1.75, 4.66, gz)
  }
  block(bucket, STONE, 4.4, 0.6, 0.8, gx, 3.6, gz)
  block(bucket, CAP, 4.6, 0.14, 0.9, gx, 4.2, gz)
  block(bucket, IRON, 3.0, 0.14, 0.2, gx, 0, gz + 0.1)
  const portalMat = new THREE.MeshBasicMaterial({ map: voidTexture(), color: 0xffffff, side: THREE.DoubleSide })
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.6), portalMat)
  portal.position.set(gx, 1.8, gz)
  group.add(portal)
  const veilMat = new THREE.MeshBasicMaterial({
    color: 0xff3a6a,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.6), veilMat)
  veil.position.set(gx, 1.8, gz + 0.05)
  group.add(veil)
  const sigil = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 32), mat(0xff3a5a, 0xff2244, 1.6))
  sigil.rotation.x = -Math.PI / 2
  sigil.position.set(gx, 0.03, gz + 1.6)
  group.add(sigil)

  // Torches on the far walls.
  const flames: THREE.Vector3[] = []
  for (const z of [-25.4, -19.6, -13.8]) torch(bucket, flames, minX - 0.3 + FAR_WALL_T / 2, z, 1, 0)
  for (const x of [73.4, 77.2, 82.8, 86.6]) torch(bucket, flames, x, minZ - 0.3 + FAR_WALL_T / 2, 0, 1)

  const obstacles: { x: number; z: number; r: number }[] = []
  const halos = new Map<StationId, THREE.Mesh>()
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xffd27a,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
  for (const s of STATIONS) {
    const r = station(bucket, s.id, s.x, s.z)
    if (r > 0) obstacles.push({ x: s.x, z: s.z, r })
    const tag = label(s.label)
    tag.position.set(s.x, s.id === 'gate' ? 4.9 : s.id === 'wardrobe' || s.id === 'armory' ? 2.5 : 1.7, s.z)
    group.add(tag)
    const halo = new THREE.Mesh(new THREE.RingGeometry(Math.max(0.5, r + 0.25), Math.max(0.62, r + 0.37), 32), haloMat)
    halo.rotation.x = -Math.PI / 2
    halo.position.set(s.x, 0.035, s.z + (s.id === 'gate' ? 1.6 : 0))
    halo.visible = false
    group.add(halo)
    halos.set(s.id, halo)
  }

  bucket.flush(group)

  const flameMeshes: THREE.Mesh[] = []
  const flameGeo = new THREE.ConeGeometry(0.08, 0.24, 6)
  for (const at of flames) {
    const flame = new THREE.Mesh(flameGeo, FLAME)
    flame.position.copy(at)
    group.add(flame)
    flameMeshes.push(flame)
  }
  const lights: THREE.PointLight[] = []
  if (!low) {
    const spots: [number, number, number, number][] = [
      [80, 2.6, -25.6, 0xff4a6a],
      [74.2, 2.4, -19.6, 0xffb15a],
      [86.0, 2.4, -24.6, 0xffb15a],
      [84.6, 2.2, -14.6, 0xffb15a],
      [77.0, 2.2, -14.6, 0xffb15a],
    ]
    for (const [x, y, z, c] of spots) {
      const light = new THREE.PointLight(c, 12, 10, 1.6)
      light.position.set(x, y, z)
      group.add(light)
      lights.push(light)
    }
  }
  scene.add(group)
  let t = 0
  let lit: StationId | null = null
  return {
    obstacles,
    highlight(id) {
      if (id === lit) return
      if (lit) halos.get(lit)!.visible = false
      lit = id
      if (id) halos.get(id)!.visible = true
    },
    update(dt) {
      t += dt
      veilMat.opacity = 0.1 + Math.sin(t * 2.1) * 0.05
      portalMat.color.setScalar(0.85 + Math.sin(t * 1.3) * 0.15)
      sigil.rotation.z = t * 0.4
      haloMat.opacity = 0.38 + Math.sin(t * 4) * 0.14
      flameMeshes.forEach((f, i) => {
        const k = 1 + Math.sin(t * 11 + i * 1.9) * 0.12
        f.scale.set(k, 1 + Math.sin(t * 9 + i) * 0.2, k)
      })
      lights.forEach((l, i) => {
        l.intensity = 12 + Math.sin(t * 7 + i * 2.3) * 1.2
      })
    },
  }
}
