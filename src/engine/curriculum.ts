/**
 * Curriculum logic: what the child has, what comes next, and when a group
 * (island) is complete. Pure functions over the Progress object.
 */
import { GROUPS, GPC_BY_ID, gpcsThroughGroup } from '../content/gpcs'
import { TRICKY_WORDS } from '../content/trickyWords'
import { PAINTS, PARTS } from '../content/parts'
import type { Part, Unlock } from '../content/parts'
import { fragileCount, masteryOf, currentStreak } from './scheduler'
import type { Progress } from './types'

/** Group ids completed when every GPC is at least "secure" (box ≥ 2); GPC-less groups need 20 correct words. */
export function isGroupComplete(p: Progress, groupId: number): boolean {
  const group = GROUPS.find((g) => g.id === groupId)
  if (!group) return false
  if (group.gpcIds.length === 0) return (p.groupWords[String(groupId)] ?? 0) >= 20
  return group.gpcIds.every((id) => (p.gpcs[id]?.box ?? 0) >= 2)
}

/** GPC ids the child has been introduced to. */
export function introducedGpcs(p: Progress): string[] {
  return Object.keys(p.gpcs)
}

/** GPC ids usable for word building/blending: introduced and answered correctly at least once. */
export function usableGpcs(p: Progress): string[] {
  return Object.entries(p.gpcs)
    .filter(([, st]) => st.correct > 0 || st.box >= 1)
    .map(([id]) => id)
}

/** Next GPC to introduce (in teaching order), or null if everything is taught. */
export function nextGpcToIntroduce(p: Progress): string | null {
  for (const group of GROUPS) {
    if (group.id > p.currentGroup) break
    for (const id of group.gpcIds) if (!p.gpcs[id]) return id
  }
  // Current group fully introduced: look at the next group if the current one is complete.
  const next = GROUPS.find((g) => g.id === p.currentGroup + 1)
  if (next && isGroupComplete(p, p.currentGroup)) return next.gpcIds[0] ?? null
  return null
}

/** Next tricky word to introduce. */
export function nextTrickyToIntroduce(p: Progress): string | null {
  for (const tw of TRICKY_WORDS) {
    if (tw.group > p.currentGroup) break
    if (!p.tricky[tw.word]) return tw.word
  }
  return null
}

export interface NewItemPolicy {
  allowNewGpc: boolean
  allowNewTricky: boolean
  consolidation: boolean
  /** Explanation for the parent dashboard / debugging. */
  reason: string
}

/** Decide whether this session may introduce new material (RESEARCH.md §10.2). */
export function newItemPolicy(p: Progress, now: number): NewItemPolicy {
  const consolidation = p.sessionsCompleted > 0 && p.sessionsCompleted % 4 === 3
  if (consolidation) return { allowNewGpc: false, allowNewTricky: false, consolidation: true, reason: 'Every 4th session is a consolidation session.' }
  if (p.lastSessionAccuracy < 0.7) return { allowNewGpc: false, allowNewTricky: false, consolidation: false, reason: 'Last session accuracy was below 70%.' }
  if (fragileCount(p.gpcs, now) > 2) return { allowNewGpc: false, allowNewTricky: true, consolidation: false, reason: 'More than two sounds are still fragile.' }
  const trickyFragile = fragileCount(p.tricky, now) > 2
  return { allowNewGpc: true, allowNewTricky: !trickyFragile, consolidation: false, reason: 'Ready for something new.' }
}

/** Recompute currentGroup and completedGroups after a session. */
export function advanceGroups(p: Progress): Progress {
  let current = p.currentGroup
  const completed = new Set(p.completedGroups)
  for (const g of GROUPS) {
    if (isGroupComplete(p, g.id)) completed.add(g.id)
  }
  while (completed.has(current) && current < GROUPS[GROUPS.length - 1].id) current++
  return { ...p, currentGroup: current, completedGroups: [...completed].sort((a, b) => a - b) }
}

export interface Summary {
  gpcsMastered: number
  gpcsSecure: number
  gpcsLearning: number
  gpcsTotal: number
  trickyMastered: number
  trickyLearning: number
  trickyTotal: number
  knownWords: number
  streak: number
}

export function summarize(p: Progress, now: number): Summary {
  let gpcsMastered = 0
  let gpcsSecure = 0
  let gpcsLearning = 0
  for (const id of Object.keys(GPC_BY_ID)) {
    const m = masteryOf(p.gpcs[id])
    if (m === 'mastered') gpcsMastered++
    else if (m === 'secure') gpcsSecure++
    else if (m === 'learning') gpcsLearning++
  }
  let trickyMastered = 0
  let trickyLearning = 0
  for (const tw of TRICKY_WORDS) {
    const m = masteryOf(p.tricky[tw.word])
    if (m === 'mastered' || m === 'secure') trickyMastered++
    else if (m === 'learning') trickyLearning++
  }
  return {
    gpcsMastered,
    gpcsSecure,
    gpcsLearning,
    gpcsTotal: Object.keys(GPC_BY_ID).length,
    trickyMastered,
    trickyLearning,
    trickyTotal: TRICKY_WORDS.length,
    knownWords: Object.keys(p.knownWords).length,
    streak: currentStreak(p.streak, now),
  }
}

/** Sounds the child knows (secure or mastered). */
export function soundsKnown(p: Progress): number {
  return Object.values(p.gpcs).filter((it) => it.box >= 2).length
}

/** True when the unlock rule is satisfied by this progress. */
export function unlockMet(u: Unlock, p: Progress, now: number): boolean {
  switch (u.type) {
    case 'default': return true
    case 'xp': return p.xp >= u.xp
    case 'group': return p.completedGroups.includes(u.group)
    case 'streak': return currentStreak(p.streak, now) >= u.days
    case 'words': return Object.keys(p.knownWords).length >= u.count
    case 'sessions': return p.sessionsCompleted >= u.count
    case 'sounds': return soundsKnown(p) >= u.count
  }
}

/** Parts that are now unlocked but not yet in the unlocked list. */
export function newlyUnlockedParts(p: Progress, now: number): Part[] {
  return PARTS.filter((part) => !p.unlockedParts.includes(part.id) && unlockMet(part.unlock, p, now))
}

/** Paint ids ("paint-red") newly unlocked. */
export function newlyUnlockedPaints(p: Progress, now: number): string[] {
  return PAINTS.map((x) => `paint-${x.id}`).filter((id) => !p.unlockedParts.includes(id) && unlockMet(PAINT_UNLOCK[id], p, now))
}
const PAINT_UNLOCK: Record<string, Unlock> = Object.fromEntries(PAINTS.map((x) => [`paint-${x.id}`, x.unlock]))

/** Convenience: all GPC ids taught through the child's current group (for content filtering). */
export function taughtThroughCurrent(p: Progress): string[] {
  return gpcsThroughGroup(p.currentGroup)
}
