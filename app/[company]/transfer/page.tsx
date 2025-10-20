"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, FileText, Eye, Trash2, Loader2, RefreshCw, CheckCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { InterunitApiService, RequestResponse } from "@/lib/interunitApiService"
import type { Company } from "@/types/auth"

interface TransferPageProps {
  params: {
    company: Company
  }
}

export default function TransferPage({ params }: TransferPageProps) {
  const { company } = params
  const router = useRouter()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("request")
  
  // State for requests data
  const [requests, setRequests] = useState<RequestResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [perPage] = useState(10)

  // State for transfer out records
  const [transfers, setTransfers] = useState<any[]>([])
  const [transfersLoading, setTransfersLoading] = useState(false)
  const [transfersPage, setTransfersPage] = useState(1)
  const [transfersTotalPages, setTransfersTotalPages] = useState(1)
  const [transfersTotalRecords, setTransfersTotalRecords] = useState(0)
  const [transfersPerPage] = useState(10)

  // Load requests data
  const loadRequests = async (page: number = 1) => {
    setLoading(true)
    try {
      console.log('📋 ===== LOADING REQUEST RECORDS =====')
      console.log('📄 Page:', page)
      console.log('📊 Per Page:', perPage)
      console.log('🔗 API URL:', `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/interunit/requests?page=${page}&per_page=${perPage}&sort_by=created_ts&sort_order=desc`)
      
      // Only show Pending and Accept status requests (exclude Transferred/Completed)
      const response = await InterunitApiService.getRequests({
        page,
        per_page: perPage,
        sort_by: "created_ts",
        sort_order: "desc",
        status: undefined  // We'll filter on backend or here
      })
      
      console.log('📥 API Response:', JSON.stringify(response, null, 2))
      console.log('📊 Total Records:', response.total)
      console.log('📄 Total Pages:', response.total_pages)
      console.log('📋 Records Count:', response.records?.length || 0)
      console.log('📋 First Record:', response.records?.[0])
      
      // Filter to show only Pending and Accept status (exclude Transferred)
      const activeRequests = response.records.filter((req: RequestResponse) => 
        req.status === 'Pending' || req.status === 'Accept'
      )
      
      console.log('✨ Active Requests (Pending/Accept):', activeRequests.length)
      console.log('🚫 Filtered out (Transferred):', response.records.length - activeRequests.length)
      
      setRequests(activeRequests)
      setTotalPages(response.total_pages)
      setTotalRecords(activeRequests.length)  // Update to show only active count
      setCurrentPage(page)
      
      console.log('✅ Request records loaded successfully')
      console.log('🔍 State after update - Active requests.length:', activeRequests.length)
    } catch (error: any) {
      console.error('❌ ===== FAILED TO LOAD REQUEST RECORDS =====')
      console.error('💥 Error Details:', error)
      console.error('📄 Error Message:', error.message)
      console.error('🌐 Error Response:', error.response?.data)
      console.error('📊 Error Status:', error.response?.status)
      
      toast({
        title: "Error",
        description: "Failed to load requests. Please try again.",
        variant: "destructive",
      })
    } finally {
      console.log('🏁 Request records loading process completed')
      setLoading(false)
    }
  }

  // Load data on component mount and when tab changes
  useEffect(() => {
    loadRequests(1)
  }, [])

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === "transferout") {
      loadTransfers(1)
    } else if (activeTab === "details") {
      // Load all transfers for "All Transfers" tab
      loadTransfers(1)
    }
  }, [activeTab])

  // Load transfer out records
  const loadTransfers = async (page: number = 1) => {
    setTransfersLoading(true)
    try {
      console.log('📋 ===== LOADING TRANSFER OUT RECORDS =====')
      console.log('📄 Page:', page)
      console.log('📊 Per Page:', transfersPerPage)
      console.log('🔗 API URL:', `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/interunit/transfers?page=${page}&per_page=${transfersPerPage}&sort_by=created_ts&sort_order=desc`)
      
      const response = await InterunitApiService.getTransfers({
        page,
        per_page: transfersPerPage,
        sort_by: "created_ts",
        sort_order: "desc"
      })
      
      console.log('📥 API Response:', JSON.stringify(response, null, 2))
      console.log('📊 Total Records:', response.total)
      console.log('📄 Total Pages:', response.total_pages)
      console.log('📋 Records Count:', response.records?.length || 0)
      console.log('� First Record:', response.records?.[0])
      
      setTransfers(response.records || [])
      setTransfersTotalPages(response.total_pages || 1)
      setTransfersTotalRecords(response.total || 0)
      setTransfersPage(page)
      
      console.log('✅ Transfer out records loaded successfully')
    } catch (error: any) {
      console.error('❌ ===== FAILED TO LOAD TRANSFER OUT RECORDS =====')
      console.error('💥 Error Details:', error)
      console.error('📄 Error Message:', error.message)
      console.error('🌐 Error Response:', error.response?.data)
      console.error('📊 Error Status:', error.response?.status)
      
      toast({
        title: "Error",
        description: "Failed to load transfer records. Please try again.",
        variant: "destructive",
      })
    } finally {
      console.log('🏁 Transfer out records loading process completed')
      setTransfersLoading(false)
    }
  }

  // Refresh data when component becomes visible (user returns from form)
  useEffect(() => {
    const handleFocus = () => {
      if (activeTab === "request") {
        loadRequests(currentPage)
      } else if (activeTab === "transferout") {
        loadTransfers(transfersPage)
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [activeTab, currentPage, transfersPage])

  // Handle page change
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      loadRequests(page)
    }
  }

  // Handle transfer out page change
  const handleTransfersPageChange = (page: number) => {
    if (page >= 1 && page <= transfersTotalPages) {
      loadTransfers(page)
    }
  }

  // Handle request actions
  const handleViewRequest = (requestId: number) => {
    // Navigate to request details page
    console.log('View request:', requestId)
  }

  const handleApproveRequest = (requestId: number) => {
    // Redirect to transfer form page with request ID
    console.log('Proceeding with request:', requestId)
    router.push(`/${company}/transfer/transferform?requestId=${requestId}`)
  }

  const handleDeleteRequest = async (requestId: number) => {
    if (confirm("Are you sure you want to delete this request?")) {
      try {
        console.log('🗑️ Deleting request:', requestId)
        const response = await InterunitApiService.deleteRequest(requestId)
        console.log('✅ Delete response:', response)

        toast({
          title: "Success",
          description: response.message || "Request deleted successfully!",
        })

        // Reload the current page
        loadRequests(currentPage)
      } catch (error: any) {
        console.error('❌ Failed to delete request:', error)

        let errorMessage = "Failed to delete request. Please try again."
        if (error.response?.data) {
          if (typeof error.response.data === 'string') {
            errorMessage = error.response.data
          } else if (error.response.data.detail) {
            errorMessage = String(error.response.data.detail)
          } else if (error.response.data.message) {
            errorMessage = String(error.response.data.message)
          }
        }

        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
      }
    }
  }

  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>
      case 'approved':
      case 'accept':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Approved</Badge>
      case 'rejected':
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Rejected</Badge>
      case 'cancelled':
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Cancelled</Badge>
      case 'in transit':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">In Transit</Badge>
      case 'completed':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Completed</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  // Format date - handles DD-MM-YYYY format from backend
  const formatDate = (dateString: string) => {
    try {
      // If already in DD-MM-YYYY format, return as is
      if (dateString.match(/^\d{2}-\d{2}-\d{4}$/)) {
        return dateString
      }
      
      // If in other format, try to parse and format
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateString)
        return dateString // Return original if can't parse
      }
      
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).replace(/\//g, '-')
    } catch (error) {
      console.error('Error formatting date:', error)
      return dateString
    }
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 bg-gray-100 min-h-screen">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Inter-Unit Transfer</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage stock transfers between sites
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="request">Request</TabsTrigger>
          <TabsTrigger value="transferout">Transfer Out</TabsTrigger>
          <TabsTrigger value="transferin">Transfer In</TabsTrigger>
          <TabsTrigger value="details">All Transfers</TabsTrigger>
        </TabsList>

        {/* Request Tab */}
        <TabsContent value="request" className="space-y-4">
          <Card className="w-full bg-gray-50 border-gray-200">
            <CardHeader className="pb-4 bg-gray-100">
              <CardTitle className="text-lg font-semibold text-gray-700">
                Create New Transfer Request
              </CardTitle>
              <p className="text-sm text-gray-500">
                Submit a request to receive stock from another warehouse
              </p>
            </CardHeader>
            <CardContent className="pt-0 bg-gray-50">
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Use the form below to create a new transfer request with article details.
                </p>
                <Button 
                  className="w-full sm:w-auto bg-black hover:bg-gray-800 text-white"
                  onClick={() => router.push(`/${company}/transfer/request`)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Request
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Request Records Table */}
          <Card className="w-full bg-white border border-gray-300 shadow-sm">
            <CardHeader className="pb-3 bg-white border-b border-gray-300">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    Request Records
                  </CardTitle>
                  <p className="text-xs text-gray-600 mt-1">
                    {totalRecords} total records
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadRequests(currentPage)}
                    disabled={loading}
                    className="h-8 px-3 text-xs bg-white border-gray-300 hover:bg-gray-50"
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <div className="text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-300">
                    Page {currentPage} of {totalPages}
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-0 bg-white">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600">Loading requests...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-300">
                        <th className="text-left py-2.5 px-4 font-semibold text-gray-700 text-xs border-r border-gray-200">Request No</th>
                        <th className="text-left py-2.5 px-4 font-semibold text-gray-700 text-xs border-r border-gray-200">Status</th>
                        <th className="text-left py-2.5 px-4 font-semibold text-gray-700 text-xs border-r border-gray-200">From → To</th>
                        <th className="text-left py-2.5 px-4 font-semibold text-gray-700 text-xs border-r border-gray-200">Date</th>
                        <th className="text-left py-2.5 px-4 font-semibold text-gray-700 text-xs border-r border-gray-200">Items</th>
                        <th className="text-center py-2.5 px-4 font-semibold text-gray-700 text-xs">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        console.log('🎨 RENDERING TABLE BODY')
                        console.log('📊 requests.length:', requests.length)
                        console.log('📋 requests data:', requests)
                        return null
                      })()}
                      {requests.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-gray-500 text-sm border-b border-gray-200">
                            No requests found
                          </td>
                        </tr>
                      ) : (
                        requests.map((request) => {
                          console.log('🔄 Rendering request:', request.request_no)
                          return (
                          <tr key={request.id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="py-2.5 px-4 text-xs font-medium text-gray-900 border-r border-gray-200">
                              {request.request_no}
                            </td>
                            <td className="py-2.5 px-4 text-xs border-r border-gray-200">
                              {getStatusBadge(request.status)}
                            </td>
                            <td className="py-2.5 px-4 text-xs border-r border-gray-200">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-medium text-gray-900">{request.from_warehouse}</span>
                                <span className="text-gray-400">→</span>
                                <span className="font-medium text-gray-900">{request.to_warehouse}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-xs text-gray-700 border-r border-gray-200">
                              {formatDate(request.request_date)}
                            </td>
                            <td className="py-2.5 px-4 text-xs border-r border-gray-200">
                              {/* Items count badge */}
                              <div className="mb-1.5">
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 px-1.5 py-0.5">
                                  {request.lines?.length || 0} Items
                                </Badge>
                              </div>
                              
                              {/* Show items in compact list */}
                              {request.lines && request.lines.length > 0 && (
                                <div className="space-y-1">
                                  {request.lines.slice(0, 2).map((line, idx) => (
                                    <div key={idx} className="text-xs text-gray-700">
                                      • {line.item_description} ({line.quantity} {line.uom})
                                    </div>
                                  ))}
                                  {request.lines.length > 2 && (
                                    <div className="text-xs text-blue-600 font-medium">
                                      +{request.lines.length - 2} more
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-xs">
                              <div className="flex items-center justify-center space-x-1">
                                {/* Accept Button */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleApproveRequest(request.id)}
                                  disabled={request.status.toLowerCase() !== 'pending'}
                                  className="h-7 px-2 bg-green-50 border-green-300 hover:bg-green-100 text-green-700 text-xs"
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Accept
                                </Button>

                                {/* Delete Button */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteRequest(request.id)}
                                  disabled={request.status.toLowerCase() !== 'pending'}
                                  className="h-7 w-7 p-0 bg-white border-gray-300 hover:bg-gray-100"
                                >
                                  <Trash2 className="h-3 w-3 text-red-600" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )})
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-300 bg-gray-50">
                  <div className="text-xs text-gray-600">
                    Showing {((currentPage - 1) * perPage) + 1} to {Math.min(currentPage * perPage, totalRecords)} of {totalRecords} results
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="h-7 px-3 text-xs bg-white border-gray-300"
                    >
                      Previous
                    </Button>
                    <span className="text-xs text-gray-700 bg-white px-2 py-1 rounded border border-gray-300">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="h-7 px-3 text-xs bg-white border-gray-300"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transfer Out Tab */}
        <TabsContent value="transferout" className="space-y-4">
          {/* Transfer Out Records Table */}
          <Card className="w-full bg-white border border-gray-300 shadow-sm">
            <CardHeader className="pb-3 bg-white border-b border-gray-300">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    Transfer Out Records
                  </CardTitle>
                  <p className="text-xs text-gray-600 mt-1">
                    {transfersTotalRecords} total transfer records
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadTransfers(transfersPage)}
                    disabled={transfersLoading}
                    className="h-8 px-3 text-xs bg-white border-gray-300 hover:bg-gray-50"
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${transfersLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <div className="text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-300">
                    Page {transfersPage} of {transfersTotalPages}
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-0 bg-white">
              {transfersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600">Loading transfers...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-300">
                        <th className="text-left py-2.5 px-4 font-semibold text-gray-700 text-xs border-r border-gray-200">Transfer No</th>
                        <th className="text-left py-2.5 px-4 font-semibold text-gray-700 text-xs border-r border-gray-200">Date</th>
                        <th className="text-left py-2.5 px-4 font-semibold text-gray-700 text-xs border-r border-gray-200">From → To</th>
                        <th className="text-left py-2.5 px-4 font-semibold text-gray-700 text-xs border-r border-gray-200">Status</th>
                        <th className="text-left py-2.5 px-4 font-semibold text-gray-700 text-xs border-r border-gray-200">Items/Boxes</th>
                        <th className="text-left py-2.5 px-4 font-semibold text-gray-700 text-xs border-r border-gray-200">Pending Items</th>
                        <th className="text-left py-2.5 px-4 font-semibold text-gray-700 text-xs border-r border-gray-200">Vehicle</th>
                        <th className="text-center py-2.5 px-4 font-semibold text-gray-700 text-xs">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transfers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-gray-500 text-sm border-b border-gray-200">
                            No transfer records found
                          </td>
                        </tr>
                      ) : (
                        transfers.map((transfer) => (
                          <tr key={transfer.id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="py-2.5 px-4 text-xs font-medium text-blue-600 border-r border-gray-200">
                              {transfer.transfer_no || transfer.challan_no}
                            </td>
                            <td className="py-2.5 px-4 text-xs text-gray-700 border-r border-gray-200">
                              {formatDate(transfer.transfer_date || transfer.stock_trf_date || transfer.created_ts)}
                            </td>
                            <td className="py-2.5 px-4 text-xs border-r border-gray-200">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-medium text-gray-900">{transfer.from_warehouse || transfer.from_site}</span>
                                <span className="text-gray-400">→</span>
                                <span className="font-medium text-gray-900">{transfer.to_warehouse || transfer.to_site}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-xs border-r border-gray-200">
                              {getStatusBadge(transfer.status)}
                            </td>
                            <td className="py-2.5 px-4 text-xs border-r border-gray-200">
                              <div className="flex items-center space-x-2">
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 px-1.5 py-0.5">
                                  {transfer.items_count || 0} Items
                                </Badge>
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 px-1.5 py-0.5">
                                  {transfer.boxes_count || 0} Boxes
                                </Badge>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-xs border-r border-gray-200">
                              <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200 px-1.5 py-0.5">
                                {transfer.pending_items || 0} Pending
                              </Badge>
                            </td>
                            <td className="py-2.5 px-4 text-xs border-r border-gray-200">
                              <div className="space-y-0.5">
                                <div className="font-medium text-gray-900">{transfer.vehicle_number || transfer.vehicle_no || 'N/A'}</div>
                                <div className="text-gray-600">{transfer.driver_name || 'N/A'}</div>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-xs">
                              <div className="flex items-center justify-center space-x-1">
                                {/* View Details Button */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => router.push(`/${company}/transfer/view/${transfer.id}`)}
                                  className="h-7 w-7 p-0 bg-white border-gray-300 hover:bg-gray-100"
                                  title="View Transfer Details"
                                >
                                  <Eye className="h-3 w-3 text-gray-600" />
                                </Button>
                                
                                {/* Download DC Button */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => router.push(`/${company}/transfer/dc/${transfer.id}`)}
                                  className="h-7 px-2 bg-green-50 border-green-300 hover:bg-green-100 text-green-700 text-xs"
                                  title="Download Delivery Challan"
                                >
                                  <FileText className="h-3 w-3 mr-1" />
                                  DC
                                </Button>
                                
                                {/* Generate Transfer In Button */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => console.log('Transfer In:', transfer.transfer_no)}
                                  className="h-7 px-2 bg-purple-50 border-purple-300 hover:bg-purple-100 text-purple-700 text-xs"
                                >
                                  <FileText className="h-3 w-3 mr-1" />
                                  Transfer In
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {transfersTotalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-300 bg-gray-50">
                  <div className="text-xs text-gray-600">
                    Showing {((transfersPage - 1) * transfersPerPage) + 1} to {Math.min(transfersPage * transfersPerPage, transfersTotalRecords)} of {transfersTotalRecords} results
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTransfersPageChange(transfersPage - 1)}
                      disabled={transfersPage === 1}
                      className="h-7 px-3 text-xs bg-white border-gray-300"
                    >
                      Previous
                    </Button>
                    <span className="text-xs text-gray-700 bg-white px-2 py-1 rounded border border-gray-300">
                      {transfersPage} / {transfersTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTransfersPageChange(transfersPage + 1)}
                      disabled={transfersPage === transfersTotalPages}
                      className="h-7 px-3 text-xs bg-white border-gray-300"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transfer IN Tab */}
        <TabsContent value="transferin" className="space-y-4">
          <Card className="w-full bg-gray-50 border-gray-200">
            <CardHeader className="pb-4 bg-gray-100">
              <CardTitle className="text-lg font-semibold text-gray-700">
                Process Transfer IN
              </CardTitle>
              <p className="text-sm text-gray-500">
                Receive and verify incoming stock transfers from other warehouses
              </p>
            </CardHeader>
            <CardContent className="pt-4 bg-gray-50">
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="bg-white p-6 rounded-lg border-2 border-dashed border-gray-300 text-center max-w-md">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-blue-500" />
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    Ready to Process Transfer IN
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Click the button below to start receiving and verifying incoming transfers
                  </p>
                  <Button
                    onClick={() => router.push(`/${company}/transfer/transferIn`)}
                    className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-6"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Process Transfer IN
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Transfers Tab */}
        <TabsContent value="details" className="space-y-4">
          <Card className="w-full bg-white border border-gray-300 shadow-sm">
            <CardHeader className="pb-3 bg-white border-b border-gray-300">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    All Transfers
                  </CardTitle>
                  <p className="text-xs text-gray-600 mt-1">
                    {transfersTotalRecords} total transfer records
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadTransfers(transfersPage)}
                    disabled={transfersLoading}
                    className="h-8 px-3 text-xs bg-white border-gray-300 hover:bg-gray-50"
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${transfersLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <div className="text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-300">
                    Page {transfersPage} of {transfersTotalPages}
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-0 bg-white">
              {transfersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600">Loading transfers...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-300">
                        <th className="text-left py-2.5 px-4 font-semibold text-gray-700 text-xs border-r border-gray-200">Transfer No</th>
                        <th className="text-left py-2.5 px-4 font-semibold text-gray-700 text-xs border-r border-gray-200">Date</th>
                        <th className="text-left py-2.5 px-4 font-semibold text-gray-700 text-xs border-r border-gray-200">From → To</th>
                        <th className="text-left py-2.5 px-4 font-semibold text-gray-700 text-xs border-r border-gray-200">Status</th>
                        <th className="text-left py-2.5 px-4 font-semibold text-gray-700 text-xs border-r border-gray-200">Items/Boxes</th>
                        <th className="text-left py-2.5 px-4 font-semibold text-gray-700 text-xs border-r border-gray-200">Pending Items</th>
                        <th className="text-left py-2.5 px-4 font-semibold text-gray-700 text-xs border-r border-gray-200">Vehicle</th>
                        <th className="text-center py-2.5 px-4 font-semibold text-gray-700 text-xs">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transfers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-gray-500 text-sm border-b border-gray-200">
                            No transfer records found
                          </td>
                        </tr>
                      ) : (
                        transfers.map((transfer) => (
                          <tr key={transfer.id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="py-2.5 px-4 text-xs font-medium text-blue-600 border-r border-gray-200">
                              {transfer.transfer_no || transfer.challan_no}
                            </td>
                            <td className="py-2.5 px-4 text-xs text-gray-700 border-r border-gray-200">
                              {formatDate(transfer.transfer_date || transfer.stock_trf_date || transfer.created_ts)}
                            </td>
                            <td className="py-2.5 px-4 text-xs border-r border-gray-200">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-medium text-gray-900">{transfer.from_warehouse || transfer.from_site}</span>
                                <span className="text-gray-400">→</span>
                                <span className="font-medium text-gray-900">{transfer.to_warehouse || transfer.to_site}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-xs border-r border-gray-200">
                              {getStatusBadge(transfer.status)}
                            </td>
                            <td className="py-2.5 px-4 text-xs border-r border-gray-200">
                              <div className="flex items-center space-x-2">
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 px-1.5 py-0.5">
                                  {transfer.items_count || 0} Items
                                </Badge>
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 px-1.5 py-0.5">
                                  {transfer.boxes_count || 0} Boxes
                                </Badge>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-xs border-r border-gray-200">
                              <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200 px-1.5 py-0.5">
                                {transfer.pending_items || 0} Pending
                              </Badge>
                            </td>
                            <td className="py-2.5 px-4 text-xs border-r border-gray-200">
                              <div className="space-y-0.5">
                                <div className="font-medium text-gray-900">{transfer.vehicle_number || transfer.vehicle_no || 'N/A'}</div>
                                <div className="text-gray-600">{transfer.driver_name || 'N/A'}</div>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-xs">
                              <div className="flex items-center justify-center space-x-1">
                                {/* View Details Button */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => router.push(`/${company}/transfer/view/${transfer.id}`)}
                                  className="h-7 w-7 p-0 bg-white border-gray-300 hover:bg-gray-100"
                                  title="View Transfer Details"
                                >
                                  <Eye className="h-3 w-3 text-gray-600" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {transfersTotalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-300 bg-gray-50">
                  <div className="text-xs text-gray-600">
                    Showing {((transfersPage - 1) * transfersPerPage) + 1} to {Math.min(transfersPage * transfersPerPage, transfersTotalRecords)} of {transfersTotalRecords} results
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTransfersPageChange(transfersPage - 1)}
                      disabled={transfersPage === 1}
                      className="h-7 px-3 text-xs bg-white border-gray-300"
                    >
                      Previous
                    </Button>
                    <span className="text-xs text-gray-700 bg-white px-2 py-1 rounded border border-gray-300">
                      {transfersPage} / {transfersTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTransfersPageChange(transfersPage + 1)}
                      disabled={transfersPage === transfersTotalPages}
                      className="h-7 px-3 text-xs bg-white border-gray-300"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}