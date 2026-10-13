import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GPC_BY_ID, GROUPS } from '../content/gpcs'
import { LEVEL_NAMES, PAINT_BY_ID, PART_BY_ID, levelFor } from '../content/parts'
import { STICKER_BY_ID } from '../content/stickers'
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
  const equip = useProgress((s) => s.equip)
  const hatchEgg = useProgress((s) => s.hatchEgg)
  const [hatched, setHatched] = useState<string | null>(null)
  const [eggGone, setEggGone] = useState(false)

  useEffect(() => {
    stopSpeaking()
    if (summary?.levelUp) sfx.unlock()
    else if (summary?.unlockedPartIds.length) sfx.unlock()
    else sfx.fanfare()
    const t = setTimeout(() => {
      const name = progress?.childName ?? ''
      say(`Great work, ${name}! You earned ${summary?.log.xpEarned ?? 0} stars.`)
      if (summary?.levelUp) {
        say('Level up!')
        say(`Level ${summary.levelUp}, ${LEVEL_NAMES[summary.levelUp - 1]}!`)
      }
      if (summary?.unlockedPartIds.length) say('You unlocked something new!')
      if (summary?.eggAvailable) say('A surprise egg! Tap it to hatch it.')
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!summary || !progress) {
    nav('/')
    return null
  }
  const { log } = summary
  const level = levelFor(progress.xp)
  const newGroups = summary.completedGroups.map((id) => GROUPS.find((g) => g.id === id)!).filter(Boolean)
  const newParts = summary.unlockedPartIds.map((id) => PART_BY_ID[id]).filter((p) => p && (!p.base || p.base === progress.character))
  const newPaints = summary.unlockedPartIds.map((id) => PAINT_BY_ID[id]).filter(Boolean)
  const showEgg = summary.eggAvailable && !eggGone

  const hatch = () => {
    const id = hatchEgg()
    sfx.unlock()
    setEggGone(true)
    if (id) {
      setHatched(id)
      say(`A ${STICKER_BY_ID[id]?.name ?? 'sticker'} sticker!`)
    }
  }

  return (
    <Screen className="items-center gap-4 px-4 pb-10 pt-8">
      <Confetti />
      <Character base={progress.character} look={progress.look} level={level} mood="happy" size={170} />
      <h1 className="text-4xl font-extrabold text-grape">Session done!</h1>
      <div className="grid w-full grid-cols-3 gap-3">
        <Stat label="stars" value={`⭐ ${log.xpEarned}`} />
        <Stat label="words read" value={`📖 ${log.wordsRead}`} />
        <Stat label="minutes" value={`⏱️ ${Math.max(1, Math.round(log.durationSec / 60))}`} />
      </div>

      {summary.levelUp && (
        <div className="w-full rounded-3xl bg-gradient-to-r from-amber-200 to-pink-200 p-4 text-center shadow animate-pop">
          <div className="text-sm font-bold uppercase text-ink/60">Level up!</div>
          <div className="text-3xl font-extrabold">
            Level {summary.levelUp} · {LEVEL_NAMES[summary.levelUp - 1]}
          </div>
          <div className="font-bold text-ink/70">Your buddy grew!</div>
        </div>
      )}

      {showEgg && (
        <button onClick={hatch} className="tile w-full flex-col gap-1 bg-gradient-to-b from-sky-100 to-white p-4">
          <div className="text-sm font-bold uppercase text-ink/50">Surprise egg</div>
          <div className="animate-egg text-7xl">🥚</div>
          <div className="text-lg font-extrabold text-grape">Tap to hatch!</div>
        </button>
      )}
      {hatched && (
        <button onClick={() => nav('/stickers')} className="tile w-full flex-col gap-1 p-4">
          <div className="text-sm font-bold uppercase text-ink/50">New sticker!</div>
          <div className="animate-hatch text-7xl">{STICKER_BY_ID[hatched]?.emoji}</div>
          <div className="text-2xl font-extrabold">{STICKER_BY_ID[hatched]?.name}</div>
          <div className="text-xs font-bold text-grape">{progress.stickers.length} in your sticker book</div>
        </button>
      )}

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
      {newParts.map((p) => {
        const wearing = progress.look[p.slot] === p.id
        const preview = { ...progress.look, [p.slot]: p.id }
        return (
          <button
            key={p.id}
            onClick={() => {
              sfx.star()
              equip(p.slot, p.id)
            }}
            className={`tile w-full flex-col gap-1 p-4 ${wearing ? 'ring-4 ring-grape bg-sun' : ''}`}
          >
            <div className="text-sm font-bold uppercase text-ink/50">New {p.slot} unlocked!</div>
            <Character base={progress.character} look={preview} level={level} mood="happy" size={110} />
            <div className="text-2xl font-extrabold">
              {p.icon} {p.name}
            </div>
            <div className="text-sm font-bold text-grape">{wearing ? 'Wearing it!' : 'Tap to wear it'}</div>
          </button>
        )
      })}
      {newPaints.length > 0 && (
        <button onClick={() => nav('/wardrobe')} className="tile w-full flex-col gap-2 p-4">
          <div className="text-sm font-bold uppercase text-ink/50">New paint unlocked!</div>
          <div className="flex gap-3">
            {newPaints.map((pt) => (
              <span key={pt.id} className="h-12 w-12 rounded-full border-4" style={{ background: pt.fill.startsWith('url') ? 'linear-gradient(135deg,#f43f5e,#fbbf24,#22c55e,#38bdf8,#a855f7)' : pt.fill, borderColor: pt.stroke }} />
            ))}
          </div>
          <div className="text-2xl font-extrabold">{newPaints.map((pt) => pt.name).join(', ')}</div>
          <div className="text-sm font-bold text-grape">Paint your hat or outfit in Looks</div>
        </button>
      )}
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
