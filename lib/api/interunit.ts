// Interunit Transfer API Service
import type { Company } from "@/types/auth"

// Base API URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Types for API responses
export interface InterUnitListItemEnhanced {
  id: number
  challan_no: string
  stock_trf_date: string
  from_site: string
  to_site: string
  status: InterUnitStatus
  lines_count: number
  qty_total: number
  vehicle_no?: string
  reason_code: string // Will be cast to ReasonCode when used
  created_by: string
  has_variance?: boolean
  request_id?: number
}

export interface InterUnitFiltersEnhanced {
  from_site?: string
  to_site?: string
  status?: string
  date_from?: string
  date_to?: string
  challan_no?: string
  vehicle_no?: string
  created_by?: string
  item_category?: string
  item_description?: string
  batch_number?: string
}

export type InterUnitStatus = "Pending" | "Approved" | "Cancelled" | "Accept"

// Request Types
export interface InterUnitRequest {
  id: number
  request_no: string
  request_date: string
  from_site: string
  to_site: string
  reason_code: string
  remarks: string
  status: InterUnitStatus
  reject_reason: string | null
  created_by: string
  created_ts: string
  rejected_ts: string | null
  updated_at: string
  lines: InterUnitRequestLine[]
}

export interface InterUnitRequestLine {
  id?: number
  request_id?: number
  rm_pm_fg_type: string
  item_category: string
  sub_category: string
  item_desc_raw: string
  item_id: number
  hsn_code?: string
  pack_size: number
  packaging_type: number
  qty: number
  uom: string
  net_weight: number
  total_weight: number
  batch_number: string
  lot_number?: string
  created_at?: string
  updated_at?: string
}

export interface InterUnitRequestLine {
  id?: number
  request_id?: number
  rm_pm_fg_type: string
  item_category: string
  sub_category: string
  item_desc_raw: string
  item_id: number
  hsn_code?: string
  pack_size: number
  packaging_type: number
  qty: number
  uom: string
  net_weight: number
  total_weight: number
  batch_number: string
  lot_number?: string
  created_at?: string
  updated_at?: string
}

export interface InterUnitRequestCreate {
  request_date: string
  from_site: string
  to_site: string
  reason_code: string
  remarks: string
  lines: Omit<InterUnitRequestLine, 'id' | 'request_id' | 'created_at' | 'updated_at'>[]
}

export interface InterUnitRequestUpdate {
  status: 'Accept' | 'Cancelled'
  reject_reason?: string | null
  rejected_ts?: string | null
}

export interface DeleteResponse {
  success: boolean
  message: string
}

// Transfer Types
export interface InterUnitTransferHeader {
  id: number
  challan_no: string
  stock_trf_date: string
  from_site: string
  to_site: string
  vehicle_no: string
  remark: string
  reason_code: string
  status: InterUnitStatus
  request_id?: number | null
  created_by: string
  created_ts: string
  approved_by?: string | null
  approved_ts?: string | null
  updated_ts: string
  has_variance: boolean
}

export interface InterUnitTransfer {
  header: InterUnitTransferHeader
  lines: InterUnitTransferLine[]
}

export interface InterUnitTransferLine {
  id: number
  header_id: number
  rm_pm_fg_type: string
  item_category: string
  sub_category: string
  item_desc_raw: string
  item_id: number
  hsn_code?: string
  pack_size: number
  packaging_type: number
  qty: number
  uom: string
  net_weight: number
  total_weight: number
  batch_number: string
  lot_number?: string
  created_at: string
  updated_at: string
}

export interface InterUnitTransferLineCreate {
  rm_pm_fg_type: string
  item_category: string
  sub_category: string
  item_desc_raw: string
  item_id: number
  hsn_code?: string
  pack_size: number
  packaging_type: number
  qty: number
  uom: string
  net_weight: number
  total_weight: number
  batch_number: string
  lot_number?: string
}

export interface InterUnitTransferCreate {
  header: {
    stock_trf_date: string
    from_site: string
    to_site: string
    vehicle_no: string
    remark: string
    reason_code: string
  }
  lines: InterUnitTransferLineCreate[]
  request_id?: number
}

// Box Management Types
export interface BoxCreate {
  box_number: number
  article: string
  lot_number: string
  net_weight: number
  gross_weight: number
}

export interface BoxResponse {
  id: number
  transfer_line_id: number
  header_id: number
  box_number: number
  article: string
  lot_number: string
  net_weight: number
  gross_weight: number
  created_at: string
  updated_at: string
}

// List Response
export interface InterUnitListResponse {
  items: InterUnitListItemEnhanced[]
  total: number
  pages: number
}

// API Service Class
export class InterUnitAPI {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  // Helper method to make API calls
  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error(`API Error for ${endpoint}:`, errorData)
        
        // Handle different error response formats
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        
        if (errorData.detail) {
          if (Array.isArray(errorData.detail)) {
            // FastAPI validation errors
            errorMessage = errorData.detail.map((err: any) => 
              `${err.loc?.join(' → ')}: ${err.msg}`
            ).join(', ')
          } else {
            errorMessage = errorData.detail
          }
        } else if (errorData.message) {
          errorMessage = errorData.message
        } else if (errorData.error) {
          errorMessage = errorData.error
        }
        
        throw new Error(errorMessage)
      }

      return response.json()
    } catch (error) {
      console.error(`API call failed for ${endpoint}:`, error)
      console.error(`Full error details:`, error)
      
      // For development, let's throw the error to see what's happening
      // In production, you might want to return empty data structures
      if (process.env.NODE_ENV === 'development') {
        throw error
      }
      
      // Return empty data structure to prevent app crash in production
      if (endpoint.includes('/transfers')) {
        return { items: [], total: 0, pages: 0 } as T
      }
      if (endpoint.includes('/requests')) {
        return [] as T
      }
      throw error
    }
  }

  // ================================================================================
  // TRANSFER ENDPOINTS (6 endpoints)
  // ================================================================================

  // 8. LIST TRANSFERS
  async list(
    filters: InterUnitFiltersEnhanced = {},
    page: number = 1,
    perPage: number = 20
  ): Promise<InterUnitListResponse> {
    const params = new URLSearchParams()

    // Add pagination
    params.append('page', page.toString())
    params.append('per_page', perPage.toString())

    // Add filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString())
      }
    })

    const endpoint = `/interunit/transfers?${params.toString()}`
    return this.apiCall<InterUnitListResponse>(endpoint)
  }

  // 9. GET SINGLE TRANSFER
  async getById(id: number | string): Promise<InterUnitTransfer> {
    return this.apiCall<InterUnitTransfer>(`/interunit/transfers/${id}`)
  }

  // Alias for getById for backward compatibility
  async get(id: number | string): Promise<InterUnitTransfer> {
    return this.getById(id)
  }

  // 6. CREATE TRANSFER
  async create(
    transferData: InterUnitTransferCreate,
    createdBy: string = 'user@example.com'
  ): Promise<InterUnitTransfer> {
    const params = new URLSearchParams()
    params.append('created_by', createdBy)

    return this.apiCall<InterUnitTransfer>(`/interunit/transfers?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify(transferData),
    })
  }

  // 10. UPDATE TRANSFER
  async update(id: number | string, transferData: InterUnitTransferCreate): Promise<InterUnitTransfer> {
    return this.apiCall<InterUnitTransfer>(`/interunit/transfers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(transferData),
    })
  }

  // 11. DELETE TRANSFER
  async delete(id: number | string): Promise<DeleteResponse> {
    return this.apiCall<DeleteResponse>(`/interunit/transfers/${id}`, {
      method: 'DELETE',
    })
  }

  // 7. APPROVE TRANSFER
  async approve(id: number | string, approvedBy: string = 'user@example.com'): Promise<InterUnitTransfer> {
    const params = new URLSearchParams()
    params.append('approved_by', approvedBy)

    return this.apiCall<InterUnitTransfer>(`/interunit/transfers/${id}/approve?${params.toString()}`, {
      method: 'POST',
    })
  }

  // ================================================================================
  // REQUEST ENDPOINTS (5 endpoints)
  // ================================================================================

  // 2. LIST TRANSFER REQUESTS
  async listRequests(filters: {
    status?: string
    from_site?: string
    to_site?: string
    created_by?: string
  } = {}): Promise<InterUnitRequest[]> {
    const params = new URLSearchParams()

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString())
      }
    })

    const endpoint = `/interunit/requests?${params.toString()}`
    return this.apiCall<InterUnitRequest[]>(endpoint)
  }

  // Get requests by user (for the main page)
  async getRequestsByUser(userEmail: string): Promise<InterUnitRequest[]> {
    const params = new URLSearchParams()
    params.append('created_by', userEmail)

    const endpoint = `/interunit/requests?${params.toString()}`
    return this.apiCall<InterUnitRequest[]>(endpoint)
  }

  // 3. GET SINGLE REQUEST
  async getRequestById(id: number | string): Promise<InterUnitRequest> {
    return this.apiCall<InterUnitRequest>(`/interunit/requests/${id}`)
  }

  // 1. CREATE TRANSFER REQUEST
  async createRequest(
    requestData: InterUnitRequestCreate,
    createdBy: string = 'user@example.com'
  ): Promise<InterUnitRequest> {
    const params = new URLSearchParams()
    params.append('created_by', createdBy)

    return this.apiCall<InterUnitRequest>(`/interunit/requests?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify(requestData),
    })
  }

  // 4. UPDATE REQUEST STATUS
  async updateRequest(
    id: number | string,
    updateData: InterUnitRequestUpdate
  ): Promise<InterUnitRequest> {
    return this.apiCall<InterUnitRequest>(`/interunit/requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    })
  }

  // Convenience method for accepting/rejecting requests
  async updateRequestStatus(
    id: number | string,
    status: 'Accept' | 'Cancelled',
    rejectReason?: string
  ): Promise<InterUnitRequest> {
    const updateData: InterUnitRequestUpdate = {
      status,
      reject_reason: status === 'Cancelled' ? rejectReason : null,
      rejected_ts: status === 'Cancelled' ? new Date().toISOString() : null,
    }
    return this.updateRequest(id, updateData)
  }

  // Edit request (full update) - Not in the documented API but keeping for backward compatibility
  async editRequest(id: number | string, requestData: InterUnitRequestCreate): Promise<InterUnitRequest> {
    return this.apiCall<InterUnitRequest>(`/interunit/requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(requestData),
    })
  }

  // 5. DELETE REQUEST
  async deleteRequest(id: number | string): Promise<DeleteResponse> {
    return this.apiCall<DeleteResponse>(`/interunit/requests/${id}`, {
      method: 'DELETE',
    })
  }

  // ================================================================================
  // BOX MANAGEMENT ENDPOINTS (4 endpoints)
  // ================================================================================

  // 12. CREATE BOX
  async createBox(
    transferId: number | string,
    lineId: number | string,
    boxData: BoxCreate
  ): Promise<BoxResponse> {
    return this.apiCall<BoxResponse>(
      `/interunit/transfers/${transferId}/lines/${lineId}/boxes`,
      {
        method: 'POST',
        body: JSON.stringify(boxData),
      }
    )
  }

  // 13. GET TRANSFER BOXES
  async getTransferBoxes(transferId: number | string): Promise<BoxResponse[]> {
    return this.apiCall<BoxResponse[]>(`/interunit/transfers/${transferId}/boxes`)
  }

  // 14. UPDATE BOX
  async updateBox(
    transferId: number | string,
    boxId: number | string,
    netWeight?: number,
    grossWeight?: number
  ): Promise<BoxResponse> {
    const params = new URLSearchParams()
    if (netWeight !== undefined) {
      params.append('net_weight', netWeight.toString())
    }
    if (grossWeight !== undefined) {
      params.append('gross_weight', grossWeight.toString())
    }

    return this.apiCall<BoxResponse>(
      `/interunit/transfers/${transferId}/boxes/${boxId}?${params.toString()}`,
      {
        method: 'PUT',
      }
    )
  }

  // 15. DELETE BOX
  async deleteBox(transferId: number | string, boxId: number | string): Promise<DeleteResponse> {
    return this.apiCall<DeleteResponse>(`/interunit/transfers/${transferId}/boxes/${boxId}`, {
      method: 'DELETE',
    })
  }

  // ================================================================================
  // EXPORT ENDPOINT (1 endpoint)
  // ================================================================================

  // 16. EXPORT TRANSFERS TO EXCEL
  async exportExcel(filters: InterUnitFiltersEnhanced = {}): Promise<Blob> {
    const params = new URLSearchParams()

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString())
      }
    })

    const endpoint = `/interunit/transfers/export/excel?${params.toString()}`
    const url = `${this.baseUrl}${endpoint}`

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response.blob()
  }

  // ================================================================================
  // ADDITIONAL UTILITY METHODS (Not in API documentation)
  // ================================================================================

  // Generate PDF for a specific transfer (custom method - not in API docs)
  async generatePDF(transferId: number | string): Promise<Blob> {
    const endpoint = `/interunit/transfers/${transferId}/pdf`
    const url = `${this.baseUrl}${endpoint}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf'
      },
    })

    if (!response.ok) {
      throw new Error(`PDF generation failed: ${response.status} ${response.statusText}`)
    }

    return response.blob()
  }
}

// Export singleton instance
export const interUnitAPI = new InterUnitAPI()
