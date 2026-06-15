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
import { getAllWarehouseCodes, getUserDefaultWarehouses, normalizeWarehouseName, getDisplayWarehouseName, isColdWarehouse } from "@/lib/constants/warehouses"
import PendingTransfersModal from "@/components/transfer/PendingTransfersModal"
import { ChallanHoverCard, groupLinesByItem, groupBoxesByItem, type HoverLine, type HoverMeta } from "@/components/transfer/ChallanHoverCard"

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
  const [pendingModalOpen, setPendingModalOpen] = useState(false)

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

  // State for transfers data (ALL Transfers tab — server-paginated over every transfer)
  const [transfers, setTransfers] = useState<any[]>([])
  const [transfersLoading, setTransfersLoading] = useState(false)
  const [transfersPage, setTransfersPage] = useState(1)
  const [transfersTotalPages, setTransfersTotalPages] = useState(1)
  const [transfersTotal, setTransfersTotal] = useState(0)

  // State for the cold Transfer-OUT list (Transfer Out tab). This list is ALWAYS
  // cold-filtered client-side (isColdRelated) over the mixed cold+warehouse
  // interunit_transfers table, so server pagination would only surface the cold
  // subset of each 15-row page (the "1 of 15 is cold" bug). We bulk-fetch the full
  // set and filter + paginate client-side — exactly like the Transfer-In tab.
  const [coldOutRaw, setColdOutRaw] = useState<any[]>([])
  const [coldOutLoading, setColdOutLoading] = useState(false)
  const [coldOutPage, setColdOutPage] = useState(1)

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

  // Larger fetch size used when any filter is active so client-side filtering
  // sees ALL matching records (avoids the "filter on page 1 of N shows nothing"
  // bug). Pagination bar is hidden in this mode.
  const FILTER_FETCH_SIZE = 500
  // Transfer-In is always cold-filtered client-side, so we fetch in bulk and
  // paginate the filtered slice at 10 rows / page.
  const TRANSFER_IN_CLIENT_PAGE_SIZE = 10
  // Transfer-OUT is likewise always cold-filtered client-side. Bulk-fetch page
  // size (backend caps per_page at 1000) and the client-side page size for the
  // cold-filtered slice. loadColdOut pages through if the table exceeds one bulk page.
  const COLD_OUT_FETCH_SIZE = 1000
  const COLD_OUT_CLIENT_PAGE_SIZE = 15
  const requestsFilterActive =
    requestSearch.trim() !== "" || warehouseFilter !== "all"
  const transferOutFilterActive =
    transferOutSearch.trim() !== "" || warehouseFilter !== "all"
  const transferInFilterActive =
    transferInSearch.trim() !== "" || warehouseFilter !== "all"

  // Load requests data
  const loadRequests = async (page: number = 1) => {
    setLoading(true)
    try {
      const filtering = requestsFilterActive
      const response = await InterunitApiService.getRequests({
        page: filtering ? 1 : page,
        per_page: filtering ? FILTER_FETCH_SIZE : perPage,
      })

      setRequests(response.records)
      setTotalPages(filtering ? 1 : response.total_pages)
      setTotalRecords(response.total)
      setCurrentPage(filtering ? 1 : page)
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
      const filtering = transferOutFilterActive
      const response = await InterunitApiService.getTransfers({
        page: filtering ? 1 : page,
        per_page: filtering ? FILTER_FETCH_SIZE : perPage,
        sort_by: "created_ts",
        sort_order: "desc",
      })
      setTransfers(response.records || [])
      setTransfersTotalPages(filtering ? 1 : (response.total_pages || 1))
      setTransfersTotal(response.total || 0)
      setTransfersPage(filtering ? 1 : page)
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to load transfers.", variant: "destructive" })
    } finally {
      setTransfersLoading(false)
    }
  }

  // Load the cold Transfer-OUT list in bulk (cold filter is always on, so we
  // can't rely on server pagination — see coldOutRaw state above). Pages through
  // until the whole interunit_transfers table is retrieved so no cold record is
  // silently dropped, with a hard safety cap. Filtering + pagination happen
  // client-side via filteredTransfers / pagedColdOut below.
  const loadColdOut = async () => {
    setColdOutLoading(true)
    try {
      const all: any[] = []
      let page = 1
      let total = 0
      // Safety cap: 20 × 1000 = 20k headers, far beyond foreseeable volume.
      while (page <= 20) {
        const response = await InterunitApiService.getTransfers({
          page,
          per_page: COLD_OUT_FETCH_SIZE,
          sort_by: "created_ts",
          sort_order: "desc",
        })
        const recs = response.records || []
        all.push(...recs)
        total = response.total || all.length
        if (all.length >= total || recs.length === 0) break
        page += 1
      }
      setColdOutRaw(all)
      setTransfersTotal(total)
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to load transfers.", variant: "destructive" })
    } finally {
      setColdOutLoading(false)
    }
  }

  // Load transfer INs data
  const loadTransferIns = async (_page: number = 1) => {
    setTransferInsLoading(true)
    try {
      // Always fetch in bulk: the cold-storage filter runs client-side, so server
      // pagination would produce uneven post-filter page sizes. We slice the
      // filtered result at TRANSFER_IN_CLIENT_PAGE_SIZE rows per page below.
      const response = await InterunitApiService.getColdTransferIns({
        page: 1,
        per_page: FILTER_FETCH_SIZE,
        sort_by: "created_at",
        sort_order: "desc",
      })
      setTransferIns(response.records || [])
      setTransferInsTotal(response.total || 0)
      setTransferInsPage(1)
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
    if (activeTab === "transferout" && coldOutRaw.length === 0) loadColdOut()
    if (activeTab === "transferin" && transferIns.length === 0) loadTransferIns(1)
    if (activeTab === "innercold" && innerColdTransfers.length === 0) loadInnerColdTransfers(1)
    if (activeTab === "details" && transfers.length === 0) loadTransfers(1)
  }, [activeTab])

  // Re-fetch only when filter ACTIVE/INACTIVE toggles or warehouse filter changes.
  // Inside filter mode (per_page=500), all subsequent keystrokes filter client-side.
  useEffect(() => {
    loadRequests(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestsFilterActive, warehouseFilter])

  // All-Transfers tab still server-paginates, so it must re-fetch when the
  // active/warehouse filter toggles. The Transfer-Out tab filters coldOutRaw
  // client-side (no refetch) — we just reset to page 1 so a new filter never
  // strands the view on an out-of-range page.
  useEffect(() => {
    if (activeTab !== "details") return
    loadTransfers(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferOutFilterActive, warehouseFilter])

  useEffect(() => {
    setColdOutPage(1)
  }, [transferOutSearch, warehouseFilter])

  useEffect(() => {
    if (activeTab !== "transferin") return
    loadTransferIns(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferInFilterActive, warehouseFilter])


  const handlePageChange = (page: number) => { if (page >= 1 && page <= totalPages) loadRequests(page) }
  const handleTransfersPageChange = (page: number) => { if (page >= 1 && page <= transfersTotalPages) loadTransfers(page) }
  const handleColdOutPageChange = (page: number) => {
    // Client-side slicing only — no refetch. Clamped against the cold-filtered count.
    if (page >= 1 && page <= coldOutClientTotalPages) setColdOutPage(page)
  }
  const handleTransferInsPageChange = (page: number) => {
    // Client-side slicing only — no refetch. Page is clamped against the
    // cold-filtered count derived below.
    if (page >= 1 && page <= transferInsClientTotalPages) setTransferInsPage(page)
  }
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
    // Split each incoming candidate on commas so a transfer with from_cold_unit
    // like "Rishi, Savla D-39" surfaces under BOTH the Rishi and Savla D-39 chips.
    const flat: string[] = []
    for (const w of whs) {
      if (!w) continue
      for (const part of String(w).split(",")) {
        const trimmed = part.trim()
        if (trimmed) flat.push(trimmed)
      }
    }
    const normalized = flat.map(w => normalizeWarehouseName(w))
    if (warehouseFilter === "my_warehouses") {
      if (userDefaultWarehouses.length === 0) return true
      return normalized.some(w => myWarehouseSet.has(w))
    }
    const target = normalizeWarehouseName(warehouseFilter)
    return normalized.some(w => w === target)
  }

  // Cold-storage gate: a transfer is "cold-related" if any of its source/destination
  // warehouses is a cold warehouse (Savla D-39, Savla D-514, Rishi, Supreme), OR if
  // from_warehouse is the generic label "Cold Storage" and from_cold_unit names a cold sub.
  const isColdRelated = (...whs: (string | null | undefined)[]): boolean => {
    for (const w of whs) {
      if (!w) continue
      for (const part of String(w).split(",")) {
        const raw = part.trim()
        if (!raw) continue
        // Generic cold label: cold-source transfers store from_warehouse =
        // "Cold Storage" and the sub-cold on from_cold_unit — which is blank on
        // older rows. Treat the bare label as cold so those still surface
        // (otherwise ~93 cold-source transfers with from_cold_unit unset vanish).
        if (raw.toLowerCase().startsWith("cold storage")) return true
        const code = normalizeWarehouseName(raw)
        if (code && isColdWarehouse(code)) return true
      }
    }
    return false
  }

  // Route the Transfer-OUT "Edit" to the form that can actually edit it, by SOURCE class.
  // coldtransferform is cold-SOURCE only (backend edit_cold_transfer_out rejects non-cold
  // sources). A warehouse→cold transfer (e.g. A68 → Savla D-39) is warehouse-source and is
  // owned by the interunit directtransferform — so it must edit there, not here.
  const isColdSourceTransfer = (t: any) =>
    (!!t?.from_cold_unit && String(t.from_cold_unit).trim() !== "") ||
    isColdWarehouse(normalizeWarehouseName(t?.from_warehouse || t?.from_site || ""))
  const editTransferHref = (t: any) =>
    isColdSourceTransfer(t)
      ? `/${company}/cold-transfer/coldtransferform?editId=${t.id}`
      : `/${company}/transfer/directtransferform?editId=${t.id}`

  // Cold Transfer-OUT list: filter the bulk-fetched coldOutRaw (NOT the
  // server-paginated `transfers`, which the All-Transfers tab owns) down to
  // cold-related rows, then warehouse + search.
  const filteredTransfers = coldOutRaw.filter(t => {
    if (!isColdRelated(t.from_warehouse, t.to_warehouse, t.from_cold_unit)) return false
    // Pass from_cold_unit too so the Cold-sub chips (Savla D-39 / D-514 / Rishi /
    // Supreme Cold) match cold-source transfers whose from_warehouse is just
    // "Cold Storage". The header carries the canonical sub-cold(s) and
    // warehouseMatches handles comma-separated values.
    if (!warehouseMatches(t.from_warehouse, t.to_warehouse, t.from_cold_unit)) return false
    return searchMatch(t, transferOutSearch, ["challan_no", "from_warehouse", "to_warehouse", "from_cold_unit", "stock_trf_date", "status", "vehicle_no", "lot_numbers_text"])
  })
  // Client-side pagination for Transfer-Out (cold filter is always on).
  const coldOutClientTotal = filteredTransfers.length
  const coldOutClientTotalPages = Math.max(1, Math.ceil(coldOutClientTotal / COLD_OUT_CLIENT_PAGE_SIZE))
  const effectiveColdOutPage = Math.min(coldOutPage, coldOutClientTotalPages)
  const pagedColdOut = filteredTransfers.slice(
    (effectiveColdOutPage - 1) * COLD_OUT_CLIENT_PAGE_SIZE,
    effectiveColdOutPage * COLD_OUT_CLIENT_PAGE_SIZE,
  )
  const filteredRequests = requests.filter(r => {
    if (!warehouseMatches(r.from_warehouse, r.to_warehouse)) return false
    return searchMatch(r, requestSearch, ["request_no", "from_warehouse", "to_warehouse", "request_date", "status"])
  })
  const filteredTransferIns = transferIns.filter(t => {
    if (!isColdRelated(t.from_warehouse, t.receiving_warehouse, t.from_cold_unit)) return false
    if (!warehouseMatches(t.from_warehouse, t.receiving_warehouse, t.from_cold_unit)) return false
    return searchMatch(t, transferInSearch, ["grn_number", "transfer_out_no", "receiving_warehouse", "from_warehouse", "received_by", "status", "grn_date", "lot_numbers"])
  })
  // Client-side pagination for Transfer-In (cold filter is always on).
  const transferInsClientTotal = filteredTransferIns.length
  const transferInsClientTotalPages = Math.max(1, Math.ceil(transferInsClientTotal / TRANSFER_IN_CLIENT_PAGE_SIZE))
  const effectiveTransferInsPage = Math.min(transferInsPage, transferInsClientTotalPages)
  const pagedTransferIns = filteredTransferIns.slice(
    (effectiveTransferInsPage - 1) * TRANSFER_IN_CLIENT_PAGE_SIZE,
    effectiveTransferInsPage * TRANSFER_IN_CLIENT_PAGE_SIZE,
  )

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
      loadColdOut()
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.response?.data?.message || "Failed to delete transfer."
      toast({ title: "Error", description: String(msg), variant: "destructive" })
    }
  }

  const handleDeleteTransferIn = async (transferInId: number, grnNumber: string) => {
    if (!confirm(`Are you sure you want to delete Transfer IN "${grnNumber}"? This will also remove related cold storage entries.`)) return
    try {
      // Cold receipts live in cold_transfer_in_* — must use the cold delete endpoint.
      // The legacy /interunit/transfer-in delete never touches the cold tables and
      // would leave an orphaned cold header showing here.
      const data = await InterunitApiService.deleteColdTransferIn(transferInId, user?.email || '')
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
    // Two-state model only: Pending / Received. Any legacy 'Partially Received' (or
    // 'partial') is shown as Pending — a receipt is either fully received or it isn't.
    let s = status.toLowerCase()
    if (s === 'partially received' || s === 'partial') s = 'pending'
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

  // Source / destination display helpers. Handle both record shapes used across
  // this file (from_warehouse on Transfer Out list, from_site on the generic
  // All Transfers tab). The Transfer Records column shows ONLY the warehouse
  // name (e.g. "Cold Storage") — the sub-cold attribution belongs in the hover
  // card's Cold Unit meta chip and the per-lot chips, not the table route.
  const displayFromSite = (t: any) =>
    getDisplayWarehouseName(t?.from_warehouse || t?.from_site || "")
  const displayToSite = (t: any) =>
    getDisplayWarehouseName(t?.to_warehouse || t?.to_site || "")

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

  // In-transit count from pending_transfer_stock (refreshes on mount + when modal closes)
  const [inTransitCount, setInTransitCount] = useState<number>(0)
  const loadInTransitCount = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const res = await fetch(`${apiUrl}/interunit/pending-stock?company=${company.toLowerCase()}`)
      if (!res.ok) return
      const data = await res.json()
      setInTransitCount(Number(data?.total || 0))
    } catch {
      /* keep prior count on error */
    }
  }, [company])
  useEffect(() => { loadInTransitCount() }, [loadInTransitCount])
  // Refresh count whenever the modal closes (in case user took action elsewhere)
  useEffect(() => {
    if (!pendingModalOpen) loadInTransitCount()
  }, [pendingModalOpen, loadInTransitCount])

  // ── Reusable sub-components ──

  const StatCard = ({ icon: Icon, label, value, color, onClick }: { icon: any; label: string; value: number; color: string; onClick?: () => void }) => (
    <Card
      className={`border-0 shadow-sm bg-white ${onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all" : ""}`}
      onClick={onClick}
    >
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

  const PaginationBar = ({ page, totalPages: tp, total, onPageChange, pageSize = perPage }: {
    page: number; totalPages: number; total: number; onPageChange: (p: number) => void; pageSize?: number
  }) => (
    tp > 1 ? (
      <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t bg-gray-50/50 gap-2">
        <p className="text-xs text-muted-foreground">
          Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, total)} of {total}
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
            Cold Transfer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage cold stock transfers between warehouses</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            className="flex-1 sm:flex-initial h-10 px-4 text-sm shadow-sm border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
            onClick={() => setPendingModalOpen(true)}
          >
            <Clock className="h-4 w-4 mr-2" />
            Pending Transfers
          </Button>
          <Button
            variant="outline"
            className="flex-1 sm:flex-initial h-10 px-4 text-sm shadow-sm"
            onClick={() => router.push(`/${company}/transfer/dashboard`)}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            View Summary
          </Button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={ClipboardList} label="Requests" value={totalRecords} color="bg-blue-500" />
        <StatCard icon={Send} label="Transfers Out" value={transfersTotal} color="bg-violet-500" />
        <StatCard icon={Inbox} label="Transfers In" value={transferInsTotal} color="bg-teal-500" />
        <StatCard
          icon={Truck}
          label="In Transit"
          value={inTransitCount}
          color="bg-orange-500"
          onClick={() => setPendingModalOpen(true)}
        />
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex w-full overflow-x-auto gap-1 h-auto p-1 bg-white border shadow-sm rounded-xl">
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

        {/* ════════════════ TRANSFER OUT TAB ════════════════ */}
        <TabsContent value="transferout" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-5 py-3 sm:py-4 border-b bg-white">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Cold transfer-out Records</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{coldOutClientTotal} record{coldOutClientTotal !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                <Button
                  size="sm"
                  className="h-8 px-2.5 sm:px-3 text-[11px] sm:text-xs bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
                  onClick={() => router.push(`/${company}/cold-transfer/coldtransferform`)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  <span className="hidden sm:inline">Direct Transfer Out</span><span className="sm:hidden">Direct Out</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => loadColdOut()} disabled={coldOutLoading}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground">
                  <RefreshCw className={`h-3.5 w-3.5 ${coldOutLoading ? 'animate-spin' : ''}`} />
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

            {coldOutLoading ? <LoadingSkeleton /> : filteredTransfers.length === 0 ? (
              <EmptyState icon={Send} title={transferOutSearch ? "No matching records" : "No outbound transfers"}
                subtitle={transferOutSearch ? "Try a different search term." : "Accept a request to create a transfer out."} />
            ) : (
              <>
                {/* Mobile card list */}
                <div className="md:hidden divide-y">
                  {pagedColdOut.map((t) => (
                    <div key={t.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <ChallanHoverCard
                            challanNo={t.challan_no}
                            from={displayFromSite(t)}
                            to={getDisplayWarehouseName(t.to_warehouse)}
                            reason={t.remark || t.reason_code || undefined}
                            fetchLines={async () => {
                              const { accessToken } = useAuthStore.getState()
                              const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/interunit/transfers/${t.id}`
                              const res = await fetch(url, { headers: { Accept: 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) } })
                              if (!res.ok) return { lines: [] }
                              const data = await res.json()
                              const fromColdUnit: string | undefined = data.from_cold_unit || t.from_cold_unit || undefined
                              // Per-lot cold unit (lot_origin_unit) when the server can map it;
                              // otherwise fall back to the transfer's cold unit (fromColdUnit).
                              const lines = (data.boxes || []).length > 0
                                ? groupBoxesByItem(data.boxes, fromColdUnit)
                                : groupLinesByItem(data.lines || [], fromColdUnit)
                              const meta: HoverMeta[] = []
                              // Cold source shows per-lot (lot_origin_unit); falls back to fromColdUnit so the chip always shows for cold transfers
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
                        <span className="font-medium bg-gray-100 px-2 py-1 rounded">{displayFromSite(t)}</span>
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
                          onClick={() => router.push(editTransferHref(t))}
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
                <div className="hidden md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50/80">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Challan</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Route</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                        <th className="hidden lg:table-cell text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Vehicle</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Items/Boxes</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pagedColdOut.map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <ChallanHoverCard
                              challanNo={t.challan_no}
                              from={displayFromSite(t)}
                              to={getDisplayWarehouseName(t.to_warehouse)}
                              reason={t.remark || t.reason_code || undefined}
                              fetchLines={async () => {
                                const { accessToken } = useAuthStore.getState()
                                const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/interunit/transfers/${t.id}`
                                const res = await fetch(url, { headers: { Accept: 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) } })
                                if (!res.ok) return { lines: [] }
                                const data = await res.json()
                                const fromColdUnit: string | undefined = data.from_cold_unit || t.from_cold_unit || undefined
                                // Per-lot cold unit (lot_origin_unit) when the server can map it;
                                // otherwise fall back to the transfer's cold unit (fromColdUnit).
                                const lines = (data.boxes || []).length > 0
                                  ? groupBoxesByItem(data.boxes, fromColdUnit)
                                  : groupLinesByItem(data.lines || [], fromColdUnit)
                                const meta: HoverMeta[] = []
                                // Cold source shows per-lot (lot_origin_unit); falls back to fromColdUnit so the chip always shows for cold transfers
                                if (data.vehicle_no || data.vehicle_number) meta.push({ label: "Vehicle", value: data.vehicle_no || data.vehicle_number })
                                if (data.driver_name) meta.push({ label: "Driver", value: data.driver_name })
                                return { lines, meta }
                              }}
                            />
                          </td>
                          <td className="py-3 px-4">{getStatusBadge(t.status)}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 text-sm">
                              <span className="font-medium">{displayFromSite(t)}</span>
                              <ArrowRight className="h-3 w-3 text-gray-400" />
                              <span className="font-medium">{getDisplayWarehouseName(t.to_warehouse)}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{formatDate(t.stock_trf_date)}</td>
                          <td className="hidden lg:table-cell py-3 px-4">
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
                                onClick={() => router.push(editTransferHref(t))}
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
            <PaginationBar page={effectiveColdOutPage} totalPages={coldOutClientTotalPages} total={coldOutClientTotal} onPageChange={handleColdOutPageChange} pageSize={COLD_OUT_CLIENT_PAGE_SIZE} />
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
                    onClick={() => router.push(`/${company}/cold-transfer/coldtransfer-in`)}>
                    <Plus className="h-4 w-4 mr-2" />Create Transfer IN
                  </Button>
                  
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm overflow-hidden">
            <SectionHeader title="Transfer IN Records (GRNs)" count={transferInsClientTotal}
              onRefresh={() => loadTransferIns()} isLoading={transferInsLoading} />

            <div className="px-4 sm:px-5 py-2 border-b bg-gray-50/50">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative max-w-sm flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    value={transferInSearch}
                    onChange={(e) => setTransferInSearch(e.target.value)}
                    placeholder="Search GRN, transfer no, lot, warehouse, status..."
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
                action={transferInSearch ? undefined : () => router.push(`/${company}/cold-transfer/coldtransfer-in`)} actionLabel="Create Transfer IN" />
            ) : (
              <>
                {/* Mobile card list */}
                <div className="md:hidden divide-y">
                  {pagedTransferIns.map((ti) => (
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
                              const discrepancies = Array.from(discrepanciesMap.values()).map(d => ({
                                article: d.article,
                                lotNumber: d.lotNumber,
                                count: d.issueCount + d.unmatchedCount,
                                remarks: d.remarks ? String(d.remarks) : undefined,
                                netWeight: d.netWeights.length > 0 ? d.netWeights.reduce((a, b) => a + b, 0).toFixed(2) : undefined,
                                totalWeight: d.totalWeights.length > 0 ? d.totalWeights.reduce((a, b) => a + b, 0).toFixed(2) : undefined,
                                casePack: d.casePacks.length > 0 ? String(d.casePacks.find(cp => cp) || '') : undefined,
                                unmatched: d.unmatchedCount > 0 ? d.unmatchedCount : undefined,
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
                                discrepancies,
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
                            <Button variant="outline" size="sm" onClick={() => router.push(`/${company}/cold-transfer/coldtransfer-in?resume=${encodeURIComponent(ti.transfer_out_no)}`)} className="h-7 px-2 text-xs text-amber-700 border-amber-200 hover:bg-amber-50">
                              <ArrowRight className="h-3 w-3 mr-1" /> Resume
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => router.push(`/${company}/cold-transfer/coldtransfer-in/${ti.id}`)} className="h-7 px-2 text-xs">
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
                <div className="hidden md:block">
                  <table className="w-full table-fixed">
                    <colgroup>
                      <col className="w-[14%]" />
                      <col className="w-[13%]" />
                      <col className="w-[8%]" />
                      <col className="w-[9%]" />
                      <col className="w-[9%]" />
                      <col className="hidden xl:table-column w-[10%]" />
                      <col className="hidden xl:table-column w-[8%]" />
                      <col className="w-[8%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b bg-gray-50/80">
                        <th className="text-left py-2.5 px-2 text-[11px] font-semibold text-gray-600 uppercase tracking-wider">GRN No</th>
                        <th className="text-left py-2.5 px-2 text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Transfer Out</th>
                        <th className="text-left py-2.5 px-2 text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                        <th className="text-left py-2.5 px-2 text-[11px] font-semibold text-gray-600 uppercase tracking-wider">From</th>
                        <th className="text-left py-2.5 px-2 text-[11px] font-semibold text-gray-600 uppercase tracking-wider">To</th>
                        <th className="hidden xl:table-cell text-left py-2.5 px-2 text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Received By</th>
                        <th className="hidden xl:table-cell text-left py-2.5 px-2 text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Condition</th>
                        <th className="text-left py-2.5 px-2 text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Boxes</th>
                        <th className="text-left py-2.5 px-2 text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                        <th className="text-right py-2.5 px-2 text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pagedTransferIns.map((ti) => (
                        <tr key={ti.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-2.5 px-2 break-words">
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
                              const discrepanciesMap = new Map<string, { article: string; lotNumber?: string; issueCount: number; unmatchedCount: number; remarks?: string; netWeights: number[]; totalWeights: number[]; casePacks: string[] }>()
                              for (const b of boxes) {
                                const key = `${b.article || 'Unknown'}||${b.lot_number || ''}`
                                const existing = grouped.get(key) || { name: b.article || 'Unknown', qty: 0, netWeight: 0, lotNumber: b.lot_number || undefined, issues: 0, unmatched: 0 }
                                existing.qty += 1
                                existing.netWeight += Number(b.net_weight || 0)
                                if (b.issue) existing.issues += 1
                                if (b.is_matched === false) existing.unmatched += 1
                                grouped.set(key, existing)

                                if (b.issue || b.is_matched === false) {
                                  const discExisting = discrepanciesMap.get(key) || {
                                    article: b.article || 'Unknown',
                                    lotNumber: b.lot_number || undefined,
                                    issueCount: 0,
                                    unmatchedCount: 0,
                                    netWeights: [],
                                    totalWeights: [],
                                    casePacks: [],
                                  }
                                  if (b.issue) {
                                    discExisting.issueCount += 1
                                    discExisting.remarks = b.issue
                                  }
                                  if (b.is_matched === false) discExisting.unmatchedCount += 1
                                  if (b.net_weight) discExisting.netWeights.push(Number(b.net_weight))
                                  if (b.total_weight) discExisting.totalWeights.push(Number(b.total_weight))
                                  if (b.case_pack) discExisting.casePacks.push(b.case_pack)
                                  discrepanciesMap.set(key, discExisting)
                                }
                              }
                              const lines: HoverLine[] = Array.from(grouped.values()).map(g => ({
                                name: g.name,
                                qty: g.qty,
                                netWeight: g.netWeight > 0 ? g.netWeight.toFixed(2) : undefined,
                                lotNumber: g.lotNumber,
                              }))
                              const discrepancies = Array.from(discrepanciesMap.values()).map(d => ({
                                article: d.article,
                                lotNumber: d.lotNumber,
                                count: d.issueCount + d.unmatchedCount,
                                remarks: d.remarks ? String(d.remarks) : undefined,
                                netWeight: d.netWeights.length > 0 ? d.netWeights.reduce((a, b) => a + b, 0).toFixed(2) : undefined,
                                totalWeight: d.totalWeights.length > 0 ? d.totalWeights.reduce((a, b) => a + b, 0).toFixed(2) : undefined,
                                casePack: d.casePacks.length > 0 ? String(d.casePacks.find(cp => cp) || '') : undefined,
                                unmatched: d.unmatchedCount > 0 ? d.unmatchedCount : undefined,
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
                                discrepancies,
                              }
                            }}
                            />
                          </td>
                          <td className="py-2.5 px-2 text-sm text-gray-600 break-words">{ti.transfer_out_no}</td>
                          <td className="py-2.5 px-2 whitespace-nowrap">{getStatusBadge(ti.status)}</td>
                          <td className="py-2.5 px-2 text-sm text-gray-600 break-words">{ti.from_warehouse || "N/A"}</td>
                          <td className="py-2.5 px-2 text-sm text-gray-600 break-words">{getDisplayWarehouseName(ti.receiving_warehouse)}</td>
                          <td className="hidden xl:table-cell py-2.5 px-2 text-sm text-gray-600 break-words">{ti.received_by}</td>
                          <td className="hidden xl:table-cell py-2.5 px-2 whitespace-nowrap">
                            <Badge variant="outline" className={`text-[11px] px-2 py-0.5 ${
                              ti.box_condition === 'Good' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              ti.box_condition === 'Damaged' ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-orange-50 text-orange-700 border-orange-200'
                            }`}>{ti.box_condition || 'N/A'}</Badge>
                          </td>
                          <td className="py-2.5 px-2 whitespace-nowrap">
                            <Badge variant="outline" className="text-[11px] bg-violet-50 text-violet-700 border-violet-200">
                              {ti.total_boxes_scanned} Boxes
                            </Badge>
                          </td>
                          <td className="py-2.5 px-2 text-sm text-gray-600 whitespace-nowrap">
                            {ti.grn_date ? new Date(ti.grn_date).toLocaleDateString('en-GB', {
                              day: '2-digit', month: '2-digit', year: 'numeric'
                            }).replace(/\//g, '-') : 'N/A'}
                          </td>
                          <td className="py-2.5 px-1 text-right">
                            <div className="flex items-center justify-end gap-1 flex-wrap">
                              {ti.status?.toLowerCase() === "pending" ? (
                                <Button variant="outline" size="sm" onClick={() => router.push(`/${company}/cold-transfer/coldtransfer-in?resume=${encodeURIComponent(ti.transfer_out_no)}`)} className="h-7 w-7 p-0 text-amber-700 border-amber-200 hover:bg-amber-50" title="Resume">
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                              ) : (
                                <Button variant="outline" size="sm" onClick={() => router.push(`/${company}/cold-transfer/coldtransfer-in/${ti.id}`)} className="h-7 w-7 p-0" title="View">
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button variant="outline" size="sm" onClick={() => handleDeleteTransferIn(ti.id, ti.grn_number)} className="h-7 w-7 p-0 text-red-600 border-red-200 hover:bg-red-50" title="Delete">
                                  <Trash2 className="h-3.5 w-3.5" />
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
            <PaginationBar page={effectiveTransferInsPage} totalPages={transferInsClientTotalPages} total={transferInsClientTotal} onPageChange={handleTransferInsPageChange} pageSize={TRANSFER_IN_CLIENT_PAGE_SIZE} />
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
                <Button size="sm" onClick={() => router.push(`/${company}/cold-transfer/innercoldtransfer`)}
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
                action={() => router.push(`/${company}/cold-transfer/innercoldtransfer`)}
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
                            to={t.lines?.find((l: any) => l.new_storage_location)?.new_storage_location || undefined}
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
                          onClick={() => router.push(`/${company}/cold-transfer/innercoldtransfer?editChallan=${encodeURIComponent(t.challan_no)}`)}
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
                <div className="hidden md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50/80">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Challan No</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Cold Storage</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Reason</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Items</th>
                        <th className="hidden lg:table-cell text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Lot Changes</th>
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
                              to={t.lines?.find((l: any) => l.new_storage_location)?.new_storage_location || undefined}
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
                          <td className="hidden lg:table-cell py-3 px-4">
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
                                onClick={() => router.push(`/${company}/cold-transfer/innercoldtransfer?editChallan=${encodeURIComponent(t.challan_no)}`)}
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
                            from={displayFromSite(t)}
                            to={displayToSite(t)}
                            reason={t.remark || t.reason_code || undefined}
                            fetchLines={async () => {
                              const { accessToken } = useAuthStore.getState()
                              const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/interunit/transfers/${t.id}`
                              const res = await fetch(url, { headers: { Accept: 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) } })
                              if (!res.ok) return { lines: [] }
                              const data = await res.json()
                              const fromColdUnit: string | undefined = data.from_cold_unit || t.from_cold_unit || undefined
                              // Per-lot cold unit (lot_origin_unit) when the server can map it;
                              // otherwise fall back to the transfer's cold unit (fromColdUnit).
                              const lines = (data.boxes || []).length > 0
                                ? groupBoxesByItem(data.boxes, fromColdUnit)
                                : groupLinesByItem(data.lines || [], fromColdUnit)
                              const meta: HoverMeta[] = []
                              // Cold source shows per-lot (lot_origin_unit); falls back to fromColdUnit so the chip always shows for cold transfers
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
                        <span className="font-medium bg-gray-100 px-2 py-1 rounded">{displayFromSite(t)}</span>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                        <span className="font-medium bg-gray-100 px-2 py-1 rounded">{displayToSite(t)}</span>
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
                <div className="hidden md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50/80">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Challan</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Route</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                        <th className="hidden lg:table-cell text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Vehicle</th>
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
                              from={displayFromSite(t)}
                              to={displayToSite(t)}
                              reason={t.status}
                              fetchLines={async () => {
                              const { accessToken } = useAuthStore.getState()
                              const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/interunit/transfers/${t.id}`
                              const res = await fetch(url, { headers: { Accept: 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) } })
                              if (!res.ok) return { lines: [] }
                              const data = await res.json()
                              const fromColdUnit: string | undefined = data.from_cold_unit || t.from_cold_unit || undefined
                              // Per-lot cold unit (lot_origin_unit) when the server can map it;
                              // otherwise fall back to the transfer's cold unit (fromColdUnit).
                              const lines = (data.boxes || []).length > 0
                                ? groupBoxesByItem(data.boxes, fromColdUnit)
                                : groupLinesByItem(data.lines || [], fromColdUnit)
                              const meta: HoverMeta[] = []
                              // Cold source shows per-lot (lot_origin_unit); falls back to fromColdUnit so the chip always shows for cold transfers
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
                              <span className="font-medium">{displayFromSite(t)}</span>
                              <ArrowRight className="h-3 w-3 text-gray-400" />
                              <span className="font-medium">{displayToSite(t)}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{formatDate(t.stock_trf_date || t.transfer_date || t.created_ts)}</td>
                          <td className="hidden lg:table-cell py-3 px-4">
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

      <PendingTransfersModal
        open={pendingModalOpen}
        onClose={() => setPendingModalOpen(false)}
        company={company}
        userEmail={user?.email}
        userRole={
          user?.isDeveloper
            ? "developer"
            : user?.companies?.find((c) => c.code?.toLowerCase() === company.toLowerCase())?.role
        }
      />
    </div>
  )
}
