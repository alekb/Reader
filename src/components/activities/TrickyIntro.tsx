import { useEffect, useMemo, useState } from 'react'
import type { TrickyWord } from '../../content/trickyWords'
import { TRICKY_WORDS } from '../../content/trickyWords'
import { WORDS } from '../../content/words'
import { say, speakWord } from '../../speech/phonics'
import { pause, speak, stopSpeaking } from '../../speech/tts'
import { sfx } from '../../speech/sfx'
import { Mascot } from '../ui'
import { ChoiceQuiz, sample, shuffleArr } from './ChoiceQuiz'
import type { ActivityProps } from './common'

interface Props extends ActivityProps {
  word: TrickyWord
  onIntroduced: () => void
}

/** Step 5: heart word. Show the word, mark the part to learn by heart, hear it in a sentence, then find it. */
export function TrickyIntro({ word, onIntroduced, onResult, onDone }: Props) {
  const [stage, setStage] = useState<'intro' | 'quiz'>('intro')
  const [round, setRound] = useState(0)
  const letters = word.word.split('')

  const intro = async () => {
    stopSpeaking()
    await say('This is a heart word. You learn it by heart.', { pauseAfter: 200 })
    await say('It says', { pauseAfter: 100 })
    await speakWord(word.word, { pauseAfter: 400 })
    await speakWord(word.word, { pauseAfter: 400 })
    await speak(word.example, { rate: 0.85 })
  }

  useEffect(() => {
    onIntroduced()
    const t = setTimeout(intro, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.word])

  const question = useMemo(() => {
    const target = word.word
    const trickyPool = TRICKY_WORDS.map((t) => t.word).filter((w) => w !== target && w.length <= target.length + 1)
    const wordPool = WORDS.map((w) => w.word).filter((w) => w.length === target.length || w[0] === target[0].toLowerCase())
    const picks = [...sample(trickyPool, round === 0 ? 1 : 2), ...sample(wordPool, 2)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 2)
    return shuffleArr([target, ...picks]).map((w) => ({ id: w, label: <span className="font-letter text-4xl">{w}</span> }))
  }, [word.word, round])

  if (stage === 'intro') {
    return (
      <div className="flex flex-1 flex-col items-center gap-4 px-4 pb-6">
        <Mascot text="A heart word! Learn it by heart. ❤️" mood="talking" size={90} />
        <button
          onClick={() => {
            sfx.tap()
            intro()
          }}
          className="tile w-full max-w-xs flex-col py-6"
        >
          <div className="flex items-end gap-1">
            {letters.map((ch, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className={`h-7 text-xl ${word.heart.includes(i) ? 'text-rose-500' : 'text-transparent'}`}>❤️</div>
                <div className={`font-letter text-7xl font-bold ${word.heart.includes(i) ? 'text-rose-500' : 'text-ink'}`}>{ch}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-lg font-bold text-ink/60">{word.example}</div>
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => {
              stopSpeaking()
              speakWord(word.word)
            }}
            className="btn btn-secondary"
          >
            🔊 Word
          </button>
          <button
            onClick={() => {
              stopSpeaking()
              setStage('quiz')
              pause(100)
            }}
            className="btn btn-primary"
          >
            Next ➜
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-3 pb-6">
      <div className="px-4">
        <Mascot text="Find the heart word!" mood="thinking" size={80} />
      </div>
      <ChoiceQuiz
        questionKey={`tricky-${round}`}
        prompt={async () => {
          await say('Tap the word', { pauseAfter: 100 })
          await speakWord(word.word)
        }}
        options={question}
        correctId={word.word}
        columns={1}
        big={false}
        correction={async () => {
          await say('This one says')
          await speakWord(word.word, { pauseAfter: 300 })
          await say('Your turn!')
        }}
        instruction="Tap the word you hear"
        onAnswer={(correct, ms) => onResult({ kind: 'tricky', id: word.word, correct, ms, scheduled: false })}
        onDone={() => (round === 0 ? setRound(1) : onDone())}
      />
    </div>
  )
}
