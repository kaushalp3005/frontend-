// Transfer module types ho gaya 
export interface TransferRequest {
  id: string
  request_no: string
  from_site: string
  to_site: string
  reason_code: string
  status: TransferStatus
  created_ts: string
  created_by: string
  lines: TransferRequestLine[]
  boxes?: TransferBox[]
}

export interface TransferRequestLine {
  id: string
  rm_pm_fg_type: string
  item_category: string
  sub_category: string
  item_desc_raw: string
  item_id: number
  qty: number
  uom: string
  net_weight: number
  batch_number: string
  lot_number: string
}

export interface TransferBox {
  id: number
  box_number: number
  article: string
  lot_number: string
  batch_number: string
  transaction_no: string
  net_weight: number
  gross_weight: number
  created_at?: string
  updated_at?: string
}

export interface Transfer {
  id: string
  challan_no: string
  stock_trf_date: string
  from_site: string
  to_site: string
  vehicle_no: string
  remark: string
  reason_code: string
  status: TransferStatus
  created_by: string
  request_id?: number
  lines: TransferLine[]
  boxes?: TransferBox[]
}

export interface TransferLine {
  id: string
  rm_pm_fg_type: string
  item_category: string
  sub_category: string
  item_desc_raw: string
  item_id: number
  hsn_code: string
  pack_size: number
  packaging_type: number
  qty: number
  uom: string
  net_weight: number
  total_weight: number
  batch_number: string
  lot_number: string
}

export type TransferStatus = "Pending" | "Approved" | "Cancelled" | "Accept"

export interface TransferFilters {
  from_site?: string
  to_site?: string
  status?: string
  date_from?: string
  date_to?: string
  challan_no?: string
  vehicle_no?: string
  created_by?: string
}








