"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import {
  ArrowLeft, Save, Loader2, Snowflake, Printer, Plus, Package,
} from "lucide-react"
import { bulkEntryApi } from "@/lib/api/bulkEntryApiService"
import { getColdWarehouseCodes } from "@/lib/constants/warehouses"
import type { BulkEntryDetailResponse, BulkEntryBox } from "@/types/cold-storage"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { useToast } from "@/hooks/use-toast"
import QRCode from "qrcode"

interface BulkEntryEditPageProps {
  params: { company: string; txn: string }
}

export default function BulkEntryEditPage({ params }: BulkEntryEditPageProps) {
  const { company, txn: transactionNo } = params
  const router = useRouter()
  const { toast } = useToast()

  // Data fetch state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Transaction form fields
  const [vendorSupplierName, setVendorSupplierName] = useState("")
  const [customerPartyName, setCustomerPartyName] = useState("")
  const [sourceLocation, setSourceLocation] = useState("")
  const [destinationLocation, setDestinationLocation] = useState("")
  const [poNumber, setPoNumber] = useState("")
  const [purchasedBy, setPurchasedBy] = useState("")
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
  const [totalAmount, setTotalAmount] = useState("")
  const [taxAmount, setTaxAmount] = useState("")
  const [discountAmount, setDiscountAmount] = useState("")
  const [remark, setRemark] = useState("")
  const [originalValues, setOriginalValues] = useState<Record<string, any>>({})

  // Save state
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Boxes
  const [boxes, setBoxes] = useState<BulkEntryBox[]>([])

  // Bulk add boxes state
  const [bulkAddArticle, setBulkAddArticle] = useState<string | null>(null)
  const [bulkAddQty, setBulkAddQty] = useState("")
  const [bulkAddNetWeight, setBulkAddNetWeight] = useState("")
  const [bulkAddGrossWeight, setBulkAddGrossWeight] = useState("")
  const [addingBulkBoxes, setAddingBulkBoxes] = useState(false)

  // Print state
  const [printProgress, setPrintProgress] = useState("")

  // Fetch detail on mount
  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true)
        const detail: BulkEntryDetailResponse = await bulkEntryApi.getDetail(company, transactionNo)
        const txn = detail.transaction

        setVendorSupplierName(txn.vendor_supplier_name || "")
        setCustomerPartyName(txn.customer_party_name || "")
        setSourceLocation(txn.source_location || "")
        setDestinationLocation(txn.destination_location || "")
        setPoNumber(txn.po_number || "")
        setPurchasedBy(txn.purchased_by || "")
        setWarehouse(txn.warehouse || "")
        setVehicleNumber(txn.vehicle_number || "")
        setTransporterName(txn.transporter_name || "")
        setLrNumber(txn.lr_number || "")
        setChallanNumber(txn.challan_number || "")
        setInvoiceNumber(txn.invoice_number || "")
        setGrnNumber(txn.grn_number || "")
        setGrnQuantity(txn.grn_quantity != null ? String(txn.grn_quantity) : "")
        setSystemGrnDate(txn.system_grn_date || "")
        setApprovalAuthority(txn.approval_authority || "")
        setTotalAmount(txn.total_amount != null ? String(txn.total_amount) : "")
        setTaxAmount(txn.tax_amount != null ? String(txn.tax_amount) : "")
        setDiscountAmount(txn.discount_amount != null ? String(txn.discount_amount) : "")
        setRemark(txn.remark || "")

        setBoxes(detail.boxes || [])
        setOriginalValues({
          vendor_supplier_name: txn.vendor_supplier_name,
          customer_party_name: txn.customer_party_name,
          source_location: txn.source_location,
          destination_location: txn.destination_location,
          po_number: txn.po_number,
          purchased_by: txn.purchased_by,
          warehouse: txn.warehouse,
          vehicle_number: txn.vehicle_number,
          transporter_name: txn.transporter_name,
          lr_number: txn.lr_number,
          challan_number: txn.challan_number,
          invoice_number: txn.invoice_number,
          grn_number: txn.grn_number,
          grn_quantity: txn.grn_quantity,
          system_grn_date: txn.system_grn_date,
          approval_authority: txn.approval_authority,
          total_amount: txn.total_amount,
          tax_amount: txn.tax_amount,
          discount_amount: txn.discount_amount,
          remark: txn.remark,
        })
      } catch (err) {
        console.error("Failed to fetch detail:", err)
        setError(err instanceof Error ? err.message : "Failed to load entry")
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [company, transactionNo])

  // Save handler
  const handleSave = async () => {
    try {
      setSaving(true)
      setSaveError(null)

      await bulkEntryApi.update(company, transactionNo, {
        vendor_supplier_name: vendorSupplierName || originalValues.vendor_supplier_name || undefined,
        customer_party_name: customerPartyName || originalValues.customer_party_name || undefined,
        source_location: sourceLocation || originalValues.source_location || undefined,
        destination_location: destinationLocation || originalValues.destination_location || undefined,
        po_number: poNumber || originalValues.po_number || undefined,
        purchased_by: purchasedBy || originalValues.purchased_by || undefined,
        warehouse: warehouse || originalValues.warehouse || undefined,
        vehicle_number: vehicleNumber || originalValues.vehicle_number || undefined,
        transporter_name: transporterName || originalValues.transporter_name || undefined,
        lr_number: lrNumber || originalValues.lr_number || undefined,
        challan_number: challanNumber || originalValues.challan_number || undefined,
        invoice_number: invoiceNumber || originalValues.invoice_number || undefined,
        grn_number: grnNumber || originalValues.grn_number || undefined,
        grn_quantity: grnQuantity ? parseFloat(grnQuantity) : originalValues.grn_quantity || undefined,
        system_grn_date: systemGrnDate || originalValues.system_grn_date || undefined,
        approval_authority: approvalAuthority || originalValues.approval_authority || undefined,
        total_amount: totalAmount ? parseFloat(totalAmount) : originalValues.total_amount || undefined,
        tax_amount: taxAmount ? parseFloat(taxAmount) : originalValues.tax_amount || undefined,
        discount_amount: discountAmount ? parseFloat(discountAmount) : originalValues.discount_amount || undefined,
        remark: remark || originalValues.remark || undefined,
      })

      toast({ title: "Saved", description: "Transaction updated successfully." })
      router.push(`/${company}/cold-storage/entry/${encodeURIComponent(transactionNo)}`)
    } catch (err) {
      console.error("Save failed:", err)
      const message = err instanceof Error ? err.message : "Failed to save"
      setSaveError(message)
      toast({ title: "Save failed", description: message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // Group boxes by article_description
  const boxesByArticle: Record<string, BulkEntryBox[]> = {}
  boxes.forEach((box) => {
    const key = box.article_description || "Unknown"
    if (!boxesByArticle[key]) boxesByArticle[key] = []
    boxesByArticle[key].push(box)
  })

  // Print helpers
  const formatDate = (d: string) => {
    if (!d) return ""
    try {
      return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })
    } catch { return "" }
  }

  const printSingleBox = async (box: BulkEntryBox) => {
    const qrDataString = JSON.stringify({ tx: transactionNo, bi: box.box_id })
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
        .label { width: 4in; height: 2in; background: white; border: 1px solid #000; display: flex; font-family: Arial, sans-serif; overflow: hidden; page-break-after: avoid; page-break-inside: avoid; }
        .qr { width: 1.5in; height: 2in; display: flex; align-items: center; justify-content: center; padding: 0.08in; flex-shrink: 0; }
        .qr img { width: 1.3in; height: 1.3in; }
        .info { width: 2.5in; height: 2in; padding: 0.1in 0.12in; font-size: 7.5pt; line-height: 1.3; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; border-left: 1px solid #ccc; }
        .company { font-weight: bold; font-size: 8.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .txn { font-family: monospace; font-size: 6.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .boxid { font-family: monospace; font-size: 6pt; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .item { font-weight: bold; font-size: 7pt; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
        .detail { font-size: 6.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lot { font-family: monospace; border-top: 1px solid #ccc; padding-top: 2px; font-size: 6pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      </style></head><body>
        <div class="label">
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
              <div class="detail">Entry: ${formatDate(entryDate)}</div>
            </div>
            <div class="lot">${(box.lot_number || "").substring(0, 20)}${customerPartyName ? ` \u00b7 ${customerPartyName}` : ""}</div>
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

      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe)
          window.removeEventListener("message", cleanup)
        }
        resolve()
      }, 30000)
    })
  }

  const printBulkLabels = async (boxesToPrint: BulkEntryBox[]) => {
    setPrintProgress(`Generating ${boxesToPrint.length} labels...`)

    const qrCodes = await Promise.all(
      boxesToPrint.map((box) =>
        QRCode.toDataURL(JSON.stringify({ tx: transactionNo, bi: box.box_id }), {
          width: 170,
          margin: 1,
          errorCorrectionLevel: "M",
        })
      )
    )

    const entryDate = new Date().toISOString().split("T")[0]

    const labelsHtml = boxesToPrint.map((box, i) => `
      <div class="label">
        <div class="qr"><img src="${qrCodes[i]}" /></div>
        <div class="info">
          <div>
            <div class="company">${company}</div>
            <div class="txn">${transactionNo}</div>
            <div class="boxid">ID: ${box.box_id}</div>
          </div>
          <div class="item">${box.article_description}</div>
          <div>
            <div class="detail"><b>Box #${box.box_number}</b> | Net: ${box.net_weight ?? "\u2014"}kg | Gross: ${box.gross_weight ?? "\u2014"}kg</div>
            <div class="detail">Entry: ${formatDate(entryDate)}</div>
          </div>
          <div class="lot">${(box.lot_number || "").substring(0, 20)}${customerPartyName ? ` \u00b7 ${customerPartyName}` : ""}</div>
        </div>
      </div>
    `).join("\n")

    setPrintProgress(`Printing ${boxesToPrint.length} labels...`)

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
        .label { width: 4in; height: 2in; background: white; border: 1px solid #000; display: flex; font-family: Arial, sans-serif; overflow: hidden; page-break-after: always; page-break-inside: avoid; }
        .label:last-child { page-break-after: auto; }
        .qr { width: 1.5in; height: 2in; display: flex; align-items: center; justify-content: center; padding: 0.08in; flex-shrink: 0; }
        .qr img { width: 1.3in; height: 1.3in; }
        .info { width: 2.5in; height: 2in; padding: 0.1in 0.12in; font-size: 7.5pt; line-height: 1.3; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; border-left: 1px solid #ccc; }
        .company { font-weight: bold; font-size: 8.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .txn { font-family: monospace; font-size: 6.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .boxid { font-family: monospace; font-size: 6pt; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .item { font-weight: bold; font-size: 7pt; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
        .detail { font-size: 6.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lot { font-family: monospace; border-top: 1px solid #ccc; padding-top: 2px; font-size: 6pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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

      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe)
          window.removeEventListener("message", cleanup)
        }
        resolve()
      }, 60000)
    })
  }

  // Bulk add boxes handler
  const handleBulkAddBoxes = async (articleDescription: string) => {
    const qty = parseInt(bulkAddQty) || 0
    if (qty < 1) {
      toast({ title: "Invalid quantity", description: "Enter at least 1 box to add.", variant: "destructive" })
      return
    }

    setAddingBulkBoxes(true)
    try {
      const articleBoxes = boxes.filter((b) => b.article_description === articleDescription)
      const existingMaxBox = articleBoxes.length > 0
        ? Math.max(...articleBoxes.map((b) => b.box_number))
        : 0
      const newBoxes: BulkEntryBox[] = []

      for (let i = 0; i < qty; i++) {
        const boxNumber = existingMaxBox + i + 1
        const res = await bulkEntryApi.upsertBox(company, transactionNo, {
          article_description: articleDescription,
          box_number: boxNumber,
          net_weight: bulkAddNetWeight ? parseFloat(bulkAddNetWeight) : undefined,
          gross_weight: bulkAddGrossWeight ? parseFloat(bulkAddGrossWeight) : undefined,
        })
        newBoxes.push({
          transaction_no: transactionNo,
          box_number: boxNumber,
          box_id: res.box_id,
          article_description: articleDescription,
          net_weight: bulkAddNetWeight ? parseFloat(bulkAddNetWeight) : undefined,
          gross_weight: bulkAddGrossWeight ? parseFloat(bulkAddGrossWeight) : undefined,
        })
      }

      // Update local boxes state
      setBoxes((prev) => [...prev, ...newBoxes])

      toast({
        title: "Boxes Added",
        description: `${qty} new boxes added to ${articleDescription}.`,
      })

      // Auto-print new box labels
      await printBulkLabels(newBoxes)
      setPrintProgress("")

      // Reset form
      setBulkAddArticle(null)
      setBulkAddQty("")
      setBulkAddNetWeight("")
      setBulkAddGrossWeight("")
    } catch (err) {
      console.error("Add boxes failed:", err)
      toast({
        title: "Failed to add boxes",
        description: err instanceof Error ? err.message : "Failed to add boxes",
        variant: "destructive",
      })
    } finally {
      setAddingBulkBoxes(false)
    }
  }

  // ─── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-3 sm:p-4 md:p-6 max-w-[1000px] mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-7 w-48" />
        </div>
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Error state ────────────────────────────────────────────
  if (error) {
    return (
      <div className="p-3 sm:p-4 md:p-6 max-w-[1000px] mx-auto">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Snowflake className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href={`/${company}/cold-storage/entry/${encodeURIComponent(transactionNo)}`}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to detail
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  // ─── Main edit view ─────────────────────────────────────────
  return (
    <PermissionGuard module="cold-storage" action="view">
      <div className="p-3 sm:p-4 md:p-6 max-w-[1000px] mx-auto space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" asChild>
              <Link href={`/${company}/cold-storage/entry/${encodeURIComponent(transactionNo)}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">
                Edit {transactionNo}
              </h1>
            </div>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1 flex-shrink-0">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>

        {saveError && (
          <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
            {saveError}
          </div>
        )}

        {printProgress && (
          <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 px-3 py-2 rounded-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            {printProgress}
          </div>
        )}

        {/* Sticky Summary Bar */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex items-center justify-between gap-4 px-3 sm:px-4 py-2.5">
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Boxes: </span>
                <span className="font-semibold">{boxes.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Net: </span>
                <span className="font-semibold">
                  {parseFloat(boxes.reduce((sum, b) => sum + (b.net_weight || 0), 0).toFixed(3))} kg
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Gross: </span>
                <span className="font-semibold">
                  {parseFloat(boxes.reduce((sum, b) => sum + (b.gross_weight || 0), 0).toFixed(3))} kg
                </span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {Object.keys(boxesByArticle).length} articles
            </div>
          </div>
        </div>

        {/* Transaction Fields */}
        <Card>
          <CardHeader className="pb-3 px-3 sm:px-6">
            <CardTitle className="text-base">Transaction Details</CardTitle>
            <CardDescription className="text-xs">Edit vendor, transport, and document fields</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-3 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Vendor / Supplier</Label>
                <Input value={vendorSupplierName} onChange={(e) => setVendorSupplierName(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Customer / Party</Label>
                <Input value={customerPartyName} onChange={(e) => setCustomerPartyName(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Source Location</Label>
                <Input value={sourceLocation} onChange={(e) => setSourceLocation(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Destination Location</Label>
                <Input value={destinationLocation} onChange={(e) => setDestinationLocation(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">PO Number</Label>
                <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Purchased By</Label>
                <Input value={purchasedBy} onChange={(e) => setPurchasedBy(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Warehouse</Label>
                <Select value={warehouse} onValueChange={setWarehouse}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {getColdWarehouseCodes().map((code) => (
                      <SelectItem key={code} value={code}>{code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vehicle Number</Label>
                <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Transporter</Label>
                <Input value={transporterName} onChange={(e) => setTransporterName(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">LR Number</Label>
                <Input value={lrNumber} onChange={(e) => setLrNumber(e.target.value)} className="h-9" />
              </div>
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
                <Input type="number" step="0.01" value={grnQuantity} onChange={(e) => setGrnQuantity(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">GRN Date</Label>
                <Input type="date" value={systemGrnDate} onChange={(e) => setSystemGrnDate(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Approval Authority</Label>
                <Input value={approvalAuthority} onChange={(e) => setApprovalAuthority(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Total Amount</Label>
                <Input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tax Amount</Label>
                <Input type="number" step="0.01" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Discount Amount</Label>
                <Input type="number" step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} className="h-9" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Remark</Label>
              <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={2} className="resize-none" />
            </div>
          </CardContent>
        </Card>

        {/* Boxes Section */}
        <Card>
          <CardHeader className="pb-3 px-3 sm:px-6">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Boxes
            </CardTitle>
            <CardDescription className="text-xs">
              {boxes.length} boxes across {Object.keys(boxesByArticle).length} articles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-3 sm:px-6">
            {Object.entries(boxesByArticle).map(([articleDesc, articleBoxes]) => (
              <div key={articleDesc} className="border rounded-lg overflow-hidden">
                {/* Article group header */}
                <div className="flex items-center justify-between gap-2 p-3 bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{articleDesc}</p>
                    <p className="text-xs text-muted-foreground">
                      {articleBoxes.length} boxes
                      {(() => {
                        const net = articleBoxes.reduce((s, b) => s + (b.net_weight || 0), 0)
                        const gross = articleBoxes.reduce((s, b) => s + (b.gross_weight || 0), 0)
                        const parts: string[] = []
                        if (net > 0) parts.push(`Net: ${parseFloat(net.toFixed(3))}kg`)
                        if (gross > 0) parts.push(`Gross: ${parseFloat(gross.toFixed(3))}kg`)
                        return parts.length > 0 ? ` · ${parts.join(" · ")}` : ""
                      })()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs flex-shrink-0"
                    onClick={() => {
                      if (bulkAddArticle === articleDesc) {
                        setBulkAddArticle(null)
                      } else {
                        setBulkAddArticle(articleDesc)
                        setBulkAddQty("")
                        setBulkAddNetWeight("")
                        setBulkAddGrossWeight("")
                      }
                    }}
                  >
                    <Plus className="h-3 w-3" />
                    Add Boxes
                  </Button>
                </div>

                {/* Bulk add form */}
                {bulkAddArticle === articleDesc && (
                  <div className="p-3 border-b bg-muted/10 space-y-3">
                    <p className="text-xs font-semibold">Add More Boxes</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Quantity (boxes) <span className="text-destructive">*</span></Label>
                        <Input
                          type="number"
                          min="1"
                          value={bulkAddQty}
                          onChange={(e) => setBulkAddQty(e.target.value)}
                          placeholder="Number of boxes"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Net Weight</Label>
                        <Input
                          type="number"
                          step="0.001"
                          value={bulkAddNetWeight}
                          onChange={(e) => setBulkAddNetWeight(e.target.value)}
                          placeholder="kg per box"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Gross Weight</Label>
                        <Input
                          type="number"
                          step="0.001"
                          value={bulkAddGrossWeight}
                          onChange={(e) => setBulkAddGrossWeight(e.target.value)}
                          placeholder="kg per box"
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => handleBulkAddBoxes(articleDesc)}
                        disabled={addingBulkBoxes}
                      >
                        {addingBulkBoxes ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        Add {parseInt(bulkAddQty) || 0} Boxes
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => setBulkAddArticle(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Box rows */}
                <div className="divide-y">
                  {articleBoxes.map((box) => (
                    <div key={box.box_id} className="flex items-center justify-between p-2 px-3 text-sm">
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
                          onClick={() => printSingleBox(box)}
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {boxes.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No boxes found for this entry.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  )
}
