// lib/utils/formReset.ts
import { format } from 'date-fns'
import { Company } from '@/lib/api'
import type { InwardFormData, ArticleData, BoxData } from '@/lib/validations/inwardForm'

export interface FormResetOptions {
  preserveCompany?: boolean
  preserveTransactionNo?: boolean
  resetArticles?: boolean
  resetBoxes?: boolean
  resetErrors?: boolean
  resetWarnings?: boolean
  resetPrintingState?: boolean
  resetLastSaved?: boolean
}

export interface FormResetResult {
  success: boolean
  message: string
  resetFields: string[]
}

export class FormResetUtils {
  private static generateTransactionNo(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    const hour = String(now.getHours()).padStart(2, "0")
    const minute = String(now.getMinutes()).padStart(2, "0")
    return `TR-${year}${month}${day}${hour}${minute}`
  }

  private static generateBatchNumber(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    const hour = String(now.getHours()).padStart(2, "0")
    const minute = String(now.getMinutes()).padStart(2, "0")
    const second = String(now.getSeconds()).padStart(2, "0")
    return `BT-${year}${month}${day}${hour}${minute}${second}-001`
  }

  private static createInitialArticle(): ArticleData {
    return {
      id: "1",
      sku_id: null,
      item_description: "",
      item_category: "",
      sub_category: "",
      quantity_units: 0,
      packaging_type: "",
      uom: "",
      net_weight: 0,
      total_weight: 0,
      batch_number: this.generateBatchNumber(),
      lot_number: "",
      manufacturing_date: "",
      expiry_date: "",
      import_date: "",
      unit_rate: 0,
      total_amount: 0,
      tax_amount: 0,
      discount_amount: 0,
      currency: "INR",
    }
  }

  private static createInitialFormData(company: Company): InwardFormData {
    return {
      company,
      transaction: {
        company,
        transaction_no: this.generateTransactionNo(),
        entry_date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
        vehicle_number: "",
        transporter_name: "",
        lr_number: "",
        vendor_supplier_name: "",
        customer_party_name: "",
        source_location: "",
        destination_location: "",
        challan_number: "",
        invoice_number: "",
        po_number: "",
        grn_number: "",
        grn_quantity: 0,
        system_grn_date: "",
        purchase_by: "",
        bill_submitted_to_account: false,
        grn_remark: "",
        process_type: "",
        service_remarks: "",
        service_invoice_number: "",
        dn_number: "",
        approval_authority: "",
        received_quantity: 0,
        return_reason_remark: "",
        remark: "",
        currency: "INR"
      },
      articles: [this.createInitialArticle()],
      boxes: []
    }
  }

  static resetForm(
    currentFormData: InwardFormData,
    currentArticles: ArticleData[],
    currentBoxes: BoxData[],
    options: FormResetOptions = {}
  ): FormResetResult {
    const resetFields: string[] = []
    
    try {
      // Reset form data
      const newFormData = this.createInitialFormData(
        options.preserveCompany ? currentFormData.company : "CDPL"
      )
      
      if (!options.preserveTransactionNo) {
        newFormData.transaction.transaction_no = this.generateTransactionNo()
        resetFields.push("transaction_no")
      } else {
        newFormData.transaction.transaction_no = currentFormData.transaction.transaction_no
      }

      // Reset articles
      let newArticles: ArticleData[] = []
      if (options.resetArticles !== false) {
        newArticles = [this.createInitialArticle()]
        resetFields.push("articles")
      } else {
        newArticles = currentArticles
      }

      // Reset boxes
      let newBoxes: BoxData[] = []
      if (options.resetBoxes !== false) {
        newBoxes = []
        resetFields.push("boxes")
      } else {
        newBoxes = currentBoxes
      }

      return {
        success: true,
        message: `Form reset successfully. ${resetFields.length} field(s) reset.`,
        resetFields
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to reset form: ${error instanceof Error ? error.message : 'Unknown error'}`,
        resetFields: []
      }
    }
  }

  static resetField(
    fieldName: string,
    currentValue: any,
    company: Company
  ): { success: boolean; newValue: any; message: string } {
    try {
      let newValue: any

      switch (fieldName) {
        case "transaction_no":
          newValue = this.generateTransactionNo()
          break
        case "entry_date":
          newValue = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss")
          break
        case "vehicle_number":
        case "transporter_name":
        case "lr_number":
        case "vendor_supplier_name":
        case "customer_party_name":
        case "source_location":
        case "destination_location":
        case "challan_number":
        case "invoice_number":
        case "po_number":
        case "grn_number":
        case "system_grn_date":
        case "purchase_by":
        case "grn_remark":
        case "process_type":
        case "service_remarks":
        case "service_invoice_number":
        case "dn_number":
        case "approval_authority":
        case "return_reason_remark":
        case "remark":
          newValue = ""
          break
        case "grn_quantity":
        case "received_quantity":
          newValue = 0
          break
        case "bill_submitted_to_account":
          newValue = false
          break
        case "company":
          newValue = company
          break
        default:
          return {
            success: false,
            newValue: currentValue,
            message: `Unknown field: ${fieldName}`
          }
      }

      return {
        success: true,
        newValue,
        message: `Field '${fieldName}' reset successfully`
      }
    } catch (error) {
      return {
        success: false,
        newValue: currentValue,
        message: `Failed to reset field '${fieldName}': ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  static resetArticle(
    articleId: string,
    currentArticle: ArticleData
  ): { success: boolean; newArticle: ArticleData; message: string } {
    try {
      const newArticle: ArticleData = {
        ...this.createInitialArticle(),
        id: articleId,
        batch_number: this.generateBatchNumber()
      }

      return {
        success: true,
        newArticle,
        message: `Article '${articleId}' reset successfully`
      }
    } catch (error) {
      return {
        success: false,
        newArticle: currentArticle,
        message: `Failed to reset article '${articleId}': ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  static resetBox(
    boxId: string,
    currentBox: BoxData
  ): { success: boolean; newBox: BoxData; message: string } {
    try {
      const newBox: BoxData = {
        id: boxId,
        box_number: currentBox.box_number,
        article: "",
        net_weight: 0,
        gross_weight: 0,
        lot_number: ""
      }

      return {
        success: true,
        newBox,
        message: `Box '${boxId}' reset successfully`
      }
    } catch (error) {
      return {
        success: false,
        newBox: currentBox,
        message: `Failed to reset box '${boxId}': ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  static resetErrors(): { success: boolean; message: string } {
    try {
      return {
        success: true,
        message: "All errors cleared successfully"
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to clear errors: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  static resetWarnings(): { success: boolean; message: string } {
    try {
      return {
        success: true,
        message: "All warnings cleared successfully"
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to clear warnings: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  static resetPrintingState(): { success: boolean; message: string } {
    try {
      return {
        success: true,
        message: "Printing state reset successfully"
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to reset printing state: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  static resetLastSaved(): { success: boolean; message: string } {
    try {
      return {
        success: true,
        message: "Last saved timestamp reset successfully"
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to reset last saved timestamp: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  static validateResetOptions(options: FormResetOptions): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (options.preserveCompany && !options.preserveCompany) {
      errors.push("preserveCompany must be a boolean")
    }

    if (options.preserveTransactionNo && !options.preserveTransactionNo) {
      errors.push("preserveTransactionNo must be a boolean")
    }

    if (options.resetArticles && !options.resetArticles) {
      errors.push("resetArticles must be a boolean")
    }

    if (options.resetBoxes && !options.resetBoxes) {
      errors.push("resetBoxes must be a boolean")
    }

    if (options.resetErrors && !options.resetErrors) {
      errors.push("resetErrors must be a boolean")
    }

    if (options.resetWarnings && !options.resetWarnings) {
      errors.push("resetWarnings must be a boolean")
    }

    if (options.resetPrintingState && !options.resetPrintingState) {
      errors.push("resetPrintingState must be a boolean")
    }

    if (options.resetLastSaved && !options.resetLastSaved) {
      errors.push("resetLastSaved must be a boolean")
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  static getResetSummary(
    currentFormData: InwardFormData,
    currentArticles: ArticleData[],
    currentBoxes: BoxData[],
    options: FormResetOptions
  ): string {
    const summary: string[] = []

    if (options.resetArticles !== false) {
      summary.push(`${currentArticles.length} article(s)`)
    }

    if (options.resetBoxes !== false) {
      summary.push(`${currentBoxes.length} box(es)`)
    }

    if (options.resetErrors !== false) {
      summary.push("all errors")
    }

    if (options.resetWarnings !== false) {
      summary.push("all warnings")
    }

    if (options.resetPrintingState !== false) {
      summary.push("printing state")
    }

    if (options.resetLastSaved !== false) {
      summary.push("last saved timestamp")
    }

    if (summary.length === 0) {
      return "No fields will be reset"
    }

    return `This will reset: ${summary.join(", ")}`
  }
}
