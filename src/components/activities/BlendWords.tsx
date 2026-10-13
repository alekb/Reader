import { useEffect, useMemo, useState } from 'react'
import { GPC_BY_ID } from '../../content/gpcs'
import { WORDS } from '../../content/words'
import type { DecodableWord } from '../../content/words'
import { makeNonsenseWord } from '../../engine/nonsense'
import { say, speakSound, speakWord } from '../../speech/phonics'
import { pause, stopSpeaking } from '../../speech/tts'
import { sfx } from '../../speech/sfx'
import { GraphemeTiles, Mascot, graphemeLabel } from '../ui'
import { ChoiceQuiz, sample, shuffleArr } from './ChoiceQuiz'
import type { ActivityProps } from './common'

interface Props extends ActivityProps {
  words: DecodableWord[]
  knownGpcIds: string[]
}

function isNonsense(w: DecodableWord): boolean {
  return w.group === 0
}

function tiles(w: DecodableWord): string[] {
  return w.gpcs.map((id) => graphemeLabel(id, GPC_BY_ID[id].grapheme))
}

/** Step 4: blend words. Sound it out, say it fast, then prove it with a quick check. */
export function BlendWords({ words, knownGpcIds, onResult, onDone }: Props) {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'read' | 'check'>('read')
  const [active, setActive] = useState<number | null>(null)
  const [helped, setHelped] = useState(false)
  const word = words[index]
  const alien = word ? isNonsense(word) : false

  useEffect(() => {
    setPhase('read')
    setActive(null)
    setHelped(false)
    stopSpeaking()
    if (!word) return
    const t = setTimeout(() => {
      if (alien) say('An alien word! Sound it out, then say it fast.')
      else say(index === 0 ? 'Tap each sound, then say the word fast!' : 'Sound it out, then say it fast!')
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  const soundOutWithHighlight = async (thenWord: boolean) => {
    stopSpeaking()
    for (let i = 0; i < word.gpcs.length; i++) {
      setActive(i)
      await speakSound(word.gpcs[i])
      await pause(300)
    }
    setActive(null)
    if (thenWord) {
      await pause(150)
      await speakWord(word.word)
    }
  }

  const check = useMemo(() => {
    if (!word) return null
    if (word.emoji && !alien) {
      const others = sample(WORDS.filter((w) => w.emoji && w.word !== word.word && w.emoji !== word.emoji), 2)
      return {
        kind: 'picture' as const,
        options: shuffleArr([word, ...others]).map((w) => ({ id: w.word, label: <span className="text-6xl">{w.emoji}</span> })),
        prompt: () => say('Tap the picture of the word you read.'),
        correction: async () => {
          await say('The word is')
          await speakWord(word.word, { pauseAfter: 300 })
          await say('Your turn!')
        },
        instruction: 'Tap the picture',
        columns: 3 as const,
      }
    }
    // Word check: hear the word, tap it among look-alikes.
    let distractors: DecodableWord[] = []
    if (alien) {
      for (let i = 0; i < 6 && distractors.length < 2; i++) {
        const d = makeNonsenseWord(knownGpcIds)
        if (d && d.word !== word.word && !distractors.some((x) => x.word === d.word)) distractors.push(d)
      }
    }
    if (distractors.length < 2) {
      const similar = WORDS.filter((w) => w.word !== word.word && w.word.length === word.word.length && (w.word[0] === word.word[0] || w.word.slice(-1) === word.word.slice(-1)))
      distractors = [...distractors, ...sample(similar, 2 - distractors.length)]
    }
    if (distractors.length < 2) distractors = [...distractors, ...sample(WORDS.filter((w) => w.word !== word.word), 2 - distractors.length)]
    return {
      kind: 'word' as const,
      options: shuffleArr([word, ...distractors]).map((w) => ({ id: w.word, label: <span className="font-letter text-4xl">{w.word}</span> })),
      prompt: async () => {
        await say('Tap the word', { pauseAfter: 100 })
        await speakWord(word.word)
      },
      correction: async () => {
        await say('This one says')
        await speakWord(word.word, { pauseAfter: 300 })
        await say('Your turn!')
      },
      instruction: 'Tap the word you hear',
      columns: 1 as const,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, phase])

  if (!word || !check) return null

  const next = () => (index + 1 >= words.length ? onDone() : setIndex(index + 1))

  if (phase === 'read') {
    return (
      <div className="flex flex-1 flex-col items-center gap-4 px-4 pb-6">
        <Mascot text={alien ? '👽 Alien word! Can you read it?' : 'Sound it out, then say it fast!'} mood="idle" size={80} />
        {alien && <div className="rounded-full bg-violet-200 px-4 py-1 text-sm font-extrabold text-violet-800">ALIEN WORD · not a real word</div>}
        <div className="my-4">
          <GraphemeTiles
            segments={tiles(word)}
            active={active}
            onTap={(i) => {
              sfx.tap()
              stopSpeaking()
              setActive(i)
              speakSound(word.gpcs[i]).then(() => setActive(null))
            }}
          />
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={() => soundOutWithHighlight(false)} className="btn btn-secondary">
            🐢 Sound it out
          </button>
          <button
            onClick={() => {
              setHelped(true)
              soundOutWithHighlight(true)
            }}
            className="btn btn-secondary"
          >
            🔊 Tell me
          </button>
        </div>
        <button
          onClick={() => {
            stopSpeaking()
            sfx.pop()
            setPhase('check')
          }}
          className="btn btn-primary mt-2"
        >
          ✓ I read it!
        </button>
        <div className="text-sm font-bold text-ink/40">
          {index + 1} / {words.length}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-3 pb-6">
      <div className="px-4">
        <Mascot text="Prove it!" mood="thinking" size={80} />
      </div>
      <ChoiceQuiz
        questionKey={`check-${index}`}
        prompt={check.prompt}
        options={check.options}
        correctId={word.word}
        correction={check.correction}
        instruction={check.instruction}
        columns={check.columns}
        big={check.kind === 'picture'}
        onAnswer={(correct, ms) => onResult({ kind: 'word', id: word.word, correct: correct && !helped, ms, group: word.group, nonsense: alien })}
        onDone={next}
      >
        {check.kind === 'picture' && <div className="font-letter text-center text-5xl font-bold">{word.word}</div>}
      </ChoiceQuiz>
    </div>
  )
}
