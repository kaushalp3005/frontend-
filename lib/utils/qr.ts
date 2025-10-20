// lib/utils/qr.ts
import type { QRPayload, OutwardQRPayload } from '@/types/qr'
import type { InwardRecord, InwardDetailResponse } from '@/types/inward'
import type { OutwardDetailResponse, OutwardBoxDetail, OutwardArticleDetail } from '@/types/outward'

/**
 * Generate QR payload for a specific box from new detailed response format
 */
export function generateQRPayloadFromDetail(
  detail: InwardDetailResponse, 
  boxNumber: number,
  articleIndex?: number
): QRPayload {
  const { transaction, articles, boxes } = detail
  
  // Find the box
  const box = boxes.find(b => b.box_number === boxNumber)
  if (!box) {
    throw new Error(`Box ${boxNumber} not found`)
  }
  
  // Find the article for this box
  const article = articles.find(a => a.item_description === box.article_description) || articles[articleIndex || 0]
  if (!article) {
    throw new Error(`Article not found for box ${boxNumber}`)
  }
  
  // Use box-specific weights if available, otherwise use article weights
  const netWeight = box.net_weight || article.net_weight || 0
  const totalWeight = box.gross_weight || article.total_weight || 0
  
  return {
    company: detail.company,
    entry_date: transaction.entry_date,
    vendor_name: transaction.vendor_supplier_name || '',
    customer_name: transaction.customer_party_name || '',
    item_description: article.item_description,
    net_weight: netWeight,
    total_weight: totalWeight,
    batch_number: article.batch_number || '',
    box_number: boxNumber,
    manufacturing_date: article.manufacturing_date,
    expiry_date: article.expiry_date,
    transaction_no: transaction.transaction_no,
    sku_id: article.sku_id
  }
}

/**
 * Generate QR payload for legacy format (backward compatibility)
 */
export function generateQRPayload(
  inwardRecord: InwardRecord, 
  boxNumber: number, 
  articleData?: any
): QRPayload {
  // If articleData is provided, use it; otherwise fall back to record data
  const article = articleData || inwardRecord
  
  // Find the specific box
  const box = inwardRecord.boxes?.find(b => b.box_number === boxNumber)
  
  // Use box-specific weights if available
  const netWeight = box?.net_weight || article.net_weight || 0
  const totalWeight = box?.gross_weight || article.total_weight || 0
  
  return {
    company: inwardRecord.company,
    entry_date: inwardRecord.entry_date,
    vendor_name: inwardRecord.vendor_supplier_name || '',
    customer_name: inwardRecord.customer_party_name || '',
    item_description: article.item_description || '',
    net_weight: netWeight,
    total_weight: totalWeight,
    batch_number: article.batch_number || '',
    box_number: boxNumber,
    manufacturing_date: article.manufacturing_date,
    expiry_date: article.expiry_date,
    transaction_no: inwardRecord.transaction_id || '',
    sku_id: article.sku_id || 0
  }
}

/**
 * Generate simplified QR data string containing only essential fields
 */
export function generateSimplifiedQRData(payload: QRPayload): string {
  const simplifiedData = {
    // Core identification
    co: payload.company,
    tx: payload.transaction_no,
    bx: payload.box_number,
    sk: payload.sku_id,
    
    // Product info
    it: payload.item_description,
    nw: payload.net_weight,
    tw: payload.total_weight,
    
    // Dates (shortened format)
    ed: payload.entry_date,
    md: payload.manufacturing_date,
    ex: payload.expiry_date,
    
    // Batch info
    bt: payload.batch_number,
    
    // Parties (shortened)
    vd: payload.vendor_name,
    cs: payload.customer_name
  }
  
  // Remove null/undefined values to keep QR code compact
  const filteredData = Object.fromEntries(
    Object.entries(simplifiedData).filter(([_, value]) => 
      value !== null && value !== undefined && value !== ''
    )
  )
  
  return JSON.stringify(filteredData)
}

/**
 * Parse simplified QR data back to full payload
 */
export function parseSimplifiedQRData(qrDataString: string): Partial<QRPayload> {
  try {
    const data = JSON.parse(qrDataString)
    
    return {
      company: data.co,
      transaction_no: data.tx,
      box_number: data.bx,
      sku_id: data.sk,
      item_description: data.it,
      net_weight: data.nw,
      total_weight: data.tw,
      entry_date: data.ed,
      manufacturing_date: data.md,
      expiry_date: data.ex,
      batch_number: data.bt,
      vendor_name: data.vd,
      customer_name: data.cs
    }
  } catch (error) {
    console.error('Failed to parse QR data:', error)
    return {}
  }
}

/**
 * Calculate optimal QR code size for given dimensions and DPI
 */
export function calculateQRSize(
  containerWidth: number, 
  containerHeight: number, 
  dpi: number = 203
): number {
  // For 4" x 2" label at 203 DPI
  const labelWidthPx = 4 * dpi  // 812px
  const labelHeightPx = 2 * dpi // 406px
  
  // QR code should take up about 45% of the label width (left half minus padding)
  const maxSize = Math.min(containerWidth * 0.9, containerHeight * 0.9)
  
  // Ensure it's at least readable at the target DPI
  const minSize = Math.max(100, dpi * 0.5) // At least 0.5 inch
  
  return Math.max(minSize, Math.min(maxSize, 150))
}

/**
 * Get print-optimized CSS styles for labels
 */
export function getPrintStyles(settings: { width: string; height: string; dpi: number }) {
  return {
    page: `
      @page {
        size: ${settings.width} ${settings.height};
        margin: 0;
      }
    `,
    label: `
      width: ${settings.width};
      height: ${settings.height};
      page-break-after: always;
      page-break-inside: avoid;
      display: flex;
      border: 1px solid #000;
      font-family: Arial, sans-serif;
      background: white;
      box-sizing: border-box;
    `,
    qrSection: `
      width: 50%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.1in;
    `,
    infoSection: `
      width: 50%;
      height: 100%;
      padding: 0.1in;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-size: 10pt;
      line-height: 1.2;
    `
  }
}

/**
 * Validate QR payload data
 */
export function validateQRPayload(payload: Partial<QRPayload>): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!payload.company) errors.push('Company is required')
  if (!payload.transaction_no) errors.push('Transaction number is required')
  if (!payload.box_number) errors.push('Box number is required')
  if (!payload.item_description) errors.push('Item description is required')
  if (!payload.entry_date) errors.push('Entry date is required')
  
  // Validate dates
  if (payload.entry_date && isNaN(Date.parse(payload.entry_date))) {
    errors.push('Invalid entry date format')
  }
  if (payload.manufacturing_date && isNaN(Date.parse(payload.manufacturing_date))) {
    errors.push('Invalid manufacturing date format')
  }
  if (payload.expiry_date && isNaN(Date.parse(payload.expiry_date))) {
    errors.push('Invalid expiry date format')
  }
  
  // Validate numeric fields
  if (payload.net_weight !== undefined && payload.net_weight < 0) {
    errors.push('Net weight cannot be negative')
  }
  if (payload.total_weight !== undefined && payload.total_weight < 0) {
    errors.push('Total weight cannot be negative')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// ============================================
// OUTWARD QR CODE FUNCTIONS
// ============================================

/**
 * Generate outward QR payload from outward detail response
 */
export function generateOutwardQRPayload(
  outwardDetail: OutwardDetailResponse,
  boxDetail: OutwardBoxDetail,
  articleDetail: OutwardArticleDetail
): OutwardQRPayload {
  return {
    company_name: outwardDetail.company_name,
    consignment_no: outwardDetail.consignment_no,
    invoice_no: outwardDetail.invoice_no,
    po_no: outwardDetail.po_no || '',
    dispatch_date: outwardDetail.dispatch_date,
    customer_name: outwardDetail.customer_name,
    material_type: articleDetail.material_type,
    item_category: articleDetail.item_category,
    sub_category: articleDetail.sub_category,
    item_description: articleDetail.item_description,
    pack_size_gm: articleDetail.pack_size_gm,
    no_of_packets: articleDetail.no_of_packets,
    batch_number: articleDetail.batch_number,
    box_number: boxDetail.box_number,
    article_name: boxDetail.article_name,
    net_weight_gm: boxDetail.net_weight_gm,
    gross_weight_gm: boxDetail.gross_weight_gm,
    approval_authority: outwardDetail.approval?.approval_authority || '',
    approval_status: outwardDetail.approval?.approval_status || 'pending',
    approval_date: outwardDetail.approval?.approval_date || '',
    remark: outwardDetail.approval?.remarks || ''
  }
}

/**
 * Generate simplified outward QR data string with compressed field names
 */
export function generateSimplifiedOutwardQRData(payload: OutwardQRPayload): string {
  const simplifiedData = {
    // Core identification
    co: payload.company_name,
    cn: payload.consignment_no,
    in: payload.invoice_no,
    po: payload.po_no,
    dd: payload.dispatch_date,
    cs: payload.customer_name,
    
    // Product info
    mt: payload.material_type,
    ic: payload.item_category,
    sc: payload.sub_category,
    id: payload.item_description,
    ps: payload.pack_size_gm,
    np: payload.no_of_packets,
    bn: payload.batch_number,
    bx: payload.box_number,
    an: payload.article_name,
    nw: payload.net_weight_gm,
    gw: payload.gross_weight_gm,
    
    // Approval info
    aa: payload.approval_authority,
    as: payload.approval_status,
    ad: payload.approval_date,
    rm: payload.remark
  }
  
  // Remove null/undefined values to keep QR code compact
  const filteredData = Object.fromEntries(
    Object.entries(simplifiedData).filter(([_, value]) => 
      value !== null && value !== undefined && value !== ''
    )
  )
  
  return JSON.stringify(filteredData)
}

/**
 * Parse simplified outward QR data back to full payload
 */
export function parseSimplifiedOutwardQRData(qrDataString: string): Partial<OutwardQRPayload> {
  try {
    const data = JSON.parse(qrDataString)
    
    return {
      company_name: data.co,
      consignment_no: data.cn,
      invoice_no: data.in,
      po_no: data.po,
      dispatch_date: data.dd,
      customer_name: data.cs,
      material_type: data.mt,
      item_category: data.ic,
      sub_category: data.sc,
      item_description: data.id,
      pack_size_gm: data.ps,
      no_of_packets: data.np,
      batch_number: data.bn,
      box_number: data.bx,
      article_name: data.an,
      net_weight_gm: data.nw,
      gross_weight_gm: data.gw,
      approval_authority: data.aa,
      approval_status: data.as,
      approval_date: data.ad,
      remark: data.rm
    }
  } catch (error) {
    console.error('Failed to parse outward QR data:', error)
    return {}
  }
}

/**
 * Validate outward QR payload data
 */
export function validateOutwardQRPayload(payload: Partial<OutwardQRPayload>): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!payload.company_name) errors.push('Company name is required')
  if (!payload.consignment_no) errors.push('Consignment number is required')
  if (!payload.customer_name) errors.push('Customer name is required')
  if (!payload.box_number) errors.push('Box number is required')
  if (!payload.article_name) errors.push('Article name is required')
  
  return { isValid: errors.length === 0, errors }
}