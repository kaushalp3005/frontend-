"use client"

import React, { useState, useEffect, useCallback } from "react"
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
import { useRouter } from "next/navigation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import {
  Plus, Eye, Edit, Trash2, Search, X, ChevronLeft, ChevronRight,
  FileCheck, Clock, CheckCircle2, Loader2, ArrowDownToLine, ClipboardCheck, ClipboardList, Download, Snowflake, BarChart3, CalendarClock,
  Package, MapPin, Truck, FileText, AlertCircle, CheckCheck, Snowflake as SnowflakeIcon,
} from "lucide-react"
import { format } from "date-fns"
import {
  inwardApiService,
  type Company,
  type InwardStatus,
  type InwardListItem,
} from "@/types/inward"
// Using inwardApiService.getWarehouseList for dynamic dropdown; hardcoded list stays as a fallback.
import { PermissionGuard } from "@/components/auth/permission-gate"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/stores/auth"
import { getAllWarehouseCodes, getUserDefaultWarehouses, normalizeWarehouseName, getDisplayWarehouseName } from "@/lib/constants/warehouses"
import { usePersistedState } from "@/lib/hooks/usePersistedState"

interface InwardListPageProps {
  params: { company: Company }
}


function TransactionStatusCard({ item }: { item: InwardListItem }) {
  const completed: string[] = []
  const pending: string[] = []

  // Check required sections
  if (item.warehouse) completed.push("Warehouse")
  else pending.push("Warehouse")

  if (item.approval_authority) completed.push("Inward Manager")
  else pending.push("Inward Manager")

  if (item.vehicle_number && item.transporter_name) completed.push("Transport")
  else pending.push("Transport")

  if (item.grn_number && item.grn_quantity != null && item.system_grn_date) completed.push("GRN")
  else pending.push("GRN")

  if (item.status === "approved") completed.push("Approval")
  else pending.push("Approval")

  const rate = item.total_amount && item.box_count ? (item.total_amount / item.box_count).toFixed(2) : null

  return (
    <div className="divide-y">
      <div className="px-4 py-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{item.transaction_no}</p>
          <Badge variant="outline" className={cn(
            "text-xs",
            item.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
          )}>
            {item.status === "approved" ? "Approved" : "Pending"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {item.entry_date ? format(new Date(item.entry_date), "dd MMM yyyy") : "—"}
          {item.vendor_supplier_name && ` · ${item.vendor_supplier_name}`}
        </p>
      </div>

      <div className="px-4 py-3 space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-2">
          {item.warehouse && (
            <div className="flex items-start gap-1.5">
              <Package className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Warehouse</p>
                <p className="font-medium">{getDisplayWarehouseName(item.warehouse)}</p>
              </div>
            </div>
          )}
          {item.approval_authority && (
            <div className="flex items-start gap-1.5">
              <CheckCircle2 className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Manager</p>
                <p className="font-medium truncate">{item.approval_authority}</p>
              </div>
            </div>
          )}
          {item.po_number && (
            <div className="flex items-start gap-1.5">
              <FileText className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">PO #</p>
                <p className="font-medium truncate">{item.po_number}</p>
              </div>
            </div>
          )}
          {item.grn_number && (
            <div className="flex items-start gap-1.5">
              <ClipboardCheck className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">GRN</p>
                <p className="font-medium truncate">{item.grn_number}</p>
              </div>
            </div>
          )}
          {item.vehicle_number && (
            <div className="flex items-start gap-1.5">
              <Truck className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Vehicle</p>
                <p className="font-medium">{item.vehicle_number}</p>
              </div>
            </div>
          )}
          {item.source_location && (
            <div className="flex items-start gap-1.5">
              <MapPin className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Source</p>
                <p className="font-medium truncate">{item.source_location}</p>
              </div>
            </div>
          )}
        </div>

        {(item.total_amount != null || item.net_weight != null || item.box_count != null) && (
          <div className="flex items-center gap-3 pt-2 border-t text-[11px]">
            {item.total_amount != null && (
              <div>
                <span className="text-muted-foreground">Value: </span>
                <span className="font-medium">₹{item.total_amount.toLocaleString()}</span>
              </div>
            )}
            {item.net_weight != null && (
              <div>
                <span className="text-muted-foreground">Net: </span>
                <span className="font-medium">{item.net_weight}kg</span>
              </div>
            )}
            {item.box_count != null && (
              <div>
                <span className="text-muted-foreground">Boxes: </span>
                <span className="font-medium">{item.box_count}</span>
              </div>
            )}
            {rate && (
              <div>
                <span className="text-muted-foreground">Rate: </span>
                <span className="font-medium">₹{rate}/box</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-3 space-y-1.5">
        {completed.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-emerald-700 uppercase mb-1">Completed</p>
            <div className="flex flex-wrap gap-1">
              {completed.map((c) => (
                <Badge key={c} variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                  ✓ {c}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {pending.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-amber-700 uppercase mb-1">Pending</p>
            <div className="flex flex-wrap gap-1">
              {pending.map((p) => (
                <Badge key={p} variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                  ○ {p}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


function StatusBadge({ status, hasEdits }: { status: InwardStatus; hasEdits?: boolean }) {
  const config = {
    pending: { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
    approved: { label: "Approved", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" },
    rejected: { label: "Rejected", className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800" },
  }
  const c = config[status] || config.pending
  const editedClassName = hasEdits
    ? "bg-red-100 border-red-300 dark:bg-red-900/40 dark:border-red-700"
    : ""
  return <Badge variant="outline" className={cn(c.className, editedClassName)}>{c.label}</Badge>
}

export default function InwardListPage({ params }: InwardListPageProps) {
  const { company } = params
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { user } = useAuthStore()

  // Filters persisted to sessionStorage so back-navigation (e.g. from a
  // transaction detail page) restores the active filters.
  const NS = `${company}:inward-list`
  type SmartFilter = "all" | "new" | "in_progress" | "pending_po" | "pending_grn" | "approved" | "my_reviews"
  const [smartFilter, setSmartFilter] = usePersistedState<SmartFilter>(`${NS}:smartFilter`, "all")
  // Special sentinel "my_warehouses" means filter to all user defaults
  const [warehouseFilter, setWarehouseFilter] = usePersistedState<string>(`${NS}:warehouseFilter`, "all")
  const [userDefaultWarehouses, setUserDefaultWarehouses] = useState<string[]>([])
  const [serverWarehouses, setServerWarehouses] = useState<string[]>([])

  type ApprovedSubFilter = "all" | "grn_completed" | "grn_pending"
  const [approvedSubFilter, setApprovedSubFilter] = usePersistedState<ApprovedSubFilter>(`${NS}:approvedSubFilter`, "all")

  const [poStatus, setPoStatus] = useState<{ date: string; count: number }[]>([])
  const [poStatusLoading, setPoStatusLoading] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  const [deleteTarget, setDeleteTarget] = useState<InwardListItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (user?.name) {
      const defaults = getUserDefaultWarehouses(user.name)
      setUserDefaultWarehouses(defaults)
      // Only seed from user defaults if the persisted warehouseFilter is
      // still the initial "all" sentinel. Otherwise the user already picked
      // something (possibly on a prior visit), and we must not overwrite it.
      if (warehouseFilter === "all") {
        if (defaults.length === 1) {
          setWarehouseFilter(defaults[0])
        } else if (defaults.length > 1) {
          setWarehouseFilter("my_warehouses")
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name])

  const [poBreakdown, setPoBreakdown] = useState<Array<{
    po_number: string
    inward_count: number
    total_amount: number
    latest_entry_date: string | null
    vendor: string | null
  }>>([])

  useEffect(() => {
    const fetchPoStatus = async () => {
      try {
        setPoStatusLoading(true)
        const [status, breakdown] = await Promise.all([
          inwardApiService.getPoUploadStatus(company),
          inwardApiService.getPoBreakdown(company, 30),
        ])
        setPoStatus(status)
        setPoBreakdown(breakdown)
      } catch (err) {
        console.error("Failed to fetch PO status:", err)
      } finally {
        setPoStatusLoading(false)
      }
    }
    fetchPoStatus()
  }, [company])

  // Load the list of warehouses actually present in backend data.
  // Silently falls back to the hardcoded list if the endpoint fails.
  useEffect(() => {
    let cancelled = false
    inwardApiService.getWarehouseList(company)
      .then(list => {
        if (!cancelled) {
          // Normalize raw DB values (e.g. "old_savla" → "Savla D-39") and deduplicate
          const seen = new Set<string>()
          const normalized = list
            .map(normalizeWarehouseName)
            .filter(code => code && !seen.has(code) && seen.add(code) as unknown as boolean)
          setServerWarehouses(normalized)
        }
      })
      .catch(err => { console.warn("getWarehouseList failed; using hardcoded fallback:", err) })
    return () => { cancelled = true }
  }, [company])

  const [allRecords, setAllRecords] = useState<InwardListItem[]>([])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch with minimal backend filters; do smart filtering client-side
      let status: InwardStatus | undefined
      if (smartFilter === "new" || smartFilter === "in_progress" || smartFilter === "pending_po" || smartFilter === "my_reviews") {
        // These need pending data
        status = undefined // fetch all, filter client-side
      } else if (smartFilter === "pending_grn" || smartFilter === "approved") {
        status = "approved"
      }

      // Pass warehouse to backend only for a specific single-warehouse filter.
      // "all" sends everything; "my_warehouses" is a multi-warehouse sentinel
      // that the /inward endpoint can't express, so fetch all and client-filter.
      const warehouseParam =
        warehouseFilter !== "all" && warehouseFilter !== "my_warehouses"
          ? warehouseFilter
          : undefined

      const response = await inwardApiService.getInwardList(company, {
        page: 1,
        per_page: 500, // fetch a large page; client-side paginate/filter
        search: searchQuery || undefined,
        status,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        warehouse: warehouseParam,
      })
      setAllRecords(response.records)
    } catch (err) {
      console.error("Failed to fetch inward records:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch records")
    } finally {
      setLoading(false)
    }
  }, [company, searchQuery, smartFilter, fromDate, toDate, warehouseFilter])

  // Debounced fetch
  useEffect(() => {
    const timeout = setTimeout(fetchData, 400)
    return () => clearTimeout(timeout)
  }, [fetchData])

  // Helper: check if an entry has any approval data filled
  const hasApprovalData = (item: InwardListItem) =>
    !!(item.warehouse || item.approval_authority || item.vehicle_number || item.transporter_name || item.lr_number || item.grn_number || item.challan_number)

  const hasCompleteGrn = (item: InwardListItem) =>
    !!(item.grn_number && item.grn_quantity != null && item.system_grn_date)

  const filteredRecords = React.useMemo(() => {
    let result = allRecords

    // Smart filter
    switch (smartFilter) {
      case "new":
        // Pending with no approval data
        result = result.filter((r) => r.status === "pending" && !hasApprovalData(r))
        break
      case "in_progress":
        // Pending with some data filled (partially reviewed) but not approved
        result = result.filter((r) => r.status === "pending" && hasApprovalData(r))
        break
      case "pending_po":
        // PO uploaded (has po_number) but not yet processed — still pending
        result = result.filter((r) => r.status === "pending" && !!r.po_number && !hasApprovalData(r))
        break
      case "pending_grn":
        result = result.filter((r) => r.status === "approved" && !hasCompleteGrn(r))
        break
      case "approved":
        result = result.filter((r) => r.status === "approved")
        if (approvedSubFilter === "grn_completed") {
          result = result.filter(hasCompleteGrn)
        } else if (approvedSubFilter === "grn_pending") {
          result = result.filter((r) => !hasCompleteGrn(r))
        }
        break
      case "my_reviews":
        result = user?.name
          ? result.filter((r) => r.approval_authority === user.name)
          : []
        break
      // "all" — no smart filter
    }

    // Warehouse filter (client-side) — supports "my_warehouses" sentinel for multi-warehouse users.
    // Normalize both sides so backend aliases ("Warehouse A185", "savla d-39 cold") match canonical codes.
    if (warehouseFilter === "my_warehouses" && userDefaultWarehouses.length > 0) {
      const set = new Set(userDefaultWarehouses.map(normalizeWarehouseName))
      result = result.filter((r) => r.warehouse && set.has(normalizeWarehouseName(r.warehouse)))
    } else if (warehouseFilter !== "all") {
      const target = normalizeWarehouseName(warehouseFilter)
      result = result.filter((r) => normalizeWarehouseName(r.warehouse) === target)
    }

    return result
  }, [allRecords, smartFilter, approvedSubFilter, warehouseFilter, user?.name, userDefaultWarehouses])

  // Client-side pagination
  const paginatedRecords = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredRecords.slice(start, start + itemsPerPage)
  }, [filteredRecords, currentPage, itemsPerPage])

  const totalFiltered = filteredRecords.length
  const totalPages = Math.ceil(totalFiltered / itemsPerPage)

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1) }, [smartFilter, approvedSubFilter, warehouseFilter, searchQuery, fromDate, toDate])

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      await inwardApiService.deleteInward(company, deleteTarget.transaction_no)
      setDeleteTarget(null)
      fetchData()
    } catch (err) {
      console.error("Delete failed:", err)
    } finally {
      setDeleting(false)
    }
  }

  const clearFilters = () => {
    setSearchQuery("")
    setFromDate("")
    setToDate("")
    setSmartFilter("all")
    setWarehouseFilter("all")
  }

  const handleDownload = async () => {
    try {
      setDownloading(true)
      const sp = new URLSearchParams()
      sp.append("company", company)
      if (searchQuery) sp.append("search", searchQuery)
      if (smartFilter !== "all") sp.append("smart_filter", smartFilter)
      if (warehouseFilter !== "all") sp.append("warehouse", warehouseFilter)
      if (fromDate) sp.append("from_date", fromDate)
      if (toDate) sp.append("to_date", toDate)

      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? ""
      const response = await fetch(`${apiBase}/inward/export?${sp.toString()}`)
      if (!response.ok) throw new Error("Export failed")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `inward_${company}_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.xlsx`
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

  const hasFilters = searchQuery || fromDate || toDate || smartFilter !== "all" || warehouseFilter !== "all"

  return (
    <PermissionGuard module="inward" action="view">
      <div className="p-3 sm:p-4 md:p-6 max-w-[1400px] mx-auto space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight">Inward Entries</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">
              Manage purchase order entries and approvals
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href={`/${company}/inward/bulk-sticker`}>
                <Snowflake className="h-4 w-4" />
                <span className="hidden xs:inline">Bulk Sticker</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href={`/${company}/inward/dashboard`}>
                <BarChart3 className="h-4 w-4" />
                <span className="hidden xs:inline">View Summary</span>
              </Link>
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <CalendarClock className={cn(
                    "h-4 w-4",
                    (() => {
                      if (poStatus.length === 0) return "text-muted-foreground"
                      const latest = poStatus.find((d) => d.count > 0)
                      if (!latest) return "text-red-500"
                      const daysAgo = Math.floor((Date.now() - new Date(latest.date).getTime()) / 86400000)
                      if (daysAgo <= 2) return "text-emerald-500"
                      if (daysAgo <= 5) return "text-amber-500"
                      return "text-red-500"
                    })()
                  )} />
                  <span className="hidden sm:inline">PO Status</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0" align="end">
                <div className="p-3 space-y-3 max-h-[500px] overflow-y-auto">
                  <p className="text-sm font-semibold">PO Upload Status</p>
                  {poStatusLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
                    </div>
                  ) : (
                    <>
                      {(() => {
                        const latest = poStatus.find((d) => d.count > 0)
                        if (!latest) return <p className="text-sm text-red-600">No recent PO uploads found</p>
                        const daysAgo = Math.floor((Date.now() - new Date(latest.date).getTime()) / 86400000)
                        return (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Latest PO activity</span>
                              <span className="text-sm font-medium">{format(new Date(latest.date), "dd MMM yyyy")}</span>
                            </div>
                            <p className={cn(
                              "text-xs",
                              daysAgo <= 2 ? "text-emerald-600" : daysAgo <= 5 ? "text-amber-600" : "text-red-600"
                            )}>
                              {daysAgo === 0 ? "Up to date" : `Last PO uploaded ${daysAgo} day${daysAgo > 1 ? "s" : ""} ago`}
                            </p>
                          </div>
                        )
                      })()}

                      <Separator />

                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Distinct POs per day (last 7 days)</p>
                        {poStatus.map(({ date, count }) => {
                          const d = new Date(date)
                          const isWeekend = d.getDay() === 0 || d.getDay() === 6
                          return (
                            <div key={date} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{format(d, "dd MMM")}</span>
                              <div className="flex items-center gap-1.5">
                                <span>{count > 0 ? `${count} PO${count > 1 ? "s" : ""}` : isWeekend ? "Weekend" : "No uploads"}</span>
                                <div className={cn(
                                  "h-2 w-2 rounded-full",
                                  count > 0 ? "bg-emerald-500" : isWeekend ? "bg-gray-300" : "bg-red-400"
                                )} />
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <Separator />

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground">Recent POs (30 days)</p>
                          <span className="text-[10px] text-muted-foreground">{poBreakdown.length} PO{poBreakdown.length !== 1 ? "s" : ""}</span>
                        </div>
                        {poBreakdown.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">No POs referenced on inwards in last 30 days</p>
                        ) : (
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {poBreakdown.slice(0, 20).map(po => (
                              <div key={po.po_number} className="flex items-start justify-between gap-2 text-xs border-b border-dashed border-slate-200 dark:border-slate-700 pb-1 last:border-0">
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium truncate">{po.po_number}</div>
                                  <div className="text-[10px] text-muted-foreground truncate">
                                    {po.vendor || "Unknown vendor"}
                                    {po.latest_entry_date && ` · ${format(new Date(po.latest_entry_date), "dd MMM")}`}
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className="font-medium">{po.inward_count} inward{po.inward_count > 1 ? "s" : ""}</div>
                                  {po.total_amount > 0 && <div className="text-[10px] text-muted-foreground tabular-nums">₹{Math.round(po.total_amount).toLocaleString("en-IN")}</div>}
                                </div>
                              </div>
                            ))}
                            {poBreakdown.length > 20 && (
                              <p className="text-[10px] text-muted-foreground italic text-center pt-1">+ {poBreakdown.length - 20} more</p>
                            )}
                          </div>
                        )}
                      </div>

                      <Separator />

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Inwards assigned to POs</span>
                          <span className="font-medium">{poBreakdown.reduce((s, p) => s + p.inward_count, 0)}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">
                          Note: POs uploaded but not yet referenced on any inward can't be shown here — that requires a dedicated PO listing endpoint on the backend.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Button asChild size="sm" className="gap-1.5">
              <Link href={`/${company}/inward/new`}>
                <Plus className="h-4 w-4" />
                <span className="hidden xs:inline">New Entry</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Smart Filter Bar */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {([
              { key: "all" as const, label: "All Entries", icon: ArrowDownToLine },
              { key: "new" as const, label: "New", icon: Clock },
              { key: "in_progress" as const, label: "In Progress", icon: Edit },
              { key: "pending_po" as const, label: "Pending PO", icon: FileCheck },
              { key: "pending_grn" as const, label: "Pending GRN", icon: ClipboardList },
              { key: "approved" as const, label: "Approved", icon: CheckCircle2 },
              { key: "my_reviews" as const, label: "My Reviews", icon: ClipboardCheck },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSmartFilter(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-full border transition-colors whitespace-nowrap",
                  smartFilter === tab.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Approved sub-filter */}
          {smartFilter === "approved" && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 pl-2 border-l-2 border-primary/20">
              {([
                { key: "all" as const, label: "All Approved", icon: CheckCircle2 },
                { key: "grn_completed" as const, label: "GRN Completed", icon: CheckCheck },
                { key: "grn_pending" as const, label: "GRN Pending", icon: AlertCircle },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setApprovedSubFilter(tab.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-colors whitespace-nowrap",
                    approvedSubFilter === tab.key
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-background text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  <tab.icon className="h-3 w-3" />
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Warehouse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Warehouses</SelectItem>
                {userDefaultWarehouses.length > 1 && (
                  <SelectItem value="my_warehouses">
                    My Warehouses ({userDefaultWarehouses.length})
                  </SelectItem>
                )}
                {(serverWarehouses.length > 0 ? serverWarehouses : getAllWarehouseCodes()).map((code) => (
                  <SelectItem key={code} value={code}>{getDisplayWarehouseName(code)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col gap-2">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search transaction, PO, vendor..."
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
              placeholder="From"
            />
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 flex-1 min-w-0"
              placeholder="To"
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

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
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
            ) : paginatedRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center px-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <FileCheck className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No entries found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {hasFilters ? "Try adjusting your filters" : "Create your first inward entry"}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left font-medium px-4 py-2.5">Transaction</th>
                        <th className="text-left font-medium px-4 py-2.5">Date</th>
                        <th className="text-left font-medium px-4 py-2.5">Status</th>
                        <th className="text-left font-medium px-4 py-2.5">Vendor</th>
                        <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">PO #</th>
                        <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">Items</th>
                        <th className="text-right font-medium px-4 py-2.5">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRecords.map((item) => {
                        const txnNo = item.transaction_no || (item as any).transaction_id || ""
                        return (
                        <tr
                          key={txnNo || Math.random()}
                          className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <HoverCard openDelay={200}>
                              <HoverCardTrigger asChild>
                                <span className="font-medium cursor-help underline-offset-2 hover:underline">{txnNo}</span>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-80 p-0" align="start">
                                <TransactionStatusCard item={item} />
                              </HoverCardContent>
                            </HoverCard>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {item.entry_date ? format(new Date(item.entry_date), "dd MMM yyyy") : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={item.status} hasEdits={item.has_edits} />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">
                            {item.vendor_supplier_name || "—"}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                            {item.po_number || "—"}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {(item.item_descriptions || []).slice(0, 2).map((desc, i) => (
                                <Badge key={i} variant="secondary" className="text-xs font-normal truncate max-w-[120px]">
                                  {desc}
                                </Badge>
                              ))}
                              {(item.item_descriptions || []).length > 2 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{item.item_descriptions.length - 2}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                <Link href={`/${company}/inward/${txnNo}`}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                <Link href={`/${company}/inward/${txnNo}/edit`}>
                                  <Edit className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
                              {item.status === "pending" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteTarget(item)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button variant="outline" size="sm" className="h-7 text-xs ml-1" asChild>
                                <Link href={`/${company}/inward/${txnNo}/approve`}>
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  {item.status === "pending" ? "Review" : "Edit & Review"}
                                </Link>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card list */}
                <div className="md:hidden divide-y">
                  {paginatedRecords.map((item) => {
                    const txnNo = item.transaction_no || (item as any).transaction_id || ""
                    return (
                      <div key={txnNo || Math.random()} className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{txnNo}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.entry_date ? format(new Date(item.entry_date), "dd MMM yyyy") : "—"}
                              {item.vendor_supplier_name && ` · ${item.vendor_supplier_name}`}
                            </p>
                          </div>
                          <StatusBadge status={item.status} hasEdits={item.has_edits} />
                        </div>
                        {item.po_number && (
                          <p className="text-xs text-muted-foreground">PO: {item.po_number}</p>
                        )}
                        {(item.item_descriptions || []).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.item_descriptions.slice(0, 2).map((desc, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px] font-normal truncate max-w-[140px]">
                                {desc}
                              </Badge>
                            ))}
                            {item.item_descriptions.length > 2 && (
                              <Badge variant="secondary" className="text-[10px]">+{item.item_descriptions.length - 2}</Badge>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-1 pt-1">
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 flex-1" asChild>
                            <Link href={`/${company}/inward/${txnNo}`}>
                              <Eye className="h-3 w-3" /> View
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 flex-1" asChild>
                            <Link href={`/${company}/inward/${txnNo}/edit`}>
                              <Edit className="h-3 w-3" /> Edit
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1" asChild>
                            <Link href={`/${company}/inward/${txnNo}/approve`}>
                              <CheckCircle2 className="h-3 w-3" />
                              {item.status === "pending" ? "Review" : "Review"}
                            </Link>
                          </Button>
                          {item.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive flex-shrink-0"
                              onClick={() => setDeleteTarget(item)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {currentPage} of {totalPages} ({totalFiltered} total)
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Delete Dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Entry</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete transaction{" "}
                <span className="font-medium text-foreground">{deleteTarget?.transaction_no}</span>?
                This action cannot be undone.
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
