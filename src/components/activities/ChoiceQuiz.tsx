import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { sfx } from '../../speech/sfx'
import { stopSpeaking } from '../../speech/tts'

export interface ChoiceOption {
  id: string
  label: ReactNode
  /** Extra classes for the tile. */
  className?: string
}

interface Props {
  /** Speak the question. Re-run when the child taps the speaker button. */
  prompt: () => Promise<void>
  options: ChoiceOption[]
  correctId: string
  /**
   * Called once with the first attempt. The quiz then runs the model → lead →
   * test script on a wrong answer before calling onDone.
   */
  onAnswer: (correct: boolean, ms: number) => void
  onDone: () => void
  /** Speech for the correction: "That one says /sh/. Say it with me: /sh/." */
  correction: () => Promise<void>
  /** Mascot instruction shown above the options. */
  instruction?: string
  columns?: 1 | 2 | 3 | 4
  /** Tile size. */
  big?: boolean
  /** Extra content above the options (e.g. the word being read). */
  children?: ReactNode
  /** Key to reset internal state when the question changes. */
  questionKey: string
}

export function ChoiceQuiz({ prompt, options, correctId, onAnswer, onDone, correction, instruction, columns = 2, big = true, children, questionKey }: Props) {
  const [phase, setPhase] = useState<'asking' | 'correct' | 'wrong' | 'retry' | 'done'>('asking')
  const [picked, setPicked] = useState<string | null>(null)
  const startRef = useRef<number>(Date.now())
  const answeredRef = useRef(false)
  const doneRef = useRef(false)

  useEffect(() => {
    setPhase('asking')
    setPicked(null)
    answeredRef.current = false
    doneRef.current = false
    startRef.current = Date.now()
    let alive = true
    stopSpeaking()
    const t = setTimeout(() => {
      prompt().then(() => {
        if (alive) startRef.current = Date.now()
      })
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionKey])

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    setPhase('done')
    setTimeout(onDone, 650)
  }

  const tap = (id: string) => {
    if (phase === 'done' || phase === 'correct') return
    const ms = Date.now() - startRef.current
    if (phase === 'retry') {
      if (id === correctId) {
        sfx.correct()
        setPicked(id)
        setPhase('correct')
        finish()
      } else {
        sfx.pop()
      }
      return
    }
    if (phase === 'wrong') return
    setPicked(id)
    if (id === correctId) {
      sfx.correct()
      setPhase('correct')
      if (!answeredRef.current) {
        answeredRef.current = true
        onAnswer(true, ms)
      }
      finish()
    } else {
      sfx.wrong()
      setPhase('wrong')
      if (!answeredRef.current) {
        answeredRef.current = true
        onAnswer(false, ms)
      }
      stopSpeaking()
      correction().then(() => setPhase('retry'))
    }
  }

  const cols = columns === 4 ? 'grid-cols-4' : columns === 3 ? 'grid-cols-3' : columns === 1 ? 'grid-cols-1' : 'grid-cols-2'
  return (
    <div className="flex flex-1 flex-col gap-4 px-4">
      {instruction && <div className="text-center text-xl font-extrabold text-ink/70">{phase === 'retry' ? 'Your turn! Tap it.' : instruction}</div>}
      {children}
      <div className={`grid ${cols} gap-3`}>
        {options.map((o) => {
          const isCorrect = o.id === correctId
          const isPicked = picked === o.id
          let cls = ''
          if ((phase === 'correct' || phase === 'done') && isCorrect) cls = 'tile-correct'
          else if (phase === 'wrong' && isPicked) cls = 'tile-wrong'
          else if ((phase === 'wrong' || phase === 'retry') && isCorrect) cls = 'animate-glow bg-sun'
          else if (phase === 'retry' && !isCorrect) cls = 'opacity-40'
          return (
            <button
              key={o.id}
              onClick={() => tap(o.id)}
              className={`tile ${big ? 'min-h-24 text-5xl' : 'min-h-16 text-3xl'} px-2 py-3 font-bold ${cls} ${o.className ?? ''}`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
      <button onClick={() => prompt()} className="btn btn-secondary mx-auto mt-2 text-lg" aria-label="Hear again">
        🔊 Again
      </button>
    </div>
  )
}

export { sample, shuffleArr } from './common'
