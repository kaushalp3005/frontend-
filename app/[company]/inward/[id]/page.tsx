"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import {
  ArrowLeft, Edit, CheckCircle2, XCircle, Clock, Trash2,
  Package, Box, AlertCircle, Loader2, Truck, FileText,
  User, MapPin, CreditCard, Printer,
} from "lucide-react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { format } from "date-fns"
import {
  inwardApiService,
  type Company,
  type InwardStatus,
  type InwardDetailResponse,
} from "@/types/inward"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { cn } from "@/lib/utils"
import QRCode from "qrcode"

interface InwardDetailPageProps {
  params: { company: Company; id: string }
}

function StatusBadge({ status }: { status: InwardStatus }) {
  const config = {
    pending: { label: "Pending Approval", icon: Clock, className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300" },
    approved: { label: "Approved", icon: CheckCircle2, className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300" },
    rejected: { label: "Rejected", icon: XCircle, className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300" },
  }
  const c = config[status] || config.pending
  const Icon = c.icon
  return (
    <Badge variant="outline" className={cn("gap-1", c.className)}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  )
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div className="space-y-0.5 min-w-0">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium break-words">{value}</p>
    </div>
  )
}

export default function InwardDetailPage({ params }: InwardDetailPageProps) {
  const { company, id: transactionNo } = params
  const router = useRouter()

  const [data, setData] = useState<InwardDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [printingBoxId, setPrintingBoxId] = useState<string | null>(null)

  useEffect(() => {
    if (!transactionNo || transactionNo === "undefined") {
      setError("Invalid transaction number")
      setLoading(false)
      return
    }
    const fetchDetail = async () => {
      try {
        setLoading(true)
        const detail = await inwardApiService.getInwardDetail(company, transactionNo)
        setData(detail)
      } catch (err) {
        console.error("Failed to fetch detail:", err)
        setError(err instanceof Error ? err.message : "Failed to load entry")
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [company, transactionNo])

  const handleDelete = async () => {
    try {
      setDeleting(true)
      await inwardApiService.deleteInward(company, transactionNo)
      router.push(`/${company}/inward`)
    } catch (err) {
      console.error("Delete failed:", err)
    } finally {
      setDeleting(false)
    }
  }

  const handleReprintLabel = async (box: typeof boxes[number]) => {
    if (!data || !box.box_id) return
    const txn = data.transaction
    const article = data.articles.find((a) => a.item_description === box.article_description)

    try {
      setPrintingBoxId(box.box_id)

      const qrDataString = JSON.stringify({ tx: txn.transaction_no, bi: box.box_id })
      const qrCodeDataURL = await QRCode.toDataURL(qrDataString, {
        width: 170,
        margin: 1,
        errorCorrectionLevel: "M",
      })

      const formatDate = (d: string) => {
        if (!d) return ""
        try {
          return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })
        } catch { return "" }
      }

      const iframe = document.createElement("iframe")
      iframe.style.position = "fixed"
      iframe.style.left = "-9999px"
      iframe.style.top = "-9999px"
      iframe.style.width = "0"
      iframe.style.height = "0"
      document.body.appendChild(iframe)

      const doc = iframe.contentWindow?.document
      if (!doc) return

      doc.open()
      doc.write(`<!DOCTYPE html><html><head><title>Label</title><style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 4in; height: 2in; overflow: hidden; background: white; }
        @page { size: 4in 2in; margin: 0; padding: 0; }
        @media print {
          html, body { width: 4in; height: 2in; overflow: hidden; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          * { visibility: visible; }
        }
        .label { width: 4in; height: 2in; background: white; border: 1px solid #000; display: flex; font-family: Arial, sans-serif; page-break-after: avoid; page-break-inside: avoid; }
        .qr { width: 2in; height: 2in; display: flex; align-items: center; justify-content: center; padding: 0.1in; }
        .qr img { width: 1.7in; height: 1.7in; }
        .info { width: 2in; height: 2in; padding: 0.08in; font-size: 8pt; line-height: 1.2; display: flex; flex-direction: column; justify-content: space-between; }
        .company { font-weight: bold; font-size: 9pt; }
        .txn { font-family: monospace; font-size: 7pt; }
        .boxid { font-family: monospace; font-size: 6.5pt; color: #555; }
        .item { font-weight: bold; font-size: 7.5pt; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .detail { font-size: 7pt; }
        .exp { color: red; }
        .lot { font-family: monospace; border-top: 1px solid #ccc; padding-top: 2px; font-size: 6.5pt; }
      </style></head><body>
        <div class="label">
          <div class="qr"><img src="${qrCodeDataURL}" /></div>
          <div class="info">
            <div>
              <div class="company">${company}</div>
              <div class="txn">${txn.transaction_no}</div>
              <div class="boxid">ID: ${box.box_id}</div>
            </div>
            <div class="item">${box.article_description}</div>
            <div>
              <div class="detail"><b>Box #${box.box_number}</b> &nbsp; Net: ${box.net_weight ?? "\u2014"}kg &nbsp; Gross: ${box.gross_weight ?? "\u2014"}kg</div>
              ${box.count ? `<div class="detail">Count: ${box.count}</div>` : ""}
              <div class="detail">Entry: ${formatDate(txn.entry_date)}</div>
              ${article?.expiry_date ? `<div class="detail exp">Exp: ${formatDate(article.expiry_date)}</div>` : ""}
            </div>
            <div class="lot">${(box.lot_number || article?.lot_number || "").substring(0, 20)}${txn.customer_party_name ? ` \u00b7 ${txn.customer_party_name}` : ""}</div>
          </div>
        </div>
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
          document.body.removeChild(iframe)
        }
      }
      window.addEventListener("message", cleanup)

      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe)
          window.removeEventListener("message", cleanup)
        }
      }, 30000)
    } catch (err) {
      console.error("Reprint failed:", err)
    } finally {
      setPrintingBoxId(null)
    }
  }

  if (loading) {
    return (
      <div className="p-3 sm:p-4 md:p-6 max-w-[1100px] mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-3 sm:p-4 md:p-6 max-w-[1100px] mx-auto">
        <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-4 py-3 rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error || "Entry not found"}</span>
        </div>
        <Button variant="outline" className="mt-4 gap-1.5" onClick={() => router.push(`/${company}/inward`)}>
          <ArrowLeft className="h-4 w-4" /> Back to list
        </Button>
      </div>
    )
  }

  const { transaction: txn, articles, boxes, edit_logs } = data
  const isPending = txn.status === "pending"

  // Build lookup: Map<box_id, Set<field_name>> for edited fields
  const editedFields = new Map<string, Set<string>>()
  if (edit_logs) {
    for (const log of edit_logs) {
      if (!editedFields.has(log.box_id)) editedFields.set(log.box_id, new Set())
      editedFields.get(log.box_id)!.add(log.field_name)
    }
  }
  const isEdited = (boxId: string | undefined, field: string) =>
    boxId ? editedFields.get(boxId)?.has(field) ?? false : false

  return (
    <PermissionGuard module="inward" action="view">
      <div className="p-3 sm:p-4 md:p-6 max-w-[1100px] mx-auto space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-start gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 mt-0.5" onClick={() => router.push(`/${company}/inward`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight break-all">{txn.transaction_no}</h1>
                <StatusBadge status={txn.status} />
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Created {txn.entry_date ? format(new Date(txn.entry_date), "dd MMM yyyy") : "—"}
                {txn.approved_by && ` · Approved by ${txn.approved_by}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-10 sm:pl-11">
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs sm:text-sm" asChild>
              <Link href={`/${company}/inward/${transactionNo}/edit`}>
                <Edit className="h-3.5 w-3.5" /> Edit
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs sm:text-sm" asChild>
              <Link href={`/${company}/inward/${transactionNo}/approve`}>
                <CheckCircle2 className="h-3.5 w-3.5" /> {isPending ? "Review" : "Edit & Review"}
              </Link>
            </Button>
            {isPending && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs sm:text-sm text-destructive hover:text-destructive"
                onClick={() => setShowDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            )}
          </div>
        </div>

        {/* Rejection remark */}
        {txn.status === "rejected" && txn.rejection_remark && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 sm:px-4 py-3 rounded-lg">
            <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Rejected</p>
              <p className="text-sm">{txn.rejection_remark}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Left column — Transaction details */}
          <div className="lg:col-span-2 space-y-3 sm:space-y-4">
            {/* Party Information */}
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Party Information
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  <Field label="Vendor / Supplier" value={txn.vendor_supplier_name} />
                  <Field label="Customer / Party" value={txn.customer_party_name} />
                  <Field label="Indentor" value={txn.purchased_by} />
                  <Field label="PO Number" value={txn.po_number} />
                  <Field label="Currency" value={txn.currency} />
                  <Field label="Approval Authority" value={txn.approval_authority} />
                </div>
              </CardContent>
            </Card>

            {/* Locations */}
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Locations & Transport
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  <Field label="Source" value={txn.source_location} />
                  <Field label="Destination" value={txn.destination_location} />
                  <Field label="Vehicle No." value={txn.vehicle_number} />
                  <Field label="Transporter" value={txn.transporter_name} />
                  <Field label="LR Number" value={txn.lr_number} />
                </div>
              </CardContent>
            </Card>

            {/* Documents */}
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  <Field label="Challan No." value={txn.challan_number} />
                  <Field label="Invoice No." value={txn.invoice_number} />
                  <Field label="GRN No." value={txn.grn_number} />
                  <Field label="GRN Qty" value={txn.grn_quantity} />
                  <Field label="GRN Date" value={txn.system_grn_date} />
                  <Field label="Service Invoice" value={txn.service_invoice_number} />
                  <Field label="DN Number" value={txn.dn_number} />
                </div>
                {txn.remark && (
                  <div className="mt-3 pt-3 border-t">
                    <Field label="Remark" value={txn.remark} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Articles */}
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Articles ({articles.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-3 sm:px-6">
                {articles.map((article, idx) => (
                  <div key={article.id || idx} className="p-3 border rounded-lg bg-muted/20 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium break-words min-w-0">{article.item_description}</p>
                      {article.sku_id && (
                        <Badge variant="secondary" className="text-xs flex-shrink-0">SKU: {article.sku_id}</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 text-xs">
                      <Field label="Material Type" value={article.material_type} />
                      <Field label="Category" value={article.item_category} />
                      <Field label="Sub-category" value={article.sub_category} />
                      <Field label="Quality" value={article.quality_grade} />
                      <Field label="UOM" value={article.uom} />
                      <Field label="Qty Units" value={article.quantity_units} />
                      <Field label="Net Weight" value={article.net_weight ? `${article.net_weight} kg` : undefined} />
                      <Field label="Total Weight" value={article.total_weight ? `${article.total_weight} kg` : undefined} />
                      <Field label="PO Weight" value={article.po_weight ? `${article.po_weight} kg` : undefined} />
                      <Field label="Lot Number" value={article.lot_number} />
                      <Field label="Mfg Date" value={article.manufacturing_date} />
                      <Field label="Expiry Date" value={article.expiry_date} />
                      <Field label="Unit Rate" value={article.unit_rate} />
                      <Field label="Total Amount" value={article.total_amount} />
                      <Field label="Carton Weight" value={article.carton_weight ? `${article.carton_weight} kg` : undefined} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Boxes */}
            {boxes.length > 0 && (
              <Card>
                <CardHeader className="pb-2 px-3 sm:px-6">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Box className="h-4 w-4 text-muted-foreground" />
                    Boxes ({boxes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left font-medium px-3 py-2">Article</th>
                          <th className="text-left font-medium px-3 py-2">Box #</th>
                          <th className="text-right font-medium px-3 py-2">Net Wt</th>
                          <th className="text-right font-medium px-3 py-2">Gross Wt</th>
                          <th className="text-left font-medium px-3 py-2">Lot</th>
                          <th className="text-right font-medium px-3 py-2">Count</th>
                          <th className="text-center font-medium px-3 py-2 w-[60px]">Print</th>
                        </tr>
                      </thead>
                      <tbody>
                        {boxes.map((box) => (
                          <tr key={box.id || `${box.article_description}-${box.box_number}`} className="border-b last:border-0">
                            <td className="px-3 py-2 text-muted-foreground truncate max-w-[150px]">{box.article_description}</td>
                            <td className="px-3 py-2">{box.box_number}</td>
                            <td className={cn("px-3 py-2 text-right", isEdited(box.box_id, "net_weight") && "bg-red-100 dark:bg-red-900/40")}>{box.net_weight ?? "—"}</td>
                            <td className={cn("px-3 py-2 text-right", isEdited(box.box_id, "gross_weight") && "bg-red-100 dark:bg-red-900/40")}>{box.gross_weight ?? "—"}</td>
                            <td className={cn("px-3 py-2 text-muted-foreground", isEdited(box.box_id, "lot_number") && "bg-red-100 dark:bg-red-900/40")}>{box.lot_number || "—"}</td>
                            <td className={cn("px-3 py-2 text-right", isEdited(box.box_id, "count") && "bg-red-100 dark:bg-red-900/40")}>{box.count ?? "—"}</td>
                            <td className="px-3 py-2 text-center">
                              {box.box_id ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="Reprint QR label"
                                  onClick={() => handleReprintLabel(box)}
                                  disabled={printingBoxId === box.box_id}
                                >
                                  {printingBoxId === box.box_id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Printer className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile cards */}
                  <div className="sm:hidden space-y-2">
                    {boxes.map((box) => (
                      <div key={box.id || `${box.article_description}-${box.box_number}`} className="p-2.5 border rounded-lg bg-muted/20 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{box.article_description}</p>
                            <p className="text-[11px] text-muted-foreground">Box #{box.box_number}</p>
                          </div>
                          {box.box_id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 flex-shrink-0"
                              title="Reprint QR label"
                              onClick={() => handleReprintLabel(box)}
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
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <div className={cn(isEdited(box.box_id, "net_weight") && "bg-red-100 dark:bg-red-900/40 rounded px-1")}><span className="text-muted-foreground">Net:</span> {box.net_weight ?? "—"} kg</div>
                          <div className={cn(isEdited(box.box_id, "gross_weight") && "bg-red-100 dark:bg-red-900/40 rounded px-1")}><span className="text-muted-foreground">Gross:</span> {box.gross_weight ?? "—"} kg</div>
                          {box.lot_number && <div className={cn(isEdited(box.box_id, "lot_number") && "bg-red-100 dark:bg-red-900/40 rounded px-1")}><span className="text-muted-foreground">Lot:</span> {box.lot_number}</div>}
                          {box.count != null && <div className={cn(isEdited(box.box_id, "count") && "bg-red-100 dark:bg-red-900/40 rounded px-1")}><span className="text-muted-foreground">Count:</span> {box.count}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column — Summary */}
          <div className="space-y-3 sm:space-y-4">
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  Financial Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-3 sm:px-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-medium">
                    {txn.total_amount != null
                      ? `${txn.currency || "INR"} ${txn.total_amount.toLocaleString()}`
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{txn.tax_amount != null ? txn.tax_amount.toLocaleString() : "—"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span>{txn.discount_amount != null ? txn.discount_amount.toLocaleString() : "—"}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">PO Quantity</span>
                  <span className="font-medium">{txn.po_quantity ?? "—"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Articles</span>
                  <span className="font-medium">{articles.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Boxes</span>
                  <span className="font-medium">{boxes.length}</span>
                </div>
              </CardContent>
            </Card>

            {/* Approval info */}
            {(txn.approved_by || txn.approved_at) && (
              <Card>
                <CardHeader className="pb-2 px-3 sm:px-6">
                  <CardTitle className="text-sm">Approval Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm px-3 sm:px-6">
                  {txn.approved_by && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Approved By</span>
                      <span className="font-medium">{txn.approved_by}</span>
                    </div>
                  )}
                  {txn.approved_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Approved At</span>
                      <span>{format(new Date(txn.approved_at), "dd MMM yyyy HH:mm")}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Delete Dialog */}
        <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
          <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Entry</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{txn.transaction_no}</strong>? This cannot be undone.
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
