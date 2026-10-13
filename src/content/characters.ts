/**
 * Mascot characters and unlockable skins. Skins unlock with XP (earned by
 * effort, never accuracy) and with milestones (finishing a group/island).
 */
export type CharacterBase = 'robot' | 'dragon' | 'monster'

export interface Skin {
  id: string
  name: string
  base: CharacterBase
  /** Main body color. */
  body: string
  /** Secondary / belly color. */
  accent: string
  /** Optional accessory drawn on top. */
  accessory?: 'none' | 'crown' | 'glasses' | 'cap' | 'wizard' | 'headphones' | 'bow' | 'pirate' | 'astro' | 'party'
  /** How this skin is unlocked. */
  unlock: { type: 'default' } | { type: 'xp'; xp: number } | { type: 'group'; group: number } | { type: 'streak'; days: number } | { type: 'words'; count: number }
}

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

const skin = (
  base: CharacterBase,
  id: string,
  name: string,
  body: string,
  accent: string,
  unlock: Skin['unlock'],
  accessory: Skin['accessory'] = 'none',
): Skin => ({ id: `${base}-${id}`, name, base, body, accent, unlock, accessory })

export const SKINS: Skin[] = [
  // Robot
  skin('robot', 'classic', 'Classic Bolt', '#60a5fa', '#dbeafe', { type: 'default' }),
  skin('robot', 'lime', 'Lime Bolt', '#a3e635', '#ecfccb', { type: 'xp', xp: 150 }),
  skin('robot', 'cap', 'Cool Cap', '#f472b6', '#fce7f3', { type: 'group', group: 1 }, 'cap'),
  skin('robot', 'glasses', 'Brainy Bolt', '#fbbf24', '#fef3c7', { type: 'group', group: 2 }, 'glasses'),
  skin('robot', 'headphones', 'DJ Bolt', '#a78bfa', '#ede9fe', { type: 'group', group: 4 }, 'headphones'),
  skin('robot', 'astro', 'Astro Bolt', '#e5e7eb', '#f9fafb', { type: 'group', group: 7 }, 'astro'),
  skin('robot', 'gold', 'Golden Bolt', '#f59e0b', '#fde68a', { type: 'words', count: 100 }, 'crown'),
  skin('robot', 'wizard', 'Wizard Bolt', '#312e81', '#c7d2fe', { type: 'group', group: 14 }, 'wizard'),
  skin('robot', 'streak', 'Streak Bolt', '#ef4444', '#fee2e2', { type: 'streak', days: 7 }, 'party'),
  // Dragon
  skin('dragon', 'classic', 'Classic Ember', '#22c55e', '#bbf7d0', { type: 'default' }),
  skin('dragon', 'fire', 'Fire Ember', '#f97316', '#fed7aa', { type: 'xp', xp: 150 }),
  skin('dragon', 'bow', 'Fancy Ember', '#ec4899', '#fbcfe8', { type: 'group', group: 1 }, 'bow'),
  skin('dragon', 'glasses', 'Smart Ember', '#06b6d4', '#cffafe', { type: 'group', group: 2 }, 'glasses'),
  skin('dragon', 'pirate', 'Pirate Ember', '#64748b', '#e2e8f0', { type: 'group', group: 4 }, 'pirate'),
  skin('dragon', 'ice', 'Ice Ember', '#93c5fd', '#eff6ff', { type: 'group', group: 7 }, 'none'),
  skin('dragon', 'crown', 'King Ember', '#eab308', '#fef9c3', { type: 'words', count: 100 }, 'crown'),
  skin('dragon', 'wizard', 'Wizard Ember', '#7c3aed', '#ddd6fe', { type: 'group', group: 14 }, 'wizard'),
  skin('dragon', 'streak', 'Party Ember', '#f43f5e', '#ffe4e6', { type: 'streak', days: 7 }, 'party'),
  // Monster
  skin('monster', 'classic', 'Classic Fuzz', '#a855f7', '#f3e8ff', { type: 'default' }),
  skin('monster', 'slime', 'Slime Fuzz', '#84cc16', '#ecfccb', { type: 'xp', xp: 150 }),
  skin('monster', 'cap', 'Sporty Fuzz', '#0ea5e9', '#e0f2fe', { type: 'group', group: 1 }, 'cap'),
  skin('monster', 'glasses', 'Nerdy Fuzz', '#fb923c', '#ffedd5', { type: 'group', group: 2 }, 'glasses'),
  skin('monster', 'headphones', 'Rocker Fuzz', '#111827', '#9ca3af', { type: 'group', group: 4 }, 'headphones'),
  skin('monster', 'astro', 'Space Fuzz', '#14b8a6', '#ccfbf1', { type: 'group', group: 7 }, 'astro'),
  skin('monster', 'crown', 'Royal Fuzz', '#d946ef', '#fae8ff', { type: 'words', count: 100 }, 'crown'),
  skin('monster', 'wizard', 'Wizard Fuzz', '#1d4ed8', '#bfdbfe', { type: 'group', group: 14 }, 'wizard'),
  skin('monster', 'streak', 'Party Fuzz', '#f59e0b', '#fef3c7', { type: 'streak', days: 7 }, 'party'),
]

export const SKIN_BY_ID: Record<string, Skin> = Object.fromEntries(SKINS.map((s) => [s.id, s]))

export function defaultSkin(base: CharacterBase): Skin {
  return SKINS.find((s) => s.base === base && s.unlock.type === 'default')!
}

export function unlockDescription(u: Skin['unlock']): string {
  switch (u.type) {
    case 'default': return 'Yours from the start'
    case 'xp': return `Earn ${u.xp} stars`
    case 'group': return `Finish island ${u.group}`
    case 'streak': return `Practice ${u.days} days in a row`
    case 'words': return `Read ${u.count} words`
  }
}
