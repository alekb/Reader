/**
 * Phonics-aware speech helpers: say a pure sound, a letter name, a word, or
 * sound out a word grapheme by grapheme. Sounds use, in order of preference:
 *   1. a parent recording from IndexedDB,
 *   2. a bundled clip at /audio/sounds/<id>.mp3 (drop files in to use them),
 *   3. the TTS approximation in the GPC table.
 */
import { GPC_BY_ID, LETTER_NAMES } from '../content/gpcs'
import type { DecodableWord } from '../content/words'
import { enqueue, pause, playClip, speak } from './tts'
import { getRecordingUrl } from './recordings'

const bundledMissing = new Set<string>()

async function clipFor(key: string): Promise<string | null> {
  const rec = await getRecordingUrl(key)
  if (rec) return rec
  if (bundledMissing.has(key)) return null
  const url = `${import.meta.env.BASE_URL}audio/sounds/${encodeURIComponent(key)}.mp3`
  try {
    const res = await fetch(url, { method: 'HEAD' })
    const type = res.headers.get('content-type') ?? ''
    if (res.ok && /audio/.test(type)) return url
  } catch {
    /* ignore */
  }
  bundledMissing.add(key)
  return null
}

/** Say the pure sound of a GPC. */
export function speakSound(gpcId: string, opts: { pauseAfter?: number } = {}): Promise<void> {
  const gpc = GPC_BY_ID[gpcId]
  if (!gpc) return Promise.resolve()
  return enqueue(async () => {
    const clip = await clipFor(gpcId)
    if (clip) await playClip(clip)
    else await speakRaw(gpc.speak, gpc.stretchy)
    if (opts.pauseAfter) await new Promise((r) => setTimeout(r, opts.pauseAfter))
  })
}

async function speakRaw(text: string, stretchy: boolean) {
  await new Promise<void>((resolve) => {
    // Use the TTS queue directly but await inside this job: we are already on the chain.
    speakInline(text, stretchy).then(resolve, () => resolve())
  })
}

// A tiny inline speaker that bypasses the shared chain (we are inside a chain job already).
import { Capacitor } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'
async function speakInline(text: string, stretchy: boolean) {
  const rate = stretchy ? 0.7 : 0.8
  if (Capacitor.isNativePlatform()) {
    try {
      await TextToSpeech.speak({ text, lang: 'en-US', rate, pitch: 1.05, category: 'playback' })
    } catch {
      /* ignore */
    }
    return
  }
  if (typeof speechSynthesis === 'undefined') return
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = rate
    u.pitch = 1.05
    const voices = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang))
    const pref = voices.find((v) => /google.*us|natural|neural/i.test(v.name)) ?? voices[0]
    if (pref) u.voice = pref
    let done = false
    const finish = () => {
      if (!done) {
        done = true
        resolve()
      }
    }
    u.onend = finish
    u.onerror = finish
    setTimeout(finish, 1800)
    speechSynthesis.speak(u)
  })
}

/** Say the letter's name ("ess"). */
export function speakLetterName(letter: string): Promise<void> {
  const name = LETTER_NAMES[letter.toLowerCase()] ?? letter
  return speak(name, { rate: 0.85 })
}

/** Say a whole word naturally. */
export function speakWord(word: string, opts: { rate?: number; pauseAfter?: number } = {}): Promise<void> {
  return enqueue(async () => {
    const clip = await clipFor(`word:${word.toLowerCase()}`)
    if (clip) await playClip(clip)
    else await speakInline(word, false)
    if (opts.pauseAfter) await new Promise((r) => setTimeout(r, opts.pauseAfter))
  })
}

/** Sound out a word: each sound with a short gap, then (optionally) the whole word. */
export async function soundOut(word: DecodableWord, opts: { thenWord?: boolean; gap?: number } = {}): Promise<void> {
  const gap = opts.gap ?? 350
  for (const id of word.gpcs) {
    await speakSound(id)
    await pause(gap)
  }
  if (opts.thenWord) {
    await pause(200)
    await speakWord(word.word)
  }
}

/** Mascot talk: a friendly sentence. */
export function say(text: string, opts: { pauseAfter?: number } = {}): Promise<void> {
  return speak(text, { rate: 0.95, pauseAfter: opts.pauseAfter })
}
