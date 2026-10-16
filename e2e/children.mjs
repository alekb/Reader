// Several children on one device: add, pick, switch, keep progress apart, remove, and upgrade from one child.
import { chromium } from 'playwright'
import fs from 'node:fs'
const base = process.argv[2] ?? 'http://localhost:4173'
const out = 'e2e/shots-children'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const fail = (m) => { console.error('FAIL:', m); errors.push(m) }
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` })
const onboard = async (buddy, name) => {
  await page.click(`text=${buddy}`)
  await page.fill('input[placeholder="Type your name"]', name)
  await page.click('text=Start the adventure')
  await page.waitForSelector('text=Play')
}
const dashboard = async () => {
  await page.goto(base + '/#/parent')
  const q = await page.locator('.text-5xl').innerText()
  const [a, b] = q.match(/\d+/g).map(Number)
  await page.fill('#parent-answer', String(a * b))
  await page.click('button:has-text("Enter")')
  await page.waitForSelector('[aria-label="Children"]')
}
const homeName = () => page.locator('.text-3xl.text-grape').first().innerText()
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('reader-quest-progress')).state)

// 1. First child, then a second one added from the dashboard.
await page.goto(base + '/#/')
await onboard('Ember', 'Leo')
if (await page.locator('[aria-label="Switch player"]').count()) fail('switch button shown with one child')
await dashboard()
await page.click('text=+ Add a child')
await page.waitForSelector('text=Back to the other children')
await shot('01-add-child')
await onboard('Bolt', 'Mia')
if ((await homeName()) !== 'Mia') fail('new child is not the one playing')
await shot('02-home-mia')

// 2. Next app start asks who is playing; each child keeps their own progress.
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('reader-quest-progress'))
  raw.state.progress.xp = 77 // Mia's stars
  localStorage.setItem('reader-quest-progress', JSON.stringify(raw))
})
await page.reload()
await page.waitForSelector("text=Who's playing?")
await shot('03-who-is-playing')
await page.click('button.tile:has-text("Leo")')
await page.waitForSelector('text=Play')
if ((await homeName()) !== 'Leo') fail('picker did not switch to Leo')
if ((await page.locator('text=/⭐ \\d+/').first().innerText()).includes('77')) fail("Leo shows Mia's stars")
await page.click('[aria-label="Switch player"]')
await page.click('button.tile:has-text("Mia")')
await page.waitForSelector('text=Play')
if (!(await page.locator('text=/⭐ 77/').count())) fail("Mia's stars were lost")

// 3. Dashboard: switch the child shown, give Mia the male voice, then remove Mia.
await dashboard()
await shot('04-dashboard-children')
await page.click('button:has-text("Settings")')
await page.getByRole('radio', { name: 'Male', exact: true }).click()
await page.getByRole('tab', { name: /Leo/ }).click()
if ((await page.locator('[role=radio][aria-checked=true]').innerText()) !== 'Female') fail("Leo's voice changed with Mia's")
await page.getByRole('tab', { name: /Mia/ }).click()
if ((await page.locator('[role=radio][aria-checked=true]').innerText()) !== 'Male') fail("Mia's voice was not kept")
await page.click('button:has-text("Remove Mia")')
await shot('05-remove-confirm')
await page.click('button:has-text("Yes, remove Mia")')
await page.waitForSelector('text=Play')
if ((await homeName()) !== 'Leo') fail('after removing Mia, Leo is not playing')
if (await page.locator('[aria-label="Switch player"]').count()) fail('switch button still shown with one child left')
const after = await stored()
if (Object.keys(after.others).length) fail('Mia is still stored')

// 4. Upgrade: progress saved by the one-child version becomes the first child, untouched.
const now = Date.now()
const legacy = {
  version: 2, childName: 'Ava', character: 'monster', look: { color: 'color-monster-classic', hat: null, face: null, outfit: null, aura: null, hatPaint: null, outfitPaint: null },
  unlockedParts: [], stickers: [], lastEggDay: '', xp: 42, wordsRead: 3, knownWords: {}, gpcs: {}, tricky: {}, groupWords: {}, completedGroups: [], currentGroup: 1,
  sessionsCompleted: 2, lastSessionAccuracy: 1, streak: { count: 1, lastDay: '' }, dailyGoalMin: 12, settings: { sfx: true, voiceRate: 0.9 }, createdAt: now, updatedAt: now,
}
await page.evaluate((p) => localStorage.setItem('reader-quest-progress', JSON.stringify({ state: { progress: p, sessions: [], lastSummary: null }, version: 3 })), legacy)
await page.reload()
await page.waitForSelector('text=Play')
if ((await homeName()) !== 'Ava') fail('one-child progress did not load')
if (!(await page.locator('text=/⭐ 42/').count())) fail('one-child stars were lost')
await page.waitForTimeout(300)
const upgraded = await stored()
if (upgraded.progress.id !== 'main') fail(`upgraded child id is ${upgraded.progress.id}, expected main`)
if (upgraded.progress.settings.voice !== 'female') fail('upgraded child has no voice setting')

console.log('errors:', errors.length ? errors : 'none')
await browser.close()
if (errors.length) process.exit(1)
