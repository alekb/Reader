import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Screen, TopBar } from '../components/ui'
import { ALPHABET, GPC_BY_ID } from '../content/gpcs'
import { useProgress } from '../store/progressStore'
import { say, speakLetterName, speakSound, speakWord } from '../speech/phonics'
import { sfx } from '../speech/sfx'
import { pause, stopSpeaking, warmUp } from '../speech/tts'

/** Free-play alphabet: tap a letter to hear its name, its sound and a keyword. */
export function Alphabet() {
  const nav = useNavigate()
  const progress = useProgress((s) => s.progress)!
  const [upper, setUpper] = useState(false)
  const [active, setActive] = useState<string | null>(null)

  const tapLetter = async (letter: string) => {
    warmUp()
    sfx.tap()
    stopSpeaking()
    setActive(letter)
    const gpc = GPC_BY_ID[letter]
    await speakLetterName(letter)
    await pause(250)
    if (gpc) {
      await say('says', { pauseAfter: 50 })
      await speakSound(letter, { pauseAfter: 300 })
      await say(`like ${gpc.keyword}`)
      await speakWord(gpc.keyword)
    }
    setActive(null)
  }

  return (
    <Screen className="gap-4 px-4 pb-10">
      <TopBar
        title="ABC"
        onBack={() => nav('/')}
        right={
          <button onClick={() => setUpper(!upper)} className="tile px-3 py-1 font-letter text-xl font-bold">
            {upper ? 'Aa' : 'aA'}
          </button>
        }
      />
      <div className="text-center font-bold text-ink/60">Tap a letter to hear its name and sound.</div>
      <div className="grid grid-cols-4 gap-3">
        {ALPHABET.map((l) => {
          const gpc = GPC_BY_ID[l]
          const known = Boolean(progress.gpcs[l])
          return (
            <button
              key={l}
              onClick={() => tapLetter(l)}
              className={`tile flex-col py-3 ${active === l ? 'bg-sun scale-105' : ''} ${known ? '' : 'bg-white/60'}`}
            >
              <div className="font-letter text-5xl font-bold">{upper ? l.toUpperCase() : l}</div>
              <div className="text-xl">{gpc?.emoji ?? ''}</div>
            </button>
          )
        })}
      </div>
      <button
        onClick={async () => {
          warmUp()
          stopSpeaking()
          for (const l of ALPHABET) {
            setActive(l)
            await speakLetterName(l)
            await pause(80)
          }
          setActive(null)
        }}
        className="btn btn-primary"
      >
        🎵 Say the alphabet
      </button>
    </Screen>
  )
}
