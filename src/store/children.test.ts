import { beforeEach, describe, expect, it } from 'vitest'
import { childList, useProgress } from './progressStore'
import { createProgress, LEGACY_CHILD_ID, migrateProgress } from '../engine/progress'
import { mergeAccount, removalKey } from '../firebase/sync'
import type { ChildRecord, Progress } from '../engine/types'

const S = () => useProgress.getState()
const names = () => childList(S()).map((c) => c.childName)

describe('several children on one device', () => {
  beforeEach(() => S().clearDevice())

  it('adds, switches and keeps each child separate', () => {
    S().setup('Leo', 'robot')
    const leo = S().progress!.id
    S().startSession(1)
    S().recordResult({ kind: 'word', id: 'sat', correct: true, ms: 900 }, 'blend')
    const leoXp = S().progress!.xp
    expect(leoXp).toBeGreaterThan(0)

    S().addChild()
    expect(S().progress).toBeNull()
    S().setup('Mia', 'dragon')
    const mia = S().progress!.id
    expect(mia).not.toBe(leo)
    expect(S().progress!.xp).toBe(0)
    expect(names()).toEqual(['Leo', 'Mia'])

    S().setSettings({ voice: 'male' })
    S().switchChild(leo)
    expect(S().progress!.childName).toBe('Leo')
    expect(S().progress!.xp).toBe(leoXp)
    expect(S().progress!.settings.voice).toBe('female')
    expect(S().others[mia].progress.settings.voice).toBe('male')
  })

  it('starts one child over, keeping name, buddy and settings', () => {
    S().setup('Leo', 'monster')
    S().setSettings({ voice: 'male' })
    S().recordResult({ kind: 'word', id: 'sat', correct: true, ms: 900 }, 'blend')
    const id = S().progress!.id
    S().resetChild(id)
    const p = S().progress!
    expect([p.id, p.childName, p.character, p.settings.voice, p.xp]).toEqual([id, 'Leo', 'monster', 'male', 0])
  })

  it('removing the child playing hands over to the next one, then to the welcome screen', () => {
    S().setup('Leo', 'robot')
    S().addChild()
    S().setup('Mia', 'dragon')
    S().removeChild(S().progress!.id)
    expect(S().progress!.childName).toBe('Leo')
    expect(S().others).toEqual({})
    S().removeChild(S().progress!.id)
    expect(S().progress).toBeNull()
  })

  it('stays on the welcome screen when a sync lands while a child is being added', () => {
    S().setup('Leo', 'robot')
    S().addChild()
    S().setChildren({ ...S().others })
    expect(S().progress).toBeNull()
    expect(names()).toEqual(['Leo'])
  })
})

describe('cloud merge with several children', () => {
  const rec = (name: string, id: string, createdAt = 1, xp = 0): ChildRecord => ({ progress: { ...createProgress(name, 'robot', createdAt, id), xp }, sessions: [] })
  const remote = (r: ChildRecord, resetAt = 0) => ({ progress: r.progress, sessions: r.sessions, resetAt })

  it('combines children from both sides and merges the same child', () => {
    const out = mergeAccount({ a: rec('Leo', 'a', 1, 10), b: rec('Mia', 'b') }, { children: { a: remote(rec('Leo', 'a', 1, 30)), c: remote(rec('Zoe', 'c')) }, removed: [] })
    expect(Object.keys(out).sort()).toEqual(['a', 'b', 'c'])
    expect(out.a.progress.xp).toBe(30)
  })

  it('drops children removed on another device', () => {
    const out = mergeAccount({ a: rec('Leo', 'a'), b: rec('Mia', 'b') }, { children: {}, removed: ['b'] })
    expect(Object.keys(out)).toEqual(['a'])
  })

  it('takes the cloud copy of a child started over elsewhere', () => {
    const local = rec('Leo', 'a', 1, 99)
    const fresh = rec('Leo', 'a', 500, 0)
    expect(mergeAccount({ a: local }, { children: { a: remote(fresh, 400) }, removed: [] }).a.progress.xp).toBe(0)
    // Reset in the cloud but the new copy not uploaded yet: start over here too, keeping the child.
    const restarted = mergeAccount({ a: local }, { children: { a: { progress: null, sessions: [], resetAt: 400 } }, removed: [] }).a.progress
    expect([restarted.childName, restarted.xp, restarted.createdAt]).toEqual(['Leo', 0, 400])
  })

  it('a removed first child does not hide a different first child from another device', () => {
    const removedLeo = rec('Leo', LEGACY_CHILD_ID, 100)
    const otherMain = rec('Ava', LEGACY_CHILD_ID, 200)
    const remote = { children: {}, removed: [removalKey(removedLeo.progress)] }
    expect(mergeAccount({ [LEGACY_CHILD_ID]: removedLeo }, remote)).toEqual({})
    expect(mergeAccount({ [LEGACY_CHILD_ID]: otherMain }, remote)[LEGACY_CHILD_ID].progress.childName).toBe('Ava')
  })

  it('gives progress saved before multiple children the shared first-child id', () => {
    const old = { ...createProgress('Leo', 'robot', 1) } as Partial<Progress>
    delete old.id
    expect(migrateProgress(old)!.id).toBe(LEGACY_CHILD_ID)
  })
})
