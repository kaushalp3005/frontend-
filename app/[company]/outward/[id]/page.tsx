"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { 
  ArrowLeft, 
  Edit, 
  Loader2, 
  AlertCircle,
  Package,
  Box as BoxIcon,
  FileText,
  Truck,
  Calendar,
  DollarSign,
  MapPin,
  CheckCircle,
  Printer
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { getOutwardDetail } from "@/lib/api/outwardApiService"
import type { OutwardDetailResponse, OutwardArticleDetail, OutwardBoxDetail } from "@/types/outward"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import Link from "next/link"
import { format } from "date-fns"

interface OutwardViewPageProps {
  params: {
    company: string
    id: string
  }
}

// Truncated cell component with tooltip
const TruncatedCell = ({ content, maxWidth = "200px", className = "" }: { content: string | number, maxWidth?: string, className?: string }) => {
  const textContent = String(content)
  
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div 
            className={`truncate text-center mx-auto ${className}`}
            style={{ maxWidth }}
          >
            {textContent}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-md break-words">
          <p>{textContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default function OutwardViewPage({ params }: OutwardViewPageProps) {
  const router = useRouter()
  const company = params.company
  const recordId = params.id

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [outwardRecord, setOutwardRecord] = useState<OutwardDetailResponse | null>(null)

  // Fetch outward record
  useEffect(() => {
    const fetchRecord = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await getOutwardDetail(company, recordId)
        setOutwardRecord(data)
      } catch (error) {
        console.error("Error fetching outward record:", error)
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch outward record"
        setError(errorMessage)
        toast({
          title: "Error Loading Record",
          description: errorMessage,
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchRecord()
  }, [company, recordId])

  const getStatusColor = (status: string) => {
    const normalizedStatus = status?.toLowerCase()
    switch (normalizedStatus) {
      case 'delivered':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'in_transit':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'out_for_delivery':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'delayed':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6 max-w-[1920px] mx-auto">
        <Card>
          <CardContent className="text-center py-12">
            <Loader2 className="mx-auto h-8 w-8 animate-spin" />
            <p className="text-muted-foreground mt-4">Loading outward record...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !outwardRecord) {
    return (
      <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6 max-w-[1920px] mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/${company}/outward`}>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to List
            </Button>
          </Link>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold">Failed to load outward record</p>
            <p className="mt-2">{error || "Record not found"}</p>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6 max-w-[1920px] mx-auto space-y-4 sm:space-y-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/${company}/outward`}>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to List
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Outward Details - {company.toUpperCase()}
            </h1>
            <p className="text-muted-foreground mt-1">
              View complete outward consignment information
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          {outwardRecord?.box_details && outwardRecord.box_details.length > 0 && (
            <Link href={`/${company}/outward/${recordId}/qr-print`}>
              <Button variant="outline" className="gap-2">
                <Printer className="h-4 w-4" />
                Print Labels
              </Button>
            </Link>
          )}
          <Link href={`/${company}/outward/${recordId}/edit`}>
            <Button className="gap-2">
              <Edit className="h-4 w-4" />
              Edit Record
            </Button>
          </Link>
        </div>
      </div>

      {/* Basic Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <Label className="text-sm text-muted-foreground">Consignment No</Label>
              <p className="font-mono font-semibold text-lg">{outwardRecord.consignment_no}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Invoice No</Label>
              <p className="font-medium">{outwardRecord.invoice_no}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Customer Name</Label>
              <p className="font-medium">{outwardRecord.customer_name}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">PO Number</Label>
              <p className="font-medium">{outwardRecord.po_no || "-"}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Location</Label>
              <p className="font-medium">{outwardRecord.location || "-"}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Sitecode</Label>
              <p className="font-medium">{outwardRecord.sitecode || "-"}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Delivery Status</Label>
              <Badge className={getStatusColor(outwardRecord.delivery_status)}>
                {outwardRecord.delivery_status}
              </Badge>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">ASN ID</Label>
              <p className="font-medium">{outwardRecord.asn_id || "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weight & Box Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BoxIcon className="h-5 w-5" />
            Weight & Box Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <Label className="text-sm text-muted-foreground">Total Boxes</Label>
              <p className="font-semibold text-xl">{outwardRecord.boxes}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Net Weight (gm)</Label>
              <p className="font-semibold text-xl">{outwardRecord.net_weight}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Gross Weight (gm)</Label>
              <p className="font-semibold text-xl">{outwardRecord.gross_weight}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transport Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Transport Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <Label className="text-sm text-muted-foreground">Transporter Name</Label>
              <p className="font-medium">{outwardRecord.transporter_name || "-"}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Vehicle Number</Label>
              <p className="font-medium font-mono">{outwardRecord.vehicle_no || "-"}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">LR Number</Label>
              <p className="font-medium">{outwardRecord.lr_no || "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dates Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Important Dates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <Label className="text-sm text-muted-foreground">Dispatch Date</Label>
              <p className="font-medium">
                {outwardRecord.dispatch_date ? format(new Date(outwardRecord.dispatch_date), "MMM dd, yyyy") : "-"}
              </p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Estimated Delivery</Label>
              <p className="font-medium">
                {outwardRecord.estimated_delivery_date ? format(new Date(outwardRecord.estimated_delivery_date), "MMM dd, yyyy") : "-"}
              </p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Actual Delivery</Label>
              <p className="font-medium">
                {outwardRecord.actual_delivery_date ? format(new Date(outwardRecord.actual_delivery_date), "MMM dd, yyyy") : "-"}
              </p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Appointment Date & Time</Label>
              <p className="font-medium">
                {outwardRecord.appt_date ? format(new Date(outwardRecord.appt_date), "MMM dd, yyyy") : "-"}
                {outwardRecord.appt_time && ` at ${outwardRecord.appt_time}`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Financial Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Invoice Section */}
            <div>
              <h3 className="font-semibold text-sm mb-3 text-muted-foreground">Invoice Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label className="text-sm text-muted-foreground">Invoice Amount</Label>
                  <p className="font-medium text-lg">₹{outwardRecord.invoice_amount?.toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Invoice GST</Label>
                  <p className="font-medium text-lg">₹{outwardRecord.invoice_gst_amount?.toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Total Invoice</Label>
                  <p className="font-semibold text-xl text-green-600">₹{outwardRecord.total_invoice_amount?.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Freight Section */}
            <div>
              <h3 className="font-semibold text-sm mb-3 text-muted-foreground">Freight Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label className="text-sm text-muted-foreground">Freight Amount</Label>
                  <p className="font-medium text-lg">₹{outwardRecord.freight_amount?.toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Freight GST</Label>
                  <p className="font-medium text-lg">₹{outwardRecord.freight_gst_amount?.toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Total Freight</Label>
                  <p className="font-semibold text-xl text-blue-600">₹{outwardRecord.total_freight_amount?.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Address Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-sm text-muted-foreground">Billing Address</Label>
              <p className="font-medium">{outwardRecord.billing_address || "-"}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Shipping Address</Label>
              <p className="font-medium">{outwardRecord.shipping_address || "-"}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Pincode</Label>
              <p className="font-medium">{outwardRecord.pincode || "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Head Information */}
      <Card>
        <CardHeader>
          <CardTitle>Business Head Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label className="text-sm text-muted-foreground">Business Head</Label>
              <p className="font-medium">{outwardRecord.business_head || "-"}</p>
            </div>
            {outwardRecord.business_head === "Other" && (
              <>
                <div>
                  <Label className="text-sm text-muted-foreground">Name</Label>
                  <p className="font-medium">{outwardRecord.business_head_name || "-"}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Email</Label>
                  <p className="font-medium">{outwardRecord.business_head_email || "-"}</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Articles Information */}
      {outwardRecord.articles && outwardRecord.articles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Articles ({outwardRecord.articles.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[100px] text-center">Material Type</TableHead>
                    <TableHead className="min-w-[150px] text-center">Item Category</TableHead>
                    <TableHead className="min-w-[150px] text-center">Sub Category</TableHead>
                    <TableHead className="min-w-[200px] text-center">Item Description</TableHead>
                    <TableHead className="min-w-[100px] text-center">Quantity</TableHead>
                    <TableHead className="min-w-[80px] text-center">UOM</TableHead>
                    <TableHead className="min-w-[120px] text-center">Pack Size (gm)</TableHead>
                    <TableHead className="min-w-[120px] text-center">No. of Packets</TableHead>
                    <TableHead className="min-w-[130px] text-center">Net Weight (gm)</TableHead>
                    <TableHead className="min-w-[130px] text-center">Gross Weight (gm)</TableHead>
                    <TableHead className="min-w-[150px] text-center">Batch Number</TableHead>
                    <TableHead className="min-w-[100px] text-center">Unit Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outwardRecord.articles.map((article) => (
                    <TableRow key={article.id}>
                      <TableCell className="text-center">
                        <Badge variant="outline">{article.material_type}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <TruncatedCell content={article.item_category} maxWidth="150px" />
                      </TableCell>
                      <TableCell className="text-center">
                        <TruncatedCell content={article.sub_category} maxWidth="150px" />
                      </TableCell>
                      <TableCell className="text-center">
                        <TruncatedCell content={article.item_description} maxWidth="200px" className="font-medium" />
                      </TableCell>
                      <TableCell className="text-center">{article.quantity_units}</TableCell>
                      <TableCell className="text-center">{article.uom}</TableCell>
                      <TableCell className="text-center">{article.pack_size_gm?.toFixed(2)}</TableCell>
                      <TableCell className="text-center">{article.no_of_packets}</TableCell>
                      <TableCell className="text-center font-medium">
                        <span title={`${article.net_weight_gm?.toFixed(2)} gm`}>
                          {article.net_weight_gm?.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        <span title={`${article.gross_weight_gm?.toFixed(2)} gm`}>
                          {article.gross_weight_gm?.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <TruncatedCell content={article.batch_number} maxWidth="150px" className="font-mono text-sm" />
                      </TableCell>
                      <TableCell className="text-center">₹{article.unit_rate?.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Box Details Information */}
      {outwardRecord.box_details && outwardRecord.box_details.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BoxIcon className="h-5 w-5" />
              Box Details ({outwardRecord.box_details.length} boxes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[100px] text-center">Box Number</TableHead>
                    <TableHead className="min-w-[200px] text-center">Article Name</TableHead>
                    <TableHead className="min-w-[120px] text-center">Lot Number</TableHead>
                    <TableHead className="min-w-[130px] text-center">Net Weight (gm)</TableHead>
                    <TableHead className="min-w-[130px] text-center">Gross Weight (gm)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outwardRecord.box_details.map((box) => (
                    <TableRow key={box.id}>
                      <TableCell className="text-center">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                          <span className="font-semibold">{box.box_number}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <TruncatedCell content={box.article_name} maxWidth="200px" className="font-medium" />
                      </TableCell>
                      <TableCell className="text-center">
                        <TruncatedCell content={box.lot_number || "-"} maxWidth="120px" className="font-mono text-sm" />
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        <span title={`${box.net_weight_gm?.toFixed(2)} gm`}>
                          {box.net_weight_gm?.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        <span title={`${box.gross_weight_gm?.toFixed(2)} gm`}>
                          {box.gross_weight_gm?.toFixed(2)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approval Information */}
      {outwardRecord.approval && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Approval Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <Label className="text-sm text-muted-foreground">Approval Status</Label>
                <Badge 
                  className={
                    outwardRecord.approval.approval_status === 'APPROVED' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : outwardRecord.approval.approval_status === 'REJECTED'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  }
                >
                  {outwardRecord.approval.approval_status}
                </Badge>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Approval Authority</Label>
                <p className="font-medium">{outwardRecord.approval.approval_authority}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Approval Date</Label>
                <p className="font-medium">
                  {outwardRecord.approval.approval_date ? format(new Date(outwardRecord.approval.approval_date), "MMM dd, yyyy") : "-"}
                </p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Remarks</Label>
                <p className="font-medium">{outwardRecord.approval.remarks || "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Files Information */}
      {(outwardRecord.invoice_files || outwardRecord.pod_files) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Attached Files
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {outwardRecord.invoice_files && outwardRecord.invoice_files.length > 0 && (
              <div>
                <Label className="text-sm text-muted-foreground">Invoice Files</Label>
                <ul className="mt-2 space-y-2">
                  {outwardRecord.invoice_files.map((file, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="font-mono">{file}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {outwardRecord.pod_files && outwardRecord.pod_files.length > 0 && (
              <div>
                <Label className="text-sm text-muted-foreground">POD Files</Label>
                <ul className="mt-2 space-y-2">
                  {outwardRecord.pod_files.map((file, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-green-500" />
                      <span className="font-mono">{file}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 pb-6">
        <Link href={`/${company}/outward`}>
          <Button variant="outline">
            Back to List
          </Button>
        </Link>
        {outwardRecord?.box_details && outwardRecord.box_details.length > 0 && (
          <Link href={`/${company}/outward/${recordId}/qr-print`}>
            <Button variant="outline" className="gap-2">
              <Printer className="h-4 w-4" />
              Print Labels
            </Button>
          </Link>
        )}
        <Link href={`/${company}/outward/${recordId}/edit`}>
          <Button className="gap-2">
            <Edit className="h-4 w-4" />
            Edit Record
          </Button>
        </Link>
      </div>
    </div>
  )
}

