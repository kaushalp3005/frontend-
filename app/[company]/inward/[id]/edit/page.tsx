"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft, Save, Loader2, AlertCircle, Plus, Box, Package, Printer,
} from "lucide-react"
import {
  inwardApiService,
  type Company,
  type InwardDetailResponse,
  type UpdateInwardPayload,
  type BoxV2,
} from "@/types/inward"
import { useToast } from "@/hooks/use-toast"
import { PermissionGuard } from "@/components/auth/permission-gate"
import QRCode from "qrcode"
import { ArticleEditor, type ArticleFields } from "@/components/modules/inward/ArticleEditor"

interface EditInwardPageProps {
  params: { company: Company; id: string }
}

type ArticleEdit = ArticleFields

export default function EditInwardPage({ params }: EditInwardPageProps) {
  const { company, id: transactionNo } = params
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Preserved transaction fields (not editable but required by backend)
  const [entryDate, setEntryDate] = useState("")

  // Editable transaction fields (PO Extract fields only)
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

  // Articles
  const [articles, setArticles] = useState<ArticleEdit[]>([])

  // Existing boxes from backend (preserved on save)
  const [existingBoxes, setExistingBoxes] = useState<Array<{
    transaction_no: string; article_description: string; box_number: number;
    net_weight?: number; gross_weight?: number; lot_number?: string; count?: number;
    box_id?: string;
  }>>([])

  // Bulk add boxes
  const [bulkAddArticle, setBulkAddArticle] = useState<string | null>(null)
  const [bulkAddQty, setBulkAddQty] = useState("")
  const [bulkAddNetWeight, setBulkAddNetWeight] = useState("")
  const [bulkAddGrossWeight, setBulkAddGrossWeight] = useState("")
  const [addingBulkBoxes, setAddingBulkBoxes] = useState(false)

  // Submit
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [originalValues, setOriginalValues] = useState<Record<string, any>>({})

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

        const txn = detail.transaction
        setEntryDate(txn.entry_date || "")
        setVendor(txn.vendor_supplier_name || "")
        setCustomer(txn.customer_party_name || "")
        setSource(txn.source_location || "")
        setDestination(txn.destination_location || "")
        setPoNumber(txn.po_number || "")
        setPurchasedBy(txn.purchased_by || "")
        setTotalAmount(txn.total_amount?.toString() || "")
        setTaxAmount(txn.tax_amount?.toString() || "")
        setDiscountAmount(txn.discount_amount?.toString() || "")
        setPoQuantity(txn.po_quantity?.toString() || "")
        setCurrency(txn.currency || "INR")

        setOriginalValues({
          vendor_supplier_name: txn.vendor_supplier_name,
          customer_party_name: txn.customer_party_name,
          source_location: txn.source_location,
          destination_location: txn.destination_location,
          po_number: txn.po_number,
          purchased_by: txn.purchased_by,
          total_amount: txn.total_amount,
          tax_amount: txn.tax_amount,
          discount_amount: txn.discount_amount,
          po_quantity: txn.po_quantity,
          currency: txn.currency,
        })

        setArticles(
          detail.articles.map((a) => ({
            item_description: a.item_description,
            po_weight: a.po_weight,
            sku_id: a.sku_id,
            material_type: a.material_type,
            item_category: a.item_category,
            sub_category: a.sub_category,
          }))
        )

        // Preserve existing boxes so save doesn't wipe them out
        setExistingBoxes(
          detail.boxes.map((b) => ({
            transaction_no: transactionNo,
            article_description: b.article_description,
            box_number: b.box_number,
            net_weight: b.net_weight,
            gross_weight: b.gross_weight,
            lot_number: b.lot_number,
            count: b.count,
            box_id: b.box_id,
          }))
        )
      } catch (err) {
        console.error("Failed to load entry:", err)
        setError(err instanceof Error ? err.message : "Failed to load entry")
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [company, transactionNo, router])

  const handleSave = async () => {
    try {
      setSaving(true)
      setSaveError(null)

      // Validate mandatory fields
      const missing: string[] = []
      if (!vendor.trim()) missing.push("Vendor / Supplier")
      if (!customer.trim()) missing.push("Customer / Party")
      if (!source.trim()) missing.push("Source Location")
      if (!destination.trim()) missing.push("Destination Location")
      if (!purchasedBy.trim()) missing.push("Indentor")
      articles.forEach((a, i) => {
        if (!a.item_description?.trim()) missing.push(`Article ${i + 1} — Item Description`)
      })
      if (missing.length > 0) {
        setSaveError(`Please fill in: ${missing.join(", ")}`)
        setSaving(false)
        return
      }

      const payload: UpdateInwardPayload = {
        company,
        transaction: {
          transaction_no: transactionNo,
          entry_date: entryDate,
          vendor_supplier_name: vendor || originalValues.vendor_supplier_name || undefined,
          customer_party_name: customer || originalValues.customer_party_name || undefined,
          source_location: source || originalValues.source_location || undefined,
          destination_location: destination || originalValues.destination_location || undefined,
          po_number: poNumber || originalValues.po_number || undefined,
          purchased_by: purchasedBy || originalValues.purchased_by || undefined,
          total_amount: totalAmount ? parseFloat(totalAmount) : originalValues.total_amount || undefined,
          tax_amount: taxAmount ? parseFloat(taxAmount) : originalValues.tax_amount || undefined,
          discount_amount: discountAmount ? parseFloat(discountAmount) : originalValues.discount_amount || undefined,
          po_quantity: poQuantity ? parseFloat(poQuantity) : originalValues.po_quantity || undefined,
          currency: currency || originalValues.currency || undefined,
        },
        articles: articles.map((a) => ({
          transaction_no: transactionNo,
          item_description: a.item_description,
          po_weight: a.po_weight,
          sku_id: a.sku_id ?? undefined,
          material_type: a.material_type,
          item_category: a.item_category,
          sub_category: a.sub_category,
        })),
        boxes: (() => {
          // Keep existing boxes, add a default box for any new article without boxes
          const articleDescs = new Set(articles.map((a) => a.item_description))
          const kept = existingBoxes.filter((b) => articleDescs.has(b.article_description))
          const articlesWithBoxes = new Set(kept.map((b) => b.article_description))
          const newDefaults = articles
            .filter((a) => !articlesWithBoxes.has(a.item_description))
            .map((a) => ({
              transaction_no: transactionNo,
              article_description: a.item_description,
              box_number: 1,
            }))
          return [...kept, ...newDefaults]
        })(),
      }

      await inwardApiService.updateInward(company, transactionNo, payload)
      router.push(`/${company}/inward/${transactionNo}`)
    } catch (err) {
      console.error("Save failed:", err)
      setSaveError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const removeArticle = (index: number) => {
    setArticles((prev) => prev.filter((_, i) => i !== index))
  }

  const addArticle = () => {
    setArticles((prev) => [
      ...prev,
      { item_description: "" },
    ])
  }

  const updateArticle = (index: number, field: keyof ArticleFields, value: any) => {
    setArticles((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a))
    )
  }

  const formatDate = (d: string) => {
    if (!d) return ""
    try {
      return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })
    } catch { return "" }
  }

  const printBulkLabels = async (
    boxes: Array<{
      box_id: string
      box_number: number
      article_description: string
      net_weight?: number
      gross_weight?: number
    }>,
  ) => {
    const qrCodes = await Promise.all(
      boxes.map((box) =>
        QRCode.toDataURL(JSON.stringify({ tx: transactionNo, bi: box.box_id }), {
          width: 170,
          margin: 1,
          errorCorrectionLevel: "M",
        })
      )
    )

    const labelsHtml = boxes.map((box, i) => `
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
            <div class="detail"><b>Box #${box.box_number}</b> &nbsp; Net: ${box.net_weight ?? "\u2014"}kg &nbsp; Gross: ${box.gross_weight ?? "\u2014"}kg</div>
            <div class="detail">Entry: ${formatDate(entryDate)}</div>
          </div>
          <div class="lot">${customer ? customer : ""}</div>
        </div>
      </div>
    `).join("\n")

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
      .lot { font-family: monospace; border-top: 1px solid #ccc; padding-top: 2px; font-size: 6.5pt; }
    </style></head><body>
      ${labelsHtml}
      <script>
        window.onafterprint = function() { window.parent.postMessage('print-complete', '*'); };
        window.onload = function() {
          setTimeout(function() { window.print(); }, 400);
        };
      </script>
    </body></html>`)
    doc.close()

    // Clean up iframe after print or timeout — don't block the caller
    const cleanup = (e: MessageEvent) => {
      if (e.data === "print-complete") {
        window.removeEventListener("message", cleanup)
        if (document.body.contains(iframe)) document.body.removeChild(iframe)
      }
    }
    window.addEventListener("message", cleanup)

    // Fallback cleanup after 10s
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe)
        window.removeEventListener("message", cleanup)
      }
    }, 10000)
  }

  const handleBulkAddBoxes = async (articleDescription: string) => {
    const qty = parseInt(bulkAddQty) || 0
    if (qty < 1) return

    setAddingBulkBoxes(true)
    try {
      const articleBoxes = existingBoxes.filter((b) => b.article_description === articleDescription)
      const startNum = articleBoxes.length > 0
        ? Math.max(...articleBoxes.map((b) => b.box_number)) + 1
        : 1

      // Create all boxes in parallel for speed
      const netWt = bulkAddNetWeight ? parseFloat(bulkAddNetWeight) : undefined
      const grossWt = bulkAddGrossWeight ? parseFloat(bulkAddGrossWeight) : undefined

      const upsertPromises = Array.from({ length: qty }, (_, i) => {
        const boxNumber = startNum + i
        return inwardApiService.upsertBox(company, transactionNo, {
          article_description: articleDescription,
          box_number: boxNumber,
          net_weight: netWt,
          gross_weight: grossWt,
        }).then((res) => ({
          transaction_no: transactionNo,
          article_description: articleDescription,
          box_number: boxNumber,
          net_weight: netWt,
          gross_weight: grossWt,
          box_id: res.box_id,
        }))
      })

      const newBoxes = await Promise.all(upsertPromises)

      setExistingBoxes((prev) => [...prev, ...newBoxes])

      // Fire-and-forget print — don't block UI
      const printableBoxes = newBoxes.filter((b) => b.box_id)
      if (printableBoxes.length > 0) {
        printBulkLabels(
          printableBoxes.map((b) => ({
            box_id: b.box_id!,
            box_number: b.box_number,
            article_description: b.article_description,
            net_weight: b.net_weight,
            gross_weight: b.gross_weight,
          }))
        )
      }

      toast({
        title: "Boxes Added",
        description: `${qty} new boxes added to ${articleDescription}. Print dialog opening...`,
      })

      setBulkAddArticle(null)
      setBulkAddQty("")
      setBulkAddNetWeight("")
      setBulkAddGrossWeight("")
    } catch (err) {
      console.error("Bulk add boxes failed:", err)
      toast({
        title: "Failed to add boxes",
        description: err instanceof Error ? err.message : "Failed to add boxes",
        variant: "destructive",
      })
    } finally {
      setAddingBulkBoxes(false)
    }
  }

  if (loading) {
    return (
      <div className="p-3 sm:p-4 md:p-6 max-w-[900px] mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-3 sm:p-4 md:p-6 max-w-[900px] mx-auto">
        <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-4 py-3 rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
        <Button variant="outline" className="mt-4 gap-1.5" onClick={() => router.push(`/${company}/inward`)}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
    )
  }

  return (
    <PermissionGuard module="inward" action="edit" showError>
      <div className="p-3 sm:p-4 md:p-6 max-w-[900px] mx-auto space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => router.push(`/${company}/inward/${transactionNo}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight">Edit Entry</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">Transaction {transactionNo} — PO data</p>
          </div>
        </div>

        {/* Transaction details */}
        <Card>
          <CardHeader className="pb-3 px-3 sm:px-6">
            <CardTitle className="text-base">Transaction Details</CardTitle>
            <CardDescription className="text-xs">Edit PO-extracted transaction fields</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-3 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Vendor / Supplier <span className="text-destructive">*</span></Label>
                <Input value={vendor} onChange={(e) => setVendor(e.target.value)} className="h-9" />
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Currency</Label>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-9" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Articles with editable cascading dropdowns */}
        <Card>
          <CardHeader className="pb-3 px-3 sm:px-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="text-base">Articles ({articles.length})</CardTitle>
                <CardDescription className="text-xs">Edit article SKU hierarchy and details</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-1 text-xs flex-shrink-0" onClick={addArticle}>
                <Plus className="h-3 w-3" />
                <span className="hidden sm:inline">Add Article</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 px-3 sm:px-6">
            {articles.map((article, idx) => (
              <ArticleEditor
                key={idx}
                article={article}
                index={idx}
                company={company}
                onChange={updateArticle}
                onRemove={removeArticle}
                removable={articles.length > 1}
              />
            ))}

            {articles.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No articles. Click &quot;Add Article&quot; to add one.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Boxes per Article */}
        <Card>
          <CardHeader className="pb-3 px-3 sm:px-6">
            <CardTitle className="text-base flex items-center gap-1.5">
              <Box className="h-4 w-4 text-muted-foreground" />
              Boxes ({existingBoxes.length})
            </CardTitle>
            <CardDescription className="text-xs">Existing boxes for each article — add more in bulk</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-3 sm:px-6">
            {articles.map((article, aIdx) => {
              const articleBoxes = existingBoxes
                .filter((b) => b.article_description === article.item_description)
                .sort((a, b) => a.box_number - b.box_number)
              return (
                <div key={aIdx} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{article.item_description}</p>
                      <p className="text-xs text-muted-foreground">{articleBoxes.length} boxes</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 flex-shrink-0"
                      onClick={() => {
                        if (bulkAddArticle === article.item_description) {
                          setBulkAddArticle(null)
                        } else {
                          setBulkAddArticle(article.item_description)
                          setBulkAddQty("")
                          setBulkAddNetWeight("")
                          setBulkAddGrossWeight("")
                        }
                      }}
                    >
                      <Plus className="h-3 w-3" /> Add Boxes
                    </Button>
                  </div>

                  {/* Existing boxes summary */}
                  {articleBoxes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {articleBoxes.map((box) => (
                        <Badge key={`${box.article_description}-${box.box_number}`} variant="outline" className="text-[10px] gap-1">
                          #{box.box_number}
                          {box.net_weight != null && <span>N:{box.net_weight}kg</span>}
                          {box.gross_weight != null && <span>G:{box.gross_weight}kg</span>}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Bulk Add Form */}
                  {bulkAddArticle === article.item_description && (
                    <div className="p-2.5 rounded-lg border bg-blue-50/50 space-y-2">
                      <p className="text-[11px] font-semibold text-muted-foreground">Bulk Add Boxes</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-0.5">
                          <Label className="text-[10px]">Quantity (boxes) <span className="text-destructive">*</span></Label>
                          <Input
                            type="number"
                            min="1"
                            value={bulkAddQty}
                            onChange={(e) => setBulkAddQty(e.target.value)}
                            placeholder="No. of boxes"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[10px]">Net Weight (per box)</Label>
                          <Input
                            type="number"
                            step="0.001"
                            value={bulkAddNetWeight}
                            onChange={(e) => setBulkAddNetWeight(e.target.value)}
                            placeholder="kg"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[10px]">Gross Weight (per box)</Label>
                          <Input
                            type="number"
                            step="0.001"
                            value={bulkAddGrossWeight}
                            onChange={(e) => setBulkAddGrossWeight(e.target.value)}
                            placeholder="kg"
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => handleBulkAddBoxes(article.item_description)}
                          disabled={addingBulkBoxes || !bulkAddQty || parseInt(bulkAddQty) < 1}
                        >
                          {addingBulkBoxes ? <Loader2 className="h-3 w-3 animate-spin" /> : <Printer className="h-3 w-3" />}
                          Add & Print {parseInt(bulkAddQty) || 0} Boxes
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setBulkAddArticle(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {articles.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No articles to show boxes for.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save / Cancel */}
        {saveError && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {saveError}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <Button variant="outline" size="sm" onClick={() => router.push(`/${company}/inward/${transactionNo}`)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || articles.length === 0} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>
    </PermissionGuard>
  )
}
