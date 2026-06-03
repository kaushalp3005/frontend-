// Item 1C: the single source of truth for recomputing an article's *display* aggregates from its
// boxes. Boxes are authoritative (matching the backend recalc): quantity_units is the box count,
// net/total are the summed box net/gross weights. Returned as strings to drop straight into the
// article form state used by the inward "new" and "approve" screens. Weights are blank ("") rather
// than "0" when there is nothing to sum, preserving the screens' existing presentation.

export interface BoxLike {
  article_description: string
  net_weight?: string | number | null
  gross_weight?: string | number | null
}

export interface ArticleAggregates {
  quantity_units: string
  net_weight: string
  total_weight: string
}

const toNum = (v: string | number | null | undefined): number =>
  parseFloat(String(v ?? '')) || 0

export function computeArticleAggregatesFromBoxes(
  boxes: BoxLike[],
  articleDescription: string,
): ArticleAggregates {
  const articleBoxes = boxes.filter((b) => b.article_description === articleDescription)
  const totalNet = articleBoxes.reduce((sum, b) => sum + toNum(b.net_weight), 0)
  const totalGross = articleBoxes.reduce((sum, b) => sum + toNum(b.gross_weight), 0)
  const boxCount = articleBoxes.length

  return {
    quantity_units: String(boxCount),
    net_weight: totalNet > 0 ? String(parseFloat(totalNet.toFixed(3))) : '',
    total_weight: totalGross > 0 ? String(parseFloat(totalGross.toFixed(3))) : '',
  }
}
