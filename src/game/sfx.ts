export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  muted = false

  unlock(): void {
    if (this.muted) return
    const ctx = this.ensure()
    if (ctx && ctx.state === 'suspended') void ctx.resume()
  }

  setMuted(m: boolean): void {
    this.muted = m
    if (this.master) this.master.gain.value = m ? 0 : 0.22
  }

  private ensure(): AudioContext | null {
    if (this.muted) return null
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.22
      this.master.connect(this.ctx.destination)
    }
    return this.ctx
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slide?: number, delay = 0): void {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const t = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur)
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.connect(g)
    g.connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  play(name: 'hit' | 'kill' | 'skill' | 'pickup' | 'upgrade' | 'hurt' | 'boss' | 'level' | 'click'): void {
    if (this.muted) return
    switch (name) {
      case 'hit':
        this.tone(210, 0.05, 'square', 0.18, 90)
        break
      case 'kill':
        this.tone(440, 0.08, 'triangle', 0.3, 660)
        this.tone(660, 0.12, 'sine', 0.22, 880, 0.06)
        break
      case 'skill':
        this.tone(320, 0.18, 'sawtooth', 0.16, 720)
        this.tone(480, 0.14, 'triangle', 0.12, 240, 0.02)
        break
      case 'pickup':
        this.tone(760, 0.07, 'sine', 0.2, 1040)
        break
      case 'upgrade':
        this.tone(523, 0.1, 'triangle', 0.28)
        this.tone(659, 0.12, 'triangle', 0.24, undefined, 0.08)
        this.tone(784, 0.16, 'triangle', 0.22, undefined, 0.16)
        break
      case 'hurt':
        this.tone(140, 0.12, 'sawtooth', 0.28, 60)
        break
      case 'boss':
        this.tone(98, 0.35, 'sawtooth', 0.3, 55)
        this.tone(146, 0.3, 'square', 0.12, undefined, 0.04)
        break
      case 'level':
        this.tone(392, 0.1, 'triangle', 0.26)
        this.tone(523, 0.14, 'triangle', 0.24, undefined, 0.09)
        this.tone(659, 0.2, 'sine', 0.2, undefined, 0.18)
        break
      case 'click':
        this.tone(620, 0.04, 'square', 0.12, 400)
        break
    }
  }
}
