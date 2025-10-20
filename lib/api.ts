// lib/api.ts
import { useEffect, useState } from "react"

export type Company = "CDPL" | "CFPL" | "JTC" | "HOH"

type Option = { value: string; label: string }

// Dropdown response interface
export interface DropdownResponse {
  company: Company
  selected: {
    item_description: string | null
    item_category: string | null
    sub_category: string | null
  }
  auto_selection: {
    resolved_from_item: {
      item_category: string | null
      sub_category: string | null
    }
    resolved_from_category_sub: {
      item_descriptions: string[]
    }
  }
  options: {
    material_types?: string[]
    item_descriptions: string[]
    item_categories: string[]
    sub_categories: string[]
    item_ids?: number[] // Add item_ids to track the actual database IDs
  }
  meta: {
    total_item_descriptions: number
    total_categories: number
    total_sub_categories: number
    limit: number
    offset: number
    sort: "alpha" | "recent"
    search: string | null
  }
}

async function fetchJSON(url: string) {
  const res = await fetch(url, { headers: { Accept: "application/json" } })
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return res.json()
}

export function useItemCategories({ company }: { company: string }) {
  const [options, setOptions] = useState<Option[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchJSON(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/dropdowns/item-categories?company=${company}`)
        if (!cancelled) {
          setOptions((Array.isArray(data) ? data : []).map((x: any) => ({
            value: String(x.value ?? x.id ?? x.code ?? x.name ?? ""),
            label: String(x.label ?? x.name ?? x.title ?? x.value ?? ""),
          })))
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load item categories")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [company])
  return { options, loading, error }
}

export function useSubGroups(item_category: string, { company }: { company: string }) {
  const [options, setOptions] = useState<Option[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!item_category) {
      setOptions([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const q = new URLSearchParams({ company, item_category }).toString()
        const data = await fetchJSON(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/dropdowns/sub-categories?${q}`)
        if (!cancelled) {
          setOptions((Array.isArray(data) ? data : []).map((x: any) => ({
            value: String(x.value ?? x.id ?? x.code ?? x.name ?? ""),
            label: String(x.label ?? x.name ?? x.title ?? x.value ?? ""),
          })))
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load sub categories")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [company, item_category])
  return { options, loading, error }
}

export function useItemDescriptions({ company, item_category, sub_category }: { company: string, item_category: string, sub_category: string }) {
  const [options, setOptions] = useState<Option[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!item_category || !sub_category) {
      setOptions([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const q = new URLSearchParams({ company, item_category, sub_category }).toString()
        const data = await fetchJSON(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/dropdowns/item-descriptions?${q}`)
        if (!cancelled) {
          setOptions((Array.isArray(data) ? data : []).map((x: any) => ({
            // IMPORTANT: value is a stable code/key, label is the human string we display
            value: String(x.value ?? x.code ?? x.id ?? x.name ?? x.label ?? ""),
            label: String(x.label ?? x.name ?? x.title ?? x.value ?? ""),
          })))
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load item descriptions")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [company, item_category, sub_category])
  return { options, loading, error }
}

// API client for authentication and company management
export const authApi = {
  async fetchCompanies(): Promise<Array<{
    code: string
    name: string
    role: string
  }>> {
    try {
      console.log("=== FETCHING COMPANIES FROM API ===")
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/auth/companies`
      console.log("Companies API URL:", apiUrl)
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Companies API call failed: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log("Companies API Response:", data)
      console.log("=== END COMPANIES FETCH ===")
      
      return data.companies || data || []
    } catch (error) {
      console.error("Error fetching companies:", error)
      throw error
    }
  },

  async fetchDashboardInfo(companyCode: string): Promise<{
    company: {
      code: string
      name: string
      role: string
    }
    dashboard: {
      stats: any
      permissions: any
    }
  }> {
    try {
      console.log("=== FETCHING DASHBOARD INFO FROM API ===")
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/auth/company/${companyCode}/dashboard-info`
      console.log("Dashboard Info API URL:", apiUrl)
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Dashboard Info API call failed: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log("Dashboard Info API Response:", data)
      console.log("=== END DASHBOARD INFO FETCH ===")
      
      return data
    } catch (error) {
      console.error("Error fetching dashboard info:", error)
      throw error
    }
  },

  // Dashboard API functions
  async fetchDashboardStats(companyCode: string): Promise<{
    totalInward: number
    totalTransfers: number
    pendingLabels: number
    activeItems: number
    weeklyInwardChange: number
    weeklyTransferChange: number
  }> {
    try {
      // Use the correct endpoint: /auth/company/{companyCode}/dashboard-info
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/auth/company/${companyCode}/dashboard-info`
      console.log("Dashboard Stats API URL:", apiUrl)

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          console.warn("Dashboard stats endpoint not available, using fallback data")
        } else {
          throw new Error(`Dashboard Stats API call failed: ${response.status} ${response.statusText}`)
        }
      }

      if (response.ok) {
        const data = await response.json()
        console.log("Dashboard Stats API Response:", data)

        // Extract stats from dashboard object in the response
        const stats = data.dashboard?.stats || {}
        return {
          totalInward: stats.total_inward || 0,
          totalTransfers: stats.total_transfers || 0,
          pendingLabels: stats.pending_labels || 0,
          activeItems: stats.active_items || 0,
          weeklyInwardChange: stats.weekly_inward_change || 0,
          weeklyTransferChange: stats.weekly_transfer_change || 0
        }
      }

      // Fallback data if endpoint doesn't exist
      return {
        totalInward: 0,
        totalTransfers: 0,
        pendingLabels: 0,
        activeItems: 0,
        weeklyInwardChange: 0,
        weeklyTransferChange: 0
      }
    } catch (error) {
      console.error("Error fetching dashboard stats:", error)
      // Return fallback data if API fails
      return {
        totalInward: 0,
        totalTransfers: 0,
        pendingLabels: 0,
        activeItems: 0,
        weeklyInwardChange: 0,
        weeklyTransferChange: 0
      }
    }
  },

  async fetchRecentInward(companyCode: string, limit: number = 5): Promise<any[]> {
    try {
      // Use the same API endpoint as the inward module
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/inward/${companyCode}?per_page=${limit}&page=1`
      console.log("Recent Inward API URL:", apiUrl)
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Recent Inward API call failed: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log("Recent Inward API Response:", data)
      
      // Transform the data to match dashboard format
      return (data.records || []).map((record: any) => ({
        id: record.transaction_id,
        slip_no: record.transaction_id,
        entry_date: record.entry_date,
        invoice_number: record.invoice_number,
        po_number: record.po_number,
        item_description: record.item_descriptions?.[0] || 'N/A',
        item_descriptions: record.item_descriptions || [],
        quantities_and_uoms: record.quantities_and_uoms || [],
        vendor_supplier_name: 'N/A', // This might need to be fetched from detail
        quantity_units: record.quantities_and_uoms?.[0]?.split(' ')?.[0] || '0',
        uom: record.quantities_and_uoms?.[0]?.split(' ')?.[1] || 'pcs',
        status: 'Completed', // Default status since we don't have this in list
        transaction_type: 'Purchase', // Default since we don't have this in list
        transaction_no: record.transaction_id,
        transaction_id: record.transaction_id
      }))
    } catch (error) {
      console.error("Error fetching recent inward:", error)
      return []
    }
  },

  async fetchRecentTransfers(companyCode: string, limit: number = 5): Promise<any[]> {
    try {
      // Use the correct endpoint: /transfer/requests
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/transfer/requests?per_page=${limit}&page=1`
      console.log("Recent Transfers API URL:", apiUrl)

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          console.warn("Transfer endpoint not available, returning empty array")
          return []
        } else {
          throw new Error(`Recent Transfers API call failed: ${response.status} ${response.statusText}`)
        }
      }

      const data = await response.json()
      console.log("Recent Transfers API Response:", data)

      // Transform the data to match dashboard format
      return (data.records || []).map((record: any) => ({
        id: record.transfer_id,
        source_location: record.source_location || 'N/A',
        destination_location: record.destination_location || 'N/A',
        transfer_date: record.transfer_date || record.created_at || 'N/A',
        status: record.status || 'Completed',
        approved_by: record.approved_by || 'System'
      }))
    } catch (error) {
      console.error("Error fetching recent transfers:", error)
      return []
    }
  },

  // Daily Summary Functions
  async fetchTodayInwardSummary(companyCode: string): Promise<{ count: number; total: number }> {
    try {
      const today = new Date().toISOString().split('T')[0] // Format: YYYY-MM-DD
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/inward/${companyCode}?from_date=${today}&to_date=${today}&per_page=1000&page=1`
      console.log("Today's Inward Summary API URL:", apiUrl)

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Today's Inward Summary API call failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log("Today's Inward Summary API Response:", data)

      return {
        count: data.total || data.records?.length || 0,
        total: data.total || data.records?.length || 0
      }
    } catch (error) {
      console.error("Error fetching today's inward summary:", error)
      return { count: 0, total: 0 }
    }
  },

  async fetchTodayOutwardSummary(companyCode: string): Promise<{ count: number; total: number }> {
    try {
      const today = new Date().toISOString().split('T')[0] // Format: YYYY-MM-DD
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/outward/${companyCode}?from_date=${today}&to_date=${today}&per_page=1000&page=1`
      console.log("Today's Outward Summary API URL:", apiUrl)

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          console.warn("Outward endpoint not available, returning zero counts")
          return { count: 0, total: 0 }
        }
        throw new Error(`Today's Outward Summary API call failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log("Today's Outward Summary API Response:", data)

      return {
        count: data.total || data.records?.length || 0,
        total: data.total || data.records?.length || 0
      }
    } catch (error) {
      console.error("Error fetching today's outward summary:", error)
      return { count: 0, total: 0 }
    }
  },

  async fetchTodayTransferSummary(companyCode: string): Promise<{ count: number; total: number }> {
    try {
      const today = new Date().toISOString().split('T')[0] // Format: YYYY-MM-DD
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/transfer/requests?from_date=${today}&to_date=${today}&per_page=1000&page=1`
      console.log("Today's Transfer Summary API URL:", apiUrl)

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          console.warn("Transfer endpoint not available, returning zero counts")
          return { count: 0, total: 0 }
        }
        throw new Error(`Today's Transfer Summary API call failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log("Today's Transfer Summary API Response:", data)

      return {
        count: data.total || data.records?.length || 0,
        total: data.total || data.records?.length || 0
      }
    } catch (error) {
      console.error("Error fetching today's transfer summary:", error)
      return { count: 0, total: 0 }
    }
  },

  // All-Time Summary Functions
  async fetchAllTimeInwardTotal(companyCode: string): Promise<number> {
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/inward/${companyCode}?per_page=1&page=1`
      console.log("All-Time Inward Total API URL:", apiUrl)

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`All-Time Inward Total API call failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log("All-Time Inward Total API Response:", data)

      return data.total || 0
    } catch (error) {
      console.error("Error fetching all-time inward total:", error)
      return 0
    }
  },

  async fetchAllTimeOutwardTotal(companyCode: string): Promise<number> {
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/outward/${companyCode}?per_page=1&page=1`
      console.log("All-Time Outward Total API URL:", apiUrl)

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          console.warn("Outward endpoint not available, returning zero")
          return 0
        }
        throw new Error(`All-Time Outward Total API call failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log("All-Time Outward Total API Response:", data)

      return data.total || 0
    } catch (error) {
      console.error("Error fetching all-time outward total:", error)
      return 0
    }
  },

  async fetchAllTimeTransferTotal(companyCode: string): Promise<number> {
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/transfer/requests?per_page=1&page=1`
      console.log("All-Time Transfer Total API URL:", apiUrl)

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          console.warn("Transfer endpoint not available, returning zero")
          return 0
        }
        throw new Error(`All-Time Transfer Total API call failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log("All-Time Transfer Total API Response:", data)

      return data.total || 0
    } catch (error) {
      console.error("Error fetching all-time transfer total:", error)
      return 0
    }
  }
}

// API client for dropdown and SKU ID fetching
export const dropdownApi = {
  async fetchDropdown(params: {
    company: Company
    material_type?: string
    item_category?: string
    sub_category?: string
    search?: string
    limit?: number
    offset?: number
  }): Promise<DropdownResponse> {
    const { company, material_type, item_category, sub_category, search, limit, offset } = params
    
    const query = new URLSearchParams()
    query.append('company', company)
    if (material_type) query.append('material_type', material_type)
    if (item_category) query.append('item_category', item_category)
    if (sub_category) query.append('sub_category', sub_category)
    if (search) query.append('search', search)
    if (limit) query.append('limit', limit.toString())
    if (offset) query.append('offset', offset.toString())
    
    try {
      console.log("=== CALLING REAL API ===")
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/sku/dropdown?${query.toString()}`
      console.log("API URL:", apiUrl)
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log("API Response:", data)
      console.log("=== END REAL API CALL ===")
      
      return data
    } catch (error) {
      console.error("Error fetching dropdown:", error)
      // Return empty response on error
      return {
        company,
        selected: { item_description: null, item_category: null, sub_category: null },
        auto_selection: {
          resolved_from_item: { item_category: null, sub_category: null },
          resolved_from_category_sub: { item_descriptions: [] }
        },
        options: { material_types: [], item_descriptions: [], item_categories: [], sub_categories: [] },
        meta: {
          total_item_descriptions: 0,
          total_categories: 0,
          total_sub_categories: 0,
          limit: limit || 500,
          offset: offset || 0,
          sort: "alpha",
          search: search || null
        }
      }
    }
  },

  async fetchSkuId(params: {
    company: string
    item_description: string
    item_category?: string
    sub_category?: string
    material_type?: string
  }): Promise<{ id?: number; sku_id?: number; ID?: number; SKU_ID?: number; material_type?: string; group?: string; sub_group?: string }> {
    const { company, item_description, item_category, sub_category, material_type } = params
    
    console.log("=== FETCHING SKU ID FROM REAL API ===")
    console.log("Fetching SKU ID for:", { company, item_description, item_category, sub_category, material_type })
    
    try {
      const query = new URLSearchParams()
      query.append('company', company)
      query.append('item_description', item_description)
      if (item_category) query.append('item_category', item_category)
      if (sub_category) query.append('sub_category', sub_category)
      if (material_type) query.append('material_type', material_type)
      
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/sku/id?${query.toString()}`
      console.log("SKU ID API URL:", apiUrl)
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`SKU ID API call failed: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log("SKU ID API Response:", data)
      console.log("=== END SKU ID FETCH ===")
      
      // The API returns {id, item_description, material_type, group, sub_group, company}
      // We need to return it in the format expected by the calling code
      return { 
        sku_id: data.id,
        id: data.id,
        ID: data.id,
        SKU_ID: data.id,
        material_type: data.material_type,
        group: data.group,
        sub_group: data.sub_group
      }
    } catch (error) {
      console.error("Error fetching SKU ID:", error)
      throw error // Re-throw the error so calling code can handle it
    }
  },

  async getVendors(params: {
    company?: Company
    vendor_name?: string
  }): Promise<{
    options: {
      vendor_names: string[]
      vendor_ids: number[]
      locations: string[]
    }
    auto_selection: {
      resolved_from_vendor: {
        location: string
      }
    }
  }> {
    const { company, vendor_name } = params
    
    console.log("=== FETCHING VENDORS FROM API ===")
    console.log("Fetching vendors for:", { company, vendor_name })
    
    try {
      const query = new URLSearchParams()
      if (company) query.append('company', company)
      if (vendor_name) query.append('vendor_name', vendor_name)
      
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/api/dropdown/vendors?${query.toString()}`
      console.log("Vendors API URL:", apiUrl)
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Vendors API call failed: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log("Vendors API Response:", data)
      console.log("=== END VENDORS FETCH ===")
      
      return data
    } catch (error) {
      console.error("Error fetching vendors:", error)
      throw error // Re-throw the error so calling code can handle it
    }
  },

  async getCustomers(params?: {
    company?: Company
  }): Promise<{
    customers: Array<{
      id: number
      customer_name: string
    }>
  }> {
    const { company } = params || {}
    
    console.log("=== FETCHING CUSTOMERS FROM API ===")
    console.log("Fetching customers for:", { company })
    
    try {
      const query = new URLSearchParams()
      if (company) query.append('company', company)
      
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/api/dropdown/customers?${query.toString()}`
      console.log("Customers API URL:", apiUrl)
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Customers API call failed: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log("Customers API Response:", data)
      console.log("=== END CUSTOMERS FETCH ===")
      
      return data
    } catch (error) {
      console.error("Error fetching customers:", error)
      throw error // Re-throw the error so calling code can handle it
    }
  }
}