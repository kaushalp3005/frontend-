"use client"

import React, { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import type { Company } from "@/types/auth"
import type {
  JobworkDetailRow,
  JobworkSummaryRow,
  InwardReceipt,
  GroupByOption,
  ProcessType,
  JWOStatus,
  LossStatus,
} from "@/types/jobwork"
import {
  Copy, Download, Send, Loader2, ChevronDown,
  ChevronRight, X, Filter, ArrowLeft, Package,
  TrendingUp, AlertTriangle, Clock, CheckCircle, BarChart3,
} from "lucide-react"

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Live data â€” fetched from /job-work/list on mount. Component state
// `jwoRows` is the source of truth used by all the useMemos below.
// The legacy mock array remains only for the dev-fallback case where
// the backend is unreachable; it is NOT used in production renders.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const LOSS_COLORS: Record<string, string> = {
  Normal: "bg-green-100 text-green-800 border-green-300",
  "Excess Loss": "bg-red-100 text-red-800 border-red-300",
  "Underweight Waste": "bg-amber-100 text-amber-800 border-amber-300",
  Pending: "bg-gray-100 text-gray-600 border-gray-300",
}
const STATUS_COLORS: Record<string, string> = {
  Open: "bg-blue-100 text-blue-800 border-blue-300",
  "Partially Received": "bg-orange-100 text-orange-800 border-orange-300",
  "Fully Received": "bg-teal-100 text-teal-800 border-teal-300",
  Reconciled: "bg-purple-100 text-purple-800 border-purple-300",
  Closed: "bg-green-100 text-green-800 border-green-300",
}

const GROUP_OPTIONS: { value: GroupByOption; label: string }[] = [
  { value: "vendor", label: "Vendor" },
  { value: "item", label: "Item" },
  { value: "process_type", label: "Process" },
  { value: "month", label: "Month" },
  { value: "jwo_status", label: "Status" },
]

function fmtKgs(n: number) { return n.toLocaleString("en-IN", { maximumFractionDigits: 0 }) }
function getMonth(d: string) { return d.substring(0, 7) } // "2026-01"
function monthLabel(m: string) {
  const [y, mo] = m.split("-")
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${months[parseInt(mo) - 1]} ${y}`
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface Props { params: { company: Company } }

export default function JobworkDashboardPage({ params }: Props) {
  const { company } = params
  const router = useRouter()
  const { toast } = useToast()

  // Live data
  const [jwoRows, setJwoRows] = useState<JobworkDetailRow[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setDataLoading(true)
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        const res = await fetch(`${apiUrl}/job-work/list?per_page=1000`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        // Map backend rows -> JobworkDetailRow with real per-JWO aggregates.
        const allowedProcesses = ["Deseeding","Cracking","Slicing","Dicing","Thermopacking","Stuffing"] as const
        const normalizeProcess = (raw: any): ProcessType => {
          const s = String(raw || "").trim()
          const hit = allowedProcesses.find((p) => p.toLowerCase() === s.toLowerCase())
          return (hit || "Cracking") as ProcessType
        }
        const computeLossStatus = (lossPct: number, dispatched: number, fg: number, waste: number, rejection: number): LossStatus => {
          if (dispatched <= 0) return "Pending"
          if (fg + waste + rejection === 0) return "Pending"
          if (lossPct > 10) return "Excess Loss"
          if (waste > 0 && (waste / dispatched) * 100 < 2) return "Underweight Waste"
          return "Normal"
        }
        const turnaroundDays = (dispatch: string, lastReceipt: string): number | null => {
          if (!dispatch || !lastReceipt) return null
          const a = Date.parse(dispatch), b = Date.parse(lastReceipt)
          if (isNaN(a) || isNaN(b) || b < a) return null
          return Math.round((b - a) / 86400000)
        }
        const rows: JobworkDetailRow[] = (data.records || []).map((r: any) => {
          const dispatched = Number(r.total_net_weight || r.total_weight || 0)
          const fg = Number(r.fg_received_kgs || 0)
          const waste = Number(r.waste_received_kgs || 0)
          const rejection = Number(r.rejection_kgs || 0)
          const unaccounted = Number(r.unaccounted_kgs || Math.max(0, dispatched - fg - waste - rejection))
          const lossPct = Number(r.actual_loss_pct || 0)
          const jwoStatus: JWOStatus =
            r.status === "received" || r.status === "fully_received" ? "Fully Received"
            : r.status === "partial" || r.status === "partially_received" ? "Partially Received"
            : r.status === "closed" ? "Closed"
            : r.status === "reconciled" ? "Reconciled"
            : "Open"
          return {
            id: Number(r.id),
            jwo_id: r.challan_no || `JWO-${r.id}`,
            dispatch_date: (r.job_work_date || "").substring(0, 10),
            vendor_name: r.to_party || "-",
            item_name: r.item_descriptions || "-",
            process_type: normalizeProcess(r.sub_category),
            qty_dispatched: dispatched,
            fg_received: fg,
            waste_received: waste,
            rejection: rejection,
            unaccounted_balance: unaccounted,
            actual_loss_pct: lossPct,
            loss_status: computeLossStatus(lossPct, dispatched, fg, waste, rejection),
            jwo_status: jwoStatus,
            turnaround_days: turnaroundDays(r.job_work_date || "", r.last_receipt_date || ""),
          }
        })
        if (!cancelled) setJwoRows(rows)
      } catch (e: any) {
        if (!cancelled) {
          toast({ title: "Job Work data error", description: e?.message || "Could not load JWOs from server.", variant: "destructive" })
          setJwoRows([])
        }
      } finally {
        if (!cancelled) setDataLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Filter state
  const [selVendors, setSelVendors] = useState<Set<string>>(new Set())
  const [selItems, setSelItems] = useState<Set<string>>(new Set())
  const [selProcess, setSelProcess] = useState<Set<string>>(new Set())
  const [selStatus, setSelStatus] = useState<Set<string>>(new Set())
  const [selLoss, setSelLoss] = useState<Set<string>>(new Set())
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [groupBy, setGroupBy] = useState<GroupByOption>("vendor")

  // Expansion state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedJWOs, setExpandedJWOs] = useState<Set<number>>(new Set())
  const [jwoReceipts, setJwoReceipts] = useState<Record<number, InwardReceipt[]>>({})
  const [loadingJWOs, setLoadingJWOs] = useState<Set<number>>(new Set())

  // â”€â”€ Filtered data (instant, no page reload) â”€â”€
  const filtered = useMemo(() => {
    return jwoRows.filter(j => {
      if (selVendors.size > 0 && !selVendors.has(j.vendor_name)) return false
      if (selItems.size > 0 && !selItems.has(j.item_name)) return false
      if (selProcess.size > 0 && !selProcess.has(j.process_type)) return false
      if (selStatus.size > 0 && !selStatus.has(j.jwo_status)) return false
      if (selLoss.size > 0 && !selLoss.has(j.loss_status)) return false
      if (dateFrom && j.dispatch_date < dateFrom) return false
      if (dateTo && j.dispatch_date > dateTo) return false
      return true
    })
  }, [selVendors, selItems, selProcess, selStatus, selLoss, dateFrom, dateTo])

  // â”€â”€ Cascading: available options based on current filtered data â”€â”€
  const availableVendors = useMemo(() => [...new Set(jwoRows.filter(j => {
    if (selItems.size > 0 && !selItems.has(j.item_name)) return false
    if (selProcess.size > 0 && !selProcess.has(j.process_type)) return false
    if (selStatus.size > 0 && !selStatus.has(j.jwo_status)) return false
    if (selLoss.size > 0 && !selLoss.has(j.loss_status)) return false
    if (dateFrom && j.dispatch_date < dateFrom) return false
    if (dateTo && j.dispatch_date > dateTo) return false
    return true
  }).map(j => j.vendor_name))].sort(), [selItems, selProcess, selStatus, selLoss, dateFrom, dateTo])

  const availableItems = useMemo(() => [...new Set(jwoRows.filter(j => {
    if (selVendors.size > 0 && !selVendors.has(j.vendor_name)) return false
    if (selProcess.size > 0 && !selProcess.has(j.process_type)) return false
    if (selStatus.size > 0 && !selStatus.has(j.jwo_status)) return false
    if (selLoss.size > 0 && !selLoss.has(j.loss_status)) return false
    if (dateFrom && j.dispatch_date < dateFrom) return false
    if (dateTo && j.dispatch_date > dateTo) return false
    return true
  }).map(j => j.item_name))].sort(), [selVendors, selProcess, selStatus, selLoss, dateFrom, dateTo])

  const availableProcess = useMemo(() => [...new Set(jwoRows.filter(j => {
    if (selVendors.size > 0 && !selVendors.has(j.vendor_name)) return false
    if (selItems.size > 0 && !selItems.has(j.item_name)) return false
    if (selStatus.size > 0 && !selStatus.has(j.jwo_status)) return false
    if (selLoss.size > 0 && !selLoss.has(j.loss_status)) return false
    if (dateFrom && j.dispatch_date < dateFrom) return false
    if (dateTo && j.dispatch_date > dateTo) return false
    return true
  }).map(j => j.process_type))].sort(), [selVendors, selItems, selStatus, selLoss, dateFrom, dateTo])

  const availableStatuses = useMemo(() => [...new Set(jwoRows.filter(j => {
    if (selVendors.size > 0 && !selVendors.has(j.vendor_name)) return false
    if (selItems.size > 0 && !selItems.has(j.item_name)) return false
    if (selProcess.size > 0 && !selProcess.has(j.process_type)) return false
    if (selLoss.size > 0 && !selLoss.has(j.loss_status)) return false
    if (dateFrom && j.dispatch_date < dateFrom) return false
    if (dateTo && j.dispatch_date > dateTo) return false
    return true
  }).map(j => j.jwo_status))], [selVendors, selItems, selProcess, selLoss, dateFrom, dateTo])

  const availableLoss = useMemo(() => [...new Set(jwoRows.filter(j => {
    if (selVendors.size > 0 && !selVendors.has(j.vendor_name)) return false
    if (selItems.size > 0 && !selItems.has(j.item_name)) return false
    if (selProcess.size > 0 && !selProcess.has(j.process_type)) return false
    if (selStatus.size > 0 && !selStatus.has(j.jwo_status)) return false
    if (dateFrom && j.dispatch_date < dateFrom) return false
    if (dateTo && j.dispatch_date > dateTo) return false
    return true
  }).map(j => j.loss_status))], [selVendors, selItems, selProcess, selStatus, dateFrom, dateTo])

  // â”€â”€ KPIs from filtered data â”€â”€
  const kpis = useMemo(() => {
    const total = filtered.length
    const dispatched = filtered.reduce((s, j) => s + j.qty_dispatched, 0)
    const fg = filtered.reduce((s, j) => s + j.fg_received, 0)
    const losses = filtered.filter(j => j.actual_loss_pct > 0).map(j => j.actual_loss_pct)
    const avgLoss = losses.length ? +(losses.reduce((a, b) => a + b, 0) / losses.length).toFixed(1) : 0
    const openPending = filtered.filter(j => j.jwo_status === "Open" || j.jwo_status === "Partially Received").length
    const excessFlags = filtered.filter(j => j.loss_status === "Excess Loss").length
    return { total, dispatched, fg, avgLoss, openPending, excessFlags }
  }, [filtered])

  // â”€â”€ Grouped summary from filtered data â”€â”€
  const grouped = useMemo(() => {
    const map = new Map<string, JobworkDetailRow[]>()
    for (const j of filtered) {
      let key: string
      if (groupBy === "vendor") key = j.vendor_name
      else if (groupBy === "item") key = j.item_name
      else if (groupBy === "process_type") key = j.process_type
      else if (groupBy === "month") key = getMonth(j.dispatch_date)
      else key = j.jwo_status
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(j)
    }

    const rows: (JobworkSummaryRow & { _jwos: JobworkDetailRow[] })[] = []
    for (const [label, jwos] of map) {
      const dispatched = jwos.reduce((s, j) => s + j.qty_dispatched, 0)
      const fg = jwos.reduce((s, j) => s + j.fg_received, 0)
      const waste = jwos.reduce((s, j) => s + j.waste_received, 0)
      const rej = jwos.reduce((s, j) => s + j.rejection, 0)
      const unaccounted = dispatched - fg - waste - rej
      const losses = jwos.filter(j => j.actual_loss_pct > 0).map(j => j.actual_loss_pct)
      const avgLoss = losses.length ? +(losses.reduce((a, b) => a + b, 0) / losses.length).toFixed(1) : 0
      const open = jwos.filter(j => j.jwo_status === "Open" || j.jwo_status === "Partially Received").length
      const overdue = jwos.filter(j => {
        if (j.jwo_status !== "Open" && j.jwo_status !== "Partially Received") return false
        const days = (Date.now() - new Date(j.dispatch_date).getTime()) / 86400000
        return days > 30
      }).length
      const excessFlags = jwos.filter(j => j.loss_status === "Excess Loss").length
      const tatJwos = jwos.filter(j => j.turnaround_days !== null)
      const avgTat = tatJwos.length ? Math.round(tatJwos.reduce((s, j) => s + (j.turnaround_days || 0), 0) / tatJwos.length) : 0

      rows.push({
        group_label: groupBy === "month" ? monthLabel(label) : label,
        num_jwos: jwos.length,
        total_dispatched_kgs: dispatched,
        total_fg_received_kgs: fg,
        total_waste_received_kgs: waste,
        total_rejection_kgs: rej,
        unaccounted_balance_kgs: unaccounted,
        avg_loss_pct: avgLoss,
        open_jwos: open,
        overdue_jwos: overdue,
        excess_loss_flags: excessFlags,
        avg_turnaround_days: avgTat,
        _jwos: jwos,
      })
    }
    rows.sort((a, b) => b.total_dispatched_kgs - a.total_dispatched_kgs)
    return rows
  }, [filtered, groupBy])

  // â”€â”€ Filter count â”€â”€
  const filterCount = [selVendors.size, selItems.size, selProcess.size, selStatus.size, selLoss.size, dateFrom ? 1 : 0, dateTo ? 1 : 0].filter(v => v > 0).length

  // â”€â”€ Toggle helpers (no page reload) â”€â”€
  const toggle = (set: Set<string>, val: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set)
    next.has(val) ? next.delete(val) : next.add(val)
    setter(next)
  }

  const clearAll = () => {
    setSelVendors(new Set()); setSelItems(new Set()); setSelProcess(new Set())
    setSelStatus(new Set()); setSelLoss(new Set()); setDateFrom(""); setDateTo("")
  }

  const toggleGroupRow = (label: string) => {
    const next = new Set(expandedGroups)
    next.has(label) ? next.delete(label) : next.add(label)
    setExpandedGroups(next)
  }

  const toggleJWO = async (id: number) => {
    const next = new Set(expandedJWOs)
    if (next.has(id)) { next.delete(id); setExpandedJWOs(next); return }
    next.add(id)
    setExpandedJWOs(next)
    if (!jwoReceipts[id]) {
      setLoadingJWOs(prev => new Set(prev).add(id))
      await new Promise(r => setTimeout(r, 200))
      setJwoReceipts(prev => ({ ...prev, [id]: [] }))
      setLoadingJWOs(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  // â”€â”€ Copy â”€â”€
  const handleCopy = () => {
    let text = `Jobwork Summary â€” ${company.toUpperCase()} â€” ${new Date().toISOString().split("T")[0]}\n\n`
    text += `Total JWOs       : ${kpis.total}\nTotal Dispatched : ${fmtKgs(kpis.dispatched)} Kgs\n`
    text += `Total FG Recvd   : ${fmtKgs(kpis.fg)} Kgs\nAvg Loss %       : ${kpis.avgLoss}%\n`
    text += `Open JWOs        : ${kpis.openPending}\nExcess Loss Flags: ${kpis.excessFlags}\n\n`
    for (const r of grouped) {
      text += `${r.group_label.padEnd(30)} ${String(r.num_jwos).padStart(3)} JWOs  ${fmtKgs(r.total_dispatched_kgs).padStart(10)} Kgs  ${r.avg_loss_pct}% loss\n`
    }
    navigator.clipboard.writeText(text)
    toast({ title: "Copied to clipboard!" })
  }

  // â”€â”€ Chip component â”€â”€
  const Chip = ({ label, active, available, onClick }: { label: string; active: boolean; available: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      disabled={!available && !active}
      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap
        ${active
          ? "bg-gray-900 text-white border-gray-900"
          : available
            ? "bg-white text-gray-700 border-gray-300 hover:border-gray-500 hover:bg-gray-50"
            : "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed"
        }`}
    >
      {label}
      {active && <span className="ml-1">Ã—</span>}
    </button>
  )

  // â”€â”€ Status chip (colored) â”€â”€
  const StatusChip = ({ label, colorMap }: { label: string; colorMap: Record<string, string> }) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${colorMap[label] || "bg-gray-100 text-gray-600 border-gray-300"}`}>
      {label}
    </span>
  )

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* â”€â”€ Header â”€â”€ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gray-600" />
              Jobwork Summary
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {company.toUpperCase()} &middot; As of {new Date().toISOString().split("T")[0]} &middot; {filtered.length} of {jwoRows.length} JWOs
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}><Copy className="h-3.5 w-3.5 mr-1.5" />Copy</Button>
          <Button variant="outline" size="sm" disabled><Download className="h-3.5 w-3.5 mr-1.5" />Excel</Button>
          <Button variant="outline" size="sm" disabled title="Coming Soon"><Send className="h-3.5 w-3.5 mr-1.5" />WhatsApp</Button>
        </div>
      </div>

      {/* â”€â”€ Filters â”€â”€ */}
      <Card>
        <CardContent className="pt-5 pb-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-semibold">Filters</span>
              {filterCount > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5">{filterCount} active</Badge>
              )}
            </div>
            {filterCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7 text-red-600 hover:text-red-700" onClick={clearAll}>
                <X className="h-3 w-3 mr-1" />Clear all
              </Button>
            )}
          </div>

          {/* Date Range */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Date Range</label>
            <div className="flex items-center gap-2 flex-wrap">
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 h-8 text-xs" />
              <span className="text-xs text-gray-400">to</span>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 h-8 text-xs" />
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-500" onClick={() => { setDateFrom(""); setDateTo("") }}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Vendor */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
              Vendor
              {selVendors.size > 0 && <span className="ml-1 text-gray-900">({selVendors.size})</span>}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[...new Set(jwoRows.map(j => j.vendor_name))].sort().map(v => (
                <Chip key={v} label={v} active={selVendors.has(v)} available={availableVendors.includes(v)} onClick={() => toggle(selVendors, v, setSelVendors)} />
              ))}
            </div>
          </div>

          {/* Item */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
              Item / Article
              {selItems.size > 0 && <span className="ml-1 text-gray-900">({selItems.size})</span>}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[...new Set(jwoRows.map(j => j.item_name))].sort().map(v => (
                <Chip key={v} label={v} active={selItems.has(v)} available={availableItems.includes(v)} onClick={() => toggle(selItems, v, setSelItems)} />
              ))}
            </div>
          </div>

          {/* Process Type */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
              Process Type
              {selProcess.size > 0 && <span className="ml-1 text-gray-900">({selProcess.size})</span>}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(["Deseeding","Cracking","Slicing","Dicing","Thermopacking","Stuffing"] as ProcessType[]).map(v => (
                <Chip key={v} label={v} active={selProcess.has(v)} available={availableProcess.includes(v)} onClick={() => toggle(selProcess, v, setSelProcess)} />
              ))}
            </div>
          </div>

          {/* Status + Loss in one row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
                JWO Status
                {selStatus.size > 0 && <span className="ml-1 text-gray-900">({selStatus.size})</span>}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(["Open","Partially Received","Fully Received","Reconciled","Closed"] as JWOStatus[]).map(v => (
                  <Chip key={v} label={v} active={selStatus.has(v)} available={availableStatuses.includes(v)} onClick={() => toggle(selStatus, v, setSelStatus)} />
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
                Loss Status
                {selLoss.size > 0 && <span className="ml-1 text-gray-900">({selLoss.size})</span>}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(["Normal","Excess Loss","Underweight Waste","Pending"] as LossStatus[]).map(v => (
                  <Chip key={v} label={v} active={selLoss.has(v)} available={availableLoss.includes(v)} onClick={() => toggle(selLoss, v, setSelLoss)} />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* â”€â”€ KPI Cards â”€â”€ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card><CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 mb-1"><Package className="h-4 w-4 text-blue-600" /><span className="text-[11px] font-medium text-gray-500">Total JWOs</span></div>
          <p className="text-2xl font-bold">{kpis.total}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-indigo-600" /><span className="text-[11px] font-medium text-gray-500">Dispatched</span></div>
          <p className="text-2xl font-bold">{fmtKgs(kpis.dispatched)}<span className="text-sm font-normal text-gray-500 ml-1">Kgs</span></p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 mb-1"><CheckCircle className="h-4 w-4 text-green-600" /><span className="text-[11px] font-medium text-gray-500">FG Received</span></div>
          <p className="text-2xl font-bold">{fmtKgs(kpis.fg)}<span className="text-sm font-normal text-gray-500 ml-1">Kgs</span></p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-violet-600" /><span className="text-[11px] font-medium text-gray-500">Avg Loss</span></div>
          <p className="text-2xl font-bold">{kpis.avgLoss}<span className="text-sm font-normal text-gray-500 ml-0.5">%</span></p>
        </CardContent></Card>
        <Card className={kpis.openPending > 0 ? "border-amber-400 bg-amber-50/50" : ""}><CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-amber-600" /><span className="text-[11px] font-medium text-gray-500">Open / Pending</span></div>
          <p className="text-2xl font-bold">{kpis.openPending}</p>
        </CardContent></Card>
        <Card className={kpis.excessFlags > 0 ? "border-red-400 bg-red-50/50" : ""}><CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 mb-1"><AlertTriangle className="h-4 w-4 text-red-600" /><span className="text-[11px] font-medium text-gray-500">Excess Loss</span></div>
          <p className="text-2xl font-bold">{kpis.excessFlags}</p>
        </CardContent></Card>
      </div>

      {/* â”€â”€ Group By Toggle â”€â”€ */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500">Group by:</span>
        {GROUP_OPTIONS.map(o => (
          <button
            key={o.value}
            onClick={() => { setGroupBy(o.value); setExpandedGroups(new Set()); setExpandedJWOs(new Set()) }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all
              ${groupBy === o.value ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* â”€â”€ Summary Table â”€â”€ */}
      {grouped.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No records match your filters</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={clearAll}>Clear all filters</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50/80">
                  <th className="w-8 p-3"></th>
                  <th className="text-left p-3 font-medium text-gray-600 min-w-[160px]">
                    {groupBy === "month" ? "Month" : groupBy === "vendor" ? "Vendor" : groupBy === "item" ? "Item" : groupBy === "process_type" ? "Process" : "Status"}
                  </th>
                  <th className="text-right p-3 font-medium text-gray-600">JWOs</th>
                  <th className="text-right p-3 font-medium text-gray-600">Dispatched</th>
                  <th className="text-right p-3 font-medium text-gray-600">FG Recvd</th>
                  <th className="text-right p-3 font-medium text-gray-600">Waste</th>
                  <th className="text-right p-3 font-medium text-gray-600">Rejection</th>
                  <th className="text-right p-3 font-medium text-gray-600">Unaccounted</th>
                  <th className="text-right p-3 font-medium text-gray-600">Loss %</th>
                  <th className="text-right p-3 font-medium text-gray-600">Open</th>
                  <th className="text-right p-3 font-medium text-gray-600">Overdue</th>
                  <th className="text-right p-3 font-medium text-gray-600">Excess</th>
                  <th className="text-right p-3 font-medium text-gray-600">TAT</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(row => {
                  const isOpen = expandedGroups.has(row.group_label)
                  return (
                    <GroupSection
                      key={row.group_label}
                      row={row}
                      jwos={row._jwos}
                      isOpen={isOpen}
                      onToggle={() => toggleGroupRow(row.group_label)}
                      expandedJWOs={expandedJWOs}
                      jwoReceipts={jwoReceipts}
                      loadingJWOs={loadingJWOs}
                      onToggleJWO={toggleJWO}
                      StatusChip={StatusChip}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// GROUP SECTION (summary row + expandable JWO rows)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function GroupSection({
  row, jwos, isOpen, onToggle, expandedJWOs, jwoReceipts, loadingJWOs, onToggleJWO, StatusChip,
}: {
  row: JobworkSummaryRow
  jwos: JobworkDetailRow[]
  isOpen: boolean
  onToggle: () => void
  expandedJWOs: Set<number>
  jwoReceipts: Record<number, InwardReceipt[]>
  loadingJWOs: Set<number>
  onToggleJWO: (id: number) => void
  StatusChip: any
}) {
  return (
    <>
      <tr className="border-b hover:bg-gray-50/60 cursor-pointer transition-colors" onClick={onToggle}>
        <td className="p-3">{isOpen ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}</td>
        <td className="p-3 font-medium">{row.group_label}</td>
        <td className="p-3 text-right font-medium">{row.num_jwos}</td>
        <td className="p-3 text-right">{fmtKgs(row.total_dispatched_kgs)}</td>
        <td className="p-3 text-right">{fmtKgs(row.total_fg_received_kgs)}</td>
        <td className="p-3 text-right">{fmtKgs(row.total_waste_received_kgs)}</td>
        <td className="p-3 text-right">{fmtKgs(row.total_rejection_kgs)}</td>
        <td className={`p-3 text-right ${row.unaccounted_balance_kgs > 0 ? "text-amber-600 font-medium" : ""}`}>{fmtKgs(row.unaccounted_balance_kgs)}</td>
        <td className="p-3 text-right">{row.avg_loss_pct}%</td>
        <td className="p-3 text-right">{row.open_jwos || "-"}</td>
        <td className={`p-3 text-right ${row.overdue_jwos > 0 ? "text-red-600 font-bold" : ""}`}>{row.overdue_jwos || "-"}</td>
        <td className={`p-3 text-right ${row.excess_loss_flags > 0 ? "text-red-600 font-bold" : ""}`}>{row.excess_loss_flags || "-"}</td>
        <td className="p-3 text-right">{row.avg_turnaround_days || "-"}</td>
      </tr>

      {isOpen && jwos.sort((a, b) => b.dispatch_date < a.dispatch_date ? -1 : 1).map(jwo => {
        const isOverdue = (jwo.jwo_status === "Open" || jwo.jwo_status === "Partially Received") && (Date.now() - new Date(jwo.dispatch_date).getTime()) / 86400000 > 30
        const jwoOpen = expandedJWOs.has(jwo.id)
        const receipts = jwoReceipts[jwo.id] || []
        const isLoadingIR = loadingJWOs.has(jwo.id)

        return (
          <React.Fragment key={jwo.id}>
            <tr
              className={`border-b cursor-pointer transition-colors text-xs ${isOverdue ? "bg-red-50/60" : "bg-gray-50/30"} hover:bg-gray-100/60`}
              onClick={() => onToggleJWO(jwo.id)}
            >
              <td className="p-2.5 pl-8">
                {isLoadingIR ? <Loader2 className="h-3 w-3 animate-spin" /> : jwoOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
              </td>
              <td className="p-2.5">
                <span className="font-mono font-medium text-gray-900">{jwo.jwo_id}</span>
                <span className="text-gray-400 ml-2">{jwo.dispatch_date}</span>
              </td>
              <td className="p-2.5 text-right" colSpan={1}>
                <div className="text-gray-700">{jwo.vendor_name}</div>
                <div className="text-gray-400">{jwo.item_name} &middot; {jwo.process_type}</div>
              </td>
              <td className="p-2.5 text-right">{fmtKgs(jwo.qty_dispatched)}</td>
              <td className="p-2.5 text-right">{fmtKgs(jwo.fg_received)}</td>
              <td className="p-2.5 text-right">{fmtKgs(jwo.waste_received)}</td>
              <td className="p-2.5 text-right">{fmtKgs(jwo.rejection)}</td>
              <td className={`p-2.5 text-right ${jwo.unaccounted_balance > 0 ? "text-amber-600 font-medium bg-amber-50/50" : ""}`}>{fmtKgs(jwo.unaccounted_balance)}</td>
              <td className="p-2.5 text-right">{jwo.actual_loss_pct > 0 ? `${jwo.actual_loss_pct}%` : "-"}</td>
              <td className="p-2.5" colSpan={3}>
                <div className="flex gap-1 justify-end flex-wrap">
                  <StatusChip label={jwo.loss_status} colorMap={LOSS_COLORS} />
                  <StatusChip label={jwo.jwo_status} colorMap={STATUS_COLORS} />
                </div>
              </td>
              <td className="p-2.5 text-right">{jwo.turnaround_days ?? "-"}</td>
            </tr>

            {/* IR receipts */}
            {jwoOpen && receipts.length > 0 && (
              <tr><td colSpan={13} className="p-0">
                <div className="bg-white border-l-4 border-blue-200 ml-14 mr-4 my-1.5 rounded shadow-sm">
                  <table className="w-full text-[11px]">
                    <thead><tr className="border-b bg-blue-50/40">
                      <th className="text-left p-2 font-medium text-gray-500">IR No.</th>
                      <th className="text-left p-2 font-medium text-gray-500">Date</th>
                      <th className="text-left p-2 font-medium text-gray-500">Type</th>
                      <th className="text-right p-2 font-medium text-gray-500">FG Qty</th>
                      <th className="text-right p-2 font-medium text-gray-500">Waste</th>
                      <th className="text-right p-2 font-medium text-gray-500">Rejection</th>
                      <th className="text-right p-2 font-medium text-gray-500">Loss %</th>
                      <th className="text-left p-2 font-medium text-gray-500">Status</th>
                      <th className="text-left p-2 font-medium text-gray-500">Remarks</th>
                    </tr></thead>
                    <tbody>
                      {receipts.map(ir => (
                        <tr key={ir.id} className="border-b last:border-0 hover:bg-blue-50/20">
                          <td className="p-2 font-mono">{ir.ir_number}</td>
                          <td className="p-2">{ir.ir_date}</td>
                          <td className="p-2">
                            <Badge variant={ir.receipt_type === "Final" ? "default" : "outline"} className="text-[9px] h-4">{ir.receipt_type}</Badge>
                          </td>
                          <td className="p-2 text-right">{ir.fg_qty_received}</td>
                          <td className="p-2 text-right">{ir.waste_qty_received}</td>
                          <td className="p-2 text-right">{ir.rejection_qty}</td>
                          <td className="p-2 text-right">{ir.actual_loss_pct}%</td>
                          <td className="p-2"><StatusChip label={ir.loss_status} colorMap={LOSS_COLORS} /></td>
                          <td className="p-2 text-gray-400 max-w-[180px] truncate">{ir.remarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </td></tr>
            )}
            {jwoOpen && receipts.length === 0 && !isLoadingIR && (
              <tr><td colSpan={13} className="p-2.5 pl-14 text-[11px] text-gray-400">No inward receipts recorded</td></tr>
            )}
          </React.Fragment>
        )
      })}
    </>
  )
}

