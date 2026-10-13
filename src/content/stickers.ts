/**
 * Sticker book: a random sticker hatches from the daily surprise egg (the
 * first completed session each day). Stickers are grouped by island theme so
 * the book fills in alongside the journey.
 */
export interface Sticker {
  id: string
  emoji: string
  name: string
  /** Rarity weight: lower is rarer. */
  weight: number
}

const s = (id: string, emoji: string, name: string, weight = 3): Sticker => ({ id, emoji, name, weight })

export const STICKERS: Sticker[] = [
  s('cat', '🐱', 'Cat'), s('dog', '🐶', 'Dog'), s('pig', '🐷', 'Pig'), s('duck', '🦆', 'Duck'), s('goat', '🐐', 'Goat'), s('fox', '🦊', 'Fox'),
  s('frog', '🐸', 'Frog'), s('owl', '🦉', 'Owl'), s('bee', '🐝', 'Bee'), s('fish', '🐟', 'Fish'), s('whale', '🐳', 'Whale'), s('dolphin', '🐬', 'Dolphin'),
  s('lion', '🦁', 'Lion'), s('zebra', '🦓', 'Zebra'), s('turtle', '🐢', 'Turtle'), s('rabbit', '🐰', 'Rabbit'), s('snake', '🐍', 'Snake'), s('octopus', '🐙', 'Octopus'),
  s('sun', '☀️', 'Sun'), s('moon', '🌙', 'Moon'), s('rainbow', '🌈', 'Rainbow'), s('cloud', '☁️', 'Cloud'), s('star', '⭐', 'Star'), s('bolt', '⚡', 'Lightning'),
  s('rocket', '🚀', 'Rocket'), s('ship', '🚢', 'Ship'), s('train', '🚂', 'Train'), s('bike', '🚲', 'Bike'), s('car', '🚗', 'Car'), s('jet', '✈️', 'Jet'),
  s('cake', '🎂', 'Cake'), s('pie', '🥧', 'Pie'), s('apple', '🍎', 'Apple'), s('icecream', '🍦', 'Ice cream'), s('cookie', '🍪', 'Cookie'), s('pizza', '🍕', 'Pizza'),
  s('castle', '🏰', 'Castle'), s('volcano', '🌋', 'Volcano'), s('island', '🏝️', 'Island'), s('mountain', '⛰️', 'Mountain'), s('tree', '🌳', 'Tree'), s('flower', '🌸', 'Flower'),
  s('robot', '🤖', 'Robot'), s('dragon', '🐉', 'Dragon'), s('alien', '👽', 'Alien'), s('ghost', '👻', 'Ghost'), s('wizard', '🧙', 'Wizard'), s('unicorn', '🦄', 'Unicorn', 1),
  s('crown', '👑', 'Crown', 1), s('gem', '💎', 'Gem', 1), s('trophy', '🏆', 'Trophy', 1), s('medal', '🥇', 'Medal', 2), s('key', '🗝️', 'Golden key', 1), s('phoenix', '🔥', 'Phoenix', 1),
  s('book', '📖', 'Book'), s('pencil', '✏️', 'Pencil'), s('abc', '🔤', 'ABC'), s('heart', '❤️', 'Heart'), s('party', '🎉', 'Party'), s('gift', '🎁', 'Gift', 2),
]

export const STICKER_BY_ID: Record<string, Sticker> = Object.fromEntries(STICKERS.map((x) => [x.id, x]))

/** Pick a sticker, preferring ones the child does not have yet. */
export function pickSticker(owned: string[], rnd: () => number = Math.random): Sticker {
  const ownedSet = new Set(owned)
  const pool = STICKERS.filter((x) => !ownedSet.has(x.id))
  const candidates = pool.length ? pool : STICKERS
  const total = candidates.reduce((a, x) => a + x.weight, 0)
  let r = rnd() * total
  for (const x of candidates) {
    r -= x.weight
    if (r <= 0) return x
  }
  return candidates[candidates.length - 1]
}
