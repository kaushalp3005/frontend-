// File: ProductionReceipt.tsx
// Path: frontend/src/components/modules/consumption/ProductionReceipt.tsx

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
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Factory, 
  Plus, 
  Trash2, 
  Save, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Package,
  QrCode
} from "lucide-react"
import { postProductionReceipt, getJobCards } from "@/lib/api/consumptionApiService"
import { ProductionReceiptLine, MaterialType, JobCard } from "@/types/consumption"

interface ProductionReceiptProps {
  company: string
}

export function ProductionReceipt({ company }: ProductionReceiptProps) {
  const [jobCardNo, setJobCardNo] = useState("")
  const [outputType, setOutputType] = useState<MaterialType>("FG")
  const [toWarehouse, setToWarehouse] = useState("")
  const [qcRequired, setQcRequired] = useState(true)
  const [lines, setLines] = useState<ProductionReceiptLine[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [jobCards, setJobCards] = useState<JobCard[]>([])
  const [selectedJobCard, setSelectedJobCard] = useState<JobCard | null>(null)

  const outputTypeColors = {
    RM: "bg-blue-100 text-blue-800",
    PM: "bg-green-100 text-green-800",
    SFG: "bg-yellow-100 text-yellow-800",
    FG: "bg-purple-100 text-purple-800"
  }

  const outputTypeLabels = {
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

  const handleAddLine = () => {
    const newLine: ProductionReceiptLine = {
      sku_id: "",
      uom: "",
      qty_produced: 0,
      batch_no: "",
      lot_no: "",
      yield_pct: 100,
      scrap_qty: 0
    }
    setLines([...lines, newLine])
  }

  const handleLineChange = (index: number, field: keyof ProductionReceiptLine, value: string | number) => {
    const updatedLines = [...lines]
    updatedLines[index][field] = value as any
    setLines(updatedLines)
  }

  const handleRemoveLine = (index: number) => {
    const updatedLines = lines.filter((_, i) => i !== index)
    setLines(updatedLines)
  }

  const handleSubmit = async () => {
    if (!jobCardNo || !toWarehouse || lines.length === 0) {
      setError("Please fill in all required fields and add at least one production line")
      return
    }

    // Validate lines
    const invalidLines = lines.some(line => 
      !line.sku_id || !line.batch_no || !line.lot_no || line.qty_produced <= 0
    )

    if (invalidLines) {
      setError("Please ensure all production lines have valid SKU, batch, lot, and quantity")
      return
    }

    try {
      setLoading(true)
      setError(null)
      setSuccess(null)

      const response = await postProductionReceipt({
        job_card_no: jobCardNo,
        output_type: outputType,
        to_warehouse: toWarehouse,
        qc_required: qcRequired,
        lines
      })

      if (response.success) {
        setSuccess(`Production receipt posted successfully! Processed ${response.data.lines_processed} lines.`)
        setLines([])
        setSelectedJobCard(null)
        setJobCardNo("")
        // Refresh job cards to update quantities
        fetchJobCards()
      }
    } catch (err) {
      console.error("Error posting production receipt:", err)
      setError(err instanceof Error ? err.message : "Failed to post production receipt")
    } finally {
      setLoading(false)
    }
  }

  const getTotalProduced = () => {
    return lines.reduce((sum, line) => sum + line.qty_produced, 0)
  }

  const getTotalScrap = () => {
    return lines.reduce((sum, line) => sum + line.scrap_qty, 0)
  }

  const getAverageYield = () => {
    if (lines.length === 0) return 0
    return lines.reduce((sum, line) => sum + line.yield_pct, 0) / lines.length
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            Production Receipt
          </CardTitle>
          <CardDescription>
            Post production receipts for job cards with yield and scrap tracking
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
              <Label htmlFor="warehouse">To Warehouse</Label>
              <Select value={toWarehouse} onValueChange={setToWarehouse}>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="output-type">Output Type</Label>
              <Select value={outputType} onValueChange={(value) => setOutputType(value as MaterialType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SFG">Semi-Finished Goods</SelectItem>
                  <SelectItem value="FG">Finished Goods</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="qc-required"
                  checked={qcRequired}
                  onCheckedChange={setQcRequired}
                />
                <Label htmlFor="qc-required">QC Required</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                {qcRequired ? "Items will be held for quality inspection" : "Items will be available immediately"}
              </p>
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

      {/* Production Lines */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Production Lines</CardTitle>
              <CardDescription>
                Production output entries with yield and scrap tracking
              </CardDescription>
            </div>
            <Button onClick={handleAddLine} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Line
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No production lines added</p>
              <p className="text-sm">Add production output lines</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU ID</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead>Qty Produced</TableHead>
                    <TableHead>Batch No</TableHead>
                    <TableHead>Lot No</TableHead>
                    <TableHead>Yield %</TableHead>
                    <TableHead>Scrap Qty</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          value={line.sku_id}
                          onChange={(e) => handleLineChange(index, 'sku_id', e.target.value)}
                          placeholder="SKU ID"
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={line.uom}
                          onChange={(e) => handleLineChange(index, 'uom', e.target.value)}
                          placeholder="UOM"
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={line.qty_produced}
                          onChange={(e) => handleLineChange(index, 'qty_produced', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={line.batch_no}
                          onChange={(e) => handleLineChange(index, 'batch_no', e.target.value)}
                          placeholder="Batch No"
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={line.lot_no}
                          onChange={(e) => handleLineChange(index, 'lot_no', e.target.value)}
                          placeholder="Lot No"
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={line.yield_pct}
                          onChange={(e) => handleLineChange(index, 'yield_pct', parseFloat(e.target.value) || 0)}
                          min="0"
                          max="100"
                          step="0.01"
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={line.scrap_qty}
                          onChange={(e) => handleLineChange(index, 'scrap_qty', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <h4 className="font-medium">Total Produced</h4>
                  <p className="text-2xl font-bold">{getTotalProduced().toLocaleString()}</p>
                </div>
                <div>
                  <h4 className="font-medium">Total Scrap</h4>
                  <p className="text-2xl font-bold">{getTotalScrap().toLocaleString()}</p>
                </div>
                <div>
                  <h4 className="font-medium">Average Yield</h4>
                  <p className="text-2xl font-bold">{getAverageYield().toFixed(1)}%</p>
                </div>
                <div>
                  <h4 className="font-medium">Lines</h4>
                  <p className="text-2xl font-bold">{lines.length}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setLines([])
              setJobCardNo("")
              setToWarehouse("")
              setSelectedJobCard(null)
            }}>
              Clear All
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || lines.length === 0 || !jobCardNo || !toWarehouse}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Post Production Receipt
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
