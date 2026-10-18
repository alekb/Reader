// Renders a colour gallery of every part, level and some combined looks to e2e/shots/gallery-*.png
import { createServer } from 'vite'
import { chromium } from 'playwright'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'node:fs'

const server = await createServer({ server: { middlewareMode: true }, logLevel: 'error', appType: 'custom' })
const { Character } = await server.ssrLoadModule('/src/components/Character.tsx')
const { PARTS, SLOTS, SLOT_LABEL, levelName, levelXp, defaultLook, partsForSlot, unlockDescription } = await server.ssrLoadModule('/src/content/parts.ts')
const { CHARACTERS } = await server.ssrLoadModule('/src/content/characters.ts')
await server.close()

const svg = (base, look, level = 1, mood = 'idle', size = 140) => renderToStaticMarkup(createElement(Character, { base, look, level, mood, size }))
const card = (inner, title, sub = '', bg = '#fff') => `<div class="card" style="background:${bg}"><div>${inner}</div><div class="t">${title}</div><div class="s">${sub}</div></div>`
const css = `<style>
body{margin:0;background:#fef3c7;font-family:Baloo 2,Nunito,Arial,sans-serif;color:#1e1b4b;padding:24px}
h1{font-size:30px;margin:0 0 4px;color:#6d28d9} h2{font-size:22px;margin:28px 0 8px} p{margin:0 0 12px;color:#4c4a6b}
.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px} .grid5{display:grid;grid-template-columns:repeat(5,1fr);gap:12px} .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.card{border-radius:24px;padding:12px 8px;text-align:center;box-shadow:0 6px 0 rgba(0,0,0,.12)} .t{font-weight:800;font-size:15px;margin-top:4px} .s{font-size:11px;color:#6b7280;font-weight:700}
</style>`

// 1. every part, shown on each character
let html1 = css + `<h1>Reader Quest · all parts (${PARTS.length})</h1><p>Each part is its own unlock. Colours are per buddy; hats, faces, outfits and auras fit all three.</p>`
for (const slot of SLOTS) {
  html1 += `<h2>${SLOT_LABEL[slot]}</h2><div class="grid">`
  for (const c of CHARACTERS) {
    for (const p of partsForSlot(slot, c.base)) {
      if (slot !== 'color' && c.base !== 'robot' && p.slot !== 'color') continue
      const look = { ...defaultLook(c.base), [slot]: p.id }
      html1 += card(svg(c.base, look, 1, 'happy', 110), `${p.icon} ${p.name}`, unlockDescription(p.unlock))
    }
  }
  html1 += '</div>'
  if (slot !== 'color') {
    html1 += `<div class="grid">`
    for (const c of CHARACTERS.slice(1)) for (const p of partsForSlot(slot, c.base).slice(0, 3)) html1 += card(svg(c.base, { ...defaultLook(c.base), [slot]: p.id }, 1, 'happy', 110), `${p.icon} ${p.name}`, `on ${c.name}`)
    html1 += '</div>'
  }
}

// 2. levels
let html2 = css + '<h1>Character levels</h1><p>The buddy grows with stars, independent of outfit.</p>'
for (const c of CHARACTERS) {
  html2 += `<h2>${c.emoji} ${c.name}</h2><div class="grid5">`
  for (let lvl = 1; lvl <= 5; lvl++) html2 += card(svg(c.base, defaultLook(c.base), lvl, lvl >= 4 ? 'happy' : 'idle', 150), `Level ${lvl} · ${levelName(lvl)}`, `${levelXp(lvl)} stars`, lvl === 5 ? '#fef9c3' : '#fff')
  html2 += '</div>'
}

// 3. combined looks
const combos = [
  ['robot', { color: 'color-robot-sky', hat: null, face: 'face-sunglasses', outfit: 'outfit-scarf', aura: 'aura-bubbles' }, 3],
  ['robot', { color: 'color-robot-rose', hat: 'hat-cap', face: null, outfit: 'outfit-badge', aura: 'aura-sparkles' }, 2],
  ['robot', { color: 'color-robot-midnight', hat: 'hat-pirate', face: null, outfit: 'outfit-shield', aura: 'aura-fire' }, 4],
  ['robot', { color: 'color-robot-golden', hat: 'hat-crown', face: 'face-stars', outfit: 'outfit-cape', aura: 'aura-ring' }, 5],
  ['dragon', { color: 'color-dragon-lime', hat: 'hat-flower', face: 'face-glasses', outfit: 'outfit-bowtie', aura: null }, 2],
  ['dragon', { color: 'color-dragon-sky', hat: 'hat-halo', face: null, outfit: 'outfit-scarf', aura: 'aura-bubbles' }, 3],
  ['dragon', { color: 'color-dragon-sunset', hat: 'hat-bandana', face: null, outfit: 'outfit-medal', aura: 'aura-fire' }, 4],
  ['dragon', { color: 'color-dragon-golden', hat: 'hat-wizard', face: 'face-monocle', outfit: 'outfit-wings', aura: 'aura-rainbow' }, 5],
  ['monster', { color: 'color-monster-berry', hat: 'hat-flower', face: null, outfit: 'outfit-badge', aura: 'aura-sparkles' }, 2],
  ['monster', { color: 'color-monster-sky', hat: 'hat-party', face: 'face-headphones', outfit: 'outfit-cape', aura: 'aura-bubbles' }, 3],
  ['monster', { color: 'color-monster-mint', hat: 'hat-astro', face: null, outfit: 'outfit-backpack', aura: 'aura-lightning' }, 4],
  ['monster', { color: 'color-monster-golden', hat: 'hat-crown', face: 'face-sunglasses', outfit: 'outfit-scarf', aura: 'aura-fire' }, 5],
]
let html3 = css + '<h1>Mix-and-match looks</h1><p>Any colour + hat + face + outfit + aura, at any level.</p><div class="grid4">'
for (const [base, look, lvl] of combos) html3 += card(svg(base, look, lvl, 'happy', 170), `Level ${lvl}`, Object.values(look).filter(Boolean).map((id) => id.split('-').slice(1).join(' ')).join(' · '))
html3 += '</div>'

fs.mkdirSync('e2e/shots', { recursive: true })
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1.5 })
for (const [name, html] of [['gallery-parts', html1], ['gallery-levels', html2], ['gallery-looks', html3]]) {
  await page.setContent(`<!doctype html><html><head><link rel="stylesheet" href="file://${process.cwd()}/public/fonts/fonts.css"></head><body>${html}</body></html>`)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `e2e/shots/${name}.png`, fullPage: true })
  console.log('wrote', name)
}
await browser.close()
