import type { TransferRecord } from "@/lib/api/transferDashboardApi"

/**
 * Pure grouping/sort engine for the Transfer Summary tree.
 *
 * Hierarchy is explicit and predictable: L1 = `groupBy`, L2 = `thenBy`
 * (or none), leaf = item_description rows (each keeping its raw records for the
 * transfer-detail view). The active sort cascades into EVERY layer.
 *
 * Search is NOT handled here — callers pre-filter records (incl. search) before
 * calling buildSummary, so KPIs/totals and the tree all reflect the same set.
 */

export type Dim =
  | "from_warehouse" | "to_warehouse" | "item_category" | "sub_category"
  | "material_type" | "month" | "status" | "created_by"

export type ThenBy = Dim | "none"
export type SortKey = "weight" | "boxes" | "count" | "name"

export interface ItemNode {
  item_description: string
  material_type: string
  tx_count: number
  total_weight: number
  total_net_weight: number
  total_gross_weight: number
  total_boxes: number
  records: TransferRecord[]
}

export interface GroupNode {
  label: string
  tx_count: number
  total_weight: number
  total_net_weight: number
  total_gross_weight: number
  total_boxes: number
  pending_count: number
  children: GroupNode[] | null // L2 groups; null when this group holds items directly
  items: ItemNode[] | null     // item rows; present when children is null
}

/** Sensible default second level per chosen group dimension. */
export const DEFAULT_THEN_BY: Record<Dim, ThenBy> = {
  item_category: "sub_category",
  sub_category: "material_type",
  from_warehouse: "to_warehouse",
  to_warehouse: "from_warehouse",
  material_type: "item_category",
  month: "item_category",
  status: "item_category",
  created_by: "item_category",
}

const DIM_FN: Record<Dim, (r: TransferRecord) => string> = {
  from_warehouse: (r) => r.from_warehouse || "Unknown",
  to_warehouse: (r) => r.to_warehouse || "Unknown",
  item_category: (r) => r.item_category || "Uncategorized",
  sub_category: (r) => r.sub_category || "General",
  material_type: (r) => r.material_type || "N/A",
  month: (r) => r.transfer_month || "Unknown",
  status: (r) => r.status || "Unknown",
  created_by: (r) => r.created_by || "Unknown",
}

const sumNet = (rs: TransferRecord[]) => rs.reduce((s, r) => s + (r.net_weight || 0), 0)
const sumGross = (rs: TransferRecord[]) => rs.reduce((s, r) => s + (r.total_weight || 0), 0)
const sumBoxes = (rs: TransferRecord[]) => rs.reduce((s, r) => s + (r.box_count || 0), 0)
const txCount = (rs: TransferRecord[]) => new Set(rs.map((r) => r.transfer_id)).size
const pendingCount = (rs: TransferRecord[]) =>
  new Set(
    rs.filter((r) => r.status === "Dispatch" || r.status === "Pending").map((r) => r.transfer_id),
  ).size

/**
 * Sort nodes by the active key, applied uniformly at every layer.
 * Boxes/Count fall back to weight as a tiebreaker so that Dates (which carry
 * 0 boxes, sold by weight) still order sensibly instead of looking "broken".
 */
function sortNodes<T extends { total_weight: number; total_boxes: number; tx_count: number }>(
  nodes: T[], sortBy: SortKey, labelOf: (t: T) => string,
): T[] {
  const cmp = (a: T, b: T): number => {
    switch (sortBy) {
      case "boxes": return (b.total_boxes - a.total_boxes) || (b.total_weight - a.total_weight)
      case "count": return (b.tx_count - a.tx_count) || (b.total_weight - a.total_weight)
      case "name": return labelOf(a).localeCompare(labelOf(b))
      case "weight":
      default: return b.total_weight - a.total_weight
    }
  }
  return [...nodes].sort(cmp)
}

function buildItems(records: TransferRecord[]): ItemNode[] {
  const itemMap = new Map<string, TransferRecord[]>()
  for (const r of records) {
    const k = r.item_description || "Unknown"
    if (!itemMap.has(k)) itemMap.set(k, [])
    itemMap.get(k)!.push(r)
  }
  return Array.from(itemMap.entries()).map(([item, recs]) => {
    const net = sumNet(recs), gross = sumGross(recs)
    return {
      item_description: item,
      material_type: recs[0]?.material_type || "",
      tx_count: txCount(recs),
      total_weight: net || gross,
      total_net_weight: net,
      total_gross_weight: gross,
      total_boxes: sumBoxes(recs),
      records: recs,
    }
  })
}

function groupMetrics(recs: TransferRecord[], label: string) {
  const net = sumNet(recs), gross = sumGross(recs)
  return {
    label,
    tx_count: txCount(recs),
    total_weight: net || gross,
    total_net_weight: net,
    total_gross_weight: gross,
    total_boxes: sumBoxes(recs),
    pending_count: pendingCount(recs),
  }
}

export function buildSummary(args: {
  records: TransferRecord[]
  groupBy: Dim
  thenBy: ThenBy
  sortBy: SortKey
}): GroupNode[] {
  const { records, groupBy, thenBy, sortBy } = args
  const l1Fn = DIM_FN[groupBy]
  const useL2 = thenBy !== "none" && thenBy !== groupBy
  const l2Fn = useL2 ? DIM_FN[thenBy as Dim] : null

  const l1Map = new Map<string, TransferRecord[]>()
  for (const r of records) {
    const k = l1Fn(r)
    if (!l1Map.has(k)) l1Map.set(k, [])
    l1Map.get(k)!.push(r)
  }

  const groups: GroupNode[] = Array.from(l1Map.entries()).map(([label, recs]) => {
    const base = groupMetrics(recs, label)
    if (!l2Fn) {
      return { ...base, children: null, items: sortNodes(buildItems(recs), sortBy, (i) => i.item_description) }
    }
    const l2Map = new Map<string, TransferRecord[]>()
    for (const r of recs) {
      const k = l2Fn(r)
      if (!l2Map.has(k)) l2Map.set(k, [])
      l2Map.get(k)!.push(r)
    }
    const children: GroupNode[] = Array.from(l2Map.entries()).map(([sl, srecs]) => ({
      ...groupMetrics(srecs, sl),
      children: null,
      items: sortNodes(buildItems(srecs), sortBy, (i) => i.item_description),
    }))
    return { ...base, children: sortNodes(children, sortBy, (g) => g.label), items: null }
  })

  return sortNodes(groups, sortBy, (g) => g.label)
}
