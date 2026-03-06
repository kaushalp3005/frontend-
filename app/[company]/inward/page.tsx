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
import {
  Plus, Eye, Edit, Trash2, Search, X, ChevronLeft, ChevronRight,
  FileCheck, Clock, CheckCircle2, Loader2, ArrowDownToLine, ClipboardCheck, ClipboardList, Download,
} from "lucide-react"
import { format } from "date-fns"
import {
  inwardApiService,
  type Company,
  type InwardStatus,
  type InwardListItem,
  type InwardListResponse,
} from "@/types/inward"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { cn } from "@/lib/utils"

interface InwardListPageProps {
  params: { company: Company }
}

const STATUS_TABS: { label: string; value: InwardStatus | "all"; icon: React.ElementType; color: string }[] = [
  { label: "All", value: "all", icon: ArrowDownToLine, color: "text-foreground" },
  { label: "Pending", value: "pending", icon: Clock, color: "text-amber-600" },
  { label: "Approved", value: "approved", icon: CheckCircle2, color: "text-emerald-600" },
]

const GRN_TABS: { label: string; value: "all" | "completed" | "pending"; icon: React.ElementType; color: string }[] = [
  { label: "All", value: "all", icon: ArrowDownToLine, color: "text-foreground" },
  { label: "Completed GRN", value: "completed", icon: ClipboardCheck, color: "text-emerald-600" },
  { label: "Pending GRN", value: "pending", icon: ClipboardList, color: "text-amber-600" },
]

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

  const [data, setData] = useState<InwardListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<InwardStatus | "all">("pending")
  const [grnFilter, setGrnFilter] = useState<"all" | "completed" | "pending">("pending")
  const [searchQuery, setSearchQuery] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  const [deleteTarget, setDeleteTarget] = useState<InwardListItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await inwardApiService.getInwardList(company, {
        page: currentPage,
        per_page: itemsPerPage,
        search: searchQuery || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        grn_status: grnFilter === "all" ? undefined : grnFilter,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      })
      setData(response)
    } catch (err) {
      console.error("Failed to fetch inward records:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch records")
    } finally {
      setLoading(false)
    }
  }, [company, currentPage, itemsPerPage, searchQuery, statusFilter, grnFilter, fromDate, toDate])

  // Debounced fetch
  useEffect(() => {
    const timeout = setTimeout(fetchData, 400)
    return () => clearTimeout(timeout)
  }, [fetchData])

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1) }, [statusFilter, grnFilter, searchQuery, fromDate, toDate])

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
    setStatusFilter("pending")
    setGrnFilter("pending")
  }

  const handleDownload = async () => {
    try {
      setDownloading(true)
      const sp = new URLSearchParams()
      sp.append("company", company)
      if (searchQuery) sp.append("search", searchQuery)
      if (statusFilter !== "all") sp.append("status", statusFilter)
      if (grnFilter !== "all") sp.append("grn_status", grnFilter)
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

  const hasFilters = searchQuery || fromDate || toDate || statusFilter !== "pending" || grnFilter !== "pending"
  const totalPages = data ? Math.ceil(data.total / itemsPerPage) : 0
  const records = data?.records || []

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
          <Button asChild size="sm" className="gap-1.5 flex-shrink-0">
            <Link href={`/${company}/inward/new`}>
              <Plus className="h-4 w-4" />
              <span className="hidden xs:inline">New Entry</span>
            </Link>
          </Button>
        </div>

        {/* Status & GRN Tabs */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 overflow-x-auto">
          <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit flex-shrink-0">
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

          {/* GRN Tabs */}
          <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit flex-shrink-0">
            {GRN_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setGrnFilter(tab.value)}
                className={cn(
                  "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                  grnFilter === tab.value
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className={cn("h-3.5 w-3.5", grnFilter === tab.value && tab.color)} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.replace("Completed ", "").replace("Pending ", "P. ")}</span>
              </button>
            ))}
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
            ) : records.length === 0 ? (
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
                      {records.map((item) => {
                        const txnNo = item.transaction_no || (item as any).transaction_id || ""
                        return (
                        <tr
                          key={txnNo || Math.random()}
                          className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <span className="font-medium">{txnNo}</span>
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
                  {records.map((item) => {
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
              Page {currentPage} of {totalPages} ({data?.total} total)
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
