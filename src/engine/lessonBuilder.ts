/**
 * Builds a daily session (12-15 minutes) in the fixed order recommended in
 * docs/RESEARCH.md §10.1:
 *   1 speed sounds review  2 sound-talk warm-up  3 new sound (or consolidation)
 *   4 blend words          5 tricky word         6 read sentences
 *   7 build/spell          8 close
 */
import { GPC_BY_ID, GROUPS, groupOf } from '../content/gpcs'
import { decodableWords, WORDS } from '../content/words'
import type { DecodableWord } from '../content/words'
import { TRICKY_BY_WORD, trickyWordsThroughGroup } from '../content/trickyWords'
import type { TrickyWord } from '../content/trickyWords'
import { sentencesThroughGroup } from '../content/sentences'
import type { Sentence } from '../content/sentences'
import { makeNonsenseWord } from './nonsense'
import { dueItems } from './scheduler'
import { newItemPolicy, nextGpcToIntroduce, nextTrickyToIntroduce, usableGpcs } from './curriculum'
import type { Progress } from './types'

export type ReviewItem = { type: 'gpc'; id: string } | { type: 'tricky'; id: string }

export type Step =
  | { kind: 'speedSounds'; items: ReviewItem[] }
  | { kind: 'oralBlend'; words: DecodableWord[] }
  | { kind: 'newSound'; gpcId: string }
  | { kind: 'blend'; words: DecodableWord[]; focusGpcId?: string }
  | { kind: 'trickyIntro'; word: TrickyWord }
  | { kind: 'sentences'; sentences: Sentence[] }
  | { kind: 'build'; words: DecodableWord[] }
  | { kind: 'close' }

export interface Lesson {
  steps: Step[]
  group: number
  /** New sounds introduced this session (two per session while fewer than four are known). */
  newGpcIds: string[]
  newTricky?: string
  consolidation: boolean
  policyReason: string
}

export function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Words whose first sound can be stretched (sun, man) are easiest to blend; put them first. */
function blendDifficulty(w: DecodableWord): number {
  const first = GPC_BY_ID[w.gpcs[0]]
  let d = first?.stretchy ? 0 : 1
  d += w.gpcs.length > 3 ? 1 : 0
  d += w.blends ? 1 : 0
  return d
}

function pickWords(pool: DecodableWord[], n: number, rnd: () => number, prefer?: (w: DecodableWord) => boolean): DecodableWord[] {
  const preferred = prefer ? pool.filter(prefer) : []
  const rest = pool.filter((w) => !preferred.includes(w))
  const chosen = [...shuffle(preferred, rnd).slice(0, n)]
  if (chosen.length < n) chosen.push(...shuffle(rest, rnd).slice(0, n - chosen.length))
  return chosen.sort((a, b) => blendDifficulty(a) - blendDifficulty(b))
}

export interface BuildOptions {
  now: number
  rnd?: () => number
  /** Shorter session (after a bad day or for a second, review-only session). */
  light?: boolean
  /** Never introduce new material (e.g. the review sweep went badly). */
  forceNoNew?: boolean
}

export function buildLesson(p: Progress, opts: BuildOptions): Lesson {
  const rnd = opts.rnd ?? Math.random
  const now = opts.now
  const basePolicy = newItemPolicy(p, now)
  const policy = opts.forceNoNew ? { ...basePolicy, allowNewGpc: false, allowNewTricky: false, reason: 'Review went badly today: no new material.' } : basePolicy
  const light = opts.light || p.lastSessionAccuracy < 0.7
  const steps: Step[] = []

  const group = GROUPS.find((g) => g.id === p.currentGroup) ?? GROUPS[0]
  const known = usableGpcs(p)
  const introduced = Object.keys(p.gpcs)
  const allowBlends = p.currentGroup >= 13

  // ---- 1. Speed sounds review ----
  const dueGpcs = dueItems(p.gpcs, now).map((id) => ({ type: 'gpc', id }) as ReviewItem)
  const dueTricky = dueItems(p.tricky, now).map((id) => ({ type: 'tricky', id }) as ReviewItem)
  let review: ReviewItem[] = shuffle([...dueGpcs, ...dueTricky], rnd)
  const minReview = light ? 4 : 6
  const maxReview = light ? 8 : 14
  if (review.length < minReview) {
    // Top up with the most recently introduced items that are not already due.
    const recent = [...introduced]
      .sort((a, b) => (p.gpcs[b].introduced ?? 0) - (p.gpcs[a].introduced ?? 0))
      .filter((id) => !review.some((r) => r.id === id))
      .slice(0, minReview - review.length)
      .map((id) => ({ type: 'gpc', id }) as ReviewItem)
    review = [...review, ...recent]
  }
  review = review.slice(0, maxReview)
  if (review.length > 0) steps.push({ kind: 'speedSounds', items: review })

  // ---- 3. New sound (planned here so the word pools below can use it) ----
  // An older beginner can take two sounds a session at the very start, so real
  // words (sat, at, tap ...) appear from the second session.
  const newGpcIds: string[] = []
  if (policy.allowNewGpc) {
    const first = nextGpcToIntroduce(p)
    if (first) {
      newGpcIds.push(first)
      if (introduced.length < 4) {
        const second = nextGpcToIntroduce({ ...p, gpcs: { ...p.gpcs, [first]: { box: 0, due: now, correctStreak: 0, lastStreakDay: '', introduced: now, lastSeen: now, seen: 0, correct: 0, wrong: 0 } } })
        if (second && groupOf(second)?.id === groupOf(first)?.id) newGpcIds.push(second)
      }
    }
  }
  const newGpcId = newGpcIds.length ? newGpcIds[newGpcIds.length - 1] : null
  const poolIds = [...known, ...newGpcIds]
  const pool = decodableWords(poolIds, allowBlends)
  const picturable = pool.filter((w) => w.emoji)

  // ---- 2. Sound-talk warm-up (oral blending, pictures only, no letters) ----
  if (picturable.length >= 3) {
    steps.push({ kind: 'oralBlend', words: pickWords(picturable, light ? 2 : 4, rnd) })
  }

  for (const id of newGpcIds) steps.push({ kind: 'newSound', gpcId: id })

  // ---- 4. Blend words ----
  if (pool.length >= 2) {
    const target = light ? 5 : 8
    const withNew = newGpcIds.length ? pool.filter((w) => w.gpcs.some((g) => newGpcIds.includes(g))) : []
    const focusCount = newGpcId ? Math.min(4, withNew.length) : 0
    const focus = shuffle(withNew, rnd).slice(0, focusCount)
    // Review words: prefer words from the current/last group the child has not read often.
    const reviewPool = pool.filter((w) => !focus.includes(w))
    const reviewWords = pickWords(reviewPool, Math.max(0, target - 1 - focus.length), rnd, (w) => (p.knownWords[w.word] ?? 0) < 2)
    const words: DecodableWord[] = [...focus, ...reviewWords].sort((a, b) => blendDifficulty(a) - blendDifficulty(b))
    const alien = makeNonsenseWord(poolIds, rnd)
    if (alien && words.length >= 3) words.splice(Math.min(words.length - 1, 3), 0, alien)
    if (words.length) steps.push({ kind: 'blend', words, focusGpcId: newGpcId ?? undefined })
  }

  // ---- 5. Tricky word ----
  let newTricky: string | null = null
  const introduceTricky = policy.allowNewTricky && !(newGpcId && p.sessionsCompleted % 2 === 0) && p.sessionsCompleted % 2 === 1
  if (introduceTricky || (!newGpcId && policy.allowNewTricky)) newTricky = nextTrickyToIntroduce(p)
  if (newTricky) steps.push({ kind: 'trickyIntro', word: TRICKY_BY_WORD[newTricky] })

  // ---- 6. Sentences ----
  const knownTricky = new Set([...Object.keys(p.tricky), ...(newTricky ? [newTricky] : [])])
  const knownSet = new Set(poolIds)
  const candidateSentences = sentencesThroughGroup(p.currentGroup).filter((s) => sentenceIsReadable(s, knownSet, knownTricky, allowBlends))
  if (candidateSentences.length) {
    const preferNew = newGpcId
      ? candidateSentences.filter((s) => sentenceWords(s.text).some((w) => WORDSET[w]?.gpcs.includes(newGpcId)))
      : []
    const chosen = [...shuffle(preferNew, rnd).slice(0, 1)]
    const rest = shuffle(candidateSentences.filter((s) => !chosen.includes(s)), rnd)
    chosen.push(...rest.slice(0, (light ? 1 : 2) - chosen.length + (chosen.length ? 0 : 0)))
    steps.push({ kind: 'sentences', sentences: chosen.slice(0, light ? 1 : 3) })
  }

  // ---- 7. Build / spell ----
  const buildPool = pool.filter((w) => w.gpcs.length >= 2 && w.gpcs.length <= 4)
  if (buildPool.length >= 2) {
    const buildWords = pickWords(buildPool, light ? 1 : 2, rnd, (w) => (newGpcId ? w.gpcs.includes(newGpcId) : true))
    steps.push({ kind: 'build', words: buildWords })
  }

  steps.push({ kind: 'close' })

  return {
    steps,
    group: group.id,
    newGpcIds,
    newTricky: newTricky ?? undefined,
    consolidation: policy.consolidation,
    policyReason: policy.reason,
  }
}

const WORDSET: Record<string, DecodableWord> = Object.fromEntries(WORDS.map((w) => [w.word, w]))

export function sentenceWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/** Names used in sentences: decodable but capitalised. */
const NAMES: Record<string, string[]> = {
  pat: ['p', 'a', 't'], sam: ['s', 'a', 'm'], tim: ['t', 'i', 'm'], tom: ['t', 'o', 'm'], sid: ['s', 'i', 'd'], ted: ['t', 'e', 'd'],
  rick: ['r', 'i', 'ck'], bob: ['b', 'o', 'b'], bill: ['b', 'i', 'll'], jim: ['j', 'i', 'm'], max: ['m', 'a', 'x'], jack: ['j', 'a', 'ck'],
  chad: ['ch', 'a', 'd'], ping: ['p', 'i', 'ng'], jane: ['j', 'a_e', 'n'], pete: ['p', 'e_e', 't'], mum: ['m', 'u', 'm'], dad: ['d', 'a', 'd'],
  kim: ['k', 'i', 'm'], pam: ['p', 'a', 'm'],
}

/** Extra decodable function words used in sentences that are not in the word bank. */
const EXTRA: Record<string, string[]> = {
  a: ['a'], an: ['a', 'n'], and: ['a', 'n', 'd'], at: ['a', 't'], it: ['i', 't'], is: ['i', 's'], in: ['i', 'n'], on: ['o', 'n'], up: ['u', 'p'],
  has: ['h', 'a', 's'], had: ['h', 'a', 'd'], his: ['h', 'i', 's'], if: ['i', 'f'], of: ['o', 'f'], not: ['n', 'o', 't'], can: ['c', 'a', 'n'],
  did: ['d', 'i', 'd'], get: ['g', 'e', 't'], got: ['g', 'o', 't'], ran: ['r', 'a', 'n'], hid: ['h', 'i', 'd'], this: ['th', 'i', 's'],
  that: ['th', 'a', 't'], then: ['th', 'e', 'n'], with: ['w', 'i', 'th'], for: ['f', 'or'], more: ['m', 'or', 'e'], over: ['o', 'v', 'er'],
  hungry: ['h', 'u', 'ng', 'r', 'y'], lunch: ['l', 'u', 'n', 'ch'], stuck: ['s', 't', 'u', 'ck'], huge: ['h', 'u_e', 'g'], am: ['a', 'm'],
  taps: ['t', 'a', 'p', 's'], pots: ['p', 'o', 't', 's'], chips: ['ch', 'i', 'p', 's'], bikes: ['b', 'i_e', 'k', 's'], coins: ['c', 'oi', 'n', 's'],
  books: ['b', 'oo_short', 'k', 's'], kids: ['k', 'i', 'd', 's'], rocket: ['r', 'o', 'ck', 'e', 't'], dinner: ['d', 'i', 'nn', 'er'],
  sing: ['s', 'i', 'ng'], tent: ['t', 'e', 'n', 't'], bright: ['b', 'r', 'igh', 't'], zoom: ['z', 'oo_long', 'm'], tap: ['t', 'a', 'p'],
  sat: ['s', 'a', 't'], see: ['s', 'ee'], like: ['l', 'i_e', 'k'], yes: ['y', 'e', 's'], fat: ['f', 'a', 't'], hit: ['h', 'i', 't'],
  swift: ['s', 'w', 'i', 'f', 't'], will: ['w', 'i', 'll'], near: ['n', 'ear'],
}

export function wordGpcs(word: string): string[] | null {
  const w = word.toLowerCase()
  return WORDSET[w]?.gpcs ?? EXTRA[w] ?? NAMES[w] ?? null
}

function sentenceIsReadable(s: Sentence, known: Set<string>, tricky: Set<string>, allowBlends: boolean): boolean {
  for (const w of sentenceWords(s.text)) {
    if (tricky.has(w)) continue
    const g = wordGpcs(w)
    if (!g) return false
    if (!g.every((id) => known.has(id) || id === 'y' && known.has('y'))) return false
    if (!allowBlends && WORDSET[w]?.blends) return false
  }
  return true
}

/** Used by the sentence activity: is this token a tricky word? */
export function isTricky(word: string): boolean {
  return Boolean(TRICKY_BY_WORD[word.toLowerCase()])
}

/** All tricky words up to the current group, for quizzes. */
export function trickyPool(p: Progress): TrickyWord[] {
  return trickyWordsThroughGroup(p.currentGroup).filter((t) => p.tricky[t.word])
}

export function groupTitle(groupId: number): string {
  return GROUPS.find((g) => g.id === groupId)?.title ?? ''
}

export { groupOf }
