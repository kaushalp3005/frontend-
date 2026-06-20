"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import {
  ArrowLeft, Edit, CheckCircle2, CheckCheck, Clock, Trash2, X,
  Package, Box, AlertCircle, Loader2, FileText, Printer, Lock,
} from "lucide-react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { format } from "date-fns"
import { rtvApi } from "@/lib/api/rtvApiService"
import type { RTVWithDetails, RTVStatus, RTVBox, RTVLine } from "@/types/rtv"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { useAuthStore } from "@/lib/stores/auth"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import QRCode from "qrcode"
import { isColdWarehouse, normalizeWarehouseName } from "@/lib/constants/warehouses"
import {
  cascadeArticleField, applyLotRanges as applyLotRangesHelper, type ColdBox,
} from "@/lib/utils/rtvCold"
import { printLabels, escapeHtml } from "@/lib/utils/rtvPrint"
import { LotRangeDedicator, type LotRange } from "@/components/modules/inward/LotRangeDedicator"

interface RTVDetailPageProps {
  params: { company: string; id: string }
}

// Editable line form (subset of RTVLine + cold fields)
interface LineForm {
  item_description: string
  material_type: string
  item_category: string
  sub_category: string
  sale_group: string
  uom: string
  qty: string
  rate: string
  value: string
  carton_weight: string
  net_weight: string
  lot_number: string
  item_mark: string
  spl_remarks: string
  vakkal: string
}

// Editable box form matching ColdBox
interface BoxForm {
  article_description: string
  box_number: number
  conversion: string
  net_weight: string
  gross_weight: string
  count: string
  lot_number: string
  item_mark: string
  spl_remarks: string
  vakkal: string
  box_id?: string
  is_printed: boolean
}

function StatusBadge({ status }: { status: RTVStatus }) {
  const config: Record<string, { label: string; icon: React.ElementType; className: string }> = {
    Pending: { label: "Pending", icon: Clock, className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300" },
    Approved: { label: "Approved", icon: CheckCircle2, className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300" },
    Submitted: { label: "Submitted", icon: CheckCheck, className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300" },
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
  const { user } = useAuthStore()
  const { toast } = useToast()

  const [data, setData] = useState<RTVWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [printingBoxId, setPrintingBoxId] = useState<string | null>(null)

  // ─── Edit mode (Approved CRs only) ────────────────────────────
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lineForms, setLineForms] = useState<LineForm[]>([])
  const [boxForms, setBoxForms] = useState<BoxForm[]>([])
  // Snapshot of original box lot numbers (by box_id) for edit logging.
  const [lotSnapshots, setLotSnapshots] = useState<Map<string, string>>(new Map())
  // Per-article print range (From/To).
  const [printRange, setPrintRange] = useState<Record<string, { from: string; to: string }>>({})
  const [printingAll, setPrintingAll] = useState(false)
  const [boxPage, setBoxPage] = useState(1)

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
        setError(err instanceof Error ? err.message : "Failed to load CR")
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [company, rtvId])

  const handleDelete = async () => {
    try {
      setDeleting(true)
      await rtvApi.deleteRTV(company, rtvId, user?.email || undefined)
      router.push(`/${company}/customer-returns`)
    } catch (err) {
      console.error("Delete failed:", err)
    } finally {
      setDeleting(false)
    }
  }

  // ─── Edit-mode helpers ─────────────────────────────────────────

  const buildLineForms = (lines: RTVLine[]): LineForm[] =>
    lines.map((l) => ({
      item_description: l.item_description,
      material_type: l.material_type || "",
      item_category: l.item_category || "",
      sub_category: l.sub_category || "",
      sale_group: l.sale_group || "",
      uom: l.uom?.toString() || "",
      qty: l.qty?.toString() || "",
      rate: l.rate?.toString() || "",
      value: l.value?.toString() || "",
      carton_weight: l.carton_weight?.toString() || "",
      net_weight: l.net_weight?.toString() || "",
      lot_number: l.lot_number || "",
      item_mark: l.item_mark || "",
      spl_remarks: l.spl_remarks || "",
      vakkal: l.vakkal || "",
    }))

  const buildBoxForms = (boxes: RTVBox[]): BoxForm[] =>
    boxes.map((b) => ({
      article_description: b.article_description,
      box_number: b.box_number,
      conversion: b.conversion?.toString() || "",
      net_weight: b.net_weight?.toString() || "",
      gross_weight: b.gross_weight?.toString() || "",
      count: b.count?.toString() || "",
      lot_number: b.lot_number?.toString() || "",
      item_mark: b.item_mark?.toString() || "",
      spl_remarks: b.spl_remarks?.toString() || "",
      vakkal: b.vakkal?.toString() || "",
      box_id: b.box_id || undefined,
      is_printed: !!b.box_id,
    }))

  const enterEditMode = () => {
    if (!data) return
    setLineForms(buildLineForms(data.lines))
    const bf = buildBoxForms(data.boxes)
    setBoxForms(bf)
    // Snapshot original lots for change-logging.
    const snap = new Map<string, string>()
    bf.forEach((b) => { if (b.box_id) snap.set(b.box_id, b.lot_number) })
    setLotSnapshots(snap)
    setEditing(true)
  }

  const cancelEditMode = () => {
    setEditing(false)
    setLineForms([])
    setBoxForms([])
    setLotSnapshots(new Map())
  }

  const updateLine = (idx: number, field: keyof LineForm, value: string) => {
    setLineForms((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))
  }

  // Cascade a cold article field to the line + all of that article's boxes.
  const updateColdArticleField = (
    idx: number,
    field: "lot_number" | "item_mark" | "spl_remarks" | "vakkal",
    value: string,
  ) => {
    updateLine(idx, field, value)
    const art = lineForms[idx]?.item_description
    if (art) setBoxForms((prev) => cascadeArticleField(prev as ColdBox[], art, field, value) as BoxForm[])
  }

  // Apply lot-number ranges (from the Lot Allocator) to a single article's boxes.
  const applyLotRangesOnBoxes = (article: string, ranges: LotRange[]) => {
    setBoxForms((prev) => applyLotRangesHelper(prev as ColdBox[], article, ranges) as BoxForm[])
  }

  const updateBox = (boxNumber: number, article: string, field: keyof BoxForm, value: string) => {
    setBoxForms((prev) =>
      prev.map((b) => (b.box_number === boxNumber && b.article_description === article ? { ...b, [field]: value } : b))
    )
  }

  const handleSaveEdits = async () => {
    if (!data) return
    try {
      setSaving(true)

      // 1+2. Single consolidated save (lines + boxes) -> ONE "Updated" mail with
      //       a change summary, highlights and short-weight flags.
      await rtvApi.saveRTV(company, rtvId, {
        lines: lineForms.map((l) => ({
          material_type: l.material_type || "RM",
          item_category: l.item_category,
          sub_category: l.sub_category,
          item_description: l.item_description,
          sale_group: l.sale_group || undefined,
          uom: l.uom || "0",
          qty: l.qty || "0",
          rate: l.rate || "0",
          value: l.value || "0",
          conversion: l.uom || undefined,
          carton_weight: l.carton_weight || undefined,
          net_weight: l.net_weight || "0",
          lot_number: l.lot_number || undefined,
          item_mark: l.item_mark || undefined,
          spl_remarks: l.spl_remarks || undefined,
          vakkal: l.vakkal || undefined,
        })),
        boxes: boxForms.map((b) => {
          const parentLine = lineForms.find((l) => l.item_description === b.article_description)
          return {
            article_description: b.article_description,
            box_number: b.box_number,
            uom: parentLine?.uom || undefined,
            // Text fields use ?? (not ||) so a cleared "" is sent rather than
            // dropped to undefined; the backend COALESCE then writes "" and the
            // field actually clears (|| would JSON-omit it and keep the old value).
            conversion: b.conversion ?? undefined,
            lot_number: b.lot_number ?? undefined,
            item_mark: b.item_mark ?? undefined,
            spl_remarks: b.spl_remarks ?? undefined,
            vakkal: b.vakkal ?? undefined,
            net_weight: b.net_weight || undefined,
            gross_weight: b.gross_weight || undefined,
            count: b.count ? parseInt(b.count) : undefined,
          }
        }),
      })

      // 3. Best-effort: log box lot changes (one entry per changed printed box).
      try {
        const changed = boxForms.filter(
          (b) => b.box_id && (lotSnapshots.get(b.box_id) ?? "") !== b.lot_number
        )
        await Promise.all(
          changed.map((b) =>
            rtvApi.logBoxEdit({
              email_id: user?.email || "unknown",
              box_id: b.box_id!,
              rtv_id: data.rtv_id,
              changes: [{
                field_name: "lot_number",
                old_value: lotSnapshots.get(b.box_id!) ?? "",
                new_value: b.lot_number,
              }],
            })
          )
        )
      } catch (logErr) {
        console.error("Box edit log failed (non-fatal):", logErr)
      }

      // 4. Re-fetch detail, exit edit mode, toast success.
      const detail = await rtvApi.getRTVDetail(company, rtvId)
      setData(detail)
      cancelEditMode()
      toast({ title: "Saved", description: "CR details updated." })
    } catch (err) {
      console.error("Save failed:", err)
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Failed to save changes",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // ─── Reprint (available whenever boxes exist) ──────────────────

  const printAllLabels = async () => {
    if (!data) return
    const boxes = data.boxes.filter((b) => b.box_id)
    if (!boxes.length) {
      toast({ title: "Nothing to print", description: "No printed boxes available." })
      return
    }
    try {
      setPrintingAll(true)
      await printLabels({
        company,
        rtvStringId: data.rtv_id,
        customer: data.customer || undefined,
        boxes: boxes.map((b) => ({
          box_id: b.box_id || undefined,
          box_number: b.box_number,
          article_description: b.article_description,
          net_weight: b.net_weight?.toString() || undefined,
          gross_weight: b.gross_weight?.toString() || undefined,
          count: b.count?.toString() || undefined,
          lot_number: b.lot_number || undefined,
          item_mark: b.item_mark || undefined,
        })),
      })
    } catch (err) {
      console.error("Print all failed:", err)
      toast({ title: "Print failed", description: err instanceof Error ? err.message : "Failed to print", variant: "destructive" })
    } finally {
      setPrintingAll(false)
    }
  }

  const printArticleRange = async (article: string) => {
    if (!data) return
    const r = printRange[article]
    const from = parseInt(r?.from || "1")
    const to = parseInt(r?.to || "999999")
    const boxes = data.boxes.filter(
      (b) => b.article_description === article && b.box_id && b.box_number >= from && b.box_number <= to
    )
    if (!boxes.length) {
      toast({ title: "Nothing to print", description: "No printed boxes in that range." })
      return
    }
    try {
      await printLabels({
        company,
        rtvStringId: data.rtv_id,
        customer: data.customer || undefined,
        boxes: boxes.map((b) => ({
          box_id: b.box_id || undefined,
          box_number: b.box_number,
          article_description: b.article_description,
          net_weight: b.net_weight?.toString() || undefined,
          gross_weight: b.gross_weight?.toString() || undefined,
          count: b.count?.toString() || undefined,
          lot_number: b.lot_number || undefined,
          item_mark: b.item_mark || undefined,
        })),
      })
    } catch (err) {
      console.error("Print range failed:", err)
      toast({ title: "Print failed", description: err instanceof Error ? err.message : "Failed to print", variant: "destructive" })
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
        .label { width: 4in; height: 2in; background: white; border: 1px solid #000; display: flex; font-family: Arial, sans-serif; overflow: hidden; page-break-after: always; page-break-inside: avoid; }
        .label:last-child { page-break-after: auto; }
        .qr { width: 2in; height: 100%; display: flex; align-items: center; justify-content: center; padding: 0.1in; }
        .qr img { width: 1.7in; height: 1.7in; }
        .info { width: 2in; height: 100%; padding: 0.08in; font-size: 8pt; line-height: 1.2; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; }
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
              <div class="company">${escapeHtml(company)}</div>
              <div class="txn">${escapeHtml(data.rtv_id)}</div>
              <div class="boxid">ID: ${escapeHtml(box.box_id)}</div>
            </div>
            <div class="item">${escapeHtml(box.article_description)}</div>
            <div>
              <div class="detail"><b>Box #${escapeHtml(box.box_number)}</b> &nbsp; Net: ${escapeHtml(box.net_weight ?? "—")}kg &nbsp; Gross: ${escapeHtml(box.gross_weight ?? "—")}kg</div>
              ${box.count ? `<div class="detail">Count: ${escapeHtml(box.count)}</div>` : ""}
              <div class="detail">Date: ${escapeHtml(formatDate(data.rtv_date))}</div>
            </div>
            <div class="lot">${escapeHtml([box.lot_number, box.item_mark].filter(Boolean).join(" · "))}</div>
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
          <span className="text-sm">{error || "CR not found"}</span>
        </div>
        <Button variant="outline" className="mt-4 gap-1.5" onClick={() => router.push(`/${company}/customer-returns`)}>
          <ArrowLeft className="h-4 w-4" /> Back to list
        </Button>
      </div>
    )
  }

  const isPending = data.status === "Pending"
  const isApproved = data.status === "Approved"
  const isSubmitted = data.status === "Submitted"
  // Box entry / edit actions are available once approved, and remain available
  // after the final submit so corrections are still possible.
  const boxEntryAvailable = isApproved || isSubmitted
  const isCold = isColdWarehouse(normalizeWarehouseName(data.factory_unit))
  const hasBoxes = data.boxes.length > 0

  // Window the box list (200/page) so large CRs stay fast to open — same as inward.
  const BOX_PAGE_SIZE = 200
  const totalBoxPages = Math.max(1, Math.ceil(data.boxes.length / BOX_PAGE_SIZE))
  const safeBoxPage = Math.min(Math.max(1, boxPage), totalBoxPages)
  const pageBoxes = data.boxes.slice((safeBoxPage - 1) * BOX_PAGE_SIZE, safeBoxPage * BOX_PAGE_SIZE)

  return (
    <PermissionGuard module="reordering" action="view">
      <div className="p-3 sm:p-4 md:p-6 max-w-[1100px] mx-auto space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-start gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 mt-0.5" onClick={() => router.push(`/${company}/customer-returns`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight break-all">{data.rtv_id}</h1>
                <StatusBadge status={data.status} />
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Created {data.created_ts ? format(new Date(data.created_ts), "dd MMM yyyy HH:mm") : "—"}
                {data.created_by && ` by ${data.created_by}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-10 sm:pl-11">
            {boxEntryAvailable && !editing && (
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs sm:text-sm" onClick={enterEditMode}>
                <Edit className="h-3.5 w-3.5" /> Edit details
              </Button>
            )}
            {editing && (
              <>
                <Button
                  size="sm"
                  className="gap-1.5 h-8 text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleSaveEdits}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Save
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs sm:text-sm" onClick={cancelEditMode} disabled={saving}>
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
              </>
            )}
            {boxEntryAvailable && !editing && (
              <Button variant="default" size="sm" className="gap-1.5 h-8 text-xs sm:text-sm" asChild>
                <Link href={`/${company}/customer-returns/${rtvId}/approve`}>
                  <Box className="h-3.5 w-3.5" /> Enter / Edit Box Weights
                </Link>
              </Button>
            )}
            {!boxEntryAvailable && (
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs sm:text-sm" asChild>
                <Link href={`/${company}/customer-returns/${rtvId}/approve`}>
                  <FileText className="h-3.5 w-3.5" /> Review
                </Link>
              </Button>
            )}
            {!boxEntryAvailable && (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-700">
                <Lock className="h-3 w-3" /> Box entry unlocks after mail approval
              </span>
            )}
            {/* Reprint controls — available whenever printed boxes exist */}
            {hasBoxes && !editing && (
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs sm:text-sm" onClick={printAllLabels} disabled={printingAll}>
                {printingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                Print all labels
              </Button>
            )}
            {isPending && !editing && (
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
            {/* CR Information */}
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  CR Information
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
                  <Field label="Business Head" value={data.business_head} />
                  <Field label="CR Date" value={data.rtv_date ? format(new Date(data.rtv_date), "dd MMM yyyy") : null} />
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
                  Line Items ({editing ? lineForms.length : data.lines.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-3 sm:px-6">
                {editing ? (
                  // ─── Edit mode: per-article cold fields + lot ranges + per-box lot ──
                  lineForms.map((line, idx) => {
                    const articleBoxes = boxForms.filter((b) => b.article_description === line.item_description)
                    return (
                      <div key={idx} className="p-3 border rounded-lg space-y-3">
                        <p className="text-sm font-medium break-words">{line.item_description}</p>

                        {isCold && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[11px]">Lot No</Label>
                              <Input value={line.lot_number} onChange={(e) => updateColdArticleField(idx, "lot_number", e.target.value)} className="h-8 text-xs" placeholder="Lot no" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">Item Mark</Label>
                              <Input value={line.item_mark} onChange={(e) => updateColdArticleField(idx, "item_mark", e.target.value)} className="h-8 text-xs" placeholder="Item mark" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">Spl. Remarks</Label>
                              <Input value={line.spl_remarks} onChange={(e) => updateColdArticleField(idx, "spl_remarks", e.target.value)} className="h-8 text-xs" placeholder="Special remarks" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">Vakkal</Label>
                              <Input value={line.vakkal} onChange={(e) => updateColdArticleField(idx, "vakkal", e.target.value)} className="h-8 text-xs" placeholder="Vakkal" />
                            </div>
                          </div>
                        )}

                        {isCold && (
                          <LotRangeDedicator
                            warehouse={normalizeWarehouseName(data.factory_unit)}
                            totalBoxes={articleBoxes.length}
                            onApply={(ranges) => applyLotRangesOnBoxes(line.item_description, ranges)}
                          />
                        )}

                        {/* Per-box lot editing (lot no can be corrected later) */}
                        {articleBoxes.length > 0 && (
                          <div className="mt-2 pt-2 border-t space-y-1.5">
                            <p className="text-[11px] font-medium text-muted-foreground">Box lot numbers</p>
                            {articleBoxes.map((box) => (
                              <div key={`${box.article_description}-${box.box_number}`} className="flex items-center gap-2">
                                <span className="text-xs font-medium w-12 flex-shrink-0">#{box.box_number}</span>
                                <Input
                                  type="text"
                                  placeholder="Lot #"
                                  value={box.lot_number}
                                  onChange={(e) => updateBox(box.box_number, box.article_description, "lot_number", e.target.value)}
                                  className="h-7 text-xs flex-1 min-w-0"
                                />
                                {box.is_printed && (
                                  <Badge variant="outline" className="text-[10px] h-5 bg-emerald-50 text-emerald-700 border-emerald-200 flex-shrink-0">
                                    Printed
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })
                ) : (
                  // ─── Read mode ───────────────────────────────────────
                  data.lines.map((line, idx) => (
                    <div key={line.id || idx} className="p-3 border rounded-lg bg-muted/20 space-y-2">
                      <p className="text-sm font-medium break-words">{line.item_description}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 text-xs">
                        <Field label="Material Type" value={line.material_type} />
                        <Field label="Item Category" value={line.item_category} />
                        <Field label="Sub Category" value={line.sub_category} />
                        <Field label="Sale Group" value={line.sale_group} />
                        <Field label="UOM" value={line.uom} />
                        <Field label="Total Qty (Units/Kgs)" value={line.qty} />
                        <Field label="Rate" value={line.rate} />
                        <Field label="Value" value={line.value} />
                        <Field label="Carton Weight" value={line.carton_weight} />
                        <Field label="Net Weight" value={line.net_weight} />
                        {/* Cold fields — display when present */}
                        <Field label="Lot No" value={line.lot_number} />
                        <Field label="Item Mark" value={line.item_mark} />
                        <Field label="Spl. Remarks" value={line.spl_remarks} />
                        <Field label="Vakkal" value={line.vakkal} />
                      </div>
                      {/* Per-article print range (From/To) */}
                      {hasBoxes && data.boxes.some((b) => b.article_description === line.item_description && b.box_id) && (
                        <div className="flex flex-wrap items-end gap-2 pt-2 border-t">
                          <span className="text-[11px] font-medium text-muted-foreground">Print range:</span>
                          <Input
                            type="number" min="1" placeholder="From" className="h-7 w-20 text-xs"
                            value={printRange[line.item_description]?.from || ""}
                            onChange={(e) => setPrintRange((p) => ({ ...p, [line.item_description]: { ...(p[line.item_description] || { from: "", to: "" }), from: e.target.value } }))}
                          />
                          <Input
                            type="number" min="1" placeholder="To" className="h-7 w-20 text-xs"
                            value={printRange[line.item_description]?.to || ""}
                            onChange={(e) => setPrintRange((p) => ({ ...p, [line.item_description]: { ...(p[line.item_description] || { from: "", to: "" }), to: e.target.value } }))}
                          />
                          <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => printArticleRange(line.item_description)}>
                            <Printer className="h-3 w-3" /> Print range
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Boxes (read-only display, includes lot) */}
            {hasBoxes && (
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
                          <th className="text-left font-medium px-3 py-2">Lot</th>
                          <th className="text-center font-medium px-3 py-2 w-[60px]">Print</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageBoxes.map((box) => (
                          <tr key={box.id || `${box.article_description}-${box.box_number}`} className="border-b last:border-0">
                            <td className="px-3 py-2 text-muted-foreground truncate max-w-[150px]">{box.article_description}</td>
                            <td className="px-3 py-2">{box.box_number}</td>
                            <td className="px-3 py-2 text-right">{box.conversion ?? "—"}</td>
                            <td className="px-3 py-2 text-right">{box.net_weight ?? "—"}</td>
                            <td className="px-3 py-2 text-right">{box.gross_weight ?? "—"}</td>
                            <td className="px-3 py-2 text-right">{box.count ?? "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{box.lot_number || "—"}</td>
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
                                <span className="text-xs text-muted-foreground">{"—"}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile cards */}
                  <div className="sm:hidden space-y-2">
                    {pageBoxes.map((box) => (
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
                          <div><span className="text-muted-foreground">Net:</span> {box.net_weight ?? "—"} kg</div>
                          <div><span className="text-muted-foreground">Gross:</span> {box.gross_weight ?? "—"} kg</div>
                          {box.count != null && <div><span className="text-muted-foreground">Count:</span> {box.count}</div>}
                          {box.lot_number && <div><span className="text-muted-foreground">Lot:</span> {box.lot_number}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {totalBoxPages > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-2 border-t text-xs">
                      <span className="text-muted-foreground">
                        Showing {(safeBoxPage - 1) * BOX_PAGE_SIZE + 1}–{Math.min(safeBoxPage * BOX_PAGE_SIZE, data.boxes.length)} of {data.boxes.length} boxes
                      </span>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" className="h-7 px-2" disabled={safeBoxPage <= 1} onClick={() => setBoxPage(safeBoxPage - 1)}>Prev</Button>
                        <span className="px-2 text-muted-foreground">Page {safeBoxPage} / {totalBoxPages}</span>
                        <Button variant="outline" size="sm" className="h-7 px-2" disabled={safeBoxPage >= totalBoxPages} onClick={() => setBoxPage(safeBoxPage + 1)}>Next</Button>
                      </div>
                    </div>
                  )}
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
              <AlertDialogTitle>Delete CR</AlertDialogTitle>
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
