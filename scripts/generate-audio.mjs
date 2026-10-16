/**
 * Pre-generates every sound, letter name, word, sentence and mascot phrase with
 * Google Cloud Text-to-Speech, so the app ships studio-quality audio that works
 * offline and needs no key at runtime.
 *
 *   GOOGLE_TTS_API_KEY=... node scripts/generate-audio.mjs [--voice female|male] [--force] [--only sounds|letters|words|phrases] [--analyze]
 *
 * The female set goes to public/audio/, the male set to public/audio/male/;
 * parents choose between them in Parents → Settings → Voice.
 *
 * Pure consonant sounds are the hard part: the engine refuses a lone consonant
 * phoneme, so each consonant is synthesized inside a syllable ("sɑ", "tə") and
 * the vowel is cut off using a per-frame band-energy analysis:
 *   - fricatives (s f sh th z v h) keep the noisy stretch before the vowel and
 *     are looped to ~400 ms so they can be "stretched" like a teacher does,
 *   - nasals / liquids (m n l r ng) keep the murmur before the vowel formants
 *     appear, looped the same way,
 *   - stops (t p k d g b) keep only the burst plus a few ms, so "t" not "tuh",
 *   - vowels are synthesized directly from IPA.
 * Output: public/audio[/male]/{sounds,letters,words,phrases}/*.mp3 + manifest.json.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createServer } from 'vite'

const KEY = process.env.GOOGLE_TTS_API_KEY
if (!KEY) {
  console.error('Set GOOGLE_TTS_API_KEY (see .env.example). Nothing generated.')
  process.exit(1)
}
const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const ANALYZE = args.includes('--analyze')
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
const GENDER = args.includes('--voice') ? args[args.indexOf('--voice') + 1] : 'female'
if (GENDER !== 'female' && GENDER !== 'male') {
  console.error('--voice must be female or male.')
  process.exit(1)
}
// Each set has its own override, so a female TTS_VOICE in .env never ends up in the male folder.
const VOICE = GENDER === 'male' ? process.env.TTS_VOICE_MALE || 'en-US-Neural2-J' : process.env.TTS_VOICE || 'en-US-Neural2-F'
const SR = 24000
const OUT = path.resolve(GENDER === 'male' ? 'public/audio/male' : 'public/audio')
const CONCURRENCY = 6

// ---------------------------------------------------------------- content
const server = await createServer({ server: { middlewareMode: true }, logLevel: 'error', appType: 'custom' })
const gpcsMod = await server.ssrLoadModule('/src/content/gpcs.ts')
const wordsMod = await server.ssrLoadModule('/src/content/words.ts')
const trickyMod = await server.ssrLoadModule('/src/content/trickyWords.ts')
const sentencesMod = await server.ssrLoadModule('/src/content/sentences.ts')
const charsMod = await server.ssrLoadModule('/src/content/characters.ts')
const partsMod = await server.ssrLoadModule('/src/content/parts.ts')
const stickersMod = await server.ssrLoadModule('/src/content/stickers.ts')
const lessonMod = await server.ssrLoadModule('/src/engine/lessonBuilder.ts')
await server.close()

const { GPCS, ALPHABET } = gpcsMod
const { WORDS } = wordsMod
const { TRICKY_WORDS } = trickyMod
const { SENTENCES } = sentencesMod
const { CHARACTERS } = charsMod
const { PARTS, PAINTS, TRICKS, LEVEL_NAMES } = partsMod
const { STICKERS } = stickersMod

/** American English IPA for each GPC, and how to synthesize it. */
const IPA = {
  s: ['s', 'fric'], a: ['æ', 'vowel'], t: ['t', 'stop'], p: ['p', 'stop'], i: ['ɪ', 'vowel'], n: ['n', 'nasal'], m: ['m', 'nasal'], d: ['d', 'stop'],
  g: ['ɡ', 'stop'], o: ['ɑ', 'vowel'], c: ['k', 'stop'], k: ['k', 'stop'], ck: ['k', 'stop'], e: ['ɛ', 'vowel'], u: ['ʌ', 'vowel'], r: ['ɹ', 'nasal'],
  h: ['h', 'fric'], b: ['b', 'stop'], f: ['f', 'fric'], ff: ['f', 'fric'], l: ['l', 'nasal'], ll: ['l', 'nasal'], ss: ['s', 'fric'],
  j: ['dʒ', 'affric'], v: ['v', 'fric'], w: ['w', 'glide'], x: ['ks', 'coda'], y: ['j', 'glide'], z: ['z', 'fric'], zz: ['z', 'fric'], qu: ['kw', 'glide'],
  ch: ['tʃ', 'affric'], sh: ['ʃ', 'fric'], th: ['θ', 'fric'], ng: ['ŋ', 'coda'],
  ai: ['eɪ', 'vowel'], ee: ['iː', 'vowel'], igh: ['aɪ', 'vowel'], oa: ['oʊ', 'vowel'], oo_long: ['uː', 'vowel'], oo_short: ['ʊ', 'vowel'],
  ar: ['ɑɹ', 'vowel'], or: ['ɔɹ', 'vowel'], ur: ['ɝ', 'vowel'], ow: ['aʊ', 'vowel'], oi: ['ɔɪ', 'vowel'], ear: ['ɪɹ', 'vowel'], air: ['ɛɹ', 'vowel'],
  ure: ['jʊɹ', 'vowel'], er: ['ɚ', 'vowel'], a_e: ['eɪ', 'vowel'], i_e: ['aɪ', 'vowel'], o_e: ['oʊ', 'vowel'], u_e: ['juː', 'vowel'], e_e: ['iː', 'vowel'],
  ay: ['eɪ', 'vowel'], ou: ['aʊ', 'vowel'], ie: ['aɪ', 'vowel'], ea: ['iː', 'vowel'], oy: ['ɔɪ', 'vowel'], ir: ['ɝ', 'vowel'], ue: ['juː', 'vowel'],
  aw: ['ɔ', 'vowel'], wh: ['w', 'glide'], ph: ['f', 'fric'], ew: ['juː', 'vowel'],
}

/** Static mascot phrases used in the app (dynamic ones with names fall back to the device voice). */
function collectPhrases() {
  const files = []
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f)
      if (fs.statSync(p).isDirectory()) walk(p)
      else if (/\.(tsx?|ts)$/.test(f)) files.push(p)
    }
  }
  walk(path.resolve('src/components'))
  walk(path.resolve('src/screens'))
  const set = new Set()
  const re = /\b(?:say|speak)\(\s*'([^'`$\\]+)'/g
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8')
    let m
    while ((m = re.exec(src))) set.add(m[1])
  }
  // Phrases in arrays / with helpers that the regex cannot see.
  for (const p of [
    'Robot talk!', 'That one says', 'Say it with me.', 'Your turn!', 'That word is', 'This one says', 'The word is', 'makes', 'Tap the word', 'Which word has the sound',
    'in it. Your turn!', 'This is the letter', 'It says', 'These letters together say', 'Tap each letter', 'Now find it!', 'Not quite. Listen:', 'Try again!', 'Here it is.',
    'Build the word', 'Tap the sounds in order.', 'The sentence says:', 'Now read it like talking:', 'says', 'Great work!', 'You unlocked a new look!',
    "Let's practise what we know today.", "Let's practice what we know today.", 'Tap Play when you\'re ready!', 'Which word has the new sound?',
    'Now trace it with your finger. Say the sound while you trace!', 'Tap the picture that matches the sentence.', 'Tap the picture of the word you read.',
    'Sound it out, then say it fast!', 'Tap each sound, then say the word fast!', 'An alien word! Sound it out, then say it fast.',
    'Read the sentence. Tap a word if you need help.', 'Read this one!', 'This is a heart word. You learn it by heart.',
  ]) set.add(p)
  for (const c of CHARACTERS) {
    set.add(`I'm ${c.name}! ${c.tagline}`)
    set.add(`${c.name}!`)
  }
  for (const p of PARTS) set.add(p.name)
  for (const p of PAINTS) set.add(p.name)
  for (const t of TRICKS) set.add(t.line)
  for (const st of STICKERS) set.add(`A ${st.name} sticker!`)
  for (let i = 0; i < LEVEL_NAMES.length; i++) set.add(`Level ${i + 1}, ${LEVEL_NAMES[i]}!`)
  for (const p of ['Level up!', 'You unlocked something new!', 'A surprise egg! Tap it to hatch it.']) set.add(p)
  for (const g of GPCS) set.add(`like ${g.keyword}.`)
  for (const g of GPCS) set.add(`like ${g.keyword}`)
  for (const t of TRICKY_WORDS) set.add(t.example)
  for (const s of SENTENCES) set.add(s.text)
  return [...set].filter((p) => p.trim().length > 0)
}

// ---------------------------------------------------------------- synthesis
async function synth(input, rate = 0.9) {
  const body = JSON.stringify({
    input,
    voice: { languageCode: 'en-US', name: VOICE },
    audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: SR, speakingRate: rate },
  })
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    if (res.ok) {
      const json = await res.json()
      const wav = Buffer.from(json.audioContent, 'base64')
      return pcmFromWav(wav)
    }
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
      continue
    }
    throw new Error(`TTS ${res.status}: ${await res.text()}`)
  }
  throw new Error('TTS: too many retries')
}

function pcmFromWav(buf) {
  // Google returns a 44-byte RIFF header.
  const data = buf.subarray(44)
  const out = new Float32Array(data.length >> 1)
  for (let i = 0; i < out.length; i++) out[i] = data.readInt16LE(i * 2) / 32768
  return out
}

function wavFromPcm(pcm) {
  const buf = Buffer.alloc(44 + pcm.length * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + pcm.length * 2, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(pcm.length * 2, 40)
  for (let i = 0; i < pcm.length; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm[i] * 32767))), 44 + i * 2)
  return buf
}

function writeMp3(pcm, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'wav', '-i', 'pipe:0', '-codec:a', 'libmp3lame', '-b:a', '64k', file], { input: wavFromPcm(pcm) })
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${file}: ${r.stderr}`)
}

// ---------------------------------------------------------------- analysis
const FRAME = SR / 100 // 10 ms

/** Goertzel band energy for one frame between f1 and f2 Hz (sampled every 50 Hz). */
function bandEnergy(frame, f1, f2) {
  let e = 0
  for (let f = f1; f <= f2; f += 50) {
    const k = (2 * Math.PI * f) / SR
    const coeff = 2 * Math.cos(k)
    let s0 = 0
    let s1 = 0
    let s2 = 0
    for (let i = 0; i < frame.length; i++) {
      s0 = frame[i] + coeff * s1 - s2
      s2 = s1
      s1 = s0
    }
    e += s1 * s1 + s2 * s2 - coeff * s1 * s2
  }
  return e / frame.length
}

function analyze(pcm) {
  const frames = []
  for (let i = 0; i + FRAME <= pcm.length; i += FRAME) {
    const fr = pcm.subarray(i, i + FRAME)
    let rms = 0
    let zc = 0
    for (let k = 0; k < fr.length; k++) {
      rms += fr[k] * fr[k]
      if (k && fr[k - 1] < 0 !== fr[k] < 0) zc++
    }
    rms = Math.sqrt(rms / fr.length)
    frames.push({ rms, zcr: (zc / fr.length) * SR / 2, low: bandEnergy(fr, 80, 400), mid: bandEnergy(fr, 500, 2500), high: bandEnergy(fr, 3000, 9000) })
  }
  return frames
}

function picture(frames) {
  const peak = Math.max(...frames.map((f) => f.rms)) || 1
  return frames
    .map((f) => {
      if (f.rms < peak * 0.03) return '.'
      if (f.zcr > 2500) return 'S'
      if (f.zcr > 1200) return 's'
      if (f.rms < peak * 0.35) return 'v'
      return 'V'
    })
    .join('')
}

function firstIndex(arr, pred, from = 0) {
  for (let i = from; i < arr.length; i++) if (pred(arr[i], i)) return i
  return -1
}

function slice(pcm, fromFrame, toFrame) {
  return pcm.subarray(Math.max(0, fromFrame * FRAME), Math.min(pcm.length, toFrame * FRAME))
}

function fade(pcm, inMs, outMs) {
  const out = Float32Array.from(pcm)
  const nIn = Math.min(out.length, Math.round((SR * inMs) / 1000))
  const nOut = Math.min(out.length, Math.round((SR * outMs) / 1000))
  for (let i = 0; i < nIn; i++) out[i] *= i / nIn
  for (let i = 0; i < nOut; i++) out[out.length - 1 - i] *= i / nOut
  return out
}

function normalize(pcm, peakTarget = 0.7) {
  let peak = 0
  for (const x of pcm) peak = Math.max(peak, Math.abs(x))
  if (!peak) return pcm
  const g = peakTarget / peak
  return pcm.map((x) => x * g)
}

/** Extend a short sustained sound to `targetMs` by looping its middle with crossfades. */
function loopTo(pcm, targetMs) {
  const target = Math.round((SR * targetMs) / 1000)
  if (pcm.length >= target || pcm.length < SR * 0.04) return pcm
  const xf = Math.round(SR * 0.015)
  const core = pcm.subarray(Math.round(pcm.length * 0.2), Math.round(pcm.length * 0.8))
  if (core.length <= xf * 2) return pcm
  const pieces = [pcm.subarray(0, Math.round(pcm.length * 0.8))]
  let len = pieces[0].length
  while (len < target) {
    pieces.push(core)
    len += core.length - xf
  }
  pieces.push(pcm.subarray(Math.round(pcm.length * 0.8)))
  // Concatenate with linear crossfades.
  let out = Float32Array.from(pieces[0])
  for (let p = 1; p < pieces.length; p++) {
    const next = pieces[p]
    const merged = new Float32Array(out.length + next.length - xf)
    merged.set(out.subarray(0, out.length - xf))
    for (let i = 0; i < xf; i++) {
      const a = out[out.length - xf + i]
      const b = next[i]
      merged[out.length - xf + i] = a * (1 - i / xf) + b * (i / xf)
    }
    merged.set(next.subarray(xf), out.length)
    out = merged
  }
  return out
}

function silence(ms) {
  return new Float32Array(Math.round((SR * ms) / 1000))
}

function concat(...parts) {
  const out = new Float32Array(parts.reduce((a, p) => a + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

/** Trim leading/trailing silence. */
function trimSilence(pcm, thresh = 0.02) {
  const fr = analyze(pcm)
  const peak = Math.max(...fr.map((f) => f.rms)) || 1
  const a = firstIndex(fr, (f) => f.rms > peak * thresh)
  let b = fr.length - 1
  while (b > a && fr[b].rms < peak * thresh) b--
  return slice(pcm, Math.max(0, a - 1), b + 2)
}

// ---------------------------------------------------------------- consonant extraction
async function makeSound(gpc) {
  const [ipa, kind] = IPA[gpc.id]
  if (!ipa) throw new Error(`No IPA for ${gpc.id}`)
  const ph = (p) => ({ ssml: `<speak><phoneme alphabet="ipa" ph="${p}">x</phoneme></speak>` })

  if (kind === 'vowel') {
    const pcm = await synth(ph(ipa), 0.75)
    return finish(trimSilence(pcm), 15, 40)
  }

  if (kind === 'coda') {
    // ŋ and ks live at the end of a syllable: synthesize "ɑŋ" / "ɛks" and keep the tail after the vowel.
    const syl = ipa === 'ŋ' ? 'ɑŋ' : 'ɛks'
    const pcm = await synth(ph(syl), 0.7)
    const fr = analyze(pcm)
    const peakMid = Math.max(...fr.map((f) => f.mid))
    // vowel = frames with strong mid-band energy; coda starts when mid drops below 25% of peak after the vowel peak.
    const vPeak = fr.findIndex((f) => f.mid === peakMid)
    const peakRms = Math.max(...fr.map((f) => f.rms))
    // ŋ: where the vowel formants fade into the murmur. ks: the silent closure before the burst.
    let cut = ipa === 'ŋ' ? firstIndex(fr, (f) => f.mid < peakMid * 0.12, vPeak) : firstIndex(fr, (f) => f.rms < peakRms * 0.03, vPeak)
    if (cut < 0) cut = vPeak + 10
    const tail = trimSilence(slice(pcm, cut + 1, fr.length), 0.05)
    return finish(ipa === 'ŋ' ? loopTo(tail, 450) : tail, 15, 40)
  }

  if (kind === 'stop' || kind === 'affric' || kind === 'glide') {
    const vowel = kind === 'glide' && ipa === 'w' ? 'ʌ' : 'ə'
    const pcm = await synth(ph(ipa + vowel), 0.8)
    const fr = analyze(pcm)
    const peak = Math.max(...fr.map((f) => f.rms))
    const onset = firstIndex(fr, (f) => f.rms > peak * 0.05)
    const keepMs = kind === 'stop' ? (['t', 'p', 'k'].includes(ipa) ? 75 : 85) : kind === 'affric' ? 190 : ipa === 'kw' ? 170 : 140
    // For affricates keep the whole noisy part even if longer.
    let end = onset + Math.round(keepMs / 10)
    if (kind === 'affric') {
      const noisyEnd = firstIndex(fr, (f) => f.zcr < 2000 && f.rms > peak * 0.3, onset + 3)
      if (noisyEnd > 0) end = Math.min(end, noisyEnd + 1)
    }
    return finish(slice(pcm, Math.max(0, onset - 1), end), 5, kind === 'stop' ? 35 : 50)
  }

  // Fricatives and nasals/liquids: synthesize C + ɑ and cut at the vowel onset.
  const pcm = await synth(ph(ipa + 'ɑ'), 0.7)
  const fr = analyze(pcm)
  const peakMid = Math.max(...fr.map((f) => f.mid))
  const peakRms = Math.max(...fr.map((f) => f.rms))
  // Vowel onset = first frame where the vowel-formant band jumps to > 35% of its peak.
  let onset = firstIndex(fr, (f) => f.mid > peakMid * 0.35)
  if (kind === 'nasal') {
    // The murmur is quiet and low; the vowel is loud with mid energy. Use the ratio to find the change.
    const ratios = fr.map((f) => (f.low > 0 ? f.mid / f.low : 0))
    const voiced = firstIndex(fr, (f) => f.rms > peakRms * 0.08)
    const base = ratios.slice(voiced, voiced + 5).reduce((a, b) => a + b, 0) / 5 || 1e-6
    const jump = firstIndex(ratios, (r, i) => i > voiced + 3 && r > base * 3)
    if (jump > 0) onset = jump
    const start = Math.max(0, voiced - 1)
    let part = slice(pcm, start, Math.max(start + 6, onset - 1))
    if (part.length < SR * 0.06) part = slice(pcm, start, start + 12) // fall back to the first 120 ms
    return finish(loopTo(part, 450), 15, 40)
  }
  // Fricative: everything audible before the vowel onset.
  const audible = firstIndex(fr, (f) => f.rms > peakRms * 0.015 || f.high > 0)
  const start = Math.max(0, audible)
  let part = slice(pcm, start, Math.max(start + 5, onset - 2))
  if (part.length < SR * 0.05) part = slice(pcm, start, start + 10)
  const voicedFric = ['z', 'v'].includes(ipa)
  return finish(loopTo(part, voicedFric ? 400 : 450), 15, 40)
}

function finish(pcm, fadeIn, fadeOut) {
  return concat(silence(30), fade(normalize(pcm), fadeIn, fadeOut), silence(60))
}

// ---------------------------------------------------------------- jobs
const manifest = { voice: VOICE, sounds: {}, letters: {}, words: {}, phrases: {} }
const manifestFile = path.join(OUT, 'manifest.json')
const existing = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : null
if (existing?.voice && existing.voice !== VOICE && !FORCE) {
  console.error(`${path.relative('.', OUT)} was generated with ${existing.voice}, not ${VOICE}. Add --force to regenerate it all, so voices don't mix.`)
  process.exit(1)
}

function hash(s) {
  return crypto.createHash('sha1').update(s).digest('hex').slice(0, 16)
}

const jobs = []
const want = (kind) => !ONLY || ONLY === kind

if (want('sounds')) {
  for (const g of GPCS) {
    const file = `sounds/${g.id}.mp3`
    manifest.sounds[g.id] = file
    jobs.push({ kind: 'sounds', key: g.id, file, run: async () => makeSound(g) })
  }
}
if (want('letters')) {
  for (const l of ALPHABET) {
    const file = `letters/${l}.mp3`
    manifest.letters[l] = file
    jobs.push({ kind: 'letters', key: l, file, run: async () => finish(trimSilence(await synth({ ssml: `<speak><say-as interpret-as="characters">${l}</say-as></speak>` }, 0.85)), 5, 30) })
  }
}
if (want('words')) {
  const words = new Set(WORDS.map((w) => w.word))
  for (const g of GPCS) words.add(g.keyword)
  for (const t of TRICKY_WORDS) words.add(t.word.toLowerCase())
  for (const s of SENTENCES) for (const w of lessonMod.sentenceWords(s.text)) words.add(w)
  for (const w of words) {
    const safe = w.replace(/[^a-z']/g, '')
    if (!safe) continue
    const file = `words/${safe}.mp3`
    manifest.words[w] = file
    jobs.push({ kind: 'words', key: w, file, run: async () => finish(trimSilence(await synth({ text: w }, 0.85)), 5, 30) })
  }
}
if (want('phrases')) {
  for (const p of collectPhrases()) {
    const file = `phrases/${hash(p)}.mp3`
    manifest.phrases[p] = file
    jobs.push({ kind: 'phrases', key: p, file, run: async () => finish(trimSilence(await synth({ text: p }, 0.95)), 5, 30) })
  }
}

// Keep entries from a previous run for kinds we are not regenerating.
if (existing) {
  for (const k of ['sounds', 'letters', 'words', 'phrases']) if (!want(k)) manifest[k] = existing[k] ?? {}
}

let done = 0
let skipped = 0
let failed = 0
const queue = [...jobs]
async function worker() {
  while (queue.length) {
    const job = queue.shift()
    const file = path.join(OUT, job.file)
    if (!FORCE && fs.existsSync(file)) {
      skipped++
      continue
    }
    try {
      const pcm = await job.run()
      writeMp3(pcm, file)
      done++
      if (ANALYZE && job.kind === 'sounds') {
        const fr = analyze(pcm)
        const ratio = fr.map((f) => (f.rms < 0.01 ? '.' : Math.min(9, Math.round(Math.log10(1 + f.mid / Math.max(f.low, 1e-9)) * 3)))).join('')
        console.log(`${job.key.padEnd(9)} ${(pcm.length / SR).toFixed(2)}s ${picture(fr)}\n          mid/low  ${ratio}`)
      }
      if (done % 50 === 0) console.log(`  ${done} generated, ${skipped} skipped, ${queue.length} left`)
    } catch (e) {
      failed++
      console.error(`FAILED ${job.kind}/${job.key}: ${e.message}`)
      // Leave it out of the manifest (the app then falls back) unless an older clip is still there.
      if (!fs.existsSync(file)) delete manifest[job.kind][job.key]
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))
// Version each URL by content: installed apps cache clips for a year, so a regenerated clip needs a new URL.
for (const k of ['sounds', 'letters', 'words', 'phrases']) {
  for (const [key, f] of Object.entries(manifest[k])) {
    const file = path.join(OUT, f.split('?')[0])
    if (fs.existsSync(file)) manifest[k][key] = `${f.split('?')[0]}?v=${hash(fs.readFileSync(file)).slice(0, 8)}`
  }
}
fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1))
// After a full run, delete clips that the manifest no longer references (removed words, old phrases).
if (!ONLY) {
  const referenced = new Set(['sounds', 'letters', 'words', 'phrases'].flatMap((k) => Object.values(manifest[k]).map((f) => f.split('?')[0])))
  let pruned = 0
  for (const dir of ['sounds', 'letters', 'words', 'phrases']) {
    const abs = path.join(OUT, dir)
    if (!fs.existsSync(abs)) continue
    for (const f of fs.readdirSync(abs)) {
      if (!referenced.has(`${dir}/${f}`)) {
        fs.rmSync(path.join(abs, f))
        pruned++
      }
    }
  }
  if (pruned) console.log(`Removed ${pruned} unreferenced clips.`)
}
console.log(`Done: ${done} generated, ${skipped} already existed, ${failed} failed. Manifest: ${manifestFile}`)
process.exit(failed ? 1 : 0)
