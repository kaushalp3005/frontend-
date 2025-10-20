"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Package, 
  Factory, 
  Layers, 
  ShoppingCart, 
  TrendingUp, 
  Calendar,
  Warehouse,
  ClipboardList,
  ArrowRightLeft,
  Truck,
  Settings,
  Users,
  BarChart3
} from "lucide-react"
import { getDashboardSummary } from "@/lib/api/consumptionApiService"
import { DashboardSummary, MaterialType } from "@/types/consumption"
import { AuthGuard } from "@/components/auth/auth-guard"
import {
  ConsumptionDashboard,
  ConsumptionLedger,
  JobCardsList,
  ConsumptionForm,
  ProductionReceipt,
  TransferForm,
  DispatchForm,
  AdminMasters,
  Configuration,
  ConsumptionErrorBoundary
} from "@/components/modules/consumption"

interface ConsumptionPageProps {
  params: {
    company: string
  }
}

function ConsumptionPageContent({ params }: ConsumptionPageProps) {
  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  console.log('[CONSUMPTION] Component mounting for company:', params.company)

  useEffect(() => {
    console.log('[CONSUMPTION] useEffect triggered for company:', params.company)
    
    const fetchDashboardData = async () => {
      try {
        console.log('[CONSUMPTION] Starting to fetch dashboard data...')
        setLoading(true)
        setError(null)
        const data = await getDashboardSummary(params.company as any)
        console.log('[CONSUMPTION] Dashboard data fetched successfully:', data)
        setDashboardData(data)
      } catch (err) {
        console.error('[CONSUMPTION] Error fetching dashboard data:', err)
        
        // Provide fallback data for development when backend endpoints are not available
        if (err instanceof Error && err.message.includes('404')) {
          console.log('[CONSUMPTION] Backend endpoint not available, using fallback data for development')
          setDashboardData({
            date: new Date().toISOString().split('T')[0],
            company: params.company,
            material_groups: {
              RM: {
                total_qty: 1500.50,
                total_value: 15750.25,
                warehouse_count: 3,
                sku_count: 25
              },
              PM: {
                total_qty: 2500.00,
                total_value: 12500.00,
                warehouse_count: 2,
                sku_count: 15
              },
              SFG: {
                total_qty: 800.75,
                total_value: 12000.00,
                warehouse_count: 2,
                sku_count: 8
              },
              FG: {
                total_qty: 1200.00,
                total_value: 24000.00,
                warehouse_count: 2,
                sku_count: 12
              }
            }
          })
          setError("Backend endpoints not available - showing demo data")
        } else {
          setError(err instanceof Error ? err.message : "Failed to load dashboard data")
        }
      } finally {
        setLoading(false)
        console.log('[CONSUMPTION] Dashboard data fetch completed')
      }
    }

    fetchDashboardData()
  }, [params.company])

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

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading consumption data...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error && !dashboardData) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              <p className="text-lg font-semibold mb-2">Error Loading Data</p>
              <p className="text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 lg:p-6">
      {/* Demo Data Banner */}
      {error && error.includes("demo data") && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800">
                <strong>Development Mode:</strong> Backend endpoints not available. Showing demo data for UI testing.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Consumption Management</h1>
        <p className="text-muted-foreground">
          Monitor material consumption, production tracking, and inventory movements
        </p>
      </div>

      {/* Dashboard Summary Tiles */}
      {dashboardData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                      <span>Value: ₹{data.total_value.toLocaleString()}</span>
                      <span>{data.warehouse_count} WH</span>
                    </div>
                  </div>
                  <div className={`absolute top-0 right-0 w-2 h-full ${colorClass}`} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-9">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="ledger" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Ledger</span>
          </TabsTrigger>
          <TabsTrigger value="jobcards" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Job Cards</span>
          </TabsTrigger>
          <TabsTrigger value="consumption" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Consumption</span>
          </TabsTrigger>
          <TabsTrigger value="receipt" className="flex items-center gap-2">
            <Factory className="h-4 w-4" />
            <span className="hidden sm:inline">Receipt</span>
          </TabsTrigger>
          <TabsTrigger value="transfer" className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Transfer</span>
          </TabsTrigger>
          <TabsTrigger value="dispatch" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Dispatch</span>
          </TabsTrigger>
          <TabsTrigger value="masters" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Masters</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Config</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <ConsumptionDashboard company={params.company} />
        </TabsContent>

        <TabsContent value="ledger">
          <ConsumptionLedger company={params.company} />
        </TabsContent>

        <TabsContent value="jobcards">
          <JobCardsList company={params.company} />
        </TabsContent>

        <TabsContent value="consumption">
          <ConsumptionForm company={params.company} />
        </TabsContent>

        <TabsContent value="receipt">
          <ProductionReceipt company={params.company} />
        </TabsContent>

        <TabsContent value="transfer">
          <TransferForm company={params.company} />
        </TabsContent>

        <TabsContent value="dispatch">
          <DispatchForm company={params.company} />
        </TabsContent>

        <TabsContent value="masters">
          <AdminMasters company={params.company} />
        </TabsContent>

        <TabsContent value="config">
          <Configuration company={params.company} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function ConsumptionPage({ params }: ConsumptionPageProps) {
  return (
    <AuthGuard company={params.company as any} module="consumption" action="view">
      <ConsumptionErrorBoundary>
        <ConsumptionPageContent params={params} />
      </ConsumptionErrorBoundary>
    </AuthGuard>
  )
}
