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
  CheckCircle, ClipboardCheck, CheckCheck, Hash, FileText,
  AlertTriangle, X
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
  const [linesMatchMap, setLinesMatchMap] = useState<Record<number, boolean>>({})
  const [linesIssueMap, setLinesIssueMap] = useState<Record<number, { actual_qty: number; actual_total_weight: number; remarks: string }>>({})
  const [issueOpenIndex, setIssueOpenIndex] = useState<number | null>(null)
  const [issueForm, setIssueForm] = useState({ actual_qty: "", actual_total_weight: "", remarks: "" })
  const [boxCondition, setBoxCondition] = useState("Good")
  const [conditionRemarks, setConditionRemarks] = useState("")

  // ── Derived state ──
  const boxes = transferData?.boxes || []
  const lines = transferData?.lines || []
  const totalBoxes = boxes.length
  const totalLines = lines.length
  const totalItems = totalBoxes + totalLines
  const matchedBoxes = boxes.filter((b: any) => boxesMatchMap[b.id]).length
  const matchedLines = lines.filter((_: any, i: number) => linesMatchMap[i]).length
  const issuedLines = lines.filter((_: any, i: number) => linesIssueMap[i]).length
  const resolvedLines = matchedLines + issuedLines
  const totalMatched = matchedBoxes + resolvedLines
  const allMatched = totalItems > 0 && totalMatched === totalItems

  // ── Group boxes by article ──
  const groupedBoxes = useMemo(() => {
    if (!transferData?.boxes) return {}
    const groups: Record<string, any[]> = {}
    transferData.boxes.forEach((b: any) => {
      const article = b.article || "Unknown Article"
      if (!groups[article]) groups[article] = []
      groups[article].push(b)
    })
    return groups
  }, [transferData])

  // Load transfer details by transfer number
  const loadTransferDetails = async (transferNo: string) => {
    if (!transferNo.trim()) {
      toast({ title: "Error", description: "Please enter a transfer number", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const response = await InterunitApiService.getTransferByNumber(company, transferNo)
      setTransferData(response)

      // Init box match map
      const boxMap: Record<number, boolean> = {}
      ;(response.boxes || []).forEach((b: any) => { boxMap[b.id] = false })
      setBoxesMatchMap(boxMap)

      // Init line match map
      const lineMap: Record<number, boolean> = {}
      ;(response.lines || []).forEach((_: any, i: number) => { lineMap[i] = false })
      setLinesMatchMap(lineMap)

      const boxCount = (response.boxes || []).length
      const lineCount = (response.lines || []).length
      toast({
        title: "Transfer Loaded",
        description: `Transfer ${response.transfer_no || response.challan_no} loaded with ${boxCount} boxes and ${lineCount} article lines`,
      })
    } catch (error: any) {
      console.error("Failed to load transfer:", error)
      toast({ title: "Error", description: error.message || "Failed to load transfer details", variant: "destructive" })
      setTransferData(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => loadTransferDetails(transferNumber)

  // ── Handler: Transfer number scanner ──
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
    } catch { /* Not JSON — treat as raw */ }
    setTransferNumber(decodedText)
    loadTransferDetails(decodedText)
  }

  // ── Box handlers ──
  const handleAcknowledgeBox = (boxId: number) => {
    setBoxesMatchMap((prev) => ({ ...prev, [boxId]: true }))
    toast({ title: "Box Acknowledged", description: `Box #${boxId} acknowledged` })
  }

  const handleAcknowledgeArticleBoxes = (articleName: string) => {
    const articleBoxes = groupedBoxes[articleName] || []
    if (articleBoxes.length === 0) return
    const newMap = { ...boxesMatchMap }
    articleBoxes.forEach((b: any) => { newMap[b.id] = true })
    setBoxesMatchMap(newMap)
    toast({ title: "Article Boxes Acknowledged", description: `All ${articleBoxes.length} boxes for "${articleName}" acknowledged` })
  }

  // ── Line handlers ──
  const handleAcknowledgeLine = (lineIndex: number) => {
    setLinesMatchMap((prev) => ({ ...prev, [lineIndex]: true }))
    const line = lines[lineIndex]
    toast({ title: "Article Acknowledged", description: `${line?.item_desc_raw || line?.item_description || `Line ${lineIndex + 1}`} acknowledged` })
  }

  // ── Issue handlers ──
  const handleOpenIssue = (lineIndex: number) => {
    const line = lines[lineIndex]
    setIssueOpenIndex(lineIndex)
    setIssueForm({
      actual_qty: String(line.qty || line.quantity || ""),
      actual_total_weight: String(line.total_weight || ""),
      remarks: "",
    })
  }

  const handleSubmitIssue = (lineIndex: number) => {
    const actualQty = parseFloat(issueForm.actual_qty)
    const actualWeight = parseFloat(issueForm.actual_total_weight)
    if (isNaN(actualQty) && isNaN(actualWeight)) {
      toast({ title: "Error", description: "Enter at least actual quantity or actual total weight", variant: "destructive" })
      return
    }
    setLinesIssueMap((prev) => ({
      ...prev,
      [lineIndex]: {
        actual_qty: isNaN(actualQty) ? 0 : actualQty,
        actual_total_weight: isNaN(actualWeight) ? 0 : actualWeight,
        remarks: issueForm.remarks.trim(),
      },
    }))
    // Remove from acknowledged if it was there
    setLinesMatchMap((prev) => {
      const next = { ...prev }
      delete next[lineIndex]
      return next
    })
    setIssueOpenIndex(null)
    setIssueForm({ actual_qty: "", actual_total_weight: "", remarks: "" })
    const line = lines[lineIndex]
    toast({ title: "Issue Reported", description: `Discrepancy noted for ${line?.item_desc_raw || `Line ${lineIndex + 1}`}` })
  }

  const handleCancelIssue = () => {
    setIssueOpenIndex(null)
    setIssueForm({ actual_qty: "", actual_total_weight: "", remarks: "" })
  }

  // ── Acknowledge all ──
  const handleAcknowledgeAll = () => {
    const newBoxMap = { ...boxesMatchMap }
    boxes.forEach((b: any) => { newBoxMap[b.id] = true })
    setBoxesMatchMap(newBoxMap)

    const newLineMap = { ...linesMatchMap }
    lines.forEach((_: any, i: number) => { newLineMap[i] = true })
    setLinesMatchMap(newLineMap)

    toast({ title: "All Acknowledged", description: `${totalItems} items acknowledged successfully` })
  }

  // ── Acknowledge all lines (skip already issued) ──
  const handleAcknowledgeAllLines = () => {
    const newMap = { ...linesMatchMap }
    lines.forEach((_: any, i: number) => {
      if (!linesIssueMap[i]) newMap[i] = true
    })
    setLinesMatchMap(newMap)
    toast({ title: "All Articles Acknowledged", description: `${totalLines} article lines acknowledged` })
  }

  // ── Acknowledge all boxes ──
  const handleAcknowledgeAllBoxes = () => {
    const newMap = { ...boxesMatchMap }
    boxes.forEach((b: any) => { newMap[b.id] = true })
    setBoxesMatchMap(newMap)
    toast({ title: "All Boxes Acknowledged", description: `${totalBoxes} boxes acknowledged` })
  }

  const handleQRScanError = (error: string) => {
    console.error("QR Scan Error:", error)
    toast({ title: "Scanner Error", description: error, variant: "destructive" })
  }

  const handleConfirmReceipt = async () => {
    if (!transferData) return

    try {
      setLoading(true)

      const scannedBoxes = boxes
        .filter((b: any) => boxesMatchMap[b.id])
        .map((b: any) => ({
          box_number: String(b.box_id || b.box_number || b.id || ""),
          transfer_out_box_id: b.id,
          article: b.article ? String(b.article) : null,
          batch_number: b.batch_number ? String(b.batch_number) : null,
          lot_number: b.lot_number ? String(b.lot_number) : null,
          transaction_no: b.transaction_no ? String(b.transaction_no) : null,
          net_weight: b.net_weight ? Number(b.net_weight) : null,
          gross_weight: b.gross_weight ? Number(b.gross_weight) : null,
          is_matched: true,
        }))

      // Include acknowledged article lines as pseudo-boxes for the backend
      const acknowledgedArticles = lines
        .map((line: any, i: number) => ({ line, i }))
        .filter(({ i }: any) => linesMatchMap[i])
        .map(({ line, i }: any) => ({
          box_number: `ART-${i + 1}`,
          transfer_out_box_id: null,
          article: line.item_desc_raw || line.item_description || "",
          batch_number: line.batch_number || null,
          lot_number: line.lot_number || null,
          transaction_no: null,
          net_weight: line.net_weight ? Number(line.net_weight) : null,
          gross_weight: line.total_weight ? Number(line.total_weight) : null,
          is_matched: true,
          issue: null,
        }))

      // Include issued article lines — issue data stored as JSON in `issue` column
      const issuedArticles = lines
        .map((line: any, i: number) => ({ line, i }))
        .filter(({ i }: any) => linesIssueMap[i])
        .map(({ line, i }: any) => ({
          box_number: `ART-${i + 1}`,
          transfer_out_box_id: null,
          article: line.item_desc_raw || line.item_description || "",
          batch_number: line.batch_number || null,
          lot_number: line.lot_number || null,
          transaction_no: null,
          net_weight: line.net_weight ? Number(line.net_weight) : null,
          gross_weight: line.total_weight ? Number(line.total_weight) : null,
          is_matched: false,
          issue: {
            actual_qty: linesIssueMap[i].actual_qty,
            actual_total_weight: linesIssueMap[i].actual_total_weight,
            remarks: linesIssueMap[i].remarks || null,
          },
        }))

      const articleEntries = [...acknowledgedArticles, ...issuedArticles]

      const allScannedBoxes = [...scannedBoxes, ...articleEntries]

      const now = new Date()
      const grnNumber = `GRN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`

      await InterunitApiService.createTransferIn({
        transfer_out_id: transferData.id,
        grn_number: grnNumber,
        receiving_warehouse: transferData.to_warehouse || transferData.to_site_code || "UNKNOWN",
        received_by: "USER",
        box_condition: boxCondition,
        condition_remarks: conditionRemarks.trim() || null,
        scanned_boxes: allScannedBoxes,
      })

      toast({
        title: "Transfer IN Created",
        description: `GRN ${grnNumber} created successfully with ${allScannedBoxes.length} items.`,
      })

      setTimeout(() => {
        router.push(`/${company}/transfer`)
      }, 2000)
    } catch (error: any) {
      console.error("Failed to confirm transfer:", error)
      toast({ title: "Error", description: error.message || "Failed to confirm transfer receipt", variant: "destructive" })
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
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Receive incoming stock transfers</p>
        </div>
      </div>

      {/* ── Transfer Number Input ── */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-teal-50 to-emerald-50 border-b">
          <CardTitle className="text-sm sm:text-base font-semibold text-gray-800">Find Transfer</CardTitle>
          <p className="text-xs text-muted-foreground">Enter the transfer number or scan QR code</p>
        </CardHeader>
        <CardContent className="p-3 sm:p-5">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="transferNumber" className="text-xs font-medium text-gray-600">Transfer Number *</Label>
                <Input
                  id="transferNumber"
                  type="text"
                  value={transferNumber}
                  onChange={(e) => setTransferNumber(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
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
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4 mr-1.5" /><span>Search</span></>}
                </Button>
                <Button
                  onClick={() => setShowScanner(true)}
                  variant="outline"
                  className="h-10 px-4 bg-white border-gray-200"
                >
                  <Camera className="h-4 w-4 mr-1.5" /><span className="sm:hidden">Scan</span>
                </Button>
              </div>
            </div>

            {showScanner && (
              <div className="border-2 border-teal-200 rounded-lg overflow-hidden">
                <div className="w-full max-w-2xl mx-auto">
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

      {/* ── Transfer Details ── */}
      {transferData && (
        <>
          {/* ══════ Box & Article Acknowledgement ══════ */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-teal-50 to-emerald-50 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
                    <Package className="h-5 w-5 text-teal-600" />
                    Box & Article Acknowledgement
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {transferData.challan_no || transferData.transfer_no} — {totalBoxes} boxes, {totalLines} articles
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                    {totalMatched} resolved
                  </Badge>
                  {issuedLines > 0 && (
                    <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                      <AlertTriangle className="h-3 w-3 mr-0.5" /> {issuedLines} issue{issuedLines !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {totalItems - totalMatched > 0 && (
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-600 border-amber-200">
                      {totalItems - totalMatched} pending
                    </Badge>
                  )}
                </div>
              </div>
              {!allMatched && totalItems > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAcknowledgeAll}
                  className="mt-3 h-9 text-xs sm:text-sm bg-white border-teal-200 text-teal-700 hover:bg-teal-50 w-full sm:w-auto"
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
                  Acknowledge All ({totalItems})
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">

              {/* ──── BOXES SECTION ──── */}
              {totalBoxes > 0 && (
                <div className="border-b-2 border-gray-200">
                  <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-blue-50/60">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-600" />
                      <span className="text-xs sm:text-sm font-semibold text-blue-800">Scanned Boxes ({totalBoxes})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${matchedBoxes === totalBoxes ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                        {matchedBoxes}/{totalBoxes}
                      </Badge>
                      {matchedBoxes < totalBoxes && (
                        <Button variant="ghost" size="sm" onClick={handleAcknowledgeAllBoxes} className="text-xs text-teal-600 hover:text-teal-800 h-7 px-2">
                          <CheckCheck className="h-3 w-3 mr-1" /> All
                        </Button>
                      )}
                    </div>
                  </div>

                  {Object.entries(groupedBoxes).map(([articleName, artBoxes]) => {
                    const artMatched = artBoxes.filter((b: any) => boxesMatchMap[b.id]).length
                    const artTotal = artBoxes.length
                    const allArtMatched = artMatched === artTotal

                    return (
                      <div key={articleName} className="border-b last:border-b-0">
                        {/* Article group header */}
                        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-gray-50/80">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-7 w-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                              <Package className="h-3.5 w-3.5 text-violet-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate">{articleName}</p>
                              <p className="text-[11px] text-muted-foreground">{artTotal} box{artTotal !== 1 ? "es" : ""}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={`text-xs ${allArtMatched ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                              {artMatched}/{artTotal}
                            </Badge>
                            {!allArtMatched && (
                              <Button variant="ghost" size="sm" onClick={() => handleAcknowledgeArticleBoxes(articleName)} className="text-xs text-teal-600 hover:text-teal-800 h-7 px-2">
                                <CheckCheck className="h-3 w-3 mr-1" /> All
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Box rows */}
                        <div className="divide-y divide-gray-100">
                          {artBoxes.map((b: any) => {
                            const matched = !!boxesMatchMap[b.id]
                            return (
                              <div key={b.id} className={`px-3 sm:px-4 py-2.5 ${matched ? "bg-emerald-50/40" : ""}`}>
                                {/* Mobile */}
                                <div className="md:hidden space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex items-center gap-0.5 text-[11px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                        <Hash className="h-2.5 w-2.5" />{b.id}
                                      </span>
                                      <span className="text-sm font-semibold text-gray-900">Box {b.box_number}</span>
                                    </div>
                                    {matched ? (
                                      <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                        <CheckCircle className="h-3 w-3 mr-0.5" /> Done
                                      </Badge>
                                    ) : (
                                      <Button variant="outline" size="sm" onClick={() => handleAcknowledgeBox(b.id)} className="text-xs text-teal-700 border-teal-200 hover:bg-teal-50 h-7 px-2.5">
                                        Acknowledge
                                      </Button>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs pl-1">
                                    <div><span className="text-gray-500">Batch:</span> <span className="font-mono font-medium">{b.batch_number || b.lot_number || "-"}</span></div>
                                    <div><span className="text-gray-500">Trans:</span> <span className="font-mono font-medium">{b.transaction_no || "-"}</span></div>
                                    <div><span className="text-gray-500">Net:</span> <span className="font-medium">{b.net_weight || "-"}g</span></div>
                                    <div><span className="text-gray-500">Gross:</span> <span className="font-medium">{b.gross_weight || "-"}g</span></div>
                                  </div>
                                </div>

                                {/* Desktop */}
                                <div className="hidden md:flex items-center gap-4">
                                  <span className="inline-flex items-center gap-1 text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded shrink-0">
                                    <Hash className="h-3 w-3" />{b.id}
                                  </span>
                                  <span className="text-sm font-semibold text-gray-900 w-20 shrink-0">Box {b.box_number}</span>
                                  <span className="text-sm font-mono text-gray-600 w-32 truncate">{b.batch_number || b.lot_number || "-"}</span>
                                  <span className="text-sm font-mono text-gray-600 w-36 truncate">{b.transaction_no || "-"}</span>
                                  <span className="text-sm text-gray-600 w-24">{b.net_weight || "-"}g</span>
                                  <span className="text-sm text-gray-600 w-24">{b.gross_weight || "-"}g</span>
                                  <div className="ml-auto shrink-0">
                                    {matched ? (
                                      <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Acknowledged
                                      </Badge>
                                    ) : (
                                      <Button variant="outline" size="sm" onClick={() => handleAcknowledgeBox(b.id)} className="text-xs text-teal-700 border-teal-200 hover:bg-teal-50 h-7 px-3">
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
                </div>
              )}

              {/* ──── ARTICLE LINES SECTION ──── */}
              {totalLines > 0 && (
                <div>
                  <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-violet-50/60">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-violet-600" />
                      <span className="text-xs sm:text-sm font-semibold text-violet-800">Article Entries ({totalLines})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${resolvedLines === totalLines ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                        {resolvedLines}/{totalLines}
                      </Badge>
                      {issuedLines > 0 && (
                        <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                          {issuedLines} issue{issuedLines !== 1 ? "s" : ""}
                        </Badge>
                      )}
                      {resolvedLines < totalLines && (
                        <Button variant="ghost" size="sm" onClick={handleAcknowledgeAllLines} className="text-xs text-teal-600 hover:text-teal-800 h-7 px-2">
                          <CheckCheck className="h-3 w-3 mr-1" /> All
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Desktop table header */}
                  <div className="hidden md:block">
                    <div className="flex items-center gap-3 px-4 py-2 bg-violet-50/40 border-b text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      <span className="w-14">Type</span>
                      <span className="w-44">Item Name</span>
                      <span className="w-24">Category</span>
                      <span className="w-24">Sub Category</span>
                      <span className="w-20">Pack Size</span>
                      <span className="w-20">Qty</span>
                      <span className="w-20">Packaging</span>
                      <span className="w-20">Net Wt</span>
                      <span className="w-20">Total Wt</span>
                      <span className="w-24">Batch</span>
                      <span className="w-24">Lot</span>
                      <span className="ml-auto w-28 text-right">Action</span>
                    </div>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {lines.map((line: any, index: number) => {
                      const matched = !!linesMatchMap[index]
                      const issued = !!linesIssueMap[index]
                      const resolved = matched || issued
                      const isIssueOpen = issueOpenIndex === index

                      return (
                        <div key={index} className={`${matched ? "bg-emerald-50/40" : issued ? "bg-red-50/30" : ""}`}>
                          <div className="px-3 sm:px-4 py-3">
                            {/* Mobile */}
                            <div className="md:hidden space-y-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{line.rm_pm_fg_type || line.material_type || "—"}</Badge>
                                    <span className="text-sm font-semibold text-gray-900 truncate">{line.item_desc_raw || line.item_description || `Article ${index + 1}`}</span>
                                  </div>
                                </div>
                                {matched ? (
                                  <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">
                                    <CheckCircle className="h-3 w-3 mr-0.5" /> Done
                                  </Badge>
                                ) : issued ? (
                                  <Badge variant="outline" className="text-[11px] bg-red-50 text-red-600 border-red-200 shrink-0">
                                    <AlertTriangle className="h-3 w-3 mr-0.5" /> Issue
                                  </Badge>
                                ) : (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <Button variant="outline" size="sm" onClick={() => handleAcknowledgeLine(index)} className="text-xs text-teal-700 border-teal-200 hover:bg-teal-50 h-7 px-2">
                                      Acknowledge
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleOpenIssue(index)} className="text-xs text-red-600 border-red-200 hover:bg-red-50 h-7 px-2">
                                      Issue
                                    </Button>
                                  </div>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs pl-1">
                                <div><span className="text-gray-500">Category:</span> <span className="font-medium">{line.item_category || "-"}</span></div>
                                <div><span className="text-gray-500">Sub:</span> <span className="font-medium">{line.sub_category || "-"}</span></div>
                                <div><span className="text-gray-500">Pack Size:</span> <span className="font-medium">{line.pack_size || "-"}</span></div>
                                <div><span className="text-gray-500">Qty:</span> <span className="font-bold text-blue-600">{line.qty || line.quantity || 0}</span> <span className="text-gray-500">{line.uom || ""}</span></div>
                                <div><span className="text-gray-500">Packaging:</span> <span className="font-medium">{line.packaging_type || "-"}</span></div>
                                <div><span className="text-gray-500">Net Wt:</span> <span className="font-medium">{line.net_weight || "-"}</span></div>
                                <div><span className="text-gray-500">Total Wt:</span> <span className="font-medium">{line.total_weight || "-"}</span></div>
                                {line.batch_number && <div><span className="text-gray-500">Batch:</span> <span className="font-mono font-medium">{line.batch_number}</span></div>}
                                {line.lot_number && <div><span className="text-gray-500">Lot:</span> <span className="font-mono font-medium">{line.lot_number}</span></div>}
                              </div>
                              {/* Issue details on mobile */}
                              {issued && linesIssueMap[index] && (
                                <div className="mt-1.5 p-2 bg-red-50 border border-red-200 rounded text-xs space-y-0.5">
                                  <p className="font-semibold text-red-700">Discrepancy Reported:</p>
                                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                                    <div><span className="text-red-500">Actual Qty:</span> <span className="font-bold text-red-700">{linesIssueMap[index].actual_qty}</span></div>
                                    <div><span className="text-red-500">Actual Wt:</span> <span className="font-bold text-red-700">{linesIssueMap[index].actual_total_weight}</span></div>
                                  </div>
                                  {linesIssueMap[index].remarks && <p className="text-red-600">Remarks: {linesIssueMap[index].remarks}</p>}
                                </div>
                              )}
                            </div>

                            {/* Desktop */}
                            <div className="hidden md:flex items-center gap-3">
                              <Badge variant="outline" className="text-[11px] px-1.5 py-0.5 w-14 justify-center shrink-0">{line.rm_pm_fg_type || line.material_type || "—"}</Badge>
                              <span className="text-sm font-semibold text-gray-900 w-44 truncate" title={line.item_desc_raw || line.item_description}>
                                {line.item_desc_raw || line.item_description || `Article ${index + 1}`}
                              </span>
                              <span className="text-sm text-gray-600 w-24 truncate">{line.item_category || "-"}</span>
                              <span className="text-sm text-gray-600 w-24 truncate">{line.sub_category || "-"}</span>
                              <span className="text-sm text-gray-600 w-20">{line.pack_size || "-"}</span>
                              <span className="text-sm font-bold text-blue-600 w-20">{line.qty || line.quantity || 0} {line.uom || ""}</span>
                              <span className="text-sm text-gray-600 w-20 truncate">{line.packaging_type || "-"}</span>
                              <span className="text-sm text-gray-600 w-20">{line.net_weight || "-"}</span>
                              <span className="text-sm text-gray-600 w-20">{line.total_weight || "-"}</span>
                              <span className="text-sm font-mono text-gray-600 w-24 truncate">{line.batch_number || "-"}</span>
                              <span className="text-sm font-mono text-gray-600 w-24 truncate">{line.lot_number || "-"}</span>
                              <div className="ml-auto shrink-0 flex items-center gap-1.5">
                                {matched ? (
                                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Acknowledged
                                  </Badge>
                                ) : issued ? (
                                  <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                                    <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Issue
                                  </Badge>
                                ) : (
                                  <>
                                    <Button variant="outline" size="sm" onClick={() => handleAcknowledgeLine(index)} className="text-xs text-teal-700 border-teal-200 hover:bg-teal-50 h-7 px-3">
                                      Acknowledge
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleOpenIssue(index)} className="text-xs text-red-600 border-red-200 hover:bg-red-50 h-7 px-3">
                                      <AlertTriangle className="h-3 w-3 mr-1" /> Issue
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Issue details row on desktop */}
                            {issued && linesIssueMap[index] && (
                              <div className="hidden md:flex mt-2 p-2.5 bg-red-50 border border-red-200 rounded-md text-xs items-center gap-4">
                                <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                <span className="text-red-700 font-semibold">Discrepancy:</span>
                                <span className="text-red-600">Actual Qty: <span className="font-bold">{linesIssueMap[index].actual_qty}</span></span>
                                <span className="text-red-600">Actual Total Wt: <span className="font-bold">{linesIssueMap[index].actual_total_weight}</span></span>
                                {linesIssueMap[index].remarks && <span className="text-red-600">Remarks: {linesIssueMap[index].remarks}</span>}
                              </div>
                            )}
                          </div>

                          {/* ── Issue Form (expandable) ── */}
                          {isIssueOpen && (
                            <div className="px-3 sm:px-4 pb-3">
                              <div className="border-2 border-red-200 rounded-lg bg-red-50/50 p-3 sm:p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-red-500" />
                                    <span className="text-sm font-semibold text-red-800">Report Issue — {line.item_desc_raw || line.item_description || `Article ${index + 1}`}</span>
                                  </div>
                                  <Button variant="ghost" size="sm" onClick={handleCancelIssue} className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600">
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                <p className="text-xs text-red-600">
                                  Expected: Qty <span className="font-bold">{line.qty || line.quantity || 0} {line.uom || ""}</span>, Total Weight <span className="font-bold">{line.total_weight || "-"}</span>
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs font-medium text-red-700">Actual Qty Received *</Label>
                                    <Input
                                      type="number"
                                      step="any"
                                      value={issueForm.actual_qty}
                                      onChange={(e) => setIssueForm(prev => ({ ...prev, actual_qty: e.target.value }))}
                                      placeholder="e.g. 8"
                                      className="h-9 bg-white border-red-200 focus-visible:ring-red-300 text-sm"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs font-medium text-red-700">Actual Total Weight *</Label>
                                    <Input
                                      type="number"
                                      step="any"
                                      value={issueForm.actual_total_weight}
                                      onChange={(e) => setIssueForm(prev => ({ ...prev, actual_total_weight: e.target.value }))}
                                      placeholder="e.g. 450"
                                      className="h-9 bg-white border-red-200 focus-visible:ring-red-300 text-sm"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs font-medium text-red-700">Remarks</Label>
                                    <Input
                                      type="text"
                                      value={issueForm.remarks}
                                      onChange={(e) => setIssueForm(prev => ({ ...prev, remarks: e.target.value }))}
                                      placeholder="Damage, shortage, etc."
                                      className="h-9 bg-white border-red-200 focus-visible:ring-red-300 text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <Button variant="outline" size="sm" onClick={handleCancelIssue} className="h-8 px-3 text-xs text-gray-600 border-gray-300">
                                    Cancel
                                  </Button>
                                  <Button size="sm" onClick={() => handleSubmitIssue(index)} className="h-8 px-4 text-xs bg-red-600 hover:bg-red-700 text-white">
                                    <AlertTriangle className="h-3 w-3 mr-1" /> Submit Issue
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {totalItems === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <Package className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-sm text-muted-foreground">No boxes or articles in this transfer</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ══════ Condition Assessment ══════ */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b">
              <CardTitle className="text-sm sm:text-base font-semibold text-gray-800">Condition Assessment</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="boxCondition" className="text-xs font-medium text-gray-600">Box Condition</Label>
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
                  <Label htmlFor="conditionRemarks" className="text-xs font-medium text-gray-600">
                    Remarks <span className="text-gray-400 font-normal">(Optional)</span>
                  </Label>
                  <Textarea
                    id="conditionRemarks"
                    value={conditionRemarks}
                    onChange={(e) => setConditionRemarks(e.target.value)}
                    placeholder="Enter any remarks..."
                    className="min-h-[38px] resize-none bg-white border-gray-200"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ══════ Confirm Receipt ══════ */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-3 sm:p-5">
              <Button
                onClick={handleConfirmReceipt}
                disabled={loading || totalItems === 0 || !allMatched}
                className={`w-full h-12 font-semibold text-sm sm:text-base transition-all ${
                  allMatched
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Confirming...</>
                ) : totalItems === 0 ? (
                  "No Items to Confirm"
                ) : !allMatched ? (
                  <span className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Acknowledge All Items to Continue ({totalMatched}/{totalItems})
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5" />
                    Confirm Receipt — All Items Acknowledged
                  </span>
                )}
              </Button>
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
              <p className="text-sm text-muted-foreground max-w-xs">
                Enter a transfer number above or scan a QR code to get started
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && !transferData && (
        <div className="space-y-3 p-4">
          {[1, 2, 3].map((i) => (
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
