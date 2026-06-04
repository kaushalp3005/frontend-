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
import { transferDashboardApi, readTransferCache, writeTransferCache, type TransferRecord, type TransferFilterOptions } from "@/lib/api/transferDashboardApi"
import { getDisplayWarehouseName, normalizeWarehouseName } from "@/lib/constants/warehouses"
import { canonicalizeCategory } from "@/lib/categories/canonicalize"
import { buildSummary, DEFAULT_THEN_BY } from "@/lib/transfer/buildSummary"
import { makeRecordSearch, parseSearchTerms } from "@/lib/search/recordSearch"
import { usePersistedState, setSerializers } from "@/lib/hooks/usePersistedState"

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

// Fields matched by the smart search box (record-level, multi-term, AND).
const TRANSFER_SEARCH_FIELDS: (keyof TransferRecord & string)[] = [
  "transfer_id", "challan_no", "lot_number", "item_description", "item_category",
  "sub_category", "material_type", "from_warehouse", "to_warehouse", "vehicle_no",
  "driver_name", "created_by", "status", "received_status", "remark", "transfer_date",
  "issue_items",
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

  // Filters persisted to sessionStorage so back-navigation restores them.
  const NS = `${company}:transfer-dashboard`
  const [dateFrom, setDateFrom] = usePersistedState(`${NS}:dateFrom`, "")
  const [dateTo, setDateTo] = usePersistedState(`${NS}:dateTo`, "")
  const [selFrom, setSelFrom] = usePersistedState<Set<string>>(`${NS}:selFrom`, new Set(), setSerializers)
  const [selTo, setSelTo] = usePersistedState<Set<string>>(`${NS}:selTo`, new Set(), setSerializers)
  const [selCategory, setSelCategory] = usePersistedState<Set<string>>(`${NS}:selCategory`, new Set(), setSerializers)
  const [selMaterial, setSelMaterial] = usePersistedState<Set<string>>(`${NS}:selMaterial`, new Set(), setSerializers)
  const [selStatus, setSelStatus] = usePersistedState<Set<string>>(`${NS}:selStatus`, new Set(), setSerializers)
  const [showIssuesOnly, setShowIssuesOnly] = usePersistedState(`${NS}:showIssuesOnly`, false)

  const [groupBy, setGroupBy] = usePersistedState<GroupByKey>(`${NS}:groupBy`, "from_warehouse")
  const [thenBy, setThenBy] = usePersistedState<GroupByKey | "none">(`${NS}:thenBy`, DEFAULT_THEN_BY["from_warehouse"])
  const [viewMode, setViewMode] = usePersistedState<ViewMode>(`${NS}:viewMode`, "both")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [allExpanded, setAllExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"weight" | "boxes" | "count" | "name">("weight")
  const [selectedTransfer, setSelectedTransfer] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)

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

  // Dimensions selectable as the second level (then-by): not the current L1,
  // not locked by a filter.
  const thenByOptions = useMemo(() =>
    GROUP_OPTIONS.filter(g => g.value !== groupBy && !lockedDimensions.has(g.value)),
  [groupBy, lockedDimensions])

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

  // Normalize raw API records: canonical warehouse + category folding so
  // case/spacing duplicates collapse in chips and grouping.
  const applyData = useCallback((rawRecords: TransferRecord[], opts: TransferFilterOptions | null) => {
    const normalized: TransferRecord[] = (rawRecords || []).map((r) => ({
      ...r,
      from_warehouse: normalizeWarehouseName(r.from_warehouse) || r.from_warehouse || "",
      to_warehouse: normalizeWarehouseName(r.to_warehouse) || r.to_warehouse || "",
      item_category: canonicalizeCategory(r.item_category),
      sub_category: canonicalizeCategory(r.sub_category),
      material_type: canonicalizeCategory(r.material_type),
    }))
    setAllRecords(normalized)
    if (opts) setFilterOpts(opts)
  }, [])

  // Stale-while-revalidate: a silent run keeps the table on screen (no skeleton)
  // and only swaps numbers in; the skeleton shows only on the first-ever load.
  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false
    if (silent) setRefreshing(true)
    else { setLoading(true); setError(null) }
    try {
      const [data, fopts] = await Promise.all([
        transferDashboardApi.getAllData(),
        transferDashboardApi.getFilterOptions(),
      ])
      applyData(data.records || [], fopts)
      writeTransferCache(data, fopts, company)
      setLastUpdated(Date.now())
      setRefreshError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load"
      if (silent) setRefreshError(msg)   // keep cached data on screen
      else setError(msg)
    } finally {
      if (silent) setRefreshing(false)
      else setLoading(false)
    }
  }, [applyData])

  // On mount: paint instantly from cache (if any), then revalidate in background.
  useEffect(() => {
    const cached = readTransferCache(company)
    if (cached) {
      applyData(cached.records, cached.filterOptions)
      setLastUpdated(cached.savedAt)
      setLoading(false)
      fetchData({ silent: true })
    } else {
      fetchData({ silent: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-switch groupBy when current dimension gets locked by a filter
  useEffect(() => {
    if (lockedDimensions.has(groupBy) && availableGroupOptions.length > 0) {
      setGroupBy(availableGroupOptions[0].value)
      setExpanded(new Set()); setAllExpanded(false)
    }
  }, [lockedDimensions, groupBy, availableGroupOptions])

  // Keep thenBy (L2) valid: never equal to groupBy, never a locked dimension.
  useEffect(() => {
    const invalid = thenBy !== "none" && (thenBy === groupBy || lockedDimensions.has(thenBy))
    if (invalid) {
      const def = DEFAULT_THEN_BY[groupBy]
      const ok = def !== "none" && def !== groupBy && !lockedDimensions.has(def)
      setThenBy(ok ? def : "none")
    }
  }, [thenBy, groupBy, lockedDimensions])

  // Smart search: record-level, multi-term (every word must match somewhere),
  // across all fields. It drives the whole screen (KPIs, tree, Grand Total) so
  // everything reduces to what's searched.
  const searchTerms = useMemo(() => parseSearchTerms(searchQuery), [searchQuery])
  const isSearching = searchTerms.length > 0
  const searchMatch = useMemo(
    () => makeRecordSearch<TransferRecord>(searchQuery, TRANSFER_SEARCH_FIELDS),
    [searchQuery],
  )

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
    if (!searchMatch(r)) return false
    return true
  }), [allRecords, dateFrom, dateTo, selFrom, selTo, selCategory, selMaterial, selStatus, showIssuesOnly, searchMatch])

  // KPIs
  const kpis = useMemo(() => {
    const transfers = new Set(filtered.map(r => r.transfer_id))
    const totalNet = filtered.reduce((s, r) => s + (r.net_weight || 0), 0)
    const totalGross = filtered.reduce((s, r) => s + (r.total_weight || 0), 0)
    const totalBoxes = filtered.reduce((s, r) => s + (r.box_count || 0), 0)
    const pending = new Set(filtered.filter(r => r.status === "Dispatch" || r.status === "Pending").map(r => r.transfer_id))
    const notReceived = new Set(filtered.filter(r => r.received_status !== "Received").map(r => r.transfer_id))
    const whs = new Set([...filtered.map(r => r.from_warehouse), ...filtered.map(r => r.to_warehouse)].filter(Boolean))
    const issueTransfers = new Set(filtered.filter(r => r.has_issue).map(r => r.transfer_id))
    const totalIssueItems = filtered.filter(r => r.has_issue).reduce((s, r) => s + (r.issue_count || 0), 0)
    return {
      total_transfers: transfers.size,
      total_weight: totalNet || totalGross,
      total_net_weight: totalNet,
      total_gross_weight: totalGross,
      total_boxes: totalBoxes, pending_count: pending.size, not_received: notReceived.size, warehouses_active: whs.size, issue_transfers: issueTransfers.size, issue_items: totalIssueItems,
    }
  }, [filtered])

  // Grouped summary — explicit, predictable hierarchy (L1 = groupBy,
  // L2 = thenBy or none, leaf = item rows). The active sort cascades into
  // every layer; search already pruned `filtered` to matches.
  const summary = useMemo(
    () => buildSummary({ records: filtered, groupBy, thenBy, sortBy }),
    [filtered, groupBy, thenBy, sortBy],
  )

  const toggle = (k: string) => setExpanded(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })

  // Every expandable key in the current tree (L1, L2, and item rows).
  const allKeys = useMemo(() => {
    const keys = new Set<string>()
    summary.forEach(l1 => {
      keys.add(l1.label)
      if (l1.children) {
        l1.children.forEach(l2 => {
          const k2 = l1.label + "|||" + l2.label
          keys.add(k2)
          l2.items?.forEach(it => keys.add(k2 + "|||" + it.item_description))
        })
      } else {
        l1.items?.forEach(it => keys.add(l1.label + "|||" + it.item_description))
      }
    })
    return keys
  }, [summary])

  // While searching, auto-expand everything so matches are revealed inline; the
  // user's manual expansion is preserved for when the search is cleared.
  const effExpanded = isSearching ? allKeys : expanded

  const toggleAll = () => {
    if (allExpanded) { setExpanded(new Set()); setAllExpanded(false); return }
    setExpanded(new Set(allKeys)); setAllExpanded(true)
  }

  const clearFilters = () => { setDateFrom(""); setDateTo(""); setSelFrom(new Set()); setSelTo(new Set()); setSelCategory(new Set()); setSelMaterial(new Set()); setSelStatus(new Set()); setShowIssuesOnly(false) }

  const showVal = (weight: number, boxes: number, net?: number, gross?: number) => {
    const netW = net ?? weight
    const grossW = gross ?? 0
    const hasGross = grossW > 0 && grossW !== netW
    const weightBlock = (
      <>
        <div className="tabular-nums">{fmtN(netW)} <span className="text-[10px] text-muted-foreground">Kgs net</span></div>
        {hasGross && <div className="text-[10px] text-muted-foreground tabular-nums">{fmtN(grossW)} Kgs gross</div>}
      </>
    )
    if (viewMode === "kgs") return weightBlock
    if (viewMode === "boxes") return <span className="tabular-nums">{fmtN(boxes)} Boxes</span>
    return <>{weightBlock}<div className="text-[10px] text-muted-foreground tabular-nums">{fmtN(boxes)} Boxes</div></>
  }

  const handleCopy = async () => {
    const fmtWt = (net: number, gross: number) =>
      `${fmtN(net || gross)} Kg net` + (gross > 0 && gross !== net ? ` / ${fmtN(gross)} Kg gross` : "")
    const lines = [
      `Transfer Summary - ${format(new Date(), "dd MMM yyyy")}`,
      `Total: ${kpis.total_transfers} transfers | ${fmtWt(kpis.total_net_weight, kpis.total_gross_weight)}`,
      "",
    ]
    summary.forEach(l1 => lines.push(`${l1.label}  ${l1.tx_count} TRs  ${fmtWt(l1.total_net_weight, l1.total_gross_weight)}  ${fmtN(l1.total_boxes)} Boxes`))
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
                {lastUpdated && <span className="ml-2">&middot; Updated {format(new Date(lastUpdated), "HH:mm")}</span>}
                {refreshing && <span className="ml-2 text-teal-600">&middot; refreshing&hellip;</span>}
                {refreshError && !refreshing && <span className="ml-2 text-amber-600">&middot; refresh failed</span>}
                {activeFilterCount > 0 && <span className="ml-2 text-teal-600">&middot; {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => fetchData({ silent: true })}>
              <RefreshCw className={cn("h-3.5 w-3.5", (loading || refreshing) && "animate-spin")} /><span className="hidden sm:inline">Refresh</span>
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

              {/* Row 2: From / To Warehouse chip multi-selects. Click to add, click to remove. */}
              <div className="px-4 py-4 border-b space-y-3">
                {/* FROM chips */}
                <div>
                  <label className="flex items-center gap-2 mb-2">
                    <div className="h-3 w-3 rounded-full bg-blue-500 flex-shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">From Warehouse</span>
                    {selFrom.size > 0 && (
                      <button onClick={() => setSelFrom(new Set())} className="text-[10px] text-red-600 hover:underline ml-auto">
                        Clear ({selFrom.size})
                      </button>
                    )}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {cascadedOpts.from_warehouses.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">No warehouses in current filter</span>
                    )}
                    {cascadedOpts.from_warehouses.map(w => {
                      const active = selFrom.has(w)
                      return (
                        <button key={w}
                          onClick={() => {
                            const next = new Set(selFrom)
                            if (active) next.delete(w)
                            else {
                              next.add(w)
                              // Remove the same warehouse from TO if present — can't ship to and from the same WH.
                              if (selTo.has(w)) { const t = new Set(selTo); t.delete(w); setSelTo(t) }
                            }
                            setSelFrom(next)
                          }}
                          className={cn("text-xs font-medium px-3 py-1.5 rounded-lg border-2 transition-all",
                            active
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                              : "bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 border-slate-200 dark:border-slate-600 hover:border-blue-300")}>
                          {getDisplayWarehouseName(w)}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <ArrowRight className="h-4 w-4" />
                  <span className="text-[10px] uppercase tracking-wider">ship direction — pick any combination of source and destination</span>
                </div>

                {/* TO chips */}
                <div>
                  <label className="flex items-center gap-2 mb-2">
                    <div className="h-3 w-3 rounded-full bg-emerald-500 flex-shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">To Warehouse</span>
                    {selTo.size > 0 && (
                      <button onClick={() => setSelTo(new Set())} className="text-[10px] text-red-600 hover:underline ml-auto">
                        Clear ({selTo.size})
                      </button>
                    )}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {cascadedOpts.to_warehouses.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">No warehouses in current filter</span>
                    )}
                    {cascadedOpts.to_warehouses.map(w => {
                      const sameAsFrom = selFrom.has(w)
                      const active = selTo.has(w)
                      return (
                        <button key={w}
                          disabled={sameAsFrom}
                          title={sameAsFrom ? "Already selected as From" : undefined}
                          onClick={() => {
                            const next = new Set(selTo)
                            if (active) next.delete(w)
                            else next.add(w)
                            setSelTo(next)
                          }}
                          className={cn("text-xs font-medium px-3 py-1.5 rounded-lg border-2 transition-all",
                            sameAsFrom
                              ? "bg-slate-100 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-60"
                              : active
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                : "bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-slate-200 dark:border-slate-600 hover:border-emerald-300")}>
                          {getDisplayWarehouseName(w)}
                        </button>
                      )
                    })}
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
            {(viewMode === "kgs" || viewMode === "both") && (
              <KPI
                icon={<Package className="h-4 w-4" />}
                label="Net / Gross Weight"
                value={
                  fmtN(kpis.total_net_weight || kpis.total_gross_weight) + " Kgs" +
                  (kpis.total_gross_weight > 0 && kpis.total_gross_weight !== kpis.total_net_weight
                    ? ` / ${fmtN(kpis.total_gross_weight)}`
                    : "")
                }
              />
            )}
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
                      <button key={g.value} onClick={() => { setGroupBy(g.value); setThenBy(DEFAULT_THEN_BY[g.value]); setExpanded(new Set()); setAllExpanded(false) }}
                        className={cn("px-2 py-1.5 transition-colors whitespace-nowrap", groupBy === g.value ? "bg-[#0f172a] text-white" : "hover:bg-slate-100")}>{g.label}</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">then by:</span>
                  <select
                    value={thenBy}
                    onChange={e => { setThenBy(e.target.value as GroupByKey | "none"); setExpanded(new Set()); setAllExpanded(false) }}
                    className="h-7 rounded-lg border bg-white dark:bg-slate-800 text-xs px-2"
                  >
                    {thenByOptions.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                    <option value="none">None (items only)</option>
                  </select>
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
            <div>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b bg-muted/60">
                    <th className="text-left text-xs uppercase tracking-wider font-medium px-3 py-2.5 min-w-0">Category</th>
                    <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2.5 w-[60px]">TRs</th>
                    <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2.5 w-[160px]">{viewMode === "boxes" ? "Boxes" : viewMode === "kgs" ? "Weight (Kgs)" : "Weight / Boxes"}</th>
                    <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2.5 w-[80px]">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map(l1 => {
                    const k1 = l1.label; const o1 = effExpanded.has(k1)
                    return (<React.Fragment key={k1}>
                      <tr className="border-b cursor-pointer hover:opacity-90 transition-colors bg-[#0f172a] text-white font-semibold" onClick={() => toggle(k1)}>
                        <td className="px-3 py-2.5 pl-3">
                          <span className="inline-flex items-center gap-1.5">
                            {o1 ? <ChevronDown className="h-4 w-4 text-teal-400" /> : <ChevronRight className="h-4 w-4 text-teal-400" />}{l1.label}
                            {l1.pending_count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">{l1.pending_count} pending</span>}
                          </span>
                        </td>
                        <td className="text-right px-3 py-2.5 tabular-nums">{l1.tx_count}</td>
                        <td className="text-right px-3 py-2.5">{showVal(l1.total_weight, l1.total_boxes, l1.total_net_weight, l1.total_gross_weight)}</td>
                        <td className="text-right px-3 py-2.5 tabular-nums">{l1.pending_count || ""}</td>
                      </tr>

                      {/* L2 groups (then-by) → item rows → transfer detail */}
                      {o1 && l1.children && l1.children.map(l2 => {
                        const k2 = k1 + "|||" + l2.label; const o2 = effExpanded.has(k2)
                        return (<React.Fragment key={k2}>
                          <tr className="border-b cursor-pointer hover:bg-slate-200/50 transition-colors bg-slate-100 dark:bg-slate-800 font-medium border-l-[3px] border-l-teal-500" onClick={() => toggle(k2)}>
                            <td className="px-3 py-2 pl-8"><span className="inline-flex items-center gap-1.5">{o2 ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}{l2.label}</span></td>
                            <td className="text-right px-3 py-2 tabular-nums">{l2.tx_count}</td>
                            <td className="text-right px-3 py-2">{showVal(l2.total_weight, l2.total_boxes, l2.total_net_weight, l2.total_gross_weight)}</td>
                            <td />
                          </tr>
                          {o2 && l2.items && l2.items.map(it => {
                            const k3 = k2 + "|||" + it.item_description; const o3 = effExpanded.has(k3)
                            return (<React.Fragment key={k3}>
                              <ItemRow k={k3} o={o3} l3={it} indent="pl-14" toggle={toggle} showVal={showVal} />
                              {o3 && <TransferRows records={it.records} showVal={showVal} indent="pl-20" onClickTransfer={setSelectedTransfer} />}
                            </React.Fragment>)
                          })}
                        </React.Fragment>)
                      })}

                      {/* No L2 (then by = none) — item rows directly under L1 */}
                      {o1 && !l1.children && l1.items && l1.items.map(it => {
                        const k3 = k1 + "|||" + it.item_description; const o3 = effExpanded.has(k3)
                        return (<React.Fragment key={k3}>
                          <ItemRow k={k3} o={o3} l3={it} indent="pl-8" toggle={toggle} showVal={showVal} />
                          {o3 && <TransferRows records={it.records} showVal={showVal} indent="pl-14" onClickTransfer={setSelectedTransfer} />}
                        </React.Fragment>)
                      })}
                    </React.Fragment>)
                  })}
                  <tr className="border-t-2 border-slate-300 bg-[#0f172a] text-white font-bold">
                    <td className="px-3 py-2.5">Grand Total</td>
                    <td className="text-right px-3 py-2.5 tabular-nums">{kpis.total_transfers}</td>
                    <td className="text-right px-3 py-2.5">{showVal(kpis.total_weight, kpis.total_boxes, kpis.total_net_weight, kpis.total_gross_weight)}</td>
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
  // Local overrides for inline weight edits — keyed by line index. Not persisted;
  // they recompute the totals in the header and footer rows live as the user types.
  const [weightOverrides, setWeightOverrides] = useState<Record<number, { net?: number; gross?: number }>>({})
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set())
  // Reset overrides and expansion when the popup target changes.
  useEffect(() => {
    setWeightOverrides({})
    setExpandedLines(new Set())
  }, [transferId])
  const effectiveNet = (i: number, l: TransferRecord) =>
    weightOverrides[i]?.net ?? (l.net_weight || 0)
  const effectiveGross = (i: number, l: TransferRecord) =>
    weightOverrides[i]?.gross ?? (l.total_weight || 0)
  const totalNetWeight = lines.reduce((s, r, i) => s + effectiveNet(i, r), 0)
  const totalGrossWeight = lines.reduce((s, r, i) => s + effectiveGross(i, r), 0)
  const primaryWeight = totalNetWeight || totalGrossWeight
  const totalQty = lines.reduce((s, r) => s + (r.qty || 0), 0)
  const toggleLine = (i: number) =>
    setExpandedLines(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
  const setOverride = (i: number, field: "net" | "gross", raw: string) => {
    setWeightOverrides(prev => {
      const next = { ...prev }
      const row = { ...(next[i] || {}) }
      if (raw === "") delete row[field]
      else {
        const v = parseFloat(raw)
        if (isFinite(v)) row[field] = v
      }
      if (row.net === undefined && row.gross === undefined) delete next[i]
      else next[i] = row
      return next
    })
  }
  const resetOverride = (i: number) => {
    setWeightOverrides(prev => { const n = { ...prev }; delete n[i]; return n })
  }

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
          <InfoCell label="From" value={getDisplayWarehouseName(hdr.from_warehouse)} />
          <InfoCell label="To" value={getDisplayWarehouseName(hdr.to_warehouse)} />
          <InfoCell label="Vehicle" value={hdr.vehicle_no || "—"} />
          <InfoCell label="Driver" value={hdr.driver_name || "—"} />
          <InfoCell label="Created By" value={hdr.created_by || "—"} />
          <InfoCell label="Total Items" value={lines.length.toString()} />
          <InfoCell label="Total Qty" value={fmtN(totalQty)} />
          <InfoCell
            label="Net Weight"
            value={fmtN(Math.round(primaryWeight)) + " Kgs" +
              (totalGrossWeight > 0 && totalGrossWeight !== totalNetWeight ? ` (Gross ${fmtN(Math.round(totalGrossWeight))})` : "")}
          />
          {hdr.box_count > 0 && <InfoCell label="Boxes" value={fmtN(hdr.box_count)} />}
          {hdr.remark && <div className="col-span-2 sm:col-span-3"><InfoCell label="Remark" value={hdr.remark} /></div>}
        </div>

        {/* Line Items Table with per-line expand/collapse + live weight edit */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold">Items / Articles</h4>
            {Object.keys(weightOverrides).length > 0 && (
              <button onClick={() => setWeightOverrides({})} className="text-[11px] text-red-600 hover:underline">
                Reset all weight edits ({Object.keys(weightOverrides).length})
              </button>
            )}
          </div>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-8"></th>
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
                {lines.map((ln, i) => {
                  const isOpen = expandedLines.has(i)
                  const ov = weightOverrides[i]
                  const curNet = effectiveNet(i, ln)
                  const curGross = effectiveGross(i, ln)
                  const perBoxNet = ln.box_count > 0 ? curNet / ln.box_count : curNet
                  const perBoxGross = ln.box_count > 0 ? curGross / ln.box_count : curGross
                  return (
                    <React.Fragment key={i}>
                      <tr className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => toggleLine(i)}>
                        <td className="px-2 py-2 text-muted-foreground">
                          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{ln.item_description}</td>
                        <td className="px-3 py-2">{ln.item_category}{ln.sub_category ? ` / ${ln.sub_category}` : ""}</td>
                        <td className="px-3 py-2">
                          {ln.material_type && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px]">{ln.material_type}</span>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{ln.lot_number || "—"}</td>
                        <td className="text-right px-3 py-2 tabular-nums">{fmtN(ln.qty)}</td>
                        <td className={cn("text-right px-3 py-2 tabular-nums", ov?.net !== undefined && "text-blue-600 font-medium")}>
                          {fmtN(Math.round(curNet))}
                        </td>
                        <td className={cn("text-right px-3 py-2 tabular-nums", ov?.gross !== undefined && "text-blue-600 font-medium")}>
                          {fmtN(Math.round(curGross))}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b bg-slate-50/60 dark:bg-slate-900/40">
                          <td />
                          <td colSpan={8} className="px-4 py-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Net Weight (Kg)</label>
                                <input
                                  type="number"
                                  step="any"
                                  defaultValue={ln.net_weight || 0}
                                  onChange={e => setOverride(i, "net", e.target.value)}
                                  className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs tabular-nums"
                                />
                                <p className="text-[10px] text-muted-foreground">
                                  {ln.box_count > 0 ? `${perBoxNet.toFixed(2)} Kg × ${ln.box_count} box${ln.box_count > 1 ? "es" : ""}` : "—"}
                                </p>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Gross Weight (Kg)</label>
                                <input
                                  type="number"
                                  step="any"
                                  defaultValue={ln.total_weight || 0}
                                  onChange={e => setOverride(i, "gross", e.target.value)}
                                  className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs tabular-nums"
                                />
                                <p className="text-[10px] text-muted-foreground">
                                  {ln.box_count > 0 ? `${perBoxGross.toFixed(2)} Kg × ${ln.box_count} box${ln.box_count > 1 ? "es" : ""}` : "—"}
                                </p>
                              </div>
                              <div className="sm:col-span-2 flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>Original: Net {fmtN(Math.round(ln.net_weight || 0))} · Gross {fmtN(Math.round(ln.total_weight || 0))} Kg</span>
                                {ov && (
                                  <button onClick={() => resetOverride(i)} className="text-red-600 hover:underline">
                                    Reset this line
                                  </button>
                                )}
                              </div>
                              <div className="sm:col-span-2 text-[10px] italic text-muted-foreground">
                                Edits are local to this view — they recompute the totals below without saving to the backend.
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
                {/* Totals row — auto-recomputes when weights are edited */}
                <tr className="bg-muted/50 font-semibold">
                  <td />
                  <td className="px-3 py-2" colSpan={5}>Total</td>
                  <td className="text-right px-3 py-2 tabular-nums">{fmtN(totalQty)}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{fmtN(Math.round(totalNetWeight))}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{fmtN(Math.round(totalGrossWeight))}</td>
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

function ItemRow({ k, o, l3, indent, toggle, showVal }: {
  k: string
  o: boolean
  l3: { item_description: string; material_type: string; tx_count: number; total_weight: number; total_boxes: number; total_net_weight?: number; total_gross_weight?: number }
  indent: string
  toggle: (k: string) => void
  showVal: (w: number, b: number, net?: number, gross?: number) => React.ReactNode
}) {
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
      <td className="text-right px-3 py-2">{showVal(l3.total_weight, l3.total_boxes, l3.total_net_weight, l3.total_gross_weight)}</td>
      <td />
    </tr>
  )
}

// ── Transfer detail rows (L4) — improved card-style ──
function TransferRows({ records, showVal, indent, onClickTransfer }: {
  records: TransferRecord[]
  showVal: (w: number, b: number, net?: number, gross?: number) => React.ReactNode
  indent: string
  onClickTransfer: (id: number) => void
}) {
  // Deduplicate by transfer_id to show consolidated per-transfer.
  // Accumulate net and gross separately so the row can show both.
  const seen = new Map<number, TransferRecord & { line_count: number; total_net: number; total_gross: number }>()
  for (const r of records) {
    if (seen.has(r.transfer_id)) {
      const ex = seen.get(r.transfer_id)!
      ex.line_count++
      ex.total_net += (r.net_weight || 0)
      ex.total_gross += (r.total_weight || 0)
    } else {
      seen.set(r.transfer_id, { ...r, line_count: 1, total_net: r.net_weight || 0, total_gross: r.total_weight || 0 })
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
              <span className="font-medium text-foreground/70">{getDisplayWarehouseName(tx.from_warehouse)} → {getDisplayWarehouseName(tx.to_warehouse)}</span>
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
      <td className="text-right px-3 py-2.5 align-top">{showVal(tx.total_net || tx.total_gross, tx.box_count, tx.total_net, tx.total_gross)}</td>
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
