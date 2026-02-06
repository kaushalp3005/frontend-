"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Package, Search, Camera, ArrowLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { InterunitApiService } from "@/lib/interunitApiService"
import { secureApiClient } from "@/lib/auth/secureApiClient"
import HighPerformanceQRScanner from "@/components/transfer/high-performance-qr-scanner"
import type { Company } from "@/types/auth"

interface TransferInPageProps {
  params: {
    company: Company
  }
}

export default function TransferInPage({ params }: TransferInPageProps) {
  const { company } = params
  const router = useRouter()
  const { toast } = useToast()

  const [transferNumber, setTransferNumber] = useState("")
  const [loading, setLoading] = useState(false)
  const [transferData, setTransferData] = useState<any>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [showBoxScanner, setShowBoxScanner] = useState(false)
  const [boxesMatchMap, setBoxesMatchMap] = useState<Record<string, boolean>>({})
  const [boxCondition, setBoxCondition] = useState("Good")
  const [conditionRemarks, setConditionRemarks] = useState("")

  // ROI Configuration for sequential box scanning
  const roiConfig = {
    widthPercentage: 60,  // Scan only central 60% of width
    heightPercentage: 60  // Scan only central 60% of height
  }

  // Load transfer details by transfer number
  const loadTransferDetails = async (transferNo: string) => {
    if (!transferNo.trim()) {
      toast({
        title: "Error",
        description: "Please enter a transfer number",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      console.log('🔍 Loading transfer details for:', transferNo)
      
      // Search by transfer number
      const response = await InterunitApiService.getTransferByNumber(company, transferNo)
      
      console.log('✅ Transfer details loaded:', response)
      console.log('📦 Boxes in response:', response.boxes)
      setTransferData(response)

      // Initialize boxes match map: default false (unmatched)
      const initialMap: Record<string, boolean> = {}
      const boxes = response.boxes || []
      console.log('📊 Initializing match map for', boxes.length, 'boxes')
      
      if (Array.isArray(boxes)) {
        boxes.forEach((b: any) => {
          const key = b.box_number || b.id
          initialMap[key] = false
        })
      }
      
      console.log('🗺️ Initial match map:', initialMap)
      setBoxesMatchMap(initialMap)
      
      toast({
        title: "Transfer Loaded",
        description: `Transfer ${response.transfer_no || response.challan_no} loaded with ${response.lines?.length || 0} items`,
      })
    } catch (error: any) {
      console.error('❌ Failed to load transfer:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to load transfer details",
        variant: "destructive",
      })
      setTransferData(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    loadTransferDetails(transferNumber)
  }

  const handleQRScanSuccess = async (decodedText: string) => {
    console.log('📱 QR Code Scanned:', decodedText)
    console.log('📦 Transfer Data exists:', !!transferData)
    console.log('📦 Boxes:', transferData?.boxes)
    
    setShowScanner(false)
    setShowBoxScanner(false)
    
    // If transfer is already loaded, treat this as a box scan
    if (transferData && transferData.boxes) {
      console.log('🔍 Processing as box scan...')
      
      // Try to extract batch/transaction from QR text
      let scannedBatch = ''
      let scannedTransNo = ''
      
      try {
        const parsed = JSON.parse(decodedText)
        console.log('📄 Parsed QR data:', parsed)
        
        // Extract batch number (bn, batch_number, lot_number, batch)
        scannedBatch = (
          parsed.bn || 
          parsed.batch_number || 
          parsed.lot_number || 
          parsed.batch || 
          ''
        ).toString().trim()
        
        // Extract transaction/consumption number (cn, transaction_no, trans_no, consumption_no, cons_no)
        scannedTransNo = (
          parsed.cn || 
          parsed.transaction_no || 
          parsed.trans_no || 
          parsed.consumption_no || 
          parsed.cons_no || 
          ''
        ).toString().trim()
        
        console.log('🏷️ Extracted from QR - Batch:', scannedBatch, '| Trans/Cons No:', scannedTransNo)
      } catch (e) {
        // not JSON, maybe plain text containing batch
        console.log('📝 Treating as plain text batch number')
        scannedBatch = decodedText.trim()
      }

      console.log('🏷️ Final scan data - Batch:', scannedBatch, '| Trans No:', scannedTransNo)

      if (scannedBatch || scannedTransNo) {
        // Mark matched boxes where BOTH batch_number AND transaction_no match
        const newMap: Record<string, boolean> = { ...boxesMatchMap }
        let foundMatch = false
        let matchedBoxes: string[] = []
        
        transferData.boxes.forEach((b: any) => {
          const boxBatch = (b.batch_number || b.lot_number || '').toString().trim()
          const boxTransNo = (b.transaction_no || '').toString().trim()
          
          console.log(`📦 Box ${b.box_number}:`)
          console.log(`   - DB Batch: "${boxBatch}" vs Scanned: "${scannedBatch}"`)
          console.log(`   - DB Trans: "${boxTransNo}" vs Scanned: "${scannedTransNo}"`)
          
          // Match logic: Both batch AND transaction_no must match
          const batchMatch = scannedBatch && boxBatch && boxBatch === scannedBatch
          const transMatch = scannedTransNo && boxTransNo && boxTransNo === scannedTransNo
          
          console.log(`   - Batch Match: ${batchMatch}, Trans Match: ${transMatch}`)
          
          if (batchMatch && transMatch) {
            newMap[b.box_number || b.id] = true
            foundMatch = true
            matchedBoxes.push(b.box_number)
            console.log(`✅ MATCH FOUND for box ${b.box_number}`)
          }
        })
        
        setBoxesMatchMap(newMap)
        
        if (foundMatch) {
          toast({ 
            title: '✓ Box Matched', 
            description: `Matched boxes: ${matchedBoxes.join(', ')} (Batch: ${scannedBatch}, Trans: ${scannedTransNo})`,
          })
        } else {
          toast({ 
            title: '✗ No Match', 
            description: `No box found with Batch: "${scannedBatch}" AND Trans No: "${scannedTransNo}"`,
            variant: "destructive"
          })
        }
        return
      }
    }
    
    // Otherwise, treat as transfer number scan
    console.log('🔍 Processing as transfer number scan...')
    try {
      const qrData = JSON.parse(decodedText)
      
      // Check if QR contains transfer number
      if (qrData.transfer_no || qrData.challan_no) {
        const transferNo = qrData.transfer_no || qrData.challan_no
        setTransferNumber(transferNo)
        loadTransferDetails(transferNo)
        return
      }
    } catch (error) {
      // Plain text - treat as transfer number
      setTransferNumber(decodedText)
      loadTransferDetails(decodedText)
      return
    }
    
    toast({
      title: "Invalid QR Code",
      description: "QR code format not recognized",
      variant: "destructive",
    })
  }

  const handleQRScanError = (error: string) => {
    console.error('QR Scan Error:', error)
    toast({
      title: "Scanner Error",
      description: error,
      variant: "destructive",
    })
  }

  const handleConfirmReceipt = async () => {
    if (!transferData) return

    try {
      setLoading(true)
      console.log('✅ Confirming transfer receipt:', transferData.id)
      console.log('📦 Box Condition:', boxCondition)
      console.log('📝 Remarks:', conditionRemarks)
      
      // Prepare scanned boxes data
      const scannedBoxes = (transferData.boxes || [])
        .filter((b: any) => boxesMatchMap[b.box_number || b.id])
        .map((b: any) => ({
          box_number: String(b.box_number || b.id || ''),
          article: b.article ? String(b.article) : null,
          batch_number: b.batch_number ? String(b.batch_number) : null,
          lot_number: b.lot_number ? String(b.lot_number) : null,
          transaction_no: b.transaction_no ? String(b.transaction_no) : null,
          net_weight: b.net_weight ? Number(b.net_weight) : null,
          gross_weight: b.gross_weight ? Number(b.gross_weight) : null,
          is_matched: true
        }))
      
      console.log('📦 Scanned boxes to save:', scannedBoxes.length)
      console.log('📦 First box data:', scannedBoxes[0])
      
      // Generate GRN number (you can customize this format)
      const grnNumber = `GRN-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${String(new Date().getHours()).padStart(2, '0')}${String(new Date().getMinutes()).padStart(2, '0')}${String(new Date().getSeconds()).padStart(2, '0')}`
      
      // Create Transfer IN via backend API with authentication
      const data = await secureApiClient.post('/interunit/transfer-in', {
        transfer_out_id: transferData.id,
        grn_number: grnNumber,
        receiving_warehouse: transferData.to_warehouse || transferData.to_site_code || 'UNKNOWN',
        received_by: 'USER',  // You can get from auth context
        box_condition: boxCondition,
        condition_remarks: conditionRemarks.trim() || null,
        scanned_boxes: scannedBoxes
      })

      console.log('✅ Transfer IN created:', data)
      
      toast({
        title: "Transfer IN Created",
        description: `GRN ${grnNumber} created successfully with ${scannedBoxes.length} boxes.`,
      })
      
      // Redirect back to transfer page after 2 seconds
      setTimeout(() => {
        router.push(`/${company}/transfer`)
      }, 2000)
      
    } catch (error: any) {
      console.error('❌ Failed to confirm transfer:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to confirm transfer receipt",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 bg-gray-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/${company}/transfer`)}
          className="h-8 px-3 text-xs bg-white"
        >
          <ArrowLeft className="mr-2 h-3 w-3" />
          Back
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Transfer IN</h1>
          <p className="text-xs text-muted-foreground">Receive incoming stock transfers</p>
        </div>
      </div>

      {/* Transfer Number Input */}
      <Card className="w-full bg-gray-50 border-gray-200">
        <CardHeader className="pb-3 bg-gray-100">
          <CardTitle className="text-base font-semibold text-gray-700">
            Enter Transfer Number
          </CardTitle>
          <p className="text-xs text-gray-500">
            Enter the transfer number or scan QR code to load transfer details
          </p>
        </CardHeader>
        <CardContent className="pt-4 bg-gray-50">
          <div className="space-y-4">
            {/* Input and Buttons */}
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="transferNumber" className="text-xs font-medium text-gray-600">
                  Transfer Number *
                </Label>
                <Input
                  id="transferNumber"
                  type="text"
                  value={transferNumber}
                  onChange={(e) => setTransferNumber(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full h-10 bg-white border-gray-300 text-gray-700"
                  placeholder="TRANS202510191445"
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={loading || !transferNumber.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-4"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
              <Button
                onClick={() => setShowScanner(true)}
                variant="outline"
                className="h-10 px-4 bg-white"
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>

            {/* QR Scanner */}
            {showScanner && (
              <div className="border-2 border-blue-300 rounded-lg overflow-hidden">
                <div className="h-[300px] sm:h-[400px] md:h-[480px]">
                  <HighPerformanceQRScanner
                    onScanSuccess={handleQRScanSuccess}
                    onScanError={handleQRScanError}
                    onClose={() => setShowScanner(false)}
                    roiConfig={roiConfig}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transfer Details - Show when loaded */}
      {transferData && (
        <>
          {/* Scanner Section - Simple UI */}
          <Card className="w-full bg-white border-gray-200">
            <CardHeader className="pb-3 bg-blue-600 text-white">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  Scan Boxes - {transferData.challan_no || transferData.transfer_no}
                </CardTitle>
                <Badge className="bg-white text-blue-600 font-semibold">
                  {(transferData.boxes || []).filter((b: any) => boxesMatchMap[b.box_number || b.id]).length} / {(transferData.boxes || []).length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {!showBoxScanner ? (
                <div className="text-center py-6">
                  <Button 
                    onClick={() => setShowBoxScanner(true)} 
                    className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Camera className="w-4 h-4 mr-2" /> 
                    Open Scanner
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-blue-200 rounded overflow-hidden">
                  <div className="h-[320px] sm:h-[420px] md:h-[500px]">
                    <HighPerformanceQRScanner
                      onScanSuccess={(data) => handleQRScanSuccess(data)}
                      onScanError={(err) => handleQRScanError(err)}
                      onClose={() => setShowBoxScanner(false)}
                      roiConfig={roiConfig}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Boxes Table Section */}
          <Card className="w-full bg-white border-gray-200">
            <CardHeader className="pb-3 bg-gray-50">
              <CardTitle className="text-base font-semibold text-gray-800">
                Boxes List ({(transferData.boxes || []).length} Total)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              {/* Boxes Table */}
              <div className="overflow-x-auto border rounded">
                <table className="w-full min-w-[640px] table-auto border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-left">
                      <th className="p-2 border">Box #</th>
                      <th className="p-2 border">Item / Article</th>
                      <th className="p-2 border">Batch / Lot</th>
                      <th className="p-2 border">Net Wt (g)</th>
                      <th className="p-2 border">Gross Wt (g)</th>
                      <th className="p-2 border text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(transferData.boxes || []).map((b: any, idx: number) => {
                      const key = b.box_number || b.id
                      const matched = !!boxesMatchMap[key]
                      return (
                        <tr 
                          key={key} 
                          className={`${matched ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                        >
                          <td className="p-2 border">{b.box_number || b.id}</td>
                          <td className="p-2 border">{b.article || '-'}</td>
                          <td className="p-2 border font-mono text-sm">
                            {b.batch_number || b.lot_number || '-'}
                          </td>
                          <td className="p-2 border">{b.net_weight || '-'}</td>
                          <td className="p-2 border">{b.gross_weight || '-'}</td>
                          <td className="p-2 border text-center">
                            {matched ? (
                              <span className="text-green-600 font-semibold">✓ Matched</span>
                            ) : (
                              <span className="text-red-600">✗ Unmatched</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Box Condition and Remarks Section */}
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Box Condition Dropdown */}
                  <div className="space-y-2">
                    <Label htmlFor="boxCondition" className="text-sm font-medium text-gray-700">
                      Box Condition
                    </Label>
                    <Select value={boxCondition} onValueChange={setBoxCondition}>
                      <SelectTrigger id="boxCondition" className="h-10 bg-white">
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Good">Good</SelectItem>
                        <SelectItem value="Damaged">Damaged</SelectItem>
                        <SelectItem value="Partial">Partial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Remarks Textarea */}
                  <div className="space-y-2">
                    <Label htmlFor="conditionRemarks" className="text-sm font-medium text-gray-700">
                      Remarks <span className="text-gray-400 font-normal">(Optional)</span>
                    </Label>
                    <Textarea
                      id="conditionRemarks"
                      value={conditionRemarks}
                      onChange={(e) => setConditionRemarks(e.target.value)}
                      placeholder="Enter any remarks about box condition..."
                      className="h-10 resize-none bg-white"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Confirm Receipt Button */}
          <Card className="w-full bg-white border-gray-200">
            <CardContent className="pt-4 pb-4">
              <Button
                onClick={handleConfirmReceipt}
                disabled={
                  loading ||
                  (transferData.boxes || []).length === 0 ||
                  (transferData.boxes || []).some((b: any) => !boxesMatchMap[b.box_number || b.id])
                }
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Confirming...</>
                ) : (transferData.boxes || []).length === 0 ? (
                  "No Boxes to Confirm"
                ) : (transferData.boxes || []).some((b: any) => !boxesMatchMap[b.box_number || b.id]) ? (
                  `Scan All Boxes to Continue (${(transferData.boxes || []).filter((b: any) => boxesMatchMap[b.box_number || b.id]).length}/${(transferData.boxes || []).length} scanned)`
                ) : (
                  "✓ Confirm Receipt - All Boxes Matched"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Items List Card */}
          <Card className="w-full bg-gray-50 border-gray-200">
            <CardHeader className="pb-3 bg-gray-100">
              <CardTitle className="text-base font-semibold text-gray-700">
                Items to Receive ({transferData.lines?.length || 0})
              </CardTitle>
              <p className="text-xs text-gray-500">
                Expected boxes: <strong>{transferData.total_qty_required || 0}</strong> | 
                Received: <strong className="text-green-600">{transferData.boxes_provided || 0}</strong> | 
                Pending: <strong className="text-red-600">{transferData.boxes_pending || 0}</strong>
              </p>
            </CardHeader>
            <CardContent className="pt-0 bg-gray-50">
              {transferData.lines && transferData.lines.length > 0 ? (
                <div className="space-y-2">
                  {transferData.lines.map((item: any, index: number) => (
                    <div 
                      key={index}
                      className="bg-white p-3 rounded border border-gray-200 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-gray-400" />
                            <p className="font-semibold text-sm text-gray-800">
                              {item.item_desc_raw || item.item_description}
                            </p>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-gray-500">Category:</span>
                              <span className="ml-1 font-medium">{item.item_category}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Qty:</span>
                              <span className="ml-1 font-bold text-blue-600">{item.qty || item.quantity}</span>
                              <span className="ml-1 text-gray-500">{item.uom}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Weight:</span>
                              <span className="ml-1 font-medium">{item.net_weight}g</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                            Pending: {item.qty || item.quantity}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-sm">No items found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty State */}
      {!transferData && !loading && (
        <Card className="w-full bg-gray-50 border-gray-200">
          <CardContent className="pt-12 pb-12 bg-gray-50">
            <div className="text-center text-gray-500">
              <Package className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <p className="text-sm">Enter a transfer number to load details</p>
              <p className="text-xs mt-2">Or scan QR code to get started</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
