/**
 * Device voices rarely say their gender, so we go by markers and well-known
 * names. Android's Google voices are codes (en-us-x-iol is male, en-us-x-sfg is
 * female) and some variants carry an explicit marker: "en-us-x-sfg#male_1-local".
 */
import type { VoiceGender } from '../engine/types'

// An explicit marker wins over a name: letters on either side would make it part of another word.
const FEMALE_MARK = /(^|[^a-z])female([^a-z]|$)/i
const MALE_MARK = /(^|[^a-z])male([^a-z]|$)/i
const MALE_NAME = /\b(david|mark|guy|daniel|alex|fred|tom|aaron|arthur|evan|nathan|reed|rocko|eddy|grandpa|ryan|christopher|eric|andrew|brian|roger|steffan|davis|tony|jason)\b|en-us-x-(iol|iom|tpd)/i
const FEMALE_NAME = /\b(samantha|karen|moira|zira|aria|jenny|ava|allison|susan|victoria|tessa|serena|fiona|joanna|salli|kendra|kimberly|ivy|michelle|emma|nicky)\b|en-us-x-(iob|iog|sfg|tpc|tpf)/i

/** The gender a voice name suggests, or null when it gives no hint. */
export function voiceGenderOf(name: string): VoiceGender | null {
  if (FEMALE_MARK.test(name)) return 'female'
  if (MALE_MARK.test(name)) return 'male'
  if (MALE_NAME.test(name)) return 'male'
  if (FEMALE_NAME.test(name)) return 'female'
  return null
}
