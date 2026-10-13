import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Character } from './Character'
import type { Mood } from './Character'
import { useProgress } from '../store/progressStore'

export function TopBar({ title, onBack, right, progress }: { title?: string; onBack?: () => void; right?: ReactNode; progress?: number }) {
  return (
    <div className="safe-top sticky top-0 z-20 bg-cream/90 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3">
        {onBack && (
          <button onClick={onBack} aria-label="Back" className="tile h-12 w-12 text-2xl">
            ←
          </button>
        )}
        <div className="flex-1 text-xl font-extrabold text-ink/80">{title}</div>
        {right}
      </div>
      {progress != null && (
        <div className="mx-4 mb-2 h-3 overflow-hidden rounded-full bg-ink/10">
          <div className="h-full rounded-full bg-leaf transition-all duration-500" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
    </div>
  )
}

/** The mascot with a speech bubble. */
export function Mascot({ text, mood = 'idle', size = 120, onTap }: { text?: string; mood?: Mood; size?: number; onTap?: () => void }) {
  const progress = useProgress((s) => s.progress)
  if (!progress) return null
  return (
    <div className="flex items-end gap-2" onClick={onTap}>
      <Character base={progress.character} skinId={progress.skinId} mood={mood} size={size} />
      {text && (
        <div className="relative mb-6 max-w-[60vw] rounded-3xl bg-white px-4 py-3 text-lg font-bold text-ink shadow-md">
          <span className="absolute -left-2 bottom-4 h-4 w-4 rotate-45 bg-white" />
          {text}
        </div>
      )}
    </div>
  )
}

export function SpeakerButton({ onClick, size = 'lg', label = 'Hear it again' }: { onClick: () => void; size?: 'sm' | 'lg'; label?: string }) {
  return (
    <button onClick={onClick} aria-label={label} className={`tile ${size === 'lg' ? 'h-20 w-20 text-4xl' : 'h-12 w-12 text-2xl'} bg-sky text-white`}>
      🔊
    </button>
  )
}

export function Confetti({ count = 40 }: { count?: number }) {
  const pieces = useMemo(() => {
    const colors = ['#fde68a', '#fb7185', '#38bdf8', '#22c55e', '#a78bfa', '#f97316']
    return Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      color: colors[i % colors.length],
      size: 8 + Math.random() * 8,
      rot: Math.random() * 360,
    }))
  }, [count])
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p, i) => (
        <div
          key={i}
          className="confetti"
          style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, width: p.size, height: p.size * 0.6, background: p.color, transform: `rotate(${p.rot}deg)`, borderRadius: 2 }}
        />
      ))}
    </div>
  )
}

/** A "+2 ⭐" that floats up and fades. */
export function FloatingStars({ amount, trigger }: { amount: number; trigger: number }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!trigger) return
    setShow(true)
    const t = setTimeout(() => setShow(false), 1000)
    return () => clearTimeout(t)
  }, [trigger])
  if (!show) return null
  return <div className="animate-float-up pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 text-3xl font-extrabold text-amber-500">+{amount} ⭐</div>
}

export function StarCount({ xp }: { xp: number }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-lg font-extrabold text-amber-600 shadow">
      ⭐ {xp}
    </div>
  )
}

export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto flex min-h-full w-full max-w-md flex-col ${className}`}>{children}</div>
}

/** Render a word with its graphemes as separate, tappable, highlightable tiles. */
export function GraphemeTiles({
  segments,
  active,
  onTap,
  size = 'lg',
  colorize = true,
}: {
  segments: string[]
  active?: number | null
  onTap?: (i: number) => void
  size?: 'md' | 'lg'
  colorize?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {segments.map((seg, i) => (
        <button
          key={i}
          onClick={() => onTap?.(i)}
          className={`tile font-letter ${size === 'lg' ? 'min-w-16 px-3 py-2 text-5xl' : 'min-w-12 px-2 py-1 text-3xl'} font-bold ${
            active === i ? 'bg-sun scale-110' : ''
          } ${colorize && seg.length > 1 ? 'text-grape' : ''}`}
          style={{ transition: 'transform 120ms' }}
        >
          {seg}
        </button>
      ))}
    </div>
  )
}

/** Display form of a grapheme id for a split digraph ("a_e" -> "a‿e"). */
export function graphemeLabel(id: string, grapheme: string): string {
  if (id.endsWith('_e')) return `${id[0]}_e`
  return grapheme
}
