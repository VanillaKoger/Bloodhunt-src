import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { DecorLib } from './decor'
import { MAPS, MAP_IDS, type MapDef, type MapId, type Palette, type Rect, type ZoneDef } from './maps'
import { addRim } from './polish'
import { ZONE1 } from './world'

/**
 * Placeholder art for the maps that have no hand-built set yet. Everything
 * is made of a few primitives per theme so the layouts can be played and
 * judged before the real art goes in: a patterned floor, walls (tall on the
 * far side, low on the camera side so nothing hides the hero), sealed gates
 * toward the neighboring zones, and props that say what the place is.
 * Where a free model pack has the right piece (decor.ts, CREDITS.md), the
 * prop is that model instead, sized and tinted for the map.
 */

export interface MapArtHandle {
  /** Round blockers the hero and enemies walk around. */
  obstacles: { x: number; z: number; r: number }[]
  update(dt: number): void
}

const matCache = new Map<string, THREE.MeshLambertMaterial>()
const SELF_LIT = 0.35

/**
 * Placeholder materials glow faintly in their own color, so the dark
 * palettes still read under the night's lights until real art and lamps go in.
 */
function mat(color: number, emissive = color, intensity = SELF_LIT): THREE.MeshLambertMaterial {
  const key = `${color}-${emissive}-${intensity}`
  const hit = matCache.get(key)
  if (hit) return hit
  const m = new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: intensity })
  addRim(m)
  matCache.set(key, m)
  return m
}

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
      parent.add(mesh)
    }
    this.lists.clear()
  }
}

let seed = 1
function rand(): number {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
}

function box(b: Bucket, m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0): void {
  const g = new THREE.BoxGeometry(w, h, d)
  g.applyMatrix4(new THREE.Matrix4().makeRotationY(ry).setPosition(x, y + h / 2, z))
  b.add(m, g)
}

function cyl(b: Bucket, m: THREE.Material, r0: number, r1: number, h: number, x: number, y: number, z: number, seg = 8): void {
  const g = new THREE.CylinderGeometry(r0, r1, h, seg)
  g.translate(x, y + h / 2, z)
  b.add(m, g)
}

function cone(b: Bucket, m: THREE.Material, r: number, h: number, x: number, y: number, z: number, seg = 7): void {
  const g = new THREE.ConeGeometry(r, h, seg)
  g.translate(x, y + h / 2, z)
  b.add(m, g)
}

function ball(b: Bucket, m: THREE.Material, r: number, x: number, y: number, z: number): void {
  const g = new THREE.SphereGeometry(r, 8, 6)
  g.translate(x, y, z)
  b.add(m, g)
}

// ------------------------------------------------------------------ floors

const texCache = new Map<string, THREE.CanvasTexture>()

/** A tiling floor pattern drawn once on a canvas, in the floor's own color. */
function floorTexture(p: Palette): THREE.CanvasTexture {
  const key = `${p.pattern}-${p.floor}`
  const hit = texCache.get(key)
  if (hit) return hit
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')!
  const base = new THREE.Color(p.floor)
  // Shade in sRGB, the canvas's own space, so the texture decodes back to the palette color.
  const srgb = { r: 0, g: 0, b: 0 }
  base.getRGB(srgb, THREE.SRGBColorSpace)
  const shade = (k: number) => `rgb(${Math.min(255, srgb.r * k * 255) | 0}, ${Math.min(255, srgb.g * k * 255) | 0}, ${Math.min(255, srgb.b * k * 255) | 0})`
  g.fillStyle = shade(1)
  g.fillRect(0, 0, size, size)
  seed = 7
  switch (p.pattern) {
    case 'grass':
    case 'dirt':
      for (let i = 0; i < 900; i++) {
        g.fillStyle = shade(0.75 + rand() * 0.6)
        g.fillRect(rand() * size, rand() * size, 2 + rand() * 3, 2 + rand() * 3)
      }
      break
    case 'planks':
      for (let row = 0; row < 8; row++) {
        g.fillStyle = shade(0.85 + rand() * 0.3)
        g.fillRect(0, row * 16 + 1, size, 14)
        g.fillStyle = shade(0.55)
        g.fillRect(((row * 37) % size) | 0, row * 16, 2, 16)
      }
      break
    case 'cobble':
      for (let y = 0; y < size; y += 16) {
        for (let x = (y / 16) % 2 ? -8 : 0; x < size; x += 16) {
          g.fillStyle = shade(0.8 + rand() * 0.4)
          g.beginPath()
          g.ellipse(x + 8, y + 8, 6.5, 6, 0, 0, Math.PI * 2)
          g.fill()
        }
      }
      break
    case 'tile':
    case 'marble':
      for (let y = 0; y < size; y += 32) {
        for (let x = 0; x < size; x += 32) {
          g.fillStyle = shade((x + y) % 64 === 0 ? 1.15 : 0.85)
          g.fillRect(x + 1, y + 1, 30, 30)
        }
      }
      if (p.pattern === 'marble') {
        g.strokeStyle = shade(1.4)
        g.lineWidth = 1
        for (let i = 0; i < 6; i++) {
          g.beginPath()
          g.moveTo(rand() * size, rand() * size)
          g.lineTo(rand() * size, rand() * size)
          g.stroke()
        }
      }
      break
    case 'stone':
      for (let y = 0; y < size; y += 32) {
        for (let x = (y / 32) % 2 ? -16 : 0; x < size; x += 32) {
          g.fillStyle = shade(0.8 + rand() * 0.35)
          g.fillRect(x + 2, y + 2, 28, 28)
        }
      }
      break
    case 'asphalt':
      for (let i = 0; i < 700; i++) {
        g.fillStyle = shade(0.8 + rand() * 0.4)
        g.fillRect(rand() * size, rand() * size, 1.5, 1.5)
      }
      break
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  texCache.set(key, tex)
  return tex
}

// ------------------------------------------------------------------ walls and gates

function inAny(rooms: Rect[], x: number, z: number): boolean {
  return rooms.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1)
}

/**
 * Walls along every room edge that faces outside. The far edges (low x, low z)
 * stand tall; the camera edges stay knee-high.
 */
function walls(b: Bucket, zone: ZoneDef, p: Palette, gates: ZoneDef['gates']): void {
  const wallM = mat(p.wall)
  const capM = mat(new THREE.Color(p.wall).multiplyScalar(1.25).getHex())
  const step = 1
  for (const r of zone.rooms) {
    const edges: { x: number; z: number; ox: number; oz: number; along: 'x' | 'z'; far: boolean }[] = []
    for (let x = r.x0 + step / 2; x < r.x1; x += step) {
      edges.push({ x, z: r.z0, ox: 0, oz: -1, along: 'x', far: true })
      edges.push({ x, z: r.z1, ox: 0, oz: 1, along: 'x', far: false })
    }
    for (let z = r.z0 + step / 2; z < r.z1; z += step) {
      edges.push({ x: r.x0, z, ox: -1, oz: 0, along: 'z', far: true })
      edges.push({ x: r.x1, z, ox: 1, oz: 0, along: 'z', far: false })
    }
    for (const e of edges) {
      // Skip edges that open onto another room of the zone, and the gate gaps.
      if (inAny(zone.rooms, e.x + e.ox * 0.4, e.z + e.oz * 0.4)) continue
      if (gates.some((g) => Math.abs(g.z - e.z) < 0.6 && Math.abs(g.x - e.x) < g.span / 2 + 0.6)) continue
      const h = e.far ? 2.4 : 0.85
      const x = e.x + e.ox * 0.25
      const z = e.z + e.oz * 0.25
      const w = e.along === 'x' ? step : 0.5
      const d = e.along === 'x' ? 0.5 : step
      switch (p.wallStyle) {
        case 'hedge':
          box(b, mat(0x24401c), w, h * 0.9, d, x, 0, z)
          ball(b, mat(0x2e5222), 0.4, x, h * 0.9, z)
          break
        case 'fence':
        case 'rail':
          cyl(b, wallM, 0.07, 0.07, h, x, 0, z, 5)
          box(b, capM, e.along === 'x' ? step : 0.08, 0.08, e.along === 'x' ? 0.08 : step, x, h * 0.55, z)
          box(b, capM, e.along === 'x' ? step : 0.08, 0.08, e.along === 'x' ? 0.08 : step, x, h * 0.95, z)
          break
        case 'iron':
          box(b, mat(0x3a3c40), w, 0.35, d, x, 0, z)
          cyl(b, mat(0x1a1c20), 0.03, 0.03, h, x, 0.35, z, 4)
          cone(b, mat(0x1a1c20), 0.06, 0.16, x, 0.35 + h, z, 4)
          break
        default:
          box(b, wallM, w, h, d, x, 0, z)
          box(b, capM, w + 0.06, 0.1, d + 0.06, x, h, z)
      }
    }
  }
}

function sealedGate(b: Bucket, group: THREE.Group, g: ZoneDef['gates'][number], p: Palette, veils: THREE.MeshBasicMaterial[]): void {
  const pillar = mat(new THREE.Color(p.wall).multiplyScalar(0.8).getHex())
  const half = g.span / 2
  const dx = g.axis === 'x' ? half : 0
  const dz = g.axis === 'z' ? half : 0
  for (const s of [-1, 1]) {
    box(b, pillar, 0.6, 2.6, 0.6, g.x + s * dx, 0, g.z + s * dz)
    ball(b, mat(p.accent, p.accent, 1.4), 0.14, g.x + s * dx, 2.75, g.z + s * dz)
  }
  for (let i = -half + 0.3; i < half; i += 0.35) {
    cyl(b, mat(0x1a1416), 0.035, 0.035, 2.2, g.x + (g.axis === 'x' ? i : 0), 0, g.z + (g.axis === 'z' ? i : 0), 4)
  }
  const veil = new THREE.MeshBasicMaterial({
    color: p.accent,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  veils.push(veil)
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(g.span, 2.2), veil)
  plane.position.set(g.x, 1.1, g.z)
  if (g.axis === 'z') plane.rotation.y = Math.PI / 2
  group.add(plane)
}

// ------------------------------------------------------------------ props

interface Spot {
  x: number
  z: number
  /** Toward the far side of the zone, where tall props may stand. */
  far: boolean
}

type PropFn = (b: Bucket, s: Spot, p: Palette) => number

const wood = () => mat(0x5a3e28)
const darkWood = () => mat(0x3a281a)
const stone = () => mat(0x6a6670)
const iron = () => mat(0x2a2a30)
const glow = (p: Palette) => mat(p.accent, p.accent, 1.6)

const PROP: Record<string, PropFn> = {
  crate: (b, s) => {
    box(b, wood(), 0.9, 0.9, 0.9, s.x, 0, s.z, rand())
    if (rand() < 0.5) box(b, wood(), 0.7, 0.7, 0.7, s.x + 0.1, 0.9, s.z, rand())
    return 0.6
  },
  barrel: (b, s) => {
    cyl(b, darkWood(), 0.38, 0.38, 0.95, s.x, 0, s.z, 10)
    cyl(b, iron(), 0.4, 0.4, 0.08, s.x, 0.6, s.z, 10)
    return 0.45
  },
  bollard: (b, s) => {
    cyl(b, iron(), 0.18, 0.22, 0.7, s.x, 0, s.z, 8)
    return 0.25
  },
  lamp: (b, s, p) => {
    cyl(b, iron(), 0.06, 0.08, s.far ? 3 : 2, s.x, 0, s.z, 6)
    ball(b, glow(p), 0.16, s.x, s.far ? 3.05 : 2.05, s.z)
    return 0.2
  },
  stall: (b, s, p) => {
    for (const [dx, dz] of [[-0.9, -0.6], [0.9, -0.6], [-0.9, 0.6], [0.9, 0.6]]) cyl(b, wood(), 0.06, 0.06, 2, s.x + dx, 0, s.z + dz, 5)
    box(b, mat(rand() < 0.5 ? 0xb02a3a : 0xd8b040), 2.1, 0.12, 1.5, s.x, 2, s.z)
    box(b, wood(), 1.8, 0.8, 1.0, s.x, 0, s.z)
    ball(b, glow(p), 0.1, s.x, 1.9, s.z)
    return 1.1
  },
  cart: (b, s) => {
    box(b, wood(), 1.4, 0.5, 0.9, s.x, 0.4, s.z, rand())
    cyl(b, darkWood(), 0.35, 0.35, 0.1, s.x - 0.5, 0.05, s.z, 10)
    return 0.8
  },
  tree: (b, s) => {
    cyl(b, mat(0x3a2a1a), 0.18, 0.28, 2.2, s.x, 0, s.z, 6)
    cone(b, mat(0x1e3a1e), 1.3, 2.2, s.x, 1.6, s.z)
    cone(b, mat(0x24461e), 0.95, 1.8, s.x, 2.9, s.z)
    return 0.45
  },
  deadTree: (b, s) => {
    cyl(b, mat(0x2a2420), 0.12, 0.22, 2.6, s.x, 0, s.z, 5)
    const g = new THREE.CylinderGeometry(0.04, 0.08, 1.2, 4)
    g.applyMatrix4(new THREE.Matrix4().makeRotationZ(0.9).setPosition(s.x + 0.4, 2, s.z))
    b.add(mat(0x2a2420), g)
    return 0.3
  },
  rock: (b, s) => {
    const g = new THREE.DodecahedronGeometry(0.5 + rand() * 0.4, 0)
    g.scale(1, 0.6, 1)
    g.translate(s.x, 0.25, s.z)
    b.add(stone(), g)
    return 0.6
  },
  log: (b, s) => {
    const g = new THREE.CylinderGeometry(0.25, 0.25, 2, 8)
    g.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI / 2).premultiply(new THREE.Matrix4().makeRotationY(rand() * 3)).setPosition(s.x, 0.25, s.z))
    b.add(mat(0x4a3420), g)
    return 0.6
  },
  bush: (b, s) => {
    ball(b, mat(0x2a4a22), 0.55, s.x, 0.4, s.z)
    return 0.5
  },
  shroom: (b, s, p) => {
    cyl(b, mat(0xd8d0c0), 0.05, 0.07, 0.4, s.x, 0, s.z, 5)
    ball(b, glow(p), 0.18, s.x, 0.45, s.z)
    return 0
  },
  tomb: (b, s) => {
    box(b, stone(), 0.7, 0.9, 0.18, s.x, 0, s.z, (rand() - 0.5) * 0.3)
    box(b, mat(0x2e3428), 0.8, 0.06, 1.4, s.x, 0, s.z + 0.8)
    return 0.4
  },
  cross: (b, s) => {
    box(b, stone(), 0.14, 1.3, 0.14, s.x, 0, s.z)
    box(b, stone(), 0.6, 0.14, 0.14, s.x, 0.85, s.z)
    return 0.2
  },
  crypt: (b, s, p) => {
    box(b, stone(), 2.6, 2.4, 2.2, s.x, 0, s.z)
    cone(b, mat(0x4a4a52), 1.9, 1.0, s.x, 2.4, s.z, 4)
    box(b, mat(0x101014), 0.9, 1.5, 0.05, s.x, 0, s.z + 1.11)
    ball(b, glow(p), 0.1, s.x, 1.7, s.z + 1.15)
    return 1.5
  },
  coffin: (b, s) => {
    box(b, darkWood(), 0.7, 0.4, 1.8, s.x, 0, s.z, rand())
    return 0.6
  },
  hedge: (b, s) => {
    box(b, mat(0x24401c), 2.2, 1.1, 0.8, s.x, 0, s.z, rand() < 0.5 ? 0 : Math.PI / 2)
    return 0.9
  },
  statue: (b, s) => {
    box(b, stone(), 0.9, 0.8, 0.9, s.x, 0, s.z)
    const g = new THREE.CapsuleGeometry(0.28, 1, 3, 8)
    g.translate(s.x, 1.6, s.z)
    b.add(mat(0x9a96a0), g)
    ball(b, mat(0x9a96a0), 0.22, s.x, 2.4, s.z)
    return 0.6
  },
  fountain: (b, s, p) => {
    cyl(b, stone(), 1.3, 1.4, 0.5, s.x, 0, s.z, 14)
    cyl(b, mat(p.accent, p.accent, 0.4), 1.1, 1.1, 0.04, s.x, 0.48, s.z, 14)
    cyl(b, stone(), 0.2, 0.3, 1.3, s.x, 0.5, s.z, 8)
    return 1.4
  },
  bench: (b, s) => {
    box(b, darkWood(), 1.6, 0.12, 0.5, s.x, 0.45, s.z)
    box(b, iron(), 0.1, 0.45, 0.4, s.x - 0.7, 0, s.z)
    box(b, iron(), 0.1, 0.45, 0.4, s.x + 0.7, 0, s.z)
    return 0.5
  },
  pillar: (b, s) => {
    cyl(b, stone(), 0.45, 0.5, s.far ? 4.2 : 1.4, s.x, 0, s.z, 10)
    box(b, stone(), 1.1, 0.3, 1.1, s.x, 0, s.z)
    return 0.6
  },
  pew: (b, s) => {
    box(b, darkWood(), 2.4, 0.5, 0.55, s.x, 0, s.z)
    box(b, darkWood(), 2.4, 0.6, 0.1, s.x, 0.5, s.z - 0.25)
    return 0.7
  },
  candles: (b, s, p) => {
    cyl(b, iron(), 0.06, 0.2, 1.3, s.x, 0, s.z, 6)
    for (const dx of [-0.18, 0, 0.18]) {
      cyl(b, mat(0xf0e8d0), 0.04, 0.04, 0.2, s.x + dx, 1.3, s.z, 5)
      ball(b, glow(p), 0.05, s.x + dx, 1.55, s.z)
    }
    return 0.25
  },
  altar: (b, s, p) => {
    box(b, mat(0xe8e2d8), 2.2, 1.0, 1.0, s.x, 0, s.z)
    box(b, mat(p.accent, p.accent, 0.6), 2.3, 0.06, 1.1, s.x, 1.0, s.z)
    return 1.2
  },
  bones: (b, s) => {
    for (let i = 0; i < 6; i++) ball(b, mat(0xe8dcc4), 0.12 + rand() * 0.06, s.x + (rand() - 0.5) * 0.9, 0.1 + rand() * 0.3, s.z + (rand() - 0.5) * 0.9)
    return 0.4
  },
  sarcophagus: (b, s) => {
    box(b, stone(), 0.9, 0.7, 2.0, s.x, 0, s.z)
    box(b, mat(0x8a8478), 0.95, 0.12, 2.05, s.x, 0.7, s.z)
    return 0.9
  },
  torch: (b, s, p) => {
    cyl(b, iron(), 0.05, 0.05, 1.6, s.x, 0, s.z, 5)
    cone(b, glow(p), 0.1, 0.3, s.x, 1.6, s.z, 6)
    return 0.15
  },
  crystal: (b, s, p) => {
    const g = new THREE.OctahedronGeometry(s.far ? 0.9 : 0.5, 0)
    g.scale(0.6, s.far ? 2.6 : 1.6, 0.6)
    g.translate(s.x, s.far ? 2.2 : 0.8, s.z)
    b.add(mat(p.accent, p.accent, 1.1), g)
    return 0.5
  },
  pool: (b, s, p) => {
    const g = new THREE.CircleGeometry(1 + rand() * 0.6, 14)
    g.rotateX(-Math.PI / 2)
    g.translate(s.x, 0.03, s.z)
    b.add(mat(new THREE.Color(p.accent).multiplyScalar(0.5).getHex(), p.accent, 0.5), g)
    return 0
  },
  brazier: (b, s, p) => {
    cyl(b, iron(), 0.35, 0.15, 0.9, s.x, 0, s.z, 8)
    cone(b, glow(p), 0.3, 0.5, s.x, 0.9, s.z, 7)
    return 0.4
  },
  dumpster: (b, s) => {
    box(b, mat(0x2a4a3a), 1.8, 1.1, 1.0, s.x, 0, s.z, rand() < 0.5 ? 0 : Math.PI / 2)
    return 1.0
  },
  pallet: (b, s) => {
    box(b, wood(), 1.2, 0.15, 1.0, s.x, 0, s.z, rand())
    return 0
  },
  sofa: (b, s) => {
    box(b, mat(0x6a1428), 1.8, 0.45, 0.8, s.x, 0, s.z)
    box(b, mat(0x6a1428), 1.8, 0.5, 0.2, s.x, 0.45, s.z - 0.3)
    return 0.8
  },
  table: (b, s, p) => {
    cyl(b, darkWood(), 0.55, 0.55, 0.06, s.x, 0.72, s.z, 12)
    cyl(b, iron(), 0.05, 0.05, 0.72, s.x, 0, s.z, 5)
    ball(b, glow(p), 0.06, s.x, 0.84, s.z)
    return 0.55
  },
}

// ------------------------------------------------------------------ models

/** The loaded decoration models, or null (load failed): every model prop then falls back to its primitive. */
let decor: DecorLib | null = null

/**
 * A prop drawn from the decoration models: one of `ids` at a height in
 * `h`, turned at random. `block` is the footprint share that blocks walking
 * (a tree blocks at its trunk, not its crown). `else` is the primitive drawn
 * if the models did not load.
 */
interface ModelProp {
  ids: string[]
  h: [number, number]
  block: number
  else?: string
  /** Square to the walls instead of turned at random. */
  square?: boolean
}

const MODEL: Record<string, ModelProp> = {
  'm-barrel': { ids: ['barrel', 'barrel-open', 'barrel-tall'], h: [0.9, 1.05], block: 0.5, else: 'barrel' },
  'm-crate': { ids: ['crate', 'crate-open'], h: [0.75, 0.9], block: 0.6, else: 'crate' },
  'm-cart': { ids: ['cart-barrels', 'cart-hay', 'cart'], h: [1.2, 1.3], block: 0.45, else: 'cart' },
  'm-cart-barrels': { ids: ['cart-barrels', 'cart'], h: [1.2, 1.3], block: 0.45, else: 'cart' },
  'm-hay': { ids: ['hay'], h: [0.6, 0.75], block: 0.55 },
  'm-well': { ids: ['well'], h: [1.8, 1.9], block: 0.5, square: true },
  'm-boat': { ids: ['boat', 'boat-small'], h: [0.65, 0.75], block: 0.45 },
  'm-chest': { ids: ['chest'], h: [0.65, 0.7], block: 0.5 },
  'm-oak': { ids: ['oak-2', 'oak-3', 'oak-4', 'oak-1'], h: [3.8, 4.8], block: 0.12, else: 'tree' },
  'm-pine': { ids: ['pine-1', 'pine-2', 'pine-3'], h: [3.8, 4.6], block: 0.14, else: 'tree' },
  'm-cedar': { ids: ['cedar-1', 'cedar-2'], h: [3.0, 3.5], block: 0.2, else: 'tree' },
  'm-bush': { ids: ['bush-1', 'bush-2', 'bush-3', 'bush-4'], h: [0.75, 1.0], block: 0.45, else: 'bush' },
  'm-rock': { ids: ['rock-2', 'rock-3', 'rock-4', 'boulder-1', 'boulder-2'], h: [0.55, 1.1], block: 0.45, else: 'rock' },
  'm-boulder': { ids: ['boulder-1', 'boulder-2', 'boulder-4', 'rock-4'], h: [0.8, 1.3], block: 0.45, else: 'rock' },
  'm-cliff-rock': { ids: ['cliff-rock-1', 'cliff-rock-2', 'boulder-3'], h: [1.6, 2.4], block: 0.42, else: 'rock' },
  'm-stump': { ids: ['stump', 'hollow-trunk', 'sitting-log'], h: [0.55, 0.75], block: 0.45, else: 'log' },
  'm-woodpile': { ids: ['wood-pile'], h: [0.55, 0.65], block: 0.5 },
  'm-lean-to': { ids: ['lean-to'], h: [1.8, 2.0], block: 0.45 },
  'm-fence': { ids: ['fence-post', 'fence-boards'], h: [0.8, 0.95], block: 0.3 },
  'm-ruin': { ids: ['ruin-1', 'ruin-2', 'ruin-3'], h: [2.2, 3.2], block: 0.42, else: 'pillar' },
  'm-ruin-fallen': { ids: ['ruin-4', 'ruin-5'], h: [0.8, 1.0], block: 0.4 },
  'm-stalagmite': { ids: ['stalagmite'], h: [1.6, 2.4], block: 0.35, else: 'crystal' },
  'm-stalagmite-small': { ids: ['stalagmite-tiny'], h: [0.5, 0.7], block: 0.35 },
  'm-road-lamp': { ids: ['road-lamp', 'road-lamp-2'], h: [3.6, 4.0], block: 0.08, else: 'lamp', square: true },
  'm-barrier': { ids: ['road-barrier', 'road-barrier-2'], h: [0.9, 1.0], block: 0.45, square: true },
  'm-cone': { ids: ['cone'], h: [0.55, 0.65], block: 0.4 },
  'm-traffic-barrel': { ids: ['traffic-barrel'], h: [0.95, 1.05], block: 0.42 },
  // Ground scatter: never blocks.
  'm-grass': { ids: ['grass-1', 'grass-2', 'grass-3'], h: [0.3, 0.55], block: 0 },
  'm-shroom': { ids: ['mushroom-1', 'mushroom-2'], h: [0.3, 0.45], block: 0 },
  'm-branch': { ids: ['branch-1', 'branch-2'], h: [0.15, 0.3], block: 0 },
  'm-cattail': { ids: ['cattail'], h: [0.8, 1.0], block: 0 },
  'm-rose': { ids: ['rose'], h: [0.5, 0.6], block: 0 },
}

/** How a map shifts the packs' daylight colors toward its own night. */
interface Tint {
  /** Color multiplier, then a pull toward `toward` by `mix`. */
  mul: number
  toward?: number
  mix?: number
}

const TINT: Partial<Record<MapId, Tint>> = {
  mob: { mul: 0.85, toward: 0x2a2440, mix: 0.2 },
  docks: { mul: 0.8, toward: 0x203040, mix: 0.25 },
  market: { mul: 0.95, toward: 0x3a1e14, mix: 0.1 },
  wilds: { mul: 0.72, toward: 0x10241a, mix: 0.25 },
  // Graves: the green goes out of it; the trees are dead and grey.
  graves: { mul: 0.62, toward: 0x3a3a40, mix: 0.55 },
  manor: { mul: 0.7, toward: 0x1a2418, mix: 0.3 },
  cathedral: { mul: 1, toward: 0xd8d0c0, mix: 0.35 },
  catacombs: { mul: 0.85, toward: 0x8a8070, mix: 0.45 },
  spire: { mul: 0.8, toward: 0x6a1020, mix: 0.5 },
}

const tintColor = new THREE.Color()
const towardColor = new THREE.Color()

function tinted(hex: number, map: MapId): number {
  const t = TINT[map]
  if (!t) return hex
  tintColor.setHex(hex).multiplyScalar(t.mul)
  if (t.toward != null && t.mix) tintColor.lerp(towardColor.setHex(t.toward), t.mix)
  return tintColor.getHex()
}

/** Draws a model prop into the bucket. Returns its blocking radius, or -1 if the models are missing. */
function modelProp(b: Bucket, spec: ModelProp, s: Spot, map: MapId): number {
  const model = decor?.get(spec.ids[Math.floor(rand() * spec.ids.length)])
  if (!model) return -1
  const height = spec.h[0] + rand() * (spec.h[1] - spec.h[0])
  const k = height / Math.max(0.01, model.size.y)
  const turn = spec.square ? Math.floor(rand() * 4) * (Math.PI / 2) : rand() * Math.PI * 2
  const m = new THREE.Matrix4().makeRotationY(turn).scale(new THREE.Vector3(k, k, k)).setPosition(s.x, 0, s.z)
  for (const part of model.parts) {
    const g = part.geo.clone()
    g.applyMatrix4(m)
    b.add(mat(tinted(part.color, map)), g)
  }
  return Math.max(model.size.x, model.size.z) * k * spec.block
}

/**
 * What each theme is furnished with: [small props, tall props for the far
 * side, ground scatter]. Names starting `m-` are models (MODEL above).
 */
const THEME_PROPS: Record<string, [string[], string[], string[]]> = {
  mob: [['m-crate', 'dumpster', 'pallet', 'm-barrel', 'm-cone', 'm-barrier', 'sofa', 'table', 'm-traffic-barrel'], ['m-road-lamp'], []],
  docks: [['m-crate', 'm-barrel', 'bollard', 'pallet', 'm-boat', 'm-cart-barrels', 'm-crate', 'm-chest'], ['lamp', 'm-cliff-rock'], []],
  market: [['stall', 'm-cart', 'm-barrel', 'm-crate', 'stall', 'm-hay', 'm-well'], ['lamp'], []],
  wilds: [['m-rock', 'm-stump', 'm-bush', 'm-bush', 'm-woodpile', 'm-rock'], ['m-oak', 'm-pine', 'm-cedar', 'm-oak', 'm-lean-to'], ['m-grass', 'm-grass', 'm-shroom', 'm-branch', 'm-cattail']],
  graves: [['tomb', 'cross', 'tomb', 'coffin', 'tomb', 'm-stump', 'm-fence'], ['m-pine', 'crypt', 'lamp', 'm-cedar', 'm-ruin'], ['m-grass', 'm-branch', 'm-shroom']],
  manor: [['hedge', 'bench', 'statue', 'hedge', 'm-bush'], ['statue', 'lamp', 'fountain', 'm-oak'], ['m-rose', 'm-grass']],
  cathedral: [['pew', 'candles', 'pew', 'statue', 'm-ruin-fallen'], ['pillar', 'pillar', 'altar', 'm-ruin'], []],
  catacombs: [['bones', 'sarcophagus', 'bones', 'torch', 'm-stalagmite-small', 'm-boulder'], ['pillar', 'sarcophagus', 'm-stalagmite'], []],
  spire: [['pool', 'brazier', 'crystal', 'statue', 'm-boulder'], ['crystal', 'pillar', 'm-ruin', 'm-stalagmite'], []],
}

/** Draws a named prop, model or primitive. Returns its blocking radius. */
function drawProp(b: Bucket, name: string, s: Spot, p: Palette, map: MapId): number {
  const spec = MODEL[name]
  if (!spec) return PROP[name](b, s, p)
  const r = modelProp(b, spec, s, map)
  if (r >= 0) return r
  return spec.else ? PROP[spec.else](b, s, p) : 0
}

// ------------------------------------------------------------------ zones

function zoneArt(group: THREE.Group, map: MapDef, zone: ZoneDef, index: number, veils: THREE.MeshBasicMaterial[], obstacles: MapArtHandle['obstacles']): void {
  const p = map.palette
  const b = new Bucket()
  const tex = floorTexture(p)
  for (const r of zone.rooms) {
    const w = r.x1 - r.x0
    const d = r.z1 - r.z0
    const t = tex.clone()
    t.needsUpdate = true
    t.repeat.set(w / 3, d / 3)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.55 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.set((r.x0 + r.x1) / 2, 0.012 + index * 0.001, (r.z0 + r.z1) / 2)
    floor.receiveShadow = true
    group.add(floor)
  }
  walls(b, zone, p, zone.gates)
  for (const g of zone.gates) sealedGate(b, group, g, p, veils)
  if (zone.arena) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 1.95, 36), new THREE.MeshBasicMaterial({ color: p.accent, transparent: true, opacity: 0.55, depthWrite: false }))
    ring.rotation.x = -Math.PI / 2
    ring.position.set(zone.arena.x, 0.03, zone.arena.z)
    group.add(ring)
  }
  // Props, kept off the start, the way out, the boss ring, and the pods.
  const keep = [zone.start, ...zone.extracts, ...(zone.arena ? [zone.arena] : []), ...zone.pods]
  const [small, tall, scatter] = THEME_PROPS[map.id] ?? THEME_PROPS.mob
  const span = {
    x0: Math.min(...zone.rooms.map((r) => r.x0)),
    x1: Math.max(...zone.rooms.map((r) => r.x1)),
    z0: Math.min(...zone.rooms.map((r) => r.z0)),
    z1: Math.max(...zone.rooms.map((r) => r.z1)),
  }
  const area = zone.rooms.reduce((sum, r) => sum + (r.x1 - r.x0) * (r.z1 - r.z0), 0)
  const want = Math.round(area / 16)
  const placed: { x: number; z: number }[] = []
  seed = 1009 + index * 97 + map.id.length * 13
  for (let tries = 0; tries < want * 12 && placed.length < want; tries++) {
    const r = zone.rooms[Math.floor(rand() * zone.rooms.length)]
    const x = r.x0 + 1.2 + rand() * (r.x1 - r.x0 - 2.4)
    const z = r.z0 + 1.2 + rand() * (r.z1 - r.z0 - 2.4)
    if (keep.some((k) => Math.hypot(k.x - x, k.z - z) < 3.2)) continue
    if (placed.some((q) => Math.hypot(q.x - x, q.z - z) < 2.2)) continue
    // Tall props only in the far half, so the camera never looks through them at the hero.
    const far = (z - span.z0) / (span.z1 - span.z0) < 0.35 || (x - span.x0) / (span.x1 - span.x0) < 0.3
    const pool = far ? tall : small
    const r0 = drawProp(b, pool[Math.floor(rand() * pool.length)], { x, z, far }, p, map.id)
    placed.push({ x, z })
    if (r0 > 0) obstacles.push({ x, z, r: r0 })
  }
  // Ground scatter (grass, mushrooms, fallen branches): small, never in the way, kept off the paths all the same.
  if (scatter.length && decor) {
    const many = Math.round(area / 9)
    for (let tries = 0, n = 0; tries < many * 6 && n < many; tries++) {
      const r = zone.rooms[Math.floor(rand() * zone.rooms.length)]
      const x = r.x0 + 0.8 + rand() * (r.x1 - r.x0 - 1.6)
      const z = r.z0 + 0.8 + rand() * (r.z1 - r.z0 - 1.6)
      if (keep.some((k) => Math.hypot(k.x - x, k.z - z) < 2.4)) continue
      if (placed.some((q) => Math.hypot(q.x - x, q.z - z) < 1.1)) continue
      drawProp(b, scatter[Math.floor(rand() * scatter.length)], { x, z, far: false }, p, map.id)
      n++
    }
  }
  b.flush(group)
}

/** The Slums keep their hand-built courts; only the sealed alley mouths are added between zones. */
function slumGates(group: THREE.Group, b: Bucket, veils: THREE.MeshBasicMaterial[]): void {
  const p = MAPS.slums.palette
  sealedGate(b, group, { x: 4.25, z: ZONE1.z0 - 0.15, axis: 'x', span: 2.7 }, p, veils)
  sealedGate(b, group, { x: -1.25, z: ZONE1.z1 + 0.15, axis: 'x', span: 2.7 }, p, veils)
}

export function buildMapArt(scene: THREE.Scene, models: DecorLib | null = null): MapArtHandle {
  decor = models
  const group = new THREE.Group()
  group.name = 'map-art'
  const veils: THREE.MeshBasicMaterial[] = []
  const obstacles: MapArtHandle['obstacles'] = []
  const gates = new Bucket()
  slumGates(group, gates, veils)
  gates.flush(group)
  MAP_IDS.forEach((id) => {
    const map = MAPS[id]
    const placeholder = map.zones.filter((z) => z.art === 'placeholder')
    if (!placeholder.length) return
    // Ground under the whole map, in the map's own color, out past the fog.
    const all = placeholder.flatMap((z) => z.rooms)
    const x0 = Math.min(...all.map((r) => r.x0)) - 30
    const x1 = Math.max(...all.map((r) => r.x1)) + 30
    const z0 = Math.min(...all.map((r) => r.z0)) - 30
    const z1 = Math.max(...all.map((r) => r.z1)) + 30
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(x1 - x0, z1 - z0),
      new THREE.MeshLambertMaterial({ color: map.palette.ground, emissive: map.palette.ground, emissiveIntensity: 0.5 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.set((x0 + x1) / 2, -0.015, (z0 + z1) / 2)
    group.add(ground)
    map.zones.forEach((zone, i) => {
      if (zone.art === 'placeholder') zoneArt(group, map, zone, i, veils, obstacles)
    })
  })
  scene.add(group)
  let t = 0
  return {
    obstacles,
    update(dt) {
      t += dt
      const o = 0.16 + Math.sin(t * 2.2) * 0.07
      for (const v of veils) v.opacity = o
    },
  }
}
