// File: TransferForm.tsx
// Path: frontend/src/components/modules/consumption/TransferForm.tsx

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  ArrowRightLeft, 
  Plus, 
  Trash2, 
  Save, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Package,
  History,
  Search
} from "lucide-react"
import { postTransfer, getTransferHistory } from "@/lib/api/consumptionApiService"
import { TransferLine, TransferHistoryEntry } from "@/types/consumption"

interface TransferFormProps {
  company: string
}

export function TransferForm({ company }: TransferFormProps) {
  const [sourceWarehouse, setSourceWarehouse] = useState("")
  const [destinationWarehouse, setDestinationWarehouse] = useState("")
  const [lines, setLines] = useState<TransferLine[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // History tab state
  const [historyData, setHistoryData] = useState<TransferHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotalPages, setHistoryTotalPages] = useState(1)
  const [historyTotalRecords, setHistoryTotalRecords] = useState(0)

  const handleAddLine = () => {
    const newLine: TransferLine = {
      sku_id: "",
      uom: "",
      qty: 0,
      lot_no: "",
      batch_no: ""
    }
    setLines([...lines, newLine])
  }

  const handleLineChange = (index: number, field: keyof TransferLine, value: string | number) => {
    const updatedLines = [...lines]
    updatedLines[index][field] = value as any
    setLines(updatedLines)
  }

  const handleRemoveLine = (index: number) => {
    const updatedLines = lines.filter((_, i) => i !== index)
    setLines(updatedLines)
  }

  const handleSubmit = async () => {
    if (!sourceWarehouse || !destinationWarehouse || lines.length === 0) {
      setError("Please fill in all required fields and add at least one transfer line")
      return
    }

    if (sourceWarehouse === destinationWarehouse) {
      setError("Source and destination warehouses must be different")
      return
    }

    // Validate lines
    const invalidLines = lines.some(line => 
      !line.sku_id || !line.lot_no || !line.batch_no || line.qty <= 0
    )

    if (invalidLines) {
      setError("Please ensure all transfer lines have valid SKU, lot, batch, and quantity")
      return
    }

    try {
      setLoading(true)
      setError(null)
      setSuccess(null)

      const response = await postTransfer({
        source_warehouse: sourceWarehouse,
        destination_warehouse: destinationWarehouse,
        lines
      })

      if (response.success) {
        setSuccess(`Transfer posted successfully! Processed ${response.data.lines_processed} lines.`)
        setLines([])
        setSourceWarehouse("")
        setDestinationWarehouse("")
        // Refresh history
        fetchTransferHistory()
      }
    } catch (err) {
      console.error("Error posting transfer:", err)
      setError(err instanceof Error ? err.message : "Failed to post transfer")
    } finally {
      setLoading(false)
    }
  }

  const fetchTransferHistory = async () => {
    try {
      setHistoryLoading(true)
      setHistoryError(null)

      const response = await getTransferHistory({
        source_warehouse: sourceWarehouse || undefined,
        destination_warehouse: destinationWarehouse || undefined,
        page: historyPage,
        per_page: 20
      })

      setHistoryData(response.data)
      setHistoryTotalRecords(response.total)
      setHistoryTotalPages(response.pages)
    } catch (err) {
      console.error("Error fetching transfer history:", err)
      setHistoryError(err instanceof Error ? err.message : "Failed to load transfer history")
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    fetchTransferHistory()
  }, [company, historyPage, sourceWarehouse, destinationWarehouse])

  const getTotalQuantity = () => {
    return lines.reduce((sum, line) => sum + line.qty, 0)
  }

  const getTotalValue = () => {
    // This would typically come from the API based on cost carryover
    return 0 // Placeholder
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="transfer" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transfer">Transfer Form</TabsTrigger>
          <TabsTrigger value="history">Transfer History</TabsTrigger>
        </TabsList>

        <TabsContent value="transfer" className="space-y-6">
          {/* Header */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                Inter-Warehouse Transfer
              </CardTitle>
              <CardDescription>
                Transfer materials between warehouses with cost carryover
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

          {/* Warehouse Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Warehouse Selection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="source-warehouse">Source Warehouse</Label>
                  <Select value={sourceWarehouse} onValueChange={setSourceWarehouse}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WH001">Main Warehouse</SelectItem>
                      <SelectItem value="WH002">Production Warehouse</SelectItem>
                      <SelectItem value="WH003">Storage Warehouse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destination-warehouse">Destination Warehouse</Label>
                  <Select value={destinationWarehouse} onValueChange={setDestinationWarehouse}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select destination warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WH001">Main Warehouse</SelectItem>
                      <SelectItem value="WH002">Production Warehouse</SelectItem>
                      <SelectItem value="WH003">Storage Warehouse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transfer Lines */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Transfer Lines</CardTitle>
                  <CardDescription>
                    Materials to transfer between warehouses
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
                  <p>No transfer lines added</p>
                  <p className="text-sm">Add materials to transfer</p>
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
                  setSourceWarehouse("")
                  setDestinationWarehouse("")
                }}>
                  Clear All
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={loading || lines.length === 0 || !sourceWarehouse || !destinationWarehouse}
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Post Transfer
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          {/* History Header */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Transfer History
              </CardTitle>
              <CardDescription>
                View transfer history with filtering options
              </CardDescription>
            </CardHeader>
          </Card>

          {/* History Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Filter History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="history-source">Source Warehouse</Label>
                  <Select value={sourceWarehouse || "all"} onValueChange={(value) => setSourceWarehouse(value === "all" ? "" : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All warehouses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All warehouses</SelectItem>
                      <SelectItem value="WH001">Main Warehouse</SelectItem>
                      <SelectItem value="WH002">Production Warehouse</SelectItem>
                      <SelectItem value="WH003">Storage Warehouse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="history-destination">Destination Warehouse</Label>
                  <Select value={destinationWarehouse || "all"} onValueChange={(value) => setDestinationWarehouse(value === "all" ? "" : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All warehouses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All warehouses</SelectItem>
                      <SelectItem value="WH001">Main Warehouse</SelectItem>
                      <SelectItem value="WH002">Production Warehouse</SelectItem>
                      <SelectItem value="WH003">Storage Warehouse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* History Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Transfer History</CardTitle>
                  <CardDescription>
                    Historical transfer records
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchTransferHistory}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {historyError && (
                <div className="text-center text-red-600 mb-4">
                  <p className="text-sm">{historyError}</p>
                </div>
              )}
              
              {historyLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transfer ID</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Lot/Batch</TableHead>
                        <TableHead>Unit Cost</TableHead>
                        <TableHead>Total Value</TableHead>
                        <TableHead>Transfer Date</TableHead>
                        <TableHead>Created By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyData.map((entry, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-sm">{entry.transfer_id}</TableCell>
                          <TableCell>{entry.source_warehouse}</TableCell>
                          <TableCell>{entry.destination_warehouse}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{entry.sku_id}</div>
                              <div className="text-sm text-muted-foreground">{entry.sku_name}</div>
                            </div>
                          </TableCell>
                          <TableCell>{entry.qty.toLocaleString()}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{entry.lot_no}</div>
                              <div className="text-sm text-muted-foreground">{entry.batch_no}</div>
                            </div>
                          </TableCell>
                          <TableCell>₹{entry.unit_cost.toFixed(2)}</TableCell>
                          <TableCell className="font-semibold">₹{entry.total_value.toLocaleString()}</TableCell>
                          <TableCell>{new Date(entry.transfer_date).toLocaleDateString()}</TableCell>
                          <TableCell>{entry.created_by}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {historyData.length === 0 && !historyLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No transfer history found</p>
                  <p className="text-sm">Try adjusting your filters</p>
                </div>
              )}

              {/* Pagination */}
              {historyTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((historyPage - 1) * 20) + 1} to {Math.min(historyPage * 20, historyTotalRecords)} of {historyTotalRecords} entries
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPage(prev => Math.max(1, prev - 1))}
                      disabled={historyPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center px-3 py-1 text-sm">
                      Page {historyPage} of {historyTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPage(prev => Math.min(historyTotalPages, prev + 1))}
                      disabled={historyPage === historyTotalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
