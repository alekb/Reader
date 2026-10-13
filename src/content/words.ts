/**
 * Decodable word bank. Every word is written as its GPC segmentation
 * ("d-u-ck", "sh-i-p", "c-a_e-k" for split digraphs) so the app can sound it
 * out one grapheme at a time. A word becomes available once every GPC in it
 * has been taught. Words with an emoji can be used in picture-matching games.
 */
import { GPC_BY_ID, groupOf } from './gpcs'

export interface DecodableWord {
  word: string
  /** GPC ids in order. */
  gpcs: string[]
  /** Emoji illustration, if the word is picturable. */
  emoji?: string
  /** Group in which this word first becomes decodable. */
  group: number
  /** True if the word contains adjacent consonants (CCVC/CVCC) — introduced in group 13. */
  blends: boolean
}

/** Shorthand entries: "segmentation[:emoji]" */
const RAW: string[] = [
  // Group 1: s a t p
  's-a-t', 'p-a-t', 't-a-p:🚰', 's-a-p', 'a-t', 'a-s', 'p-a-t-s', 't-a-p-s',
  // Group 2: i n m d
  'i-t', 'i-s', 'i-n', 'p-i-n:📌', 't-i-n:🥫', 's-i-t:🪑', 's-i-p:🥤', 't-i-p', 'p-i-t', 'n-a-p:😴', 'p-a-n:🍳', 'm-a-n:👨',
  'm-a-t:🧘', 'm-a-p:🗺️', 'd-a-d:👨‍👧', 's-a-d:😢', 'd-i-d', 'd-i-p', 'd-i-m', 'm-a-d:😡', 'p-a-d', 't-a-n', 'n-i-p', 'd-i-n',
  'a-m', 'p-i-p', 't-i-m', 's-a-m',
  // Group 3: g o c k
  'g-o-t', 'd-o-g:🐶', 'c-o-t:🛏️', 'c-a-t:🐱', 'c-a-n:🥫', 'c-a-p:🧢', 'k-i-d:🧒', 'k-i-t', 'c-o-d:🐟', 'p-o-t:🍲', 't-o-p:🔝',
  'm-o-p:🧹', 'd-o-t:⚫', 'n-o-t', 'n-o-d', 'o-n', 'p-o-p:🎈', 'g-a-p', 'g-a-s:⛽', 'd-i-g:⛏️', 'p-i-g:🐷', 't-a-g:🏷️', 'c-o-g:⚙️',
  'g-o-d', 'n-a-g', 'p-i-c-k', 'd-o-c-k',
  // Group 4: ck e u r
  'd-u-ck:🦆', 's-o-ck:🧦', 'k-i-ck:🦵', 'p-i-ck', 'n-e-ck:🦒', 'p-e-ck', 'd-e-ck', 't-i-ck:✅', 's-i-ck:🤒', 'r-o-ck:🪨', 't-u-ck',
  'p-e-t:🐹', 't-e-n:🔟', 'n-e-t:🥅', 'm-e-n:👬', 'p-e-n:🖊️', 'g-e-t', 'p-e-g', 'r-e-d:🔴', 'u-p:⬆️', 'c-u-p:☕', 'm-u-d',
  's-u-n:☀️', 'r-u-n:🏃', 'm-u-g:🍺', 'c-u-t:✂️', 'g-u-m', 'n-u-t:🥜', 't-u-g', 'd-u-g', 'p-u-p:🐶', 'r-a-t:🐀', 'r-i-p', 'r-o-d:🎣',
  'r-u-g', 'r-a-m:🐏', 'r-i-m', 'r-o-t', 'r-a-p', 'r-e-s-t', 'k-i-ck-s',
  // Group 5: h b f ff l ll ss
  'h-a-t:🎩', 'h-e-n:🐔', 'h-o-p:🐇', 'h-u-g:🤗', 'h-o-t:🔥', 'h-i-p', 'h-u-t:🛖', 'h-i-m', 'h-i-d', 'h-a-m:🍖',
  'b-a-t:🦇', 'b-e-d:🛏️', 'b-i-g:🐘', 'b-u-g:🐛', 'b-u-n:🥯', 'b-u-s:🚌', 'b-a-g:👜', 'b-i-n:🗑️', 'b-i-t', 'b-a-ck', 'r-o-b',
  'f-a-n:🪭', 'f-i-t', 'f-i-g', 'f-o-g:🌫️', 'f-u-n:🎉', 'f-e-d', 'o-ff', 'p-u-ff:💨', 'h-u-ff', 'c-u-ff',
  'l-e-g:🦵', 'l-i-p:👄', 'l-o-g:🪵', 'l-o-t', 'l-i-d', 'l-e-t', 'l-a-p', 'l-i-ck:👅',
  'b-e-ll:🔔', 'd-o-ll:🪆', 'h-i-ll:⛰️', 'f-i-ll', 't-e-ll', 'w-e-ll', 'f-e-ll', 'b-i-ll',
  'h-i-ss:🐍', 'k-i-ss:💋', 'm-e-ss', 'l-e-ss', 'f-u-ss', 'b-o-ss', 'm-i-ss',
  // Group 6: j v w x
  'j-a-m:🍓', 'j-e-t:✈️', 'j-o-g:🏃', 'j-u-g:🫙', 'j-a-b', 'v-a-n:🚐', 'v-e-t:🩺', 'v-a-t',
  'w-e-t:💦', 'w-i-n:🏆', 'w-i-g:💇', 'w-e-b:🕸️', 'w-a-x:🕯️', 'w-a-g',
  'b-o-x:📦', 'f-o-x:🦊', 's-i-x:6️⃣', 'm-i-x:🥣', 'f-i-x:🔧', 'f-a-x', 't-a-x', 'o-x:🐂',
  // Group 7: y z zz qu
  'y-e-s:👍', 'y-e-t', 'y-a-p', 'y-u-m:😋', 'y-a-k:🐂', 'z-i-p:🤐', 'z-a-p:⚡', 'z-i-g', 'z-a-g',
  'b-u-zz:🐝', 'f-i-zz:🥤', 'j-a-zz:🎷', 'f-u-zz', 'qu-i-t', 'qu-i-z:❓', 'qu-i-ck:⚡', 'qu-a-ck:🦆',
  // Group 8: ch sh th ng
  'ch-i-p:🍟', 'ch-o-p:🔪', 'ch-i-n', 'ch-a-t:💬', 'ch-u-g', 'm-u-ch', 's-u-ch', 'r-i-ch:💰', 'ch-i-ck:🐤',
  'sh-i-p:🚢', 'sh-o-p:🏪', 'sh-e-d', 'sh-u-t', 'f-i-sh:🐟', 'd-i-sh:🍽️', 'w-i-sh:🌠', 'r-u-sh', 'c-a-sh:💵', 'sh-e-ll:🐚',
  'th-i-n', 'th-i-s', 'th-a-t', 'th-e-n', 'th-e-m', 'w-i-th', 'b-a-th:🛁', 'm-o-th:🦋', 'p-a-th:🛤️', 'th-i-ck',
  'r-i-ng:💍', 's-i-ng:🎤', 'k-i-ng:🤴', 's-o-ng:🎵', 'l-o-ng', 'w-i-ng:🪽', 'b-a-ng', 'h-a-ng', 'r-a-ng',
  // Group 9: ai ee igh oa
  'r-ai-n:🌧️', 'w-ai-t', 't-ai-l', 's-ai-l:⛵', 'p-ai-n', 'p-ai-d', 'm-ai-n', 'n-ai-l:💅', 'b-ai-t', 'm-ai-l:📬',
  's-ee:👀', 'b-ee:🐝', 'f-ee-t:🦶', 'n-ee-d', 'k-ee-p', 'd-ee-p', 's-ee-n', 'w-ee-k:📅', 'f-ee-d', 'sh-ee-p:🐑', 'm-ee-t',
  'h-igh', 's-igh', 'n-igh-t:🌃', 'l-igh-t:💡', 'r-igh-t:👉', 'f-igh-t', 'm-igh-t', 't-igh-t', 's-igh-t',
  'b-oa-t:⛵', 'c-oa-t:🧥', 'g-oa-t:🐐', 'r-oa-d:🛣️', 'l-oa-d', 's-oa-p:🧼', 't-oa-d:🐸', 'oa-k:🌳', 'f-oa-m', 'm-oa-n',
  // Group 10: oo oo ar or
  'm-oo_long-n:🌕', 'b-oo_long-t:👢', 'z-oo_long:🦁', 'f-oo_long-d:🍔', 'r-oo_long-t', 'r-oo_long-f:🏠', 's-oo_long-n', 'h-oo_long-t:🦉',
  't-oo_long-th:🦷', 'c-oo_long-l:😎', 'p-oo_long-l:🏊', 'b-oo_long-m',
  'b-oo_short-k:📖', 'l-oo_short-k:👀', 't-oo_short-k', 'g-oo_short-d:👍', 'f-oo_short-t:🦶', 'w-oo_short-d:🪵', 'h-oo_short-k:🪝', 'c-oo_short-k:👨‍🍳', 'h-oo_short-d',
  'c-ar:🚗', 'f-ar', 'b-ar', 'b-ar-k:🐕', 'd-ar-k:🌑', 'p-ar-k:🌳', 'f-ar-m:🚜', 'h-ar-d', 'c-ar-d:🃏', 'ar-m:💪', 'ar-t:🎨', 'j-ar:🫙', 'c-ar-t:🛒',
  'f-or', 'f-or-k:🍴', 'c-or-d', 'c-or-n:🌽', 't-or-n', 'f-or-t:🏰', 's-or-t', 'h-or-n:📯', 'b-or-n', 'sh-or-t', 'p-or-k:🥓',
  // Group 11: ur ow oi ear
  'f-ur', 'h-ur-t:🤕', 't-ur-n:↩️', 'b-ur-n:🔥', 'c-ur-l', 's-ur-f:🏄', 'ch-ur-ch:⛪', 't-ur-f', 'b-ur-p',
  'c-ow:🐮', 'h-ow', 'n-ow', 'd-ow-n:⬇️', 't-ow-n:🏘️', 'ow-l:🦉', 'h-ow-l:🐺', 'b-ow', 'v-ow',
  'oi-l:🛢️', 'b-oi-l', 'c-oi-n:🪙', 'j-oi-n', 's-oi-l:🌱', 'f-oi-l', 'c-oi-l', 't-oi-l', 'p-oi-n-t:👉',
  'ear:👂', 'h-ear', 'd-ear:🦌', 'f-ear:😱', 'n-ear', 'y-ear:📆', 'b-ear-d:🧔', 't-ear:💧', 'g-ear:⚙️',
  // Group 12: air ure er
  'air:💨', 'h-air:💇', 'f-air:🎡', 'p-air:👟', 'ch-air:🪑', 'l-air',
  'p-ure:💧', 'c-ure:💊', 's-ure', 'l-ure',
  'h-er', 'l-e-tt-er:✉️', 'h-a-mm-er:🔨', 'd-i-nn-er:🍽️', 's-u-mm-er:☀️', 'b-e-tt-er', 's-i-s-t-er:👧', 'c-or-n-er', 'b-o-x-er:🥊', 'f-ar-m-er:👩‍🌾', 'l-a-dd-er:🪜',
  // Group 13: adjacent consonants (no new GPCs)
  'f-r-o-g:🐸', 's-t-o-p:🛑', 'm-i-l-k:🥛', 'h-a-n-d:✋', 'j-u-m-p:🤸', 't-e-n-t:⛺', 'f-l-a-g:🚩', 'c-r-a-b:🦀', 'b-e-l-t', 'l-a-m-p:💡',
  'n-e-s-t:🪺', 'w-i-n-d:🌬️', 'b-e-s-t:🥇', 'd-r-i-p:💧', 'g-r-i-n:😁', 's-p-i-n', 's-t-e-p', 's-w-i-m:🏊', 't-w-i-n:👯', 'f-r-o-m',
  'p-l-u-m:🍑', 'c-l-u-b', 'c-l-a-p:👏', 't-r-i-p:🧳', 'd-e-s-k:🪑', 'h-e-l-p:🆘', 'p-o-n-d:🐸', 's-a-n-d:🏖️', 's-o-f-t', 'l-o-s-t',
  'g-i-f-t:🎁', 'l-i-f-t:🛗', 'm-e-l-t', 'b-u-m-p', 'c-a-m-p:🏕️', 'd-u-m-p:🚛', 'f-i-s-t:✊', 'l-i-s-t:📝', 'm-u-s-t', 'd-u-s-t',
  'h-u-n-t', 'c-r-a-sh:💥', 'f-r-e-sh', 's-t-r-i-ng:🧵', 't-r-u-ck:🚚', 'b-l-a-ck:⚫', 'c-l-o-ck:🕐', 'b-r-i-ck:🧱', 's-n-a-ck:🍪', 'd-r-u-m:🥁',
  'f-l-o-w-er:🌸', 'p-l-a-n-t:🪴', 'c-r-i-s-p', 't-r-ai-n:🚂', 't-r-ee:🌳', 's-l-ee-p:😴', 's-p-oo_long-n:🥄', 's-t-ar:⭐', 'b-r-ow-n:🟤', 'c-l-ow-n:🤡', 'c-r-ow-n:👑', 's-t-air:🪜',
  // Group 14: split digraphs
  'c-a_e-k:🎂', 'm-a_e-k', 't-a_e-k', 'n-a_e-m', 'g-a_e-m:🎮', 'g-a_e-t:🚪', 'l-a_e-t', 'l-a_e-k:🏞️', 'b-a_e-k', 'w-a_e-v:🌊', 'c-a_e-v:🕳️', 's-a_e-m', 'c-a_e-m', 'p-l-a_e-n:✈️', 's-n-a_e-k:🐍', 'g-r-a_e-p:🍇',
  'b-i_e-k:🚲', 'l-i_e-k', 't-i_e-m:⏰', 'f-i_e-v:5️⃣', 'n-i_e-n:9️⃣', 'l-i_e-n', 'r-i_e-d', 'h-i_e-d', 's-i_e-d', 'k-i_e-t:🪁', 'm-i_e-n', 'p-i_e-p', 'w-i_e-d', 's-m-i_e-l:😊', 's-l-i_e-d:🛝',
  'b-o_e-n:🦴', 'h-o_e-m:🏠', 'n-o_e-s:👃', 'r-o_e-p:🪢', 'h-o_e-l:🕳️', 'n-o_e-t:📝', 'h-o_e-p', 'r-o_e-s:🌹', 'j-o_e-k:🤣', 'p-o_e-k', 's-t-o_e-n:🪨', 'w-o_e-k', 'g-l-o_e-b:🌍',
  'c-u_e-b:🧊', 't-u_e-b', 'm-u_e-l:🐴', 'c-u_e-t:🥰', 'h-u_e-g', 'f-u_e-s', 'u_e-s', 'f-l-u_e-t:🪈',
  'th-e_e-s', 'th-e_e-m', 'e_e-v', 'p-e_e-t',
  // Group 15: ay ou ie ea oy
  'd-ay:🌞', 'p-l-ay:🎮', 's-ay:🗣️', 'w-ay', 'm-ay', 'h-ay:🌾', 's-t-ay', 't-r-ay:🍽️', 'c-l-ay:🏺', 'a-w-ay', 'c-r-ay-o-n:🖍️',
  'ou-t', 'l-ou-d:📢', 'c-l-ou-d:☁️', 'sh-ou-t:📣', 's-ou-n-d:🔊', 'm-ou-th:👄', 'r-ou-n-d:⚪', 'f-ou-n-d', 'p-r-ou-d',
  'p-ie:🥧', 't-ie:👔', 'l-ie', 'd-ie', 'c-r-ie-d:😭', 't-r-ie-d', 'f-r-ie-d:🍳', 'f-l-ie-s:🪰',
  'ea-t:🍽️', 's-ea:🌊', 't-ea:🍵', 'l-ea-f:🍃', 'r-ea-d:📖', 'm-ea-t:🥩', 's-ea-t:💺', 'b-ea-d:📿', 'b-ea-ch:🏖️', 't-ea-ch', 'd-r-ea-m:💭', 'c-r-ea-m:🍦', 'c-l-ea-n:🧽', 'p-ea-s:🫛',
  'b-oy:👦', 't-oy:🧸', 'j-oy:😄', 'e-n-j-oy', 'r-oy-a-l:👑', 'a-nn-oy', 'c-ow-b-oy:🤠',
  // Group 16: ir ue aw wh ph ew
  'b-ir-d:🐦', 'g-ir-l:👧', 'd-ir-t', 'sh-ir-t:👕', 'f-ir-s-t:🥇', 'th-ir-d:🥉', 's-k-ir-t:👗', 's-t-ir:🥄', 'c-ir-c-u-s:🎪',
  'b-l-ue:🔵', 'g-l-ue:🧴', 'c-l-ue:🔍', 't-r-ue:✅', 'r-e-s-c-ue:🚒', 'ar-g-ue', 'v-a-l-ue',
  's-aw:🪚', 'p-aw:🐾', 'l-aw', 'd-r-aw:✏️', 'c-l-aw:🦅', 'y-aw-n:🥱', 'd-aw-n:🌅', 'l-aw-n:🌿', 'c-r-aw-l:🐛', 's-t-r-aw:🥤',
  'wh-e-n', 'wh-i-ch', 'wh-i-p', 'wh-ee-l:🛞', 'wh-i-s-k', 'wh-i_e-t:⚪', 'wh-a_e-l:🐳', 'wh-i-s-p-er:🤫',
  'ph-o_e-n:📱', 'g-r-a-ph:📊', 'd-o-l-ph-i-n:🐬', 'a-l-ph-a-b-e-t:🔤', 'e-l-e-ph-a-n-t:🐘',
  'n-ew:✨', 'f-ew', 'ch-ew:🍬', 's-t-ew:🍲', 'g-r-ew', 'f-l-ew', 'b-l-ew', 'd-r-ew', 'th-r-ew',
]

/** Double letters not in the GPC list (tt, mm, nn, dd) map to their single-letter sound. */
const DOUBLE_ALIASES: Record<string, string> = { tt: 't', mm: 'm', nn: 'n', dd: 'd', pp: 'p', bb: 'b', gg: 'g', rr: 'r' }

function parse(entry: string): DecodableWord {
  const [seg, emoji] = entry.split(':')
  const parts = seg.split('-')
  const gpcs = parts.map((p) => DOUBLE_ALIASES[p] ?? p)
  for (const id of gpcs) {
    if (!GPC_BY_ID[id]) throw new Error(`Unknown GPC "${id}" in word entry "${entry}"`)
  }
  const word = parts
    .map((p) => {
      if (p.endsWith('_e')) return p[0] // split digraph: the first letter now, the e at the end
      return GPC_BY_ID[DOUBLE_ALIASES[p] ?? p] && !DOUBLE_ALIASES[p] ? GPC_BY_ID[p].grapheme : p
    })
    .join('') + (parts.some((p) => p.endsWith('_e')) ? 'e' : '')
  let group = Math.max(...gpcs.map((id) => groupOf(id)?.id ?? 1))
  const blends = hasAdjacentConsonants(gpcs)
  if (blends) group = Math.max(group, 13)
  return { word, gpcs, emoji: emoji || undefined, group, blends }
}

function hasAdjacentConsonants(gpcs: string[]): boolean {
  for (let i = 1; i < gpcs.length; i++) {
    const a = GPC_BY_ID[gpcs[i - 1]]
    const b = GPC_BY_ID[gpcs[i]]
    if (a && b && !a.vowel && !b.vowel) return true
  }
  return false
}

export const WORDS: DecodableWord[] = RAW.map(parse)
export const WORD_BY_TEXT: Record<string, DecodableWord> = Object.fromEntries(WORDS.map((w) => [w.word, w]))

/** Words decodable with only the given GPC ids (and the blends rule). */
export function decodableWords(knownGpcIds: string[], allowBlends: boolean): DecodableWord[] {
  const known = new Set(knownGpcIds)
  return WORDS.filter((w) => w.gpcs.every((id) => known.has(id)) && (allowBlends || !w.blends))
}

/**
 * Maps each letter index of `word` to the index of the GPC segment it belongs to,
 * so the UI can highlight graphemes while sounding out.
 */
export function letterSegments(w: DecodableWord): number[] {
  const out: number[] = []
  let splitIdx = -1
  w.gpcs.forEach((id, i) => {
    const gpc = GPC_BY_ID[id]
    if (id.endsWith('_e')) {
      out.push(i)
      splitIdx = i
      return
    }
    const len = gpc.grapheme.length
    for (let k = 0; k < len; k++) out.push(i)
  })
  // Handle double-letter aliases (tt etc.) which were collapsed to a single sound:
  // the word string was built from raw parts, so lengths may differ. Pad from the raw word.
  while (out.length < w.word.length - (splitIdx >= 0 ? 1 : 0)) out.push(out[out.length - 1] ?? 0)
  if (splitIdx >= 0) out.push(splitIdx)
  return out.slice(0, w.word.length)
}
