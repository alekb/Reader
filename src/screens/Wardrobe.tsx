import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Character } from '../components/Character'
import { Screen, TopBar } from '../components/ui'
import { CHARACTERS, SKINS, unlockDescription } from '../content/characters'
import type { CharacterBase } from '../content/characters'
import { useProgress } from '../store/progressStore'
import { sfx } from '../speech/sfx'
import { say } from '../speech/phonics'

export function Wardrobe() {
  const nav = useNavigate()
  const progress = useProgress((s) => s.progress)!
  const setSkin = useProgress((s) => s.setSkin)
  const setCharacter = useProgress((s) => s.setCharacter)
  const [tab, setTab] = useState<CharacterBase>(progress.character)
  const skins = SKINS.filter((s) => s.base === tab)

  return (
    <Screen className="gap-4 px-4 pb-10">
      <TopBar title="Looks" onBack={() => nav('/')} />
      <div className="flex justify-center">
        <Character base={progress.character} skinId={progress.skinId} mood="happy" size={150} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {CHARACTERS.map((c) => (
          <button
            key={c.base}
            onClick={() => {
              sfx.pop()
              setTab(c.base)
              setCharacter(c.base)
              say(`${c.name}!`)
            }}
            className={`tile py-2 text-lg font-extrabold ${tab === c.base ? 'bg-sun ring-4 ring-grape' : ''}`}
          >
            {c.emoji} {c.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {skins.map((s) => {
          const unlocked = progress.unlockedSkins.includes(s.id)
          const wearing = progress.skinId === s.id
          return (
            <button
              key={s.id}
              disabled={!unlocked}
              onClick={() => {
                sfx.star()
                setSkin(s.id)
                say(s.name)
              }}
              className={`tile flex-col gap-1 p-3 ${wearing ? 'ring-4 ring-grape bg-sun' : ''} ${unlocked ? '' : 'opacity-60'}`}
            >
              <div className={unlocked ? '' : 'grayscale'}>
                <Character base={s.base} skinId={s.id} size={100} />
              </div>
              <div className="text-base font-extrabold">{unlocked ? s.name : '🔒 ' + s.name}</div>
              <div className="text-xs font-bold text-ink/50">{unlocked ? (wearing ? 'Wearing' : 'Tap to wear') : unlockDescription(s.unlock)}</div>
            </button>
          )
        })}
      </div>
    </Screen>
  )
}
