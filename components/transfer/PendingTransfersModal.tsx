"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { Loader2, X, Search, Clock, Package, ArrowRight, Calendar, Trash2, AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ChallanHoverCard, groupLinesByItem, groupBoxesByItem, type HoverMeta } from "@/components/transfer/ChallanHoverCard"
import { normalizeWarehouseName } from "@/lib/constants/warehouses"

export type PendingTransferRecord = {
  transfer_out_id: number
  transfer_out_challan_no: string
  dispatched_at: string | null
  from_site: string
  to_site: string
  from_company: string
  to_company: string
  from_storage_type: string
  to_storage_type: string
  total_boxes: number
  total_cartons: number
  total_kg: number
  dispatched_by: string
  status: string
  header_status: string
}

type Props = {
  open: boolean
  onClose: () => void
  company: string  // 'cfpl' or 'cdpl'
  apiBaseUrl?: string
  userEmail?: string
  userRole?: string
}

const ALLOWED_CANCEL_EMAILS = new Set(["yash@candorfoods.in", "b.hrithik@candorfoods.in"])
const ADMIN_ROLES = new Set(["admin", "developer"])

const canCancel = (email?: string, role?: string) => {
  if (!email && !role) return false
  if (email && ALLOWED_CANCEL_EMAILS.has(email.toLowerCase())) return true
  if (role && ADMIN_ROLES.has(role.toLowerCase())) return true
  return false
}

const formatDate = (iso: string | null) => {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
  } catch {
    return iso
  }
}

const formatNumber = (n: number, fractionDigits = 2) =>
  Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: fractionDigits })

export default function PendingTransfersModal({ open, onClose, company, apiBaseUrl, userEmail, userRole }: Props) {
  const apiUrl = apiBaseUrl || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
  const showCancelColumn = canCancel(userEmail, userRole)

  const [loading, setLoading] = useState(false)
  const [records, setRecords] = useState<PendingTransferRecord[]>([])
  const [fromSites, setFromSites] = useState<string[]>([])
  const [toSites, setToSites] = useState<string[]>([])
  const [fromSiteCounts, setFromSiteCounts] = useState<Record<string, number>>({})
  const [toSiteCounts, setToSiteCounts] = useState<Record<string, number>>({})
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<PendingTransferRecord | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState("")
  const [selectedFromSites, setSelectedFromSites] = useState<Set<string>>(new Set())
  const [selectedToSites, setSelectedToSites] = useState<Set<string>>(new Set())
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (company) params.set("company", company.toLowerCase())
      if (search) params.set("search", search)
      if (fromDate) params.set("from_date", fromDate)
      if (toDate) params.set("to_date", toDate)
      const url = `${apiUrl}/interunit/pending-stock?${params.toString()}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setRecords(data.records || [])
      const newFromSites: string[] = data.filter_options?.from_sites || []
      const newToSites: string[] = data.filter_options?.to_sites || []
      setFromSites(newFromSites)
      setToSites(newToSites)
      setFromSiteCounts(data.filter_options?.from_site_counts || {})
      setToSiteCounts(data.filter_options?.to_site_counts || {})
      // Purge any selected chips that are no longer in the new chip list to prevent filter lock
      const fromSet = new Set(newFromSites)
      const toSet = new Set(newToSites)
      setSelectedFromSites((prev) => {
        const pruned = new Set([...prev].filter((s) => fromSet.has(s)))
        return pruned.size === prev.size ? prev : pruned
      })
      setSelectedToSites((prev) => {
        const pruned = new Set([...prev].filter((s) => toSet.has(s)))
        return pruned.size === prev.size ? prev : pruned
      })
    } catch (err) {
      console.error("Failed to load pending transfers:", err)
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [apiUrl, company, search, fromDate, toDate])

  // Auto-sync + refresh every time the modal opens.
  // While open, subsequent filter changes (loadData identity change) just reload.
  const justOpenedRef = useRef(false)
  useEffect(() => {
    if (!open) {
      // Reset so the NEXT open triggers a fresh auto-sync
      justOpenedRef.current = false
      return
    }
    if (!justOpenedRef.current) {
      justOpenedRef.current = true
      // Load data immediately so warehouses/records appear without waiting for backfill.
      // Then fire backfill in background — it reloads data again when done.
      void loadData()
      void handleSyncExisting(true)
    } else {
      // Already open — a dependency changed (filters). Just refresh.
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loadData])

  // ESC closes
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // Client-side chip filtering (warehouse selection)
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (selectedFromSites.size > 0 && !selectedFromSites.has(r.from_site)) return false
      if (selectedToSites.size > 0 && !selectedToSites.has(r.to_site)) return false
      return true
    })
  }, [records, selectedFromSites, selectedToSites])

  const totals = useMemo(() => {
    return filteredRecords.reduce(
      (acc, r) => ({
        boxes: acc.boxes + r.total_boxes,
        kg: acc.kg + r.total_kg,
        transfers: acc.transfers + 1,
      }),
      { boxes: 0, kg: 0, transfers: 0 }
    )
  }, [filteredRecords])

  const toggleChip = (set: Set<string>, setSet: (s: Set<string>) => void, value: string) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setSet(next)
  }

  const clearFilters = () => {
    setSearch("")
    setSelectedFromSites(new Set())
    setSelectedToSites(new Set())
    setFromDate("")
    setToDate("")
  }

  const handleSyncExisting = useCallback(
    async (silent: boolean = false) => {
      if (!canCancel(userEmail, userRole)) {
        // Not authorized — just refresh the data
        await loadData()
        return
      }
      setSyncing(true)
      if (!silent) setSyncResult(null)
      let succeeded = false
      try {
        const params = new URLSearchParams()
        if (userEmail) params.set("user_email", userEmail)
        if (userRole) params.set("user_role", userRole)
        const url = `${apiUrl}/interunit/pending-stock/backfill?${params.toString()}`
        const res = await fetch(url, { method: "POST" })
        if (!res.ok) {
          const body = await res.text().catch(() => "")
          throw new Error(body || `HTTP ${res.status} ${res.statusText}`)
        }
        const data = await res.json()
        const parked =
          (data.boxes_parked_from_cold || 0) +
          (data.boxes_parked_from_warehouse || 0) +
          (data.boxes_parked_without_source || 0)
        const skipped = data.transfers_with_existing_pending || 0
        const scanned = data.transfers_scanned || 0
        succeeded = true
        if (parked > 0) {
          setSyncResult(
            `Synced ${parked} box${parked !== 1 ? "es" : ""} from ${scanned} existing transfer${
              scanned !== 1 ? "s" : ""
            } (${skipped} already parked)`
          )
        } else if (silent) {
          // Background sync with nothing to do — keep the banner quiet
          setSyncResult(null)
        } else {
          setSyncResult(
            scanned > 0
              ? `Already in sync — ${skipped} transfer${skipped !== 1 ? "s" : ""} already parked`
              : "Nothing to sync — no in-transit transfers found"
          )
        }
      } catch (err: any) {
        console.error("[PendingTransfersModal] Sync failed:", err)
        setSyncResult(`Sync failed: ${err?.message || "unknown error"}. Refreshing data anyway…`)
      } finally {
        setSyncing(false)
        // ALWAYS reload data — even if the sync failed — so the user sees
        // whatever is currently in pending_transfer_stock.
        await loadData()
      }
      return succeeded
    },
    [apiUrl, userEmail, userRole, loadData]
  )

  const handleCancelTransfer = async (rec: PendingTransferRecord) => {
    if (!showCancelColumn) return
    setCancellingId(rec.transfer_out_id)
    setCancelError(null)
    try {
      const params = new URLSearchParams()
      if (userEmail) params.set("user_email", userEmail)
      if (userRole) params.set("user_role", userRole)
      const res = await fetch(
        `${apiUrl}/interunit/transfers/${rec.transfer_out_id}?${params.toString()}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        const body = await res.text()
        throw new Error(body || `Delete failed (HTTP ${res.status})`)
      }
      setConfirmCancel(null)
      await loadData()
    } catch (err: any) {
      console.error("Cancel transfer failed:", err)
      setCancelError(err?.message || "Failed to cancel transfer")
    } finally {
      setCancellingId(null)
    }
  }

  if (!open) return null
  if (typeof window === "undefined") return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-amber-500 flex items-center justify-center">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Pending Transfer Stock</h2>
              <p className="text-xs text-gray-500">In-transit goods not yet received</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Toolbar / Filters */}
        <div className="px-5 py-3 border-b bg-gray-50/50 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative max-w-xs flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search challan, lot, item..."
                className="h-8 pl-8 pr-2 text-xs bg-white"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 text-xs bg-white w-[150px]"
                title="From date"
              />
              <span className="text-xs text-gray-400">→</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 text-xs bg-white w-[150px]"
                title="To date"
              />
            </div>
            {(search || fromDate || toDate || selectedFromSites.size > 0 || selectedToSites.size > 0) && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
                Clear filters
              </Button>
            )}
            {showCancelColumn && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSyncExisting(false)}
                disabled={syncing}
                className="h-8 text-xs ml-auto border-violet-300 text-violet-700 hover:bg-violet-50"
                title="Park existing in-transit transfers (created before this module was deployed) into pending stock"
              >
                {syncing ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                Sync existing
              </Button>
            )}
          </div>
          {syncResult && (
            <div className="text-[11px] text-violet-700 bg-violet-50 border border-violet-200 rounded px-2.5 py-1">
              {syncResult}
            </div>
          )}

          {/* Warehouse chips — always visible. Sites with no current pending stock are dimmed. */}
          <div className="space-y-1.5">
            <div className="flex items-start gap-2">
              <span className="text-[11px] font-medium text-gray-500 mt-1 shrink-0 w-[44px]">From:</span>
              <div className="flex flex-wrap gap-1">
                {fromSites.length === 0 && (
                  <span className="text-[11px] text-gray-400 italic">No warehouses available</span>
                )}
                {fromSites.map((s) => {
                  const count = fromSiteCounts[s] || 0
                  const active = selectedFromSites.has(s)
                  return (
                    <button
                      key={`from-${s}`}
                      onClick={() => toggleChip(selectedFromSites, setSelectedFromSites, s)}
                      title={count > 0 ? `${count} pending box${count !== 1 ? "es" : ""}` : "No pending transfers from here"}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors inline-flex items-center gap-1 ${
                        active
                          ? "bg-violet-500 text-white border-violet-500"
                          : count > 0
                          ? "bg-white text-gray-700 border-gray-300 hover:border-violet-400"
                          : "bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {normalizeWarehouseName(s) || s}
                      {count > 0 && (
                        <span className={`text-[10px] rounded-full px-1 ${active ? "bg-violet-700" : "bg-violet-100 text-violet-700"}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[11px] font-medium text-gray-500 mt-1 shrink-0 w-[44px]">To:</span>
              <div className="flex flex-wrap gap-1">
                {toSites.length === 0 && (
                  <span className="text-[11px] text-gray-400 italic">No warehouses available</span>
                )}
                {toSites.map((s) => {
                  const count = toSiteCounts[s] || 0
                  const active = selectedToSites.has(s)
                  return (
                    <button
                      key={`to-${s}`}
                      onClick={() => toggleChip(selectedToSites, setSelectedToSites, s)}
                      title={count > 0 ? `${count} pending box${count !== 1 ? "es" : ""}` : "No pending transfers to here"}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors inline-flex items-center gap-1 ${
                        active
                          ? "bg-teal-500 text-white border-teal-500"
                          : count > 0
                          ? "bg-white text-gray-700 border-gray-300 hover:border-teal-400"
                          : "bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {normalizeWarehouseName(s) || s}
                      {count > 0 && (
                        <span className={`text-[10px] rounded-full px-1 ${active ? "bg-teal-700" : "bg-teal-100 text-teal-700"}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Summary bar */}
        <div className="flex items-center justify-between px-5 py-2 border-b bg-amber-50/40">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-gray-500">Transfers:</span>{" "}
              <span className="font-semibold text-gray-900">{totals.transfers}</span>
            </div>
            <div>
              <span className="text-gray-500">Total boxes:</span>{" "}
              <span className="font-semibold text-gray-900">{formatNumber(totals.boxes, 0)}</span>
            </div>
            <div>
              <span className="text-gray-500">Total weight:</span>{" "}
              <span className="font-semibold text-gray-900">{formatNumber(totals.kg, 2)} kg</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading pending transfers...</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Package className="h-10 w-10 text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No pending transfers</p>
              <p className="text-xs text-gray-400 mt-0.5">All in-transit goods have been received</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Challan No</th>
                  <th className="px-3 py-2.5">From → To</th>
                  <th className="px-3 py-2.5 text-right">Boxes</th>
                  <th className="px-3 py-2.5 text-right">Cartons</th>
                  <th className="px-3 py-2.5 text-right">Weight (kg)</th>
                  <th className="px-3 py-2.5">Dispatched by</th>
                  <th className="px-3 py-2.5">Status</th>
                  {showCancelColumn && <th className="px-3 py-2.5 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRecords.map((r) => (
                  <tr key={r.transfer_out_id} className="hover:bg-amber-50/30">
                    <td className="px-4 py-2.5 text-gray-700">{formatDate(r.dispatched_at)}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-gray-800">
                      <ChallanHoverCard
                        challanNo={r.transfer_out_challan_no}
                        from={r.from_site}
                        to={r.to_site}
                        fetchLines={async () => {
                          try {
                            const res = await fetch(`${apiUrl}/interunit/transfers/${r.transfer_out_id}`, {
                              headers: { Accept: "application/json" },
                            })
                            if (!res.ok) return { lines: [] }
                            const data = await res.json()
                            const fromColdUnit: string | undefined = data.from_cold_unit || undefined
                            const rawLines = (data.boxes || []).length > 0
                              ? groupBoxesByItem(data.boxes)
                              : groupLinesByItem(data.lines || [])
                            const lines = fromColdUnit
                              ? rawLines.map(l => ({ ...l, sourceStorage: l.sourceStorage || fromColdUnit }))
                              : rawLines
                            const meta: HoverMeta[] = []
                            if (data.vehicle_no) meta.push({ label: "Vehicle", value: data.vehicle_no })
                            if (data.driver_name) meta.push({ label: "Driver", value: data.driver_name })
                            meta.push({
                              label: "Boxes",
                              value: String(r.total_boxes),
                              tone: "default",
                            })
                            meta.push({
                              label: "Weight",
                              value: `${formatNumber(r.total_kg, 2)} kg`,
                              tone: "default",
                            })
                            // Grand total count across all PM/packaging items
                            const totalCount = lines.reduce(
                              (s, l) => s + (typeof l.count === "number" ? l.count : 0),
                              0
                            )
                            if (totalCount > 0) {
                              meta.push({
                                label: "Total Count",
                                value: totalCount.toLocaleString("en-IN"),
                                tone: "success",
                              })
                            }
                            if (data.has_variance) meta.push({ label: "Variance", value: "Yes", tone: "warn" })

                            // Show GRN info if any Transfer-In receipt has been started/completed
                            const grnRecords: Array<{
                              id: number; grn_number: string; status: string;
                              received_by: string; received_at: string | null; received_boxes: number
                            }> = data.grn_records || []
                            for (const grn of grnRecords) {
                              if (grn.grn_number) {
                                meta.push({
                                  label: "GRN",
                                  value: grn.grn_number,
                                  tone: grn.status === "Received" ? "success" : "warn",
                                })
                              }
                              if (grn.received_boxes > 0) {
                                meta.push({
                                  label: "Rcvd boxes",
                                  value: String(grn.received_boxes),
                                  tone: grn.status === "Received" ? "success" : "warn",
                                })
                              }
                              if (grn.received_by) {
                                meta.push({ label: "Rcvd by", value: grn.received_by, tone: "default" })
                              }
                            }

                            return { lines, meta }
                          } catch {
                            return { lines: [] }
                          }
                        }}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <span>{normalizeWarehouseName(r.from_site) || r.from_site}</span>
                        <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
                        <span>{normalizeWarehouseName(r.to_site) || r.to_site}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-gray-400 uppercase">
                          {r.from_storage_type} → {r.to_storage_type}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{r.total_boxes}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{formatNumber(r.total_cartons, 0)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-gray-900">{formatNumber(r.total_kg, 2)}</td>
                    <td className="px-3 py-2.5 text-gray-600">{r.dispatched_by || "—"}</td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-medium ${
                          r.header_status === "Partial"
                            ? "bg-amber-50 text-amber-700 border-amber-300"
                            : "bg-sky-50 text-sky-700 border-sky-200"
                        }`}
                      >
                        {r.header_status === "Partial" ? "Partial (GRN raised)" : r.status}
                      </Badge>
                    </td>
                    {showCancelColumn && (
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px] border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setConfirmCancel(r)}
                          disabled={cancellingId === r.transfer_out_id}
                          title="Cancel this transfer (restores stock to source)"
                        >
                          {cancellingId === r.transfer_out_id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="h-3 w-3 mr-1" /> Cancel
                            </>
                          )}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t bg-gray-50 flex items-center justify-between">
          <p className="text-[11px] text-gray-400">Press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono">Esc</kbd> to close</p>
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            Cancel
          </Button>
        </div>

        {/* Confirm cancel dialog */}
        {confirmCancel && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 p-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setConfirmCancel(null)
                setCancelError(null)
              }
            }}
          >
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Cancel this transfer?</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    This will <b>delete</b> the transfer <span className="font-mono">{confirmCancel.transfer_out_challan_no}</span> and
                    restore all <b>{confirmCancel.total_boxes}</b> in-transit boxes
                    ({formatNumber(confirmCancel.total_kg, 2)} kg) back to the source warehouse
                    <b> {normalizeWarehouseName(confirmCancel.from_site) || confirmCancel.from_site}</b>.
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1.5">This action cannot be undone.</p>
                </div>
              </div>
              {cancelError && (
                <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-1.5 mb-2">
                  {cancelError}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setConfirmCancel(null); setCancelError(null) }}
                  className="h-8 text-xs"
                  disabled={cancellingId === confirmCancel.transfer_out_id}
                >
                  Keep transfer
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => handleCancelTransfer(confirmCancel)}
                  disabled={cancellingId === confirmCancel.transfer_out_id}
                >
                  {cancellingId === confirmCancel.transfer_out_id ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Cancelling...</>
                  ) : (
                    <><Trash2 className="h-3.5 w-3.5 mr-1.5" /> Yes, cancel transfer</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
