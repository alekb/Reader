import type { CharacterBase } from '../content/characters'
import { SKINS, defaultSkin } from '../content/characters'
import type { ActivityResult, Progress } from './types'
import { applyAnswer, newItem } from './scheduler'

export function createProgress(childName: string, character: CharacterBase, now: number): Progress {
  const skin = defaultSkin(character)
  return {
    version: 1,
    childName,
    character,
    skinId: skin.id,
    unlockedSkins: SKINS.filter((s) => s.unlock.type === 'default').map((s) => s.id),
    xp: 0,
    wordsRead: 0,
    knownWords: {},
    gpcs: {},
    tricky: {},
    groupWords: {},
    completedGroups: [],
    currentGroup: 1,
    sessionsCompleted: 0,
    lastSessionAccuracy: 1,
    streak: { count: 0, lastDay: '' },
    dailyGoalMin: 12,
    settings: { sfx: true, voiceRate: 0.9 },
    createdAt: now,
    updatedAt: now,
  }
}

/** XP (stars) for one answer: effort-based, with a small bonus for correct answers. */
export function xpFor(r: ActivityResult): number {
  if (r.kind === 'trace') return 3
  return r.correct ? 2 : 1
}

/** Apply an activity result to progress (pure). */
export function applyResult(p: Progress, r: ActivityResult, now: number): Progress {
  const next: Progress = { ...p, gpcs: { ...p.gpcs }, tricky: { ...p.tricky }, knownWords: { ...p.knownWords }, groupWords: { ...p.groupWords } }
  next.xp += xpFor(r)
  switch (r.kind) {
    case 'gpc':
    case 'letterName': {
      const item = next.gpcs[r.id] ?? newItem(now)
      next.gpcs[r.id] = applyAnswer(item, r.correct, r.ms, now, Boolean(r.scheduled))
      break
    }
    case 'tricky': {
      const item = next.tricky[r.id] ?? newItem(now)
      next.tricky[r.id] = applyAnswer(item, r.correct, r.ms, now, Boolean(r.scheduled))
      break
    }
    case 'word':
    case 'oral':
    case 'build': {
      if (r.correct && !r.nonsense) {
        next.wordsRead += 1
        if (r.kind === 'word' || r.kind === 'build') next.knownWords[r.id] = (next.knownWords[r.id] ?? 0) + 1
        if (r.group != null) next.groupWords[String(r.group)] = (next.groupWords[String(r.group)] ?? 0) + 1
      }
      break
    }
    case 'sentence':
    case 'trace':
      break
  }
  next.updatedAt = now
  return next
}

/** Mark a GPC or tricky word as introduced (box 0, due now) without answering. */
export function introduce(p: Progress, kind: 'gpc' | 'tricky', id: string, now: number): Progress {
  const map = kind === 'gpc' ? p.gpcs : p.tricky
  if (map[id]) return p
  const copy = { ...map, [id]: newItem(now) }
  return kind === 'gpc' ? { ...p, gpcs: copy, updatedAt: now } : { ...p, tricky: copy, updatedAt: now }
}
