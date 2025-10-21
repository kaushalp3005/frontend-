// File: ConsumptionDashboard.tsx
// Path: frontend/src/components/modules/consumption/ConsumptionDashboard.tsx

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Factory, 
  Layers, 
  ShoppingCart,
  Calendar,
  RefreshCw,
  Download,
  Filter
} from "lucide-react"
import { getDashboardSummary } from "@/lib/api/consumptionApiService"
import { DashboardSummary, MaterialType } from "@/types/consumption"

interface ConsumptionDashboardProps {
  company: string
}

export function ConsumptionDashboard({ company }: ConsumptionDashboardProps) {
  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("")

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getDashboardSummary(company as any, {
        date: selectedDate,
        warehouse: selectedWarehouse || undefined
      })
      setDashboardData(data)
    } catch (err) {
      console.error("Error fetching dashboard data:", err)
      setError(err instanceof Error ? err.message : "Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [company, selectedDate, selectedWarehouse])

  const materialTypeIcons = {
    RM: Package,
    PM: Factory,
    SFG: Layers,
    FG: ShoppingCart
  }

  const materialTypeColors = {
    RM: "bg-blue-500",
    PM: "bg-green-500", 
    SFG: "bg-yellow-500",
    FG: "bg-purple-500"
  }

  const materialTypeLabels = {
    RM: "Raw Materials",
    PM: "Packaging Materials",
    SFG: "Semi-Finished Goods",
    FG: "Finished Goods"
  }

  const getTotalValue = () => {
    if (!dashboardData) return 0
    return Object.values(dashboardData.material_groups).reduce((sum, group) => sum + group.total_value, 0)
  }

  const getTotalQuantity = () => {
    if (!dashboardData) return 0
    return Object.values(dashboardData.material_groups).reduce((sum, group) => sum + group.total_qty, 0)
  }

  const getTotalSKUs = () => {
    if (!dashboardData) return 0
    return Object.values(dashboardData.material_groups).reduce((sum, group) => sum + group.sku_count, 0)
  }

  const getTotalWarehouses = () => {
    if (!dashboardData) return 0
    return Object.values(dashboardData.material_groups).reduce((sum, group) => sum + group.warehouse_count, 0)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard data...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p className="text-lg font-semibold mb-2">Error Loading Dashboard</p>
            <p className="text-sm">{error}</p>
            <Button onClick={fetchDashboardData} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Dashboard Filters
          </CardTitle>
          <CardDescription>
            Filter dashboard data by date and warehouse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
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
            <div className="flex items-end">
              <Button onClick={fetchDashboardData} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{getTotalValue().toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Across all material types
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
              Units across all SKUs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total SKUs</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTotalSKUs()}</div>
            <p className="text-xs text-muted-foreground">
              Active SKUs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warehouses</CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTotalWarehouses()}</div>
            <p className="text-xs text-muted-foreground">
              Active warehouses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Material Group Details */}
      {dashboardData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(dashboardData.material_groups).map(([type, data]) => {
            const Icon = materialTypeIcons[type as MaterialType]
            const colorClass = materialTypeColors[type as MaterialType]
            const label = materialTypeLabels[type as MaterialType]
            
            return (
              <Card key={type} className="relative overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{label}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold">{data.total_qty.toLocaleString()}</span>
                      <Badge variant="secondary" className="text-xs">
                        {data.sku_count} SKUs
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>₹{data.total_value.toLocaleString()}</span>
                      <span>{data.warehouse_count} WH</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Avg: ₹{(data.total_value / data.total_qty).toFixed(2)}/unit
                    </div>
                  </div>
                  <div className={`absolute top-0 right-0 w-2 h-full ${colorClass}`} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Dashboard Actions</CardTitle>
          <CardDescription>
            Export data and manage dashboard settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Summary
            </Button>
            <Button variant="outline">
              <Calendar className="h-4 w-4 mr-2" />
              Date Range Report
            </Button>
            <Button variant="outline">
              <Package className="h-4 w-4 mr-2" />
              Material Analysis
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
