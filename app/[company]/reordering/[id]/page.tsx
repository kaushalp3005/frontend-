"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { 
  ArrowLeft, 
  Package, 
  Calendar, 
  User, 
  FileText, 
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Printer,
  Loader2,
  AlertCircle
} from "lucide-react"
import { rtvApi } from "@/lib/api/rtvApiService"
import { RTVRecord } from "@/types/rtv"
import { useToast } from "@/hooks/use-toast"
import type { Company } from "@/types/auth"

interface ViewRTVPageProps {
  params: {
    company: Company
    id: string
  }
}

export default function ViewRTVPage({ params }: ViewRTVPageProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [rtvRecord, setRtvRecord] = useState<RTVRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadRTVDetails = async () => {
      setLoading(true)
      setError(null)
      
      try {
        console.log('🔄 Loading RTV details:', params.id, 'for company:', params.company)
        const record = await rtvApi.getRTVById(params.company, params.id)
        console.log('✅ RTV details loaded:', record)
        setRtvRecord(record)
      } catch (err) {
        console.error('❌ Error loading RTV details:', err)
        setError('Failed to load RTV details')
        toast({
          title: "Error Loading RTV",
          description: "Failed to load RTV details from server",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadRTVDetails()
  }, [params.id, params.company, toast])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        <p className="text-muted-foreground">Loading RTV details...</p>
      </div>
    )
  }

  if (error || !rtvRecord) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <AlertCircle className="h-16 w-16 text-red-500" />
        <h2 className="text-2xl font-bold">RTV Record Not Found</h2>
        <p className="text-muted-foreground">{error || 'The requested RTV record could not be found'}</p>
        <Button onClick={() => router.push(`/${params.company}/reordering`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
      </div>
    )
  }

  const getStatusBadge = (status: RTVRecord["status"]) => {
    const variants: Record<RTVRecord["status"], { variant: "default" | "secondary" | "destructive" | "outline", icon: any, color: string }> = {
      pending: { variant: "secondary", icon: Clock, color: "text-yellow-600" },
      approved: { variant: "default", icon: CheckCircle, color: "text-green-600" },
      completed: { variant: "default", icon: CheckCircle, color: "text-blue-600" },
      rejected: { variant: "destructive", icon: XCircle, color: "text-red-600" },
      cancelled: { variant: "outline", icon: XCircle, color: "text-gray-600" },
    }
    
    const { variant, icon: Icon, color } = variants[status]
    
    return (
      <Badge variant={variant} className="flex items-center gap-1 text-base px-3 py-1">
        <Icon className="h-4 w-4" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const getRTVTypeLabel = (type: RTVRecord["rtv_type"]) => {
    const labels: Record<RTVRecord["rtv_type"], string> = {
      quality_issue: "Quality Issue",
      damaged: "Damaged",
      expired: "Expired",
      excess_quantity: "Excess Quantity",
      wrong_item: "Wrong Item",
      other: "Other",
    }
    return labels[type]
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6 max-w-[1920px] mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/${params.company}/reordering`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">RTV Details</h1>
            <p className="text-muted-foreground mt-1">{rtvRecord.rtv_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(rtvRecord.status)}
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* RTV Information */}
          <Card>
            <CardHeader>
              <CardTitle>RTV Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">RTV Number</label>
                  <p className="text-lg font-semibold">{rtvRecord.rtv_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">{getStatusBadge(rtvRecord.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Customer</label>
                  <p className="text-lg font-semibold">{rtvRecord.customer_name}</p>
                  <p className="text-sm text-muted-foreground">{rtvRecord.customer_code}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">RTV Type</label>
                  <p className="text-lg">{getRTVTypeLabel(rtvRecord.rtv_type)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">RTV Date</label>
                  <p className="text-lg">{new Date(rtvRecord.rtv_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Total Value</label>
                  <p className="text-lg font-bold text-green-600">₹{rtvRecord.total_value.toLocaleString()}</p>
                </div>
              </div>

              {rtvRecord.invoice_number && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Invoice Number</label>
                  <p className="text-lg">{rtvRecord.invoice_number}</p>
                </div>
              )}

              {rtvRecord.dc_number && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">DC Number</label>
                  <p className="text-lg">{rtvRecord.dc_number}</p>
                </div>
              )}

              {rtvRecord.notes && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Notes</label>
                  <p className="text-base bg-gray-50 p-3 rounded-md">{rtvRecord.notes}</p>
                </div>
              )}

              {rtvRecord.other_reason && rtvRecord.rtv_type === "other" && (
                <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                  <label className="text-sm font-medium text-blue-800">Other Reason</label>
                  <p className="text-base text-blue-700 mt-1">{rtvRecord.other_reason}</p>
                </div>
              )}

              {rtvRecord.rejection_reason && (
                <div className="bg-red-50 p-4 rounded-md border border-red-200">
                  <label className="text-sm font-medium text-red-800">Rejection Reason</label>
                  <p className="text-base text-red-700 mt-1">{rtvRecord.rejection_reason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Items ({rtvRecord.items?.length || 0})</CardTitle>
                <Badge variant="outline">{rtvRecord.items?.length || 0} boxes</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {!rtvRecord.items || rtvRecord.items.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No items found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rtvRecord.items.map((item, index) => (
                    <div key={item.item_id || index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">Box #{item.box_number}</Badge>
                            <Badge variant="secondary">{item.transaction_no}</Badge>
                          </div>
                          <h3 className="text-lg font-semibold">{item.item_description}</h3>
                          {item.sub_category && (
                            <p className="text-sm text-muted-foreground mt-1">{item.sub_category}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Price</p>
                          <p className="text-lg font-bold text-green-600">
                            ₹{item.price.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Net Weight</p>
                          <p className="font-medium">{item.net_weight} kg</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Gross Weight</p>
                          <p className="font-medium">{item.gross_weight} kg</p>
                        </div>
                        {item.reason && (
                          <div className="col-span-2 md:col-span-1">
                            <p className="text-muted-foreground">Reason</p>
                            <p className="font-medium">{item.reason || "N/A"}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Created</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(rtvRecord.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-muted-foreground">By {rtvRecord.created_by}</p>
                </div>
              </div>

              {rtvRecord.approved_by && rtvRecord.approved_date && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Approved</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(rtvRecord.approved_date).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-muted-foreground">By {rtvRecord.approved_by}</p>
                    </div>
                  </div>
                </>
              )}

              {rtvRecord.updated_at && rtvRecord.updated_at !== rtvRecord.created_at && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-4 w-4 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Last Updated</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(rtvRecord.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-muted-foreground">Total Items</span>
                <span className="font-bold text-lg">{rtvRecord.items?.length || 0}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-muted-foreground">Total Boxes</span>
                <span className="font-bold text-lg">{rtvRecord.total_boxes || 0}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-muted-foreground">Total Value</span>
                <span className="font-bold text-lg text-green-600">
                  ₹{rtvRecord.total_value.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          {rtvRecord.status === "pending" && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve RTV
                </Button>
                <Button variant="destructive" className="w-full">
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject RTV
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
