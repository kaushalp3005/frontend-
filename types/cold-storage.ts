// types/cold-storage.ts — Cold Storage module type definitions

// ── Record ──────────────────────────────────────────────────────

export interface ColdStorageRecord {
  id: number
  inward_dt: string | null
  unit: string | null
  inward_no: string | null
  item_mark: string | null
  vakkal: string | null
  lot_no: string | null
  no_of_cartons: number | null
  weight_kg: number | null
  total_inventory_kgs: number | null
  group_name: string | null
  item_description: string | null
  storage_location: string | null
  exporter: string | null
  last_purchase_rate: number | null
  value: number | null
  created_at: string | null
  updated_at: string | null
}

// ── Create / Update payloads ────────────────────────────────────

export interface ColdStorageCreatePayload {
  inward_dt?: string
  unit?: string
  inward_no?: string
  item_mark?: string
  vakkal?: string
  lot_no?: string
  no_of_cartons?: number
  weight_kg?: number
  total_inventory_kgs?: number
  group_name?: string
  item_description?: string
  storage_location?: string
  exporter?: string
  last_purchase_rate?: number
  value?: number
}

export type ColdStorageUpdatePayload = Partial<ColdStorageCreatePayload>

// ── Bulk create ─────────────────────────────────────────────────

export interface ColdStorageBulkPayload {
  records: ColdStorageCreatePayload[]
}

export interface ColdStorageBulkResponse {
  status: string
  records_created: number
}

// ── List ────────────────────────────────────────────────────────

export interface ColdStorageListParams {
  page?: number
  per_page?: number
  group_name?: string
  storage_location?: string
  exporter?: string
  item_mark?: string
  search?: string
  from_date?: string
  to_date?: string
  sort_by?: "id" | "inward_dt" | "group_name" | "storage_location" | "exporter" | "total_inventory_kgs" | "value" | "created_at" | "item_description"
  sort_order?: "asc" | "desc"
}

export interface ColdStorageListResponse {
  records: ColdStorageRecord[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

// ── Summary ─────────────────────────────────────────────────────

export interface ColdStorageSummaryItem {
  group_name: string
  total_records: number
  total_cartons: number
  total_inventory_kgs: number
  total_value: number
}

export interface ColdStorageSummaryResponse {
  summary: ColdStorageSummaryItem[]
  grand_total_records: number
  grand_total_inventory_kgs: number
  grand_total_value: number
}

// ── Delete ──────────────────────────────────────────────────────

export interface ColdStorageDeleteResponse {
  success: boolean
  message: string
  id: number | null
}

// ═══════════════════════════════════════════════════════════════
// Bulk Entry (/bulk-entry) types
// ═══════════════════════════════════════════════════════════════

export interface BulkEntryTransaction {
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
  purchased_by?: string
  service_invoice_number?: string | null
  dn_number?: string | null
  approval_authority?: string
  total_amount?: number
  tax_amount?: number
  discount_amount?: number
  po_quantity?: number
  remark?: string
  currency?: string
  warehouse?: string
  status?: string
  approved_by?: string | null
  approved_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface BulkEntryArticle {
  transaction_no: string
  sku_id?: number
  item_description: string
  item_category?: string
  sub_category?: string
  material_type?: string
  quality_grade?: string
  uom?: string
  units?: string
  po_quantity?: number
  quantity_units?: number
  net_weight?: number
  total_weight?: number
  po_weight?: number
  lot_number?: string
  manufacturing_date?: string
  expiry_date?: string
  unit_rate?: number
  total_amount?: number
  carton_weight?: number
  box_count: number
  box_net_weight?: number
  box_gross_weight?: number
}

export interface BulkEntryCreatePayload {
  company: string
  transaction: Omit<BulkEntryTransaction, "status" | "approved_by" | "approved_at" | "created_at" | "updated_at">
  articles: BulkEntryArticle[]
}

export interface BulkEntryBox {
  id?: number
  transaction_no: string
  article_description: string
  box_number: number
  box_id: string
  net_weight?: number
  gross_weight?: number
  lot_number?: string
  count?: number
  status?: string
  created_at?: string
  updated_at?: string
}

export interface BulkEntryArticleResponse {
  article_description: string
  box_ids: string[]
  boxes: BulkEntryBox[]
}

export interface BulkEntryCreateResponse {
  status: string
  transaction_no: string
  company: string
  articles_count: number
  total_boxes_created: number
  articles_with_boxes: BulkEntryArticleResponse[]
}

export interface BulkEntryListParams {
  page?: number
  per_page?: number
  status?: string
  vendor?: string
  source_location?: string
  search?: string
  from_date?: string
  to_date?: string
  sort_by?: string
  sort_order?: "asc" | "desc"
  warehouse?: string
}

export interface BulkEntryListResponse {
  records: BulkEntryTransaction[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface BulkEntryDetailResponse {
  transaction: BulkEntryTransaction
  articles: (BulkEntryArticle & { id: number; created_at: string; updated_at: string })[]
  boxes: BulkEntryBox[]
}

export interface BulkEntryBoxUpsertPayload {
  article_description: string
  box_number: number
  net_weight?: number
  gross_weight?: number
  lot_number?: string
  status?: string
}

export interface BulkEntryBoxUpsertResponse {
  status: "updated" | "inserted"
  box_id: string
  transaction_no: string
  article_description: string
  box_number: number
}

export interface BulkEntryDeleteResponse {
  success: boolean
  message: string
  transaction_no: string
}

export interface BulkEntryBoxListResponse {
  boxes: BulkEntryBox[]
  total: number
}
