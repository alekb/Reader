import { describe, expect, it } from 'vitest'
import { createProgress, migrateProgress } from './progress'
import { mergeProgress } from '../firebase/sync'
import type { Progress } from './types'

describe('settings', () => {
  it('back-fills the voice on progress saved before it existed', () => {
    const old = { ...createProgress('Leo', 'robot', 1), settings: { sfx: false, voiceRate: 1.1 } } as unknown as Progress
    expect(migrateProgress(old)!.settings).toEqual({ sfx: false, voiceRate: 1.1, voice: 'male', changedAt: 0 })
  })

  it('moves never-changed settings to the male default and keeps a chosen voice', () => {
    const untouched = { ...createProgress('Leo', 'robot', 1), settings: { sfx: true, voiceRate: 0.9, voice: 'female', changedAt: 0 } } as Progress
    const m = migrateProgress(untouched)!
    expect(m.settings.voice).toBe('male')
    expect(migrateProgress(m)).toBe(m)
    const chosen = { ...untouched, settings: { ...untouched.settings, changedAt: 500 } }
    expect(migrateProgress(chosen)!.settings.voice).toBe('female')
  })

  it('keeps the latest settings change even when the other device played later', () => {
    const phone: Progress = { ...createProgress('Leo', 'robot', 1), updatedAt: 1000, settings: { sfx: true, voiceRate: 0.9, voice: 'female', changedAt: 1000 } }
    const tablet: Progress = { ...createProgress('Leo', 'robot', 1), updatedAt: 5000, xp: 50 }
    for (const merged of [mergeProgress(phone, tablet)!, mergeProgress(tablet, phone)!]) {
      expect(merged.settings.voice).toBe('female')
      expect(merged.xp).toBe(50)
    }
  })
})
