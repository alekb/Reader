import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BlendWords } from '../components/activities/BlendWords'
import { BuildWord } from '../components/activities/BuildWord'
import { NewSound } from '../components/activities/NewSound'
import { OralBlend } from '../components/activities/OralBlend'
import { Sentences } from '../components/activities/Sentences'
import { SpeedSounds } from '../components/activities/SpeedSounds'
import { TrickyIntro } from '../components/activities/TrickyIntro'
import { FloatingStars, Screen, TopBar } from '../components/ui'
import { buildLesson } from '../engine/lessonBuilder'
import type { Lesson as LessonPlan, Step } from '../engine/lessonBuilder'
import { usableGpcs } from '../engine/curriculum'
import type { ActivityResult } from '../engine/types'
import { xpFor } from '../engine/progress'
import { useProgress } from '../store/progressStore'
import { say } from '../speech/phonics'
import { stopSpeaking, warmUp } from '../speech/tts'
import { LESSON_BACK_EVENT } from '../components/BackButton'

const STEP_TITLES: Record<Step['kind'], string> = {
  speedSounds: 'Speed sounds',
  oralBlend: 'Robot talk',
  newSound: 'New sound',
  blend: 'Read words',
  trickyIntro: 'Heart word',
  sentences: 'Read sentences',
  build: 'Build words',
  close: 'Done',
}

/** Runs one session: builds the lesson, walks through the steps, records results. */
export function Lesson() {
  const nav = useNavigate()
  const progress = useProgress((s) => s.progress)
  const startSession = useProgress((s) => s.startSession)
  const recordResult = useProgress((s) => s.recordResult)
  const introduceItem = useProgress((s) => s.introduceItem)
  const endSession = useProgress((s) => s.endSession)
  const [lesson, setLesson] = useState<LessonPlan | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [starTrigger, setStarTrigger] = useState(0)
  const [starAmount, setStarAmount] = useState(0)
  const [confirmExit, setConfirmExit] = useState(false)
  const startedRef = useRef(false)
  const speedRef = useRef({ attempts: 0, correct: 0 })
  // Snapshot the known-GPC list at session start so distractor pools are stable.
  const knownGpcIds = useMemo(() => (progress ? usableGpcs(progress) : []), [lesson]) // eslint-disable-line react-hooks/exhaustive-deps
  const knownTricky = useMemo(() => (progress ? Object.keys(progress.tricky) : []), [lesson]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!progress) {
      nav('/')
      return
    }
    if (startedRef.current) return
    startedRef.current = true
    warmUp()
    const plan = buildLesson(progress, { now: Date.now() })
    setLesson(plan)
    startSession(plan.group)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => stopSpeaking(), [])
  useEffect(() => {
    const onBack = () => setConfirmExit((open) => !open)
    window.addEventListener(LESSON_BACK_EVENT, onBack)
    return () => window.removeEventListener(LESSON_BACK_EVENT, onBack)
  }, [])

  if (!progress || !lesson) return null
  const step = lesson.steps[stepIndex]
  const total = lesson.steps.length

  const onResult = (r: ActivityResult) => {
    recordResult(r, step.kind)
    if (step.kind === 'speedSounds') {
      speedRef.current.attempts++
      if (r.correct) speedRef.current.correct++
    }
    if (r.correct) {
      setStarAmount(xpFor(r))
      setStarTrigger((t) => t + 1)
    }
  }

  const nextStep = () => {
    stopSpeaking()
    // Adaptive rule: if the review sweep was below 85%, drop today's new material.
    if (step.kind === 'speedSounds' && lesson.newGpcIds.length) {
      const { attempts, correct } = speedRef.current
      if (attempts >= 4 && correct / attempts < 0.85) {
        const current = useProgress.getState().progress!
        const rebuilt = buildLesson(current, { now: Date.now(), forceNoNew: true })
        // Keep the speed-sounds step we just did; continue with the rebuilt remainder.
        const rest = rebuilt.steps.filter((s) => s.kind !== 'speedSounds')
        setLesson({ ...rebuilt, steps: [step, ...rest] })
        setStepIndex(1)
        say("Let's practise what we know today.")
        return
      }
    }
    if (stepIndex + 1 >= total) return
    const next = lesson.steps[stepIndex + 1]
    if (next.kind === 'close') {
      endSession(true)
      nav('/done', { replace: true })
      return
    }
    setStepIndex(stepIndex + 1)
  }

  const exit = () => {
    stopSpeaking()
    endSession(false)
    nav('/', { replace: true })
  }

  const body = (() => {
    switch (step.kind) {
      case 'speedSounds':
        return <SpeedSounds key={stepIndex} items={step.items} knownGpcIds={knownGpcIds} knownTricky={knownTricky} onResult={onResult} onDone={nextStep} />
      case 'oralBlend':
        return <OralBlend key={stepIndex} words={step.words} onResult={onResult} onDone={nextStep} />
      case 'newSound':
        return (
          <NewSound
            key={stepIndex}
            gpcId={step.gpcId}
            knownGpcIds={knownGpcIds}
            onIntroduced={() => introduceItem('gpc', step.gpcId)}
            onResult={onResult}
            onDone={nextStep}
          />
        )
      case 'blend':
        return <BlendWords key={stepIndex} words={step.words} knownGpcIds={[...knownGpcIds, ...lesson.newGpcIds]} onResult={onResult} onDone={nextStep} />
      case 'trickyIntro':
        return <TrickyIntro key={stepIndex} word={step.word} onIntroduced={() => introduceItem('tricky', step.word.word)} onResult={onResult} onDone={nextStep} />
      case 'sentences':
        return <Sentences key={stepIndex} sentences={step.sentences} onResult={onResult} onDone={nextStep} />
      case 'build':
        return <BuildWord key={stepIndex} words={step.words} knownGpcIds={[...knownGpcIds, ...lesson.newGpcIds]} onResult={onResult} onDone={nextStep} />
      case 'close':
        return null
    }
  })()

  return (
    <Screen className="relative">
      <TopBar
        title={STEP_TITLES[step.kind]}
        onBack={() => setConfirmExit(true)}
        progress={stepIndex / Math.max(1, total - 1)}
        right={<div className="text-sm font-bold text-ink/50">{stepIndex + 1}/{total - 1}</div>}
      />
      <FloatingStars amount={starAmount} trigger={starTrigger} />
      {body}
      {confirmExit && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-6" onClick={() => setConfirmExit(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-2xl font-extrabold">Stop for now?</div>
            <div className="mt-1 text-ink/60">Your stars are saved.</div>
            <div className="mt-4 flex gap-3">
              <button onClick={() => setConfirmExit(false)} className="btn btn-success flex-1 text-lg">
                Keep going
              </button>
              <button onClick={exit} className="btn btn-secondary flex-1 text-lg">
                Stop
              </button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  )
}
