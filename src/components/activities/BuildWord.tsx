import { useEffect, useMemo, useState } from 'react'
import { GPC_BY_ID } from '../../content/gpcs'
import type { DecodableWord } from '../../content/words'
import { say, speakSound, speakWord } from '../../speech/phonics'
import { pause, stopSpeaking } from '../../speech/tts'
import { sfx } from '../../speech/sfx'
import { Mascot, graphemeLabel } from '../ui'
import { shuffleArr } from './ChoiceQuiz'
import { soundsAlike } from './common'
import type { ActivityProps } from './common'

interface Props extends ActivityProps {
  words: DecodableWord[]
  knownGpcIds: string[]
}

interface Tile {
  key: number
  gpcId: string
}

/** Step 7: build (spell) a word from sound tiles: hear it, tap the sounds in order. */
export function BuildWord({ words, knownGpcIds, onResult, onDone }: Props) {
  const [index, setIndex] = useState(0)
  const [placed, setPlaced] = useState<Tile[]>([])
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<'building' | 'correct' | 'wrong' | 'reveal'>('building')
  const word = words[index]

  const tiles: Tile[] = useMemo(() => {
    if (!word) return []
    // Spare tiles never sound like a sound in the word, or like each other.
    const distractors: string[] = []
    for (const id of shuffleArr(knownGpcIds)) {
      if (distractors.length >= 2) break
      if (GPC_BY_ID[id].grapheme.length <= 2 && [...word.gpcs, ...distractors].every((g) => !soundsAlike(g, id))) distractors.push(id)
    }
    return shuffleArr([...word.gpcs, ...distractors]).map((gpcId, key) => ({ key, gpcId }))
  }, [word, knownGpcIds, attempt])

  useEffect(() => {
    setPlaced([])
    setAttempt(0)
    setState('building')
    stopSpeaking()
    if (!word) return
    const t = setTimeout(async () => {
      await say('Build the word', { pauseAfter: 100 })
      await speakWord(word.word, { pauseAfter: 300 })
      await say('Tap the sounds in order.')
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  if (!word) return null
  const next = () => (index + 1 >= words.length ? onDone() : setIndex(index + 1))

  const place = (t: Tile) => {
    if (state !== 'building' || placed.length >= word.gpcs.length) return
    sfx.tap()
    stopSpeaking()
    speakSound(t.gpcId)
    const nextPlaced = [...placed, t]
    setPlaced(nextPlaced)
    if (nextPlaced.length === word.gpcs.length) {
      const ok = nextPlaced.every((p, i) => p.gpcId === word.gpcs[i])
      if (ok) {
        setState('correct')
        sfx.correct()
        if (attempt === 0) onResult({ kind: 'build', id: word.word, correct: true, ms: 0, group: word.group })
        speakWord(word.word).then(() => setTimeout(next, 500))
      } else {
        setState('wrong')
        sfx.wrong()
        if (attempt === 0) onResult({ kind: 'build', id: word.word, correct: false, ms: 0, group: word.group })
        ;(async () => {
          await say('Not quite. Listen:', { pauseAfter: 100 })
          for (const id of word.gpcs) {
            await speakSound(id)
            await pause(250)
          }
          await speakWord(word.word)
          if (attempt === 0) {
            await say('Try again!')
            setPlaced([])
            setAttempt(1)
            setState('building')
          } else {
            setState('reveal')
            setPlaced(word.gpcs.map((gpcId, key) => ({ key: 100 + key, gpcId })))
            await say('Here it is.')
            setTimeout(next, 1400)
          }
        })()
      }
    }
  }

  const unplace = (i: number) => {
    if (state !== 'building') return
    sfx.pop()
    setPlaced(placed.filter((_, k) => k !== i))
  }

  const usedKeys = new Set(placed.map((p) => p.key))
  const boxCls = state === 'correct' ? 'bg-leaf text-white' : state === 'wrong' ? 'bg-coral text-white' : state === 'reveal' ? 'bg-sun' : 'bg-white'

  return (
    <div className="flex flex-1 flex-col items-center gap-5 px-4 pb-6">
      <Mascot text={state === 'reveal' ? 'Here it is!' : attempt === 1 ? 'Try again!' : 'Build the word you hear.'} mood={state === 'correct' ? 'happy' : 'idle'} size={80} />
      <button
        onClick={() => {
          stopSpeaking()
          speakWord(word.word)
        }}
        className="tile h-16 w-16 bg-sky text-3xl text-white"
        aria-label="Hear the word"
      >
        🔊
      </button>
      {/* sound boxes */}
      <div className="flex gap-2">
        {word.gpcs.map((_, i) => (
          <button
            key={i}
            onClick={() => unplace(i)}
            className={`font-letter flex h-20 min-w-16 items-center justify-center rounded-2xl border-4 border-dashed border-ink/20 px-2 text-4xl font-bold ${placed[i] ? boxCls + ' border-solid' : 'bg-white/50'}`}
          >
            {placed[i] ? graphemeLabel(placed[i].gpcId, GPC_BY_ID[placed[i].gpcId].grapheme) : ''}
          </button>
        ))}
      </div>
      {/* tiles */}
      <div className="flex flex-wrap justify-center gap-3">
        {tiles.map((t) => (
          <button
            key={t.key}
            disabled={usedKeys.has(t.key) || state !== 'building'}
            onClick={() => place(t)}
            className={`tile font-letter h-20 min-w-16 px-3 text-4xl font-bold ${usedKeys.has(t.key) ? 'opacity-20' : ''}`}
          >
            {graphemeLabel(t.gpcId, GPC_BY_ID[t.gpcId].grapheme)}
          </button>
        ))}
      </div>
      <div className="text-sm font-bold text-ink/40">
        {index + 1} / {words.length}
      </div>
    </div>
  )
}
