export type GroupByOption = "vendor" | "item" | "process_type" | "month" | "jwo_status"

export interface JobworkKPIs {
  total_jwos: number
  total_dispatched_kgs: number
  total_fg_received_kgs: number
  avg_loss_pct: number
  open_pending_jwos: number
  excess_loss_flags: number
}

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

export interface JobworkDetailRow {
  id: number
  jwo_id: string
  dispatch_date: string
  vendor_name: string
  item_name: string
  process_type: string
  qty_dispatched: number
  fg_received: number
  waste_received: number
  rejection: number
  unaccounted_balance: number
  actual_loss_pct: number
  loss_status: string
  jwo_status: string
  turnaround_days: number | null
}

export interface InwardReceipt {
  id: number
  jwo_id: number
  ir_number: string
  ir_date: string
  receipt_type: string
  fg_qty_received: number
  waste_qty_received: number
  rejection_qty: number
  actual_loss_pct: number
  loss_status: string
  remarks: string
  created_at: string
}

export interface DashboardSummaryResponse {
  kpis: JobworkKPIs
  summary: JobworkSummaryRow[]
  group_by: string
  as_of_date: string
  filters_applied: number
}

export interface FilterOptionsResponse {
  vendors: { name: string; active_jwo_count: number }[]
  items: string[]
  process_types: string[]
}
