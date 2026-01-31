// types/inwardForm.ts
import { Company } from '@/lib/api'

// Base form data types
export interface InwardFormData {
  company: Company
  transaction_no: string
  entry_date: string
  vehicle_number: string
  transporter_name: string
  lr_number?: string
  vendor_supplier_name: string
  customer_party_name: string
  source_location?: string
  destination_location?: string
  challan_number?: string
  invoice_number?: string
  po_number?: string
  grn_number?: string
  grn_quantity: number
  system_grn_date?: string
  purchase_by?: string
  bill_submitted_to_account?: boolean
  grn_remark?: string
  process_type?: string
  service_remarks?: string
  service_invoice_number?: string
  dn_number?: string
  approval_authority?: string
  received_quantity: number
  return_reason_remark?: string
  remark?: string
}

export interface ArticleFormData {
  id: string
  sku_id?: number | null
  item_category: string
  sub_category: string
  item_description: string
  quantity_units: number
  packaging_type?: number
  uom: string
  net_weight: number
  total_weight: number
  batch_number: string
  lot_number?: string
  manufacturing_date?: string
  expiry_date?: string
  import_date?: string
  unit_rate: number
  total_amount: number
  tax_amount: number
  discount_amount: number
  currency: string
}

export interface BoxFormData {
  id: string
  box_number: number
  article: string
  net_weight: number
  gross_weight: number
  lot_number?: string
}

// Form state types
export interface InwardFormState {
  formData: InwardFormData
  articles: ArticleFormData[]
  boxes: BoxFormData[]
  errors: Record<string, string[]>
  warnings: Record<string, string[]>
  isDirty: boolean
  isSubmitting: boolean
  isPrinting: boolean
  lastSaved: Date | null
  printingBoxes: Set<string>
  printProgress: string
}

// Validation types
export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  fieldErrors: Record<string, string[]>
}

export interface FieldValidationResult {
  isValid: boolean
  error?: string
  warning?: string
}

// API types
export interface InwardFormApiResponse {
  success: boolean
  data?: any
  error?: string
  message?: string
}

export interface InwardFormCreateResponse extends InwardFormApiResponse {
  transactionNo?: string
  data?: InwardRecord
}

export interface InwardFormUpdateResponse extends InwardFormApiResponse {
  data?: InwardRecord
}

export interface InwardFormValidationResponse extends InwardFormApiResponse {
  isValid?: boolean
  errors?: string[]
  warnings?: string[]
  fieldErrors?: Record<string, string[]>
}

// Dropdown types
export interface DropdownOption {
  value: string
  label: string
  id?: number
  disabled?: boolean
}

export interface DropdownResponse {
  options: DropdownOption[]
  loading: boolean
  error: string | null
  search: (query: string) => void
}

export interface CustomerOption extends DropdownOption {
  id: number
  customer_name: string
}

export interface VendorOption extends DropdownOption {
  id: number
  vendor_name: string
  location?: string
}

// SKU resolution types
export interface SKUResolutionRequest {
  item_description: string
  item_category: string
  sub_category: string
  company: Company
}

export interface SKUResolutionResponse {
  sku_id: number
  success: boolean
  error?: string
}

// Printing types
export interface PrinterInfo {
  name: string
  description: string
  isDefault?: boolean
  status?: 'online' | 'offline' | 'error'
}

export interface PrintJob {
  id: string
  boxNumber: number
  status: 'pending' | 'printing' | 'completed' | 'failed'
  error?: string
  timestamp: Date
}

export interface PrintProgress {
  current: number
  total: number
  message: string
  boxNumber?: number
}

// Form actions types
export interface FormAction {
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'PRINT' | 'EXPORT' | 'IMPORT'
  payload?: any
  onSuccess?: (result: any) => void
  onError?: (error: Error) => void
}

export interface FormActionState {
  action: FormAction | null
  isExecuting: boolean
  result: any | null
  error: Error | null
}

// Error types
export interface FormError {
  field?: string
  message: string
  code?: string
  severity: 'error' | 'warning' | 'info'
}

export interface FormErrorState {
  errors: FormError[]
  hasErrors: boolean
  hasWarnings: boolean
}

// Loading states
export interface LoadingState {
  isLoading: boolean
  loadingMessage?: string
  progress?: number
}

export interface FormLoadingState {
  form: LoadingState
  articles: LoadingState
  boxes: LoadingState
  validation: LoadingState
  submission: LoadingState
  printing: LoadingState
}

// Event types
export interface FormEvent {
  type: 'CHANGE' | 'SUBMIT' | 'RESET' | 'VALIDATE' | 'PRINT' | 'ERROR'
  field?: string
  value?: any
  timestamp: Date
}

export interface FormEventHandler {
  (event: FormEvent): void
}

// Hook types
export interface UseInwardFormStateProps {
  company: Company
  initialData?: {
    formData: Partial<InwardFormData>
    articles: Partial<ArticleFormData>[]
    boxes: Partial<BoxFormData>[]
  }
  isEditMode?: boolean
  originalTransactionNo?: string
}

export interface UseInwardFormStateReturn {
  // Form state
  formData: InwardFormData
  articles: ArticleFormData[]
  boxes: BoxFormData[]
  errors: Record<string, string[]>
  warnings: Record<string, string[]>
  isDirty: boolean
  isSubmitting: boolean
  isPrinting: boolean
  lastSaved: Date | null
  
  // Form actions
  updateFormData: (field: keyof InwardFormData, value: any) => void
  addArticle: () => void
  removeArticle: (id: string) => void
  updateArticle: (id: string, field: keyof ArticleFormData, value: any) => void
  updateBox: (id: string, field: keyof BoxFormData, value: any) => void
  generateBoxes: (articlesToUse?: ArticleFormData[]) => void
  
  // Validation
  validateForm: () => boolean
  validateField: (field: string, value: any) => FieldValidationResult
  
  // Submission
  handleSaveOrUpdate: () => Promise<{ success: boolean; action?: 'created' | 'updated'; error?: string }>
  handleClearForm: () => void
  
  // Printing
  handlePrintBox: (box: BoxFormData) => Promise<void>
  handlePrintAllBoxes: () => Promise<void>
  printingBoxes: Set<string>
  printProgress: string
  
  // Printer management
  selectedPrinter: string | null
  setSelectedPrinter: (printer: string) => void
  printers: PrinterInfo[]
  printersLoading: boolean
  printersError: string | null
  
  // Dropdowns
  customerOptions: CustomerOption[]
  customersLoading: boolean
  customersError: string | null
  vendorOptions: VendorOption[]
  vendorsLoading: boolean
  vendorsError: string | null
}

// Component prop types
export interface InwardFormPageProps {
  company: Company
  isEditMode?: boolean
  transactionNo?: string
  onSuccess?: (result: any) => void
  onError?: (error: Error) => void
}

export interface InwardFormSidebarProps {
  formData: InwardFormData
  articles: ArticleFormData[]
  boxes: BoxFormData[]
  errors: Record<string, string[]>
  isSubmitting: boolean
  isDirty: boolean
  lastSaved: Date | null
  onSave: () => Promise<void>
  onReset: () => void
  onPreview?: () => void
  onPrintBox?: (box: BoxFormData) => Promise<void>
  onPrintAllBoxes?: () => Promise<void>
  onPreviewBox?: (box: BoxFormData) => Promise<void>
  printingBoxes: number[]
  isPrinting: boolean
  company: Company
}

export interface ArticleManagementProps {
  articles: ArticleFormData[]
  onAddArticle: () => void
  onRemoveArticle: (id: string) => void
  onUpdateArticle: (id: string, field: keyof ArticleFormData, value: any) => void
  company: Company
  errors?: Record<string, string>
}

export interface FormSubmissionWorkflowProps {
  formData: InwardFormData
  articles: ArticleFormData[]
  boxes: BoxFormData[]
  company: Company
  isEditMode?: boolean
  originalTransactionNo?: string
  onSuccess?: (result: { success: boolean; action?: 'created' | 'updated' }) => void
  onError?: (error: string) => void
}

// Utility types
export type FormField = keyof InwardFormData
export type ArticleField = keyof ArticleFormData
export type BoxField = keyof BoxFormData

export type FormValidationRule = {
  field: FormField
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  custom?: (value: any) => boolean
  message?: string
}

export type ArticleValidationRule = {
  field: ArticleField
  required?: boolean
  min?: number
  max?: number
  pattern?: RegExp
  custom?: (value: any) => boolean
  message?: string
}

export type BoxValidationRule = {
  field: BoxField
  required?: boolean
  min?: number
  max?: number
  pattern?: RegExp
  custom?: (value: any) => boolean
  message?: string
}

// Export all types
export type {
  InwardFormData,
  ArticleFormData,
  BoxFormData,
  InwardFormState,
  ValidationResult,
  FieldValidationResult,
  InwardFormApiResponse,
  InwardFormCreateResponse,
  InwardFormUpdateResponse,
  InwardFormValidationResponse,
  DropdownOption,
  DropdownResponse,
  CustomerOption,
  VendorOption,
  SKUResolutionRequest,
  SKUResolutionResponse,
  PrinterInfo,
  PrintJob,
  PrintProgress,
  FormAction,
  FormActionState,
  FormError,
  FormErrorState,
  LoadingState,
  FormLoadingState,
  FormEvent,
  FormEventHandler,
  UseInwardFormStateProps,
  UseInwardFormStateReturn,
  InwardFormPageProps,
  InwardFormSidebarProps,
  ArticleManagementProps,
  FormSubmissionWorkflowProps,
  FormField,
  ArticleField,
  BoxField,
  FormValidationRule,
  ArticleValidationRule,
  BoxValidationRule
}
