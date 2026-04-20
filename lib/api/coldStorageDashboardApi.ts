// lib/api/coldStorageDashboardApi.ts — Cold Storage Dashboard API v3

import { useAuthStore } from "@/lib/stores/auth"

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
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail || body)
    } catch { /* use status */ }
    throw new Error(detail)
  }
  return response.json()
}

// ═══════════════════════════════════════════════════════════════════
// Types — Stock Summary
// ═══════════════════════════════════════════════════════════════════

export interface AgeProfile {
  age_0_6: number
  age_6_12: number
  age_12_18: number
  age_18_24: number
  age_24_plus: number
}

export interface StockLayer3 {
  item_mark: string
  total_kgs: number
  total_value: number
  avg_rate: number
  lot_count: number
  age_profile: AgeProfile
}

export interface StockLayer2 {
  item_subgroup: string
  total_kgs: number
  total_value: number
  avg_rate: number
  lot_count: number
  children: StockLayer3[]
}

export interface StockLayer1 {
  storage_location: string
  group_name: string
  total_kgs: number
  total_value: number
  avg_rate: number
  lot_count: number
  children: StockLayer2[]
}

export interface StockSummaryResponse {
  as_of_date: string
  company: string
  data: StockLayer1[]
  grand_total: {
    total_kgs: number
    total_value: number
    avg_rate: number
    lot_count: number
  }
}

// ═══════════════════════════════════════════════════════════════════
// Types — Ageing Summary (Kgs + Value per bracket)
// ═══════════════════════════════════════════════════════════════════

export interface AgeingBrackets {
  kgs_0_6: number; kgs_6_12: number; kgs_12_18: number; kgs_18_24: number; kgs_24_plus: number
  val_0_6: number; val_6_12: number; val_12_18: number; val_18_24: number; val_24_plus: number
  grand_total_kgs: number; grand_total_value: number
}

export interface AgeingLayer3 extends AgeingBrackets {
  item_mark: string
}

export interface AgeingLayer2 extends AgeingBrackets {
  item_subgroup: string
  children: AgeingLayer3[]
}

export interface AgeingLayer1 extends AgeingBrackets {
  storage_location: string
  group_name: string
  children: AgeingLayer2[]
}

export interface AgeingSummaryResponse {
  as_of_date: string
  company: string
  data: AgeingLayer1[]
  grand_total: AgeingBrackets
}

// ═══════════════════════════════════════════════════════════════════
// Types — Lot Details
// ═══════════════════════════════════════════════════════════════════

export interface LotDetail {
  lot_no: string
  inward_dt: string | null
  inward_no: string
  unit: string
  item_description: string
  no_of_cartons: number
  weight_kg: number
  total_kgs: number
  last_purchase_rate: number
  value: number
  avg_rate: number
  vakkal: string
  exporter: string
  spl_remarks: string
  box_count: number
  ageing_days: number | null
  ageing_bracket: string
  deviation_pct: number
  deviation_level: "normal" | "review" | "anomaly"
}

export interface LotDetailsResponse {
  lots: LotDetail[]
  total: number
  subgroup_avg_rate: number
}

// ═══════════════════════════════════════════════════════════════════
// Types — Concentration & Risk
// ═══════════════════════════════════════════════════════════════════

export interface ConcentrationItem {
  rank: number
  group_name: string
  item_subgroup: string
  total_kgs: number
  total_value: number
  portfolio_pct: number
  avg_rate: number
  lot_count: number
  fragmentation: "normal" | "medium" | "high"
}

export interface ConcentrationResponse {
  as_of_date: string
  company: string
  items: ConcentrationItem[]
  portfolio: {
    total_kgs: number
    total_value: number
    avg_rate: number
    total_lots: number
    top3_pct: number
    aged_18plus_kgs: number
    aged_18plus_value: number
    aged_18plus_pct: number
  }
  alerts: ConcentrationItem[]
}

// ═══════════════════════════════════════════════════════════════════
// Types — Inward Trend
// ═══════════════════════════════════════════════════════════════════

export interface TrendMonth {
  month: string
  month_label: string
  total_kgs: number
  total_value: number
  lot_count: number
}

export interface TopGroup {
  group_name: string; total_kgs: number; total_value: number; lot_count: number
}

export interface TopInwardDate {
  date: string; total_kgs: number; total_value: number; lot_count: number
}

export interface InwardTrendResponse {
  months: TrendMonth[]
  current_month_kgs: number
  current_month_value: number
  current_month_lots: number
  mom_change_pct: number
  total_open_lots: number
  total_stock_kgs: number
  total_stock_value: number
  group_count: number
  location_count: number
  earliest_inward: string | null
  latest_inward: string | null
  avg_monthly_kgs: number
  peak_month: TrendMonth | null
  last3_months_pct: number
  top_groups: TopGroup[]
  top_inward_dates: TopInwardDate[]
}

// ═══════════════════════════════════════════════════════════════════
// Types — Attention Flags (§2)
// ═══════════════════════════════════════════════════════════════════

export interface AttentionFlag {
  lot_no: string; inward_dt: string | null; inward_no: string
  storage_location: string; group_name: string; item_subgroup: string; item_mark: string
  total_kgs: number; total_value: number; rate: number; ageing_days: number | null
  flag_type: "bracket_crossing" | "rate_anomaly" | "stale_lot"
  severity: "critical" | "warning" | "info"
  message: string
  // bracket_crossing fields
  current_bracket?: string; next_bracket?: string; days_to_cross?: number
  // rate_anomaly fields
  subgroup_avg_rate?: number; deviation_pct?: number
  // stale_lot fields
  days_stale?: number
}

export interface AttentionFlagsResponse {
  flags: AttentionFlag[]
  summary: Record<string, number>
  total: number
}

// ═══════════════════════════════════════════════════════════════════
// Types — Slow Moving (§3)
// ═══════════════════════════════════════════════════════════════════

export interface SlowMovingItem {
  lot_no: string; inward_dt: string | null; storage_location: string
  group_name: string; item_subgroup: string; item_mark: string
  total_kgs: number; total_value: number; ageing_bracket: string
  ageing_days: number; movement_status: "active" | "slow_moving" | "non_moving" | "dead_stock"
}

export interface SlowMovingResponse {
  items: SlowMovingItem[]
  counts: Record<string, number>
  kgs_totals: Record<string, number>
  pct_totals: Record<string, number>
  total: number
}

// ═══════════════════════════════════════════════════════════════════
// Types — Activity Rundown (§4)
// ═══════════════════════════════════════════════════════════════════

export interface LocationRundown {
  location: string; total_kgs: number; total_value: number; lot_count: number; group_count: number
}

export interface CompanyRundown {
  company: string; total_kgs: number; total_value: number; avg_rate: number; lot_count: number; location_count: number
}

export interface GroupRundown {
  group_name: string; item_subgroup: string; total_kgs: number; total_value: number; lot_count: number
}

export interface ExporterRundown {
  exporter: string; lot_count: number; total_kgs: number; total_value: number; avg_rate: number; last_inward: string | null
}

export interface ActivityRundownResponse {
  locations: LocationRundown[]
  company_breakdown: CompanyRundown[]
  groups: GroupRundown[]
  exporters: ExporterRundown[]
}

// ═══════════════════════════════════════════════════════════════════
// API Functions
// ═══════════════════════════════════════════════════════════════════

export const coldStorageDashboardApi = {
  async getStockSummary(company: string, storageLocation?: string): Promise<StockSummaryResponse> {
    const sp = new URLSearchParams({ company: company.toLowerCase() })
    if (storageLocation) sp.set("storage_location", storageLocation)
    const r = await fetch(`${API_URL}/cold-storage/dashboard/stock-summary?${sp}`, { headers: getAuthHeaders() })
    return handleResponse<StockSummaryResponse>(r)
  },

  async getAgeingSummary(company: string, storageLocation?: string): Promise<AgeingSummaryResponse> {
    const sp = new URLSearchParams({ company: company.toLowerCase() })
    if (storageLocation) sp.set("storage_location", storageLocation)
    const r = await fetch(`${API_URL}/cold-storage/dashboard/ageing-summary?${sp}`, { headers: getAuthHeaders() })
    return handleResponse<AgeingSummaryResponse>(r)
  },

  async getLotDetails(
    company: string, storageLocation: string, groupName: string,
    itemSubgroup: string, itemMark: string
  ): Promise<LotDetailsResponse> {
    const sp = new URLSearchParams({
      company: company.toLowerCase(),
      storage_location: storageLocation,
      group_name: groupName,
      item_subgroup: itemSubgroup,
      item_mark: itemMark,
    })
    const r = await fetch(`${API_URL}/cold-storage/dashboard/lot-details?${sp}`, { headers: getAuthHeaders() })
    return handleResponse<LotDetailsResponse>(r)
  },

  async getConcentration(company: string, storageLocation?: string): Promise<ConcentrationResponse> {
    const sp = new URLSearchParams({ company: company.toLowerCase() })
    if (storageLocation) sp.set("storage_location", storageLocation)
    const r = await fetch(`${API_URL}/cold-storage/dashboard/concentration?${sp}`, { headers: getAuthHeaders() })
    return handleResponse<ConcentrationResponse>(r)
  },

  async getInwardTrend(company: string, storageLocation?: string): Promise<InwardTrendResponse> {
    const sp = new URLSearchParams({ company: company.toLowerCase() })
    if (storageLocation) sp.set("storage_location", storageLocation)
    const r = await fetch(`${API_URL}/cold-storage/dashboard/inward-trend?${sp}`, { headers: getAuthHeaders() })
    return handleResponse<InwardTrendResponse>(r)
  },

  async getStorageLocations(company: string): Promise<string[]> {
    const sp = new URLSearchParams({ company: company.toLowerCase() })
    const r = await fetch(`${API_URL}/cold-storage/dashboard/storage-locations?${sp}`, { headers: getAuthHeaders() })
    const data = await handleResponse<{ locations: string[] }>(r)
    return data.locations
  },

  async getAttentionFlags(company: string, storageLocation?: string): Promise<AttentionFlagsResponse> {
    const sp = new URLSearchParams({ company: company.toLowerCase() })
    if (storageLocation) sp.set("storage_location", storageLocation)
    const r = await fetch(`${API_URL}/cold-storage/dashboard/attention-flags?${sp}`, { headers: getAuthHeaders() })
    return handleResponse<AttentionFlagsResponse>(r)
  },

  async getSlowMoving(company: string, storageLocation?: string): Promise<SlowMovingResponse> {
    const sp = new URLSearchParams({ company: company.toLowerCase() })
    if (storageLocation) sp.set("storage_location", storageLocation)
    const r = await fetch(`${API_URL}/cold-storage/dashboard/slow-moving?${sp}`, { headers: getAuthHeaders() })
    return handleResponse<SlowMovingResponse>(r)
  },

  async getActivityRundown(company: string, storageLocation?: string): Promise<ActivityRundownResponse> {
    const sp = new URLSearchParams({ company: company.toLowerCase() })
    if (storageLocation) sp.set("storage_location", storageLocation)
    const r = await fetch(`${API_URL}/cold-storage/dashboard/activity-rundown?${sp}`, { headers: getAuthHeaders() })
    return handleResponse<ActivityRundownResponse>(r)
  },
}
