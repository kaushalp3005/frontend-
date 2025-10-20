import React, { useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

interface QRLabelProps {
  payload: {
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
    approval_authority?: string  // Add this field
  }
  qrData: string
  className?: string
  showDownload?: boolean
}

function formatDate(dateString: string): string {
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

export default function QRLabelComponent({ payload, qrData, className = "", showDownload = false }: QRLabelProps) {
  const labelRef = useRef<HTMLDivElement>(null)

  const downloadLabel = async () => {
    if (!labelRef.current) return

    try {
      // Use html2canvas to convert the label to image at 203 DPI
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(labelRef.current, {
        width: 812,  // 4 inches at 203 DPI
        height: 406, // 2 inches at 203 DPI
        scale: 1,
        backgroundColor: '#ffffff',
        useCORS: true,
      })

      // Download the image
      const link = document.createElement('a')
      link.download = `qr-label-${payload.transaction_no}-box-${payload.box_number}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (error) {
      console.error('Failed to download label:', error)
    }
  }

  return (
    <div className={`qr-label-container ${className}`}>
      {/* Label - Exactly 4" × 2" at 203 DPI */}
      <div
        ref={labelRef}
        className="qr-label bg-white border border-gray-400 flex print:border-black print:break-inside-avoid"
        style={{
          width: '4in',
          height: '2in',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        {/* Left Side - QR Code (50% width) */}
        <div 
          className="qr-section flex items-center justify-center p-1"
          style={{ width: '2in', height: '2in' }}
        >
          <QRCodeSVG
            value={qrData}
            size={170}
            level="M"
            includeMargin={false}
            className="max-w-full max-h-full"
          />
        </div>

        {/* Right Side - Information (50% width) */}
        <div 
          className="info-section flex flex-col p-2 text-black"
          style={{ 
            width: '2in', 
            height: '2in', 
            fontSize: '10pt', 
            lineHeight: '1.3',
            justifyContent: 'space-between'
          }}
        >
          {/* Top Section - Company + Transaction */}
          <div className="space-y-1">
            <div className="font-bold text-sm leading-none">
              {payload.company}
            </div>
            <div className="text-xs font-mono truncate leading-none">
              {payload.transaction_no}
            </div>
          </div>
          
          {/* Middle Section - Item Description with proper overflow handling */}
          <div 
            className="font-bold text-xs leading-tight overflow-hidden flex-1"
            style={{ 
              minHeight: '0.6in', 
              maxHeight: '0.9in',
              display: 'flex',
              alignItems: 'flex-start'
            }}
          >
            <div 
              className="line-clamp-3 break-words w-full"
              style={{
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                hyphens: 'auto',
                fontSize: '9pt',
                lineHeight: '1.2'
              }}
            >
              {payload.item_description}
            </div>
          </div>
          
          {/* Details Section */}
          <div className="text-xs space-y-1 leading-tight">
            <div className="flex items-center justify-between">
              <span className="font-medium">Box #{payload.box_number}</span>
              <span className="font-medium">{payload.net_weight}kg</span>
            </div>
            <div>
              <span className="font-medium">Entry: </span>
              <span>{formatDate(payload.entry_date)}</span>
            </div>
            {payload.expiry_date && (
              <div>
                <span className="font-medium text-red-600">Exp: </span>
                <span className="text-red-600">{formatDate(payload.expiry_date)}</span>
              </div>
            )}
            {payload.approval_authority && (
              <div>
                <span className="font-medium">Auth: </span>
                <span className="truncate text-xs">
                  {payload.approval_authority.length > 12 
                    ? payload.approval_authority.substring(0, 12) + "..." 
                    : payload.approval_authority
                  }
                </span>
              </div>
            )}
          </div>
          
          {/* Bottom Section - Batch */}
          <div className="text-xs text-gray-700 border-t border-gray-300 pt-1">
            {payload.batch_number && (
              <div className="truncate font-mono leading-none">
                {payload.batch_number.length > 20 
                  ? payload.batch_number.substring(0, 20) + "..." 
                  : payload.batch_number
                }
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Download Button (only shown when needed) */}
      {showDownload && (
        <div className="mt-2 print:hidden">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={downloadLabel}
            className="w-full"
          >
            <Download className="mr-2 h-4 w-4" />
            Download PNG
          </Button>
        </div>
      )}

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          .qr-label {
            width: 4in !important;
            height: 2in !important;
            page-break-after: always;
            page-break-inside: avoid;
            margin: 0;
            box-sizing: border-box;
          }
          
          @page {
            size: 4in 2in;
            margin: 0;
          }
        }
        
        @page { margin: 0mm; }
        @page :first { margin: 0mm; }
        @page :left { margin: 0mm; }
        @page :right { margin: 0mm; }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          word-break: break-word;
          overflow-wrap: break-word;
        }
        
        /* Ensure text doesn't overflow containers */
        .info-section * {
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
      `}</style>
    </div>
  )
}