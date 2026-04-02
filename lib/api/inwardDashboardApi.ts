// lib/api/inwardDashboardApi.ts — Inward Dashboard API v2 (client-side filtering)

import { useAuthStore } from "@/lib/stores/auth"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

function headers(): Record<string, string> {
  const { accessToken } = useAuthStore.getState()
  const h: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" }
  if (accessToken) h["Authorization"] = `Bearer ${accessToken}`
  return h
}

async function handle<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let d = `HTTP ${r.status}`
    try { const b = await r.json(); d = typeof b.detail === "string" ? b.detail : JSON.stringify(b.detail || b) } catch {}
    throw new Error(d)
  }
  return r.json()
}

// ── Types ──

export interface InwardRecord {
  transaction_no: string
  entry_date: string
  entry_month: string
  warehouse: string
  vendor: string
  customer: string
  status: string
  invoice_number: string
  po_number: string
  purchased_by: string
  grn_number: string
  item_description: string
  sku_id: number | null
  item_category: string
  sub_category: string
  material_type: string
  quality_grade: string
  uom: string
  lot_number: string
  qty: number
  net_weight: number
  total_weight: number
  unit_rate: number
  total_amount: number
}

export interface AllDataResponse {
  records: InwardRecord[]
  total: number
  as_of_date: string
}

export interface FilterOptions {
  warehouses: { name: string; count: number }[]
  vendors: { name: string; count: number }[]
  customers: { name: string; count: number }[]
  item_categories: string[]
  sub_categories: string[]
  material_types: string[]
  statuses: string[]
  purchased_by: string[]
}

export interface ItemHistory {
  item_description: string; total_inwards: number
  total_qty: number; total_weight: number
  first_date: string | null; last_date: string | null
  inward_timeline: { transaction_no: string; entry_date: string | null; vendor: string; lot_number: string; qty: number; weight: number; rate: number; warehouse: string; status: string }[]
  vendor_history: { vendor: string; inward_count: number; total_qty: number; total_weight: number; total_value: number; avg_rate: number; last_supply: string | null }[]
}

export interface VendorHistory {
  vendor_name: string; total_transactions: number; total_value: number
  item_summary: { item_description: string; inward_count: number; total_qty: number; total_weight: number; total_value: number; avg_rate: number; last_inward: string | null }[]
  monthly_pattern: { month: string; month_label: string; inward_count: number; total_weight: number; total_value: number }[]
}

// ── API ──

export const inwardDashboardApi = {
  async getAllData(company: string): Promise<AllDataResponse> {
    return handle<AllDataResponse>(await fetch(`${API_URL}/inward-dashboard/all-data?company=${company}`, { headers: headers() }))
  },

  async getFilterOptions(company: string): Promise<FilterOptions> {
    return handle<FilterOptions>(await fetch(`${API_URL}/inward-dashboard/filter-options?company=${company}`, { headers: headers() }))
  },

  async getItemHistory(company: string, itemDescription: string): Promise<ItemHistory> {
    const sp = new URLSearchParams({ company, item_description: itemDescription })
    return handle<ItemHistory>(await fetch(`${API_URL}/inward-dashboard/item-history?${sp}`, { headers: headers() }))
  },

  async getVendorHistory(company: string, vendorName: string): Promise<VendorHistory> {
    const sp = new URLSearchParams({ company, vendor_name: vendorName })
    return handle<VendorHistory>(await fetch(`${API_URL}/inward-dashboard/vendor-history?${sp}`, { headers: headers() }))
  },
}
