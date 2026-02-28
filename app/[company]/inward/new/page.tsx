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
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  Upload, FileText, Loader2, ArrowLeft, CheckCircle2,
  AlertCircle, Sparkles, Send, Plus, PenLine, ChevronDown, X,
  Box, Truck, Trash2, Printer, MoreVertical, Pencil,
} from "lucide-react"
import {
  inwardApiService,
  type Company,
  type POExtractResponse,
  type MultiPOExtractResponse,
  type PageExtractResponse,
  type CreateInwardPayload,
  type ApprovePayload,
} from "@/types/inward"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { dropdownApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useAuthStore } from "@/lib/stores/auth"
import { ArticleEditor, type ArticleFields } from "@/components/modules/inward/ArticleEditor"
import QRCode from "qrcode"

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

interface ArticleApprovalForm {
  item_description: string
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
  const { user } = useAuthStore()

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

  // Transport & document fields (approve-level)
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
  const [isServiceOrder, setIsServiceOrder] = useState(false)
  const [isRtv, setIsRtv] = useState(false)

  // Article approval forms & boxes
  const [articleApprovalForms, setArticleApprovalForms] = useState<ArticleApprovalForm[]>([])
  const [boxForms, setBoxForms] = useState<BoxForm[]>([])

  // Box delete confirmation, edit tracking, printing
  const [deleteBoxIdx, setDeleteBoxIdx] = useState<number | null>(null)
  const [editingBoxIndices, setEditingBoxIndices] = useState<Set<number>>(new Set())
  const [editSnapshots, setEditSnapshots] = useState<Map<number, BoxForm>>(new Map())
  const [printingBoxIdx, setPrintingBoxIdx] = useState<number | null>(null)
  const [createdTxnNo, setCreatedTxnNo] = useState<string | null>(null)
  const [showDiscard, setShowDiscard] = useState(false)

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
        // Initialize approval forms for each article
        setArticleApprovalForms(articlesWithSKU.map((a) => ({
          item_description: a.item_description,
          quality_grade: "",
          uom: "",
          po_quantity: a.po_weight?.toString() || "",
          units: "",
          quantity_units: "",
          net_weight: "",
          total_weight: "",
          lot_number: "",
          manufacturing_date: "",
          expiry_date: "",
          unit_rate: a.unit_rate?.toString() || "",
          total_amount: a.total_amount?.toString() || "",
          carton_weight: "",
        })))
        setBoxForms([])
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

  // ── Helper: ensure entry is created (reused by submit and print) ──
  const ensureEntryCreated = async (): Promise<string> => {
    if (createdTxnNo) return createdTxnNo

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
    setCreatedTxnNo(result.transaction_no)
    return result.transaction_no
  }

  // ── Step 3: Submit (single PO) ─────────────────────────────
  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      setSubmitError(null)

      const txnNo = await ensureEntryCreated()

      // Step 2: Approve the entry with transport/document fields, article approval, and boxes
      try {
        const approvePayload: ApprovePayload = {
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
          articles: articleApprovalForms.map((a) => ({
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

        await inwardApiService.approveOrReject(company, txnNo, approvePayload)
      } catch (approveErr) {
        console.error("Approve failed (entry was created):", approveErr)
        const approveMsg = approveErr instanceof Error ? approveErr.message : "Failed to approve"
        toast({
          title: "Entry created but approval failed",
          description: `Entry ${txnNo} was created. Approval error: ${approveMsg}`,
          variant: "destructive",
        })
        router.push(`/${company}/inward`)
        return
      }

      toast({
        title: "Entry Created & Approved",
        description: `Inward entry ${txnNo} created and approved successfully.`,
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
    const removedDesc = articles[index]?.item_description
    setArticles((prev) => prev.filter((_, i) => i !== index))
    setArticleApprovalForms((prev) => prev.filter((_, i) => i !== index))
    if (removedDesc) {
      const newBoxes = boxForms.filter((b) => b.article_description !== removedDesc)
      setBoxForms(newBoxes)
    }
  }

  const addArticle = () => {
    setArticles((prev) => [
      ...prev,
      { item_description: "", skuStatus: "idle" },
    ])
    setArticleApprovalForms((prev) => [
      ...prev,
      {
        item_description: "",
        quality_grade: "",
        uom: "",
        po_quantity: "",
        units: "",
        quantity_units: "",
        net_weight: "",
        total_weight: "",
        lot_number: "",
        manufacturing_date: "",
        expiry_date: "",
        unit_rate: "",
        total_amount: "",
        carton_weight: "",
      },
    ])
  }

  const updateArticle = (index: number, field: keyof ArticleFields, value: any) => {
    setArticles((prev) => {
      const updated = prev.map((a, i) => (i === index ? { ...a, [field]: value } : a))
      // Sync item_description to approval forms
      if (field === "item_description") {
        const oldDesc = prev[index]?.item_description
        setArticleApprovalForms((af) =>
          af.map((a, i) => (i === index ? { ...a, item_description: String(value) } : a))
        )
        if (oldDesc) {
          setBoxForms((bf) =>
            bf.map((b) => b.article_description === oldDesc ? { ...b, article_description: String(value) } : b)
          )
        }
      }
      // Sync unit_rate and total_amount to approval forms
      if (field === "unit_rate" || field === "total_amount") {
        setArticleApprovalForms((af) =>
          af.map((a, i) => (i === index ? { ...a, [field]: value?.toString() || "" } : a))
        )
      }
      return updated
    })
  }

  // ── Approval-level article helpers ────────────────────────
  const updateArticleApproval = (idx: number, field: keyof ArticleApprovalForm, value: string) => {
    setArticleApprovalForms((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a))
    )

    const articleDesc = articleApprovalForms[idx]?.item_description
    if (!articleDesc) return

    // Propagate lot_number to all boxes of this article
    if (field === "lot_number") {
      setBoxForms((prev) =>
        prev.map((b) => b.article_description === articleDesc ? { ...b, lot_number: value } : b)
      )
    }

    // Recalculate box net_weight when carton_weight changes
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

  const recomputeArticleFromBoxes = (boxes: BoxForm[], articleDesc: string) => {
    const articleBoxes = boxes.filter((b) => b.article_description === articleDesc)
    const totalNet = articleBoxes.reduce((sum, b) => sum + (parseFloat(b.net_weight) || 0), 0)
    const totalGross = articleBoxes.reduce((sum, b) => sum + (parseFloat(b.gross_weight) || 0), 0)
    const boxCount = articleBoxes.length

    setArticleApprovalForms((prev) =>
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
    // Accept only positive integers
    const parsed = parseInt(value)
    if (value !== "" && (isNaN(parsed) || parsed < 0)) return
    const desired = value === "" ? 0 : parsed

    const articleDesc = articleApprovalForms[articleIdx]?.item_description
    if (!articleDesc) return

    // Update the field directly
    setArticleApprovalForms((prev) =>
      prev.map((a, i) => (i === articleIdx ? { ...a, quantity_units: value } : a))
    )

    const currentBoxes = boxForms.filter((b) => b.article_description === articleDesc)
    const currentCount = currentBoxes.length

    if (desired > currentCount) {
      // Add blank boxes at the end — existing boxes untouched
      const parentArticle = articleApprovalForms[articleIdx]
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
      // Remove boxes from the end — existing boxes untouched
      let removed = 0
      const toRemove = currentCount - desired
      const updatedBoxes = [...boxForms]
      // Remove from the end of this article's boxes
      for (let i = updatedBoxes.length - 1; i >= 0 && removed < toRemove; i--) {
        if (updatedBoxes[i].article_description === articleDesc) {
          updatedBoxes.splice(i, 1)
          removed++
        }
      }
      // Renumber remaining boxes for this article
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

  // Recompute only weights (not quantity_units) — used by handleQuantityUnitsChange
  const recomputeWeightsOnly = (boxes: BoxForm[], articleDesc: string) => {
    const articleBoxes = boxes.filter((b) => b.article_description === articleDesc)
    const totalNet = articleBoxes.reduce((sum, b) => sum + (parseFloat(b.net_weight) || 0), 0)
    const totalGross = articleBoxes.reduce((sum, b) => sum + (parseFloat(b.gross_weight) || 0), 0)

    setArticleApprovalForms((prev) =>
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
    const parentArticle = articleApprovalForms.find((a) => a.item_description === articleDescription)
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
      const parentArticle = articleApprovalForms.find((a) => a.item_description === articleDesc)
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
    // Renumber boxes for the same article
    let boxNum = 1
    const renumbered = newBoxes.map((b) => {
      if (b.article_description === articleDesc) {
        return { ...b, box_number: boxNum++ }
      }
      return b
    })
    setBoxForms(renumbered)
    recomputeArticleFromBoxes(renumbered, articleDesc)
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

  const handleEditBox = (boxIdx: number) => {
    const box = boxForms[boxIdx]
    setEditSnapshots((prev) => new Map(prev).set(boxIdx, { ...box }))
    setEditingBoxIndices((prev) => new Set(prev).add(boxIdx))
  }

  const handlePrintBox = async (boxIdx: number) => {
    const box = boxForms[boxIdx]
    const approvalForm = articleApprovalForms.find((a) => a.item_description === box.article_description)
    if (!approvalForm) return

    try {
      setPrintingBoxIdx(boxIdx)

      // Auto-create entry if not yet created
      const txnNo = await ensureEntryCreated()

      // 1. Save box to backend via upsert
      const upsertResult = await inwardApiService.upsertBox(company, txnNo, {
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
              transaction_no: txnNo,
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
      const qrDataString = JSON.stringify({ tx: txnNo, bi: boxId })

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

      const entryDate = new Date().toISOString().split("T")[0]

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
              <div class="txn">${txnNo}</div>
              <div class="boxid">ID: ${boxId}</div>
            </div>
            <div class="item">${approvalForm.item_description}</div>
            <div>
              <div class="detail"><b>Box #${box.box_number}</b> &nbsp; Net: ${box.net_weight || "\u2014"}kg &nbsp; Gross: ${box.gross_weight || "\u2014"}kg</div>
              ${box.count ? `<div class="detail">Count: ${box.count}</div>` : ""}
              <div class="detail">Entry: ${formatDate(entryDate)}</div>
              ${approvalForm.expiry_date ? `<div class="detail exp">Exp: ${formatDate(approvalForm.expiry_date)}</div>` : ""}
            </div>
            <div class="lot">${(box.lot_number || approvalForm.lot_number || "").substring(0, 20)}${customer ? ` \u00b7 ${customer}` : ""}</div>
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
      toast({
        title: "Print failed",
        description: err instanceof Error ? err.message : "Failed to print label",
        variant: "destructive",
      })
    } finally {
      setPrintingBoxIdx(null)
    }
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
                      "border rounded-lg",
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

            {/* Transport & Documents */}
            <Card>
              <CardHeader className="pb-3 px-3 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-1.5">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      Transport & Documents
                    </CardTitle>
                    <CardDescription className="text-xs">Transport, warehouse, and approval details</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs">Service</Label>
                      <Switch checked={isServiceOrder} onCheckedChange={(v) => { setIsServiceOrder(v); if (v) setIsRtv(false) }} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs">RTV</Label>
                      <Switch checked={isRtv} onCheckedChange={(v) => { setIsRtv(v); if (v) setIsServiceOrder(false) }} />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 px-3 sm:px-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Warehouse</Label>
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
                    <Label className="text-xs">Inward Manager</Label>
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
                {articles.map((article, idx) => {
                  const approvalForm = articleApprovalForms[idx]
                  return (
                    <div key={idx} className="space-y-3 p-3 sm:p-4 border rounded-lg">
                      <ArticleEditor
                        article={article}
                        index={idx}
                        company={company}
                        onChange={updateArticle}
                        onRemove={removeArticle}
                        onRetrySkuLookup={(i) => lookupSKU(i, articles[i].item_description)}
                        removable={articles.length > 1}
                      />

                      {/* Approval-level fields */}
                      {approvalForm && (
                        <>
                          <Separator />
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[11px]">Quality Grade</Label>
                              <Input value={approvalForm.quality_grade} onChange={(e) => updateArticleApproval(idx, "quality_grade", e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">UOM</Label>
                              <Select value={approvalForm.uom} onValueChange={(v) => updateArticleApproval(idx, "uom", v)}>
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
                            {isRtv && (
                              <div className="space-y-1">
                                <Label className="text-[11px]">Units</Label>
                                <Input type="number" value={approvalForm.units} onChange={(e) => updateArticleApproval(idx, "units", e.target.value)} className="h-8 text-xs" />
                              </div>
                            )}
                            <div className="space-y-1">
                              <Label className="text-[11px]">Qty Units <span className="text-muted-foreground text-[9px]">(boxes)</span></Label>
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={approvalForm.quantity_units}
                                onChange={(e) => handleQuantityUnitsChange(idx, e.target.value)}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">Net Wt <span className="text-muted-foreground text-[9px]">(sum)</span></Label>
                              <Input type="number" value={approvalForm.net_weight} readOnly className="h-8 text-xs bg-muted" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">Total Wt <span className="text-muted-foreground text-[9px]">(sum)</span></Label>
                              <Input type="number" value={approvalForm.total_weight} readOnly className="h-8 text-xs bg-muted" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">Carton Wt (kg)</Label>
                              <Input type="number" value={approvalForm.carton_weight} onChange={(e) => updateArticleApproval(idx, "carton_weight", e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">Lot Number</Label>
                              <Input value={approvalForm.lot_number} onChange={(e) => updateArticleApproval(idx, "lot_number", e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">Mfg Date</Label>
                              <Input type="date" value={approvalForm.manufacturing_date} onChange={(e) => updateArticleApproval(idx, "manufacturing_date", e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px]">Expiry Date</Label>
                              <Input type="date" value={approvalForm.expiry_date} onChange={(e) => updateArticleApproval(idx, "expiry_date", e.target.value)} className="h-8 text-xs" />
                            </div>
                          </div>

                          {/* Boxes for this article */}
                          <div className="mt-2 pt-2 border-t space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <Box className="h-3 w-3" />
                                Boxes ({boxForms.filter((b) => b.article_description === approvalForm.item_description).length})
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-xs gap-1"
                                onClick={() => addBox(approvalForm.item_description)}
                                disabled={!approvalForm.item_description}
                              >
                                <Plus className="h-3 w-3" /> Add Box
                              </Button>
                            </div>
                            {boxForms
                              .map((box, boxIdx) => ({ box, boxIdx }))
                              .filter(({ box }) => box.article_description === approvalForm.item_description)
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
                                          className={cn("h-7 text-xs flex-1 min-w-0", isLocked ? "bg-muted" : "")}
                                        />
                                        <Input
                                          type="number"
                                          placeholder="Gross wt"
                                          value={box.gross_weight}
                                          onChange={(e) => updateBox(boxIdx, "gross_weight", e.target.value)}
                                          readOnly={isLocked}
                                          className={cn("h-7 text-xs flex-1 min-w-0", isLocked ? "bg-muted" : "")}
                                        />
                                        <Input
                                          placeholder="Lot #"
                                          value={box.lot_number}
                                          onChange={(e) => updateBox(boxIdx, "lot_number", e.target.value)}
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
                                          onClick={() => addBox(approvalForm.item_description)}
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
                                          className={cn("h-8 text-xs", isLocked ? "bg-muted" : "")}
                                        />
                                      </div>
                                      <div className="space-y-0.5">
                                        <Label className="text-[10px] text-muted-foreground">Gross wt (kg)</Label>
                                        <Input
                                          type="number"
                                          value={box.gross_weight}
                                          onChange={(e) => updateBox(boxIdx, "gross_weight", e.target.value)}
                                          readOnly={isLocked}
                                          className={cn("h-8 text-xs", isLocked ? "bg-muted" : "")}
                                        />
                                      </div>
                                      <div className="space-y-0.5">
                                        <Label className="text-[10px] text-muted-foreground">Lot #</Label>
                                        <Input
                                          value={box.lot_number}
                                          onChange={(e) => updateBox(boxIdx, "lot_number", e.target.value)}
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
                                    </div>
                                  </div>
                                )
                              })}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}

                {articles.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No articles yet. Click &quot;Add Article&quot; to add one.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Amount Validation */}
            {(() => {
              const articleSum = articleApprovalForms.reduce((sum, a) => sum + (parseFloat(a.total_amount) || 0), 0)
              const txnTotal = totalAmount ? parseFloat(totalAmount) : 0
              const diff = Math.abs(articleSum - txnTotal)
              const matched = diff < 0.01

              if (txnTotal > 0 || articleSum > 0) {
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
                        Articles: <strong>{currency || "INR"} {articleSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </span>
                    </div>
                    <div className="text-xs pl-6 sm:pl-0">
                      PO: <strong>{currency || "INR"} {txnTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      {!matched && <span className="ml-2 text-destructive font-medium">(Diff: {diff.toFixed(2)})</span>}
                    </div>
                  </div>
                )
              }
              return null
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
                onClick={() => setShowDiscard(true)}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" /> Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submitting || articles.length === 0}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Create & Approve
              </Button>
            </div>
          </div>
        )}
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
                onClick={() => {
                  setStep("choose")
                  setArticles([])
                  setArticleApprovalForms([])
                  setBoxForms([])
                  setFile(null)
                }}
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
