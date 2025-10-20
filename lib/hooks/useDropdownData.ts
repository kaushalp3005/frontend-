// lib/hooks/useDropdownData.ts
"use client"

import { useCallback, useEffect, useState } from "react"
import { dropdownApi, type Company } from "@/lib/api"

type Opt = { value: string; label: string; id?: number }

function toOptions(values: any[] = [], ids: number[] = [], includeId: boolean = false): Opt[] {
  // Filter out null, undefined, and empty string values to prevent SelectItem errors
  const validValues = values.filter(v => v != null && v !== '')
  
  // If we have IDs from the API response, use them
  if (ids && ids.length === values.length) {
    return validValues
      .map((v, originalIndex) => {
        const actualIndex = values.indexOf(v)
        return {
          value: v, // Store the item description as value
          label: v, // Display the item description as label
          id: ids[actualIndex] // Use the real database ID
        }
      })
      .filter(opt => opt.value !== '') // Extra safety filter
  }
  
  // Fallback to the original behavior if no IDs provided
  return validValues.map((v, index) => ({
    value: v, // Store the item description as value
    label: v, // Display the item description as label
    id: index + 1 // Temporary ID - will be replaced with real ID when selected
  }))
}

/**
 * ITEM CATEGORIES
 * Loads categories for the given company and material type.
 */
export function useItemCategories(args: { company: Company; material_type?: string }) {
  const { company, material_type } = args
  const [options, setOptions] = useState<Opt[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState<string | undefined>("")

  const fetchData = useCallback(async () => {
    if (!material_type) {
      console.log("No material type provided, clearing categories")
      setOptions([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      console.log("=== FETCHING ITEM CATEGORIES ===")
      console.log("Company:", company, "Material Type:", material_type)
      
      const data = await dropdownApi.fetchDropdown({ 
        company, 
        material_type,
        search, 
        limit: 1000 
      })
      
      console.log("Categories API Response:", data)
      console.log("Item Categories:", data.options.item_categories)
      
      setOptions(toOptions(data.options.item_categories))
      console.log("=== END ITEM CATEGORIES FETCH ===")
    } catch (e: any) {
      console.error("Error fetching item categories:", e)
      setOptions([])
      setError("Connection not available. Please check your network connection.")
    } finally {
      setLoading(false)
    }
  }, [company, material_type, search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { options, loading, error, search: setSearch }
}

/**
 * SUB CATEGORIES (depends on material_type + item_category)
 * Only fetch when materialType and categoryId are provided.
 */
export function useSubCategories(categoryId: string | undefined, args: { company: Company; material_type?: string }) {
  const { company, material_type } = args
  const [options, setOptions] = useState<Opt[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState<string | undefined>("")

  const fetchData = useCallback(async () => {
    if (!categoryId || !material_type) {
      console.log("No category ID or material type provided, clearing sub categories")
      setOptions([])
      return
    }
    
    console.log("=== SUB CATEGORIES FETCH TRIGGERED ===")
    console.log("categoryId changed to:", categoryId, "material_type:", material_type)
    
    setLoading(true)
    setError(null)
    try {
      console.log("=== FETCHING SUB CATEGORIES ===")
      console.log("Company:", company, "Category:", categoryId, "Material Type:", material_type)
      
      const data = await dropdownApi.fetchDropdown({
        company,
        material_type,
        item_category: categoryId, // Pass the selected category
        search,
        limit: 1000,
      })
      
      console.log("Sub Categories API Response:", data)
      console.log("Sub Categories:", data.options.sub_categories)
      
      setOptions(toOptions(data.options.sub_categories))
      console.log("Sub Categories Options Set:", data.options.sub_categories?.length || 0, "options")
      console.log("=== END SUB CATEGORIES FETCH ===")
    } catch (e: any) {
      console.error("Error fetching sub categories:", e)
      setOptions([])
      setError("Connection not available. Please check your network connection.")
    } finally {
      setLoading(false)
    }
  }, [company, categoryId, material_type, search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { options, loading, error, search: setSearch }
}

/**
 * ITEM DESCRIPTIONS (depends on material_type + item_category + sub_category)
 */
export function useItemDescriptions(args: {
  company: Company
  material_type?: string
  item_category?: string
  sub_category?: string
}) {
  const { company, material_type, item_category, sub_category } = args
  const [options, setOptions] = useState<Opt[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState<string | undefined>("")

  const fetchData = useCallback(async () => {
    if (!material_type || !item_category || !sub_category) {
      console.log("Missing material type, category or sub category, clearing item descriptions")
      console.log("material_type:", material_type, "item_category:", item_category, "sub_category:", sub_category)
      setOptions([])
      return
    }
    
    console.log("=== ITEM DESCRIPTIONS FETCH TRIGGERED ===")
    console.log("Dependencies changed - material_type:", material_type, "item_category:", item_category, "sub_category:", sub_category)
    
    setLoading(true)
    setError(null)
    try {
      const requestParams = {
        company,
        material_type,
        item_category,
        sub_category,
        search,
        limit: 500,
      }
      
      console.log("=== FETCHING ITEM DESCRIPTIONS ===")
      console.log("API Request Params:", requestParams)
      
      const data = await dropdownApi.fetchDropdown(requestParams)
      
      console.log("Item Descriptions API Response:", data)
      console.log("Item Descriptions:", data.options.item_descriptions)
      
      // Check if the response includes ID information
      console.log("Response structure check:", {
        hasItemDescriptions: !!data.options.item_descriptions,
        itemDescriptionsCount: data.options.item_descriptions?.length || 0,
        firstItem: data.options.item_descriptions?.[0],
        itemIds: data.options.item_ids,
        itemIdsCount: data.options.item_ids?.length || 0
      })
      
      // Pass the item_ids if available from the API response
      setOptions(toOptions(data.options.item_descriptions, data.options.item_ids || [], true))
      console.log("Item Descriptions Options Set:", data.options.item_descriptions?.length || 0, "options")
      console.log("=== END ITEM DESCRIPTIONS FETCH ===")
    } catch (e: any) {
      console.error("Error fetching item descriptions:", e)
      setOptions([])
      setError("Connection not available. Please check your network connection.")
    } finally {
      setLoading(false)
    }
  }, [company, material_type, item_category, sub_category, search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { options, loading, error, search: setSearch }
}

/**
 * CUSTOMERS
 * Loads customer names for dropdowns.
 */
export function useCustomers(args?: { company?: Company }) {
  const { company } = args || {}
  const [options, setOptions] = useState<Opt[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState<string | undefined>("")

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      console.log("=== FETCHING CUSTOMERS ===")
      console.log("Company:", company)
      
      const query = new URLSearchParams()
      if (company) query.append('company', company)
      if (search) query.append('search', search)
      
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
      
      // Transform customer data to options format
      const customerOptions = (data.customers || []).map((customer: any) => ({
        value: customer.customer_name || customer.name || customer.id?.toString() || '',
        label: customer.customer_name || customer.name || customer.id?.toString() || '',
        id: customer.id
      }))
      
      setOptions(customerOptions)
      console.log("=== END CUSTOMERS FETCH ===")
    } catch (e: any) {
      console.error("Error fetching customers:", e)
      setOptions([])
      setError("Connection not available. Please check your network connection.")
    } finally {
      setLoading(false)
    }
  }, [company, search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { options, loading, error, search: setSearch }
}

/**
 * VENDORS
 * Loads vendor names and locations for dropdowns.
 */
export function useVendors(args?: { company?: Company; vendor_name?: string }) {
  const { company, vendor_name } = args || {}
  const [options, setOptions] = useState<Opt[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState<string | undefined>("")
  const [autoSelection, setAutoSelection] = useState<any>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      console.log("=== FETCHING VENDORS ===")
      console.log("Company:", company, "Vendor Name:", vendor_name)
      
      const query = new URLSearchParams()
      if (company) query.append('company', company)
      if (vendor_name) query.append('vendor_name', vendor_name)
      if (search) query.append('search', search)
      
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
      
      // Transform vendor data to options format
      const vendorOptions = (data.options?.vendor_names || []).map((vendor: string, index: number) => ({
        value: vendor,
        label: vendor,
        id: data.options?.vendor_ids?.[index]
      }))
      
      setOptions(vendorOptions)
      setAutoSelection(data.auto_selection || null)
      console.log("=== END VENDORS FETCH ===")
    } catch (e: any) {
      console.error("Error fetching vendors:", e)
      setOptions([])
      setAutoSelection(null)
      setError("Connection not available. Please check your network connection.")
    } finally {
      setLoading(false)
    }
  }, [company, vendor_name, search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { options, loading, error, search: setSearch, autoSelection }
}

/**
 * SITECODES
 * Loads sitecodes for outward module.
 */
export function useSitecodes(args?: { company?: Company; active_only?: boolean }) {
  const { company, active_only = true } = args || {}
  const [options, setOptions] = useState<Opt[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      console.log("=== FETCHING SITECODES ===")
      console.log("Company:", company, "Active Only:", active_only)
      
      const query = new URLSearchParams()
      if (active_only !== undefined) query.append('active_only', String(active_only))
      
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/outward/dropdowns/sitecodes?${query.toString()}`
      console.log("Sitecodes API URL:", apiUrl)
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Sitecodes API call failed: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log("Sitecodes API Response:", data)
      
      // Transform sitecode data to options format
      const sitecodeOptions = (data || []).map((item: any) => ({
        value: item.sitecode || '',
        label: item.sitecode || '',
        id: item.id
      }))
      
      setOptions(sitecodeOptions)
      console.log("=== END SITECODES FETCH ===")
    } catch (e: any) {
      console.error("Error fetching sitecodes:", e)
      setOptions([])
      setError("Failed to load sitecodes. Please check your connection.")
    } finally {
      setLoading(false)
    }
  }, [company, active_only])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { options, loading, error, refetch: fetchData }
}

/**
 * TRANSPORTERS
 * Loads transporter names for outward module.
 */
export function useTransporters(args?: { company?: Company; active_only?: boolean }) {
  const { company, active_only = true } = args || {}
  const [options, setOptions] = useState<Opt[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      console.log("=== FETCHING TRANSPORTERS ===")
      console.log("Company:", company, "Active Only:", active_only)

      const query = new URLSearchParams()
      if (active_only !== undefined) query.append('active_only', String(active_only))

      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/outward/dropdowns/transporters?${query.toString()}`
      console.log("Transporters API URL:", apiUrl)

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Transporters API call failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log("Transporters API Response:", data)

      // Transform transporter data to options format - only show transporter_name
      const transporterOptions = (data || []).map((item: any) => ({
        value: item.transporter_name || '',
        label: item.transporter_name || '',
        id: item.id
      }))

      setOptions(transporterOptions)
      console.log("=== END TRANSPORTERS FETCH ===")
    } catch (e: any) {
      console.error("Error fetching transporters:", e)
      setOptions([])
      setError("Failed to load transporters. Please check your connection.")
    } finally {
      setLoading(false)
    }
  }, [company, active_only])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { options, loading, error, refetch: fetchData }
}

// Legacy alias for backward compatibility
export const useSubGroups = useSubCategories