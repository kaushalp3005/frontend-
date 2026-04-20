"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ArrowLeft, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { rtvApi } from "@/lib/api/rtvApiService"
import type { RTVWithDetails } from "@/types/rtv"

interface Props { params: { company: string; id: string } }

const fmtN = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0)
  return isFinite(v as number) ? Math.round(v as number).toLocaleString("en-IN") : "0"
}
const fmtV = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0)
  return isFinite(v as number) && v !== 0 ? "₹" + Math.round(v as number).toLocaleString("en-IN") : "₹0"
}
const fmtR = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0)
  return v ? "₹" + (v as number).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"
}

export default function RTVDetailPage({ params }: Props) {
  const { company, id } = params
  const numericId = Number(id)
  const [data, setData] = useState<RTVWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetch = async () => {
      if (!isFinite(numericId)) {
        setError("Invalid RTV id")
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const detail = await rtvApi.getRTVDetail(company, numericId)
        if (!cancelled) setData(detail)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load RTV")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [company, numericId])

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-[1200px] mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href={`/${company}/rtv/dashboard`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">
            {data?.rtv_id ?? (loading ? "Loading..." : "RTV")}
          </h1>
          <p className="text-xs text-muted-foreground">Return to Vendor · Read-only view</p>
        </div>
      </div>

      {error && (
        <Card className="border-red-300 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-medium">RTV not found</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            <Button variant="outline" size="sm" className="mt-4 text-xs" asChild>
              <Link href={`/${company}/rtv/dashboard`}>Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && !error && (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      )}

      {data && !error && !loading && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Header</span>
                <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium",
                  data.status === "Approved" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                  {data.status}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 text-sm">
                <Field label="RTV ID" value={data.rtv_id} />
                <Field label="Date" value={data.rtv_date ? format(new Date(data.rtv_date), "dd MMM yyyy") : "—"} />
                <Field label="Factory Unit" value={data.factory_unit} />
                <Field label="Customer" value={data.customer} />
                <Field label="Invoice No" value={data.invoice_number || "—"} />
                <Field label="Challan No" value={data.challan_no || "—"} />
                <Field label="DN No" value={data.dn_no || "—"} />
                <Field label="Sales POC" value={data.sales_poc || "—"} />
                <Field label="Vehicle Number" value={data.vehicle_number || "—"} />
                <Field label="Transporter" value={data.transporter_name || "—"} />
                <Field label="Driver Name" value={data.driver_name || "—"} />
                <Field label="Inward Manager" value={data.inward_manager || "—"} />
                <Field label="Created By" value={data.created_by || "—"} />
                {data.remark && (
                  <div className="col-span-full">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Remark</p>
                    <p className="text-sm mt-0.5">{data.remark}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Lines ({data.lines?.length ?? 0})</CardTitle></CardHeader>
            <CardContent className="p-0">
              {!data.lines || data.lines.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No lines</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/60">
                      <th className="text-left text-xs uppercase tracking-wider font-medium px-3 py-2">Material</th>
                      <th className="text-left text-xs uppercase tracking-wider font-medium px-3 py-2">Category</th>
                      <th className="text-left text-xs uppercase tracking-wider font-medium px-3 py-2">Sub Category</th>
                      <th className="text-left text-xs uppercase tracking-wider font-medium px-3 py-2">Item</th>
                      <th className="text-left text-xs uppercase tracking-wider font-medium px-3 py-2">UOM</th>
                      <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2">Qty</th>
                      <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2">Rate</th>
                      <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2">Value</th>
                    </tr></thead>
                    <tbody>{data.lines.map(l => (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{l.material_type}</td>
                        <td className="px-3 py-2">{l.item_category}</td>
                        <td className="px-3 py-2">{l.sub_category}</td>
                        <td className="px-3 py-2">{l.item_description}</td>
                        <td className="px-3 py-2">{l.uom}</td>
                        <td className="text-right px-3 py-2 tabular-nums">{fmtN(l.qty)}</td>
                        <td className="text-right px-3 py-2 tabular-nums">{fmtR(l.rate)}</td>
                        <td className="text-right px-3 py-2 tabular-nums font-medium">{fmtV(l.value)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {data.boxes && data.boxes.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Boxes ({data.boxes.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/60">
                      <th className="text-left text-xs uppercase tracking-wider font-medium px-3 py-2">Box No</th>
                      <th className="text-left text-xs uppercase tracking-wider font-medium px-3 py-2">Box ID</th>
                      <th className="text-left text-xs uppercase tracking-wider font-medium px-3 py-2">Article</th>
                      <th className="text-left text-xs uppercase tracking-wider font-medium px-3 py-2">Lot</th>
                      <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2">Net Wt</th>
                      <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2">Gross Wt</th>
                      <th className="text-right text-xs uppercase tracking-wider font-medium px-3 py-2">Count</th>
                    </tr></thead>
                    <tbody>{data.boxes.map(b => (
                      <tr key={b.id} className="border-b last:border-0">
                        <td className="px-3 py-2 tabular-nums">{b.box_number}</td>
                        <td className="px-3 py-2 font-mono text-xs">{b.box_id || "—"}</td>
                        <td className="px-3 py-2">{b.article_description}</td>
                        <td className="px-3 py-2">{b.lot_number || "—"}</td>
                        <td className="text-right px-3 py-2 tabular-nums">{fmtN(b.net_weight)}</td>
                        <td className="text-right px-3 py-2 tabular-nums">{fmtN(b.gross_weight)}</td>
                        <td className="text-right px-3 py-2 tabular-nums">{b.count ?? "—"}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  )
}
