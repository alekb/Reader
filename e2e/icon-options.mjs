// Renders app-icon concepts built from the real mascot art to e2e/shots/icon-options.png
import { createServer } from 'vite'
import { chromium } from 'playwright'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'node:fs'

const server = await createServer({ server: { middlewareMode: true }, logLevel: 'error', appType: 'custom' })
const { Character } = await server.ssrLoadModule('/src/components/Character.tsx')
const { defaultLook } = await server.ssrLoadModule('/src/content/parts.ts')
await server.close()

/** Inner SVG of a mascot, re-framed with a custom viewBox and placed at x,y,size inside the icon. */
function buddy(base, { x, y, size, view = '0 0 200 200', level = 1, mood = 'happy', look }) {
  const markup = renderToStaticMarkup(createElement(Character, { base, look: look ?? defaultLook(base), level, mood, size: 200 }))
  return markup
    .replace(/<svg[^>]*?>/, `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${view}" overflow="visible">`)
    .replace(/class="[^"]*"/g, '')
}

const book = (cx, cy, w) => {
  const h = w * 0.42
  return `<g transform="translate(${cx} ${cy})">
    <path d="M${-w / 2} ${-h / 2} q ${w / 4} -${h * 0.25} ${w / 2} 0 v ${h} q -${w / 4} -${h * 0.25} -${w / 2} 0 z" fill="#ffffff" stroke="#1e1b4b" stroke-width="10" stroke-linejoin="round"/>
    <path d="M0 ${-h / 2} q ${w / 4} -${h * 0.25} ${w / 2} 0 v ${h} q -${w / 4} -${h * 0.25} -${w / 2} 0 z" fill="#ffffff" stroke="#1e1b4b" stroke-width="10" stroke-linejoin="round"/>
    <path d="M${-w * 0.4} ${-h * 0.18} q ${w * 0.15} -${h * 0.1} ${w * 0.32} 0 M${-w * 0.4} ${h * 0.08} q ${w * 0.15} -${h * 0.1} ${w * 0.32} 0" stroke="#c4b5fd" stroke-width="9" fill="none" stroke-linecap="round"/>
    <text x="${w * 0.25}" y="${h * 0.22}" font-family="Andika, Arial Rounded MT Bold, sans-serif" font-weight="700" font-size="${h * 0.62}" text-anchor="middle" fill="#6d28d9">a</text>
  </g>`
}
const sparkle = (x, y, s, c = '#fde047') => `<path d="M${x} ${y - s} L${x + s * 0.28} ${y - s * 0.28} L${x + s} ${y} L${x + s * 0.28} ${y + s * 0.28} L${x} ${y + s} L${x - s * 0.28} ${y + s * 0.28} L${x - s} ${y} L${x - s * 0.28} ${y - s * 0.28} Z" fill="${c}"/>`
const grad = (id, a, b) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`

// Head-only framing per buddy (viewBox inside the 200x200 character art)
const HEAD = { robot: '30 0 140 140', dragon: '28 10 144 144', monster: '22 20 156 156' }

const OPTIONS = [
  {
    id: 'A', name: 'Bolt close-up', note: 'Friendly robot face, purple brand colour',
    svg: () => grad('ga', '#8b5cf6', '#5b21b6') + `<rect width="512" height="512" fill="url(#ga)"/>` + sparkle(410, 96, 34) + sparkle(96, 400, 22, '#fbcfe8') +
      buddy('robot', { x: 56, y: 70, size: 400, view: HEAD.robot }),
  },
  {
    id: 'B', name: 'Ember reads', note: 'Dragon peeking over an open book',
    svg: () => grad('gb', '#7dd3fc', '#2563eb') + `<rect width="512" height="512" fill="url(#gb)"/>` + sparkle(420, 90, 30) + sparkle(80, 110, 20) +
      buddy('dragon', { x: 66, y: 30, size: 380, view: HEAD.dragon }) + book(256, 400, 330),
  },
  {
    id: 'C', name: 'Fuzz grin', note: 'Big monster face on sunny yellow',
    svg: () => grad('gc', '#fde68a', '#f59e0b') + `<rect width="512" height="512" fill="url(#gc)"/>` + sparkle(420, 80, 28, '#ffffff') +
      buddy('monster', { x: 40, y: 46, size: 432, view: HEAD.monster }),
  },
  {
    id: 'D', name: 'The trio', note: 'All three buddies side by side',
    svg: () => grad('gd', '#a78bfa', '#6d28d9') + `<rect width="512" height="512" fill="url(#gd)"/>` +
      buddy('dragon', { x: -10, y: 150, size: 250, view: HEAD.dragon }) +
      buddy('monster', { x: 272, y: 150, size: 250, view: HEAD.monster }) +
      buddy('robot', { x: 116, y: 60, size: 280, view: HEAD.robot }) + sparkle(256, 470, 22),
  },
  {
    id: 'E', name: 'Bolt + book', note: 'Robot popping out of a book with "a"',
    svg: () => grad('ge', '#fbcfe8', '#db2777') + `<rect width="512" height="512" fill="url(#ge)"/>` + sparkle(420, 84, 30) + sparkle(86, 96, 22, '#ffffff') +
      buddy('robot', { x: 96, y: 18, size: 320, view: HEAD.robot }) + book(256, 392, 360),
  },
  {
    id: 'F', name: 'Level-5 Ember', note: 'Evolved dragon with crown and sparkles',
    svg: () => grad('gf', '#c4b5fd', '#4c1d95') + `<rect width="512" height="512" fill="url(#gf)"/>` +
      buddy('dragon', { x: 36, y: 50, size: 440, level: 5, look: { ...defaultLook('dragon'), hat: 'hat-crown', aura: 'aura-sparkles' } }),
  },
]

const icon = (o, size, shape) => {
  const clip = shape === 'round' ? '<clipPath id="c' + o.id + size + '"><circle cx="256" cy="256" r="256"/></clipPath>' : '<clipPath id="c' + o.id + size + '"><rect width="512" height="512" rx="115"/></clipPath>'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><defs>${clip}</defs><g clip-path="url(#c${o.id}${size})">${o.svg()}</g></svg>`
}

const css = `<style>
body{margin:0;background:#fef3c7;font-family:Baloo 2,Arial,sans-serif;color:#1e1b4b;padding:28px}
h1{margin:0 0 4px;color:#6d28d9;font-size:30px} p{margin:0 0 18px;color:#4c4a6b}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.card{background:#fff;border-radius:28px;padding:18px;box-shadow:0 6px 0 rgba(0,0,0,.1)}
.row{display:flex;align-items:flex-end;gap:16px;justify-content:center}
.t{font-weight:800;font-size:20px;text-align:center;margin-top:10px} .s{color:#6b7280;font-weight:700;font-size:13px;text-align:center}
.lbl{font-size:11px;color:#6b7280;text-align:center;font-weight:700}
.phone{margin-top:26px;background:linear-gradient(160deg,#1e3a8a,#0f172a);border-radius:36px;padding:28px;display:grid;grid-template-columns:repeat(6,1fr);gap:22px}
.app{display:flex;flex-direction:column;align-items:center;gap:6px;color:#fff;font-size:13px;font-weight:700}
</style>`
let html = css + '<h1>App icon options</h1><p>Built from the real mascot art. Each shown large, as an Android round icon, and at real home-screen size (48 px).</p><div class="grid">'
for (const o of OPTIONS) {
  html += `<div class="card"><div class="row"><div>${icon(o, 170, 'square')}<div class="lbl">Square</div></div><div>${icon(o, 96, 'round')}<div class="lbl">Round</div></div><div>${icon(o, 48, 'square')}<div class="lbl">48 px</div></div></div><div class="t">${o.id}. ${o.name}</div><div class="s">${o.note}</div></div>`
}
html += '</div><div class="phone">'
for (const o of OPTIONS) html += `<div class="app">${icon(o, 60, 'square')}<span>${o.id}. Reader Quest</span></div>`
html += '</div>'

fs.mkdirSync('e2e/shots', { recursive: true })
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1.5 })
await page.setContent(`<!doctype html><html><head><link rel="stylesheet" href="file://${process.cwd()}/public/fonts/fonts.css"></head><body>${html}</body></html>`)
await page.waitForTimeout(400)
await page.screenshot({ path: 'e2e/shots/icon-options.png', fullPage: true })
console.log('wrote e2e/shots/icon-options.png')
await browser.close()
