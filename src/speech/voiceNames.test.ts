import { describe, expect, it } from 'vitest'
import { voiceGenderOf } from './voiceNames'

describe('voice names', () => {
  it.each([
    ['Google UK English Male', 'male'],
    ['Google UK English Female', 'female'],
    ['Microsoft David - English (United States)', 'male'],
    ['Microsoft Aria Online (Natural) - English (United States)', 'female'],
    ['Alex', 'male'],
    ['en-us-x-iol-local', 'male'],
    ['en-us-x-sfg-network', 'female'],
    // An explicit marker beats the voice family: this is a male variant of sfg.
    ['en-us-x-sfg#male_1-local', 'male'],
    ['en-us-x-iol#female_2-local', 'female'],
  ])('%s is %s', (name, g) => expect(voiceGenderOf(name)).toBe(g))

  it.each(['Google US English', 'American English', 'Chrome OS US English', 'Generic voice'])('%s gives no hint', (name) => {
    expect(voiceGenderOf(name)).toBeNull()
  })
})
