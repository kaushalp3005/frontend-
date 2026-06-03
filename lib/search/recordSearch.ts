/**
 * Shared record-level "smart search" used across every dashboard
 * (transfer, inward, cold-storage, RTV, job-work).
 *
 * Behaviour:
 *  - The query is split into whitespace-separated terms.
 *  - A record matches only if EVERY term is found somewhere in its searchable
 *    fields (AND semantics) — so "rishi medjoul" narrows to rows mentioning both.
 *  - Matching is case-insensitive substring matching.
 *  - An empty query matches everything.
 *
 * Each dashboard passes the list of fields on its own record type that should be
 * searchable (lot number, challan/transaction/grn no, item/article, warehouse,
 * vehicle, driver, created-by, status, etc.).
 */

export function parseSearchTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

/** Concatenate the chosen fields of a record into one lowercase haystack. */
export function buildHaystack(record: Record<string, unknown>, fields: string[]): string {
  let s = ""
  for (const f of fields) {
    const v = record[f]
    if (v === null || v === undefined) continue
    s += String(v) + " "
  }
  return s.toLowerCase()
}

/** True when every term in `terms` appears in `haystack`. Empty terms → true. */
export function matchesAllTerms(haystack: string, terms: string[]): boolean {
  if (terms.length === 0) return true
  return terms.every((t) => haystack.includes(t))
}

/**
 * Build a reusable predicate for a query over a fixed set of fields.
 * Terms are parsed once; an empty query yields a predicate that accepts all.
 *
 *   const match = makeRecordSearch<TransferRecord>(searchQuery, SEARCH_FIELDS)
 *   const hits = records.filter(match)
 */
// Note: no `T extends Record<string, unknown>` constraint — TypeScript interfaces
// (e.g. TransferRecord) lack an implicit index signature and would not satisfy it.
// `keyof T & string` still gives compile-time field-name safety; we cast to a
// record only for the structural haystack read.
export function makeRecordSearch<T>(
  query: string,
  fields: (keyof T & string)[],
): (record: T) => boolean {
  const terms = parseSearchTerms(query)
  if (terms.length === 0) return () => true
  return (record: T) =>
    matchesAllTerms(buildHaystack(record as Record<string, unknown>, fields), terms)
}
