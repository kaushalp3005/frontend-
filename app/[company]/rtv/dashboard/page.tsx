"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { format } from "date-fns"
import {
  ArrowLeft, Package, DollarSign, Clock, CheckCircle2, Users, TrendingUp,
  Filter, ChevronDown, ChevronRight, ChevronsUpDown, RefreshCw, Copy, X,
  Search, ArrowUpDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { rtvApi } from "@/lib/api/rtvApiService"
import type { RTVListItem, RTVWithDetails, RTVLine } from "@/types/rtv"
import { canonicalize, groupByCanonical } from "@/lib/customers/canonicalize"
import { CUSTOMER_ALIASES } from "@/lib/constants/customerAliases"
import { Switch } from "@/components/ui/switch"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PermissionGuard } from "@/components/auth/permission-gate"

interface Props { params: { company: string } }

// ── Helpers ─────────────────────────────────────────────────────────
const fmtN = (n: number) => (n !== null && n !== undefined) ? Math.round(n).toLocaleString("en-IN") : "0"
const fmtV = (n: number) => (n !== null && n !== undefined && n !== 0) ? "₹" + Math.round(n).toLocaleString("en-IN") : "₹0"
const fmtR = (n: number) => n ? "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"
const num = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined) return 0
  const n = typeof v === "number" ? v : parseFloat(v)
  return isFinite(n) ? n : 0
}
const monthLabel = (d: string | null): string => {
  if (!d) return "Unknown"
  try { const date = new Date(d); return isNaN(date.getTime()) ? "Unknown" : format(date, "MMM yyyy") } catch { return "Unknown" }
}
function chipToggle(set: Set<string>, val: string): Set<string> {
  const n = new Set(set); n.has(val) ? n.delete(val) : n.add(val); return n
}

type ViewMode = "qty" | "value" | "both"
type GroupByKey = "factory_unit" | "customer" | "status" | "material_type" | "item_category" | "month"

const GROUP_OPTIONS: { value: GroupByKey; label: string }[] = [
  { value: "factory_unit", label: "Factory Unit" },
  { value: "customer", label: "Customer" },
  { value: "status", label: "Status" },
  { value: "material_type", label: "Material" },
  { value: "item_category", label: "Category" },
  { value: "month", label: "Month" },
]

const DATE_PRESETS = [
  { label: "Today", fn: () => { const d = format(new Date(), "yyyy-MM-dd"); return [d, d] } },
  { label: "This Week", fn: () => { const now = new Date(); const day = now.getDay() === 0 ? 6 : now.getDay() - 1; const start = new Date(now); start.setDate(now.getDate() - day); return [format(start, "yyyy-MM-dd"), format(now, "yyyy-MM-dd")] } },
  { label: "This Month", fn: () => [format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"), format(new Date(), "yyyy-MM-dd")] },
  { label: "Last Month", fn: () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return [format(new Date(d.getFullYear(), d.getMonth(), 1), "yyyy-MM-dd"), format(new Date(d.getFullYear(), d.getMonth() + 1, 0), "yyyy-MM-dd")] } },
  { label: "This FY", fn: () => { const y = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1; return [`${y}-04-01`, format(new Date(), "yyyy-MM-dd")] } },
  { label: "All Time", fn: () => ["", ""] },
]

// Line-level row (rows are flattened header × lines)
interface RTVRow {
  id: number; rtv_id: string; rtv_date: string | null; factory_unit: string; customer: string
  status: string; month_label: string
  material_type: string; item_category: string; sub_category: string; item_description: string
  uom: string; qty: number; rate: number; value: number; net_weight: number
}

function seedRow(h: RTVListItem): RTVRow {
  return {
    id: h.id, rtv_id: h.rtv_id, rtv_date: h.rtv_date,
    factory_unit: h.factory_unit || "Unassigned", customer: h.customer || "Unknown",
    status: h.status || "Pending", month_label: monthLabel(h.rtv_date || h.created_ts),
    material_type: "", item_category: "", sub_category: "", item_description: "",
    uom: "", qty: num(h.total_qty), rate: 0, value: 0, net_weight: 0,
  }
}
function lineToRow(h: RTVListItem, l: RTVLine): RTVRow {
  return {
    id: h.id, rtv_id: h.rtv_id, rtv_date: h.rtv_date,
    factory_unit: h.factory_unit || "Unassigned", customer: h.customer || "Unknown",
    status: h.status || "Pending", month_label: monthLabel(h.rtv_date || h.created_ts),
    material_type: l.material_type || "", item_category: l.item_category || "",
    sub_category: l.sub_category || "", item_description: l.item_description || "",
    uom: l.uom || "", qty: num(l.qty), rate: num(l.rate), value: num(l.value),
    net_weight: num(l.net_weight),
  }
}

// ═══════════════════════════════════════════════════════════════════
export default function RTVDashboard({ params }: Props) {
  const { company } = params

  const [rows, setRows] = useState<RTVRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selFactory, setSelFactory] = useState<Set<string>>(new Set())
  const [selCustomer, setSelCustomer] = useState<Set<string>>(new Set())
  const [selMaterial, setSelMaterial] = useState<Set<string>>(new Set())
  const [selStatus, setSelStatus] = useState<Set<string>>(new Set())
  const [groupSimilarCustomers, setGroupSimilarCustomers] = useState(true)
  const [selCanonicalCustomer, setSelCanonicalCustomer] = useState<Set<string>>(new Set())

  const [groupBy, setGroupBy] = useState<GroupByKey>("factory_unit")
  const [viewMode, setViewMode] = useState<ViewMode>("both")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [allExpanded, setAllExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"value" | "qty" | "count" | "name">("value")
  const [copied, setCopied] = useState(false)
  const [customerPopup, setCustomerPopup] = useState<string | null>(null)

  // ── Fetch: list all RTVs, then hydrate with line details ──
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const headers: RTVListItem[] = []
      let page = 1
      while (page <= 50) {
        const resp = await rtvApi.listRTVs(company, { page, per_page: 100 })
        headers.push(...resp.records)
        if (resp.records.length < 100 || page >= resp.total_pages) break
        page++
      }
      setRows(headers.map(seedRow))
      setLoading(false)

      // Hydrate with line details in parallel with bounded concurrency
      setLoadingDetails(true)
      const enriched: RTVRow[] = []
      let idx = 0
      const worker = async () => {
        while (idx < headers.length) {
          const h = headers[idx++]
          try {
            const detail: RTVWithDetails = await rtvApi.getRTVDetail(company, h.id)
            if (detail.lines?.length) enriched.push(...detail.lines.map(l => lineToRow(h, l)))
            else enriched.push(seedRow(h))
          } catch { enriched.push(seedRow(h)) }
        }
      }
      await Promise.all(Array.from({ length: 6 }, () => worker()))
      setRows(enriched)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load RTV data")
    } finally { setLoading(false); setLoadingDetails(false) }
  }, [company])

  useEffect(() => { fetchData() }, [fetchData])

  const activeFilterCount = [dateFrom, dateTo].filter(Boolean).length +
    [selFactory, selMaterial, selStatus].filter(s => s.size > 0).length +
    (groupSimilarCustomers
      ? (selCanonicalCustomer.size > 0 ? 1 : 0) + (selCustomer.size > 0 ? 1 : 0)
      : (selCustomer.size > 0 ? 1 : 0))

  const inDateRange = useCallback((d: string | null): boolean => {
    if (!dateFrom && !dateTo) return true
    const x = (d || "").slice(0, 10)
    if (dateFrom && x < dateFrom) return false
    if (dateTo && x > dateTo) return false
    return true
  }, [dateFrom, dateTo])

  // ── Filter ──
  const filtered = useMemo(() => rows.filter(r => {
    if (!inDateRange(r.rtv_date)) return false
    if (selFactory.size > 0 && !selFactory.has(r.factory_unit)) return false
    if (groupSimilarCustomers) {
      if (selCanonicalCustomer.size > 0) {
        const can = canonicalize(r.customer, CUSTOMER_ALIASES)
        if (!selCanonicalCustomer.has(can)) return false
        if (selCustomer.size > 0 && !selCustomer.has(r.customer)) return false
      }
    } else {
      if (selCustomer.size > 0 && !selCustomer.has(r.customer)) return false
    }
    if (selMaterial.size > 0 && !selMaterial.has(r.material_type || "")) return false
    if (selStatus.size > 0 && !selStatus.has(r.status)) return false
    return true
  }), [rows, inDateRange, selFactory, selCustomer, selCanonicalCustomer, groupSimilarCustomers, selMaterial, selStatus])

  // ── Cascaded dropdown options ──
  const cascadedOpts = useMemo(() => {
    const apply = (exclude: string) => rows.filter(r => {
      if (!inDateRange(r.rtv_date)) return false
      if (exclude !== "factory" && selFactory.size > 0 && !selFactory.has(r.factory_unit)) return false
      if (exclude !== "customer" && selCustomer.size > 0 && !selCustomer.has(r.customer)) return false
      if (exclude !== "material" && selMaterial.size > 0 && !selMaterial.has(r.material_type || "")) return false
      if (exclude !== "status" && selStatus.size > 0 && !selStatus.has(r.status)) return false
      return true
    })
    const countBy = (recs: RTVRow[], f: (r: RTVRow) => string) => {
      const map = new Map<string, Set<string>>()
      for (const r of recs) { const v = f(r); if (!v) continue; if (!map.has(v)) map.set(v, new Set()); map.get(v)!.add(r.rtv_id) }
      return Array.from(map.entries()).map(([name, s]) => ({ name, count: s.size })).sort((a, b) => b.count - a.count)
    }
    const customerRows = apply("customer")
    const canonicalMap = groupByCanonical(
      customerRows.map(r => r.customer).filter(Boolean),
      CUSTOMER_ALIASES,
    )
    const rtvIdByCustomer = new Map<string, Set<string>>()
    for (const r of customerRows) {
      if (!r.customer) continue
      if (!rtvIdByCustomer.has(r.customer)) rtvIdByCustomer.set(r.customer, new Set())
      rtvIdByCustomer.get(r.customer)!.add(r.rtv_id)
    }
    const canonicalCustomers = Array.from(canonicalMap.entries()).map(([name, variants]) => {
      const ids = new Set<string>()
      for (const v of variants) {
        const set = rtvIdByCustomer.get(v)
        if (set) set.forEach(id => ids.add(id))
      }
      return { name, count: ids.size, variants }
    })
    return {
      factories: countBy(apply("factory"), r => r.factory_unit),
      customers: countBy(apply("customer"), r => r.customer),
      canonicalCustomers,
      materials: countBy(apply("material"), r => r.material_type),
      statuses: countBy(apply("status"), r => r.status),
    }
  }, [rows, inDateRange, selFactory, selCustomer, selMaterial, selStatus])

  // ── KPIs ──
  const kpis = useMemo(() => {
    const rtvIds = new Set(filtered.map(r => r.rtv_id))
    const totalQty = filtered.reduce((s, r) => s + r.qty, 0)
    const totalValue = filtered.reduce((s, r) => s + r.value, 0)
    const totalKg = filtered.reduce((s, r) => s + r.net_weight, 0)
    const pending = new Set(filtered.filter(r => r.status === "Pending").map(r => r.rtv_id))
    const approved = new Set(filtered.filter(r => r.status === "Approved").map(r => r.rtv_id))
    const customers = new Set(filtered.map(r => r.customer).filter(Boolean))
    return {
      total_rtvs: rtvIds.size, total_qty: totalQty, total_value: totalValue, total_kg: totalKg,
      pending: pending.size, approved: approved.size, customers: customers.size,
    }
  }, [filtered])

  // ── Grouped hierarchy (L1 → L2 → L3) ──
  const groupField = (r: RTVRow): string => {
    switch (groupBy) {
      case "factory_unit": return r.factory_unit || "Unassigned"
      case "customer": return r.customer || "Unknown"
      case "status": return r.status || "Pending"
      case "material_type": return r.material_type || "N/A"
      case "item_category": return r.item_category || "Uncategorized"
      case "month": return r.month_label || "Unknown"
    }
  }

  const summary = useMemo(() => {
    const l2Field = (r: RTVRow): string => {
      if (groupBy === "item_category") return r.sub_category || "General"
      if (groupBy === "material_type") return r.item_category || "Uncategorized"
      return r.item_category || "Uncategorized"
    }

    const l1Map = new Map<string, RTVRow[]>()
    for (const r of filtered) { const g = groupField(r); if (!l1Map.has(g)) l1Map.set(g, []); l1Map.get(g)!.push(r) }

    const data = Array.from(l1Map.entries()).map(([label, records]) => {
      const rtvs = new Set(records.map(r => r.rtv_id))
      const qty = records.reduce((s, r) => s + r.qty, 0)
      const value = records.reduce((s, r) => s + r.value, 0)
      const kg = records.reduce((s, r) => s + r.net_weight, 0)
      const pending = new Set(records.filter(r => r.status === "Pending").map(r => r.rtv_id))
      const customers = new Set(records.map(r => r.customer).filter(Boolean))

      const l2Map = new Map<string, RTVRow[]>()
      for (const r of records) { const k = l2Field(r); if (!l2Map.has(k)) l2Map.set(k, []); l2Map.get(k)!.push(r) }
      const children = Array.from(l2Map.entries()).map(([sl, recs]) => {
        const sq = recs.reduce((s, r) => s + r.qty, 0)
        const sv = recs.reduce((s, r) => s + r.value, 0)
        const skg = recs.reduce((s, r) => s + r.net_weight, 0)
        const l3Map = new Map<string, RTVRow[]>()
        for (const r of recs) { const k = r.item_description || "—"; if (!l3Map.has(k)) l3Map.set(k, []); l3Map.get(k)!.push(r) }
        const items = Array.from(l3Map.entries()).map(([item, irecs]) => {
          const iq = irecs.reduce((s, r) => s + r.qty, 0)
          const iv = irecs.reduce((s, r) => s + r.value, 0)
          const ikg = irecs.reduce((s, r) => s + r.net_weight, 0)
          return {
            item_description: item, material_type: irecs[0]?.material_type || "", uom: irecs[0]?.uom || "",
            total_qty: iq, total_value: iv, total_kg: ikg, avg_rate: iq > 0 ? iv / iq : 0,
            rtv_count: new Set(irecs.map(r => r.rtv_id)).size,
            records: irecs,
          }
        }).sort((a, b) => b.total_value - a.total_value)
        return {
          sub_label: sl, rtv_count: new Set(recs.map(r => r.rtv_id)).size,
          total_qty: sq, total_value: sv, total_kg: skg, avg_rate: sq > 0 ? sv / sq : 0,
          item_count: new Set(recs.map(r => r.item_description).filter(Boolean)).size,
          children: items,
        }
      }).sort((a, b) => b.total_value - a.total_value)

      return {
        group_label: label, rtv_count: rtvs.size, total_qty: qty, total_value: value, total_kg: kg,
        avg_rate: qty > 0 ? value / qty : 0, customer_count: customers.size,
        pending_count: pending.size, children,
      }
    })

    const sq = searchQuery.toLowerCase().trim()
    const searched = sq ? data.filter(l1 =>
      l1.group_label.toLowerCase().includes(sq) ||
      l1.children.some(l2 => l2.sub_label.toLowerCase().includes(sq) ||
        l2.children.some(l3 => l3.item_description.toLowerCase().includes(sq)))
    ) : data

    const sortFn = (a: typeof data[0], b: typeof data[0]) => {
      switch (sortBy) {
        case "value": return b.total_value - a.total_value
        case "qty": return b.total_qty - a.total_qty
        case "count": return b.rtv_count - a.rtv_count
        case "name": return a.group_label.localeCompare(b.group_label)
      }
    }
    return [...searched].sort(sortFn)
  }, [filtered, groupBy, searchQuery, sortBy])

  // ── Actions ──
  const toggle = (k: string) => setExpanded(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })
  const toggleAll = () => {
    if (allExpanded) { setExpanded(new Set()); setAllExpanded(false); return }
    const keys = new Set<string>()
    summary.forEach(l1 => {
      keys.add(l1.group_label)
      l1.children.forEach(l2 => {
        const k2 = l1.group_label + "|||" + l2.sub_label
        keys.add(k2)
        l2.children.forEach(l3 => keys.add(k2 + "|||" + l3.item_description))
      })
    })
    setExpanded(keys); setAllExpanded(true)
  }
  const clearFilters = () => {
    setDateFrom(""); setDateTo(""); setSelFactory(new Set()); setSelCustomer(new Set())
    setSelCanonicalCustomer(new Set()); setSelMaterial(new Set()); setSelStatus(new Set())
  }
  const handleToggleGroupSimilar = (checked: boolean) => {
    setGroupSimilarCustomers(checked)
    if (!checked) setSelCanonicalCustomer(new Set())
  }
  const openCustomer = (name: string) => setCustomerPopup(name)
  const handleCopy = async () => {
    const fmtDate = (d: string) => format(new Date(d), "dd MMM yyyy")
    let periodLine: string
    if (dateFrom && dateTo) periodLine = dateFrom === dateTo ? `Period: ${fmtDate(dateFrom)}` : `Period: ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`
    else if (dateFrom) periodLine = `Period: from ${fmtDate(dateFrom)}`
    else if (dateTo) periodLine = `Period: up to ${fmtDate(dateTo)}`
    else periodLine = "Period: All time"
    const lines = [
      `RTV Summary - ${format(new Date(), "dd MMM yyyy")} - ${company.toUpperCase()}`,
      periodLine, "",
      `Total: ${kpis.total_rtvs} RTVs | ${fmtN(kpis.total_qty)} Qty${kpis.total_kg > 0 ? ` | ${fmtN(kpis.total_kg)} Kg` : ""} | ${fmtV(kpis.total_value)}`,
      `Pending: ${kpis.pending} | Approved: ${kpis.approved} | Customers: ${kpis.customers}`, "",
    ]
    summary.forEach(l1 => lines.push(`${l1.group_label}  ${l1.rtv_count} RTVs  ${fmtN(l1.total_qty)} Qty${l1.total_kg > 0 ? `  ${fmtN(l1.total_kg)} Kg` : ""}  ${fmtV(l1.total_value)}`))
    try { await navigator.clipboard.writeText(lines.join("\n")); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }

  const showVal = (qty: number, value: number) => {
    if (viewMode === "qty") return <span className="tabular-nums">{fmtN(qty)} <span className="text-[10px] text-muted-foreground">Qty</span></span>
    if (viewMode === "value") return <span className="tabular-nums">{fmtV(value)}</span>
    return <><div className="tabular-nums">{fmtN(qty)} <span className="text-[10px] text-muted-foreground">Qty</span></div><div className="text-[10px] text-muted-foreground tabular-nums">{fmtV(value)}</div></>
  }

  const showValWithKg = (qty: number, value: number, kg: number) => {
    const kgLine = kg > 0 ? <div className="text-[10px] text-muted-foreground tabular-nums">{fmtN(kg)} <span>Kg</span></div> : null
    if (viewMode === "qty") return <>
      <div className="tabular-nums">{fmtN(qty)} <span className="text-[10px] text-muted-foreground">Qty</span></div>
      {kgLine}
    </>
    if (viewMode === "value") return <>
      <div className="tabular-nums">{fmtV(value)}</div>
      {kgLine}
    </>
    return <>
      <div className="tabular-nums">{fmtN(qty)} <span className="text-[10px] text-muted-foreground">Qty</span></div>
      {kgLine}
      <div className="text-[10px] text-muted-foreground tabular-nums">{fmtV(value)}</div>
    </>
  }

  return (
    <PermissionGuard module="reordering" action="view">
    <div className="p-3 sm:p-4 md:p-6 max-w-[1600px] mx-auto space-y-4">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href={`/${company}/rtv`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">RTV Summary</h1>
            <p className="text-xs text-muted-foreground">
              Analytics and insights on Return-to-Vendor transactions
              {activeFilterCount > 0 && <span className="ml-2 text-teal-600">&middot; {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active</span>}
              {loadingDetails && <span className="ml-2 text-amber-600">&middot; loading line details...</span>}
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
        </div>
      </div>

      {error && <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg">{error}</div>}

      {/* KPI CARDS */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPI icon={<Package className="h-5 w-5" />} label="Total RTVs" value={fmtN(kpis.total_rtvs)} color="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" />
          <KPI icon={<TrendingUp className="h-5 w-5" />} label="Total Quantity" value={fmtN(kpis.total_qty)} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" />
          <KPI icon={<DollarSign className="h-5 w-5" />} label="Total Value" value={fmtV(kpis.total_value)} color="bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400" />
          <KPI icon={<Clock className="h-5 w-5" />} label="Pending RTVs" value={fmtN(kpis.pending)} amber={kpis.pending > 0} color="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400" />
          <KPI icon={<CheckCircle2 className="h-5 w-5" />} label="Approved RTVs" value={fmtN(kpis.approved)} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" />
          <KPI icon={<Users className="h-5 w-5" />} label="Unique Customers" value={fmtN(kpis.customers)} color="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400" />
        </div>
      )}

      {/* FILTER PANEL */}
      {!loading && (
        <Card className="border-2 border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <CardContent className="p-0">

            {/* Date */}
            <div className="flex flex-wrap items-center gap-2.5 px-5 py-3.5 bg-slate-50 dark:bg-slate-900/50 border-b">
              <Filter className="h-4 w-4 text-slate-400" />
              <div className="flex items-center gap-2 flex-wrap">
                {DATE_PRESETS.map(p => {
                  const [f, t] = p.fn()
                  const active = (!dateFrom && !dateTo && p.label === "All Time") || (dateFrom === f && dateTo === t && f !== "")
                  return (
                    <button key={p.label} onClick={() => { setDateFrom(f); setDateTo(t) }}
                      className={cn("text-sm font-medium px-4 py-2 rounded-lg border-2 transition-all",
                        active ? "bg-[#0f172a] text-white border-[#0f172a] shadow-sm"
                          : "bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-600")}>{p.label}</button>
                  )
                })}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-[150px] text-sm bg-white dark:bg-slate-800" />
                <span className="text-sm text-muted-foreground">to</span>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-[150px] text-sm bg-white dark:bg-slate-800" />
              </div>
            </div>

            {/* Status */}
            {cascadedOpts.statuses.length > 0 && (
              <div className="flex flex-wrap items-center gap-2.5 px-5 py-3.5 border-b bg-slate-50/50 dark:bg-slate-900/30">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-[70px] flex-shrink-0">Status</span>
                <div className="flex flex-wrap gap-2">
                  {cascadedOpts.statuses.map(s => {
                    const isApproved = s.name === "Approved"
                    return (
                      <button key={s.name} onClick={() => setSelStatus(chipToggle(selStatus, s.name))}
                        className={cn("text-sm font-medium px-4 py-2 rounded-lg border-2 transition-all",
                          selStatus.has(s.name)
                            ? isApproved ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" : "bg-amber-500 text-white border-amber-500 shadow-sm"
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:bg-slate-100")}>
                        {s.name} <span className="text-xs opacity-70 ml-0.5">({s.count})</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Factory */}
            {cascadedOpts.factories.length > 0 && (
              <div className="flex flex-wrap items-center gap-2.5 px-5 py-3.5 border-b">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-[70px] flex-shrink-0">Factory</span>
                <div className="flex flex-wrap gap-2">
                  {cascadedOpts.factories.map(w => (
                    <button key={w.name} onClick={() => setSelFactory(chipToggle(selFactory, w.name))}
                      className={cn("text-sm font-medium px-4 py-2 rounded-lg border-2 transition-all",
                        selFactory.has(w.name) ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 border-slate-200 dark:border-slate-600 hover:border-blue-300")}>
                      {w.name} <span className="text-xs opacity-70 ml-0.5">({w.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Customer */}
            {(groupSimilarCustomers ? cascadedOpts.canonicalCustomers.length > 0 : cascadedOpts.customers.length > 0) && (
              <div className="px-5 py-3.5 border-b space-y-2.5">
                <div className="flex flex-wrap items-start gap-2.5">
                  <div className="flex items-center gap-2 w-[180px] flex-shrink-0 pt-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Customer</span>
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer select-none ml-auto">
                      <span>Group similar</span>
                      <Switch checked={groupSimilarCustomers} onCheckedChange={handleToggleGroupSimilar} className="scale-75" />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2 flex-1">
                    {groupSimilarCustomers
                      ? cascadedOpts.canonicalCustomers.slice(0, 40).map(c => {
                          const active = selCanonicalCustomer.has(c.name)
                          return (
                            <button key={c.name}
                              onClick={() => { setSelCanonicalCustomer(chipToggle(selCanonicalCustomer, c.name)); if (active) setSelCustomer(new Set()) }}
                              className={cn("text-sm font-medium px-3.5 py-1.5 rounded-lg border-2 transition-all",
                                active ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                                  : "bg-white dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-950/30 border-slate-200 dark:border-slate-600 hover:border-violet-300")}>
                              {c.name} <span className="text-xs opacity-70 ml-0.5">({c.count})</span>
                              {c.variants.length > 1 && <span className="text-[10px] ml-1 opacity-60">· {c.variants.length} variants</span>}
                            </button>
                          )
                        })
                      : cascadedOpts.customers.slice(0, 40).map(c => (
                          <button key={c.name} onClick={() => setSelCustomer(chipToggle(selCustomer, c.name))}
                            className={cn("text-sm font-medium px-3.5 py-1.5 rounded-lg border-2 transition-all",
                              selCustomer.has(c.name) ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                                : "bg-white dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-950/30 border-slate-200 dark:border-slate-600 hover:border-violet-300")}>
                            {c.name} <span className="text-xs opacity-70 ml-0.5">({c.count})</span>
                          </button>
                        ))}
                  </div>
                </div>

                {groupSimilarCustomers && selCanonicalCustomer.size > 0 && (() => {
                  const selectedCanonical = cascadedOpts.canonicalCustomers.filter(c => selCanonicalCustomer.has(c.name))
                  const variantNames = selectedCanonical.flatMap(c => c.variants)
                  const variantRtvSets = new Map<string, Set<string>>()
                  for (const row of rows) {
                    if (!variantNames.includes(row.customer)) continue
                    if (!variantRtvSets.has(row.customer)) variantRtvSets.set(row.customer, new Set())
                    variantRtvSets.get(row.customer)!.add(row.rtv_id)
                  }
                  const variants = variantNames.map(v => ({ name: v, count: variantRtvSets.get(v)?.size ?? 0 }))
                    .sort((a, b) => b.count - a.count)
                  if (variants.length <= 1) return null
                  return (
                    <div className="flex flex-wrap items-start gap-2 pl-4 border-l-2 border-violet-200 dark:border-violet-900/40 bg-violet-50/30 dark:bg-violet-950/10 rounded-md py-2 pr-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400 pt-1 flex items-center gap-1">
                        <span>└</span>Variants
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {variants.map(v => (
                          <button key={v.name} onClick={() => setSelCustomer(chipToggle(selCustomer, v.name))}
                            className={cn("text-xs font-medium px-2.5 py-1 rounded-md border transition-all",
                              selCustomer.has(v.name) ? "bg-violet-500 text-white border-violet-500"
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:bg-violet-100 dark:hover:bg-violet-900/30")}>
                            {v.name} <span className="opacity-60 ml-0.5">({v.count})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Material */}
            {cascadedOpts.materials.length > 0 && (
              <div className="flex flex-wrap items-center gap-2.5 px-5 py-3.5 border-b">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-[70px] flex-shrink-0">Material</span>
                <div className="flex flex-wrap gap-2">
                  {cascadedOpts.materials.map(m => (
                    <button key={m.name} onClick={() => setSelMaterial(chipToggle(selMaterial, m.name))}
                      className={cn("text-sm font-medium px-4 py-2 rounded-lg border-2 transition-all",
                        selMaterial.has(m.name) ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                          : "bg-white dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-orange-950/30 border-slate-200 dark:border-slate-600 hover:border-orange-300")}>
                      {m.name} <span className="text-xs opacity-70 ml-0.5">({m.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

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

      {/* GROUP BY + VIEW MODE + SEARCH + SORT */}
      {!loading && (
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
                  {(["qty", "value", "both"] as ViewMode[]).map(v => (
                    <button key={v} onClick={() => setViewMode(v)}
                      className={cn("px-2.5 py-1.5 transition-colors capitalize", viewMode === v ? "bg-[#0f172a] text-white" : "hover:bg-slate-100")}>
                      {v === "qty" ? "Qty" : v === "value" ? "Value (₹)" : "Both"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={toggleAll}>
              <ChevronsUpDown className="h-3.5 w-3.5" />{allExpanded ? "Collapse All" : "Expand All"}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-[300px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search within results..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-8 pl-8 text-xs" />
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
                  { value: "qty" as const, label: "Qty" },
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
      )}

      {/* SUMMARY TABLE */}
      <Card><CardContent className="p-0">
        {loading ? <TableSkel /> : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No RTV records found</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
            {activeFilterCount > 0 && <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={clearFilters}>Clear Filters</Button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b bg-muted/60">
                  <th className="text-left text-xs uppercase tracking-wider font-medium px-3 py-2.5 min-w-[260px]">{GROUP_OPTIONS.find(g => g.value === groupBy)?.label}</th>
                  <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2.5 w-[70px]">RTVs</th>
                  <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2.5 w-[170px]">{viewMode === "value" ? "Value (₹)" : viewMode === "qty" ? "Qty / Kg" : "Qty / Kg / Value"}</th>
                  <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2.5 w-[100px]">Avg Rate</th>
                  <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2.5 w-[80px]">Customers</th>
                  <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2.5 w-[60px]">Items</th>
                </tr>
              </thead>
              <tbody>
                {summary.map(l1 => {
                  const k1 = l1.group_label; const open1 = expanded.has(k1)
                  return (<React.Fragment key={k1}>
                    <tr className="border-b cursor-pointer hover:opacity-90 transition-colors bg-[#0f172a] text-white font-semibold" onClick={() => toggle(k1)}>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1.5">
                          {open1 ? <ChevronDown className="h-4 w-4 text-teal-400" /> : <ChevronRight className="h-4 w-4 text-teal-400" />}
                          {groupBy === "customer" ? (
                            <button onClick={e => { e.stopPropagation(); openCustomer(l1.group_label) }} className="hover:underline">{l1.group_label}</button>
                          ) : l1.group_label}
                          {l1.pending_count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">{l1.pending_count} pending</span>}
                        </span>
                      </td>
                      <td className="text-right px-3 py-2.5 tabular-nums">{l1.rtv_count}</td>
                      <td className="text-right px-3 py-2.5">{showValWithKg(l1.total_qty, l1.total_value, l1.total_kg)}</td>
                      <td className="text-right px-3 py-2.5 tabular-nums">{fmtR(l1.avg_rate)}</td>
                      <td className="text-right px-3 py-2.5 tabular-nums">{l1.customer_count}</td>
                      <td className="text-right px-3 py-2.5 tabular-nums">{l1.children.reduce((s, c) => s + c.item_count, 0) || l1.children.length}</td>
                    </tr>
                    {open1 && l1.children.map(l2 => {
                      const k2 = k1 + "|||" + l2.sub_label; const open2 = expanded.has(k2)
                      return (<React.Fragment key={k2}>
                        <tr className="border-b cursor-pointer hover:bg-slate-200/50 transition-colors bg-slate-100 dark:bg-slate-800 font-medium border-l-[3px] border-l-teal-500" onClick={() => toggle(k2)}>
                          <td className="px-3 py-2 pl-8">
                            <span className="inline-flex items-center gap-1.5">{open2 ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}{l2.sub_label}</span>
                          </td>
                          <td className="text-right px-3 py-2 tabular-nums">{l2.rtv_count}</td>
                          <td className="text-right px-3 py-2">{showValWithKg(l2.total_qty, l2.total_value, l2.total_kg)}</td>
                          <td className="text-right px-3 py-2 tabular-nums">{fmtR(l2.avg_rate)}</td>
                          <td className="text-right px-3 py-2 tabular-nums">—</td>
                          <td className="text-right px-3 py-2 tabular-nums">{l2.item_count}</td>
                        </tr>
                        {open2 && l2.children.map(l3 => {
                          const k3 = k2 + "|||" + l3.item_description
                          const open3 = expanded.has(k3)
                          const rtvMap = new Map<string, { id: number; rtv_id: string; rtv_date: string | null; customer: string; factory_unit: string; status: string; qty: number; value: number; rate: number; uom: string }>()
                          for (const r of l3.records) {
                            if (rtvMap.has(r.rtv_id)) {
                              const ex = rtvMap.get(r.rtv_id)!
                              ex.qty += r.qty
                              ex.value += r.value
                            } else {
                              rtvMap.set(r.rtv_id, {
                                id: r.id, rtv_id: r.rtv_id, rtv_date: r.rtv_date,
                                customer: r.customer, factory_unit: r.factory_unit, status: r.status,
                                qty: r.qty, value: r.value, rate: r.rate, uom: r.uom,
                              })
                            }
                          }
                          const l4Rows = Array.from(rtvMap.values()).sort((a, b) => (b.rtv_date || "").localeCompare(a.rtv_date || ""))
                          return (<React.Fragment key={k3}>
                            <tr onClick={() => toggle(k3)} className="border-b cursor-pointer hover:bg-slate-100/80 transition-colors bg-slate-50 dark:bg-slate-800/50 text-[13px]">
                              <td className="px-3 py-2 pl-14">
                                <div className="flex items-center gap-2">
                                  {open3 ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                  <span>{l3.item_description}</span>
                                  {l3.material_type && <span className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground">{l3.material_type}</span>}
                                  {l3.uom && <span className="text-[10px] text-muted-foreground">{l3.uom}</span>}
                                  <span className="text-[10px] text-muted-foreground">{l4Rows.length} RTV{l4Rows.length !== 1 ? "s" : ""}</span>
                                </div>
                              </td>
                              <td className="text-right px-3 py-2 tabular-nums">{l3.rtv_count}</td>
                              <td className="text-right px-3 py-2">{showValWithKg(l3.total_qty, l3.total_value, l3.total_kg)}</td>
                              <td className="text-right px-3 py-2 tabular-nums">{fmtR(l3.avg_rate)}</td>
                              <td /><td />
                            </tr>
                            {open3 && l4Rows.map(tx => (
                              <tr key={`${k3}:::${tx.rtv_id}`} className="border-b bg-white dark:bg-slate-900/80 text-xs">
                                <td className="px-3 py-1.5 pl-20">
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                    <HoverCard openDelay={400} closeDelay={100}>
                                      <HoverCardTrigger asChild>
                                        <Link href={`/${company}/rtv/${tx.id}`} className="font-medium text-teal-600 hover:underline">{tx.rtv_id}</Link>
                                      </HoverCardTrigger>
                                      <HoverCardContent className="w-80 p-3" align="start">
                                        <RTVPeekCard rtvId={tx.rtv_id} rtvNumericId={tx.id} company={company} records={rows.filter(r => r.rtv_id === tx.rtv_id)} />
                                      </HoverCardContent>
                                    </HoverCard>
                                    {tx.rtv_date && <span className="text-muted-foreground">{format(new Date(tx.rtv_date), "dd MMM yy")}</span>}
                                    {tx.customer && (
                                      <button onClick={e => { e.stopPropagation(); openCustomer(tx.customer) }}
                                        className="text-teal-600 hover:underline cursor-pointer">{tx.customer}</button>
                                    )}
                                    {tx.factory_unit && <span className="text-muted-foreground">{tx.factory_unit}</span>}
                                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                                      tx.status === "Approved" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{tx.status}</span>
                                  </div>
                                </td>
                                <td />
                                <td className="text-right px-3 py-1.5">{showVal(tx.qty, tx.value)}</td>
                                <td className="text-right px-3 py-1.5 tabular-nums">{fmtR(tx.qty > 0 ? tx.value / tx.qty : 0)}</td>
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
                  <td className="text-right px-3 py-2.5 tabular-nums">{kpis.total_rtvs}</td>
                  <td className="text-right px-3 py-2.5">{showValWithKg(kpis.total_qty, kpis.total_value, kpis.total_kg)}</td>
                  <td className="text-right px-3 py-2.5 tabular-nums">{kpis.total_qty > 0 ? fmtR(kpis.total_value / kpis.total_qty) : "—"}</td>
                  <td className="text-right px-3 py-2.5 tabular-nums">{kpis.customers}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent></Card>

      <CustomerHistoryDialog
        customerName={customerPopup}
        allRecords={rows}
        company={company}
        onClose={() => setCustomerPopup(null)}
      />

    </div>
    </PermissionGuard>
  )
}

// ═══════════════════════════════════════════════════════════════════
function RTVPeekCard({ rtvId, rtvNumericId, company, records }: { rtvId: string; rtvNumericId: number; company: string; records: RTVRow[] }) {
  if (records.length === 0) {
    return <div className="text-xs text-muted-foreground">Loading...</div>
  }
  const header = records[0]
  const totalQty = records.reduce((s, r) => s + r.qty, 0)
  const totalValue = records.reduce((s, r) => s + r.value, 0)
  const uniqueItems = new Set(records.map(r => r.item_description).filter(Boolean)).size
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/${company}/rtv/${rtvNumericId}`} className="font-semibold text-sm text-teal-600 hover:underline">{rtvId}</Link>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
          header.status === "Approved" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
          {header.status}
        </span>
      </div>
      <div className="text-xs text-muted-foreground">
        {header.rtv_date && format(new Date(header.rtv_date), "dd MMM yyyy")}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <div><span className="text-muted-foreground">Factory:</span> <span className="font-medium">{header.factory_unit}</span></div>
        <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{header.customer}</span></div>
        <div className="col-span-2"><span className="text-muted-foreground">Month:</span> <span className="font-medium">{header.month_label}</span></div>
      </div>
      <div className="flex justify-between pt-2 border-t text-xs">
        <span>{uniqueItems} item{uniqueItems !== 1 ? "s" : ""}</span>
        <span className="font-medium">{fmtN(totalQty)} Qty</span>
        <span className="font-semibold">{fmtV(totalValue)}</span>
      </div>
      <Link href={`/${company}/rtv/${rtvNumericId}`} className="block text-[10px] text-teal-600 pt-1 hover:underline hover:text-teal-700 font-medium">
        Click to open full view →
      </Link>
    </div>
  )
}

function CustomerHistoryDialog({
  customerName, allRecords, company, onClose,
}: { customerName: string | null; allRecords: RTVRow[]; company: string; onClose: () => void }) {
  if (!customerName) return null
  const canonical = canonicalize(customerName, CUSTOMER_ALIASES)
  const matching = allRecords.filter(r => canonicalize(r.customer, CUSTOMER_ALIASES) === canonical)
  const rtvIds = Array.from(new Set(matching.map(r => r.rtv_id)))
  const variants = Array.from(new Set(matching.map(r => r.customer).filter(Boolean)))
  const totalQty = matching.reduce((s, r) => s + r.qty, 0)
  const totalValue = matching.reduce((s, r) => s + r.value, 0)
  const dates = matching.map(r => r.rtv_date).filter(Boolean).sort() as string[]
  const firstDate = dates[0]
  const lastDate = dates[dates.length - 1]

  type Row = { id: number; rtv_id: string; rtv_date: string | null; factory: string; customer: string; status: string; qty: number; value: number }
  const rtvMap = new Map<string, Row>()
  for (const r of matching) {
    if (!rtvMap.has(r.rtv_id)) {
      rtvMap.set(r.rtv_id, {
        id: r.id, rtv_id: r.rtv_id, rtv_date: r.rtv_date,
        factory: r.factory_unit, customer: r.customer, status: r.status,
        qty: r.qty, value: r.value,
      })
    } else {
      const ex = rtvMap.get(r.rtv_id)!
      ex.qty += r.qty
      ex.value += r.value
    }
  }
  const rtvRows = Array.from(rtvMap.values()).sort((a, b) => (b.rtv_date || "").localeCompare(a.rtv_date || ""))

  const variantRows = variants.map(v => {
    const vrecs = matching.filter(r => r.customer === v)
    return {
      name: v,
      rtv_count: new Set(vrecs.map(r => r.rtv_id)).size,
      qty: vrecs.reduce((s, r) => s + r.qty, 0),
      value: vrecs.reduce((s, r) => s + r.value, 0),
    }
  }).sort((a, b) => b.value - a.value)

  const itemMap = new Map<string, { qty: number; value: number; ids: Set<string> }>()
  for (const r of matching) {
    if (!r.item_description) continue
    if (!itemMap.has(r.item_description)) itemMap.set(r.item_description, { qty: 0, value: 0, ids: new Set() })
    const ex = itemMap.get(r.item_description)!
    ex.qty += r.qty
    ex.value += r.value
    ex.ids.add(r.rtv_id)
  }
  const itemRows = Array.from(itemMap.entries()).map(([name, s]) => ({
    name, qty: s.qty, value: s.value, rtv_count: s.ids.size,
  })).sort((a, b) => b.value - a.value)

  return (
    <Dialog open={!!customerName} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{canonical}</span>
            {variants.length > 1 && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-medium">
                {variants.length} variants
              </span>
            )}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {rtvIds.length} RTVs · {fmtN(totalQty)} Qty · {fmtV(totalValue)}
            {firstDate && lastDate && <> · {format(new Date(firstDate), "dd MMM yy")} to {format(new Date(lastDate), "dd MMM yy")}</>}
          </p>
        </DialogHeader>
        <Tabs defaultValue="rtvs" className="mt-2">
          <TabsList>
            <TabsTrigger value="rtvs">RTVs ({rtvIds.length})</TabsTrigger>
            {variants.length > 1 && <TabsTrigger value="variants">Variants ({variants.length})</TabsTrigger>}
            <TabsTrigger value="items">Top Items ({itemRows.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="rtvs">
            <table className="w-full text-xs">
              <thead><tr className="border-b bg-muted/40">
                <th className="text-left px-2 py-1.5">RTV ID</th>
                <th className="text-left px-2 py-1.5">Date</th>
                <th className="text-left px-2 py-1.5">Factory</th>
                <th className="text-left px-2 py-1.5">Customer</th>
                <th className="text-left px-2 py-1.5">Status</th>
                <th className="text-right px-2 py-1.5">Qty</th>
                <th className="text-right px-2 py-1.5">Value</th>
              </tr></thead>
              <tbody>{rtvRows.map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-2 py-1.5">
                    <Link href={`/${company}/rtv/${r.id}`} onClick={() => onClose()} className="font-medium text-teal-600 hover:underline">{r.rtv_id}</Link>
                  </td>
                  <td className="px-2 py-1.5">{r.rtv_date && format(new Date(r.rtv_date), "dd MMM yy")}</td>
                  <td className="px-2 py-1.5">{r.factory}</td>
                  <td className="px-2 py-1.5">{r.customer}</td>
                  <td className="px-2 py-1.5">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                      r.status === "Approved" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{r.status}</span>
                  </td>
                  <td className="text-right px-2 py-1.5 tabular-nums">{fmtN(r.qty)}</td>
                  <td className="text-right px-2 py-1.5 tabular-nums font-medium">{fmtV(r.value)}</td>
                </tr>
              ))}</tbody>
            </table>
          </TabsContent>
          {variants.length > 1 && (
            <TabsContent value="variants">
              <table className="w-full text-xs">
                <thead><tr className="border-b bg-muted/40">
                  <th className="text-left px-2 py-1.5">Variant</th>
                  <th className="text-right px-2 py-1.5">RTVs</th>
                  <th className="text-right px-2 py-1.5">Qty</th>
                  <th className="text-right px-2 py-1.5">Value</th>
                </tr></thead>
                <tbody>{variantRows.map((v, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-2 py-1.5 font-medium">{v.name}</td>
                    <td className="text-right px-2 py-1.5 tabular-nums">{v.rtv_count}</td>
                    <td className="text-right px-2 py-1.5 tabular-nums">{fmtN(v.qty)}</td>
                    <td className="text-right px-2 py-1.5 tabular-nums font-medium">{fmtV(v.value)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </TabsContent>
          )}
          <TabsContent value="items">
            <table className="w-full text-xs">
              <thead><tr className="border-b bg-muted/40">
                <th className="text-left px-2 py-1.5">Item</th>
                <th className="text-right px-2 py-1.5">RTVs</th>
                <th className="text-right px-2 py-1.5">Qty</th>
                <th className="text-right px-2 py-1.5">Value</th>
              </tr></thead>
              <tbody>{itemRows.map((it, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-2 py-1.5">{it.name}</td>
                  <td className="text-right px-2 py-1.5 tabular-nums">{it.rtv_count}</td>
                  <td className="text-right px-2 py-1.5 tabular-nums">{fmtN(it.qty)}</td>
                  <td className="text-right px-2 py-1.5 tabular-nums font-medium">{fmtV(it.value)}</td>
                </tr>
              ))}</tbody>
            </table>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function KPI({ icon, label, value, amber, color }: { icon: React.ReactNode; label: string; value: string; amber?: boolean; color?: string }) {
  return (
    <Card className={cn("overflow-hidden transition-shadow hover:shadow-md", amber && "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20")}>
      <CardContent className="p-4">
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center mb-3", color || "bg-slate-100 text-slate-600")}>{icon}</div>
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
