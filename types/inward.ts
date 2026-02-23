// types/inward.ts — v2 schema aligned with Inward Module Architecture

import { useAuthStore } from "@/lib/stores/auth"

export type Company = "CFPL" | "CDPL"
export type InwardStatus = "pending" | "approved" | "rejected"

// ─── DB Table Types (v2) ───────────────────────────────────

export interface TransactionV2 {
  transaction_no: string
  entry_date: string
  status: InwardStatus
  // Party info (filled by PO Extract)
  vendor_supplier_name?: string
  customer_party_name?: string
  source_location?: string
  destination_location?: string
  po_number?: string
  purchased_by?: string
  total_amount?: number
  tax_amount?: number
  discount_amount?: number
  po_quantity?: number
  currency?: string
  // Transport & docs (filled by Approver)
  vehicle_number?: string
  transporter_name?: string
  lr_number?: string
  challan_number?: string
  invoice_number?: string
  grn_number?: string
  grn_quantity?: number
  system_grn_date?: string
  service_invoice_number?: string
  dn_number?: string
  approval_authority?: string
  remark?: string
  warehouse?: string
  service?: boolean
  rtv?: boolean
  // Approval metadata (auto)
  approved_by?: string
  approved_at?: string
  rejection_remark?: string
  created_at?: string
}

export interface ArticleV2 {
  id?: number
  transaction_no?: string
  // PO Extract fields
  item_description: string
  po_weight?: number
  // SKU Lookup fields
  sku_id?: number
  material_type?: string
  item_category?: string
  sub_category?: string
  // Approval fields
  quality_grade?: string
  uom?: string
  po_quantity?: number
  units?: number
  quantity_units?: number
  net_weight?: number
  total_weight?: number
  lot_number?: string
  manufacturing_date?: string
  expiry_date?: string
  unit_rate?: number
  total_amount?: number
  carton_weight?: number
  created_at?: string
}

export interface BoxV2 {
  id?: number
  transaction_no?: string
  article_description: string
  box_number: number
  net_weight?: number
  gross_weight?: number
  lot_number?: string
  count?: number
  box_id?: string
  created_at?: string
}

// ─── Box Upsert + Edit Log Types ───────────────────────────

export interface BoxUpsertPayload {
  article_description: string
  box_number: number
  net_weight?: number
  gross_weight?: number
  lot_number?: string
  count?: number
}

export interface BoxUpsertResponse {
  status: "inserted" | "updated"
  box_id: string
  transaction_no: string
  article_description: string
  box_number: number
}

export interface BoxEditLogPayload {
  email_id: string
  box_id: string
  transaction_no: string
  changes: Array<{
    field_name: string
    old_value?: string
    new_value?: string
  }>
}

// ─── API Request/Response Types ────────────────────────────

// POST /inward/extract-po
export interface POExtractResponse {
  supplier_name?: string
  source_location?: string
  customer_name?: string
  destination_location?: string
  po_number?: string
  purchased_by?: string
  total_amount?: number
  tax_amount?: number
  discount_amount?: number
  po_quantity?: number
  currency?: string
  articles: Array<{
    item_description: string
    po_weight?: number
    unit_rate?: number
    total_amount?: number
  }>
}

// POST /inward/sku-lookup/{company}
export interface SKULookupRequest {
  item_description: string
}

export interface SKULookupResponse {
  sku_id?: number | null
  item_description?: string
  material_type?: string | null
  item_category?: string | null
  sub_category?: string | null
}

// POST /inward — Create (status = pending)
export interface CreateInwardPayload {
  company: Company
  transaction: {
    transaction_no: string
    entry_date: string
    vendor_supplier_name?: string
    customer_party_name?: string
    source_location?: string
    destination_location?: string
    po_number?: string
    purchased_by?: string
    total_amount?: number
    tax_amount?: number
    discount_amount?: number
    po_quantity?: number
    currency?: string
  }
  articles: Array<{
    transaction_no: string
    item_description: string
    po_weight?: number
    sku_id?: number
    material_type?: string
    item_category?: string
    sub_category?: string
  }>
  boxes: Array<{
    transaction_no: string
    article_description: string
    box_number: number
    net_weight?: number
    gross_weight?: number
    lot_number?: string
    count?: number
  }>
}

// PUT /inward/{company}/{txn}/approve
export interface ApprovePayload {
  approved_by: string
  transaction: {
    warehouse?: string
    vehicle_number?: string
    transporter_name?: string
    lr_number?: string
    challan_number?: string
    invoice_number?: string
    grn_number?: string
    grn_quantity?: number
    system_grn_date?: string
    service_invoice_number?: string
    dn_number?: string
    approval_authority?: string
    remark?: string
    service?: boolean
    rtv?: boolean
  }
  articles: Array<{
    item_description: string
    quality_grade?: string
    uom?: string
    po_quantity?: number
    units?: number
    quantity_units?: number
    net_weight?: number
    total_weight?: number
    lot_number?: string
    manufacturing_date?: string
    expiry_date?: string
    unit_rate?: number
    total_amount?: number
    carton_weight?: number
  }>
  boxes: Array<{
    article_description: string
    box_number: number
    net_weight?: number
    gross_weight?: number
    lot_number?: string
    count?: number
  }>
}


// PUT /inward/{company}/{txn} — Update (pending only)
export interface UpdateInwardPayload {
  company: Company
  transaction: Partial<CreateInwardPayload["transaction"]>
  articles: CreateInwardPayload["articles"]
  boxes: CreateInwardPayload["boxes"]
}

// GET /inward?company=&status= — List
export interface InwardListItem {
  transaction_no: string
  entry_date: string
  status: InwardStatus
  vendor_supplier_name?: string
  customer_party_name?: string
  po_number?: string
  total_amount?: number
  item_descriptions: string[]
  quantities_and_uoms: string[]
  has_edits?: boolean
}

export interface InwardListResponse {
  records: InwardListItem[]
  total: number
  page: number
  per_page: number
}

export interface InwardListParams {
  page?: number
  per_page?: number
  search?: string
  status?: InwardStatus
  grn_status?: "completed" | "pending"
  from_date?: string
  to_date?: string
}

// GET /inward/{company}/{txn} — Detail
export interface BoxEditLog {
  box_id: string
  field_name: string
  old_value: string
  new_value: string
  email_id: string
  edited_at: string
}

export interface InwardDetailResponse {
  company: string
  transaction: TransactionV2
  articles: ArticleV2[]
  boxes: BoxV2[]
  edit_logs?: BoxEditLog[]
}

// ─── API Service ───────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ""

function getAuthHeaders(): HeadersInit {
  const { accessToken } = useAuthStore.getState()
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`
    try {
      const errorData = await response.json()
      if (errorData?.detail) {
        errorMessage =
          typeof errorData.detail === "string"
            ? errorData.detail
            : JSON.stringify(errorData.detail)
      }
    } catch {
      errorMessage = response.statusText || errorMessage
    }
    throw new Error(errorMessage)
  }
  return response.json()
}

class InwardApiService {
  // ── 1. POST /inward/extract-po ──────────────────────────
  async extractPO(file: File): Promise<POExtractResponse> {
    const formData = new FormData()
    formData.append("file", file)

    const { accessToken } = useAuthStore.getState()
    const response = await fetch(`${API_BASE}/inward/extract-po`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: formData,
    })
    return handleResponse<POExtractResponse>(response)
  }

  // ── 2. POST /inward/sku-lookup/{company} ────────────────
  async skuLookup(
    company: Company,
    itemDescription: string
  ): Promise<SKULookupResponse> {
    const response = await fetch(
      `${API_BASE}/inward/sku-lookup/${company}`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ item_description: itemDescription }),
      }
    )
    return handleResponse<SKULookupResponse>(response)
  }

  // ── 3. GET /inward?company=&status= ─────────────────────
  async getInwardList(
    company: Company,
    params?: InwardListParams
  ): Promise<InwardListResponse> {
    const sp = new URLSearchParams()
    sp.append("company", company)
    if (params?.page) sp.append("page", params.page.toString())
    if (params?.per_page) sp.append("per_page", params.per_page.toString())
    if (params?.search) sp.append("search", params.search)
    if (params?.status) sp.append("status", params.status)
    if (params?.grn_status) sp.append("grn_status", params.grn_status)
    if (params?.from_date) sp.append("from_date", params.from_date)
    if (params?.to_date) sp.append("to_date", params.to_date)

    const response = await fetch(`${API_BASE}/inward?${sp.toString()}`, {
      method: "GET",
      headers: getAuthHeaders(),
    })
    return handleResponse<InwardListResponse>(response)
  }

  // ── 4. GET /inward/{company} ────────────────────────────
  async getInwardListByCompany(
    company: Company,
    params?: InwardListParams
  ): Promise<InwardListResponse> {
    const sp = new URLSearchParams()
    if (params?.page) sp.append("page", params.page.toString())
    if (params?.per_page) sp.append("per_page", params.per_page.toString())
    if (params?.search) sp.append("search", params.search)
    if (params?.status) sp.append("status", params.status)
    if (params?.grn_status) sp.append("grn_status", params.grn_status)
    if (params?.from_date) sp.append("from_date", params.from_date)
    if (params?.to_date) sp.append("to_date", params.to_date)

    const qs = sp.toString()
    const response = await fetch(
      `${API_BASE}/inward/${company}${qs ? `?${qs}` : ""}`,
      { method: "GET", headers: getAuthHeaders() }
    )
    return handleResponse<InwardListResponse>(response)
  }

  // ── 5. POST /inward ─────────────────────────────────────
  async createInward(payload: CreateInwardPayload): Promise<{ transaction_no: string }> {
    const response = await fetch(`${API_BASE}/inward`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    return handleResponse<{ transaction_no: string }>(response)
  }

  // ── 6. PUT /inward/{company}/{txn}/approve ──────────────
  async approveOrReject(
    company: Company,
    transactionNo: string,
    payload: ApprovePayload
  ): Promise<{ message: string }> {
    const response = await fetch(
      `${API_BASE}/inward/${company}/${encodeURIComponent(transactionNo)}/approve`,
      {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      }
    )
    return handleResponse<{ message: string }>(response)
  }

  // ── 7. GET /inward/{company}/{txn} ──────────────────────
  async getInwardDetail(
    company: Company,
    transactionNo: string
  ): Promise<InwardDetailResponse> {
    const response = await fetch(
      `${API_BASE}/inward/${company}/${encodeURIComponent(transactionNo)}`,
      { method: "GET", headers: getAuthHeaders() }
    )
    return handleResponse<InwardDetailResponse>(response)
  }

  // ── 8. PUT /inward/{company}/{txn} ──────────────────────
  async updateInward(
    company: Company,
    transactionNo: string,
    payload: UpdateInwardPayload
  ): Promise<{ message: string }> {
    const response = await fetch(
      `${API_BASE}/inward/${company}/${encodeURIComponent(transactionNo)}`,
      {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      }
    )
    return handleResponse<{ message: string }>(response)
  }

  // ── 9. PUT /inward/{company}/{txn}/box ──────────────────
  async upsertBox(
    company: Company,
    transactionNo: string,
    payload: BoxUpsertPayload
  ): Promise<BoxUpsertResponse> {
    const response = await fetch(
      `${API_BASE}/inward/${company}/${encodeURIComponent(transactionNo)}/box`,
      {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      }
    )
    return handleResponse<BoxUpsertResponse>(response)
  }

  // ── 10. POST /inward/box-edit-log ─────────────────────
  async logBoxEdit(payload: BoxEditLogPayload): Promise<{ status: string }> {
    const response = await fetch(`${API_BASE}/inward/box-edit-log`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    return handleResponse<{ status: string }>(response)
  }

  // ── 11. DELETE /inward/{company}/{txn} ────────────────
  async deleteInward(
    company: Company,
    transactionNo: string
  ): Promise<{ message: string }> {
    const response = await fetch(
      `${API_BASE}/inward/${company}/${encodeURIComponent(transactionNo)}`,
      { method: "DELETE", headers: getAuthHeaders() }
    )
    return handleResponse<{ message: string }>(response)
  }

  // ── Helpers ─────────────────────────────────────────────
  async getAllInwardRecords(
    company: Company,
    params?: Omit<InwardListParams, "page" | "per_page">
  ): Promise<InwardListResponse> {
    const allRecords: InwardListItem[] = []
    let currentPage = 1
    let hasMore = true

    while (hasMore) {
      const data = await this.getInwardList(company, {
        ...params,
        page: currentPage,
        per_page: 100,
      })
      allRecords.push(...data.records)
      hasMore = data.records.length === 100
      currentPage++
      if (currentPage > 100) break
    }

    return {
      records: allRecords,
      total: allRecords.length,
      page: 1,
      per_page: allRecords.length,
    }
  }
}

export const inwardApiService = new InwardApiService()

// Named exports for convenience
export const extractPO = inwardApiService.extractPO.bind(inwardApiService)
export const skuLookup = inwardApiService.skuLookup.bind(inwardApiService)
export const getInwardList = inwardApiService.getInwardList.bind(inwardApiService)
export const createInward = inwardApiService.createInward.bind(inwardApiService)
export const approveOrReject = inwardApiService.approveOrReject.bind(inwardApiService)
export const getInwardDetail = inwardApiService.getInwardDetail.bind(inwardApiService)
export const updateInward = inwardApiService.updateInward.bind(inwardApiService)
export const deleteInward = inwardApiService.deleteInward.bind(inwardApiService)

// ─── Legacy Type Aliases (backward compatibility) ──────────

/** @deprecated Use CreateInwardPayload instead */
export type InwardPayload = CreateInwardPayload

/** @deprecated Use InwardListItem or InwardDetailResponse instead */
export interface InwardRecord {
  company?: string
  transaction_id?: string
  entry_date?: string
  status?: InwardStatus
  vendor_supplier_name?: string
  customer_party_name?: string
  source_location?: string
  destination_location?: string
  po_number?: string
  purchased_by?: string
  vehicle_number?: string
  transporter_name?: string
  lr_number?: string
  challan_number?: string
  invoice_number?: string
  grn_number?: string
  grn_quantity?: number
  system_grn_date?: string
  service_invoice_number?: string
  dn_number?: string
  approval_authority?: string
  total_amount?: number
  tax_amount?: number
  discount_amount?: number
  currency?: string
  remark?: string
  sku_id?: number
  item_description?: string
  item_category?: string
  sub_category?: string
  quality_grade?: string
  uom?: string
  quantity_units?: number
  net_weight?: number
  total_weight?: number
  lot_number?: string
  manufacturing_date?: string
  expiry_date?: string
  unit_rate?: number
  created_at?: string
  boxes?: Array<{
    id?: string
    box_number: number
    article: string
    net_weight?: number
    gross_weight?: number
    lot_number?: string
  }>
  [key: string]: any
}
