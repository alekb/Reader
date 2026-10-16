import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Character } from '../components/Character'
import { Screen } from '../components/ui'
import { levelFor } from '../content/parts'
import { childList, useProgress } from '../store/progressStore'
import { say } from '../speech/phonics'
import { sfx } from '../speech/sfx'
import { stopSpeaking, warmUp } from '../speech/tts'

/** Whether someone has picked who is playing since the app started. */
let picked = false
export function markPicked() {
  picked = true
}
/** True on app start when there is more than one child to choose from. */
export function needsPick(childCount: number): boolean {
  return !picked && childCount > 1
}

/** "Who's playing?": each child taps their own buddy. */
export function WhoIsPlaying() {
  const nav = useNavigate()
  const progress = useProgress((s) => s.progress)
  const others = useProgress((s) => s.others)
  const switchChild = useProgress((s) => s.switchChild)
  const children = childList({ progress, others })

  useEffect(() => {
    say("Who's playing?")
    return () => stopSpeaking()
  }, [])

  return (
    <Screen className="items-center gap-5 px-5 pb-10 pt-10">
      <div className="text-4xl font-extrabold text-grape">Who's playing?</div>
      <div className="grid w-full grid-cols-2 gap-3">
        {children.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              warmUp()
              sfx.pop()
              markPicked()
              if (c.id !== progress?.id) switchChild(c.id)
              nav('/', { replace: true })
            }}
            className="tile flex-col gap-1 p-3"
          >
            <Character base={c.character} look={c.look} level={levelFor(c.xp)} size={110} />
            <div className="max-w-full truncate text-2xl font-extrabold">{c.childName}</div>
            <div className="text-sm font-bold text-amber-600">⭐ {c.xp}</div>
          </button>
        ))}
      </div>
    </Screen>
  )
}
