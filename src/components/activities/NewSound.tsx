import { useEffect, useMemo, useState } from 'react'
import { GPC_BY_ID, groupOf } from '../../content/gpcs'
import { decodableWords } from '../../content/words'
import { say, speakLetterName, speakSound, speakWord } from '../../speech/phonics'
import { pause, stopSpeaking } from '../../speech/tts'
import { sfx } from '../../speech/sfx'
import { Mascot, graphemeLabel } from '../ui'
import { ChoiceQuiz, sample, shuffleArr } from './ChoiceQuiz'
import { CONFUSABLE } from './common'
import type { ActivityProps } from './common'
import { LetterTrace } from './LetterTrace'

interface Props extends ActivityProps {
  gpcId: string
  knownGpcIds: string[]
  /** Called when the child has met the sound (so it is marked as introduced). */
  onIntroduced: () => void
}

type Stage = 'intro' | 'trace' | 'find' | 'findInWord'

/** Step 3: introduce a new grapheme-phoneme correspondence (see-hear-say-trace-find). */
export function NewSound({ gpcId, knownGpcIds, onIntroduced, onResult, onDone }: Props) {
  const gpc = GPC_BY_ID[gpcId]
  const [stage, setStage] = useState<Stage>('intro')
  const [traceIndex, setTraceIndex] = useState(0)
  const [findRound, setFindRound] = useState(0)
  const single = gpc.grapheme.length === 1
  const label = graphemeLabel(gpc.id, gpc.grapheme)
  const traceTexts = single ? [gpc.grapheme, gpc.grapheme.toUpperCase()] : [label]
  const isSplit = gpc.id.endsWith('_e')

  const introduceSpeech = async () => {
    stopSpeaking()
    if (single) {
      await say('This is the letter', { pauseAfter: 100 })
      await speakLetterName(gpc.grapheme)
      await pause(250)
      await say('It says', { pauseAfter: 100 })
    } else if (isSplit) {
      await say(`This is ${gpc.id[0]}, with a magic e at the end. Together they say`, { pauseAfter: 100 })
    } else {
      await say('These letters together say', { pauseAfter: 100 })
    }
    await speakSound(gpcId, { pauseAfter: 400 })
    await speakSound(gpcId, { pauseAfter: 400 })
    await say(`like ${gpc.keyword}.`, { pauseAfter: 200 })
    await speakWord(gpc.keyword)
  }

  useEffect(() => {
    onIntroduced()
    const t = setTimeout(introduceSpeech, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpcId])

  // ---- find rounds ----
  const findQuestion = useMemo(() => {
    const pool = knownGpcIds.filter((id) => id !== gpcId && GPC_BY_ID[id].grapheme !== gpc.grapheme)
    const confusable = (CONFUSABLE[gpcId] ?? []).filter((id) => pool.includes(id))
    const picks = [...sample(confusable, findRound === 0 ? 1 : 2), ...sample(pool, 3)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 3)
    const singles = Object.keys(GPC_BY_ID).filter((id) => id !== gpcId && GPC_BY_ID[id].grapheme.length === 1 && !picks.includes(id))
    const all = singles.length >= 3 ? singles : Object.keys(GPC_BY_ID).filter((id) => id !== gpcId && GPC_BY_ID[id].grapheme !== gpc.grapheme)
    while (picks.length < 3) {
      const c = all[Math.floor(Math.random() * all.length)]
      if (!picks.includes(c)) picks.push(c)
    }
    return shuffleArr([gpcId, ...picks]).map((id) => ({ id, label: <span className="font-letter">{graphemeLabel(id, GPC_BY_ID[id].grapheme)}</span> }))
  }, [findRound, gpcId, knownGpcIds, gpc.grapheme])

  // ---- find in word ----
  const wordQuestion = useMemo(() => {
    const words = decodableWords([...knownGpcIds, gpcId], groupOf(gpcId)!.id >= 13)
    const withIt = words.filter((w) => w.gpcs.includes(gpcId))
    const without = words.filter((w) => !w.gpcs.includes(gpcId) && !w.word.includes(gpc.grapheme))
    if (withIt.length < 1 || without.length < 2) return null
    const target = sample(withIt, 1)[0]
    const options = shuffleArr([target, ...sample(without, 2)]).map((w) => ({ id: w.word, label: <span className="font-letter text-4xl">{w.word}</span> }))
    return { target, options }
  }, [gpcId, knownGpcIds, gpc.grapheme])

  const group = groupOf(gpcId)

  if (stage === 'intro') {
    return (
      <div className="flex flex-1 flex-col items-center gap-4 px-4 pb-6">
        <Mascot text={`New sound! Tap the card to hear it.`} mood="talking" size={90} />
        <button
          onClick={() => {
            sfx.tap()
            introduceSpeech()
          }}
          className="tile w-full max-w-xs flex-col gap-1 py-6"
          style={{ background: group?.theme.color ?? '#fff' }}
        >
          <div className="font-letter text-[120px] font-bold leading-none text-ink">{label}</div>
          {single && <div className="font-letter text-4xl font-bold text-ink/60">{gpc.grapheme.toUpperCase()}</div>}
          <div className="mt-2 text-7xl">{gpc.emoji}</div>
          <div className="text-2xl font-extrabold text-ink/80">{gpc.keyword}</div>
        </button>
        <div className="rounded-2xl bg-white/70 px-4 py-2 text-center text-base font-bold text-ink/70">
          {gpc.action}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              stopSpeaking()
              speakSound(gpcId)
            }}
            className="btn btn-secondary"
          >
            🔊 Sound
          </button>
          <button
            onClick={() => {
              stopSpeaking()
              setStage('trace')
              say('Now trace it with your finger. Say the sound while you trace!')
            }}
            className="btn btn-primary"
          >
            Next ➜
          </button>
        </div>
      </div>
    )
  }

  if (stage === 'trace') {
    const txt = traceTexts[traceIndex]
    return (
      <div className="flex flex-1 flex-col items-center gap-3 px-4 pb-6">
        <Mascot text={traceIndex === 0 ? `Trace it and say "${label}"` : 'Now the capital letter!'} mood="idle" size={80} />
        <LetterTrace
          key={txt}
          text={txt}
          onFirstStroke={() => speakSound(gpcId)}
          onDone={(coverage) => {
            onResult({ kind: 'trace', id: gpcId, correct: coverage >= 0.55, ms: 0 })
            speakSound(gpcId)
            if (traceIndex + 1 < traceTexts.length) setTraceIndex(traceIndex + 1)
            else {
              setStage('find')
              say('Now find it!')
            }
          }}
        />
      </div>
    )
  }

  if (stage === 'find') {
    return (
      <div className="flex flex-1 flex-col gap-3 pb-6">
        <div className="px-4">
          <Mascot text="Which one makes this sound?" mood="thinking" size={80} />
        </div>
        <ChoiceQuiz
          questionKey={`find-${findRound}`}
          prompt={() => speakSound(gpcId)}
          options={findQuestion}
          correctId={gpcId}
          correction={async () => {
            await say('This one says')
            await speakSound(gpcId)
            await say('Say it with me.')
            await speakSound(gpcId, { pauseAfter: 400 })
            await say('Your turn!')
          }}
          instruction="Tap the new sound"
          onAnswer={(correct, ms) => onResult({ kind: 'gpc', id: gpcId, correct, ms, scheduled: false })}
          onDone={() => {
            if (findRound === 0) setFindRound(1)
            else if (wordQuestion) {
              setStage('findInWord')
              say('Which word has the new sound?')
            } else onDone()
          }}
        />
      </div>
    )
  }

  if (stage === 'findInWord' && wordQuestion) {
    return (
      <div className="flex flex-1 flex-col gap-3 pb-6">
        <div className="px-4">
          <Mascot text={`Which word has "${label}" in it?`} mood="thinking" size={80} />
        </div>
        <ChoiceQuiz
          questionKey="findInWord"
          prompt={async () => {
            await say('Which word has the sound')
            await speakSound(gpcId)
          }}
          options={wordQuestion.options}
          correctId={wordQuestion.target.word}
          columns={1}
          big={false}
          correction={async () => {
            await say(`${wordQuestion.target.word} has`)
            await speakSound(gpcId)
            await say('in it. Your turn!')
          }}
          instruction="Tap the word"
          onAnswer={(correct, ms) => onResult({ kind: 'gpc', id: gpcId, correct, ms, scheduled: false })}
          onDone={onDone}
        />
      </div>
    )
  }

  return null
}
