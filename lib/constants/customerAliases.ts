// Map of canonical display name -> raw variant names that should collapse into it.
// Matching is done AFTER normalize() runs against the raw variants, and comparison
// is case-insensitive. Add entries here only for cases where suffix-stripping alone
// cannot merge two customer names (e.g., two completely different names for the
// same legal entity). Map starts empty; extend manually as clusters are spotted.
export const CUSTOMER_ALIASES: Record<string, string[]> = {
  // "DMart": ["AVENUE SUPERMART", "Avenue Supermarts"],
}
