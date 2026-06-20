/**
 * Category / sub-category / material canonicalization.
 *
 * Purpose: collapse buckets that differ ONLY by case, surrounding whitespace,
 * internal spacing, or hyphen/underscore separators — so "FARD", "fard" and
 * " Fard " group together, and "Medjoul-General" and "Medjoul General" group
 * together. Genuinely different names ("Medjoul" vs "Medjoul General") stay
 * separate. No semantic merges.
 *
 * Mirrors the alias-map shape of lib/customers/canonicalize.ts and
 * lib/constants/warehouses.ts, but the alias map is empty by default — a hook
 * for future curated merges, intentionally unseeded.
 */

// Future hook: canonical label -> [raw variants]. Empty by design.
export const CATEGORY_ALIASES: Record<string, string[]> = {}

/**
 * Lowercase, trim, collapse internal whitespace, and normalize hyphen/underscore
 * separators to a single space. Used for equality/bucketing.
 */
export function normalizeCategory(raw: string | null | undefined): string {
  if (!raw) return ""
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim()
}

/** Title-case a normalized string for display. */
function titleCase(s: string): string {
  if (!s) return s
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Return the canonical display label for a raw category-like value.
 *  1. empty -> ""
 *  2. normalize (case / spacing / separators)
 *  3. alias match -> canonical key (verbatim)   [no-op while map is empty]
 *  4. else Title Case of the normalized form
 */
export function canonicalizeCategory(raw: string | null | undefined): string {
  const normalized = normalizeCategory(raw)
  if (!normalized) return ""
  for (const [canonical, variants] of Object.entries(CATEGORY_ALIASES)) {
    if (normalizeCategory(canonical) === normalized) return canonical
    for (const v of variants) {
      if (normalizeCategory(v) === normalized) return canonical
    }
  }
  return titleCase(normalized)
}
