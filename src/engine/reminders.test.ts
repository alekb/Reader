import { describe, expect, it } from 'vitest'
import { createProgress } from './progress'
import { goalsDoneToday, reminderText, reminderTimes } from './reminders'
import type { ChildRecord, SessionLog } from './types'

const at = (h: number, m = 0) => new Date(2026, 2, 10, h, m).getTime()
const session = (startedAt: number, min: number) => ({ id: String(startedAt), startedAt, durationSec: min * 60 }) as SessionLog
const child = (name: string, goal: number, sessions: SessionLog[]): ChildRecord => ({ progress: { ...createProgress(name, 'monkey', 1), dailyGoalMin: goal }, sessions })

describe('reminders', () => {
  const on = { enabled: true, hour: 17, minute: 30 }

  it('reminds at the chosen time each day, today included while it is still ahead', () => {
    const times = reminderTimes(on, at(9), false, 3)
    expect(times.map((t) => [t.getDate(), t.getHours(), t.getMinutes()])).toEqual([[10, 17, 30], [11, 17, 30], [12, 17, 30]])
  })

  it('skips today once the time has passed or the goal is done', () => {
    expect(reminderTimes(on, at(18), false, 3).map((t) => t.getDate())).toEqual([11, 12])
    expect(reminderTimes(on, at(9), true, 3).map((t) => t.getDate())).toEqual([11, 12])
  })

  it('schedules nothing when turned off', () => {
    expect(reminderTimes({ ...on, enabled: false }, at(9), false, 14)).toEqual([])
  })

  it('counts the goal as done only when every child on the device reached it', () => {
    const leo = child('Leo', 10, [session(at(8), 6), session(at(8, 30), 5)])
    const mia = child('Mia', 10, [session(at(8), 4)])
    const yesterday = child('Mia', 10, [session(at(8) - 86400000, 30)])
    expect(goalsDoneToday([leo], at(12))).toBe(true)
    expect(goalsDoneToday([leo, mia], at(12))).toBe(false)
    expect(goalsDoneToday([yesterday], at(12))).toBe(false)
    expect(goalsDoneToday([], at(12))).toBe(false)
  })

  it('names the child and buddy, or all the children', () => {
    expect(reminderText([child('Leo', 10, [])])).toEqual({ title: 'Time to read, Leo! 📖', body: 'Bongo is waiting for you.' })
    expect(reminderText([child('Leo', 10, []), child('Mia', 10, []), child('Ava', 10, [])])!.body).toBe('Leo, Mia and Ava: your buddies are waiting.')
    expect(reminderText([])).toBeNull()
  })
})
