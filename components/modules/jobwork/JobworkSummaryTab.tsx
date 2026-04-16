"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Copy, Download, RefreshCw, Clock, Package, TrendingUp, CheckCircle, AlertTriangle, Send } from "lucide-react"
import type { Company } from "@/types/auth"
import type {
  GroupByOption, JobworkKPIs, JobworkSummaryRow, JobworkDetailRow, InwardReceipt,
  DashboardSummaryResponse, FilterOptionsResponse,
} from "@/types/jobwork"
import { KPICard } from "./KPICard"
import SummaryFilters from "./SummaryFilters"
import { GroupedTable } from "./GroupedTable"
import { JWODetailDrawer } from "./JWODetailDrawer"
import { SkeletonSummary } from "./SkeletonSummary"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

interface JobworkSummaryTabProps {
  company: Company
}

export function JobworkSummaryTab({ company }: JobworkSummaryTabProps) {
  const { toast } = useToast()

  const [kpis, setKpis] = useState<JobworkKPIs | null>(null)
  const [summaryRows, setSummaryRows] = useState<JobworkSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const [vendors, setVendors] = useState<string[]>([])
  const [items, setItems] = useState<string[]>([])
  const [processTypes, setProcessTypes] = useState<string[]>([])

  const [selVendors, setSelVendors] = useState<Set<string>>(new Set())
  const [selItems, setSelItems] = useState<Set<string>>(new Set())
  const [selProcess, setSelProcess] = useState<Set<string>>(new Set())
  const [selStatus, setSelStatus] = useState<Set<string>>(new Set())
  const [selLoss, setSelLoss] = useState<Set<string>>(new Set())
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [groupBy, setGroupBy] = useState<GroupByOption>("vendor")

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerTitle, setDrawerTitle] = useState("")
  const [drawerJWOs, setDrawerJWOs] = useState<JobworkDetailRow[]>([])
  const [drawerLoading, setDrawerLoading] = useState(false)

  const [minutesAgo, setMinutesAgo] = useState(0)
  useEffect(() => {
    if (!lastUpdated) return
    const interval = setInterval(() => {
      setMinutesAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 60000))
    }, 30000)
    return () => clearInterval(interval)
  }, [lastUpdated])

  useEffect(() => {
    async function loadFilters() {
      try {
        const res = await fetch(`${API_URL}/jobwork/dashboard/filter-options?company=${company}`)
        if (!res.ok) throw new Error("Failed to load filters")
        const data: FilterOptionsResponse = await res.json()
        setVendors(data.vendors.map(v => v.name).sort())
        setItems(data.items.sort())
        setProcessTypes(data.process_types.sort())
      } catch (e: any) {
        toast({ title: "Error loading filters", description: e.message, variant: "destructive" })
      }
    }
    loadFilters()
  }, [company])

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ company, group_by: groupBy })
      if (dateFrom) p.append("date_from", dateFrom)
      if (dateTo) p.append("date_to", dateTo)
      if (selVendors.size) p.append("vendors", [...selVendors].join(","))
      if (selItems.size) p.append("items", [...selItems].join(","))
      if (selProcess.size) p.append("process_types", [...selProcess].join(","))
      if (selStatus.size) p.append("jwo_statuses", [...selStatus].join(","))
      if (selLoss.size) p.append("loss_statuses", [...selLoss].join(","))

      const res = await fetch(`${API_URL}/jobwork/dashboard/summary?${p.toString()}`)
      if (!res.ok) throw new Error("Failed to load summary")
      const data: DashboardSummaryResponse = await res.json()
      setKpis(data.kpis)
      setSummaryRows(data.summary)
      setLastUpdated(new Date())
      setMinutesAgo(0)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [company, groupBy, dateFrom, dateTo, selVendors, selItems, selProcess, selStatus, selLoss])

  const debounceRef = useRef<NodeJS.Timeout>()
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(fetchSummary, 200)
    return () => clearTimeout(debounceRef.current)
  }, [fetchSummary])

  const toggle = (set: Set<string>, val: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set)
    next.has(val) ? next.delete(val) : next.add(val)
    setter(next)
  }

  const clearAll = () => {
    setSelVendors(new Set()); setSelItems(new Set()); setSelProcess(new Set())
    setSelStatus(new Set()); setSelLoss(new Set()); setDateFrom(""); setDateTo("")
  }

  const loadGroupDetails = async (groupLabel: string): Promise<JobworkDetailRow[]> => {
    try {
      const p = new URLSearchParams({ company, group_by: groupBy, group_label: groupLabel })
      if (dateFrom) p.append("date_from", dateFrom)
      if (dateTo) p.append("date_to", dateTo)
      if (selVendors.size) p.append("vendors", [...selVendors].join(","))
      if (selItems.size) p.append("items", [...selItems].join(","))
      if (selProcess.size) p.append("process_types", [...selProcess].join(","))
      if (selStatus.size) p.append("jwo_statuses", [...selStatus].join(","))
      if (selLoss.size) p.append("loss_statuses", [...selLoss].join(","))

      const res = await fetch(`${API_URL}/jobwork/dashboard/group-details?${p.toString()}`)
      if (!res.ok) throw new Error("Failed to load details")
      return await res.json()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
      return []
    }
  }

  const loadJWOReceipts = async (jwoId: number): Promise<InwardReceipt[]> => {
    try {
      const res = await fetch(`${API_URL}/jobwork/dashboard/jwo-receipts/${jwoId}?company=${company}`)
      if (!res.ok) throw new Error("Failed to load receipts")
      return await res.json()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
      return []
    }
  }

  const handleKPIClick = async (metric: string) => {
    setDrawerLoading(true)
    setDrawerTitle(metric)
    setDrawerOpen(true)
    try {
      const p = new URLSearchParams({ company, group_by: groupBy, group_label: "" })
      const res = await fetch(`${API_URL}/jobwork/dashboard/group-details?${p.toString()}`)
      const allJwos: JobworkDetailRow[] = res.ok ? await res.json() : []

      let filtered: JobworkDetailRow[] = []
      if (metric === "Open / Pending") {
        filtered = allJwos.filter(j => j.jwo_status === "Open" || j.jwo_status === "Partially Received")
      } else if (metric === "Excess Loss") {
        filtered = allJwos.filter(j => j.loss_status === "Excess Loss")
      } else {
        filtered = allJwos
      }
      setDrawerJWOs(filtered)
    } catch {
      setDrawerJWOs([])
    } finally {
      setDrawerLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const p = new URLSearchParams({ company, group_by: groupBy })
      if (dateFrom) p.append("date_from", dateFrom)
      if (dateTo) p.append("date_to", dateTo)
      if (selVendors.size) p.append("vendors", [...selVendors].join(","))
      if (selItems.size) p.append("items", [...selItems].join(","))

      const res = await fetch(`${API_URL}/jobwork/dashboard/export-excel?${p.toString()}`)
      if (!res.ok) throw new Error("Export failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Jobwork_Summary_${company}_${new Date().toISOString().split("T")[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" })
    }
  }

  if (loading && !kpis) return <SkeletonSummary />

  const fmtKgs = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="h-3.5 w-3.5" />
          {lastUpdated ? (
            <span>Updated {minutesAgo === 0 ? "just now" : `${minutesAgo}m ago`}</span>
          ) : (
            <span>Loading...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchSummary} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-1.5" />Excel
          </Button>
        </div>
      </div>

      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard label="Total JWOs" value={kpis.total_jwos} icon={Package} iconColor="text-blue-600" onClick={() => handleKPIClick("Total JWOs")} />
          <KPICard label="Net Dispatched" value={kpis.total_dispatched_kgs} suffix="Kgs" icon={TrendingUp} iconColor="text-indigo-600" formatValue={fmtKgs} />
          <KPICard label="FG Received" value={kpis.total_fg_received_kgs} suffix="Kgs" icon={CheckCircle} iconColor="text-green-600" formatValue={fmtKgs} />
          <KPICard label="Avg Loss" value={kpis.avg_loss_pct} suffix="%" icon={TrendingUp} iconColor="text-violet-600" />
          <KPICard
            label="Open / Pending" value={kpis.open_pending_jwos} icon={Send} iconColor="text-amber-600"
            borderColor={kpis.open_pending_jwos > 0 ? "border-amber-400" : ""} bgColor={kpis.open_pending_jwos > 0 ? "bg-amber-50/50" : ""}
            onClick={() => handleKPIClick("Open / Pending")}
          />
          <KPICard
            label="Excess Loss" value={kpis.excess_loss_flags} icon={AlertTriangle} iconColor="text-red-600"
            borderColor={kpis.excess_loss_flags > 0 ? "border-red-400" : ""} bgColor={kpis.excess_loss_flags > 0 ? "bg-red-50/50" : ""}
            pulse={kpis.excess_loss_flags > 0}
            onClick={() => handleKPIClick("Excess Loss")}
          />
        </div>
      )}

      <SummaryFilters
        vendors={vendors} items={items} processTypes={processTypes}
        selVendors={selVendors} selItems={selItems} selProcess={selProcess}
        selStatus={selStatus} selLoss={selLoss} dateFrom={dateFrom} dateTo={dateTo}
        groupBy={groupBy}
        onToggleVendor={(v: string) => toggle(selVendors, v, setSelVendors)}
        onToggleItem={(v: string) => toggle(selItems, v, setSelItems)}
        onToggleProcess={(v: string) => toggle(selProcess, v, setSelProcess)}
        onToggleStatus={(v: string) => toggle(selStatus, v, setSelStatus)}
        onToggleLoss={(v: string) => toggle(selLoss, v, setSelLoss)}
        onDateFromChange={setDateFrom} onDateToChange={setDateTo}
        onGroupByChange={setGroupBy} onClearAll={clearAll}
      />

      <GroupedTable
        rows={summaryRows} groupBy={groupBy} company={company}
        onLoadGroupDetails={loadGroupDetails} onLoadJWOReceipts={loadJWOReceipts}
      />

      <JWODetailDrawer
        open={drawerOpen} onOpenChange={setDrawerOpen}
        title={drawerTitle} jwos={drawerJWOs} loading={drawerLoading}
      />

      {/* AI Insights — TODO: uncomment when ready
      <AIInsightsPanel company={company} kpis={kpis} summaryRows={summaryRows} />
      */}
    </div>
  )
}
