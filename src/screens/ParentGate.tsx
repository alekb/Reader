import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Screen, TopBar } from '../components/ui'
import { stopSpeaking } from '../speech/tts'

const KEY = 'reader-quest-parent-until'
const LOCK_KEY = 'reader-quest-parent-lock'
const TRIES_KEY = 'reader-quest-parent-tries'
const UNLOCK_MS = 10 * 60 * 1000
const MAX_TRIES = 3
const COOLDOWN_MS = 60 * 1000

function readNumber(key: string): number {
  try {
    return Number(sessionStorage.getItem(key) ?? 0)
  } catch {
    return 0
  }
}
function writeNumber(key: string, value: number) {
  try {
    if (value) sessionStorage.setItem(key, String(value))
    else sessionStorage.removeItem(key)
  } catch {
    /* storage unavailable: the gate simply stays locked */
  }
}

export function isParentUnlocked(): boolean {
  return readNumber(KEY) > Date.now()
}

/** Re-lock the parent area (called when leaving the dashboard). */
export function lockParentArea() {
  writeNumber(KEY, 0)
}

/** A two-step multiplication most 8-year-olds cannot do: (12..19) x (6..9). */
function newProblem(): [number, number] {
  return [12 + Math.floor(Math.random() * 8), 6 + Math.floor(Math.random() * 4)]
}

/** Grown-up check before the parent dashboard. New problem after each miss; cooldown after 3 misses. */
export function ParentGate() {
  const nav = useNavigate()
  const [[a, b], setProblem] = useState<[number, number]>(newProblem)
  const [answer, setAnswer] = useState('')
  // Stored outside the component so backing out and re-entering does not reset the count.
  const [tries, setTriesState] = useState(() => readNumber(TRIES_KEY))
  const setTries = (n: number) => {
    writeNumber(TRIES_KEY, n)
    setTriesState(n)
  }
  const [lockedUntil, setLockedUntil] = useState(() => readNumber(LOCK_KEY))
  const [now, setNow] = useState(() => Date.now())
  const locked = lockedUntil > now

  useEffect(() => {
    stopSpeaking()
  }, [])
  useEffect(() => {
    if (!locked) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [locked])

  const check = () => {
    if (locked) return
    if (Number(answer) === a * b) {
      writeNumber(KEY, Date.now() + UNLOCK_MS)
      writeNumber(LOCK_KEY, 0)
      setTries(0)
      nav('/parent/dashboard', { replace: true })
      return
    }
    const next = tries + 1
    setAnswer('')
    setProblem(newProblem())
    if (next >= MAX_TRIES) {
      const until = Date.now() + COOLDOWN_MS
      writeNumber(LOCK_KEY, until)
      setLockedUntil(until)
      setNow(Date.now())
      setTries(0)
    } else setTries(next)
  }

  return (
    <Screen className="gap-4 px-5 pb-10">
      <TopBar title="Parents only" onBack={() => nav('/')} />
      <div className="rounded-3xl bg-white p-5 shadow">
        {locked ? (
          <div className="text-center">
            <div className="text-5xl">⏳</div>
            <div className="mt-2 text-lg font-bold text-ink/70">Too many tries. Please wait {Math.ceil((lockedUntil - now) / 1000)} seconds.</div>
          </div>
        ) : (
          <>
            <label htmlFor="parent-answer" className="text-lg font-bold text-ink/70">
              To continue, solve:
            </label>
            <div className="my-3 text-5xl font-extrabold" aria-hidden="true">
              {a} × {b} = ?
            </div>
            <input
              id="parent-answer"
              aria-label={`What is ${a} times ${b}?`}
              inputMode="numeric"
              value={answer}
              onChange={(e) => setAnswer(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && check()}
              className="w-full rounded-2xl border-4 border-grape/30 px-4 py-3 text-3xl font-bold outline-none focus:border-grape"
              autoFocus
            />
            {tries > 0 && <div className="mt-2 font-bold text-coral">Not quite. Here's a new one ({MAX_TRIES - tries} tries left).</div>}
            <button onClick={check} className="btn btn-primary mt-4 w-full">
              Enter
            </button>
          </>
        )}
      </div>
    </Screen>
  )
}
