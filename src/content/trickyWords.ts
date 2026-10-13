/**
 * "Tricky" (heart) words: high-frequency words that are not fully decodable
 * with the GPCs taught so far. They are introduced one at a time, in the
 * Letters and Sounds order, and taught with the heart-word routine: the child
 * hears the word, sees which part is regular and which part "you learn by heart".
 */
export interface TrickyWord {
  word: string
  /** Group after which this word is introduced. */
  group: number
  /** Indices of letters that are the "tricky" (irregular) part, shown with a heart. */
  heart: number[]
  /** Short sentence read aloud to show the word in use. */
  example: string
}

const t = (word: string, group: number, heart: number[], example: string): TrickyWord => ({ word, group, heart, example })

export const TRICKY_WORDS: TrickyWord[] = [
  t('the', 2, [0, 1, 2], 'The cat sat.'),
  t('to', 2, [1], 'I go to the shop.'),
  t('I', 3, [0], 'I am Sam.'),
  t('no', 3, [1], 'No, it is not a dog.'),
  t('go', 3, [1], 'Go and get it!'),
  t('into', 4, [3], 'Hop into the pond.'),
  t('he', 4, [1], 'He is my dad.'),
  t('she', 4, [2], 'She has a hat.'),
  t('we', 5, [1], 'We can run.'),
  t('me', 5, [1], 'Pass it to me.'),
  t('be', 5, [1], 'Be a big help.'),
  t('was', 6, [1, 2], 'It was fun.'),
  t('you', 6, [1, 2], 'You can do it!'),
  t('they', 7, [2, 3], 'They jog and hop.'),
  t('all', 7, [0], 'All the kids can sing.'),
  t('are', 8, [1, 2], 'We are at the shop.'),
  t('my', 8, [1], 'This is my ship.'),
  t('her', 8, [1, 2], 'Her bag is red.'),
  t('said', 9, [1, 2], '"Wait!" said Dad.'),
  t('have', 9, [3], 'I have a goat.'),
  t('like', 9, [1, 3], 'I like the rain.'),
  t('so', 10, [1], 'It is so dark.'),
  t('do', 10, [1], 'Do you like books?'),
  t('some', 10, [1, 3], 'Get some food.'),
  t('come', 11, [1, 3], 'Come and join in.'),
  t('were', 11, [1, 2, 3], 'We were in town.'),
  t('there', 11, [2, 3, 4], 'Look over there!'),
  t('little', 12, [4, 5], 'A little bird.'),
  t('one', 12, [0, 1, 2], 'One more turn.'),
  t('when', 12, [0, 1], 'When is dinner?'),
  t('out', 13, [], 'Get out of the tent!'),
  t('what', 13, [0, 1, 2], 'What is that?'),
  t('oh', 13, [1], 'Oh no, the milk!'),
  t('their', 14, [2, 3, 4], 'Their bikes are blue.'),
  t('people', 14, [1, 2, 4, 5], 'Lots of people came.'),
  t('looked', 14, [4, 5], 'She looked at the cake.'),
  t('called', 15, [1, 4, 5], 'He called the boy.'),
  t('asked', 15, [3, 4], 'Mum asked for tea.'),
  t('could', 15, [1, 2, 3], 'I could eat a pie.'),
  t('would', 16, [1, 2, 3], 'Would you like a toy?'),
  t('should', 16, [2, 3, 4], 'You should draw a bird.'),
  t('water', 16, [1], 'The whale is in the water.'),
  t('where', 16, [2, 3, 4], 'Where is the phone?'),
  t('who', 16, [1, 2], 'Who threw the ball?'),
]

export const TRICKY_BY_WORD: Record<string, TrickyWord> = Object.fromEntries(TRICKY_WORDS.map((w) => [w.word.toLowerCase(), w]))

export function trickyWordsThroughGroup(groupId: number): TrickyWord[] {
  return TRICKY_WORDS.filter((w) => w.group <= groupId)
}
