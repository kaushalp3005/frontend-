/**
 * Customer name canonicalization.
 *
 * Required behaviours (validated through dashboard use, no test runner in repo):
 *  - "Reliance Retail", "Reliance Retail Ltd", "Reliance Retail Pvt Ltd",
 *    "RELIANCE RETAIL PVT", "RELIANCE RETAIL PVT LTD" all collapse to one canonical bucket.
 *  - "Reliance Retail" and "Reliance Digital" remain in separate buckets.
 *  - Empty alias map -> pure normalization behaviour.
 *  - Alias map forces merge when normalization alone would not.
 *  - Idempotence: canonicalize(canonicalize(x)) === canonicalize(x).
 *  - Whitespace/case resilience: "  RELIANCE   RETAIL  " and "reliance retail" collapse.
 *  - Empty/null input returns the input unchanged (no throw).
 */

// Trailing legal suffixes stripped during normalization.
// Order matters: longer phrases first so "private limited" beats "limited".
const LEGAL_SUFFIXES = [
  "private limited",
  "pvt ltd",
  "pvt limited",
  "private ltd",
  "pvt",
  "limited",
  "ltd",
  "llp",
  "incorporated",
  "inc",
  "corporation",
  "corp",
  "company",
  "co",
]

const TRAILING_PUNCT_RE = /[.,;:]+$/

/**
 * Lowercase, collapse whitespace, strip trailing punctuation, strip trailing
 * legal suffixes repeatedly until stable.
 */
export function normalize(name: string | null | undefined): string {
  if (!name) return name ?? ""
  let s = name.toLowerCase().trim().replace(/\s+/g, " ")
  let changed = true
  while (changed) {
    changed = false
    s = s.replace(TRAILING_PUNCT_RE, "").trim()
    for (const suffix of LEGAL_SUFFIXES) {
      if (s === suffix) break // don't strip if the entire name IS the suffix
      if (s.endsWith(" " + suffix)) {
        s = s.slice(0, s.length - suffix.length - 1).trim()
        changed = true
        break
      }
    }
  }
  return s
}

/**
 * Convert a normalized name to Title Case for display.
 */
function titleCase(s: string): string {
  if (!s) return s
  return s
    .split(" ")
    .map(w => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ")
}

/**
 * Return the canonical display name for a raw customer name.
 *
 * 1. normalize() the input.
 * 2. Check the alias map: if any alias key has a variant whose normalized
 *    form equals the normalized input (case-insensitive), return the alias key verbatim.
 * 3. Otherwise, return Title Case of the normalized input.
 */
export function canonicalize(
  name: string | null | undefined,
  aliases: Record<string, string[]> = {},
): string {
  if (!name) return name ?? ""
  const normalized = normalize(name)
  if (!normalized) return name
  for (const [canonical, variants] of Object.entries(aliases)) {
    for (const v of variants) {
      if (normalize(v) === normalized) return canonical
    }
    if (normalize(canonical) === normalized) return canonical
  }
  return titleCase(normalized)
}

/**
 * Group a list of raw customer names by their canonical form.
 * Returns Map<canonicalName, rawVariants[]> with rawVariants deduplicated
 * and keys sorted by raw-variant count desc then alphabetically.
 */
export function groupByCanonical(
  names: string[],
  aliases: Record<string, string[]> = {},
): Map<string, string[]> {
  const bucket = new Map<string, Set<string>>()
  for (const raw of names) {
    if (!raw) continue
    const can = canonicalize(raw, aliases)
    if (!bucket.has(can)) bucket.set(can, new Set())
    bucket.get(can)!.add(raw)
  }
  const entries = Array.from(bucket.entries()).map(([can, set]) => [can, Array.from(set)] as [string, string[]])
  entries.sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length
    return a[0].localeCompare(b[0])
  })
  return new Map(entries)
}
