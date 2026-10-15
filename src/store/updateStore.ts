/**
 * Self-update for the sideloaded Android APK.
 *
 * CI publishes the newest build to the "latest-apk" GitHub release together with
 * a small version.json. The app compares that build number with its own and, when
 * a newer one exists, offers the parent a download link. The download opens in the
 * phone's browser; Android's installer then updates the app in place, which keeps
 * all app data (the child's progress) because every published build is signed with
 * the same key.
 *
 * Only builds made for that channel set VITE_UPDATE_URL, so the web version and
 * Play Store builds never check (Play updates apps itself).
 */
import { create } from 'zustand'
import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'

export interface LatestBuild {
  versionCode: number
  versionName: string
  apkUrl: string
}

export type UpdateStatus = 'disabled' | 'idle' | 'checking' | 'upToDate' | 'available' | 'error'

interface UpdateState {
  enabled: boolean
  status: UpdateStatus
  /** This install's build, read from the native app. */
  current: { versionCode: number; versionName: string } | null
  latest: LatestBuild | null
  lastCheckAt: number | null
  /** Ask the server for the newest build. Without force, skips if checked recently. */
  check: (force?: boolean) => Promise<void>
}

const UPDATE_URL = import.meta.env.VITE_UPDATE_URL as string | undefined
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000
const CACHE_KEY = 'reader-quest-update-check'

/** Validate the version.json payload (GitHub may serve it as text or JSON). */
export function parseLatest(data: unknown): LatestBuild | null {
  let v = data
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v)
    } catch {
      return null
    }
  }
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const versionCode = Number(o.versionCode)
  if (!Number.isInteger(versionCode) || versionCode < 1) return null
  if (typeof o.apkUrl !== 'string' || !o.apkUrl.startsWith('https://')) return null
  return { versionCode, versionName: typeof o.versionName === 'string' ? o.versionName : String(versionCode), apkUrl: o.apkUrl }
}

export function isNewer(latest: LatestBuild | null, current: { versionCode: number } | null): boolean {
  return Boolean(latest && current && latest.versionCode > current.versionCode)
}

function readCache(): { at: number; latest: LatestBuild | null } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as { at?: unknown; latest?: unknown }
    return typeof o.at === 'number' ? { at: o.at, latest: parseLatest(o.latest) } : null
  } catch {
    return null
  }
}
function writeCache(at: number, latest: LatestBuild | null) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at, latest }))
  } catch {
    // Storage unavailable: we simply check again next time.
  }
}

let currentPromise: Promise<UpdateState['current']> | null = null
function readCurrent(): Promise<UpdateState['current']> {
  currentPromise ??= CapApp.getInfo()
    .then((info) => ({ versionCode: Number(info.build) || 0, versionName: info.version }))
    .catch(() => null)
  return currentPromise
}

const enabled = Boolean(UPDATE_URL) && Capacitor.isNativePlatform()
const cached = enabled ? readCache() : null

export const useUpdate = create<UpdateState>(() => ({
  enabled,
  status: enabled ? 'idle' : 'disabled',
  current: null,
  latest: cached?.latest ?? null,
  lastCheckAt: cached?.at ?? null,
  check: (force = false) => {
    if (!useUpdate.getState().enabled) return Promise.resolve()
    // App start and the first "resume" event can ask at the same moment: share one request.
    inflight ??= runCheck(force).finally(() => {
      inflight = null
    })
    return inflight
  },
}))

let inflight: Promise<void> | null = null
async function runCheck(force: boolean) {
  const { setState: set } = useUpdate
  const current = useUpdate.getState().current ?? (await readCurrent())
  const { lastCheckAt, latest: known } = useUpdate.getState()
  if (!force && lastCheckAt && Date.now() - lastCheckAt < CHECK_EVERY_MS) {
    set({ current, status: isNewer(known, current) ? 'available' : 'upToDate' })
    return
  }
  set({ current, status: 'checking' })
  try {
    // Native HTTP: the release download redirects to a CDN without CORS headers.
    const res = await CapacitorHttp.get({ url: UPDATE_URL!, headers: { 'Cache-Control': 'no-cache' }, responseType: 'text', connectTimeout: 10000, readTimeout: 10000 })
    const latest = res.status === 200 ? parseLatest(res.data) : null
    if (!latest) throw new Error(`Unexpected response (${res.status})`)
    const now = Date.now()
    writeCache(now, latest)
    set({ latest, lastCheckAt: now, status: isNewer(latest, current) ? 'available' : 'upToDate' })
  } catch {
    set({ status: isNewer(known, current) ? 'available' : 'error' })
  }
}

/** Hand the APK link to Android: Capacitor opens non-app URLs in the default browser. */
export function openDownload(latest: LatestBuild) {
  window.location.assign(latest.apkUrl)
}

if (enabled) {
  void useUpdate.getState().check()
  void CapApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive) void useUpdate.getState().check()
  })
}
