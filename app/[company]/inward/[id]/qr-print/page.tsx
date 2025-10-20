"use client"

import { useMemo, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Printer, Package, ArrowLeft, CheckCircle, AlertCircle, Wifi, Usb, Bluetooth, Monitor } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"

interface BoxData {
  id?: number
  transaction_no?: string
  box_number: number
  article?: string
  article_description?: string
  net_weight?: number
  gross_weight?: number
  lot_number?: string
}

interface ArticleGroup {
  article: string
  boxes: BoxData[]
}

interface PrinterInfo {
  name: string
  type: "USB" | "WiFi" | "Bluetooth" | "Network"
  status: "online" | "offline" | "busy"
  supports_label_printing: boolean
  max_width_inches?: number
  max_height_inches?: number
  dpi?: number
}

interface InwardRecord {
  transaction_id?: string
  transaction_no?: string
  company: string
  transaction?: {
    transaction_no?: string
    entry_date?: string
  }
  boxes?: BoxData[]
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""

export default function SimplifiedQRPrintPage() {
  const params = useParams()
  const company = params.company as string
  const transaction_no = params.id as string

  const [selectedBoxes, setSelectedBoxes] = useState<number[]>([])
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [record, setRecord] = useState<InwardRecord | null>(null)
  const [printJobId, setPrintJobId] = useState<string | null>(null)
  const [printProgress, setPrintProgress] = useState<number>(0)

  const boxes = record?.boxes || []

  useEffect(() => {
    loadRecord()
    loadPrinters()
  }, [transaction_no])

  const loadRecord = async () => {
    try {
      const response = await fetch(`${API_BASE}/inward/${company}/${transaction_no}`)
      
      if (response.ok) {
        const data = await response.json()
        setRecord(data)
        // Auto-select all boxes
        if (data.boxes && data.boxes.length > 0) {
          setSelectedBoxes(data.boxes.map((box: BoxData) => box.box_number))
        }
      } else {
        const errorText = await response.text()
        setError(`Failed to load record: HTTP ${response.status} - ${errorText}`)
      }
    } catch (err) {
      setError(`Failed to load transaction data: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const loadPrinters = async () => {
    try {
      const response = await fetch(`${API_BASE}/qr/available-printers`)
      if (!response.ok) {
        setError(`Failed to load printers: HTTP ${response.status}`)
        return
      }
      
      const data = await response.json()
      setPrinters(data.printers || [])

      // Auto-select first available label printer
      const labelPrinter = data.printers?.find((p: PrinterInfo) => 
        p.supports_label_printing && p.status === "online"
      )
      if (labelPrinter) {
        setSelectedPrinter(labelPrinter.name)
      }
    } catch (err) {
      setError(`Failed to load printers: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handlePrint = async () => {
    if (selectedBoxes.length === 0 || !record || !selectedPrinter) {
      setError("Please select boxes and a printer")
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)
    setPrintProgress(0)

    try {
      const printPayload = {
        transaction_no: record.transaction_id || record.transaction_no || record.transaction?.transaction_no,
        company: record.company,
        box_numbers: selectedBoxes,
        printer_name: selectedPrinter,
        print_settings: {
          width: "4in",
          height: "2in",
          dpi: 203,
          copies: 1,
        },
      }

      const response = await fetch(`${API_BASE}/qr/print-labels`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(printPayload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to create print job: ${errorText}`)
      }

      const printJob = await response.json()
      setPrintJobId(printJob.job_id)
      setSuccess(`Print job ${printJob.job_id} created successfully. ${printJob.labels_count} labels sent to ${selectedPrinter}`)
      
      // Start polling for print progress
      pollPrintProgress(printJob.job_id)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to print labels")
    } finally {
      setLoading(false)
    }
  }

  const pollPrintProgress = async (jobId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE}/qr/print-job/${jobId}`)
        if (response.ok) {
          const jobStatus = await response.json()
          setPrintProgress(jobStatus.progress || 0)
          
          if (jobStatus.status === 'completed') {
            setSuccess(`Print job completed successfully! All labels printed.`)
            return
          } else if (jobStatus.status === 'failed') {
            setError(`Print job failed: ${jobStatus.error_message}`)
            return
          }
          
          // Continue polling if still processing
          if (jobStatus.status === 'printing' || jobStatus.status === 'queued') {
            setTimeout(poll, 2000)
          }
        }
      } catch (err) {
        // Silently handle polling errors
      }
    }
    
    poll()
  }

  const toggleBox = (boxNumber: number) => {
    setSelectedBoxes(prev => 
      prev.includes(boxNumber) 
        ? prev.filter(x => x !== boxNumber) 
        : [...prev, boxNumber]
    )
  }

  const selectAll = () => setSelectedBoxes(boxes.map(b => b.box_number))
  const selectNone = () => setSelectedBoxes([])

  // Group boxes by article
  const articleGroups = useMemo((): ArticleGroup[] => {
    const groups: Record<string, BoxData[]> = {}
    boxes.forEach((box) => {
      const article = box.article || box.article_description || "Unknown Article"
      if (!groups[article]) groups[article] = []
      groups[article].push(box)
    })
    return Object.entries(groups).map(([article, boxes]) => ({ article, boxes }))
  }, [boxes])

  const getConnectionIcon = (type: string) => {
    switch (type) {
      case "WiFi": return <Wifi className="h-4 w-4" />
      case "USB": return <Usb className="h-4 w-4" />
      case "Bluetooth": return <Bluetooth className="h-4 w-4" />
      default: return <Monitor className="h-4 w-4" />
    }
  }

  if (!record) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading transaction data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/${company}/inward/${transaction_no}`}>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Details
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Printer className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Print QR Labels</h1>
                <p className="text-gray-600">Transaction {record.transaction_id} • {record.company}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mt-4 border-green-300 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {/* Print Progress */}
        {printJobId && printProgress > 0 && printProgress < 100 && (
          <Alert className="mt-4 border-blue-300 bg-blue-50">
            <Printer className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              Printing in progress... {printProgress}% complete
              <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${printProgress}%` }}
                ></div>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left Column: Box Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Package className="h-5 w-5" />
                Select Boxes
              </CardTitle>
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All ({boxes.length})
                </Button>
                <Button variant="outline" size="sm" onClick={selectNone}>
                  Clear Selection
                </Button>
                <Badge variant="secondary">
                  {selectedBoxes.length} selected
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto">
              <div className="space-y-4">
                {articleGroups.map((group) => (
                  <div key={group.article} className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-3 flex items-center justify-between">
                      <span>{group.article}</span>
                      <Badge variant="outline">{group.boxes.length} boxes</Badge>
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {group.boxes.map((box) => (
                        <div
                          key={box.box_number}
                          className={`flex items-center space-x-2 p-2 rounded cursor-pointer transition-colors ${
                            selectedBoxes.includes(box.box_number)
                              ? "bg-blue-50 border border-blue-300"
                              : "bg-gray-50 hover:bg-gray-100"
                          }`}
                          onClick={() => toggleBox(box.box_number)}
                        >
                          <Checkbox
                            checked={selectedBoxes.includes(box.box_number)}
                            onChange={() => toggleBox(box.box_number)}
                          />
                          <span className="text-sm font-medium">Box #{box.box_number}</span>
                          {box.net_weight && (
                            <span className="text-xs text-gray-500">{box.net_weight}kg</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Right Column: Printer Selection & Print */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Printer className="h-5 w-5" />
                Printer & Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Printer Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Select Printer</label>
                <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a printer..." className="truncate">
                      {selectedPrinter && (
                        <div className="flex items-center gap-2 truncate">
                          {getConnectionIcon(printers.find(p => p.name === selectedPrinter)?.type || "Network")}
                          <span className="truncate">{selectedPrinter}</span>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-w-md">
                    {printers.map((printer) => (
                      <SelectItem key={printer.name} value={printer.name} className="max-w-md">
                        <div className="flex items-center gap-3 w-full min-w-0">
                          {getConnectionIcon(printer.type)}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate" title={printer.name}>
                              {printer.name}
                            </div>
                            <div className="text-sm text-gray-500 truncate">
                              {printer.type} • {printer.status}
                            </div>
                          </div>
                          <Badge 
                            variant={printer.status === "online" ? "default" : "secondary"}
                            className={printer.status === "online" ? "bg-green-100 text-green-800 flex-shrink-0" : "flex-shrink-0"}
                          >
                            {printer.status}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Label Settings */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Label Specifications</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Size:</span>
                    <span className="ml-2 font-medium">4" × 2"</span>
                  </div>
                  <div>
                    <span className="text-gray-600">DPI:</span>
                    <span className="ml-2 font-medium">203</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Format:</span>
                    <span className="ml-2 font-medium">QR + Text</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Copies:</span>
                    <span className="ml-2 font-medium">1 per box</span>
                  </div>
                </div>
              </div>

              {/* Print Summary */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2 text-blue-800">Print Summary</h4>
                <div className="text-sm text-blue-700">
                  <div>Selected Boxes: {selectedBoxes.length}</div>
                  <div>Articles: {articleGroups.filter(g => g.boxes.some(b => selectedBoxes.includes(b.box_number))).length}</div>
                  <div>Total Labels: {selectedBoxes.length}</div>
                </div>
              </div>

              {/* Print Button */}
              <Button
                onClick={handlePrint}
                disabled={selectedBoxes.length === 0 || !selectedPrinter || loading}
                className="w-full h-12 text-lg"
                size="lg"
              >
                <Printer className="h-5 w-5 mr-2" />
                {loading ? "Processing..." : `Print ${selectedBoxes.length} Labels`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
  