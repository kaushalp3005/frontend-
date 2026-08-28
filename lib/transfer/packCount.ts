/**
 * Packs held by ONE box, as the direct-transfer form's editable "UPS/Count" field.
 *
 * Prefer the count recorded against that box at dispatch. Fall back to the line's
 * nominal packs-per-box only when the box carries none — every transfer saved before
 * the count was persisted, and every line-only entry that has no real box behind it.
 *
 * Reading the nominal first did more than mis-display a part box. The form posts this
 * field straight back as pack_count, so reloading a dispatch and saving it overwrote
 * the recorded count with the nominal one: box 19 of TRANS202608261534 holds 1,600 of
 * a nominal 5,000, and the challan printed 19 x 5,000 = 95,000 against a true 91,600.
 */
export function boxPackSize(box: any, matchedLine?: any): string {
  const recorded = parseFloat(String(box?.pack_count ?? ""))
  if (Number.isFinite(recorded) && recorded > 0) return String(recorded)
  const nominal = matchedLine?.unit_pack_size
  return nominal != null && String(nominal) !== "" ? String(nominal) : "0"
}
