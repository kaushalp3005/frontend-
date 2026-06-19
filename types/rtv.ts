// types/rtv.ts — RTV (Return to Vendor) module types
// Matches backend API spec: /rtv/{company}

export type RTVStatus = "Pending" | "Approved"

// Backend matches by name, case-insensitive. Empty/null = no business head.
// Keep in sync with BUSINESS_HEAD_EMAILS in backend/shared/email_notifier.py.
export type BusinessHead =
  | "Prashant Pal"
  | "Ajay Bajaj"
  | "Rakesh Ratra"
  | "Yash Gawdi"
  | "Satyendra Garg"
  | "R M Patil"

export const BUSINESS_HEAD_OPTIONS: BusinessHead[] = [
  "Prashant Pal",
  "Ajay Bajaj",
  "Rakesh Ratra",
  "Yash Gawdi",
  "Satyendra Garg",
  "R M Patil",
]

// Sales POC dropdown. When one is selected, the backend adds their email to the
// RTV mail CC. Keep in sync with SALES_POC_EMAILS in
// backend/shared/email_notifier.py.
export type SalesPOC =
  | "Shubham Shivekar"
  | "Shubham Seth"
  | "Mayuresh Mahadik"
  | "Suraj Salunkhe"
  | "B Hrithik"
  | "Sachin More"
  | "Dashrath Birajdar"
  | "Ashwin Baghul"
  | "Rakesh Ratra"
  | "Ajay Bajaj"
  | "Yash Gawdi"
  | "R M Patil"
  | "Satyendra Garg"
  | "Prashant Pal"

export const SALES_POC_OPTIONS: SalesPOC[] = [
  "Shubham Shivekar",
  "Shubham Seth",
  "Mayuresh Mahadik",
  "Suraj Salunkhe",
  "B Hrithik",
  "Sachin More",
  "Dashrath Birajdar",
  "Ashwin Baghul",
  "Rakesh Ratra",
  "Ajay Bajaj",
  "Yash Gawdi",
  "R M Patil",
  "Satyendra Garg",
  "Prashant Pal",
]

// ─── Header ────────────────────────────────────────────────────────

export interface RTVHeader {
  id: number
  rtv_id: string              // Format: CR-YYYYMMDDHHmmSS (legacy records may be RTV-…)
  rtv_date: string | null
  factory_unit: string
  customer: string
  invoice_number: string | null
  challan_no: string | null
  dn_no: string | null
  conversion: string | null
  sales_poc: string | null
  business_head: BusinessHead | string | null
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
  business_head?: BusinessHead | string | null
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
  business_head?: BusinessHead | string | null
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
  lot_number?: string | null
  item_mark?: string | null
  spl_remarks?: string | null
  vakkal?: string | null
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
  lot_number?: string
  item_mark?: string
  spl_remarks?: string
  vakkal?: string
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
  item_mark?: string | null
  spl_remarks?: string | null
  vakkal?: string | null
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
  item_mark?: string
  spl_remarks?: string
  vakkal?: string
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

// ─── Bulk box save (state-aware full sync) ─────────────────────────
// PUT /rtv/{company}/{rtv_id}/boxes — persists the complete box set on the
// post-approval final submit. Insert new / update changed / keep unchanged /
// delete removed, preserving box_id & printed state on matched rows.

export interface RTVBulkBoxItem {
  article_description: string
  box_number: number
  uom?: string
  conversion?: string
  lot_number?: string
  item_mark?: string
  spl_remarks?: string
  vakkal?: string
  net_weight?: string
  gross_weight?: string
  count?: number
}

export interface RTVBulkBoxUpdateRequest {
  boxes: RTVBulkBoxItem[]
}

export interface RTVBulkBoxUpdateResponse {
  status: string
  rtv_id: string
  inserted: number
  updated: number
  unchanged: number
  deleted: number
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
  business_head: BusinessHead | string | null
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
  // Actual returned net weight (kg) = Σ box net weights (fan-out-free subquery).
  total_net_weight: number
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
  business_head?: BusinessHead | string | null
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
  lot_number?: string
  item_mark?: string
  spl_remarks?: string
  vakkal?: string
}

export interface RTVApprovalBoxFields {
  article_description: string
  box_number: number
  uom?: string
  conversion?: string
  net_weight?: string
  gross_weight?: string
  lot_number?: string
  item_mark?: string
  spl_remarks?: string
  vakkal?: string
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

// ─── Send for Approval ────────────────────────────────────────────

export interface SendForApprovalResponse {
  status: string
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
  rtv_id: string              // The CR-YYYYMMDD… string (legacy: RTV-…)
  changes: RTVBoxEditChange[]
}

export interface RTVBoxEditLogResponse {
  status: string
  entries: number
}
