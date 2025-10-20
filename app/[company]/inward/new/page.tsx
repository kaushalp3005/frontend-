"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SimpleDropdown } from "@/components/ui/simple-dropdown"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { useItemDescriptions, useItemCategories, useSubCategories, useVendors, useCustomers } from "@/lib/hooks/useDropdownData"
import { useAuthStore } from "@/lib/stores/auth"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { ArrowLeft, Plus, Trash2, Save, RotateCcw, AlertCircle, Shield, Printer, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import type { Company } from "@/lib/api"
// ✅ STATIC (typed) IMPORT — fixes TS2339
import { dropdownApi } from "@/lib/api"
import { LabelPreview } from "@/components/ui/label-preview"
import { useToast } from "@/hooks/use-toast"

interface InwardFormPageProps {
  params: { company: Company }
}

interface Article {
  id: string
  sku_id?: number | null
  material_type: string
  item_category: string
  sub_category: string
  item_description: string
  quantity_units: number
  packaging_type: number
  uom: string
  net_weight: number
  total_weight: number
  batch_number: string
  lot_number: string
  manufacturing_date: string
  expiry_date: string
  import_date: string
  unit_rate: number
  total_amount: number
  tax_amount: number
  discount_amount: number
  currency: string
  // Issuance fields
  issuance_date: string
  job_card_no: string
  issuance_quantity: number
}

interface Box {
  id: string
  box_number: number
  article: string
  net_weight: number
  gross_weight: number
  lot_number?: string
}

interface SubCategoryDropdownProps {
  articleId: string
  categoryId: string
  value: string
  onValueChange: (value: string) => void
  company: Company
  error?: string
  disabled?: boolean
}

interface ItemDescriptionDropdownProps {
  articleId: string
  categoryId: string
  subCategoryId: string
  value: string
  onValueChange: (value: string) => void
  company: Company
  error?: string
  updateArticle: (id: string, field: keyof Article, value: any) => void
  disabled?: boolean
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
      disabled={disabled}
      className={error ? "border-red-500" : ""}
    />
  )
}

function SubCategoryDropdown({ categoryId, value, onValueChange, company, error, disabled, materialType }: SubCategoryDropdownProps & { materialType?: string }) {
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
      disabled={disabled || !categoryId}
      className={error ? "border-red-500" : ""}
    />
  )
}

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
  disabled,
}: ItemDescriptionDropdownProps & { materialType: string }) {
  const itemDescriptionsHook = useItemDescriptions({ company, material_type: materialType, item_category: categoryId, sub_category: subCategoryId })
  

  const handleValueChange = async (selectedValue: string) => {
    // Find the selected option to get the label
    const selectedOption = itemDescriptionsHook.options.find(option => option.value === selectedValue)
    if (selectedOption) {
      // Call the parent's onValueChange first to update the item_description
      onValueChange(selectedValue)
      
      // Reset SKU ID while fetching
      updateArticle(articleId, "sku_id", null)

      // ✅ Directly call the statically imported API (typed)
      try {
        const skuResponse = await dropdownApi.fetchSkuId({
          company,
          item_description: selectedOption.label,
          item_category: categoryId,
          sub_category: subCategoryId,
          material_type: materialType
        })

        // Extract SKU ID from various possible response formats
        const skuId: number | undefined = Number(
          skuResponse?.sku_id ??
          skuResponse?.id ??
          skuResponse?.ID ??
          skuResponse?.SKU_ID
        )

        if (!skuId || Number.isNaN(skuId) || skuId <= 0) {
          throw new Error("No valid sku_id returned from API")
        }

        // Update sku_id with the real database ID
        updateArticle(articleId, "sku_id", skuId)
        
        // Extract and update material_type from the new payload structure
        const responseMaterialType = skuResponse?.material_type
        if (responseMaterialType) {
          updateArticle(articleId, "material_type", responseMaterialType.toUpperCase())
        }
      } catch (err) {
        console.error("Error fetching SKU ID:", err)
        // Show error to user but don't block form
        alert(`Warning: Could not fetch SKU ID for "${selectedOption.label}". Please ensure this item exists in the database.`)
        // Set SKU ID to null - will be resolved at submit time
        updateArticle(articleId, "sku_id", null)
      }
    }
    
    onValueChange(selectedValue)
  }

  return (
    <SearchableSelect
      value={value}
      onValueChange={handleValueChange}
      placeholder="Select item description..."
      searchPlaceholder="Search item description..."
      options={itemDescriptionsHook.options}
      loading={itemDescriptionsHook.loading}
      error={itemDescriptionsHook.error}
      disabled={disabled || !categoryId || !subCategoryId}
      className={error ? "border-red-500" : ""}
    />
  )
}

export default function InwardFormPage({ params }: InwardFormPageProps) {
  const { company: urlCompany } = params
  const { currentCompany } = useAuthStore()
  const company = (currentCompany || urlCompany) as Company
  const router = useRouter()
  const { toast } = useToast()

  const vendorsHook = useVendors({ company })
  const customersHook = useCustomers({ company })

  // Search state for vendor and customer dropdowns
  const [vendorSearch, setVendorSearch] = useState("")
  const [customerSearch, setCustomerSearch] = useState("")

  // Display state for quantity fields to allow decimal input
  const [grnQuantityDisplay, setGrnQuantityDisplay] = useState("")
  const [receivedQuantityDisplay, setReceivedQuantityDisplay] = useState("")
  
  // Display state for issuance quantities to allow decimal input
  const [issuanceQuantityDisplays, setIssuanceQuantityDisplays] = useState<Record<string, string>>({})

  // Update vendor search when search query changes
  useEffect(() => {
    if (vendorsHook.search) {
      vendorsHook.search(vendorSearch)
    }
  }, [vendorSearch, vendorsHook.search])

  // Update customer search when search query changes
  useEffect(() => {
    if (customersHook.search) {
      customersHook.search(customerSearch)
    }
  }, [customerSearch, customersHook.search])


  const generateTransactionNo = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    const hour = String(now.getHours()).padStart(2, "0")
    const minute = String(now.getMinutes()).padStart(2, "0")
    return `TR-${year}${month}${day}${hour}${minute}`
  }

  const generateBatchNumber = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    const hour = String(now.getHours()).padStart(2, "0")
    const minute = String(now.getMinutes()).padStart(2, "0")
    return `BT-${year}${month}${day}${hour}${minute}`
  }

  const [formData, setFormData] = useState({
    company,
    transaction_no: generateTransactionNo(),
    batch_number: generateBatchNumber(), // Generate batch number once per transaction
    entry_date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
    vehicle_number: "",
    transporter_name: "",
    lr_number: "",
    vendor_supplier_name: "",
    customer_party_name: "",
    // Custom vendor fields when "Other" is selected
    custom_vendor_name: "",
    // Custom customer fields when "Other" is selected
    custom_customer_name: "",
    // Custom purchase by field when "Other" is selected
    custom_purchase_by: "",
    // Custom approval authority field when "Other" is selected
    custom_approval_authority: "",
    source_location: "",
    destination_location: "",
    challan_number: "",
    invoice_number: "",
    po_number: "",
    grn_number: "",
    grn_quantity: 0,
    system_grn_date: "",
    purchase_by: "",
    bill_submitted_to_account: false,
    grn_remark: "",
    process_type: "",
    service_remarks: "",
    service_invoice_number: "",
    dn_number: "",
    approval_authority: "",
    received_quantity: 0,
    return_reason_remark: "",
    remark: "",
  })

  // Initialize display values when form data changes
  useEffect(() => {
    setGrnQuantityDisplay(formData.grn_quantity.toString())
  }, [formData.grn_quantity])

  useEffect(() => {
    setReceivedQuantityDisplay(formData.received_quantity.toString())
  }, [formData.received_quantity])


  const [articles, setArticles] = useState<Article[]>([
    {
      id: "1",
      sku_id: null,
      material_type: "",
      item_description: "",
      item_category: "",
      sub_category: "",
      quantity_units: 0,
      packaging_type: 0,
      uom: "",
      net_weight: 0,
      total_weight: 0,
      batch_number: formData.batch_number,
      lot_number: "",
      manufacturing_date: "",
      expiry_date: "",
      import_date: "",
      unit_rate: 0,
      total_amount: 0,
      tax_amount: 0,
      discount_amount: 0,
      currency: "INR",
      // Issuance fields
      issuance_date: "",
      job_card_no: "",
      issuance_quantity: 0,
    },
  ])

  // Initialize issuance quantity displays when articles change
  useEffect(() => {
    const newDisplays: Record<string, string> = {}
    articles.forEach(article => {
      newDisplays[article.id] = article.issuance_quantity.toString()
    })
    setIssuanceQuantityDisplays(newDisplays)
  }, [articles])

  const [boxes, setBoxes] = useState<Box[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [printingBoxes, setPrintingBoxes] = useState<Set<number>>(new Set())
  const [quantityWarnings, setQuantityWarnings] = useState<Record<string, string>>({})

  const generateBoxes = (articlesToUse?: Article[], forceRecalculate: boolean = false) => {
    const articlesForGeneration = articlesToUse || articles
    const newBoxes: Box[] = []
    let boxCounter = 1
    const today = new Date()
    const dateString = today.getFullYear().toString().slice(-2) +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0')

    articlesForGeneration.forEach((article) => {
      // Generate boxes if UOM is BOX or CARTON (even if quantity is 0)
      if (article.uom === "BOX" || article.uom === "CARTON") {
        const cleanItemDescription = (article.item_description || `Article${article.id}`)
          .replace(/[^a-zA-Z0-9]/g, '')
          .toUpperCase()
          .substring(0, 10)

        // Get existing boxes for this article from current boxes state
        const existingArticleBoxes = boxes.filter(b => b.article === article.item_description)

        // Determine number of boxes to generate:
        // - If quantity > 0: use quantity_units
        // - If quantity = 0: preserve all existing boxes (don't reduce)
        // - If no existing boxes and quantity = 0: create 0 boxes
        let numBoxes: number
        if (article.quantity_units > 0) {
          numBoxes = article.quantity_units
        } else if (existingArticleBoxes.length > 0) {
          // Quantity is 0 but we have existing boxes - preserve them all
          numBoxes = existingArticleBoxes.length
        } else {
          // Quantity is 0 and no existing boxes - create 0 boxes
          numBoxes = 0
        }

        for (let i = 0; i < numBoxes; i++) {
          // Try to preserve existing box data - match by index within the article's boxes
          const existingBox = existingArticleBoxes[i]

          // Only recalculate weights if forced or if it's a new box
          const shouldUseExistingWeights = existingBox && !forceRecalculate

          newBoxes.push({
            id: existingBox?.id || `${dateString}${cleanItemDescription}${boxCounter}`,
            box_number: boxCounter,
            article: article.item_description || `Article ${article.id}`,
            net_weight: existingBox?.net_weight || 0, // Always start with 0 or preserve existing manual value
            gross_weight: existingBox?.gross_weight || 0, // Always start with 0 or preserve existing manual value
            lot_number: article.lot_number || existingBox?.lot_number || "",
          })
          boxCounter++
        }
      }
    })
    setBoxes(newBoxes)
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.vehicle_number.trim()) newErrors.vehicle_number = "Vehicle number is required"
    if (!formData.transporter_name.trim()) newErrors.transporter_name = "Transporter name is required"
    if (!formData.vendor_supplier_name.trim()) newErrors.vendor_supplier_name = "Vendor/Supplier name is required"
    if (!formData.customer_party_name.trim()) newErrors.customer_party_name = "Customer/Party name is required"
    if (!formData.purchase_by.trim()) newErrors.purchase_by = "Purchase By is required"
    if (!formData.approval_authority.trim()) newErrors.approval_authority = "Approval Authority is required"
    
    // Validate custom vendor fields when "Other" is selected
    if (formData.vendor_supplier_name === "Other") {
      if (!formData.custom_vendor_name.trim()) newErrors.custom_vendor_name = "Custom vendor name is required"
    }
    
    // Validate custom customer fields when "Other" is selected
    if (formData.customer_party_name === "Other") {
      if (!formData.custom_customer_name.trim()) newErrors.custom_customer_name = "Custom customer name is required"
    }
    
    // Validate custom purchase by field when "Other" is selected
    if (formData.purchase_by === "Other") {
      if (!formData.custom_purchase_by.trim()) newErrors.custom_purchase_by = "Custom purchase by name is required"
    }
    
    // Validate custom approval authority field when "Other" is selected
    if (formData.approval_authority === "Other") {
      if (!formData.custom_approval_authority.trim()) newErrors.custom_approval_authority = "Custom approval authority name is required"
    }
    
    if (formData.grn_quantity < 0) newErrors.grn_quantity = "GRN quantity cannot be negative"
    if (formData.received_quantity < 0) newErrors.received_quantity = "Received quantity cannot be negative"

    articles.forEach((article, index) => {
      if (!article.material_type.trim()) newErrors[`article_${index}_material_type`] = "Material type is required"
      if (!article.item_category.trim()) newErrors[`article_${index}_category`] = "Item category is required"
      if (!article.sub_category.trim()) newErrors[`article_${index}_sub_category`] = "Sub category is required"
      if (!article.item_description.trim()) newErrors[`article_${index}_description`] = "Item description is required"
      if (!article.quantity_units || article.quantity_units <= 0) newErrors[`article_${index}_quantity`] = "Quantity must be greater than 0"
      if (article.uom === "") newErrors[`article_${index}_uom`] = "UOM is required"
      if (article.net_weight <= 0) newErrors[`article_${index}_net_weight`] = "Net weight must be greater than 0"
      if (article.total_weight <= 0) newErrors[`article_${index}_total_weight`] = "Total weight must be greater than 0"
      if (article.total_weight <= article.net_weight) newErrors[`article_${index}_total_weight`] = "Gross weight must be greater than net weight"
      // if (article.unit_rate <= 0) newErrors[`article_${index}_unit_rate`] = "Unit rate must be greater than 0"
      // if (article.tax_amount < 0) newErrors[`article_${index}_tax_amount`] = "Tax amount cannot be negative"
      // if (article.discount_amount < 0) newErrors[`article_${index}_discount_amount`] = "Discount amount cannot be negative"
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  useEffect(() => {
    generateBoxes()
  }, [articles, articles.length])

  const addArticle = () => {
    const newArticle: Article = {
      id: Date.now().toString(),
      sku_id: null,
      material_type: "",
      item_category: "",
      sub_category: "",
      item_description: "",
      quantity_units: 0,
      packaging_type: 0,
      uom: "",
      net_weight: 0,
      total_weight: 0,
      batch_number: formData.batch_number,
      lot_number: "",
      manufacturing_date: "",
      expiry_date: "",
      import_date: "",
      unit_rate: 0,
      total_amount: 0,
      tax_amount: 0,
      discount_amount: 0,
      currency: "INR",
      // Issuance fields
      issuance_date: "",
      job_card_no: "",
      issuance_quantity: 0,
    }
    const updatedArticles = [...articles, newArticle]
    setArticles(updatedArticles)
    generateBoxes(updatedArticles)
  }

  const removeArticle = (id: string) => {
    if (articles.length > 1) {
      const updatedArticles = articles.filter((article) => article.id !== id)
      setArticles(updatedArticles)
      generateBoxes(updatedArticles)
    }
  }

  const updateArticle = (id: string, field: keyof Article, value: any) => {
    console.log("updateArticle called:", { id, field, value })
    const updatedArticles = articles.map((article) => {
      if (article.id === id) {
        const updatedArticle = { ...article, [field]: value }
        console.log("Updated article:", updatedArticle)
        // If category or sub category changes, nuke stale item selection + sku
        if (field === "item_category") {
          updatedArticle.sub_category = ""
          updatedArticle.item_description = ""
          updatedArticle.sku_id = null
        }
        if (field === "sub_category") {
          updatedArticle.item_description = ""
          updatedArticle.sku_id = null
        }
        if (field === "unit_rate" || field === "quantity_units") {
          updatedArticle.total_amount = (Number(updatedArticle.unit_rate) || 0) * (Number(updatedArticle.quantity_units) || 0)
        }

        // Handle quantity warning when set to 0
        if (field === "quantity_units") {
          if (Number(value) === 0 && (updatedArticle.uom === "BOX" || updatedArticle.uom === "CARTON")) {
            setQuantityWarnings(prev => ({
              ...prev,
              [id]: "Warning: Setting quantity to 0 will preserve existing boxes but they won't be updated with new weight distributions."
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

    console.log("Setting articles:", updatedArticles)
    setArticles(updatedArticles)

    if (field === "item_description" || field === "lot_number") {
      if (field === "item_description") {
        generateBoxes(updatedArticles, true) // Force recalculate when item changes
      } else {
        setBoxes((currentBoxes) =>
          currentBoxes.map((box) => {
            const article = updatedArticles.find(art => art.id === id)
            if (article && box.article === article.item_description) {
              return { ...box, lot_number: value }
            }
            return box
          })
        )
      }
    } else if (field === "quantity_units") {
      // When quantity changes to 0, don't regenerate boxes - preserve existing ones
      // Only regenerate boxes if quantity is greater than 0
      if (Number(value) > 0) {
        generateBoxes(updatedArticles, false)
      }
      // If quantity is 0, we do nothing - existing boxes are preserved
    } else if (field === "net_weight" || field === "total_weight") {
      // Don't recalculate box weights when article weights change
      // User wants to manually set each box weight independently
    } else if (field === "uom") {
      generateBoxes(updatedArticles, true) // Force recalculate when UOM changes
    }
  }

  const updateFormData = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const updateBox = (boxId: string, field: keyof Box, value: any) => {
    if (field === "net_weight" || field === "gross_weight") {
      setBoxes(boxes.map((box) => (box.id === boxId ? { ...box, [field]: value } : box)))
    }
  }

  // Unused function - keeping for future reference if needed
  /*
  const processLabelResponse = async (labelResponse: Response, box: Box) => {
    try {
      // Get box management data from headers if available
      const boxPayload = labelResponse.headers.get('X-Box-Management-Payload')
      const fileInfo = labelResponse.headers.get('X-File-Info')

      if (boxPayload) {
        console.log('Box Management Payload:', JSON.parse(boxPayload))
      }

      if (fileInfo) {
        console.log('File Info:', JSON.parse(fileInfo))
      }

      // Get the image blob
      const imageBlob = await labelResponse.blob()

      // Create object URL and open in print window
      const imageUrl = URL.createObjectURL(imageBlob)
      console.log("Label generated successfully, opening print window...")

      // Open print window
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Print Label - Box ${box.box_number}</title>
              <style>
                body {
                  margin: 0;
                  padding: 0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  background: white;
                }
                img {
                  max-width: 100%;
                  height: auto;
                  border: none;
                }
                @media print {
                  body {
                    margin: 0;
                    padding: 0;
                    justify-content: flex-start;
                    align-items: flex-start;
                  }
                  img {
                    width: 100%;
                    height: 100%;
                  }
                }
              </style>
            </head>
            <body>
              <img src="${imageUrl}" alt="Label for Box ${box.box_number}" />
              <script>
                window.onload = function() {
                  // Auto-trigger print dialog immediately after image loads
                  setTimeout(() => {
                    window.print();
                  }, 100);
                };
              </script>
            </body>
          </html>
        `)
        printWindow.document.close()

        // Clean up the object URL after a delay
        setTimeout(() => {
          URL.revokeObjectURL(imageUrl)
        }, 5000)
       } else {
         // Fallback: Show alert and provide download option
         console.warn("Popup blocked, label cannot auto-print")
         const userChoice = confirm(`Label generated successfully!\n\nClick OK to download the label image.\nClick Cancel to close.`)
         if (userChoice) {
           const link = document.createElement('a')
           link.href = imageUrl
           link.download = `label_box_${box.box_number}.png`
           link.click()
         }
       }

      alert(`Box ${box.box_number} successfully processed and label printed!`)
    } catch (err) {
      console.error("Error processing label response:", err)
      alert(`Error processing label: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }
  */

  const handlePrintBox = async (box: Box) => {
    // Mark this box as being printed
    setPrintingBoxes(prev => new Set(prev).add(box.box_number))

    try {
      console.log("Printing box:", box)
      
      // Find the article associated with this box
      const associatedArticle = articles.find(art => art.item_description === box.article)
      if (!associatedArticle) {
        alert("Error: Could not find associated article for this box")
        return
      }

      // Dynamically import QR utilities
      const { generateSimplifiedQRData } = await import('@/lib/utils/qr')
      const QRCode = (await import('qrcode')).default

      // Prepare QR payload
      const qrPayload = {
        company: company,
        entry_date: formData.entry_date,
        vendor_name: formData.vendor_supplier_name || '',
        customer_name: formData.customer_party_name || '',
        item_description: associatedArticle.item_description,
        net_weight: box.net_weight,
        total_weight: box.gross_weight,
        batch_number: associatedArticle.batch_number || '',
        box_number: box.box_number,
        manufacturing_date: associatedArticle.manufacturing_date,
        expiry_date: associatedArticle.expiry_date,
        transaction_no: formData.transaction_no,
        sku_id: associatedArticle.sku_id || 0,
        approval_authority: formData.approval_authority
      }

      // Generate QR data string
      const qrDataString = generateSimplifiedQRData(qrPayload)

      // Generate QR code as Data URL
      const qrCodeDataURL = await QRCode.toDataURL(qrDataString, {
        width: 170,
        margin: 1,
        errorCorrectionLevel: 'M'
      })

      // Format dates
      const formatDate = (dateString?: string) => {
        if (!dateString) return ''
        try {
          return new Date(dateString).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
          })
        } catch {
          return ''
        }
      }

      // Create a hidden iframe for printing
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
                * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
                }
                body {
                  font-family: Arial, sans-serif;
                  background: white;
                }
                .label-container {
                  width: 4in;
                  height: 2in;
                  background: white;
                  border: 1px solid #000;
                  display: flex;
                }
                .qr-section {
                  width: 2in;
                  height: 2in;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 0.1in;
                }
                .qr-section img {
                  width: 1.7in;
                  height: 1.7in;
                }
                .info-section {
                  width: 2in;
                  height: 2in;
                  padding: 0.08in;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                  font-size: 8pt;
                  line-height: 1.1;
                  overflow: hidden;
                }
                .company-info {
                  font-weight: bold;
                  font-size: 9pt;
                  margin-bottom: 0.02in;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                }
                .transaction-info {
                  font-size: 7pt;
                  font-family: monospace;
                  margin-bottom: 0.03in;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                }
                .item-description {
                  font-weight: bold;
                  font-size: 7.5pt;
                  line-height: 1.1;
                  max-height: 0.5in;
                  overflow: hidden;
                  display: -webkit-box;
                  -webkit-line-clamp: 2;
                  -webkit-box-orient: vertical;
                  word-wrap: break-word;
                  word-break: break-word;
                  margin-bottom: 0.03in;
                }
                .details {
                  font-size: 7.5pt;
                  line-height: 1.15;
                  flex: 1;
                  overflow: hidden;
                }
                .details-row {
                  margin-bottom: 0.01in;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                }
                .batch-info {
                  font-size: 7pt;
                  font-family: monospace;
                  margin-bottom: 0.01in;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  max-width: 1.84in;
                  display: block;
                }
                .exp-date {
                  color: #d00;
                  font-weight: bold;
                }

                @media print {
                  @page {
                    size: 4in 2in;
                    margin: 0;
                  }
                  body {
                    margin: 0;
                    padding: 0;
                    background: white;
                  }
                  .label-container {
                    width: 4in;
                    height: 2in;
                    border: 1px solid #000;
                    page-break-after: avoid;
                    page-break-inside: avoid;
                  }
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
                    <div class="details-row">
                      <span>Box #${qrPayload.box_number}</span>
                    </div>
                    <div class="details-row">
                      <span>Net Wt: ${qrPayload.net_weight}kg</span>
                    </div>
                    <div class="details-row">
                      <span>Gross Wt: ${qrPayload.total_weight}kg</span>
                    </div>
                    <div class="details-row">
                      <span>Entry: ${formatDate(qrPayload.entry_date)}</span>
                    </div>
                    ${qrPayload.expiry_date ? `
                    <div class="details-row exp-date">
                      <span>Exp: ${formatDate(qrPayload.expiry_date)}</span>
                    </div>
                    ` : ''}
                    ${qrPayload.batch_number ? `
                    <div class="batch-info">Batch: ${qrPayload.batch_number.length > 20 ? qrPayload.batch_number.substring(0, 20) + '...' : qrPayload.batch_number}</div>
                    ` : ''}
                  </div>
                  <div></div>
                </div>
              </div>
              <script>
                // Auto-trigger browser print dialog
                window.onload = function() {
                  setTimeout(() => {
                    window.print();
                    // Close iframe after printing or canceling
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

        // Listen for print completion to remove iframe
        const handleMessage = (event: MessageEvent) => {
          if (event.data === 'print-complete') {
            document.body.removeChild(iframe)
            window.removeEventListener('message', handleMessage)
          }
        }
        window.addEventListener('message', handleMessage)

        // Fallback cleanup after 30 seconds
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe)
            window.removeEventListener('message', handleMessage)
          }
        }, 30000)
      }

      console.log(`Box ${box.box_number} label sent to print`)

    } catch (error) {
      console.error("Error processing box print:", error)
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to process box print'}`)
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

  // --- Helper: ensure a valid sku_id for an article (used just before submit) ---
  const resolveSkuId = async (article: Article): Promise<number> => {
    if (article.sku_id && article.sku_id > 0) {
      return article.sku_id
    }
    
    if (!article.item_description || !article.item_category || !article.sub_category) {
      throw new Error(`Missing required fields for SKU resolution: ${article.item_description || "Unnamed item"}`)
    }
    
    try {
      // ✅ Direct typed call, no dynamic import
      const res = await dropdownApi.fetchSkuId({
        company,
        item_description: article.item_description,
        item_category: article.item_category,
        sub_category: article.sub_category,
      })
      
      const sku = Number(
        res?.sku_id ??
        res?.id ??
        res?.ID ??
        res?.SKU_ID
      )
      
      if (!Number.isFinite(sku) || sku <= 0) {
        throw new Error(`Invalid SKU ID returned: ${sku}`)
      }
      
      return sku
    } catch (error) {
      console.error("Error resolving SKU ID:", error)
      throw new Error(`Could not resolve SKU ID for "${article.item_description}": ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const handleDeleteBox = (box: Box) => {
    // Find the article associated with this box
    const associatedArticle = articles.find(art => art.item_description === box.article)
    
    if (!associatedArticle) {
      alert("Error: Could not find associated article for this box")
      return
    }

    // Confirm deletion
    if (!confirm(`Are you sure you want to remove Box #${box.box_number}? This will also decrement the quantity by 1.`)) {
      return
    }

    // Remove the box from boxes array
    const updatedBoxes = boxes.filter(b => b.id !== box.id)
    setBoxes(updatedBoxes)

    // Decrement the quantity_units of the associated article by 1
    const updatedArticles = articles.map(article => {
      if (article.id === associatedArticle.id) {
        const newQuantity = Math.max(0, article.quantity_units - 1) // Prevent negative quantities
        return {
          ...article,
          quantity_units: newQuantity,
          total_amount: (Number(article.unit_rate) || 0) * newQuantity // Recalculate total amount
        }
      }
      return article
    })
    updateFormData("", "") // Trigger re-render
    setArticles(updatedArticles)

    // Show success message
    console.log(`Box #${box.box_number} deleted successfully. Article quantity decremented.`)
  }

  const handleSave = async () => {
    const isValid = validateForm()
    if (!isValid) {
      return
    }

    setIsSubmitting(true)
    try {
      // Resolve all missing SKU IDs just-in-time to avoid race with async dropdown fetch
      const resolvedArticles = await Promise.all(
        articles.map(async (a) => {
          const sku = await resolveSkuId(a)
          return { ...a, sku_id: sku }
        })
      )

      // Persist resolved sku in state (optional but nice for consistency)
      setArticles(resolvedArticles)

      const submissionData = {
        company: company,
        transaction: {
          transaction_no: formData.transaction_no,
          entry_date: formData.entry_date,
          vehicle_number: formData.vehicle_number,
          transporter_name: formData.transporter_name,
          lr_number: formData.lr_number,
          vendor_supplier_name: formData.vendor_supplier_name,
          customer_party_name: formData.customer_party_name,
          source_location: formData.source_location,
          destination_location: formData.destination_location,
          challan_number: formData.challan_number,
          invoice_number: formData.invoice_number,
          po_number: formData.po_number,
          grn_number: formData.grn_number,
          grn_quantity: formData.grn_quantity,
          system_grn_date: formData.system_grn_date,
          purchase_by: formData.purchase_by,
          service_invoice_number: formData.service_invoice_number,
          dn_number: formData.dn_number,
          approval_authority: formData.approval_authority,
          total_amount: resolvedArticles.reduce((sum, article) => sum + article.total_amount, 0),
          tax_amount: resolvedArticles.reduce((sum, article) => sum + article.tax_amount, 0),
          discount_amount: resolvedArticles.reduce((sum, article) => sum + article.discount_amount, 0),
          received_quantity: formData.received_quantity,
          remark: formData.remark,
          currency: "INR"
        },
        articles: resolvedArticles.map(article => ({
          transaction_no: formData.transaction_no,
          sku_id: Number(article.sku_id), // guaranteed > 0
          material_type: article.material_type,
          item_description: article.item_description,
          item_category: article.item_category,
          sub_category: article.sub_category,
          uom: article.uom,
          packaging_type: article.packaging_type,
          quantity_units: article.quantity_units,
          net_weight: article.net_weight,
          total_weight: article.total_weight,
          batch_number: article.batch_number,
          lot_number: article.lot_number,
          manufacturing_date: article.manufacturing_date,
          expiry_date: article.expiry_date,
          import_date: article.import_date,
          unit_rate: article.unit_rate,
          total_amount: article.total_amount,
          tax_amount: article.tax_amount,
          discount_amount: article.discount_amount,
          currency: article.currency,
          // Issuance fields
          issuance_date: article.issuance_date,
          job_card_no: article.job_card_no,
          issuance_quantity: article.issuance_quantity
        })),
        boxes: boxes.map(box => ({
          transaction_no: formData.transaction_no,
          article_description: box.article,
          box_number: box.box_number,
          net_weight: box.net_weight,
          gross_weight: box.gross_weight,
          lot_number: box.lot_number
        }))
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/inward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(submissionData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error("Backend error response:", errorData)
        throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`)
      }

      await response.json()
      toast({
        title: "Success!",
        description: "Inward entry saved successfully!",
      })
      
      // Wait a moment to show the toast before resetting/redirecting
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Reset form to initial state
      setFormData({
        company,
        transaction_no: generateTransactionNo(),
        batch_number: generateBatchNumber(), // Generate new batch number for new transaction
        entry_date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
        vehicle_number: "",
        transporter_name: "",
        lr_number: "",
        vendor_supplier_name: "",
        customer_party_name: "",
        // Custom fields
        custom_vendor_name: "",
        custom_customer_name: "",
        custom_purchase_by: "",
        custom_approval_authority: "",
        source_location: "",
        destination_location: "",
        challan_number: "",
        invoice_number: "",
        po_number: "",
        grn_number: "",
        grn_quantity: 0,
        system_grn_date: "",
        purchase_by: "",
        bill_submitted_to_account: false,
        grn_remark: "",
        process_type: "",
        service_remarks: "",
        service_invoice_number: "",
        dn_number: "",
        approval_authority: "",
        received_quantity: 0,
        return_reason_remark: "",
        remark: "",
      })
      
      // Reset articles to initial state
      setArticles([
        {
          id: "1",
          sku_id: null,
          material_type: "",
          item_description: "",
          item_category: "",
          sub_category: "",
          quantity_units: 0,
          packaging_type: 0,
          uom: "",
          net_weight: 0,
          total_weight: 0,
          batch_number: formData.batch_number,
          lot_number: "",
          manufacturing_date: "",
          expiry_date: "",
          import_date: "",
          unit_rate: 0,
          total_amount: 0,
          tax_amount: 0,
          discount_amount: 0,
          currency: "INR",
          // Issuance fields
          issuance_date: "",
          job_card_no: "",
          issuance_quantity: 0,
        },
      ])
      
      // Clear boxes
      setBoxes([])
      
      // Clear errors
      setErrors({})
      
      // Redirect to inward list page
      router.push(`/${company}/inward`)
      
    } catch (error) {
      console.error("Error saving inward entry:", error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast({
        title: "Error!",
        description: "Error saving inward entry: " + errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClearForm = () => {
    // Reset form data to initial state
    setFormData({
      company,
      transaction_no: generateTransactionNo(),
      batch_number: generateBatchNumber(), // Generate new batch number for new transaction
      entry_date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
      vehicle_number: "",
      transporter_name: "",
      lr_number: "",
      vendor_supplier_name: "",
      customer_party_name: "",
      // Custom fields
      custom_vendor_name: "",
      custom_customer_name: "",
      custom_purchase_by: "",
      custom_approval_authority: "",
      source_location: "",
      destination_location: "",
      challan_number: "",
      invoice_number: "",
      po_number: "",
      grn_number: "",
      grn_quantity: 0,
      system_grn_date: "",
      purchase_by: "",
      bill_submitted_to_account: false,
      grn_remark: "",
      process_type: "",
      service_remarks: "",
      service_invoice_number: "",
      dn_number: "",
      approval_authority: "",
      received_quantity: 0,
      return_reason_remark: "",
      remark: "",
    })
    
    // Reset articles to initial state
    setArticles([
      {
        id: "1",
        sku_id: null,
        material_type: "",
        item_description: "",
        item_category: "",
        sub_category: "",
        quantity_units: 0,
        packaging_type: 0,
        uom: "",
        net_weight: 0,
        total_weight: 0,
        batch_number: formData.batch_number,
        lot_number: "",
        manufacturing_date: "",
        expiry_date: "",
        import_date: "",
        unit_rate: 0,
        total_amount: 0,
        tax_amount: 0,
        discount_amount: 0,
        currency: "INR",
        // Issuance fields
        issuance_date: "",
        job_card_no: "",
        issuance_quantity: 0,
      },
    ])
    
    // Clear boxes
    setBoxes([])
    
    // Clear errors
    setErrors({})
    
    // Show success message
    toast({
      title: "Form Cleared",
      description: "All form data has been reset to default values.",
    })
  }

  return (
    <PermissionGuard 
      module="inward" 
      action="create"
      fallback={
        <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 w-full flex items-center justify-center">
          <Alert variant="destructive" className="max-w-md">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              You don't have permission to create inward records. Contact your administrator for access.
            </AlertDescription>
          </Alert>
        </div>
      }
    >
      <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/${company}/inward`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Back to List</span>
              <span className="sm:hidden">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">New Inward Entry</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Create a new inward transaction</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleClearForm} className="flex-1 sm:flex-none">
            <RotateCcw className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Clear Form</span>
            <span className="sm:hidden">Clear</span>
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting} className="flex-1 sm:flex-none">
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {Object.keys(errors).length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please fix the following errors before saving:
            <ul className="mt-2 list-disc list-inside">
              {Object.values(errors).map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-4">
        {/* Main Form */}
        <div className="xl:col-span-3 space-y-4 sm:space-y-6">
          {/* System Information */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" value={company} readOnly className="bg-muted" placeholder="Company" />
                </div>
                <div>
                  <Label htmlFor="transaction_no">Transaction Number</Label>
                  <Input id="transaction_no" value={formData.transaction_no} readOnly className="bg-muted" />
                </div>
                <div>
                  <Label htmlFor="entry_date">Entry Date</Label>
                  <Input
                    id="entry_date"
                    type="datetime-local"
                    value={formData.entry_date}
                    readOnly
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label htmlFor="system_grn_date">System GRN Date</Label>
                  <Input
                    id="system_grn_date"
                    type="date"
                    value={formData.system_grn_date}
                    onChange={(e) => updateFormData("system_grn_date", e.target.value)}
                    placeholder="Select GRN date"
                    className={errors.system_grn_date ? "border-red-500" : ""}
                  />
                  {errors.system_grn_date && (
                    <p className="text-sm text-red-500 mt-1">{errors.system_grn_date}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transport Information */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Transport Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vehicle_number">Vehicle Number *</Label>
                  <Input
                    id="vehicle_number"
                    value={formData.vehicle_number}
                    onChange={(e) => updateFormData("vehicle_number", e.target.value)}
                    placeholder="MH12AB1234"
                    className={errors.vehicle_number ? "border-red-500" : ""}
                  />
                  {errors.vehicle_number && <p className="text-sm text-red-500 mt-1">{errors.vehicle_number}</p>}
                </div>
                <div>
                  <Label htmlFor="transporter_name">Transporter Name *</Label>
                  <Input
                    id="transporter_name"
                    value={formData.transporter_name}
                    onChange={(e) => updateFormData("transporter_name", e.target.value)}
                    placeholder="ABC Transport"
                    className={errors.transporter_name ? "border-red-500" : ""}
                  />
                  {errors.transporter_name && (
                    <p className="text-sm text-red-500 mt-1">{errors.transporter_name}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="lr_number">LR Number</Label>
                  <Input
                    id="lr_number"
                    value={formData.lr_number}
                    onChange={(e) => {
                      // Only allow numeric characters
                      const numericValue = e.target.value.replace(/[^0-9]/g, '')
                      updateFormData("lr_number", numericValue)
                    }}
                    placeholder="123456789"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                </div>
                <div>
                  <Label htmlFor="source_location">Source Location</Label>
                  <Input
                    id="source_location"
                    value={formData.source_location}
                    onChange={(e) => updateFormData("source_location", e.target.value)}
                    readOnly={formData.vendor_supplier_name !== "Other"}
                    className={formData.vendor_supplier_name !== "Other" ? "bg-muted" : ""}
                    placeholder={formData.vendor_supplier_name === "Other" ? "Enter source location" : "Auto-filled from vendor"}
                  />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <Label htmlFor="destination_location">Destination Location</Label>
                  <Select
                    value={formData.destination_location}
                    onValueChange={(value) => updateFormData("destination_location", value)}
                  >
                    <SelectTrigger id="destination_location">
                      <SelectValue placeholder="Select destination" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="W202">W202</SelectItem>
                      <SelectItem value="A185">A185</SelectItem>
                      <SelectItem value="A68">A68</SelectItem>
                      <SelectItem value="F53">F53</SelectItem>
                      <SelectItem value="A101">A101</SelectItem>
                      <SelectItem value="Savla">Savla</SelectItem>
                      <SelectItem value="Rishi">Rishi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Party Information */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Party Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vendor_supplier_name">Vendor/Supplier Name *</Label>
                  <SearchableSelect
                    value={formData.vendor_supplier_name}
                    onValueChange={async (value) => {
                      updateFormData("vendor_supplier_name", value)
                      
                      // If "Other" is selected, don't fetch vendor details
                      if (value === "Other") {
                        return
                      }
                      
                      // Fetch vendor details to get source location and customer
                      if (value && value.trim() !== '') {
                        try {
                          console.log("Fetching details for vendor:", value)
                          const query = new URLSearchParams()
                          query.append('company', company)
                          query.append('vendor_name', value)
                          
                          const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/api/dropdown/vendors?${query.toString()}`
                          
                          const response = await fetch(apiUrl, {
                            method: 'GET',
                            headers: {
                              'Accept': 'application/json',
                              'Content-Type': 'application/json'
                            }
                          })
                          
                          if (response.ok) {
                            const data = await response.json()
                            console.log("Vendor details:", data)
                            
                            // Auto-fill source location
                            const location = data.auto_selection?.resolved_from_vendor?.location || 
                                           data.auto_selection?.location || 
                                           data.location ||
                                           data.source_location ||
                                           ''
                            
                            if (location) {
                              console.log("Auto-filling source location:", location)
                              updateFormData("source_location", location)
                            } else {
                              console.log("No location found in vendor data")
                            }
                            
                            // Auto-fill customer/party name
                            const customer = data.auto_selection?.resolved_from_vendor?.customer_name ||
                                           data.auto_selection?.customer_name ||
                                           data.auto_selection?.customer ||
                                           data.customer_name ||
                                           data.customer ||
                                           ''
                            
                            if (customer) {
                              console.log("Auto-filling customer:", customer)
                              updateFormData("customer_party_name", customer)
                            } else {
                              console.log("No customer found in vendor data")
                            }
                          }
                        } catch (error) {
                          console.error("Error fetching vendor details:", error)
                          // Don't show error to user, just log it
                        }
                      } else {
                        // Clear source location and customer if vendor is cleared
                        updateFormData("source_location", "")
                        updateFormData("customer_party_name", "")
                      }
                    }}
                    placeholder="Search and select vendor..."
                    options={[...vendorsHook.options, { value: "Other", label: "Other" }]}
                    loading={vendorsHook.loading}
                    error={vendorsHook.error}
                    className={errors.vendor_supplier_name ? "border-red-500" : ""}
                    searchPlaceholder="Type to search vendors..."
                    onSearchChange={setVendorSearch}
                  />
                  {errors.vendor_supplier_name && (
                    <p className="text-sm text-red-500 mt-1">{errors.vendor_supplier_name}</p>
                  )}
                  
                  {/* Show custom vendor fields when "Other" is selected */}
                  {formData.vendor_supplier_name === "Other" && (
                    <div className="mt-2">
                      <div>
                        <Label htmlFor="custom_vendor_name">New vendor *</Label>
                        <Input
                          id="custom_vendor_name"
                          value={formData.custom_vendor_name}
                          onChange={(e) => updateFormData("custom_vendor_name", e.target.value)}
                          placeholder="Enter vendor name"
                          className={`mt-1 ${errors.custom_vendor_name ? "border-red-500" : ""}`}
                        />
                        {errors.custom_vendor_name && (
                          <p className="text-sm text-red-500 mt-1">{errors.custom_vendor_name}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="customer_party_name">Customer/Party Name *</Label>
                  <SearchableSelect
                    value={formData.customer_party_name}
                    onValueChange={(value) => updateFormData("customer_party_name", value)}
                    placeholder="Search and select customer..."
                    options={[...customersHook.options, { value: "Other", label: "Other" }]}
                    loading={customersHook.loading}
                    error={customersHook.error}
                    className={errors.customer_party_name ? "border-red-500" : ""}
                    searchPlaceholder="Type to search customers..."
                    onSearchChange={setCustomerSearch}
                  />
                  {errors.customer_party_name && (
                    <p className="text-sm text-red-500 mt-1">{errors.customer_party_name}</p>
                  )}
                  
                  {/* Show custom customer fields when "Other" is selected */}
                  {formData.customer_party_name === "Other" && (
                    <div className="mt-2">
                      <div>
                        <Label htmlFor="custom_customer_name">New customer *</Label>
                        <Input
                          id="custom_customer_name"
                          value={formData.custom_customer_name}
                          onChange={(e) => updateFormData("custom_customer_name", e.target.value)}
                          placeholder="Enter customer name"
                          className={`mt-1 ${errors.custom_customer_name ? "border-red-500" : ""}`}
                        />
                        {errors.custom_customer_name && (
                          <p className="text-sm text-red-500 mt-1">{errors.custom_customer_name}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="purchase_by">Purchase By *</Label>
                  <Select value={formData.purchase_by} onValueChange={(value) => updateFormData("purchase_by", value)}>
                    <SelectTrigger className={errors.purchase_by ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select purchase by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Prashant Pal">Prashant Pal</SelectItem>
                      <SelectItem value="Rakesh Ratra">Rakesh Ratra</SelectItem>
                      <SelectItem value="Ajay Bajaj">Ajay Bajaj</SelectItem>
                      <SelectItem value="Yash Gawdi">Yash Gawdi</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.purchase_by && (
                    <p className="text-sm text-red-500 mt-1">{errors.purchase_by}</p>
                  )}
                  
                  {/* Show custom purchase by field when "Other" is selected */}
                  {formData.purchase_by === "Other" && (
                    <div className="mt-2">
                      <div>
                        <Label htmlFor="custom_purchase_by">Custom Purchase By *</Label>
                        <Input
                          id="custom_purchase_by"
                          value={formData.custom_purchase_by}
                          onChange={(e) => updateFormData("custom_purchase_by", e.target.value)}
                          placeholder="Enter purchase by name"
                          className={`mt-1 ${errors.custom_purchase_by ? "border-red-500" : ""}`}
                        />
                        {errors.custom_purchase_by && (
                          <p className="text-sm text-red-500 mt-1">{errors.custom_purchase_by}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="approval_authority">Approval Authority *</Label>
                  <Select value={formData.approval_authority} onValueChange={(value) => updateFormData("approval_authority", value)}>
                    <SelectTrigger className={errors.approval_authority ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select approval authority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Vaibhav Kumkar">Vaibhav Kumkar</SelectItem>
                      <SelectItem value="Samal Kumar">Samal Kumar</SelectItem>
                      <SelectItem value="Sumit Baikar">Sumit Baikar</SelectItem>
                      <SelectItem value="Ritesh Dighe">Ritesh Dighe</SelectItem>
                      <SelectItem value="Pankaj Ranga">Pankaj Ranga</SelectItem>
                      <SelectItem value="Vaishali Dhuri">Vaishali Dhuri</SelectItem>
                      <SelectItem value="Himanshu Jadhav">Himanshu Jadhav</SelectItem>
                      <SelectItem value="Suresh Luthra">Suresh Luthra</SelectItem>
                      <SelectItem value="B Hrithik">B Hrithik</SelectItem>
                      <SelectItem value="Suraj Salunkhe">Suraj Salunkhe</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.approval_authority && (
                    <p className="text-sm text-red-500 mt-1">{errors.approval_authority}</p>
                  )}
                  
                  {/* Show custom approval authority field when "Other" is selected */}
                  {formData.approval_authority === "Other" && (
                    <div className="mt-2">
                      <div>
                        <Label htmlFor="custom_approval_authority">Custom Approval Authority *</Label>
                        <Input
                          id="custom_approval_authority"
                          value={formData.custom_approval_authority}
                          onChange={(e) => updateFormData("custom_approval_authority", e.target.value)}
                          placeholder="Enter approval authority name"
                          className={`mt-1 ${errors.custom_approval_authority ? "border-red-500" : ""}`}
                        />
                        {errors.custom_approval_authority && (
                          <p className="text-sm text-red-500 mt-1">{errors.custom_approval_authority}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Document Information */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Document Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="challan_number">Challan Number</Label>
                  <Input
                    id="challan_number"
                    value={formData.challan_number}
                    onChange={(e) => updateFormData("challan_number", e.target.value)}
                    placeholder="CH001"
                  />
                </div>
                <div>
                  <Label htmlFor="invoice_number">Invoice Number</Label>
                  <Input
                    id="invoice_number"
                    value={formData.invoice_number}
                    onChange={(e) => updateFormData("invoice_number", e.target.value)}
                    placeholder="INV001"
                  />
                </div>
                <div>
                  <Label htmlFor="po_number">PO Number</Label>
                  <Input id="po_number" value={formData.po_number} onChange={(e) => updateFormData("po_number", e.target.value)} placeholder="PO001" />
                </div>
                <div>
                  <Label htmlFor="grn_number">GRN Number</Label>
                  <Input id="grn_number" value={formData.grn_number} onChange={(e) => updateFormData("grn_number", e.target.value)} placeholder="GRN001" />
                </div>
                <div>
                  <Label htmlFor="grn_quantity">GRN Quantity</Label>
                  <Input
                    id="grn_quantity"
                    type="text"
                    value={grnQuantityDisplay}
                    onChange={(e) => {
                      const inputValue = e.target.value
                      // Allow empty string, numbers, and decimal point
                      if (inputValue === '' || /^\d*\.?\d*$/.test(inputValue)) {
                        setGrnQuantityDisplay(inputValue)
                      }
                    }}
                    onBlur={(e) => {
                      // Convert to float when user finishes typing
                      const value = parseFloat(e.target.value) || 0
                      updateFormData("grn_quantity", value)
                      setGrnQuantityDisplay(value.toString())
                    }}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <Label htmlFor="received_quantity">Received Quantity</Label>
                  <Input
                    id="received_quantity"
                    type="text"
                    value={receivedQuantityDisplay}
                    onChange={(e) => {
                      const inputValue = e.target.value
                      // Allow empty string, numbers, and decimal point
                      if (inputValue === '' || /^\d*\.?\d*$/.test(inputValue)) {
                        setReceivedQuantityDisplay(inputValue)
                      }
                    }}
                    onBlur={(e) => {
                      // Convert to float when user finishes typing
                      const value = parseFloat(e.target.value) || 0
                      updateFormData("received_quantity", value)
                      setReceivedQuantityDisplay(value.toString())
                    }}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <Label htmlFor="dn_number">Delivery Note Number</Label>
                  <Input id="dn_number" value={formData.dn_number} onChange={(e) => updateFormData("dn_number", e.target.value)} placeholder="DN001" />
                </div>
                <div>
                  <Label htmlFor="service_invoice_number">Service Invoice Number</Label>
                  <Input
                    id="service_invoice_number"
                    value={formData.service_invoice_number}
                    onChange={(e) => updateFormData("service_invoice_number", e.target.value)}
                    placeholder="SRV001"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Remarks Section */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Remarks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="remark">General Remarks</Label>
                <Textarea
                  id="remark"
                  value={formData.remark}
                  onChange={(e) => updateFormData("remark", e.target.value)}
                  placeholder="Remark regarding Short Quantity, Damaged Packaging, Moisture Content High, Mismatched Batch No., Infestation Detected, Temperature Deviation, etc."
                  className="min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Articles Section */}
          <Card className="w-full">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle>Articles</CardTitle>
                <Button onClick={addArticle} size="sm" className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Article
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {articles.map((article, index) => {
                console.log("Rendering article:", { id: article.id, material_type: article.material_type, index })
                return (
                <div key={article.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Article {index + 1}</h4>
                    <div className="flex items-center gap-2">
                      {article.sku_id && (
                        <Badge variant="outline" className="text-xs">
                          SKU: {article.sku_id}
                        </Badge>
                      )}
                      {articles.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeArticle(article.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Material Type */}
                    <div>
                      <Label htmlFor={`material_type_${article.id}`}>Material Type *</Label>
                      <MaterialTypeDropdown
                        value={article.material_type}
                        onValueChange={(value) => {
                          console.log("Material Type selected:", value, "for article:", article.id, "current material_type:", article.material_type)
                          // Update the article with new material type and clear dependent fields in a single operation
                          const updatedArticles = articles.map((art) => {
                            if (art.id === article.id) {
                              return {
                                ...art,
                                material_type: value,
                                item_category: "",
                                sub_category: "",
                                item_description: "",
                                sku_id: null
                              }
                            }
                            return art
                          })
                          console.log("Updating articles with material_type:", updatedArticles)
                          setArticles(updatedArticles)
                        }}
                        company={company}
                        error={errors[`article_${index}_material_type`]}
                      />
                      {errors[`article_${index}_material_type`] && (
                        <p className="text-sm text-red-500 mt-1">{errors[`article_${index}_material_type`]}</p>
                      )}
                    </div>

                    {/* Item Category */}
                    <div>
                      <Label htmlFor={`item_category_${article.id}`}>Item Category *</Label>
                      <ItemCategoryDropdown
                        materialType={article.material_type}
                        value={article.item_category}
                        onValueChange={(value) => {
                          console.log("Item Category selected:", value, "for article:", article.id)
                          // Update the article with new category and clear dependent fields in a single operation
                          const updatedArticles = articles.map((art) => {
                            if (art.id === article.id) {
                              return {
                                ...art,
                                item_category: value,
                                sub_category: "",
                                item_description: "",
                                sku_id: null
                              }
                            }
                            return art
                          })
                          setArticles(updatedArticles)
                        }}
                        company={company}
                        error={errors[`article_${index}_category`]}
                        disabled={!article.material_type}
                      />
                      {errors[`article_${index}_category`] && (
                        <p className="text-sm text-red-500 mt-1">{errors[`article_${index}_category`]}</p>
                      )}
                    </div>

                    {/* Sub Category */}
                    <div>
                      <Label htmlFor={`sub_category_${article.id}`}>Sub Category *</Label>
                      <SubCategoryDropdown
                        articleId={article.id}
                        categoryId={article.item_category}
                        value={article.sub_category}
                        onValueChange={(value) => {
                          console.log("Sub Category selected:", value, "for article:", article.id)
                          // Update the article with new sub category and clear dependent fields in a single operation
                          const updatedArticles = articles.map((art) => {
                            if (art.id === article.id) {
                              return {
                                ...art,
                                sub_category: value,
                                item_description: "",
                                sku_id: null
                              }
                            }
                            return art
                          })
                          setArticles(updatedArticles)
                        }}
                        company={company}
                        error={errors[`article_${index}_sub_category`]}
                        disabled={!article.material_type || !article.item_category}
                        materialType={article.material_type}
                      />
                      {errors[`article_${index}_sub_category`] && (
                        <p className="text-sm text-red-500 mt-1">{errors[`article_${index}_sub_category`]}</p>
                      )}
                    </div>

                    {/* Item Description */}
                    <div>
                      <Label htmlFor={`item_description_${article.id}`}>Item Description *</Label>
                      <ItemDescriptionDropdown
                        articleId={article.id}
                        categoryId={article.item_category}
                        subCategoryId={article.sub_category}
                        materialType={article.material_type}
                        value={article.item_description}
                        onValueChange={(value) => {
                          console.log("Item Description selected:", value, "for article:", article.id)
                          // Update the article with new item description in a single operation
                          const updatedArticles = articles.map((art) => {
                            if (art.id === article.id) {
                              return {
                                ...art,
                                item_description: value
                              }
                            }
                            return art
                          })
                          setArticles(updatedArticles)
                        }}
                        company={company}
                        error={errors[`article_${index}_description`]}
                        updateArticle={updateArticle}
                        disabled={!article.material_type || !article.item_category || !article.sub_category}
                      />
                      {errors[`article_${index}_description`] && (
                        <p className="text-sm text-red-500 mt-1">{errors[`article_${index}_description`]}</p>
                      )}
                    </div>

                    {/* Quantity Units */}
                    <div>
                      <Label htmlFor={`quantity_units_${article.id}`}>Quantity Units *</Label>
                      <Input
                        id={`quantity_units_${article.id}`}
                        type="number"
                        min="0"
                        value={article.quantity_units}
                        onChange={(e) => updateArticle(article.id, "quantity_units", Number(e.target.value))}
                        onWheel={(e) => e.currentTarget.blur()}
                        className={quantityWarnings[article.id] ? "border-yellow-500" : errors[`article_${index}_quantity`] ? "border-red-500" : ""}
                      />
                      {quantityWarnings[article.id] && (
                        <p className="text-sm text-yellow-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {quantityWarnings[article.id]}
                        </p>
                      )}
                      {errors[`article_${index}_quantity`] && (
                        <p className="text-sm text-red-500 mt-1">{errors[`article_${index}_quantity`]}</p>
                      )}
                    </div>

                    {/* Pack Size */}
                    <div>
                      <Label htmlFor={`packaging_type_${article.id}`}>Pack size (weight per Unit)</Label>
                      <Input
                        id={`packaging_type_${article.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={article.packaging_type}
                        onChange={(e) => updateArticle(article.id, "packaging_type", parseFloat(e.target.value) || 0)}
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder="10.5"
                      />
                    </div>

                    {/* UOM */}
                    <div>
                      <Label htmlFor={`uom_${article.id}`}>UOM *</Label>
                      <Select value={article.uom} onValueChange={(value) => updateArticle(article.id, "uom", value)}>
                        <SelectTrigger id={`uom_${article.id}`} className={errors[`article_${index}_uom`] ? "border-red-500" : ""}>
                          <SelectValue placeholder="Select UOM" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BAG">BAG</SelectItem>
                          <SelectItem value="BOX">BOX</SelectItem>
                          <SelectItem value="CARTON">CARTON</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors[`article_${index}_uom`] && (
                        <p className="text-sm text-red-500 mt-1">{errors[`article_${index}_uom`]}</p>
                      )}
                    </div>

                    {/* Net Weight */}
                    <div>
                      <Label htmlFor={`net_weight_${article.id}`}>Net Weight *</Label>
                      <Input
                        id={`net_weight_${article.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={article.net_weight}
                        onChange={(e) => updateArticle(article.id, "net_weight", Number(e.target.value))}
                        onWheel={(e) => e.currentTarget.blur()}
                        className={errors[`article_${index}_net_weight`] ? "border-red-500" : ""}
                      />
                      {errors[`article_${index}_net_weight`] && (
                        <p className="text-sm text-red-500 mt-1">{errors[`article_${index}_net_weight`]}</p>
                      )}
                    </div>

                    {/* Gross Weight */}
                    <div>
                      <Label htmlFor={`gross_weight_${article.id}`}>Gross Weight *</Label>
                      <Input
                        id={`gross_weight_${article.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={article.total_weight}
                        onChange={(e) => updateArticle(article.id, "total_weight", Number(e.target.value))}
                        onWheel={(e) => e.currentTarget.blur()}
                        className={errors[`article_${index}_total_weight`] ? "border-red-500" : ""}
                      />
                      {errors[`article_${index}_total_weight`] && (
                        <p className="text-sm text-red-500 mt-1">{errors[`article_${index}_total_weight`]}</p>
                      )}
                      {article.net_weight > 0 && article.total_weight > 0 && article.total_weight <= article.net_weight && (
                        <p className="text-sm text-orange-500 mt-1">⚠️ Gross weight should be greater than net weight ({article.net_weight} kg)</p>
                      )}
                    </div>

                    {/* Batch Number */}
                    <div>
                      <Label htmlFor={`batch_number_${article.id}`}>Batch Number</Label>
                      <Input id={`batch_number_${article.id}`} value={article.batch_number} readOnly className="bg-muted" />
                    </div>

                    {/* Lot Number */}
                    <div>
                      <Label htmlFor={`lot_number_${article.id}`}>Lot Number</Label>
                      <Input
                        id={`lot_number_${article.id}`}
                        value={article.lot_number}
                        onChange={(e) => updateArticle(article.id, "lot_number", e.target.value)}
                        placeholder="LOT-2024-001"
                      />
                    </div>

                    {/* Manufacturing Date */}
                    <div>
                      <Label htmlFor={`manufacturing_date_${article.id}`}>Manufacturing Date</Label>
                      <Input
                        id={`manufacturing_date_${article.id}`}
                        type="date"
                        value={article.manufacturing_date}
                        onChange={(e) => updateArticle(article.id, "manufacturing_date", e.target.value)}
                      />
                    </div>

                    {/* Expiry Date */}
                    <div>
                      <Label htmlFor={`expiry_date_${article.id}`}>Expiry Date</Label>
                      <Input
                        id={`expiry_date_${article.id}`}
                        type="date"
                        value={article.expiry_date}
                        onChange={(e) => updateArticle(article.id, "expiry_date", e.target.value)}
                      />
                    </div>

                    {/* Import Date */}
                    <div>
                      <Label htmlFor={`import_date_${article.id}`}>Import Date</Label>
                      <Input
                        id={`import_date_${article.id}`}
                        type="date"
                        value={article.import_date}
                        onChange={(e) => updateArticle(article.id, "import_date", e.target.value)}
                      />
                    </div>

                    {/* Unit Rate
                    <div>
                      <Label htmlFor={`unit_rate_${article.id}`}>Unit Rate</Label>
                      <Input
                        id={`unit_rate_${article.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={article.unit_rate}
                        onChange={(e) => updateArticle(article.id, "unit_rate", Number(e.target.value))}
                        onWheel={(e) => e.currentTarget.blur()}
                        className={errors[`article_${index}_unit_rate`] ? "border-red-500" : ""}
                      />
                      {errors[`article_${index}_unit_rate`] && (
                        <p className="text-sm text-red-500 mt-1">{errors[`article_${index}_unit_rate`]}</p>
                      )}
                    </div>

                    {/* Total Amount
                    <div>
                      <Label htmlFor={`total_amount_${article.id}`}>Total Amount</Label>
                      <Input
                        id={`total_amount_${article.id}`}
                        type="number"
                        step="0.01"
                        value={article.total_amount}
                        readOnly
                        className="bg-muted"
                      />
                    </div>

                    {/* Tax Amount 
                    <div>
                      <Label htmlFor={`tax_amount_${article.id}`}>Tax Amount</Label>
                      <Input
                        id={`tax_amount_${article.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={article.tax_amount}
                        onChange={(e) => updateArticle(article.id, "tax_amount", Number(e.target.value))}
                        onWheel={(e) => e.currentTarget.blur()}
                        className={errors[`article_${index}_tax_amount`] ? "border-red-500" : ""}
                      />
                      {errors[`article_${index}_tax_amount`] && (
                        <p className="text-sm text-red-500 mt-1">{errors[`article_${index}_tax_amount`]}</p>
                      )}
                    </div>

                    
                    <div>
                      <Label htmlFor={`discount_amount_${article.id}`}>Discount Amount</Label>
                      <Input
                        id={`discount_amount_${article.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={article.discount_amount}
                        onChange={(e) => updateArticle(article.id, "discount_amount", Number(e.target.value))}
                        onWheel={(e) => e.currentTarget.blur()}
                        className={errors[`article_${index}_discount_amount`] ? "border-red-500" : ""}
                      />
                      {errors[`article_${index}_discount_amount`] && (
                        <p className="text-sm text-red-500 mt-1">{errors[`article_${index}_discount_amount`]}</p>
                      )}
                    </div> */}

                    
                    {/* <div>
                      <Label htmlFor={`currency_${article.id}`}>Currency</Label>
                      <Select value={article.currency} onValueChange={(value) => updateArticle(article.id, "currency", value)}>
                        <SelectTrigger id={`currency_${article.id}`}>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INR">INR</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div> */}
                  </div>

                  {/* Issuance Section */}
                  <div className="border-t pt-4">
                    <h5 className="font-medium mb-4 text-blue-600">Issuance Details</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Issuance Date */}
                      <div>
                        <Label htmlFor={`issuance_date_${article.id}`}>Issuance Date</Label>
                        <Input
                          id={`issuance_date_${article.id}`}
                          type="date"
                          value={article.issuance_date}
                          onChange={(e) => updateArticle(article.id, "issuance_date", e.target.value)}
                          className={errors[`article_${index}_issuance_date`] ? "border-red-500" : ""}
                        />
                        {errors[`article_${index}_issuance_date`] && (
                          <p className="text-sm text-red-500 mt-1">{errors[`article_${index}_issuance_date`]}</p>
                        )}
                      </div>

                      {/* Job Card No */}
                      <div>
                        <Label htmlFor={`job_card_no_${article.id}`}>Job Card No</Label>
                        <Input
                          id={`job_card_no_${article.id}`}
                          type="text"
                          value={article.job_card_no}
                          onChange={(e) => updateArticle(article.id, "job_card_no", e.target.value)}
                          placeholder="Enter job card number"
                          className={errors[`article_${index}_job_card_no`] ? "border-red-500" : ""}
                        />
                        {errors[`article_${index}_job_card_no`] && (
                          <p className="text-sm text-red-500 mt-1">{errors[`article_${index}_job_card_no`]}</p>
                        )}
                      </div>

                      {/* Issuance Quantity */}
                      <div>
                        <Label htmlFor={`issuance_quantity_${article.id}`}>Issuance Quantity</Label>
                        <Input
                          id={`issuance_quantity_${article.id}`}
                          type="text"
                          value={issuanceQuantityDisplays[article.id] || ""}
                          onChange={(e) => {
                            const inputValue = e.target.value
                            // Allow empty string, numbers, and decimal point
                            if (inputValue === '' || /^\d*\.?\d*$/.test(inputValue)) {
                              setIssuanceQuantityDisplays(prev => ({
                                ...prev,
                                [article.id]: inputValue
                              }))
                            }
                          }}
                          onBlur={(e) => {
                            // Convert to float when user finishes typing
                            const value = parseFloat(e.target.value) || 0
                            updateArticle(article.id, "issuance_quantity", value)
                            setIssuanceQuantityDisplays(prev => ({
                              ...prev,
                              [article.id]: value.toString()
                            }))
                          }}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="0.00"
                          inputMode="decimal"
                          className={errors[`article_${index}_issuance_quantity`] ? "border-red-500" : ""}
                        />
                        {errors[`article_${index}_issuance_quantity`] && (
                          <p className="text-sm text-red-500 mt-1">{errors[`article_${index}_issuance_quantity`]}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Box Management */}
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Box Management ({boxes.length} boxes)</CardTitle>
            </CardHeader>
            <CardContent>
              {boxes.length > 0 ? (
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
                              <span className="ml-2 font-medium">{stats.netWeight.toFixed(2)} kg</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Total Gross Weight:</span>
                              <span className="ml-2 font-medium">{stats.grossWeight.toFixed(2)} kg</span>
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
                            <th className="border border-gray-300 px-4 py-2 text-left font-medium">Net Weight (kg)</th>
                            <th className="border border-gray-300 px-4 py-2 text-left font-medium">Gross Weight (kg)</th>
                            <th className="border border-gray-300 px-4 py-2 text-left font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {boxes.map((box) => (
                            <tr key={box.id} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-4 py-2">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                                  <span className="font-medium text-sm">{box.box_number}</span>
                                </div>
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                <span className="text-sm font-medium">{box.article}</span>
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                <span className="text-sm">{box.lot_number || "-"}</span>
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={box.net_weight}
                                  onChange={(e) => updateBox(box.id, "net_weight", Number(e.target.value))}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  className="w-full"
                                />
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={box.gross_weight}
                                  onChange={(e) => updateBox(box.id, "gross_weight", Number(e.target.value))}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  className="w-full"
                                />
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
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-center">
                      <p className="text-sm text-blue-700 font-medium">Total Boxes</p>
                      <p className="text-2xl font-bold text-blue-900">{boxes.length}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-blue-700 font-medium">Total Net Weight</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {boxes.reduce((sum, box) => sum + box.net_weight, 0).toFixed(2)} kg
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-blue-700 font-medium">Total Gross Weight</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {boxes.reduce((sum, box) => sum + box.gross_weight, 0).toFixed(2)} kg
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No boxes generated yet. Add articles with quantities to generate boxes.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          <Card className="w-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Quick Box Preview</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              {boxes.length > 0 ? (
                <div className="space-y-2">
                  {/* Total Statistics */}
                  <div className="grid grid-cols-1 gap-2 p-2 bg-blue-50 rounded border">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-blue-700">Total Boxes:</span>
                      <span className="text-sm font-bold text-blue-900">{boxes.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-blue-700">Net Weight:</span>
                      <span className="text-sm font-bold text-blue-900">
                        {boxes.reduce((sum, box) => sum + box.net_weight, 0).toFixed(2)} kg
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-blue-700">Gross Weight:</span>
                      <span className="text-sm font-bold text-blue-900">
                        {boxes.reduce((sum, box) => sum + box.gross_weight, 0).toFixed(2)} kg
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center">No boxes</p>
              )}
            </CardContent>
          </Card>

          <Card className="w-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Articles:</span>
                <span className="text-sm font-medium">{articles.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Quantity:</span>
                <span className="text-sm font-medium">
                  {articles.reduce((sum, article) => sum + article.quantity_units, 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Boxes:</span>
                <span className="text-sm font-medium">{boxes.length}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Amount:</span>
                <span className="text-sm font-bold">
                  ₹{articles.reduce((sum, article) => sum + article.total_amount, 0).toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </PermissionGuard>
  )
}
