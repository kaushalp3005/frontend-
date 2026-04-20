import * as XLSX from 'xlsx'

export interface InwardExcelData {
  // System Information
  company: string
  transaction_id: string
  entry_date: string
  system_grn_date?: string
  
  // Transport Information
  vehicle_number?: string
  transporter_name?: string
  lr_number?: string
  source_location?: string
  destination_location?: string
  
  // Party Information
  vendor_supplier_name?: string
  customer_party_name?: string
  purchase_by?: string
  approval_authority?: string
  
  // Document Information
  challan_number?: string
  invoice_number?: string
  po_number?: string
  grn_number?: string
  grn_quantity?: number
  received_quantity?: number
  dn_number?: string
  service_invoice_number?: string
  
  // Financial Information
  total_amount?: number
  tax_amount?: number
  discount_amount?: number
  currency?: string
  
  // Remarks
  remark?: string
  
  // Article Information (for first article - we'll create separate rows for multiple articles)
  sku_id?: number
  item_description?: string
  item_category?: string
  sub_category?: string
  item_code?: string
  hsn_code?: string
  quality_grade?: string
  uom?: string
  packaging_type?: string
  quantity_units?: number
  net_weight?: number
  total_weight?: number
  batch_number?: string
  lot_number?: string
  manufacturing_date?: string
  expiry_date?: string
  import_date?: string
  unit_rate?: number
  article_total_amount?: number
  article_tax_amount?: number
  article_discount_amount?: string
  
  // Box Information (for first box - we'll create separate rows for multiple boxes)
  box_number?: number
  article_description?: string
  box_net_weight?: number
  box_gross_weight?: number
  box_lot_number?: string
  
  // Legacy fields for backward compatibility
  item_descriptions?: string[]
  quantities_and_uoms?: string[]
}

export function downloadInwardRecordsAsExcel(
  data: InwardExcelData[], 
  company: string,
  filename?: string
) {
  // Create a new workbook
  const workbook = XLSX.utils.book_new()
  
  // Transform data for Excel format with comprehensive details
  const excelData = data.map(record => ({
    // System Information
    'Company': record.company || '',
    'Transaction ID': record.transaction_id || '',
    'Entry Date': record.entry_date || '',
    'System GRN Date': record.system_grn_date || '',
    
    // Transport Information
    'Vehicle Number': record.vehicle_number || '',
    'Transporter Name': record.transporter_name || '',
    'LR Number': record.lr_number || '',
    'Source Location': record.source_location || '',
    'Destination Location': record.destination_location || '',
    
    // Party Information
    'Vendor/Supplier Name': record.vendor_supplier_name || '',
    'Customer/Party Name': record.customer_party_name || '',
    'Purchase By': record.purchase_by || '',
    'Approval Authority': record.approval_authority || '',
    
    // Document Information
    'Challan Number': record.challan_number || '',
    'Invoice Number': record.invoice_number || '',
    'PO Number': record.po_number || '',
    'GRN Number': record.grn_number || '',
    'GRN Quantity': record.grn_quantity || '',
    'Received Quantity': record.received_quantity || '',
    'DN Number': record.dn_number || '',
    'Service Invoice Number': record.service_invoice_number || '',
    
    // Financial Information
    'Total Amount': record.total_amount || '',
    'Tax Amount': record.tax_amount || '',
    'Discount Amount': record.discount_amount || '',
    'Currency': record.currency || '',
    
    // Article Information
    'SKU ID': record.sku_id || '',
    'Item Description': record.item_description || '',
    'Item Category': record.item_category || '',
    'Sub Category': record.sub_category || '',
    'Item Code': record.item_code || '',
    'HSN Code': record.hsn_code || '',
    'Quality Grade': record.quality_grade || '',
    'UOM': record.uom || '',
    'Packaging Type': record.packaging_type || '',
    'Quantity Units': record.quantity_units || '',
    'Net Weight': record.net_weight || '',
    'Total Weight': record.total_weight || '',
    'Batch Number': record.batch_number || '',
    'Lot Number': record.lot_number || '',
    'Manufacturing Date': record.manufacturing_date || '',
    'Expiry Date': record.expiry_date || '',
    'Import Date': record.import_date || '',
    'Unit Rate': record.unit_rate || '',
    'Article Total Amount': record.article_total_amount || '',
    'Article Tax Amount': record.article_tax_amount || '',
    'Article Discount Amount': record.article_discount_amount || '',
    
    // Box Information
    'Box Number': record.box_number || '',
    'Article Description': record.article_description || '',
    'Box Net Weight': record.box_net_weight || '',
    'Box Gross Weight': record.box_gross_weight || '',
    'Box Lot Number': record.box_lot_number || '',
    
    // Remarks
    'Remark': record.remark || ''
  }))
  
  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(excelData)
  
  // Set column widths for comprehensive data
  const columnWidths = [
    { wch: 10 }, // Company
    { wch: 15 }, // Transaction ID
    { wch: 12 }, // Entry Date
    { wch: 12 }, // System GRN Date
    { wch: 15 }, // Vehicle Number
    { wch: 20 }, // Transporter Name
    { wch: 12 }, // LR Number
    { wch: 15 }, // Source Location
    { wch: 15 }, // Destination Location
    { wch: 20 }, // Vendor/Supplier Name
    { wch: 20 }, // Customer/Party Name
    { wch: 15 }, // Purchase By
    { wch: 15 }, // Approval Authority
    { wch: 15 }, // Challan Number
    { wch: 15 }, // Invoice Number
    { wch: 12 }, // PO Number
    { wch: 12 }, // GRN Number
    { wch: 12 }, // GRN Quantity
    { wch: 12 }, // Received Quantity
    { wch: 12 }, // DN Number
    { wch: 15 }, // Service Invoice Number
    { wch: 12 }, // Total Amount
    { wch: 12 }, // Tax Amount
    { wch: 12 }, // Discount Amount
    { wch: 8 },  // Currency
    { wch: 8 },  // SKU ID
    { wch: 30 }, // Item Description
    { wch: 15 }, // Item Category
    { wch: 15 }, // Sub Category
    { wch: 12 }, // Item Code
    { wch: 12 }, // HSN Code
    { wch: 12 }, // Quality Grade
    { wch: 8 },  // UOM
    { wch: 15 }, // Packaging Type
    { wch: 12 }, // Quantity Units
    { wch: 12 }, // Net Weight
    { wch: 12 }, // Total Weight
    { wch: 12 }, // Batch Number
    { wch: 12 }, // Lot Number
    { wch: 12 }, // Manufacturing Date
    { wch: 12 }, // Expiry Date
    { wch: 12 }, // Import Date
    { wch: 12 }, // Unit Rate
    { wch: 15 }, // Article Total Amount
    { wch: 15 }, // Article Tax Amount
    { wch: 15 }, // Article Discount Amount
    { wch: 10 }, // Box Number
    { wch: 30 }, // Article Description
    { wch: 12 }, // Box Net Weight
    { wch: 12 }, // Box Gross Weight
    { wch: 12 }, // Box Lot Number
    { wch: 25 }  // Remark
  ]
  worksheet['!cols'] = columnWidths
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inward Records')
  
  // Generate filename
  const timestamp = new Date().toISOString().split('T')[0]
  const defaultFilename = `inward_records_${company}_${timestamp}.xlsx`
  const finalFilename = filename || defaultFilename
  
  // Write and download file
  XLSX.writeFile(workbook, finalFilename)
}

export function downloadInwardRecordsAsCSV(
  data: InwardExcelData[], 
  company: string,
  filename?: string
) {
  // Transform data for CSV format (similar to Excel but simpler)
  const csvData = data.map(record => {
    const maxItems = Math.max((record.item_descriptions || []).length, (record.quantities_and_uoms || []).length)
    
    if (maxItems === 0) {
      return {
        'Transaction ID': record.transaction_id,
        'Entry Date': record.entry_date,
        'Invoice Number': record.invoice_number || '',
        'PO Number': record.po_number || '',
        'Batch Number': record.batch_number || '',
        'Item Descriptions': '',
        'Quantities & UOMs': '',
        'Vendor/Supplier': record.vendor_supplier_name || '',
        'Customer/Party': record.customer_party_name || '',
        'Source Location': record.source_location || '',
        'Destination Location': record.destination_location || '',
        'Challan Number': record.challan_number || '',
        'GRN Number': record.grn_number || '',
        'GRN Quantity': record.grn_quantity || '',
        'Received Quantity': record.received_quantity || '',
        'Total Amount': record.total_amount || '',
        'Currency': record.currency || '',
        'Remark': record.remark || ''
      }
    }
    
    // For CSV, we'll combine multiple items into single row
    return {
      'Transaction ID': record.transaction_id,
      'Entry Date': record.entry_date,
      'Invoice Number': record.invoice_number || '',
      'PO Number': record.po_number || '',
      'Batch Number': record.batch_number || '',
      'Item Descriptions': (record.item_descriptions || []).join('; '),
      'Quantities & UOMs': (record.quantities_and_uoms || []).join('; '),
      'Vendor/Supplier': record.vendor_supplier_name || '',
      'Customer/Party': record.customer_party_name || '',
      'Source Location': record.source_location || '',
      'Destination Location': record.destination_location || '',
      'Challan Number': record.challan_number || '',
      'GRN Number': record.grn_number || '',
      'GRN Quantity': record.grn_quantity || '',
      'Received Quantity': record.received_quantity || '',
      'Total Amount': record.total_amount || '',
      'Currency': record.currency || '',
      'Remark': record.remark || ''
    }
  })
  
  // Convert to CSV
  const worksheet = XLSX.utils.json_to_sheet(csvData)
  const csv = XLSX.utils.sheet_to_csv(worksheet)
  
  // Create and download file
  const timestamp = new Date().toISOString().split('T')[0]
  const defaultFilename = `inward_records_${company}_${timestamp}.csv`
  const finalFilename = filename || defaultFilename
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', finalFilename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
