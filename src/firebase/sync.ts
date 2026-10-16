/**
 * Cloud persistence: Firestore documents under users/{uid}.
 *   users/{uid}                      -> { progress: Progress, updatedAt }
 *   users/{uid}/sessions/{sessionId} -> SessionLog
 *   users/{uid}/recordings/{key}     -> { b64, type, updatedAt }
 * Local data is the source of truth while offline; on sign-in we merge.
 */
import { collection, deleteDoc, doc, getDoc, getDocFromServer, getDocs, setDoc, writeBatch } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import type { Progress, SessionLog } from '../engine/types'
import type { ItemState } from '../engine/types'
import { migrateProgress } from '../engine/progress'

function mergeItems(a: Record<string, ItemState>, b: Record<string, ItemState>): Record<string, ItemState> {
  const out: Record<string, ItemState> = { ...a }
  for (const [id, it] of Object.entries(b)) {
    const cur = out[id]
    if (!cur || it.lastSeen > cur.lastSeen || (it.lastSeen === cur.lastSeen && it.seen > cur.seen)) out[id] = it
  }
  return out
}

function maxMap(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v)
  return out
}

/** Merge two progress snapshots without losing work done on either device. */
export function mergeProgress(localIn: Progress | null, remoteIn: Progress | null): Progress | null {
  const local = localIn ? migrateProgress(localIn) : null
  const remote = remoteIn ? migrateProgress(remoteIn) : null
  if (!local) return remote
  if (!remote) return local
  const base = remote.updatedAt > local.updatedAt ? remote : local
  const streak = remote.streak.lastDay > local.streak.lastDay ? remote.streak : local.streak.lastDay > remote.streak.lastDay ? local.streak : (remote.streak.count > local.streak.count ? remote.streak : local.streak)
  return {
    ...base,
    xp: Math.max(local.xp, remote.xp),
    wordsRead: Math.max(local.wordsRead, remote.wordsRead),
    knownWords: maxMap(local.knownWords, remote.knownWords),
    gpcs: mergeItems(local.gpcs, remote.gpcs),
    tricky: mergeItems(local.tricky, remote.tricky),
    groupWords: maxMap(local.groupWords, remote.groupWords),
    completedGroups: [...new Set([...local.completedGroups, ...remote.completedGroups])].sort((a, b) => a - b),
    currentGroup: Math.max(local.currentGroup, remote.currentGroup),
    sessionsCompleted: Math.max(local.sessionsCompleted, remote.sessionsCompleted),
    unlockedParts: [...new Set([...local.unlockedParts, ...remote.unlockedParts])],
    stickers: [...new Set([...local.stickers, ...remote.stickers])],
    lastEggDay: local.lastEggDay > remote.lastEggDay ? local.lastEggDay : remote.lastEggDay,
    streak,
    // Settings are the parent's choice, not play: keep whichever was changed last.
    settings: remote.settings.changedAt > local.settings.changedAt ? remote.settings : local.settings.changedAt > remote.settings.changedAt ? local.settings : base.settings,
    createdAt: Math.min(local.createdAt, remote.createdAt),
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  }
}

export function mergeSessions(local: SessionLog[], remote: SessionLog[]): SessionLog[] {
  const byId = new Map<string, SessionLog>()
  for (const s of [...local, ...remote]) {
    const cur = byId.get(s.id)
    if (!cur || s.endedAt > cur.endedAt) byId.set(s.id, s)
  }
  return [...byId.values()].sort((a, b) => a.startedAt - b.startedAt)
}

export async function fetchRemote(db: Firestore, uid: string): Promise<{ progress: Progress | null; sessions: SessionLog[]; resetAt: number }> {
  const snap = await getDoc(doc(db, 'users', uid))
  const data = snap.exists() ? snap.data() : {}
  const progress = data.progress ? migrateProgress(data.progress) : null
  const sessSnap = await getDocs(collection(db, 'users', uid, 'sessions'))
  const sessions = sessSnap.docs.map((d) => d.data() as SessionLog)
  return { progress, sessions, resetAt: Number(data.resetAt ?? 0) }
}

/** When the progress was last reset from any device (0 = never). Reads the server, not the cache. */
export async function fetchResetAt(db: Firestore, uid: string): Promise<number> {
  const snap = await getDocFromServer(doc(db, 'users', uid))
  return snap.exists() ? Number(snap.data().resetAt ?? 0) : 0
}

/** Throws unless the server is reachable right now (used before destructive operations). */
export async function requireServer(db: Firestore, uid: string): Promise<void> {
  await getDocFromServer(doc(db, 'users', uid))
}

export async function pushProgress(db: Firestore, uid: string, progress: Progress): Promise<void> {
  await setDoc(doc(db, 'users', uid), { progress, updatedAt: progress.updatedAt }, { merge: true })
}

export async function pushSessions(db: Firestore, uid: string, sessions: SessionLog[]): Promise<void> {
  // Firestore batches are limited to 500 writes.
  for (let i = 0; i < sessions.length; i += 400) {
    const batch = writeBatch(db)
    for (const s of sessions.slice(i, i + 400)) batch.set(doc(db, 'users', uid, 'sessions', s.id), s)
    await batch.commit()
  }
}

export interface RemoteRecording {
  key: string
  b64: string
  type: string
  updatedAt: number
}

function recordingDocId(key: string): string {
  return key.replace(/[/:]/g, '_')
}

export async function pushRecording(db: Firestore, uid: string, rec: RemoteRecording): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'recordings', recordingDocId(rec.key)), rec)
}

export async function deleteRemoteRecording(db: Firestore, uid: string, key: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'recordings', recordingDocId(key)))
}

/** Delete every document in users/{uid}/{name}. */
async function deleteSubcollection(db: Firestore, uid: string, name: string): Promise<void> {
  const snap = await getDocs(collection(db, 'users', uid, name))
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db)
    for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref)
    await batch.commit()
  }
}

/**
 * Remove the child's progress and session history from the cloud (recordings are kept).
 * A reset marker stays behind so other signed-in devices drop their older local copy
 * instead of uploading it again.
 */
export async function wipeCloudProgress(db: Firestore, uid: string, resetAt: number): Promise<void> {
  await setDoc(doc(db, 'users', uid), { resetAt })
  await deleteSubcollection(db, uid, 'sessions')
}

/** Remove everything stored for this account. */
export async function deleteAllCloudData(db: Firestore, uid: string): Promise<void> {
  await deleteSubcollection(db, uid, 'recordings')
  await deleteSubcollection(db, uid, 'sessions')
  await deleteDoc(doc(db, 'users', uid))
}

export async function fetchRecordings(db: Firestore, uid: string): Promise<RemoteRecording[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'recordings'))
  return snap.docs.map((d) => d.data() as RemoteRecording)
}
