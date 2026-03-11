// lib/api/coldStorageApiService.ts — Cold Storage API service
// All endpoints follow: /cold-storage/...

import { useAuthStore } from "@/lib/stores/auth"
import type {
  ColdStorageRecord,
  ColdStorageCreatePayload,
  ColdStorageUpdatePayload,
  ColdStorageBulkPayload,
  ColdStorageBulkResponse,
  ColdStorageListParams,
  ColdStorageListResponse,
  ColdStorageSummaryResponse,
  ColdStorageDeleteResponse,
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

export const coldStorageApi = {
  // ─── List Records ─────────────────────────────────────────────

  async list(params?: ColdStorageListParams): Promise<ColdStorageListResponse> {
    const sp = new URLSearchParams()
    if (params?.page) sp.set("page", String(params.page))
    if (params?.per_page) sp.set("per_page", String(params.per_page))
    if (params?.group_name) sp.set("group_name", params.group_name)
    if (params?.storage_location) sp.set("storage_location", params.storage_location)
    if (params?.exporter) sp.set("exporter", params.exporter)
    if (params?.item_mark) sp.set("item_mark", params.item_mark)
    if (params?.search) sp.set("search", params.search)
    if (params?.from_date) sp.set("from_date", params.from_date)
    if (params?.to_date) sp.set("to_date", params.to_date)
    if (params?.sort_by) sp.set("sort_by", params.sort_by)
    if (params?.sort_order) sp.set("sort_order", params.sort_order)

    const qs = sp.toString() ? `?${sp.toString()}` : ""
    const response = await fetch(`${API_URL}/cold-storage${qs}`, {
      method: "GET",
      headers: getAuthHeaders(),
    })
    return handleResponse<ColdStorageListResponse>(response)
  },

  // ─── Get Single Record ────────────────────────────────────────

  async getById(id: number): Promise<ColdStorageRecord> {
    const response = await fetch(`${API_URL}/cold-storage/${id}`, {
      method: "GET",
      headers: getAuthHeaders(),
    })
    return handleResponse<ColdStorageRecord>(response)
  },

  // ─── Create Record ────────────────────────────────────────────

  async create(data: ColdStorageCreatePayload): Promise<ColdStorageRecord> {
    const response = await fetch(`${API_URL}/cold-storage`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return handleResponse<ColdStorageRecord>(response)
  },

  // ─── Update Record ────────────────────────────────────────────

  async update(
    id: number,
    data: ColdStorageUpdatePayload
  ): Promise<ColdStorageRecord> {
    const response = await fetch(`${API_URL}/cold-storage/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return handleResponse<ColdStorageRecord>(response)
  },

  // ─── Delete Record ────────────────────────────────────────────

  async remove(id: number): Promise<ColdStorageDeleteResponse> {
    const response = await fetch(`${API_URL}/cold-storage/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    })
    return handleResponse<ColdStorageDeleteResponse>(response)
  },

  // ─── Bulk Create ──────────────────────────────────────────────

  async bulkCreate(data: ColdStorageBulkPayload): Promise<ColdStorageBulkResponse> {
    const response = await fetch(`${API_URL}/cold-storage/bulk`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return handleResponse<ColdStorageBulkResponse>(response)
  },

  // ─── Summary (Aggregated by Group) ────────────────────────────

  async getSummary(params?: {
    group_name?: string
    storage_location?: string
    exporter?: string
  }): Promise<ColdStorageSummaryResponse> {
    const sp = new URLSearchParams()
    if (params?.group_name) sp.set("group_name", params.group_name)
    if (params?.storage_location) sp.set("storage_location", params.storage_location)
    if (params?.exporter) sp.set("exporter", params.exporter)

    const qs = sp.toString() ? `?${sp.toString()}` : ""
    const response = await fetch(`${API_URL}/cold-storage/summary${qs}`, {
      method: "GET",
      headers: getAuthHeaders(),
    })
    return handleResponse<ColdStorageSummaryResponse>(response)
  },
}
