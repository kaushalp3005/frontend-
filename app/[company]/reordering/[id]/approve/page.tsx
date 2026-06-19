"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  ArrowLeft, CheckCircle2, Loader2, AlertCircle,
  Package, Plus, FileText, Printer, Lock,
  Pencil, Trash2, MoreVertical,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { rtvApi } from "@/lib/api/rtvApiService"
import { BUSINESS_HEAD_OPTIONS, type BusinessHead, type RTVWithDetails } from "@/types/rtv"
import type { RTVLineForm } from "@/components/modules/rtv/RTVLineEditor"
import { BoxScrollContainer } from "@/components/modules/inward/BoxScrollContainer"
import { LotRangeDedicator, type LotRange } from "@/components/modules/inward/LotRangeDedicator"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { useAuthStore } from "@/lib/stores/auth"
import { cn } from "@/lib/utils"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import QRCode from "qrcode"
import { WarehouseSelect } from "@/components/modules/warehouse/WarehouseSelect"
import { isColdWarehouse, normalizeWarehouseName } from "@/lib/constants/warehouses"
import { cascadeArticleField, applyLotRanges as applyLotRangesHelper, bulkFillBoxes, type ColdBox } from "@/lib/utils/rtvCold"
import { printLabels, escapeHtml } from "@/lib/utils/rtvPrint"

interface ApprovePageProps {
  params: { company: string; id: string }
}

type LineForm = RTVLineForm

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

interface DiscrepancyRow {
  item_description: string
  expected: number
  actual: number
  diff: number
}

export default function RTVApprovePage({ params }: ApprovePageProps) {
  const { company, id: rtvIdStr } = params
  const rtvId = parseInt(rtvIdStr, 10)
  const router = useRouter()
  const { user } = useAuthStore()

  const [data, setData] = useState<RTVWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Header fields
  const [factoryUnit, setFactoryUnit] = useState("")
  const [customer, setCustomer] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [challanNo, setChallanNo] = useState("")
  const [dnNo, setDnNo] = useState("")
  const [salesPoc, setSalesPoc] = useState("")
  const [businessHead, setBusinessHead] = useState<BusinessHead | "">("")
  const [remark, setRemark] = useState("")
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [transporterName, setTransporterName] = useState("")
  const [driverName, setDriverName] = useState("")
  const [inwardManager, setInwardManager] = useState("")

  // Lines
  const [lineForms, setLineForms] = useState<LineForm[]>([])

  // Boxes
  const [boxForms, setBoxForms] = useState<BoxForm[]>([])

  // Per-article bulk fill + print range (cold box entry helpers)
  const [bulkFill, setBulkFill] = useState<Record<string, { net: string; gross: string; count: string }>>({})
  const [printRange, setPrintRange] = useState<Record<string, { from: string; to: string }>>({})

  // Box edit tracking (for printed boxes)
  const [editingBoxIndices, setEditingBoxIndices] = useState<Set<number>>(new Set())
  const [editSnapshots, setEditSnapshots] = useState<Map<number, BoxForm>>(new Map())
  const [printingBoxIdx, setPrintingBoxIdx] = useState<number | null>(null)

  // Box delete confirmation
  const [deleteBoxIdx, setDeleteBoxIdx] = useState<number | null>(null)

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showDiscard, setShowDiscard] = useState(false)

  // Net-weight discrepancy confirm (warn-but-allow) at final submit
  const [discrepancyRows, setDiscrepancyRows] = useState<DiscrepancyRow[]>([])
  const [showDiscrepancy, setShowDiscrepancy] = useState(false)

  // Box-wise entry unlocks only after the mail ("first") approval.
  const boxesUnlocked = data?.status === "Approved"

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

        // Pre-fill header
        setFactoryUnit(detail.factory_unit || "")
        setCustomer(detail.customer || "")
        setInvoiceNumber(detail.invoice_number || "")
        setChallanNo(detail.challan_no || "")
        setDnNo(detail.dn_no || "")
        setSalesPoc(detail.sales_poc || "")
        setBusinessHead((detail.business_head as BusinessHead) || "")
        setRemark(detail.remark || "")
        setVehicleNumber(detail.vehicle_number || "")
        setTransporterName(detail.transporter_name || "")
        setDriverName(detail.driver_name || "")
        setInwardManager(detail.inward_manager || "")

        // Initialize line forms
        setLineForms(
          detail.lines.map((l) => ({
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
        )

        // Initialize boxes — load existing + create default box per line if none exist
        const existingBoxes: BoxForm[] = detail.boxes.map((b) => {
          const parentLine = detail.lines.find((l) => l.item_description === b.article_description)
          const lineUom = parseFloat(parentLine?.uom?.toString() || "0") || 0
          const cnt = parseFloat(b.count?.toString() || "0") || 0
          return {
            article_description: b.article_description,
            box_number: b.box_number,
            conversion: b.conversion?.toString() || (lineUom > 0 && cnt > 0 ? String(parseFloat((cnt * lineUom).toFixed(3))) : ""),
            net_weight: b.net_weight?.toString() || "",
            gross_weight: b.gross_weight?.toString() || "",
            count: b.count?.toString() || "1",
            lot_number: b.lot_number?.toString() || "",
            item_mark: b.item_mark?.toString() || "",
            spl_remarks: b.spl_remarks?.toString() || "",
            vakkal: b.vakkal?.toString() || "",
            box_id: b.box_id || undefined,
            is_printed: !!b.box_id,
          }
        })

        const linesWithoutBoxes = detail.lines.filter(
          (l) => !existingBoxes.some((b) => b.article_description === l.item_description)
        )
        const defaultBoxes: BoxForm[] = linesWithoutBoxes.map((l) => {
          const lineUom = parseFloat(l.uom?.toString() || "0") || 0
          return {
            article_description: l.item_description,
            box_number: 1,
            conversion: lineUom > 0 ? String(parseFloat((1 * lineUom).toFixed(3))) : "",
            net_weight: "",
            gross_weight: "",
            count: "1",
            lot_number: "",
            item_mark: "",
            spl_remarks: "",
            vakkal: "",
            box_id: undefined,
            is_printed: false,
          }
        })

        setBoxForms([...existingBoxes, ...defaultBoxes])
      } catch (err) {
        console.error("Failed to fetch detail:", err)
        setError(err instanceof Error ? err.message : "Failed to load CR")
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [company, rtvId])

  // ─── Line helpers ──────────────────────────────────────────────

  const updateLine = (idx: number, field: keyof LineForm, value: string) => {
    setLineForms((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l
        const updated = { ...l, [field]: value }
        if (field === "qty" || field === "rate") {
          const qty = parseFloat(field === "qty" ? value : l.qty) || 0
          const rate = parseFloat(field === "rate" ? value : l.rate) || 0
          if (qty > 0 && rate > 0) updated.value = String(qty * rate)
        }
        // Item-line container Net Weight = UOM × Total Qty (the expected total).
        if (field === "qty" || field === "uom") {
          const qty = parseFloat(field === "qty" ? value : l.qty) || 0
          const uom = parseFloat(field === "uom" ? value : l.uom) || 0
          updated.net_weight = uom > 0 && qty > 0 ? String(parseFloat((uom * qty).toFixed(3))) : ""
        }
        return updated
      })
    )

    // When uom changes, recompute conversion (count * uom) for all boxes of this article
    if (field === "uom") {
      const articleDesc = lineForms[idx]?.item_description
      if (articleDesc) {
        const newUom = parseFloat(value) || 0
        setBoxForms((prev) =>
          prev.map((b) => {
            if (b.article_description !== articleDesc) return b
            const cnt = parseFloat(b.count) || 0
            return { ...b, conversion: newUom > 0 && cnt > 0 ? String(parseFloat((cnt * newUom).toFixed(3))) : "" }
          })
        )
      }
    }

    // When carton_weight changes, recompute net_weight for all boxes: net = gross - carton
    if (field === "carton_weight") {
      const articleDesc = lineForms[idx]?.item_description
      if (articleDesc) {
        const carton = parseFloat(value) || 0
        const newBoxes = boxForms.map((b) => {
          if (b.article_description !== articleDesc) return b
          const gross = parseFloat(b.gross_weight) || 0
          if (carton > 0 && gross > 0) {
            const net = Math.max(0, gross - carton)
            return { ...b, net_weight: String(parseFloat(net.toFixed(3))) }
          }
          return b
        })
        setBoxForms(newBoxes)
        recomputeLineFromBoxes(newBoxes, articleDesc)
      }
    }
  }

  // ─── Box net-weight sum (actual) ───────────────────────────────
  // The item-line Net Weight is the *expected* total (UOM × Total Qty), so it
  // is no longer overwritten by the box sum. The box-wise *actual* sum is
  // derived for the "Net Wt (sum)" display and the discrepancy check.

  const articleNetSum = (articleDesc: string): number =>
    boxForms
      .filter((b) => b.article_description === articleDesc)
      .reduce((sum, b) => sum + (parseFloat(b.net_weight) || 0), 0)

  // Kept as a no-op for call-site compatibility — net_weight is expected-driven.
  const recomputeLineFromBoxes = (_boxes: BoxForm[], _articleDesc: string) => {}

  // Apply lot-number ranges (from the Lot Allocator) to a single article's boxes.
  const applyLotRanges = (article: string, ranges: LotRange[]) => {
    setBoxForms((prev) => applyLotRangesHelper(prev as ColdBox[], article, ranges) as BoxForm[])
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

  // ─── Quantity Units change — controls box count (identical to inward) ──

  const handleQuantityUnitsChange = (lineIdx: number, value: string) => {
    const parsed = parseInt(value)
    if (value !== "" && (isNaN(parsed) || parsed < 0)) return
    const desired = value === "" ? 0 : parsed

    const articleDesc = lineForms[lineIdx]?.item_description
    if (!articleDesc) return

    const currentBoxes = boxForms.filter((b) => b.article_description === articleDesc)
    const currentCount = currentBoxes.length

    if (desired > currentCount) {
      const parentLine = lineForms[lineIdx]
      const lineUom = parseFloat(parentLine?.uom || "0") || 0
      const conv = lineUom > 0 ? String(parseFloat((1 * lineUom).toFixed(3))) : ""
      const newBlankBoxes: BoxForm[] = []
      for (let i = currentCount; i < desired; i++) {
        newBlankBoxes.push({
          article_description: articleDesc,
          box_number: i + 1,
          conversion: conv,
          net_weight: "",
          gross_weight: "",
          count: "1",
          lot_number: "",
          item_mark: "",
          spl_remarks: "",
          vakkal: "",
          box_id: undefined,
          is_printed: false,
        })
      }
      const updatedBoxes = [...boxForms, ...newBlankBoxes]
      setBoxForms(updatedBoxes)
    } else if (desired < currentCount) {
      let removed = 0
      const toRemove = currentCount - desired
      const updatedBoxes = [...boxForms]
      for (let i = updatedBoxes.length - 1; i >= 0 && removed < toRemove; i--) {
        if (updatedBoxes[i].article_description === articleDesc) {
          updatedBoxes.splice(i, 1)
          removed++
        }
      }
      let boxNum = 1
      const renumbered = updatedBoxes.map((b) => {
        if (b.article_description === articleDesc) return { ...b, box_number: boxNum++ }
        return b
      })
      setBoxForms(renumbered)
      recomputeLineFromBoxes(renumbered, articleDesc)
    }
  }

  // ─── Box helpers (identical to inward approve) ─────────────────

  const addBox = (articleDescription: string) => {
    const existing = boxForms.filter((b) => b.article_description === articleDescription)
    const parentLine = lineForms.find((l) => l.item_description === articleDescription)
    const lineUom = parseFloat(parentLine?.uom || "0") || 0
    const conv = lineUom > 0 ? String(parseFloat((1 * lineUom).toFixed(3))) : ""
    const newBoxes: BoxForm[] = [
      ...boxForms,
      {
        article_description: articleDescription,
        box_number: existing.length + 1,
        conversion: conv,
        net_weight: "",
        gross_weight: "",
        count: "1",
        lot_number: "",
        item_mark: "",
        spl_remarks: "",
        vakkal: "",
        box_id: undefined,
        is_printed: false,
      },
    ]
    setBoxForms(newBoxes)
    recomputeLineFromBoxes(newBoxes, articleDescription)
  }

  const updateBox = (idx: number, field: keyof BoxForm, value: string | number) => {
    // Round net_weight and gross_weight to 3 decimal places
    let rounded = value
    if ((field === "net_weight" || field === "gross_weight") && value !== "") {
      const num = parseFloat(String(value))
      if (!isNaN(num)) {
        const parts = String(value).split(".")
        if (parts[1] && parts[1].length > 3) {
          rounded = String(parseFloat(num.toFixed(3)))
        }
      }
    }
    let newBoxes = boxForms.map((b, i) => (i === idx ? { ...b, [field]: rounded } : b))

    // Auto-calc conversion when count changes: conversion = count * uom
    if (field === "count") {
      const articleDesc = boxForms[idx].article_description
      const parentLine = lineForms.find((l) => l.item_description === articleDesc)
      const lineUom = parseFloat(parentLine?.uom || "") || 0
      const cnt = parseFloat(String(rounded)) || 0
      if (lineUom > 0 && cnt > 0) {
        newBoxes = newBoxes.map((b, i) => (i === idx ? { ...b, conversion: String(parseFloat((cnt * lineUom).toFixed(3))) } : b))
      }
    }

    // Auto-calc net_weight when gross_weight changes and article has carton_weight
    if (field === "gross_weight") {
      const articleDesc = boxForms[idx].article_description
      const parentLine = lineForms.find((l) => l.item_description === articleDesc)
      const carton = parseFloat(parentLine?.carton_weight || "") || 0
      if (carton > 0) {
        const gross = parseFloat(String(rounded)) || 0
        const net = Math.max(0, gross - carton)
        newBoxes = newBoxes.map((b, i) => (i === idx ? { ...b, net_weight: String(parseFloat(net.toFixed(3))) } : b))
      }
    }

    setBoxForms(newBoxes)
    if (field === "net_weight" || field === "gross_weight") {
      recomputeLineFromBoxes(newBoxes, boxForms[idx].article_description)
    }
  }

  const removeBox = (idx: number) => {
    const articleDesc = boxForms[idx].article_description
    const newBoxes = boxForms.filter((_, i) => i !== idx)
    setBoxForms(newBoxes)
    recomputeLineFromBoxes(newBoxes, articleDesc)
    if (editingBoxIndices.has(idx)) {
      setEditingBoxIndices((prev) => { const n = new Set(prev); n.delete(idx); return n })
      setEditSnapshots((prev) => { const n = new Map(prev); n.delete(idx); return n })
    }
  }

  // ─── Print box (identical to inward) ──────────────────────────

  const handlePrintBox = async (boxIdx: number) => {
    if (!data) return
    const box = boxForms[boxIdx]
    const line = lineForms.find((l) => l.item_description === box.article_description)
    if (!line) return

    try {
      setPrintingBoxIdx(boxIdx)

      // 1. Save box to backend via upsert
      const upsertResult = await rtvApi.upsertBox(company, rtvId, {
        article_description: box.article_description,
        box_number: box.box_number,
        uom: line?.uom || undefined,
        conversion: box.conversion || undefined,
        net_weight: box.net_weight || undefined,
        gross_weight: box.gross_weight || undefined,
        lot_number: box.lot_number || undefined,
        item_mark: box.item_mark || undefined,
        spl_remarks: box.spl_remarks || undefined,
        vakkal: box.vakkal || undefined,
        count: box.count ? parseInt(box.count) : undefined,
      })

      const boxId = upsertResult.box_id

      // 2. If box was being edited (re-print after edit), log the changes
      if (editingBoxIndices.has(boxIdx)) {
        const snapshot = editSnapshots.get(boxIdx)
        if (snapshot) {
          const changes: Array<{ field_name: string; old_value?: string; new_value?: string }> = []
          if (snapshot.net_weight !== box.net_weight) changes.push({ field_name: "net_weight", old_value: snapshot.net_weight, new_value: box.net_weight })
          if (snapshot.gross_weight !== box.gross_weight) changes.push({ field_name: "gross_weight", old_value: snapshot.gross_weight, new_value: box.gross_weight })
          if (snapshot.count !== box.count) changes.push({ field_name: "count", old_value: snapshot.count, new_value: box.count })

          if (changes.length > 0) {
            await rtvApi.logBoxEdit({
              email_id: user?.email || "unknown",
              box_id: boxId,
              rtv_id: data.rtv_id,
              changes,
            })
          }
        }

        setEditingBoxIndices((prev) => { const n = new Set(prev); n.delete(boxIdx); return n })
        setEditSnapshots((prev) => { const n = new Map(prev); n.delete(boxIdx); return n })
      }

      // 3. Update local state
      setBoxForms((prev) =>
        prev.map((b, i) => (i === boxIdx ? { ...b, box_id: boxId, is_printed: true } : b))
      )

      // 4. Build QR and print label
      const qrDataString = JSON.stringify({ rtv: data.rtv_id, bi: boxId })
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
              <div class="company">${escapeHtml(company)}</div>
              <div class="txn">${escapeHtml(data.rtv_id)}</div>
              <div class="boxid">ID: ${escapeHtml(boxId)}</div>
            </div>
            <div class="item">${escapeHtml(box.article_description)}</div>
            <div>
              <div class="detail"><b>Box #${escapeHtml(box.box_number)}</b> &nbsp; Net: ${escapeHtml(box.net_weight || "\u2014")}kg &nbsp; Gross: ${escapeHtml(box.gross_weight || "\u2014")}kg</div>
              ${box.count ? `<div class="detail">Count: ${escapeHtml(box.count)}</div>` : ""}
              <div class="detail">Date: ${escapeHtml(formatDate(data.rtv_date))}</div>
            </div>
            <div class="lot">${escapeHtml([box.lot_number, box.item_mark].filter(Boolean).join(" · ")) || escapeHtml(data.customer || "")}</div>
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
      console.error("Print failed:", err)
    } finally {
      setPrintingBoxIdx(null)
    }
  }

  const handleEditBox = (boxIdx: number) => {
    const box = boxForms[boxIdx]
    setEditSnapshots((prev) => new Map(prev).set(boxIdx, { ...box }))
    setEditingBoxIndices((prev) => new Set(prev).add(boxIdx))
  }

  // ─── Discrepancy + Save (final submit) ─────────────────────────
  // Box weights are persisted only after mail approval. Save runs a state-aware
  // line merge + a full box sync (which also fires the discrepancy summary
  // email). The only thing surfaced before submit is the net-weight
  // discrepancy: expected (UOM × Total Qty) vs actual (Σ box net) — warn but
  // allow.

  const computeDiscrepancyRows = (): DiscrepancyRow[] =>
    lineForms.map((l) => {
      const uom = parseFloat(l.uom) || 0
      const qty = parseFloat(l.qty) || 0
      const expected = parseFloat((uom * qty).toFixed(3))
      const actual = parseFloat(articleNetSum(l.item_description).toFixed(3))
      return {
        item_description: l.item_description,
        expected,
        actual,
        diff: parseFloat((actual - expected).toFixed(3)),
      }
    })

  const handleSave = () => {
    const rows = computeDiscrepancyRows()
    if (rows.some((r) => r.diff !== 0)) {
      setDiscrepancyRows(rows)
      setShowDiscrepancy(true)
      return
    }
    void doSave()
  }

  const doSave = async () => {
    try {
      setSubmitting(true)
      setSubmitError(null)
      setShowDiscrepancy(false)

      // 1. Persist header edits. (vehicle/transporter/driver/inward_manager are
      //    sent but not yet stored server-side — known drift, out of scope.)
      await rtvApi.updateRTVHeader(company, rtvId, {
        factory_unit: factoryUnit || undefined,
        customer: customer || undefined,
        invoice_number: invoiceNumber || undefined,
        challan_no: challanNo || undefined,
        dn_no: dnNo || undefined,
        sales_poc: salesPoc || undefined,
        business_head: businessHead || undefined,
        remark: remark || undefined,
        vehicle_number: vehicleNumber || undefined,
        transporter_name: transporterName || undefined,
        driver_name: driverName || undefined,
        inward_manager: inwardManager || undefined,
      })

      // 2. Persist line edits (state-aware merge — no destructive wipe).
      await rtvApi.updateRTVLines(company, rtvId, {
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
      })

      // 3. Persist the full box set (state-aware sync). The backend sends the
      //    net-weight discrepancy summary email after the sync.
      await rtvApi.bulkSaveBoxes(company, rtvId, {
        boxes: boxForms.map((b) => {
          const parentLine = lineForms.find((l) => l.item_description === b.article_description)
          return {
            article_description: b.article_description,
            box_number: b.box_number,
            uom: parentLine?.uom || undefined,
            conversion: b.conversion || undefined,
            lot_number: b.lot_number || undefined,
            item_mark: b.item_mark || undefined,
            spl_remarks: b.spl_remarks || undefined,
            vakkal: b.vakkal || undefined,
            net_weight: b.net_weight || undefined,
            gross_weight: b.gross_weight || undefined,
            count: b.count ? parseInt(b.count) : undefined,
          }
        }),
      })

      router.push(`/${company}/reordering/${rtvId}`)
    } catch (err) {
      console.error("Save failed:", err)
      setSubmitError(err instanceof Error ? err.message : "Failed to save CR")
      setShowDiscrepancy(false)
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Loading / Error ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-3 sm:p-4 md:p-6 max-w-[1100px] mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4"><Skeleton className="h-40" /><Skeleton className="h-64" /><Skeleton className="h-48" /></div>
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
        <Button variant="outline" className="mt-4 gap-1.5" onClick={() => router.push(`/${company}/reordering`)}>
          <ArrowLeft className="h-4 w-4" /> Back to list
        </Button>
      </div>
    )
  }

  const isApproved = data.status === "Approved"

  return (
    <PermissionGuard module="reordering" action="view">
      <div className="p-3 sm:p-4 md:p-6 max-w-[1100px] mx-auto space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex items-start gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 mt-0.5" onClick={() => setShowDiscard(true)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight break-all">{data.rtv_id}</h1>
              <Badge variant="outline" className={isApproved
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
              }>
                {data.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isApproved ? "Enter box weights & print QR labels" : "Box entry is locked until mail approval"}
            </p>
          </div>
        </div>

        {submitError && (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-4 py-3 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{submitError}</span>
          </div>
        )}

        {/* Header Fields */}
        <Card>
          <CardHeader className="pb-3 px-3 sm:px-6">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-muted-foreground" />
              CR Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-3 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Factory Unit</Label>
                <WarehouseSelect value={factoryUnit} onChange={setFactoryUnit} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Customer</Label>
                <Input value={customer} onChange={(e) => setCustomer(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Invoice Number</Label>
                <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Challan No</Label>
                <Input value={challanNo} onChange={(e) => setChallanNo(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">DN No</Label>
                <Input value={dnNo} onChange={(e) => setDnNo(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sales POC</Label>
                <Input value={salesPoc} onChange={(e) => setSalesPoc(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Business Head</Label>
                <Select
                  value={businessHead || "__none__"}
                  onValueChange={(v) => setBusinessHead(v === "__none__" ? "" : (v as BusinessHead))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select business head" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {BUSINESS_HEAD_OPTIONS.map((bh) => (
                      <SelectItem key={bh} value={bh}>{bh}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vehicle Number</Label>
                <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="MH-12-AB-1234" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Transporter</Label>
                <Input value={transporterName} onChange={(e) => setTransporterName(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Driver Name</Label>
                <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Inward Manager</Label>
                <Input value={inwardManager} onChange={(e) => setInwardManager(e.target.value)} className="h-9" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Remark</Label>
              <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

        {/* Articles — identical to inward approve layout */}
        <Card>
          <CardHeader className="pb-3 px-3 sm:px-6">
            <CardTitle className="text-base flex items-center gap-1.5">
              <Package className="h-4 w-4 text-muted-foreground" />
              Articles ({lineForms.length})
            </CardTitle>
            <CardDescription className="text-xs">Review each article and manage boxes for label printing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-3 sm:px-6">
            {lineForms.map((line, idx) => (
              <div key={idx} className="p-3 sm:p-4 border rounded-lg space-y-3">
                {/* Article header (read-only) */}
                <div>
                  <p className="text-sm font-medium break-words">{line.item_description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {line.material_type && <Badge variant="outline" className="text-xs">{line.material_type}</Badge>}
                    {line.item_category && <Badge variant="outline" className="text-xs">{line.item_category}</Badge>}
                    {line.sub_category && <Badge variant="outline" className="text-xs">{line.sub_category}</Badge>}
                  </div>
                </div>

                {/* Article fields grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px]">UOM</Label>
                    <Input type="number" step="0.01" value={line.uom} onChange={(e) => updateLine(idx, "uom", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Rate</Label>
                    <Input type="number" step="0.01" value={line.rate} onChange={(e) => updateLine(idx, "rate", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Value</Label>
                    <Input type="number" step="0.01" value={line.value} readOnly className="h-8 text-xs bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Carton Wt</Label>
                    <Input type="number" step="0.001" value={line.carton_weight} onChange={(e) => updateLine(idx, "carton_weight", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Qty Units <span className="text-muted-foreground text-[9px]">(boxes)</span></Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={boxForms.filter((b) => b.article_description === line.item_description).length}
                      onChange={(e) => handleQuantityUnitsChange(idx, e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Net Wt <span className="text-muted-foreground text-[9px]">(box sum)</span></Label>
                    <Input type="number" value={articleNetSum(line.item_description) || ""} readOnly className="h-8 text-xs bg-muted" />
                  </div>
                  {isColdWarehouse(normalizeWarehouseName(factoryUnit)) && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Lot No</Label>
                        <Input value={line.lot_number || ""} onChange={(e) => updateColdArticleField(idx, "lot_number", e.target.value)} className="h-8 text-xs" placeholder="Lot no" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Item Mark</Label>
                        <Input value={line.item_mark || ""} onChange={(e) => updateColdArticleField(idx, "item_mark", e.target.value)} className="h-8 text-xs" placeholder="Item mark" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Spl. Remarks</Label>
                        <Input value={line.spl_remarks || ""} onChange={(e) => updateColdArticleField(idx, "spl_remarks", e.target.value)} className="h-8 text-xs" placeholder="Special remarks" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Vakkal</Label>
                        <Input value={line.vakkal || ""} onChange={(e) => updateColdArticleField(idx, "vakkal", e.target.value)} className="h-8 text-xs" placeholder="Vakkal" />
                      </div>
                    </>
                  )}
                </div>

                {/* Boxes for this article */}
                <div className="mt-2 pt-2 border-t space-y-2">
                  {!boxesUnlocked && (
                    <div className="flex items-start gap-2 rounded-md border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-700">
                      <Lock className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <span>
                        Box-wise net/gross weights, lot numbers &amp; QR labels are locked until this CR is
                        approved by mail. Once approved, enter the weights here and submit.
                      </span>
                    </div>
                  )}

                  {/* Lot Allocator — bulk-assign lot numbers to box ranges */}
                  {boxesUnlocked && (
                    <LotRangeDedicator
                      warehouse={normalizeWarehouseName(factoryUnit)}
                      totalBoxes={boxForms.filter((b) => b.article_description === line.item_description).length}
                      onApply={(ranges) => applyLotRanges(line.item_description, ranges)}
                    />
                  )}

                  {/* Bulk fill all boxes of this article */}
                  {boxesUnlocked && (
                    <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-2">
                      <span className="text-[11px] font-medium text-muted-foreground">Bulk fill boxes:</span>
                      <Input type="number" step="0.001" placeholder="Net wt" className="h-7 w-24 text-xs"
                        value={bulkFill[line.item_description]?.net || ""}
                        onChange={(e) => setBulkFill((p) => ({ ...p, [line.item_description]: { ...(p[line.item_description] || { net: "", gross: "", count: "" }), net: e.target.value } }))} />
                      <Input type="number" step="0.001" placeholder="Gross wt" className="h-7 w-24 text-xs"
                        value={bulkFill[line.item_description]?.gross || ""}
                        onChange={(e) => setBulkFill((p) => ({ ...p, [line.item_description]: { ...(p[line.item_description] || { net: "", gross: "", count: "" }), gross: e.target.value } }))} />
                      <Input type="number" placeholder="Count" className="h-7 w-20 text-xs"
                        value={bulkFill[line.item_description]?.count || ""}
                        onChange={(e) => setBulkFill((p) => ({ ...p, [line.item_description]: { ...(p[line.item_description] || { net: "", gross: "", count: "" }), count: e.target.value } }))} />
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                        onClick={() => {
                          const v = bulkFill[line.item_description]
                          if (!v) return
                          const uomNum = parseFloat(line.uom || "") || 0
                          const cartonNum = parseFloat(line.carton_weight || "") || 0
                          setBoxForms((prev) => {
                            const filled = bulkFillBoxes(prev as ColdBox[], line.item_description, {
                              ...(v.net ? { net_weight: v.net } : {}),
                              ...(v.gross ? { gross_weight: v.gross } : {}),
                              ...(v.count ? { count: v.count } : {}),
                            }) as BoxForm[]
                            // Mirror per-box auto-calc: conversion = count×UOM, and
                            // net = gross−carton when gross was bulk-set (and net wasn't).
                            return filled.map((b) => {
                              if (b.article_description !== line.item_description) return b
                              const next = { ...b }
                              const cnt = parseFloat(next.count) || 0
                              if (uomNum > 0 && cnt > 0) next.conversion = String(parseFloat((cnt * uomNum).toFixed(3)))
                              if (v.gross && !v.net && cartonNum > 0) {
                                const g = parseFloat(next.gross_weight) || 0
                                next.net_weight = String(parseFloat(Math.max(0, g - cartonNum).toFixed(3)))
                              }
                              return next
                            })
                          })
                        }}>
                        Apply to all
                      </Button>
                    </div>
                  )}

                  {/* Print a range of box labels for this article */}
                  {boxesUnlocked && (
                    <div className="flex flex-wrap items-end gap-2">
                      <span className="text-[11px] font-medium text-muted-foreground">Print range:</span>
                      <Input type="number" min="1" placeholder="From" className="h-7 w-20 text-xs"
                        value={printRange[line.item_description]?.from || ""}
                        onChange={(e) => setPrintRange((p) => ({ ...p, [line.item_description]: { ...(p[line.item_description] || { from: "", to: "" }), from: e.target.value } }))} />
                      <Input type="number" min="1" placeholder="To" className="h-7 w-20 text-xs"
                        value={printRange[line.item_description]?.to || ""}
                        onChange={(e) => setPrintRange((p) => ({ ...p, [line.item_description]: { ...(p[line.item_description] || { from: "", to: "" }), to: e.target.value } }))} />
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                        onClick={() => {
                          const r = printRange[line.item_description]
                          const from = parseInt(r?.from || "1"), to = parseInt(r?.to || "999999")
                          printLabels({ company, rtvStringId: data?.rtv_id || "", customer,
                            boxes: boxForms.filter((b) => b.article_description === line.item_description && b.box_id && b.box_number >= from && b.box_number <= to) })
                        }}>
                        Print range
                      </Button>
                    </div>
                  )}

                  {/* Go-to-box navigation + scrollable box list */}
                  <BoxScrollContainer
                    boxCount={boxForms.filter((b) => b.article_description === line.item_description).length}
                    onAddBox={boxesUnlocked ? () => addBox(line.item_description) : undefined}
                    boxForms={boxForms.filter((b) => b.article_description === line.item_description)}
                  >
                    {(registerRef) =>
                      boxForms
                        .map((box, boxIdx) => ({ box, boxIdx }))
                        .filter(({ box }) => box.article_description === line.item_description)
                        .map(({ box, boxIdx }) => {
                          const isPrinted = box.is_printed && !editingBoxIndices.has(boxIdx)
                          const isLocked = !boxesUnlocked || isPrinted
                          const isPrinting = printingBoxIdx === boxIdx
                          return (
                            <div
                              key={boxIdx}
                              ref={(el) => registerRef(box.box_number, el)}
                              className={cn(
                                "p-2 rounded space-y-2 sm:space-y-0",
                                isPrinted ? "bg-emerald-50/50 border border-emerald-200/50" : "bg-muted/30"
                              )}
                            >
                              {/* Box header row */}
                              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs font-medium flex-shrink-0 gap-0.5">
                                      #{box.box_number}
                                      <MoreVertical className="h-3 w-3 text-muted-foreground" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start">
                                    {isPrinted && boxesUnlocked && (
                                      <DropdownMenuItem onClick={() => handleEditBox(boxIdx)}>
                                        <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteBoxIdx(boxIdx)} disabled={!boxesUnlocked}>
                                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                {isPrinted && (
                                  <Badge variant="outline" className="text-[10px] h-5 bg-emerald-50 text-emerald-700 border-emerald-200 flex-shrink-0">
                                    Printed
                                  </Badge>
                                )}
                                {editingBoxIndices.has(boxIdx) && (
                                  <Badge variant="outline" className="text-[10px] h-5 bg-amber-50 text-amber-700 border-amber-200 flex-shrink-0">
                                    Editing
                                  </Badge>
                                )}
                                {/* Desktop: inline inputs */}
                                <div className="hidden sm:contents">
                                  <Input
                                    type="number"
                                    placeholder="Conv."
                                    value={box.conversion}
                                    readOnly
                                    className="h-7 text-xs flex-1 min-w-0 bg-muted"
                                  />
                                  <Input
                                    type="number"
                                    step="0.001"
                                    placeholder="Net wt"
                                    value={box.net_weight}
                                    onChange={(e) => updateBox(boxIdx, "net_weight", e.target.value)}
                                    readOnly={isLocked}
                                    className={cn("h-7 text-xs flex-1 min-w-0", isLocked ? "bg-muted" : "")}
                                  />
                                  <Input
                                    type="number"
                                    step="0.001"
                                    placeholder="Gross wt"
                                    value={box.gross_weight}
                                    onChange={(e) => updateBox(boxIdx, "gross_weight", e.target.value)}
                                    readOnly={isLocked}
                                    className={cn("h-7 text-xs flex-1 min-w-0", isLocked ? "bg-muted" : "")}
                                  />
                                  <Input
                                    type="number"
                                    placeholder="Count"
                                    value={box.count}
                                    onChange={(e) => updateBox(boxIdx, "count", e.target.value)}
                                    readOnly={isLocked}
                                    className={cn("h-7 text-xs flex-1 min-w-0", isLocked ? "bg-muted" : "")}
                                  />
                                  <Input
                                    type="text"
                                    placeholder="Lot #"
                                    value={box.lot_number}
                                    onChange={(e) => updateBox(boxIdx, "lot_number", e.target.value)}
                                    readOnly={isLocked}
                                    className={cn("h-7 text-xs flex-1 min-w-0", isLocked ? "bg-muted" : "")}
                                  />
                                </div>
                                <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title={isPrinted ? "Re-print label" : "Print label"}
                                    onClick={() => handlePrintBox(boxIdx)}
                                    disabled={isPrinting || !boxesUnlocked}
                                  >
                                    {isPrinting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Printer className="h-3 w-3" />}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-primary hover:text-primary"
                                    onClick={() => addBox(line.item_description)}
                                    title="Add box below"
                                    disabled={!boxesUnlocked}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              {/* Mobile: stacked inputs */}
                              <div className="sm:hidden grid grid-cols-2 gap-2">
                                <div className="space-y-0.5">
                                  <Label className="text-[10px] text-muted-foreground">Conversion</Label>
                                  <Input type="number" value={box.conversion} readOnly className="h-8 text-xs bg-muted" />
                                </div>
                                <div className="space-y-0.5">
                                  <Label className="text-[10px] text-muted-foreground">Net wt (kg)</Label>
                                  <Input
                                    type="number"
                                    step="0.001"
                                    value={box.net_weight}
                                    onChange={(e) => updateBox(boxIdx, "net_weight", e.target.value)}
                                    readOnly={isLocked}
                                    className={cn("h-8 text-xs", isLocked ? "bg-muted" : "")}
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <Label className="text-[10px] text-muted-foreground">Gross wt (kg)</Label>
                                  <Input
                                    type="number"
                                    step="0.001"
                                    value={box.gross_weight}
                                    onChange={(e) => updateBox(boxIdx, "gross_weight", e.target.value)}
                                    readOnly={isLocked}
                                    className={cn("h-8 text-xs", isLocked ? "bg-muted" : "")}
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <Label className="text-[10px] text-muted-foreground">Count</Label>
                                  <Input
                                    type="number"
                                    value={box.count}
                                    onChange={(e) => updateBox(boxIdx, "count", e.target.value)}
                                    readOnly={isLocked}
                                    className={cn("h-8 text-xs", isLocked ? "bg-muted" : "")}
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <Label className="text-[10px] text-muted-foreground">Lot #</Label>
                                  <Input
                                    type="text"
                                    value={box.lot_number}
                                    onChange={(e) => updateBox(boxIdx, "lot_number", e.target.value)}
                                    readOnly={isLocked}
                                    className={cn("h-8 text-xs", isLocked ? "bg-muted" : "")}
                                  />
                                </div>
                              </div>
                            </div>
                          )
                        })
                    }
                  </BoxScrollContainer>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <Button variant="outline" size="sm" onClick={() => setShowDiscard(true)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" disabled={!boxesUnlocked}
              onClick={() => printLabels({ company, rtvStringId: data?.rtv_id || "", customer, boxes: boxForms.filter((b) => b.box_id) })}>
              <Printer className="h-4 w-4" /> Print all labels
            </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={submitting || !boxesUnlocked}
            title={!boxesUnlocked ? "Box entry & save unlock after mail approval" : undefined}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save
          </Button>
          </div>
        </div>

        {/* Net-weight discrepancy confirm (warn but allow) */}
        <AlertDialog open={showDiscrepancy} onOpenChange={(o) => { if (!o) setShowDiscrepancy(false) }}>
          <AlertDialogContent className="max-w-[92vw] sm:max-w-xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Net-weight discrepancy</AlertDialogTitle>
              <AlertDialogDescription>
                The box-wise net weights don&apos;t match the expected totals (UOM × Total Qty). Review the
                summary below — you can still submit. A summary email will be sent.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="max-h-[40vh] overflow-y-auto rounded-md border text-xs">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left font-medium px-2 py-1.5">Item</th>
                    <th className="text-right font-medium px-2 py-1.5">Expected</th>
                    <th className="text-right font-medium px-2 py-1.5">Actual</th>
                    <th className="text-right font-medium px-2 py-1.5">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {discrepancyRows.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1.5 truncate max-w-[180px]">{r.item_description}</td>
                      <td className="px-2 py-1.5 text-right">{r.expected.toFixed(3)}</td>
                      <td className="px-2 py-1.5 text-right">{r.actual.toFixed(3)}</td>
                      <td className={cn("px-2 py-1.5 text-right font-medium", r.diff !== 0 ? "text-destructive" : "text-emerald-600")}>
                        {r.diff > 0 ? "+" : ""}{r.diff.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Go back</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => void doSave()}
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Submit anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Box Dialog */}
        <AlertDialog open={deleteBoxIdx !== null} onOpenChange={(open) => { if (!open) setDeleteBoxIdx(null) }}>
          <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete box?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove Box #{deleteBoxIdx !== null ? boxForms[deleteBoxIdx]?.box_number : ""} and update the article totals.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (deleteBoxIdx !== null) removeBox(deleteBoxIdx)
                  setDeleteBoxIdx(null)
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Discard Dialog */}
        <AlertDialog open={showDiscard} onOpenChange={setShowDiscard}>
          <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Discard changes?</AlertDialogTitle>
              <AlertDialogDescription>
                Any unsaved changes will be lost. Are you sure you want to go back?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => router.push(`/${company}/reordering`)}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Discard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PermissionGuard>
  )
}
