// lib/api/qr.ts
import { 
    QRLabelRequest, 
    QRLabelResponse, 
    PrinterInfo, 
    PrintJobRequest, 
    PrintJobResponse,
    PrintSettings
  } from '@/types/qr'
  
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
  
    async getAvailablePrinters(): Promise<{ printers: PrinterInfo[] }> {
      const response = await fetch(`${API_BASE}/qr/available-printers`, {
        method: "GET",
        headers: { Accept: "application/json" },
      })
      
      return this.handleResponse<{ printers: PrinterInfo[] }>(response)
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
  
    async printDirectly(labels: any[], settings?: PrintSettings): Promise<any> {
      const response = await fetch(`${API_BASE}/qr/print-direct`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          labels,
          settings: settings || this.getDefaultPrintSettings()
        }),
      })
      
      return this.handleResponse(response)
    }
  
    // Browser-based printing utilities
    async printLabelsInBrowser(labels: any[], settings?: PrintSettings) {
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
      
      // Wait for images/QR codes to load
      await this.waitForImagesLoad(printWindow)
      
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
  
    private createPrintContent(labels: any[], settings: PrintSettings): string {
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
        ">
          <!-- QR Code Side -->
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
          
          <!-- Info Side -->
          <div style="
            width: 50%;
            height: 100%;
            padding: 0.1in;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            font-size: 10pt;
            line-height: 1.2;
          ">
            <div style="font-weight: bold; font-size: 9pt; margin-bottom: 0.05in;">
              ${label.article_description || label.qr_payload.item_description}
            </div>
            
            <div style="font-size: 8pt;">
              <div>Net Wt: ${label.qr_payload.net_weight || 0}${label.qr_payload.uom ? ' ' + label.qr_payload.uom : 'kg'}</div>
              <div>Box #${label.box_number}</div>
              <div>Inward: ${new Date(label.qr_payload.entry_date).toLocaleDateString('en-GB')}</div>
              ${label.qr_payload.expiry_date ? `<div>Exp: ${new Date(label.qr_payload.expiry_date).toLocaleDateString('en-GB')}</div>` : ''}
            </div>
            
            <div style="font-size: 7pt; color: #666;">
              <div>${label.qr_payload.batch_number || ''}</div>
              <div>${label.qr_payload.transaction_no}</div>
            </div>
          </div>
        </div>
      `).join('')
  
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <title>QR Labels</title>
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
              }
              
              .label {
                page-break-after: always;
                page-break-inside: avoid;
              }
              
              @media print {
                body { -webkit-print-color-adjust: exact; }
              }
            </style>
          </head>
          <body>
            ${labelElements}
            
            <script>
              // Generate QR codes after page loads
              document.addEventListener('DOMContentLoaded', function() {
                const labels = ${JSON.stringify(labels)};
                
                labels.forEach(function(label) {
                  const qrElement = document.getElementById('qr-' + label.box_number);
                  if (qrElement) {
                    const qr = new QRious({
                      element: qrElement,
                      value: label.qr_data,
                      size: Math.min(150, qrElement.parentElement.offsetWidth - 10),
                      level: 'M'
                    });
                  }
                });
                
                // Auto-print after QR codes are generated
                setTimeout(function() {
                  window.print();
                }, 500);
              });
            </script>
          </body>
        </html>
      `
    }
  
    private async waitForImagesLoad(printWindow: Window): Promise<void> {
      return new Promise((resolve) => {
        let attempts = 0
        const maxAttempts = 10
        
        const checkImages = () => {
          attempts++
          const images = printWindow.document.images
          let loaded = 0
          
          for (let i = 0; i < images.length; i++) {
            if (images[i].complete) loaded++
          }
          
          if (loaded === images.length || attempts >= maxAttempts) {
            resolve()
          } else {
            setTimeout(checkImages, 100)
          }
        }
        
        setTimeout(checkImages, 100)
      })
    }
  
    // Device detection
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
          popups: true, // Will be tested when opening print window
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
  }
  
  // Export singleton instance
  export const qrApiService = new QRApiService()
  
  // Export individual functions for convenience
  export const generateLabels = qrApiService.generateLabels.bind(qrApiService)
  export const getAvailablePrinters = qrApiService.getAvailablePrinters.bind(qrApiService)
  export const createPrintJob = qrApiService.createPrintJob.bind(qrApiService)
  export const printLabelsInBrowser = qrApiService.printLabelsInBrowser.bind(qrApiService)
  export const checkPrintCapabilities = qrApiService.checkPrintCapabilities.bind(qrApiService)