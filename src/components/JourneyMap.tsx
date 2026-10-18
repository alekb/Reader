import { Character } from './Character'
import type { CharacterBase } from '../content/characters'
import type { GpcGroup } from '../content/gpcs'
import type { Look } from '../content/parts'

interface Props {
  groups: GpcGroup[]
  completed: number[]
  current: number
  /** Sounds learnt per island id. */
  learnt: (g: GpcGroup) => number
  buddy: { base: CharacterBase; look: Look; level: number }
}

// The map is laid out in a 360-wide box that scales with the screen, so the path and the islands stay aligned.
const W = 360
const ROW = 118
const TOP = 52
/** Islands snake left → middle → right → middle. */
const XS = [0.22, 0.5, 0.78, 0.5]

/** The islands as a winding path: the stretch already travelled is drawn solid, the buddy stands on the current island. */
export function JourneyMap({ groups, completed, current, learnt, buddy }: Props) {
  const pts = groups.map((_, i) => ({ x: XS[i % XS.length] * W, y: TOP + i * ROW }))
  const h = TOP + (groups.length - 1) * ROW + 70
  const at = Math.max(0, groups.findIndex((g) => g.id === current))
  const curve = (from: number, to: number) =>
    pts.slice(from, to + 1).reduce((d, p, i, a) => (i === 0 ? `M${p.x} ${p.y}` : `${d} C${a[i - 1].x} ${a[i - 1].y + ROW / 2}, ${p.x} ${p.y - ROW / 2}, ${p.x} ${p.y}`), '')

  return (
    <div className="relative w-full" style={{ aspectRatio: `${W} / ${h}` }}>
      <svg viewBox={`0 0 ${W} ${h}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
        <path d={curve(at, groups.length - 1)} fill="none" stroke="#1e1b4b" strokeOpacity={0.18} strokeWidth={6} strokeDasharray="2 14" strokeLinecap="round" />
        {at > 0 && <path d={curve(0, at)} fill="none" stroke="#7c3aed" strokeWidth={8} strokeLinecap="round" />}
      </svg>
      <ol className="absolute inset-0" aria-label="Your journey">
        {groups.map((g, i) => {
          const done = completed.includes(g.id)
          const here = g.id === current
          const locked = !done && !here
          const p = pts[i]
          const buddyRight = p.x <= W / 2
          return (
            <li
              key={g.id}
              className="absolute flex w-32 -translate-x-1/2 -translate-y-8 flex-col items-center text-center"
              style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / h) * 100}%` }}
              aria-label={`${g.title}: ${done ? 'done' : here ? 'you are here' : 'locked'}`}
            >
              <div
                className={`relative flex h-16 w-16 items-center justify-center rounded-full text-4xl shadow ${here ? 'ring-4 ring-grape' : ''} ${locked ? 'bg-white opacity-60 grayscale' : ''}`}
                style={locked ? undefined : { background: g.theme.color }}
              >
                {locked ? '🔒' : g.theme.emoji}
                {done && <span className="absolute -right-1 -top-1 text-xl">✅</span>}
              </div>
              <div className={`mt-1 rounded-full bg-cream/90 px-2 text-sm font-extrabold leading-tight ${locked ? 'text-ink/40' : ''}`}>{g.title}</div>
              {here && g.gpcIds.length > 0 && (
                <div className="text-xs font-extrabold text-grape">
                  {learnt(g)}/{g.gpcIds.length} sounds
                </div>
              )}
              {here && (
                <div className={`pointer-events-none absolute top-0 ${buddyRight ? 'left-[5.5rem]' : 'right-[5.5rem]'}`}>
                  <Character base={buddy.base} look={buddy.look} level={buddy.level} size={64} />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
