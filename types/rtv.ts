// types/rtv.ts — RTV (Return to Vendor) module types
// Matches backend API spec: /rtv/{company}

export type RTVStatus = "Pending" | "Approved"

// ─── Header ────────────────────────────────────────────────────────

export interface RTVHeader {
  id: number
  rtv_id: string              // Format: RTV-YYYYMMDDHHmmSS
  rtv_date: string | null
  factory_unit: string
  customer: string
  invoice_number: string | null
  challan_no: string | null
  dn_no: string | null
  conversion: string | null
  sales_poc: string | null
  remark: string | null
  // Dispatch / logistics fields (backend addition)
  vehicle_number: string | null
  transporter_name: string | null
  driver_name: string | null
  inward_manager: string | null
  status: RTVStatus
  created_by: string | null
  created_ts: string | null
  updated_at: string | null
}

export interface RTVHeaderCreate {
  factory_unit: string
  customer: string
  invoice_number?: string
  challan_no?: string
  dn_no?: string
  conversion?: string
  sales_poc?: string
  remark?: string
  vehicle_number?: string
  transporter_name?: string
  driver_name?: string
  inward_manager?: string
}

export interface RTVHeaderUpdate {
  factory_unit?: string
  customer?: string
  invoice_number?: string
  challan_no?: string
  dn_no?: string
  conversion?: string
  sales_poc?: string
  remark?: string
  vehicle_number?: string
  transporter_name?: string
  driver_name?: string
  inward_manager?: string
  status?: RTVStatus
}

// ─── Lines ─────────────────────────────────────────────────────────

export interface RTVLine {
  id: number
  header_id: number
  material_type: string
  item_category: string
  sub_category: string
  item_description: string
  sale_group: string | null
  uom: string
  qty: string
  rate: string
  value: string
  conversion: string | null
  carton_weight: string | null
  net_weight: string | null
  created_at: string | null
  updated_at: string | null
}

export interface RTVLineCreate {
  material_type: string
  item_category: string
  sub_category: string
  item_description: string
  sale_group?: string
  uom: string
  qty?: string
  rate?: string
  value?: string
  conversion?: string
  carton_weight?: string
  net_weight?: string
}

// ─── Boxes ─────────────────────────────────────────────────────────

export interface RTVBox {
  id: number
  header_id: number
  rtv_line_id: number | null
  box_number: number
  box_id: string | null       // NULL until printed
  article_description: string
  lot_number: string | null
  uom: string | null
  conversion: string | null
  net_weight: string
  gross_weight: string
  count: number | null
  created_at: string | null
  updated_at: string | null
}

export interface RTVBoxUpsertRequest {
  article_description: string
  box_number: number
  uom?: string
  conversion?: string
  net_weight?: string
  gross_weight?: string
  lot_number?: string
  count?: number
}

export interface RTVBoxUpsertResponse {
  // Backend now returns "unchanged" when a diff detects no column changes.
  status: "inserted" | "updated" | "unchanged"
  box_id: string
  rtv_id: string
  article_description: string
  box_number: number
}

// ─── Composite types ───────────────────────────────────────────────

export interface RTVWithDetails extends RTVHeader {
  lines: RTVLine[]
  boxes: RTVBox[]
}

// ─── Create ────────────────────────────────────────────────────────

export interface RTVCreateRequest {
  company: string
  header: RTVHeaderCreate
  lines: RTVLineCreate[]
}

// ─── List ──────────────────────────────────────────────────────────
// RTVListItem is a slimmer projection of RTVHeader plus aggregate counters.
// Backend no longer echoes invoice/challan/dn/sales_poc/remark on list rows,
// so it's not a full RTVHeader extension. Declared explicitly below.

export interface RTVListItem {
  id: number
  rtv_id: string
  rtv_date: string | null
  factory_unit: string
  customer: string
  vehicle_number: string | null
  transporter_name: string | null
  driver_name: string | null
  inward_manager: string | null
  status: RTVStatus
  conversion: string | null
  created_by: string | null
  created_ts: string | null
  updated_at: string | null
  items_count: number
  boxes_count: number
  // total_qty is now a true SUM(l.qty) — backend bug-fix noted in spec.
  total_qty: number
}

export interface RTVListResponse {
  records: RTVListItem[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface RTVListParams {
  page?: number
  per_page?: number
  status?: string
  factory_unit?: string
  customer?: string
  from_date?: string          // DD-MM-YYYY
  to_date?: string            // DD-MM-YYYY
  sort_by?: string
  sort_order?: "asc" | "desc"
}

// ─── Lines Update ──────────────────────────────────────────────────

export interface RTVLinesUpdateRequest {
  lines: RTVLineCreate[]
}

export interface RTVLinesUpdateResponse {
  status: string
  rtv_id: string
  lines_count: number
  // New counters from the state-diff merge semantics.
  inserted: number
  updated: number
  unchanged: number
}

// ─── Approve ───────────────────────────────────────────────────────

export interface RTVApprovalHeaderFields {
  factory_unit?: string
  customer?: string
  invoice_number?: string
  challan_no?: string
  dn_no?: string
  conversion?: string
  sales_poc?: string
  remark?: string
  vehicle_number?: string
  transporter_name?: string
  driver_name?: string
  inward_manager?: string
}

export interface RTVApprovalLineFields {
  item_description: string    // key field
  qty?: string
  rate?: string
  value?: string
  conversion?: string
  carton_weight?: string
  net_weight?: string
  uom?: string
  material_type?: string
  item_category?: string
  sub_category?: string
  sale_group?: string
}

export interface RTVApprovalBoxFields {
  article_description: string
  box_number: number
  uom?: string
  conversion?: string
  net_weight?: string
  gross_weight?: string
  lot_number?: string
  count?: number
}

export interface RTVApprovalRequest {
  approved_by: string
  header?: RTVApprovalHeaderFields
  lines?: RTVApprovalLineFields[]
  boxes?: RTVApprovalBoxFields[]
}

export interface RTVApprovalResponse {
  status: string
  rtv_id: string
  company: string
  approved_by: string
  approved_at: string
}

// ─── Summary (NEW) ─────────────────────────────────────────────────
// GET /rtv/{company}/{rtv_id}/summary — short roll-up for detail screen /
// dispatch checklist. Weights are 3-decimal-precision sums over rtv_boxes.

export interface RTVSummaryResponse {
  rtv_id: string
  company: string
  status: RTVStatus
  items_count: number
  total_qty: number
  boxes_count: number
  total_net_weight: number
  total_gross_weight: number
}

// ─── SKU endpoints (NEW) ───────────────────────────────────────────
// Backed by the company-agnostic all_sku table. `company` query param is
// optional and ignored server-side; kept in the call sites only so the
// frontend doesn't have to branch.

export interface AllSkuItem {
  sku_id: number
  particulars: string
  item_type: string
  item_group: string
  sub_group: string
  uom: string | null
  sale_group: string | null
  gst: string | null
  batch_strategy: string | null
  min_shelf_life_days: number | null
  created_at: string | null
}

export interface RTVSkuDropdownParams {
  item_type?: string
  item_group?: string
  sub_group?: string
  search?: string
  limit?: number
  offset?: number
}

export interface RTVSkuDropdownResponse {
  item_types: string[]
  item_groups: string[]
  sub_groups: string[]
  items: AllSkuItem[]
  total_items: number
  limit: number
  offset: number
}

export interface RTVSkuSearchParams {
  search: string
  limit?: number
  offset?: number
}

export interface RTVSkuSearchResponse {
  items: AllSkuItem[]
  total: number
  limit: number
  offset: number
}

// ─── Delete ────────────────────────────────────────────────────────

export interface RTVDeleteResponse {
  success: boolean
  message: string
  rtv_id: string
}

// ─── Box edit log ──────────────────────────────────────────────────

export interface RTVBoxEditChange {
  field_name: string
  old_value?: string
  new_value?: string
}

export interface RTVBoxEditLogRequest {
  email_id: string
  box_id: string
  rtv_id: string              // The RTV-YYYYMMDD... string
  changes: RTVBoxEditChange[]
}

export interface RTVBoxEditLogResponse {
  status: string
  entries: number
}
