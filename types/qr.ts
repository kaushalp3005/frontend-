// types/qr.ts
export interface QRPayload {
  company: string
  entry_date: string
  vendor_name: string
  customer_name: string
  item_description: string
  net_weight: number
  total_weight: number
  batch_number: string
  box_number: number
  manufacturing_date?: string
  expiry_date?: string
  transaction_no: string
  sku_id: number
  approval_authority?: string
}

export interface OutwardQRPayload {
  company_name: string
  consignment_no: string
  invoice_no: string
  po_no: string
  dispatch_date: string
  customer_name: string
  material_type: string
  item_category: string
  sub_category: string
  item_description: string
  pack_size_gm: number
  no_of_packets: number
  batch_number: string
  box_number: number
  article_name: string
  net_weight_gm: number
  gross_weight_gm: number
  approval_authority: string
  approval_status: string
  approval_date: string
  remark: string
}

export interface PrintDimensions {
  width: number
  height: number
  dpi: number
  unit?: 'inches' | 'mm' | 'cm'
}

export interface PrintData {
  type: 'qr_label' | 'barcode' | 'text'
  data: string // Base64 encoded image or text
  format: 'png' | 'jpeg' | 'svg' | 'text'
  dimensions: PrintDimensions
  box_info: {
    box_number: number
    article: string
    transaction_no: string
    company: string
  }
}

export interface QRGeneratorOptions {
  size?: number
  level?: 'L' | 'M' | 'Q' | 'H'
  margin?: number
  color?: {
    dark?: string
    light?: string
  }
  background?: string
  foreground?: string
}

export interface LabelTemplate {
  id: string
  name: string
  dimensions: PrintDimensions
  layout: 'horizontal' | 'vertical'
  sections: {
    qr: {
      position: 'left' | 'right' | 'top' | 'bottom'
      size: number
    }
    text: {
      position: 'left' | 'right' | 'top' | 'bottom'
      fields: string[]
      fontSize: number
      fontFamily: string
    }
  }
}

export interface PrintJob {
  id: string
  printerName: string
  data: PrintData
  status: 'pending' | 'printing' | 'completed' | 'failed'
  error?: string
  timestamp: Date
  retries: number
  maxRetries: number
}

export interface PrintResult {
  success: boolean
  error?: string
  jobId?: string
  printerName?: string
  timestamp?: Date
}

export interface PrinterStatus {
  name: string
  isOnline: boolean
  isDefault: boolean
  description: string
  capabilities: string[]
  lastUsed?: Date
}

export interface QRValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface QRCodeData {
  value: string
  size: number
  level: 'L' | 'M' | 'Q' | 'H'
  margin: number
  color: {
    dark: string
    light: string
  }
}

export interface LabelData {
  qrCode: QRCodeData
  text: {
    company: string
    transactionNo: string
    boxNumber: number
    skuId: number
    itemDescription: string
    netWeight: number
    grossWeight: number
    batchNumber: string
    manufacturingDate?: string
    expiryDate?: string
  }
  dimensions: PrintDimensions
}

export interface PrintService {
  printLabel: (printerName: string, qrPayload: QRPayload, dimensions: PrintDimensions) => Promise<PrintResult>
  getPrinters: () => Promise<PrinterStatus[]>
  getPrinterStatus: (printerName: string) => Promise<PrinterStatus>
  cancelPrintJob: (jobId: string) => Promise<boolean>
  getPrintQueue: () => Promise<PrintJob[]>
}

export interface QRGeneratorService {
  generateQRCode: (data: string, options?: QRGeneratorOptions) => Promise<string>
  generateLabelImage: (qrPayload: QRPayload, dimensions: PrintDimensions) => Promise<string>
  validateQRPayload: (payload: QRPayload) => QRValidationResult
  createQRData: (payload: QRPayload) => string
}

export interface ElectronAPI {
  printToDevice: (printerName: string, data: PrintData) => Promise<PrintResult>
  getPrinters: () => Promise<PrinterStatus[]>
  getPrinterStatus: (printerName: string) => Promise<PrinterStatus>
  cancelPrintJob: (jobId: string) => Promise<boolean>
  getPrintQueue: () => Promise<PrintJob[]>
}

export interface QRHookReturn {
  generateQRCode: (data: string, options?: QRGeneratorOptions) => Promise<string>
  generateLabelImage: (qrPayload: QRPayload, dimensions: PrintDimensions) => Promise<string>
  printLabel: (printerName: string, qrPayload: QRPayload, dimensions: PrintDimensions) => Promise<PrintResult>
  validateQRPayload: (payload: QRPayload) => QRValidationResult
  getPrinters: () => Promise<PrinterStatus[]>
  isElectronAvailable: boolean
  error: string | null
  loading: boolean
}

export interface PrintHookReturn {
  printers: PrinterStatus[]
  selectedPrinter: string | null
  setSelectedPrinter: (printer: string) => void
  printLabel: (qrPayload: QRPayload, dimensions: PrintDimensions) => Promise<PrintResult>
  printMultipleLabels: (qrPayloads: QRPayload[], dimensions: PrintDimensions) => Promise<PrintResult[]>
  loading: boolean
  error: string | null
  printQueue: PrintJob[]
  cancelJob: (jobId: string) => Promise<boolean>
}

export interface QRFormData {
  company: string
  transactionNo: string
  boxNumber: number
  skuId: number
  itemDescription: string
  netWeight: number
  grossWeight: number
  batchNumber: string
  manufacturingDate?: string
  expiryDate?: string
  vendorName: string
  customerName: string
  entryDate: string
}

export interface QRFormValidation {
  isValid: boolean
  errors: Record<string, string[]>
  warnings: Record<string, string[]>
}

export interface QRFormState {
  data: QRFormData
  validation: QRFormValidation
  isDirty: boolean
  isSubmitting: boolean
  lastGenerated: Date | null
}

export interface QRFormActions {
  updateField: (field: keyof QRFormData, value: any) => void
  validateField: (field: keyof QRFormData) => boolean
  validateForm: () => boolean
  generateQR: () => Promise<string>
  printLabel: (printerName: string) => Promise<PrintResult>
  resetForm: () => void
}

export interface QRFormHookReturn extends QRFormState, QRFormActions {
  // Additional methods
  generatePreview: () => Promise<string>
  exportQR: (format: 'png' | 'svg' | 'pdf') => Promise<Blob>
  importData: (data: Partial<QRFormData>) => void
}
