"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useItemCategories, useSubCategories, useItemDescriptions, useCategorialItemDescriptions } from "@/lib/hooks/useDropdownData"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { ArrowLeft, Plus, Send, Loader2, FileText, Trash2, Search, List } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { InterunitApiService, transformFormDataToApi, validateRequestData } from "@/lib/interunitApiService"
import { dropdownApi } from "@/lib/api"
import { useAuthStore } from "@/lib/stores/auth"
import type { Company } from "@/types/auth"

interface NewTransferRequestPageProps {
  params: {
    company: Company
  }
}

// Material Type dropdown component (matches inward module)
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
      } catch (error) {
        console.error("Error fetching material types:", error)
        setErrorState("Failed to load material types")
        setOptions([
          { value: "RM", label: "RM" },
          { value: "PM", label: "PM" },
          { value: "FG", label: "FG" }
        ])
      } finally {
        setLoading(false)
      }
    }

    fetchMaterialTypes()
  }, [])

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

export default function NewTransferRequestPage({ params }: NewTransferRequestPageProps) {
  const { company } = params
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuthStore()

  // Generate a unique request number with REQ prefix and YYYYMMDDHHMMS format
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const second = String(now.getSeconds()).padStart(2, '0')
  const requestNo = `REQ${year}${month}${day}${hour}${minute}${second}`

  // Get current date in DD-MM-YYYY format (backend expects this format)
  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, '-')

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false)

  // Warehouse sites from API
  const [warehouseSites, setWarehouseSites] = useState<Array<{id: number, site_code: string, site_name: string}>>([])

  const [formData, setFormData] = useState({
    requestDate: currentDate,
    fromWarehouse: "",
    toWarehouse: "",
    reason: "",
    reasonDescription: ""
  })

  const [articleData, setArticleData] = useState({
    materialType: "",
    itemCategory: "",
    subCategory: "",
    itemDescription: "",
    quantity: "",
    uom: "",
    packSize: "",
    packageSize: "",
    netWeight: "0",
    lotNumber: ""
  })

  // Articles list for multiple items
  const [articlesList, setArticlesList] = useState<Array<{
    materialType: string
    itemCategory: string
    subCategory: string
    itemDescription: string
    quantity: string
    uom: string
    packSize: string
    packageSize: string
    netWeight: string
    lotNumber: string
  }>>([])

  // ─── Article Search Mode ───────────────────────────
  type ArticleMode = "search" | "dropdown"
  const [articleMode, setArticleMode] = useState<ArticleMode>("search")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Array<{ id: number; item_description: string; material_type?: string; group?: string; sub_group?: string; uom?: number | null }>>([])
  const [searching, setSearching] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchTotal, setSearchTotal] = useState(0)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchWrapperRef = useRef<HTMLDivElement>(null)

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowSearchResults(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const doArticleSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }
    setSearching(true)
    setSearchError(null)
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/interunit/categorial-search?search=${encodeURIComponent(query.trim())}&limit=200`
      const response = await fetch(apiUrl, { method: 'GET', headers: { 'Accept': 'application/json' } })
      if (!response.ok) throw new Error(`Search failed: ${response.status}`)
      const data = await response.json()
      setSearchResults(data.items || [])
      setSearchTotal(data.meta?.total_items ?? data.items?.length ?? 0)
      setShowSearchResults(true)
    } catch (err) {
      console.error("Article search failed:", err)
      setSearchError("Search failed. Check connection.")
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  const handleSearchInput = (value: string) => {
    setSearchQuery(value)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => doArticleSearch(value), 300)
  }

  const handleSelectSearchItem = (item: { id: number; item_description: string; material_type?: string; group?: string; sub_group?: string; uom?: number | null }) => {
    setArticleData(prev => ({
      ...prev,
      materialType: item.material_type || "",
      itemCategory: item.group || "",
      subCategory: item.sub_group || "",
      itemDescription: item.item_description,
      packageSize: item.uom != null ? String(item.uom) : prev.packageSize,
    }))
    setSearchQuery("")
    setShowSearchResults(false)
    setSearchResults([])
  }

  // Use categorial_inv dropdown hooks for transfer/request
  const { options: itemCategories, loading: categoriesLoading } = useItemCategories({ company, material_type: articleData.materialType })
  const { options: subCategories, loading: subCategoriesLoading } = useSubCategories(articleData.itemCategory, { company, material_type: articleData.materialType })
  const { options: itemDescriptions, loading: descriptionsLoading } = useItemDescriptions({
    company,
    material_type: articleData.materialType,
    item_category: articleData.itemCategory,
    sub_category: articleData.subCategory
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const formatDateForAPI = (dateString: string): string => {
    if (!dateString) return dateString
    if (dateString.includes('/')) return dateString.replace(/\//g, '-')
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-')
      return `${day}-${month}-${year}`
    }
    return dateString
  }

  const handleArticleChange = (field: string, value: string) => {
    setArticleData(prev => {
      const newData = { ...prev, [field]: value }

      if (field === 'materialType') {
        newData.itemCategory = ""
        newData.subCategory = ""
        newData.itemDescription = ""
      } else if (field === 'itemCategory') {
        newData.subCategory = ""
        newData.itemDescription = ""
      } else if (field === 'subCategory') {
        newData.itemDescription = ""
      }

      // Auto-fill packageSize from categorial_inv uom when item description is selected via dropdown
      if (field === 'itemDescription' && value) {
        const match = itemDescriptions.find(opt => opt.value === value)
        if (match && match.uom != null) {
          newData.packageSize = String(match.uom)
        }
      }

      if (field === 'quantity' || field === 'packSize' || field === 'packageSize' || field === 'materialType' || field === 'itemDescription') {
        newData.netWeight = calculateNetWeight(newData)
      }

      return newData
    })
  }

  // Always returns weight in Kg
  const calculateNetWeight = (data: typeof articleData): string => {
    const quantity = parseFloat(data.quantity) || 0
    const packSize = parseFloat(data.packSize) || 0

    if (data.materialType === 'FG') {
      const packageSize = parseFloat(data.packageSize) || 0
      const result = (packageSize * packSize) * quantity
      return result.toFixed(3)
    } else {
      const netWeightKg = quantity * packSize
      return netWeightKg.toFixed(2)
    }
  }

  const handleAddArticle = () => {
    if (!articleData.materialType || !articleData.itemDescription) {
      toast({
        title: "Incomplete Article",
        description: "Please fill in at least Material Type and Item Description before adding.",
        variant: "destructive",
      })
      return
    }
    setArticlesList(prev => [...prev, { ...articleData }])
    setArticleData({
      materialType: "",
      itemCategory: "",
      subCategory: "",
      itemDescription: "",
      quantity: "1",
      uom: "",
      packSize: "1",
      packageSize: "",
      netWeight: "0",
      lotNumber: ""
    })
    toast({
      title: "Article Added",
      description: `Article ${articlesList.length + 1} saved. Fill in the next article or submit the request.`,
    })
  }

  const handleRemoveArticle = (index: number) => {
    setArticlesList(prev => prev.filter((_, i) => i !== index))
    toast({
      title: "Article Removed",
      description: `Article ${index + 1} has been removed.`,
    })
  }

  // Load warehouse sites on component mount
  useEffect(() => {
    const loadWarehouseSites = async () => {
      setIsLoadingWarehouses(true)
      try {
        const sites = await InterunitApiService.getWarehouseSites()
        setWarehouseSites(sites)
      } catch (error) {
        console.error('Failed to load warehouse sites:', error)
        toast({
          title: "Error",
          description: "Failed to load warehouse sites. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingWarehouses(false)
      }
    }

    loadWarehouseSites()
  }, [toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const hasCurrentArticle = articleData.materialType !== "" || articleData.itemDescription !== ""
      const allArticles = [
        ...articlesList,
        ...(hasCurrentArticle || articlesList.length === 0 ? [articleData] : [])
      ]

      const formattedFormData = {
        ...formData,
        requestDate: formatDateForAPI(formData.requestDate)
      }

      const apiData = transformFormDataToApi(formattedFormData, allArticles, requestNo)

      const errors = validateRequestData(apiData.form_data, apiData.article_data)

      if (errors.length > 0) {
        toast({
          title: "Validation Error",
          description: errors.join(", "),
          variant: "destructive",
        })
        return
      }

      const response = await InterunitApiService.createRequest(apiData, user?.email || 'unknown')

      const responseRequestNo = response?.request_no || 'N/A'

      toast({
        title: "Success",
        description: `Transfer request ${responseRequestNo} created successfully!`,
      })

      router.push(`/${company}/transfer`)

    } catch (error: any) {
      console.error('Form submission failed:', error)

      let errorMessage = "Failed to submit request. Please try again."
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data
        } else if (error.response.data.detail) {
          errorMessage = String(error.response.data.detail)
        } else if (error.response.data.message) {
          errorMessage = String(error.response.data.message)
        } else {
          errorMessage = JSON.stringify(error.response.data)
        }
      }

      toast({
        title: "Error",
        description: typeof errorMessage === 'string' ? errorMessage : String(errorMessage),
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form id="transfer-request-form" onSubmit={handleSubmit}>
      <div className="p-3 sm:p-4 lg:p-6 space-y-4 bg-gray-50 min-h-screen">
        {/* ── Header ── */}
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
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-gray-700" />
              New Transfer Request
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Request No: <span className="font-medium">{requestNo}</span></p>
          </div>
        </div>

        {/* ── Request Header Card ── */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <CardTitle className="text-sm sm:text-base font-semibold text-gray-800">Request Header</CardTitle>
            <p className="text-xs text-muted-foreground">
              Fill in the basic request information
            </p>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Request Date */}
              <div className="space-y-1.5">
                <Label htmlFor="requestDate" className="text-xs font-medium text-gray-600">
                  Request Date *
                </Label>
                <Input
                  id="requestDate"
                  type="text"
                  value={formData.requestDate}
                  onChange={(e) => handleInputChange('requestDate', e.target.value)}
                  className="h-9 bg-white border-gray-200"
                  placeholder="17-10-2025"
                />
              </div>

              {/* From Warehouse */}
              <div className="space-y-1.5">
                <Label htmlFor="fromWarehouse" className="text-xs font-medium text-gray-600">
                  From (Requesting Warehouse) *
                </Label>
                <Select
                  value={formData.fromWarehouse}
                  onValueChange={(value) => handleInputChange('fromWarehouse', value)}
                  disabled={isLoadingWarehouses}
                >
                  <SelectTrigger className="h-9 bg-white border-gray-200">
                    <SelectValue placeholder={isLoadingWarehouses ? "Loading..." : "Select site"} />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouseSites.length > 0 ? (
                      warehouseSites.map((site) => (
                        <SelectItem key={site.id} value={site.site_code}>
                          {site.site_code} - {site.site_name}
                        </SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="W202">W202</SelectItem>
                        <SelectItem value="A185">A185</SelectItem>
                        <SelectItem value="A101">A101</SelectItem>
                        <SelectItem value="A68">A68</SelectItem>
                        <SelectItem value="F53">F53</SelectItem>
                        <SelectItem value="Cold Storage">Cold Storage</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* To Warehouse */}
              <div className="space-y-1.5">
                <Label htmlFor="toWarehouse" className="text-xs font-medium text-gray-600">
                  To (Supplying Warehouse) *
                </Label>
                <Select
                  value={formData.toWarehouse}
                  onValueChange={(value) => handleInputChange('toWarehouse', value)}
                  disabled={isLoadingWarehouses}
                >
                  <SelectTrigger className="h-9 bg-white border-gray-200">
                    <SelectValue placeholder={isLoadingWarehouses ? "Loading..." : "Select site"} />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouseSites.length > 0 ? (
                      warehouseSites.map((site) => (
                        <SelectItem key={site.id} value={site.site_code}>
                          {site.site_code} - {site.site_name}
                        </SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="W202">W202</SelectItem>
                        <SelectItem value="A185">A185</SelectItem>
                        <SelectItem value="A101">A101</SelectItem>
                        <SelectItem value="A68">A68</SelectItem>
                        <SelectItem value="F53">F53</SelectItem>
                        <SelectItem value="Savla D-39 cold">Savla D-39</SelectItem>
                        <SelectItem value="Savla D-514 cold">Savla D-514</SelectItem>
                        <SelectItem value="Rishi cold">Rishi Cold</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Reason Description - full width */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="reasonDescription" className="text-xs font-medium text-gray-600">
                  Reason Description *
                </Label>
                <Textarea
                  id="reasonDescription"
                  value={formData.reasonDescription}
                  onChange={(e) => handleInputChange('reasonDescription', e.target.value)}
                  className="min-h-[60px] bg-white border-gray-200"
                  placeholder="Enter short description about Reason..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Article Management Section ── */}
        <div id="article-section" className="space-y-4">
          {/* Header with Add Article Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-violet-100 flex items-center justify-center">
                <Plus className="h-3.5 w-3.5 text-violet-600" />
              </div>
              Article Management
            </h2>
            <Button type="button" onClick={handleAddArticle} className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white h-9 px-4 text-xs sm:text-sm">
              <Plus className="mr-2 h-3.5 w-3.5" />
              Add Article
            </Button>
          </div>

          {/* Saved Articles List */}
          {articlesList.map((article, index) => (
            <Card key={index} className="border-0 shadow-sm overflow-hidden border-l-4 border-l-emerald-400">
              <CardHeader className="pb-2 bg-emerald-50 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-emerald-800">Article {index + 1} (Saved)</CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveArticle(index)}
                    className="h-7 px-2.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />Remove
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="py-3 bg-emerald-50/50">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-700">
                  <div><span className="text-gray-500">Type:</span> {article.materialType}</div>
                  <div><span className="text-gray-500">Category:</span> {article.itemCategory}</div>
                  <div><span className="text-gray-500">Sub Category:</span> {article.subCategory}</div>
                  <div className="truncate"><span className="text-gray-500">Description:</span> {article.itemDescription}</div>
                  <div><span className="text-gray-500">Qty:</span> {article.quantity} {article.uom}</div>
                  <div><span className="text-gray-500">Pack Size:</span> {article.packSize}</div>
                  <div><span className="text-gray-500">Net Weight:</span> {article.netWeight}</div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Article Details Form */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-violet-50 to-purple-50 border-b">
              <CardTitle className="text-sm sm:text-base font-semibold text-gray-800">Article {articlesList.length + 1}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              {/* ─── Quick Search (auto-fills dropdowns below) ─── */}
              <div className="mb-4">
                <div className="relative" ref={searchWrapperRef}>
                  <Label className="text-xs font-medium text-gray-600 mb-1.5 block">
                    <Search className="inline h-3 w-3 mr-1 -mt-0.5" />
                    Quick Search Item
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => handleSearchInput(e.target.value)}
                      onFocus={() => { if (searchResults.length > 0) setShowSearchResults(true) }}
                      placeholder="Type to search and auto-fill fields below..."
                      className="h-9 pl-8 pr-8 bg-white border-gray-200"
                    />
                    {searching && (
                      <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-gray-400" />
                    )}
                  </div>

                  {searchError && <p className="text-xs text-red-500 mt-1">{searchError}</p>}

                  {showSearchResults && searchResults.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg flex flex-col" style={{ maxHeight: "min(480px, 60vh)" }}>
                      <div className="overflow-y-auto flex-1">
                        {searchResults.map((item) => (
                          <button
                            key={`${item.id}-${item.item_description}`}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors border-b last:border-0"
                            onClick={() => handleSelectSearchItem(item)}
                          >
                            <p className="text-sm font-medium truncate text-gray-900">{item.item_description}</p>
                            <div className="flex gap-1.5 mt-0.5">
                              {item.material_type && (
                                <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{item.material_type}</span>
                              )}
                              {item.group && (
                                <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{item.group}</span>
                              )}
                              {item.sub_group && (
                                <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{item.sub_group}</span>
                              )}
                              <span className="text-[10px] text-gray-400 ml-auto">ID: {item.id}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                      <div className="px-3 py-1.5 border-t bg-gray-50 text-[10px] text-gray-500 text-center rounded-b-lg flex-shrink-0">
                        Showing {searchResults.length} of {searchTotal} results
                      </div>
                    </div>
                  )}

                  {showSearchResults && searchResults.length === 0 && !searching && searchQuery.length >= 2 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-center text-sm text-gray-500">
                      No items found for &quot;{searchQuery}&quot;
                    </div>
                  )}
                </div>
              </div>

              {/* ─── Dropdown Fields (always visible, auto-filled by search) ─── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {/* Material Type */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">
                    Material Type *
                  </Label>
                  <MaterialTypeDropdown
                    value={articleData.materialType}
                    onValueChange={(value) => handleArticleChange('materialType', value)}
                    company={company}
                  />
                </div>

                {/* Item Category */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">
                    Item Category *
                  </Label>
                  <SearchableSelect
                    value={articleData.itemCategory}
                    onValueChange={(value) => handleArticleChange('itemCategory', value)}
                    placeholder={
                      !articleData.materialType
                        ? "Select material type first"
                        : categoriesLoading
                        ? "Loading..."
                        : itemCategories.length === 0
                        ? "No categories available"
                        : "Select category..."
                    }
                    searchPlaceholder="Search category..."
                    options={itemCategories}
                    loading={categoriesLoading}
                    disabled={!articleData.materialType || categoriesLoading}
                  />
                </div>

                {/* Sub Category */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">
                    Sub Category *
                  </Label>
                  <SearchableSelect
                    value={articleData.subCategory}
                    onValueChange={(value) => handleArticleChange('subCategory', value)}
                    placeholder={
                      !articleData.itemCategory
                        ? "Select category first"
                        : subCategoriesLoading
                        ? "Loading..."
                        : subCategories.length === 0
                        ? "No sub categories available"
                        : "Select sub category..."
                    }
                    searchPlaceholder="Search sub category..."
                    options={subCategories}
                    loading={subCategoriesLoading}
                    disabled={!articleData.itemCategory || subCategoriesLoading}
                  />
                </div>

                {/* Item Description */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">
                    Item Description *
                  </Label>
                  <SearchableSelect
                    value={articleData.itemDescription}
                    onValueChange={(value) => handleArticleChange('itemDescription', value)}
                    placeholder={
                      !articleData.itemCategory || !articleData.subCategory
                        ? "Select category & sub category first"
                        : descriptionsLoading
                        ? "Loading..."
                        : itemDescriptions.length === 0
                        ? "No item descriptions available"
                        : "Select item description..."
                    }
                    searchPlaceholder="Search item description..."
                    options={itemDescriptions}
                    loading={descriptionsLoading}
                    disabled={!articleData.itemCategory || !articleData.subCategory || descriptionsLoading}
                  />
                </div>
              </div>

              {/* ─── Common fields (Quantity, UOM, Pack Size, etc.) ─── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Package Size */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">
                    Unit Pack Size
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={articleData.packageSize}
                    onChange={(e) => handleArticleChange('packageSize', e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="h-9 bg-white border-gray-200"
                    placeholder="0"
                  />
                </div>

                {/* UOM */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">
                    UOM
                  </Label>
                  <Select
                    value={articleData.uom}
                    onValueChange={(value) => handleArticleChange('uom', value)}
                  >
                    <SelectTrigger className="h-9 bg-white border-gray-200">
                      <SelectValue placeholder="Select UOM" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BOX">BOX</SelectItem>
                      <SelectItem value="CARTON">CARTON</SelectItem>
                      <SelectItem value="BAG">BAG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Pack Size */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">
                    Case Pack/Box Wt.
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={articleData.packSize}
                    onChange={(e) => handleArticleChange('packSize', e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="h-9 bg-white border-gray-200"
                    placeholder="0.00"
                  />
                </div>

                {/* Quantity (Box/Bags) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">
                    Quantity (Box/Bags)
                  </Label>
                  <Input
                    type="text"
                    value={articleData.quantity}
                    onChange={(e) => handleArticleChange('quantity', e.target.value)}
                    className="h-9 bg-white border-gray-200"
                    placeholder="0"
                  />
                </div>

                {/* Net Weight */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">
                    Net Weight (Kg)
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={articleData.netWeight}
                    onChange={(e) => handleArticleChange('netWeight', e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="h-9 bg-white border-gray-200"
                    placeholder="Auto-calculated"
                  />
                </div>

                {/* Lot Number */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">
                    Lot Number <span className="text-gray-400 font-normal">(Optional)</span>
                  </Label>
                  <Input
                    type="text"
                    value={articleData.lotNumber}
                    onChange={(e) => handleArticleChange('lotNumber', e.target.value)}
                    className="h-9 bg-white border-gray-200"
                    placeholder="Enter lot number"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Submit Footer ── */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Request will be submitted with <span className="font-semibold text-gray-800">Pending</span> status
                </p>
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    className="h-10 sm:h-9 px-4 text-sm bg-white border-gray-200"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    form="transfer-request-form"
                    disabled={isSubmitting}
                    className="h-10 sm:h-9 px-5 text-sm bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Submit Request
                      </>
                    )}
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
