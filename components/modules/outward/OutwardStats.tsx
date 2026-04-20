"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Package, TrendingUp, Truck, CheckCircle2 } from "lucide-react"
import { getOutwardStats } from "@/lib/api/outwardApiService"
import type { OutwardStatsResponse } from "@/types/outward"
import { formatCurrency } from "@/lib/utils/outwardUtils"
import { DELIVERY_STATUS_LABELS } from "@/types/outward"

interface OutwardStatsProps {
  company: string
  refreshTrigger?: number
}

export default function OutwardStats({ company, refreshTrigger }: OutwardStatsProps) {
  const [stats, setStats] = useState<OutwardStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
  }, [company, refreshTrigger])

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getOutwardStats(company)
      setStats(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch statistics")
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const normalizedStatus = status.toLowerCase()
    switch (normalizedStatus) {
      case 'delivered':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'in_transit':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error || !stats) {
    return null // Silently fail for stats
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Records */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Records</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total_records.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Outward shipments
          </p>
        </CardContent>
      </Card>

      {/* Total Boxes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Boxes</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totals.boxes.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Shipped boxes
          </p>
        </CardContent>
      </Card>

      {/* Total Invoice Value */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Invoice Value</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.totals.invoice_value)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Total invoice amount
          </p>
        </CardContent>
      </Card>

      {/* Total Freight Value */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Freight Value</CardTitle>
          <Truck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.totals.freight_value)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Total freight charges
          </p>
        </CardContent>
      </Card>

      {/* Delivery Status Breakdown */}
      <Card className="md:col-span-2 lg:col-span-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Delivery Status Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.delivery_status).map(([status, count]) => {
              if (!count || count === 0) return null
              
              return (
                <Badge 
                  key={status} 
                  className={`${getStatusColor(status)} px-4 py-2 text-sm`}
                  variant="secondary"
                >
                  {DELIVERY_STATUS_LABELS[status] || status}: {count.toLocaleString()}
                </Badge>
              )
            })}
          </div>
          {Object.values(stats.delivery_status).every(v => !v || v === 0) && (
            <p className="text-sm text-muted-foreground">No delivery status data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

