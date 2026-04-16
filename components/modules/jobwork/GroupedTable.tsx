"use client"

import React, { useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronRight, Loader2, Package } from "lucide-react"
import type { JobworkSummaryRow, JobworkDetailRow, InwardReceipt } from "@/types/jobwork"

function fmtKgs(n: number) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 })
}

const statusColors: Record<string, string> = {
  Open: "bg-blue-100 text-blue-800",
  "Partially Received": "bg-orange-100 text-orange-800",
  "Fully Received": "bg-teal-100 text-teal-800",
  Reconciled: "bg-purple-100 text-purple-800",
  Closed: "bg-green-100 text-green-800",
}

const lossColors: Record<string, string> = {
  Normal: "bg-green-100 text-green-800",
  "Excess Loss": "bg-red-100 text-red-800",
  "Underweight Waste": "bg-amber-100 text-amber-800",
  Pending: "bg-gray-100 text-gray-800",
}

function LossBar({ pct }: { pct: number }) {
  const color = pct > 10 ? "bg-red-500" : pct >= 7 ? "bg-amber-500" : "bg-green-500"
  const width = Math.min(pct, 20) * 5 // cap visual at 100%
  return (
    <div className="mt-0.5 h-1 w-12 rounded-full bg-gray-200">
      <div
        className={`h-1 rounded-full ${color}`}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

interface GroupedTableProps {
  rows: JobworkSummaryRow[]
  groupBy: string
  company: string
  onLoadGroupDetails: (groupLabel: string) => Promise<JobworkDetailRow[]>
  onLoadJWOReceipts: (jwoId: number) => Promise<InwardReceipt[]>
}

interface ExpandedGroup {
  details: JobworkDetailRow[]
  loading: boolean
}

interface ExpandedJWO {
  receipts: InwardReceipt[]
  loading: boolean
}

export function GroupedTable({
  rows,
  groupBy,
  company,
  onLoadGroupDetails,
  onLoadJWOReceipts,
}: GroupedTableProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, ExpandedGroup>>({})
  const [expandedJWOs, setExpandedJWOs] = useState<Record<number, ExpandedJWO>>({})

  const toggleGroup = useCallback(async (label: string) => {
    if (expandedGroups[label] && !expandedGroups[label].loading) {
      // Collapse
      setExpandedGroups((prev) => {
        const next = { ...prev }
        delete next[label]
        return next
      })
      return
    }

    // Expand — start loading
    setExpandedGroups((prev) => ({
      ...prev,
      [label]: { details: [], loading: true },
    }))

    try {
      const details = await onLoadGroupDetails(label)
      setExpandedGroups((prev) => ({
        ...prev,
        [label]: { details, loading: false },
      }))
    } catch {
      setExpandedGroups((prev) => ({
        ...prev,
        [label]: { details: [], loading: false },
      }))
    }
  }, [expandedGroups, onLoadGroupDetails])

  const toggleJWO = useCallback(async (jwoId: number) => {
    if (expandedJWOs[jwoId] && !expandedJWOs[jwoId].loading) {
      setExpandedJWOs((prev) => {
        const next = { ...prev }
        delete next[jwoId]
        return next
      })
      return
    }

    setExpandedJWOs((prev) => ({
      ...prev,
      [jwoId]: { receipts: [], loading: true },
    }))

    try {
      const receipts = await onLoadJWOReceipts(jwoId)
      setExpandedJWOs((prev) => ({
        ...prev,
        [jwoId]: { receipts, loading: false },
      }))
    } catch {
      setExpandedJWOs((prev) => ({
        ...prev,
        [jwoId]: { receipts: [], loading: false },
      }))
    }
  }, [expandedJWOs, onLoadJWOReceipts])

  if (rows.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center py-16 text-center">
        <Package className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No records match your filters</p>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="py-2.5 pl-4 pr-2 font-medium w-8" />
              <th className="py-2.5 pr-3 font-medium">
                {groupBy === "vendor" ? "Vendor" :
                  groupBy === "item" ? "Item" :
                    groupBy === "process_type" ? "Process" :
                      groupBy === "month" ? "Month" :
                        groupBy === "jwo_status" ? "Status" : "Group"}
              </th>
              <th className="py-2.5 pr-3 font-medium text-right">JWOs</th>
              <th className="py-2.5 pr-3 font-medium text-right">Net Dispatched</th>
              <th className="py-2.5 pr-3 font-medium text-right">FG Recvd</th>
              <th className="py-2.5 pr-3 font-medium text-right">Waste</th>
              <th className="py-2.5 pr-3 font-medium text-right">Rejection</th>
              <th className="py-2.5 pr-3 font-medium text-right">Unaccounted</th>
              <th className="py-2.5 pr-3 font-medium text-right">Loss %</th>
              <th className="py-2.5 pr-3 font-medium text-right">Open</th>
              <th className="py-2.5 pr-3 font-medium text-right">Overdue</th>
              <th className="py-2.5 pr-3 font-medium text-right">Excess</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isExpanded = !!expandedGroups[row.group_label]
              const group = expandedGroups[row.group_label]

              return (
                <React.Fragment key={row.group_label}>
                  {/* Group summary row */}
                  <tr
                    className="border-b cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => toggleGroup(row.group_label)}
                  >
                    <td className="py-2.5 pl-4 pr-2">
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      }
                    </td>
                    <td className="py-2.5 pr-3 font-medium">{row.group_label}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{row.num_jwos}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{fmtKgs(row.total_dispatched_kgs)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{fmtKgs(row.total_fg_received_kgs)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{fmtKgs(row.total_waste_received_kgs)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{fmtKgs(row.total_rejection_kgs)}</td>
                    <td className={`py-2.5 pr-3 text-right tabular-nums ${row.unaccounted_balance_kgs > 0 ? "text-amber-600 font-medium" : ""}`}>
                      {fmtKgs(row.unaccounted_balance_kgs)}
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <span className="tabular-nums">{row.avg_loss_pct.toFixed(1)}%</span>
                      <LossBar pct={row.avg_loss_pct} />
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{row.open_jwos}</td>
                    <td className={`py-2.5 pr-3 text-right tabular-nums ${row.overdue_jwos > 0 ? "text-red-600 font-medium" : ""}`}>
                      {row.overdue_jwos}
                    </td>
                    <td className={`py-2.5 pr-3 text-right tabular-nums ${row.excess_loss_flags > 0 ? "text-red-600 font-medium" : ""}`}>
                      {row.excess_loss_flags}
                    </td>
                  </tr>

                  {/* Expanded group details */}
                  {isExpanded && group && (
                    <>
                      {group.loading ? (
                        <tr>
                          <td colSpan={12} className="py-4 text-center">
                            <Loader2 className="h-4 w-4 animate-spin inline-block text-muted-foreground" />
                          </td>
                        </tr>
                      ) : group.details.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="py-3 pl-12 text-sm text-muted-foreground">
                            No detail records found.
                          </td>
                        </tr>
                      ) : (
                        group.details.map((detail) => {
                          const jwoExpanded = expandedJWOs[detail.id]

                          return (
                            <React.Fragment key={detail.id}>
                              <tr
                                className="border-b bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors"
                                onClick={() => toggleJWO(detail.id)}
                              >
                                <td className="py-2 pl-4 pr-2" />
                                <td className="py-2 pr-3 pl-6 flex items-center gap-2">
                                  {jwoExpanded && !jwoExpanded.loading
                                    ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                    : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                  }
                                  <span className="font-mono text-xs">{detail.jwo_id}</span>
                                  <span className="text-muted-foreground text-xs">— {detail.vendor_name}</span>
                                </td>
                                <td className="py-2 pr-3 text-right text-xs text-muted-foreground">{detail.item_name}</td>
                                <td className="py-2 pr-3 text-right tabular-nums text-xs">{fmtKgs(detail.qty_dispatched)}</td>
                                <td className="py-2 pr-3 text-right tabular-nums text-xs">{fmtKgs(detail.fg_received)}</td>
                                <td className="py-2 pr-3 text-right tabular-nums text-xs">{fmtKgs(detail.waste_received)}</td>
                                <td className="py-2 pr-3 text-right tabular-nums text-xs">{fmtKgs(detail.rejection)}</td>
                                <td className={`py-2 pr-3 text-right tabular-nums text-xs ${detail.unaccounted_balance > 0 ? "text-amber-600 font-medium" : ""}`}>
                                  {fmtKgs(detail.unaccounted_balance)}
                                </td>
                                <td className="py-2 pr-3 text-right text-xs">
                                  <span className="tabular-nums">{detail.actual_loss_pct.toFixed(1)}%</span>
                                  <LossBar pct={detail.actual_loss_pct} />
                                </td>
                                <td className="py-2 pr-3 text-right">
                                  <Badge variant="secondary" className={`text-[10px] ${statusColors[detail.jwo_status] || "bg-gray-100 text-gray-800"}`}>
                                    {detail.jwo_status}
                                  </Badge>
                                </td>
                                <td className="py-2 pr-3 text-right" />
                                <td className="py-2 pr-3 text-right">
                                  <Badge variant="secondary" className={`text-[10px] ${lossColors[detail.loss_status] || "bg-gray-100 text-gray-800"}`}>
                                    {detail.loss_status}
                                  </Badge>
                                </td>
                              </tr>

                              {/* Expanded JWO receipts */}
                              {jwoExpanded && (
                                <>
                                  {jwoExpanded.loading ? (
                                    <tr>
                                      <td colSpan={12} className="py-3 text-center">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin inline-block text-muted-foreground" />
                                      </td>
                                    </tr>
                                  ) : jwoExpanded.receipts.length === 0 ? (
                                    <tr>
                                      <td colSpan={12} className="py-2 pl-16 text-xs text-muted-foreground">
                                        No inward receipts found.
                                      </td>
                                    </tr>
                                  ) : (
                                    jwoExpanded.receipts.map((receipt) => (
                                      <tr key={receipt.id} className="border-b bg-muted/10">
                                        <td className="py-1.5 pl-4 pr-2" />
                                        <td className="py-1.5 pr-3 pl-12 text-xs text-muted-foreground">
                                          {receipt.ir_number}
                                        </td>
                                        <td className="py-1.5 pr-3 text-right text-xs text-muted-foreground">
                                          {receipt.receipt_type}
                                        </td>
                                        <td className="py-1.5 pr-3 text-right tabular-nums text-xs text-muted-foreground">
                                          {receipt.ir_date}
                                        </td>
                                        <td className="py-1.5 pr-3 text-right tabular-nums text-xs">
                                          {fmtKgs(receipt.fg_qty_received)}
                                        </td>
                                        <td className="py-1.5 pr-3 text-right tabular-nums text-xs">
                                          {fmtKgs(receipt.waste_qty_received)}
                                        </td>
                                        <td className="py-1.5 pr-3 text-right tabular-nums text-xs">
                                          {fmtKgs(receipt.rejection_qty)}
                                        </td>
                                        <td className="py-1.5 pr-3" />
                                        <td className="py-1.5 pr-3 text-right text-xs tabular-nums">
                                          {receipt.actual_loss_pct.toFixed(1)}%
                                        </td>
                                        <td className="py-1.5 pr-3" />
                                        <td className="py-1.5 pr-3" />
                                        <td className="py-1.5 pr-3 text-right">
                                          <Badge variant="secondary" className={`text-[10px] ${lossColors[receipt.loss_status] || "bg-gray-100 text-gray-800"}`}>
                                            {receipt.loss_status}
                                          </Badge>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </>
                              )}
                            </React.Fragment>
                          )
                        })
                      )}
                    </>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
