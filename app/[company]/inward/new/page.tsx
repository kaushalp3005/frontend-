"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Upload, FileText, Loader2, ArrowLeft, CheckCircle2,
  AlertCircle, Sparkles, Send, Plus, PenLine,
} from "lucide-react"
import {
  inwardApiService,
  type Company,
  type POExtractResponse,
  type CreateInwardPayload,
} from "@/types/inward"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { ArticleEditor, type ArticleFields } from "@/components/modules/inward/ArticleEditor"

interface NewInwardPageProps {
  params: { company: Company }
}

type Step = "choose" | "upload" | "review"

export default function NewInwardPage({ params }: NewInwardPageProps) {
  const { company } = params
  const router = useRouter()
  const { toast } = useToast()

  // Step state
  const [step, setStep] = useState<Step>("choose")

  // Upload state
  const [file, setFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)

  // Articles
  const [articles, setArticles] = useState<ArticleFields[]>([])

  // Editable transaction fields
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

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Step 1: Upload & Extract ──────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected && selected.type === "application/pdf") {
      setFile(selected)
      setExtractError(null)
    }
  }

  const handleExtract = async () => {
    if (!file) return
    try {
      setExtracting(true)
      setExtractError(null)

      const data = await inwardApiService.extractPO(file)

      // Populate editable fields (backend returns supplier_name / customer_name)
      setVendor(data.supplier_name || "")
      setCustomer(data.customer_name || "")
      setSource(data.source_location || "")
      setDestination(data.destination_location || "")
      setPoNumber(data.po_number || "")
      setPurchasedBy(data.purchased_by || "")
      setTotalAmount(data.total_amount?.toString() || "")
      setTaxAmount(data.tax_amount?.toString() || "")
      setDiscountAmount(data.discount_amount?.toString() || "")
      setPoQuantity(data.po_quantity?.toString() || "")
      setCurrency(data.currency || "INR")

      // Initialize articles and trigger SKU lookups
      const articlesWithSKU: ArticleFields[] = data.articles.map((a) => ({
        item_description: a.item_description,
        po_weight: a.po_weight,
        unit_rate: a.unit_rate,
        total_amount: a.total_amount,
        skuStatus: "idle" as const,
      }))
      setArticles(articlesWithSKU)
      setStep("review")

      // Trigger SKU lookups for each article
      articlesWithSKU.forEach((_, idx) => {
        lookupSKU(idx, data.articles[idx].item_description)
      })
    } catch (err) {
      console.error("PO extraction failed:", err)
      const message = err instanceof Error ? err.message : "Failed to extract PO data"
      setExtractError(message)
      toast({
        title: "Extraction failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setExtracting(false)
    }
  }

  // ── Step 2: SKU Lookup per Article ────────────────────────
  const lookupSKU = async (index: number, itemDescription: string) => {
    setArticles((prev) =>
      prev.map((a, i) => (i === index ? { ...a, skuStatus: "loading" } : a))
    )
    try {
      const result = await inwardApiService.skuLookup(company, itemDescription)
      setArticles((prev) =>
        prev.map((a, i) =>
          i === index
            ? {
                ...a,
                sku_id: result.sku_id,
                material_type: result.material_type,
                item_category: result.item_category,
                sub_category: result.sub_category,
                skuStatus: "resolved",
              }
            : a
        )
      )
    } catch (err) {
      console.error(`SKU lookup failed for article ${index}:`, err)
      setArticles((prev) =>
        prev.map((a, i) =>
          i === index
            ? {
                ...a,
                skuStatus: "error",
                skuError: err instanceof Error ? err.message : "Lookup failed",
              }
            : a
        )
      )
    }
  }

  // ── Step 3: Submit ────────────────────────────────────────
  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      setSubmitError(null)

      const now = new Date()
      const txnNo = `TR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`
      const entryDate = now.toISOString().split("T")[0]

      const payload: CreateInwardPayload = {
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
        },
        articles: articles.map((a) => ({
          transaction_no: txnNo,
          item_description: a.item_description,
          po_weight: a.po_weight,
          sku_id: a.sku_id,
          material_type: a.material_type,
          item_category: a.item_category,
          sub_category: a.sub_category,
          unit_rate: a.unit_rate,
          total_amount: a.total_amount,
        })),
        boxes: articles.map((a, idx) => ({
          transaction_no: txnNo,
          article_description: a.item_description,
          box_number: idx + 1,
        })),
      }

      const result = await inwardApiService.createInward(payload)
      toast({
        title: "Entry Created",
        description: `Inward entry ${result.transaction_no} created successfully.`,
      })
      router.push(`/${company}/inward`)
    } catch (err) {
      console.error("Submit failed:", err)
      const message = err instanceof Error ? err.message : "Failed to create entry"
      setSubmitError(message)
      toast({
        title: "Failed to create entry",
        description: message,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const removeArticle = (index: number) => {
    setArticles((prev) => prev.filter((_, i) => i !== index))
  }

  const addArticle = () => {
    setArticles((prev) => [
      ...prev,
      { item_description: "", skuStatus: "idle" },
    ])
  }

  const updateArticle = (index: number, field: keyof ArticleFields, value: any) => {
    setArticles((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a))
    )
  }

  const allSKUsResolved = articles.length > 0 && articles.every((a) => a.skuStatus === "resolved")
  const someSKUsLoading = articles.some((a) => a.skuStatus === "loading")

  return (
    <PermissionGuard module="inward" action="create" showError>
      <div className="p-3 sm:p-4 md:p-6 max-w-[900px] mx-auto space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => router.push(`/${company}/inward`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight">New Inward Entry</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Upload a PO or enter details manually</p>
          </div>
        </div>

        {/* ═══════════════════ STEP 0: Choose Method ═══════════════════ */}
        {step === "choose" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Card
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => setStep("upload")}
            >
              <CardContent className="flex flex-col items-center justify-center gap-3 py-8 sm:py-10">
                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">Upload PO (PDF)</p>
                  <p className="text-xs text-muted-foreground mt-1">AI extracts supplier, items & amounts</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => {
                addArticle()
                setStep("review")
              }}
            >
              <CardContent className="flex flex-col items-center justify-center gap-3 py-8 sm:py-10">
                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <PenLine className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">Manual Entry</p>
                  <p className="text-xs text-muted-foreground mt-1">Fill in transaction & article details</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══════════════════ STEP 1: Upload ═══════════════════ */}
        {step === "upload" && (
          <Card>
            <CardHeader className="px-3 sm:px-6">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Upload Purchase Order
              </CardTitle>
              <CardDescription>
                Upload a PDF purchase order. AI will extract supplier, items, and amounts automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-3 sm:px-6">
              {/* Drop zone */}
              <label
                htmlFor="po-upload"
                className={cn(
                  "flex flex-col items-center justify-center gap-3 p-6 sm:p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                  file ? "border-primary/40 bg-primary/5" : "border-muted-foreground/20 hover:border-muted-foreground/40"
                )}
              >
                {file ? (
                  <>
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium break-all">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={(e) => { e.preventDefault(); setFile(null) }}
                    >
                      Remove
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">Click to upload or drag & drop</p>
                      <p className="text-xs text-muted-foreground">PDF files only</p>
                    </div>
                  </>
                )}
                <input
                  id="po-upload"
                  type="file"
                  accept=".pdf"
                  className="sr-only"
                  onChange={handleFileSelect}
                />
              </label>

              {extractError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {extractError}
                </div>
              )}

              <Button
                onClick={handleExtract}
                disabled={!file || extracting}
                className="w-full gap-2"
              >
                {extracting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Extracting with AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Extract PO Data
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                className="w-full gap-1.5 text-xs"
                onClick={() => setStep("choose")}
              >
                <ArrowLeft className="h-3 w-3" />
                Back to options
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════ STEP 2: Review & Edit ═══════════════════ */}
        {step === "review" && (
          <div className="space-y-3 sm:space-y-4">
            {/* Transaction details (editable) */}
            <Card>
              <CardHeader className="pb-3 px-3 sm:px-6">
                <CardTitle className="text-base">Transaction Details</CardTitle>
                <CardDescription className="text-xs">Review and edit transaction fields</CardDescription>
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
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base">Articles</CardTitle>
                    <CardDescription className="text-xs">
                      {articles.length} article{articles.length !== 1 ? "s" : ""} — select material type, category, and item
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    {someSKUsLoading && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="hidden sm:inline">Resolving SKUs...</span>
                      </Badge>
                    )}
                    {allSKUsResolved && (
                      <Badge variant="outline" className="gap-1 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        <span className="hidden sm:inline">All SKUs resolved</span>
                      </Badge>
                    )}
                    <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={addArticle}>
                      <Plus className="h-3 w-3" />
                      <span className="hidden sm:inline">Add Article</span>
                      <span className="sm:hidden">Add</span>
                    </Button>
                  </div>
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
                    onRetrySkuLookup={(i) => lookupSKU(i, articles[i].item_description)}
                    removable={articles.length > 1}
                  />
                ))}

                {articles.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No articles yet. Click &quot;Add Article&quot; to add one.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Submit / Back */}
            {submitError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {submitError}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStep("choose")
                  setArticles([])
                  setFile(null)
                }}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submitting || articles.length === 0}
                className="gap-1.5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Create Entry
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}
