"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { authApi } from "@/lib/api"
import { PermissionGuard } from "@/components/auth/permission-gate"
import Link from "next/link"
import { ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine, Package, TrendingUp, Clock, Loader2, AlertCircle, Calendar } from "lucide-react"
import type { Company } from "@/types/auth"

interface DashboardPageProps {
  params: {
    company: Company
  }
}

export default function DashboardPage({ params }: DashboardPageProps) {
  const { company } = params

  // State management
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalInward: 0,
    totalOutward: 0,
    totalTransfers: 0,
    pendingLabels: 0,
    activeItems: 0,
    weeklyInwardChange: 0,
    weeklyTransferChange: 0
  })
  const [recentInward, setRecentInward] = useState<any[]>([])
  const [recentTransfers, setRecentTransfers] = useState<any[]>([])
  const [todaySummary, setTodaySummary] = useState({
    inward: { count: 0, total: 0 },
    outward: { count: 0, total: 0 },
    transfers: { count: 0, total: 0 }
  })

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch all dashboard data in parallel
        const [
          statsData,
          inwardData,
          transfersData,
          todayInward,
          todayOutward,
          todayTransfers,
          allTimeInward,
          allTimeOutward,
          allTimeTransfers
        ] = await Promise.allSettled([
          authApi.fetchDashboardStats(company),
          authApi.fetchRecentInward(company, 5),
          authApi.fetchRecentTransfers(company, 5),
          authApi.fetchTodayInwardSummary(company),
          authApi.fetchTodayOutwardSummary(company),
          authApi.fetchTodayTransferSummary(company),
          authApi.fetchAllTimeInwardTotal(company),
          authApi.fetchAllTimeOutwardTotal(company),
          authApi.fetchAllTimeTransferTotal(company)
        ])

        // Handle stats - combine dashboard stats with all-time totals
        const dashboardStats = statsData.status === 'fulfilled' ? statsData.value : {
          totalInward: 0,
          totalTransfers: 0,
          pendingLabels: 0,
          activeItems: 0,
          weeklyInwardChange: 0,
          weeklyTransferChange: 0
        }

        setStats({
          totalInward: allTimeInward.status === 'fulfilled' ? allTimeInward.value : dashboardStats.totalInward,
          totalOutward: allTimeOutward.status === 'fulfilled' ? allTimeOutward.value : 0,
          totalTransfers: allTimeTransfers.status === 'fulfilled' ? allTimeTransfers.value : dashboardStats.totalTransfers,
          pendingLabels: dashboardStats.pendingLabels,
          activeItems: dashboardStats.activeItems,
          weeklyInwardChange: dashboardStats.weeklyInwardChange,
          weeklyTransferChange: dashboardStats.weeklyTransferChange
        })

        // Handle recent inward
        if (inwardData.status === 'fulfilled') {
          setRecentInward(inwardData.value)
        } else {
          console.warn('Failed to fetch recent inward:', inwardData.reason)
        }

        // Handle recent transfers
        if (transfersData.status === 'fulfilled') {
          setRecentTransfers(transfersData.value)
        } else {
          console.warn('Failed to fetch recent transfers:', transfersData.reason)
        }

        // Handle today's summary
        setTodaySummary({
          inward: todayInward.status === 'fulfilled' ? todayInward.value : { count: 0, total: 0 },
          outward: todayOutward.status === 'fulfilled' ? todayOutward.value : { count: 0, total: 0 },
          transfers: todayTransfers.status === 'fulfilled' ? todayTransfers.value : { count: 0, total: 0 }
        })

      } catch (err) {
        console.error('Dashboard data fetch error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [company])

  const quickActions = [
    {
      title: "New Inward Entry",
      description: "Create a new inward inventory record",
      href: `/${company}/inward/new`,
      icon: ArrowDownToLine,
      module: "inward" as const,
      action: "edit" as const,
    },
    {
      title: "New Transfer",
      description: "Transfer items between locations",
      href: `/${company}/transfer/new`,
      icon: ArrowRightLeft,
      module: "transfer" as const,
      action: "edit" as const,
    },
    {
      title: "View Inventory",
      description: "Check current inventory levels",
      href: `/${company}/inventory-ledger`,
      icon: Package,
      module: "inventory-ledger" as const,
      action: "view" as const,
    },
  ]

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
        {/* Welcome Header */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Welcome to {company}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage your inventory operations from this dashboard</p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Today's Summary */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-lg">Today's Activity</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs">
                {new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              </Badge>
            </div>
            <CardDescription className="text-sm">Summary of all transactions for today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
              {/* Today's Inward */}
              <div className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg border">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                  <ArrowDownToLine className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Inward</p>
                  <p className="text-xl font-bold">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : todaySummary.inward.count}
                  </p>
                  <p className="text-xs text-muted-foreground">transactions</p>
                </div>
              </div>

              {/* Today's Outward */}
              <div className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg border">
                <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-full">
                  <ArrowUpFromLine className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Outward</p>
                  <p className="text-xl font-bold">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : todaySummary.outward.count}
                  </p>
                  <p className="text-xs text-muted-foreground">transactions</p>
                </div>
              </div>

              {/* Today's Transfers */}
              <div className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg border">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <ArrowRightLeft className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Transfers</p>
                  <p className="text-xl font-bold">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : todaySummary.transfers.count}
                  </p>
                  <p className="text-xs text-muted-foreground">transactions</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0">
              <CardTitle className="text-sm font-medium">Total Inward</CardTitle>
              <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-0 pt-2">
              <div className="text-xl sm:text-2xl font-bold">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.totalInward.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {loading ? "Loading..." : "All time records"}
              </p>
            </CardContent>
          </Card>

          <Card className="p-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0">
              <CardTitle className="text-sm font-medium">Total Outward</CardTitle>
              <ArrowUpFromLine className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-0 pt-2">
              <div className="text-xl sm:text-2xl font-bold">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.totalOutward.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {loading ? "Loading..." : "All time records"}
              </p>
            </CardContent>
          </Card>

          <Card className="p-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0">
              <CardTitle className="text-sm font-medium">Total Transfers</CardTitle>
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-0 pt-2">
              <div className="text-xl sm:text-2xl font-bold">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.totalTransfers.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {loading ? "Loading..." : "All time records"}
              </p>
            </CardContent>
          </Card>

          <Card className="p-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0">
              <CardTitle className="text-sm font-medium">Active Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-0 pt-2">
              <div className="text-xl sm:text-2xl font-bold">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.activeItems.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {loading ? "Loading..." : "In inventory"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-lg sm:text-xl font-semibold">Quick Actions</h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((action) => (
              <PermissionGuard 
                key={action.href}
                module={action.module} 
                action={action.action}
                fallback={
                  <Card className="opacity-50 p-1">
                    <CardHeader className="pb-3">
                      <div className="flex items-center space-x-2">
                        <action.icon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                        <CardTitle className="text-base sm:text-lg text-muted-foreground">{action.title}</CardTitle>
                      </div>
                      <CardDescription className="text-sm">No permission to access this feature</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Button disabled className="w-full h-9">
                        Access Denied
                      </Button>
                    </CardContent>
                  </Card>
                }
              >
                <Card className="hover:shadow-md transition-shadow p-1">
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-2">
                      <action.icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      <CardTitle className="text-base sm:text-lg">{action.title}</CardTitle>
                    </div>
                    <CardDescription className="text-sm">{action.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button asChild className="w-full h-9">
                      <Link href={action.href}>Get Started</Link>
                    </Button>
                  </CardContent>
                </Card>
              </PermissionGuard>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
          {/* Recent Inward */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2 text-base">
                <ArrowDownToLine className="h-4 w-4" />
                <span>Recent Inward</span>
              </CardTitle>
              <CardDescription className="text-sm">Latest inventory receipts</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Loading recent inward...</span>
                </div>
              ) : recentInward.length > 0 ? (
                <div className="space-y-3">
                  {recentInward.map((record) => (
                    <div
                      key={record.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border rounded-lg space-y-2 sm:space-y-0"
                    >
                      <div className="flex-1 min-w-0 w-full sm:w-auto">
                        <p className="font-medium text-sm truncate">{record.item_description}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {record.invoice_number && `Invoice: ${record.invoice_number}`}
                          {record.po_number && ` • PO: ${record.po_number}`}
                          {record.quantity_units && record.uom && ` • ${record.quantity_units} ${record.uom}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Entry Date: {new Date(record.entry_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={record.status === "Completed" ? "default" : "secondary"} className="text-xs">
                          {record.status}
                        </Badge>
                        <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                          <Link href={`/${company}/inward/${record.transaction_id}`}>View</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full bg-transparent h-8 text-sm" asChild>
                    <Link href={`/${company}/inward`}>View All Inward</Link>
                  </Button>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4 text-sm">No inward records yet</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Transfers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2 text-base">
                <ArrowRightLeft className="h-4 w-4" />
                <span>Recent Transfers</span>
              </CardTitle>
              <CardDescription className="text-sm">Latest location transfers</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Loading recent transfers...</span>
                </div>
              ) : recentTransfers.length > 0 ? (
                <div className="space-y-3">
                  {recentTransfers.map((record) => (
                    <div key={record.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border rounded-lg space-y-2 sm:space-y-0">
                      <div className="flex-1 min-w-0 w-full sm:w-auto">
                        <p className="font-medium text-sm">
                          {record.source_location} → {record.destination_location}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {record.approved_by} • {new Date(record.transfer_date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Status: {record.status}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={record.status === "Completed" ? "default" : "secondary"} className="text-xs">
                          {record.status}
                        </Badge>
                        <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                          <Link href={`/${company}/transfer/${record.id}`}>View</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full bg-transparent h-8 text-sm" asChild>
                    <Link href={`/${company}/transfer`}>View All Transfers</Link>
                  </Button>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4 text-sm">No transfers yet</p>
              )}
            </CardContent>
          </Card>
        </div>
    </div>
  )
}
