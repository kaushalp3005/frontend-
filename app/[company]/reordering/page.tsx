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
import {
  Plus, Eye, Edit, Trash2, Search, X, ChevronLeft, ChevronRight,
  RotateCcw, Clock, CheckCircle2, Loader2, Download,
} from "lucide-react"
import { format } from "date-fns"
import { rtvApi } from "@/lib/api/rtvApiService"
import type { RTVListItem, RTVStatus } from "@/types/rtv"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { cn } from "@/lib/utils"

interface RTVListPageProps {
  params: { company: string }
}

const STATUS_TABS: { label: string; value: RTVStatus | "all"; icon: React.ElementType; color: string }[] = [
  { label: "All", value: "all", icon: RotateCcw, color: "text-foreground" },
  { label: "Pending", value: "Pending", icon: Clock, color: "text-amber-600" },
  { label: "Approved", value: "Approved", icon: CheckCircle2, color: "text-emerald-600" },
]

function StatusBadge({ status }: { status: RTVStatus }) {
  const config: Record<string, { label: string; className: string }> = {
    Pending: { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
    Approved: { label: "Approved", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" },
  }
  const c = config[status] || config.Pending
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>
}

export default function RTVListPage({ params }: RTVListPageProps) {
  const { company } = params

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
      await rtvApi.deleteRTV(company, deleteTarget.id)
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
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight">RTV / Rejection</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">
              Manage return to vendor entries and approvals
            </p>
          </div>
          <Button asChild size="sm" className="gap-1.5 flex-shrink-0">
            <Link href={`/${company}/reordering/new`}>
              <Plus className="h-4 w-4" />
              <span className="hidden xs:inline">New RTV</span>
            </Link>
          </Button>
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
                <p className="text-sm font-medium">No RTV entries found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {hasFilters ? "Try adjusting your filters" : "Create your first RTV entry"}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left font-medium px-4 py-2.5">RTV ID</th>
                        <th className="text-left font-medium px-4 py-2.5">Date</th>
                        <th className="text-left font-medium px-4 py-2.5">Status</th>
                        <th className="text-left font-medium px-4 py-2.5">Customer</th>
                        <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">Factory Unit</th>
                        <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">Items</th>
                        <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">Total Qty</th>
                        <th className="text-right font-medium px-4 py-2.5">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((item) => (
                        <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3"><span className="font-medium">{item.rtv_id}</span></td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {item.rtv_date ? format(new Date(item.rtv_date), "dd MMM yyyy") : "\u2014"}
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                          <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">{item.customer || "\u2014"}</td>
                          <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{item.factory_unit || "\u2014"}</td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <Badge variant="secondary" className="text-xs">{item.items_count} items</Badge>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{item.total_qty}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                <Link href={`/${company}/reordering/${item.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                              </Button>
                              {item.status === "Pending" && (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                    <Link href={`/${company}/reordering/${item.id}/approve`}><Edit className="h-3.5 w-3.5" /></Link>
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
                                <Link href={`/${company}/reordering/${item.id}/approve`}>
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
                          <p className="text-sm font-medium truncate">{item.rtv_id}</p>
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
                        <span>Qty: {item.total_qty}</span>
                        {item.factory_unit && (<><span>\u00b7</span><span>{item.factory_unit}</span></>)}
                      </div>
                      <div className="flex items-center gap-1 pt-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 flex-1" asChild>
                          <Link href={`/${company}/reordering/${item.id}`}><Eye className="h-3 w-3" /> View</Link>
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1" asChild>
                          <Link href={`/${company}/reordering/${item.id}/approve`}>
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
              <AlertDialogTitle>Delete RTV</AlertDialogTitle>
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
