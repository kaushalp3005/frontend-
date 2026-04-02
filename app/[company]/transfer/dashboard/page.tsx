"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import Link from "next/link"
import {
  RefreshCw, ChevronRight, ChevronDown, ChevronsUpDown,
  Download, Copy, ArrowLeft, Package, Truck, AlertTriangle,
  X, Send, Warehouse as WarehouseIcon, CheckCircle, Search, ArrowUpDown,
  ArrowRight, Calendar, Filter,
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { useAuthStore } from "@/lib/stores/auth"

const DASHBOARD_ALLOWED_EMAILS = ["yash@candorfoods.in", "b.hrithik@candorfoods.in"]
import { transferDashboardApi, type TransferRecord, type TransferFilterOptions } from "@/lib/api/transferDashboardApi"

interface Props { params: { company: string } }

const fmtN = (n: number) => (n !== null && n !== undefined) ? Math.round(n).toLocaleString("en-IN") : "0"
const fmtR = (n: number) => n ? "₹" + Math.round(n).toLocaleString("en-IN") : "—"

type ViewMode = "kgs" | "boxes" | "both"
type GroupByKey = "from_warehouse" | "to_warehouse" | "item_category" | "sub_category" | "material_type" | "month" | "status" | "created_by"

const GROUP_OPTIONS: { value: GroupByKey; label: string }[] = [
  { value: "from_warehouse", label: "From WH" }, { value: "to_warehouse", label: "To WH" },
  { value: "item_category", label: "Category" }, { value: "sub_category", label: "Sub Category" },
  { value: "material_type", label: "Material" }, { value: "month", label: "Month" },
  { value: "status", label: "Status" }, { value: "created_by", label: "Created By" },
]

const DATE_PRESETS = [
  { label: "Today", fn: () => { const d = format(new Date(), "yyyy-MM-dd"); return [d, d] } },
  { label: "This Month", fn: () => [format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"), format(new Date(), "yyyy-MM-dd")] },
  { label: "Last Month", fn: () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return [format(new Date(d.getFullYear(), d.getMonth(), 1), "yyyy-MM-dd"), format(new Date(d.getFullYear(), d.getMonth() + 1, 0), "yyyy-MM-dd")] } },
  { label: "All Time", fn: () => ["", ""] },
]

function chipToggle(set: Set<string>, val: string): Set<string> {
  const n = new Set(set); n.has(val) ? n.delete(val) : n.add(val); return n
}

export default function TransferDashboard({ params }: Props) {
  const { company } = params
  const { user } = useAuthStore()
  const hasAccess = DASHBOARD_ALLOWED_EMAILS.includes(user?.email || "")

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-lg font-bold">Access Restricted</h2>
        <p className="text-sm text-muted-foreground mt-1">This dashboard is only available to authorized users.</p>
      </div>
    )
  }

  const [allRecords, setAllRecords] = useState<TransferRecord[]>([])
  const [filterOpts, setFilterOpts] = useState<TransferFilterOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selFrom, setSelFrom] = useState<Set<string>>(new Set())
  const [selTo, setSelTo] = useState<Set<string>>(new Set())
  const [selCategory, setSelCategory] = useState<Set<string>>(new Set())
  const [selMaterial, setSelMaterial] = useState<Set<string>>(new Set())
  const [selStatus, setSelStatus] = useState<Set<string>>(new Set())
  const [showIssuesOnly, setShowIssuesOnly] = useState(false)

  const [groupBy, setGroupBy] = useState<GroupByKey>("from_warehouse")
  const [viewMode, setViewMode] = useState<ViewMode>("both")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [allExpanded, setAllExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"weight" | "boxes" | "count" | "name">("weight")
  const [selectedTransfer, setSelectedTransfer] = useState<number | null>(null)

  const activeFilterCount = [dateFrom, dateTo].filter(Boolean).length +
    [selFrom, selTo, selCategory, selMaterial, selStatus].filter(s => s.size > 0).length +
    (showIssuesOnly ? 1 : 0)

  // Dimensions locked by active filters — these should not appear as group/layer options
  const lockedDimensions = useMemo(() => {
    const locked = new Set<GroupByKey>()
    if (selFrom.size > 0) locked.add("from_warehouse")
    if (selTo.size > 0) locked.add("to_warehouse")
    if (selCategory.size > 0) locked.add("item_category")
    if (selMaterial.size > 0) locked.add("material_type")
    if (selStatus.size > 0) locked.add("status")
    return locked
  }, [selFrom, selTo, selCategory, selMaterial, selStatus])

  // Available group options = only unlocked dimensions
  const availableGroupOptions = useMemo(() =>
    GROUP_OPTIONS.filter(g => !lockedDimensions.has(g.value)),
  [lockedDimensions])

  // Cascading filter options
  const cascadedOpts = useMemo(() => {
    const fex = (exclude: string) => allRecords.filter(r => {
      if (dateFrom && r.transfer_date < dateFrom) return false
      if (dateTo && r.transfer_date > dateTo) return false
      if (exclude !== "from" && selFrom.size > 0 && !selFrom.has(r.from_warehouse)) return false
      if (exclude !== "to" && selTo.size > 0 && !selTo.has(r.to_warehouse)) return false
      if (exclude !== "cat" && selCategory.size > 0 && !selCategory.has(r.item_category)) return false
      if (exclude !== "mat" && selMaterial.size > 0 && !selMaterial.has(r.material_type)) return false
      if (exclude !== "status" && selStatus.size > 0 && !selStatus.has(r.status)) return false
      return true
    })
    const uniq = (recs: TransferRecord[], f: (r: TransferRecord) => string) => [...new Set(recs.map(f).filter(Boolean))].sort()
    return {
      from_warehouses: uniq(fex("from"), r => r.from_warehouse),
      to_warehouses: uniq(fex("to"), r => r.to_warehouse),
      statuses: uniq(fex("status"), r => r.status),
      categories: uniq(fex("cat"), r => r.item_category),
      materials: uniq(fex("mat"), r => r.material_type),
    }
  }, [allRecords, dateFrom, dateTo, selFrom, selTo, selCategory, selMaterial, selStatus])

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [data, opts] = await Promise.all([
        transferDashboardApi.getAllData(),
        transferDashboardApi.getFilterOptions(),
      ])
      setAllRecords(data.records); setFilterOpts(opts)
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-switch groupBy when current dimension gets locked by a filter
  useEffect(() => {
    if (lockedDimensions.has(groupBy) && availableGroupOptions.length > 0) {
      setGroupBy(availableGroupOptions[0].value)
      setExpanded(new Set()); setAllExpanded(false)
    }
  }, [lockedDimensions, groupBy, availableGroupOptions])

  // Client-side filtering
  const filtered = useMemo(() => allRecords.filter(r => {
    if (dateFrom && r.transfer_date < dateFrom) return false
    if (dateTo && r.transfer_date > dateTo) return false
    if (selFrom.size > 0 && !selFrom.has(r.from_warehouse)) return false
    if (selTo.size > 0 && !selTo.has(r.to_warehouse)) return false
    if (selCategory.size > 0 && !selCategory.has(r.item_category)) return false
    if (selMaterial.size > 0 && !selMaterial.has(r.material_type)) return false
    if (selStatus.size > 0 && !selStatus.has(r.status)) return false
    if (showIssuesOnly && !r.has_issue) return false
    return true
  }), [allRecords, dateFrom, dateTo, selFrom, selTo, selCategory, selMaterial, selStatus, showIssuesOnly])

  // KPIs
  const kpis = useMemo(() => {
    const transfers = new Set(filtered.map(r => r.transfer_id))
    const totalWeight = filtered.reduce((s, r) => s + (r.total_weight || r.net_weight || 0), 0)
    const totalBoxes = filtered.reduce((s, r) => s + (r.box_count || 0), 0)
    const pending = new Set(filtered.filter(r => r.status === "Dispatch" || r.status === "Pending").map(r => r.transfer_id))
    const notReceived = new Set(filtered.filter(r => r.received_status !== "Received").map(r => r.transfer_id))
    const whs = new Set([...filtered.map(r => r.from_warehouse), ...filtered.map(r => r.to_warehouse)].filter(Boolean))
    const issueTransfers = new Set(filtered.filter(r => r.has_issue).map(r => r.transfer_id))
    const totalIssueItems = filtered.filter(r => r.has_issue).reduce((s, r) => s + (r.issue_count || 0), 0)
    return { total_transfers: transfers.size, total_weight: totalWeight, total_boxes: totalBoxes, pending_count: pending.size, not_received: notReceived.size, warehouses_active: whs.size, issue_transfers: issueTransfers.size, issue_items: totalIssueItems }
  }, [filtered])

  // Grouped summary
  const gf = (r: TransferRecord): string => {
    switch (groupBy) {
      case "from_warehouse": return r.from_warehouse || "Unknown"
      case "to_warehouse": return r.to_warehouse || "Unknown"
      case "item_category": return r.item_category || "Uncategorized"
      case "sub_category": return r.sub_category || "General"
      case "material_type": return r.material_type || "N/A"
      case "month": return r.transfer_month || "Unknown"
      case "status": return r.status || "Unknown"
      case "created_by": return r.created_by || "Unknown"
    }
  }

  const summary = useMemo(() => {
    const l1Map = new Map<string, TransferRecord[]>()
    for (const r of filtered) { const g = gf(r); if (!l1Map.has(g)) l1Map.set(g, []); l1Map.get(g)!.push(r) }

    // Pick L2 dimension — best available that is different from L1 and not locked by filters
    const l2Candidates: { key: GroupByKey; fn: (r: TransferRecord) => string }[] = [
      { key: "from_warehouse", fn: r => r.from_warehouse || "Unknown" },
      { key: "to_warehouse", fn: r => r.to_warehouse || "Unknown" },
      { key: "item_category", fn: r => r.item_category || "Uncategorized" },
      { key: "sub_category", fn: r => r.sub_category || "General" },
      { key: "material_type", fn: r => r.material_type || "N/A" },
      { key: "month", fn: r => r.transfer_month || "Unknown" },
      { key: "status", fn: r => r.status || "Unknown" },
      { key: "created_by", fn: r => r.created_by || "Unknown" },
    ]

    // Preferred L2 ordering based on what makes sense as a sub-group
    const l2Preferred: Record<GroupByKey, GroupByKey[]> = {
      from_warehouse: ["to_warehouse", "item_category", "sub_category", "material_type", "month", "status", "created_by"],
      to_warehouse: ["from_warehouse", "item_category", "sub_category", "material_type", "month", "status", "created_by"],
      item_category: ["sub_category", "from_warehouse", "to_warehouse", "material_type", "month", "status", "created_by"],
      sub_category: ["item_category", "from_warehouse", "to_warehouse", "material_type", "month", "status", "created_by"],
      material_type: ["item_category", "sub_category", "from_warehouse", "to_warehouse", "month", "status", "created_by"],
      month: ["from_warehouse", "to_warehouse", "item_category", "sub_category", "material_type", "status", "created_by"],
      status: ["from_warehouse", "to_warehouse", "item_category", "sub_category", "material_type", "month", "created_by"],
      created_by: ["item_category", "from_warehouse", "to_warehouse", "sub_category", "material_type", "month", "status"],
    }

    // Find best L2 dimension: not same as L1 and not locked
    const l2Pick = l2Preferred[groupBy]?.find(k => k !== groupBy && !lockedDimensions.has(k)) || "item_category"
    const l2Fn = l2Candidates.find(c => c.key === l2Pick)?.fn || (r => r.item_category || "Uncategorized")
    const l2Field = l2Fn

    return Array.from(l1Map.entries()).map(([label, records]) => {
      const tids = new Set(records.map(r => r.transfer_id))
      const weight = records.reduce((s, r) => s + (r.total_weight || r.net_weight || 0), 0)
      const boxes = records.reduce((s, r) => s + (r.box_count || 0), 0)
      const pend = new Set(records.filter(r => r.status === "Dispatch" || r.status === "Pending").map(r => r.transfer_id))

      const l2Map = new Map<string, TransferRecord[]>()
      for (const r of records) { const k = l2Field(r); if (!l2Map.has(k)) l2Map.set(k, []); l2Map.get(k)!.push(r) }

      const children = Array.from(l2Map.entries()).map(([sl, recs]) => {
        const sw = recs.reduce((s, r) => s + (r.total_weight || r.net_weight || 0), 0)
        const sb = recs.reduce((s, r) => s + (r.box_count || 0), 0)
        const l3Map = new Map<string, TransferRecord[]>()
        for (const r of recs) { const k = r.item_description || "Unknown"; if (!l3Map.has(k)) l3Map.set(k, []); l3Map.get(k)!.push(r) }
        const items = Array.from(l3Map.entries()).map(([item, irecs]) => {
          const iw = irecs.reduce((s, r) => s + (r.total_weight || r.net_weight || 0), 0)
          const ib = irecs.reduce((s, r) => s + (r.box_count || 0), 0)
          return { item_description: item, material_type: irecs[0]?.material_type || "", total_weight: iw, total_boxes: ib, tx_count: new Set(irecs.map(r => r.transfer_id)).size, records: irecs }
        }).sort((a, b) => b.total_weight - a.total_weight)
        return { sub_label: sl, tx_count: new Set(recs.map(r => r.transfer_id)).size, total_weight: sw, total_boxes: sb, children: items, skipL2: false }
      }).sort((a, b) => b.total_weight - a.total_weight)

      // If L1 has only 1 L2 child with same label — skip L2, go direct to items
      const skipL2 = children.length === 1 && (
        children[0].sub_label === label ||
        children[0].sub_label.toLowerCase() === label.toLowerCase()
      )

      return { group_label: label, tx_count: tids.size, total_weight: weight, total_boxes: boxes, pending_count: pend.size, children, skipL2 }
    })

    // Search
    const sq = searchQuery.toLowerCase().trim()
    const searched = sq ? data.filter(l1 =>
      l1.group_label.toLowerCase().includes(sq) ||
      l1.children.some(l2 => l2.sub_label.toLowerCase().includes(sq) ||
        l2.children.some(l3 => l3.item_description.toLowerCase().includes(sq)))
    ) : data

    // Sort
    const sortFn = (a: typeof data[0], b: typeof data[0]) => {
      switch (sortBy) {
        case "weight": return b.total_weight - a.total_weight
        case "boxes": return b.total_boxes - a.total_boxes
        case "count": return b.tx_count - a.tx_count
        case "name": return a.group_label.localeCompare(b.group_label)
        default: return b.total_weight - a.total_weight
      }
    }
    return [...searched].sort(sortFn)
  }, [filtered, groupBy, lockedDimensions, searchQuery, sortBy])

  const toggle = (k: string) => setExpanded(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })
  const toggleAll = () => {
    if (allExpanded) { setExpanded(new Set()); setAllExpanded(false); return }
    const keys = new Set<string>()
    summary.forEach(l1 => { keys.add(l1.group_label); l1.children.forEach(l2 => keys.add(l1.group_label + "|||" + l2.sub_label)) })
    setExpanded(keys); setAllExpanded(true)
  }

  const clearFilters = () => { setDateFrom(""); setDateTo(""); setSelFrom(new Set()); setSelTo(new Set()); setSelCategory(new Set()); setSelMaterial(new Set()); setSelStatus(new Set()); setShowIssuesOnly(false) }

  const showVal = (weight: number, boxes: number) => {
    if (viewMode === "kgs") return <span className="tabular-nums">{fmtN(weight)} Kgs</span>
    if (viewMode === "boxes") return <span className="tabular-nums">{fmtN(boxes)} Boxes</span>
    return <><div className="tabular-nums">{fmtN(weight)} Kgs</div><div className="text-[10px] text-muted-foreground tabular-nums">{fmtN(boxes)} Boxes</div></>
  }

  const handleCopy = async () => {
    const lines = [`Transfer Summary - ${format(new Date(), "dd MMM yyyy")}`, `Total: ${kpis.total_transfers} transfers | ${fmtN(kpis.total_weight)} Kg`, ""]
    summary.forEach(l1 => lines.push(`${l1.group_label}  ${l1.tx_count} TRs  ${fmtN(l1.total_weight)} Kg  ${fmtN(l1.total_boxes)} Boxes`))
    try { await navigator.clipboard.writeText(lines.join("\n")); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }

  const handleExport = async () => {
    try {
      const XLSX = (await import("xlsx")).default || (await import("xlsx"))
      const rows = filtered.map(r => ({
        "Challan": r.challan_no, "Date": r.transfer_date, "From": r.from_warehouse, "To": r.to_warehouse,
        "Item": r.item_description, "Category": r.item_category, "Material": r.material_type,
        "Qty": r.qty, "Net Weight": r.net_weight, "Total Weight": r.total_weight,
        "Boxes": r.box_count, "Status": r.status, "Received": r.received_status,
      }))
      const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Transfer Data")
      XLSX.writeFile(wb, `Transfer_Summary_${format(new Date(), "ddMMMyyyy")}.xlsx`)
    } catch (err) { console.error(err) }
  }

  return (
    <PermissionGuard module="transfer" action="view">
      <div className="p-3 sm:p-4 md:p-6 max-w-[1600px] mx-auto space-y-4">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href={`/${company}/transfer`}><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Transfer Summary</h1>
              <p className="text-xs text-muted-foreground">As of {format(new Date(), "dd-MMM-yyyy")}
                {activeFilterCount > 0 && <span className="ml-2 text-teal-600">&middot; {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => fetchData()}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /><span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={handleCopy}>
              <Copy className="h-3.5 w-3.5" /><span className="hidden sm:inline">{copied ? "Copied!" : "Copy"}</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">Excel</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs opacity-50" disabled>
              <Send className="h-3.5 w-3.5" /><span className="hidden sm:inline">WhatsApp</span>
            </Button>
          </div>
        </div>

        {/* FILTERS */}
        {!loading && filterOpts && (
          <Card className="border-2 border-slate-200 dark:border-slate-700 shadow-sm">
            <CardContent className="p-0">

              {/* Row 1: Date Presets + Date Range */}
              <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b">
                <Calendar className="h-4 w-4 text-slate-500 flex-shrink-0" />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {DATE_PRESETS.map(p => (
                    <button key={p.label} onClick={() => { const [f, t] = p.fn(); setDateFrom(f); setDateTo(t) }}
                      className={cn("text-xs font-medium px-3 py-1.5 rounded-lg border-2 transition-all",
                        (!dateFrom && !dateTo && p.label === "All Time") || (dateFrom === p.fn()[0] && dateTo === p.fn()[1])
                          ? "bg-[#0f172a] text-white border-[#0f172a] shadow-sm" : "bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-600")}>{p.label}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 w-[140px] text-xs bg-white dark:bg-slate-800" />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 w-[140px] text-xs bg-white dark:bg-slate-800" />
                </div>
              </div>

              {/* Row 2: From → To Warehouse Dropdowns */}
              <div className="px-4 py-4 border-b">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                  {/* FROM Warehouse Dropdown */}
                  <div className="flex-1 space-y-1.5">
                    <label className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-blue-500 flex-shrink-0" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">From Warehouse</span>
                    </label>
                    <select
                      value={selFrom.size === 1 ? [...selFrom][0] : ""}
                      onChange={e => {
                        const val = e.target.value
                        if (!val) { setSelFrom(new Set()); return }
                        setSelFrom(new Set([val]))
                        // Remove same warehouse from "to" if selected
                        if (selTo.has(val)) { const next = new Set(selTo); next.delete(val); setSelTo(next) }
                      }}
                      className="w-full h-10 px-3 rounded-lg border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
                    >
                      <option value="">All Warehouses</option>
                      {cascadedOpts.from_warehouses.map(w => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>

                  {/* Arrow */}
                  <div className="hidden sm:flex items-center justify-center pb-1">
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-12 h-0.5 bg-gradient-to-r from-blue-500 to-emerald-500 relative">
                        <ArrowRight className="h-5 w-5 text-emerald-500 absolute -right-2.5 -top-[9px]" />
                      </div>
                    </div>
                  </div>
                  <div className="flex sm:hidden items-center justify-center -my-1">
                    <ArrowRight className="h-4 w-4 text-emerald-500 rotate-90" />
                  </div>

                  {/* TO Warehouse Dropdown */}
                  <div className="flex-1 space-y-1.5">
                    <label className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">To Warehouse</span>
                    </label>
                    <select
                      value={selTo.size === 1 ? [...selTo][0] : ""}
                      onChange={e => {
                        const val = e.target.value
                        if (!val) { setSelTo(new Set()); return }
                        setSelTo(new Set([val]))
                      }}
                      className="w-full h-10 px-3 rounded-lg border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
                    >
                      <option value="">All Warehouses</option>
                      {cascadedOpts.to_warehouses.map(w => {
                        const disabled = selFrom.size > 0 && selFrom.has(w)
                        return (
                          <option key={w} value={w} disabled={disabled}>{w}{disabled ? " (same as From)" : ""}</option>
                        )
                      })}
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 3: Status */}
              <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-slate-50/50 dark:bg-slate-900/30">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5" /> Status
                </span>
                <div className="flex items-center gap-2">
                  {cascadedOpts.statuses.map(s => {
                    const statusColors: Record<string, { active: string; idle: string }> = {
                      dispatch: { active: "bg-blue-600 text-white border-blue-600 shadow-sm", idle: "hover:bg-blue-50 hover:border-blue-300" },
                      received: { active: "bg-emerald-600 text-white border-emerald-600 shadow-sm", idle: "hover:bg-emerald-50 hover:border-emerald-300" },
                      pending: { active: "bg-amber-500 text-white border-amber-500 shadow-sm", idle: "hover:bg-amber-50 hover:border-amber-300" },
                    }
                    const colors = statusColors[s.toLowerCase()] || { active: "bg-teal-600 text-white border-teal-600 shadow-sm", idle: "hover:bg-slate-100 hover:border-slate-300" }
                    return (
                      <button key={s} onClick={() => setSelStatus(chipToggle(selStatus, s))}
                        className={cn("text-sm px-4 py-1.5 rounded-lg border-2 font-medium transition-all capitalize",
                          selStatus.has(s) ? colors.active : `bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 ${colors.idle}`)}>{s}</button>
                    )
                  })}
                  {/* Issue filter button */}
                  <button onClick={() => setShowIssuesOnly(!showIssuesOnly)}
                    className={cn("text-sm px-4 py-1.5 rounded-lg border-2 font-medium transition-all flex items-center gap-1.5",
                      showIssuesOnly
                        ? "bg-red-600 text-white border-red-600 shadow-sm"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:bg-red-50 hover:border-red-300 text-red-600")}>
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Issues {kpis.issue_transfers > 0 && <span className={cn("text-xs px-1.5 py-0.5 rounded-full", showIssuesOnly ? "bg-white/20" : "bg-red-100 text-red-700")}>{kpis.issue_transfers}</span>}
                  </button>
                </div>
              </div>

              {/* Row 4: Category + Material */}
              <div className="px-4 py-3 space-y-3">
                  {cascadedOpts.categories.length > 0 && (
                    <div className="flex flex-wrap items-start gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-[60px] pt-1.5 flex-shrink-0">Category</span>
                      <div className="flex flex-wrap gap-1.5 flex-1">
                        {cascadedOpts.categories.map(c => (
                          <button key={c} onClick={() => setSelCategory(chipToggle(selCategory, c))}
                            className={cn("text-xs px-2.5 py-1 rounded-lg border transition-all font-medium",
                              selCategory.has(c) ? "bg-violet-600 text-white border-violet-600 shadow-sm" : "bg-white dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-950/30 border-slate-200 dark:border-slate-600 hover:border-violet-300")}>{c}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {cascadedOpts.materials.length > 0 && (
                    <div className="flex flex-wrap items-start gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-[60px] pt-1.5 flex-shrink-0">Material</span>
                      <div className="flex flex-wrap gap-1.5 flex-1">
                        {cascadedOpts.materials.map(m => (
                          <button key={m} onClick={() => setSelMaterial(chipToggle(selMaterial, m))}
                            className={cn("text-xs px-2.5 py-1 rounded-lg border transition-all font-medium",
                              selMaterial.has(m) ? "bg-orange-600 text-white border-orange-600 shadow-sm" : "bg-white dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-orange-950/30 border-slate-200 dark:border-slate-600 hover:border-orange-300")}>{m}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              {/* Clear All */}
              {activeFilterCount > 0 && (
                <div className="px-4 py-2 border-t bg-red-50/50 dark:bg-red-950/10">
                  <button onClick={clearFilters} className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1.5 transition-colors">
                    <X className="h-3.5 w-3.5" />Clear all filters ({activeFilterCount})
                  </button>
                </div>
              )}

            </CardContent>
          </Card>
        )}

        {error && <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg">{error}</div>}

        {/* KPIs */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <KPI icon={<Truck className="h-4 w-4" />} label="Total Transfers" value={fmtN(kpis.total_transfers)} />
            {(viewMode === "kgs" || viewMode === "both") && <KPI icon={<Package className="h-4 w-4" />} label="Total Weight" value={fmtN(kpis.total_weight) + " Kgs"} />}
            {(viewMode === "boxes" || viewMode === "both") && <KPI icon={<Package className="h-4 w-4" />} label="Total Boxes" value={fmtN(kpis.total_boxes)} />}
            <KPI icon={<AlertTriangle className="h-4 w-4" />} label="Pending / Transit" value={fmtN(kpis.pending_count)} amber={kpis.pending_count > 0} />
            <KPI icon={<AlertTriangle className="h-4 w-4" />} label="Issues" value={`${fmtN(kpis.issue_transfers)} TRs / ${fmtN(kpis.issue_items)} items`} red={kpis.issue_transfers > 0} />
            <KPI icon={<Truck className="h-4 w-4" />} label="Not Received" value={fmtN(kpis.not_received)} amber={kpis.not_received > 0} />
          </div>
        )}

        {/* Active filter summary */}
        {lockedDimensions.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 rounded-lg text-xs">
            <span className="text-teal-700 dark:text-teal-400 font-medium">Showing results for:</span>
            {selFrom.size > 0 && <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded font-medium">From: {[...selFrom].join(", ")}</span>}
            {selTo.size > 0 && <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded font-medium">To: {[...selTo].join(", ")}</span>}
            {selStatus.size > 0 && <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded font-medium capitalize">{[...selStatus].join(", ")}</span>}
            {selCategory.size > 0 && <span className="px-2 py-0.5 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 rounded font-medium">{[...selCategory].join(", ")}</span>}
            {selMaterial.size > 0 && <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded font-medium">{[...selMaterial].join(", ")}</span>}
          </div>
        )}

        {/* GROUP BY + VIEW + EXPAND */}
        <div className="flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Group:</span>
                  <div className="flex rounded-lg border overflow-hidden text-xs">
                    {availableGroupOptions.map(g => (
                      <button key={g.value} onClick={() => { setGroupBy(g.value); setExpanded(new Set()); setAllExpanded(false) }}
                        className={cn("px-2 py-1.5 transition-colors whitespace-nowrap", groupBy === g.value ? "bg-[#0f172a] text-white" : "hover:bg-slate-100")}>{g.label}</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">View:</span>
                  <div className="flex rounded-lg border overflow-hidden text-xs">
                    {(["kgs", "boxes", "both"] as ViewMode[]).map(v => (
                      <button key={v} onClick={() => setViewMode(v)}
                        className={cn("px-2.5 py-1.5 transition-colors capitalize", viewMode === v ? "bg-[#0f172a] text-white" : "hover:bg-slate-100")}>
                        {v === "kgs" ? "Kgs" : v === "boxes" ? "Boxes" : "Both"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={toggleAll}>
                <ChevronsUpDown className="h-3.5 w-3.5" />{allExpanded ? "Collapse All" : "Expand All"}
              </Button>
            </div>

            {/* Search + Sort */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-[300px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search within results..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-8 pl-8 text-xs" />
                {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-3 w-3 text-muted-foreground hover:text-foreground" /></button>}
              </div>
              <div className="flex items-center gap-1">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="flex rounded-lg border overflow-hidden text-xs">
                  {([
                    { value: "weight" as const, label: "Weight" },
                    { value: "boxes" as const, label: "Boxes" },
                    { value: "count" as const, label: "Count" },
                    { value: "name" as const, label: "A-Z" },
                  ]).map(s => (
                    <button key={s.value} onClick={() => setSortBy(s.value)}
                      className={cn("px-2 py-1.5 transition-colors", sortBy === s.value ? "bg-[#0f172a] text-white" : "hover:bg-slate-100")}>{s.label}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

        {/* TABLE */}
        <Card><CardContent className="p-0">
          {loading ? <TableSkel /> : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Truck className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">No transfer records found</p>
              {activeFilterCount > 0 && <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={clearFilters}>Clear Filters</Button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b bg-muted/60">
                    <th className="text-left text-xs uppercase tracking-wider font-medium px-3 py-2.5 min-w-[250px]">Category</th>
                    <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2.5 w-[60px]">TRs</th>
                    <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2.5 w-[160px]">{viewMode === "boxes" ? "Boxes" : viewMode === "kgs" ? "Weight (Kgs)" : "Weight / Boxes"}</th>
                    <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2.5 w-[80px]">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map(l1 => {
                    const k1 = l1.group_label; const o1 = expanded.has(k1)
                    // Items to render — if skipL2, flatten L2's children directly under L1
                    const itemsForL1 = l1.skipL2 ? l1.children.flatMap(l2 => l2.children) : null
                    return (<React.Fragment key={k1}>
                      <tr className="border-b cursor-pointer hover:opacity-90 transition-colors bg-[#0f172a] text-white font-semibold" onClick={() => toggle(k1)}>
                        <td className="px-3 py-2.5 pl-3">
                          <span className="inline-flex items-center gap-1.5">
                            {o1 ? <ChevronDown className="h-4 w-4 text-teal-400" /> : <ChevronRight className="h-4 w-4 text-teal-400" />}{l1.group_label}
                            {l1.skipL2 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300">direct</span>}
                            {l1.pending_count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">{l1.pending_count} pending</span>}
                          </span>
                        </td>
                        <td className="text-right px-3 py-2.5 tabular-nums">{l1.tx_count}</td>
                        <td className="text-right px-3 py-2.5">{showVal(l1.total_weight, l1.total_boxes)}</td>
                        <td className="text-right px-3 py-2.5 tabular-nums">{l1.pending_count || ""}</td>
                      </tr>

                      {/* If skipL2 — show items directly under L1 (skip L2 layer) */}
                      {o1 && l1.skipL2 && itemsForL1?.map(l3 => {
                        const k3 = k1 + "|||" + l3.item_description; const o3 = expanded.has(k3)
                        return (<React.Fragment key={k3}>
                          <ItemRow k={k3} o={o3} l3={l3} indent="pl-8" toggle={toggle} showVal={showVal} />
                          {o3 && <TransferRows records={l3.records} showVal={showVal} indent="pl-14" onClickTransfer={setSelectedTransfer} />}
                        </React.Fragment>)
                      })}

                      {/* Normal L2 → L3 → L4 flow */}
                      {o1 && !l1.skipL2 && l1.children.map(l2 => {
                        const k2 = k1 + "|||" + l2.sub_label; const o2 = expanded.has(k2)
                        return (<React.Fragment key={k2}>
                          <tr className="border-b cursor-pointer hover:bg-slate-200/50 transition-colors bg-slate-100 dark:bg-slate-800 font-medium border-l-[3px] border-l-teal-500" onClick={() => toggle(k2)}>
                            <td className="px-3 py-2 pl-8"><span className="inline-flex items-center gap-1.5">{o2 ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}{l2.sub_label}</span></td>
                            <td className="text-right px-3 py-2 tabular-nums">{l2.tx_count}</td>
                            <td className="text-right px-3 py-2">{showVal(l2.total_weight, l2.total_boxes)}</td>
                            <td />
                          </tr>
                          {o2 && l2.children.map(l3 => {
                            const k3 = k2 + "|||" + l3.item_description; const o3 = expanded.has(k3)
                            return (<React.Fragment key={k3}>
                              <ItemRow k={k3} o={o3} l3={l3} indent="pl-14" toggle={toggle} showVal={showVal} />
                              {o3 && <TransferRows records={l3.records} showVal={showVal} indent="pl-20" onClickTransfer={setSelectedTransfer} />}
                            </React.Fragment>)
                          })}
                        </React.Fragment>)
                      })}
                    </React.Fragment>)
                  })}
                  <tr className="border-t-2 border-slate-300 bg-[#0f172a] text-white font-bold">
                    <td className="px-3 py-2.5">Grand Total</td>
                    <td className="text-right px-3 py-2.5 tabular-nums">{kpis.total_transfers}</td>
                    <td className="text-right px-3 py-2.5">{showVal(kpis.total_weight, kpis.total_boxes)}</td>
                    <td className="text-right px-3 py-2.5 tabular-nums">{kpis.pending_count || ""}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent></Card>

        {/* TRANSFER DETAIL POPUP */}
        <TransferDetailPopup
          transferId={selectedTransfer}
          allRecords={allRecords}
          onClose={() => setSelectedTransfer(null)}
        />

      </div>
    </PermissionGuard>
  )
}

// ── Item row (L3) ──
// ── Transfer Detail Popup ──
function TransferDetailPopup({ transferId, allRecords, onClose }: { transferId: number | null; allRecords: TransferRecord[]; onClose: () => void }) {
  if (!transferId) return null

  // Get all line items for this transfer
  const lines = allRecords.filter(r => r.transfer_id === transferId)
  if (lines.length === 0) return null

  const hdr = lines[0]
  const totalWeight = lines.reduce((s, r) => s + (r.total_weight || r.net_weight || 0), 0)
  const totalQty = lines.reduce((s, r) => s + (r.qty || 0), 0)

  return (
    <Dialog open={!!transferId} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            {hdr.challan_no || `TR-${hdr.transfer_id}`}
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
              hdr.status === "Approved" ? "bg-emerald-100 text-emerald-700" :
              hdr.status === "Dispatch" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700")}>{hdr.status}</span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
              hdr.received_status === "Received" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{hdr.received_status}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Transfer Header Info */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <InfoCell label="Date" value={hdr.transfer_date ? format(new Date(hdr.transfer_date), "dd MMM yyyy") : "—"} />
          <InfoCell label="From" value={hdr.from_warehouse} />
          <InfoCell label="To" value={hdr.to_warehouse} />
          <InfoCell label="Vehicle" value={hdr.vehicle_no || "—"} />
          <InfoCell label="Driver" value={hdr.driver_name || "—"} />
          <InfoCell label="Created By" value={hdr.created_by || "—"} />
          <InfoCell label="Total Items" value={lines.length.toString()} />
          <InfoCell label="Total Qty" value={fmtN(totalQty)} />
          <InfoCell label="Total Weight" value={fmtN(Math.round(totalWeight)) + " Kgs"} />
          {hdr.box_count > 0 && <InfoCell label="Boxes" value={fmtN(hdr.box_count)} />}
          {hdr.remark && <div className="col-span-2 sm:col-span-3"><InfoCell label="Remark" value={hdr.remark} /></div>}
        </div>

        {/* Line Items Table */}
        <div className="mt-4">
          <h4 className="text-sm font-semibold mb-2">Items / Articles</h4>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium">#</th>
                  <th className="text-left px-3 py-2 font-medium">Item</th>
                  <th className="text-left px-3 py-2 font-medium">Category</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-left px-3 py-2 font-medium">Lot</th>
                  <th className="text-right px-3 py-2 font-medium">Qty</th>
                  <th className="text-right px-3 py-2 font-medium">Net Wt (Kg)</th>
                  <th className="text-right px-3 py-2 font-medium">Total Wt (Kg)</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((ln, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{ln.item_description}</td>
                    <td className="px-3 py-2">{ln.item_category}{ln.sub_category ? ` / ${ln.sub_category}` : ""}</td>
                    <td className="px-3 py-2">
                      {ln.material_type && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px]">{ln.material_type}</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{ln.lot_number || "—"}</td>
                    <td className="text-right px-3 py-2 tabular-nums">{fmtN(ln.qty)}</td>
                    <td className="text-right px-3 py-2 tabular-nums">{fmtN(Math.round(ln.net_weight))}</td>
                    <td className="text-right px-3 py-2 tabular-nums">{fmtN(Math.round(ln.total_weight))}</td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="bg-muted/50 font-semibold">
                  <td className="px-3 py-2" colSpan={5}>Total</td>
                  <td className="text-right px-3 py-2 tabular-nums">{fmtN(totalQty)}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{fmtN(Math.round(lines.reduce((s, r) => s + (r.net_weight || 0), 0)))}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{fmtN(Math.round(totalWeight))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Issue Section */}
        {hdr.has_issue && hdr.issue_details && hdr.issue_details.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2 text-red-700 dark:text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> Issues Reported ({hdr.issue_count})
            </h4>
            <div className="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800">
                    <th className="text-left px-3 py-2 font-medium text-red-800 dark:text-red-300">Article</th>
                    <th className="text-left px-3 py-2 font-medium text-red-800 dark:text-red-300">Remarks</th>
                    <th className="text-right px-3 py-2 font-medium text-red-800 dark:text-red-300">Actual Wt</th>
                  </tr>
                </thead>
                <tbody>
                  {hdr.issue_details.map((iss, i) => (
                    <tr key={i} className="border-b border-red-100 dark:border-red-900 last:border-0">
                      <td className="px-3 py-2 font-medium">{iss.article}</td>
                      <td className="px-3 py-2 italic text-red-600 dark:text-red-400">{iss.remarks || "—"}</td>
                      <td className="text-right px-3 py-2 tabular-nums">{iss.actual_total_weight ? iss.actual_total_weight + " Kg" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  )
}

function ItemRow({ k, o, l3, indent, toggle, showVal }: { k: string; o: boolean; l3: { item_description: string; material_type: string; tx_count: number; total_weight: number; total_boxes: number }; indent: string; toggle: (k: string) => void; showVal: (w: number, b: number) => React.ReactNode }) {
  return (
    <tr className="border-b cursor-pointer hover:bg-slate-100/80 transition-colors bg-slate-50 dark:bg-slate-800/50" onClick={() => toggle(k)}>
      <td className={cn("px-3 py-2", indent)}>
        <span className="inline-flex items-center gap-1.5">
          {o ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {l3.item_description}
          {l3.material_type && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{l3.material_type}</span>}
        </span>
      </td>
      <td className="text-right px-3 py-2 tabular-nums">{l3.tx_count}</td>
      <td className="text-right px-3 py-2">{showVal(l3.total_weight, l3.total_boxes)}</td>
      <td />
    </tr>
  )
}

// ── Transfer detail rows (L4) — improved card-style ──
function TransferRows({ records, showVal, indent, onClickTransfer }: { records: TransferRecord[]; showVal: (w: number, b: number) => React.ReactNode; indent: string; onClickTransfer: (id: number) => void }) {
  // Deduplicate by transfer_id to show consolidated per-transfer
  const seen = new Map<number, TransferRecord & { line_count: number; total_wt: number }>()
  for (const r of records) {
    if (seen.has(r.transfer_id)) {
      const ex = seen.get(r.transfer_id)!
      ex.line_count++
      ex.total_wt += (r.total_weight || r.net_weight || 0)
    } else {
      seen.set(r.transfer_id, { ...r, line_count: 1, total_wt: r.total_weight || r.net_weight || 0 })
    }
  }

  return (<>{Array.from(seen.values()).map((tx, i) => (
    <tr key={`${tx.transfer_id}-${i}`} className="border-b bg-white dark:bg-slate-900/80">
      <td className={cn("px-3 py-2.5", indent)} colSpan={1}>
        <div className="flex items-start gap-3">
          {/* Route indicator */}
          <div className="flex flex-col items-center gap-0.5 pt-0.5 flex-shrink-0">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <div className="w-px h-4 bg-slate-300" />
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <div className="min-w-0 flex-1">
            {/* Header line */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-teal-600 hover:text-teal-700 hover:underline cursor-pointer" onClick={e => { e.stopPropagation(); onClickTransfer(tx.transfer_id) }}>{tx.challan_no || `TR-${tx.transfer_id}`}</span>
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                tx.status === "Approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" :
                tx.status === "Dispatch" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" :
                "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400")}>{tx.status}</span>
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                tx.received_status === "Received" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" :
                "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400")}>{tx.received_status}</span>
              {tx.has_issue && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 flex items-center gap-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" /> {tx.issue_count} issue{tx.issue_count > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {/* Detail line */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
              {tx.transfer_date && <span>{format(new Date(tx.transfer_date), "dd MMM yyyy")}</span>}
              <span className="font-medium text-foreground/70">{tx.from_warehouse} → {tx.to_warehouse}</span>
              {tx.vehicle_no && <span>Vehicle: {tx.vehicle_no}</span>}
              {tx.driver_name && <span>Driver: {tx.driver_name}</span>}
              {tx.lot_number && <span>Lot: {tx.lot_number}</span>}
              {tx.line_count > 1 && <span className="text-blue-600 dark:text-blue-400 font-medium">{tx.line_count} items</span>}
              {tx.box_count > 0 && <span>{tx.box_count} boxes</span>}
            </div>
            {/* Issue details with remarks */}
            {tx.has_issue && tx.issue_details && tx.issue_details.length > 0 && (
              <div className="mt-1.5 border-l-2 border-red-300 dark:border-red-700 pl-2 space-y-0.5">
                {tx.issue_details.map((iss, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-x-2 text-xs">
                    <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                    <span className="font-medium text-red-700 dark:text-red-400">{iss.article}</span>
                    {iss.remarks && <span className="text-red-600/80 dark:text-red-400/80 italic">&mdash; {iss.remarks}</span>}
                    {iss.actual_total_weight && <span className="text-muted-foreground">Actual wt: {iss.actual_total_weight} Kg</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="text-right px-3 py-2.5 tabular-nums text-xs align-top">{tx.line_count > 1 ? "" : ""}</td>
      <td className="text-right px-3 py-2.5 align-top">{showVal(tx.total_wt, tx.box_count)}</td>
      <td />
    </tr>
  ))}</>)
}

function KPI({ icon, label, value, amber, red }: { icon: React.ReactNode; label: string; value: string; amber?: boolean; red?: boolean }) {
  return (
    <Card className={cn("overflow-hidden",
      red && "border-red-300 bg-red-50 dark:bg-red-950/30",
      amber && !red && "border-amber-300 bg-amber-50 dark:bg-amber-950/30")}>
      <CardContent className="p-3 flex items-start gap-2 min-h-[72px]">
        <div className={cn("text-muted-foreground flex-shrink-0 mt-0.5", red && "text-red-600", amber && !red && "text-amber-600")}>{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
          <p className={cn("text-sm sm:text-base font-bold tabular-nums break-all leading-tight mt-0.5", red && "text-red-700 dark:text-red-400", amber && !red && "text-amber-700")}>{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function TableSkel() {
  return <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => (
    <div key={i} className="flex items-center gap-4"><Skeleton className="h-5 w-5" /><Skeleton className="h-5 flex-1" /><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-20" /></div>
  ))}</div>
}
