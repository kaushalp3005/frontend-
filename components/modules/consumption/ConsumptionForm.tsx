// File: ConsumptionForm.tsx
// Path: frontend/src/components/modules/consumption/ConsumptionForm.tsx

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Package, 
  Scan, 
  Plus, 
  Trash2, 
  Save, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Search,
  QrCode
} from "lucide-react"
import { postConsumption, resolveScanner, getFEFOSuggestions, getJobCards } from "@/lib/api/consumptionApiService"
import { ConsumptionLine, MaterialType, JobCard } from "@/types/consumption"

interface ConsumptionFormProps {
  company: string
}

export function ConsumptionForm({ company }: ConsumptionFormProps) {
  const [jobCardNo, setJobCardNo] = useState("")
  const [warehouse, setWarehouse] = useState("")
  const [remarks, setRemarks] = useState("")
  const [lines, setLines] = useState<ConsumptionLine[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [jobCards, setJobCards] = useState<JobCard[]>([])
  const [selectedJobCard, setSelectedJobCard] = useState<JobCard | null>(null)
  const [scanValue, setScanValue] = useState("")
  const [scanning, setScanning] = useState(false)

  const materialTypeColors = {
    RM: "bg-blue-100 text-blue-800",
    PM: "bg-green-100 text-green-800",
    SFG: "bg-yellow-100 text-yellow-800",
    FG: "bg-purple-100 text-purple-800"
  }

  const materialTypeLabels = {
    RM: "Raw Materials",
    PM: "Packaging Materials",
    SFG: "Semi-Finished Goods",
    FG: "Finished Goods"
  }

  const fetchJobCards = async () => {
    try {
      const response = await getJobCards({ status: "IN_PROGRESS" })
      setJobCards(response.data)
    } catch (err) {
      console.error("Error fetching job cards:", err)
    }
  }

  useEffect(() => {
    fetchJobCards()
  }, [company])

  const handleJobCardSelect = (jobCardNo: string) => {
    const jobCard = jobCards.find(jc => jc.job_card_no === jobCardNo)
    setSelectedJobCard(jobCard || null)
    setJobCardNo(jobCardNo)
  }

  const handleScan = async () => {
    if (!scanValue.trim() || !warehouse) {
      setError("Please enter scan value and select warehouse")
      return
    }

    try {
      setScanning(true)
      setError(null)
      
      const response = await resolveScanner({
        scan_value: scanValue.trim(),
        warehouse
      })

      if (response.success) {
        const { data } = response
        
        // Check if this SKU is already in the lines
        const existingLineIndex = lines.findIndex(line => 
          line.sku_id === data.sku_id && 
          line.lot_no === data.resolved_lot && 
          line.batch_no === data.resolved_batch
        )

        if (existingLineIndex >= 0) {
          // Update existing line quantity
          const updatedLines = [...lines]
          updatedLines[existingLineIndex].qty_issued += 1 // Default increment
          setLines(updatedLines)
        } else {
          // Add new line
          const newLine: ConsumptionLine = {
            sku_id: data.sku_id,
            material_type: data.material_type,
            uom: data.uom,
            qty_issued: 1, // Default quantity
            lot_no: data.resolved_lot,
            batch_no: data.resolved_batch
          }
          setLines([...lines, newLine])
        }

        setScanValue("")
        setSuccess(`Scanned: ${data.sku_name} (${data.resolved_lot}/${data.resolved_batch})`)
      }
    } catch (err) {
      console.error("Error scanning:", err)
      setError(err instanceof Error ? err.message : "Failed to scan item")
    } finally {
      setScanning(false)
    }
  }

  const handleQuantityChange = (index: number, quantity: number) => {
    const updatedLines = [...lines]
    updatedLines[index].qty_issued = quantity
    setLines(updatedLines)
  }

  const handleRemoveLine = (index: number) => {
    const updatedLines = lines.filter((_, i) => i !== index)
    setLines(updatedLines)
  }

  const handleAddManualLine = () => {
    const newLine: ConsumptionLine = {
      sku_id: "",
      material_type: "RM",
      uom: "",
      qty_issued: 0,
      lot_no: "",
      batch_no: ""
    }
    setLines([...lines, newLine])
  }

  const handleManualLineChange = (index: number, field: keyof ConsumptionLine, value: string | number) => {
    const updatedLines = [...lines]
    updatedLines[index][field] = value as any
    setLines(updatedLines)
  }

  const handleSubmit = async () => {
    if (!jobCardNo || !warehouse || lines.length === 0) {
      setError("Please fill in all required fields and add at least one consumption line")
      return
    }

    // Validate lines
    const invalidLines = lines.some(line => 
      !line.sku_id || !line.lot_no || !line.batch_no || line.qty_issued <= 0
    )

    if (invalidLines) {
      setError("Please ensure all consumption lines have valid SKU, lot, batch, and quantity")
      return
    }

    try {
      setLoading(true)
      setError(null)
      setSuccess(null)

      const response = await postConsumption({
        job_card_no: jobCardNo,
        warehouse,
        lines,
        remarks: remarks || undefined
      })

      if (response.success) {
        setSuccess(`Consumption posted successfully! Processed ${response.data.lines_processed} lines.`)
        setLines([])
        setRemarks("")
        setSelectedJobCard(null)
        setJobCardNo("")
        // Refresh job cards to update quantities
        fetchJobCards()
      }
    } catch (err) {
      console.error("Error posting consumption:", err)
      setError(err instanceof Error ? err.message : "Failed to post consumption")
    } finally {
      setLoading(false)
    }
  }

  const getTotalQuantity = () => {
    return lines.reduce((sum, line) => sum + line.qty_issued, 0)
  }

  const getTotalValue = () => {
    // This would typically come from the API based on FIFO allocations
    return 0 // Placeholder
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Material Consumption
          </CardTitle>
          <CardDescription>
            Post material consumption for production job cards with scanner integration
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Job Card Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Job Card Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="job-card">Job Card No</Label>
              <Select value={jobCardNo} onValueChange={handleJobCardSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select job card" />
                </SelectTrigger>
                <SelectContent>
                  {jobCards.map((jobCard) => (
                    <SelectItem key={jobCard.job_card_no} value={jobCard.job_card_no}>
                      <div className="flex items-center justify-between w-full">
                        <span>{jobCard.job_card_no}</span>
                        <Badge variant="outline" className="ml-2">
                          {jobCard.sku_name}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="warehouse">Warehouse</Label>
              <Select value={warehouse} onValueChange={setWarehouse}>
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WH001">Main Warehouse</SelectItem>
                  <SelectItem value="WH002">Production Warehouse</SelectItem>
                  <SelectItem value="WH003">Storage Warehouse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedJobCard && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Selected Job Card Details</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">SKU</Label>
                  <p className="font-medium">{selectedJobCard.sku_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Planned Qty</Label>
                  <p className="font-medium">{selectedJobCard.planned_qty}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Actual Qty</Label>
                  <p className="font-medium">{selectedJobCard.actual_qty}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Due Date</Label>
                  <p className="font-medium">{selectedJobCard.due_date}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scanner */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Scanner Integration
          </CardTitle>
          <CardDescription>
            Scan boxes, lots, or batches to automatically add consumption lines
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Scan box, lot, or batch number..."
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleScan()}
              className="flex-1"
            />
            <Button 
              onClick={handleScan} 
              disabled={scanning || !scanValue.trim() || !warehouse}
            >
              {scanning ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Scan className="h-4 w-4 mr-2" />
              )}
              Scan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Consumption Lines */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Consumption Lines</CardTitle>
              <CardDescription>
                Material consumption entries for the job card
              </CardDescription>
            </div>
            <Button onClick={handleAddManualLine} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Manual
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No consumption lines added</p>
              <p className="text-sm">Use the scanner or add manual entries</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU ID</TableHead>
                    <TableHead>Material Type</TableHead>
                    <TableHead>Lot No</TableHead>
                    <TableHead>Batch No</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          value={line.sku_id}
                          onChange={(e) => handleManualLineChange(index, 'sku_id', e.target.value)}
                          placeholder="SKU ID"
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={line.material_type} 
                          onValueChange={(value) => handleManualLineChange(index, 'material_type', value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="RM">RM</SelectItem>
                            <SelectItem value="PM">PM</SelectItem>
                            <SelectItem value="SFG">SFG</SelectItem>
                            <SelectItem value="FG">FG</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={line.lot_no}
                          onChange={(e) => handleManualLineChange(index, 'lot_no', e.target.value)}
                          placeholder="Lot No"
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={line.batch_no}
                          onChange={(e) => handleManualLineChange(index, 'batch_no', e.target.value)}
                          placeholder="Batch No"
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={line.qty_issued}
                          onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={line.uom}
                          onChange={(e) => handleManualLineChange(index, 'uom', e.target.value)}
                          placeholder="UOM"
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveLine(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Summary */}
          {lines.length > 0 && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Summary</h4>
                  <p className="text-sm text-muted-foreground">
                    {lines.length} lines, {getTotalQuantity()} total quantity
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Estimated Value</p>
                  <p className="font-medium">₹{getTotalValue().toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Remarks */}
      <Card>
        <CardHeader>
          <CardTitle>Remarks</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Add any remarks or notes for this consumption..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Submit */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setLines([])
              setRemarks("")
              setJobCardNo("")
              setWarehouse("")
              setSelectedJobCard(null)
            }}>
              Clear All
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || lines.length === 0 || !jobCardNo || !warehouse}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Post Consumption
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
