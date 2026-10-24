import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Map decorations from free model packs (see CREDITS.md), baked by
 * scripts/build_decor.py into one flat-colored file: public/decor/decor.glb.
 * Each prop is one mesh, base at y = 0 and centered on its footprint, with
 * a few solid-color parts. The map art merges them into its own buckets.
 */
export interface DecorModel {
  /** One part per color. Colors are sRGB hex, the same as every placeholder material. */
  parts: { color: number; geo: THREE.BufferGeometry }[]
  /** Native size, before the map asks for a height. */
  size: THREE.Vector3
}

export type DecorLib = Map<string, DecorModel>

function asset(path: string): string {
  return new URL(path, new URL(import.meta.env.BASE_URL, window.location.href)).href
}

export async function loadDecor(): Promise<DecorLib> {
  const gltf = await new GLTFLoader().loadAsync(asset('decor/decor.glb'))
  gltf.scene.updateMatrixWorld(true)
  const lib: DecorLib = new Map()
  const color = new THREE.Color()
  for (const node of gltf.scene.children) {
    const parts: DecorModel['parts'] = []
    const box = new THREE.Box3()
    node.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const m = mesh.material as THREE.MeshStandardMaterial
      // The file stores sRGB in baseColorFactor, which the loader reads as linear: read the raw numbers back as sRGB.
      color.setRGB(m.color.r, m.color.g, m.color.b, THREE.SRGBColorSpace)
      const geo = mesh.geometry.clone()
      geo.applyMatrix4(mesh.matrixWorld)
      geo.computeBoundingBox()
      box.union(geo.boundingBox!)
      parts.push({ color: color.getHex(), geo })
      m.dispose()
    })
    if (parts.length) lib.set(node.name, { parts, size: box.getSize(new THREE.Vector3()) })
  }
  return lib
}
