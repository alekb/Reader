/**
 * Auth + cloud sync. Works as a no-op when Firebase is not configured.
 */
import { create } from 'zustand'
import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth'
import { firebaseEnabled, getFirebase } from '../firebase/config'
import { fetchRecordings, fetchRemote, pushProgress, pushRecording, pushSessions } from '../firebase/sync'
import { useProgress } from './progressStore'
import { base64ToBlob, blobToBase64, hasRecording, saveRecording } from '../speech/recordings'

export type SyncStatus = 'disabled' | 'signedOut' | 'syncing' | 'synced' | 'error'

interface SyncState {
  enabled: boolean
  user: { uid: string; email: string | null } | null
  status: SyncStatus
  lastSyncAt: number | null
  error: string | null
  signUp: (email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  /** Pull cloud data and merge it into local state. */
  pull: () => Promise<void>
  /** Push local state to the cloud now. */
  push: () => Promise<void>
  /** Upload one recording (called after the parent records a sound). */
  uploadRecording: (key: string, blob: Blob) => Promise<void>
}

function friendly(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  const map: Record<string, string> = {
    'auth/invalid-email': 'That email address does not look right.',
    'auth/user-not-found': 'No account with that email.',
    'auth/wrong-password': 'Wrong password.',
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/email-already-in-use': 'An account with that email already exists. Try signing in.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/network-request-failed': 'No internet connection.',
    'auth/too-many-requests': 'Too many attempts. Please wait a bit and try again.',
  }
  return map[code] ?? (e instanceof Error ? e.message : 'Something went wrong.')
}

let pushTimer: ReturnType<typeof setTimeout> | null = null
let lastPushedDirty = -1

export const useSync = create<SyncState>()((set, get) => ({
  enabled: firebaseEnabled,
  user: null,
  status: firebaseEnabled ? 'signedOut' : 'disabled',
  lastSyncAt: null,
  error: null,

  signUp: async (email, password) => {
    const fb = getFirebase()
    if (!fb) throw new Error('Cloud sync is not configured.')
    try {
      await createUserWithEmailAndPassword(fb.auth, email.trim(), password)
    } catch (e) {
      throw new Error(friendly(e))
    }
  },
  signIn: async (email, password) => {
    const fb = getFirebase()
    if (!fb) throw new Error('Cloud sync is not configured.')
    try {
      await signInWithEmailAndPassword(fb.auth, email.trim(), password)
    } catch (e) {
      throw new Error(friendly(e))
    }
  },
  signOut: async () => {
    const fb = getFirebase()
    if (!fb) return
    await get().push().catch(() => {})
    await fbSignOut(fb.auth)
    set({ user: null, status: 'signedOut' })
  },
  resetPassword: async (email) => {
    const fb = getFirebase()
    if (!fb) throw new Error('Cloud sync is not configured.')
    try {
      await sendPasswordResetEmail(fb.auth, email.trim())
    } catch (e) {
      throw new Error(friendly(e))
    }
  },

  pull: async () => {
    const fb = getFirebase()
    const user = get().user
    if (!fb || !user) return
    set({ status: 'syncing', error: null })
    try {
      const { progress, sessions } = await fetchRemote(fb.db, user.uid)
      useProgress.getState().mergeRemote(progress, sessions)
      // Restore recordings that are missing locally.
      const recs = await fetchRecordings(fb.db, user.uid).catch(() => [])
      for (const r of recs) {
        if (!(await hasRecording(r.key))) await saveRecording(r.key, base64ToBlob(r.b64, r.type)).catch(() => {})
      }
      set({ status: 'synced', lastSyncAt: Date.now() })
      // Push the merged result back so both sides agree.
      await get().push()
    } catch (e) {
      set({ status: 'error', error: friendly(e) })
    }
  },

  push: async () => {
    const fb = getFirebase()
    const user = get().user
    const { progress, sessions, dirty } = useProgress.getState()
    if (!fb || !user || !progress) return
    set({ status: 'syncing', error: null })
    try {
      await pushProgress(fb.db, user.uid, progress)
      await pushSessions(fb.db, user.uid, sessions.slice(-50))
      lastPushedDirty = dirty
      set({ status: 'synced', lastSyncAt: Date.now() })
    } catch (e) {
      set({ status: 'error', error: friendly(e) })
    }
  },

  uploadRecording: async (key, blob) => {
    const fb = getFirebase()
    const user = get().user
    if (!fb || !user) return
    const b64 = await blobToBase64(blob)
    await pushRecording(fb.db, user.uid, { key, b64, type: blob.type || 'audio/webm', updatedAt: Date.now() }).catch(() => {})
  },
}))

// ---- Wire up auth state and automatic pushes ----
if (firebaseEnabled) {
  const fb = getFirebase()!
  onAuthStateChanged(fb.auth, (u) => {
    if (u) {
      useSync.setState({ user: { uid: u.uid, email: u.email }, status: 'syncing' })
      useSync.getState().pull()
    } else {
      useSync.setState({ user: null, status: 'signedOut' })
    }
  })

  useProgress.subscribe((state, prev) => {
    if (state.dirty === prev.dirty || state.dirty === lastPushedDirty) return
    if (!useSync.getState().user) return
    if (pushTimer) clearTimeout(pushTimer)
    // Push quickly after a session ends, otherwise debounce.
    const delay = state.active ? 8000 : 1500
    pushTimer = setTimeout(() => useSync.getState().push(), delay)
  })
}
