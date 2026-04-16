"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Package, Calendar, MapPin, FileText, Loader2, User, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { InterunitApiService, type RequestResponse } from "@/lib/interunitApiService"
import type { Company } from "@/types/auth"

interface RequestViewPageProps {
  params: {
    company: Company
    requestId: string
  }
}

export default function RequestViewPage({ params }: RequestViewPageProps) {
  const { company, requestId } = params
  const router = useRouter()
  const { toast } = useToast()

  const [request, setRequest] = useState<RequestResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRequestDetails()
  }, [requestId])

  const loadRequestDetails = async () => {
    setLoading(true)
    try {
      const data = await InterunitApiService.getRequest(Number(requestId))
      setRequest(data)
    } catch (error: any) {
      console.error("Failed to load request details:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load request details",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Pending</Badge>
      case "approved":
      case "accept":
        return <Badge className="bg-green-100 text-green-800 border-green-300">Approved</Badge>
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 border-red-300">Rejected</Badge>
      case "cancelled":
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300">Cancelled</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    try {
      if (dateString.match(/^\d{2}-\d{2}-\d{4}$/)) return dateString
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return dateString
      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).replace(/\//g, "-")
    } catch {
      return dateString
    }
  }

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "N/A"
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return dateString
      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).replace(/\//g, "-")
    } catch {
      return dateString
    }
  }

  if (loading) {
    return (
      <div className="p-6 bg-gray-100 min-h-screen">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mr-3" />
          <span className="text-lg text-gray-600">Loading request details...</span>
        </div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="p-6 bg-gray-100 min-h-screen">
        <Card className="w-full max-w-2xl mx-auto">
          <CardContent className="p-8 text-center">
            <p className="text-lg text-gray-600">Request not found</p>
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
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Request Details</h1>
            <p className="text-sm text-muted-foreground">{request.request_no}</p>
          </div>
        </div>
        <div>{getStatusBadge(request.status)}</div>
      </div>

      {/* Request Information Card */}
      <Card className="w-full bg-white border-gray-300">
        <CardHeader className="pb-3 bg-gray-50 border-b border-gray-200">
          <CardTitle className="text-lg font-semibold text-gray-900">Request Information</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Request Number */}
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-gray-600">
                <FileText className="h-4 w-4" />
                <span className="text-xs font-medium">Request Number</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{request.request_no}</p>
            </div>

            {/* Request Date */}
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-gray-600">
                <Calendar className="h-4 w-4" />
                <span className="text-xs font-medium">Request Date</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{formatDate(request.request_date)}</p>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-gray-600">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-medium">Status</span>
              </div>
              <div>{getStatusBadge(request.status)}</div>
            </div>

            {/* From Warehouse */}
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-gray-600">
                <MapPin className="h-4 w-4" />
                <span className="text-xs font-medium">From Warehouse</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{request.from_warehouse}</p>
            </div>

            {/* To Warehouse */}
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-gray-600">
                <MapPin className="h-4 w-4" />
                <span className="text-xs font-medium">To Warehouse</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{request.to_warehouse}</p>
            </div>

            {/* Created By */}
            {request.created_by && (
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-gray-600">
                  <User className="h-4 w-4" />
                  <span className="text-xs font-medium">Created By</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{request.created_by}</p>
              </div>
            )}

            {/* Created At */}
            {request.created_ts && (
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-medium">Created At</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{formatDateTime(request.created_ts)}</p>
              </div>
            )}

            {/* Reason Description */}
            {request.reason_description && (
              <div className="space-y-1 md:col-span-2 lg:col-span-3">
                <div className="flex items-center space-x-2 text-gray-600">
                  <FileText className="h-4 w-4" />
                  <span className="text-xs font-medium">Reason Description</span>
                </div>
                <p className="text-sm text-gray-900">{request.reason_description}</p>
              </div>
            )}

            {/* Reject Reason */}
            {request.reject_reason && (
              <div className="space-y-1 md:col-span-2 lg:col-span-3">
                <div className="flex items-center space-x-2 text-red-600">
                  <FileText className="h-4 w-4" />
                  <span className="text-xs font-medium">Reject Reason</span>
                </div>
                <p className="text-sm text-red-700 bg-red-50 p-2 rounded border border-red-200">{request.reject_reason}</p>
              </div>
            )}
          </div>

          {/* Summary Stats */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-600 mb-1">Total Items</p>
                <p className="text-2xl font-bold text-blue-900">{request.lines?.length || 0}</p>
              </div>
              <div className="text-center p-3 bg-violet-50 rounded-lg border border-violet-200">
                <p className="text-xs text-violet-600 mb-1">Total Net Weight</p>
                <p className="text-2xl font-bold text-violet-900">
                  {request.lines?.reduce((sum, line) => sum + (parseFloat(line.net_weight) || 0), 0).toFixed(2) || "0.00"} kg
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      {request.lines && request.lines.length > 0 && (
        <Card className="w-full bg-white border-gray-300">
          <CardHeader className="pb-3 bg-gray-50 border-b border-gray-200">
            <CardTitle className="text-lg font-semibold text-gray-900">
              <div className="flex items-center space-x-2">
                <Package className="h-5 w-5" />
                <span>Items Details ({request.lines.length})</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-4">
              {request.lines.map((line, index) => {
                const isFG = line.material_type?.toUpperCase() === "FG"
                return (
                  <Card key={line.id} className="border border-gray-200 shadow-sm">
                    <CardHeader className="pb-3 bg-blue-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge className="bg-blue-600 text-white">Item #{index + 1}</Badge>
                          <Badge variant="outline" className="text-xs">{line.material_type}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {/* Item Description */}
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-600 mb-1">Item Description</p>
                        <p className="text-base font-semibold text-gray-900">{line.item_description}</p>
                      </div>

                      {/* Item Details Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">Material Type</p>
                          <p className="text-sm font-medium text-gray-900">{line.material_type}</p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">Category</p>
                          <p className="text-sm font-medium text-gray-900">{line.item_category}</p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">Sub Category</p>
                          <p className="text-sm font-medium text-gray-900">{line.sub_category}</p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">Quantity</p>
                          <p className="text-sm font-medium text-gray-900">{line.quantity}</p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">UOM</p>
                          <p className="text-sm font-medium text-gray-900">{line.uom}</p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">Case Pack/Box wt(kg)</p>
                          <p className="text-sm font-medium text-gray-900">{line.pack_size}</p>
                        </div>

                        {line.unit_pack_size && line.unit_pack_size !== "0" && (
                          <div className="space-y-1">
                            <p className="text-xs text-gray-600">Unit Pack Size/Count</p>
                            <p className="text-sm font-medium text-gray-900">{line.unit_pack_size}</p>
                          </div>
                        )}

                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">Net Weight (Kg)</p>
                          <p className="text-sm font-medium text-gray-900">{line.net_weight} kg</p>
                        </div>

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

      {/* No Items Message */}
      {(!request.lines || request.lines.length === 0) && (
        <Card className="w-full bg-white border-gray-300">
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-700">No Items</p>
            <p className="text-sm text-gray-500 mt-2">
              No items were added to this request
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
