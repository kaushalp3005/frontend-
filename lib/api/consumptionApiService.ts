// File: consumptionApiService.ts
// Path: frontend/src/lib/api/consumptionApiService.ts

import {
  Company,
  DashboardSummary,
  LedgerRequest,
  LedgerRangeRequest,
  LedgerResponse,
  JobCardRequest,
  JobCard,
  JobCardDetail,
  CreateJobCardRequest,
  ConsumptionRequest,
  ConsumptionResponse,
  ScannerResolveRequest,
  ScannerResolveResponse,
  FEFOSuggestionsResponse,
  ProductionReceiptRequest,
  ProductionReceiptResponse,
  QCReleaseRequest,
  QCReleaseResponse,
  TransferRequest,
  TransferResponse,
  TransferHistoryRequest,
  TransferHistoryResponse,
  DispatchRequest,
  DispatchResponse,
  FEFOPicklistResponse,
  SKURequest,
  SKUResponse,
  WarehouseRequest,
  WarehouseResponse,
  BOMRequest,
  BOMResponse,
  SystemConfig,
  ConfigResponse,
  ConfigUpdateRequest,
  ConfigUpdateResponse,
  FIFOLayersRequest,
  FIFOLayersResponse,
  QCHoldsRequest,
  QCHoldsResponse
} from "@/types/consumption"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ""

class ConsumptionApiService {
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
        errorMessage = response.statusText || errorMessage
      }
      
      // Provide more specific error messages for common cases
      if (response.status === 404) {
        errorMessage = `Endpoint not found (404) - ${errorMessage}`
      } else if (response.status === 500) {
        errorMessage = `Server error (500) - ${errorMessage}`
      }
      
      throw new Error(errorMessage)
    }
    return response.json()
  }

  // Dashboard API
  async getDashboardSummary(company: Company, params?: {
    date?: string
    warehouse?: string
  }): Promise<DashboardSummary> {
    const searchParams = new URLSearchParams()
    if (params?.date) searchParams.append('date', params.date)
    if (params?.warehouse) searchParams.append('warehouse', params.warehouse)
    
    const queryString = searchParams.toString()
    const url = `${API_BASE}/consumption/dashboard/summary${queryString ? `?${queryString}` : ''}`
    
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    })
    
    const result = await this.handleResponse<{ success: boolean; message: string; data: DashboardSummary }>(response)
    return result.data
  }

  // Ledger API
  async getLedgerData(request: LedgerRequest): Promise<LedgerResponse> {
    const response = await fetch(`${API_BASE}/consumption/ledger`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
    })
    
    return this.handleResponse<LedgerResponse>(response)
  }

  async getLedgerRange(request: LedgerRangeRequest): Promise<LedgerResponse> {
    const searchParams = new URLSearchParams()
    searchParams.append('start_date', request.start_date)
    searchParams.append('end_date', request.end_date)
    if (request.warehouse) searchParams.append('warehouse', request.warehouse)
    if (request.sku_id) searchParams.append('sku_id', request.sku_id)
    if (request.material_type) searchParams.append('material_type', request.material_type)
    if (request.page) searchParams.append('page', request.page.toString())
    if (request.per_page) searchParams.append('per_page', request.per_page.toString())
    
    const queryString = searchParams.toString()
    const url = `${API_BASE}/consumption/ledger/range?${queryString}`
    
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    })
    
    return this.handleResponse<LedgerResponse>(response)
  }

  // Job Cards API
  async getJobCards(request: JobCardRequest): Promise<{
    success: boolean
    message: string
    data: JobCard[]
    total: number
    page: number
    per_page: number
    pages: number
  }> {
    const searchParams = new URLSearchParams()
    if (request.status) searchParams.append('status', request.status)
    if (request.priority) searchParams.append('priority', request.priority)
    if (request.due_date_from) searchParams.append('due_date_from', request.due_date_from)
    if (request.due_date_to) searchParams.append('due_date_to', request.due_date_to)
    if (request.sku_id) searchParams.append('sku_id', request.sku_id)
    if (request.page) searchParams.append('page', request.page.toString())
    if (request.per_page) searchParams.append('per_page', request.per_page.toString())
    
    const queryString = searchParams.toString()
    const url = `${API_BASE}/consumption/job-card?${queryString}`
    
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    })
    
    return this.handleResponse(response)
  }

  async getJobCardDetail(jobCardNo: string): Promise<{
    success: boolean
    message: string
    data: JobCardDetail
  }> {
    const response = await fetch(`${API_BASE}/consumption/job-card/${encodeURIComponent(jobCardNo)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    })
    
    return this.handleResponse(response)
  }

  async createJobCard(request: CreateJobCardRequest): Promise<{
    success: boolean
    message: string
    data: { job_card_no: string }
  }> {
    const response = await fetch(`${API_BASE}/consumption/job-card`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
    })
    
    return this.handleResponse(response)
  }

  // Consumption API
  async postConsumption(request: ConsumptionRequest): Promise<ConsumptionResponse> {
    const response = await fetch(`${API_BASE}/consumption/consumption`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
    })
    
    return this.handleResponse<ConsumptionResponse>(response)
  }

  async resolveScanner(request: ScannerResolveRequest): Promise<ScannerResolveResponse> {
    const response = await fetch(`${API_BASE}/consumption/scanner/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
    })
    
    return this.handleResponse<ScannerResolveResponse>(response)
  }

  async getFEFOSuggestions(params: {
    warehouse: string
    sku_id: string
    required_qty: number
  }): Promise<FEFOSuggestionsResponse> {
    const searchParams = new URLSearchParams()
    searchParams.append('warehouse', params.warehouse)
    searchParams.append('sku_id', params.sku_id)
    searchParams.append('required_qty', params.required_qty.toString())
    
    const queryString = searchParams.toString()
    const url = `${API_BASE}/consumption/fifo-suggestions?${queryString}`
    
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    })
    
    return this.handleResponse<FEFOSuggestionsResponse>(response)
  }

  // Production Receipt API
  async postProductionReceipt(request: ProductionReceiptRequest): Promise<ProductionReceiptResponse> {
    const response = await fetch(`${API_BASE}/consumption/receipt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
    })
    
    return this.handleResponse<ProductionReceiptResponse>(response)
  }

  async releaseQCHold(request: QCReleaseRequest): Promise<QCReleaseResponse> {
    const response = await fetch(`${API_BASE}/consumption/qc-release`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
    })
    
    return this.handleResponse<QCReleaseResponse>(response)
  }

  // Transfer API
  async postTransfer(request: TransferRequest): Promise<TransferResponse> {
    const response = await fetch(`${API_BASE}/consumption/transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
    })
    
    return this.handleResponse<TransferResponse>(response)
  }

  async getTransferHistory(request: TransferHistoryRequest): Promise<TransferHistoryResponse> {
    const searchParams = new URLSearchParams()
    if (request.source_warehouse) searchParams.append('source_warehouse', request.source_warehouse)
    if (request.destination_warehouse) searchParams.append('destination_warehouse', request.destination_warehouse)
    if (request.sku_id) searchParams.append('sku_id', request.sku_id)
    if (request.date_from) searchParams.append('date_from', request.date_from)
    if (request.date_to) searchParams.append('date_to', request.date_to)
    if (request.page) searchParams.append('page', request.page.toString())
    if (request.per_page) searchParams.append('per_page', request.per_page.toString())
    
    const queryString = searchParams.toString()
    const url = `${API_BASE}/consumption/transfer/history?${queryString}`
    
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    })
    
    return this.handleResponse<TransferHistoryResponse>(response)
  }

  // Dispatch API
  async postDispatch(request: DispatchRequest): Promise<DispatchResponse> {
    const response = await fetch(`${API_BASE}/consumption/dispatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
    })
    
    return this.handleResponse<DispatchResponse>(response)
  }

  async getFEFOPicklist(params: {
    warehouse: string
    sku_id: string
    required_qty: number
  }): Promise<FEFOPicklistResponse> {
    const searchParams = new URLSearchParams()
    searchParams.append('warehouse', params.warehouse)
    searchParams.append('sku_id', params.sku_id)
    searchParams.append('required_qty', params.required_qty.toString())
    
    const queryString = searchParams.toString()
    const url = `${API_BASE}/consumption/dispatch/fefo-picklist?${queryString}`
    
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    })
    
    return this.handleResponse<FEFOPicklistResponse>(response)
  }

  // Admin Masters API
  async getSKUs(request: SKURequest): Promise<SKUResponse> {
    const searchParams = new URLSearchParams()
    if (request.page) searchParams.append('page', request.page.toString())
    if (request.per_page) searchParams.append('per_page', request.per_page.toString())
    if (request.material_type) searchParams.append('material_type', request.material_type)
    if (request.search) searchParams.append('search', request.search)
    if (request.is_active !== undefined) searchParams.append('is_active', request.is_active.toString())
    
    const queryString = searchParams.toString()
    const url = `${API_BASE}/consumption/sku?${queryString}`
    
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    })
    
    return this.handleResponse<SKUResponse>(response)
  }

  async getWarehouses(request: WarehouseRequest): Promise<WarehouseResponse> {
    const searchParams = new URLSearchParams()
    if (request.page) searchParams.append('page', request.page.toString())
    if (request.per_page) searchParams.append('per_page', request.per_page.toString())
    if (request.sitecode) searchParams.append('sitecode', request.sitecode)
    if (request.warehouse_type) searchParams.append('warehouse_type', request.warehouse_type)
    if (request.is_active !== undefined) searchParams.append('is_active', request.is_active.toString())
    
    const queryString = searchParams.toString()
    const url = `${API_BASE}/consumption/warehouse?${queryString}`
    
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    })
    
    return this.handleResponse<WarehouseResponse>(response)
  }

  async getBOMs(request: BOMRequest): Promise<BOMResponse> {
    const searchParams = new URLSearchParams()
    if (request.page) searchParams.append('page', request.page.toString())
    if (request.per_page) searchParams.append('per_page', request.per_page.toString())
    if (request.output_sku_id) searchParams.append('output_sku_id', request.output_sku_id)
    if (request.is_active !== undefined) searchParams.append('is_active', request.is_active.toString())
    
    const queryString = searchParams.toString()
    const url = `${API_BASE}/consumption/bom?${queryString}`
    
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    })
    
    return this.handleResponse<BOMResponse>(response)
  }

  // Configuration API
  async getConfig(): Promise<ConfigResponse> {
    const response = await fetch(`${API_BASE}/consumption/config`, {
      method: "GET",
      headers: { Accept: "application/json" },
    })
    
    return this.handleResponse<ConfigResponse>(response)
  }

  async updateConfig(request: ConfigUpdateRequest): Promise<ConfigUpdateResponse> {
    const response = await fetch(`${API_BASE}/consumption/config`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
    })
    
    return this.handleResponse<ConfigUpdateResponse>(response)
  }

  // FIFO Layers API
  async getFIFOLayers(request: FIFOLayersRequest): Promise<FIFOLayersResponse> {
    const searchParams = new URLSearchParams()
    searchParams.append('warehouse', request.warehouse)
    searchParams.append('item_id', request.item_id)
    if (request.lot) searchParams.append('lot', request.lot)
    if (request.batch) searchParams.append('batch', request.batch)
    
    const queryString = searchParams.toString()
    const url = `${API_BASE}/consumption/fifo-layers?${queryString}`
    
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    })
    
    return this.handleResponse<FIFOLayersResponse>(response)
  }

  // QC Holds API
  async getQCHolds(request: QCHoldsRequest): Promise<QCHoldsResponse> {
    const searchParams = new URLSearchParams()
    if (request.warehouse) searchParams.append('warehouse', request.warehouse)
    if (request.status) searchParams.append('status', request.status)
    if (request.item_id) searchParams.append('item_id', request.item_id)
    if (request.page) searchParams.append('page', request.page.toString())
    if (request.per_page) searchParams.append('per_page', request.per_page.toString())
    
    const queryString = searchParams.toString()
    const url = `${API_BASE}/consumption/qc-holds?${queryString}`
    
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    })
    
    return this.handleResponse<QCHoldsResponse>(response)
  }
}

// Export singleton instance
export const consumptionApiService = new ConsumptionApiService()

// Export individual functions for convenience
export const getDashboardSummary = consumptionApiService.getDashboardSummary.bind(consumptionApiService)
export const getLedgerData = consumptionApiService.getLedgerData.bind(consumptionApiService)
export const getLedgerRange = consumptionApiService.getLedgerRange.bind(consumptionApiService)
export const getJobCards = consumptionApiService.getJobCards.bind(consumptionApiService)
export const getJobCardDetail = consumptionApiService.getJobCardDetail.bind(consumptionApiService)
export const createJobCard = consumptionApiService.createJobCard.bind(consumptionApiService)
export const postConsumption = consumptionApiService.postConsumption.bind(consumptionApiService)
export const resolveScanner = consumptionApiService.resolveScanner.bind(consumptionApiService)
export const getFEFOSuggestions = consumptionApiService.getFEFOSuggestions.bind(consumptionApiService)
export const postProductionReceipt = consumptionApiService.postProductionReceipt.bind(consumptionApiService)
export const releaseQCHold = consumptionApiService.releaseQCHold.bind(consumptionApiService)
export const postTransfer = consumptionApiService.postTransfer.bind(consumptionApiService)
export const getTransferHistory = consumptionApiService.getTransferHistory.bind(consumptionApiService)
export const postDispatch = consumptionApiService.postDispatch.bind(consumptionApiService)
export const getFEFOPicklist = consumptionApiService.getFEFOPicklist.bind(consumptionApiService)
export const getSKUs = consumptionApiService.getSKUs.bind(consumptionApiService)
export const getWarehouses = consumptionApiService.getWarehouses.bind(consumptionApiService)
export const getBOMs = consumptionApiService.getBOMs.bind(consumptionApiService)
export const getConfig = consumptionApiService.getConfig.bind(consumptionApiService)
export const updateConfig = consumptionApiService.updateConfig.bind(consumptionApiService)
export const getFIFOLayers = consumptionApiService.getFIFOLayers.bind(consumptionApiService)
export const getQCHolds = consumptionApiService.getQCHolds.bind(consumptionApiService)
