import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Character } from '../components/Character'
import { JourneyMap } from '../components/JourneyMap'
import { Screen, StarCount } from '../components/ui'
import { GROUPS } from '../content/gpcs'
import { levelName, levelProgress, unlockedTricks } from '../content/parts'
import { soundsKnown, summarize } from '../engine/curriculum'
import { minutesToday } from '../engine/reminders'
import { dayKey, shieldState } from '../engine/scheduler'
import { useProgress } from '../store/progressStore'
import { needsPick } from './WhoIsPlaying'
import { useUpdate } from '../store/updateStore'
import { say } from '../speech/phonics'
import { sfx } from '../speech/sfx'
import { stopSpeaking, warmUp } from '../speech/tts'

export function Home() {
  const nav = useNavigate()
  const progress = useProgress((s) => s.progress)!
  const sessions = useProgress((s) => s.sessions)
  const otherCount = useProgress((s) => Object.keys(s.others).length)
  const updateReady = useUpdate((s) => s.status === 'available')
  const [mood, setMood] = useState<'idle' | 'happy' | 'talking'>('idle')
  const [trickClass, setTrickClass] = useState('')
  const [trickIndex, setTrickIndex] = useState(0)
  const now = Date.now()
  const summary = useMemo(() => summarize(progress, now), [progress, now])
  const lp = levelProgress(progress.xp)
  const tricks = unlockedTricks(soundsKnown(progress))
  const island = GROUPS.find((g) => g.id === progress.currentGroup) ?? GROUPS[0]
  const todayMin = useMemo(() => minutesToday(sessions, now), [sessions, now])
  const goalDone = todayMin >= progress.dailyGoalMin
  const eggReady = progress.lastEggDay !== dayKey(now)
  const shield = shieldState(progress.streak, now)
  const known = { words: summary.knownWords, sounds: soundsKnown(progress), heart: summary.trickyMastered }

  useEffect(() => () => stopSpeaking(), [])
  // More than one child: ask who is playing when the app starts.
  useEffect(() => {
    if (needsPick(otherCount + 1)) nav('/who', { replace: true })
  }, [otherCount, nav])

  /** Tapping the buddy: it does one of its unlocked tricks. */
  const doTrick = () => {
    warmUp()
    stopSpeaking()
    const trick = tricks[trickIndex % tricks.length]
    setTrickIndex(trickIndex + 1)
    sfx.pop()
    setTrickClass('')
    requestAnimationFrame(() => setTrickClass(trick.anim))
    setMood('happy')
    say(trick.line).then(() => setMood('idle'))
    setTimeout(() => setTrickClass(''), 1600)
  }

  return (
    <Screen className="gap-4 px-4 pb-10">
      {/* island backdrop */}
      <div className="-mx-4 -mt-0 rounded-b-[40px] px-4 pb-6 pt-4 safe-top" style={{ background: `linear-gradient(180deg, ${island.theme.color}66, transparent)` }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold uppercase text-ink/50">
              {island.theme.emoji} {island.title}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-3xl font-extrabold text-grape">{progress.childName}</div>
              {otherCount > 0 && (
                <button onClick={() => nav('/who')} aria-label="Switch player" className="rounded-full bg-white px-2 py-1 text-sm font-extrabold text-grape shadow">
                  👥 Switch
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-white px-3 py-1 text-lg font-extrabold text-orange-600 shadow" aria-label={`${summary.streak}-day streak${summary.streak > 0 && shield !== 'recharging' ? ', shield ready' : ''}`}>
              🔥 {summary.streak}
              {summary.streak > 0 && shield !== 'recharging' && <span className="ml-1 text-base">🛡️</span>}
            </div>
            <StarCount xp={progress.xp} />
          </div>
        </div>
        <div className="pointer-events-none mt-2 flex justify-between text-2xl opacity-60">
          {progress.completedGroups.slice(-6).map((id) => (
            <span key={id}>{GROUPS.find((g) => g.id === id)?.theme.emoji}</span>
          ))}
          <span className="animate-bounce-soft">{island.theme.emoji}</span>
        </div>
        <button onClick={doTrick} className="mx-auto flex flex-col items-center" aria-label="Tap your buddy">
          <div className={trickClass} style={{ transformOrigin: 'center bottom' }}>
            <Character base={progress.character} look={progress.look} level={lp.level} mood={mood} size={200} />
          </div>
        </button>
        <div className="mx-auto -mt-2 flex w-56 flex-col items-center">
          <div className="rounded-full bg-white px-3 py-1 text-sm font-extrabold text-grape shadow">
            Lv {lp.level} · {levelName(lp.level)}
          </div>
          <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-white/70">
            <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${Math.round(lp.fraction * 100)}%` }} />
          </div>
          <div className="text-[11px] font-bold text-ink/50">{`${lp.next - progress.xp} ⭐ to level ${lp.level + 1} · tap me for a trick!`}</div>
        </div>
      </div>

      <button
        onClick={() => {
          warmUp()
          sfx.fanfare()
          nav('/play')
        }}
        className="btn btn-primary w-full py-6 text-4xl"
      >
        ▶ Play
      </button>
      <div className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-2 text-sm font-bold text-ink/60">
        <span>
          Today: {todayMin} / {progress.dailyGoalMin} min
        </span>
        <span>{goalDone ? '✅ Goal done!' : eggReady ? '🥚 Egg waiting!' : '⏳ Keep going'}</span>
      </div>

      {shield === 'protecting' && (
        <div className="rounded-2xl bg-sky-100 px-4 py-2 text-center font-extrabold text-sky-800">🛡️ Your shield is keeping your 🔥 {summary.streak}-day streak safe. Play today to keep it!</div>
      )}

      <div className="rounded-3xl bg-white px-4 py-2 shadow">
        <div className="text-xs font-extrabold uppercase text-ink/50">I can read</div>
        {known.words + known.sounds + known.heart > 0 ? (
          <div className="grid grid-cols-3 text-center">
            <Known icon="📖" n={known.words} label={known.words === 1 ? 'word' : 'words'} />
            <Known icon="🔤" n={known.sounds} label={known.sounds === 1 ? 'sound' : 'sounds'} />
            <Known icon="❤️" n={known.heart} label={known.heart === 1 ? 'heart word' : 'heart words'} />
          </div>
        ) : (
          <div className="py-1 text-lg font-extrabold">Play to learn your first sound!</div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <button onClick={() => nav('/wardrobe')} className="tile flex-col py-3">
          <span className="text-3xl">👕</span>
          <span className="text-xs font-extrabold">Looks</span>
        </button>
        <button onClick={() => nav('/stickers')} className="tile flex-col py-3">
          <span className="text-3xl">{eggReady ? '🥚' : '📒'}</span>
          <span className="text-xs font-extrabold">Stickers</span>
        </button>
        <button onClick={() => nav('/alphabet')} className="tile flex-col py-3">
          <span className="text-3xl">🔤</span>
          <span className="text-xs font-extrabold">ABC</span>
        </button>
        <button onClick={() => nav('/parent')} className="tile relative flex-col py-3">
          {updateReady && <span aria-label="App update available" className="absolute right-2 top-2 h-3 w-3 rounded-full bg-rose-500 ring-2 ring-white" />}
          <span className="text-3xl">👨‍👩‍👧</span>
          <span className="text-xs font-extrabold">Parents</span>
        </button>
      </div>

      <div className="mt-2 text-xl font-extrabold text-ink/70">Your journey</div>
      <JourneyMap
        groups={GROUPS}
        completed={progress.completedGroups}
        current={progress.currentGroup}
        learnt={(g) => g.gpcIds.filter((id) => progress.gpcs[id]).length}
        buddy={{ base: progress.character, look: progress.look, level: lp.level }}
      />
    </Screen>
  )
}

/** One "I can read" count: only ever grows, no total to compare against. */
function Known({ icon, n, label }: { icon: string; n: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-2xl font-extrabold">
        {icon} {n}
      </div>
      <div className="text-xs font-bold text-ink/60">{label}</div>
    </div>
  )
}
