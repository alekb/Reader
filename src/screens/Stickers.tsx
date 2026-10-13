import { useNavigate } from 'react-router-dom'
import { Screen, TopBar } from '../components/ui'
import { STICKERS } from '../content/stickers'
import { useProgress } from '../store/progressStore'
import { say } from '../speech/phonics'
import { sfx } from '../speech/sfx'

/** The sticker book: one surprise egg hatches after the first session each day. */
export function Stickers() {
  const nav = useNavigate()
  const progress = useProgress((s) => s.progress)!
  const owned = new Set(progress.stickers)
  return (
    <Screen className="gap-4 px-4 pb-10">
      <TopBar title="Sticker book" onBack={() => nav('/')} right={<div className="text-sm font-extrabold text-ink/60">{owned.size} / {STICKERS.length}</div>} />
      <div className="rounded-2xl bg-white/70 px-4 py-2 text-center text-sm font-bold text-ink/60">
        🥚 Finish your first session each day to hatch a surprise egg!
      </div>
      <div className="grid grid-cols-5 gap-2">
        {STICKERS.map((st) => {
          const has = owned.has(st.id)
          return (
            <button
              key={st.id}
              onClick={() => {
                if (!has) return
                sfx.pop()
                say(st.name)
              }}
              className={`tile aspect-square flex-col ${has ? '' : 'bg-white/50'}`}
              title={has ? st.name : '?'}
            >
              <span className="text-4xl">{has ? st.emoji : '❓'}</span>
              {st.weight === 1 && has && <span className="text-[9px] font-extrabold text-amber-600">RARE</span>}
            </button>
          )
        })}
      </div>
    </Screen>
  )
}
