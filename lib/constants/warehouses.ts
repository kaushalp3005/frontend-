/**
 * Warehouse configuration — single source of truth
 * All warehouse Selects across the app pull from here.
 */

export type WarehouseType = "regular" | "cold"

export interface WarehouseConfig {
  name: string
  address: string
  type: WarehouseType
}

export const WAREHOUSES: Record<string, WarehouseConfig> = {
  W202: {
    name: "Warehouse W202",
    address: "W-202, MIDC TTC Industrial area, Khairane, Navi Mumbai, Maharashtra 400710",
    type: "regular",
  },
  A185: {
    name: "Warehouse A185",
    address: "A-185, MIDC TTC Industrial area, Khairane, Navi Mumbai, Maharashtra 400709",
    type: "regular",
  },
  A101: {
    name: "Warehouse A101",
    address: "A-101, MIDC TTC Industrial area, Khairane, Navi Mumbai, Maharashtra 400709",
    type: "regular",
  },
  A68: {
    name: "Warehouse A68",
    address: "A-68, MIDC TTC Industrial area, Khairane, Navi Mumbai, Maharashtra 400709",
    type: "regular",
  },
  F53: {
    name: "Warehouse F53",
    address: "F53, APMC Masala Market, APMC Market, Sector 19, Vashi, Navi Mumbai, Maharashtra 400703",
    type: "regular",
  },
  "Savla D-39": {
    name: "Savla D-39 Cold Storage",
    address: "Savla D-39, MIDC TTC Industrial area, Khairane, Navi Mumbai, Maharashtra 400709",
    type: "cold",
  },
  "Savla D-514": {
    name: "Savla D-514 Cold Storage",
    address: "Savla D-514, MIDC TTC Industrial area, Khairane, Navi Mumbai, Maharashtra 400709",
    type: "cold",
  },
  Rishi: {
    name: "Rishi Cold Storage",
    address: "Rishi, MIDC TTC Industrial area, Khairane, Navi Mumbai, Maharashtra 400709",
    type: "cold",
  },
  Supreme: {
    name: "Supreme Cold Storage",
    address: "MIDC, Turbhe",
    type: "cold",
  },
}

/**
 * Alias mapping for cold storage warehouse names.
 * Multiple legacy / display names point to a single canonical warehouse code.
 * Lookup is case-insensitive and whitespace-tolerant.
 *
 * CANONICAL CODES stored here match the backend DB values — do not rename
 * without coordinating the DB migration. For user-facing display, use
 * getDisplayWarehouseName() which maps canonical codes to the preferred
 * display form (Savla D-39 / Savla D-514 / Rishi / Supreme Cold).
 */
export const WAREHOUSE_ALIASES: Record<string, string> = {
  // Savla D-39 aliases (canonical code stays "Savla D-39")
  "savla": "Savla D-39",
  "savla d-39": "Savla D-39",
  "savla d39": "Savla D-39",
  "savla-d39": "Savla D-39",
  "savla-d-39": "Savla D-39",
  "savla d-39 cold": "Savla D-39",
  "savla d39 cold": "Savla D-39",
  "old savla": "Savla D-39",
  "savla bond": "Savla D-39",
  "d-39": "Savla D-39",
  "d39": "Savla D-39",

  // Savla D-514 aliases (canonical code stays "Savla D-514")
  "savla d-514": "Savla D-514",
  "savla d514": "Savla D-514",
  "savla-d514": "Savla D-514",
  "savla-d-514": "Savla D-514",
  "savla d-514 cold": "Savla D-514",
  "savla d514 cold": "Savla D-514",
  "d-514": "Savla D-514",
  "d514": "Savla D-514",
  "new savla": "Savla D-514",

  // Rishi aliases (canonical code stays "Rishi")
  "rishi": "Rishi",
  "rishi cold": "Rishi",
  "rishi cold storage": "Rishi",
  "rishi cold storage pvt ltd": "Rishi",

  // Supreme aliases (canonical code stays "Supreme")
  "supreme": "Supreme",
  "supreme cold": "Supreme",
  "supreme cold storage": "Supreme",
}

/**
 * Display-name overrides. Canonical code → preferred user-facing label.
 * Applied by getDisplayWarehouseName(); everything else (storage, API calls,
 * filter equality) keeps using the canonical code.
 */
export const WAREHOUSE_DISPLAY_NAMES: Record<string, string> = {
  "Savla D-39": "Savla D-39",
  "Savla D-514": "Savla D-514",
  "Rishi": "Rishi",
  "Supreme": "Supreme Cold",
}

/** User-to-warehouse default mapping. "ALL" means no filter applied. */
export const USER_WAREHOUSE_DEFAULTS: Record<string, string[]> = {
  "Vaibhav Kumkar": ["W202", "Savla D-39", "Savla D-514", "Rishi", "Supreme"],
  "Samal Kumar": ["W202"],
  "Sumit Baikar": ["A185"],
  "Amit Jadhav": ["A185"],
  "Pankaj Ranga": ["A68"],
  "Vaishali Dhuri": ["A68"],
  "Naresh": ["F53"],
  "Hrithik": ["ALL"],
}

// ── Helpers ──────────────────────────────────────────────────

export const getAllWarehouseCodes = (): string[] => Object.keys(WAREHOUSES)

export const getRegularWarehouseCodes = (): string[] =>
  Object.entries(WAREHOUSES).filter(([, w]) => w.type === "regular").map(([code]) => code)

export const getColdWarehouseCodes = (): string[] =>
  Object.entries(WAREHOUSES).filter(([, w]) => w.type === "cold").map(([code]) => code)

export const isColdWarehouse = (code: string): boolean =>
  WAREHOUSES[code]?.type === "cold" ?? false

export const getWarehouseName = (code: string): string =>
  WAREHOUSE_DISPLAY_NAMES[code] || WAREHOUSES[code]?.name || code

export const getWarehouseAddress = (code: string): string =>
  WAREHOUSES[code]?.address || "Address not available"

/** Get default warehouse codes for a user. Returns empty array for "ALL" (no filter).
 *  Lookup is case-insensitive and tolerates extra whitespace in the user's name. */
export const getUserDefaultWarehouses = (userName: string | null | undefined): string[] => {
  if (!userName) return []
  const normalized = userName.trim().replace(/\s+/g, " ").toLowerCase()
  const entry = Object.entries(USER_WAREHOUSE_DEFAULTS).find(
    ([key]) => key.trim().replace(/\s+/g, " ").toLowerCase() === normalized,
  )
  if (!entry) return []
  const defaults = entry[1]
  if (!defaults || defaults.includes("ALL")) return []
  return defaults
}

/** Check if user has any cold storage warehouses in their defaults. */
export const userHasColdAccess = (userName: string): boolean => {
  const defaults = USER_WAREHOUSE_DEFAULTS[userName] || []
  if (defaults.includes("ALL")) return true
  return defaults.some((code) => WAREHOUSES[code]?.type === "cold")
}

/**
 * Normalize a raw warehouse/storage_location string to its canonical code.
 * Handles case-insensitive alias lookup and trims whitespace.
 * Returns the canonical code if matched, otherwise returns the original string
 * with whitespace trimmed (preserves unknown names for display).
 */
export const normalizeWarehouseName = (raw: string | null | undefined): string => {
  if (!raw) return ""
  const trimmed = String(raw).trim()
  if (!trimmed) return ""
  // Normalize underscores to spaces so DB values like "old_savla" match aliases
  const lowerKey = trimmed.toLowerCase().replace(/_/g, " ")
  // First check aliases
  if (WAREHOUSE_ALIASES[lowerKey]) return WAREHOUSE_ALIASES[lowerKey]
  // Then check direct match (case-insensitive) against canonical codes
  const canonical = Object.keys(WAREHOUSES).find((code) => code.toLowerCase() === lowerKey)
  if (canonical) return canonical
  // Unknown — return trimmed original
  return trimmed
}

/**
 * Get the display label for a warehouse, applying normalization first AND the
 * display-name override. Preferred entry point for anything user-facing.
 *   "savla d-39 cold"       → "Savla-D39"
 *   "savla bond"            → "Savla-D39"
 *   "Savla D-39"            → "Savla-D39"
 *   "Rishi Cold Storage"    → "Rishi Cold"
 *   "Supreme"               → "Supreme Cold"
 *   "W202"                  → "W202"   (no override configured — passthrough)
 */
export const getDisplayWarehouseName = (raw: string | null | undefined): string => {
  const code = normalizeWarehouseName(raw)
  if (!code) return ""
  return WAREHOUSE_DISPLAY_NAMES[code] || code
}

/**
 * Legacy helper kept for existing call sites. Now routes through the display
 * mapping so legacy callers automatically pick up the new cold-storage labels
 * without code changes at every usage site.
 */
export const getNormalizedWarehouseLabel = (raw: string | null | undefined): string => {
  const display = getDisplayWarehouseName(raw)
  return display || "Unassigned"
}

// Backwards-compatible exports
export type WarehouseAddress = { name: string; address: string }
export const WAREHOUSE_ADDRESSES: Record<string, WarehouseAddress> = Object.fromEntries(
  Object.entries(WAREHOUSES).map(([code, config]) => [code, { name: config.name, address: config.address }])
)
export const getWarehouseCodes = getAllWarehouseCodes
