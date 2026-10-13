/**
 * Mix-and-match character parts. A look is one part per slot:
 * colour (per character), hat, face, outfit and aura. Every part is its own
 * unlock, so the child gets a new reward moment every session or two.
 *
 * Character levels (the buddy itself growing) are also defined here.
 */
import type { CharacterBase } from './characters'
import { GROUPS } from './gpcs'

export type Slot = 'color' | 'hat' | 'face' | 'outfit' | 'aura'
export const SLOTS: Slot[] = ['color', 'hat', 'face', 'outfit', 'aura']
export const SLOT_LABEL: Record<Slot, string> = { color: 'Color', hat: 'Hat', face: 'Face', outfit: 'Outfit', aura: 'Aura' }

export type Unlock =
  | { type: 'default' }
  | { type: 'xp'; xp: number }
  | { type: 'group'; group: number }
  | { type: 'streak'; days: number }
  | { type: 'words'; count: number }
  | { type: 'sessions'; count: number }
  | { type: 'sounds'; count: number }

export interface Part {
  id: string
  slot: Slot
  name: string
  /** Colour parts belong to one character; everything else fits all three. */
  base?: CharacterBase
  /** For colour parts. */
  body?: string
  accent?: string
  unlock: Unlock
  /** Emoji shown in the wardrobe tile for non-colour parts. */
  icon: string
}

const colorPart = (base: CharacterBase, id: string, name: string, body: string, accent: string, unlock: Unlock): Part => ({
  id: `color-${base}-${id}`,
  slot: 'color',
  name,
  base,
  body,
  accent,
  unlock,
  icon: '🎨',
})
const part = (slot: Slot, id: string, name: string, icon: string, unlock: Unlock): Part => ({ id: `${slot}-${id}`, slot, name, icon, unlock })

const NAMES: Record<CharacterBase, string> = { robot: 'Bolt', dragon: 'Ember', monster: 'Fuzz' }
const BASES: CharacterBase[] = ['robot', 'dragon', 'monster']

const COLOR_TIERS: { id: string; name: string; unlock: Unlock; colors: Record<CharacterBase, [string, string]> }[] = [
  { id: 'classic', name: 'Classic', unlock: { type: 'default' }, colors: { robot: ['#60a5fa', '#dbeafe'], dragon: ['#22c55e', '#bbf7d0'], monster: ['#a855f7', '#f3e8ff'] } },
  { id: 'lime', name: 'Lime', unlock: { type: 'xp', xp: 40 }, colors: { robot: ['#a3e635', '#ecfccb'], dragon: ['#fb923c', '#ffedd5'], monster: ['#84cc16', '#ecfccb'] } },
  { id: 'berry', name: 'Berry', unlock: { type: 'xp', xp: 120 }, colors: { robot: ['#e879f9', '#fae8ff'], dragon: ['#f472b6', '#fce7f3'], monster: ['#f43f5e', '#ffe4e6'] } },
  { id: 'sky', name: 'Sky', unlock: { type: 'xp', xp: 250 }, colors: { robot: ['#0ea5e9', '#e0f2fe'], dragon: ['#38bdf8', '#e0f2fe'], monster: ['#06b6d4', '#cffafe'] } },
  { id: 'sunset', name: 'Sunset', unlock: { type: 'xp', xp: 450 }, colors: { robot: ['#f97316', '#ffedd5'], dragon: ['#ef4444', '#fee2e2'], monster: ['#fb923c', '#fff7ed'] } },
  { id: 'mint', name: 'Mint', unlock: { type: 'group', group: 3 }, colors: { robot: ['#2dd4bf', '#ccfbf1'], dragon: ['#84cc16', '#ecfccb'], monster: ['#14b8a6', '#ccfbf1'] } },
  { id: 'midnight', name: 'Midnight', unlock: { type: 'xp', xp: 800 }, colors: { robot: ['#1e293b', '#94a3b8'], dragon: ['#312e81', '#a5b4fc'], monster: ['#4c1d95', '#c4b5fd'] } },
  { id: 'rose', name: 'Rose', unlock: { type: 'group', group: 9 }, colors: { robot: ['#f9a8d4', '#fdf2f8'], dragon: ['#c084fc', '#f3e8ff'], monster: ['#fda4af', '#fff1f2'] } },
  { id: 'golden', name: 'Golden', unlock: { type: 'xp', xp: 1500 }, colors: { robot: ['#fbbf24', '#fef3c7'], dragon: ['#f59e0b', '#fde68a'], monster: ['#eab308', '#fef9c3'] } },
]

export const PARTS: Part[] = [
  // ---- colours (9 per character) ----
  ...BASES.flatMap((b) => COLOR_TIERS.map((t) => colorPart(b, t.id, `${t.name} ${NAMES[b]}`, t.colors[b][0], t.colors[b][1], t.unlock))),
  // ---- hats ----
  part('hat', 'cap', 'Beach Cap', '🧢', { type: 'group', group: 1 }),
  part('hat', 'party', 'Party Hat', '🎉', { type: 'streak', days: 2 }),
  part('hat', 'flower', 'Flower', '🌸', { type: 'group', group: 5 }),
  part('hat', 'bandana', 'Bandana', '🔴', { type: 'group', group: 6 }),
  part('hat', 'astro', 'Space Helmet', '🚀', { type: 'group', group: 7 }),
  part('hat', 'pirate', 'Pirate Hat', '🏴‍☠️', { type: 'group', group: 8 }),
  part('hat', 'halo', 'Halo', '😇', { type: 'words', count: 250 }),
  part('hat', 'bow', 'Bow', '🎀', { type: 'streak', days: 7 }),
  part('hat', 'wizard', 'Wizard Hat', '🧙', { type: 'group', group: 14 }),
  part('hat', 'crown', 'Crown', '👑', { type: 'group', group: 16 }),
  // ---- faces ----
  part('face', 'glasses', 'Glasses', '👓', { type: 'group', group: 2 }),
  part('face', 'sunglasses', 'Sunglasses', '🕶️', { type: 'group', group: 11 }),
  part('face', 'headphones', 'Headphones', '🎧', { type: 'group', group: 4 }),
  part('face', 'stars', 'Star Glasses', '⭐', { type: 'sounds', count: 10 }),
  part('face', 'monocle', 'Monocle', '🧐', { type: 'words', count: 60 }),
  // ---- outfits ----
  part('outfit', 'scarf', 'Scarf', '🧣', { type: 'xp', xp: 80 }),
  part('outfit', 'bowtie', 'Bow Tie', '🎀', { type: 'sessions', count: 5 }),
  part('outfit', 'badge', 'Reader Badge', '📛', { type: 'words', count: 30 }),
  part('outfit', 'medal', 'Gold Medal', '🥇', { type: 'words', count: 100 }),
  part('outfit', 'shield', 'Shield', '🛡️', { type: 'group', group: 10 }),
  part('outfit', 'backpack', 'Backpack', '🎒', { type: 'group', group: 13 }),
  part('outfit', 'cape', 'Hero Cape', '🦸', { type: 'group', group: 12 }),
  part('outfit', 'wings', 'Fairy Wings', '🧚', { type: 'sounds', count: 25 }),
  // ---- auras ----
  part('aura', 'sparkles', 'Sparkles', '✨', { type: 'xp', xp: 180 }),
  part('aura', 'bubbles', 'Bubbles', '🫧', { type: 'sessions', count: 10 }),
  part('aura', 'fire', 'Fire', '🔥', { type: 'xp', xp: 600 }),
  part('aura', 'lightning', 'Lightning', '⚡', { type: 'streak', days: 14 }),
  part('aura', 'rainbow', 'Rainbow', '🌈', { type: 'group', group: 15 }),
  part('aura', 'ring', 'Star Ring', '💫', { type: 'sounds', count: 44 }),
]

export const PART_BY_ID: Record<string, Part> = Object.fromEntries(PARTS.map((p) => [p.id, p]))

/** What the child is wearing: a part id per slot (null = nothing). */
export type Look = Record<Slot, string | null>

export function defaultLook(base: CharacterBase): Look {
  return { color: `color-${base}-classic`, hat: null, face: null, outfit: null, aura: null }
}

export function partsForSlot(slot: Slot, base: CharacterBase): Part[] {
  return PARTS.filter((p) => p.slot === slot && (!p.base || p.base === base))
}

export function defaultPartIds(): string[] {
  return PARTS.filter((p) => p.unlock.type === 'default').map((p) => p.id)
}

export function colorOf(look: Look, base: CharacterBase): { body: string; accent: string } {
  const p = (look.color && PART_BY_ID[look.color]) || PART_BY_ID[`color-${base}-classic`]
  return { body: p.body!, accent: p.accent! }
}

/** The bare id of a part ("hat-cap" -> "cap") for the renderer. */
export function kindOf(partId: string | null): string | null {
  if (!partId) return null
  const i = partId.indexOf('-')
  return i < 0 ? partId : partId.slice(i + 1)
}

export function unlockDescription(u: Unlock): string {
  switch (u.type) {
    case 'default': return 'Yours from the start'
    case 'xp': return `Earn ${u.xp} stars`
    case 'group': return `Finish ${GROUPS.find((g) => g.id === u.group)?.title ?? `island ${u.group}`}`
    case 'streak': return `Practice ${u.days} days in a row`
    case 'words': return `Read ${u.count} words`
    case 'sessions': return `Finish ${u.count} sessions`
    case 'sounds': return `Master ${u.count} sounds`
  }
}

// ---------------------------------------------------------------- levels
/** Stars needed for each level (level 1 at 0). */
export const LEVEL_XP = [0, 100, 300, 700, 1500]
export const MAX_LEVEL = LEVEL_XP.length
export const LEVEL_NAMES = ['Hatchling', 'Sparky', 'Grown', 'Charged', 'Legendary']

export function levelFor(xp: number): number {
  let lvl = 1
  for (let i = 1; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) lvl = i + 1
  return lvl
}

/** Progress towards the next level, 0..1 (1 at max level). */
export function levelProgress(xp: number): { level: number; next: number | null; fraction: number } {
  const level = levelFor(xp)
  if (level >= MAX_LEVEL) return { level, next: null, fraction: 1 }
  const lo = LEVEL_XP[level - 1]
  const hi = LEVEL_XP[level]
  return { level, next: hi, fraction: Math.max(0, Math.min(1, (xp - lo) / (hi - lo))) }
}

// ---------------------------------------------------------------- tricks
/** Idle tricks the buddy can do when tapped; unlocked by mastered/secure sounds. */
export interface Trick {
  id: string
  name: string
  /** CSS animation class. */
  anim: string
  /** Sounds (secure or mastered) needed. */
  sounds: number
  /** What the buddy says. */
  line: string
}

export const TRICKS: Trick[] = [
  { id: 'wave', name: 'Wave', anim: 'animate-wiggle', sounds: 0, line: 'Hi there!' },
  { id: 'jump', name: 'Jump', anim: 'animate-jump', sounds: 3, line: 'Boing!' },
  { id: 'spin', name: 'Spin', anim: 'animate-spin-once', sounds: 6, line: 'Wheee!' },
  { id: 'dance', name: 'Dance', anim: 'animate-dance', sounds: 10, line: 'Dance party!' },
  { id: 'flip', name: 'Flip', anim: 'animate-flip', sounds: 15, line: 'Flip!' },
  { id: 'zoom', name: 'Zoom', anim: 'animate-zoom', sounds: 20, line: 'Zoom zoom!' },
  { id: 'grow', name: 'Giant', anim: 'animate-grow', sounds: 30, line: 'I am huge!' },
]

export function unlockedTricks(soundsKnown: number): Trick[] {
  return TRICKS.filter((t) => soundsKnown >= t.sounds)
}
