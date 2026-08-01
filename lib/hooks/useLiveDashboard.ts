"use client"

/**
 * Keeps a dashboard live without changing how it loads its data.
 *
 * The dashboards each own their own fetch; this owns only the TRIGGERS and the
 * freshness state, so wiring it in is a few lines rather than a rewrite.
 *
 * A dashboard used to refresh on mount and never again: a tab left open all
 * afternoon showed the morning's numbers, and a background refresh that failed
 * was swallowed so the stale figures looked current. This re-fetches when the
 * data has any reason to have moved —
 *
 *   · on an interval, but only while the tab is actually visible (a backgrounded
 *     tab polling the API all night is just load with nobody reading it)
 *   · when the tab is brought back to the foreground, and immediately if it was
 *     hidden longer than the interval
 *   · when the window regains focus after the user was in another app
 *   · when the browser comes back online
 *
 * and it reports WHEN the data was last confirmed, so "live" is something the
 * reader can verify rather than assume.
 */

import { useCallback, useEffect, useRef, useState } from "react"

export interface LiveDashboardOptions {
  /** How often to re-check while the tab is visible. Default 60s. */
  intervalMs?: number
  /** Pause everything (e.g. while a modal is open, or before auth resolves). */
  enabled?: boolean
  /** Refresh when the tab becomes visible again. Default true. */
  refreshOnFocus?: boolean
}

export interface LiveDashboardState {
  /** When the last successful refresh completed. */
  lastUpdated: Date | null
  /** A refresh is in flight. */
  refreshing: boolean
  /** The last refresh failed — the numbers on screen are older than they look. */
  refreshFailed: boolean
  /** Message from the last failure, if any. */
  refreshError: string | null
  /** Force a refresh now. */
  refresh: () => Promise<void>
  /** Record a successful load the hook did not perform itself (e.g. first paint). */
  markUpdated: (at?: Date) => void
}

export function useLiveDashboard(
  onRefresh: () => Promise<unknown>,
  { intervalMs = 60_000, enabled = true, refreshOnFocus = true }: LiveDashboardOptions = {},
): LiveDashboardState {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  // Held in refs so changing the fetcher identity does not restart the timers,
  // and so only one refresh can be in flight at a time.
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh
  const inFlight = useRef(false)
  const hiddenSince = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setRefreshing(true)
    try {
      await onRefreshRef.current()
      setLastUpdated(new Date())
      setRefreshError(null)
    } catch (err) {
      // Surfaced, not swallowed: the caller shows a banner so nobody reads a
      // stale figure believing it is current.
      setRefreshError(err instanceof Error ? err.message : "Refresh failed")
    } finally {
      inFlight.current = false
      setRefreshing(false)
    }
  }, [])

  const markUpdated = useCallback((at?: Date) => {
    setLastUpdated(at ?? new Date())
    setRefreshError(null)
  }, [])

  // Interval — visible tabs only.
  useEffect(() => {
    if (!enabled || intervalMs <= 0) return
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh()
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [enabled, intervalMs, refresh])

  // Foreground / focus / reconnect.
  useEffect(() => {
    if (!enabled || !refreshOnFocus) return

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenSince.current = Date.now()
        return
      }
      // Coming back: refresh straight away if we were away long enough that the
      // figures could plausibly have moved.
      const away = hiddenSince.current ? Date.now() - hiddenSince.current : Infinity
      hiddenSince.current = null
      if (away >= Math.min(intervalMs, 30_000)) void refresh()
    }
    const onFocus = () => {
      if (document.visibilityState === "visible") void refresh()
    }

    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("online", onFocus)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("online", onFocus)
    }
  }, [enabled, refreshOnFocus, intervalMs, refresh])

  return {
    lastUpdated,
    refreshing,
    refreshFailed: refreshError !== null,
    refreshError,
    refresh,
    markUpdated,
  }
}
