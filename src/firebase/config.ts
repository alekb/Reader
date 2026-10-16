import { initializeApp, getApps } from 'firebase/app'
import type { FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import type { Auth } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'

const env = import.meta.env

/**
 * The Reader Quest Firebase project. These values are public by design: they ship
 * inside every web and Android build. Firestore rules (firestore.rules) are what
 * keep each parent's data private. VITE_FIREBASE_* variables override them, e.g.
 * to point a local build at a test project.
 */
const PROJECT = {
  apiKey: 'AIzaSyAFEWLHRH78n93vknc4CWBBYcR0bzrsH7A',
  authDomain: 'reader-quest-d130f.firebaseapp.com',
  projectId: 'reader-quest-d130f',
  storageBucket: 'reader-quest-d130f.firebasestorage.app',
  messagingSenderId: '125016860281',
  appId: '1:125016860281:web:c325eede9a66c6acc796a8',
}

export const firebaseConfig = {
  apiKey: (env.VITE_FIREBASE_API_KEY as string | undefined) || PROJECT.apiKey,
  authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) || PROJECT.authDomain,
  projectId: (env.VITE_FIREBASE_PROJECT_ID as string | undefined) || PROJECT.projectId,
  storageBucket: (env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined) || PROJECT.storageBucket,
  messagingSenderId: (env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined) || PROJECT.messagingSenderId,
  appId: (env.VITE_FIREBASE_APP_ID as string | undefined) || PROJECT.appId,
}

/** Local testing only: use the Firebase emulators on this host (auth :9099, Firestore :8080). */
const emulatorHost = env.VITE_FIREBASE_EMULATOR_HOST as string | undefined

/** True when a Firebase project is configured. */
export const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId)

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

export function getFirebase(): { app: FirebaseApp; auth: Auth; db: Firestore } | null {
  if (!firebaseEnabled) return null
  if (!app) {
    app = getApps()[0] ?? initializeApp(firebaseConfig)
    auth = getAuth(app)
    try {
      db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
    } catch {
      db = initializeFirestore(app, {})
    }
    if (emulatorHost) {
      connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true })
      connectFirestoreEmulator(db, emulatorHost, 8080)
    }
  }
  return { app, auth: auth!, db: db! }
}
