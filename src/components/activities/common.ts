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
