import * as THREE from 'three'
import { HAVEN } from './haven'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  COMMON_WALL_H,
  ZONE1,
  ZONE2,
  ZONE3,
  inSlums,
  type SlumRect,
} from './world'

/**
 * Visual city outside the playable Slums. Nothing here is walkable.
 * One block only: the backs of the next block, a Kenney asphalt street, and
 * the far side of that street. KayKit City Builder Bits has no road meshes in
 * this project, so the streets use the asphalt tiles already in the pack.
 * Buildings stay whole KayKit meshes. Purple fog hides anything past the ring.
 */

interface Prep {
  object: THREE.Object3D
  size: THREE.Vector3
}

interface RoadTile {
  x: number
  z: number
  yaw: number
  w: number
  len: number
  y: number
  damaged: boolean
}

interface Spot {
  x: number
  z: number
  r: number
}

const NATIVE_H = [1.55, 1.55, 2.25, 2.25, 2.25, 2.25, 2.25, 2.95]
const BUILDINGS = [
  'building_A_withoutBase',
  'building_B_withoutBase',
  'building_C_withoutBase',
  'building_D_withoutBase',
  'building_E_withoutBase',
  'building_F_withoutBase',
  'building_G_withoutBase',
  'building_H_withoutBase',
]
const CLEAR = 4.85
const DEPTH = 3.15
const WIDTH = 3.05

type Hood = 'avenue' | 'yard' | 'tenement' | 'street'

class Merger {
  private lists = new Map<THREE.Material, THREE.BufferGeometry[]>()

  constructor(private readonly name: string) {}

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
      mesh.name = this.name
      mesh.matrixAutoUpdate = false
      mesh.castShadow = false
      mesh.receiveShadow = false
      mesh.updateMatrix()
      scene.add(mesh)
    }
  }
}

function hash(n: number): number {
  let h = Math.imul(n + 1, 0x9e3779b1) ^ 0x51ed1e7
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return h >>> 0
}

function blocked(x: number, z: number): boolean {
  return inSlums(x, z, -CLEAR) || nearHaven(x, z)
}

/** The Haven yard and a wide margin on its camera side stay clear of city shells. */
function nearHaven(x: number, z: number): boolean {
  return x > HAVEN.minX - 2.5 && x < HAVEN.maxX + 12 && z > HAVEN.minZ - 2.5 && z < HAVEN.maxZ + 12
}

function inYard(x: number, z: number): boolean {
  const west = x < ZONE2.x0 - 4.4 && x > ZONE2.x0 - 18 && z > ZONE2.z0 - 3 && z < ZONE2.z1 + 16
  const north = z > ZONE2.z1 + 4.4 && z < ZONE2.z1 + 18 && x > ZONE2.x0 - 18 && x < ZONE2.x1 + 2
  return west || north
}

function hoodFor(which: 'z1' | 'z2' | 'z3', ox: number, oz: number): Hood {
  if (which === 'z1' && ox > 0.5) return 'avenue'
  if (which === 'z2' && (ox < -0.5 || oz > 0.5)) return 'yard'
  if (which === 'z3' && (oz < -0.5 || ox < -0.5)) return 'tenement'
  return 'street'
}

function yawOf(ox: number, oz: number): number {
  return Math.atan2(ox, oz)
}

function firstMaterial(prep: Prep): THREE.Material | null {
  let found: THREE.Material | null = null
  prep.object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!found && mesh.isMesh) found = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  })
  return found
}

function bakedGeo(prep: Prep): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = []
  prep.object.updateWorldMatrix(true, true)
  prep.object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const geo = mesh.geometry.clone()
    geo.applyMatrix4(mesh.matrixWorld)
    parts.push(geo.index ? geo.toNonIndexed() : geo)
  })
  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]
  const merged = mergeGeometries(parts, false)
  for (const geo of parts) geo.dispose()
  return merged
}

function stamp(prep: Prep, x: number, y: number, z: number, yaw: number, dx: number, dy: number, dz: number, merger: Merger, material?: THREE.Material): void {
  const obj = prep.object.clone(true)
  obj.position.set(x, y, z)
  obj.rotation.y = yaw
  obj.scale.set(dx / Math.max(0.001, prep.size.x), dy / Math.max(0.001, prep.size.y), dz / Math.max(0.001, prep.size.z))
  obj.updateMatrixWorld(true)
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const mat = material ?? (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material)
    merger.add(mesh, mat)
  })
}

export function dressCity(
  scene: THREE.Scene,
  props: Record<string, Prep>,
  occlude: (key: string, x: number, z: number, yaw: number, w: number, h: number, d: number) => void,
): (dt: number) => void {
  const shells = new Merger('city-shell')
  const merger = new Merger('city-prop')
  const spots: Spot[] = []
  const roads: RoadTile[] = []
  const flickSprites: THREE.SpriteMaterial[] = []

  const taken = (x: number, z: number, r: number) => spots.some((spot) => Math.hypot(spot.x - x, spot.z - z) < spot.r + r)
  const claim = (x: number, z: number, r: number) => spots.push({ x, z, r })

  const shellH = (kind: number, tall: boolean) => (NATIVE_H[kind] / 2.25) * COMMON_WALL_H * (tall ? 1.72 : 1.62)

  const placeShell = (x: number, z: number, yaw: number, kind: number, tall: boolean, fade: boolean) => {
    const key = BUILDINGS[kind]
    const prep = props[key]
    if (!prep) return
    const h = shellH(kind, tall)
    if (taken(x, z, 1.35) || blocked(x, z)) return
    if (inYard(x, z)) return
    claim(x, z, 1.7)
    if (fade) occlude(key, x, z, yaw, WIDTH, h, DEPTH)
    else stamp(prep, x, 0, z, yaw, WIDTH, h, DEPTH, shells)
  }

  const addRoad = (x: number, z: number, yaw: number, w: number, len: number, y: number, damaged: boolean) => {
    if (blocked(x, z) || inSlums(x, z, -5.1)) return
    roads.push({ x, z, yaw, w, len, y, damaged })
  }

  const lampMat = new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,196,120,0.9)'),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true,
  })

  let lampN = 0
  const addLamp = (x: number, z: number, yaw: number) => {
    if (blocked(x, z)) return
    const key = hash(lampN) % 3 === 0 ? 'light-curved' : 'detail-light-single'
    const prep = props[key]
    if (prep) stamp(prep, x, 0, z, yaw, 0.55, 3.35, 0.55, merger)
    const flick = lampN % 7 === 2
    const mat = flick ? lampMat.clone() : lampMat
    if (flick) flickSprites.push(mat)
    const sprite = new THREE.Sprite(mat)
    sprite.name = 'city-lamp'
    sprite.position.set(x, 3.15, z)
    sprite.scale.set(1.7, 1.7, 1)
    scene.add(sprite)
    lampN++
  }

  const trace = (room: SlumRect, which: 'z1' | 'z2' | 'z3') => {
    const edges: [number, number, number, number, number, number][] = [
      [room.x0, room.z0, room.x1, room.z0, 0, -1],
      [room.x1, room.z0, room.x1, room.z1, 1, 0],
      [room.x1, room.z1, room.x0, room.z1, 0, 1],
      [room.x0, room.z1, room.x0, room.z0, -1, 0],
    ]
    edges.forEach(([x0, z0, x1, z1, ox, oz], edge) => {
      const hood = hoodFor(which, ox, oz)
      const len = Math.hypot(x1 - x0, z1 - z0)
      if (len < 3) return
      const dx = (x1 - x0) / len
      const dz = (z1 - z0) / len
      const outYaw = yawOf(ox, oz)
      const inYaw = yawOf(-ox, -oz)
      const alongYaw = Math.atan2(dx, dz)
      layHaze(x0, z0, dx, dz, ox, oz, len)
      if (hood === 'yard') {
        layYard(x0, z0, dx, dz, ox, oz, len)
        return
      }
      if (hood === 'avenue') {
        const mid = 5.1 + 4.15
        for (let d = 2.2; d < len - 2; d += 4.3) {
          const cx = x0 + dx * d + ox * mid
          const cz = z0 + dz * d + oz * mid
          addRoad(cx, cz, alongYaw, 8.3, 4.3, 0.035, false)
          if (Math.floor(d) % 9 < 5) addLamp(cx + ox * 3.5, cz + oz * 3.5, inYaw)
        }
        const face = 5.1 + 8.3 + 0.55 + DEPTH / 2
        let n = 0
        for (let d = 2.4; d < len - 2.2; d += 3.7) {
          const kind = hash(edge * 17 + n) % 2 === 0 ? 7 : 5
          placeShell(x0 + dx * d + ox * face, z0 + dz * d + oz * face, inYaw, kind, true, false)
          if (n % 4 === 1) addLamp(x0 + dx * d + ox * (5.1 + 8.3 - 0.6), z0 + dz * d + oz * (5.1 + 8.3 - 0.6), outYaw)
          n++
        }
        return
      }
      const step = hood === 'tenement' ? 3.05 : 3.6
      const back = CLEAR + DEPTH / 2
      const street = CLEAR + DEPTH + 0.55 + 2.4
      const far = street + 2.4 + 0.5 + DEPTH / 2
      let n = 0
      for (let d = 1.9; d < len - 1.8; d += step) {
        const bx = x0 + dx * d + ox * back
        const bz = z0 + dz * d + oz * back
        const kind = hash(n * 13 + edge * 29 + (which === 'z3' ? 4 : 1)) % 8
        const fade = ox + oz > 0
        placeShell(bx, bz, outYaw, kind, false, fade)
        if (hood === 'tenement' && n % 2 === 0) layEscape(bx, bz, ox, oz, dx, dz, n)
        if (n % 4 === 0) addRoad(x0 + dx * d + ox * street, z0 + dz * d + oz * street, alongYaw, 4.8, step, 0.04, hood === 'tenement' && n % 8 === 0)
        if (n % 5 === 2) addLamp(x0 + dx * d + ox * (street + 1.7), z0 + dz * d + oz * (street + 1.7), inYaw)
        const farKind = hash(n + 9 + edge) % 8
        placeShell(x0 + dx * d + ox * far, z0 + dz * d + oz * far, inYaw, farKind, false, false)
        n++
      }
    })
  }

  const layHaze = (x0: number, z0: number, dx: number, dz: number, ox: number, oz: number, len: number) => {
    const inner = 18
    const depth = 16
    const cx = x0 + dx * (len / 2) + ox * (inner + depth / 2)
    const cz = z0 + dz * (len / 2) + oz * (inner + depth / 2)
    const yaw = Math.atan2(-dz, dx)
    const sheetGeo = new THREE.PlaneGeometry(len + 4, depth)
    sheetGeo.rotateX(-Math.PI / 2)
    const sheetMat = new THREE.MeshBasicMaterial({
      color: 0x1c1028,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      fog: true,
      side: THREE.DoubleSide,
    })
    const sheet = new THREE.Mesh(sheetGeo, sheetMat)
    sheet.name = 'city-fog'
    sheet.position.set(cx, 0.55, cz)
    sheet.rotation.y = yaw
    scene.add(sheet)
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(len + 4, 3.2),
      sheetMat.clone(),
    )
    ;(wall.material as THREE.MeshBasicMaterial).opacity = 0.18
    wall.name = 'city-fog'
    wall.position.set(cx + ox * (depth / 2 - 1), 1.4, cz + oz * (depth / 2 - 1))
    wall.rotation.y = yawOf(ox, oz)
    scene.add(wall)
  }

  const layEscape = (x: number, z: number, ox: number, oz: number, dx: number, dz: number, n: number) => {
    const bx = x - ox * (DEPTH / 2 + 0.2)
    const bz = z - oz * (DEPTH / 2 + 0.2)
    const yaw = yawOf(-ox, -oz)
    const ladder = props['balcony-ladder-bottom']
    const top = props['balcony-ladder-top']
    const deck = props['balcony-type-a']
    if (ladder) stamp(ladder, bx, 0, bz, yaw, 0.85, 1.7, 0.7, merger)
    if (top) stamp(top, bx, 1.55, bz, yaw, 0.85, 1.45, 0.7, merger)
    if (deck) stamp(deck, bx - ox * 0.15, 2.15, bz - oz * 0.15, yaw, 1.1, 0.35, 0.7, merger)
    if (n % 4 !== 0) return
    const y = 3.05
    const span = 2.4
    const clothMat = [cloth(0xd7c2a4), cloth(0xc45a3a), cloth(0x6e8a62)]
    for (let i = 0; i < 3; i++) {
      const t = (i + 0.5) / 3
      const clothMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.46), clothMat[i])
      clothMesh.name = 'city-cloth'
      clothMesh.position.set(bx + dx * (t - 0.5) * span, y - 0.34, bz + dz * (t - 0.5) * span)
      clothMesh.rotation.y = yaw + 0.2
      clothMesh.castShadow = false
      scene.add(clothMesh)
    }
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, span, 4), cloth(0x3d2918))
    rope.name = 'city-cloth'
    rope.position.set(bx, y, bz)
    rope.rotation.z = Math.PI / 2
    rope.rotation.y = Math.atan2(oz, ox)
    scene.add(rope)
  }

  const layYard = (x0: number, z0: number, dx: number, dz: number, ox: number, oz: number, len: number) => {
    const inner = CLEAR + 0.4
    const outer = 15.5
    const mid = (inner + outer) / 2
    const yaw = Math.atan2(dx, dz)
    for (let d = 2; d < len - 1.5; d += 4.2) {
      addRoad(x0 + dx * d + ox * (outer + 2.6), z0 + dz * d + oz * (outer + 2.6), yaw, 4.6, 4.2, 0.03, true)
    }
    const fence = props['construction-fence']
    const lowWall = props['wall-fence']
    const scaffold = props['scaffolding-structure']
    const pallet = props.pallet
    const dump = props.dumpster ?? props['detail-dumpster-closed']
    const barrel = props.barrel
    for (let d = 1.6; d < len - 1.2; d += 3.3) {
      const fx = x0 + dx * d + ox * (inner + 1.2)
      const fz = z0 + dz * d + oz * (inner + 1.2)
      if (fence && d % 7 < 4) stamp(fence, fx, 0, fz, yaw, 3.1, 1.15, 0.35, merger)
      else if (lowWall) stamp(lowWall, fx, 0, fz, yaw, 2.6, 1.05, 0.2, merger)
      if (scaffold && Math.floor(d) % 9 === 3) stamp(scaffold, x0 + dx * d + ox * mid, 0, z0 + dz * d + oz * mid, yaw, 2.4, 5.4, 1.6, merger)
      if (pallet && Math.floor(d) % 6 === 2) stamp(pallet, x0 + dx * d + ox * (mid - 1.5), 0, z0 + dz * d + oz * (mid - 1.5), yaw + 0.4, 1.1, 0.7, 0.8, merger)
      if (dump && Math.floor(d) % 11 === 5) stamp(dump, x0 + dx * d + ox * (outer - 2.2), 0, z0 + dz * d + oz * (outer - 2.2), yaw, 1.4, 1.15, 0.9, merger)
      if (barrel && Math.floor(d) % 5 === 1) stamp(barrel, x0 + dx * d + ox * (inner + 2.4), 0, z0 + dz * d + oz * (inner + 2.4), 0.2, 0.55, 0.7, 0.55, merger)
    }
  }

  trace(ZONE1, 'z1')
  trace(ZONE2, 'z2')
  trace(ZONE3, 'z3')

  const sedan = props.sedan
  const taxi = props.taxi
  const cars: [Prep | undefined, number, number, number][] = [
    [sedan, ZONE1.x1 + 7.4, -7.2, 0.08],
    [taxi, ZONE1.x1 + 11.2, -1.4, 3.05],
    [sedan, ZONE1.x1 + 7.6, 5.5, 0.15],
    [taxi, ZONE1.x1 + 11.4, 10.2, 3.2],
  ]
  cars.forEach(([prep, x, z, yaw]) => {
    if (!prep || blocked(x, z) || inSlums(x, z, -6)) return
    stamp(prep, x, 0, z, yaw, 1.7, 1.25, 3.9, merger)
    claim(x, z, 2.2)
  })

  layRoadMeshes(scene, props, roads)

  const fogMat = new THREE.MeshBasicMaterial({
    color: 0x3a2860,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    fog: true,
    side: THREE.DoubleSide,
  })
  const fogA = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.4), fogMat)
  fogA.name = 'city-fog'
  fogA.position.set(ZONE1.x1 + 9.2, 1.35, 0)
  fogA.rotation.y = Math.PI / 2
  scene.add(fogA)
  const fogB = new THREE.Mesh(new THREE.PlaneGeometry(18, 2.2), fogMat.clone())
  fogB.name = 'city-fog'
  fogB.position.set(-2, 1.2, ZONE1.z0 - 10.8)
  scene.add(fogB)
  ;(fogB.material as THREE.MeshBasicMaterial).opacity = 0.14

  merger.flush(scene)
  shells.flush(scene)

  let time = 0
  return (dt: number) => {
    time += dt
    fogA.position.z = Math.sin(time * 0.13) * 7
    fogB.position.x = -2 + Math.sin(time * 0.1 + 0.8) * 6
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.6)
    for (const mat of flickSprites) mat.opacity = 0.35 + pulse * 0.6
  }
}

const clothCache: THREE.MeshLambertMaterial[] = []
function cloth(color: number): THREE.MeshLambertMaterial {
  let mat = clothCache.find((entry) => entry.color.getHex() === color)
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.18, side: THREE.DoubleSide })
    clothCache.push(mat)
  }
  return mat
}

function layRoadMeshes(scene: THREE.Scene, props: Record<string, Prep>, roads: RoadTile[]): void {
  const straight = props['road-asphalt-straight']
  const damaged = props['road-asphalt-damaged']
  buildRoadMesh(scene, straight, roads.filter((road) => !road.damaged))
  buildRoadMesh(scene, damaged, roads.filter((road) => road.damaged))
}

function buildRoadMesh(scene: THREE.Scene, prep: Prep | undefined, roads: RoadTile[]): void {
  if (!prep || roads.length === 0) return
  const geo = bakedGeo(prep)
  const material = firstMaterial(prep)
  if (!geo || !material) return
  const mesh = new THREE.InstancedMesh(geo, material, roads.length)
  mesh.name = 'city-road'
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.frustumCulled = false
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const s = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  roads.forEach((road, index) => {
    p.set(road.x, road.y, road.z)
    q.setFromAxisAngle(up, road.yaw)
    s.set(road.w / Math.max(0.001, prep.size.x), 0.07 / Math.max(0.001, prep.size.y), road.len / Math.max(0.001, prep.size.z))
    m.compose(p, q, s)
    mesh.setMatrixAt(index, m)
  })
  mesh.instanceMatrix.needsUpdate = true
  scene.add(mesh)
}

function glowTexture(inner: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const g = canvas.getContext('2d')!
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32)
  grd.addColorStop(0, inner)
  grd.addColorStop(1, 'rgba(255,140,40,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
