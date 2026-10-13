/**
 * Generates every app icon and splash screen from the chosen design ("Ember
 * reads": the dragon peeking over an open book on a blue gradient).
 *
 *   node scripts/generate-icons.mjs
 *
 * Writes:
 *   public/favicon.svg, public/apple-touch-icon.png
 *   public/icons/icon-192.png, icon-512.png (rounded), icon-maskable-512.png (full bleed, safe zone)
 *   android/app/src/main/res/mipmap-* /ic_launcher(.png|_round.png|_foreground.png|_background.png)
 *   public/icons/store-icon-512.png (full-bleed square for the Play Store listing)
 *   android/app/src/main/res/drawable/splash.xml (gradient + centred launcher icon, a few hundred bytes)
 */
import { createServer } from 'vite'
import { chromium } from 'playwright'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'node:fs'
import path from 'node:path'

const server = await createServer({ server: { middlewareMode: true }, logLevel: 'error', appType: 'custom' })
const { Character } = await server.ssrLoadModule('/src/components/Character.tsx')
const { defaultLook } = await server.ssrLoadModule('/src/content/parts.ts')
await server.close()

const BG_TOP = '#7dd3fc'
const BG_BOTTOM = '#2563eb'

function buddy(base, { x, y, size, view }) {
  return renderToStaticMarkup(createElement(Character, { base, look: defaultLook(base), level: 1, mood: 'happy', size: 200 }))
    .replace(/<svg[^>]*?>/, `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${view}" overflow="visible">`)
    .replace(/ class="[^"]*"/g, '')
}
function book(cx, cy, w) {
  const h = w * 0.42
  return `<g transform="translate(${cx} ${cy})">
    <path d="M${-w / 2} ${-h / 2} q ${w / 4} -${h * 0.25} ${w / 2} 0 v ${h} q -${w / 4} -${h * 0.25} -${w / 2} 0 z" fill="#ffffff" stroke="#1e1b4b" stroke-width="10" stroke-linejoin="round"/>
    <path d="M0 ${-h / 2} q ${w / 4} -${h * 0.25} ${w / 2} 0 v ${h} q -${w / 4} -${h * 0.25} -${w / 2} 0 z" fill="#ffffff" stroke="#1e1b4b" stroke-width="10" stroke-linejoin="round"/>
    <path d="M${-w * 0.4} ${-h * 0.18} q ${w * 0.15} -${h * 0.1} ${w * 0.32} 0 M${-w * 0.4} ${h * 0.08} q ${w * 0.15} -${h * 0.1} ${w * 0.32} 0" stroke="#c4b5fd" stroke-width="9" fill="none" stroke-linecap="round"/>
    <text x="${w * 0.25}" y="${h * 0.22}" font-family="Andika, Arial Rounded MT Bold, Arial, sans-serif" font-weight="700" font-size="${h * 0.62}" text-anchor="middle" fill="#6d28d9">a</text>
  </g>`
}
const sparkle = (x, y, s, c = '#fde047') =>
  `<path d="M${x} ${y - s} L${x + s * 0.28} ${y - s * 0.28} L${x + s} ${y} L${x + s * 0.28} ${y + s * 0.28} L${x} ${y + s} L${x - s * 0.28} ${y + s * 0.28} L${x - s} ${y} L${x - s * 0.28} ${y - s * 0.28} Z" fill="${c}"/>`

/** The background layer (512 box). */
const background = () =>
  `<defs><linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${BG_TOP}"/><stop offset="1" stop-color="${BG_BOTTOM}"/></linearGradient></defs><rect width="512" height="512" fill="url(#bg)"/>`
/** The artwork layer (512 box): Ember over a book, plus sparkles. */
const artwork = () => sparkle(420, 90, 30) + sparkle(80, 110, 20) + buddy('dragon', { x: 66, y: 30, size: 380, view: '28 10 144 144' }) + book(256, 400, 330)
/** Artwork scaled about the centre (for adaptive/maskable safe zones). */
const scaled = (s) => `<g transform="translate(256 256) scale(${s}) translate(-256 -256)">${artwork()}</g>`

const svgDoc = (inner, size, clip) => {
  const clipDef = clip === 'round' ? '<clipPath id="k"><circle cx="256" cy="256" r="256"/></clipPath>' : clip === 'rounded' ? '<clipPath id="k"><rect width="512" height="512" rx="115"/></clipPath>' : ''
  const open = clip ? '<g clip-path="url(#k)">' : '<g>'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><defs>${clipDef}</defs>${open}${inner}</g></svg>`
}

const fontsHref = `file://${process.cwd()}/public/fonts/fonts.css`
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const page = await browser.newPage({ deviceScaleFactor: 1 })

async function png(file, width, height, bodyHtml, transparent = true) {
  await page.setViewportSize({ width, height })
  await page.setContent(`<!doctype html><html><head><link rel="stylesheet" href="${fontsHref}"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style></head><body>${bodyHtml}</body></html>`)
  await page.evaluate(() => document.fonts.ready)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  await page.screenshot({ path: file, omitBackground: transparent, clip: { x: 0, y: 0, width, height } })
}

// ---------------- web ----------------
const full = background() + artwork()
fs.writeFileSync('public/favicon.svg', svgDoc(full, 512, 'rounded').replace(/font-family="[^"]*"/g, 'font-family="Arial Rounded MT Bold, Arial, sans-serif"'))
await png('public/icons/icon-192.png', 192, 192, svgDoc(full, 192, 'rounded'))
await png('public/icons/icon-512.png', 512, 512, svgDoc(full, 512, 'rounded'))
// Maskable safe zone is the central 80% circle: keep the art inside it.
await png('public/icons/icon-maskable-512.png', 512, 512, svgDoc(background() + scaled(0.72), 512, null), false)
// Play Store applies its own corner mask, so the listing icon must be a full square.
await png('public/icons/store-icon-512.png', 512, 512, svgDoc(full, 512, null), false)
await png('public/apple-touch-icon.png', 180, 180, svgDoc(full, 180, null), false)

// ---------------- android launcher ----------------
const RES = 'android/app/src/main/res'
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
for (const [d, k] of Object.entries(DENSITIES)) {
  const legacy = Math.round(48 * k)
  const adaptive = Math.round(108 * k)
  await png(`${RES}/mipmap-${d}/ic_launcher.png`, legacy, legacy, svgDoc(full, legacy, 'rounded'))
  await png(`${RES}/mipmap-${d}/ic_launcher_round.png`, legacy, legacy, svgDoc(full, legacy, 'round'))
  // Adaptive: 108dp layers, launcher masks to ~72dp; keep art inside the 66dp safe zone.
  await png(`${RES}/mipmap-${d}/ic_launcher_foreground.png`, adaptive, adaptive, svgDoc(scaled(0.56), adaptive, null))
  await png(`${RES}/mipmap-${d}/ic_launcher_background.png`, adaptive, adaptive, svgDoc(background(), adaptive, null), false)
}
const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`
fs.writeFileSync(`${RES}/mipmap-anydpi-v26/ic_launcher.xml`, adaptiveXml)
fs.writeFileSync(`${RES}/mipmap-anydpi-v26/ic_launcher_round.xml`, adaptiveXml)
fs.writeFileSync(`${RES}/values/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG_BOTTOM}</color>\n</resources>\n`)

// ---------------- android splash ----------------
// A vector layer-list instead of full-screen PNGs: same look, a few hundred bytes instead of megabytes.
for (const f of fs.readdirSync(RES)) {
  if (f.startsWith('drawable') && f !== 'drawable-nodpi' && fs.existsSync(`${RES}/${f}/splash.png`)) fs.rmSync(`${RES}/${f}/splash.png`)
  if (f.startsWith('drawable-') && fs.existsSync(`${RES}/${f}`) && fs.readdirSync(`${RES}/${f}`).length === 0) fs.rmdirSync(`${RES}/${f}`)
}
// The splash needs a plain bitmap: @mipmap/ic_launcher is an adaptive-icon XML on Android 8+.
await png(`${RES}/drawable-nodpi/splash_icon.png`, 480, 480, svgDoc(full, 480, 'rounded'))
fs.writeFileSync(`${RES}/drawable/splash.xml`, `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by scripts/generate-icons.mjs -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <shape android:shape="rectangle">
            <gradient android:angle="270" android:startColor="${BG_TOP}" android:endColor="${BG_BOTTOM}" />
        </shape>
    </item>
    <item android:width="160dp" android:height="160dp" android:gravity="center">
        <bitmap android:src="@drawable/splash_icon" android:gravity="fill" />
    </item>
</layer-list>
`)

await browser.close()
console.log('Icons and splash screens written.')
