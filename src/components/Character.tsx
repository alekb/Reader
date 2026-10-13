import { useEffect, useState } from 'react'
import type { CharacterBase, Skin } from '../content/characters'
import { SKIN_BY_ID, defaultSkin } from '../content/characters'

export type Mood = 'idle' | 'happy' | 'thinking' | 'sad' | 'talking'

interface Props {
  base: CharacterBase
  skinId?: string
  mood?: Mood
  size?: number
  className?: string
}

/** The three mascots, drawn in SVG so skins are just colours + accessories. */
export function Character({ base, skinId, mood = 'idle', size = 160, className = '' }: Props) {
  const skin: Skin = (skinId && SKIN_BY_ID[skinId]) || defaultSkin(base)
  const [blink, setBlink] = useState(false)
  useEffect(() => {
    let alive = true
    const loop = () => {
      if (!alive) return
      setBlink(true)
      setTimeout(() => alive && setBlink(false), 140)
      setTimeout(loop, 2200 + Math.random() * 2500)
    }
    const t = setTimeout(loop, 1200)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [])

  const anim = mood === 'happy' ? 'animate-bounce-soft' : mood === 'thinking' ? 'animate-wiggle' : mood === 'talking' ? 'animate-bounce-soft' : ''
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={`${anim} ${className}`}
      role="img"
      aria-label={`${base} mascot`}
      style={{ overflow: 'visible' }}
    >
      {base === 'robot' && <Robot skin={skin} mood={mood} blink={blink} />}
      {base === 'dragon' && <Dragon skin={skin} mood={mood} blink={blink} />}
      {base === 'monster' && <Monster skin={skin} mood={mood} blink={blink} />}
      <Accessory kind={skin.accessory ?? 'none'} base={base} />
    </svg>
  )
}

function Eyes({ cx1, cx2, cy, r, blink, mood, color = '#1e1b4b' }: { cx1: number; cx2: number; cy: number; r: number; blink: boolean; mood: Mood; color?: string }) {
  if (blink) {
    return (
      <g stroke={color} strokeWidth={4} strokeLinecap="round">
        <line x1={cx1 - r} y1={cy} x2={cx1 + r} y2={cy} />
        <line x1={cx2 - r} y1={cy} x2={cx2 + r} y2={cy} />
      </g>
    )
  }
  const sad = mood === 'sad'
  return (
    <g>
      <circle cx={cx1} cy={cy} r={r} fill="white" />
      <circle cx={cx2} cy={cy} r={r} fill="white" />
      <circle cx={cx1 + (mood === 'thinking' ? 3 : 0)} cy={cy + (sad ? 2 : 0)} r={r * 0.5} fill={color} />
      <circle cx={cx2 + (mood === 'thinking' ? 3 : 0)} cy={cy + (sad ? 2 : 0)} r={r * 0.5} fill={color} />
      <circle cx={cx1 + 2} cy={cy - 3} r={r * 0.18} fill="white" />
      <circle cx={cx2 + 2} cy={cy - 3} r={r * 0.18} fill="white" />
      {sad && (
        <g stroke={color} strokeWidth={3} strokeLinecap="round" fill="none">
          <path d={`M${cx1 - r} ${cy - r - 4} q ${r} -6 ${2 * r} 2`} />
          <path d={`M${cx2 - r} ${cy - r - 2} q ${r} -6 ${2 * r} 4`} />
        </g>
      )}
    </g>
  )
}

function Mouth({ cx, cy, mood, color = '#1e1b4b', width = 30 }: { cx: number; cy: number; mood: Mood; color?: string; width?: number }) {
  const w = width / 2
  if (mood === 'happy') return <path d={`M${cx - w} ${cy} q ${w} ${w * 1.2} ${2 * w} 0 z`} fill="#be185d" stroke={color} strokeWidth={3} strokeLinejoin="round" />
  if (mood === 'sad') return <path d={`M${cx - w} ${cy + 8} q ${w} -${w * 0.8} ${2 * w} 0`} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" />
  if (mood === 'talking') return <ellipse cx={cx} cy={cy + 3} rx={w * 0.55} ry={w * 0.45} fill="#be185d" stroke={color} strokeWidth={3} />
  if (mood === 'thinking') return <path d={`M${cx - w * 0.6} ${cy + 4} q ${w * 0.6} -6 ${w * 1.2} 2`} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" />
  return <path d={`M${cx - w} ${cy} q ${w} ${w * 0.7} ${2 * w} 0`} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" />
}

function Robot({ skin, mood, blink }: { skin: Skin; mood: Mood; blink: boolean }) {
  return (
    <g>
      {/* antenna */}
      <line x1={100} y1={38} x2={100} y2={18} stroke="#475569" strokeWidth={5} strokeLinecap="round" />
      <circle cx={100} cy={14} r={8} fill="#fde68a" stroke="#475569" strokeWidth={3} className={mood === 'happy' ? 'animate-pop' : ''} />
      {/* body */}
      <rect x={55} y={120} width={90} height={60} rx={16} fill={skin.body} stroke="#1e1b4b" strokeWidth={4} />
      <rect x={75} y={132} width={50} height={34} rx={8} fill={skin.accent} stroke="#1e1b4b" strokeWidth={3} />
      <circle cx={88} cy={149} r={5} fill="#22c55e" />
      <circle cx={100} cy={149} r={5} fill="#fbbf24" />
      <circle cx={112} cy={149} r={5} fill="#fb7185" />
      {/* arms */}
      <rect x={30} y={128} width={24} height={14} rx={7} fill={skin.body} stroke="#1e1b4b" strokeWidth={3} />
      <rect x={146} y={128} width={24} height={14} rx={7} fill={skin.body} stroke="#1e1b4b" strokeWidth={3} />
      {/* legs */}
      <rect x={68} y={178} width={22} height={14} rx={6} fill="#475569" />
      <rect x={110} y={178} width={22} height={14} rx={6} fill="#475569" />
      {/* head */}
      <rect x={45} y={38} width={110} height={82} rx={24} fill={skin.body} stroke="#1e1b4b" strokeWidth={4} />
      <rect x={58} y={52} width={84} height={54} rx={16} fill={skin.accent} />
      <rect x={38} y={66} width={12} height={22} rx={5} fill="#475569" />
      <rect x={150} y={66} width={12} height={22} rx={5} fill="#475569" />
      <Eyes cx1={80} cx2={120} cy={74} r={12} blink={blink} mood={mood} />
      <Mouth cx={100} cy={94} mood={mood} />
    </g>
  )
}

function Dragon({ skin, mood, blink }: { skin: Skin; mood: Mood; blink: boolean }) {
  return (
    <g>
      {/* tail */}
      <path d="M70 160 q -40 10 -42 -20 q 0 -14 12 -16" fill="none" stroke={skin.body} strokeWidth={14} strokeLinecap="round" />
      <path d="M70 160 q -40 10 -42 -20 q 0 -14 12 -16" fill="none" stroke="#1e1b4b" strokeWidth={3} strokeLinecap="round" opacity={0.25} />
      {/* wings */}
      <path d="M60 110 l -34 -30 l 10 34 l -26 -4 l 30 26 z" fill={skin.accent} stroke="#1e1b4b" strokeWidth={3} strokeLinejoin="round" />
      <path d="M140 110 l 34 -30 l -10 34 l 26 -4 l -30 26 z" fill={skin.accent} stroke="#1e1b4b" strokeWidth={3} strokeLinejoin="round" />
      {/* body */}
      <ellipse cx={100} cy={140} rx={46} ry={44} fill={skin.body} stroke="#1e1b4b" strokeWidth={4} />
      <ellipse cx={100} cy={148} rx={28} ry={30} fill={skin.accent} />
      <path d="M88 150 h24 M90 160 h20 M92 170 h16" stroke="#1e1b4b" strokeWidth={2} opacity={0.25} strokeLinecap="round" />
      {/* feet */}
      <ellipse cx={78} cy={184} rx={16} ry={9} fill={skin.body} stroke="#1e1b4b" strokeWidth={3} />
      <ellipse cx={122} cy={184} rx={16} ry={9} fill={skin.body} stroke="#1e1b4b" strokeWidth={3} />
      {/* head */}
      <ellipse cx={100} cy={80} rx={50} ry={44} fill={skin.body} stroke="#1e1b4b" strokeWidth={4} />
      {/* horns */}
      <path d="M62 50 l -10 -26 l 24 14 z" fill="#fde68a" stroke="#1e1b4b" strokeWidth={3} strokeLinejoin="round" />
      <path d="M138 50 l 10 -26 l -24 14 z" fill="#fde68a" stroke="#1e1b4b" strokeWidth={3} strokeLinejoin="round" />
      {/* spikes */}
      <path d="M86 40 l 6 -12 l 6 12 M100 36 l 6 -12 l 6 12" fill={skin.accent} stroke="#1e1b4b" strokeWidth={2} strokeLinejoin="round" />
      {/* snout */}
      <ellipse cx={100} cy={100} rx={30} ry={16} fill={skin.accent} />
      <circle cx={90} cy={98} r={3.5} fill="#1e1b4b" />
      <circle cx={110} cy={98} r={3.5} fill="#1e1b4b" />
      <Eyes cx1={80} cx2={120} cy={74} r={12} blink={blink} mood={mood} />
      <Mouth cx={100} cy={108} mood={mood} width={26} />
      {mood === 'happy' && <path d="M130 100 q 20 -4 28 6 q -12 6 -28 2 z" fill="#f97316" opacity={0.9} className="animate-pop" />}
    </g>
  )
}

function Monster({ skin, mood, blink }: { skin: Skin; mood: Mood; blink: boolean }) {
  const fuzz = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2
    return { x: 100 + Math.cos(a) * 62, y: 110 + Math.sin(a) * 66 }
  })
  return (
    <g>
      {/* fuzzy outline */}
      {fuzz.map((f, i) => (
        <circle key={i} cx={f.x} cy={f.y} r={14} fill={skin.body} stroke="#1e1b4b" strokeWidth={3} />
      ))}
      <ellipse cx={100} cy={110} rx={64} ry={68} fill={skin.body} />
      {/* belly */}
      <ellipse cx={100} cy={140} rx={34} ry={28} fill={skin.accent} />
      {/* feet */}
      <ellipse cx={74} cy={182} rx={18} ry={10} fill={skin.accent} stroke="#1e1b4b" strokeWidth={3} />
      <ellipse cx={126} cy={182} rx={18} ry={10} fill={skin.accent} stroke="#1e1b4b" strokeWidth={3} />
      {/* arms */}
      <path d="M42 120 q -18 10 -14 30" fill="none" stroke={skin.body} strokeWidth={16} strokeLinecap="round" />
      <path d="M158 120 q 18 10 14 30" fill="none" stroke={skin.body} strokeWidth={16} strokeLinecap="round" />
      {/* horns */}
      <path d="M66 52 l -8 -24 l 22 14 z" fill={skin.accent} stroke="#1e1b4b" strokeWidth={3} strokeLinejoin="round" />
      <path d="M134 52 l 8 -24 l -22 14 z" fill={skin.accent} stroke="#1e1b4b" strokeWidth={3} strokeLinejoin="round" />
      {/* big eye + small eye */}
      <Eyes cx1={82} cx2={122} cy={88} r={16} blink={blink} mood={mood} />
      {/* teeth */}
      <Mouth cx={100} cy={118} mood={mood} width={40} />
      {mood !== 'happy' && mood !== 'talking' && (
        <g fill="white" stroke="#1e1b4b" strokeWidth={2}>
          <path d="M88 118 l 5 9 l 5 -9 z" />
          <path d="M104 118 l 5 9 l 5 -9 z" />
        </g>
      )}
    </g>
  )
}

function Accessory({ kind, base }: { kind: NonNullable<Skin['accessory']>; base: CharacterBase }) {
  const top = base === 'robot' ? 38 : base === 'dragon' ? 44 : 46
  const eyeY = base === 'monster' ? 88 : 74
  switch (kind) {
    case 'crown':
      return (
        <g>
          <path d={`M66 ${top - 2} l 0 -26 l 16 14 l 18 -22 l 18 22 l 16 -14 l 0 26 z`} fill="#fbbf24" stroke="#92400e" strokeWidth={3} strokeLinejoin="round" />
          <circle cx={82} cy={top - 14} r={3.5} fill="#ef4444" />
          <circle cx={100} cy={top - 20} r={3.5} fill="#3b82f6" />
          <circle cx={118} cy={top - 14} r={3.5} fill="#22c55e" />
        </g>
      )
    case 'glasses':
      return (
        <g fill="none" stroke="#1e1b4b" strokeWidth={4}>
          <circle cx={80} cy={eyeY} r={17} fill="rgba(56,189,248,0.25)" />
          <circle cx={120} cy={eyeY} r={17} fill="rgba(56,189,248,0.25)" />
          <line x1={97} y1={eyeY} x2={103} y2={eyeY} />
          <line x1={63} y1={eyeY - 4} x2={50} y2={eyeY - 8} />
          <line x1={137} y1={eyeY - 4} x2={150} y2={eyeY - 8} />
        </g>
      )
    case 'cap':
      return (
        <g>
          <path d={`M58 ${top + 2} a 42 34 0 0 1 84 0 z`} fill="#ef4444" stroke="#7f1d1d" strokeWidth={3} />
          <rect x={92} y={top - 36} width={16} height={14} rx={4} fill="#ef4444" stroke="#7f1d1d" strokeWidth={3} />
          <path d={`M100 ${top + 2} h 60 a 8 8 0 0 1 0 12 h -60 z`} fill="#b91c1c" stroke="#7f1d1d" strokeWidth={3} />
        </g>
      )
    case 'wizard':
      return (
        <g>
          <path d={`M60 ${top + 4} l 40 -70 l 40 70 z`} fill="#4c1d95" stroke="#1e1b4b" strokeWidth={3} strokeLinejoin="round" />
          <ellipse cx={100} cy={top + 4} rx={52} ry={9} fill="#4c1d95" stroke="#1e1b4b" strokeWidth={3} />
          <text x={92} y={top - 18} fontSize={18} fill="#fde68a">★</text>
          <text x={102} y={top - 36} fontSize={12} fill="#fde68a">★</text>
        </g>
      )
    case 'headphones':
      return (
        <g fill="none" stroke="#1e1b4b" strokeWidth={5} strokeLinecap="round">
          <path d={`M50 ${eyeY} a 50 50 0 0 1 100 0`} />
          <rect x={38} y={eyeY - 8} width={18} height={28} rx={7} fill="#f472b6" />
          <rect x={144} y={eyeY - 8} width={18} height={28} rx={7} fill="#f472b6" />
        </g>
      )
    case 'bow':
      return (
        <g>
          <path d={`M126 ${top - 2} l -22 -12 l 0 24 z`} fill="#ec4899" stroke="#9d174d" strokeWidth={3} strokeLinejoin="round" />
          <path d={`M126 ${top - 2} l 22 -12 l 0 24 z`} fill="#ec4899" stroke="#9d174d" strokeWidth={3} strokeLinejoin="round" />
          <circle cx={126} cy={top - 2} r={5} fill="#fbcfe8" stroke="#9d174d" strokeWidth={2} />
        </g>
      )
    case 'pirate':
      return (
        <g>
          <path d={`M46 ${top + 6} q 54 -40 108 0 l -8 -4 q -46 -30 -92 0 z`} fill="#111827" stroke="#000" strokeWidth={2} />
          <path d={`M44 ${top + 6} h 112`} stroke="#111827" strokeWidth={10} strokeLinecap="round" />
          <text x={92} y={top - 2} fontSize={16} fill="white">☠</text>
          <circle cx={120} cy={eyeY} r={14} fill="#111827" />
          <line x1={132} y1={eyeY - 8} x2={60} y2={top + 4} stroke="#111827" strokeWidth={3} />
        </g>
      )
    case 'astro':
      return (
        <g>
          <ellipse cx={100} cy={eyeY + 6} rx={64} ry={58} fill="rgba(191,219,254,0.35)" stroke="#e5e7eb" strokeWidth={5} />
          <path d={`M46 ${eyeY + 20} a 54 48 0 0 1 20 -54`} fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" opacity={0.8} />
        </g>
      )
    case 'party':
      return (
        <g>
          <path d={`M84 ${top + 2} l 16 -46 l 16 46 z`} fill="#f43f5e" stroke="#881337" strokeWidth={3} strokeLinejoin="round" />
          <path d={`M88 ${top - 10} h 24 M92 ${top - 24} h 16`} stroke="#fde68a" strokeWidth={4} />
          <circle cx={100} cy={top - 46} r={6} fill="#fbbf24" />
        </g>
      )
    default:
      return null
  }
}
