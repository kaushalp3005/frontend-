export type RTVStatus = "pending" | "approved" | "rejected" | "completed" | "cancelled"
export type RTVType = "quality_issue" | "damaged" | "expired" | "excess_quantity" | "wrong_item" | "other"
export type MaterialType = "RM" | "PM" | "FG"

export interface RTVItem {
  item_id?: number // Backend DB ID
  rtv_number?: string
  transaction_no: string
  box_number: number
  sub_category: string
  item_description: string
  net_weight: number
  gross_weight: number
  price: number
  reason: string
  qr_data?: any
  created_at?: string
  updated_at?: string
  // Legacy fields (optional for backward compatibility)
  id?: string
  material_code?: string
  material_name?: string
  quantity?: number
  unit?: string
  batch_number?: string
  estimated_value?: number
}

export interface RTVRecord {
  id?: string // Optional for backward compatibility
  rtv_number: string
  customer_name: string
  customer_code: string
  rtv_type: RTVType
  other_reason?: string | null
  rtv_date: string
  invoice_number: string
  dc_number: string
  notes: string
  created_by: string
  total_value: number
  total_boxes: number
  status: RTVStatus
  company_code?: string
  created_at: string
  updated_at: string
  items: RTVItem[]
  // Legacy fields (optional for backward compatibility)
  vendor_name?: string
  vendor_code?: string
  material_type?: MaterialType
  created_date?: string
  approved_by?: string
  approved_date?: string
  rejection_reason?: string
  grn_reference?: string
}

export interface RTVFormData {
  vendor_name: string
  vendor_code: string
  rtv_type: RTVType
  material_type: MaterialType
  grn_reference?: string
  dc_number?: string
  notes?: string
  items: Omit<RTVItem, "id">[]
}
