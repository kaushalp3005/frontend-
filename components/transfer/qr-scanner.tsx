"use client"

import { useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Camera, X, Loader2, Keyboard } from "lucide-react"

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void
  onScanError?: (error: string) => void
}

export default function QRScanner({ onScanSuccess, onScanError }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualInput, setManualInput] = useState("")
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const qrCodeRegionId = "qr-reader"

  const startScanning = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // First, render the scanner element
      setShowScanner(true)
      setShowManualInput(false)

      // Wait for DOM element to be ready
      await new Promise(resolve => setTimeout(resolve, 300))

      // Check if element exists
      const element = document.getElementById(qrCodeRegionId)
      if (!element) {
        throw new Error('Scanner element not ready. Please try again.')
      }

      // Create scanner instance
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(qrCodeRegionId)
      }

      // Get cameras with detailed logging
      console.log('🎥 Requesting camera access...')
      const devices = await Html5Qrcode.getCameras()
      console.log('📷 Available cameras:', devices)
      
      if (devices && devices.length > 0) {
        // Prefer back camera, fallback to first available
        const backCamera = devices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('environment')
        ) || devices[0]

        console.log('✅ Selected camera:', backCamera.label)

        // Start scanning with optimized settings
        await scannerRef.current.start(
          { facingMode: "environment" }, // Try environment mode first
          {
            fps: 30, // Higher FPS for better detection
            qrbox: function(viewfinderWidth, viewfinderHeight) {
              // Make QR box 70% of the smaller dimension
              const minEdgePercentage = 0.7
              const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight)
              const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage)
              return {
                width: qrboxSize,
                height: qrboxSize
              }
            },
            aspectRatio: 1.0
          },
          (decodedText, decodedResult) => {
            // Success callback
            console.log('✅ QR Code detected:', decodedText)
            onScanSuccess(decodedText)
            stopScanning() // Auto-stop after successful scan
          },
          (errorMessage) => {
            // Error callback - fires frequently during scanning, ignore
          }
        ).catch((err) => {
          console.error('Start error:', err)
          throw new Error('Failed to start camera: ' + err)
        })

        setIsScanning(true)
        setIsLoading(false)
        console.log('📸 Camera started successfully')
      } else {
        throw new Error('No cameras found. Please check camera permissions.')
      }
    } catch (err: any) {
      console.error('❌ QR Scanner Error:', err)
      const errorMsg = err.message || 'Failed to start camera'
      setError(errorMsg)
      setIsLoading(false)
      setShowScanner(false)
      onScanError?.(errorMsg)
      
      // Show manual input as fallback
      setShowManualInput(true)
    }
  }

  const stopScanning = async () => {
    try {
      if (scannerRef.current && isScanning) {
        await scannerRef.current.stop()
        setIsScanning(false)
        setShowScanner(false)
        console.log('📷 Camera stopped')
      }
    } catch (err) {
      console.error('Error stopping scanner:', err)
    }
  }

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      console.log('⌨️ Manual input:', manualInput)
      onScanSuccess(manualInput.trim())
      setManualInput("")
      setShowManualInput(false)
    }
  }

  const toggleManualInput = () => {
    setShowManualInput(!showManualInput)
    if (isScanning) {
      stopScanning()
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current && isScanning) {
        scannerRef.current.stop().catch(console.error)
      }
    }
  }, [isScanning])

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      {!showScanner && !showManualInput ? (
        // Start Scan Button
        <div className="flex flex-col items-center space-y-4">
          <div className="w-40 h-40 bg-white border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center space-y-3">
            <div className="h-12 w-12 bg-gray-200 rounded flex items-center justify-center">
              <Camera className="h-6 w-6 text-gray-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">QR Scanner</p>
              <p className="text-xs text-gray-500 mt-1">Scan or enter manually</p>
            </div>
          </div>

          <div className="flex flex-col space-y-2 w-full max-w-xs">
            <Button
              type="button"
              onClick={startScanning}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white h-9 px-4 text-sm w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opening Camera...
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-4 w-4" />
                  Start Camera Scan
                </>
              )}
            </Button>

            <Button
              type="button"
              onClick={toggleManualInput}
              variant="outline"
              className="h-9 px-4 text-sm w-full"
            >
              <Keyboard className="mr-2 h-4 w-4" />
              Enter Box ID Manually
            </Button>
          </div>

          {error && (
            <div className="text-xs text-red-600 text-center max-w-xs bg-red-50 p-2 rounded">
              {error}
            </div>
          )}
        </div>
      ) : showManualInput ? (
        // Manual Input
        <div className="flex flex-col items-center space-y-4 w-full max-w-md">
          <div className="w-full bg-white p-4 rounded-lg border-2 border-gray-300">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Enter Box ID</h3>
            <div className="space-y-3">
              <Input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleManualSubmit()}
                placeholder="Enter CONS... or TR... ID"
                className="w-full h-10"
                autoFocus
              />
              <div className="flex space-x-2">
                <Button
                  type="button"
                  onClick={handleManualSubmit}
                  disabled={!manualInput.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white h-9"
                >
                  Add Box
                </Button>
                <Button
                  type="button"
                  onClick={toggleManualInput}
                  variant="outline"
                  className="flex-1 h-9"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
          
          <Button
            type="button"
            onClick={() => {
              setShowManualInput(false)
              startScanning()
            }}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            <Camera className="mr-2 h-3 w-3" />
            Switch to Camera Scan
          </Button>
        </div>
      ) : (
        // Scanner Active
        <div className="flex flex-col items-center space-y-4 w-full max-w-2xl">
          {/* Scanner Container - Larger, More Visible */}
          <div className="relative w-full bg-black rounded-xl overflow-hidden shadow-2xl border-4 border-blue-500">
            <div 
              id={qrCodeRegionId} 
              className="w-full min-h-[480px]" 
              style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center' 
              }}
            />
            
            {/* Scanner Overlay Info */}
            <div className="absolute top-4 left-4 right-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm p-3 rounded-lg shadow-lg">
              <div className="flex items-center justify-center space-x-2">
                <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="font-semibold">📸 Scanning... Position QR code in the center</span>
              </div>
            </div>

            {/* Bottom Instructions */}
            <div className="absolute bottom-4 left-4 right-4 bg-black/70 text-white text-xs p-2 rounded text-center">
              💡 Hold steady 4-8 inches from camera | High-speed detection active (20 FPS)
            </div>
          </div>

          {/* Stop Button */}
          <Button
            type="button"
            onClick={stopScanning}
            variant="outline"
            className="bg-white border-red-300 text-red-600 hover:bg-red-50 h-10 px-6 text-sm font-semibold shadow-lg"
          >
            <X className="mr-2 h-5 w-5" />
            Stop Scanning
          </Button>

          {/* Status Indicator */}
          <div className="flex items-center space-x-2 text-sm">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-gray-600">Camera active - Position QR code</span>
          </div>
        </div>
      )}
    </div>
  )
}
