"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
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
  Plus, Eye, Trash2, Search, X, ChevronLeft, ChevronRight,
  Loader2, Package, Printer,
} from "lucide-react"
import { format } from "date-fns"
import { bulkEntryApi } from "@/lib/api/bulkEntryApiService"
import type { BulkEntryTransaction } from "@/types/cold-storage"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { cn } from "@/lib/utils"

interface ColdStorageListPageProps {
  params: { company: string }
}

function StatusBadge({ status }: { status?: string }) {
  const s = (status || "").toLowerCase()
  const colors =
    s === "approved"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize", colors)}>
      {status || "pending"}
    </span>
  )
}

export default function ColdStorageListPage({ params }: ColdStorageListPageProps) {
  const { company } = params

  const [entries, setEntries] = useState<BulkEntryTransaction[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const [currentPage, setCurrentPage] = useState(1)
  const perPage = 20

  const [deleteTarget, setDeleteTarget] = useState<BulkEntryTransaction | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await bulkEntryApi.list(company, {
        page: currentPage,
        per_page: perPage,
        search: searchQuery || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      })
      setEntries(response.records)
      setTotal(response.total)
    } catch (err) {
      console.error("Failed to fetch bulk entries:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch bulk entries")
    } finally {
      setLoading(false)
    }
  }, [company, currentPage, perPage, searchQuery, fromDate, toDate])

  useEffect(() => {
    const timeout = setTimeout(fetchData, 400)
    return () => clearTimeout(timeout)
  }, [fetchData])

  useEffect(() => { setCurrentPage(1) }, [searchQuery, fromDate, toDate])

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      await bulkEntryApi.remove(company, deleteTarget.transaction_no)
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
  }

  const hasFilters = searchQuery || fromDate || toDate
  const totalPages = Math.ceil(total / perPage)

  return (
    <PermissionGuard module="cold-storage" action="view">
      <div className="p-3 sm:p-4 md:p-6 max-w-[1400px] mx-auto space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight">Cold Storage</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">
              Manage cold storage bulk entries
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button asChild size="sm" className="gap-1.5">
              <Link href={`/${company}/cold-storage/bulk-sticker`}>
                <Plus className="h-4 w-4" />
                <span className="hidden xs:inline">New Entry</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by transaction no, vendor, source..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 flex-1 min-w-[120px]"
            />
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 flex-1 min-w-[120px]"
            />

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
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center px-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No bulk entries found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {hasFilters ? "Try adjusting your filters" : "Create your first bulk entry"}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left font-medium px-4 py-2.5">Transaction No</th>
                        <th className="text-left font-medium px-4 py-2.5">Date</th>
                        <th className="text-left font-medium px-4 py-2.5">Status</th>
                        <th className="text-left font-medium px-4 py-2.5">Vendor</th>
                        <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">Source</th>
                        <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">Warehouse</th>
                        <th className="text-right font-medium px-4 py-2.5">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr key={entry.transaction_no} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium">{entry.transaction_no}</td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {entry.entry_date ? format(new Date(entry.entry_date), "dd MMM yyyy") : "\u2014"}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={entry.status} />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground truncate max-w-[180px]">{entry.vendor_supplier_name || "\u2014"}</td>
                          <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground truncate max-w-[150px]">{entry.source_location || "\u2014"}</td>
                          <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{entry.warehouse || "\u2014"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                <Link href={`/${company}/cold-storage/entry/${entry.transaction_no}`}><Eye className="h-3.5 w-3.5" /></Link>
                              </Button>
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(entry)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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
                  {entries.map((entry) => (
                    <div key={entry.transaction_no} className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{entry.transaction_no}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.entry_date ? format(new Date(entry.entry_date), "dd MMM yyyy") : "\u2014"}
                          </p>
                        </div>
                        <StatusBadge status={entry.status} />
                      </div>
                      <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                        {entry.vendor_supplier_name && <span>{entry.vendor_supplier_name}</span>}
                        {entry.source_location && (<><span>{"\u00b7"}</span><span>{entry.source_location}</span></>)}
                        {entry.warehouse && (<><span>{"\u00b7"}</span><span>{entry.warehouse}</span></>)}
                      </div>
                      <div className="flex items-center gap-1 pt-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 flex-1" asChild>
                          <Link href={`/${company}/cold-storage/entry/${entry.transaction_no}`}><Eye className="h-3 w-3" /> View</Link>
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive flex-shrink-0"
                          onClick={() => setDeleteTarget(entry)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
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
          <div className="flex items-center justify-between relative z-10">
            <p className="text-xs text-muted-foreground">Page {currentPage} of {totalPages} ({total} total)</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="inline-flex items-center justify-center h-9 w-9 rounded-md border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="inline-flex items-center justify-center h-9 w-9 rounded-md border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Delete Dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Bulk Entry</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete entry <span className="font-medium text-foreground">{deleteTarget?.transaction_no}</span>?
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
