// File: page.tsx
// Path: frontend/src/app/[company]/inward/page.tsx

"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Edit, Loader2, AlertCircle, Search, Calendar, X, Trash2, FileSpreadsheet, ArrowUpDown } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import { getInwardList, getAllInwardRecords, getInwardDetail, deleteInward, type Company, type InwardListResponse } from "@/types/inward"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { downloadInwardRecordsAsExcel, type InwardExcelData } from "@/lib/utils/excel"
import { toast } from "@/hooks/use-toast"

interface InwardListPageProps {
  params: {
    company: Company
  }
}

export default function InwardListPage({ params }: InwardListPageProps) {
  const { company } = params
  
  // State management
  const [data, setData] = useState<InwardListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [sortBy, setSortBy] = useState<'entry_date' | 'transaction_no' | 'invoice_number' | 'po_number'>('entry_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [isSearching, setIsSearching] = useState(false)
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery !== "" || fromDate !== "" || toDate !== "") {
        handleSearch()
      } else {
        fetchData()
      }
    }, 500) // 500ms delay for search

    return () => clearTimeout(timeoutId)
  }, [searchQuery, fromDate, toDate, currentPage, sortBy, sortOrder])

  // Initial data fetch
  useEffect(() => {
    fetchData()
  }, [company, currentPage])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await getInwardList(company, {
        page: currentPage,
        per_page: itemsPerPage,
        sort_by: sortBy,
        sort_order: sortOrder
      })

      setData(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch inward records")
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    try {
      setIsSearching(true)
      setError(null)

      // Validate and normalize dates
      let normalizedFromDate = fromDate
      let normalizedToDate = toDate

      // If dates are provided, ensure correct order
      if (fromDate && toDate) {
        const from = new Date(fromDate)
        const to = new Date(toDate)

        if (from > to) {
          // Swap dates if they're in wrong order
          normalizedFromDate = toDate
          normalizedToDate = fromDate
        }
      }

      const searchParams: any = {
        page: currentPage,
        per_page: itemsPerPage,
        sort_by: sortBy,
        sort_order: sortOrder
      }

      if (searchQuery.trim()) {
        searchParams.search = searchQuery.trim()
      }

      if (normalizedFromDate) {
        searchParams.from_date = normalizedFromDate
      }

      if (normalizedToDate) {
        searchParams.to_date = normalizedToDate
      }

      const response = await getInwardList(company, searchParams)
      setData(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed")
    } finally {
      setIsSearching(false)
    }
  }

  const clearFilters = () => {
    setSearchQuery("")
    setFromDate("")
    setToDate("")
    setSortBy('entry_date')
    setSortOrder('desc')
    setCurrentPage(1)
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  // Delete function
  const handleDelete = async (transactionId: string) => {
    setDeletingId(transactionId)
    try {
      await deleteInward(company, transactionId)
      
      // Refresh the data after successful deletion
      await fetchData()
      
    } catch (err) {
      console.error("Error deleting inward record:", err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError("Error deleting inward record: " + errorMessage)
    } finally {
      setDeletingId(null)
    }
  }

  // Download all records function with complete details
  const handleDownloadAll = async () => {
    try {
      setDownloading(true)
      
      // Show loading toast
      toast({
        title: "Preparing download...",
        description: "Fetching all inward records for export. This may take a moment for large datasets.",
      })

      // Fetch all inward records
      const response = await getAllInwardRecords(company, {
        search: searchQuery || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined
      })

      if (!response.records || response.records.length === 0) {
        toast({
          title: "No data to export",
          description: "No inward records found matching your criteria.",
          variant: "destructive",
        })
        return
      }

      // Update toast with progress
      toast({
        title: "Fetching detailed records...",
        description: `Fetching complete details for ${response.records.length} records. Please wait...`,
      })

      // Fetch complete details for each record
      const detailedRecords: InwardExcelData[] = []
      
      for (let i = 0; i < response.records.length; i++) {
        const record = response.records[i]
        
        try {
          // Update progress
          if (i % 5 === 0 || i === response.records.length - 1) {
            toast({
              title: "Processing records...",
              description: `Fetched details for ${i + 1} of ${response.records.length} records.`,
            })
          }
          
          // Fetch complete details for this record
          const detailResponse = await getInwardDetail(company, record.transaction_id)
          
          // Transform to Excel format with complete details
          const excelRecord: InwardExcelData = {
            // System Information
            company: detailResponse.company,
            transaction_id: detailResponse.transaction.transaction_no,
            entry_date: detailResponse.transaction.entry_date,
            system_grn_date: detailResponse.transaction.system_grn_date,
            
            // Transport Information
            vehicle_number: detailResponse.transaction.vehicle_number,
            transporter_name: detailResponse.transaction.transporter_name,
            lr_number: detailResponse.transaction.lr_number,
            source_location: detailResponse.transaction.source_location,
            destination_location: detailResponse.transaction.destination_location,
            
            // Party Information
            vendor_supplier_name: detailResponse.transaction.vendor_supplier_name,
            customer_party_name: detailResponse.transaction.customer_party_name,
            purchase_by: detailResponse.transaction.purchase_by,
            approval_authority: detailResponse.transaction.approval_authority,
            
            // Document Information
            challan_number: detailResponse.transaction.challan_number,
            invoice_number: detailResponse.transaction.invoice_number,
            po_number: detailResponse.transaction.po_number,
            grn_number: detailResponse.transaction.grn_number,
            grn_quantity: detailResponse.transaction.grn_quantity,
            received_quantity: detailResponse.transaction.received_quantity,
            dn_number: detailResponse.transaction.dn_number,
            service_invoice_number: detailResponse.transaction.service_invoice_number,
            
            // Financial Information
            total_amount: detailResponse.transaction.total_amount,
            tax_amount: detailResponse.transaction.tax_amount,
            discount_amount: detailResponse.transaction.discount_amount,
            currency: detailResponse.transaction.currency,
            
            // Remarks
            remark: detailResponse.transaction.remark,
            
            // Article Information (first article)
            sku_id: detailResponse.articles[0]?.sku_id,
            item_description: detailResponse.articles[0]?.item_description,
            item_category: detailResponse.articles[0]?.item_category,
            sub_category: detailResponse.articles[0]?.sub_category,
            item_code: detailResponse.articles[0]?.item_code,
            hsn_code: detailResponse.articles[0]?.hsn_code,
            quality_grade: detailResponse.articles[0]?.quality_grade,
            uom: detailResponse.articles[0]?.uom,
            packaging_type: detailResponse.articles[0]?.packaging_type?.toString(),
            quantity_units: detailResponse.articles[0]?.quantity_units,
            net_weight: detailResponse.articles[0]?.net_weight,
            total_weight: detailResponse.articles[0]?.total_weight,
            batch_number: detailResponse.articles[0]?.batch_number,
            lot_number: detailResponse.articles[0]?.lot_number,
            manufacturing_date: detailResponse.articles[0]?.manufacturing_date,
            expiry_date: detailResponse.articles[0]?.expiry_date,
            import_date: detailResponse.articles[0]?.import_date,
            unit_rate: detailResponse.articles[0]?.unit_rate,
            article_total_amount: detailResponse.articles[0]?.total_amount,
            article_tax_amount: detailResponse.articles[0]?.tax_amount,
            article_discount_amount: detailResponse.articles[0]?.discount_amount?.toString(),
            
            // Box Information (first box)
            box_number: detailResponse.boxes[0]?.box_number,
            article_description: detailResponse.boxes[0]?.article_description,
            box_net_weight: detailResponse.boxes[0]?.net_weight,
            box_gross_weight: detailResponse.boxes[0]?.gross_weight,
            box_lot_number: detailResponse.boxes[0]?.lot_number,
            
            // Legacy fields for backward compatibility
            item_descriptions: record.item_descriptions || [],
            quantities_and_uoms: record.quantities_and_uoms || []
          }
          
          detailedRecords.push(excelRecord)
          
        } catch (detailError) {
          console.warn(`Failed to fetch details for ${record.transaction_id}:`, detailError)
          // Add basic record if detail fetch fails
          detailedRecords.push({
            company: company,
            transaction_id: record.transaction_id,
            entry_date: record.entry_date,
            invoice_number: record.invoice_number,
            po_number: record.po_number,
            item_descriptions: record.item_descriptions || [],
            quantities_and_uoms: record.quantities_and_uoms || []
          })
        }
      }

      // Update toast with final processing
      toast({
        title: "Generating Excel file...",
        description: `Processing ${detailedRecords.length} records for Excel export.`,
      })

      // Generate filename with filters
      let filename = `inward_records_complete_${company}`
      if (searchQuery) filename += `_search_${searchQuery.replace(/[^a-zA-Z0-9]/g, '_')}`
      if (fromDate) filename += `_from_${fromDate}`
      if (toDate) filename += `_to_${toDate}`
      filename += `_${new Date().toISOString().split('T')[0]}.xlsx`

      // Download Excel file
      downloadInwardRecordsAsExcel(detailedRecords, company, filename)

      // Show success toast
      toast({
        title: "Download completed",
        description: `Exported ${detailedRecords.length} inward records with complete details to Excel.`,
      })

    } catch (err) {
      console.error('Download error:', err)
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Failed to download inward records",
        variant: "destructive",
      })
    } finally {
      setDownloading(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 w-full">
        <Card>
          <CardContent className="text-center py-12">
            <Loader2 className="mx-auto h-8 w-8 animate-spin" />
            <p className="text-muted-foreground mt-4">Loading inward records...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 w-full">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Failed to Load Records</h1>
          <Button onClick={fetchData}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  const totalPages = data ? Math.ceil(data.total / itemsPerPage) : 0
  const hasFilters = searchQuery || fromDate || toDate
  const hasNonDefaultSort = sortBy !== 'entry_date' || sortOrder !== 'desc'

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-tight break-words">
              Inward Records - {company}
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1">
              {data ? `${data.total} total records` : "Loading records..."}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <PermissionGuard module="inward" action="view">
              <Button 
                variant="outline" 
                onClick={handleDownloadAll}
                disabled={downloading}
                className="w-full sm:w-auto text-xs sm:text-sm"
                size="sm"
              >
                {downloading ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                    <span className="hidden sm:inline">Exporting...</span>
                    <span className="sm:hidden">Exporting</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Download All</span>
                    <span className="sm:hidden">Download</span>
                  </>
                )}
              </Button>
            </PermissionGuard>
            <PermissionGuard module="inward" action="create">
              <Link href={`/${company}/inward/new`} className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto text-xs sm:text-sm" size="sm">
                  <span className="hidden sm:inline">Create New Record</span>
                  <span className="sm:hidden">New Record</span>
                </Button>
              </Link>
            </PermissionGuard>
          </div>
        </div>
      </div>

      {/* Search and Filter Section */}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Search className="h-4 w-4 sm:h-5 sm:w-5" />
            <span>Search & Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
            {/* Search Input */}
            <div className="space-y-1.5 sm:space-y-2 lg:col-span-1 xl:col-span-2">
              <label className="text-xs sm:text-sm font-medium text-muted-foreground">
                Search Records
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                <Input
                  placeholder="Transaction no, batch, invoice..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 sm:pl-9 text-sm sm:text-base h-9 sm:h-10"
                />
              </div>
            </div>

            {/* From Date */}
            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-xs sm:text-sm font-medium text-muted-foreground">
                From Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="pl-8 sm:pl-9 text-sm sm:text-base h-9 sm:h-10"
                />
              </div>
            </div>

            {/* To Date */}
            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-xs sm:text-sm font-medium text-muted-foreground">
                To Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="pl-8 sm:pl-9 text-sm sm:text-base h-9 sm:h-10"
                />
              </div>
            </div>

            {/* Sort By */}
            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-xs sm:text-sm font-medium text-muted-foreground">
                Sort By
              </label>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="h-9 sm:h-10 text-sm">
                  <ArrowUpDown className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry_date">Entry Date</SelectItem>
                  <SelectItem value="transaction_no">Transaction No</SelectItem>
                  <SelectItem value="invoice_number">Invoice Number</SelectItem>
                  <SelectItem value="po_number">PO Number</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Order */}
            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-xs sm:text-sm font-medium text-muted-foreground">
                Order
              </label>
              <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
                <SelectTrigger className="h-9 sm:h-10 text-sm">
                  <SelectValue placeholder="Order..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Newest First</SelectItem>
                  <SelectItem value="asc">Oldest First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Clear Filters Button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={clearFilters}
              disabled={!hasFilters && sortBy === 'entry_date' && sortOrder === 'desc'}
              className="h-9 sm:h-10 text-xs sm:text-sm"
              size="sm"
            >
              <X className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Clear Filters</span>
              <span className="sm:hidden">Clear</span>
            </Button>
          </div>

          {/* Filter Status */}
          {(hasFilters || hasNonDefaultSort) && (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-2 sm:pt-3 border-t">
              <span className="text-xs sm:text-sm text-muted-foreground">Active filters:</span>
              {searchQuery && (
                <Badge variant="secondary" className="text-xs px-2 py-0.5">
                  <span className="hidden sm:inline">Search: </span>"{searchQuery.length > 15 ? `${searchQuery.substring(0, 15)}...` : searchQuery}"
                </Badge>
              )}
              {fromDate && (
                <Badge variant="secondary" className="text-xs px-2 py-0.5">
                  <span className="hidden sm:inline">From: </span>
                  <span className="sm:hidden">From </span>
                  {format(new Date(fromDate), "MMM dd, yyyy")}
                </Badge>
              )}
              {toDate && (
                <Badge variant="secondary" className="text-xs px-2 py-0.5">
                  <span className="hidden sm:inline">To: </span>
                  <span className="sm:hidden">To </span>
                  {format(new Date(toDate), "MMM dd, yyyy")}
                </Badge>
              )}
              {hasNonDefaultSort && (
                <Badge variant="secondary" className="text-xs px-2 py-0.5">
                  <span className="hidden sm:inline">Sort: </span>
                  {sortBy.replace('_', ' ')} ({sortOrder === 'desc' ? 'Newest' : 'Oldest'})
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading Overlay for Search */}
      {isSearching && (
        <div className="flex items-center justify-center p-3 sm:p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm sm:text-base">
            <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
            <span>Searching...</span>
          </div>
        </div>
      )}

      {/* Results Section */}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0">
            <CardTitle className="text-base sm:text-lg">
              Records {hasFilters ? "(Filtered)" : ""}
            </CardTitle>
            {data && (
              <Badge variant="outline" className="w-fit text-xs sm:text-sm">
                <span className="hidden sm:inline">Page {currentPage} of {totalPages} ({data.total} total)</span>
                <span className="sm:hidden">{currentPage}/{totalPages} ({data.total})</span>
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {data && data.records.length > 0 ? (
            <div className="space-y-3 sm:space-y-4">
              {/* Records List */}
              <div className="space-y-2 sm:space-y-3">
                {data.records.map((record) => (
                  <div
                    key={record.transaction_id}
                    className="border rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col gap-3 sm:gap-4">
                      {/* Main Content */}
                      <div className="flex-1 space-y-2 sm:space-y-3 min-w-0">
                        {/* Transaction Info */}
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base sm:text-lg break-words">
                              {record.transaction_id}
                            </h3>
                          </div>
                          {record.lot_number && (
                            <Badge variant="outline" className="w-fit text-xs shrink-0">
                              Lot: {record.lot_number}
                            </Badge>
                          )}
                        </div>

                        {/* Details Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 sm:gap-4 text-xs sm:text-sm">
                          <div className="flex flex-col sm:flex-row gap-0.5 sm:gap-2">
                            <span className="text-muted-foreground">Entry Date:</span>
                            <span className="font-medium">
                              {format(new Date(record.entry_date), "MMM dd, yyyy")}
                            </span>
                          </div>
                          {record.invoice_number && (
                            <div className="flex flex-col sm:flex-row gap-0.5 sm:gap-2">
                              <span className="text-muted-foreground">Invoice:</span>
                              <span className="font-medium truncate">
                                {record.invoice_number}
                              </span>
                            </div>
                          )}
                          {record.po_number && (
                            <div className="flex flex-col sm:flex-row gap-0.5 sm:gap-2">
                              <span className="text-muted-foreground">PO:</span>
                              <span className="font-medium truncate">
                                {record.po_number}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Items */}
                        {record.item_descriptions.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-xs sm:text-sm text-muted-foreground">Items:</span>
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                              {record.item_descriptions.slice(0, 3).map((item, index) => (
                                <Badge key={index} variant="secondary" className="text-xs px-2 py-0.5">
                                  <span className="truncate max-w-[120px] sm:max-w-none">{item}</span>
                                  {record.quantities_and_uoms[index] && 
                                    ` (${record.quantities_and_uoms[index]})`
                                  }
                                </Badge>
                              ))}
                              {record.item_descriptions.length > 3 && (
                                <Badge variant="outline" className="text-xs px-2 py-0.5">
                                  +{record.item_descriptions.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-row sm:flex-row lg:flex-row gap-2 pt-2 border-t sm:border-t-0 lg:border-t">
                        <Link 
                          href={`/${company}/inward/${record.transaction_id}`}
                          className="flex-1 sm:flex-initial"
                        >
                          <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9">
                            <span className="hidden sm:inline">View Details</span>
                            <span className="sm:hidden">View</span>
                          </Button>
                        </Link>
                        <PermissionGuard module="inward" action="edit">
                          <Link 
                            href={`/${company}/inward/${record.transaction_id}/edit`}
                            className="flex-1 sm:flex-initial"
                          >
                            <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9">
                              <Edit className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              <span className="hidden sm:inline">Edit</span>
                              <span className="sm:hidden">Edit</span>
                            </Button>
                          </Link>
                        </PermissionGuard>
                        <PermissionGuard module="inward" action="delete">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1 sm:flex-initial w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
                                disabled={deletingId === record.transaction_id}
                              >
                                {deletingId === record.transaction_id ? (
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="mr-1 h-3 w-3" />
                                )}
                                <span className="hidden sm:inline">Delete</span>
                                <span className="sm:hidden">Del</span>
                              </Button>
                            </AlertDialogTrigger>
                          <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-base sm:text-lg">Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription className="text-sm">
                                This action cannot be undone. This will permanently delete the inward record
                                <strong> {record.transaction_id}</strong> and remove all associated data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                              <AlertDialogCancel className="w-full sm:w-auto text-xs sm:text-sm">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(record.transaction_id)}
                                disabled={deletingId === record.transaction_id}
                                className="bg-red-600 hover:bg-red-700 w-full sm:w-auto text-xs sm:text-sm"
                              >
                                {deletingId === record.transaction_id ? (
                                  <>
                                    <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                                    Deleting...
                                  </>
                                ) : (
                                  "Delete Record"
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                          </AlertDialog>
                        </PermissionGuard>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 pt-3 sm:pt-4 border-t">
                  <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                    <span className="hidden sm:inline">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to{" "}
                      {Math.min(currentPage * itemsPerPage, data.total)} of {data.total} records
                    </span>
                    <span className="sm:hidden">
                      {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, data.total)} of {data.total}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1 || isSearching}
                      className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                    >
                      <span className="hidden sm:inline">Previous</span>
                      <span className="sm:hidden">Prev</span>
                    </Button>
                    
                    <div className="flex items-center gap-1 overflow-x-auto max-w-[200px] sm:max-w-none">
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
                            className="w-7 h-7 sm:w-8 sm:h-8 p-0 text-xs sm:text-sm min-w-[28px] sm:min-w-[32px]"
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
                      className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 sm:py-12 px-4">
              <div className="mx-auto w-16 h-16 sm:w-24 sm:h-24 bg-gray-100 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                <Search className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" />
              </div>
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-1.5 sm:mb-2">
                {hasFilters ? "No records found" : "No inward records"}
              </h3>
              <p className="text-sm sm:text-base text-gray-500 mb-4 sm:mb-6 max-w-md mx-auto">
                {hasFilters 
                  ? "Try adjusting your search criteria or date range"
                  : "Get started by creating your first inward record"
                }
              </p>
              {hasFilters ? (
                <Button variant="outline" onClick={clearFilters} size="sm" className="text-xs sm:text-sm">
                  Clear All Filters
                </Button>
              ) : (
                <Link href={`/${company}/inward/new`}>
                  <Button size="sm" className="text-xs sm:text-sm">
                    Create New Record
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
