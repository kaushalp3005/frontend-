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
import { Edit, Loader2, AlertCircle, Search, Calendar, X, Trash2, FileSpreadsheet } from "lucide-react"
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
  }, [searchQuery, fromDate, toDate, currentPage])

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
        per_page: itemsPerPage
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
        per_page: itemsPerPage
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
            packaging_type: detailResponse.articles[0]?.packaging_type,
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

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
            Inward Records - {company}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {data ? `${data.total} total records` : "Loading records..."}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <PermissionGuard module="inward" action="view">
            <Button 
              variant="outline" 
              onClick={handleDownloadAll}
              disabled={downloading}
              className="flex-1 sm:flex-none"
            >
              {downloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Download All
                </>
              )}
            </Button>
          </PermissionGuard>
          <PermissionGuard module="inward" action="create">
            <Link href={`/${company}/inward/new`}>
              <Button className="flex-1 sm:flex-none">
                Create New Record
              </Button>
            </Link>
          </PermissionGuard>
        </div>
      </div>

      {/* Search and Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search & Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Search Records
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Transaction no, batch, invoice..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
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
            <div className="flex items-end">
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
          </div>

          {/* Filter Status */}
          {hasFilters && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              {searchQuery && (
                <Badge variant="secondary">
                  Search: "{searchQuery}"
                </Badge>
              )}
              {fromDate && (
                <Badge variant="secondary">
                  From: {format(new Date(fromDate), "MMM dd, yyyy")}
                </Badge>
              )}
              {toDate && (
                <Badge variant="secondary">
                  To: {format(new Date(toDate), "MMM dd, yyyy")}
                </Badge>
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

      {/* Results Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              Records {hasFilters ? "(Filtered)" : ""}
            </CardTitle>
            {data && (
              <Badge variant="outline">
                Page {currentPage} of {totalPages} ({data.total} total)
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {data && data.records.length > 0 ? (
            <div className="space-y-4">
              {/* Records List */}
              <div className="space-y-3">
                {data.records.map((record) => (
                  <div
                    key={record.transaction_id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        {/* Transaction Info */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                          <h3 className="font-semibold text-lg">
                            {record.transaction_id}
                          </h3>
                          {record.batch_number && (
                            <Badge variant="outline" className="w-fit">
                              Batch: {record.batch_number}
                            </Badge>
                          )}
                        </div>

                        {/* Details Row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Entry Date:</span>
                            <span className="ml-2 font-medium">
                              {format(new Date(record.entry_date), "MMM dd, yyyy")}
                            </span>
                          </div>
                          {record.invoice_number && (
                            <div>
                              <span className="text-muted-foreground">Invoice:</span>
                              <span className="ml-2 font-medium">
                                {record.invoice_number}
                              </span>
                            </div>
                          )}
                          {record.po_number && (
                            <div>
                              <span className="text-muted-foreground">PO:</span>
                              <span className="ml-2 font-medium">
                                {record.po_number}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Items */}
                        {record.item_descriptions.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-sm text-muted-foreground">Items:</span>
                            <div className="flex flex-wrap gap-2">
                              {record.item_descriptions.slice(0, 3).map((item, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {item}
                                  {record.quantities_and_uoms[index] && 
                                    ` (${record.quantities_and_uoms[index]})`
                                  }
                                </Badge>
                              ))}
                              {record.item_descriptions.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{record.item_descriptions.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-row lg:flex-col gap-2">
                        <Link 
                          href={`/${company}/inward/${record.transaction_id}`}
                          className="flex-1"
                        >
                          <Button variant="outline" size="sm" className="w-full">
                            View Details
                          </Button>
                        </Link>
                        <PermissionGuard module="inward" action="edit">
                          <Link 
                            href={`/${company}/inward/${record.transaction_id}/edit`}
                            className="flex-1"
                          >
                            <Button variant="outline" size="sm" className="w-full">
                              <Edit className="mr-1 h-3 w-3" />
                              Edit
                            </Button>
                          </Link>
                        </PermissionGuard>
                        <PermissionGuard module="inward" action="delete">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1 w-full"
                                disabled={deletingId === record.transaction_id}
                              >
                                {deletingId === record.transaction_id ? (
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="mr-1 h-3 w-3" />
                                )}
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the inward record
                                <strong> {record.transaction_id}</strong> and remove all associated data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(record.transaction_id)}
                                disabled={deletingId === record.transaction_id}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                {deletingId === record.transaction_id ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
                {hasFilters ? "No records found" : "No inward records"}
              </h3>
              <p className="text-gray-500 mb-6">
                {hasFilters 
                  ? "Try adjusting your search criteria or date range"
                  : "Get started by creating your first inward record"
                }
              </p>
              {hasFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear All Filters
                </Button>
              ) : (
                <Link href={`/${company}/inward/new`}>
                  <Button>Create New Record</Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
