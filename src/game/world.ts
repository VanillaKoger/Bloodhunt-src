import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { addRim, qualityLow } from './polish'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const HERO_START = { x: -1.2, z: 1.4 }
/**
 * The walk-through gate between the Slums and the mob district. While this
 * is false the gates are not built and travel by gate is ignored: districts
 * are chosen at the Haven instead (see nights.ts).
 */
export const DISTRICT_OPEN = false
/** The mob district's square: asphalt, buildings, cars, signs, and its club gate. Hunted from the Haven. */
export const MOB_ARENA = true
/** Second arena, far enough that the slum fog hides it. */
export const MOB_Z = 64
/**
 * Devon's sketch, photo as drawn (labels sideways): Zone 1 is the large
 * rectangle in the center, long axis north–south, gate on the east long edge.
 * Zone 3 sits north and a little west. Zone 2 sits south-west, opposite it.
 * Each joins Zone 1 by a long narrow alley with one L bend. The north alley
 * has two small round pockets; the south alley has one. Rat King is in Zone 2.
 *
 * Zones 2 and 3 are the original rectangles grown about their own centers so
 * the area is 1.25×. Zone 1 is grown the same way, then another half in area
 * (1.875× the sketch) with the same shape, proportions, and center. Alleys
 * keep their width and their L. The end that meets a court follows that
 * court's edge. The north L's crossbar and its pocket slide north by Zone 1's
 * extra growth, so the pocket stays clear of the court and the bend is unchanged.
 */
export interface SlumRect {
  x0: number
  x1: number
  z0: number
  z1: number
}

const COURT_AREA = 1.25
/** Zone 1 is half again the area of the other two courts. */
const ZONE1_AREA = COURT_AREA * 1.5

function growZone(room: SlumRect, area = COURT_AREA): SlumRect {
  const scale = Math.sqrt(area)
  const cx = (room.x0 + room.x1) / 2
  const cz = (room.z0 + room.z1) / 2
  const hx = ((room.x1 - room.x0) / 2) * scale
  const hz = ((room.z1 - room.z0) / 2) * scale
  return { x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz }
}

const ZONE1_BASE: SlumRect = { x0: -7.2, x1: 7.2, z0: -9.2, z1: 9.2 }
const ZONE3_BASE: SlumRect = { x0: -30.4, x1: -17.2, z0: -52.6, z1: -40.2 }
const ZONE2_BASE: SlumRect = { x0: -46.2, x1: -32.8, z0: 16.4, z1: 29.2 }
export const ZONE1 = growZone(ZONE1_BASE, ZONE1_AREA)
export const ZONE3 = growZone(ZONE3_BASE)
export const ZONE2 = growZone(ZONE2_BASE)
/** Purple-moon haze. The clear color, the sky, and the distance fog all use it. */
export const FOG_COLOR = 0x1c1028
/** How far Zone 1's north wall moved past the shared 1.25× size. */
export const NORTH_ALLEY_SHIFT = ZONE1.z1 - growZone(ZONE1_BASE).z1

/** Barred door on the long east wall of Zone 1. The next zone stays shut. */
export const SLUM_GATE = { x: ZONE1.x1 + (8.2 - ZONE1_BASE.x1), z: 0 }
export const MOB_GATE = { x: 0.1, z: MOB_Z + 6.15 }
export const MOB_ARRIVE = { x: -0.35, z: MOB_Z + 3.55 }
export const SLUM_RETURN = { x: ZONE1.x1 - (ZONE1_BASE.x1 - 5.6), z: 0 }
/** Junked sedan in Zone 3, clear of the alley mouth. */
export const SLUM_CAR = { x: -26.8, z: -49.4, rot: 0.4 }

/** Gate porch keeps its old depth past the east wall and its old width. */
const GATE_PORCH: SlumRect = {
  x0: ZONE1.x1 - (ZONE1_BASE.x1 - 4.6),
  x1: ZONE1.x1 + (8.95 - ZONE1_BASE.x1),
  z0: -1.05,
  z1: 1.05,
}

export const SLUM_ROOMS: SlumRect[] = [
  ZONE1,
  GATE_PORCH,
  ZONE3,
  { x0: -20.2, x1: -17.5, z0: ZONE3.z1 - (ZONE3_BASE.z1 - -43.0), z1: -24.6 },
  { x0: -20.2, x1: 5.6, z0: -27.3, z1: -24.6 },
  { x0: 2.9, x1: 5.6, z0: -27.0, z1: ZONE1.z0 + (-6.8 - ZONE1_BASE.z0) },
  ZONE2,
  { x0: -2.6, x1: 0.1, z0: ZONE1.z1 - (ZONE1_BASE.z1 - 6.6), z1: 20.8 + NORTH_ALLEY_SHIFT },
  { x0: ZONE2.x1 - (ZONE2_BASE.x1 - -35.4), x1: 0.1, z0: 18.1 + NORTH_ALLEY_SHIFT, z1: 20.8 + NORTH_ALLEY_SHIFT },
]

export const SLUM_POCKETS: { x: number; z: number; r: number }[] = [
  { x: -20.9, z: -34.0, r: 1.76 },
  { x: -8.0, z: -24.15, r: 1.62 },
  { x: 0.8, z: 13.6 + NORTH_ALLEY_SHIFT, r: 1.76 },
]

/** True when a disc of `radius` fits inside a zone, a jog, or a side pocket. */
export function inSlums(x: number, z: number, radius = 0): boolean {
  for (const room of SLUM_ROOMS) {
    if (x >= room.x0 + radius && x <= room.x1 - radius && z >= room.z0 + radius && z <= room.z1 - radius) return true
  }
  for (const pocket of SLUM_POCKETS) {
    if (Math.hypot(x - pocket.x, z - pocket.z) <= pocket.r - radius) return true
  }
  return false
}

/** Closest point where a disc of `radius` still fits. Used when something is pushed outside. */
export function nearestSlum(x: number, z: number, radius: number): { x: number; z: number } {
  if (inSlums(x, z, radius)) return { x, z }
  let bx = x
  let bz = z
  let best = Infinity
  const take = (px: number, pz: number) => {
    const d = (px - x) * (px - x) + (pz - z) * (pz - z)
    if (d < best) {
      best = d
      bx = px
      bz = pz
    }
  }
  for (const room of SLUM_ROOMS) {
    const minX = room.x0 + radius
    const maxX = room.x1 - radius
    const minZ = room.z0 + radius
    const maxZ = room.z1 - radius
    if (minX > maxX || minZ > maxZ) continue
    take(Math.min(maxX, Math.max(minX, x)), Math.min(maxZ, Math.max(minZ, z)))
  }
  for (const pocket of SLUM_POCKETS) {
    const max = pocket.r - radius
    if (max <= 0.15) continue
    const dx = x - pocket.x
    const dz = z - pocket.z
    const dist = Math.hypot(dx, dz) || 1
    const scale = Math.min(dist, max) / dist
    take(pocket.x + dx * scale, pocket.z + dz * scale)
  }
  return { x: bx, z: bz }
}
export const MOB_CARS: { key: 'sedan' | 'taxi'; x: number; z: number; rot: number }[] = [
  { key: 'sedan', x: 2.05, z: MOB_Z - 1.55, rot: 0.35 },
  { key: 'taxi', x: -1.85, z: MOB_Z + 2.05, rot: 2.5 },
]
export const MOB_BLOCKS: AlleyBlock[] = [
  { x: -5.45, z: MOB_Z - 3.65, w: 3.05, d: 2.2, floors: 2, lean: 0.02 },
  { x: 5.55, z: MOB_Z - 3.45, w: 2.75, d: 2.15, floors: 2, lean: -0.03 },
  { x: -5.85, z: MOB_Z + 3.55, w: 2.3, d: 1.95, floors: 2, lean: 0.04 },
  { x: 6.05, z: MOB_Z + 3.65, w: 2.2, d: 1.9, floors: 2, lean: -0.04 },
]
export const NODES = {
  crypt: { x: -4.2, z: 5.2 },
  fountain: { x: 1.2, z: -5.4 },
}

export interface NodeVisual {
  id: 'crypt' | 'fountain'
  x: number
  z: number
  group: THREE.Group
  glow: THREE.MeshLambertMaterial
  liquid?: THREE.Mesh
}

export interface WorldHandle {
  obstacles: { x: number; z: number; r: number }[]
  nodes: { crypt: NodeVisual; fountain: NodeVisual }
  fog: THREE.Fog
  moon: THREE.Mesh
  clouds: THREE.Mesh[]
  /** Slums gate glow. Bright once the Rat King has fallen. */
  gateGlow: THREE.MeshLambertMaterial
  keyLight: THREE.DirectionalLight
}

/** Local +Z points from (x,z) toward (tx,tz). */
export function faceToward(x: number, z: number, tx: number, tz: number, lean = 0): THREE.Matrix4 {
  const yaw = Math.atan2(tx - x, tz - z)
  return new THREE.Matrix4()
    .makeTranslation(x, 0, z)
    .multiply(new THREE.Matrix4().makeRotationY(yaw))
    .multiply(new THREE.Matrix4().makeRotationZ(lean))
}

/** Footprint of one tenement. The Kenney dress fills these; collision stays the walkable shape. */
export interface AlleyBlock {
  x: number
  z: number
  w: number
  d: number
  floors: number
  lean: number
  /** Facade looks toward this point. Cardinal, so the shell stays axis-aligned. */
  faceX?: number
  faceZ?: number
  brick?: 0 | 1 | 2
}

/**
 * A gap between two buildings. The barrier sits on the facade line.
 * `ox, oz` is the outward normal; the stub alley runs that way and is not walkable.
 */
export interface SlumGap {
  x: number
  z: number
  ox: number
  oz: number
  span: number
  /** 0 plain brick, 1 brick with a cap course. Chosen with a fixed seed. */
  kind: 0 | 1
}

/**
 * Uniform growth of every perimeter shell. Width, height, and depth all
 * use this factor. The street face stays on the old wall line; the extra
 * depth runs outward, away from the court.
 */
export const PERIMETER_SCALE = 1.15
/** World height of the common KayKit shell (native 2.25). */
export const COMMON_WALL_H = 3.55 * PERIMETER_SCALE

/**
 * Shared brick-wall cross-section. One wall closes each gap: the length
 * follows the opening, and the height and depth stay on this footprint.
 * The street face sits on `BARRIER_FACE`; depth runs outward.
 */
export const BARRIER_W = 1.52
export const BARRIER_H = 1.48
export const BARRIER_D = 0.11 * PERIMETER_SCALE
/**
 * Street face of the tenements, measured out from the walkable edge.
 * A barrier's street side sits on this plane; its depth runs into the stub.
 */
export const BARRIER_FACE = 0.14

/** How many identical panels close one gap, and the local X of the first. */
export function barrierLayout(span: number): { count: number; x0: number } {
  let count = Math.max(1, Math.round(span / BARRIER_W))
  // A wide leftover reads as a way through. One more panel tucks into the corners.
  if ((span - count * BARRIER_W) / 2 > 0.2) count += 1
  const row = count * BARRIER_W
  return { count, x0: -row / 2 + BARRIER_W / 2 }
}

/** Stable 0|1 so a gap picks the same brick variant on every load. */
export function barrierKind(index: number): 0 | 1 {
  let h = Math.imul(index + 1, 0x9e3779b1) ^ 0x1920c0de
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h ^= h >>> 16
  return (h & 1) as 0 | 1
}

/**
 * How far each end of a barrier sinks into the neighboring wall.
 * The end cap sits inside the shell, so the joint has no hairline and the
 * two street faces never share a pixel.
 */
export const BARRIER_TUCK = 0.05
/**
 * A wall face or the next barrier only counts as a neighbor when it sits
 * this close to the gap's own end. Farther matches are other blocks on the
 * same tangent, and stretching out to them lays a wall across the court.
 */
const BARRIER_NEIGHBOR = 0.85
/** Street face sits this far behind the facade plane. */
export const BARRIER_RECESS = 0.008

/**
 * Local X offset and length of the one barrier that closes `gap`.
 * The length runs from one neighboring wall face to the other, and only
 * a face within `BARRIER_NEIGHBOR` of the gap end counts. Ends that meet
 * a wall tuck in; ends that meet the next barrier stop where that
 * barrier starts, so two walls do not stack.
 */
export function barrierFit(gap: SlumGap): {
  along: number
  width: number
  left: number
  right: number
  /** This end meets a building, so the wall may wrap into that face. */
  leftHook: boolean
  rightHook: boolean
} {
  const yaw = Math.atan2(gap.ox, gap.oz)
  const xx = Math.cos(yaw)
  const xz = -Math.sin(yaw)
  const origin = gap.x * xx + gap.z * xz
  const half = gap.span / 2
  const faces: { lo: number; hi: number }[] = []
  for (const block of SLUM_BLOCKS) {
    const out = (block.x - gap.x) * gap.ox + (block.z - gap.z) * gap.oz
    if (out < 1.15 || out > 3.2) continue
    const byaw = Math.atan2((block.faceX ?? block.x) - block.x, (block.faceZ ?? block.z) - block.z)
    const ax = Math.cos(byaw)
    const az = -Math.sin(byaw)
    const parallel = Math.abs(ax * xx + az * xz)
    if (parallel < 0.85) continue
    const center = block.x * xx + block.z * xz - origin
    const reach = parallel * (block.w / 2)
    faces.push({ lo: center - reach, hi: center + reach })
  }
  const neighbors: { along: number; half: number }[] = []
  for (const other of SLUM_GAPS) {
    if (other === gap || other.ox !== gap.ox || other.oz !== gap.oz) continue
    const dx = other.x - gap.x
    const dz = other.z - gap.z
    if (Math.hypot(dx, dz) > 7) continue
    const along = dx * xx + dz * xz
    const perp = dx * gap.ox + dz * gap.oz
    if (Math.abs(perp) > 1.2) continue
    neighbors.push({ along, half: other.span / 2 })
  }
  const leftFace = faces
    .filter((face) => face.hi <= 0.25 && face.hi >= -half - BARRIER_NEIGHBOR)
    .sort((a, b) => b.hi - a.hi)[0]
  const rightFace = faces
    .filter((face) => face.lo >= -0.25 && face.lo <= half + BARRIER_NEIGHBOR)
    .sort((a, b) => a.lo - b.lo)[0]
  const leftGap = neighbors
    .filter((n) => n.along < 0 && n.along + n.half >= -half - BARRIER_NEIGHBOR)
    .sort((a, b) => b.along - a.along)[0]
  const rightGap = neighbors
    .filter((n) => n.along > 0 && n.along - n.half <= half + BARRIER_NEIGHBOR)
    .sort((a, b) => a.along - b.along)[0]
  const leftStop = leftGap ? leftGap.along + leftGap.half : -99
  const rightStop = rightGap ? rightGap.along - rightGap.half : 99
  let left = -half
  let right = half
  let leftHook = false
  let rightHook = false
  if (leftFace && leftFace.hi >= leftStop - 0.02) {
    left = leftFace.hi - BARRIER_TUCK
    if (left < leftStop) left = leftStop
    else leftHook = true
  } else if (leftGap) left = leftStop
  if (rightFace && rightFace.lo <= rightStop + 0.02) {
    right = rightFace.lo + BARRIER_TUCK
    if (right > rightStop) right = rightStop
    else rightHook = true
  } else if (rightGap) right = rightStop
  if (right - left < 0.45) {
    return { along: 0, width: gap.span, left: -half, right: half, leftHook: false, rightHook: false }
  }
  return { along: (left + right) / 2, width: right - left, left, right, leftHook, rightHook }
}

/**
 * An end that does not meet a parallel wall can still die on a corner shell.
 * A pier belongs there. Ends that step into a court, alley, pocket, or the
 * gate do not, so those openings stay clear.
 */
export function cornerPier(gap: SlumGap, at: number, dir: -1 | 1): boolean {
  const yaw = Math.atan2(gap.ox, gap.oz)
  const xx = Math.cos(yaw)
  const xz = -Math.sin(yaw)
  const origin = gap.x * xx + gap.z * xz
  const past = at + dir * 0.45
  const wx = gap.x + past * Math.cos(yaw) + 0.35 * Math.sin(yaw)
  const wz = gap.z - past * Math.sin(yaw) + 0.35 * Math.cos(yaw)
  if (inSlums(wx, wz, -0.05)) return false
  for (const block of SLUM_BLOCKS) {
    const out = (block.x - gap.x) * gap.ox + (block.z - gap.z) * gap.oz
    if (out < 0.7 || out > 4) continue
    const center = block.x * xx + block.z * xz - origin
    const lo = center - block.w / 2
    const hi = center + block.w / 2
    if (at >= lo - 0.08 && at <= hi + 0.08) return true
  }
  return false
}

const BLD_W = 2.6 * PERIMETER_SCALE
/** Depth anchor for the facade line. Visual depth scales in the dress, not here. */
const BLD_D = 3.45
const OUTSET = 0.16
const MIN_GAP = 1.2
/** Corner along-street width. The facing axis stays on `BLD_D` so the wall line holds. */
const CORNER_W = 3.45 * PERIMETER_SCALE

/** One straight row around every room and pocket. Filled with the blocks. */
export const SLUM_GAPS: SlumGap[] = []
export const SLUM_BLOCKS: AlleyBlock[] = buildSlumBlocks()

function buildSlumBlocks(): AlleyBlock[] {
  const blocks: AlleyBlock[] = []
  const taken: { x: number; z: number }[] = []
  SLUM_GAPS.length = 0
  let brickN = 0
  const push = (block: AlleyBlock) => {
    if (inSlums(block.x, block.z, -0.12)) return
    if (taken.some((p) => Math.hypot(p.x - block.x, p.z - block.z) < 2.2)) return
    taken.push({ x: block.x, z: block.z })
    blocks.push(block)
  }
  const placeGap = (x: number, z: number, ox: number, oz: number, span: number) => {
    if (span < 0.4) return
    SLUM_GAPS.push({
      x,
      z,
      ox,
      oz,
      span,
      kind: barrierKind(SLUM_GAPS.length),
    })
  }
  const placeBuilding = (x: number, z: number, ox: number, oz: number, along: number, floors: number) => {
    const cx = x + ox * (OUTSET + BLD_D / 2)
    const cz = z + oz * (OUTSET + BLD_D / 2)
    const width = Math.max(1.7, Math.min(BLD_W, along))
    if (inSlums(cx, cz, -0.12)) return
    if (taken.some((p) => Math.hypot(p.x - cx, p.z - cz) < 2.2)) {
      placeGap(x, z, ox, oz, along)
      return
    }
    taken.push({ x: cx, z: cz })
    blocks.push({
      x: cx,
      z: cz,
      w: width,
      d: BLD_D,
      floors,
      lean: 0,
      faceX: cx - ox,
      faceZ: cz - oz,
      brick: (brickN++ % 3) as 0 | 1 | 2,
    })
  }
  const placeCorner = (cx: number, cz: number, sx: number, sz: number, floors: number) => {
    if (opensOut(cx, cz, sx, 0) || opensOut(cx, cz, 0, sz)) return
    // Facing axis (sx) keeps the old offset so that street face stays put.
    // The wider footprint grows along sz, outward from the adjacent wall.
    const x = cx + sx * (OUTSET + BLD_D / 2)
    const z = cz + sz * (OUTSET + CORNER_W / 2)
    push({
      x,
      z,
      w: CORNER_W,
      d: BLD_D,
      floors,
      lean: 0,
      faceX: x - sx,
      faceZ: z,
      brick: (brickN++ % 3) as 0 | 1 | 2,
    })
  }
  const fillSpan = (
    x0: number,
    z0: number,
    dx: number,
    dz: number,
    a: number,
    b: number,
    ox: number,
    oz: number,
    floors: number,
  ) => {
    const L = b - a
    if (L < 0.85) return
    const at = (dist: number) => ({ x: x0 + dx * dist, z: z0 + dz * dist })
    let nBld = Math.floor((L - MIN_GAP) / (BLD_W + MIN_GAP))
    if (nBld < 1 && L >= 2.75) {
      const w = Math.min(BLD_W, L - 1.7)
      const side = (L - w) / 2
      const g0 = at(a + side / 2)
      const mid = at(a + side + w / 2)
      const g1 = at(a + side + w + side / 2)
      placeGap(g0.x, g0.z, ox, oz, side)
      placeBuilding(mid.x, mid.z, ox, oz, w, floors)
      placeGap(g1.x, g1.z, ox, oz, side)
      return
    }
    if (nBld < 1) {
      const mid = at((a + b) / 2)
      placeGap(mid.x, mid.z, ox, oz, L)
      return
    }
    const gap = (L - nBld * BLD_W) / (nBld + 1)
    let cursor = a
    for (let k = 0; k < nBld; k++) {
      const gs = at(cursor + gap / 2)
      placeGap(gs.x, gs.z, ox, oz, gap)
      cursor += gap
      const bs = at(cursor + BLD_W / 2)
      placeBuilding(bs.x, bs.z, ox, oz, BLD_W, floors)
      cursor += BLD_W
    }
    const tail = at(cursor + (b - cursor) / 2)
    placeGap(tail.x, tail.z, ox, oz, b - cursor)
  }
  const addEdge = (x0: number, z0: number, x1: number, z1: number, ox: number, oz: number, floors: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0)
    if (len < 0.8) return
    const dx = (x1 - x0) / len
    const dz = (z1 - z0) / len
    const step = 0.28
    const n = Math.max(1, Math.ceil(len / step))
    const open: boolean[] = []
    for (let i = 0; i < n; i++) {
      const dist = ((i + 0.5) / n) * len
      open.push(opensOut(x0 + dx * dist, z0 + dz * dist, ox, oz))
    }
    let i = 0
    while (i < n) {
      if (open[i]) {
        i++
        continue
      }
      let j = i
      while (j < n && !open[j]) j++
      const a = (i / n) * len
      const b = (j / n) * len
      fillSpan(x0, z0, dx, dz, a + 0.08, b - 0.08, ox, oz, floors)
      i = j
    }
  }
  const addRoom = (room: SlumRect, floors: number) => {
    addEdge(room.x0, room.z0, room.x1, room.z0, 0, -1, floors)
    addEdge(room.x1, room.z0, room.x1, room.z1, 1, 0, floors)
    addEdge(room.x1, room.z1, room.x0, room.z1, 0, 1, floors)
    addEdge(room.x0, room.z1, room.x0, room.z0, -1, 0, floors)
    placeCorner(room.x0, room.z0, -1, -1, floors)
    placeCorner(room.x1, room.z0, 1, -1, floors)
    placeCorner(room.x0, room.z1, -1, 1, floors)
    placeCorner(room.x1, room.z1, 1, 1, floors)
  }
  for (const room of SLUM_ROOMS) {
    const narrow = Math.min(room.x1 - room.x0, room.z1 - room.z0) < 4.5
    addRoom(room, narrow ? 2 : 3)
  }
  for (const pocket of SLUM_POCKETS) {
    const s = pocket.r
    addRoom({ x0: pocket.x - s, x1: pocket.x + s, z0: pocket.z - s, z1: pocket.z + s }, 2)
  }
  return blocks
}

/** True when this edge point opens into another room, a pocket, or the barred gate. */
function opensOut(x: number, z: number, ox: number, oz: number): boolean {
  if (ox > 0.5 && x >= SLUM_GATE.x - 0.15 && Math.abs(z - SLUM_GATE.z) < 1.2) return true
  return inSlums(x + ox * 0.5, z + oz * 0.5, -0.05)
}

function mat(
  color: number,
  opts: { roughness?: number; metalness?: number; emissive?: number; emissiveIntensity?: number; transparent?: boolean; opacity?: number } = {},
): THREE.MeshLambertMaterial {
  const metal = opts.metalness ?? 0
  const m = new THREE.MeshLambertMaterial({
    color,
    emissive: opts.emissive ?? (metal > 0.45 ? color : 0x000000),
    emissiveIntensity: opts.emissiveIntensity ?? (opts.emissive ? 1 : metal > 0.45 ? 0.25 : 0),
  })
  addRim(m)
  if (opts.transparent) {
    m.transparent = true
    m.opacity = opts.opacity ?? 1
    m.depthWrite = false
  }
  return m
}

const BRICKS = [mat(0x62404c), mat(0x73483c), mat(0x534058)]
const TIMBER = mat(0x3d2918)
const ROOF = mat(0x2c1d2a)
const DOOR = mat(0x4e3024)
const FRAME = mat(0x22161c)
const GLOW = mat(0xffb15e, { emissive: 0xff9a3c, emissiveIntensity: 1.7 })
const LANTERN = mat(0xffd98a, { emissive: 0xffc15a, emissiveIntensity: 2.4 })
const CRATE = mat(0x6b4a30)

class Bucket {
  private lists = new Map<THREE.Material, THREE.BufferGeometry[]>()
  add(material: THREE.Material, geometry: THREE.BufferGeometry): void {
    const geo = geometry.index ? geometry.toNonIndexed() : geometry
    if (geo !== geometry) geometry.dispose()
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
  }
}

function chunk(w: number, h: number, d: number): THREE.BufferGeometry {
  const m = Math.min(w, h, d)
  if (m < 0.1) return new THREE.BoxGeometry(w, h, d)
  return new RoundedBoxGeometry(w, h, d, 1, Math.min(0.07, m * 0.18))
}

function put(
  bucket: Bucket,
  material: THREE.Material,
  root: THREE.Matrix4,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): void {
  const geo = chunk(w, h, d)
  const local = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz))
  local.setPosition(x, y, z)
  geo.applyMatrix4(root.clone().multiply(local))
  bucket.add(material, geo)
}

function gable(w: number, d: number, h: number): THREE.BufferGeometry {
  const hw = w / 2
  const hd = d / 2
  const positions = [
    -hw, 0, hd, hw, 0, hd, hw, h, 0, -hw, 0, hd, hw, h, 0, -hw, h, 0,
    hw, 0, -hd, -hw, 0, -hd, -hw, h, 0, hw, 0, -hd, -hw, h, 0, hw, h, 0,
    -hw, 0, hd, -hw, h, 0, -hw, 0, -hd,
    hw, 0, -hd, hw, h, 0, hw, 0, hd,
  ]
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.computeVertexNormals()
  return geo
}

interface Block extends AlleyBlock {
  brick: 0 | 1 | 2
}

function basisOf(b: Block): THREE.Matrix4 {
  const fx = b.faceX ?? 0
  const fz = b.faceZ ?? 0
  const yaw = Math.atan2(fx - b.x, fz - b.z)
  return new THREE.Matrix4()
    .makeTranslation(b.x, 0, b.z)
    .multiply(new THREE.Matrix4().makeRotationY(yaw))
    .multiply(new THREE.Matrix4().makeRotationZ(b.lean))
}

function tenement(bucket: Bucket, lamps: THREE.Vector3[], b: Block): void {
  const root = basisOf(b)
  const brick = BRICKS[b.brick]
  const floorH = 1.12
  const height = b.floors * floorH + 0.16
  put(bucket, brick, root, b.w + 0.18, 0.2, b.d + 0.18, 0, 0.1, 0)
  for (let f = 0; f < b.floors; f++) {
    const shift = (f - (b.floors - 1) * 0.5) * 0.1
    const y0 = 0.2 + f * floorH
    put(bucket, brick, root, b.w, floorH * 0.9, b.d, shift, y0 + floorH * 0.45, 0)
    put(bucket, TIMBER, root, b.w + 0.1, 0.09, b.d + 0.1, shift, y0 + floorH * 0.92, 0)
    const wy = y0 + floorH * 0.55
    const fz = b.d / 2 + 0.03
    const leftBoard = (f + b.brick) % 2 === 0
    windowAt(bucket, root, -b.w * 0.22 + shift, wy, fz, leftBoard)
    windowAt(bucket, root, b.w * 0.22 + shift, wy, fz, !leftBoard && f > 0)
  }
  put(bucket, TIMBER, root, 0.1, height, 0.1, -b.w / 2, height / 2, b.d / 2)
  put(bucket, TIMBER, root, 0.1, height, 0.1, b.w / 2, height / 2, b.d / 2)
  put(bucket, DOOR, root, 0.42, 0.86, 0.07, 0, 0.58, b.d / 2 + 0.04)
  if (b.brick !== 1) put(bucket, TIMBER, root, 0.48, 0.07, 0.04, 0.02, 0.72, b.d / 2 + 0.09, 0, 0, 0.15)
  const roof = gable(b.w + 0.46, b.d + 0.36, 0.78)
  roof.applyMatrix4(root.clone().multiply(new THREE.Matrix4().makeTranslation(0, height, 0)))
  bucket.add(ROOF, roof)
  put(bucket, brick, root, 0.26, 0.5, 0.26, b.w * 0.26, height + 0.55, -b.d * 0.12)
  const lx = b.w * 0.34
  const ly = 1.45
  const lz = b.d / 2 + 0.16
  put(bucket, TIMBER, root, 0.06, 0.16, 0.08, lx, ly, lz)
  put(bucket, LANTERN, root, 0.16, 0.18, 0.14, lx, ly - 0.22, lz + 0.02)
  lamps.push(new THREE.Vector3(lx, ly - 0.22, lz).applyMatrix4(root))
}

function windowAt(bucket: Bucket, root: THREE.Matrix4, x: number, y: number, z: number, boarded: boolean): void {
  put(bucket, FRAME, root, 0.34, 0.42, 0.05, x, y, z)
  if (boarded) {
    put(bucket, TIMBER, root, 0.32, 0.055, 0.03, x, y + 0.08, z + 0.03)
    put(bucket, TIMBER, root, 0.32, 0.055, 0.03, x, y - 0.07, z + 0.03)
  } else {
    put(bucket, GLOW, root, 0.24, 0.28, 0.04, x, y, z + 0.02)
  }
}

interface StreetMaps {
  cobble: THREE.Texture
  asphalt: THREE.Texture
  concrete: THREE.Texture
  mud: THREE.Texture
  cobbleN: THREE.Texture | null
  asphaltN: THREE.Texture | null
  concreteN: THREE.Texture | null
  mudN: THREE.Texture | null
}

let streetMaps: StreetMaps | null = null

function streetUrl(file: string): string {
  return new URL(`cc0/ground/${file}`, new URL(import.meta.env.BASE_URL, window.location.href)).href
}

function loadStreetTex(file: string, color: boolean): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const tex = new THREE.TextureLoader().load(streetUrl(file), () => resolve(tex), undefined, reject)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
    tex.anisotropy = 1
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.generateMipmaps = true
  })
}

/** CC0 street maps. `?low=1` skips the normal maps. */
export function loadStreetMaps(): Promise<void> {
  if (streetMaps) return Promise.resolve()
  const normals = !qualityLow()
  const colors = Promise.all([
    loadStreetTex('cobble_color.jpg', true),
    loadStreetTex('asphalt_color.jpg', true),
    loadStreetTex('concrete_color.jpg', true),
    loadStreetTex('mud_color.jpg', true),
  ])
  const bumps = normals
    ? Promise.all([
        loadStreetTex('cobble_normal.jpg', false),
        loadStreetTex('asphalt_normal.jpg', false),
        loadStreetTex('concrete_normal.jpg', false),
        loadStreetTex('mud_normal.jpg', false),
      ])
    : Promise.resolve([null, null, null, null] as const)
  return Promise.all([colors, bumps]).then(([color, bump]) => {
    streetMaps = {
      cobble: color[0],
      asphalt: color[1],
      concrete: color[2],
      mud: color[3],
      cobbleN: bump[0],
      asphaltN: bump[1],
      concreteN: bump[2],
      mudN: bump[3],
    }
  })
}

const STREET_GLSL = /* glsl */ `
varying vec3 vStreetW;
varying vec3 vStreetT;
varying vec3 vStreetB;
uniform sampler2D uCobble;
uniform sampler2D uAsphalt;
uniform sampler2D uConcrete;
uniform sampler2D uMud;
#ifdef STREET_NORMALS
uniform sampler2D uCobbleN;
uniform sampler2D uAsphaltN;
uniform sampler2D uConcreteN;
uniform sampler2D uMudN;
#endif

float insideRect(vec2 p, vec4 r) {
  return (p.x >= r.x && p.x <= r.z && p.y >= r.y && p.y <= r.w) ? 1.0 : 0.0;
}

float insidePlay(vec2 p) {
  float s = 0.0;
  ${SLUM_ROOMS.map((r) => `s = max(s, insideRect(p, vec4(${r.x0.toFixed(2)}, ${r.z0.toFixed(2)}, ${r.x1.toFixed(2)}, ${r.z1.toFixed(2)})));`).join('\n  ')}
  ${SLUM_POCKETS.map((p) => `s = max(s, step(length(p - vec2(${p.x.toFixed(2)}, ${p.z.toFixed(2)})), ${p.r.toFixed(2)}));`).join('\n  ')}
  return s;
}

float outsideRect(vec2 p, vec4 r) {
  float dx = max(max(r.x - p.x, p.x - r.z), 0.0);
  float dy = max(max(r.y - p.y, p.y - r.w), 0.0);
  return length(vec2(dx, dy));
}

float cityApron(vec2 p) {
  if (insidePlay(p) > 0.5) return 0.0;
  float d = outsideRect(p, vec4(${ZONE1.x0.toFixed(2)}, ${ZONE1.z0.toFixed(2)}, ${ZONE1.x1.toFixed(2)}, ${ZONE1.z1.toFixed(2)}));
  d = min(d, outsideRect(p, vec4(${ZONE2.x0.toFixed(2)}, ${ZONE2.z0.toFixed(2)}, ${ZONE2.x1.toFixed(2)}, ${ZONE2.z1.toFixed(2)})));
  d = min(d, outsideRect(p, vec4(${ZONE3.x0.toFixed(2)}, ${ZONE3.z0.toFixed(2)}, ${ZONE3.x1.toFixed(2)}, ${ZONE3.z1.toFixed(2)})));
  return 1.0 - smoothstep(14.0, 40.0, d);
}

float streetHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float streetNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = streetHash(i);
  float b = streetHash(i + vec2(1.0, 0.0));
  float c = streetHash(i + vec2(0.0, 1.0));
  float d = streetHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float courtEdge(vec2 p, vec4 r) {
  if (p.x < r.x || p.x > r.z || p.y < r.y || p.y > r.w) return 99.0;
  return min(min(p.x - r.x, r.z - p.x), min(p.y - r.y, r.w - p.y));
}

vec4 streetWeights(vec3 wpos) {
  vec2 w = wpos.xz;
  float edge = courtEdge(w, vec4(${ZONE1.x0.toFixed(2)}, ${ZONE1.z0.toFixed(2)}, ${ZONE1.x1.toFixed(2)}, ${ZONE1.z1.toFixed(2)}));
  edge = min(edge, courtEdge(w, vec4(${ZONE2.x0.toFixed(2)}, ${ZONE2.z0.toFixed(2)}, ${ZONE2.x1.toFixed(2)}, ${ZONE2.z1.toFixed(2)})));
  edge = min(edge, courtEdge(w, vec4(${ZONE3.x0.toFixed(2)}, ${ZONE3.z0.toFixed(2)}, ${ZONE3.x1.toFixed(2)}, ${ZONE3.z1.toFixed(2)})));
  float court = edge < 50.0 ? 1.0 : 0.0;
  float alley = 1.0 - court;
  float chip = smoothstep(0.35, 0.7, streetNoise(w * 0.85));
  float side = court * (1.0 - smoothstep(0.45, 1.45, edge)) * mix(0.7, 1.0, chip);
  float mud = smoothstep(0.58, 0.82, streetNoise(w * 0.22));
  mud = max(mud, smoothstep(0.62, 0.84, streetNoise(w * 0.47 + 9.0)) * 0.85);
  mud = mix(mud, max(mud, smoothstep(0.42, 0.7, streetNoise(w * 0.3)) * 0.8), alley);
  float paveNoise = smoothstep(0.22, 0.58, streetNoise(w * 0.11));
  float apron = cityApron(w);
  float pave = court * mix(0.58, 0.92, paveNoise) + alley * mix(0.12, 0.84, apron);
  return vec4(pave, side, mud * (1.0 - apron * 0.65), alley);
}

vec3 gradeStreet(vec3 c) {
  float l = dot(c, vec3(0.30, 0.52, 0.18));
  c = mix(vec3(l), c, 0.78);
  c = mix(c, vec3(0.55, 0.40, 0.46), 0.1);
  c *= vec3(1.02, 0.94, 0.98);
  return pow(max(c, 0.0), vec3(0.95));
}

vec3 streetAlbedo(vec3 wpos) {
  vec2 w = wpos.xz;
  vec4 g = streetWeights(wpos);
  vec3 cobble = texture2D(uCobble, w * 0.36).rgb * vec3(0.92, 0.84, 0.86);
  vec3 asphaltRaw = texture2D(uAsphalt, w * 0.22).rgb;
  vec3 asphalt = asphaltRaw * vec3(1.35, 1.22, 1.28);
  vec3 concrete = texture2D(uConcrete, w * 0.30).rgb * vec3(1.9, 1.78, 1.82);
  vec3 mud = texture2D(uMud, w * 0.26).rgb * vec3(1.2, 0.7, 0.42);
  float lum = dot(asphaltRaw, vec3(0.33, 0.5, 0.17));
  float crack = smoothstep(0.29, 0.22, lum);
  float asphaltW = g.x * (1.0 - crack * 0.8);
  vec3 col = mix(cobble, asphalt, asphaltW);
  col = mix(col, concrete, g.y * 0.92);
  col = mix(col, mud, g.z * 0.88);
  float apron = cityApron(w);
  col *= mix(vec3(1.0), vec3(0.62, 0.58, 0.56), g.w * (1.0 - apron * 0.82));
  col *= 0.9 + 0.1 * sin(w.x * 0.65) * sin(w.y * 0.57);
  return gradeStreet(col);
}

#ifdef STREET_NORMALS
vec3 unpackStreetN(sampler2D tex, vec2 uv) {
  vec3 n = texture2D(tex, uv).xyz * 2.0 - 1.0;
  return n;
}
vec3 streetNormal(vec3 geometric, vec3 wpos, vec3 tangent, vec3 bitangent) {
  vec2 w = wpos.xz;
  vec4 g = streetWeights(wpos);
  vec3 n = unpackStreetN(uCobbleN, w * 0.36);
  float lum = dot(texture2D(uAsphalt, w * 0.22).rgb, vec3(0.33, 0.5, 0.17));
  float crack = smoothstep(0.29, 0.22, lum);
  n = mix(n, unpackStreetN(uAsphaltN, w * 0.22), g.x * (1.0 - crack * 0.8));
  n = mix(n, unpackStreetN(uConcreteN, w * 0.30), g.y);
  n = mix(n, unpackStreetN(uMudN, w * 0.26), g.z);
  return normalize(geometric + tangent * n.x * 0.2 + bitangent * n.y * 0.2);
}
#endif
`

function streetMaterial(): THREE.MeshLambertMaterial {
  const maps = streetMaps
  const flat = mat(0xc48848, { emissive: 0x6a3814, emissiveIntensity: 0.45 })
  if (!maps) return flat
  const normals = !!maps.cobbleN
  const material = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: 0x24161c,
    emissiveIntensity: 0.16,
  })
  material.side = THREE.DoubleSide
  material.customProgramCacheKey = () => (normals ? 'street-apron-n' : 'street-apron')
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCobble = { value: maps.cobble }
    shader.uniforms.uAsphalt = { value: maps.asphalt }
    shader.uniforms.uConcrete = { value: maps.concrete }
    shader.uniforms.uMud = { value: maps.mud }
    if (normals && maps.cobbleN && maps.asphaltN && maps.concreteN && maps.mudN) {
      shader.uniforms.uCobbleN = { value: maps.cobbleN }
      shader.uniforms.uAsphaltN = { value: maps.asphaltN }
      shader.uniforms.uConcreteN = { value: maps.concreteN }
      shader.uniforms.uMudN = { value: maps.mudN }
      shader.fragmentShader = '#define STREET_NORMALS\n' + shader.fragmentShader
    }
    const decl = `
varying vec3 vStreetW;
varying vec3 vStreetT;
varying vec3 vStreetB;
`
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${decl}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vStreetW = (modelMatrix * vec4(position, 1.0)).xyz;
        vStreetT = normalize(mat3(modelViewMatrix) * vec3(1.0, 0.0, 0.0));
        vStreetB = normalize(mat3(modelViewMatrix) * vec3(0.0, 0.0, 1.0));`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${STREET_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n\tdiffuseColor.rgb *= streetAlbedo(vStreetW);`)
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
#ifdef STREET_NORMALS
        normal = streetNormal(normal, vStreetW, vStreetT, vStreetB);
#endif`,
      )
      .replace(
        'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
        `vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
        float rimDot = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
        float rim = smoothstep(0.36, 1.0, pow(rimDot, 1.45));
        outgoingLight += vec3(0.7, 0.2, 0.46) * rim;
        outgoingLight *= mix(1.0, 0.32, rim);`,
      )
  }
  return material
}

function cobbles(parent: THREE.Object3D): void {
  const puddles = [
    { x: 1.4, z: -2.6, r: 0.85 },
    { x: -20.6, z: -34.2, r: 0.55 },
    { x: -40.4, z: 25.2, r: 0.7 },
  ]

  // One plane, two triangles. It runs under the courts and out past the fog,
  // so a gap between buildings shows cobble instead of the clear color.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), streetMaterial())
  ground.name = 'city-ground'
  ground.rotation.x = -Math.PI / 2
  ground.position.set(-20, -0.03, -12)
  ground.receiveShadow = true
  ground.frustumCulled = false
  parent.add(ground)

  const puddleMat = new THREE.MeshPhongMaterial({
    color: 0x120818,
    emissive: 0x3a1860,
    emissiveIntensity: 0.22,
    specular: new THREE.Color(0xf2e8ff),
    shininess: 90,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  })
  const sheenMat = new THREE.MeshBasicMaterial({
    color: 0xe8dcff,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  for (const p of puddles) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(p.r * 0.72, 16), puddleMat)
    disc.rotation.x = -Math.PI / 2
    disc.position.set(p.x, 0.03, p.z)
    disc.receiveShadow = true
    parent.add(disc)
    const sheen = new THREE.Mesh(new THREE.CircleGeometry(p.r * 0.28, 12), sheenMat)
    sheen.rotation.x = -Math.PI / 2
    sheen.position.set(p.x + p.r * 0.12, 0.04, p.z - p.r * 0.08)
    parent.add(sheen)
  }
}

function makeCrypt(): NodeVisual {
  const group = new THREE.Group()
  const { x, z } = NODES.crypt
  group.position.set(x, 0, z)
  group.visible = false
  const stone = mat(0x3a3348, { roughness: 0.75 })
  const gold = mat(0xe2b44a, { metalness: 0.7, roughness: 0.35 })
  const glow = mat(0xb14bff, { emissive: 0xb14bff, emissiveIntensity: 1.8, roughness: 0.25 })
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.1, 8, 20), stone)
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.12
  group.add(ring)
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), glow)
  crystal.position.y = 0.72
  crystal.userData.nodeId = 'crypt'
  group.add(crystal)
  const shardL = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 5), glow)
  shardL.position.set(-0.28, 0.4, 0.05)
  shardL.rotation.z = 0.4
  group.add(shardL)
  const shardR = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 5), glow)
  shardR.position.set(0.26, 0.32, -0.06)
  shardR.rotation.z = -0.5
  group.add(shardR)
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.28, 0.7, 2, 0.06), stone)
  plinth.position.y = 0.16
  group.add(plinth)
  const trim = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.06, 0.78, 1, 0.02), gold)
  trim.position.y = 0.32
  group.add(trim)
  return { id: 'crypt', x, z, group, glow }
}

function makeFountain(): NodeVisual {
  const group = new THREE.Group()
  const { x, z } = NODES.fountain
  group.position.set(x, 0, z)
  group.visible = false
  const stone = mat(0x4a3e58, { roughness: 0.55, metalness: 0.08 })
  const gold = mat(0xe2b44a, { metalness: 0.75, roughness: 0.3 })
  const glow = mat(0xff2238, { emissive: 0xff2238, emissiveIntensity: 1.5, roughness: 0.25 })
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.9, 0.38, 16), stone)
  basin.position.y = 0.22
  group.add(basin)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.06, 6, 16), gold)
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.4
  group.add(rim)
  const liquid = new THREE.Mesh(new THREE.CircleGeometry(0.68, 16), glow)
  liquid.rotation.x = -Math.PI / 2
  liquid.position.y = 0.36
  group.add(liquid)
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.7, 8), stone)
  pillar.position.y = 0.7
  group.add(pillar)
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), glow)
  orb.position.y = 1.12
  orb.userData.nodeId = 'fountain'
  group.add(orb)
  return { id: 'fountain', x, z, group, glow, liquid }
}

function laundry(parent: THREE.Object3D): void {
  const lines: [number, number, number, number, number][] = [
    [-20.05, 3.25, -17.65, 3.05, -33.6],
    [-12.4, 3.15, -9.2, 2.95, -25.9],
    [-2.4, 3.2, -0.1, 2.95, 12.2 + NORTH_ALLEY_SHIFT],
  ]
  const clothMat = [mat(0xd7c2a4), mat(0xc45a3a), mat(0x6e8a62), mat(0x8a6aaa)]
  lines.forEach(([x1, y, x2, y2, z], line) => {
    const count = 4
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count
      const x = x1 + (x2 - x1) * t
      const sag = Math.sin(t * Math.PI) * 0.18
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.48), clothMat[(i + line) % clothMat.length])
      cloth.position.set(x, y - 0.28 - sag, z + (i % 2) * 0.05)
      cloth.rotation.y = 0.25 + i * 0.15
      parent.add(cloth)
    }
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, Math.hypot(x2 - x1, y2 - y), 4), TIMBER)
    rope.position.set((x1 + x2) / 2, (y + y2) / 2 - 0.05, z)
    rope.rotation.z = Math.PI / 2
    parent.add(rope)
  })
}

function lampsOf(parent: THREE.Object3D, spots: THREE.Vector3[]): void {
  const spriteMat = new THREE.SpriteMaterial({
    map: radial(64, 'rgba(255,170,70,0.85)', 'rgba(255,120,40,0)'),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  for (const p of spots) {
    const glow = new THREE.Sprite(spriteMat)
    glow.position.copy(p)
    glow.scale.set(1.15, 1.15, 1)
    parent.add(glow)
  }
}

function sky(scene: THREE.Scene): { moon: THREE.Mesh; clouds: THREE.Mesh[] } {
  const moonPos = new THREE.Vector3(-6.4, 13.4, -10.5)
  const geo = new THREE.SphereGeometry(220, 24, 16)
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uMoon: { value: moonPos.clone().normalize() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vDir = normalize(wp.xyz - cameraPosition);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uMoon;
      void main() {
        vec3 haze = vec3(0.1098, 0.0627, 0.1569);
        float up = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(haze, vec3(0.15, 0.07, 0.22), smoothstep(0.08, 0.85, up));
        float m = pow(max(dot(normalize(vDir), uMoon), 0.0), 22.0);
        col += vec3(0.42, 0.26, 0.72) * m;
        col = mix(haze, col, smoothstep(-0.08, 0.55, vDir.y));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
  const dome = new THREE.Mesh(geo, material)
  dome.frustumCulled = false
  dome.renderOrder = -1
  scene.add(dome)

  const moon = new THREE.Mesh(new THREE.SphereGeometry(4.8, 24, 16), new THREE.MeshBasicMaterial({ color: 0xd7c2ff }))
  moon.position.copy(moonPos)
  moon.userData.baseX = moonPos.x
  scene.add(moon)
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: radial(128, 'rgba(180,130,255,0.55)', 'rgba(90,40,160,0)'),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  halo.scale.set(18, 18, 1)
  halo.position.copy(moon.position)
  moon.userData.halo = halo
  scene.add(halo)

  const clouds: THREE.Mesh[] = []
  for (const [x, y, z, sx, sy] of [
    [-12, 15.5, -16, 7, 2.2],
    [-4, 14.2, -18, 5.5, 1.8],
  ] as const) {
    const c = new THREE.Mesh(
      new THREE.PlaneGeometry(sx, sy),
      new THREE.MeshBasicMaterial({
        map: radial(64, 'rgba(90,50,140,0.4)', 'rgba(40,16,70,0)'),
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    c.position.set(x, y, z)
    c.lookAt(0, 6, 8)
    scene.add(c)
    clouds.push(c)
  }
  return { moon, clouds }
}

function radial(size: number, inner: string, outer: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.5)
  grd.addColorStop(0, inner)
  grd.addColorStop(1, outer)
  g.fillStyle = grd
  g.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function asphalt(parent: THREE.Object3D): void {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(11.5, 28),
    mat(0x2a3344, { emissive: 0x121826, emissiveIntensity: 0.45 }),
  )
  disc.rotation.x = -Math.PI / 2
  disc.position.set(0, -0.02, MOB_Z)
  parent.add(disc)
  const sheen = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 13.5),
    mat(0x3d4c66, { emissive: 0x1a2740, emissiveIntensity: 0.55, transparent: true, opacity: 0.72 }),
  )
  sheen.rotation.x = -Math.PI / 2
  sheen.position.set(0.2, 0.01, MOB_Z)
  parent.add(sheen)
  const wet = mat(0x6ea0c8, { emissive: 0x2a4a66, emissiveIntensity: 0.7, transparent: true, opacity: 0.42 })
  for (const [x, z, rx, rz] of [
    [1.4, MOB_Z - 0.8, 1.3, 0.85],
    [-1.7, MOB_Z + 1.1, 1.05, 0.7],
    [0.3, MOB_Z + 2.6, 0.8, 0.55],
    [-0.4, MOB_Z - 2.4, 1.5, 0.6],
  ] as const) {
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 14), wet)
    puddle.rotation.x = -Math.PI / 2
    puddle.position.set(x, 0.02, z)
    puddle.scale.set(rx, rz, 1)
    parent.add(puddle)
  }
}

function makeGate(parent: THREE.Object3D, x: number, z: number, yaw: number, glow: THREE.MeshLambertMaterial): void {
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  group.rotation.y = yaw
  const post = mat(0x241820)
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.35, 0.16), post)
    p.position.set(side * 0.72, 1.15, 0)
    group.add(p)
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.16), glow)
  bar.position.y = 2.28
  group.add(bar)
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.28), glow)
  sign.position.y = 2.05
  group.add(sign)
  parent.add(group)
}

function neonSign(
  parent: THREE.Object3D,
  text: string,
  css: string,
  x: number,
  y: number,
  z: number,
  yaw: number,
  w: number,
  h: number,
): void {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 96
  const g = c.getContext('2d')!
  g.clearRect(0, 0, 256, 96)
  g.font = '700 54px Cinzel, serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.shadowColor = css
  g.shadowBlur = 18
  g.fillStyle = css
  g.fillText(text, 128, 50)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  )
  board.position.set(x, y, z)
  board.rotation.y = yaw
  parent.add(board)
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: radial(64, css.replace(')', ',0.55)').replace('rgb', 'rgba').includes('rgba') ? 'rgba(255,80,140,0.45)' : 'rgba(255,80,160,0.4)', 'rgba(0,0,0,0)'),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  halo.position.set(x, y, z)
  halo.scale.set(w * 1.8, h * 2.4, 1)
  parent.add(halo)
}

function frontOf(block: AlleyBlock, ox: number, oz: number, pad: number): { x: number; y: number; z: number; yaw: number } {
  const yaw = Math.atan2(ox - block.x, oz - block.z)
  return {
    x: block.x + Math.sin(yaw) * (block.d / 2 + pad),
    y: 2.45,
    z: block.z + Math.cos(yaw) * (block.d / 2 + pad),
    yaw,
  }
}

function streetLamps(parent: THREE.Object3D, spots: [number, number][]): void {
  const pole = mat(0x2a2428)
  const bulb = mat(0xffe1a8, { emissive: 0xffc56a, emissiveIntensity: 1.6 })
  const spriteMat = new THREE.SpriteMaterial({
    map: radial(64, 'rgba(255,190,110,0.8)', 'rgba(255,120,40,0)'),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  for (const [x, z] of spots) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.5, 6), pole)
    post.position.set(x, 1.25, z)
    parent.add(post)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), bulb)
    head.position.set(x, 2.5, z)
    parent.add(head)
    const glow = new THREE.Sprite(spriteMat)
    glow.position.set(x, 2.55, z)
    glow.scale.set(1.3, 1.3, 1)
    parent.add(glow)
  }
}

function mobClassic(scene: THREE.Scene): void {
  const bucket = new Bucket()
  MOB_BLOCKS.forEach((b, i) => {
    const root = faceToward(b.x, b.z, 0, MOB_Z, b.lean)
    const h = b.floors * 1.25
    const brick = BRICKS[i % 3]
    put(bucket, brick, root, b.w, h, b.d, 0, h / 2, 0)
    put(bucket, ROOF, root, b.w * 1.04, 0.16, b.d * 1.06, 0, h + 0.06, 0)
    const awning = mat(i % 2 === 0 ? 0xd23a4a : 0x2f6ad0, {
      emissive: i % 2 === 0 ? 0xff4466 : 0x44aaff,
      emissiveIntensity: 0.85,
    })
    put(bucket, awning, root, b.w * 0.7, 0.08, 0.5, 0, 1.55, b.d / 2 + 0.18)
  })
  for (const car of MOB_CARS) {
    const root = new THREE.Matrix4().makeTranslation(car.x, 0, car.z).multiply(new THREE.Matrix4().makeRotationY(car.rot))
    const paint = mat(car.key === 'taxi' ? 0xf0c43a : 0x8a3038, { emissive: 0x1a1014, emissiveIntensity: 0.25 })
    put(bucket, paint, root, 1.9, 0.55, 0.95, 0, 0.55, 0)
    put(bucket, mat(0xc8ddf0, { emissive: 0x88aacc, emissiveIntensity: 0.35 }), root, 0.7, 0.32, 0.04, 0, 0.78, 0.48)
  }
  bucket.flush(scene)
  streetLamps(scene, [
    [-3.2, MOB_Z - 0.4],
    [3.4, MOB_Z + 0.2],
    [0.2, MOB_Z - 4.6],
  ])
}

function dressStreets(scene: THREE.Scene): { gateGlow: THREE.MeshLambertMaterial } {
  const gateGlow = mat(0x6a3a58, { emissive: 0xff4ad8, emissiveIntensity: 0.28 })
  if (!MOB_ARENA) return { gateGlow }
  asphalt(scene)
  const mobGlow = mat(0x49e0ff, { emissive: 0x49e0ff, emissiveIntensity: 1.5 })
  if (DISTRICT_OPEN) makeGate(scene, SLUM_GATE.x, SLUM_GATE.z, Math.PI / 2, gateGlow)
  // The club gate is the district's way out at the end of a night.
  makeGate(scene, MOB_GATE.x, MOB_GATE.z, Math.PI, mobGlow)
  const diner = frontOf(MOB_BLOCKS[0], 0, MOB_Z, 0.42)
  const club = frontOf(MOB_BLOCKS[1], 0, MOB_Z, 0.42)
  neonSign(scene, 'DINER', '#ff4d6a', diner.x, diner.y, diner.z, diner.yaw, 1.55, 0.42)
  neonSign(scene, 'CLUB', '#49e0ff', club.x, club.y, club.z, club.yaw, 1.4, 0.42)
  neonSign(scene, 'OPEN', '#8dff6a', diner.x, 1.65, diner.z, diner.yaw, 0.72, 0.26)
  return { gateGlow }
}

/** Dark end of the KayKit brick, for the classic-mode walls. */
const DARK_BRICK = mat(0x7d3d2c, { emissive: 0x6a3428, emissiveIntensity: 0.9 })
const BRICK_CAP = mat(0xb27052, { emissive: 0x8a5840, emissiveIntensity: 0.9 })
const BRICK_CAP_TOP = BRICK_CAP.clone()
BRICK_CAP_TOP.polygonOffset = true
BRICK_CAP_TOP.polygonOffsetFactor = -1.5
BRICK_CAP_TOP.polygonOffsetUnits = -1.5

/**
 * Classic mode has no outer block, so each gap still ends in a lit brick
 * wall a few meters out. The dressed city already shows the next block and
 * the street past the low barrier. The old untextured 2.4 m stubs sat in
 * that alley, unlit, and read as black slabs, so they are not drawn.
 * The wall is outside the walkable shape; the player still stops at the court.
 */
function stubClosures(parent: THREE.Object3D, rails: boolean): void {
  if (!rails) return
  const bucket = new Bucket()
  const glows: THREE.Vector3[] = []
  for (const gap of SLUM_GAPS) {
    const root = faceToward(gap.x, gap.z, gap.x + gap.ox, gap.z + gap.oz)
    const span = Math.max(0.7, gap.span - 0.04)
    put(bucket, DARK_BRICK, root, span + 0.12, 2.2, 0.22, 0, 1.1, 3.05)
    put(bucket, BRICK_CAP, root, span + 0.2, 0.18, 0.28, 0, 2.28, 3.05)
    put(bucket, LANTERN, root, 0.12, 0.14, 0.08, 0, 1.72, 2.86)
    glows.push(new THREE.Vector3(0, 1.72, 2.86).applyMatrix4(root))
    const fit = barrierFit(gap)
    const z = BARRIER_FACE + BARRIER_RECESS + BARRIER_D / 2
    if (gap.kind === 0) {
      put(bucket, DARK_BRICK, root, fit.width, BARRIER_H, BARRIER_D, fit.along, BARRIER_H / 2, z)
    } else {
      const capH = BARRIER_H * 0.22
      const bodyH = BARRIER_H - capH
      const lip = 0.02
      put(bucket, DARK_BRICK, root, fit.width, bodyH, BARRIER_D, fit.along, bodyH / 2, z)
      put(bucket, BRICK_CAP_TOP, root, fit.width, capH + lip, BARRIER_D, fit.along, bodyH + (capH + lip) / 2 - lip / 2, z)
    }
    put(bucket, CRATE, root, 0.42, 0.36, 0.38, span * 0.18, 0.2, 1.55)
  }
  bucket.flush(parent)
  if (!rails || glows.length === 0) return
  const spriteMat = new THREE.SpriteMaterial({
    map: radial(64, 'rgba(255,190,110,0.85)', 'rgba(255,120,40,0)'),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  for (const glow of glows) {
    const sprite = new THREE.Sprite(spriteMat)
    sprite.position.copy(glow)
    sprite.scale.set(0.7, 0.7, 1)
    parent.add(sprite)
  }
}

/** Barred door on the east side of the center court. The next zone stays shut. */
function lockedGate(parent: THREE.Object3D): void {
  const { x, z } = SLUM_GATE
  const root = new THREE.Matrix4().makeTranslation(x, 0, z).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2))
  const bucket = new Bucket()
  const stone = mat(0x3a3144)
  const iron = mat(0x2a242c)
  const board = mat(0x6a4030)
  put(bucket, stone, root, 0.28, 2.15, 0.28, -0.62, 1.08, 0)
  put(bucket, stone, root, 0.28, 2.15, 0.28, 0.62, 1.08, 0)
  put(bucket, stone, root, 1.55, 0.22, 0.32, 0, 2.15, 0)
  put(bucket, DOOR, root, 0.86, 1.55, 0.1, 0, 0.82, 0)
  put(bucket, board, root, 0.95, 0.1, 0.06, 0, 0.7, 0.08, 0, 0, 0.18)
  put(bucket, board, root, 0.95, 0.1, 0.06, 0, 1.15, 0.08, 0, 0, -0.22)
  put(bucket, iron, root, 0.08, 0.08, 0.9, 0, 1.45, 0.12)
  put(bucket, iron, root, 1.15, 0.08, 0.08, 0, 0.42, 0.16)
  bucket.flush(parent)
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const g = canvas.getContext('2d')!
  g.fillStyle = '#1a1018'
  g.fillRect(0, 0, 256, 128)
  g.strokeStyle = '#c45a6a'
  g.lineWidth = 8
  g.strokeRect(8, 8, 240, 112)
  g.fillStyle = '#f0d0c8'
  g.font = '700 36px Cinzel, serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('DISTRICT', 128, 48)
  g.fillStyle = '#e07080'
  g.font = '700 28px Cinzel, serif'
  g.fillText('BARRED', 128, 90)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const signMat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xff8899, emissiveMap: tex, emissiveIntensity: 0.35 })
  addRim(signMat)
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.58), signMat)
  sign.position.set(x, 2.55, z)
  sign.rotation.y = -Math.PI / 2
  parent.add(sign)
}

export function buildWorld(
  scene: THREE.Scene,
  dress?: (scene: THREE.Scene, blocks: AlleyBlock[]) => void,
): WorldHandle {
  const fog = new THREE.Fog(FOG_COLOR, 8, 28)
  scene.fog = fog
  scene.background = new THREE.Color(FOG_COLOR)

  const low = qualityLow()
  const hemi = new THREE.HemisphereLight(0x6e58a4, 0x3a2218, low ? 0.95 : 0.46)
  scene.add(hemi)
  const moonLight = new THREE.DirectionalLight(0xb48cff, low ? 1.05 : 0.7)
  moonLight.position.set(-12, 18, -9)
  scene.add(moonLight)
  const keyLight = new THREE.DirectionalLight(0xffc48a, low ? 0.95 : 1.22)
  keyLight.position.set(4.2, 9.2, 5.4)
  keyLight.target.position.set(0, 0.4, 0)
  scene.add(keyLight, keyLight.target)
  if (!low) {
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(1024, 1024)
    keyLight.shadow.camera.near = 0.5
    keyLight.shadow.camera.far = 22
    keyLight.shadow.camera.left = -7
    keyLight.shadow.camera.right = 7
    keyLight.shadow.camera.top = 7
    keyLight.shadow.camera.bottom = -7
    keyLight.shadow.bias = -0.0008
    keyLight.shadow.normalBias = 0.02
    keyLight.shadow.radius = 2.8
  }
  const fill = new THREE.DirectionalLight(0x6a88d0, low ? 0.32 : 0.2)
  fill.position.set(-4, 3.2, 6)
  scene.add(fill)
  if (!low) {
    const lamps: [number, number][] = [
      [-6.0, 2.4],
      [5.2, 6.8],
      [-28.6, -50.4],
      [-44.4, 18.2],
    ]
    for (const [x, z] of lamps) {
      const lamp = new THREE.PointLight(0xffb15a, 7.5, 7.2, 2)
      lamp.position.set(x, 2.35, z)
      scene.add(lamp)
    }
  }
  lampPools(scene)

  cobbles(scene)
  const streets = dressStreets(scene)

  const blocks: Block[] = SLUM_BLOCKS.map((block) => ({ ...block, brick: block.brick ?? 0 }))
  if (dress) {
    dress(scene, blocks)
  } else {
    const bucket = new Bucket()
    const lamps: THREE.Vector3[] = []
    for (const b of blocks) tenement(bucket, lamps, b)
    bucket.flush(scene)
    lampsOf(scene, lamps)
    if (MOB_ARENA) mobClassic(scene)
  }
  stubClosures(scene, !dress)
  laundry(scene)
  lockedGate(scene)

  const crypt = makeCrypt()
  const fountain = makeFountain()
  // The barred gate is the only thing standing in the walkable streets.
  const obstacles: { x: number; z: number; r: number }[] = [
    { x: SLUM_GATE.x, z: SLUM_GATE.z, r: 0.58 },
  ]
  if (MOB_ARENA) {
    for (const b of MOB_BLOCKS) obstacles.push({ x: b.x, z: b.z, r: b.w * 0.48 })
    for (const car of MOB_CARS) obstacles.push({ x: car.x, z: car.z, r: 0.9 })
  }

  const { moon, clouds } = sky(scene)
  return { obstacles, nodes: { crypt, fountain }, fog, moon, clouds, gateGlow: streets.gateGlow, keyLight }
}

const LAMP_POOLS: [number, number, number][] = [
  [-6.0, 2.4, 1.85],
  [5.2, 6.8, 1.7],
  [-28.6, -50.4, 1.65],
  [-44.4, 18.2, 1.7],
  [-12.0, -26.0, 0.75],
  [-16.0, 19.4, 0.7],
]

function lampPools(scene: THREE.Scene): void {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffb060,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  for (const [x, z, r] of LAMP_POOLS) {
    const pool = new THREE.Mesh(new THREE.CircleGeometry(r, 20), mat)
    pool.rotation.x = -Math.PI / 2
    pool.position.set(x, 0.045, z)
    scene.add(pool)
  }
}

export function setNodeVisual(node: NodeVisual, ready: boolean): void {
  node.glow.emissiveIntensity = ready ? (node.id === 'crypt' ? 1.9 : 1.55) : 0.08
  if (node.liquid) node.liquid.visible = ready
}
