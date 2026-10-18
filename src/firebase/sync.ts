/**
 * Cloud persistence: Firestore documents under users/{uid}.
 *   users/{uid}                                   -> { progress, updatedAt, resetAt }   (the child from before several children)
 *   users/{uid}/sessions/{sessionId}              -> SessionLog
 *   users/{uid}/children/{childId}                -> { progress, updatedAt, resetAt }   (every other child)
 *   users/{uid}/children/{childId}/sessions/{id}  -> SessionLog
 *   users/{uid}/meta/removed                      -> { ids }   children removed on any device
 *   users/{uid}/recordings/{key}                  -> { b64, type, updatedAt }  (shared)
 * The child saved before several children were supported (LEGACY_CHILD_ID) stays at
 * users/{uid}, where one-child versions of the app keep it, so they still show that child.
 * The removal list has its own document because a one-child version overwrites users/{uid}
 * when it resets. Local data is the source of truth while offline; on sign-in we merge.
 * Local data is the source of truth while offline; on sign-in we merge.
 */
import { arrayUnion, collection, deleteDoc, deleteField, doc, getDoc, getDocFromServer, getDocs, setDoc, writeBatch } from 'firebase/firestore'
import type { DocumentReference, Firestore } from 'firebase/firestore'
import type { ChildRecord, ItemState, Progress, SessionLog } from '../engine/types'
import { createProgress, LEGACY_CHILD_ID, migrateProgress } from '../engine/progress'

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
  const pick = remote.streak.lastDay > local.streak.lastDay ? remote.streak : local.streak.lastDay > remote.streak.lastDay ? local.streak : (remote.streak.count > local.streak.count ? remote.streak : local.streak)
  // A shield used on either device counts as used (never write undefined: Firestore rejects it).
  const shieldDay = [local.streak.shieldDay, remote.streak.shieldDay].filter((d): d is string => Boolean(d)).sort().pop()
  const streak = shieldDay ? { ...pick, shieldDay } : pick
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

/** A child's cloud copy. `resetAt` marks when it was last started over on any device (0 = never). */
export interface RemoteChild {
  progress: Progress | null
  sessions: SessionLog[]
  resetAt: number
}

export interface RemoteAccount {
  children: Record<string, RemoteChild>
  /** Children removed on some device, as removalKey()s. */
  removed: string[]
}

/**
 * How a removed child is remembered. Every device's child from before several children
 * shares LEGACY_CHILD_ID, so that one is told apart by when it was created.
 */
export function removalKey(p: Progress): string {
  return p.id === LEGACY_CHILD_ID ? `${LEGACY_CHILD_ID}@${p.createdAt}` : p.id
}

/** Combine the children on this device with the cloud copy, without losing work done on either side. */
export function mergeAccount(local: Record<string, ChildRecord>, remote: RemoteAccount): Record<string, ChildRecord> {
  const out: Record<string, ChildRecord> = {}
  const gone = (p: Progress) => remote.removed.includes(removalKey(p))
  for (const id of new Set([...Object.keys(local), ...Object.keys(remote.children)])) {
    const l = local[id] && !gone(local[id].progress) ? local[id] : null
    const r = remote.children[id]
    const cloud = r?.progress && !gone(r.progress) ? { progress: r.progress, sessions: r.sessions.slice(-400) } : null
    if (l && r?.resetAt && l.progress.createdAt < r.resetAt) {
      // Started over on another device after this copy was made: take the new copy, or start over here too.
      const p = l.progress
      out[id] = cloud ?? { progress: { ...createProgress(p.childName, p.character, r.resetAt, id), settings: p.settings, dailyGoalMin: p.dailyGoalMin }, sessions: [] }
    } else if (!l) {
      if (cloud) out[id] = cloud
    } else if (!cloud) out[id] = l
    else out[id] = { progress: mergeProgress(l.progress, cloud.progress)!, sessions: mergeSessions(l.sessions, cloud.sessions).slice(-400) }
  }
  return out
}

function childDoc(db: Firestore, uid: string, id: string): DocumentReference {
  return id === LEGACY_CHILD_ID ? doc(db, 'users', uid) : doc(db, 'users', uid, 'children', id)
}

function sessionsPath(uid: string, id: string): string {
  return id === LEGACY_CHILD_ID ? `users/${uid}/sessions` : `users/${uid}/children/${id}/sessions`
}

async function fetchSessions(db: Firestore, uid: string, id: string): Promise<SessionLog[]> {
  const snap = await getDocs(collection(db, sessionsPath(uid, id)))
  return snap.docs.map((d) => d.data() as SessionLog)
}

function remoteChild(data: Record<string, unknown>, id: string, sessions: SessionLog[]): RemoteChild {
  const progress = data.progress ? migrateProgress({ ...(data.progress as object), id }) : null
  return { progress, sessions, resetAt: Number(data.resetAt ?? 0) }
}

function removedDoc(db: Firestore, uid: string): DocumentReference {
  return doc(db, 'users', uid, 'meta', 'removed')
}

function removedIds(data: Record<string, unknown> | undefined): string[] {
  return Array.isArray(data?.ids) ? (data.ids as string[]) : []
}

export async function fetchRemote(db: Firestore, uid: string): Promise<RemoteAccount> {
  const [main, kids, removed] = await Promise.all([getDoc(doc(db, 'users', uid)), getDocs(collection(db, 'users', uid, 'children')), getDoc(removedDoc(db, uid))])
  const docs: [string, Record<string, unknown>][] = kids.docs.map((k) => [k.id, k.data()])
  const data = main.exists() ? main.data() : {}
  if (data.progress || data.resetAt) docs.unshift([LEGACY_CHILD_ID, data])
  const children: Record<string, RemoteChild> = {}
  await Promise.all(
    docs.map(async ([id, d]) => {
      children[id] = remoteChild(d, id, d.progress ? await fetchSessions(db, uid, id) : [])
    }),
  )
  return { children, removed: removedIds(removed.data()) }
}

/**
 * Removal and reset markers for these children, read from the server (not the cache),
 * so a push never uploads a child that was removed or started over elsewhere.
 */
export async function fetchMarkers(db: Firestore, uid: string, ids: string[]): Promise<{ removed: string[]; resetAt: Record<string, number> }> {
  const [removed, ...snaps] = await Promise.all([getDocFromServer(removedDoc(db, uid)), ...ids.map((id) => getDocFromServer(childDoc(db, uid, id)))])
  const resetAt: Record<string, number> = {}
  ids.forEach((id, i) => {
    resetAt[id] = snaps[i].exists() ? Number(snaps[i].data()?.resetAt ?? 0) : 0
  })
  return { removed: removedIds(removed.data()), resetAt }
}

/** Throws unless the server is reachable right now (used before destructive operations). */
export async function requireServer(db: Firestore, uid: string): Promise<void> {
  await getDocFromServer(doc(db, 'users', uid))
}

export async function pushChild(db: Firestore, uid: string, child: ChildRecord): Promise<void> {
  const { progress } = child
  await setDoc(childDoc(db, uid, progress.id), { progress, updatedAt: progress.updatedAt }, { merge: true })
  // Firestore batches are limited to 500 writes.
  const sessions = child.sessions.slice(-50)
  for (let i = 0; i < sessions.length; i += 400) {
    const batch = writeBatch(db)
    for (const s of sessions.slice(i, i + 400)) batch.set(doc(db, sessionsPath(uid, progress.id), s.id), s)
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

/** Delete every document in a collection. */
async function deleteCollection(db: Firestore, path: string): Promise<void> {
  const snap = await getDocs(collection(db, path))
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db)
    for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref)
    await batch.commit()
  }
}

/** Remove a child's progress and sessions; with resetAt, leave a marker that it was started over. */
async function clearChild(db: Firestore, uid: string, id: string, resetAt: number | null): Promise<void> {
  if (id === LEGACY_CHILD_ID) {
    await setDoc(doc(db, 'users', uid), { progress: deleteField(), updatedAt: deleteField(), ...(resetAt ? { resetAt } : {}) }, { merge: true })
  } else if (resetAt) await setDoc(childDoc(db, uid, id), { resetAt })
  await deleteCollection(db, sessionsPath(uid, id))
  if (id !== LEGACY_CHILD_ID && !resetAt) await deleteDoc(childDoc(db, uid, id))
}

/**
 * Start one child over in the cloud (recordings are kept). A reset marker stays behind
 * so other signed-in devices drop their older local copy instead of uploading it again.
 */
export async function resetCloudChild(db: Firestore, uid: string, id: string, resetAt: number): Promise<void> {
  await clearChild(db, uid, id, resetAt)
}

/** Remove one child from the cloud, and tell other devices it is gone. */
export async function removeCloudChild(db: Firestore, uid: string, child: Progress): Promise<void> {
  await setDoc(removedDoc(db, uid), { ids: arrayUnion(removalKey(child)) }, { merge: true })
  await clearChild(db, uid, child.id, null)
}

/** Remove everything stored for this account. */
export async function deleteAllCloudData(db: Firestore, uid: string): Promise<void> {
  await deleteCollection(db, `users/${uid}/recordings`)
  await deleteCollection(db, `users/${uid}/sessions`)
  const kids = await getDocs(collection(db, 'users', uid, 'children'))
  for (const k of kids.docs) {
    await deleteCollection(db, sessionsPath(uid, k.id))
    await deleteDoc(k.ref)
  }
  await deleteDoc(removedDoc(db, uid))
  await deleteDoc(doc(db, 'users', uid))
}

export async function fetchRecordings(db: Firestore, uid: string): Promise<RemoteRecording[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'recordings'))
  return snap.docs.map((d) => d.data() as RemoteRecording)
}
