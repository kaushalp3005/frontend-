import { describe, it, expect } from "vitest"
import { cascadeArticleField, applyLotRanges, bulkFillBoxes, type ColdBox } from "../rtvCold"

const mk = (n: number, art = "x"): ColdBox => ({
  article_description: art, box_number: n, conversion: "", net_weight: "", gross_weight: "",
  count: "1", lot_number: "", item_mark: "", spl_remarks: "", vakkal: "", is_printed: false,
})

describe("rtvCold", () => {
  it("cascades an article field to all boxes of that article only", () => {
    const boxes = [mk(1, "x"), mk(2, "x"), mk(1, "y")]
    const out = cascadeArticleField(boxes, "x", "item_mark", "MARK")
    expect(out.filter(b => b.article_description === "x").every(b => b.item_mark === "MARK")).toBe(true)
    expect(out.find(b => b.article_description === "y")!.item_mark).toBe("")
  })
  it("applies lot ranges by box number for one article", () => {
    const boxes = [mk(1), mk(2), mk(3)]
    const out = applyLotRanges(boxes, "x", [{ from: 1, to: 2, lot: "7648" }])
    expect(out.map(b => b.lot_number)).toEqual(["7648", "7648", ""])
  })
  it("bulk-fills net/gross/count across an article's boxes", () => {
    const boxes = [mk(1), mk(2)]
    const out = bulkFillBoxes(boxes, "x", { net_weight: "1.5", gross_weight: "1.8", count: "2" })
    expect(out.every(b => b.net_weight === "1.5" && b.gross_weight === "1.8" && b.count === "2")).toBe(true)
  })
})
