/**
 * The three mascots. Their looks are built from parts (see parts.ts) and
 * they grow through levels as the child earns stars.
 */
export type CharacterBase = 'robot' | 'dragon' | 'monster'

export interface Character {
  base: CharacterBase
  name: string
  emoji: string
  tagline: string
}

export const CHARACTERS: Character[] = [
  { base: 'robot', name: 'Bolt', emoji: '🤖', tagline: 'A clever robot who runs on sounds.' },
  { base: 'dragon', name: 'Ember', emoji: '🐉', tagline: 'A brave dragon who loves big words.' },
  { base: 'monster', name: 'Fuzz', emoji: '👾', tagline: 'A silly monster who eats letters for lunch.' },
]

export const CHARACTER_BY_BASE: Record<CharacterBase, Character> = Object.fromEntries(CHARACTERS.map((c) => [c.base, c])) as Record<CharacterBase, Character>
