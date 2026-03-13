// lib/api/bulkEntryApiService.ts — Bulk Entry API service
// All endpoints follow: /bulk-entry/...

import { useAuthStore } from "@/lib/stores/auth"
import type {
  BulkEntryCreatePayload,
  BulkEntryCreateResponse,
  BulkEntryListParams,
  BulkEntryListResponse,
  BulkEntryDetailResponse,
  BulkEntryTransaction,
  BulkEntryBox,
  BulkEntryBoxUpsertPayload,
  BulkEntryBoxUpsertResponse,
  BulkEntryDeleteResponse,
  BulkEntryBoxListResponse,
} from "@/types/cold-storage"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

function getAuthHeaders(): Record<string, string> {
  const { accessToken } = useAuthStore.getState()
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  }
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`
  }
  return headers
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = `HTTP ${response.status}`
    try {
      const body = await response.json()
      const raw = body.detail || body.message || body
      detail = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2)
    } catch {
      try {
        detail = await response.text()
      } catch {
        // use status
      }
    }
    throw new Error(detail)
  }
  return response.json()
}

export const bulkEntryApi = {
  // ─── POST /bulk-entry — Create Bulk Entry ───────────────────
  async create(payload: BulkEntryCreatePayload): Promise<BulkEntryCreateResponse> {
    const response = await fetch(`${API_URL}/bulk-entry`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    return handleResponse<BulkEntryCreateResponse>(response)
  },

  // ─── GET /bulk-entry/{company} — List Entries ───────────────
  async list(company: string, params?: BulkEntryListParams): Promise<BulkEntryListResponse> {
    const sp = new URLSearchParams()
    if (params?.page) sp.set("page", String(params.page))
    if (params?.per_page) sp.set("per_page", String(params.per_page))
    if (params?.status) sp.set("status", params.status)
    if (params?.vendor) sp.set("vendor", params.vendor)
    if (params?.source_location) sp.set("source_location", params.source_location)
    if (params?.search) sp.set("search", params.search)
    if (params?.from_date) sp.set("from_date", params.from_date)
    if (params?.to_date) sp.set("to_date", params.to_date)
    if (params?.sort_by) sp.set("sort_by", params.sort_by)
    if (params?.sort_order) sp.set("sort_order", params.sort_order)

    const qs = sp.toString() ? `?${sp.toString()}` : ""
    const response = await fetch(`${API_URL}/bulk-entry/${company}${qs}`, {
      method: "GET",
      headers: getAuthHeaders(),
    })
    return handleResponse<BulkEntryListResponse>(response)
  },

  // ─── GET /bulk-entry/{company}/{txn} — Get Entry Detail ─────
  async getDetail(company: string, transactionNo: string): Promise<BulkEntryDetailResponse> {
    const response = await fetch(
      `${API_URL}/bulk-entry/${company}/${encodeURIComponent(transactionNo)}`,
      { method: "GET", headers: getAuthHeaders() }
    )
    return handleResponse<BulkEntryDetailResponse>(response)
  },

  // ─── PUT /bulk-entry/{company}/{txn} — Update Transaction ───
  async update(
    company: string,
    transactionNo: string,
    data: Partial<BulkEntryTransaction>
  ): Promise<BulkEntryTransaction> {
    const response = await fetch(
      `${API_URL}/bulk-entry/${company}/${encodeURIComponent(transactionNo)}`,
      {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    )
    return handleResponse<BulkEntryTransaction>(response)
  },

  // ─── DELETE /bulk-entry/{company}/{txn} — Delete Entry ──────
  async remove(company: string, transactionNo: string): Promise<BulkEntryDeleteResponse> {
    const response = await fetch(
      `${API_URL}/bulk-entry/${company}/${encodeURIComponent(transactionNo)}`,
      { method: "DELETE", headers: getAuthHeaders() }
    )
    return handleResponse<BulkEntryDeleteResponse>(response)
  },

  // ─── GET /bulk-entry/{company}/box/{boxId} — Lookup Box ─────
  async getBox(company: string, boxId: string): Promise<BulkEntryBox> {
    const response = await fetch(
      `${API_URL}/bulk-entry/${company}/box/${encodeURIComponent(boxId)}`,
      { method: "GET", headers: getAuthHeaders() }
    )
    return handleResponse<BulkEntryBox>(response)
  },

  // ─── GET /bulk-entry/{company}/{txn}/boxes — List Boxes ─────
  async listBoxes(company: string, transactionNo: string): Promise<BulkEntryBoxListResponse> {
    const response = await fetch(
      `${API_URL}/bulk-entry/${company}/${encodeURIComponent(transactionNo)}/boxes`,
      { method: "GET", headers: getAuthHeaders() }
    )
    return handleResponse<BulkEntryBoxListResponse>(response)
  },

  // ─── PUT /bulk-entry/{company}/{txn}/box — Upsert Box ───────
  async upsertBox(
    company: string,
    transactionNo: string,
    payload: BulkEntryBoxUpsertPayload
  ): Promise<BulkEntryBoxUpsertResponse> {
    const response = await fetch(
      `${API_URL}/bulk-entry/${company}/${encodeURIComponent(transactionNo)}/box`,
      {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      }
    )
    return handleResponse<BulkEntryBoxUpsertResponse>(response)
  },
}
