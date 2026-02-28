"use client"

import { useEffect, useRef, useCallback } from "react"

interface StateEntry {
  value: any
  setter: (val: any) => void
}

/**
 * Persists form state to localStorage and restores it on mount.
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
        for (const [field, entry] of Object.entries(stateMap)) {
          if (parsed[field] !== undefined) {
            entry.setter(parsed[field])
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
        const snapshot: Record<string, any> = {}
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
