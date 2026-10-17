import { describe, it, expect } from 'vitest'
import { GPCS, GROUPS, GPC_BY_ID } from '../content/gpcs'
import { WORDS, letterSegments } from '../content/words'
import { SENTENCES } from '../content/sentences'
import { TRICKY_WORDS } from '../content/trickyWords'
import { PARTS, levelFor, defaultLook } from '../content/parts'
import { pickSticker, STICKERS } from '../content/stickers'
import { migrateProgress } from './progress'
import { newlyUnlockedIds } from './curriculum'
import { applyAnswer, newItem, masteryOf, bumpStreak, currentStreak, DAY_MS } from './scheduler'
import { buildLesson, sentenceWords, wordGpcs } from './lessonBuilder'
import { makeNonsenseWord } from './nonsense'
import { advanceGroups, isGroupComplete, newItemPolicy, nextGpcToIntroduce } from './curriculum'
import { applyResult, createProgress, introduce } from './progress'
import type { Progress } from './types'

function seeded(seed = 1) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

describe('content integrity', () => {
  it('every group GPC exists and every GPC is in exactly one group', () => {
    const seen = new Map<string, number>()
    for (const g of GROUPS) for (const id of g.gpcIds) {
      expect(GPC_BY_ID[id], id).toBeDefined()
      seen.set(id, (seen.get(id) ?? 0) + 1)
    }
    for (const gpc of GPCS) expect(seen.get(gpc.id), gpc.id).toBe(1)
  })
  it('words are spelled by their segments', () => {
    for (const w of WORDS) {
      const segs = letterSegments(w)
      expect(segs.length, w.word).toBe(w.word.length)
    }
    expect(WORDS.find((w) => w.word === 'cake')?.gpcs).toEqual(['c', 'a_e', 'k'])
    expect(WORDS.find((w) => w.word === 'duck')?.group).toBe(4)
    expect(WORDS.find((w) => w.word === 'frog')?.group).toBe(13)
  })
  it('sentences only use decodable or tricky words', () => {
    const trickySet = new Set(TRICKY_WORDS.map((t) => t.word.toLowerCase()))
    for (const s of SENTENCES) {
      for (const w of sentenceWords(s.text)) {
        if (trickySet.has(w)) continue
        expect(wordGpcs(w), `${w} in "${s.text}"`).not.toBeNull()
      }
    }
  })
  it('sentences respect their group (all GPCs taught by then)', () => {
    const groupOfGpc = new Map<string, number>()
    for (const g of GROUPS) for (const id of g.gpcIds) groupOfGpc.set(id, g.id)
    const trickyGroup = new Map(TRICKY_WORDS.map((t) => [t.word.toLowerCase(), t.group]))
    for (const s of SENTENCES) {
      for (const w of sentenceWords(s.text)) {
        if (trickyGroup.has(w)) {
          expect(trickyGroup.get(w)!, `${w} in "${s.text}"`).toBeLessThanOrEqual(s.group)
          continue
        }
        for (const id of wordGpcs(w) ?? []) {
          expect(groupOfGpc.get(id)!, `${id} (${w}) in "${s.text}"`).toBeLessThanOrEqual(s.group)
        }
      }
    }
  })
  it('every character has a default colour part and part ids are unique', () => {
    for (const base of ['robot', 'dragon', 'monster', 'monkey', 'croc'] as const) {
      expect(PARTS.filter((p) => p.slot === 'color' && p.base === base && p.unlock.type === 'default').length).toBe(1)
      expect(PARTS.find((p) => p.id === defaultLook(base).color)).toBeDefined()
    }
    expect(new Set(PARTS.map((p) => p.id)).size).toBe(PARTS.length)
  })
})

describe('scheduler', () => {
  it('promotes on fast correct, demotes on wrong', () => {
    const now = Date.now()
    let it1 = newItem(now)
    it1 = applyAnswer(it1, true, 1000, now, true)
    expect(it1.box).toBe(1)
    expect(it1.due).toBeGreaterThan(now)
    it1 = applyAnswer(it1, true, 1000, now + DAY_MS, true)
    expect(it1.box).toBe(2)
    it1 = applyAnswer(it1, false, 1000, now + 2 * DAY_MS, true)
    expect(it1.box).toBe(1)
    expect(it1.due).toBe(now + 2 * DAY_MS)
    expect(it1.correctStreak).toBe(0)
  })
  it('slow correct answers do not promote beyond box 1', () => {
    const now = Date.now()
    let it1 = applyAnswer(newItem(now), true, 1000, now, true)
    it1 = applyAnswer(it1, true, 5000, now + DAY_MS, true)
    expect(it1.box).toBe(1)
  })
  it('mastery requires 3 streak days and box >= 3', () => {
    const now = Date.now()
    let it1 = newItem(now)
    for (let d = 0; d < 4; d++) it1 = applyAnswer(it1, true, 800, now + d * DAY_MS, true)
    expect(masteryOf(it1)).toBe('mastered')
  })
  it('streak counts consecutive days', () => {
    const now = Date.now()
    let s = bumpStreak({ count: 0, lastDay: '' }, now)
    expect(s.count).toBe(1)
    s = bumpStreak(s, now)
    expect(s.count).toBe(1)
    s = bumpStreak(s, now + DAY_MS)
    expect(s.count).toBe(2)
    expect(currentStreak(s, now + 3 * DAY_MS)).toBe(0)
  })
})

describe('lesson builder', () => {
  it('first lesson introduces s and has a close step', () => {
    const p = createProgress('Kid', 'robot', Date.now())
    const lesson = buildLesson(p, { now: Date.now(), rnd: seeded(3) })
    expect(lesson.newGpcIds).toEqual(['s', 'a'])
    expect(lesson.steps[lesson.steps.length - 1].kind).toBe('close')
    expect(lesson.steps.some((s) => s.kind === 'newSound')).toBe(true)
  })
  it('blends words after a few sounds are known', () => {
    const now = Date.now()
    let p = createProgress('Kid', 'robot', now)
    for (const id of ['s', 'a', 't']) p.gpcs[id] = applyAnswer(newItem(now), true, 800, now, false)
    p.sessionsCompleted = 3 // not consolidation? 3 % 4 === 3 -> consolidation
    let lesson = buildLesson(p, { now, rnd: seeded(5) })
    expect(lesson.consolidation).toBe(true)
    expect(lesson.newGpcIds).toEqual([])
    p = { ...p, sessionsCompleted: 4 }
    lesson = buildLesson(p, { now, rnd: seeded(5) })
    expect(lesson.newGpcIds).toEqual(['p'])
    const blend = lesson.steps.find((s) => s.kind === 'blend')
    expect(blend && blend.kind === 'blend' && blend.words.length).toBeGreaterThan(0)
  })
  it('does not introduce new sounds after a bad session', () => {
    const now = Date.now()
    const p: Progress = { ...createProgress('Kid', 'robot', now), lastSessionAccuracy: 0.5 }
    p.gpcs['s'] = applyAnswer(newItem(now), true, 800, now, false)
    expect(newItemPolicy(p, now).allowNewGpc).toBe(false)
  })
  it('advances groups when all GPCs are secure', () => {
    const now = Date.now()
    let p = createProgress('Kid', 'robot', now)
    for (const id of ['s', 'a', 't', 'p']) {
      let it1 = applyAnswer(newItem(now), true, 800, now, true)
      it1 = applyAnswer(it1, true, 800, now + DAY_MS, true)
      p.gpcs[id] = it1
    }
    expect(isGroupComplete(p, 1)).toBe(true)
    p = advanceGroups(p)
    expect(p.currentGroup).toBe(2)
    expect(nextGpcToIntroduce(p)).toBe('i')
  })
})

describe('nonsense words', () => {
  it('never returns a real word from the bank', () => {
    const rnd = seeded(9)
    for (let i = 0; i < 50; i++) {
      const w = makeNonsenseWord(['s', 'a', 't', 'p', 'i', 'n', 'm', 'd'], rnd)
      expect(w).not.toBeNull()
      expect(WORDS.find((x) => x.word === w!.word)).toBeUndefined()
    }
  })
})

describe('parts, levels and stickers', () => {
  it('levels follow the star thresholds', () => {
    expect(levelFor(0)).toBe(1)
    expect(levelFor(99)).toBe(1)
    expect(levelFor(100)).toBe(2)
    expect(levelFor(300)).toBe(3)
    expect(levelFor(1500)).toBe(5)
    expect(levelFor(99999)).toBe(5)
  })
  it('unlocks parts by stars, sessions and islands', () => {
    const now = Date.now()
    const p = createProgress('Kid', 'robot', now)
    expect(newlyUnlockedIds(p, now)).toEqual([])
    const rich: Progress = { ...p, xp: 100, sessionsCompleted: 5, completedGroups: [1] }
    const ids = newlyUnlockedIds(rich, now)
    expect(ids).toContain('color-robot-lime')
    expect(ids).toContain('outfit-scarf')
    expect(ids).toContain('outfit-bowtie')
    expect(ids).toContain('hat-cap')
    expect(ids).toContain('paint-pink')
    expect(ids).toContain('color-dragon-lime') // colour tiers unlock for every buddy so switching keeps the tier
  })
  it('migrates a v1 save with skins into parts', () => {
    const old = { version: 1, childName: 'Leo', character: 'dragon', skinId: 'dragon-island1', unlockedSkins: ['dragon-classic', 'dragon-island1', 'dragon-stars60', 'dragon-words100'], xp: 200, wordsRead: 3, knownWords: {}, gpcs: {}, tricky: {}, groupWords: {}, completedGroups: [1], currentGroup: 2, sessionsCompleted: 3, lastSessionAccuracy: 0.9, streak: { count: 1, lastDay: '' }, dailyGoalMin: 12, settings: { sfx: true, voiceRate: 0.9 }, createdAt: 1, updatedAt: 2 }
    const m = migrateProgress(old)!
    expect(m.version).toBe(2)
    expect(m.character).toBe('dragon')
    expect(m.look.color).toBe('color-dragon-classic')
    expect(m.unlockedParts).toContain('hat-cap')
    expect(m.unlockedParts).toContain('color-dragon-lime')
    expect(m.unlockedParts).toContain('outfit-medal')
    expect(m.xp).toBe(200)
    expect(m.stickers).toEqual([])
    expect(m.unlockedParts).toContain('paint-red')
  })
  it('back-fills default paints into an existing v2 save', () => {
    const now = Date.now()
    const p = { ...createProgress('Kid', 'robot', now), unlockedParts: ['color-robot-classic'] }
    const m = migrateProgress(p)!
    expect(m).not.toBe(p)
    expect(m.unlockedParts).toContain('paint-blue')
    expect(migrateProgress(m)).toBe(m)
  })
  it('sticker picks prefer unowned stickers', () => {
    const owned = STICKERS.slice(0, -1).map((s) => s.id)
    expect(pickSticker(owned, () => 0.5).id).toBe(STICKERS[STICKERS.length - 1].id)
  })
})

describe('whole-curriculum simulation', () => {
  it('a learner who answers everything reaches the end without a broken lesson', () => {
    const DAY = 86400000
    let now = Date.UTC(2026, 0, 1, 12)
    let p = createProgress('Kid', 'robot', now)
    let finished = false
    for (let day = 0; day < 200 && !finished; day++) {
      const lesson = buildLesson(p, { now, rnd: seeded(day + 1) })
      for (const step of lesson.steps) {
        if (step.kind === 'trickyIntro') expect(step.word, `day ${day} group ${p.currentGroup}`).toBeDefined()
        if (step.kind === 'newSound') p = applyResult(introduce(p, 'gpc', step.gpcId, now), { kind: 'gpc', id: step.gpcId, correct: true, ms: 500 }, now)
        if (step.kind === 'trickyIntro') p = applyResult(introduce(p, 'tricky', step.word.word, now), { kind: 'tricky', id: step.word.word, correct: true, ms: 500 }, now)
        if (step.kind === 'speedSounds') for (const it2 of step.items) p = applyResult(p, { kind: it2.type, id: it2.id, correct: true, ms: 500, scheduled: true }, now)
        if (step.kind === 'blend' || step.kind === 'build') for (const w of step.words) p = applyResult(p, { kind: 'word', id: w.word, correct: true, ms: 500, group: p.currentGroup, nonsense: w.group === 0 }, now)
      }
      p = advanceGroups({ ...p, sessionsCompleted: p.sessionsCompleted + 1, lastSessionAccuracy: 1 })
      finished = p.completedGroups.length === GROUPS.length && Object.keys(p.tricky).length === TRICKY_WORDS.length
      now += DAY
    }
    expect(p.completedGroups.length).toBe(GROUPS.length)
    expect(Object.keys(p.tricky).length).toBe(TRICKY_WORDS.length)
    expect(newItemPolicy(p, now).reason).toMatch(/Every sound/)
  })
  it('sentences containing the heart word "I" can be chosen', () => {
    const now = Date.now()
    const p = createProgress('Kid', 'robot', now)
    for (const id of ['s', 'a', 't', 'p', 'i', 'n', 'm', 'd', 'g', 'o', 'c', 'k']) p.gpcs[id] = applyAnswer(newItem(now), true, 500, now, false)
    for (const w of ['the', 'to', 'I']) p.tricky[w] = newItem(now)
    p.currentGroup = 3
    const seen = new Set<string>()
    for (let i = 1; i < 60; i++) {
      const l = buildLesson(p, { now, rnd: seeded(i) })
      for (const s of l.steps) if (s.kind === 'sentences') s.sentences.forEach((x) => seen.add(x.text))
    }
    expect([...seen].some((t) => /\bI\b/.test(t))).toBe(true)
  })
})
