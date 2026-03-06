// File: approvalApiService.ts
// Path: frontend/lib/api/approvalApiService.ts

import { secureApiClient } from "@/lib/auth/secureApiClient"
import type { 
  ApprovalRecord, 
  ApprovalListResponse, 
  ApprovalListParams,
  ApprovalDetailResponse,
  ApprovalDeleteResponse,
  ApprovalWithOutwardResponse,
  ApprovalCreatePayload,
  BoxApprovalRecord,
  BoxApprovalListResponse,
  BoxApprovalCreatePayload,
  BoxApprovalListItem
} from "@/types/approval"

/**
 * Create a new approval record
 */
export async function createApproval(
  company: string,
  data: ApprovalCreatePayload['approval_data']
): Promise<ApprovalDetailResponse> {
  return await secureApiClient.post<ApprovalDetailResponse>(
    `/approval/${company}`,
    { approval_data: data }
  )
}

/**
 * Get paginated list of approval records
 */
export async function getApprovalList(
  company: string,
  params?: ApprovalListParams
): Promise<ApprovalListResponse> {
  const queryParams = new URLSearchParams()
  
  if (params?.page) queryParams.append("page", params.page.toString())
  if (params?.per_page) queryParams.append("per_page", params.per_page.toString())
  if (params?.search) queryParams.append("search", params.search)
  if (params?.consignment_no) queryParams.append("consignment_no", params.consignment_no)
  if (params?.approval_authority) queryParams.append("approval_authority", params.approval_authority)
  if (params?.approval_status !== undefined) queryParams.append("approval_status", params.approval_status.toString())
  if (params?.from_date) queryParams.append("from_date", params.from_date)
  if (params?.to_date) queryParams.append("to_date", params.to_date)
  if (params?.sort_by) queryParams.append("sort_by", params.sort_by)
  if (params?.sort_order) queryParams.append("sort_order", params.sort_order)
  
  const endpoint = `/approval/${company}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`
  
  return await secureApiClient.get<ApprovalListResponse>(endpoint)
}

/**
 * Get a specific approval record by ID
 */
export async function getApprovalDetail(
  company: string,
  recordId: string | number
): Promise<ApprovalDetailResponse> {
  return await secureApiClient.get<ApprovalDetailResponse>(
    `/approval/${company}/${recordId}`
  )
}

/**
 * Get approval by consignment number (with outward data)
 */
export async function getApprovalByConsignment(
  company: string,
  consignmentNo: string
): Promise<ApprovalWithOutwardResponse> {
  return await secureApiClient.get<ApprovalWithOutwardResponse>(
    `/approval/${company}/consignment/${consignmentNo}`
  )
}

/**
 * Update an existing approval record
 */
export async function updateApproval(
  company: string,
  recordId: string | number,
  data: Partial<ApprovalCreatePayload['approval_data']>
): Promise<ApprovalDetailResponse> {
  return await secureApiClient.put<ApprovalDetailResponse>(
    `/approval/${company}/${recordId}`,
    { approval_data: data }
  )
}

/**
 * Delete an approval record
 */
export async function deleteApproval(
  company: string,
  recordId: string | number
): Promise<ApprovalDeleteResponse> {
  return await secureApiClient.delete<ApprovalDeleteResponse>(
    `/approval/${company}/${recordId}`
  )
}

// ==================== BOX-LEVEL APPROVAL FUNCTIONS ====================

/**
 * Create a box-level approval
 */
export async function createBoxApproval(
  company: string,
  data: BoxApprovalCreatePayload['box_approval_data']
): Promise<BoxApprovalRecord> {
  return await secureApiClient.post<BoxApprovalRecord>(
    `/box-approval/${company}`,
    { box_approval_data: data }
  )
}

/**
 * Get box approvals for a specific consignment
 */
export async function getBoxApprovalsByConsignment(
  company: string,
  consignmentNo: string
): Promise<BoxApprovalListResponse> {
  return await secureApiClient.get<BoxApprovalListResponse>(
    `/box-approval/${company}/consignment/${consignmentNo}`
  )
}

/**
 * Update a box-level approval
 */
export async function updateBoxApproval(
  company: string,
  recordId: string | number,
  data: Partial<BoxApprovalCreatePayload['box_approval_data']>
): Promise<BoxApprovalRecord> {
  return await secureApiClient.put<BoxApprovalRecord>(
    `/box-approval/${company}/${recordId}`,
    { box_approval_data: data }
  )
}

/**
 * Delete a box approval
 */
export async function deleteBoxApproval(
  company: string,
  recordId: string | number
): Promise<ApprovalDeleteResponse> {
  return await secureApiClient.delete<ApprovalDeleteResponse>(
    `/box-approval/${company}/${recordId}`
  )
}

/**
 * Bulk approve/reject boxes for a consignment
 */
export async function bulkApproveBoxes(
  company: string,
  data: {
    consignment_no: string
    box_numbers: number[]
    approval_authority: string
    approval_date: string
    approval_status: boolean
    remark?: string
  }
): Promise<{ approved: number; message: string }> {
  return await secureApiClient.post(
    `/box-approval/${company}/bulk`,
    data
  )
}
