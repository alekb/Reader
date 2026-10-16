import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { CharacterBase } from '../content/characters'
import { PAINT_BY_ID, PART_BY_ID, levelFor } from '../content/parts'
import type { Slot } from '../content/parts'
import { pickSticker } from '../content/stickers'
import type { ActivityResult, ChildRecord, Progress, SessionLog } from '../engine/types'
import { applyResult, createProgress, introduce, migrateProgress, xpFor } from '../engine/progress'
import { advanceGroups, newlyUnlockedIds } from '../engine/curriculum'
import { bumpStreak, dayKey } from '../engine/scheduler'
import { setSfxEnabled } from '../speech/sfx'
import { setVoiceGender, setVoiceRate } from '../speech/tts'

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
  unlockedPartIds: string[]
  completedGroups: number[]
  accuracy: number
  /** New level reached this session, if any. */
  levelUp: number | null
  /** True when the daily surprise egg is waiting to be hatched. */
  eggAvailable: boolean
}

export type { ChildRecord }

/** Most children one account can hold. */
export const MAX_CHILDREN = 8

interface ProgressState {
  /** The child playing now (null: setting up a new child, or none yet). */
  progress: Progress | null
  sessions: SessionLog[]
  /** Every other child on this device, by id. */
  others: Record<string, ChildRecord>
  active: ActiveSession | null
  lastSummary: SessionSummary | null
  /** Bumped on every local change, used by the sync layer. */
  dirty: number

  /** Create a child (from the welcome screen) and make it the one playing. */
  setup: (name: string, character: CharacterBase) => void
  /** Make another child the one playing. */
  switchChild: (id: string) => void
  /** Put the current child aside so the welcome screen can set up a new one. */
  addChild: () => void
  /** Start one child over (keeps the name, buddy and settings). */
  resetChild: (id: string) => void
  /** Remove one child from this device. */
  removeChild: (id: string) => void
  startSession: (group: number) => void
  recordResult: (r: ActivityResult, stepKind: string) => void
  introduceItem: (kind: 'gpc' | 'tricky', id: string) => void
  endSession: (completed: boolean) => SessionSummary | null
  /** Wear a part (null = take the slot off). Only unlocked parts can be worn. */
  equip: (slot: Slot, partId: string | null) => void
  /** Paint the hat or outfit with an unlocked paint (null = the part's own colour). */
  setPaint: (target: 'hat' | 'outfit', paintId: string | null) => void
  setCharacter: (base: CharacterBase) => void
  /** Hatch today's surprise egg; returns the sticker id or null if none is available. */
  hatchEgg: () => string | null
  setChildName: (name: string) => void
  setSettings: (s: Partial<Progress['settings']>) => void
  setDailyGoal: (min: number) => void
  /** Remove every child from this device. */
  clearDevice: () => void
  /** Replace every child with this set (after merging with the cloud). Keeps the same child playing when it is still there. */
  setChildren: (children: Record<string, ChildRecord>) => void
}

/** Every child on this device, the one playing included. */
export function allChildren(s: Pick<ProgressState, 'progress' | 'sessions' | 'others'>): Record<string, ChildRecord> {
  return s.progress ? { ...s.others, [s.progress.id]: { progress: s.progress, sessions: s.sessions } } : { ...s.others }
}

/** Children in the order they were added. */
export function childList(s: Pick<ProgressState, 'progress' | 'others'>): Progress[] {
  const list = [...Object.values(s.others).map((c) => c.progress), ...(s.progress ? [s.progress] : [])]
  return list.sort((a, b) => a.createdAt - b.createdAt)
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      progress: null,
      sessions: [],
      others: {},
      active: null,
      lastSummary: null,
      dirty: 0,

      setup: (name, character) => {
        const now = Date.now()
        set({ progress: createProgress(name.trim() || 'Explorer', character, now), sessions: [], active: null, lastSummary: null, dirty: get().dirty + 1 })
      },

      switchChild: (id) => {
        const s = get()
        const next = s.others[id]
        if (!next) return
        const others = { ...allChildren(s) }
        delete others[id]
        set({ progress: next.progress, sessions: next.sessions, others, active: null, lastSummary: null })
      },

      addChild: () => {
        const s = get()
        if (!s.progress || childList(s).length >= MAX_CHILDREN) return
        set({ progress: null, sessions: [], others: allChildren(s), active: null, lastSummary: null })
      },

      resetChild: (id) => {
        const s = get()
        const cur = allChildren(s)[id]
        if (!cur) return
        const p = cur.progress
        const fresh = { ...createProgress(p.childName, p.character, Date.now(), id), settings: p.settings, dailyGoalMin: p.dailyGoalMin }
        if (s.progress?.id === id) set({ progress: fresh, sessions: [], active: null, lastSummary: null, dirty: s.dirty + 1 })
        else set({ others: { ...s.others, [id]: { progress: fresh, sessions: [] } }, dirty: s.dirty + 1 })
      },

      removeChild: (id) => {
        const s = get()
        const others = { ...s.others }
        delete others[id]
        if (s.progress?.id !== id) return set({ others, dirty: s.dirty + 1 })
        // The child playing was removed: hand over to the next one, or back to the welcome screen.
        const next = childList({ progress: null, others })[0]
        if (next) delete others[next.id]
        set({ progress: next ?? null, sessions: next ? s.others[next.id].sessions : [], others, active: null, lastSummary: null, dirty: s.dirty + 1 })
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
        const levelBefore = levelFor(progress.xp)
        const unlocked = newlyUnlockedIds(next, now)
        next.unlockedParts = [...next.unlockedParts, ...unlocked]
        const levelAfter = levelFor(next.xp)
        const eggAvailable = completed && next.lastEggDay !== dayKey(now)
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
        const summary: SessionSummary = { log, unlockedPartIds: unlocked, completedGroups: newGroups, accuracy, levelUp: levelAfter > levelBefore ? levelAfter : null, eggAvailable }
        // Keep the newest 400 sessions locally; the cloud keeps everything.
        const nextSessions = [...sessions, log].slice(-400)
        set({ progress: next, sessions: nextSessions, active: null, lastSummary: summary, dirty: get().dirty + 1 })
        return summary
      },

      equip: (slot, partId) => {
        const p = get().progress
        if (!p) return
        if (partId) {
          const part = PART_BY_ID[partId]
          if (!part || part.slot !== slot || !p.unlockedParts.includes(partId)) return
          if (part.base && part.base !== p.character) return
        } else if (slot === 'color') return
        set({ progress: { ...p, look: { ...p.look, [slot]: partId }, updatedAt: Date.now() }, dirty: get().dirty + 1 })
      },

      setPaint: (target, paintId) => {
        const p = get().progress
        if (!p) return
        if (paintId && (!PAINT_BY_ID[paintId] || !p.unlockedParts.includes(paintId))) return
        const key = target === 'hat' ? 'hatPaint' : 'outfitPaint'
        set({ progress: { ...p, look: { ...p.look, [key]: paintId }, updatedAt: Date.now() }, dirty: get().dirty + 1 })
      },

      setCharacter: (base) => {
        const p = get().progress
        if (!p) return
        // Keep the same colour tier if it is unlocked for the new buddy, else classic.
        const tier = p.look.color?.split('-').pop() ?? 'classic'
        const wanted = `color-${base}-${tier}`
        const color = p.unlockedParts.includes(wanted) ? wanted : `color-${base}-classic`
        set({ progress: { ...p, character: base, look: { ...p.look, color }, updatedAt: Date.now() }, dirty: get().dirty + 1 })
      },

      hatchEgg: () => {
        const p = get().progress
        if (!p) return null
        const today = dayKey(Date.now())
        if (p.lastEggDay === today) return null
        const sticker = pickSticker(p.stickers)
        set({ progress: { ...p, stickers: [...p.stickers, sticker.id], lastEggDay: today, xp: p.xp + 5, updatedAt: Date.now() }, dirty: get().dirty + 1 })
        return sticker.id
      },

      setChildName: (name) => {
        const p = get().progress
        if (!p) return
        set({ progress: { ...p, childName: name.trim() || p.childName, updatedAt: Date.now() }, dirty: get().dirty + 1 })
      },

      setSettings: (s) => {
        const p = get().progress
        if (!p) return
        const settings = { ...p.settings, ...s, changedAt: Date.now() }
        set({ progress: { ...p, settings, updatedAt: Date.now() }, dirty: get().dirty + 1 })
      },

      setDailyGoal: (min) => {
        const p = get().progress
        if (!p) return
        set({ progress: { ...p, dailyGoalMin: Math.max(5, Math.min(30, min)), updatedAt: Date.now() }, dirty: get().dirty + 1 })
      },

      clearDevice: () => set({ progress: null, sessions: [], others: {}, active: null, lastSummary: null, dirty: get().dirty + 1 }),

      setChildren: (children) => {
        const s = get()
        const others = { ...children }
        // A parent in the middle of adding a child stays on the welcome screen.
        const adding = !s.progress && Object.keys(s.others).length > 0
        // Keep the same child playing; otherwise the oldest one (the picker lets them change).
        const keepId = adding ? undefined : s.progress && others[s.progress.id] ? s.progress.id : childList({ progress: null, others })[0]?.id
        const active = keepId ? others[keepId] : null
        if (keepId) delete others[keepId]
        const same = active && s.progress?.id === active.progress.id
        set({
          progress: active?.progress ?? null,
          sessions: active?.sessions.slice(-400) ?? [],
          others,
          active: same ? s.active : null,
          lastSummary: same ? s.lastSummary : null,
        })
      },
    }),
    {
      name: 'reader-quest-progress',
      version: 4,
      // Never let a full or blocked localStorage crash the app.
      storage: createJSONStorage(() => ({
        getItem: (k: string) => {
          try {
            return localStorage.getItem(k)
          } catch {
            return null
          }
        },
        setItem: (k: string, v: string) => {
          try {
            localStorage.setItem(k, v)
          } catch {
            /* quota exceeded or storage blocked: keep running in memory */
          }
        },
        removeItem: (k: string) => {
          try {
            localStorage.removeItem(k)
          } catch {
            /* ignore */
          }
        },
      })),
      partialize: (s) => ({ progress: s.progress, sessions: s.sessions, others: s.others, lastSummary: s.lastSummary }),
      migrate: (persisted) => {
        const st = persisted as { progress?: unknown; sessions?: SessionLog[]; others?: Record<string, ChildRecord>; lastSummary?: SessionSummary | null }
        return { ...st, progress: migrateProgress(st.progress), others: st.others ?? {}, lastSummary: null } as unknown as ProgressState
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // Always run the migration: it is cheap and back-fills new default unlocks and fields.
        const progress = state.progress ? migrateProgress(state.progress) : null
        const others: Record<string, ChildRecord> = {}
        for (const c of Object.values(state.others ?? {})) {
          const p = migrateProgress(c.progress)
          if (p) others[p.id] = { progress: p, sessions: c.sessions ?? [] }
        }
        useProgress.setState({ progress, others })
        if (progress) applyAudioSettings(progress)
      },
    },
  ),
)

/** Point the speech engine at the saved audio settings. */
function applyAudioSettings(p: Progress) {
  setSfxEnabled(p.settings.sfx)
  setVoiceRate(p.settings.voiceRate)
  setVoiceGender(p.settings.voice)
}

// Re-apply on every change, so a cloud restore or sign-in picks up the parent's choices too.
useProgress.subscribe((s, prev) => {
  if (s.progress && s.progress.settings !== prev.progress?.settings) applyAudioSettings(s.progress)
})
