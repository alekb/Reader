import { CHARACTER_BY_BASE } from '../content/characters'
import { dayKey } from './scheduler'
import type { ChildRecord } from './types'

/** The daily reminder, set per device (a parent may want it on the child's tablet, not their own phone). */
export interface ReminderSettings {
  enabled: boolean
  hour: number
  minute: number
}

export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, hour: 17, minute: 0 }

/** Minutes practised today, as Home shows them. */
export function minutesToday(sessions: ChildRecord['sessions'], now: number): number {
  const today = dayKey(now)
  return Math.round(sessions.filter((s) => dayKey(s.startedAt) === today).reduce((a, s) => a + s.durationSec, 0) / 60)
}

/** True once every child on this device has reached today's goal. */
export function goalsDoneToday(children: ChildRecord[], now: number): boolean {
  return children.length > 0 && children.every((c) => minutesToday(c.sessions, now) >= c.progress.dailyGoalMin)
}

/** When to remind over the next `days` days: today is skipped once its time has passed or the goal is done. */
export function reminderTimes(s: ReminderSettings, now: number, doneToday: boolean, days: number): Date[] {
  if (!s.enabled) return []
  const out: Date[] = []
  for (let d = 0; d < days; d++) {
    const at = new Date(now)
    at.setDate(at.getDate() + d)
    at.setHours(s.hour, s.minute, 0, 0)
    if (d === 0 && (doneToday || at.getTime() <= now)) continue
    out.push(at)
  }
  return out
}

/** What the reminder says: the child and their buddy by name when there is one child. */
export function reminderText(children: ChildRecord[]): { title: string; body: string } | null {
  if (!children.length) return null
  if (children.length === 1) {
    const p = children[0].progress
    return { title: `Time to read, ${p.childName}! 📖`, body: `${CHARACTER_BY_BASE[p.character]?.name ?? 'Your buddy'} is waiting for you.` }
  }
  const names = children.map((c) => c.progress.childName)
  return { title: 'Time to read! 📖', body: `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}: your buddies are waiting.` }
}
