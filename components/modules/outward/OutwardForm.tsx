"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { SimpleDropdown } from "@/components/ui/simple-dropdown"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { useItemDescriptions, useItemCategories, useSubCategories, useSitecodes, useTransporters } from "@/lib/hooks/useDropdownData"
import { Plus, Save, Trash2, RefreshCw, Package, Box as BoxIcon, Printer, X, Upload, FileText, AlertCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { OutwardRecord, OutwardFormData, DELIVERY_STATUS_OPTIONS, DeliveryStatus } from "@/types/outward"
import { 
  generateConsignmentNumber, 
  calculateTotalInvoiceAmount, 
  calculateTotalFreightAmount,
  formatCurrency 
} from "@/lib/utils/outwardUtils"
import { dropdownApi, type Company } from "@/lib/api"
import {
  createOutward,
  uploadInvoiceFiles,
  extractInvoiceData,
  updateOutward
} from "@/lib/api/outwardApiService"


// Business Head Email Mapping
const BUSINESS_HEAD_EMAILS: Record<string, string> = {
  "Rakesh Ratra": "rakesh@candorfoods.in",
  "Prashant Pal": "prashant@candorfoods.in",
  "Yash Gawdi": "yash@candorfoods.in",
  "Ajay Bajaj": "ajay@candorfoods.in"
}

// Indian States and Union Territories
const INDIAN_STATES_UTS = [
  // States (28)
  "ANDHRA PRADESH",
  "ARUNACHAL PRADESH",
  "ASSAM",
  "BIHAR",
  "CHHATTISGARH",
  "GOA",
  "GUJARAT",
  "HARYANA",
  "HIMACHAL PRADESH",
  "JHARKHAND",
  "KARNATAKA",
  "KERALA",
  "MADHYA PRADESH",
  "MAHARASHTRA",
  "MANIPUR",
  "MEGHALAYA",
  "MIZORAM",
  "NAGALAND",
  "ODISHA",
  "PUNJAB",
  "RAJASTHAN",
  "SIKKIM",
  "TAMIL NADU",
  "TELANGANA",
  "TRIPURA",
  "UTTAR PRADESH",
  "UTTARAKHAND",
  "WEST BENGAL",
  // Union Territories (8)
  "ANDAMAN AND NICOBAR ISLANDS",
  "CHANDIGARH",
  "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
  "DELHI",
  "JAMMU AND KASHMIR",
  "LADAKH",
  "LAKSHADWEEP",
  "PUDUCHERRY"
] as const

interface OutwardFormProps {
  company: Company
  onSubmit?: (data: OutwardFormData) => Promise<void>
  initialData?: OutwardRecord
}

// Material Type dropdown component
function MaterialTypeDropdown({ 
  value, 
  onValueChange, 
  company,
  error 
}: {
  value: string
  onValueChange: (value: string) => void
  company: Company
  error?: string
}) {
  const [options, setOptions] = useState<Array<{value: string, label: string}>>([])
  const [loading, setLoading] = useState(false)
  const [errorState, setErrorState] = useState<string | null>(null)

  useEffect(() => {
    const fetchMaterialTypes = async () => {
      setLoading(true)
      setErrorState(null)
      
      try {
        console.log("=== FETCHING MATERIAL TYPES ===")
        console.log("Company:", company)
        
        const data = await dropdownApi.fetchDropdown({ 
          company, 
          limit: 1000 
        })
        
        console.log("Material Types API Response:", data)
        console.log("Full API Response:", JSON.stringify(data, null, 2))
        
        // Extract material types from the API response
        if (data.options && data.options.material_types && Array.isArray(data.options.material_types)) {
          console.log("Found material_types in API response:", data.options.material_types)
          const materialTypeOptions = data.options.material_types.map((type: string) => ({
            value: type,
            label: type
          }))
          setOptions(materialTypeOptions)
        } else {
          // Fallback to hardcoded values if API doesn't return material_types
          console.log("Using fallback material types")
          const fallbackOptions = [
            { value: "FINISHED", label: "FINISHED" },
            { value: "RAW MATERIALS", label: "RAW MATERIALS" },
            { value: "PACKAGING MATERIALS", label: "PACKAGING MATERIALS" },
            { value: "SPARE PARTS", label: "SPARE PARTS" }
          ]
          setOptions(fallbackOptions)
        }
        
        console.log("=== END MATERIAL TYPES FETCH ===")
      } catch (e: any) {
        console.error("Error fetching material types:", e)
        // Fallback to hardcoded values on error
        const fallbackOptions = [
          { value: "FINISHED", label: "FINISHED" },
          { value: "RAW MATERIALS", label: "RAW MATERIALS" },
          { value: "PACKAGING MATERIALS", label: "PACKAGING MATERIALS" },
          { value: "SPARE PARTS", label: "SPARE PARTS" }
        ]
        setOptions(fallbackOptions)
        setErrorState("Connection not available. Using default values.")
      } finally {
        setLoading(false)
      }
    }

    if (company) {
      fetchMaterialTypes()
    }
  }, [company])
  
  console.log("MaterialTypeDropdown render:", { value, optionsCount: options.length, options })
  
  // Ensure value matches one of the options
  const normalizedValue = options.length > 0 && value ? value : ""
  
  return (
    <SearchableSelect
      value={normalizedValue}
      onValueChange={onValueChange}
      placeholder="Select material type..."
      searchPlaceholder="Search material type..."
      options={options}
      loading={loading}
      error={errorState}
      disabled={loading || options.length === 0}
      className={error ? "border-red-500" : ""}
    />
  )
}

// Item Category dropdown component
function ItemCategoryDropdown({ 
  materialType,
  value, 
  onValueChange, 
  company,
  error,
  disabled 
}: {
  materialType: string
  value: string
  onValueChange: (value: string) => void
  company: Company
  error?: string
  disabled?: boolean
}) {
  const itemCategoriesHook = useItemCategories({ company, material_type: materialType })
  
  return (
    <SearchableSelect
      value={value}
      onValueChange={onValueChange}
      placeholder="Select category..."
      searchPlaceholder="Search category..."
      options={itemCategoriesHook.options}
      loading={itemCategoriesHook.loading}
      error={itemCategoriesHook.error}
      disabled={disabled || !materialType}
      className={error ? "border-red-500" : ""}
    />
  )
}


// Article interface matching inward form
interface Article {
  id: string
  sku_id?: number | null
  material_type: string // FINISHED/RAW MATERIALS/PACKAGING MATERIALS/SPARE PARTS
  item_category: string
  sub_category: string
  item_description: string
  quantity_units: number
  pack_size_gm: number // Pack size in grams
  no_of_packets: number // Number of packets
  uom: string
  net_weight: number
  total_weight: number
  batch_number: string
  unit_rate: number
}

// Box interface matching inward form
interface Box {
  id: string
  box_number: number
  article: string
  net_weight: number
  gross_weight: number
  lot_number?: string
}

// Sub-component for Sub Category Dropdown
function SubCategoryDropdown({ 
  articleId, 
  categoryId, 
  value, 
  onValueChange, 
  company, 
  error,
  materialType
}: {
  articleId: string
  categoryId: string
  value: string
  onValueChange: (value: string) => void
  company: Company
  error?: string
  materialType?: string
}) {
  const subCategoriesHook = useSubCategories(categoryId, { company, material_type: materialType })
  
  return (
    <SearchableSelect
      value={value}
      onValueChange={onValueChange}
      placeholder="Select sub category..."
      searchPlaceholder="Search sub category..."
      options={subCategoriesHook.options}
      loading={subCategoriesHook.loading}
      error={subCategoriesHook.error}
      disabled={!materialType || !categoryId}
      className={error ? "border-red-500" : ""}
    />
  )
}

// Sub-component for Item Description Dropdown
function ItemDescriptionDropdown({
  articleId,
  categoryId,
  subCategoryId,
  materialType,
  value,
  onValueChange,
  company,
  error,
  updateArticle,
}: {
  articleId: string
  categoryId: string
  subCategoryId: string
  materialType: string
  value: string
  onValueChange: (value: string) => void
  company: Company
  error?: string
  updateArticle: (id: string, field: keyof Article, value: any) => void
}) {
  const itemDescriptionsHook = useItemDescriptions({ company, material_type: materialType, item_category: categoryId, sub_category: subCategoryId })
  
  const handleValueChange = async (selectedValue: string) => {
    const selectedOption = itemDescriptionsHook.options.find(option => option.value === selectedValue)
    if (selectedOption) {
      updateArticle(articleId, "item_description", selectedOption.label)
      updateArticle(articleId, "sku_id", null)

      try {
        const skuResponse = await dropdownApi.fetchSkuId({
          company,
          item_description: selectedOption.label,
          item_category: categoryId,
          sub_category: subCategoryId,
          material_type: materialType
        })

        const skuId: number | undefined = Number(
          skuResponse?.sku_id ??
          skuResponse?.id ??
          skuResponse?.ID ??
          skuResponse?.SKU_ID
        )

        if (!skuId || Number.isNaN(skuId) || skuId <= 0) {
          throw new Error("No valid sku_id returned from API")
        }

        updateArticle(articleId, "sku_id", skuId)
        
        // Extract and update material_type from the new payload structure
        const responseMaterialType = skuResponse?.material_type
        if (responseMaterialType) {
          updateArticle(articleId, "material_type", responseMaterialType.toUpperCase())
        }
      } catch (err) {
        console.error("Error fetching SKU ID:", err)
        updateArticle(articleId, "sku_id", null)
      }
    }
    
    onValueChange(selectedValue)
  }

  return (
    <SimpleDropdown
      value={value}
      onValueChange={handleValueChange}
      placeholder="Select item description..."
      options={itemDescriptionsHook.options}
      loading={itemDescriptionsHook.loading}
      error={itemDescriptionsHook.error}
      disabled={false}
      className={error ? "border-red-500" : ""}
    />
  )
}


export default function OutwardForm({ company, onSubmit, initialData }: OutwardFormProps) {
  const itemCategoriesHook = useItemCategories({ company })
  const sitecodesHook = useSitecodes({ company, active_only: true })
  const transportersHook = useTransporters({ company, active_only: true })

  // Ref for file input to reset it
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Generate batch number once
  const generateBatchNumber = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    const hour = String(now.getHours()).padStart(2, "0")
    const minute = String(now.getMinutes()).padStart(2, "0")
    return `BT-${year}${month}${day}${hour}${minute}`
  }

  const [batchNumber] = useState(generateBatchNumber())

  // Articles state - matching inward form structure
  const [articles, setArticles] = useState<Article[]>([{
    id: "1",
    sku_id: null,
    material_type: "",
    item_category: "",
    sub_category: "",
    item_description: "",
    quantity_units: 0,
    pack_size_gm: 0,
    no_of_packets: 0,
    uom: "",
    net_weight: 0,
    total_weight: 0,
    batch_number: batchNumber,
    unit_rate: 0
  }])

  // Boxes state
  const [boxes, setBoxes] = useState<Box[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [printingBoxes, setPrintingBoxes] = useState<Set<number>>(new Set())
  const [quantityWarnings, setQuantityWarnings] = useState<Record<string, string>>({})
  
  // Invoice upload state
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false)
  const [isExtractingInvoice, setIsExtractingInvoice] = useState(false)

  // Form state - ALL ORIGINAL FIELDS
  const [formData, setFormData] = useState<OutwardFormData>({
    company_name: company.toUpperCase(),
    consignment_no: generateConsignmentNumber(),
    invoice_no: "",
    customer_name: "",
    location: null,
    po_no: null,
    boxes: 0,
    gross_weight: "",
    net_weight: "",
    appt_date: "",
    appt_time: "",
    sitecode: null,
    asn_id: 0,
    transporter_name: null,
    vehicle_no: null,
    lr_no: null,
    dispatch_date: "",
    estimated_delivery_date: "",
    actual_delivery_date: null,
    delivery_status: "PENDING",
    invoice_amount: 0,
    invoice_gst_amount: 0,
    total_invoice_amount: 0,
    freight_amount: 0,
    freight_gst_amount: 0,
    total_freight_amount: 0,
    billing_address: null,
    shipping_address: null,
    pincode: 0,
    business_head: null,
    business_head_name: null,
    business_head_email: null,
    invoice_files: null,
    pod_files: null
  })

  // Auto-calculate totals when amounts change
  useEffect(() => {
    const totalInvoice = calculateTotalInvoiceAmount(
      formData.invoice_amount,
      formData.invoice_gst_amount
    )
    const totalFreight = calculateTotalFreightAmount(
      formData.freight_amount,
      formData.freight_gst_amount
    )
    
    setFormData(prev => ({
      ...prev,
      total_invoice_amount: totalInvoice,
      total_freight_amount: totalFreight
    }))
  }, [formData.invoice_amount, formData.invoice_gst_amount, formData.freight_amount, formData.freight_gst_amount])

  // Auto-update boxes, gross_weight, net_weight from box management
  // Note: Weights are in grams (gm)
  useEffect(() => {
    const totalBoxes = boxes.length
    const totalGrossWeight = boxes.reduce((sum, box) => sum + box.gross_weight, 0).toFixed(2)
    const totalNetWeight = boxes.reduce((sum, box) => sum + box.net_weight, 0).toFixed(2)
    
    setFormData(prev => ({
      ...prev,
      boxes: totalBoxes,
      gross_weight: totalGrossWeight,
      net_weight: totalNetWeight
    }))
  }, [boxes])

  // Generate boxes matching inward form logic
  const generateBoxes = (articlesToUse?: Article[], forceRecalculate: boolean = false) => {
    const articlesForGeneration = articlesToUse || articles
    const newBoxes: Box[] = []
    const today = new Date()
    const dateString = today.getFullYear().toString().slice(-2) +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0')

    articlesForGeneration.forEach((article) => {
      // Generate boxes if UOM is BOX or CARTON (matching inward form)
      if (article.uom === "BOX" || article.uom === "CARTON") {
        const cleanItemDescription = (article.item_description || `Article${article.id}`)
          .replace(/[^a-zA-Z0-9]/g, '')
          .toUpperCase()
          .substring(0, 10)

        const existingArticleBoxes = boxes.filter(b => b.article === article.item_description)

        let numBoxes: number
        if (article.quantity_units > 0) {
          numBoxes = article.quantity_units
        } else if (existingArticleBoxes.length > 0) {
          numBoxes = existingArticleBoxes.length
        } else {
          numBoxes = 0
        }

        // Box counter restarts from 1 for each article
        for (let i = 0; i < numBoxes; i++) {
          const existingBox = existingArticleBoxes[i]
          const shouldUseExistingWeights = existingBox && !forceRecalculate

          // Calculate net weight per box: pack_size_gm × no_of_packets
          const calculatedNetWeight = (article.pack_size_gm || 0) * (article.no_of_packets || 0)

          newBoxes.push({
            id: existingBox?.id || `${dateString}${cleanItemDescription}${i + 1}`,
            box_number: i + 1, // Restart numbering from 1 for each article
            article: article.item_description || `Article ${article.id}`,
            net_weight: shouldUseExistingWeights ? existingBox.net_weight : calculatedNetWeight,
            gross_weight: shouldUseExistingWeights ? existingBox.gross_weight : 0,
            lot_number: existingBox?.lot_number || "",
          })
        }
      }
    })
    setBoxes(newBoxes)
  }

  // Auto-generate boxes when articles change
  useEffect(() => {
    generateBoxes()
  }, [articles, articles.length])

  // Handle input changes
  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // ============= ARTICLE MANAGEMENT (matching inward form) =============

  const addArticle = () => {
    const newArticle: Article = {
      id: Date.now().toString(),
      sku_id: null,
      material_type: "",
      item_category: "",
      sub_category: "",
      item_description: "",
      quantity_units: 0,
      pack_size_gm: 0,
      no_of_packets: 0,
      uom: "",
      net_weight: 0,
      total_weight: 0,
      batch_number: batchNumber,
      unit_rate: 0
    }
    const updatedArticles = [...articles, newArticle]
    setArticles(updatedArticles)
    generateBoxes(updatedArticles)
  }

  const removeArticle = (id: string) => {
    if (articles.length > 1) {
      const article = articles.find(a => a.id === id)
      if (article && !confirm(`Remove article "${article.item_description || 'Unnamed'}"? All associated boxes will be deleted.`)) {
        return
      }
      
      const updatedArticles = articles.filter((article) => article.id !== id)
      setArticles(updatedArticles)
      generateBoxes(updatedArticles)
      
    toast({
        title: "Article Removed",
        description: "Article and associated boxes have been removed successfully"
      })
    } else {
      toast({
        title: "Cannot Remove",
        description: "At least one article is required",
        variant: "destructive"
      })
    }
  }

  const updateArticle = (id: string, field: keyof Article, value: any) => {
    const updatedArticles = articles.map((article) => {
      if (article.id === id) {
        const updatedArticle = { ...article, [field]: value }
        
        // Clear dependent fields
        if (field === "item_category") {
          updatedArticle.sub_category = ""
          updatedArticle.item_description = ""
          updatedArticle.sku_id = null
        }
        if (field === "sub_category") {
          updatedArticle.item_description = ""
          updatedArticle.sku_id = null
        }
        
        // Auto-calculate total amount
        // Auto-calculate net weight: (no_of_packets × pack_size_gm × quantity_units)
        // Keep in grams
        if (field === "no_of_packets" || field === "pack_size_gm" || field === "quantity_units") {
          const noOfPackets = Number(updatedArticle.no_of_packets) || 0
          const packSizeGm = Number(updatedArticle.pack_size_gm) || 0
          const quantityUnits = Number(updatedArticle.quantity_units) || 0
          updatedArticle.net_weight = noOfPackets * packSizeGm * quantityUnits
        }

        // Handle quantity warning
        if (field === "quantity_units") {
          if (Number(value) === 0 && (updatedArticle.uom === "BOX" || updatedArticle.uom === "CARTON")) {
            setQuantityWarnings(prev => ({
              ...prev,
              [id]: "Warning: Setting quantity to 0 will preserve existing boxes."
            }))
          } else {
            setQuantityWarnings(prev => {
              const newWarnings = { ...prev }
              delete newWarnings[id]
              return newWarnings
            })
          }
        }

        return updatedArticle
      }
      return article
    })

    setArticles(updatedArticles)

    // Handle box regeneration
    if (field === "item_description") {
      generateBoxes(updatedArticles, true)
    } else if (field === "quantity_units") {
      if (Number(value) > 0) {
        generateBoxes(updatedArticles, false)
      }
    } else if (field === "pack_size_gm" || field === "no_of_packets") {
      // Regenerate boxes when pack size or packet count changes to update net weights
      generateBoxes(updatedArticles, true)
    } else if (field === "uom") {
      generateBoxes(updatedArticles, true)
    }
  }

  // ============= BOX MANAGEMENT =============

  const updateBox = (boxId: string, field: keyof Box, value: any) => {
    // Only allow editing gross_weight, net_weight is auto-calculated
    if (field === "gross_weight") {
      setBoxes(boxes.map((box) => (box.id === boxId ? { ...box, [field]: value } : box)))
    }
  }

  const handleDeleteBox = (box: Box) => {
    const associatedArticle = articles.find(art => art.item_description === box.article)
    
    if (!associatedArticle) {
      toast({
        title: "Error",
        description: "Could not find associated article for this box",
        variant: "destructive"
      })
      return
    }

    if (!confirm(`Are you sure you want to remove Box #${box.box_number} of "${box.article}"? This will also decrement the quantity by 1.`)) {
      return
    }

    // Decrement the quantity_units of the associated article by 1
    const updatedArticles = articles.map(article => {
      if (article.id === associatedArticle.id) {
        const newQuantity = Math.max(0, article.quantity_units - 1)
        return {
          ...article,
          quantity_units: newQuantity
        }
      }
      return article
    })
    setArticles(updatedArticles)
    
    // Regenerate boxes will automatically renumber boxes per article
    generateBoxes(updatedArticles, false)

      toast({
      title: "Box Deleted",
      description: `Box #${box.box_number} of "${box.article}" deleted. Article quantity: ${associatedArticle.quantity_units} → ${Math.max(0, associatedArticle.quantity_units - 1)}`
    })
  }

  const handlePrintBox = async (box: Box) => {
    setPrintingBoxes(prev => new Set(prev).add(box.box_number))

    try {
      const associatedArticle = articles.find(art => art.item_description === box.article)
      if (!associatedArticle) {
      toast({
          title: "Error",
          description: "Could not find associated article",
          variant: "destructive"
        })
        return
      }

      // Dynamically import QR utilities
      const { generateSimplifiedQRData } = await import('@/lib/utils/qr')
      const QRCode = (await import('qrcode')).default

      const qrPayload = {
        company: company,
        entry_date: new Date().toISOString(),
        vendor_name: '',
        customer_name: formData.customer_name || '',
        item_description: associatedArticle.item_description,
        net_weight: box.net_weight,
        total_weight: box.gross_weight,
        batch_number: associatedArticle.batch_number || '',
        box_number: box.box_number,
        manufacturing_date: '',
        expiry_date: '',
        transaction_no: formData.consignment_no,
        sku_id: associatedArticle.sku_id || 0,
        approval_authority: ''
      }

      const qrDataString = generateSimplifiedQRData(qrPayload)
      const qrCodeDataURL = await QRCode.toDataURL(qrDataString, {
        width: 170,
        margin: 1,
        errorCorrectionLevel: 'M'
      })

      // Create print iframe
      const iframe = document.createElement('iframe')
      iframe.style.position = 'absolute'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = 'none'
      iframe.style.visibility = 'hidden'
      document.body.appendChild(iframe)

      const iframeDoc = iframe.contentWindow?.document
      if (iframeDoc) {
        iframeDoc.open()
        iframeDoc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Print Label - Box ${box.box_number}</title>
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: Arial, sans-serif; background: white; }
                .label-container {
                  width: 4in; height: 2in; background: white; border: 1px solid #000; display: flex;
                }
                .qr-section { width: 2in; height: 2in; display: flex; align-items: center; justify-content: center; padding: 0.1in; }
                .qr-section img { width: 1.7in; height: 1.7in; }
                .info-section { width: 2in; height: 2in; padding: 0.08in; display: flex; flex-direction: column; justify-content: space-between; font-size: 8pt; line-height: 1.1; overflow: hidden; }
                .company-info { font-weight: bold; font-size: 9pt; margin-bottom: 0.02in; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .transaction-info { font-size: 7pt; font-family: monospace; margin-bottom: 0.03in; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .item-description { font-weight: bold; font-size: 7.5pt; line-height: 1.1; max-height: 0.5in; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-wrap: break-word; word-break: break-word; margin-bottom: 0.03in; }
                .details { font-size: 7.5pt; line-height: 1.15; flex: 1; overflow: hidden; }
                .details-row { margin-bottom: 0.01in; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                @media print {
                  @page { size: 4in 2in; margin: 0; }
                  body { margin: 0; padding: 0; background: white; }
                  .label-container { width: 4in; height: 2in; border: 1px solid #000; page-break-after: avoid; page-break-inside: avoid; }
                }
              </style>
            </head>
            <body>
              <div class="label-container">
                <div class="qr-section">
                  <img src="${qrCodeDataURL}" alt="QR Code" />
                </div>
                <div class="info-section">
                  <div>
                    <div class="company-info">${qrPayload.company}</div>
                    <div class="transaction-info">${qrPayload.transaction_no}</div>
                  </div>
                  <div class="item-description">${qrPayload.item_description}</div>
                  <div class="details">
                    <div class="details-row"><span>Box #${qrPayload.box_number}</span></div>
                    <div class="details-row"><span>Net Wt: ${qrPayload.net_weight}kg</span></div>
                    <div class="details-row"><span>Gross Wt: ${qrPayload.total_weight}kg</span></div>
                  </div>
                </div>
              </div>
              <script>
                window.onload = function() {
                  setTimeout(() => {
                    window.print();
                    window.onafterprint = function() {
                      window.parent.postMessage('print-complete', '*');
                    };
                  }, 300);
                };
              </script>
            </body>
          </html>
        `)
        iframeDoc.close()

        const handleMessage = (event: MessageEvent) => {
          if (event.data === 'print-complete') {
            document.body.removeChild(iframe)
            window.removeEventListener('message', handleMessage)
          }
        }
        window.addEventListener('message', handleMessage)

        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe)
            window.removeEventListener('message', handleMessage)
          }
        }, 30000)
      }

    } catch (error) {
      console.error("Error printing box:", error)
    toast({
        title: "Print Error",
        description: error instanceof Error ? error.message : "Failed to print box",
        variant: "destructive"
      })
    } finally {
      setTimeout(() => {
        setPrintingBoxes(prev => {
          const newSet = new Set(prev)
          newSet.delete(box.box_number)
          return newSet
        })
      }, 1000)
    }
  }

  // Get box statistics per article
  const getArticleBoxStats = () => {
    const stats: Record<string, { boxes: number; netWeight: number; grossWeight: number; articleName: string }> = {}
    boxes.forEach((box) => {
      const article = articles.find(art => art.item_description === box.article)
      if (article) {
        const articleId = article.id
        if (!stats[articleId]) {
          stats[articleId] = {
            boxes: 0,
            netWeight: 0,
            grossWeight: 0,
            articleName: article.item_description || `Article ${articleId}`,
          }
        }
        stats[articleId].boxes += 1
        stats[articleId].netWeight += box.net_weight
        stats[articleId].grossWeight += box.gross_weight
      }
    })
    return stats
  }

  // ============= FORM SUBMISSION =============

  const handleSubmit = async () => {
    // Validation
    if (!formData.consignment_no.trim()) {
      toast({
        title: "Validation Error",
        description: "Consignment number is required",
        variant: "destructive"
      })
      return
    }

    if (!formData.invoice_no.trim()) {
      toast({
        title: "Validation Error",
        description: "Invoice number is required",
        variant: "destructive"
      })
      return
    }

    if (!formData.customer_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Customer name is required",
        variant: "destructive"
      })
      return
    }

    try {
      // Prepare payload matching backend structure exactly
      // Use today's date as default for required date/time fields
      const today = new Date().toISOString().split('T')[0]
      
      // Debug: Log form data for dates
      console.log('🔍 DEBUG - Form dates before processing:', {
        appt_date: formData.appt_date,
        appt_time: formData.appt_time,
        dispatch_date: formData.dispatch_date,
        estimated_delivery_date: formData.estimated_delivery_date,
        today: today
      })
      
      // Helper function to sanitize values - convert "NOT SPECIFIED" to null
      const sanitizeValue = (value: any) => {
        if (value === "NOT SPECIFIED" || value === "" || value === undefined) {
          return null
        }
        return value
      }

      const outwardData: any = {
        consignment_no: formData.consignment_no,
        invoice_no: formData.invoice_no.toUpperCase(),
        customer_name: formData.customer_name.toUpperCase(),
        location: formData.location ? formData.location.toUpperCase() : null,
        po_no: formData.po_no ? formData.po_no.toUpperCase() : null,
        boxes: formData.boxes,
        gross_weight: formData.gross_weight,
        net_weight: formData.net_weight,
        appt_date: formData.appt_date || today,
        appt_time: formData.appt_time ? `${formData.appt_time}:00` : "00:00:00",
        sitecode: sanitizeValue(formData.sitecode),
        asn_id: formData.asn_id || 0,
        transporter_name: formData.transporter_name ? formData.transporter_name.toUpperCase() : null,
        vehicle_no: formData.vehicle_no ? formData.vehicle_no.toUpperCase() : null,
        lr_no: sanitizeValue(formData.lr_no),
        dispatch_date: formData.dispatch_date || today,
        estimated_delivery_date: formData.estimated_delivery_date || today,
        actual_delivery_date: sanitizeValue(formData.actual_delivery_date),
        delivery_status: formData.delivery_status,
        invoice_amount: formData.invoice_amount || 0,
        invoice_gst_amount: formData.invoice_gst_amount || 0,
        total_invoice_amount: formData.total_invoice_amount || 0,
        freight_amount: formData.freight_amount || 0,
        freight_gst_amount: formData.freight_gst_amount || 0,
        total_freight_amount: formData.total_freight_amount || 0,
        billing_address: formData.billing_address ? formData.billing_address.toUpperCase() : null,
        shipping_address: formData.shipping_address ? formData.shipping_address.toUpperCase() : null,
        pincode: formData.pincode || 0,
        business_head: sanitizeValue(formData.business_head),
        business_head_name: sanitizeValue(formData.business_head_name),
        business_head_email: sanitizeValue(formData.business_head_email),
        invoice_files: null,
        pod_files: null
      }

      console.log('=== OUTWARD FORM SUBMISSION ===')
      console.log('Company:', company)
      console.log('Payload:', JSON.stringify(outwardData, null, 2))
      console.log('=== END PAYLOAD ===')

      // Save or update outward record
      const result = await handleSaveOrUpdateOutward(company, outwardData)

      if (result.success) {
        toast({
          title: "Success",
          description: `Outward record ${result.action} successfully`
        })

        // Reset form after successful creation/update
        handleClearForm()
      } else {
        throw new Error(result.error || 'Failed to save outward record')
      }
    } catch (error: any) {
      console.error("Error submitting outward form:", error)
      console.error("Error details:", {
        message: error?.message,
        context: error?.context,
        responseData: error?.context?.responseData
      })
      
      // Extract detailed validation errors
      let errorMessage = "Failed to submit outward record"
      
      // Check for validation errors in context.responseData
      if (error?.context?.responseData) {
        const responseData = error.context.responseData
        console.error("Backend validation error:", responseData)
        
        if (responseData.detail) {
          if (Array.isArray(responseData.detail)) {
            // FastAPI validation errors
            errorMessage = responseData.detail.map((err: any) => 
              `${err.loc?.join(' → ')}: ${err.msg}`
            ).join(', ')
          } else {
            errorMessage = responseData.detail
          }
        } else if (responseData.message) {
          errorMessage = responseData.message
        } else {
          errorMessage = JSON.stringify(responseData)
        }
      } else if (error?.message) {
        errorMessage = error.message
      }
      
      toast({
        title: "Submission Failed",
        description: errorMessage,
        variant: "destructive"
      })
    }
  }

  const generateLRNumber = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    const hour = String(now.getHours()).padStart(2, "0")
    const minute = String(now.getMinutes()).padStart(2, "0")
    const second = String(now.getSeconds()).padStart(2, "0")
    const lrNumber = `${year}${month}${day}${hour}${minute}${second}`
    handleInputChange("lr_no", lrNumber)
    toast({
      title: "LR Number Generated",
      description: `LR Number: ${lrNumber}`
    })
  }

  const handleClearForm = () => {
    const newBatch = generateBatchNumber()
    setFormData({
      company_name: company.toUpperCase(),
      consignment_no: generateConsignmentNumber(),
      invoice_no: "",
      customer_name: "",
      location: null,
      po_no: null,
      boxes: 0,
      gross_weight: "",
      net_weight: "",
      appt_date: "",
      appt_time: "",
      sitecode: null,
      asn_id: 0,
      transporter_name: null,
      vehicle_no: null,
      lr_no: null,
      dispatch_date: "",
      estimated_delivery_date: "",
      actual_delivery_date: null,
      delivery_status: "PENDING",
      invoice_amount: 0,
      invoice_gst_amount: 0,
      total_invoice_amount: 0,
      freight_amount: 0,
      freight_gst_amount: 0,
      total_freight_amount: 0,
      billing_address: null,
      shipping_address: null,
      pincode: 0,
      business_head: null,
      business_head_name: null,
      business_head_email: null,
      invoice_files: null,
      pod_files: null
    })
    setArticles([{
      id: "1",
      sku_id: null,
      material_type: "",
      item_category: "",
      sub_category: "",
      item_description: "",
      quantity_units: 0,
      pack_size_gm: 0,
      no_of_packets: 0,
      uom: "",
      net_weight: 0,
      total_weight: 0,
      batch_number: newBatch,
      unit_rate: 0
    }])
    setBoxes([])
    setErrors({})
    setQuantityWarnings({})
    setInvoiceFiles([])
    
    // Reset file input to allow re-uploading
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // AI Invoice Extraction Handler with Auto-Creation
  const handleInvoiceExtraction = async (file: File) => {
    setIsExtractingInvoice(true)
    try {
      toast({
        title: "Extracting Invoice Data",
        description: "AI is analyzing the invoice file..."
      })

      const response = await extractInvoiceData(file)
      
      if (response.success && response.extracted_data) {
        const data = response.extracted_data
        
        // Note: total_invoice_amount from backend is the base amount WITHOUT GST
        const baseInvoiceAmt = data.total_invoice_amount || 0
        const gstAmount = data.total_gst_amount || 0
        
        // Auto-fill form fields with extracted data (converted to uppercase as per user preference)
        const updatedFormData = {
          ...formData,
          invoice_no: data.invoice_number?.toUpperCase() || formData.invoice_no,
          po_no: data.po_number?.toUpperCase() || formData.po_no,
          customer_name: data.customer_name?.toUpperCase() || formData.customer_name,
          dispatch_date: data.dispatch_date || formData.dispatch_date,
          invoice_amount: baseInvoiceAmt || formData.invoice_amount,
          invoice_gst_amount: gstAmount || formData.invoice_gst_amount,
          billing_address: data.billing_address?.toUpperCase() || formData.billing_address,
          shipping_address: data.shipping_address?.toUpperCase() || formData.shipping_address,
          pincode: data.pincode ? parseInt(data.pincode) : formData.pincode,
          // Ensure these fields are null instead of "NOT SPECIFIED" (AI may not extract all fields)
          location: (data as any).location && (data as any).location !== "NOT SPECIFIED" ? (data as any).location.toUpperCase() : null,
          sitecode: (data as any).sitecode && (data as any).sitecode !== "NOT SPECIFIED" ? (data as any).sitecode : null,
          transporter_name: (data as any).transporter_name && (data as any).transporter_name !== "NOT SPECIFIED" ? (data as any).transporter_name.toUpperCase() : null,
          vehicle_no: (data as any).vehicle_no && (data as any).vehicle_no !== "NOT SPECIFIED" ? (data as any).vehicle_no.toUpperCase() : null,
          lr_no: (data as any).lr_no && (data as any).lr_no !== "NOT SPECIFIED" ? (data as any).lr_no : null,
          business_head: (data as any).business_head && (data as any).business_head !== "NOT SPECIFIED" ? (data as any).business_head : null,
          business_head_name: (data as any).business_head_name && (data as any).business_head_name !== "NOT SPECIFIED" ? (data as any).business_head_name : null,
          business_head_email: (data as any).business_head_email && (data as any).business_head_email !== "NOT SPECIFIED" ? (data as any).business_head_email : null,
        }
        
        setFormData(updatedFormData)

        toast({
          title: "Extraction Successful",
          description: "Invoice data extracted and form fields auto-filled. Please review and save manually."
        })
      } else {
        toast({
          title: "Extraction Failed",
          description: "Could not extract data from the invoice file",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error extracting invoice:", error)
      toast({
        title: "Extraction Error",
        description: error instanceof Error ? error.message : "Failed to extract invoice data",
        variant: "destructive"
      })
    } finally {
      setIsExtractingInvoice(false)
    }
  }

  // Save or update outward record (used by both AI extraction and manual submission)
  const handleSaveOrUpdateOutward = async (company: Company, outwardData: any) => {
    try {
      // Check if outward entry already exists by consignment_no
      const checkUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/outward/${company}?consignment_no=${encodeURIComponent(outwardData.consignment_no)}`
      
      console.log('🔍 Checking if outward record exists:', checkUrl)
      
      const checkResponse = await fetch(checkUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })

      if (checkResponse.ok) {
        // Entry exists, update it
        console.log('🔄 Outward record exists, updating...')
        
        const existingData = await checkResponse.json()
        const existingRecord = existingData.records?.[0] // Get first matching record
        
        if (existingRecord) {
          const updatedRecord = await updateOutward(company, existingRecord.id, outwardData)
          console.log('✅ Outward record updated:', updatedRecord)
          return {
            success: true,
            action: 'updated',
            record: updatedRecord
          }
        } else {
          // No matching record found, create new
          const newRecord = await createOutward(company, outwardData)
          console.log('✅ Outward record created:', newRecord)
          return {
            success: true,
            action: 'created',
            record: newRecord
          }
        }
      } else if (checkResponse.status === 404) {
        // Entry doesn't exist, create new one
        console.log('📝 Outward record doesn\'t exist, creating new entry...')
        const newRecord = await createOutward(company, outwardData)
        console.log('✅ Outward record created:', newRecord)
        return {
          success: true,
          action: 'created',
          record: newRecord
        }
      } else {
        // Other error occurred during check
        const errorData = await checkResponse.json().catch(() => ({}))
        throw new Error(`Failed to check outward record existence: ${errorData.detail || checkResponse.statusText}`)
      }
    } catch (error: any) {
      console.error('❌ Error in outward record save/update:', error)
      return {
        success: false,
        action: 'failed',
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Auto-create outward entry after AI extraction
   *
   * Flow:
   * 1. Create/update outward record with extracted data
   * 2. User will manually handle approval and articles
   */
  const handleAutoCreateOutwardEntry = async (formData: OutwardFormData, extractedData: any) => {
    try {
      console.log('🤖 Auto-creating outward entry from AI extraction...')
      console.log('📋 Flow: Create/Update Outward Record only')

      // Prepare outward data
      const today = new Date().toISOString().split('T')[0]

      // Helper function to sanitize values - convert "NOT SPECIFIED" to null
      const sanitizeValue = (value: any) => {
        if (value === "NOT SPECIFIED" || value === "" || value === undefined) {
          return null
        }
        return value
      }

      const outwardData = {
        consignment_no: formData.consignment_no,
        invoice_no: formData.invoice_no,
        customer_name: formData.customer_name,
        location: sanitizeValue(formData.location),
        po_no: sanitizeValue(formData.po_no),
        boxes: formData.boxes || 0,
        gross_weight: formData.gross_weight || "0",
        net_weight: formData.net_weight || "0",
        appt_date: formData.appt_date || today,
        appt_time: formData.appt_time ? `${formData.appt_time}:00` : "00:00:00",
        sitecode: sanitizeValue(formData.sitecode),
        asn_id: formData.asn_id || 0,
        transporter_name: sanitizeValue(formData.transporter_name),
        vehicle_no: sanitizeValue(formData.vehicle_no),
        lr_no: sanitizeValue(formData.lr_no),
        dispatch_date: formData.dispatch_date || today,
        estimated_delivery_date: formData.estimated_delivery_date || today,
        actual_delivery_date: sanitizeValue(formData.actual_delivery_date),
        delivery_status: formData.delivery_status,
        invoice_amount: formData.invoice_amount || 0,
        invoice_gst_amount: formData.invoice_gst_amount || 0,
        total_invoice_amount: formData.total_invoice_amount || 0,
        freight_amount: formData.freight_amount || 0,
        freight_gst_amount: formData.freight_gst_amount || 0,
        total_freight_amount: formData.total_freight_amount || 0,
        billing_address: sanitizeValue(formData.billing_address),
        shipping_address: sanitizeValue(formData.shipping_address),
        pincode: formData.pincode || 0,
        business_head: sanitizeValue(formData.business_head),
        business_head_name: sanitizeValue(formData.business_head_name),
        business_head_email: sanitizeValue(formData.business_head_email),
        invoice_files: null,
        pod_files: null
      }

      console.log('📤 Creating/updating outward record:', outwardData)

      // Use the save/update logic
      const result = await handleSaveOrUpdateOutward(company, outwardData)

      if (!result.success) {
        throw new Error(result.error || 'Failed to save outward record')
      }

      console.log('✅ Outward record created/updated successfully')
      console.log('ℹ️ Please add approval and articles manually')

    } catch (error) {
      console.error('❌ Error in auto-creation:', error)
      // Don't show error toast to user as this is background operation
    }
  }

  // Invoice upload handlers
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setInvoiceFiles(prev => [...prev, ...newFiles])
      
      toast({
        title: "Files Added",
        description: `${newFiles.length} file(s) added successfully`
      })

      // Automatically extract data from the first file
      if (newFiles.length > 0) {
        await handleInvoiceExtraction(newFiles[0])
      }
    }
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files)
      setInvoiceFiles(prev => [...prev, ...newFiles])
      
      toast({
        title: "Files Added",
        description: `${newFiles.length} file(s) added successfully`
      })

      // Automatically extract data from the first file
      if (newFiles.length > 0) {
        await handleInvoiceExtraction(newFiles[0])
      }
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const removeFile = (index: number) => {
    setInvoiceFiles(prev => prev.filter((_, i) => i !== index))
    
    // Reset file input to allow re-uploading the same file if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    
    toast({
      title: "File Removed",
      description: "Invoice file removed successfully"
    })
  }

  // Upload invoice files to backend
  const handleUploadInvoiceFiles = async () => {
    if (invoiceFiles.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please select invoice files to upload",
        variant: "destructive"
      })
      return
    }

    setIsUploadingInvoice(true)
    try {
      // Upload files to backend
      await uploadInvoiceFiles(company, invoiceFiles)
      toast({
        title: "Success",
        description: `${invoiceFiles.length} invoice file(s) uploaded successfully`
      })
      setInvoiceFiles([]) // Clear files after successful upload
      
      // Reset file input to allow re-uploading
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      console.error("Error uploading invoice files:", error)
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload invoice files",
        variant: "destructive"
      })
    } finally {
      setIsUploadingInvoice(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle>Create Outward Entry - {company}</CardTitle>
          <p className="text-sm text-muted-foreground">Consignment No: {formData.consignment_no}</p>
        </CardHeader>
      </Card>

      {/* Invoice Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Invoice Upload {isExtractingInvoice && <Badge variant="outline" className="ml-2">AI Extracting...</Badge>}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Upload an invoice file and AI will automatically extract and fill the form fields
          </p>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className={`h-12 w-12 mx-auto mb-4 ${isDragging ? "text-primary" : "text-gray-400"}`} />
            <p className="text-lg font-medium mb-2">
              {isDragging ? "Drop files here" : "Drag and drop invoice files here"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              or click the button below to browse
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleFileChange}
              className="hidden"
              id="invoice-upload"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById("invoice-upload")?.click()}
              className="gap-2"
              disabled={isExtractingInvoice}
            >
              <Upload className="h-4 w-4" />
              {isExtractingInvoice ? "Extracting..." : "Browse Files"}
            </Button>
            </div>

          {/* Uploaded Files List */}
          {invoiceFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Selected Files ({invoiceFiles.length}):</p>
                <Button
                  type="button"
                  onClick={handleUploadInvoiceFiles}
                  disabled={isUploadingInvoice}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {isUploadingInvoice ? "Uploading..." : "Upload Files"}
                </Button>
              </div>
              {invoiceFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                    onClick={() => removeFile(index)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                    <X className="h-4 w-4" />
                </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="consignment_no">Consignment No *</Label>
              <Input
                id="consignment_no"
                value={formData.consignment_no}
                readOnly
                className="bg-muted cursor-not-allowed"
                placeholder="Auto-generated"
              />
            </div>

            <div>
              <Label htmlFor="invoice_no">Invoice No *</Label>
              <Input
                id="invoice_no"
                value={formData.invoice_no}
                onChange={(e) => handleInputChange("invoice_no", e.target.value.toUpperCase())}
                placeholder="Enter invoice number"
              />
            </div>

            <div>
              <Label htmlFor="customer_name">Customer Name *</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => handleInputChange("customer_name", e.target.value.toUpperCase())}
                placeholder="Enter customer name"
              />
            </div>

            <div>
              <Label htmlFor="delivery_status">Delivery Status</Label>
              <Select value={formData.delivery_status} onValueChange={(value) => handleInputChange("delivery_status", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_STATUS_OPTIONS.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="location">Location (State/UT)</Label>
              <Select 
                value={formData.location || ""} 
                onValueChange={(value) => handleInputChange("location", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state or union territory" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {INDIAN_STATES_UTS.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="po_no">PO Number</Label>
              <Input
                id="po_no"
                value={formData.po_no || ""}
                onChange={(e) => handleInputChange("po_no", e.target.value.trim() ? e.target.value.toUpperCase() : null)}
                placeholder="Enter PO number"
              />
            </div>

            <div>
              <Label htmlFor="boxes">Total Boxes</Label>
              <Input
                id="boxes"
                type="number"
                value={formData.boxes}
                readOnly
                className="bg-muted"
              />
            </div>

            <div>
              <Label htmlFor="net_weight">Net Weight (gm)</Label>
              <Input
                id="net_weight"
                value={formData.net_weight}
                readOnly
                className="bg-muted"
              />
            </div>

            <div>
              <Label htmlFor="gross_weight">Gross Weight (gm)</Label>
              <Input
                id="gross_weight"
                value={formData.gross_weight}
                readOnly
                className="bg-muted"
              />
            </div>

            <div>
              <Label htmlFor="business_head">Business Head</Label>
              <Select 
                value={formData.business_head || ""} 
                onValueChange={(value) => {
                  handleInputChange("business_head", value)
                  if (value !== "Other") {
                    // Auto-populate email for predefined business heads
                    const email = BUSINESS_HEAD_EMAILS[value] || null
                    handleInputChange("business_head_name", null)
                    handleInputChange("business_head_email", email)
                  } else {
                    // Clear both when "Other" is selected
                    handleInputChange("business_head_name", null)
                    handleInputChange("business_head_email", null)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select business head" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Rakesh Ratra">Rakesh Ratra</SelectItem>
                  <SelectItem value="Prashant Pal">Prashant Pal</SelectItem>
                  <SelectItem value="Yash Gawdi">Yash Gawdi</SelectItem>
                  <SelectItem value="Ajay Bajaj">Ajay Bajaj</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.business_head === "Other" && (
              <>
                <div>
                  <Label htmlFor="business_head_name">Business Head Name *</Label>
              <Input
                    id="business_head_name"
                    value={formData.business_head_name || ""}
                    onChange={(e) => handleInputChange("business_head_name", e.target.value)}
                    placeholder="Enter business head name"
              />
            </div>

                <div>
                  <Label htmlFor="business_head_email">Business Head Email *</Label>
                  <Input
                    id="business_head_email"
                    type="email"
                    value={formData.business_head_email || ""}
                    onChange={(e) => handleInputChange("business_head_email", e.target.value)}
                    placeholder="Enter business head email"
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Appointment & Site Details */}
      <Card>
        <CardHeader>
          <CardTitle>Appointment & Site Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="appt_date">Appointment Date</Label>
              <Input
                id="appt_date"
                type="date"
                value={formData.appt_date}
                onChange={(e) => handleInputChange("appt_date", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="appt_time">Appointment Time</Label>
              <Input
                id="appt_time"
                type="time"
                value={formData.appt_time}
                onChange={(e) => handleInputChange("appt_time", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="sitecode">Site Code</Label>
              <SimpleDropdown
                value={formData.sitecode || ""}
                onValueChange={(value) => handleInputChange("sitecode", value)}
                placeholder="Select site code..."
                options={sitecodesHook.options}
                loading={sitecodesHook.loading}
                error={sitecodesHook.error}
              />
            </div>

            <div>
              <Label htmlFor="asn_id">ASN ID</Label>
              <Input
                id="asn_id"
                type="number"
                min="0"
                value={formData.asn_id}
                onChange={(e) => handleInputChange("asn_id", parseInt(e.target.value) || 0)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="Enter ASN ID"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transport Details */}
      <Card>
        <CardHeader>
          <CardTitle>Transport Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="transporter_name">Transporter Name</Label>
              <SimpleDropdown
                value={formData.transporter_name || ""}
                onValueChange={(value) => handleInputChange("transporter_name", value)}
                placeholder="Select transporter..."
                options={transportersHook.options}
                loading={transportersHook.loading}
                error={transportersHook.error}
              />
            </div>

            <div>
              <Label htmlFor="vehicle_no">Vehicle Number</Label>
              <Input
                id="vehicle_no"
                value={formData.vehicle_no || ""}
                onChange={(e) => handleInputChange("vehicle_no", e.target.value.trim() ? e.target.value.toUpperCase() : null)}
                placeholder="MH12AB1234"
              />
            </div>

            <div>
              <Label htmlFor="lr_no">LR Number</Label>
              <div className="flex gap-2">
                <Input
                  id="lr_no"
                  type="text"
                  value={formData.lr_no || ""}
                  onChange={(e) => handleInputChange("lr_no", e.target.value.trim() || null)}
                placeholder="Enter LR number"
                className="flex-1"
              />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={generateLRNumber}
                  title="Generate LR Number"
                  className="flex-shrink-0"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
            </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Information */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="dispatch_date">Dispatch Date</Label>
              <Input
                id="dispatch_date"
                type="date"
                value={formData.dispatch_date}
                onChange={(e) => handleInputChange("dispatch_date", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="estimated_delivery_date">Est. Delivery Date</Label>
              <Input
                id="estimated_delivery_date"
                type="date"
                value={formData.estimated_delivery_date}
                onChange={(e) => handleInputChange("estimated_delivery_date", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="actual_delivery_date">Actual Delivery Date</Label>
              <Input
                id="actual_delivery_date"
                type="date"
                value={formData.actual_delivery_date || ""}
                onChange={(e) => handleInputChange("actual_delivery_date", e.target.value || null)}
              />
            </div>
            </div>
        </CardContent>
      </Card>

      {/* Financial Details */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Invoice Section */}
            <div className="md:col-span-2">
              <h3 className="font-semibold text-sm mb-3">Invoice Details</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="invoice_amount">Invoice Amount</Label>
              <Input
                id="invoice_amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.invoice_amount}
                onChange={(e) => handleInputChange("invoice_amount", parseFloat(e.target.value) || 0)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="0.00"
              />
            </div>

                <div>
                  <Label htmlFor="invoice_gst_amount">Invoice GST</Label>
              <Input
                id="invoice_gst_amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.invoice_gst_amount}
                onChange={(e) => handleInputChange("invoice_gst_amount", parseFloat(e.target.value) || 0)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="0.00"
              />
            </div>

                <div>
                  <Label htmlFor="total_invoice_amount">Total Invoice</Label>
              <Input
                id="total_invoice_amount"
                type="number"
                    value={formData.total_invoice_amount.toFixed(2)}
                readOnly
                    className="bg-muted font-semibold"
              />
                </div>
              </div>
            </div>

            {/* Freight Section */}
            <div className="md:col-span-2">
              <h3 className="font-semibold text-sm mb-3">Freight Details</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="freight_amount">Freight Amount</Label>
              <Input
                id="freight_amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.freight_amount}
                onChange={(e) => handleInputChange("freight_amount", parseFloat(e.target.value) || 0)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="0.00"
              />
            </div>

                <div>
                  <Label htmlFor="freight_gst_amount">Freight GST</Label>
              <Input
                id="freight_gst_amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.freight_gst_amount}
                onChange={(e) => handleInputChange("freight_gst_amount", parseFloat(e.target.value) || 0)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="0.00"
              />
            </div>

                <div>
                  <Label htmlFor="total_freight_amount">Total Freight</Label>
              <Input
                id="total_freight_amount"
                type="number"
                    value={formData.total_freight_amount.toFixed(2)}
                readOnly
                    className="bg-muted font-semibold"
              />
            </div>
            </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address Details */}
      <Card>
        <CardHeader>
          <CardTitle>Address Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="billing_address">Billing Address</Label>
              <Textarea
                id="billing_address"
                value={formData.billing_address || ""}
                onChange={(e) => handleInputChange("billing_address", e.target.value.trim() ? e.target.value.toUpperCase() : null)}
                placeholder="Enter billing address"
                rows={2}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="shipping_address">Shipping Address</Label>
              <Textarea
                id="shipping_address"
                value={formData.shipping_address || ""}
                onChange={(e) => handleInputChange("shipping_address", e.target.value.trim() ? e.target.value.toUpperCase() : null)}
                placeholder="Enter shipping address"
                rows={2}
              />
          </div>

            <div>
              <Label htmlFor="pincode">Pincode</Label>
              <Input
                id="pincode"
                type="number"
                min="0"
                value={formData.pincode}
                onChange={(e) => handleInputChange("pincode", parseInt(e.target.value) || 0)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="Enter pincode"
              />
          </div>
          </div>
        </CardContent>
      </Card>



      {/* Box Management */}
      {boxes.length > 0 && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Box Management ({boxes.length} boxes)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium text-lg">Per-Article Summary</h4>
                <div className="grid gap-4">
                  {Object.entries(getArticleBoxStats()).map(([articleId, stats]) => (
                    <div key={articleId} className="p-4 border rounded-lg bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-sm">{stats.articleName}</h5>
                        <Badge variant="outline">{stats.boxes} boxes</Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Total Net Weight:</span>
                          <span 
                            className="ml-2 font-medium" 
                            title={`${stats.netWeight.toFixed(2)} gm`}
                          >
                            {stats.netWeight.toFixed(2)} gm
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Total Gross Weight:</span>
                          <span 
                            className="ml-2 font-medium"
                            title={`${stats.grossWeight.toFixed(2)} gm`}
                          >
                            {stats.grossWeight.toFixed(2)} gm
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <div className="min-w-[600px] px-2 sm:px-0">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-4 py-2 text-left font-medium">Box Number</th>
                        <th className="border border-gray-300 px-4 py-2 text-left font-medium">Article Name</th>
                        <th className="border border-gray-300 px-4 py-2 text-left font-medium">Lot Number</th>
                        <th className="border border-gray-300 px-4 py-2 text-left font-medium">Net Weight (gm)</th>
                        <th className="border border-gray-300 px-4 py-2 text-left font-medium">Gross Weight (gm)</th>
                        <th className="border border-gray-300 px-4 py-2 text-left font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {boxes.map((box, index) => {
                        // Check if this is the first box of a new article
                        const isFirstBoxOfArticle = index === 0 || boxes[index - 1].article !== box.article
                        
                        return (
                          <React.Fragment key={box.id}>
                            {/* Add spacing row between different articles */}
                            {isFirstBoxOfArticle && index > 0 && (
                              <tr className="bg-gray-100">
                                <td colSpan={6} className="border border-gray-300 h-2 p-0"></td>
                              </tr>
                            )}
                            <tr className={`hover:bg-gray-50 ${isFirstBoxOfArticle && index > 0 ? 'border-t-2 border-t-gray-400' : ''}`}>
                              <td className="border border-gray-300 px-4 py-2">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                                  <span className="font-medium text-sm">{box.box_number}</span>
                                </div>
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                <span className="text-sm font-medium">{box.article}</span>
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                <Input
                                  type="text"
                                  value={box.lot_number || ""}
                                  onChange={(e) => updateBox(box.id, "lot_number", e.target.value)}
                                  className="w-full max-w-[150px]"
                                  placeholder="Enter lot number"
                                />
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={box.net_weight.toFixed(2)}
                                  readOnly
                                  className="w-full max-w-[150px] bg-muted"
                                  title={`${box.net_weight.toFixed(2)} gm`}
                                />
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                <div className="space-y-1">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={box.gross_weight}
                                    onChange={(e) => updateBox(box.id, "gross_weight", Number(e.target.value))}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    className={box.net_weight > 0 && box.gross_weight <= box.net_weight ? "w-full max-w-[150px] border-orange-500" : "w-full max-w-[150px]"}
                                    title={`${box.gross_weight.toFixed(2)} gm`}
                                  />
                                  {box.net_weight > 0 && box.gross_weight <= box.net_weight && (
                                    <p className="text-xs text-orange-500">⚠️ Must be &gt; {box.net_weight.toFixed(2)}</p>
                                  )}
                                </div>
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePrintBox(box)}
                                    disabled={printingBoxes.has(box.box_number)}
                                    className="flex items-center gap-1"
                                  >
                                    <Printer className="h-3 w-3" />
                                    {printingBoxes.has(box.box_number) ? "Printing..." : "Print"}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteBox(box)}
                                    className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300"
                                    title="Delete box"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* POD Upload Section - REMOVED */}

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={handleClearForm} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Clear Form
        </Button>
        <Button onClick={handleSubmit} className="gap-2">
              <Save className="h-4 w-4" />
          Save Outward Record
                            </Button>
                          </div>
    </div>
  )
}
