// File: outwardApiService.ts
// Path: frontend/lib/api/outwardApiService.ts

import { secureApiClient } from "@/lib/auth/secureApiClient"
import type { 
  OutwardRecord, 
  OutwardListResponse, 
  OutwardListParams,
  OutwardStatsResponse,
  OutwardCreatePayload,
  OutwardDetailResponse,
  OutwardDeleteResponse
} from "@/types/outward"

/**
 * Create a new outward record
 */
export async function createOutward(
  company: string,
  data: OutwardCreatePayload
): Promise<OutwardDetailResponse> {
  console.log('📤 API: Creating outward to:', `/outward/${company}`)
  console.log('📤 API: Create payload:', JSON.stringify(data, null, 2))

  // Clean the data: Remove fields with null values to avoid backend converting them to "NOT SPECIFIED"
  // This is especially important for numeric fields like lr_no which is a bigint in the database
  const cleanedData = Object.entries(data).reduce((acc, [key, value]) => {
    // Only include fields that have non-null values
    if (value !== null && value !== undefined) {
      acc[key] = value
    }
    return acc
  }, {} as any)

  console.log('📤 API: Cleaned payload (null values removed):', JSON.stringify(cleanedData, null, 2))

  try {
    const response = await secureApiClient.post<OutwardDetailResponse>(
      `/outward/${company}`,
      cleanedData
    )
    console.log('✅ API: Outward created successfully:', response)
    return response
  } catch (error: any) {
    console.error('❌ API: Outward creation failed:', error)
    console.error('❌ API: Full error object:', error)
    console.error('❌ API: Error context:', error?.context)
    console.error('❌ API: Error response data:', error?.context?.responseData)
    console.error('❌ API: Error message:', error?.message)
    throw error
  }
}

/**
 * Transform approval status from boolean to string format
 * Backend stores approval_status as boolean in the approval table:
 * - true = approved
 * - false = rejected  
 * - null/undefined = pending (no approval record exists)
 */
function transformApprovalStatus(status: any): 'approved' | 'rejected' | 'pending' {
  // Handle boolean values from backend
  if (status === true || status === 'true') return 'approved'
  if (status === false || status === 'false') return 'rejected'
  
  // Handle null, undefined, or any other value as pending
  return 'pending'
}

/**
 * Get paginated list of outward records with approval status
 * 
 * Flow:
 * 1. Fetch outward records from /outward/{company}
 * 2. Fetch approval data from /approval/{company}
 * 3. Match outward records with approval data by consignment_no
 * 4. Transform approval_status from boolean to string format for UI
 */
export async function getOutwardList(
  company: string,
  params?: OutwardListParams
): Promise<OutwardListResponse> {
  const queryParams = new URLSearchParams()
  
  if (params?.page) queryParams.append("page", params.page.toString())
  if (params?.per_page) queryParams.append("per_page", params.per_page.toString())
  if (params?.search) queryParams.append("search", params.search)
  if (params?.customer_name) queryParams.append("customer_name", params.customer_name)
  if (params?.delivery_status) queryParams.append("delivery_status", params.delivery_status)
  if (params?.from_date) queryParams.append("from_date", params.from_date)
  if (params?.to_date) queryParams.append("to_date", params.to_date)
  if (params?.sort_by) queryParams.append("sort_by", params.sort_by)
  if (params?.sort_order) queryParams.append("sort_order", params.sort_order)
  
  const endpoint = `/outward/${company}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`
  
  console.log('📡 Step 1: Fetching outward records...')
  const outwardResponse = await secureApiClient.get<OutwardListResponse>(endpoint)
  
  // Step 2: Fetch approval data for each record using the outward detail endpoint
  // This is necessary because the backend listing endpoint doesn't include approval status
  console.log('📡 Step 2: Fetching approval status for each record...')
  try {
    const approvalPromises = outwardResponse.records.map(async (record) => {
      try {
        // Fetch the full outward detail which includes approval
        const detailResponse = await getOutwardDetail(company, record.id)
        
        // Extract approval status from the detail response
        if (detailResponse.approval) {
          const approval = detailResponse.approval
          // Map the approval_status from backend format to frontend format
          if (approval.approval_status === "APPROVED") {
            return { consignment_no: record.consignment_no, status: 'approved' as const }
          } else if (approval.approval_status === "REJECTED") {
            return { consignment_no: record.consignment_no, status: 'rejected' as const }
          } else {
            return { consignment_no: record.consignment_no, status: 'pending' as const }
          }
        }
        return { consignment_no: record.consignment_no, status: 'pending' as const }
      } catch (error) {
        // If detail fetch fails, default to pending
        console.warn(`⚠️ Could not fetch approval for ${record.consignment_no}`)
        return { consignment_no: record.consignment_no, status: 'pending' as const }
      }
    })
    
    const approvals = await Promise.all(approvalPromises)
    const approvalMap = new Map(approvals.map(a => [a.consignment_no, a.status]))
    
    console.log(`✅ Fetched approval status for ${approvalMap.size} records`)
    
    // Step 3: Add approval status to records
    outwardResponse.records = outwardResponse.records.map(record => {
      const approvalStatus = approvalMap.get(record.consignment_no) || 'pending'
      
      console.log(`🔗 Consignment ${record.consignment_no}: approval -> ${approvalStatus}`)
      
      return {
        ...record,
        approval_status: approvalStatus
      }
    })
    
  } catch (err) {
    console.error('⚠️ Failed to fetch approval data:', err)
    // If approval fetch fails, set all to pending
    outwardResponse.records = outwardResponse.records.map(record => ({
      ...record,
      approval_status: 'pending' as const
    }))
  }
  
  return outwardResponse
}

/**
 * Get a specific outward record by ID
 */
export async function getOutwardDetail(
  company: string,
  recordId: string | number
): Promise<OutwardDetailResponse> {
  const response = await secureApiClient.get<OutwardDetailResponse>(
    `/outward/${company}/${recordId}`
  )
  
  // Note: OutwardDetailResponse doesn't include approval_status in the type definition
  // If the backend returns it, it would need to be transformed here as well
  return response
}

/**
 * Update an existing outward record
 */
export async function updateOutward(
  company: string,
  recordId: string | number,
  data: Partial<OutwardCreatePayload>
): Promise<OutwardDetailResponse> {
  // Clean the data: Remove fields with null values to avoid backend converting them to "NOT SPECIFIED"
  // This is especially important for numeric fields like lr_no which is a bigint in the database
  const cleanedData = Object.entries(data).reduce((acc, [key, value]) => {
    // Only include fields that have non-null values
    if (value !== null && value !== undefined) {
      (acc as any)[key] = value
    }
    return acc
  }, {} as Partial<OutwardCreatePayload>)

  return await secureApiClient.put<OutwardDetailResponse>(
    `/outward/${company}/${recordId}`,
    { outward_data: cleanedData }
  )
}

/**
 * Delete an outward record
 */
export async function deleteOutward(
  company: string,
  recordId: string | number
): Promise<OutwardDeleteResponse> {
  return await secureApiClient.delete<OutwardDeleteResponse>(
    `/outward/${company}/${recordId}`
  )
}

// ============================================
// ARTICLE MANAGEMENT API FUNCTIONS
// ============================================

/**
 * Article create payload type
 */
export interface ArticleCreatePayload {
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
}

/**
 * Article delete response type
 */
export interface ArticleDeleteResponse {
  message: string
  article_id: number
}

/**
 * Create a new article for an outward record
 */
export async function createArticle(
  company: string,
  recordId: string | number,
  data: ArticleCreatePayload
): Promise<import("@/types/outward").OutwardArticleDetail> {
  return await secureApiClient.post<import("@/types/outward").OutwardArticleDetail>(
    `/outward/${company}/${recordId}/articles`,
    data
  )
}

/**
 * Get all articles for an outward record
 */
export async function getArticles(
  company: string,
  recordId: string | number
): Promise<import("@/types/outward").OutwardArticleDetail[]> {
  return await secureApiClient.get<import("@/types/outward").OutwardArticleDetail[]>(
    `/outward/${company}/${recordId}/articles`
  )
}

/**
 * Update an existing article
 */
export async function updateArticle(
  company: string,
  recordId: string | number,
  articleId: number,
  data: Partial<ArticleCreatePayload>
): Promise<import("@/types/outward").OutwardArticleDetail> {
  return await secureApiClient.put<import("@/types/outward").OutwardArticleDetail>(
    `/outward/${company}/${recordId}/articles/${articleId}`,
    data
  )
}

/**
 * Delete an article
 */
export async function deleteArticle(
  company: string,
  recordId: string | number,
  articleId: number
): Promise<ArticleDeleteResponse> {
  return await secureApiClient.delete<ArticleDeleteResponse>(
    `/outward/${company}/${recordId}/articles/${articleId}`
  )
}

// ============================================
// BOX MANAGEMENT API FUNCTIONS
// ============================================

/**
 * Box update payload type
 */
export interface BoxUpdatePayload {
  lot_number?: string
  gross_weight_gm?: number
}

/**
 * Box delete response type
 */
export interface BoxDeleteResponse {
  message: string
  box_id: number
}

/**
 * Get boxes for an outward record (optionally filtered by article)
 */
export async function getBoxes(
  company: string,
  recordId: string | number,
  articleId?: number
): Promise<import("@/types/outward").OutwardBoxDetail[]> {
  const queryParams = articleId ? `?article_id=${articleId}` : ""
  return await secureApiClient.get<import("@/types/outward").OutwardBoxDetail[]>(
    `/outward/${company}/${recordId}/boxes${queryParams}`
  )
}

/**
 * Update a box
 */
export async function updateBox(
  company: string,
  recordId: string | number,
  boxId: number,
  data: BoxUpdatePayload
): Promise<import("@/types/outward").OutwardBoxDetail> {
  return await secureApiClient.put<import("@/types/outward").OutwardBoxDetail>(
    `/outward/${company}/${recordId}/boxes/${boxId}`,
    data
  )
}

/**
 * Delete a box
 */
export async function deleteBox(
  company: string,
  recordId: string | number,
  boxId: number
): Promise<BoxDeleteResponse> {
  return await secureApiClient.delete<BoxDeleteResponse>(
    `/outward/${company}/${recordId}/boxes/${boxId}`
  )
}

// ============================================
// OUTWARD APPROVAL API FUNCTIONS
// ============================================

/**
 * Simple approval payload
 *
 * Backend supports: APPROVE, REJECT, PENDING
 */
export interface SimpleApprovalPayload {
  approval_status: "APPROVE" | "REJECT" | "PENDING"
  approval_authority: string
  approval_date: string
  remarks: string
}

/**
 * Approval with articles and boxes payload
 */
export interface ApprovalWithArticlesPayload {
  consignment_id: number
  approval_authority: string
  approval_date: string
  approval_status: "approved" | "rejected" | "pending"
  approval_remark: string
  articles: Array<{
    id?: string
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
  }>
  boxes: Array<{
    box_number: number
    article_name: string
    lot_number?: string
    net_weight_gm: number
    gross_weight_gm: number
  }>
}

/**
 * Simple approval response
 */
export interface SimpleApprovalResponse {
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

/**
 * Create simple approval for outward record
 */
export async function createSimpleApproval(
  company: string,
  recordId: string | number,
  data: SimpleApprovalPayload
): Promise<SimpleApprovalResponse> {
  return await secureApiClient.post<SimpleApprovalResponse>(
    `/outward/${company}/${recordId}/approval`,
    data
  )
}

/**
 * Submit approval with articles and boxes
 */
export async function submitApprovalWithArticles(
  company: string,
  data: ApprovalWithArticlesPayload
): Promise<SimpleApprovalResponse> {
  try {
    console.log('📤 API: Submitting approval to:', `/outward/${company}/approval/submit`)
    console.log('📤 API: Payload:', JSON.stringify(data, null, 2))
    
    const response = await secureApiClient.post<SimpleApprovalResponse>(
      `/outward/${company}/approval/submit`,
      data
    )
    
    console.log('✅ API: Approval submitted successfully:', response)
    return response
  } catch (error: any) {
    console.error('❌ API: Approval submission failed:', error)
    console.error('❌ API: Full error object:', error)
    console.error('❌ API: Error context:', error?.context)
    console.error('❌ API: Error response data:', error?.context?.responseData)
    console.error('❌ API: Error message:', error?.message)
    throw error
  }
}

/**
 * Get approval for an outward record
 */
export async function getOutwardApproval(
  company: string,
  recordId: string | number
): Promise<SimpleApprovalResponse> {
  return await secureApiClient.get<SimpleApprovalResponse>(
    `/outward/${company}/${recordId}/approval`
  )
}

/**
 * Get outward statistics summary
 */
export async function getOutwardStats(
  company: string
): Promise<OutwardStatsResponse> {
  return await secureApiClient.get<OutwardStatsResponse>(
    `/outward/${company}/stats/summary`
  )
}

/**
 * Get all outward records (for export purposes)
 * Includes approval status matching
 * Fetches all records without pagination
 */
export async function getAllOutwardRecords(
  company: string,
  params?: Omit<OutwardListParams, 'page' | 'per_page'>
): Promise<OutwardListResponse> {
  console.log('📥 Fetching all outward records for export...')

  const queryParams = new URLSearchParams()

  if (params?.search) queryParams.append("search", params.search)
  if (params?.customer_name) queryParams.append("customer_name", params.customer_name)
  if (params?.delivery_status) queryParams.append("delivery_status", params.delivery_status)
  if (params?.from_date) queryParams.append("from_date", params.from_date)
  if (params?.to_date) queryParams.append("to_date", params.to_date)

  // Don't specify per_page or page to get all records
  const endpoint = `/outward/${company}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`

  console.log('📡 API Endpoint:', endpoint)
  const outwardResponse = await secureApiClient.get<OutwardListResponse>(endpoint)

  console.log(`✅ Fetched ${outwardResponse.records.length} total records`)

  // Fetch approval data for each record using the outward detail endpoint
  try {
    console.log('🔍 Fetching approval statuses...')
    const approvalPromises = outwardResponse.records.map(async (record) => {
      try {
        const detailResponse = await getOutwardDetail(company, record.id)

        if (detailResponse.approval) {
          const approval = detailResponse.approval
          if (approval.approval_status === "APPROVED") {
            return { consignment_no: record.consignment_no, status: 'approved' as const }
          } else if (approval.approval_status === "REJECTED") {
            return { consignment_no: record.consignment_no, status: 'rejected' as const }
          } else {
            return { consignment_no: record.consignment_no, status: 'pending' as const }
          }
        }
        return { consignment_no: record.consignment_no, status: 'pending' as const }
      } catch (error) {
        return { consignment_no: record.consignment_no, status: 'pending' as const }
      }
    })

    const approvals = await Promise.all(approvalPromises)
    const approvalMap = new Map(approvals.map(a => [a.consignment_no, a.status]))

    outwardResponse.records = outwardResponse.records.map(record => {
      const approvalStatus = approvalMap.get(record.consignment_no) || 'pending'
      return {
        ...record,
        approval_status: approvalStatus
      }
    })

    console.log('✅ Approval statuses fetched successfully')
  } catch (err) {
    console.error('⚠️ Failed to fetch approval data for export:', err)
    outwardResponse.records = outwardResponse.records.map(record => ({
      ...record,
      approval_status: 'pending' as const
    }))
  }

  return outwardResponse
}

// ============================================
// DROPDOWN API FUNCTIONS
// ============================================

/**
 * Sitecode dropdown response type
 */
export interface SitecodeResponse {
  id: number
  sitecode: string
  is_active: boolean
}

/**
 * Transporter dropdown response type
 */
export interface TransporterResponse {
  id: number
  transporter_name: string
  contact_no: string | null
  email: string | null
  is_active: boolean
}

/**
 * Transporter create payload
 */
export interface TransporterCreatePayload {
  transporter_name: string
  contact_no?: string
  email?: string
}

/**
 * Get list of sitecodes for dropdown
 */
export async function getSitecodes(activeOnly: boolean = true): Promise<SitecodeResponse[]> {
  const queryParams = new URLSearchParams()
  queryParams.append("active_only", activeOnly.toString())

  return await secureApiClient.get<SitecodeResponse[]>(
    `/outward/dropdowns/sitecodes?${queryParams.toString()}`
  )
}

/**
 * Create a new sitecode
 */
export async function createSitecode(sitecode: string): Promise<SitecodeResponse> {
  return await secureApiClient.post<SitecodeResponse>(
    `/outward/dropdowns/sitecodes`,
    { sitecode }
  )
}

/**
 * Get list of transporters for dropdown
 */
export async function getTransporters(activeOnly: boolean = true): Promise<TransporterResponse[]> {
  const queryParams = new URLSearchParams()
  queryParams.append("active_only", activeOnly.toString())

  return await secureApiClient.get<TransporterResponse[]>(
    `/outward/dropdowns/transporters?${queryParams.toString()}`
  )
}

/**
 * Create a new transporter
 */
export async function createTransporter(data: TransporterCreatePayload): Promise<TransporterResponse> {
  return await secureApiClient.post<TransporterResponse>(
    `/outward/dropdowns/transporters`,
    data
  )
}

// ============================================
// UTILITY API FUNCTIONS
// ============================================

/**
 * Generate a new LR number
 */
export async function generateLrNumber(): Promise<{ lr_number: string }> {
  return await secureApiClient.get<{ lr_number: string }>(
    `/outward/utils/generate-lr-number`
  )
}

/**
 * Get business head email by business head name
 */
export async function getBusinessHeadEmail(businessHead: string): Promise<{ business_head: string, email: string }> {
  return await secureApiClient.get<{ business_head: string, email: string }>(
    `/outward/utils/business-head-email/${encodeURIComponent(businessHead)}`
  )
}

// ============================================
// FILE UPLOAD API FUNCTIONS
// ============================================

/**
 * AI Invoice Extraction Response Type
 */
export interface InvoiceExtractionResponse {
  success: boolean
  filename: string
  file_type: string
  extracted_data: {
    invoice_number: string
    po_number: string
    customer_name: string
    dispatch_date: string
    total_invoice_amount: number
    total_gst_amount: number
    billing_address: string
    shipping_address: string
    pincode: string
  }
}

/**
 * Extract invoice data using AI
 * Endpoint: POST /outward/extract-invoice
 */
export async function extractInvoiceData(
  file: File
): Promise<InvoiceExtractionResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/outward/extract-invoice`,
    {
      method: 'POST',
      body: formData
      // No need to set Content-Type header - browser sets it automatically with boundary
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to extract invoice data' }))
    throw new Error(error.detail || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

/**
 * Upload invoice files for an outward record
 * Updated endpoint: POST /outward/upload-invoice?company=CFPL
 */
export async function uploadInvoiceFiles(
  company: string,
  files: File[]
): Promise<{ message: string; files: string[]; total_files: number }> {
  const formData = new FormData()
  files.forEach(file => {
    formData.append('files', file)
  })

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/outward/upload-invoice?company=${encodeURIComponent(company)}`,
    {
      method: 'POST',
      body: formData
      // Removed credentials: 'include' to avoid CORS issues with wildcard origin
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to upload invoice files')
  }

  return response.json()
}


/**
 * Upload POD files for an outward record
 */
export async function uploadPodFiles(
  company: string,
  recordId: number,
  files: File[]
): Promise<{ message: string; files: string[]; total_files: number }> {
  const formData = new FormData()
  files.forEach(file => {
    formData.append('files', file)
  })

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/outward/${company}/${recordId}/upload-pod`,
    {
      method: 'POST',
      body: formData,
      credentials: 'include'
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to upload POD files')
  }

  return response.json()
}

/**
 * Delete a specific invoice file
 */
export async function deleteInvoiceFile(
  company: string,
  recordId: number,
  filePath: string
): Promise<{ message: string; deleted_file: string; remaining_files: number }> {
  const queryParams = new URLSearchParams({ file_path: filePath })

  return await secureApiClient.delete(
    `/outward/${company}/${recordId}/delete-invoice-file?${queryParams.toString()}`
  )
}

/**
 * Delete a specific POD file
 */
export async function deletePodFile(
  company: string,
  recordId: number,
  filePath: string
): Promise<{ message: string; deleted_file: string; remaining_files: number }> {
  const queryParams = new URLSearchParams({ file_path: filePath })

  return await secureApiClient.delete(
    `/outward/${company}/${recordId}/delete-pod-file?${queryParams.toString()}`
  )
}

