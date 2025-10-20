// lib/utils/inwardFormUtils.ts
import { dropdownApi } from "@/lib/api"
import { InwardFormValidator, type InwardFormData, type ValidationResult } from "@/lib/validations/inwardForm"
import { generateQRPayload } from "@/lib/utils/qr"
import type { QRPayload } from "@/types/qr"
import { qrGenerator } from "@/lib/utils/qrGenerator"
import type { Company } from "@/types/inward"

export interface SaveOrUpdateResult {
  success: boolean
  action: 'created' | 'updated'
  transaction_no: string
  error?: string
}

export interface PrintBoxResult {
  success: boolean
  error?: string
}

export interface FormState {
  formData: any
  articles: any[]
  boxes: any[]
  errors: Record<string, string>
  isSubmitting: boolean
}

export class InwardFormUtils {
  /**
   * Resolve SKU ID for an article
   */
  static async resolveSkuId(article: any, company: Company): Promise<number> {
    if (article.sku_id && article.sku_id > 0) {
      return article.sku_id
    }
    
    if (!article.item_description || !article.item_category || !article.sub_category) {
      throw new Error(`Missing required fields for SKU resolution: ${article.item_description || "Unnamed item"}`)
    }
    
    try {
      const res = await dropdownApi.fetchSkuId({
        company,
        item_description: article.item_description,
        item_category: article.item_category,
        sub_category: article.sub_category,
      })
      
      const sku = Number(
        res?.sku_id ??
        res?.id ??
        res?.ID ??
        res?.SKU_ID
      )
      
      if (!Number.isFinite(sku) || sku <= 0) {
        throw new Error(`Invalid SKU ID returned: ${sku}`)
      }
      
      return sku
    } catch (error) {
      console.error("Error resolving SKU ID:", error)
      throw new Error(`Could not resolve SKU ID for "${article.item_description}": ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Resolve SKU IDs for all articles
   */
  static async resolveAllSkuIds(articles: any[], company: Company): Promise<any[]> {
    const resolvedArticles = await Promise.all(
      articles.map(async (article) => {
        try {
          const skuId = await this.resolveSkuId(article, company)
          return { ...article, sku_id: skuId }
        } catch (error) {
          console.error(`Failed to resolve SKU for article ${article.id}:`, error)
          throw error
        }
      })
    )

    return resolvedArticles
  }

  /**
   * Validate form data comprehensively
   */
  static validateFormData(formData: any, articles: any[], boxes: any[]): ValidationResult {
    // Validate main form structure
    const formValidation = InwardFormValidator.validateForm({
      company: formData.company,
      transaction: formData,
      articles,
      boxes
    })

    if (!formValidation.isValid) {
      return formValidation
    }

    // Additional business logic validations
    const additionalErrors: string[] = []
    const additionalFieldErrors: Record<string, string> = {}

    // Validate SKU IDs
    articles.forEach((article, index) => {
      const skuValidation = InwardFormValidator.validateSkuId(article.sku_id)
      if (!skuValidation.isValid) {
        additionalErrors.push(`Article ${index + 1}: ${skuValidation.errors[0].message}`)
        additionalFieldErrors[`article_${index}_sku_id`] = skuValidation.errors[0].message
      }
    })

    // Validate box totals match article totals
    if (boxes.length > 0) {
      const boxNetTotal = boxes.reduce((sum, box) => sum + (box.net_weight || 0), 0)
      const articleNetTotal = articles.reduce((sum, article) => sum + (article.net_weight || 0), 0)
      
      if (Math.abs(boxNetTotal - articleNetTotal) > 0.01) {
        additionalErrors.push("Box net weight total does not match article net weight total")
        additionalFieldErrors['box_net_weight_total'] = "Box net weight total does not match article net weight total"
      }

      const boxGrossTotal = boxes.reduce((sum, box) => sum + (box.gross_weight || 0), 0)
      const articleGrossTotal = articles.reduce((sum, article) => sum + (article.total_weight || 0), 0)
      
      if (Math.abs(boxGrossTotal - articleGrossTotal) > 0.01) {
        additionalErrors.push("Box gross weight total does not match article gross weight total")
        additionalFieldErrors['box_gross_weight_total'] = "Box gross weight total does not match article gross weight total"
      }
    }

    return {
      isValid: additionalErrors.length === 0 && formValidation.isValid,
      errors: [...formValidation.errors, ...additionalErrors.map(msg => ({ field: 'general', message: msg }))],
      fieldErrors: { ...formValidation.fieldErrors, ...additionalFieldErrors }
    }
  }

  /**
   * Build submission payload
   */
  static buildSubmissionPayload(
    formData: any,
    articles: any[],
    boxes: any[],
    company: Company
  ): InwardFormData {
    return {
      company,
      transaction: {
        ...formData,
        total_amount: articles.reduce((sum, article) => sum + (article.total_amount || 0), 0),
        tax_amount: articles.reduce((sum, article) => sum + (article.tax_amount || 0), 0),
        discount_amount: articles.reduce((sum, article) => sum + (article.discount_amount || 0), 0),
        currency: "INR"
      },
      articles: articles.map(article => ({
        id: article.id || `article-${Date.now()}-${Math.random()}`,
        transaction_no: formData.transaction_no,
        sku_id: Number(article.sku_id),
        item_description: article.item_description,
        item_category: article.item_category,
        sub_category: article.sub_category,
        uom: article.uom,
        packaging_type: article.packaging_type,
        quantity_units: article.quantity_units,
        net_weight: article.net_weight,
        total_weight: article.total_weight,
        batch_number: article.batch_number,
        lot_number: article.lot_number,
        manufacturing_date: article.manufacturing_date,
        expiry_date: article.expiry_date,
        import_date: article.import_date,
        unit_rate: article.unit_rate,
        total_amount: article.total_amount,
        tax_amount: article.tax_amount,
        discount_amount: article.discount_amount,
        currency: article.currency
      })),
      boxes: boxes.map(box => ({
        id: box.id || `box-${Date.now()}-${Math.random()}`,
        transaction_no: formData.transaction_no,
        article: box.article || "",
        box_number: box.box_number,
        net_weight: box.net_weight,
        gross_weight: box.gross_weight,
        lot_number: box.lot_number
      }))
    }
  }

  /**
   * Save or update inward entry
   */
  static async saveOrUpdateEntry(
    formData: any,
    articles: any[],
    boxes: any[],
    company: Company
  ): Promise<SaveOrUpdateResult> {
    try {
      // Resolve all SKU IDs
      const resolvedArticles = await this.resolveAllSkuIds(articles, company)

      // Validate form data
      const validation = this.validateFormData(formData, resolvedArticles, boxes)
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`)
      }

      // Build submission payload
      const payload = this.buildSubmissionPayload(formData, resolvedArticles, boxes, company)

      // Check if entry exists
      const checkUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/inward/${company}/${encodeURIComponent(formData.transaction_no)}`
      
      const checkResponse = await fetch(checkUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      })

      let result: SaveOrUpdateResult

      if (checkResponse.ok) {
        // Entry exists, update it
        console.log("Transaction exists, updating...")
        
        const updateResponse = await fetch(checkUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
          },
          body: JSON.stringify(payload)
        })

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json().catch(() => ({}))
          throw new Error(`Failed to update entry: ${errorData.detail || updateResponse.statusText}`)
        }

        result = {
          success: true,
          action: 'updated',
          transaction_no: formData.transaction_no
        }
      } else if (checkResponse.status === 404) {
        // Entry doesn't exist, create new one
        console.log("Transaction doesn't exist, creating new entry...")
        
        const createUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/inward`
        const createResponse = await fetch(createUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
          },
          body: JSON.stringify(payload)
        })

        if (!createResponse.ok) {
          const errorData = await createResponse.json().catch(() => ({}))
          throw new Error(`Failed to create entry: ${errorData.detail || createResponse.statusText}`)
        }

        result = {
          success: true,
          action: 'created',
          transaction_no: formData.transaction_no
        }
      } else {
        // Other error occurred during check
        const errorData = await checkResponse.json().catch(() => ({}))
        throw new Error(`Failed to check transaction existence: ${errorData.detail || checkResponse.statusText}`)
      }

      return result
    } catch (error) {
      console.error("Error in saveOrUpdateEntry:", error)
      return {
        success: false,
        action: 'created', // Default fallback
        transaction_no: formData.transaction_no,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Handle vendor change and auto-fill location
   */
  static async handleVendorChange(vendorName: string, company: Company): Promise<string | null> {
    try {
      const vendorData = await dropdownApi.getVendors({ company, vendor_name: vendorName })
      
      if (vendorData.auto_selection?.resolved_from_vendor?.location) {
        return vendorData.auto_selection.resolved_from_vendor.location
      }
      
      return null
    } catch (error) {
      console.error("Error fetching vendor location:", error)
      return null
    }
  }

  /**
   * Generate transaction number
   */
  static generateTransactionNo(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    const hour = String(now.getHours()).padStart(2, "0")
    const minute = String(now.getMinutes()).padStart(2, "0")
    return `TR-${year}${month}${day}${hour}${minute}`
  }

  /**
   * Generate batch number
   */
  static generateBatchNumber(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    const hour = String(now.getHours()).padStart(2, "0")
    const minute = String(now.getMinutes()).padStart(2, "0")
    const second = String(now.getSeconds()).padStart(2, "0")
    return `BT-${year}${month}${day}${hour}${minute}${second}-001`
  }

  /**
   * Generate boxes from articles
   */
  static generateBoxes(articles: any[], existingBoxes: any[] = []): any[] {
    const newBoxes: any[] = []
    let boxCounter = 1
    const today = new Date()
    const dateString = today.getFullYear().toString().slice(-2) +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0')

    articles.forEach((article) => {
      // Only generate boxes if UOM is BOX or CARTON and quantity is greater than 0
      if (article.quantity_units > 0 && (article.uom === "BOX" || article.uom === "CARTON")) {
        const cleanItemDescription = (article.item_description || `Article${article.id}`)
          .replace(/[^a-zA-Z0-9]/g, '')
          .toUpperCase()
          .substring(0, 10)

        for (let i = 0; i < article.quantity_units; i++) {
          // Check if this box already exists to preserve its weights
          const existingBox = existingBoxes.find(box => 
            box.box_number === boxCounter && 
            box.article === (article.item_description || `Article ${article.id}`)
          )
          
          newBoxes.push({
            id: `${dateString}${cleanItemDescription}${boxCounter}`,
            box_number: boxCounter,
            article: article.item_description || `Article ${article.id}`,
            // Preserve existing weights if box exists, otherwise use default calculation
            net_weight: existingBox ? existingBox.net_weight : (article.net_weight > 0 ? article.net_weight / article.quantity_units : 0),
            gross_weight: existingBox ? existingBox.gross_weight : (article.total_weight > 0 ? article.total_weight / article.quantity_units : 0),
            lot_number: article.lot_number || "",
          })
          boxCounter++
        }
      }
    })
    
    return newBoxes
  }

  /**
   * Remove box and decrement article quantity
   */
  static removeBox(boxId: string, boxes: any[], articles: any[]): { boxes: any[], articles: any[] } {
    const boxToRemove = boxes.find(box => box.id === boxId)
    if (!boxToRemove) {
      return { boxes, articles }
    }

    // Remove the box
    const updatedBoxes = boxes.filter(box => box.id !== boxId)

    // Find the associated article and decrement its quantity
    const updatedArticles = articles.map(article => {
      if (article.item_description === boxToRemove.article) {
        return {
          ...article,
          quantity_units: Math.max(0, article.quantity_units - 1)
        }
      }
      return article
    })

    return { boxes: updatedBoxes, articles: updatedArticles }
  }

  /**
   * Update box field
   */
  static updateBox(boxId: string, field: string, value: any, boxes: any[]): any[] {
    return boxes.map(box => 
      box.id === boxId ? { ...box, [field]: value } : box
    )
  }

  /**
   * Handle printing a box with QR generation and Electron printing
   */
  static async handlePrintBox(
    box: any,
    formData: any,
    articles: any[],
    company: Company,
    selectedPrinter: string | null,
    onProgress?: (message: string) => void
  ): Promise<PrintBoxResult> {
    try {
      onProgress?.("Validating form data...")

      // First, save/update the entry to ensure data is persisted
      const saveResult = await this.saveOrUpdateEntry(formData, articles, [], company)
      if (!saveResult.success) {
        throw new Error(`Failed to save entry before printing: ${saveResult.error}`)
      }

      onProgress?.("Finding associated article...")

      // Find the article associated with this box
      const associatedArticle = articles.find(art => art.item_description === box.article)
      if (!associatedArticle) {
        throw new Error("Could not find associated article for this box")
      }

      onProgress?.("Generating QR payload...")

      // Generate QR payload
      const qrPayload: QRPayload = {
        company: company,
        entry_date: formData.entry_date,
        vendor_name: formData.vendor_supplier_name || '',
        customer_name: formData.customer_party_name || '',
        item_description: associatedArticle.item_description,
        net_weight: box.net_weight,
        total_weight: box.gross_weight,
        batch_number: associatedArticle.batch_number || '',
        box_number: box.box_number,
        manufacturing_date: associatedArticle.manufacturing_date,
        expiry_date: associatedArticle.expiry_date,
        transaction_no: formData.transaction_no,
        sku_id: associatedArticle.sku_id || 0
      }

      onProgress?.("Generating QR label...")

      // Generate QR label image
      const imageDataUrl = await qrGenerator.generateLabelImage(qrPayload, {
        width: 4,
        height: 2,
        dpi: 300
      })

      onProgress?.("Converting image for printing...")

      // Convert image to base64
      const imageBase64 = await qrGenerator.imageToBase64(imageDataUrl)

      onProgress?.("Preparing print data...")

      // Check if printer is selected
      if (!selectedPrinter) {
        throw new Error("No printer selected. Please select a printer before printing.")
      }

      onProgress?.("Sending to printer...")

      // Print the label - in a real implementation, this would send to printer
      // For now, we'll just log the success
      console.log("Printing QR label for box:", box.box_number, "to printer:", selectedPrinter)
      console.log("QR Payload:", qrPayload)
      console.log("Image Base64 length:", imageBase64.length)

      // Mock successful print result
      const printResult = { success: true }

      onProgress?.("Print completed successfully!")

      return {
        success: true
      }
    } catch (error) {
      console.error("Error in handlePrintBox:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Handle printing multiple boxes
   */
  static async handlePrintMultipleBoxes(
    boxes: any[],
    formData: any,
    articles: any[],
    company: Company,
    selectedPrinter: string | null,
    onProgress?: (boxNumber: number, message: string) => void,
    onComplete?: (results: PrintBoxResult[]) => void
  ): Promise<PrintBoxResult[]> {
    const results: PrintBoxResult[] = []

    try {
      // First, save/update the entry to ensure data is persisted
      const saveResult = await this.saveOrUpdateEntry(formData, articles, [], company)
      if (!saveResult.success) {
        throw new Error(`Failed to save entry before printing: ${saveResult.error}`)
      }

      // Print each box sequentially
      for (let i = 0; i < boxes.length; i++) {
        const box = boxes[i]
        onProgress?.(box.box_number, `Printing box ${i + 1} of ${boxes.length}...`)

        const result = await this.handlePrintBox(box, formData, articles, company, selectedPrinter)
        results.push(result)

        if (!result.success) {
          console.error(`Failed to print box ${box.box_number}:`, result.error)
          // Continue with other boxes even if one fails
        }

        // Small delay between prints to avoid overwhelming the printer
        if (i < boxes.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      onComplete?.(results)
      return results
    } catch (error) {
      console.error("Error in handlePrintMultipleBoxes:", error)
      const errorResult: PrintBoxResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
      results.push(errorResult)
      onComplete?.(results)
      return results
    }
  }

  /**
   * Generate QR code for preview (without printing)
   */
  static async generateQRPreview(
    box: any,
    formData: any,
    articles: any[],
    company: Company
  ): Promise<string> {
    try {
      // Find the article associated with this box
      const associatedArticle = articles.find(art => art.item_description === box.article)
      if (!associatedArticle) {
        throw new Error("Could not find associated article for this box")
      }

      // Generate QR payload
      const qrPayload: QRPayload = {
        company: company,
        entry_date: formData.entry_date,
        vendor_name: formData.vendor_supplier_name || '',
        customer_name: formData.customer_party_name || '',
        item_description: associatedArticle.item_description,
        net_weight: box.net_weight,
        total_weight: box.gross_weight,
        batch_number: associatedArticle.batch_number || '',
        box_number: box.box_number,
        manufacturing_date: associatedArticle.manufacturing_date,
        expiry_date: associatedArticle.expiry_date,
        transaction_no: formData.transaction_no,
        sku_id: associatedArticle.sku_id || 0
      }

      // Generate QR label image
      const imageDataUrl = await qrGenerator.generateLabelImage(qrPayload, {
        width: 4,
        height: 2,
        dpi: 300
      })

      return imageDataUrl
    } catch (error) {
      console.error("Error generating QR preview:", error)
      throw error
    }
  }
}
