/**
 * Daily reading reminder (Android app only).
 *
 * Notifications are scheduled one per day for the next two weeks rather than as one
 * repeating alarm, so today's can be dropped once every child on this device has
 * reached their goal. The schedule is refreshed whenever the app opens or progress
 * changes, so it keeps rolling forward while the app is in use.
 */
import { create } from 'zustand'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import { DEFAULT_REMINDER, goalsDoneToday, reminderText, reminderTimes, type ReminderSettings } from '../engine/reminders'
import { allChildren, useProgress } from './progressStore'

const KEY = 'reader-quest-reminder'
/** Our notification ids: one per day ahead. */
const FIRST_ID = 7100
const DAYS_AHEAD = 14

interface ReminderState {
  supported: boolean
  settings: ReminderSettings
  /** Android refused to show notifications (the parent can allow them in the phone's settings). */
  denied: boolean
  setEnabled: (on: boolean) => Promise<void>
  setTime: (hour: number, minute: number) => void
}

function load(): ReminderSettings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<ReminderSettings> | null
    return { ...DEFAULT_REMINDER, ...s }
  } catch {
    return DEFAULT_REMINDER
  }
}

function save(s: ReminderSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

const supported = Capacitor.isNativePlatform()

export const useReminders = create<ReminderState>((set, get) => ({
  supported,
  settings: load(),
  denied: false,
  setEnabled: async (on) => {
    if (on && supported) {
      const granted = (await LocalNotifications.checkPermissions()).display === 'granted' || (await LocalNotifications.requestPermissions()).display === 'granted'
      set({ denied: !granted })
      if (!granted) return
    }
    const settings = { ...get().settings, enabled: on }
    save(settings)
    set({ settings })
    refresh()
  },
  setTime: (hour, minute) => {
    const settings = { ...get().settings, hour, minute }
    save(settings)
    set({ settings })
    refresh()
  },
}))

let lastKey = ''
let queue: Promise<void> = Promise.resolve()

/** Bring the scheduled notifications in line with the settings and today's progress. */
async function reschedule() {
  const { settings } = useReminders.getState()
  const children = Object.values(allChildren(useProgress.getState()))
  const now = Date.now()
  const times = reminderTimes(settings, now, goalsDoneToday(children, now), DAYS_AHEAD)
  const text = reminderText(children)
  const key = JSON.stringify([times.map((t) => t.getTime()), text])
  if (key === lastKey) return
  const pending = await LocalNotifications.getPending()
  const ours = pending.notifications.filter((n) => n.id >= FIRST_ID && n.id < FIRST_ID + DAYS_AHEAD)
  if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) })
  if (times.length && text) {
    if (settings.enabled) useReminders.setState({ denied: (await LocalNotifications.checkPermissions()).display !== 'granted' })
    await LocalNotifications.schedule({
      notifications: times.map((at, i) => ({ id: FIRST_ID + i, title: text.title, body: text.body, schedule: { at, allowWhileIdle: true }, isExactNotification: false })),
    })
  }
  lastKey = key
}

/** Queue a reschedule (one at a time). */
function refresh() {
  if (!supported) return
  queue = queue.then(reschedule).catch(() => {
    lastKey = '' // try again next time
  })
}

if (supported) {
  let timer: ReturnType<typeof setTimeout> | undefined
  useProgress.subscribe(() => {
    clearTimeout(timer)
    timer = setTimeout(refresh, 2000)
  })
  void CapApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive) refresh()
  })
  setTimeout(refresh, 1500)
}
