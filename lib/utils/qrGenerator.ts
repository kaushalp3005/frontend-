// lib/utils/qrGenerator.ts
import { createRoot } from 'react-dom/client'
import { QRCodeSVG } from 'qrcode.react'
import { generateSimplifiedQRData, validateQRPayload } from '@/lib/utils/qr'
import type { QRPayload } from '@/types/qr'

export interface QRLabelData {
  type: 'qr_label'
  data: string // base64 PNG
  format: 'png'
  dimensions: {
    width: number
    height: number
    dpi: number
    unit: 'inches'
  }
  box_info: {
    box_number: number
    article: string
    transaction_no: string
    company: string
  }
}

export interface PrintData {
  type: 'qr_label'
  data: string
  format: 'png'
  dimensions: {
    width: number
    height: number
    dpi: number
    unit: 'inches'
  }
  box_info: {
    box_number: number
    article: string
    transaction_no: string
    company: string
  }
}

export interface ElectronAPI {
  printToDevice: (printer: string, printData: PrintData) => Promise<{ success: boolean; error?: string }>
  getAvailablePrinters: () => Promise<string[]>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export class QRGenerator {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null

  constructor() {
    // Don't initialize canvas in constructor to avoid SSR issues
    // Canvas will be created when needed
  }

  private initializeCanvas() {
    if (typeof window === 'undefined') {
      throw new Error('QRGenerator can only be used on the client side')
    }
    
    this.canvas = document.createElement('canvas')
    // Set default dimensions: 4.0 inches x 2.0 inches at 300 DPI
    this.canvas.width = 4.0 * 300 // 1200 px
    this.canvas.height = 2.0 * 300 // 600 px
    this.ctx = this.canvas.getContext('2d')
  }

  /**
   * Generate QR label image with all relevant box/article/form fields
   * Following the exact specification: 4.0" x 2.0" at 300 DPI
   */
  async generateLabelImage(
    payload: QRPayload,
    settings: {
      width?: number
      height?: number
      dpi?: number
    } = {}
  ): Promise<string> {
    const { width = 4.0, height = 2.0, dpi = 300 } = settings

    // Initialize canvas if not already done
    if (!this.canvas || !this.ctx) {
      this.initializeCanvas()
    }

    // Validate payload
    const validation = validateQRPayload(payload)
    if (!validation.isValid) {
      throw new Error(`Invalid QR payload: ${validation.errors.join(', ')}`)
    }

    // Check canvas and context are initialized
    if (!this.canvas || !this.ctx) {
      throw new Error('Canvas not initialized')
    }

    // Set canvas dimensions based on physical inches and DPI
    this.canvas.width = width * dpi
    this.canvas.height = height * dpi

    // Clear canvas with white background
    this.ctx.fillStyle = '#ffffff'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Draw border (0.05 inch border)
    const borderWidth = 0.05 * dpi
    this.ctx.strokeStyle = '#000000'
    this.ctx.lineWidth = borderWidth
    this.ctx.strokeRect(
      borderWidth / 2, 
      borderWidth / 2, 
      this.canvas.width - borderWidth, 
      this.canvas.height - borderWidth
    )

    // Calculate sections based on inches, then convert to pixels
    const qrSectionWidth = 1.5 * dpi // Left 1.5 inches for QR code
    const infoSectionWidth = (width - 1.5) * dpi // Remaining width for text
    const padding = 0.1 * dpi // 0.1 inch padding

    // Generate QR code data
    const qrData = generateSimplifiedQRData(payload)

    // Create QR code element
    const qrElement = document.createElement('div')
    qrElement.style.width = `${qrSectionWidth - padding * 2}px`
    qrElement.style.height = `${qrSectionWidth - padding * 2}px`
    qrElement.style.position = 'absolute'
    qrElement.style.left = '-9999px'
    qrElement.style.top = '-9999px'

    // Render QR code using React
    document.body.appendChild(qrElement)
    const root = createRoot(qrElement)
    
    root.render(
      QRCodeSVG({
        value: qrData,
        size: qrSectionWidth - padding * 2,
        level: 'M'
      })
    )

    try {
      // Wait for React to render
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Convert QR to image and draw on canvas
      const qrSvg = qrElement.querySelector('svg')
      if (qrSvg) {
        const qrDataUrl = await this.svgToDataUrl(qrSvg)
        const qrImage = new Image()
        
        await new Promise((resolve, reject) => {
          qrImage.onload = resolve
          qrImage.onerror = reject
          qrImage.src = qrDataUrl
        })

        // Draw QR code at precise inch-based position
        if (!this.ctx) {
          throw new Error('Canvas context not initialized')
        }
        
        this.ctx.drawImage(
          qrImage,
          padding,
          padding,
          qrSectionWidth - padding * 2,
          qrSectionWidth - padding * 2
        )
      }

      // Draw text information using inch-based positioning
      this.drawTextInfo(payload, qrSectionWidth, padding, dpi, width, height)

    } finally {
      // Clean up
      root.unmount()
      document.body.removeChild(qrElement)
    }

    // Convert canvas to base64 PNG
    if (!this.canvas) {
      throw new Error('Canvas not initialized')
    }
    
    return this.canvas.toDataURL('image/png')
  }

  private async svgToDataUrl(svg: SVGElement): Promise<string> {
    const svgData = new XMLSerializer().serializeToString(svg)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)
    
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }
        
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)
        
        URL.revokeObjectURL(svgUrl)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = reject
      img.src = svgUrl
    })
  }

  private drawTextInfo(
    payload: QRPayload,
    qrSectionWidth: number,
    padding: number,
    dpi: number,
    labelWidth: number,
    labelHeight: number
  ) {
    if (!this.ctx) return

    const infoX = qrSectionWidth + padding
    const lineHeight = 0.12 * dpi // 0.12 inch line height
    const fontSize = 0.08 * dpi // 0.08 inch font size
    const maxWidth = (labelWidth * dpi) - infoX - padding

    this.ctx.fillStyle = '#000000'
    this.ctx.font = `bold ${fontSize}px Arial, sans-serif`
    this.ctx.textAlign = 'left'
    this.ctx.textBaseline = 'top'

    let y = padding

    // Company and Transaction (most important info)
    this.ctx.font = `bold ${fontSize * 1.2}px Arial, sans-serif`
    this.ctx.fillText(`Co: ${payload.company}`, infoX, y)
    y += lineHeight * 1.2
    this.ctx.fillText(`Tx: ${payload.transaction_no}`, infoX, y)
    y += lineHeight * 1.2

    // Box and SKU
    this.ctx.font = `bold ${fontSize}px Arial, sans-serif`
    this.ctx.fillText(`Box: ${payload.box_number}`, infoX, y)
    y += lineHeight
    this.ctx.fillText(`SKU: ${payload.sku_id}`, infoX, y)
    y += lineHeight

    // Item description (truncated to fit)
    const itemText = this.truncateText(payload.item_description, maxWidth, fontSize)
    this.ctx.fillText(`Item: ${itemText}`, infoX, y)
    y += lineHeight

    // Weights
    this.ctx.fillText(`Net: ${payload.net_weight}kg`, infoX, y)
    y += lineHeight
    this.ctx.fillText(`Gross: ${payload.total_weight}kg`, infoX, y)
    y += lineHeight

    // Dates (if space allows)
    if (y < (labelHeight * dpi) - lineHeight * 4) {
      if (payload.manufacturing_date) {
        const mfgDate = new Date(payload.manufacturing_date).toLocaleDateString()
        this.ctx.fillText(`Mfg: ${mfgDate}`, infoX, y)
        y += lineHeight
      }

      if (payload.expiry_date) {
        const expDate = new Date(payload.expiry_date).toLocaleDateString()
        this.ctx.fillText(`Exp: ${expDate}`, infoX, y)
        y += lineHeight
      }
    }

    // Batch number (if space allows)
    if (y < (labelHeight * dpi) - lineHeight * 2) {
      if (payload.batch_number) {
        const batchText = this.truncateText(payload.batch_number, maxWidth, fontSize)
        this.ctx.fillText(`Batch: ${batchText}`, infoX, y)
        y += lineHeight
      }
    }

    // Approval Authority (if space allows)
    if (y < (labelHeight * dpi) - lineHeight) {
      if (payload.approval_authority) {
        const authText = this.truncateText(payload.approval_authority, maxWidth, fontSize * 0.9)
        this.ctx.font = `${fontSize * 0.9}px Arial, sans-serif`
        this.ctx.fillText(`Auth: ${authText}`, infoX, y)
      }
    }
  }

  private truncateText(text: string, maxWidth: number, fontSize: number): string {
    if (!this.ctx) return text

    const words = text.split(' ')
    let truncated = ''
    
    for (const word of words) {
      const testText = truncated + (truncated ? ' ' : '') + word
      const metrics = this.ctx.measureText(testText)
      
      if (metrics.width <= maxWidth) {
        truncated = testText
      } else {
        break
      }
    }
    
    return truncated || text.substring(0, 20) + '...'
  }

  /**
   * Convert image to base64 for printing
   */
  async imageToBase64(imageDataUrl: string): Promise<string> {
    return imageDataUrl.split(',')[1] // Remove data:image/png;base64, prefix
  }



  /**
   * Generate label preview for testing (returns data URL)
   */
  async generatePreview(payload: QRPayload): Promise<string> {
    return await this.generateLabelImage(payload)
  }

  /**
   * Export label as downloadable file
   */
  async exportLabel(payload: QRPayload, filename?: string): Promise<void> {
    const imageDataUrl = await this.generateLabelImage(payload)
    const link = document.createElement('a')
    link.href = imageDataUrl
    link.download = filename || `label_box_${payload.box_number}_${payload.transaction_no}.png`
    link.click()
  }
}

// Export singleton instance
export const qrGenerator = new QRGenerator()
