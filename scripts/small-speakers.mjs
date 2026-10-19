/**
 * Makes humming sounds audible on tablet and phone speakers.
 *
 * A held /m/ or /n/ cut from a TTS syllable is almost a pure tone at the voice's
 * pitch (120-260 Hz). Headphones play that, but small speakers reproduce little
 * below ~500 Hz, so on a tablet those clips come out nearly silent. We add the
 * missing upper harmonics (2f, 3f, 4f ...), derived from the clip itself: small
 * speakers can play them, and the ear still hears the original pitch.
 */

/** RBJ biquad, Q = 0.707. */
function biquad(pcm, sr, type, f0) {
  const w = (2 * Math.PI * f0) / sr
  const cos = Math.cos(w)
  const alpha = Math.sin(w) / (2 * Math.SQRT1_2)
  const b0 = type === 'lowpass' ? (1 - cos) / 2 : (1 + cos) / 2
  const b1 = type === 'lowpass' ? 1 - cos : -(1 + cos)
  const b2 = b0
  const a0 = 1 + alpha
  const a1 = -2 * cos
  const a2 = 1 - alpha
  const out = new Float32Array(pcm.length)
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < pcm.length; i++) {
    const x = pcm[i]
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    out[i] = y
  }
  return out
}
const highpass = (pcm, sr, f) => biquad(biquad(pcm, sr, 'highpass', f), sr, 'highpass', f)
const lowpass = (pcm, sr, f) => biquad(biquad(pcm, sr, 'lowpass', f), sr, 'lowpass', f)

function peakOf(pcm) {
  let p = 0
  for (const x of pcm) p = Math.max(p, Math.abs(x))
  return p
}

/** Loudest 100 ms (RMS, dBFS) of what a small speaker plays: the clip above 500 Hz. */
export function speakerLevel(pcm, sr) {
  const hp = highpass(pcm, sr, 500)
  const win = Math.round(sr * 0.1)
  const hop = Math.round(sr * 0.01)
  let best = 0
  for (let s = 0; s + win <= Math.max(hp.length, win); s += hop) {
    let e = 0
    for (let i = s; i < Math.min(hp.length, s + win); i++) e += hp[i] * hp[i]
    best = Math.max(best, Math.sqrt(e / win))
  }
  return 20 * Math.log10(best + 1e-9)
}

/** Harmonics of the voiced hum (below 450 Hz), kept to the 450-4000 Hz band small speakers play. */
function harmonics(pcm, sr) {
  const hum = lowpass(pcm, sr, 450)
  const peak = peakOf(hum) || 1
  // Asymmetric soft saturation gives both even and odd harmonics, falling off smoothly,
  // so the ear still hears the original pitch (a hum is periodic, so no other tones appear).
  const bias = 0.4
  const shaped = hum.map((x) => Math.tanh((2.5 * x) / peak + bias) - Math.tanh(bias))
  return lowpass(highpass(shaped, sr, 450), sr, 4000)
}

/**
 * Raise a clip's small-speaker level to `target` dBFS by mixing in harmonics, keeping
 * its peak where it was. Clips already at least `threshold` dBFS are returned unchanged.
 */
export function boostForSmallSpeakers(pcm, sr, { threshold = -22, target = -18 } = {}) {
  if (speakerLevel(pcm, sr) >= threshold) return pcm
  const peak = peakOf(pcm)
  const h = harmonics(pcm, sr)
  const mix = (amount) => {
    const out = pcm.map((x, i) => x + amount * h[i])
    const g = peak / (peakOf(out) || 1)
    return out.map((x) => x * g)
  }
  // The level rises with the amount (up to a point): binary-search the amount that hits the target.
  let lo = 0
  let hi = 4
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    if (speakerLevel(mix(mid), sr) < target) lo = mid
    else hi = mid
  }
  return mix(hi)
}
