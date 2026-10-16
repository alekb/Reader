/**
 * Auth + cloud sync. Works as a no-op when Firebase is not configured.
 */
import { create } from 'zustand'
import { EmailAuthProvider, createUserWithEmailAndPassword, deleteUser, onAuthStateChanged, reauthenticateWithCredential, sendPasswordResetEmail, signInWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import { firebaseEnabled, getFirebase } from '../firebase/config'
import { deleteAllCloudData, deleteRemoteRecording, fetchMarkers, fetchRecordings, fetchRemote, mergeAccount, pushChild, pushRecording, removeCloudChild, requireServer, resetCloudChild } from '../firebase/sync'
import { allChildren, useProgress } from './progressStore'
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
  /** Sign out. With clearDevice, the children's progress and recordings are removed from this device too. */
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
  /** Start one child over, here and in the cloud (needs internet when signed in). */
  resetChild: (id: string) => Promise<void>
  /** Remove one child, here and in the cloud (needs internet when signed in). */
  removeChild: (id: string) => Promise<void>
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
/** progress.updatedAt of each child as last uploaded, so unchanged children are skipped. */
let pushedAt: Record<string, number> = {}
/** The push currently talking to Firestore, so destructive operations can wait for it. */
let pushInFlight: Promise<void> | null = null
/** True while a reset or account deletion runs: no pushes may start. */
let wiping = false

/**
 * Run a destructive cloud change before the matching local one. Checks the server is
 * reachable first, so nothing is half-done; stops pushes until the caller clears `wiping`.
 * Does nothing when signed out.
 */
async function cloudFirst(user: { uid: string } | null, change: (db: Firestore, uid: string) => Promise<void>) {
  const fb = getFirebase()
  if (!fb || !user) return
  await withTimeout(requireServer(fb.db, user.uid), 8000, OFFLINE)
  await quiesce()
  // If the connection drops now, the writes stay queued and finish once online.
  await withTimeout(change(fb.db, user.uid), 20000, OFFLINE).catch(() => {})
}

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
      useProgress.getState().clearDevice()
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
      const remote = await fetchRemote(fb.db, user.uid)
      const owner = readOwner()
      const cloudHasChildren = Object.values(remote.children).some((c) => c.progress)
      let children
      if (owner && owner !== user.uid && cloudHasChildren) {
        // This device held another parent's children and this account has its own: never mix, take the cloud copy.
        await clearRecordings()
        children = mergeAccount({}, remote)
      } else {
        // Same account, or an account with nothing saved yet: combine (the children here move into this account).
        children = mergeAccount(allChildren(useProgress.getState()), remote)
      }
      useProgress.getState().setChildren(children)
      writeOwner(user.uid)
      // Restore recordings that are missing locally.
      const recs = await fetchRecordings(fb.db, user.uid).catch(() => [])
      for (const r of recs) {
        if (!(await hasRecording(r.key))) await saveRecording(r.key, base64ToBlob(r.b64, r.type)).catch(() => {})
      }
      set({ status: 'synced', lastSyncAt: Date.now() })
      // Push the merged result back so both sides agree.
      pushedAt = {}
      await get().push()
    } catch (e) {
      set({ status: 'error', error: friendly(e) })
    }
  },

  push: async () => {
    const fb = getFirebase()
    const user = get().user
    if (!fb || !user || wiping) return
    let stale = false
    const run = async () => {
      const state = useProgress.getState()
      const children = allChildren(state)
      // The child playing (its answers do not always bump updatedAt), plus any other child that changed.
      const ids = Object.keys(children).filter((id) => id === state.progress?.id || pushedAt[id] !== children[id].progress.updatedAt)
      if (!ids.length) return
      set({ status: 'syncing', error: null })
      try {
        // Never upload a child that was removed, or started over, on another device after this copy was made.
        const markers = await fetchMarkers(fb.db, user.uid, ids).catch(() => null)
        const gone = ids.filter((id) => markers && (markers.removed.includes(id) || children[id].progress.createdAt < (markers.resetAt[id] ?? 0)))
        if (gone.length) {
          for (const id of gone) useProgress.getState().removeChild(id)
          stale = true
        }
        for (const id of ids) {
          if (wiping) return
          if (gone.includes(id)) continue
          await pushChild(fb.db, user.uid, children[id])
          pushedAt[id] = children[id].progress.updatedAt
        }
        lastPushedDirty = state.dirty
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
    // A child was started over elsewhere: fetch its new copy.
    if (stale) await get().pull()
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

  resetChild: async (id) => {
    await cloudFirst(get().user, (db, uid) => resetCloudChild(db, uid, id, Date.now()))
    useProgress.getState().resetChild(id)
    wiping = false
  },

  removeChild: async (id) => {
    await cloudFirst(get().user, (db, uid) => removeCloudChild(db, uid, id))
    useProgress.getState().removeChild(id)
    delete pushedAt[id]
    wiping = false
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
    useProgress.getState().clearDevice()
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
