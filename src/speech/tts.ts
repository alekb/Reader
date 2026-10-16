/**
 * Text-to-speech. On Android (Capacitor) we use the native TTS plugin; in the
 * browser we use the Web Speech API. All speech goes through one queue so the
 * mascot never talks over itself, and `stopSpeaking()` cancels everything.
 */
import { Capacitor } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'
import type { VoiceGender } from '../engine/types'
import { voiceGenderOf } from './voiceNames'

const isNative = Capacitor.isNativePlatform()

export interface SpeakOptions {
  rate?: number
  pitch?: number
  /** Pause after the utterance, in ms. */
  pauseAfter?: number
}

let baseRate = 0.9
export function setVoiceRate(rate: number) {
  baseRate = rate
}

export type { VoiceGender }
let gender: VoiceGender = 'female'
/** Which voice the parent picked. Bundled clips and the device voice both follow it. */
export function setVoiceGender(g: VoiceGender) {
  if (g === gender) return
  gender = g
  preferredVoice = pickVoice()
  nativeVoice = null
}
export function getVoiceGender(): VoiceGender {
  return gender
}

/** Optional lookup of a pre-recorded clip for an exact phrase (set by phonics.ts). */
let phraseResolver: ((text: string) => Promise<string | null>) | null = null
export function setPhraseResolver(fn: (text: string) => Promise<string | null>) {
  phraseResolver = fn
}

let generation = 0
let chain: Promise<void> = Promise.resolve()
let preferredVoice: SpeechSynthesisVoice | null = null
let voicesLoaded = false

function genderScore(name: string): number {
  const g = voiceGenderOf(name)
  return g === gender ? 8 : g ? -8 : 0
}

/** Index of the best native (Android) voice for the chosen gender, or undefined for the system default. */
let nativeVoice: Promise<number | undefined> | null = null
function nativeVoiceIndex(): Promise<number | undefined> {
  if (!nativeVoice) {
    const p: Promise<number | undefined> = TextToSpeech.getSupportedVoices()
      .then(({ voices }) => {
        let best: number | undefined
        let bestScore = 0
        voices.forEach((v, i) => {
          if (!/^en[-_]/i.test(v.lang)) return
          let sc = genderScore(`${v.name} ${v.voiceURI}`)
          if (sc <= 0) return
          if (/en[-_]US/i.test(v.lang)) sc += 3
          if (v.localService) sc += 1
          if (sc > bestScore) {
            best = i
            bestScore = sc
          }
        })
        return best
      })
      .catch(() => undefined)
    nativeVoice = p
    // The engine may still be starting (empty list or an error): ask again next time.
    p.then((i) => {
      if (i === undefined && nativeVoice === p) nativeVoice = null
    })
  }
  return nativeVoice
}

/** The browser voice for the chosen gender. */
function webVoice(): SpeechSynthesisVoice | null {
  if (!voicesLoaded) preferredVoice = pickVoice()
  return preferredVoice
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null
  const voices = speechSynthesis.getVoices()
  if (!voices.length) return null
  voicesLoaded = true
  const en = voices.filter((v) => /^en[-_]/i.test(v.lang))
  const score = (v: SpeechSynthesisVoice) => {
    let s = 0
    if (/en[-_]US/i.test(v.lang)) s += 3
    if (/google/i.test(v.name)) s += 4
    if (/natural|neural|premium|enhanced/i.test(v.name)) s += 5
    s += genderScore(v.name)
    if (v.localService) s += 1
    return s
  }
  return en.sort((a, b) => score(b) - score(a))[0] ?? voices[0]
}

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.addEventListener?.('voiceschanged', () => {
    preferredVoice = pickVoice()
  })
  preferredVoice = pickVoice()
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function speakWeb(text: string, opts: SpeakOptions, gen: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof speechSynthesis === 'undefined') return resolve()
    const voice = webVoice()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = opts.rate ?? baseRate
    u.pitch = opts.pitch ?? 1.05
    if (voice) u.voice = voice
    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve()
    }
    u.onend = finish
    u.onerror = finish
    // Safety: some engines never fire onend.
    setTimeout(finish, Math.max(1500, text.length * 120 + 800))
    if (gen !== generation) return resolve()
    speechSynthesis.speak(u)
  })
}

async function speakNative(text: string, opts: SpeakOptions, gen: number): Promise<void> {
  if (gen !== generation) return
  try {
    const voice = await nativeVoiceIndex()
    if (gen !== generation) return
    await TextToSpeech.speak({ text, lang: 'en-US', rate: opts.rate ?? baseRate, pitch: opts.pitch ?? 1.05, voice, category: 'playback' })
  } catch {
    /* ignore */
  }
}

/**
 * Speak with the device voice right now, not queued. For jobs already running
 * on the chain (phonics.ts); `stopSpeaking()` still cancels it.
 */
export function speakNow(text: string, opts: SpeakOptions = {}): Promise<void> {
  const gen = generation
  return isNative ? speakNative(text, opts, gen) : speakWeb(text, opts, gen)
}

/** Speak text, queued after anything already speaking. */
export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  const gen = generation
  const run = async () => {
    if (gen !== generation) return
    const clip = phraseResolver ? await phraseResolver(text).catch(() => null) : null
    if (gen !== generation) return
    if (clip) await playClip(clip)
    else if (isNative) await speakNative(text, opts, gen)
    else await speakWeb(text, opts, gen)
    if (opts.pauseAfter && gen === generation) await sleep(opts.pauseAfter)
  }
  chain = chain.then(run, run)
  return chain
}

/** Cancel everything queued or playing. */
export function stopSpeaking() {
  generation++
  chain = Promise.resolve()
  if (isNative) TextToSpeech.stop().catch(() => {})
  else if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
  stopAudio()
}

/** Queue a pause. */
export function pause(ms: number): Promise<void> {
  const gen = generation
  const run = async () => {
    if (gen === generation) await sleep(ms)
  }
  chain = chain.then(run, run)
  return chain
}

/** Queue an arbitrary async job on the speech chain (used for audio clips). */
export function enqueue(job: () => Promise<void>): Promise<void> {
  const gen = generation
  const run = async () => {
    if (gen === generation) await job()
  }
  chain = chain.then(run, run)
  return chain
}

export function currentGeneration() {
  return generation
}

// ---- Audio clip playback (recorded sounds) ----
let currentAudio: HTMLAudioElement | null = null

export function playClip(url: string): Promise<void> {
  return new Promise((resolve) => {
    const a = new Audio(url)
    currentAudio = a
    let done = false
    const finish = () => {
      if (done) return
      done = true
      if (currentAudio === a) currentAudio = null
      resolve()
    }
    a.onended = finish
    a.onerror = finish
    a.play().catch(finish)
    setTimeout(finish, 4000)
  })
}

function stopAudio() {
  if (currentAudio) {
    try {
      currentAudio.pause()
    } catch {
      /* ignore */
    }
    currentAudio = null
  }
}

/** Warm up the speech engine on first user gesture (required by browsers). */
export function warmUp() {
  if (isNative) return
  if (typeof speechSynthesis === 'undefined') return
  preferredVoice = pickVoice()
  const u = new SpeechSynthesisUtterance(' ')
  u.volume = 0
  speechSynthesis.speak(u)
}
