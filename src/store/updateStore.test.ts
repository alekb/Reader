import { describe, expect, it } from 'vitest'
import { isNewer, parseLatest, useUpdate } from './updateStore'

describe('self-update', () => {
  const good = { versionCode: 58, versionName: '1.0.58', apkUrl: 'https://github.com/o/r/releases/download/latest-apk/reader-quest.apk' }

  it('parses version.json served as JSON or as text', () => {
    expect(parseLatest(good)).toEqual(good)
    expect(parseLatest(JSON.stringify(good))).toEqual(good)
    expect(parseLatest({ ...good, versionCode: '58' })?.versionCode).toBe(58)
  })

  it('rejects malformed payloads', () => {
    expect(parseLatest('<html>Not Found</html>')).toBeNull()
    expect(parseLatest(null)).toBeNull()
    expect(parseLatest({ ...good, versionCode: 0 })).toBeNull()
    expect(parseLatest({ ...good, versionCode: 1.5 })).toBeNull()
    expect(parseLatest({ ...good, apkUrl: 'http://insecure/app.apk' })).toBeNull()
    expect(parseLatest({ ...good, apkUrl: undefined })).toBeNull()
  })

  it('offers an update only for a higher build number', () => {
    const latest = parseLatest(good)
    expect(isNewer(latest, { versionCode: 57 })).toBe(true)
    expect(isNewer(latest, { versionCode: 58 })).toBe(false)
    expect(isNewer(latest, { versionCode: 99 })).toBe(false)
    expect(isNewer(latest, null)).toBe(false)
    expect(isNewer(null, { versionCode: 1 })).toBe(false)
  })

  it('stays off outside the Android app', async () => {
    expect(useUpdate.getState().enabled).toBe(false)
    await useUpdate.getState().check(true)
    expect(useUpdate.getState().status).toBe('disabled')
  })
})
