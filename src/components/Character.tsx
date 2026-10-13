import { useEffect, useState } from 'react'
import type { CharacterBase } from '../content/characters'
import { PAINT_BY_ID, colorOf, defaultLook, kindOf } from '../content/parts'
import type { Look } from '../content/parts'

export type Mood = 'idle' | 'happy' | 'thinking' | 'sad' | 'talking'

interface Props {
  base: CharacterBase
  /** What the buddy wears. Defaults to the classic look. */
  look?: Look
  /** 1..5, grows the buddy itself. */
  level?: number
  mood?: Mood
  size?: number
  className?: string
}

const INK = '#1e1b4b'

/** The three mascots, drawn in SVG. Parts are layered: back aura → back outfit → body (+level features) → face → outfit → hat → front aura. */
export function Character({ base, look, level = 1, mood = 'idle', size = 160, className = '' }: Props) {
  const lk = look ?? defaultLook(base)
  const colors = colorOf(lk, base)
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

  const anim = mood === 'happy' || mood === 'talking' ? 'animate-bounce-soft' : mood === 'thinking' ? 'animate-wiggle' : ''
  const hat = kindOf(lk.hat)
  const face = kindOf(lk.face)
  const outfit = kindOf(lk.outfit)
  const aura = kindOf(lk.aura)
  const geo = GEO[base]
  const hatPaint = (lk.hatPaint && PAINT_BY_ID[lk.hatPaint]) || null
  const outfitPaint = (lk.outfitPaint && PAINT_BY_ID[lk.outfitPaint]) || null
  const ctx: Ctx = { base, body: colors.body, accent: colors.accent, level, mood, blink, geo, hatFill: hatPaint?.fill, hatStroke: hatPaint?.stroke, outfitFill: outfitPaint?.fill, outfitStroke: outfitPaint?.stroke }
  const needsRainbow = hatPaint?.id === 'rainbow' || outfitPaint?.id === 'rainbow'

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={`${anim} ${className}`} role="img" aria-label={`${base} buddy`} style={{ overflow: 'visible' }}>
      {needsRainbow && (
        <defs>
          <linearGradient id="rq-rainbow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f43f5e" />
            <stop offset="0.25" stopColor="#fbbf24" />
            <stop offset="0.5" stopColor="#22c55e" />
            <stop offset="0.75" stopColor="#38bdf8" />
            <stop offset="1" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      )}
      {aura && <AuraBack kind={aura} />}
      {level >= 5 && <circle cx={100} cy={112} r={84} fill="rgba(253,224,71,0.28)" className="aura-float" />}
      {outfit && <OutfitBack kind={outfit} ctx={ctx} />}
      {base === 'robot' && <Robot ctx={ctx} />}
      {base === 'dragon' && <Dragon ctx={ctx} />}
      {base === 'monster' && <Monster ctx={ctx} />}
      {face && <Face kind={face} ctx={ctx} />}
      {outfit && <OutfitFront kind={outfit} ctx={ctx} />}
      {hat && <Hat kind={hat} ctx={ctx} />}
      {aura && <AuraFront kind={aura} />}
    </svg>
  )
}

interface Geo {
  /** y of the top of the head (hats sit here). */
  top: number
  /** y of the eyes. */
  eyeY: number
  /** y of the neck / chest line for scarves and badges. */
  neck: number
}
const GEO: Record<CharacterBase, Geo> = {
  robot: { top: 38, eyeY: 74, neck: 122 },
  dragon: { top: 44, eyeY: 74, neck: 118 },
  monster: { top: 46, eyeY: 88, neck: 150 },
}
interface Ctx {
  base: CharacterBase
  body: string
  accent: string
  level: number
  mood: Mood
  blink: boolean
  geo: Geo
  /** Paint overrides for the hat and the outfit (undefined = the part's own colours). */
  hatFill?: string
  hatStroke?: string
  outfitFill?: string
  outfitStroke?: string
}

// ---------------------------------------------------------------- faces (eyes, mouth)
function Eyes({ cx1, cx2, cy, r, blink, mood }: { cx1: number; cx2: number; cy: number; r: number; blink: boolean; mood: Mood }) {
  if (blink) {
    return (
      <g stroke={INK} strokeWidth={4} strokeLinecap="round">
        <line x1={cx1 - r} y1={cy} x2={cx1 + r} y2={cy} />
        <line x1={cx2 - r} y1={cy} x2={cx2 + r} y2={cy} />
      </g>
    )
  }
  const sad = mood === 'sad'
  const dx = mood === 'thinking' ? 3 : 0
  return (
    <g>
      <circle cx={cx1} cy={cy} r={r} fill="white" />
      <circle cx={cx2} cy={cy} r={r} fill="white" />
      <circle cx={cx1 + dx} cy={cy + (sad ? 2 : 0)} r={r * 0.5} fill={INK} />
      <circle cx={cx2 + dx} cy={cy + (sad ? 2 : 0)} r={r * 0.5} fill={INK} />
      <circle cx={cx1 + 2} cy={cy - 3} r={r * 0.18} fill="white" />
      <circle cx={cx2 + 2} cy={cy - 3} r={r * 0.18} fill="white" />
      {sad && (
        <g stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none">
          <path d={`M${cx1 - r} ${cy - r - 4} q ${r} -6 ${2 * r} 2`} />
          <path d={`M${cx2 - r} ${cy - r - 2} q ${r} -6 ${2 * r} 4`} />
        </g>
      )}
    </g>
  )
}

function Mouth({ cx, cy, mood, width = 30 }: { cx: number; cy: number; mood: Mood; width?: number }) {
  const w = width / 2
  if (mood === 'happy') return <path d={`M${cx - w} ${cy} q ${w} ${w * 1.2} ${2 * w} 0 z`} fill="#be185d" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
  if (mood === 'sad') return <path d={`M${cx - w} ${cy + 8} q ${w} -${w * 0.8} ${2 * w} 0`} fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
  if (mood === 'talking') return <ellipse cx={cx} cy={cy + 3} rx={w * 0.55} ry={w * 0.45} fill="#be185d" stroke={INK} strokeWidth={3} />
  if (mood === 'thinking') return <path d={`M${cx - w * 0.6} ${cy + 4} q ${w * 0.6} -6 ${w * 1.2} 2`} fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
  return <path d={`M${cx - w} ${cy} q ${w} ${w * 0.7} ${2 * w} 0`} fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
}

// ---------------------------------------------------------------- bodies with level features
function Robot({ ctx }: { ctx: Ctx }) {
  const { body, accent, mood, blink, level } = ctx
  return (
    <g>
      {/* jet boots (level 4+) */}
      {level >= 4 && (
        <g className="aura-float">
          <path d="M68 192 q 11 24 22 0 z M110 192 q 11 24 22 0 z" fill="#38bdf8" />
          <path d="M72 192 q 7 12 14 0 z M114 192 q 7 12 14 0 z" fill="#fde047" />
        </g>
      )}
      {/* antennas: 1 at level 1, 2 at level 2, 3 at level 3+ */}
      <line x1={100} y1={38} x2={100} y2={18} stroke="#475569" strokeWidth={5} strokeLinecap="round" />
      <circle cx={100} cy={14} r={8} fill="#fde68a" stroke="#475569" strokeWidth={3} />
      {level >= 2 && (
        <g>
          <line x1={78} y1={40} x2={70} y2={20} stroke="#475569" strokeWidth={4} strokeLinecap="round" />
          <circle cx={69} cy={16} r={6} fill="#fb7185" stroke="#475569" strokeWidth={2} />
        </g>
      )}
      {level >= 3 && (
        <g>
          <line x1={122} y1={40} x2={130} y2={20} stroke="#475569" strokeWidth={4} strokeLinecap="round" />
          <circle cx={131} cy={16} r={6} fill="#22c55e" stroke="#475569" strokeWidth={2} />
        </g>
      )}
      {/* body */}
      <rect x={55} y={120} width={90} height={60} rx={16} fill={body} stroke={INK} strokeWidth={4} />
      <rect x={75} y={132} width={50} height={34} rx={8} fill={accent} stroke={INK} strokeWidth={3} />
      <circle cx={88} cy={149} r={5} fill="#22c55e" />
      <circle cx={100} cy={149} r={5} fill="#fbbf24" />
      <circle cx={112} cy={149} r={5} fill="#fb7185" />
      {level >= 5 && <path d="M80 158 h40" stroke="#38bdf8" strokeWidth={3} strokeLinecap="round" />}
      {/* arms */}
      <rect x={30} y={128} width={24} height={14} rx={7} fill={body} stroke={INK} strokeWidth={3} />
      <rect x={146} y={128} width={24} height={14} rx={7} fill={body} stroke={INK} strokeWidth={3} />
      {level >= 3 && (
        <g>
          <rect x={30} y={122} width={24} height={8} rx={4} fill="#fde047" stroke={INK} strokeWidth={2} />
          <rect x={146} y={122} width={24} height={8} rx={4} fill="#fde047" stroke={INK} strokeWidth={2} />
        </g>
      )}
      {/* legs */}
      <rect x={68} y={178} width={22} height={14} rx={6} fill="#475569" />
      <rect x={110} y={178} width={22} height={14} rx={6} fill="#475569" />
      {/* head */}
      <rect x={45} y={38} width={110} height={82} rx={24} fill={body} stroke={INK} strokeWidth={4} />
      <rect x={58} y={52} width={84} height={54} rx={16} fill={accent} />
      <rect x={38} y={66} width={12} height={22} rx={5} fill="#475569" />
      <rect x={150} y={66} width={12} height={22} rx={5} fill="#475569" />
      <Eyes cx1={80} cx2={120} cy={74} r={12} blink={blink} mood={mood} />
      <Mouth cx={100} cy={94} mood={mood} />
    </g>
  )
}

function Dragon({ ctx }: { ctx: Ctx }) {
  const { body, accent, mood, blink, level } = ctx
  const bigWings = level >= 3
  return (
    <g>
      {/* tail */}
      <path d="M70 160 q -40 10 -42 -20 q 0 -14 12 -16" fill="none" stroke={body} strokeWidth={14} strokeLinecap="round" />
      <path d="M70 160 q -40 10 -42 -20 q 0 -14 12 -16" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" opacity={0.25} />
      {/* wings */}
      {bigWings ? (
        <g>
          <path d="M60 112 l -52 -46 l 14 50 l -36 -2 l 44 36 z" fill={accent} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <path d="M140 112 l 52 -46 l -14 50 l 36 -2 l -44 36 z" fill={accent} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        </g>
      ) : (
        <g>
          <path d="M60 110 l -34 -30 l 10 34 l -26 -4 l 30 26 z" fill={accent} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <path d="M140 110 l 34 -30 l -10 34 l 26 -4 l -30 26 z" fill={accent} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        </g>
      )}
      {/* body */}
      <ellipse cx={100} cy={140} rx={46} ry={44} fill={body} stroke={INK} strokeWidth={4} />
      <ellipse cx={100} cy={148} rx={28} ry={30} fill={accent} />
      <path d="M88 150 h24 M90 160 h20 M92 170 h16" stroke={INK} strokeWidth={2} opacity={0.25} strokeLinecap="round" />
      {/* feet */}
      <ellipse cx={78} cy={184} rx={16} ry={9} fill={body} stroke={INK} strokeWidth={3} />
      <ellipse cx={122} cy={184} rx={16} ry={9} fill={body} stroke={INK} strokeWidth={3} />
      {/* head */}
      <ellipse cx={100} cy={80} rx={50} ry={44} fill={body} stroke={INK} strokeWidth={4} />
      {/* horns grow with level */}
      {level >= 2 ? (
        <g>
          <path d="M52 44 l -8 -30 l 20 16 z" fill="#fde68a" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <path d="M148 44 l 8 -30 l -20 16 z" fill="#fde68a" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        </g>
      ) : (
        <g>
          <path d="M62 50 l -10 -26 l 24 14 z" fill="#fde68a" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <path d="M138 50 l 10 -26 l -24 14 z" fill="#fde68a" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        </g>
      )}
      <path d="M86 40 l 6 -12 l 6 12 M100 36 l 6 -12 l 6 12" fill={accent} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      {/* snout */}
      <ellipse cx={100} cy={100} rx={30} ry={16} fill={accent} />
      <circle cx={90} cy={98} r={3.5} fill={INK} />
      <circle cx={110} cy={98} r={3.5} fill={INK} />
      <Eyes cx1={80} cx2={120} cy={74} r={12} blink={blink} mood={mood} />
      <Mouth cx={100} cy={108} mood={mood} width={26} />
      {/* fire breath at level 4+, or when happy */}
      {(level >= 4 || mood === 'happy') && (
        <g className="aura-float">
          <path d="M132 100 q 30 -8 44 10 q -18 10 -44 2 z" fill="#f97316" />
          <path d="M134 101 q 22 -4 32 8 q -14 6 -32 1 z" fill="#fde047" />
        </g>
      )}
    </g>
  )
}

function Monster({ ctx }: { ctx: Ctx }) {
  const { body, accent, mood, blink, level } = ctx
  const fuzz = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2
    return { x: 100 + Math.cos(a) * 62, y: 110 + Math.sin(a) * 66 }
  })
  return (
    <g>
      {/* tail at level 3+ */}
      {level >= 3 && <path d="M40 170 q -30 10 -36 -16 q 10 -2 18 6" fill="none" stroke={body} strokeWidth={14} strokeLinecap="round" />}
      {fuzz.map((f, i) => (
        <circle key={i} cx={f.x} cy={f.y} r={14} fill={body} stroke={INK} strokeWidth={3} />
      ))}
      <ellipse cx={100} cy={110} rx={64} ry={68} fill={body} />
      <ellipse cx={100} cy={140} rx={34} ry={28} fill={accent} />
      <ellipse cx={74} cy={182} rx={18} ry={10} fill={accent} stroke={INK} strokeWidth={3} />
      <ellipse cx={126} cy={182} rx={18} ry={10} fill={accent} stroke={INK} strokeWidth={3} />
      <path d="M42 120 q -18 10 -14 30" fill="none" stroke={body} strokeWidth={16} strokeLinecap="round" />
      <path d="M158 120 q 18 10 14 30" fill="none" stroke={body} strokeWidth={16} strokeLinecap="round" />
      {/* horns */}
      <path d="M66 52 l -8 -24 l 22 14 z" fill={accent} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <path d="M134 52 l 8 -24 l -22 14 z" fill={accent} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      {level >= 2 && <path d="M92 36 l 8 -24 l 8 24 z" fill={accent} stroke={INK} strokeWidth={3} strokeLinejoin="round" />}
      {/* third eye at level 3+ */}
      {level >= 3 && (
        <g>
          <circle cx={100} cy={62} r={11} fill="white" />
          <circle cx={100} cy={62} r={5} fill={INK} />
        </g>
      )}
      <Eyes cx1={82} cx2={122} cy={88} r={16} blink={blink} mood={mood} />
      <Mouth cx={100} cy={118} mood={mood} width={40} />
      {mood !== 'happy' && mood !== 'talking' && (
        <g fill="white" stroke={INK} strokeWidth={2}>
          <path d="M88 118 l 5 9 l 5 -9 z" />
          <path d="M104 118 l 5 9 l 5 -9 z" />
        </g>
      )}
      {level >= 4 && (
        <g className="aura-float">
          <circle cx={56} cy={50} r={9} fill="#fde047" opacity={0.9} />
          <circle cx={150} cy={40} r={6} fill="#fde047" opacity={0.9} />
        </g>
      )}
    </g>
  )
}

// ---------------------------------------------------------------- hats
function Hat({ kind, ctx }: { kind: string; ctx: Ctx }) {
  const { top } = ctx.geo
  const f = (own: string) => ctx.hatFill ?? own
  const s = (own: string) => ctx.hatStroke ?? own
  switch (kind) {
    case 'crown':
      return (
        <g>
          <path d={`M66 ${top - 2} l 0 -26 l 16 14 l 18 -22 l 18 22 l 16 -14 l 0 26 z`} fill={f('#fbbf24')} stroke={s('#92400e')} strokeWidth={3} strokeLinejoin="round" />
          <circle cx={82} cy={top - 14} r={3.5} fill="#ef4444" />
          <circle cx={100} cy={top - 20} r={3.5} fill="#3b82f6" />
          <circle cx={118} cy={top - 14} r={3.5} fill="#22c55e" />
        </g>
      )
    case 'cap':
      return (
        <g>
          <path d={`M58 ${top + 2} a 42 34 0 0 1 84 0 z`} fill={f('#ef4444')} stroke={s('#7f1d1d')} strokeWidth={3} />
          <rect x={92} y={top - 36} width={16} height={14} rx={4} fill={f('#ef4444')} stroke={s('#7f1d1d')} strokeWidth={3} />
          <path d={`M100 ${top + 2} h 60 a 8 8 0 0 1 0 12 h -60 z`} fill={ctx.hatStroke ?? '#b91c1c'} stroke={s('#7f1d1d')} strokeWidth={3} />
        </g>
      )
    case 'wizard':
      return (
        <g>
          <path d={`M60 ${top + 4} l 40 -70 l 40 70 z`} fill={f('#4c1d95')} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <ellipse cx={100} cy={top + 4} rx={52} ry={9} fill={f('#4c1d95')} stroke={INK} strokeWidth={3} />
          <text x={92} y={top - 18} fontSize={18} fill="#fde68a">★</text>
          <text x={102} y={top - 36} fontSize={12} fill="#fde68a">★</text>
        </g>
      )
    case 'bow':
      return (
        <g>
          <path d={`M126 ${top - 2} l -22 -12 l 0 24 z`} fill={f('#ec4899')} stroke={s('#9d174d')} strokeWidth={3} strokeLinejoin="round" />
          <path d={`M126 ${top - 2} l 22 -12 l 0 24 z`} fill={f('#ec4899')} stroke={s('#9d174d')} strokeWidth={3} strokeLinejoin="round" />
          <circle cx={126} cy={top - 2} r={5} fill="#fbcfe8" stroke="#9d174d" strokeWidth={2} />
        </g>
      )
    case 'pirate':
      return (
        <g>
          <path d={`M46 ${top + 6} q 54 -40 108 0 l -8 -4 q -46 -30 -92 0 z`} fill={f('#111827')} stroke={s('#000')} strokeWidth={2} />
          <path d={`M44 ${top + 6} h 112`} stroke={f('#111827')} strokeWidth={10} strokeLinecap="round" />
          <text x={92} y={top - 2} fontSize={16} fill="white">☠</text>
        </g>
      )
    case 'astro':
      return (
        <g>
          <ellipse cx={100} cy={ctx.geo.eyeY + 6} rx={64} ry={58} fill="rgba(191,219,254,0.35)" stroke="#e5e7eb" strokeWidth={5} />
          <path d={`M46 ${ctx.geo.eyeY + 20} a 54 48 0 0 1 20 -54`} fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" opacity={0.8} />
        </g>
      )
    case 'party':
      return (
        <g>
          <path d={`M84 ${top + 2} l 16 -46 l 16 46 z`} fill={f('#f43f5e')} stroke={s('#881337')} strokeWidth={3} strokeLinejoin="round" />
          <path d={`M88 ${top - 10} h 24 M92 ${top - 24} h 16`} stroke="#fde68a" strokeWidth={4} />
          <circle cx={100} cy={top - 46} r={6} fill="#fbbf24" />
        </g>
      )
    case 'flower':
      return (
        <g transform={`translate(136 ${top - 2})`}>
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <ellipse key={a} cx={0} cy={-11} rx={6} ry={10} fill={f('#f472b6')} stroke={s('#9d174d')} strokeWidth={2} transform={`rotate(${a})`} />
          ))}
          <circle r={6} fill="#fde047" stroke="#9d174d" strokeWidth={2} />
        </g>
      )
    case 'bandana':
      return (
        <g>
          <path d={`M48 ${top + 10} q 52 -30 104 0 l 0 10 q -52 -22 -104 0 z`} fill={f('#dc2626')} stroke={s('#7f1d1d')} strokeWidth={3} strokeLinejoin="round" />
          <path d={`M150 ${top + 12} l 22 -10 l -6 16 l 10 10 l -24 -8 z`} fill={f('#dc2626')} stroke={s('#7f1d1d')} strokeWidth={3} strokeLinejoin="round" />
          {[60, 80, 100, 120, 140].map((x) => (
            <circle key={x} cx={x} cy={top + 10} r={2.5} fill="white" />
          ))}
        </g>
      )
    case 'halo':
      return (
        <g className="aura-float">
          <ellipse cx={100} cy={top - 18} rx={34} ry={9} fill="none" stroke="#fde047" strokeWidth={7} />
          <ellipse cx={100} cy={top - 18} rx={34} ry={9} fill="none" stroke="#facc15" strokeWidth={3} />
        </g>
      )
    default:
      return null
  }
}

// ---------------------------------------------------------------- faces
function Face({ kind, ctx }: { kind: string; ctx: Ctx }) {
  const { eyeY } = ctx.geo
  switch (kind) {
    case 'glasses':
      return (
        <g fill="none" stroke={INK} strokeWidth={4}>
          <circle cx={80} cy={eyeY} r={17} fill="rgba(56,189,248,0.25)" />
          <circle cx={120} cy={eyeY} r={17} fill="rgba(56,189,248,0.25)" />
          <line x1={97} y1={eyeY} x2={103} y2={eyeY} />
          <line x1={63} y1={eyeY - 4} x2={50} y2={eyeY - 8} />
          <line x1={137} y1={eyeY - 4} x2={150} y2={eyeY - 8} />
        </g>
      )
    case 'sunglasses':
      return (
        <g fill="#111827" stroke="#111827" strokeWidth={3}>
          <rect x={62} y={eyeY - 12} width={34} height={24} rx={8} />
          <rect x={104} y={eyeY - 12} width={34} height={24} rx={8} />
          <line x1={96} y1={eyeY - 4} x2={104} y2={eyeY - 4} />
          <line x1={62} y1={eyeY - 6} x2={50} y2={eyeY - 10} />
          <line x1={138} y1={eyeY - 6} x2={150} y2={eyeY - 10} />
          <path d={`M68 ${eyeY - 6} h 14`} stroke="#9ca3af" strokeWidth={2} />
          <path d={`M110 ${eyeY - 6} h 14`} stroke="#9ca3af" strokeWidth={2} />
        </g>
      )
    case 'headphones':
      return (
        <g fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round">
          <path d={`M50 ${eyeY} a 50 50 0 0 1 100 0`} />
          <rect x={38} y={eyeY - 8} width={18} height={28} rx={7} fill="#f472b6" />
          <rect x={144} y={eyeY - 8} width={18} height={28} rx={7} fill="#f472b6" />
        </g>
      )
    case 'stars':
      return (
        <g fill="rgba(253,224,71,0.35)" stroke="#d97706" strokeWidth={3} strokeLinejoin="round">
          <path d={star(80, eyeY, 19)} />
          <path d={star(120, eyeY, 19)} />
          <line x1={96} y1={eyeY} x2={104} y2={eyeY} stroke="#d97706" />
        </g>
      )
    case 'monocle':
      return (
        <g fill="none" stroke="#92400e" strokeWidth={4}>
          <circle cx={120} cy={eyeY} r={18} fill="rgba(253,230,138,0.3)" />
          <path d={`M138 ${eyeY + 6} q 14 20 6 40`} strokeWidth={2} />
        </g>
      )
    default:
      return null
  }
}

function star(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(1)} ${(cy + Math.sin(a) * rad).toFixed(1)}`)
  }
  return `M${pts.join(' L')} Z`
}

// ---------------------------------------------------------------- outfits
function OutfitBack({ kind, ctx }: { kind: string; ctx: Ctx }) {
  const f = (own: string) => ctx.outfitFill ?? own
  const s = (own: string) => ctx.outfitStroke ?? own
  switch (kind) {
    case 'cape':
      return (
        <g>
          <path d="M60 110 q -30 60 -20 86 h 120 q 10 -26 -20 -86 z" fill={f('#dc2626')} stroke={s('#7f1d1d')} strokeWidth={3} strokeLinejoin="round" />
          <path d="M70 120 q -16 40 -10 70 M130 120 q 16 40 10 70" fill="none" stroke={s('#991b1b')} strokeWidth={2} opacity={0.6} />
        </g>
      )
    case 'backpack':
      return (
        <g>
          <rect x={30} y={116} width={38} height={54} rx={12} fill={f('#16a34a')} stroke={s('#14532d')} strokeWidth={3} />
          <rect x={38} y={126} width={22} height={16} rx={5} fill="#f8fafc" stroke={s('#14532d')} strokeWidth={2} />
          <rect x={132} y={116} width={38} height={54} rx={12} fill={f('#16a34a')} stroke={s('#14532d')} strokeWidth={3} />
          <rect x={140} y={126} width={22} height={16} rx={5} fill="#f8fafc" stroke={s('#14532d')} strokeWidth={2} />
        </g>
      )
    case 'wings':
      return (
        <g className="aura-float" opacity={0.9}>
          <path d="M62 120 q -50 -50 -40 -4 q -4 40 40 24 z" fill="rgba(165,243,252,0.8)" stroke="#06b6d4" strokeWidth={3} strokeLinejoin="round" />
          <path d="M138 120 q 50 -50 40 -4 q 4 40 -40 24 z" fill="rgba(165,243,252,0.8)" stroke="#06b6d4" strokeWidth={3} strokeLinejoin="round" />
        </g>
      )
    default:
      return null
  }
}

function OutfitFront({ kind, ctx }: { kind: string; ctx: Ctx }) {
  const { neck } = ctx.geo
  const f = (own: string) => ctx.outfitFill ?? own
  const s = (own: string) => ctx.outfitStroke ?? own
  switch (kind) {
    case 'scarf':
      return (
        <g>
          <path d={`M62 ${neck} q 38 18 76 0 v 12 q -38 18 -76 0 z`} fill={f('#ef4444')} stroke={s('#991b1b')} strokeWidth={3} strokeLinejoin="round" />
          <path d={`M126 ${neck + 8} l 14 26 l -14 4 z`} fill={f('#ef4444')} stroke={s('#991b1b')} strokeWidth={3} strokeLinejoin="round" />
          <path d={`M66 ${neck + 6} h 68 M66 ${neck + 12} h 68`} stroke="#fde68a" strokeWidth={2} />
        </g>
      )
    case 'bowtie':
      return (
        <g transform={`translate(100 ${neck + 6})`}>
          <path d="M0 0 l -18 -10 v 20 z M0 0 l 18 -10 v 20 z" fill={f('#3b82f6')} stroke={s('#1e3a8a')} strokeWidth={3} strokeLinejoin="round" />
          <circle r={4} fill="#fde047" stroke="#1e3a8a" strokeWidth={2} />
        </g>
      )
    case 'badge':
      return (
        <g transform={`translate(128 ${neck + 14})`}>
          <path d={star(0, 0, 14)} fill="#fbbf24" stroke="#92400e" strokeWidth={2} strokeLinejoin="round" />
          <text x={-6} y={5} fontSize={12} fontWeight={800} fill="#92400e">A</text>
        </g>
      )
    case 'medal':
      return (
        <g transform={`translate(100 ${neck + 4})`}>
          <path d="M-14 -8 l 8 22 h 12 l 8 -22 z" fill={f('#2563eb')} stroke={s('#1e3a8a')} strokeWidth={2} />
          <circle cy={22} r={13} fill="#fbbf24" stroke="#92400e" strokeWidth={3} />
          <text x={-5} y={28} fontSize={16} fill="#92400e">1</text>
        </g>
      )
    case 'shield':
      return (
        <g transform="translate(142 128)">
          <path d="M0 -24 l 24 8 v 20 q 0 18 -24 28 q -24 -10 -24 -28 v -20 z" fill={f('#3b82f6')} stroke={s('#1e3a8a')} strokeWidth={3} strokeLinejoin="round" />
          <path d="M0 -14 l 14 5 v 12 q 0 10 -14 17 q -14 -7 -14 -17 v -12 z" fill="#fde047" stroke="#1e3a8a" strokeWidth={2} />
          <text x={-6} y={8} fontSize={16} fill="#1e3a8a">★</text>
        </g>
      )
    default:
      return null
  }
}

// ---------------------------------------------------------------- auras
const SPARKS: [number, number][] = [[30, 40], [170, 50], [20, 120], [180, 130], [60, 20], [150, 15]]

function AuraBack({ kind }: { kind: string }) {
  switch (kind) {
    case 'ring':
      return <circle cx={100} cy={110} r={92} fill="none" stroke="#a78bfa" strokeWidth={6} strokeDasharray="14 10" opacity={0.8} className="animate-spin-slow" />
    case 'rainbow':
      return (
        <g opacity={0.75}>
          <path d="M10 200 q 90 -150 180 0" fill="none" stroke="#f43f5e" strokeWidth={6} />
          <path d="M14 200 q 86 -138 172 0" fill="none" stroke="#fbbf24" strokeWidth={6} />
          <path d="M18 200 q 82 -126 164 0" fill="none" stroke="#22c55e" strokeWidth={6} />
          <path d="M22 200 q 78 -114 156 0" fill="none" stroke="#38bdf8" strokeWidth={6} />
        </g>
      )
    default:
      return null
  }
}

function AuraFront({ kind }: { kind: string }) {
  switch (kind) {
    case 'sparkles':
      return (
        <g className="aura-float">
          {SPARKS.map(([x, y], i) => (
            <text key={i} x={x} y={y} fontSize={18} fill="#fde047" stroke="#f59e0b" strokeWidth={0.5}>
              ✦
            </text>
          ))}
        </g>
      )
    case 'bubbles':
      return (
        <g className="aura-float">
          {[[30, 60, 9], [170, 80, 7], [40, 150, 6], [165, 160, 10], [100, 14, 5]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="rgba(186,230,253,0.4)" stroke="#38bdf8" strokeWidth={3} />
          ))}
        </g>
      )
    case 'fire':
      return (
        <g className="aura-float" opacity={0.9}>
          <path d="M40 190 q 6 -30 18 -40 q -4 22 8 30 q 2 -14 10 -18 q -2 26 -20 36 z" fill="#f97316" />
          <path d="M150 190 q 6 -30 18 -40 q -4 22 8 30 q 2 -14 10 -18 q -2 26 -20 36 z" fill="#f97316" />
          <path d="M48 190 q 4 -18 10 -24 q 0 14 6 18 z" fill="#fde047" />
          <path d="M158 190 q 4 -18 10 -24 q 0 14 6 18 z" fill="#fde047" />
        </g>
      )
    case 'lightning':
      return (
        <g className="aura-float">
          <path d="M22 60 l 14 -30 l -4 22 l 14 -4 l -20 34 l 4 -20 z" fill="#fde047" stroke="#f59e0b" strokeWidth={2} />
          <path d="M176 70 l 14 -30 l -4 22 l 14 -4 l -20 34 l 4 -20 z" fill="#fde047" stroke="#f59e0b" strokeWidth={2} />
        </g>
      )
    case 'ring':
      return (
        <g className="aura-float">
          {SPARKS.slice(0, 4).map(([x, y], i) => (
            <text key={i} x={x} y={y} fontSize={14} fill="#c4b5fd">
              ✦
            </text>
          ))}
        </g>
      )
    default:
      return null
  }
}
