import { describe, it, expect } from "vitest"
import { isColdWarehouse, normalizeWarehouseName } from "./warehouses"

describe("cold warehouse detection (gates mandatory vakkal)", () => {
  it("flags the four cold warehouses as cold", () => {
    for (const code of ["Savla D-39", "Savla D-514", "Rishi", "Supreme"]) {
      expect(isColdWarehouse(code)).toBe(true)
    }
  })

  it("does not flag regular warehouses as cold", () => {
    for (const code of ["W202", "A85", "F53", "A68"]) {
      expect(isColdWarehouse(code)).toBe(false)
    }
  })

  it("normalizes an alias to its canonical cold code", () => {
    expect(isColdWarehouse(normalizeWarehouseName("savla d-39"))).toBe(true)
  })
})
