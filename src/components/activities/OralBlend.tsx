import { useMemo, useState } from 'react'
import type { DecodableWord } from '../../content/words'
import { WORDS } from '../../content/words'
import { say, soundOut, speakWord } from '../../speech/phonics'
import { pause } from '../../speech/tts'
import { Mascot } from '../ui'
import { ChoiceQuiz, sample, shuffleArr } from './ChoiceQuiz'
import type { ActivityProps } from './common'

interface Props extends ActivityProps {
  words: DecodableWord[]
}

/**
 * Step 2: sound-talk warm-up. The mascot says a word in "robot talk"
 * (c - a - t) with no letters on screen; the child blends it in their head and
 * taps the matching picture.
 */
export function OralBlend({ words, onResult, onDone }: Props) {
  const [index, setIndex] = useState(0)
  const word = words[index]

  const question = useMemo(() => {
    if (!word) return null
    const others = sample(
      WORDS.filter((w) => w.emoji && w.word !== word.word && w.emoji !== word.emoji),
      2,
    )
    const options = shuffleArr([word, ...others]).map((w) => ({ id: w.word, label: <span className="text-6xl">{w.emoji}</span> }))
    return {
      options,
      prompt: async () => {
        await say('Robot talk!', { pauseAfter: 150 })
        await soundOut(word, { gap: 450 })
      },
      correction: async () => {
        await soundOut(word, { gap: 350 })
        await pause(150)
        await say(`makes ${word.word}.`)
        await speakWord(word.word, { pauseAfter: 300 })
        await say('Your turn!')
      },
    }
  }, [word])

  if (!word || !question) return null

  return (
    <div className="flex flex-1 flex-col gap-3 pb-6">
      <div className="px-4">
        <Mascot text="Listen to my robot talk. What word is it?" mood="talking" size={90} />
      </div>
      <ChoiceQuiz
        questionKey={`${index}-${word.word}`}
        prompt={question.prompt}
        options={question.options}
        correctId={word.word}
        correction={question.correction}
        instruction="Tap the picture"
        columns={3}
        onAnswer={(correct, ms) => onResult({ kind: 'oral', id: word.word, correct, ms, group: word.group })}
        onDone={() => (index + 1 >= words.length ? onDone() : setIndex(index + 1))}
      />
      <div className="text-center text-sm font-bold text-ink/40">
        {index + 1} / {words.length}
      </div>
    </div>
  )
}
