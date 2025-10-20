"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useItemCategories, useSubCategories, useItemDescriptions } from "@/lib/hooks/useDropdownData"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { ArrowLeft, Plus, Send, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { InterunitApiService, transformFormDataToApi, validateRequestData } from "@/lib/interunitApiService"
import { dropdownApi } from "@/lib/api"
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
        console.log("=== FETCHING MATERIAL TYPES ===")
        console.log("Company:", company)

        const data = await dropdownApi.fetchDropdown({
          company,
          limit: 1000
        })

        console.log("Material Types API Response:", data)

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
            { value: "RM", label: "RM" },
            { value: "PM", label: "PM" },
            { value: "FG", label: "FG" },
            { value: "RTV", label: "RTV" }
          ]
          setOptions(fallbackOptions)
        }

        console.log("=== END MATERIAL TYPES FETCH ===")
      } catch (error) {
        console.error("Error fetching material types:", error)
        setErrorState("Failed to load material types")
        // Set fallback options on error
        setOptions([
          { value: "RM", label: "RM" },
          { value: "PM", label: "PM" },
          { value: "FG", label: "FG" },
          { value: "RTV", label: "RTV" }
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

export default function NewTransferRequestPage({ params }: NewTransferRequestPageProps) {
  const { company } = params
  const router = useRouter()
  const { toast } = useToast()
  
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
  }).replace(/\//g, '-') // Convert DD/MM/YYYY to DD-MM-YYYY

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false)
  
  // Validation errors state
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  
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
    quantity: "0",
    uom: "",
    packSize: "0.00",
    packageSize: "0", // New field for FG
    netWeight: "0",
    batchNumber: "",
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
    batchNumber: string
    lotNumber: string
  }>>([])

  // Use the same dropdown hooks as inward module with material_type filtering
  // These hooks return empty arrays when parent fields are not selected, which is correct
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

  // Helper function to format date to DD-MM-YYYY
  const formatDateForAPI = (dateString: string): string => {
    console.log('🔍 formatDateForAPI input:', dateString)
    
    // If empty, return empty
    if (!dateString) {
      console.warn('⚠️ Empty date string provided')
      return dateString
    }
    
    // If date is in DD/MM/YYYY format, convert to DD-MM-YYYY
    if (dateString.includes('/')) {
      const formatted = dateString.replace(/\//g, '-')
      console.log('✅ Converted DD/MM/YYYY to DD-MM-YYYY:', formatted)
      return formatted
    }
    
    // If date is in YYYY-MM-DD format (from date input), convert to DD-MM-YYYY
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-')
      const formatted = `${day}-${month}-${year}`
      console.log('✅ Converted YYYY-MM-DD to DD-MM-YYYY:', formatted)
      return formatted
    }
    
    // If already in DD-MM-YYYY format, return as is
    if (dateString.match(/^\d{2}-\d{2}-\d{4}$/)) {
      console.log('✅ Already in DD-MM-YYYY format:', dateString)
      return dateString
    }
    
    console.warn('⚠️ Unknown date format, returning as is:', dateString)
    return dateString
  }

  const handleArticleChange = (field: string, value: string) => {
    setArticleData(prev => {
      const newData = { ...prev, [field]: value }

      // Reset dependent fields when parent changes
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

      // Calculate net weight when relevant fields change
      if (field === 'quantity' || field === 'packSize' || field === 'packageSize' || field === 'materialType') {
        newData.netWeight = calculateNetWeight(newData)
      }

      return newData
    })
  }

  const calculateNetWeight = (data: typeof articleData): string => {
    const quantity = parseFloat(data.quantity) || 0
    const packSize = parseFloat(data.packSize) || 0
    
    if (data.materialType === 'FG') {
      // For FG: net weight = (package size * pack size) * quantity (in grams)
      const packageSize = parseFloat(data.packageSize) || 0
      const netWeightGrams = (packageSize * packSize) * quantity
      return netWeightGrams.toFixed(2)
    } else {
      // For RM/PM: net weight = quantity * pack size (in grams)
      const netWeightGrams = quantity * packSize
      return netWeightGrams.toFixed(2)
    }
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
      console.log('🚀 ===== FORM SUBMISSION STARTED =====')
      console.log('📅 Request No:', requestNo)
      console.log('📋 Form Data:', formData)
      console.log('📦 Article Data:', articleData)
      console.log('📦 Articles List:', articlesList)
      
      // Prepare all articles (current article + articles list)
      const allArticles = articlesList.length > 0 ? articlesList : [articleData]
      console.log('📦 All Articles (Final):', allArticles)
      
      // Format date for API (ensure DD-MM-YYYY format)
      const formattedFormData = {
        ...formData,
        requestDate: formatDateForAPI(formData.requestDate)
      }
      
      console.log('📅 Date Formatting:')
      console.log('  - Original date:', formData.requestDate)
      console.log('  - Formatted date:', formattedFormData.requestDate)
      
      // Transform form data to API format (requestNo is already declared at component level)
      const apiData = transformFormDataToApi(formattedFormData, allArticles, requestNo)
      console.log('🔄 Transformed API Data:', JSON.stringify(apiData, null, 2))
      
      // Validate each field
      console.log('🔍 Form Data Validation:')
      console.log('  - request_date:', apiData.form_data.request_date, typeof apiData.form_data.request_date)
      console.log('  - from_warehouse:', apiData.form_data.from_warehouse, typeof apiData.form_data.from_warehouse)
      console.log('  - to_warehouse:', apiData.form_data.to_warehouse, typeof apiData.form_data.to_warehouse)
      console.log('  - reason_description:', apiData.form_data.reason_description, typeof apiData.form_data.reason_description)
      
      console.log('🔍 Article Data Validation:')
      apiData.article_data.forEach((article, index) => {
        console.log(`  Article ${index + 1}:`)
        console.log('    - material_type:', article.material_type, typeof article.material_type)
        console.log('    - item_category:', article.item_category, typeof article.item_category)
        console.log('    - sub_category:', article.sub_category, typeof article.sub_category)
        console.log('    - item_description:', article.item_description, typeof article.item_description)
        console.log('    - quantity:', article.quantity, typeof article.quantity)
        console.log('    - uom:', article.uom, typeof article.uom)
        console.log('    - pack_size:', article.pack_size, typeof article.pack_size)
        console.log('    - package_size:', article.package_size, typeof article.package_size)
        console.log('    - batch_number:', article.batch_number, typeof article.batch_number)
        console.log('    - lot_number:', article.lot_number, typeof article.lot_number)
      })
      
      // Validate the data
      const errors = validateRequestData(apiData.form_data, apiData.article_data)
      console.log('✅ Validation Errors:', errors)
      
      if (errors.length > 0) {
        console.log('❌ Validation failed, stopping submission')
        setValidationErrors(errors)
        const errorMessage = errors
          .filter(error => typeof error === 'string')
          .join(', ')
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

      console.log('🌐 Submitting to API...')
      console.log('🔗 API URL:', `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/interunit/requests?created_by=frontend@example.com`)
      console.log('📤 Request Payload:', JSON.stringify(apiData, null, 2))
      console.log('📤 Request Payload (Raw):', JSON.stringify(apiData, null, 2))
      console.log('📤 Form Data Keys:', Object.keys(apiData.form_data))
      console.log('📤 Article Data Keys:', apiData.article_data.map((item, index) => `Article ${index + 1}: ${Object.keys(item)}`))
      
      // Submit to API
      const response = await InterunitApiService.createRequest(apiData)
      console.log('📥 API Response:', JSON.stringify(response, null, 2))
      console.log('✅ Request created successfully with ID:', response.id)
      
      const responseRequestNo = response?.request_no || 'N/A'
      const successMessage = `Transfer request ${responseRequestNo} created successfully!`
      
      toast({
        title: "Success",
        description: successMessage,
      })
      
      console.log('🔄 Redirecting to transfer page...')
      // Redirect back to transfer page
      router.push(`/${company}/transfer`)
      
    } catch (error: any) {
      console.error('❌ ===== FORM SUBMISSION FAILED =====')
      console.error('💥 Error Details:', error)
      console.error('📄 Error Message:', error.message)
      console.error('🌐 Error Response:', error.response?.data)
      console.error('📊 Error Status:', error.response?.status)
      console.error('🔗 Error URL:', error.config?.url)
      
      // Handle error response properly
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
      
      // Ensure errorMessage is always a string
      const safeErrorMessage = typeof errorMessage === 'string' ? errorMessage : String(errorMessage)
      
      toast({
        title: "Error",
        description: safeErrorMessage,
        variant: "destructive",
      })
    } finally {
      console.log('🏁 Form submission process completed')
      setIsSubmitting(false)
    }
  }

  return (
    <form id="transfer-request-form" onSubmit={handleSubmit}>
      <div className="p-3 sm:p-4 lg:p-6 space-y-3 bg-gray-100 min-h-screen">
        {/* Header */}
        <div className="flex items-center space-x-3">
          
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">New Transfer Request</h1>
            <p className="text-xs text-muted-foreground">Request No: {requestNo}</p>
          </div>
        </div>

      {/* Form Card */}
      <Card className="w-full bg-gray-50 border-gray-200">
        <CardHeader className="pb-3 bg-gray-100">
          <CardTitle className="text-base font-semibold text-gray-700">Request Header</CardTitle>
          <p className="text-xs text-gray-500">
            Fill in the basic request information
          </p>
        </CardHeader>
        <CardContent className="pt-0 bg-gray-50">
          <div className="space-y-4">
            {/* Request Date */}
            <div className="space-y-1">
              <Label htmlFor="requestDate" className="text-xs font-medium text-gray-600">
                Request Date *
              </Label>
              <Input
                id="requestDate"
                type="text"
                value={formData.requestDate}
                onChange={(e) => handleInputChange('requestDate', e.target.value)}
                className="w-full h-8 bg-white border-gray-300 text-gray-700"
                placeholder="17-10-2025"
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
                disabled={isLoadingWarehouses}
              >
                <SelectTrigger className="w-full h-8 bg-white border-gray-300 text-gray-700">
                  <SelectValue placeholder={isLoadingWarehouses ? "Loading..." : "Select site"} />
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
                disabled={isLoadingWarehouses}
              >
                <SelectTrigger className="w-full h-8 bg-white border-gray-300 text-gray-700">
                  <SelectValue placeholder={isLoadingWarehouses ? "Loading..." : "Select site"} />
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
          {/* Closed the div started at line 392 */}
        </CardContent>
      </Card>

      {/* Article Management Section - INSIDE FORM */}
      <div id="article-section" className="space-y-4">
        {/* Header with Add Article Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-6 w-6 rounded bg-gray-200 flex items-center justify-center">
              <div className="h-3 w-3 bg-gray-400 rounded-sm"></div>
            </div>
            <h2 className="text-lg font-semibold text-gray-700">Article Management</h2>
          </div>
          <Button className="bg-black hover:bg-gray-800 text-white h-8 px-3 text-xs">
            <Plus className="mr-2 h-3 w-3" />
            Add Article
          </Button>
        </div>

        {/* Article Details Form */}
        <Card className="w-full bg-gray-50 border-gray-200">
          <CardHeader className="pb-3 bg-gray-100">
            <CardTitle className="text-base font-semibold text-gray-700">Article 1</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Material Type */}
              <div className="space-y-1">
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
              <div className="space-y-1">
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
              <div className="space-y-1">
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
              <div className="space-y-1">
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

              {/* Quantity (Units) */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">
                  Quantity (Units) *
                </Label>
                <Input
                  type="text"
                  value={articleData.quantity}
                  onChange={(e) => handleArticleChange('quantity', e.target.value)}
                  className="w-full h-8 bg-white border-gray-300 text-gray-700"
                  placeholder="0"
                />
              </div>

              {/* UOM */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">
                  UOM *
                </Label>
                <Select 
                  value={articleData.uom} 
                  onValueChange={(value) => handleArticleChange('uom', value)}
                >
                  <SelectTrigger className="w-full h-8 bg-white border-gray-300 text-gray-700">
                    <SelectValue placeholder="Select UOM" />
                  </SelectTrigger>
                  <SelectContent>
                    
                   
                    <SelectItem value="BOX">BOX</SelectItem>
                    <SelectItem value="CARTON">CARTON</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Pack Size */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">
                  Pack Size ({articleData.materialType === 'FG' ? 'gm' : 'Kg'}) *
                </Label>
                <Input
                  type="text"
                  value={articleData.packSize}
                  onChange={(e) => handleArticleChange('packSize', e.target.value)}
                  className="w-full h-8 bg-white border-gray-300 text-gray-700"
                  placeholder="0.00"
                />
              </div>

              {/* Package Size (only for FG) */}
              {articleData.materialType === 'FG' && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">
                    Package Size (gm) *
                  </Label>
                  <Input
                    type="text"
                    value={articleData.packageSize}
                    onChange={(e) => handleArticleChange('packageSize', e.target.value)}
                    className="w-full h-8 bg-white border-gray-300 text-gray-700"
                    placeholder="0"
                  />
                </div>
              )}

              {/* Net Weight */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">
                  Net Weight ({articleData.materialType === 'FG' ? 'gm' : 'Kg'}) *
                </Label>
                <Input
                  type="text"
                  value={articleData.netWeight}
                  readOnly
                  className="w-full h-8 bg-gray-100 border-gray-300 text-gray-700 cursor-not-allowed"
                  placeholder="Auto-calculated"
                />
              </div>

              {/* Batch Number */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">
                  Batch Number *
                </Label>
                <Input
                  type="text"
                  value={articleData.batchNumber}
                  onChange={(e) => handleArticleChange('batchNumber', e.target.value)}
                  className="w-full h-8 bg-white border-gray-300 text-gray-700"
                  placeholder="Enter batch number"
                />
              </div>

              {/* Lot Number */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">
                  Lot Number
                </Label>
                <Input
                  type="text"
                  value={articleData.lotNumber}
                  onChange={(e) => handleArticleChange('lotNumber', e.target.value)}
                  className="w-full h-8 bg-white border-gray-300 text-gray-700"
                  placeholder="Enter lot number (optional)"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Validation Errors Display */}
        {validationErrors.length > 0 && (
          <Card className="w-full bg-red-50 border-red-300">
            <CardHeader className="pb-3 bg-red-100">
              <CardTitle className="text-base font-semibold text-red-700 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Validation Errors ({validationErrors.length})
              </CardTitle>
              <p className="text-xs text-red-600">
                Please fix the following errors before submitting:
              </p>
            </CardHeader>
            <CardContent className="pt-0 bg-red-50">
              <ul className="space-y-2 mt-3">
                {validationErrors.map((error, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-red-700">
                    <span className="mt-0.5">•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Submit Request Button - At the end */}
        <Card className="w-full bg-gray-50 border-gray-200">
          <CardContent className="pt-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Request will be submitted with <span className="font-semibold text-gray-800">Pending</span> status
              </p>
              <div className="flex space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => router.back()}
                  className="h-8 px-3 text-xs bg-white border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  form="transfer-request-form"
                  disabled={isSubmitting}
                  className="bg-black hover:bg-gray-800 text-white h-8 px-3 text-xs disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-3 w-3" />
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
