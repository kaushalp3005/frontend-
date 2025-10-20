// lib/validations/inwardForm.ts
import { z } from "zod"

// Base validation schemas
export const CompanySchema = z.enum(["CDPL", "CFPL", "JTC", "HOH"])

export const TransactionSchema = z.object({
  company: CompanySchema,
  transaction_no: z.string().min(1, "Transaction number is required"),
  entry_date: z.string().min(1, "Entry date is required"),
  vehicle_number: z.string().min(1, "Vehicle number is required"),
  transporter_name: z.string().min(1, "Transporter name is required"),
  lr_number: z.string().optional(),
  vendor_supplier_name: z.string().min(1, "Vendor/Supplier name is required"),
  customer_party_name: z.string().min(1, "Customer/Party name is required"),
  source_location: z.string().optional(),
  destination_location: z.string().optional(),
  challan_number: z.string().optional(),
  invoice_number: z.string().optional(),
  po_number: z.string().optional(),
  grn_number: z.string().optional(),
  grn_quantity: z.number().min(0, "GRN quantity cannot be negative"),
  system_grn_date: z.string().optional(),
  purchase_by: z.string().optional(),
  bill_submitted_to_account: z.boolean().optional(),
  grn_remark: z.string().optional(),
  process_type: z.string().optional(),
  service_remarks: z.string().optional(),
  service_invoice_number: z.string().optional(),
  dn_number: z.string().optional(),
  approval_authority: z.string().optional(),
  total_amount: z.number().min(0, "Total amount cannot be negative").optional(),
  tax_amount: z.number().min(0, "Tax amount cannot be negative").optional(),
  discount_amount: z.number().min(0, "Discount amount cannot be negative").optional(),
  received_quantity: z.number().min(0, "Received quantity cannot be negative"),
  return_reason_remark: z.string().optional(),
  remark: z.string().optional(),
  currency: z.string().default("INR")
})

export const ArticleSchema = z.object({
  id: z.string(),
  sku_id: z.number().positive("SKU ID must be positive").nullable(),
  item_category: z.string().min(1, "Item category is required"),
  sub_category: z.string().min(1, "Sub category is required"),
  item_description: z.string().min(1, "Item description is required"),
  quantity_units: z.number().positive("Quantity must be greater than 0"),
  packaging_type: z.string().optional(),
  uom: z.string().min(1, "UOM is required"),
  net_weight: z.number().positive("Net weight must be greater than 0"),
  total_weight: z.number().positive("Total weight must be greater than 0"),
  batch_number: z.string().optional(),
  lot_number: z.string().optional(),
  manufacturing_date: z.string().optional(),
  expiry_date: z.string().optional(),
  import_date: z.string().optional(),
  unit_rate: z.number().positive("Unit rate must be greater than 0"),
  total_amount: z.number().min(0, "Total amount cannot be negative").optional(),
  tax_amount: z.number().min(0, "Tax amount cannot be negative"),
  discount_amount: z.number().min(0, "Discount amount cannot be negative"),
  currency: z.string().default("INR")
})

export const BoxSchema = z.object({
  id: z.string(),
  box_number: z.number().positive("Box number must be positive"),
  article: z.string().min(1, "Article description is required"),
  net_weight: z.number().min(0, "Net weight cannot be negative"),
  gross_weight: z.number().min(0, "Gross weight cannot be negative"),
  lot_number: z.string().optional()
})

export const InwardFormSchema = z.object({
  company: CompanySchema,
  transaction: TransactionSchema,
  articles: z.array(ArticleSchema).min(1, "At least one article is required"),
  boxes: z.array(BoxSchema).optional()
})

// Validation error types
export interface ValidationError {
  field: string
  message: string
  code?: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  fieldErrors: Record<string, string>
}

// Enhanced validation functions
export class InwardFormValidator {
  /**
   * Validate the complete inward form
   */
  static validateForm(data: any): ValidationResult {
    try {
      InwardFormSchema.parse(data)
      return {
        isValid: true,
        errors: [],
        fieldErrors: {}
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: ValidationError[] = []
        const fieldErrors: Record<string, string> = {}

        error.errors.forEach((err) => {
          const field = err.path.join('.')
          const message = err.message
          
          errors.push({
            field,
            message,
            code: err.code
          })
          
          fieldErrors[field] = message
        })

        return {
          isValid: false,
          errors,
          fieldErrors
        }
      }

      return {
        isValid: false,
        errors: [{
          field: 'general',
          message: 'Unknown validation error occurred'
        }],
        fieldErrors: {}
      }
    }
  }

  /**
   * Validate individual transaction fields
   */
  static validateTransaction(transaction: any): ValidationResult {
    try {
      TransactionSchema.parse(transaction)
      return {
        isValid: true,
        errors: [],
        fieldErrors: {}
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: ValidationError[] = []
        const fieldErrors: Record<string, string> = {}

        error.errors.forEach((err) => {
          const field = `transaction.${err.path.join('.')}`
          const message = err.message
          
          errors.push({
            field,
            message,
            code: err.code
          })
          
          fieldErrors[field] = message
        })

        return {
          isValid: false,
          errors,
          fieldErrors
        }
      }

      return {
        isValid: false,
        errors: [{
          field: 'transaction',
          message: 'Transaction validation failed'
        }],
        fieldErrors: {}
      }
    }
  }

  /**
   * Validate individual article
   */
  static validateArticle(article: any, index: number): ValidationResult {
    try {
      ArticleSchema.parse(article)
      return {
        isValid: true,
        errors: [],
        fieldErrors: {}
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: ValidationError[] = []
        const fieldErrors: Record<string, string> = {}

        error.errors.forEach((err) => {
          const field = `article_${index}_${err.path.join('_')}`
          const message = err.message
          
          errors.push({
            field,
            message,
            code: err.code
          })
          
          fieldErrors[field] = message
        })

        return {
          isValid: false,
          errors,
          fieldErrors
        }
      }

      return {
        isValid: false,
        errors: [{
          field: `article_${index}`,
          message: 'Article validation failed'
        }],
        fieldErrors: {}
      }
    }
  }

  /**
   * Validate all articles
   */
  static validateArticles(articles: any[]): ValidationResult {
    const allErrors: ValidationError[] = []
    const allFieldErrors: Record<string, string> = {}

    articles.forEach((article, index) => {
      const result = this.validateArticle(article, index)
      if (!result.isValid) {
        allErrors.push(...result.errors)
        Object.assign(allFieldErrors, result.fieldErrors)
      }
    })

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      fieldErrors: allFieldErrors
    }
  }

  /**
   * Validate individual box
   */
  static validateBox(box: any, index: number): ValidationResult {
    try {
      BoxSchema.parse(box)
      return {
        isValid: true,
        errors: [],
        fieldErrors: {}
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: ValidationError[] = []
        const fieldErrors: Record<string, string> = {}

        error.errors.forEach((err) => {
          const field = `box_${index}_${err.path.join('_')}`
          const message = err.message
          
          errors.push({
            field,
            message,
            code: err.code
          })
          
          fieldErrors[field] = message
        })

        return {
          isValid: false,
          errors,
          fieldErrors
        }
      }

      return {
        isValid: false,
        errors: [{
          field: `box_${index}`,
          message: 'Box validation failed'
        }],
        fieldErrors: {}
      }
    }
  }

  /**
   * Validate all boxes
   */
  static validateBoxes(boxes: any[]): ValidationResult {
    const allErrors: ValidationError[] = []
    const allFieldErrors: Record<string, string> = {}

    boxes.forEach((box, index) => {
      const result = this.validateBox(box, index)
      if (!result.isValid) {
        allErrors.push(...result.errors)
        Object.assign(allFieldErrors, result.fieldErrors)
      }
    })

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      fieldErrors: allFieldErrors
    }
  }

  /**
   * Validate SKU ID resolution
   */
  static validateSkuId(skuId: number | null | undefined): ValidationResult {
    if (!skuId || skuId <= 0) {
      return {
        isValid: false,
        errors: [{
          field: 'sku_id',
          message: 'Valid SKU ID is required'
        }],
        fieldErrors: {
          sku_id: 'Valid SKU ID is required'
        }
      }
    }

    return {
      isValid: true,
      errors: [],
      fieldErrors: {}
    }
  }

  /**
   * Validate date formats
   */
  static validateDate(dateString: string, fieldName: string): ValidationResult {
    if (!dateString) {
      return {
        isValid: true,
        errors: [],
        fieldErrors: {}
      }
    }

    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return {
        isValid: false,
        errors: [{
          field: fieldName,
          message: 'Invalid date format'
        }],
        fieldErrors: {
          [fieldName]: 'Invalid date format'
        }
      }
    }

    return {
      isValid: true,
      errors: [],
      fieldErrors: {}
    }
  }

  /**
   * Validate numeric fields
   */
  static validateNumeric(value: any, fieldName: string, min?: number, max?: number): ValidationResult {
    const numValue = Number(value)
    
    if (isNaN(numValue)) {
      return {
        isValid: false,
        errors: [{
          field: fieldName,
          message: 'Must be a valid number'
        }],
        fieldErrors: {
          [fieldName]: 'Must be a valid number'
        }
      }
    }

    if (min !== undefined && numValue < min) {
      return {
        isValid: false,
        errors: [{
          field: fieldName,
          message: `Must be at least ${min}`
        }],
        fieldErrors: {
          [fieldName]: `Must be at least ${min}`
        }
      }
    }

    if (max !== undefined && numValue > max) {
      return {
        isValid: false,
        errors: [{
          field: fieldName,
          message: `Must be at most ${max}`
        }],
        fieldErrors: {
          [fieldName]: `Must be at most ${max}`
        }
      }
    }

    return {
      isValid: true,
      errors: [],
      fieldErrors: {}
    }
  }

  /**
   * Validate required fields
   */
  static validateRequired(value: any, fieldName: string): ValidationResult {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return {
        isValid: false,
        errors: [{
          field: fieldName,
          message: 'This field is required'
        }],
        fieldErrors: {
          [fieldName]: 'This field is required'
        }
      }
    }

    return {
      isValid: true,
      errors: [],
      fieldErrors: {}
    }
  }
}

// Export types
export type InwardFormData = z.infer<typeof InwardFormSchema>
export type TransactionData = z.infer<typeof TransactionSchema>
export type ArticleData = z.infer<typeof ArticleSchema>
export type BoxData = z.infer<typeof BoxSchema>
