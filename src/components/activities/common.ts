import { GPC_BY_ID } from '../../content/gpcs'
import type { ActivityResult } from '../../engine/types'

export interface ActivityProps {
  onResult: (r: ActivityResult) => void
  onDone: () => void
}

/**
 * Queue with the Direct Instruction "retest" rule: an item answered wrongly
 * comes back 3 items later (once), so the session ends on success.
 */
export function makeQueue<T>(items: T[]): { items: T[]; retests: Set<number> } {
  return { items: [...items], retests: new Set() }
}

export function requeue<T>(q: { items: T[]; retests: Set<number> }, index: number): { items: T[]; retests: Set<number> } {
  if (q.retests.has(index)) return q
  const item = q.items[index]
  const insertAt = Math.min(q.items.length, index + 3)
  const items = [...q.items.slice(0, insertAt), item, ...q.items.slice(insertAt)]
  const retests = new Set([...q.retests].map((i) => (i >= insertAt ? i + 1 : i)))
  retests.add(index)
  retests.add(insertAt)
  return { items, retests }
}

/** Letters that are commonly confused; used to pick good distractors. */
export const CONFUSABLE: Record<string, string[]> = {
  b: ['d', 'p', 'h'], d: ['b', 'p', 'g'], p: ['q', 'b', 'd'], q: ['p', 'g'], m: ['n', 'w'], n: ['m', 'u', 'h'], u: ['n', 'v'], v: ['w', 'u'], w: ['v', 'm'],
  i: ['l', 'j'], l: ['i', 't'], t: ['f', 'l'], f: ['t', 'r'], e: ['a', 'c'], a: ['e', 'o'], o: ['a', 'c'], c: ['o', 'e'], s: ['z', 'c'], z: ['s'],
  g: ['q', 'p'], h: ['n', 'b'], j: ['i', 'g'], k: ['h', 'x'], r: ['n', 'v'], x: ['k', 'z'], y: ['v', 'j'],
  ch: ['sh', 'th'], sh: ['ch', 'th'], th: ['sh', 'ch'], ng: ['n', 'g'], ai: ['ee', 'oa'], ee: ['ea', 'ai'], igh: ['ie', 'ai'], oa: ['ow', 'oi'],
  oo_long: ['oo_short', 'ow'], oo_short: ['oo_long', 'or'], ar: ['or', 'ur'], or: ['ar', 'ur'], ur: ['ar', 'er'], ow: ['ou', 'oa'], oi: ['oy', 'ow'],
  ear: ['air', 'ee'], air: ['ear', 'ai'], ure: ['ur', 'air'], er: ['ur', 'ir'], ay: ['ai', 'ey'], ou: ['ow', 'oo_long'], ie: ['igh', 'ee'], ea: ['ee', 'ai'],
  oy: ['oi', 'ow'], ir: ['ur', 'er'], ue: ['ew', 'oo_long'], aw: ['or', 'ow'], wh: ['w', 'th'], ph: ['f', 'p'], ew: ['ue', 'oo_long'],
}

/**
 * Sounds too alike to tell apart when heard on their own. Different spellings of
 * the same sound (c k ck, ee ea, ...) count as alike too: see soundsAlike().
 */
const SOUND_ALIKE: string[][] = [
  ['m', 'n', 'ng'],
  ['p', 'b'],
  ['t', 'd'],
  ['c', 'k', 'ck', 'g'],
  ['f', 'ff', 'ph', 'v'],
  ['f', 'ff', 'ph', 'th'],
  ['s', 'ss', 'z', 'zz'],
  ['ch', 'j'],
  ['ch', 'sh'],
  ['e', 'i'],
  ['e', 'a'],
  ['o', 'u', 'aw'],
  ['u', 'oo_short'],
  ['r', 'ur', 'ir', 'er'],
  ['oo_long', 'u_e', 'ue', 'ew'],
]

/** True when two GPCs say the same sound, or sounds a child could not tell apart by ear. */
export function soundsAlike(a: string, b: string): boolean {
  if (a === b) return true
  if (GPC_BY_ID[a] && GPC_BY_ID[a].sound === GPC_BY_ID[b]?.sound) return true
  return SOUND_ALIKE.some((g) => g.includes(a) && g.includes(b))
}

/**
 * Wrong answers for "tap the sound you hear": up to `lookAlikes` letters that look like
 * the target, the rest from what the child knows, topped up with single letters. No two
 * options (target included) sound alike or share a spelling.
 */
export function pickSoundDistractors(targetId: string, knownIds: string[], lookAlikes = 2, count = 3): string[] {
  const picks: string[] = []
  const fits = (id: string) =>
    GPC_BY_ID[id] !== undefined && [targetId, ...picks].every((p) => !soundsAlike(p, id) && GPC_BY_ID[p].grapheme !== GPC_BY_ID[id].grapheme)
  const take = (ids: string[], max: number) => {
    for (const id of ids) {
      if (picks.length >= count || max <= 0) return
      if (fits(id)) {
        picks.push(id)
        max--
      }
    }
  }
  const known = knownIds.filter((id) => GPC_BY_ID[id])
  const confusable = (CONFUSABLE[targetId] ?? []).filter((id) => known.includes(id))
  take(shuffleArr(confusable), lookAlikes)
  take(shuffleArr(known.filter((id) => !confusable.includes(id))), count)
  // A new learner knows few sounds: fill up with other letters, single letters first.
  const rest = shuffleArr(Object.keys(GPC_BY_ID).filter((id) => !known.includes(id)))
  take([...rest.filter((id) => GPC_BY_ID[id].grapheme.length === 1), ...rest.filter((id) => GPC_BY_ID[id].grapheme.length > 1)], count)
  return picks
}

/** Shuffle helper for options. */
export function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Pick n random distinct items from pool (excluding `exclude`). */
export function sample<T>(pool: T[], n: number, exclude: (x: T) => boolean = () => false): T[] {
  return shuffleArr(pool.filter((x) => !exclude(x))).slice(0, n)
}
