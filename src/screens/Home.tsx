import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Character } from '../components/Character'
import { Screen, StarCount } from '../components/ui'
import { GROUPS } from '../content/gpcs'
import { LEVEL_NAMES, levelProgress, unlockedTricks } from '../content/parts'
import { soundsKnown, summarize } from '../engine/curriculum'
import { dayKey } from '../engine/scheduler'
import { useProgress } from '../store/progressStore'
import { say } from '../speech/phonics'
import { sfx } from '../speech/sfx'
import { stopSpeaking, warmUp } from '../speech/tts'

export function Home() {
  const nav = useNavigate()
  const progress = useProgress((s) => s.progress)!
  const sessions = useProgress((s) => s.sessions)
  const [mood, setMood] = useState<'idle' | 'happy' | 'talking'>('idle')
  const [trickClass, setTrickClass] = useState('')
  const [trickIndex, setTrickIndex] = useState(0)
  const now = Date.now()
  const summary = useMemo(() => summarize(progress, now), [progress, now])
  const lp = levelProgress(progress.xp)
  const tricks = unlockedTricks(soundsKnown(progress))
  const island = GROUPS.find((g) => g.id === progress.currentGroup) ?? GROUPS[0]
  const todayMin = useMemo(() => {
    const today = dayKey(now)
    return Math.round(sessions.filter((s) => dayKey(s.startedAt) === today).reduce((a, s) => a + s.durationSec, 0) / 60)
  }, [sessions, now])
  const goalDone = todayMin >= progress.dailyGoalMin
  const eggReady = progress.lastEggDay !== dayKey(now)

  useEffect(() => () => stopSpeaking(), [])

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
            <div className="text-3xl font-extrabold text-grape">{progress.childName}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-white px-3 py-1 text-lg font-extrabold text-orange-600 shadow">🔥 {summary.streak}</div>
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
            Lv {lp.level} · {LEVEL_NAMES[lp.level - 1]}
          </div>
          <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-white/70">
            <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${Math.round(lp.fraction * 100)}%` }} />
          </div>
          <div className="text-[11px] font-bold text-ink/50">{lp.next ? `${lp.next - progress.xp} ⭐ to level ${lp.level + 1} · tap me for a trick!` : 'Max level! Tap me for a trick!'}</div>
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
        <button onClick={() => nav('/parent')} className="tile flex-col py-3">
          <span className="text-3xl">👨‍👩‍👧</span>
          <span className="text-xs font-extrabold">Parents</span>
        </button>
      </div>

      <div className="mt-2 text-xl font-extrabold text-ink/70">Your journey</div>
      <div className="flex flex-col gap-2">
        {GROUPS.map((g) => {
          const done = progress.completedGroups.includes(g.id)
          const current = g.id === progress.currentGroup
          const locked = !done && !current
          const learnt = g.gpcIds.filter((id) => progress.gpcs[id]).length
          return (
            <div
              key={g.id}
              className={`flex items-center gap-3 rounded-3xl px-4 py-3 shadow ${locked ? 'opacity-50' : ''} ${current ? 'ring-4 ring-grape' : ''}`}
              style={{ background: done || current ? g.theme.color : '#fff' }}
            >
              <div className="text-4xl">{done ? '✅' : locked ? '🔒' : g.theme.emoji}</div>
              <div className="flex-1">
                <div className="text-lg font-extrabold">{g.title}</div>
                <div className="font-letter text-base font-bold text-ink/70">
                  {g.gpcIds.length ? g.gpcIds.map((id) => id.replace('_long', '').replace('_short', '')).join(' · ') : 'frog · jump · milk'}
                </div>
              </div>
              {g.gpcIds.length > 0 && (
                <div className="text-sm font-extrabold text-ink/60">
                  {learnt}/{g.gpcIds.length}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Screen>
  )
}
