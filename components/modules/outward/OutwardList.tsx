"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Search, Calendar, X, Loader2, AlertCircle, Eye, Edit, Trash2,
  ChevronLeft, ChevronRight, FileSpreadsheet, ThumbsUp
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "@/hooks/use-toast"
import {
  getOutwardList,
  deleteOutward,
  getAllOutwardRecords
} from "@/lib/api/outwardApiService"
import type { OutwardListResponse, OutwardListItem } from "@/types/outward"
import { DELIVERY_STATUS_LABELS } from "@/types/outward"
import { formatCurrency } from "@/lib/utils/outwardUtils"
import Link from "next/link"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import * as XLSX from 'xlsx'

interface OutwardListProps {
  company: string
  onRefresh?: () => void
}

// Helper component for table cells with truncation and tooltip
const TruncatedCell = ({ content, className = "", maxWidth = "200px" }: { 
  content: string | number | null | undefined, 
  className?: string,
  maxWidth?: string 
}) => {
  const displayContent = content ?? "-"
  const stringContent = String(displayContent)
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div 
          className={`truncate cursor-default ${className}`}
          style={{ maxWidth }}
        >
          {displayContent}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs break-words">
        {stringContent}
      </TooltipContent>
    </Tooltip>
  )
}

export default function OutwardList({ company, onRefresh }: OutwardListProps) {
  const [data, setData] = useState<OutwardListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [downloading, setDownloading] = useState(false)
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [approvalFilter, setApprovalFilter] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchData()
    }, 500) // 500ms delay for search

    return () => clearTimeout(timeoutId)
  }, [searchQuery, statusFilter, approvalFilter, fromDate, toDate, currentPage])

  const fetchData = async () => {
    try {
      setIsSearching(true)
      setError(null)
      
      const params: any = {
        page: currentPage,
        per_page: itemsPerPage
      }
      
      if (searchQuery.trim()) params.search = searchQuery.trim()
      if (statusFilter) params.delivery_status = statusFilter
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate
      
      let response = await getOutwardList(company, params)
      
      // Client-side filtering for approval status (not supported by backend API)
      if (approvalFilter) {
        response = {
          ...response,
          records: response.records.filter(record => record.approval_status === approvalFilter),
          total: response.records.filter(record => record.approval_status === approvalFilter).length
        }
      }
      
      setData(response)
    } catch (err) {
      console.error('Error fetching outward list:', err)
      setError(err instanceof Error ? err.message : "Failed to fetch outward records")
    } finally {
      setLoading(false)
      setIsSearching(false)
    }
  }

  const clearFilters = () => {
    setSearchQuery("")
    setStatusFilter("")
    setApprovalFilter("")
    setFromDate("")
    setToDate("")
    setCurrentPage(1)
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  const handleDelete = async (recordId: number) => {
    setDeletingId(recordId)
    try {
      const response = await deleteOutward(company, recordId)
      toast({
        title: "Record Deleted",
        description: `${response.consignment_no} - ${response.message}`
      })
      await fetchData()
      if (onRefresh) onRefresh()
    } catch (err) {
      console.error("Error deleting outward record:", err)
      toast({
        title: "Delete Failed",
        description: err instanceof Error ? err.message : "Failed to delete outward record",
        variant: "destructive"
      })
    } finally {
      setDeletingId(null)
    }
  }

  const handleDownloadAll = async () => {
    try {
      setDownloading(true)
      toast({
        title: "Preparing download...",
        description: "Fetching all outward records for export."
      })

      const params: any = {}
      if (searchQuery.trim()) params.search = searchQuery.trim()
      if (statusFilter) params.delivery_status = statusFilter
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate

      let response = await getAllOutwardRecords(company, params)

      // Client-side filtering for approval status (not supported by backend API)
      if (approvalFilter) {
        response = {
          ...response,
          records: response.records.filter(record => record.approval_status === approvalFilter),
          total: response.records.filter(record => record.approval_status === approvalFilter).length
        }
      }

      if (!response.records || response.records.length === 0) {
        toast({
          title: "No data to export",
          description: "No outward records found matching your criteria.",
          variant: "destructive"
        })
        return
      }

      // Prepare data for Excel export
      const excelData = response.records.map((record) => ({
        'Consignment No': record.consignment_no || '',
        'Approval Status': record.approval_status === 'approved' ? 'Approved' :
                          record.approval_status === 'rejected' ? 'Rejected' : 'Pending',
        'Invoice No': record.invoice_no || '',
        'Customer Name': record.customer_name || '',
        'Location': record.location || '',
        'PO No': record.po_no || '',
        'Boxes': record.boxes || 0,
        'Gross Weight': record.gross_weight || '',
        'Net Weight': record.net_weight || '',
        'Appointment Date': record.appt_date ? format(new Date(record.appt_date), 'MMM dd, yyyy') : '',
        'Appointment Time': record.appt_time || '',
        'Sitecode': record.sitecode || '',
        'ASN ID': record.asn_id || '',
        'Transporter': record.transporter_name || '',
        'Vehicle No': record.vehicle_no || '',
        'LR No': record.lr_no || '',
        'Dispatch Date': record.dispatch_date ? format(new Date(record.dispatch_date), 'MMM dd, yyyy') : '',
        'Estimated Delivery': record.estimated_delivery_date ? format(new Date(record.estimated_delivery_date), 'MMM dd, yyyy') : '',
        'Actual Delivery': record.actual_delivery_date ? format(new Date(record.actual_delivery_date), 'MMM dd, yyyy') : '',
        'Delivery Status': DELIVERY_STATUS_LABELS[record.delivery_status] || record.delivery_status,
        'Invoice Amount': record.invoice_amount || 0,
        'Invoice GST': record.invoice_gst_amount || 0,
        'Total Invoice': record.total_invoice_amount || 0,
        'Freight Amount': record.freight_amount || 0,
        'Freight GST': record.freight_gst_amount || 0,
        'Total Freight': record.total_freight_amount || 0,
        'Billing Address': record.billing_address || '',
        'Shipping Address': record.shipping_address || '',
        'Pincode': record.pincode || '',
        'Business Head': record.business_head === 'Other' ?
                        `${record.business_head_name || ''} (${record.business_head_email || ''})` :
                        record.business_head || ''
      }))

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData)

      // Set column widths
      const columnWidths = [
        { wch: 20 }, // Consignment No
        { wch: 15 }, // Approval Status
        { wch: 18 }, // Invoice No
        { wch: 25 }, // Customer Name
        { wch: 20 }, // Location
        { wch: 15 }, // PO No
        { wch: 10 }, // Boxes
        { wch: 15 }, // Gross Weight
        { wch: 15 }, // Net Weight
        { wch: 15 }, // Appointment Date
        { wch: 15 }, // Appointment Time
        { wch: 15 }, // Sitecode
        { wch: 12 }, // ASN ID
        { wch: 20 }, // Transporter
        { wch: 15 }, // Vehicle No
        { wch: 15 }, // LR No
        { wch: 15 }, // Dispatch Date
        { wch: 18 }, // Estimated Delivery
        { wch: 18 }, // Actual Delivery
        { wch: 18 }, // Delivery Status
        { wch: 15 }, // Invoice Amount
        { wch: 15 }, // Invoice GST
        { wch: 15 }, // Total Invoice
        { wch: 15 }, // Freight Amount
        { wch: 15 }, // Freight GST
        { wch: 15 }, // Total Freight
        { wch: 30 }, // Billing Address
        { wch: 30 }, // Shipping Address
        { wch: 12 }, // Pincode
        { wch: 25 }  // Business Head
      ]
      worksheet['!cols'] = columnWidths

      // Create workbook
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Outward Records')

      // Generate filename with timestamp and filters
      const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss')
      let filename = `Outward_${company}_${timestamp}`
      if (hasFilters) {
        filename += '_filtered'
      }
      filename += '.xlsx'

      // Write and download file
      XLSX.writeFile(workbook, filename)

      toast({
        title: "Download completed",
        description: `Exported ${response.records.length} outward records to ${filename}`
      })
    } catch (err) {
      console.error('Download error:', err)
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Failed to download outward records",
        variant: "destructive"
      })
    } finally {
      setDownloading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const normalizedStatus = status.toLowerCase()
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
      case 'returned':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  if (loading && !data) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="text-muted-foreground mt-4">Loading outward records...</p>
        </CardContent>
      </Card>
    )
  }

  if (error && !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  const totalPages = data?.total_pages || 0
  const hasFilters = searchQuery || statusFilter || approvalFilter || fromDate || toDate

  return (
    <div className="space-y-6">
      {/* Search and Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search & Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Search Input */}
            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium text-muted-foreground">
                Search All Fields
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search records..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Delivery Status
              </label>
              <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Approval Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Approval Status
              </label>
              <Select value={approvalFilter || "all"} onValueChange={(value) => setApprovalFilter(value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All approvals" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Approvals</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* From Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                From Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* To Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                To Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Clear Filters Button */}
            <div className="flex items-end lg:col-span-3">
              <Button 
                variant="outline" 
                onClick={clearFilters}
                disabled={!hasFilters}
                className="w-full"
              >
                <X className="mr-2 h-4 w-4" />
                Clear Filters
              </Button>
            </div>

            {/* Download Button */}
            <div className="flex items-end lg:col-span-3">
              <Button
                variant="outline"
                onClick={handleDownloadAll}
                disabled={downloading}
                className="w-full"
              >
                {downloading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Export All
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Filter Status */}
          {hasFilters && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              {searchQuery && (
                <Badge variant="secondary">Search: "{searchQuery}"</Badge>
              )}
              {statusFilter && (
                <Badge variant="secondary">Status: {DELIVERY_STATUS_LABELS[statusFilter]}</Badge>
              )}
              {approvalFilter && (
                <Badge variant="secondary">
                  Approval: {approvalFilter.charAt(0).toUpperCase() + approvalFilter.slice(1)}
                </Badge>
              )}
              {fromDate && (
                <Badge variant="secondary">From: {format(new Date(fromDate), "MMM dd, yyyy")}</Badge>
              )}
              {toDate && (
                <Badge variant="secondary">To: {format(new Date(toDate), "MMM dd, yyyy")}</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading Overlay for Search */}
      {isSearching && (
        <div className="flex items-center justify-center p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Searching...</span>
          </div>
        </div>
      )}

      {/* Records List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>
              Outward Records {hasFilters ? "(Filtered)" : ""}
            </CardTitle>
            {data && (
              <p className="text-sm text-muted-foreground mt-1">
                {data.total} total records
              </p>
            )}
          </div>
          {data && totalPages > 0 && (
            <Badge variant="outline">
              Page {currentPage} of {totalPages}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {data && data.records.length > 0 ? (
            <div className="space-y-4">
              {/* Table View - Horizontally Scrollable */}
              <div className="border rounded-lg overflow-x-auto">
                <Table className="min-w-max">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-10 bg-background min-w-[150px]">Consignment No</TableHead>
                      <TableHead className="min-w-[130px]">Approval Status</TableHead>
                      <TableHead className="min-w-[150px]">Invoice No</TableHead>
                      <TableHead className="min-w-[180px]">Customer Name</TableHead>
                      <TableHead className="min-w-[150px]">Location</TableHead>
                      <TableHead className="min-w-[120px]">PO No</TableHead>
                      <TableHead className="min-w-[80px]">Boxes</TableHead>
                      <TableHead className="min-w-[120px]">Gross Weight</TableHead>
                      <TableHead className="min-w-[120px]">Net Weight</TableHead>
                      <TableHead className="min-w-[130px]">Appt Date</TableHead>
                      <TableHead className="min-w-[100px]">Appt Time</TableHead>
                      <TableHead className="min-w-[120px]">Sitecode</TableHead>
                      <TableHead className="min-w-[100px]">ASN ID</TableHead>
                      <TableHead className="min-w-[180px]">Transporter</TableHead>
                      <TableHead className="min-w-[130px]">Vehicle No</TableHead>
                      <TableHead className="min-w-[120px]">LR No</TableHead>
                      <TableHead className="min-w-[130px]">Dispatch Date</TableHead>
                      <TableHead className="min-w-[150px]">Est. Delivery</TableHead>
                      <TableHead className="min-w-[150px]">Actual Delivery</TableHead>
                      <TableHead className="min-w-[140px]">Delivery Status</TableHead>
                      <TableHead className="text-right min-w-[130px]">Invoice Amt</TableHead>
                      <TableHead className="text-right min-w-[130px]">Invoice GST</TableHead>
                      <TableHead className="text-right min-w-[150px]">Total Invoice</TableHead>
                      <TableHead className="text-right min-w-[130px]">Freight Amt</TableHead>
                      <TableHead className="text-right min-w-[130px]">Freight GST</TableHead>
                      <TableHead className="text-right min-w-[150px]">Total Freight</TableHead>
                      <TableHead className="min-w-[200px]">Billing Address</TableHead>
                      <TableHead className="min-w-[200px]">Shipping Address</TableHead>
                      <TableHead className="min-w-[100px]">Pincode</TableHead>
                      <TableHead className="min-w-[150px]">Business Head</TableHead>
                      <TableHead className="sticky right-0 z-10 bg-background text-right min-w-[150px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="sticky left-0 z-10 bg-background font-mono text-sm font-medium">
                          <TruncatedCell content={record.consignment_no} maxWidth="150px" />
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={
                              record.approval_status === 'approved' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : record.approval_status === 'rejected'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            }
                          >
                            {record.approval_status === 'approved' ? 'Approved' : 
                             record.approval_status === 'rejected' ? 'Rejected' : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <TruncatedCell content={record.invoice_no} maxWidth="150px" />
                        </TableCell>
                        <TableCell className="font-medium">
                          <TruncatedCell content={record.customer_name} maxWidth="180px" />
                        </TableCell>
                        <TableCell>
                          <TruncatedCell content={record.location} maxWidth="150px" />
                        </TableCell>
                        <TableCell>
                          <TruncatedCell content={record.po_no} maxWidth="120px" />
                        </TableCell>
                        <TableCell className="text-center">{record.boxes}</TableCell>
                        <TableCell>
                          <TruncatedCell content={record.gross_weight} maxWidth="120px" />
                        </TableCell>
                        <TableCell>
                          <TruncatedCell content={record.net_weight} maxWidth="120px" />
                        </TableCell>
                        <TableCell>
                          {record.appt_date ? format(new Date(record.appt_date), "MMM dd, yyyy") : "-"}
                        </TableCell>
                        <TableCell>{record.appt_time || "-"}</TableCell>
                        <TableCell>
                          <TruncatedCell content={record.sitecode} maxWidth="120px" />
                        </TableCell>
                        <TableCell className="text-center">{record.asn_id}</TableCell>
                        <TableCell>
                          <TruncatedCell content={record.transporter_name} maxWidth="180px" />
                        </TableCell>
                        <TableCell>
                          <TruncatedCell content={record.vehicle_no} maxWidth="130px" />
                        </TableCell>
                        <TableCell>{record.lr_no}</TableCell>
                        <TableCell>
                          {record.dispatch_date ? format(new Date(record.dispatch_date), "MMM dd, yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          {record.estimated_delivery_date ? format(new Date(record.estimated_delivery_date), "MMM dd, yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          {record.actual_delivery_date ? format(new Date(record.actual_delivery_date), "MMM dd, yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(record.delivery_status)}>
                            {DELIVERY_STATUS_LABELS[record.delivery_status] || record.delivery_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(record.invoice_amount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(record.invoice_gst_amount)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(record.total_invoice_amount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(record.freight_amount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(record.freight_gst_amount)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(record.total_freight_amount)}</TableCell>
                        <TableCell>
                          <TruncatedCell content={record.billing_address} maxWidth="200px" />
                        </TableCell>
                        <TableCell>
                          <TruncatedCell content={record.shipping_address} maxWidth="200px" />
                        </TableCell>
                        <TableCell>{record.pincode}</TableCell>
                        <TableCell>
                          {record.business_head === "Other" ? (
                            <div className="space-y-1">
                              <TruncatedCell content={record.business_head_name || "-"} maxWidth="150px" />
                              <p className="text-xs text-muted-foreground">{record.business_head_email || "-"}</p>
                            </div>
                          ) : (
                            <TruncatedCell content={record.business_head || "-"} maxWidth="150px" />
                          )}
                        </TableCell>
                        <TableCell className="sticky right-0 z-10 bg-background text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/${company}/outward/${record.id}/approval`}>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="bg-blue-50 hover:bg-blue-100 border-blue-200"
                              >
                                <ThumbsUp className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link href={`/${company}/outward/${record.id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link href={`/${company}/outward/${record.id}/edit`}>
                              <Button variant="outline" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  disabled={deletingId === record.id}
                                >
                                  {deletingId === record.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Outward Record?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete the outward record for 
                                    <strong> {record.consignment_no}</strong>. 
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(record.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to{" "}
                    {Math.min(currentPage * itemsPerPage, data.total)} of {data.total} records
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1 || isSearching}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = Math.max(1, currentPage - 2) + i
                        if (pageNum > totalPages) return null
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={pageNum === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(pageNum)}
                            disabled={isSearching}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalPages || isSearching}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Search className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {hasFilters ? "No records found" : "No outward records"}
              </h3>
              <p className="text-gray-500">
                {hasFilters 
                  ? "Try adjusting your search criteria or filters"
                  : "Get started by creating your first outward record"
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

