// components/ui/printer-selector.tsx
"use client"

import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Printer, Wifi, Usb, Bluetooth, Monitor, RefreshCw } from "lucide-react"
import { printService, type PrinterInfo } from "@/lib/services/printService"

interface PrinterSelectorProps {
  onPrinterSelect?: (printerName: string) => void
  className?: string
}

export function PrinterSelector({ onPrinterSelect, className }: PrinterSelectorProps) {
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPrinters()
  }, [])

  const loadPrinters = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const availablePrinters = await printService.getAvailablePrinters()
      setPrinters(availablePrinters)
      
      // Auto-select first available label printer
      const labelPrinter = availablePrinters.find(p => 
        p.supports_label_printing && p.status === "online"
      )
      if (labelPrinter) {
        setSelectedPrinter(labelPrinter.name)
        printService.setSelectedPrinter(labelPrinter.name)
        onPrinterSelect?.(labelPrinter.name)
      }
    } catch (err) {
      setError(`Failed to load printers: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handlePrinterChange = (printerName: string) => {
    // Don't allow selection of the disabled "no-printers" option
    if (printerName === "no-printers") {
      return
    }
    
    setSelectedPrinter(printerName)
    printService.setSelectedPrinter(printerName)
    onPrinterSelect?.(printerName)
  }

  const getPrinterIcon = (type: string) => {
    switch (type) {
      case 'WiFi':
        return <Wifi className="h-4 w-4" />
      case 'USB':
        return <Usb className="h-4 w-4" />
      case 'Bluetooth':
        return <Bluetooth className="h-4 w-4" />
      case 'Network':
        return <Monitor className="h-4 w-4" />
      default:
        return <Printer className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-600'
      case 'offline':
        return 'text-red-600'
      case 'busy':
        return 'text-yellow-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-sm font-medium">Select Printer:</label>
        <Button
          variant="outline"
          size="sm"
          onClick={loadPrinters}
          disabled={loading}
          className="h-8"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Select value={selectedPrinter} onValueChange={handlePrinterChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a printer..." />
        </SelectTrigger>
        <SelectContent>
          {printers.length === 0 ? (
            <SelectItem value="no-printers" disabled>
              {loading ? "Loading printers..." : "No printers available"}
            </SelectItem>
          ) : (
            printers.map((printer) => (
              <SelectItem key={printer.name} value={printer.name}>
                <div className="flex items-center gap-2">
                  {getPrinterIcon(printer.type)}
                  <span>{printer.name}</span>
                  <span className={`text-xs ${getStatusColor(printer.status)}`}>
                    ({printer.status})
                  </span>
                  {!printer.supports_label_printing && (
                    <span className="text-xs text-orange-600">(No labels)</span>
                  )}
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {error && (
        <Alert className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {printers.length > 0 && (
        <div className="mt-2 text-xs text-muted-foreground">
          {printers.filter(p => p.status === 'online').length} of {printers.length} printers online
        </div>
      )}
    </div>
  )
}
