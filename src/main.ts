import '@fontsource/cinzel/600.css'
import '@fontsource/cinzel/700.css'
import './style.css'
import { Game } from './game/Game'
import { loadStreetMaps } from './game/world'

const rootEl = document.getElementById('app')
if (!rootEl) throw new Error('Missing #app')
const root: HTMLElement = rootEl

window.addEventListener(
  'touchmove',
  (e) => {
    // Panels that can outgrow the screen keep their own finger scroll.
    if ((e.target as HTMLElement | null)?.closest?.('input, textarea, #menu, #haven, #night-end, #offline')) return
    e.preventDefault()
  },
  { passive: false },
)

async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search)
  try {
    await loadStreetMaps()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'The street failed to load.'
    root.innerHTML = `<div id="boot-error">${msg}</div>`
    console.error(err)
    return
  }
  let kenney = null
  if (!params.has('classic')) {
    root.innerHTML = '<div id="boot-error">The city is waking…</div>'
    try {
      const mod = await import('./game/kenney')
      kenney = await mod.loadKenney()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'The city failed to load.'
      root.innerHTML = `<div id="boot-error">${msg}</div>`
      console.error(err)
      return
    }
    root.innerHTML = ''
  }
  // The map decorations come baked from the city's own props; ?classic=1 keeps the primitive ones.
  const game = new Game(root, kenney, kenney?.decor ?? null)
  game.start()
}

boot().catch((err) => {
  const msg = err instanceof Error ? err.message : 'The hunt failed to start.'
  root.innerHTML = `<div id="boot-error">${msg}</div>`
  console.error(err)
})

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // BASE_URL is './', so the worker and its scope follow the page directory
    // (https://<user>.github.io/bloodhunt/) instead of the domain root.
    const base = new URL(import.meta.env.BASE_URL, window.location.href)
    const worker = new URL('sw.js', base)
    navigator.serviceWorker.register(worker.href, { scope: base.href }).catch(() => {})
  })
}
