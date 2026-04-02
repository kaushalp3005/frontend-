import { useAuthStore } from "@/lib/stores/auth"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

function headers(): Record<string, string> {
  const { accessToken } = useAuthStore.getState()
  const h: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" }
  if (accessToken) h["Authorization"] = `Bearer ${accessToken}`
  return h
}

async function handle<T>(r: Response): Promise<T> {
  if (!r.ok) { let d = `HTTP ${r.status}`; try { const b = await r.json(); d = typeof b.detail === "string" ? b.detail : JSON.stringify(b.detail || b) } catch {}; throw new Error(d) }
  return r.json()
}

export interface TransferRecord {
  transfer_id: number; challan_no: string; transfer_date: string; transfer_month: string
  from_warehouse: string; to_warehouse: string; vehicle_no: string; driver_name: string
  status: string; created_by: string; remark: string
  item_description: string; item_category: string; sub_category: string; material_type: string
  lot_number: string; qty: number; uom: string; pack_size: number
  net_weight: number; total_weight: number; box_count: number; received_status: string
  issue_count: number; issue_items: string; issue_weight: number; has_issue: boolean
  issue_details: { article: string; remarks: string; actual_qty: string; actual_total_weight: string }[]
}

export interface TransferFilterOptions {
  from_warehouses: string[]; to_warehouses: string[]; statuses: string[]
  item_categories: string[]; material_types: string[]; created_by: string[]
}

export const transferDashboardApi = {
  async getAllData(): Promise<{ records: TransferRecord[]; total: number; as_of_date: string }> {
    return handle(await fetch(`${API_URL}/transfer-dashboard/all-data`, { headers: headers() }))
  },
  async getFilterOptions(): Promise<TransferFilterOptions> {
    return handle(await fetch(`${API_URL}/transfer-dashboard/filter-options`, { headers: headers() }))
  },
}
