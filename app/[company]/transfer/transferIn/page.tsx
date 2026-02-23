"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Loader2, Package, Search, Camera, ArrowLeft, Inbox,
  CheckCircle, XCircle, ClipboardCheck, CheckCheck, Hash
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { InterunitApiService } from "@/lib/interunitApiService"

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
  const [boxesMatchMap, setBoxesMatchMap] = useState<Record<number, boolean>>({})
  const [boxCondition, setBoxCondition] = useState("Good")
  const [conditionRemarks, setConditionRemarks] = useState("")

  // ── Derived state ──
  const matchedCount = transferData
    ? (transferData.boxes || []).filter((b: any) => boxesMatchMap[b.id]).length
    : 0
  const totalBoxes = transferData ? (transferData.boxes || []).length : 0
  const allBoxesMatched = totalBoxes > 0 && matchedCount === totalBoxes

  // ── Group boxes by article ──
  const groupedBoxes = useMemo(() => {
    if (!transferData?.boxes) return {}
    const groups: Record<string, any[]> = {}
    transferData.boxes.forEach((b: any) => {
      const article = b.article || 'Unknown Article'
      if (!groups[article]) groups[article] = []
      groups[article].push(b)
    })
    return groups
  }, [transferData])

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
      const response = await InterunitApiService.getTransferByNumber(company, transferNo)
      setTransferData(response)

      const initialMap: Record<number, boolean> = {}
      const boxes = response.boxes || []
      if (Array.isArray(boxes)) {
        boxes.forEach((b: any) => {
          initialMap[b.id] = false
        })
      }
      setBoxesMatchMap(initialMap)

      toast({
        title: "Transfer Loaded",
        description: `Transfer ${response.transfer_no || response.challan_no} loaded with ${boxes.length} boxes`,
      })
    } catch (error: any) {
      console.error('Failed to load transfer:', error)
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

  // ── Handler: Transfer number scanner (single-scan, closes after) ──
  const handleTransferQRScan = (decodedText: string) => {
    setShowScanner(false)

    try {
      const qrData = JSON.parse(decodedText)
      if (qrData.transfer_no || qrData.challan_no) {
        const transferNo = qrData.transfer_no || qrData.challan_no
        setTransferNumber(transferNo)
        loadTransferDetails(transferNo)
        return
      }
    } catch {
      // Not JSON — treat as raw transfer number
    }

    setTransferNumber(decodedText)
    loadTransferDetails(decodedText)
  }

  // ── Handler: Acknowledge single box ──
  const handleAcknowledge = (boxId: number) => {
    setBoxesMatchMap(prev => ({ ...prev, [boxId]: true }))
    toast({ title: 'Box Acknowledged', description: `Box ID #${boxId} acknowledged` })
  }

  // ── Handler: Acknowledge all boxes ──
  const handleAcknowledgeAll = () => {
    if (!transferData?.boxes) return
    const newMap = { ...boxesMatchMap }
    transferData.boxes.forEach((b: any) => {
      newMap[b.id] = true
    })
    setBoxesMatchMap(newMap)
    toast({ title: 'All Boxes Acknowledged', description: `${totalBoxes} boxes acknowledged successfully` })
  }

  // ── Handler: Acknowledge all boxes for a specific article ──
  const handleAcknowledgeArticle = (articleName: string) => {
    const articleBoxes = groupedBoxes[articleName] || []
    if (articleBoxes.length === 0) return
    const newMap = { ...boxesMatchMap }
    articleBoxes.forEach((b: any) => {
      newMap[b.id] = true
    })
    setBoxesMatchMap(newMap)
    toast({ title: 'Article Acknowledged', description: `All ${articleBoxes.length} boxes for "${articleName}" acknowledged` })
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

      const scannedBoxes = (transferData.boxes || [])
        .filter((b: any) => boxesMatchMap[b.id])
        .map((b: any) => ({
          box_number: String(b.box_number || b.id || ''),
          transfer_out_box_id: b.id,
          article: b.article ? String(b.article) : null,
          batch_number: b.batch_number ? String(b.batch_number) : null,
          lot_number: b.lot_number ? String(b.lot_number) : null,
          transaction_no: b.transaction_no ? String(b.transaction_no) : null,
          net_weight: b.net_weight ? Number(b.net_weight) : null,
          gross_weight: b.gross_weight ? Number(b.gross_weight) : null,
          is_matched: true
        }))

      const grnNumber = `GRN-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${String(new Date().getHours()).padStart(2, '0')}${String(new Date().getMinutes()).padStart(2, '0')}${String(new Date().getSeconds()).padStart(2, '0')}`

      await InterunitApiService.createTransferIn({
        transfer_out_id: transferData.id,
        grn_number: grnNumber,
        receiving_warehouse: transferData.to_warehouse || transferData.to_site_code || 'UNKNOWN',
        received_by: 'USER',
        box_condition: boxCondition,
        condition_remarks: conditionRemarks.trim() || null,
        scanned_boxes: scannedBoxes
      })

      toast({
        title: "Transfer IN Created",
        description: `GRN ${grnNumber} created successfully with ${scannedBoxes.length} boxes.`,
      })

      setTimeout(() => {
        router.push(`/${company}/transfer`)
      }, 2000)

    } catch (error: any) {
      console.error('Failed to confirm transfer:', error)
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
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 bg-gray-50 min-h-screen">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/${company}/transfer`)}
          className="h-9 w-9 p-0 bg-white border-gray-200 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Inbox className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600" />
            Transfer IN
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Receive incoming stock transfers</p>
        </div>
      </div>

      {/* ── Transfer Number Input ── */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-teal-50 to-emerald-50 border-b">
          <CardTitle className="text-base sm:text-lg font-semibold text-gray-800">
            Find Transfer
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter the transfer number or scan QR code to load transfer details
          </p>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <div className="space-y-4">
            {/* Input and Buttons - stacks on mobile */}
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="transferNumber" className="text-sm font-medium text-gray-600">
                  Transfer Number *
                </Label>
                <Input
                  id="transferNumber"
                  type="text"
                  value={transferNumber}
                  onChange={(e) => setTransferNumber(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="h-10 bg-white border-gray-200"
                  placeholder="TRANS202510191445"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSearch}
                  disabled={loading || !transferNumber.trim()}
                  className="flex-1 sm:flex-initial h-10 px-4 bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="h-4 w-4 sm:mr-0" />
                      <span className="sm:hidden ml-2">Search</span>
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => setShowScanner(true)}
                  variant="outline"
                  className="h-10 px-4 bg-white border-gray-200"
                >
                  <Camera className="h-4 w-4 sm:mr-0" />
                  <span className="sm:hidden ml-2">Scan</span>
                </Button>
              </div>
            </div>

            {/* Transfer Number QR Scanner (single-scan mode) */}
            {showScanner && (
              <div className="border-2 border-teal-200 rounded-lg overflow-hidden">
                <div className="max-h-[60vh]">
                  <HighPerformanceQRScanner
                    onScanSuccess={handleTransferQRScan}
                    onScanError={handleQRScanError}
                    onClose={() => setShowScanner(false)}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Transfer Details - Show when loaded ── */}
      {transferData && (
        <>
          {/* Box Acknowledgement — grouped by article */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-teal-50 to-emerald-50 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <Package className="h-5 w-5 text-teal-600" />
                    Box Acknowledgement
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {transferData.challan_no || transferData.transfer_no} — {totalBoxes} boxes across {Object.keys(groupedBoxes).length} article{Object.keys(groupedBoxes).length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                    {matchedCount} acknowledged
                  </Badge>
                  {totalBoxes - matchedCount > 0 && (
                    <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                      {totalBoxes - matchedCount} pending
                    </Badge>
                  )}
                </div>
              </div>
              {!allBoxesMatched && totalBoxes > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAcknowledgeAll}
                  className="mt-3 h-9 text-sm bg-white border-teal-200 text-teal-700 hover:bg-teal-50"
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
                  Acknowledge All ({totalBoxes})
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {Object.entries(groupedBoxes).map(([articleName, boxes]) => {
                const articleMatchedCount = boxes.filter((b: any) => boxesMatchMap[b.id]).length
                const articleTotal = boxes.length
                const allArticleMatched = articleMatchedCount === articleTotal

                return (
                  <div key={articleName} className="border-b last:border-b-0">
                    {/* Article group header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 text-violet-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{articleName}</p>
                          <p className="text-xs text-muted-foreground">{articleTotal} box{articleTotal !== 1 ? 'es' : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={`text-xs ${allArticleMatched ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          {articleMatchedCount}/{articleTotal}
                        </Badge>
                        {!allArticleMatched && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAcknowledgeArticle(articleName)}
                            className="text-xs text-teal-600 hover:text-teal-800 h-7 px-2"
                          >
                            <CheckCheck className="h-3 w-3 mr-1" />
                            All
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Box rows for this article */}
                    <div className="divide-y divide-gray-100">
                      {boxes.map((b: any) => {
                        const matched = !!boxesMatchMap[b.id]
                        return (
                          <div key={b.id} className={`px-4 py-3 ${matched ? 'bg-emerald-50/40' : ''}`}>
                            {/* Mobile layout */}
                            <div className="md:hidden space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1 text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                    <Hash className="h-3 w-3" />{b.id}
                                  </span>
                                  <span className="text-sm font-semibold text-gray-900">Box {b.box_number}</span>
                                </div>
                                {matched ? (
                                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Done
                                  </Badge>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAcknowledge(b.id)}
                                    className="text-xs text-teal-700 border-teal-200 hover:bg-teal-50 h-7 px-2.5"
                                  >
                                    Acknowledge
                                  </Button>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm pl-1">
                                <div>
                                  <span className="text-gray-500">Batch:</span>
                                  <span className="ml-1 font-mono font-medium">{b.batch_number || b.lot_number || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Trans No:</span>
                                  <span className="ml-1 font-mono font-medium">{b.transaction_no || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Net Wt:</span>
                                  <span className="ml-1 font-medium">{b.net_weight || '-'}g</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Gross Wt:</span>
                                  <span className="ml-1 font-medium">{b.gross_weight || '-'}g</span>
                                </div>
                              </div>
                            </div>

                            {/* Desktop layout */}
                            <div className="hidden md:flex items-center gap-4">
                              <span className="inline-flex items-center gap-1 text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded shrink-0">
                                <Hash className="h-3 w-3" />{b.id}
                              </span>
                              <span className="text-sm font-semibold text-gray-900 w-20 shrink-0">Box {b.box_number}</span>
                              <span className="text-sm font-mono text-gray-600 w-32 truncate">{b.batch_number || b.lot_number || '-'}</span>
                              <span className="text-sm font-mono text-gray-600 w-36 truncate">{b.transaction_no || '-'}</span>
                              <span className="text-sm text-gray-600 w-24">{b.net_weight || '-'}g</span>
                              <span className="text-sm text-gray-600 w-24">{b.gross_weight || '-'}g</span>
                              <div className="ml-auto shrink-0">
                                {matched ? (
                                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Acknowledged
                                  </Badge>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAcknowledge(b.id)}
                                    className="text-xs text-teal-700 border-teal-200 hover:bg-teal-50 h-7 px-3"
                                  >
                                    Acknowledge
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* Empty state */}
              {totalBoxes === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <Package className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-sm text-muted-foreground">No boxes in this transfer</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Box Condition & Remarks */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b">
              <CardTitle className="text-base sm:text-lg font-semibold text-gray-800">
                Condition Assessment
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="boxCondition" className="text-sm font-medium text-gray-600">
                    Box Condition
                  </Label>
                  <Select value={boxCondition} onValueChange={setBoxCondition}>
                    <SelectTrigger id="boxCondition" className="h-9 bg-white border-gray-200">
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Good">Good</SelectItem>
                      <SelectItem value="Damaged">Damaged</SelectItem>
                      <SelectItem value="Partial">Partial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="conditionRemarks" className="text-sm font-medium text-gray-600">
                    Remarks <span className="text-gray-400 font-normal">(Optional)</span>
                  </Label>
                  <Textarea
                    id="conditionRemarks"
                    value={conditionRemarks}
                    onChange={(e) => setConditionRemarks(e.target.value)}
                    placeholder="Enter any remarks about box condition..."
                    className="min-h-[38px] resize-none bg-white border-gray-200"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Confirm Receipt Button */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-4 sm:p-5">
              <Button
                onClick={handleConfirmReceipt}
                disabled={loading || totalBoxes === 0 || !allBoxesMatched}
                className={`w-full h-12 font-semibold text-sm sm:text-base transition-all ${
                  allBoxesMatched
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Confirming...</>
                ) : totalBoxes === 0 ? (
                  "No Boxes to Confirm"
                ) : !allBoxesMatched ? (
                  <span className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Acknowledge All Boxes to Continue ({matchedCount}/{totalBoxes})
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5" />
                    Confirm Receipt — All Boxes Acknowledged
                  </span>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Items to Receive */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg font-semibold text-gray-800">
                    Items to Receive
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">{transferData.lines?.length || 0} line items</p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Expected: <strong className="text-gray-800">{transferData.total_qty_required || 0}</strong></span>
                  <span className="text-muted-foreground">Received: <strong className="text-emerald-600">{transferData.boxes_provided || 0}</strong></span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {transferData.lines && transferData.lines.length > 0 ? (
                <div className="divide-y">
                  {transferData.lines.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="p-4 hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-gray-400 shrink-0" />
                            <p className="font-semibold text-base text-gray-800 truncate">
                              {item.item_desc_raw || item.item_description}
                            </p>
                          </div>
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-3 text-sm">
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
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 shrink-0">
                          Pending: {item.qty || item.quantity}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <Package className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-sm text-muted-foreground">No items found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty State */}
      {!transferData && !loading && (
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="h-16 w-16 rounded-full bg-teal-50 flex items-center justify-center mb-4">
                <Inbox className="h-7 w-7 text-teal-400" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-1">No Transfer Loaded</h3>
              <p className="text-sm sm:text-base text-muted-foreground max-w-xs">
                Enter a transfer number above or scan a QR code to get started
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && !transferData && (
        <div className="space-y-3 p-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse flex items-center gap-4 p-4 rounded-lg bg-white shadow-sm">
              <div className="h-10 w-10 rounded-lg bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-1/3" />
                <div className="h-2.5 bg-gray-200 rounded w-1/2" />
              </div>
              <div className="h-6 w-16 bg-gray-200 rounded-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
