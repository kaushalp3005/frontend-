"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  ArrowLeft, Loader2, CheckCircle2, AlertCircle, Plus, Trash2,
  Printer, Package, Truck, X, Edit2,
} from "lucide-react"
import {
  inwardApiService,
  type Company,
  type BulkStickerPayload,
  type BulkStickerResponse,
  type BulkStickerArticleResponse,
  type BulkStickerBox,
} from "@/types/inward"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { ArticleEditor, type ArticleFields } from "@/components/modules/inward/ArticleEditor"
import { dropdownApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useAuthStore } from "@/lib/stores/auth"
import QRCode from "qrcode"

interface BulkStickerPageProps {
  params: { company: Company }
}

interface BulkArticleForm {
  item_description: string
  sku_id?: number | null
  material_type?: string
  item_category?: string
  sub_category?: string
  quality_grade: string
  uom: string
  po_quantity: string
  units: string
  quantity_units: string
  net_weight: string
  total_weight: string
  po_weight: string
  lot_number: string
  manufacturing_date: string
  expiry_date: string
  unit_rate: string
  total_amount: string
  carton_weight: string
  box_count: string
  box_net_weight: string
  box_gross_weight: string
}

const emptyArticleForm = (): BulkArticleForm => ({
  item_description: "",
  sku_id: null,
  quality_grade: "",
  uom: "",
  po_quantity: "",
  units: "",
  quantity_units: "",
  net_weight: "",
  total_weight: "",
  po_weight: "",
  lot_number: "",
  manufacturing_date: "",
  expiry_date: "",
  unit_rate: "",
  total_amount: "",
  carton_weight: "",
  box_count: "",
  box_net_weight: "",
  box_gross_weight: "",
})

export default function BulkStickerPage({ params }: BulkStickerPageProps) {
  const { company } = params
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuthStore()

  // Transaction fields
  const [vendor, setVendor] = useState("")
  const [customer, setCustomer] = useState("")
  const [source, setSource] = useState("")
  const [destination, setDestination] = useState("")
  const [poNumber, setPoNumber] = useState("")
  const [purchasedBy, setPurchasedBy] = useState("")
  const [totalAmount, setTotalAmount] = useState("")
  const [taxAmount, setTaxAmount] = useState("")
  const [discountAmount, setDiscountAmount] = useState("")
  const [poQuantity, setPoQuantity] = useState("")
  const [currency, setCurrency] = useState("INR")

  // Transport & document fields
  const [warehouse, setWarehouse] = useState("")
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [transporterName, setTransporterName] = useState("")
  const [lrNumber, setLrNumber] = useState("")
  const [challanNumber, setChallanNumber] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [grnNumber, setGrnNumber] = useState("")
  const [grnQuantity, setGrnQuantity] = useState("")
  const [systemGrnDate, setSystemGrnDate] = useState("")
  const [approvalAuthority, setApprovalAuthority] = useState("")
  const [isOtherManager, setIsOtherManager] = useState(false)
  const [remark, setRemark] = useState("")

  // Articles (with ArticleEditor for item selection)
  const [articles, setArticles] = useState<ArticleFields[]>([{ item_description: "", skuStatus: "idle" }])
  const [articleForms, setArticleForms] = useState<BulkArticleForm[]>([emptyArticleForm()])

  // Vendor dropdown
  const [vendorList, setVendorList] = useState<Array<{ id: number; vendor_name: string; location: string | null }>>([])
  const [vendorSearch, setVendorSearch] = useState("")
  const [showVendorDropdown, setShowVendorDropdown] = useState(false)
  const [isOtherVendor, setIsOtherVendor] = useState(false)
  const vendorRef = useRef<HTMLDivElement>(null)

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Result (after successful submission)
  const [result, setResult] = useState<BulkStickerResponse | null>(null)
  const [printingAll, setPrintingAll] = useState(false)
  const [printProgress, setPrintProgress] = useState("")

  // Add more boxes state (per article index in result)
  const [addMoreIdx, setAddMoreIdx] = useState<number | null>(null)
  const [addMoreQty, setAddMoreQty] = useState("")
  const [addMoreNetWeight, setAddMoreNetWeight] = useState("")
  const [addMoreGrossWeight, setAddMoreGrossWeight] = useState("")
  const [addingBoxes, setAddingBoxes] = useState(false)

  // Discard dialog
  const [showDiscard, setShowDiscard] = useState(false)

  // Fetch vendors on mount
  useEffect(() => {
    dropdownApi.getVendors().then(setVendorList).catch(console.error)
  }, [])

  // Close vendor dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (vendorRef.current && !vendorRef.current.contains(e.target as Node)) {
        setShowVendorDropdown(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filteredVendors = vendorSearch
    ? vendorList.filter((v) => v.vendor_name.toLowerCase().includes(vendorSearch.toLowerCase()))
    : vendorList

  const selectVendor = useCallback((v: { vendor_name: string; location: string | null }) => {
    setVendor(v.vendor_name)
    setVendorSearch(v.vendor_name)
    setSource(v.location || "")
    setIsOtherVendor(false)
    setShowVendorDropdown(false)
  }, [])

  const selectOtherVendor = useCallback(() => {
    setIsOtherVendor(true)
    setVendor("")
    setVendorSearch("")
    setSource("")
    setShowVendorDropdown(false)
  }, [])

  // Transaction number helper
  const generateTxnNo = (d: Date) =>
    `TR-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`

  // Article management
  const addArticle = () => {
    setArticles((prev) => [...prev, { item_description: "", skuStatus: "idle" }])
    setArticleForms((prev) => [...prev, emptyArticleForm()])
  }

  const removeArticle = (index: number) => {
    if (articles.length <= 1) return
    setArticles((prev) => prev.filter((_, i) => i !== index))
    setArticleForms((prev) => prev.filter((_, i) => i !== index))
  }

  const updateArticle = (index: number, field: keyof ArticleFields, value: any) => {
    setArticles((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)))
    if (field === "item_description") {
      setArticleForms((prev) =>
        prev.map((a, i) => (i === index ? { ...a, item_description: String(value) } : a))
      )
    }
    if (field === "unit_rate" || field === "total_amount") {
      setArticleForms((prev) =>
        prev.map((a, i) => (i === index ? { ...a, [field]: value?.toString() || "" } : a))
      )
    }
  }

  const updateArticleForm = (idx: number, field: keyof BulkArticleForm, value: string) => {
    setArticleForms((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a))
    )
  }

  // Submit
  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      setSubmitError(null)

      // Validate mandatory fields
      const missing: string[] = []
      if (!vendor.trim()) missing.push("Vendor / Supplier")
      if (!source.trim()) missing.push("Source Location")
      if (!customer.trim()) missing.push("Customer / Party")
      if (!destination.trim()) missing.push("Destination Location")
      if (!purchasedBy.trim()) missing.push("Indentor")
      if (!warehouse.trim()) missing.push("Warehouse")
      if (!vehicleNumber.trim()) missing.push("Vehicle Number")
      if (!transporterName.trim()) missing.push("Transporter")
      if (!approvalAuthority.trim()) missing.push("Inward Manager")
      articleForms.forEach((a, i) => {
        if (!a.item_description?.trim()) missing.push(`Article ${i + 1} — Item Description`)
        if (!a.box_count || parseInt(a.box_count) < 1) missing.push(`Article ${i + 1} — Box Count`)
      })
      if (missing.length > 0) {
        const message = `Please fill in: ${missing.join(", ")}`
        setSubmitError(message)
        toast({ title: "Required fields missing", description: message, variant: "destructive" })
        setSubmitting(false)
        return
      }

      const now = new Date()
      const txnNo = generateTxnNo(now)
      const entryDate = now.toISOString().split("T")[0]

      const payload: BulkStickerPayload = {
        company,
        transaction: {
          transaction_no: txnNo,
          entry_date: entryDate,
          vendor_supplier_name: vendor || undefined,
          customer_party_name: customer || undefined,
          source_location: source || undefined,
          destination_location: destination || undefined,
          po_number: poNumber || undefined,
          purchased_by: purchasedBy || undefined,
          total_amount: totalAmount ? parseFloat(totalAmount) : undefined,
          tax_amount: taxAmount ? parseFloat(taxAmount) : undefined,
          discount_amount: discountAmount ? parseFloat(discountAmount) : undefined,
          po_quantity: poQuantity ? parseFloat(poQuantity) : undefined,
          currency: currency || undefined,
          warehouse: warehouse || undefined,
          vehicle_number: vehicleNumber || undefined,
          transporter_name: transporterName || undefined,
          lr_number: lrNumber || undefined,
          challan_number: challanNumber || undefined,
          invoice_number: invoiceNumber || undefined,
          grn_number: grnNumber || undefined,
          grn_quantity: grnQuantity ? parseFloat(grnQuantity) : undefined,
          system_grn_date: systemGrnDate || undefined,
          approval_authority: approvalAuthority || undefined,
          remark: remark || undefined,
        },
        articles: articleForms.map((a) => ({
          transaction_no: txnNo,
          item_description: a.item_description,
          sku_id: articles.find((ar) => ar.item_description === a.item_description)?.sku_id ?? undefined,
          item_category: articles.find((ar) => ar.item_description === a.item_description)?.item_category,
          sub_category: articles.find((ar) => ar.item_description === a.item_description)?.sub_category,
          material_type: articles.find((ar) => ar.item_description === a.item_description)?.material_type,
          quality_grade: a.quality_grade || undefined,
          uom: a.uom || undefined,
          po_quantity: a.po_quantity ? parseFloat(a.po_quantity) : undefined,
          units: a.units || undefined,
          quantity_units: parseInt(a.box_count) || 1,
          net_weight: a.net_weight ? parseFloat(a.net_weight) : undefined,
          total_weight: a.total_weight ? parseFloat(a.total_weight) : undefined,
          po_weight: a.po_weight ? parseFloat(a.po_weight) : undefined,
          lot_number: a.lot_number || undefined,
          manufacturing_date: a.manufacturing_date || undefined,
          expiry_date: a.expiry_date || undefined,
          unit_rate: a.unit_rate ? parseFloat(a.unit_rate) : undefined,
          total_amount: a.total_amount ? parseFloat(a.total_amount) : undefined,
          carton_weight: a.carton_weight ? parseFloat(a.carton_weight) : undefined,
          box_count: parseInt(a.box_count) || 1,
          box_net_weight: a.box_net_weight ? parseFloat(a.box_net_weight) : undefined,
          box_gross_weight: a.box_gross_weight ? parseFloat(a.box_gross_weight) : undefined,
        })),
      }

      const response = await inwardApiService.createBulkSticker(payload)
      setResult(response)
      toast({
        title: "Bulk Sticker Entry Created",
        description: `Transaction ${response.transaction_no} — ${response.total_boxes_created} boxes generated.`,
      })
    } catch (err) {
      console.error("Submit failed:", err)
      const message = err instanceof Error ? err.message : "Failed to create entry"
      setSubmitError(message)
      toast({ title: "Failed to create entry", description: message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // Print helpers
  const formatDate = (d: string) => {
    if (!d) return ""
    try {
      return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })
    } catch { return "" }
  }

  const printSingleBox = async (
    txnNo: string,
    boxId: string,
    boxNumber: number,
    articleDesc: string,
    netWeight?: number,
    grossWeight?: number,
    lotNumber?: string,
    expiryDate?: string,
  ) => {
    const qrDataString = JSON.stringify({ tx: txnNo, bi: boxId })
    const qrCodeDataURL = await QRCode.toDataURL(qrDataString, {
      width: 170,
      margin: 1,
      errorCorrectionLevel: "M",
    })

    const entryDate = new Date().toISOString().split("T")[0]

    return new Promise<void>((resolve) => {
      const iframe = document.createElement("iframe")
      iframe.style.position = "fixed"
      iframe.style.left = "-9999px"
      iframe.style.top = "-9999px"
      iframe.style.width = "0"
      iframe.style.height = "0"
      document.body.appendChild(iframe)

      const doc = iframe.contentWindow?.document
      if (!doc) { resolve(); return }

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
              <div class="txn">${txnNo}</div>
              <div class="boxid">ID: ${boxId}</div>
            </div>
            <div class="item">${articleDesc}</div>
            <div>
              <div class="detail"><b>Box #${boxNumber}</b> &nbsp; Net: ${netWeight ?? "\u2014"}kg &nbsp; Gross: ${grossWeight ?? "\u2014"}kg</div>
              <div class="detail">Entry: ${formatDate(entryDate)}</div>
              ${expiryDate ? `<div class="detail exp">Exp: ${formatDate(expiryDate)}</div>` : ""}
            </div>
            <div class="lot">${(lotNumber || "").substring(0, 20)}${customer ? ` \u00b7 ${customer}` : ""}</div>
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
          if (document.body.contains(iframe)) document.body.removeChild(iframe)
          resolve()
        }
      }
      window.addEventListener("message", cleanup)

      // Fallback cleanup after 30s
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe)
          window.removeEventListener("message", cleanup)
        }
        resolve()
      }, 30000)
    })
  }

  // Build a multi-label document and print as one PDF
  const printBulkLabels = async (
    txnNo: string,
    boxes: Array<{
      box_id: string
      box_number: number
      article_description: string
      net_weight?: number
      gross_weight?: number
      lot_number?: string
      expiry_date?: string
    }>,
  ) => {
    setPrintProgress(`Generating ${boxes.length} labels...`)

    // Generate all QR codes in parallel
    const qrCodes = await Promise.all(
      boxes.map((box) =>
        QRCode.toDataURL(JSON.stringify({ tx: txnNo, bi: box.box_id }), {
          width: 170,
          margin: 1,
          errorCorrectionLevel: "M",
        })
      )
    )

    const entryDate = new Date().toISOString().split("T")[0]

    const labelsHtml = boxes.map((box, i) => `
      <div class="label">
        <div class="qr"><img src="${qrCodes[i]}" /></div>
        <div class="info">
          <div>
            <div class="company">${company}</div>
            <div class="txn">${txnNo}</div>
            <div class="boxid">ID: ${box.box_id}</div>
          </div>
          <div class="item">${box.article_description}</div>
          <div>
            <div class="detail"><b>Box #${box.box_number}</b> &nbsp; Net: ${box.net_weight ?? "\u2014"}kg &nbsp; Gross: ${box.gross_weight ?? "\u2014"}kg</div>
            <div class="detail">Entry: ${formatDate(entryDate)}</div>
            ${box.expiry_date ? `<div class="detail exp">Exp: ${formatDate(box.expiry_date)}</div>` : ""}
          </div>
          <div class="lot">${(box.lot_number || "").substring(0, 20)}${customer ? ` \u00b7 ${customer}` : ""}</div>
        </div>
      </div>
    `).join("\n")

    setPrintProgress(`Printing ${boxes.length} labels...`)

    return new Promise<void>((resolve) => {
      const iframe = document.createElement("iframe")
      iframe.style.position = "fixed"
      iframe.style.left = "-9999px"
      iframe.style.top = "-9999px"
      iframe.style.width = "0"
      iframe.style.height = "0"
      document.body.appendChild(iframe)

      const doc = iframe.contentWindow?.document
      if (!doc) { resolve(); return }

      doc.open()
      doc.write(`<!DOCTYPE html><html><head><title>Bulk Labels</title><style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { background: white; }
        @page { size: 4in 2in; margin: 0; padding: 0; }
        @media print {
          html, body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          * { visibility: visible; }
        }
        .label { width: 4in; height: 2in; background: white; border: 1px solid #000; display: flex; font-family: Arial, sans-serif; page-break-after: always; page-break-inside: avoid; }
        .label:last-child { page-break-after: auto; }
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
        ${labelsHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.onafterprint = function() { window.parent.postMessage('print-complete', '*'); };
            }, 500);
          };
        </script>
      </body></html>`)
      doc.close()

      const cleanup = (e: MessageEvent) => {
        if (e.data === "print-complete") {
          window.removeEventListener("message", cleanup)
          if (document.body.contains(iframe)) document.body.removeChild(iframe)
          resolve()
        }
      }
      window.addEventListener("message", cleanup)

      // Fallback cleanup after 60s (larger for bulk)
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe)
          window.removeEventListener("message", cleanup)
        }
        resolve()
      }, 60000)
    })
  }

  // Add more boxes to an existing article in the result
  const handleAddMoreBoxes = async (articleIdx: number) => {
    if (!result) return
    const articleGroup = result.articles_with_boxes[articleIdx]
    const qty = parseInt(addMoreQty) || 0
    if (qty < 1) {
      toast({ title: "Invalid quantity", description: "Enter at least 1 box to add.", variant: "destructive" })
      return
    }

    setAddingBoxes(true)
    try {
      const existingMaxBox = Math.max(...articleGroup.boxes.map((b) => b.box_number), 0)
      const newBoxes: BulkStickerBox[] = []

      for (let i = 0; i < qty; i++) {
        const boxNumber = existingMaxBox + i + 1
        const res = await inwardApiService.upsertBox(company as Company, result.transaction_no, {
          article_description: articleGroup.article_description,
          box_number: boxNumber,
          net_weight: addMoreNetWeight ? parseFloat(addMoreNetWeight) : undefined,
          gross_weight: addMoreGrossWeight ? parseFloat(addMoreGrossWeight) : undefined,
        })
        newBoxes.push({
          box_number: boxNumber,
          box_id: res.box_id,
          article_description: articleGroup.article_description,
          net_weight: addMoreNetWeight ? parseFloat(addMoreNetWeight) : undefined,
          gross_weight: addMoreGrossWeight ? parseFloat(addMoreGrossWeight) : undefined,
        })
      }

      // Update result state with new boxes
      setResult((prev) => {
        if (!prev) return prev
        const updated = { ...prev }
        updated.articles_with_boxes = updated.articles_with_boxes.map((ag, idx) => {
          if (idx !== articleIdx) return ag
          return {
            ...ag,
            boxes: [...ag.boxes, ...newBoxes],
            box_ids: [...ag.box_ids, ...newBoxes.map((b) => b.box_id)],
          }
        })
        updated.total_boxes_created = updated.articles_with_boxes.reduce((sum, ag) => sum + ag.boxes.length, 0)
        return updated
      })

      toast({
        title: "Boxes Added",
        description: `${qty} new boxes added to ${articleGroup.article_description}.`,
      })

      // Reset form
      setAddMoreIdx(null)
      setAddMoreQty("")
      setAddMoreNetWeight("")
      setAddMoreGrossWeight("")
    } catch (err) {
      console.error("Add boxes failed:", err)
      toast({
        title: "Failed to add boxes",
        description: err instanceof Error ? err.message : "Failed to add boxes",
        variant: "destructive",
      })
    } finally {
      setAddingBoxes(false)
    }
  }

  const handlePrintAll = async () => {
    if (!result) return
    setPrintingAll(true)
    try {
      const allBoxes = result.articles_with_boxes.flatMap((articleGroup) => {
        const af = articleForms.find((a) => a.item_description === articleGroup.article_description)
        return articleGroup.boxes.map((box) => ({
          ...box,
          expiry_date: af?.expiry_date,
        }))
      })
      await printBulkLabels(result.transaction_no, allBoxes)
      setPrintProgress("")
      toast({ title: "Print Complete", description: `Sent ${allBoxes.length} stickers to printer.` })
    } catch (err) {
      console.error("Print failed:", err)
      toast({ title: "Print failed", description: err instanceof Error ? err.message : "Failed to print", variant: "destructive" })
    } finally {
      setPrintingAll(false)
      setPrintProgress("")
    }
  }

  const handlePrintArticle = async (articleGroup: BulkStickerArticleResponse) => {
    if (!result) return
    const af = articleForms.find((a) => a.item_description === articleGroup.article_description)
    const boxes = articleGroup.boxes.map((box) => ({
      ...box,
      expiry_date: af?.expiry_date,
    }))
    await printBulkLabels(result.transaction_no, boxes)
  }

  // ═══════════════════ RESULT VIEW ═══════════════════
  if (result) {
    return (
      <PermissionGuard module="inward" action="create" showError>
        <div className="p-3 sm:p-4 md:p-6 max-w-[900px] mx-auto space-y-3 sm:space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push(`/${company}/inward`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">Bulk Stickers Created</h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {result.transaction_no} — {result.total_boxes_created} boxes across {result.articles_count} articles
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handlePrintAll}
              disabled={printingAll}
            >
              {printingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Print All ({result.total_boxes_created})
            </Button>
          </div>

          {printProgress && (
            <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 px-3 py-2 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin" />
              {printProgress}
            </div>
          )}

          {/* Article groups with boxes */}
          {result.articles_with_boxes.map((articleGroup, aIdx) => (
            <Card key={aIdx}>
              <CardHeader className="pb-3 px-3 sm:px-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-sm sm:text-base truncate">{articleGroup.article_description}</CardTitle>
                    <CardDescription className="text-xs">{articleGroup.boxes.length} boxes</CardDescription>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => {
                        if (addMoreIdx === aIdx) {
                          setAddMoreIdx(null)
                        } else {
                          setAddMoreIdx(aIdx)
                          setAddMoreQty("")
                          setAddMoreNetWeight("")
                          setAddMoreGrossWeight("")
                        }
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                      Add Boxes
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => handlePrintArticle(articleGroup)}
                    >
                      <Printer className="h-3 w-3" />
                      Print ({articleGroup.boxes.length})
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="space-y-2">
                  {articleGroup.boxes.map((box) => (
                    <div key={box.box_id} className="flex items-center justify-between p-2 border rounded text-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-medium">{box.box_number}</span>
                        </div>
                        <div>
                          <p className="text-xs font-mono text-muted-foreground">ID: {box.box_id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {box.net_weight != null && (
                          <Badge variant="outline" className="text-xs">Net: {box.net_weight}kg</Badge>
                        )}
                        {box.gross_weight != null && (
                          <Badge variant="outline" className="text-xs">Gross: {box.gross_weight}kg</Badge>
                        )}
                        {box.lot_number && (
                          <Badge variant="secondary" className="text-xs">{box.lot_number}</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            const af = articleForms.find((a) => a.item_description === box.article_description)
                            printSingleBox(
                              result.transaction_no, box.box_id, box.box_number,
                              box.article_description, box.net_weight, box.gross_weight,
                              box.lot_number, af?.expiry_date,
                            )
                          }}
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add More Boxes Form */}
                {addMoreIdx === aIdx && (
                  <div className="mt-3 p-3 border rounded-lg bg-muted/30 space-y-3">
                    <p className="text-xs font-semibold">Add More Boxes</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Quantity (boxes) <span className="text-destructive">*</span></Label>
                        <Input
                          type="number"
                          min="1"
                          value={addMoreQty}
                          onChange={(e) => setAddMoreQty(e.target.value)}
                          placeholder="Number of boxes"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Net Weight</Label>
                        <Input
                          type="number"
                          step="0.001"
                          value={addMoreNetWeight}
                          onChange={(e) => setAddMoreNetWeight(e.target.value)}
                          placeholder="kg per box"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Gross Weight</Label>
                        <Input
                          type="number"
                          step="0.001"
                          value={addMoreGrossWeight}
                          onChange={(e) => setAddMoreGrossWeight(e.target.value)}
                          placeholder="kg per box"
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => handleAddMoreBoxes(aIdx)}
                        disabled={addingBoxes}
                      >
                        {addingBoxes ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        Add {parseInt(addMoreQty) || 0} Boxes
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => setAddMoreIdx(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-center pt-2">
            <Button variant="outline" onClick={() => router.push(`/${company}/inward`)}>
              Back to Inward List
            </Button>
          </div>
        </div>
      </PermissionGuard>
    )
  }

  // ═══════════════════ FORM VIEW ═══════════════════
  return (
    <PermissionGuard module="inward" action="create" showError>
      <div className="p-3 sm:p-4 md:p-6 max-w-[900px] mx-auto space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowDiscard(true)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight">Bulk Sticker Entry</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Create entry with all boxes & stickers in one step</p>
          </div>
        </div>

        {/* Transaction Details */}
        <Card>
          <CardHeader className="pb-3 px-3 sm:px-6">
            <CardTitle className="text-base">Transaction Details</CardTitle>
            <CardDescription className="text-xs">Vendor, customer, and PO information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-3 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5" ref={vendorRef}>
                <Label className="text-xs">Vendor / Supplier <span className="text-destructive">*</span></Label>
                {isOtherVendor ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type vendor name..."
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value)}
                      className="h-9"
                    />
                    <Button
                      type="button" variant="ghost" size="sm" className="h-9 text-xs whitespace-nowrap"
                      onClick={() => { setIsOtherVendor(false); setVendor(""); setVendorSearch("") }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      placeholder="Search vendor..."
                      value={vendorSearch}
                      onChange={(e) => { setVendorSearch(e.target.value); setShowVendorDropdown(true) }}
                      onFocus={() => setShowVendorDropdown(true)}
                      className="h-9"
                    />
                    {showVendorDropdown && (
                      <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-popover shadow-md">
                        {filteredVendors.slice(0, 100).map((v) => (
                          <div
                            key={v.id}
                            className="cursor-pointer px-3 py-2 text-sm hover:bg-accent flex justify-between items-center"
                            onMouseDown={() => selectVendor(v)}
                          >
                            <span className="truncate font-medium">{v.vendor_name}</span>
                            {v.location && <span className="text-xs text-muted-foreground ml-2 truncate max-w-[40%]">{v.location}</span>}
                          </div>
                        ))}
                        {filteredVendors.length > 100 && (
                          <div className="px-3 py-1.5 text-xs text-muted-foreground text-center">{filteredVendors.length - 100} more — type to narrow</div>
                        )}
                        {filteredVendors.length === 0 && vendorSearch && (
                          <div className="px-3 py-2 text-sm text-muted-foreground text-center">No vendors found</div>
                        )}
                        <div className="cursor-pointer px-3 py-2 text-sm font-medium text-primary hover:bg-accent border-t" onMouseDown={selectOtherVendor}>
                          + Other (type manually)
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Customer / Party <span className="text-destructive">*</span></Label>
                <Input value={customer} onChange={(e) => setCustomer(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Source Location <span className="text-destructive">*</span></Label>
                <Input value={source} onChange={(e) => setSource(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Destination Location <span className="text-destructive">*</span></Label>
                <Input value={destination} onChange={(e) => setDestination(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">PO Number</Label>
                <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Indentor <span className="text-destructive">*</span></Label>
                <Input value={purchasedBy} onChange={(e) => setPurchasedBy(e.target.value)} className="h-9" />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Total Amount</Label>
                <Input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tax</Label>
                <Input type="number" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Discount</Label>
                <Input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">PO Qty</Label>
                <Input type="number" value={poQuantity} onChange={(e) => setPoQuantity(e.target.value)} className="h-9" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transport & Documents */}
        <Card>
          <CardHeader className="pb-3 px-3 sm:px-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  Transport & Documents
                </CardTitle>
                <CardDescription className="text-xs">Transport, warehouse, and approval details</CardDescription>
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
              <div className="space-y-1.5">
                <Label className="text-xs">Inward Manager <span className="text-destructive">*</span></Label>
                <Select
                  value={isOtherManager ? "__other__" : approvalAuthority}
                  onValueChange={(v) => {
                    if (v === "__other__") { setIsOtherManager(true); setApprovalAuthority("") }
                    else { setIsOtherManager(false); setApprovalAuthority(v) }
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

        {/* Articles */}
        <Card>
          <CardHeader className="pb-3 px-3 sm:px-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Articles & Box Configuration
                </CardTitle>
                <CardDescription className="text-xs">Select items and configure box count & weights for sticker generation</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={addArticle}>
                <Plus className="h-3 w-3" /> Add Article
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-3 sm:px-6">
            {articles.map((article, idx) => (
              <div key={idx} className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">Article {idx + 1}</Badge>
                  {articles.length > 1 && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeArticle(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* Item selection via ArticleEditor */}
                <ArticleEditor
                  article={article}
                  index={idx}
                  company={company}
                  onChange={updateArticle}
                  onRemove={() => {}}
                  removable={false}
                />

                {/* Approval-level fields */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2 border-t">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Quality Grade</Label>
                    <Input value={articleForms[idx]?.quality_grade || ""} onChange={(e) => updateArticleForm(idx, "quality_grade", e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">UOM</Label>
                    <Input value={articleForms[idx]?.uom || ""} onChange={(e) => updateArticleForm(idx, "uom", e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">PO Quantity</Label>
                    <Input type="number" value={articleForms[idx]?.po_quantity || ""} onChange={(e) => updateArticleForm(idx, "po_quantity", e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Received Qty <span className="text-muted-foreground text-[9px]">(= boxes)</span></Label>
                    <Input type="number" value={articleForms[idx]?.box_count || ""} readOnly className="h-9 bg-muted" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Net Weight</Label>
                    <Input type="number" value={articleForms[idx]?.net_weight || ""} onChange={(e) => updateArticleForm(idx, "net_weight", e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Total Weight</Label>
                    <Input type="number" value={articleForms[idx]?.total_weight || ""} onChange={(e) => updateArticleForm(idx, "total_weight", e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Lot Number</Label>
                    <Input value={articleForms[idx]?.lot_number || ""} onChange={(e) => updateArticleForm(idx, "lot_number", e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Carton Weight</Label>
                    <Input type="number" value={articleForms[idx]?.carton_weight || ""} onChange={(e) => updateArticleForm(idx, "carton_weight", e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Mfg Date</Label>
                    <Input type="date" value={articleForms[idx]?.manufacturing_date || ""} onChange={(e) => updateArticleForm(idx, "manufacturing_date", e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Expiry Date</Label>
                    <Input type="date" value={articleForms[idx]?.expiry_date || ""} onChange={(e) => updateArticleForm(idx, "expiry_date", e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Unit Rate</Label>
                    <Input type="number" value={articleForms[idx]?.unit_rate || ""} onChange={(e) => updateArticleForm(idx, "unit_rate", e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Total Amount</Label>
                    <Input type="number" value={articleForms[idx]?.total_amount || ""} onChange={(e) => updateArticleForm(idx, "total_amount", e.target.value)} className="h-9" />
                  </div>
                </div>

                {/* Box configuration */}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t bg-muted/30 -mx-3 px-3 py-3 rounded-b-lg">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Box Count <span className="text-destructive">*</span></Label>
                    <Input
                      type="number"
                      min="1"
                      value={articleForms[idx]?.box_count || ""}
                      onChange={(e) => updateArticleForm(idx, "box_count", e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Box Net Weight</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={articleForms[idx]?.box_net_weight || ""}
                      onChange={(e) => updateArticleForm(idx, "box_net_weight", e.target.value)}
                      placeholder="kg per box"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Box Gross Weight</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={articleForms[idx]?.box_gross_weight || ""}
                      onChange={(e) => updateArticleForm(idx, "box_gross_weight", e.target.value)}
                      placeholder="kg per box"
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Error */}
        {submitError && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {submitError}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <Button variant="outline" size="sm" onClick={() => setShowDiscard(true)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || articles.length === 0}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Create & Generate Stickers
          </Button>
        </div>

        {/* Discard Dialog */}
        <AlertDialog open={showDiscard} onOpenChange={setShowDiscard}>
          <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Discard changes?</AlertDialogTitle>
              <AlertDialogDescription>Any unsaved changes will be lost.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay</AlertDialogCancel>
              <AlertDialogAction onClick={() => router.push(`/${company}/inward`)}>Discard</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PermissionGuard>
  )
}
