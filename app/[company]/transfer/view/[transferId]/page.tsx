"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Package, Truck, User, Calendar, MapPin, FileText, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Company } from "@/types/auth"
import { getDisplayWarehouseName } from "@/lib/constants/warehouses"

interface TransferViewPageProps {
  params: {
    company: Company
    transferId: string
  }
}

interface TransferDetail {
  id: number
  challan_no: string
  transfer_no: string
  request_no: string
  stock_trf_date: string
  transfer_date: string
  from_site: string
  from_warehouse: string
  to_site: string
  to_warehouse: string
  vehicle_no: string
  vehicle_number: string
  driver_name: string | null
  approved_by: string | null
  remark: string
  reason_code: string
  status: string
  request_id: number
  created_by: string
  created_ts: string
  approved_ts: string | null
  has_variance: boolean
  lines?: Array<{
    id: number
    material_type: string
    item_category: string
    sub_category: string
    item_description: string
    pack_size: string
    unit_pack_size: string
    quantity: string
    uom: string
    net_weight: string
    total_weight: string
    batch_number: string
    lot_number: string
  }>
  boxes?: Array<{
    id: number
    box_number: number
    box_id: string
    article: string
    lot_number: string
    batch_number: string
    transaction_no: string
    net_weight: string
    gross_weight: string
    created_at?: string
    updated_at?: string
  }>
}

export default function TransferViewPage({ params }: TransferViewPageProps) {
  const { company, transferId } = params
  const router = useRouter()
  const { toast } = useToast()
  
  const [transfer, setTransfer] = useState<TransferDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Load transfer details
  useEffect(() => {
    loadTransferDetails()
  }, [transferId])

  const loadTransferDetails = async () => {
    setLoading(true)
    try {
      
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
      const url = `${API_BASE_URL}/interunit/transfers/${transferId}`
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch transfer: ${response.statusText}`)
      }
      
      const data = await response.json()

      console.log("TRANSFER_DEBUG: full API response data:", JSON.stringify(data, null, 2))
      console.log("TRANSFER_DEBUG: boxes array:", data.boxes)
      if (data.boxes) {
        data.boxes.forEach((b: any, i: number) => {
          console.log(`TRANSFER_DEBUG: box[${i}] id=${b.id}, box_id=${b.box_id}, box_number=${b.box_number}, keys=`, Object.keys(b))
        })
      }

      setTransfer(data)
    } catch (error: any) {
      console.error('❌ Failed to load transfer details:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to load transfer details",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Pending</Badge>
      case 'approved':
      case 'accept':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Approved</Badge>
      case 'in transit':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">In Transit</Badge>
      case 'partially transferred':
      case 'partiallytransferred':
      case 'partial':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-300">Partially Transferred</Badge>
      case 'completed':
      case 'dispatch':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Dispatch</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    try {
      // If already in DD-MM-YYYY format, return as is
      if (dateString.match(/^\d{2}-\d{2}-\d{4}$/)) {
        return dateString
      }
      
      // Try to parse and format
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        return dateString
      }
      
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).replace(/\//g, '-')
    } catch (error) {
      return dateString
    }
  }

  // Consolidate lines: group by item description + category + pack_size
  const consolidatedLines = useMemo(() => {
    if (!transfer?.lines) return []
    const lineMap = new Map<string, any>()

    for (const line of transfer.lines) {
      const desc = (line.item_description || '').trim().toUpperCase()
      const cat = (line.item_category || '').trim().toUpperCase()
      const ps = line.pack_size || '0'
      const key = `${desc}__${cat}__${ps}`

      if (lineMap.has(key)) {
        const existing = lineMap.get(key)
        existing.quantity = String((parseFloat(existing.quantity) || 0) + (parseFloat(line.quantity) || 0))
        existing.net_weight = String(((parseFloat(existing.net_weight) || 0) + (parseFloat(line.net_weight) || 0)).toFixed(3))
        existing.total_weight = String(((parseFloat(existing.total_weight) || 0) + (parseFloat(line.total_weight) || 0)).toFixed(3))
        existing._box_count += 1
      } else {
        lineMap.set(key, { ...line, _box_count: 1 })
      }
    }

    return Array.from(lineMap.values())
  }, [transfer?.lines])

  if (loading) {
    return (
      <div className="p-6 bg-gray-100 min-h-screen">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mr-3" />
          <span className="text-lg text-gray-600">Loading transfer details...</span>
        </div>
      </div>
    )
  }

  if (!transfer) {
    return (
      <div className="p-6 bg-gray-100 min-h-screen">
        <Card className="w-full max-w-2xl mx-auto">
          <CardContent className="p-8 text-center">
            <p className="text-lg text-gray-600">Transfer not found</p>
            <Button
              onClick={() => router.push(`/${company}/transfer`)}
              className="mt-4 bg-black hover:bg-gray-800 text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Transfers
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 bg-gray-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/${company}/transfer`)}
            className="h-8 px-3 bg-white border-gray-300 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Transfer Details</h1>
            <p className="text-sm text-muted-foreground">{transfer.challan_no || transfer.transfer_no}</p>
          </div>
        </div>
        <div>
          {getStatusBadge(transfer.status)}
        </div>
      </div>

      {/* Transfer Header Info */}
      <Card className="w-full bg-white border-gray-300">
        <CardHeader className="pb-3 bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-lg font-semibold text-gray-900">Transfer Information</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Transfer Number */}
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-gray-600">
                <FileText className="h-4 w-4" />
                <span className="text-xs font-medium">Transfer Number</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{transfer.challan_no || transfer.transfer_no}</p>
            </div>

            {/* Request Number */}
            {transfer.request_no && (
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-gray-600">
                  <FileText className="h-4 w-4" />
                  <span className="text-xs font-medium">Request Number</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{transfer.request_no}</p>
              </div>
            )}

            {/* Transfer Date */}
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-gray-600">
                <Calendar className="h-4 w-4" />
                <span className="text-xs font-medium">Transfer Date</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{formatDate(transfer.stock_trf_date || transfer.transfer_date)}</p>
            </div>

            {/* From Warehouse */}
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-gray-600">
                <MapPin className="h-4 w-4" />
                <span className="text-xs font-medium">From Warehouse</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{getDisplayWarehouseName(transfer.from_site || transfer.from_warehouse)}</p>
            </div>

            {/* To Warehouse */}
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-gray-600">
                <MapPin className="h-4 w-4" />
                <span className="text-xs font-medium">To Warehouse</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{getDisplayWarehouseName(transfer.to_site || transfer.to_warehouse)}</p>
            </div>

            {/* Vehicle Number */}
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-gray-600">
                <Truck className="h-4 w-4" />
                <span className="text-xs font-medium">Vehicle Number</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{transfer.vehicle_no || transfer.vehicle_number}</p>
            </div>

            {/* Driver Name */}
            {transfer.driver_name && (
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-gray-600">
                  <User className="h-4 w-4" />
                  <span className="text-xs font-medium">Driver Name</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{transfer.driver_name}</p>
              </div>
            )}

            {/* Approval Authority */}
            {transfer.approved_by && (
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-gray-600">
                  <User className="h-4 w-4" />
                  <span className="text-xs font-medium">Approval Authority</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{transfer.approved_by}</p>
              </div>
            )}

            {/* Created By */}
            {transfer.created_by && (
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-gray-600">
                  <User className="h-4 w-4" />
                  <span className="text-xs font-medium">Created By</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{transfer.created_by}</p>
              </div>
            )}

            {/* Reason */}
            {transfer.reason_code && (
              <div className="space-y-1 md:col-span-2 lg:col-span-3">
                <div className="flex items-center space-x-2 text-gray-600">
                  <FileText className="h-4 w-4" />
                  <span className="text-xs font-medium">Reason</span>
                </div>
                <p className="text-sm text-gray-900">{transfer.reason_code}</p>
              </div>
            )}
          </div>

          {/* Summary Stats */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-600 mb-1">Items</p>
                <p className="text-2xl font-bold text-blue-900">{consolidatedLines.length}</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-green-600 mb-1">Boxes Scanned</p>
                <p className="text-2xl font-bold text-green-900">{transfer.boxes?.length || 0}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items List - Consolidated Cards */}
      {consolidatedLines.length > 0 && (
        <Card className="w-full bg-white border-gray-300">
          <CardHeader className="pb-3 bg-gray-50 border-b border-gray-200">
            <CardTitle className="text-lg font-semibold text-gray-900">
              <div className="flex items-center space-x-2">
                <Package className="h-5 w-5" />
                <span>Items Details ({consolidatedLines.length})</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-4">
              {consolidatedLines.map((line, index) => {
                const isFG = line.material_type?.toUpperCase() === 'FG'
                return (
                <Card key={`item-${index}`} className="border border-gray-200 shadow-sm">
                  <CardHeader className="pb-3 bg-blue-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge className="bg-blue-600 text-white">Item #{index + 1}</Badge>
                        <Badge variant="outline" className="text-xs">{line.material_type}</Badge>
                        {line._box_count > 1 && (
                          <Badge variant="outline" className="text-xs bg-amber-50 border-amber-300 text-amber-800">{line._box_count} boxes</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {/* Item Description - Prominent */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Item Description</p>
                      <p className="text-base font-semibold text-gray-900">{line.item_description}</p>
                    </div>

                    {/* Item Details Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {/* Material Type */}
                      <div className="space-y-1">
                        <p className="text-xs text-gray-600">Material Type</p>
                        <p className="text-sm font-medium text-gray-900">{line.material_type}</p>
                      </div>

                      {/* Category */}
                      <div className="space-y-1">
                        <p className="text-xs text-gray-600">Category</p>
                        <p className="text-sm font-medium text-gray-900">{line.item_category}</p>
                      </div>

                      {/* Sub Category */}
                      <div className="space-y-1">
                        <p className="text-xs text-gray-600">Sub Category</p>
                        <p className="text-sm font-medium text-gray-900">{line.sub_category}</p>
                      </div>

                      {/* Quantity */}
                      <div className="space-y-1">
                        <p className="text-xs text-gray-600">Quantity</p>
                        <p className="text-sm font-medium text-gray-900">{line.quantity}</p>
                      </div>

                      {/* UOM */}
                      <div className="space-y-1">
                        <p className="text-xs text-gray-600">UOM</p>
                        <p className="text-sm font-medium text-gray-900">{line.uom}</p>
                      </div>

                      {/* Pack Size */}
                      <div className="space-y-1">
                        <p className="text-xs text-gray-600">Pack Size ({isFG ? 'gm' : 'Kg'})</p>
                        <p className="text-sm font-medium text-gray-900">{line.pack_size}</p>
                      </div>

                      {/* Case Pack */}
                      {line.unit_pack_size && line.unit_pack_size !== '0' && (
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">Unit Pack Size/Count</p>
                          <p className="text-sm font-medium text-gray-900">{line.unit_pack_size}</p>
                        </div>
                      )}

                      {/* Net Weight */}
                      <div className="space-y-1">
                        <p className="text-xs text-gray-600">Net Weight (Kg)</p>
                        <p className="text-sm font-medium text-gray-900">{line.net_weight} kg</p>
                      </div>

                      {/* Total Weight */}
                      <div className="space-y-1">
                        <p className="text-xs text-gray-600">Total Weight (Kg)</p>
                        <p className="text-sm font-medium text-gray-900">{line.total_weight} kg</p>
                      </div>

                      {/* Batch Number */}
                      {line.batch_number && (
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">Batch Number</p>
                          <p className="text-sm font-medium text-gray-900">{line.batch_number}</p>
                        </div>
                      )}

                      {/* Lot Number */}
                      {line.lot_number && (
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">Lot Number</p>
                          <p className="text-sm font-medium text-gray-900">{line.lot_number}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scanned Boxes - Detailed Cards */}
      {transfer.boxes && transfer.boxes.length > 0 && (
        <Card className="w-full bg-white border-gray-300">
          <CardHeader className="pb-3 bg-gray-50 border-b border-gray-200">
            <CardTitle className="text-lg font-semibold text-gray-900">
              <div className="flex items-center space-x-2">
                <Package className="h-5 w-5" />
                <span>Scanned Boxes Details ({transfer.boxes.length})</span>
              </div>
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              All boxes that were scanned and uploaded during transfer submission
            </p>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {transfer.boxes.map((box, index) => (
                <Card key={box.id} className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3 bg-green-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Package className="h-4 w-4 text-green-700" />
                        <span className="text-sm font-semibold text-green-900">Box #{box.box_number}</span>
                      </div>
                      <Badge className="bg-green-600 text-white text-xs">Scanned</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      {/* Article/Item Description */}
                      <div className="p-2 bg-gray-50 rounded border border-gray-200">
                        <p className="text-xs text-gray-600 mb-1">Article / Item</p>
                        <p className="text-sm font-semibold text-gray-900">{box.article}</p>
                      </div>

                      {/* Box Details - 2 columns */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Lot Number */}
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">Lot Number</p>
                          <p className="text-sm font-medium text-gray-900">{box.lot_number || 'N/A'}</p>
                        </div>

                        {/* Box ID */}
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">Box ID</p>
                          <p className="text-sm font-medium text-gray-900">{box.box_id || 'N/A'}</p>
                        </div>

                        {/* Batch Number */}
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">Batch Number</p>
                          <p className="text-sm font-medium text-gray-900">{box.batch_number || 'N/A'}</p>
                        </div>

                        {/* Transaction No */}
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">Transaction No</p>
                          <p className="text-sm font-medium text-gray-900">{box.transaction_no || 'N/A'}</p>
                        </div>
                      </div>

                      {/* Weights */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Net Weight */}
                        <div className="space-y-1 p-2 bg-blue-50 rounded border border-blue-200">
                          <p className="text-xs text-blue-700">Net Weight</p>
                          <p className="text-base font-bold text-blue-900">{box.net_weight} kg</p>
                        </div>

                        {/* Gross Weight */}
                        <div className="space-y-1 p-2 bg-purple-50 rounded border border-purple-200">
                          <p className="text-xs text-purple-700">Gross Weight</p>
                          <p className="text-base font-bold text-purple-900">{box.gross_weight} kg</p>
                        </div>
                      </div>

                      {/* Scanned At */}
                      {box.created_at && (
                        <div className="pt-2 border-t border-gray-200">
                          <p className="text-xs text-gray-500">
                            Scanned: {formatDate(box.created_at)}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Boxes Summary */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Boxes Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-1">Total Boxes</p>
                  <p className="text-2xl font-bold text-gray-900">{transfer.boxes.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-1">Total Net Weight</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {transfer.boxes.reduce((sum: number, box: any) => sum + (parseFloat(box.net_weight) || 0), 0).toFixed(2)} kg
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-1">Total Gross Weight</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {transfer.boxes.reduce((sum: number, box: any) => sum + (parseFloat(box.gross_weight) || 0), 0).toFixed(2)} kg
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-1">Avg Weight/Box</p>
                  <p className="text-2xl font-bold text-green-600">
                    {(transfer.boxes.reduce((sum: number, box: any) => sum + (parseFloat(box.net_weight) || 0), 0) / transfer.boxes.length).toFixed(2)} kg
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Boxes Scanned Message */}
      {(!transfer.boxes || transfer.boxes.length === 0) && (
        <Card className="w-full bg-white border-gray-300">
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-700">No Boxes Scanned</p>
            <p className="text-sm text-gray-500 mt-2">
              No boxes were scanned during this transfer submission
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
