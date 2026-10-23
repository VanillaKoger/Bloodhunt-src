import * as THREE from 'three'

/**
 * Ground markers for incoming attacks. Every marker is a faint area plus a
 * brighter fill that grows to the edge as the attack winds up, so the moment
 * the fill meets the rim is the moment it lands.
 *
 * Gold: an enemy's plain attack. Breaking its poise cancels it.
 * Red: an ability. Nothing cancels it; step out of the area.
 * Pool: lingering ground (bile, acid) that hurts while you stand in it.
 */
export type TeleTone = 'gold' | 'red' | 'pool'

export type TeleShape = 'circle' | 'lane' | 'cone'

export interface Tele {
  shape: TeleShape
  group: THREE.Group
  edge: THREE.Mesh
  fill: THREE.Mesh
  rim: THREE.Mesh | null
  tone: TeleTone
}

const TONE: Record<TeleTone, { color: number; base: number; fill: number }> = {
  gold: { color: 0xffc23a, base: 0.16, fill: 0.34 },
  red: { color: 0xff2238, base: 0.26, fill: 0.46 },
  pool: { color: 0x9cff3a, base: 0.3, fill: 0.22 },
}

function mat(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
}

export class Telegraphs {
  private readonly disc = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2)
  private readonly ring = new THREE.RingGeometry(0.93, 1, 40).rotateX(-Math.PI / 2)
  // Lanes run from the origin along +z, one unit long and wide.
  private readonly strip = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5)
  // A frame round the lane, so it reads on any floor.
  private readonly frame = (() => {
    const outer = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0.5, 1), new THREE.Vector2(-0.5, 1)])
    outer.holes.push(new THREE.Path([new THREE.Vector2(-0.43, 0.025), new THREE.Vector2(-0.43, 0.975), new THREE.Vector2(0.43, 0.975), new THREE.Vector2(0.43, 0.025)]))
    // Shape space is x/y; lay it flat so y runs along +z.
    return new THREE.ShapeGeometry(outer).rotateX(Math.PI / 2)
  })()
  private readonly cones = new Map<number, THREE.BufferGeometry>()
  private readonly arcs = new Map<number, THREE.BufferGeometry>()
  private readonly free: Record<TeleShape, Tele[]> = { circle: [], lane: [], cone: [] }
  private readonly live = new Set<Tele>()

  constructor(private readonly scene: THREE.Scene) {}

  /** A disc of radius `r` around a point. */
  circle(x: number, z: number, r: number, tone: TeleTone): Tele {
    const t = this.take('circle', tone)
    t.group.position.set(x, 0.05, z)
    t.group.rotation.set(0, 0, 0)
    t.group.scale.set(r, 1, r)
    this.progress(t, 0)
    return t
  }

  /** A straight lane from a point along `angle` (atan2(dx, dz)), `len` long and `width` wide. */
  lane(x: number, z: number, angle: number, len: number, width: number, tone: TeleTone): Tele {
    const t = this.take('lane', tone)
    t.group.position.set(x, 0.05, z)
    t.group.rotation.set(0, angle, 0)
    t.group.scale.set(width, 1, len)
    this.progress(t, 0)
    return t
  }

  /** A wedge of radius `r` along `angle`, `half` radians to each side. */
  cone(x: number, z: number, angle: number, r: number, half: number, tone: TeleTone): Tele {
    const t = this.take('cone', tone, half)
    t.group.position.set(x, 0.05, z)
    t.group.rotation.set(0, angle, 0)
    t.group.scale.set(r, 1, r)
    this.progress(t, 0)
    return t
  }

  /** 0 just started, 1 lands now. */
  progress(t: Tele, k: number): void {
    const p = Math.max(0.001, Math.min(1, k))
    if (t.shape === 'lane') t.fill.scale.set(1, 1, p)
    else t.fill.scale.set(p, 1, p)
    const m = t.fill.material as THREE.MeshBasicMaterial
    m.opacity = TONE[t.tone].fill * (0.6 + p * 0.7)
  }

  move(t: Tele, x: number, z: number, angle?: number): void {
    t.group.position.set(x, 0.05, z)
    if (angle != null) t.group.rotation.set(0, angle, 0)
  }

  /** Fades a pool out over its last moments. */
  fade(t: Tele, k: number): void {
    const a = Math.max(0, Math.min(1, k))
    ;(t.edge.material as THREE.MeshBasicMaterial).opacity = TONE[t.tone].base * a
    ;(t.fill.material as THREE.MeshBasicMaterial).opacity = TONE[t.tone].fill * a
  }

  release(t: Tele | null): void {
    if (!t || !this.live.has(t)) return
    this.live.delete(t)
    t.group.visible = false
    this.scene.remove(t.group)
    this.free[t.shape].push(t)
  }

  clear(): void {
    for (const t of [...this.live]) this.release(t)
  }

  private coneGeo(half: number): THREE.BufferGeometry {
    const key = Math.round(half * 100)
    let g = this.cones.get(key)
    if (!g) {
      // CircleGeometry sweeps from +x in its own plane; laid flat, angle −π/2 points along +z.
      g = new THREE.CircleGeometry(1, 24, -Math.PI / 2 - half, half * 2).rotateX(-Math.PI / 2)
      this.cones.set(key, g)
    }
    return g
  }

  private arcGeo(half: number): THREE.BufferGeometry {
    const key = Math.round(half * 100)
    let g = this.arcs.get(key)
    if (!g) {
      g = new THREE.RingGeometry(0.93, 1, 24, 1, -Math.PI / 2 - half, half * 2).rotateX(-Math.PI / 2)
      this.arcs.set(key, g)
    }
    return g
  }

  private take(shape: TeleShape, tone: TeleTone, half = 0.6): Tele {
    let t = this.free[shape].pop()
    const geo = shape === 'circle' ? this.disc : shape === 'lane' ? this.strip : this.coneGeo(half)
    const rimGeo = shape === 'circle' ? this.ring : shape === 'lane' ? this.frame : this.arcGeo(half)
    if (!t) {
      const group = new THREE.Group()
      const edge = new THREE.Mesh(geo, mat(0xffffff, 0.2))
      const fill = new THREE.Mesh(geo, mat(0xffffff, 0.4))
      fill.position.y = 0.005
      group.add(edge, fill)
      const rim = new THREE.Mesh(rimGeo, mat(0xffffff, 0.8))
      rim.position.y = 0.01
      group.add(rim)
      for (const m of [edge, fill, rim]) m.renderOrder = 2
      t = { shape, group, edge, fill, rim, tone }
    }
    t.edge.geometry = geo
    t.fill.geometry = geo
    if (t.rim) t.rim.geometry = rimGeo
    t.tone = tone
    const spec = TONE[tone]
    for (const m of [t.edge, t.fill, t.rim]) if (m) (m.material as THREE.MeshBasicMaterial).color.setHex(spec.color)
    ;(t.edge.material as THREE.MeshBasicMaterial).opacity = spec.base
    if (t.rim) (t.rim.material as THREE.MeshBasicMaterial).opacity = tone === 'pool' ? 0.35 : 0.85
    t.group.visible = true
    this.scene.add(t.group)
    this.live.add(t)
    return t
  }
}
