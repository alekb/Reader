import type { CharacterBase } from '../content/characters'
import { colorTierIds, defaultLook, defaultPartIds, PART_BY_ID } from '../content/parts'
import type { ActivityResult, Progress } from './types'
import { applyAnswer, newItem } from './scheduler'

export const DEFAULT_SETTINGS: Progress['settings'] = { sfx: true, voiceRate: 0.9, voice: 'female', changedAt: 0 }

/** The one child a device or account had before multiple children were supported. */
export const LEGACY_CHILD_ID = 'main'

export function newChildId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/** Fill in fields added after the progress was saved. */
function backfill(p: Progress): Progress {
  const s = p.settings as Partial<Progress['settings']> | undefined
  if (s && s.voice && typeof s.changedAt === 'number' && typeof p.id === 'string' && p.id) return p
  return { ...p, id: typeof p.id === 'string' && p.id ? p.id : LEGACY_CHILD_ID, settings: { ...DEFAULT_SETTINGS, ...s } }
}

export function createProgress(childName: string, character: CharacterBase, now: number, id: string = newChildId()): Progress {
  return {
    version: 2,
    id,
    childName,
    character,
    look: defaultLook(character),
    unlockedParts: defaultPartIds(),
    stickers: [],
    lastEggDay: '',
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
    settings: DEFAULT_SETTINGS,
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

/**
 * Upgrade a progress object saved by an older version of the app (locally or
 * in the cloud). Old whole-skin ids become colour + accessory parts.
 */
export function migrateProgress(raw: unknown): Progress | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  if (p.version === 2 && p.look && Array.isArray(p.unlockedParts)) {
    const cur = backfill(p as unknown as Progress)
    // Colour tiers already earned also unlock for buddies added since.
    const unlockedParts = [...new Set([...cur.unlockedParts, ...defaultPartIds(), ...colorTierIds(cur.unlockedParts)])]
    return unlockedParts.length === cur.unlockedParts.length ? cur : { ...cur, unlockedParts }
  }
  // Version 1 had only the first three buddies.
  const base = (['robot', 'dragon', 'monster'].includes(String(p.character)) ? p.character : 'robot') as CharacterBase
  const fresh = createProgress(String(p.childName ?? 'Explorer'), base, Number(p.createdAt ?? Date.now()), LEGACY_CHILD_ID)
  const out: Progress = { ...backfill({ ...fresh, ...(p as Partial<Progress>) }), version: 2, character: base, look: defaultLook(base), unlockedParts: [...fresh.unlockedParts], stickers: [], lastEggDay: '' }
  // Translate the old skin catalogue (v1) into parts.
  const oldSkins: string[] = Array.isArray(p.unlockedSkins) ? (p.unlockedSkins as string[]) : []
  const accessoryToPart: Record<string, string> = {
    cap: 'hat-cap', wizard: 'hat-wizard', crown: 'hat-crown', pirate: 'hat-pirate', astro: 'hat-astro', party: 'hat-party', bandana: 'hat-bandana', flower: 'hat-flower', bow: 'hat-bow', halo: 'hat-halo',
    glasses: 'face-glasses', sunglasses: 'face-sunglasses', headphones: 'face-headphones', scarf: 'outfit-scarf', cape: 'outfit-cape', backpack: 'outfit-backpack', shield: 'outfit-shield', medal: 'outfit-medal',
  }
  const islandAccessory: Record<number, string> = { 1: 'cap', 2: 'glasses', 3: 'scarf', 4: 'headphones', 5: 'flower', 6: 'bandana', 7: 'astro', 8: 'pirate', 9: 'halo', 10: 'shield', 11: 'sunglasses', 12: 'cape', 13: 'backpack', 14: 'wizard', 15: 'medal', 16: 'crown' }
  const tierColor: Record<string, string> = { stars60: 'lime', lime: 'lime', fire: 'lime', slime: 'lime', stars150: 'berry', stars300: 'sky', stars600: 'sunset', stars1000: 'midnight', stars1500: 'golden' }
  const add = (id: string) => {
    if (PART_BY_ID[id] && !out.unlockedParts.includes(id)) out.unlockedParts.push(id)
  }
  for (const sk of oldSkins) {
    const m = /^(robot|dragon|monster)-(.+)$/.exec(sk)
    if (!m) continue
    const [, b, key] = m
    if (tierColor[key]) add(`color-${b}-${tierColor[key]}`)
    const isl = /^island(\d+)$/.exec(key)
    if (isl) add(accessoryToPart[islandAccessory[Number(isl[1])]] ?? '')
    if (key === 'streak3' || key === 'streak') add('hat-party')
    if (key === 'streak7') add('hat-bow')
    if (key === 'words30') add('outfit-badge')
    if (key === 'words100' || key === 'gold' || key === 'crown') add('outfit-medal')
    if (key === 'words250') add('hat-halo')
    if (key === 'wizard') add('hat-wizard')
    if (key === 'astro' || key === 'ice') add('hat-astro')
    if (key === 'headphones' || key === 'pirate') add('face-headphones')
    if (key === 'glasses') add('face-glasses')
    if (key === 'cap' || key === 'bow') add('hat-cap')
  }
  return out
}
