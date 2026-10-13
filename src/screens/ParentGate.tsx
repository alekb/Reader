import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Screen, TopBar } from '../components/ui'
import { stopSpeaking } from '../speech/tts'

const KEY = 'reader-quest-parent-until'

export function isParentUnlocked(): boolean {
  try {
    return Number(sessionStorage.getItem(KEY) ?? 0) > Date.now()
  } catch {
    return false
  }
}

/** A simple grown-up check (multiplication) before the parent dashboard. */
export function ParentGate() {
  const nav = useNavigate()
  const [a, b] = useMemo(() => [6 + Math.floor(Math.random() * 4), 6 + Math.floor(Math.random() * 4)], [])
  const [answer, setAnswer] = useState('')
  const [wrong, setWrong] = useState(false)
  stopSpeaking()

  const check = () => {
    if (Number(answer) === a * b) {
      try {
        sessionStorage.setItem(KEY, String(Date.now() + 15 * 60 * 1000))
      } catch {
        /* ignore */
      }
      nav('/parent/dashboard', { replace: true })
    } else {
      setWrong(true)
      setAnswer('')
    }
  }

  return (
    <Screen className="gap-4 px-5 pb-10">
      <TopBar title="Parents only" onBack={() => nav('/')} />
      <div className="rounded-3xl bg-white p-5 shadow">
        <div className="text-lg font-bold text-ink/70">To continue, solve:</div>
        <div className="my-3 text-5xl font-extrabold">
          {a} × {b} = ?
        </div>
        <input
          inputMode="numeric"
          value={answer}
          onChange={(e) => setAnswer(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && check()}
          className="w-full rounded-2xl border-4 border-grape/30 px-4 py-3 text-3xl font-bold outline-none focus:border-grape"
          autoFocus
        />
        {wrong && <div className="mt-2 font-bold text-coral">Not quite, try again.</div>}
        <button onClick={check} className="btn btn-primary mt-4 w-full">
          Enter
        </button>
      </div>
    </Screen>
  )
}
