"use client"

import { useState, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { format } from "date-fns"
import { ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getDisplayWarehouseName } from "@/lib/constants/warehouses"

// Structural shape the card reads — satisfied by both the inward list item and the
// cold-storage bulk-entry transaction (both expose these fields).
export interface TxCardItem {
  transaction_no: string
  status?: string
  entry_date?: string | null
  vendor_supplier_name?: string | null
  customer_party_name?: string | null
  warehouse?: string | null
  source_location?: string | null
  po_number?: string | null
  invoice_number?: string | null
  challan_number?: string | null
  lr_number?: string | null
  approval_authority?: string | null
  vehicle_number?: string | null
  transporter_name?: string | null
  grn_number?: string | null
  grn_quantity?: number | null
  system_grn_date?: string | null
  total_amount?: number | null
  net_weight?: number | null
  total_weight?: number | null
  box_count?: number | null
  article_items_with_qty?: string[] | null
  item_descriptions?: string[] | null
  created_by?: string | null
  remark?: string | null
}

export function TransactionStatusCard({ item }: { item: TxCardItem }) {
  const completed: string[] = []
  const pending: string[] = []

  if (item.warehouse) completed.push("Warehouse")
  else pending.push("Warehouse")

  if (item.approval_authority) completed.push("Inward Manager")
  else pending.push("Inward Manager")

  if (item.vehicle_number && item.transporter_name) completed.push("Transport")
  else pending.push("Transport")

  if (item.grn_number) completed.push("GRN")
  else pending.push("GRN")

  if (item.status === "approved") completed.push("Approval")
  else pending.push("Approval")

  const toneChip = (tone: "blue" | "sky" | "emerald" | "amber" | "gray") => {
    const map = {
      blue:    "bg-blue-50 text-blue-700 border-blue-200",
      sky:     "bg-sky-50 text-sky-700 border-sky-200",
      emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
      amber:   "bg-amber-50 text-amber-700 border-amber-200",
      gray:    "bg-gray-50 text-gray-700 border-gray-200",
    }
    return `text-[10px] font-medium px-1.5 py-0.5 rounded border ${map[tone]}`
  }

  return (
    <div
      className="w-full rounded-2xl overflow-hidden text-xs max-h-[480px] flex flex-col"
      style={{
        background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 45%, #faf5ff 100%)",
        boxShadow: "0 20px 40px -10px rgba(79,70,229,0.22), 0 8px 16px -4px rgba(236,72,153,0.14), 0 0 0 1px rgba(147,197,253,0.45)",
      }}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-blue-100/60">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-[13px] text-gray-800">{item.transaction_no}</p>
          <Badge variant="outline" className={cn(
            "text-[10px] shrink-0",
            item.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
          )}>
            {item.status === "approved" ? "Approved" : "Pending"}
          </Badge>
        </div>
        <p className="text-[10px] text-gray-500 mt-0.5">
          {item.entry_date ? format(new Date(item.entry_date), "dd MMM yyyy") : "—"}
          {item.vendor_supplier_name && ` · ${item.vendor_supplier_name}`}
          {item.customer_party_name && item.customer_party_name !== item.vendor_supplier_name && ` / ${item.customer_party_name}`}
        </p>
      </div>

      <div className="px-3 py-2.5 space-y-2 overflow-y-auto flex-1">

        {/* Source → Warehouse (inward direction: vendor/source into our warehouse).
            destination_location is an onward/customer concept and is intentionally
            not shown here — an arrow from our warehouse misrepresents a receipt. */}
        {(item.warehouse || item.source_location) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {item.source_location && (
              <span className={toneChip("gray")}><span className="opacity-60">From:</span> {item.source_location}</span>
            )}
            {item.source_location && item.warehouse && (
              <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
            )}
            {item.warehouse && (
              <span className={toneChip("blue")}><span className="opacity-60">WH:</span> {getDisplayWarehouseName(item.warehouse)}</span>
            )}
          </div>
        )}

        {/* Reference numbers row */}
        {(item.po_number || item.invoice_number || item.challan_number || item.lr_number) && (
          <div className="flex flex-wrap gap-1">
            {item.po_number && (
              <span className={toneChip("gray")}><span className="opacity-60">PO:</span> {item.po_number}</span>
            )}
            {item.invoice_number && (
              <span className={toneChip("gray")}><span className="opacity-60">Inv:</span> {item.invoice_number}</span>
            )}
            {item.challan_number && (
              <span className={toneChip("gray")}><span className="opacity-60">Challan:</span> {item.challan_number}</span>
            )}
            {item.lr_number && (
              <span className={toneChip("sky")}><span className="opacity-60">LR#:</span> {item.lr_number}</span>
            )}
          </div>
        )}

        {/* Inward Manager */}
        {item.approval_authority && (
          <div className="flex flex-wrap gap-1">
            <span className={toneChip("blue")}><span className="opacity-60">Manager:</span> {item.approval_authority}</span>
          </div>
        )}

        {/* Transport row */}
        {(item.vehicle_number || item.transporter_name) && (
          <div className="flex flex-wrap gap-1">
            {item.vehicle_number && (
              <span className={toneChip("sky")}><span className="opacity-60">Vehicle:</span> {item.vehicle_number}</span>
            )}
            {item.transporter_name && (
              <span className={toneChip("sky")}><span className="opacity-60">Transporter:</span> {item.transporter_name}</span>
            )}
          </div>
        )}

        {/* GRN row */}
        {(item.grn_number || item.grn_quantity != null || item.system_grn_date) && (
          <div className="flex flex-wrap gap-1">
            {item.grn_number && (
              <span className={toneChip("emerald")}><span className="opacity-60">GRN:</span> {item.grn_number}</span>
            )}
            {item.grn_quantity != null && (
              <span className={toneChip("emerald")}><span className="opacity-60">Qty:</span> {item.grn_quantity}</span>
            )}
            {item.system_grn_date && (
              <span className={toneChip("emerald")}><span className="opacity-60">GRN Date:</span> {format(new Date(item.system_grn_date), "dd MMM yy")}</span>
            )}
          </div>
        )}

        {/* Metrics */}
        {(item.total_amount != null || item.net_weight != null || item.total_weight != null || item.box_count != null) && (
          <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-blue-100/50 text-[11px]">
            {item.total_amount != null && (
              <span className="text-gray-500">Value: <span className="font-semibold text-gray-700">₹{item.total_amount.toLocaleString()}</span></span>
            )}
            {item.net_weight != null && (
              <span className="text-gray-500">Net: <span className="font-semibold text-gray-700">{item.net_weight} kg</span></span>
            )}
            {item.total_weight != null && item.total_weight !== item.net_weight && (
              <span className="text-gray-500">Gross: <span className="font-semibold text-gray-700">{item.total_weight} kg</span></span>
            )}
            {item.box_count != null && (
              <span className="text-gray-500">Boxes: <span className="font-semibold text-gray-700">{item.box_count}</span></span>
            )}
          </div>
        )}

        {/* Items with per-item kg — use combined field when available, fall back to names only */}
        {(() => {
          const displayItems = (item.article_items_with_qty && item.article_items_with_qty.length > 0)
            ? item.article_items_with_qty
            : (item.item_descriptions || [])
          if (displayItems.length === 0) return null
          return (
            <div className="pt-1.5 border-t border-blue-100/50">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Items ({displayItems.length})
              </p>
              <div className="space-y-0.5">
                {displayItems.slice(0, 6).map((entry, i) => {
                  // Split "ItemName (X.XX kg)" into name + qty suffix for coloured display
                  const match = entry.match(/^(.+?)\s+(\([^)]+\))$/)
                  return (
                    <div key={i} className="flex items-center justify-between gap-2 bg-white/70 border border-blue-100 rounded-lg px-2 py-1 shadow-sm">
                      <span className="font-medium text-gray-800 text-[11px] leading-snug">{match ? match[1] : entry}</span>
                      {match && (
                        <span className="text-emerald-700 font-semibold text-[10px] shrink-0">{match[2]}</span>
                      )}
                    </div>
                  )
                })}
                {displayItems.length > 6 && (
                  <p className="text-[10px] text-gray-400 pl-1">+{displayItems.length - 6} more items</p>
                )}
              </div>
            </div>
          )
        })()}

        {/* Workflow chips */}
        <div className="pt-1.5 border-t border-blue-100/50 space-y-1.5">
          {completed.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">Completed</p>
              <div className="flex flex-wrap gap-1">
                {completed.map((c) => (
                  <span key={c} className={toneChip("emerald")}>✓ {c}</span>
                ))}
              </div>
            </div>
          )}
          {pending.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1">Pending</p>
              <div className="flex flex-wrap gap-1">
                {pending.map((p) => (
                  <span key={p} className={toneChip("amber")}>○ {p}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {(item.created_by || item.remark) && (
          <div className="pt-1.5 border-t border-blue-100/50 space-y-0.5 text-[10px]">
            {item.created_by && (
              <div className="flex justify-between gap-2">
                <span className="text-gray-400">Created by</span>
                <span className="font-medium text-gray-600">{item.created_by}</span>
              </div>
            )}
            {item.remark && (
              <div className="flex justify-between gap-2">
                <span className="text-gray-400 shrink-0">Remark</span>
                <span className="font-medium text-gray-600 text-right truncate max-w-[200px]" title={item.remark}>{item.remark}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Viewport-aware hover that renders the transaction number as the trigger and portals
// the card so it's never clipped by table/overflow containers. Hover (desktop) opens it.
export function InwardHoverPortal({ item }: { item: TxCardItem }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; maxHeight: number }>({ left: 0, maxHeight: 480 })
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)

  const CARD_WIDTH = 380
  const MARGIN = 8
  const GAP = 6

  const computePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    let left = rect.left
    if (left + CARD_WIDTH > vw - MARGIN) left = Math.max(MARGIN, vw - CARD_WIDTH - MARGIN)
    if (left < MARGIN) left = MARGIN

    const spaceAbove = rect.top - MARGIN
    const spaceBelow = vh - rect.bottom - MARGIN
    const maxHeight = Math.min(480, spaceAbove >= spaceBelow ? spaceAbove - GAP : spaceBelow - GAP)

    if (spaceAbove >= spaceBelow && spaceAbove >= 100) {
      setPos({ bottom: vh - rect.top + GAP, left, maxHeight })
    } else {
      setPos({ top: rect.bottom + GAP, left, maxHeight })
    }
  }, [])

  const open = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    computePosition()
    setShow(true)
  }, [computePosition])

  const scheduleClose = useCallback(() => {
    hideTimer.current = setTimeout(() => setShow(false), 180)
  }, [])

  const cancelClose = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }, [])

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={open}
        onMouseLeave={scheduleClose}
        className="font-medium cursor-help underline-offset-2 hover:underline"
      >
        {item.transaction_no}
      </span>
      {show && typeof document !== "undefined" && createPortal(
        <div
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{
            position: "fixed",
            ...(pos.bottom !== undefined ? { bottom: pos.bottom } : { top: pos.top }),
            left: pos.left,
            width: Math.min(CARD_WIDTH, window.innerWidth - MARGIN * 2),
            maxHeight: pos.maxHeight,
            zIndex: 9999,
            overflowY: "auto",
            borderRadius: "1rem",
          }}
        >
          <TransactionStatusCard item={item} />
        </div>,
        document.body
      )}
    </>
  )
}
