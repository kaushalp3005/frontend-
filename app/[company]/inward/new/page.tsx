"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Upload, FileText, Loader2, ArrowLeft, CheckCircle2,
  AlertCircle, Sparkles, Send, Plus, PenLine, ChevronDown, X,
} from "lucide-react"
import {
  inwardApiService,
  type Company,
  type POExtractResponse,
  type MultiPOExtractResponse,
  type PageExtractResponse,
  type CreateInwardPayload,
} from "@/types/inward"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { dropdownApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { ArticleEditor, type ArticleFields } from "@/components/modules/inward/ArticleEditor"

/**
 * Merge per-page extraction results into a unified MultiPOExtractResponse.
 * Same PO number across pages → merge articles.
 * No PO number → append articles to the previous PO.
 * Empty page (T&C) → skip.
 */
function mergePageResults(pageResults: PageExtractResponse[]): MultiPOExtractResponse {
  const allPOs: POExtractResponse[] = []
  const seenPONumbers: Record<string, number> = {}

  for (const page of pageResults) {
    if (!page.purchase_orders || page.purchase_orders.length === 0) continue

    for (const po of page.purchase_orders) {
      const poNum = po.po_number?.trim() || null
      const articles = po.articles || []

      if (!poNum && articles.length === 0) continue

      const fillFields: (keyof POExtractResponse)[] = [
        "supplier_name", "customer_name", "source_location",
        "destination_location", "purchased_by", "currency",
        "total_amount", "tax_amount", "discount_amount", "po_quantity",
      ]

      if (poNum && poNum in seenPONumbers) {
        const existing = allPOs[seenPONumbers[poNum]]
        existing.articles = [...(existing.articles || []), ...articles]
        for (const f of fillFields) {
          if (!existing[f] && po[f]) {
            ;(existing as any)[f] = po[f]
          }
        }
      } else if (poNum) {
        seenPONumbers[poNum] = allPOs.length
        allPOs.push({ ...po, articles: [...articles] })
      } else {
        if (allPOs.length > 0) {
          const prev = allPOs[allPOs.length - 1]
          prev.articles = [...(prev.articles || []), ...articles]
          for (const f of fillFields) {
            if (!prev[f] && po[f]) {
              ;(prev as any)[f] = po[f]
            }
          }
        } else {
          allPOs.push({ ...po, articles: [...articles] })
        }
      }
    }
  }

  return { purchase_orders: allPOs }
}

interface NewInwardPageProps {
  params: { company: Company }
}

type Step = "choose" | "upload" | "review" | "multi-po"

interface EditablePO {
  supplier_name: string
  customer_name: string
  source_location: string
  destination_location: string
  po_number: string
  purchased_by: string
  total_amount: string
  tax_amount: string
  discount_amount: string
  po_quantity: string
  currency: string
  articles: ArticleFields[]
}

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
  const extractingRef = useRef(false) // sync guard against double-clicks
  const [extractionProgress, setExtractionProgress] = useState<{
    phase: "uploading" | "extracting" | "done"
    currentPage: number
    totalPages: number
  } | null>(null)

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

  // Vendor dropdown state
  const [vendorList, setVendorList] = useState<Array<{ id: number; vendor_name: string; location: string | null }>>([])
  const [vendorSearch, setVendorSearch] = useState("")
  const [showVendorDropdown, setShowVendorDropdown] = useState(false)
  const [isOtherVendor, setIsOtherVendor] = useState(false)
  const vendorRef = useRef<HTMLDivElement>(null)

  // Fetch vendors on mount
  useEffect(() => {
    dropdownApi.getVendors().then(setVendorList).catch(console.error)
  }, [])

  // Close dropdown on outside click
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

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Multi-PO state
  const [extractedPOs, setExtractedPOs] = useState<POExtractResponse[]>([])
  const [editablePOs, setEditablePOs] = useState<EditablePO[]>([])
  const [expandedPOs, setExpandedPOs] = useState<Set<number>>(new Set())
  const [multiSubmitProgress, setMultiSubmitProgress] = useState(0)

  // ── Step 1: Upload & Extract ──────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected && selected.type === "application/pdf") {
      setFile(selected)
      setExtractError(null)
    }
  }

  const handleExtract = async () => {
    if (!file || extractingRef.current) return
    extractingRef.current = true
    try {
      setExtracting(true)
      setExtractError(null)
      setExtractionProgress({ phase: "uploading", currentPage: 0, totalPages: 0 })

      // Phase 1: Upload PDF → get job_id + total_pages
      const uploadResult = await inwardApiService.uploadPOForExtraction(file)
      const { job_id, total_pages } = uploadResult

      setExtractionProgress({ phase: "extracting", currentPage: 0, totalPages: total_pages })

      // Phase 2: Extract each page sequentially
      const pageResults: PageExtractResponse[] = []
      for (let page = 1; page <= total_pages; page++) {
        setExtractionProgress({ phase: "extracting", currentPage: page, totalPages: total_pages })

        try {
          const pageResult = await inwardApiService.extractPOPage(job_id, page)
          pageResults.push(pageResult)
        } catch (pageErr) {
          console.warn(`Page ${page} extraction failed, skipping:`, pageErr)
          pageResults.push({
            job_id,
            page_num: page,
            total_pages,
            purchase_orders: [],
          })
        }
      }

      setExtractionProgress({ phase: "done", currentPage: total_pages, totalPages: total_pages })

      // Phase 3: Merge results client-side
      const merged = mergePageResults(pageResults)
      const pos = merged.purchase_orders

      if (!pos || pos.length === 0) {
        throw new Error("No purchase orders found in the PDF")
      }

      if (pos.length === 1) {
        // Single PO — populate form
        const data = pos[0]
        setVendor(data.supplier_name || "")
        setVendorSearch(data.supplier_name || "")
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

        const articlesWithSKU: ArticleFields[] = data.articles.map((a) => ({
          item_description: a.item_description,
          po_weight: a.po_weight,
          unit_rate: a.unit_rate,
          total_amount: a.total_amount,
          skuStatus: "idle" as const,
        }))
        setArticles(articlesWithSKU)
        setStep("review")

        articlesWithSKU.forEach((_, idx) => {
          lookupSKU(idx, data.articles[idx].item_description)
        })
      } else {
        // Multiple POs — build editable state and show summary step
        const editable: EditablePO[] = pos.map((po) => ({
          supplier_name: po.supplier_name || "",
          customer_name: po.customer_name || "",
          source_location: po.source_location || "",
          destination_location: po.destination_location || "",
          po_number: po.po_number || "",
          purchased_by: po.purchased_by || "",
          total_amount: po.total_amount?.toString() || "",
          tax_amount: po.tax_amount?.toString() || "",
          discount_amount: po.discount_amount?.toString() || "",
          po_quantity: po.po_quantity?.toString() || "",
          currency: po.currency || "INR",
          articles: (po.articles || []).map((a) => ({
            item_description: a.item_description,
            po_weight: a.po_weight,
            unit_rate: a.unit_rate,
            total_amount: a.total_amount,
            skuStatus: "idle" as const,
          })),
        }))
        setExtractedPOs(pos)
        setEditablePOs(editable)
        setExpandedPOs(new Set())
        setStep("multi-po")

        // Trigger SKU lookups for all articles across all POs
        editable.forEach((po, poIdx) => {
          po.articles.forEach((art, artIdx) => {
            lookupMultiPOSKU(poIdx, artIdx, art.item_description)
          })
        })
      }
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
      setExtractionProgress(null)
      extractingRef.current = false
    }
  }

  // ── Step 2: SKU Lookup per Article ────────────────────────
  const lookupSKU = async (index: number, itemDescription: string) => {
    setArticles((prev) =>
      prev.map((a, i) => (i === index ? { ...a, skuStatus: "loading" } : a))
    )
    try {
      const result = await inwardApiService.skuLookup(company, itemDescription)
      if (result.sku_id) {
        setArticles((prev) =>
          prev.map((a, i) =>
            i === index
              ? {
                  ...a,
                  sku_id: result.sku_id ?? undefined,
                  material_type: result.material_type ?? undefined,
                  item_category: result.item_category ?? undefined,
                  sub_category: result.sub_category ?? undefined,
                  skuStatus: "resolved",
                }
              : a
          )
        )
      } else {
        // SKU not found — mark as error so the user can manually select
        setArticles((prev) =>
          prev.map((a, i) =>
            i === index
              ? { ...a, skuStatus: "error", skuError: "No matching SKU — select manually" }
              : a
          )
        )
      }
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

  // ── Helper: generate transaction number from a Date ──────
  const generateTxnNo = (d: Date) =>
    `TR-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`

  // ── Step 3: Submit (single PO) ─────────────────────────────
  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      setSubmitError(null)

      const now = new Date()
      const txnNo = generateTxnNo(now)
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
          sku_id: a.sku_id ?? undefined,
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

  // ── Step 3b: Submit all POs (multi-PO) ─────────────────────
  const handleSubmitMulti = async () => {
    try {
      setSubmitting(true)
      setSubmitError(null)
      setMultiSubmitProgress(0)

      const baseTime = Date.now()
      const entryDate = new Date().toISOString().split("T")[0]
      const created: string[] = []

      for (let i = 0; i < editablePOs.length; i++) {
        const po = editablePOs[i]
        // Offset each PO by 1 second so transaction numbers are unique
        const txnTime = new Date(baseTime + i * 1000)
        const txnNo = generateTxnNo(txnTime)

        const payload: CreateInwardPayload = {
          company,
          transaction: {
            transaction_no: txnNo,
            entry_date: entryDate,
            vendor_supplier_name: po.supplier_name || undefined,
            customer_party_name: po.customer_name || undefined,
            source_location: po.source_location || undefined,
            destination_location: po.destination_location || undefined,
            po_number: po.po_number || undefined,
            purchased_by: po.purchased_by || undefined,
            total_amount: po.total_amount ? parseFloat(po.total_amount) : undefined,
            tax_amount: po.tax_amount ? parseFloat(po.tax_amount) : undefined,
            discount_amount: po.discount_amount ? parseFloat(po.discount_amount) : undefined,
            po_quantity: po.po_quantity ? parseFloat(po.po_quantity) : undefined,
            currency: po.currency || undefined,
          },
          articles: po.articles.map((a) => ({
            transaction_no: txnNo,
            item_description: a.item_description,
            po_weight: a.po_weight,
            sku_id: a.sku_id ?? undefined,
            material_type: a.material_type,
            item_category: a.item_category,
            sub_category: a.sub_category,
            unit_rate: a.unit_rate,
            total_amount: a.total_amount,
          })),
          boxes: po.articles.map((a, idx) => ({
            transaction_no: txnNo,
            article_description: a.item_description,
            box_number: idx + 1,
          })),
        }

        await inwardApiService.createInward(payload)
        created.push(txnNo)
        setMultiSubmitProgress(i + 1)
      }

      toast({
        title: "All Entries Created",
        description: `${created.length} inward entries created successfully.`,
      })
      router.push(`/${company}/inward`)
    } catch (err) {
      console.error("Multi-PO submit failed:", err)
      const message = err instanceof Error ? err.message : "Failed to create entries"
      setSubmitError(message)
      toast({
        title: "Failed to create entries",
        description: `${multiSubmitProgress} of ${editablePOs.length} created. ${message}`,
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

  // ── Multi-PO editing helpers ────────────────────────────────
  const togglePOExpand = (idx: number) => {
    setExpandedPOs((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const updateEditablePO = (poIdx: number, field: keyof EditablePO, value: string) => {
    setEditablePOs((prev) =>
      prev.map((po, i) => (i === poIdx ? { ...po, [field]: value } : po))
    )
  }

  const updateMultiPOArticle = (poIdx: number, artIdx: number, field: keyof ArticleFields, value: any) => {
    setEditablePOs((prev) =>
      prev.map((po, i) => {
        if (i !== poIdx) return po
        return {
          ...po,
          articles: po.articles.map((a, j) => (j === artIdx ? { ...a, [field]: value } : a)),
        }
      })
    )
  }

  const addMultiPOArticle = (poIdx: number) => {
    setEditablePOs((prev) =>
      prev.map((po, i) => {
        if (i !== poIdx) return po
        return { ...po, articles: [...po.articles, { item_description: "", skuStatus: "idle" as const }] }
      })
    )
  }

  const removeMultiPOArticle = (poIdx: number, artIdx: number) => {
    setEditablePOs((prev) =>
      prev.map((po, i) => {
        if (i !== poIdx) return po
        return { ...po, articles: po.articles.filter((_, j) => j !== artIdx) }
      })
    )
  }

  const removeEditablePO = (poIdx: number) => {
    setEditablePOs((prev) => prev.filter((_, i) => i !== poIdx))
    setExpandedPOs((prev) => {
      const next = new Set<number>()
      for (const idx of prev) {
        if (idx < poIdx) next.add(idx)
        else if (idx > poIdx) next.add(idx - 1)
      }
      return next
    })
  }

  const lookupMultiPOSKU = async (poIdx: number, artIdx: number, itemDescription: string) => {
    updateMultiPOArticle(poIdx, artIdx, "skuStatus", "loading")
    try {
      const result = await inwardApiService.skuLookup(company, itemDescription)
      if (result.sku_id) {
        setEditablePOs((prev) =>
          prev.map((po, i) => {
            if (i !== poIdx) return po
            return {
              ...po,
              articles: po.articles.map((a, j) =>
                j === artIdx
                  ? {
                      ...a,
                      sku_id: result.sku_id ?? undefined,
                      material_type: result.material_type ?? undefined,
                      item_category: result.item_category ?? undefined,
                      sub_category: result.sub_category ?? undefined,
                      skuStatus: "resolved" as const,
                    }
                  : a
              ),
            }
          })
        )
      } else {
        // SKU not found — mark as error so the user can manually select
        setEditablePOs((prev) =>
          prev.map((po, i) => {
            if (i !== poIdx) return po
            return {
              ...po,
              articles: po.articles.map((a, j) =>
                j === artIdx
                  ? { ...a, skuStatus: "error" as const, skuError: "No matching SKU — select manually" }
                  : a
              ),
            }
          })
        )
      }
    } catch {
      setEditablePOs((prev) =>
        prev.map((po, i) => {
          if (i !== poIdx) return po
          return {
            ...po,
            articles: po.articles.map((a, j) =>
              j === artIdx ? { ...a, skuStatus: "error" as const, skuError: "Lookup failed" } : a
            ),
          }
        })
      )
    }
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
                    {extractionProgress?.phase === "uploading"
                      ? "Uploading PDF..."
                      : extractionProgress?.phase === "extracting"
                        ? `Extracting page ${extractionProgress.currentPage}/${extractionProgress.totalPages}...`
                        : "Finalizing..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Extract PO Data
                  </>
                )}
              </Button>

              {extracting && extractionProgress?.phase === "extracting" && extractionProgress.totalPages > 0 && (
                <div className="space-y-1.5">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(extractionProgress.currentPage / extractionProgress.totalPages) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Page {extractionProgress.currentPage} of {extractionProgress.totalPages}
                  </p>
                </div>
              )}

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

        {/* ═══════════════════ STEP 1b: Multi-PO Summary ═══════════════════ */}
        {step === "multi-po" && (
          <div className="space-y-3 sm:space-y-4">
            <Card>
              <CardHeader className="px-3 sm:px-6">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {editablePOs.length} Purchase Orders Found
                </CardTitle>
                <CardDescription>
                  The PDF contains multiple POs. Expand each to review and edit details. Each will be created as a separate inward entry.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-3 sm:px-6">
                {editablePOs.map((po, idx) => {
                  const isExpanded = expandedPOs.has(idx)
                  const hasSkuError = po.articles.some((a) => a.skuStatus === "error")
                  return (
                    <div key={idx} className={cn(
                      "border rounded-lg overflow-hidden",
                      hasSkuError && "border-red-500 border-2 bg-red-50/30 dark:bg-red-950/20"
                    )}>
                      {/* Collapsed header — always visible */}
                      <button
                        type="button"
                        className="w-full flex items-center justify-between gap-2 p-3 hover:bg-muted/40 transition-colors text-left"
                        onClick={() => togglePOExpand(idx)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-semibold flex-shrink-0">PO #{idx + 1}</span>
                          {po.po_number && (
                            <Badge variant="outline" className="text-xs">{po.po_number}</Badge>
                          )}
                          {po.supplier_name && (
                            <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                              — {po.supplier_name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {po.articles.length} article{po.articles.length !== 1 ? "s" : ""}
                          </span>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform",
                              isExpanded && "rotate-180"
                            )}
                          />
                          <button
                            type="button"
                            className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeEditablePO(idx)
                            }}
                            title="Remove this PO"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </button>

                      {/* Collapsed summary */}
                      {!isExpanded && (
                        <div className="px-3 pb-3 pt-0">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {po.supplier_name && (
                              <span>Supplier: <span className="text-foreground">{po.supplier_name}</span></span>
                            )}
                            {po.customer_name && (
                              <span>Customer: <span className="text-foreground">{po.customer_name}</span></span>
                            )}
                            {po.total_amount && (
                              <span>Amount: <span className="text-foreground">{po.currency || "INR"} {po.total_amount}</span></span>
                            )}
                            <span>Articles: <span className="text-foreground">{po.articles.length}</span></span>
                          </div>
                          {po.articles.length > 0 && (
                            <div className="text-xs text-muted-foreground pl-2 border-l-2 border-muted space-y-0.5 mt-2">
                              {po.articles.map((a, aIdx) => (
                                <div key={aIdx} className="truncate">
                                  {a.item_description}
                                  {a.po_weight != null && <span className="ml-1">({a.po_weight} kg)</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expanded editable form */}
                      {isExpanded && (
                        <div className="border-t px-3 pb-3 pt-3 space-y-4">
                          {/* Transaction fields */}
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2">Transaction Details</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Vendor / Supplier</Label>
                                <Input
                                  value={po.supplier_name}
                                  onChange={(e) => updateEditablePO(idx, "supplier_name", e.target.value)}
                                  placeholder="Vendor name"
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Customer / Party</Label>
                                <Input
                                  value={po.customer_name}
                                  onChange={(e) => updateEditablePO(idx, "customer_name", e.target.value)}
                                  placeholder="Customer name"
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Source Location</Label>
                                <Input
                                  value={po.source_location}
                                  onChange={(e) => updateEditablePO(idx, "source_location", e.target.value)}
                                  placeholder="Source"
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Destination Location</Label>
                                <Input
                                  value={po.destination_location}
                                  onChange={(e) => updateEditablePO(idx, "destination_location", e.target.value)}
                                  placeholder="Destination"
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">PO Number</Label>
                                <Input
                                  value={po.po_number}
                                  onChange={(e) => updateEditablePO(idx, "po_number", e.target.value)}
                                  placeholder="PO number"
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Indentor</Label>
                                <Input
                                  value={po.purchased_by}
                                  onChange={(e) => updateEditablePO(idx, "purchased_by", e.target.value)}
                                  placeholder="Purchased by"
                                  className="h-9"
                                />
                              </div>
                            </div>

                            <Separator className="my-3" />

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Total Amount</Label>
                                <Input
                                  type="number"
                                  value={po.total_amount}
                                  onChange={(e) => updateEditablePO(idx, "total_amount", e.target.value)}
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Tax</Label>
                                <Input
                                  type="number"
                                  value={po.tax_amount}
                                  onChange={(e) => updateEditablePO(idx, "tax_amount", e.target.value)}
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Discount</Label>
                                <Input
                                  type="number"
                                  value={po.discount_amount}
                                  onChange={(e) => updateEditablePO(idx, "discount_amount", e.target.value)}
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">PO Qty</Label>
                                <Input
                                  type="number"
                                  value={po.po_quantity}
                                  onChange={(e) => updateEditablePO(idx, "po_quantity", e.target.value)}
                                  className="h-9"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Currency</Label>
                                <Input
                                  value={po.currency}
                                  onChange={(e) => updateEditablePO(idx, "currency", e.target.value)}
                                  className="h-9"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Articles */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-muted-foreground">
                                Articles ({po.articles.length})
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-xs h-7"
                                onClick={() => addMultiPOArticle(idx)}
                              >
                                <Plus className="h-3 w-3" />
                                Add
                              </Button>
                            </div>
                            <div className="space-y-3">
                              {po.articles.map((article, artIdx) => (
                                <ArticleEditor
                                  key={artIdx}
                                  article={article}
                                  index={artIdx}
                                  company={company}
                                  onChange={(i, field, value) => updateMultiPOArticle(idx, i, field, value)}
                                  onRemove={(i) => removeMultiPOArticle(idx, i)}
                                  onRetrySkuLookup={(i) =>
                                    lookupMultiPOSKU(idx, i, po.articles[i].item_description)
                                  }
                                  removable={po.articles.length > 1}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {submitError && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {submitError}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStep("upload")
                  setExtractedPOs([])
                  setEditablePOs([])
                  setExpandedPOs(new Set())
                }}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleSubmitMulti}
                disabled={submitting || editablePOs.length === 0}
                className="gap-1.5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating {multiSubmitProgress}/{editablePOs.length}...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Create All {editablePOs.length} Entries
                  </>
                )}
              </Button>
            </div>
          </div>
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
                  <div className="space-y-1.5" ref={vendorRef}>
                    <Label className="text-xs">Vendor / Supplier</Label>
                    {isOtherVendor ? (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Type vendor name..."
                          value={vendor}
                          onChange={(e) => setVendor(e.target.value)}
                          className="h-9"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 text-xs whitespace-nowrap"
                          onClick={() => {
                            setIsOtherVendor(false)
                            setVendor("")
                            setVendorSearch("")
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Input
                          placeholder="Search vendor..."
                          value={vendorSearch}
                          onChange={(e) => {
                            setVendorSearch(e.target.value)
                            setShowVendorDropdown(true)
                          }}
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
                                {v.location && (
                                  <span className="text-xs text-muted-foreground ml-2 truncate max-w-[40%]">{v.location}</span>
                                )}
                              </div>
                            ))}
                            {filteredVendors.length > 100 && (
                              <div className="px-3 py-1.5 text-xs text-muted-foreground text-center">
                                {filteredVendors.length - 100} more — type to narrow
                              </div>
                            )}
                            {filteredVendors.length === 0 && vendorSearch && (
                              <div className="px-3 py-2 text-sm text-muted-foreground text-center">No vendors found</div>
                            )}
                            <div
                              className="cursor-pointer px-3 py-2 text-sm font-medium text-primary hover:bg-accent border-t"
                              onMouseDown={selectOtherVendor}
                            >
                              + Other (type manually)
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
