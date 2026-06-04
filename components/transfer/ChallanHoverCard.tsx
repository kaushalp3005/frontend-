"use client"

import { useState, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { ArrowRight, Loader2, AlertTriangle } from "lucide-react"

export type HoverLine = {
  name: string
  qty?: number | string
  netWeight?: number | string
  lotNumber?: string
  lotFrom?: string
  lotTo?: string
  count?: number  // unit_pack_size × qty, shown for PM/packaging items
  sourceStorage?: string  // cold storage unit, e.g. "Savla D-39", "Rishi"
}

export type HoverMeta = { label: string; value: string; tone?: "default" | "warn" | "success" }

export type DiscrepancyLine = {
  article: string
  lotNumber?: string
  count: number           // boxes with this discrepancy
  remarks?: string
  netWeight?: string      // actual received weight
  totalWeight?: string    // actual gross weight
  casePack?: string       // actual case pack
  unmatched?: number      // unmatched (no corresponding source box)
}

export function ChallanHoverCard({
  challanNo,
  from,
  to,
  reason,
  lines,
  fetchLines,
  meta,
  discrepancies,
}: {
  challanNo: string
  from?: string
  to?: string
  reason?: string
  lines?: HoverLine[]
  fetchLines?: () => Promise<{ lines: HoverLine[]; meta?: HoverMeta[]; discrepancies?: DiscrepancyLine[] }>
  meta?: HoverMeta[]
  discrepancies?: DiscrepancyLine[]
}) {
  const [show, setShow] = useState(false)
  const [fetched, setFetched] = useState<HoverLine[] | null>(null)
  const [fetchedMeta, setFetchedMeta] = useState<HoverMeta[] | null>(null)
  const [fetchedDiscrepancies, setFetchedDiscrepancies] = useState<DiscrepancyLine[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; maxHeight: number }>({ left: 0, maxHeight: 380 })
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)

  const displayLines = fetched ?? lines
  const displayMeta = fetchedMeta ?? meta
  const displayDiscrepancies = fetchedDiscrepancies ?? discrepancies

  const computePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const CARD_WIDTH = 304
    const CARD_MAX_HEIGHT = 360
    const MARGIN = 8
    const GAP = 6
    const vw = window.innerWidth
    const vh = window.innerHeight

    let left = rect.left
    if (left + CARD_WIDTH > vw - MARGIN) left = Math.max(MARGIN, vw - CARD_WIDTH - MARGIN)
    if (left < MARGIN) left = MARGIN

    const spaceAbove = rect.top - MARGIN
    const spaceBelow = vh - rect.bottom - MARGIN

    if (spaceAbove >= 120 || spaceAbove >= spaceBelow) {
      const maxHeight = Math.min(CARD_MAX_HEIGHT, spaceAbove - GAP)
      setPos({ bottom: vh - rect.top + GAP, left, maxHeight })
    } else {
      setPos({ top: rect.bottom + GAP, left, maxHeight: Math.min(CARD_MAX_HEIGHT, spaceBelow - GAP) })
    }
  }, [])

  const open = useCallback(async () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    computePosition()
    setShow(true)
    if (fetchLines && fetched === null && !loading) {
      setLoading(true)
      try {
        const result = await fetchLines()
        setFetched(result.lines)
        if (result.meta) setFetchedMeta(result.meta)
        if (result.discrepancies) setFetchedDiscrepancies(result.discrepancies)
      } catch { setFetched([]) }
      finally { setLoading(false) }
    }
  }, [fetchLines, fetched, loading, computePosition])

  const scheduleClose = useCallback(() => {
    hideTimer.current = setTimeout(() => setShow(false), 180)
  }, [])

  const cancelClose = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }, [])

  const toneClass = (t?: HoverMeta["tone"]) =>
    t === "warn" ? "text-amber-700 bg-amber-50 border-amber-200"
    : t === "success" ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : "text-gray-700 bg-gray-50 border-gray-200"

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={open}
        onMouseLeave={scheduleClose}
        className="text-sm font-semibold text-blue-700 cursor-default underline underline-offset-2 decoration-dotted decoration-blue-400"
      >
        {challanNo}
      </span>
      {show && typeof document !== "undefined" && createPortal(
        <div
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{
            position: "fixed",
            ...(pos.bottom !== undefined ? { bottom: pos.bottom } : { top: pos.top }),
            left: pos.left,
            width: displayDiscrepancies && displayDiscrepancies.length > 0 ? 340 : 304,
            maxHeight: pos.maxHeight,
            background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 45%, #faf5ff 100%)",
            boxShadow: "0 20px 40px -10px rgba(79, 70, 229, 0.22), 0 8px 16px -4px rgba(236, 72, 153, 0.14), 0 0 0 1px rgba(147, 197, 253, 0.45)",
          }}
          className="z-[9999] rounded-2xl p-3 space-y-2.5 overflow-y-auto backdrop-blur-sm"
        >
          {(from || to) && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium max-w-[110px] truncate">{from || '—'}</span>
              {to && to !== from && (
                <>
                  <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium max-w-[110px] truncate">{to}</span>
                </>
              )}
            </div>
          )}

          {reason && (
            <div className="flex items-start gap-1.5 text-xs border-t border-gray-100 pt-2">
              <span className="text-gray-400 shrink-0 mt-0.5">Reason:</span>
              <span className="text-gray-700 font-medium leading-snug">{reason}</span>
            </div>
          )}

          {displayMeta && displayMeta.length > 0 && (
            <div className="flex flex-wrap gap-1 border-t border-gray-100 pt-2">
              {displayMeta.map((m, i) => (
                <span key={i} className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${toneClass(m.tone)}`}>
                  <span className="opacity-60">{m.label}:</span> {m.value}
                </span>
              ))}
            </div>
          )}

          <div className="border-t border-gray-100 pt-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Items</p>
            {loading ? (
              <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading items...
              </div>
            ) : displayLines && displayLines.length > 0 ? (
              <div className="space-y-1">
                {displayLines.map((line, i) => (
                  <div key={i} className="text-xs bg-white/70 border border-blue-100 rounded-lg px-2 py-1.5 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-gray-800 leading-snug">{line.name}</span>
                      {line.qty !== undefined && (
                        <span className="shrink-0 text-gray-500 text-[11px] tabular-nums">{line.qty} boxes</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5 text-[11px]">
                      {line.netWeight !== undefined && line.netWeight !== "" && (
                        <span className="text-gray-500">Wt: <span className="font-medium text-gray-700">{line.netWeight} kg</span></span>
                      )}
                      {line.count !== undefined && line.count > 0 && (
                        <span className="text-gray-500">Count: <span className="font-semibold text-rose-700">{line.count.toLocaleString("en-IN")}</span></span>
                      )}
                      {line.lotNumber && (
                        <span className="font-mono text-indigo-600">Lot: {line.lotNumber}</span>
                      )}
                      {line.sourceStorage && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-violet-50 text-violet-700 border-violet-200">
                          <span className="opacity-60">From: </span>{line.sourceStorage}
                        </span>
                      )}
                    </div>
                    {line.lotFrom && line.lotTo && (
                      <div className="flex items-center gap-1 text-[11px] font-mono mt-0.5">
                        <span className="text-gray-400">{line.lotFrom}</span>
                        <ArrowRight className="h-2.5 w-2.5 text-gray-300" />
                        <span className="text-orange-600 font-semibold">{line.lotTo}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 py-1">No item details available</p>
            )}
          </div>

          {displayDiscrepancies && displayDiscrepancies.length > 0 && (
            <div className="border-t border-gray-100 pt-2">
              <p className="text-[10px] font-semibold text-rose-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Discrepancies
              </p>
              <div className="space-y-1">
                {displayDiscrepancies.map((disc, i) => (
                  <div key={i} className="text-xs bg-rose-50/70 border border-rose-200 rounded-lg px-2 py-1.5 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <span className="font-medium text-rose-700">{disc.article}</span>
                      <span className="shrink-0 text-rose-600 text-[11px] font-medium tabular-nums">{disc.count} box{disc.count > 1 ? 'es' : ''}</span>
                    </div>
                    {disc.lotNumber && (
                      <div className="text-[11px] text-rose-600 mb-0.5">
                        Lot: <span className="font-mono">{disc.lotNumber}</span>
                      </div>
                    )}
                    {disc.remarks && typeof disc.remarks === 'string' && (
                      <div className="text-[11px] text-rose-700 mb-0.5">
                        <span className="opacity-70">Remark:</span> {disc.remarks}
                      </div>
                    )}
                    {(disc.netWeight || disc.totalWeight || disc.casePack) && (
                      <div className="flex flex-wrap gap-2 text-[10px] text-rose-600 mt-0.5">
                        {disc.netWeight && <span>Net: <span className="font-medium">{disc.netWeight} kg</span></span>}
                        {disc.totalWeight && <span>Gross: <span className="font-medium">{disc.totalWeight} kg</span></span>}
                        {disc.casePack && typeof disc.casePack === 'string' && disc.casePack !== '' && <span>Case Pack: <span className="font-medium">{disc.casePack}</span></span>}
                      </div>
                    )}
                    {disc.unmatched !== undefined && disc.unmatched > 0 && (
                      <div className="text-[11px] text-rose-700 font-medium mt-0.5">
                        {disc.unmatched} unmatched
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

const isCountableLine = (l: any) => {
  const mt = (l.material_type || l.rm_pm_fg_type || "").toUpperCase()
  const cat = (l.item_category || "").toUpperCase()
  return mt === "PM" || cat === "PACKAGING"
}

export function groupLinesByItem(lines: any[], fallbackUnit?: string): HoverLine[] {
  type Agg = {
    name: string
    qty: number
    netWeight: number
    lotNumber?: string
    countable: boolean
    unitPackSize: number
    lotOriginUnit?: string  // authoritative single per-lot cold unit (from cold_stocks)
  }
  const grouped = new Map<string, Agg>()
  for (const l of lines) {
    const name = l.item_description || l.item_desc_raw || l.article || 'Unknown'
    const lot = l.lot_number || ''
    const key = `${name}||${lot}`
    const g: Agg = grouped.get(key) || {
      name,
      qty: 0,
      netWeight: 0,
      lotNumber: lot || undefined,
      countable: isCountableLine(l),
      unitPackSize: parseFloat(String(l.unit_pack_size || 0)) || 0,
    }
    g.qty += Number(l.quantity || l.qty || 1)
    g.netWeight += Number(l.net_weight || l.total_weight || 0)
    // Use first non-zero unit_pack_size we see for this item
    if (!g.unitPackSize) g.unitPackSize = parseFloat(String(l.unit_pack_size || 0)) || 0
    if (!g.countable) g.countable = isCountableLine(l)
    // Single authoritative per-lot cold unit (server-computed from cold_stocks),
    // so line-only transfers show the same per-lot "From" chip as box transfers.
    const lou = (l.lot_origin_unit || "").toString().trim()
    if (lou && !g.lotOriginUnit) g.lotOriginUnit = lou
    grouped.set(key, g)
  }
  return Array.from(grouped.values()).map(g => {
    const count = g.countable && g.unitPackSize > 0 ? g.unitPackSize * g.qty : 0
    return {
      name: g.name,
      qty: g.qty,
      netWeight: g.netWeight > 0 ? Number(g.netWeight.toFixed(3)) : undefined,
      lotNumber: g.lotNumber,
      count: count > 0 ? count : undefined,
      // Per-lot cold unit when known; else the transfer-level cold unit so a
      // cold-sourced transfer always shows a "From" chip.
      sourceStorage: g.lotOriginUnit || fallbackUnit,
    }
  })
}

export function groupBoxesByItem(boxes: any[], fallbackUnit?: string): HoverLine[] {
  type Agg = {
    name: string
    qty: number
    netWeight: number
    lotNumber?: string
    countable: boolean
    unitPackSize: number
    // Authoritative single per-lot cold unit (server-computed from cold_stocks).
    lotOriginUnit?: string
    // Per-box fallback units + frequencies — used ONLY when lotOriginUnit is absent,
    // and even then we surface the single most-common one (never a joined list).
    fallbackCounts: Map<string, number>
  }
  const grouped = new Map<string, Agg>()
  for (const b of boxes) {
    const name = b.article || b.item_description || 'Unknown'
    const lot = b.lot_number || ''
    const key = `${name}||${lot}`
    const g: Agg = grouped.get(key) || {
      name,
      qty: 0,
      netWeight: 0,
      lotNumber: lot || undefined,
      countable: isCountableLine(b),
      unitPackSize: parseFloat(String(b.unit_pack_size || 0)) || 0,
      fallbackCounts: new Map<string, number>(),
    }
    g.qty += 1
    g.netWeight += Number(b.net_weight || 0)
    if (!g.unitPackSize) g.unitPackSize = parseFloat(String(b.unit_pack_size || 0)) || 0
    if (!g.countable) g.countable = isCountableLine(b)
    // A lot maps to exactly ONE warehouse. The authoritative value is the
    // server-computed `lot_origin_unit` (the dominant unit for this lot across
    // cfpl/cdpl cold_stocks). Take it as the single source of truth.
    const lou = (b.lot_origin_unit || "").toString().trim()
    if (lou && !g.lotOriginUnit) g.lotOriginUnit = lou
    const fb = (b.source_unit || b.source_storage || "").toString().trim()
    if (fb) g.fallbackCounts.set(fb, (g.fallbackCounts.get(fb) || 0) + 1)
    grouped.set(key, g)
  }
  return Array.from(grouped.values()).map(g => {
    const count = g.countable && g.unitPackSize > 0 ? g.unitPackSize * g.qty : 0
    // Exactly one warehouse per lot: authoritative cold_stocks unit first; else the
    // single most-common per-box unit. Never list multiple.
    let sourceStorage = g.lotOriginUnit
    if (!sourceStorage && g.fallbackCounts.size > 0) {
      sourceStorage = Array.from(g.fallbackCounts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]
    }
    // Last resort: the transfer-level cold unit (header from_cold_unit), so a
    // cold-sourced transfer always shows a "From" chip even when a lot can't be
    // mapped per-row (e.g. cold_stocks already consumed on a dispatched transfer).
    if (!sourceStorage) sourceStorage = fallbackUnit
    return {
      name: g.name,
      qty: g.qty,
      netWeight: g.netWeight > 0 ? Number(g.netWeight.toFixed(3)) : undefined,
      lotNumber: g.lotNumber,
      count: count > 0 ? count : undefined,
      sourceStorage,
    }
  })
}
