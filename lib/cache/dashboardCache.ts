/**
 * Generic stale-while-revalidate cache for dashboards.
 *
 * Each dashboard stores its last successful payload in localStorage under a
 * unique key. On open it paints instantly from this cache, then revalidates in
 * the background — so the skeleton only shows on the very first ever visit.
 *
 * AGE IS ENFORCED, NOT JUST RECORDED.
 * `savedAt` used to be written and never read, so a cached payload was served
 * however old it was. If the background revalidate then failed — expired token,
 * backend asleep, offline — the dashboard kept painting days-old numbers with
 * nothing on screen to say so. Reads now take a max age and return null past it,
 * which forces a real load rather than showing stale stock as if it were live.
 *
 * Storage failures (quota, serialization, SSR) degrade silently: the dashboard
 * simply falls back to a normal load with no instant paint.
 */

export interface Cached<T> {
  payload: T
  savedAt: number
  /** How old the payload is, in ms, at the moment it was read. */
  ageMs: number
}

/** Instant paint is only worth it while the data is plausibly still current. */
export const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000

export function readDashboardCache<T>(
  key: string,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): Cached<T> | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { payload: T; savedAt?: number }
    if (!parsed || typeof parsed !== "object" || !("payload" in parsed)) return null

    const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : 0
    const ageMs = Date.now() - savedAt
    // No timestamp means it was written by the previous version of this module;
    // treat it as expired rather than trusting an unknown age.
    if (!savedAt || ageMs > maxAgeMs) {
      window.localStorage.removeItem(key)
      return null
    }
    return { payload: parsed.payload, savedAt, ageMs }
  } catch {
    return null
  }
}

export function writeDashboardCache<T>(key: string, payload: T): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, JSON.stringify({ payload, savedAt: Date.now() }))
  } catch {
    // Quota exceeded / serialization failure — degrade silently (no instant paint).
  }
}

export function clearDashboardCache(key: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}
