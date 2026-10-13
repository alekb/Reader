/**
 * Parent-recorded sound clips, stored in IndexedDB on the device (and
 * mirrored to Firestore when signed in so a reinstall restores them).
 * Key = GPC id (or "word:<text>" for a tricky word).
 */
const DB_NAME = 'reader-quest'
const STORE = 'recordings'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no indexeddb'))
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

const cache = new Map<string, Blob | null>()
const urlCache = new Map<string, string>()
let keysLoaded = false
let knownKeys = new Set<string>()

export async function listRecordingKeys(): Promise<string[]> {
  try {
    const db = await openDb()
    return await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAllKeys()
      req.onsuccess = () => resolve(req.result as string[])
      req.onerror = () => reject(req.error)
    })
  } catch {
    return []
  }
}

async function ensureKeys() {
  if (keysLoaded) return
  knownKeys = new Set(await listRecordingKeys())
  keysLoaded = true
}

export async function hasRecording(key: string): Promise<boolean> {
  await ensureKeys()
  return knownKeys.has(key)
}

export async function getRecording(key: string): Promise<Blob | null> {
  if (cache.has(key)) return cache.get(key)!
  await ensureKeys()
  if (!knownKeys.has(key)) {
    cache.set(key, null)
    return null
  }
  try {
    const db = await openDb()
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(key)
      req.onsuccess = () => resolve((req.result as Blob) ?? null)
      req.onerror = () => reject(req.error)
    })
    cache.set(key, blob)
    return blob
  } catch {
    return null
  }
}

export async function getRecordingUrl(key: string): Promise<string | null> {
  if (urlCache.has(key)) return urlCache.get(key)!
  const blob = await getRecording(key)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  urlCache.set(key, url)
  return url
}

export async function saveRecording(key: string, blob: Blob): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(blob, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  cache.set(key, blob)
  const old = urlCache.get(key)
  if (old) URL.revokeObjectURL(old)
  urlCache.delete(key)
  await ensureKeys()
  knownKeys.add(key)
}

export async function deleteRecording(key: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  cache.set(key, null)
  const old = urlCache.get(key)
  if (old) URL.revokeObjectURL(old)
  urlCache.delete(key)
  await ensureKeys()
  knownKeys.delete(key)
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve((r.result as string).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

export function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}
