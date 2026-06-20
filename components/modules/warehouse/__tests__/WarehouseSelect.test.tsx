import { describe, it, expect } from "vitest"
import { getWarehouseOptions } from "../WarehouseSelect"

describe("getWarehouseOptions", () => {
  it("includes the canonical cold warehouse codes", () => {
    const codes = getWarehouseOptions().map((o) => o.code)
    for (const c of ["Savla D-39", "Savla D-514", "Rishi", "Supreme"]) {
      expect(codes).toContain(c)
    }
  })
  it("coldOnly restricts to cold warehouses and excludes regulars", () => {
    const cold = getWarehouseOptions(true).map((o) => o.code)
    expect(cold).toContain("Savla D-39")
    expect(cold).not.toContain("W202")
  })
  it("every option has a non-empty label", () => {
    expect(getWarehouseOptions().every((o) => o.label && o.label.length > 0)).toBe(true)
  })
})
