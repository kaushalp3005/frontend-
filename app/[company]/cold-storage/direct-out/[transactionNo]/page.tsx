"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { ArrowLeft, Printer, Package, Loader2, AlertCircle, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { useAuthStore } from "@/lib/stores/auth"
import { cn } from "@/lib/utils"

interface DirectOutLine {
  stock_id?: number | string
  item_description?: string
  lot_no?: string
  inward_no?: string
  item_mark?: string
  issue_qty?: number
  uom?: string
  unit?: string
  warehouse?: string
  box_id?: string | null
  transaction_no?: string | null
  weight_kg_per_box?: number | null
}

interface RemovedStockRow {
  id?: number
  box_id?: string
  lot_no?: string
  item_description?: string
  item_mark?: string
  unit?: string
  storage_location?: string
  no_of_cartons?: number
  weight_kg?: number
  total_inventory_kgs?: number
  inward_no?: string
  [key: string]: any
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
  lines?: DirectOutLine[]
  removed_stock_snapshot?: RemovedStockRow[]
  line_count?: number | null
  total_issue_qty?: number | null
  status?: string | null
  created_by?: string | null
  created_at?: string | null
  updated_at?: string | null
}

interface PageProps {
  params: { company: string; transactionNo: string }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

function StatusBadge({ status }: { status?: string | null }) {
  const s = (status || "pending").toLowerCase()
  const colors =
    s === "approved"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      : s === "cancelled"
      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize", colors)}>
      {status || "pending"}
    </span>
  )
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? "—"}</p>
    </div>
  )
}

export default function DirectOutDetailPage({ params }: PageProps) {
  const { company, transactionNo } = params
  const router = useRouter()
  const { accessToken } = useAuthStore()

  // Direct Out follows the navbar company switch (URL [company] segment).
  const activeCompany = company?.toUpperCase() === "CDPL" ? "CDPL" : "CFPL"

  const [record, setRecord] = useState<DirectOutRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRecord = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const url = `${API_URL}/cold-storage/direct-out/${activeCompany}/${encodeURIComponent(transactionNo)}`
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      })
      if (!res.ok) {
        let detail = `HTTP ${res.status}`
        try {
          const body = await res.json()
          const raw = body.detail || body.message || body
          detail = typeof raw === "string" ? raw : JSON.stringify(raw)
        } catch { /* ignore */ }
        throw new Error(detail)
      }
      setRecord(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch record")
    } finally {
      setLoading(false)
    }
  }, [activeCompany, transactionNo, accessToken])

  useEffect(() => { fetchRecord() }, [fetchRecord])

  const lines = record?.lines || []
  const totalQty = lines.reduce((s, l) => s + (Number(l.issue_qty) || 0), 0)
  const totalWeight = lines.reduce(
    (s, l) => s + (Number(l.issue_qty) || 0) * (Number(l.weight_kg_per_box) || 0),
    0,
  )

  return (
    <PermissionGuard module="cold-storage" action="view">
      <div className="p-3 sm:p-4 md:p-6 max-w-[1400px] mx-auto space-y-4 print:p-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight truncate">
                {transactionNo}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Direct Out — Cold Storage ({activeCompany})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href={`/${company}/cold-storage/direct-out/${encodeURIComponent(transactionNo)}/edit`}>
                <Pencil className="h-4 w-4" />
                <span className="hidden sm:inline">Edit</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print</span>
            </Button>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ) : error ? (
          <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : !record ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              Record not found.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary */}
            <Card>
              <CardContent className="p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <StatusBadge status={record.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Created {record.created_at ? format(new Date(record.created_at), "dd MMM yyyy, HH:mm") : "—"}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
                  <Field
                    label="Entry Date"
                    value={record.entry_date ? format(new Date(record.entry_date), "dd MMM yyyy") : null}
                  />
                  <Field label="To Customer" value={record.to_customer} />
                  <Field label="Authority Person" value={record.authority_person} />
                  <Field label="Warehouse" value={record.warehouse} />
                  <Field label="Vehicle No" value={record.vehicle_no} />
                  <Field label="Invoice No" value={record.invoice_no} />
                  <Field label="Items" value={record.line_count ?? lines.length} />
                  <Field
                    label="Total Issue Qty"
                    value={record.total_issue_qty != null ? Number(record.total_issue_qty).toFixed(2) : totalQty}
                  />
                </div>

                {record.remarks && (
                  <div className="space-y-0.5 pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Remarks</p>
                    <p className="text-sm whitespace-pre-wrap">{record.remarks}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Article Entries */}
            <Card>
              <CardContent className="p-0">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Article Entries
                  </h2>
                  <p className="text-xs text-muted-foreground">{lines.length} item(s)</p>
                </div>

                {lines.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No article entries recorded for this Direct Out.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30 border-b">
                        <tr>
                          <th className="text-left font-medium px-3 py-2">Sr</th>
                          <th className="text-left font-medium px-3 py-2">Item Description</th>
                          <th className="text-left font-medium px-3 py-2">Lot No</th>
                          <th className="text-left font-medium px-3 py-2">Inward No</th>
                          <th className="text-left font-medium px-3 py-2">Box ID</th>
                          <th className="text-right font-medium px-3 py-2">Issue Qty</th>
                          <th className="text-left font-medium px-3 py-2">UOM</th>
                          <th className="text-left font-medium px-3 py-2">Unit</th>
                          <th className="text-left font-medium px-3 py-2">Warehouse</th>
                          <th className="text-right font-medium px-3 py-2">Approx. Wt (kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((l, idx) => {
                          const approxWt = (Number(l.issue_qty) || 0) * (Number(l.weight_kg_per_box) || 0)
                          return (
                            <tr key={`${l.box_id || idx}-${idx}`} className="border-b last:border-0 hover:bg-muted/20">
                              <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                              <td className="px-3 py-2 font-medium">
                                {l.item_description || "—"}
                                {l.item_mark && (
                                  <span className="block text-xs text-muted-foreground">{l.item_mark}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 font-mono">{l.lot_no || "—"}</td>
                              <td className="px-3 py-2 text-muted-foreground">{l.inward_no || "—"}</td>
                              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{l.box_id || "—"}</td>
                              <td className="px-3 py-2 text-right">{Number(l.issue_qty || 0)}</td>
                              <td className="px-3 py-2">{l.uom || "—"}</td>
                              <td className="px-3 py-2 text-muted-foreground">{l.unit || "—"}</td>
                              <td className="px-3 py-2 text-muted-foreground">{l.warehouse || "—"}</td>
                              <td className="px-3 py-2 text-right text-muted-foreground">
                                {approxWt ? approxWt.toFixed(2) : "—"}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot className="bg-muted/30 border-t font-medium">
                        <tr>
                          <td colSpan={5} className="px-3 py-2 text-right">Totals</td>
                          <td className="px-3 py-2 text-right">{totalQty}</td>
                          <td colSpan={3} />
                          <td className="px-3 py-2 text-right text-muted-foreground">
                            {totalWeight ? `${totalWeight.toFixed(2)} kg` : "—"}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Boxes actually removed from cold_stocks (snapshot) */}
            {record.removed_stock_snapshot && record.removed_stock_snapshot.length > 0 && (
              <Card>
                <CardContent className="p-0">
                  <div className="px-4 py-3 border-b flex items-center justify-between">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Boxes Removed from Stock
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {record.removed_stock_snapshot.length} box(es)
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30 border-b">
                        <tr>
                          <th className="text-left font-medium px-3 py-2">Sr</th>
                          <th className="text-left font-medium px-3 py-2">Box ID</th>
                          <th className="text-left font-medium px-3 py-2">Item Description</th>
                          <th className="text-left font-medium px-3 py-2">Lot No</th>
                          <th className="text-left font-medium px-3 py-2">Inward No</th>
                          <th className="text-left font-medium px-3 py-2">Unit</th>
                          <th className="text-left font-medium px-3 py-2">Storage</th>
                          <th className="text-right font-medium px-3 py-2">Weight (kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {record.removed_stock_snapshot.map((b, idx) => (
                          <tr key={`${b.id ?? b.box_id ?? idx}-${idx}`} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono text-xs">{b.box_id || "—"}</td>
                            <td className="px-3 py-2 font-medium">
                              {b.item_description || "—"}
                              {b.item_mark && (
                                <span className="block text-xs text-muted-foreground">{b.item_mark}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono">{b.lot_no || "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{b.inward_no || "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{b.unit || "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{b.storage_location || "—"}</td>
                            <td className="px-3 py-2 text-right text-muted-foreground">
                              {b.weight_kg != null ? Number(b.weight_kg).toFixed(2) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/30 border-t font-medium">
                        <tr>
                          <td colSpan={7} className="px-3 py-2 text-right">Total Weight</td>
                          <td className="px-3 py-2 text-right">
                            {record.removed_stock_snapshot
                              .reduce((s, b) => s + (Number(b.weight_kg) || 0), 0)
                              .toFixed(2)} kg
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </PermissionGuard>
  )
}
