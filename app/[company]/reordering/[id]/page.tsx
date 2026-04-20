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
  ArrowLeft, Edit, CheckCircle2, Clock, Trash2,
  Package, Box, AlertCircle, Loader2, FileText, Printer,
} from "lucide-react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { format } from "date-fns"
import { rtvApi } from "@/lib/api/rtvApiService"
import type { RTVWithDetails, RTVStatus, RTVBox } from "@/types/rtv"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { cn } from "@/lib/utils"
import QRCode from "qrcode"

interface RTVDetailPageProps {
  params: { company: string; id: string }
}

function StatusBadge({ status }: { status: RTVStatus }) {
  const config: Record<string, { label: string; icon: React.ElementType; className: string }> = {
    Pending: { label: "Pending", icon: Clock, className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300" },
    Approved: { label: "Approved", icon: CheckCircle2, className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300" },
  }
  const c = config[status] || config.Pending
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

export default function RTVDetailPage({ params }: RTVDetailPageProps) {
  const { company, id: rtvIdStr } = params
  const rtvId = parseInt(rtvIdStr, 10)
  const router = useRouter()

  const [data, setData] = useState<RTVWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [printingBoxId, setPrintingBoxId] = useState<string | null>(null)

  useEffect(() => {
    if (isNaN(rtvId)) {
      setError("Invalid RTV ID")
      setLoading(false)
      return
    }
    const fetchDetail = async () => {
      try {
        setLoading(true)
        const detail = await rtvApi.getRTVDetail(company, rtvId)
        setData(detail)
      } catch (err) {
        console.error("Failed to fetch detail:", err)
        setError(err instanceof Error ? err.message : "Failed to load RTV")
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [company, rtvId])

  const handleDelete = async () => {
    try {
      setDeleting(true)
      await rtvApi.deleteRTV(company, rtvId)
      router.push(`/${company}/reordering`)
    } catch (err) {
      console.error("Delete failed:", err)
    } finally {
      setDeleting(false)
    }
  }

  const handleReprintLabel = async (box: RTVBox) => {
    if (!data || !box.box_id) return

    try {
      setPrintingBoxId(box.box_id)

      const qrDataString = JSON.stringify({ rtv: data.rtv_id, bi: box.box_id })
      const qrCodeDataURL = await QRCode.toDataURL(qrDataString, {
        width: 170,
        margin: 1,
        errorCorrectionLevel: "M",
      })

      const formatDate = (d: string | null) => {
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
        .lot { font-family: monospace; border-top: 1px solid #ccc; padding-top: 2px; font-size: 6.5pt; }
      </style></head><body>
        <div class="label">
          <div class="qr"><img src="${qrCodeDataURL}" /></div>
          <div class="info">
            <div>
              <div class="company">${company}</div>
              <div class="txn">${data.rtv_id}</div>
              <div class="boxid">ID: ${box.box_id}</div>
            </div>
            <div class="item">${box.article_description}</div>
            <div>
              <div class="detail"><b>Box #${box.box_number}</b> &nbsp; Net: ${box.net_weight ?? "\u2014"}kg &nbsp; Gross: ${box.gross_weight ?? "\u2014"}kg</div>
              ${box.count ? `<div class="detail">Count: ${box.count}</div>` : ""}
              <div class="detail">Date: ${formatDate(data.rtv_date)}</div>
            </div>
            <div class="lot">${data.customer || ""}</div>
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
          <span className="text-sm">{error || "RTV not found"}</span>
        </div>
        <Button variant="outline" className="mt-4 gap-1.5" onClick={() => router.push(`/${company}/reordering`)}>
          <ArrowLeft className="h-4 w-4" /> Back to list
        </Button>
      </div>
    )
  }

  const isPending = data.status === "Pending"

  return (
    <PermissionGuard module="reordering" action="view">
      <div className="p-3 sm:p-4 md:p-6 max-w-[1100px] mx-auto space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-start gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 mt-0.5" onClick={() => router.push(`/${company}/reordering`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight break-all">{data.rtv_id}</h1>
                <StatusBadge status={data.status} />
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Created {data.created_ts ? format(new Date(data.created_ts), "dd MMM yyyy HH:mm") : "\u2014"}
                {data.created_by && ` by ${data.created_by}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-10 sm:pl-11">
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs sm:text-sm" asChild>
              <Link href={`/${company}/reordering/${rtvId}/approve`}>
                <CheckCircle2 className="h-3.5 w-3.5" /> {isPending ? "Review & Approve" : "Review & Edit"}
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-3 sm:space-y-4">
            {/* RTV Information */}
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  RTV Information
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  <Field label="Factory Unit" value={data.factory_unit} />
                  <Field label="Customer" value={data.customer} />
                  <Field label="Invoice Number" value={data.invoice_number} />
                  <Field label="Challan No" value={data.challan_no} />
                  <Field label="DN No" value={data.dn_no} />
                  <Field label="Sales POC" value={data.sales_poc} />
                  <Field label="RTV Date" value={data.rtv_date ? format(new Date(data.rtv_date), "dd MMM yyyy") : null} />
                  <Field label="Vehicle Number" value={data.vehicle_number} />
                  <Field label="Transporter" value={data.transporter_name} />
                  <Field label="Driver Name" value={data.driver_name} />
                  <Field label="Inward Manager" value={data.inward_manager} />
                </div>
                {data.remark && (
                  <div className="mt-3 pt-3 border-t">
                    <Field label="Remark" value={data.remark} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lines */}
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Line Items ({data.lines.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-3 sm:px-6">
                {data.lines.map((line, idx) => (
                  <div key={line.id || idx} className="p-3 border rounded-lg bg-muted/20 space-y-2">
                    <p className="text-sm font-medium break-words">{line.item_description}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 text-xs">
                      <Field label="Material Type" value={line.material_type} />
                      <Field label="Item Category" value={line.item_category} />
                      <Field label="Sub Category" value={line.sub_category} />
                      <Field label="Sale Group" value={line.sale_group} />
                      <Field label="UOM" value={line.uom} />
                      <Field label="Qty" value={line.qty} />
                      <Field label="Rate" value={line.rate} />
                      <Field label="Value" value={line.value} />
                      <Field label="Carton Weight" value={line.carton_weight} />
                      <Field label="Net Weight" value={line.net_weight} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Boxes */}
            {data.boxes.length > 0 && (
              <Card>
                <CardHeader className="pb-2 px-3 sm:px-6">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Box className="h-4 w-4 text-muted-foreground" />
                    Boxes ({data.boxes.length})
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
                          <th className="text-right font-medium px-3 py-2">Conv.</th>
                          <th className="text-right font-medium px-3 py-2">Net Wt</th>
                          <th className="text-right font-medium px-3 py-2">Gross Wt</th>
                          <th className="text-right font-medium px-3 py-2">Count</th>
                          <th className="text-center font-medium px-3 py-2 w-[60px]">Print</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.boxes.map((box) => (
                          <tr key={box.id || `${box.article_description}-${box.box_number}`} className="border-b last:border-0">
                            <td className="px-3 py-2 text-muted-foreground truncate max-w-[150px]">{box.article_description}</td>
                            <td className="px-3 py-2">{box.box_number}</td>
                            <td className="px-3 py-2 text-right">{box.conversion ?? "\u2014"}</td>
                            <td className="px-3 py-2 text-right">{box.net_weight ?? "\u2014"}</td>
                            <td className="px-3 py-2 text-right">{box.gross_weight ?? "\u2014"}</td>
                            <td className="px-3 py-2 text-right">{box.count ?? "\u2014"}</td>
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
                                <span className="text-xs text-muted-foreground">\u2014</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile cards */}
                  <div className="sm:hidden space-y-2">
                    {data.boxes.map((box) => (
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
                          {box.conversion && <div><span className="text-muted-foreground">Conv:</span> {box.conversion}</div>}
                          <div><span className="text-muted-foreground">Net:</span> {box.net_weight ?? "\u2014"} kg</div>
                          <div><span className="text-muted-foreground">Gross:</span> {box.gross_weight ?? "\u2014"} kg</div>
                          {box.count != null && <div><span className="text-muted-foreground">Count:</span> {box.count}</div>}
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
                <CardTitle className="text-sm">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-3 sm:px-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Line Items</span>
                  <span className="font-medium">{data.lines.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Boxes</span>
                  <span className="font-medium">{data.boxes.length}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Qty</span>
                  <span className="font-medium">
                    {data.lines.reduce((s, l) => s + (parseFloat(l.qty) || 0), 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Value</span>
                  <span className="font-medium">
                    {data.lines.reduce((s, l) => s + (parseFloat(l.value) || 0), 0).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Delete Dialog */}
        <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
          <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete RTV</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{data.rtv_id}</strong>? This will remove all lines and boxes. This cannot be undone.
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
