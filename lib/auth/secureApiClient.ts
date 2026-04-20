// lib/auth/secureApiClient.ts
import { authGuard, createAuthenticatedFetch } from './authGuard'
import { ErrorRecovery, APIError, NetworkError } from '@/lib/utils/errorHandling'
import { Company } from '@/lib/api'

export interface SecureApiClientOptions {
  baseURL?: string
  timeout?: number
  retries?: number
  retryDelay?: number
}

export class SecureApiClient {
  private baseURL: string
  private timeout: number
  private retries: number
  private retryDelay: number
  private authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>

  constructor(options: SecureApiClientOptions = {}) {
    this.baseURL = options.baseURL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    this.timeout = options.timeout || 30000
    this.retries = options.retries || 3
    this.retryDelay = options.retryDelay || 1000
    this.authenticatedFetch = createAuthenticatedFetch()
  }

  private async makeRequest(
    endpoint: string,
    options: RequestInit = {},
    context?: any
  ): Promise<Response> {
    const url = `${this.baseURL}${endpoint}`
    
    // Add timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await this.authenticatedFetch(url, {
        ...options,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        await ErrorRecovery.handleAPIError(response, context)
      }

      return response
    } catch (error: unknown) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new APIError('Request timeout', endpoint, 408, context)
      }
      
      if (error instanceof APIError) {
        throw error
      }
      
      // ErrorRecovery.handleNetworkError always throws, but TypeScript doesn't know this
      await ErrorRecovery.handleNetworkError(error as Error, context)
      throw new Error('Network error') // This line will never be reached but satisfies TypeScript
    }
  }

  private async retryRequest<T>(
    operation: () => Promise<T>,
    context?: any
  ): Promise<T> {
    return ErrorRecovery.retryOperation(
      operation,
      this.retries,
      this.retryDelay,
      context
    )
  }

  // GET request
  async get<T>(endpoint: string, params?: Record<string, any>, context?: any): Promise<T> {
    const url = new URL(`${this.baseURL}${endpoint}`)
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    const response = await this.retryRequest(
      () => this.makeRequest(url.pathname + url.search, { method: 'GET' }, context),
      context
    )

    return response.json()
  }

  // POST request
  async post<T>(endpoint: string, data?: any, context?: any): Promise<T> {
    const response = await this.retryRequest(
      () => this.makeRequest(endpoint, {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined
      }, context),
      context
    )

    return response.json()
  }

  // PUT request
  async put<T>(endpoint: string, data?: any, context?: any): Promise<T> {
    const response = await this.retryRequest(
      () => this.makeRequest(endpoint, {
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined
      }, context),
      context
    )

    return response.json()
  }

  // DELETE request
  async delete<T>(endpoint: string, context?: any): Promise<T> {
    const response = await this.retryRequest(
      () => this.makeRequest(endpoint, { method: 'DELETE' }, context),
      context
    )

    return response.json()
  }

  // PATCH request
  async patch<T>(endpoint: string, data?: any, context?: any): Promise<T> {
    const response = await this.retryRequest(
      () => this.makeRequest(endpoint, {
        method: 'PATCH',
        body: data ? JSON.stringify(data) : undefined
      }, context),
      context
    )

    return response.json()
  }

  // Upload file
  async upload<T>(endpoint: string, file: File, context?: any): Promise<T> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await this.retryRequest(
      () => this.makeRequest(endpoint, {
        method: 'POST',
        body: formData
      }, context),
      context
    )

    return response.json()
  }

  // Download file
  async download(endpoint: string, filename?: string, context?: any): Promise<Blob> {
    const response = await this.retryRequest(
      () => this.makeRequest(endpoint, { method: 'GET' }, context),
      context
    )

    const blob = await response.blob()
    
    if (filename) {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    }

    return blob
  }
}

// Inward form specific API client
export class InwardFormApiClient extends SecureApiClient {
  constructor(options: SecureApiClientOptions = {}) {
    super(options)
  }

  // Validate form data
  async validateForm(data: any, company: Company): Promise<{ isValid: boolean; errors: string[] }> {
    return this.post('/api/inward/validate', { data, company }, {
      component: 'InwardForm',
      action: 'validate',
      data: { company }
    })
  }

  // Create inward entry
  async createInward(data: any, company: Company): Promise<{ success: boolean; transactionNo: string }> {
    return this.post('/api/inward/create', { data, company }, {
      component: 'InwardForm',
      action: 'create',
      data: { company }
    })
  }

  // Update inward entry
  async updateInward(transactionNo: string, data: any, company: Company): Promise<{ success: boolean }> {
    return this.put(`/api/inward/${transactionNo}`, { data, company }, {
      component: 'InwardForm',
      action: 'update',
      data: { transactionNo, company }
    })
  }

  // Get inward entry
  async getInward(transactionNo: string, company: Company): Promise<any> {
    return this.get(`/api/inward/${transactionNo}`, { company }, {
      component: 'InwardForm',
      action: 'read',
      data: { transactionNo, company }
    })
  }

  // Delete inward entry
  async deleteInward(transactionNo: string, company: Company): Promise<{ success: boolean }> {
    return this.delete(`/api/inward/${transactionNo}`, {
      component: 'InwardForm',
      action: 'delete',
      data: { transactionNo, company }
    })
  }

  // Get dropdown data
  async getDropdownData(type: string, params: Record<string, any> = {}): Promise<any> {
    return this.get(`/api/dropdown/${type}`, params, {
      component: 'InwardForm',
      action: 'dropdown',
      data: { type, params }
    })
  }

  // Resolve SKU ID
  async resolveSkuId(itemDescription: string, itemCategory: string, subCategory: string, company: Company): Promise<{ sku_id: number }> {
    return this.post('/api/sku/resolve', {
      item_description: itemDescription,
      item_category: itemCategory,
      sub_category: subCategory,
      company
    }, {
      component: 'InwardForm',
      action: 'resolveSku',
      data: { itemDescription, itemCategory, subCategory, company }
    })
  }

  // Print box label
  async printBoxLabel(boxData: any, printerName: string, company: Company): Promise<{ success: boolean }> {
    return this.post('/api/print/box-label', {
      boxData,
      printerName,
      company
    }, {
      component: 'InwardForm',
      action: 'printBox',
      data: { boxData, printerName, company }
    })
  }

  // Get available printers
  async getPrinters(): Promise<Array<{ name: string; description: string }>> {
    return this.get('/api/printers', {}, {
      component: 'InwardForm',
      action: 'getPrinters'
    })
  }

  // Export data
  async exportData(format: 'csv' | 'excel' | 'pdf', filters: Record<string, any> = {}, company: Company): Promise<Blob> {
    return this.download(`/api/inward/export?format=${format}`, `inward_data.${format}`, {
      component: 'InwardForm',
      action: 'export',
      data: { format, filters, company }
    })
  }

  // Import data
  async importData(file: File, company: Company): Promise<{ success: boolean; imported: number; errors: string[] }> {
    return this.upload('/api/inward/import', file, {
      component: 'InwardForm',
      action: 'import',
      data: { company }
    })
  }
}

// Create singleton instances
export const secureApiClient = new SecureApiClient()
export const inwardFormApiClient = new InwardFormApiClient()

// Hook for using the API client
export function useSecureApiClient(): InwardFormApiClient {
  return inwardFormApiClient
}

// Utility for creating API calls with automatic error handling
export function createSecureApiCall<T>(
  apiCall: () => Promise<T>,
  context?: any
): Promise<T> {
  return ErrorRecovery.retryOperation(apiCall, 3, 1000, context)
}

