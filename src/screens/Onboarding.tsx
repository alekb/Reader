import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Character } from '../components/Character'
import { Screen } from '../components/ui'
import { CHARACTERS } from '../content/characters'
import type { CharacterBase } from '../content/characters'
import { useProgress } from '../store/progressStore'
import { sfx } from '../speech/sfx'
import { say } from '../speech/phonics'
import { warmUp } from '../speech/tts'

export function Onboarding() {
  const nav = useNavigate()
  const setup = useProgress((s) => s.setup)
  const [name, setName] = useState('')
  const [base, setBase] = useState<CharacterBase | null>(null)

  return (
    <Screen className="items-center gap-5 px-5 pb-10 pt-10">
      <div className="text-5xl font-extrabold text-grape">Reader Quest</div>
      <div className="text-center text-lg font-bold text-ink/60">Pick your buddy and let's go!</div>
      <div className="grid w-full grid-cols-3 gap-3">
        {CHARACTERS.map((c) => (
          <button
            key={c.base}
            onClick={() => {
              warmUp()
              sfx.pop()
              setBase(c.base)
              say(`I'm ${c.name}! ${c.tagline}`)
            }}
            className={`tile flex-col gap-1 p-2 ${base === c.base ? 'ring-4 ring-grape bg-sun' : ''}`}
          >
            <Character base={c.base} mood={base === c.base ? 'happy' : 'idle'} size={90} />
            <div className="text-lg font-extrabold">{c.name}</div>
          </button>
        ))}
      </div>
      <label className="w-full">
        <div className="mb-1 text-lg font-bold text-ink/70">Your name</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Type your name"
          maxLength={20}
          className="w-full rounded-2xl border-4 border-grape/30 bg-white px-4 py-3 text-2xl font-bold outline-none focus:border-grape"
        />
      </label>
      <button
        disabled={!base}
        onClick={() => {
          if (!base) return
          setup(name, base)
          sfx.fanfare()
          nav('/', { replace: true })
        }}
        className="btn btn-primary w-full"
      >
        Start the adventure ➜
      </button>
      <div className="text-center text-sm text-ink/50">Parents: open the dashboard from the home screen to sign in and sync progress.</div>
    </Screen>
  )
}
