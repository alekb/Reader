import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'

if (Capacitor.isNativePlatform()) {
  // The Android app ships its files in the APK. A service worker there keeps serving
  // the previous version's cached code after an update, so remove one left by older builds
  // and reload straight away. Its caches are cleared on the next (uncontrolled) launch, and on
  // every launch after, so a launch cut short still finishes the job.
  void (async () => {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? []
    if (regs.length) {
      await Promise.all(regs.map((r) => r.unregister()))
      location.reload()
      return
    }
    if ('caches' in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)))
  })().catch(() => {
    // Best effort: anything left over is tried again on the next launch.
  })
} else if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // sw.js only exists in a production build (the dev server would answer with index.html).
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
