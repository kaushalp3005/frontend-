"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  ArrowLeft, CheckCircle2, Loader2, AlertCircle,
  Package, Plus, Box, Truck, FileText, Printer,
  MoreVertical, Pencil, Trash2,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  inwardApiService,
  type Company,
  type InwardDetailResponse,
  type ApprovePayload,
  type ArticleV2,
} from "@/types/inward"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { useAuthStore } from "@/lib/stores/auth"
import { cn } from "@/lib/utils"
import QRCode from "qrcode"

interface ApprovePageProps {
  params: { company: Company; id: string }
}

interface ArticleForm {
  item_description: string
  po_weight?: number
  sku_id?: number
  material_type?: string
  item_category?: string
  sub_category?: string
  // Approver fills these
  quality_grade: string
  uom: string
  po_quantity: string
  units: string
  quantity_units: string
  net_weight: string
  total_weight: string
  lot_number: string
  manufacturing_date: string
  expiry_date: string
  unit_rate: string
  total_amount: string
  carton_weight: string
}

interface BoxForm {
  article_description: string
  box_number: number
  net_weight: string
  gross_weight: string
  lot_number: string
  count: string
  box_id?: string
  is_printed: boolean
}

export default function ApprovePage({ params }: ApprovePageProps) {
  const { company, id: transactionNo } = params
  const router = useRouter()
  const { user } = useAuthStore()

  const [data, setData] = useState<InwardDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Transaction fields (approver fills)
  const [warehouse, setWarehouse] = useState("")
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [transporterName, setTransporterName] = useState("")
  const [lrNumber, setLrNumber] = useState("")
  const [challanNumber, setChallanNumber] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [grnNumber, setGrnNumber] = useState("")
  const [grnQuantity, setGrnQuantity] = useState("")
  const [systemGrnDate, setSystemGrnDate] = useState("")
  const [serviceInvoiceNo, setServiceInvoiceNo] = useState("")
  const [dnNumber, setDnNumber] = useState("")
  const [approvalAuthority, setApprovalAuthority] = useState("")
  const [isOtherManager, setIsOtherManager] = useState(false)
  const [remark, setRemark] = useState("")

  // Articles (pre-filled from PO data, approver fills remaining fields)
  const [articleForms, setArticleForms] = useState<ArticleForm[]>([])

  // Boxes (approver creates)
  const [boxForms, setBoxForms] = useState<BoxForm[]>([])

  // Service / RTV toggles
  const [isServiceOrder, setIsServiceOrder] = useState(false)
  const [isRtv, setIsRtv] = useState(false)

  // Box delete confirmation
  const [deleteBoxIdx, setDeleteBoxIdx] = useState<number | null>(null)

  // Box edit tracking (for printed boxes)
  const [editingBoxIndices, setEditingBoxIndices] = useState<Set<number>>(new Set())
  const [editSnapshots, setEditSnapshots] = useState<Map<number, BoxForm>>(new Map())
  const [printingBoxIdx, setPrintingBoxIdx] = useState<number | null>(null)

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showDiscard, setShowDiscard] = useState(false)

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

        // Pre-fill approver transaction fields from existing data
        const txn = detail.transaction
        setVehicleNumber(txn.vehicle_number || "")
        setTransporterName(txn.transporter_name || "")
        setLrNumber(txn.lr_number || "")
        setChallanNumber(txn.challan_number || "")
        setInvoiceNumber(txn.invoice_number || "")
        setGrnNumber(txn.grn_number || "")
        setGrnQuantity(txn.grn_quantity?.toString() || "")
        setSystemGrnDate(txn.system_grn_date || "")
        setServiceInvoiceNo(txn.service_invoice_number || "")
        setDnNumber(txn.dn_number || "")
        const savedManager = txn.approval_authority || ""
        const knownManagers = ["Vaibhav Kumkar", "Samal Kumar", "Sumit Baikar", "Ritesh Dighe", "Pankaj Ranga", "Vaishali Dhuri"]
        if (savedManager && !knownManagers.includes(savedManager)) {
          setIsOtherManager(true)
        }
        setApprovalAuthority(savedManager)
        setRemark(txn.remark || "")
        setWarehouse(txn.warehouse || "")

        // Initialize existing boxes — create a default box per article if none exist
        const existingBoxes: BoxForm[] = detail.boxes.map((b) => ({
          article_description: b.article_description,
          box_number: b.box_number,
          net_weight: b.net_weight?.toString() || "",
          gross_weight: b.gross_weight?.toString() || "",
          lot_number: b.lot_number || "",
          count: b.count?.toString() || "",
          box_id: b.box_id || undefined,
          is_printed: !!b.box_id,
        }))

        const articlesWithoutBoxes = detail.articles.filter(
          (a) => !existingBoxes.some((b) => b.article_description === a.item_description)
        )
        const defaultBoxes: BoxForm[] = articlesWithoutBoxes.map((a) => ({
          article_description: a.item_description,
          box_number: 1,
          net_weight: "",
          gross_weight: "",
          lot_number: a.lot_number || "",
          count: "",
          box_id: undefined,
          is_printed: false,
        }))

        const allBoxes = [...existingBoxes, ...defaultBoxes]
        setBoxForms(allBoxes)

        // Initialize article forms — compute quantity_units/net_weight/total_weight from boxes
        setArticleForms(
          detail.articles.map((a) => {
            const articleBoxes = allBoxes.filter((b) => b.article_description === a.item_description)
            const boxCount = articleBoxes.length
            const sumNet = articleBoxes.reduce((s, b) => s + (parseFloat(b.net_weight) || 0), 0)
            const sumGross = articleBoxes.reduce((s, b) => s + (parseFloat(b.gross_weight) || 0), 0)

            return {
              item_description: a.item_description,
              po_weight: a.po_weight,
              sku_id: a.sku_id,
              material_type: a.material_type,
              item_category: a.item_category,
              sub_category: a.sub_category,
              quality_grade: a.quality_grade || "",
              uom: a.uom || "",
              po_quantity: a.po_quantity?.toString() || a.po_weight?.toString() || "",
              units: a.units?.toString() || "",
              quantity_units: a.quantity_units?.toString() || (boxCount > 0 ? String(boxCount) : ""),
              net_weight: a.net_weight?.toString() || (sumNet > 0 ? String(sumNet) : ""),
              total_weight: a.total_weight?.toString() || (sumGross > 0 ? String(sumGross) : ""),
              lot_number: a.lot_number || "",
              manufacturing_date: a.manufacturing_date || "",
              expiry_date: a.expiry_date || "",
              unit_rate: a.unit_rate?.toString() || "",
              total_amount: a.total_amount?.toString() || "",
              carton_weight: a.carton_weight?.toString() || "",
            }
          })
        )
      } catch (err) {
        console.error("Failed to fetch detail:", err)
        setError(err instanceof Error ? err.message : "Failed to load entry")
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [company, transactionNo, router])

  const updateArticle = (idx: number, field: keyof ArticleForm, value: string) => {
    setArticleForms((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a))
    )

    const articleDesc = articleForms[idx]?.item_description
    if (!articleDesc) return

    // Propagate lot_number to all boxes of this article
    if (field === "lot_number") {
      setBoxForms((prev) =>
        prev.map((b) => b.article_description === articleDesc ? { ...b, lot_number: value } : b)
      )
    }

    // Recalculate box net_weight when carton_weight changes: net = gross - carton
    if (field === "carton_weight") {
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
      recomputeArticleFromBoxes(newBoxes, articleDesc)
    }
  }

  // Recompute article totals from its boxes
  const recomputeArticleFromBoxes = (boxes: BoxForm[], articleDesc: string) => {
    const articleBoxes = boxes.filter((b) => b.article_description === articleDesc)
    const totalNet = articleBoxes.reduce((sum, b) => sum + (parseFloat(b.net_weight) || 0), 0)
    const totalGross = articleBoxes.reduce((sum, b) => sum + (parseFloat(b.gross_weight) || 0), 0)
    const boxCount = articleBoxes.length

    setArticleForms((prev) =>
      prev.map((a) =>
        a.item_description === articleDesc
          ? {
              ...a,
              quantity_units: String(boxCount),
              net_weight: totalNet > 0 ? String(parseFloat(totalNet.toFixed(3))) : "",
              total_weight: totalGross > 0 ? String(parseFloat(totalGross.toFixed(3))) : "",
            }
          : a
      )
    )
  }

  const handleQuantityUnitsChange = (articleIdx: number, value: string) => {
    const parsed = parseInt(value)
    if (value !== "" && (isNaN(parsed) || parsed < 0)) return
    const desired = value === "" ? 0 : parsed

    const articleDesc = articleForms[articleIdx]?.item_description
    if (!articleDesc) return

    setArticleForms((prev) =>
      prev.map((a, i) => (i === articleIdx ? { ...a, quantity_units: value } : a))
    )

    const currentBoxes = boxForms.filter((b) => b.article_description === articleDesc)
    const currentCount = currentBoxes.length

    if (desired > currentCount) {
      const parentArticle = articleForms[articleIdx]
      const newBlankBoxes: BoxForm[] = []
      for (let i = currentCount; i < desired; i++) {
        newBlankBoxes.push({
          article_description: articleDesc,
          box_number: i + 1,
          net_weight: "",
          gross_weight: "",
          lot_number: parentArticle?.lot_number || "",
          count: "",
          box_id: undefined,
          is_printed: false,
        })
      }
      const updatedBoxes = [...boxForms, ...newBlankBoxes]
      setBoxForms(updatedBoxes)
      recomputeWeightsOnly(updatedBoxes, articleDesc)
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
        if (b.article_description === articleDesc) {
          return { ...b, box_number: boxNum++ }
        }
        return b
      })
      setBoxForms(renumbered)
      recomputeWeightsOnly(renumbered, articleDesc)
    }
  }

  const recomputeWeightsOnly = (boxes: BoxForm[], articleDesc: string) => {
    const articleBoxes = boxes.filter((b) => b.article_description === articleDesc)
    const totalNet = articleBoxes.reduce((sum, b) => sum + (parseFloat(b.net_weight) || 0), 0)
    const totalGross = articleBoxes.reduce((sum, b) => sum + (parseFloat(b.gross_weight) || 0), 0)

    setArticleForms((prev) =>
      prev.map((a) =>
        a.item_description === articleDesc
          ? {
              ...a,
              net_weight: totalNet > 0 ? String(parseFloat(totalNet.toFixed(3))) : "",
              total_weight: totalGross > 0 ? String(parseFloat(totalGross.toFixed(3))) : "",
            }
          : a
      )
    )
  }

  const addBox = (articleDescription: string) => {
    const existing = boxForms.filter((b) => b.article_description === articleDescription)
    const parentArticle = articleForms.find((a) => a.item_description === articleDescription)
    const newBoxes: BoxForm[] = [
      ...boxForms,
      {
        article_description: articleDescription,
        box_number: existing.length + 1,
        net_weight: "",
        gross_weight: "",
        lot_number: parentArticle?.lot_number || "",
        count: "",
        box_id: undefined,
        is_printed: false,
      },
    ]
    setBoxForms(newBoxes)
    recomputeArticleFromBoxes(newBoxes, articleDescription)
  }

  const updateBox = (idx: number, field: keyof BoxForm, value: string | number) => {
    let newBoxes = boxForms.map((b, i) => (i === idx ? { ...b, [field]: value } : b))

    // Auto-calc net_weight when gross_weight changes and article has carton_weight
    if (field === "gross_weight") {
      const articleDesc = boxForms[idx].article_description
      const parentArticle = articleForms.find((a) => a.item_description === articleDesc)
      const carton = parseFloat(parentArticle?.carton_weight || "") || 0
      if (carton > 0) {
        const gross = parseFloat(String(value)) || 0
        const net = Math.max(0, gross - carton)
        newBoxes = newBoxes.map((b, i) => (i === idx ? { ...b, net_weight: String(parseFloat(net.toFixed(3))) } : b))
      }
    }

    setBoxForms(newBoxes)
    if (field === "net_weight" || field === "gross_weight") {
      recomputeArticleFromBoxes(newBoxes, boxForms[idx].article_description)
    }
  }

  const removeBox = (idx: number) => {
    const articleDesc = boxForms[idx].article_description
    const newBoxes = boxForms.filter((_, i) => i !== idx)
    setBoxForms(newBoxes)
    recomputeArticleFromBoxes(newBoxes, articleDesc)
    // Clean up edit state if this box was being edited
    if (editingBoxIndices.has(idx)) {
      setEditingBoxIndices((prev) => {
        const next = new Set(prev)
        next.delete(idx)
        return next
      })
      setEditSnapshots((prev) => {
        const next = new Map(prev)
        next.delete(idx)
        return next
      })
    }
  }

  const handlePrintBox = async (boxIdx: number) => {
    if (!data) return
    const box = boxForms[boxIdx]
    const article = articleForms.find((a) => a.item_description === box.article_description)
    if (!article) return

    const txn = data.transaction

    try {
      setPrintingBoxIdx(boxIdx)

      // 1. Save box to backend via upsert
      const upsertResult = await inwardApiService.upsertBox(company, transactionNo, {
        article_description: box.article_description,
        box_number: box.box_number,
        net_weight: box.net_weight ? parseFloat(box.net_weight) : undefined,
        gross_weight: box.gross_weight ? parseFloat(box.gross_weight) : undefined,
        lot_number: box.lot_number || undefined,
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
          if (snapshot.lot_number !== box.lot_number) changes.push({ field_name: "lot_number", old_value: snapshot.lot_number, new_value: box.lot_number })
          if (snapshot.count !== box.count) changes.push({ field_name: "count", old_value: snapshot.count, new_value: box.count })

          if (changes.length > 0) {
            await inwardApiService.logBoxEdit({
              email_id: user?.email || "unknown",
              box_id: boxId,
              transaction_no: transactionNo,
              changes,
            })
          }
        }

        // Clear edit state for this box
        setEditingBoxIndices((prev) => {
          const next = new Set(prev)
          next.delete(boxIdx)
          return next
        })
        setEditSnapshots((prev) => {
          const next = new Map(prev)
          next.delete(boxIdx)
          return next
        })
      }

      // 3. Update box state with box_id and mark as printed
      setBoxForms((prev) =>
        prev.map((b, i) => (i === boxIdx ? { ...b, box_id: boxId, is_printed: true } : b))
      )

      // 4. Build QR and print label
      const qrDataString = JSON.stringify({ tx: txn.transaction_no, bi: boxId })

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
              <div class="boxid">ID: ${boxId}</div>
            </div>
            <div class="item">${article.item_description}</div>
            <div>
              <div class="detail"><b>Box #${box.box_number}</b> &nbsp; Net: ${box.net_weight || "\u2014"}kg &nbsp; Gross: ${box.gross_weight || "\u2014"}kg</div>
              ${box.count ? `<div class="detail">Count: ${box.count}</div>` : ""}
              <div class="detail">Entry: ${formatDate(txn.entry_date)}</div>
              ${article.expiry_date ? `<div class="detail exp">Exp: ${formatDate(article.expiry_date)}</div>` : ""}
            </div>
            <div class="lot">${(box.lot_number || article.lot_number || "").substring(0, 20)}${txn.customer_party_name ? ` \u00b7 ${txn.customer_party_name}` : ""}</div>
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

      // Fallback cleanup after 30s
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
    // Snapshot current values before editing
    const box = boxForms[boxIdx]
    setEditSnapshots((prev) => new Map(prev).set(boxIdx, { ...box }))
    setEditingBoxIndices((prev) => new Set(prev).add(boxIdx))
  }

  const handleApprove = async () => {
    try {
      setSubmitting(true)
      setSubmitError(null)

      const payload: ApprovePayload = {
        approved_by: user?.name || user?.email || "unknown",
        transaction: {
          warehouse: warehouse || undefined,
          vehicle_number: vehicleNumber || undefined,
          transporter_name: transporterName || undefined,
          lr_number: lrNumber || undefined,
          challan_number: challanNumber || undefined,
          invoice_number: invoiceNumber || undefined,
          grn_number: grnNumber || undefined,
          grn_quantity: grnQuantity ? parseFloat(grnQuantity) : undefined,
          system_grn_date: systemGrnDate || undefined,
          ...(isServiceOrder ? { service_invoice_number: serviceInvoiceNo || undefined } : {}),
          ...((isServiceOrder || isRtv) ? { dn_number: dnNumber || undefined } : {}),
          approval_authority: approvalAuthority || undefined,
          remark: remark || undefined,
          service: isServiceOrder,
          rtv: isRtv,
        },
        articles: articleForms.map((a) => ({
          item_description: a.item_description,
          quality_grade: a.quality_grade || undefined,
          uom: a.uom || undefined,
          po_quantity: a.po_quantity ? parseFloat(a.po_quantity) : undefined,
          units: isRtv && a.units ? parseFloat(a.units) : undefined,
          quantity_units: a.quantity_units ? parseFloat(a.quantity_units) : undefined,
          net_weight: a.net_weight ? parseFloat(a.net_weight) : undefined,
          total_weight: a.total_weight ? parseFloat(a.total_weight) : undefined,
          lot_number: a.lot_number || undefined,
          manufacturing_date: a.manufacturing_date || undefined,
          expiry_date: a.expiry_date || undefined,
          unit_rate: a.unit_rate ? parseFloat(a.unit_rate) : undefined,
          total_amount: a.total_amount ? parseFloat(a.total_amount) : undefined,
          carton_weight: a.carton_weight ? parseFloat(a.carton_weight) : undefined,
        })),
        boxes: boxForms.map((b) => ({
          article_description: b.article_description,
          box_number: b.box_number,
          net_weight: b.net_weight ? parseFloat(b.net_weight) : undefined,
          gross_weight: b.gross_weight ? parseFloat(b.gross_weight) : undefined,
          lot_number: b.lot_number || undefined,
          count: b.count ? parseInt(b.count) : undefined,
        })),
      }

      await inwardApiService.approveOrReject(company, transactionNo, payload)
      router.push(`/${company}/inward`)
    } catch (err) {
      console.error("Approve failed:", err)
      setSubmitError(err instanceof Error ? err.message : "Failed to approve")
    } finally {
      setSubmitting(false)
    }
  }


  if (loading) {
    return (
      <div className="p-3 sm:p-4 md:p-6 max-w-[1000px] mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-3 sm:p-4 md:p-6 max-w-[1000px] mx-auto">
        <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-4 py-3 rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error || "Entry not found"}</span>
        </div>
        <Button variant="outline" className="mt-4 gap-1.5" onClick={() => router.push(`/${company}/inward`)}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
    )
  }

  const txn = data.transaction

  // Build lookup: Map<box_id, Set<field_name>> for edited fields
  const editedFields = new Map<string, Set<string>>()
  if (data.edit_logs) {
    for (const log of data.edit_logs) {
      if (!editedFields.has(log.box_id)) editedFields.set(log.box_id, new Set())
      editedFields.get(log.box_id)!.add(log.field_name)
    }
  }
  const isEdited = (boxId: string | undefined, field: string) =>
    boxId ? editedFields.get(boxId)?.has(field) ?? false : false

  return (
    <PermissionGuard module="inward" action="view" showError>
      <div className="p-3 sm:p-4 md:p-6 max-w-[1000px] mx-auto space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => router.push(`/${company}/inward/${transactionNo}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight">Review & Approve</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              Transaction {txn.transaction_no} · {txn.vendor_supplier_name || "Unknown vendor"}
            </p>
          </div>
        </div>

        {/* PO Data (read-only) */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="text-sm">PO Extracted Data</CardTitle>
            <CardDescription className="text-xs">Auto-filled from purchase order — read only</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 text-sm">
              {txn.vendor_supplier_name && (
                <div><span className="text-[11px] text-muted-foreground block">Vendor</span><span className="break-words">{txn.vendor_supplier_name}</span></div>
              )}
              {txn.customer_party_name && (
                <div><span className="text-[11px] text-muted-foreground block">Customer</span><span className="break-words">{txn.customer_party_name}</span></div>
              )}
              {txn.po_number && (
                <div><span className="text-[11px] text-muted-foreground block">PO Number</span>{txn.po_number}</div>
              )}
              {txn.source_location && (
                <div><span className="text-[11px] text-muted-foreground block">Source</span><span className="break-words">{txn.source_location}</span></div>
              )}
              {txn.destination_location && (
                <div><span className="text-[11px] text-muted-foreground block">Destination</span><span className="break-words">{txn.destination_location}</span></div>
              )}
              {txn.purchased_by && (
                <div><span className="text-[11px] text-muted-foreground block">Indentor</span>{txn.purchased_by}</div>
              )}
              {txn.total_amount != null && (
                <div><span className="text-[11px] text-muted-foreground block">Total Amount</span>{txn.currency || "INR"} {txn.total_amount.toLocaleString()}</div>
              )}
              {txn.po_quantity != null && (
                <div><span className="text-[11px] text-muted-foreground block">PO Quantity</span>{txn.po_quantity}</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transport & Documents (approver fills) */}
        <Card>
          <CardHeader className="pb-3 px-3 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  Transport & Documents
                </CardTitle>
                <CardDescription className="text-xs">Fill in the transport and document details</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">Service</Label>
                  <Switch checked={isServiceOrder} onCheckedChange={(v) => { setIsServiceOrder(v); if (v) setIsRtv(false) }} />
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">RTV</Label>
                  <Switch checked={isRtv} onCheckedChange={(v) => { setIsRtv(v); if (v) setIsServiceOrder(false) }} />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-3 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Warehouse <span className="text-destructive">*</span></Label>
                <Select value={warehouse} onValueChange={setWarehouse}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="W202">W202</SelectItem>
                    <SelectItem value="A185">A185</SelectItem>
                    <SelectItem value="A68">A68</SelectItem>
                    <SelectItem value="A101">A101</SelectItem>
                    <SelectItem value="F53">F53</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vehicle Number <span className="text-destructive">*</span></Label>
                <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Transporter <span className="text-destructive">*</span></Label>
                <Input value={transporterName} onChange={(e) => setTransporterName(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">LR Number</Label>
                <Input value={lrNumber} onChange={(e) => setLrNumber(e.target.value)} className="h-9" />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Challan Number</Label>
                <Input value={challanNumber} onChange={(e) => setChallanNumber(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Invoice Number</Label>
                <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">GRN Number</Label>
                <Input value={grnNumber} onChange={(e) => setGrnNumber(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">GRN Quantity</Label>
                <Input type="number" value={grnQuantity} onChange={(e) => setGrnQuantity(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">GRN Date</Label>
                <Input type="date" value={systemGrnDate} onChange={(e) => setSystemGrnDate(e.target.value)} className="h-9" />
              </div>
              {isServiceOrder && !isRtv && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Service Invoice No.</Label>
                  <Input value={serviceInvoiceNo} onChange={(e) => setServiceInvoiceNo(e.target.value)} className="h-9" />
                </div>
              )}
              {(isServiceOrder || isRtv) && (
                <div className="space-y-1.5">
                  <Label className="text-xs">DN Number</Label>
                  <Input value={dnNumber} onChange={(e) => setDnNumber(e.target.value)} className="h-9" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Inward Manager <span className="text-destructive">*</span></Label>
                <Select
                  value={isOtherManager ? "__other__" : approvalAuthority}
                  onValueChange={(v) => {
                    if (v === "__other__") {
                      setIsOtherManager(true)
                      setApprovalAuthority("")
                    } else {
                      setIsOtherManager(false)
                      setApprovalAuthority(v)
                    }
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Vaibhav Kumkar">Vaibhav Kumkar</SelectItem>
                    <SelectItem value="Samal Kumar">Samal Kumar</SelectItem>
                    <SelectItem value="Sumit Baikar">Sumit Baikar</SelectItem>
                    <SelectItem value="Ritesh Dighe">Ritesh Dighe</SelectItem>
                    <SelectItem value="Pankaj Ranga">Pankaj Ranga</SelectItem>
                    <SelectItem value="Vaishali Dhuri">Vaishali Dhuri</SelectItem>
                    <SelectItem value="__other__">Other</SelectItem>
                  </SelectContent>
                </Select>
                {isOtherManager && (
                  <Input
                    placeholder="Enter manager name"
                    value={approvalAuthority}
                    onChange={(e) => setApprovalAuthority(e.target.value)}
                    className="h-9 mt-1.5"
                    autoFocus
                  />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Remark</Label>
              <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={2} className="resize-none" />
            </div>
          </CardContent>
        </Card>

        {/* Articles (approver fills remaining fields) */}
        <Card>
          <CardHeader className="pb-3 px-3 sm:px-6">
            <CardTitle className="text-base flex items-center gap-1.5">
              <Package className="h-4 w-4 text-muted-foreground" />
              Articles ({articleForms.length})
            </CardTitle>
            <CardDescription className="text-xs">Fill weights, quantities, dates, and pricing for each article</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-3 sm:px-6">
            {articleForms.map((article, idx) => (
              <div key={idx} className="p-3 sm:p-4 border rounded-lg space-y-3">
                {/* Article header (read-only PO data) */}
                <div>
                  <p className="text-sm font-medium break-words">{article.item_description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {article.sku_id && <Badge variant="secondary" className="text-xs">SKU: {article.sku_id}</Badge>}
                    {article.material_type && <Badge variant="outline" className="text-xs">{article.material_type}</Badge>}
                    {article.item_category && <Badge variant="outline" className="text-xs">{article.item_category}</Badge>}
                    {article.po_weight != null && <Badge variant="outline" className="text-xs">PO: {article.po_weight} kg</Badge>}
                  </div>
                </div>

                {/* Approver fields */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Quality Grade</Label>
                    <Input value={article.quality_grade} onChange={(e) => updateArticle(idx, "quality_grade", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">UOM <span className="text-destructive">*</span></Label>
                    <Select value={article.uom} onValueChange={(v) => updateArticle(idx, "uom", v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select UOM" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BOX">BOX</SelectItem>
                        <SelectItem value="BAG">BAG</SelectItem>
                        <SelectItem value="CARTON">CARTON</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">PO Qty</Label>
                    <Input type="number" value={article.po_quantity} readOnly className="h-8 text-xs bg-muted" />
                  </div>
                  {isRtv && (
                    <div className="space-y-1">
                      <Label className="text-[11px]">Units</Label>
                      <Input type="number" value={article.units} onChange={(e) => updateArticle(idx, "units", e.target.value)} className="h-8 text-xs" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-[11px]">Qty Units <span className="text-muted-foreground text-[9px]">(boxes)</span></Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={article.quantity_units}
                      onChange={(e) => handleQuantityUnitsChange(idx, e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Net Wt <span className="text-muted-foreground text-[9px]">(sum)</span></Label>
                    <Input type="number" value={article.net_weight} readOnly className="h-8 text-xs bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Total Wt <span className="text-muted-foreground text-[9px]">(sum)</span></Label>
                    <Input type="number" value={article.total_weight} readOnly className="h-8 text-xs bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Carton Wt (kg)</Label>
                    <Input type="number" value={article.carton_weight} onChange={(e) => updateArticle(idx, "carton_weight", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Lot Number</Label>
                    <Input value={article.lot_number} onChange={(e) => updateArticle(idx, "lot_number", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Mfg Date</Label>
                    <Input type="date" value={article.manufacturing_date} onChange={(e) => updateArticle(idx, "manufacturing_date", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Expiry Date</Label>
                    <Input type="date" value={article.expiry_date} onChange={(e) => updateArticle(idx, "expiry_date", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Unit Rate</Label>
                    <Input type="number" value={article.unit_rate} readOnly className="h-8 text-xs bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Total Amount</Label>
                    <Input type="number" value={article.total_amount} readOnly className="h-8 text-xs bg-muted" />
                  </div>
                </div>

                {/* Boxes for this article */}
                <div className="mt-2 pt-2 border-t space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Box className="h-3 w-3" />
                      Boxes ({boxForms.filter((b) => b.article_description === article.item_description).length})
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs gap-1"
                      onClick={() => addBox(article.item_description)}
                    >
                      <Plus className="h-3 w-3" /> Add Box
                    </Button>
                  </div>
                  {boxForms
                    .map((box, boxIdx) => ({ box, boxIdx }))
                    .filter(({ box }) => box.article_description === article.item_description)
                    .map(({ box, boxIdx }) => {
                      const isLocked = box.is_printed && !editingBoxIndices.has(boxIdx)
                      const isPrinting = printingBoxIdx === boxIdx
                      return (
                      <div key={boxIdx} className={cn(
                        "p-2 rounded space-y-2 sm:space-y-0",
                        isLocked ? "bg-emerald-50/50 border border-emerald-200/50" : "bg-muted/30"
                      )}>
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
                              {box.is_printed && !editingBoxIndices.has(boxIdx) && (
                                <DropdownMenuItem onClick={() => handleEditBox(boxIdx)}>
                                  <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteBoxIdx(boxIdx)}>
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {box.is_printed && !editingBoxIndices.has(boxIdx) && (
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
                              placeholder="Net wt"
                              value={box.net_weight}
                              onChange={(e) => updateBox(boxIdx, "net_weight", e.target.value)}
                              readOnly={isLocked}
                              className={cn("h-7 text-xs flex-1 min-w-0", isLocked ? "bg-muted" : "", isEdited(box.box_id, "net_weight") && "ring-2 ring-red-300 bg-red-50")}
                            />
                            <Input
                              type="number"
                              placeholder="Gross wt"
                              value={box.gross_weight}
                              onChange={(e) => updateBox(boxIdx, "gross_weight", e.target.value)}
                              readOnly={isLocked}
                              className={cn("h-7 text-xs flex-1 min-w-0", isLocked ? "bg-muted" : "", isEdited(box.box_id, "gross_weight") && "ring-2 ring-red-300 bg-red-50")}
                            />
                            <Input
                              placeholder="Lot #"
                              value={box.lot_number}
                              onChange={(e) => updateBox(boxIdx, "lot_number", e.target.value)}
                              readOnly={isLocked}
                              className={cn("h-7 text-xs flex-1 min-w-0", isLocked ? "bg-muted" : "", isEdited(box.box_id, "lot_number") && "ring-2 ring-red-300 bg-red-50")}
                            />
                            <Input
                              type="number"
                              placeholder="Count"
                              value={box.count}
                              onChange={(e) => updateBox(boxIdx, "count", e.target.value)}
                              readOnly={isLocked}
                              className={cn("h-7 text-xs flex-1 min-w-0", isLocked ? "bg-muted" : "", isEdited(box.box_id, "count") && "ring-2 ring-red-300 bg-red-50")}
                            />
                          </div>
                          <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title={box.is_printed && editingBoxIndices.has(boxIdx) ? "Save & Re-print" : "Print label"}
                              onClick={() => handlePrintBox(boxIdx)}
                              disabled={isPrinting}
                            >
                              {isPrinting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Printer className="h-3 w-3" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary hover:text-primary"
                              onClick={() => addBox(article.item_description)}
                              title="Add box below"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        {/* Mobile: stacked inputs */}
                        <div className="sm:hidden grid grid-cols-2 gap-2">
                          <div className="space-y-0.5">
                            <Label className="text-[10px] text-muted-foreground">Net wt (kg)</Label>
                            <Input
                              type="number"
                              value={box.net_weight}
                              onChange={(e) => updateBox(boxIdx, "net_weight", e.target.value)}
                              readOnly={isLocked}
                              className={cn("h-8 text-xs", isLocked ? "bg-muted" : "", isEdited(box.box_id, "net_weight") && "ring-2 ring-red-300 bg-red-50")}
                            />
                          </div>
                          <div className="space-y-0.5">
                            <Label className="text-[10px] text-muted-foreground">Gross wt (kg)</Label>
                            <Input
                              type="number"
                              value={box.gross_weight}
                              onChange={(e) => updateBox(boxIdx, "gross_weight", e.target.value)}
                              readOnly={isLocked}
                              className={cn("h-8 text-xs", isLocked ? "bg-muted" : "", isEdited(box.box_id, "gross_weight") && "ring-2 ring-red-300 bg-red-50")}
                            />
                          </div>
                          <div className="space-y-0.5">
                            <Label className="text-[10px] text-muted-foreground">Lot #</Label>
                            <Input
                              value={box.lot_number}
                              onChange={(e) => updateBox(boxIdx, "lot_number", e.target.value)}
                              readOnly={isLocked}
                              className={cn("h-8 text-xs", isLocked ? "bg-muted" : "", isEdited(box.box_id, "lot_number") && "ring-2 ring-red-300 bg-red-50")}
                            />
                          </div>
                          <div className="space-y-0.5">
                            <Label className="text-[10px] text-muted-foreground">Count</Label>
                            <Input
                              type="number"
                              value={box.count}
                              onChange={(e) => updateBox(boxIdx, "count", e.target.value)}
                              readOnly={isLocked}
                              className={cn("h-8 text-xs", isLocked ? "bg-muted" : "", isEdited(box.box_id, "count") && "ring-2 ring-red-300 bg-red-50")}
                            />
                          </div>
                        </div>
                      </div>
                      )
                    })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Amount Validation */}
        {(() => {
          const articleSum = articleForms.reduce((sum, a) => sum + (parseFloat(a.total_amount) || 0), 0)
          const txnTotal = txn.total_amount ?? 0
          const diff = Math.abs(articleSum - txnTotal)
          const matched = diff < 0.01

          return (
            <div className={cn(
              "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-lg border text-sm",
              matched
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-amber-50 border-amber-200 text-amber-700"
            )}>
              <div className="flex items-center gap-2">
                {matched ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
                <span className="text-xs sm:text-sm">
                  Articles: <strong>{txn.currency || "INR"} {articleSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </span>
              </div>
              <div className="text-xs pl-6 sm:pl-0">
                PO: <strong>{txn.currency || "INR"} {txnTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                {!matched && <span className="ml-2 text-destructive font-medium">(Diff: {diff.toFixed(2)})</span>}
              </div>
            </div>
          )
        })()}

        {/* Error */}
        {submitError && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {submitError}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => txn.status !== "pending" ? router.push(`/${company}/inward/${transactionNo}`) : setShowDiscard(true)}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" /> {txn.status !== "pending" ? "Back" : "Cancel"}
          </Button>
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={submitting}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Approve
          </Button>
        </div>

        {/* Discard Changes Dialog */}
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
                onClick={() => router.push(`/${company}/inward/${transactionNo}`)}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Discard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Box Confirmation */}
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
                className="bg-destructive text-white hover:bg-destructive/90"
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
      </div>
    </PermissionGuard>
  )
}
