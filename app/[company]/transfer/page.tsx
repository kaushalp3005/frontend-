"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Plus, Trash2, Loader2, RefreshCw, CheckCircle, Clock, Search, X,
  Truck, ArrowRightLeft, PackageCheck, FileText, ArrowRight,
  Package, ClipboardList, Send, Inbox, Eye, Printer, Pencil, Download, BarChart3
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { InterunitApiService, RequestResponse } from "@/lib/interunitApiService"
import type { Company } from "@/types/auth"
import { useAuthStore } from "@/lib/stores/auth"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getAllWarehouseCodes, getUserDefaultWarehouses, normalizeWarehouseName, getDisplayWarehouseName } from "@/lib/constants/warehouses"

type HoverLine = {
  name: string
  qty?: number | string
  netWeight?: number | string
  lotNumber?: string
  lotFrom?: string
  lotTo?: string
}

type HoverMeta = { label: string; value: string; tone?: "default" | "warn" | "success" }

function ChallanHoverCard({
  challanNo,
  from,
  to,
  reason,
  lines,
  fetchLines,
  meta,
  fetchMeta,
}: {
  challanNo: string
  from?: string
  to?: string
  reason?: string
  lines?: HoverLine[]
  fetchLines?: () => Promise<{ lines: HoverLine[]; meta?: HoverMeta[] }>
  meta?: HoverMeta[]
}) {
  const [show, setShow] = useState(false)
  const [fetched, setFetched] = useState<HoverLine[] | null>(null)
  const [fetchedMeta, setFetchedMeta] = useState<HoverMeta[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)

  const displayLines = fetched ?? lines
  const displayMeta = fetchedMeta ?? meta

  const computePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const CARD_WIDTH = 304
    const CARD_MAX_HEIGHT = 380
    const MARGIN = 12
    const GAP = 10
    const vw = window.innerWidth
    const vh = window.innerHeight

    // Horizontal: align with trigger, clamp to viewport
    let left = rect.left
    if (left + CARD_WIDTH > vw - MARGIN) left = Math.max(MARGIN, vw - CARD_WIDTH - MARGIN)
    if (left < MARGIN) left = MARGIN

    // Vertical: prefer ABOVE. If not enough room above, place below.
    const spaceAbove = rect.top - MARGIN
    const spaceBelow = vh - rect.bottom - MARGIN
    let top: number
    if (spaceAbove >= 160 || spaceAbove >= spaceBelow) {
      // place above — card's bottom aligns GAP above trigger's top
      const cardHeight = Math.min(CARD_MAX_HEIGHT, spaceAbove - GAP)
      top = rect.top - GAP - cardHeight
      if (top < MARGIN) top = MARGIN
    } else {
      top = rect.bottom + GAP
      if (top + CARD_MAX_HEIGHT > vh - MARGIN) top = Math.max(MARGIN, vh - CARD_MAX_HEIGHT - MARGIN)
    }
    setPos({ top, left })
  }, [])

  const open = useCallback(async () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    computePosition()
    setShow(true)
    if (fetchLines && fetched === null && !loading) {
      setLoading(true)
      try {
        const result = await fetchLines()
        setFetched(result.lines)
        if (result.meta) setFetchedMeta(result.meta)
      } catch { setFetched([]) }
      finally { setLoading(false) }
    }
  }, [fetchLines, fetched, loading, computePosition])

  const scheduleClose = useCallback(() => {
    hideTimer.current = setTimeout(() => setShow(false), 180)
  }, [])

  const cancelClose = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }, [])

  const toneClass = (t?: HoverMeta["tone"]) =>
    t === "warn" ? "text-amber-700 bg-amber-50 border-amber-200"
    : t === "success" ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : "text-gray-700 bg-gray-50 border-gray-200"

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={open}
        onMouseLeave={scheduleClose}
        className="text-sm font-semibold text-blue-700 cursor-default underline underline-offset-2 decoration-dotted decoration-blue-400"
      >
        {challanNo}
      </span>
      {show && typeof document !== "undefined" && createPortal(
        <div
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: 304,
            maxHeight: 380,
            background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 45%, #faf5ff 100%)",
            boxShadow: "0 20px 40px -10px rgba(79, 70, 229, 0.22), 0 8px 16px -4px rgba(236, 72, 153, 0.14), 0 0 0 1px rgba(147, 197, 253, 0.45)",
          }}
          className="z-[9999] rounded-2xl p-3 space-y-2.5 overflow-y-auto backdrop-blur-sm"
        >
          {(from || to) && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium max-w-[110px] truncate">{from || '—'}</span>
              <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium max-w-[110px] truncate">{to || from || '—'}</span>
            </div>
          )}

          {reason && (
            <div className="flex items-start gap-1.5 text-xs border-t border-gray-100 pt-2">
              <span className="text-gray-400 shrink-0 mt-0.5">Reason:</span>
              <span className="text-gray-700 font-medium leading-snug">{reason}</span>
            </div>
          )}

          {displayMeta && displayMeta.length > 0 && (
            <div className="flex flex-wrap gap-1 border-t border-gray-100 pt-2">
              {displayMeta.map((m, i) => (
                <span key={i} className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${toneClass(m.tone)}`}>
                  <span className="opacity-60">{m.label}:</span> {m.value}
                </span>
              ))}
            </div>
          )}

          <div className="border-t border-gray-100 pt-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Items</p>
            {loading ? (
              <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading items...
              </div>
            ) : displayLines && displayLines.length > 0 ? (
              <div className="space-y-1">
                {displayLines.map((line, i) => (
                  <div key={i} className="text-xs bg-white/70 border border-blue-100 rounded-lg px-2 py-1.5 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-gray-800 leading-snug">{line.name}</span>
                      {line.qty !== undefined && (
                        <span className="shrink-0 text-gray-500 text-[11px] tabular-nums">{line.qty} boxes</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5 text-[11px]">
                      {line.netWeight !== undefined && line.netWeight !== "" && (
                        <span className="text-gray-500">Wt: <span className="font-medium text-gray-700">{line.netWeight} kg</span></span>
                      )}
                      {line.lotNumber && (
                        <span className="font-mono text-indigo-600">Lot: {line.lotNumber}</span>
                      )}
                    </div>
                    {line.lotFrom && line.lotTo && (
                      <div className="flex items-center gap-1 text-[11px] font-mono mt-0.5">
                        <span className="text-gray-400">{line.lotFrom}</span>
                        <ArrowRight className="h-2.5 w-2.5 text-gray-300" />
                        <span className="text-orange-600 font-semibold">{line.lotTo}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 py-1">No item details available</p>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

interface TransferPageProps {
  params: {
    company: Company
  }
}

export default function TransferPage({ params }: TransferPageProps) {
  const { company } = params
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuthStore()
  const canDelete = user?.email === 'yash@candorfoods.in'
  const canDeleteInnerCold = user?.email === 'hrithik@candorfoods.in' || user?.email === 'yash@candorfoods.in'
  const [activeTab, setActiveTab] = useState("transferout")
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all")
  const [userDefaultWarehouses, setUserDefaultWarehouses] = useState<string[]>([])

  useEffect(() => {
    if (user?.name) {
      const defaults = getUserDefaultWarehouses(user.name)
      setUserDefaultWarehouses(defaults)
      if (defaults.length === 1) {
        setWarehouseFilter(defaults[0])
      } else if (defaults.length > 1) {
        setWarehouseFilter("my_warehouses")
      }
    }
  }, [user?.name])

  // State for requests data
  const [requests, setRequests] = useState<RequestResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [perPage] = useState(15)

  // State for inner cold transfers
  const [innerColdTransfers, setInnerColdTransfers] = useState<any[]>([])
  const [innerColdLoading, setInnerColdLoading] = useState(false)
  const [innerColdPage, setInnerColdPage] = useState(1)
  const [innerColdTotalPages, setInnerColdTotalPages] = useState(1)
  const [innerColdTotal, setInnerColdTotal] = useState(0)

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

  // Search state for each tab
  const [transferOutSearch, setTransferOutSearch] = useState("")
  const [requestSearch, setRequestSearch] = useState("")
  const [transferInSearch, setTransferInSearch] = useState("")

  // Load requests data
  const loadRequests = async (page: number = 1) => {
    setLoading(true)
    try {
      const response = await InterunitApiService.getRequests({
        page,
        per_page: perPage,
      })

      setRequests(response.records)
      setTotalPages(response.total_pages)
      setTotalRecords(response.total)
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

  // Load inner cold transfers
  const loadInnerColdTransfers = async (page: number = 1) => {
    setInnerColdLoading(true)
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/cold-storage/inner-transfer/list?page=${page}&per_page=${perPage}`
      const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
      if (res.ok) {
        const data = await res.json()
        setInnerColdTransfers(data.records || [])
        setInnerColdTotalPages(data.total_pages || 1)
        setInnerColdTotal(data.total || 0)
        setInnerColdPage(page)
      }
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to load inner cold transfers.", variant: "destructive" })
    } finally {
      setInnerColdLoading(false)
    }
  }

  useEffect(() => { loadRequests(1) }, [])

  useEffect(() => {
    if (activeTab === "transferout" && transfers.length === 0) loadTransfers(1)
    if (activeTab === "transferin" && transferIns.length === 0) loadTransferIns(1)
    if (activeTab === "innercold" && innerColdTransfers.length === 0) loadInnerColdTransfers(1)
    if (activeTab === "details" && transfers.length === 0) loadTransfers(1)
  }, [activeTab])


  const handlePageChange = (page: number) => { if (page >= 1 && page <= totalPages) loadRequests(page) }
  const handleTransfersPageChange = (page: number) => { if (page >= 1 && page <= transfersTotalPages) loadTransfers(page) }
  const handleTransferInsPageChange = (page: number) => { if (page >= 1 && page <= transferInsTotalPages) loadTransferIns(page) }
  const handleInnerColdPageChange = (page: number) => { if (page >= 1 && page <= innerColdTotalPages) loadInnerColdTransfers(page) }

  // Client-side search filter helper
  const searchMatch = (record: any, query: string, fields: string[]) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return fields.some(f => {
      const val = record[f]
      return val && String(val).toLowerCase().includes(q)
    })
  }

  // Warehouse filter helpers — "my_warehouses" sentinel matches any of the user's defaults;
  // all comparisons are normalized through normalizeWarehouseName so backend aliases match canonical codes.
  const myWarehouseSet = useMemo(
    () => new Set(userDefaultWarehouses.map(normalizeWarehouseName)),
    [userDefaultWarehouses],
  )
  const warehouseMatches = (...whs: (string | null | undefined)[]): boolean => {
    if (warehouseFilter === "all") return true
    const normalized = whs.filter(Boolean).map(w => normalizeWarehouseName(w as string))
    if (warehouseFilter === "my_warehouses") {
      if (userDefaultWarehouses.length === 0) return true
      return normalized.some(w => myWarehouseSet.has(w))
    }
    const target = normalizeWarehouseName(warehouseFilter)
    return normalized.some(w => w === target)
  }

  const filteredTransfers = transfers.filter(t => {
    if (!warehouseMatches(t.from_warehouse, t.to_warehouse)) return false
    return searchMatch(t, transferOutSearch, ["challan_no", "from_warehouse", "to_warehouse", "stock_trf_date", "status", "vehicle_no"])
  })
  const filteredRequests = requests.filter(r => {
    if (!warehouseMatches(r.from_warehouse, r.to_warehouse)) return false
    return searchMatch(r, requestSearch, ["request_no", "from_warehouse", "to_warehouse", "request_date", "status"])
  })
  const filteredTransferIns = transferIns.filter(t => {
    if (!warehouseMatches(t.from_warehouse, t.receiving_warehouse)) return false
    return searchMatch(t, transferInSearch, ["grn_number", "transfer_out_no", "receiving_warehouse", "from_warehouse", "received_by", "status", "grn_date"])
  })

  const handleApproveRequest = (requestId: number) => {
    router.push(`/${company}/transfer/transferform?requestId=${requestId}`)
  }

  const handleDeleteRequest = async (requestId: number) => {
    if (!confirm("Are you sure you want to delete this request?")) return
    try {
      const response = await InterunitApiService.deleteRequest(requestId, user?.email || '')
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
      const response = await InterunitApiService.deleteTransfer(transferId, user?.email || '')
      toast({ title: "Deleted", description: response.message || "Transfer deleted." })
      loadTransfers(transfersPage)
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.response?.data?.message || "Failed to delete transfer."
      toast({ title: "Error", description: String(msg), variant: "destructive" })
    }
  }

  const handleDeleteTransferIn = async (transferInId: number, grnNumber: string) => {
    if (!confirm(`Are you sure you want to delete Transfer IN "${grnNumber}"? This will also remove related cold storage entries.`)) return
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/interunit/transfer-in/${transferInId}?user_email=${encodeURIComponent(user?.email || '')}`
      const res = await fetch(apiUrl, { method: 'DELETE', headers: { 'Accept': 'application/json' } })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.detail || `Delete failed: ${res.status}`)
      }
      const data = await res.json()
      toast({ title: "Deleted", description: data.message || "Transfer IN deleted." })
      loadTransferIns(transferInsPage)
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete transfer IN.", variant: "destructive" })
    }
  }

  const handleDeleteInnerCold = async (challanNo: string) => {
    if (!confirm("Are you sure you want to delete this inner cold transfer?")) return
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/cold-storage/inner-transfer/${encodeURIComponent(challanNo)}?user_email=${encodeURIComponent(user?.email || '')}`
      const res = await fetch(apiUrl, { method: 'DELETE', headers: { 'Accept': 'application/json' } })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.detail || `Delete failed: ${res.status}`)
      }
      const data = await res.json()
      toast({ title: "Deleted", description: data.message || "Inner cold transfer deleted." })
      loadInnerColdTransfers(innerColdPage)
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete inner cold transfer.", variant: "destructive" })
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
      'completed':   { label: 'Dispatch',    cls: 'bg-yellow-50 text-yellow-700 border-yellow-300' },
      'dispatch':    { label: 'Dispatch',    cls: 'bg-yellow-50 text-yellow-700 border-yellow-300' },
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
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            className="flex-1 sm:flex-initial h-10 px-4 text-sm shadow-sm"
            onClick={() => router.push(`/${company}/transfer/dashboard`)}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            View Summary
          </Button>
          <Button
            className="flex-1 sm:flex-initial bg-gray-900 hover:bg-gray-800 text-white h-10 px-5 text-sm shadow-sm"
            onClick={() => router.push(`/${company}/transfer/request`)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        </div>
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
        <TabsList className="flex w-full overflow-x-auto gap-1 h-auto p-1 bg-white border shadow-sm rounded-xl">
          <TabsTrigger value="request" className="text-[11px] sm:text-sm py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-lg data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-sm gap-1 sm:gap-1.5 whitespace-nowrap flex-shrink-0">
            <FileText className="h-3.5 w-3.5" /><span className="hidden sm:inline">Requests</span><span className="sm:hidden">Req</span>
          </TabsTrigger>
          <TabsTrigger value="transferout" className="text-[11px] sm:text-sm py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-lg data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-sm gap-1 sm:gap-1.5 whitespace-nowrap flex-shrink-0">
            <Send className="h-3.5 w-3.5" /><span className="hidden sm:inline">Transfer Out</span><span className="sm:hidden">Out</span>
          </TabsTrigger>
          <TabsTrigger value="transferin" className="text-[11px] sm:text-sm py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-lg data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-sm gap-1 sm:gap-1.5 whitespace-nowrap flex-shrink-0">
            <Inbox className="h-3.5 w-3.5" /><span className="hidden sm:inline">Transfer In</span><span className="sm:hidden">In</span>
          </TabsTrigger>
          <TabsTrigger value="innercold" className="text-[11px] sm:text-sm py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-lg data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-sm gap-1 sm:gap-1.5 whitespace-nowrap flex-shrink-0">
            <PackageCheck className="h-3.5 w-3.5" /><span className="hidden sm:inline">Inner Cold</span><span className="sm:hidden">Cold</span>
          </TabsTrigger>
          <TabsTrigger value="details" className="text-[11px] sm:text-sm py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-lg data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-sm gap-1 sm:gap-1.5 whitespace-nowrap flex-shrink-0">
            <Package className="h-3.5 w-3.5" /><span className="hidden sm:inline">All Transfers</span><span className="sm:hidden">All</span>
          </TabsTrigger>
        </TabsList>

        {/* ════════════════ REQUEST TAB ════════════════ */}
        <TabsContent value="request" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm overflow-hidden">
            <SectionHeader title="Transfer Requests" count={totalRecords}
              onRefresh={() => loadRequests(currentPage)} isLoading={loading} />

            <div className="px-4 sm:px-5 py-2 border-b bg-gray-50/50">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative max-w-sm flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    value={requestSearch}
                    onChange={(e) => setRequestSearch(e.target.value)}
                    placeholder="Search request no, date, warehouse, status..."
                    className="h-8 pl-8 pr-8 text-xs bg-white"
                  />
                  {requestSearch && (
                    <button type="button" onClick={() => setRequestSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                  <SelectTrigger className="h-8 w-[140px] flex-shrink-0 text-xs bg-white">
                    <SelectValue placeholder="Warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Warehouses</SelectItem>
                    {userDefaultWarehouses.length > 1 && (
                      <SelectItem value="my_warehouses">My Warehouses ({userDefaultWarehouses.length})</SelectItem>
                    )}
                    {getAllWarehouseCodes().map((code) => (
                      <SelectItem key={code} value={code}>{getDisplayWarehouseName(code)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading ? <LoadingSkeleton /> : filteredRequests.length === 0 ? (
              <EmptyState icon={FileText} title={requestSearch ? "No matching requests" : "No requests yet"}
                subtitle={requestSearch ? "Try a different search term." : "Create your first transfer request to get started."}
                action={requestSearch ? undefined : () => router.push(`/${company}/transfer/request`)} actionLabel="Create Request" />
            ) : (
              <>
                {/* Mobile card list */}
                <div className="md:hidden divide-y">
                  {filteredRequests.map((req) => (
                    <div key={req.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <ChallanHoverCard
                            challanNo={req.request_no}
                            from={getDisplayWarehouseName(req.from_warehouse)}
                            to={getDisplayWarehouseName(req.to_warehouse)}
                            reason={req.status}
                            lines={req.lines?.map((l: any) => ({ name: l.item_description, qty: l.quantity }))}
                          />
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(req.request_date)}</p>
                        </div>
                        {getStatusBadge(req.status)}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium bg-gray-100 px-2 py-1 rounded">{getDisplayWarehouseName(req.from_warehouse)}</span>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                        <span className="font-medium bg-gray-100 px-2 py-1 rounded">{getDisplayWarehouseName(req.to_warehouse)}</span>
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
                        <Button variant="outline" size="sm" onClick={() => router.push(`/${company}/transfer/request/${req.id}`)}
                          className="h-9 w-9 p-0 border-gray-200 hover:bg-blue-50">
                          <Eye className="h-3.5 w-3.5 text-blue-600" />
                        </Button>
                        <Button size="sm" onClick={() => handleApproveRequest(req.id)}
                          disabled={req.status.toLowerCase() !== 'pending'}
                          className="flex-1 h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                          <CheckCircle className="h-3.5 w-3.5 mr-1.5" />Accept
                        </Button>
                        {canDelete && (
                          <Button variant="outline" size="sm" onClick={() => handleDeleteRequest(req.id)}
                            className="h-9 w-9 p-0 border-red-200 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        )}
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
                      {filteredRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <ChallanHoverCard
                              challanNo={req.request_no}
                              from={getDisplayWarehouseName(req.from_warehouse)}
                              to={getDisplayWarehouseName(req.to_warehouse)}
                              reason={req.status}
                              lines={req.lines?.map((l: any) => ({ name: l.item_description, qty: l.quantity }))}
                            />
                          </td>
                          <td className="py-3 px-4">{getStatusBadge(req.status)}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 text-sm">
                              <span className="font-medium">{getDisplayWarehouseName(req.from_warehouse)}</span>
                              <ArrowRight className="h-3 w-3 text-gray-400" />
                              <span className="font-medium">{getDisplayWarehouseName(req.to_warehouse)}</span>
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
                              <Button variant="ghost" size="sm" onClick={() => router.push(`/${company}/transfer/request/${req.id}`)}
                                className="h-8 w-8 p-0 hover:bg-blue-50">
                                <Eye className="h-3.5 w-3.5 text-blue-600" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleApproveRequest(req.id)}
                                disabled={req.status.toLowerCase() !== 'pending'}
                                className="h-8 px-3 text-xs bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-700">
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />Accept
                              </Button>
                              {canDelete && (
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteRequest(req.id)}
                                  className="h-8 w-8 p-0 hover:bg-red-50">
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </Button>
                              )}
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-5 py-3 sm:py-4 border-b bg-white">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Transfer Out Records</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{transfersTotal} record{transfersTotal !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                <Button
                  size="sm"
                  className="h-8 px-2.5 sm:px-3 text-[11px] sm:text-xs bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
                  onClick={() => router.push(`/${company}/transfer/directtransferform`)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  <span className="hidden sm:inline">Direct Transfer Out</span><span className="sm:hidden">Direct Out</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => loadTransfers(transfersPage)} disabled={transfersLoading}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground">
                  <RefreshCw className={`h-3.5 w-3.5 ${transfersLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline ml-1.5">Refresh</span>
                </Button>
              </div>
            </div>

            <div className="px-4 sm:px-5 py-2 border-b bg-gray-50/50">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative max-w-sm flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    value={transferOutSearch}
                    onChange={(e) => setTransferOutSearch(e.target.value)}
                    placeholder="Search challan, date, warehouse, status..."
                    className="h-8 pl-8 pr-8 text-xs bg-white"
                  />
                  {transferOutSearch && (
                    <button type="button" onClick={() => setTransferOutSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                  <SelectTrigger className="h-8 w-[140px] flex-shrink-0 text-xs bg-white">
                    <SelectValue placeholder="Warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Warehouses</SelectItem>
                    {userDefaultWarehouses.length > 1 && (
                      <SelectItem value="my_warehouses">My Warehouses ({userDefaultWarehouses.length})</SelectItem>
                    )}
                    {getAllWarehouseCodes().map((code) => (
                      <SelectItem key={code} value={code}>{getDisplayWarehouseName(code)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {transfersLoading ? <LoadingSkeleton /> : filteredTransfers.length === 0 ? (
              <EmptyState icon={Send} title={transferOutSearch ? "No matching records" : "No outbound transfers"}
                subtitle={transferOutSearch ? "Try a different search term." : "Accept a request to create a transfer out."} />
            ) : (
              <>
                {/* Mobile card list */}
                <div className="md:hidden divide-y">
                  {filteredTransfers.map((t) => (
                    <div key={t.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <ChallanHoverCard
                            challanNo={t.challan_no}
                            from={getDisplayWarehouseName(t.from_warehouse)}
                            to={getDisplayWarehouseName(t.to_warehouse)}
                            reason={t.status}
                            fetchLines={async () => {
                              const { accessToken } = useAuthStore.getState()
                              const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/interunit/transfers/${t.id}`
                              const res = await fetch(url, { headers: { Accept: 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) } })
                              if (!res.ok) return { lines: [] }
                              const data = await res.json()
                              let lines: HoverLine[] = (data.lines || []).map((l: any) => ({
                                name: l.item_description || l.article || 'Unknown',
                                qty: l.quantity,
                                netWeight: l.net_weight || l.total_weight || undefined,
                                lotNumber: l.lot_number || undefined,
                              }))
                              // Fallback: if no line items, group boxes by article+lot
                              if (lines.length === 0 && Array.isArray(data.boxes) && data.boxes.length > 0) {
                                const grouped = new Map<string, { name: string; qty: number; netWeight: number; lotNumber?: string }>()
                                for (const b of data.boxes) {
                                  const key = `${b.article || b.item_description || 'Unknown'}||${b.lot_number || ''}`
                                  const g = grouped.get(key) || { name: b.article || b.item_description || 'Unknown', qty: 0, netWeight: 0, lotNumber: b.lot_number || undefined }
                                  g.qty += 1
                                  g.netWeight += Number(b.net_weight || 0)
                                  grouped.set(key, g)
                                }
                                lines = Array.from(grouped.values()).map(g => ({
                                  name: g.name,
                                  qty: g.qty,
                                  netWeight: g.netWeight > 0 ? g.netWeight.toFixed(2) : undefined,
                                  lotNumber: g.lotNumber,
                                }))
                              }
                              const meta: HoverMeta[] = []
                              if (data.vehicle_no || data.vehicle_number) meta.push({ label: "Vehicle", value: data.vehicle_no || data.vehicle_number })
                              if (data.driver_name) meta.push({ label: "Driver", value: data.driver_name })
                              if (data.has_variance) meta.push({ label: "Variance", value: "Yes", tone: "warn" })
                              return { lines, meta }
                            }}
                          />
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(t.stock_trf_date)}</p>
                        </div>
                        {getStatusBadge(t.status)}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium bg-gray-100 px-2 py-1 rounded">{getDisplayWarehouseName(t.from_warehouse)}</span>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                        <span className="font-medium bg-gray-100 px-2 py-1 rounded">{getDisplayWarehouseName(t.to_warehouse)}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Truck className="h-3 w-3" />{t.vehicle_no}
                        </div>
                        <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-700 border-blue-200">
                          {t.items_count} Item{t.items_count !== 1 ? 's' : ''}
                        </Badge>
                        <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-700 border-amber-200">
                          Qty: {t.total_qty || 0}
                        </Badge>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm"
                          onClick={() => router.push(`/${company}/transfer/view/${t.id}`)}
                          className="h-9 text-xs flex-1">
                          <Eye className="h-3.5 w-3.5 mr-1.5" />View
                        </Button>
                        <Button variant="outline" size="sm"
                          onClick={() => router.push(`/${company}/transfer/directtransferform?editId=${t.id}`)}
                          disabled={t.status === 'Received' || t.status === 'Completed'}
                          className="h-9 text-xs flex-1 border-amber-200 hover:bg-amber-50 text-amber-700">
                          <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit
                        </Button>
                        <Button variant="outline" size="sm"
                          onClick={() => router.push(`/${company}/transfer/dc/${t.id}`)}
                          className="h-9 text-xs flex-1 border-violet-200 hover:bg-violet-50 text-violet-700">
                          <Printer className="h-3.5 w-3.5 mr-1.5" />DC
                        </Button>
                        {canDelete && (
                          <Button variant="outline" size="sm" onClick={() => handleDeleteTransfer(t.id)}
                            className="h-9 w-9 p-0 border-red-200 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        )}
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
                      {filteredTransfers.map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <ChallanHoverCard
                              challanNo={t.challan_no}
                              from={getDisplayWarehouseName(t.from_warehouse)}
                              to={getDisplayWarehouseName(t.to_warehouse)}
                              reason={t.status}
                              fetchLines={async () => {
                                const { accessToken } = useAuthStore.getState()
                                const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/interunit/transfers/${t.id}`
                                const res = await fetch(url, { headers: { Accept: 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) } })
                                if (!res.ok) return { lines: [] }
                                const data = await res.json()
                                let lines: HoverLine[] = (data.lines || []).map((l: any) => ({
                                  name: l.item_description || l.article || 'Unknown',
                                  qty: l.quantity,
                                  netWeight: l.net_weight || l.total_weight || undefined,
                                  lotNumber: l.lot_number || undefined,
                                }))
                                if (lines.length === 0 && Array.isArray(data.boxes) && data.boxes.length > 0) {
                                  const grouped = new Map<string, { name: string; qty: number; netWeight: number; lotNumber?: string }>()
                                  for (const b of data.boxes) {
                                    const key = `${b.article || b.item_description || 'Unknown'}||${b.lot_number || ''}`
                                    const g = grouped.get(key) || { name: b.article || b.item_description || 'Unknown', qty: 0, netWeight: 0, lotNumber: b.lot_number || undefined }
                                    g.qty += 1
                                    g.netWeight += Number(b.net_weight || 0)
                                    grouped.set(key, g)
                                  }
                                  lines = Array.from(grouped.values()).map(g => ({
                                    name: g.name,
                                    qty: g.qty,
                                    netWeight: g.netWeight > 0 ? g.netWeight.toFixed(2) : undefined,
                                    lotNumber: g.lotNumber,
                                  }))
                                }
                                const meta: HoverMeta[] = []
                                if (data.vehicle_no || data.vehicle_number) meta.push({ label: "Vehicle", value: data.vehicle_no || data.vehicle_number })
                                if (data.driver_name) meta.push({ label: "Driver", value: data.driver_name })
                                return { lines, meta }
                              }}
                            />
                          </td>
                          <td className="py-3 px-4">{getStatusBadge(t.status)}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 text-sm">
                              <span className="font-medium">{getDisplayWarehouseName(t.from_warehouse)}</span>
                              <ArrowRight className="h-3 w-3 text-gray-400" />
                              <span className="font-medium">{getDisplayWarehouseName(t.to_warehouse)}</span>
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
                              <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-700 border-blue-200">{t.items_count} Item{t.items_count !== 1 ? 's' : ''}</Badge>
                              <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-700 border-amber-200">Qty: {t.total_qty || 0}</Badge>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button variant="outline" size="sm"
                                onClick={() => router.push(`/${company}/transfer/view/${t.id}`)}
                                className="h-8 px-3 text-xs">
                                <Eye className="h-3.5 w-3.5 mr-1" />View
                              </Button>
                              <Button variant="outline" size="sm"
                                onClick={() => router.push(`/${company}/transfer/directtransferform?editId=${t.id}`)}
                                disabled={t.status === 'Received' || t.status === 'Completed'}
                                className="h-8 px-3 text-xs border-amber-200 hover:bg-amber-50 text-amber-700">
                                <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                              </Button>
                              <Button variant="outline" size="sm"
                                onClick={() => router.push(`/${company}/transfer/dc/${t.id}`)}
                                className="h-8 px-3 text-xs border-violet-200 hover:bg-violet-50 text-violet-700">
                                <Printer className="h-3.5 w-3.5 mr-1" />DC
                              </Button>
                              {canDelete && (
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteTransfer(t.id)}
                                  className="h-8 w-8 p-0 hover:bg-red-50">
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </Button>
                              )}
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
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white h-10 px-5 text-sm shadow-sm"
                    onClick={() => router.push(`/${company}/transfer/transferIn`)}>
                    <Plus className="h-4 w-4 mr-2" />Create Transfer IN
                  </Button>
                  
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm overflow-hidden">
            <SectionHeader title="Transfer IN Records (GRNs)" count={transferInsTotal}
              onRefresh={() => loadTransferIns(transferInsPage)} isLoading={transferInsLoading} />

            <div className="px-4 sm:px-5 py-2 border-b bg-gray-50/50">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative max-w-sm flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    value={transferInSearch}
                    onChange={(e) => setTransferInSearch(e.target.value)}
                    placeholder="Search GRN, transfer no, warehouse, status..."
                    className="h-8 pl-8 pr-8 text-xs bg-white"
                  />
                  {transferInSearch && (
                    <button type="button" onClick={() => setTransferInSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                  <SelectTrigger className="h-8 w-[140px] flex-shrink-0 text-xs bg-white">
                    <SelectValue placeholder="Warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Warehouses</SelectItem>
                    {userDefaultWarehouses.length > 1 && (
                      <SelectItem value="my_warehouses">My Warehouses ({userDefaultWarehouses.length})</SelectItem>
                    )}
                    {getAllWarehouseCodes().map((code) => (
                      <SelectItem key={code} value={code}>{getDisplayWarehouseName(code)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {transferInsLoading ? <LoadingSkeleton /> : filteredTransferIns.length === 0 ? (
              <EmptyState icon={Inbox} title={transferInSearch ? "No matching records" : "No inbound transfers"}
                subtitle={transferInSearch ? "Try a different search term." : "Receive a transfer to create a GRN record."}
                action={transferInSearch ? undefined : () => router.push(`/${company}/transfer/transferIn`)} actionLabel="Create Transfer IN" />
            ) : (
              <>
                {/* Mobile card list */}
                <div className="md:hidden divide-y">
                  {filteredTransferIns.map((ti) => (
                    <div key={ti.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <ChallanHoverCard
                            challanNo={ti.grn_number}
                            from={ti.from_warehouse || ti.transfer_out_no}
                            to={getDisplayWarehouseName(ti.receiving_warehouse)}
                            reason={ti.box_condition ? `Condition: ${ti.box_condition}` : ti.status}
                            fetchLines={async () => {
                              const { accessToken } = useAuthStore.getState()
                              const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/interunit/transfer-in/${ti.id}`
                              const res = await fetch(url, { headers: { Accept: 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) } })
                              if (!res.ok) return { lines: [{ name: `Transfer: ${ti.transfer_out_no}`, qty: ti.total_boxes_scanned }] }
                              const data = await res.json()
                              const boxes: any[] = data.boxes || []
                              const grouped = new Map<string, { name: string; qty: number; netWeight: number; lotNumber?: string; issues: number; unmatched: number }>()
                              for (const b of boxes) {
                                const key = `${b.article || 'Unknown'}||${b.lot_number || ''}`
                                const existing = grouped.get(key) || { name: b.article || 'Unknown', qty: 0, netWeight: 0, lotNumber: b.lot_number || undefined, issues: 0, unmatched: 0 }
                                existing.qty += 1
                                existing.netWeight += Number(b.net_weight || 0)
                                if (b.issue) existing.issues += 1
                                if (b.is_matched === false) existing.unmatched += 1
                                grouped.set(key, existing)
                              }
                              const lines: HoverLine[] = Array.from(grouped.values()).map(g => ({
                                name: g.name,
                                qty: g.qty,
                                netWeight: g.netWeight > 0 ? g.netWeight.toFixed(2) : undefined,
                                lotNumber: g.lotNumber,
                              }))
                              const meta: HoverMeta[] = []
                              if (data.received_by) meta.push({ label: "Received by", value: data.received_by })
                              if (data.box_condition) meta.push({ label: "Condition", value: data.box_condition, tone: data.box_condition === 'Good' ? 'success' : 'warn' })
                              const totalIssues = boxes.filter(b => b.issue).length
                              if (totalIssues > 0) meta.push({ label: "Issues", value: String(totalIssues), tone: "warn" })
                              const unmatchedCount = boxes.filter(b => b.is_matched === false).length
                              if (unmatchedCount > 0) meta.push({ label: "Unmatched", value: String(unmatchedCount), tone: "warn" })
                              if (data.status) meta.push({ label: "Status", value: data.status })
                              return {
                                lines: lines.length > 0 ? lines : [{ name: `Transfer: ${ti.transfer_out_no}`, qty: ti.total_boxes_scanned }],
                                meta,
                              }
                            }}
                          />
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {ti.grn_date ? formatDate(new Date(ti.grn_date).toLocaleDateString('en-GB').replace(/\//g, '-')) : 'N/A'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {getStatusBadge(ti.status)}
                          {ti.status?.toLowerCase() === "pending" ? (
                            <Button variant="outline" size="sm" onClick={() => router.push(`/${company}/transfer/transferIn?resume=${encodeURIComponent(ti.transfer_out_no)}`)} className="h-7 px-2 text-xs text-amber-700 border-amber-200 hover:bg-amber-50">
                              <ArrowRight className="h-3 w-3 mr-1" /> Resume
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => router.push(`/${company}/transfer/transferIn/${ti.id}`)} className="h-7 px-2 text-xs">
                              <Eye className="h-3 w-3 mr-1" /> View
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="outline" size="sm" onClick={() => handleDeleteTransferIn(ti.id, ti.grn_number)} className="h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="text-muted-foreground">From:</span>
                        <span className="font-medium bg-gray-100 px-2 py-1 rounded">{ti.transfer_out_no}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-[10px] text-muted-foreground">From</p>
                          <p className="text-xs font-semibold">{ti.from_warehouse || "N/A"}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-[10px] text-muted-foreground">To</p>
                          <p className="text-xs font-semibold">{getDisplayWarehouseName(ti.receiving_warehouse)}</p>
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
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">From WH</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">To WH</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Received By</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Condition</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Boxes</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredTransferIns.map((ti) => (
                        <tr key={ti.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <ChallanHoverCard
                              challanNo={ti.grn_number}
                              from={ti.from_warehouse || ti.transfer_out_no}
                              to={getDisplayWarehouseName(ti.receiving_warehouse)}
                              reason={ti.box_condition ? `Condition: ${ti.box_condition}` : ti.status}
                              fetchLines={async () => {
                              const { accessToken } = useAuthStore.getState()
                              const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/interunit/transfer-in/${ti.id}`
                              const res = await fetch(url, { headers: { Accept: 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) } })
                              if (!res.ok) return { lines: [{ name: `Transfer: ${ti.transfer_out_no}`, qty: ti.total_boxes_scanned }] }
                              const data = await res.json()
                              const boxes: any[] = data.boxes || []
                              // Group boxes by article+lot
                              const grouped = new Map<string, { name: string; qty: number; netWeight: number; lotNumber?: string; issues: number; unmatched: number }>()
                              for (const b of boxes) {
                                const key = `${b.article || 'Unknown'}||${b.lot_number || ''}`
                                const existing = grouped.get(key) || { name: b.article || 'Unknown', qty: 0, netWeight: 0, lotNumber: b.lot_number || undefined, issues: 0, unmatched: 0 }
                                existing.qty += 1
                                existing.netWeight += Number(b.net_weight || 0)
                                if (b.issue) existing.issues += 1
                                if (b.is_matched === false) existing.unmatched += 1
                                grouped.set(key, existing)
                              }
                              const lines: HoverLine[] = Array.from(grouped.values()).map(g => ({
                                name: g.name,
                                qty: g.qty,
                                netWeight: g.netWeight > 0 ? g.netWeight.toFixed(2) : undefined,
                                lotNumber: g.lotNumber,
                              }))
                              const meta: HoverMeta[] = []
                              if (data.received_by) meta.push({ label: "Received by", value: data.received_by })
                              if (data.box_condition) meta.push({ label: "Condition", value: data.box_condition, tone: data.box_condition === 'Good' ? 'success' : 'warn' })
                              const totalIssues = boxes.filter(b => b.issue).length
                              if (totalIssues > 0) meta.push({ label: "Issues", value: String(totalIssues), tone: "warn" })
                              const unmatchedCount = boxes.filter(b => b.is_matched === false).length
                              if (unmatchedCount > 0) meta.push({ label: "Unmatched", value: String(unmatchedCount), tone: "warn" })
                              if (data.status) meta.push({ label: "Status", value: data.status })
                              return {
                                lines: lines.length > 0 ? lines : [{ name: `Transfer: ${ti.transfer_out_no}`, qty: ti.total_boxes_scanned }],
                                meta,
                              }
                            }}
                            />
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{ti.transfer_out_no}</td>
                          <td className="py-3 px-4">{getStatusBadge(ti.status)}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{ti.from_warehouse || "N/A"}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{getDisplayWarehouseName(ti.receiving_warehouse)}</td>
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
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {ti.status?.toLowerCase() === "pending" ? (
                                <Button variant="outline" size="sm" onClick={() => router.push(`/${company}/transfer/transferIn?resume=${encodeURIComponent(ti.transfer_out_no)}`)} className="h-7 px-2.5 text-xs text-amber-700 border-amber-200 hover:bg-amber-50">
                                  <ArrowRight className="h-3 w-3 mr-1" /> Resume
                                </Button>
                              ) : (
                                <Button variant="outline" size="sm" onClick={() => router.push(`/${company}/transfer/transferIn/${ti.id}`)} className="h-7 px-2.5 text-xs">
                                  <Eye className="h-3 w-3 mr-1" /> View
                                </Button>
                              )}
                              {canDelete && (
                                <Button variant="outline" size="sm" onClick={() => handleDeleteTransferIn(ti.id, ti.grn_number)} className="h-7 px-2.5 text-xs text-red-600 border-red-200 hover:bg-red-50">
                                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                                </Button>
                              )}
                            </div>
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

        {/* ════════════════ INNER COLD TAB ════════════════ */}
        <TabsContent value="innercold" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-5 py-3 sm:py-4 border-b bg-white">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Inner Cold Transfers</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{innerColdTotal} record{innerColdTotal !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                <Button size="sm" onClick={() => router.push(`/${company}/transfer/innercoldtransfer`)}
                  className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  New Transfer
                </Button>
                <Button variant="ghost" size="sm" onClick={() => loadInnerColdTransfers(innerColdPage)} disabled={innerColdLoading}
                  className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground">
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${innerColdLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {innerColdLoading ? <LoadingSkeleton /> : innerColdTransfers.length === 0 ? (
              <EmptyState icon={PackageCheck} title="No inner cold transfers"
                subtitle="Inner cold transfer records will appear here once created."
                action={() => router.push(`/${company}/transfer/innercoldtransfer`)}
                actionLabel="New Inner Cold Transfer" />
            ) : (
              <>
                {/* Mobile card list */}
                <div className="md:hidden divide-y">
                  {innerColdTransfers.map((t: any) => (
                    <div key={t.challan_no} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <ChallanHoverCard
                            challanNo={t.challan_no}
                            from={t.from_warehouse}
                            reason={t.reason_code || t.remark}
                            lines={t.lines?.map((l: any) => ({ name: l.item_description, qty: l.quantity, lotFrom: String(l.old_lot_number), lotTo: String(l.new_lot_number) }))}
                          />
                          <p className="text-xs text-muted-foreground mt-0.5">{t.transfer_date || formatDate(t.created_at)}</p>
                        </div>
                        <Badge variant="outline" className="text-[11px] font-medium px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200">
                          {t.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium text-gray-700">{t.from_warehouse || 'N/A'}</span>
                        <span className="mx-1">|</span>
                        <span>{t.reason_code}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-700 border-blue-200">
                          {t.line_count} Item{t.line_count !== 1 ? 's' : ''}
                        </Badge>
                        <Badge variant="outline" className="text-[11px] bg-violet-50 text-violet-700 border-violet-200">
                          {t.total_boxes} Boxes
                        </Badge>
                      </div>
                      {/* Line details */}
                      <div className="space-y-1.5 pt-1">
                        {t.lines?.map((line: any, i: number) => (
                          <div key={i} className="text-xs bg-gray-50 rounded p-2 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium truncate">{line.item_description}</span>
                              <span className="text-gray-500 ml-2 shrink-0">{line.quantity} boxes</span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px]">
                              <span className="font-mono text-gray-400">{line.old_lot_number}</span>
                              <span className="text-gray-400">→</span>
                              <span className="font-mono font-semibold text-orange-700">{line.new_lot_number}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm"
                          onClick={() => router.push(`/${company}/transfer/innercoldtransfer?editChallan=${encodeURIComponent(t.challan_no)}`)}
                          className="flex-1 h-9 text-xs border-amber-200 hover:bg-amber-50 text-amber-700">
                          <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit
                        </Button>
                        {canDeleteInnerCold && (
                          <Button variant="outline" size="sm" onClick={() => handleDeleteInnerCold(t.challan_no)}
                            className="h-9 w-9 p-0 border-red-200 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50/80">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Challan No</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Cold Storage</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Reason</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Items</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Lot Changes</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {innerColdTransfers.map((t: any) => (
                        <tr key={t.challan_no} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <ChallanHoverCard
                              challanNo={t.challan_no}
                              from={t.from_warehouse}
                              reason={t.reason_code || t.remark}
                              lines={t.lines?.map((l: any) => ({ name: l.item_description, qty: l.quantity, lotFrom: String(l.old_lot_number), lotTo: String(l.new_lot_number) }))}
                            />
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{t.transfer_date || formatDate(t.created_at)}</td>
                          <td className="py-3 px-4 text-sm font-medium">{t.from_warehouse || 'N/A'}</td>
                          <td className="py-3 px-4">
                            <p className="text-sm">{t.reason_code}</p>
                            {t.remark && t.remark !== t.reason_code && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{t.remark}</p>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-700 border-blue-200">
                                {t.line_count ?? t.lines?.length ?? 0} Items
                              </Badge>
                              {t.lines?.[0] && (
                                <span className="text-xs text-gray-600 truncate max-w-[140px]">
                                  {t.lines[0].item_description}
                                  {(t.lines?.length ?? 0) > 1 && (
                                    <span className="text-gray-400 ml-1">+{t.lines.length - 1} more</span>
                                  )}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {t.lines?.[0] ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1 text-xs">
                                  <span className="font-mono text-gray-500">{t.lines[0].old_lot_number}</span>
                                  <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
                                  <span className="font-mono font-semibold text-orange-700">{t.lines[0].new_lot_number}</span>
                                </div>
                                {(t.lines?.length ?? 0) > 1 && (
                                  <span className="text-[11px] text-gray-400">+{t.lines.length - 1} more</span>
                                )}
                              </div>
                            ) : <span className="text-xs text-gray-400">—</span>}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-[11px] font-medium px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200">
                              {t.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button variant="outline" size="sm"
                                onClick={() => router.push(`/${company}/transfer/innercoldtransfer?editChallan=${encodeURIComponent(t.challan_no)}`)}
                                className="h-8 px-3 text-xs border-amber-200 hover:bg-amber-50 text-amber-700">
                                <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                              </Button>
                              {canDeleteInnerCold && (
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteInnerCold(t.challan_no)}
                                  className="h-8 w-8 p-0 hover:bg-red-50">
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <PaginationBar page={innerColdPage} totalPages={innerColdTotalPages} total={innerColdTotal} onPageChange={handleInnerColdPageChange} />
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
                          <ChallanHoverCard
                            challanNo={t.challan_no || t.transfer_no}
                            from={getDisplayWarehouseName(t.from_warehouse || t.from_site)}
                            to={getDisplayWarehouseName(t.to_warehouse || t.to_site)}
                            reason={t.status}
                            fetchLines={async () => {
                              const { accessToken } = useAuthStore.getState()
                              const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/interunit/transfers/${t.id}`
                              const res = await fetch(url, { headers: { Accept: 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) } })
                              if (!res.ok) return { lines: [] }
                              const data = await res.json()
                              let lines: HoverLine[] = (data.lines || []).map((l: any) => ({
                                name: l.item_description || l.article || 'Unknown',
                                qty: l.quantity,
                                netWeight: l.net_weight || l.total_weight || undefined,
                                lotNumber: l.lot_number || undefined,
                              }))
                              // Fallback: if no line items, group boxes by article+lot
                              if (lines.length === 0 && Array.isArray(data.boxes) && data.boxes.length > 0) {
                                const grouped = new Map<string, { name: string; qty: number; netWeight: number; lotNumber?: string }>()
                                for (const b of data.boxes) {
                                  const key = `${b.article || b.item_description || 'Unknown'}||${b.lot_number || ''}`
                                  const g = grouped.get(key) || { name: b.article || b.item_description || 'Unknown', qty: 0, netWeight: 0, lotNumber: b.lot_number || undefined }
                                  g.qty += 1
                                  g.netWeight += Number(b.net_weight || 0)
                                  grouped.set(key, g)
                                }
                                lines = Array.from(grouped.values()).map(g => ({
                                  name: g.name,
                                  qty: g.qty,
                                  netWeight: g.netWeight > 0 ? g.netWeight.toFixed(2) : undefined,
                                  lotNumber: g.lotNumber,
                                }))
                              }
                              const meta: HoverMeta[] = []
                              if (data.vehicle_no || data.vehicle_number) meta.push({ label: "Vehicle", value: data.vehicle_no || data.vehicle_number })
                              if (data.driver_name) meta.push({ label: "Driver", value: data.driver_name })
                              if (data.has_variance) meta.push({ label: "Variance", value: "Yes", tone: "warn" })
                              return { lines, meta }
                            }}
                          />
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
                          <td className="py-3 px-4">
                            <ChallanHoverCard
                              challanNo={t.challan_no || t.transfer_no}
                              from={getDisplayWarehouseName(t.from_warehouse || t.from_site)}
                              to={getDisplayWarehouseName(t.to_warehouse || t.to_site)}
                              reason={t.status}
                              fetchLines={async () => {
                              const { accessToken } = useAuthStore.getState()
                              const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/interunit/transfers/${t.id}`
                              const res = await fetch(url, { headers: { Accept: 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) } })
                              if (!res.ok) return { lines: [] }
                              const data = await res.json()
                              let lines: HoverLine[] = (data.lines || []).map((l: any) => ({
                                name: l.item_description || l.article || 'Unknown',
                                qty: l.quantity,
                                netWeight: l.net_weight || l.total_weight || undefined,
                                lotNumber: l.lot_number || undefined,
                              }))
                              // Fallback: if no line items, group boxes by article+lot
                              if (lines.length === 0 && Array.isArray(data.boxes) && data.boxes.length > 0) {
                                const grouped = new Map<string, { name: string; qty: number; netWeight: number; lotNumber?: string }>()
                                for (const b of data.boxes) {
                                  const key = `${b.article || b.item_description || 'Unknown'}||${b.lot_number || ''}`
                                  const g = grouped.get(key) || { name: b.article || b.item_description || 'Unknown', qty: 0, netWeight: 0, lotNumber: b.lot_number || undefined }
                                  g.qty += 1
                                  g.netWeight += Number(b.net_weight || 0)
                                  grouped.set(key, g)
                                }
                                lines = Array.from(grouped.values()).map(g => ({
                                  name: g.name,
                                  qty: g.qty,
                                  netWeight: g.netWeight > 0 ? g.netWeight.toFixed(2) : undefined,
                                  lotNumber: g.lotNumber,
                                }))
                              }
                              const meta: HoverMeta[] = []
                              if (data.vehicle_no || data.vehicle_number) meta.push({ label: "Vehicle", value: data.vehicle_no || data.vehicle_number })
                              if (data.driver_name) meta.push({ label: "Driver", value: data.driver_name })
                              if (data.has_variance) meta.push({ label: "Variance", value: "Yes", tone: "warn" })
                              return { lines, meta }
                            }}
                            />
                          </td>
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
                            </div>
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
