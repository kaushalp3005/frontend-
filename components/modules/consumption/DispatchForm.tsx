// File: DispatchForm.tsx
// Path: frontend/src/components/modules/consumption/DispatchForm.tsx

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Truck, 
  Plus, 
  Trash2, 
  Save, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Package,
  QrCode,
  Search
} from "lucide-react"
import { postDispatch, getFEFOPicklist } from "@/lib/api/consumptionApiService"
import { DispatchLine, FEFOPicklistItem } from "@/types/consumption"

interface DispatchFormProps {
  company: string
}

export function DispatchForm({ company }: DispatchFormProps) {
  const [warehouse, setWarehouse] = useState("")
  const [soNo, setSoNo] = useState("")
  const [lines, setLines] = useState<DispatchLine[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [scanValue, setScanValue] = useState("")
  const [scanning, setScanning] = useState(false)
  const [fefoPicklist, setFefoPicklist] = useState<FEFOPicklistItem[]>([])
  const [picklistLoading, setPicklistLoading] = useState(false)

  const handleAddLine = () => {
    const newLine: DispatchLine = {
      sku_id: "",
      uom: "",
      qty: 0,
      lot_no: "",
      batch_no: ""
    }
    setLines([...lines, newLine])
  }

  const handleLineChange = (index: number, field: keyof DispatchLine, value: string | number) => {
    const updatedLines = [...lines]
    updatedLines[index][field] = value as any
    setLines(updatedLines)
  }

  const handleRemoveLine = (index: number) => {
    const updatedLines = lines.filter((_, i) => i !== index)
    setLines(updatedLines)
  }

  const handleScan = async () => {
    if (!scanValue.trim() || !warehouse) {
      setError("Please enter scan value and select warehouse")
      return
    }

    try {
      setScanning(true)
      setError(null)
      
      // For dispatch, we'll simulate scanning and getting FEFO suggestions
      // In a real implementation, this would resolve the scan and get picklist
      const mockPicklist: FEFOPicklistItem[] = [
        {
          lot_no: "LOT001",
          batch_no: "BATCH001",
          available_qty: 100,
          expiry_date: "2024-02-15",
          unit_cost: 12.00,
          priority: 1,
          recommended_qty: 50
        }
      ]
      
      setFefoPicklist(mockPicklist)
      setSuccess(`Scanned: ${scanValue} - FEFO picklist generated`)
      setScanValue("")
    } catch (err) {
      console.error("Error scanning:", err)
      setError(err instanceof Error ? err.message : "Failed to scan item")
    } finally {
      setScanning(false)
    }
  }

  const handleApplyFEFO = (picklistItem: FEFOPicklistItem, skuId: string) => {
    const newLine: DispatchLine = {
      sku_id: skuId,
      uom: "PCS", // Default UOM
      qty: picklistItem.recommended_qty,
      lot_no: picklistItem.lot_no,
      batch_no: picklistItem.batch_no
    }
    setLines([...lines, newLine])
    setFefoPicklist([])
  }

  const handleSubmit = async () => {
    if (!warehouse || !soNo || lines.length === 0) {
      setError("Please fill in all required fields and add at least one dispatch line")
      return
    }

    // Validate lines
    const invalidLines = lines.some(line => 
      !line.sku_id || !line.lot_no || !line.batch_no || line.qty <= 0
    )

    if (invalidLines) {
      setError("Please ensure all dispatch lines have valid SKU, lot, batch, and quantity")
      return
    }

    try {
      setLoading(true)
      setError(null)
      setSuccess(null)

      const response = await postDispatch({
        warehouse,
        so_no: soNo,
        lines
      })

      if (response.success) {
        setSuccess(`Dispatch posted successfully! Processed ${response.data.lines_processed} lines.`)
        setLines([])
        setWarehouse("")
        setSoNo("")
        setFefoPicklist([])
      }
    } catch (err) {
      console.error("Error posting dispatch:", err)
      setError(err instanceof Error ? err.message : "Failed to post dispatch")
    } finally {
      setLoading(false)
    }
  }

  const getTotalQuantity = () => {
    return lines.reduce((sum, line) => sum + line.qty, 0)
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
            <Truck className="h-5 w-5" />
            Outward Dispatch
          </CardTitle>
          <CardDescription>
            Dispatch materials against sales orders with FEFO picklist
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

      {/* Dispatch Details */}
      <Card>
        <CardHeader>
          <CardTitle>Dispatch Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label htmlFor="so-no">Sales Order No</Label>
              <Input
                id="so-no"
                placeholder="Enter sales order number"
                value={soNo}
                onChange={(e) => setSoNo(e.target.value)}
              />
            </div>
          </div>
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
            Scan items to generate FEFO picklist for dispatch
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Scan SKU or enter SKU ID..."
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
                <Search className="h-4 w-4 mr-2" />
              )}
              Generate Picklist
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* FEFO Picklist */}
      {fefoPicklist.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              FEFO Picklist
            </CardTitle>
            <CardDescription>
              First Expiry First Out recommendations for dispatch
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lot No</TableHead>
                    <TableHead>Batch No</TableHead>
                    <TableHead>Available Qty</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Unit Cost</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Recommended Qty</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fefoPicklist.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono">{item.lot_no}</TableCell>
                      <TableCell className="font-mono">{item.batch_no}</TableCell>
                      <TableCell>{item.available_qty.toLocaleString()}</TableCell>
                      <TableCell>{item.expiry_date}</TableCell>
                      <TableCell>₹{item.unit_cost.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={item.priority === 1 ? "default" : "secondary"}>
                          {item.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">{item.recommended_qty.toLocaleString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApplyFEFO(item, scanValue)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Apply
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dispatch Lines */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Dispatch Lines</CardTitle>
              <CardDescription>
                Materials to dispatch against sales order
              </CardDescription>
            </div>
            <Button onClick={handleAddLine} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Manual
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No dispatch lines added</p>
              <p className="text-sm">Use the scanner or add manual entries</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU ID</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Lot No</TableHead>
                    <TableHead>Batch No</TableHead>
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
                          value={line.qty}
                          onChange={(e) => handleLineChange(index, 'qty', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
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
                          value={line.batch_no}
                          onChange={(e) => handleLineChange(index, 'batch_no', e.target.value)}
                          placeholder="Batch No"
                          className="w-24"
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

      {/* Submit */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setLines([])
              setWarehouse("")
              setSoNo("")
              setFefoPicklist([])
            }}>
              Clear All
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || lines.length === 0 || !warehouse || !soNo}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Post Dispatch
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
