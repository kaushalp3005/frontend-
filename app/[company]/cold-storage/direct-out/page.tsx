"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import {
  Plus, ArrowLeft, Search, X, ChevronLeft, ChevronRight,
  Package, LogOut, Eye, Trash2, Loader2,
} from "lucide-react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { format } from "date-fns"
import { PermissionGuard } from "@/components/auth/permission-gate"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useAuthStore } from "@/lib/stores/auth"
import { useToast } from "@/hooks/use-toast"
import { getColdWarehouseCodes } from "@/lib/constants/warehouses"

interface DirectOutListPageProps {
  params: { company: string }
}

interface DirectOutRecord {
  id: number
  transaction_no: string
  transaction_type: string
  company?: string | null
  entry_date?: string | null
  authority_person?: string | null
  to_customer?: string | null
  warehouse?: string | null
  vehicle_no?: string | null
  invoice_no?: string | null
  remarks?: string | null
  lines?: any[]
  line_count?: number | null
  total_issue_qty?: number | null
  status?: string | null
  created_by?: string | null
  created_at?: string | null
  updated_at?: string | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export default function ColdStorageDirectOutListPage({ params }: DirectOutListPageProps) {
  const { company } = params
  const { accessToken, user } = useAuthStore()
  const { toast } = useToast()

  // Direct Out follows the navbar company switch (URL [company] segment).
  const activeCompany = company?.toUpperCase() === "CDPL" ? "CDPL" : "CFPL"

  const DELETE_ALLOWED_EMAIL = "yash@candorfoods.in"
  const canDelete = user?.email?.toLowerCase() === DELETE_ALLOWED_EMAIL
  const [deleteTarget, setDeleteTarget] = useState<DirectOutRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [records, setRecords] = useState<DirectOutRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all")

  const [currentPage, setCurrentPage] = useState(1)
  const perPage = 20

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const qs = new URLSearchParams()
      qs.set("page", String(currentPage))
      qs.set("per_page", String(perPage))
      if (searchQuery) qs.set("search", searchQuery)
      if (fromDate) qs.set("from_date", fromDate)
      if (toDate) qs.set("to_date", toDate)
      if (warehouseFilter !== "all") qs.set("warehouse", warehouseFilter)

      const url = `${API_URL}/cold-storage/direct-out/${activeCompany}?${qs.toString()}`
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      })

      if (!response.ok) {
        let detail = `HTTP ${response.status}`
        try {
          const body = await response.json()
          const raw = body.detail || body.message || body
          detail = typeof raw === "string" ? raw : JSON.stringify(raw)
        } catch {
          // ignore
        }
        throw new Error(detail)
      }

      const data = await response.json()
      setRecords(data.records || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error("Failed to fetch direct out records:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch records")
    } finally {
      setLoading(false)
    }
  }, [activeCompany, currentPage, perPage, searchQuery, fromDate, toDate, warehouseFilter, accessToken])

  useEffect(() => {
    const timeout = setTimeout(fetchData, 400)
    return () => clearTimeout(timeout)
  }, [fetchData])

  useEffect(() => {
    setCurrentPage(1)
  }, [activeCompany, searchQuery, fromDate, toDate, warehouseFilter])

  const clearFilters = () => {
    setSearchQuery("")
    setFromDate("")
    setToDate("")
    setWarehouseFilter("all")
  }

  const hasFilters = searchQuery || fromDate || toDate || warehouseFilter !== "all"
  const totalPages = Math.ceil(total / perPage)

  // View now navigates to the detail page (handled per-row via Link)

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const url = `${API_URL}/cold-storage/direct-out/${activeCompany}/${encodeURIComponent(deleteTarget.transaction_no)}`
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          "X-User-Email": user?.email || "",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      })
      if (!response.ok) {
        let detail = `HTTP ${response.status}`
        try {
          const body = await response.json()
          const raw = body.detail || body.message || body
          detail = typeof raw === "string" ? raw : JSON.stringify(raw)
        } catch { /* ignore */ }
        throw new Error(detail)
      }
      toast({
        title: "Direct Out reverted",
        description: `${deleteTarget.transaction_no} has been deleted.`,
      })
      setDeleteTarget(null)
      fetchData()
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <PermissionGuard module="cold-storage" action="view">
      <div className="p-3 sm:p-4 md:p-6 max-w-[1400px] mx-auto space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link href={`/${company}/cold-storage`}>
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Cold Storage</span>
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight">
                Direct Out — Cold Storage
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">
                Stock issued directly to customers / parties
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              asChild
              size="sm"
              className="gap-1.5 bg-orange-600 hover:bg-orange-700 text-white"
            >
              <Link href={`/${company}/cold-storage/direct-out/create`}>
                <Plus className="h-4 w-4" />
                <span>New Direct Out</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by transaction no, customer, invoice no..."
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

            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <SelectTrigger className="h-9 w-[140px] flex-shrink-0">
                <SelectValue placeholder="Warehouse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {getColdWarehouseCodes().map((code) => (
                  <SelectItem key={code} value={code}>{code}</SelectItem>
                ))}
              </SelectContent>
            </Select>

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
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center px-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <LogOut className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No direct out records found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {hasFilters ? "Try adjusting your filters" : "Create your first direct out entry"}
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
                        <th className="text-left font-medium px-4 py-2.5">To Customer</th>
                        <th className="text-left font-medium px-4 py-2.5">Warehouse</th>
                        <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">Invoice No</th>
                        <th className="text-right font-medium px-4 py-2.5">Items</th>
                        <th className="text-right font-medium px-4 py-2.5">Total Qty</th>
                        <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">Authority Person</th>
                        <th className="text-right font-medium px-4 py-2.5">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((rec) => (
                        <tr key={rec.transaction_no} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium">{rec.transaction_no}</td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {rec.entry_date ? format(new Date(rec.entry_date), "dd MMM yyyy") : "—"}
                          </td>
                          <td className="px-4 py-3 truncate max-w-[200px]">{rec.to_customer || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{rec.warehouse || "—"}</td>
                          <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{rec.invoice_no || "—"}</td>
                          <td className="px-4 py-3 text-right">{rec.line_count ?? rec.lines?.length ?? 0}</td>
                          <td className="px-4 py-3 text-right">{rec.total_issue_qty != null ? Number(rec.total_issue_qty).toFixed(2) : "—"}</td>
                          <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground truncate max-w-[150px]">{rec.authority_person || "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                asChild
                                variant="ghost" size="icon"
                                className="h-7 w-7"
                                title="View"
                              >
                                <Link href={`/${company}/cold-storage/direct-out/${encodeURIComponent(rec.transaction_no)}`}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
                              {canDelete && (
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteTarget(rec)}
                                  title="Revert / delete this Direct Out"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="md:hidden divide-y">
                  {records.map((rec) => (
                    <div key={rec.transaction_no} className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{rec.transaction_no}</p>
                          <p className="text-xs text-muted-foreground">
                            {rec.entry_date ? format(new Date(rec.entry_date), "dd MMM yyyy") : "—"}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {rec.line_count ?? rec.lines?.length ?? 0} item(s)
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {rec.to_customer && <div><span className="font-medium text-foreground">To:</span> {rec.to_customer}</div>}
                        {rec.warehouse && <div><span className="font-medium text-foreground">Warehouse:</span> {rec.warehouse}</div>}
                        {rec.invoice_no && <div><span className="font-medium text-foreground">Invoice:</span> {rec.invoice_no}</div>}
                        {rec.authority_person && <div><span className="font-medium text-foreground">Authority:</span> {rec.authority_person}</div>}
                        <div><span className="font-medium text-foreground">Total Qty:</span> {rec.total_issue_qty != null ? Number(rec.total_issue_qty).toFixed(2) : "—"}</div>
                      </div>
                      <div className="flex items-center gap-1 pt-1">
                        <Button asChild variant="ghost" size="sm" className="h-7 text-xs gap-1 flex-1">
                          <Link href={`/${company}/cold-storage/direct-out/${encodeURIComponent(rec.transaction_no)}`}>
                            <Eye className="h-3 w-3" /> View
                          </Link>
                        </Button>
                        {canDelete && (
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive flex-shrink-0"
                            onClick={() => setDeleteTarget(rec)}
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

        {/* Delete confirmation dialog (only reachable when canDelete) */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Revert Direct Out</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete Direct Out{" "}
                <span className="font-medium text-foreground">{deleteTarget?.transaction_no}</span>?
                This permanently removes the record from the database. This action cannot be undone.
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
