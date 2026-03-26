"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ArrowLeft, Edit, Trash2, Printer, Loader2,
  Snowflake, Package, Box, FileText, Clock, CheckCircle2, AlertCircle,
} from "lucide-react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { format } from "date-fns"
import { bulkEntryApi } from "@/lib/api/bulkEntryApiService"
import type { BulkEntryDetailResponse, BulkEntryBox } from "@/types/cold-storage"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { cn } from "@/lib/utils"
import QRCode from "qrcode"

// ── Helpers ──────────────────────────────────────────────────────

interface BulkEntryDetailPageProps {
  params: { company: string; txn: string }
}

function StatusBadge({ status }: { status?: string }) {
  const s = (status || "Pending").toLowerCase()
  const config: Record<string, { label: string; icon: React.ElementType; className: string }> = {
    pending: {
      label: "Pending",
      icon: Clock,
      className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
    },
    approved: {
      label: "Approved",
      icon: CheckCircle2,
      className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300",
    },
  }
  const c = config[s] || config.pending
  const Icon = c.icon
  return (
    <Badge variant="outline" className={cn("gap-1", c.className)}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  )
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === "") return null
  return (
    <div className="space-y-0.5 min-w-0">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium break-words">{value}</p>
    </div>
  )
}

function formatDate(d?: string | null) {
  if (!d) return null
  try {
    return format(new Date(d), "dd MMM yyyy")
  } catch {
    return d
  }
}

// ── Print helpers ────────────────────────────────────────────────

async function buildLabelHtml(
  box: BulkEntryBox,
  company: string,
  transactionNo: string,
  entryDate?: string | null,
) {
  const qrDataString = JSON.stringify({ tx: transactionNo, bi: box.box_id })
  const qrCodeDataURL = await QRCode.toDataURL(qrDataString, {
    width: 170,
    margin: 1,
    errorCorrectionLevel: "M",
  })

  const fmtDate = (d?: string | null) => {
    if (!d) return ""
    try {
      return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })
    } catch {
      return ""
    }
  }

  return `<div class="label">
  <div class="qr"><img src="${qrCodeDataURL}" /></div>
  <div class="info">
    <div>
      <div class="company">${company}</div>
      <div class="txn">${transactionNo}</div>
      <div class="boxid">ID: ${box.box_id}</div>
    </div>
    <div class="item">${box.article_description}</div>
    <div>
      <div class="detail"><b>Box #${box.box_number}</b> | Net: ${box.net_weight ?? "\u2014"}kg | Gross: ${box.gross_weight ?? "\u2014"}kg</div>
      <div class="detail">Date: ${fmtDate(entryDate)}</div>
    </div>
    <div class="lot">${box.lot_number || ""}</div>
  </div>
</div>`
}

const LABEL_STYLES = `
* { margin: 0; padding: 0; box-sizing: border-box; }
@page { size: 4in 2in; margin: 0; padding: 0; }
@media print {
  html, body { width: 4in; overflow: visible; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  * { visibility: visible; }
}
.label { width: 4in; height: 2in; background: white; border: 1px solid #000; display: flex; font-family: Arial, sans-serif; overflow: hidden; page-break-after: always; page-break-inside: avoid; }
.qr { width: 1.5in; height: 2in; display: flex; align-items: center; justify-content: center; padding: 0.08in; flex-shrink: 0; }
.qr img { width: 1.3in; height: 1.3in; }
.info { width: 2.5in; height: 2in; padding: 0.1in 0.12in; font-size: 7.5pt; line-height: 1.3; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; border-left: 1px solid #ccc; }
.company { font-weight: bold; font-size: 8.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.txn { font-family: monospace; font-size: 6.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.boxid { font-family: monospace; font-size: 6pt; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item { font-weight: bold; font-size: 7pt; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
.detail { font-size: 6.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lot { font-family: monospace; border-top: 1px solid #ccc; padding-top: 2px; font-size: 6pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`

function openPrintIframe(bodyContent: string, singlePage: boolean) {
  const iframe = document.createElement("iframe")
  iframe.style.position = "fixed"
  iframe.style.left = "-9999px"
  iframe.style.top = "-9999px"
  iframe.style.width = "0"
  iframe.style.height = "0"
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) return

  const pageStyle = singlePage
    ? "html, body { width: 4in; height: 2in; overflow: hidden; background: white; }"
    : "html, body { width: 4in; overflow: visible; background: white; }"

  doc.open()
  doc.write(`<!DOCTYPE html><html><head><title>Label</title><style>
    ${LABEL_STYLES}
    ${pageStyle}
  </style></head><body>
    ${bodyContent}
    <script>
      window.onload = function() {
        setTimeout(function() {
          window.print();
          window.onafterprint = function() { window.parent.postMessage('print-complete', '*'); };
        }, 300);
      };
    </script>
  </body></html>`)
  doc.close()

  const cleanup = (e: MessageEvent) => {
    if (e.data === "print-complete") {
      window.removeEventListener("message", cleanup)
      if (document.body.contains(iframe)) document.body.removeChild(iframe)
    }
  }
  window.addEventListener("message", cleanup)
  setTimeout(() => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe)
      window.removeEventListener("message", cleanup)
    }
  }, 30000)
}

// ── Page component ───────────────────────────────────────────────

export default function BulkEntryDetailPage({ params }: BulkEntryDetailPageProps) {
  const { company, txn: transactionNo } = params
  const decodedTxn = decodeURIComponent(transactionNo)
  const router = useRouter()

  const [data, setData] = useState<BulkEntryDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [printingBoxId, setPrintingBoxId] = useState<string | null>(null)
  const [printingAll, setPrintingAll] = useState(false)

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true)
        const detail = await bulkEntryApi.getDetail(company, decodedTxn)
        setData(detail)
      } catch (err) {
        console.error("Failed to fetch bulk entry detail:", err)
        setError(err instanceof Error ? err.message : "Failed to load bulk entry")
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [company, decodedTxn])

  // Group boxes by article_description
  const boxesByArticle = useMemo(() => {
    if (!data?.boxes) return new Map<string, BulkEntryBox[]>()
    const map = new Map<string, BulkEntryBox[]>()
    for (const box of data.boxes) {
      const key = box.article_description
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(box)
    }
    return map
  }, [data?.boxes])

  // ── Delete ───────────────────────────────────────────────────
  const handleDelete = async () => {
    try {
      setDeleting(true)
      await bulkEntryApi.remove(company, decodedTxn)
      router.push(`/${company}/cold-storage`)
    } catch (err) {
      console.error("Delete failed:", err)
    } finally {
      setDeleting(false)
    }
  }

  // ── Print single box ────────────────────────────────────────
  const printSingleBox = async (box: BulkEntryBox) => {
    if (!data || !box.box_id) return
    try {
      setPrintingBoxId(box.box_id)
      const html = await buildLabelHtml(box, company, data.transaction.transaction_no, data.transaction.entry_date)
      openPrintIframe(html, true)
    } catch (err) {
      console.error("Print failed:", err)
    } finally {
      setPrintingBoxId(null)
    }
  }

  // ── Print selected boxes ────────────────────────────────────
  const printSelectedBoxes = async (boxes: BulkEntryBox[]) => {
    if (!data || !boxes.length) return
    try {
      setPrintingAll(true)
      const labels = await Promise.all(
        boxes.map((box) =>
          buildLabelHtml(box, company, data.transaction.transaction_no, data.transaction.entry_date)
        )
      )
      openPrintIframe(labels.join("\n"), boxes.length === 1)
    } catch (err) {
      console.error("Print failed:", err)
    } finally {
      setPrintingAll(false)
    }
  }

  // ── Print dialog state ────────────────────────────────────
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [rangeInput, setRangeInput] = useState("")
  const [selectedBoxIds, setSelectedBoxIds] = useState<Set<string>>(new Set())

  // Parse range string like "1-5, 8, 10-15" into a Set of box numbers
  const parseRange = useCallback((input: string): Set<number> => {
    const nums = new Set<number>()
    if (!input.trim()) return nums
    const parts = input.split(",")
    for (const part of parts) {
      const trimmed = part.trim()
      if (!trimmed) continue
      const rangeParts = trimmed.split("-")
      if (rangeParts.length === 2) {
        const start = parseInt(rangeParts[0].trim(), 10)
        const end = parseInt(rangeParts[1].trim(), 10)
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            nums.add(i)
          }
        }
      } else {
        const n = parseInt(trimmed, 10)
        if (!isNaN(n)) nums.add(n)
      }
    }
    return nums
  }, [])

  // When range input changes, update selected box IDs
  const handleRangeChange = useCallback((value: string) => {
    setRangeInput(value)
    if (!data?.boxes) return
    const boxNumbers = parseRange(value)
    if (boxNumbers.size === 0 && value.trim() === "") return // don't clear manual selections on empty
    const newSelected = new Set<string>()
    for (const box of data.boxes) {
      if (boxNumbers.has(box.box_number) && box.box_id) {
        newSelected.add(box.box_id)
      }
    }
    setSelectedBoxIds(newSelected)
  }, [data?.boxes, parseRange])

  const toggleBox = useCallback((boxId: string) => {
    setSelectedBoxIds((prev) => {
      const next = new Set(prev)
      if (next.has(boxId)) next.delete(boxId)
      else next.add(boxId)
      return next
    })
    setRangeInput("") // clear range input when manually toggling
  }, [])

  const selectAll = useCallback(() => {
    if (!data?.boxes) return
    setSelectedBoxIds(new Set(data.boxes.filter((b) => b.box_id).map((b) => b.box_id)))
    setRangeInput("")
  }, [data?.boxes])

  const deselectAll = useCallback(() => {
    setSelectedBoxIds(new Set())
    setRangeInput("")
  }, [])

  const openPrintDialog = useCallback(() => {
    setRangeInput("")
    setSelectedBoxIds(new Set())
    setShowPrintDialog(true)
  }, [])

  const handlePrintSelected = useCallback(async () => {
    if (!data?.boxes) return
    const boxesToPrint = data.boxes.filter((b) => selectedBoxIds.has(b.box_id))
    if (!boxesToPrint.length) return
    setShowPrintDialog(false)
    await printSelectedBoxes(boxesToPrint)
  }, [data?.boxes, selectedBoxIds])

  const allBoxIds = useMemo(() => {
    if (!data?.boxes) return new Set<string>()
    return new Set(data.boxes.filter((b) => b.box_id).map((b) => b.box_id))
  }, [data?.boxes])

  const isAllSelected = selectedBoxIds.size > 0 && selectedBoxIds.size === allBoxIds.size

  // ── Loading state ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-3 sm:p-4 md:p-6 max-w-[1100px] mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="p-3 sm:p-4 md:p-6 max-w-[1100px] mx-auto">
        <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-4 py-3 rounded-lg">
          <Snowflake className="h-4 w-4" />
          <span className="text-sm">{error || "Bulk entry not found"}</span>
        </div>
        <Button
          variant="outline"
          className="mt-4 gap-1.5"
          onClick={() => router.push(`/${company}/cold-storage`)}
        >
          <ArrowLeft className="h-4 w-4" /> Back to list
        </Button>
      </div>
    )
  }

  const txn = data.transaction

  return (
    <PermissionGuard module="cold-storage" action="view">
      <div className="p-3 sm:p-4 md:p-6 max-w-[1100px] mx-auto space-y-3 sm:space-y-4">
        {/* ── Header ────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-start gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 mt-0.5"
              onClick={() => router.push(`/${company}/cold-storage`)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight break-all">
                  {txn.transaction_no}
                </h1>
                <StatusBadge status={txn.status} />
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {formatDate(txn.entry_date) || "\u2014"}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 pl-10 sm:pl-11">
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs sm:text-sm" asChild>
              <Link href={`/${company}/cold-storage/entry/${encodeURIComponent(decodedTxn)}/edit`}>
                <Edit className="h-3.5 w-3.5" /> Edit
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-xs sm:text-sm"
              onClick={openPrintDialog}
              disabled={printingAll || !data.boxes.length}
            >
              {printingAll ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Printer className="h-3.5 w-3.5" />
              )}
              Print Labels
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-xs sm:text-sm text-destructive hover:text-destructive"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </div>

        {/* ── Transaction Info Card ─────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Transaction Information
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              <Field label="Vendor" value={txn.vendor_supplier_name} />
              <Field label="Customer" value={txn.customer_party_name} />
              <Field label="Source" value={txn.source_location} />
              <Field label="Destination" value={txn.destination_location} />
              <Field label="PO Number" value={txn.po_number} />
              <Field label="Purchased By" value={txn.purchased_by} />
              <Field label="Warehouse" value={txn.warehouse} />
              <Field label="Vehicle Number" value={txn.vehicle_number} />
              <Field label="Transporter" value={txn.transporter_name} />
              <Field label="LR Number" value={txn.lr_number} />
              <Field label="Challan" value={txn.challan_number} />
              <Field label="Invoice" value={txn.invoice_number} />
              <Field label="GRN Number" value={txn.grn_number} />
              <Field label="GRN Quantity" value={txn.grn_quantity} />
              <Field label="GRN Date" value={formatDate(txn.system_grn_date)} />
              <Field label="Approval Authority" value={txn.approval_authority} />
              <Field label="Total Amount" value={txn.total_amount} />
              <Field label="Tax" value={txn.tax_amount} />
              <Field label="Discount" value={txn.discount_amount} />
              <Field label="Currency" value={txn.currency} />
            </div>
            {txn.remark && (
              <div className="mt-3 pt-3 border-t">
                <Field label="Remark" value={txn.remark} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Articles Card ─────────────────────────────────────── */}
        {data.articles.length > 0 && (
          <Card>
            <CardHeader className="pb-2 px-3 sm:px-6">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Package className="h-4 w-4 text-muted-foreground" />
                Articles ({data.articles.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-3 sm:px-6">
              {data.articles.map((article, idx) => (
                <div key={article.id || idx} className="p-3 border rounded-lg bg-muted/20 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold break-words">{article.item_description}</p>
                    {article.material_type && (
                      <Badge variant="secondary" className="text-[10px]">
                        {article.material_type}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 text-xs">
                    <Field label="Category" value={article.item_category} />
                    <Field label="Sub-Category" value={article.sub_category} />
                    <Field label="UOM" value={article.uom} />
                    <Field label="Quality Grade" value={article.quality_grade} />
                    <Field label="Quantity" value={article.quantity_units} />
                    <Field label="Net Weight" value={article.net_weight} />
                    <Field label="Total Weight" value={article.total_weight} />
                    <Field label="PO Weight" value={article.po_weight} />
                    <Field label="Lot Number" value={article.lot_number} />
                    <Field label="Mfg Date" value={formatDate(article.manufacturing_date)} />
                    <Field label="Expiry Date" value={formatDate(article.expiry_date)} />
                    <Field label="Unit Rate" value={article.unit_rate} />
                    <Field label="Total Amount" value={article.total_amount} />
                    <Field label="Carton Weight" value={article.carton_weight} />
                    <Field label="Box Count" value={article.box_count} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ── Boxes Card ────────────────────────────────────────── */}
        {data.boxes.length > 0 && (
          <Card>
            <CardHeader className="pb-2 px-3 sm:px-6">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Box className="h-4 w-4 text-muted-foreground" />
                Boxes ({data.boxes.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-3 sm:px-6">
              {Array.from(boxesByArticle.entries()).map(([articleDesc, boxes]) => (
                <div key={articleDesc} className="space-y-2">
                  {/* Article group header */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{articleDesc}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {boxes.length} {boxes.length === 1 ? "box" : "boxes"}
                    </Badge>
                  </div>

                  {/* Desktop rows */}
                  <div className="hidden sm:block space-y-1.5">
                    {boxes.map((box) => (
                      <div
                        key={box.id || `${box.article_description}-${box.box_number}`}
                        className="flex items-center gap-3 p-2 border rounded-lg bg-muted/20"
                      >
                        {/* Box number circle */}
                        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {box.box_number}
                        </div>

                        {/* Box ID */}
                        <span className="text-xs font-mono text-muted-foreground min-w-0 truncate max-w-[180px]">
                          {box.box_id}
                        </span>

                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                          {box.net_weight != null && (
                            <Badge variant="secondary" className="text-[10px]">
                              Net: {box.net_weight}kg
                            </Badge>
                          )}
                          {box.gross_weight != null && (
                            <Badge variant="secondary" className="text-[10px]">
                              Gross: {box.gross_weight}kg
                            </Badge>
                          )}
                          {box.lot_number && (
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {box.lot_number}
                            </Badge>
                          )}
                          {box.status && (
                            <StatusBadge status={box.status} />
                          )}
                        </div>

                        {/* Print button */}
                        {box.box_id ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 flex-shrink-0"
                            title="Print label"
                            onClick={() => printSingleBox(box)}
                            disabled={printingBoxId === box.box_id}
                          >
                            {printingBoxId === box.box_id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Printer className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground w-7 text-center">{"\u2014"}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Mobile cards */}
                  <div className="sm:hidden space-y-2">
                    {boxes.map((box) => (
                      <div
                        key={box.id || `${box.article_description}-${box.box_number}`}
                        className="p-2.5 border rounded-lg bg-muted/20 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                              {box.box_number}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-mono text-muted-foreground truncate">{box.box_id}</p>
                            </div>
                          </div>
                          {box.box_id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 flex-shrink-0"
                              title="Print label"
                              onClick={() => printSingleBox(box)}
                              disabled={printingBoxId === box.box_id}
                            >
                              {printingBoxId === box.box_id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Printer className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {box.net_weight != null && (
                            <Badge variant="secondary" className="text-[10px]">
                              Net: {box.net_weight}kg
                            </Badge>
                          )}
                          {box.gross_weight != null && (
                            <Badge variant="secondary" className="text-[10px]">
                              Gross: {box.gross_weight}kg
                            </Badge>
                          )}
                          {box.lot_number && (
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {box.lot_number}
                            </Badge>
                          )}
                          {box.status && <StatusBadge status={box.status} />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ── Print Dialog ─────────────────────────────────────── */}
        <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Printer className="h-4 w-4" />
                Print Box Labels
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 flex-1 min-h-0">
              {/* Range input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Box Range</Label>
                <Input
                  placeholder="e.g. 1-50, 3, 7-10"
                  value={rangeInput}
                  onChange={(e) => handleRangeChange(e.target.value)}
                  className="h-9 font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Enter box numbers or ranges separated by commas. Or select boxes below.
                </p>
              </div>

              {/* Select all / Deselect all */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {selectedBoxIds.size} of {allBoxIds.size} boxes selected
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={selectAll}
                    disabled={isAllSelected}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={deselectAll}
                    disabled={selectedBoxIds.size === 0}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              {/* Box list grouped by article */}
              <div className="overflow-y-auto max-h-[40vh] border rounded-lg divide-y">
                {Array.from(boxesByArticle.entries()).map(([articleDesc, boxes]) => (
                  <div key={articleDesc}>
                    <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-1.5 border-b">
                      <p className="text-xs font-semibold truncate">{articleDesc}</p>
                    </div>
                    <div className="divide-y">
                      {boxes.map((box) => (
                        <label
                          key={box.id || `${box.article_description}-${box.box_number}`}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors hover:bg-muted/30",
                            selectedBoxIds.has(box.box_id) && "bg-primary/5"
                          )}
                        >
                          <Checkbox
                            checked={selectedBoxIds.has(box.box_id)}
                            onCheckedChange={() => toggleBox(box.box_id)}
                          />
                          <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                            {box.box_number}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono text-muted-foreground truncate">{box.box_id}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {box.net_weight != null && (
                              <span className="text-[10px] text-muted-foreground">{box.net_weight}kg</span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowPrintDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handlePrintSelected}
                disabled={selectedBoxIds.size === 0 || printingAll}
                className="gap-1.5"
              >
                {printingAll ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                Print {selectedBoxIds.size} {selectedBoxIds.size === 1 ? "Label" : "Labels"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete Dialog ─────────────────────────────────────── */}
        <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
          <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Bulk Entry</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{txn.transaction_no}</strong>?
                This will remove all articles and boxes. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PermissionGuard>
  )
}
