"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useItemCategories, useSubCategories, useItemDescriptions, useCategorialItemDescriptions } from "@/lib/hooks/useDropdownData"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { dropdownApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Send, Package, X, Clock, Plus, Trash2, Camera, Search, Loader2, ArrowLeftRight, Copy, Check } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import type { Company } from "@/types/auth"
import { useAuthStore } from "@/lib/stores/auth"
import { InterunitApiService } from "@/lib/interunitApiService"
import { useToast } from "@/hooks/use-toast"
import { useFormPersistence } from "@/hooks/useFormPersistence"
import HighPerformanceQRScanner from "@/components/transfer/high-performance-qr-scanner"
import { ColdStorageApiService, type ColdStorageStockRecord } from "@/lib/api/coldStorageApiService"

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
        const data = await dropdownApi.fetchDropdown({ company, limit: 1000 })

        if (data.options && data.options.material_types && Array.isArray(data.options.material_types)) {
          const allowed = ['RM', 'PM', 'FG']
          const materialTypeOptions = data.options.material_types
            .filter((type: string) => allowed.includes(type.toUpperCase()))
            .map((type: string) => ({ value: type, label: type }))
          setOptions(materialTypeOptions)
        } else {
          const fallbackOptions = [
            { value: "RM", label: "RM" },
            { value: "PM", label: "PM" },
            { value: "FG", label: "FG" }
          ]
          setOptions(fallbackOptions)
        }
      } catch (e: any) {
        console.error("Error fetching material types:", e)
        setOptions([
          { value: "RM", label: "RM" },
          { value: "PM", label: "PM" },
          { value: "FG", label: "FG" }
        ])
        setErrorState("Connection not available. Using default values.")
      } finally {
        setLoading(false)
      }
    }

    fetchMaterialTypes()
  }, [])
  
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
  const itemDescriptionsHook = useCategorialItemDescriptions({ material_type: materialType, item_category: categoryId, sub_category: subCategoryId })

  const handleValueChange = async (selectedValue: string) => {
    // Find the selected option to get the label
    const selectedOption = itemDescriptionsHook.options.find(option => option.value === selectedValue)
    if (selectedOption && updateArticle) {
      // Update item_description immediately
      updateArticle(articleId, "item_description", selectedOption.label)

      // Auto-fill unit_pack_size from categorial_inv uom
      if (selectedOption.uom != null) {
        updateArticle(articleId, "unit_pack_size", Number(selectedOption.uom))
      }

      // Reset SKU ID while fetching
      updateArticle(articleId, "sku_id", null)

      // Fetch SKU ID from API
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
          skuResponse?.id
        )
        if (!skuId || Number.isNaN(skuId) || skuId <= 0) {
          throw new Error("No valid sku_id returned from API")
        }
        updateArticle(articleId, "sku_id", skuId)

        if (skuResponse?.material_type) {
          updateArticle(articleId, "material_type", skuResponse.material_type)
        }
        if (skuResponse?.item_category) {
          updateArticle(articleId, "item_category", skuResponse.item_category)
        }
        if (skuResponse?.sub_category) {
          updateArticle(articleId, "sub_category", skuResponse.sub_category)
        }
      } catch (err) {
        console.error("Error fetching SKU ID:", err)
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

// Cold storage warehouse values that trigger the stock search UI
const COLD_STORAGE_WAREHOUSES = ["Rishi cold", "Savla D-39 cold", "Savla D-514 cold"]

// Cold Storage Stock Search Component (same as cold-storage/transfer-out)
function ColdStorageStockSearch({
  onSelect,
  company,
}: {
  onSelect: (record: ColdStorageStockRecord) => void
  company: string
}) {
  const [coldCompany, setColdCompany] = useState(company.toLowerCase())
  const [lotNoSearch, setLotNoSearch] = useState("")
  const [descSearch, setDescSearch] = useState("")
  const [results, setResults] = useState<ColdStorageStockRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (lotNo: string, desc: string) => {
    if (!lotNo && !desc) {
      setResults([])
      setShowResults(false)
      return
    }
    setLoading(true)
    try {
      const params: Record<string, string> = { company: coldCompany }
      if (lotNo.trim()) params.lot_no = lotNo.trim()
      if (desc.trim()) params.q = desc.trim()
      const data = await ColdStorageApiService.searchColdStorageStocks(params)
      setResults(data.results)
      setShowResults(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [coldCompany])

  const handleSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      doSearch(lotNoSearch, descSearch)
    }, 400)
  }, [lotNoSearch, descSearch, doSearch])

  useEffect(() => {
    handleSearch()
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [handleSearch])

  const handleSelect = (record: ColdStorageStockRecord) => {
    onSelect(record)
    setShowResults(false)
    setLotNoSearch("")
    setDescSearch("")
    setResults([])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-600">Search Cold Storage Stock</span>
        </div>
        <Select value={coldCompany} onValueChange={(val) => { setColdCompany(val); setResults([]); setShowResults(false) }}>
          <SelectTrigger className="h-8 w-[110px] text-xs bg-white border-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cfpl">CFPL</SelectItem>
            <SelectItem value="cdpl">CDPL</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Search by Lot Number</Label>
          <div className="relative">
            <Input
              value={lotNoSearch}
              onChange={(e) => setLotNoSearch(e.target.value)}
              placeholder="Type lot number..."
              className="pr-8"
            />
            {lotNoSearch && (
              <button
                type="button"
                onClick={() => { setLotNoSearch(""); setResults([]); setShowResults(false) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div>
          <Label className="text-xs">Search by Group Name / Item Description</Label>
          <div className="relative">
            <Input
              value={descSearch}
              onChange={(e) => setDescSearch(e.target.value)}
              placeholder="Type group name or item description..."
              className="pr-8"
            />
            {descSearch && (
              <button
                type="button"
                onClick={() => { setDescSearch(""); setResults([]); setShowResults(false) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching...
        </div>
      )}

      {showResults && !loading && results.length === 0 && (
        <div className="text-sm text-muted-foreground py-2">No results found.</div>
      )}

      {showResults && results.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-sky-100 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">#</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Inward Dt</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Unit</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Item Description</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Item Mark</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Lot No</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">Qty of Cartons</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">Weight (kg)</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">Total Inv (kgs)</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {results.map((record, idx) => (
                  <tr
                    key={record.id}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-3 py-2 text-gray-600">{idx + 1}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{record.inward_dt || "-"}</td>
                    <td className="px-3 py-2">{record.unit || "-"}</td>
                    <td className="px-3 py-2 font-medium">{record.item_description || "-"}</td>
                    <td className="px-3 py-2">{record.item_mark || "-"}</td>
                    <td className="px-3 py-2 font-mono">{record.lot_no || "-"}</td>
                    <td className="px-3 py-2 text-right">{record.net_qty_on_cartons ?? "-"}</td>
                    <td className="px-3 py-2 text-right">{record.weight_kg ?? "-"}</td>
                    <td className="px-3 py-2 text-right">{(record.net_qty_on_cartons != null && record.weight_kg != null) ? (record.net_qty_on_cartons * record.weight_kg).toFixed(2) : "-"}</td>
                    <td className="px-3 py-2 text-center">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 px-3 text-xs"
                        onClick={() => handleSelect(record)}
                      >
                        Select
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 px-3 py-1.5 text-xs text-muted-foreground border-t">
            Showing {results.length} result{results.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  )
}

export default function NewTransferRequestPage({ params }: NewTransferRequestPageProps) {
  const { company } = params
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { user } = useAuthStore()

  // Get requestId from URL parameter
  const requestIdFromUrl = searchParams.get('requestId')

  // Get editId from URL parameter (edit mode)
  const editIdFromUrl = searchParams.get('editId')
  const isEditMode = !!editIdFromUrl
  const [editLoading, setEditLoading] = useState(false)

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
  const now = new Date()
  const currentDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`



  const [formData, setFormData] = useState({
    requestDate: currentDate,
    fromWarehouse: "",
    toWarehouse: "",
    reason: "",
    reasonDescription: "",
  })

  // Article interface matching inward form
  interface Article {
    id: string
    sku_id?: number | null
    material_type: string
    item_description: string
    item_category: string
    sub_category: string
    quantity_units: number
    packaging_type: number
    unit_pack_size: number
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
    // Cold storage stock limit (max boxes from DB)
    cs_max_boxes: number | null
    // Cold storage stock identifiers (not shown in UI)
    cs_box_id: string | null
    cs_transaction_no: string | null
    cs_inward_no: string | null
    cs_total_inventory_kgs: number | null
    cs_item_mark: string | null
  }

  const [articles, setArticles] = useState<Article[]>([
    {
      id: "1",
      sku_id: null,
      material_type: "",
      item_description: "",
      item_category: "",
      sub_category: "",
      quantity_units: 1,
      packaging_type: 0,
      unit_pack_size: 0,
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
      cs_max_boxes: null,
      cs_box_id: null,
      cs_transaction_no: null,
      cs_inward_no: null,
      cs_total_inventory_kgs: null,
      cs_item_mark: null,
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

  // Cold transfer summary popup
  const [coldTransferPopup, setColdTransferPopup] = useState<{ open: boolean; message: string }>({ open: false, message: "" })
  const [popupCopied, setPopupCopied] = useState(false)
  
  // Counter for unique box IDs (persists across re-renders using ref)
  const boxIdCounterRef = useRef(1)
  
  // Processing flag to prevent duplicate scans
  const isProcessingRef = useRef(false)

  // Control high-performance QR scanner visibility
  const [showScanner, setShowScanner] = useState(false)

  // Manual box entry state
  const [manualBoxId, setManualBoxId] = useState("")
  const [manualTransactionNo, setManualTransactionNo] = useState("")
  const [manualBoxLoading, setManualBoxLoading] = useState(false)

  // Validation errors state

  // Persist form data across page refreshes (use different key for edit mode)
  const { clearSavedData } = useFormPersistence(isEditMode ? `draft-edit-transfer-${editIdFromUrl}` : "draft-directtransfer", {
    formData: { value: formData, setter: setFormData },
    articles: { value: articles, setter: setArticles },
    transferInfo: { value: transferInfo, setter: setTransferInfo },
    transferNo: { value: transferNo, setter: setTransferNo },
    requestNo: { value: requestNo, setter: setRequestNo },
    scannedBoxes: { value: scannedBoxes, setter: (val: any[]) => {
      setScannedBoxes(val)
      // Sync boxIdCounter to avoid ID collisions after restore
      if (Array.isArray(val) && val.length > 0) {
        const maxId = Math.max(...val.map((b: any) => Number(b.id) || 0))
        if (maxId >= boxIdCounterRef.current) {
          boxIdCounterRef.current = maxId + 1
        }
      }
    }},
    loadedItems: { value: loadedItems, setter: setLoadedItems },
  })

  // Always reset requestDate to today on mount — localStorage restore may have cached an old date
  useEffect(() => {
    if (!isEditMode) {
      const now = new Date()
      const today = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`
      setFormData(prev => ({ ...prev, requestDate: today }))
    }
  }, [])

  // Use categorial_inv dropdown hooks for transfer
  const { options: itemCategories, loading: categoriesLoading } = useItemCategories({ company, material_type: articles[0]?.material_type || "" })
  const { options: subCategories, loading: subCategoriesLoading } = useSubCategories(articles[0]?.item_category || "", { company, material_type: articles[0]?.material_type || "" })
  const { options: itemDescriptions, loading: descriptionsLoading } = useCategorialItemDescriptions({
    material_type: articles[0]?.material_type || "",
    item_category: articles[0]?.item_category || "",
    sub_category: articles[0]?.sub_category || ""
  })

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
        
        // Fetch single request by ID
        const request = await InterunitApiService.getRequest(parseInt(requestIdFromUrl))

        // Set original request number (REQ...)
        setRequestNo(request.request_no)
        
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
          requestDate: currentDate,
          fromWarehouse: normalizeWarehouse(request.from_warehouse),
          toWarehouse: normalizeWarehouse(request.to_warehouse),
          reason: "",
          reasonDescription: request.reason_description || "",
        }
        setFormData(formDataToSet)

        // Populate article/item data from first line item (if exists)
        if (request.lines && request.lines.length > 0) {
          const firstItem = request.lines[0]

          // Normalize field values to match dropdown options
          const normalizeField = (value: string | undefined | null) => {
            // Return empty string for null, undefined, or empty string
            if (!value || value === "") return ""
            // Return the value as-is (backend now returns empty string instead of "N/A")
            // Keep original case - DO NOT convert to uppercase
            const trimmedValue = value.trim()
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
              return camelCase
            }
            return value
          }

          // Update the first article with the loaded data
          const updatedArticles = articles.map((art, index) => {
            if (index === 0) {
              return {
                ...art,
                material_type: normalizeField(firstItem.material_type),
                item_category: normalizeField(firstItem.item_category),
                sub_category: normalizeField(firstItem.sub_category),
                item_description: normalizeField(firstItem.item_description),
              }
            }
            return art
          })

          
          // Debug: Log raw API values for comparison
          
          setArticles(updatedArticles)
          
          // Store all items for display and initialize scanned counters
          setLoadedItems(request.lines.map((it: any) => ({
            ...it,
            scanned_count: 0,
            pending: Math.max(0, (parseInt(it.quantity) || 0) - 0)
          })))
        } else {
          console.warn('⚠️ No lines found in request!')
        }


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

  // Load existing transfer data when editing
  useEffect(() => {
    const loadTransferForEdit = async () => {
      if (!editIdFromUrl) return

      setEditLoading(true)
      try {
        const transfer = await InterunitApiService.getTransferById(company, editIdFromUrl)

        // Set transfer number (challan_no)
        setTransferNo(transfer.challan_no)

        // Set request number if linked
        if (transfer.request_no) setRequestNo(transfer.request_no)

        // Set form data from header
        setFormData(prev => ({
          ...prev,
          requestDate: currentDate,
          fromWarehouse: transfer.from_warehouse || "",
          toWarehouse: transfer.to_warehouse || "",
          reason: transfer.reason_code || "",
          reasonDescription: transfer.remark || "",
        }))

        // Set transfer info - check if values match dropdown presets
        const knownVehicles = ["MH43BP6885", "MH43BX1881", "MH46BM5987"]
        const vehicleVal = transfer.vehicle_no || ""
        const isKnownVehicle = knownVehicles.includes(vehicleVal)

        const knownDrivers = ["Tukaram (+919930056340)", "Sachin (8692885298)", "Gopal (+919975887148)"]
        const driverVal = transfer.driver_name || ""
        const isKnownDriver = knownDrivers.includes(driverVal)

        setTransferInfo(prev => ({
          ...prev,
          vehicleNumber: isKnownVehicle ? vehicleVal : "other",
          vehicleNumberOther: isKnownVehicle ? "" : vehicleVal,
          driverName: isKnownDriver ? driverVal : "other",
          driverNameOther: isKnownDriver ? "" : driverVal,
          approvalAuthorityOther: transfer.approved_by || "",
        }))

        // Set first article dropdown values from first line
        if (transfer.lines && transfer.lines.length > 0) {
          const firstLine = transfer.lines[0]
          setArticles(prev => prev.map((art, idx) => {
            if (idx === 0) {
              return {
                ...art,
                material_type: firstLine.material_type || "",
                item_category: firstLine.item_category || "",
                sub_category: firstLine.sub_category || "",
                item_description: firstLine.item_description || "",
                quantity_units: parseInt(firstLine.quantity) || 0,
                uom: firstLine.uom || "",
                packaging_type: parseFloat(firstLine.pack_size) || 0,
                unit_pack_size: parseFloat(firstLine.unit_pack_size) || 0,
                net_weight: parseFloat(firstLine.net_weight) || 0,
                lot_number: firstLine.lot_number || "",
                batch_number: firstLine.batch_number || "",
              }
            }
            return art
          }))
        }

        // Load scanned boxes: prefer actual QR-scanned boxes (per-box weights),
        // fall back to lines only when no boxes exist (manual/direct entries)
        if (transfer.boxes && transfer.boxes.length > 0) {
          // Build a lookup from lines for material_type, item_category etc.
          const lineLookup: Record<string, any> = {}
          if (transfer.lines) {
            for (const line of transfer.lines) {
              const key = (line.item_description || "").trim().toUpperCase()
              lineLookup[key] = line
            }
          }

          const qrBoxes = transfer.boxes.map((box: any) => {
            const uniqueId = boxIdCounterRef.current
            boxIdCounterRef.current += 1
            // Find matching line for extra fields (material_type, category, uom, pack_size)
            const matchedLine = lineLookup[(box.article || "").trim().toUpperCase()]
            return {
              id: uniqueId,
              boxNumber: uniqueId,
              boxId: box.box_id || "",
              itemDescription: box.article || "",
              skuId: null,
              transactionNo: box.transaction_no || "",
              boxNumberInArray: box.box_number,
              materialType: matchedLine?.material_type || "",
              itemCategory: matchedLine?.item_category || "",
              subCategory: matchedLine?.sub_category || "",
              netWeight: box.net_weight || "0",
              totalWeight: box.gross_weight || "0",
              batchNumber: box.batch_number || "",
              lotNumber: box.lot_number || "",
              manufacturingDate: "",
              expiryDate: "",
              packagingType: matchedLine?.pack_size || "0",
              packageSize: matchedLine?.unit_pack_size || "0",
              quantityUnits: "1",
              uom: matchedLine?.uom || "",
              scannedAt: new Date().toLocaleTimeString(),
              rawData: box,
            }
          })
          setScannedBoxes(qrBoxes)
        } else if (transfer.lines && transfer.lines.length > 0) {
          // No QR boxes — load lines as manual entries (DIRECT)
          const loadedBoxes = transfer.lines.map((line: any, index: number) => {
            const uniqueId = boxIdCounterRef.current
            boxIdCounterRef.current += 1
            return {
              id: uniqueId,
              boxNumber: uniqueId,
              boxId: "",
              itemDescription: line.item_description || "",
              skuId: null,
              transactionNo: "DIRECT",
              boxNumberInArray: index + 1,
              materialType: line.material_type || "",
              itemCategory: line.item_category || "",
              subCategory: line.sub_category || "",
              netWeight: line.net_weight || "0",
              totalWeight: line.total_weight || "0",
              batchNumber: line.batch_number || "",
              lotNumber: line.lot_number || "",
              manufacturingDate: "",
              expiryDate: "",
              packagingType: line.pack_size || "0",
              packageSize: line.unit_pack_size || "0",
              quantityUnits: line.quantity || "1",
              uom: line.uom || "",
              scannedAt: new Date().toLocaleTimeString(),
              rawData: line,
            }
          })
          setScannedBoxes(loadedBoxes)
        }

        toast({
          title: "Transfer Loaded",
          description: `Editing transfer ${transfer.challan_no}`,
        })
      } catch (error: any) {
        console.error("Failed to load transfer for editing:", error)
        toast({
          title: "Error",
          description: error.message || "Failed to load transfer details",
          variant: "destructive",
        })
      } finally {
        setEditLoading(false)
      }
    }

    loadTransferForEdit()
  }, [editIdFromUrl])

  // Fetch SKU ID when article values are auto-filled from request
  useEffect(() => {
    const fetchSkuIdForAutoFilledArticle = async () => {
      if (articles[0]?.material_type &&
          articles[0]?.item_category &&
          articles[0]?.sub_category &&
          articles[0]?.item_description &&
          !articles[0]?.sku_id &&
          requestIdFromUrl) {
        try {
          const skuResponse = await dropdownApi.fetchSkuId({
            company,
            item_description: articles[0].item_description,
            item_category: articles[0].item_category,
            sub_category: articles[0].sub_category,
            material_type: articles[0].material_type
          })

          const skuId: number | undefined = Number(
            skuResponse?.sku_id ??
            skuResponse?.id
          )

          if (skuId && !Number.isNaN(skuId) && skuId > 0) {
            updateArticle(articles[0].id, "sku_id", skuId)
          }
        } catch (err) {
          console.error("Error fetching SKU ID:", err)
        }
      }
    }

    fetchSkuIdForAutoFilledArticle()
  }, [articles[0]?.material_type, articles[0]?.item_category, articles[0]?.sub_category, articles[0]?.item_description, articles[0]?.sku_id, requestIdFromUrl])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => {
      // When fromWarehouse changes away from cold storage, reset cs fields on all articles
      if (field === "fromWarehouse" && COLD_STORAGE_WAREHOUSES.includes(prev.fromWarehouse) && !COLD_STORAGE_WAREHOUSES.includes(value)) {
        setArticles(prevArts => prevArts.map(a => ({
          ...a,
          cs_max_boxes: null,
          cs_box_id: null,
          cs_transaction_no: null,
          cs_inward_no: null,
          cs_total_inventory_kgs: null,
          cs_item_mark: null,
        })))
        setArticleEntryMode({})
      }
      return { ...prev, [field]: value }
    })
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
      unit_pack_size: 0,
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
      cs_max_boxes: null,
      cs_box_id: null,
      cs_transaction_no: null,
      cs_inward_no: null,
      cs_total_inventory_kgs: null,
      cs_item_mark: null,
    }
    setArticles(prev => [...prev, newArticle])
  }

  const removeArticle = (id: string) => {
    if (articles.length > 1) {
      setArticles(prev => prev.filter(article => article.id !== id))
      toast({
        title: "Article Removed",
        description: "Article has been removed successfully.",
      })
    } else {
      toast({
        title: "Cannot Remove",
        description: "At least one article is required.",
        variant: "destructive",
      })
    }
  }

  // Check if from warehouse is a cold storage
  const isColdStorageFrom = COLD_STORAGE_WAREHOUSES.includes(formData.fromWarehouse)

  // Auto-fill article fields from cold storage stock record
  const handleSelectColdStorageStock = (articleId: string, record: ColdStorageStockRecord) => {
    console.log('🔍 [DEBUG] Cold Storage Stock Selected:', {
      box_id: record.box_id,
      transaction_no: record.transaction_no,
      inward_no: record.inward_no,
      item_description: record.item_description,
      lot_no: record.lot_no,
      fullRecord: record
    })

    setArticles(prev =>
      prev.map(article => {
        if (article.id !== articleId) return article
        const availableBoxes = record.net_qty_on_cartons ? Math.ceil(record.net_qty_on_cartons) : 0
        const updatedArticle = {
          ...article,
          item_category: record.group_name || article.item_category,
          item_description: record.item_description || article.item_description,
          lot_number: record.lot_no ? String(record.lot_no) : article.lot_number,
          quantity_units: 0,
          unit_pack_size: 0,
          net_weight: record.weight_kg ?? 0,
          total_weight: 0,
          packaging_type: availableBoxes,
          cs_max_boxes: availableBoxes,
          cs_box_id: record.box_id || null,
          cs_transaction_no: record.transaction_no || null,
          cs_inward_no: record.inward_no || null,
          cs_total_inventory_kgs: (record.net_qty_on_cartons != null && record.weight_kg != null) ? record.net_qty_on_cartons * record.weight_kg : null,
          cs_item_mark: record.item_mark || null,
        }

        console.log('✅ [DEBUG] Article Updated with CS Data:', {
          cs_box_id: updatedArticle.cs_box_id,
          cs_transaction_no: updatedArticle.cs_transaction_no,
          cs_inward_no: updatedArticle.cs_inward_no,
          cs_total_inventory_kgs: updatedArticle.cs_total_inventory_kgs,
        })

        return updatedArticle
      })
    )
    toast({
      title: "Stock Selected",
      description: `Filled from stock: ${record.item_description || "N/A"} - Lot ${record.lot_no || "N/A"}`,
    })
  }

  // Auto-calculate net weight — always returns value in Kg
  const calculateNetWeight = (article: Article): number => {
    const quantity = Number(article.quantity_units) || 1
    const packSize = Number(article.packaging_type) || 0

    if (article.material_type === 'FG') {
      // FG: (packageSize × packSize) × quantity → Kg
      const packageSize = Number(article.unit_pack_size) || 1
      const result = (packageSize * packSize) * quantity
      return parseFloat(result.toFixed(3))
    } else {
      // RM/PM/RTV: quantity × packSize (Kg)
      return parseFloat((quantity * packSize).toFixed(2))
    }
  }

  const updateArticle = (id: string, field: string, value: any) => {
    setArticles(prevArticles => prevArticles.map((article) => {
      if (article.id === id) {
        const updatedArticle = { ...article, [field]: value }

        // If material type actually changes, clear dependent fields + reset unit_pack_size
        if (field === "material_type" && value !== article.material_type) {
          updatedArticle.item_category = ""
          updatedArticle.sub_category = ""
          updatedArticle.item_description = ""
          updatedArticle.sku_id = null
          updatedArticle.unit_pack_size = 0
        }
        // If category or sub category actually changes, nuke stale item selection + sku
        if (field === "item_category" && value !== article.item_category) {
          updatedArticle.sub_category = ""
          updatedArticle.item_description = ""
          updatedArticle.sku_id = null
        }
        if (field === "sub_category" && value !== article.sub_category) {
          updatedArticle.item_description = ""
          updatedArticle.sku_id = null
        }
        if (field === "unit_rate" || field === "quantity_units") {
          updatedArticle.total_amount = (Number(updatedArticle.unit_rate) || 0) * (Number(updatedArticle.quantity_units) || 0)
        }

        // Auto-recalculate net weight when relevant fields change
        if (["quantity_units", "packaging_type", "unit_pack_size", "material_type"].includes(field)) {
          // For cold storage articles (cs_max_boxes set), only recalc total_weight display — keep net_weight as per-box weight
          if (updatedArticle.cs_max_boxes != null) {
            // net_weight stays as per-box weight from cold storage selection
            // total_weight = quantity_units * net_weight (calculated inline in JSX)
          } else {
            updatedArticle.net_weight = calculateNetWeight(updatedArticle)
          }
        }

        return updatedArticle
      }
      return article
    }))
  }

  const handleTransferInfoChange = (field: string, value: string) => {
    setTransferInfo(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Item search state per article
  // Track article entry mode per article: "cold-storage" or "regular"
  const [articleEntryMode, setArticleEntryMode] = useState<Record<string, "cold-storage" | "regular">>({})

  const [itemSearchQuery, setItemSearchQuery] = useState<Record<string, string>>({})
  const [itemSearchResults, setItemSearchResults] = useState<Record<string, Array<{ id: number; item_description: string; material_type?: string; group?: string; sub_group?: string; uom?: number | null }>>>({})
  const [itemSearchLoading, setItemSearchLoading] = useState<Record<string, boolean>>({})
  const [itemSearchOpen, setItemSearchOpen] = useState<Record<string, boolean>>({})
  const searchTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const handleItemSearch = (articleId: string, query: string) => {
    setItemSearchQuery(prev => ({ ...prev, [articleId]: query }))

    // Clear previous timeout for this article
    if (searchTimeoutRef.current[articleId]) {
      clearTimeout(searchTimeoutRef.current[articleId])
    }

    if (!query || query.trim().length < 2) {
      setItemSearchResults(prev => ({ ...prev, [articleId]: [] }))
      setItemSearchOpen(prev => ({ ...prev, [articleId]: false }))
      return
    }

    // Debounce: wait 300ms before calling API (uses categorial_inv table via interunit endpoint)
    searchTimeoutRef.current[articleId] = setTimeout(async () => {
      setItemSearchLoading(prev => ({ ...prev, [articleId]: true }))
      try {
        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/interunit/categorial-search?search=${encodeURIComponent(query.trim())}&limit=200`
        const response = await fetch(apiUrl, { method: 'GET', headers: { 'Accept': 'application/json' } })
        if (!response.ok) throw new Error(`Search failed: ${response.status}`)
        const result = await response.json()
        setItemSearchResults(prev => ({ ...prev, [articleId]: result.items || [] }))
        setItemSearchOpen(prev => ({ ...prev, [articleId]: true }))
      } catch (error) {
        console.error('Item search failed:', error)
        setItemSearchResults(prev => ({ ...prev, [articleId]: [] }))
      } finally {
        setItemSearchLoading(prev => ({ ...prev, [articleId]: false }))
      }
    }, 300)
  }

  const handleItemSelect = async (articleId: string, item: { id: number; item_description: string; material_type?: string; group?: string; sub_group?: string; uom?: number | null }) => {
    const itemCategory = item.group ?? ""
    const subCategory = item.sub_group ?? ""

    const updatedArticles = articles.map((art) => {
      if (art.id === articleId) {
        const updated = {
          ...art,
          material_type: item.material_type || "",
          item_category: itemCategory,
          sub_category: subCategory,
          item_description: item.item_description || "",
          sku_id: item.id || null,
          unit_pack_size: item.uom != null ? item.uom : 0,
          net_weight: 0,
        }
        updated.net_weight = calculateNetWeight(updated)
        return updated
      }
      return art
    })
    setArticles(updatedArticles)

    setItemSearchQuery(prev => ({ ...prev, [articleId]: "" }))
    setItemSearchResults(prev => ({ ...prev, [articleId]: [] }))
    setItemSearchOpen(prev => ({ ...prev, [articleId]: false }))

    const missingFields = []
    if (!itemCategory) missingFields.push("Category")
    if (!subCategory) missingFields.push("Sub Category")

    toast({
      title: "Item Selected",
      description: missingFields.length > 0
        ? `${item.item_description} selected. Note: ${missingFields.join(", ")} not found in database — fill manually.`
        : `${item.item_description} — all fields auto-filled`,
      variant: missingFields.length > 0 ? "destructive" : "default",
    })
  }

  // Handle adding an article to the scanned boxes / articles list
  // Creates one box entry per quantity unit, dividing weights equally
  const handleAddArticleToList = async (article: Article) => {
    // Validate required fields
    if (!article.item_description) {
      toast({
        title: "Missing Fields",
        description: "Please fill in at least the Item Description before adding",
        variant: "destructive",
      })
      return
    }
    const qty = article.quantity_units || 1

    // Cold storage stock limit validation
    if (article.cs_max_boxes !== null && qty > article.cs_max_boxes) {
      toast({
        title: "Limit Exceeded",
        description: `No. of boxes (${qty}) exceeds available stock (${article.cs_max_boxes})`,
        variant: "destructive",
      })
      return
    }
    // Case pack is per box — never divide it
    const casePack = article.unit_pack_size || 0

    // All weights are already in Kg (calculateNetWeight converts FG grams→Kg,
    // and Total Wt label now says Kg so user enters in Kg directly)
    const netWeightKg = article.net_weight || 0
    const totalWeightKg = article.total_weight || 0

    // For cold storage articles, weight_kg from cold_stocks is per-box — use it directly
    // For non-cold-storage articles, divide total weights equally per box
    const isColdStorageArticle = article.cs_max_boxes !== null
    const netWeightPerBox = isColdStorageArticle ? netWeightKg : (qty > 0 ? netWeightKg / qty : 0)
    const totalWeightPerBox = isColdStorageArticle ? netWeightKg : (qty > 0 ? (totalWeightKg > 0 ? totalWeightKg / qty : netWeightKg / qty) : 0)

    // For cold storage articles, pick individual box_ids in FIFO order from backend
    let pickedBoxes: { id: number; box_id: string; transaction_no: string; weight_kg: number }[] = []
    if (isColdStorageArticle && article.item_description && article.lot_number && article.cs_inward_no) {
      console.log('📦 [DEBUG] Calling pickBoxes API:', {
        company,
        item_description: article.item_description,
        lot_no: article.lot_number,
        inward_no: article.cs_inward_no,
        qty,
        cs_box_id_fallback: article.cs_box_id,
        cs_transaction_no_fallback: article.cs_transaction_no,
      })

      try {
        const pickResult = await ColdStorageApiService.pickBoxes({
          company,
          item_description: article.item_description,
          lot_no: article.lot_number,
          inward_no: article.cs_inward_no,
          qty,
        })
        pickedBoxes = pickResult.boxes

        console.log('✅ [DEBUG] pickBoxes API Success:', {
          boxesReturned: pickedBoxes.length,
          boxes: pickedBoxes,
          allHaveBoxId: pickedBoxes.every(b => b.box_id),
          allHaveTransactionNo: pickedBoxes.every(b => b.transaction_no),
        })
      } catch (err) {
        console.error("❌ [DEBUG] pickBoxes API Failed:", err)
        console.log('⚠️ [DEBUG] Will fallback to:', {
          cs_box_id: article.cs_box_id,
          cs_transaction_no: article.cs_transaction_no,
        })
      }
    }

    const newEntries = []
    const timeStamp = new Date().toLocaleTimeString()

    for (let i = 0; i < qty; i++) {
      const uniqueId = boxIdCounterRef.current
      boxIdCounterRef.current += 1

      // Use FIFO-picked box_id and transaction_no if available
      const pickedBox = pickedBoxes[i]
      const boxId = pickedBox?.box_id || article.cs_box_id || (article.sku_id ? String(article.sku_id) : 'N/A')
      const transactionNo = pickedBox?.transaction_no || article.cs_transaction_no || 'DIRECT'
      // For cold storage with FIFO picks: use individual weight_kg from each picked box row
      const boxNetWeight = pickedBox ? pickedBox.weight_kg : netWeightPerBox
      const boxGrossWeight = pickedBox ? pickedBox.weight_kg : totalWeightPerBox

      console.log(`📦 [DEBUG] Creating Box Entry ${i + 1}/${qty}:`, {
        boxId,
        transactionNo,
        source: pickedBox ? 'FIFO_API' : (article.cs_box_id ? 'FALLBACK_CS' : 'NONE'),
        pickedBox,
        fallbackData: {
          cs_box_id: article.cs_box_id,
          cs_transaction_no: article.cs_transaction_no,
        },
        willBeIncludedInSubmission: transactionNo !== 'DIRECT',
      })

      newEntries.push({
        id: uniqueId,
        boxNumber: uniqueId,
        boxId,
        itemDescription: article.item_description || 'N/A',
        skuId: article.sku_id || null,
        transactionNo,
        boxNumberInArray: uniqueId,
        materialType: article.material_type || 'N/A',
        itemCategory: article.item_category || 'N/A',
        subCategory: article.sub_category || 'N/A',
        netWeight: String(parseFloat(boxNetWeight.toFixed(3))),
        totalWeight: String(parseFloat(boxGrossWeight.toFixed(3))),
        batchNumber: article.batch_number || 'N/A',
        lotNumber: article.lot_number || 'N/A',
        manufacturingDate: article.manufacturing_date || 'N/A',
        expiryDate: article.expiry_date || 'N/A',
        packagingType: isColdStorageArticle ? '' : (String(article.packaging_type) || 'N/A'),
        packageSize: isColdStorageArticle ? '' : String(casePack),
        quantityUnits: '1',
        uom: article.uom || 'N/A',
        itemCode: 'N/A',
        hsnCode: 'N/A',
        qualityGrade: 'N/A',
        scannedAt: timeStamp,
        rawData: article,
      })
    }

    setScannedBoxes(prev => [...prev, ...newEntries])

    toast({
      title: "Boxes Added",
      description: `${qty} boxes added for ${article.item_description} (${netWeightPerBox.toFixed(3)} kg each)`,
    })

    // Reset the article fields after adding
    const resetArticle: Article = {
      id: article.id,
      sku_id: null,
      material_type: "",
      item_description: "",
      item_category: "",
      sub_category: "",
      quantity_units: 0,
      packaging_type: 0,
      unit_pack_size: 0,
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
      cs_max_boxes: null,
      cs_box_id: null,
      cs_transaction_no: null,
      cs_inward_no: null,
      cs_total_inventory_kgs: null,
      cs_item_mark: null,
    }
    setArticles(prev => prev.map(a => a.id === article.id ? resetArticle : a))
  }

  // Handle removing a scanned box
  const handleRemoveBox = (boxId: number) => {
    // Use functional update to always work with latest state (avoids stale closure)
    setScannedBoxes(prev => {
      // Use loose equality (==) to handle potential string/number mismatch from localStorage
      const boxToRemove = prev.find(box => box.id == boxId)

      if (boxToRemove) {
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
            matched.scanned_count = Math.max(0, currentScanned - 1)
            const qty = parseInt(matched.quantity) || 0
            matched.pending = Math.max(0, qty - matched.scanned_count)
          }

          return itemsCopy
        })

        toast({
          title: "Box Removed",
          description: `Box #${boxToRemove.boxNumber} removed`,
        })
      }

      // Filter using loose equality to handle string/number mismatch
      const filtered = prev.filter(box => box.id != boxId)

      // If strict filter didn't work (same length), force remove by index as fallback
      if (filtered.length === prev.length) {
        const idx = prev.findIndex(box => String(box.id) === String(boxId))
        if (idx !== -1) {
          const copy = [...prev]
          copy.splice(idx, 1)
          return copy
        }
      }

      return filtered
    })
  }

  // Update a single scanned box field (for inline editing)
  // When Case Pack (packagingType) changes, auto-recalculate Net Wt = casePack × unitPackSize
  const updateScannedBox = (boxId: number, field: string, value: string) => {
    setScannedBoxes(prev => prev.map(box => {
      if (box.id !== boxId) return box
      const updated = { ...box, [field]: value }
      if (field === 'packagingType') {
        const casePack = parseFloat(value) || 0
        const unitPackSize = parseFloat(box.packageSize) || 0
        updated.netWeight = String(parseFloat((casePack * unitPackSize).toFixed(3)))
      }
      return updated
    }))
  }

  // Handle manual box entry - fetch box by box_number + transaction_no
  const handleManualBoxFetch = async () => {
    if (!manualBoxId.trim() || !manualTransactionNo.trim()) {
      toast({
        title: "Missing Fields",
        description: "Please enter both Box Number and Transaction No",
        variant: "destructive",
      })
      return
    }

    // Check for duplicate
    const isDuplicate = scannedBoxes.some(
      (box) => String(box.boxNumberInArray) === manualBoxId.trim() && box.transactionNo === manualTransactionNo.trim()
    )
    if (isDuplicate) {
      toast({
        title: "Duplicate Box",
        description: "This box has already been added",
        variant: "destructive",
      })
      return
    }

    setManualBoxLoading(true)
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/interunit/box-lookup/${company}?box_number=${encodeURIComponent(manualBoxId.trim())}&transaction_no=${encodeURIComponent(manualTransactionNo.trim())}`
      const response = await fetch(apiUrl)

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.detail || `Box not found (${response.status})`)
      }

      const data = await response.json()
      const boxData = data.box

      const uniqueId = boxIdCounterRef.current
      boxIdCounterRef.current += 1

      const materialType = boxData.material_type || ''
      const netWeightRaw = parseFloat(boxData.net_weight || 0)
      const grossWeightRaw = parseFloat(boxData.gross_weight || 0)

      const newBox = {
        id: uniqueId,
        boxNumber: uniqueId,
        boxId: boxData.box_id || manualBoxId.trim(),
        itemDescription: boxData.item_description || boxData.article_description || 'N/A',
        skuId: boxData.sku_id || null,
        transactionNo: boxData.transaction_no || manualTransactionNo.trim(),
        boxNumberInArray: boxData.box_number || 0,
        materialType: materialType || 'N/A',
        itemCategory: boxData.item_category || 'N/A',
        subCategory: boxData.sub_category || 'N/A',
        netWeight: String(netWeightRaw),
        totalWeight: String(grossWeightRaw),
        batchNumber: boxData.batch_number || 'N/A',
        lotNumber: boxData.lot_number || 'N/A',
        manufacturingDate: boxData.manufacturing_date || 'N/A',
        expiryDate: boxData.expiry_date || 'N/A',
        packagingType: boxData.packaging_type || 'N/A',
        quantityUnits: boxData.quantity_units || 'N/A',
        uom: boxData.uom || 'N/A',
        itemCode: 'N/A',
        hsnCode: 'N/A',
        qualityGrade: boxData.quality_grade || 'N/A',
        scannedAt: new Date().toLocaleTimeString(),
        rawData: boxData,
      }

      setScannedBoxes((prev) => [...prev, newBox])

      toast({
        title: "Box Added",
        description: `${newBox.itemDescription} | Box #${newBox.boxNumberInArray}`,
      })

      // Clear inputs
      setManualBoxId("")
      setManualTransactionNo("")
    } catch (error: any) {
      console.error('Manual box fetch error:', error)
      toast({
        title: "Box Not Found",
        description: error.message || "Could not find box with the given details",
        variant: "destructive",
      })
    } finally {
      setManualBoxLoading(false)
    }
  }

  const handleQRScanSuccess = async (decodedText: string) => {
    // Prevent duplicate processing
    if (isProcessingRef.current) {
      return
    }
    
    isProcessingRef.current = true
    
    // Close the scanner immediately after successful scan
    setShowScanner(false)
    
    try {
      // Try to parse JSON from QR code
      const qrData = JSON.parse(decodedText)

      // Check if this is a Bulk Entry QR: {"tx":"BE-...","bi":"..."}
      const isBulkEntryQR = qrData.tx && qrData.tx.startsWith('BE')
      // Check if this is the NEW QR format: {"tx":"TR-...","bi":"..."} (but not BE-)
      const isNewQRFormat = qrData.tx && qrData.bi && !isBulkEntryQR

      // Check if this is a BOX QR code (has transaction_no, cn, tx, or bt key)
      const boxId = qrData.transaction_no || qrData.cn || qrData.tx || qrData.bt || null
      const hasBoxData = isNewQRFormat || isBulkEntryQR || qrData.transaction_no || qrData.cn || qrData.tx || qrData.batch_number || qrData.bt || qrData.box_number || qrData.bx ||
                        (boxId && (boxId.startsWith('CONS') || boxId.startsWith('TR') || boxId.startsWith('BT-')))

      if (hasBoxData) {
        const transactionNo = qrData.transaction_no || qrData.cn || qrData.tx || 'N/A'
        const qrBoxId = qrData.bi || null  // box_id from new QR format
        const skuId = qrData.sku_id || qrData.sk || null
        const boxNumber = qrData.box_number || qrData.bx || null

        // Check for duplicate: for new QR / bulk entry format use tx + bi, otherwise use transaction_no + sku_id + box_number
        const isDuplicate = scannedBoxes.some(box => {
          if (isNewQRFormat || isBulkEntryQR) {
            return box.transactionNo === transactionNo && box.boxId === qrBoxId
          }
          const match = box.transactionNo === transactionNo &&
                       box.skuId === skuId &&
                       box.boxNumberInArray === boxNumber
          return match
        })


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

        let boxData = qrData

        // NEW QR FORMAT: {"tx":"TR-...","bi":"..."} - fetch box by box_id + transaction_no
        if (isNewQRFormat) {
          try {
            const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/interunit/box-lookup-by-id/${company}?box_id=${encodeURIComponent(qrBoxId)}&transaction_no=${encodeURIComponent(transactionNo)}`

            const response = await fetch(apiUrl)
            if (!response.ok) {
              const errorData = await response.json().catch(() => null)
              throw new Error(errorData?.detail || `Box not found (${response.status})`)
            }

            const data = await response.json()
            const fetchedBox = data.box

            boxData = {
              ...qrData,
              item_description: fetchedBox.item_description || fetchedBox.article_description,
              sku_id: fetchedBox.sku_id,
              material_type: fetchedBox.material_type,
              item_category: fetchedBox.item_category,
              sub_category: fetchedBox.sub_category,
              net_weight: fetchedBox.net_weight,
              total_weight: fetchedBox.gross_weight,
              gross_weight: fetchedBox.gross_weight,
              batch_number: fetchedBox.batch_number,
              lot_number: fetchedBox.lot_number,
              uom: fetchedBox.uom,
              manufacturing_date: fetchedBox.manufacturing_date,
              expiry_date: fetchedBox.expiry_date,
              quantity_units: fetchedBox.quantity_units,
              packaging_type: fetchedBox.packaging_type,
              quality_grade: fetchedBox.quality_grade,
              box_number: fetchedBox.box_number,
              box_id: fetchedBox.box_id,
            }
          } catch (fetchError: any) {
            console.error('❌ Failed to fetch box by box_id:', fetchError)
            toast({
              title: "Box Lookup Failed",
              description: fetchError.message || "Could not find box with scanned QR data",
              variant: "destructive",
            })
          }
        }
        // BULK ENTRY FORMAT: tx starts with "BE-" - fetch from bulk_entry_boxes
        else if (isBulkEntryQR) {
          try {
            const qrBoxId = qrData.bi || ''
            const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/interunit/bulk-entry-box-lookup/${company}?box_id=${encodeURIComponent(qrBoxId)}&transaction_no=${encodeURIComponent(transactionNo)}`

            const response = await fetch(apiUrl)
            if (!response.ok) {
              const errorData = await response.json().catch(() => null)
              throw new Error(errorData?.detail || `Bulk entry box not found (${response.status})`)
            }

            const data = await response.json()
            const fetchedBox = data.box

            boxData = {
              ...qrData,
              item_description: fetchedBox.item_description || fetchedBox.article_description,
              sku_id: fetchedBox.sku_id,
              material_type: fetchedBox.material_type || 'RM',
              item_category: fetchedBox.item_category || '',
              sub_category: fetchedBox.sub_category || '',
              net_weight: fetchedBox.net_weight,
              gross_weight: fetchedBox.gross_weight,
              lot_number: fetchedBox.lot_number,
              batch_number: fetchedBox.batch_number || '',
              uom: fetchedBox.uom || 'BAG',
              box_number: fetchedBox.box_number,
              box_id: fetchedBox.box_id || qrBoxId,
            }
          } catch (fetchError: any) {
            console.error('❌ Failed to fetch bulk entry box:', fetchError)
            toast({
              title: "Bulk Entry Box Lookup Failed",
              description: fetchError.message || "Could not find box with scanned QR data",
              variant: "destructive",
            })
          }
        }
        // OLD FORMAT: If transaction starts with TX or CONS, fetch data from backend
        else if (transactionNo.startsWith('TX') || transactionNo.startsWith('CONS')) {
          try {
            const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/inward/${company}/${encodeURIComponent(transactionNo)}`
            
            const response = await fetch(apiUrl)
            if (!response.ok) {
              throw new Error(`Failed to fetch transaction: ${response.statusText}`)
            }
            
            const fetchedData = await response.json()
            
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
              }
              
              // If still no match, try matching by item_description from QR
              if (!matchingArticle && qrData.item_description) {
                matchingArticle = fetchedData.articles.find((article: any) => 
                  article.item_description === qrData.item_description
                )
              }
              
            }

            // Merge data from API with QR data
            if (matchingBox || matchingArticle) {
              boxData = {
                ...qrData,
                item_description: matchingBox?.item_description || matchingBox?.article_description || matchingArticle?.item_description || qrData.item_description,
                sku_id: matchingBox?.sku_id || matchingArticle?.sku_id || qrData.sku_id,
                material_type: matchingArticle?.material_type || matchingBox?.material_type || qrData.material_type,
                item_category: matchingArticle?.item_category || matchingBox?.item_category || qrData.item_category,
                sub_category: matchingArticle?.sub_category || matchingBox?.sub_category || qrData.sub_category,
                net_weight: matchingBox?.net_weight || qrData.net_weight,
                gross_weight: matchingBox?.gross_weight || qrData.gross_weight,
                batch_number: matchingBox?.batch_number || qrData.batch_number,
                lot_number: matchingBox?.lot_number || qrData.lot_number,
                uom: matchingArticle?.uom || matchingBox?.uom || qrData.uom,
                manufacturing_date: matchingBox?.manufacturing_date || qrData.manufacturing_date,
                expiry_date: matchingBox?.expiry_date || qrData.expiry_date,
                quantity_units: matchingBox?.quantity_units || qrData.quantity_units,
                packaging_type: matchingBox?.packaging_type || qrData.packaging_type,
                quality_grade: matchingBox?.quality_grade || qrData.quality_grade,
                box_number: matchingBox?.box_number || qrData.box_number,
                box_id: matchingBox?.box_id || qrData.box_id,
              }
            }
          } catch (fetchError) {
            console.error('❌ Failed to fetch transaction data:', fetchError)
            // Continue with QR data even if API call fails
          }
        }

        const uniqueId = boxIdCounterRef.current
        boxIdCounterRef.current += 1 // Increment for next box

        const materialType = boxData.material_type || ''
        const netWeightRaw = parseFloat(boxData.net_weight || 0)
        const grossWeightRaw = parseFloat(boxData.gross_weight || 0)

        const newBox = {
          id: uniqueId,
          boxNumber: uniqueId,
          boxId: boxData.box_id || boxData.bi || 'N/A',
          itemDescription: boxData.item_description || boxData.article_description || 'N/A',
          skuId: boxData.sku_id || boxData.sk || null,
          transactionNo: boxData.transaction_no || boxData.cn || boxData.tx || 'N/A',
          boxNumberInArray: boxData.box_number || boxData.bx || 0,
          materialType: materialType || 'N/A',
          itemCategory: boxData.item_category || 'N/A',
          subCategory: boxData.sub_category || 'N/A',
          netWeight: String(netWeightRaw),
          totalWeight: String(grossWeightRaw),
          batchNumber: boxData.batch_number || 'N/A',
          lotNumber: boxData.lot_number || 'N/A',
          manufacturingDate: boxData.manufacturing_date || 'N/A',
          expiryDate: boxData.expiry_date || 'N/A',
          packagingType: boxData.packaging_type || 'N/A',
          quantityUnits: boxData.quantity_units || 'N/A',
          uom: boxData.uom || 'N/A',
          itemCode: 'N/A',
          hsnCode: 'N/A',
          qualityGrade: boxData.quality_grade || 'N/A',
          scannedAt: new Date().toLocaleTimeString(),
          rawData: boxData,
        }

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
      
      // Check if it looks like a box ID (starts with CONS or TR)
      if (decodedText.startsWith('CONS') || decodedText.startsWith('TR')) {
        const uniqueId = boxIdCounterRef.current
        boxIdCounterRef.current += 1 // Increment for next box
        
        const newBox = {
          id: uniqueId,
          boxNumber: uniqueId,
          boxId: 'N/A',
          itemDescription: 'N/A',
          skuId: null,
          transactionNo: decodedText,
          boxNumberInArray: 0,
          materialType: 'N/A',
          itemCategory: 'N/A',
          subCategory: 'N/A',
          netWeight: '0',
          totalWeight: '0',
          batchNumber: 'N/A',
          lotNumber: 'N/A',
          manufacturingDate: 'N/A',
          expiryDate: 'N/A',
          packagingType: 'N/A',
          quantityUnits: 'N/A',
          uom: 'N/A',
          itemCode: 'N/A',
          hsnCode: 'N/A',
          qualityGrade: 'N/A',
          scannedAt: new Date().toLocaleTimeString(),
          rawData: { transaction_no: decodedText },
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


    // Validation - collect all errors
    const errors: string[] = []

    // Header Validation (no request_no needed for direct transfer)
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

    // Articles List Validation (from scannedBoxes - manually added articles)
    if (scannedBoxes.length === 0) {
      errors.push('At least one article must be added to the list. Use "Add to Articles List" button.')
    }

    // Net weight must be <= total weight (gross) for each box
    scannedBoxes.forEach((box, index) => {
      const net = parseFloat(box.netWeight || '0')
      const gross = parseFloat(box.totalWeight || '0')
      if (net > gross && gross > 0) {
        errors.push(`Box ${index + 1} (${box.itemDescription || 'N/A'}): Net weight (${net}) must be ≤ Total/Gross weight (${gross})`)
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

    // If there are validation errors, show toast and stop
    if (errors.length > 0) {
      console.error('❌ Validation Failed:', errors)
      toast({
        title: `Validation Error (${errors.length})`,
        description: errors.join(" • "),
        variant: "destructive",
      })
      return
    }
    
    // Prepare payload
    
    // Get driver name and approval authority
    const driverName = transferInfo.driverName === "other" ? transferInfo.driverNameOther : transferInfo.driverName
    const approvalAuthority = transferInfo.approvalAuthorityOther
    
    
    // Helper to clean 'N/A' values from scannedBoxes entries
    const clean = (val: any) => (val && val !== 'N/A') ? val : ""
    const cleanNull = (val: any) => (val && val !== 'N/A') ? val : null

    // Build lines from scannedBoxes (manually added articles)
    // net_weight and total_weight are already in Kg (converted at add time)
    const lines = scannedBoxes.map((box) => ({
      material_type: clean(box.materialType),
      item_category: clean(box.itemCategory),
      sub_category: clean(box.subCategory),
      item_description: clean(box.itemDescription),
      quantity: String(box.quantityUnits && box.quantityUnits !== 'N/A' ? box.quantityUnits : 0),
      uom: clean(box.uom),
      pack_size: String(clean(box.packagingType)),
      unit_pack_size: box.packageSize ? String(clean(box.packageSize)) : null,
      net_weight: String(box.netWeight || 0),
      total_weight: String(box.totalWeight || 0),
      batch_number: cleanNull(box.batchNumber),
      lot_number: cleanNull(box.lotNumber)
    }))

    // Only include boxes that were actually QR-scanned (not manually added via "Add to Articles List")
    console.log('🔍 [DEBUG] Filtering scanned boxes:', {
      totalScannedBoxes: scannedBoxes.length,
      boxesWithTransactionNo: scannedBoxes.filter(b => b.transactionNo && b.transactionNo !== 'DIRECT').length,
      boxesWithDirect: scannedBoxes.filter(b => b.transactionNo === 'DIRECT').length,
      sampleBoxes: scannedBoxes.slice(0, 3).map(b => ({
        boxId: b.boxId,
        transactionNo: b.transactionNo,
        itemDescription: b.itemDescription
      }))
    })

    const qrScannedBoxes = scannedBoxes.filter((box) => box.transactionNo !== 'DIRECT')

    console.log('📦 [DEBUG] Boxes after filtering (transactionNo !== DIRECT):', {
      count: qrScannedBoxes.length,
      boxes: qrScannedBoxes.map(b => ({
        boxId: b.boxId,
        transactionNo: b.transactionNo,
        itemDescription: b.itemDescription
      }))
    })

    const boxes = qrScannedBoxes.map((box) => {
      const netVal = parseFloat(box.netWeight) || 0
      const grossVal = parseFloat(box.totalWeight) || 0
      return {
        box_number: box.boxNumber,
        box_id: box.boxId || "",
        article: box.itemDescription || "Unknown Article",
        lot_number: box.lotNumber || "",
        batch_number: box.batchNumber || "",
        transaction_no: box.transactionNo || "",
        net_weight: String(Number(netVal.toFixed(3))),
        gross_weight: String(Number(grossVal.toFixed(3)))
      }
    })

    console.log('📤 [DEBUG] Final boxes payload being sent to API:', {
      count: boxes.length,
      boxes: boxes.map(b => ({
        box_id: b.box_id,
        transaction_no: b.transaction_no,
        article: b.article
      }))
    })

    const payload = {
      header: {
        challan_no: transferNo,
        stock_trf_date: formData.requestDate,
        from_warehouse: formData.fromWarehouse,
        to_warehouse: formData.toWarehouse,
        vehicle_no: transferInfo.vehicleNumber === "other" ? transferInfo.vehicleNumberOther : transferInfo.vehicleNumber,
        driver_name: driverName || null,
        approved_by: approvalAuthority && approvalAuthority.trim() !== "" ? approvalAuthority : null,
        remark: formData.reasonDescription || formData.reason,
        reason_code: formData.reason,
        is_xbond: false,
        new_lot_number: null
      },
      lines,
      boxes,
      request_id: null  // Direct transfer - no request
    }

    
    // Debug: Log scanned boxes details
    if (payload.boxes.length > 0) {
      payload.boxes.forEach((box, index) => {
      })
    } else {
    }
    
    // Debug: Log the actual article values being sent
    payload.lines.forEach((line, index) => {
    })

    try {

      let response
      if (isEditMode && editIdFromUrl) {
        response = await InterunitApiService.updateTransfer(Number(editIdFromUrl), payload)
        toast({
          title: "Transfer Updated Successfully",
          description: `Transfer ${payload.header.challan_no} has been updated`,
        })
      } else {
        response = await InterunitApiService.submitTransfer(company, payload, user?.name || user?.email || 'unknown')
        toast({
          title: "Transfer Submitted Successfully",
          description: `Transfer ${payload.header.challan_no} has been created successfully`,
        })
      }


      // Clear saved draft after successful submission
      clearSavedData()

      // Check if Savla/Rishi cold is involved — show summary popup
      const fromWh = formData.fromWarehouse
      const toWh = formData.toWarehouse
      const isColdInvolved = COLD_STORAGE_WAREHOUSES.some(w => w === fromWh || w === toWh)

      if (isColdInvolved) {
        const vehicleNo = transferInfo.vehicleNumber === "other" ? transferInfo.vehicleNumberOther : transferInfo.vehicleNumber
        // Build per-item summary from scannedBoxes grouped by description
        const itemMap: Record<string, { description: string; subCategory: string; boxes: number; lotNumber: string; itemMark: string }> = {}
        scannedBoxes.forEach((box) => {
          const key = `${box.itemDescription || ""}_${box.lotNumber || ""}`
          if (!itemMap[key]) {
            // Try to find item_mark from articles (cold storage data)
            const matchedArticle = articles.find(a => a.item_description === box.itemDescription)
            itemMap[key] = {
              description: box.itemDescription || "-",
              subCategory: box.subCategory || matchedArticle?.sub_category || "-",
              boxes: 0,
              lotNumber: box.lotNumber || "-",
              itemMark: matchedArticle?.cs_item_mark || "-",
            }
          }
          itemMap[key].boxes += 1
        })

        const summaryLines = Object.values(itemMap).map((item) =>
          `Item Mark : ${item.itemMark}\nNo of Boxes : ${item.boxes}\nLot Number : ${item.lotNumber}`
        )
        summaryLines.push(`From : ${fromWh || "-"}\nTo : ${toWh || "-"}`)
        summaryLines.push(`Vehicle Number : ${vehicleNo || "-"}`)
        const message = summaryLines.join("\n\n")
        setColdTransferPopup({ open: true, message })
      } else {
        // No cold storage — redirect immediately
        setTimeout(() => {
          router.push(`/${company}/transfer`)
        }, 1500)
      }

    } catch (error: any) {
      console.error('Transfer form submission failed:', error)

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
            {isEditMode ? "Edit Transfer OUT" : "Transfer OUT"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Transfer No: <span className="font-medium">{transferNo}</span></p>
        </div>
      </div>

      {/* Loading overlay for edit mode */}
      {editLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mr-3" />
          <span className="text-lg text-gray-600">Loading transfer data...</span>
        </div>
      )}

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
              <Label htmlFor="requestDate" className="text-xs font-medium text-gray-600">Manual Transfer Date *
              </Label>
              <Input
                id="requestDate"
                type="text"
                value={formData.requestDate}
                readOnly
                className="h-9 bg-gray-50 border-gray-200 text-gray-700 cursor-not-allowed"
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
                  <SelectItem value="Rishi cold">Rishi cold</SelectItem>
                  <SelectItem value="Savla D-39 cold">Savla D-39 cold</SelectItem>
                  <SelectItem value="Savla D-514 cold">Savla D-514 cold</SelectItem>

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

                  <SelectItem value="Rishi cold">Rishi cold</SelectItem>

                  <SelectItem value="Savla D-39 cold">Savla D-39 cold</SelectItem>

                  <SelectItem value="Savla D-514 cold">Savla D-514 cold</SelectItem>

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

      {/* QR Scanner + Manual Box Entry Section */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <CardTitle className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Scan QR Code
          </CardTitle>
          <p className="text-xs text-white/80">
            Scan boxes with camera or enter box details manually
          </p>
        </CardHeader>
        <CardContent className="p-3 sm:p-5">
          {!showScanner ? (
            <div className="py-4 sm:py-6 text-center">
              <Button
                type="button"
                onClick={() => setShowScanner(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-6 w-full sm:w-auto"
              >
                <Camera className="h-4 w-4 mr-2" /> Start Camera Scan
              </Button>
              <p className="text-xs text-gray-500 mt-3">
                Uses native API for instant detection
              </p>
            </div>
          ) : (
            <div className="py-2 sm:py-4">
              <div className="w-full max-w-2xl mx-auto rounded-lg overflow-hidden">
                <HighPerformanceQRScanner
                  onScanSuccess={handleQRScanSuccess}
                  onScanError={handleQRScanError}
                  onClose={() => setShowScanner(false)}
                />
              </div>
            </div>
          )}

          {/* OR Divider */}
          <div className="flex items-center gap-3 my-3 sm:my-4">
            <div className="flex-1 border-t border-gray-300" />
            <span className="text-xs font-semibold text-gray-500 uppercase">OR</span>
            <div className="flex-1 border-t border-gray-300" />
          </div>

          {/* Manual Box Entry */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-600" />
              Manual Box Entry
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Box Number *</Label>
                <Input
                  type="number"
                  placeholder="Enter Box Number"
                  value={manualBoxId}
                  onChange={(e) => setManualBoxId(e.target.value)}
                  className="h-9 bg-white border-gray-200"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      document.getElementById('manual-txn-input')?.focus()
                    }
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Transaction No *</Label>
                <Input
                  id="manual-txn-input"
                  placeholder="Enter Transaction No"
                  value={manualTransactionNo}
                  onChange={(e) => setManualTransactionNo(e.target.value)}
                  className="h-9 bg-white border-gray-200"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleManualBoxFetch()
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                onClick={handleManualBoxFetch}
                disabled={manualBoxLoading || !manualBoxId.trim() || !manualTransactionNo.trim()}
                className="h-10 sm:h-9 px-5 bg-green-600 hover:bg-green-700 text-white text-sm w-full sm:w-auto"
              >
                {manualBoxLoading ? (
                  <><Clock className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Fetching...</>
                ) : (
                  <><Plus className="h-3.5 w-3.5 mr-1.5" /> Fetch Box</>
                )}
              </Button>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              Enter Box Number and Transaction No to fetch box details from inventory
            </p>
          </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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
            return (
            <div key={article.id} className="border rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Article Entry</h4>
                <div className="flex items-center gap-2">
                  {isColdStorageFrom && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const currentMode = articleEntryMode[article.id] || "cold-storage"
                        const newMode = currentMode === "cold-storage" ? "regular" : "cold-storage"
                        setArticleEntryMode(prev => ({
                          ...prev,
                          [article.id]: newMode
                        }))
                        // Reset cold storage fields when switching to regular mode so auto-calc works
                        if (newMode === "regular") {
                          setArticles(prev => prev.map(a => a.id === article.id ? {
                            ...a,
                            cs_max_boxes: null,
                            cs_box_id: null,
                            cs_transaction_no: null,
                            cs_inward_no: null,
                            cs_total_inventory_kgs: null,
                            cs_item_mark: null,
                            packaging_type: 0,
                            net_weight: 0,
                          } : a))
                        }
                      }}
                      className="text-xs gap-1.5 h-7 px-2.5 border-blue-200 text-blue-700 hover:bg-blue-50"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      {(articleEntryMode[article.id] || "cold-storage") === "cold-storage"
                        ? "Switch to Manual Entry"
                        : "Switch to Cold Storage"}
                    </Button>
                  )}
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

              {/* Conditional: Cold Storage Stock Search OR Regular Article Form */}
              {isColdStorageFrom && (articleEntryMode[article.id] || "cold-storage") === "cold-storage" ? (
                <>
                  {/* Cold Storage Stock Search */}
                  <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-3">
                    <ColdStorageStockSearch
                      onSelect={(record) => handleSelectColdStorageStock(article.id, record)}
                      company={company}
                    />
                  </div>

                  {/* Auto-filled fields from cold storage stock selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Item Category</Label>
                      <Input
                        value={article.item_category}
                        readOnly
                        placeholder="Auto-filled from stock selection"
                        className="bg-muted"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Item Description</Label>
                      <Input
                        value={article.item_description}
                        readOnly
                        placeholder="Auto-filled from stock selection"
                        className="bg-muted"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Weight (kg)</Label>
                      <Input
                        value={article.net_weight || ""}
                        readOnly
                        placeholder="Auto-filled"
                        className="bg-muted"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Total Weight (kgs)</Label>
                      <Input
                        value={
                          article.quantity_units && article.net_weight
                            ? (article.quantity_units * article.net_weight).toFixed(2)
                            : ""
                        }
                        readOnly
                        placeholder="Auto-calculated"
                        className="bg-muted"
                      />
                    </div>
                  </div>

                  {/* Editable fields: No. of Boxes, UOM, Lot Number */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">No. of Boxes/Cartons *</Label>
                      <Input
                        type="number"
                        min="1"
                        max={article.cs_max_boxes ?? undefined}
                        value={article.quantity_units || ""}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0
                          if (article.cs_max_boxes !== null && val > article.cs_max_boxes) {
                            toast({ title: "Limit Exceeded", description: `Maximum available boxes: ${article.cs_max_boxes}`, variant: "destructive" })
                            updateArticle(article.id, "quantity_units", article.cs_max_boxes)
                          } else {
                            updateArticle(article.id, "quantity_units", val)
                          }
                        }}
                        placeholder="Enter count"
                      />
                      {article.cs_max_boxes !== null && (
                        <p className="text-[10px] text-muted-foreground">Available: {article.cs_max_boxes} boxes</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">UOM *</Label>
                      <Select value={article.uom} onValueChange={(value) => updateArticle(article.id, "uom", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select UOM" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BOX">BOX</SelectItem>
                          <SelectItem value="CARTON">CARTON</SelectItem>
                          <SelectItem value="BAG">BAG</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Lot Number *</Label>
                      <Input
                        value={article.lot_number}
                        onChange={(e) => updateArticle(article.id, "lot_number", e.target.value)}
                        placeholder="Enter lot number"
                      />
                    </div>
                  </div>

                  {/* Add to List Button */}
                  <div className="flex justify-end pt-2 border-t border-gray-100">
                    <Button
                      type="button"
                      onClick={() => handleAddArticleToList(article)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 sm:h-9 px-5 text-xs sm:text-sm w-full sm:w-auto"
                    >
                      <Plus className="mr-2 h-3.5 w-3.5" />
                      Add to Articles List
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Quick Item Search */}
                  <div className="relative">
                    <Label className="text-xs font-medium text-gray-600 mb-1 block">Quick Search Item</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Type item name to search..."
                        value={itemSearchQuery[article.id] || ""}
                        onChange={(e) => handleItemSearch(article.id, e.target.value)}
                        onFocus={() => {
                          if (itemSearchResults[article.id]?.length > 0) {
                            setItemSearchOpen(prev => ({ ...prev, [article.id]: true }))
                          }
                        }}
                        onBlur={() => {
                          // Delay close so click on result can fire first
                          setTimeout(() => setItemSearchOpen(prev => ({ ...prev, [article.id]: false })), 200)
                        }}
                        className="pl-9 h-9 text-sm border-violet-200 focus:border-violet-400 focus:ring-violet-400"
                      />
                      {itemSearchLoading[article.id] && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="h-4 w-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    {/* Search Results Dropdown */}
                    {itemSearchOpen[article.id] && itemSearchResults[article.id]?.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {itemSearchResults[article.id].map((item, i) => (
                          <button
                            key={`${item.id}-${i}`}
                            type="button"
                            className="w-full text-left px-3 py-2.5 hover:bg-violet-50 border-b border-gray-50 last:border-b-0 transition-colors"
                            onMouseDown={(e) => { e.preventDefault(); handleItemSelect(article.id, item) }}
                          >
                            <div className="text-sm font-medium text-gray-800">{item.item_description}</div>
                            <div className="flex gap-2 mt-0.5">
                              {item.material_type && (
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{item.material_type}</span>
                              )}
                              {item.group && (
                                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{item.group}</span>
                              )}
                              {item.sub_group && (
                                <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{item.sub_group}</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {itemSearchOpen[article.id] && itemSearchQuery[article.id]?.length >= 2 && !itemSearchLoading[article.id] && itemSearchResults[article.id]?.length === 0 && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-3 text-sm text-gray-500 text-center">
                        No items found
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {/* Material Type */}
                    <div className="space-y-1">
                      <Label htmlFor={`material_type_${article.id}`}>Material Type *</Label>
                      <MaterialTypeDropdown
                        value={article.material_type}
                        onValueChange={(value) => {
                          updateArticle(article.id, "material_type", value)
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
                        onValueChange={() => {}}
                        company={company}
                        updateArticle={updateArticle}
                        disabled={!article.material_type || !article.item_category || !article.sub_category || !!(requestIdFromUrl && index === 0)}
                      />
                      {requestIdFromUrl && index === 0 && (
                        <p className="text-xs text-gray-500 mt-1">🔒 Loaded from request</p>
                      )}
                    </div>

                    {/* Package Size */}
                    <div className="space-y-1">
                      <Label htmlFor={`unit_pack_size_${article.id}`}>Unit Pack Size</Label>
                      <Input
                        id={`unit_pack_size_${article.id}`}
                        type="number"
                        step="any"
                        min="0"
                        value={article.unit_pack_size || ""}
                        onChange={(e) => updateArticle(article.id, "unit_pack_size", parseFloat(e.target.value) || 0)}
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder="0"
                      />
                    </div>

                    {/* UOM */}
                    <div className="space-y-1">
                      <Label htmlFor={`uom_${article.id}`}>UOM</Label>
                      <Select
                        value={article.uom}
                        onValueChange={(value) => updateArticle(article.id, "uom", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select UOM" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BOX">BOX</SelectItem>
                          <SelectItem value="BAG">BAG</SelectItem>
                          <SelectItem value="CARTON">CARTON</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Pack Size - label changes based on material type */}
                    <div className="space-y-1">
                      <Label htmlFor={`packaging_type_${article.id}`}>
                        Case Pack/Box Wt.
                      </Label>
                      <Input
                        id={`packaging_type_${article.id}`}
                        type="number"
                        step="any"
                        min="0"
                        value={article.packaging_type || ""}
                        onChange={(e) => updateArticle(article.id, "packaging_type", parseFloat(e.target.value) || 0)}
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder="0.00"
                      />
                    </div>

                    {/* Quantity (Units) */}
                    <div className="space-y-1">
                      <Label htmlFor={`quantity_units_${article.id}`}>Quantity (Box/Bags)</Label>
                      <Input
                        id={`quantity_units_${article.id}`}
                        type="text"
                        value={article.quantity_units || ""}
                        onChange={(e) => updateArticle(article.id, "quantity_units", Number(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>

                    {/* Net Weight - auto-calculated in Kg */}
                    <div className="space-y-1">
                      <Label htmlFor={`net_weight_${article.id}`}>
                        Net Weight (Kg)
                      </Label>
                      <Input
                        id={`net_weight_${article.id}`}
                        type="number"
                        step="any"
                        min="0"
                        value={article.net_weight || ""}
                        onChange={(e) => updateArticle(article.id, "net_weight", parseFloat(e.target.value) || 0)}
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder="Auto-calculated"
                        className={article.total_weight > 0 && article.net_weight > article.total_weight ? "border-red-500" : ""}
                      />
                      {article.total_weight > 0 && article.net_weight > article.total_weight && (
                        <p className="text-xs text-red-500">Net weight must be ≤ gross weight</p>
                      )}
                    </div>

                    {/* Total Weight (Gross Weight) - always in Kg */}
                    <div className="space-y-1">
                      <Label htmlFor={`total_weight_${article.id}`}>
                        Total Wt (Kg) <span className="text-gray-400 font-normal">(Gross)</span>
                      </Label>
                      <Input
                        id={`total_weight_${article.id}`}
                        type="number"
                        step="any"
                        min="0"
                        value={article.total_weight || ""}
                        onChange={(e) => updateArticle(article.id, "total_weight", parseFloat(e.target.value) || 0)}
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder="Enter gross weight"
                        className={article.total_weight > 0 && article.net_weight > article.total_weight ? "border-red-500" : ""}
                      />
                    </div>

                    {/* Lot Number (Optional) */}
                    <div className="space-y-1">
                      <Label htmlFor={`lot_number_${article.id}`}>
                        Lot Number <span className="text-gray-400 font-normal">(Optional)</span>
                      </Label>
                      <Input
                        id={`lot_number_${article.id}`}
                        type="text"
                        value={article.lot_number}
                        onChange={(e) => updateArticle(article.id, "lot_number", e.target.value)}
                        placeholder="Enter lot number"
                      />
                    </div>
                  </div>

                  {/* Add to List Button */}
                  <div className="flex justify-end pt-2 border-t border-gray-100">
                    <Button
                      type="button"
                      onClick={() => handleAddArticleToList(article)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 sm:h-9 px-5 text-xs sm:text-sm w-full sm:w-auto"
                    >
                      <Plus className="mr-2 h-3.5 w-3.5" />
                      Add to Articles List
                    </Button>
                  </div>
                </>
              )}
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
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 sm:px-3 py-1 rounded-full">
                              Item #{index + 1}
                            </span>
                            <span className="text-xs font-semibold text-white bg-gray-600 px-2 sm:px-3 py-1 rounded-full">
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
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs mt-3 pt-2 border-t border-gray-200">
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
                            <span className="text-gray-500">Pack units:</span>
                            <span className="ml-1 text-gray-700 font-medium">{item.pack_size}</span>
                          </div>
                          {item.unit_pack_size && (
                            <div>
                              <span className="text-gray-500">Unit Pack Size:</span>
                              <span className="ml-1 text-gray-700 font-medium">{item.unit_pack_size}</span>
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
          <CardHeader className="pb-3 bg-gray-50 px-3 sm:px-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <CardTitle className="text-sm sm:text-base font-semibold text-gray-800 flex items-center">
                    <Package className="h-4 w-4 mr-2" />
                    Scanned Boxes ({scannedBoxes.length}) or Articles list
                  </CardTitle>
                  {(articles[0]?.quantity_units || 0) > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                      <div className="hidden sm:block h-5 w-px bg-gray-300"></div>
                      <span className="text-gray-600">Qty:</span>
                      <span className="font-semibold text-gray-800">{articles[0]?.quantity_units}</span>
                      {articles[0]?.item_description && (
                        <>
                          <span className="hidden sm:inline text-gray-400">•</span>
                          <span className="text-gray-700 font-medium truncate max-w-[150px] sm:max-w-[300px]" title={articles[0]?.item_description}>
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
                  onClick={() => { setScannedBoxes([]); boxIdCounterRef.current = 1 }}
                  className="h-7 px-3 text-xs w-full sm:w-auto"
                >
                  Clear All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 bg-white px-3 sm:px-5">
            {scannedBoxes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Package className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-700">No articles added yet</p>
                <p className="text-xs text-gray-500 mt-1">
                  Fill in article details above and click "Add to Articles List", or scan QR codes
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {scannedBoxes.map((box, index) => (
                    <div key={box.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                            Box #{index + 1}
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
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <div>
                            <span className="text-gray-500 block mb-0.5">Unit Pack Size</span>
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              value={box.packagingType || ""}
                              onChange={(e) => updateScannedBox(box.id, "packagingType", e.target.value)}
                              onWheel={(e) => e.currentTarget.blur()}
                              className="h-7 text-xs px-1"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <span className="text-gray-500 block mb-0.5">Net Wt</span>
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              value={box.netWeight || ""}
                              onChange={(e) => updateScannedBox(box.id, "netWeight", e.target.value)}
                              onWheel={(e) => e.currentTarget.blur()}
                              className="h-7 text-xs px-1"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <span className="text-gray-500 block mb-0.5">Total Wt</span>
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              value={box.totalWeight || ""}
                              onChange={(e) => updateScannedBox(box.id, "totalWeight", e.target.value)}
                              onWheel={(e) => e.currentTarget.blur()}
                              className="h-7 text-xs px-1"
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Lot:</span>
                          <span className="ml-1 text-gray-700 font-mono">{box.lotNumber !== 'N/A' ? box.lotNumber : '-'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Transaction:</span>
                          <span className="ml-1 text-gray-800 font-mono font-medium">{box.transactionNo || 'N/A'}</span>
                        </div>
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
                        <th className="text-left py-2 px-2 text-xs font-medium text-gray-700">Unit Pack Size</th>
                        <th className="text-left py-2 px-2 text-xs font-medium text-gray-700">Net Wt</th>
                        <th className="text-left py-2 px-2 text-xs font-medium text-gray-700">Total Wt</th>
                        <th className="text-left py-2 px-2 text-xs font-medium text-gray-700">Lot No</th>
                        <th className="text-left py-2 px-2 text-xs font-medium text-gray-700">Transaction No</th>
                        <th className="text-center py-2 px-2 text-xs font-medium text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scannedBoxes.map((box, index) => (
                        <tr key={box.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-2 text-xs text-gray-800 font-medium">
                            #{index + 1}
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
                          <td className="py-2 px-1">
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              value={box.packagingType || ""}
                              onChange={(e) => updateScannedBox(box.id, "packagingType", e.target.value)}
                              onWheel={(e) => e.currentTarget.blur()}
                              className="h-7 w-20 text-xs px-1"
                              placeholder="0"
                            />
                          </td>
                          <td className="py-2 px-1">
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              value={box.netWeight || ""}
                              onChange={(e) => updateScannedBox(box.id, "netWeight", e.target.value)}
                              onWheel={(e) => e.currentTarget.blur()}
                              className="h-7 w-20 text-xs px-1"
                              placeholder="0"
                            />
                          </td>
                          <td className="py-2 px-1">
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              value={box.totalWeight || ""}
                              onChange={(e) => updateScannedBox(box.id, "totalWeight", e.target.value)}
                              onWheel={(e) => e.currentTarget.blur()}
                              className="h-7 w-20 text-xs px-1"
                              placeholder="0"
                            />
                          </td>
                          <td className="py-2 px-2 text-xs">
                            <span className="font-mono text-gray-700">
                              {box.lotNumber !== 'N/A' ? box.lotNumber : '-'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-xs">
                            <span className="font-mono text-gray-800 font-medium">
                              {box.transactionNo || 'N/A'}
                            </span>
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4 text-center">
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
                        {scannedBoxes.reduce((sum, box) => sum + parseFloat(box.netWeight || '0'), 0).toFixed(3)} kg
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Total Wt</p>
                      <p className="text-base sm:text-lg font-bold text-gray-800">
                        {scannedBoxes.reduce((sum, box) => sum + parseFloat(box.totalWeight || '0'), 0).toFixed(3)} kg
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Submit Section */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Transfer will be submitted with <span className="font-semibold text-yellow-700">Dispatch</span> status
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
                  disabled={scannedBoxes.length === 0}
                  className="h-10 sm:h-9 px-5 text-sm bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                  <Send className="mr-2 h-4 w-4" />
                  {isEditMode ? "Update Transfer" : "Submit Transfer"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>

    {/* Cold Transfer Summary Popup */}
    <Dialog open={coldTransferPopup.open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Transfer Summary</DialogTitle>
        </DialogHeader>
        <div className="relative bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap font-mono leading-relaxed">
          <button
            type="button"
            className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-gray-200 transition-colors"
            onClick={() => {
              navigator.clipboard.writeText(coldTransferPopup.message)
              setPopupCopied(true)
              setTimeout(() => setPopupCopied(false), 2000)
            }}
          >
            {popupCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-500" />}
          </button>
          {coldTransferPopup.message}
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={() => {
              setColdTransferPopup({ open: false, message: "" })
              router.push(`/${company}/transfer`)
            }}
          >
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    </form>
  )
}
  
