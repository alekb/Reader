/**
 * "Alien words": pronounceable nonsense words built from taught GPCs. They make
 * guessing impossible and prove the child is really decoding (Toe by Toe uses
 * the same trick). Real words and anything rude are excluded.
 */
import { GPC_BY_ID } from '../content/gpcs'
import { WORD_BY_TEXT } from '../content/words'
import type { DecodableWord } from '../content/words'

const BLOCKLIST = new Set([
  'fuk', 'fuc', 'cok', 'coc', 'dik', 'dic', 'tit', 'sex', 'ass', 'cum', 'fag', 'jiz', 'poo', 'wee', 'pis', 'bum', 'nob', 'kok', 'vag', 'hoe',
  'fuck', 'shit', 'cock', 'dick', 'cunt', 'twat', 'piss', 'crap', 'damn', 'arse', 'wank', 'slut', 'suck', 'bich', 'puss', 'tits', 'turd',
])

/** Common real words not in our bank, so we never present them as "alien". */
const REAL_EXTRA = new Set([
  'bad', 'bid', 'bob', 'bop', 'cab', 'cob', 'cub', 'dab', 'den', 'dip', 'dob', 'dud', 'fab', 'fad', 'fen', 'fib', 'fin', 'gab', 'gag', 'gig', 'gob',
  'gut', 'hag', 'hem', 'hob', 'hog', 'hub', 'hum', 'jig', 'jot', 'keg', 'kin', 'lab', 'lag', 'lob', 'lug', 'mob', 'mum', 'mom', 'nab', 'nit', 'nun',
  'pub', 'pug', 'pun', 'rib', 'rig', 'rob', 'rub', 'sag', 'sob', 'sub', 'sum', 'tab', 'tog', 'tub', 'tut', 'vim', 'wad', 'wit', 'wok', 'yen',
  'zit', 'ted', 'tom', 'sid', 'kim', 'pam', 'tin', 'nan', 'dan', 'ken', 'ben', 'meg', 'jen', 'bob', 'rod', 'nod', 'bin', 'pit', 'tip', 'mop',
])

function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)]
}

/** Build a CVC alien word from known GPC ids. Returns null if not possible. */
export function makeNonsenseWord(knownGpcIds: string[], rnd: () => number = Math.random): DecodableWord | null {
  const known = knownGpcIds.map((id) => GPC_BY_ID[id]).filter(Boolean)
  const vowels = known.filter((g) => g.vowel && g.id.length <= 2 && !g.id.includes('_'))
  // Single-letter consonants and consonant digraphs; avoid ones that only appear word-finally in odd ways.
  const onsets = known.filter((g) => !g.vowel && !['ck', 'ff', 'll', 'ss', 'zz', 'x', 'ng'].includes(g.id))
  const codas = known.filter((g) => !g.vowel && !['qu', 'h', 'w', 'y', 'j', 'wh', 'ck'].includes(g.id))
  if (!vowels.length || !onsets.length || !codas.length) return null
  for (let attempt = 0; attempt < 40; attempt++) {
    const o = pick(onsets, rnd)
    const v = pick(vowels, rnd)
    const c = pick(codas, rnd)
    if (o.id === c.id) continue
    const text = o.grapheme + v.grapheme + c.grapheme
    if (WORD_BY_TEXT[text] || REAL_EXTRA.has(text) || BLOCKLIST.has(text)) continue
    return { word: text, gpcs: [o.id, v.id, c.id], group: 0, blends: false }
  }
  return null
}
