import type { CharacterBase } from '../content/characters'
import type { Look } from '../content/parts'

/** Leitner-box state for one learnable item (a GPC or a tricky word). */
export interface ItemState {
  /** 0 = brand new, 6 = long-term maintenance. */
  box: number
  /** Epoch ms when the item is next due for review. */
  due: number
  /** Consecutive correct answers on different days (mastery criterion). */
  correctStreak: number
  /** Day key (YYYY-MM-DD) of the last correct scheduled review that counted towards the streak. */
  lastStreakDay: string
  /** Epoch ms of first introduction. */
  introduced: number
  lastSeen: number
  seen: number
  correct: number
  wrong: number
}

export interface Progress {
  version: 2
  childName: string
  character: CharacterBase
  /** What the buddy is wearing (one part per slot). */
  look: Look
  /** Part ids the child has unlocked. */
  unlockedParts: string[]
  /** Sticker ids collected from the daily surprise egg. */
  stickers: string[]
  /** Day key of the last hatched egg (one per day). */
  lastEggDay: string
  /** Stars earned (effort-based XP). */
  xp: number
  /** Total correct word reads (including repeats). */
  wordsRead: number
  /** Distinct real words read correctly at least once. */
  knownWords: Record<string, number>
  gpcs: Record<string, ItemState>
  tricky: Record<string, ItemState>
  /** Correct blend-word answers per group (used to finish groups with no new GPCs). */
  groupWords: Record<string, number>
  /** Groups whose island is complete. */
  completedGroups: number[]
  currentGroup: number
  sessionsCompleted: number
  /** Accuracy of the last completed session, 0..1 (1 when none). */
  lastSessionAccuracy: number
  streak: { count: number; lastDay: string }
  /** Minutes per day target shown to the child. */
  dailyGoalMin: number
  /** Audio settings. `voice` is missing on progress saved before it existed: treat as female. */
  settings: { sfx: boolean; voiceRate: number; voice?: 'female' | 'male' }
  createdAt: number
  updatedAt: number
}

export interface SessionLog {
  id: string
  startedAt: number
  endedAt: number
  durationSec: number
  group: number
  attempts: number
  correct: number
  wrong: number
  newGpcs: string[]
  newTricky: string[]
  wordsRead: number
  xpEarned: number
  /** Whether the child reached the closing screen. */
  completed: boolean
  /** Per-step accuracy, for the parent dashboard. */
  steps: { kind: string; attempts: number; correct: number }[]
}

export type ResultKind = 'gpc' | 'tricky' | 'word' | 'sentence' | 'build' | 'oral' | 'trace' | 'letterName'

export interface ActivityResult {
  kind: ResultKind
  /** GPC id, tricky word, or word text. */
  id: string
  correct: boolean
  /** Response time in ms (for the "automatic" criterion). */
  ms: number
  /** Group of the word (for group completion). */
  group?: number
  /** True if this was a scheduled review (counts for mastery streak). */
  scheduled?: boolean
  /** True for nonsense words (not counted as known words). */
  nonsense?: boolean
}
