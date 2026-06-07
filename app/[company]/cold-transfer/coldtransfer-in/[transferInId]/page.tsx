"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft, Package, Inbox, Calendar, MapPin, User,
  FileText, Loader2, Hash, Snowflake, Building2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { InterunitApiService } from "@/lib/interunitApiService"
import type { Company } from "@/types/auth"

// Cold Transfer-In view page. Reads the dedicated cold tables via
// getColdTransferInById(id) → GET /interunit/cold-transfer-in/{id}, which returns the
// full cold_transfer_in_headers + cold_transfer_inboxes detail (all cold-storage fields).
interface ColdTransferInViewPageProps {
  params: {
    company: Company
    transferInId: string
  }
}

export default function ColdTransferInViewPage({ params }: ColdTransferInViewPageProps) {
  const { company, transferInId } = params
  const router = useRouter()
  const { toast } = useToast()

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const result = await InterunitApiService.getColdTransferInById(Number(transferInId))
        setData(result)
      } catch (err: any) {
        console.error("Failed to load transfer-in:", err)
        toast({ title: "Error", description: err.message || "Failed to load transfer-in details", variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [transferInId, toast])

  const formatDate = (d: any) => {
    if (!d) return "N/A"
    try {
      // Already a dd-mm-yyyy string? keep it.
      if (typeof d === "string" && /^\d{2}-\d{2}-\d{4}$/.test(d)) return d
      return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-")
    } catch { return "N/A" }
  }

  const num = (v: any) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  const money = (v: any) => {
    const n = Number(v)
    if (!Number.isFinite(n) || n === 0) return null
    return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
  }
  const has = (v: any) => v !== null && v !== undefined && String(v).trim() !== ""

  // Group boxes by article (item_description)
  const groupedBoxes = useMemo(() => {
    if (!data?.boxes) return {} as Record<string, any[]>
    const groups: Record<string, any[]> = {}
    data.boxes.forEach((b: any) => {
      const article = b.article || b.item_description || "Unknown"
      if (!groups[article]) groups[article] = []
      groups[article].push(b)
    })
    return groups
  }, [data])

  const totalBoxes = data?.boxes?.length || 0
  const totalCartons = data?.boxes?.reduce((s: number, b: any) => s + num(b.no_of_cartons), 0) || 0
  const totalNetWeight = data?.boxes?.reduce((s: number, b: any) => s + num(b.net_weight ?? b.weight_kg), 0) || 0
  const totalValue = data?.boxes?.reduce((s: number, b: any) => s + num(b.value), 0) || 0

  // Header-level cold-storage detail fields (label + value), only the ones that exist.
  const headerDetails = data ? [
    ["Item Description", data.item_description],
    ["Vakkal", data.vakkal],
    ["Lot No", data.lot_no],
    ["Item Mark", data.item_mark],
    ["Group", data.group_name],
    ["Sub Group", data.item_subgroup],
    ["Storage Location", data.storage_location],
    ["Exporter", data.exporter],
    ["Rate (₹/kg)", money(data.rate)],
    ["Value", money(data.value)],
    ["Inward Date", has(data.inward_dt) ? formatDate(data.inward_dt) : null],
    ["Inward Txn No", data.inward_transaction_no],
  ].filter(([, v]) => has(v)) : []

  if (loading) {
    return (
      <div className="p-3 sm:p-4 lg:p-6 max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()} className="h-9 w-9 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading transfer-in details...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-3 sm:p-4 lg:p-6 max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()} className="h-9 w-9 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <p className="text-sm text-muted-foreground">Transfer-in not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-5xl mx-auto space-y-4 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()} className="h-9 w-9 p-0 bg-white border-gray-200 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Inbox className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600" />
            {data.grn_number || `Cold GRN #${data.id}`}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Cold Transfer IN — {data.transfer_out_no || "—"}
            {has(data.to_company) && <span className="ml-1 uppercase">({data.to_company})</span>}
          </p>
        </div>
        <Badge variant="outline" className={`text-xs px-2.5 py-1 ${
          data.status === "Received" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
          "bg-amber-50 text-amber-700 border-amber-200"
        }`}>
          {data.status || "Pending"}
        </Badge>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <MapPin className="h-3.5 w-3.5" />
              <span className="text-[11px] uppercase tracking-wider font-medium">From (Sender)</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">{data.from_warehouse || data.from_site || "N/A"}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <Snowflake className="h-3.5 w-3.5" />
              <span className="text-[11px] uppercase tracking-wider font-medium">To (Cold)</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">{data.receiving_warehouse || data.to_site || "N/A"}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <User className="h-3.5 w-3.5" />
              <span className="text-[11px] uppercase tracking-wider font-medium">Received By</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">{data.received_by || "N/A"}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <Calendar className="h-3.5 w-3.5" />
              <span className="text-[11px] uppercase tracking-wider font-medium">GRN Date</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">{formatDate(data.grn_date)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <Building2 className="h-3.5 w-3.5" />
              <span className="text-[11px] uppercase tracking-wider font-medium">Company</span>
            </div>
            <p className="text-sm font-semibold text-gray-900 uppercase">{data.to_company || "N/A"}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <Package className="h-3.5 w-3.5" />
              <span className="text-[11px] uppercase tracking-wider font-medium">Condition</span>
            </div>
            <Badge variant="outline" className={`text-xs ${
              data.box_condition === "Good" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
              data.box_condition === "Damaged" ? "bg-red-50 text-red-700 border-red-200" :
              "bg-orange-50 text-orange-700 border-orange-200"
            }`}>{data.box_condition || "N/A"}</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Cold Storage Details (header-level) */}
      {headerDetails.length > 0 && (
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-sky-50 to-blue-50 border-b">
            <CardTitle className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
              <Snowflake className="h-5 w-5 text-sky-600" />
              Cold Storage Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
              {headerDetails.map(([label, value]) => (
                <div key={String(label)} className="min-w-0">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
                  <p className="text-sm font-medium text-gray-800 break-words">{String(value)}</p>
                </div>
              ))}
            </div>
            {has(data.spl_remarks) && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-0.5">Special Remarks</p>
                <p className="text-sm text-gray-800">{data.spl_remarks}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Condition Remarks */}
      {has(data.condition_remarks) && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs text-muted-foreground mb-1">Condition Remarks</p>
            <p className="text-sm text-gray-800">{data.condition_remarks}</p>
          </CardContent>
        </Card>
      )}

      {/* Totals Summary */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-3 sm:p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center p-2.5 bg-blue-50/60 rounded-lg">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Total Boxes</p>
              <p className="text-lg font-bold text-blue-700">{totalBoxes}</p>
            </div>
            <div className="text-center p-2.5 bg-violet-50/60 rounded-lg">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Total Cartons</p>
              <p className="text-lg font-bold text-violet-700">{totalCartons}</p>
            </div>
            <div className="text-center p-2.5 bg-indigo-50/60 rounded-lg">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Net Weight</p>
              <p className="text-lg font-bold text-indigo-700">{totalNetWeight.toFixed(2)} kg</p>
            </div>
            <div className="text-center p-2.5 bg-emerald-50/60 rounded-lg">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Total Value</p>
              <p className="text-lg font-bold text-emerald-700">{totalValue > 0 ? "₹" + totalValue.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Boxes by Article */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-violet-50 to-blue-50 border-b">
          <CardTitle className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
            <FileText className="h-5 w-5 text-violet-600" />
            Received Items ({totalBoxes})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {Object.entries(groupedBoxes).map(([articleName, artBoxes]) => {
            const first = artBoxes[0] || {}
            const chips: [string, any][] = [
              ["Vakkal", first.vakkal],
              ["Mark", first.item_mark],
              ["Group", first.group_name],
              ["Sub", first.item_subgroup],
              ["Location", first.storage_location],
              ["Exporter", first.exporter],
              ["Rate", money(first.rate)],
            ].filter(([, v]) => has(v)) as [string, any][]
            const grpCartons = artBoxes.reduce((s, b: any) => s + num(b.no_of_cartons), 0)
            const grpWeight = artBoxes.reduce((s, b: any) => s + num(b.net_weight ?? b.weight_kg), 0)
            return (
              <div key={articleName} className="border-b last:border-b-0">
                {/* Article group header */}
                <div className="px-3 sm:px-4 py-2.5 bg-gray-50/80">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                        <Package className="h-3.5 w-3.5 text-violet-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate">{articleName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {artBoxes.length} box{artBoxes.length !== 1 ? "es" : ""} · {grpCartons} cartons · {grpWeight.toFixed(2)} kg
                        </p>
                      </div>
                    </div>
                  </div>
                  {chips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {chips.map(([label, value]) => (
                        <span key={label} className="inline-flex items-center gap-1 text-[11px] bg-white border border-gray-200 rounded px-1.5 py-0.5">
                          <span className="text-gray-400">{label}:</span>
                          <span className="font-medium text-gray-700">{String(value)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/40 border-b text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        <th className="text-left py-2 px-3 w-[50px]">#</th>
                        <th className="text-left py-2 px-3">Box ID</th>
                        <th className="text-left py-2 px-3">Transaction No</th>
                        <th className="text-left py-2 px-3">Lot No</th>
                        <th className="text-left py-2 px-3">Unit</th>
                        <th className="text-right py-2 px-3">Cartons</th>
                        <th className="text-right py-2 px-3">Net Wt</th>
                        <th className="text-right py-2 px-3">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {artBoxes.map((b: any, idx: number) => (
                        <tr key={b.id}>
                          <td className="py-2 px-3">
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              <Hash className="h-2.5 w-2.5" />{idx + 1}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-xs text-gray-700">{b.box_id || "-"}</td>
                          <td className="py-2 px-3 font-mono text-xs text-gray-600">{b.transaction_no || "-"}</td>
                          <td className="py-2 px-3 font-mono text-xs font-medium text-gray-800">{b.lot_no || b.lot_number || "-"}</td>
                          <td className="py-2 px-3 text-xs text-gray-700">{b.unit || "-"}</td>
                          <td className="py-2 px-3 text-right text-gray-700">{has(b.no_of_cartons) ? b.no_of_cartons : "-"}</td>
                          <td className="py-2 px-3 text-right text-gray-700">{has(b.net_weight ?? b.weight_kg) ? `${b.net_weight ?? b.weight_kg} kg` : "-"}</td>
                          <td className="py-2 px-3 text-right text-gray-700">{money(b.value) || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-gray-100">
                  {artBoxes.map((b: any, idx: number) => (
                    <div key={b.id} className="px-3 py-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">#{idx + 1}</span>
                          <span className="text-xs font-mono font-medium text-gray-800">{b.box_id || "-"}</span>
                        </div>
                        <span className="text-xs text-gray-600">{has(b.net_weight ?? b.weight_kg) ? `${b.net_weight ?? b.weight_kg} kg` : "-"}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                        <div><span className="text-gray-500">Trans:</span> <span className="font-mono">{b.transaction_no || "-"}</span></div>
                        <div><span className="text-gray-500">Lot:</span> <span className="font-mono">{b.lot_no || b.lot_number || "-"}</span></div>
                        <div><span className="text-gray-500">Unit:</span> <span>{b.unit || "-"}</span></div>
                        <div><span className="text-gray-500">Cartons:</span> <span>{has(b.no_of_cartons) ? b.no_of_cartons : "-"}</span></div>
                        {has(b.value) && <div><span className="text-gray-500">Value:</span> <span>{money(b.value)}</span></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {totalBoxes === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No items recorded in this transfer-in.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
