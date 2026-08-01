"use client"

/**
 * Says how current the numbers on screen actually are.
 *
 * Without this a dashboard that quietly failed to refresh looks exactly like one
 * that just refreshed — which is how days-old cold storage figures were read as
 * live. When a refresh fails this turns amber and says so, because silently
 * showing an old number is worse than admitting the number is old.
 */

import { useEffect, useState } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

function ago(from: Date, now: number): string {
  const s = Math.max(0, Math.round((now - from.getTime()) / 1000))
  if (s < 10) return "just now"
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export interface DataFreshnessProps {
  lastUpdated: Date | null
  refreshing?: boolean
  failed?: boolean
  error?: string | null
  onRefresh?: () => void
  className?: string
}

export function DataFreshness({
  lastUpdated,
  refreshing = false,
  failed = false,
  error = null,
  onRefresh,
  className = "",
}: DataFreshnessProps) {
  // Ticks so "2 min ago" keeps counting up without the parent re-rendering.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  const label = refreshing
    ? "Refreshing…"
    : lastUpdated
      ? `Updated ${ago(lastUpdated, now)}`
      : "Not loaded yet"

  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      {failed ? (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-300
                     bg-amber-50 px-2.5 py-1 font-medium text-amber-800
                     dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300"
          title={error || "The last refresh failed"}
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          Showing older data — refresh failed
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <span
            className={`h-1.5 w-1.5 rounded-full ${refreshing ? "bg-sky-500 animate-pulse" : "bg-emerald-500"}`}
            aria-hidden="true"
          />
          {label}
        </span>
      )}

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1 rounded-md border border-transparent px-1.5 py-1
                     text-muted-foreground transition-colors hover:bg-muted hover:text-foreground
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                     disabled:opacity-50"
          aria-label="Refresh now"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Refresh</span>
        </button>
      )}
    </div>
  )
}

export default DataFreshness
