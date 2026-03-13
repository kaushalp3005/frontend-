// lib/api/qr.ts - Complete QR API Service with Printer Detection
interface QRPayload {
    company: string
    entry_date: string
    vendor_name: string
    customer_name: string
    item_description: string
    net_weight: number
    total_weight: number
    batch_number: string
    manufacturing_date?: string
    expiry_date?: string
    box_number: number
    transaction_no: string
    sku_id: number
  }
  
  interface QRLabel {
    box_number: number
    article_description: string
    qr_payload: QRPayload
    qr_data: string
  }
  
  interface QRLabelRequest {
    transaction_no: string
    company: string
    box_numbers: number[]
  }
  
  interface QRLabelResponse {
    transaction_no: string
    company: string
    labels: QRLabel[]
  }
  
  interface PrinterInfo {
    name: string
    type: 'USB' | 'WiFi' | 'Bluetooth'
    status: 'online' | 'offline' | 'busy'
    supports_label_printing: boolean
    max_width_inches?: number
    max_height_inches?: number
    dpi?: number
  }
  
  interface PrintJobRequest {
    transaction_no: string
    company: string
    box_numbers: number[]
    printer_name?: string
    print_settings?: PrintSettings
  }
  
  interface PrintJobResponse {
    job_id: string
    status: string
    labels_count: number
    created_at: string
  }
  
  interface PrintSettings {
    width: string
    height: string
    dpi: number
    orientation: 'portrait' | 'landscape'
    copies: number
  }
  
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ""
  
  class QRApiService {
    private async handleResponse<T>(response: Response): Promise<T> {
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`
        try {
          const errorData = await response.json()
          if (errorData?.detail) {
            errorMessage = typeof errorData.detail === 'string' 
              ? errorData.detail 
              : JSON.stringify(errorData.detail)
          }
        } catch {
          errorMessage = response.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }
      return response.json()
    }
  
    async generateLabels(request: QRLabelRequest): Promise<QRLabelResponse> {
      const response = await fetch(`${API_BASE}/qr/generate-labels`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(request),
      })
      
      return this.handleResponse<QRLabelResponse>(response)
    }
  
    async getAvailablePrinters(): Promise<{ printers: PrinterInfo[]; total_count: number; detection_status: string }> {
      const response = await fetch(`${API_BASE}/qr/available-printers`, {
        method: "GET",
        headers: { Accept: "application/json" },
      })
      
      return this.handleResponse<{ printers: PrinterInfo[]; total_count: number; detection_status: string }>(response)
    }
  
    async createPrintJob(request: PrintJobRequest): Promise<PrintJobResponse> {
      const response = await fetch(`${API_BASE}/qr/create-print-job`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(request),
      })
      
      return this.handleResponse<PrintJobResponse>(response)
    }
  
    async getPrintJobStatus(jobId: string): Promise<any> {
      const response = await fetch(`${API_BASE}/qr/print-job/${jobId}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      })
      
      return this.handleResponse(response)
    }
  
    // Browser-based printing utilities
    async printLabelsInBrowser(labels: QRLabel[], settings?: PrintSettings) {
      const printSettings = settings || this.getDefaultPrintSettings()
      
      // Create print content
      const printContent = this.createPrintContent(labels, printSettings)
      
      // Open print window
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        throw new Error('Could not open print window. Please allow popups.')
      }
      
      printWindow.document.write(printContent)
      printWindow.document.close()
      
      // Wait for QR codes to load then print
      await this.waitForQRCodesLoad(printWindow)
      
      // Print
      printWindow.print()
      
      // Close after a delay
      setTimeout(() => {
        printWindow.close()
      }, 1000)
    }
  
    private getDefaultPrintSettings(): PrintSettings {
      return {
        width: '4in',
        height: '2in',
        dpi: 203,
        orientation: 'landscape',
        copies: 1
      }
    }
  
    private formatDate(dateString: string): string {
      if (!dateString) return ''
      try {
        const date = new Date(dateString)
        return date.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit'
        })
      } catch {
        return ''
      }
    }
  
    private createPrintContent(labels: QRLabel[], settings: PrintSettings): string {
      const labelElements = labels.map(label => `
        <div class="label" style="
          width: ${settings.width};
          height: ${settings.height};
          page-break-after: always;
          page-break-inside: avoid;
          display: flex;
          border: 1px solid #000;
          font-family: Arial, sans-serif;
          background: white;
          box-sizing: border-box;
          margin: 0;
        ">
          <!-- QR Code Side (Left 50%) -->
          <div style="
            width: 50%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0.1in;
          ">
            <div id="qr-${label.box_number}" style="max-width: 100%; max-height: 100%;"></div>
          </div>
          
          <!-- Info Side (Right 50%) -->
          <div style="
            width: 50%;
            height: 100%;
            padding: 0.1in;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            font-size: 9pt;
            line-height: 1.1;
          ">
            <!-- Item Description (Top) -->
            <div style="font-weight: bold; font-size: 9pt; margin-bottom: 0.05in; overflow: hidden;">
              ${label.qr_payload.item_description}
            </div>
            
            <!-- Middle Information -->
            <div style="font-size: 8pt;">
              <div>Net Wt: ${label.qr_payload.net_weight}kg</div>
              <div>Box #${label.box_number}</div>
              <div>Inward: ${this.formatDate(label.qr_payload.entry_date)}</div>
              ${label.qr_payload.expiry_date ? `<div>Exp: ${this.formatDate(label.qr_payload.expiry_date)}</div>` : ''}
            </div>
            
            <!-- Bottom Information -->
            <div style="font-size: 7pt; color: #666;">
              <div>${label.qr_payload.batch_number || ''}</div>
              <div style="font-family: monospace;">${label.qr_payload.transaction_no}</div>
            </div>
          </div>
        </div>
      `).join('')
  
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <title>QR Labels - ${labels.length} labels</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js"></script>
            <style>
              @page {
                size: ${settings.width} ${settings.height};
                margin: 0;
              }
              
              body {
                margin: 0;
                padding: 0;
                background: white;
                font-family: Arial, sans-serif;
              }
              
              .label {
                page-break-after: always;
                page-break-inside: avoid;
              }
              
              @media print {
                body { 
                  -webkit-print-color-adjust: exact; 
                  print-color-adjust: exact;
                }
                
                .label {
                  width: ${settings.width} !important;
                  height: ${settings.height} !important;
                }
              }
            </style>
          </head>
          <body>
            ${labelElements}
            
            <script>
              document.addEventListener('DOMContentLoaded', function() {
                const labels = ${JSON.stringify(labels)};
                
                labels.forEach(function(label) {
                  const qrElement = document.getElementById('qr-' + label.box_number);
                  if (qrElement && window.QRious) {
                    try {
                      new QRious({
                        element: qrElement,
                        value: label.qr_data,
                        size: Math.min(170, qrElement.parentElement.offsetWidth - 10),
                        level: 'M',
                        background: 'white',
                        foreground: 'black'
                      });
                    } catch (e) {
                      console.error('Failed to generate QR code for box', label.box_number, e);
                    }
                  }
                });
                
                // Log completion
                console.log('Generated QR codes for', labels.length, 'labels');
              });
            </script>
          </body>
        </html>
      `
    }
  
    private async waitForQRCodesLoad(printWindow: Window): Promise<void> {
      return new Promise((resolve) => {
        let attempts = 0
        const maxAttempts = 20
        
        const checkQRCodes = () => {
          attempts++
          
          try {
            // Check if QRious is available and QR codes are generated
            const qrElements = printWindow.document.querySelectorAll('[id^="qr-"]')
            let loadedCount = 0
            
            qrElements.forEach(element => {
              if (element.innerHTML.includes('<canvas') || element.innerHTML.includes('<svg')) {
                loadedCount++
              }
            })
            
            if (loadedCount === qrElements.length || attempts >= maxAttempts) {
              console.log(`QR codes loaded: ${loadedCount}/${qrElements.length}`)
              resolve()
            } else {
              setTimeout(checkQRCodes, 200)
            }
          } catch (e) {
            console.warn('Error checking QR codes:', e)
            if (attempts >= maxAttempts) {
              resolve() // Give up and proceed
            } else {
              setTimeout(checkQRCodes, 200)
            }
          }
        }
        
        // Start checking after a short delay
        setTimeout(checkQRCodes, 300)
      })
    }
  
    // Device and capability detection
    isMobile(): boolean {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    }
  
    isIOS(): boolean {
      return /iPad|iPhone|iPod/.test(navigator.userAgent)
    }
  
    isAndroid(): boolean {
      return /Android/.test(navigator.userAgent)
    }
  
    // Print capability detection
    async checkPrintCapabilities() {
      const capabilities = {
        canPrint: 'print' in window,
        isMobile: this.isMobile(),
        isIOS: this.isIOS(),
        isAndroid: this.isAndroid(),
        userAgent: navigator.userAgent,
        supports: {
          webPrint: 'print' in window,
          popups: true, // Will be tested
          qrGeneration: typeof window !== 'undefined',
        }
      }
  
      // Test popup capability
      try {
        const testWindow = window.open('', '_blank', 'width=1,height=1')
        if (testWindow) {
          testWindow.close()
          capabilities.supports.popups = true
        } else {
          capabilities.supports.popups = false
        }
      } catch (e) {
        capabilities.supports.popups = false
      }
  
      return capabilities
    }
  
    // Download individual label as image
    async downloadLabel(label: QRLabel, element?: HTMLElement): Promise<void> {
      if (element) {
        try {
          const html2canvas = (await import('html2canvas')).default
          const canvas = await html2canvas(element, {
            width: 812,  // 4 inches at 203 DPI
            height: 406, // 2 inches at 203 DPI
            scale: 1,
            backgroundColor: '#ffffff',
          })
  
          const link = document.createElement('a')
          link.download = `qr-label-${label.qr_payload.transaction_no}-box-${label.box_number}.png`
          link.href = canvas.toDataURL('image/png')
          link.click()
        } catch (error) {
          console.error('Failed to download label:', error)
          throw new Error('Failed to download label')
        }
      }
    }
  
    // Validate QR data
    validateQRPayload(payload: Partial<QRPayload>): { isValid: boolean; errors: string[] } {
      const errors: string[] = []
      
      if (!payload.company) errors.push('Company is required')
      if (!payload.transaction_no) errors.push('Transaction number is required')
      if (!payload.box_number) errors.push('Box number is required')
      if (!payload.item_description) errors.push('Item description is required')
      if (!payload.entry_date) errors.push('Entry date is required')
      
      // Validate dates
      if (payload.entry_date && isNaN(Date.parse(payload.entry_date))) {
        errors.push('Invalid entry date format')
      }
      if (payload.manufacturing_date && isNaN(Date.parse(payload.manufacturing_date))) {
        errors.push('Invalid manufacturing date format')
      }
      if (payload.expiry_date && isNaN(Date.parse(payload.expiry_date))) {
        errors.push('Invalid expiry date format')
      }
      
      // Validate numeric fields
      if (payload.net_weight !== undefined && payload.net_weight < 0) {
        errors.push('Net weight cannot be negative')
      }
      if (payload.total_weight !== undefined && payload.total_weight < 0) {
        errors.push('Total weight cannot be negative')
      }
      
      return {
        isValid: errors.length === 0,
        errors
      }
    }
  }
  
  // Export singleton instance
  export const qrApiService = new QRApiService()
  
  // Export individual functions for convenience
  export const generateLabels = qrApiService.generateLabels.bind(qrApiService)
  export const getAvailablePrinters = qrApiService.getAvailablePrinters.bind(qrApiService)
  export const createPrintJob = qrApiService.createPrintJob.bind(qrApiService)
  export const printLabelsInBrowser = qrApiService.printLabelsInBrowser.bind(qrApiService)
  export const checkPrintCapabilities = qrApiService.checkPrintCapabilities.bind(qrApiService)
  export const downloadLabel = qrApiService.downloadLabel.bind(qrApiService)
  
  // Export types
  export type { QRPayload, QRLabel, QRLabelRequest, QRLabelResponse, PrinterInfo, PrintJobRequest, PrintJobResponse, PrintSettings }