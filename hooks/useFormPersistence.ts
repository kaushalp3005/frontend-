"use client"

import { useEffect, useRef, useCallback } from "react"

interface StateEntry {
  value: any
  setter: (val: any) => void
}

const MAX_AGE_MS = 60 * 60 * 1000 // 1 hour — discard drafts older than this

/**
 * Persists form state to localStorage and restores it on mount.
 * Data expires after 1 hour to avoid loading stale entries.
 *
 * @param key - localStorage key for this form's draft
 * @param stateMap - Record of { fieldName: { value, setter } } for each piece of state to persist
 */
export function useFormPersistence(
  key: string,
  stateMap: Record<string, StateEntry>
) {
  const isRestoredRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Restore from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const saved = localStorage.getItem(key)
      if (saved) {
        const parsed = JSON.parse(saved)
        const savedAt = parsed.__savedAt
        // Discard if older than MAX_AGE_MS
        if (savedAt && Date.now() - savedAt > MAX_AGE_MS) {
          localStorage.removeItem(key)
        } else {
          for (const [field, entry] of Object.entries(stateMap)) {
            if (field !== "__savedAt" && parsed[field] !== undefined) {
              entry.setter(parsed[field])
            }
          }
        }
      }
    } catch {
      // Ignore corrupt data
    }
    isRestoredRef.current = true
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save to localStorage on state changes (debounced)
  useEffect(() => {
    if (!isRestoredRef.current) return
    if (typeof window === "undefined") return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      try {
        const snapshot: Record<string, any> = { __savedAt: Date.now() }
        for (const [field, entry] of Object.entries(stateMap)) {
          snapshot[field] = entry.value
        }
        localStorage.setItem(key, JSON.stringify(snapshot))
      } catch {
        // Ignore quota errors
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // Re-run when any value changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...Object.values(stateMap).map((e) => e.value)])

  const clearSavedData = useCallback(() => {
    if (typeof window === "undefined") return
    localStorage.removeItem(key)
  }, [key])

  return { clearSavedData }
}
