/**
 * Cloud sync against the Firebase emulators, security rules included. Skipped
 * unless the emulators are running:
 *   npx firebase-tools emulators:exec --only auth,firestore --project demo-reader "npx vitest run src/firebase/sync.emulator.test.ts"
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { deleteApp, initializeApp } from 'firebase/app'
import type { FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, doc, getDoc, getDocs, collection, getFirestore, setDoc, terminate } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { createProgress, LEGACY_CHILD_ID } from '../engine/progress'
import type { ChildRecord, SessionLog } from '../engine/types'
import { deleteAllCloudData, fetchMarkers, fetchRemote, mergeAccount, pushChild, removeCloudChild, resetCloudChild } from './sync'

declare const process: { env: Record<string, string | undefined> }
const host = process.env.FIRESTORE_EMULATOR_HOST
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST

async function signedIn(name: string): Promise<{ app: FirebaseApp; db: Firestore; uid: string }> {
  const app = initializeApp({ apiKey: 'demo', projectId: 'demo-reader' }, name)
  const auth = getAuth(app)
  connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true })
  const db = getFirestore(app)
  const [h, port] = host!.split(':')
  connectFirestoreEmulator(db, h, Number(port))
  const cred = await createUserWithEmailAndPassword(auth, `${name}-${Date.now()}@example.com`, 'secret123')
  return { app, db, uid: cred.user.uid }
}

const session = (id: string): SessionLog => ({ id, startedAt: 1, endedAt: 2, durationSec: 60, group: 1, attempts: 3, correct: 2, wrong: 1, newGpcs: [], newTricky: [], wordsRead: 1, xpEarned: 5, completed: true, steps: [] })
const child = (name: string, id: string, xp = 0, createdAt = 10): ChildRecord => ({ progress: { ...createProgress(name, 'robot', createdAt, id), xp }, sessions: [session(`${id}-s1`)] })

describe.skipIf(!host || !authHost)('cloud sync with several children (emulator)', () => {
  let a: Awaited<ReturnType<typeof signedIn>>
  let b: Awaited<ReturnType<typeof signedIn>>
  beforeAll(async () => {
    a = await signedIn('parent-a')
    b = await signedIn('parent-b')
  })
  afterAll(async () => {
    for (const x of [a, b]) {
      await terminate(x.db)
      await deleteApp(x.app)
    }
  })

  it('stores the first child where one-child versions look, and the others beside it', async () => {
    await pushChild(a.db, a.uid, child('Leo', LEGACY_CHILD_ID, 5))
    await pushChild(a.db, a.uid, child('Mia', 'kid2', 7))
    expect((await getDoc(doc(a.db, 'users', a.uid))).data()?.progress.childName).toBe('Leo')
    const remote = await fetchRemote(a.db, a.uid)
    expect(Object.keys(remote.children).sort()).toEqual(['kid2', LEGACY_CHILD_ID])
    expect(remote.children.kid2.progress?.xp).toBe(7)
    expect(remote.children.kid2.sessions.map((s) => s.id)).toEqual(['kid2-s1'])
    expect(remote.children[LEGACY_CHILD_ID].sessions.map((s) => s.id)).toEqual(['main-s1'])
  })

  it('reads progress written by a one-child version (no id) as the first child', async () => {
    const old = { ...createProgress('Leo', 'robot', 10), xp: 9 } as Partial<ChildRecord['progress']>
    delete old.id
    await setDoc(doc(a.db, 'users', a.uid), { progress: old, updatedAt: 11 }, { merge: true })
    const remote = await fetchRemote(a.db, a.uid)
    expect(remote.children[LEGACY_CHILD_ID].progress?.id).toBe(LEGACY_CHILD_ID)
    expect(remote.children[LEGACY_CHILD_ID].progress?.xp).toBe(9)
  })

  it('starting a child over leaves a marker that drops older copies elsewhere', async () => {
    await resetCloudChild(a.db, a.uid, 'kid2', 1000)
    const remote = await fetchRemote(a.db, a.uid)
    expect(remote.children.kid2).toEqual({ progress: null, sessions: [], resetAt: 1000 })
    expect((await fetchMarkers(a.db, a.uid, ['kid2'])).resetAt.kid2).toBe(1000)
    // Another device still has the old Mia: she starts over there too, Leo is kept.
    const merged = mergeAccount({ kid2: child('Mia', 'kid2', 50, 10), [LEGACY_CHILD_ID]: child('Leo', LEGACY_CHILD_ID, 9) }, remote)
    expect([merged.kid2.progress.xp, merged.kid2.progress.createdAt, merged[LEGACY_CHILD_ID].progress.xp]).toEqual([0, 1000, 9])
    // The fresh copy uploads next to the marker.
    await pushChild(a.db, a.uid, child('Mia', 'kid2', 0, 2000))
    expect((await fetchRemote(a.db, a.uid)).children.kid2.progress?.childName).toBe('Mia')
  })

  it('removing a child deletes it and is remembered, without touching the first child', async () => {
    await removeCloudChild(a.db, a.uid, child('Mia', 'kid2', 0, 2000).progress)
    expect((await getDoc(doc(a.db, 'users', a.uid, 'children', 'kid2'))).exists()).toBe(false)
    expect((await getDocs(collection(a.db, `users/${a.uid}/children/kid2/sessions`))).size).toBe(0)
    const remote = await fetchRemote(a.db, a.uid)
    expect(remote.removed).toEqual(['kid2'])
    expect(remote.children[LEGACY_CHILD_ID].progress?.childName).toBe('Leo')
    expect(Object.keys(mergeAccount({ kid2: child('Mia', 'kid2') }, remote))).toEqual([LEGACY_CHILD_ID])
  })

  it('a one-child version resetting (overwriting users/{uid}) keeps the removal list', async () => {
    await setDoc(doc(a.db, 'users', a.uid), { resetAt: 3000 })
    expect((await fetchRemote(a.db, a.uid)).removed).toEqual(['kid2'])
  })

  it('removing the first child remembers which one it was', async () => {
    await pushChild(a.db, a.uid, child('Leo', LEGACY_CHILD_ID, 5, 4000))
    await removeCloudChild(a.db, a.uid, child('Leo', LEGACY_CHILD_ID, 5, 4000).progress)
    const remote = await fetchRemote(a.db, a.uid)
    expect(remote.removed).toEqual(['kid2', `${LEGACY_CHILD_ID}@4000`])
    expect(remote.children[LEGACY_CHILD_ID]?.progress ?? null).toBeNull()
    expect((await getDoc(doc(a.db, 'users', a.uid))).data()?.resetAt).toBe(3000)
  })

  it("rules keep each account's children private and well-formed", async () => {
    await pushChild(a.db, a.uid, child('Zoe', 'kid3'))
    await expect(getDoc(doc(b.db, 'users', a.uid, 'children', 'kid3'))).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(pushChild(b.db, a.uid, child('Evil', 'kid4'))).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(setDoc(doc(a.db, 'users', a.uid, 'children', 'kid3'), { progress: {}, junk: 1 })).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(setDoc(doc(a.db, 'users', a.uid, 'meta', 'removed'), { ids: 'kid3' })).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(getDoc(doc(b.db, 'users', a.uid, 'meta', 'removed'))).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('deleting the account removes every child', async () => {
    await deleteAllCloudData(a.db, a.uid)
    expect(await fetchRemote(a.db, a.uid)).toEqual({ children: {}, removed: [] })
    expect((await getDocs(collection(a.db, `users/${a.uid}/children`))).size).toBe(0)
    expect((await getDoc(doc(a.db, 'users', a.uid, 'meta', 'removed'))).exists()).toBe(false)
  })
})
