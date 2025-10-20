// File: inward.ts
// Path: frontend/src/types/inward.ts

// lib/api/inward.ts
export type Company = "CFPL" | "CDPL"

// Backend API interfaces
export interface TransactionIn {
  transaction_no: string
  entry_date: string
  vehicle_number?: string
  transporter_name?: string
  lr_number?: string
  vendor_supplier_name?: string
  customer_party_name?: string
  source_location?: string
  destination_location?: string
  challan_number?: string
  invoice_number?: string
  po_number?: string
  grn_number?: string
  grn_quantity?: number
  system_grn_date?: string
  purchase_by?: string
  service_invoice_number?: string
  dn_number?: string
  approval_authority?: string
  total_amount?: number
  tax_amount?: number
  discount_amount?: number
  received_quantity?: number
  remark?: string
  currency?: string
}

export interface ArticleIn {
  transaction_no: string
  sku_id: number
  item_description: string
  item_category?: string
  sub_category?: string
  item_code?: string
  hsn_code?: string
  quality_grade?: string
  uom?: string
  packaging_type?: number
  quantity_units?: number
  net_weight?: number
  total_weight?: number
  batch_number?: string
  lot_number?: string
  manufacturing_date?: string
  expiry_date?: string
  import_date?: string
  unit_rate?: number
  total_amount?: number
  tax_amount?: number
  discount_amount?: number
  currency?: string
}

export interface BoxIn {
  transaction_no: string
  article_description: string
  box_number: number
  net_weight?: number
  gross_weight?: number
  lot_number?: string
}

export interface InwardPayload {
  company: Company
  transaction: TransactionIn
  articles: ArticleIn[]
  boxes: BoxIn[]
}

export interface InwardListItem {
  transaction_id: string
  batch_number?: string
  entry_date: string
  invoice_number?: string
  po_number?: string
  item_descriptions: string[]
  quantities_and_uoms: string[]
}

export interface InwardListResponse {
  records: InwardListItem[]
  total: number
  page: number
  per_page: number
}

export interface InwardDetailResponse {
  company: string
  transaction: TransactionIn & {
    [key: string]: any
  }
  articles: (ArticleIn & {
    id?: number
    [key: string]: any
  })[]
  boxes: (BoxIn & {
    id?: number
    [key: string]: any
  })[]
}

// Enhanced search parameters interface
export interface InwardListParams {
  page?: number
  per_page?: number
  search?: string
  from_date?: string
  to_date?: string
}

// Legacy interface for backward compatibility
export interface InwardRecord {
  id?: string
  company: string
  transaction_date_time?: string
  entry_date: string
  vehicle_number?: string
  transporter_name?: string
  lr_number?: string
  vendor_supplier_name?: string
  customer_party_name?: string
  source_location?: string
  destination_location?: string
  challan_number?: string
  invoice_number?: string
  po_number?: string
  grn_number?: string
  grn_quantity?: number
  system_grn_date?: string
  purchase_by?: string
  bill_submitted_to_account?: boolean
  grn_remark?: string
  process_type?: string
  service_remarks?: string
  service_invoice_number?: string
  dn_number?: string
  approval_authority?: string
  received_quantity?: number
  return_reason_remark?: string
  item_description?: string
  item_category?: string
  sub_category?: string
  sku_id?: number
  hsn_code?: string
  quality_grade?: string
  quantity_units?: number
  uom?: string
  packaging_type?: number
  net_weight?: number
  total_weight?: number
  batch_number?: string
  lot_number?: string
  manufacturing_date?: string
  expiry_date?: string
  import_date?: string
  unit_rate?: number
  total_amount?: number
  tax_amount?: number
  discount_amount?: number
  currency?: string
  transaction_id?: string
  created_at?: string
  status?: string
  remark?: string
  vendor_gstin?: string
  vendor_pan?: string
  party_code?: string
  document_url?: string
  extracted_fields?: {
    [key: string]: any
  }
  boxes?: Array<{
    id?: string
    box_number: number
    article: string
    net_weight?: number
    gross_weight?: number
    lot_number?: string
  }>
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ""

class InwardApiService {
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`
      try {
        const errorData = await response.json()
        if (errorData?.detail) {
          errorMessage = typeof errorData.detail === 'string' 
            ? errorData.detail 
            : JSON.stringify(errorData.detail)
        }
      } catch {
        // If JSON parsing fails, use status text
        errorMessage = response.statusText || errorMessage
      }
      throw new Error(errorMessage)
    }
    return response.json()
  }

  async createInward(payload: InwardPayload) {
    const response = await fetch(`${API_BASE}/inward`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    })
    return this.handleResponse(response)
  }

  async getInwardList(
    company: Company,
    params?: InwardListParams
  ): Promise<InwardListResponse> {
    const searchParams = new URLSearchParams()
    
    if (params?.page) searchParams.append('page', params.page.toString())
    if (params?.per_page) searchParams.append('per_page', params.per_page.toString())
    if (params?.search) searchParams.append('search', params.search)
    if (params?.from_date) searchParams.append('from_date', params.from_date)
    if (params?.to_date) searchParams.append('to_date', params.to_date)
    
    const queryString = searchParams.toString()
    const url = `${API_BASE}/inward/${company}${queryString ? `?${queryString}` : ''}`
    
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    })
    
    return this.handleResponse<InwardListResponse>(response)
  }

  async getAllInwardRecords(
    company: Company,
    params?: Omit<InwardListParams, 'page' | 'per_page'>
  ): Promise<InwardListResponse> {
    const allRecords: any[] = []
    let currentPage = 1
    let hasMorePages = true
    const maxPerPage = 100 // Backend limit
    
    while (hasMorePages) {
      const searchParams = new URLSearchParams()
      
      // Set page size to maximum allowed
      searchParams.append('per_page', maxPerPage.toString())
      searchParams.append('page', currentPage.toString())
      
      if (params?.search) searchParams.append('search', params.search)
      if (params?.from_date) searchParams.append('from_date', params.from_date)
      if (params?.to_date) searchParams.append('to_date', params.to_date)
      
      const queryString = searchParams.toString()
      const url = `${API_BASE}/inward/${company}?${queryString}`
      
      console.log(`Fetching inward records page ${currentPage}:`, url)
      
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      })
      
      const pageData = await this.handleResponse<InwardListResponse>(response)
      
      // Add records from this page
      allRecords.push(...pageData.records)
      
      // Check if there are more pages
      hasMorePages = pageData.records.length === maxPerPage
      currentPage++
      
      // Safety check to prevent infinite loops
      if (currentPage > 100) {
        console.warn('Download stopped at page 100 to prevent infinite loop')
        break
      }
    }
    
    console.log(`Fetched total of ${allRecords.length} records across ${currentPage - 1} pages`)
    
    return {
      records: allRecords,
      total: allRecords.length,
      page: 1,
      per_page: allRecords.length
    }
  }

  async getInwardDetail(company: Company, transaction_no: string): Promise<InwardDetailResponse> {
    const response = await fetch(`${API_BASE}/inward/${company}/${encodeURIComponent(transaction_no)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    })
    
    return this.handleResponse<InwardDetailResponse>(response)
  }

  async updateInward(company: Company, transaction_no: string, payload: InwardPayload): Promise<any> {
    const response = await fetch(`${API_BASE}/inward/${company}/${encodeURIComponent(transaction_no)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    })
    return this.handleResponse(response)
  }

  async deleteInward(company: Company, transaction_no: string) {
    const response = await fetch(`${API_BASE}/inward/${company}/${encodeURIComponent(transaction_no)}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    })
    return this.handleResponse(response)
  }

  convertToLegacyRecord(detail: InwardDetailResponse): InwardRecord {
    const { transaction, articles, boxes } = detail
    
    // Use the first article for backward compatibility with single-article views
    const firstArticle = articles[0]
    
    return {
      company: detail.company,
      transaction_id: transaction.transaction_no,
      entry_date: transaction.entry_date,
      vehicle_number: transaction.vehicle_number,
      transporter_name: transaction.transporter_name,
      lr_number: transaction.lr_number,
      vendor_supplier_name: transaction.vendor_supplier_name,
      customer_party_name: transaction.customer_party_name,
      source_location: transaction.source_location,
      destination_location: transaction.destination_location,
      challan_number: transaction.challan_number,
      invoice_number: transaction.invoice_number,
      po_number: transaction.po_number,
      grn_number: transaction.grn_number,
      grn_quantity: transaction.grn_quantity,
      system_grn_date: transaction.system_grn_date,
      purchase_by: transaction.purchase_by,
      service_invoice_number: transaction.service_invoice_number,
      dn_number: transaction.dn_number,
      approval_authority: transaction.approval_authority,
      total_amount: transaction.total_amount,
      tax_amount: transaction.tax_amount,
      discount_amount: transaction.discount_amount,
      received_quantity: transaction.received_quantity,
      remark: transaction.remark,
      currency: transaction.currency,
      
      // Article fields from first article (for backward compatibility)
      sku_id: firstArticle?.sku_id,
      item_description: firstArticle?.item_description,
      item_category: firstArticle?.item_category,
      sub_category: firstArticle?.sub_category,
      // item_code: firstArticle?.item_code,
      hsn_code: firstArticle?.hsn_code,
      quality_grade: firstArticle?.quality_grade,
      uom: firstArticle?.uom,
      packaging_type: firstArticle?.packaging_type,
      quantity_units: firstArticle?.quantity_units,
      net_weight: firstArticle?.net_weight,
      total_weight: firstArticle?.total_weight,
      batch_number: firstArticle?.batch_number,
      lot_number: firstArticle?.lot_number,
      manufacturing_date: firstArticle?.manufacturing_date,
      expiry_date: firstArticle?.expiry_date,
      import_date: firstArticle?.import_date,
      unit_rate: firstArticle?.unit_rate,
      
      // Convert boxes to legacy format
      boxes: boxes.map(box => ({
        id: box.id?.toString(),
        box_number: box.box_number,
        article: box.article_description,
        net_weight: box.net_weight,
        gross_weight: box.gross_weight,
        lot_number: box.lot_number,
      }))
    }
  }
}

// Export singleton instance
export const inwardApiService = new InwardApiService()

// Export individual functions for backward compatibility
export const createInward = inwardApiService.createInward.bind(inwardApiService)
export const getInwardList = inwardApiService.getInwardList.bind(inwardApiService)
export const getAllInwardRecords = inwardApiService.getAllInwardRecords.bind(inwardApiService)
export const getInwardDetail = inwardApiService.getInwardDetail.bind(inwardApiService)
export const updateInward = inwardApiService.updateInward.bind(inwardApiService)
export const deleteInward = inwardApiService.deleteInward.bind(inwardApiService)
export const convertToLegacyRecord = inwardApiService.convertToLegacyRecord.bind(inwardApiService)

// Legacy function for compatibility
export const getInward = getInwardDetail