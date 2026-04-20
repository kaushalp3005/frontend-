// lib/api/rtvApiService.ts — RTV API service
// All endpoints follow: /rtv/{company}/...

import { useAuthStore } from "@/lib/stores/auth"
import type {
  RTVWithDetails,
  RTVListResponse,
  RTVListParams,
  RTVCreateRequest,
  RTVHeaderUpdate,
  RTVLinesUpdateRequest,
  RTVLinesUpdateResponse,
  RTVBoxUpsertRequest,
  RTVBoxUpsertResponse,
  RTVApprovalRequest,
  RTVApprovalResponse,
  RTVDeleteResponse,
  RTVBoxEditLogRequest,
  RTVBoxEditLogResponse,
  RTVSummaryResponse,
  RTVSkuDropdownParams,
  RTVSkuDropdownResponse,
  RTVSkuSearchParams,
  RTVSkuSearchResponse,
  AllSkuItem,
} from "@/types/rtv"

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
      detail = body.detail || body.message || JSON.stringify(body)
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

export const rtvApi = {
  // ─── Create RTV ────────────────────────────────────────────────

  async createRTV(
    company: string,
    data: RTVCreateRequest,
    createdBy?: string
  ): Promise<RTVWithDetails> {
    const params = new URLSearchParams()
    if (createdBy) params.set("created_by", createdBy)
    const qs = params.toString() ? `?${params.toString()}` : ""

    const response = await fetch(`${API_URL}/rtv/${company}${qs}`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return handleResponse<RTVWithDetails>(response)
  },

  // ─── List RTVs ─────────────────────────────────────────────────

  async listRTVs(
    company: string,
    params?: RTVListParams
  ): Promise<RTVListResponse> {
    const sp = new URLSearchParams()
    if (params?.page) sp.set("page", String(params.page))
    if (params?.per_page) sp.set("per_page", String(params.per_page))
    if (params?.status) sp.set("status", params.status)
    if (params?.factory_unit) sp.set("factory_unit", params.factory_unit)
    if (params?.customer) sp.set("customer", params.customer)
    if (params?.from_date) sp.set("from_date", params.from_date)
    if (params?.to_date) sp.set("to_date", params.to_date)
    if (params?.sort_by) sp.set("sort_by", params.sort_by)
    if (params?.sort_order) sp.set("sort_order", params.sort_order)

    const qs = sp.toString() ? `?${sp.toString()}` : ""
    const response = await fetch(`${API_URL}/rtv/${company}${qs}`, {
      method: "GET",
      headers: getAuthHeaders(),
    })
    return handleResponse<RTVListResponse>(response)
  },

  // ─── Get RTV Detail ────────────────────────────────────────────

  async getRTVDetail(
    company: string,
    rtvId: number
  ): Promise<RTVWithDetails> {
    const response = await fetch(`${API_URL}/rtv/${company}/${rtvId}`, {
      method: "GET",
      headers: getAuthHeaders(),
    })
    return handleResponse<RTVWithDetails>(response)
  },

  // ─── Update RTV Header ─────────────────────────────────────────

  async updateRTVHeader(
    company: string,
    rtvId: number,
    data: RTVHeaderUpdate
  ): Promise<RTVWithDetails> {
    const response = await fetch(`${API_URL}/rtv/${company}/${rtvId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return handleResponse<RTVWithDetails>(response)
  },

  // ─── Delete RTV ────────────────────────────────────────────────

  async deleteRTV(
    company: string,
    rtvId: number
  ): Promise<RTVDeleteResponse> {
    const response = await fetch(`${API_URL}/rtv/${company}/${rtvId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    })
    return handleResponse<RTVDeleteResponse>(response)
  },

  // ─── Update RTV Lines ──────────────────────────────────────────

  async updateRTVLines(
    company: string,
    rtvId: number,
    data: RTVLinesUpdateRequest
  ): Promise<RTVLinesUpdateResponse> {
    const response = await fetch(
      `${API_URL}/rtv/${company}/${rtvId}/lines`,
      {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    )
    return handleResponse<RTVLinesUpdateResponse>(response)
  },

  // ─── Upsert Box (Print) ────────────────────────────────────────

  async upsertBox(
    company: string,
    rtvId: number,
    data: RTVBoxUpsertRequest
  ): Promise<RTVBoxUpsertResponse> {
    const response = await fetch(
      `${API_URL}/rtv/${company}/${rtvId}/box`,
      {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    )
    return handleResponse<RTVBoxUpsertResponse>(response)
  },

  // ─── Approve RTV ───────────────────────────────────────────────

  async approveRTV(
    company: string,
    rtvId: number,
    data: RTVApprovalRequest
  ): Promise<RTVApprovalResponse> {
    const response = await fetch(
      `${API_URL}/rtv/${company}/${rtvId}/approve`,
      {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    )
    return handleResponse<RTVApprovalResponse>(response)
  },

  // ─── Log Box Edits ─────────────────────────────────────────────

  async logBoxEdit(data: RTVBoxEditLogRequest): Promise<RTVBoxEditLogResponse> {
    const response = await fetch(`${API_URL}/rtv/box-edit-log`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return handleResponse<RTVBoxEditLogResponse>(response)
  },

  // ─── Export to Excel ───────────────────────────────────────────

  async exportToExcel(
    company: string,
    params?: {
      status?: string
      customer?: string
      factory_unit?: string
      from_date?: string
      to_date?: string
      sort_by?: string
      sort_order?: string
    }
  ): Promise<Blob> {
    const sp = new URLSearchParams()
    sp.set("company", company)
    if (params?.status) sp.set("status", params.status)
    if (params?.customer) sp.set("customer", params.customer)
    if (params?.factory_unit) sp.set("factory_unit", params.factory_unit)
    if (params?.from_date) sp.set("from_date", params.from_date)
    if (params?.to_date) sp.set("to_date", params.to_date)
    if (params?.sort_by) sp.set("sort_by", params.sort_by)
    if (params?.sort_order) sp.set("sort_order", params.sort_order)

    const response = await fetch(`${API_URL}/rtv/export?${sp.toString()}`, {
      method: "GET",
      headers: {
        ...getAuthHeaders(),
        Accept:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    })

    if (!response.ok) {
      throw new Error(`Export failed: ${response.status}`)
    }
    return response.blob()
  },

  // ─── Summary (dispatch checklist) ──────────────────────────────
  // GET /rtv/{company}/{rtv_id}/summary
  // Note: the rtv_id path segment is the RTV-YYYYMMDDHHmmSS string, not the
  // numeric primary key (matches the other /rtv/{company}/{rtv_id} routes).

  async getRTVSummary(
    company: string,
    rtvId: string,
  ): Promise<RTVSummaryResponse> {
    const response = await fetch(
      `${API_URL}/rtv/${company}/${encodeURIComponent(rtvId)}/summary`,
      { method: "GET", headers: getAuthHeaders() },
    )
    return handleResponse<RTVSummaryResponse>(response)
  },

  // ─── SKU endpoints (all_sku, company-agnostic) ─────────────────
  // GET /rtv/sku-dropdown — cascading type -> group -> sub_group -> item.

  async getSkuDropdown(
    params?: RTVSkuDropdownParams,
  ): Promise<RTVSkuDropdownResponse> {
    const sp = new URLSearchParams()
    if (params?.item_type) sp.set("item_type", params.item_type)
    if (params?.item_group) sp.set("item_group", params.item_group)
    if (params?.sub_group) sp.set("sub_group", params.sub_group)
    if (params?.search) sp.set("search", params.search)
    if (params?.limit != null) sp.set("limit", String(params.limit))
    if (params?.offset != null) sp.set("offset", String(params.offset))
    const qs = sp.toString() ? `?${sp.toString()}` : ""
    const response = await fetch(`${API_URL}/rtv/sku-dropdown${qs}`, {
      method: "GET",
      headers: getAuthHeaders(),
    })
    return handleResponse<RTVSkuDropdownResponse>(response)
  },

  // GET /rtv/sku-search — free-text search across all_sku.

  async searchSkus(
    params: RTVSkuSearchParams,
  ): Promise<RTVSkuSearchResponse> {
    const sp = new URLSearchParams()
    sp.set("search", params.search)
    if (params.limit != null) sp.set("limit", String(params.limit))
    if (params.offset != null) sp.set("offset", String(params.offset))
    const response = await fetch(`${API_URL}/rtv/sku-search?${sp.toString()}`, {
      method: "GET",
      headers: getAuthHeaders(),
    })
    return handleResponse<RTVSkuSearchResponse>(response)
  },

  // GET /rtv/sku/{sku_id}

  async getSkuById(skuId: number): Promise<AllSkuItem> {
    const response = await fetch(`${API_URL}/rtv/sku/${skuId}`, {
      method: "GET",
      headers: getAuthHeaders(),
    })
    return handleResponse<AllSkuItem>(response)
  },

  // ─── Get Customers (for dropdown) ──────────────────────────────

  // Customer dropdown source. The backend endpoint is optional — returns [] on
  // 404 so the form still renders without autocomplete instead of throwing and
  // spamming the console. If the endpoint lands later, autocomplete lights up
  // automatically.
  async getCustomers(
    company: string
  ): Promise<Array<{ value: string; label: string }>> {
    try {
      const response = await fetch(
        `${API_URL}/api/dropdown/customers?company=${company}`,
        { method: "GET", headers: getAuthHeaders() },
      )
      if (response.status === 404) return []
      if (!response.ok) return []
      const data = await response.json()
      return (data.customers || []).map((c: any) => ({
        value: c.customer_name || c.name || "",
        label: c.customer_name || c.name || "",
      }))
    } catch {
      return []
    }
  },
}
