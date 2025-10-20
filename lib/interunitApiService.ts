// API client using fetch (same pattern as existing API)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function fetchJSON(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options?.headers
    },
    ...options
  })
  
  if (!response.ok) {
    let errorMessage = `API call failed: ${response.status} ${response.statusText}`
    let errorDetails = null
    
    try {
      const errorData = await response.json()
      errorDetails = errorData
      errorMessage += ` - ${JSON.stringify(errorData)}`
    } catch (e) {
      // If response is not JSON, use text
      try {
        const errorText = await response.text()
        errorDetails = errorText
        errorMessage += ` - ${errorText}`
      } catch (e2) {
        // If we can't read response, just use status
      }
    }
    
    const error = new Error(errorMessage)
    ;(error as any).response = { 
      data: errorDetails, 
      status: response.status,
      // Ensure data is always a string for display
      detail: typeof errorDetails === 'string' ? errorDetails : 
              (errorDetails?.detail || errorDetails?.message || JSON.stringify(errorDetails))
    }
    ;(error as any).config = { url }
    
    // Log the error for debugging
    console.error('API Error:', {
      message: errorMessage,
      status: response.status,
      details: errorDetails
    })
    
    throw error
  }
  
  return response.json()
}

// Types based on the API endpoints
export interface WarehouseSite {
  id: number
  site_code: string
  site_name: string
  is_active: boolean
}

export interface MaterialType {
  type: string
  description: string
}

export interface UOM {
  uom: string
  description: string
}

export interface ApprovalAuthority {
  id: number
  authority_name: string
  email: string
  is_active: boolean
}

export interface FormData {
  request_date: string
  from_warehouse: string
  to_warehouse: string
  reason_description: string
}

export interface ArticleData {
  material_type: string
  item_category: string
  sub_category: string
  item_description: string
  quantity: string
  uom: string
  pack_size: string
  package_size?: string
  batch_number?: string
  lot_number?: string
}

export interface RequestCreate {
  form_data: FormData
  article_data: ArticleData[]
  computed_fields?: {
    request_no?: string
  }
  validation_rules?: {
    from_warehouse_required: boolean
    from_warehouse_not_equal_to_warehouse: boolean
    to_warehouse_required: boolean
    to_warehouse_not_equal_from_warehouse: boolean
    material_type_required: boolean
    material_type_enum: string[]
    package_size_required: boolean
    package_size_conditional: string
  }
}

export interface RequestLine {
  id: number
  request_id: number
  material_type: string
  item_category: string
  sub_category: string
  item_description: string
  quantity: string
  uom: string
  pack_size: string
  package_size?: string
  net_weight: string
  batch_number?: string
  lot_number?: string
  created_at: string
  updated_at: string
}

export interface RequestResponse {
  id: number
  request_no: string
  request_date: string
  from_warehouse: string
  to_warehouse: string
  reason_description: string
  status: string
  reject_reason?: string
  created_by: string
  created_ts: string
  rejected_ts?: string
  updated_at: string
  lines: RequestLine[]
}

export interface RequestListResponse {
  records: RequestResponse[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

// Backend response format (direct array with count)
export interface BackendRequestListResponse {
  value: RequestResponse[]
  Count: number
}

// API Service Class
export class InterunitApiService {
  // Dropdown endpoints
  static async getWarehouseSites(activeOnly: boolean = true): Promise<WarehouseSite[]> {
    return await fetchJSON(`${API_BASE_URL}/interunit/dropdowns/warehouse-sites?active_only=${activeOnly}`)
  }

  static async getMaterialTypes(): Promise<MaterialType[]> {
    return await fetchJSON(`${API_BASE_URL}/interunit/dropdowns/material-types`)
  }

  static async getUOM(): Promise<UOM[]> {
    return await fetchJSON(`${API_BASE_URL}/interunit/dropdowns/uom`)
  }

  static async getApprovalAuthorities(): Promise<ApprovalAuthority[]> {
    return await fetchJSON(`${API_BASE_URL}/interunit/dropdowns/approval-authorities`)
  }

  // Request endpoints
  static async createRequest(
    requestData: RequestCreate,
    createdBy: string = 'user@example.com'
  ): Promise<RequestResponse> {
    const url = `${API_BASE_URL}/interunit/requests?created_by=${createdBy}`
    console.log('🌐 InterunitApiService.createRequest called')
    console.log('🔗 URL:', url)
    console.log('📤 Request Data:', JSON.stringify(requestData, null, 2))
    
    const response = await fetchJSON(url, {
      method: 'POST',
      body: JSON.stringify(requestData)
    })
    
    console.log('📥 InterunitApiService.createRequest response:', JSON.stringify(response, null, 2))
    return response
  }

  static async getRequests(params?: {
    page?: number
    per_page?: number
    status?: string
    from_warehouse?: string
    to_warehouse?: string
    from_date?: string
    to_date?: string
    sort_by?: string
    sort_order?: string
  }): Promise<RequestListResponse> {
    const queryParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString())
        }
      })
    }
    
    const url = `${API_BASE_URL}/interunit/requests?${queryParams.toString()}`
    console.log('🌐 InterunitApiService.getRequests called')
    console.log('🔗 URL:', url)
    console.log('📋 Params:', params)
    
    const backendResponse = await fetchJSON(url)
    console.log('📥 InterunitApiService.getRequests backend response:', JSON.stringify(backendResponse, null, 2))
    
    // Backend returns a direct array, not an object with Count and value
    const recordsArray = Array.isArray(backendResponse) ? backendResponse : []
    
    // Transform backend response to expected format
    const page = params?.page || 1
    const perPage = params?.per_page || 10
    const total = recordsArray.length  // Total records in current response
    const totalPages = Math.ceil(total / perPage)
    
    console.log('✅ Transformed response:', {
      records_count: recordsArray.length,
      total,
      page,
      per_page: perPage,
      total_pages: totalPages
    })
    
    return {
      records: recordsArray,
      total,
      page,
      per_page: perPage,
      total_pages: totalPages
    }
  }

  static async getRequest(requestId: number): Promise<RequestResponse> {
    return await fetchJSON(`${API_BASE_URL}/interunit/requests/${requestId}`)
  }

  static async updateRequest(
    requestId: number,
    updateData: {
      status?: string
      reject_reason?: string
      rejected_ts?: string
    }
  ): Promise<RequestResponse> {
    return await fetchJSON(`${API_BASE_URL}/interunit/requests/${requestId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    })
  }

  static async deleteRequest(requestId: number): Promise<{ success: boolean; message: string }> {
    console.log('🌐 InterunitApiService.deleteRequest called')
    console.log('🔗 Request ID:', requestId)

    const response = await fetchJSON(`${API_BASE_URL}/interunit/requests/${requestId}`, {
      method: 'DELETE'
    })

    console.log('📥 Delete response:', response)
    return response
  }

  // Utility endpoints
  static async generateRequestNumber(): Promise<{ request_no: string }> {
    return await fetchJSON(`${API_BASE_URL}/interunit/utils/generate-request-number`)
  }

  static async generateTransferNumber(): Promise<{ transfer_no: string }> {
    return await fetchJSON(`${API_BASE_URL}/interunit/utils/generate-transfer-number`)
  }

  // Statistics endpoint
  static async getStatsSummary(): Promise<{
    total_requests: number
    total_transfers: number
    request_status: Record<string, number>
    transfer_status: Record<string, number>
    warehouse_stats: Record<string, { total_outbound: number; total_inbound: number }>
  }> {
    return await fetchJSON(`${API_BASE_URL}/interunit/stats/summary`)
  }

  // Submit transfer with scanned boxes and transport info
  static async submitTransfer(company: string, payload: any): Promise<any> {
    console.log('🌐 InterunitApiService.submitTransfer called')
    console.log('Company:', company)
    console.log('Payload:', payload)

    try {
      // Correct endpoint: /interunit/transfers (not /transfer/interunit)
      const url = `${API_BASE_URL}/interunit/transfers`
      console.log('📡 API URL:', url)

      const response = await fetchJSON(url, {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      console.log('✅ API Response:', response)
      return response
    } catch (error: any) {
      console.error('❌ API Error in submitTransfer:', error)
      throw error
    }
  }

  // Get transfer out records
  static async getTransfers(params?: {
    page?: number
    per_page?: number
    status?: string
    from_site?: string
    to_site?: string
    from_date?: string
    to_date?: string
    sort_by?: string
    sort_order?: string
  }): Promise<any> {
    console.log('🌐 InterunitApiService.getTransfers called')
    console.log('Params:', params)
    
    try {
      const queryParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) {
            queryParams.append(key, value.toString())
          }
        })
      }
      
      const url = `${API_BASE_URL}/interunit/transfers?${queryParams.toString()}`
      console.log('📡 API URL:', url)
      
      const response = await fetchJSON(url)
      
      console.log('✅ API Response:', response)
      return response
    } catch (error: any) {
      console.error('❌ API Error in getTransfers:', error)
      throw error
    }
  }

  // Get single transfer by ID
  static async getTransferById(company: string, transferId: string): Promise<any> {
    try {
      const url = `${API_BASE_URL}/interunit/transfers/${transferId}`
      const response = await fetchJSON(url)
      return response
    } catch (error: any) {
      throw error
    }
  }

  // Get transfer by transfer number (challan_no)
  static async getTransferByNumber(company: string, transferNumber: string): Promise<any> {
    try {
      console.log('🔍 Searching for transfer number:', transferNumber)
      const url = `${API_BASE_URL}/interunit/transfers?challan_no=${encodeURIComponent(transferNumber)}&per_page=1`
      console.log('📡 API URL:', url)
      
      const response = await fetchJSON(url)
      console.log('📦 API Response:', response)
      
      // Check if we have records (the actual field name in the API response)
      if (response.records && response.records.length > 0) {
        const transferItem = response.records[0]
        console.log('✅ Found transfer:', transferItem)
        // Now fetch full details using the ID
        return await this.getTransferById(company, transferItem.id.toString())
      } else {
        console.log('❌ No transfer found in response')
        throw new Error(`Transfer ${transferNumber} not found`)
      }
    } catch (error: any) {
      console.error('❌ Error in getTransferByNumber:', error)
      throw error
    }
  }
}

// Helper functions for form data transformation
export const transformFormDataToApi = (
  formData: {
    requestDate: string
    fromWarehouse: string
    toWarehouse: string
    reasonDescription: string
  },
  articleData: {
    materialType: string
    itemCategory: string
    subCategory: string
    itemDescription: string
    quantity: string
    uom: string
    packSize: string
    packageSize: string
    netWeight: string
  }[],
  requestNo?: string
): RequestCreate => {
  // Generate request number if not provided
  const generateRequestNo = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    return `REQ${year}${month}${day}${hour}${minute}${second}`
  }

  return {
    form_data: {
      request_date: formData.requestDate,
      from_warehouse: formData.fromWarehouse,
      to_warehouse: formData.toWarehouse,
      reason_description: formData.reasonDescription
    },
    article_data: articleData.map(article => ({
      material_type: article.materialType,
      item_category: article.itemCategory,
      sub_category: article.subCategory,
      item_description: article.itemDescription,
      quantity: article.quantity,
      uom: article.uom,
      pack_size: article.packSize,
      package_size: article.packageSize || "0", // Default to "0" if empty
      batch_number: "BATCH-001", // Default batch number
      lot_number: "LOT-001" // Default lot number
    })),
    computed_fields: {
      request_no: requestNo || generateRequestNo()
    },
    validation_rules: {
      from_warehouse_required: true,
      from_warehouse_not_equal_to_warehouse: true,
      to_warehouse_required: true,
      to_warehouse_not_equal_from_warehouse: true,
      material_type_required: true,
      material_type_enum: ["RM", "PM", "FG", "RTV"],
      package_size_required: true,
      package_size_conditional: "Only when materialType === 'FG'"
    }
  }
}

// Validation helper
export const validateRequestData = (formData: FormData, articleData: ArticleData[]): string[] => {
  const errors: string[] = []

  // Form data validation
  if (!formData.request_date) {
    errors.push('Request date is required')
  }
  if (!formData.from_warehouse) {
    errors.push('From warehouse is required')
  }
  if (!formData.to_warehouse) {
    errors.push('To warehouse is required')
  }
  if (formData.from_warehouse === formData.to_warehouse) {
    errors.push('From warehouse and to warehouse must be different')
  }
  if (!formData.reason_description) {
    errors.push('Reason description is required')
  }

  // Article data validation
  if (articleData.length === 0) {
    errors.push('At least one article is required')
  }

  articleData.forEach((article, index) => {
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
    if (!article.quantity || article.quantity === '0') {
      errors.push(`Article ${index + 1}: Quantity must be greater than 0`)
    }
    if (!article.uom) {
      errors.push(`Article ${index + 1}: UOM is required`)
    }
    if (!article.pack_size || article.pack_size === '0' || article.pack_size === '0.00') {
      errors.push(`Article ${index + 1}: Pack size must be greater than 0`)
    }
    if (article.material_type === 'FG' && (!article.package_size || article.package_size === '0')) {
      errors.push(`Article ${index + 1}: Package size is required for FG material type`)
    }
    if (!article.batch_number || article.batch_number.trim() === '') {
      errors.push(`Article ${index + 1}: Batch number is required`)
    }
  })

  return errors
}
