// File: consumption.ts
// Path: frontend/src/types/consumption.ts

export type Company = "CFPL" | "CDPL" | "JTC" | "HOH"
export type MaterialType = "RM" | "PM" | "SFG" | "FG"
export type JobCardStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
export type Priority = "HIGH" | "NORMAL" | "LOW"
export type QCStatus = "HOLD" | "RELEASE" | "REJECT"
export type ValuationMethod = "FIFO" | "LIFO" | "AVERAGE"

// Dashboard Types
export interface DashboardSummary {
  date: string
  company: string
  material_groups: {
    RM: MaterialGroupSummary
    PM: MaterialGroupSummary
    SFG: MaterialGroupSummary
    FG: MaterialGroupSummary
  }
}

export interface MaterialGroupSummary {
  total_qty: number
  total_value: number
  warehouse_count: number
  sku_count: number
}

// Ledger Types
export interface LedgerEntry {
  date: string
  company: string
  warehouse: string
  sku_id: string
  material_type: MaterialType
  opening_stock: number
  stock_in_hand: number
  transfer_in: number
  transfer_out: number
  stock_in: number
  stock_out: number
  closing_stock: number
  valuation_rate: number
  inventory_value_closing: number
  uom: string
}

export interface LedgerRequest {
  date?: string
  warehouse?: string
  sku_id?: string
  material_type?: MaterialType
}

export interface LedgerRangeRequest {
  start_date: string
  end_date: string
  warehouse?: string
  sku_id?: string
  material_type?: MaterialType
  page?: number
  per_page?: number
}

export interface LedgerResponse {
  success: boolean
  message: string
  data: LedgerEntry[]
  total?: number
  page?: number
  per_page?: number
  pages?: number
}

// Job Card Types
export interface JobCard {
  job_card_no: string
  sku_id: string
  sku_name: string
  planned_qty: number
  actual_qty: number
  status: JobCardStatus
  priority: Priority
  due_date: string
  start_date?: string
  completion_date?: string
  production_line: string
  shift: string
  created_at: string
}

export interface JobCardDetail extends JobCard {
  bom_id: string
  bom_name: string
  routing: string
  remarks?: string
  created_by: string
  updated_at: string
  requirements: JobCardRequirement[]
  issues: JobCardIssue[]
  receipts: JobCardReceipt[]
  variances: JobCardVariance[]
}

export interface JobCardRequirement {
  sku_id: string
  sku_name: string
  uom: string
  std_qty: number
  issued_qty: number
  material_type: MaterialType
  qty_with_loss: number
}

export interface JobCardIssue {
  time: string
  sku_id: string
  sku_name: string
  lot_no: string
  batch_no: string
  uom: string
  qty_issued: number
  warehouse: string
  remarks?: string
}

export interface JobCardReceipt {
  time: string
  output_type: MaterialType
  sku_id: string
  sku_name: string
  uom: string
  qty_produced: number
  batch_no: string
  lot_no: string
  yield_pct: number
  scrap_qty: number
  warehouse: string
  qc_status: QCStatus
}

export interface JobCardVariance {
  sku_id: string
  sku_name: string
  std_qty: number
  actual_qty: number
  variance_qty: number
  variance_pct: number
  reason: string
}

export interface JobCardRequest {
  status?: JobCardStatus
  priority?: Priority
  due_date_from?: string
  due_date_to?: string
  sku_id?: string
  page?: number
  per_page?: number
}

export interface CreateJobCardRequest {
  job_card_no: string
  sku_id: string
  bom_id: string
  planned_qty: number
  uom: string
  status: JobCardStatus
  priority: Priority
  due_date: string
  production_line: string
  shift: string
  remarks?: string
  created_by: string
}

// Consumption Types
export interface ConsumptionLine {
  sku_id: string
  material_type: MaterialType
  uom: string
  qty_issued: number
  lot_no: string
  batch_no: string
}

export interface ConsumptionRequest {
  job_card_no: string
  warehouse: string
  lines: ConsumptionLine[]
  remarks?: string
}

export interface ConsumptionResponse {
  success: boolean
  message: string
  data: {
    job_card_no: string
    lines_processed: number
    inventory_moves: string[]
    fifo_allocations: FIFOAllocation[]
  }
}

export interface FIFOAllocation {
  sku_id: string
  lot_no: string
  batch_no: string
  qty_allocated: number
  unit_cost: number
  total_cost: number
}

// Scanner Types
export interface ScannerResolveRequest {
  scan_value: string
  warehouse: string
}

export interface ScannerResolveResponse {
  success: boolean
  message: string
  data: {
    scan_value: string
    resolved_box: string
    resolved_lot: string
    resolved_batch: string
    sku_id: string
    sku_name: string
    material_type: MaterialType
    uom: string
    available_qty: number
    expiry_date: string
    fefo_priority: number
  }
}

export interface FEFOSuggestion {
  lot_no: string
  batch_no: string
  available_qty: number
  expiry_date: string
  unit_cost: number
  priority: number
  recommended_qty: number
}

export interface FEFOSuggestionsResponse {
  success: boolean
  message: string
  data: {
    sku_id: string
    warehouse: string
    required_qty: number
    suggestions: FEFOSuggestion[]
  }
}

// Production Receipt Types
export interface ProductionReceiptLine {
  sku_id: string
  uom: string
  qty_produced: number
  batch_no: string
  lot_no: string
  yield_pct: number
  scrap_qty: number
}

export interface ProductionReceiptRequest {
  job_card_no: string
  output_type: MaterialType
  to_warehouse: string
  qc_required: boolean
  lines: ProductionReceiptLine[]
}

export interface ProductionReceiptResponse {
  success: boolean
  message: string
  data: {
    job_card_no: string
    lines_processed: number
    total_produced: number
    inventory_moves: string[]
    qc_holds: QCHold[]
  }
}

export interface QCHold {
  qc_hold_id: string
  sku_id: string
  qty: number
  status: QCStatus
}

export interface QCReleaseRequest {
  qc_hold_id: string
  qc_status: QCStatus
  qc_remarks?: string
  qc_by: string
}

export interface QCReleaseResponse {
  success: boolean
  message: string
  data: {
    qc_hold_id: string
    status: string
    release_date: string
  }
}

// Transfer Types
export interface TransferLine {
  sku_id: string
  uom: string
  qty: number
  lot_no: string
  batch_no: string
}

export interface TransferRequest {
  source_warehouse: string
  destination_warehouse: string
  lines: TransferLine[]
}

export interface TransferResponse {
  success: boolean
  message: string
  data: {
    source_warehouse: string
    destination_warehouse: string
    lines_processed: number
    inventory_moves: string[]
    cost_carryover: {
      total_value: number
      unit_cost: number
    }
  }
}

export interface TransferHistoryEntry {
  transfer_id: string
  source_warehouse: string
  destination_warehouse: string
  sku_id: string
  sku_name: string
  qty: number
  uom: string
  lot_no: string
  batch_no: string
  unit_cost: number
  total_value: number
  transfer_date: string
  created_by: string
}

export interface TransferHistoryRequest {
  source_warehouse?: string
  destination_warehouse?: string
  sku_id?: string
  date_from?: string
  date_to?: string
  page?: number
  per_page?: number
}

export interface TransferHistoryResponse {
  success: boolean
  message: string
  data: TransferHistoryEntry[]
  total: number
  page: number
  per_page: number
  pages: number
}

// Dispatch Types
export interface DispatchLine {
  sku_id: string
  uom: string
  qty: number
  lot_no: string
  batch_no: string
}

export interface DispatchRequest {
  warehouse: string
  so_no: string
  lines: DispatchLine[]
}

export interface DispatchResponse {
  success: boolean
  message: string
  data: {
    warehouse: string
    so_no: string
    lines_processed: number
    inventory_moves: string[]
    fifo_allocations: FIFOAllocation[]
  }
}

export interface FEFOPicklistItem {
  lot_no: string
  batch_no: string
  available_qty: number
  expiry_date: string
  unit_cost: number
  priority: number
  recommended_qty: number
}

export interface FEFOPicklistResponse {
  success: boolean
  message: string
  data: {
    sku_id: string
    warehouse: string
    required_qty: number
    picklist: FEFOPicklistItem[]
  }
}

// Admin Masters Types
export interface SKU {
  id: string
  name: string
  material_type: MaterialType
  uom: string
  perishable: boolean
  description?: string
  category: string
  sub_category: string
  hsn_code?: string
  gst_rate: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SKURequest {
  page?: number
  per_page?: number
  material_type?: MaterialType
  search?: string
  is_active?: boolean
}

export interface SKUResponse {
  success: boolean
  message: string
  data: SKU[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface Warehouse {
  code: string
  name: string
  sitecode: string
  location: string
  warehouse_type: "STORAGE" | "QC_HOLD" | "PUTAWAY"
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WarehouseRequest {
  page?: number
  per_page?: number
  sitecode?: string
  warehouse_type?: "STORAGE" | "QC_HOLD" | "PUTAWAY"
  is_active?: boolean
}

export interface WarehouseResponse {
  success: boolean
  message: string
  data: Warehouse[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface BOMComponent {
  id: number
  sku_id: string
  material_type: MaterialType
  qty_required: number
  uom: string
  process_loss_pct: number
  extra_giveaway_pct: number
  handling_loss_pct: number
  shrinkage_pct: number
  total_loss_pct: number
  qty_with_loss: number
}

export interface BOM {
  id: string
  name: string
  description?: string
  version: string
  output_sku_id: string
  output_qty: number
  output_uom: string
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
  components: BOMComponent[]
}

export interface BOMRequest {
  page?: number
  per_page?: number
  output_sku_id?: string
  is_active?: boolean
}

export interface BOMResponse {
  success: boolean
  message: string
  data: BOM[]
  total: number
  page: number
  per_page: number
  pages: number
}

// Configuration Types
export interface SystemConfig {
  valuation_method: ValuationMethod
  variance_threshold_pct: number
  fifo_expiry_days: number
  auto_ledger_calculation: boolean
  qc_hold_duration_hours: number
}

export interface ConfigResponse {
  success: boolean
  message: string
  data: SystemConfig
}

export interface ConfigUpdateRequest {
  valuation_method?: ValuationMethod
  variance_threshold_pct?: number
  fifo_expiry_days?: number
  auto_ledger_calculation?: boolean
  qc_hold_duration_hours?: number
}

export interface ConfigUpdateResponse {
  success: boolean
  message: string
  data: {
    updated_fields: string[]
  }
}

// FIFO Layers Types
export interface FIFOLayer {
  id: string
  company: string
  warehouse: string
  item_id: string
  lot: string
  batch: string
  open_qty: number
  open_value: number
  remaining_qty: number
  unit_cost: number
  expiry_date: string
  source_tx_id: string
  created_at: string
  updated_at: string
}

export interface FIFOLayersRequest {
  warehouse: string
  item_id: string
  lot?: string
  batch?: string
}

export interface FIFOLayersResponse {
  success: boolean
  message: string
  data: FIFOLayer[]
}

// QC Holds Types
export interface QCHoldDetail {
  id: string
  inventory_move_id: string
  warehouse: string
  item_id: string
  lot: string
  batch: string
  qty: number
  uom: string
  hold_reason: string
  hold_date: string
  release_date?: string
  status: QCStatus
  qc_remarks?: string
  qc_by?: string
  created_at: string
  updated_at: string
}

export interface QCHoldsRequest {
  warehouse?: string
  status?: QCStatus
  item_id?: string
  page?: number
  per_page?: number
}

export interface QCHoldsResponse {
  success: boolean
  message: string
  data: QCHoldDetail[]
  total: number
  page: number
  per_page: number
  pages: number
}
