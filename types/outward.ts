// File: outward.ts
// Path: frontend/types/outward.ts

export interface OutwardRecord {
  id?: number
  company_name: string
  consignment_no: string
  invoice_no: string
  customer_name: string
  location: string | null
  po_no: string | null
  boxes: number
  gross_weight: string
  net_weight: string
  appt_date: string // date in ISO format (required)
  appt_time: string // time in HH:MM:SS format (required)
  sitecode: string | null
  asn_id: number
  transporter_name: string | null
  vehicle_no: string | null
  lr_no: string | null
  dispatch_date: string // date in ISO format (required)
  estimated_delivery_date: string // date in ISO format (required)
  actual_delivery_date: string | null // date in ISO format (nullable)
  delivery_status: string
  invoice_amount: number
  invoice_gst_amount: number
  total_invoice_amount: number
  freight_amount: number
  freight_gst_amount: number
  total_freight_amount: number
  billing_address: string | null
  shipping_address: string | null
  pincode: number
  business_head: string | null
  business_head_name: string | null
  business_head_email: string | null
  invoice_files?: string[] | null
  pod_files?: string[] | null
  created_at?: string
  updated_at?: string
}

export interface OutwardFormData extends Omit<OutwardRecord, 'id' | 'created_at' | 'updated_at'> {}

// Backend API Response Types
export interface OutwardListItem {
  id: number
  company_name: string
  consignment_no: string
  invoice_no: string
  customer_name: string
  location: string | null
  po_no: string | null
  boxes: number
  gross_weight: string
  net_weight: string
  appt_date: string
  appt_time: string
  sitecode: string | null
  asn_id: number
  transporter_name: string | null
  vehicle_no: string | null
  lr_no: string | null
  dispatch_date: string
  estimated_delivery_date: string
  actual_delivery_date: string | null
  delivery_status: string
  invoice_amount: number
  invoice_gst_amount: number
  total_invoice_amount: number
  freight_amount: number
  freight_gst_amount: number
  total_freight_amount: number
  billing_address: string | null
  shipping_address: string | null
  pincode: number
  business_head: string | null
  business_head_name: string | null
  business_head_email: string | null
  invoice_files?: string[] | null
  pod_files?: string[] | null
  created_at: string
  updated_at: string
  approval_status?: 'approved' | 'rejected' | 'pending'
}

export interface OutwardListResponse {
  records: OutwardListItem[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

// Article detail from backend
export interface OutwardArticleDetail {
  id: number
  outward_id: number
  company_name: string
  material_type: string
  item_category: string
  sub_category: string
  item_description: string
  sku_id: string | number
  quantity_units: number
  uom: string
  pack_size_gm: number
  no_of_packets: number
  net_weight_gm: number
  gross_weight_gm: number
  batch_number: string
  unit_rate: number
  created_at: string
  updated_at: string
}

// Box detail from backend
export interface OutwardBoxDetail {
  id: number
  article_id: number
  outward_id: number
  company_name: string
  box_number: number
  article_name: string
  lot_number: string | null
  net_weight_gm: number
  gross_weight_gm: number
  qr_code_generated: boolean
  qr_code_data: string | null
  created_at: string
  updated_at: string
}

// Approval detail from backend
export interface OutwardApprovalDetail {
  id: number
  outward_id: number
  company_name: string
  approval_status: string
  approval_authority: string
  approval_date: string
  remarks: string
  created_at: string
  updated_at: string
}

export interface OutwardDetailResponse extends OutwardRecord {
  id: number
  created_at: string
  updated_at: string
  articles?: OutwardArticleDetail[]
  box_details?: OutwardBoxDetail[]
  approval?: OutwardApprovalDetail | null
}

export interface OutwardCreatePayload {
  consignment_no: string
  invoice_no: string
  customer_name: string
  location: string | null
  po_no: string | null
  boxes: number
  gross_weight: string
  net_weight: string
  appt_date: string
  appt_time: string
  sitecode: string | null
  asn_id: number
  transporter_name: string | null
  vehicle_no: string | null
  lr_no: string | null
  dispatch_date: string
  estimated_delivery_date: string
  actual_delivery_date: string | null
  delivery_status: string
  invoice_amount: number
  invoice_gst_amount: number
  total_invoice_amount: number
  freight_amount: number
  freight_gst_amount: number
  total_freight_amount: number
  billing_address: string | null
  shipping_address: string | null
  pincode: number
  business_head: string | null
  business_head_name: string | null
  business_head_email: string | null
  invoice_files: string[] | null
  pod_files: string[] | null
}

export interface OutwardStatsResponse {
  company: string
  total_records: number
  delivery_status: {
    delivered?: number
    in_transit?: number
    pending?: number
    out_for_delivery?: number
    delayed?: number
    cancelled?: number
    returned?: number
    [key: string]: number | undefined
  }
  totals: {
    boxes: number
    invoice_value: number
    freight_value: number
  }
}

export interface OutwardDeleteResponse {
  id: number
  consignment_no: string
  status: string
  message: string
  deleted_at: string
}

export interface OutwardListParams {
  page?: number
  per_page?: number
  search?: string
  customer_name?: string
  delivery_status?: string
  from_date?: string
  to_date?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export type DeliveryStatus = 
  | 'PENDING'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DELAYED'
  | 'CANCELLED'
  | 'RETURNED'

export const DELIVERY_STATUS_OPTIONS: DeliveryStatus[] = [
  'PENDING',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELAYED',
  'CANCELLED',
  'RETURNED'
]

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  'pending': 'Pending',
  'in_transit': 'In Transit',
  'out_for_delivery': 'Out for Delivery',
  'delivered': 'Delivered',
  'delayed': 'Delayed',
  'cancelled': 'Cancelled',
  'returned': 'Returned',
  'PENDING': 'Pending',
  'IN_TRANSIT': 'In Transit',
  'OUT_FOR_DELIVERY': 'Out for Delivery',
  'DELIVERED': 'Delivered',
  'DELAYED': 'Delayed',
  'CANCELLED': 'Cancelled',
  'RETURNED': 'Returned'
}

