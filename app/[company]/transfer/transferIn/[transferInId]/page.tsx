"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft, Package, Inbox, Calendar, MapPin, User,
  CheckCircle, AlertTriangle, FileText, Loader2, Hash
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { InterunitApiService } from "@/lib/interunitApiService"
import type { Company } from "@/types/auth"

interface TransferInViewPageProps {
  params: {
    company: Company
    transferInId: string
  }
}

export default function TransferInViewPage({ params }: TransferInViewPageProps) {
  const { company, transferInId } = params
  const router = useRouter()
  const { toast } = useToast()

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const result = await InterunitApiService.getTransferInById(Number(transferInId))
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
      return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-")
    } catch { return "N/A" }
  }

  // Group boxes by article
  const groupedBoxes = useMemo(() => {
    if (!data?.boxes) return {}
    const groups: Record<string, any[]> = {}
    data.boxes.forEach((b: any) => {
      const article = b.article || "Unknown"
      if (!groups[article]) groups[article] = []
      groups[article].push(b)
    })
    return groups
  }, [data])

  const totalBoxes = data?.boxes?.length || 0
  const matchedBoxes = data?.boxes?.filter((b: any) => b.is_matched)?.length || 0
  const issuedBoxes = data?.boxes?.filter((b: any) => b.issue)?.length || 0
  const totalNetWeight = data?.boxes?.reduce((sum: number, b: any) => sum + (b.net_weight || 0), 0) || 0
  const totalGrossWeight = data?.boxes?.reduce((sum: number, b: any) => sum + (b.gross_weight || 0), 0) || 0

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
            {data.grn_number}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Transfer IN — {data.transfer_out_no}
          </p>
        </div>
        <Badge variant="outline" className={`text-xs px-2.5 py-1 ${
          data.status === "Received" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
          "bg-amber-50 text-amber-700 border-amber-200"
        }`}>
          {data.status}
        </Badge>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <MapPin className="h-3.5 w-3.5" />
              <span className="text-[11px] uppercase tracking-wider font-medium">Warehouse</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">{data.receiving_warehouse || "N/A"}</p>
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
              <span className="text-[11px] uppercase tracking-wider font-medium">Date</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">{formatDate(data.grn_date)}</p>
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

      {/* Condition Remarks */}
      {data.condition_remarks && (
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
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="text-center p-2.5 bg-blue-50/60 rounded-lg">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Total Boxes</p>
              <p className="text-lg font-bold text-blue-700">{totalBoxes}</p>
            </div>
            <div className="text-center p-2.5 bg-emerald-50/60 rounded-lg">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Matched</p>
              <p className="text-lg font-bold text-emerald-700">{matchedBoxes}</p>
            </div>
            <div className="text-center p-2.5 bg-red-50/60 rounded-lg">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Issues</p>
              <p className="text-lg font-bold text-red-700">{issuedBoxes}</p>
            </div>
            <div className="text-center p-2.5 bg-indigo-50/60 rounded-lg">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Net Weight</p>
              <p className="text-lg font-bold text-indigo-700">{totalNetWeight.toFixed(2)} kg</p>
            </div>
            <div className="text-center p-2.5 bg-amber-50/60 rounded-lg">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Gross Weight</p>
              <p className="text-lg font-bold text-amber-700">{totalGrossWeight.toFixed(2)} kg</p>
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
          {Object.entries(groupedBoxes).map(([articleName, artBoxes]) => (
            <div key={articleName} className="border-b last:border-b-0">
              {/* Article group header */}
              <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-gray-50/80">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                    <Package className="h-3.5 w-3.5 text-violet-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate">{articleName}</p>
                    <p className="text-[11px] text-muted-foreground">{artBoxes.length} box{artBoxes.length !== 1 ? "es" : ""}</p>
                  </div>
                </div>
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/40 border-b text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="text-left py-2 px-3 w-[50px]">#</th>
                      <th className="text-left py-2 px-3">Box ID</th>
                      <th className="text-left py-2 px-3">Transaction No</th>
                      <th className="text-left py-2 px-3">Batch / Lot</th>
                      <th className="text-right py-2 px-3">Net Wt</th>
                      <th className="text-right py-2 px-3">Gross Wt</th>
                      <th className="text-center py-2 px-3 w-[90px]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {artBoxes.map((b: any, idx: number) => {
                      const hasIssue = !!b.issue
                      const issueData = hasIssue ? (typeof b.issue === "string" ? JSON.parse(b.issue) : b.issue) : null
                      return (
                        <tr key={b.id} className={`${hasIssue ? "bg-red-50/30" : b.is_matched ? "bg-emerald-50/30" : ""}`}>
                          <td className="py-2 px-3">
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              <Hash className="h-2.5 w-2.5" />{idx + 1}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-xs text-gray-700">{b.box_id || "-"}</td>
                          <td className="py-2 px-3 font-mono text-xs text-gray-600">{b.transaction_no || "-"}</td>
                          <td className="py-2 px-3 font-mono text-xs text-gray-600">{b.batch_number || b.lot_number || "-"}</td>
                          <td className="py-2 px-3 text-right text-gray-700">{b.net_weight != null ? `${b.net_weight} kg` : "-"}</td>
                          <td className="py-2 px-3 text-right text-gray-700">{b.gross_weight != null ? `${b.gross_weight} kg` : "-"}</td>
                          <td className="py-2 px-3 text-center">
                            {hasIssue ? (
                              <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200">
                                <AlertTriangle className="h-3 w-3 mr-0.5" /> Issue
                              </Badge>
                            ) : b.is_matched ? (
                              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                <CheckCircle className="h-3 w-3 mr-0.5" /> OK
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">—</Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {artBoxes.map((b: any, idx: number) => {
                  const hasIssue = !!b.issue
                  const issueData = hasIssue ? (typeof b.issue === "string" ? JSON.parse(b.issue) : b.issue) : null
                  return (
                    <div key={b.id} className={`px-3 py-2.5 ${hasIssue ? "bg-red-50/30" : b.is_matched ? "bg-emerald-50/30" : ""}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">#{idx + 1}</span>
                          <span className="text-xs font-mono font-medium text-gray-800">{b.box_id || "-"}</span>
                        </div>
                        {hasIssue ? (
                          <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200">Issue</Badge>
                        ) : b.is_matched ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">OK</Badge>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                        <div><span className="text-gray-500">Trans:</span> <span className="font-mono">{b.transaction_no || "-"}</span></div>
                        <div><span className="text-gray-500">Lot:</span> <span className="font-mono">{b.lot_number || "-"}</span></div>
                        <div><span className="text-gray-500">Net:</span> <span className="font-medium">{b.net_weight != null ? `${b.net_weight} kg` : "-"}</span></div>
                        <div><span className="text-gray-500">Gross:</span> <span className="font-medium">{b.gross_weight != null ? `${b.gross_weight} kg` : "-"}</span></div>
                      </div>
                      {hasIssue && issueData && (
                        <div className="mt-1.5 p-2 bg-red-50 border border-red-200 rounded text-xs">
                          <p className="font-semibold text-red-700 mb-0.5">Issue Details:</p>
                          {issueData.actual_qty != null && <p><span className="text-red-500">Actual Qty:</span> {issueData.actual_qty}</p>}
                          {issueData.actual_total_weight != null && <p><span className="text-red-500">Actual Wt:</span> {issueData.actual_total_weight}</p>}
                          {issueData.remarks && <p><span className="text-red-500">Remarks:</span> {issueData.remarks}</p>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

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
