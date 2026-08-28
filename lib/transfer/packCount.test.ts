import { describe, it, expect } from "vitest"
import { boxPackSize } from "./packCount"

// Reloading a dispatch for edit must offer the count each box actually holds. Seeding
// the line's nominal packs-per-box instead does not merely mis-display it: the form
// posts the field straight back as pack_count, so opening a transfer and saving it
// overwrites a recorded part box with a full one.
describe("boxPackSize", () => {
  it("keeps the count recorded against a part box", () => {
    // ART-13 of TRANS202608271304 holds 4,030 of a nominal 5,000.
    expect(boxPackSize({ pack_count: "4030.0" }, { unit_pack_size: "5000.000" })).toBe("4030")
  })

  it("keeps the recorded count on a full box too", () => {
    expect(boxPackSize({ pack_count: "5000.0" }, { unit_pack_size: "5000.000" })).toBe("5000")
  })

  it("falls back to the line nominal when the box carries no count", () => {
    // Every dispatch made before the count was persisted, TRANS202608261534 included.
    expect(boxPackSize({ pack_count: null }, { unit_pack_size: "5000.000" })).toBe("5000.000")
    expect(boxPackSize({}, { unit_pack_size: "5000.000" })).toBe("5000.000")
  })

  it("treats an unusable recorded count as absent", () => {
    for (const bad of ["", "0", "abc", "-5", null, undefined]) {
      expect(boxPackSize({ pack_count: bad }, { unit_pack_size: "1500" })).toBe("1500")
    }
  })

  it("returns 0 when neither the box nor the line offers a count", () => {
    expect(boxPackSize({}, {})).toBe("0")
    expect(boxPackSize({}, undefined)).toBe("0")
    expect(boxPackSize({ pack_count: null }, { unit_pack_size: "" })).toBe("0")
  })

  it("accepts a numeric unit_pack_size", () => {
    expect(boxPackSize({}, { unit_pack_size: 5000 })).toBe("5000")
  })

  // The whole point: what the form reloads is what it posts back.
  it("round-trips a mixed article without inflating the part box", () => {
    const line = { unit_pack_size: "5000.000" }
    const boxes = [
      ...Array.from({ length: 18 }, () => ({ pack_count: "5000.0" })),
      { pack_count: "1600.0" },
    ]
    const total = boxes.reduce((s, b) => s + parseFloat(boxPackSize(b, line)), 0)
    expect(total).toBe(91600) // not 19 x 5,000 = 95,000
  })
})
