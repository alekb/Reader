// Renders a colour gallery of all skins plus mockups of proposed features to e2e/shots/gallery-*.png
import { createServer } from 'vite'
import { chromium } from 'playwright'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'node:fs'

const server = await createServer({ server: { middlewareMode: true }, logLevel: 'error', appType: 'custom' })
const { Character } = await server.ssrLoadModule('/src/components/Character.tsx')
const { SKINS, CHARACTERS, unlockDescription } = await server.ssrLoadModule('/src/content/characters.ts')
await server.close()

const svg = (base, skinId, mood = 'idle', size = 150, overlay = '') => {
  const markup = renderToStaticMarkup(createElement(Character, { base, skinId, mood, size }))
  return overlay ? markup.replace('</svg>', overlay + '</svg>') : markup
}
const card = (inner, title, sub = '', bg = '#fff') =>
  `<div class="card" style="background:${bg}"><div>${inner}</div><div class="t">${title}</div><div class="s">${sub}</div></div>`

const css = `
<style>
body{margin:0;background:#fef3c7;font-family:Baloo 2,Nunito,Arial Rounded MT Bold,Arial,sans-serif;color:#1e1b4b;padding:24px}
h1{font-size:30px;margin:0 0 4px;color:#6d28d9} h2{font-size:22px;margin:28px 0 8px} p{margin:0 0 12px;color:#4c4a6b}
.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px} .grid5{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
.card{border-radius:24px;padding:12px 8px;text-align:center;box-shadow:0 6px 0 rgba(0,0,0,.12)}
.t{font-weight:800;font-size:15px;margin-top:4px} .s{font-size:11px;color:#6b7280;font-weight:700}
.row{display:flex;gap:12px;align-items:flex-end}
</style>`

// ---------- 1. all current skins in colour ----------
let html1 = css + '<h1>Reader Quest · all 72 looks</h1><p>Every skin is unlocked here so you can see the colours. 24 per character.</p>'
for (const c of CHARACTERS) {
  html1 += `<h2>${c.emoji} ${c.name}</h2><div class="grid">`
  for (const s of SKINS.filter((x) => x.base === c.base)) html1 += card(svg(c.base, s.id, 'happy', 120), s.name, unlockDescription(s.unlock))
  html1 += '</div>'
}

// ---------- 2. evolution levels (mockup) ----------
const sparkles = (color) =>
  [[30, 40], [170, 50], [20, 120], [180, 130], [60, 20], [150, 15]].map(([x, y]) => `<text x="${x}" y="${y}" font-size="18" fill="${color}">✦</text>`).join('')
const ring = (color) => `<circle cx="100" cy="110" r="92" fill="none" stroke="${color}" stroke-width="6" stroke-dasharray="14 10" opacity=".8"/>`
const flames = `<g opacity=".9"><path d="M40 190 q 6 -30 18 -40 q -4 22 8 30 q 2 -14 10 -18 q -2 26 -20 36 z" fill="#f97316"/><path d="M150 190 q 6 -30 18 -40 q -4 22 8 30 q 2 -14 10 -18 q -2 26 -20 36 z" fill="#f97316"/><path d="M48 190 q 4 -18 10 -24 q 0 14 6 18 z" fill="#fde047"/><path d="M158 190 q 4 -18 10 -24 q 0 14 6 18 z" fill="#fde047"/></g>`
const lightning = `<path d="M22 60 l 14 -30 l -4 22 l 14 -4 l -20 34 l 4 -20 z" fill="#fde047" stroke="#f59e0b" stroke-width="2"/><path d="M176 70 l 14 -30 l -4 22 l 14 -4 l -20 34 l 4 -20 z" fill="#fde047" stroke="#f59e0b" stroke-width="2"/>`
const rainbow = `<path d="M10 200 q 90 -150 180 0" fill="none" stroke="#f43f5e" stroke-width="6" opacity=".7"/><path d="M14 200 q 86 -138 172 0" fill="none" stroke="#fbbf24" stroke-width="6" opacity=".7"/><path d="M18 200 q 82 -126 164 0" fill="none" stroke="#22c55e" stroke-width="6" opacity=".7"/><path d="M22 200 q 78 -114 156 0" fill="none" stroke="#38bdf8" stroke-width="6" opacity=".7"/>`
const levelExtras = {
  robot: [
    '',
    `<line x1="78" y1="40" x2="70" y2="20" stroke="#475569" stroke-width="4" stroke-linecap="round"/><circle cx="69" cy="16" r="6" fill="#fb7185" stroke="#475569" stroke-width="2"/>`,
    `<line x1="78" y1="40" x2="70" y2="20" stroke="#475569" stroke-width="4"/><circle cx="69" cy="16" r="6" fill="#fb7185" stroke="#475569" stroke-width="2"/><line x1="122" y1="40" x2="130" y2="20" stroke="#475569" stroke-width="4"/><circle cx="131" cy="16" r="6" fill="#22c55e" stroke="#475569" stroke-width="2"/><rect x="30" y="122" width="24" height="10" rx="4" fill="#fde047"/><rect x="146" y="122" width="24" height="10" rx="4" fill="#fde047"/>`,
    `<line x1="78" y1="40" x2="70" y2="20" stroke="#475569" stroke-width="4"/><circle cx="69" cy="16" r="6" fill="#fb7185"/><line x1="122" y1="40" x2="130" y2="20" stroke="#475569" stroke-width="4"/><circle cx="131" cy="16" r="6" fill="#22c55e"/><path d="M68 192 q 11 22 22 0 z M110 192 q 11 22 22 0 z" fill="#38bdf8"/><path d="M72 192 q 7 12 14 0 z M114 192 q 7 12 14 0 z" fill="#fde047"/>` + lightning,
    `<line x1="78" y1="40" x2="70" y2="20" stroke="#475569" stroke-width="4"/><circle cx="69" cy="16" r="6" fill="#fb7185"/><line x1="122" y1="40" x2="130" y2="20" stroke="#475569" stroke-width="4"/><circle cx="131" cy="16" r="6" fill="#22c55e"/><path d="M68 192 q 11 22 22 0 z M110 192 q 11 22 22 0 z" fill="#38bdf8"/>` + ring('#a78bfa') + sparkles('#fde047'),
  ],
  dragon: [
    '',
    `<path d="M52 44 l -8 -30 l 20 16 z M148 44 l 8 -30 l -20 16 z" fill="#fde68a" stroke="#1e1b4b" stroke-width="3"/>`,
    `<path d="M52 44 l -8 -30 l 20 16 z M148 44 l 8 -30 l -20 16 z" fill="#fde68a" stroke="#1e1b4b" stroke-width="3"/><path d="M60 112 l -52 -46 l 14 50 l -36 -2 l 44 36 z" fill="#86efac" stroke="#1e1b4b" stroke-width="3" opacity=".9"/><path d="M140 112 l 52 -46 l -14 50 l 36 -2 l -44 36 z" fill="#86efac" stroke="#1e1b4b" stroke-width="3" opacity=".9"/>`,
    `<path d="M52 44 l -8 -30 l 20 16 z M148 44 l 8 -30 l -20 16 z" fill="#fde68a" stroke="#1e1b4b" stroke-width="3"/><path d="M60 112 l -52 -46 l 14 50 l -36 -2 l 44 36 z" fill="#86efac" stroke="#1e1b4b" stroke-width="3"/><path d="M140 112 l 52 -46 l -14 50 l 36 -2 l -44 36 z" fill="#86efac" stroke="#1e1b4b" stroke-width="3"/><path d="M132 100 q 30 -8 44 10 q -18 10 -44 2 z" fill="#f97316"/><path d="M134 101 q 22 -4 32 8 q -14 6 -32 1 z" fill="#fde047"/>` + flames,
    `<path d="M52 44 l -8 -30 l 20 16 z M148 44 l 8 -30 l -20 16 z" fill="#fde68a" stroke="#1e1b4b" stroke-width="3"/><path d="M60 112 l -52 -46 l 14 50 l -36 -2 l 44 36 z" fill="#86efac" stroke="#1e1b4b" stroke-width="3"/><path d="M140 112 l 52 -46 l -14 50 l 36 -2 l -44 36 z" fill="#86efac" stroke="#1e1b4b" stroke-width="3"/>` + rainbow + sparkles('#f472b6'),
  ],
  monster: [
    '',
    `<path d="M92 36 l 8 -24 l 8 24 z" fill="#f3e8ff" stroke="#1e1b4b" stroke-width="3"/>`,
    `<path d="M92 36 l 8 -24 l 8 24 z" fill="#f3e8ff" stroke="#1e1b4b" stroke-width="3"/><circle cx="100" cy="62" r="11" fill="white"/><circle cx="100" cy="62" r="5" fill="#1e1b4b"/><path d="M40 170 q -30 10 -36 -16 q 10 -2 18 6" fill="none" stroke="#a855f7" stroke-width="14" stroke-linecap="round"/>`,
    `<path d="M92 36 l 8 -24 l 8 24 z" fill="#f3e8ff" stroke="#1e1b4b" stroke-width="3"/><circle cx="100" cy="62" r="11" fill="white"/><circle cx="100" cy="62" r="5" fill="#1e1b4b"/><path d="M40 170 q -30 10 -36 -16 q 10 -2 18 6" fill="none" stroke="#a855f7" stroke-width="14" stroke-linecap="round"/><circle cx="56" cy="50" r="10" fill="#fde047" opacity=".9"/><circle cx="150" cy="40" r="7" fill="#fde047" opacity=".9"/>` + lightning,
    `<path d="M92 36 l 8 -24 l 8 24 z" fill="#f3e8ff" stroke="#1e1b4b" stroke-width="3"/><circle cx="100" cy="62" r="11" fill="white"/><circle cx="100" cy="62" r="5" fill="#1e1b4b"/><path d="M40 170 q -30 10 -36 -16 q 10 -2 18 6" fill="none" stroke="#a855f7" stroke-width="14" stroke-linecap="round"/>` + ring('#f472b6') + sparkles('#38bdf8') + flames,
  ],
}
const levelNames = ['Level 1 · Hatchling', 'Level 2 · Sparky', 'Level 3 · Grown', 'Level 4 · Charged', 'Level 5 · Legendary']
const levelAt = ['start', '100 stars', '300 stars', '700 stars', '1500 stars']
let html2 = css + '<h1>Proposed: character levels</h1><p>The buddy itself grows with stars (effort), independent of outfits: new antennas, bigger wings, extra eyes, flames, auras. Mockup, not yet in the app.</p>'
for (const c of CHARACTERS) {
  html2 += `<h2>${c.emoji} ${c.name}</h2><div class="grid5">`
  levelExtras[c.base].forEach((ov, i) => {
    html2 += card(svg(c.base, `${c.base}-classic`, i >= 3 ? 'happy' : 'idle', 150, ov), levelNames[i], levelAt[i], i === 4 ? '#fef9c3' : '#fff')
  })
  html2 += '</div>'
}

// ---------- 3. mix and match parts (mockup) ----------
const hatTop = { robot: 38, dragon: 44, monster: 46 }
const extraScarf = (base) => `<path d="M62 ${base === 'monster' ? 150 : 122} q 38 18 76 0 v 12 q -38 18 -76 0 z" fill="#0ea5e9" stroke="#0c4a6e" stroke-width="3"/>`
const extraHat = (base) => {
  const t = hatTop[base]
  return `<path d="M58 ${t + 2} a 42 34 0 0 1 84 0 z" fill="#22c55e" stroke="#14532d" stroke-width="3"/><path d="M100 ${t + 2} h 60 a 8 8 0 0 1 0 12 h -60 z" fill="#15803d" stroke="#14532d" stroke-width="3"/>`
}
const auraStars = sparkles('#f59e0b')
const auraFire = flames
const auraBubbles = [[30, 60, 9], [170, 80, 7], [40, 150, 6], [165, 160, 10], [100, 14, 5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#38bdf8" stroke-width="3" opacity=".8"/>`).join('')
const combos = [
  ['robot', 'robot-stars300', 'island11', 'Sky body + sunglasses + scarf + bubbles', extraScarf('robot') + auraBubbles],
  ['robot', 'robot-island1', 'island1', 'Pink body + beach cap + stars aura', auraStars],
  ['robot', 'robot-stars1000', 'island10', 'Midnight body + shield + fire aura', auraFire],
  ['dragon', 'dragon-stars60', 'island2', 'Orange body + glasses + green hat', extraHat('dragon')],
  ['dragon', 'dragon-stars300', 'island9', 'Sky body + halo + scarf + bubbles', extraScarf('dragon') + auraBubbles],
  ['dragon', 'dragon-island6', 'island6', 'Red body + bandana + fire aura', auraFire],
  ['monster', 'monster-stars150', 'island5', 'Rose body + flower + stars aura', auraStars],
  ['monster', 'monster-stars300', 'island12', 'Cyan body + cape + hat + bubbles', extraHat('monster') + auraBubbles],
  ['monster', 'monster-stars1500', 'island16', 'Golden body + crown + scarf + fire', extraScarf('monster') + auraFire],
]
let html3 = css + '<h1>Proposed: mix-and-match parts</h1><p>Body colour, hat, face, outfit and aura become separate unlocks the child combines. Each part is its own reward moment. Mockup.</p><div class="grid" style="grid-template-columns:repeat(3,1fr)">'
for (const [base, skin, acc, title, ov] of combos) {
  // use the accessory from another skin by rendering that skin's accessory with this skin's colours
  const s = SKINS.find((x) => x.id === skin)
  const merged = { ...s, accessory: SKINS.find((x) => x.id === `${base}-${acc}`)?.accessory ?? s.accessory }
  const markup = renderToStaticMarkup(createElement(Character, { base, skinId: merged.id, mood: 'happy', size: 170 }))
  const accMarkup = renderToStaticMarkup(createElement(Character, { base, skinId: `${base}-${acc}`, mood: 'happy', size: 170 }))
  // swap body colours: take accessory render and recolour its body/accent to the chosen skin
  const target = SKINS.find((x) => x.id === `${base}-${acc}`)
  const recoloured = accMarkup.split(target.body).join(s.body).split(target.accent).join(s.accent)
  void markup
  html3 += card(recoloured.replace('</svg>', ov + '</svg>'), title, '', '#fff')
}
html3 += '</div>'

fs.mkdirSync('e2e/shots', { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1.5 })
for (const [name, html] of [['gallery-skins', html1], ['gallery-levels', html2], ['gallery-parts', html3]]) {
  await page.setContent(`<!doctype html><html><head><link rel="stylesheet" href="file://${process.cwd()}/public/fonts/fonts.css"></head><body>${html}</body></html>`)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `e2e/shots/${name}.png`, fullPage: true })
  console.log('wrote', name)
}
await browser.close()
