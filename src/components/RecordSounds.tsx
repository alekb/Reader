import { useEffect, useRef, useState } from 'react'
import { GPCS } from '../content/gpcs'
import { deleteRecording, getRecordingUrl, listRecordingKeys, saveRecording } from '../speech/recordings'
import { playClip, stopSpeaking } from '../speech/tts'
import { speakSound } from '../speech/phonics'
import { useSync } from '../store/syncStore'

/**
 * Lets a parent record each sound in their own voice. Recorded clips replace
 * the text-to-speech approximation everywhere in the app, which matters most
 * for "pure" sounds (a short /t/, not "tuh") that TTS engines cannot say well.
 */
export function RecordSounds() {
  const [keys, setKeys] = useState<Set<string>>(new Set())
  const [recording, setRecording] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const uploadRecording = useSync((s) => s.uploadRecording)
  const supported = typeof MediaRecorder !== 'undefined' && typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)

  useEffect(() => {
    listRecordingKeys().then((k) => setKeys(new Set(k)))
  }, [])

  const start = async (key: string) => {
    setError(null)
    stopSpeaking()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m))
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data)
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        if (blob.size > 0) {
          await saveRecording(key, blob)
          setKeys((k) => new Set([...k, key]))
          uploadRecording(key, blob).catch(() => {})
        }
        setRecording(null)
      }
      recRef.current = rec
      rec.start()
      setRecording(key)
      // Auto-stop after 2.5 s: sounds are short.
      setTimeout(() => rec.state === 'recording' && rec.stop(), 2500)
    } catch {
      setError('Microphone not available. Please allow microphone access.')
      setRecording(null)
    }
  }

  const stop = () => recRef.current?.state === 'recording' && recRef.current.stop()

  const play = async (key: string) => {
    stopSpeaking()
    const url = await getRecordingUrl(key)
    if (url) await playClip(url)
    else await speakSound(key)
  }

  if (!supported) return <div className="rounded-2xl bg-white p-4 text-ink/70">Recording is not supported in this browser.</div>

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-sky/20 p-3 text-sm text-ink/80">
        Tap <b>Record</b>, say the <b>pure sound</b> (not the letter name: "mmm" not "em", a short "t" not "tuh"), and it stops by itself after 2.5 seconds.
        Your recordings replace the computer voice for that sound. {keys.size}/{GPCS.length} recorded.
      </div>
      {error && <div className="rounded-2xl bg-coral/20 p-3 text-sm font-bold text-rose-700">{error}</div>}
      <div className="flex flex-col gap-2">
        {GPCS.map((g) => {
          const has = keys.has(g.id)
          const isRec = recording === g.id
          return (
            <div key={g.id} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-sm">
              <div className="font-letter w-14 text-2xl font-bold">{g.grapheme}</div>
              <div className="flex-1 text-sm text-ink/70">
                {g.sound} · {g.emoji} {g.keyword}
              </div>
              <button onClick={() => play(g.id)} className="rounded-xl bg-sky/30 px-3 py-2 text-lg" aria-label="Play">
                ▶
              </button>
              {isRec ? (
                <button onClick={stop} className="animate-pulse rounded-xl bg-rose-500 px-3 py-2 font-bold text-white">
                  ■ Stop
                </button>
              ) : (
                <button onClick={() => start(g.id)} disabled={recording !== null} className={`rounded-xl px-3 py-2 font-bold text-white ${has ? 'bg-leaf' : 'bg-grape'}`}>
                  {has ? '✓ Redo' : '● Record'}
                </button>
              )}
              {has && !isRec && (
                <button
                  onClick={async () => {
                    await deleteRecording(g.id)
                    setKeys((k) => {
                      const n = new Set(k)
                      n.delete(g.id)
                      return n
                    })
                  }}
                  className="rounded-xl px-2 py-2 text-ink/40"
                  aria-label="Delete recording"
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
