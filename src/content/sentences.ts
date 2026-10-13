/**
 * Decodable sentences. Each sentence only uses GPCs taught up to its group and
 * tricky words introduced up to that group (plus names, which are capitalised
 * decodable words). `emoji` gives a picture for the comprehension check;
 * `distractors` are wrong pictures to show alongside it.
 */
export interface Sentence {
  text: string
  group: number
  emoji: string
  /** A short question for the parent/mascot to ask after reading. */
  question?: string
}

const s = (group: number, text: string, emoji: string, question?: string): Sentence => ({ group, text, emoji, question })

export const SENTENCES: Sentence[] = [
  s(1, 'Pat sat.', '🪑', 'What did Pat do?'),
  s(1, 'Tap, tap, tap.', '🥁'),
  s(1, 'Pat taps.', '👆'),
  s(2, 'Tim is sad.', '😢', 'How does Tim feel?'),
  s(2, 'Dad did it.', '👨', 'Who did it?'),
  s(2, 'Sam sat in a pit.', '🕳️', 'Where did Sam sit?'),
  s(2, 'Pat sat in a tin.', '🥫'),
  s(2, 'Dad and Sam nap.', '😴', 'What do Dad and Sam do?'),
  s(2, 'Nip at the pan.', '🍳'),
  s(3, 'Tom got a pot.', '🍲', 'What did Tom get?'),
  s(3, 'The cat sat on top.', '🐱', 'Where did the cat sit?'),
  s(3, 'I got a tin can.', '🥫'),
  s(3, 'Go, Tom, go!', '🏃'),
  s(3, 'No, the dog is not sad.', '🐶', 'Is the dog sad?'),
  s(3, 'Sid can dig and dig.', '⛏️'),
  s(4, 'The duck sat on a rock.', '🦆', 'What sat on the rock?'),
  s(4, 'Ted ran to get the net.', '🥅'),
  s(4, 'He is up in the sun.', '☀️'),
  s(4, 'She can run and kick.', '🦵', 'What can she do?'),
  s(4, 'Pick up the red cup.', '☕', 'What colour is the cup?'),
  s(4, 'Rick ran into the pen.', '🖊️'),
  s(5, 'The hen is in the hut.', '🐔', 'Where is the hen?'),
  s(5, 'Bob fell off the log.', '🪵', 'What did Bob fall off?'),
  s(5, 'A fat cat sat on a hat.', '🎩'),
  s(5, 'The bell is on the hill.', '🔔'),
  s(5, 'We can hug the dog.', '🤗', 'What can we hug?'),
  s(5, 'Bill is in bed.', '🛏️'),
  s(5, 'Mum has a big red bag.', '👜', 'What does Mum have?'),
  s(6, 'The fox is in the box.', '🦊', 'Where is the fox?'),
  s(6, 'Jim has six jam pots.', '🍓', 'How many jam pots?'),
  s(6, 'The van is wet.', '🚐'),
  s(6, 'Max can fix the jet.', '✈️', 'What can Max fix?'),
  s(6, 'Jack hid the wig in the box.', '📦'),
  s(7, 'Yes, you can zip it up.', '🤐'),
  s(7, 'The yak can jog and hop.', '🐂', 'What can the yak do?'),
  s(7, 'Quick! Get the quiz.', '❓'),
  s(7, 'They can all buzz and fizz.', '🐝'),
  s(7, 'Can you zig and zag?', '⚡'),
  s(8, 'The ship is in the dock.', '🚢', 'Where is the ship?'),
  s(8, 'The fish is in the dish.', '🍽️'),
  s(8, 'Chop the chips, Chad.', '🍟'),
  s(8, 'Sing a song, Ping.', '🎵', 'What should Ping do?'),
  s(8, 'That moth is on the shed.', '🦋'),
  s(8, 'Is this my fish? Yes, it is!', '🐟'),
  s(8, 'The king has a long ring.', '💍', 'What does the king have?'),
  s(9, 'The goat is on the boat.', '🐐', 'Where is the goat?'),
  s(9, 'We can see the sheep.', '🐑', 'What can we see?'),
  s(9, 'Wait, the rain will stop.', '🌧️'),
  s(9, 'The light is bright at night.', '💡'),
  s(9, 'Keep the coat in the box.', '🧥', 'Where should the coat go?'),
  s(9, 'I need a nail and a sail.', '⛵'),
  s(9, 'She said, "I like the rain."', '☔'),
  s(10, 'Look at the moon.', '🌕', 'What should you look at?'),
  s(10, 'The car is in the dark park.', '🚗'),
  s(10, 'The cook has a good book.', '📖', 'What does the cook have?'),
  s(10, 'Zoom to the moon in a rocket.', '🚀'),
  s(10, 'It is a short road to the fort.', '🏰'),
  s(10, 'Do you like corn? I do!', '🌽'),
  s(11, 'The owl can hoot and howl.', '🦉', 'What can the owl do?'),
  s(11, 'Now the cow is in the town.', '🐮'),
  s(11, 'I can hear the church bell.', '⛪', 'What can I hear?'),
  s(11, 'The clown has a crown.', '🤡'),
  s(11, 'Come and join in the surf!', '🏄'),
  s(11, 'There were coins in the soil.', '🪙', 'What was in the soil?'),
  s(12, 'Sit on the chair, not on the stair.', '🪑', 'Where should you sit?'),
  s(12, 'Her hair is fair.', '💇'),
  s(12, 'The hammer is in the corner.', '🔨', 'Where is the hammer?'),
  s(12, 'The air is pure near the hill.', '🏔️'),
  s(12, 'My sister has one little letter for the farmer.', '✉️', 'Who is the letter for?'),
  s(12, 'When is dinner? I am hungry!', '🍽️'),
  s(13, 'The frog can jump on the log.', '🐸', 'What can the frog do?'),
  s(13, 'The crab is in the sand.', '🦀'),
  s(13, 'Stop! The milk is on the desk.', '🥛', 'Where is the milk?'),
  s(13, 'I lost my best belt.', '🥇'),
  s(13, 'A swift wind hit the tent.', '⛺', 'What did the wind hit?'),
  s(13, 'Fresh crisp chips for lunch!', '🍟'),
  s(13, 'What is in the black truck?', '🚚'),
  s(14, 'I like to ride my bike.', '🚲', 'What do I like to ride?'),
  s(14, 'Make a cake for Jane.', '🎂'),
  s(14, 'The bone is at home.', '🦴', 'Where is the bone?'),
  s(14, 'Nine bikes in a line.', '🚲'),
  s(14, 'Pete woke up late.', '⏰'),
  s(14, 'Their kite is stuck in the tree.', '🪁', 'Where is the kite?'),
  s(14, 'The people looked at the huge globe.', '🌍'),
  s(15, 'We play all day.', '🎮', 'When do we play?'),
  s(15, 'Shout out loud!', '📣'),
  s(15, 'Eat the pie and the cream.', '🥧', 'What should you eat?'),
  s(15, 'The boy has a toy boat.', '🧸'),
  s(15, 'I tried to read on the beach.', '🏖️', 'Where did I read?'),
  s(15, 'Could you clean the round tray?', '🍽️'),
  s(16, 'The girl has a white shirt.', '👕', 'What colour is the shirt?'),
  s(16, 'Chew the stew.', '🍲'),
  s(16, 'The whale saw a bird.', '🐳', 'What did the whale see?'),
  s(16, 'Draw a blue phone.', '📱'),
  s(16, 'Where is the dolphin? In the water!', '🐬', 'Where is the dolphin?'),
  s(16, 'Who threw the straw on the lawn?', '🌿'),
]

export function sentencesForGroup(group: number): Sentence[] {
  return SENTENCES.filter((x) => x.group === group)
}
export function sentencesThroughGroup(group: number): Sentence[] {
  return SENTENCES.filter((x) => x.group <= group)
}
