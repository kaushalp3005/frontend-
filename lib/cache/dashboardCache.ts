/**
 * Generic stale-while-revalidate cache for dashboards.
 *
 * Each dashboard stores its last successful payload in localStorage under a
 * unique key. On open it paints instantly from this cache, then revalidates in
 * the background — so the skeleton only shows on the very first ever visit.
 *
 * Storage failures (quota, serialization, SSR) degrade silently: the dashboard
 * simply falls back to a normal load with no instant paint.
 */

export interface Cached<T> {
  payload: T
  savedAt: number
}

export function readDashboardCache<T>(key: string): Cached<T> | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Cached<T>
    if (!parsed || typeof parsed !== "object" || !("payload" in parsed)) return null
    return parsed
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
