/**
 * Auth + cloud sync. Works as a no-op when Firebase is not configured.
 */
import { create } from 'zustand'
import { EmailAuthProvider, createUserWithEmailAndPassword, deleteUser, onAuthStateChanged, reauthenticateWithCredential, sendPasswordResetEmail, signInWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth'
import { firebaseEnabled, getFirebase } from '../firebase/config'
import { deleteAllCloudData, deleteRemoteRecording, fetchRecordings, fetchRemote, fetchResetAt, pushProgress, pushRecording, pushSessions, requireServer, wipeCloudProgress } from '../firebase/sync'
import { useProgress } from './progressStore'
import { base64ToBlob, blobToBase64, clearRecordings, hasRecording, saveRecording } from '../speech/recordings'

export type SyncStatus = 'disabled' | 'signedOut' | 'syncing' | 'synced' | 'error'

interface SyncState {
  enabled: boolean
  user: { uid: string; email: string | null } | null
  status: SyncStatus
  lastSyncAt: number | null
  error: string | null
  signUp: (email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  /** Sign out. With clearDevice, the child's progress and recordings are removed from this device too. */
  signOut: (opts?: { clearDevice?: boolean }) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  /** Pull cloud data and merge it into local state. */
  pull: () => Promise<void>
  /** Push local state to the cloud now. */
  push: () => Promise<void>
  /** Upload one recording (called after the parent records a sound). */
  uploadRecording: (key: string, blob: Blob) => Promise<void>
  /** Remove a recording from the cloud (local copy is removed by the caller). */
  deleteRecording: (key: string) => Promise<void>
  /** Erase the child's progress here and in the cloud (needs internet when signed in). */
  resetProgress: () => Promise<void>
  /** Permanently delete the parent account and every piece of cloud and local data. */
  deleteAccount: (password: string) => Promise<void>
}

/** Cloud writes only resolve once the server acknowledges them; fail fast when offline. */
function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer))
}
const OFFLINE = 'This needs an internet connection. Please try again when you are online.'

/** Which parent account the progress on this device belongs to. */
const OWNER_KEY = 'reader-quest-owner-uid'
function readOwner(): string {
  try {
    return localStorage.getItem(OWNER_KEY) ?? ''
  } catch {
    return ''
  }
}
function writeOwner(uid: string) {
  try {
    if (uid) localStorage.setItem(OWNER_KEY, uid)
    else localStorage.removeItem(OWNER_KEY)
  } catch {
    /* ignore */
  }
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
    'auth/requires-recent-login': 'Please sign in again, then retry.',
    'auth/missing-password': 'Please enter your password.',
  }
  return map[code] ?? (e instanceof Error ? e.message : 'Something went wrong.')
}

let pushTimer: ReturnType<typeof setTimeout> | null = null
let lastPushedDirty = -1
/** The push currently talking to Firestore, so destructive operations can wait for it. */
let pushInFlight: Promise<void> | null = null
/** True while a reset or account deletion runs: no pushes may start. */
let wiping = false

/** Stop scheduled pushes and wait for one already running. */
async function quiesce() {
  wiping = true
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = null
  await pushInFlight?.catch(() => {})
}

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
  signOut: async (opts) => {
    const fb = getFirebase()
    if (!fb) return
    // Best effort: do not hang when offline (Firestore keeps queued writes for this account).
    await withTimeout(get().push(), 4000, OFFLINE).catch(() => {})
    await fbSignOut(fb.auth)
    if (opts?.clearDevice) {
      useProgress.getState().resetAll()
      await clearRecordings()
      writeOwner('')
    }
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
      const { progress, sessions, resetAt } = await fetchRemote(fb.db, user.uid)
      const owner = readOwner()
      const local = useProgress.getState().progress
      if (resetAt && local && local.createdAt < resetAt) {
        // Progress was reset on another device after this copy was made: drop it.
        if (progress) useProgress.getState().replaceAll(progress, sessions)
        else useProgress.getState().resetAll()
      } else if (owner && owner !== user.uid && progress) {
        // This device held another parent's child and this account has its own: never mix, take the cloud copy.
        await clearRecordings()
        useProgress.getState().replaceAll(progress, sessions)
      } else {
        // Same account, or an account with nothing saved yet: combine (the local child moves into this account).
        useProgress.getState().mergeRemote(progress, sessions)
      }
      writeOwner(user.uid)
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
    if (!fb || !user || wiping) return
    const run = async () => {
      const { progress, sessions, dirty } = useProgress.getState()
      if (!progress) return
      set({ status: 'syncing', error: null })
      try {
        // Never upload a copy older than a reset made on another device.
        const resetAt = await fetchResetAt(fb.db, user.uid).catch(() => 0)
        if (resetAt && progress.createdAt < resetAt) {
          useProgress.getState().resetAll()
          set({ status: 'synced', lastSyncAt: Date.now() })
          return
        }
        if (wiping) return
        await pushProgress(fb.db, user.uid, progress)
        if (wiping) return
        await pushSessions(fb.db, user.uid, sessions.slice(-50))
        lastPushedDirty = dirty
        set({ status: 'synced', lastSyncAt: Date.now() })
      } catch (e) {
        set({ status: 'error', error: friendly(e) })
      }
    }
    const p = (pushInFlight ?? Promise.resolve()).catch(() => {}).then(run)
    pushInFlight = p
    try {
      await p
    } finally {
      if (pushInFlight === p) pushInFlight = null
    }
  },

  uploadRecording: async (key, blob) => {
    const fb = getFirebase()
    const user = get().user
    if (!fb || !user) return
    const b64 = await blobToBase64(blob)
    await pushRecording(fb.db, user.uid, { key, b64, type: blob.type || 'audio/webm', updatedAt: Date.now() }).catch(() => {})
  },

  deleteRecording: async (key) => {
    const fb = getFirebase()
    const user = get().user
    if (!fb || !user) return
    await deleteRemoteRecording(fb.db, user.uid, key).catch(() => {})
  },

  resetProgress: async () => {
    const fb = getFirebase()
    const user = get().user
    if (!fb || !user) {
      useProgress.getState().resetAll()
      return
    }
    // Check we are online before touching anything, so nothing is half-done.
    await withTimeout(requireServer(fb.db, user.uid), 8000, OFFLINE)
    await quiesce()
    try {
      // If the connection drops now, the deletes stay queued and finish once online.
      await withTimeout(wipeCloudProgress(fb.db, user.uid, Date.now()), 20000, OFFLINE).catch(() => {})
      useProgress.getState().resetAll()
    } finally {
      wiping = false
    }
  },

  deleteAccount: async (password) => {
    const fb = getFirebase()
    const current = fb?.auth.currentUser
    if (!fb || !current || !current.email) throw new Error('Please sign in first.')
    try {
      await withTimeout(requireServer(fb.db, current.uid), 8000, OFFLINE)
      await withTimeout(reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, password)), 15000, OFFLINE)
      await quiesce()
      // The account is only removed once every document is gone, so nothing is orphaned.
      await withTimeout(deleteAllCloudData(fb.db, current.uid), 60000, 'The connection dropped while deleting. The deletion will finish when you are back online; then try again to remove the account.')
      await deleteUser(current)
    } catch (e) {
      wiping = false
      throw new Error(friendly(e))
    }
    wiping = false
    useProgress.getState().resetAll()
    await clearRecordings()
    writeOwner('')
    set({ user: null, status: 'signedOut', lastSyncAt: null })
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
