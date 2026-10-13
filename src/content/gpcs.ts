/**
 * Grapheme–phoneme correspondences (GPCs) in a systematic synthetic phonics
 * teaching order. The order follows the widely used "Letters and Sounds"
 * / Jolly Phonics sequence: the first six letters (s a t p i n) already allow
 * dozens of real words (sat, pin, tap, nap ...), so blending starts on day one.
 *
 * All speech is American English (en-US). `speak` is the text handed to the text-to-speech engine when no recorded
 * clip for the sound exists in /public/audio/sounds/<id>.mp3. Pure sounds are
 * approximated (continuous sounds are stretched: "sss", stop sounds are as
 * short as the engine allows). Recorded clips always win when present.
 */

export interface Gpc {
  /** Unique id, usually the grapheme. Two spellings of "oo" get suffixes. */
  id: string
  /** What the child sees. */
  grapheme: string
  /** IPA-ish label shown to parents / in the dashboard. */
  sound: string
  /** Text for TTS to approximate the pure sound. */
  speak: string
  /** Keyword that starts with (or contains) the sound. */
  keyword: string
  /** Emoji illustrating the keyword. */
  emoji: string
  /** A short physical action the child can do while saying the sound (multisensory). */
  action: string
  /** True for sounds that can be held/stretched (s, m, f …), false for stop sounds (t, p, c …). */
  stretchy: boolean
  /** Letter name(s) said by TTS, e.g. "ess". Only for single letters. */
  letterName?: string
  /** Index of the teaching group this GPC belongs to (see GROUPS). */
  group: number
  /** Whether this is a vowel sound (affects word building). */
  vowel: boolean
}

export interface GpcGroup {
  id: number
  title: string
  /** Short tagline for the child (read aloud). */
  tagline: string
  gpcIds: string[]
  /** Island theme on the journey map. */
  theme: { name: string; emoji: string; color: string }
}

const g = (
  id: string,
  sound: string,
  speak: string,
  keyword: string,
  emoji: string,
  action: string,
  stretchy: boolean,
  group: number,
  opts: { letterName?: string; vowel?: boolean; grapheme?: string } = {},
): Gpc => ({
  id,
  grapheme: opts.grapheme ?? id,
  sound,
  speak,
  keyword,
  emoji,
  action,
  stretchy,
  group,
  letterName: opts.letterName,
  vowel: opts.vowel ?? false,
})

export const GPCS: Gpc[] = [
  // ---- Group 1: s a t p ----
  g('s', '/s/', 'sss', 'snake', '🐍', 'Weave your hand like a snake: sssss', true, 1, { letterName: 'ess' }),
  g('a', '/a/', 'a', 'apple', '🍎', 'Pretend ants are crawling up your arm: a, a, a', true, 1, { letterName: 'ay', vowel: true }),
  g('t', '/t/', 't', 'tiger', '🐯', 'Tap your finger like a tiny drum: t, t, t', false, 1, { letterName: 'tee' }),
  g('p', '/p/', 'p', 'pig', '🐷', 'Puff out a tiny breath like a candle: p, p, p', false, 1, { letterName: 'pee' }),
  // ---- Group 2: i n m d ----
  g('i', '/i/', 'ih', 'igloo', '🧊', 'Wiggle your fingers like an itchy mouse: i, i, i', true, 2, { letterName: 'eye', vowel: true }),
  g('n', '/n/', 'nnn', 'nest', '🪺', 'Buzz like a plane with your arms out: nnnnn', true, 2, { letterName: 'en' }),
  g('m', '/m/', 'mmm', 'moon', '🌙', 'Rub your tummy like yummy food: mmmmm', true, 2, { letterName: 'em' }),
  g('d', '/d/', 'd', 'dog', '🐶', 'Beat a drum: d, d, d', false, 2, { letterName: 'dee' }),
  // ---- Group 3: g o c k ----
  g('g', '/g/', 'g', 'goat', '🐐', 'Gulp like water going down: g, g, g', false, 3, { letterName: 'gee' }),
  g('o', '/o/', 'ah', 'octopus', '🐙', 'Open your mouth round like a surprised octopus: o, o, o', true, 3, { letterName: 'oh', vowel: true }),
  g('c', '/k/', 'k', 'cat', '🐱', 'Click castanets with your fingers: c, c, c', false, 3, { letterName: 'see' }),
  g('k', '/k/', 'k', 'kite', '🪁', 'Kick a tiny kick: k, k, k', false, 3, { letterName: 'kay' }),
  // ---- Group 4: ck e u r ----
  g('ck', '/k/', 'k', 'duck', '🦆', 'Two letters, one sound: ck says k, like duck', false, 4),
  g('e', '/e/', 'eh', 'egg', '🥚', 'Crack an egg into a pan: e, e, e', true, 4, { letterName: 'ee', vowel: true }),
  g('u', '/u/', 'uh', 'umbrella', '☂️', 'Put up your umbrella: u, u, u', true, 4, { letterName: 'you', vowel: true }),
  g('r', '/r/', 'rrr', 'rabbit', '🐰', 'Growl like a puppy with a sock: rrrrr', true, 4, { letterName: 'ar' }),
  // ---- Group 5: h b f ff l ll ss ----
  g('h', '/h/', 'h', 'hat', '🎩', 'Pant like you just ran: h, h, h', false, 5, { letterName: 'aitch' }),
  g('b', '/b/', 'b', 'ball', '⚽', 'Bounce a ball: b, b, b', false, 5, { letterName: 'bee' }),
  g('f', '/f/', 'fff', 'fish', '🐟', 'Let the air out of a balloon: fffff', true, 5, { letterName: 'ef' }),
  g('ff', '/f/', 'fff', 'puff', '💨', 'Same sound as f, just two letters: fffff', true, 5),
  g('l', '/l/', 'lll', 'lion', '🦁', 'Lick a lollipop: lllll', true, 5, { letterName: 'el' }),
  g('ll', '/l/', 'lll', 'bell', '🔔', 'Same sound as l, just two letters: lllll', true, 5),
  g('ss', '/s/', 'sss', 'kiss', '💋', 'Same sound as s, just two letters: sssss', true, 5),
  // ---- Group 6: j v w x ----
  g('j', '/j/', 'j', 'jet', '✈️', 'Zoom like a jet: j, j, j', false, 6, { letterName: 'jay' }),
  g('v', '/v/', 'vvv', 'van', '🚐', 'Hold a steering wheel and drive: vvvvv', true, 6, { letterName: 'vee' }),
  g('w', '/w/', 'w', 'web', '🕸️', 'Blow like the wind: w, w, w', false, 6, { letterName: 'double you' }),
  g('x', '/ks/', 'ks', 'box', '📦', 'Cross your arms like an X: ks, ks, ks', false, 6, { letterName: 'ex' }),
  // ---- Group 7: y z zz qu ----
  g('y', '/y/', 'y', 'yak', '🐂', 'Say yum with a big smile: y, y, y', false, 7, { letterName: 'why' }),
  g('z', '/z/', 'zzz', 'zebra', '🦓', 'Buzz like a bee: zzzzz', true, 7, { letterName: 'zee' }),
  g('zz', '/z/', 'zzz', 'buzz', '🐝', 'Same sound as z, just two letters: zzzzz', true, 7),
  g('qu', '/kw/', 'kw', 'queen', '👸', 'Q and u are best friends. Flap like a duck: kw, kw, kw', false, 7),
  // ---- Group 8: consonant digraphs ch sh th ng ----
  g('ch', '/ch/', 'ch', 'chick', '🐤', 'Chug like a train: ch, ch, ch', false, 8),
  g('sh', '/sh/', 'shh', 'ship', '🚢', 'Finger on lips, hush: shhhh', true, 8),
  g('th', '/th/', 'th', 'thumb', '👍', 'Tongue between your teeth: thhhh', true, 8),
  g('ng', '/ng/', 'ng', 'ring', '💍', 'Lift a heavy weight: nnnng', true, 8),
  // ---- Group 9: vowel digraphs ai ee igh oa ----
  g('ai', '/ai/', 'ay', 'rain', '🌧️', 'Cup your ear: ai? What did you say?', true, 9, { vowel: true }),
  g('ee', '/ee/', 'ee', 'bee', '🐝', 'Smile wide like a donkey: eeee', true, 9, { vowel: true }),
  g('igh', '/igh/', 'eye', 'light', '💡', 'Point up high: igh', true, 9, { vowel: true }),
  g('oa', '/oa/', 'oh', 'boat', '⛵', 'Row a boat: oa, oa', true, 9, { vowel: true }),
  // ---- Group 10: oo oo ar or ----
  g('oo_long', '/oo/', 'oo', 'moon', '🌕', 'Hoot like an owl: oooo', true, 10, { vowel: true, grapheme: 'oo' }),
  g('oo_short', '/ʊ/', 'uu', 'book', '📖', 'Push a stuck door: oo, oo', true, 10, { vowel: true, grapheme: 'oo' }),
  g('ar', '/ar/', 'ar', 'car', '🚗', 'Open wide for the doctor: arrr', true, 10, { vowel: true }),
  g('or', '/or/', 'or', 'fork', '🍴', 'Sound like a seal: or, or', true, 10, { vowel: true }),
  // ---- Group 11: ur ow oi ear ----
  g('ur', '/ur/', 'er', 'turtle', '🐢', 'Rev a motorbike: urrr', true, 11, { vowel: true }),
  g('ow', '/ow/', 'ow', 'cow', '🐮', 'Pretend to stub your toe: ow!', true, 11, { vowel: true }),
  g('oi', '/oi/', 'oy', 'coin', '🪙', 'Call to a sailor: oi!', true, 11, { vowel: true }),
  g('ear', '/ear/', 'eer', 'ear', '👂', 'Point to your ear: ear', true, 11, { vowel: true }),
  // ---- Group 12: air ure er ----
  g('air', '/air/', 'air', 'chair', '🪑', 'Wave your hand in the air: air', true, 12, { vowel: true }),
  g('ure', '/ure/', 'yoor', 'pure', '💧', 'Like the end of sure: ure', true, 12, { vowel: true }),
  g('er', '/ər/', 'er', 'hammer', '🔨', 'Soft at the end of a word: er', true, 12, { vowel: true }),
  // ---- Group 14: split digraphs (magic e) ----
  g('a_e', '/ai/', 'ay', 'cake', '🎂', 'The magic e jumps back to make a say its name: ay', true, 14, { vowel: true, grapheme: 'a_e' }),
  g('i_e', '/igh/', 'eye', 'bike', '🚲', 'Magic e makes i say its name: eye', true, 14, { vowel: true, grapheme: 'i_e' }),
  g('o_e', '/oa/', 'oh', 'bone', '🦴', 'Magic e makes o say its name: oh', true, 14, { vowel: true, grapheme: 'o_e' }),
  g('u_e', '/yoo/', 'yoo', 'cube', '🧊', 'Magic e makes u say its name: yoo', true, 14, { vowel: true, grapheme: 'u_e' }),
  g('e_e', '/ee/', 'ee', 'these', '👉', 'Magic e makes e say its name: ee', true, 14, { vowel: true, grapheme: 'e_e' }),
  // ---- Group 15: alternative spellings ay ou ie ea oy ----
  g('ay', '/ai/', 'ay', 'play', '🎮', 'ay at the end of a word: play', true, 15, { vowel: true }),
  g('ou', '/ow/', 'ow', 'cloud', '☁️', 'ou like in cloud: ow', true, 15, { vowel: true }),
  g('ie', '/igh/', 'eye', 'pie', '🥧', 'ie like in pie: eye', true, 15, { vowel: true }),
  g('ea', '/ee/', 'ee', 'leaf', '🍃', 'ea like in leaf: ee', true, 15, { vowel: true }),
  g('oy', '/oi/', 'oy', 'toy', '🧸', 'oy at the end of a word: toy', true, 15, { vowel: true }),
  // ---- Group 16: ir ue aw wh ph ew ----
  g('ir', '/ur/', 'er', 'bird', '🐦', 'ir like in bird: er', true, 16, { vowel: true }),
  g('ue', '/yoo/', 'yoo', 'glue', '🧴', 'ue like in glue: oo', true, 16, { vowel: true }),
  g('aw', '/or/', 'aw', 'paw', '🐾', 'aw like in paw: aw', true, 16, { vowel: true }),
  g('wh', '/w/', 'w', 'whale', '🐳', 'wh says w like in whale', false, 16),
  g('ph', '/f/', 'fff', 'phone', '📱', 'ph says f like in phone', true, 16),
  g('ew', '/yoo/', 'yoo', 'stew', '🍲', 'ew like in stew: oo', true, 16, { vowel: true }),
]

export const GPC_BY_ID: Record<string, Gpc> = Object.fromEntries(GPCS.map((x) => [x.id, x]))

export const GROUPS: GpcGroup[] = [
  { id: 1, title: 'Sunny Beach', tagline: 'Our first four sounds!', gpcIds: ['s', 'a', 't', 'p'], theme: { name: 'beach', emoji: '🏖️', color: '#fbbf24' } },
  { id: 2, title: 'Mouse Meadow', tagline: 'Four more sounds and lots of new words.', gpcIds: ['i', 'n', 'm', 'd'], theme: { name: 'meadow', emoji: '🌼', color: '#4ade80' } },
  { id: 3, title: 'Goat Mountain', tagline: 'Climb up with g, o, c and k.', gpcIds: ['g', 'o', 'c', 'k'], theme: { name: 'mountain', emoji: '⛰️', color: '#a78bfa' } },
  { id: 4, title: 'Duck Pond', tagline: 'ck, e, u and r join the team.', gpcIds: ['ck', 'e', 'u', 'r'], theme: { name: 'pond', emoji: '🦆', color: '#38bdf8' } },
  { id: 5, title: 'Jungle Fun', tagline: 'h, b, f, l and the double letters.', gpcIds: ['h', 'b', 'f', 'ff', 'l', 'll', 'ss'], theme: { name: 'jungle', emoji: '🌴', color: '#22c55e' } },
  { id: 6, title: 'Jet Volcano', tagline: 'j, v, w and x.', gpcIds: ['j', 'v', 'w', 'x'], theme: { name: 'volcano', emoji: '🌋', color: '#f97316' } },
  { id: 7, title: 'Zebra Castle', tagline: 'y, z, zz and qu. The whole alphabet!', gpcIds: ['y', 'z', 'zz', 'qu'], theme: { name: 'castle', emoji: '🏰', color: '#e879f9' } },
  { id: 8, title: 'Ship Harbor', tagline: 'Two letters, one sound: ch, sh, th, ng.', gpcIds: ['ch', 'sh', 'th', 'ng'], theme: { name: 'harbor', emoji: '🚢', color: '#0ea5e9' } },
  { id: 9, title: 'Rainbow Sky', tagline: 'Vowel teams: ai, ee, igh, oa.', gpcIds: ['ai', 'ee', 'igh', 'oa'], theme: { name: 'sky', emoji: '🌈', color: '#f472b6' } },
  { id: 10, title: 'Moon Base', tagline: 'oo, oo, ar and or.', gpcIds: ['oo_long', 'oo_short', 'ar', 'or'], theme: { name: 'moon', emoji: '🌕', color: '#818cf8' } },
  { id: 11, title: 'Turtle Cove', tagline: 'ur, ow, oi and ear.', gpcIds: ['ur', 'ow', 'oi', 'ear'], theme: { name: 'cove', emoji: '🐢', color: '#2dd4bf' } },
  { id: 12, title: 'Cloud Kingdom', tagline: 'air, ure and er.', gpcIds: ['air', 'ure', 'er'], theme: { name: 'clouds', emoji: '☁️', color: '#93c5fd' } },
  { id: 13, title: 'Twin Peaks', tagline: 'Two consonants side by side: frog, jump, milk.', gpcIds: [], theme: { name: 'peaks', emoji: '🏔️', color: '#94a3b8' } },
  { id: 14, title: 'Magic Forest', tagline: 'The magic e that changes everything.', gpcIds: ['a_e', 'i_e', 'o_e', 'u_e', 'e_e'], theme: { name: 'forest', emoji: '🪄', color: '#c084fc' } },
  { id: 15, title: 'Pie Town', tagline: 'New spellings for sounds you know.', gpcIds: ['ay', 'ou', 'ie', 'ea', 'oy'], theme: { name: 'town', emoji: '🥧', color: '#fb923c' } },
  { id: 16, title: 'Whale Ocean', tagline: 'ir, ue, aw, wh, ph, ew.', gpcIds: ['ir', 'ue', 'aw', 'wh', 'ph', 'ew'], theme: { name: 'ocean', emoji: '🐳', color: '#60a5fa' } },
]

/** Letters of the alphabet with names, for the "ABC" track. */
export const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('')

export const LETTER_NAMES: Record<string, string> = {
  a: 'ay', b: 'bee', c: 'see', d: 'dee', e: 'ee', f: 'ef', g: 'gee', h: 'aitch', i: 'eye', j: 'jay',
  k: 'kay', l: 'el', m: 'em', n: 'en', o: 'oh', p: 'pee', q: 'cue', r: 'ar', s: 'ess', t: 'tee',
  u: 'you', v: 'vee', w: 'double you', x: 'ex', y: 'why', z: 'zee',
}

/** The group a GPC belongs to, or undefined. */
export function groupOf(gpcId: string): GpcGroup | undefined {
  return GROUPS.find((gr) => gr.gpcIds.includes(gpcId))
}

/** All GPC ids taught up to and including the given group. */
export function gpcsThroughGroup(groupId: number): string[] {
  return GROUPS.filter((gr) => gr.id <= groupId).flatMap((gr) => gr.gpcIds)
}
