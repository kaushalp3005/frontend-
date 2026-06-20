export interface ColdBox {
  article_description: string
  box_number: number
  conversion: string
  net_weight: string
  gross_weight: string
  count: string
  lot_number: string
  item_mark: string
  spl_remarks: string
  vakkal: string
  box_id?: string
  is_printed: boolean
}

export interface LotRange { from: number; to: number; lot: string }

type CascadeField = "lot_number" | "item_mark" | "spl_remarks" | "vakkal"

export function cascadeArticleField(
  boxes: ColdBox[], article: string, field: CascadeField, value: string,
): ColdBox[] {
  return boxes.map((b) => (b.article_description === article ? { ...b, [field]: value } : b))
}

export function applyLotRanges(boxes: ColdBox[], article: string, ranges: LotRange[]): ColdBox[] {
  return boxes.map((b) => {
    if (b.article_description !== article) return b
    const match = ranges.find((r) => b.box_number >= r.from && b.box_number <= r.to)
    return match ? { ...b, lot_number: match.lot } : b
  })
}

export function bulkFillBoxes(
  boxes: ColdBox[], article: string,
  values: Partial<Pick<ColdBox, "net_weight" | "gross_weight" | "count">>,
): ColdBox[] {
  return boxes.map((b) => (b.article_description === article ? { ...b, ...values } : b))
}
