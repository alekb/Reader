import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { lockParentArea } from '../screens/ParentGate'

/** Event the lesson listens for, so the Android back button asks "Stop for now?" instead of leaving silently. */
export const LESSON_BACK_EVENT = 'rq-lesson-back'

/**
 * Route-level behaviour:
 * - leaving the parent area locks it again, so back/forward cannot reopen the dashboard;
 * - Android hardware back: lesson → "Stop for now?", home → exit app, anything else → home.
 */
export function BackButton() {
  const location = useLocation()
  const nav = useNavigate()
  const pathRef = useRef(location.pathname)
  const navRef = useRef(nav)
  useEffect(() => {
    pathRef.current = location.pathname
    navRef.current = nav
    if (!location.pathname.startsWith('/parent')) lockParentArea()
  }, [location.pathname, nav])

  // Register the native listener once; read the current route from refs.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const handle = CapApp.addListener('backButton', () => {
      const path = pathRef.current
      if (path === '/play') window.dispatchEvent(new Event(LESSON_BACK_EVENT))
      else if (path === '/' || path === '') CapApp.exitApp()
      else navRef.current('/', { replace: true })
    })
    return () => {
      handle.then((h) => h.remove())
    }
  }, [])
  return null
}
