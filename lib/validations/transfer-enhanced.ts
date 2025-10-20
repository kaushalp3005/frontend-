import type { Company } from "@/types/auth"
// Updated to fix TypeScript cache issues

export type SourceLocation = "W202" | "A185" | "A101" | "A68" | "F53"
export type DestinationLocation = "W202" | "A185" | "A101" | "A68" | "F53" | "Savla" | "Rishi"
export type SiteCode = SourceLocation | DestinationLocation

// Inter-Unit Movement Types - ENHANCED VERSION
// Status workflow: Draft/Pending → Approved → Dispatched → Received → Closed
// Can be Cancelled from any status except Closed
export type InterUnitStatus = 
  | "Draft"        // Initial draft state
  | "Pending"      // Awaiting approval
  | "Approved"     // Approved, ready for dispatch
  | "Accept"       // Accepted status
  | "Confirm"      // Confirmed by authority (dispatched)
  | "Dispatched"   // Dispatched from source
  | "Received"     // Received at destination
  | "Closed"       // Completed
  | "Cancelled"    // Cancelled
export type RmPmFgType = "RM" | "PM" | "FG" | "RTV"
export type ReasonCode = 
  | "Production_Transfer" 
  | "Quality_Issue" 
  | "Excess_Stock" 
  | "Customer_Requirement" 
  | "Maintenance" 
  | "RTV" 
  | "Other"
  | "Stock_Adjustment"
  | "Emergency_Transfer"
  | "Seasonal_Transfer"
  | "Quality_Transfer"
  | "Maintenance_Transfer"

// Standard UOMs allowed in system
export const ALLOWED_UOMS = [
  "KG", "GM", "PCS", "CTN", "BOX", "PKT", "LTR", "ML", "MTR", "CM", "SQM", "SQF", "TON", "QTL"
] as const

export type UOM = typeof ALLOWED_UOMS[number]

export interface InterUnitHeaderEnhanced {
  id: string
  stock_trf_date: string // ISO date - Stock Trf Date (required, not future unless admin override)
  from_site: string // Source site (required, default from session if available)
  to_site: string // Sent to Factory (required, must differ from from_site)
  challan_no: string // Challan No (format: TRANSYYYYMMDDHHMM)
  vehicle_no: string // Vehicle no. (required, lenient Indian plate regex)
  remark: string // Reason Description (required)
  reason_code: ReasonCode // Reason goods movement (required, enum)
  status: InterUnitStatus
  
  // Audit fields
  created_by: string
  created_ts: string
  approved_by?: string
  approved_ts?: string
  dispatch_ts?: string
  receive_ts?: string
  updated_ts: string
}

export interface InterUnitLineEnhanced {
  id: string
  header_id: string
  
  // Item Master Integration
  rm_pm_fg_type: RmPmFgType // RM/PM/FG type (required)
  item_category?: string // Commodity Category (from item master)
  sub_category?: string // Sub-category (from item master)
  item_desc_raw: string // RM/PM/FG Description (required, with typeahead)
  item_id?: number // SKU ID from item master (optional mapping)
  hsn_code?: string // HSN code from item master
  
  // Packaging
  pack_size?: number // Pack Size (optional)
  packaging_type?: number // Packaging Type from item master
  
  // Quantity
  qty: number // Challan Qty (required, > 0)
  uom: UOM // UOM (required, restricted to allowed UOMs)
  
  // Weight tracking (mandatory)
  net_weight: number
  total_weight: number
  
  // Batch/Lot tracking
  batch_number: string // Required
  lot_number?: string
  
  // Receive fields (filled during receive workflow)
  received_qty?: number // Received quantity (filled on receive)
  variance?: number // Computed: received_qty - qty
  variance_remark?: string // Optional remark for variance
}

export interface InterUnitChallanEnhanced {
  header: InterUnitHeaderEnhanced
  lines: InterUnitLineEnhanced[]
}

// Input type for creating/updating challans
export interface InterUnitChallanInputEnhanced {
  header: {
    stock_trf_date: string
    from_site: string
    to_site: string
    vehicle_no: string // Required
    remark: string // Required
    reason_code: ReasonCode
  }
  lines: {
    rm_pm_fg_type: RmPmFgType
    item_category: string // Required
    sub_category: string // Required
    item_desc_raw: string
    item_id?: number
    hsn_code?: string
    pack_size?: number
    packaging_type?: number
    qty: number
    uom: UOM
    net_weight: number // Required
    total_weight: number // Required
    batch_number: string // Required
    lot_number?: string
  }[]
}

export interface InterUnitReceiveLineEnhanced {
  line_id: string
  received_qty: number
  variance_remark?: string
}

export interface InterUnitListItemEnhanced {
  id: string
  stock_trf_date: string
  from_site: string
  to_site: string
  status: InterUnitStatus
  challan_no: string
  lines_count: number
  qty_total: number
  vehicle_no?: string
  reason_code: ReasonCode
  created_by: string
  has_variance?: boolean // Indicates if any line has variance
  request_id?: number // ID of the request this transfer was created from
}

export interface InterUnitFiltersEnhanced {
  date_from?: string
  date_to?: string
  from_site?: string
  to_site?: string
  challan_no?: string
  status?: InterUnitStatus
  item_category?: string
  item_description?: string
  batch_number?: string
}

// Item Master lookup result
export interface ItemMasterResult {
  id: number
  item_description: string
  item_category?: string
  sub_category?: string
  hsn_code?: string
  uom?: UOM
  packaging_type?: string
  // Add other fields as needed
}

// Request Line - used for creating requests (before approval)
export interface InterUnitRequestLine {
  id?: string
  header_id?: string
  
  // Item Master Integration
  rm_pm_fg_type: RmPmFgType
  item_category?: string
  sub_category?: string
  item_desc_raw: string
  item_id?: number
  hsn_code?: string
  
  // Packaging
  pack_size?: number
  packaging_type?: number
  
  // Quantity
  qty: number
  uom: UOM
  
  // Weight tracking (mandatory)
  net_weight: number
  total_weight: number
  
  // Batch/Lot tracking
  batch_number: string
  lot_number?: string
}

// Transfer Line - used for approved transfers (after approval)
export interface InterUnitTransferLine {
  id: string
  header_id: string
  
  // Item Master Integration
  rm_pm_fg_type: RmPmFgType
  item_category?: string
  sub_category?: string
  item_desc_raw: string
  item_id?: number
  hsn_code?: string
  
  // Packaging
  pack_size?: number
  packaging_type?: number
  
  // Quantity
  qty: number
  uom: UOM
  
  // Weight tracking (mandatory)
  net_weight: number
  total_weight: number
  
  // Batch/Lot tracking
  batch_number: string
  lot_number?: string
  
  // Receive fields (filled during receive workflow)
  received_qty?: number
  variance?: number
  variance_remark?: string
}

// Status Badge Props for UI components
export interface StatusBadgeProps {
  status: InterUnitStatus
  size?: "sm" | "md" | "lg"
  className?: string
}

// Zod validation schemas
import { z } from "zod"

export const interUnitChallanEnhancedSchema = z.object({
  header: z.object({
    stock_trf_date: z.string().min(1, "Stock transfer date is required"),
    from_site: z.string().min(1, "From site is required"),
    to_site: z.string().min(1, "To site is required"),
    vehicle_no: z.string().min(1, "Vehicle number is required"),
    remark: z.string().min(1, "Remark is required"),
    reason_code: z.enum([
      "Production_Transfer",
      "Quality_Issue", 
      "Excess_Stock",
      "Customer_Requirement",
      "Maintenance",
      "RTV",
      "Other",
      "Stock_Adjustment",
      "Emergency_Transfer",
      "Seasonal_Transfer",
      "Quality_Transfer",
      "Maintenance_Transfer"
    ])
  }),
  lines: z.array(z.object({
    rm_pm_fg_type: z.enum(["RM", "PM", "FG", "RTV"]),
    item_category: z.string().min(1, "Item category is required"),
    sub_category: z.string().min(1, "Sub category is required"),
    item_desc_raw: z.string().min(1, "Item description is required"),
    item_id: z.number().optional(),
    hsn_code: z.string().optional(),
    pack_size: z.number().optional(),
    packaging_type: z.number().optional(),
    qty: z.number().min(0.01, "Quantity must be greater than 0"),
    uom: z.enum(["KG", "GM", "PCS", "CTN", "BOX", "PKT", "LTR", "ML", "MTR", "CM", "SQM", "SQF", "TON", "QTL"]),
    net_weight: z.number().min(0, "Net weight must be 0 or greater"),
    total_weight: z.number().min(0, "Total weight must be 0 or greater"),
    batch_number: z.string().min(1, "Batch number is required"),
    lot_number: z.string().optional()
  })).min(1, "At least one line item is required")
})


