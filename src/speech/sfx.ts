/** Tiny synthesised sound effects (no audio files needed). */
let ctx: AudioContext | null = null
let enabled = true

export function setSfxEnabled(on: boolean) {
  enabled = on
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.18) {
  const c = getCtx()
  if (!c) return
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, c.currentTime + start)
  g.gain.setValueAtTime(0.0001, c.currentTime + start)
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur)
  o.connect(g).connect(c.destination)
  o.start(c.currentTime + start)
  o.stop(c.currentTime + start + dur + 0.05)
}

export const sfx = {
  tap() {
    if (!enabled) return
    tone(660, 0, 0.08, 'triangle', 0.08)
  },
  correct() {
    if (!enabled) return
    tone(523, 0, 0.12, 'triangle')
    tone(659, 0.1, 0.12, 'triangle')
    tone(784, 0.2, 0.2, 'triangle')
  },
  wrong() {
    if (!enabled) return
    tone(220, 0, 0.18, 'sine', 0.12)
    tone(196, 0.15, 0.22, 'sine', 0.1)
  },
  star() {
    if (!enabled) return
    tone(880, 0, 0.1, 'sine', 0.12)
    tone(1175, 0.08, 0.16, 'sine', 0.12)
  },
  fanfare() {
    if (!enabled) return
    const notes = [523, 659, 784, 1047, 784, 1047]
    notes.forEach((n, i) => tone(n, i * 0.12, 0.2, 'triangle', 0.16))
  },
  pop() {
    if (!enabled) return
    tone(400, 0, 0.06, 'square', 0.06)
  },
  unlock() {
    if (!enabled) return
    ;[392, 494, 587, 784, 988].forEach((n, i) => tone(n, i * 0.09, 0.25, 'sine', 0.14))
  },
}
