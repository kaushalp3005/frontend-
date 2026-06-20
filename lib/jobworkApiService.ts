import { useAuthStore } from '@/lib/stores/auth'
import type {
  JobworkDashboardFilters,
  JobworkDashboardResponse,
  JobworkFilterOptions,
  JobworkDetailRow,
  InwardReceipt,
} from '@/types/jobwork'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function getAuthHeaders(): Record<string, string> {
  const { accessToken } = useAuthStore.getState()
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }
  return headers
}

async function fetchJSON(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options?.headers,
    },
  })

  if (!response.ok) {
    let errorMessage = `API call failed: ${response.status} ${response.statusText}`
    let errorDetails = null

    try {
      const errorData = await response.json()
      errorDetails = errorData
      errorMessage += ` - ${JSON.stringify(errorData)}`
    } catch {
      try {
        const errorText = await response.text()
        errorDetails = errorText
        errorMessage += ` - ${errorText}`
      } catch {
        // use status only
      }
    }

    const error = new Error(errorMessage)
    ;(error as any).response = {
      data: errorDetails,
      status: response.status,
      detail: typeof errorDetails === 'string'
        ? errorDetails
        : (errorDetails?.detail || errorDetails?.message || JSON.stringify(errorDetails)),
    }
    ;(error as any).config = { url }
    console.error('Jobwork API Error:', { message: errorMessage, status: response.status, details: errorDetails })
    throw error
  }

  return response.json()
}

export const JobworkApiService = {
  // Get dashboard summary with filters
  async getDashboardSummary(
    company: string,
    filters: JobworkDashboardFilters
  ): Promise<JobworkDashboardResponse> {
    const params = new URLSearchParams()
    params.set('company', company)

    if (filters.date_from) params.set('date_from', filters.date_from)
    if (filters.date_to) params.set('date_to', filters.date_to)
    if (filters.months?.length) params.set('months', filters.months.join(','))
    if (filters.vendors?.length) params.set('vendors', filters.vendors.join(','))
    if (filters.items?.length) params.set('items', filters.items.join(','))
    if (filters.process_types?.length) params.set('process_types', filters.process_types.join(','))
    if (filters.jwo_statuses?.length) params.set('jwo_statuses', filters.jwo_statuses.join(','))
    if (filters.loss_statuses?.length) params.set('loss_statuses', filters.loss_statuses.join(','))
    if (filters.group_by) params.set('group_by', filters.group_by)

    return fetchJSON(`${API_BASE_URL}/jobwork/dashboard/summary?${params.toString()}`)
  },

  // Get filter dropdown options
  async getFilterOptions(company: string): Promise<JobworkFilterOptions> {
    return fetchJSON(`${API_BASE_URL}/jobwork/dashboard/filter-options?company=${company}`)
  },

  // Get expanded JWO detail rows for a group
  async getGroupDetails(
    company: string,
    groupBy: string,
    groupLabel: string,
    filters: JobworkDashboardFilters
  ): Promise<JobworkDetailRow[]> {
    const params = new URLSearchParams()
    params.set('company', company)
    params.set('group_by', groupBy)
    params.set('group_label', groupLabel)

    if (filters.date_from) params.set('date_from', filters.date_from)
    if (filters.date_to) params.set('date_to', filters.date_to)
    if (filters.months?.length) params.set('months', filters.months.join(','))
    if (filters.vendors?.length) params.set('vendors', filters.vendors.join(','))
    if (filters.items?.length) params.set('items', filters.items.join(','))
    if (filters.process_types?.length) params.set('process_types', filters.process_types.join(','))
    if (filters.jwo_statuses?.length) params.set('jwo_statuses', filters.jwo_statuses.join(','))
    if (filters.loss_statuses?.length) params.set('loss_statuses', filters.loss_statuses.join(','))

    return fetchJSON(`${API_BASE_URL}/jobwork/dashboard/group-details?${params.toString()}`)
  },

  // Get IR receipts for a specific JWO (lazy-loaded)
  async getJWOReceipts(company: string, jwoId: number): Promise<InwardReceipt[]> {
    return fetchJSON(`${API_BASE_URL}/jobwork/dashboard/jwo-receipts/${jwoId}?company=${company}`)
  },

  // Export dashboard data as Excel
  async exportExcel(
    company: string,
    filters: JobworkDashboardFilters
  ): Promise<Blob> {
    const params = new URLSearchParams()
    params.set('company', company)

    if (filters.date_from) params.set('date_from', filters.date_from)
    if (filters.date_to) params.set('date_to', filters.date_to)
    if (filters.months?.length) params.set('months', filters.months.join(','))
    if (filters.vendors?.length) params.set('vendors', filters.vendors.join(','))
    if (filters.items?.length) params.set('items', filters.items.join(','))
    if (filters.process_types?.length) params.set('process_types', filters.process_types.join(','))
    if (filters.jwo_statuses?.length) params.set('jwo_statuses', filters.jwo_statuses.join(','))
    if (filters.loss_statuses?.length) params.set('loss_statuses', filters.loss_statuses.join(','))
    if (filters.group_by) params.set('group_by', filters.group_by)

    const response = await fetch(
      `${API_BASE_URL}/jobwork/dashboard/export-excel?${params.toString()}`,
      { headers: getAuthHeaders() }
    )

    if (!response.ok) throw new Error('Export failed')
    return response.blob()
  },
}
