// RTV API Service
// Location: lib/api/rtvApiService.ts

import type { Company } from "@/types/auth"
import type { RTVFormData, RTVRecord } from "@/types/rtv"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// Customer interface for dropdown
export interface Customer {
  value: string
  label: string
}

// Validate box interfaces
export interface ValidateBoxResponse {
  valid: boolean
  message: string
  existing_rtv?: string
}

// Create RTV interfaces (based on actual backend API)
export interface RTVItem {
  transaction_no: string
  box_number: number
  sub_category: string
  item_description: string
  net_weight: number
  gross_weight: number
  price: number
  reason: string
  qr_data: any
}

export interface CreateRTVRequest {
  customer_code: string
  customer_name: string
  rtv_type: string
  other_reason?: string | null
  rtv_date: string // YYYY-MM-DD format
  invoice_number: string
  dc_number: string
  notes: string
  created_by: string
  items: RTVItem[]
}

export interface CreateRTVResponse {
  success: boolean
  rtv_number: string
  message: string
}

// List response interfaces
export interface RTVListResponse {
  success: boolean
  data: RTVRecord[]
  total: number
  page: number
  limit: number
}

// Legacy interface kept for backward compatibility
export interface RTVCreateResponse {
  rtv_id: string
  rtv_number: string
  status: string
  message: string
}

export const rtvApi = {
  /**
   * Get customers list (Using same endpoint as inward module)
   */
  async getCustomers(company: Company): Promise<{ success: boolean; data: Customer[] }> {
    try {
      // Use the same working endpoint as inward module
      const url = `${API_URL}/api/dropdown/customers?company=${company}`
      console.log('🌐 RTVApi.getCustomers called')
      console.log('🔗 URL:', url)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Failed to fetch customers:', errorText)
        throw new Error(`Failed to fetch customers: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('📥 Customers API response:', data)
      
      // Transform the response to match our expected format
      // API returns: { customers: [{id, customer_name, name}] }
      // We need: { success: true, data: [{value, label}] }
      const transformedData = {
        success: true,
        data: (data.customers || []).map((customer: any) => ({
          value: customer.customer_name || customer.name || customer.id?.toString() || '',
          label: customer.customer_name || customer.name || customer.id?.toString() || ''
        }))
      }
      
      console.log('✅ Transformed customers:', transformedData)
      return transformedData
    } catch (error) {
      console.error("❌ Error fetching customers:", error)
      throw error
    }
  },

  /**
   * Validate box - check if transaction_no already exists in any RTV (NEW - based on backend API)
   */
  async validateBox(company: Company, transactionNo: string): Promise<ValidateBoxResponse> {
    try {
      const url = `${API_URL}/rtv/validate-box?company=${company}`
      console.log('🌐 RTVApi.validateBox called')
      console.log('🔗 URL:', url)
      console.log('📤 Transaction No:', transactionNo)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transaction_no: transactionNo }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Failed to validate box:', errorText)
        throw new Error(`Failed to validate box: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('📥 Validate box response:', data)
      return data
    } catch (error) {
      console.error("❌ Error validating box:", error)
      throw error
    }
  },

  /**
   * Create RTV (UPDATED - based on actual backend API)
   */
  async createRTV(company: Company, rtvData: CreateRTVRequest): Promise<CreateRTVResponse> {
    try {
      const url = `${API_URL}/rtv/create?company=${company}`
      console.log('🌐 RTVApi.createRTV called')
      console.log('🔗 URL:', url)
      console.log('� RTV Data:', JSON.stringify(rtvData, null, 2))

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rtvData),
      })

      if (!response.ok) {
        let errorMessage = `Failed to create RTV: ${response.status} ${response.statusText}`
        let errorDetails = null

        try {
          const errorData = await response.json()
          errorDetails = errorData
          errorMessage += ` - ${JSON.stringify(errorData)}`
        } catch (e) {
          try {
            const errorText = await response.text()
            errorDetails = errorText
            errorMessage += ` - ${errorText}`
          } catch (e2) {
            // If we can't read response, just use status
          }
        }

        console.error('❌ Failed to create RTV:', errorMessage)
        const error = new Error(errorMessage)
        ;(error as any).response = {
          data: errorDetails,
          status: response.status,
        }
        throw error
      }

      const data = await response.json()
      console.log('📥 Create RTV response:', data)
      return data
    } catch (error) {
      console.error("❌ Error creating RTV:", error)
      throw error
    }
  },

  /**
   * Get list of RTV records with pagination and filters (UPDATED for new backend)
   */
  async getRTVList(
    company: Company,
    params?: {
      page?: number
      limit?: number
      status?: string
      date_from?: string
      date_to?: string
    }
  ): Promise<RTVListResponse> {
    try {
      const queryParams = new URLSearchParams()
      queryParams.append("company", company)
      
      if (params?.page) queryParams.append("page", params.page.toString())
      if (params?.limit) queryParams.append("limit", params.limit.toString())
      if (params?.status) queryParams.append("status", params.status)
      if (params?.date_from) queryParams.append("date_from", params.date_from)
      if (params?.date_to) queryParams.append("date_to", params.date_to)

      const url = `${API_URL}/rtv/list?${queryParams.toString()}`
      console.log("📡 Fetching RTV list:", url)

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log("✅ RTV list fetched:", data)
      return data
    } catch (error) {
      console.error("❌ Error fetching RTV list:", error)
      throw error
    }
  },

  /**
   * Get RTV details by RTV number (UPDATED for new backend)
   */
  async getRTVById(company: Company, rtvNumber: string): Promise<RTVRecord> {
    try {
      const url = `${API_URL}/rtv/${rtvNumber}?company=${company}`
      console.log("📡 Fetching RTV details:", url)

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log("✅ RTV details fetched:", data)
      return data
    } catch (error) {
      console.error("❌ Error fetching RTV details:", error)
      throw error
    }
  },

  /**
   * Update RTV status (UPDATED for new backend)
   */
  async updateRTVStatus(
    company: Company,
    rtvNumber: string,
    status: "approved" | "rejected" | "completed" | "pending" | "cancelled",
    remarks?: string
  ): Promise<{ success: boolean; message: string; rtv_number: string }> {
    try {
      const url = `${API_URL}/rtv/${rtvNumber}/status?company=${company}`
      console.log("📡 Updating RTV status:", url)

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status, remarks }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log("✅ RTV status updated:", data)
      return data
    } catch (error) {
      console.error("❌ Error updating RTV status:", error)
      throw error
    }
  },

  /**
   * Delete RTV by RTV number
   * NOTE: Backend DELETE endpoint not yet implemented (returns 405)
   * Using status update to 'cancelled' as a soft delete alternative
   */
  async deleteRTV(company: Company, rtvNumber: string): Promise<{ success: boolean; message: string }> {
    try {
      // Try hard delete first
      const url = `${API_URL}/rtv/${rtvNumber}?company=${company}`
      console.log("📡 Attempting to delete RTV:", url)

      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        console.log("✅ RTV deleted:", data)
        return data
      }

      // If DELETE not supported (405), fallback to soft delete via status update
      if (response.status === 405) {
        console.warn("⚠️ DELETE method not allowed, using soft delete (status=rejected)")
        const softDeleteResult = await this.updateRTVStatus(company, rtvNumber, "rejected", "Deleted by user")
        return {
          success: true,
          message: `RTV ${rtvNumber} has been rejected (soft deleted)`,
        }
      }

      // Other errors
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    } catch (error) {
      console.error("❌ Error deleting RTV:", error)
      throw error
    }
  },

  // Legacy methods kept for backward compatibility
  
  /**
   * Get vendors list (LEGACY - kept for other modules)
   */
  async getVendors(company: Company): Promise<Array<{ code: string; name: string }>> {
    try {
      const url = `${API_URL}/vendors/${company}`
      console.log("📡 Fetching vendors:", url)

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log("✅ Vendors fetched:", data)
      return data
    } catch (error) {
      console.error("❌ Error fetching vendors:", error)
      throw error
    }
  },

  /**
   * Get box/transaction details for QR scanning
   */
  async getBoxDetails(
    company: Company,
    transactionNo: string,
    skuId?: string,
    boxNumber?: number
  ): Promise<any> {
    try {
      const url = `${API_URL}/inward/${company}/${encodeURIComponent(transactionNo)}`
      console.log("📡 Fetching box details:", url)

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log("✅ Box details fetched:", data)

      // If specific SKU and box number provided, filter the result
      if (skuId && boxNumber !== undefined) {
        // Filter logic here based on your backend response structure
        return data
      }

      return data
    } catch (error) {
      console.error("❌ Error fetching box details:", error)
      throw error
    }
  },
}
