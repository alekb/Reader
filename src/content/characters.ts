/**
 * Mascot characters and unlockable skins. Skins unlock with XP (earned by
 * effort, never accuracy) and with milestones (finishing a group/island).
 */
import { GROUPS } from './gpcs'

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
  accessory?: 'none' | 'crown' | 'glasses' | 'cap' | 'wizard' | 'headphones' | 'bow' | 'pirate' | 'astro' | 'party' | 'scarf' | 'flower' | 'bandana' | 'halo' | 'shield' | 'sunglasses' | 'cape' | 'backpack' | 'medal'
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

/** Accessory and colours for each island reward, per character. */
const ISLAND_REWARDS: { group: number; accessory: Skin['accessory']; name: string; colors: Record<CharacterBase, [string, string]> }[] = [
  { group: 1, accessory: 'cap', name: 'Beach Cap', colors: { robot: ['#f472b6', '#fce7f3'], dragon: ['#ec4899', '#fbcfe8'], monster: ['#0ea5e9', '#e0f2fe'] } },
  { group: 2, accessory: 'glasses', name: 'Brainy', colors: { robot: ['#fbbf24', '#fef3c7'], dragon: ['#06b6d4', '#cffafe'], monster: ['#fb923c', '#ffedd5'] } },
  { group: 3, accessory: 'scarf', name: 'Mountain Scarf', colors: { robot: ['#38bdf8', '#e0f2fe'], dragon: ['#84cc16', '#ecfccb'], monster: ['#f43f5e', '#ffe4e6'] } },
  { group: 4, accessory: 'headphones', name: 'DJ', colors: { robot: ['#a78bfa', '#ede9fe'], dragon: ['#64748b', '#e2e8f0'], monster: ['#111827', '#9ca3af'] } },
  { group: 5, accessory: 'flower', name: 'Jungle Flower', colors: { robot: ['#22c55e', '#bbf7d0'], dragon: ['#f97316', '#fed7aa'], monster: ['#16a34a', '#dcfce7'] } },
  { group: 6, accessory: 'bandana', name: 'Volcano Bandana', colors: { robot: ['#ef4444', '#fee2e2'], dragon: ['#dc2626', '#fecaca'], monster: ['#f97316', '#ffedd5'] } },
  { group: 7, accessory: 'astro', name: 'Astro', colors: { robot: ['#e5e7eb', '#f9fafb'], dragon: ['#93c5fd', '#eff6ff'], monster: ['#14b8a6', '#ccfbf1'] } },
  { group: 8, accessory: 'pirate', name: 'Captain', colors: { robot: ['#0f172a', '#cbd5e1'], dragon: ['#1e3a8a', '#bfdbfe'], monster: ['#334155', '#e2e8f0'] } },
  { group: 9, accessory: 'halo', name: 'Rainbow', colors: { robot: ['#f9a8d4', '#fdf2f8'], dragon: ['#c084fc', '#f3e8ff'], monster: ['#fde047', '#fefce8'] } },
  { group: 10, accessory: 'shield', name: 'Moon Guard', colors: { robot: ['#818cf8', '#e0e7ff'], dragon: ['#475569', '#cbd5e1'], monster: ['#6366f1', '#e0e7ff'] } },
  { group: 11, accessory: 'sunglasses', name: 'Surfer', colors: { robot: ['#2dd4bf', '#ccfbf1'], dragon: ['#0ea5e9', '#e0f2fe'], monster: ['#fb7185', '#ffe4e6'] } },
  { group: 12, accessory: 'cape', name: 'Cloud Hero', colors: { robot: ['#60a5fa', '#dbeafe'], dragon: ['#f43f5e', '#ffe4e6'], monster: ['#a855f7', '#f3e8ff'] } },
  { group: 13, accessory: 'backpack', name: 'Explorer', colors: { robot: ['#a3a3a3', '#f5f5f5'], dragon: ['#65a30d', '#ecfccb'], monster: ['#d97706', '#fef3c7'] } },
  { group: 14, accessory: 'wizard', name: 'Wizard', colors: { robot: ['#312e81', '#c7d2fe'], dragon: ['#7c3aed', '#ddd6fe'], monster: ['#1d4ed8', '#bfdbfe'] } },
  { group: 15, accessory: 'medal', name: 'Champion', colors: { robot: ['#f59e0b', '#fde68a'], dragon: ['#eab308', '#fef9c3'], monster: ['#d946ef', '#fae8ff'] } },
  { group: 16, accessory: 'crown', name: 'Ocean King', colors: { robot: ['#0891b2', '#cffafe'], dragon: ['#0e7490', '#a5f3fc'], monster: ['#2563eb', '#dbeafe'] } },
]

/** Star-tier colour variants (effort-based, so these arrive every few sessions). */
const STAR_TIERS: { xp: number; name: string; colors: Record<CharacterBase, [string, string]> }[] = [
  { xp: 60, name: 'Lime', colors: { robot: ['#a3e635', '#ecfccb'], dragon: ['#fb923c', '#ffedd5'], monster: ['#84cc16', '#ecfccb'] } },
  { xp: 150, name: 'Berry', colors: { robot: ['#e879f9', '#fae8ff'], dragon: ['#f472b6', '#fce7f3'], monster: ['#f43f5e', '#ffe4e6'] } },
  { xp: 300, name: 'Sky', colors: { robot: ['#0ea5e9', '#e0f2fe'], dragon: ['#38bdf8', '#e0f2fe'], monster: ['#06b6d4', '#cffafe'] } },
  { xp: 600, name: 'Sunset', colors: { robot: ['#f97316', '#ffedd5'], dragon: ['#ef4444', '#fee2e2'], monster: ['#fb923c', '#fff7ed'] } },
  { xp: 1000, name: 'Midnight', colors: { robot: ['#1e293b', '#94a3b8'], dragon: ['#312e81', '#a5b4fc'], monster: ['#4c1d95', '#c4b5fd'] } },
  { xp: 1500, name: 'Golden', colors: { robot: ['#fbbf24', '#fef3c7'], dragon: ['#f59e0b', '#fde68a'], monster: ['#eab308', '#fef9c3'] } },
]

const NAMES: Record<CharacterBase, string> = { robot: 'Bolt', dragon: 'Ember', monster: 'Fuzz' }
const BASES: CharacterBase[] = ['robot', 'dragon', 'monster']

export const SKINS: Skin[] = [
  ...BASES.map((b) =>
    skin(b, 'classic', `Classic ${NAMES[b]}`, { robot: '#60a5fa', dragon: '#22c55e', monster: '#a855f7' }[b], { robot: '#dbeafe', dragon: '#bbf7d0', monster: '#f3e8ff' }[b], { type: 'default' }),
  ),
  ...BASES.flatMap((b) => STAR_TIERS.map((t) => skin(b, `stars${t.xp}`, `${t.name} ${NAMES[b]}`, t.colors[b][0], t.colors[b][1], { type: 'xp', xp: t.xp }))),
  ...BASES.flatMap((b) => ISLAND_REWARDS.map((r) => skin(b, `island${r.group}`, `${r.name} ${NAMES[b]}`, r.colors[b][0], r.colors[b][1], { type: 'group', group: r.group }, r.accessory))),
  ...BASES.map((b) => skin(b, 'streak3', `Party ${NAMES[b]}`, '#f43f5e', '#ffe4e6', { type: 'streak', days: 3 }, 'party')),
  ...BASES.map((b) => skin(b, 'streak7', `Bow ${NAMES[b]}`, '#ec4899', '#fbcfe8', { type: 'streak', days: 7 }, 'bow')),
  ...BASES.map((b) => skin(b, 'words30', `Reader ${NAMES[b]}`, '#fde047', '#fefce8', { type: 'words', count: 30 }, 'glasses')),
  ...BASES.map((b) => skin(b, 'words100', `Royal ${NAMES[b]}`, '#f59e0b', '#fde68a', { type: 'words', count: 100 }, 'crown')),
  ...BASES.map((b) => skin(b, 'words250', `Legend ${NAMES[b]}`, '#7c3aed', '#ddd6fe', { type: 'words', count: 250 }, 'halo')),
]

export const SKIN_BY_ID: Record<string, Skin> = Object.fromEntries(SKINS.map((s) => [s.id, s]))

export function defaultSkin(base: CharacterBase): Skin {
  return SKINS.find((s) => s.base === base && s.unlock.type === 'default')!
}

export function unlockDescription(u: Skin['unlock']): string {
  switch (u.type) {
    case 'default': return 'Yours from the start'
    case 'xp': return `Earn ${u.xp} stars`
    case 'group': return `Finish ${GROUPS.find((g) => g.id === u.group)?.title ?? `island ${u.group}`}`
    case 'streak': return `Practice ${u.days} days in a row`
    case 'words': return `Read ${u.count} words`
  }
}
