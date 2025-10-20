"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SimpleDropdown } from "@/components/ui/simple-dropdown"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { useItemDescriptions, useItemCategories, useSubCategories } from "@/lib/hooks/useDropdownData"

// Global Item Search API
interface GlobalItem {
  id: number
  item_description: string
  item_category: string
  sub_category: string
}

interface GlobalSearchResponse {
  company: string
  items: GlobalItem[]
  meta: {
    total_items: number
    limit: number
    offset: number
    search: string | null
    has_more: boolean
  }
}

const fetchGlobalItems = async (company: Company, search?: string): Promise<GlobalItem[]> => {
  try {
    const query = new URLSearchParams()
    query.append('company', company)
    
    // Only add search parameter if there's a search term
    if (search && search.trim()) {
      query.append('search', search.trim())
    }
    
    // Add pagination parameters to fetch all items
    query.append('limit', '9999')
    query.append('offset', '0')
    
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/api/sku/global-search?${query.toString()}`
    console.log("Global Search API URL:", apiUrl)
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error("API Error Response:", errorText)
      throw new Error(`Global search API call failed: ${response.status} ${response.statusText}`)
    }
    
    const data: GlobalSearchResponse = await response.json()
    console.log("Global Search API Response:", data)
    
    return data.items || []
  } catch (error) {
    console.error("Error fetching global items:", error)
    return []
  }
}
import { Plus, Save, Trash2, Package, Box as BoxIcon, X, AlertCircle, CheckCircle, XCircle, ArrowLeft, Loader2, Printer, FileJson } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { dropdownApi, type Company } from "@/lib/api"
import { getOutwardDetail, submitApprovalWithArticles, getOutwardApproval } from "@/lib/api/outwardApiService"
import type { OutwardDetailResponse } from "@/types/outward"
import Link from "next/link"
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface ApprovalPageProps {
  params: {
    company: string
    id: string
  }
}

// Article interface matching outward form
interface Article {
  id: string
  sku_id?: number | null
  material_type: string // RM/PM/FG
  item_category: string
  sub_category: string
  item_description: string
  quantity_units: number
  pack_size_gm: number
  no_of_packets: number
  uom: string
  net_weight: number
  total_weight: number
  batch_number: string
  unit_rate: number
}

// Box interface matching outward form
interface Box {
  id: string
  box_number: number
  article: string
  net_weight: number
  gross_weight: number
  lot_number?: string
}

// Material Type dropdown component (matches inward and transfer modules)
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
        const data = await dropdownApi.fetchDropdown({
          company,
          limit: 1000
        })

        // Extract material types from the API response
        if (data.options && data.options.material_types && Array.isArray(data.options.material_types)) {
          const materialTypeOptions = data.options.material_types.map((type: string) => ({
            value: type,
            label: type
          }))
          setOptions(materialTypeOptions)
        } else {
          // Fallback to hardcoded values if API doesn't return material_types
          const fallbackOptions = [
            { value: "RM", label: "RM - Raw Material" },
            { value: "PM", label: "PM - Packing Material" },
            { value: "FG", label: "FG - Finished Goods" }
          ]
          setOptions(fallbackOptions)
        }
      } catch (error) {
        console.error("Error fetching material types:", error)
        setErrorState("Failed to load material types")
        // Set fallback options on error
        setOptions([
          { value: "RM", label: "RM - Raw Material" },
          { value: "PM", label: "PM - Packing Material" },
          { value: "FG", label: "FG - Finished Goods" }
        ])
      } finally {
        setLoading(false)
      }
    }

    fetchMaterialTypes()
  }, [company])

  return (
    <SearchableSelect
      value={value}
      onValueChange={onValueChange}
      placeholder={loading ? "Loading..." : "Select material type..."}
      searchPlaceholder="Search material type..."
      options={options}
      loading={loading}
      error={errorState}
      className={error ? "border-red-500" : ""}
    />
  )
}

// Sub-component for Item Category Dropdown
function ItemCategoryDropdown({
  value,
  onValueChange,
  company,
  materialType,
  error,
  disabled
}: {
  value: string
  onValueChange: (value: string) => void
  company: Company
  materialType?: string
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
      disabled={!categoryId}
      className={error ? "border-red-500" : ""}
    />
  )
}

// Sub-component for Item Description Dropdown
function ItemDescriptionDropdown({
  articleId,
  categoryId,
  subCategoryId,
  value,
  onValueChange,
  company,
  error,
  updateArticle,
  materialType
}: {
  articleId: string
  categoryId: string
  subCategoryId: string
  value: string
  onValueChange: (value: string) => void
  company: Company
  error?: string
  updateArticle: (id: string, field: keyof Article, value: any) => void
  materialType?: string
}) {
  const itemDescriptionsHook = useItemDescriptions({
    company,
    material_type: materialType,
    item_category: categoryId,
    sub_category: subCategoryId
  })
  
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
          sub_category: subCategoryId
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
      disabled={false}
      className={error ? "border-red-500" : ""}
    />
  )
}

// Global Item Search Component for Individual Articles
function ArticleItemSearch({ 
  company, 
  articleId,
  onItemSelect 
}: { 
  company: Company
  articleId: string
  onItemSelect: (item: GlobalItem) => void 
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [items, setItems] = useState<GlobalItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedValue, setSelectedValue] = useState("")

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      console.log("🔍 Global search triggered with query:", searchQuery)
      // Always fetch items - either all items (empty search) or filtered items
      setLoading(true)
      setError(null)
      try {
        const results = await fetchGlobalItems(company, searchQuery || undefined)
        console.log("🔍 Global search results:", results.length, "items")
        setItems(results)
      } catch (err) {
        console.error("🔍 Global search error:", err)
        setError(err instanceof Error ? err.message : "Failed to search items")
        setItems([])
      } finally {
        setLoading(false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchQuery, company])

  // Convert items to options format
  const options = items.map(item => ({
    value: item.id.toString(),
    label: `${item.item_description} (${item.item_category} - ${item.sub_category})`,
    item: item
  }))

  const handleSelect = (value: string) => {
    const selectedOption = options.find(opt => opt.value === value)
    if (selectedOption) {
      setSelectedValue(value) // Keep the selected value
      onItemSelect(selectedOption.item)
      setSearchQuery("") // Clear search after selection
    }
  }

  return (
    <div className="border-blue-200 bg-blue-50 p-3 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Package className="h-3 w-3 text-blue-800" />
        <h6 className="text-xs font-medium text-blue-800">Quick Item Search</h6>
      </div>
      <SearchableSelect
        value={selectedValue}
        onValueChange={handleSelect}
        placeholder="Search items..."
        searchPlaceholder="Type to search..."
        options={options}
        loading={loading}
        error={error}
        onSearchChange={setSearchQuery}
      />
      {items.length > 0 && (
        <p className="text-xs text-blue-600 mt-1">
          {items.length} item{items.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}

export default function OutwardApprovalPage({ params }: ApprovalPageProps) {
  const router = useRouter()
  const company = params.company as Company
  const consignmentId = params.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outwardRecord, setOutwardRecord] = useState<OutwardDetailResponse | null>(null)

  // Generate batch number once
  const generateBatchNumber = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    const hour = String(now.getHours()).padStart(2, "0")
    const minute = String(now.getMinutes()).padStart(2, "0")
    const second = String(now.getSeconds()).padStart(2, "0")
    return `BT-${year}${month}${day}${hour}${minute}${second}`
  }

  const [articles, setArticles] = useState<Article[]>([{
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
    batch_number: generateBatchNumber(),
    unit_rate: 0
  }])

  const [boxes, setBoxes] = useState<Box[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [printingBoxes, setPrintingBoxes] = useState<Set<number>>(new Set())
  const [quantityWarnings, setQuantityWarnings] = useState<Record<string, string>>({})

  // Approval fields
  const [approvalAuthority, setApprovalAuthority] = useState("")
  const [approvalDate, setApprovalDate] = useState("")
  const [approvalRemark, setApprovalRemark] = useState("")
  const [approvalStatus, setApprovalStatus] = useState<"approved" | "rejected" | "pending">("pending")

  // JSON Import states
  const [jsonImportOpen, setJsonImportOpen] = useState(false)
  const [jsonInput, setJsonInput] = useState("")
  const [importingJson, setImportingJson] = useState(false)

  // Fetch outward record on mount
  useEffect(() => {
    const fetchOutwardRecord = async () => {
      try {
        setLoading(true)
        setError(null)
        console.log('Fetching outward record:', { company, consignmentId })
        const data = await getOutwardDetail(company, consignmentId)
        console.log('Fetched outward record:', data)
        setOutwardRecord(data)
      } catch (error) {
        console.error("Error fetching outward record:", error)
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch outward record"
        setError(errorMessage)
        toast({
          title: "Error Loading Record",
          description: errorMessage,
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchOutwardRecord()
  }, [company, consignmentId])

  // Pre-populate form if approval already exists
  useEffect(() => {
    if (outwardRecord?.approval) {
      const approval = outwardRecord.approval
      console.log('📝 Pre-populating form with existing approval:', approval)
      
      setApprovalAuthority(approval.approval_authority || "")
      setApprovalDate(approval.approval_date || "")
      setApprovalRemark(approval.remarks || "")
      
      // Map approval status
      if (approval.approval_status === "APPROVED") {
        setApprovalStatus("approved")
      } else if (approval.approval_status === "REJECTED") {
        setApprovalStatus("rejected")
      } else {
        setApprovalStatus("pending")
      }
    }
    
    // Pre-populate articles if they exist
    if (outwardRecord?.articles && outwardRecord.articles.length > 0) {
      console.log('📦 Pre-populating articles from outward record:', outwardRecord.articles)
      const mappedArticles = outwardRecord.articles.map((article, index) => ({
        id: article.id?.toString() || `article-${Date.now()}-${index}`,
        material_type: article.material_type,
        item_category: article.item_category,
        sub_category: article.sub_category,
        item_description: article.item_description,
        sku_id: typeof article.sku_id === 'string' ? parseInt(article.sku_id) : (article.sku_id || 0),
        quantity_units: article.quantity_units,
        uom: article.uom,
        pack_size_gm: article.pack_size_gm,
        no_of_packets: article.no_of_packets,
        net_weight: article.net_weight_gm,
        total_weight: article.gross_weight_gm,
        batch_number: article.batch_number,
        unit_rate: article.unit_rate
      })) as Article[]
      setArticles(mappedArticles)
    }
    
    // Pre-populate boxes if they exist
    if (outwardRecord?.box_details && outwardRecord.box_details.length > 0) {
      console.log('📦 Pre-populating boxes from outward record:', outwardRecord.box_details)
      const mappedBoxes = outwardRecord.box_details.map((box, index) => ({
        id: box.id?.toString() || `box-${Date.now()}-${index}`,
        box_number: box.box_number,
        article: box.article_name,
        lot_number: box.lot_number || "",
        net_weight: box.net_weight_gm,
        gross_weight: box.gross_weight_gm
      }))
      setBoxes(mappedBoxes)
    }
  }, [outwardRecord])

  // Generate boxes matching outward form logic - ONLY for BOX or CARTON UOM
  const generateBoxes = (articlesToUse?: Article[], forceRecalculate: boolean = false) => {
    const articlesForGeneration = articlesToUse || articles
    const newBoxes: Box[] = []
    const today = new Date()
    const dateString = today.getFullYear().toString().slice(-2) +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0')

    articlesForGeneration.forEach((article) => {
      // Generate boxes if UOM is BOX or CARTON (matching outward form)
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

  const addArticle = () => {
    const newBatch = generateBatchNumber()
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
      batch_number: newBatch,
      unit_rate: 0
    }
    const updatedArticles = [...articles, newArticle]
    setArticles(updatedArticles)
    generateBoxes(updatedArticles)
  }

  // updateArticle function matching outward form exactly
  const updateArticle = (id: string, field: keyof Article, value: any) => {
    const updatedArticles = articles.map((article) => {
      if (article.id === id) {
        const updatedArticle = { ...article, [field]: value }

        // Clear dependent fields when parent changes
        if (field === "material_type") {
          updatedArticle.item_category = ""
          updatedArticle.sub_category = ""
          updatedArticle.item_description = ""
          updatedArticle.sku_id = null
        }
        if (field === "item_category") {
          updatedArticle.sub_category = ""
          updatedArticle.item_description = ""
          updatedArticle.sku_id = null
        }
        if (field === "sub_category") {
          updatedArticle.item_description = ""
          updatedArticle.sku_id = null
        }
        
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

  // JSON Import Handler
  const handleImportJson = async () => {
    if (!jsonInput.trim()) {
      toast({
        title: "Validation Error",
        description: "Please paste JSON data",
        variant: "destructive"
      })
      return
    }

    try {
      setImportingJson(true)
      const parsedJson = JSON.parse(jsonInput)

      // Validate JSON structure
      if (!parsedJson.articles || !Array.isArray(parsedJson.articles)) {
        throw new Error("Invalid JSON format: 'articles' array is required")
      }

      if (parsedJson.articles.length === 0) {
        throw new Error("No articles found in JSON")
      }

      console.log("📦 Importing JSON:", parsedJson)
      console.log("📦 Articles to search:", parsedJson.articles)

      const newArticles: Article[] = []
      let successCount = 0
      let failCount = 0

      // Process each article name
      for (const articleName of parsedJson.articles) {
        if (!articleName || typeof articleName !== 'string') {
          console.warn("⚠️ Skipping invalid article:", articleName)
          failCount++
          continue
        }

        console.log(`🔍 Searching for article: "${articleName}"`)

        try {
          // Search using global search API
          const searchResults = await fetchGlobalItems(company, articleName)

          if (searchResults.length === 0) {
            console.warn(`⚠️ No results found for: "${articleName}"`)
            failCount++
            continue
          }

          // Use the first match
          const matchedItem = searchResults[0]
          console.log(`✅ Found match for "${articleName}":`, matchedItem)

          // Create new article with matched data
          const newArticle: Article = {
            id: `${Date.now()}-${newArticles.length}`,
            sku_id: matchedItem.id,
            material_type: "",
            item_category: matchedItem.item_category,
            sub_category: matchedItem.sub_category,
            item_description: matchedItem.item_description,
            quantity_units: 0,
            pack_size_gm: 0,
            no_of_packets: 0,
            uom: "",
            net_weight: 0,
            total_weight: 0,
            batch_number: generateBatchNumber(),
            unit_rate: 0
          }

          newArticles.push(newArticle)
          successCount++
        } catch (searchError) {
          console.error(`❌ Error searching for "${articleName}":`, searchError)
          failCount++
        }
      }

      if (newArticles.length === 0) {
        throw new Error("No articles could be matched from the global search")
      }

      // Replace all articles with imported ones
      setArticles(newArticles)
      generateBoxes(newArticles)

      toast({
        title: "JSON Imported Successfully",
        description: `${successCount} article(s) imported${failCount > 0 ? `, ${failCount} failed` : ''}`
      })

      // Close dialog and clear input
      setJsonImportOpen(false)
      setJsonInput("")
    } catch (error) {
      console.error("❌ JSON Import Error:", error)
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Invalid JSON format",
        variant: "destructive"
      })
    } finally {
      setImportingJson(false)
    }
  }

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

    // Remove the specific box from the boxes array
    const filteredBoxes = boxes.filter(b => b.id !== box.id)
    
    // Renumber the boxes for the same article
    let boxNumberCounter = 1
    const renumberedBoxes = filteredBoxes.map(b => {
      if (b.article === box.article) {
        return {
          ...b,
          box_number: boxNumberCounter++
        }
      }
      return b
    })
    
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
    setBoxes(renumberedBoxes)

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
      const QRCode = (await import('qrcode')).default

      // Build QR payload with ALL required fields for outward
      const qrPayload = {
        company_name: outwardRecord?.company_name || 'CFPL',
        consignment_no: outwardRecord?.consignment_no || '',
        invoice_no: outwardRecord?.invoice_no || '',
        po_no: outwardRecord?.po_no || '',
        dispatch_date: outwardRecord?.dispatch_date || '',
        customer_name: outwardRecord?.customer_name || '',
        material_type: associatedArticle.material_type,
        item_category: associatedArticle.item_category,
        sub_category: associatedArticle.sub_category,
        item_description: associatedArticle.item_description,
        pack_size_gm: associatedArticle.pack_size_gm,
        no_of_packets: associatedArticle.no_of_packets,
        batch_number: associatedArticle.batch_number || '',
        box_number: box.box_number,
        article_name: box.article,
        net_weight_gm: box.net_weight,
        gross_weight_gm: box.gross_weight,
        approval_authority: approvalAuthority,
        approval_status: approvalStatus,
        approval_date: approvalDate,
        remark: approvalRemark
      }

      // Use our new compressed QR data format
      const { generateSimplifiedOutwardQRData } = await import('@/lib/utils/qr')
      const qrDataString = generateSimplifiedOutwardQRData(qrPayload)
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
              <title></title>
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: Arial, sans-serif; background: white; }
                .label-container {
                  width: 4in; height: 2in; background: white; border: 1px solid #000; display: flex;
                }
                .qr-section { width: 2in; height: 2in; display: flex; align-items: center; justify-content: center; padding: 0.1in; }
                .qr-section img { width: 1.7in; height: 1.7in; }
                .info-section { width: 2in; height: 2in; padding: 0.1in; display: flex; flex-direction: column; justify-content: space-between; font-size: 8pt; line-height: 1.2; overflow: hidden; }
                .header-section { margin-bottom: 0.05in; }
                .consignment-info { font-weight: bold; font-size: 10pt; margin-bottom: 0.02in; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .customer-info { font-size: 7pt; margin-bottom: 0.03in; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .item-description { font-weight: bold; font-size: 8pt; line-height: 1.1; max-height: 0.7in; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; word-wrap: break-word; word-break: break-word; margin-bottom: 0.05in; }
                .details { font-size: 7.5pt; line-height: 1.2; }
                .details-row { margin-bottom: 0.02in; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .batch-section { font-size: 7pt; font-family: monospace; padding-top: 0.05in; border-top: 1px solid #ccc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                @media print {
                  @page { 
                    size: 4in 2in; 
                    margin: 0;
                  }
                  body { margin: 0; padding: 0; background: white; }
                  .label-container { width: 4in; height: 2in; border: 1px solid #000; page-break-after: avoid; page-break-inside: avoid; }
                }
                @page { margin: 0; }
                html { margin: 0; }
                body { margin: 0; }
              </style>
              <style>
                @page { margin: 0mm; }
                @page :first { margin: 0mm; }
                @page :left { margin: 0mm; }
                @page :right { margin: 0mm; }
              </style>
            </head>
            <body>
              <div class="label-container">
                <div class="qr-section">
                  <img src="${qrCodeDataURL}" alt="QR Code" />
                </div>
                <div class="info-section">
                  <div class="header-section">
                    <div class="consignment-info">${qrPayload.consignment_no}</div>
                    <div class="customer-info">${qrPayload.customer_name}</div>
                  </div>
                  <div class="item-description">${qrPayload.item_description}</div>
                  <div class="details">
                    <div class="details-row"><strong>Box #${qrPayload.box_number}</strong></div>
                    <div class="details-row">Net: ${(qrPayload.net_weight_gm / 1000).toFixed(2)}kg | Gross: ${(qrPayload.gross_weight_gm / 1000).toFixed(2)}kg</div>
                    ${qrPayload.approval_authority ? `<div class="details-row">Auth: ${qrPayload.approval_authority}</div>` : ''}
                  </div>
                  <div class="batch-section">${qrPayload.batch_number || '-'}</div>
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

  // Get box statistics per article matching outward form
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

  // Auto-generate boxes when articles change (matching outward form)
  useEffect(() => {
    generateBoxes()
  }, [articles, articles.length])

  const handleSaveApproval = async () => {
    if (!approvalAuthority.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter approval authority",
        variant: "destructive"
      })
      return
    }

    if (articles.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one article",
        variant: "destructive"
      })
      return
    }

    try {
      setSaving(true)

      // Check if approval already exists
      let existingApproval = outwardRecord?.approval
      
      // If approval data not loaded from outward record, try fetching it
      if (!existingApproval) {
        try {
          console.log('🔍 Checking for existing approval...')
          existingApproval = await getOutwardApproval(company, consignmentId)
          console.log('🔄 Existing approval found:', existingApproval)
        } catch (error: any) {
          // 404 means no approval exists yet, which is fine
          if (error?.statusCode !== 404) {
            console.log('⚠️ Error checking approval (not 404):', error)
          }
          console.log('✨ No existing approval found, will create new')
        }
      } else {
        console.log('🔄 Using approval from outward record:', existingApproval)
      }

      // Set approval date to today if not set
      const finalApprovalDate = approvalDate || new Date().toISOString().split('T')[0]

      // Map articles to API format
      const mappedArticles = articles.map(article => ({
        material_type: article.material_type,
        item_category: article.item_category,
        sub_category: article.sub_category,
        item_description: article.item_description,
        sku_id: article.sku_id || 0,
        quantity_units: article.quantity_units,
        uom: article.uom,
        pack_size_gm: article.pack_size_gm,
        no_of_packets: article.no_of_packets,
        net_weight_gm: article.net_weight,
        gross_weight_gm: article.total_weight,
        batch_number: article.batch_number,
        unit_rate: article.unit_rate
      }))

      // Map boxes to API format
      const mappedBoxes = boxes.map(box => ({
        box_number: box.box_number,
        article_name: box.article,
        lot_number: box.lot_number || "",
        net_weight_gm: box.net_weight,
        gross_weight_gm: box.gross_weight
      }))

      const payload = {
        consignment_id: parseInt(consignmentId),
        approval_authority: approvalAuthority.toUpperCase(),
        approval_date: finalApprovalDate,
        approval_status: approvalStatus,
        approval_remark: approvalRemark.toUpperCase(),
        articles: mappedArticles,
        boxes: mappedBoxes
      }

      console.log('🚀 Submitting approval payload:', JSON.stringify(payload, null, 2))
      console.log(existingApproval ? '🔄 Updating existing approval' : '✨ Creating new approval')
      
      const response = await submitApprovalWithArticles(company, payload)

      const actionText = existingApproval ? 'updated' : 'created'
      toast({
        title: "Approval Saved",
        description: `Approval ${actionText} for consignment ${outwardRecord?.consignment_no} - Status: ${approvalStatus.toUpperCase()}`
      })

      // Navigate back to outward list
      router.push(`/${company}/outward`)
    } catch (error: any) {
      console.error("❌ Error saving approval:", error)
      console.error("❌ Error full object:", error)
      console.error("❌ Error context:", error?.context)
      console.error("❌ Error responseData:", error?.context?.responseData)
      
      // Extract detailed error message from the backend response
      let errorMessage = "Failed to save approval"
      
      // Try to get the detailed error from responseData
      const responseData = error?.context?.responseData
      if (responseData) {
        console.log("📋 Backend validation error:", responseData)
        
        if (responseData.detail) {
          // FastAPI validation error format
          if (Array.isArray(responseData.detail)) {
            // Pydantic validation errors
            const errors = responseData.detail.map((err: any) => 
              `${err.loc?.join('.') || 'field'}: ${err.msg}`
            ).join(', ')
            errorMessage = `Validation error: ${errors}`
          } else if (typeof responseData.detail === 'string') {
            errorMessage = responseData.detail
          }
        } else if (responseData.message) {
          errorMessage = responseData.message
        } else if (responseData.error) {
          errorMessage = responseData.error
        }
      } else if (error?.message && typeof error.message === 'string') {
        errorMessage = error.message
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6 max-w-[1920px] mx-auto">
        <Card>
          <CardContent className="text-center py-12">
            <Loader2 className="mx-auto h-8 w-8 animate-spin" />
            <p className="text-muted-foreground mt-4">Loading outward record...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !outwardRecord) {
    return (
      <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6 max-w-[1920px] mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href={`/${company}/outward`}>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to List
            </Button>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Outward Approval - {company.toUpperCase()}
          </h1>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold">Failed to load outward record</p>
            <p className="mt-2">{error || "Record not found"}</p>
            <p className="mt-2 text-sm">
              Consignment ID: <code className="bg-red-100 px-2 py-1 rounded">{consignmentId}</code>
            </p>
            <div className="mt-4">
              <Link href={`/${company}/outward`}>
                <Button variant="outline" size="sm">
                  Return to Outward List
                </Button>
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6 max-w-[1920px] mx-auto space-y-4 sm:space-y-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Link href={`/${company}/outward`}>
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to List
              </Button>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Outward Approval - {company.toUpperCase()}
            </h1>
          </div>
          <p className="text-muted-foreground">
            Review and approve outward consignment with article and box details
          </p>
        </div>
      </div>

      {/* Consignment Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Consignment Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground">Consignment No</Label>
              <p className="font-mono font-semibold">{outwardRecord?.consignment_no}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Invoice No</Label>
              <p className="font-medium">{outwardRecord?.invoice_no}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">PO Number</Label>
              <p className="font-medium">{outwardRecord?.po_no || "-"}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Dispatch Date</Label>
              <p className="font-medium">
                {outwardRecord?.dispatch_date ? format(new Date(outwardRecord.dispatch_date), "MMM dd, yyyy") : "-"}
              </p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Customer Name</Label>
              <p className="font-medium">{outwardRecord?.customer_name}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Article Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Article Management
          </CardTitle>
          <div className="flex items-center gap-2">
            <Dialog open={jsonImportOpen} onOpenChange={setJsonImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <FileJson className="h-4 w-4" />
                  Import JSON
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Import Articles from AI-Extracted JSON</DialogTitle>
                  <DialogDescription>
                    Paste the AI-extracted JSON below. Each article name in the "articles" array will be searched automatically.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>JSON Data</Label>
                    <Textarea
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                      placeholder={`{\n  "invoice_number": "INV-2024-001",\n  "articles": [\n    "PREMIUM WHEAT FLOUR 1KG",\n    "SUGAR WHITE REFINED 25KG"\n  ]\n}`}
                      rows={15}
                      className="font-mono text-sm"
                    />
                  </div>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>How it works:</strong>
                      <ul className="list-disc ml-4 mt-2 space-y-1">
                        <li>Each article name will be searched in the global item database</li>
                        <li>The first matching result will auto-fill item category, sub category, and description</li>
                        <li>You can manually adjust other fields after import</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setJsonImportOpen(false)
                        setJsonInput("")
                      }}
                      disabled={importingJson}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleImportJson}
                      disabled={importingJson || !jsonInput.trim()}
                      className="gap-2"
                    >
                      {importingJson ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <FileJson className="h-4 w-4" />
                          Import & Auto-Fill
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button onClick={addArticle} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Article
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {articles.map((article, index) => (
              <Card key={article.id} className="border-2">
                <CardHeader className="pb-3">
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
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Quick Item Search */}
                  <ArticleItemSearch 
                    company={company}
                    articleId={article.id}
                    onItemSelect={(item) => {
                      // Debug: Log the selected item
                      console.log("Selected item from global search:", item)
                      console.log("Auto-filling article:", article.id, "with data:", {
                        item_category: item.item_category,
                        sub_category: item.sub_category,
                        item_description: item.item_description,
                        sku_id: item.id
                      })
                      
                      // Auto-fill the current article with global search data
                      // Update all fields at once to avoid dependent field clearing
                      const updatedArticles = articles.map((art) => {
                        if (art.id === article.id) {
                          return {
                            ...art,
                            item_category: item.item_category,
                            sub_category: item.sub_category,
                            item_description: item.item_description,
                            sku_id: item.id
                          }
                        }
                        return art
                      })
                      setArticles(updatedArticles)
                      generateBoxes(updatedArticles)
                      
                      toast({
                        title: "Item Auto-filled",
                        description: `Article ${index + 1} filled with "${item.item_description}"`
                      })
                    }}
                  />

                  {/* Row 1 - Material Type & Dropdowns - MATCHING OUTWARD FORM */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Material Type *</Label>
                      <MaterialTypeDropdown
                        value={article.material_type}
                        onValueChange={(value) => updateArticle(article.id, "material_type", value)}
                        company={company}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Item Category *</Label>
                      <ItemCategoryDropdown
                        value={article.item_category}
                        onValueChange={(value) => updateArticle(article.id, "item_category", value)}
                        company={company}
                        materialType={article.material_type}
                        disabled={!article.material_type}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Sub Category *</Label>
                      <SubCategoryDropdown
                        articleId={article.id}
                        categoryId={article.item_category}
                        value={article.sub_category}
                        onValueChange={(value) => updateArticle(article.id, "sub_category", value)}
                        company={company}
                        materialType={article.material_type}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Item Description *</Label>
                      <ItemDescriptionDropdown
                        articleId={article.id}
                        categoryId={article.item_category}
                        subCategoryId={article.sub_category}
                        value={article.item_description}
                        onValueChange={(value) => updateArticle(article.id, "item_description", value)}
                        company={company}
                        materialType={article.material_type}
                        updateArticle={updateArticle}
                      />
                    </div>
                  </div>

                  {/* Row 2: Quantity, UOM, Pack Size, No. of Packets - MATCHING OUTWARD FORM */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Quantity (Units) *</Label>
                      <Input
                        type="number"
                        min="0"
                        value={article.quantity_units}
                        onChange={(e) => updateArticle(article.id, "quantity_units", Number(e.target.value))}
                        onWheel={(e) => e.currentTarget.blur()}
                        className={quantityWarnings[article.id] ? "border-yellow-500" : ""}
                      />
                      {quantityWarnings[article.id] && (
                        <p className="text-sm text-yellow-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {quantityWarnings[article.id]}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>UOM *</Label>
                      <Select value={article.uom} onValueChange={(value) => updateArticle(article.id, "uom", value)}>
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

                    <div className="space-y-2">
                      <Label>Pack Size (gm)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={article.pack_size_gm}
                        onChange={(e) => updateArticle(article.id, "pack_size_gm", Number(e.target.value))}
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>No. of Packets</Label>
                      <Input
                        type="number"
                        min="0"
                        value={article.no_of_packets}
                        onChange={(e) => updateArticle(article.id, "no_of_packets", Number(e.target.value))}
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Row 3: Net Weight, Gross Weight, Batch Number, Unit Rate - MATCHING OUTWARD FORM */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Net Weight (gm) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={article.net_weight.toFixed(2)}
                        readOnly
                        className="bg-muted"
                        title={`${article.net_weight.toFixed(2)} gm`}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Auto-calculated</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Gross Weight (gm) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={article.total_weight}
                        onChange={(e) => updateArticle(article.id, "total_weight", Number(e.target.value))}
                        onWheel={(e) => e.currentTarget.blur()}
                        title={`${article.total_weight.toFixed(2)} gm`}
                      />
                      {article.net_weight > 0 && article.total_weight <= article.net_weight && (
                        <p className="text-sm text-orange-500 mt-1">⚠️ Gross weight must be greater than net weight ({article.net_weight.toFixed(2)} gm)</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Batch Number</Label>
                      <Input value={article.batch_number} readOnly className="bg-muted" />
                    </div>

                    <div className="space-y-2">
                      <Label>Unit Rate</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={article.unit_rate}
                        onChange={(e) => updateArticle(article.id, "unit_rate", Number(e.target.value))}
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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
                                <span className="text-sm">{box.lot_number || "-"}</span>
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

      {/* Approval Section */}
      <Card>
        <CardHeader>
          <CardTitle>Approval Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Approval Status Selection */}
            <div className="flex gap-4">
              <Button
                variant={approvalStatus === "approved" ? "default" : "outline"}
                onClick={() => setApprovalStatus("approved")}
                className={approvalStatus === "approved" ? "bg-green-600 hover:bg-green-700" : ""}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                variant={approvalStatus === "rejected" ? "default" : "outline"}
                onClick={() => setApprovalStatus("rejected")}
                className={approvalStatus === "rejected" ? "bg-red-600 hover:bg-red-700" : ""}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                variant={approvalStatus === "pending" ? "default" : "outline"}
                onClick={() => setApprovalStatus("pending")}
              >
                Keep Pending
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Approval Authority *</Label>
                <Input
                  value={approvalAuthority}
                  onChange={(e) => setApprovalAuthority(e.target.value)}
                  placeholder="Enter authority name"
                />
              </div>

              <div className="space-y-2">
                <Label>Approval Date</Label>
                <Input
                  type="date"
                  value={approvalDate}
                  onChange={(e) => setApprovalDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                value={approvalRemark}
                onChange={(e) => setApprovalRemark(e.target.value)}
                placeholder="Enter approval remarks..."
                rows={3}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <Link href={`/${company}/outward`}>
          <Button variant="outline">
            Cancel
          </Button>
        </Link>
        {boxes.length > 0 && (
          <Link href={`/${company}/outward/${consignmentId}/qr-print`}>
            <Button variant="outline" className="gap-2">
              <Printer className="h-4 w-4" />
              Print All Labels
            </Button>
          </Link>
        )}
        <Button onClick={handleSaveApproval} className="gap-2" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Approval
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

