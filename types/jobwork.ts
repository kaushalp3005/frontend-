// Jobwork module types

export type JWOStatus = "Open" | "Partially Received" | "Fully Received" | "Reconciled" | "Closed"
export type LossStatus = "Normal" | "Excess Loss" | "Underweight Waste" | "Pending"
export type ReceiptType = "Partial" | "Final"
export type ProcessType = "Deseeding" | "Cracking" | "Slicing" | "Dicing" | "Thermopacking" | "Stuffing"

export interface JobworkOrder {
  id: number
  jwo_id: string
  dispatch_date: string
  vendor_name: string
  item_name: string
  item_description: string
  process_type: ProcessType
  qty_dispatched: number
  uom: string
  jwo_status: JWOStatus
  expected_loss_pct: number
  overdue_threshold_days: number
  created_at: string
  updated_at: string
}

export interface InwardReceipt {
  id: number
  jwo_id: number
  ir_number: string
  ir_date: string
  receipt_type: ReceiptType
  fg_qty_received: number
  waste_qty_received: number
  rejection_qty: number
  actual_loss_pct: number
  loss_status: LossStatus
  remarks: string
  created_at: string
}

// Dashboard filter types
export interface JobworkDashboardFilters {
  date_from?: string
  date_to?: string
  months?: string[]          // e.g. ["2026-01", "2026-02"]
  vendors?: string[]
  items?: string[]
  process_types?: ProcessType[]
  jwo_statuses?: JWOStatus[]
  loss_statuses?: LossStatus[]
  group_by?: GroupByOption
}

export type GroupByOption = "month" | "vendor" | "item" | "process_type" | "jwo_status"

// KPI cards data
export interface JobworkKPIs {
  total_jwos: number
  total_dispatched_kgs: number
  total_fg_received_kgs: number
  avg_loss_pct: number
  open_pending_jwos: number
  excess_loss_flags: number
}

// Summary table row (grouped)
export interface JobworkSummaryRow {
  group_label: string
  num_jwos: number
  total_dispatched_kgs: number
  total_fg_received_kgs: number
  total_waste_received_kgs: number
  total_rejection_kgs: number
  unaccounted_balance_kgs: number
  avg_loss_pct: number
  open_jwos: number
  overdue_jwos: number
  excess_loss_flags: number
  avg_turnaround_days: number
}

// Expanded JWO detail row
export interface JobworkDetailRow {
  id: number
  jwo_id: string
  dispatch_date: string
  vendor_name: string
  item_name: string
  process_type: ProcessType
  qty_dispatched: number
  fg_received: number
  waste_received: number
  rejection: number
  unaccounted_balance: number
  actual_loss_pct: number
  loss_status: LossStatus
  jwo_status: JWOStatus
  turnaround_days: number | null
}

// Full dashboard response
export interface JobworkDashboardResponse {
  kpis: JobworkKPIs
  summary: JobworkSummaryRow[]
  group_by: GroupByOption
  as_of_date: string
  filters_applied: number
}

// Dropdown options for filters
export interface JobworkFilterOptions {
  vendors: { name: string; active_jwo_count: number }[]
  items: string[]
  process_types: string[]
}

// JWO detail with IRs (for expansion)
export interface JobworkJWODetail {
  jwo: JobworkDetailRow
  inward_receipts: InwardReceipt[]
}
