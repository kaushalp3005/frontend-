// lib/hooks/usePrinters.ts
"use client"

import { useCallback, useEffect, useState } from "react"
import { qrGenerator } from "@/lib/utils/qrGenerator"

export interface Printer {
  name: string
  description?: string
  isDefault?: boolean
}

export interface PrinterSelection {
  selectedPrinter: string | null
  availablePrinters: Printer[]
  loading: boolean
  error: string | null
}

/**
 * Hook to manage available printers
 */
export function usePrinters() {
  const [printers, setPrinters] = useState<Printer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPrinters = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      console.log("=== FETCHING AVAILABLE PRINTERS ===")
      
      // Mock printers for now - in production, this would call an API
      const printerNames = ['Default Printer', 'Label Printer', 'Network Printer']
      console.log("Available printer names:", printerNames)
      
      // Transform printer names to Printer objects
      const printerObjects: Printer[] = printerNames.map((name: string, index: number) => ({
        name,
        description: `Printer ${index + 1}`,
        isDefault: index === 0 // First printer is default
      }))
      
      setPrinters(printerObjects)
      console.log("=== END PRINTERS FETCH ===")
    } catch (err) {
      console.error("Error fetching printers:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch printers")
      setPrinters([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPrinters()
  }, [fetchPrinters])

  return {
    printers,
    loading,
    error,
    refetch: fetchPrinters
  }
}

/**
 * Hook to manage printer selection state
 */
export function usePrinterSelection() {
  const { printers, loading, error, refetch } = usePrinters()
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null)

  // Auto-select default printer when printers are loaded
  useEffect(() => {
    if (printers.length > 0 && !selectedPrinter) {
      const defaultPrinter = printers.find(p => p.isDefault) || printers[0]
      setSelectedPrinter(defaultPrinter.name)
    }
  }, [printers, selectedPrinter])

  const selectPrinter = useCallback((printerName: string) => {
    setSelectedPrinter(printerName)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedPrinter(null)
  }, [])

  return {
    selectedPrinter,
    availablePrinters: printers,
    loading,
    error,
    selectPrinter,
    clearSelection,
    refetch
  }
}

/**
 * Hook to manage printing state and operations
 */
export function usePrinting() {
  const [printingBoxes, setPrintingBoxes] = useState<Set<number>>(new Set())
  const [isPrinting, setIsPrinting] = useState(false)

  const startPrinting = useCallback((boxNumber: number) => {
    setPrintingBoxes(prev => new Set(prev).add(boxNumber))
    setIsPrinting(true)
  }, [])

  const stopPrinting = useCallback((boxNumber: number) => {
    setPrintingBoxes(prev => {
      const newSet = new Set(prev)
      newSet.delete(boxNumber)
      return newSet
    })
    
    // Check if any boxes are still printing
    setPrintingBoxes(current => {
      if (current.size === 0) {
        setIsPrinting(false)
      }
      return current
    })
  }, [])

  const isBoxPrinting = useCallback((boxNumber: number) => {
    return printingBoxes.has(boxNumber)
  }, [printingBoxes])

  const clearAllPrinting = useCallback(() => {
    setPrintingBoxes(new Set())
    setIsPrinting(false)
  }, [])

  return {
    printingBoxes: Array.from(printingBoxes),
    isPrinting,
    startPrinting,
    stopPrinting,
    isBoxPrinting,
    clearAllPrinting
  }
}
