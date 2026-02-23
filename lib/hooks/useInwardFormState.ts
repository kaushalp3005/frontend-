// lib/hooks/useInwardFormState.ts
"use client"

import { useCallback, useState, useEffect } from "react"
import { format } from "date-fns"
import { InwardFormUtils } from "@/lib/utils/inwardFormUtils"
import { InwardFormValidator, type ValidationResult } from "@/lib/validations/inwardForm"
import { useBoxManagement } from "./useBoxManagement"
import { usePrinting } from "./usePrinters"
import type { Company } from "@/types/inward"

export interface Article {
  id: string
  sku_id?: number | null
  item_category: string
  sub_category: string
  item_description: string
  quantity_units: number
  packaging_type: string
  uom: string
  net_weight: number
  total_weight: number
  batch_number: string
  lot_number: string
  manufacturing_date: string
  expiry_date: string
  import_date: string
  unit_rate: number
  total_amount: number
  tax_amount: number
  discount_amount: number
  currency: string
}

export interface FormData {
  company: Company
  transaction_no: string
  entry_date: string
  vehicle_number: string
  transporter_name: string
  lr_number: string
  vendor_supplier_name: string
  customer_party_name: string
  source_location: string
  destination_location: string
  challan_number: string
  invoice_number: string
  po_number: string
  grn_number: string
  grn_quantity: number
  system_grn_date: string
  purchase_by: string
  bill_submitted_to_account: boolean
  grn_remark: string
  process_type: string
  service_remarks: string
  service_invoice_number: string
  dn_number: string
  approval_authority: string
  received_quantity: number
  return_reason_remark: string
  remark: string
}

export interface FormState {
  formData: FormData
  articles: Article[]
  errors: Record<string, string | undefined>
  isSubmitting: boolean
  isDirty: boolean
  lastSaved: Date | null
}

/**
 * Comprehensive hook for inward form state management
 */
export function useInwardFormState(company: Company) {
  const [state, setState] = useState<FormState>({
    formData: {
      company,
      transaction_no: InwardFormUtils.generateTransactionNo(),
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
    },
    articles: [{
      id: "1",
      sku_id: null,
      item_category: "",
      sub_category: "",
      item_description: "",
      quantity_units: 0,
      packaging_type: "",
      uom: "",
      net_weight: 0,
      total_weight: 0,
      batch_number: InwardFormUtils.generateBatchNumber(),
      lot_number: "",
      manufacturing_date: "",
      expiry_date: "",
      import_date: "",
      unit_rate: 0,
      total_amount: 0,
      tax_amount: 0,
      discount_amount: 0,
      currency: "INR",
    }],
    errors: {},
    isSubmitting: false,
    isDirty: false,
    lastSaved: null
  })

  // Box management
  const boxManagement = useBoxManagement()
  
  // Printing state
  const printing = usePrinting()

  /**
   * Update form data field
   */
  const updateFormData = useCallback((field: keyof FormData, value: any) => {
    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, [field]: value },
      isDirty: true,
      errors: { ...prev.errors, [field]: undefined } // Clear field error
    }))
  }, [])

  /**
   * Update multiple form data fields
   */
  const updateFormDataFields = useCallback((updates: Partial<FormData>) => {
    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, ...updates },
      isDirty: true,
      errors: Object.keys(updates).reduce((acc, key) => {
        acc[key] = undefined
        return acc
      }, { ...prev.errors })
    }))
  }, [])

  /**
   * Add a new article
   */
  const addArticle = useCallback(() => {
    const newArticle: Article = {
      id: Date.now().toString(),
      sku_id: null,
      item_category: "",
      sub_category: "",
      item_description: "",
      quantity_units: 0,
      packaging_type: "",
      uom: "",
      net_weight: 0,
      total_weight: 0,
      batch_number: InwardFormUtils.generateBatchNumber(),
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

    setState(prev => ({
      ...prev,
      articles: [...prev.articles, newArticle],
      isDirty: true
    }))

    // Regenerate boxes
    boxManagement.generateBoxes([...state.articles, newArticle])
  }, [state.articles, boxManagement])

  /**
   * Remove an article
   */
  const removeArticle = useCallback((id: string) => {
    if (state.articles.length <= 1) {
      return // Don't allow removing the last article
    }

    const updatedArticles = state.articles.filter(article => article.id !== id)
    setState(prev => ({
      ...prev,
      articles: updatedArticles,
      isDirty: true
    }))

    // Regenerate boxes
    boxManagement.generateBoxes(updatedArticles)
  }, [state.articles, boxManagement])

  /**
   * Update article field
   */
  const updateArticle = useCallback((id: string, field: keyof Article, value: any) => {
    setState(prev => {
      const updatedArticles = prev.articles.map(article => {
        if (article.id === id) {
          const updatedArticle = { ...article, [field]: value }
          
          // Handle dependent field updates
          if (field === "item_category") {
            updatedArticle.sub_category = ""
            updatedArticle.item_description = ""
            updatedArticle.sku_id = null
          }
          if (field === "sub_category") {
            updatedArticle.item_description = ""
            updatedArticle.sku_id = null
          }
          if (field === "unit_rate" || field === "quantity_units") {
            updatedArticle.total_amount = (Number(updatedArticle.unit_rate) || 0) * (Number(updatedArticle.quantity_units) || 0)
          }
          
          return updatedArticle
        }
        return article
      })

      return {
        ...prev,
        articles: updatedArticles,
        isDirty: true,
        errors: { ...prev.errors, [`article_${id}_${field}`]: undefined } // Clear field error
      }
    })

    // Regenerate boxes if relevant fields changed
    if (field === "quantity_units" || field === "uom" || field === "item_description" || field === "lot_number") {
      const updatedArticles = state.articles.map(article => 
        article.id === id ? { ...article, [field]: value } : article
      )
      boxManagement.generateBoxes(updatedArticles)
    }
  }, [state.articles, boxManagement])

  /**
   * Update multiple article fields
   */
  const updateArticleFields = useCallback((id: string, updates: Partial<Article>) => {
    setState(prev => {
      const updatedArticles = prev.articles.map(article => {
        if (article.id === id) {
          const updatedArticle = { ...article, ...updates }
          
          // Handle dependent field updates
          if (updates.item_category) {
            updatedArticle.sub_category = ""
            updatedArticle.item_description = ""
            updatedArticle.sku_id = null
          }
          if (updates.sub_category) {
            updatedArticle.item_description = ""
            updatedArticle.sku_id = null
          }
          if (updates.unit_rate || updates.quantity_units) {
            updatedArticle.total_amount = (Number(updatedArticle.unit_rate) || 0) * (Number(updatedArticle.quantity_units) || 0)
          }
          
          return updatedArticle
        }
        return article
      })

      return {
        ...prev,
        articles: updatedArticles,
        isDirty: true,
        errors: Object.keys(updates).reduce((acc, key) => {
          acc[`article_${id}_${key}`] = undefined
          return acc
        }, { ...prev.errors })
      }
    })

    // Regenerate boxes if relevant fields changed
    const relevantFields = ["quantity_units", "uom", "item_description", "lot_number"]
    if (Object.keys(updates).some(field => relevantFields.includes(field))) {
      const updatedArticles = state.articles.map(article => 
        article.id === id ? { ...article, ...updates } : article
      )
      boxManagement.generateBoxes(updatedArticles)
    }
  }, [state.articles, boxManagement])

  /**
   * Handle vendor change with auto-fill
   */
  const handleVendorChange = useCallback(async (vendorName: string) => {
    updateFormData("vendor_supplier_name", vendorName)
    
    try {
      const location = await InwardFormUtils.handleVendorChange(vendorName, company)
      if (location) {
        updateFormData("source_location", location)
      }
    } catch (error) {
      console.error("Error fetching vendor location:", error)
      // Don't throw error, just log it
    }
  }, [company, updateFormData])

  /**
   * Validate form
   */
  const validateForm = useCallback((): ValidationResult => {
    return InwardFormValidator.validateForm({
      company: state.formData.company,
      transaction: state.formData,
      articles: state.articles,
      boxes: boxManagement.boxes
    })
  }, [state.formData, state.articles, boxManagement.boxes])

  /**
   * Validate specific field
   */
  const validateField = useCallback((field: string, value: any): ValidationResult => {
    if (field.startsWith('article_')) {
      const [_, articleId, fieldName] = field.split('_')
      const article = state.articles.find(a => a.id === articleId)
      if (!article) {
        return { isValid: true, errors: [], fieldErrors: {} }
      }
      
      const updatedArticle = { ...article, [fieldName]: value }
      return InwardFormValidator.validateArticle(updatedArticle, parseInt(articleId))
    }
    
    if (field.startsWith('transaction.')) {
      const fieldName = field.replace('transaction.', '')
      const updatedTransaction = { ...state.formData, [fieldName]: value }
      return InwardFormValidator.validateTransaction(updatedTransaction)
    }
    
    return { isValid: true, errors: [], fieldErrors: {} }
  }, [state.formData, state.articles])

  /**
   * Set validation errors
   */
  const setErrors = useCallback((errors: Record<string, string>) => {
    setState(prev => ({ ...prev, errors }))
  }, [])

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setState(prev => ({ ...prev, errors: {} }))
  }, [])

  /**
   * Clear specific error
   */
  const clearError = useCallback((field: string) => {
    setState(prev => ({
      ...prev,
      errors: { ...prev.errors, [field]: undefined }
    }))
  }, [])

  /**
   * Save form data
   */
  const saveForm = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setState(prev => ({ ...prev, isSubmitting: true }))

    try {
      const result = await InwardFormUtils.saveOrUpdateEntry(
        state.formData,
        state.articles,
        boxManagement.boxes,
        company
      )

      if (result.success) {
        setState(prev => ({
          ...prev,
          isDirty: false,
          lastSaved: new Date(),
          isSubmitting: false
        }))
      } else {
        setState(prev => ({ ...prev, isSubmitting: false }))
      }

      return result
    } catch (error) {
      setState(prev => ({ ...prev, isSubmitting: false }))
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }, [state.formData, state.articles, boxManagement.boxes, company])

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback(() => {
    setState({
      formData: {
        company,
        transaction_no: InwardFormUtils.generateTransactionNo(),
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
      },
      articles: [{
        id: "1",
        sku_id: null,
        item_category: "",
        sub_category: "",
        item_description: "",
        quantity_units: 0,
        packaging_type: "",
        uom: "",
        net_weight: 0,
        total_weight: 0,
        batch_number: InwardFormUtils.generateBatchNumber(),
        lot_number: "",
        manufacturing_date: "",
        expiry_date: "",
        import_date: "",
        unit_rate: 0,
        total_amount: 0,
        tax_amount: 0,
        discount_amount: 0,
        currency: "INR",
      }],
      errors: {},
      isSubmitting: false,
      isDirty: false,
      lastSaved: null
    })

    boxManagement.clearBoxes()
    printing.clearAllPrinting()
  }, [company, boxManagement, printing])

  /**
   * Load form data from existing record
   */
  const loadFormData = useCallback((data: any) => {
    setState(prev => ({
      ...prev,
      formData: {
        company: data.company,
        transaction_no: data.transaction.transaction_no,
        entry_date: data.transaction.entry_date ? format(new Date(data.transaction.entry_date), "yyyy-MM-dd'T'HH:mm:ss") : "",
        vehicle_number: data.transaction.vehicle_number || "",
        transporter_name: data.transaction.transporter_name || "",
        lr_number: data.transaction.lr_number || "",
        vendor_supplier_name: data.transaction.vendor_supplier_name || "",
        customer_party_name: data.transaction.customer_party_name || "",
        source_location: data.transaction.source_location || "",
        destination_location: data.transaction.destination_location || "",
        challan_number: data.transaction.challan_number || "",
        invoice_number: data.transaction.invoice_number || "",
        po_number: data.transaction.po_number || "",
        grn_number: data.transaction.grn_number || "",
        grn_quantity: data.transaction.grn_quantity || 0,
        system_grn_date: data.transaction.system_grn_date || "",
        purchase_by: data.transaction.purchase_by || "",
        bill_submitted_to_account: false,
        grn_remark: "",
        process_type: "",
        service_remarks: "",
        service_invoice_number: data.transaction.service_invoice_number || "",
        dn_number: data.transaction.dn_number || "",
        approval_authority: data.transaction.approval_authority || "",
        received_quantity: data.transaction.received_quantity || 0,
        return_reason_remark: "",
        remark: data.transaction.remark || "",
      },
      articles: data.articles.map((article: any, index: number) => ({
        id: article.id?.toString() || (index + 1).toString(),
        sku_id: article.sku_id,
        item_category: article.item_category || "",
        sub_category: article.sub_category || "",
        item_description: article.item_description || "",
        quantity_units: article.quantity_units || 0,
        packaging_type: article.packaging_type || "",
        uom: article.uom || "",
        net_weight: article.net_weight || 0,
        total_weight: article.total_weight || 0,
        batch_number: article.batch_number || "",
        lot_number: article.lot_number || "",
        manufacturing_date: article.manufacturing_date || "",
        expiry_date: article.expiry_date || "",
        import_date: article.import_date || "",
        unit_rate: article.unit_rate || 0,
        total_amount: article.total_amount || 0,
        tax_amount: article.tax_amount || 0,
        discount_amount: article.discount_amount || 0,
        currency: article.currency || "INR",
      })),
      isDirty: false,
      lastSaved: null
    }))

    // Load boxes
    const convertedBoxes = data.boxes.map((box: any, index: number) => ({
      id: box.id?.toString() || (index + 1).toString(),
      box_number: box.box_number,
      article: box.article_description || "",
      net_weight: box.net_weight || 0,
      gross_weight: box.gross_weight || 0,
      lot_number: box.lot_number || "",
    }))
    
    boxManagement.clearBoxes()
    convertedBoxes.forEach((box: any) => boxManagement.addBox(box))
  }, [boxManagement])

  /**
   * Get form summary
   */
  const getFormSummary = useCallback(() => {
    const totalAmount = state.articles.reduce((sum, article) => sum + article.total_amount, 0)
    const totalTax = state.articles.reduce((sum, article) => sum + article.tax_amount, 0)
    const totalDiscount = state.articles.reduce((sum, article) => sum + article.discount_amount, 0)
    const totalQuantity = state.articles.reduce((sum, article) => sum + article.quantity_units, 0)

    return {
      totalArticles: state.articles.length,
      totalBoxes: boxManagement.boxes.length,
      totalQuantity,
      totalAmount,
      totalTax,
      totalDiscount,
      netAmount: totalAmount + totalTax - totalDiscount,
      isDirty: state.isDirty,
      lastSaved: state.lastSaved,
      hasErrors: Object.keys(state.errors).length > 0
    }
  }, [state.articles, state.isDirty, state.lastSaved, state.errors, boxManagement.boxes])

  return {
    // State
    formData: state.formData,
    articles: state.articles,
    errors: state.errors,
    isSubmitting: state.isSubmitting,
    isDirty: state.isDirty,
    lastSaved: state.lastSaved,

    // Form actions
    updateFormData,
    updateFormDataFields,
    addArticle,
    removeArticle,
    updateArticle,
    updateArticleFields,
    handleVendorChange,

    // Validation
    validateForm,
    validateField,
    setErrors,
    clearErrors,

    // Form operations
    saveForm,
    resetForm,
    loadFormData,

    // Utilities
    getFormSummary,

    // Box management
    ...boxManagement,

    // Printing
    ...printing
  }
}
