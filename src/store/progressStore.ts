import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CharacterBase } from '../content/characters'
import { defaultSkin } from '../content/characters'
import type { ActivityResult, Progress, SessionLog } from '../engine/types'
import { applyResult, createProgress, introduce, xpFor } from '../engine/progress'
import { advanceGroups, newlyUnlockedSkins } from '../engine/curriculum'
import { bumpStreak } from '../engine/scheduler'
import { mergeProgress, mergeSessions } from '../firebase/sync'
import { setSfxEnabled } from '../speech/sfx'
import { setVoiceRate } from '../speech/tts'

interface ActiveSession {
  id: string
  startedAt: number
  group: number
  attempts: number
  correct: number
  wrong: number
  newGpcs: string[]
  newTricky: string[]
  wordsRead: number
  xpEarned: number
  steps: Record<string, { attempts: number; correct: number }>
}

export interface SessionSummary {
  log: SessionLog
  unlockedSkinIds: string[]
  completedGroups: number[]
  accuracy: number
}

interface ProgressState {
  progress: Progress | null
  sessions: SessionLog[]
  active: ActiveSession | null
  lastSummary: SessionSummary | null
  /** Bumped on every local change, used by the sync layer. */
  dirty: number

  setup: (name: string, character: CharacterBase) => void
  startSession: (group: number) => void
  recordResult: (r: ActivityResult, stepKind: string) => void
  introduceItem: (kind: 'gpc' | 'tricky', id: string) => void
  endSession: (completed: boolean) => SessionSummary | null
  setSkin: (skinId: string) => void
  setCharacter: (base: CharacterBase) => void
  setChildName: (name: string) => void
  setSettings: (s: Partial<Progress['settings']>) => void
  setDailyGoal: (min: number) => void
  resetAll: () => void
  /** Merge a cloud snapshot into local state. */
  mergeRemote: (progress: Progress | null, sessions: SessionLog[]) => void
  replaceAll: (progress: Progress, sessions: SessionLog[]) => void
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      progress: null,
      sessions: [],
      active: null,
      lastSummary: null,
      dirty: 0,

      setup: (name, character) => {
        const now = Date.now()
        set({ progress: createProgress(name.trim() || 'Explorer', character, now), dirty: get().dirty + 1 })
      },

      startSession: (group) => {
        set({
          active: { id: uid(), startedAt: Date.now(), group, attempts: 0, correct: 0, wrong: 0, newGpcs: [], newTricky: [], wordsRead: 0, xpEarned: 0, steps: {} },
        })
      },

      recordResult: (r, stepKind) => {
        const { progress, active } = get()
        if (!progress) return
        const now = Date.now()
        const next = applyResult(progress, r, now)
        let a = active
        if (a) {
          const step = a.steps[stepKind] ?? { attempts: 0, correct: 0 }
          a = {
            ...a,
            attempts: a.attempts + 1,
            correct: a.correct + (r.correct ? 1 : 0),
            wrong: a.wrong + (r.correct ? 0 : 1),
            wordsRead: a.wordsRead + ((r.kind === 'word' || r.kind === 'oral' || r.kind === 'build') && r.correct ? 1 : 0),
            xpEarned: a.xpEarned + xpFor(r),
            steps: { ...a.steps, [stepKind]: { attempts: step.attempts + 1, correct: step.correct + (r.correct ? 1 : 0) } },
          }
        }
        set({ progress: next, active: a, dirty: get().dirty + 1 })
      },

      introduceItem: (kind, id) => {
        const { progress, active } = get()
        if (!progress) return
        const next = introduce(progress, kind, id, Date.now())
        let a = active
        if (a && !progress[kind === 'gpc' ? 'gpcs' : 'tricky'][id]) {
          a = kind === 'gpc' ? { ...a, newGpcs: [...a.newGpcs, id] } : { ...a, newTricky: [...a.newTricky, id] }
        }
        set({ progress: next, active: a, dirty: get().dirty + 1 })
      },

      endSession: (completed) => {
        const { progress, active, sessions } = get()
        if (!progress || !active) return null
        const now = Date.now()
        const accuracy = active.attempts > 0 ? active.correct / active.attempts : 1
        let next: Progress = { ...progress, updatedAt: now }
        if (completed) {
          next.sessionsCompleted += 1
          next.lastSessionAccuracy = accuracy
          next.xp += 20
          next.streak = bumpStreak(next.streak, now)
        }
        const before = new Set(next.completedGroups)
        next = advanceGroups(next)
        const newGroups = next.completedGroups.filter((g) => !before.has(g))
        next.xp += newGroups.length * 50
        const unlocked = newlyUnlockedSkins(next, now)
        next.unlockedSkins = [...next.unlockedSkins, ...unlocked.map((s) => s.id)]
        const log: SessionLog = {
          id: active.id,
          startedAt: active.startedAt,
          endedAt: now,
          durationSec: Math.round((now - active.startedAt) / 1000),
          group: active.group,
          attempts: active.attempts,
          correct: active.correct,
          wrong: active.wrong,
          newGpcs: active.newGpcs,
          newTricky: active.newTricky,
          wordsRead: active.wordsRead,
          xpEarned: active.xpEarned + (completed ? 20 : 0) + newGroups.length * 50,
          completed,
          steps: Object.entries(active.steps).map(([kind, v]) => ({ kind, ...v })),
        }
        const summary: SessionSummary = { log, unlockedSkinIds: unlocked.map((s) => s.id), completedGroups: newGroups, accuracy }
        // Keep the newest 400 sessions locally; the cloud keeps everything.
        const nextSessions = [...sessions, log].slice(-400)
        set({ progress: next, sessions: nextSessions, active: null, lastSummary: summary, dirty: get().dirty + 1 })
        return summary
      },

      setSkin: (skinId) => {
        const p = get().progress
        if (!p || !p.unlockedSkins.includes(skinId)) return
        set({ progress: { ...p, skinId, updatedAt: Date.now() }, dirty: get().dirty + 1 })
      },

      setCharacter: (base) => {
        const p = get().progress
        if (!p) return
        const skin = p.unlockedSkins.find((id) => id.startsWith(`${base}-`)) ?? defaultSkin(base).id
        const unlockedSkins = p.unlockedSkins.includes(skin) ? p.unlockedSkins : [...p.unlockedSkins, skin]
        set({ progress: { ...p, character: base, skinId: skin, unlockedSkins, updatedAt: Date.now() }, dirty: get().dirty + 1 })
      },

      setChildName: (name) => {
        const p = get().progress
        if (!p) return
        set({ progress: { ...p, childName: name.trim() || p.childName, updatedAt: Date.now() }, dirty: get().dirty + 1 })
      },

      setSettings: (s) => {
        const p = get().progress
        if (!p) return
        const settings = { ...p.settings, ...s }
        setSfxEnabled(settings.sfx)
        setVoiceRate(settings.voiceRate)
        set({ progress: { ...p, settings, updatedAt: Date.now() }, dirty: get().dirty + 1 })
      },

      setDailyGoal: (min) => {
        const p = get().progress
        if (!p) return
        set({ progress: { ...p, dailyGoalMin: Math.max(5, Math.min(30, min)), updatedAt: Date.now() }, dirty: get().dirty + 1 })
      },

      resetAll: () => set({ progress: null, sessions: [], active: null, lastSummary: null, dirty: get().dirty + 1 }),

      mergeRemote: (progress, sessions) => {
        const merged = mergeProgress(get().progress, progress)
        set({ progress: merged, sessions: mergeSessions(get().sessions, sessions).slice(-400) })
      },

      replaceAll: (progress, sessions) => set({ progress, sessions: sessions.slice(-400), dirty: get().dirty + 1 }),
    }),
    {
      name: 'reader-quest-progress',
      version: 1,
      partialize: (s) => ({ progress: s.progress, sessions: s.sessions, lastSummary: s.lastSummary }),
      onRehydrateStorage: () => (state) => {
        if (state?.progress) {
          // Skin ids were renamed when the catalogue grew; map old ids to the new ones.
          const p = state.progress
          const rename = (id: string) =>
            id
              .replace(/-(lime|fire|slime)$/, '-stars60')
              .replace(/-(cap|bow)$/, '-island1')
              .replace(/-glasses$/, '-island2')
              .replace(/-(headphones|pirate)$/, '-island4')
              .replace(/-(astro|ice)$/, '-island7')
              .replace(/-wizard$/, '-island14')
              .replace(/-(gold|crown)$/, '-words100')
              .replace(/-streak$/, '-streak7')
          p.unlockedSkins = [...new Set(p.unlockedSkins.map(rename))]
          p.skinId = rename(p.skinId)
          setSfxEnabled(state.progress.settings.sfx)
          setVoiceRate(state.progress.settings.voiceRate)
        }
      },
    },
  ),
)
