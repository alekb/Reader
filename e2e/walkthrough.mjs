// Headless walkthrough of the app: renders PWA icons and screenshots the main flows.
// Usage: node e2e/walkthrough.mjs <baseUrl> <outDir>
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const base = process.argv[2] ?? 'http://localhost:4173'
const out = process.argv[3] ?? 'e2e/shots'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await ctx.addInitScript(() => {
  // Make speech instant in headless mode.
  const synth = { speak: (u) => setTimeout(() => u.onend && u.onend(), 10), cancel() {}, getVoices: () => [], addEventListener() {} }
  Object.defineProperty(window, 'speechSynthesis', { value: synth })
  window.SpeechSynthesisUtterance = function (t) { this.text = t }
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

// ---- icons ----
const svg = fs.readFileSync('public/favicon.svg', 'utf8')
for (const size of [192, 512]) {
  const p = await ctx.newPage()
  await p.setViewportSize({ width: size, height: size })
  await p.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`)
  await p.screenshot({ path: path.join('public/icons', `icon-${size}.png`), omitBackground: true })
  await p.close()
}

const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) })

// Optional: seed a learner who already knows 8 sounds so later activities run.
if (process.env.SEED) {
  const now = Date.now()
  const d = 86400000
  const item = (daysAgo) => ({ box: 2, due: now - d, correctStreak: 1, lastStreakDay: '', introduced: now - daysAgo * d, lastSeen: now - d, seen: 4, correct: 4, wrong: 0 })
  const gpcs = Object.fromEntries(['s', 'a', 't', 'p', 'i', 'n', 'm', 'd'].map((id, i) => [id, item(8 - i)]))
  const progress = {
    version: 1, childName: 'Leo', character: 'monster', skinId: 'monster-classic', unlockedSkins: ['robot-classic', 'dragon-classic', 'monster-classic'],
    xp: 120, wordsRead: 10, knownWords: { sat: 2 }, gpcs, tricky: { the: item(2) }, groupWords: {}, completedGroups: [1], currentGroup: 2,
    sessionsCompleted: 4, lastSessionAccuracy: 0.9, streak: { count: 3, lastDay: '' }, dailyGoalMin: 12, settings: { sfx: true, voiceRate: 0.9 }, createdAt: now - 9 * d, updatedAt: now,
  }
  await page.goto(base + '/#/')
  await page.evaluate((p) => localStorage.setItem('reader-quest-progress', JSON.stringify({ state: { progress: p, sessions: [], lastSummary: null }, version: 1 })), progress)
  await page.reload()
}

await page.goto(base + '/#/')
if (!process.env.SEED) {
  await page.waitForSelector('text=Reader Quest')
  await shot('01-onboarding')
  await page.click('text=Ember')
  await page.fill('input[placeholder="Type your name"]', 'Leo')
  await page.click('text=Start the adventure')
}
await page.waitForSelector('text=Play')
await shot('02-home')
await page.click('text=Looks')
await page.waitForSelector('text=Tap to wear', { timeout: 3000 }).catch(() => {})
await shot('03-wardrobe')
await page.click('[aria-label="Back"]')
await page.click('text=ABC')
await shot('04-alphabet')
await page.click('[aria-label="Back"]')

// ---- play a session ----
await page.click('text=Play')
await page.waitForTimeout(800)
await shot('05-lesson-start')
let step = 0
for (let i = 0; i < 80; i++) {
  await page.waitForTimeout(400)
  const url = page.url()
  if (url.includes('/done')) break
  const title = await page.locator('.sticky .text-xl').first().innerText().catch(() => '')
  // New sound intro
  if (await page.locator('text=Next ➜').count()) {
    await shot(`06-${step++}-${title.replace(/\s/g, '_')}`)
    await page.click('text=Next ➜')
    continue
  }
  // Tracing canvas: scribble over it
  const canvas = page.locator('canvas')
  if (await canvas.count()) {
    const box = await canvas.boundingBox()
    if (box) {
      await shot(`06-${step++}-trace`)
      for (let k = 0; k < 14; k++) {
        const x = box.x + box.width * (0.2 + 0.6 * Math.random())
        const y = box.y + box.height * (0.15 + 0.7 * Math.random())
        await page.mouse.move(x, y)
        await page.mouse.down()
        for (let s = 0; s < 12; s++) await page.mouse.move(x + (Math.random() - 0.5) * 120, y + (Math.random() - 0.5) * 160)
        await page.mouse.up()
      }
      await page.waitForTimeout(300)
      const done = page.locator('button:has-text("Done")')
      if (await done.isEnabled().catch(() => false)) await done.click()
      continue
    }
  }
  if (await page.locator('text=I read it!').count()) {
    await shot(`06-${step++}-${title.replace(/\s/g, '_')}`)
    await page.click('text=I read it!')
    continue
  }
  // Build word: tap tiles in order is unknown; tap the enabled tiles until boxes fill
  if (title === 'Build words') {
    await shot(`06-${step++}-build`)
    const tiles = page.locator('button.tile.font-letter:not([disabled])')
    const n = await tiles.count()
    for (let k = 0; k < n; k++) {
      const t = page.locator('button.tile.font-letter:not([disabled])').first()
      if (await t.count()) await t.click().catch(() => {})
      await page.waitForTimeout(150)
    }
    await page.waitForTimeout(2500)
    continue
  }
  // Choice quiz: click the first option (may be wrong -> correction flow)
  const opts = page.locator('.grid button.tile')
  if (await opts.count()) {
    await shot(`06-${step++}-${title.replace(/\s/g, '_')}`)
    await opts.first().click()
    await page.waitForTimeout(600)
    // if the correction flow is active, click the glowing correct answer
    const glow = page.locator('.grid button.animate-glow')
    if (await glow.count()) {
      await page.waitForTimeout(400)
      await glow.first().click()
    }
    continue
  }
}
await page.waitForSelector('text=Session done!', { timeout: 10000 })
await shot('07-session-done')
await page.click('text=Done ✓')
await page.waitForSelector('text=Play')
await shot('08-home-after')

// ---- parent dashboard ----
await page.click('text=Parents')
const q = await page.locator('.text-5xl').innerText()
const [a, b] = q.match(/\d+/g).map(Number)
await page.fill('input', String(a * b))
await page.click('text=Enter')
await page.waitForSelector('text=Parent dashboard')
await shot('09-dash-progress')
await page.click('button:has-text("Activity")')
await shot('10-dash-activity')
await page.click('button:has-text("Sounds")')
await shot('11-dash-sounds')
await page.click('button:has-text("Account")')
await shot('12-dash-account')
await page.click('button:has-text("Settings")')
await shot('13-dash-settings')

// ---- persistence: reload keeps progress ----
await page.goto(base + '/#/')
await page.waitForSelector('text=Play')
const stars = await page.locator('text=/⭐ \\d+/').first().innerText()
console.log('stars after reload:', stars)
console.log('errors:', errors.length ? errors : 'none')
await browser.close()
if (errors.length) process.exit(1)
