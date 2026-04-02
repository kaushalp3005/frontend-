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
  Download, Copy, Loader2, ArrowLeft, Package,
  Users, ShoppingCart, AlertTriangle, X, History, Send,
  Search, ArrowUpDown,
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { useAuthStore } from "@/lib/stores/auth"
import {
  inwardDashboardApi,
  type InwardRecord, type FilterOptions, type ItemHistory, type VendorHistory,
} from "@/lib/api/inwardDashboardApi"

interface Props { params: { company: string } }

const fmtN = (n: number) => (n !== null && n !== undefined) ? Math.round(n).toLocaleString("en-IN") : "0"
const fmtV = (n: number) => (n !== null && n !== undefined && n !== 0) ? "₹" + Math.round(n).toLocaleString("en-IN") : "₹0"
const fmtR = (n: number) => n ? "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"

type ViewMode = "kgs" | "value" | "both"
type GroupByKey = "warehouse" | "vendor" | "customer" | "item_category" | "sub_category" | "material_type" | "month" | "purchased_by"

const GROUP_OPTIONS: { value: GroupByKey; label: string }[] = [
  { value: "warehouse", label: "Warehouse" }, { value: "vendor", label: "Vendor" },
  { value: "customer", label: "Customer" }, { value: "item_category", label: "Category" },
  { value: "sub_category", label: "Sub Category" }, { value: "material_type", label: "Material" },
  { value: "month", label: "Month" }, { value: "purchased_by", label: "Purchased By" },
]

const DATE_PRESETS = [
  { label: "Today", fn: () => { const d = format(new Date(), "yyyy-MM-dd"); return [d, d] } },
  { label: "This Month", fn: () => [format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"), format(new Date(), "yyyy-MM-dd")] },
  { label: "Last Month", fn: () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return [format(new Date(d.getFullYear(), d.getMonth(), 1), "yyyy-MM-dd"), format(new Date(d.getFullYear(), d.getMonth() + 1, 0), "yyyy-MM-dd")] } },
  { label: "This FY", fn: () => { const y = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1; return [`${y}-04-01`, format(new Date(), "yyyy-MM-dd")] } },
  { label: "All Time", fn: () => ["", ""] },
]

function chipToggle(set: Set<string>, val: string): Set<string> {
  const n = new Set(set); n.has(val) ? n.delete(val) : n.add(val); return n
}

// ═══════════════════════════════════════════════════════════════════
const DASHBOARD_ALLOWED_EMAILS = ["yash@candorfoods.in", "b.hrithik@candorfoods.in"]

export default function InwardDashboard({ params }: Props) {
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

  // Data
  const [allRecords, setAllRecords] = useState<InwardRecord[]>([])
  const [filterOpts, setFilterOpts] = useState<FilterOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters (client-side — no refetch)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selWarehouses, setSelWarehouses] = useState<Set<string>>(new Set())
  const [selVendors, setSelVendors] = useState<Set<string>>(new Set())
  const [selCustomers, setSelCustomers] = useState<Set<string>>(new Set())
  const [selCategories, setSelCategories] = useState<Set<string>>(new Set())
  const [selMaterial, setSelMaterial] = useState<Set<string>>(new Set())
  const [selStatus, setSelStatus] = useState<Set<string>>(new Set())

  // View
  const [groupBy, setGroupBy] = useState<GroupByKey>("warehouse")
  const [viewMode, setViewMode] = useState<ViewMode>("both")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [allExpanded, setAllExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"value" | "weight" | "count" | "name">("value")

  // Popups
  const [itemPopup, setItemPopup] = useState<ItemHistory | null>(null)
  const [vendorPopup, setVendorPopup] = useState<VendorHistory | null>(null)
  const [popupLoading, setPopupLoading] = useState(false)

  // Load data once
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [data, opts] = await Promise.all([
        inwardDashboardApi.getAllData(company),
        inwardDashboardApi.getFilterOptions(company),
      ])
      setAllRecords(data.records); setFilterOpts(opts)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
    } finally { setLoading(false) }
  }, [company])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Client-side filtering (instant, no refetch) ──
  const activeFilterCount = [dateFrom, dateTo].filter(Boolean).length +
    [selWarehouses, selVendors, selCustomers, selCategories, selMaterial, selStatus].filter(s => s.size > 0).length

  const filtered = useMemo(() => {
    return allRecords.filter(r => {
      if (dateFrom && r.entry_date < dateFrom) return false
      if (dateTo && r.entry_date > dateTo) return false
      if (selWarehouses.size > 0 && !selWarehouses.has(r.warehouse)) return false
      if (selVendors.size > 0 && !selVendors.has(r.vendor)) return false
      if (selCustomers.size > 0 && !selCustomers.has(r.customer)) return false
      if (selCategories.size > 0 && !selCategories.has(r.item_category)) return false
      if (selMaterial.size > 0 && !selMaterial.has(r.material_type)) return false
      if (selStatus.size > 0 && !selStatus.has(r.status)) return false
      return true
    })
  }, [allRecords, dateFrom, dateTo, selWarehouses, selVendors, selCustomers, selCategories, selMaterial, selStatus])

  // ── Cascading filter options (only show options available in current filtered set) ──
  const cascadedOpts = useMemo(() => {
    // For each filter dimension, compute available values from records that pass ALL OTHER filters
    const filterExcluding = (exclude: string) => allRecords.filter(r => {
      if (dateFrom && r.entry_date < dateFrom) return false
      if (dateTo && r.entry_date > dateTo) return false
      if (exclude !== "warehouse" && selWarehouses.size > 0 && !selWarehouses.has(r.warehouse)) return false
      if (exclude !== "vendor" && selVendors.size > 0 && !selVendors.has(r.vendor)) return false
      if (exclude !== "customer" && selCustomers.size > 0 && !selCustomers.has(r.customer)) return false
      if (exclude !== "category" && selCategories.size > 0 && !selCategories.has(r.item_category)) return false
      if (exclude !== "material" && selMaterial.size > 0 && !selMaterial.has(r.material_type)) return false
      if (exclude !== "status" && selStatus.size > 0 && !selStatus.has(r.status)) return false
      return true
    })

    const countBy = (recs: InwardRecord[], field: (r: InwardRecord) => string) => {
      const map = new Map<string, number>()
      for (const r of recs) { const v = field(r); if (v) map.set(v, (map.get(v) || 0) + 1) }
      return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
    }

    return {
      warehouses: countBy(filterExcluding("warehouse"), r => r.warehouse),
      vendors: countBy(filterExcluding("vendor"), r => r.vendor),
      customers: countBy(filterExcluding("customer"), r => r.customer),
      categories: [...new Set(filterExcluding("category").map(r => r.item_category).filter(Boolean))].sort(),
      materials: [...new Set(filterExcluding("material").map(r => r.material_type).filter(Boolean))].sort(),
      statuses: [...new Set(filterExcluding("status").map(r => r.status).filter(Boolean))].sort(),
    }
  }, [allRecords, dateFrom, dateTo, selWarehouses, selVendors, selCustomers, selCategories, selMaterial, selStatus])

  // ── KPIs (computed from filtered) ──
  const kpis = useMemo(() => {
    const txns = new Set(filtered.map(r => r.transaction_no))
    const totalWeight = filtered.reduce((s, r) => s + (r.total_weight || 0), 0)
    const totalValue = filtered.reduce((s, r) => s + (r.total_amount || 0), 0)
    const vendors = new Set(filtered.map(r => r.vendor).filter(Boolean))
    const items = new Set(filtered.map(r => r.item_description).filter(Boolean))
    const pending = new Set(filtered.filter(r => r.status === "pending").map(r => r.transaction_no))
    return {
      total_inwards: txns.size, total_weight: totalWeight, total_value: totalValue,
      unique_vendors: vendors.size, unique_items: items.size, pending_count: pending.size,
    }
  }, [filtered])

  // ── Grouped summary (computed from filtered) ──
  const groupField = (r: InwardRecord): string => {
    switch (groupBy) {
      case "warehouse": return r.warehouse || "Unassigned"
      case "vendor": return r.vendor || "Unknown"
      case "customer": return r.customer || "Unknown"
      case "item_category": return r.item_category || "Uncategorized"
      case "sub_category": return r.sub_category || "General"
      case "material_type": return r.material_type || "N/A"
      case "month": return r.entry_month || "Unknown"
      case "purchased_by": return r.purchased_by || "Unknown"
    }
  }

  const summary = useMemo(() => {
    // L1: group
    const l1Map = new Map<string, { records: InwardRecord[] }>()
    for (const r of filtered) {
      const g = groupField(r)
      if (!l1Map.has(g)) l1Map.set(g, { records: [] })
      l1Map.get(g)!.records.push(r)
    }

    // L2: within each L1, group by item_category (or warehouse if L1 is category)
    const l2Field = (r: InwardRecord) => {
      if (groupBy === "item_category" || groupBy === "sub_category") return r.warehouse || "Unassigned"
      return r.item_category || "Uncategorized"
    }

    const data = Array.from(l1Map.entries()).map(([label, { records }]) => {
      const txns = new Set(records.map(r => r.transaction_no))
      const weight = records.reduce((s, r) => s + (r.total_weight || 0), 0)
      const value = records.reduce((s, r) => s + (r.total_amount || 0), 0)
      const vendors = new Set(records.map(r => r.vendor).filter(Boolean))
      const skus = new Set(records.map(r => r.item_description).filter(Boolean))
      const pending = new Set(records.filter(r => r.status === "pending").map(r => r.transaction_no))

      // L2
      const l2Map = new Map<string, InwardRecord[]>()
      for (const r of records) {
        const k = l2Field(r)
        if (!l2Map.has(k)) l2Map.set(k, [])
        l2Map.get(k)!.push(r)
      }
      const children = Array.from(l2Map.entries()).map(([sl, recs]) => {
        const sw = recs.reduce((s, r) => s + (r.total_weight || 0), 0)
        const sv = recs.reduce((s, r) => s + (r.total_amount || 0), 0)
        // L3: items
        const l3Map = new Map<string, InwardRecord[]>()
        for (const r of recs) {
          const k = r.item_description || "Unknown"
          if (!l3Map.has(k)) l3Map.set(k, [])
          l3Map.get(k)!.push(r)
        }
        const items = Array.from(l3Map.entries()).map(([item, irecs]) => {
          const iw = irecs.reduce((s, r) => s + (r.total_weight || 0), 0)
          const iv = irecs.reduce((s, r) => s + (r.total_amount || 0), 0)
          return {
            item_description: item, sku_id: irecs[0]?.sku_id,
            item_category: irecs[0]?.item_category || "", sub_category: irecs[0]?.sub_category || "",
            material_type: irecs[0]?.material_type || "",
            total_weight: iw, total_value: iv,
            avg_rate: iw > 0 ? iv / iw : 0,
            lot_count: new Set(irecs.map(r => r.lot_number).filter(Boolean)).size,
            tx_count: new Set(irecs.map(r => r.transaction_no)).size,
            records: irecs,
          }
        }).sort((a, b) => b.total_value - a.total_value)
        return {
          sub_label: sl, tx_count: new Set(recs.map(r => r.transaction_no)).size,
          total_weight: sw, total_value: sv,
          avg_rate: sw > 0 ? sv / sw : 0,
          vendor_count: new Set(recs.map(r => r.vendor).filter(Boolean)).size,
          sku_count: new Set(recs.map(r => r.item_description).filter(Boolean)).size,
          children: items,
        }
      }).sort((a, b) => b.total_value - a.total_value)

      return {
        group_label: label, tx_count: txns.size,
        total_weight: weight, total_value: value,
        avg_rate: weight > 0 ? value / weight : 0,
        vendor_count: vendors.size, sku_count: skus.size,
        pending_count: pending.size, children,
      }
    })

    // Apply search — filter L1 groups by search query across group_label, children labels, item names
    const sq = searchQuery.toLowerCase().trim()
    const searched = sq ? data.filter(l1 =>
      l1.group_label.toLowerCase().includes(sq) ||
      l1.children.some(l2 => l2.sub_label.toLowerCase().includes(sq) ||
        l2.children.some(l3 => l3.item_description.toLowerCase().includes(sq)))
    ) : data

    // Apply sort
    const sortFn = (a: typeof data[0], b: typeof data[0]) => {
      switch (sortBy) {
        case "value": return b.total_value - a.total_value
        case "weight": return b.total_weight - a.total_weight
        case "count": return b.tx_count - a.tx_count
        case "name": return a.group_label.localeCompare(b.group_label)
        default: return b.total_value - a.total_value
      }
    }

    return [...searched].sort(sortFn)
  }, [filtered, groupBy, searchQuery, sortBy])

  // Expand/collapse
  const toggle = (k: string) => setExpanded(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })
  const toggleAll = () => {
    if (allExpanded) { setExpanded(new Set()); setAllExpanded(false); return }
    const keys = new Set<string>()
    summary.forEach(l1 => { keys.add(l1.group_label); l1.children.forEach(l2 => keys.add(l1.group_label + "|||" + l2.sub_label)) })
    setExpanded(keys); setAllExpanded(true)
  }

  // Popups
  const openItem = async (item: string) => {
    setPopupLoading(true)
    try { setItemPopup(await inwardDashboardApi.getItemHistory(company, item)) } catch (e) { console.error(e) }
    finally { setPopupLoading(false) }
  }
  const openVendor = async (vendor: string) => {
    setPopupLoading(true)
    try { setVendorPopup(await inwardDashboardApi.getVendorHistory(company, vendor)) } catch (e) { console.error(e) }
    finally { setPopupLoading(false) }
  }

  // Clear all
  const clearFilters = () => {
    setDateFrom(""); setDateTo("")
    setSelWarehouses(new Set()); setSelVendors(new Set()); setSelCustomers(new Set())
    setSelCategories(new Set()); setSelMaterial(new Set()); setSelStatus(new Set())
  }

  // Copy
  const handleCopy = async () => {
    const lines = [`Inward Summary - ${format(new Date(), "dd MMM yyyy")} - ${company.toUpperCase()}`, ""]
    lines.push(`Total: ${kpis.total_inwards} TRs | ${fmtN(kpis.total_weight)} Kg | ${fmtV(kpis.total_value)}`, "")
    summary.forEach(l1 => lines.push(`${l1.group_label}  ${l1.tx_count} TRs  ${fmtN(l1.total_weight)} Kg  ${fmtV(l1.total_value)}`))
    try { await navigator.clipboard.writeText(lines.join("\n")); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }

  // Export
  const handleExport = async () => {
    try {
      const XLSX = (await import("xlsx")).default || (await import("xlsx"))
      const rows = filtered.map(r => ({
        "Transaction": r.transaction_no, "Date": r.entry_date, "Warehouse": r.warehouse,
        "Vendor": r.vendor, "Customer": r.customer, "Status": r.status,
        "Item": r.item_description, "Category": r.item_category, "Sub Category": r.sub_category,
        "Material": r.material_type, "Lot": r.lot_number, "Qty": r.qty,
        "Net Weight": r.net_weight, "Total Weight": r.total_weight,
        "Unit Rate": r.unit_rate, "Total Amount": r.total_amount,
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Inward Data")
      XLSX.writeFile(wb, `Inward_${company}_${format(new Date(), "ddMMMyyyy")}.xlsx`)
    } catch (err) { console.error(err) }
  }

  // Value display helper
  const showVal = (weight: number, value: number) => {
    if (viewMode === "kgs") return <span className="tabular-nums">{fmtN(weight)} <span className="text-[10px] text-muted-foreground">Kgs</span></span>
    if (viewMode === "value") return <span className="tabular-nums">{fmtV(value)}</span>
    return <><div className="tabular-nums">{fmtN(weight)} <span className="text-[10px] text-muted-foreground">Kgs</span></div><div className="text-[10px] text-muted-foreground tabular-nums">{fmtV(value)}</div></>
  }

  return (
    <PermissionGuard module="inward" action="view">
      <div className="p-3 sm:p-4 md:p-6 max-w-[1600px] mx-auto space-y-4">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href={`/${company}/inward`}><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Inward Summary</h1>
              <p className="text-xs text-muted-foreground">As of {format(new Date(), "dd-MMM-yyyy")} &middot; {company.toUpperCase()}
                {activeFilterCount > 0 && <span className="ml-2 text-teal-600">&middot; {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => { fetchData() }}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /><span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={handleCopy}>
              <Copy className="h-3.5 w-3.5" /><span className="hidden sm:inline">{copied ? "Copied!" : "Copy"}</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">Excel</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs opacity-50" disabled title="Coming Soon">
              <Send className="h-3.5 w-3.5" /><span className="hidden sm:inline">WhatsApp</span>
            </Button>
          </div>
        </div>

        {/* FILTER PANEL */}
        {!loading && filterOpts && (
          <Card className="border-2 border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <CardContent className="p-0">

              {/* Date Presets + Range */}
              <div className="flex flex-wrap items-center gap-2.5 px-5 py-3.5 bg-slate-50 dark:bg-slate-900/50 border-b">
                <div className="flex items-center gap-2 flex-wrap">
                  {DATE_PRESETS.map(p => (
                    <button key={p.label} onClick={() => { const [f, t] = p.fn(); setDateFrom(f); setDateTo(t) }}
                      className={cn("text-sm font-medium px-4 py-2 rounded-lg border-2 transition-all",
                        (!dateFrom && !dateTo && p.label === "All Time") || (dateFrom === p.fn()[0] && dateTo === p.fn()[1])
                          ? "bg-[#0f172a] text-white border-[#0f172a] shadow-sm" : "bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-600")}>{p.label}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-[150px] text-sm bg-white dark:bg-slate-800" />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-[150px] text-sm bg-white dark:bg-slate-800" />
                </div>
              </div>

              {/* Warehouse */}
              {cascadedOpts.warehouses.length > 0 && (
                <div className="flex flex-wrap items-center gap-2.5 px-5 py-3.5 border-b">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-[70px] flex-shrink-0">Warehouse</span>
                  <div className="flex flex-wrap gap-2">
                    {cascadedOpts.warehouses.map(w => (
                      <button key={w.name} onClick={() => setSelWarehouses(chipToggle(selWarehouses, w.name))}
                        className={cn("text-sm font-medium px-4 py-2 rounded-lg border-2 transition-all",
                          selWarehouses.has(w.name) ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 border-slate-200 dark:border-slate-600 hover:border-blue-300")}>
                        {w.name} <span className="text-xs opacity-70 ml-0.5">({w.count})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Status */}
              {cascadedOpts.statuses.length > 0 && (
                <div className="flex flex-wrap items-center gap-2.5 px-5 py-3.5 border-b bg-slate-50/50 dark:bg-slate-900/30">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-[70px] flex-shrink-0">Status</span>
                  <div className="flex flex-wrap gap-2">
                    {cascadedOpts.statuses.map(s => {
                      const colors: Record<string, { active: string; idle: string }> = {
                        approved: { active: "bg-emerald-600 text-white border-emerald-600 shadow-sm", idle: "hover:bg-emerald-50 hover:border-emerald-300" },
                        pending: { active: "bg-amber-500 text-white border-amber-500 shadow-sm", idle: "hover:bg-amber-50 hover:border-amber-300" },
                      }
                      const c = colors[s.toLowerCase()] || { active: "bg-teal-600 text-white border-teal-600 shadow-sm", idle: "hover:bg-slate-100 hover:border-slate-300" }
                      return (
                        <button key={s} onClick={() => setSelStatus(chipToggle(selStatus, s))}
                          className={cn("text-sm font-medium px-4 py-2 rounded-lg border-2 transition-all capitalize",
                            selStatus.has(s) ? c.active : `bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 ${c.idle}`)}>{s}</button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Category */}
              {cascadedOpts.categories.length > 0 && (
                <div className="flex flex-wrap items-start gap-2.5 px-5 py-3.5 border-b">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-[70px] flex-shrink-0 pt-2">Category</span>
                  <div className="flex flex-wrap gap-2 flex-1">
                    {cascadedOpts.categories.map(c => (
                      <button key={c} onClick={() => setSelCategories(chipToggle(selCategories, c))}
                        className={cn("text-sm font-medium px-3.5 py-1.5 rounded-lg border-2 transition-all",
                          selCategories.has(c) ? "bg-violet-600 text-white border-violet-600 shadow-sm" : "bg-white dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-950/30 border-slate-200 dark:border-slate-600 hover:border-violet-300")}>{c}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Material */}
              {cascadedOpts.materials.length > 0 && (
                <div className="flex flex-wrap items-center gap-2.5 px-5 py-3.5 border-b">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-[70px] flex-shrink-0">Material</span>
                  <div className="flex flex-wrap gap-2">
                    {cascadedOpts.materials.map(m => (
                      <button key={m} onClick={() => setSelMaterial(chipToggle(selMaterial, m))}
                        className={cn("text-sm font-medium px-4 py-2 rounded-lg border-2 transition-all",
                          selMaterial.has(m) ? "bg-orange-600 text-white border-orange-600 shadow-sm" : "bg-white dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-orange-950/30 border-slate-200 dark:border-slate-600 hover:border-orange-300")}>{m}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Clear All */}
              {activeFilterCount > 0 && (
                <div className="px-5 py-2.5 bg-red-50/50 dark:bg-red-950/10">
                  <button onClick={clearFilters} className="text-sm font-medium text-red-600 hover:text-red-700 flex items-center gap-1.5 transition-colors">
                    <X className="h-4 w-4" />Clear all filters ({activeFilterCount})
                  </button>
                </div>
              )}

            </CardContent>
          </Card>
        )}

        {error && <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg">{error}</div>}

        {/* KPI CARDS */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPI icon={<Package className="h-5 w-5" />} label="Total Inwards" value={fmtN(kpis.total_inwards)} color="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" />
            {(viewMode === "kgs" || viewMode === "both") && (
              <KPI icon={<Package className="h-5 w-5" />} label="Total Weight" value={fmtN(Math.round(kpis.total_weight)) + " Kgs"} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" />
            )}
            {(viewMode === "value" || viewMode === "both") && (
              <KPI icon={<ShoppingCart className="h-5 w-5" />} label="Total Value" value={fmtV(kpis.total_value)} color="bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400" />
            )}
            <KPI icon={<Users className="h-5 w-5" />} label="Vendors" value={fmtN(kpis.unique_vendors)} color="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400" />
            <KPI icon={<Package className="h-5 w-5" />} label="Items / SKUs" value={fmtN(kpis.unique_items)} color="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" />
            <KPI icon={<AlertTriangle className="h-5 w-5" />} label="Pending" value={fmtN(kpis.pending_count)} amber={kpis.pending_count > 0} color="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400" />
          </div>
        )}

        {/* GROUP BY + VIEW MODE */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Group:</span>
                <div className="flex rounded-lg border overflow-hidden text-xs">
                  {GROUP_OPTIONS.map(g => (
                    <button key={g.value} onClick={() => { setGroupBy(g.value); setExpanded(new Set()); setAllExpanded(false) }}
                      className={cn("px-2 py-1.5 transition-colors whitespace-nowrap", groupBy === g.value ? "bg-[#0f172a] text-white" : "hover:bg-slate-100")}>{g.label}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">View:</span>
                <div className="flex rounded-lg border overflow-hidden text-xs">
                  {(["kgs", "value", "both"] as ViewMode[]).map(v => (
                    <button key={v} onClick={() => setViewMode(v)}
                      className={cn("px-2.5 py-1.5 transition-colors capitalize", viewMode === v ? "bg-[#0f172a] text-white" : "hover:bg-slate-100")}>
                      {v === "kgs" ? "Kgs" : v === "value" ? "Value (₹)" : "Both"}
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
              <Input
                placeholder="Search within results..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="flex rounded-lg border overflow-hidden text-xs">
                {([
                  { value: "value" as const, label: "Value" },
                  { value: "weight" as const, label: "Weight" },
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

        {/* SUMMARY TABLE */}
        <Card><CardContent className="p-0">
          {loading ? <TableSkel /> : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">No records found</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
              {activeFilterCount > 0 && <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={clearFilters}>Clear Filters</Button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b bg-muted/60">
                    <th className="text-left text-xs uppercase tracking-wider font-medium px-3 py-2.5 min-w-[250px]">Category</th>
                    <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2.5 w-[60px]">TRs</th>
                    <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2.5 w-[160px]">{viewMode === "value" ? "Value (₹)" : viewMode === "kgs" ? "Weight (Kgs)" : "Weight / Value"}</th>
                    <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2.5 w-[100px]">Avg Rate</th>
                    <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2.5 w-[60px]">Vendors</th>
                    <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2.5 w-[60px]">SKUs</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map(l1 => {
                    const k1 = l1.group_label; const open1 = expanded.has(k1)
                    return (<React.Fragment key={k1}>
                      <tr className="border-b cursor-pointer hover:opacity-90 transition-colors bg-[#0f172a] text-white font-semibold" onClick={() => toggle(k1)}>
                        <td className="px-3 py-2.5 pl-3">
                          <span className="inline-flex items-center gap-1.5">
                            {open1 ? <ChevronDown className="h-4 w-4 text-teal-400" /> : <ChevronRight className="h-4 w-4 text-teal-400" />}
                            {l1.group_label}
                            {l1.pending_count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">{l1.pending_count} pending</span>}
                          </span>
                        </td>
                        <td className="text-right px-3 py-2.5 tabular-nums">{l1.tx_count}</td>
                        <td className="text-right px-3 py-2.5">{showVal(l1.total_weight, l1.total_value)}</td>
                        <td className="text-right px-3 py-2.5 tabular-nums">{fmtR(l1.avg_rate)}</td>
                        <td className="text-right px-3 py-2.5 tabular-nums">{l1.vendor_count}</td>
                        <td className="text-right px-3 py-2.5 tabular-nums">{l1.sku_count}</td>
                      </tr>
                      {open1 && l1.children.map(l2 => {
                        const k2 = k1 + "|||" + l2.sub_label; const open2 = expanded.has(k2)
                        return (<React.Fragment key={k2}>
                          <tr className="border-b cursor-pointer hover:bg-slate-200/50 transition-colors bg-slate-100 dark:bg-slate-800 font-medium border-l-[3px] border-l-teal-500" onClick={() => toggle(k2)}>
                            <td className="px-3 py-2 pl-8">
                              <span className="inline-flex items-center gap-1.5">{open2 ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}{l2.sub_label}</span>
                            </td>
                            <td className="text-right px-3 py-2 tabular-nums">{l2.tx_count}</td>
                            <td className="text-right px-3 py-2">{showVal(l2.total_weight, l2.total_value)}</td>
                            <td className="text-right px-3 py-2 tabular-nums">{fmtR(l2.avg_rate)}</td>
                            <td className="text-right px-3 py-2 tabular-nums">{l2.vendor_count}</td>
                            <td className="text-right px-3 py-2 tabular-nums">{l2.sku_count}</td>
                          </tr>
                          {open2 && l2.children.map(l3 => {
                            const k3 = k2 + "|||" + l3.item_description; const open3 = expanded.has(k3)
                            return (<React.Fragment key={k3}>
                              <tr className="border-b cursor-pointer hover:bg-slate-100/80 transition-colors bg-slate-50 dark:bg-slate-800/50" onClick={() => toggle(k3)}>
                                <td className="px-3 py-2 pl-14">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5">{open3 ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}{l3.item_description}</span>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={e => { e.stopPropagation(); openItem(l3.item_description) }} title="Item History">
                                      <History className="h-3 w-3 text-teal-600" />
                                    </Button>
                                    {l3.material_type && <span className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground">{l3.material_type}</span>}
                                    {l3.lot_count > 0 && <span className="text-[10px] text-muted-foreground">{l3.lot_count} lots</span>}
                                  </div>
                                </td>
                                <td className="text-right px-3 py-2 tabular-nums">{l3.tx_count}</td>
                                <td className="text-right px-3 py-2">{showVal(l3.total_weight, l3.total_value)}</td>
                                <td className="text-right px-3 py-2 tabular-nums">{fmtR(l3.avg_rate)}</td>
                                <td /><td />
                              </tr>
                              {/* L4 — transaction rows */}
                              {open3 && l3.records.map((tx, i) => (
                                <tr key={`${tx.transaction_no}-${i}`} className="border-b text-xs bg-white dark:bg-slate-900/80 text-slate-600 dark:text-slate-400">
                                  <td className="px-3 py-1.5 pl-20">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                      <Link href={`/${company}/inward/${tx.transaction_no}`} className="font-medium text-teal-600 hover:underline">{tx.transaction_no}</Link>
                                      {tx.entry_date && <span className="text-muted-foreground">{format(new Date(tx.entry_date), "dd MMM yy")}</span>}
                                      {tx.vendor && <span className="cursor-pointer text-teal-600 hover:underline" onClick={() => openVendor(tx.vendor)}>{tx.vendor}</span>}
                                      {tx.warehouse && <span className="text-muted-foreground">{tx.warehouse}</span>}
                                      {tx.lot_number && <span className="text-muted-foreground">Lot: {tx.lot_number}</span>}
                                      <span className={cn("text-[10px] px-1 py-0.5 rounded-full",
                                        tx.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{tx.status}</span>
                                    </div>
                                  </td>
                                  <td />
                                  <td className="text-right px-3 py-1.5">{showVal(tx.total_weight, tx.total_amount)}</td>
                                  <td className="text-right px-3 py-1.5 tabular-nums">{fmtR(tx.unit_rate)}</td>
                                  <td /><td />
                                </tr>
                              ))}
                            </React.Fragment>)
                          })}
                        </React.Fragment>)
                      })}
                    </React.Fragment>)
                  })}
                  {/* Grand Total */}
                  <tr className="border-t-2 border-slate-300 bg-[#0f172a] text-white font-bold">
                    <td className="px-3 py-2.5">Grand Total</td>
                    <td className="text-right px-3 py-2.5 tabular-nums">{kpis.total_inwards}</td>
                    <td className="text-right px-3 py-2.5">{showVal(kpis.total_weight, kpis.total_value)}</td>
                    <td className="text-right px-3 py-2.5 tabular-nums">{kpis.total_weight > 0 ? fmtR(kpis.total_value / kpis.total_weight) : "—"}</td>
                    <td className="text-right px-3 py-2.5 tabular-nums">{kpis.unique_vendors}</td>
                    <td className="text-right px-3 py-2.5 tabular-nums">{kpis.unique_items}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent></Card>

        {/* ITEM HISTORY POPUP */}
        <Dialog open={!!itemPopup} onOpenChange={o => !o && setItemPopup(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            {itemPopup && <>
              <DialogHeader>
                <DialogTitle>{itemPopup.item_description}</DialogTitle>
                <p className="text-xs text-muted-foreground">{itemPopup.total_inwards} inwards &middot; {fmtN(itemPopup.total_weight)} Kg &middot; {itemPopup.first_date} to {itemPopup.last_date}</p>
              </DialogHeader>
              <div className="space-y-4">
                <div><h4 className="text-sm font-semibold mb-2">Inward Timeline</h4>
                  <div className="overflow-x-auto"><table className="w-full text-xs">
                    <thead><tr className="border-b bg-muted/40">
                      <th className="text-left px-2 py-1.5">Date</th><th className="text-left px-2 py-1.5">TR No</th>
                      <th className="text-left px-2 py-1.5">Vendor</th><th className="text-left px-2 py-1.5">Lot</th>
                      <th className="text-right px-2 py-1.5">Weight</th><th className="text-right px-2 py-1.5">Rate</th><th className="text-left px-2 py-1.5">WH</th>
                    </tr></thead>
                    <tbody>{itemPopup.inward_timeline.map((r, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-2 py-1.5">{r.entry_date ? format(new Date(r.entry_date), "dd MMM yy") : "—"}</td>
                        <td className="px-2 py-1.5 font-medium">{r.transaction_no}</td>
                        <td className="px-2 py-1.5 cursor-pointer text-teal-600 hover:underline" onClick={() => { setItemPopup(null); openVendor(r.vendor) }}>{r.vendor}</td>
                        <td className="px-2 py-1.5">{r.lot_number}</td>
                        <td className="text-right px-2 py-1.5 tabular-nums">{fmtN(r.weight)}</td>
                        <td className="text-right px-2 py-1.5 tabular-nums">{fmtR(r.rate)}</td>
                        <td className="px-2 py-1.5">{r.warehouse}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                </div>
                {itemPopup.vendor_history.length > 0 && (
                  <div><h4 className="text-sm font-semibold mb-2">Vendor History</h4>
                    <div className="overflow-x-auto"><table className="w-full text-xs">
                      <thead><tr className="border-b bg-muted/40">
                        <th className="text-left px-2 py-1.5">Vendor</th><th className="text-right px-2 py-1.5">Inwards</th>
                        <th className="text-right px-2 py-1.5">Weight</th><th className="text-right px-2 py-1.5">Avg Rate</th>
                        <th className="text-right px-2 py-1.5">Value</th><th className="text-left px-2 py-1.5">Last</th>
                      </tr></thead>
                      <tbody>{itemPopup.vendor_history.map((v, i) => (
                        <tr key={i} className="border-b">
                          <td className="px-2 py-1.5 cursor-pointer text-teal-600 hover:underline" onClick={() => { setItemPopup(null); openVendor(v.vendor) }}>{v.vendor}</td>
                          <td className="text-right px-2 py-1.5">{v.inward_count}</td>
                          <td className="text-right px-2 py-1.5 tabular-nums">{fmtN(v.total_weight)}</td>
                          <td className="text-right px-2 py-1.5 tabular-nums">{fmtR(v.avg_rate)}</td>
                          <td className="text-right px-2 py-1.5 tabular-nums">{fmtV(v.total_value)}</td>
                          <td className="px-2 py-1.5">{v.last_supply ? format(new Date(v.last_supply), "dd MMM yy") : "—"}</td>
                        </tr>
                      ))}</tbody>
                    </table></div>
                  </div>
                )}
              </div>
            </>}
          </DialogContent>
        </Dialog>

        {/* VENDOR HISTORY POPUP */}
        <Dialog open={!!vendorPopup} onOpenChange={o => !o && setVendorPopup(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            {vendorPopup && <>
              <DialogHeader>
                <DialogTitle>{vendorPopup.vendor_name}</DialogTitle>
                <p className="text-xs text-muted-foreground">{vendorPopup.total_transactions} transactions &middot; {fmtV(vendorPopup.total_value)}</p>
              </DialogHeader>
              <div className="space-y-4">
                <div><h4 className="text-sm font-semibold mb-2">Items Supplied</h4>
                  <div className="overflow-x-auto"><table className="w-full text-xs">
                    <thead><tr className="border-b bg-muted/40">
                      <th className="text-left px-2 py-1.5">Item</th><th className="text-right px-2 py-1.5">Inwards</th>
                      <th className="text-right px-2 py-1.5">Weight</th><th className="text-right px-2 py-1.5">Avg Rate</th>
                      <th className="text-right px-2 py-1.5">Value</th><th className="text-left px-2 py-1.5">Last</th>
                    </tr></thead>
                    <tbody>{vendorPopup.item_summary.map((it, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-2 py-1.5 cursor-pointer text-teal-600 hover:underline" onClick={() => { setVendorPopup(null); openItem(it.item_description) }}>{it.item_description}</td>
                        <td className="text-right px-2 py-1.5">{it.inward_count}</td>
                        <td className="text-right px-2 py-1.5 tabular-nums">{fmtN(it.total_weight)}</td>
                        <td className="text-right px-2 py-1.5 tabular-nums">{fmtR(it.avg_rate)}</td>
                        <td className="text-right px-2 py-1.5 tabular-nums">{fmtV(it.total_value)}</td>
                        <td className="px-2 py-1.5">{it.last_inward ? format(new Date(it.last_inward), "dd MMM yy") : "—"}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                </div>
                {vendorPopup.monthly_pattern.length > 0 && (
                  <div><h4 className="text-sm font-semibold mb-2">Monthly Pattern</h4>
                    <div className="overflow-x-auto"><table className="w-full text-xs">
                      <thead><tr className="border-b bg-muted/40">
                        <th className="text-left px-2 py-1.5">Month</th><th className="text-right px-2 py-1.5">Inwards</th>
                        <th className="text-right px-2 py-1.5">Weight</th><th className="text-right px-2 py-1.5">Value</th>
                      </tr></thead>
                      <tbody>{vendorPopup.monthly_pattern.map((m, i) => (
                        <tr key={i} className="border-b">
                          <td className="px-2 py-1.5">{m.month_label}</td><td className="text-right px-2 py-1.5">{m.inward_count}</td>
                          <td className="text-right px-2 py-1.5 tabular-nums">{fmtN(m.total_weight)}</td>
                          <td className="text-right px-2 py-1.5 tabular-nums">{fmtV(m.total_value)}</td>
                        </tr>
                      ))}</tbody>
                    </table></div>
                  </div>
                )}
              </div>
            </>}
          </DialogContent>
        </Dialog>

      </div>
    </PermissionGuard>
  )
}

// ═══════════════════════════════════════════════════════════════════
function KPI({ icon, label, value, amber, color }: { icon: React.ReactNode; label: string; value: string; amber?: boolean; color?: string }) {
  return (
    <Card className={cn("overflow-hidden transition-shadow hover:shadow-md", amber && "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20")}>
      <CardContent className="p-4">
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center mb-3", color || "bg-slate-100 text-slate-600")}>
          {icon}
        </div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className={cn("text-xl font-bold tabular-nums mt-1 leading-tight", amber && "text-amber-700 dark:text-amber-400")}>{value}</p>
      </CardContent>
    </Card>
  )
}

function TableSkel() {
  return <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => (
    <div key={i} className="flex items-center gap-4"><Skeleton className="h-5 w-5" /><Skeleton className="h-5 flex-1" /><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-20" /></div>
  ))}</div>
}
