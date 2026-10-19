import { describe, expect, it } from 'vitest'
import { GPCS, GPC_BY_ID } from '../../content/gpcs'
import { pickSoundDistractors, soundsAlike } from './common'

const ALL = GPCS.map((g) => g.id)
const FIRST = ['s', 'a', 't', 'p', 'i', 'n', 'm', 'd']

describe('soundsAlike', () => {
  it('treats spellings of one sound and near sounds as alike, both ways', () => {
    for (const [a, b] of [['m', 'n'], ['c', 'k'], ['ee', 'ea'], ['t', 'd'], ['e', 'i'], ['ur', 'er']]) {
      expect(soundsAlike(a, b)).toBe(true)
      expect(soundsAlike(b, a)).toBe(true)
    }
    for (const [a, b] of [['m', 's'], ['b', 'd'], ['a', 'i'], ['t', 'p']]) expect(soundsAlike(a, b)).toBe(false)
  })
})

describe('pickSoundDistractors', () => {
  it('never offers two options that sound alike or share a spelling', () => {
    for (const known of [[], FIRST, ALL]) {
      for (const target of ALL) {
        for (let run = 0; run < 20; run++) {
          const picks = pickSoundDistractors(target, known)
          expect(picks).toHaveLength(3)
          const options = [target, ...picks]
          for (let i = 0; i < options.length; i++) {
            for (let j = i + 1; j < options.length; j++) {
              expect(soundsAlike(options[i], options[j]), `${options[i]} / ${options[j]}`).toBe(false)
              expect(GPC_BY_ID[options[i]].grapheme).not.toBe(GPC_BY_ID[options[j]].grapheme)
            }
          }
        }
      }
    }
  })

  it('keeps look-alike letters that sound different (b with d)', () => {
    const seen = new Set<string>()
    for (let run = 0; run < 50; run++) for (const id of pickSoundDistractors('b', [...FIRST, 'b', 'h'])) seen.add(id)
    expect(seen.has('d')).toBe(true)
    expect(seen.has('p')).toBe(false)
  })

  it('uses what the child knows before other letters', () => {
    for (let run = 0; run < 20; run++) for (const id of pickSoundDistractors('m', FIRST)) expect(FIRST).toContain(id)
  })
})
