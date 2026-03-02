// Cold Storage Stock Search API Service
// Connects to the cold storage stocks backend (Transfer project)

const STOCK_API_URL = process.env.NEXT_PUBLIC_STOCK_API_URL ?? "http://localhost:8001"

async function fetchJSON(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  })

  if (!response.ok) {
    let errorMessage = `API call failed: ${response.status} ${response.statusText}`
    try {
      const errorData = await response.json()
      errorMessage += ` - ${JSON.stringify(errorData)}`
    } catch {
      // use status only
    }
    throw new Error(errorMessage)
  }

  return response.json()
}

export interface ColdStorageStockRecord {
  id: number
  inward_dt: string | null
  unit: string | null
  inward_no: string | null
  item_description: string | null
  item_mark: string | null
  vakkal: string | null
  lot_no: string | null
  net_qty_on_cartons: number | null
  weight_kg: number | null
  total_inventory_kgs: number | null
  group_name: string | null
  storage_location: string | null
  stock: string | null
  exporter: string | null
  last_purchase_rate: number | null
  value: number | null
}

export interface ColdStorageStockSearchResponse {
  results: ColdStorageStockRecord[]
  total: number
}

export class ColdStorageApiService {
  static async searchColdStorageStocks(params: {
    lot_no?: string
    item_description?: string
    group_name?: string
    inward_dt?: string
    unit?: string
    q?: string
    limit?: number
  }): Promise<ColdStorageStockSearchResponse> {
    const queryParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        queryParams.append(key, String(value))
      }
    })
    return await fetchJSON(`${STOCK_API_URL}/cold-storage/stocks/search?${queryParams.toString()}`)
  }
}
