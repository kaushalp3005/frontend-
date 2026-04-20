"use client"

import { useEffect, useRef, useState } from "react"

// Drop-in useState replacement that syncs the value to sessionStorage under a
// namespaced key. Filters persisted this way survive browser back/forward
// navigation within the tab without relying on URL params.
//
// Use per-page keys (e.g. "inward-dashboard:dateFrom") so distinct pages don't
// collide. Sets fall back to plain useState behavior when sessionStorage is
// unavailable (SSR, private browsing, quota errors).

export function usePersistedState<T>(
  storageKey: string,
  initial: T,
  options: {
    // Serialize/deserialize overrides. Default is JSON. Pass custom ones if
    // the value has Sets / Maps which don't JSON-roundtrip cleanly.
    serialize?: (v: T) => string
    deserialize?: (raw: string) => T
  } = {},
): [T, (v: T | ((prev: T) => T)) => void] {
  const { serialize = JSON.stringify, deserialize } = options
  const defaultDeserialize: (raw: string) => T = deserialize ?? (raw => JSON.parse(raw))
  const hydrated = useRef(false)

  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial
    try {
      const raw = window.sessionStorage.getItem(storageKey)
      if (raw === null) return initial
      return defaultDeserialize(raw)
    } catch {
      return initial
    }
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    // Skip the first effect — initial value either came from storage or from
    // the default. Only write on subsequent setValue calls.
    if (!hydrated.current) {
      hydrated.current = true
      return
    }
    try {
      window.sessionStorage.setItem(storageKey, serialize(value))
    } catch {
      // sessionStorage full, disabled, etc. — silently drop.
    }
    // `serialize` is deliberately excluded: callers pass stable references or
    // the default; re-running on identity changes would just thrash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, value])

  return [value, setValue]
}

// Helper for Set<string> filter state — JSON can't roundtrip Sets directly.
export const setSerializers = {
  serialize: (s: Set<string>) => JSON.stringify(Array.from(s)),
  deserialize: (raw: string): Set<string> => {
    try {
      const arr = JSON.parse(raw)
      return new Set(Array.isArray(arr) ? arr.filter(x => typeof x === "string") : [])
    } catch {
      return new Set()
    }
  },
}
