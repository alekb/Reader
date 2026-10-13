// Screenshot of the Paint tab with a painted hat and outfit.
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })
const page = await browser.newPage({ viewport: { width: 412, height: 1100 }, deviceScaleFactor: 1.5 })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto('http://localhost:4173/#/')
const now = Date.now()
const progress = { version: 2, childName: 'Leo', character: 'dragon', look: { color: 'color-dragon-sky', hat: 'hat-cap', face: 'face-glasses', outfit: 'outfit-scarf', aura: 'aura-sparkles', hatPaint: 'green', outfitPaint: 'purple' },
  unlockedParts: ['color-dragon-classic', 'color-dragon-sky', 'hat-cap', 'face-glasses', 'outfit-scarf', 'aura-sparkles', 'paint-red', 'paint-blue', 'paint-green', 'paint-pink', 'paint-orange', 'paint-purple'], stickers: ['cat', 'owl', 'unicorn'], lastEggDay: '',
  xp: 320, wordsRead: 0, knownWords: {}, gpcs: {}, tricky: {}, groupWords: {}, completedGroups: [1], currentGroup: 2, sessionsCompleted: 6, lastSessionAccuracy: 1, streak: { count: 2, lastDay: '' }, dailyGoalMin: 12, settings: { sfx: false, voiceRate: 0.9 }, createdAt: now, updatedAt: now }
await page.evaluate((p) => localStorage.setItem('reader-quest-progress', JSON.stringify({ state: { progress: p, sessions: [], lastSummary: null }, version: 2 })), progress)
await page.goto('http://localhost:4173/#/wardrobe')
await page.reload()
await page.waitForSelector('text=Looks')
await page.click('button:has-text("Paint")')
await page.waitForTimeout(300)
await page.screenshot({ path: 'e2e/shots/paint-tab.png', fullPage: true })
await page.goto('http://localhost:4173/#/stickers')
await page.waitForSelector('text=Sticker book')
await page.screenshot({ path: 'e2e/shots/stickers.png', fullPage: false })
console.log('errors:', errors.length ? errors : 'none')
await browser.close()
