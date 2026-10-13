import { useEffect, useRef, useState } from 'react'
import { sfx } from '../../speech/sfx'

interface Props {
  text: string
  /** Called with coverage 0..1 when the child finishes. */
  onDone: (coverage: number) => void
  /** Speak the sound while tracing (called on first stroke). */
  onFirstStroke?: () => void
}

const SIZE = 300
const GRID = 6
const BRUSH = 22

/** Finger-tracing of a letter on a canvas with a coverage check. */
export function LetterTrace({ text, onDone, onFirstStroke }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const maskRef = useRef<{ x: number; y: number; hit: boolean }[]>([])
  const drawingRef = useRef(false)
  const lastRef = useRef<{ x: number; y: number } | null>(null)
  const strokedRef = useRef(false)
  const [coverage, setCoverage] = useState(0)
  const [, setTick] = useState(0)

  const fontSize = text.length > 1 ? Math.round(SIZE * 0.55) : Math.round(SIZE * 0.78)

  // Build the pixel mask of the glyph.
  useEffect(() => {
    const off = document.createElement('canvas')
    off.width = SIZE
    off.height = SIZE
    const ctx = off.getContext('2d')!
    ctx.fillStyle = '#000'
    ctx.font = `bold ${fontSize}px Andika, "Century Gothic", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, SIZE / 2, SIZE / 2 + fontSize * 0.05)
    const data = ctx.getImageData(0, 0, SIZE, SIZE).data
    const pts: { x: number; y: number; hit: boolean }[] = []
    for (let y = 0; y < SIZE; y += GRID) {
      for (let x = 0; x < SIZE; x += GRID) {
        if (data[(y * SIZE + x) * 4 + 3] > 128) pts.push({ x, y, hit: false })
      }
    }
    maskRef.current = pts
    setCoverage(0)
    strokedRef.current = false
    const c = canvasRef.current
    if (c) {
      const cctx = c.getContext('2d')!
      cctx.clearRect(0, 0, SIZE, SIZE)
      drawGuide(cctx)
    }
    setTick((t) => t + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  const drawGuide = (ctx: CanvasRenderingContext2D) => {
    ctx.save()
    ctx.font = `bold ${fontSize}px Andika, "Century Gothic", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(109,40,217,0.12)'
    ctx.fillText(text, SIZE / 2, SIZE / 2 + fontSize * 0.05)
    ctx.strokeStyle = 'rgba(109,40,217,0.5)'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 6])
    ctx.strokeText(text, SIZE / 2, SIZE / 2 + fontSize * 0.05)
    // start dot (top-left-ish of glyph)
    const pts = maskRef.current
    if (pts.length) {
      const minY = Math.min(...pts.map((p) => p.y))
      const top = pts.filter((p) => p.y <= minY + GRID * 2)
      const start = top.reduce((a, b) => (a.x < b.x ? a : b))
      ctx.setLineDash([])
      ctx.fillStyle = '#22c55e'
      ctx.beginPath()
      ctx.arc(start.x, start.y, 9, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  const toLocal = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * SIZE, y: ((e.clientY - rect.top) / rect.height) * SIZE }
  }

  const paint = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = '#6d28d9'
    ctx.lineWidth = BRUSH
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    // mark mask points near the segment
    const pts = maskRef.current
    const r2 = (BRUSH / 2 + GRID) ** 2
    let hits = 0
    for (const p of pts) {
      if (p.hit) {
        hits++
        continue
      }
      if (distToSegment2(p, from, to) <= r2) {
        p.hit = true
        hits++
      }
    }
    setCoverage(pts.length ? hits / pts.length : 0)
  }

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    const p = toLocal(e)
    lastRef.current = p
    paint(p, p)
    if (!strokedRef.current) {
      strokedRef.current = true
      onFirstStroke?.()
    }
  }
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !lastRef.current) return
    const p = toLocal(e)
    paint(lastRef.current, p)
    lastRef.current = p
  }
  const onUp = () => {
    drawingRef.current = false
    lastRef.current = null
  }

  const clear = () => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, SIZE, SIZE)
    drawGuide(ctx)
    for (const p of maskRef.current) p.hit = false
    setCoverage(0)
  }

  const good = coverage >= 0.55
  useEffect(() => {
    if (coverage >= 0.85) {
      sfx.star()
      const t = setTimeout(() => onDone(coverage), 400)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverage >= 0.85])

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        className="aspect-square w-[78vw] max-w-[320px] touch-none rounded-3xl bg-white shadow-md"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
      />
      <div className="h-3 w-[60%] overflow-hidden rounded-full bg-ink/10">
        <div className="h-full rounded-full bg-grape transition-all" style={{ width: `${Math.min(100, Math.round((coverage / 0.85) * 100))}%` }} />
      </div>
      <div className="flex gap-3">
        <button onClick={clear} className="btn btn-secondary text-lg">
          ↺ Clear
        </button>
        <button onClick={() => onDone(coverage)} disabled={!good} className="btn btn-success text-lg">
          ✓ Done
        </button>
      </div>
    </div>
  )
}

function distToSegment2(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  let t = l2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2
  t = Math.max(0, Math.min(1, t))
  const x = a.x + t * dx
  const y = a.y + t * dy
  return (p.x - x) ** 2 + (p.y - y) ** 2
}
