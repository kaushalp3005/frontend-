"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useItemCategories, useSubCategories, useItemDescriptions } from "@/lib/hooks/useDropdownData"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { dropdownApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Send, Package, X, Clock, Plus, Trash2, Camera } from "lucide-react"
import type { Company } from "@/types/auth"
import { InterunitApiService } from "@/lib/interunitApiService"
import { useToast } from "@/hooks/use-toast"
import HighPerformanceQRScanner from "@/components/transfer/high-performance-qr-scanner"

interface NewTransferRequestPageProps {
  params: {
    company: Company
  }
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
        
        // Additional debugging - check if we're getting any data at all
        console.log("=== API RESPONSE DEBUG ===")
        console.log("Raw response:", data)
        console.log("Response type:", typeof data)
        console.log("Response keys:", Object.keys(data || {}))
        if (data?.options) {
          console.log("Options keys:", Object.keys(data.options))
          console.log("Options values:", data.options)
        }
        console.log("=== END API RESPONSE DEBUG ===")
        
        console.log("Material Types API Response:", data)
        console.log("Full API Response:", JSON.stringify(data, null, 2))
        
        // Debug: Check the structure of the response
        console.log("Response structure check:")
        console.log("- data:", typeof data, data)
        console.log("- data.options:", typeof data?.options, data?.options)
        console.log("- data.options.material_types:", typeof data?.options?.material_types, data?.options?.material_types)
        console.log("- Array.isArray check:", Array.isArray(data?.options?.material_types))
        
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
          console.log("Using fallback material types - API response structure:")
          console.log("- data.options exists:", !!data.options)
          console.log("- data.options.material_types exists:", !!data.options?.material_types)
          console.log("- data.options.material_types is array:", Array.isArray(data.options?.material_types))
          
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
  
  // Don't normalize - let SearchableSelect handle empty states
  const normalizedValue = value || ""
  
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

// Sub Category dropdown component
function SubCategoryDropdown({ 
  articleId,
  categoryId, 
  value, 
  onValueChange, 
  company,
  error,
  disabled,
  materialType 
}: {
  articleId: string
  categoryId: string
  value: string
  onValueChange: (value: string) => void
  company: Company
  error?: string
  disabled?: boolean
  materialType?: string
}) {
  const subCategoriesHook = useSubCategories(categoryId, { company, material_type: materialType })
  
  console.log("SubCategoryDropdown render:", { 
    value, 
    categoryId, 
    materialType, 
    optionsCount: subCategoriesHook.options.length,
    options: subCategoriesHook.options,
    matchingOption: subCategoriesHook.options.find(opt => opt.value === value)
  })
  
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

// Item Description dropdown component
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
}: {
  articleId: string
  categoryId: string
  subCategoryId: string
  materialType: string
  value: string
  onValueChange: (value: string) => void
  company: Company
  error?: string
  updateArticle?: (id: string, field: string, value: any) => void
  disabled?: boolean
}) {
  const itemDescriptionsHook = useItemDescriptions({ company, material_type: materialType, item_category: categoryId, sub_category: subCategoryId })
  
  console.log("ItemDescriptionDropdown render:", {
    value,
    categoryId,
    subCategoryId,
    materialType,
    optionsCount: itemDescriptionsHook.options.length,
    options: itemDescriptionsHook.options,
    matchingOption: itemDescriptionsHook.options.find(opt => opt.value === value)
  })
  
  const handleValueChange = async (selectedValue: string) => {
    // Find the selected option to get the label
    const selectedOption = itemDescriptionsHook.options.find(option => option.value === selectedValue)
    if (selectedOption && updateArticle) {
      // Update item_description immediately
      updateArticle(articleId, "item_description", selectedOption.label)
      
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
        updateArticle(articleId, "sku_id", skuId)
        
        // Extract and update material_type from the new payload structure
        const responseMaterialType = skuResponse?.material_type
        if (responseMaterialType) {
          updateArticle(articleId, "material_type", responseMaterialType)
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

export default function NewTransferRequestPage({ params }: NewTransferRequestPageProps) {
  const { company } = params
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  
  // Get requestId from URL parameter
  const requestIdFromUrl = searchParams.get('requestId')
  
  // Generate transfer request number with format: TRANSYYYYMMDDHHMM
  const generateTransferNo = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    return `TRANS${year}${month}${day}${hours}${minutes}`
  }
  
  // Original request number from which transfer is being created
  const [requestNo, setRequestNo] = useState("")
  
  // New transfer number (auto-generated)
  const [transferNo, setTransferNo] = useState(generateTransferNo())
  
  // Get current date in DD-MM-YYYY format
  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })



  const [formData, setFormData] = useState({
    requestDate: currentDate,
    fromWarehouse: "",
    toWarehouse: "",
    reason: "",
    reasonDescription: ""
  })

  // Article interface matching inward form
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
  }

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
      batch_number: "",
      lot_number: "",
      manufacturing_date: "",
      expiry_date: "",
      import_date: "",
      unit_rate: 0,
      total_amount: 0,
      tax_amount: 0,
      discount_amount: 0,
      currency: "INR",
    },
  ])

  const [transferInfo, setTransferInfo] = useState({
    vehicleNumber: "",
    vehicleNumberOther: "",
    driverName: "",
    driverNameOther: "",
    approvalAuthority: "",
    approvalAuthorityOther: ""
  })

  // Store all loaded items from request
  const [loadedItems, setLoadedItems] = useState<any[]>([])

  // Store scanned boxes from QR codes
  const [scannedBoxes, setScannedBoxes] = useState<any[]>([])
  
  // Counter for unique box IDs (persists across re-renders using ref)
  const boxIdCounterRef = useRef(1)
  
  // Processing flag to prevent duplicate scans
  const isProcessingRef = useRef(false)

  // Control high-performance QR scanner visibility
  const [showScanner, setShowScanner] = useState(false)
  
  // Validation errors state
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Use the same dropdown hooks as inward module with material_type
  const { options: itemCategories, loading: categoriesLoading } = useItemCategories({ company, material_type: articles[0]?.material_type || "" })
  const { options: subCategories, loading: subCategoriesLoading } = useSubCategories(articles[0]?.item_category || "", { company, material_type: articles[0]?.material_type || "" })
  const { options: itemDescriptions, loading: descriptionsLoading } = useItemDescriptions({ 
    company, 
    material_type: articles[0]?.material_type || "",
    item_category: articles[0]?.item_category || "", 
    sub_category: articles[0]?.sub_category || "" 
  })

  // Debug: Log dropdown options when they change
  useEffect(() => {
    console.log('🔍 DROPDOWN OPTIONS DEBUG:')
    console.log('📌 Article[0] State:', {
      material_type: articles[0]?.material_type,
      item_category: articles[0]?.item_category,
      sub_category: articles[0]?.sub_category,
      item_description: articles[0]?.item_description
    })
    console.log('📋 Category Options:', itemCategories.length, 'options')
    console.log('📋 SubCategory Options:', subCategories.length, 'options', subCategories.map(o => o.value))
    console.log('📋 Description Options:', itemDescriptions.length, 'options', itemDescriptions.map(o => o.value))
    console.log('✅ Category Match:', itemCategories.find(o => o.value === articles[0]?.item_category))
    console.log('✅ SubCategory Match:', subCategories.find(o => o.value === articles[0]?.sub_category))
    console.log('✅ Description Match:', itemDescriptions.find(o => o.value === articles[0]?.item_description))
  }, [articles[0]?.material_type, articles[0]?.item_category, articles[0]?.sub_category, articles[0]?.item_description, itemCategories, subCategories, itemDescriptions])

  // Fallback data when API is not available
  const fallbackCategories = [
    { value: "raw_materials", label: "Raw Materials" },
    { value: "packaging", label: "Packaging Materials" },
    { value: "finished_goods", label: "Finished Goods" }
  ]



  const fallbackSubCategories = {
    "raw_materials": [
      { value: "flour", label: "Flour" },
      { value: "sugar", label: "Sugar" },
      { value: "oil", label: "Oil" }
    ],
    "packaging": [
      { value: "boxes", label: "Boxes" },
      { value: "bags", label: "Bags" },
      { value: "labels", label: "Labels" }
    ],
    "finished_goods": [
      { value: "biscuits", label: "Biscuits" },
      { value: "cakes", label: "Cakes" },
      { value: "snacks", label: "Snacks" }
    ]
  }



  const fallbackDescriptions = {
    "flour": [
      { value: "wheat_flour_1kg", label: "Wheat Flour 1kg" },
      { value: "maida_flour_500g", label: "Maida Flour 500g" }
    ],
    "sugar": [
      { value: "white_sugar_1kg", label: "White Sugar 1kg" },
      { value: "brown_sugar_500g", label: "Brown Sugar 500g" }
    ],
    "oil": [
      { value: "sunflower_oil_1l", label: "Sunflower Oil 1L" },
      { value: "mustard_oil_500ml", label: "Mustard Oil 500ml" }
    ]
  }

  // Use API data if available, otherwise use fallback
  const finalCategories = itemCategories.length > 0 ? itemCategories : fallbackCategories
  const finalSubCategories = subCategories.length > 0 ? subCategories : (fallbackSubCategories[articles[0]?.item_category as keyof typeof fallbackSubCategories] || [])
  const finalDescriptions = itemDescriptions.length > 0 ? itemDescriptions : (fallbackDescriptions[articles[0]?.sub_category as keyof typeof fallbackDescriptions] || [])
  
  // Check if we're using fallback data (for debugging)
  const isUsingFallback = itemCategories.length === 0

  // Load request details if requestId is provided
  useEffect(() => {
    const loadRequestDetails = async () => {
      if (!requestIdFromUrl) return

      try {
        console.log('🔍 Loading request details for ID:', requestIdFromUrl)
        
        // Fetch single request by ID
        const request = await InterunitApiService.getRequest(parseInt(requestIdFromUrl))
        
        console.log('✅ Request found:', request)
        console.log('📋 Request Details:', {
          request_no: request.request_no,
          request_date: request.request_date,
          from_warehouse: request.from_warehouse,
          to_warehouse: request.to_warehouse,
          reason_description: request.reason_description,
          lines_count: request.lines?.length
        })
        
        // Set original request number (REQ...)
        setRequestNo(request.request_no)
        console.log('✅ Set requestNo:', request.request_no)
        
        // Normalize warehouse values to match dropdown options
        const normalizeWarehouse = (value: string) => {
          if (!value) return ""
          // If value is "N/A", return empty string
          if (value === "N/A") return ""
          // Otherwise return as is (should match dropdown exactly)
          return value
        }
        
        // Update form data - populate ALL header fields
        const formDataToSet = {
          requestDate: request.request_date,
          fromWarehouse: normalizeWarehouse(request.from_warehouse),
          toWarehouse: normalizeWarehouse(request.to_warehouse),
          reason: "", // Will be set based on reason_description if needed
          reasonDescription: request.reason_description === "No description provided" ? "" : request.reason_description
        }
        console.log('📝 Setting formData:', formDataToSet)
        setFormData(formDataToSet)
        console.log('✅ FormData set successfully')

        // Populate article/item data from first line item (if exists)
        if (request.lines && request.lines.length > 0) {
          const firstItem = request.lines[0]
          console.log('📦 First item from API:', firstItem)
          console.log('📋 Full first item details:', JSON.stringify(firstItem, null, 2))

          // Normalize field values to match dropdown options
          const normalizeField = (value: string | undefined | null) => {
            // Return empty string for null, undefined, or empty string
            if (!value || value === "") return ""
            // Return the value as-is (backend now returns empty string instead of "N/A")
            // Keep original case - DO NOT convert to uppercase
            const trimmedValue = value.trim()
            console.log(`  Normalizing: "${value}" → "${trimmedValue}"`)
            return trimmedValue
          }
          
          // Convert to Title Case to match dropdown options
          const toTitleCase = (str: string) => {
            if (!str) return str
            return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())
          }
          
          // Normalize case to match dropdown format
          const normalizeForDropdown = (value: string) => {
            if (!value) return value
            // Convert to Title Case for category fields (they use Title Case in dropdown)
            return toTitleCase(value)
          }
          
          // Convert uppercase to CamelCase to match dropdown options
          const toCamelCase = (str: string) => {
            return str.toLowerCase()
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
                return index === 0 ? word.toLowerCase() : word.toUpperCase()
              })
              .replace(/\s+/g, '')
              .replace(/-/g, '')
              .replace(/\[/g, '')
              .replace(/\]/g, '')
          }
          
          // Check if value is all uppercase and convert to CamelCase
          const normalizeCase = (value: string) => {
            if (!value) return value
            // If value is all uppercase AND has spaces or special chars, convert to CamelCase
            // This handles cases like "ALMOND - BROKEN" → "almondBroken"
            // But keeps simple acronyms like "FG", "PM", "RM" as-is
            if (value === value.toUpperCase() && value !== value.toLowerCase() && (value.includes(' ') || value.includes('-') || value.includes('['))) {
              const camelCase = toCamelCase(value)
              console.log(`  Converting case: "${value}" → "${camelCase}"`)
              return camelCase
            }
            return value
          }

          // Update the first article with the loaded data
          const updatedArticles = articles.map((art, index) => {
            if (index === 0) {
              console.log('📝 ====== AUTO-FILLING ARTICLE FROM REQUEST ======')
              console.log('  - material_type:', firstItem.material_type)
              console.log('  - item_category:', firstItem.item_category)
              console.log('  - sub_category:', firstItem.sub_category)
              console.log('  - item_description:', firstItem.item_description)
              console.log('  - quantity:', firstItem.quantity)
              console.log('  - uom:', firstItem.uom)
              console.log('  - pack_size:', firstItem.pack_size)
              console.log('  - net_weight:', firstItem.net_weight)
              console.log('  - sku_id:', firstItem.sku_id)
              console.log('===============================================')

              return {
                ...art,
                // Auto-fill all item classification fields
                // Keep values exactly as returned from API - DO NOT transform case
                material_type: normalizeField(firstItem.material_type),
                item_category: normalizeField(firstItem.item_category),
                sub_category: normalizeField(firstItem.sub_category),
                item_description: normalizeField(firstItem.item_description),

                // Auto-fill quantity and measurement fields
                quantity_units: parseInt(firstItem.quantity) || 0,
                uom: normalizeField(firstItem.uom),
                packaging_type: parseFloat(firstItem.pack_size) || 0,
                net_weight: parseFloat(firstItem.net_weight) || 0,

                // Auto-fill SKU ID if available (convert string to number)
                sku_id: firstItem.sku_id ? parseInt(firstItem.sku_id) : null,

                // Auto-fill batch/lot if available
                batch_number: normalizeField(firstItem.batch_number) || "",
                lot_number: normalizeField(firstItem.lot_number) || ""
              }
            }
            return art
          })

          console.log('✅ Updated articles with auto-filled data:', updatedArticles)
          console.log('🎯 First article after auto-fill:', updatedArticles[0])
          console.log('⚠️  CASE PRESERVATION CHECK:')
          console.log('   - material_type case:', updatedArticles[0]?.material_type, '(should match dropdown options exactly)')
          console.log('   - item_category case:', updatedArticles[0]?.item_category, '(should match dropdown options exactly)')
          console.log('   - sub_category case:', updatedArticles[0]?.sub_category, '(should match dropdown options exactly)')
          console.log('   - item_description case:', updatedArticles[0]?.item_description, '(should match dropdown options exactly)')
          
          // Debug: Log raw API values for comparison
          console.log('📊 RAW API VALUES from request.lines[0]:')
          console.log('   - material_type (raw):', firstItem.material_type)
          console.log('   - item_category (raw):', firstItem.item_category)
          console.log('   - sub_category (raw):', firstItem.sub_category)
          console.log('   - item_description (raw):', firstItem.item_description)
          
          setArticles(updatedArticles)
          
          // Store all items for display and initialize scanned counters
          setLoadedItems(request.lines.map((it: any) => ({
            ...it,
            scanned_count: 0,
            pending: Math.max(0, (parseInt(it.quantity) || 0) - 0)
          })))
          console.log('✅ All items stored:', request.lines.length, 'items')
          console.log('📋 Items:', request.lines.map(l => ({
            material_type: l.material_type,
            item_description: l.item_description,
            quantity: l.quantity
          })))
        } else {
          console.warn('⚠️ No lines found in request!')
        }

        console.log('✅ Form fully populated with request data')

        // Show success toast with auto-filled fields summary
        const autoFilledFields = request.lines && request.lines.length > 0 ? request.lines[0] : null
        if (autoFilledFields) {
          toast({
            title: "✅ Request Loaded & Auto-Filled",
            description: `Request ${request.request_no} loaded with ${request.lines?.length || 0} items. Article fields auto-filled: ${autoFilledFields.item_description || 'N/A'}`,
          })
        } else {
          toast({
            title: "Request Loaded",
            description: `Request ${request.request_no} loaded with ${request.lines?.length || 0} items`,
          })
        }
      } catch (error: any) {
        console.error('❌ Failed to load request:', error)
        toast({
          title: "Error",
          description: error.message || "Failed to load request details",
          variant: "destructive",
        })
      }
    }

    loadRequestDetails()
  }, [requestIdFromUrl])

  // Fetch SKU ID when article values are auto-filled from request
  useEffect(() => {
    const fetchSkuIdForAutoFilledArticle = async () => {
      // Only fetch if we have all required fields and SKU ID is not already set
      if (articles[0]?.material_type && 
          articles[0]?.item_category && 
          articles[0]?.sub_category && 
          articles[0]?.item_description && 
          !articles[0]?.sku_id &&
          requestIdFromUrl) {
        
        console.log('🔍 Auto-fetching SKU ID for auto-filled article')
        console.log('📋 Article values:', {
          material_type: articles[0].material_type,
          item_category: articles[0].item_category,
          sub_category: articles[0].sub_category,
          item_description: articles[0].item_description
        })
        
        try {
          const skuResponse = await dropdownApi.fetchSkuId({
            company,
            item_description: articles[0].item_description,
            item_category: articles[0].item_category,
            sub_category: articles[0].sub_category,
            material_type: articles[0].material_type
          })

          console.log('📦 SKU Response:', skuResponse)

          // Extract SKU ID from various possible response formats
          const skuId: number | undefined = Number(
            skuResponse?.sku_id ??
            skuResponse?.id ??
            skuResponse?.ID ??
            skuResponse?.SKU_ID
          )
          
          if (skuId && !Number.isNaN(skuId) && skuId > 0) {
            console.log('✅ Found SKU ID:', skuId)
            updateArticle(articles[0].id, "sku_id", skuId)
          } else {
            console.warn('⚠️ No valid SKU ID returned from API')
          }
        } catch (err) {
          console.error("❌ Error fetching SKU ID:", err)
        }
      } else if (articles[0]?.sku_id && requestIdFromUrl) {
        console.log('✅ SKU ID already set from request:', articles[0].sku_id)
      }
    }

    fetchSkuIdForAutoFilledArticle()
  }, [articles[0]?.material_type, articles[0]?.item_category, articles[0]?.sub_category, articles[0]?.item_description, articles[0]?.sku_id, requestIdFromUrl])

  const handleInputChange = (field: string, value: string) => {
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
      item_description: "",
      item_category: "",
      sub_category: "",
      quantity_units: 0,
      packaging_type: 0,
      uom: "",
      net_weight: 0,
      total_weight: 0,
      batch_number: "",
      lot_number: "",
      manufacturing_date: "",
      expiry_date: "",
      import_date: "",
      unit_rate: 0,
      total_amount: 0,
      tax_amount: 0,
      discount_amount: 0,
      currency: "INR",
    }
    setArticles(prev => [...prev, newArticle])
  }

  const removeArticle = (id: string) => {
    if (articles.length > 1) {
      setArticles(prev => prev.filter(article => article.id !== id))
    }
  }

  const updateArticle = (id: string, field: string, value: any) => {
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

        return updatedArticle
      }
      return article
    })

    console.log("Setting articles:", updatedArticles)
    setArticles(updatedArticles)
  }

  const handleTransferInfoChange = (field: string, value: string) => {
    setTransferInfo(prev => ({
      ...prev,
      [field]: value
    }))
  }

  
  // Handle removing a scanned box
  const handleRemoveBox = (boxId: number) => {
    console.log('🗑️ Removing box with ID:', boxId)
    
    // Find the box being removed
    const boxToRemove = scannedBoxes.find(box => box.id === boxId)
    
    if (boxToRemove) {
      console.log('📦 Box to remove:', boxToRemove)
      
      // Update loadedItems: decrement scanned_count and recalculate pending
      setLoadedItems(prevItems => {
        const itemsCopy = prevItems.map(it => ({ ...it }))
        const matchIdx = itemsCopy.findIndex(it => 
          String(it.sku_id) === String(boxToRemove.skuId) || 
          it.item_description === boxToRemove.itemDescription
        )
        
        if (matchIdx !== -1) {
          const matched = itemsCopy[matchIdx]
          const currentScanned = parseInt(matched.scanned_count || '0') || 0
          matched.scanned_count = Math.max(0, currentScanned - 1) // Decrement but don't go below 0
          const qty = parseInt(matched.quantity) || 0
          matched.pending = Math.max(0, qty - matched.scanned_count)
          console.log('✅ Updated item counts:', {
            item: matched.item_description,
            scanned: matched.scanned_count,
            pending: matched.pending
          })
        }
        
        return itemsCopy
      })
    }
    
    // Remove box from scannedBoxes
    setScannedBoxes(prev => prev.filter(box => box.id !== boxId))
    
    toast({
      title: "Box Removed",
      description: boxToRemove ? `Box #${boxToRemove.boxNumber} removed` : "Box removed",
    })
  }

  const handleQRScanSuccess = async (decodedText: string) => {
    // Prevent duplicate processing
    if (isProcessingRef.current) {
      console.log('⏭️ Already processing a scan, skipping...')
      return
    }
    
    isProcessingRef.current = true
    console.log('📱 QR Code Scanned:', decodedText)
    
    // Close the scanner immediately after successful scan
    setShowScanner(false)
    
    try {
      // Try to parse JSON from QR code
      const qrData = JSON.parse(decodedText)
      
      console.log('📱 QR Data Received:', qrData)
      console.log('🔍 Checking item_description fields:', {
        item_description: qrData.item_description,
        id: qrData.id,
        it: qrData.it,
        description: qrData.description,
        article: qrData.article,
        article_name: qrData.article_name,
        item: qrData.item,
        itemDescription: qrData.itemDescription
      })
      
      // Check if this is a BOX QR code (has transaction_no, cn, tx, or bt key)
      const boxId = qrData.transaction_no || qrData.cn || qrData.tx || qrData.bt || null
      const hasBoxData = qrData.transaction_no || qrData.cn || qrData.tx || qrData.batch_number || qrData.bt || qrData.box_number || qrData.bx ||
                        (boxId && (boxId.startsWith('CONS') || boxId.startsWith('TR') || boxId.startsWith('BT-')))

      if (hasBoxData) {
        const transactionNo = qrData.transaction_no || qrData.cn || qrData.tx || 'N/A'
        const skuId = qrData.sku_id || qrData.sk || null
        const boxNumber = qrData.box_number || qrData.bx || null
        
        console.log('🔍 Checking duplicate for:', { transactionNo, skuId, boxNumber })
        console.log('📦 Current scanned boxes:', scannedBoxes.map(b => ({
          transactionNo: b.transactionNo,
          skuId: b.skuId,
          boxNumberInArray: b.boxNumberInArray
        })))
        
        // Check for duplicate: transaction_no + sku_id + box_number
        const isDuplicate = scannedBoxes.some(box => {
          const match = box.transactionNo === transactionNo && 
                       box.skuId === skuId && 
                       box.boxNumberInArray === boxNumber
          console.log(`Comparing with box ${box.boxNumber}:`, { match, box: { 
            transactionNo: box.transactionNo, 
            skuId: box.skuId, 
            boxNumberInArray: box.boxNumberInArray 
          }})
          return match
        })
        
        console.log('🎯 Is duplicate?', isDuplicate)
        
        if (isDuplicate) {
          console.error('❌ DUPLICATE BOX DETECTED!')
          alert('⚠️ Duplicate Box! This box has already been scanned.')
          toast({
            title: "❌ Duplicate Box!",
            description: `This box has already been scanned. Transaction: ${transactionNo}`,
            variant: "destructive",
          })
          // Reset processing flag immediately for duplicates
          isProcessingRef.current = false
          return
        }
        
        // If transaction starts with TX or CONS, fetch data from backend
        let boxData = qrData
        if (transactionNo.startsWith('TX') || transactionNo.startsWith('CONS')) {
          try {
            const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/inward/${company}/${encodeURIComponent(transactionNo)}`
            console.log('🔍 Fetching transaction data from:', apiUrl)
            console.log('🔍 Looking for - Transaction:', transactionNo, 'SKU:', skuId, 'Box:', boxNumber)
            
            const response = await fetch(apiUrl)
            if (!response.ok) {
              throw new Error(`Failed to fetch transaction: ${response.statusText}`)
            }
            
            const fetchedData = await response.json()
            console.log('✅ Fetched transaction data:', fetchedData)
            console.log('📦 Available boxes:', fetchedData.boxes?.length)
            console.log('📄 Available articles:', fetchedData.articles?.length)
            
            // Find the matching box - try multiple matching strategies
            let matchingBox = null
            if (fetchedData.boxes && fetchedData.boxes.length > 0) {
              // Strategy 1: Match by transaction_no and box_number
              matchingBox = fetchedData.boxes.find((box: any) => 
                box.transaction_no === transactionNo && box.box_number === boxNumber
              )
              
              // Strategy 2: If no match, try matching by sku_id and box_number
              if (!matchingBox && skuId) {
                matchingBox = fetchedData.boxes.find((box: any) => 
                  box.sku_id === skuId && box.box_number === boxNumber
                )
              }
              
              // Strategy 3: If still no match, try matching just by box_number (if unique)
              if (!matchingBox) {
                const boxesWithNumber = fetchedData.boxes.filter((box: any) => box.box_number === boxNumber)
                if (boxesWithNumber.length === 1) {
                  matchingBox = boxesWithNumber[0]
                }
              }
              
              console.log('🎯 Matching box found:', matchingBox)
            }

            // Find the matching article
            let matchingArticle = null
            if (fetchedData.articles && fetchedData.articles.length > 0) {
              // Try matching by sku_id first
              if (skuId) {
                matchingArticle = fetchedData.articles.find((article: any) => 
                  String(article.sku_id) === String(skuId)
                )
              }
              
              // If no sku_id or no match, use the first article if only one exists
              if (!matchingArticle && fetchedData.articles.length === 1) {
                matchingArticle = fetchedData.articles[0]
                console.log('ℹ️ Using single article as default')
              }
              
              // If still no match, try matching by item_description from QR
              if (!matchingArticle && qrData.item_description) {
                matchingArticle = fetchedData.articles.find((article: any) => 
                  article.item_description === qrData.item_description
                )
              }
              
              console.log('🎯 Matching article found:', matchingArticle)
            }

            // Merge data from API with QR data
            if (matchingBox || matchingArticle) {
              boxData = {
                ...qrData,
                // Basic identifiers - Enhanced item_description extraction
                item_description: matchingArticle?.item_description || matchingBox?.article_description || matchingBox?.article || matchingBox?.article_name || qrData.item_description || qrData.id || qrData.it || qrData.description || qrData.article || qrData.article_name || qrData.item || qrData.itemDescription,
                sku_id: matchingArticle?.sku_id || matchingBox?.sku_id || qrData.sku_id || qrData.sk || skuId,

                // Category information
                material_type: matchingArticle?.material_type || qrData.material_type || qrData.mt,
                item_category: matchingArticle?.item_category || qrData.item_category || qrData.ic,
                sub_category: matchingArticle?.sub_category || qrData.sub_category || qrData.sc,

                // Weight information
                net_weight: matchingBox?.net_weight || matchingArticle?.net_weight || qrData.net_weight || qrData.nw || qrData.netWeight,
                total_weight: matchingBox?.gross_weight || matchingBox?.total_weight || matchingArticle?.total_weight || qrData.total_weight || qrData.gw || qrData.tw || qrData.wt || qrData.totalWeight || qrData.gross_weight,

                // Batch and lot information
                batch_number: matchingArticle?.batch_number || matchingBox?.batch_number || qrData.batch_number || qrData.bn || qrData.bt,
                lot_number: matchingArticle?.lot_number || matchingBox?.lot_number || qrData.lot_number || qrData.ln || qrData.lot,

                // Date information
                manufacturing_date: matchingArticle?.manufacturing_date || qrData.manufacturing_date || qrData.mfg_date || qrData.md,
                expiry_date: matchingArticle?.expiry_date || qrData.expiry_date || qrData.exp_date || qrData.ed,

                // Packaging and quantity
                packaging_type: matchingArticle?.packaging_type || qrData.packaging_type || qrData.pt,
                quantity_units: matchingArticle?.quantity_units || qrData.quantity_units || qrData.qty || qrData.quantity,
                uom: matchingArticle?.uom || qrData.uom || qrData.unit,

                // Additional article details
                item_code: matchingArticle?.item_code || qrData.item_code || qrData.code,
                hsn_code: matchingArticle?.hsn_code || qrData.hsn_code || qrData.hsn,
                quality_grade: matchingArticle?.quality_grade || qrData.quality_grade || qrData.grade
              }
              console.log('✅ Merged box data with all available fields:', boxData)
            } else {
              console.log('⚠️ No matching box or article found, using QR data only')
            }
          } catch (fetchError) {
            console.error('❌ Failed to fetch transaction data:', fetchError)
            // Continue with QR data even if API call fails
          }
        }

        const uniqueId = boxIdCounterRef.current
        boxIdCounterRef.current += 1 // Increment for next box

        const newBox = {
          id: uniqueId, // Unique ID for React key
          boxNumber: uniqueId, // Display number (also unique)
          boxId: boxId || boxData.batch_number || boxData.bn || boxData.bt || 'N/A',

          // Basic identification - Enhanced item_description with multiple fallbacks
          itemDescription: boxData.item_description || boxData.id || boxData.it || boxData.description || boxData.article || boxData.article_name || boxData.item || boxData.itemDescription || 'N/A',
          skuId: boxData.sku_id || boxData.sk || skuId,
          transactionNo: transactionNo,
          boxNumberInArray: boxNumber,

          // Category information
          materialType: boxData.material_type || boxData.mt || 'N/A',
          itemCategory: boxData.item_category || boxData.ic || 'N/A',
          subCategory: boxData.sub_category || boxData.sc || 'N/A',

          // Weight information - Convert GM to KG for FINISHED GOODS
          netWeight: (() => {
            const materialType = boxData.material_type || boxData.mt || ''
            const netWeightGm = parseFloat(boxData.net_weight || boxData.nw || boxData.netWeight || '0')
            
            // Convert to KG if FINISHED GOODS
            if (materialType.toUpperCase().includes('FINISH')) {
              const netWeightKg = (netWeightGm / 1000).toFixed(3)
              console.log(`🔄 Weight Conversion (Net): ${netWeightGm} GM → ${netWeightKg} KG`)
              return String(netWeightKg)
            }
            return String(netWeightGm)
          })(),
          totalWeight: (() => {
            const materialType = boxData.material_type || boxData.mt || ''
            const totalWeightGm = parseFloat(boxData.total_weight || boxData.gw || boxData.tw || boxData.wt || boxData.totalWeight || boxData.gross_weight || '0')
            
            // Convert to KG if FINISHED GOODS
            if (materialType.toUpperCase().includes('FINISH')) {
              const totalWeightKg = (totalWeightGm / 1000).toFixed(3)
              console.log(`🔄 Weight Conversion (Total): ${totalWeightGm} GM → ${totalWeightKg} KG`)
              return String(totalWeightKg)
            }
            return String(totalWeightGm)
          })(),

          // Batch and lot information
          batchNumber: boxData.batch_number || boxData.bn || boxData.bt || 'N/A',
          lotNumber: boxData.lot_number || boxData.ln || boxData.lot || 'N/A',

          // Date information
          manufacturingDate: boxData.manufacturing_date || boxData.mfg_date || boxData.md || 'N/A',
          expiryDate: boxData.expiry_date || boxData.exp_date || boxData.ed || 'N/A',

          // Packaging and quantity
          packagingType: boxData.packaging_type || boxData.pt || 'N/A',
          quantityUnits: boxData.quantity_units || boxData.qty || boxData.quantity || 'N/A',
          uom: boxData.uom || boxData.unit || 'N/A',

          // Additional details
          itemCode: boxData.item_code || boxData.code || 'N/A',
          hsnCode: boxData.hsn_code || boxData.hsn || 'N/A',
          qualityGrade: boxData.quality_grade || boxData.grade || 'N/A',

          // Metadata
          scannedAt: new Date().toLocaleTimeString(),
          rawData: boxData
        }

        console.log('📦 Created box object with all fields:')
        console.log('  - Item Description:', newBox.itemDescription)
        console.log('  - SKU ID:', newBox.skuId)
        console.log('  - Material Type:', newBox.materialType)
        console.log('  - Category:', newBox.itemCategory)
        console.log('  - Sub-Category:', newBox.subCategory)
        console.log('  - Net Weight:', newBox.netWeight, newBox.materialType.toUpperCase().includes('FINISH') ? 'KG' : 'GM')
        console.log('  - Total Weight:', newBox.totalWeight, newBox.materialType.toUpperCase().includes('FINISH') ? 'KG' : 'GM')
        console.log('  - Batch Number:', newBox.batchNumber)
        console.log('  - Lot Number:', newBox.lotNumber)
        console.log('  - Manufacturing Date:', newBox.manufacturingDate)
        console.log('  - Expiry Date:', newBox.expiryDate)
        console.log('  - Transaction No:', newBox.transactionNo)
        console.log('  - Box Number:', newBox.boxNumberInArray)
        
        setScannedBoxes(prev => {
          const updatedBoxes = [...prev, newBox]
          
          // Check if all request qty boxes are scanned (using quantity as request qty boxes)
          const requestQtyBoxes = articles[0]?.quantity_units || 0
          const scannedCount = updatedBoxes.length
          const pendingCount = requestQtyBoxes - scannedCount
          
          if (requestQtyBoxes > 0) {
            if (pendingCount === 0) {
              toast({
                title: "✅ All Boxes Scanned!",
                description: `All ${requestQtyBoxes} boxes have been scanned successfully`,
              })
            } else if (pendingCount > 0) {
              toast({
                title: "Box Scanned!",
                description: `${newBox.itemDescription} | ${pendingCount} boxes pending`,
              })
            } else {
              // More boxes scanned than request qty
              toast({
                title: "⚠️ Extra Box Scanned!",
                description: `Request Qty ${requestQtyBoxes} boxes, but ${scannedCount} scanned`,
                variant: "destructive",
              })
            }
          } else {
            toast({
              title: "Box Scanned!",
              description: `Box #${newBox.boxNumber} - ${newBox.itemDescription}`,
            })
          }
          
          // Update loadedItems scanned_count and pending for the matching item
          try {
            setLoadedItems(prevItems => {
              const itemsCopy = prevItems.map(it => ({ ...it }))
              const matchIdx = itemsCopy.findIndex(it => String(it.sku_id) === String(newBox.skuId) || it.item_description === newBox.itemDescription)
              if (matchIdx !== -1) {
                const matched = itemsCopy[matchIdx]
                const currentScanned = parseInt(matched.scanned_count || '0') || 0
                matched.scanned_count = currentScanned + 1
                const qty = parseInt(matched.quantity) || 0
                matched.pending = Math.max(0, qty - matched.scanned_count)
              }
              return itemsCopy
            })
          } catch (e) {
            console.error('Failed to update loadedItems counts:', e)
          }

          return updatedBoxes
        })
        
        console.log('📦 Box added to list:', newBox)
      } else {
        // Regular request QR code - auto-fill form fields
        if (qrData.request_no) {
          setRequestNo(qrData.request_no)
        }
        if (qrData.from_warehouse) {
          setFormData(prev => ({ ...prev, fromWarehouse: qrData.from_warehouse }))
        }
        if (qrData.to_warehouse) {
          setFormData(prev => ({ ...prev, toWarehouse: qrData.to_warehouse }))
        }
        if (qrData.item_description) {
          setArticles(prev => prev.map((art, index) => index === 0 ? { ...art, item_description: qrData.item_description } : art))
        }
        if (qrData.quantity) {
          setArticles(prev => prev.map((art, index) => index === 0 ? { ...art, quantity_units: parseInt(qrData.quantity) || 0 } : art))
        }
        
        toast({
          title: "QR Code Scanned!",
          description: "Form fields updated from QR code data",
        })
      }
    } catch (error) {
      // If not JSON, treat as plain text (maybe a box ID)
      console.log('QR data is not JSON, treating as text:', decodedText)
      
      // Check if it looks like a box ID (starts with CONS or TR)
      if (decodedText.startsWith('CONS') || decodedText.startsWith('TR')) {
        const uniqueId = boxIdCounterRef.current
        boxIdCounterRef.current += 1 // Increment for next box
        
        const newBox = {
          id: uniqueId, // Unique ID for React key
          boxNumber: uniqueId, // Display number (also unique)
          boxId: decodedText,
          itemDescription: 'N/A',
          netWeight: '0',
          totalWeight: '0',
          batchNumber: 'N/A',
          transactionNo: 'N/A',
          scannedAt: new Date().toLocaleTimeString(),
          rawData: decodedText
        }
        
        setScannedBoxes(prev => [...prev, newBox])
        
        toast({
          title: "Box ID Scanned",
          description: `Box #${newBox.boxNumber} - ${decodedText} added`,
        })
      } else {
        toast({
          title: "QR Code Scanned",
          description: `Data: ${decodedText}`,
        })
      }
    } finally {
      // Reset processing flag after a short delay to prevent rapid duplicate scans
      setTimeout(() => {
        isProcessingRef.current = false
      }, 500)
    }
  }

  const handleQRScanError = (error: string) => {
    console.error('QR Scan Error:', error)
    toast({
      title: "Scanner Error",
      description: error,
      variant: "destructive",
    })
  }

  // Helper to convert DD-MM-YYYY to YYYY-MM-DD for backend
  const toISODate = (value: string): string => {
    const ddmmyyyy = /^(\d{2})-(\d{2})-(\d{4})$/
    const match = value.match(ddmmyyyy)
    if (match) {
      const [, dd, mm, yyyy] = match
      return `${yyyy}-${mm}-${dd}`
    }
    return value
  }
  
  // Function to print DC
  const handlePrintDC = () => {
    window.print()
  }
  
  // Function to download DC as PDF (opens print dialog with PDF option)
  const handleDownloadDC = () => {
    window.print() // User can save as PDF from print dialog
    toast({
      title: "Download DC",
      description: "Use 'Save as PDF' option in the print dialog",
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log('🚀 ========== TRANSFER FORM SUBMISSION STARTED ==========')
    console.log('📋 Transfer Number:', transferNo)
    console.log('📋 Request Number:', requestNo)
    
    // Validation - collect all errors
    console.log('✅ Step 1: Validating form data...')
    const errors: string[] = []

    // Request Header Validation
    if (!requestNo) {
      errors.push('Request number is required')
    }

    if (!formData.fromWarehouse) {
      errors.push('From warehouse is required')
    }
    
    if (!formData.toWarehouse) {
      errors.push('To warehouse is required')
    }
    
    if (formData.fromWarehouse && formData.toWarehouse && formData.fromWarehouse === formData.toWarehouse) {
      errors.push('From warehouse and To warehouse must be different')
    }
    
    if (!formData.reason || formData.reason.trim() === '') {
      errors.push('Reason is required')
    }
    
    if (!formData.reasonDescription || formData.reasonDescription.trim() === '') {
      errors.push('Reason description is required')
    }

    // Article Data Validation
    if (articles.length === 0) {
      errors.push('At least one article is required')
    }
    
    articles.forEach((article, index) => {
      if (!article.material_type) {
        errors.push(`Article ${index + 1}: Material type is required`)
      }
      
      if (!article.item_category) {
        errors.push(`Article ${index + 1}: Item category is required`)
      }
      
      if (!article.sub_category) {
        errors.push(`Article ${index + 1}: Sub category is required`)
      }
      
      if (!article.item_description) {
        errors.push(`Article ${index + 1}: Item description is required`)
      }
      
      if (!article.quantity_units || article.quantity_units === 0) {
        errors.push(`Article ${index + 1}: Quantity must be greater than 0`)
      }
      
      if (!article.uom) {
        errors.push(`Article ${index + 1}: UOM is required`)
      }
    })

    // Transfer Info Validation
    if (!transferInfo.vehicleNumber) {
      errors.push('Vehicle number is required')
    }
    
    if (transferInfo.vehicleNumber === 'other' && !transferInfo.vehicleNumberOther) {
      errors.push('Please enter vehicle number (Other)')
    }

    if (!transferInfo.driverName) {
      errors.push('Driver name is required')
    }
    
    if (transferInfo.driverName === 'other' && !transferInfo.driverNameOther) {
      errors.push('Please enter driver name (Other)')
    }
    
    if (!transferInfo.approvalAuthorityOther || transferInfo.approvalAuthorityOther.trim() === '') {
      errors.push('Approval authority is required')
    }

    // Scanned Boxes Validation - COMMENTED OUT FOR NOW
    // if (scannedBoxes.length === 0) {
    //   errors.push('Please scan at least one box before submitting')
    // }

    // Ensure every scanned box has skuId - COMMENTED OUT FOR NOW
    // const boxesMissingSku = scannedBoxes.filter(b => !b.skuId)
    // if (boxesMissingSku.length > 0) {
    //   errors.push('One or more scanned boxes are missing SKU. Please rescan boxes with SKU information or select the correct item first.')
    // }

    // If there are validation errors, display them and stop
    if (errors.length > 0) {
      console.error('❌ Validation Failed:', errors)
      setValidationErrors(errors)
      toast({
        title: "Validation Error",
        description: "Please fill all required fields",
        variant: "destructive",
      })
      // Scroll to errors
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
      return
    }
    
    // Clear errors if validation passes
    setValidationErrors([])
    console.log('✅ Step 1: Validation passed!')
    
    // Prepare payload
    console.log('📦 Step 2: Preparing payload...')
    
    // Get driver name and approval authority
    const driverName = transferInfo.driverName === "other" ? transferInfo.driverNameOther : transferInfo.driverName
    const approvalAuthority = transferInfo.approvalAuthorityOther
    
    console.log('🔍 Transfer Info Debug:')
    console.log('  - transferInfo.driverName:', transferInfo.driverName)
    console.log('  - transferInfo.driverNameOther:', transferInfo.driverNameOther)
    console.log('  - transferInfo.approvalAuthorityOther:', transferInfo.approvalAuthorityOther)
    console.log('  - Final driverName:', driverName)
    console.log('  - Final approvalAuthority:', approvalAuthority)
    
    const payload = {
      header: {
        challan_no: transferNo,
        stock_trf_date: toISODate(formData.requestDate),
        from_warehouse: formData.fromWarehouse,
        to_warehouse: formData.toWarehouse,
        vehicle_no: transferInfo.vehicleNumber === "other" ? transferInfo.vehicleNumberOther : transferInfo.vehicleNumber,
        driver_name: driverName || null,
        approved_by: approvalAuthority && approvalAuthority.trim() !== "" ? approvalAuthority : null,
        remark: formData.reasonDescription || formData.reason,
        reason_code: formData.reason
      },
      lines: articles.map((article, index) => ({
        material_type: article.material_type,
        item_category: article.item_category,
        sub_category: article.sub_category,
        item_description: article.item_description,
        quantity: String(article.quantity_units),
        uom: article.uom,
        pack_size: String(article.packaging_type),
        package_size: article.material_type === "FG" ? "0" : null,
        batch_number: null,
        lot_number: null
      })),
      boxes: scannedBoxes.map((box) => ({
        box_number: box.boxNumber,
        article: box.itemDescription || "Unknown Article",
        lot_number: box.lotNumber || "",
        batch_number: box.batchNumber || "",
        transaction_no: box.transactionNo || "",
        net_weight: parseFloat(box.netWeight) || 0,
        gross_weight: parseFloat(box.totalWeight) || 0
      })),
      request_id: requestIdFromUrl ? parseInt(requestIdFromUrl) : null
    }

    console.log('📦 Payload prepared:')
    console.log('  - Challan No:', payload.header.challan_no)
    console.log('  - Transfer Date:', payload.header.stock_trf_date)
    console.log('  - From:', payload.header.from_warehouse, '→ To:', payload.header.to_warehouse)
    console.log('  - Lines Count:', payload.lines.length)
    console.log('  - Boxes Count:', payload.boxes.length)
    console.log('  - Vehicle:', payload.header.vehicle_no)
    console.log('  - Driver Name:', payload.header.driver_name)
    console.log('  - Approved By:', payload.header.approved_by)
    console.log('  - Reason:', payload.header.reason_code)
    console.log('  - Request ID:', payload.request_id)
    console.log('📄 Full Payload:', JSON.stringify(payload, null, 2))
    
    // Debug: Log scanned boxes details
    if (payload.boxes.length > 0) {
      console.log('📦 ========== SCANNED BOXES DETAILS ==========')
      payload.boxes.forEach((box, index) => {
        console.log(`Box ${index + 1}:`)
        console.log(`  - Box Number: ${box.box_number}`)
        console.log(`  - Article: ${box.article}`)
        console.log(`  - Transaction No: ${box.transaction_no}`)
        console.log(`  - Batch Number: ${box.batch_number}`)
        console.log(`  - Lot Number: ${box.lot_number}`)
        console.log(`  - Net Weight: ${box.net_weight} gm`)
        console.log(`  - Gross Weight: ${box.gross_weight} gm`)
      })
      console.log('='.repeat(50))
    } else {
      console.log('⚠️ No boxes scanned for this transfer')
    }
    
    // Debug: Log the actual article values being sent
    console.log('🔍 DEBUG: Article values being sent:')
    payload.lines.forEach((line, index) => {
      console.log(`  Line ${index + 1}:`)
      console.log(`    - material_type: "${line.material_type}"`)
      console.log(`    - item_category: "${line.item_category}"`)
      console.log(`    - sub_category: "${line.sub_category}"`)
      console.log(`    - item_description: "${line.item_description}"`)
      console.log(`    - uom: "${line.uom}"`)
    })

    try {
      console.log('🌐 Step 3: Sending request to API...')
      console.log('API Endpoint: POST /api/transfer/' + company)
      
      const response = await InterunitApiService.submitTransfer(company, payload)
      
      console.log('✅ Step 3: API Response received!')
      console.log('Response:', response)
      
      toast({
        title: "Transfer Submitted Successfully",
        description: `Transfer ${payload.header.challan_no} has been created successfully`,
      })
      
      console.log('🎉 ========== TRANSFER FORM SUBMISSION COMPLETED ==========')
      console.log('Transfer Status: Created')
      console.log('Lines Submitted:', payload.lines.length)
      
      // Redirect back to transfer list
      setTimeout(() => {
        console.log('🔄 Redirecting to transfer list...')
        router.push(`/${company}/transfer`)
      }, 1500)
      
    } catch (error: any) {
      console.error('❌ ========== TRANSFER FORM SUBMISSION FAILED ==========')
      console.error('Error Details:', error)
      console.error('Error Message:', error.message)
      console.error('Error Response:', error.response?.data)
      
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit transfer. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Helper function to get driver phone number
  const getDriverPhone = (driverName: string): string => {
    const driverPhones: { [key: string]: string } = {
      "Tukaram": "+919930056340",
      "Sayaji": "+919819944031",
      "Prashant": "+919619606340",
      "Shantilal": "+919819048534"
    }
    return driverPhones[driverName] || ""
  }
  return (
    <form onSubmit={handleSubmit}>
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.push(`/${company}/transfer`)}
          className="h-9 w-9 p-0 bg-white border-gray-200 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Send className="h-5 w-5 sm:h-6 sm:w-6 text-violet-600" />
            Transfer OUT
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Transfer No: <span className="font-medium">{transferNo}</span></p>
        </div>
      </div>
      {/* Form Card */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
          <CardTitle className="text-sm sm:text-base font-semibold text-gray-800">Request Header</CardTitle>
          <p className="text-xs text-muted-foreground">
            Warehouse A requests stock from Warehouse B
          </p>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <div className="space-y-4">
            {/* Request No - Read Only (Original REQ number) */}
            <div className="space-y-1">
              <Label htmlFor="requestNo" className="text-xs font-medium text-gray-600">
                Request No
              </Label>
              <Input
                id="requestNo"
                type="text"
                value={requestNo}
                readOnly
                className="h-9 bg-gray-50 border-gray-200 text-gray-500 font-semibold cursor-not-allowed"
              />
            </div>
            {/* Request Date */}
            <div className="space-y-1">
              <Label htmlFor="requestDate" className="text-xs font-medium text-gray-600">Request Date *
              </Label>
              <Input
                id="requestDate"
                type="text"
                value={formData.requestDate}
                onChange={(e) => handleInputChange('requestDate', e.target.value)}
                className="h-9 bg-white border-gray-200"
                placeholder="15-10-2025"
              />
            </div>
            {/* From Warehouse */}
            <div className="space-y-1">
              <Label htmlFor="fromWarehouse" className="text-xs font-medium text-gray-600">
                From (Requesting Warehouse) *
              </Label>
              <Select 
                value={formData.fromWarehouse} 
                onValueChange={(value) => handleInputChange('fromWarehouse', value)}
                >
                <SelectTrigger className="h-9 bg-white border-gray-200">
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="W202">W202</SelectItem>
                  <SelectItem value="A185">A185</SelectItem>
                  <SelectItem value="A101">A101</SelectItem>
                  <SelectItem value="A68">A68</SelectItem>
                  <SelectItem value="F53">F53</SelectItem>
                  <SelectItem value="Savla">Savla</SelectItem>
                  <SelectItem value="Rishi">Rishi</SelectItem>

                </SelectContent>

              </Select>

            </div>



            {/* To Warehouse */}

            <div className="space-y-1">

              <Label htmlFor="toWarehouse" className="text-xs font-medium text-gray-600">

                To (Supplying Warehouse) *

              </Label>

              <Select 

                value={formData.toWarehouse} 

                onValueChange={(value) => handleInputChange('toWarehouse', value)}

              >

                <SelectTrigger className="h-9 bg-white border-gray-200">

                  <SelectValue placeholder="Select site" />

                </SelectTrigger>

                <SelectContent>

                  <SelectItem value="W202">W202</SelectItem>

                  <SelectItem value="A185">A185</SelectItem>

                  <SelectItem value="A101">A101</SelectItem>

                  <SelectItem value="A68">A68</SelectItem>

                  <SelectItem value="F53">F53</SelectItem>

                  <SelectItem value="Savla">Savla</SelectItem>

                  <SelectItem value="Rishi">Rishi</SelectItem>

                </SelectContent>

              </Select>

            </div>

            {/* Reason (Code) */}
            <div className="space-y-1">
              <Label htmlFor="reason" className="text-xs font-medium text-gray-600">
                Reason *
              </Label>
              <Select 
                value={formData.reason} 
                onValueChange={(value) => handleInputChange('reason', value)}
              >
                <SelectTrigger className="h-9 bg-white border-gray-200">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Stock Requirement">Stock Requirement</SelectItem>
                  <SelectItem value="Material Movement">Material Movement</SelectItem>
                  <SelectItem value="Production Need">Production Need</SelectItem>
                  <SelectItem value="Customer Order">Customer Order</SelectItem>
                  <SelectItem value="Inventory Balancing">Inventory Balancing</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reason Description */}

            <div className="space-y-1">

              <Label htmlFor="reasonDescription" className="text-xs font-medium text-gray-600">

                Reason Description *

              </Label>

              <Textarea

                id="reasonDescription"

                value={formData.reasonDescription}

                onChange={(e) => handleInputChange('reasonDescription', e.target.value)}

                className="w-full min-h-[60px] bg-white border-gray-300 text-gray-700"

                placeholder="Enter short description about Reason..."

              />

            </div>
          </div>

        </CardContent>

      </Card>

      {/* QR Scanner Section */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <CardTitle className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Scan QR Code
          </CardTitle>
          <p className="text-xs text-white/80">
            Scan boxes with high-performance camera scanner
          </p>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          {!showScanner ? (
            <div className="py-6 text-center">
              <Button
                type="button"
                onClick={() => setShowScanner(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-6"
              >
                📷 Start Camera Scan
              </Button>
              <p className="text-xs text-gray-500 mt-3">
                ⚡ Uses native API for instant detection
              </p>
            </div>
          ) : (
            <div className="py-4">
              <div className="max-h-[60vh] rounded-lg overflow-hidden">
                <HighPerformanceQRScanner 
                  onScanSuccess={handleQRScanSuccess}
                  onScanError={handleQRScanError}
                  onClose={() => setShowScanner(false)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer Information Section */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-violet-50 to-purple-50 border-b">
          <CardTitle className="text-sm sm:text-base font-semibold text-gray-800">Transfer Information</CardTitle>
          <p className="text-xs text-muted-foreground">
            Select vehicle, driver, and approval details for the transfer
          </p>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Vehicle Number */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">
                Vehicle Number *
              </Label>
              <Select 
                value={transferInfo.vehicleNumber} 
                onValueChange={(value) => handleTransferInfoChange('vehicleNumber', value)}
              >
                <SelectTrigger className="h-9 bg-white border-gray-200">
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MH43BP6885">MH43BP6885</SelectItem>
                  <SelectItem value="MH43BX1881">MH43BX1881</SelectItem>
                  <SelectItem value="MH46BM5987">MH46BM5987 (Contract Vehicle)</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {transferInfo.vehicleNumber === 'other' && (
                <Input
                  type="text"
                  value={transferInfo.vehicleNumberOther}
                  onChange={(e) => handleTransferInfoChange('vehicleNumberOther', e.target.value)}
                  className="h-9 bg-white border-gray-200 mt-2"
                  placeholder="Enter vehicle number"
                />
              )}
            </div>

            {/* Driver Name */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">
                Driver Name *
              </Label>
              <Select 
                value={transferInfo.driverName} 
                onValueChange={(value) => handleTransferInfoChange('driverName', value)}
              >
                <SelectTrigger className="h-9 bg-white border-gray-200">
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tukaram (+919930056340)">Tukaram (+919930056340)</SelectItem>
                  <SelectItem value="Sachin (8692885298)">Sachin (8692885298)</SelectItem>
                  <SelectItem value="Gopal (+919975887148)">Gopal (+919975887148)</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {transferInfo.driverName === 'other' && (
                <Input
                  type="text"
                  value={transferInfo.driverNameOther}
                  onChange={(e) => handleTransferInfoChange('driverNameOther', e.target.value)}
                  className="h-9 bg-white border-gray-200 mt-2"
                  placeholder="Enter driver name"
                />
              )}
            </div>

            {/* Approval Authority */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">
                Approval Authority *
              </Label>
              <Input
                type="text"
                value={transferInfo.approvalAuthorityOther}
                onChange={(e) => handleTransferInfoChange('approvalAuthorityOther', e.target.value)}
                className="h-9 bg-white border-gray-200"
                placeholder="Enter approval authority name"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Article Management Section */}
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-violet-100 flex items-center justify-center">
              <Plus className="h-3.5 w-3.5 text-violet-600" />
            </div>
            Article Management
          </h2>
          <Button type="button" onClick={addArticle} className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white h-9 px-4 text-xs sm:text-sm">
            <Plus className="mr-2 h-3.5 w-3.5" />
            Add Article
          </Button>
        </div>

        {/* Articles */}
        <div className="space-y-6">
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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Material Type */}
                <div className="space-y-1">
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
                  />
                  {requestIdFromUrl && index === 0 && (
                    <p className="text-xs text-gray-500 mt-1">🔒 Loaded from request</p>
                  )}
                </div>

                {/* Item Category */}
                <div className="space-y-1">
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
                    disabled={!article.material_type || !!(requestIdFromUrl && index === 0)}
                  />
                  {requestIdFromUrl && index === 0 && (
                    <p className="text-xs text-gray-500 mt-1">🔒 Loaded from request</p>
                  )}
                </div>

                {/* Sub Category */}
                <div className="space-y-1">
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
                    disabled={!article.material_type || !article.item_category || !!(requestIdFromUrl && index === 0)}
                    materialType={article.material_type}
                  />
                  {requestIdFromUrl && index === 0 && (
                    <p className="text-xs text-gray-500 mt-1">🔒 Loaded from request</p>
                  )}
                </div>

                {/* Item Description */}
                <div className="space-y-1">
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
                    updateArticle={updateArticle}
                    disabled={!article.material_type || !article.item_category || !article.sub_category || !!(requestIdFromUrl && index === 0)}
                  />
                  {requestIdFromUrl && index === 0 && (
                    <p className="text-xs text-gray-500 mt-1">🔒 Loaded from request</p>
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
                    placeholder="Enter quantity"
                  />
                </div>

                {/* UOM */}
                <div>
                  <Label htmlFor={`uom_${article.id}`}>UOM *</Label>
                  <Select 
                    value={article.uom} 
                    onValueChange={(value) => updateArticle(article.id, "uom", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select UOM" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KG">KG</SelectItem>
                      <SelectItem value="PCS">PCS</SelectItem>
                      <SelectItem value="BOX">BOX</SelectItem>
                      <SelectItem value="CARTON">CARTON</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Pack units */}
                <div>
                  <Label htmlFor={`packaging_type_${article.id}`}>Pack units</Label>
                  <Input
                    id={`packaging_type_${article.id}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={article.packaging_type}
                    onChange={(e) => updateArticle(article.id, "packaging_type", parseFloat(e.target.value) || 0)}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="Enter pack units"
                  />
                </div>

                {/* Net Weight */}
                <div>
                  <Label htmlFor={`net_weight_${article.id}`}>Net Weight</Label>
                  <Input
                    id={`net_weight_${article.id}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={article.net_weight}
                    onChange={(e) => updateArticle(article.id, "net_weight", parseFloat(e.target.value) || 0)}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="Enter net weight"
                  />
                </div>
              </div>
            </div>
          )
          })}
        </div>

        {/* Display All Items from Request */}
        {loadedItems.length > 0 && (
          <Card className="w-full bg-blue-50 border-blue-200">
            <CardHeader className="pb-3 bg-blue-100">
              <CardTitle className="text-base font-semibold text-blue-800 flex items-center">
                📦 Items from Request ({loadedItems.length})
              </CardTitle>
              <p className="text-xs text-blue-600">
                Complete details: Category → Sub-Category → Item Description for all items
              </p>
            </CardHeader>
            <CardContent className="pt-0 bg-blue-50">
              <div className="space-y-2">
                {loadedItems.map((item, index) => (
                  <div 
                    key={item.id || index} 
                    className="bg-white p-3 rounded border border-blue-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-1">
                        {/* Item Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                              Item #{index + 1}
                            </span>
                            <span className="text-xs font-semibold text-white bg-gray-600 px-3 py-1 rounded-full">
                              {item.material_type || "N/A"}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            Qty: <span className="font-bold text-gray-700">{item.quantity} {item.uom}</span>
                          </div>
                        </div>
                        
                        {/* Product Classification - More Prominent */}
                        <div className="space-y-2">
                          {/* Item Description - Main Product Name */}
                          <div className="bg-gray-50 p-2 rounded border">
                            <div className="text-xs text-gray-500 font-medium mb-1">ITEM DESCRIPTION</div>
                            <div className="text-sm font-bold text-gray-800">
                              {item.item_description || "No description available"}
                            </div>
                          </div>
                          
                          {/* Category & Sub-Category - Side by Side */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-blue-50 p-2 rounded border border-blue-200">
                              <div className="text-xs text-blue-600 font-medium mb-1">CATEGORY</div>
                              <div className="text-sm font-semibold text-blue-800">
                                {item.item_category || "Not specified"}
                              </div>
                            </div>
                            <div className="bg-green-50 p-2 rounded border border-green-200">
                              <div className="text-xs text-green-600 font-medium mb-1">SUB-CATEGORY</div>
                              <div className="text-sm font-semibold text-green-800">
                                {item.sub_category || "Not specified"}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Item Details Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mt-3 pt-2 border-t border-gray-200">
                          <div>
                            <span className="text-gray-500">SKU ID:</span>
                            <span className="ml-1 text-gray-700 font-medium">{item.sku_id || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Quantity:</span>
                            <span className="ml-1 text-gray-700 font-medium">{item.quantity} {item.uom}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Scanned:</span>
                            <span className="ml-1 text-gray-700 font-medium">{item.scanned_count || 0}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Pending:</span>
                            <span className="ml-1 text-gray-700 font-medium">{item.pending ?? Math.max(0, (parseInt(item.quantity)||0) - (item.scanned_count||0))}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Pack units:</span>
                            <span className="ml-1 text-gray-700 font-medium">{item.pack_size}</span>
                          </div>
                          {item.package_size && (
                            <div>
                              <span className="text-gray-500">Package Size:</span>
                              <span className="ml-1 text-gray-700 font-medium">{item.package_size}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-500">Net Weight:</span>
                            <span className="ml-1 text-gray-700 font-medium">{item.net_weight}</span>
                          </div>
                          {item.batch_number && (
                            <div>
                              <span className="text-gray-500">Batch:</span>
                              <span className="ml-1 text-gray-700 font-medium">{item.batch_number}</span>
                            </div>
                          )}
                          {item.lot_number && (
                            <div>
                              <span className="text-gray-500">Lot:</span>
                              <span className="ml-1 text-gray-700 font-medium">{item.lot_number}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {loadedItems.length > 1 && (
                <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-700 text-center">
                  ℹ️ First item has been loaded into the editable form above. All {loadedItems.length} items will be included in the transfer.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Scanned Boxes Section */}
        <Card className="w-full bg-white border-gray-200">
          <CardHeader className="pb-3 bg-gray-50 px-3 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <CardTitle className="text-sm sm:text-base font-semibold text-gray-800 flex items-center">
                    <Package className="h-4 w-4 mr-2" />
                    Scanned Boxes ({scannedBoxes.length})
                  </CardTitle>
                  {(articles[0]?.quantity_units || 0) > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                      <div className="hidden sm:block h-5 w-px bg-gray-300"></div>
                      <span className="text-gray-600">Qty:</span>
                      <span className="font-semibold text-gray-800">{articles[0]?.quantity_units}</span>
                      <span className="text-gray-400">|</span>
                      <span className="text-gray-600">Pending:</span>
                      <span className={`font-bold ${
                        (articles[0]?.quantity_units || 0) - scannedBoxes.length > 0 
                          ? 'text-orange-600' 
                          : 'text-green-600'
                      }`}>
                        {(articles[0]?.quantity_units || 0) - scannedBoxes.length}
                      </span>
                      {articles[0]?.item_description && (
                        <>
                          <span className="hidden sm:inline text-gray-400">•</span>
                          <span className="text-gray-700 font-medium truncate max-w-[200px] sm:max-w-[300px]" title={articles[0]?.item_description}>
                            {articles[0]?.item_description}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Boxes scanned via QR code scanner
                </p>
              </div>
              {scannedBoxes.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setScannedBoxes([])}
                  className="h-7 px-3 text-xs w-full sm:w-auto"
                >
                  Clear All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 bg-white px-3 sm:px-6">
            {scannedBoxes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Package className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-700">No boxes scanned yet</p>
                <p className="text-xs text-gray-500 mt-1">
                  Use the QR scanner to scan box labels
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {scannedBoxes.map((box) => (
                    <div key={box.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                            Box #{box.boxNumber}
                          </span>
                          <span className="text-xs font-medium text-gray-600 bg-gray-200 px-2 py-1 rounded">
                            {box.materialType !== 'N/A' ? box.materialType : '-'}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveBox(box.id)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <div className="space-y-1.5 text-xs">
                        <div>
                          <span className="text-gray-500">Item:</span>
                          <span className="ml-2 text-gray-800 font-medium">{box.itemDescription}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Category:</span>
                          <span className="ml-2 text-gray-700">{box.itemCategory !== 'N/A' ? box.itemCategory : '-'}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div>
                            <span className="text-gray-500">Net Wt:</span>
                            <span className="ml-1 text-gray-800 font-medium">
                              {box.netWeight} {box.materialType.toUpperCase().includes('FINISH') ? 'kg' : 'g'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Total Wt:</span>
                            <span className="ml-1 text-gray-800 font-medium">
                              {box.totalWeight} {box.materialType.toUpperCase().includes('FINISH') ? 'kg' : 'g'}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-gray-500">Batch:</span>
                            <span className="ml-1 text-gray-700 font-mono">{box.batchNumber !== 'N/A' ? box.batchNumber : '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Lot:</span>
                            <span className="ml-1 text-gray-700 font-mono">{box.lotNumber !== 'N/A' ? box.lotNumber : '-'}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Transaction:</span>
                          <span className="ml-1 text-gray-800 font-mono font-medium">{box.transactionNo || 'N/A'}</span>
                        </div>
                        <div className="text-gray-400 text-[10px] pt-1">{box.scannedAt}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-2 px-2 text-xs font-medium text-gray-700">Box No</th>
                        <th className="text-left py-2 px-2 text-xs font-medium text-gray-700">Item Description</th>
                        <th className="text-left py-2 px-2 text-xs font-medium text-gray-700">Material Type</th>
                        <th className="text-left py-2 px-2 text-xs font-medium text-gray-700">Category</th>
                        <th className="text-left py-2 px-2 text-xs font-medium text-gray-700">Net Wt</th>
                        <th className="text-left py-2 px-2 text-xs font-medium text-gray-700">Total Wt</th>
                        <th className="text-left py-2 px-2 text-xs font-medium text-gray-700">Batch No</th>
                        <th className="text-left py-2 px-2 text-xs font-medium text-gray-700">Lot No</th>
                        <th className="text-left py-2 px-2 text-xs font-medium text-gray-700">Mfg Date</th>
                        <th className="text-left py-2 px-2 text-xs font-medium text-gray-700">Exp Date</th>
                        <th className="text-left py-2 px-2 text-xs font-medium text-gray-700">Transaction No</th>
                        <th className="text-left py-2 px-2 text-xs font-medium text-gray-700">Time</th>
                        <th className="text-center py-2 px-2 text-xs font-medium text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scannedBoxes.map((box) => (
                        <tr key={box.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-2 text-xs text-gray-800 font-medium">
                            #{box.boxNumber}
                          </td>
                          <td className="py-2 px-2 text-xs text-gray-700">
                            <div className="max-w-[200px] truncate" title={box.itemDescription}>
                              {box.itemDescription}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-xs text-gray-600">
                            {box.materialType !== 'N/A' ? box.materialType : '-'}
                          </td>
                          <td className="py-2 px-2 text-xs text-gray-600">
                            <div className="max-w-[120px] truncate" title={box.itemCategory}>
                              {box.itemCategory !== 'N/A' ? box.itemCategory : '-'}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-xs text-gray-700">
                            {box.netWeight} {box.materialType.toUpperCase().includes('FINISH') ? 'kg' : 'g'}
                          </td>
                          <td className="py-2 px-2 text-xs text-gray-700">
                            {box.totalWeight} {box.materialType.toUpperCase().includes('FINISH') ? 'kg' : 'g'}
                          </td>
                          <td className="py-2 px-2 text-xs">
                            <span className="font-mono text-gray-700">
                              {box.batchNumber !== 'N/A' ? box.batchNumber : '-'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-xs">
                            <span className="font-mono text-gray-700">
                              {box.lotNumber !== 'N/A' ? box.lotNumber : '-'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-xs text-gray-600">
                            {box.manufacturingDate !== 'N/A' ? box.manufacturingDate : '-'}
                          </td>
                          <td className="py-2 px-2 text-xs text-gray-600">
                            {box.expiryDate !== 'N/A' ? box.expiryDate : '-'}
                          </td>
                          <td className="py-2 px-2 text-xs">
                            <span className="font-mono text-gray-800 font-medium">
                              {box.transactionNo || 'N/A'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-xs text-gray-500">
                            {box.scannedAt}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveBox(box.id)}
                              className="h-6 w-6 p-0"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Summary */}
                <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 text-center">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Total Boxes</p>
                      <p className="text-base sm:text-lg font-bold text-gray-800">{scannedBoxes.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Request Qty</p>
                      <p className="text-base sm:text-lg font-bold text-blue-600">
                        {articles[0]?.quantity_units || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Remaining</p>
                      <p className={`text-base sm:text-lg font-bold ${
                        (articles[0]?.quantity_units || 0) - scannedBoxes.length > 0 
                          ? 'text-orange-600' 
                          : 'text-green-600'
                      }`}>
                        {Math.max(0, (articles[0]?.quantity_units || 0) - scannedBoxes.length)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Total Net Wt</p>
                      <p className="text-base sm:text-lg font-bold text-gray-800">
                        {scannedBoxes.reduce((sum, box) => {
                          const weight = parseFloat(box.netWeight || '0')
                          return sum + (box.materialType.toUpperCase().includes('FINISH') ? weight : weight / 1000)
                        }, 0).toFixed(3)} kg
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Total Wt</p>
                      <p className="text-base sm:text-lg font-bold text-gray-800">
                        {scannedBoxes.reduce((sum, box) => {
                          const weight = parseFloat(box.totalWeight || '0')
                          return sum + (box.materialType.toUpperCase().includes('FINISH') ? weight : weight / 1000)
                        }, 0).toFixed(3)} kg
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Validation Errors Display */}
        {validationErrors.length > 0 && (
          <Card className="border-0 shadow-sm overflow-hidden border-l-4 border-l-red-500">
            <CardHeader className="pb-2 bg-red-50">
              <CardTitle className="text-sm font-semibold text-red-700 flex items-center gap-2">
                <X className="h-4 w-4" />
                Validation Errors ({validationErrors.length})
              </CardTitle>
              <p className="text-xs text-red-600">
                Please fix the following errors before submitting:
              </p>
            </CardHeader>
            <CardContent className="pt-0 pb-3 bg-red-50">
              <ul className="space-y-1.5 mt-2">
                {validationErrors.map((error, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-red-700">
                    <span className="mt-0.5 text-red-400">&#8226;</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Submit Section */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Transfer will be submitted with <span className="font-semibold text-gray-800">Approved</span> status
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  className="h-10 sm:h-9 px-4 text-sm bg-white border-gray-200"
                >Cancel</Button>
                <Button
                  type="submit"
                  className="h-10 sm:h-9 px-5 text-sm bg-gray-900 hover:bg-gray-800 text-white">
                  <Send className="mr-2 h-4 w-4" />
                  Submit Transfer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
    </form>
  )
}
  
