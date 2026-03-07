// lib/api/inwardApiService.ts
import { secureApiClient, inwardFormApiClient } from '@/lib/auth/secureApiClient'
import { ErrorRecovery, APIError, ValidationError } from '@/lib/utils/errorHandling'
import { Company } from '@/lib/api'
import type { InwardPayload, InwardDetailResponse, InwardRecord } from '@/types/inward'
import type { InwardFormData, ArticleData, BoxData } from '@/lib/validations/inwardForm'

export interface InwardApiService {
  // Form validation
  validateForm: (data: InwardFormData, articles: ArticleData[], boxes: BoxData[], company: Company) => Promise<InwardFormValidationResult>
  
  // CRUD operations
  createInward: (payload: InwardPayload) => Promise<{ success: boolean; transactionNo: string }>
  updateInward: (transactionNo: string, payload: InwardPayload) => Promise<{ success: boolean }>
  getInward: (transactionNo: string, company: Company) => Promise<InwardDetailResponse>
  deleteInward: (transactionNo: string, company: Company) => Promise<{ success: boolean }>
  
  // List operations
  listInwards: (params: InwardListParams) => Promise<{ data: InwardRecord[]; total: number; page: number; limit: number }>
  
  // Dropdown data
  getItemCategories: (company: Company) => Promise<Array<{ value: string; label: string; id: number }>>
  getSubCategories: (company: Company, itemCategory: string) => Promise<Array<{ value: string; label: string; id: number }>>
  getItemDescriptions: (company: Company, itemCategory: string, subCategory: string) => Promise<Array<{ value: string; label: string; id: number }>>
  getCustomers: (company: Company, search?: string) => Promise<Array<{ value: string; label: string; id: number }>>
  getVendors: (company: Company, search?: string) => Promise<Array<{ value: string; label: string; id: number; location?: string }>>
  
  // SKU resolution
  resolveSkuId: (itemDescription: string, itemCategory: string, subCategory: string, company: Company) => Promise<{ sku_id: number }>
  
  // Printing
  printBoxLabel: (boxData: any, printerName: string, company: Company) => Promise<{ success: boolean }>
  getPrinters: () => Promise<Array<{ name: string; description: string }>>
  
  // Export/Import
  exportData: (format: 'csv' | 'excel' | 'pdf', filters: Record<string, any>, company: Company) => Promise<Blob>
  importData: (file: File, company: Company) => Promise<{ success: boolean; imported: number; errors: string[] }>
}

export interface InwardListParams {
  company: Company
  page?: number
  limit?: number
  search?: string
  dateFrom?: string
  dateTo?: string
  vendor?: string
  customer?: string
  status?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface InwardFormValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  fieldErrors: Record<string, string[]>
}

class InwardApiServiceImpl implements InwardApiService {
  async validateForm(
    data: InwardFormData,
    articles: ArticleData[],
    boxes: BoxData[],
    company: Company
  ): Promise<InwardFormValidationResult> {
    try {
      const response = await inwardFormApiClient.validateForm(
        { formData: data, articles, boxes },
        company
      ) as { isValid: boolean; errors?: string[]; warnings?: string[]; fieldErrors?: Record<string, string[]> }

      return {
        isValid: response.isValid,
        errors: response.errors || [],
        warnings: response.warnings || [],
        fieldErrors: response.fieldErrors || {}
      }
    } catch (error) {
      console.error('Form validation error:', error)
      throw new ValidationError(
        'Form validation failed',
        'form',
        { data, articles, boxes },
        { company }
      )
    }
  }

  async createInward(payload: InwardPayload): Promise<{ success: boolean; transactionNo: string }> {
    try {
      const response = await inwardFormApiClient.createInward(payload, payload.company) as { success: boolean; transactionNo: string }
      
      if (!response.success) {
        throw new APIError('Failed to create inward entry', '/api/inward/create', 500)
      }

      return {
        success: true,
        transactionNo: response.transactionNo
      }
    } catch (error) {
      console.error('Create inward error:', error)
      throw new APIError(
        'Failed to create inward entry',
        '/api/inward/create',
        500,
        { payload }
      )
    }
  }

  async updateInward(transactionNo: string, payload: InwardPayload): Promise<{ success: boolean }> {
    try {
      const response = await inwardFormApiClient.updateInward(transactionNo, payload, payload.company) as { success: boolean }
      
      if (!response.success) {
        throw new APIError('Failed to update inward entry', `/api/inward/${transactionNo}`, 500)
      }

      return {
        success: true
      }
    } catch (error) {
      console.error('Update inward error:', error)
      throw new APIError(
        'Failed to update inward entry',
        `/api/inward/${transactionNo}`,
        500,
        { transactionNo, payload }
      )
    }
  }

  async getInward(transactionNo: string, company: Company): Promise<InwardDetailResponse> {
    try {
      const response = await inwardFormApiClient.getInward(transactionNo, company)
      return response
    } catch (error) {
      console.error('Get inward error:', error)
      throw new APIError(
        'Failed to retrieve inward entry',
        `/api/inward/${transactionNo}`,
        404,
        { transactionNo, company }
      )
    }
  }

  async deleteInward(transactionNo: string, company: Company): Promise<{ success: boolean }> {
    try {
      const response = await inwardFormApiClient.deleteInward(transactionNo, company)
      return response
    } catch (error) {
      console.error('Delete inward error:', error)
      throw new APIError(
        'Failed to delete inward entry',
        `/api/inward/${transactionNo}`,
        500,
        { transactionNo, company }
      )
    }
  }

  async listInwards(params: InwardListParams): Promise<{ data: InwardRecord[]; total: number; page: number; limit: number }> {
    try {
      const response = await secureApiClient.get<{ data: InwardRecord[]; total: number; page: number; limit: number }>('/api/inward/list', params, {
        component: 'InwardForm',
        action: 'list',
        data: params
      })

      return {
        data: response.data || [],
        total: response.total || 0,
        page: response.page || 1,
        limit: response.limit || 10
      }
    } catch (error) {
      console.error('List inwards error:', error)
      throw new APIError(
        'Failed to retrieve inward entries',
        '/api/inward/list',
        500,
        { params }
      )
    }
  }

  async getItemCategories(company: Company): Promise<Array<{ value: string; label: string; id: number }>> {
    try {
      const response = await inwardFormApiClient.getDropdownData('item_categories', { company })
      return response.categories || []
    } catch (error) {
      console.error('Get item categories error:', error)
      throw new APIError(
        'Failed to retrieve item categories',
        '/api/dropdown/item_categories',
        500,
        { company }
      )
    }
  }

  async getSubCategories(company: Company, itemCategory: string): Promise<Array<{ value: string; label: string; id: number }>> {
    try {
      const response = await inwardFormApiClient.getDropdownData('sub_categories', { 
        company, 
        item_category: itemCategory 
      })
      return response.subCategories || []
    } catch (error) {
      console.error('Get sub categories error:', error)
      throw new APIError(
        'Failed to retrieve sub categories',
        '/api/dropdown/sub_categories',
        500,
        { company, itemCategory }
      )
    }
  }

  async getItemDescriptions(company: Company, itemCategory: string, subCategory: string): Promise<Array<{ value: string; label: string; id: number }>> {
    try {
      const response = await inwardFormApiClient.getDropdownData('item_descriptions', { 
        company, 
        item_category: itemCategory,
        sub_category: subCategory
      })
      return response.itemDescriptions || []
    } catch (error) {
      console.error('Get item descriptions error:', error)
      throw new APIError(
        'Failed to retrieve item descriptions',
        '/api/dropdown/item_descriptions',
        500,
        { company, itemCategory, subCategory }
      )
    }
  }

  async getCustomers(company: Company, search?: string): Promise<Array<{ value: string; label: string; id: number }>> {
    try {
      const response = await inwardFormApiClient.getDropdownData('customers', { 
        company, 
        search 
      })
      return response.customers || []
    } catch (error) {
      console.error('Get customers error:', error)
      throw new APIError(
        'Failed to retrieve customers',
        '/api/dropdown/customers',
        500,
        { company, search }
      )
    }
  }

  async getVendors(company: Company, search?: string): Promise<Array<{ value: string; label: string; id: number; location?: string }>> {
    try {
      const response = await inwardFormApiClient.getDropdownData('vendors', { 
        company, 
        search 
      })
      return response.vendors || []
    } catch (error) {
      console.error('Get vendors error:', error)
      throw new APIError(
        'Failed to retrieve vendors',
        '/api/dropdown/vendors',
        500,
        { company, search }
      )
    }
  }

  async resolveSkuId(itemDescription: string, itemCategory: string, subCategory: string, company: Company): Promise<{ sku_id: number }> {
    try {
      const response = await inwardFormApiClient.resolveSkuId(itemDescription, itemCategory, subCategory, company)
      return response
    } catch (error) {
      console.error('Resolve SKU ID error:', error)
      throw new APIError(
        'Failed to resolve SKU ID',
        '/api/sku/resolve',
        404,
        { itemDescription, itemCategory, subCategory, company }
      )
    }
  }

  async printBoxLabel(boxData: any, printerName: string, company: Company): Promise<{ success: boolean }> {
    try {
      const response = await inwardFormApiClient.printBoxLabel(boxData, printerName, company)
      return response
    } catch (error) {
      console.error('Print box label error:', error)
      throw new APIError(
        'Failed to print box label',
        '/api/print/box-label',
        500,
        { boxData, printerName, company }
      )
    }
  }

  async getPrinters(): Promise<Array<{ name: string; description: string }>> {
    try {
      const response = await inwardFormApiClient.getPrinters()
      return response
    } catch (error) {
      console.error('Get printers error:', error)
      throw new APIError(
        'Failed to retrieve printers',
        '/api/printers',
        500
      )
    }
  }

  async exportData(format: 'csv' | 'excel' | 'pdf', filters: Record<string, any>, company: Company): Promise<Blob> {
    try {
      const blob = await inwardFormApiClient.exportData(format, filters, company)
      return blob
    } catch (error) {
      console.error('Export data error:', error)
      throw new APIError(
        'Failed to export data',
        '/api/inward/export',
        500,
        { format, filters, company }
      )
    }
  }

  async importData(file: File, company: Company): Promise<{ success: boolean; imported: number; errors: string[] }> {
    try {
      const response = await inwardFormApiClient.importData(file, company)
      return response
    } catch (error) {
      console.error('Import data error:', error)
      throw new APIError(
        'Failed to import data',
        '/api/inward/import',
        500,
        { fileName: file.name, company }
      )
    }
  }
}

// Create singleton instance
export const inwardApiService = new InwardApiServiceImpl()

// Hook for using the API service
export function useInwardApiService(): InwardApiService {
  return inwardApiService
}

// Utility functions for common operations
export const inwardApiUtils = {
  // Build search parameters for list operations
  buildSearchParams: (params: Partial<InwardListParams>): Record<string, any> => {
    const searchParams: Record<string, any> = {}
    
    if (params.company) searchParams.company = params.company
    if (params.page) searchParams.page = params.page
    if (params.limit) searchParams.limit = params.limit
    if (params.search) searchParams.search = params.search
    if (params.dateFrom) searchParams.date_from = params.dateFrom
    if (params.dateTo) searchParams.date_to = params.dateTo
    if (params.vendor) searchParams.vendor = params.vendor
    if (params.customer) searchParams.customer = params.customer
    if (params.status) searchParams.status = params.status
    if (params.sortBy) searchParams.sort_by = params.sortBy
    if (params.sortOrder) searchParams.sort_order = params.sortOrder
    
    return searchParams
  },

  // Validate required fields
  validateRequiredFields: (data: any, requiredFields: string[]): string[] => {
    const errors: string[] = []
    
    requiredFields.forEach(field => {
      if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
        errors.push(`${field} is required`)
      }
    })
    
    return errors
  },

  // Format API response
  formatResponse: <T>(response: any): T => {
    if (response.success === false) {
      throw new APIError(response.message || 'API request failed', '', response.statusCode || 500)
    }
    
    return response.data || response
  },

  // Handle pagination
  handlePagination: (page: number, limit: number) => ({
    page: Math.max(1, page),
    limit: Math.min(100, Math.max(1, limit))
  })
}

