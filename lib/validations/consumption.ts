// File: consumption.ts
// Path: frontend/src/lib/validations/consumption.ts

import { z } from "zod"

// Material Type enum
export const MaterialTypeSchema = z.enum(["RM", "PM", "SFG", "FG"])

// Job Card Status enum
export const JobCardStatusSchema = z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])

// Priority enum
export const PrioritySchema = z.enum(["HIGH", "NORMAL", "LOW"])

// QC Status enum
export const QCStatusSchema = z.enum(["HOLD", "RELEASE", "REJECT"])

// Valuation Method enum
export const ValuationMethodSchema = z.enum(["FIFO", "LIFO", "AVERAGE"])

// Consumption Line Schema
export const ConsumptionLineSchema = z.object({
  sku_id: z.string().min(1, "SKU ID is required"),
  material_type: MaterialTypeSchema,
  uom: z.string().min(1, "UOM is required"),
  qty_issued: z.number().positive("Quantity must be positive"),
  lot_no: z.string().min(1, "Lot number is required"),
  batch_no: z.string().min(1, "Batch number is required")
})

// Consumption Request Schema
export const ConsumptionRequestSchema = z.object({
  job_card_no: z.string().min(1, "Job card number is required"),
  warehouse: z.string().min(1, "Warehouse is required"),
  lines: z.array(ConsumptionLineSchema).min(1, "At least one consumption line is required"),
  remarks: z.string().optional()
})

// Production Receipt Line Schema
export const ProductionReceiptLineSchema = z.object({
  sku_id: z.string().min(1, "SKU ID is required"),
  uom: z.string().min(1, "UOM is required"),
  qty_produced: z.number().positive("Quantity must be positive"),
  batch_no: z.string().min(1, "Batch number is required"),
  lot_no: z.string().min(1, "Lot number is required"),
  yield_pct: z.number().min(0).max(100, "Yield percentage must be between 0 and 100"),
  scrap_qty: z.number().min(0, "Scrap quantity must be non-negative")
})

// Production Receipt Request Schema
export const ProductionReceiptRequestSchema = z.object({
  job_card_no: z.string().min(1, "Job card number is required"),
  output_type: MaterialTypeSchema,
  to_warehouse: z.string().min(1, "Destination warehouse is required"),
  qc_required: z.boolean(),
  lines: z.array(ProductionReceiptLineSchema).min(1, "At least one production line is required")
})

// Transfer Line Schema
export const TransferLineSchema = z.object({
  sku_id: z.string().min(1, "SKU ID is required"),
  uom: z.string().min(1, "UOM is required"),
  qty: z.number().positive("Quantity must be positive"),
  lot_no: z.string().min(1, "Lot number is required"),
  batch_no: z.string().min(1, "Batch number is required")
})

// Transfer Request Schema
export const TransferRequestSchema = z.object({
  source_warehouse: z.string().min(1, "Source warehouse is required"),
  destination_warehouse: z.string().min(1, "Destination warehouse is required"),
  lines: z.array(TransferLineSchema).min(1, "At least one transfer line is required")
}).refine(data => data.source_warehouse !== data.destination_warehouse, {
  message: "Source and destination warehouses must be different",
  path: ["destination_warehouse"]
})

// Dispatch Line Schema
export const DispatchLineSchema = z.object({
  sku_id: z.string().min(1, "SKU ID is required"),
  uom: z.string().min(1, "UOM is required"),
  qty: z.number().positive("Quantity must be positive"),
  lot_no: z.string().min(1, "Lot number is required"),
  batch_no: z.string().min(1, "Batch number is required")
})

// Dispatch Request Schema
export const DispatchRequestSchema = z.object({
  warehouse: z.string().min(1, "Warehouse is required"),
  so_no: z.string().min(1, "Sales order number is required"),
  lines: z.array(DispatchLineSchema).min(1, "At least one dispatch line is required")
})

// Create Job Card Request Schema
export const CreateJobCardRequestSchema = z.object({
  job_card_no: z.string().min(1, "Job card number is required"),
  sku_id: z.string().min(1, "SKU ID is required"),
  bom_id: z.string().min(1, "BOM ID is required"),
  planned_qty: z.number().positive("Planned quantity must be positive"),
  uom: z.string().min(1, "UOM is required"),
  status: JobCardStatusSchema,
  priority: PrioritySchema,
  due_date: z.string().min(1, "Due date is required"),
  production_line: z.string().min(1, "Production line is required"),
  shift: z.string().min(1, "Shift is required"),
  remarks: z.string().optional(),
  created_by: z.string().min(1, "Created by is required")
})

// Scanner Resolve Request Schema
export const ScannerResolveRequestSchema = z.object({
  scan_value: z.string().min(1, "Scan value is required"),
  warehouse: z.string().min(1, "Warehouse is required")
})

// QC Release Request Schema
export const QCReleaseRequestSchema = z.object({
  qc_hold_id: z.string().min(1, "QC hold ID is required"),
  qc_status: QCStatusSchema,
  qc_remarks: z.string().optional(),
  qc_by: z.string().min(1, "QC by is required")
})

// System Config Schema
export const SystemConfigSchema = z.object({
  valuation_method: ValuationMethodSchema,
  variance_threshold_pct: z.number().min(0).max(100, "Variance threshold must be between 0 and 100"),
  fifo_expiry_days: z.number().min(0, "FIFO expiry days must be non-negative"),
  auto_ledger_calculation: z.boolean(),
  qc_hold_duration_hours: z.number().min(0, "QC hold duration must be non-negative")
})

// Ledger Request Schema
export const LedgerRequestSchema = z.object({
  date: z.string().optional(),
  warehouse: z.string().optional(),
  sku_id: z.string().optional(),
  material_type: MaterialTypeSchema.optional()
})

// Ledger Range Request Schema
export const LedgerRangeRequestSchema = z.object({
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  warehouse: z.string().optional(),
  sku_id: z.string().optional(),
  material_type: MaterialTypeSchema.optional(),
  page: z.number().min(1).optional(),
  per_page: z.number().min(1).max(100).optional()
})

// Job Card Request Schema
export const JobCardRequestSchema = z.object({
  status: JobCardStatusSchema.optional(),
  priority: PrioritySchema.optional(),
  due_date_from: z.string().optional(),
  due_date_to: z.string().optional(),
  sku_id: z.string().optional(),
  page: z.number().min(1).optional(),
  per_page: z.number().min(1).max(100).optional()
})

// SKU Request Schema
export const SKURequestSchema = z.object({
  page: z.number().min(1).optional(),
  per_page: z.number().min(1).max(100).optional(),
  material_type: MaterialTypeSchema.optional(),
  search: z.string().optional(),
  is_active: z.boolean().optional()
})

// Warehouse Request Schema
export const WarehouseRequestSchema = z.object({
  page: z.number().min(1).optional(),
  per_page: z.number().min(1).max(100).optional(),
  sitecode: z.string().optional(),
  warehouse_type: z.enum(["STORAGE", "QC_HOLD", "PUTAWAY"]).optional(),
  is_active: z.boolean().optional()
})

// BOM Request Schema
export const BOMRequestSchema = z.object({
  page: z.number().min(1).optional(),
  per_page: z.number().min(1).max(100).optional(),
  output_sku_id: z.string().optional(),
  is_active: z.boolean().optional()
})

// FIFO Layers Request Schema
export const FIFOLayersRequestSchema = z.object({
  warehouse: z.string().min(1, "Warehouse is required"),
  item_id: z.string().min(1, "Item ID is required"),
  lot: z.string().optional(),
  batch: z.string().optional()
})

// QC Holds Request Schema
export const QCHoldsRequestSchema = z.object({
  warehouse: z.string().optional(),
  status: QCStatusSchema.optional(),
  item_id: z.string().optional(),
  page: z.number().min(1).optional(),
  per_page: z.number().min(1).max(100).optional()
})

// Transfer History Request Schema
export const TransferHistoryRequestSchema = z.object({
  source_warehouse: z.string().optional(),
  destination_warehouse: z.string().optional(),
  sku_id: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  page: z.number().min(1).optional(),
  per_page: z.number().min(1).max(100).optional()
})

// Export all schemas
export {
  MaterialTypeSchema as MaterialType,
  JobCardStatusSchema as JobCardStatus,
  PrioritySchema as Priority,
  QCStatusSchema as QCStatus,
  ValuationMethodSchema as ValuationMethod
}
