"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowLeft, Save, Loader2, AlertCircle, Plus,
} from "lucide-react"
import {
  inwardApiService,
  type Company,
  type InwardDetailResponse,
  type UpdateInwardPayload,
} from "@/types/inward"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { ArticleEditor, type ArticleFields } from "@/components/modules/inward/ArticleEditor"

interface EditInwardPageProps {
  params: { company: Company; id: string }
}

type ArticleEdit = ArticleFields

export default function EditInwardPage({ params }: EditInwardPageProps) {
  const { company, id: transactionNo } = params
  const router = useRouter()

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
  }>>([])

  // Submit
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

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

      const payload: UpdateInwardPayload = {
        company,
        transaction: {
          transaction_no: transactionNo,
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
        },
        articles: articles.map((a) => ({
          transaction_no: transactionNo,
          item_description: a.item_description,
          po_weight: a.po_weight,
          sku_id: a.sku_id,
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
                <Label className="text-xs">Vendor / Supplier</Label>
                <Input value={vendor} onChange={(e) => setVendor(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Customer / Party</Label>
                <Input value={customer} onChange={(e) => setCustomer(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Source Location</Label>
                <Input value={source} onChange={(e) => setSource(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Destination Location</Label>
                <Input value={destination} onChange={(e) => setDestination(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">PO Number</Label>
                <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Indentor</Label>
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
