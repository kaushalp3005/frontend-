"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Package, Truck, User, Calendar, MapPin, FileText, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Company } from "@/types/auth"

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
  remark: string
  reason_code: string
  status: string
  request_id: number
  created_by: string
  created_ts: string
  approved_by: string | null
  approved_ts: string | null
  has_variance: boolean
  items_count: number
  boxes_count: number
  pending_items: number
  lines?: Array<{
    id: number
    rm_pm_fg_type: string
    item_category: string
    sub_category: string
    item_desc_raw: string
    item_id?: number
    hsn_code?: string
    pack_size: number
    packaging_type: number
    qty: number
    uom: string
    net_weight: number
    total_weight: number
    batch_number: string
    lot_number: string
  }>
  boxes?: Array<{
    id: number
    box_number: number
    article: string
    lot_number: string
    net_weight: number
    gross_weight: number
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
      console.log('📋 Loading transfer details for ID:', transferId)
      
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
      const url = `${API_BASE_URL}/interunit/transfers/${transferId}`
      console.log('🔗 API URL:', url)
      
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
      console.log('✅ Transfer details loaded:', data)
      
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
      case 'completed':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300">Completed</Badge>
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
              <p className="text-sm font-semibold text-gray-900">{transfer.from_site || transfer.from_warehouse}</p>
            </div>

            {/* To Warehouse */}
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-gray-600">
                <MapPin className="h-4 w-4" />
                <span className="text-xs font-medium">To Warehouse</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{transfer.to_site || transfer.to_warehouse}</p>
            </div>

            {/* Vehicle Number */}
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-gray-600">
                <Truck className="h-4 w-4" />
                <span className="text-xs font-medium">Vehicle Number</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{transfer.vehicle_no || transfer.vehicle_number}</p>
            </div>

            {/* Driver Name - Extract from remark */}
            {transfer.remark && transfer.remark.includes('Driver:') && (
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-gray-600">
                  <User className="h-4 w-4" />
                  <span className="text-xs font-medium">Driver Name</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {transfer.remark.split('|')[0].replace('Driver:', '').trim()}
                </p>
              </div>
            )}

            {/* Approval Authority - Extract from remark */}
            {transfer.remark && transfer.remark.includes('Approval:') && (
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-gray-600">
                  <User className="h-4 w-4" />
                  <span className="text-xs font-medium">Approval Authority</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {transfer.remark.split('|')[1]?.replace('Approval:', '').trim() || transfer.remark}
                </p>
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
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-600 mb-1">Items</p>
                <p className="text-2xl font-bold text-blue-900">{transfer.items_count || 0}</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-green-600 mb-1">Boxes</p>
                <p className="text-2xl font-bold text-green-900">{transfer.boxes_count || 0}</p>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-xs text-orange-600 mb-1">Pending</p>
                <p className="text-2xl font-bold text-orange-900">{transfer.pending_items || 0}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items List - Detailed Cards */}
      {transfer.lines && transfer.lines.length > 0 && (
        <Card className="w-full bg-white border-gray-300">
          <CardHeader className="pb-3 bg-gray-50 border-b border-gray-200">
            <CardTitle className="text-lg font-semibold text-gray-900">
              <div className="flex items-center space-x-2">
                <Package className="h-5 w-5" />
                <span>Items Details ({transfer.lines.length})</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-4">
              {transfer.lines.map((line, index) => (
                <Card key={line.id} className="border border-gray-200 shadow-sm">
                  <CardHeader className="pb-3 bg-blue-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge className="bg-blue-600 text-white">Item #{index + 1}</Badge>
                        <Badge variant="outline" className="text-xs">{line.rm_pm_fg_type}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {/* Item Description - Prominent */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Item Description</p>
                      <p className="text-base font-semibold text-gray-900">{line.item_desc_raw}</p>
                    </div>

                    {/* Item Details Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
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
                        <p className="text-sm font-medium text-gray-900">{line.qty} {line.uom}</p>
                      </div>

                      {/* Pack Size */}
                      <div className="space-y-1">
                        <p className="text-xs text-gray-600">Pack Size</p>
                        <p className="text-sm font-medium text-gray-900">{line.pack_size}</p>
                      </div>

                      {/* Packaging Type */}
                      {line.packaging_type && (
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">Packaging Type</p>
                          <p className="text-sm font-medium text-gray-900">{line.packaging_type}</p>
                        </div>
                      )}

                      {/* Net Weight */}
                      <div className="space-y-1">
                        <p className="text-xs text-gray-600">Net Weight</p>
                        <p className="text-sm font-medium text-gray-900">{line.net_weight} kg</p>
                      </div>

                      {/* Total Weight */}
                      <div className="space-y-1">
                        <p className="text-xs text-gray-600">Total Weight</p>
                        <p className="text-sm font-medium text-gray-900">{line.total_weight} kg</p>
                      </div>

                      {/* HSN Code */}
                      {line.hsn_code && (
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">HSN Code</p>
                          <p className="text-sm font-medium text-gray-900">{line.hsn_code}</p>
                        </div>
                      )}

                      {/* Batch Number */}
                      <div className="space-y-1">
                        <p className="text-xs text-gray-600">Batch Number</p>
                        <p className="text-sm font-medium text-gray-900">{line.batch_number || 'N/A'}</p>
                      </div>

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
              ))}
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

                      {/* Box Details */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Lot Number */}
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">Lot Number</p>
                          <p className="text-sm font-medium text-gray-900">{box.lot_number || 'N/A'}</p>
                        </div>

                        {/* Box ID */}
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">Box ID</p>
                          <p className="text-sm font-medium text-gray-900">#{box.id}</p>
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
                    {transfer.boxes.reduce((sum, box) => sum + (box.net_weight || 0), 0).toFixed(2)} kg
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-1">Total Gross Weight</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {transfer.boxes.reduce((sum, box) => sum + (box.gross_weight || 0), 0).toFixed(2)} kg
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-1">Avg Weight/Box</p>
                  <p className="text-2xl font-bold text-green-600">
                    {(transfer.boxes.reduce((sum, box) => sum + (box.net_weight || 0), 0) / transfer.boxes.length).toFixed(2)} kg
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
