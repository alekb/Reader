import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Character } from '../components/Character'
import { Screen, TopBar } from '../components/ui'
import { CHARACTERS } from '../content/characters'
import type { CharacterBase } from '../content/characters'
import { LEVEL_NAMES, SLOTS, SLOT_LABEL, levelProgress, partsForSlot, unlockDescription } from '../content/parts'
import type { Slot } from '../content/parts'
import { useProgress } from '../store/progressStore'
import { sfx } from '../speech/sfx'
import { say } from '../speech/phonics'

/** Mix-and-match wardrobe: one tab per slot, tap a part to wear it. */
export function Wardrobe() {
  const nav = useNavigate()
  const progress = useProgress((s) => s.progress)!
  const equip = useProgress((s) => s.equip)
  const setCharacter = useProgress((s) => s.setCharacter)
  const [slot, setSlot] = useState<Slot>('color')
  const lp = levelProgress(progress.xp)
  const parts = partsForSlot(slot, progress.character)
  const unlockedCount = parts.filter((p) => progress.unlockedParts.includes(p.id)).length

  const pick = (base: CharacterBase) => {
    sfx.pop()
    setCharacter(base)
    const c = CHARACTERS.find((x) => x.base === base)!
    say(`${c.name}!`)
  }

  return (
    <Screen className="gap-4 px-4 pb-10">
      <TopBar title="Looks" onBack={() => nav('/')} />
      <div className="flex flex-col items-center">
        <Character base={progress.character} look={progress.look} level={lp.level} mood="happy" size={170} />
        <div className="mt-1 rounded-full bg-white px-3 py-1 text-sm font-extrabold text-grape shadow">
          Level {lp.level} · {LEVEL_NAMES[lp.level - 1]}
        </div>
        <div className="mt-2 h-3 w-48 overflow-hidden rounded-full bg-ink/10">
          <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.round(lp.fraction * 100)}%` }} />
        </div>
        <div className="text-xs font-bold text-ink/50">{lp.next ? `${lp.next - progress.xp} ⭐ to level ${lp.level + 1}` : 'Max level!'}</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {CHARACTERS.map((c) => (
          <button key={c.base} onClick={() => pick(c.base)} className={`tile py-2 text-lg font-extrabold ${progress.character === c.base ? 'bg-sun ring-4 ring-grape' : ''}`}>
            {c.emoji} {c.name}
          </button>
        ))}
      </div>

      <div className="flex gap-1 rounded-2xl bg-white p-1 shadow-sm">
        {SLOTS.map((s) => (
          <button key={s} onClick={() => setSlot(s)} className={`flex-1 rounded-xl px-1 py-2 text-sm font-extrabold ${slot === s ? 'bg-grape text-white' : 'text-ink/60'}`}>
            {SLOT_LABEL[s]}
          </button>
        ))}
      </div>
      <div className="text-center text-sm font-bold text-ink/50">
        {unlockedCount} / {parts.length} unlocked
      </div>

      <div className="grid grid-cols-3 gap-3">
        {slot !== 'color' && (
          <button
            onClick={() => {
              sfx.pop()
              equip(slot, null)
            }}
            className={`tile flex-col gap-1 p-3 ${progress.look[slot] === null ? 'ring-4 ring-grape bg-sun' : ''}`}
          >
            <div className="text-4xl">🚫</div>
            <div className="text-sm font-extrabold">None</div>
          </button>
        )}
        {parts.map((p) => {
          const unlocked = progress.unlockedParts.includes(p.id)
          const wearing = progress.look[slot] === p.id
          return (
            <button
              key={p.id}
              disabled={!unlocked}
              onClick={() => {
                sfx.star()
                equip(slot, p.id)
                say(p.name)
              }}
              className={`tile flex-col gap-1 p-2 ${wearing ? 'ring-4 ring-grape bg-sun' : ''} ${unlocked ? '' : 'opacity-60'}`}
            >
              {slot === 'color' ? (
                <div className={unlocked ? '' : 'grayscale'}>
                  <Character base={progress.character} look={{ ...progress.look, color: p.id }} level={lp.level} size={64} />
                </div>
              ) : (
                <div className={`flex h-16 w-16 items-center justify-center text-4xl ${unlocked ? '' : 'grayscale'}`}>{p.icon}</div>
              )}
              <div className="text-xs font-extrabold leading-tight">{unlocked ? p.name : '🔒 ' + p.name}</div>
              {!unlocked && <div className="text-[10px] font-bold leading-tight text-ink/50">{unlockDescription(p.unlock)}</div>}
            </button>
          )
        })}
      </div>
    </Screen>
  )
}
