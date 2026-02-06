// Approval Authorities API Service
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface ApprovalAuthority {
  id: number
  name: string
  email: string
  department?: string
  role: string
  is_active: boolean
  authority?: string
  contact_number?: string
}

export interface ApprovalAuthorityResponse {
  authorities: ApprovalAuthority[]
  total: number
}

export class ApprovalAuthoritiesAPI {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  async getAuthorities(params?: {
    search?: string
    department?: string
    role?: string
    limit?: number
    offset?: number
  }): Promise<ApprovalAuthorityResponse> {
    const query = new URLSearchParams()
    
    if (params?.search) query.append('search', params.search)
    if (params?.department) query.append('department', params.department)
    if (params?.role) query.append('role', params.role)
    if (params?.limit) query.append('limit', params.limit.toString())
    if (params?.offset) query.append('offset', params.offset.toString())

    const url = `${this.baseUrl}/api/approval-authorities?${query.toString()}`
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch approval authorities: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching approval authorities:', error)
      // Return fallback data for development
      return {
        authorities: [
          {
            id: 1,
            name: "Warehouse Manager",
            email: "warehouse@company.com",
            department: "Warehouse",
            role: "manager",
            is_active: true,
            authority: "Warehouse Operations",
            contact_number: "+1234567890"
          }
        ],
        total: 1
      }
    }
  }

  async getAuthorityById(id: number): Promise<ApprovalAuthority> {
    const url = `${this.baseUrl}/api/approval-authorities/${id}`
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch approval authority: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching approval authority:', error)
      throw error
    }
  }

  async getApprovalAuthoritiesByWarehouse(warehouse: string): Promise<ApprovalAuthority[]> {
    try {
      const url = `${this.baseUrl}/api/approval-authorities/by-warehouse/${warehouse}`
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch approval authorities for warehouse: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data.authorities || []
    } catch (error) {
      console.error('Error fetching approval authorities by warehouse:', error)
      // Return fallback data for development
      return [
        {
          id: 1,
          name: "Warehouse Manager",
          email: "warehouse@company.com",
          department: "Warehouse",
          role: "manager",
          is_active: true,
          authority: "Warehouse Operations",
          contact_number: "+1234567890"
        }
      ]
    }
  }
}

// Export singleton instance
export const approvalAuthoritiesAPI = new ApprovalAuthoritiesAPI()
