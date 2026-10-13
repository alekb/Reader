import { useEffect, useMemo, useState } from 'react'
import type { Sentence } from '../../content/sentences'
import { SENTENCES } from '../../content/sentences'
import { isTricky, sentenceWords, wordGpcs } from '../../engine/lessonBuilder'
import { say, speakSound, speakWord } from '../../speech/phonics'
import { pause, speak, stopSpeaking } from '../../speech/tts'
import { sfx } from '../../speech/sfx'
import { Mascot } from '../ui'
import { ChoiceQuiz, sample, shuffleArr } from './ChoiceQuiz'
import type { ActivityProps } from './common'

interface Props extends ActivityProps {
  sentences: Sentence[]
}

/** Split a sentence into display tokens keeping punctuation attached. */
function tokens(text: string): { raw: string; word: string }[] {
  return text.split(/\s+/).map((raw) => ({ raw, word: raw.replace(/[^A-Za-z']/g, '').toLowerCase() }))
}

/** Step 6: read decodable sentences. Tap a word for help; then pick the matching picture. */
export function Sentences({ sentences, onResult, onDone }: Props) {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'read' | 'check'>('read')
  const [activeWord, setActiveWord] = useState<number | null>(null)
  const sentence = sentences[index]
  const toks = useMemo(() => (sentence ? tokens(sentence.text) : []), [sentence])

  useEffect(() => {
    setPhase('read')
    setActiveWord(null)
    stopSpeaking()
    if (!sentence) return
    const t = setTimeout(() => say(index === 0 ? 'Read the sentence. Tap a word if you need help.' : 'Read this one!'), 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  const helpWord = async (i: number) => {
    stopSpeaking()
    sfx.tap()
    setActiveWord(i)
    const w = toks[i].word
    if (isTricky(w)) {
      await speakWord(w)
    } else {
      const g = wordGpcs(w)
      if (g) {
        for (const id of g) {
          await speakSound(id)
          await pause(250)
        }
        await pause(150)
      }
      await speakWord(w)
    }
    setActiveWord(null)
  }

  const readAloud = async () => {
    stopSpeaking()
    for (let i = 0; i < toks.length; i++) {
      setActiveWord(i)
      await speakWord(toks[i].word)
      await pause(120)
    }
    setActiveWord(null)
    await pause(200)
    await say('Now read it like talking:')
    await speak(sentence.text, { rate: 0.85 })
  }

  const check = useMemo(() => {
    if (!sentence) return null
    const others = sample(SENTENCES.filter((s) => s.emoji !== sentence.emoji), 2)
    return shuffleArr([sentence, ...others]).map((s) => ({ id: s.emoji, label: <span className="text-6xl">{s.emoji}</span> }))
  }, [sentence])

  if (!sentence || !check) return null
  const next = () => (index + 1 >= sentences.length ? onDone() : setIndex(index + 1))

  if (phase === 'read') {
    return (
      <div className="flex flex-1 flex-col items-center gap-4 px-4 pb-6">
        <Mascot text="Read it! Tap a word if you get stuck." mood="idle" size={80} />
        <div className="flex w-full flex-wrap justify-center gap-x-3 gap-y-4 rounded-3xl bg-white px-4 py-6 shadow-md">
          {toks.map((t, i) => (
            <button
              key={i}
              onClick={() => helpWord(i)}
              className={`font-letter rounded-xl px-1 text-4xl font-bold leading-tight transition ${activeWord === i ? 'bg-sun' : ''} ${isTricky(t.word) ? 'text-rose-600' : 'text-ink'}`}
            >
              {t.raw}
            </button>
          ))}
        </div>
        <div className="text-sm font-bold text-ink/50">Red words are heart words ❤️</div>
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={readAloud} className="btn btn-secondary">
            🔊 Read it to me
          </button>
          <button
            onClick={() => {
              stopSpeaking()
              sfx.pop()
              setPhase('check')
            }}
            className="btn btn-primary"
          >
            ✓ I read it!
          </button>
        </div>
        <div className="text-sm font-bold text-ink/40">
          {index + 1} / {sentences.length}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-3 pb-6">
      <div className="px-4">
        <Mascot text="Which picture matches?" mood="thinking" size={80} />
      </div>
      <ChoiceQuiz
        questionKey={`sent-${index}`}
        prompt={() => say('Tap the picture that matches the sentence.')}
        options={check}
        correctId={sentence.emoji}
        columns={3}
        correction={async () => {
          await say('The sentence says:')
          await speak(sentence.text, { rate: 0.85, pauseAfter: 300 })
          await say('Your turn!')
        }}
        instruction="Tap the picture"
        onAnswer={(correct, ms) => onResult({ kind: 'sentence', id: sentence.text, correct, ms, group: sentence.group })}
        onDone={next}
      >
        <div className="font-letter rounded-2xl bg-white px-3 py-3 text-center text-3xl font-bold shadow">{sentence.text}</div>
      </ChoiceQuiz>
    </div>
  )
}

export { sentenceWords }
