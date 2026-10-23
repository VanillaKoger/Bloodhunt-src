import type { SkillId, Slot } from './types'

function bat(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, 1)
  ctx.bezierCurveTo(8, -10, 26, -8, 36, 8)
  ctx.bezierCurveTo(24, 0, 16, 8, 8, 18)
  ctx.lineTo(0, 8)
  ctx.lineTo(-8, 18)
  ctx.bezierCurveTo(-16, 8, -24, 0, -36, 8)
  ctx.bezierCurveTo(-26, -8, -8, -10, 0, 1)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-4, -2)
  ctx.lineTo(-2, -12)
  ctx.lineTo(0, -3)
  ctx.lineTo(2, -12)
  ctx.lineTo(4, -2)
  ctx.fill()
  ctx.restore()
}

function backdrop(ctx: CanvasRenderingContext2D, s: number, inner: string, outer: string): void {
  const g = ctx.createRadialGradient(s * 0.5, s * 0.45, s * 0.08, s * 0.5, s * 0.5, s * 0.52)
  g.addColorStop(0, inner)
  g.addColorStop(1, outer)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
}

export function paintSkill(canvas: HTMLCanvasElement, id: SkillId): void {
  const s = 128
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, s, s)
  if (id === 'bats') {
    backdrop(ctx, s, '#8a1834', '#1a060c')
    bat(ctx, 64, 70, 1.15, '#1a060c')
    bat(ctx, 34, 48, 0.62, '#12040a')
    bat(ctx, 96, 50, 0.55, '#12040a')
    bat(ctx, 64, 38, 0.42, '#2a0a12')
    ctx.fillStyle = 'rgba(255, 50, 70, 0.35)'
    ctx.beginPath()
    ctx.ellipse(64, 88, 28, 10, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (id === 'drain') {
    backdrop(ctx, s, '#6e1024', '#14060c')
    ctx.strokeStyle = '#ff4a5a'
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(28, 92)
    ctx.quadraticCurveTo(70, 20, 100, 36)
    ctx.stroke()
    ctx.strokeStyle = '#ffd0d4'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(36, 80)
    ctx.quadraticCurveTo(68, 32, 92, 42)
    ctx.stroke()
    for (const [x, y, r] of [[40, 40, 6], [78, 78, 5], [58, 58, 4], [88, 64, 3]] as const) {
      ctx.fillStyle = '#ff2a3c'
      ctx.beginPath()
      ctx.ellipse(x, y, r * 0.7, r, 0.6, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (id === 'dash') {
    backdrop(ctx, s, '#0e6e78', '#06141c')
    ctx.strokeStyle = 'rgba(160, 255, 245, 0.55)'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    for (const y of [40, 58, 76]) {
      ctx.beginPath()
      ctx.moveTo(18, y)
      ctx.lineTo(48, y - 6)
      ctx.stroke()
    }
    ctx.fillStyle = '#062028'
    ctx.beginPath()
    ctx.ellipse(78, 64, 16, 22, -0.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#9ffcf2'
    ctx.fillRect(62, 40, 8, 18)
    ctx.beginPath()
    ctx.moveTo(70, 34)
    ctx.lineTo(92, 48)
    ctx.lineTo(74, 52)
    ctx.fill()
  } else {
    backdrop(ctx, s, '#5a0820', '#160610')
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 40)
    g.addColorStop(0, '#2a0410')
    g.addColorStop(0.45, '#ff2438')
    g.addColorStop(1, 'rgba(255, 30, 50, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(64, 64, 40, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#ff5a68'
    ctx.lineWidth = 2
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(64 + Math.cos(a) * 18, 64 + Math.sin(a) * 18)
      ctx.lineTo(64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46)
      ctx.stroke()
    }
    ctx.fillStyle = '#1a0610'
    ctx.beginPath()
    ctx.ellipse(64, 64, 10, 16, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ff3355'
    ctx.beginPath()
    ctx.ellipse(64, 64, 4, 8, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function paintSlot(canvas: HTMLCanvasElement, slot: Slot): void {
  const s = 128
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, s, s)
  ctx.strokeStyle = '#f0d48a'
  ctx.fillStyle = '#f0d48a'
  ctx.lineWidth = 6
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  if (slot === 'weapon') {
    ctx.beginPath()
    ctx.moveTo(78, 24)
    ctx.lineTo(40, 78)
    ctx.lineTo(52, 88)
    ctx.lineTo(90, 34)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#8a1a28'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(70, 36)
    ctx.lineTo(48, 70)
    ctx.stroke()
    ctx.strokeStyle = '#f0d48a'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.moveTo(36, 86)
    ctx.lineTo(28, 104)
    ctx.stroke()
    ctx.fillStyle = '#ff3355'
    ctx.beginPath()
    ctx.arc(58, 62, 6, 0, Math.PI * 2)
    ctx.fill()
  } else if (slot === 'cape') {
    ctx.beginPath()
    ctx.moveTo(64, 22)
    ctx.lineTo(96, 40)
    ctx.lineTo(88, 100)
    ctx.lineTo(64, 86)
    ctx.lineTo(40, 100)
    ctx.lineTo(32, 40)
    ctx.closePath()
    ctx.stroke()
    bat(ctx, 64, 62, 0.7, '#f0d48a')
  } else if (slot === 'coat') {
    ctx.beginPath()
    ctx.moveTo(64, 18)
    ctx.lineTo(96, 36)
    ctx.lineTo(90, 104)
    ctx.lineTo(64, 92)
    ctx.lineTo(38, 104)
    ctx.lineTo(32, 36)
    ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(64, 36)
    ctx.lineTo(64, 90)
    ctx.stroke()
    for (const y of [48, 62, 76]) {
      ctx.beginPath()
      ctx.arc(64, y, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    ctx.beginPath()
    ctx.moveTo(46, 28)
    ctx.lineTo(70, 28)
    ctx.lineTo(78, 48)
    ctx.lineTo(96, 56)
    ctx.lineTo(92, 96)
    ctx.lineTo(40, 96)
    ctx.lineTo(36, 70)
    ctx.lineTo(46, 48)
    ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(48, 58)
    ctx.lineTo(86, 66)
    ctx.stroke()
  }
}

