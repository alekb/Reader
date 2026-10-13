import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GPC_BY_ID, GROUPS } from '../content/gpcs'
import { SKIN_BY_ID } from '../content/characters'
import { Character } from '../components/Character'
import { Confetti, Screen } from '../components/ui'
import { useProgress } from '../store/progressStore'
import { say } from '../speech/phonics'
import { sfx } from '../speech/sfx'
import { stopSpeaking } from '../speech/tts'

/** Step 8: close. Effort-based rewards, never accuracy. End on a high note. */
export function SessionComplete() {
  const nav = useNavigate()
  const summary = useProgress((s) => s.lastSummary)
  const progress = useProgress((s) => s.progress)
  const setSkin = useProgress((s) => s.setSkin)

  useEffect(() => {
    stopSpeaking()
    if (summary?.unlockedSkinIds.length) sfx.unlock()
    else sfx.fanfare()
    const t = setTimeout(() => {
      const name = progress?.childName ?? ''
      say(`Great work, ${name}! You earned ${summary?.log.xpEarned ?? 0} stars.`)
      if (summary?.unlockedSkinIds.length) say('You unlocked a new look!')
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!summary || !progress) {
    nav('/')
    return null
  }
  const { log } = summary
  const newGroups = summary.completedGroups.map((id) => GROUPS.find((g) => g.id === id)!).filter(Boolean)
  const newSkins = summary.unlockedSkinIds.map((id) => SKIN_BY_ID[id]).filter(Boolean)

  return (
    <Screen className="items-center gap-4 px-4 pb-10 pt-8">
      <Confetti />
      <Character base={progress.character} skinId={progress.skinId} mood="happy" size={170} />
      <h1 className="text-4xl font-extrabold text-grape">Session done!</h1>
      <div className="grid w-full grid-cols-3 gap-3">
        <Stat label="stars" value={`⭐ ${log.xpEarned}`} />
        <Stat label="words read" value={`📖 ${log.wordsRead}`} />
        <Stat label="minutes" value={`⏱️ ${Math.max(1, Math.round(log.durationSec / 60))}`} />
      </div>
      {log.newGpcs.length > 0 && (
        <div className="w-full rounded-3xl bg-white p-4 text-center shadow">
          <div className="text-sm font-bold uppercase text-ink/50">New sound</div>
          <div className="font-letter text-6xl font-bold">{log.newGpcs.map((id) => GPC_BY_ID[id]?.grapheme ?? id).join(' ')}</div>
          <div className="text-3xl">{log.newGpcs.map((id) => GPC_BY_ID[id]?.emoji).join(' ')}</div>
        </div>
      )}
      {log.newTricky.length > 0 && (
        <div className="w-full rounded-3xl bg-white p-4 text-center shadow">
          <div className="text-sm font-bold uppercase text-ink/50">New heart word ❤️</div>
          <div className="font-letter text-5xl font-bold text-rose-600">{log.newTricky.join(' ')}</div>
        </div>
      )}
      {newGroups.map((g) => (
        <div key={g.id} className="w-full rounded-3xl p-4 text-center shadow" style={{ background: g.theme.color }}>
          <div className="text-5xl">{g.theme.emoji}</div>
          <div className="text-2xl font-extrabold">{g.title} complete!</div>
          <div className="font-bold text-ink/70">+50 ⭐ bonus</div>
        </div>
      ))}
      {newSkins.map((s) => (
        <button key={s.id} onClick={() => setSkin(s.id)} className="tile w-full flex-col gap-1 p-4">
          <div className="text-sm font-bold uppercase text-ink/50">New look unlocked!</div>
          <Character base={s.base} skinId={s.id} mood="happy" size={110} />
          <div className="text-2xl font-extrabold">{s.name}</div>
          <div className="text-sm font-bold text-grape">{progress.skinId === s.id ? 'Wearing it!' : 'Tap to wear it'}</div>
        </button>
      ))}
      <div className="text-lg font-bold text-ink/60">🔥 {progress.streak.count}-day streak</div>
      <button onClick={() => nav('/')} className="btn btn-primary mt-2 w-full">
        Done ✓
      </button>
    </Screen>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white p-3 text-center shadow">
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-xs font-bold uppercase text-ink/50">{label}</div>
    </div>
  )
}
