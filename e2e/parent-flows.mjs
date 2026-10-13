// Parent flows added for release: restore from the first screen, gate lockout, re-lock on leaving.
import { chromium } from 'playwright'
const base = process.argv[2] ?? 'http://localhost:4173'
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const fail = (m) => { console.error('FAIL:', m); errors.push(m) }
const solveGate = async () => {
  const q = await page.locator('.text-5xl').innerText()
  const [a, b] = q.match(/\d+/g).map(Number)
  await page.fill('#parent-answer', String(a * b))
  await page.click('button:has-text("Enter")')
}

// 1. Fresh install: restore link on onboarding leads to a sign-in-only dashboard.
await page.goto(base + '/#/')
// The restore link only shows when cloud backup is configured; go to the gate directly otherwise.
if (await page.locator('text=Sign in to restore progress').count()) await page.click('text=Sign in to restore progress')
else await page.goto(base + '/#/parent')
await solveGate()
await page.waitForSelector('text=Restore progress')
const accountCard = (await page.locator('text=Cloud backup is not available').count()) + (await page.locator('button:has-text("Sign in")').count())
if (!accountCard) fail('restore screen did not show the account card')
await page.screenshot({ path: 'e2e/shots/restore.png' })

// 2. Leaving the dashboard locks it again.
await page.click('[aria-label="Back"]')
await page.waitForSelector('text=Start the adventure')
await page.goto(base + '/#/parent/dashboard')
await page.waitForSelector('text=Parents only')

// 3. Three wrong answers lock the gate for a minute.
for (let i = 0; i < 3; i++) {
  await page.fill('#parent-answer', '1')
  await page.click('button:has-text("Enter")')
}
if (!(await page.locator('text=Too many tries').count())) fail('gate did not lock after 3 wrong answers')
await page.screenshot({ path: 'e2e/shots/gate-locked.png' })

console.log('errors:', errors.length ? errors : 'none')
await browser.close()
if (errors.length) process.exit(1)
