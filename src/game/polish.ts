import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

/** Phones and weak GPUs skip shadows, bloom, and the outline pass. */
export function qualityLow(): boolean {
  return new URLSearchParams(location.search).has('low')
}

/** Soft fresnel rim so chunky Lambert meshes pick up a light edge. */
export function addRim(material: THREE.Material): void {
  const mat = material as THREE.MeshLambertMaterial
  if (!mat.isMaterial) return
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       float rimDot = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
       float rim = smoothstep(0.36, 1.0, pow(rimDot, 1.45));
       totalEmissiveRadiance += vec3(0.7, 0.2, 0.46) * rim;`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
      `vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
       outgoingLight *= mix(1.0, 0.32, rim);`,
    )
  }
  const prev = mat.customProgramCacheKey?.bind(mat)
  mat.customProgramCacheKey = () => `rim2-${prev ? prev() : ''}`
}

const GradeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 col = texel.rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(col * vec3(0.78, 0.70, 1.18), col, smoothstep(0.02, 0.42, l));
      col = mix(col, col * vec3(1.14, 0.93, 0.74), smoothstep(0.42, 1.05, l) * 0.55);
      gl_FragColor = vec4(col, texel.a);
    }
  `,
}

export interface Stage {
  low: boolean
  outline: THREE.Object3D[]
  present: () => void
  resize: (w: number, h: number) => void
}

export function createStage(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): Stage {
  const low = qualityLow()
  const outline: THREE.Object3D[] = []
  if (low) {
    return {
      low,
      outline,
      present: () => renderer.render(scene, camera),
      resize: () => {},
    }
  }

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.34, 0.4, 0.82)
  composer.addPass(bloom)
  composer.addPass(new ShaderPass(GradeShader))
  composer.addPass(new OutputPass())
  return {
    low,
    outline,
    present: () => composer.render(),
    resize: (w, h) => {
      composer.setPixelRatio(renderer.getPixelRatio())
      composer.setSize(w, h)
    },
  }
}

interface Drift {
  points: THREE.Points
  tick: (dt: number, x: number, z: number) => void
}

function moteTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(16, 16, 1, 16, 16, 16)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.4, 'rgba(255,255,255,0.55)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 32, 32)
  return new THREE.CanvasTexture(c)
}

/** Dust in the alley and a few embers near the lamps. Cheap on either quality. */
export function makeDrift(low: boolean): Drift {
  const count = low ? 14 : 42
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const seeds: { ox: number; oz: number; y: number; ember: boolean; speed: number }[] = []
  for (let i = 0; i < count; i++) {
    const ember = !low && i > count - 12
    const ox = (Math.random() - 0.5) * 9
    const oz = (Math.random() - 0.5) * 9
    const y = ember ? 0.3 + Math.random() * 1.4 : 0.4 + Math.random() * 2.4
    pos[i * 3] = ox
    pos[i * 3 + 1] = y
    pos[i * 3 + 2] = oz
    const warm = ember ? 1 : 0.55 + Math.random() * 0.3
    col[i * 3] = warm
    col[i * 3 + 1] = ember ? 0.45 + Math.random() * 0.3 : 0.42
    col[i * 3 + 2] = ember ? 0.18 : 0.62
    seeds.push({ ox, oz, y, ember, speed: ember ? 0.35 + Math.random() * 0.4 : 0.08 + Math.random() * 0.12 })
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: low ? 0.055 : 0.07,
      map: moteTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  )
  return {
    points,
    tick: (dt, x, z) => {
      const t = performance.now() * 0.001
      for (let i = 0; i < seeds.length; i++) {
        const s = seeds[i]
        s.y += s.speed * dt
        const limit = s.ember ? 1.8 : 2.8
        if (s.y > limit) s.y = s.ember ? 0.15 : 0.3
        const sway = Math.sin(t * (s.ember ? 2.2 : 0.6) + i) * (s.ember ? 0.15 : 0.25)
        pos[i * 3] = x + s.ox + sway
        pos[i * 3 + 1] = s.y
        pos[i * 3 + 2] = z + s.oz + Math.cos(t * 0.4 + i) * 0.12
      }
      ;(geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    },
  }
}
