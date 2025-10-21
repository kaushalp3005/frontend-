// File: ConsumptionLedger.tsx
// Path: frontend/src/components/modules/consumption/ConsumptionLedger.tsx

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Calendar,
  Package,
  Warehouse,
  TrendingUp
} from "lucide-react"
import { getLedgerData, getLedgerRange } from "@/lib/api/consumptionApiService"
import { LedgerEntry, MaterialType, LedgerRequest, LedgerRangeRequest } from "@/types/consumption"

interface ConsumptionLedgerProps {
  company: string
}

export function ConsumptionLedger({ company }: ConsumptionLedgerProps) {
  const [ledgerData, setLedgerData] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  
  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("")
  const [selectedSKU, setSelectedSKU] = useState<string>("")
  const [selectedMaterialType, setSelectedMaterialType] = useState<MaterialType | "">("")
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: new Date().toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  })

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

  const fetchLedgerData = async (isRangeSearch = false) => {
    try {
      setLoading(true)
      setError(null)

      let response
      if (isRangeSearch) {
        const request: LedgerRangeRequest = {
          start_date: dateRange.from,
          end_date: dateRange.to,
          warehouse: selectedWarehouse || undefined,
          sku_id: selectedSKU || undefined,
          material_type: selectedMaterialType || undefined,
          page: currentPage,
          per_page: 50 // Updated to match API spec
        }
        response = await getLedgerRange(request)
      } else {
        const request: LedgerRequest = {
          date: selectedDate,
          warehouse: selectedWarehouse || undefined,
          sku_id: selectedSKU || undefined,
          material_type: selectedMaterialType || undefined
        }
        response = await getLedgerData(request)
      }

      setLedgerData(response.data)
      if (response.total !== undefined) {
        setTotalRecords(response.total)
        setTotalPages(response.pages || 1)
      }
    } catch (err) {
      console.error("Error fetching ledger data:", err)
      
      // Provide fallback data for development when backend endpoints are not available
      if (err instanceof Error && err.message.includes('404')) {
        console.log("Backend endpoint not available, using fallback ledger data for development")
        const fallbackData: LedgerEntry[] = [
          {
            date: selectedDate,
            company: company,
            warehouse: selectedWarehouse || "WH001",
            sku_id: selectedSKU || "SKU001",
            material_type: selectedMaterialType || "RM",
            opening_stock: 100.00,
            stock_in_hand: 100.00,
            transfer_in: 50.00,
            transfer_out: 25.00,
            stock_in: 200.00,
            stock_out: 75.00,
            closing_stock: 250.00,
            valuation_rate: 10.50,
            inventory_value_closing: 2625.00,
            uom: "KG"
          },
          {
            date: selectedDate,
            company: company,
            warehouse: selectedWarehouse || "WH002",
            sku_id: selectedSKU || "SKU002",
            material_type: selectedMaterialType || "PM",
            opening_stock: 200.00,
            stock_in_hand: 200.00,
            transfer_in: 30.00,
            transfer_out: 15.00,
            stock_in: 150.00,
            stock_out: 50.00,
            closing_stock: 315.00,
            valuation_rate: 8.75,
            inventory_value_closing: 2756.25,
            uom: "PCS"
          }
        ]
        setLedgerData(fallbackData)
        setTotalRecords(fallbackData.length)
        setTotalPages(1)
        setError("Backend endpoints not available - showing demo ledger data")
      } else {
        setError(err instanceof Error ? err.message : "Failed to load ledger data")
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLedgerData()
  }, [company, currentPage])

  const handleSearch = () => {
    setCurrentPage(1)
    fetchLedgerData(true)
  }

  const handleReset = () => {
    setSelectedDate(new Date().toISOString().split('T')[0])
    setSelectedWarehouse("")
    setSelectedSKU("")
    setSelectedMaterialType("")
    setDateRange({
      from: new Date().toISOString().split('T')[0],
      to: new Date().toISOString().split('T')[0]
    })
    setSearchTerm("")
    setCurrentPage(1)
    fetchLedgerData()
  }

  const filteredData = ledgerData.filter(entry =>
    entry.sku_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.warehouse.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getTotalValue = () => {
    return filteredData.reduce((sum, entry) => sum + entry.inventory_value_closing, 0)
  }

  const getTotalQuantity = () => {
    return filteredData.reduce((sum, entry) => sum + entry.closing_stock, 0)
  }

  if (loading && ledgerData.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading ledger data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Demo Data Banner */}
      {error && error.includes("demo ledger data") && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800">
                <strong>Development Mode:</strong> Backend endpoints not available. Showing demo ledger data for UI testing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Ledger Filters
          </CardTitle>
          <CardDescription>
            Filter ledger data by various criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="date">Single Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warehouse">Warehouse</Label>
              <Select value={selectedWarehouse || "all"} onValueChange={(value) => setSelectedWarehouse(value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  <SelectItem value="WH001">Main Warehouse</SelectItem>
                  <SelectItem value="WH002">Production Warehouse</SelectItem>
                  <SelectItem value="WH003">Storage Warehouse</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU ID</Label>
              <Input
                id="sku"
                placeholder="Enter SKU ID"
                value={selectedSKU}
                onChange={(e) => setSelectedSKU(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="material-type">Material Type</Label>
              <Select value={selectedMaterialType || "all"} onValueChange={(value) => setSelectedMaterialType(value === "all" ? "" : value as MaterialType)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="RM">Raw Materials</SelectItem>
                  <SelectItem value="PM">Packaging Materials</SelectItem>
                  <SelectItem value="SFG">Semi-Finished Goods</SelectItem>
                  <SelectItem value="FG">Finished Goods</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="date-from">Date From</Label>
              <Input
                id="date-from"
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-to">Date To</Label>
              <Input
                id="date-to"
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleSearch} className="flex-1">
                <Search className="h-4 w-4 mr-2" />
                Search Range
              </Button>
              <Button onClick={handleReset} variant="outline">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{getTotalValue().toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Closing inventory value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTotalQuantity().toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Closing stock quantity
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Records</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRecords}</div>
            <p className="text-xs text-muted-foreground">
              Total ledger entries
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search by SKU ID or Warehouse..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ledger Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Ledger Entries</CardTitle>
              <CardDescription>
                Daily inventory ledger with stock movements
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => fetchLedgerData()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-center text-red-600 mb-4">
              <p className="text-sm">{error}</p>
            </div>
          )}
          
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>SKU ID</TableHead>
                  <TableHead>Material Type</TableHead>
                  <TableHead>Opening Stock</TableHead>
                  <TableHead>Stock In</TableHead>
                  <TableHead>Stock Out</TableHead>
                  <TableHead>Transfer In</TableHead>
                  <TableHead>Transfer Out</TableHead>
                  <TableHead>Closing Stock</TableHead>
                  <TableHead>Valuation Rate</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>UOM</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((entry, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{entry.date}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Warehouse className="h-4 w-4 text-muted-foreground" />
                        {entry.warehouse}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{entry.sku_id}</TableCell>
                    <TableCell>
                      <Badge className={materialTypeColors[entry.material_type]}>
                        {materialTypeLabels[entry.material_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>{entry.opening_stock.toLocaleString()}</TableCell>
                    <TableCell className="text-green-600">{entry.stock_in.toLocaleString()}</TableCell>
                    <TableCell className="text-red-600">{entry.stock_out.toLocaleString()}</TableCell>
                    <TableCell className="text-blue-600">{entry.transfer_in.toLocaleString()}</TableCell>
                    <TableCell className="text-orange-600">{entry.transfer_out.toLocaleString()}</TableCell>
                    <TableCell className="font-semibold">{entry.closing_stock.toLocaleString()}</TableCell>
                    <TableCell>₹{entry.valuation_rate.toFixed(2)}</TableCell>
                    <TableCell className="font-semibold">₹{entry.inventory_value_closing.toLocaleString()}</TableCell>
                    <TableCell>{entry.uom}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredData.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No ledger entries found</p>
              <p className="text-sm">Try adjusting your filters or search criteria</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, totalRecords)} of {totalRecords} entries
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="flex items-center px-3 py-1 text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
