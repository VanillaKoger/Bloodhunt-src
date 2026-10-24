import * as THREE from 'three'

/**
 * Map decorations, taken from props the city already loads (kenney.ts: the
 * Kenney, KayKit, Quaternius, and Atomic Realm packs listed in CREDITS.md).
 * Each prop is baked once into a few flat-colored parts: its texture is
 * sampled at every face, so the map art can merge copies into its own
 * colored buckets. Props stand with their base at y = 0, centered on their
 * footprint.
 */
export interface DecorModel {
  /** One part per color. Colors are sRGB hex, the same as every placeholder material. */
  parts: { color: number; geo: THREE.BufferGeometry }[]
  /** Native size, before the map asks for a height. */
  size: THREE.Vector3
}

export type DecorLib = Map<string, DecorModel>

/** A loaded prop: a group with its base at y = 0, centered on its footprint. */
export interface DecorSource {
  object: THREE.Object3D
  size: THREE.Vector3
}

const pixels = new Map<unknown, { data: Uint8ClampedArray; w: number; h: number } | null>()

/** A texture's pixels, read once through a canvas. Null if the image cannot be read. */
function readPixels(tex: THREE.Texture | null): { data: Uint8ClampedArray; w: number; h: number } | null {
  const image = tex?.image as (CanvasImageSource & { width: number; height: number }) | undefined
  if (!image || !image.width) return null
  if (pixels.has(image)) return pixels.get(image)!
  let out: { data: Uint8ClampedArray; w: number; h: number } | null = null
  try {
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(image, 0, 0)
    out = { data: ctx.getImageData(0, 0, image.width, image.height).data, w: image.width, h: image.height }
  } catch {
    out = null
  }
  pixels.set(image, out)
  return out
}

/** Bakes the named props into flat-colored parts. Names that were not loaded are skipped. */
export function bakeDecor(sources: Record<string, DecorSource>, names: string[]): DecorLib {
  const lib: DecorLib = new Map()
  const base = new THREE.Color()
  const a = new THREE.Vector3()
  for (const name of names) {
    const src = sources[name]
    if (!src) continue
    src.object.updateMatrixWorld(true)
    const inv = new THREE.Matrix4().copy(src.object.matrixWorld).invert()
    const byColor = new Map<number, number[]>()
    src.object.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const geo = mesh.geometry
      const pos = geo.getAttribute('position')
      const uv = geo.getAttribute('uv')
      const index = geo.index
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const toProp = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld)
      const groups = geo.groups.length ? geo.groups : [{ start: 0, count: index ? index.count : pos.count, materialIndex: 0 }]
      for (const g of groups) {
        const m = mats[g.materialIndex ?? 0] as THREE.MeshLambertMaterial
        const tex = readPixels(m.map ?? null)
        base.copy(m.color)
        for (let i = g.start; i < g.start + g.count; i += 3) {
          const ids = [0, 1, 2].map((k) => (index ? index.getX(i + k) : i + k))
          let r = base.r
          let gg = base.g
          let b = base.b
          if (tex && uv) {
            // glTF textures are not flipped: v = 0 is the image's top row.
            const u = (uv.getX(ids[0]) + uv.getX(ids[1]) + uv.getX(ids[2])) / 3
            const v = (uv.getY(ids[0]) + uv.getY(ids[1]) + uv.getY(ids[2])) / 3
            const px = Math.min(tex.w - 1, Math.max(0, Math.floor((((u % 1) + 1) % 1) * tex.w)))
            const py = Math.min(tex.h - 1, Math.max(0, Math.floor((((v % 1) + 1) % 1) * tex.h)))
            const o = (py * tex.w + px) * 4
            const c = new THREE.Color().setRGB(tex.data[o] / 255, tex.data[o + 1] / 255, tex.data[o + 2] / 255, THREE.SRGBColorSpace)
            r *= c.r
            gg *= c.g
            b *= c.b
          }
          const hex = new THREE.Color(r, gg, b).getHex()
          // Near colors share a part, so a prop is a handful of draws at most.
          const q = ((hex >> 16) & 0xf8) << 16 | ((hex >> 8) & 0xf8) << 8 | (hex & 0xf8)
          let list = byColor.get(q)
          if (!list) byColor.set(q, (list = []))
          for (const id of ids) {
            a.fromBufferAttribute(pos, id).applyMatrix4(toProp)
            list.push(a.x, a.y, a.z)
          }
        }
      }
    })
    const parts: DecorModel['parts'] = []
    for (const [color, list] of byColor) {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(list, 3))
      geo.computeVertexNormals()
      parts.push({ color, geo })
    }
    if (parts.length) lib.set(name, { parts, size: src.size.clone() })
  }
  return lib
}
