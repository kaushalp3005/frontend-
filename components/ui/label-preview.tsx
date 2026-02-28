// components/ui/label-preview.tsx
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Eye, Printer, RefreshCw } from "lucide-react"
// Dynamic import to avoid SSR issues
import type { QRPayload } from "@/types/qr"

interface LabelPreviewProps {
  payload: QRPayload
  onPrint?: (payload: QRPayload) => Promise<void>
  className?: string
}

export function LabelPreview({ payload, onPrint, className }: LabelPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    generatePreview()
  }, [payload])

  const generatePreview = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { qrGenerator } = await import('@/lib/utils/qrGenerator')
      const imageUrl = await qrGenerator.generatePreview(payload)
      setPreviewUrl(imageUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate preview')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    try {
      const { qrGenerator } = await import('@/lib/utils/qrGenerator')
      await qrGenerator.exportLabel(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download label')
    }
  }

  const handlePrint = async () => {
    if (onPrint) {
      try {
        await onPrint(payload)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to print label')
      }
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Label Preview</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {payload.box_number}
            </Badge>
            <Badge variant="secondary">
              {payload.company}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={generatePreview}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={loading || !previewUrl}
          >
            <Download className="h-4 w-4" />
            Download
          </Button>

          {onPrint && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={loading || !previewUrl}
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-600">Generating preview...</p>
            </div>
          </div>
        ) : previewUrl ? (
          <div className="space-y-2">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-2">
                Physical Size: 4.0" × 2.0" at 300 DPI
              </p>
            </div>
            <div className="flex justify-center">
              <img
                src={previewUrl}
                alt="Label Preview"
                className="border border-gray-300 rounded-lg shadow-sm"
                style={{
                  width: '300px', // Scaled down for preview
                  height: '150px',
                  imageRendering: 'pixelated' // Maintain crisp edges
                }}
              />
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">
                Preview scaled down. Actual print size: 4.0" × 2.0"
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg">
            <div className="text-center">
              <Eye className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600">No preview available</p>
            </div>
          </div>
        )}

        {/* Label Information */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="font-medium">Transaction:</span>
            <p className="text-gray-600">{payload.transaction_no}</p>
          </div>
          <div>
            <span className="font-medium">SKU:</span>
            <p className="text-gray-600">{payload.sku_id}</p>
          </div>
          <div>
            <span className="font-medium">Net Weight:</span>
            <p className="text-gray-600">{payload.net_weight}kg</p>
          </div>
          <div>
            <span className="font-medium">Gross Weight:</span>
            <p className="text-gray-600">{payload.total_weight}kg</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
