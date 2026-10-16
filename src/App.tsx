import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useProgress } from './store/progressStore'
import './store/syncStore'
import './store/updateStore'
import { Alphabet } from './screens/Alphabet'
import { Dashboard } from './screens/Dashboard'
import { Home } from './screens/Home'
import { Lesson } from './screens/Lesson'
import { Onboarding } from './screens/Onboarding'
import { ParentGate } from './screens/ParentGate'
import { SessionComplete } from './screens/SessionComplete'
import { Stickers } from './screens/Stickers'
import { Wardrobe } from './screens/Wardrobe'
import { WhoIsPlaying } from './screens/WhoIsPlaying'
import { BackButton } from './components/BackButton'

export default function App() {
  const progress = useProgress((s) => s.progress)
  return (
    <HashRouter>
      <BackButton />
      <Routes>
        {!progress ? (
          <>
            <Route path="/parent" element={<ParentGate />} />
            <Route path="/parent/dashboard" element={<Dashboard />} />
            <Route path="/who" element={<WhoIsPlaying />} />
            <Route path="*" element={<Onboarding />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Home />} />
            <Route path="/play" element={<Lesson />} />
            <Route path="/done" element={<SessionComplete />} />
            <Route path="/wardrobe" element={<Wardrobe />} />
            <Route path="/stickers" element={<Stickers />} />
            <Route path="/alphabet" element={<Alphabet />} />
            <Route path="/who" element={<WhoIsPlaying />} />
            <Route path="/parent" element={<ParentGate />} />
            <Route path="/parent/dashboard" element={<Dashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </HashRouter>
  )
}
