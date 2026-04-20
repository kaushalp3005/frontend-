"use client"

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  RefreshCw, ChevronRight, ChevronDown, ChevronsUpDown,
  Download, Copy, Camera, Loader2, ArrowLeft, Filter,
  TrendingUp, TrendingDown, Package, AlertTriangle,
  BarChart3, Send, Search, ArrowUpDown, EyeOff, X, Layers,
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { useAuthStore } from "@/lib/stores/auth"
import { normalizeWarehouseName, getNormalizedWarehouseLabel } from "@/lib/constants/warehouses"

const DASHBOARD_ALLOWED_EMAILS = ["yash@candorfoods.in", "b.hrithik@candorfoods.in"]
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, Cell,
} from "recharts"
import {
  coldStorageDashboardApi,
  type StockSummaryResponse, type StockLayer1, type StockLayer2, type StockLayer3,
  type AgeingSummaryResponse, type AgeingLayer1, type AgeingLayer2, type AgeingLayer3,
  type LotDetail, type LotDetailsResponse,
  type ConcentrationResponse, type ConcentrationItem,
  type InwardTrendResponse,
  type AttentionFlagsResponse, type AttentionFlag,
  type SlowMovingResponse, type SlowMovingItem,
  type ActivityRundownResponse,
} from "@/lib/api/coldStorageDashboardApi"

interface DashboardPageProps {
  params: { company: string }
}

// ── Formatters ─────────────────────────────────────────────────────
const fmtKgs = (n: number) => n ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"
const fmtVal = (n: number) => n ? "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "—"
const fmtRate = (n: number) => n ? "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"
const fmtCr = (n: number) => n ? "₹" + (n / 10000000).toFixed(2) + "Cr" : "—"
const fmtLakh = (n: number) => n ? "₹" + (n / 100000).toFixed(2) + "L" : "—"
const fmtBrk = (n: number) => (!n || n === 0) ? "" : n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
const fmtPct = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(1) + "%"

type ExpandKey = string
const makeKey = (...p: string[]): ExpandKey => p.join("|||")

// ── Lot redirect helper ────────────────────────────────────────────
function getLotRedirectHref(company: string, inwardNo: string | null | undefined): string | null {
  if (!inwardNo) return null
  const trimmed = inwardNo.trim()
  if (!trimmed) return null
  const upper = trimmed.toUpperCase()
  if (upper.startsWith("TR-") || upper.startsWith("TR2")) {
    return `/${company}/inward/${encodeURIComponent(trimmed)}`
  }
  // TRANS... or unknown → cold storage entry
  return `/${company}/cold-storage/entry/${encodeURIComponent(trimmed)}`
}

// ── Layer styles ───────────────────────────────────────────────────
const L_BG = [
  "bg-[#0f172a] text-white font-semibold",
  "bg-slate-100 dark:bg-slate-800 font-medium border-l-[3px] border-l-teal-500",
  "bg-slate-50 dark:bg-slate-800/50",
  "bg-white dark:bg-slate-900/80 text-slate-600 dark:text-slate-400",
]
const L_PL = ["pl-3", "pl-8", "pl-14", "pl-20"]

// ═══════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════
export default function ColdStorageDashboard({ params }: DashboardPageProps) {
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

  const [activeTab, setActiveTab] = useState<"stock" | "ageing" | "concentration">("stock")
  const [companyFilter, setCompanyFilter] = useState<string>("all")
  const [selectedLocation, setSelectedLocation] = useState<string>("all")
  const [rawLocations, setRawLocations] = useState<string[]>([])
  const [ageingView, setAgeingView] = useState<"kgs" | "value" | "both">("both")

  const [stockData, setStockData] = useState<StockSummaryResponse | null>(null)
  const [ageingData, setAgeingData] = useState<AgeingSummaryResponse | null>(null)
  const [concentrationData, setConcentrationData] = useState<ConcentrationResponse | null>(null)
  const [trendData, setTrendData] = useState<InwardTrendResponse | null>(null)
  const [attentionData, setAttentionData] = useState<AttentionFlagsResponse | null>(null)
  const [slowMovingData, setSlowMovingData] = useState<SlowMovingResponse | null>(null)
  const [rundownData, setRundownData] = useState<ActivityRundownResponse | null>(null)
  const [activeSection, setActiveSection] = useState("s1")
  const [attentionFilter, setAttentionFilter] = useState<string | null>(null)
  const [slowFilter, setSlowFilter] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloadingMaster, setDownloadingMaster] = useState(false)

  const handleDownloadMasterSheet = async () => {
    try {
      setDownloadingMaster(true)
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/cold-storage/stocks/download-summary`
      const res = await fetch(apiUrl, { headers: { Accept: "application/octet-stream" } })
      if (!res.ok) throw new Error(`Download failed: ${res.status}`)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `cold_storage_master_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Failed to download master sheet:", err)
    } finally {
      setDownloadingMaster(false)
    }
  }

  const [expanded, setExpanded] = useState<Set<ExpandKey>>(new Set())
  const [allExpanded, setAllExpanded] = useState(false)
  const [lotCache, setLotCache] = useState<Record<string, LotDetailsResponse>>({})
  const [lotLoading, setLotLoading] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)

  // Map from (canonicalLocation|||groupName) → array of raw DB storage_location strings.
  // Rebuilt by a useEffect below whenever stockData/ageingData changes. loadLots uses
  // this to query the backend with the LEGACY storage_location values (e.g. "Savla D-39
  // cold", "Savla Bond") instead of the canonical code ("Savla D-39"), which is only a
  // UI aggregation label and doesn't exist in any DB row.
  const rawLocationsMap = useRef<Map<string, string[]>>(new Map())

  // Search, sort, filter controls
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"value" | "kgs" | "lots" | "name">("value")
  const [hideUnassigned, setHideUnassigned] = useState(false)
  const [copyLayerOpen, setCopyLayerOpen] = useState(false)
  const [snapshotLayerOpen, setSnapshotLayerOpen] = useState(false)
  const stockRef = useRef<HTMLDivElement>(null)
  const ageingRef = useRef<HTMLDivElement>(null)
  const concRef = useRef<HTMLDivElement>(null)
  const tableRef = activeTab === "stock" ? stockRef : activeTab === "ageing" ? ageingRef : concRef

  // Canonical (deduped) location list for filter dropdown
  const locations = useMemo(() => {
    const seen = new Set<string>()
    const canonical: string[] = []
    for (const raw of rawLocations) {
      const normalized = normalizeWarehouseName(raw)
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized)
        canonical.push(normalized)
      }
    }
    return canonical.sort()
  }, [rawLocations])

  // When a canonical location is selected, fetch ALL and filter client-side (since the
  // API matches raw DB values but the dropdown now exposes canonical codes).
  const fetchData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true); else setLoading(true)
      setError(null)
      const [s, a, c, t, l, af, sm, rd] = await Promise.all([
        coldStorageDashboardApi.getStockSummary(companyFilter, undefined),
        coldStorageDashboardApi.getAgeingSummary(companyFilter, undefined),
        coldStorageDashboardApi.getConcentration(companyFilter, undefined),
        coldStorageDashboardApi.getInwardTrend(companyFilter, undefined),
        coldStorageDashboardApi.getStorageLocations(companyFilter),
        coldStorageDashboardApi.getAttentionFlags(companyFilter, undefined),
        coldStorageDashboardApi.getSlowMoving(companyFilter, undefined),
        coldStorageDashboardApi.getActivityRundown(companyFilter, undefined),
      ])
      setStockData(s); setAgeingData(a); setConcentrationData(c); setTrendData(t); setRawLocations(l)
      setAttentionData(af); setSlowMovingData(sm); setRundownData(rd)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard")
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [companyFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // Expand/collapse
  const toggle = (key: ExpandKey) => {
    setExpanded(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }
  const toggleAll = () => {
    if (allExpanded) { setExpanded(new Set()); setAllExpanded(false); return }
    const keys = new Set<ExpandKey>()
    const data = activeTab === "stock" ? stockData?.data : ageingData?.data
    data?.forEach(l1 => {
      const canonical = normalizeWarehouseName(l1.storage_location) || "Unassigned"
      keys.add(`wh|||${canonical}`)
      const k1 = makeKey(canonical, l1.group_name); keys.add(k1)
      l1.children?.forEach((l2: any) => {
        const k2 = makeKey(canonical, l1.group_name, l2.item_subgroup || l2.item_description); keys.add(k2)
        l2.children?.forEach((l3: any) => {
          keys.add(makeKey(canonical, l1.group_name, l2.item_subgroup || l2.item_description, l3.item_mark))
        })
      })
    })
    setExpanded(keys); setAllExpanded(true)
  }

  // Lazy-load lots. `loc` is the CANONICAL storage_location shown in the UI
  // (e.g. "Savla D-39"), but the backend queries DB rows whose storage_location
  // is the LEGACY raw value (e.g. "Old Savla", "Savla D-39 cold"). Look up the
  // set of raw values merged into this canonical+group in rawLocationsMap and
  // fan out the API call across all of them, merging the results.
  const loadLots = useCallback(async (loc: string, grp: string, sg: string, mark: string) => {
    const ck = makeKey(loc, grp, sg, mark)
    if (lotCache[ck]) return
    setLotLoading(prev => new Set(prev).add(ck))
    try {
      const mapKey = `${loc}|||${grp}`
      const rawLocs = rawLocationsMap.current.get(mapKey)
      const locsToTry = rawLocs && rawLocs.length > 0 ? rawLocs : [loc]

      const allLots: LotDetail[] = []
      let totalCount = 0
      let sgAvgRate = 0
      let sgAvgRateWeight = 0
      for (const rawLoc of locsToTry) {
        try {
          const res = await coldStorageDashboardApi.getLotDetails(companyFilter, rawLoc, grp, sg, mark)
          if (res?.lots?.length) {
            allLots.push(...res.lots)
            totalCount += res.total || res.lots.length
            // Weighted average of subgroup_avg_rate by lot count (best-effort blending)
            const w = res.lots.length
            if (res.subgroup_avg_rate > 0 && w > 0) {
              sgAvgRate += res.subgroup_avg_rate * w
              sgAvgRateWeight += w
            }
          }
        } catch (err) {
          console.warn(`Lot fetch failed for raw location "${rawLoc}":`, err)
        }
      }
      // Dedupe on lot_no + inward_no in case overlapping raw locations return the same lot
      const seen = new Set<string>()
      const dedupedLots = allLots.filter(l => {
        const key = `${l.lot_no}|${l.inward_no}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      // Sort lots by ageing_days descending (oldest first — useful for both FIFO stock view
      // and ageing analysis), then by lot_no alphabetically as a stable tiebreaker.
      dedupedLots.sort((a, b) => {
        const daysA = a.ageing_days ?? -1
        const daysB = b.ageing_days ?? -1
        if (daysB !== daysA) return daysB - daysA
        return (a.lot_no || "").localeCompare(b.lot_no || "")
      })
      const merged: LotDetailsResponse = {
        lots: dedupedLots,
        total: totalCount || dedupedLots.length,
        subgroup_avg_rate: sgAvgRateWeight > 0 ? sgAvgRate / sgAvgRateWeight : 0,
      }
      setLotCache(prev => ({ ...prev, [ck]: merged }))
    } catch (e) { console.error("Lot load failed:", e) }
    finally { setLotLoading(prev => { const n = new Set(prev); n.delete(ck); return n }) }
  }, [companyFilter, lotCache])

  const handleL3Toggle = (loc: string, grp: string, sg: string, mark: string) => {
    const key = makeKey(loc, grp, sg, mark)
    toggle(key)
    if (!expanded.has(key)) loadLots(loc, grp, sg, mark)
  }

  // Export Excel
  const handleExport = async () => {
    try {
      const XLSX = (await import("xlsx")).default || (await import("xlsx"))
      const rows: Record<string, any>[] = []
      if (activeTab === "stock" && stockData) {
        stockData.data.forEach(l1 => {
          const loc = normalizeWarehouseName(l1.storage_location) || "Unassigned"
          rows.push({ Location: loc, Group: l1.group_name, "Sub-Group": "", "Item Mark": "", "Total Kgs": l1.total_kgs, "Total Value": l1.total_value, "Avg Rate": l1.avg_rate, Lots: l1.lot_count })
          l1.children.forEach(l2 => {
            rows.push({ Location: loc, Group: l1.group_name, "Sub-Group": l2.item_subgroup, "Item Mark": "", "Total Kgs": l2.total_kgs, "Total Value": l2.total_value, "Avg Rate": l2.avg_rate, Lots: l2.lot_count })
            l2.children.forEach(l3 => {
              rows.push({ Location: loc, Group: l1.group_name, "Sub-Group": l2.item_subgroup, "Item Mark": l3.item_mark, "Total Kgs": l3.total_kgs, "Total Value": l3.total_value, "Avg Rate": l3.avg_rate, Lots: l3.lot_count })
            })
          })
        })
      } else if (activeTab === "ageing" && ageingData) {
        ageingData.data.forEach(l1 => {
          const loc = normalizeWarehouseName(l1.storage_location) || "Unassigned"
          rows.push({ Location: loc, Group: l1.group_name, "< 6M Kgs": l1.kgs_0_6, "6-12M Kgs": l1.kgs_6_12, "12-18M Kgs": l1.kgs_12_18, "18-24M Kgs": l1.kgs_18_24, ">24M Kgs": l1.kgs_24_plus, "Total Kgs": l1.grand_total_kgs, "Total Value": l1.grand_total_value })
        })
      } else if (activeTab === "concentration" && concentrationData) {
        concentrationData.items.forEach(it => {
          rows.push({ Rank: it.rank, Group: it.group_name, "Sub-Group": it.item_subgroup, "Total Kgs": it.total_kgs, "Total Value": it.total_value, "Portfolio %": it.portfolio_pct, "Avg Rate": it.avg_rate, Lots: it.lot_count, Fragmentation: it.fragmentation })
        })
      }
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, activeTab)
      XLSX.writeFile(wb, `ColdStorage_${activeTab}_${format(new Date(), "ddMMMyyyy")}.xlsx`)
    } catch (err) { console.error("Export failed:", err) }
  }

  // Snapshot
  const [snapping, setSnapping] = useState(false)

  // Filtered + sorted stock data (L1 rows with normalized storage_location).
  // The raw (pre-normalized) storage_location values are captured separately into
  // rawLocationsMap by the dedicated useEffect below, so loadLots can still hit
  // the backend with the LEGACY DB values after this map overwrites them.
  const filteredStock = useMemo(() => {
    if (!stockData) return []
    // First normalize storage_location on every L1 so downstream pivot/search/sort are consistent
    let data = stockData.data.map(l1 => ({ ...l1, storage_location: normalizeWarehouseName(l1.storage_location) || "Unassigned" }))
    // Client-side location filter (canonical code match)
    if (selectedLocation !== "all") data = data.filter(l1 => l1.storage_location === selectedLocation)
    if (hideUnassigned) data = data.filter(l1 => l1.storage_location !== "Unassigned" && l1.group_name !== "Ungrouped")
    const sq = searchQuery.toLowerCase().trim()
    if (sq) data = data.filter(l1 =>
      l1.storage_location.toLowerCase().includes(sq) || l1.group_name.toLowerCase().includes(sq) ||
      l1.children.some(l2 => l2.item_subgroup.toLowerCase().includes(sq) ||
        l2.children.some(l3 => l3.item_mark.toLowerCase().includes(sq))))
    const sortFn = (a: StockLayer1, b: StockLayer1) => {
      switch (sortBy) { case "value": return b.total_value - a.total_value; case "kgs": return b.total_kgs - a.total_kgs; case "lots": return b.lot_count - a.lot_count; case "name": return a.storage_location.localeCompare(b.storage_location); default: return 0 }
    }
    return [...data].sort(sortFn)
  }, [stockData, searchQuery, sortBy, hideUnassigned, selectedLocation])

  const filteredAgeing = useMemo(() => {
    if (!ageingData) return []
    // Normalize storage_location on every L1. Raw names are preserved by the
    // rawLocationsMap effect above (from ageingData.data) for lot-details API calls.
    let data = ageingData.data.map(l1 => ({ ...l1, storage_location: normalizeWarehouseName(l1.storage_location) || "Unassigned" }))
    if (selectedLocation !== "all") data = data.filter(l1 => l1.storage_location === selectedLocation)
    if (hideUnassigned) data = data.filter(l1 => l1.storage_location !== "Unassigned" && l1.group_name !== "Ungrouped")
    const sq = searchQuery.toLowerCase().trim()
    if (sq) data = data.filter(l1 =>
      l1.storage_location.toLowerCase().includes(sq) || l1.group_name.toLowerCase().includes(sq) ||
      l1.children.some(l2 => l2.item_subgroup.toLowerCase().includes(sq) ||
        l2.children.some(l3 => l3.item_mark.toLowerCase().includes(sq))))
    return [...data].sort((a, b) => {
      switch (sortBy) { case "value": return (b.grand_total_value || 0) - (a.grand_total_value || 0); case "kgs": return b.grand_total_kgs - a.grand_total_kgs; case "name": return a.storage_location.localeCompare(b.storage_location); default: return b.grand_total_kgs - a.grand_total_kgs }
    })
  }, [ageingData, searchQuery, sortBy, hideUnassigned, selectedLocation])

  // ── L3 (item_mark) weighted-age proxy: heavier OLDER stock scores higher ──
  // Uses bracket midpoints in months; items with more mass in high brackets rank first.
  const l3AgeScore = (l3: AgeingLayer3): number => {
    const k06 = l3.kgs_0_6 || 0
    const k612 = l3.kgs_6_12 || 0
    const k1218 = l3.kgs_12_18 || 0
    const k1824 = l3.kgs_18_24 || 0
    const k24 = l3.kgs_24_plus || 0
    const total = k06 + k612 + k1218 + k1824 + k24
    if (total === 0) return 0
    return (3 * k06 + 9 * k612 + 15 * k1218 + 21 * k1824 + 30 * k24) / total
  }

  // ── Warehouse-first pivot: groups L1 rows by canonical storage_location ──
  type WarehousePivot = {
    warehouseCode: string
    warehouseLabel: string
    totalKgs: number
    totalValue: number
    avgRate: number
    lotCount: number
    categories: StockLayer1[]
  }

  // Rebuild the raw-location lookup whenever the source stock/ageing data changes.
  // Keyed by (canonicalLocation|||groupName) → all raw DB storage_location values
  // that normalize to this canonical name. loadLots consults this to fan API calls.
  useEffect(() => {
    const map = rawLocationsMap.current
    map.clear()
    const ingest = (storage_location: string, group_name: string) => {
      const canonical = normalizeWarehouseName(storage_location) || "Unassigned"
      const mapKey = `${canonical}|||${group_name}`
      const existing = map.get(mapKey) || []
      if (!existing.includes(storage_location)) existing.push(storage_location)
      map.set(mapKey, existing)
    }
    stockData?.data.forEach(l1 => ingest(l1.storage_location, l1.group_name))
    ageingData?.data.forEach(l1 => ingest(l1.storage_location, l1.group_name))
  }, [stockData, ageingData])

  const warehousePivot = useMemo((): WarehousePivot[] => {
    if (!filteredStock.length) return []
    const byWh = new Map<string, StockLayer1[]>()
    for (const l1 of filteredStock) {
      const canonical = l1.storage_location || "Unassigned"
      const arr = byWh.get(canonical) || []
      arr.push(l1)
      byWh.set(canonical, arr)
    }
    const pivots: WarehousePivot[] = []
    for (const [canonical, l1s] of byWh.entries()) {
      // Merge L1 rows with the SAME warehouse + group (dedupe legacy aliases).
      const byGroup = new Map<string, StockLayer1>()
      for (const l1 of l1s) {
        const existing = byGroup.get(l1.group_name)
        if (existing) {
          const newKgs = existing.total_kgs + l1.total_kgs
          const newValue = existing.total_value + l1.total_value
          const newLots = existing.lot_count + l1.lot_count
          byGroup.set(l1.group_name, {
            ...existing,
            total_kgs: newKgs,
            total_value: newValue,
            avg_rate: newKgs > 0 ? newValue / newKgs : 0,
            lot_count: newLots,
            children: [...(existing.children || []), ...(l1.children || [])],
          })
        } else {
          byGroup.set(l1.group_name, l1)
        }
      }
      // Apply top-level sort at the category level within each warehouse
      const categories = Array.from(byGroup.values()).sort((a, b) => {
        switch (sortBy) {
          case "value": return b.total_value - a.total_value
          case "kgs": return b.total_kgs - a.total_kgs
          case "lots": return b.lot_count - a.lot_count
          case "name": return (a.group_name || "").localeCompare(b.group_name || "")
          default: return b.total_kgs - a.total_kgs
        }
      })
      const totalKgs = categories.reduce((s, c) => s + c.total_kgs, 0)
      const totalValue = categories.reduce((s, c) => s + c.total_value, 0)
      const lotCount = categories.reduce((s, c) => s + c.lot_count, 0)
      pivots.push({
        warehouseCode: canonical,
        warehouseLabel: getNormalizedWarehouseLabel(canonical),
        totalKgs, totalValue,
        avgRate: totalKgs > 0 ? totalValue / totalKgs : 0,
        lotCount, categories,
      })
    }
    // Apply top-level sort at the warehouse level (mirrors sortBy)
    return pivots.sort((a, b) => {
      switch (sortBy) {
        case "value": return b.totalValue - a.totalValue
        case "kgs": return b.totalKgs - a.totalKgs
        case "lots": return b.lotCount - a.lotCount
        case "name": return a.warehouseLabel.localeCompare(b.warehouseLabel)
        default: return b.totalKgs - a.totalKgs
      }
    })
  }, [filteredStock, sortBy])

  type AgeingPivot = {
    warehouseCode: string
    warehouseLabel: string
    kgs_0_6: number; kgs_6_12: number; kgs_12_18: number; kgs_18_24: number; kgs_24_plus: number
    val_0_6: number; val_6_12: number; val_12_18: number; val_18_24: number; val_24_plus: number
    grand_total_kgs: number; grand_total_value: number
    categories: AgeingLayer1[]
  }

  const ageingPivot = useMemo((): AgeingPivot[] => {
    if (!filteredAgeing.length) return []
    const byWh = new Map<string, AgeingLayer1[]>()
    for (const l1 of filteredAgeing) {
      const canonical = l1.storage_location || "Unassigned"
      const arr = byWh.get(canonical) || []
      arr.push(l1)
      byWh.set(canonical, arr)
    }
    const pivots: AgeingPivot[] = []
    for (const [canonical, l1s] of byWh.entries()) {
      const byGroup = new Map<string, AgeingLayer1>()
      for (const l1 of l1s) {
        const existing = byGroup.get(l1.group_name)
        if (existing) {
          byGroup.set(l1.group_name, {
            ...existing,
            kgs_0_6: existing.kgs_0_6 + l1.kgs_0_6,
            kgs_6_12: existing.kgs_6_12 + l1.kgs_6_12,
            kgs_12_18: existing.kgs_12_18 + l1.kgs_12_18,
            kgs_18_24: existing.kgs_18_24 + l1.kgs_18_24,
            kgs_24_plus: existing.kgs_24_plus + l1.kgs_24_plus,
            val_0_6: (existing.val_0_6 || 0) + (l1.val_0_6 || 0),
            val_6_12: (existing.val_6_12 || 0) + (l1.val_6_12 || 0),
            val_12_18: (existing.val_12_18 || 0) + (l1.val_12_18 || 0),
            val_18_24: (existing.val_18_24 || 0) + (l1.val_18_24 || 0),
            val_24_plus: (existing.val_24_plus || 0) + (l1.val_24_plus || 0),
            grand_total_kgs: existing.grand_total_kgs + l1.grand_total_kgs,
            grand_total_value: (existing.grand_total_value || 0) + (l1.grand_total_value || 0),
            children: [...(existing.children || []), ...(l1.children || [])],
          } as AgeingLayer1)
        } else {
          byGroup.set(l1.group_name, l1)
        }
      }
      // Apply top-level sort at the category (L1) level within each warehouse
      const categories = Array.from(byGroup.values()).sort((a, b) => {
        switch (sortBy) {
          case "value": return (b.grand_total_value || 0) - (a.grand_total_value || 0)
          case "kgs": return b.grand_total_kgs - a.grand_total_kgs
          case "lots":
            // AgeingLayer1 has no lot_count — fall back to kgs (closest proxy for "size")
            return b.grand_total_kgs - a.grand_total_kgs
          case "name": return (a.group_name || "").localeCompare(b.group_name || "")
          default: return b.grand_total_kgs - a.grand_total_kgs
        }
      })
      // Sort L3 (item_mark) children within each L2 by weighted age score desc, then item_mark A-Z.
      // This surfaces items carrying heavier OLDER stock first inside each sub-group.
      for (const l1cat of categories) {
        for (const l2 of l1cat.children || []) {
          l2.children = [...(l2.children || [])].sort((a, b) => {
            const scoreA = l3AgeScore(a)
            const scoreB = l3AgeScore(b)
            if (scoreB !== scoreA) return scoreB - scoreA
            return (a.item_mark || "").localeCompare(b.item_mark || "")
          })
        }
      }
      pivots.push({
        warehouseCode: canonical,
        warehouseLabel: getNormalizedWarehouseLabel(canonical),
        kgs_0_6: categories.reduce((s, c) => s + c.kgs_0_6, 0),
        kgs_6_12: categories.reduce((s, c) => s + c.kgs_6_12, 0),
        kgs_12_18: categories.reduce((s, c) => s + c.kgs_12_18, 0),
        kgs_18_24: categories.reduce((s, c) => s + c.kgs_18_24, 0),
        kgs_24_plus: categories.reduce((s, c) => s + c.kgs_24_plus, 0),
        val_0_6: categories.reduce((s, c) => s + (c.val_0_6 || 0), 0),
        val_6_12: categories.reduce((s, c) => s + (c.val_6_12 || 0), 0),
        val_12_18: categories.reduce((s, c) => s + (c.val_12_18 || 0), 0),
        val_18_24: categories.reduce((s, c) => s + (c.val_18_24 || 0), 0),
        val_24_plus: categories.reduce((s, c) => s + (c.val_24_plus || 0), 0),
        grand_total_kgs: categories.reduce((s, c) => s + c.grand_total_kgs, 0),
        grand_total_value: categories.reduce((s, c) => s + (c.grand_total_value || 0), 0),
        categories,
      })
    }
    // Apply top-level sort at the warehouse level (mirrors sortBy)
    return pivots.sort((a, b) => {
      switch (sortBy) {
        case "value": return (b.grand_total_value || 0) - (a.grand_total_value || 0)
        case "kgs": return b.grand_total_kgs - a.grand_total_kgs
        case "lots":
          // No warehouse-level lot_count on ageing pivot — fall back to kgs
          return b.grand_total_kgs - a.grand_total_kgs
        case "name": return a.warehouseLabel.localeCompare(b.warehouseLabel)
        default: return b.grand_total_kgs - a.grand_total_kgs
      }
    })
  }, [filteredAgeing, sortBy])

  // Expand to specific layer (also opens warehouse header rows)
  const expandToLayer = (level: 1 | 2 | 3) => {
    const keys = new Set<ExpandKey>()
    const data = activeTab === "stock" ? filteredStock : filteredAgeing
    data.forEach(l1 => {
      keys.add(`wh|||${l1.storage_location}`)
      if (level >= 1) keys.add(makeKey(l1.storage_location, l1.group_name))
      if (level >= 2) l1.children.forEach((l2: any) => keys.add(makeKey(l1.storage_location, l1.group_name, l2.item_subgroup)))
      if (level >= 3) l1.children.forEach((l2: any) => l2.children.forEach((l3: any) => keys.add(makeKey(l1.storage_location, l1.group_name, l2.item_subgroup, l3.item_mark))))
    })
    setExpanded(keys); setAllExpanded(level >= 2)
  }

  // Copy with layer selection
  const handleCopyLayer = async (layer: 1 | 2 | 3) => {
    const d = format(new Date(), "dd MMM yyyy")
    const tab = activeTab === "stock" ? "Stock" : "Ageing"
    const lines = [`Cold Storage ${tab} Summary - ${d}`, `Company: ${companyFilter.toUpperCase()} | ${selectedLocation === "all" ? "All Locations" : selectedLocation}`, ""]

    if (activeTab === "stock") {
      filteredStock.forEach(l1 => {
        lines.push(`${l1.storage_location} - ${l1.group_name}   ${fmtKgs(l1.total_kgs)} Kgs   ${fmtVal(l1.total_value)}   ${l1.lot_count} lots`)
        if (layer >= 2) l1.children.forEach(l2 => {
          lines.push(`  ${l2.item_subgroup}   ${fmtKgs(l2.total_kgs)} Kgs   ${fmtVal(l2.total_value)}`)
          if (layer >= 3) l2.children.forEach(l3 => {
            lines.push(`    ${l3.item_mark}   ${fmtKgs(l3.total_kgs)} Kgs   ${fmtVal(l3.total_value)}`)
          })
        })
      })
    } else {
      filteredAgeing.forEach(l1 => {
        lines.push(`${l1.storage_location} - ${l1.group_name}   ${fmtKgs(l1.grand_total_kgs)} Kgs`)
        if (layer >= 2) l1.children.forEach((l2: any) => lines.push(`  ${l2.item_subgroup}   ${fmtKgs(l2.grand_total_kgs)} Kgs`))
      })
    }
    lines.push("", `Grand Total  ${fmtKgs(stockData?.grand_total.total_kgs || 0)} Kgs  ${fmtVal(stockData?.grand_total.total_value || 0)}`)
    try { await navigator.clipboard.writeText(lines.join("\n")); setCopied(true); setCopyLayerOpen(false); setTimeout(() => setCopied(false), 2000) } catch {}
  }

  // Snapshot with layer selection — builds a clean HTML table and converts to PNG
  const handleSnapshotLayer = async (layer: 1 | 2 | 3) => {
    setSnapping(true); setSnapshotLayerOpen(false)
    try {
      const d = format(new Date(), "dd MMM yyyy")
      const tab = activeTab === "stock" ? "Stock Summary" : "Ageing Summary"
      const data = activeTab === "stock" ? filteredStock : filteredAgeing

      // Build clean HTML table
      let html = `<div style="font-family:system-ui,sans-serif;padding:24px;background:#fff;min-width:600px">
        <h2 style="margin:0 0 4px;font-size:18px">Cold Storage ${tab}</h2>
        <p style="margin:0 0 16px;font-size:12px;color:#64748b">${d} · ${companyFilter.toUpperCase()} · ${selectedLocation === "all" ? "All Locations" : selectedLocation}</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px">`

      if (activeTab === "stock") {
        html += `<tr style="background:#0f172a;color:#fff"><th style="text-align:left;padding:8px">Category</th><th style="text-align:right;padding:8px">Total Kgs</th><th style="text-align:right;padding:8px">Total Value</th><th style="text-align:right;padding:8px">Avg Rate</th><th style="text-align:right;padding:8px">Lots</th></tr>`
        filteredStock.forEach(l1 => {
          html += `<tr style="background:#1e293b;color:#fff;font-weight:600"><td style="padding:6px 8px">${l1.storage_location} — ${l1.group_name}</td><td style="text-align:right;padding:6px 8px">${fmtKgs(l1.total_kgs)}</td><td style="text-align:right;padding:6px 8px">${fmtVal(l1.total_value)}</td><td style="text-align:right;padding:6px 8px">${fmtRate(l1.avg_rate)}</td><td style="text-align:right;padding:6px 8px">${l1.lot_count}</td></tr>`
          if (layer >= 2) l1.children.forEach(l2 => {
            html += `<tr style="background:#f1f5f9"><td style="padding:6px 8px 6px 24px">${l2.item_subgroup}</td><td style="text-align:right;padding:6px 8px">${fmtKgs(l2.total_kgs)}</td><td style="text-align:right;padding:6px 8px">${fmtVal(l2.total_value)}</td><td style="text-align:right;padding:6px 8px">${fmtRate(l2.avg_rate)}</td><td style="text-align:right;padding:6px 8px">${l2.lot_count}</td></tr>`
            if (layer >= 3) l2.children.forEach(l3 => {
              html += `<tr style="background:#fff"><td style="padding:6px 8px 6px 48px">${l3.item_mark}</td><td style="text-align:right;padding:6px 8px">${fmtKgs(l3.total_kgs)}</td><td style="text-align:right;padding:6px 8px">${fmtVal(l3.total_value)}</td><td style="text-align:right;padding:6px 8px">${fmtRate(l3.avg_rate)}</td><td style="text-align:right;padding:6px 8px">${l3.lot_count}</td></tr>`
            })
          })
        })
        html += `<tr style="background:#0f172a;color:#fff;font-weight:700"><td style="padding:8px">Grand Total</td><td style="text-align:right;padding:8px">${fmtKgs(stockData?.grand_total.total_kgs || 0)}</td><td style="text-align:right;padding:8px">${fmtVal(stockData?.grand_total.total_value || 0)}</td><td style="text-align:right;padding:8px">${fmtRate(stockData?.grand_total.avg_rate || 0)}</td><td style="text-align:right;padding:8px">${stockData?.grand_total.lot_count || 0}</td></tr>`
      } else {
        html += `<tr style="background:#0f172a;color:#fff"><th style="text-align:left;padding:8px">Category</th><th style="text-align:right;padding:8px">&lt;6M</th><th style="text-align:right;padding:8px">6-12M</th><th style="text-align:right;padding:8px">12-18M</th><th style="text-align:right;padding:8px">18-24M</th><th style="text-align:right;padding:8px">&gt;24M</th><th style="text-align:right;padding:8px">Total</th></tr>`
        filteredAgeing.forEach(l1 => {
          html += `<tr style="background:#1e293b;color:#fff;font-weight:600"><td style="padding:6px 8px">${l1.storage_location} — ${l1.group_name}</td><td style="text-align:right;padding:6px 8px">${fmtKgs(l1.kgs_0_6)}</td><td style="text-align:right;padding:6px 8px">${fmtKgs(l1.kgs_6_12)}</td><td style="text-align:right;padding:6px 8px">${fmtKgs(l1.kgs_12_18)}</td><td style="text-align:right;padding:6px 8px;${l1.kgs_18_24 > 0 ? "background:#fef3c7;color:#92400e" : ""}">${fmtKgs(l1.kgs_18_24)}</td><td style="text-align:right;padding:6px 8px;${l1.kgs_24_plus > 0 ? "background:#fee2e2;color:#991b1b" : ""}">${fmtKgs(l1.kgs_24_plus)}</td><td style="text-align:right;padding:6px 8px">${fmtKgs(l1.grand_total_kgs)}</td></tr>`
          if (layer >= 2) l1.children.forEach((l2: any) => {
            html += `<tr style="background:#f1f5f9"><td style="padding:6px 8px 6px 24px">${l2.item_subgroup}</td><td style="text-align:right;padding:6px 8px">${fmtKgs(l2.kgs_0_6)}</td><td style="text-align:right;padding:6px 8px">${fmtKgs(l2.kgs_6_12)}</td><td style="text-align:right;padding:6px 8px">${fmtKgs(l2.kgs_12_18)}</td><td style="text-align:right;padding:6px 8px;${l2.kgs_18_24 > 0 ? "background:#fef3c7;color:#92400e" : ""}">${fmtKgs(l2.kgs_18_24)}</td><td style="text-align:right;padding:6px 8px;${l2.kgs_24_plus > 0 ? "background:#fee2e2;color:#991b1b" : ""}">${fmtKgs(l2.kgs_24_plus)}</td><td style="text-align:right;padding:6px 8px">${fmtKgs(l2.grand_total_kgs)}</td></tr>`
          })
        })
      }
      html += `</table></div>`

      // Render to canvas via offscreen iframe
      const iframe = document.createElement("iframe")
      iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:900px;height:auto;border:0"
      document.body.appendChild(iframe)
      iframe.contentDocument!.open()
      iframe.contentDocument!.write(`<!DOCTYPE html><html><body style="margin:0">${html}</body></html>`)
      iframe.contentDocument!.close()

      await new Promise(r => setTimeout(r, 100))
      const target = iframe.contentDocument!.body.firstElementChild as HTMLElement
      const mod = await import("html2canvas")
      const html2canvas = mod.default || mod
      const canvas = await html2canvas(target, { backgroundColor: "#fff", scale: 2 })
      document.body.removeChild(iframe)

      const link = document.createElement("a")
      const tabName = activeTab === "stock" ? "StockSummary" : "AgeingSummary"
      link.download = `ColdStorage_${tabName}_L${layer}_${format(new Date(), "ddMMMyyyy")}.png`
      link.href = canvas.toDataURL("image/png")
      document.body.appendChild(link); link.click(); document.body.removeChild(link)
    } catch (err) { console.error("Snapshot failed:", err) }
    finally { setSnapping(false) }
  }

  const asOf = stockData?.as_of_date ? format(new Date(stockData.as_of_date + "T00:00:00"), "dd-MMM-yyyy") : format(new Date(), "dd-MMM-yyyy")
  const companyLabel = companyFilter === "all" ? "CDPL+CFPL" : companyFilter.toUpperCase()

  // ═══════════════════════════════════════════════════════════════
  return (
    <PermissionGuard module="cold-storage" action="view">
      <div className="p-3 sm:p-4 md:p-6 max-w-[1600px] mx-auto space-y-4">

        {/* ── HEADER ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href={`/${company}/cold-storage`}><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Cold Storage Summary</h1>
              <p className="text-xs text-muted-foreground">As of {asOf} &middot; {companyLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Company Toggle */}
            <div className="flex rounded-lg border overflow-hidden text-xs">
              {["all", "cdpl", "cfpl"].map(c => (
                <button key={c} onClick={() => setCompanyFilter(c)}
                  className={cn("px-3 py-1.5 transition-colors", companyFilter === c ? "bg-[#0f172a] text-white" : "bg-white dark:bg-slate-800 hover:bg-slate-100")}>
                  {c === "all" ? "All" : c.toUpperCase()}
                </button>
              ))}
            </div>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><Filter className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={handleDownloadMasterSheet} disabled={downloadingMaster}>
              {downloadingMaster ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Master Sheet</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => fetchData(true)} disabled={refreshing}>
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /><span className="hidden sm:inline">Refresh</span>
            </Button>
            <div className="relative">
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setSnapshotLayerOpen(!snapshotLayerOpen)} disabled={snapping}>
                {snapping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}<span className="hidden sm:inline">{snapping ? "Capturing..." : "Snapshot"}</span>
              </Button>
              {snapshotLayerOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-900 border rounded-lg shadow-lg z-50 py-1 min-w-[160px]">
                  {[{ l: 1 as const, t: "Layer 1 only" }, { l: 2 as const, t: "Layer 1 + 2" }, { l: 3 as const, t: "Layer 1 + 2 + 3" }].map(o => (
                    <button key={o.l} onClick={() => handleSnapshotLayer(o.l)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800">{o.t}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setCopyLayerOpen(!copyLayerOpen)}>
                <Copy className="h-3.5 w-3.5" /><span className="hidden sm:inline">{copied ? "Copied!" : "Copy"}</span>
              </Button>
              {copyLayerOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-900 border rounded-lg shadow-lg z-50 py-1 min-w-[160px]">
                  {[{ l: 1 as const, t: "Layer 1 only" }, { l: 2 as const, t: "Layer 1 + 2" }, { l: 3 as const, t: "Layer 1 + 2 + 3" }].map(o => (
                    <button key={o.l} onClick={() => handleCopyLayer(o.l)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800">{o.t}</button>
                  ))}
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">Excel</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs opacity-50 cursor-not-allowed" title="Coming Soon" disabled>
              <Send className="h-3.5 w-3.5" /><span className="hidden sm:inline">WhatsApp</span>
            </Button>
          </div>
        </div>

        {/* ── INSIGHTS PANEL ── */}
        {!loading && trendData && (
          <div className="space-y-3">
            {/* KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <KPICard label="Total Stock" value={fmtKgs(trendData.total_stock_kgs) + " Kgs"} />
              <KPICard label="Total Value" value={fmtCr(trendData.total_stock_value)} />
              <KPICard label="Open Lots" value={trendData.total_open_lots.toLocaleString("en-IN")} />
              <KPICard label="This Month Inward" value={fmtKgs(trendData.current_month_kgs) + " Kgs"} />
              <KPICard label="vs Last Month" value={fmtPct(trendData.mom_change_pct)} accent={trendData.mom_change_pct < 0} />
              <KPICard label="Avg Monthly" value={fmtKgs(trendData.avg_monthly_kgs) + " Kgs"} />
            </div>

            {/* Chart + Insights side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* Inward Trend Chart — taller */}
              <Card className="lg:col-span-2">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">Inward Trend by Date — Last 12 Months</h3>
                    {trendData.peak_month && (
                      <span className="text-[10px] text-muted-foreground">
                        Peak: {trendData.peak_month.month_label} ({fmtKgs(trendData.peak_month.total_kgs)} Kgs)
                      </span>
                    )}
                  </div>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData.months} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="month_label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tickFormatter={v => (v / 1000).toFixed(0) + "K"} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={45} />
                        <ReTooltip
                          formatter={(v: number, _: any, p: any) => [
                            `${fmtKgs(v)} Kgs · ${p.payload.lot_count} lots · ${fmtCr(p.payload.total_value)}`, ""
                          ]}
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                          labelFormatter={(_, payload) => payload?.[0]?.payload?.month_label || ""}
                        />
                        <Bar dataKey="total_kgs" radius={[4, 4, 0, 0]}>
                          {trendData.months.map((m, i) => (
                            <Cell key={i} fill={
                              i === trendData.months.length - 1 ? "#14b8a6" :
                              trendData.peak_month && m.month === trendData.peak_month.month ? "#0ea5e9" : "#cbd5e1"
                            } />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Last 3 months account for {trendData.last3_months_pct}% of total current stock &middot;
                    {" "}{trendData.group_count} groups across {trendData.location_count} locations
                    {trendData.earliest_inward && <> &middot; Earliest: {trendData.earliest_inward}</>}
                  </p>
                </CardContent>
              </Card>

              {/* Right side — Top Groups + Top Inward Dates */}
              <div className="space-y-3">
                {/* Top Groups by Stock */}
                <Card>
                  <CardContent className="p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Top Groups by Stock</h3>
                    <div className="space-y-1.5">
                      {trendData.top_groups.map((g, i) => {
                        const pct = trendData.total_stock_kgs > 0 ? (g.total_kgs / trendData.total_stock_kgs) * 100 : 0
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs font-medium w-[100px] truncate" title={g.group_name}>{g.group_name}</span>
                            <div className="flex-1 h-[8px] bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground tabular-nums w-[65px] text-right">{fmtKgs(g.total_kgs)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Inward Dates */}
                <Card>
                  <CardContent className="p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Largest Inward Dates</h3>
                    <div className="space-y-1">
                      {trendData.top_inward_dates.map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{d.date ? format(new Date(d.date), "dd MMM yyyy") : "—"}</span>
                          <span className="font-medium tabular-nums">{fmtKgs(d.total_kgs)} Kgs</span>
                          <span className="text-[10px] text-muted-foreground">{d.lot_count} lots</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {error && <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg">{error}</div>}

        {/* ── TABS ── */}
        <Tabs value={activeTab} onValueChange={v => { setActiveTab(v as any); setExpanded(new Set()); setAllExpanded(false) }}>
          <div className="flex items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="stock" className="text-xs sm:text-sm">Stock Summary</TabsTrigger>
              <TabsTrigger value="ageing" className="text-xs sm:text-sm">Ageing Summary</TabsTrigger>
              <TabsTrigger value="concentration" className="text-xs sm:text-sm">Concentration & Risk</TabsTrigger>
            </TabsList>
            {activeTab !== "concentration" && (
              <div className="flex items-center gap-1.5">
                {/* Layer expand dropdown */}
                <div className="flex rounded-lg border overflow-hidden text-xs">
                  <button onClick={() => { setExpanded(new Set()); setAllExpanded(false) }} className={cn("px-2 py-1 transition-colors", !allExpanded && expanded.size === 0 ? "bg-[#0f172a] text-white" : "hover:bg-slate-100")}>Collapse</button>
                  <button onClick={() => expandToLayer(1)} className="px-2 py-1 transition-colors hover:bg-slate-100">L1</button>
                  <button onClick={() => expandToLayer(2)} className="px-2 py-1 transition-colors hover:bg-slate-100">L1+2</button>
                  <button onClick={() => expandToLayer(3)} className="px-2 py-1 transition-colors hover:bg-slate-100">L1+2+3</button>
                </div>
              </div>
            )}
          </div>

          {/* Search + Sort + Hide Unassigned */}
          {activeTab !== "concentration" && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <div className="relative flex-1 max-w-[280px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text" placeholder="Search locations, groups, items..."
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="h-8 w-full pl-8 pr-7 text-xs rounded-md border bg-background"
                />
                {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-3 w-3 text-muted-foreground" /></button>}
              </div>
              <div className="flex items-center gap-1">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="flex rounded-lg border overflow-hidden text-xs">
                  {[{ v: "value" as const, l: "Value" }, { v: "kgs" as const, l: "Kgs" }, { v: "lots" as const, l: "Lots" }, { v: "name" as const, l: "A-Z" }].map(s => (
                    <button key={s.v} onClick={() => setSortBy(s.v)}
                      className={cn("px-2 py-1.5 transition-colors", sortBy === s.v ? "bg-[#0f172a] text-white" : "hover:bg-slate-100")}>{s.l}</button>
                  ))}
                </div>
              </div>
              <button onClick={() => setHideUnassigned(!hideUnassigned)}
                className={cn("text-xs px-2.5 py-1.5 rounded-lg border flex items-center gap-1 transition-colors",
                  hideUnassigned ? "bg-slate-800 text-white border-slate-800" : "hover:bg-slate-100 border-slate-200")}>
                <EyeOff className="h-3 w-3" /> Hide Unassigned
              </button>
            </div>
          )}

          {/* ══════ TAB 1: STOCK SUMMARY ══════ */}
          <TabsContent value="stock" className="mt-3 space-y-3">
            <DashboardLegend tab="stock" />
            <Card><CardContent className="p-0">
              {loading ? <TableSkeleton /> : (
                <div ref={stockRef} className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b bg-muted/60 backdrop-blur">
                        <th className="text-left font-medium text-xs uppercase tracking-wider px-3 py-2.5 min-w-[280px]">Category</th>
                        <th className="text-right font-medium text-xs uppercase tracking-wider px-3 py-2.5 w-[130px]">Total Kgs</th>
                        <th className="text-right font-medium text-xs uppercase tracking-wider px-3 py-2.5 w-[130px]">Total Value</th>
                        <th className="text-right font-medium text-xs uppercase tracking-wider px-3 py-2.5 w-[110px]">Avg Rate</th>
                        <th className="text-right font-medium text-xs uppercase tracking-wider px-3 py-2.5 w-[70px]">Lots</th>
                      </tr>
                    </thead>
                    <tbody>
                      {warehousePivot.map(wh => {
                        const whKey = `wh|||${wh.warehouseCode}`
                        const isWhExpanded = expanded.has(whKey)
                        return (
                          <React.Fragment key={whKey}>
                            <tr
                              className="cursor-pointer bg-gradient-to-r from-cyan-900 to-blue-900 text-white hover:from-cyan-800 hover:to-blue-800 transition-colors border-b-2 border-cyan-500/30"
                              onClick={() => toggle(whKey)}
                            >
                              <td className="px-4 py-3 font-bold text-sm">
                                <span className="inline-flex items-center gap-2">
                                  {isWhExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-cyan-300" />
                                    {wh.warehouseLabel}
                                  </span>
                                  <span className="text-xs font-normal text-cyan-200 ml-2">
                                    {wh.categories.length} {wh.categories.length === 1 ? "category" : "categories"}
                                  </span>
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-bold tabular-nums">{fmtKgs(wh.totalKgs)}</td>
                              <td className="px-4 py-3 text-right font-bold tabular-nums">{fmtVal(wh.totalValue)}</td>
                              <td className="px-4 py-3 text-right font-medium tabular-nums">{fmtRate(wh.avgRate)}</td>
                              <td className="px-4 py-3 text-right font-bold tabular-nums">{wh.lotCount}</td>
                            </tr>
                            {isWhExpanded && wh.categories.map(l1 => (
                              <StockL1 key={`${wh.warehouseCode}|||${l1.group_name}`} l1={l1} ex={expanded} toggle={toggle} l3t={handleL3Toggle} lc={lotCache} ll={lotLoading} />
                            ))}
                          </React.Fragment>
                        )
                      })}
                      {stockData && (
                        <tr className="border-t-2 border-slate-300 bg-[#0f172a] text-white font-bold sticky bottom-0">
                          <td className="px-3 py-2.5">Grand Total</td>
                          <td className="text-right px-3 py-2.5 tabular-nums">{fmtKgs(stockData.grand_total.total_kgs)}</td>
                          <td className="text-right px-3 py-2.5 tabular-nums">{fmtVal(stockData.grand_total.total_value)}</td>
                          <td className="text-right px-3 py-2.5 tabular-nums">{fmtRate(stockData.grand_total.avg_rate)}</td>
                          <td className="text-right px-3 py-2.5 tabular-nums">{stockData.grand_total.lot_count}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* ══════ TAB 2: AGEING SUMMARY ══════ */}
          <TabsContent value="ageing" className="mt-3 space-y-3">
            <DashboardLegend tab="ageing" />
            {/* Value-at-risk line + view toggle */}
            {ageingData && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
                <p className="text-xs text-muted-foreground">
                  <AlertTriangle className="inline h-3.5 w-3.5 text-amber-500 mr-1" />
                  18-24M: <span className="font-medium text-amber-700">{fmtLakh(ageingData.grand_total.val_18_24)}</span> at risk &middot;
                  &gt;24M: <span className="font-medium text-red-700">{fmtLakh(ageingData.grand_total.val_24_plus)}</span> at risk
                </p>
                <div className="flex rounded-lg border overflow-hidden text-xs">
                  {(["kgs", "value", "both"] as const).map(v => (
                    <button key={v} onClick={() => setAgeingView(v)}
                      className={cn("px-3 py-1 transition-colors capitalize", ageingView === v ? "bg-[#0f172a] text-white" : "hover:bg-slate-100")}>
                      {v === "kgs" ? "Kgs" : v === "value" ? "Value (₹)" : "Both"}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Card><CardContent className="p-0">
              {loading ? <TableSkeleton /> : (
                <div ref={ageingRef} className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b">
                        <th className="text-left font-medium text-xs uppercase tracking-wider px-3 py-2.5 min-w-[220px] bg-muted/60">Category</th>
                        <th className="text-right font-medium text-xs uppercase tracking-wider px-3 py-2.5 w-[110px] bg-green-50 dark:bg-green-950/30">&lt; 6M</th>
                        <th className="text-right font-medium text-xs uppercase tracking-wider px-3 py-2.5 w-[110px] bg-lime-50 dark:bg-lime-950/30">6-12M</th>
                        <th className="text-right font-medium text-xs uppercase tracking-wider px-3 py-2.5 w-[110px] bg-yellow-50 dark:bg-yellow-950/30">12-18M</th>
                        <th className="text-right font-medium text-xs uppercase tracking-wider px-3 py-2.5 w-[110px] bg-orange-50 dark:bg-orange-950/30">18-24M</th>
                        <th className="text-right font-medium text-xs uppercase tracking-wider px-3 py-2.5 w-[110px] bg-red-50 dark:bg-red-950/30">&gt; 24M</th>
                        <th className="text-right font-medium text-xs uppercase tracking-wider px-3 py-2.5 w-[120px] bg-muted/60">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ageingPivot.map(wh => {
                        const whKey = `wh|||${wh.warehouseCode}`
                        const isWhExpanded = expanded.has(whKey)
                        return (
                          <React.Fragment key={whKey}>
                            <tr
                              className="cursor-pointer bg-gradient-to-r from-cyan-900 to-blue-900 text-white hover:from-cyan-800 hover:to-blue-800 transition-colors border-b-2 border-cyan-500/30"
                              onClick={() => toggle(whKey)}
                            >
                              <td className="px-4 py-3 font-bold text-sm">
                                <span className="inline-flex items-center gap-2">
                                  {isWhExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-cyan-300" />
                                    {wh.warehouseLabel}
                                  </span>
                                  <span className="text-xs font-normal text-cyan-200 ml-2">
                                    {wh.categories.length} {wh.categories.length === 1 ? "category" : "categories"}
                                  </span>
                                </span>
                              </td>
                              <AgeingCells d={wh} view={ageingView} />
                            </tr>
                            {isWhExpanded && wh.categories.map(l1 => (
                              <AgeL1 key={`${wh.warehouseCode}|||${l1.group_name}`} l1={l1} view={ageingView} ex={expanded} toggle={toggle} l3t={handleL3Toggle} lc={lotCache} ll={lotLoading} />
                            ))}
                          </React.Fragment>
                        )
                      })}
                      {ageingData && (
                        <tr className="border-t-2 border-slate-300 bg-[#0f172a] text-white font-bold sticky bottom-0">
                          <td className="px-3 py-2.5">Grand Total</td>
                          <AgeBrkCell kgs={ageingData.grand_total.kgs_0_6} val={ageingData.grand_total.val_0_6} view={ageingView} />
                          <AgeBrkCell kgs={ageingData.grand_total.kgs_6_12} val={ageingData.grand_total.val_6_12} view={ageingView} />
                          <AgeBrkCell kgs={ageingData.grand_total.kgs_12_18} val={ageingData.grand_total.val_12_18} view={ageingView} />
                          <AgeBrkCell kgs={ageingData.grand_total.kgs_18_24} val={ageingData.grand_total.val_18_24} view={ageingView} cls="bg-amber-900/30" />
                          <AgeBrkCell kgs={ageingData.grand_total.kgs_24_plus} val={ageingData.grand_total.val_24_plus} view={ageingView} cls="bg-red-900/30" />
                          <td className="text-right px-3 py-2.5 tabular-nums">{fmtKgs(ageingData.grand_total.grand_total_kgs)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* ══════ TAB 3: CONCENTRATION, RISK & OPERATIONS ══════ */}
          <TabsContent value="concentration" className="mt-3 space-y-4">
            {/* Anchor menu */}
            <div className="flex gap-1 rounded-lg border p-1 bg-muted/30 overflow-x-auto">
              {[{id:"s1",label:"Portfolio"},{id:"s2",label:"Attention & Risk"},{id:"s3",label:"Slow & Non-Moving"},{id:"s4",label:"Activity Rundown"}].map(s => (
                <button key={s.id} onClick={() => { setActiveSection(s.id); document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" }) }}
                  className={cn("text-xs px-3 py-1.5 rounded-md transition-colors whitespace-nowrap", activeSection === s.id ? "bg-[#0f172a] text-white" : "hover:bg-slate-100")}>{s.label}</button>
              ))}
            </div>

            {loading ? <TableSkeleton /> : (<>

            {/* ── §1 PORTFOLIO CONCENTRATION ── */}
            <div id="s1" className="space-y-4">
              {concentrationData && (<>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <KPICard label="Total Portfolio Value" value={fmtCr(concentrationData.portfolio.total_value)} />
                  <KPICard label="Blended Avg Rate" value={fmtRate(concentrationData.portfolio.avg_rate) + "/Kg"} />
                  <KPICard label="Top 3 Sub-Groups" value={concentrationData.portfolio.top3_pct + "% of Value"} accent={concentrationData.portfolio.top3_pct > 30} />
                  <KPICard label="Aged Stock (18M+)" value={`${fmtLakh(concentrationData.portfolio.aged_18plus_value)} (${concentrationData.portfolio.aged_18plus_pct}%)`} />
                </div>
                {concentrationData.alerts.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                    <p className="text-sm font-medium text-red-800 dark:text-red-300 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />High Concentration Alert</p>
                    {concentrationData.alerts.map(a => <p key={a.rank} className="text-xs text-red-700 dark:text-red-400 mt-1">{a.item_subgroup} ({a.group_name}) holds {a.portfolio_pct}% — {fmtCr(a.total_value)}</p>)}
                  </div>
                )}
                <Card><CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-3">Top Sub-Groups by Value</h3>
                  <div ref={concRef} className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={concentrationData.items.slice(0, 10)} layout="vertical" margin={{ left: 120, right: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={v => fmtCr(v)} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="item_subgroup" width={120} tick={{ fontSize: 11 }} />
                        <ReTooltip formatter={(v: number, _: any, p: any) => [`${fmtCr(v)} · ${p.payload.portfolio_pct}% · ${p.payload.lot_count} lots`, ""]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Bar dataKey="total_value" radius={[0, 4, 4, 0]}>
                          {concentrationData.items.slice(0, 10).map((it, i) => <Cell key={i} fill={it.portfolio_pct > 10 ? "#ef4444" : it.portfolio_pct > 5 ? "#f59e0b" : "#14b8a6"} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent></Card>
                <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead className="sticky top-0 z-10"><tr className="border-b bg-muted/60">
                    <th className="text-left text-xs uppercase tracking-wider font-medium px-3 py-2.5 w-[40px]">#</th>
                    <th className="text-left text-xs uppercase tracking-wider font-medium px-3 py-2.5">Group</th>
                    <th className="text-left text-xs uppercase tracking-wider font-medium px-3 py-2.5">Sub-Group</th>
                    <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2.5">Kgs</th>
                    <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2.5">Value</th>
                    <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2.5">%</th>
                    <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2.5">Rate</th>
                    <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2.5">Lots</th>
                    <th className="text-center text-xs uppercase tracking-wider font-medium px-3 py-2.5">Frag.</th>
                  </tr></thead>
                  <tbody>{concentrationData.items.map(it => (
                    <tr key={it.rank} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-3 py-2 text-muted-foreground">{it.rank}</td>
                      <td className="px-3 py-2">{it.group_name}</td>
                      <td className="px-3 py-2 font-medium">{it.item_subgroup}</td>
                      <td className="text-right px-3 py-2 tabular-nums">{fmtKgs(it.total_kgs)}</td>
                      <td className="text-right px-3 py-2 tabular-nums">{fmtVal(it.total_value)}</td>
                      <td className="text-right px-3 py-2"><span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", it.portfolio_pct > 10 ? "bg-red-100 text-red-800" : it.portfolio_pct > 5 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700")}>{it.portfolio_pct}%</span></td>
                      <td className="text-right px-3 py-2 tabular-nums">{fmtRate(it.avg_rate)}</td>
                      <td className="text-right px-3 py-2 tabular-nums">{it.lot_count}</td>
                      <td className="text-center px-3 py-2"><span className={cn("text-xs", it.fragmentation === "high" ? "text-red-600" : it.fragmentation === "medium" ? "text-amber-600" : "text-emerald-600")}>{it.fragmentation === "high" ? `🔴 ${it.lot_count}` : it.fragmentation === "medium" ? "🟡" : "🟢"}</span></td>
                    </tr>
                  ))}</tbody>
                </table></div></CardContent></Card>
              </>)}
            </div>

            {/* ── §2 ATTENTION & RISK ── */}
            <div id="s2" className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" />Attention & Risk Flags</h3>
              {attentionData && (<>
                {/* Summary chips */}
                <div className="flex flex-wrap gap-2">
                  {[{key:"bracket_crossing",label:"Bracket Crossing",icon:"🔴"},{key:"stale_lot",label:"Stale Lots",icon:"🟠"},{key:"rate_anomaly",label:"Rate Anomaly",icon:"🟡"}].map(f => {
                    const cnt = attentionData.summary[f.key] || 0
                    return <button key={f.key} onClick={() => setAttentionFilter(attentionFilter === f.key ? null : f.key)}
                      className={cn("text-xs px-3 py-1.5 rounded-full border transition-colors", attentionFilter === f.key ? "bg-[#0f172a] text-white" : cnt > 0 ? "hover:bg-slate-100" : "opacity-50")}>
                      {f.icon} {f.label}: {cnt}
                    </button>
                  })}
                  {attentionFilter && <button onClick={() => setAttentionFilter(null)} className="text-xs text-red-600 flex items-center gap-1"><X className="h-3 w-3" />Clear</button>}
                </div>
                {/* Attention cards */}
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {attentionData.flags
                    .filter(f => !attentionFilter || f.flag_type === attentionFilter)
                    .slice(0, 50)
                    .map((f, i) => {
                      const sevCls = f.severity === "critical" ? "border-l-red-500 bg-red-50/50 dark:bg-red-950/20" : f.severity === "warning" ? "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20" : "border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                      const sevIcon = f.severity === "critical" ? "🔴" : f.severity === "warning" ? "🟠" : "🟡"
                      return (
                        <Card key={`${f.lot_no}-${f.flag_type}-${i}`} className={cn("border-l-4 overflow-hidden", sevCls)}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{sevIcon} {f.flag_type.replace("_", " ")}</p>
                                <p className="text-sm font-medium mt-0.5">Lot: {f.lot_no} &middot; {f.item_mark} &middot; {getNormalizedWarehouseLabel(f.storage_location)} &middot; {f.group_name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Inward: {f.inward_dt || "—"} &middot; {fmtKgs(f.total_kgs)} Kgs &middot; {fmtVal(f.total_value)} &middot; {fmtRate(f.rate)}/Kg
                                  {f.ageing_days !== null && <> &middot; {f.ageing_days}d old</>}
                                </p>
                                <p className="text-xs font-medium mt-1 text-foreground/80">{f.message}</p>
                                {f.flag_type === "bracket_crossing" && f.days_to_cross && (
                                  <p className="text-xs text-red-600 mt-0.5">Crosses to {f.next_bracket} in {f.days_to_cross} days — prioritise dispatch</p>
                                )}
                                {f.flag_type === "rate_anomaly" && f.deviation_pct && (
                                  <p className="text-xs text-amber-600 mt-0.5">Sub-group avg: {fmtRate(f.subgroup_avg_rate || 0)}/Kg — deviation: {f.deviation_pct > 0 ? "+" : ""}{f.deviation_pct}%</p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  {attentionData.flags.filter(f => !attentionFilter || f.flag_type === attentionFilter).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">No attention flags for current filters</p>
                  )}
                </div>
              </>)}
            </div>

            {/* ── §3 SLOW & NON-MOVING TRACKER ── */}
            <div id="s3" className="space-y-3">
              <h3 className="text-sm font-semibold">Slow & Non-Moving Tracker</h3>
              {slowMovingData && (<>
                <div className="flex flex-wrap gap-2">
                  {([
                    {key:"active",label:"Active",icon:"🟢"},{key:"slow_moving",label:"Slow Moving",icon:"🟡"},
                    {key:"non_moving",label:"Non-Moving",icon:"🔴"},{key:"dead_stock",label:"Dead Stock",icon:"⚫"}
                  ] as const).map(s => (
                    <button key={s.key} onClick={() => setSlowFilter(slowFilter === s.key ? null : s.key)}
                      className={cn("text-xs px-3 py-1.5 rounded-full border transition-colors", slowFilter === s.key ? "bg-[#0f172a] text-white" : "hover:bg-slate-100")}>
                      {s.icon} {s.label}: {fmtKgs(slowMovingData.kgs_totals[s.key])} Kgs ({slowMovingData.pct_totals[s.key]}%)
                    </button>
                  ))}
                  {slowFilter && <button onClick={() => setSlowFilter(null)} className="text-xs text-red-600 flex items-center gap-1"><X className="h-3 w-3" />Clear</button>}
                </div>
                <Card><CardContent className="p-0"><div className="overflow-x-auto max-h-[400px] overflow-y-auto"><table className="w-full text-xs">
                  <thead className="sticky top-0 z-10"><tr className="border-b bg-muted/60">
                    <th className="text-left px-3 py-2 font-medium uppercase tracking-wider">Status</th>
                    <th className="text-left px-3 py-2 font-medium uppercase tracking-wider">Location</th>
                    <th className="text-left px-3 py-2 font-medium uppercase tracking-wider">Group</th>
                    <th className="text-left px-3 py-2 font-medium uppercase tracking-wider">Item Mark</th>
                    <th className="text-left px-3 py-2 font-medium uppercase tracking-wider">Lot</th>
                    <th className="text-right px-3 py-2 font-medium uppercase tracking-wider">Kgs</th>
                    <th className="text-right px-3 py-2 font-medium uppercase tracking-wider">Value</th>
                    <th className="text-left px-3 py-2 font-medium uppercase tracking-wider">Ageing</th>
                    <th className="text-right px-3 py-2 font-medium uppercase tracking-wider">Days</th>
                  </tr></thead>
                  <tbody>{slowMovingData.items
                    .filter(it => !slowFilter || it.movement_status === slowFilter)
                    .map((it, i) => {
                      const stCls = it.movement_status === "dead_stock" ? "text-slate-900 font-bold" : it.movement_status === "non_moving" ? "text-red-600" : it.movement_status === "slow_moving" ? "text-amber-600" : "text-emerald-600"
                      const stIcon = it.movement_status === "dead_stock" ? "⚫" : it.movement_status === "non_moving" ? "🔴" : it.movement_status === "slow_moving" ? "🟡" : "🟢"
                      return (
                        <tr key={`${it.lot_no}-${i}`} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className={cn("px-3 py-1.5", stCls)}>{stIcon} {it.movement_status.replace("_", " ")}</td>
                          <td className="px-3 py-1.5">{getNormalizedWarehouseLabel(it.storage_location)}</td>
                          <td className="px-3 py-1.5">{it.group_name}</td>
                          <td className="px-3 py-1.5 font-medium">{it.item_mark}</td>
                          <td className="px-3 py-1.5">{it.lot_no}</td>
                          <td className="text-right px-3 py-1.5 tabular-nums">{fmtKgs(it.total_kgs)}</td>
                          <td className="text-right px-3 py-1.5 tabular-nums">{fmtVal(it.total_value)}</td>
                          <td className="px-3 py-1.5">{it.ageing_bracket}</td>
                          <td className="text-right px-3 py-1.5 tabular-nums">{it.ageing_days}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table></div></CardContent></Card>
              </>)}
            </div>

            {/* ── §4 ACTIVITY RUNDOWN ── */}
            <div id="s4" className="space-y-4">
              <h3 className="text-sm font-semibold">Activity Rundown</h3>
              {rundownData && (<>
                {/* §4A Location wise */}
                <Card><CardContent className="p-0"><div className="overflow-x-auto">
                  <div className="px-4 py-2 border-b bg-muted/30"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location Wise</p></div>
                  <table className="w-full text-sm"><thead><tr className="border-b bg-muted/20">
                    <th className="text-left px-3 py-2 text-xs font-medium">Location</th>
                    <th className="text-right px-3 py-2 text-xs font-medium">Total Kgs</th>
                    <th className="text-right px-3 py-2 text-xs font-medium">Value</th>
                    <th className="text-right px-3 py-2 text-xs font-medium">Lots</th>
                    <th className="text-right px-3 py-2 text-xs font-medium">Groups</th>
                  </tr></thead><tbody>{rundownData.locations.map((l, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50"><td className="px-3 py-2 font-medium">{getNormalizedWarehouseLabel(l.location)}</td>
                    <td className="text-right px-3 py-2 tabular-nums">{fmtKgs(l.total_kgs)}</td>
                    <td className="text-right px-3 py-2 tabular-nums">{fmtVal(l.total_value)}</td>
                    <td className="text-right px-3 py-2 tabular-nums">{l.lot_count}</td>
                    <td className="text-right px-3 py-2 tabular-nums">{l.group_count}</td></tr>
                  ))}</tbody></table>
                </div></CardContent></Card>

                {/* §4B Company wise */}
                {rundownData.company_breakdown.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {rundownData.company_breakdown.map((c, i) => (
                      <Card key={i}><CardContent className="p-4">
                        <h4 className="text-sm font-bold">{c.company}</h4>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                          <div><span className="text-muted-foreground">Stock:</span> <span className="font-medium">{fmtKgs(c.total_kgs)} Kgs</span></div>
                          <div><span className="text-muted-foreground">Value:</span> <span className="font-medium">{fmtCr(c.total_value)}</span></div>
                          <div><span className="text-muted-foreground">Avg Rate:</span> <span className="font-medium">{fmtRate(c.avg_rate)}/Kg</span></div>
                          <div><span className="text-muted-foreground">Lots:</span> <span className="font-medium">{c.lot_count} &middot; {c.location_count} locations</span></div>
                        </div>
                      </CardContent></Card>
                    ))}
                  </div>
                )}

                {/* §4D Exporter wise */}
                <Card><CardContent className="p-0"><div className="overflow-x-auto">
                  <div className="px-4 py-2 border-b bg-muted/30"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Exporter / Vendor Wise</p></div>
                  <table className="w-full text-sm"><thead><tr className="border-b bg-muted/20">
                    <th className="text-left px-3 py-2 text-xs font-medium">Exporter</th>
                    <th className="text-right px-3 py-2 text-xs font-medium">Lots</th>
                    <th className="text-right px-3 py-2 text-xs font-medium">Total Kgs</th>
                    <th className="text-right px-3 py-2 text-xs font-medium">Value</th>
                    <th className="text-right px-3 py-2 text-xs font-medium">Avg Rate</th>
                    <th className="text-left px-3 py-2 text-xs font-medium">Last Inward</th>
                  </tr></thead><tbody>{rundownData.exporters.map((e, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium">{e.exporter}</td>
                    <td className="text-right px-3 py-2 tabular-nums">{e.lot_count}</td>
                    <td className="text-right px-3 py-2 tabular-nums">{fmtKgs(e.total_kgs)}</td>
                    <td className="text-right px-3 py-2 tabular-nums">{fmtVal(e.total_value)}</td>
                    <td className="text-right px-3 py-2 tabular-nums">{fmtRate(e.avg_rate)}/Kg</td>
                    <td className="px-3 py-2 text-muted-foreground">{e.last_inward || "—"}</td></tr>
                  ))}</tbody></table>
                </div></CardContent></Card>
              </>)}
            </div>

            </>)}
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  )
}

// ═══════════════════════════════════════════════════════════════════
// STOCK SUMMARY ROWS
// ═══════════════════════════════════════════════════════════════════

interface SProps { l1: StockLayer1; ex: Set<string>; toggle: (k: string) => void; l3t: (a: string, b: string, c: string, d: string) => void; lc: Record<string, LotDetailsResponse>; ll: Set<string> }

function StockL1({ l1, ex, toggle, l3t, lc, ll }: SProps) {
  const k = makeKey(l1.storage_location, l1.group_name); const open = ex.has(k)
  return (<>
    <tr className={cn("border-b cursor-pointer transition-colors hover:opacity-90", L_BG[0])} onClick={() => toggle(k)}>
      <td className={cn("px-3 py-2.5", L_PL[0])}>
        <span className="inline-flex items-center gap-1.5">{open ? <ChevronDown className="h-4 w-4 text-teal-400" /> : <ChevronRight className="h-4 w-4 text-teal-400" />}{l1.storage_location} — {l1.group_name}</span>
      </td>
      <td className="text-right px-3 py-2.5 tabular-nums">{fmtKgs(l1.total_kgs)}</td>
      <td className="text-right px-3 py-2.5 tabular-nums">{fmtVal(l1.total_value)}</td>
      <td className="text-right px-3 py-2.5 tabular-nums">{fmtRate(l1.avg_rate)}</td>
      <td className="text-right px-3 py-2.5 tabular-nums">{l1.lot_count}</td>
    </tr>
    {open && l1.children.map(l2 => <StockL2 key={makeKey(l1.storage_location, l1.group_name, l2.item_subgroup)} l1={l1} l2={l2} ex={ex} toggle={toggle} l3t={l3t} lc={lc} ll={ll} />)}
  </>)
}

function StockL2({ l1, l2, ex, toggle, l3t, lc, ll }: SProps & { l2: StockLayer2 }) {
  // Skip Layer 3 if sub-group has only 1 child with same name or "No Mark"
  const canSkip = l2.children.length === 1 && (
    l2.children[0].item_mark === l2.item_subgroup ||
    l2.children[0].item_mark === "No Mark" ||
    l2.children[0].item_mark.toLowerCase() === l2.item_subgroup.toLowerCase()
  )

  if (canSkip) {
    // Merged row: L2 styling but clicking loads L4 lots directly
    const l3 = l2.children[0]
    const k = makeKey(l1.storage_location, l1.group_name, l2.item_subgroup, l3.item_mark); const open = ex.has(k)
    const lots = lc[k]?.lots; const isLd = ll.has(k)
    const ap = l3.age_profile; const total = (ap?.age_0_6 || 0) + (ap?.age_6_12 || 0) + (ap?.age_12_18 || 0) + (ap?.age_18_24 || 0) + (ap?.age_24_plus || 0)
    return (<>
      <tr className={cn("border-b cursor-pointer transition-colors hover:bg-slate-200/50 dark:hover:bg-slate-700/50", L_BG[1])}
        onClick={() => l3t(l1.storage_location, l1.group_name, l2.item_subgroup, l3.item_mark)}>
        <td className={cn("px-3 py-2", L_PL[1])}>
          <span className="inline-flex items-center gap-1.5">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {l2.item_subgroup}
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 font-normal">direct</span>
          </span>
          {total > 0 && (
            <div className="flex h-[6px] rounded-full overflow-hidden mt-1 w-full max-w-[200px]" title={`<6M: ${fmtKgs(ap.age_0_6)} | 6-12M: ${fmtKgs(ap.age_6_12)} | 12-18M: ${fmtKgs(ap.age_12_18)} | 18-24M: ${fmtKgs(ap.age_18_24)} | >24M: ${fmtKgs(ap.age_24_plus)}`}>
              {ap.age_0_6 > 0 && <div style={{ width: `${(ap.age_0_6 / total) * 100}%` }} className="bg-emerald-500" />}
              {ap.age_6_12 > 0 && <div style={{ width: `${(ap.age_6_12 / total) * 100}%` }} className="bg-lime-500" />}
              {ap.age_12_18 > 0 && <div style={{ width: `${(ap.age_12_18 / total) * 100}%` }} className="bg-amber-400" />}
              {ap.age_18_24 > 0 && <div style={{ width: `${(ap.age_18_24 / total) * 100}%` }} className="bg-orange-500" />}
              {ap.age_24_plus > 0 && <div style={{ width: `${(ap.age_24_plus / total) * 100}%` }} className="bg-red-500" />}
            </div>
          )}
        </td>
        <td className="text-right px-3 py-2 tabular-nums">{fmtKgs(l2.total_kgs)}</td>
        <td className="text-right px-3 py-2 tabular-nums">{fmtVal(l2.total_value)}</td>
        <td className="text-right px-3 py-2 tabular-nums">{fmtRate(l2.avg_rate)}</td>
        <td className="text-right px-3 py-2 tabular-nums">{l2.lot_count}</td>
      </tr>
      {open && (isLd ? (
        <tr className={L_BG[3]}><td colSpan={5} className={cn("px-3 py-3", L_PL[3])}><div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading lots...</div></td></tr>
      ) : lots?.map((lot, i) => <StockLotRow key={`${lot.lot_no}-${i}`} lot={lot} avgRate={lc[k]?.subgroup_avg_rate || 0} />))}
    </>)
  }

  // Normal L2 → L3 → L4 flow
  const k = makeKey(l1.storage_location, l1.group_name, l2.item_subgroup); const open = ex.has(k)
  return (<>
    <tr className={cn("border-b cursor-pointer transition-colors hover:bg-slate-200/50 dark:hover:bg-slate-700/50", L_BG[1])} onClick={() => toggle(k)}>
      <td className={cn("px-3 py-2", L_PL[1])}>
        <span className="inline-flex items-center gap-1.5">{open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}{l2.item_subgroup}</span>
      </td>
      <td className="text-right px-3 py-2 tabular-nums">{fmtKgs(l2.total_kgs)}</td>
      <td className="text-right px-3 py-2 tabular-nums">{fmtVal(l2.total_value)}</td>
      <td className="text-right px-3 py-2 tabular-nums">{fmtRate(l2.avg_rate)}</td>
      <td className="text-right px-3 py-2 tabular-nums">{l2.lot_count}</td>
    </tr>
    {open && l2.children.map(l3 => <StockL3 key={makeKey(l1.storage_location, l1.group_name, l2.item_subgroup, l3.item_mark)} l1={l1} l2={l2} l3={l3} ex={ex} l3t={l3t} lc={lc} ll={ll} />)}
  </>)
}

function StockL3({ l1, l2, l3, ex, l3t, lc, ll }: { l1: StockLayer1; l2: StockLayer2; l3: StockLayer3; ex: Set<string>; l3t: (a: string, b: string, c: string, d: string) => void; lc: Record<string, LotDetailsResponse>; ll: Set<string> }) {
  const k = makeKey(l1.storage_location, l1.group_name, l2.item_subgroup, l3.item_mark); const open = ex.has(k)
  const lots = lc[k]?.lots; const isLd = ll.has(k)
  const ap = l3.age_profile; const total = (ap?.age_0_6 || 0) + (ap?.age_6_12 || 0) + (ap?.age_12_18 || 0) + (ap?.age_18_24 || 0) + (ap?.age_24_plus || 0)
  return (<>
    <tr className={cn("border-b cursor-pointer transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-800/60", L_BG[2])} onClick={() => l3t(l1.storage_location, l1.group_name, l2.item_subgroup, l3.item_mark)}>
      <td className={cn("px-3 py-2", L_PL[2])}>
        <span className="inline-flex items-center gap-1.5">{open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}{l3.item_mark}</span>
        {/* Age Profile Bar */}
        {total > 0 && (
          <div className="flex h-[6px] rounded-full overflow-hidden mt-1 w-full max-w-[200px]" title={`<6M: ${fmtKgs(ap.age_0_6)} | 6-12M: ${fmtKgs(ap.age_6_12)} | 12-18M: ${fmtKgs(ap.age_12_18)} | 18-24M: ${fmtKgs(ap.age_18_24)} | >24M: ${fmtKgs(ap.age_24_plus)}`}>
            {ap.age_0_6 > 0 && <div style={{ width: `${(ap.age_0_6 / total) * 100}%` }} className="bg-emerald-500" />}
            {ap.age_6_12 > 0 && <div style={{ width: `${(ap.age_6_12 / total) * 100}%` }} className="bg-lime-500" />}
            {ap.age_12_18 > 0 && <div style={{ width: `${(ap.age_12_18 / total) * 100}%` }} className="bg-amber-400" />}
            {ap.age_18_24 > 0 && <div style={{ width: `${(ap.age_18_24 / total) * 100}%` }} className="bg-orange-500" />}
            {ap.age_24_plus > 0 && <div style={{ width: `${(ap.age_24_plus / total) * 100}%` }} className="bg-red-500" />}
          </div>
        )}
      </td>
      <td className="text-right px-3 py-2 tabular-nums">{fmtKgs(l3.total_kgs)}</td>
      <td className="text-right px-3 py-2 tabular-nums">{fmtVal(l3.total_value)}</td>
      <td className="text-right px-3 py-2 tabular-nums">{fmtRate(l3.avg_rate)}</td>
      <td className="text-right px-3 py-2 tabular-nums">{l3.lot_count}</td>
    </tr>
    {open && (isLd ? (
      <tr className={L_BG[3]}><td colSpan={5} className={cn("px-3 py-3", L_PL[3])}><div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading lots...</div></td></tr>
    ) : lots?.map((lot, i) => <StockLotRow key={`${lot.lot_no}-${i}`} lot={lot} avgRate={lc[k]?.subgroup_avg_rate || 0} />))}
  </>)
}

// ── Lot hover popup content ────────────────────────────────────────
function LotHoverContent({ lot, company }: { lot: LotDetail; company: string }) {
  const redirectHref = getLotRedirectHref(company, lot.inward_no)
  const ageColor =
    lot.ageing_bracket === "> 24 Months" ? "bg-red-50 text-red-700 border-red-200" :
    lot.ageing_bracket === "18-24 Months" ? "bg-amber-50 text-amber-700 border-amber-200" :
    lot.ageing_bracket === "12-18 Months" ? "bg-amber-50 text-amber-700 border-amber-200" :
    "bg-emerald-50 text-emerald-700 border-emerald-200"
  const devColor =
    lot.deviation_level === "anomaly" ? "text-red-600" :
    lot.deviation_level === "review" ? "text-amber-600" :
    "text-emerald-600"

  return (
    <div className="divide-y">
      <div className="px-4 py-3 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Lot {lot.lot_no}</p>
          {lot.ageing_bracket && (
            <Badge variant="outline" className={cn("text-[10px]", ageColor)}>
              {lot.ageing_days ?? "—"}d · {lot.ageing_bracket}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {lot.item_description || "—"}
        </p>
      </div>

      <div className="px-4 py-3 text-xs space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {lot.inward_dt && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Inward Date</p>
              <p className="font-medium">{format(new Date(lot.inward_dt), "dd MMM yyyy")}</p>
            </div>
          )}
          {lot.inward_no && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">GRN / Txn</p>
              <p className="font-medium font-mono text-[11px] truncate">{lot.inward_no}</p>
            </div>
          )}
          {lot.unit && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Location</p>
              <p className="font-medium">{lot.unit}</p>
            </div>
          )}
          {lot.vakkal && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Vakkal</p>
              <p className="font-medium truncate">{lot.vakkal}</p>
            </div>
          )}
          {lot.exporter && (
            <div className="col-span-2">
              <p className="text-[10px] text-muted-foreground uppercase">Exporter</p>
              <p className="font-medium truncate">{lot.exporter}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Cartons</p>
            <p className="font-semibold">{lot.no_of_cartons.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Boxes</p>
            <p className="font-semibold">{lot.box_count.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Per-Carton Wt</p>
            <p className="font-semibold">{lot.weight_kg} kg</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Total Weight</p>
            <p className="font-semibold">{lot.total_kgs.toLocaleString()} kg</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Rate</p>
            <p className="font-semibold">₹{lot.last_purchase_rate.toLocaleString(undefined, { maximumFractionDigits: 2 })}/kg</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Value</p>
            <p className="font-semibold">₹{lot.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
          {lot.avg_rate > 0 && (
            <div className={cn("col-span-2 text-[11px]", devColor)}>
              <span className="text-muted-foreground">Subgroup avg: </span>
              <span className="font-medium">₹{lot.avg_rate.toFixed(2)}/kg</span>
              {lot.deviation_pct !== 0 && (
                <span className="ml-1">
                  ({lot.deviation_pct > 0 ? "+" : ""}{lot.deviation_pct.toFixed(1)}%)
                </span>
              )}
            </div>
          )}
        </div>

        {lot.spl_remarks && (
          <div className="pt-2 border-t">
            <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Remarks</p>
            <p className="text-[11px] italic">{lot.spl_remarks}</p>
          </div>
        )}
      </div>

      {redirectHref && (
        <div className="px-4 py-2 bg-muted/20">
          <Button asChild size="sm" variant="outline" className="w-full h-8 text-xs gap-1.5">
            <Link href={redirectHref}>
              Open Transaction
              <ChevronRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}

function StockLotRow({ lot, avgRate }: { lot: LotDetail; avgRate: number }) {
  const params = useParams()
  const company = params?.company as string
  const devCls = lot.deviation_level === "anomaly" ? "bg-[#fee2e2] text-[#991b1b]" : lot.deviation_level === "review" ? "bg-[#fef3c7] text-[#92400e]" : "bg-[#dcfce7] text-[#166534]"
  const devIcon = lot.deviation_level === "normal" ? "●" : lot.deviation_pct > 0 ? "▲" : "▼"
  const ageBadge = lot.ageing_bracket === "> 24 Months" ? "bg-[#fee2e2] text-[#991b1b]" : lot.ageing_bracket === "18-24 Months" ? "bg-[#fef3c7] text-[#92400e]" : "bg-muted text-muted-foreground"
  return (
    <Popover>
      <PopoverTrigger asChild>
        <tr
          className={cn(
            "border-b text-xs cursor-pointer transition-colors",
            L_BG[3],
            "hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
          )}
        >
          <td className={cn("px-3 py-2", L_PL[3])}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span className="font-medium text-foreground">Lot {lot.lot_no}</span>
              {lot.inward_dt && <span className="text-muted-foreground">{format(new Date(lot.inward_dt), "dd MMM yyyy")}</span>}
              {lot.inward_no && <span className="text-muted-foreground">GRN: {lot.inward_no}</span>}
              {lot.box_count > 1 && <span className="text-blue-600 dark:text-blue-400 font-medium">{lot.box_count} boxes</span>}
              {lot.no_of_cartons > 0 && <span className="text-muted-foreground">{lot.no_of_cartons} ctns &times; {lot.weight_kg} Kg</span>}
              {lot.ageing_days !== null && (
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", ageBadge)}>
                  {lot.ageing_days}d &middot; {lot.ageing_bracket}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
              {lot.item_description && <span className="text-muted-foreground">{lot.item_description}</span>}
              {lot.exporter && <span className="text-muted-foreground">Exp: {lot.exporter}</span>}
              {lot.spl_remarks && <span className="text-muted-foreground italic">{lot.spl_remarks}</span>}
            </div>
          </td>
          <td className="text-right px-3 py-2 tabular-nums">{fmtKgs(lot.total_kgs)}</td>
          <td className="text-right px-3 py-2 tabular-nums">{fmtVal(lot.value)}</td>
          <td className="text-right px-3 py-2">
            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums", devCls)}>
              {fmtRate(lot.last_purchase_rate)} {devIcon}{lot.deviation_pct > 0 ? "+" : ""}{lot.deviation_pct}%
            </span>
          </td>
          <td />
        </tr>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-2rem)] sm:w-96 max-w-[24rem] p-0 max-h-[80vh] overflow-y-auto"
        align="center"
        side="top"
        sideOffset={8}
        collisionPadding={16}
      >
        <LotHoverContent lot={lot} company={company} />
      </PopoverContent>
    </Popover>
  )
}

// ═══════════════════════════════════════════════════════════════════
// AGEING SUMMARY ROWS
// ═══════════════════════════════════════════════════════════════════

type AView = "kgs" | "value" | "both"
interface AProps { l1: AgeingLayer1; view: AView; ex: Set<string>; toggle: (k: string) => void; l3t: (a: string, b: string, c: string, d: string) => void; lc: Record<string, LotDetailsResponse>; ll: Set<string> }

function AgeBrkCell({ kgs, val, view, cls, amber, red }: { kgs: number; val: number; view: AView; cls?: string; amber?: boolean; red?: boolean }) {
  const highlight = (amber && kgs > 0) ? "bg-[#fef3c7] text-[#92400e] font-medium" : (red && kgs > 0) ? "bg-[#fee2e2] text-[#991b1b] font-medium" : ""
  return (
    <td className={cn("text-right px-3 py-2 tabular-nums", cls, highlight)}>
      {view === "kgs" && fmtBrk(kgs)}
      {view === "value" && (val ? fmtVal(val) : "")}
      {view === "both" && (kgs || val ? <><div>{fmtBrk(kgs)}{kgs ? <span className="text-[10px] text-muted-foreground ml-0.5">Kgs</span> : ""}</div>{val > 0 && <div className="text-[10px] text-muted-foreground">{fmtVal(val)}</div>}</> : "")}
    </td>
  )
}

function AgeingCells({ d, view }: { d: any; view: AView }) {
  return (<>
    <AgeBrkCell kgs={d.kgs_0_6} val={d.val_0_6} view={view} />
    <AgeBrkCell kgs={d.kgs_6_12} val={d.val_6_12} view={view} />
    <AgeBrkCell kgs={d.kgs_12_18} val={d.val_12_18} view={view} />
    <AgeBrkCell kgs={d.kgs_18_24} val={d.val_18_24} view={view} amber />
    <AgeBrkCell kgs={d.kgs_24_plus} val={d.val_24_plus} view={view} red />
    <td className="text-right px-3 py-2 font-medium tabular-nums">{fmtKgs(d.grand_total_kgs)}</td>
  </>)
}

function AgeL1({ l1, view, ex, toggle, l3t, lc, ll }: AProps) {
  const k = makeKey(l1.storage_location, l1.group_name); const open = ex.has(k)
  return (<>
    <tr className={cn("border-b cursor-pointer hover:opacity-90 transition-colors", L_BG[0])} onClick={() => toggle(k)}>
      <td className={cn("px-3 py-2.5", L_PL[0])}>
        <span className="inline-flex items-center gap-1.5">{open ? <ChevronDown className="h-4 w-4 text-teal-400" /> : <ChevronRight className="h-4 w-4 text-teal-400" />}{l1.storage_location} — {l1.group_name}</span>
      </td>
      <AgeingCells d={l1} view={view} />
    </tr>
    {open && l1.children.map(l2 => <AgeL2 key={makeKey(l1.storage_location, l1.group_name, l2.item_subgroup)} l1={l1} l2={l2} view={view} ex={ex} toggle={toggle} l3t={l3t} lc={lc} ll={ll} />)}
  </>)
}

function AgeL2({ l1, l2, view, ex, toggle, l3t, lc, ll }: AProps & { l2: AgeingLayer2 }) {
  // Skip Layer 3 if sub-group has only 1 child with same name or "No Mark"
  const canSkip = l2.children.length === 1 && (
    l2.children[0].item_mark === l2.item_subgroup ||
    l2.children[0].item_mark === "No Mark" ||
    l2.children[0].item_mark.toLowerCase() === l2.item_subgroup.toLowerCase()
  )

  if (canSkip) {
    const l3 = l2.children[0]
    const k = makeKey(l1.storage_location, l1.group_name, l2.item_subgroup, l3.item_mark); const open = ex.has(k)
    const lots = lc[k]?.lots; const isLd = ll.has(k)
    return (<>
      <tr className={cn("border-b cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors", L_BG[1])}
        onClick={() => l3t(l1.storage_location, l1.group_name, l2.item_subgroup, l3.item_mark)}>
        <td className={cn("px-3 py-2", L_PL[1])}>
          <span className="inline-flex items-center gap-1.5">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {l2.item_subgroup}
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 font-normal">direct</span>
          </span>
        </td>
        <AgeingCells d={l2} view={view} />
      </tr>
      {open && (isLd ? (
        <tr className={L_BG[3]}><td colSpan={7} className={cn("px-3 py-3", L_PL[3])}><div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading lots...</div></td></tr>
      ) : lots?.map((lot, i) => <AgeLotRow key={`${lot.lot_no}-${i}`} lot={lot} view={view} />))}
    </>)
  }

  const k = makeKey(l1.storage_location, l1.group_name, l2.item_subgroup); const open = ex.has(k)
  return (<>
    <tr className={cn("border-b cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors", L_BG[1])} onClick={() => toggle(k)}>
      <td className={cn("px-3 py-2", L_PL[1])}>
        <span className="inline-flex items-center gap-1.5">{open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}{l2.item_subgroup}</span>
      </td>
      <AgeingCells d={l2} view={view} />
    </tr>
    {open && l2.children.map(l3 => <AgeL3 key={makeKey(l1.storage_location, l1.group_name, l2.item_subgroup, l3.item_mark)} l1={l1} l2={l2} l3={l3} view={view} ex={ex} l3t={l3t} lc={lc} ll={ll} />)}
  </>)
}

function AgeL3({ l1, l2, l3, view, ex, l3t, lc, ll }: { l1: AgeingLayer1; l2: AgeingLayer2; l3: AgeingLayer3; view: AView; ex: Set<string>; l3t: (a: string, b: string, c: string, d: string) => void; lc: Record<string, LotDetailsResponse>; ll: Set<string> }) {
  const k = makeKey(l1.storage_location, l1.group_name, l2.item_subgroup, l3.item_mark); const open = ex.has(k)
  const lots = lc[k]?.lots; const isLd = ll.has(k)
  return (<>
    <tr className={cn("border-b cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors", L_BG[2])} onClick={() => l3t(l1.storage_location, l1.group_name, l2.item_subgroup, l3.item_mark)}>
      <td className={cn("px-3 py-2", L_PL[2])}>
        <span className="inline-flex items-center gap-1.5">{open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}{l3.item_mark}</span>
      </td>
      <AgeingCells d={l3} view={view} />
    </tr>
    {open && (isLd ? (
      <tr className={L_BG[3]}><td colSpan={7} className={cn("px-3 py-3", L_PL[3])}><div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading lots...</div></td></tr>
    ) : lots?.map((lot, i) => <AgeLotRow key={`${lot.lot_no}-${i}`} lot={lot} view={view} />))}
  </>)
}

function AgeLotRow({ lot, view }: { lot: LotDetail; view: AView }) {
  const params = useParams()
  const company = params?.company as string
  const brackets = ["< 6 Months", "6-12 Months", "12-18 Months", "18-24 Months", "> 24 Months"]
  const isAmber = lot.ageing_bracket === "18-24 Months"
  const isRed = lot.ageing_bracket === "> 24 Months"
  const badgeCls = isRed ? "bg-[#fee2e2] text-[#991b1b]" : isAmber ? "bg-[#fef3c7] text-[#92400e]" : "bg-muted text-muted-foreground"
  return (
    <Popover>
      <PopoverTrigger asChild>
        <tr
          className={cn(
            "border-b text-xs cursor-pointer transition-colors",
            L_BG[3],
            "hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
          )}
        >
          <td className={cn("px-3 py-2", L_PL[3])}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-medium text-foreground">Lot {lot.lot_no}</span>
              {lot.inward_dt && <span className="text-muted-foreground">{format(new Date(lot.inward_dt), "dd MMM yyyy")}</span>}
              {lot.inward_no && <span className="text-muted-foreground">GRN: {lot.inward_no}</span>}
              {lot.box_count > 1 && <span className="text-blue-600 dark:text-blue-400 font-medium">{lot.box_count} boxes</span>}
              {lot.no_of_cartons > 0 && <span className="text-muted-foreground">{lot.no_of_cartons} ctns</span>}
              {lot.ageing_days !== null && <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", badgeCls)}>{lot.ageing_days}d &middot; {lot.ageing_bracket}</span>}
            </div>
          </td>
          {brackets.map(b => {
            const match = lot.ageing_bracket === b
            const cellAmber = b === "18-24 Months" && match
            const cellRed = b === "> 24 Months" && match
            return (
              <td key={b} className={cn("text-right px-3 py-1.5 tabular-nums",
                cellAmber && "bg-[#fef3c7] text-[#92400e] font-medium",
                cellRed && "bg-[#fee2e2] text-[#991b1b] font-medium")}>
                {match ? (view === "value" ? fmtVal(lot.value) : fmtKgs(lot.total_kgs)) : ""}
              </td>
            )
          })}
          <td className="text-right px-3 py-1.5 tabular-nums">{fmtKgs(lot.total_kgs)}</td>
        </tr>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-2rem)] sm:w-96 max-w-[24rem] p-0 max-h-[80vh] overflow-y-auto"
        align="center"
        side="top"
        sideOffset={8}
        collisionPadding={16}
      >
        <LotHoverContent lot={lot} company={company} />
      </PopoverContent>
    </Popover>
  )
}

// ═══════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function KPIChip({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 min-w-[140px]">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={cn("text-sm font-semibold tabular-nums", color)}>{value}</p>
      </div>
    </div>
  )
}

function KPICard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className="overflow-hidden"><CardContent className="p-3 min-h-[68px]">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{label}</p>
      <p className={cn("text-sm sm:text-lg font-bold mt-1 tabular-nums break-all leading-tight", accent && "text-amber-600")}>{value}</p>
    </CardContent></Card>
  )
}

function DashboardLegend({ tab }: { tab: "stock" | "ageing" }) {
  return (
    <Card>
      <CardContent className="px-4 py-3">
        <div className="flex flex-col gap-2.5">
          {/* Row hierarchy */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Row Hierarchy</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#0f172a]" /> Layer 1 — Location + Group</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-200 border-l-2 border-l-teal-500" /> Layer 2 — Sub-Group</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-100" /> Layer 3 — Item Mark</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-white border border-slate-200" /> Layer 4 — Lot (consolidated)</span>
            </div>
          </div>

          {tab === "stock" && (
            <>
              {/* Age Profile Bar */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Age Profile Bar (Layer 3)</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500" /> &lt; 6 Months</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-lime-500" /> 6-12 Months</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400" /> 12-18 Months</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-500" /> 18-24 Months</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500" /> &gt; 24 Months</span>
                </div>
              </div>
              {/* Rate Anomaly */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Rate Deviation (Layer 4 — vs Sub-Group Avg)</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#dcfce7]" /> <span className="text-[#166534]">Normal</span> — within &plusmn;15%</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#fef3c7]" /> <span className="text-[#92400e]">Review</span> — &plusmn;15% to &plusmn;50%</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#fee2e2]" /> <span className="text-[#991b1b]">Anomaly</span> — beyond &plusmn;50%</span>
                </div>
              </div>
            </>
          )}

          {tab === "ageing" && (
            <>
              {/* Ageing Bracket Highlights */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Ageing Bracket Highlights</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-50 border border-green-200" /> &lt; 6 Months — Fresh stock</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-lime-50 border border-lime-200" /> 6-12 Months</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-50 border border-yellow-200" /> 12-18 Months</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#fef3c7] border border-amber-300" /> <span className="text-[#92400e] font-medium">18-24 Months</span> — Review needed</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#fee2e2] border border-red-300" /> <span className="text-[#991b1b] font-medium">&gt; 24 Months</span> — High risk</span>
                </div>
              </div>
              {/* View modes */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">View Modes</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span><span className="font-medium text-foreground">Kgs</span> — Quantity in each bracket</span>
                  <span><span className="font-medium text-foreground">Value</span> — Capital locked in each bracket</span>
                  <span><span className="font-medium text-foreground">Both</span> — Kgs on top, Value below (default)</span>
                </div>
              </div>
            </>
          )}

          {/* General notes */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground border-t pt-2">
            <span>Click any row to expand/collapse</span>
            <span>Layer 4 lots sorted FIFO (oldest first)</span>
            <span>Lots consolidated from box entries</span>
            <span>Avg Rate = Total Value / Total Kgs</span>
            <span>Empty bracket cells = no stock in that range</span>
            <span className="inline-flex items-center gap-1"><span className="text-[9px] px-1 py-0.5 rounded bg-teal-100 text-teal-700">direct</span> = Sub-Group &amp; Item Mark are identical — Layer 3 skipped, click opens lots directly</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TableSkeleton() {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-5 w-5" /><Skeleton className="h-5 flex-1" /><Skeleton className="h-5 w-24" /><Skeleton className="h-5 w-24" /><Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  )
}
