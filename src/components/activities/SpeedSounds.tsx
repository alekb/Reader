import { useMemo, useState } from 'react'
import { GPC_BY_ID } from '../../content/gpcs'
import { TRICKY_WORDS } from '../../content/trickyWords'
import { WORDS } from '../../content/words'
import type { ReviewItem } from '../../engine/lessonBuilder'
import { say, speakSound, speakWord } from '../../speech/phonics'
import { Mascot, graphemeLabel } from '../ui'
import { ChoiceQuiz, sample, shuffleArr } from './ChoiceQuiz'
import { makeQueue, pickSoundDistractors, requeue } from './common'
import type { ActivityProps } from './common'

interface Props extends ActivityProps {
  items: ReviewItem[]
  /** GPC ids the child has met (distractor pool). */
  knownGpcIds: string[]
  knownTricky: string[]
}

/** Step 1: speed sounds. Hear a sound (or word), tap the matching grapheme (or word). */
export function SpeedSounds({ items, knownGpcIds, knownTricky, onResult, onDone }: Props) {
  const [queue, setQueue] = useState(() => makeQueue(items))
  const [index, setIndex] = useState(0)
  const item = queue.items[index]
  const isRetest = queue.retests.has(index)

  const question = useMemo(() => {
    if (!item) return null
    if (item.type === 'gpc') {
      const picks = pickSoundDistractors(item.id, knownGpcIds)
      const options = shuffleArr([item.id, ...picks]).map((id) => ({ id, label: <span className="font-letter">{graphemeLabel(id, GPC_BY_ID[id].grapheme)}</span> }))
      return {
        options,
        correctId: item.id,
        prompt: () => speakSound(item.id),
        correction: async () => {
          await say('That one says')
          await speakSound(item.id)
          await say('Say it with me.')
          await speakSound(item.id, { pauseAfter: 400 })
          await say('Your turn!')
        },
        instruction: 'Tap the sound you hear',
      }
    }
    const target = item.id
    const trickyPool = knownTricky.filter((w) => w !== target)
    const wordPool = WORDS.map((w) => w.word).filter((w) => w !== target && Math.abs(w.length - target.length) <= 1)
    const picks = [...sample(trickyPool, 1), ...sample(wordPool, 2)].slice(0, 2)
    while (picks.length < 2) picks.push(TRICKY_WORDS[Math.floor(Math.random() * TRICKY_WORDS.length)].word)
    const options = shuffleArr([target, ...picks]).map((w) => ({ id: w, label: <span className="font-letter text-4xl">{w}</span> }))
    return {
      options,
      correctId: target,
      prompt: () => speakWord(target),
      correction: async () => {
        await say('That word is')
        await speakWord(target)
        await say('Say it with me.')
        await speakWord(target, { pauseAfter: 400 })
        await say('Your turn!')
      },
      instruction: 'Tap the word you hear',
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, queue])

  if (!item || !question) return null

  const next = () => {
    if (index + 1 >= queue.items.length) onDone()
    else setIndex(index + 1)
  }

  return (
    <div className="flex flex-1 flex-col gap-3 pb-6">
      <div className="px-4">
        <Mascot text={isRetest ? 'One more time!' : 'Quick! Which one?'} mood="idle" size={90} />
      </div>
      <ChoiceQuiz
        questionKey={`${index}-${item.type}-${item.id}`}
        prompt={question.prompt}
        options={question.options}
        correctId={question.correctId}
        correction={question.correction}
        instruction={question.instruction}
        columns={item.type === 'gpc' ? 2 : 1}
        onAnswer={(correct, ms) => {
          onResult({ kind: item.type, id: item.id, correct, ms, scheduled: !isRetest })
          if (!correct) setQueue((q) => requeue(q, index))
        }}
        onDone={next}
      />
      <div className="text-center text-sm font-bold text-ink/40">
        {index + 1} / {queue.items.length}
      </div>
    </div>
  )
}
