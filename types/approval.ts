// File: approval.ts
// Path: frontend/types/approval.ts

export interface ApprovalRecord {
  id?: number
  consignment_no: string
  approval_authority: string
  approval_date: string // date in ISO format
  quantity: number
  uom: string
  gross_weight: number
  net_weight: number
  approval_status: boolean
  remark: string
  created_at?: string
  updated_at?: string
}

export interface ApprovalFormData extends Omit<ApprovalRecord, 'id' | 'created_at' | 'updated_at'> {}

// Backend API Response Types
export interface ApprovalListItem {
  id: number
  consignment_no: string
  approval_authority: string
  approval_date: string
  approval_status: boolean
  quantity: number
}

export interface ApprovalListResponse {
  records: ApprovalListItem[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface ApprovalDetailResponse extends ApprovalRecord {
  id: number
  created_at: string
  updated_at: string
}

export interface ApprovalCreatePayload {
  approval_data: {
    consignment_no: string
    approval_authority: string
    approval_date: string
    quantity: number
    uom: string
    gross_weight: number
    net_weight: number
    approval_status: boolean
    remark: string
  }
}

export interface ApprovalWithOutwardResponse {
  approval: {
    id: number
    consignment_no: string
    approval_authority: string
    approval_date: string
    quantity: number
    uom: string
    gross_weight: number
    net_weight: number
    approval_status: boolean
    remark: string
    created_at: string
    updated_at: string
  }
  outward: {
    id: number
    consignment_no: string
    customer_name: string
    dispatch_date: string
    delivery_status: string
    total_invoice_amount: number
  }
}

export interface ApprovalDeleteResponse {
  id: number
  consignment_no: string
  approval_authority: string
  status: string
  message: string
  deleted_at: string
}

export interface ApprovalListParams {
  page?: number
  per_page?: number
  search?: string
  consignment_no?: string
  approval_authority?: string
  approval_status?: boolean
  from_date?: string
  to_date?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export type ApprovalStatusType = 'approved' | 'rejected' | 'pending'

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatusType, string> = {
  'approved': 'Approved',
  'rejected': 'Rejected',
  'pending': 'Pending'
}

export const APPROVAL_STATUS_COLORS: Record<ApprovalStatusType, string> = {
  'approved': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'rejected': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  'pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
}

// Box-Level Approval Types
export interface BoxApprovalRecord {
  id?: number
  consignment_no: string
  box_number: number
  article_description: string
  approval_authority: string
  approval_date: string
  net_weight: number
  gross_weight: number
  approval_status: boolean
  remark: string
  created_at?: string
  updated_at?: string
}

export interface BoxApprovalListItem {
  id: number
  consignment_no: string
  box_number: number
  article_description: string
  approval_status: boolean
  approval_authority: string
  approval_date: string
}

export interface BoxApprovalListResponse {
  records: BoxApprovalListItem[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface BoxApprovalCreatePayload {
  box_approval_data: {
    consignment_no: string
    box_number: number
    article_description: string
    approval_authority: string
    approval_date: string
    net_weight: number
    gross_weight: number
    approval_status: boolean
    remark: string
  }
}