"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import {
  Plus, Eye, Edit, Trash2, Search, X, ChevronLeft, ChevronRight,
  RotateCcw, Clock, CheckCircle2, CheckCheck, Loader2, Download, BarChart3,
} from "lucide-react"
import { format } from "date-fns"
import { rtvApi } from "@/lib/api/rtvApiService"
import type { RTVListItem, RTVStatus } from "@/types/rtv"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { useAuthStore } from "@/lib/stores/auth"
import { getDisplayWarehouseName } from "@/lib/constants/warehouses"
import { cn } from "@/lib/utils"

interface RTVListPageProps {
  params: { company: string }
}

const STATUS_TABS: { label: string; value: RTVStatus | "all"; icon: React.ElementType; color: string }[] = [
  { label: "All", value: "all", icon: RotateCcw, color: "text-foreground" },
  { label: "Pending", value: "Pending", icon: Clock, color: "text-amber-600" },
  { label: "Approved", value: "Approved", icon: CheckCircle2, color: "text-emerald-600" },
  { label: "Submitted", value: "Submitted", icon: CheckCheck, color: "text-blue-600" },
]

function StatusBadge({ status }: { status: RTVStatus }) {
  const config: Record<string, { label: string; className: string }> = {
    Pending: { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
    Approved: { label: "Approved", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" },
    Submitted: { label: "Submitted", className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" },
  }
  const c = config[status] || config.Pending
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>
}

// ─── CR No. interactive hover card ──────────────────────────────────────────
// Pastel-gradient, fully-informative roll-up shown on hover (mouse) or tap
// (touch / no-mouse). Informative only — the row's Eye/Review buttons handle
// navigation. Rendered through a portal with viewport-aware positioning so it
// never escapes the screen and auto-sizes to fit.

function CustomerReturnCard({ item }: { item: RTVListItem }) {
  const toneChip = (tone: "blue" | "sky" | "emerald" | "amber" | "gray" | "violet") => {
    const map = {
      blue:    "bg-blue-50 text-blue-700 border-blue-200",
      sky:     "bg-sky-50 text-sky-700 border-sky-200",
      emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
      amber:   "bg-amber-50 text-amber-700 border-amber-200",
      gray:    "bg-gray-50 text-gray-700 border-gray-200",
      violet:  "bg-violet-50 text-violet-700 border-violet-200",
    }
    return `text-[10px] font-medium px-1.5 py-0.5 rounded border ${map[tone]}`
  }

  const fmtTs = (v: string | null) => {
    if (!v) return null
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : format(d, "dd MMM yyyy, HH:mm")
  }

  return (
    <div
      className="w-full rounded-2xl overflow-hidden text-xs max-h-[480px] flex flex-col"
      style={{
        background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 45%, #faf5ff 100%)",
        boxShadow: "0 20px 40px -10px rgba(79,70,229,0.22), 0 8px 16px -4px rgba(236,72,153,0.14), 0 0 0 1px rgba(147,197,253,0.45)",
      }}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-blue-100/60">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-[13px] text-gray-800">{item.rtv_id}</p>
          <StatusBadge status={item.status} />
        </div>
        <p className="text-[10px] text-gray-500 mt-0.5">
          {item.rtv_date ? format(new Date(item.rtv_date), "dd MMM yyyy") : "—"}
          {item.customer && ` · ${item.customer}`}
        </p>
      </div>

      <div className="px-3 py-2.5 space-y-2 overflow-y-auto flex-1">
        {/* Parties / unit */}
        {(item.customer || item.factory_unit || item.business_head || item.conversion) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {item.customer && (
              <span className={toneChip("gray")}><span className="opacity-60">Customer:</span> {item.customer}</span>
            )}
            {item.factory_unit && (
              <span className={toneChip("blue")}><span className="opacity-60">Unit:</span> {getDisplayWarehouseName(item.factory_unit)}</span>
            )}
            {item.business_head && (
              <span className={toneChip("violet")}><span className="opacity-60">Head:</span> {item.business_head}</span>
            )}
            {item.conversion && (
              <span className={toneChip("amber")}><span className="opacity-60">Conv:</span> {item.conversion}</span>
            )}
          </div>
        )}

        {/* Metrics */}
        <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-blue-100/50 text-[11px]">
          <span className="text-gray-500">Items: <span className="font-semibold text-gray-700">{item.items_count}</span></span>
          <span className="text-gray-500">Boxes: <span className="font-semibold text-gray-700">{item.boxes_count}</span></span>
          {item.total_qty != null && (
            <span className="text-gray-500">Qty: <span className="font-semibold text-gray-700">{item.total_qty}</span></span>
          )}
          {item.total_net_weight != null && (
            <span className="text-gray-500">Net: <span className="font-semibold text-gray-700">{item.total_net_weight} kg</span></span>
          )}
        </div>

        {/* Transport / handling */}
        {(item.vehicle_number || item.transporter_name || item.driver_name || item.inward_manager) && (
          <div className="pt-1.5 border-t border-blue-100/50 flex flex-wrap gap-1">
            {item.vehicle_number && (
              <span className={toneChip("sky")}><span className="opacity-60">Vehicle:</span> {item.vehicle_number}</span>
            )}
            {item.transporter_name && (
              <span className={toneChip("sky")}><span className="opacity-60">Transporter:</span> {item.transporter_name}</span>
            )}
            {item.driver_name && (
              <span className={toneChip("sky")}><span className="opacity-60">Driver:</span> {item.driver_name}</span>
            )}
            {item.inward_manager && (
              <span className={toneChip("blue")}><span className="opacity-60">Inward Mgr:</span> {item.inward_manager}</span>
            )}
          </div>
        )}

        {/* Footer */}
        {(item.created_by || item.created_ts || item.updated_at) && (
          <div className="pt-1.5 border-t border-blue-100/50 space-y-0.5 text-[10px]">
            {item.created_by && (
              <div className="flex justify-between gap-2">
                <span className="text-gray-400">Created by</span>
                <span className="font-medium text-gray-600">{item.created_by}</span>
              </div>
            )}
            {fmtTs(item.created_ts) && (
              <div className="flex justify-between gap-2">
                <span className="text-gray-400">Created</span>
                <span className="font-medium text-gray-600">{fmtTs(item.created_ts)}</span>
              </div>
            )}
            {fmtTs(item.updated_at) && (
              <div className="flex justify-between gap-2">
                <span className="text-gray-400">Updated</span>
                <span className="font-medium text-gray-600">{fmtTs(item.updated_at)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CustomerReturnHoverPortal({ item }: { item: RTVListItem }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; maxHeight: number }>({ left: 0, maxHeight: 480 })
  const [isTouch, setIsTouch] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)

  const CARD_WIDTH = 360
  const MARGIN = 8
  const GAP = 6

  // Devices without a real mouse (hover: none) get tap-to-open instead of hover.
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      setIsTouch(!window.matchMedia("(hover: hover)").matches)
    }
  }, [])

  const computePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    let left = rect.left
    if (left + CARD_WIDTH > vw - MARGIN) left = Math.max(MARGIN, vw - CARD_WIDTH - MARGIN)
    if (left < MARGIN) left = MARGIN

    const spaceAbove = rect.top - MARGIN
    const spaceBelow = vh - rect.bottom - MARGIN
    const maxHeight = Math.min(480, spaceAbove >= spaceBelow ? spaceAbove - GAP : spaceBelow - GAP)

    if (spaceAbove >= spaceBelow && spaceAbove >= 100) {
      setPos({ bottom: vh - rect.top + GAP, left, maxHeight })
    } else {
      setPos({ top: rect.bottom + GAP, left, maxHeight })
    }
  }, [])

  const open = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    computePosition()
    setShow(true)
  }, [computePosition])

  const scheduleClose = useCallback(() => {
    hideTimer.current = setTimeout(() => setShow(false), 180)
  }, [])

  const cancelClose = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }, [])

  // While open: close on outside tap (touch) and on scroll/resize (both modes).
  useEffect(() => {
    if (!show) return
    const onPointerDown = (e: Event) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t)) return
      const card = document.getElementById(`cr-hovercard-${item.id}`)
      if (card?.contains(t)) return
      setShow(false)
    }
    const onScrollResize = () => setShow(false)
    document.addEventListener("pointerdown", onPointerDown, true)
    window.addEventListener("scroll", onScrollResize, true)
    window.addEventListener("resize", onScrollResize)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true)
      window.removeEventListener("scroll", onScrollResize, true)
      window.removeEventListener("resize", onScrollResize)
    }
  }, [show, item.id])

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={() => { if (!isTouch) open() }}
        onMouseLeave={() => { if (!isTouch) scheduleClose() }}
        onClick={() => { if (isTouch) (show ? setShow(false) : open()) }}
        className="font-medium cursor-pointer underline-offset-2 hover:underline"
      >
        {item.rtv_id}
      </span>
      {show && typeof document !== "undefined" && createPortal(
        <div
          id={`cr-hovercard-${item.id}`}
          onMouseEnter={() => { if (!isTouch) cancelClose() }}
          onMouseLeave={() => { if (!isTouch) scheduleClose() }}
          style={{
            position: "fixed",
            ...(pos.bottom !== undefined ? { bottom: pos.bottom } : { top: pos.top }),
            left: pos.left,
            width: Math.min(CARD_WIDTH, window.innerWidth - MARGIN * 2),
            maxHeight: pos.maxHeight,
            zIndex: 9999,
            overflowY: "auto",
            borderRadius: "1rem",
          }}
        >
          <CustomerReturnCard item={item} />
        </div>,
        document.body
      )}
    </>
  )
}

export default function RTVListPage({ params }: RTVListPageProps) {
  const { company } = params
  const { user } = useAuthStore()

  const [records, setRecords] = useState<RTVListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<RTVStatus | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const [currentPage, setCurrentPage] = useState(1)
  const perPage = 20

  const [deleteTarget, setDeleteTarget] = useState<RTVListItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const toApiDate = (val: string) => {
    if (!val) return undefined
    const [y, m, d] = val.split("-")
    return `${d}-${m}-${y}`
  }

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await rtvApi.listRTVs(company, {
        page: currentPage,
        per_page: perPage,
        status: statusFilter === "all" ? undefined : statusFilter,
        customer: searchQuery || undefined,
        from_date: toApiDate(fromDate),
        to_date: toApiDate(toDate),
        sort_by: "created_ts",
        sort_order: "desc",
      })
      setRecords(response.records)
      setTotal(response.total)
    } catch (err) {
      console.error("Failed to fetch RTVs:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch records")
    } finally {
      setLoading(false)
    }
  }, [company, currentPage, perPage, searchQuery, statusFilter, fromDate, toDate])

  useEffect(() => {
    const timeout = setTimeout(fetchData, 400)
    return () => clearTimeout(timeout)
  }, [fetchData])

  useEffect(() => { setCurrentPage(1) }, [statusFilter, searchQuery, fromDate, toDate])

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      await rtvApi.deleteRTV(company, deleteTarget.id, user?.email || undefined)
      setDeleteTarget(null)
      fetchData()
    } catch (err) {
      console.error("Delete failed:", err)
    } finally {
      setDeleting(false)
    }
  }

  const handleDownload = async () => {
    try {
      setDownloading(true)
      const blob = await rtvApi.exportToExcel(company, {
        status: statusFilter === "all" ? undefined : statusFilter,
        customer: searchQuery || undefined,
        from_date: toApiDate(fromDate),
        to_date: toApiDate(toDate),
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `rtv_${company}_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Download failed:", err)
    } finally {
      setDownloading(false)
    }
  }

  const clearFilters = () => {
    setSearchQuery("")
    setFromDate("")
    setToDate("")
    setStatusFilter("all")
  }

  const hasFilters = searchQuery || fromDate || toDate || statusFilter !== "all"
  const totalPages = Math.ceil(total / perPage)

  return (
    <PermissionGuard module="reordering" action="view">
      <div className="p-3 sm:p-4 md:p-6 max-w-[1400px] mx-auto space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight">Customer Returns</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">
              Manage customer return entries and approvals
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href={`/${company}/rtv/dashboard`}>
                <BarChart3 className="h-4 w-4" />
                <span className="hidden xs:inline">Dashboard</span>
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link href={`/${company}/customer-returns/new`}>
                <Plus className="h-4 w-4" />
                <span className="hidden xs:inline">New CR</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit flex-shrink-0 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                statusFilter === tab.value
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className={cn("h-3.5 w-3.5", statusFilter === tab.value && tab.color)} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col gap-2">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 flex-1 min-w-0"
            />
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 flex-1 min-w-0"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={downloading}
              className="h-9 gap-1 flex-shrink-0"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Download</span>
            </Button>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 flex-shrink-0">
                <X className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Clear</span>
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg">{error}</div>
        )}

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              </div>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center px-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <RotateCcw className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No CR entries found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {hasFilters ? "Try adjusting your filters" : "Create your first CR entry"}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left font-medium px-4 py-2.5">CR No</th>
                        <th className="text-left font-medium px-4 py-2.5">Date</th>
                        <th className="text-left font-medium px-4 py-2.5">Status</th>
                        <th className="text-left font-medium px-4 py-2.5">Customer</th>
                        <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">Business Head</th>
                        <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">Factory Unit</th>
                        <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">Items</th>
                        <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">Net Wt (kg)</th>
                        <th className="text-right font-medium px-4 py-2.5">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((item) => (
                        <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3"><CustomerReturnHoverPortal item={item} /></td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {item.rtv_date ? format(new Date(item.rtv_date), "dd MMM yyyy") : "\u2014"}
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                          <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">{item.customer || "\u2014"}</td>
                          <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{item.business_head || "\u2014"}</td>
                          <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{getDisplayWarehouseName(item.factory_unit) || "\u2014"}</td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <Badge variant="secondary" className="text-xs">{item.items_count} items</Badge>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{item.total_net_weight} kg</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                <Link href={`/${company}/customer-returns/${item.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                              </Button>
                              {item.status === "Pending" && (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                    <Link href={`/${company}/customer-returns/${item.id}/approve`}><Edit className="h-3.5 w-3.5" /></Link>
                                  </Button>
                                  <Button
                                    variant="ghost" size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => setDeleteTarget(item)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                              <Button variant="outline" size="sm" className="h-7 text-xs ml-1" asChild>
                                <Link href={`/${company}/customer-returns/${item.id}/approve`}>
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  {item.status === "Pending" ? "Review" : "View"}
                                </Link>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="md:hidden divide-y">
                  {records.map((item) => (
                    <div key={item.id} className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate"><CustomerReturnHoverPortal item={item} /></p>
                          <p className="text-xs text-muted-foreground">
                            {item.rtv_date ? format(new Date(item.rtv_date), "dd MMM yyyy") : "\u2014"}
                            {item.customer && ` \u00b7 ${item.customer}`}
                          </p>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                      <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                        <span>{item.items_count} items</span>
                        <span>\u00b7</span>
                        <span>Net Wt: {item.total_net_weight} kg</span>
                        {item.factory_unit && (<><span>\u00b7</span><span>{getDisplayWarehouseName(item.factory_unit)}</span></>)}
                      </div>
                      <div className="flex items-center gap-1 pt-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 flex-1" asChild>
                          <Link href={`/${company}/customer-returns/${item.id}`}><Eye className="h-3 w-3" /> View</Link>
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1" asChild>
                          <Link href={`/${company}/customer-returns/${item.id}/approve`}>
                            <CheckCircle2 className="h-3 w-3" />
                            {item.status === "Pending" ? "Review" : "View"}
                          </Link>
                        </Button>
                        {item.status === "Pending" && (
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive flex-shrink-0"
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Page {currentPage} of {totalPages} ({total} total)</p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Delete Dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete CR</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <span className="font-medium text-foreground">{deleteTarget?.rtv_id}</span>?
                This will remove all lines and boxes. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PermissionGuard>
  )
}
