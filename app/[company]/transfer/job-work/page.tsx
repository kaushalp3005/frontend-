"use client"

import { useState, useEffect, useRef, useCallback, Fragment, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getDisplayWarehouseName, isColdWarehouse } from "@/lib/constants/warehouses"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  ArrowLeft, ArrowRight, Plus, Loader2, Search,
  Package, Send, Inbox, ClipboardList, Eye, CheckCircle,
  Truck, RefreshCw, Pencil, Printer, Trash2, AlertTriangle, Info,
  BarChart3, TrendingUp, Filter, Download, Activity, Users, Layers, Box,
  ChevronRight, ChevronDown
} from "lucide-react"
import QRCode from 'qrcode'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer } from "recharts"
import type { Company } from "@/types/auth"
import { ChallanHoverCard, type HoverLine, type HoverMeta } from "@/components/transfer/ChallanHoverCard"
import { useAuthStore } from "@/lib/stores/auth"
import { useToast } from "@/hooks/use-toast"
import { BoxScrollContainer } from "@/components/modules/inward/BoxScrollContainer"

// ─── Article Entry types ───
interface GeneratedArticle {
  transaction_no: string
  box_id: string
  box_number: number
  item_group: string
  sub_group: string
  item_description: string
  net_weight: number
  gross_weight: number
  // Cold storage fields
  vakkal: string
  lot_no: string
  item_mark: string
  storage_location: string
  exporter: string
  rate: number
  spl_remarks: string
  case_pack?: number          // units per box (UI label "Case Pack")
  box_type?: 'FG' | 'REJECTION'
  uom?: number                // per-unit weight snapshot from all_sku (kg/unit)
}

interface JobWorkPageProps {
  params: {
    company: Company
  }
}

// ─── Inward Receipt Item ───
interface IRItem {
  sl_no: number
  description: string
  sent_kgs: number
  sent_boxes: number
  // Cumulative from previous IRs
  prev_fg_kgs: number
  prev_waste_kgs: number
  prev_rejection_kgs: number
  // This batch inputs
  fg_kgs: number
  waste_kgs: number
  waste_type_desc: string
  rejection_kgs: number
  // Calculated
  total_accounted_kgs: number
  unaccounted_kgs: number
  loss_pct: number           // (waste + rejection) / sent * 100
  unaccounted_loss_pct: number // unaccounted / sent * 100
}

// ─── Loss Config ───
interface LossConfig {
  min_loss_pct: number
  max_loss_pct: number
  loss_component: string
  waste_with_partial: boolean
  single_shot: boolean
}

// ─── Job Work Record (for listing) ───
interface JobWorkRecord {
  id: number
  challan_no: string
  job_work_date: string
  from_warehouse: string
  to_party: string
  party_address: string
  status: string
  type: 'OUT' | 'IN'
  vehicle_no: string
  driver_name: string
  authorized_person: string
  remarks: string
  items_count: number
  item_descriptions: string
  total_qty: number
  total_weight: number
  total_net_weight: number
  created_by: string
  created_at: string
}

// ─── Status → receipts secondary hover ───
// On hover (mouse) / tap (touch) of a status that can have inward receipts,
// lazy-fetch and show a roll-up of what's been received and how many receipts.
// Statuses without receipts render the plain badge unchanged.
const RECEIPT_STATUSES = new Set(["partially_received", "fully_received", "reconciled", "closed"])

interface PriorIR {
  ir_number: string
  receipt_date: string
  receipt_type: string
  inward_warehouse: string
  total_fg_kgs: number
  total_waste_kgs: number
  total_rejection_kgs: number
}

interface JWLine { quantity_kgs: number; prev_fg_kgs: number; prev_waste_kgs: number; prev_rejection_kgs: number }
interface JWLossCfg { min_loss_pct: number; max_loss_pct: number }

function StatusReceiveHover({ rec, children }: { rec: JobWorkRecord; children: ReactNode }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; maxHeight: number }>({ left: 0, maxHeight: 420 })
  const [isTouch, setIsTouch] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<{ receive_count: number; prior_irs: PriorIR[]; line_items: JWLine[]; loss_config: JWLossCfg | null } | null>(null)
  const fetched = useRef(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)

  const interactive = RECEIPT_STATUSES.has(rec.status)
  const CARD_WIDTH = 320, MARGIN = 8, GAP = 6

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      setIsTouch(!window.matchMedia("(hover: hover)").matches)
    }
  }, [])

  const ensureData = useCallback(async () => {
    if (fetched.current) return
    fetched.current = true
    setLoading(true); setError(null)
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
      const res = await fetch(`${base}/job-work/out/search?challan_no=${encodeURIComponent(rec.challan_no)}`, { headers: { Accept: "application/json" } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      setData({ receive_count: d.receive_count || 0, prior_irs: d.prior_irs || [], line_items: d.line_items || [], loss_config: d.loss_config || null })
    } catch {
      setError("Couldn't load receipts")
      fetched.current = false // allow retry on next open
    } finally {
      setLoading(false)
    }
  }, [rec.challan_no])

  const computePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight
    let left = rect.left
    if (left + CARD_WIDTH > vw - MARGIN) left = Math.max(MARGIN, vw - CARD_WIDTH - MARGIN)
    if (left < MARGIN) left = MARGIN
    const spaceAbove = rect.top - MARGIN
    const spaceBelow = vh - rect.bottom - MARGIN
    const maxHeight = Math.min(420, spaceAbove >= spaceBelow ? spaceAbove - GAP : spaceBelow - GAP)
    if (spaceAbove >= spaceBelow && spaceAbove >= 100) setPos({ bottom: vh - rect.top + GAP, left, maxHeight })
    else setPos({ top: rect.bottom + GAP, left, maxHeight })
  }, [])

  const open = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    computePosition()
    setShow(true)
    ensureData()
  }, [computePosition, ensureData])

  const scheduleClose = useCallback(() => { hideTimer.current = setTimeout(() => setShow(false), 180) }, [])
  const cancelClose = useCallback(() => { if (hideTimer.current) clearTimeout(hideTimer.current) }, [])

  useEffect(() => {
    if (!show) return
    const onPointerDown = (e: Event) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t)) return
      if (document.getElementById(`jw-receipts-${rec.id}`)?.contains(t)) return
      setShow(false)
    }
    const onScrollResize = () => setShow(false)
    document.addEventListener("pointerdown", onPointerDown, true)
    window.addEventListener("scroll", onScrollResize, true)
    window.addEventListener("resize", onScrollResize)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true)
      window.removeEventListener("scroll", onScrollResize, true)
      window.removeEventListener("resize", onScrollResize)
    }
  }, [show, rec.id])

  if (!interactive) return <>{children}</>

  // Roll-up metrics. Sent = dispatched kgs (line_items); received/waste/rejection
  // are cumulative across all receipts. Percentages are against total sent.
  const sent = data?.line_items.reduce((s, l) => s + (l.quantity_kgs || 0), 0) ?? 0
  const fg = data?.prior_irs.reduce((s, ir) => s + (ir.total_fg_kgs || 0), 0) ?? 0
  const waste = data?.prior_irs.reduce((s, ir) => s + (ir.total_waste_kgs || 0), 0) ?? 0
  const rej = data?.prior_irs.reduce((s, ir) => s + (ir.total_rejection_kgs || 0), 0) ?? 0
  const unaccounted = Math.max(0, sent - fg - waste - rej)
  const pct = (n: number) => (sent > 0 ? (n / sent) * 100 : 0)
  const yieldPct = pct(fg)
  const lossPct = pct(waste + rej)
  const unaccPct = pct(unaccounted)
  const cfg = data?.loss_config
  const hasTol = !!cfg && (cfg.max_loss_pct > 0 || cfg.min_loss_pct > 0)
  let lossClass = "bg-slate-50 text-slate-600 border-slate-200"
  let toneLabel = ""
  if (hasTol && cfg) {
    if (lossPct > cfg.max_loss_pct + 0.001) { lossClass = "bg-red-50 text-red-700 border-red-200"; toneLabel = "Excess loss" }
    else if (lossPct < cfg.min_loss_pct - 0.001) { lossClass = "bg-amber-50 text-amber-700 border-amber-200"; toneLabel = "Below expected" }
    else { lossClass = "bg-emerald-50 text-emerald-700 border-emerald-200"; toneLabel = "Within range" }
  }

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={() => { if (!isTouch) open() }}
        onMouseLeave={() => { if (!isTouch) scheduleClose() }}
        onClick={() => { if (isTouch) (show ? setShow(false) : open()) }}
        className="inline-flex cursor-pointer"
        title="View receipts"
      >
        {children}
      </span>
      {show && typeof document !== "undefined" && createPortal(
        <div
          id={`jw-receipts-${rec.id}`}
          onMouseEnter={() => { if (!isTouch) cancelClose() }}
          onMouseLeave={() => { if (!isTouch) scheduleClose() }}
          style={{
            position: "fixed",
            ...(pos.bottom !== undefined ? { bottom: pos.bottom } : { top: pos.top }),
            left: pos.left,
            width: Math.min(CARD_WIDTH, window.innerWidth - MARGIN * 2),
            maxHeight: pos.maxHeight,
            zIndex: 9999,
            overflowY: "auto",
          }}
          className="rounded-lg border border-indigo-200/70 shadow-lg shadow-indigo-200/40 bg-gradient-to-br from-sky-50 via-indigo-50 to-violet-100 text-slate-800 text-xs"
        >
          <div className="px-3 py-2 border-b border-indigo-200/60 flex items-center justify-between gap-2">
            <span className="font-mono font-semibold text-indigo-900">{rec.challan_no}</span>
            <span className="text-[10px] font-semibold text-indigo-700 whitespace-nowrap">
              {loading ? "…" : `Receipts (${data?.receive_count ?? 0})`}
            </span>
          </div>
          <div className="px-3 py-2 space-y-1.5">
            {loading && (
              <div className="flex items-center gap-1.5 text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> Loading receipts…</div>
            )}
            {error && <div className="text-red-600">{error}</div>}
            {!loading && !error && data && data.receive_count === 0 && (
              <div className="text-slate-500 italic">No receipts recorded yet.</div>
            )}
            {!loading && !error && data && data.prior_irs.length > 0 && (
              <>
                {/* Roll-up summary with percentages */}
                <div className="rounded border border-indigo-100 bg-white/60 px-2 py-1.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Sent / Received (FG)</span>
                    <span className="font-semibold text-slate-800">{sent.toFixed(2)} / {fg.toFixed(2)} kg</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span className="px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">Yield {yieldPct.toFixed(1)}%</span>
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] ${lossClass}`}>Loss {lossPct.toFixed(1)}%</span>
                    {unaccounted > 0.0005 && (
                      <span className="px-1.5 py-0.5 rounded border bg-gray-50 text-gray-600 border-gray-200 text-[10px]">Unaccounted {unaccPct.toFixed(1)}%</span>
                    )}
                  </div>
                  {hasTol && cfg && (
                    <div className="text-[10px] text-slate-500">
                      Loss tolerance {cfg.min_loss_pct}–{cfg.max_loss_pct}%{toneLabel ? ` · ${toneLabel}` : ""}
                    </div>
                  )}
                </div>
                {data.prior_irs.map((ir, i) => (
                  <div key={ir.ir_number || i} className="rounded border border-indigo-100 bg-white/70 px-2 py-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-700">{ir.receipt_date}{ir.ir_number ? ` · ${ir.ir_number}` : ""}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${ir.receipt_type === "final" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                        {ir.receipt_type === "final" ? "Final" : "Partial"}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-600">
                      {ir.inward_warehouse && <span>WH: <span className="font-semibold text-indigo-700">{getDisplayWarehouseName(ir.inward_warehouse)}</span></span>}
                      <span>FG: <span className="font-semibold text-slate-800">{(ir.total_fg_kgs ?? 0).toFixed(2)} kg</span></span>
                      {ir.total_waste_kgs > 0 && <span>Waste: {ir.total_waste_kgs.toFixed(2)}</span>}
                      {ir.total_rejection_kgs > 0 && <span>Rej: {ir.total_rejection_kgs.toFixed(2)}</span>}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export default function JobWorkPage({ params }: JobWorkPageProps) {
  const { company } = params
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuthStore()
  const DELETE_ALLOWED_EMAILS = ["b.hrithik@candorfoods.in", "yash@candorfoods.in"]
  const canDelete = user?.email ? DELETE_ALLOWED_EMAILS.includes(user.email) : false

  const [activeTab, setActiveTab] = useState("records")

  // Deep-link: ?tab=summary (or reports / material-in / records) opens that tab.
  // Read once on mount (client-only) so the main dashboard can link straight here.
  useEffect(() => {
    if (typeof window === "undefined") return
    const t = new URLSearchParams(window.location.search).get("tab")
    if (t === "summary" || t === "reports") setActiveTab("reports")
    else if (t === "material-in" || t === "create-in") setActiveTab("create-in")
    else if (t === "records") setActiveTab("records")
  }, [])

  const now = new Date()
  const currentDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`

  // ════════════════════════════════════════
  //  MATERIAL IN (INWARD RECEIPT)
  // ════════════════════════════════════════
  const [miSearchChallan, setMiSearchChallan] = useState("")
  const [miChallanNo, setMiChallanNo] = useState("")
  const [miSearching, setMiSearching] = useState(false)
  const [miFoundRecord, setMiFoundRecord] = useState<any>(null)
  const [miInwardWarehouse, setMiInwardWarehouse] = useState("")
  const [miLossConfig, setMiLossConfig] = useState<LossConfig | null>(null)
  const [miReceiveCount, setMiReceiveCount] = useState(0)
  const [miItems, setMiItems] = useState<IRItem[]>([])
  const [miReceiptDate, setMiReceiptDate] = useState(currentDate)
  const [miVehicleNo, setMiVehicleNo] = useState("")
  const [miDriverName, setMiDriverName] = useState("")
  const [miRemarks, setMiRemarks] = useState("")
  const [miSubmitting, setMiSubmitting] = useState(false)
  const [expandedLossRows, setExpandedLossRows] = useState<Set<number>>(new Set())
  const [miPriorIRs, setMiPriorIRs] = useState<Array<{ ir_number: string; challan_no: string; receipt_date: string; receipt_type: string; total_fg_kgs: number; total_waste_kgs: number; total_rejection_kgs: number }>>([])

  // ════════════════════════════════════════
  //  ARTICLE ENTRY (Box ID + QR Generation)
  // ════════════════════════════════════════
  const [aeItemGroups, setAeItemGroups] = useState<string[]>([])
  const [aeSubGroups, setAeSubGroups] = useState<string[]>([])
  const [aeDescriptions, setAeDescriptions] = useState<string[]>([])
  const [aeSelectedGroup, setAeSelectedGroup] = useState("")
  const [aeSelectedSubGroup, setAeSelectedSubGroup] = useState("")
  const [aeSelectedDesc, setAeSelectedDesc] = useState("")
  const [aeQuantity, setAeQuantity] = useState<number>(0)
  const [aeNetWeight, setAeNetWeight] = useState<number>(0)
  const [aeGrossWeight, setAeGrossWeight] = useState<number>(0)
  const [aeUom,      setAeUom]      = useState<number>(0)                     // per-unit weight from all_sku
  const [aeCasePack, setAeCasePack] = useState<number>(0)                     // units per box
  const [aeBoxType,  setAeBoxType]  = useState<'FG' | 'REJECTION'>('FG')      // Entry Type toggle
  // Cold storage fields
  const [aeColdCompany, setAeColdCompany] = useState<string>(company.toUpperCase() === 'CDPL' ? 'cdpl' : 'cfpl')
  const [aeInwardDate, setAeInwardDate] = useState(() => {
    const d = new Date(); return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`
  })
  const [aeVakkal, setAeVakkal] = useState("")
  const [aeLotNo, setAeLotNo] = useState("")
  const [aeItemMark, setAeItemMark] = useState("")
  const [aeStorageLocation, setAeStorageLocation] = useState("")
  const [aeExporter, setAeExporter] = useState("")
  const [aeRate, setAeRate] = useState<number>(0)
  const [aeSplRemarks, setAeSplRemarks] = useState("")
  const [aeSearchText, setAeSearchText] = useState("")
  const [aeSearchResults, setAeSearchResults] = useState<Array<{ item_description: string; item_group: string; sub_group: string }>>([])
  const [aeSearching, setAeSearching] = useState(false)
  const [aeSearchOpen, setAeSearchOpen] = useState(false)
  const [aeLoadingGroups, setAeLoadingGroups] = useState(false)
  const [aeLoadingSubs, setAeLoadingSubs] = useState(false)
  const [aeLoadingDescs, setAeLoadingDescs] = useState(false)
  const [aeGeneratedArticles, setAeGeneratedArticles] = useState<GeneratedArticle[]>([])
  const [aePrintingQR, setAePrintingQR] = useState(false)

  // Load item groups from all_sku on mount
  useEffect(() => {
    const loadItemGroups = async () => {
      setAeLoadingGroups(true)
      try {
        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/all-sku-dropdown`
        const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
        if (!res.ok) throw new Error("Failed")
        const data = await res.json()
        setAeItemGroups(data.options?.item_categories || [])
      } catch { setAeItemGroups([]) }
      finally { setAeLoadingGroups(false) }
    }
    loadItemGroups()
  }, [company])

  const handleAeGroupChange = async (group: string) => {
    setAeSelectedGroup(group)
    setAeSelectedSubGroup("")
    setAeSelectedDesc("")
    setAeSubGroups([])
    setAeDescriptions([])
    if (!group) return
    setAeLoadingSubs(true)
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/all-sku-dropdown?item_category=${encodeURIComponent(group)}`
      const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setAeSubGroups(data.options?.sub_categories || [])
    } catch { setAeSubGroups([]) }
    finally { setAeLoadingSubs(false) }
  }

  const handleAeSubGroupChange = async (sub: string) => {
    setAeSelectedSubGroup(sub)
    setAeSelectedDesc("")
    setAeDescriptions([])
    if (!sub) return
    setAeLoadingDescs(true)
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/all-sku-dropdown?item_category=${encodeURIComponent(aeSelectedGroup)}&sub_category=${encodeURIComponent(sub)}`
      const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setAeDescriptions(data.options?.item_descriptions || [])
    } catch { setAeDescriptions([]) }
    finally { setAeLoadingDescs(false) }
  }

  // Search all_sku by item description (debounced)
  useEffect(() => {
    if (aeSearchText.trim().length < 2) { setAeSearchResults([]); setAeSearchOpen(false); return }
    const timer = setTimeout(async () => {
      setAeSearching(true)
      try {
        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/all-sku-search?search=${encodeURIComponent(aeSearchText.trim())}&limit=100`
        const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
        if (!res.ok) throw new Error("Failed")
        const data = await res.json()
        setAeSearchResults(data.items || [])
        setAeSearchOpen(true)
      } catch { setAeSearchResults([]) }
      finally { setAeSearching(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [aeSearchText])

  const handleAeSearchSelect = (item: { item_description: string; item_group: string; sub_group: string; uom?: string }) => {
    // Ensure the selected values exist in the dropdown options so Select renders them
    setAeItemGroups(prev => prev.includes(item.item_group) ? prev : [...prev, item.item_group])
    setAeSubGroups(prev => prev.includes(item.sub_group) ? prev : [item.sub_group, ...prev])
    setAeDescriptions(prev => prev.includes(item.item_description) ? prev : [item.item_description, ...prev])
    setAeSelectedGroup(item.item_group)
    setAeSelectedSubGroup(item.sub_group)
    setAeSelectedDesc(item.item_description)
    const parsedUom = parseFloat(String(item.uom || "").replace(/[^0-9.]/g, ""))
    setAeUom(isNaN(parsedUom) ? 0 : parsedUom)
    setAeSearchText("")
    setAeSearchResults([])
    setAeSearchOpen(false)
  }

  const round3 = (n: number) => Math.round(n * 1000) / 1000

  const onAePickerNetChange = (v: number) => {
    setAeNetWeight(v)
  }
  const onAePickerCasePackChange = (v: number) => {
    setAeCasePack(v)
  }

  // Article entry: total net weight of all boxes vs FG received
  const aeTotalNetWeight = aeGeneratedArticles.reduce((s, a) => s + a.net_weight, 0)
  const aeFgLimit  = miItems.reduce((s, i) => s + (i.fg_kgs || 0), 0)
  const aeRejLimit = miItems.reduce((s, i) => s + (i.rejection_kgs || 0), 0)
  const aeUsedFg   = aeGeneratedArticles
    .filter(a => (a.box_type ?? 'FG') === 'FG')
    .reduce((s, a) => s + (a.net_weight || 0), 0)
  const aeUsedRej  = aeGeneratedArticles
    .filter(a => a.box_type === 'REJECTION')
    .reduce((s, a) => s + (a.net_weight || 0), 0)

  // Generate transaction number + box IDs
  const generateArticleEntries = () => {
    if (!aeSelectedDesc || aeQuantity < 1) {
      toast({ title: "Missing Fields", description: "Select item description and enter quantity (min 1).", variant: "destructive" })
      return
    }
    // Validate against the matching per-bucket cap (FG or Rejection)
    const _limit = aeBoxType === 'REJECTION' ? aeRejLimit : aeFgLimit
    const _used  = aeBoxType === 'REJECTION' ? aeUsedRej  : aeUsedFg
    const _label = aeBoxType === 'REJECTION' ? 'Rejection' : 'FG Received'
    if (_limit > 0) {
      const newTotal = _used + (aeNetWeight * aeQuantity)
      if (newTotal > _limit + 0.01) {
        toast({
          title: `Weight Exceeds ${_label}`,
          description: `Total ${_label.toLowerCase()} box net wt (${newTotal.toFixed(2)} kg) would exceed ${_label} (${_limit.toFixed(2)} kg).`,
          variant: "destructive",
        })
        return
      }
    }
    const now = new Date()
    const txnNo = `TR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`
    const base = String(Date.now()).slice(-8)

    const entries: GeneratedArticle[] = []
    for (let i = 1; i <= aeQuantity; i++) {
      entries.push({
        transaction_no: txnNo,
        box_id: `${base}-${i}`,
        box_number: i,
        item_group: aeSelectedGroup,
        sub_group: aeSelectedSubGroup,
        item_description: aeSelectedDesc,
        net_weight: aeNetWeight,
        gross_weight: aeGrossWeight,
        vakkal: aeVakkal,
        lot_no: aeLotNo,
        item_mark: aeItemMark,
        storage_location: aeStorageLocation,
        exporter: aeExporter,
        rate: aeRate,
        spl_remarks: aeSplRemarks,
        case_pack: aeCasePack,
        box_type:  aeBoxType,
        uom:       aeUom,
      })
    }
    setAeGeneratedArticles(prev => [...prev, ...entries])
    toast({ title: "Articles Generated", description: `${aeQuantity} box entries created with Txn: ${txnNo}` })
    // Reset qty
    setAeQuantity(0)
    setAeNetWeight(0)
    setAeGrossWeight(0)
  }

  // Print QR label — exact same format as inward QR (QR left, info right, 4"×2")
  const handlePrintArticleQR = async (singleIndex?: number) => {
    const articles = singleIndex !== undefined ? [aeGeneratedArticles[singleIndex]] : aeGeneratedArticles
    if (articles.length === 0) return
    setAePrintingQR(true)

    try {
      const companyLabel = company.toUpperCase()
      const entryDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })

      // Build label HTML for each article
      let labelsHtml = ''
      for (const art of articles) {
        const qrDataString = JSON.stringify({ tx: art.transaction_no, bi: art.box_id })
        const qrDataURL = await QRCode.toDataURL(qrDataString, { width: 170, margin: 1, errorCorrectionLevel: 'M' })

        labelsHtml += `
          <div class="label">
            <div class="qr"><img src="${qrDataURL}" /></div>
            <div class="info">
              <div>
                <div class="company">${companyLabel}</div>
                <div class="txn">${art.transaction_no}</div>
                <div class="boxid">ID: ${art.box_id}</div>
              </div>
              <div class="item">${art.item_description}</div>
              ${art.box_type === 'REJECTION' ? '<div style="background:#fde2e2;color:#9b1c1c;font-weight:700;text-align:center;padding:2px 4px;border:1px solid #f3b1b1;border-radius:3px;font-size:10px;margin:2px 0;">OFF-GRADE / REJECTION</div>' : ''}
              <div>
                <div class="detail"><b>Box #${art.box_number}</b> &nbsp; Net: ${art.net_weight > 0 ? art.net_weight + 'kg' : '\u2014'} &nbsp; Gross: ${art.gross_weight > 0 ? art.gross_weight + 'kg' : '\u2014'}</div>
                <div class="detail">Entry: ${entryDate}</div>
              </div>
              <div class="lot">${art.item_group} \u00b7 ${art.sub_group}</div>
            </div>
          </div>`
      }

      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.left = '-9999px'
      iframe.style.top = '-9999px'
      iframe.style.width = '0'
      iframe.style.height = '0'
      document.body.appendChild(iframe)

      const doc = iframe.contentWindow?.document
      if (!doc) { setAePrintingQR(false); document.body.removeChild(iframe); return }

      doc.open()
      doc.write(`<!DOCTYPE html><html><head><title>Label</title><style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 4in; overflow: hidden; background: white; }
        @page { size: 4in 2in; margin: 0; padding: 0; }
        @media print {
          html, body { width: 4in; overflow: hidden; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .label { width: 4in; height: 2in; background: white; border: 1px solid #000; display: flex; font-family: Arial, sans-serif; overflow: hidden; page-break-after: always; page-break-inside: avoid; }
        .label:last-child { page-break-after: auto; }
        .qr { width: 2in; height: 100%; display: flex; align-items: center; justify-content: center; padding: 0.1in; }
        .qr img { width: 1.7in; height: 1.7in; }
        .info { width: 2in; height: 100%; padding: 0.08in; font-size: 8pt; line-height: 1.2; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; }
        .company { font-weight: bold; font-size: 9pt; }
        .txn { font-family: monospace; font-size: 7pt; }
        .boxid { font-family: monospace; font-size: 6.5pt; color: #555; }
        .item { font-weight: bold; font-size: 7.5pt; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .detail { font-size: 7pt; }
        .lot { font-family: monospace; border-top: 1px solid #ccc; padding-top: 2px; font-size: 6.5pt; }
      </style></head><body>${labelsHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.onafterprint = function() { window.parent.postMessage('print-complete', '*'); };
            }, 300);
          };
        </script>
      </body></html>`)
      doc.close()

      const cleanup = (e: MessageEvent) => {
        if (e.data === 'print-complete') {
          window.removeEventListener('message', cleanup)
          if (document.body.contains(iframe)) document.body.removeChild(iframe)
          setAePrintingQR(false)
        }
      }
      window.addEventListener('message', cleanup)
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe)
        window.removeEventListener('message', cleanup)
        setAePrintingQR(false)
      }, 30000)
    } catch (err) {
      console.error('QR print failed:', err)
      setAePrintingQR(false)
    }
  }

  // Material In records listing
  const [miRecords, setMiRecords] = useState<any[]>([])
  const [miRecordsLoading, setMiRecordsLoading] = useState(false)
  const [miRecordsPage, setMiRecordsPage] = useState(1)
  const [miRecordsTotal, setMiRecordsTotal] = useState(0)
  const [miRecordsTotalPages, setMiRecordsTotalPages] = useState(1)
  // Material In records: client-side finetune (search / type / sort)
  const [miRecSearch, setMiRecSearch] = useState("")
  const [miRecType, setMiRecType] = useState<"all" | "partial" | "final">("all")
  const [miRecSort, setMiRecSort] = useState<"date_desc" | "date_asc" | "fg_desc" | "challan">("date_desc")
  const miFilteredRecords = (() => {
    const q = miRecSearch.toLowerCase().trim()
    let list = miRecords.filter((r: any) => {
      if (miRecType !== "all" && (r.receipt_type || "partial") !== miRecType) return false
      if (q && !`${r.challan_no || ""} ${r.jwo_challan || ""} ${r.to_party || ""} ${r.ir_number || ""}`.toLowerCase().includes(q)) return false
      return true
    })
    const cmp: Record<string, (a: any, b: any) => number> = {
      date_desc: (a, b) => String(b.receipt_date).localeCompare(String(a.receipt_date)),
      date_asc: (a, b) => String(a.receipt_date).localeCompare(String(b.receipt_date)),
      fg_desc: (a, b) => (Number(b.total_fg_kgs) || 0) - (Number(a.total_fg_kgs) || 0),
      challan: (a, b) => String(a.jwo_challan || a.challan_no).localeCompare(String(b.jwo_challan || b.challan_no)),
    }
    return [...list].sort(cmp[miRecSort])
  })()

  // View inward receipt detail
  const [viewIROpen, setViewIROpen] = useState(false)
  const [viewIRData, setViewIRData] = useState<any>(null)
  const [viewIRLoading, setViewIRLoading] = useState(false)

  const handleViewIR = async (irId: number) => {
    setViewIRLoading(true)
    setViewIROpen(true)
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/material-in/${irId}`
      const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) throw new Error("Failed to load receipt details")
      const data = await res.json()
      setViewIRData(data)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
      setViewIROpen(false)
    } finally {
      setViewIRLoading(false)
    }
  }

  const loadMiRecords = async (page: number = 1) => {
    setMiRecordsLoading(true)
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/material-in/list?page=${page}&per_page=500`
      const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) throw new Error("Failed to load")
      const data = await res.json()
      setMiRecords(data.records || [])
      setMiRecordsTotal(data.total || 0)
      setMiRecordsTotalPages(data.total_pages || 1)
      setMiRecordsPage(page)
    } catch {
      setMiRecords([])
    } finally {
      setMiRecordsLoading(false)
    }
  }

  const handleDeleteMiRecord = async (id: number, irNumber: string) => {
    if (!confirm(`Delete inward receipt "${irNumber}"?`)) return
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/material-in/${id}?user_email=${encodeURIComponent(user?.email || '')}`
      const res = await fetch(apiUrl, { method: 'DELETE' })
      if (!res.ok) throw new Error("Delete failed")
      toast({ title: "Deleted", description: `${irNumber} deleted successfully` })
      loadMiRecords(miRecordsPage)
    } catch {
      toast({ title: "Error", description: "Failed to delete record", variant: "destructive" })
    }
  }

  // Search for outward record by challan number
  const handleSearchMaterialOut = async () => {
    if (!miSearchChallan.trim()) {
      toast({ title: "Search Required", description: "Enter challan number to search.", variant: "destructive" })
      return
    }
    setMiSearching(true)
    setMiFoundRecord(null)
    setMiItems([])
    setMiLossConfig(null)
    setMiReceiveCount(0)
    try {
      const params = new URLSearchParams({ challan_no: miSearchChallan.trim() })
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/out/search?${params.toString()}`
      const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.detail || `Not found (${res.status})`)
      }
      const data = await res.json()
      const record = data.record
      if (!record) throw new Error("No record found")

      setMiFoundRecord(record)
      setMiInwardWarehouse(record.from_warehouse || "")
      setMiLossConfig(data.loss_config || null)
      setMiReceiveCount(data.receive_count || 0)
      setMiPriorIRs(data.prior_irs || [])

      const lines = data.line_items || []
      const processType = (record.sub_category || "").toLowerCase()
      const lossConfig = data.loss_config as LossConfig | null

      setMiItems(lines.map((line: any, idx: number) => {
        // Dispatched qty must use NET weight first; gross/quantity_kgs is only
        // a fallback for legacy records where net_weight is empty/0.
        const sentKgs = Number(line.net_weight || line.quantity_kgs || 0)
        const sentBoxes = Number(line.quantity_boxes || 0)
        const prevFg = Number(line.prev_fg_kgs || 0)
        const prevWaste = Number(line.prev_waste_kgs || 0)
        const prevRejection = Number(line.prev_rejection_kgs || 0)
        const totalAccounted = prevFg + prevWaste + prevRejection
        const unaccounted = parseFloat((sentKgs - totalAccounted).toFixed(3))

        return {
          sl_no: line.sl_no || idx + 1,
          description: line.item_description || "",
          sent_kgs: sentKgs,
          sent_boxes: sentBoxes,
          prev_fg_kgs: prevFg,
          prev_waste_kgs: prevWaste,
          prev_rejection_kgs: prevRejection,
          fg_kgs: 0,
          waste_kgs: 0,
          waste_type_desc: "",
          rejection_kgs: 0,
          total_accounted_kgs: totalAccounted,
          unaccounted_kgs: unaccounted,
          loss_pct: 0,
          unaccounted_loss_pct: sentKgs > 0 ? parseFloat(((unaccounted / sentKgs) * 100).toFixed(2)) : 0,
        }
      }))

      toast({ title: "Record Found", description: `Challan ${record.challan_no} loaded — ${lines.length} item(s), ${data.receive_count || 0} prior IR(s)` })
    } catch (error: any) {
      toast({ title: "Not Found", description: error.message || "No matching record found.", variant: "destructive" })
    } finally {
      setMiSearching(false)
    }
  }

  // Add Stock — pre-fill material-in form from a record's challan and switch to Material In tab
  const handleAddStock = (challanNo: string) => {
    setMiSearchChallan(challanNo)
    setMiFoundRecord(null)
    setMiItems([])
    setMiLossConfig(null)
    setMiReceiveCount(0)
    setMiChallanNo("")
    setMiVehicleNo("")
    setMiDriverName("")
    setMiRemarks("")
    setActiveTab("create-in")
    // Trigger search after state updates
    setTimeout(async () => {
      try {
        const params = new URLSearchParams({ challan_no: challanNo.trim() })
        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/out/search?${params.toString()}`
        const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
        if (!res.ok) throw new Error("Not found")
        const data = await res.json()
        const record = data.record
        if (!record) throw new Error("No record found")

        setMiFoundRecord(record)
        setMiInwardWarehouse(record.from_warehouse || "")
        setMiSearchChallan(challanNo)
        setMiLossConfig(data.loss_config || null)
        setMiReceiveCount(data.receive_count || 0)
        setMiPriorIRs(data.prior_irs || [])

        const lines = data.line_items || []
        setMiItems(lines.map((line: any, idx: number) => {
          // Dispatched qty must use NET weight first; gross/quantity_kgs is only
        // a fallback for legacy records where net_weight is empty/0.
        const sentKgs = Number(line.net_weight || line.quantity_kgs || 0)
          const sentBoxes = Number(line.quantity_boxes || 0)
          const prevFg = Number(line.prev_fg_kgs || 0)
          const prevWaste = Number(line.prev_waste_kgs || 0)
          const prevRejection = Number(line.prev_rejection_kgs || 0)
          const totalAccounted = prevFg + prevWaste + prevRejection
          const unaccounted = parseFloat((sentKgs - totalAccounted).toFixed(3))
          return {
            sl_no: line.sl_no || idx + 1,
            description: line.item_description || "",
            sent_kgs: sentKgs,
            sent_boxes: sentBoxes,
            prev_fg_kgs: prevFg,
            prev_waste_kgs: prevWaste,
            prev_rejection_kgs: prevRejection,
            fg_kgs: 0,
            waste_kgs: 0,
            waste_type_desc: "",
            rejection_kgs: 0,
            total_accounted_kgs: totalAccounted,
            unaccounted_kgs: unaccounted,
            loss_pct: 0,
            unaccounted_loss_pct: sentKgs > 0 ? parseFloat(((unaccounted / sentKgs) * 100).toFixed(2)) : 0,
          }
        }))
        toast({ title: "Record Loaded", description: `${challanNo} loaded — ready for next inward receipt` })
      } catch {
        toast({ title: "Error", description: "Failed to load record. Try searching manually.", variant: "destructive" })
      }
    }, 100)
  }

  // Update item quantities — recalculate totals
  const updateIRItem = (idx: number, field: 'fg_kgs' | 'waste_kgs' | 'rejection_kgs', value: number) => {
    setMiItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      const totalFg = updated.prev_fg_kgs + updated.fg_kgs
      const totalWaste = updated.prev_waste_kgs + updated.waste_kgs
      const totalRejection = updated.prev_rejection_kgs + updated.rejection_kgs
      updated.total_accounted_kgs = parseFloat((totalFg + totalWaste + totalRejection).toFixed(3))
      updated.unaccounted_kgs = parseFloat((updated.sent_kgs - updated.total_accounted_kgs).toFixed(3))
      updated.loss_pct = updated.sent_kgs > 0 ? parseFloat((((updated.waste_kgs + updated.rejection_kgs) / updated.sent_kgs) * 100).toFixed(2)) : 0
      updated.unaccounted_loss_pct = updated.sent_kgs > 0 ? parseFloat(((updated.unaccounted_kgs / updated.sent_kgs) * 100).toFixed(2)) : 0
      return updated
    }))
  }

  const updateIRItemWasteDesc = (idx: number, value: string) => {
    setMiItems(prev => prev.map((item, i) => i !== idx ? item : { ...item, waste_type_desc: value }))
  }

  // Validation
  const validateMaterialIn = (): string[] => {
    const errors: string[] = []
    if (!miChallanNo.trim()) errors.push("Inward Challan No is required")
    const hasAnyInput = miItems.some(i => i.fg_kgs > 0 || i.waste_kgs > 0 || i.rejection_kgs > 0)
    if (!hasAnyInput) errors.push("Enter received quantity for at least one item")

    // Check if any item exceeds dispatched quantity
    for (const item of miItems) {
      if (item.total_accounted_kgs > item.sent_kgs * 1.001) {
        errors.push(`${item.description}: Total received (${item.total_accounted_kgs.toFixed(2)} kg) exceeds dispatched (${item.sent_kgs.toFixed(2)} kg)`)
      }
    }

    return errors
  }

  // Get loss tolerance status
  const getLossToleranceStatus = () => {
    if (!miLossConfig) return null
    const totalSent = miItems.reduce((s, i) => s + i.sent_kgs, 0)
    const totalUnaccounted = miItems.reduce((s, i) => s + i.unaccounted_kgs, 0)
    if (totalSent === 0) return null
    const lossPct = (totalUnaccounted / totalSent) * 100

    if (lossPct >= miLossConfig.min_loss_pct && lossPct <= miLossConfig.max_loss_pct) {
      return { status: "normal", label: "Within Expected Range", color: "bg-emerald-50 text-emerald-700 border-emerald-200" }
    } else if (lossPct < miLossConfig.min_loss_pct) {
      return { status: "underweight", label: "Below Expected — Possible Vendor Retention", color: "bg-amber-50 text-amber-700 border-amber-200" }
    } else {
      return { status: "excess", label: "Excess Loss — Needs Review", color: "bg-red-50 text-red-700 border-red-200" }
    }
  }

  // Submit
  const handleSubmitMaterialIn = async (e: React.FormEvent, receiptType: "partial" | "final" = "partial") => {
    e.preventDefault()
    if (!miFoundRecord) return

    const errors = validateMaterialIn()
    if (errors.length > 0) {
      toast({ title: `Validation Error (${errors.length})`, description: errors.join(" • "), variant: "destructive" })
      return
    }

    setMiSubmitting(true)
    const payload = {
      challan_no: miChallanNo.trim(),
      original_challan_no: miFoundRecord.challan_no,
      original_record_id: miFoundRecord.id,
      receipt_type: receiptType,
      received_date: miReceiptDate,
      vehicle_no: miVehicleNo,
      driver_name: miDriverName,
      remarks: miRemarks,
      inward_warehouse: miInwardWarehouse || miFoundRecord.from_warehouse || "",
      cold_company: isColdStorageInward ? aeColdCompany : "",
      cold_inward_date: isColdStorageInward ? aeInwardDate : "",
      loss_config: miLossConfig ? {
        process_type: miFoundRecord?.sub_category || "",
        min_loss_pct: miLossConfig.min_loss_pct,
        max_loss_pct: miLossConfig.max_loss_pct,
        loss_component: miLossConfig.loss_component,
        waste_with_partial: miLossConfig.waste_with_partial,
        single_shot: miLossConfig.single_shot,
      } : undefined,
      items: miItems.map(item => ({
        sl_no: item.sl_no,
        description: item.description,
        sent_kgs: item.sent_kgs,
        sent_boxes: item.sent_boxes,
        finished_goods_kgs: item.fg_kgs,
        finished_goods_boxes: 0,
        waste_kgs: item.waste_kgs,
        waste_type: miLossConfig?.loss_component || "",
        waste_type_desc: item.waste_type_desc || "",
        rejection_kgs: item.rejection_kgs,
        rejection_boxes: 0,
        line_remarks: "",
      })),
      boxes: aeGeneratedArticles.map(art => ({
        transaction_no: art.transaction_no,
        box_id: art.box_id,
        box_number: art.box_number,
        item_description: art.item_description,
        item_group: art.item_group,
        sub_group: art.sub_group,
        net_weight: art.net_weight,
        gross_weight: art.gross_weight,
        vakkal: art.vakkal,
        lot_no: art.lot_no,
        item_mark: art.item_mark,
        storage_location: art.storage_location,
        exporter: art.exporter,
        rate: art.rate,
        spl_remarks: art.spl_remarks,
        box_type:       art.box_type ?? 'FG',
        unit_pack_size: art.case_pack ?? null,
      })),
    }

    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/material-in?created_by=${encodeURIComponent(user?.email || '')}`
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.detail || `Submission failed: ${res.status}`)
      }
      const result = await res.json()
      toast({ title: "Inward Receipt Recorded", description: `Recorded against challan ${miFoundRecord.challan_no}` })
      // Reset
      setMiSearchChallan("")
      setMiChallanNo("")
      setMiFoundRecord(null)
      setMiInwardWarehouse("")
      setMiItems([])
      setExpandedLossRows(new Set())
      setMiLossConfig(null)
      setMiReceiveCount(0)
      setMiPriorIRs([])
      setMiVehicleNo("")
      setMiDriverName("")
      setMiRemarks("")
      setAeGeneratedArticles([])
      setActiveTab("create-in")
      loadRecords(1)
      loadMiRecords(1)
    } catch (error: any) {
      toast({ title: "Submission Failed", description: error.message || "Failed to submit.", variant: "destructive" })
    } finally {
      setMiSubmitting(false)
    }
  }

  // ════════════════════════════════════════
  //  JOB WORK RECORDS (LISTING)
  // ════════════════════════════════════════
  const [records, setRecords] = useState<JobWorkRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [recordsPage, setRecordsPage] = useState(1)
  const [recordsTotalPages, setRecordsTotalPages] = useState(1)
  const [recordsTotal, setRecordsTotal] = useState(0)
  const [recordsFilterChallan, setRecordsFilterChallan] = useState("")
  const [recordsFilterStatus, setRecordsFilterStatus] = useState("all")
  const [recordsFilterDate, setRecordsFilterDate] = useState("")

  const loadRecords = async (page: number = 1) => {
    setRecordsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "15" })
      if (recordsFilterChallan.trim()) params.append("challan_no", recordsFilterChallan.trim())
      if (recordsFilterStatus && recordsFilterStatus !== "all") params.append("status", recordsFilterStatus)
      if (recordsFilterDate) params.append("date", recordsFilterDate)
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/list?${params.toString()}`
      const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) throw new Error("Failed to load records")
      const data = await res.json()
      setRecords((data.records || []).map((r: any) => ({
        ...r,
        total_qty: Number(r.total_qty || 0),
        total_weight: Number(r.total_weight || 0),
        items_count: Number(r.items_count || 0),
      })))
      setRecordsTotalPages(data.total_pages || 1)
      setRecordsTotal(data.total || 0)
      setRecordsPage(page)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setRecordsLoading(false)
    }
  }

  useEffect(() => { loadRecords(1) }, [recordsFilterStatus, recordsFilterDate])
  useEffect(() => { if (activeTab === "create-in") loadMiRecords(1) }, [activeTab])

  const handleDeleteRecord = async (id: number, challanNo: string) => {
    if (!confirm(`Delete record ${challanNo}? This cannot be undone.`)) return
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/${id}?user_email=${encodeURIComponent(user?.email || '')}`
      const res = await fetch(apiUrl, { method: 'DELETE' })
      if (!res.ok) throw new Error("Delete failed")
      toast({ title: "Deleted", description: `Record ${challanNo} deleted.` })
      loadRecords(recordsPage)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      sent: { label: "Material Out", className: "bg-blue-50 text-blue-700 border-blue-200" },
      partially_received: { label: "Partial Return", className: "bg-amber-50 text-amber-700 border-amber-200" },
      fully_received: { label: "Fully Received", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      reconciled: { label: "Reconciled", className: "bg-violet-50 text-violet-700 border-violet-200" },
      closed: { label: "Closed", className: "bg-gray-100 text-gray-600 border-gray-200" },
      cancelled: { label: "Cancelled", className: "bg-red-50 text-red-600 border-red-200" },
    }
    const s = map[status] || { label: status, className: "bg-gray-100 text-gray-600 border-gray-200" }
    return <Badge variant="outline" className={`text-[10px] font-semibold ${s.className}`}>{s.label}</Badge>
  }

  // Computed values for Material In
  const totals = {
    sent_kgs: miItems.reduce((s, i) => s + i.sent_kgs, 0),
    prev_fg: miItems.reduce((s, i) => s + i.prev_fg_kgs, 0),
    prev_waste: miItems.reduce((s, i) => s + i.prev_waste_kgs, 0),
    prev_rejection: miItems.reduce((s, i) => s + i.prev_rejection_kgs, 0),
    this_fg: miItems.reduce((s, i) => s + i.fg_kgs, 0),
    this_waste: miItems.reduce((s, i) => s + i.waste_kgs, 0),
    this_rejection: miItems.reduce((s, i) => s + i.rejection_kgs, 0),
    unaccounted: miItems.reduce((s, i) => s + i.unaccounted_kgs, 0),
  }
  const totalAccountedKgs = totals.prev_fg + totals.prev_waste + totals.prev_rejection + totals.this_fg + totals.this_waste + totals.this_rejection
  const isFullyAccounted = totals.sent_kgs > 0 && Math.abs(totals.sent_kgs - totalAccountedKgs) < 0.01
  const overallLossPct = totals.sent_kgs > 0 ? ((totals.this_waste + totals.this_rejection) / totals.sent_kgs) * 100 : 0
  const overallUnaccountedLossPct = totals.sent_kgs > 0 ? (totals.unaccounted / totals.sent_kgs) * 100 : 0
  const isWithinFinalTolerance = totals.sent_kgs > 0 && Math.abs(overallUnaccountedLossPct) > 0.01 && Math.abs(overallUnaccountedLossPct) <= 0.2
  const canSubmitFinal = isFullyAccounted || isWithinFinalTolerance
  const toleranceStatus = getLossToleranceStatus()
  // % of dispatched (sent) for the Material In dashboard cells
  const pctOf = (v: number, base: number) => (base > 0 ? ((v / base) * 100).toFixed(1) : "0.0")
  // Summary-tab filter chip styling + "is this filter cleared" helper.
  const isAll = (v: string) => !v || v === "all"
  const fchip = (active: boolean) =>
    `text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all whitespace-nowrap ${active ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:bg-indigo-50 hover:border-indigo-200"}`

  // Cold storage detection — any warehouse flagged as "cold" in constants
  // (Savla D-39, Savla D-514, Rishi, Supreme) triggers the Cold Storage Details panel.
  const isColdStorageInward = isColdWarehouse(miInwardWarehouse)

  // Auto-route cold_company from warehouse: Savla → CFPL, Rishi → CDPL.
  // User can still override via the Company select inside Cold Storage Details.
  useEffect(() => {
    if (!miInwardWarehouse) return
    const w = miInwardWarehouse.toLowerCase()
    if (w.includes("savla") || w.includes("d-39") || w.includes("d-514")) setAeColdCompany("cfpl")
    else if (w.includes("rishi")) setAeColdCompany("cdpl")
  }, [miInwardWarehouse])

  // Process type display helpers
  const processType = miFoundRecord?.sub_category || ""
  const isThermopacking = processType.toLowerCase().includes("thermo")
  const showWasteColumn = !isThermopacking
  const wasteLabel = miLossConfig?.loss_component || "Waste/Byproduct"

  // ════════════════════════════════════════
  //  REPORTS / DASHBOARD
  // ════════════════════════════════════════
  const [rptLoading, setRptLoading] = useState(false)
  const [rptData, setRptData] = useState<any>(null)
  const [rptFilterProcess, setRptFilterProcess] = useState("")
  const [rptFilterVendor, setRptFilterVendor] = useState("")
  const [rptFilterItem, setRptFilterItem] = useState("")
  const [rptFilterFrom, setRptFilterFrom] = useState("")
  const [rptFilterTo, setRptFilterTo] = useState("")
  const [rptActiveView, setRptActiveView] = useState<"drill" | "process" | "vendor" | "item" | "trend" | "matrix">("drill")
  const [rptGroupBy, setRptGroupBy] = useState<"process" | "vendor">("process")
  const [rptSearch, setRptSearch] = useState("")
  const rptActiveFilters = [rptFilterProcess, rptFilterVendor, rptFilterItem].filter((v) => !isAll(v)).length + (rptFilterFrom || rptFilterTo ? 1 : 0)
  // Drill-down tree (Process -> Vendor -> Transaction) — all OUT records, grouped client-side.
  const [rptAllRecords, setRptAllRecords] = useState<any[]>([])
  const [rptTreeLoading, setRptTreeLoading] = useState(false)
  const [rptExpanded, setRptExpanded] = useState<Set<string>>(new Set())
  const toggleExpand = (k: string) => setRptExpanded((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const toYmd = (s: string) => { if (!s) return ""; if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10); const m = s.match(/^(\d{2})-(\d{2})-(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : s }
  // Receipts sub-layer: lazy-fetch a transaction's inward receipts on expand.
  const [rptTxOpen, setRptTxOpen] = useState<Set<string>>(new Set())
  const [rptReceipts, setRptReceipts] = useState<Record<string, { loading: boolean; rows: any[] }>>({})
  const loadTxReceipts = async (challan: string) => {
    if (rptReceipts[challan]) return
    setRptReceipts((p) => ({ ...p, [challan]: { loading: true, rows: [] } }))
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
      const res = await fetch(`${base}/job-work/out/search?challan_no=${encodeURIComponent(challan)}`, { headers: { Accept: "application/json" } })
      const d = await res.json()
      setRptReceipts((p) => ({ ...p, [challan]: { loading: false, rows: d.prior_irs || [] } }))
    } catch { setRptReceipts((p) => ({ ...p, [challan]: { loading: false, rows: [] } })) }
  }
  const toggleTx = (challan: string) => {
    setRptTxOpen((prev) => { const n = new Set(prev); if (n.has(challan)) n.delete(challan); else n.add(challan); return n })
    loadTxReceipts(challan)
  }
  const ymdLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

  const loadReportWithParams = async (filterProcess: string, filterVendor: string, filterItem: string, from: string, to: string) => {
    setRptLoading(true)
    try {
      const p = new URLSearchParams()
      if (filterProcess && filterProcess !== "all") p.append("sub_category", filterProcess)
      if (filterVendor && filterVendor !== "all") p.append("vendor", filterVendor)
      if (filterItem && filterItem !== "all") p.append("item", filterItem)
      if (from) {
        const [y, m, d] = from.split('-')
        p.append("from_date", `${d}-${m}-${y}`)
      }
      if (to) {
        const [y, m, d] = to.split('-')
        p.append("to_date", `${d}-${m}-${y}`)
      }
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/reports/dashboard?${p.toString()}`
      const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) throw new Error("Failed to load report")
      const data = await res.json()
      setRptData(data)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setRptLoading(false)
    }
  }

  const loadReport = () => loadReportWithParams(rptFilterProcess, rptFilterVendor, rptFilterItem, rptFilterFrom, rptFilterTo)

  // Auto-reload on any filter change (debounced for date fields)
  useEffect(() => {
    if (activeTab !== "reports") return
    const timer = setTimeout(() => {
      loadReportWithParams(rptFilterProcess, rptFilterVendor, rptFilterItem, rptFilterFrom, rptFilterTo)
    }, 100)
    return () => clearTimeout(timer)
  }, [activeTab, rptFilterProcess, rptFilterVendor, rptFilterItem, rptFilterFrom, rptFilterTo])

  // Fetch all OUT records once for the drill-down tree (grouped/filtered client-side).
  useEffect(() => {
    if (activeTab !== "reports" || rptAllRecords.length > 0) return
    let cancelled = false
    setRptTreeLoading(true)
    ;(async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
        const res = await fetch(`${base}/job-work/list?per_page=1000`, { headers: { Accept: "application/json" } })
        const data = await res.json()
        if (!cancelled) setRptAllRecords(data.records || [])
      } catch { /* tree is best-effort */ } finally { if (!cancelled) setRptTreeLoading(false) }
    })()
    return () => { cancelled = true }
  }, [activeTab])

  const rptSummary = rptData?.summary || {}
  const rptStatusCounts = rptData?.status_counts || {}
  const rptByProcess = rptData?.by_process || []
  const rptByVendor = rptData?.by_vendor || []
  const rptByItem = rptData?.by_item || []
  const rptMonthly = rptData?.monthly_trend || []
  const rptVendorItem = rptData?.vendor_item_matrix || []
  // Client-side "search within results" applied to the active breakdown view.
  const rptQ = rptSearch.toLowerCase().trim()
  const fProcess = rptQ ? rptByProcess.filter((r: any) => String(r.process || "").toLowerCase().includes(rptQ)) : rptByProcess
  const fVendor = rptQ ? rptByVendor.filter((r: any) => String(r.vendor || "").toLowerCase().includes(rptQ)) : rptByVendor
  const fItem = rptQ ? rptByItem.filter((r: any) => String(r.item || "").toLowerCase().includes(rptQ)) : rptByItem
  const fMatrix = rptQ ? rptVendorItem.filter((r: any) => (String(r.vendor || "") + " " + String(r.item || "")).toLowerCase().includes(rptQ)) : rptVendorItem
  // Hardcoded options (same as material-out form) merged with DB options
  const PROCESS_OPTIONS = ["De seeding", "Dicing", "Cracking", "Stuffing", "Vacuum Packaging", "Slicing", "Thermopacking"]
  const VENDOR_OPTIONS = ["UNAZO CORPORATION", "Krishnat Kerba Chavan", "AL SAKHI ENTERPRISES", "MIE FOODS INDIA PRIVATE LIMITED", "HAG CORPORATION"]

  const dbFilterOpts = rptData?.filter_options || { sub_categories: [], vendors: [], items: [] }
  const rptFilterOpts = {
    sub_categories: [...new Set([...PROCESS_OPTIONS, ...(dbFilterOpts.sub_categories || [])])].sort(),
    vendors: [...new Set([...VENDOR_OPTIONS, ...(dbFilterOpts.vendors || [])])].sort(),
    items: dbFilterOpts.items || [],
  }

  // Helper: bar width for visual bars
  const barWidth = (val: number, max: number) => max > 0 ? Math.max(4, (val / max) * 100) : 0

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/${company}/transfer`)} className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Job Work</h1>
            <p className="text-xs text-muted-foreground">Outsourced processing — Material Out & Inward Receipts</p>
          </div>
        </div>
        <Button size="sm" onClick={() => router.push(`/${company}/transfer/job-work/material-out`)}
          className="bg-gray-900 hover:bg-gray-800 text-white h-9 px-4 text-xs sm:text-sm self-end sm:self-auto">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New Material Out
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full sm:w-auto grid grid-cols-3 h-10 bg-gray-100 rounded-lg p-1">
          <TabsTrigger value="records" className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /><span className="hidden sm:inline">Records</span><span className="sm:hidden">Records</span>
          </TabsTrigger>
          <TabsTrigger value="create-in" className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
            <Inbox className="h-3.5 w-3.5" /><span className="hidden sm:inline">Material In</span><span className="sm:hidden">In</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Summary</span><span className="sm:hidden">Summary</span>
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════ */}
        {/*  TAB: MATERIAL IN (INWARD RECEIPT)         */}
        {/* ══════════════════════════════════════════ */}
        <TabsContent value="create-in" className="mt-4 space-y-4">
          <form onSubmit={handleSubmitMaterialIn} className="space-y-4">

            {/* ─── Search Section ─── */}
            <Card className="border-0 shadow-sm overflow-hidden">
              <CardHeader className="pb-3 bg-gradient-to-r from-teal-50 to-emerald-50 border-b">
                <CardTitle className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
                  <Search className="h-4 w-4 text-teal-600" />
                  Search Material Out Challan
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Enter the challan number from the outward dispatch to record inward receipt
                </p>
              </CardHeader>
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs font-medium text-gray-600">Challan No *</Label>
                    <Input value={miSearchChallan}
                      onChange={(e) => setMiSearchChallan(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchMaterialOut() } }}
                      className="h-9 bg-white border-gray-200" placeholder="e.g. JB202603201430" />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" onClick={handleSearchMaterialOut} disabled={miSearching}
                      className="h-9 px-5 bg-teal-600 hover:bg-teal-700 text-white w-full sm:w-auto">
                      {miSearching ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Search className="h-3.5 w-3.5 mr-1.5" />}
                      Find Record
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ─── Material In Records ─── */}
            {!miFoundRecord && (
              <Card className="border-0 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b bg-white">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Inbox className="h-4 w-4 text-teal-600" />
                      Inward Receipt Records
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{miRecordsTotal} receipt{miRecordsTotal !== 1 ? 's' : ''}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => loadMiRecords(miRecordsPage)} disabled={miRecordsLoading}
                    className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground">
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${miRecordsLoading ? 'animate-spin' : ''}`} /> Refresh
                  </Button>
                </div>

                {/* Finetune: search / type / sort */}
                {miRecords.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 sm:px-5 py-2.5 border-b bg-gray-50/60">
                    <div className="relative flex-1 min-w-0">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input placeholder="Search JWO challan / IR / party…" value={miRecSearch} onChange={(e) => setMiRecSearch(e.target.value)} className="h-8 pl-8 pr-7 text-xs" />
                      {miRecSearch && <button onClick={() => setMiRecSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm leading-none">×</button>}
                    </div>
                    <Select value={miRecType} onValueChange={(v: any) => setMiRecType(v)}>
                      <SelectTrigger className="h-8 text-xs w-full sm:w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="final">Final</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={miRecSort} onValueChange={(v: any) => setMiRecSort(v)}>
                      <SelectTrigger className="h-8 text-xs w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date_desc">Newest first</SelectItem>
                        <SelectItem value="date_asc">Oldest first</SelectItem>
                        <SelectItem value="fg_desc">FG (high→low)</SelectItem>
                        <SelectItem value="challan">JWO challan</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">{miFilteredRecords.length} shown</span>
                  </div>
                )}

                {miRecordsLoading ? (
                  <div className="p-4 space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse flex gap-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 space-y-2"><div className="h-3 bg-gray-200 rounded w-1/3" /><div className="h-2.5 bg-gray-200 rounded w-1/2" /></div>
                      </div>
                    ))}
                  </div>
                ) : miRecords.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <Inbox className="h-10 w-10 text-gray-300 mb-3" />
                    <p className="text-sm text-gray-500">No inward receipts yet</p>
                    <p className="text-xs text-gray-400 mt-1">Search a JWO challan above to create one</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden sm:block">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs">Challan No</th>
                            <th className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs hidden lg:table-cell">JWO Challan</th>
                            <th className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs">Date</th>
                            <th className="px-3 py-2.5 text-center font-medium text-gray-600 text-xs hidden lg:table-cell">Type</th>
                            <th className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs">Party</th>
                            <th className="px-3 py-2.5 text-right font-medium text-gray-600 text-xs">FG (Kg)</th>
                            <th className="px-3 py-2.5 text-right font-medium text-gray-600 text-xs">Waste (Kg)</th>
                            <th className="px-3 py-2.5 text-right font-medium text-gray-600 text-xs">Rejection (Kg)</th>
                            <th className="px-3 py-2.5 text-center font-medium text-gray-600 text-xs">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {miFilteredRecords.map((rec, idx) => (
                            <tr key={rec.id} className={`border-b last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-gray-50`}>
                              <td className="px-3 py-2.5 text-xs font-medium">
                                <ChallanHoverCard
                                  challanNo={rec.challan_no || rec.ir_number || "-"}
                                  from={rec.jwo_challan}
                                  to={rec.to_party}
                                  fetchLines={async () => {
                                    try {
                                      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/material-in/${rec.id}`
                                      const res = await fetch(apiUrl, { headers: { Accept: "application/json" } })
                                      if (!res.ok) return { lines: [] }
                                      const data = await res.json()
                                      const recv = data.receipt || {}
                                      const cum = data.cumulative || {}
                                      const lines: HoverLine[] = (data.lines || []).map((l: any) => {
                                        const fg = Number(l.finished_goods_kgs || 0)
                                        const w  = Number(l.waste_kgs || 0)
                                        const rj = Number(l.rejection_kgs || 0)
                                        const tail: string[] = []
                                        if (w > 0)  tail.push(`W:${w}kg`)
                                        if (rj > 0) tail.push(`R:${rj}kg`)
                                        const desc = l.item_description || "-"
                                        return {
                                          name: tail.length ? `${desc} · ${tail.join(" ")}` : desc,
                                          qty: (l.finished_goods_boxes || l.sent_boxes) || undefined,
                                          netWeight: fg.toFixed(2),
                                        }
                                      })
                                      const meta: HoverMeta[] = []
                                      if (recv.ir_number)        meta.push({ label: "IR", value: recv.ir_number })
                                      if (recv.receipt_type)     meta.push({ label: "Type", value: recv.receipt_type === "final" ? "Final" : "Partial", tone: recv.receipt_type === "final" ? "success" : "default" })
                                      if (recv.receipt_date)     meta.push({ label: "Date", value: recv.receipt_date })
                                      if (recv.jwo_challan)      meta.push({ label: "JWO", value: recv.jwo_challan })
                                      if (recv.to_party)         meta.push({ label: "Party", value: recv.to_party })
                                      if (recv.process_type)     meta.push({ label: "Process", value: recv.process_type })
                                      if (recv.inward_warehouse) meta.push({ label: "Inward WH", value: getDisplayWarehouseName(recv.inward_warehouse) })
                                      if (recv.vehicle_no)       meta.push({ label: "Vehicle", value: recv.vehicle_no })
                                      if (recv.driver_name)      meta.push({ label: "Driver", value: recv.driver_name })
                                      if (recv.created_by)       meta.push({ label: "By", value: recv.created_by })
                                      meta.push({ label: "FG", value: `${rec.total_fg_kgs.toFixed(2)} kg`, tone: "success" })
                                      if (rec.total_waste_kgs > 0)     meta.push({ label: "Waste", value: `${rec.total_waste_kgs.toFixed(2)} kg`, tone: "warn" })
                                      if (rec.total_rejection_kgs > 0) meta.push({ label: "Rejection", value: `${rec.total_rejection_kgs.toFixed(2)} kg`, tone: "warn" })
                                      if (cum.dispatched_kgs)    meta.push({ label: "Dispatched", value: `${Number(cum.dispatched_kgs).toFixed(2)} kg` })
                                      if (cum.remaining_kgs > 0) meta.push({ label: "Remaining", value: `${Number(cum.remaining_kgs).toFixed(2)} kg`, tone: "warn" })
                                      if (typeof cum.cum_loss_pct === "number") meta.push({ label: "Loss %", value: `${cum.cum_loss_pct}%`, tone: cum.cum_loss_pct > (recv.max_loss_pct ?? 10) ? "warn" : "default" })
                                      return { lines, meta }
                                    } catch {
                                      return { lines: [] }
                                    }
                                  }}
                                />
                              </td>
                              <td className="px-3 py-2.5 text-xs font-mono hidden lg:table-cell">{rec.jwo_challan}</td>
                              <td className="px-3 py-2.5 text-xs whitespace-nowrap">{rec.receipt_date}</td>
                              <td className="px-3 py-2.5 text-center hidden lg:table-cell">
                                <Badge variant="outline" className={`text-[9px] font-semibold ${rec.receipt_type === 'final' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-teal-50 text-teal-700 border-teal-200'}`}>
                                  {rec.receipt_type === 'final' ? 'Final' : 'Partial'}
                                </Badge>
                              </td>
                              <td className="px-3 py-2.5 text-xs truncate max-w-[120px]" title={rec.to_party}>{rec.to_party || "-"}</td>
                              <td className="px-3 py-2.5 text-right text-xs font-medium text-emerald-700">{rec.total_fg_kgs.toFixed(2)} <span className="text-[10px] text-gray-400 font-normal">({pctOf(rec.total_fg_kgs, rec.total_sent_kgs)}%)</span></td>
                              <td className="px-3 py-2.5 text-right text-xs font-medium text-orange-700">{rec.total_waste_kgs.toFixed(2)} <span className="text-[10px] text-gray-400 font-normal">({pctOf(rec.total_waste_kgs, rec.total_sent_kgs)}%)</span></td>
                              <td className="px-3 py-2.5 text-right text-xs font-medium text-rose-700">{rec.total_rejection_kgs.toFixed(2)} <span className="text-[10px] text-gray-400 font-normal">({pctOf(rec.total_rejection_kgs, rec.total_sent_kgs)}%)</span></td>
                              <td className="px-3 py-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="sm" title="View Details"
                                    onClick={() => handleViewIR(rec.id)}
                                    className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50">
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  {canDelete && (
                                    <Button variant="ghost" size="sm" title="Delete"
                                      onClick={() => handleDeleteMiRecord(rec.id, rec.challan_no || rec.ir_number)}
                                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">
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

                    {/* Mobile Cards */}
                    <div className="sm:hidden p-3 space-y-2">
                      {miFilteredRecords.map((rec) => (
                        <div key={rec.id} className="bg-white border rounded-lg p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-semibold">{rec.challan_no || "-"}</span>
                            <Badge variant="outline" className={`text-[9px] font-semibold ${rec.receipt_type === 'final' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-teal-50 text-teal-700 border-teal-200'}`}>
                              {rec.receipt_type === 'final' ? 'Final' : 'Partial'}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-500">JWO: {rec.jwo_challan} | {rec.receipt_date}</div>
                          <div className="text-xs text-gray-500">{rec.to_party || "-"}</div>
                          <div className="flex items-center justify-between text-xs">
                            <span>FG: <span className="font-medium text-emerald-700">{rec.total_fg_kgs.toFixed(2)}</span> | W: <span className="font-medium text-orange-700">{rec.total_waste_kgs.toFixed(2)}</span> | R: <span className="font-medium text-rose-700">{rec.total_rejection_kgs.toFixed(2)}</span></span>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm"
                                onClick={() => handleViewIR(rec.id)}
                                className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800">
                                <Eye className="h-3 w-3" />
                              </Button>
                              {canDelete && (
                                <Button variant="ghost" size="sm"
                                  onClick={() => handleDeleteMiRecord(rec.id, rec.challan_no || rec.ir_number)}
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {miRecordsTotalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/50">
                        <p className="text-xs text-muted-foreground">
                          Page {miRecordsPage} of {miRecordsTotalPages} ({miRecordsTotal} total)
                        </p>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => loadMiRecords(miRecordsPage - 1)} disabled={miRecordsPage === 1} className="h-8 px-3 text-xs">Prev</Button>
                          <Button variant="outline" size="sm" onClick={() => loadMiRecords(miRecordsPage + 1)} disabled={miRecordsPage >= miRecordsTotalPages} className="h-8 px-3 text-xs">Next</Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </Card>
            )}

            {/* ─── Found Record Summary ─── */}
            {miFoundRecord && (
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardHeader className="pb-3 bg-gradient-to-r from-emerald-50 to-green-50 border-b">
                  <CardTitle className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    JWO Found — {miFoundRecord.challan_no}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-5">
                  {/* JWO Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs mb-4">
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <span className="text-gray-500 block">Date</span>
                      <span className="font-medium">{miFoundRecord.job_work_date || "-"}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <span className="text-gray-500 block">Vendor</span>
                      <span className="font-medium">{miFoundRecord.to_party || "-"}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <span className="text-gray-500 block">Process</span>
                      <span className="font-medium">{processType || "-"}</span>
                    </div>
                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-2.5">
                      <span className="text-teal-600 block mb-1">Material-In Warehouse</span>
                      <Select value={miInwardWarehouse} onValueChange={setMiInwardWarehouse}>
                        <SelectTrigger className="h-7 text-xs bg-white border-teal-300 text-teal-900 font-semibold">
                          <SelectValue placeholder="Select warehouse" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="W202">W202</SelectItem>
                          <SelectItem value="A185">A185</SelectItem>
                          <SelectItem value="A101">A101</SelectItem>
                          <SelectItem value="A68">A68</SelectItem>
                          <SelectItem value="F53">F53</SelectItem>
                          <SelectItem value="Savla D-39">Savla D-39</SelectItem>
                          <SelectItem value="Savla D-514">Savla D-514</SelectItem>
                          <SelectItem value="Rishi">Rishi</SelectItem>
                          <SelectItem value="Supreme">Supreme</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <span className="text-gray-500 block">Status</span>
                      <span className="font-medium">
                        {miFoundRecord.status === 'sent' ? 'Open (no receives)' :
                          miFoundRecord.status === 'partially_received' ? `Partially Received (${miReceiveCount} IR${miReceiveCount > 1 ? 's' : ''})` :
                            miFoundRecord.status}
                      </span>
                    </div>
                  </div>

                  {/* Running Totals Panel (if previous receives exist) */}
                  {miReceiveCount > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                      <h4 className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5" /> Cumulative Summary (from {miReceiveCount} prior IR{miReceiveCount > 1 ? 's' : ''})
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs mb-3">
                        <div><span className="text-blue-600">Total Dispatched:</span> <span className="font-semibold">{totals.sent_kgs.toFixed(2)} kg</span></div>
                        <div><span className="text-blue-600">FG Received:</span> <span className="font-semibold">{totals.prev_fg.toFixed(2)} kg</span></div>
                        {showWasteColumn && <div><span className="text-blue-600">Waste Received:</span> <span className="font-semibold">{totals.prev_waste.toFixed(2)} kg</span></div>}
                        <div><span className="text-blue-600">Rejection:</span> <span className="font-semibold">{totals.prev_rejection.toFixed(2)} kg</span></div>
                        <div><span className="text-blue-600">Remaining Balance:</span> <span className="font-semibold">{(totals.sent_kgs - totals.prev_fg - totals.prev_waste - totals.prev_rejection).toFixed(2)} kg</span></div>
                      </div>

                      {/* Prior IR History */}
                      {miPriorIRs.length > 0 && (
                        <div className="border-t border-blue-200 pt-2 mt-2">
                          <h5 className="text-[10px] font-semibold text-blue-700 mb-1.5 uppercase tracking-wide">Receipt History</h5>
                          <div className="space-y-1">
                            {miPriorIRs.map((ir, idx) => (
                              <div key={idx} className="flex items-center gap-3 text-[11px] bg-white/60 rounded px-2 py-1.5">
                                <span className="font-semibold text-blue-800 min-w-[80px]">{ir.challan_no || "-"}</span>
                                <span className="text-gray-500 min-w-[75px]">{ir.receipt_date || "-"}</span>
                                <Badge variant="outline" className={`text-[9px] ${ir.receipt_type === 'final' ? 'border-amber-300 text-amber-700 bg-amber-50' : 'border-blue-200 text-blue-600'}`}>
                                  {ir.receipt_type === 'final' ? 'Final' : 'Partial'}
                                </Badge>
                                <span className="text-gray-600 ml-auto">
                                  FG: {ir.total_fg_kgs.toFixed(2)}
                                  {ir.total_waste_kgs > 0 && ` | W: ${ir.total_waste_kgs.toFixed(2)}`}
                                  {ir.total_rejection_kgs > 0 && ` | R: ${ir.total_rejection_kgs.toFixed(2)}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Loss Config Info */}
                  {miLossConfig && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800">
                      <span className="font-semibold">Expected Loss:</span> {miLossConfig.min_loss_pct}% – {miLossConfig.max_loss_pct}%
                      {miLossConfig.loss_component && <span className="ml-2 text-amber-600">({miLossConfig.loss_component})</span>}
                      {miLossConfig.single_shot && <Badge variant="outline" className="ml-2 text-[9px] border-amber-300 text-amber-700">Single-Shot Return</Badge>}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ─── Challan No, Receipt Type & Date ─── */}
            {miItems.length > 0 && (
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Inward Challan No *</Label>
                      <Input value={miChallanNo}
                        onChange={(e) => setMiChallanNo(e.target.value)}
                        className="h-9 bg-white border-gray-200" placeholder="Enter inward challan no" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Receipt Date</Label>
                      <Input type="date" value={(() => {
                        const parts = miReceiptDate.split('-')
                        return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : miReceiptDate
                      })()}
                        onChange={(e) => {
                          const val = e.target.value
                          if (val) {
                            const [y, m, d] = val.split('-')
                            setMiReceiptDate(`${d}-${m}-${y}`)
                          }
                        }}
                        className="h-9 bg-white border-gray-200" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ─── Items Table ─── */}
            {miItems.length > 0 && (
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardHeader className="pb-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b">
                  <CardTitle className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
                    <Package className="h-4 w-4 text-amber-600" />
                    Inward Receipt — Enter Quantities
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Enter Finished Goods{showWasteColumn ? `, ${wasteLabel}` : ''}, and Rejection quantities. Unaccounted loss is auto-calculated.
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-2 py-2 text-left font-medium text-gray-600 text-xs">#</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-600 text-xs">Item Description</th>
                          <th className="px-2 py-2 text-right font-medium text-gray-600 text-xs">Disp. (Kg)</th>
                          <th className="px-2 py-2 text-right font-medium text-emerald-700 text-xs bg-emerald-50">FG Received (Kg)</th>
                          {showWasteColumn && (
                            <th className="px-2 py-2 text-right font-medium text-orange-700 text-xs bg-orange-50">{wasteLabel} (Kg)</th>
                          )}
                          <th className="px-2 py-2 text-right font-medium text-rose-700 text-xs bg-rose-50">Rejection (Kg)</th>
                          <th className="px-2 py-2 text-right font-medium text-gray-600 text-xs">Accntd.</th>
                          <th className="px-2 py-2 text-right font-medium text-red-600 text-xs">Unaccntd.</th>
                          <th className="px-2 py-2 text-right font-medium text-red-600 text-xs">Loss %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {miItems.map((item, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                            <td className="px-2 py-2 text-gray-500 text-xs">{item.sl_no}</td>
                            <td className="px-2 py-2 font-medium text-xs max-w-[180px] truncate" title={item.description}>{item.description}</td>
                            <td className="px-2 py-2 text-right text-xs font-medium">{item.sent_kgs.toFixed(2)}</td>
                            {/* FG Received */}
                            <td className="px-2 py-2 text-right bg-emerald-50/30">
                              <Input type="number" step="0.01" min="0" value={item.fg_kgs || ""}
                                onChange={(e) => updateIRItem(idx, 'fg_kgs', Number(e.target.value) || 0)}
                                onWheel={(e) => e.currentTarget.blur()}
                                className="h-7 w-24 text-xs text-right inline-block border-emerald-200 focus:border-emerald-400" />
                            </td>
                            {/* Waste */}
                            {showWasteColumn && (
                              <td className="px-2 py-2 text-right bg-orange-50/30">
                                <Input type="number" step="0.01" min="0" value={item.waste_kgs || ""}
                                  onChange={(e) => updateIRItem(idx, 'waste_kgs', Number(e.target.value) || 0)}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  className="h-7 w-24 text-xs text-right inline-block border-orange-200 focus:border-orange-400" />
                                <Input type="text" value={item.waste_type_desc}
                                  onChange={(e) => updateIRItemWasteDesc(idx, e.target.value)}
                                  placeholder="material type"
                                  className="mt-1 h-6 w-24 text-[10px] text-left inline-block border-orange-100 focus:border-orange-300 placeholder:text-orange-300" />
                              </td>
                            )}
                            {/* Rejection */}
                            <td className="px-2 py-2 text-right bg-rose-50/30">
                              <Input type="number" step="0.01" min="0" value={item.rejection_kgs || ""}
                                onChange={(e) => updateIRItem(idx, 'rejection_kgs', Number(e.target.value) || 0)}
                                onWheel={(e) => e.currentTarget.blur()}
                                className="h-7 w-24 text-xs text-right inline-block border-rose-200 focus:border-rose-400" />
                            </td>
                            {/* Accounted */}
                            <td className="px-2 py-2 text-right text-xs font-medium text-gray-700">{item.total_accounted_kgs.toFixed(2)}</td>
                            {/* Unaccounted */}
                            <td className={`px-2 py-2 text-right text-xs font-semibold ${item.unaccounted_kgs > 0 ? 'text-red-600' : item.unaccounted_kgs < 0 ? 'text-red-800' : 'text-gray-400'}`}>
                              {item.unaccounted_kgs.toFixed(2)}
                              {item.unaccounted_kgs < 0 && <span className="text-[9px] ml-0.5">OVER</span>}
                            </td>
                            {/* Loss % */}
                            <td className="px-2 py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Badge variant="outline" className={`text-[10px] font-semibold ${
                                  item.loss_pct > 10 ? 'bg-red-50 text-red-700 border-red-200' :
                                  item.loss_pct > 5 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  item.loss_pct >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                  'bg-red-100 text-red-800 border-red-300'
                                }`}>
                                  {item.loss_pct.toFixed(1)}%
                                </Badge>
                                <button type="button"
                                  onClick={() => setExpandedLossRows(prev => {
                                    const next = new Set(prev)
                                    next.has(idx) ? next.delete(idx) : next.add(idx)
                                    return next
                                  })}
                                  className="text-[10px] text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-1 leading-4">
                                  {expandedLossRows.has(idx) ? '−' : '+'}
                                </button>
                              </div>
                              {expandedLossRows.has(idx) && (
                                <div className="mt-1 text-[10px] text-right space-y-0.5">
                                  <div className="text-orange-600">W+R: <span className="font-semibold">{item.loss_pct.toFixed(1)}%</span></div>
                                  <div className={item.unaccounted_loss_pct > 0 ? 'text-red-500' : 'text-gray-400'}>
                                    Unacctd: <span className="font-semibold">{item.unaccounted_loss_pct.toFixed(1)}%</span>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-100 border-t-2">
                        <tr className="font-semibold text-xs">
                          <td colSpan={2} className="px-2 py-2 text-gray-700">Totals (Cumulative)</td>
                          <td className="px-2 py-2 text-right">{totals.sent_kgs.toFixed(2)}</td>
                          <td className="px-2 py-2 text-right text-emerald-700">{(totals.prev_fg + totals.this_fg).toFixed(2)}</td>
                          {showWasteColumn && <td className="px-2 py-2 text-right text-orange-700">{(totals.prev_waste + totals.this_waste).toFixed(2)}</td>}
                          <td className="px-2 py-2 text-right text-rose-700">{(totals.prev_rejection + totals.this_rejection).toFixed(2)}</td>
                          <td className="px-2 py-2 text-right text-gray-700">{(totals.sent_kgs - totals.unaccounted).toFixed(2)}</td>
                          <td className="px-2 py-2 text-right text-red-600">{totals.unaccounted.toFixed(2)}</td>
                          <td className="px-2 py-2 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <Badge variant="outline" className="text-[10px] font-bold bg-gray-200 text-gray-800 border-gray-400">{overallLossPct.toFixed(1)}%</Badge>
                              {overallUnaccountedLossPct !== 0 && (
                                <span className="text-[9px] text-red-500">+{overallUnaccountedLossPct.toFixed(1)}% unacctd</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ─── Loss Tolerance Alert (Final Receipt only) ─── */}
            {toleranceStatus && miItems.some(i => i.fg_kgs > 0 || i.waste_kgs > 0 || i.rejection_kgs > 0) && (
              <div className={`flex items-center gap-2 p-3 rounded-lg border text-xs font-medium ${toleranceStatus.color}`}>
                {toleranceStatus.status === "normal" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                <span>Loss Tolerance: {overallUnaccountedLossPct.toFixed(1)}% unaccounted — {toleranceStatus.label}</span>
                {miLossConfig && <span className="ml-auto text-[10px] opacity-75">Expected: {miLossConfig.min_loss_pct}% – {miLossConfig.max_loss_pct}%</span>}
              </div>
            )}

            {/* ─── Vehicle & Remarks ─── */}
            {miItems.length > 0 && (
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardHeader className="pb-3 bg-gradient-to-r from-violet-50 to-purple-50 border-b">
                  <CardTitle className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
                    <Truck className="h-4 w-4 text-violet-600" />
                    Return Transport Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Vehicle No</Label>
                      <Input value={miVehicleNo} onChange={(e) => setMiVehicleNo(e.target.value)}
                        className="h-9 bg-white border-gray-200" placeholder="e.g. MH43BP5470" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Driver Name</Label>
                      <Input value={miDriverName} onChange={(e) => setMiDriverName(e.target.value)}
                        className="h-9 bg-white border-gray-200" placeholder="Driver name" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Remarks</Label>
                      <Input value={miRemarks} onChange={(e) => setMiRemarks(e.target.value)}
                        className="h-9 bg-white border-gray-200" placeholder="Notes about this return" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ─── Placeholder when no record ─── */}
            {!miFoundRecord && (
              <Card className="border border-dashed border-gray-300">
                <CardContent className="py-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="h-16 w-16 rounded-full bg-teal-50 flex items-center justify-center mb-4">
                      <Search className="h-7 w-7 text-teal-300" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">Search for a Material Out Record</h3>
                    <p className="text-xs text-gray-500 max-w-sm">
                      Enter the challan number above and click Find Record. The original dispatched items will load
                      and you can enter received quantities (FG, Waste, Rejection) for this inward receipt.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}


          </form>

          {/* ═══════════════════════════════════════════════ */}
          {/*  ARTICLE ENTRY — Box ID + QR Label Generation  */}
          {/* ═══════════════════════════════════════════════ */}
          {miFoundRecord && (
          <Card className="border-0 shadow-sm overflow-hidden mt-4">
            <CardHeader className="pb-3 bg-gradient-to-r from-indigo-50 to-blue-50 border-b">
              <CardTitle className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
                <Box className="h-4 w-4 text-indigo-600" />
                Article Entry — Generate Box IDs & QR Labels
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Select item, enter quantity to auto-generate box entries with transaction number and printable QR labels
              </p>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Label className="text-xs font-medium text-gray-600 mb-1 block">Search Item Description</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    value={aeSearchText}
                    onChange={(e) => setAeSearchText(e.target.value)}
                    onFocus={() => { if (aeSearchResults.length > 0) setAeSearchOpen(true) }}
                    onBlur={() => setTimeout(() => setAeSearchOpen(false), 200)}
                    className="h-9 pl-8 bg-white border-gray-200 text-xs"
                    placeholder="Type to search item description..."
                  />
                  {aeSearching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 animate-spin" />}
                </div>
                {aeSearchOpen && aeSearchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {aeSearchResults.map((item, idx) => (
                      <button key={idx} type="button"
                        onMouseDown={(e) => { e.preventDefault(); handleAeSearchSelect(item) }}
                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 border-b last:border-0 transition-colors">
                        <div className="text-xs font-medium text-gray-900 truncate">{item.item_description}</div>
                        <div className="text-[10px] text-gray-500">{item.item_group} / {item.sub_group}</div>
                      </button>
                    ))}
                  </div>
                )}
                {aeSearchOpen && aeSearchResults.length === 0 && aeSearchText.trim().length >= 2 && !aeSearching && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs text-gray-500 text-center">
                    No items found
                  </div>
                )}
              </div>

              {/* Selected item display */}
              {aeSelectedDesc && (
                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <Package className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-indigo-900 truncate block">{aeSelectedDesc}</span>
                    <span className="text-[10px] text-indigo-600">{aeSelectedGroup} / {aeSelectedSubGroup}</span>
                  </div>
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => { setAeSelectedGroup(""); setAeSelectedSubGroup(""); setAeSelectedDesc(""); setAeSubGroups([]); setAeDescriptions([]) }}
                    className="h-6 w-6 p-0 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 flex-shrink-0">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* Entry Type toggle */}
              <div className="flex items-center gap-3 mb-3">
                <Label className="text-xs font-medium text-gray-600">Entry Type:</Label>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setAeBoxType('FG')}
                    className={`px-3 py-1 text-xs rounded border ${aeBoxType === 'FG'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-semibold'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    Finished Goods
                  </button>
                  <button type="button"
                    onClick={() => setAeBoxType('REJECTION')}
                    className={`px-3 py-1 text-xs rounded border ${aeBoxType === 'REJECTION'
                      ? 'bg-rose-50 border-rose-300 text-rose-700 font-semibold'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    Rejection
                  </button>
                </div>
                <span className="ml-auto text-[10px] text-gray-500">
                  {aeBoxType === 'FG'
                    ? `FG remaining: ${(aeFgLimit - aeUsedFg).toFixed(2)} kg`
                    : `Rejection remaining: ${(aeRejLimit - aeUsedRej).toFixed(2)} kg`}
                </span>
              </div>

              {/* Cascading Dropdowns (alternative to search) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Item Group */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Item Group *</Label>
                  <Select value={aeSelectedGroup} onValueChange={handleAeGroupChange}>
                    <SelectTrigger className="h-9 bg-white border-gray-200 text-xs">
                      <SelectValue placeholder={aeLoadingGroups ? "Loading..." : "Select Group"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {aeItemGroups.map(g => (
                        <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sub Group */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Sub Group *</Label>
                  <Select value={aeSelectedSubGroup} onValueChange={handleAeSubGroupChange} disabled={!aeSelectedGroup}>
                    <SelectTrigger className="h-9 bg-white border-gray-200 text-xs">
                      <SelectValue placeholder={aeLoadingSubs ? "Loading..." : "Select Sub Group"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {aeSubGroups.map(s => (
                        <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Item Description */}
                <div className="space-y-1 lg:col-span-2">
                  <Label className="text-xs font-medium text-gray-600">Item Description *</Label>
                  <Select value={aeSelectedDesc} onValueChange={(val) => {
                    setAeSelectedDesc(val)
                    if (val) {
                      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/sku-detail?description=${encodeURIComponent(val)}`
                      fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
                        .then(r => r.json())
                        .then(d => {
                          const parsed = parseFloat(String(d?.uom || "").replace(/[^0-9.]/g, ""))
                          setAeUom(isNaN(parsed) ? 0 : parsed)
                        })
                        .catch(() => setAeUom(0))
                    } else {
                      setAeUom(0)
                    }
                  }} disabled={!aeSelectedSubGroup}>
                    <SelectTrigger className="h-9 bg-white border-gray-200 text-xs">
                      <SelectValue placeholder={aeLoadingDescs ? "Loading..." : "Select Description"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {aeDescriptions.map(d => (
                        <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Quantity + Case Pack + Net Weight + Gross Weight */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Quantity (Boxes) *</Label>
                  <Input type="number" min={1} value={aeQuantity || ""}
                    onChange={(e) => setAeQuantity(Number(e.target.value) || 0)}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="h-9 bg-white border-gray-200 text-xs" placeholder="No. of boxes" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Case Pack <span className="text-gray-400">(units/box)</span></Label>
                  <Input
                    type="number" step="0.001" min={0}
                    value={aeCasePack || ""}
                    onChange={(e) => onAePickerCasePackChange(Number(e.target.value) || 0)}
                    onWheel={(e) => e.currentTarget.blur()}
                    disabled={aeUom <= 0}
                    placeholder={aeUom <= 0 ? "Pick SKU first" : ""}
                    className="h-9 bg-white border-gray-200 text-xs"
                  />
                  {aeUom > 0 && (
                    <p className="text-[10px] text-gray-500">uom = {aeUom} kg/unit (from master)</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Net Wt / Box (Kg)</Label>
                  <Input type="number" step="0.01" min={0} value={aeNetWeight || ""}
                    onChange={(e) => onAePickerNetChange(Number(e.target.value) || 0)}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="h-9 bg-white border-gray-200 text-xs" placeholder="Net wt" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Gross Wt / Box (Kg)</Label>
                  <Input type="number" step="0.01" min={0} value={aeGrossWeight || ""}
                    onChange={(e) => setAeGrossWeight(Number(e.target.value) || 0)}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="h-9 bg-white border-gray-200 text-xs" placeholder="Gross wt" />
                </div>
              </div>

              {/* Cold Storage Fields — shown when warehouse is cold storage */}
              {isColdStorageInward && (
                <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> Cold Storage Details
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Company *</Label>
                      <Select value={aeColdCompany} onValueChange={setAeColdCompany}>
                        <SelectTrigger className="h-9 bg-white border-gray-200 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cfpl" className="text-xs">CFPL</SelectItem>
                          <SelectItem value="cdpl" className="text-xs">CDPL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Inward Date *</Label>
                      <Input type="date" value={(() => {
                        const parts = aeInwardDate.split('-')
                        return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : aeInwardDate
                      })()}
                        onChange={(e) => {
                          const val = e.target.value
                          if (val) { const [y, m, d] = val.split('-'); setAeInwardDate(`${d}-${m}-${y}`) }
                        }}
                        className="h-9 bg-white border-gray-200 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Vakkal</Label>
                      <Input value={aeVakkal} onChange={(e) => setAeVakkal(e.target.value)}
                        className="h-9 bg-white border-gray-200 text-xs" placeholder="Vakkal" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Lot No</Label>
                      <Input value={aeLotNo} onChange={(e) => setAeLotNo(e.target.value)}
                        className="h-9 bg-white border-gray-200 text-xs" placeholder="Lot number" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Item Mark</Label>
                      <Input value={aeItemMark} onChange={(e) => setAeItemMark(e.target.value)}
                        className="h-9 bg-white border-gray-200 text-xs" placeholder="Item mark" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Storage Location</Label>
                      <Input value={aeStorageLocation} onChange={(e) => setAeStorageLocation(e.target.value)}
                        className="h-9 bg-white border-gray-200 text-xs" placeholder="Location" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Exporter</Label>
                      <Input value={aeExporter} onChange={(e) => setAeExporter(e.target.value)}
                        className="h-9 bg-white border-gray-200 text-xs" placeholder="Exporter" />
                    </div>
                    {/* Rate / Value fields hidden — not used in current job-work flow.
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Rate</Label>
                      <Input type="number" step="0.01" min={0} value={aeRate || ""}
                        onChange={(e) => setAeRate(Number(e.target.value) || 0)}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="h-9 bg-white border-gray-200 text-xs" placeholder="0.00" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Value (Qty × Rate)</Label>
                      <div className="h-9 flex items-center px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-medium text-gray-700">
                        {aeQuantity > 0 && aeRate > 0 ? (aeQuantity * aeRate).toFixed(2) : "—"}
                      </div>
                    </div>
                    */}
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Spl. Remarks</Label>
                      <Input value={aeSplRemarks} onChange={(e) => setAeSplRemarks(e.target.value)}
                        className="h-9 bg-white border-gray-200 text-xs" placeholder="Special remarks..." />
                    </div>
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <div className="flex items-end">
                <Button type="button" onClick={generateArticleEntries}
                  disabled={!aeSelectedDesc || aeQuantity < 1}
                  className="h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs w-full sm:w-auto">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Generate Entries
                </Button>
              </div>

              {/* Generated Articles Table */}
              {aeGeneratedArticles.length > 0 && (
                <>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-700">{aeGeneratedArticles.length} Box Entries Generated</h4>
                      <p className="text-[10px] text-gray-500">
                        {[...new Set(aeGeneratedArticles.map(a => a.transaction_no))].length} transaction(s)
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setAeGeneratedArticles([])}
                        className="h-8 px-3 text-xs text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50">
                        <Trash2 className="h-3 w-3 mr-1.5" /> Clear All
                      </Button>
                      <Button type="button" size="sm" onClick={() => handlePrintArticleQR()} disabled={aePrintingQR}
                        className="h-8 px-4 text-xs bg-violet-600 hover:bg-violet-700 text-white">
                        {aePrintingQR ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Printer className="h-3.5 w-3.5 mr-1.5" />}
                        Print QR Labels
                      </Button>
                    </div>
                  </div>

                  <BoxScrollContainer
                    boxCount={aeGeneratedArticles.length}
                    boxForms={aeGeneratedArticles.map((art) => ({ box_number: art.box_number, lot_number: "", article_description: art.item_description }))}
                  >
                    {(registerRef) => (
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 text-xs">#</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 text-xs">Transaction No</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 text-xs">Box ID</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 text-xs">Item Description</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 text-xs">Group</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600 text-xs">Case Pack</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600 text-xs">Net Wt (Kg)</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600 text-xs">Gross Wt (Kg)</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-600 text-xs">QR</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-600 text-xs">Del</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aeGeneratedArticles.map((art, idx) => (
                          <tr key={`${art.box_id}-${idx}`} ref={(el) => registerRef(art.box_number, el)} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                            <td className="px-3 py-1.5 text-xs text-gray-500">{idx + 1}</td>
                            <td className="px-3 py-1.5 text-xs font-mono text-indigo-700">{art.transaction_no}</td>
                            <td className="px-3 py-1.5 text-xs font-mono font-semibold">{art.box_id}</td>
                            <td className="px-3 py-1.5 text-xs max-w-[220px]" title={art.item_description}>
                              <span className="truncate inline-block max-w-[160px] align-middle">{art.item_description}</span>
                              {art.box_type === 'REJECTION' && (
                                <span className="ml-2 inline-block px-1.5 py-0.5 text-[9px] font-semibold rounded bg-rose-100 text-rose-700 border border-rose-300 align-middle">
                                  REJECTION
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-xs text-gray-600">{art.item_group} / {art.sub_group}</td>
                            <td className="px-2 py-1">
                              <Input type="number" step="0.001" min={0}
                                value={(art.case_pack ?? ((art.uom ?? 0) > 0 ? round3(art.net_weight / (art.uom as number)) : 0)) || ""}
                                onChange={(e) => {
                                  const cp = Number(e.target.value) || 0
                                  setAeGeneratedArticles(prev => prev.map((a, i) => i === idx ? {
                                    ...a,
                                    case_pack: cp,
                                  } : a))
                                }}
                                onWheel={(e) => e.currentTarget.blur()}
                                className="h-7 w-20 text-xs text-right border-gray-200" />
                            </td>
                            <td className="px-2 py-1">
                              <Input type="number" step="0.01" min={0}
                                value={art.net_weight || ""}
                                onChange={(e) => {
                                  const nw = Number(e.target.value) || 0
                                  setAeGeneratedArticles(prev => prev.map((a, i) => i === idx ? {
                                    ...a,
                                    net_weight: nw,
                                  } : a))
                                }}
                                onWheel={(e) => e.currentTarget.blur()}
                                className="h-7 w-20 text-xs text-right border-gray-200" />
                            </td>
                            <td className="px-2 py-1">
                              <Input type="number" step="0.01" min={0}
                                value={art.gross_weight || ""}
                                onChange={(e) => setAeGeneratedArticles(prev => prev.map((a, i) => i === idx ? { ...a, gross_weight: Number(e.target.value) || 0 } : a))}
                                onWheel={(e) => e.currentTarget.blur()}
                                className="h-7 w-20 text-xs text-right border-gray-200" />
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <Button type="button" variant="ghost" size="sm" title="Print QR Label"
                                onClick={() => handlePrintArticleQR(idx)} disabled={aePrintingQR}
                                className="h-7 w-7 p-0 text-violet-600 hover:text-violet-800 hover:bg-violet-50">
                                <Printer className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <Button type="button" variant="ghost" size="sm"
                                onClick={() => setAeGeneratedArticles(prev => prev.filter((_, i) => i !== idx))}
                                className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                    )}
                  </BoxScrollContainer>

                  {/* FG + Rejection status badges */}
                  {(aeFgLimit > 0 || aeRejLimit > 0) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {aeFgLimit > 0 && (
                        <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium ${
                          aeUsedFg > aeFgLimit + 0.01
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : Math.abs(aeUsedFg - aeFgLimit) < 0.01
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          <span>FG: <b>{aeUsedFg.toFixed(2)} kg</b> / <b>{aeFgLimit.toFixed(2)} kg</b></span>
                          <span>{aeUsedFg > aeFgLimit + 0.01 ? 'EXCEEDS' : Math.abs(aeUsedFg - aeFgLimit) < 0.01 ? 'Matched' : `Rem: ${(aeFgLimit - aeUsedFg).toFixed(2)} kg`}</span>
                        </div>
                      )}
                      {aeRejLimit > 0 && (
                        <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium ${
                          aeUsedRej > aeRejLimit + 0.01
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : Math.abs(aeUsedRej - aeRejLimit) < 0.01
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          <span>Rejection: <b>{aeUsedRej.toFixed(2)} kg</b> / <b>{aeRejLimit.toFixed(2)} kg</b></span>
                          <span>{aeUsedRej > aeRejLimit + 0.01 ? 'EXCEEDS' : Math.abs(aeUsedRej - aeRejLimit) < 0.01 ? 'Matched' : `Rem: ${(aeRejLimit - aeUsedRej).toFixed(2)} kg`}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Add Box at bottom */}
                  <div className="flex items-center gap-3 pt-2">
                    <Button type="button" variant="outline" size="sm"
                      onClick={() => {
                        if (aeGeneratedArticles.length === 0) return
                        const last = aeGeneratedArticles[aeGeneratedArticles.length - 1]
                        const newBoxNum = Math.max(...aeGeneratedArticles.filter(a => a.transaction_no === last.transaction_no).map(a => a.box_number)) + 1
                        const base = last.box_id.split('-')[0]
                        setAeGeneratedArticles(prev => [...prev, {
                          ...last,
                          box_id: `${base}-${newBoxNum}`,
                          box_number: newBoxNum,
                          net_weight: 0,
                          gross_weight: 0,
                        }])
                      }}
                      disabled={aeGeneratedArticles.length === 0}
                      className="h-8 px-4 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                      <Plus className="h-3 w-3 mr-1.5" /> Add Box
                    </Button>
                    <span className="text-[10px] text-gray-400">
                      Adds a new box to the last transaction
                    </span>
                  </div>

                </>
              )}
            </CardContent>
          </Card>
          )}

          {/* ─── Submit (Moved to Bottom) ─── */}
          {miItems.length > 0 && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => {
                setMiFoundRecord(null); setMiInwardWarehouse(""); setMiItems([]); setExpandedLossRows(new Set()); setMiSearchChallan(""); setMiChallanNo(""); setMiLossConfig(null); setMiReceiveCount(0); setMiPriorIRs([])
              }} className="h-10 px-5 text-sm">Clear</Button>
              <div className="flex items-center gap-3">
                <Button type="button" disabled={miSubmitting || canSubmitFinal}
                  onClick={(e) => handleSubmitMaterialIn(e as any, "partial")}
                  className="h-10 px-5 text-sm shadow-sm bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  title={canSubmitFinal ? "Accounting complete — use Submit Final to close this receipt" : ""}>
                  {miSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</> :
                    <><Inbox className="h-4 w-4 mr-2" />Submit Partial</>}
                </Button>
                <div className="flex flex-col items-end gap-1">
                  <Button type="button" disabled={miSubmitting || !canSubmitFinal}
                    onClick={(e) => handleSubmitMaterialIn(e as any, "final")}
                    className="h-10 px-5 text-sm shadow-sm bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!canSubmitFinal ? `Unaccounted ${overallUnaccountedLossPct.toFixed(2)}% exceeds ±0.2% tolerance` : isWithinFinalTolerance ? `Within tolerance — ${overallUnaccountedLossPct.toFixed(2)}% unaccounted` : ''}>
                    {miSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</> :
                      <><AlertTriangle className="h-4 w-4 mr-2" />Submit Final</>}
                  </Button>
                  {isWithinFinalTolerance && (
                    <span className="text-[10px] text-amber-600 font-medium">
                      Within tolerance — {overallUnaccountedLossPct.toFixed(2)}% unaccounted
                    </span>
                  )}
                  {!canSubmitFinal && miItems.length > 0 && (
                    <span className="text-[10px] text-red-500 font-medium">
                      {overallUnaccountedLossPct.toFixed(2)}% unaccounted &gt; ±0.2% limit
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

        </TabsContent>

        {/* ══════════════════════════════════════════ */}
        {/*  TAB: ALL RECORDS                          */}
        {/* ══════════════════════════════════════════ */}
        <TabsContent value="records" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-5 py-3 sm:py-4 border-b bg-white">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Job Work Records</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{recordsTotal} record{recordsTotal !== 1 ? 's' : ''}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => loadRecords(recordsPage)} disabled={recordsLoading}
                className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground self-end sm:self-auto">
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${recordsLoading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2 px-4 sm:px-5 py-3 border-b bg-gray-50/50">
              <div className="flex-1 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Search challan no..."
                  value={recordsFilterChallan}
                  onChange={(e) => setRecordsFilterChallan(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') loadRecords(1) }}
                  className="h-8 pl-8 text-xs bg-white"
                />
              </div>
              <Select value={recordsFilterStatus} onValueChange={(v) => setRecordsFilterStatus(v)}>
                <SelectTrigger className="h-8 w-full sm:w-[160px] text-xs bg-white">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="sent">Material Out</SelectItem>
                  <SelectItem value="partially_received">Partial Return</SelectItem>
                  <SelectItem value="fully_received">Fully Received</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={recordsFilterDate}
                onChange={(e) => setRecordsFilterDate(e.target.value)}
                className="h-8 w-full sm:w-[150px] text-xs bg-white"
              />
              {(recordsFilterChallan || recordsFilterStatus !== "all" || recordsFilterDate) && (
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-gray-500"
                  onClick={() => { setRecordsFilterChallan(""); setRecordsFilterStatus("all"); setRecordsFilterDate(""); }}>
                  Clear
                </Button>
              )}
            </div>

            {recordsLoading ? (
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
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 sm:py-16">
                <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <ClipboardList className="h-7 w-7 text-gray-400" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-1">No job work records yet</h3>
                <p className="text-xs sm:text-sm text-gray-500 text-center max-w-xs mb-4">
                  Create your first material out to start tracking outsourced processing.
                </p>
                <Button size="sm" onClick={() => router.push(`/${company}/transfer/job-work/material-out`)} className="bg-gray-900 hover:bg-gray-800 text-white h-9 px-4 text-xs sm:text-sm">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> New Material Out
                </Button>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden sm:block">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 text-xs">Challan No</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 text-xs">Status</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 text-xs">From → To</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 text-xs">Item Description</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 text-xs hidden lg:table-cell">Date</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600 text-xs hidden lg:table-cell">Total Qty</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600 text-xs">Net Wt (Kg)</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600 text-xs">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((rec, idx) => (
                        <tr key={rec.id} className={`border-b last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-gray-50`}>
                          <td className="px-4 py-3 font-mono text-xs font-medium">
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-default underline decoration-dotted underline-offset-2">{rec.challan_no}</span>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="right"
                                  sideOffset={6}
                                  className="!bg-gradient-to-br !from-sky-50 !via-indigo-50 !to-violet-100 !text-slate-800 border border-indigo-200/70 shadow-lg shadow-indigo-200/40 rounded-lg max-w-xs text-xs p-3 space-y-1.5"
                                >
                                  <div className="font-semibold text-indigo-900 pb-1 border-b border-indigo-200/60">{rec.challan_no}</div>
                                  <div><span className="font-semibold text-indigo-700">Status:</span> <span className="text-slate-700">{rec.status}</span></div>
                                  <div><span className="font-semibold text-indigo-700">From → To:</span> <span className="text-slate-700">{getDisplayWarehouseName(rec.from_warehouse)} → {rec.to_party}</span></div>
                                  <div><span className="font-semibold text-indigo-700">Date:</span> <span className="text-slate-700">{rec.job_work_date}</span></div>
                                  <div><span className="font-semibold text-indigo-700">Qty / Net Wt:</span> <span className="text-slate-700">{rec.total_qty} pcs · {(rec.total_net_weight || rec.total_weight)?.toFixed(2)} Kg</span></div>
                                  {(rec as any).sub_category && (
                                    <div><span className="font-semibold text-indigo-700">Process:</span> <span className="text-slate-700">{(rec as any).sub_category}</span></div>
                                  )}
                                  {rec.item_descriptions && (
                                    <div><span className="font-semibold text-indigo-700">Items:</span> <span className="text-slate-700">{rec.item_descriptions}</span></div>
                                  )}
                                  {rec.remarks && (
                                    <div><span className="font-semibold text-indigo-700">Reason:</span> <span className="text-slate-700">{rec.remarks}</span></div>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </td>
                          <td className="px-4 py-3"><StatusReceiveHover rec={rec}>{getStatusBadge(rec.status)}</StatusReceiveHover></td>
                          <td className="px-4 py-3 text-xs">{getDisplayWarehouseName(rec.from_warehouse)} → {rec.to_party}</td>
                          <td className="px-4 py-3 text-xs max-w-[250px] truncate" title={rec.item_descriptions}>{rec.item_descriptions || "-"}</td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap hidden lg:table-cell">{rec.job_work_date}</td>
                          <td className="px-4 py-3 text-right text-xs font-medium hidden lg:table-cell">{rec.total_qty}</td>
                          <td className="px-4 py-3 text-right text-xs font-medium">{(rec.total_net_weight || rec.total_weight).toFixed(2)}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {(rec.status === 'sent' || rec.status === 'partially_received') && (
                                <Button variant="ghost" size="sm" title="Add Stock (Material In)"
                                  onClick={() => handleAddStock(rec.challan_no)}
                                  className="h-7 w-7 p-0 text-teal-600 hover:text-teal-800 hover:bg-teal-50">
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" title="Edit"
                                onClick={() => router.push(`/${company}/transfer/job-work/material-out?edit=${rec.id}`)}
                                className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" title="DC Print"
                                onClick={() => router.push(`/${company}/transfer/job-work/dc/${rec.challan_no}`)}
                                className="h-7 w-7 p-0 text-violet-600 hover:text-violet-800 hover:bg-violet-50">
                                <Printer className="h-3.5 w-3.5" />
                              </Button>
                              {canDelete && (
                                <Button variant="ghost" size="sm" title="Delete"
                                  onClick={() => handleDeleteRecord(rec.id, rec.challan_no)}
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">
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

                {/* Mobile Cards */}
                <div className="sm:hidden p-3 space-y-3">
                  {records.map((rec) => (
                    <div key={rec.id} className="bg-white border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold">{rec.challan_no}</span>
                        <StatusReceiveHover rec={rec}>{getStatusBadge(rec.status)}</StatusReceiveHover>
                      </div>
                      <div className="text-xs text-gray-600">{getDisplayWarehouseName(rec.from_warehouse)} → {rec.to_party}</div>
                      {rec.item_descriptions && (
                        <div className="text-xs text-gray-700 truncate">{rec.item_descriptions}</div>
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{rec.job_work_date}</span>
                        <span>Qty: {rec.total_qty} | Net Wt: {(rec.total_net_weight || rec.total_weight).toFixed(2)} kg</span>
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t flex-wrap">
                        {(rec.status === 'sent' || rec.status === 'partially_received') && (
                          <Button variant="outline" size="sm"
                            onClick={() => handleAddStock(rec.challan_no)}
                            className="h-7 px-2.5 text-[10px] text-teal-600 border-teal-200">
                            <Plus className="h-3 w-3 mr-1" /> Add Stock
                          </Button>
                        )}
                        <Button variant="outline" size="sm"
                          onClick={() => router.push(`/${company}/transfer/job-work/material-out?edit=${rec.id}`)}
                          className="h-7 px-2.5 text-[10px] text-blue-600 border-blue-200">
                          <Pencil className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button variant="outline" size="sm"
                          onClick={() => router.push(`/${company}/transfer/job-work/dc/${rec.challan_no}`)}
                          className="h-7 px-2.5 text-[10px] text-violet-600 border-violet-200">
                          <Printer className="h-3 w-3 mr-1" /> DC Print
                        </Button>
                        {canDelete && (
                          <Button variant="outline" size="sm"
                            onClick={() => handleDeleteRecord(rec.id, rec.challan_no)}
                            className="h-7 px-2.5 text-[10px] text-red-500 border-red-200">
                            <Trash2 className="h-3 w-3 mr-1" /> Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {recordsTotalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t bg-gray-50/50 gap-2">
                    <p className="text-xs text-muted-foreground">
                      Showing {((recordsPage - 1) * 15) + 1}-{Math.min(recordsPage * 15, recordsTotal)} of {recordsTotal}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => loadRecords(recordsPage - 1)} disabled={recordsPage === 1} className="h-8 px-3 text-xs">Prev</Button>
                      <span className="text-xs font-medium text-gray-700 tabular-nums">{recordsPage} / {recordsTotalPages}</span>
                      <Button variant="outline" size="sm" onClick={() => loadRecords(recordsPage + 1)} disabled={recordsPage === recordsTotalPages} className="h-8 px-3 text-xs">Next</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════ */}
        {/*  TAB: REPORTS / DASHBOARD                  */}
        {/* ══════════════════════════════════════════ */}
        <TabsContent value="reports" className="mt-4 space-y-4">

          {/* ─── Filters ─── */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-indigo-50 to-blue-50 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-indigo-600" />
                  Filters
                  {rptActiveFilters > 0 && <span className="ml-1 text-[10px] font-semibold bg-indigo-600 text-white rounded-full px-1.5 py-0.5 leading-none">{rptActiveFilters}</span>}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {rptLoading && <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />}
                  {rptActiveFilters > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => {
                      setRptFilterProcess("all"); setRptFilterVendor("all"); setRptFilterItem("all"); setRptFilterFrom(""); setRptFilterTo("")
                    }} className="h-8 px-3 text-xs text-red-500 hover:text-red-600 hover:bg-red-50">
                      Clear All
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mr-1">Quick range</span>
                {[
                  { label: "Today", fn: () => { const d = ymdLocal(new Date()); setRptFilterFrom(d); setRptFilterTo(d) } },
                  { label: "This Month", fn: () => { const n = new Date(); setRptFilterFrom(ymdLocal(new Date(n.getFullYear(), n.getMonth(), 1))); setRptFilterTo(ymdLocal(n)) } },
                  { label: "Last Month", fn: () => { const n = new Date(); setRptFilterFrom(ymdLocal(new Date(n.getFullYear(), n.getMonth() - 1, 1))); setRptFilterTo(ymdLocal(new Date(n.getFullYear(), n.getMonth(), 0))) } },
                  { label: "All Time", fn: () => { setRptFilterFrom(""); setRptFilterTo("") } },
                ].map(p => (
                  <button key={p.label} onClick={p.fn}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${(p.label === "All Time" && !rptFilterFrom && !rptFilterTo) ? "bg-[#0f172a] text-white border-[#0f172a]" : "bg-white hover:bg-slate-100 border-slate-200"}`}>{p.label}</button>
                ))}
              </div>
              <div className="space-y-2.5">
                {/* Process chips */}
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-14 flex-shrink-0 pt-1.5">Process</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setRptFilterProcess("all")} className={fchip(isAll(rptFilterProcess))}>All</button>
                    {rptFilterOpts.sub_categories.map((s: string) => (
                      <button key={s} onClick={() => setRptFilterProcess(s)} className={fchip(rptFilterProcess === s)} title={s}>{s}</button>
                    ))}
                  </div>
                </div>
                {/* Vendor chips */}
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-14 flex-shrink-0 pt-1.5">Vendor</span>
                  <div className="flex flex-wrap gap-1.5 max-h-[88px] overflow-y-auto pr-1">
                    <button onClick={() => setRptFilterVendor("all")} className={fchip(isAll(rptFilterVendor))}>All</button>
                    {rptFilterOpts.vendors.map((v: string) => (
                      <button key={v} onClick={() => setRptFilterVendor(v)} className={fchip(rptFilterVendor === v)} title={v}>{v.length > 24 ? v.slice(0, 24) + "…" : v}</button>
                    ))}
                  </div>
                </div>
                {/* Item chips */}
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-14 flex-shrink-0 pt-1.5">Item</span>
                  <div className="flex flex-wrap gap-1.5 max-h-[88px] overflow-y-auto pr-1">
                    <button onClick={() => setRptFilterItem("all")} className={fchip(isAll(rptFilterItem))}>All</button>
                    {rptFilterOpts.items.map((i: string) => (
                      <button key={i} onClick={() => setRptFilterItem(i)} className={fchip(rptFilterItem === i)} title={i}>{i.length > 24 ? i.slice(0, 24) + "…" : i}</button>
                    ))}
                  </div>
                </div>
                {/* Date range */}
                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-14 flex-shrink-0">Dates</span>
                  <Input type="date" value={rptFilterFrom} onChange={(e) => setRptFilterFrom(e.target.value)} className="h-8 text-xs w-[150px]" />
                  <span className="text-gray-400 text-xs">to</span>
                  <Input type="date" value={rptFilterTo} onChange={(e) => setRptFilterTo(e.target.value)} className="h-8 text-xs w-[150px]" />
                </div>
              </div>
            </CardContent>
          </Card>

          {rptLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          ) : rptData ? (
            <>
              {/* ─── KPI Cards ─── */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  { label: "Total JWOs", value: `${rptSummary.total_jwo ?? 0}`, icon: ClipboardList, color: "bg-blue-100 text-blue-600", sub: `${rptSummary.total_irs || 0} receipts` },
                  { label: "Dispatched", value: `${(rptSummary.total_dispatched_kgs || 0).toLocaleString()} kg`, icon: Send, color: "bg-indigo-100 text-indigo-600", sub: `${rptSummary.unique_vendors || 0} vendors` },
                  { label: "FG Received", value: `${(rptSummary.total_fg_kgs || 0).toLocaleString()} kg`, icon: Package, color: "bg-emerald-100 text-emerald-600", sub: `Yield ${pctOf(rptSummary.total_fg_kgs || 0, rptSummary.total_dispatched_kgs || 0)}%` },
                  { label: "Waste + Rejection", value: `${((rptSummary.total_waste_kgs || 0) + (rptSummary.total_rejection_kgs || 0)).toLocaleString()} kg`, icon: Trash2, color: "bg-orange-100 text-orange-600", sub: `${pctOf((rptSummary.total_waste_kgs || 0) + (rptSummary.total_rejection_kgs || 0), rptSummary.total_dispatched_kgs || 0)}% of sent` },
                  { label: "Unaccounted", value: `${(rptSummary.unaccounted_kgs || 0).toLocaleString()} kg`, icon: AlertTriangle, color: "bg-amber-100 text-amber-600", amber: (rptSummary.unaccounted_kgs || 0) > 0.01, sub: `${pctOf(rptSummary.unaccounted_kgs || 0, rptSummary.total_dispatched_kgs || 0)}% of sent` },
                  { label: "Overall Loss", value: `${rptSummary.overall_loss_pct || 0}%`, icon: TrendingUp, color: "bg-red-100 text-red-600", red: (rptSummary.overall_loss_pct || 0) > 10, sub: "dispatched − FG" },
                ].map((kpi: any, idx: number) => (
                  <Card key={idx} className={`overflow-hidden hover:shadow-md transition-shadow ${kpi.red ? "border-red-300 bg-red-50/60 dark:bg-red-950/30" : kpi.amber ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20" : ""}`}>
                    <CardContent className="p-3">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center mb-2 ${kpi.color}`}>
                        <kpi.icon className="h-4 w-4" />
                      </div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{kpi.label}</p>
                      <p className={`text-base font-bold tabular-nums break-all leading-tight mt-0.5 ${kpi.red ? "text-red-700 dark:text-red-400" : ""}`}>{kpi.value}</p>
                      {kpi.sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{kpi.sub}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* ─── Analysis: worst-loss processes + monthly trend ─── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" /> Highest Loss by Process
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-1.5">
                    {(() => {
                      const rows = (rptByProcess || [])
                        .filter((p: any) => (p.dispatched_kgs || 0) > 0)
                        .map((p: any) => ({ ...p, lossPct: ((p.dispatched_kgs - (p.fg_kgs || 0)) / p.dispatched_kgs) * 100 }))
                        .sort((a: any, b: any) => b.lossPct - a.lossPct)
                        .slice(0, 6)
                      if (!rows.length) return <p className="text-xs text-muted-foreground italic">No process data for this filter.</p>
                      return rows.map((p: any, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-slate-700 truncate flex-1" title={p.process}>{p.process || "—"}</span>
                          <span className="text-[10px] text-slate-400 tabular-nums whitespace-nowrap">{(p.dispatched_kgs || 0).toLocaleString()} kg</span>
                          <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                            <div className="h-2 rounded-full" style={{ width: `${Math.min(100, Math.max(0, p.lossPct))}%`, background: p.lossPct > 15 ? "#ef4444" : p.lossPct > 8 ? "#f59e0b" : "#10b981" }} />
                          </div>
                          <span className={`text-xs font-semibold tabular-nums w-12 text-right ${p.lossPct > 15 ? "text-red-600" : p.lossPct > 8 ? "text-amber-600" : "text-emerald-600"}`}>{p.lossPct.toFixed(1)}%</span>
                        </div>
                      ))
                    })()}
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-indigo-600" /> Monthly Dispatch Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="h-[200px]">
                      {(rptMonthly && rptMonthly.length) ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={rptMonthly} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                            <YAxis tickFormatter={(v: number) => (v >= 1000 ? (v / 1000).toFixed(0) + "K" : String(v))} tick={{ fontSize: 10 }} width={40} />
                            <ReTooltip
                              formatter={(v: any, _n: any, p: any) => [`${Number(v).toLocaleString()} kg · ${p.payload.jwo_count} JWOs`, "Dispatched"]}
                              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                            />
                            <Bar dataKey="dispatched_kgs" radius={[4, 4, 0, 0]} fill="#6366f1" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <p className="text-xs text-muted-foreground italic">No monthly data for this filter.</p>}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ─── Status Distribution ─── */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-indigo-500" /> Status Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(rptStatusCounts).map(([status, count]) => (
                      <div key={status} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-2">
                        {getStatusBadge(status)}
                        <span className="text-sm font-bold text-gray-800 ml-1">{count as number}</span>
                      </div>
                    ))}
                    {Object.keys(rptStatusCounts).length === 0 && <p className="text-xs text-gray-400">No data</p>}
                  </div>
                </CardContent>
              </Card>

              {/* ─── Sub-view Tabs + Search ─── */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                <div className="flex flex-wrap gap-1.5 bg-gray-100 rounded-lg p-1">
                  {[
                    { key: "drill" as const, label: "Drill-down", icon: Layers },
                    { key: "process" as const, label: "By Process", icon: Activity },
                    { key: "vendor" as const, label: "By Vendor", icon: Users },
                    { key: "item" as const, label: "By Item", icon: Box },
                    { key: "trend" as const, label: "Monthly Trend", icon: TrendingUp },
                    { key: "matrix" as const, label: "Vendor × Item", icon: BarChart3 },
                  ].map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setRptActiveView(key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        rptActiveView === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                      }`}>
                      <Icon className="h-3 w-3" />{label}
                    </button>
                  ))}
                </div>
                {rptActiveView !== "trend" && (
                  <div className="relative w-full sm:max-w-[260px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input placeholder="Search within results…" value={rptSearch} onChange={(e) => setRptSearch(e.target.value)} className="h-8 pl-8 pr-7 text-xs" />
                    {rptSearch && <button onClick={() => setRptSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm leading-none">×</button>}
                  </div>
                )}
              </div>

              {/* ─── Drill-down tree: Process → Vendor → Transaction ─── */}
              {rptActiveView === "drill" && (
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="pb-2 pt-4 px-4 border-b">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        <Layers className="h-4 w-4 text-indigo-600" /> {rptGroupBy === "process" ? "Process → Vendor → Transaction" : "Vendor → Process → Transaction"}
                        <span className="text-[10px] font-normal text-gray-400 ml-1 hidden md:inline">click a transaction → Material In · ▸ expand for receipts</span>
                      </CardTitle>
                      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                        <span className="text-[10px] text-gray-400 px-1.5">Group by</span>
                        {(["process", "vendor"] as const).map((g) => (
                          <button key={g} onClick={() => { setRptGroupBy(g); setRptExpanded(new Set()) }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium capitalize transition-colors ${rptGroupBy === g ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {rptTreeLoading ? (
                      <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-indigo-500" /></div>
                    ) : (() => {
                      const q = rptSearch.toLowerCase().trim()
                      const recs = rptAllRecords.filter((r: any) => {
                        if (!isAll(rptFilterProcess) && (r.sub_category || "Unknown") !== rptFilterProcess) return false
                        if (!isAll(rptFilterVendor) && (r.to_party || "—") !== rptFilterVendor) return false
                        if (!isAll(rptFilterItem) && !String(r.item_descriptions || "").includes(rptFilterItem)) return false
                        if (rptFilterFrom && toYmd(r.job_work_date) < rptFilterFrom) return false
                        if (rptFilterTo && toYmd(r.job_work_date) > rptFilterTo) return false
                        if (q && !`${r.challan_no} ${r.to_party} ${r.sub_category} ${r.item_descriptions}`.toLowerCase().includes(q)) return false
                        return true
                      })
                      if (!recs.length) return <p className="px-4 py-8 text-center text-xs text-gray-400">No transactions match the current filters.</p>
                      const procMap: Record<string, any> = {}
                      for (const r of recs) {
                        const p = rptGroupBy === "process" ? (r.sub_category || "Unknown") : (r.to_party || "—")
                        const v = rptGroupBy === "process" ? (r.to_party || "—") : (r.sub_category || "Unknown")
                        const disp = Number(r.total_net_weight) || Number(r.total_weight) || 0
                        const fg = Number(r.fg_received_kgs) || 0
                        const wr = (Number(r.waste_received_kgs) || 0) + (Number(r.rejection_kgs) || 0)
                        const pe = procMap[p] || (procMap[p] = { disp: 0, fg: 0, wr: 0, count: 0, vendors: {} })
                        pe.disp += disp; pe.fg += fg; pe.wr += wr; pe.count++
                        const ve = pe.vendors[v] || (pe.vendors[v] = { disp: 0, fg: 0, wr: 0, count: 0, rows: [] })
                        ve.disp += disp; ve.fg += fg; ve.wr += wr; ve.count++
                        ve.rows.push(r)
                      }
                      // Output % = FG / dispatched (yield). Pending % = (dispatched − FG − waste − rejection) / dispatched (not yet returned).
                      const outPct = (disp: number, fg: number) => disp > 0 ? ((fg / disp) * 100).toFixed(1) : "0.0"
                      const pendPct = (disp: number, fg: number, wr: number) => disp > 0 ? (Math.max(0, (disp - fg - wr)) / disp * 100).toFixed(1) : "0.0"
                      const procs = Object.entries(procMap).sort((a: any, b: any) => b[1].disp - a[1].disp)
                      return (
                        <div className="max-h-[560px] overflow-y-auto">
                          {procs.map(([p, pd]: any) => {
                            const pk = `p:${p}`; const pOpen = rptExpanded.has(pk)
                            return (
                              <div key={pk}>
                                <button onClick={() => toggleExpand(pk)} className="w-full flex items-center gap-2 px-3 py-2.5 bg-[#0f172a] text-white hover:bg-[#1e293b] text-left">
                                  {pOpen ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />}
                                  <span className="font-semibold text-sm flex-1 truncate">{p}</span>
                                  <span className="text-[11px] opacity-70 hidden sm:inline">{pd.count} JWO</span>
                                  <span className="text-[11px] tabular-nums w-24 text-right">{Math.round(pd.disp).toLocaleString()} kg</span>
                                  <span className="text-[11px] text-emerald-300 tabular-nums w-24 text-right hidden sm:inline">FG {Math.round(pd.fg).toLocaleString()}</span>
                                  <span className="text-[11px] text-sky-300 tabular-nums w-16 text-right hidden md:inline" title="Output = FG / dispatched">Out {outPct(pd.disp, pd.fg)}%</span>
                                  <span className="text-[11px] font-semibold tabular-nums w-16 text-right" title="Pending = unreturned / dispatched">Pend {pendPct(pd.disp, pd.fg, pd.wr)}%</span>
                                </button>
                                {pOpen && Object.entries(pd.vendors).sort((a: any, b: any) => b[1].disp - a[1].disp).map(([v, vd]: any) => {
                                  const vk = `${pk}|v:${v}`; const vOpen = rptExpanded.has(vk)
                                  return (
                                    <div key={vk}>
                                      <button onClick={() => toggleExpand(vk)} className="w-full flex items-center gap-2 pl-8 pr-3 py-2 bg-slate-100 hover:bg-slate-200 border-l-[3px] border-l-teal-500 text-left">
                                        {vOpen ? <ChevronDown className="h-3 w-3 flex-shrink-0 text-slate-500" /> : <ChevronRight className="h-3 w-3 flex-shrink-0 text-slate-500" />}
                                        <span className="text-xs font-medium text-slate-700 flex-1 truncate">{v}</span>
                                        <span className="text-[10px] text-slate-500 hidden sm:inline">{vd.count} JWO</span>
                                        <span className="text-[10px] tabular-nums text-slate-600 w-24 text-right">{Math.round(vd.disp).toLocaleString()} kg</span>
                                        <span className="text-[10px] tabular-nums text-sky-600 w-16 text-right hidden md:inline" title="Output">Out {outPct(vd.disp, vd.fg)}%</span>
                                        <span className="text-[10px] font-semibold tabular-nums w-16 text-right text-slate-700" title="Pending">Pend {pendPct(vd.disp, vd.fg, vd.wr)}%</span>
                                      </button>
                                      {vOpen && [...vd.rows].sort((a: any, b: any) => (Number(b.total_net_weight) || 0) - (Number(a.total_net_weight) || 0)).map((r: any) => {
                                        const disp = Number(r.total_net_weight) || Number(r.total_weight) || 0
                                        const fg = Number(r.fg_received_kgs) || 0
                                        const wr = (Number(r.waste_received_kgs) || 0) + (Number(r.rejection_kgs) || 0)
                                        const txOpen = rptTxOpen.has(r.challan_no)
                                        const rc = rptReceipts[r.challan_no]
                                        return (
                                          <div key={r.id}>
                                            <div className="flex items-center gap-2 pl-[40px] pr-3 py-2 bg-white hover:bg-indigo-50/60 border-b last:border-0 text-xs">
                                              <button onClick={() => toggleTx(r.challan_no)} title={`${r.receipt_count || 0} receipt(s)`} className="flex-shrink-0 text-gray-400 hover:text-indigo-600">
                                                {txOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                              </button>
                                              <TooltipProvider delayDuration={200}>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <button onClick={() => handleAddStock(r.challan_no)} className="font-mono text-indigo-700 flex-1 truncate text-left underline decoration-dotted underline-offset-2 hover:text-indigo-900">{r.challan_no}</button>
                                                  </TooltipTrigger>
                                                  <TooltipContent side="right" className="!bg-gradient-to-br !from-sky-50 !via-indigo-50 !to-violet-100 !text-slate-800 border border-indigo-200/70 rounded-lg max-w-xs text-xs p-3 space-y-1">
                                                    <div className="font-semibold text-indigo-900 pb-1 border-b border-indigo-200/60">{r.challan_no}</div>
                                                    <div><span className="text-indigo-700 font-semibold">Date:</span> {r.job_work_date}</div>
                                                    <div><span className="text-indigo-700 font-semibold">Vendor:</span> {r.to_party}</div>
                                                    <div><span className="text-indigo-700 font-semibold">Process:</span> {r.sub_category || "—"}</div>
                                                    <div><span className="text-indigo-700 font-semibold">Dispatched:</span> {Math.round(disp).toLocaleString()} kg</div>
                                                    <div><span className="text-indigo-700 font-semibold">FG / Waste / Rej:</span> {Math.round(fg).toLocaleString()} / {Math.round(Number(r.waste_received_kgs) || 0).toLocaleString()} / {Math.round(Number(r.rejection_kgs) || 0).toLocaleString()} kg</div>
                                                    <div><span className="text-indigo-700 font-semibold">Output:</span> {outPct(disp, fg)}% · <span className="text-indigo-700 font-semibold">Pending:</span> {pendPct(disp, fg, wr)}%</div>
                                                    <div><span className="text-indigo-700 font-semibold">Receipts:</span> {r.receipt_count || 0}</div>
                                                    {r.item_descriptions && <div className="text-slate-600 pt-0.5 border-t border-indigo-200/40">{r.item_descriptions}</div>}
                                                    <div className="text-[10px] text-indigo-500 pt-0.5">Click → Material In · ▸ expand for receipts</div>
                                                  </TooltipContent>
                                                </Tooltip>
                                              </TooltipProvider>
                                              {getStatusBadge(r.status)}
                                              <span className="text-[10px] text-gray-400 w-[74px] text-right hidden sm:inline">{r.job_work_date}</span>
                                              <span className="tabular-nums text-gray-600 w-20 text-right">{Math.round(disp).toLocaleString()} kg</span>
                                              <span className="text-sky-700 tabular-nums w-16 text-right hidden md:inline" title="Output = FG / dispatched">Out {outPct(disp, fg)}%</span>
                                              <span className="font-semibold tabular-nums w-16 text-right" title="Pending = unreturned / dispatched">Pend {pendPct(disp, fg, wr)}%</span>
                                              <Inbox className="h-3.5 w-3.5 text-indigo-300 flex-shrink-0" />
                                            </div>
                                            {txOpen && (
                                              <div className="pl-[64px] pr-3 py-1.5 bg-slate-50/70 border-b">
                                                {!rc || rc.loading ? (
                                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400"><Loader2 className="h-3 w-3 animate-spin" /> Loading receipts…</div>
                                                ) : rc.rows.length === 0 ? (
                                                  <p className="text-[10px] text-slate-400 italic">No receipts recorded yet.</p>
                                                ) : (
                                                  <div className="space-y-1">
                                                    {rc.rows.map((ir: any, i: number) => (
                                                      <div key={ir.ir_number || i} className="flex items-center gap-2 text-[10px] bg-white rounded border border-slate-100 px-2 py-1">
                                                        <span className="font-mono text-slate-600 flex-1 truncate">{ir.ir_number || ir.challan_no || "IR"}</span>
                                                        <span className="text-slate-400 whitespace-nowrap hidden sm:inline">{ir.receipt_date}</span>
                                                        <span className={`px-1.5 py-0.5 rounded border whitespace-nowrap ${ir.receipt_type === "final" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{ir.receipt_type === "final" ? "Final" : "Partial"}</span>
                                                        {ir.inward_warehouse && <span className="text-indigo-600 whitespace-nowrap">WH {getDisplayWarehouseName(ir.inward_warehouse)}</span>}
                                                        <span className="text-emerald-700 whitespace-nowrap">FG {Math.round(Number(ir.total_fg_kgs) || 0).toLocaleString()}</span>
                                                        {Number(ir.total_waste_kgs) > 0 && <span className="text-orange-600 whitespace-nowrap">W {Math.round(Number(ir.total_waste_kgs)).toLocaleString()}</span>}
                                                        {Number(ir.total_rejection_kgs) > 0 && <span className="text-rose-600 whitespace-nowrap">R {Math.round(Number(ir.total_rejection_kgs)).toLocaleString()}</span>}
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </CardContent>
                </Card>
              )}

              {/* ─── By Process ─── */}
              {rptActiveView === "process" && (
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="pb-2 pt-4 px-4 border-b">
                    <CardTitle className="text-sm font-semibold text-gray-800">Process Type Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600">Process</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-600">JWOs</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-600">Dispatched (Kg)</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-600">FG Received (Kg)</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600 w-[200px]">Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fProcess.map((r: any, idx: number) => (
                          <tr key={idx} onClick={() => setRptFilterProcess(r.process)} title={`Filter by process: ${r.process}`} className={`border-b last:border-0 cursor-pointer hover:bg-indigo-50 transition-colors ${rptFilterProcess === r.process ? 'bg-indigo-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                            <td className="px-4 py-2.5 text-xs font-semibold">{r.process}</td>
                            <td className="px-4 py-2.5 text-right text-xs">{r.jwo_count}</td>
                            <td className="px-4 py-2.5 text-right text-xs font-medium">{r.dispatched_kgs.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right text-xs font-medium text-emerald-700">{r.fg_kgs.toLocaleString()}</td>
                            <td className="px-4 py-2.5">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${barWidth(r.dispatched_kgs, rptByProcess[0]?.dispatched_kgs || 1)}%` }} />
                              </div>
                            </td>
                          </tr>
                        ))}
                        {fProcess.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-gray-400">No data</td></tr>}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {/* ─── By Vendor ─── */}
              {rptActiveView === "vendor" && (
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="pb-2 pt-4 px-4 border-b">
                    <CardTitle className="text-sm font-semibold text-gray-800">Vendor Breakdown ({rptSummary.unique_vendors} vendors)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600">Vendor</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-600">JWOs</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-600">Dispatched (Kg)</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600 w-[200px]">Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fVendor.map((r: any, idx: number) => (
                          <tr key={idx} onClick={() => setRptFilterVendor(r.vendor)} title={`Filter by vendor: ${r.vendor}`} className={`border-b last:border-0 cursor-pointer hover:bg-indigo-50 transition-colors ${rptFilterVendor === r.vendor ? 'bg-indigo-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                            <td className="px-4 py-2.5 text-xs font-semibold max-w-[200px]">
                              <TooltipProvider delayDuration={200}><Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="truncate inline-block max-w-[180px] align-bottom cursor-help underline decoration-dotted underline-offset-2" title={r.vendor}>{r.vendor}</span>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="!bg-gradient-to-br !from-sky-50 !via-indigo-50 !to-violet-100 !text-slate-800 border border-indigo-200/70 rounded-lg max-w-xs text-xs p-3 space-y-1">
                                  {(() => {
                                    const txs = rptAllRecords.filter((x: any) => (x.to_party || "—") === r.vendor)
                                    const disp = txs.reduce((s: number, x: any) => s + (Number(x.total_net_weight) || Number(x.total_weight) || 0), 0)
                                    const fg = txs.reduce((s: number, x: any) => s + (Number(x.fg_received_kgs) || 0), 0)
                                    return (<>
                                      <div className="font-semibold text-indigo-900 pb-1 border-b border-indigo-200/60">{r.vendor}</div>
                                      <div><span className="text-indigo-700 font-semibold">JWOs:</span> {r.jwo_count} · <span className="text-indigo-700 font-semibold">Dispatched:</span> {Math.round(r.dispatched_kgs).toLocaleString()} kg</div>
                                      {txs.length > 0 && <div><span className="text-indigo-700 font-semibold">FG:</span> {Math.round(fg).toLocaleString()} kg · <span className="text-indigo-700 font-semibold">Output:</span> {disp > 0 ? (fg / disp * 100).toFixed(1) : "0.0"}%</div>}
                                      {txs.length > 0 && <div className="pt-0.5 border-t border-indigo-200/40 text-[10px] text-slate-500">Recent transactions</div>}
                                      {txs.slice(0, 5).map((x: any, i: number) => (
                                        <div key={i} className="flex justify-between gap-2"><span className="font-mono truncate">{x.challan_no}</span><span className="tabular-nums whitespace-nowrap">{Math.round(Number(x.total_net_weight) || Number(x.total_weight) || 0).toLocaleString()} kg</span></div>
                                      ))}
                                      <div className="text-[10px] text-indigo-500 pt-0.5">Click row → filter by this vendor</div>
                                    </>)
                                  })()}
                                </TooltipContent>
                              </Tooltip></TooltipProvider>
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs">{r.jwo_count}</td>
                            <td className="px-4 py-2.5 text-right text-xs font-medium">{r.dispatched_kgs.toLocaleString()}</td>
                            <td className="px-4 py-2.5">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-teal-500 h-2 rounded-full transition-all" style={{ width: `${barWidth(r.dispatched_kgs, rptByVendor[0]?.dispatched_kgs || 1)}%` }} />
                              </div>
                            </td>
                          </tr>
                        ))}
                        {fVendor.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-400">No data</td></tr>}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {/* ─── By Item ─── */}
              {rptActiveView === "item" && (
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="pb-2 pt-4 px-4 border-b">
                    <CardTitle className="text-sm font-semibold text-gray-800">Item Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600">Item</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-600">JWOs</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-600">Boxes</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-600">Dispatched (Kg)</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600 w-[200px]">Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fItem.map((r: any, idx: number) => (
                          <tr key={idx} onClick={() => setRptFilterItem(r.item)} title={`Filter by item: ${r.item}`} className={`border-b last:border-0 cursor-pointer hover:bg-indigo-50 transition-colors ${rptFilterItem === r.item ? 'bg-indigo-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                            <td className="px-4 py-2.5 text-xs font-semibold max-w-[200px]">
                              <TooltipProvider delayDuration={200}><Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="truncate inline-block max-w-[180px] align-bottom cursor-help underline decoration-dotted underline-offset-2" title={r.item}>{r.item}</span>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="!bg-gradient-to-br !from-sky-50 !via-indigo-50 !to-violet-100 !text-slate-800 border border-indigo-200/70 rounded-lg max-w-xs text-xs p-3 space-y-1">
                                  {(() => {
                                    const txs = rptAllRecords.filter((x: any) => String(x.item_descriptions || "").includes(r.item))
                                    const disp = txs.reduce((s: number, x: any) => s + (Number(x.total_net_weight) || Number(x.total_weight) || 0), 0)
                                    const fg = txs.reduce((s: number, x: any) => s + (Number(x.fg_received_kgs) || 0), 0)
                                    const vendors = Array.from(new Set(txs.map((x: any) => x.to_party).filter(Boolean)))
                                    return (<>
                                      <div className="font-semibold text-indigo-900 pb-1 border-b border-indigo-200/60">{r.item}</div>
                                      <div><span className="text-indigo-700 font-semibold">JWOs:</span> {r.jwo_count} · <span className="text-indigo-700 font-semibold">Dispatched:</span> {Math.round(r.dispatched_kgs).toLocaleString()} kg · <span className="text-indigo-700 font-semibold">Boxes:</span> {r.total_boxes}</div>
                                      {txs.length > 0 && <div><span className="text-indigo-700 font-semibold">FG:</span> {Math.round(fg).toLocaleString()} kg · <span className="text-indigo-700 font-semibold">Output:</span> {disp > 0 ? (fg / disp * 100).toFixed(1) : "0.0"}%</div>}
                                      {vendors.length > 0 && <div className="text-slate-600"><span className="text-indigo-700 font-semibold">Vendors:</span> {vendors.slice(0, 3).join(", ")}{vendors.length > 3 ? ` +${vendors.length - 3}` : ""}</div>}
                                      {txs.length > 0 && <div className="pt-0.5 border-t border-indigo-200/40 text-[10px] text-slate-500">Recent transactions</div>}
                                      {txs.slice(0, 5).map((x: any, i: number) => (
                                        <div key={i} className="flex justify-between gap-2"><span className="font-mono truncate">{x.challan_no}</span><span className="tabular-nums whitespace-nowrap">{Math.round(Number(x.total_net_weight) || Number(x.total_weight) || 0).toLocaleString()} kg</span></div>
                                      ))}
                                      <div className="text-[10px] text-indigo-500 pt-0.5">Click row → filter by this item</div>
                                    </>)
                                  })()}
                                </TooltipContent>
                              </Tooltip></TooltipProvider>
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs">{r.jwo_count}</td>
                            <td className="px-4 py-2.5 text-right text-xs">{r.total_boxes}</td>
                            <td className="px-4 py-2.5 text-right text-xs font-medium">{r.dispatched_kgs.toLocaleString()}</td>
                            <td className="px-4 py-2.5">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${barWidth(r.dispatched_kgs, rptByItem[0]?.dispatched_kgs || 1)}%` }} />
                              </div>
                            </td>
                          </tr>
                        ))}
                        {fItem.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-gray-400">No data</td></tr>}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {/* ─── Monthly Trend ─── */}
              {rptActiveView === "trend" && (
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="pb-2 pt-4 px-4 border-b">
                    <CardTitle className="text-sm font-semibold text-gray-800">Monthly Trend (Last 12 months)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    {rptMonthly.length > 0 ? (
                      <div className="space-y-2">
                        {rptMonthly.map((m: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-3">
                            <span className="text-xs font-mono font-medium text-gray-600 w-[60px]">{m.month}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                              <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full transition-all flex items-center justify-end pr-2"
                                style={{ width: `${barWidth(m.dispatched_kgs, Math.max(...rptMonthly.map((x: any) => x.dispatched_kgs)))}%` }}>
                                <span className="text-[10px] font-semibold text-white">{m.dispatched_kgs.toLocaleString()} kg</span>
                              </div>
                            </div>
                            <span className="text-xs text-gray-500 w-[50px] text-right">{m.jwo_count} JWO{m.jwo_count !== 1 ? 's' : ''}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-xs text-gray-400 py-8">No monthly data available</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ─── Vendor × Item Matrix ─── */}
              {rptActiveView === "matrix" && (
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="pb-2 pt-4 px-4 border-b">
                    <CardTitle className="text-sm font-semibold text-gray-800">Vendor × Item Matrix (Top 20 combinations)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600">Vendor</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600">Item</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-600">JWOs</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-600">Dispatched (Kg)</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600 w-[150px]">Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fMatrix.map((r: any, idx: number) => (
                          <tr key={idx} className={`border-b last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                            <td className="px-4 py-2.5 text-xs font-medium max-w-[150px] truncate" title={r.vendor}>{r.vendor}</td>
                            <td className="px-4 py-2.5 text-xs max-w-[150px] truncate" title={r.item}>{r.item}</td>
                            <td className="px-4 py-2.5 text-right text-xs">{r.jwo_count}</td>
                            <td className="px-4 py-2.5 text-right text-xs font-medium">{r.dispatched_kgs.toLocaleString()}</td>
                            <td className="px-4 py-2.5">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-violet-500 h-2 rounded-full transition-all" style={{ width: `${barWidth(r.dispatched_kgs, rptVendorItem[0]?.dispatched_kgs || 1)}%` }} />
                              </div>
                            </td>
                          </tr>
                        ))}
                        {fMatrix.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-gray-400">No data</td></tr>}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {/* ─── Inward Summary Panel ─── */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4 border-b">
                  <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Inbox className="h-4 w-4 text-teal-600" /> Inward Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-teal-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-teal-700">{rptSummary.total_irs || 0}</p>
                      <p className="text-[10px] text-teal-600 font-medium uppercase">Inward Receipts</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-emerald-700">{(rptSummary.total_fg_kgs || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-emerald-600 font-medium uppercase">FG Received (Kg)</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-orange-700">{(rptSummary.total_waste_kgs || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-orange-600 font-medium uppercase">Waste (Kg)</p>
                    </div>
                    <div className="bg-rose-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-rose-700">{(rptSummary.total_rejection_kgs || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-rose-600 font-medium uppercase">Rejection (Kg)</p>
                    </div>
                  </div>
                  {rptSummary.total_dispatched_kgs > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span>Dispatched vs Accounted</span>
                        <span>{((rptSummary.total_dispatched_kgs - rptSummary.unaccounted_kgs) / rptSummary.total_dispatched_kgs * 100).toFixed(1)}% accounted</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden flex">
                        <div className="bg-emerald-500 h-3" style={{ width: `${(rptSummary.total_fg_kgs / rptSummary.total_dispatched_kgs * 100)}%` }} title={`FG: ${rptSummary.total_fg_kgs} kg`} />
                        <div className="bg-orange-400 h-3" style={{ width: `${(rptSummary.total_waste_kgs / rptSummary.total_dispatched_kgs * 100)}%` }} title={`Waste: ${rptSummary.total_waste_kgs} kg`} />
                        <div className="bg-rose-400 h-3" style={{ width: `${(rptSummary.total_rejection_kgs / rptSummary.total_dispatched_kgs * 100)}%` }} title={`Rejection: ${rptSummary.total_rejection_kgs} kg`} />
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-[10px] text-gray-500">
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />FG</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400" />Waste</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" />Rejection</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-200" />Unaccounted</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border border-dashed border-gray-300">
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="h-16 w-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
                    <BarChart3 className="h-7 w-7 text-indigo-300" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Loading Reports...</h3>
                  <p className="text-xs text-gray-500">Data will appear once loaded.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══ View Inward Receipt Dialog ═══ */}
      <Dialog open={viewIROpen} onOpenChange={setViewIROpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Inbox className="h-4 w-4 text-teal-600" />
              Inward Receipt Details
            </DialogTitle>
          </DialogHeader>

          {viewIRLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
            </div>
          ) : viewIRData ? (
            <div className="space-y-4">
              {/* Receipt Header Info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-gray-50 rounded-lg p-3">
                <div><span className="text-gray-500">IR Number:</span> <span className="font-semibold">{viewIRData.receipt.ir_number}</span></div>
                <div><span className="text-gray-500">Challan No:</span> <span className="font-semibold">{viewIRData.receipt.challan_no || "-"}</span></div>
                <div><span className="text-gray-500">JWO Challan:</span> <span className="font-mono font-semibold">{viewIRData.receipt.jwo_challan}</span></div>
                <div><span className="text-gray-500">Date:</span> <span className="font-semibold">{viewIRData.receipt.receipt_date}</span></div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500">Type:</span>
                  <Badge variant="outline" className={`text-[9px] font-semibold ${viewIRData.receipt.receipt_type === 'final' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-teal-50 text-teal-700 border-teal-200'}`}>
                    {viewIRData.receipt.receipt_type === 'final' ? 'Final' : 'Partial'}
                  </Badge>
                </div>
                <div><span className="text-gray-500">Party:</span> <span className="font-semibold">{viewIRData.receipt.to_party || "-"}</span></div>
                {(viewIRData.receipt.from_warehouse || viewIRData.receipt.inward_warehouse) && (
                  <div className="col-span-2 sm:col-span-3 flex items-center gap-2">
                    {viewIRData.receipt.from_warehouse && (
                      <span className="flex items-center gap-1">
                        <span className="text-gray-500">Dispatched from:</span>
                        <span className="font-semibold bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded">{viewIRData.receipt.from_warehouse}</span>
                      </span>
                    )}
                    {viewIRData.receipt.from_warehouse && viewIRData.receipt.inward_warehouse && (
                      <span className="text-gray-400">→</span>
                    )}
                    {viewIRData.receipt.inward_warehouse && (
                      <span className="flex items-center gap-1">
                        <span className="text-gray-500">Received at:</span>
                        <span className="font-semibold bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded">{viewIRData.receipt.inward_warehouse}</span>
                      </span>
                    )}
                  </div>
                )}
                {viewIRData.receipt.process_type && (
                  <div><span className="text-gray-500">Process:</span> <span className="font-semibold">{viewIRData.receipt.process_type}</span></div>
                )}
                {viewIRData.receipt.vehicle_no && (
                  <div><span className="text-gray-500">Vehicle:</span> <span className="font-semibold">{viewIRData.receipt.vehicle_no}</span></div>
                )}
                {viewIRData.receipt.driver_name && (
                  <div><span className="text-gray-500">Driver:</span> <span className="font-semibold">{viewIRData.receipt.driver_name}</span></div>
                )}
                {viewIRData.receipt.remarks && (
                  <div className="col-span-2 sm:col-span-3"><span className="text-gray-500">Remarks:</span> <span>{viewIRData.receipt.remarks}</span></div>
                )}
              </div>

              {/* Line Items Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-[11px] table-fixed">
                  <colgroup>
                    <col className="w-[4%]" />
                    <col className="w-[26%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[12%]" />
                    <col className="w-[11%]" />
                    <col className="w-[13%]" />
                    <col className="w-[10%]" />
                  </colgroup>
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-1.5 py-1.5 text-left font-medium text-gray-600">#</th>
                      <th className="px-1.5 py-1.5 text-left font-medium text-gray-600">Item</th>
                      <th className="px-1.5 py-1.5 text-right font-medium text-gray-600">Sent</th>
                      <th className="px-1.5 py-1.5 text-right font-medium text-emerald-700 bg-emerald-50">FG (Kg)</th>
                      <th className="px-1.5 py-1.5 text-right font-medium text-orange-700 bg-orange-50">Waste (Kg)</th>
                      <th className="px-1.5 py-1.5 text-right font-medium text-rose-700 bg-rose-50">Reject (Kg)</th>
                      <th className="px-1.5 py-1.5 text-right font-medium text-purple-700 bg-purple-50">Unacctd (Kg)</th>
                      <th className="px-1.5 py-1.5 text-right font-medium text-gray-600">Loss %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewIRData.lines.map((line: any, idx: number) => {
                      const unaccounted = Math.max(0, line.sent_kgs - line.finished_goods_kgs - line.waste_kgs - line.rejection_kgs)
                      const lossPct = line.sent_kgs > 0 ? ((line.waste_kgs + line.rejection_kgs) / line.sent_kgs * 100) : 0
                      const overLimit = line.max_loss_pct > 0 && lossPct > line.max_loss_pct
                      const lpct = (n: number) => line.sent_kgs > 0 ? `${(n / line.sent_kgs * 100).toFixed(1)}%` : "—"
                      return (
                        <Fragment key={idx}>
                          <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                            <td className="px-1.5 py-1.5 text-gray-500">{line.sl_no}</td>
                            <td className="px-1.5 py-1.5 font-medium truncate" title={line.item_description}>{line.item_description}</td>
                            <td className="px-1.5 py-1.5 text-right font-medium">{line.sent_kgs.toFixed(2)}</td>
                            <td className="px-1.5 py-1.5 text-right font-medium text-emerald-700">{line.finished_goods_kgs.toFixed(2)}<div className="text-[9px] text-emerald-400 font-normal leading-tight">({lpct(line.finished_goods_kgs)})</div></td>
                            <td className="px-1.5 py-1.5 text-right font-medium text-orange-700">
                              {line.waste_kgs.toFixed(2)}
                              <div className="text-[9px] text-orange-400 font-normal leading-tight">({lpct(line.waste_kgs)}){line.waste_type ? ` · ${line.waste_type}` : ""}</div>
                            </td>
                            <td className="px-1.5 py-1.5 text-right font-medium text-rose-700">{line.rejection_kgs.toFixed(2)}<div className="text-[9px] text-rose-400 font-normal leading-tight">({lpct(line.rejection_kgs)})</div></td>
                            <td className="px-1.5 py-1.5 text-right font-medium text-purple-700">{unaccounted.toFixed(2)}<div className="text-[9px] text-purple-400 font-normal leading-tight">({lpct(unaccounted)})</div></td>
                            <td className="px-1.5 py-1.5 text-right">
                              <span className={`font-medium ${overLimit ? 'text-red-600' : 'text-gray-700'}`}>{lossPct.toFixed(1)}%</span>
                              {(line.min_loss_pct > 0 || line.max_loss_pct > 0) && (
                                <div className="text-[9px] text-gray-400 leading-tight">{line.min_loss_pct}–{line.max_loss_pct}%</div>
                              )}
                            </td>
                          </tr>
                          {line.line_remarks && (
                            <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                              <td colSpan={8} className="px-1.5 pb-1.5 pt-0 text-[10px] text-gray-500 italic">↳ {line.line_remarks}</td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-100 border-t font-semibold">
                    <tr>
                      {(() => {
                        const tSent = viewIRData.lines.reduce((s: number, l: any) => s + l.sent_kgs, 0)
                        const tFg = viewIRData.lines.reduce((s: number, l: any) => s + l.finished_goods_kgs, 0)
                        const tWaste = viewIRData.lines.reduce((s: number, l: any) => s + l.waste_kgs, 0)
                        const tRej = viewIRData.lines.reduce((s: number, l: any) => s + l.rejection_kgs, 0)
                        const tUn = viewIRData.lines.reduce((s: number, l: any) => s + Math.max(0, l.sent_kgs - l.finished_goods_kgs - l.waste_kgs - l.rejection_kgs), 0)
                        const tp = (n: number) => tSent > 0 ? `${(n / tSent * 100).toFixed(1)}%` : "—"
                        return (<>
                          <td colSpan={2} className="px-1.5 py-1.5 text-gray-700">Total</td>
                          <td className="px-1.5 py-1.5 text-right">{tSent.toFixed(2)}</td>
                          <td className="px-1.5 py-1.5 text-right text-emerald-700">{tFg.toFixed(2)}<div className="text-[9px] text-emerald-500 font-normal leading-tight">({tp(tFg)})</div></td>
                          <td className="px-1.5 py-1.5 text-right text-orange-700">{tWaste.toFixed(2)}<div className="text-[9px] text-orange-500 font-normal leading-tight">({tp(tWaste)})</div></td>
                          <td className="px-1.5 py-1.5 text-right text-rose-700">{tRej.toFixed(2)}<div className="text-[9px] text-rose-500 font-normal leading-tight">({tp(tRej)})</div></td>
                          <td className="px-1.5 py-1.5 text-right text-purple-700">{tUn.toFixed(2)}<div className="text-[9px] text-purple-500 font-normal leading-tight">({tp(tUn)})</div></td>
                          <td className="px-1.5 py-1.5 text-right text-gray-600">{tSent > 0 ? `${((tWaste + tRej) / tSent * 100).toFixed(1)}%` : '—'}</td>
                        </>)
                      })()}
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Cumulative Summary */}
              {viewIRData.cumulative && (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
                  <div className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <BarChart3 className="h-3 w-3" />
                    Cumulative — {viewIRData.cumulative.receipt_count} Receipt{viewIRData.cumulative.receipt_count !== 1 ? 's' : ''} against this JWO
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white rounded p-2 border border-gray-200">
                      <div className="text-gray-500 text-[10px] mb-0.5">Total Dispatched</div>
                      <div className="font-bold text-gray-800">{viewIRData.cumulative.dispatched_kgs.toFixed(2)} Kg</div>
                    </div>
                    <div className="bg-white rounded p-2 border border-emerald-100">
                      <div className="text-emerald-600 text-[10px] mb-0.5">FG Received</div>
                      <div className="font-bold text-emerald-700">{viewIRData.cumulative.cum_fg_kgs.toFixed(2)} Kg <span className="text-[10px] font-normal text-emerald-400">{viewIRData.cumulative.dispatched_kgs > 0 ? `(${(viewIRData.cumulative.cum_fg_kgs / viewIRData.cumulative.dispatched_kgs * 100).toFixed(1)}%)` : ""}</span></div>
                    </div>
                    <div className="bg-white rounded p-2 border border-orange-100">
                      <div className="text-orange-600 text-[10px] mb-0.5">Total Waste</div>
                      <div className="font-bold text-orange-700">{viewIRData.cumulative.cum_waste_kgs.toFixed(2)} Kg <span className="text-[10px] font-normal text-orange-400">{viewIRData.cumulative.dispatched_kgs > 0 ? `(${(viewIRData.cumulative.cum_waste_kgs / viewIRData.cumulative.dispatched_kgs * 100).toFixed(1)}%)` : ""}</span></div>
                    </div>
                    <div className="bg-white rounded p-2 border border-rose-100">
                      <div className="text-rose-600 text-[10px] mb-0.5">Total Rejection</div>
                      <div className="font-bold text-rose-700">{viewIRData.cumulative.cum_rejection_kgs.toFixed(2)} Kg <span className="text-[10px] font-normal text-rose-400">{viewIRData.cumulative.dispatched_kgs > 0 ? `(${(viewIRData.cumulative.cum_rejection_kgs / viewIRData.cumulative.dispatched_kgs * 100).toFixed(1)}%)` : ""}</span></div>
                    </div>
                    <div className="bg-white rounded p-2 border border-purple-100">
                      <div className="text-purple-600 text-[10px] mb-0.5">Unaccounted</div>
                      <div className="font-bold text-purple-700">{viewIRData.cumulative.cum_unaccounted_kgs.toFixed(2)} Kg <span className="text-[10px] font-normal text-purple-400">{viewIRData.cumulative.dispatched_kgs > 0 ? `(${(viewIRData.cumulative.cum_unaccounted_kgs / viewIRData.cumulative.dispatched_kgs * 100).toFixed(1)}%)` : ""}</span></div>
                    </div>
                    <div className="bg-white rounded p-2 border border-amber-100">
                      <div className="text-amber-600 text-[10px] mb-0.5">Remaining to Receive</div>
                      <div className="font-bold text-amber-700">{viewIRData.cumulative.remaining_kgs.toFixed(2)} Kg <span className="text-[10px] font-normal text-amber-400">{viewIRData.cumulative.dispatched_kgs > 0 ? `(${(viewIRData.cumulative.remaining_kgs / viewIRData.cumulative.dispatched_kgs * 100).toFixed(1)}%)` : ""}</span></div>
                    </div>
                    <div className="bg-white rounded p-2 border border-gray-200 sm:col-span-2">
                      <div className="text-gray-500 text-[10px] mb-0.5">Cumulative Loss %</div>
                      <div className={`font-bold ${viewIRData.cumulative.cum_loss_pct > 5 ? 'text-red-600' : 'text-gray-700'}`}>
                        {viewIRData.cumulative.cum_loss_pct.toFixed(2)}%
                        <span className="text-[10px] font-normal text-gray-400 ml-2">(waste + rejection ÷ dispatched)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="text-[10px] text-gray-400 text-right">
                Created by {viewIRData.receipt.created_by || "—"} on {viewIRData.receipt.created_at}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
