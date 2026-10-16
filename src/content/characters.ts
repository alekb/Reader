/**
 * The four mascots. Their looks are built from parts (see parts.ts) and
 * they grow through levels as the child earns stars.
 */
export type CharacterBase = 'robot' | 'dragon' | 'monster' | 'monkey'

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
  { base: 'monkey', name: 'Bongo', emoji: '🐵', tagline: 'A cheeky monkey who swings from word to word.' },
]

export const CHARACTER_BY_BASE: Record<CharacterBase, Character> = Object.fromEntries(CHARACTERS.map((c) => [c.base, c])) as Record<CharacterBase, Character>
