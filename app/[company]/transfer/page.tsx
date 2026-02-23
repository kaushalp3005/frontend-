"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Plus, Trash2, Loader2, RefreshCw, CheckCircle, Clock,
  Truck, ArrowRightLeft, PackageCheck, FileText, ArrowRight,
  Package, ClipboardList, Send, Inbox, Eye, Printer
} from "lucide-react"
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

  // State for transfers data
  const [transfers, setTransfers] = useState<any[]>([])
  const [transfersLoading, setTransfersLoading] = useState(false)
  const [transfersPage, setTransfersPage] = useState(1)
  const [transfersTotalPages, setTransfersTotalPages] = useState(1)
  const [transfersTotal, setTransfersTotal] = useState(0)

  // State for transfer INs data
  const [transferIns, setTransferIns] = useState<any[]>([])
  const [transferInsLoading, setTransferInsLoading] = useState(false)
  const [transferInsPage, setTransferInsPage] = useState(1)
  const [transferInsTotalPages, setTransferInsTotalPages] = useState(1)
  const [transferInsTotal, setTransferInsTotal] = useState(0)

  // Load requests data
  const loadRequests = async (page: number = 1) => {
    setLoading(true)
    try {
      const response = await InterunitApiService.getRequests({
        page,
        per_page: perPage,
      })

      const activeRequests = response.records.filter((req: RequestResponse) =>
        req.status === 'Pending' || req.status === 'Accept' || req.status === 'Accepted' || req.status === 'Rejected'
      )

      setRequests(activeRequests)
      setTotalPages(response.total_pages)
      setTotalRecords(activeRequests.length)
      setCurrentPage(page)
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to load requests.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // Load transfers data
  const loadTransfers = async (page: number = 1) => {
    setTransfersLoading(true)
    try {
      const response = await InterunitApiService.getTransfers({
        page, per_page: perPage, sort_by: "created_ts", sort_order: "desc",
      })
      setTransfers(response.records || [])
      setTransfersTotalPages(response.total_pages || 1)
      setTransfersTotal(response.total || 0)
      setTransfersPage(page)
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to load transfers.", variant: "destructive" })
    } finally {
      setTransfersLoading(false)
    }
  }

  // Load transfer INs data
  const loadTransferIns = async (page: number = 1) => {
    setTransferInsLoading(true)
    try {
      const response = await InterunitApiService.getTransferIns({
        page, per_page: perPage, sort_by: "created_at", sort_order: "desc",
      })
      setTransferIns(response.records || [])
      setTransferInsTotalPages(response.total_pages || 1)
      setTransferInsTotal(response.total || 0)
      setTransferInsPage(page)
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to load transfer INs.", variant: "destructive" })
    } finally {
      setTransferInsLoading(false)
    }
  }

  useEffect(() => { loadRequests(1) }, [])

  useEffect(() => {
    if (activeTab === "transferout" && transfers.length === 0) loadTransfers(1)
    if (activeTab === "transferin" && transferIns.length === 0) loadTransferIns(1)
    if (activeTab === "details" && transfers.length === 0) loadTransfers(1)
  }, [activeTab])

  useEffect(() => {
    const handleFocus = () => {
      if (activeTab === "request") loadRequests(currentPage)
      else if (activeTab === "transferout") loadTransfers(transfersPage)
      else if (activeTab === "transferin") loadTransferIns(transferInsPage)
      else if (activeTab === "details") loadTransfers(transfersPage)
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [activeTab, currentPage, transfersPage, transferInsPage])

  const handlePageChange = (page: number) => { if (page >= 1 && page <= totalPages) loadRequests(page) }
  const handleTransfersPageChange = (page: number) => { if (page >= 1 && page <= transfersTotalPages) loadTransfers(page) }
  const handleTransferInsPageChange = (page: number) => { if (page >= 1 && page <= transferInsTotalPages) loadTransferIns(page) }

  const handleApproveRequest = (requestId: number) => {
    router.push(`/${company}/transfer/transferform?requestId=${requestId}`)
  }

  const handleDeleteRequest = async (requestId: number) => {
    if (!confirm("Are you sure you want to delete this request?")) return
    try {
      const response = await InterunitApiService.deleteRequest(requestId)
      toast({ title: "Deleted", description: response.message || "Request deleted." })
      loadRequests(currentPage)
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.response?.data?.message || "Failed to delete request."
      toast({ title: "Error", description: String(msg), variant: "destructive" })
    }
  }

  const handleDeleteTransfer = async (transferId: number) => {
    if (!confirm("Are you sure you want to delete this transfer?")) return
    try {
      const response = await InterunitApiService.deleteTransfer(transferId)
      toast({ title: "Deleted", description: response.message || "Transfer deleted." })
      loadTransfers(transfersPage)
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.response?.data?.message || "Failed to delete transfer."
      toast({ title: "Error", description: String(msg), variant: "destructive" })
    }
  }

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase()
    const map: Record<string, { label: string; cls: string }> = {
      'pending':     { label: 'Pending',     cls: 'bg-amber-50 text-amber-700 border-amber-200' },
      'approved':    { label: 'Approved',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      'accept':      { label: 'Approved',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      'accepted':    { label: 'Approved',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      'rejected':    { label: 'Rejected',    cls: 'bg-red-50 text-red-700 border-red-200' },
      'cancelled':   { label: 'Cancelled',   cls: 'bg-red-50 text-red-600 border-red-200' },
      'transferred': { label: 'Transferred', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
      'received':    { label: 'Received',    cls: 'bg-teal-50 text-teal-700 border-teal-200' },
      'partial':     { label: 'Partial',     cls: 'bg-orange-50 text-orange-700 border-orange-200' },
      'in transit':  { label: 'In Transit',  cls: 'bg-sky-50 text-sky-700 border-sky-200' },
      'completed':   { label: 'Completed',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    }
    const entry = map[s]
    return <Badge variant="outline" className={`text-[11px] font-medium px-2 py-0.5 ${entry?.cls || 'bg-gray-50 text-gray-600 border-gray-200'}`}>{entry?.label || status}</Badge>
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    try {
      if (dateString.match(/^\d{2}-\d{2}-\d{4}$/)) return dateString
      const d = new Date(dateString)
      if (isNaN(d.getTime())) return dateString
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
    } catch { return dateString }
  }

  // Stat cards computed from loaded data
  const pendingRequests = requests.filter(r => r.status === 'Pending').length

  // ── Reusable sub-components ──

  const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) => (
    <Card className="border-0 shadow-sm bg-white">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-xl sm:text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className={`h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const EmptyState = ({ icon: Icon, title, subtitle, action, actionLabel }: {
    icon: any; title: string; subtitle: string; action?: () => void; actionLabel?: string
  }) => (
    <div className="flex flex-col items-center justify-center py-12 sm:py-16">
      <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-gray-400" />
      </div>
      <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-1">{title}</h3>
      <p className="text-xs sm:text-sm text-gray-500 text-center max-w-xs mb-4">{subtitle}</p>
      {action && actionLabel && (
        <Button size="sm" onClick={action} className="bg-gray-900 hover:bg-gray-800 text-white h-9 px-4 text-xs sm:text-sm">
          <Plus className="h-3.5 w-3.5 mr-1.5" />{actionLabel}
        </Button>
      )}
    </div>
  )

  const PaginationBar = ({ page, totalPages: tp, total, onPageChange }: {
    page: number; totalPages: number; total: number; onPageChange: (p: number) => void
  }) => (
    tp > 1 ? (
      <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t bg-gray-50/50 gap-2">
        <p className="text-xs text-muted-foreground">
          Showing {((page - 1) * perPage) + 1}-{Math.min(page * perPage, total)} of {total}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page === 1}
            className="h-8 px-3 text-xs">Prev</Button>
          <span className="text-xs font-medium text-gray-700 tabular-nums">{page} / {tp}</span>
          <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page === tp}
            className="h-8 px-3 text-xs">Next</Button>
        </div>
      </div>
    ) : null
  )

  const SectionHeader = ({ title, count, onRefresh, isLoading }: {
    title: string; count: number; onRefresh: () => void; isLoading: boolean
  }) => (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-5 py-3 sm:py-4 border-b bg-white">
      <div>
        <h3 className="text-sm sm:text-base font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{count} record{count !== 1 ? 's' : ''}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}
        className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground self-end sm:self-auto">
        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
    </div>
  )

  const LoadingSkeleton = () => (
    <div className="space-y-3 p-4 sm:p-5">
      {[1, 2, 3].map(i => (
        <div key={i} className="animate-pulse flex items-center gap-4 p-4 rounded-lg bg-gray-50">
          <div className="h-10 w-10 rounded-lg bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-200 rounded w-1/3" />
            <div className="h-2.5 bg-gray-200 rounded w-1/2" />
          </div>
          <div className="h-6 w-16 bg-gray-200 rounded-full" />
        </div>
      ))}
    </div>
  )

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5 lg:space-y-6 bg-gray-50 min-h-screen">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <ArrowRightLeft className="h-6 w-6 sm:h-7 sm:w-7 text-gray-700" />
            Inter-Unit Transfer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage stock transfers between warehouses</p>
        </div>
        <Button
          className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white h-10 px-5 text-sm shadow-sm"
          onClick={() => router.push(`/${company}/transfer/request`)}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Request
        </Button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={ClipboardList} label="Requests" value={totalRecords} color="bg-blue-500" />
        <StatCard icon={Clock} label="Pending" value={pendingRequests} color="bg-amber-500" />
        <StatCard icon={Send} label="Transfers Out" value={transfersTotal} color="bg-violet-500" />
        <StatCard icon={Inbox} label="Transfers In" value={transferInsTotal} color="bg-teal-500" />
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1 h-auto p-1 bg-white border shadow-sm rounded-xl">
          <TabsTrigger value="request" className="text-xs sm:text-sm py-2.5 px-2 rounded-lg data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-sm gap-1.5">
            <FileText className="h-3.5 w-3.5" /><span className="hidden sm:inline">Requests</span><span className="sm:hidden">Req</span>
          </TabsTrigger>
          <TabsTrigger value="transferout" className="text-xs sm:text-sm py-2.5 px-2 rounded-lg data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-sm gap-1.5">
            <Send className="h-3.5 w-3.5" /><span className="hidden sm:inline">Transfer Out</span><span className="sm:hidden">Out</span>
          </TabsTrigger>
          <TabsTrigger value="transferin" className="text-xs sm:text-sm py-2.5 px-2 rounded-lg data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-sm gap-1.5">
            <Inbox className="h-3.5 w-3.5" /><span className="hidden sm:inline">Transfer In</span><span className="sm:hidden">In</span>
          </TabsTrigger>
          <TabsTrigger value="details" className="text-xs sm:text-sm py-2.5 px-2 rounded-lg data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-sm gap-1.5">
            <Package className="h-3.5 w-3.5" /><span className="hidden sm:inline">All Transfers</span><span className="sm:hidden">All</span>
          </TabsTrigger>
        </TabsList>

        {/* ════════════════ REQUEST TAB ════════════════ */}
        <TabsContent value="request" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm overflow-hidden">
            <SectionHeader title="Transfer Requests" count={totalRecords}
              onRefresh={() => loadRequests(currentPage)} isLoading={loading} />

            {loading ? <LoadingSkeleton /> : requests.length === 0 ? (
              <EmptyState icon={FileText} title="No requests yet"
                subtitle="Create your first transfer request to get started."
                action={() => router.push(`/${company}/transfer/request`)} actionLabel="Create Request" />
            ) : (
              <>
                {/* Mobile card list */}
                <div className="md:hidden divide-y">
                  {requests.map((req) => (
                    <div key={req.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{req.request_no}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(req.request_date)}</p>
                        </div>
                        {getStatusBadge(req.status)}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium bg-gray-100 px-2 py-1 rounded">{req.from_warehouse}</span>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                        <span className="font-medium bg-gray-100 px-2 py-1 rounded">{req.to_warehouse}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-700 border-blue-200">
                          {req.lines?.length || 0} Items
                        </Badge>
                        {req.lines?.slice(0, 1).map((line: any, idx: number) => (
                          <span key={idx} className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                            {line.item_description}
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" onClick={() => handleApproveRequest(req.id)}
                          disabled={req.status.toLowerCase() !== 'pending'}
                          className="flex-1 h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                          <CheckCircle className="h-3.5 w-3.5 mr-1.5" />Accept
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteRequest(req.id)}
                          disabled={req.status.toLowerCase() !== 'pending'}
                          className="h-9 w-9 p-0 border-red-200 hover:bg-red-50">
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50/80">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Request</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Route</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Items</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {requests.map((req) => (
                        <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <span className="text-sm font-medium text-gray-900">{req.request_no}</span>
                          </td>
                          <td className="py-3 px-4">{getStatusBadge(req.status)}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 text-sm">
                              <span className="font-medium">{req.from_warehouse}</span>
                              <ArrowRight className="h-3 w-3 text-gray-400" />
                              <span className="font-medium">{req.to_warehouse}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{formatDate(req.request_date)}</td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-700 border-blue-200">
                              {req.lines?.length || 0} Items
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button variant="outline" size="sm" onClick={() => handleApproveRequest(req.id)}
                                disabled={req.status.toLowerCase() !== 'pending'}
                                className="h-8 px-3 text-xs bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-700">
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />Accept
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteRequest(req.id)}
                                disabled={req.status.toLowerCase() !== 'pending'}
                                className="h-8 w-8 p-0 hover:bg-red-50">
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <PaginationBar page={currentPage} totalPages={totalPages} total={totalRecords} onPageChange={handlePageChange} />
          </Card>
        </TabsContent>

        {/* ════════════════ TRANSFER OUT TAB ════════════════ */}
        <TabsContent value="transferout" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm overflow-hidden">
            <SectionHeader title="Transfer Out Records" count={transfersTotal}
              onRefresh={() => loadTransfers(transfersPage)} isLoading={transfersLoading} />

            {transfersLoading ? <LoadingSkeleton /> : transfers.length === 0 ? (
              <EmptyState icon={Send} title="No outbound transfers"
                subtitle="Accept a request to create a transfer out." />
            ) : (
              <>
                {/* Mobile card list */}
                <div className="md:hidden divide-y">
                  {transfers.map((t) => (
                    <div key={t.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{t.challan_no}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(t.stock_trf_date)}</p>
                        </div>
                        {getStatusBadge(t.status)}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium bg-gray-100 px-2 py-1 rounded">{t.from_warehouse}</span>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                        <span className="font-medium bg-gray-100 px-2 py-1 rounded">{t.to_warehouse}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Truck className="h-3 w-3" />{t.vehicle_no}
                        </div>
                        <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-700 border-blue-200">
                          {t.items_count} Items
                        </Badge>
                        <Badge variant="outline" className="text-[11px] bg-violet-50 text-violet-700 border-violet-200">
                          {t.boxes_count} Boxes
                        </Badge>
                        {t.pending_items > 0 && (
                          <span className="text-[11px] font-medium text-orange-600">{t.pending_items} pending</span>
                        )}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm"
                          onClick={() => router.push(`/${company}/transfer/view/${t.id}`)}
                          className="h-9 text-xs flex-1">
                          <Eye className="h-3.5 w-3.5 mr-1.5" />View
                        </Button>
                        <Button variant="outline" size="sm"
                          onClick={() => router.push(`/${company}/transfer/dc/${t.id}`)}
                          className="h-9 text-xs flex-1 border-violet-200 hover:bg-violet-50 text-violet-700">
                          <Printer className="h-3.5 w-3.5 mr-1.5" />DC
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteTransfer(t.id)}
                          disabled={t.status === 'Received' || t.status === 'Completed'}
                          className="h-9 w-9 p-0 border-red-200 hover:bg-red-50">
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50/80">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Challan</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Route</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Vehicle</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Items/Boxes</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {transfers.map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">{t.challan_no}</td>
                          <td className="py-3 px-4">{getStatusBadge(t.status)}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 text-sm">
                              <span className="font-medium">{t.from_warehouse}</span>
                              <ArrowRight className="h-3 w-3 text-gray-400" />
                              <span className="font-medium">{t.to_warehouse}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{formatDate(t.stock_trf_date)}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 text-sm">
                              <Truck className="h-3.5 w-3.5 text-gray-400" />{t.vehicle_no}
                            </div>
                            {t.driver_name && <p className="text-xs text-muted-foreground mt-0.5">{t.driver_name}</p>}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-700 border-blue-200">{t.items_count} Items</Badge>
                              <Badge variant="outline" className="text-[11px] bg-violet-50 text-violet-700 border-violet-200">{t.boxes_count} Boxes</Badge>
                            </div>
                            {t.pending_items > 0 && <p className="text-[11px] text-orange-600 font-medium mt-1">{t.pending_items} pending</p>}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button variant="outline" size="sm"
                                onClick={() => router.push(`/${company}/transfer/view/${t.id}`)}
                                className="h-8 px-3 text-xs">
                                <Eye className="h-3.5 w-3.5 mr-1" />View
                              </Button>
                              <Button variant="outline" size="sm"
                                onClick={() => router.push(`/${company}/transfer/dc/${t.id}`)}
                                className="h-8 px-3 text-xs border-violet-200 hover:bg-violet-50 text-violet-700">
                                <Printer className="h-3.5 w-3.5 mr-1" />DC
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteTransfer(t.id)}
                                disabled={t.status === 'Received' || t.status === 'Completed'}
                                className="h-8 w-8 p-0 hover:bg-red-50">
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <PaginationBar page={transfersPage} totalPages={transfersTotalPages} total={transfersTotal} onPageChange={handleTransfersPageChange} />
          </Card>
        </TabsContent>

        {/* ════════════════ TRANSFER IN TAB ════════════════ */}
        <TabsContent value="transferin" className="mt-4 space-y-4">
          {/* Create Transfer IN CTA */}
          <Card className="border-0 shadow-sm bg-gradient-to-r from-teal-50 to-emerald-50">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-teal-500 flex items-center justify-center shrink-0">
                    <PackageCheck className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900">Receive Transfer (GRN)</h3>
                    <p className="text-xs text-muted-foreground">Scan a challan to receive stock and create a GRN</p>
                  </div>
                </div>
                <Button className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white h-10 px-5 text-sm shadow-sm"
                  onClick={() => router.push(`/${company}/transfer/transferIn`)}>
                  <Plus className="h-4 w-4 mr-2" />Create Transfer IN
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm overflow-hidden">
            <SectionHeader title="Transfer IN Records (GRNs)" count={transferInsTotal}
              onRefresh={() => loadTransferIns(transferInsPage)} isLoading={transferInsLoading} />

            {transferInsLoading ? <LoadingSkeleton /> : transferIns.length === 0 ? (
              <EmptyState icon={Inbox} title="No inbound transfers"
                subtitle="Receive a transfer to create a GRN record."
                action={() => router.push(`/${company}/transfer/transferIn`)} actionLabel="Create Transfer IN" />
            ) : (
              <>
                {/* Mobile card list */}
                <div className="md:hidden divide-y">
                  {transferIns.map((ti) => (
                    <div key={ti.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{ti.grn_number}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {ti.grn_date ? formatDate(new Date(ti.grn_date).toLocaleDateString('en-GB').replace(/\//g, '-')) : 'N/A'}
                          </p>
                        </div>
                        {getStatusBadge(ti.status)}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="text-muted-foreground">From:</span>
                        <span className="font-medium bg-gray-100 px-2 py-1 rounded">{ti.transfer_out_no}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-[10px] text-muted-foreground">Warehouse</p>
                          <p className="text-xs font-semibold">{ti.receiving_warehouse}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-[10px] text-muted-foreground">Boxes</p>
                          <p className="text-xs font-semibold">{ti.total_boxes_scanned}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-[10px] text-muted-foreground">Condition</p>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                            ti.box_condition === 'Good' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            ti.box_condition === 'Damaged' ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-orange-50 text-orange-700 border-orange-200'
                          }`}>{ti.box_condition || 'N/A'}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50/80">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">GRN No</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Transfer Out</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Warehouse</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Received By</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Condition</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Boxes</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {transferIns.map((ti) => (
                        <tr key={ti.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">{ti.grn_number}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{ti.transfer_out_no}</td>
                          <td className="py-3 px-4">{getStatusBadge(ti.status)}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{ti.receiving_warehouse}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{ti.received_by}</td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className={`text-[11px] px-2 py-0.5 ${
                              ti.box_condition === 'Good' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              ti.box_condition === 'Damaged' ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-orange-50 text-orange-700 border-orange-200'
                            }`}>{ti.box_condition || 'N/A'}</Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-[11px] bg-violet-50 text-violet-700 border-violet-200">
                              {ti.total_boxes_scanned} Boxes
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {ti.grn_date ? new Date(ti.grn_date).toLocaleDateString('en-GB', {
                              day: '2-digit', month: '2-digit', year: 'numeric'
                            }).replace(/\//g, '-') : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <PaginationBar page={transferInsPage} totalPages={transferInsTotalPages} total={transferInsTotal} onPageChange={handleTransferInsPageChange} />
          </Card>
        </TabsContent>

        {/* ════════════════ ALL TRANSFERS TAB ════════════════ */}
        <TabsContent value="details" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm overflow-hidden">
            <SectionHeader title="All Transfer Records" count={transfersTotal}
              onRefresh={() => loadTransfers(transfersPage)} isLoading={transfersLoading} />

            {transfersLoading ? <LoadingSkeleton /> : transfers.length === 0 ? (
              <EmptyState icon={Package} title="No transfers found"
                subtitle="Transfer records will appear here once transfers are created." />
            ) : (
              <>
                {/* Mobile card list */}
                <div className="md:hidden divide-y">
                  {transfers.map((t) => (
                    <div key={t.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{t.challan_no || t.transfer_no}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(t.stock_trf_date || t.transfer_date || t.created_ts)}</p>
                        </div>
                        {getStatusBadge(t.status)}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium bg-gray-100 px-2 py-1 rounded">{t.from_warehouse || t.from_site}</span>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                        <span className="font-medium bg-gray-100 px-2 py-1 rounded">{t.to_warehouse || t.to_site}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Truck className="h-3 w-3" />{t.vehicle_no || t.vehicle_number || 'N/A'}
                        </div>
                        <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-700 border-blue-200">
                          {t.items_count || 0} Items
                        </Badge>
                        <Badge variant="outline" className="text-[11px] bg-violet-50 text-violet-700 border-violet-200">
                          {t.boxes_count || 0} Boxes
                        </Badge>
                        {t.pending_items > 0 && (
                          <span className="text-[11px] font-medium text-orange-600">{t.pending_items} pending</span>
                        )}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm"
                          onClick={() => router.push(`/${company}/transfer/view/${t.id}`)}
                          className="h-9 text-xs flex-1">
                          <Eye className="h-3.5 w-3.5 mr-1.5" />View
                        </Button>
                        <Button variant="outline" size="sm"
                          onClick={() => router.push(`/${company}/transfer/dc/${t.id}`)}
                          className="h-9 text-xs flex-1 border-violet-200 hover:bg-violet-50 text-violet-700">
                          <Printer className="h-3.5 w-3.5 mr-1.5" />DC
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50/80">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Challan</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Route</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Vehicle</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Items/Boxes</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {transfers.map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">{t.challan_no || t.transfer_no}</td>
                          <td className="py-3 px-4">{getStatusBadge(t.status)}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 text-sm">
                              <span className="font-medium">{t.from_warehouse || t.from_site}</span>
                              <ArrowRight className="h-3 w-3 text-gray-400" />
                              <span className="font-medium">{t.to_warehouse || t.to_site}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{formatDate(t.stock_trf_date || t.transfer_date || t.created_ts)}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 text-sm">
                              <Truck className="h-3.5 w-3.5 text-gray-400" />{t.vehicle_no || t.vehicle_number || 'N/A'}
                            </div>
                            {t.driver_name && <p className="text-xs text-muted-foreground mt-0.5">{t.driver_name}</p>}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-700 border-blue-200">{t.items_count || 0} Items</Badge>
                              <Badge variant="outline" className="text-[11px] bg-violet-50 text-violet-700 border-violet-200">{t.boxes_count || 0} Boxes</Badge>
                            </div>
                            {t.pending_items > 0 && <p className="text-[11px] text-orange-600 font-medium mt-1">{t.pending_items} pending</p>}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button variant="outline" size="sm"
                                onClick={() => router.push(`/${company}/transfer/view/${t.id}`)}
                                className="h-8 px-3 text-xs">
                                <Eye className="h-3.5 w-3.5 mr-1" />View
                              </Button>
                              <Button variant="outline" size="sm"
                                onClick={() => router.push(`/${company}/transfer/dc/${t.id}`)}
                                className="h-8 px-3 text-xs border-violet-200 hover:bg-violet-50 text-violet-700">
                                <Printer className="h-3.5 w-3.5 mr-1" />DC
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <PaginationBar page={transfersPage} totalPages={transfersTotalPages} total={transfersTotal} onPageChange={handleTransfersPageChange} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
