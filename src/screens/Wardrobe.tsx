import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Character } from '../components/Character'
import { Screen, TopBar } from '../components/ui'
import { CHARACTERS } from '../content/characters'
import type { CharacterBase } from '../content/characters'
import { LEVEL_NAMES, PAINTS, SLOTS, SLOT_LABEL, levelProgress, partsForSlot, unlockDescription } from '../content/parts'
import type { Slot } from '../content/parts'
import { useProgress } from '../store/progressStore'
import { sfx } from '../speech/sfx'
import { say } from '../speech/phonics'

type Tab = Slot | 'paint'

/** Mix-and-match wardrobe: one tab per slot, tap a part to wear it. */
export function Wardrobe() {
  const nav = useNavigate()
  const progress = useProgress((s) => s.progress)!
  const equip = useProgress((s) => s.equip)
  const setPaint = useProgress((s) => s.setPaint)
  const setCharacter = useProgress((s) => s.setCharacter)
  const [tab, setTab] = useState<Tab>('color')
  const lp = levelProgress(progress.xp)
  const slot: Slot | null = tab === 'paint' ? null : tab
  const parts = slot ? partsForSlot(slot, progress.character) : []
  const has = (id: string) => progress.unlockedParts.includes(id)
  const unlockedCount = slot ? parts.filter((p) => has(p.id)).length : PAINTS.filter((x) => has(x.id)).length
  const total = slot ? parts.length : PAINTS.length
  const nextPaint = PAINTS.find((x) => !has(x.id))

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
          <button key={c.base} onClick={() => pick(c.base)} className={`tile py-2 text-base font-extrabold leading-tight ${progress.character === c.base ? 'bg-sun ring-4 ring-grape' : ''}`}>
            {c.emoji} {c.name}
          </button>
        ))}
      </div>

      <div className="flex gap-1 rounded-2xl bg-white p-1 shadow-sm">
        {[...SLOTS, 'paint' as const].map((s) => (
          <button key={s} onClick={() => setTab(s)} className={`flex-1 rounded-xl px-1 py-2 text-xs font-extrabold ${tab === s ? 'bg-grape text-white' : 'text-ink/60'}`}>
            {s === 'paint' ? 'Paint' : SLOT_LABEL[s]}
          </button>
        ))}
      </div>
      <div className="text-center text-sm font-bold text-ink/50">
        {unlockedCount} / {total} unlocked
      </div>

      {tab === 'paint' && (
        <div className="flex flex-col gap-4">
          {nextPaint && (
            <div className="text-center text-xs font-bold text-ink/50">
              Next paint: {nextPaint.name} · {unlockDescription(nextPaint.unlock)}
            </div>
          )}
          {(['hat', 'outfit'] as const).map((target) => {
            const current = target === 'hat' ? progress.look.hatPaint : progress.look.outfitPaint
            const wearing = Boolean(progress.look[target])
            return (
              <div key={target} className="rounded-3xl bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-extrabold uppercase text-ink/60">Paint the {target}</div>
                  {!wearing && <div className="text-xs font-bold text-ink/40">Put on a {target} first</div>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      sfx.pop()
                      setPaint(target, null)
                    }}
                    className={`flex h-12 w-12 items-center justify-center rounded-full border-4 bg-white text-xl ${current == null ? 'border-grape' : 'border-ink/10'}`}
                    aria-label="Own colour"
                  >
                    ↺
                  </button>
                  {PAINTS.map((pt) => {
                    const unlocked = has(pt.id)
                    const active = current === pt.id
                    const bg = pt.fill.startsWith('url') ? 'linear-gradient(135deg,#f43f5e,#fbbf24,#22c55e,#38bdf8,#a855f7)' : pt.fill
                    return (
                      <button
                        key={pt.id}
                        disabled={!unlocked}
                        onClick={() => {
                          sfx.star()
                          setPaint(target, pt.id)
                          say(pt.name)
                        }}
                        title={unlocked ? pt.name : unlockDescription(pt.unlock)}
                        className={`relative h-12 w-12 rounded-full border-4 ${active ? 'border-grape scale-110' : 'border-ink/10'} ${unlocked ? '' : 'opacity-40 grayscale'}`}
                        style={{ background: bg }}
                      >
                        {!unlocked && <span className="absolute inset-0 flex items-center justify-center text-base">🔒</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {slot && (
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
      )}
    </Screen>
  )
}
