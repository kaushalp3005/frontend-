// lib/services/printService.ts
import type { QRPayload } from '@/types/qr'
import { inwardApiService } from '@/lib/api/inwardApiService'
import type { Company } from '@/lib/api'

export interface PrintResult {
  success: boolean
  error?: string
}

export interface PrinterInfo {
  name: string
  type: 'USB' | 'WiFi' | 'Bluetooth' | 'Network'
  status: 'online' | 'offline' | 'busy'
  supports_label_printing: boolean
  max_width_inches?: number
  max_height_inches?: number
  dpi?: number
}

export class PrintService {
  private static instance: PrintService
  private selectedPrinter: string | null = null

  static getInstance(): PrintService {
    if (!PrintService.instance) {
      PrintService.instance = new PrintService()
    }
    return PrintService.instance
  }

  /**
   * Set the selected printer
   */
  setSelectedPrinter(printerName: string): void {
    this.selectedPrinter = printerName
  }

  /**
   * Get available printers
   */
  async getAvailablePrinters(): Promise<PrinterInfo[]> {
    try {
      // Check if Electron API is available (desktop app)
      if (window.electronAPI) {
        const printerNames = await window.electronAPI.getAvailablePrinters()
        return printerNames.map(name => ({
          name,
          type: 'USB' as const,
          status: 'online' as const,
          supports_label_printing: true,
          max_width_inches: 4.0,
          max_height_inches: 2.0,
          dpi: 300
        }))
      }

      // Fallback to web API (if endpoint exists)
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/qr/available-printers`, {
          signal: controller.signal
        })
        clearTimeout(timeoutId)

        if (response.ok) {
          const data = await response.json()
          return data.printers || []
        }
      } catch (error) {
        console.warn('Printer API endpoint not available:', error)
      }

      // Default fallback
      return [{
        name: "Browser Default",
        type: 'USB' as const,
        status: 'online' as const,
        supports_label_printing: true,
        max_width_inches: 4.0,
        max_height_inches: 2.0,
        dpi: 300
      }]
    } catch (error) {
      console.error('Error getting available printers:', error)
      return [{
        name: "Browser Default",
        type: 'USB' as const,
        status: 'online' as const,
        supports_label_printing: true,
        max_width_inches: 4.0,
        max_height_inches: 2.0,
        dpi: 300
      }]
    }
  }

  /**
   * Main method to print a box label
   * This is the only method that should be called from the UI
   */
  async printBoxLabel(
    box: any,
    associatedArticle: any,
    formData: any,
    company: Company,
    boxTransactionNo: string
  ): Promise<PrintResult> {
    try {
      // Step 1: Validate printer selection
      if (!this.selectedPrinter) {
        return {
          success: false,
          error: "Please select a printer first"
        }
      }

      // Step 2: Resolve SKU ID
      let sku_id = associatedArticle.sku_id
      if (!sku_id || sku_id <= 0) {
        try {
          const result = await inwardApiService.resolveSkuId(
            associatedArticle.item_description,
            associatedArticle.item_category,
            associatedArticle.sub_category,
            company
          )
          
          sku_id = result.sku_id
        } catch (error) {
          return {
            success: false,
            error: `Failed to resolve SKU ID for "${associatedArticle.item_description}": ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }
      }

      // Step 3: Save or update inward entry
      const boxInwardData = {
        company: company,
        transaction: {
          transaction_no: boxTransactionNo,
          entry_date: formData.entry_date,
          vehicle_number: formData.vehicle_number,
          transporter_name: formData.transporter_name,
          lr_number: formData.lr_number,
          vendor_supplier_name: formData.vendor_supplier_name,
          customer_party_name: formData.customer_party_name,
          source_location: formData.source_location,
          destination_location: formData.destination_location,
          challan_number: formData.challan_number,
          invoice_number: formData.invoice_number,
          po_number: formData.po_number,
          grn_number: formData.grn_number,
          grn_quantity: 1,
          system_grn_date: formData.system_grn_date,
          purchase_by: formData.purchase_by,
          service_invoice_number: formData.service_invoice_number,
          dn_number: formData.dn_number,
          approval_authority: formData.approval_authority,
          total_amount: associatedArticle.unit_rate * 1,
          tax_amount: associatedArticle.tax_amount / associatedArticle.quantity_units,
          discount_amount: associatedArticle.discount_amount / associatedArticle.quantity_units,
          received_quantity: 1,
          remark: `Box ${box.box_number} from ${formData.transaction_no}`,
          currency: "INR"
        },
        articles: [{
          transaction_no: boxTransactionNo,
          sku_id: sku_id,
          item_description: associatedArticle.item_description,
          item_category: associatedArticle.item_category,
          sub_category: associatedArticle.sub_category,
          uom: "BOX",
          packaging_type: associatedArticle.packaging_type,
          quantity_units: 1,
          net_weight: box.net_weight,
          total_weight: box.gross_weight,
          batch_number: associatedArticle.batch_number,
          lot_number: box.lot_number || associatedArticle.lot_number,
          manufacturing_date: associatedArticle.manufacturing_date,
          expiry_date: associatedArticle.expiry_date,
          import_date: associatedArticle.import_date,
          unit_rate: associatedArticle.unit_rate,
          total_amount: associatedArticle.unit_rate * 1,
          tax_amount: associatedArticle.tax_amount / associatedArticle.quantity_units,
          discount_amount: associatedArticle.discount_amount / associatedArticle.quantity_units,
          currency: "INR"
        }],
        boxes: [{
          transaction_no: boxTransactionNo,
          article_description: box.article,
          box_number: box.box_number,
          net_weight: box.net_weight,
          gross_weight: box.gross_weight,
          lot_number: box.lot_number
        }]
      }

      try {
        // Check if entry exists
        const checkResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/inward/${company}/${encodeURIComponent(boxTransactionNo)}`
        )

        if (checkResponse.ok) {
          // Entry exists, update it
          const updateResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/inward/${company}/${encodeURIComponent(boxTransactionNo)}`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify(boxInwardData)
            }
          )

          if (!updateResponse.ok) {
            const errorData = await updateResponse.json().catch(() => ({}))
            throw new Error(`Failed to update entry: ${errorData.message || updateResponse.statusText}`)
          }
        } else if (checkResponse.status === 404) {
          // Entry doesn't exist, create new
          const createResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/inward`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify(boxInwardData)
            }
          )

          if (!createResponse.ok) {
            const errorData = await createResponse.json().catch(() => ({}))
            throw new Error(`Failed to create entry: ${errorData.message || createResponse.statusText}`)
          }
        } else {
          const errorData = await checkResponse.json().catch(() => ({}))
          throw new Error(`Failed to check entry existence: ${errorData.message || checkResponse.statusText}`)
        }
      } catch (error) {
        return {
          success: false,
          error: `Failed to save entry: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }

      // Step 4: Generate QR label image
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
        transaction_no: boxTransactionNo,
        sku_id: sku_id,
      }

      // Dynamically import QR generator to avoid SSR issues
      const { qrGenerator } = await import('@/lib/utils/qrGenerator')
      
      const imageDataUrl = await qrGenerator.generateLabelImage(qrPayload, {
        width: 4.0,
        height: 2.0,
        dpi: 300
      })

      const imageBase64 = await qrGenerator.imageToBase64(imageDataUrl)

      // Step 5: Build print payload
      const printData = {
        type: 'qr_label' as const,
        data: imageBase64,
        format: 'png' as const,
        dimensions: {
          width: 4.0,
          height: 2.0,
          dpi: 300,
          unit: 'inches' as const
        },
        box_info: {
          box_number: box.box_number,
          article: associatedArticle.item_description,
          transaction_no: boxTransactionNo,
          company: company
        }
      }

      // Step 6: Send print job
      if (window.electronAPI) {
        // Use Electron API for direct printer communication
        const result = await window.electronAPI.printToDevice(this.selectedPrinter, printData)
        return {
          success: result.success,
          error: result.error
        }
      } else {
        // Fallback to web-based printing
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/print/send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              printer_name: this.selectedPrinter,
              print_data: printData
            })
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(`Print API error: ${errorData.message || response.statusText}`)
          }

          return { success: true }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Web print API failed'
          }
        }
      }

    } catch (error) {
      console.error("PrintService error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred during printing.'
      }
    }
  }
}

// Export singleton instance
export const printService = new PrintService()