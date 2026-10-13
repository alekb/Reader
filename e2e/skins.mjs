import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })
const ctx = await browser.newContext({ viewport: { width: 412, height: 2600 }, deviceScaleFactor: 1.5 })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto('http://localhost:4173/#/')
const now = Date.now()
const progress = { version: 1, childName: 'Leo', character: 'robot', skinId: 'robot-classic', unlockedSkins: [], xp: 2000, wordsRead: 0, knownWords: {}, gpcs: {}, tricky: {}, groupWords: {}, completedGroups: [], currentGroup: 1, sessionsCompleted: 0, lastSessionAccuracy: 1, streak: { count: 0, lastDay: '' }, dailyGoalMin: 12, settings: { sfx: false, voiceRate: 0.9 }, createdAt: now, updatedAt: now }
await page.evaluate((p) => localStorage.setItem('reader-quest-progress', JSON.stringify({ state: { progress: p, sessions: [], lastSummary: null }, version: 1 })), progress)
await page.goto('http://localhost:4173/#/wardrobe')
await page.reload()
await page.waitForSelector('text=Looks')
// unlock everything for the screenshot
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('reader-quest-progress'))
  raw.state.progress.unlockedSkins = ['*']
  localStorage.setItem('reader-quest-progress', JSON.stringify(raw))
})
for (const name of ['Bolt', 'Ember', 'Fuzz']) {
  await page.click(`button:has-text("${name}")`)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `e2e/shots/skins-${name}.png`, fullPage: true })
}
console.log('errors:', errors.length ? errors : 'none')
await browser.close()
