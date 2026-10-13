/**
 * Spaced-repetition scheduler (Leitner boxes) and mastery rules.
 *
 * Box intervals follow the design brief in docs/RESEARCH.md §10.2:
 * new → same session ×3 → 1 day → 2 → 4 → 7 → 14 → 30 days.
 */
import type { ItemState, Progress } from './types'

export const BOX_INTERVAL_DAYS = [0, 1, 2, 4, 7, 14, 30]
export const MAX_BOX = BOX_INTERVAL_DAYS.length - 1
export const DAY_MS = 24 * 60 * 60 * 1000
/** Responses faster than this are "automatic". */
export const AUTOMATIC_MS = 2500

export function dayKey(ts: number): string {
  const d = new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function newItem(now: number): ItemState {
  return { box: 0, due: now, correctStreak: 0, lastStreakDay: '', introduced: now, lastSeen: now, seen: 0, correct: 0, wrong: 0 }
}

/** Start of the next calendar day in local time, plus (days-1) more days. */
function dueAfterDays(now: number, days: number): number {
  if (days <= 0) return now
  const d = new Date(now)
  d.setHours(4, 0, 0, 0) // 4am local: a "day" rolls over while the child sleeps
  d.setDate(d.getDate() + days)
  return d.getTime()
}

/**
 * Apply one answer to an item. Fast correct → promote; slow correct → stay;
 * wrong → demote one box and make due immediately.
 */
export function applyAnswer(item: ItemState, correct: boolean, ms: number, now: number, scheduled: boolean): ItemState {
  const next: ItemState = { ...item, seen: item.seen + 1, lastSeen: now }
  const today = dayKey(now)
  if (correct) {
    next.correct++
    if (ms <= AUTOMATIC_MS || item.box === 0) next.box = Math.min(MAX_BOX, item.box + 1)
    if (scheduled && item.lastStreakDay !== today) {
      next.correctStreak = item.correctStreak + 1
      next.lastStreakDay = today
    }
    next.due = dueAfterDays(now, BOX_INTERVAL_DAYS[next.box])
  } else {
    next.wrong++
    next.box = Math.max(0, item.box - 1)
    next.correctStreak = 0
    next.lastStreakDay = ''
    next.due = now
  }
  return next
}

export type MasteryLevel = 'new' | 'learning' | 'secure' | 'mastered'

export function masteryOf(item: ItemState | undefined): MasteryLevel {
  if (!item || item.seen === 0) return 'new'
  if (item.box >= 3 && item.correctStreak >= 3) return 'mastered'
  if (item.box >= 2) return 'secure'
  return 'learning'
}

export function isDue(item: ItemState, now: number): boolean {
  return item.due <= now
}

/** Items in the given map that are due now, oldest-due first. */
export function dueItems(map: Record<string, ItemState>, now: number): string[] {
  return Object.entries(map)
    .filter(([, it]) => isDue(it, now))
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id)
}

/**
 * Count of items still in the "fragile" boxes 0-1 that have had at least a day
 * to be promoted (brand-new items from the last session do not count).
 */
export function fragileCount(map: Record<string, ItemState>, now: number): number {
  return Object.values(map).filter((it) => it.box <= 1 && now - it.introduced > DAY_MS).length
}

/** Update the daily streak given a completed session today. */
export function bumpStreak(streak: Progress['streak'], now: number): Progress['streak'] {
  const today = dayKey(now)
  if (streak.lastDay === today) return streak
  const yesterday = dayKey(now - DAY_MS)
  if (streak.lastDay === yesterday) return { count: streak.count + 1, lastDay: today }
  return { count: 1, lastDay: today }
}

/** The streak as it stands right now (0 if the chain was broken before today). */
export function currentStreak(streak: Progress['streak'], now: number): number {
  const today = dayKey(now)
  const yesterday = dayKey(now - DAY_MS)
  if (streak.lastDay === today || streak.lastDay === yesterday) return streak.count
  return 0
}
